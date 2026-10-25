# least-squares fit of every ringing string (known frequencies from the cue log) in each note's own span
import json, sys, math
import numpy as np
W = '<project>/work/xvsea'
SP = '<tmp>'
mode = sys.argv[1]
m = json.load(open(f'{W}/test/pitchrev_cdp/rec/mk_{mode}.json'))
rows = json.load(open(f'{SP}/rows_{mode}.json'))
x = np.fromfile(f'{W}/test/pitchrev_cdp/rec/mk_{mode}.f32', dtype=np.float32).reshape(-1, 2)
fs = m['rate']; mono = x.mean(axis=1).astype(np.float64)
f0s = m['f0'] / fs
strs = sorted([c for c in m['cues'] if c['str']], key=lambda c: c['t'])
ons = sorted(set(round(c['t'], 6) for c in strs))
NAMES = ['C','C#','D','D#','E','E#','F#','G','G#','A','A#','B']
nm = lambda f: (lambda mm: NAMES[mm % 12] + str(mm // 12 - 1))(int(round(69 + 12 * math.log2(f / 440))))
out = []
for i, t in enumerate(ons):
    t1 = ons[i + 1] if i + 1 < len(ons) else t + 0.6
    a, b = int((t + 0.010 - f0s) * fs), int((min(t1, t + 0.6) - 0.002 - f0s) * fs)
    tt = np.arange(a, b) / fs
    # strings started at or before t, among the last 16 (cap may have stolen older ones: the fit says)
    live = [c for c in strs if c['t'] <= t + 1e-6][-14:]
    pitches = {}
    for c in live:
        for p, (f, amp, t60) in enumerate(c['m'][:4]):
            mm = int(round(69 + 12 * math.log2(f / 440)))
            pitches[mm] = f   # the most recent string's frequency for this pitch
    keys = sorted(pitches)
    A = np.array(sum([[np.cos(2 * np.pi * pitches[k] * tt), np.sin(2 * np.pi * pitches[k] * tt)] for k in keys], [])).T
    coef, *_ = np.linalg.lstsq(A, mono[a:b], rcond=None)
    amp = {k: math.hypot(coef[2 * j], coef[2 * j + 1]) for j, k in enumerate(keys)}
    curM = rows[i]['midi']
    Lcur = amp[curM]
    prevM = set(int(round(69 + 12 * math.log2(c['m'][0][0] / 440))) for c in live if c['t'] < t - 1e-6)
    others = sorted([(round(20 * math.log10(amp[k] / Lcur + 1e-12), 1), NAMES[k % 12] + str(k // 12 - 1), k - curM) for k in keys if k != curM and k in prevM], reverse=True)
    dis = [o for o in others if abs(o[2]) in (1, 2)]
    out.append(dict(i=i, t=round(t - ons[0], 3), note=rows[i]['name'], span_ms=round(1000 * (b - a) / fs), top=others[:4], worstSecond=dis[0] if dis else None, octUp=round(20*math.log10(amp.get(curM+12,0)/Lcur+1e-12),1), p3=round(20*math.log10(amp.get(curM+19,0)/Lcur+1e-12),1), octDn=round(20*math.log10(amp.get(curM-12,0)/Lcur+1e-12),1)))

ws = [o['worstSecond'][0] for o in out if o['worstSecond']]
print('notes with a ringing 2nd/7th neighbour >= -6 dB:', sum(1 for v in ws if v >= -6), '; >= -12 dB:', sum(1 for v in ws if v >= -12), 'of', len(out), '; median', np.median(ws))
json.dump(out, open(f'{SP}/ls3_{mode}.json', 'w'))

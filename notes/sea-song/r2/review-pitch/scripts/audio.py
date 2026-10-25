import json, sys, math
import numpy as np
W = '<project>/work/xvsea'
SP = '<tmp>'
mode = sys.argv[1]
m = json.load(open(f'{W}/test/pitchrev_cdp/rec/mk_{mode}.json'))
rows = json.load(open(f'{SP}/rows_{mode}.json'))
x = np.fromfile(f'{W}/test/pitchrev_cdp/rec/mk_{mode}.f32', dtype=np.float32).reshape(-1, 2)
fs = m['rate']; mono = x.mean(axis=1).astype(np.float64); N = len(mono)
f0s = m['f0'] / fs
strs = [c for c in m['cues'] if c['str']]
ons = sorted(set(round(c['t'], 6) for c in strs))
idx = [int(round((t - f0s) * fs)) for t in ons]
NF = 1 << 19
def spec(a, b, win='hann'):
    seg = mono[a:b]
    w = np.hanning(len(seg)) if win == 'hann' else np.blackman(len(seg))
    S = np.abs(np.fft.rfft(seg * w, NF))
    return S / (w.sum() / 2)
fr = np.fft.rfftfreq(NF, 1 / fs)
def peak(S, f, c=60):
    lo, hi = f * 2 ** (-c / 1200), f * 2 ** (c / 1200)
    i0, i1 = np.searchsorted(fr, lo), np.searchsorted(fr, hi)
    k = i0 + int(np.argmax(S[i0:i1]))
    if 0 < k < len(S) - 1:
        a, b, g = np.log(S[k - 1] + 1e-20), np.log(S[k] + 1e-20), np.log(S[k + 1] + 1e-20)
        p = 0.5 * (a - g) / (a - 2 * b + g)
    else: p = 0
    return (k + p) * fs / NF, 20 * np.log10(S[k] + 1e-20)
db = lambda v: 20 * np.log10(v + 1e-20)
res = []
for i, r in enumerate(rows):
    a = idx[i] + int(0.012 * fs)
    # window: up to 0.30 s, stop before the next onset of the same midi or its octave (so one string is measured)
    end = a + int(0.30 * fs)
    for j in range(i + 1, len(rows)):
        if rows[j]['midi'] % 12 == r['midi'] % 12: end = min(end, idx[j]); break
    end = max(end, a + int(0.08 * fs))
    S = spec(a, end)
    fw = 440 * 2 ** ((r['midi'] - 69) / 12)
    f, L = peak(S, fw)
    _, Lb = peak(S, fw / 2, 50); _, Lu = peak(S, 2 * fw, 50); _, Lu2 = peak(S, 4 * fw, 50); _, L3 = peak(S, 3 * fw, 50)
    # before-onset spectrum, same length, for "new" levels
    n = end - a; b0 = max(0, idx[i] - n - int(0.002 * fs))
    Sb = spec(b0, idx[i] - int(0.002 * fs)) if idx[i] - b0 > 1000 else S * 0
    newS = np.maximum(S - Sb, 0)
    _, Ln = peak(newS, fw); _, Lnb = peak(newS, fw / 2, 50); _, Lnu = peak(newS, 2 * fw, 50)
    # strongest other component in the window within a minor 3rd (excl. the note itself ±40 cents), 200..1100 Hz
    lo, hi = fw * 2 ** (-3.5 / 12), fw * 2 ** (3.5 / 12)
    i0, i1 = np.searchsorted(fr, lo), np.searchsorted(fr, hi)
    mask = np.abs(1200 * np.log2(fr[i0:i1] / fw)) > 60
    seg = S[i0:i1] * mask
    k = int(np.argmax(seg)); fo = fr[i0 + k]; Lo = db(seg[k])
    res.append(dict(i=i, name=r['name'], midi=r['midi'], win_ms=round(1000 * (end - a) / fs), f=round(f, 3), cents=round(1200 * math.log2(f / fw), 2), sched=r['cents'], L=round(L, 1), below=round(Lb - L, 1), above=round(Lu - L, 1), p3=round(L3 - L, 1), above2=round(Lu2 - L, 1),
                    newAbove=round(Lnu - Ln, 1), newBelow=round(Lnb - Ln, 1), nbF=round(fo, 1), nbSemis=round(12 * math.log2(fo / fw), 2), nbDb=round(Lo - L, 1)))
c = np.array([q['cents'] for q in res]); d = np.array([q['cents'] - q['sched'] for q in res])
print(mode, 'measured cents vs written: mean %.2f sd %.2f min %.2f max %.2f; vs scheduled: max |d| %.2f' % (c.mean(), c.std(), c.min(), c.max(), np.abs(d).max()))
print('octave below level (dB re note): max %.1f; octave above: min %.1f mean %.1f max %.1f; new-above max %.1f' % (max(q['below'] for q in res), min(q['above'] for q in res), np.mean([q['above'] for q in res]), max(q['above'] for q in res), max(q['newAbove'] for q in res)))
print('strongest is written octave on', sum(1 for q in res if q['above'] < 0 and q['below'] < 0 and q['above2'] < 0), 'of', len(res))
nb = sorted(res, key=lambda q: -q['nbDb'])
print('loudest neighbour (within 3.5 semitones) during each note: median %.1f dB; worst:' % np.median([q['nbDb'] for q in res]))
for q in nb[:14]: print('  ', q['i'], q['name'], 'neighbour %.1f Hz (%+.2f st) at %.1f dB' % (q['nbF'], q['nbSemis'], q['nbDb']))
json.dump(res, open(f'{SP}/audio_{mode}.json', 'w'))
# section RMS
SC = json.load(open(f'{W}/test/fixtures/seasong_score.json')); T = SC['ticks']
t00 = ons[0] - SC['notes'][0][2]
def rms(a, b):
    i0, i1 = int((t00 + a - f0s) * fs), int((t00 + b - f0s) * fs); s = x[i0:i1]; return 10 * np.log10((s ** 2).mean() + 1e-20)
print('RMS st1 %.1f st2 %.1f st3 %.1f coda %.1f' % (rms(T[0], T[1]), rms(T[1], T[2]), rms(T[2], T[3]), rms(T[3], T[3] + 3)))
# tail
for a, b in [(22.0, 23.0), (23.0, 24.0), (24, 25), (25, 25.9)]:
    print('tail', a, b, '%.1f dBFS' % rms(a, b))

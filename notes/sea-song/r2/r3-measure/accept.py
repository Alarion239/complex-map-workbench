# Round 3's acceptance measures on a recording of the Mountain King (test/seasong_rec_cmd.js: <rec>.f32 + .json), by a
# least-squares fit of sinusoids at the known string frequencies (the score's notes with its tuning), as the review did:
#  pitch-1: in each theme note, 50 ms after its onset, the loudest ringing 2nd (a note 1 or 2 semitones away among the
#           four before it) against the new note, dB (want <= -20);
#  pitch-2: each theme note's octave (2f) against its fundamental over its own span, dB (want within +-1.5 dB);
#  pitch-2/5: the final chord's ring-out, slow AM of the B4, D5 and F#5 bands (want <= 3 dB, after the decay's trend).
#   python3 accept.py <rec.f32> <score fixture> [out.json]
import json, sys, math
import numpy as np
f32, fix = sys.argv[1], sys.argv[2]
meta = json.load(open(f32[:-4] + '.json')); SC = json.load(open(fix))
fs = meta['rate']; x = np.fromfile(f32, dtype=np.float32).reshape(-1, 2).mean(axis=1).astype(np.float64)
SN = [s for s in SC['notes'] if not s[4]]
on = sorted(set(round(c[0], 6) for c in meta['cues'] if c[1]))
tPlay = on[0] - SN[0][2] - meta['f0'] / fs
TUNE = {6: 1.955}
freq = lambda m: 440 * 2 ** ((m - 69) / 12) * 2 ** (TUNE.get(m % 12, 0) / 1200)
def fit(t0, t1, fr):
    i0, i1 = int(round((tPlay + t0) * fs)), int(round((tPlay + t1) * fs))
    y = x[i0:i1]; t = np.arange(len(y)) / fs
    A = np.column_stack([f(2 * math.pi * f_ * t) for f_ in fr for f in (np.cos, np.sin)])
    c, *_ = np.linalg.lstsq(A, y, rcond=None)
    return [math.hypot(c[2 * k], c[2 * k + 1]) for k in range(len(fr))]
db = lambda a, b: 20 * math.log10(max(a, 1e-12) / max(b, 1e-12))
theme = [i for i, s in enumerate(SN) if s[6] is not None and not str(s[6]).startswith('chord')]
res = {'seconds': [], 'octave': []}
for k in theme:
    s = SN[k]; m = s[5]; t = s[2]; nxt = SN[k + 1][2] if k + 1 < len(SN) else t + 0.3
    prev = [SN[j][5] for j in range(max(0, k - 4), k) if 0 < abs(SN[j][5] - m) <= 2]
    # pitch-1: from 50 ms after the onset, 40 ms (or to the next onset)
    a, b = t + 0.05, min(nxt, t + 0.09)
    if prev and b - a >= 0.03:
        fr = [freq(m), 2 * freq(m)] + sum([[freq(p), 2 * freq(p)] for p in sorted(set(prev))], [])
        amp = fit(a, b, fr)
        res['seconds'].append({'k': k, 't': round(t, 3), 'note': m, 'second': max(sorted(set(prev)), key=lambda p: amp[2 + 2 * sorted(set(prev)).index(p)]), 'db': round(max(db(amp[2 + 2 * i], amp[0]) for i in range(len(set(prev)))), 1)})
    # pitch-2: the octave over the note's own span (onset + 10 ms to the next onset)
    a, b = t + 0.01, nxt
    amp = fit(a, b, [freq(m), 2 * freq(m), 3 * freq(m)])
    res['octave'].append({'k': k, 'note': m, 'db': round(db(amp[1], amp[0]), 2)})
# the ring-out: from 0.4 s after the last onset, 100 ms windows every 50 ms, while the fundamental is above -70 dBFS
last = SN[-1][2]; chord = sorted(set(s[5] for s in SN[-4:]))
bands = {'B4': 71, 'D5': 74, 'F#5': 78}
fr = sorted(set([freq(m) * n for m in chord for n in range(1, 5)]))
rows = []; t = last + 0.4
while t + 0.1 < len(x) / fs - tPlay - 0.05:
    amp = fit(t, t + 0.1, fr); rows.append((t, amp)); t += 0.05
    if 20 * math.log10(max(amp[0], 1e-12)) < -75: break
am = {}
for nm, m in bands.items():
    f = freq(m); j = min(range(len(fr)), key=lambda i: abs(fr[i] - f))
    tt = np.array([r[0] for r in rows]); L = np.array([20 * math.log10(max(r[1][j], 1e-12)) for r in rows])
    ok = L > L.max() - 50; tt, L = tt[ok], L[ok]
    p = np.polyfit(tt, L, 1); r = L - np.polyval(p, tt)
    # (rises: windows louder than the one before by over 0.5 dB, a beat's sign; a monotone decay has none)
    am[nm] = {'am_db': round(float(r.max() - r.min()), 2), 'decay_db_s': round(float(p[0]), 1), 'span_s': round(float(tt[-1] - tt[0]), 2), 'rises': int(np.sum(np.diff(L) > 0.5)), 'maxRise_db': round(float(max(0, np.diff(L).max())), 2)}
sec = [r['db'] for r in res['seconds']]; octv = [r['db'] for r in res['octave']]
out = {'seconds': {'n': len(sec), 'worst_db': max(sec) if sec else None, 'over_-20': sum(1 for v in sec if v > -20), 'over_-12': sum(1 for v in sec if v > -12)},
       'octave': {'n': len(octv), 'min': min(octv), 'max': max(octv), 'median': float(np.median(octv)), 'spread': round(max(octv) - min(octv), 2)},
       'ringout': am, 'tPlay': tPlay}
print(json.dumps(out))
if len(sys.argv) > 3: json.dump(dict(out, notes=res), open(sys.argv[3], 'w'))

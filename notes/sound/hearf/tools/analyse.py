# python3 tools/analyse.py <dir> '<glob>': loudness (LUFS-M, BS.1770 K-weighting, 400 ms windows: the loudest window and
# the gated mean), peak, and clicks from notes/sound/cdp3/det.py (detector A: 9-11 kHz impulses; B: linear-prediction
# residual). A hit inside a cue's designed attack (its first 40 ms) is not counted; a B hit within 80 ms after 20 ms of
# near-silence (below -80 dBFS) is an onset (B cannot predict out of silence); every other hit is the engine's.
import sys, os, glob, json
import numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'cdp3'))
import det

def kw(x, fs):
    # the two K-weighting biquads applied in the frequency domain (their complex response; 1 s of padding holds the tails)
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    n = len(x); N = 1 << int(np.ceil(np.log2(n + fs))); w = np.exp(-2j * np.pi * np.fft.rfftfreq(N))
    H = lambda b, a: (b[0] + b[1] * w + b[2] * w * w) / (a[0] + a[1] * w + a[2] * w * w)
    return np.fft.irfft(np.fft.rfft(x, N, axis=0) * (H(b1, a1) * H(b2, a2))[:, None], N, axis=0)[:n]

def loud(x, fs):
    y = kw(x, fs); W = int(0.4 * fs); hop = int(0.1 * fs); e = (y ** 2).sum(axis=1)
    c = np.concatenate([[0], np.cumsum(e)]); bl = np.array([(c[s + W] - c[s]) / W for s in range(0, len(e) - W, hop)])
    lu = -0.691 + 10 * np.log10(bl + 1e-30); g1 = bl[lu > -70]
    if not len(g1): return lu.max(), None
    m1 = g1.mean(); g2 = g1[-0.691 + 10 * np.log10(g1) > -0.691 + 10 * np.log10(m1) - 10]
    return float(lu.max()), float(-0.691 + 10 * np.log10(g2.mean()))

d, g = sys.argv[1], sys.argv[2]
rows = []
for p in sorted(glob.glob(os.path.join(d, g + '.f32'))):
    r, a, b, meta = det.analyse(p)
    x = det.load(p); fs = meta['fs']; mx, gm = loud(x, fs)
    # detector B cannot predict out of digital silence (its least-squares fit on ~0 data is arbitrary: ratios of 1e10 and
    # more). A B hit within 80 ms after at least 20 ms below -80 dBFS is an onset from (near-)silence: reported apart, and
    # judged by detector A (broadband energy at 9-11 kHz) and the envelope's design instead
    m = np.abs(x).max(axis=1); sil = (m < 1e-4).astype(np.int8)   # near-silence: below -80 dBFS (the voices sit near -35 dBFS RMS)
    d_ = np.diff(np.concatenate([[0], sil, [0]])); st_ = np.where(d_ == 1)[0]; en_ = np.where(d_ == -1)[0]
    runs_end = np.array([e for a_, e in zip(st_, en_) if e - a_ >= int(0.02 * fs)])
    def from_silence(s):
        return bool(len(runs_end) and np.any((runs_end <= s) & (runs_end >= s - int(0.08 * fs))))
    b_sil = [h for h in r['B_engine'] if from_silence(h['s'])]
    r['B_engine'] = [h for h in r['B_engine'] if not from_silence(h['s'])]
    audA = [h for h in r['A_engine'] if h['lvl'] >= det.AUD]; audB = [h for h in r['B_engine'] if h['lvl'] >= det.AUD]
    row = {'case': r['file'], 'secs': r['secs'], 'lufs_max': round(mx, 1), 'lufs_gated': None if gm is None else round(gm, 1), 'peak': round(float(np.abs(x).max()), 4),
           'A_engine': len(r['A_engine']), 'B_engine': len(r['B_engine']), 'aud_A': len(audA), 'aud_B': len(audB), 'A_cue': r['A_cue'], 'B_cue': r['B_cue'], 'B_silence_onset': len(b_sil), 'cues': r['cues'],
           'worstA_dB': round(max([h['lvl'] for h in r['A_engine']] or [-999]), 1), 'worstB_dB': round(max([h['lvl'] for h in r['B_engine']] or [-999]), 1),
           'auto': meta.get('auto'), 'srcs': meta.get('srcs'), 'underruns': (meta.get('ps') or {}).get('underrunEvents'), 'labels': len(meta.get('labels', []))}
    rows.append(row)
    print(f"{row['case']:<34} {row['secs']:6.2f}s LUFS max {row['lufs_max']:6.1f} gated {str(row['lufs_gated']):>6} peak {row['peak']:.3f} | clicks A {row['A_engine']} (aud {row['aud_A']}, worst {row['worstA_dB']}) B {row['B_engine']} (aud {row['aud_B']}, worst {row['worstB_dB']}) | B at onsets from silence {row['B_silence_onset']} | cue-attack hits A {row['A_cue']} B {row['B_cue']} of {row['cues']} onsets | auto {row['auto']} srcs {row['srcs']} underruns {row['underruns']}")
    if '--detail' in sys.argv:
        for h in (r['A_engine'] + r['B_engine'])[:8]: print('    ', json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in h.items() if k in ('t', 'lvl', 'crest', 'ratio', 'onset')}))
if '--json' in sys.argv:
    out = sys.argv[sys.argv.index('--json') + 1]; json.dump(rows, open(out, 'w'), indent=1)

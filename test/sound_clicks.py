# (test/sound_clicks.py: a copy of notes/sound/cdp2/clicks.py, the detector of DESIGN §7.1, for test/sound_clicks_cmd.js.
#  One change, from the independent detector notes/sound/cdp3/det.py: the local full-band RMS a peak is measured against
#  is never below 1/10 of the recording's RMS, so float specks in a fade to silence (−143 dBFS: the pointer leaving the
#  relief in the Landscape gates the voice off) are not counted as clicks.)
# Objective click detector for recordings of the continuous voices (float32 stereo interleaved, .f32).
#   python3 clicks.py <dir> <glob> [--fs 44100] [--detail]
# Method: a zero-phase 8th-order Butterworth high-pass at 5 kHz (the Shepard voice has nothing above ~4.7 kHz that is
# louder than −40 dB re its loudest partial, and those partials move slowly, so the high band is a steady, low-crest
# signal; a discontinuity in a sample value or a slope is broadband and shows up there as an impulse). In 1.45 ms blocks:
# peak |hp| against the high band's local background (the median block RMS over ±23 ms) and against the full-band
# local RMS. A click: crest ≥ 12 dB over the high-band background AND the peak ≥ −60 dB re the full-band RMS (both
# channels; the first and last 30 ms are skipped). Reported per file: clicks, the worst level (dB re the full-band RMS),
# counts per level band, the HF background, and (with the .json event log) where clicks fall relative to the pointer
# events. The same metric on a clean reference (per-sample synthesis) and on injected steps calibrates it (--selftest).
import glob
import json
import os
import sys

import numpy as np

def load(p):
    return np.fromfile(p, dtype=np.float32).reshape(-1, 2).astype(np.float64)

def hp(x, fs, fc=5000.0, order=8):
    n = len(x); N = 1 << int(np.ceil(np.log2(n + 8192)))
    X = np.fft.rfft(x, N, axis=0); f = np.fft.rfftfreq(N, 1 / fs)
    H = 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-9)) ** (2 * order))
    return np.fft.irfft(X * H[:, None], N, axis=0)[:n]

def rolling_median(v, half):
    n = len(v); out = np.empty(n)
    for i in range(n):
        a = max(0, i - half); b = min(n, i + half + 1)
        out[i] = np.median(v[a:b])
    return out

FC = 10000.0
def detect(x, fs, crest_db=12.0, floor_db=-60.0, B=64, skip=0.03):
    y = hp(x, fs, FC)
    nb = len(x) // B
    res = []
    worst = -200.0; bgs = []
    for ch in range(x.shape[1]):
        yb = y[:nb * B, ch].reshape(nb, B); xb = x[:nb * B, ch].reshape(nb, B)
        pk = np.abs(yb).max(axis=1); rms_h = np.sqrt((yb ** 2).mean(axis=1)); rms_x = np.sqrt((xb ** 2).mean(axis=1))
        half = int(round(0.023 * fs / B))
        bg = rolling_median(rms_h, half) + 1e-12
        sig = np.sqrt(np.convolve(rms_x ** 2, np.ones(2 * half + 1) / (2 * half + 1), mode='same')) + 1e-12
        sig = np.maximum(sig, 0.1 * np.sqrt((x[:, ch] ** 2).mean()))
        crest = 20 * np.log10(pk / bg + 1e-30); lvl = 20 * np.log10(pk / sig + 1e-30)
        k0 = int(skip * fs / B); k1 = nb - k0
        live = sig > 1e-5   # ignore silence (below −100 dBFS)
        for k in range(k0, k1):
            if live[k] and crest[k] >= crest_db and lvl[k] >= floor_db:
                res.append((k * B + int(np.argmax(np.abs(yb[k]))), ch, float(lvl[k]), float(crest[k]), float(20 * np.log10(pk[k] + 1e-30))))
            if live[k] and crest[k] >= crest_db: worst = max(worst, float(lvl[k]))
        bgs.append(float(np.median(20 * np.log10(bg[k0:k1][live[k0:k1]] / sig[k0:k1][live[k0:k1]]))) if live[k0:k1].any() else -200)
    # merge the two channels' detections within 2 ms
    res.sort(); merged = []
    for r in res:
        if merged and r[0] - merged[-1][0] < 0.002 * fs:
            if r[2] > merged[-1][2]: merged[-1] = r
        else: merged.append(r)
    return merged, worst, bgs

def bands(cl):
    b = {'-60..-50': 0, '-50..-40': 0, '-40..-30': 0, '>=-30': 0}
    for c in cl:
        lvl = c[2]
        b['>=-30' if lvl >= -30 else '-40..-30' if lvl >= -40 else '-50..-40' if lvl >= -50 else '-60..-50'] += 1
    return b

def main():
    D = sys.argv[1]; pat = sys.argv[2]; fs = 44100
    if '--fs' in sys.argv: fs = int(sys.argv[sys.argv.index('--fs') + 1])
    detail = '--detail' in sys.argv
    global FC
    if '--fc' in sys.argv: FC = float(sys.argv[sys.argv.index('--fc') + 1])
    rows = []
    for p in sorted(glob.glob(os.path.join(D, pat + '.f32'))):
        x = load(p)
        jp0 = p[:-4] + '.json'
        if os.path.exists(jp0): fs = json.load(open(jp0)).get('rate', fs)
        # the detector looks above FC (5 kHz): a recording whose Nyquist frequency is not well above that band sees
        # nothing there and would pass silently (Bluetooth earbuds in call mode record at 16 kHz mono)
        if fs < 4 * FC:
            sys.exit(f'{os.path.basename(p)}: recorded at {fs} Hz, too low for a {FC:.0f} Hz high-pass band (needs >= {4 * FC:.0f} Hz). Switch the output to 44.1 or 48 kHz and record again.')
        if len(x) < fs * 0.2: print(os.path.basename(p), 'too short'); continue
        cl, worst, bgs = detect(x, fs)
        name = os.path.basename(p)[:-4]
        rms = 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-30); peak = 20 * np.log10(np.abs(x).max() + 1e-30)
        info = ''
        jp = p[:-4] + '.json'
        designed = 0
        if os.path.exists(jp) and cl and json.load(open(jp)).get('cues'):
            # a detection within a scheduled cue's own sound (0–150 ms from its start) is that cue (a cut tick, a ping); the cues'
            # envelopes are checked on their own by the prototype's lab (onset ≤ 0.35 of peak in the first 0.25 ms, last sample 0)
            J = json.load(open(jp)); cs = np.array([c[1] for c in J['cues']]) * fs - J['f0']
            # (an entry [name, t, len, window] gives its own window after len; the synth's one-shots and harp
            # strings are logged with a 6 ms window: only a note's own attack is excused, never its ring)
            ln = np.array([(c[2] if len(c) > 2 else 0) + (c[3] if len(c) > 3 else 0.15) for c in J['cues']]) * fs
            keep = []
            for c in cl:
                d = c[0] - cs
                if ((d >= -0.003 * fs) & (d <= ln)).any(): designed += 1
                else: keep.append(c)
            cl = keep
        if os.path.exists(jp) and cl:
            J = json.load(open(jp)); f0 = J['f0']; ev = np.array([e[1] for e in J['log']]) * fs - f0
            offs = []
            for c in cl:
                d = c[0] - ev; d = d[d >= 0]
                offs.append(d.min() / fs * 1000 if len(d) else -1)
            info = f" after-event ms: median {np.median(offs):.1f}"
        dur = len(x) / fs
        if designed: info += f" (+{designed} at designed cue onsets)"
        if cl: worst = max(c[2] for c in cl)
        elif designed: worst = -200.0
        rows.append((name, len(cl), len(cl) / dur, worst, bands(cl), rms, peak, bgs))
        print(f"{name:34s} {fs // 1000:2d}k clicks {len(cl):4d} ({len(cl) / dur:5.1f}/s) worst {worst:6.1f} dB  {bands(cl)}  rms {rms:6.1f} peak {peak:6.1f} dBFS  hf-bg {bgs[0]:6.1f}{info}")
        if detail:
            for c in cl[:40]: print(f"    t {c[0] / fs:7.4f}s ch{c[1]} level {c[2]:6.1f} dB re rms  crest {c[3]:5.1f} dB  {c[4]:6.1f} dBFS")
    tot = sum(r[1] for r in rows)
    print(f"TOTAL clicks {tot} over {len(rows)} files")

if __name__ == '__main__':
    main()

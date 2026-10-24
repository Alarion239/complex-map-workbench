# Runs notes/sound/cdp3/det.py's two detectors (A: 9-11 kHz impulses; B: linear-prediction residual) on the board's
# recordings. A hit within [onset - 3 ms, onset + 40 ms] of a cue's start is that cue's designed attack; a gradual start
# from silence (det.is_onset) is a voice or cue fading in; anything else is counted as a click ("elsewhere").
#   python3 clicks.py rec/*.f32
import sys, os, json, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../cdp3'))
import det
rows = []
for p in sys.argv[1:]:
    x = det.load(p); fs = 48000; mp = p[:-4] + '.json'
    meta = json.load(open(mp)) if os.path.exists(mp) else {'f0': 0, 'onsets': []}
    on = np.array([t * fs - meta['f0'] for t in meta.get('onsets', [])])
    a, _ = det.det_a(x, fs); b = det.det_b(x, fs)
    def cls(h):
        if len(on) and np.any((h['s'] >= on - 0.003 * fs) & (h['s'] <= on + 0.04 * fs)): return 'attack'
        return 'gradual' if h['onset'] else 'elsewhere'
    out = {'file': os.path.basename(p), 'secs': round(len(x) / fs, 1), 'rms_dBFS': round(20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12), 1)}
    for nm, hits in (('A', a), ('B', b)):
        c = {'attack': 0, 'gradual': 0, 'elsewhere': 0}
        for h in hits: c[cls(h)] += 1
        out['det' + nm] = c
        out['det' + nm + '_where'] = [round(h['s'] / fs, 3) for h in hits if cls(h) == 'elsewhere'][:8]
    rows.append(out)
for r in rows: print(json.dumps(r))

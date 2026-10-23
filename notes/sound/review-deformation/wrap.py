import numpy as np, json, sys
p = sys.argv[1]; t_c = float(sys.argv[2]); x = np.fromfile(p + '.f32', dtype=np.float32).reshape(-1, 2).astype(float); m = json.load(open(p + '.json')); fs = m['fs']; f0 = m['f0']
T = lambda now: now - f0 / fs
cm = [c for c in m['log']['cmds'] if abs(T(c['now']) - t_c) < 0.12]
for c in cm[:40]: print(round(T(c['now']), 4), json.dumps(c['c'])[:200])
# envelope and zero-crossing frequency in 5 ms blocks
y = x.sum(axis=1); B = int(0.005 * fs); i0 = int((t_c - 0.06) * fs)
for i in range(i0, i0 + int(0.25 * fs), B):
    seg = y[i:i + B]; r = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-12)
    zc = np.sum(np.abs(np.diff(np.sign(seg))) > 0) / 2 / (B / fs)
    print(f'{i / fs:6.3f} {r:6.1f} dB zc~{zc:6.0f} Hz  peak {np.abs(seg).max():.4f}')

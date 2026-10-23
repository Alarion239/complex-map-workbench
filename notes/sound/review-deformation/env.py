import numpy as np, json, sys
p = sys.argv[1]; x = np.fromfile(p + '.f32', dtype=np.float32).reshape(-1, 2); m = json.load(open(p + '.json')); fs = m['fs']; f0 = m['f0']
acts = [(a['a'], a['now'] - f0 / fs) for a in m['log']['acts']]
print('acts', [(a, round(t, 3)) for a, t in acts])
w = int(0.05 * fs)
for i in range(0, len(x) - w, w):
    r = 20 * np.log10(np.sqrt((x[i:i + w] ** 2).mean()) + 1e-12)
    print(f'{i / fs:5.2f} {r:6.1f}', end=' |' if (i // w) % 6 != 5 else '\n')
print()

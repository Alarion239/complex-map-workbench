# line.py x0 y0 x1 y1 rest.png other.png... : the r3 gate's measure (brightest line per column, fitted on rest, max deviation)
import sys
import numpy as np
from PIL import Image
x0, y0, x1, y1 = map(int, sys.argv[1:5])
def lum(f):
    a = np.asarray(Image.open(f).convert('RGB')).astype(float)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def line(L, ref=None, thr=6):
    pts = []; miss = 0
    for x in range(x0, x1 + 1):
        col = L[y0:y1 + 1, x]; med = np.median(col)
        ys = list(range(len(col)))
        if ref is not None:
            yr = ref[0] * x + ref[1] - y0; ys = [i for i in ys if abs(i - yr) <= 4]
        if not ys: miss += 1; continue
        b = max(ys, key=lambda i: col[i])
        if col[b] - med < thr: miss += 1; continue
        sw = sy = 0
        for i in range(max(0, b - 2), min(len(col) - 1, b + 2) + 1):
            w = max(col[i] - med, 0); sw += w; sy += i * w
        pts.append((x, y0 + sy / sw))
    if len(pts) < 5: return None, len(pts), miss
    P = np.array(pts); a, c = np.polyfit(P[:, 0], P[:, 1], 1)
    if ref is None:
        for _ in range(4):
            k = P[np.abs(P[:, 1] - (a * P[:, 0] + c)) <= 1.5]
            if len(k) < 5: break
            a, c = np.polyfit(k[:, 0], k[:, 1], 1)
    dev = np.abs(P[:, 1] - (a * P[:, 0] + c)).max()
    return (a, c), round(float(dev), 2), round(100 * miss / (x1 - x0 + 1), 1)
r, dev, gap = line(lum(sys.argv[5]))
print(sys.argv[5].split('/')[-1], 'rest dev', dev, 'gap%', gap)
for f in sys.argv[6:]:
    _, d, g = line(lum(f), r)
    print(f.split('/')[-1], 'dev', d, 'gap%', g)

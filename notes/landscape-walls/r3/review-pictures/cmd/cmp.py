# cmp.py A.png B.png : pixels differing (RGB distance > 40, > 80), their bounding clusters (32 px tiles with most diffs)
import sys
import numpy as np
from PIL import Image
A = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float)
B = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(float)
# ignore the bottom bar / transport (label) and top title
H, W = A.shape[:2]
m = np.zeros((H, W), bool); m[40:H - 100, :] = True
d = np.sqrt(((A - B) ** 2).sum(2)) * m
n40, n80 = int((d > 40).sum()), int((d > 80).sum())
T = 32; tiles = []
for y in range(0, H, T):
    for x in range(0, W, T):
        c = int((d[y:y + T, x:x + T] > 40).sum())
        if c: tiles.append((c, x, y))
tiles.sort(reverse=True)
print(sys.argv[2].split('/')[-1], 'n40', n40, 'n80', n80, 'top tiles', tiles[:5])

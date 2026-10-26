import sys, glob
from PIL import Image
groups = sys.argv[2:]
cols = []
for g in groups:
    fs = sorted(glob.glob(g + '-play*.png'), key=lambda f: int(f.split('play')[1][:-4]))
    ims = [Image.open(f) for f in fs]
    W, H = ims[0].size
    # transport label: right part of the bottom bar
    box = (540, 620, 650, 642) if W > 500 else None
    if box is None:
        # phone: find the row with 't =' near the bottom; take the bottom 30 px middle
        box = (int(W*0.45), H-30, int(W*0.85), H-6)
    cols.append([im.crop(box) for im in ims])
w = max(c[0].width for c in cols); h = max(c[0].height for c in cols)
n = max(len(c) for c in cols)
out = Image.new('RGB', (w * len(cols), h * n), 'white')
for j, c in enumerate(cols):
    for i, im in enumerate(c): out.paste(im, (j * w, i * h))
out = out.resize((out.width * 2, out.height * 2)); out.save(sys.argv[1])

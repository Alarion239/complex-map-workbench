# grid.py out.png scale cols x0 y0 x1 y1 img1 [img2 ...] : crop box from each image, scale, tile in cols, label
import sys
from PIL import Image, ImageDraw
out, sc, cols, x0, y0, x1, y1 = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), *map(int, sys.argv[4:8])
fs = sys.argv[8:]
ims = []
for f in fs:
    im = Image.open(f).convert('RGB').crop((x0, y0, x1, y1))
    im = im.resize((int(im.width * sc), int(im.height * sc)), Image.NEAREST)
    d = ImageDraw.Draw(im); lab = f.split('/')[-1].replace('.png', '')
    d.rectangle((0, 0, 7 * len(lab), 13), fill=(0, 0, 0)); d.text((2, 1), lab, fill=(255, 255, 0))
    ims.append(im)
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
c = Image.new('RGB', (w * cols + 4 * (cols - 1), h * rows + 4 * (rows - 1)), (255, 0, 255))
for i, im in enumerate(ims): c.paste(im, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
c.save(out); print(c.size)

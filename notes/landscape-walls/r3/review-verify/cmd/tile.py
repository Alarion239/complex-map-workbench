# tile.py out.png x0 y0 x1 y1 scale cols f1 f2 ... : crop each, upscale, label, grid
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]; x0, y0, x1, y1 = map(int, sys.argv[2:6]); sc = float(sys.argv[6]); cols = int(sys.argv[7]); fs = sys.argv[8:]
w, h = int((x1 - x0) * sc), int((y1 - y0) * sc)
rows = (len(fs) + cols - 1) // cols
G = Image.new('RGB', (cols * (w + 4), rows * (h + 4)), (255, 0, 255))
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').crop((x0, y0, x1, y1)).resize((w, h), Image.NEAREST)
    d = ImageDraw.Draw(im); lab = f.split('/')[-1].replace('.png', ''); d.rectangle((0, 0, 7 * len(lab), 12), fill=(0, 0, 0)); d.text((2, 0), lab, fill=(255, 255, 0))
    G.paste(im, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
G.save(out)

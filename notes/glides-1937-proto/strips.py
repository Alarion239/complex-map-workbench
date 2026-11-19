# strips.py DIR TAG [cases...]: PNG strips and metrics from the probe's raw frames
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
D, TAG = sys.argv[1], sys.argv[2]
CASES = sys.argv[3:] or ['z2','cubic','jouk','exp','tan','negpow','mob','zeta','gamma']
def load(case, name):
    js = json.load(open(f'{D}/{TAG}-{case}.json'))
    w, h = js.get('size') or [900, 600]
    p = f'{D}/{TAG}-{case}-{name}.rgba'
    if not os.path.exists(p): return None
    a = np.frombuffer(open(p,'rb').read(), np.uint8)
    return a.reshape(-1, w, 4)[:, :, :3].astype(np.int16) if a.size == w*h*4 else None
def diff(a, b):
    if a is None or b is None: return None
    d = np.abs(a - b).max(axis=2)
    return {'frac32': round(float((d > 32).mean()), 4), 'p99': int(np.percentile(d, 99)), 'mean': round(float(d.mean()), 2)}
out = {}
for c in CASES:
    if not os.path.exists(f'{D}/{TAG}-{c}.json'): continue
    js = json.load(open(f'{D}/{TAG}-{c}.json'))
    names = ['rest0', 'x0.001', 'x0.25', 'x0.5', 'x0.75', 'x0.999', 'rest1']
    ims = [load(c, n) for n in names]
    m = {'departure': diff(ims[0], ims[1]), 'arrival_pop': diff(ims[5], ims[6]), 'peak_step': diff(load(c, 'x0.5'), load(c, 'x0.5556')),
         'restMs': [js.get('restMs0'), js.get('restMs1')], 'ms': {x: f.get('ms') for x, f in js.get('frames', {}).items()},
         'path': {x: (f.get('glide') or {}).get('path') for x, f in js.get('frames', {}).items()},
         'judge_over': {x: (f.get('judge') or {}).get('over') if isinstance(f.get('judge'), dict) else None for x, f in js.get('frames', {}).items()},
         'error': js.get('error')}
    out[c] = m
    tiles = [i for i in ims if i is not None]
    if tiles:
        th = 160; sc = th / tiles[0].shape[0]; tw = int(tiles[0].shape[1] * sc)
        S = Image.new('RGB', (len(names) * (tw + 4), th + 18), 'white'); dr = ImageDraw.Draw(S)
        for k, n in enumerate(names):
            if ims[k] is None: continue
            S.paste(Image.fromarray(ims[k].astype(np.uint8)).resize((tw, th), Image.LANCZOS), (k * (tw + 4), 18))
            dr.text((k * (tw + 4) + 3, 3), n.replace('x', 'u='), fill='black')
        S.save(f'{D}/{TAG}-{c}-strip.png')
print(json.dumps(out, indent=1))

#!/usr/bin/env python3
# usage: snap.py CASE_TAG_PREFIX U[,U...] [top|iso] R0 R1 C0 C1 SCALE OUTPREFIX
import sys, subprocess, re, base64, os
tag, us, cam, R0, R1, C0, C1, S, out = sys.argv[1:10]
p = 'test/lib/land_exact.js'
orig = open(p).read()
dbg = """  { const c = CASES.find((x) => x.tag.startsWith(%s)); await load(c, false); await park(0, 'P0'); await park(1, 'P1');
    const cam0 = await ev("__cmwCam('L')");
    if (%s) await ev('__cmwLandMeshOnly(true); 1');
    const imgs = [];
    const take = async (name) => { await grab('snap');
      const len = await ev(`(() => { const x = window.__heldPx.snap, W = document.getElementById('canvasL').width; const R0 = %s, R1 = %s, C0 = %s, C1 = %s, w = C1 - C0, h = R1 - R0, S = %s; const cv = document.createElement('canvas'); cv.width = w * S; cv.height = h * S; const g = cv.getContext('2d'); const id = g.createImageData(w * S, h * S); for (let r = 0; r < h * S; r++) for (let c = 0; c < w * S; c++) { const i = 4 * ((R0 + Math.floor(r / S)) * W + C0 + Math.floor(c / S)), o = 4 * (r * w * S + c); id.data[o] = x[i]; id.data[o+1] = x[i+1]; id.data[o+2] = x[i+2]; id.data[o+3] = 255; } g.putImageData(id, 0, 0); window.__img = cv.toDataURL('image/jpeg', 0.85).split(',')[1]; return window.__img.length; })()`);
      const parts = []; for (let o = 0; o < len; o += 8000) parts.push(await ev(`window.__img.slice(${o}, ${o + 8000})`));
      imgs.push(name + ':' + parts.join('')); };
    if ('%s' === 'top') await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`);
    for (const u of [%s]) { if (u === 'P0' || u === 'P1') { await park(u === 'P0' ? 0 : 1, 'Px'); await take(u); } else { await park(0, 'P0x'); await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await setU(u); await take('u' + u); } }
    const all = imgs.join('|'); for (let o = 0; o < all.length; o += 40000) ok('IMGPART' + String(o / 40000).padStart(3, '0') + '~' + all.slice(o, o + 40000) + '~', false, 0); return { pass: false, fails, info: [] }; }
  for (const c of CASES) for (const sheets of MODES) {""" % (repr(tag), 'true' if os.environ.get('MESH') else 'false', R0, R1, C0, C1, S, cam, ','.join(repr(u) if u in ('P0','P1') else u for u in us.split(',')))
a = "  for (const c of CASES) for (const sheets of MODES) {"
assert a in orig
open(p, 'w').write(orig.replace(a, dbg, 1))
try:
    r = subprocess.run(['node', 'ci/browser.js', '--no-build', '--only', 'steps_land_exact_cmd'], capture_output=True, text=True, timeout=600)
    txt = r.stdout + r.stderr
finally:
    open(p, 'w').write(orig)
open('/tmp/snap_last.log','w').write(txt)
parts = sorted(set(re.findall(r'IMGPART(\d{3})~([A-Za-z0-9+/=:|_.\-]*)~', txt)))
if not parts: print('no image data'); sys.exit(1)
data = ''.join(b for _, b in parts)
for item in data.split('|'):
    name, b64 = item.split(':', 1)
    b64 = re.sub(r'[^A-Za-z0-9+/=]', '', b64)
    open('%s_%s.jpg' % (out, name), 'wb').write(base64.b64decode(b64))
    print('wrote %s_%s.jpg' % (out, name))

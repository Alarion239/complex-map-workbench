import subprocess,re,sys
tag,uu=sys.argv[1],sys.argv[2]
p='test/lib/land_exact.js'
orig=open(p).read()
a="  for (const c of CASES) for (const sheets of MODES) {"
s=orig.replace(a,"  for (const c of CASES.filter((x) => x.tag.startsWith(%r))) for (const sheets of MODES) {"%tag,1)
b="      r[u].raster = rk;\n"
inj=b+"""      if (u === %s) { const m = await ev(`(() => { const M = window.__lxMasks, W = M.W2, H = M.H2, sl = 1; const near = (m, x, y) => { for (let dy = -sl; dy <= sl; dy++) for (let dx = -sl; dx <= sl; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && m[Y * W + X]) return true; } return false; }; const cl = {}; let n = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M.frame[y * W + x] && !near(M.ref, x, y)) { n++; const k = (Math.floor(x / 12) * 12) + ',' + (Math.floor(y / 12) * 12); cl[k] = (cl[k] || 0) + 1; } return JSON.stringify({ W, H, n, cl: Object.entries(cl).sort((a, b) => b[1] - a[1]).slice(0, 14) }); })()`); ok('DBGM~' + m + '~', false, 0); }
"""%uu
assert b in s
s=s.replace(b,inj,1)
open(p,'w').write(s)
try:
    r=subprocess.run(['node','ci/browser.js','--no-build','--only','steps_land_exact_cmd'],capture_output=True,text=True,timeout=900); txt=r.stdout+r.stderr
finally: open(p,'w').write(orig)
m=re.findall(r'DBGM~(.*?)~',txt,re.S)
print(m[0] if m else txt[-500:])

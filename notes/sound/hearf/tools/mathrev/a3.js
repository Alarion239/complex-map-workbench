const H = process.argv[2] || require("path").resolve(__dirname, "../..");
const C = require(H + '/proto/core.js');
const CSS = 386;
const db = (x) => (20 * Math.log10(x + 1e-12)).toFixed(1);
function top(A, n = 4) { const idx = A.map((v, i) => [v, i + 1]).sort((a, b) => b[0] - a[0]).slice(0, n); const m = idx[0][0]; let e = 0; for (const v of A) e += v * v; return idx.map(([v, h]) => `h${h}:${db(v / m)}`).join(' ') + ` (top share ${Math.round(100 * m * m / e)}%)`; }
// 4. hear the view
for (const fn of C.FUNCS) {
  const g = C.gesture(fn, 'view'); const ppu = CSS / (2 * fn.view[2]);
  const ss = new C.Session({ eng() {}, voice() {}, drone() {} }, 'curve', {}); ss.start(0, fn, g);
  const rows = [];
  for (let u = 0; u <= g.dur + 1e-9; u += 0.25) { const p = g.at(u); ss.frame(u, p, ppu); const sp = C.curveSpectrum(fn, null, C.circlePts([p.x, p.y, p.r], 128), 256); if (!sp) continue; const A = C.toAmps(sp.b, -8, 20, { centre: sp.ok ? sp.W : 0 }); rows.push(`r=${p.r.toFixed(2)} W=${sp.ok ? sp.W : '?'} ${top(A, 3)}`); }
  console.log('VIEW', fn.id, '\n  ' + rows.join('\n  '));
}

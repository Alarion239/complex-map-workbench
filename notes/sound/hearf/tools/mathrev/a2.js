const H = process.argv[2] || require("path").resolve(__dirname, "../..");
const C = require(H + '/proto/core.js');
const CSS = 386;
const db = (x) => (20 * Math.log10(x + 1e-12)).toFixed(1);
function top(A, n = 4) { const idx = A.map((v, i) => [v, i + 1]).sort((a, b) => b[0] - a[0]).slice(0, n); const m = idx[0][0]; return idx.map(([v, h]) => `h${h}:${db(v / m)}`).join(' '); }
function ringA(fn, t, x, y, r) { const sp = C.ringSpectrum(fn, t, x, y, r); return C.toAmps(sp.c, -sp.M / 2, sp.M / 2 - 1, {}); }
// 2. ring on the zero loop vs pole loop, every function
for (const fn of C.FUNCS) for (const k of ['zero', 'pole', 'dzero']) {
  const g = C.gesture(fn, k); if (!g) continue; const ppu = CSS / (2 * fn.view[2]); const p = g.at(0.5);
  console.log('ring', fn.id, k, 'centre', g.centre, top(ringA(fn, null, p.x, p.y, 20 / ppu)));
}
// 3. curve option: live stroke W timeline on loop gestures
for (const fn of C.FUNCS) for (const k of ['zero', 'pole', 'dzero']) {
  const g = C.gesture(fn, k); if (!g) continue; const ppu = CSS / (2 * fn.view[2]);
  const ss = new C.Session({ eng() {}, voice() {}, drone() {} }, 'curve', {}); ss.start(0, fn, g);
  let lastW = 'x', log = [];
  for (let u = 0; u <= g.dur + 1e-9; u += 1 / 60) { ss.frame(u, g.at(u), ppu); const W = ss.ctl.W; const s = ss.ctl.info.split('·')[0].trim(); if (String(W) !== String(lastW)) { log.push(`lap ${(u / 2).toFixed(2)}: W=${W}`); lastW = W; } }
  console.log('curve', fn.id, k, log.join(' | '));
}

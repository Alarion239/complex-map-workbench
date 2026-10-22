// trace summary: node tr.js '<formula>' [x0 x1 y0 y1] [exact:false]
const { Curves, W } = require('./load.js');
const [s, x0 = -2, x1 = 2, y0 = -2, y1 = 2, ex] = process.argv.slice(2);
const win = W(+x0, +x1, +y0, +y1);
const t0 = Date.now();
const d = Curves.fromFormula(s, ex === 'noexact' ? { exact: false } : {});
const t = Curves.trace(d, win);
const ms = Date.now() - t0;
const inW = (x, y) => x >= win.x0 && x <= win.x1 && y >= win.y0 && y <= win.y1;
console.log(s, 'exact=' + d.exact, 'notes=' + JSON.stringify(d.notes), 'polys=' + t.polys.length, 'points=' + t.points.length, ms + 'ms', 'evals=' + d.pieces.map((p) => p.g.n));
for (const p of t.polys) {
  const n = p.pts.length / 2, a = p.pts;
  let k = 0; for (let i = 0; i < n; i++) if (inW(a[2 * i], a[2 * i + 1])) k++;
  const f = (i) => `(${a[2 * i].toPrecision(6)}, ${a[2 * i + 1].toPrecision(6)})`;
  console.log(`  n=${n} inWin=${k} closed=${p.closed} ends=${JSON.stringify(p.ends)} ${f(0)} -> ${f(n - 1)} ${p.exact ? p.shape.kind : ''}`);
}

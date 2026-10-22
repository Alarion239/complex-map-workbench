const { Curves, W } = require('./load.js');
const win = W(-2, 2, -2, 2);
for (const [s, ex] of [['|z - 10| = 9.5', {}], ['|z - 10| = 9.5', { exact: false }], ['|z - 1000| = 999.5', {}], ['|z| = 1', {}], ['|z - 3| = 2.5', {}]]) {
  const d = Curves.fromFormula(s, ex), t = Curves.trace(d, win);
  console.log(s, JSON.stringify(ex), t.polys.map((p) => { const a = p.pts, n = a.length / 2; return `closed=${p.closed} n=${n} first=(${a[0].toFixed(3)},${a[1].toFixed(3)}) last=(${a[2 * n - 2].toFixed(3)},${a[2 * n - 1].toFixed(3)})`; }).join(' | '), 'isClosed=' + Curves.isClosed(d, win), 'loop areas=' + Curves.loops(d, win).map((l) => l.area.toFixed(4)), 'true area=' + (Math.PI * (s.includes('1000') ? 999.5 : s.includes('10') ? 9.5 : s.includes('3') ? 2.5 : 1) ** 2).toFixed(4));
}

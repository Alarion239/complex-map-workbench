const { Curves, W } = require('./load.js');
const show = (s) => { try { const d = Curves.fromFormula(s); console.log(s.padEnd(44), 'exact=' + JSON.stringify(Curves.shapesOf(d)), 'notes=' + JSON.stringify(d.notes)); return d; } catch (e) { console.log(s, 'THROW', e.message); } };
for (const s of ['Re z = 0, |z - 1000i| < 10', 'Re z = 0, 1000 < Im z < 1001', 'Re z = 0, |z - 100i| < 1', 'Re z = 0, |z - 5i| < 0.01',
  '|z| = 1000, |z - 1000e^{0.1i}| < 1', '|z| = 1, |z - e^{0.1i}| < 0.001', '|z| = 1, Re z > 0.9999999', 'Re z = 0, Im z > 0', 'Re z = 0, |z| < 2']) show(s);
// traced restrictions
const win = W(-2, 2, -2, 2);
for (const s of ['Re z^2 = 1, Im z > 0', '|z^2-1| = 1, Re z > 0', 'Re(z^2) = 0, Re z > 0', '\\operatorname{Re}(z^2) = 0, |z| < 1']) {
  const d = Curves.fromFormula(s), t = Curves.trace(d, win);
  console.log(s, t.polys.map((p) => { const a = p.pts, n = a.length / 2; return `[n=${n} closed=${p.closed} ends=${p.ends} ${a[0].toPrecision(17)},${a[1].toPrecision(17)} -> ${a[2 * n - 2].toPrecision(17)},${a[2 * n - 1].toPrecision(17)}]`; }).join('\n   '));
}

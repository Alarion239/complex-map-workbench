const { Curves, W } = require('./load.js');
const win = W(-2, 2, -2, 2);
// 1. tangent circles: per-factor distance of every sample (my exact-sign check flagged samples at the tangency 2)
{
  const t = Curves.trace(Curves.fromFormula('(|z|-2)(|z-1|-1) = 0'), win);
  let w = 0; for (const p of t.polys) for (let i = 0; i < p.pts.length; i += 2) { const x = p.pts[i], y = p.pts[i + 1]; w = Math.max(w, Math.min(Math.abs(Math.hypot(x, y) - 2), Math.abs(Math.hypot(x - 1, y) - 1)) / Math.max(1e-9 * Math.hypot(x, y), 1e-12)); }
  console.log('tangent circles worst dist/tol', w.toExponential(2));
}
// 2. concentric circles 0.001 apart, several windows
for (const [s, f] of [['(|z|-1)(|z|-1.001) = 0', (x, y) => Math.min(Math.abs(Math.hypot(x, y) - 1), Math.abs(Math.hypot(x, y) - 1.001))], ['(|z|-1)(|z-0.001|-1) = 0', (x, y) => Math.min(Math.abs(Math.hypot(x, y) - 1), Math.abs(Math.hypot(x - 0.001, y) - 1))], ['(|z|-1)(|z|-1.01) = 0', (x, y) => Math.min(Math.abs(Math.hypot(x, y) - 1), Math.abs(Math.hypot(x, y) - 1.01))]]) {
  for (const wn of [W(-2, 2, -2, 2), W(-1.5, 1.5, -1.5, 1.5), W(-4, 4, -3, 3)]) {
    const t = Curves.trace(Curves.fromFormula(s), wn);
    let L = 0, w = 0; for (const p of t.polys) for (let i = 2; i < p.pts.length; i += 2) { L += Math.hypot(p.pts[i] - p.pts[i - 2], p.pts[i + 1] - p.pts[i - 1]); w = Math.max(w, f(p.pts[i], p.pts[i + 1])); }
    console.log(s, JSON.stringify(wn), 'polys', t.polys.map((p) => (p.closed ? 'C' : 'O') + p.pts.length / 2).join(' '), 'total length', L.toFixed(3), '(true ' + (2 * Math.PI * (s.includes('1.01') ? 2.01 : s.includes('1.001') ? 2.001 : 2)).toFixed(3) + ')', 'worst sample dist', w.toExponential(1));
  }
}
// 3. curvesOf ignores the trace options
{
  const d = Curves.fromFormula('Re z^2 = 1');
  const a = Curves.sample(d, win, { res: 50 }), b = Curves.curvesOf(d, win, { res: 50 });
  console.log('sample(res 50) keys', [...d.cache.keys()]);
}
// 4. exact shapes: ends of clipped shapes
{
  const t = Curves.trace(Curves.fromFormula('Re z = 0, Im z > 0'), win), t2 = Curves.trace(Curves.fromFormula('Re z = 0, |z| < 1'), win), t3 = Curves.trace(Curves.fromFormula('|z| = 1, Re z > 0'), win);
  console.log('exact clipped ends', JSON.stringify(t.polys.map((p) => p.ends)), JSON.stringify(t2.polys.map((p) => p.ends)), JSON.stringify(t3.polys.map((p) => p.ends)), 'first pt of ray', t.polys[0].pts[0], t.polys[0].pts[1]);
  const t4 = Curves.trace(Curves.fromFormula('Re z^3 = 1, Im z > 0'), win);
  console.log('traced clipped ends', JSON.stringify(t4.polys.map((p) => p.ends)));
}

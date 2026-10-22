// rigorous accuracy + coverage of traced polynomial curves (exact BigInt signs)
// node acc.js [filter]
const { Curves, W } = require('./load.js');
const E = require('./exact.js');
// polynomial algebra over integer BigInt coefficients: Map 'i,j' -> BigInt
const T = (terms) => { const m = new Map(); for (const [c, i, j] of terms) m.set(i + ',' + j, (m.get(i + ',' + j) || 0n) + BigInt(c)); return m; };
const mul = (a, b) => { const m = new Map(); for (const [ka, ca] of a) for (const [kb, cb] of b) { const [i1, j1] = ka.split(',').map(Number), [i2, j2] = kb.split(',').map(Number), k = (i1 + i2) + ',' + (j1 + j2); m.set(k, (m.get(k) || 0n) + ca * cb); } return m; };
const arr = (m) => [...m].filter(([, c]) => c !== 0n).map(([k, c]) => { const [i, j] = k.split(',').map(Number); return [c, i, j]; });
const circ = (cx, cy, r2num, den = 1) => T([[den, 2, 0], [-2 * cx * den, 1, 0], [den, 0, 2], [-2 * cy * den, 0, 1], [(cx * cx + cy * cy) * den - r2num, 0, 0]]); // den((x-cx)^2+(y-cy)^2) - r2num
const CASES = [
  { f: 'y = x^2', p: T([[1, 0, 1], [-1, 2, 0]]) },
  { f: '|z-1|+|z+1| = 4', p: T([[3, 2, 0], [4, 0, 2], [-12, 0, 0]]) },
  { f: '|z^2-1| = 1', p: T([[1, 4, 0], [2, 2, 2], [1, 0, 4], [-2, 2, 0], [2, 0, 2]]) },
  { f: '|z^2-1| = 1.2', p: T([[25, 4, 0], [50, 2, 2], [25, 0, 4], [-50, 2, 0], [50, 0, 2], [-11, 0, 0]]) },
  { f: '|z^2-1| = 0.8', p: T([[25, 4, 0], [50, 2, 2], [25, 0, 4], [-50, 2, 0], [50, 0, 2], [9, 0, 0]]) },
  { f: '|z^2-1| = 0.1', p: T([[100, 4, 0], [200, 2, 2], [100, 0, 4], [-200, 2, 0], [200, 0, 2], [99, 0, 0]]) },
  { f: '(\\operatorname{Im} z)^2 = (\\operatorname{Re} z)^3', p: T([[1, 0, 2], [-1, 3, 0]]) },
  { f: '(\\operatorname{Im} z)^2 = (\\operatorname{Re} z)^2(\\operatorname{Re} z + 1)', p: T([[1, 0, 2], [-1, 3, 0], [-1, 2, 0]]) },
  { f: '(\\operatorname{Re} z)^3 + (\\operatorname{Im} z)^3 = 3\\operatorname{Re} z\\operatorname{Im} z', p: T([[1, 3, 0], [1, 0, 3], [-3, 1, 1]]) },
  { f: '\\operatorname{Re}(z^3) = 1', p: T([[1, 3, 0], [-3, 1, 2], [-1, 0, 0]]) },
  { f: '\\operatorname{Im}(z^3) = 0', p: T([[3, 2, 1], [-1, 0, 3]]) },
  { f: '\\operatorname{Re}(z^4) = 0', p: T([[1, 4, 0], [-6, 2, 2], [1, 0, 4]]) },
  { f: '\\operatorname{Re}(z^2) = 0', p: T([[1, 2, 0], [-1, 0, 2]]) },
  { f: '(|z|-1)(\\operatorname{Re} z-1) = 0', p: mul(circ(0, 0, 1), T([[1, 1, 0], [-1, 0, 0]])) },
  { f: '(|z-1|-1)(|z+1|-1) = 0', p: mul(circ(1, 0, 1), circ(-1, 0, 1)) },
  { f: '(|z|-2)(|z-1|-1) = 0', p: mul(circ(0, 0, 4), circ(1, 0, 1)) },
  { f: '(|z-3|-2.5)(|z-3|-2.51) = 0', p: mul(circ(3, 0, 25, 4), circ(3, 0, 63001, 10000)), noexact: true },
  { f: '(|z|-1)(|z-0.001|-1) = 0', p: mul(circ(0, 0, 1), T([[1000000, 2, 0], [-2000, 1, 0], [1000000, 0, 2], [1 - 1000000, 0, 0]])) },
  { f: '((\\operatorname{Re} z)^2+(\\operatorname{Im} z)^2)^2 = (\\operatorname{Re} z)^2-(\\operatorname{Im} z)^2', p: T([[1, 4, 0], [2, 2, 2], [1, 0, 4], [-1, 2, 0], [1, 0, 2]]) },
  { f: '(\\operatorname{Im} z)^2 = (\\operatorname{Re} z)^2 (1 - (\\operatorname{Re} z)^2)', p: T([[1, 0, 2], [-1, 2, 0], [1, 4, 0]]) }, // figure-eight lemniscate of Gerono
  { f: '(\\operatorname{Re} z)^2 (\\operatorname{Im} z) = (\\operatorname{Im} z)^3 + 0.0001', p: T([[10000, 2, 1], [-10000, 0, 3], [-1, 0, 0]]) }, // near-X
  { f: '\\operatorname{Re} z = 0', p: T([[1, 1, 0]]), noexact: true },
  { f: '|z - 3| = 2.5', p: circ(3, 0, 25, 4), noexact: true },
  { f: '(\\operatorname{Re} z)^4 + (\\operatorname{Im} z)^4 = 1', p: T([[1, 4, 0], [1, 0, 4], [-1, 0, 0]]) },
  { f: '\\operatorname{Im} z\\,((\\operatorname{Re} z)^2 + (\\operatorname{Im} z)^2 - 1) = 0', p: mul(T([[1, 0, 1]]), circ(0, 0, 1)) },
];
const WINS = [W(-2, 2, -2, 2), W(-0.37, 0.41, -0.29, 0.33), W(-7.3, 9.1, -5.2, 6.4), W(0.999, 1.001, -0.001, 0.001)];
const filt = process.argv[2];
for (const cs of CASES) {
  if (filt && !cs.f.includes(filt)) continue;
  const poly = arr(cs.p);
  const d = Curves.fromFormula(cs.f, cs.noexact ? { exact: false } : {});
  for (const win of WINS) {
    const t0 = Date.now();
    const tr = Curves.trace(d, win);
    const ms = Date.now() - t0;
    const diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    // (a) every sample within rho of the curve (rigorous)
    let bad = 0, n = 0, worst = null;
    for (const p of tr.polys) {
      const a = p.pts;
      for (let q = 0; q < a.length; q += 2) {
        const x = a[q], y = a[q + 1], rho = Math.max(1e-9 * Math.hypot(x, y), 1e-12);
        n++;
        if (!E.zeroWithin(poly, x, y, rho, 8) && !E.zeroWithin(poly, x, y, rho, 96)) { bad++; if (!worst) { let r = rho; while (r < 1 && !E.zeroWithin(poly, x, y, r, 96)) r *= 4; worst = { x, y, rho, within: r }; } }
      }
    }
    // (b) coverage: roots of the polynomial on a 600 x 600 scan of the window (bisected), distance to the polylines
    const N = 600, hx = (win.x1 - win.x0) / N, hy = (win.y1 - win.y0) / N;
    const idx = E.segIndex(tr.polys, diag / 200);
    const sgn = [];
    for (let j = 0; j <= N; j++) { const row = []; for (let i = 0; i <= N; i++) row.push(E.signPoly(poly, win.x0 + 0.137 * hx + i * hx, win.y0 + 0.291 * hy + j * hy)); sgn.push(row); }
    let maxMiss = 0, missAt = null, nref = 0;
    const X = (i) => win.x0 + 0.137 * hx + i * hx, Y = (j) => win.y0 + 0.291 * hy + j * hy;
    const bis = (ax, ay, bx, by, sa) => { for (let k = 0; k < 60; k++) { const mx = (ax + bx) / 2, my = (ay + by) / 2; const s = E.signPoly(poly, mx, my); if (s === 0) return [mx, my]; if (s === sa) { ax = mx; ay = my; } else { bx = mx; by = my; } } return [(ax + bx) / 2, (ay + by) / 2]; };
    for (let j = 0; j < N; j += 1) for (let i = 0; i < N; i += 1) {
      for (const [i2, j2] of [[i + 1, j], [i, j + 1]]) {
        const s1 = sgn[j][i], s2 = sgn[j2][i2];
        if (s1 === s2 || s1 === 0 || s2 === 0) continue;
        if ((i + j) % 3) continue; // a third of the edges are enough
        nref++;
        const [rx, ry] = bis(X(i), Y(j), X(i2), Y(j2), s1);
        const dd = idx(rx, ry, diag / 20);
        if (dd > maxMiss) { maxMiss = dd; missAt = [rx, ry]; }
      }
    }
    const status = (bad ? 'ACC-FAIL ' : '') + (maxMiss > 1e-4 * diag ? 'COVERAGE ' : '');
    console.log(`${status || 'ok '} ${cs.f} win=[${win.x0},${win.x1}]x[${win.y0},${win.y1}] polys=${tr.polys.length} closed=${tr.polys.map((p) => (p.closed ? 'C' : 'O' + JSON.stringify(p.ends))).join(' ')} samples=${n} bad=${bad}${worst ? ' first ' + JSON.stringify(worst) : ''} refs=${nref} maxMiss/diag=${(maxMiss / diag).toExponential(2)}${missAt ? ' at ' + missAt.map((v) => v.toPrecision(6)) : ''} ${ms}ms`);
  }
}

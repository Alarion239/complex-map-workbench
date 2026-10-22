'use strict';
// Precision of the SIN/COS/SINH/COSH family bases (CX.asin etc.) used by the op table, vs the app's own forward.
const L = require('./lib.js');
const { Inverse, C, chain } = L;
for (const type of ['sin', 'cos', 'sinh', 'cosh', 'tan', 'tanh']) {
  const ch = chain([{ type }]);
  const prep = Inverse.prepare(ch.plan, { win: L.WIN0, shape: { kind: 'halfplane', a: [0, -1e9], b: [-1, -1e9] } });
  const rows = [];
  for (const mag of [1e2, 1e3, 1e4, 1e5, 1e6, 1e7]) {
    let worst = 0, worstW = null;
    for (let t = 0; t < 64; t++) {
      const th = Math.PI * 2 * t / 64, w = C(mag * Math.cos(th), mag * Math.sin(th));
      const r = Inverse.enumerate(ch.plan, prep, w, 1e-3, { K: 1, full: 2 });
      for (const lf of r.leaves) {
        if (!CX.isFin(lf.z)) continue;
        const e = CX.abs(CX.sub(ch.F(lf.z), w)) / CX.abs(w);
        if (e > worst) { worst = e; worstW = w; }
      }
    }
    rows.push(`|w|=${mag.toExponential(0)}: worst rel |F(z)-w|/|w| = ${worst.toExponential(2)} at w=${L.fmt(worstW)}`);
  }
  console.log(type + '\n  ' + rows.join('\n  '));
}
console.log('CX.asin(-1e9) =', L.fmt(CX.asin(C(-1e9, 0))), ' (true: -1.5707963 + 21.416413i)');
console.log('CX.asin(-1e4) =', L.fmt(CX.asin(C(-1e4, 0))), ' (true: -1.5707963 + 9.9034876i)');

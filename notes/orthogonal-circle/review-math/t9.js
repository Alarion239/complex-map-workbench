const K = require('./load.js');
const Gl = K.pieces({ kind: 'line', a: [0, 0], b: [1, 2] })[0].G;   // y = 2x; reflection (x, y) -> ((-3x + 4y)/5, (4x + 3y)/5)
const refl = ([x, y]) => [+((-3 * x + 4 * y) / 5).toFixed(6), +((4 * x + 3 * y) / 5).toFixed(6)];
let n = 0, und = 0; const res = [];
for (const P of [[-0.1, 0.3], [0.5, 0], [1, 0], [0, 0.5], [0.2, 0.9], [-0.5, 1.5], [1.5, 0.5], [0.7, -0.1]]) {
  const Q = refl(P); const r = K.perpForm(Gl, P, Q); n++;
  if (r.undef) { und++; res.push([P, Q, 'undef ' + r.undef]); continue; }
  const g = K.geomOf(r.G); res.push([P, Q, g.line ? 'line' : 'circle c=(' + g.c.map((v) => v.toPrecision(3)) + ') r=' + g.r.toPrecision(3)]);
}
console.log(res.map((x) => JSON.stringify(x)).join('\n'));

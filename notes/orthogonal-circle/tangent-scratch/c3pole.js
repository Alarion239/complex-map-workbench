// The two tangents at T1 = 1 and T2 = e^(2 pi i t): their meet with the c3 flag (entering rule, index 0) against lines
// by kind ('finite'), as T2 passes the antipode (t = 1/2). Run: node c3pole.js
'use strict';
const K = require(require('path').join(__dirname, 'constr-touch.js'));
const f = (z) => (z == null ? 'none' : K.isInf(z) ? 'inf' : Math.hypot(z[0], z[1]).toExponential(1));
const U = { A: 1, B: [0, 0], C: -1, o: [0, 0] };
const tan = (t) => { const T = [Math.cos(2 * Math.PI * t), Math.sin(2 * Math.PI * t)]; const G = K.touchForm(U, T, K.INF).G; return Object.assign(K.pieces({ id: 'x', kind: 'line', _g: G })[0], {}); };
const a = tan(0), out0 = [], outF = [];
for (const t of [0.4, 0.49, 0.499, 0.501, 0.51, 0.6]) {
  const b = tan(t);
  outF.push(f(K.meets(a, b)[0].z));
  const m = K.meets(Object.assign({}, a, { c3: true }), Object.assign({}, b, { c3: true }));
  out0.push(f((m.find((x) => x.index === 0) || {}).z));
}
console.log('lines by kind, finite: ' + outF.join(', '));
console.log('c3, index 0:          ' + out0.join(', '));

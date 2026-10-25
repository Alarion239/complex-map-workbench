const { chain, X, C } = require('./rangeModel.js');
const ch = chain([{ type: 'exp' }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }, { type: 'pown', params: { n: 2 } }]);
const S = { focus: 0, range: { a: 0, b: 1 } };
for (const t of [0.001, 0.3, 0.5, 0.6, 0.8, 1]) {
  const H = ch.morphState(S, t, false).F;
  const q = 1 - t - t * t;
  const poles = q > 0 ? [C(Math.log(q) / t, 0)] : [C(Math.log(-q) / t, Math.PI / t), C(Math.log(-q) / t, -Math.PI / t)];
  const zr = C(Math.log(1 + t - t * t) / t, 0);
  console.log('t=' + t, 'poles', poles.map((p) => `${p.re.toFixed(3)}${p.im >= 0 ? '+' : ''}${p.im.toFixed(3)}i |H(p+1e-6)|=${X.abs(H(X.add(p, C(1e-6, 0)))).toExponential(1)}`).join(', '), '| zero', zr.re.toFixed(4), '|H|=', X.abs(H(zr)).toExponential(1));
}
console.log('golden t*', (Math.sqrt(5) - 1) / 2);

const { chain, X, C } = require('./rangeModel.js');
const ch = chain([{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'log' }]);
// coefficients of the Mobius map M^t from three values (it is a Mobius map for every t)
function coeffs(Mt) {
  // solve for (a,b,c,d) with M(0)=b/d, M(inf)=a/c, M(1)=(a+b)/(c+d): use cross-ratio form
  const w0 = Mt(C(0, 0)), w1 = Mt(C(1, 0)), wi = Mt(C(1e12, 0));
  return { w0, w1, wi };
}
const inv = (Mt, w, z0) => { let z = z0 || C(0.1, 0.1); for (let i = 0; i < 80; i++) { const h = 1e-7 * (1 + X.abs(z)); const f = X.sub(Mt(z), w); const d = X.scale(X.sub(Mt(X.add(z, C(h, 0))), Mt(X.sub(z, C(h, 0)))), 1 / (2 * h)); const s = X.div(f, d); z = X.sub(z, s); if (X.abs(s) < 1e-15 * (1 + X.abs(z))) break; } return z; };
const fx = (z) => `${z.re.toFixed(4)}${z.im < 0 ? '-' : '+'}${Math.abs(z.im).toFixed(4)}i`;
let zz = C(1, 0), z0 = C(0, 0), zinf = null;
for (const t of [0, 0.125, 0.25, 0.5, 0.75, 0.9, 0.99, 1]) {
  const Mt = ch.homF(1, t);
  zz = inv(Mt, C(1, 0), zz); z0 = inv(Mt, C(0, 0), z0);
  const R = (z) => X.div(C(1, 0), Mt(z));
  zinf = t === 0 ? null : inv(R, C(0, 0), zinf || C(-0.01, -0.01));
  console.log(`t=${t}: zero of H_t (M^t z = 1) at ${fx(zz)} |z|=${X.abs(zz).toFixed(3)}; M^-t(0) = ${fx(z0)}; M^-t(inf) = ${zinf ? fx(zinf) : 'inf'}`);
}
// fixed points and the turn of the path
const p = C((1 + Math.sqrt(3)) / 2, -(1 + Math.sqrt(3)) / 2), q = C((1 - Math.sqrt(3)) / 2, -(1 - Math.sqrt(3)) / 2);
for (const t of [0.3, 0.7]) { const Mt = ch.homF(1, t); console.log('fixed?', t, fx(Mt(p)), fx(Mt(q))); }
console.log('M(p)', fx(ch.stepFn(1)(p)), 'M(q)', fx(ch.stepFn(1)(q)));
// derivative at the fixed point q over t: the multiplier's turn
for (const t of [0.25, 0.5, 1]) { const Mt = ch.homF(1, t), h = 1e-6; const d = X.scale(X.sub(Mt(X.add(q, C(h, 0))), Mt(X.sub(q, C(h, 0)))), 1 / (2 * h)); console.log('multiplier at q, t=' + t, fx(d), 'arg deg', (Math.atan2(d.im, d.re) * 180 / Math.PI).toFixed(2)); }

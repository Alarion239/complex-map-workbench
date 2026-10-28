global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
const b = Funcs.build({ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr: 'z^{1000}-z^{196}+z' }) });
const P = b.props; console.log('props', P.deg, P.degExact, Funcs.PROP_KEYS.filter((k) => P[k]).join(','));
// Newton on f(z)=0 from a start near |z|=1 to find a nonzero root (f(0)=0 too)
const ipow = (z, n) => { let r = C(1, 0), a = z; while (n) { if (n & 1) r = CX.mul(r, a); a = CX.mul(a, a); n >>= 1; } return r; };
const f = (z) => CX.add(CX.sub(ipow(z, 1000), ipow(z, 196)), z);
const df = (z) => CX.add(CX.sub(CX.scale(ipow(z, 999), 1000), CX.scale(ipow(z, 195), 196)), C(1, 0));
let found = null;
for (let t = 0; t < 400 && !found; t++) {
  let z = C(1.002 * Math.cos(t * 0.0157 + 0.01), 1.002 * Math.sin(t * 0.0157 + 0.01));
  for (let i = 0; i < 200; i++) { const s = CX.div(f(z), df(z)); z = CX.sub(z, s); if (!CX.isFin(z)) break; if (CX.abs(s) < 1e-15) break; }
  if (CX.isFin(z) && CX.abs(z) > 0.5 && CX.abs(f(z)) < 1e-10) found = z;
}
console.log(JSON.stringify(found), CX.abs(b.f(found)), CX.abs(b.f(C(0,0))));

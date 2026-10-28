global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
function show(step) {
  const b = Funcs.build(step);
  if (b.error) { console.log(JSON.stringify(step.params), 'ERR', b.error); return; }
  const P = b.props;
  console.log(JSON.stringify(step.params), 'deg', P.deg, 'degExact', P.degExact, Funcs.PROP_KEYS.filter((k) => P[k]).join(','));
}
const cust = (e) => ({ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr: e }) });
for (const e of ['z^{1000}', 'z^{1000}+z', 'z^{201}', 'z^{300}', 'z^{250}', 'z^{200}', 'z^{199}', 'z^{500}+1']) show(cust(e));
const rat = (p, q) => ({ type: 'rational', params: Object.assign(Funcs.defaults('rational'), { p, q }) });
console.log('defaults rational', JSON.stringify(Funcs.defaults('rational')));
show(rat('1, -1', '1, -4, 6, -4, 1'));
show(rat('1, -1', '1, -2, 1'));
show(rat('1, -1', '1, -3, 3, -1'));
// check what Funcs.defaults coefficient format is
const b = Funcs.build(rat('1, -1', '1, -4, 6, -4, 1'));
if (!b.error) {
  console.log('poles', b.poles.map(CX.fmt));
  const z = C(0.3, 0.7);
  console.log('f(z)', CX.fmt(b.f(z)), '1/(z-1)^3', CX.fmt(CX.div(C(1,0), CX.mul(CX.sub(z,C(1,0)), CX.mul(CX.sub(z,C(1,0)), CX.sub(z,C(1,0)))))));
}
console.log('--- aliasing cancellations');
for (const e of ['z^{1000}-z^{196}+z', 'z^{1000}-z^{196}', 'z^{1000}-z^{196}+z^2', 'z^{400}-z^{199}+z']) show(cust(e));
{
  const b = Funcs.build(cust('z^{1000}-z^{196}+z'));
  // non-injectivity witness: two distinct z with same image. f(z)=z+z^196(z^804-1); roots of z^1000-z^196+z-c ...
  // simpler: f(0)=0 and f has 1000 zeros counted with multiplicity; show f(w)=0 for some w != 0 via Newton
  let w = CX.C(1.0, 0.0);
  // derivative
  const df = (z) => CX.add(CX.sub(CX.scale(CX.pow ? CX.pow(z, CX.C(999,0)) : z, 1000), CX.scale(CX.pow ? CX.pow(z, CX.C(195,0)) : z, 196)), CX.C(1,0));
  console.log('f(1)=', CX.fmt(b.f(CX.C(1,0))), 'f(0)=', CX.fmt(b.f(CX.C(0,0))));
}

global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const show = (step) => {
  const b = Funcs.build({ type: step.type, params: Object.assign(Funcs.defaults(step.type), step.params) });
  if (b.error) { console.log('ERR', b.error); return; }
  const P = b.props;
  console.log(JSON.stringify(step.params), Funcs.PROP_KEYS.filter((k) => P[k]).join(','), 'deg', P.deg, P.degExact, 'inv', !!b.inverse, 'hom', !!b.hom, 'f(1)=', CX.fmt(b.f(CX.C(1,0))), 'f(2)=', CX.fmt(b.f(CX.C(2,0))));
};
show({ type: 'custom', params: { expr: '\\frac{z^2}{10^{10}}' } });
show({ type: 'custom', params: { expr: '0.000000000001z+1' } });
show({ type: 'custom', params: { expr: '0.00000001z' } });
show({ type: 'mobius', params: { a: '0.00000001', b: '0', c: '0', d: '0.00000001' } });
show({ type: 'poly', params: { co: '0.000000000001, 1' } });

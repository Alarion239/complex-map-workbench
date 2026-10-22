global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
const cases = ['(z+40000)^2', '(z-100000)^2', 'z^2+1000000000z', '\\left(\\frac{z}{100000}\\right)^2+z', '\\left(\\frac{z}{100000}\\right)^2', '(z+10)^{10}', '(z-1000)^3', 'z^{401}', 'z^2', '(z+100)^2', '(z+1000)^2', '(z+10000)^2'];
for (const e of cases) {
  const b = Funcs.build({ type: 'custom', params: { expr: e, cut: 180 } });
  if (b.error) { console.log(e, 'ERR', b.error); continue; }
  const P = b.props;
  const lit = Funcs.PROP_KEYS.filter((k) => P[k]).join(',');
  console.log(JSON.stringify(e), 'deg', P.deg, 'exact', P.degExact, 'const', P.constant, '| lit:', lit);
}
// non-injectivity check for (z-100000)^2
const b = Funcs.build({ type: 'custom', params: { expr: '(z-100000)^2', cut: 180 } });
console.log('F(100001)=', CX.fmt(b.f(C(100001, 0))), 'F(99999)=', CX.fmt(b.f(C(99999, 0))));
const b2 = Funcs.build({ type: 'custom', params: { expr: 'z^2+1000000000z', cut: 180 } });
console.log('F(0)=', CX.fmt(b2.f(C(0, 0))), 'F(-1e9)=', CX.fmt(b2.f(C(-1e9, 0))));
console.log('PROP_KEYS', Funcs.PROP_KEYS);

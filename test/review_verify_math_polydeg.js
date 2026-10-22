// Verifier scratch: independent check of custom polynomial degree classification.
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
const on = (P) => Funcs.PROP_KEYS.filter((k) => P[k]).join(',') + ` deg=${P.deg}${P.degExact ? '' : '?'}${P.constant ? ' CONST' : ''}`;
const B = (type, params) => Funcs.build({ type, params: Object.assign(Funcs.defaults(type), params) });
for (const e of ['(z-100000)^2', '(z+40000)^2', 'z^2+1000000000z', '\\left(\\frac{z}{100000}\\right)^2+z', '\\left(\\frac{z}{100000}\\right)^2', '(z+10)^{10}', '(z-1000)^3', 'z^{401}', 'z^{201}', 'z^2', '(z-100)^2', '(z-1000)^2', '(z-10000)^2', '(z-30000)^2']) {
  const b = B('custom', { expr: e });
  const cls = Expr.classify(Expr.parse(e));
  console.log(e.padEnd(36), 'cls.deg=', cls.deg, '|', b.error || on(b.props));
}
const b = B('custom', { expr: '(z-100000)^2' });
console.log('F(100001)=', CX.fmt(b.f(C(100001, 0))), 'F(99999)=', CX.fmt(b.f(C(99999, 0))));
const c = B('custom', { expr: '\\left(\\frac{z}{100000}\\right)^2' });
console.log('(z/1e5)^2 F(0)=', CX.fmt(c.f(C(0,0))), 'F(1e5)=', CX.fmt(c.f(C(1e5,0))));
// composeProps for single step
console.log('composed:', on(Funcs.composeProps([b.props])));

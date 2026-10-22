global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const C = CX.C;
for (const s of ['1e-12','1e12','2.5e3','1.0000e-5','-2.0000e-5','1.0000e6','1E5','1.0000e6+3i','1.0000e6 + 2i']) {
  try { const v = Expr.constValue(s); console.log(JSON.stringify(s), '->', CX.fmt(v,6), v.re, v.im); }
  catch (e) { console.log(s, 'ERR', e.message); }
}
// level
const lv = (src, z) => Expr.compileLevel(Expr.parse(src, { allowRel: true }))(z);
console.log('|z|<1e-3 at 0:', lv('|z|<1e-3', C(0,0)));
console.log(CX.fmt(C(1e-5,0),6), '|', CX.fmt(C(1e6,2),6), '|', CX.fmtNum(-2e-5,6), '|', CX.tex(C(1e-7,0)));

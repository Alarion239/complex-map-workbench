global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const C = CX.C;
for (const s of ['\\sin^{-1}(z)', '\\tan^{-1} z', '\\sin^2 z']) {
  const ast = Expr.parse(s); const f = Expr.compile(ast);
  console.log(s, '->', Expr.toTex(ast).s, '| f(0.5)=', CX.fmt(f(C(0.5,0)),6), '| arcsin(0.5)=', CX.fmt(CX.asin(C(0.5,0)),6), '| 1/sin(0.5)=', CX.fmt(CX.inv(CX.sin(C(0.5,0))),6));
}
for (const s of ['|z| < 1e-3', '1e3', '6.02e23', '1E3']) { try { const ast = Expr.parse(s, {allowRel: true}); console.log(s, '->', Expr.toTex(ast).s); } catch (e) { console.log(s, 'ERR', e.message); } }

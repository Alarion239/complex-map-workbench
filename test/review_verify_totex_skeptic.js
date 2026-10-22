global.CX = require('../src/cx.js'); global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js'); const C = CX.C;
const z0 = C(0.7, 0.3);
for (const src of ['\\sin(z)\\cdot z^2', 'sin(z)*z^2', '\\sin(z) z^2', 'sin(z)*z', 'cos(z)*exp(z)', '\\log(z)\\cdot z', 'z^2\\sin(z)']) {
  const ast = Expr.parse(src); const tex = Expr.toTex(ast).s;
  const f = Expr.compile(ast), g = Expr.compile(Expr.parse(tex));
  console.log(JSON.stringify(src), '->', JSON.stringify(tex), 'orig', CX.fmt(f(z0), 4), 'reparsed', CX.fmt(g(z0), 4));
}
console.log('sin(z^3) =', CX.fmt(Expr.compile(Expr.parse('sin(z^3)'))(z0), 4));
const b = Funcs.build({ type: 'ijouk', params: Funcs.defaults('ijouk') });
const z1 = C(-2, 0.3);
console.log('ijouk tex', b.tex({ s: 'z', p: 4 }).s, 'step', CX.fmt(b.f(z1), 4), 'formula', CX.fmt(Expr.compile(Expr.parse(b.tex({s:'z',p:4}).s))(z1), 4));
console.log('|step|', CX.abs(b.f(z1)));
for (const src of ['x*z', 'arg(z)*z', 'exp(z)*z', 'sin(z)*2', 'sin(z)*(z+1)']) {
  const ast = Expr.parse(src); const tex = Expr.toTex(ast).s;
  const f = Expr.compile(ast), g = Expr.compile(Expr.parse(tex));
  console.log(JSON.stringify(src), '->', JSON.stringify(tex), 'orig', CX.fmt(f(z0), 4), 'reparsed', CX.fmt(g(z0), 4));
}

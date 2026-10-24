require('./load.js');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const P = (s) => Expr.parse(s);
const num = (v) => ({ t: 'num', v: CX.C(v, 0) });
for (const [l, t] of [['neg(a)', { t: 'neg', a: P('a') }], ['neg(a+1)', { t: 'neg', a: P('a+1') }], ['2*(-a)+1', { t: 'add', a: { t: 'mul', a: num(2), b: { t: 'neg', a: P('a') } }, b: num(1) }], ['1/a', { t: 'div', a: num(1), b: P('a') }], ['neg(2)', { t: 'neg', a: num(2) }]]) {
  const tex = Expr.toTex(t).s; console.log(l.padEnd(10), '->', tex.padEnd(24), '=', CX.fmtExact(Expr.constValue(tex)), '| names in text:', JSON.stringify((Expr.nameSpans ? Expr.nameSpans(tex) : []).map((x) => x.name)));
}

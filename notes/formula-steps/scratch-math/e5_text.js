// parameter text with shared numbers kept: trees built from the formula's own subtrees, simplified, printed, re-read
require('./load.js');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const P = (s) => Expr.parse(s);
const num = (v) => ({ t: 'num', v: CX.C(v, 0) });
const show = (label, tree) => {
  const s = Expr.simplify(tree), tex = Expr.toTex(s).s;
  let back; try { back = CX.fmtExact(Expr.constValue(tex)); } catch (e) { back = 'ERR ' + e.message; }
  console.log(label.padEnd(44), '->', tex.padEnd(28), '= ', back, '| value', CX.fmtExact(Expr.compile(tree)(CX.C(0, 0))));
};
const za = P('z-a');           // sub(z, a)
show('(z-a)^3: Translate c = -(a)', { t: 'neg', a: za.b });
const two = P('2(z-a)+1');      // add(mul(2, sub(z,a)), 1)
// merged affine 2u+1 after u = z - a: a' = 2, b' = 2*(-a) + 1
show('2(z-a)+1 merged: b = 2(-a)+1', { t: 'add', a: { t: 'mul', a: two.a.a, b: { t: 'neg', a: za.b } }, b: two.b });
show('\\sqrt[a]{z}: alpha = 1/a', { t: 'div', a: num(1), b: P('a') });
show('3^{iz}: c = i Log 3', { t: 'mul', a: P('i'), b: { t: 'call', f: 'log', a: num(3) } });
show('sin z + cos z: c = pi/4', { t: 'div', a: P('\\pi'), b: num(4) });
show('sin z + cos z: c = sqrt 2', { t: 'call', f: 'sqrt', a: num(2) });
show('z/3: c = 1/3', { t: 'div', a: num(1), b: num(3) });
show('(az+1)/(z+a): a', P('a'));
show('\\frac{z-a}{1-az}: c = -a', { t: 'neg', a: P('a') });
show('e^{(a+1) z}: c = a+1', P('a+1'));
console.log('parsed trees:', JSON.stringify(P('2(z-a)+1'), (k, v) => (k === 'pos' || k === 'len' ? undefined : v)));

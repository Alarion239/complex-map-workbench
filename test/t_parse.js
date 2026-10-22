global.CX = require('../src/cx.js');
const Expr = require('../src/parse.js');
const C = CX.C;
const ev = (src, z, opt) => { const f = Expr.compile(Expr.parse(src), opt); return CX.fmt(f(z), 6); };
const z0 = C(0.3, 0.7);
const cases = [
  ['z^2', 'z*z'], ['\\frac{z-i}{z+i}', '(z-i)/(z+i)'], ['e^{z}', 'exp(z)'], ['e^z', 'exp(z)'],
  ['\\sin z', 'sin(z)'], ['\\sin^2 z + \\cos^2 z', '1'], ['\\sin 2z', 'sin(2*z)'], ['\\sin z\\cos z', 'sin(z)*cos(z)'],
  ['\\sqrt{z}', 'z^(1/2)'], ['\\sqrt[3]{z}', 'z^(1/3)'], ['\\overline{z}', 'conj(z)'], ['\\bar z', 'conj(z)'],
  ['|z|^2', 'z*conj(z)'], ['2|z|', '2*abs(z)'], ['||z|-1|', 'abs(abs(z)-1)'], ['\\left|z\\right|', 'abs(z)'],
  ['\\frac12 z', 'z/2'], ['1/2z', 'z/2'], ['\\log z', 'log(z)'], ['\\ln(z)', 'Log(z)'], ['z\\cdot i', 'iz'],
  ['\\exp(iz)', 'e^(i*z)'], ['2^z', 'exp(z*ln(2))'], ['z^{-1}', '1/z'], ['z^-1', '1/z'], ['\\operatorname{Re}(z)', 'x'],
  ['\\mathrm{e}^{\\mathrm{i}z}', 'exp(iz)'], ['\\tan z', 'sin(z)/cos(z)'], ['\\arcsin(\\sin z)', 'z'], ['\\arctan(\\tan z)', 'z'],
  ['\\cosh z', '(e^z+e^-z)/2'], ['\\tanh z', 'sinh(z)/cosh(z)'], ['z**3', 'z^3'], ['\\frac{1}{1-z}', '1/(1-z)'],
  ['\\pi z', '3.14159265358979*z'], ['\\sin(z)^2', 'sin(z)*sin(z)'], ['\\sqrt2', '1.4142135623730951'],
];
let bad = 0;
for (const [a, b] of cases) {
  try {
    const va = ev(a, z0), vb = ev(b, z0);
    if (va !== vb) { bad++; console.log('MISMATCH', a, va, '|', b, vb); }
  } catch (e) { bad++; console.log('ERR', a, b, e.message); }
}
// levels
const lv = (src, z) => Expr.compileLevel(Expr.parse(src, { allowRel: true }))(z);
console.log('level |z|<1 at 0.3+0.7i', lv('|z|<1', z0), 'expect', 1 - CX.abs(z0));
console.log('level 1<|z|<2 at 1.5', lv('1<|z|<2', C(1.5, 0)));
console.log('level 0<\\Im z<\\pi, Re z>0 at 1+i', lv('0<\\Im z<\\pi, \\Re z>0', C(1, 1)));
console.log('level x^2+y^2 \\le 4 or y>3', lv('x^2+y^2 \\le 4 \\lor y>3', C(0, 3.5)));
console.log('level not |z|<1', lv('\\neg (|z|<1)', C(2, 0)));
// classify
for (const s of ['z^2+1', '\\frac{1}{z}', 'e^z', '\\sin z + z^3', '\\sqrt{z}', '\\overline{z}', '(z^2+1)^3', '2^z', '\\frac{z^2}{2}', '\\log(z)', 'z^{1/2}']) {
  const c = Expr.classify(Expr.parse(s));
  console.log(s.padEnd(16), JSON.stringify(c));
}
for (const s of ['\\frac{z-i}{z+i}', 'e^{z}+\\sin^2 z', '-z^2', 'z-(1+z)', '2\\cdot 3z', '\\sqrt[3]{z}', '\\left|z\\right|^2', '(1+i)z']) {
  console.log(s.padEnd(20), Expr.toTex(Expr.parse(s), { s: 'w', p: 4 }).s);
}
// branch cut
console.log('log(-1) principal', ev('\\log z', C(-1, 0)), 'cut at 0 deg:', ev('\\log z', C(-1, 0.0001), { theta: 0 }), ev('\\log z', C(1, -0.0001), { theta: 0 }));
for (const bad1 of ['\\foo z', 'z+', '(z', 'q', '|z']) { try { Expr.parse(bad1); console.log('no error?', bad1); } catch (e) { console.log('err ok:', bad1, '->', e.message); } }
console.log('bad:', bad);

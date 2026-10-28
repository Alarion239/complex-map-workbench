// Reviewer scratch: targeted checks of suspected soundness defects.
global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
const on = (P) => Funcs.PROP_KEYS.filter((k) => P[k]).join(',') + ` deg=${P.deg}${P.degExact ? '' : '?'}${P.constant ? ' CONST' : ''}`;
const B = (type, params) => Funcs.build({ type, params: Object.assign(Funcs.defaults(type), params) });

console.log('--- 1. custom polynomial degree via numericPolyDegree ---');
for (const e of ['(z-100000)^2', 'z^2+1000000000z', 'z+\\frac{z^2}{10^{10}}', '\\frac{z}{10^{10}}', '(z-1000)^3', 'z^{401}', 'z^{250}']) {
  const b = B('custom', { expr: e });
  console.log(e.padEnd(26), b.error || on(b.props));
}
{
  const b = B('custom', { expr: '(z-100000)^2' });
  const z1 = C(100001, 0), z2 = C(99999, 0);
  console.log('  (z-1e5)^2 at 100001 and 99999:', CX.fmt(b.f(z1)), CX.fmt(b.f(z2)), '-> claimed injective:', b.props.injective, 'mobius:', b.props.mobius);
  const b2 = B('custom', { expr: 'z^2+1000000000z' });
  console.log('  z^2+1e9 z at 0 and -1e9:', CX.fmt(b2.f(C(0, 0))), CX.fmt(b2.f(C(-1e9, 0))));
  const b3 = B('custom', { expr: '\\frac{z}{10^{10}}' });
  console.log('  z/1e10 at 0 and 1:', b3.f(C(0, 0)), b3.f(C(1, 0)), 'constant claimed:', b3.props.constant);
}

console.log('--- 2. Möbius degeneracy test is absolute (|det| < 1e-14) ---');
const mob = (a, b, c, d) => { const r = B('mobius', { a, b, c, d }); return r; };
for (const [a, b, c, d] of [['10\\sqrt{2}', '10', '20', '10\\sqrt{2}'], ['100', '0.7', '300', '2.1'], ['1000.1', '3000.3', '2000.2', '6000.6'], ['0.00000001', '0', '0', '0.00000001'], ['1', '0', '0', '0'], ['0', '0', '0', '0']]) {
  const r = mob(a, b, c, d);
  const v = Expr.constValue;
  const det = CX.sub(CX.mul(v(a), v(d)), CX.mul(v(b), v(c)));
  const vals = [C(0.3, 0.2), C(-1, 2), C(5, -1)].map((z) => CX.fmt(r.f(z), 8));
  console.log(`a=${a} b=${b} c=${c} d=${d}`.padEnd(48), 'det', det.re.toExponential(2), '|', on(r.props), '| f:', vals.join('  '), '| domain:', r.domain ? r.domain('z') : 'none');
}

console.log('--- 3. rational coprime test with a multiple root ---');
for (const [p, q] of [['1,-1,0,0,0,0,0', '1,-4,6,-4,1'], ['1,-1,0,0,0,0', '1,-3,3,-1']]) {
  const r = B('rational', { p, q });
  console.log(`p=[${p}] q=[${q}]`, on(r.props));
}

console.log('--- 4. inverse round trips (f(inverse(w)) and inverse(f(z))) ---');
function inv(b) { return Funcs.build({ type: b.inverse.type, params: Object.assign(Funcs.defaults(b.inverse.type), b.inverse.params) }); }
for (const [type, params] of [['mul', { c: '100000' }], ['mul', { c: '0.000001' }], ['add', { c: '200000' }], ['mobius', { a: '1', b: '0.00001', c: '0', d: '1' }], ['affine', { a: '3', b: '0' }], ['powa', { alpha: '1.5', cut: 180, k: 1 }], ['powa', { alpha: '1.5', cut: 90, k: 0 }], ['powa', { alpha: '2.5', cut: 180, k: 0 }]]) {
  const b = B(type, params);
  const ib = inv(b);
  const ws = [C(0.3, 0.4), C(-0.5, 0.6), C(2, -1)];
  const rt = ws.map((w) => CX.fmt(b.f(ib.f(w)), 5));
  console.log(type, JSON.stringify(params).padEnd(40), '-> inverse', ib.def.id, JSON.stringify(b.inverse.params), '| f(inv(w)) for w = .3+.4i, -.5+.6i, 2-i:', rt.join('  '));
}

console.log('--- 5. CX.tex output that does not render / re-parse ---');
for (const c of [C(0, Math.PI), C(1, -Math.PI), C(1e-5, 0), C(2e5, 0)]) {
  const s = CX.tex(c);
  let back;
  try { back = CX.fmt(Expr.constValue(s), 6); } catch (e) { back = 'ParseError: ' + e.message; }
  console.log('value', CX.fmt(c, 8).padEnd(18), 'tex', JSON.stringify(s).padEnd(16), 're-parsed:', back);
}
for (const [type, params] of [['add', { c: 'i\\pi' }], ['mul', { c: '\\pi i' }], ['mul', { c: '0.00001' }]]) {
  const b = B(type, params);
  console.log(type, JSON.stringify(params), 'tex:', b.tex({ s: 'z', p: 4 }).s);
}

console.log('--- 6. Expr.toTex of a custom formula vs evaluation ---');
for (const e of ['\\sin(z)\\cdot z', '\\sin(z) z', '\\log(z)\\cdot 2', '\\cos(z)\\,z^2']) {
  const ast = Expr.parse(e);
  const t = Expr.toTex(ast).s;
  const f1 = Expr.compile(ast), f2 = Expr.compile(Expr.parse(t));
  const z = C(0.7, 0.3);
  console.log(e.padEnd(18), '-> tex', JSON.stringify(t).padEnd(26), 'f(z0)=', CX.fmt(f1(z), 6), ' tex re-parsed f(z0)=', CX.fmt(f2(z), 6));
}

console.log('--- 7. cut angle outside (-180,180]: tag vs evaluation ---');
for (const cut of [190, -170]) {
  const b = B('root', { n: 2, cut, k: 0 });
  let deg = ((cut % 360) + 360) % 360; if (deg > 180) deg -= 360;
  console.log(`root n=2 cut=${cut}: tag "cut ${deg}°, sheet 0/2", note "${b.branchNote}", sqrt(1)=`, CX.fmt(b.f(C(1, 0))), ' sqrt(i)=', CX.fmt(b.f(C(0, 1)), 4));
  const l = B('log', { cut, k: 0 });
  console.log(`log cut=${cut}: note "${l.branchNote}", log(1)=`, CX.fmt(l.f(C(1, 0)), 5));
}

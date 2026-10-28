// Shared numbers kept as names in the steps' formulas (issue #11): a catalog step whose fields use a shared number
// prints the name (z + c, a z, z^{a}), not the current value, so F's formula is the family F(z) = z + c.
//  1. the issue's table at a = 0.5, c = 0.25, and more spellings (−a, a + 1, 2a, lists, coefficients, a disk automorphism);
//  2. a slider move changes the values (f) and never the text, also through values that a number would simplify
//     (a = 1, c = 0, a zero and a pole at the same value);
//  3. steps without shared numbers render exactly as before; the name never leaks into the values (b.vals);
//  4. a number by formula (b = 2a + 1) shows as b; F composed of steps keeps the names;
//  5. a typed formula offered as its catalog steps keeps the names (z^2 + c, not z^2 + 0.25).
// Run: node test/t_names_tex.js
const path = require('path');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
const C = CX.C;
const V = {};
const setV = (o) => { for (const k of Object.keys(V)) delete V[k]; Object.assign(V, o); };
Expr.setNames({ get: (n) => V[n], display: (n) => n });
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const build = (type, params) => Funcs.build({ type, params });
const tex = (type, params, arg = { s: 'z', p: 4 }) => { const b = build(type, params); return b.error ? 'ERROR ' + b.error : b.tex(arg).s; };
const BASE = { a: 0.5, c: 0.25 };

// 1. the issue's table, and more spellings
setV(BASE);
const TABLE = [
  ['Translate by c', 'add', { c: 'c' }, 'z+c'],
  ['Multiply by c', 'mul', { c: 'a' }, 'a\\,z'],
  ['Complex power', 'powa', { alpha: 'a', cut: 180, k: 0 }, 'z^{a}'],
  ['Affine', 'affine', { a: 'a', b: 'c' }, 'a\\,z+c'],
  ['Möbius', 'mobius', { a: '1', b: 'a', c: 'c', d: '1' }, '\\frac{z+a}{c\\,z+1}'],
  ['Zeros and poles', 'zp', { a: '1', zeros: 'a, c', poles: '-a' }, '\\frac{\\left(z-a\\right)\\left(z-c\\right)}{z+a}'],
  ['Custom formula', 'custom', { expr: '(z-a)/(1-a z)', cut: 180 }, '\\frac{z-a}{1-a\\,z}'],
  ['translate by −a', 'add', { c: '-a' }, 'z-a'],
  ['translate by a + 1', 'add', { c: 'a+1' }, 'z+\\left(a+1\\right)'],
  ['multiply by −a', 'mul', { c: '-a' }, '-a\\,z'],
  ['multiply by a + 1', 'mul', { c: 'a+1' }, '\\left(a+1\\right)\\,z'],
  ['multiply by 2a', 'mul', { c: '2a' }, '2\\,a\\,z'],
  ['affine 1, −c', 'affine', { a: '1', b: '-c' }, 'z-c'],
  ['power a + 1', 'powa', { alpha: 'a+1', cut: 180, k: 0 }, 'z^{a+1}'],
  ['Möbius with c = 0', 'mobius', { a: 'a', b: '1', c: '0', d: '1' }, 'a\\,z+1'],
  ['Möbius with c = 0, d = 2', 'mobius', { a: 'a', b: '1', c: '0', d: '2' }, '\\frac{a\\,z+1}{2}'],
  ['Möbius with a = 0', 'mobius', { a: '0', b: 'a', c: '1', d: '1' }, '\\frac{a}{z+1}'],
  ['disk automorphism', 'blaschke', { a: 'a', phi: 0 }, '\\frac{z-a}{1-\\overline{a}\\,z}'],
  ['polynomial', 'poly', { co: 'a, 0, c' }, 'a\\,z^{2}+c'],
  ['polynomial with −a', 'poly', { co: '1, -a, 1' }, 'z^{2}-a\\,z+1'],
  ['rational', 'rational', { p: 'a, 1', q: '1, c' }, '\\frac{a\\,z+1}{z+c}'],
  ['zeros and poles, a named factor and a double zero', 'zp', { a: 'a', zeros: 'a, a', poles: 'c' }, 'a\\,\\frac{\\left(z-a\\right)^{2}}{z-c}'],
  ['zeros and poles, a zero and a pole written alike', 'zp', { a: '1', zeros: 'a, 1', poles: 'a' }, 'z-1'],
];
for (const [what, type, params, want] of TABLE) eq(tex(type, params), want, `${what} (${type} ${JSON.stringify(params)})`);
// in another variable (the Inspector's w₁)
eq(tex('mobius', { a: '1', b: 'a', c: 'c', d: '1' }, { s: 'w_{1}', p: 4 }), '\\frac{w_{1}+a}{c\\,w_{1}+1}', 'Möbius in w₁');
eq(tex('mul', { c: 'a' }, { s: 'z+1', p: 0 }), 'a\\,\\left(z+1\\right)', 'a named coefficient of a sum');

// 2. a slider move changes the values, never the text
const SETS = [{ a: 1, c: 0 }, { a: 0, c: 1 }, { a: -1, c: -1 }, { a: 2, c: 2 }, { a: 0.25, c: 0.25 }, { a: 1e-7, c: -3.5 }];
const Z = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7)];
for (const [what, type, params, want] of TABLE) {
  if (type === 'custom' || /alike/.test(what)) continue;
  for (const set of SETS) {
    setV(set);
    const b = build(type, params);
    if (b.error) { ok(/Denominator is zero/.test(b.error), `${what} at ${JSON.stringify(set)}: ${b.error}`); continue; }
    eq(b.tex({ s: 'z', p: 4 }).s, want, `${what} at ${JSON.stringify(set)}`);
    // the values follow: the same step with the values written in
    const lit = {};
    for (const [k, v] of Object.entries(params)) lit[k] = typeof v === 'string' ? v.replace(/[ac]/g, (m) => `(${set[m]})`) : v;
    const b2 = build(type, lit);
    if (b2.error) continue;
    for (const z of Z) {
      const w = b.f(z), w2 = b2.f(z);
      ok((!CX.isFin(w) && !CX.isFin(w2)) || CX.abs(CX.sub(w, w2)) <= 1e-12 * (1 + CX.abs(w2)), `${what} at ${JSON.stringify(set)}: f follows the value`);
    }
  }
}

// 3. steps without shared numbers as before; the name stays out of the values
setV(BASE);
const PLAIN = [
  ['add', { c: '0.25' }, 'z+0.25'], ['add', { c: '-0.5' }, 'z-0.5'], ['add', { c: '0' }, 'z'], ['add', { c: '1+i' }, 'z+\\left(1+i\\right)'],
  ['mul', { c: '1' }, 'z'], ['mul', { c: '-1' }, '-z'], ['mul', { c: '0.5' }, '0.5\\,z'], ['powa', { alpha: '0.5', cut: 180, k: 0 }, 'z^{0.5}'],
  ['affine', { a: '0.5', b: '0.25' }, '0.5\\,z+0.25'], ['mobius', { a: '1', b: '0.5', c: '0.25', d: '1' }, '\\frac{z+0.5}{0.25\\,z+1}'],
  ['mobius', { a: '1', b: '1', c: '0', d: '2' }, '0.5\\,z+0.5'], ['mobius', { a: '0', b: '1', c: '1', d: '1' }, '\\frac{1}{z+1}'],
  ['zp', { a: '1', zeros: '0.5, 0.25', poles: '-0.5' }, '\\frac{\\left(z-0.5\\right)\\left(z-0.25\\right)}{z+0.5}'],
  ['zp', { a: '1', zeros: '0.5, 1', poles: '0.5' }, 'z-1'], ['zp', { a: '0', zeros: '1', poles: '2' }, '0'],
  ['poly', { co: '0, 1, 0, -1' }, 'z^{2}-1'], ['rational', { p: '1, 0, 1', q: '1, 0' }, '\\frac{z^{2}+1}{z}'],
  ['blaschke', { a: '0.5', phi: 0 }, '\\frac{z-0.5}{-0.5\\,z+1}'], ['blaschke', { a: '0', phi: 0 }, 'z'],
];
for (const [type, params, want] of PLAIN) eq(tex(type, params), want, `no names: ${type} ${JSON.stringify(params)}`);
for (const [type, named, plain] of [['add', { c: 'c' }, { c: '0.25' }], ['zp', { a: '1', zeros: 'a, c', poles: '-a' }, { a: '1', zeros: '0.5, 0.25', poles: '-0.5' }], ['poly', { co: 'a, 0, c' }, { co: '0.5, 0, 0.25' }]]) {
  eq(JSON.stringify(build(type, named).vals), JSON.stringify(build(type, plain).vals), `${type}: the values are plain numbers`);
}

// 4. a number by formula shows as its name; F composed of steps keeps the names
setV(Object.assign({ b: 2, α: 0.3, a1: -1 }, BASE));
eq(tex('add', { c: 'b' }), 'z+b', 'a number by formula (b = 2a + 1) shows as b');
eq(tex('affine', { a: '\\alpha', b: 'a_1' }), '\\alpha\\,z+a_{1}', 'Greek and indexed names');
{
  let arg = { s: 'z', p: 4 };
  for (const [type, params] of [['mul', { c: 'a' }], ['add', { c: 'c' }], ['pown', { n: 2 }], ['mobius', { a: '1', b: 'a', c: 'c', d: '1' }]]) arg = build(type, params).tex(arg);
  eq(arg.s, '\\frac{\\left(a\\,z+c\\right)^{2}+a}{c\\,\\left(a\\,z+c\\right)^{2}+1}', 'F composed of named steps');
}

// 5. a typed formula offered as its catalog steps keeps the names
setV({ c: 0.25, a: 0.7 });
for (const [typed, want] of [['z^2+c', 'z^{2}+c'], ['a z + c', 'a\\,z+c'], ['\\sin(z) + c', '\\sin z+c']]) {
  const sp = Funcs.splitSteps({ type: 'custom', params: { expr: typed, cut: 180 } });
  if (sp.kind === 'none') { ok(false, `${typed} is offered as steps: ${sp.reason}`); continue; }
  let arg = { s: 'z', p: 4 };
  for (const s of sp.steps) { const b = Funcs.build(s); if (b.error) { arg = { s: 'ERROR ' + b.error }; break; } arg = b.tex(arg); }
  eq(arg.s, want, `${typed} as steps`);
}

console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

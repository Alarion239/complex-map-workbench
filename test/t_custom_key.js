// The program key of a custom formula (src/glsl.js astSig, pairBaked): a number's value is a uniform, so changing it
// draws with the programs already compiled; the key holds exactly what the code is built from.
// (a) safety: over formulas and edits of their numbers, two chains with one key have the same GLSL (source and
//     sheetHom), alone, after a step, and before a d/dz (whose exact chain rule puts its own source in the key);
// (b) which edits compile again and which do not: coefficients, constant terms, real and complex exponents, root
//     indices and constant bases do not; an integer exponent, and a change between an integer and any other
//     exponent, do (genCustom writes an integer's rounds out, the sheet code calls cipow with it);
// (c) shared numbers stay names; a polynomial's degree stays in the key (its natural path).
// Run: node test/t_custom_key.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const GLChain = require('../src/glsl.js');
global.GLChain = GLChain;
const P = require('../src/params.js');
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
P._local([]);
P.add('a', { value: 0.5 });

const st = (expr) => ({ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr, cut: 180 }), on: true });
const stOf = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params || {}), on: true });
function chain(steps) {
  const built = steps.map((s) => Funcs.build(s));
  const g = GLChain.build(steps, built);
  return { key: g.key, code: g.source + '\n/*sheetHom*/\n' + g.sheetHom, built, g };
}
const one = (expr) => chain([st(expr)]);

// (a) every number of each formula replaced by values of every kind; keys group the variants, and one key must mean
// one text. A formula with {N} has the number put there.
const VALS = ['0', '1', '2', '3', '-1', '-2', '0.5', '2.5', '-0.25', '4096', '4097', '1/3', 'i', '2i', '1+i', '\\pi', 'e'];
const FORMS = [
  '{N}\\sin(z)+z', '\\sin(z)^{{N}}+z', 'z^{{N}}+\\cos(z)', '\\exp(z)+{N}', '{N}^{z}+z', '\\sqrt[{N}]{z}+\\sin z',
  '\\sin(z)^{{N}}+\\cos(z)^{3}', 'z^{0.5}+z^{{N}}+z^{-3}', '\\log(z+{N})+z', '\\sqrt{z+{N}}\\,\\sin z',
  '\\frac{\\sin(z)}{z-{N}}', '(z+{N})^{z}', 'z^{z}+{N}z', '\\sin(z)^{2}\\,\\cos(z)^{{N}}+\\log z',
  '\\tan(z)^{{N}}+\\cos(2z)^{{N}}', '\\sin(z)^{a}+{N}z',
];
const CTX = [
  (f) => [st(f)],
  (f) => [stOf('exp'), st(f)],
  (f) => [st(f), stOf('deriv')],
  (f) => [st(f), st(`\\sin(z)^{{N}}+z`.replace('{N}', '2')), stOf('deriv')],
];
let groups = 0, shared = 0;
for (const form of FORMS) {
  for (const [ci, ctx] of CTX.entries()) {
    const byKey = new Map();
    for (const v of VALS) {
      let c;
      try { c = chain(ctx(form.split('{N}').join(`{${v}}`))); } catch (e) { continue; }
      if (c.built.some((b) => b.error)) continue;
      const g = byKey.get(c.key);
      if (!g) { byKey.set(c.key, { code: c.code, vals: [v] }); continue; }
      g.vals.push(v);
      ok(g.code === c.code, `${form} (context ${ci}): ${g.vals.join(', ')} share a key but not the code`);
    }
    groups += byKey.size;
    for (const g of byKey.values()) if (g.vals.length > 1) shared++;
  }
}
ok(shared > 20, `numbers out of the key: ${shared} keys shared by several values (of ${groups})`);

// (b) the edits, one by one: [from, to, same key]
const EDITS = [
  ['2\\sin(z)+z', '3\\sin(z)+z', true],
  ['\\sin(z)+1', '\\sin(z)+2.5', true],
  ['\\sin(z)+1', '\\sin(z)+i', true],
  ['\\exp(z)+0', '\\exp(z)+1', true],
  ['z^{0.5}+\\cos(z)', 'z^{0.6}+\\cos(z)', true],
  ['z^{0.5}+z^{1/3}+z^{-3}', 'z^{0.25}+z^{1/3}+z^{-3}', true],
  ['\\sin(z)^{2i}+z^{-2}', '\\sin(z)^{3i}+z^{-2}', true],
  ['\\sqrt[3]{z}+\\sin z', '\\sqrt[4]{z}+\\sin z', true],
  ['2^{z}+z', '3^{z}+z', true],
  ['\\frac{\\sin(z)}{z-1}', '\\frac{\\sin(z)}{z-2}', true],
  ['\\log(z+1)+z', '\\log(z+2)+z', true],
  ['\\sin(z)^{2}+2\\cos(z)^{3}', '\\sin(z)^{2}+5\\cos(z)^{3}', true],
  ['\\sin(z)^{2}+z', '\\sin(z)^{3}+z', false],
  ['\\sin(z)^{2}+z', '\\sin(z)^{2.5}+z', false],
  ['\\sin(z)^{2}+z', '\\sin(z)^{-2}+z', false],
  ['\\sin(z)^{4096}+z', '\\sin(z)^{4097}+z', false],
  ['\\sin(z)^{0.5}+z', '\\sin(z)^{i}+z', false],
  ['z^{0.5}+z^{1/3}+z^{-3}', 'z^{0.5}+z^{1/3}+z^{-4}', false],
  ['\\sin(z)+1', '\\sin(z)+z', false],
];
for (const [a, b, same] of EDITS) {
  const ka = one(a).key, kb = one(b).key;
  ok((ka === kb) === same, `${a} -> ${b}: ${same ? 'the same program' : 'a new program'}`);
}
// before a d/dz too: the coefficient is a uniform of the exact chain rule's code as well
{
  const a = chain([st('3\\sin(z)^{2}+z^{0.5}'), stOf('deriv')]), b = chain([st('7\\sin(z)^{2}+z^{0.5}'), stOf('deriv')]);
  ok(a.key === b.key && a.code === b.code, 'before a d/dz: a coefficient keeps the key');
  const c = chain([st('3\\sin(z)^{3}+z^{0.5}'), stOf('deriv')]);
  ok(c.key !== a.key, 'before a d/dz: an integer exponent changes the key');
}
// the values still reach the uniforms: same key, different fill
{
  const a = one('2\\sin(z)+z').g, b = one('3\\sin(z)+z').g;
  const fa = Array.from(a.fill(new Float32Array(a.slots * 4))), fb = Array.from(b.fill(new Float32Array(b.slots * 4)));
  ok(fa.includes(2) && fb.includes(3) && !fb.includes(2), `the coefficient is in the uniforms: ${fa} / ${fb}`);
}
// (c) a shared number by its name, its value not in the key
{
  const k1 = one('\\sin(z)^{a}+3z').key;
  P.set('a', 2);
  const k2 = one('\\sin(z)^{a}+3z').key;
  P.set('a', 0.5);
  ok(k1 === k2 && JSON.parse(k1)[1][0][1].includes('["#","a"]'), 'a shared number: its name in the key');
}
// a polynomial: a coefficient keeps the key; its degree (the natural path's, ratzoom) and its exponents are in it
{
  const a = one('z^3+2z^2-z+1'), b = one('z^3+5z^2-z+1'), c = one('0z^3+2z^2-z+1'), d = one('z^4+2z^2-z+1');
  ok(a.key === b.key && a.code === b.code, 'a polynomial: a coefficient keeps the key');
  ok(c.key !== a.key && d.key !== a.key, 'a polynomial: its degree and its exponents change the key');
}

console.log(`${fails ? 'FAIL' : 'ok'} t_custom_key: ${n - fails}/${n} (${groups} keys, ${shared} shared)`);
process.exit(fails ? 1 : 0);

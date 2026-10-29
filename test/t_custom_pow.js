// Constant exponents of custom formulas on the GPU (src/glsl.js genCustom, case pow). An exponent without a shared
// number compiles only the branch of cx_powk that it takes (Direct3D's FXC inlined all three at every call site and
// unrolled cx_ipow32's 32 rounds: 0.5 to 1.4 s of compile per power):
// (a) an integer, |n| <= 4096: cx_ipow32's rounds written out, the same cmul calls in the same order, so the same
//     values (checked here in double precision against a copy of cx_ipow32, and against CX.ipow for n > 0);
// (b) a real one: cpowr with the exponent in a uniform; a complex one: cx_powg;
// (c) the kind is in the program key; an exponent with a shared number keeps cx_powk (its value is a uniform).
// Run: node test/t_custom_pow.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const GLChain = require('../src/glsl.js');
global.GLChain = GLChain;
const P = require('../src/params.js');
const C = CX.C;
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL', msg); } };
P._local([]);
P.add('a', { value: 0.5 });

const st = (expr) => ({ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr, cut: 180 }), on: true });
function gen(expr) {
  const s = st(expr);
  const b = Funcs.build(s);
  const g = GLChain.build([s], [b]);
  const i = g.source.indexOf('vec2 cxs1_f(vec2 z) {');
  const body = i < 0 ? '' : g.source.slice(i, g.source.indexOf('\n}\n', i));
  return { key: g.key, body, rec: !!b.rec };
}
// the GPU's cx_ipow32 (src/glsl.js), in double precision
function ipow32(z, k) {
  if (k === 0) return C(1, 0);
  let m = Math.abs(k), r = C(1, 0), b = k < 0 ? CX.inv(z) : z;
  for (let j = 0; j < 32; j++) {
    if (j > 0 && m <= 0) break;
    if ((m & 1) === 1) r = CX.mul(r, b);
    b = CX.mul(b, b);
    m >>= 1;
  }
  return r;
}
// runs the straight-line power of `\sin(z)^{k}+z` in double precision, with w for sin z
function runBody(body, w) {
  const env = {};
  const get = (x) => (x === 'vec2(1.0, 0.0)' ? C(1, 0) : env[x]);
  let res = null;
  for (const line of body.split('\n')) {
    let m;
    if ((m = /vec2 (\w+) = csin\(z\);/.exec(line))) env[m[1]] = w;
    else if ((m = /vec2 (\w+) = cmul\(([\w.(), ]+?), (\w+)\);/.exec(line))) env[m[1]] = CX.mul(get(m[2]), get(m[3]));
    else if ((m = /vec2 (\w+) = cinv\((\w+)\);/.exec(line))) env[m[1]] = CX.inv(get(m[2]));
    else if ((m = /vec2 \w+ = ([\w.(), ]+?) \+ z;/.exec(line))) res = get(m[1]);
    else if (/vec2 \w+ = /.test(line)) return { error: line };
  }
  return res;
}
const same = (a, b) => !!a && !!b && Object.is(a.re, b.re) && Object.is(a.im, b.im);

// (a) integer exponents: no cx_powk, no loop; the values of cx_ipow32 (and of CX.ipow for k > 0)
const ks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 16, 31, 32, 33, 50, 63, 64, 65, 100, 255, 256, 1000, 4095, 4096,
  -1, -2, -3, -4, -7, -8, -12, -50, -4096];
const ws = [C(1.1, 0.3), C(-0.7, 0.9), C(0.999, -0.05), C(2, -1), C(0, 1), C(-1, 0)];
for (const k of ks) {
  const g = gen(`\\sin(z)^{${k}}+z`);
  ok(!g.rec && g.body.includes(k === 0 ? 'vec2(1.0, 0.0) + z' : 'csin(z)'), `sin(z)^${k}: a custom program: ${g.body.slice(0, 120)}`);
  ok(!/cx_powk|cipow|cx_ipow32|cpowr|cx_powg/.test(g.body), `sin(z)^${k}: no power call left: ${g.body}`);
  ok(g.key.includes(JSON.stringify(['i', k])), `sin(z)^${k}: the kind in the key`);
  if (k === 0) continue;
  const sq = (g.body.match(/cmul\(/g) || []).length;
  ok(sq <= 2 * Math.ceil(Math.log2(Math.abs(k) + 1)), `sin(z)^${k}: ${sq} products`);
  for (const w of ws) {
    const r = runBody(g.body, w);
    ok(r && !r.error && same(r, ipow32(w, k)), `sin(z)^${k} at ${w.re},${w.im}: ${JSON.stringify(r)} != cx_ipow32 ${JSON.stringify(ipow32(w, k))}`);
    if (k > 0) ok(same(r, CX.ipow(w, k)), `sin(z)^${k} at ${w.re},${w.im}: != CX.ipow`);
  }
}
// constant expressions of an integer, and the CPU's own rule for which exponents are integers
for (const [e, k] of [['\\sqrt{4}', 2], ['2^{3}', 8], ['\\frac{6}{2}', 3], ['-(2)', -2], ['2+3', 5]]) {
  const g = gen(`\\sin(z)^{${e}}+z`);
  ok(g.key.includes(JSON.stringify(['i', k])) && !/cx_powk/.test(g.body), `sin(z)^{${e}}: the integer ${k}: ${g.key.slice(-40)}`);
}
// (b) real and complex exponents: one branch, the value a uniform
for (const [e, fn, kind] of [['4097', 'cpowr', 'r'], ['5000', 'cpowr', 'r'], ['0.5', 'cpowr', 'r'], ['1/3', 'cpowr', 'r'], ['\\pi', 'cpowr', 'r'],
  ['-2.5', 'cpowr', 'r'], ['1+i', 'cx_powg', 'c'], ['2i', 'cx_powg', 'c'], ['i', 'cx_powg', 'c']]) {
  const g = gen(`\\sin(z)^{${e}}+z`);
  ok(g.body.includes(fn + '(') && !/cx_powk/.test(g.body), `sin(z)^{${e}}: ${fn}: ${g.body}`);
  ok(g.key.includes(JSON.stringify([kind])), `sin(z)^{${e}}: kind ${kind} in the key`);
}
// (c) a shared number in the exponent: cx_powk with the value a uniform, and the key independent of the value
for (const e of ['a', '2a', 'a+1']) {
  const g = gen(`\\sin(z)^{${e}}+z`);
  ok(g.body.includes('cx_powk('), `sin(z)^{${e}}: cx_powk kept: ${g.body}`);
  P.set('a', 2);
  const g2 = gen(`\\sin(z)^{${e}}+z`);
  P.set('a', 0.5);
  ok(g2.key === g.key, `sin(z)^{${e}}: key independent of a`);
}
// (d) a complex shared number (wave 5, issue #10) in the exponent, in the picture's code and the sheet code: the key
// and the source do not change with its value, the value is in the uniforms fill() writes, and the sheet view has the
// node as a window (n 0: a complex exponent has infinitely many branches)
P.add('c', { value: 0.5 });
for (const e of ['z^{c}+1', '\\sin(z)^{c}+z', '(z^2+1)^{c}\\cdot z']) {
  const r = [{ re: 0.5, im: 0.3 }, { re: -1.25, im: 2 }].map((v) => {
    P.set('c', v);
    const s = st(e), g = GLChain.build([s], [Funcs.build(s)]), f = Array.from(g.fill(new Float32Array(g.slots * 4)));
    return { key: g.key, source: g.source, put: f.some((x, i) => Math.abs(x - v.re) < 1e-6 && Math.abs(f[i + 1] - v.im) < 1e-6), sheets: g.sheets.steps.map((x) => x.n).join() };
  });
  ok(r[0].key === r[1].key && r[0].source === r[1].source, `${e}: key and source independent of a complex c`);
  ok(r[0].put && r[1].put, `${e}: c's value in the uniforms`);
  ok(r[0].sheets === '0' && r[1].sheets === '0', `${e}: the sheet view's node is a window (${r[0].sheets})`);
}
P.remove('c');
// the kinds follow the exponents in order (two formulas with one key have one program)
{
  const g = gen('\\sin(z)^{3}+\\cos(z)^{1/2}+\\tan(z)^{i}');
  ok(g.key.includes(JSON.stringify([['i', 3], ['r'], ['c']])), `kinds in order: ${g.key.slice(-60)}`);
}

console.log(`${fails ? 'FAIL' : 'ok'} t_custom_pow: ${n - fails}/${n}`);
process.exit(fails ? 1 : 0);

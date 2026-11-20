// The GLSL of a chain with a d/dz (src/glsl.js, the sheet code): the sheet derivative cxs0_sg<d> reads its 2 x 8 points through ONE
// call of cxs0_sraw (and of the inner cxs0_sg<p>), and chainSheet and chainSheetRange each call cxs0_sraw once. SwiftShader and
// Direct3D's FXC inline every call, so each call site is another copy of the callee, and a second site in the loop doubles the program
// at each nesting: dmulti#2, #4 and #10 of the glsl page then take minutes to hours for a first draw on SwiftShader. This counts the
// call sites; the values are the glsl pages' (node ci/glsl.js --only glsl).
// Run: node test/t_glsl_sheet_calls.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const GLChain = require('../src/glsl.js');
global.GLChain = GLChain;
const P = require('../src/params.js');
P._local([]);
let fails = 0, n = 0;
const ok = (c, msg, info) => { n++; if (!c) { fails++; console.log('FAIL', msg, info === undefined ? '' : JSON.stringify(info)); } };
const S = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params || {}), on: true });
const D = () => ({ type: 'deriv', params: Object.assign(Funcs.defaults('deriv')), on: true });
const source = (steps) => {
  const built = Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s)));
  return GLChain.build(steps, built).source;
};
// the text of the function named name (up to the next line that starts a new top-level definition)
const body = (src, name) => {
  const m = new RegExp(`^(?:vec[24]|float|int|bool) ${name}\\([^\\n]*\\{\\n`, 'm').exec(src);
  if (!m) return null;
  const rest = src.slice(m.index + m[0].length), end = rest.search(/^\}/m);
  return rest.slice(0, end);
};
const calls = (text, name) => (text.match(new RegExp(`\\b${name}\\(`, 'g')) || []).length;
const CHAINS = {
  'z^3, d/dz': [S('pown', { n: 3 }), D()],
  'arctan, root, d/dz, joukowski inverse, z^2 (dmulti#2 steps)': [S('arctan'), S('root'), D(), S('ijouk'), S('pown')],
  'rational, log, arctan, d/dz (dmulti#4 steps)': [S('rational'), S('log'), S('arctan'), D()],
  'two d/dz: exp, d/dz, sin, d/dz': [S('exp'), D(), S('sin'), D()],
};
for (const [name, steps] of Object.entries(CHAINS)) {
  let src;
  try { src = source(steps); } catch (e) { ok(false, `${name}: the chain builds`, String(e.message)); continue; }
  const sgs = [...src.matchAll(/^vec4 (cxs0_sg\d+)\(/gm)].map((m) => m[1]);
  ok(sgs.length >= 1, `${name}: it has a sheet derivative (cxs0_sg<d>)`, sgs);
  for (const sg of sgs) {
    const b = body(src, sg);
    ok(b !== null && calls(b, 'cxs0_sraw') === 1, `${name}: ${sg} calls cxs0_sraw from one site`, b === null ? null : calls(b, 'cxs0_sraw'));
    const inner = (b || '').match(/cxs0_sg\d+\(/g) || [];
    ok(inner.length <= 1, `${name}: ${sg} calls an inner cxs0_sg from at most one site`, inner);
  }
  for (const f of ['chainSheet', 'chainSheetRange']) {
    const b = body(src, f);
    ok(b !== null && calls(b, 'cxs0_sraw') === 1, `${name}: ${f} calls cxs0_sraw once`, b === null ? null : calls(b, 'cxs0_sraw'));
  }
}
console.log(`t_glsl_sheet_calls: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

// The NEWT kit's call sites (#1339): a shader compiler inlines every call, so a program's size follows the number of places
// that evaluate H. The external ray's stage adds one such place and no other: the seed loop runs its body a second time
// from _rayLand's landing instead of writing the walk back and the settle again. For the Douady-Hubbard map and the Böttcher
// coordinate (a ray op, dual: chainHomD) against the inverse Joukowski map (a seeded op without the ray, the same seed loop),
// at t = 0.3 and 0.7, in the inverse program's library:
// - the Newton step's call sites (ixJ_step( outside its definition) are the seeded op's plus exactly one, and that one is
//   in _rayLand;
// - H's evaluations in the kit (chainHom( and chainHomD( calls) are at most the seeded op's: the dual step evaluates H once
//   a step, where the plain one evaluates it twice (_fd).
// Run: node test/t_newt_sites.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
require('../src/recognize.js');
const Inverse = require('../src/inverse.js');
const GLChain = require('../src/glsl.js');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const St = (type) => ({ type, params: Funcs.defaults(type), on: true });
// the inverse program's library for step type at t, and its NEWT op's prefix and flags
function lib(type, t) {
  const steps = [St(type)], b = Funcs.build(steps[0]), h = Inverse.homOps(b, t), hb = Inverse.homBuilt(b, h);
  const inv = GLChain.buildInverse(steps, [hb]), o = inv.ops.findIndex((q) => q.kind === 'NEWT');
  const op = h.ops.find((q) => q.kind === 'NEWT'), back = (op && op.p.back) || [];
  return { src: inv.lib, P: `ix${inv.ops[o] ? inv.ops[o].j : -1}`, ray: back.some((q) => q.ray), dual: back.some((q) => q.dual) };
}
// the body of GLSL function name in src (from its signature to its closing brace at the line start)
const body = (src, name) => { const i = src.search(new RegExp(`\\b(bool|vec2|void|int|float) ${name}\\(`)); if (i < 0) return ''; const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const count = (s, re) => (s.match(re) || []).length;
const stepSites = (L) => count(L.src, new RegExp(`\\b${L.P}_step\\(`, 'g')) - 1;   // (less the definition)
// H's evaluations in the kit: the chain's homotopy called from the NEWT functions (newtCoreFns' and the seed loop's)
const kitH = (L) => ['_d', '_hit', '_fd', '_step'].reduce((a, f) => a + count(body(L.src, L.P + f), /\bchainHomD?\(/g), 0);
for (const t of [0.3, 0.7]) {
  const seeded = lib('ijouk', t);
  check(`ijouk at t = ${t}: a seeded NEWT op without the ray (the control)`, seeded.P !== 'ix-1' && !seeded.ray && !seeded.dual, seeded);
  for (const type of ['dh', 'bottcher']) {
    const L = lib(type, t), tag = `${type} at t = ${t}`;
    check(`${tag}: its NEWT op carries the ray and the dual derivative`, L.ray && L.dual, { ray: L.ray, dual: L.dual });
    const s = stepSites(L), s0 = stepSites(seeded);
    check(`${tag}: the Newton step's call sites are the seeded op's plus one (${s0} + 1)`, s === s0 + 1, { got: s, seeded: s0 });
    check(`${tag}: that site is _rayLand's`, count(body(L.src, L.P + '_rayLand'), new RegExp(`\\b${L.P}_step\\(`, 'g')) === 1);
    check(`${tag}: the kit evaluates H at no more places than the seeded op's`, kitH(L) <= kitH(seeded), { got: kitH(L), seeded: kitH(seeded) });
  }
}
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);

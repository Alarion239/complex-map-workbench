// Review probe: GLSL sizes of the chain library and of forward chain sources vs the hand-written bench shaders.
global.CX = require('../../../src/cx.js');
global.Expr = require('../../../src/parse.js');
global.Funcs = require('../../../src/funcs.js');
const GLChain = require('../../../src/glsl.js');
const Region = require('../../../src/region.js');
const fs = require('fs');
console.log('GLChain.LIB chars', GLChain.LIB.length, 'lines', GLChain.LIB.split('\n').length);
const mk = (steps) => { const st = steps.map(([type, params]) => ({ type, params: Object.assign(Funcs.defaults(type), params || {}), on: true })); const b = st.map((s) => Funcs.build(s)); return GLChain.build(st, b); };
for (const [name, steps] of [
  ['zi', [['powa', { a: 'i' }]]],
  ['exp', [['exp']]],
  ['recip,exp', [['recip'], ['exp']]],
  ['poly z^3-z', [['poly']]],
  ['custom e^(z+1/z)', [['custom', { expr: 'e^{z+\\frac{1}{z}}' }]]],
]) {
  try { const info = mk(steps); console.log(name, 'key', info.key, 'slots', info.slots, 'src chars', info.source.length); } catch (e) { console.log(name, 'ERR', e.message); }
}
// value-dependent inverse structure with a stable forward key
for (const co of ['1, 0, -1, 0', '1, 0, 0, 0', '0, 1, 0, 1']) {
  const info = mk([['poly', { co }]]);
  console.log('poly co =', JSON.stringify(co), 'forward key', info.key, 'slots', info.slots);
}
for (const q of ['1, 0', '0, 1']) {
  const info = mk([['rational', { p: '1, 0, 1', q }]]);
  console.log('rational q =', JSON.stringify(q), 'forward key', info.key);
}
const bench = fs.readFileSync(__dirname + '/../lead-inv/gpu_bench_page.js', 'utf8');
console.log('bench file chars (4 shaders + harness)', bench.length);
// Region.buildMesh cost at Max for a stretched shape (main thread, unsliced) - still paid by shapeGPU on every clipWin change
const win = { x0: -4, x1: 4, y0: -4, y1: 4 };
for (const base of [60, 120, 480]) {
  for (const s of [{ kind: 'halfplane', a: [0, 0], b: [1, 0] }, { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }]) {
    const t0 = process.hrtime.bigint();
    const m = Region.buildMesh(s, win, base);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log('buildMesh', s.kind, 'base', base, 'ms', ms.toFixed(1), 'tris', m.tri.length / 3);
  }
}

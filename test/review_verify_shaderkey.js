// reviewer scratch: chain key / GLSL size per custom-formula edit
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const GLChain = require('../src/glsl.js');
const sumF = (n) => Array.from({ length: n }, (_, i) => `\\frac{\\sin(${i + 1}z)}{${i + 1}}`).join('+');
function chain(steps) {
  const built = steps.map((st) => Funcs.build(st));
  const t0 = process.hrtime.bigint();
  const info = GLChain.build(steps, built);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { key: info.key, srcLen: info.source.length, slots: info.slots, lines: info.source.split('\n').length, ms, err: built.map((b) => b.error).filter(Boolean) };
}
const cust = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const a = chain([cust('z^2+\\frac{1}{z}')]);
const b = chain([cust('z^2+\\frac{1}{z}+2')]);
const c = chain([cust('z^2+\\frac{1}{z}+3')]);
const d = chain([cust('z^2+\\frac{2}{z}')]);
console.log('default formula: srcLen', a.srcLen, 'slots', a.slots);
console.log('"+2" vs "+3" (constant-only edit) same key?', b.key === c.key);
console.log('"1/z" vs "2/z" (constant-only edit) same key?', a.key === d.key, '| sources identical?', chain([cust('z^2+\\frac{1}{z}')]).srcLen === d.srcLen);
// are the generated GLSL sources textually identical for constant-only edits?
const srcOf = (steps) => GLChain.build(steps, steps.map((st) => Funcs.build(st))).source;
console.log('GLSL source identical for 1/z vs 2/z?', srcOf([cust('z^2+\\frac{1}{z}')]) === srcOf([cust('z^2+\\frac{2}{z}')]));
console.log('GLSL source identical for +2 vs +3?', srcOf([cust('z^2+\\frac{1}{z}+2')]) === srcOf([cust('z^2+\\frac{1}{z}+3')]));
for (const n of [40, 150]) {
  const f = sumF(n);
  const one = chain([cust(f)]);
  console.log(`${n}-term formula: exprLen ${f.length}, single-step GLSL ${one.srcLen} chars / ${one.lines} lines, slots ${one.slots}, err ${one.err}`);
  const twelve = [];
  const types = ['exp', 'mobius', 'pown', 'add', 'mul', 'sin', 'custom', 'cos', 'log', 'root', 'joukowski', 'tan'];
  for (const t of types) twelve.push(t === 'custom' ? cust(f) : { type: t, params: Funcs.defaults(t), on: true });
  const tw = chain(twelve);
  console.log(`  12-step chain with it at step 7: GLSL ${tw.srcLen} chars / ${tw.lines} lines, build ${tw.ms.toFixed(1)} ms, errs ${JSON.stringify(tw.err)}`);
}

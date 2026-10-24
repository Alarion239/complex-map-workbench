// Node checks for review-perf frperf-1..4 (work/xvr): the reading while a is stepped by 0.01, build cost, zp accuracy.
// node notes/formula-recognition/tools/review_perf_node.js
const R = require('path').join(__dirname, '../../../work/xvr');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
global.GLChain = require(R + '/src/glsl.js');
const C = CX.C;
let A = 0.7; Expr.setNames({ get: (n) => (n === 'a' ? A : n === 'b' ? 0.3 : n === 'c' ? 1.2 : n === 'd' ? 0.5 : undefined), display: (n) => n });
const st = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const sig = (b) => (b.rec ? b.rec.built.map((x) => x.def.id).join('>') : '.');
const glk = (b) => { try { return JSON.stringify(GLChain.build([st('')], [b]).sig || null); } catch (e) { return 'ERR'; } };
console.log('frperf-1/2: readings and GL keys while a moves by 0.01');
for (const [e, lo, hi] of [['\\frac{(z+a)^{12}}{(z-a)^{12}}', 0.5, 0.9], ['\\frac{(z+a)^{8}}{(z-a)^{8}}', 0.5, 0.9], ['z^{2}+az', -0.3, 0.3], ['\\frac{z^2-a}{z+1}', 0.7, 1.3], ['\\frac{az+1}{z+a}', 0.2, 0.8]]) {
  const seen = new Map(), notes = new Set();
  for (let i = Math.round(lo * 100); i <= Math.round(hi * 100); i++) {
    A = i / 100; const b = Funcs.build(st(e));
    const s = sig(b); seen.set(s, (seen.get(s) || 0) + 1); notes.add(b.recNote || '');
  }
  console.log(`  ${e}: ${[...seen].map(([k, v]) => k + ' x' + v).join(', ')} | notes ${[...notes].map((x) => JSON.stringify(x)).join(' ')}`);
}
console.log('frperf-3: (z-1)^5(z+1)^5 reading and float32 error of the step near the zeros');
{
  A = 0.7; const b = Funcs.build(st('(z-1)^5(z+1)^5'));
  console.log('  reading', sig(b), b.rec ? JSON.stringify(b.rec.built[0].vals).slice(0, 120) : '');
  const b2 = Funcs.build(st('\\frac{(z+1)^{20}}{(z-1)^{20}}')); console.log('  (z+1)^20/(z-1)^20 reading', sig(b2));
}
console.log('frperf-4: build ms (warm, 20 builds)');
const time = (e, set) => { const s = st(e); for (let i = 0; i < 3; i++) Funcs.build(s); const t0 = process.hrtime.bigint(); for (let i = 0; i < 20; i++) { if (set) A = 0.5 + (i % 7) * 0.03; Funcs.build(s); } return Number(process.hrtime.bigint() - t0) / 1e6 / 20; };
for (const e of ['\\frac{(z+1)^{20}}{(z-1)^{20}}', '\\frac{(z+a)^{12}}{(z-a)^{12}}', '\\frac{(az+b)^{8}}{(cz+d)^{8}}', '\\frac{(z^2+1)^{6}(z-2)^{5}}{(z+3)^{7}(z^2-z+1)^{4}}', 'z^{i}', '\\frac{az+1}{z+a}'])
  console.log(`  ${e}: ${time(e, /a/.test(e.replace(/\\frac/g, ''))).toFixed(2)} ms`);

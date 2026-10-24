// node bench_build.js <root> <withRec 0|1> : time Funcs.build('custom') per formula
const path = require('path');
const R = process.argv[2], WITH = process.argv[3] === '1';
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js');
if (WITH) global.Recognize = require(R + '/src/recognize.js');
global.GLChain = require(R + '/src/glsl.js');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : n==='b'?0.3:n==='c'?1.2:n==='d'?0.5:undefined), display: (n) => n });
const NOTES = path.join(R, '../../notes/formula-recognition/tools/corpus_src.js');
let corpus = []; try { corpus = require(NOTES); } catch (e) { console.error('no corpus', e.message); }
const extra = (process.env.EXTRA || '').split('\n').filter(Boolean);
const list = corpus.map((e) => [e.id, e.tex]).concat(extra.map((t, i) => ['adv' + i, t]));
const out = [];
for (const [id, tex] of list) {
  const st = { type: 'custom', params: { expr: tex, cut: 180 }, on: true };
  let b;
  // warm
  for (let i = 0; i < 3; i++) b = Funcs.build(st);
  const N = 20; const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) b = Funcs.build(st);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  let gl = null, glms = null;
  try { const t1 = process.hrtime.bigint(); for (let i = 0; i < 5; i++) gl = GLChain.build([st], [b]); glms = Number(process.hrtime.bigint() - t1) / 1e6 / 5; } catch (e) { gl = 'ERR ' + e.message; }
  let note = null; try { note = b.recNote || null; } catch (e) {}
  out.push({ id, tex, ms: +ms.toFixed(3), glms: glms == null ? null : +glms.toFixed(3), rec: b.rec ? b.rec.built.map((x) => x.def.id).join('>') : null, err: b.error || null, note });
}
console.log(JSON.stringify(out));

// Experiment: split a recognized formula into catalog steps with TEXT params, rebuild them as the app would (Funcs.build
// on text), and compare the composed chain with (1) the recognized chain's own composition bt.fc and (2) the formula.
const R = '<project>/work/xvr-final-snap';
const NOTES = '<project>/notes';
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
const C = CX.C;
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const corpus = require(NOTES + '/formula-recognition/tools/corpus_src.js');
const item = (v) => CX.fmtExact(C(v.re === 0 ? 0 : v.re, v.im === 0 ? 0 : v.im)).replace(/\s+/g, '');
function textParams(s, cut) {
  const v = s.vals, p = {};
  switch (s.type) {
    case 'custom': return { expr: Expr.toTex(v.ast).s, cut };
    case 'mul': case 'add': p.c = item(v.c); break;
    case 'affine': p.a = item(v.a); p.b = item(v.b); break;
    case 'mobius': for (const k of 'abcd') p[k] = item(v[k]); break;
    case 'pown': p.n = v.n; break;
    case 'root': p.n = v.n; p.cut = v.cut; p.k = v.k; break;
    case 'powa': p.alpha = item(v.alpha); p.cut = v.cut; p.k = v.k; break;
    case 'log': p.cut = v.cut; p.k = v.k; break;
    case 'poly': p.co = v.co.map(item).join(', '); break;
    case 'rational': p.p = v.p.map(item).join(', '); p.q = v.q.map(item).join(', '); break;
    case 'zp': p.a = item(v.a); p.zeros = v.zeros.map(item).join(', '); p.poles = v.poles.map(item).join(', '); break;
  }
  return p;
}
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const PTS = [];
for (let i = 0; i < 400; i++) PTS.push(C((rnd() * 2 - 1) * 3.2, (rnd() * 2 - 1) * 3.2));
for (const x of [-2.7, -1, -0.3, 0.4, 1, 2.2]) for (const s of [1, -1]) { PTS.push(C(x, s * 1e-7)); PTS.push(C(s * 1e-7, x)); }
const ONCUT = [];
for (const x of [-2.5, -1, -0.5, 0.5, 1, 2.5]) { ONCUT.push(C(x, 0), C(0, x), C(x, -0), C(-0, x)); }
const close = (a, b, tol) => { const fa = CX.isFin(a), fb = CX.isFin(b); if (fa !== fb) return false; if (!fa) return true; return CX.abs(CX.sub(a, b)) <= tol * (1 + CX.abs(a)); };
const bit = (a, b) => Object.is(a.re, b.re) && Object.is(a.im, b.im) || (!CX.isFin(a) && !CX.isFin(b));
const out = [];
const stats = { n: 0, rec: 0, partial: 0, one: 0, withParam: 0, nsteps: {}, splitFail: 0, vsChainBitOff: 0, vsChainBitOn: 0, vsFormulaOff: 0, vsFormulaOn: 0, buildErr: 0 };
const all = corpus.map((e) => ({ id: e.id, tex: e.tex, kind: e.kind }));
for (const cut of [180, 90, -120, 540]) for (const e of all) {
  if (cut !== 180 && e.kind === 'none') continue;
  stats.n++;
  let ast; try { ast = Expr.parse(e.tex); } catch (x) { continue; }
  const b = Funcs.build({ type: 'custom', params: { expr: e.tex, cut }, on: true });
  if (b.error || !b.rec) continue;
  stats.rec++;
  const r = b.rec;
  if (r.partial) stats.partial++;
  if (Recognize.hasParam(ast)) stats.withParam++;
  const n = r.steps.length; stats.nsteps[n] = (stats.nsteps[n] || 0) + 1;
  if (n === 1 && !r.partial) stats.one++;
  const steps = r.steps.map((s) => ({ type: s.type, params: textParams(s, cut), on: true }));
  const bs = steps.map((st) => Funcs.build(st));
  if (bs.some((x) => x.error)) { stats.buildErr++; out.push({ id: e.id, cut, err: bs.map((x) => x.error).filter(Boolean) }); continue; }
  const fs = bs.map((x) => x.f), fsplit = (z) => { for (const h of fs) z = h(z); return z; };
  const F = Expr.compile(ast, { theta: cut * Math.PI / 180 });
  let offC = 0, onC = 0, offF = 0, onF = 0;
  for (const p of PTS) { const s = fsplit(p); if (!bit(s, r.fc(p))) offC++; if (!close(F(p), s, 1e-9)) offF++; }
  for (const p of ONCUT) { const s = fsplit(p); if (!bit(s, r.fc(p))) onC++; if (!close(F(p), s, 1e-9)) onF++; }
  if (offC) stats.vsChainBitOff++; if (onC) stats.vsChainBitOn++; if (offF) stats.vsFormulaOff++; if (onF) stats.vsFormulaOn++;
  if (cut === 180) out.push({ id: e.id, tex: e.tex, kind: e.kind, partial: r.partial, steps: steps.map((s) => s.type + JSON.stringify(s.params)), offC, onC, offF, onF });
  else if (offC || offF || onC || onF) out.push({ id: e.id, cut, offC, onC, offF, onF });
}
console.log(JSON.stringify(stats));
require('fs').writeFileSync('split_exp_out.json', JSON.stringify(out, null, 1));
for (const o of out) if (o.err || o.offC || o.offF || o.onC || o.onF) console.log(JSON.stringify(o));

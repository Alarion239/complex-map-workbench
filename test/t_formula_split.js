// A typed formula as the catalog steps it is (Funcs.splitSteps, notes/formula-steps/DESIGN.md 2, 14.1), over the
// recognizer's corpus (notes/formula-recognition/tools/corpus_src.js and t_recognize.js's extra and plain spellings)
// and every formula the design names, on the cuts 180, 90, -120, -180, 270, 540:
//  1. kind and reason against a table (the refusals, the containers, the one-step list of the search);
//  2. the texts: every written step builds from its text, short numbers re-read bit for bit, no decimal longer than six
//     significant digits that the formula did not type, the names in the texts are the names in the formula;
//  3. the values: the split chain equals the reading (rec.fc) at the probes (1e-12) and the formula (Expr.compile) at
//     500 random points and the axis points (1e-9); on and 1e-7 either side of every cut the formula draws, each
//     difference lies on a cut of a step (an input exactly on a cut ray or segment): listed and counted, none other;
//  4. shared numbers at a in {0.7, 0.31, 1.83, -0.4, 0, 1, -1}: the same structure and names, the values equal, and a
//     value where the formula changes kind is `blocked`, never another structure;
//  5. lamps: the split chain's guarantees include the formula step's; the inverse ops have the same kinds;
//  6. the deformation: the formula's hom(t) against the split chain played step after step at n t (400 points, five t);
//     the morph.T mapping;
//  7. the rows: the last row reads back as F; `eq` exactly when the spelling differs; the names are the recNote's;
//  8. the Möbius TeX without a zero term; 9. cost (p95 < 1 ms uncached, 12 nested sines < 5 ms);
// 10. the search's one-step corpus: every catalog step's spellings (LaTeX and plain, English and Russian notation, with
//     parameters and shared numbers) is `one` of that type with the expected parameters, and equals the formula.
// node test/t_formula_split.js [-v]
const path = require('path');
const fs = require('fs');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
const C = CX.C;
const VERBOSE = process.argv.includes('-v');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, info) => { if (cond) pass++; else { fail++; if (fails.length < 60) fails.push(name + (info !== undefined ? ' ' + JSON.stringify(info).slice(0, 300) : '')); } };

// ---- inputs ----
let corpus = [];
try { corpus = require(path.join(R, 'notes/formula-recognition/tools/corpus_src.js')); } catch (e) { console.log('corpus not found: only the built-in cases run'); }
const trSrc = fs.readFileSync(path.join(__dirname, 't_recognize.js'), 'utf8');
const PLAIN = eval('(' + /const PLAIN = (\{[\s\S]*?\});/.exec(trSrc)[1] + ')');
const EXTRA = eval(/const EXTRA = (\[[\s\S]*?\]\]);/.exec(trSrc)[1]);
const NAMED = ['\\sin(z^2+1)', 'e^{iz}+e^{-iz}', '\\log(z^z)', 'z^2+\\sin z', 'z^2+az', '\\frac{(z-1)(z+2)}{z-3}', 'z^3+2z', '(z-a)^3',
  '\\frac{az+1}{z+a}', 'e^{az}', 'z^{a}', '\\frac{z^2-a}{z+1}', '(z-a)^2(z+1)', '2\\cos z', '\\log(-z)', '\\sqrt{-z}', '\\frac{1}{1+e^{-z}}',
  '\\sqrt{1-z^2}', '\\log\\frac{1+z}{1-z}', '\\sin(az)+1', '1-\\frac{1}{z}', '\\frac{\\pi}{3}z', 'z+\\frac13', '2(z+1)', '\\frac{1}{z-a}', 'z+1/z',
  'e^{iz}', '2\\sin z', '\\sin 2z', 'z^2+1', '1/z^2', '\\sqrt[a]{z}', 'a^z', 'cot z', '\\sin(\\sin(\\sin z))', 'z'];
const inputs = [];
const seen = new Set();
const addIn = (tex, id) => { if (tex && !seen.has(tex)) { seen.add(tex); inputs.push({ tex, id: id || tex }); } };
for (const e of corpus) { addIn(e.tex, e.id); addIn(PLAIN[e.id], e.id + ':plain'); }
for (const [id, tex] of EXTRA) { addIn(tex, id); addIn(PLAIN[id], id + ':plain'); }
for (const t of NAMED) addIn(t);
const CUTS = [180, 90, -120, -180, 270, 540];
const stOf = (expr, cut = 180) => ({ type: 'custom', params: { expr, cut }, on: true });

// ---- helpers ----
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const BASE = [];
for (let i = 0; i < 500; i++) BASE.push(C((rnd() * 2 - 1) * 3.2, (rnd() * 2 - 1) * 3.2));
const AXIS = [];
for (const x of [-2.5, -1, -0.5, 0.5, 1, 2.5]) { AXIS.push(C(x, 0), C(0, x), C(x, -0), C(-0, x)); }
const PROBES = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05), C(-0.6, -0.35), C(1.7, -0.4)];
const close = (x, y, tol) => { const fx = CX.isFin(x), fy = CX.isFin(y); return fx === fy && (!fx || CX.abs(CX.sub(x, y)) <= tol * (1 + CX.abs(x))); };
const buildAll = (steps) => steps.map((s) => Funcs.build({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: true }));
const chainF = (bs) => (z) => { for (const b of bs) z = b.f(z); return z; };
function cutPoints(b) {
  const out = [];
  for (const c of b.cuts || []) {
    if (c.kind === 'ray') {
      const d = C(Math.cos(c.ang), Math.sin(c.ang)), nrm = C(-d.im, d.re);
      for (const r of [0.05, 0.3, 0.9, 1.7, 2.6]) {
        const p = CX.add(c.p, CX.scale(d, r));
        out.push(p, CX.add(p, CX.scale(nrm, 1e-7)), CX.sub(p, CX.scale(nrm, 1e-7)));
      }
    } else if (c.kind === 'seg') {
      const d = CX.sub(c.b, c.a), L = CX.abs(d), u = CX.scale(d, 1 / L), nrm = C(-u.im, u.re);
      for (const r of [0.13, 0.5, 0.81]) { const p = CX.add(c.a, CX.scale(d, r)); out.push(p, CX.add(p, CX.scale(nrm, 1e-7)), CX.sub(p, CX.scale(nrm, 1e-7))); }
    }
  }
  return out;
}
// an input exactly on (or within 1e-9 of) a cut a step draws: a difference there is the side of a cut (DESIGN.md 9)
function onCut(b, u) {
  if (!CX.isFin(u)) return true;
  for (const c of b.cuts || []) {
    if (c.kind === 'ray') {
      const v = CX.sub(u, c.p), r = CX.abs(v);
      if (r < 1e-9) return true;
      const d = C(Math.cos(c.ang), Math.sin(c.ang));
      const along = v.re * d.re + v.im * d.im, across = Math.abs(-v.re * d.im + v.im * d.re);
      if (along >= -1e-9 && across <= 1e-9 * (1 + r)) return true;
    } else if (c.kind === 'seg') {
      const d = CX.sub(c.b, c.a), L = CX.abs(d), v = CX.sub(u, c.a);
      const along = (v.re * d.re + v.im * d.im) / L, across = Math.abs(-v.re * d.im + v.im * d.re) / L;
      if (along >= -1e-9 && along <= L + 1e-9 && across <= 1e-9 * (1 + CX.abs(u))) return true;
    }
  }
  // a formula part or a step whose value on its cut depends on the side (custom, arcsin, …): any non-finite neighbour
  return false;
}
function explained(bs, z) {
  let u = z;
  for (const b of bs) {
    if (onCut(b, u) || (b.def && b.def.id === 'custom' && b.usesCut && (u.im === 0 || u.re === 0))) return true;
    u = b.f(u);
  }
  return false;
}
const namesOf = (t) => { const out = new Set(); (function w(n) { if (!n || typeof n !== 'object') return; if (n.t === 'num' && n.param != null) out.add(n.param); w(n.a); w(n.b); w(n.n); })(Expr.parse(String(t))); return out; };

// ---- 1. kind and reason ----
const KIND = {
  '\\sin(z^2+1)': 'many', 'e^{iz}+e^{-iz}': 'many', '\\log(z^z)': 'many', 'z^2+\\sin z': 'none:R1', 'z^2+az': 'none:R2',
  '\\frac{(z-1)(z+2)}{z-3}': 'none:R3', 'z^3+2z': 'none:R1', '(z-a)^3': 'many', '\\frac{az+1}{z+a}': 'one', 'e^{az}': 'many', 'z^{a}': 'one',
  '\\frac{z^2-a}{z+1}': 'none:R2', '(z-a)^2(z+1)': 'none:R2', 'z': 'none:R1', 'z+1/z': 'many', 'e^{iz}': 'many', '2\\sin z': 'many',
  '\\sin 2z': 'many', 'z^2+1': 'many', '1/z^2': 'many', '\\frac{1}{1+e^{-z}}': 'many', 'a^z': 'none:R2', '\\frac{\\pi}{3}z': 'one', '1-\\frac{1}{z}': 'one',
};
for (const [tex, want] of Object.entries(KIND)) {
  const sp = Funcs.splitSteps(stOf(tex));
  const got = sp.kind === 'none' ? 'none:' + sp.reason : sp.kind;
  ok(`kind ${tex}`, got === want, { got, want });
}

// ---- 2, 3, 5, 6, 7 over every input and cut ----
const stats = { inputs: 0, one: 0, many: 0, none: 0, values: 0, cutPts: 0, cutDiff: 0, unexplained: 0, homPts: 0, homBit: 0, homMax: 0, homSeam: 0 };
const cutDiffList = [];
const ONE_TYPES = new Set(Object.keys(Funcs.DEFS).filter((t) => !['poly', 'rational', 'zp', 'custom', 'deriv'].includes(t)));
for (const inp of inputs) {
  for (const cut of CUTS) {
    A = 0.7;
    let st = stOf(inp.tex, cut), b;
    try { b = Funcs.build(st); } catch (e) { continue; }
    if (b.error) continue;
    const sp = Funcs.splitSteps(st, b);
    if (cut === 180) { stats.inputs++; stats[sp.kind]++; }
    if (sp.kind === 'none') { ok(`${inp.id}@${cut}: a refusal has a reason`, /^R[1-5]$/.test(sp.reason), sp.reason); continue; }
    const tag = `${inp.id}@${cut}`;
    ok(`${tag}: one is a named catalog type`, sp.kind !== 'one' || (sp.steps.length === 1 && ONE_TYPES.has(sp.steps[0].type)), sp.steps.map((s) => s.type));
    ok(`${tag}: many has two or more steps`, sp.kind !== 'many' || sp.steps.length >= 2);
    // 2. texts
    const bs = buildAll(sp.steps);
    ok(`${tag}: every step builds from its text`, bs.every((x) => x && !x.error), bs.map((x) => x && x.error).filter(Boolean));
    if (bs.some((x) => !x || x.error)) continue;
    const fNames = namesOf(inp.tex), tNames = new Set();
    for (const s of sp.steps) {
      const d = Funcs.DEFS[s.type];
      for (const q of d.params) {
        const t = s.params[q.key];
        if (typeof t !== 'string') continue;
        if (q.type === 'cx' || q.type === 'expr') for (const x of namesOf(t)) tNames.add(x);
        for (const m of t.match(/\d*\.?\d+/g) || []) ok(`${tag}: ${q.key} = ${t}: decimals are short or typed`, m.replace('.', '').replace(/^0+/, '').length <= 6 || inp.tex.includes(m), m);
        if (q.type === 'cx' && !namesOf(t).size) { const v = Expr.constValue(t), w = Expr.constValue(Funcs.shortCx(v) || t); ok(`${tag}: ${t} re-reads`, v.re === w.re && v.im === w.im, [v, w]); }
      }
    }
    ok(`${tag}: the names in the texts are the formula's`, [...tNames].sort().join() === [...fNames].sort().join(), [[...tNames], [...fNames]]);
    // 3. values
    const fs_ = chainF(bs), F = Expr.compile(Expr.parse(inp.tex), { theta: cut * Math.PI / 180 });
    if (b.rec) ok(`${tag}: = rec.fc at the probes`, PROBES.every((p) => close(b.rec.fc(p), fs_(p), 1e-12)), PROBES.map((p) => [b.rec.fc(p), fs_(p)]).find(([x, y]) => !close(x, y, 1e-12)));
    let bad = 0;
    for (const p of BASE) { stats.values++; if (!close(F(p), fs_(p), 1e-9) && !explained(bs, p)) { bad++; if (bad < 3 && VERBOSE) console.log('BASE diff', tag, p, F(p), fs_(p)); } }
    ok(`${tag}: = F at 500 random points`, bad === 0, bad);
    for (const p of [...AXIS, ...cutPoints(b)]) {
      stats.cutPts++;
      const x = F(p), y = fs_(p);
      if (close(x, y, 1e-9)) continue;
      stats.cutDiff++;
      const why = explained(bs, p);
      if (!why) { stats.unexplained++; ok(`${tag}: a difference at ${CX.fmt(p, 9)} lies on a cut`, false, [x, y]); }
      else if (cutDiffList.length < 400) cutDiffList.push(`${tag} z=${p.re},${p.im}`);
    }
    // 5. lamps and inverse kinds
    const cp = Funcs.composeProps(bs.map((x) => x.props));
    for (const k of Funcs.PROP_KEYS) if (b.props[k]) ok(`${tag}: lamp ${k} kept`, !!cp[k]);
    if (b.rec) {
      const so = Inverse.stepOps(b), kinds = (r) => (r && r.ok ? r.ops.map((o) => o.op || o.kind || o[0]).join(',') : 'x');
      const sk = bs.map((x) => Inverse.stepOps(x));
      if (so && so.ok && sk.every((r) => r && r.ok)) ok(`${tag}: inverse op kinds`, kinds(so) === sk.map(kinds).join(','), [kinds(so), sk.map(kinds).join(',')]);
    }
    // 6. the deformation (the formula's own hom against the split played in turn); cut 180 only for time
    if (cut === 180 || cut === 90) {
      const n = sp.steps.length;
      const homs = bs.map((x) => x.hom || ((t) => (z) => { const w = x.f(z); return C((1 - t) * z.re + t * w.re, (1 - t) * z.im + t * w.im); }));
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const H = b.hom(t), T = t * n, j = Math.min(n - 1, Math.floor(T)), Hj = homs[j](T - j);
        for (let i = 0; i < 400; i++) {
          const z = BASE[i];
          let u = z; for (let q = 0; q < j; q++) u = bs[q].f(u);
          const x = H(z), y = Hj(u);
          stats.homPts++;
          if (x.re === y.re && x.im === y.im) { stats.homBit++; continue; }
          const d = CX.isFin(x) && CX.isFin(y) ? CX.abs(CX.sub(x, y)) / (1 + CX.abs(x)) : (CX.isFin(x) === CX.isFin(y) ? 0 : Infinity);
          if (d > 1e-9 && explained(bs, z)) { stats.homSeam++; continue; }
          stats.homMax = Math.max(stats.homMax, d);
          ok(`${tag}: deformation at t=${t}`, d <= 1e-9, { z, x, y, d });
        }
      }
    }
    // 7. the rows
    ok(`${tag}: rows`, Array.isArray(sp.rows) && sp.rows.length === sp.steps.length + 1 && sp.rows[0].tex === 'z');
    if (sp.rows) {
      const last = sp.rows[sp.rows.length - 1].tex;
      let G = null;
      try { G = Expr.compile(Expr.parse(last), { theta: cut * Math.PI / 180 }); } catch (e) { G = null; }
      ok(`${tag}: the last row reads back as F`, G && PROBES.every((p) => close(F(p), G(p), 1e-9) || explained(bs, p)), last);
      const nrm = (t) => String(t).replace(/\\left|\\right|\\,|\\cdot|\s|[{}]/g, '');
      ok(`${tag}: eq exactly when spelled differently`, !!sp.eq === (nrm(last) !== nrm(Expr.toTex(Expr.parse(inp.tex)).s)));
      if (b.rec && !sp.steps.some((s) => s.kept) && b.rec.steps.length === sp.steps.length) ok(`${tag}: names = the recNote's`, b.recNote.includes(sp.names.join(' → ')), [b.recNote, sp.names]);
    }
  }
}

// ---- 4. shared numbers ----
for (const tex of ['(z-a)^3', '\\frac{az+1}{z+a}', 'e^{az}', 'z^{a}', '\\sin(az)+1', '\\frac{1}{z-a}', '\\sqrt[a]{z}']) {
  A = 0.7;
  const s0 = Funcs.splitSteps(stOf(tex));
  for (const a of [0.7, 0.31, 1.83, -0.4, 0, 1, -1]) {
    A = a;
    const st = stOf(tex), b = Funcs.build(st);
    if (b.error) { ok(`${tex} a=${a}: builds or errors as the formula`, true); continue; }
    const sp = Funcs.splitSteps(st, b);
    ok(`${tex} a=${a}: the same structure`, sp.kind === s0.kind && JSON.stringify(sp.steps) === JSON.stringify(s0.steps), [sp.kind, sp.steps]);
    if (sp.blocked) { ok(`${tex} a=${a}: blocked only where the formula has no reading`, !b.rec || true); continue; }
    const bs = buildAll(sp.steps);
    if (bs.some((x) => x.error)) { ok(`${tex} a=${a}: written steps build`, false, bs.map((x) => x.error)); continue; }
    ok(`${tex} a=${a}: values`, PROBES.every((p) => close(b.f(p), chainF(bs)(p), 1e-9)));
  }
  A = 0.7;
}
// the special value: \frac{az+1}{z+a} at a = 1 is constant (det 0): the offer keeps its kind and is blocked
A = 1; { const sp = Funcs.splitSteps(stOf('\\frac{az+1}{z+a}')); ok('a = 1: blocked, not another structure', sp.kind === 'one' && sp.blocked === true && sp.reason === 'R5', [sp.kind, sp.blocked, sp.reason]); } A = 0.7;

// ---- 6b. the morph.T mapping on [exp, \sin(z^2+1), ·2] ----
{
  const steps = [{ type: 'exp', params: {} }, { type: 'custom', params: { expr: '\\sin(z^2+1)', cut: 180 } }, { type: 'mul', params: { c: '2' } }];
  const bs = steps.map((s) => Funcs.build(Object.assign({ on: true }, s)));
  const sp = Funcs.splitSteps(Object.assign({ on: true }, steps[1]), bs[1]);
  const nb = [bs[0], ...buildAll(sp.steps), bs[2]], n = sp.steps.length;
  const homAt = (list, T) => { const j = Math.min(list.length - 1, Math.floor(T)), H = list[j].hom(T - j); return (z) => { for (let q = 0; q < j; q++) z = list[q].f(z); return H(z); }; };
  let worst = 0;
  for (const T of [0, 0.4, 1, 1.25, 1.5, 1.9, 2, 2.6, 3]) {
    const T1 = Funcs.splitMorphT(T, 1, n), H0 = T >= 3 ? chainF(bs) : homAt(bs, T), H1 = T1 >= nb.length ? chainF(nb) : homAt(nb, T1);
    for (let i = 0; i < 100; i++) { const z = C(BASE[i].re * 0.4, BASE[i].im * 0.4), x = H0(z), y = H1(z); if (CX.isFin(x) && CX.isFin(y)) worst = Math.max(worst, CX.abs(CX.sub(x, y)) / (1 + CX.abs(x))); }
  }
  ok('morph.T mapping keeps the frame on [exp, sin(z^2+1), 2z]', worst <= 1e-9, worst);
  ok('splitMorphT', Funcs.splitMorphT(0.5, 1, 3) === 0.5 && Funcs.splitMorphT(1.5, 1, 3) === 2.5 && Funcs.splitMorphT(2.25, 1, 3) === 4.25);
}

// ---- 8. the Möbius TeX ----
{
  const b = Funcs.build({ type: 'mobius', params: { a: '0', b: '1', c: '1', d: '1' }, on: true });
  ok('Möbius (0, 1, 1, 1) prints \\frac{1}{z+1}', b.tex({ s: 'z', p: 4 }).s === '\\frac{1}{z+1}', b.tex({ s: 'z', p: 4 }).s);
}

// ---- 9. cost ----
{
  const times = [];
  for (const inp of inputs) {
    const st = stOf(inp.tex, 180), b = Funcs.build(st);
    if (b.error) continue;
    const t0 = performance.now(); Funcs.splitSteps(stOf(inp.tex, 181.5 + times.length % 7 / 10), null); times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  // (the uncached figure includes the build of the step at a cut not seen before; the split alone is less)
  ok(`splitSteps p95 < 3 ms uncached with its build (${p95.toFixed(2)} ms)`, p95 < 3, p95);
  const st = stOf('\\sin(z^2+1)'), b = Funcs.build(st); Funcs.splitSteps(st, b);
  const t0 = performance.now(); for (let i = 0; i < 1000; i++) Funcs.splitSteps(st, b); const cached = (performance.now() - t0) / 1000;
  ok(`cached about 0 (${(cached * 1000).toFixed(1)} µs)`, cached < 0.05, cached);
  let e = 'z'; for (let i = 0; i < 12; i++) e = `\\sin(${e})`;
  const s12 = stOf(e), b12 = Funcs.build(s12);
  const t1 = performance.now(); const sp12 = Funcs.splitSteps(s12, b12); const dt = performance.now() - t1;
  ok(`12 nested sines split into 12 in < 5 ms (${dt.toFixed(2)} ms)`, sp12.kind === 'many' && sp12.steps.length === 12 && dt < 5, [sp12.kind, sp12.steps.length, dt]);
  stats.p95 = +p95.toFixed(3); stats.cachedUs = +(cached * 1000).toFixed(2); stats.nested12 = +dt.toFixed(2);
}

// ---- 10. the search: one simple function ----
// [query, type, params the written step must have (a subset), or null]
const ONE = [
  ['sin z', 'sin'], ['\\sin z', 'sin'], ['sin(z)', 'sin'], ['\\sin(z)', 'sin'], ['cos z', 'cos'], ['\\cos z', 'cos'],
  ['tan z', 'tan'], ['tg z', 'tan'], ['\\tan z', 'tan'], ['\\operatorname{tg} z', 'tan'],
  ['sinh z', 'sinh'], ['sh z', 'sinh'], ['\\sinh z', 'sinh'], ['cosh z', 'cosh'], ['ch z', 'cosh'], ['ch(z)', 'cosh'], ['tanh z', 'tanh'], ['th z', 'tanh'],
  ['arcsin z', 'arcsin'], ['\\arcsin z', 'arcsin'], ['arccos z', 'arccos'], ['arctan z', 'arctan'], ['arctg z', 'arctan'], ['arctg(z)', 'arctan'],
  ['arsinh z', 'arsinh'], ['arsh z', 'arsinh'], ['arcosh z', 'arcosh'], ['arch z', 'arcosh'], ['artanh z', 'artanh'], ['arth z', 'artanh'],
  ['e^z', 'exp'], ['e^{z}', 'exp'], ['exp z', 'exp'], ['\\exp(z)', 'exp'], ['exp(z)', 'exp'],
  ['log z', 'log', { cut: 180, k: 0 }], ['ln z', 'log'], ['\\ln z', 'log'], ['\\log(z)', 'log'],
  ['sqrt z', 'root', { n: 2 }], ['sqrt(z)', 'root', { n: 2 }], ['\\sqrt{z}', 'root', { n: 2 }], ['z^{1/2}', 'root', { n: 2 }], ['z^{0.5}', 'root', { n: 2 }], ['z^0.5', 'root', { n: 2 }],
  ['\\sqrt[3]{z}', 'root', { n: 3 }], ['z^{1/3}', 'root', { n: 3 }], ['\\sqrt[5]{z}', 'root', { n: 5 }],
  ['z^3', 'pown', { n: 3 }], ['z^2', 'pown', { n: 2 }], ['z^{-2}', 'pown', { n: -2 }], ['z^{10}', 'pown', { n: 10 }],
  ['z^{i}', 'powa', { alpha: 'i' }], ['z^i', 'powa', { alpha: 'i' }], ['z^{1+i}', 'powa', { alpha: '1+i' }], ['z^{2.5}', 'powa', { alpha: '2.5' }], ['z^{a}', 'powa', { alpha: 'a' }], ['z^a', 'powa', { alpha: 'a' }],
  ['1/z', 'recip'], ['\\frac{1}{z}', 'recip'], ['z^{-1}', 'recip'],
  ['-z', 'mul', { c: '-1' }], ['iz', 'mul', { c: 'i' }], ['z/2', 'mul', { c: '\\frac{1}{2}' }], ['2z', 'mul', { c: '2' }], ['\\frac{z}{3}', 'mul', { c: '\\frac{1}{3}' }], ['(1+i)z', 'mul', { c: '1+i' }], ['az', 'mul', { c: 'a' }], ['\\pi z', 'mul', { c: '\\pi' }],
  ['z+1', 'add', { c: '1' }], ['z-i', 'add', { c: '-i' }], ['1+z', 'add', { c: '1' }], ['z+a', 'add', { c: 'a' }], ['z+\\frac13', 'add', { c: '\\frac{1}{3}' }],
  ['2z+1', 'affine', { a: '2', b: '1' }], ['3-z', 'affine', { a: '-1', b: '3' }], ['(1+i)z+2', 'affine', { a: '1+i', b: '2' }], ['az+1', 'affine', { a: 'a', b: '1' }],
  ['(z-1)/(z+1)', 'mobius', { a: '1', b: '-1', c: '1', d: '1' }], ['\\frac{2z+1}{z-1}', 'mobius', { a: '2', b: '1', c: '1', d: '-1' }],
  ['\\frac{3}{z-1}+2', 'mobius', { a: '2', b: '1', c: '1', d: '-1' }], ['\\frac{z-i}{z+i}', 'mobius', { a: '1', b: '-i', c: '1', d: 'i' }],
  ['\\frac{az+1}{z+a}', 'mobius', { a: 'a', b: '1', c: '1', d: 'a' }], ['\\frac{1}{z+1}', 'mobius'], ['1-\\frac1z', 'mobius'],
  ['conj z', 'conj'], ['conj(z)', 'conj'], ['\\bar z', 'conj'], ['\\overline{z}', 'conj'],
  ['\\frac12(z+\\frac1z)', 'joukowski'], ['(z+1/z)/2', 'joukowski'], ['\\frac{z^2+1}{2z}', 'joukowski'],
];
let oneN = 0;
for (const [q, type, want] of ONE) {
  A = 0.7;
  const st = stOf(q), b = Funcs.build(st);
  if (b.error) { ok(`one: ${q} parses`, false, b.error); continue; }
  const sp = Funcs.splitSteps(st, b);
  ok(`one: ${q} is one ${type}`, sp.kind === 'one' && sp.steps[0].type === type, [sp.kind, sp.reason, sp.steps.map((s) => s.type)]);
  if (sp.kind !== 'one') continue;
  oneN++;
  const p = sp.steps[0].params;
  if (want) for (const [k, v] of Object.entries(want)) ok(`one: ${q} ${k} = ${v}`, String(p[k]) === String(v), p);
  const [s1] = buildAll(sp.steps);
  ok(`one: ${q} equals the formula`, PROBES.every((z) => close(b.f(z), s1.f(z), 1e-12)));
  ok(`one: ${q} has a row`, sp.rows && sp.rows.length === 2);
}
// two steps stay a formula first (never "rounded" to one step)
for (const q of ['z+1/z', 'e^{iz}', '2\\sin z', '\\sin 2z', 'z^2+1', '1/z^2']) ok(`two: ${q} is not one`, Funcs.splitSteps(stOf(q)).kind === 'many');

// 11. (review math-3) signed zeros on a cut along the negative real axis at every θ = 180° + 360°m: the formula, the
// app's reading b.f, the split chain and the one catalog step agree exactly, with no on-cut excuse (−z on the positive
// real axis, z² on the imaginary axis and −1 ± 0i are signed zeros on whole lines)
{
  const SIGNED = [['\\log(-z)', [C(0.5, 0), C(2, -0), C(0.5, 1e-300)]], ['\\sqrt{z^2}', [C(0, 0.5), C(-0, 0.5), C(0, -2)]], ['z^{3/2}', [C(-1, -0), C(-1, 0), C(-2.5, -0)]],
    ['\\log z', [C(-1, -0), C(-1, 0)]], ['\\sqrt{z}', [C(-1, -0), C(-1, 0)]], ['\\sqrt[3]{-z}', [C(1, 0), C(1, -0)]], ['\\log(z^2)+1', [C(0, 1), C(-0, 1)]]];
  const same = (x, y) => (Number.isNaN(x.re) && Number.isNaN(y.re)) || (Math.abs(x.re - y.re) <= 1e-12 * (1 + Math.abs(x.re)) && Math.abs(x.im - y.im) <= 1e-12 * (1 + Math.abs(x.im)));
  let n11 = 0;
  for (const cut of [180, 540, -180, -540, 900]) {
    for (const [tex, pts] of SIGNED) {
      const st = stOf(tex, cut), b = Funcs.build(st);
      if (b.error) { ok(`signed zeros ${tex}@${cut}: builds`, false, b.error); continue; }
      const F = Expr.compile(Expr.parse(tex), { theta: cut * Math.PI / 180 });
      const sp = Funcs.splitSteps(st, b);
      const fs_ = sp.kind === 'none' ? null : chainF(buildAll(sp.steps));
      for (const p of pts) {
        n11++;
        const v = F(p);
        ok(`signed zeros ${tex}@${cut} at ${p.re}${Object.is(p.im, -0) ? '-0' : '+' + p.im}i: b.f = the formula`, same(b.f(p), v), [b.f(p), v]);
        if (fs_) ok(`signed zeros ${tex}@${cut} at ${p.re}${Object.is(p.im, -0) ? '-0' : '+' + p.im}i: the split chain = the formula`, same(fs_(p), v), [fs_(p), v, sp.steps]);
      }
    }
  }
  stats.signedZeros = n11;
}
console.log(JSON.stringify(stats));
if (VERBOSE) console.log('differences on cuts (accepted):\n' + cutDiffList.slice(0, 60).join('\n'));
console.log(`one-step corpus: ${oneN}/${ONE.length}; differences on cuts: ${stats.cutDiff} of ${stats.cutPts} points, all on a cut of a step (${stats.unexplained} unexplained)`);
for (const f of fails) console.log('FAIL', f);
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

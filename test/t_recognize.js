// Formula recognition (src/recognize.js, notes/formula-recognition/DESIGN.md) over the audit corpus
// (notes/formula-recognition/tools/corpus_src.js), each formula in LaTeX and, where the audit has one, in plain text:
//  - the recognized chain gives the formula's own values (Expr.compile on the formula's cut) at random points, at pairs
//    1e-7 either side of the axes, the unit circle and every cut the step draws, exactly on those cuts, at its poles
//    and at special points, on the cuts 180°, 90° and -120°, and with the shared number a at several values;
//  - the LaTeX and plain spellings give the same chain, the same values and one GPU program key;
//  - the traps keep their branches (sqrt(z^2) is not z, log(e^z) is not z, ...), identities that would move a cut
//    are refused, and a removable point is never filled in;
//  - a shared exponent or root index keeps one chain and one program key at every value (integers included);
//  - the review fixes (notes/formula-recognition/ledger.json): the step's CPU values are the formula's bit for bit
//    (signed zeros on the cuts, raw cut angles, overflow), the groups replay it exactly, merged Möbius runs never fill a
//    removable point, a shared number never changes the chain's shape, decimal cancellations are not read as a lower
//    degree, and factored products are read in product form;
//  - the verifier's findings (review-verify.json): on every cut the seam can be dragged to (-180, 270, 540, ...), the
//    deformation runs into the formula's own values, branch included, and is continuous where its steps join; a
//    removable point inside a sub-term is never filled in; Horner readings are well conditioned; GPU keys are raw.
// node test/t_recognize.js [-v]
const path = require('path');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
global.GLChain = require(R + '/src/glsl.js');
const C = CX.C;
const VERBOSE = process.argv.includes('-v');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
let corpus = [];
try { corpus = require(path.join(R, 'notes/formula-recognition/tools/corpus_src.js')); } catch (e) { console.log('corpus not found (notes/formula-recognition): only the built-in cases run'); }
// the audit's plain spellings (tools/analyze.js) and its five extra formulas
const PLAIN = {
  exp6: 'e^(i*z)', exp7: 'e^(2z+1)', exp12: 'e^(z^2)', exp13: 'e^(1/z)', exp15: 'e^(a*z)', log6: 'log(z-1)', log2: 'ln z', log9: 'log(z^2)',
  pow1: 'z^2', pow7: 'z^(1/2)', pow10: 'z^(1/3)', pow12: 'z^i', pow14: 'z^a', pow13: 'z^2.5', pow20: '(z+1)^1.5', pow15: 'sqrt(z^2)',
  mob3: '(z-i)/(z+i)', mob5: '(1+z)/(1-z)', mob7: '(a*z+1)/(z+a)', jk1: '(z+1/z)/2', jk4: '(z^2+1)/(2z)', rat2: '(z-1)*(z+1)', rat4: '(z^2-1)/(z^2+1)',
  tr4: 'sin(2z)', tr6: 'cos(z)/2', tr7: 'tan(z/2)', tr9: 'tg z', tr18: 'sin(e^z)', tr19: 'cos(log z)', hy1: 'sinh(z)', hy4: 'sh z', hy5: 'ch(z)', hy6: 'th z',
  it1: 'arcsin(z)', it4: 'arctg(z)', log15: 'log(sin z)', mi16: '1/(1+e^(-z))', tr21: 'sin(z)+z', exp24: 'z*e^z',
  pow25: 'z^(1+i)', pow26: 'z^(0.5+2i)', pow27: 'z^(a+i)', pow28: 'z^0.5',
};
const EXTRA = [['pow25', 'z^{1+i}'], ['pow26', 'z^{0.5+2i}'], ['pow27', 'z^{a+i}'], ['pow28', 'z^{0.5}'], ['mob15', '\\frac{az+b}{cz+d}'],
  ['x1', '\\frac{1}{2i}\\log\\frac{1+iz}{1-iz}'], ['x2', 'e^{\\sin z+z}'], ['x3', '\\left|e^{z}\\right|'], ['x4', '\\log(z^3-z)'], ['x5', '\\sqrt{z}\\sqrt{z}'],
  ['x6', 'z-\\frac{1}{z}'], ['x7', '\\frac{z^2+3z+1}{z+2}'], ['x8', '\\cos z-\\sin z'], ['x9', '\\frac{\\cosh z}{\\sinh z}'], ['x10', '\\exp(2z)\\exp(-z)'],
  ['x11', '\\log(1+z^2)-\\log(1-z^2)'], ['x12', '\\frac{1}{2}\\left(\\log(1+z)-\\log(1-z)\\right)'], ['x13', 'z^{4097}'], ['x14', '\\sqrt[a]{z}'], ['x15', '(2z)^{a}'],
  ['x16', '3^{iz}'], ['x17', '\\sqrt{1-z^2}'], ['x18', '\\frac{2}{z^2}'], ['x19', 'z^{-2}+1'], ['x20', 'e^{z}\\cdot e^{iz}']];
const all = corpus.map((e) => ({ id: e.id, tex: e.tex, kind: e.kind })).concat(EXTRA.map(([id, tex]) => ({ id, tex, kind: 'extra' })));
for (const e of all) e.plain = PLAIN[e.id] || null;

let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const BASE = [];
for (let i = 0; i < 500; i++) BASE.push(C((rnd() * 2 - 1) * 3.2, (rnd() * 2 - 1) * 3.2));
for (const x of [-2.7, -1.6, -1, -0.9, -0.3, 0.4, 1, 1.3, 2.2]) for (const s of [1, -1]) { BASE.push(C(x, s * 1e-7)); BASE.push(C(s * 1e-7, x)); }
for (const x of [-2.5, -1, -0.5, 0, 0.5, 1, 2.5]) { BASE.push(C(x, 0)); BASE.push(C(0, x)); BASE.push(C(x, -0)); BASE.push(C(-0, x)); }
for (let k = 0; k < 24; k++) { const t = (k + 0.37) * Math.PI / 12; for (const r of [1 - 1e-7, 1, 1 + 1e-7]) BASE.push(C(r * Math.cos(t), r * Math.sin(t))); }
for (const p of [C(1, 1), C(1, -1), C(-1, 1), C(-1, -1), C(Math.PI / 2, 0), C(-Math.PI / 2, 0), C(Math.PI, 0), C(0, Math.PI / 2), C(2, 0), C(-2, 0), C(0, 2), C(0, -2)]) BASE.push(p);
// points 1e-7 either side of, and exactly on, every cut the step draws in its input plane; its poles
function cutPoints(b) {
  const out = [];
  for (const c of b.cuts || []) {
    if (c.kind === 'ray') {
      const d = C(Math.cos(c.ang), Math.sin(c.ang)), nrm = C(-d.im, d.re);
      for (const r of [0.05, 0.3, 0.9, 1.7, 2.6]) {
        const q = CX.add(c.p, CX.scale(d, r));
        out.push(q, CX.add(q, CX.scale(nrm, 1e-7)), CX.sub(q, CX.scale(nrm, 1e-7)));
      }
    } else if (c.kind === 'seg') {
      const d = CX.sub(c.b, c.a), u = CX.scale(d, 1 / CX.abs(d)), nrm = C(-u.im, u.re);
      for (const s of [0.1, 0.35, 0.6, 0.9]) {
        const q = CX.add(c.a, CX.scale(d, s));
        out.push(q, CX.add(q, CX.scale(nrm, 1e-7)), CX.sub(q, CX.scale(nrm, 1e-7)));
      }
    }
  }
  for (const p of b.poles || []) out.push(p, CX.add(p, C(1e-6, 0)), CX.add(p, C(0, -1e-6)));
  return out;
}
// the formula's own values versus the chain's: both undefined, or within rounding
function compare(f, g, pts) {
  let n = 0, bad = 0, max = 0; const where = [];
  for (const p of pts) {
    const u = f(p), v = g(p), fu = CX.isFin(u), fv = CX.isFin(v);
    if (!fu && !fv) continue;
    n++;
    if (fu !== fv) {
      // at a pole one side may round to a huge finite value
      if (Math.max(fu ? CX.abs(u) : 0, fv ? CX.abs(v) : 0) > 1e13) continue;
      bad++; if (where.length < 3) where.push(CX.fmt(p, 9) + (fu ? ' chain undefined' : ' formula undefined')); continue;
    }
    const e = CX.abs(CX.sub(u, v)) / (1 + CX.abs(u));
    if (e > max) max = e;
    if (e > 1e-9) { bad++; if (where.length < 3) where.push(`${CX.fmt(p, 9)}: ${CX.fmt(u, 6)} vs ${CX.fmt(v, 6)}`); }
  }
  return { n, bad, max, where };
}
// exactly equal (both NaN counts as equal), or the first point where not
const same0 = (x, y) => (Number.isNaN(x) && Number.isNaN(y)) || Object.is(x, y);
function exactDiff(f, g, pts) {
  for (const p of pts) { const u = f(p), v = g(p); if (!same0(u.re, v.re) || !same0(u.im, v.im)) return `${CX.fmt(p, 9)}: ${CX.fmt(u, 9)} vs ${CX.fmt(v, 9)}`; }
  return null;
}
const groupsF = (b) => (z) => { for (const g of b.rec.groups) z = g.f(z); return z; };
// a point exactly on a ray or segment cut the step draws
function onCut(b, p) {
  for (const c of b.cuts || []) {
    if (c.kind !== 'ray') continue;
    const d = CX.sub(p, c.p);
    if (CX.abs(d) > 0 && Math.abs(Math.atan2(d.im, d.re) - Math.atan2(Math.sin(c.ang), Math.cos(c.ang))) < 1e-12) return true;
  }
  return false;
}
const build = (expr, cut = 180) => Funcs.build({ type: 'custom', params: { expr, cut }, on: true });
const chainSig = (b) => (b.rec ? b.rec.built.map((x) => x.def.id).join('>') : null);
const valsEq = (b1, b2) => {
  if (!b1.rec || !b2.rec || b1.rec.built.length !== b2.rec.built.length) return !b1.rec && !b2.rec;
  return b1.rec.built.every((x, i) => JSON.stringify(x.vals, (k, v) => (k === 'ast' ? undefined : v)) === JSON.stringify(b2.rec.built[i].vals, (k, v) => (k === 'ast' ? undefined : v)));
};
const glKey = (b) => { try { return GLChain.build([{ type: 'custom', on: true }], [b]).key; } catch (e) { return 'ERR ' + e.message; } };

let fails = 0;
const fail = (msg) => { fails++; console.log('FAIL', msg); };
const stats = { formulas: 0, spellings: 0, recognized: 0, partial: 0, inverse: 0, inverseBefore: 0, points: 0 };
const kinds = {};
// with Recognize hidden: the formula as it was (for the "inverse before" count)
const without = (fn) => { const R0 = global.Recognize; global.Recognize = undefined; try { return fn(); } finally { global.Recognize = R0; } };

for (const e of all) {
  for (const [spell, text] of [['tex', e.tex], ['plain', e.plain]]) {
    if (!text) continue;
    for (const cut of [180, 90, -120]) {
      const b = build(text, cut);
      if (b.error) { if (cut === 180 && spell === 'tex' && e.id !== 'mob15') fail(`${e.id} ${text}: build error ${b.error}`); continue; }
      if (cut === 180) {
        stats.spellings++;
        if (spell === 'tex') stats.formulas++;
        if (b.rec) { stats.recognized++; if (b.rec.partial) stats.partial++; }
        if (Inverse.stepOps(b).ok) stats.inverse++;
        if (without(() => Inverse.stepOps(build(text, cut)).ok)) stats.inverseBefore++;
        const k = kinds[e.kind] || (kinds[e.kind] = { n: 0, rec: 0 });
        if (spell === 'tex') { k.n++; if (b.rec) k.rec++; }
      }
      if (!b.rec) continue;
      const ast = Expr.parse(text);
      const fFormula = Expr.compile(ast, { theta: cut * Math.PI / 180 });
      const pts = BASE.concat(cutPoints(b));
      // the step's CPU values are the formula's, bit for bit; so is the composition of the groups (the formula's pieces)
      const bad = exactDiff(fFormula, b.f, pts) || exactDiff(fFormula, groupsF(b), pts);
      if (bad) fail(`${e.id} [${spell}] ${text} cut ${cut}: CPU values are not the formula's at ${bad}`);
      // the catalog chain (the GPU plan and the inverse ops) gives the formula's values, within rounding, off the
      // points exactly on a cut (where the catalog steps may take the other signed zero)
      const r = compare(fFormula, b.rec.fc, pts.filter((p) => p.re !== 0 && p.im !== 0 && !onCut(b, p)));
      stats.points += r.n;
      if (r.bad) fail(`${e.id} [${spell}] ${text} cut ${cut}: ${chainSig(b)}: ${r.bad}/${r.n} values differ, e.g. ${r.where.join('; ')}`);
      // the natural path ends where it should
      const z = C(0.31, -0.77), h0 = b.hom(0)(z), h1 = b.hom(1)(z), fz = b.f(z);
      if (CX.abs(CX.sub(h0, z)) > 1e-12 || (CX.isFin(fz) && CX.abs(CX.sub(h1, fz)) > 1e-9 * (1 + CX.abs(fz)))) fail(`${e.id} ${text}: homotopy ends`);
      // the homotopy is continuous at the steps' joins (t = j/n)
      const n = b.rec.built.length;
      for (let j = 1; j < n; j++) {
        const lo = b.hom(j / n - 1e-9)(z), hi = b.hom(j / n + 1e-9)(z);
        if (CX.isFin(lo) && CX.isFin(hi) && CX.abs(CX.sub(lo, hi)) > 1e-5 * (1 + CX.abs(lo))) fail(`${e.id} ${text}: homotopy jumps at t = ${j}/${n}`);
      }
      if (VERBOSE && cut === 180) console.log(`${e.id.padEnd(6)} ${spell.padEnd(5)} ${text.padEnd(36)} ${(b.rec.partial ? 'partial ' : '') + chainSig(b)}  ops ${Inverse.stepOps(b).ok ? Inverse.stepOps(b).ops.map((o) => o.kind).join('+') : 'forward'}  max ${r.max.toExponential(1)}`);
    }
  }
  // LaTeX and plain: the same chain, the same values, one program
  if (e.plain) {
    const b1 = build(e.tex), b2 = build(e.plain);
    if (!b1.error && !b2.error) {
      if (chainSig(b1) !== chainSig(b2) || !valsEq(b1, b2)) fail(`${e.id}: ${e.tex} -> ${chainSig(b1)} but ${e.plain} -> ${chainSig(b2)}`);
      const r = compare(b1.f, b2.f, BASE);
      if (r.bad) fail(`${e.id}: spellings differ in value: ${r.where.join('; ')}`);
      // one program, unless the two trees differ and have multivalued pieces (the sheet view compiles the formula's
      // own tree: z^(1/3) and \sqrt[3]{z} differ there, as before recognition)
      const sameTree = JSON.stringify(Expr.parse(e.tex), (k, v) => (['pos', 'len', 'lit', 's', 'name'].includes(k) ? undefined : v)) === JSON.stringify(Expr.parse(e.plain), (k, v) => (['pos', 'len', 'lit', 's', 'name'].includes(k) ? undefined : v));
      if (glKey(b1) !== glKey(b2) && (sameTree || b1.rec)) fail(`${e.id}: spellings compile different programs`);
      if (glKey(b1) !== glKey(b2)) stats.keyDiff = (stats.keyDiff || []).concat(e.id);
      if (Inverse.inverseKey([{ on: true }], [b1]) !== Inverse.inverseKey([{ on: true }], [b2])) fail(`${e.id}: spellings take different inverse ops`);
    }
  }
}

// ---- the traps: the chain is what the formula says, never the simpler-looking map ----
const expect = (text, sig, cut = 180, orNull = false) => { const b = build(text, cut); if (chainSig(b) !== sig && !(orNull && !b.rec)) fail(`${text} (cut ${cut}): expected ${sig}, got ${chainSig(b)}`); return b; };
expect('\\sqrt{z^2}', 'pown>root');
expect('(z^2)^{1/2}', 'pown>root');
expect('\\log(z^2)', 'pown>log');
expect('\\log(e^{z})', 'exp>log');
expect('\\arcsin(\\sin z)', 'sin>arcsin');
expect('e^{\\log z}', 'log>exp');
expect('\\left(\\sqrt{z}\\right)^2', 'root>pown');
expect('\\sqrt{z}\\sqrt{z}', null);                    // z twice through roots: not rewritten
expect('\\sqrt{z-1}\\sqrt{z+1}', null);
expect('\\log z+\\log(z-1)', null);                    // not log(z(z-1))
expect('\\frac{(z-1)^3}{(z-1)^2(z+2)}', null);         // a removable point at 1: never filled in
expect('\\frac{z^2-1}{z-1}', null);
expect('\\log(1+z)-\\log(1-z)', 'artanh>mul');         // CX.atanh's own formula on the principal cut
expect('\\log(1+z)-\\log(1-z)', null, 90);             // another cut: the logs are not artanh's
expect('\\log\\left(z+\\sqrt{z^2+1}\\right)', 'custom>log');  // the textbook arsinh: never rewritten to arsinh (not proved on its cuts); only its outer log is read
expect('z', null); expect('z^{1}', null); expect('\\sin z+z', null); expect('\\left|z\\right|', null);
expect('\\sin(0z)', null);                             // constant
// the user's case: z^{complex} in LaTeX and plain, and the catalog step: one function, one branch, one path
for (const [t1, t2, al] of [['z^{i}', 'z^i', C(0, 1)], ['z^{1+i}', 'z^(1+i)', C(1, 1)], ['z^{0.5+2i}', 'z^(0.5+2i)', C(0.5, 2)]]) {
  for (const cut of [180, 90, -45]) {
    const b1 = build(t1, cut), b2 = build(t2, cut), k = Funcs.build({ type: 'powa', params: { alpha: CX.fmtExact(al), cut, k: 0 }, on: true });
    if (chainSig(b1) !== 'powa' || chainSig(b2) !== 'powa') { fail(`${t1}: not the complex power step`); continue; }
    const pts = BASE.concat(cutPoints(k));
    const r = compare(k.f, b1.f, pts);
    if (r.bad) fail(`${t1} cut ${cut}: differs from the catalog step: ${r.where.join('; ')}`);
    for (const t of [0.25, 0.5, 0.75]) {
      const rh = compare(k.hom(t), b1.hom(t), BASE);
      if (rh.bad) fail(`${t1} cut ${cut}: deformation at t = ${t} differs from the catalog step's: ${rh.where.join('; ')}`);
    }
    if (b1.cuts.length !== 1 || !b1.cuts[0].editable || Math.abs(b1.cuts[0].ang - cut * Math.PI / 180) > 1e-12) fail(`${t1} cut ${cut}: the cut is not drawn as the catalog step's`);
    if (glKey(b1) !== glKey(b2)) fail(`${t1}: LaTeX and plain compile different programs`);
    if (Inverse.inverseKey([{ on: true }], [b1]) !== Inverse.inverseKey([{ on: true }], [k])) fail(`${t1}: other inverse ops than the catalog step`);
    for (const key of Funcs.PROP_KEYS) if (!!b1.props[key] !== !!k.props[key] && k.props[key]) fail(`${t1}: lamp ${key} missing`);
  }
}
// a shared exponent: one chain and one program at every value, integers included; the values follow the formula
{
  const keys = new Set(), invKeys = new Set();
  for (const a of [0.5, 0.7, 0.99, 1, 1.5, 2, 3, -1, -2.5]) {
    A = a;
    for (const t of ['z^{a}', 'z^{a+i}', '(2z)^{a}', '\\sqrt[a]{z}']) {
      const b = build(t);
      if (a === 0 && t === 'z^{a}') continue;
      if (!b.rec) { fail(`${t} at a = ${a}: not recognized`); continue; }
      if (t === 'z^{a}') { keys.add(glKey(b)); invKeys.add(Inverse.inverseKey([{ on: true }], [b])); }
      const r = compare(Expr.compile(Expr.parse(t)), b.f, BASE.concat(cutPoints(b)));
      if (r.bad) fail(`${t} at a = ${a}: ${r.where.join('; ')}`);
    }
    const m = build('\\frac{az+1}{z+a}');
    if (Math.abs(a) === 1) { if (m.rec) fail('(az+1)/(z+a) at a = ±1 is constant: must not be recognized'); }
    else {
      if (chainSig(m) !== 'mobius') fail(`(az+1)/(z+a) at a = ${a}: ${chainSig(m)}`);
      const r = compare(Expr.compile(Expr.parse('\\frac{az+1}{z+a}')), m.f, BASE.concat([C(-a, 0), C(-1 / a, 0)]));
      if (r.bad) fail(`(az+1)/(z+a) at a = ${a}: ${r.where.join('; ')}`);
    }
  }
  if (keys.size !== 1) fail(`z^{a}: ${keys.size} GPU programs over the values of a (one expected)`);
  if (invKeys.size !== 1) fail(`z^{a}: ${invKeys.size} inverse plans over the values of a (one expected)`);
  A = 0;
  if (build('\\sin(az)').rec) fail('sin(az) at a = 0 is constant: must not be recognized');
  A = 0.7;
}
// saved state is untouched: the step's params are the user's text; its TeX is the formula's
{
  const st = { type: 'custom', params: { expr: 'e^{2z+1}', cut: 180 }, on: true };
  const b = Funcs.build(st);
  if (st.params.expr !== 'e^{2z+1}' || Object.keys(st.params).join() !== 'expr,cut') fail('recognition changed the step params');
  if (b.tex({ s: 'z', p: 4 }).s !== Expr.toTex(Expr.parse('e^{2z+1}')).s) fail('the TeX is not the formula\'s');
  if (JSON.stringify(st).includes('rec')) fail('recognition leaked into saved state');
}
// the sheet view is the chain's (its pieces, on local cuts, every sheet: as the catalog chain); d/dz stays the formula's
{
  const b = build('\\sqrt{z}+1');
  if (Funcs.stepSheets(b).length !== 1) fail('sqrt z + 1: the sheet view lost the root');
  if (Funcs.derivAst(b).error) fail('sqrt z + 1: no derivative');
  for (const [t, cat] of [['\\sqrt{z}+1', [['root', { n: 2 }], ['add', { c: '1' }]]], ['\\log(2z)', [['mul', { c: '2' }], ['log', {}]]], ['e^{\\sin z+z}', null], ['\\log(\\log z)', [['log', {}], ['log', {}]]]]) {
    const bf = build(t), on = [{ on: true }];
    const nb = Funcs.sheetCombos(on, [bf], 2, 1, Infinity);
    for (let combo = 0; combo < Math.min(nb, 30); combo++) for (const [zc, z] of [[C(0.4, 0.9), C(0.45, 0.85)], [C(-1.2, 0.1), C(-1.25, -0.05)], [C(0.7, -1.4), C(0.6, -1.3)]]) {
      const v = Funcs.sheetEval(on, [bf], 1, zc, z, combo, 2);
      if (cat) {
        const steps = cat.map(([type, p]) => ({ type, params: Object.assign(Funcs.defaults(type), p), on: true }));
        const w = Funcs.sheetEval(steps, steps.map(Funcs.build), steps.length, zc, z, combo, 2);
        if (CX.isFin(v) !== CX.isFin(w) || (CX.isFin(v) && CX.abs(CX.sub(v, w)) > 1e-12 * (1 + CX.abs(w)))) fail(`${t}: sheet ${combo} differs from the catalog chain's`);
      } else if (!CX.isFin(v) && combo === 0) fail(`${t}: sheet view undefined`);
    }
  }
}

// The deformation runs into the formula's own values (b.f), branch included, as t -> 1 (t = 1 - 1e-12), and is
// continuous where its steps join (t = j/n). Skipped: points where a step's input is a branch point of that step (0 for
// log, root and powers, ±1 or ±i for the inverse trigonometric steps: the function is infinite or not analytic there
// and its path converges only logarithmically), and the end of a formula part (a 'custom' step): its natural path is the
// formula's zoom path, which approaches a point on its cut from the side of its centre, as v15 does for any formula.
// Distances are chordal (on the Riemann sphere), so a point near a pole, where the path converges in the chordal sense
// (pown(-2)'s elliptic Möbius part near 0), is not mistaken for a branch error.
const chordal = (u, v) => CX.abs(CX.sub(u, v)) / (Math.sqrt(1 + CX.abs2(u)) * Math.sqrt(1 + CX.abs2(v)));
function homEnds(b, pts) {
  const n = b.rec.built.length, H = b.hom(1 - 1e-12);
  for (const p of pts) {
    let w = p, sing = false;
    for (const sb of b.rec.built) {
      for (const c of sb.cuts || []) if (c.kind === 'ray' && CX.abs(CX.sub(w, c.p)) <= 1e-9 * (1 + CX.abs(c.p))) sing = true;
      w = sb.f(w);
    }
    if (sing) continue;
    const u = b.f(p), v = H(p);
    if (b.rec.built[n - 1].def.id !== 'custom' && CX.isFin(u) && CX.isFin(v) && chordal(u, v) > 1e-4) return `the deformation ends on the other branch at ${CX.fmt(p, 3)}: ${CX.fmt(v, 6)} vs ${CX.fmt(u, 6)}`;
    for (let j = 1; j < n; j++) {
      if (b.rec.built[j - 1].def.id === 'custom') continue;
      const lo = b.hom(j / n - 1e-12)(p), hi = b.hom(j / n)(p);
      if (CX.isFin(lo) && CX.isFin(hi) && chordal(lo, hi) > 1e-4) return `the deformation jumps at t = ${j}/${n} at ${CX.fmt(p, 3)}: ${CX.fmt(lo, 6)} then ${CX.fmt(hi, 6)}`;
    }
  }
  return null;
}
// ---- review math-1, math-2: signed zeros and raw cut angles; the deformation ends on the formula's side of its cut ----
{
  const pts = [];
  for (const x of [-2.5, -2, -1, -0.5, 0.5, 1, 2, 2.5]) for (const s of [0, -0]) { pts.push(C(x, s)); pts.push(C(s, x)); }
  const cases = [['\\log(-z)', 180], ['\\sqrt{-z}', 180], ['(-z)^{i}', 180], ['\\sqrt{-z^2}', 180], ['\\log(-z^2)', 180], ['\\sqrt{-1-z}', 180],
    ['\\sqrt{-(z-1)}', 180], ['\\log(-\\frac{z}{2})', 180], ['\\log(\\frac{z}{2})', 180], ['\\sqrt{2z-1}', 180], ['\\sqrt{(z+(-1))+z}', 180],
    ['\\log z', -180], ['\\sqrt{z}', -180], ['z^{i}', -180], ['\\sqrt{z}', 540], ['\\log z', 270], ['\\sqrt{z}', 360], ['\\sqrt[3]{\\frac{z}{z}}', 360],
    ['\\sqrt{\\cot(\\sin(z)\\cos(z))}', 270], ['\\sin(\\sqrt[3]{\\sqrt{z}})', -180], ['3-\\operatorname{artanh}(z^{2.5})', 540],
    // review verify-1: cuts beyond (-180, 180] (the seam is unwrapped), and cut steps inside a group
    ['\\log(-z)', 540], ['\\sqrt{-z}', 540], ['\\log(-z^3)', -180], ['\\log(-z)', -180], ['\\sqrt{-z}', -180], ['\\log(-z^3)', 540],
    ['\\log z', 540], ['\\log z', -540], ['\\sqrt{z}', 900], ['(-z)^{i}', 540], ['\\log(-z^2)', 270], ['\\sqrt{-z}', 190.5],
    ['\\log(z+1-1)', 180], ['\\log(z+1-1)', 540], ['\\sqrt{2\\cdot\\frac{z}{2}}', 180], ['\\sqrt{2\\cdot\\frac{z}{2}}', -180],
    ['\\sin(\\sqrt{-z})+\\cos(\\sqrt{-z})', 180], ['\\sin(\\sqrt{-z})+\\cos(\\sqrt{-z})', 540],
    ['\\frac{\\sin(\\log(-z))}{\\cos(\\log(-z))}', 180], ['\\sin(\\log(-z))\\cos(\\log(-z))', -180], ['e^{\\log(-z)}+e^{-\\log(-z)}', 540]];
  for (const [t, cut] of cases) {
    const b = build(t, cut), f = Expr.compile(Expr.parse(t), { theta: cut * Math.PI / 180 });
    if (!b.rec) { fail(`${t} (cut ${cut}): not recognized`); continue; }
    const q = pts.concat([C(-1.9489676323481684, -2.298996875667477), C(2.169822686896577, 0.20989867076738689)]);
    const bad = exactDiff(f, b.f, q) || exactDiff(f, groupsF(b), q);
    if (bad) fail(`${t} (cut ${cut}): CPU values not the formula's at ${bad}`);
    // the deformation runs into the formula's value from the formula's side of its cut, on every cut angle (review
    // verify-1: a cut step takes the formula's own input and evaluates on the formula's raw θ, sheet 0)
    const bad2 = homEnds(b, q);
    if (bad2) fail(`${t} (cut ${cut}): ${bad2}`);
  }
}
// ---- review math-3: a merged Möbius run never fills a removable point, and never adds lamps the formula lacks ----
for (const t of ['\\sin(\\frac{1}{\\frac{1}{z}})', '\\sqrt{\\frac{1}{\\frac{1}{z}}}', 'e^{\\frac{1}{1/z+1}}', '\\frac{1}{\\cot z}']) expect(t, null);
for (const [t, p] of [['\\operatorname{arsinh}(\\frac{2-i}{\\operatorname{artanh}(z)})', C(-1, 0)], ['\\coth((2-i)-\\operatorname{artanh}(z))', C(-1, 0)]]) {
  const b = build(t);
  if (exactDiff(Expr.compile(Expr.parse(t)), b.f, [p])) fail(`${t}: CPU value at ${CX.fmt(p, 3)} is not the formula's`);
}
// ---- review math-4: identities keep the formula's own CPU values where its spelling overflows ----
for (const [t, p] of [['\\frac{\\sin(e^{z})}{\\cos(e^{z})}', C(7, 1)], ['e^{3z}e^{-2z}', C(240, 0.5)], ['\\sin(z)\\cos(z)', C(0.4, 710)], ['\\frac{e^{iz}-e^{-iz}}{2i}', C(0.3, 720)]]) {
  const b = build(t);
  if (!b.rec) fail(`${t}: not recognized`);
  if (exactDiff(Expr.compile(Expr.parse(t)), b.f, [p])) fail(`${t}: CPU value at ${CX.fmt(p, 3)} is not the formula's`);
}
// ---- review math-6: a decimal cancellation is not read as a lower degree ----
expect('(0.1+0.2-0.3)z^3+2z', null);
expect('(0.1+0.2-0.3)z^2+z+1', null);
expect('(z+1)^2-z^2', 'affine');                 // an exact (integer) cancellation: degree 1 in doubles too
expect('(z+1)^3-z^3', 'poly');
// ---- review frperf-3: a factored product is read in product form (zeros and poles), never expanded ----
expect('(z-1)^5(z+1)^5', 'zp');
expect('\\frac{(z+1)^{20}}{(z-1)^{20}}', 'zp');
expect('(z-1)^2(z+1)^2', 'zp');
expect('(z-1)(z+1)(z-2)', 'zp');
expect('(z-1)^4', 'add>pown');
expect('2(z-1)(z-1)', 'add>pown>mul');
expect('(z-1)(z+1)', 'pown>add');                // two simple factors: the normal form z^2 - 1, as before
expect('\\frac{(z-1)^3}{(z-1)^2(z+2)}', null);
expect('(z^2+1)^2(z-1)', null);                  // a repeated quadratic factor: the formula as typed
expect('(z^2+1)(z^2+1)', null);
// a sum or quotient that is not typed expanded is read by expanded coefficients only for degree <= 4 with separated
// roots (Horner cancels near a repeated root: z(z-1)^4 - (z-1)^4 = (z-1)^5)
expect('z(z-1)^4-(z-1)^4', null);
expect('(z-1)^2(z+2)+(z-1)^2', null);
expect('\\frac{z(z-1)^2-(z-1)^2}{z+3}', null);
expect('(z-1)^3(z+1)^3+z^6', null);
expect('(z^2+1)(z-1)+z', 'poly');
expect('z^4-4z^3+6z^2-4z+1', 'poly>add');      // typed expanded: the formula adds the same terms
expect('z^3+az^2+z', 'poly');
{
  const b = build('(z-1)^5(z+1)^5');
  for (const r of [0.1, 0.05, 0.02, 1e-3]) {
    const p = CX.add(C(1, 0), C(r * Math.cos(0.7), r * Math.sin(0.7))), u = Expr.compile(Expr.parse('(z-1)^5(z+1)^5'))(p), v = b.rec.fc(p);
    if (CX.abs(CX.sub(u, v)) > 1e-12 * CX.abs(u)) fail(`(z-1)^5(z+1)^5 near the 5-fold zero (r = ${r}): relative error ${(CX.abs(CX.sub(u, v)) / CX.abs(u)).toExponential(1)}`);
  }
}
// ---- review math-5, frperf-1, frperf-2: a shared number never changes the chain while a slider moves ----
// The GPU key is counted raw (review verify-4). keyAt: the values where the program may change, because the catalog
// step's natural path changes kind there (poly and zp take the monomial's own path, 'pow', where they are one monomial
// about a point: z^2 + az at a = 0, (z - a)^3 (z + 1) at a = -1), as for the catalog steps themselves and v15.
{
  const sweeps = [['\\frac{(z+a)^{12}}{(z-a)^{12}}', 0.5, 0.9, 'zp', []], ['\\frac{(z+a)^{8}}{(z-a)^{8}}', 0.5, 0.9, 'zp', []],
    ['z^{2}+az', -0.3, 0.3, 'poly', [], [0]], ['\\frac{z^2-a}{z+1}', 0.7, 1.3, 'affine>joukowski>affine', [1]],
    ['\\frac{az+1}{z+a}', -1.2, 1.2, 'mobius', [-1, 1]], ['\\frac{z^{a}}{z+1}', -1, 3, null, []], ['z^{a}z', -1, 3, null, []], ['z^{a}+z', -1, 3, null, []],
    ['e^{z+a}', -1, 1, 'add>exp', []], ['(z-a)^3(z+1)', -1.2, 1.2, 'zp', [], [-1]], ['e^{az}+e^{-z}', -1.5, 1.5, null, []], ['(a-0.7)z^2+z', 0.5, 0.9, 'poly', [0.7]],
    ['\\frac{z-a}{z}+z', -0.3, 0.3, 'mul>joukowski>affine', [0]]];
  for (const [t, lo, hi, sig, special, keyAt = []] of sweeps) {
    const seen = new Set(), keys = new Set();
    for (let i = Math.round(lo * 100); i <= Math.round(hi * 100); i++) {
      A = i / 100;
      const b = build(t);
      if (b.error) continue;
      const s = chainSig(b);
      if (special.includes(A)) { if (s === sig && sig) fail(`${t} at a = ${A}: the formula changes kind here, but the chain was kept`); continue; }
      seen.add(s);
      // (the catalog poly and zp steps take the monomial's own path, 'pow', at the value where they are one monomial
      // about a point: their natural path's kind, as for the catalog steps themselves and v15 without recognition)
      if (b.rec && !keyAt.includes(A)) { const k = GLChain.build([{ type: 'custom', on: true }], [b]).key; keys.add(typeof k === 'string' ? k : JSON.stringify(k)); }
      if (b.rec && exactDiff(Expr.compile(Expr.parse(t)), b.f, BASE.slice(0, 60))) fail(`${t} at a = ${A}: CPU values are not the formula's`);
    }
    if (seen.size !== 1 || [...seen][0] !== sig) fail(`${t}: chains over the slider ${[...seen].join(' | ')} (expected only ${sig})`);
    if (keys.size > 1) fail(`${t}: ${keys.size} GPU programs over the slider`);
  }
  A = 0.7;
}
// ---- review frperf-4: the reading is cached (a second build reuses the built steps) ----
{
  const b1 = build('\\frac{(z+1)^{20}}{(z-1)^{20}}'), b2 = build('\\frac{(z+1)^{20}}{(z-1)^{20}}');
  if (!b1.rec || b1.rec.built[0] !== b2.rec.built[0]) fail('a formula without shared numbers is read and built again on every rebuild');
}
// ---- review frperf-5: the note is one short clause, without parameter letters ----
{
  const b = build('\\frac{1}{2i}\\log\\frac{1+iz}{1-iz}');
  // (1/(2i) = −i/2 turns and scales: review steps-7)
  if (!/^Same as Möbius → Logarithm → Rotation and scaling$/.test(b.recNote || '')) fail(`note: ${b.recNote}`);
}

// ---- review verify-1: every cut the seam can be dragged to (it is unwrapped: -180, 270, 540, ...), the whole corpus ----
// The step's CPU values are the formula's bit for bit, and its deformation runs into them, branch included (homEnds).
{
  const pts = [];
  for (const x of [-2.5, -2, -1, -0.5, 0.5, 1, 2, 2.5]) for (const s of [0, -0]) { pts.push(C(x, s)); pts.push(C(s, x)); }
  const q = pts.concat(BASE.slice(0, 80));
  let pairs = 0;
  for (const e of all) {
    for (const text of [e.tex, e.plain]) {
      if (!text) continue;
      for (const cut of [-180, 270, 540, 360, -540, 900, 190.5, -359.9]) {
        const b = build(text, cut);
        if (b.error || !b.rec) continue;
        pairs++;
        const f = Expr.compile(Expr.parse(text), { theta: cut * Math.PI / 180 });
        const qq = q.concat(cutPoints(b));
        const bad = exactDiff(f, b.f, qq) || exactDiff(f, groupsF(b), qq);
        if (bad) fail(`verify-1 ${e.id} ${text} (cut ${cut}): CPU values are not the formula's at ${bad}`);
        const h = homEnds(b, qq);
        if (h) fail(`verify-1 ${e.id} ${text} (cut ${cut}): ${h}`);
      }
    }
  }
  if (pairs < 1000) fail(`verify-1: only ${pairs} recognized formula/cut pairs on the seam's cuts`);
  stats.seamPairs = pairs;
  // the GPU plan and the inverse ops keep the normalised (cut, sheet): the catalog steps' own values
  const b = build('\\log(-z)', 540);
  if (JSON.stringify(b.rec.built[1].vals) !== JSON.stringify({ cut: 180, k: 1 })) fail(`verify-1: the log step's (cut, k) is ${JSON.stringify(b.rec.built[1].vals)}, not (180, 1)`);
}
// ---- review verify-2: a removable point inside a sub-term is never filled in (and adds no lamps) ----
for (const t of ['z/z+z', '\\frac{z}{z}+z', 'z\\cdot\\frac{1}{z}+z', '\\frac{1}{z}\\cdot z^2+z', '\\frac{z-1}{z-1}\\cdot z+z^2', '\\frac{1}{(z-1)^2}(z-1)^2+z^3']) {
  const b = expect(t, null);
  if (b.props.entire || b.props.polynomial || b.props.injective) fail(`verify-2 ${t}: lamps the formula does not have`);
}
{
  const b = build('\\sqrt{\\frac{z}{z}+z}');
  if (chainSig(b) === 'add>root' || b.props.injective) fail(`verify-2 \\sqrt{\\frac{z}{z}+z}: read as ${chainSig(b)}, injective ${b.props.injective}`);
  if (CX.isFin(b.f(C(0, 0)))) fail('verify-2: the formula is undefined at 0');
}
expect('\\frac{1}{z}+\\frac{1}{z}', 'mobius');           // the pole stays a pole: read as before
expect('\\frac{1}{z}+\\frac{1}{z^2}', 'rational');
expect('\\frac{z^2+1}{z}', 'joukowski>mul');
expect('\\frac{z}{z-1}+\\frac{1}{z+1}', 'rational');
// ---- review verify-3: a Horner reading must be well conditioned near its roots (float32 on the GPU) ----
expect('(z-100)^{2}+(z-101)^{2}', null);
expect('(z-10)^{2}+(z-11)^{2}', null);
expect('z(z-1)-0.997(z-1)', null);
{
  // float32 emulated at every operation: Horner on an accepted reading's expanded coefficients against the formula in
  // doubles, at 0.01 from each root. κ <= 1e4 there bounds the error by about 1e-3; the refused readings above have
  // κ of about 4e4, 3e4 and 4e6
  const f32 = Math.fround;
  const m32 = (a, b) => C(f32(f32(a.re * b.re) - f32(a.im * b.im)), f32(f32(a.re * b.im) + f32(a.im * b.re)));
  const horner32 = (co, z) => { let w = C(f32(co[0].re), f32(co[0].im)); for (let i = 1; i < co.length; i++) { w = m32(w, z); w = C(f32(w.re + f32(co[i].re)), f32(w.im + f32(co[i].im))); } return w; };
  for (const t of ['(z^2+1)(z-1)+z', '(z+1)^2+z', 'z(z+1)+(z-1)']) {
    const b = build(t);
    const it = chainSig(b) === 'poly' && b.rec.built[0];
    if (!it) { fail(`verify-3 ${t}: expected one poly step, got ${chainSig(b)}`); continue; }
    const co = it.vals.co, F = Expr.compile(Expr.parse(t));
    let worst = 0;
    for (const r of CX.polyRoots(co)) for (let k = 0; k < 8; k++) {
      const z = CX.add(r, C(0.01 * Math.cos(k * Math.PI / 4 + 0.1), 0.01 * Math.sin(k * Math.PI / 4 + 0.1))), z32 = C(f32(z.re), f32(z.im));
      const u = F(z32), v = horner32(co, z32);
      worst = Math.max(worst, CX.abs(CX.sub(u, v)) / CX.abs(u));
    }
    if (!(worst < 1e-3)) fail(`verify-3 ${t}: float32 Horner relative error ${worst.toExponential(1)} at 0.01 from a root`);
  }
}

if (stats.keyDiff) console.log('spellings with their own sheet code (two programs, one chain):', stats.keyDiff.join(', '));
console.log(`formulas ${stats.formulas} (+ ${stats.spellings - stats.formulas} plain spellings); recognized ${stats.recognized} of ${stats.spellings} (partial ${stats.partial}); exact inverse renderer ${stats.inverseBefore} -> ${stats.inverse}; ${stats.points} value comparisons`);
console.log(`verify-1: ${stats.seamPairs} recognized formula/cut pairs on the cuts -180, 270, 540, 360, -540, 900, 190.5, -359.9 (values bit for bit, deformation ends and joins)`);
console.log('by kind (LaTeX, cut 180):', Object.entries(kinds).map(([k, v]) => `${k} ${v.rec}/${v.n}`).join(', '));
console.log(fails ? `t_recognize: ${fails} FAIL` : 't_recognize: all passed');
process.exit(fails ? 1 : 0);

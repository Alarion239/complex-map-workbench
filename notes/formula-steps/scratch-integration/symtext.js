// Prototype: the split's parameter TEXT, spelling-preserving and link-preserving.
// For a one-step group (a node of the formula as written), read the step's params from the group's src (the piece as a
// function of its input): affine/mobius coefficients by d/dz and z = 0 of the numerator and denominator, the exponent
// as typed. Otherwise exact numbers (no shared number involved), otherwise the group stays a formula step.
// Every text is verified: the catalog step built from it equals the recognized step at probes, at the current value
// of a and at two other values (the link).
const R = '<project>/work/xvr-final-snap';
const NOTES = '<project>/notes';
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
const C = CX.C; let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const item = (v) => CX.fmtExact(C(v.re === 0 ? 0 : v.re, v.im === 0 ? 0 : v.im)).replace(/\s+/g, '');
// a light symbolic affine reader that never folds a shared number (Expr.simplify would fold a into 0.7)
const isP = (n) => n.t === 'num' && n.param != null;
const lit = (n) => n.t === 'num' && n.param == null;
const isLit = (n, re, im = 0) => lit(n) && n.v.re === re && n.v.im === im;
const NUM = (v) => Expr.N.num(v);
const K = {
  neg: (x) => (lit(x) ? NUM(CX.neg(x.v)) : x.t === 'neg' ? x.a : { t: 'neg', a: x }),
  add: (x, y) => (isLit(x, 0) ? y : isLit(y, 0) ? x : lit(x) && lit(y) ? NUM(CX.add(x.v, y.v)) : y.t === 'neg' ? { t: 'sub', a: x, b: y.a } : { t: 'add', a: x, b: y }),
  mul: (x, y) => (isLit(x, 0) || isLit(y, 0) ? NUM(C(0, 0)) : isLit(x, 1) ? y : isLit(y, 1) ? x : lit(x) && lit(y) ? NUM(CX.mul(x.v, y.v)) : { t: 'mul', a: x, b: y }),
  div: (x, y) => (isLit(y, 1) ? x : isLit(x, 0) ? x : lit(x) && lit(y) && Number.isInteger(x.v.re) && Number.isInteger(y.v.re) && !x.v.im && !y.v.im ? { t: 'div', a: x, b: y } : lit(x) && lit(y) ? NUM(CX.div(x.v, y.v)) : { t: 'div', a: x, b: y }),
};
const ONE_ = () => NUM(C(1, 0)), ZERO_ = () => NUM(C(0, 0));
function aff(n) {
  if (n.t === 'var' && n.n === 'z') return { a: ONE_(), b: ZERO_() };
  if (!Expr.depends(n)) return { a: ZERO_(), b: n };
  const r = (k) => aff(n[k]);
  switch (n.t) {
    case 'neg': { const x = r('a'); return x && { a: K.neg(x.a), b: K.neg(x.b) }; }
    case 'add': { const x = r('a'), y = r('b'); return x && y && { a: K.add(x.a, y.a), b: K.add(x.b, y.b) }; }
    case 'sub': { const x = r('a'), y = r('b'); return x && y && { a: K.add(x.a, K.neg(y.a)), b: K.add(x.b, K.neg(y.b)) }; }
    case 'mul': { if (!Expr.depends(n.a)) { const y = r('b'); return y && { a: K.mul(n.a, y.a), b: K.mul(n.a, y.b) }; } if (!Expr.depends(n.b)) { const x = r('a'); return x && { a: K.mul(n.b, x.a), b: K.mul(n.b, x.b) }; } return null; }
    case 'div': { if (Expr.depends(n.b)) return null; const x = r('a'); return x && { a: K.div(x.a, n.b), b: K.div(x.b, n.b) }; }
  }
  return null;
}
const tex = (n) => Expr.toTex(n).s;
function quot(n) {   // P/Q with P, Q affine in z (a leading minus goes into P)
  let neg = false; while (n.t === 'neg') { neg = !neg; n = n.a; }
  if (n.t !== 'div') return null;
  const P = aff(neg ? { t: 'neg', a: n.a } : n.a), Q = aff(n.b);
  return P && Q ? { a: P.a, b: P.b, c: Q.a, d: Q.b } : null;
}
function symParams(s, src, cut) {
  const v = s.vals;
  switch (s.type) {
    case 'mul': { const r = aff(src); return r ? { c: tex(r.a) } : null; }
    case 'add': { const r = aff(src); return r ? { c: tex(r.b) } : null; }
    case 'affine': { const r = aff(src); return r ? { a: tex(r.a), b: tex(r.b) } : null; }
    case 'mobius': { const q = quot(src); return q ? { a: tex(q.a), b: tex(q.b), c: tex(q.c), d: tex(q.d) } : null; }
    case 'powa': { if (src.t === 'pow') return { alpha: Expr.toTex(src.b).s, cut, k: 0 }; if (src.t === 'root') return { alpha: `\\frac{1}{${Expr.toTex(src.n).s}}`, cut, k: 0 }; return null; }
  }
  return null;
}
function numParams(s, cut) {
  const v = s.vals, p = {};
  switch (s.type) {
    case 'custom': return { expr: Expr.toTex(v.ast).s, cut };
    case 'mul': case 'add': p.c = item(v.c); break;
    case 'affine': p.a = item(v.a); p.b = item(v.b); break;
    case 'mobius': for (const k of 'abcd') p[k] = item(v[k]); break;
    case 'pown': p.n = v.n; break;
    case 'root': p.n = v.n; p.cut = cut; p.k = 0; break;
    case 'powa': p.alpha = item(v.alpha); p.cut = cut; p.k = 0; break;
    case 'log': p.cut = cut; p.k = 0; break;
    case 'poly': p.co = v.co.map(item).join(', '); break;
    case 'rational': p.p = v.p.map(item).join(', '); p.q = v.q.map(item).join(', '); break;
    case 'zp': p.a = item(v.a); p.zeros = v.zeros.map(item).join(', '); p.poles = v.poles.map(item).join(', '); break;
  }
  return p;
}
const PR = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05), C(-0.6, -0.35), C(1.7, -0.4)];
const sameF = (f, g, tol) => PR.every((p) => { const x = f(p), y = g(p); const fx = CX.isFin(x), fy = CX.isFin(y); return fx === fy && (!fx || CX.abs(CX.sub(x, y)) <= tol * (1 + CX.abs(x))); });
const compose = (fs) => (z) => { for (const h of fs) z = h(z); return z; };
// split(F): the steps to put in place of the formula step, or {refuse}
function split(expr, cut = 180) {
  const ast = Expr.parse(expr);
  const b = Funcs.build({ type: 'custom', params: { expr, cut }, on: true });
  if (b.error || !b.rec) return { refuse: 'not recognized' };
  const hasP = Recognize.hasParam(ast);
  // the reading with its groups' src (finishRec keeps only their compiled f): the tape's structure, at the current values
  const rec = Recognize.chain(ast, cut);
  if (!rec || rec.steps.length !== b.rec.steps.length) return { refuse: 'reading differs' };
  const out = [];
  for (const g of rec.groups) {
    const steps = rec.steps.slice(g.from, g.to);
    const cand = steps.map((s) => ({ type: s.type, params: (g.to - g.from === 1 && symParams(s, g.src, cut)) || numParams(s, cut), on: true }));
    // the group's steps from text equal the group's piece at the current value and, with shared numbers, at others
    const ok = [A, 0.31, 1.83].every((val, i) => {
      if (i && !hasP) return true;
      const keep = A; A = val;
      try {
        const bs = cand.map((st) => Funcs.build(st));
        if (bs.some((x) => x.error)) return false;
        // (a parsed tree carries the value of a shared number from parse time: re-read the piece at this value)
        return sameF(Expr.compile(Expr.parse(Expr.toTex(g.src).s), { theta: cut * Math.PI / 180 }), compose(bs.map((x) => x.f)), 1e-12);
      } finally { A = keep; }
    });
    if (ok) out.push(...cand);
    else out.push({ type: 'custom', params: { expr: Expr.toTex(g.src).s, cut }, on: true, kept: true });
  }
  // nothing gained: one formula step for the whole formula
  if (out.length === 1 && out[0].kept) return { refuse: 'its numbers cannot be written as step parameters without losing the shared number' };
  return { steps: out, partial: rec.partial };
}
module.exports = { split, setA: (v) => { A = v; } };
if (require.main === module) {
  const L = process.argv.slice(2).length ? process.argv.slice(2) : ['\\sin(z^2+1)', '\\frac{2z+1}{z-1}', 'e^{iz}+e^{-iz}', 'z^{i}', '(z-a)^3', '\\sqrt{1-z^2}', '\\log\\frac{1+z}{1-z}', 'z^2+\\sin z', '\\frac{1}{z}+z', 'z^a', 'az+1', '\\frac{az+1}{z+a}', '\\frac{z^2-a}{z+1}', '\\sqrt[a]{z}', 'e^{az}', '\\log(z^z)', '2(z+1)', '\\frac{1}{z-a}', 'z^2+az', '(z-a)^2(z+1)', '\\sin(az)+1', '1-\\frac{1}{z}', '\\frac{\\pi}{3}z', 'z+\\frac13'];
  for (const q of L) { const r = split(q); console.log(q.padEnd(24), r.refuse ? 'REFUSE: ' + r.refuse : r.steps.map((s) => s.type + (Object.keys(s.params).length ? JSON.stringify(s.params) : '')).join('  →  ')); }
}

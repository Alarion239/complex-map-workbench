'use strict';
// My own (independent) preimage generator for catalog chains: a superset of candidates per step, filtered by the
// app's own forward b.f. Families use a wide member window [-M, M] around the principal member.
const L = require('./lib.js');
const { C } = L;
const { add, sub, mul, div, exp, log, abs, scale, isFin } = CX;
const TAU = 2 * Math.PI, ONE = C(1, 0);
// accurate principal asin (no cancellation): -i log(iw + s) or i log(s - iw)
function asinA(w) {
  const s = CX.sqrt(sub(ONE, mul(w, w))), iw = C(-w.im, w.re);
  const t1 = add(iw, s), t2 = sub(s, iw);
  const l = abs(t1) >= abs(t2) ? log(t1) : CX.neg(log(t2));
  return C(l.im, -l.re);
}
function mobOfStep(b) {
  const v = b.vals, Z = C(0, 0);
  switch (b.def.id) {
    case 'mul': return [v.c, Z, Z, ONE];
    case 'add': return [ONE, v.c, Z, ONE];
    case 'affine': return [v.a, v.b, Z, ONE];
    case 'recip': return [Z, ONE, ONE, Z];
    case 'mobius': return [v.a, v.b, v.c, v.d];
    case 'blaschke': { const e = C(Math.cos(v.phi * Math.PI / 180), Math.sin(v.phi * Math.PI / 180)); return [e, CX.neg(mul(e, v.a)), CX.neg(CX.conj(v.a)), ONE]; }
  }
  return null;
}
// candidates u with b.f(u) = v (superset; filtered by the caller)
function stepCands(b, v, M) {
  const id = b.def.id, vals = b.vals, out = [];
  const fam = (base, p) => { for (let m = -M; m <= M; m++) out.push(add(base, scale(p, m))); };
  const M0 = mobOfStep(b);
  if (M0) { const [a, bb, c, d] = M0; out.push(div(sub(mul(d, v), bb), add(mul(CX.neg(c), v), a))); return out; }
  switch (id) {
    case 'exp': if (abs(v) > 0) fam(log(v), C(0, TAU)); break;
    case 'log': out.push(exp(v)); break;
    case 'sin': { const a = asinA(v); fam(a, C(TAU, 0)); fam(sub(C(Math.PI, 0), a), C(TAU, 0)); break; }
    case 'cos': { const a = sub(C(Math.PI / 2, 0), asinA(v)); fam(a, C(TAU, 0)); fam(CX.neg(a), C(TAU, 0)); break; }
    case 'sinh': { const s = asinA(C(-v.im, v.re)), a = C(s.im, -s.re); fam(a, C(0, TAU)); fam(sub(C(0, Math.PI), a), C(0, TAU)); break; }
    case 'cosh': { const a = log(add(v, mul(CX.sqrt(sub(v, ONE)), CX.sqrt(add(v, ONE))))); fam(a, C(0, TAU)); fam(CX.neg(a), C(0, TAU)); break; }
    case 'tan': { const iw = C(-v.im, v.re), d = sub(log(sub(ONE, iw)), log(add(ONE, iw))); fam(C(-d.im / 2, d.re / 2), C(Math.PI, 0)); break; }
    case 'tanh': { const iv = C(-v.im, v.re), iw = C(-iv.im, iv.re), d = sub(log(sub(ONE, iw)), log(add(ONE, iw))), t = C(-d.im / 2, d.re / 2); fam(C(t.im, -t.re), C(0, Math.PI)); break; }
    case 'pown': {
      const n = vals.n, q = n > 0 ? v : CX.inv(v), an = Math.abs(n), r = Math.pow(abs(q), 1 / an), t = Math.atan2(q.im, q.re);
      for (let j = 0; j < an; j++) out.push(C(r * Math.cos((t + TAU * j) / an), r * Math.sin((t + TAU * j) / an)));
      break;
    }
    case 'root': out.push(CX.ipow(v, Math.max(2, vals.n))); break;
    case 'powa': { if (abs(v) > 0) { const lv = log(v), al = vals.alpha; for (let m = -M; m <= M; m++) out.push(exp(div(add(lv, C(0, TAU * m)), al))); } break; }
    case 'joukowski': { const s = CX.sqrt(sub(mul(v, v), ONE)); out.push(add(v, s), sub(v, s)); break; }
    case 'conj': out.push(CX.conj(v)); break;
    case 'arcsin': out.push(CX.sin(v)); break;
    case 'arccos': out.push(CX.cos(v)); break;
    case 'arctan': out.push(CX.tan(v)); break;
    case 'arsinh': out.push(CX.sinh(v)); break;
    case 'arcosh': out.push(CX.cosh(v)); break;
    case 'artanh': out.push(CX.tanh(v)); break;
    case 'poly': {
      const c = CX.polyTrim(vals.co), d = c.length - 1;
      if (d === 2) { const [a, bq, cc] = c, s = CX.sqrt(sub(mul(bq, bq), scale(mul(a, sub(cc, v)), 4))); out.push(div(sub(s, bq), scale(a, 2)), div(sub(CX.neg(s), bq), scale(a, 2))); }
      else if (d === 1) out.push(div(sub(v, c[1]), c[0]));
      else { const q = div(sub(v, c[d]), c[0]), r = Math.pow(abs(q), 1 / d), t = Math.atan2(q.im, q.re); for (let j = 0; j < d; j++) out.push(C(r * Math.cos((t + TAU * j) / d), r * Math.sin((t + TAU * j) / d))); }
      break;
    }
    default: throw new Error('truth: no generator for ' + id);
  }
  return out;
}
// all z (within the member windows) with F(z) = w, through the chain steps (a, b]
function preimages(ch, w, M = 40, tol = 1e-8) {
  let cur = [w];
  for (let k = ch.built.length - 1; k >= 0; k--) {
    const b = ch.built[k], next = [];
    for (const v of cur) {
      for (const u of stepCands(b, v, M)) {
        if (!isFin(u)) continue;
        const fv = b.f(u);
        if (isFin(fv) && abs(sub(fv, v)) <= tol * (1 + abs(v))) next.push(u);
      }
    }
    // dedupe
    cur = [];
    for (const u of next) if (!cur.some((q) => abs(sub(q, u)) <= 1e-10 * (1 + abs(u)))) cur.push(u);
  }
  return cur;
}
module.exports = { preimages, asinA };

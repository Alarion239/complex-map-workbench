// @ts-check
'use strict';
// GLSL text of the inverse pass's polynomial roots by Aberth's iteration (InvOps.newtAberth's, in float32): the sweeps
// that the polynomial NEWT op (GLChain's newtPolyFns) and the rational ops RAT5 ... RAT<NEWT_POLY_MAX> (InvOps.opRatN by
// aberthRoots) share, and those ops' functions. GLChain takes these names at the top of its inverse section.
const GLSLRoots = (() => {
  // an Aberth sweep has converged when its step is within NEWT_STEP_TOL (1 + |z|) (also the Newton walks' stop)
  const NEWT_STEP_TOL = '1e-5';
  // Aberth's iteration in GLSL for an op whose polynomial's coefficients a_0 ... a_D (low first, w taken off) are
  // ${P}_a(k, w): _ev, a(u) and its derivative (Horner) at degree de; _start, de points on the circle of Fujiwara's
  // bound; _aberth, Aberth's sweeps over z, at most its, until every step is within NEWT_STEP_TOL (1 + |z_i|)
  // (InvOps.newtAberth's iteration in float32, whose rounding the tolerance allows). The polynomial NEWT op's and
  // RAT<n>'s for n >= 5
  function aberthFns(P, D) {
    return `void ${P}_ev(vec2 u, vec2 w, int de, out vec2 q, out vec2 dq) {
  q = vec2(0.0); dq = vec2(0.0);
  for (int k = ${D}; k >= 0; k--) {
    if (k > de) continue;
    dq = cmul(dq, u) + q;
    q = cmul(q, u) + ${P}_a(k, w);
  }
}
void ${P}_start(vec2 w, int de, out vec2 z[${D}]) {
  vec2 ad = ${P}_a(de, w);
  float R = 0.0;
  for (int k = 1; k <= ${D}; k++) {
    if (k > de) break;
    R = max(R, pow(cx_abs(cdiv(${P}_a(de - k, w), ad)) / (k == de ? 2.0 : 1.0), 1.0 / float(k)));
  }
  R = R > 0.0 ? 2.0 * R : 1.0;
  for (int i = 0; i < ${D}; i++) {
    float th = 6.283185307179586 * float(i) / float(max(de, 1)) + ${Inverse.NEWT_ABERTH_ROT};
    z[i] = R * vec2(cos(th), sin(th));
  }
}
bool ${P}_aberth(vec2 w, int de, inout vec2 z[${D}], int its) {
  bool cv[${D}];
  for (int i = 0; i < ${D}; i++) cv[i] = i >= de;
  for (int it = 0; it < its; it++) {
    bool all = true;
    for (int i = 0; i < ${D}; i++) {
      if (cv[i]) continue;
      vec2 q, dq;
      ${P}_ev(z[i], w, de, q, dq);
      if (q.x == 0.0 && q.y == 0.0) { cv[i] = true; continue; }
      vec2 N = cdiv(q, dq), s = vec2(0.0);
      for (int k = 0; k < ${D}; k++) if (k != i && k < de) s += cinv(z[i] - z[k]);
      vec2 den = vec2(1.0, 0.0) - cmul(N, s);
      vec2 st = den.x == 0.0 && den.y == 0.0 ? N : cdiv(N, den);
      if (!ixFin(st)) { cv[i] = true; continue; }
      z[i] -= st;
      if (cx_abs(st) <= ${NEWT_STEP_TOL} * (1.0 + cx_abs(z[i]))) cv[i] = true;
      else all = false;
    }
    if (all) return true;
  }
  return false;
}
`;
  }
  // GLSL of RAT<n> for n >= 5 (InvOps.opRatN by aberthRoots), op j with parameters at uInv[c ...]: P's coefficients
  // p_n ... p_0 two to a cell, then Q's from cell half. Once per w, _roots sets _A, the low-first coefficients
  // a_k = p_(n-k) - w q_(n-k) of p - w q (which _a reads, so Aberth's sweeps fetch no uniform), drops the degree where a
  // leading coefficient is what cancellation leaves, below 1e-14 of |p_(n-k)| + |w| |q_(n-k)| (as aberthRoots), and keeps
  // Aberth's roots (aberthFns), each polished by two Newton steps on p - w q, when finite and apart from every earlier
  // one; root b's derivative (p/q)' by Horner on P and Q
  function ratAberthFns(n, j, c, NOR, dedupe) {
    const P = `ix${j}`, half = Math.ceil((n + 1) / 2);
    const cell = (i, from) => `(${i} & 1) == 0 ? uInv[${c + from} + ${i} / 2].xy : uInv[${c + from} + ${i} / 2].zw`;
    return `vec2 ${P}_A[${n + 1}];
vec2 ${P}_a(int k, vec2 w) { return ${P}_A[k]; }
${aberthFns(P, n)}void ${P}_pq(vec2 u, out vec2 pu, out vec2 qu, out vec2 dp, out vec2 dq) {
  pu = vec2(0.0); qu = vec2(0.0); dp = vec2(0.0); dq = vec2(0.0);
  for (int i = 0; i <= ${n}; i++) {
    vec2 p = ${cell('i', 0)}, q = ${cell('i', half)};
    dp = cmul(dp, u) + pu; pu = cmul(pu, u) + p;
    dq = cmul(dq, u) + qu; qu = cmul(qu, u) + q;
  }
}
bool ${P}_has = false;
vec2 ${P}_w = vec2(0.0);
vec2 ${P}_r[${n}];
bool ${P}_k[${n}];
void ${P}_roots(vec2 w) {
  if (${P}_has && ${P}_w == w) return;
  ${P}_has = true; ${P}_w = w;
  float sz[${n + 1}];
  for (int k = 0; k <= ${n}; k++) { int i = ${n} - k; vec2 p = ${cell('i', 0)}, q = ${cell('i', half)}; ${P}_A[k] = p - cmul(w, q); sz[k] = cx_abs(p) + cx_abs(w) * cx_abs(q); }
  int de = ${n};
  for (int d = ${n}; d > 0; d--) {
    if (cx_abs(${P}_A[d]) > 1e-14 * sz[d]) break;
    de = d - 1;
  }
  vec2 z[${n}];
  ${P}_start(w, de, z);
  ${P}_aberth(w, de, z, ${Inverse.NEWT_ABERTH_IT});
  for (int i = 0; i < ${n}; i++) {
    vec2 v = z[i];
    for (int it = 0; it < 2; it++) { vec2 q, dq; ${P}_ev(v, w, de, q, dq); vec2 st = cdiv(q, dq); if (ixFin(st)) v -= st; }
    bool ok = i < de && ixFin(v);
    for (int m = 0; m < ${n}; m++) { if (m >= i) break; if (ok && ${P}_k[m] && cx_abs(v - ${P}_r[m]) <= ${dedupe} * (1.0 + cx_abs(${P}_r[m]))) ok = false; }
    ${P}_r[i] = v; ${P}_k[i] = ok;
  }
}
int ${P}_nb(Lf L) { return ixFin(L.u) ? ${n} : 0; }
bool ${P}_one_b(inout Lf L, int b) {
  ${P}_roots(L.u);
  if (!${P}_k[b]) return false;
  vec2 u = ${P}_r[b], pu, qu, dp, dq;
  ${P}_pq(u, pu, qu, dp, dq);
  return ixApply(L, u, cinv(cdiv(cmul(dp, qu) - cmul(pu, dq), cmul(qu, qu))), ${NOR});
}
`;
  }
  return { NEWT_STEP_TOL, aberthFns, ratAberthFns };
})();
import { Inverse } from './inverse.js';
export { GLSLRoots };

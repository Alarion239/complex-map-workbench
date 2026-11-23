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
  // RAT<n>'s for n >= 5: evFns is _ev and sweepFns _start and _aberth, apart so that the polynomial NEWT op puts its
  // Newton walks (GLChain's newtCoreFns, which call _ev) between them
  function aberthFns(P, D) {
    return evFns(P, D) + sweepFns(P, D);
  }
  function evFns(P, D) {
    return `void ${P}_ev(vec2 u, vec2 w, int de, out vec2 q, out vec2 dq) {
  q = vec2(0.0); dq = vec2(0.0);
  for (int k = ${D}; k >= 0; k--) {
    if (k > de) continue;
    dq = cmul(dq, u) + q;
    q = cmul(q, u) + ${P}_a(k, w);
  }
}
`;
  }
  function sweepFns(P, D) {
    return `void ${P}_start(vec2 w, int de, out vec2 z[${D}]) {
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
  // leading coefficient is what cancellation leaves, below RAT_DROP of |p_(n-k)| + |w| |q_(n-k)| (InvOps.ratPoly's drop, as
  // RAT3's and RAT4's _deg), and keeps Aberth's roots (aberthFns), each polished by up to ROOT_POLISH Newton steps on p - w q,
  // each step taken only when it lowers |p - w q| (GLChain's ixRoots polish, which says why: near a multiple root a
  // step is float32's rounding over a small derivative), in increasing Re + ROOT_DIR Im (aberthRoots' ROOT_ORDER; the
  // finite ones first), each when finite and apart from every earlier one; root b's derivative (p/q)' by Horner on P
  // and Q
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
    if (cx_abs(${P}_A[d]) > ${Inverse.RAT_DROP} * sz[d]) break;
    de = d - 1;
  }
  vec2 z[${n}];
  ${P}_start(w, de, z);
  ${P}_aberth(w, de, z, ${Inverse.NEWT_ABERTH_IT});
  float o[${n}];
  for (int i = 0; i < ${n}; i++) {
    vec2 v = z[i];
    vec2 f, dq;
    ${P}_ev(v, w, de, f, dq);
    for (int it = 0; it < ${Inverse.ROOT_POLISH}; it++) {
      vec2 st = cdiv(f, dq), u = v - st, fv, du;
      ${P}_ev(u, w, de, fv, du);
      if (!ixFin(u) || !(cx_abs(fv) < cx_abs(f))) break;
      v = u; f = fv; dq = du;
    }
    bool ok = i < de && ixFin(v);
    float key = ok ? v.x + ${Inverse.ROOT_DIR} * v.y : 3e38;
    int m = i;
    for (int k = ${n - 1}; k > 0; k--) {
      if (k > m) continue;
      if (o[k - 1] <= key) break;
      o[k] = o[k - 1]; ${P}_r[k] = ${P}_r[k - 1]; ${P}_k[k] = ${P}_k[k - 1]; m = k - 1;
    }
    o[m] = key; ${P}_r[m] = v; ${P}_k[m] = ok;
  }
  for (int i = 1; i < ${n}; i++) {
    for (int m = 0; m < ${n}; m++) { if (m >= i) break; if (${P}_k[i] && ${P}_k[m] && cx_abs(${P}_r[i] - ${P}_r[m]) <= ${dedupe} * (1.0 + cx_abs(${P}_r[m]))) ${P}_k[i] = false; }
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
  return { NEWT_STEP_TOL, aberthFns, evFns, sweepFns, ratAberthFns };
})();
import { Inverse } from './inverse.js';
export { GLSLRoots };

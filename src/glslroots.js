// @ts-check
'use strict';
// GLSL text of the inverse pass's polynomial roots, in two families.
// The closed forms: the ops whose members over w are the roots of a polynomial of degree at most 4 in closed form, JOUK,
// QUAD, RAT2, RAT3 and RAT4 (InvOps' opJouk, opQuad, opRat2, opRatN by closedRoots): their functions (closedFns) and uInv
// values (closedValues), and the solvers RAT3 and RAT4 call (ixRoots, put into a program that has an op of RAT_N).
// Aberth's iteration (InvOps.newtAberth's, in float32): the sweeps that the polynomial NEWT op (GLChain's newtPolyFns) and
// the rational ops RAT5 ... RAT<NEWT_POLY_MAX> (InvOps.opRatN by aberthRoots) share, and those ops' functions.
// GLChain takes these names in its inverse section. Inverse is read only inside the functions, when GLChain builds a
// program: a page may load this module without inverse.js.
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
  // GLSL of an op's D roots in their order (InvOps' ROOT_ORDER): ${P}_r and ${P}_k, root i and whether it is kept, and
  // _order, which sorts them by increasing Re + ROOT_DIR Im (the kept ones first) and then keeps a root only when it is
  // apart from every earlier kept one (within dedupe (1 + |z|)). Which start point of Aberth's sweeps converges to which
  // root differs between float32 and float64 where two roots are near; this order is the CPU's. The polynomial NEWT
  // op's and RAT<n>'s for n >= 5
  function orderFns(P, D, dedupe) {
    return `vec2 ${P}_r[${D}];
bool ${P}_k[${D}];
void ${P}_order() {
  float o[${D}];
  for (int i = 0; i < ${D}; i++) {
    vec2 v = ${P}_r[i];
    bool ok = ${P}_k[i];
    float key = ok ? v.x + ${Inverse.ROOT_DIR} * v.y : 3e38;
    int m = i;
    for (int k = ${D - 1}; k > 0; k--) {
      if (k > m) continue;
      if (o[k - 1] <= key) break;
      o[k] = o[k - 1]; ${P}_r[k] = ${P}_r[k - 1]; ${P}_k[k] = ${P}_k[k - 1]; m = k - 1;
    }
    o[m] = key; ${P}_r[m] = v; ${P}_k[m] = ok;
  }
  for (int i = 1; i < ${D}; i++) {
    for (int m = 0; m < ${D}; m++) { if (m >= i) break; if (${P}_k[i] && ${P}_k[m] && cx_abs(${P}_r[i] - ${P}_r[m]) <= ${dedupe} * (1.0 + cx_abs(${P}_r[m]))) ${P}_k[i] = false; }
  }
}
`;
  }
  // GLSL of RAT<n> for n >= 5 (InvOps.opRatN by aberthRoots), op j with parameters at uInv[c ...]: P's coefficients
  // p_n ... p_0 two to a cell, then Q's from cell half. Once per w, _roots sets _A, the low-first coefficients
  // a_k = p_(n-k) - w q_(n-k) of p - w q (which _a reads, so Aberth's sweeps fetch no uniform), drops the degree where a
  // leading coefficient is what cancellation leaves, below RAT_DROP of |p_(n-k)| + |w| |q_(n-k)| (InvOps.ratPoly's drop,
  // as RAT3's and RAT4's _deg), and keeps Aberth's roots (aberthFns), each polished by up to ROOT_POLISH Newton steps on
  // p - w q, each step taken only when it lowers |p - w q| (GLChain's ixRoots polish, which says why: near a multiple
  // root a step is float32's rounding over a small derivative), the finite ones in their order (orderFns); root b's
  // derivative (p/q)' by Horner on P and Q
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
${orderFns(P, n, dedupe)}void ${P}_roots(vec2 w) {
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
    ${P}_r[i] = v; ${P}_k[i] = i < de && ixFin(v);
  }
  ${P}_order();
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
  // the roots of the RAT3 and RAT4 ops' polynomials (InvOps.cubicRoots, quarticRoots), in a program that has one: of the
  // degree n the op gives (its _deg, InvOps.ratPoly's drop), root b of the linear polynomial, of the stable quadratic,
  // of Cardano's formula or of Ferrari's (its resolvent's root of largest modulus by Cardano's), each closed formula on
  // the reversed polynomial (roots 1/u) when its leading coefficient is the smaller end (InvOps.closedRoots), and every
  // root polished by up to two Newton steps on the polynomial itself (float32: the shifts and the cube root lose digits
  // that the steps win back). A step is taken only when it lowers |p(u)|: near a multiple root p'(u) is small and p(u)
  // is float32's rounding of its terms, so a step there is that rounding over p' and can throw an exact root far off,
  // where that rounding is not 0 (a GPU that fuses or reorders the products)
  const RAT_N = new Set(['RAT3', 'RAT4']), RAT_NEAR = '1e-2', F32_EPS = '5.96e-8';
  const ixRoots = () => `
// root k of y^2 + beta y + gamma (stable)
vec2 ixQuadMonic(vec2 beta, vec2 gamma, int k) {
  vec2 disc = csqrtp(cmul(beta, beta) - 4.0 * gamma);
  if (dot(beta, disc) < 0.0) disc = -disc;
  vec2 q = -0.5 * (beta + disc);
  return (q.x == 0.0 && q.y == 0.0) ? vec2(0.0) : (k == 0 ? q : cdiv(gamma, q));
}
// Cardano on a u^3 + b u^2 + c u + d (a not 0): root k = w^k S + w^-k T - b3
void ixCardano(vec2 a, vec2 b, vec2 c, vec2 d, out vec2 S, out vec2 T, out vec2 b3) {
  vec2 b1 = cdiv(b, a), c1 = cdiv(c, a);
  b3 = b1 / 3.0;
  vec2 p3 = (c1 - cmul(b1, b3)) / 3.0, hq = -0.5 * (2.0 * cmul(cmul(b3, b3), b3) - cmul(b3, c1) + cdiv(d, a));
  vec2 sq = csqrtp(cmul(hq, hq) + cmul(cmul(p3, p3), p3)), s1 = hq + sq, s2 = hq - sq, s = dot(s1, s1) >= dot(s2, s2) ? s1 : s2;
  S = vec2(0.0);
  T = vec2(0.0);
  if (s.x != 0.0 || s.y != 0.0) {
    S = cexp(clog(s, CX_PI, 0.0) / 3.0);
    T = cdiv(-p3, S);
  }
}
vec2 ixCardanoRoot(vec2 S, vec2 T, vec2 b3, int k) {
  vec2 om = k == 0 ? vec2(1.0, 0.0) : vec2(-0.5, k == 1 ? 0.8660254037844386 : -0.8660254037844386);
  return cmul(om, S) + cmul(vec2(om.x, -om.y), T) - b3;
}
vec2 ixPolish3(vec2 a, vec2 b, vec2 c, vec2 d, vec2 u) {
  vec2 f = cmul(cmul(cmul(a, u) + b, u) + c, u) + d;
  for (int it = 0; it < ${Inverse.ROOT_POLISH}; it++) {
    vec2 g = cmul(3.0 * cmul(a, u) + 2.0 * b, u) + c;
    if (g.x == 0.0 && g.y == 0.0) break;
    vec2 v = u - cdiv(f, g);
    vec2 fv = cmul(cmul(cmul(a, v) + b, v) + c, v) + d;
    if (!ixFin(v) || !(cx_abs(fv) < cx_abs(f))) break;
    u = v;
    f = fv;
  }
  return u;
}
vec2 ixCubic(vec2 a, vec2 b, vec2 c, vec2 d, int n, int k) {
  if (n == 1) return -cdiv(d, c);
  if (n == 2) return ixQuadMonic(cdiv(c, b), cdiv(d, b), k);
  bool rev = cx_abs(a) < cx_abs(d);
  vec2 S, T, b3;
  if (rev) ixCardano(d, c, b, a, S, T, b3); else ixCardano(a, b, c, d, S, T, b3);
  vec2 u = ixCardanoRoot(S, T, b3, k);
  return ixPolish3(a, b, c, d, rev ? cinv(u) : u);
}
// Ferrari on a u^4 + b u^3 + c u^2 + d u + e (a not 0), root k
vec2 ixFerrari(vec2 a, vec2 b, vec2 c, vec2 d, vec2 e, int k) {
  vec2 b4 = cdiv(b, a) / 4.0, c1 = cdiv(c, a), d1 = cdiv(d, a), e1 = cdiv(e, a), b42 = cmul(b4, b4);
  vec2 p = c1 - 6.0 * b42, q = d1 - 2.0 * cmul(b4, c1) + 8.0 * cmul(b42, b4), r = e1 - cmul(b4, d1) + cmul(b42, c1) - 3.0 * cmul(b42, b42);
  vec2 ra = vec2(8.0, 0.0), rb = 8.0 * p, rc = 2.0 * cmul(p, p) - 8.0 * r, rd = -cmul(q, q);
  vec2 m = vec2(0.0);
  for (int j = 0; j < 3; j++) { vec2 x = ixCubic(ra, rb, rc, rd, 3, j); if (dot(x, x) > dot(m, m)) m = x; }
  vec2 s = csqrtp(2.0 * m), h = 0.5 * p + m, qs = (s.x == 0.0 && s.y == 0.0) ? vec2(0.0) : cdiv(q, 2.0 * s);
  vec2 y = k < 2 ? ixQuadMonic(-s, h + qs, k) : ixQuadMonic(s, h - qs, k - 2);
  return y - b4;
}
vec2 ixQuartic(vec2 a, vec2 b, vec2 c, vec2 d, vec2 e, int n, int k) {
  if (n < 4) return ixCubic(b, c, d, e, n, k);
  bool rev = cx_abs(a) < cx_abs(e);
  vec2 u = rev ? cinv(ixFerrari(e, d, c, b, a, k)) : ixFerrari(a, b, c, d, e, k);
  vec2 f = cmul(cmul(cmul(cmul(a, u) + b, u) + c, u) + d, u) + e;
  for (int it = 0; it < ${Inverse.ROOT_POLISH}; it++) {
    vec2 g = cmul(cmul(4.0 * cmul(a, u) + 3.0 * b, u) + 2.0 * c, u) + d;
    if (g.x == 0.0 && g.y == 0.0) break;
    vec2 v = u - cdiv(f, g);
    vec2 fv = cmul(cmul(cmul(cmul(a, v) + b, v) + c, v) + d, v) + e;
    if (!ixFin(v) || !(cx_abs(fv) < cx_abs(f))) break;
    u = v;
    f = fv;
  }
  return u;
}
`;
  // GLSL of the functions of a closed-form op o (JOUK, QUAD, RAT2, RAT3 or RAT4), prefix P: ${P}_nb(L), the number of
  // members over L.u, and ${P}_one_b(L, b), which applies member b; U(i): the GLSL of the op's i-th uInv cell; NOR:
  // ixApply's arguments after the derivative for a member with no level (GLChain's invOpFns)
  function closedFns(o, P, U, NOR) {
    switch (o.kind) {
      case 'JOUK': return `int ${P}_nb(Lf L) { return ixFin(L.u) ? 2 : 0; }
bool ${P}_one_b(inout Lf L, int b) {
  vec2 w = L.u;
  vec2 e = w + cmul(csqrtp(w - vec2(1.0, 0.0)), csqrtp(w + vec2(1.0, 0.0)));
  vec2 u = b == 0 ? e : cinv(e), u2 = cmul(u, u);
  return ixApply(L, u, cdiv(2.0 * u2, u2 - vec2(1.0, 0.0)), ${NOR});
}
`;
      case 'QUAD': return `int ${P}_nb(Lf L) { return ixFin(L.u) ? 2 : 0; }
bool ${P}_one_b(inout Lf L, int b) {
  vec4 P0 = ${U(0)};
  vec2 a = P0.xy, bb = P0.zw, cc = ${U(1)}.xy - L.u;
  vec2 disc = csqrtp(cmul(bb, bb) - 4.0 * cmul(a, cc));
  if (dot(bb, disc) < 0.0) disc = -disc;
  vec2 q = -0.5 * (bb + disc);
  vec2 u = (q.x == 0.0 && q.y == 0.0) ? vec2(0.0) : (b == 0 ? cdiv(q, a) : cdiv(cc, q));
  return ixApply(L, u, cinv(2.0 * cmul(a, u) + bb), ${NOR});
}
`;
      case 'RAT2': return `int ${P}_roots(vec2 w, out vec2 r0, out vec2 r1) {
  vec4 S0 = ${U(0)}, S1 = ${U(1)}, S2 = ${U(2)};
  vec2 A = S0.xy - cmul(w, S1.zw), B = S0.zw - cmul(w, S2.xy), Cc = S1.xy - cmul(w, S2.zw);
  r0 = vec2(0.0); r1 = vec2(0.0);
  if (cx_abs(A) <= ${Inverse.RAT_DROP} * (cx_abs(B) + cx_abs(Cc))) { if (cx_abs(B) > 0.0) { r0 = -cdiv(Cc, B); return 1; } return 0; }
  vec2 disc = csqrtp(cmul(B, B) - 4.0 * cmul(A, Cc));
  if (dot(B, disc) < 0.0) disc = -disc;
  vec2 qq = -0.5 * (B + disc);
  if (qq.x == 0.0 && qq.y == 0.0) return 1;
  r0 = cdiv(qq, A); r1 = cdiv(Cc, qq);
  return 2;
}
int ${P}_nb(Lf L) { if (!ixFin(L.u)) return 0; vec2 a, b; return ${P}_roots(L.u, a, b); }
bool ${P}_one_b(inout Lf L, int b) {
  vec2 r0, r1;
  ${P}_roots(L.u, r0, r1);
  vec2 u = b == 0 ? r0 : r1;
  vec4 S0 = ${U(0)}, S1 = ${U(1)}, S2 = ${U(2)};
  vec2 pu = cmul(cmul(S0.xy, u) + S0.zw, u) + S1.xy, qu = cmul(cmul(S1.zw, u) + S2.xy, u) + S2.zw;
  vec2 dp = 2.0 * cmul(S0.xy, u) + S0.zw, dq = 2.0 * cmul(S1.zw, u) + S2.xy;
  return ixApply(L, u, cinv(cdiv(cmul(dp, qu) - cmul(pu, dq), cmul(qu, qu))), ${NOR});
}
`;
      // p(u) - w q(u) = 0 of degree n = 3 or 4 (InvOps.ratPoly, cubicRoots, quarticRoots): its degree _deg (a leading
      // coefficient dropped when it cancels, at most RAT_DROP of |p_k| + |w| |q_k|), its root b by ixRoots. A root b > 0 near a
      // multiple root (|p'q - pq'| (1 + |u|) below RAT_NEAR of |q(u)| times the terms' size T of p - w q) is dropped when an
      // earlier root lies within _split's radius of it: the distance float32 rounding of the terms (F32_EPS T) can open
      // between the copies of a k-fold root, the least (F32_EPS T / |t_k|)^(1/k) over the Taylor coefficients t_k of p - w q
      // at u, k >= 2. So a multiple root is one member, as InvOps.rootMembers lists it, and roots further apart than float32
      // can resolve stay apart. Cells: P's coefficients, two to a cell, then Q's from the next
      case 'RAT3': case 'RAT4': {
        const n = o.kind === 'RAT3' ? 3 : 4, half = Math.ceil((n + 1) / 2), co = (k, from) => `${U(from + (k >> 1))}.${k & 1 ? 'zw' : 'xy'}`;
        const cf = (k) => `${co(k, 0)} - cmul(w, ${co(k, half)})`, A = [...Array(n + 1).keys()].map(cf).join(', ');
        const l1 = (v) => `dot(abs(${v}), vec2(1.0))`;
        const ab = (from) => [...Array(n + 1).keys()].reduce((acc, k) => (k ? `(${acc}) * au + ${l1(co(k, from))}` : l1(co(0, from))), '');
        const ev = (from) => [...Array(n + 1).keys()].reduce((acc, k) => (k ? `cmul(${acc}, u) + ${co(k, from)}` : co(0, from)), '');
        const dv = (from) => [...Array(n).keys()].reduce((acc, k) => (k ? `cmul(${acc}, u) + ${n - k}.0 * ${co(k, from)}` : `${n}.0 * ${co(0, from)}`), '');
        const binom = (m, k) => [...Array(k).keys()].reduce((acc, i) => (acc * (m - i)) / (i + 1), 1);
        const taylor = (k) => [...Array(n - k + 1).keys()].reduce((acc, j) => (j ? `cmul(${acc}, u) + ${binom(n - j, k)}.0 * a${j}` : `${binom(n, k)}.0 * a0`), '');
        const split = [...Array(n - 1).keys()].map((i) => `  r = min(r, pow(e / max(cx_abs(${taylor(i + 2)}), 1e-30), 1.0 / ${i + 2}.0));\n`).join('');
        const F = n === 3 ? 'ixCubic' : 'ixQuartic', deg = [...Array(n).keys()].map((k) => `  if (cx_abs(${cf(k)}) > ${Inverse.RAT_DROP} * (cx_abs(${co(k, 0)}) + aw * cx_abs(${co(k, half)}))) return ${n - k};\n`).join('');
        return `int ${P}_deg(vec2 w) {
  float aw = cx_abs(w);
${deg}  return 0;
}
int ${P}_nb(Lf L) { return ixFin(L.u) ? ${P}_deg(L.u) : 0; }
float ${P}_split(vec2 w, vec2 u, float T) {
  vec2 ${[...Array(n + 1).keys()].map((k) => `a${k} = ${cf(k)}`).join(', ')};
  float e = ${F32_EPS} * T, r = 1e30;
${split}  return r;
}
bool ${P}_one_b(inout Lf L, int b) {
  vec2 w = L.u;
  int n = ${P}_deg(w);
  vec2 u = ${F}(${A}, n, b);
  vec2 pu = ${ev(0)}, qu = ${ev(half)};
  vec2 dp = ${dv(0)}, dq = ${dv(half)};
  vec2 g = cmul(dp, qu) - cmul(pu, dq);
  if (b > 0) {
    float au = ${l1('u')}, T = ${ab(0)} + ${l1('w')} * (${ab(half)});
    if (${l1('g')} * (1.0 + au) <= ${RAT_NEAR} * T * ${l1('qu')}) {
      float r = ${P}_split(w, u, T);
      for (int c = 0; c < ${n - 1}; c++) if (c < b && cx_abs(u - ${F}(${A}, n, c)) <= r) return false;
    }
  }
  return ixApply(L, u, cinv(cdiv(g, cmul(qu, qu))), ${NOR});
}
`;
      }
    }
    throw new Error('GLSLRoots: no closed form for op ' + o.kind);
  }
  // the uInv values of a closed-form op o with cells (QUAD, RAT2; its parameters o.p) from cell c, put(cell, x, y, z, w) for
  // each: the layout closedFns reads (GLChain's IX_SLOTS holds each op's number of cells, and its invOpValues RAT3's and
  // RAT4's, which they share with RAT5 ... RAT<NEWT_POLY_MAX>)
  function closedValues(o, put, c) {
    const p = o.p || {};
    const z = (v) => v || CX.C(0, 0);
    switch (o.kind) {
      case 'QUAD': put(c, p.a.re, p.a.im, p.b.re, p.b.im); put(c + 1, p.c.re, p.c.im, 0, 0); break;
      case 'RAT2': {
        const [P0, P1, P2] = p.P.map(z), [Q0, Q1, Q2] = p.Q.map(z);
        put(c, P0.re, P0.im, P1.re, P1.im); put(c + 1, P2.re, P2.im, Q0.re, Q0.im); put(c + 2, Q1.re, Q1.im, Q2.re, Q2.im);
        break;
      }
    }
  }
  return { NEWT_STEP_TOL, aberthFns, evFns, sweepFns, orderFns, ratAberthFns, RAT_N, ixRoots, closedFns, closedValues };
})();
import { CX } from './cx.js';
import { Inverse } from './inverse.js';
export { GLSLRoots };

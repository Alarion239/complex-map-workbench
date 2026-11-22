'use strict';
// The GLSL of the inverse walker's closed-form root families (notes/sphere-design/SPEC.md, sections 3.2 and 4.1): the ops
// whose members over w are the roots of a polynomial in closed form, JOUK, QUAD, RAT2, RAT3 and RAT4 (InvOps' opJouk,
// opQuad, opRat2, opRatN), and the polynomial root solvers RAT3 and RAT4 call. GLChain.buildInverse (glsl.js) asks for
// each such op's functions (opFns) and uInv values (opValues), and puts IX_ROOTS into a program that has an op of RAT_N.
const GLRoots = (() => {
  // the roots of the RAT3 and RAT4 ops' polynomials (InvOps.cubicRoots, quarticRoots), in a program that has one: of the
  // degree n the op gives (its _deg, InvOps.ratPoly's drop), root b of the linear polynomial, of the stable quadratic,
  // of Cardano's formula or of Ferrari's (its resolvent's root of largest modulus by Cardano's), each closed formula on
  // the reversed polynomial (roots 1/u) when its leading coefficient is the smaller end (InvOps.closedRoots), and every
  // root polished by up to two Newton steps on the polynomial itself (float32: the shifts and the cube root lose digits
  // that the steps win back). A step is taken only when it lowers |p(u)|: near a multiple root p'(u) is small and p(u)
  // is float32's rounding of its terms, so a step there is that rounding over p' and can throw an exact root far off,
  // where that rounding is not 0 (a GPU that fuses or reorders the products)
  const RAT_N = new Set(['RAT3', 'RAT4']), RAT_NEAR = '1e-2', F32_EPS = '5.96e-8';
  const IX_ROOTS = `
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
  for (int it = 0; it < 2; it++) {
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
  for (int it = 0; it < 2; it++) {
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
  // GLSL of the functions of op o, prefix P (ixJ): ixJ_nb(L), the number of members over L.u, and ixJ_one_b(L, b), which
  // applies member b; U(i): the GLSL of the op's i-th uInv cell; NOR: ixApply's arguments after the derivative for a
  // member with no level (GLChain's invOpFns)
  function opFns(o, P, U, NOR) {
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
  if (cx_abs(A) <= 1e-14 * (cx_abs(B) + cx_abs(Cc))) { if (cx_abs(B) > 0.0) { r0 = -cdiv(Cc, B); return 1; } return 0; }
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
      // coefficient dropped when it cancels, at most 1e-14 of |p_k| + |w| |q_k|), its root b by IX_ROOTS. A root b > 0 near a
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
        const F = n === 3 ? 'ixCubic' : 'ixQuartic', deg = [...Array(n).keys()].map((k) => `  if (cx_abs(${cf(k)}) > 1e-14 * (cx_abs(${co(k, 0)}) + aw * cx_abs(${co(k, half)}))) return ${n - k};\n`).join('');
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
    throw new Error('GLRoots: no GLSL for op ' + o.kind);
  }
  // the uInv values of op o (its parameters o.p) from cell c, put(cell, x, y, z, w) for each cell: the layout opFns reads
  // (glsl.js's IX_SLOTS holds each op's number of cells)
  function opValues(o, put, c) {
    const p = o.p || {};
    const z = (v) => v || CX.C(0, 0);
    switch (o.kind) {
      case 'QUAD': put(c, p.a.re, p.a.im, p.b.re, p.b.im); put(c + 1, p.c.re, p.c.im, 0, 0); break;
      case 'RAT2': {
        const [P0, P1, P2] = p.P.map(z), [Q0, Q1, Q2] = p.Q.map(z);
        put(c, P0.re, P0.im, P1.re, P1.im); put(c + 1, P2.re, P2.im, Q0.re, Q0.im); put(c + 2, Q1.re, Q1.im, Q2.re, Q2.im);
        break;
      }
      case 'RAT3': case 'RAT4': {
        const half = Math.ceil(p.P.length / 2), cells = (co, from) => { for (let k = 0; k < co.length; k += 2) { const a = z(co[k]), b = z(co[k + 1]); put(from + k / 2, a.re, a.im, b.re, b.im); } };
        cells(p.P, c); cells(p.Q, c + half);
        break;
      }
    }
  }
  return { IX_ROOTS, RAT_N, opFns, opValues };
})();
import { CX } from './cx.js';
export { GLRoots };

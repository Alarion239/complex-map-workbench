  // =================================================================================================================
  // Exact images: the per-pixel inverse walk (notes/sphere-design/SPEC.md 4.1). GLChain.build(...).inverse holds
  //   key     Inverse.inverseKey(steps, built): the op structure of every live step ('X' for a step without an
  //           enumerator); parameter values (and ROOTPOW's mode) are uniforms, so a parameter change keeps it
  //   lib     uInv[] and the per-op uniforms, INV_LIB, and the per-op functions ixJ_* (no walker)
  //   walker  invWalk(w): the static loop nest over the full op list, outermost op first; gl.js places it after its
  //           INV_HEAD (which defines invLeaf, ixRangeAdd / ixRangeLog, ixStopAdd / ixStopLog, ixDK)
  //   nr      the NEWT roots pass of the last NEWT op, {j, targets, main}: its op index, its RGBA32F targets and the
  //           pass's main (a polynomial op's roots, newtRootsMain; another's members 0 and 1, newtGridMain); null
  //           without a NEWT op
  //   ops     [{kind, step, node, j, cell}]: j = op index in forward order, cell = first uInv slot
  //   nOps, slots, fill(out): the op parameters into a Float32Array of 4 slots floats (own allocator, independent
  //           of the forward uChain layout, so an eligibility flip never shifts forward cells)
  // ok false (with reason) when the chain has no inverse program: Inverse missing, or more than OPS_MAX ops.
  // The CPU twin of every function here is src/inverse.js (op table 3.2, enumerate 3.5); test/glsl_inverse_test.js
  // compares them leaf by leaf.
  // =================================================================================================================
  const INV_LIB = `
struct Lf { vec2 u; vec4 J; float lvl; vec2 lg; vec2 lam; vec4 JL; bool hasLam; };
float ixPix;
const float IX_RAMP = 1.0;
const float IX_INF = 1e30;
uniform int uIxA; uniform int uIxB;
bool ixAct(int k) { return uIxA < k && k <= uIxB; }
// neither component is +-inf or NaN (a bit test: GPU compilers may fold NaN comparisons away)
bool ixFin(vec2 u) { highp uvec2 b = floatBitsToUint(u) & 0x7fffffffu; return max(b.x, b.y) < 0x7f800000u; }
// [d.x -d.y; d.y d.x] * J (J = dz/dw row-major: x y / z w)
vec4 ixMulC(vec2 d, vec4 J) { return vec4(d.x * J.x - d.y * J.z, d.x * J.y - d.y * J.w, d.y * J.x + d.x * J.z, d.y * J.y + d.x * J.w); }
vec4 ixConjJ(vec4 J) { return vec4(J.x, J.y, -J.z, -J.w); }
// sqrt|det J| without overflow of the products
float ixScale(vec4 J) {
  float m = max(max(abs(J.x), abs(J.y)), max(abs(J.z), abs(J.w)));
  if (!(m > 0.0)) return 0.0;
  if (m > 1e15 || m < 1e-15) { vec4 K = J / m; return sqrt(abs(K.x * K.w - K.y * K.z)) * m; }
  return sqrt(abs(J.x * J.w - J.y * J.z));
}
// v / |v| (0 for v = 0 or a non-finite v), without overflow
vec2 ixUnit(vec2 v) {
  float m = max(abs(v.x), abs(v.y));
  if (!(m > 0.0) || !(m < 3.4e38)) return vec2(0.0);
  v /= m;
  return v / length(v);
}
Lf ixStart(vec2 w) {
  Lf L;
  L.u = w; L.J = vec4(1.0, 0.0, 0.0, 1.0); L.lvl = 1e38; L.lg = vec2(0.0); L.lam = vec2(0.0); L.JL = vec4(0.0); L.hasLam = false;
  return L;
}
// one member applied to the walk state (Inverse.enumerate's apply): the member's range level converted to image px
// (members below -IX_RAMP are not preimages), its gradient pulled back to the w-plane while it is the binding level,
// the Jacobian dz/dw, and for log-type ops at op 0 Lambda = log z and dLambda/dw
// image px per unit of a range level with gradient lg (at the walk state J): the flat view's pixel is a square of side
// ixPix; a globe's pixel is anisotropic (IX_ANISO, the globe programs: the footprint vectors ixAwX, ixAwY), so the
// level's gradient, pulled back to w, is measured along them. A range rim's ramp then has the true pixel width at
// grazing angles, and the facing rule cancels a healed cut's level against the region's own level (both in pixels)
float ixFoot(vec4 J, vec2 lg) {
#ifdef IX_ANISO
  vec2 g = ixUnit(vec2(J.x * lg.x + J.z * lg.y, J.y * lg.x + J.w * lg.y));
  if (g.x != 0.0 || g.y != 0.0) return ixScale(J) * length(vec2(dot(g, ixAwX), dot(g, ixAwY)));
#endif
  return ixScale(J) * ixPix;
}
bool ixApply(inout Lf L, vec2 u, vec2 d, bool anti, float lvlOut, vec2 lgOut, bool hasLam, vec2 lam, vec2 dlam) {
  float lv = 1e38;
  if (lvlOut < 1e37) {
    // past a critical value (an infinite du/dw: the pixel centre is exactly the image of a critical point) only the
    // sign of the range level is known: it decides
    lv = ixFin(L.J.xy) && ixFin(L.J.zw) ? lvlOut / ixFoot(L.J, lgOut) : (lvlOut > 0.0 ? 1e30 : (lvlOut < 0.0 ? -1e30 : 0.0));
    if (!(lv >= -IX_RAMP)) return false;
    if (lv < L.lvl && (lgOut.x != 0.0 || lgOut.y != 0.0)) L.lg = ixUnit(vec2(L.J.x * lgOut.x + L.J.z * lgOut.y, L.J.y * lgOut.x + L.J.w * lgOut.y));
  }
  if (hasLam) L.JL = ixMulC(dlam, L.J);
  L.J = anti ? ixConjJ(L.J) : ixMulC(d, L.J);
  L.lvl = min(L.lvl, lv);
  L.u = u; L.lam = lam; L.hasLam = hasLam;
  return true;
}
// family bases: cancellation-free principal inverse trig, the forms of Inverse._trig (t1 = iw + s and t2 = s - iw,
// s = sqrt(1 - w^2), satisfy t1 t2 = 1: the factor of larger modulus is a sum without cancellation)
vec2 ix_sqrt1m(vec2 w) {
  float m = max(abs(w.x), abs(w.y));
  if (m > 1e3) { vec2 v = w / m; return m * csqrtp(vec2(1.0 / (m * m), 0.0) - cmul(v, v)); }   // sqrt(c x) = sqrt(c) sqrt(x), c > 0
  return csqrtp(vec2(1.0, 0.0) - cmul(w, w));
}
vec2 ix_asin(vec2 w) {
  vec2 s = ix_sqrt1m(w), iw = vec2(-w.y, w.x);
  vec2 t1 = iw + s, t2 = s - iw;
  vec2 l = cx_abs(t1) >= cx_abs(t2) ? clog(t1, CX_PI, 0.0) : -clog(t2, CX_PI, 0.0);
  return vec2(l.y, -l.x);
}
vec2 ix_asinh(vec2 w) { vec2 s = ix_asin(vec2(-w.y, w.x)); return vec2(s.y, -s.x); }
vec2 ix_atan0(vec2 v) {
  vec2 iv = vec2(-v.y, v.x);
  vec2 d = clog(vec2(1.0, 0.0) - iv, CX_PI, 0.0) - clog(vec2(1.0, 0.0) + iv, CX_PI, 0.0);
  return vec2(-0.5 * d.y, 0.5 * d.x);
}
vec2 ix_atan(vec2 w) {
  if (!(cx_abs(w) > 1.0)) return ix_atan0(w);
  vec2 t = ix_atan0(cinv(w));
  return vec2((w.x < 0.0 ? -CX_HALF_PI : CX_HALF_PI) - t.x, -t.y);
}
vec2 ix_atanh(vec2 w) { vec2 t = ix_atan(vec2(-w.y, w.x)); return vec2(t.y, -t.x); }
const vec2 IX_NOLG = vec2(0.0);
`;
  // the anchor op's offset (Inverse's tanhAnc / tanAnc): tanh w = s - 2 s e / (1 + e), s = sgn Re w, e = exp(-2 s w);
  // log offset = ln 2 + i pi [s > 0] - 2 s w - log(1 + e), d/dw = -2 s / (1 + e); tan w = -i tanh(i w). Set when the
  // anchor op runs: no family lies between it and z (only affine ops), so the leaf reached next is its own.
  const INV_ANC = `uniform int uAncJ;
int ixAncA = -1; vec2 ixAncD; vec2 ixAncL; vec2 ixAncDL;
void ixAncTanh(vec2 w) {
  float sg = w.x >= 0.0 ? 1.0 : -1.0;
  vec2 e = cexp(-2.0 * sg * w), ope = vec2(1.0, 0.0) + e;
  ixAncD = -2.0 * sg * cdiv(e, ope);
  vec2 lo = clog(ope, CX_PI, 0.0);
  ixAncL = vec2(0.6931471805599453 - 2.0 * sg * w.x - lo.x, (sg > 0.0 ? CX_PI : 0.0) - 2.0 * sg * w.y - lo.y);
  ixAncDL = -2.0 * sg * cinv(ope);
  ixAncA = sg > 0.0 ? 0 : 1;
}
void ixAncTan(vec2 w) {
  ixAncTanh(vec2(-w.y, w.x));
  ixAncD = vec2(ixAncD.y, -ixAncD.x);
  ixAncL.y -= CX_HALF_PI;
  ixAncDL = vec2(-ixAncDL.y, ixAncDL.x);
}
`;
  // ops of the op table (SPEC 3.2) by structure: single-valued, finite families (with the static base bound) and
  // additive families (bases per point); ROOTPOW is a log family (its int mode scans one member)
  const IX_SLOTS = { AFF: 1, MOB: 3, NEWT: 1, IPOW: 1, ROOTPOW: 2, EXPC: 1, LOG: 1, IJOUK: 1, QUAD: 2, RAT2: 3 };
  // a NEWT op's member hits w within NEWT_HIT_F (1 + |w|)
  const NEWT_HIT_F = '1e-3';
  const IX_FIN = { IPOW: 16, JOUK: 2, NEWT: 2, QUAD: 2, RAT2: 2 };
  // a NEWT op's seeding ops (its step's own exact ops, InvOps.opNewt's back) and their member counts, or null
  const newtBack = (o) => {
    const back = o.op && o.op.p && o.op.p.back, n = back && Inverse.newtSeedCounts(back);
    return n ? { ops: back, n, seeds: n.reduce((a, k) => a * k, 1) } : null;
  };
  // a polynomial NEWT op's degree (InvOps.opNewt with deg: its members are every root of H_t(u) = w), or 0
  const newtDeg = (o) => (o.kind === 'NEWT' && o.op && o.op.p && o.op.p.deg) || 0;
  // a NEWT op's pole {p, res, reg} (InvOps.opNewt's pole: member 1 starts from the root the pole puts over w), or null; its
  // cells follow the op's t: (p, res), (reg)
  const newtPole = (o) => (o.kind === 'NEWT' && o.op && o.op.p && o.op.p.pole) || null;
  const IX_NEWT_POLE_CELLS = 2;
  // uInv cells of op o: a NEWT op's t, then its seeding ops' cells in turn, or a polynomial one's coefficients two to a cell,
  // or its pole's
  const ixSlots = (o) => {
    const D = newtDeg(o);
    if (D) return IX_SLOTS.NEWT + Math.ceil((D + 1) / 2);
    const bk = o.kind === 'NEWT' && newtBack(o);
    return (IX_SLOTS[o.kind] || 0) + (bk ? bk.ops.reduce((a, q) => a + (IX_SLOTS[q.kind] || 0), 0) : 0) + (newtPole(o) ? IX_NEWT_POLE_CELLS : 0);
  };
  // the member loop's bound of a finite family op: a seeded NEWT op has 1 + seeds members, an unseeded one 2 + the ladder's, a polynomial one its degree
  const ixFinMax = (o) => {
    const D = newtDeg(o);
    if (D) return D;
    const bk = o.kind === 'NEWT' && newtBack(o);
    return bk ? 1 + bk.seeds : o.kind === 'NEWT' ? 2 + Inverse.NEWT_LADDER.length : IX_FIN[o.kind];
  };
  const IX_ADD = { EXP: 1, EXPC: 1, SIN: 2, COS: 2, TAN: 1, SINH: 2, COSH: 2, TANH: 1 };
  const IX_OPS_MAX = 16;
  // the NEWT roots pass's mark of a target entry with no root
  const IX_NR_NONE = '3.0e38';
  // (GLSL literals of the Newton passes: a coordinate below NEWT_FINITE is a root; NEWT_NO_LEVEL is the level of an op's
  // result that carries none; a root within NEWT_DEDUPE (1 + |root|) of an earlier one is the same root; Aberth stops when
  // its step is within NEWT_STEP_TOL (1 + |z|))
  const NEWT_FINITE = '1e37', NEWT_NO_LEVEL = '1e38', NEWT_DEDUPE = '1e-3', NEWT_STEP_TOL = '1e-5';
  // GLSL of a NEWT op's Newton kit, prefix P, homotopy H (H(u, t): GLSL of H_t(u)): _d, H_t' by a central
  // difference; _hit, H_t(u) is w; _fd, H_t' by a forward difference that reuses hu = H_t(u); _step, one Newton step,
  // capped at a quarter of 1 + |u|; _polish, NEWT_POL steps at t; _walkg, member 0 continued from u at grid stage ks
  // (InvOps.opNewt's fixed grid: the stages k / NEWT_K up to k0 = floor(NEWT_K t), ug the root at k0, IX_NR_NONE when
  // the walk failed by then), then one step at t, polished, kept when it hits w; _walk0, member 0 from w; _m0, member
  // 0 where the NEWT roots pass (IX_NR_N, uNrTex0: (ug, u) for the pixel's own w) has it: a stored member that misses w
  // is walked again (the pass's member is the full walk's, so a read is the walk's result; the check guards a target
  // that does not hold this frame's)
  const newtCoreFns = (P, H, rd) => `vec2 ${P}_d(vec2 u, float t) { float h = 1e-3 * (1.0 + cx_abs(u)); return (${H('u + vec2(h, 0.0)', 't')} - ${H('u - vec2(h, 0.0)', 't')}) / (2.0 * h); }
bool ${P}_hit(vec2 u, vec2 w, float t) { return ixFin(u) && cx_abs(${H('u', 't')} - w) <= ${NEWT_HIT_F} * (1.0 + cx_abs(w)); }
vec2 ${P}_fd(vec2 u, vec2 hu, float t) { float h = 1e-3 * (1.0 + cx_abs(u)); return (${H('u + vec2(h, 0.0)', 't')} - hu) / h; }
bool ${P}_step(inout vec2 u, vec2 w, float t) {
  vec2 hu = ${H('u', 't')};
  vec2 d = ${P}_fd(u, hu, t);
  if (!(dot(d, d) > 0.0)) return false;
  vec2 st = cdiv(hu - w, d);
  float sl = cx_abs(st), mx = 0.25 * (1.0 + cx_abs(u));
  u -= sl > mx ? st * (mx / sl) : st;
  return ixFin(u);
}
bool ${P}_polish(inout vec2 u, vec2 w, float t) {
  bool ok = true;
  for (int it = 0; it < ${Inverse.NEWT_POL}; it++) {
    if (!ok) break;
    vec2 p = u;
    ok = ${P}_step(u, w, t);
    if (ok && cx_abs(u - p) <= ${NEWT_STEP_TOL} * (1.0 + cx_abs(u))) break;
  }
  return ok;
}
bool ${P}_settle(inout vec2 u, vec2 w, float t) { return ${P}_polish(u, w, t) && ${P}_hit(u, w, t); }
bool ${P}_land(inout vec2 u, vec2 w, float t) {
  bool ok = true;
  for (int it = 0; it < ${Inverse.NEWT_LAD}; it++) {
    if (!ok) break;
    vec2 p = u;
    ok = ${P}_step(u, w, t);
    if (ok && cx_abs(u - p) <= ${NEWT_STEP_TOL} * (1.0 + cx_abs(u))) break;
  }
  return ok && ${P}_settle(u, w, t);
}
bool ${P}_walkg(vec2 w, float t, int ks, inout vec2 u, out vec2 ug) {
  int k0 = min(${Inverse.NEWT_K}, int(floor(${Inverse.NEWT_K}.0 * t)));
  bool ok = true;
  for (int k = 1; k <= ${Inverse.NEWT_K}; k++) { if (k > k0) break; if (k > ks && ok) ok = ${P}_step(u, w, float(k) / ${Inverse.NEWT_K}.0); }
  ug = ok ? u : vec2(${IX_NR_NONE});
  if (ok) ok = ${P}_step(u, w, t);
  return ok && ${P}_settle(u, w, t);
}
bool ${P}_walk0(vec2 w, float t, out vec2 u) {
  vec2 ug;
  u = w;
  return ${P}_walkg(w, t, 0, u, ug);
}
bool ${P}_m0(vec2 w, float t, out vec2 u) {
${rd ? `#if defined(IX_NR_N) && !defined(IX_NR_PASS)
  if (uNrRead == 1 && w == ixPixW) {
    u = texelFetch(uNrTex0, ixNrTexel, 0).zw;
    if (!(abs(u.x) < ${NEWT_FINITE})) return false;
    if (${P}_hit(u, w, t)) return true;
  }
#endif
` : ''}  return ${P}_walk0(w, t, u);
}
`;
  // GLSL of a NEWT op whose step's own exact ops bk.ops seed walks back from t = 1 (InvOps.opNewt with back): member 0
  // continued in t from w, member 1 + i continued from 1 down to t from f's i-th point over w (bk.ops' members, mixed
  // radix with the last op's member least significant). _roots walks every member once per w and keeps the roots;
  // a member equal to an earlier one is dropped (newtCoreFns: the Newton steps and the members' derivative)
  function newtSeededFns(o, j, c, bk, H, rd) {
    const P = `ix${j}`, NB = 1 + bk.seeds, K = Inverse.NEWT_K;
    const NOR = 'false, 1e38, IX_NOLG, false, vec2(0.0), vec2(0.0)';
    let cell = c + IX_SLOTS.NEWT;
    const fns = bk.ops.map((q, n) => { const t = invOpFns({ kind: q.kind, step: o.step }, `${j}s${n}`, cell); cell += IX_SLOTS[q.kind] || 0; return t; }).join('');
    const seedSteps = [];
    for (let n = bk.ops.length - 1; n >= 0; n--) {
      const Q = `ix${j}s${n}`;
      if (bk.n[n] === 1 && !IX_FIN[bk.ops[n].kind]) seedSteps.push(`  if (!${Q}_one(S)) return false;`);
      else seedSteps.push(`  if (!${Q}_one_b(S, i % ${bk.n[n]})) return false;`, `  i /= ${bk.n[n]};`);
    }
    return `vec2 chainHom(int i, vec2 z, float t);
${fns}${newtCoreFns(P, H, rd)}bool ${P}_seed(vec2 w, int i, out vec2 u) {
  Lf S = ixStart(w);
${seedSteps.join('\n')}
  u = S.u;
  return ixFin(u);
}
bool ${P}_has = false;
vec2 ${P}_w = vec2(0.0);
vec2 ${P}_r[${NB}];
bool ${P}_k[${NB}];
void ${P}_roots(vec2 w, float t) {
  if (${P}_has && ${P}_w == w) return;
  ${P}_has = true; ${P}_w = w;
  vec2 u;
  ${P}_k[0] = ${P}_m0(w, t, u);
  ${P}_r[0] = u;
  int kb = max(1, int(ceil(${K}.0 * (1.0 - t))));
  for (int i = 0; i < ${bk.seeds}; i++) {
    vec2 v;
    bool okv = ${P}_seed(w, i, v);
    for (int k = 1; k <= ${K}; k++) { if (k > kb) break; if (okv) okv = ${P}_step(v, w, 1.0 - (1.0 - t) * float(k) / float(kb)); }
    okv = okv && ${P}_settle(v, w, t);
    for (int m = 0; m < ${NB}; m++) { if (m > i) break; if (okv && ${P}_k[m] && cx_abs(v - ${P}_r[m]) <= ${NEWT_DEDUPE} * (1.0 + cx_abs(${P}_r[m]))) okv = false; }
    ${P}_r[i + 1] = v; ${P}_k[i + 1] = okv;
  }
}
int ${P}_nb(Lf L) { return ixFin(L.u) ? ${NB} : 0; }
bool ${P}_one_b(inout Lf L, int b) {
  vec2 w = L.u;
  float t = uInv[${c}].x;
  ${P}_roots(w, t);
  if (!${P}_k[b]) return false;
  vec2 u = ${P}_r[b];
  return ixApply(L, u, cinv(${P}_d(u, t)), ${NOR});
}
`;
  }
  // GLSL of a polynomial NEWT op of degree D (InvOps.opNewt with deg): uInv[c] = (t, de), H_t's degree at t; then its
  // coefficients a_0 ... a_D, two to a cell from uInv[c + 1] (a_k: .xy for even k, .zw for odd). _a, a_k with w taken off
  // a_0; _ev, a(u) - w and its derivative (Horner); _start, de points on the circle of Fujiwara's bound; _aberth, Aberth's
  // sweeps over z, at most its, until every step is within 1e-5 (1 + |z_i|) (InvOps.newtAberth's iteration in float32,
  // whose rounding the tolerance allows); _roots, every root for w, polished and checked by Newton on H_t itself
  // (newtCoreFns, chainHom) and kept when it differs from every earlier one, once per w. With the NEWT roots pass
  // (IX_NR_N, 07-inverse-api.js; nr of buildInverse): that pass (IX_NR_PASS) starts Aberth's sweeps from the previous
  // frame's roots of its pixel (uNrPrev*), from the circle when they do not all settle, and writes the kept roots, two
  // to a target (IX_NR_NONE where none); the inverse program reads them (uNrTex*) where the op's input is the pixel's
  // own w, and finds them itself elsewhere and where a root read misses w
  function newtPolyFns(o, j, c, D, H, rd) {
    const P = `ix${j}`, NOR = `false, ${NEWT_NO_LEVEL}, IX_NOLG, false, vec2(0.0), vec2(0.0)`, T = Math.ceil(D / 2);
    const fetch = (tex) => Array.from({ length: T }, (_, k) => `#if IX_NR_N > ${k}
    { vec4 q = texelFetch(${tex}${k}, ixNrTexel, 0); z[${2 * k}] = q.xy;${2 * k + 1 < D ? ` z[${2 * k + 1}] = q.zw;` : ''} }
#endif`).join('\n');
    return `vec2 chainHom(int i, vec2 z, float t);
${newtCoreFns(P, H, false)}vec2 ${P}_a(int k, vec2 w) {
  vec4 v = uInv[${c + 1} + k / 2];
  vec2 a = (k & 1) == 0 ? v.xy : v.zw;
  return k == 0 ? a - w : a;
}
void ${P}_ev(vec2 u, vec2 w, int de, out vec2 q, out vec2 dq) {
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
bool ${P}_has = false;
vec2 ${P}_w = vec2(0.0);
vec2 ${P}_r[${D}];
bool ${P}_k[${D}];
void ${P}_roots(vec2 w, float t) {
  if (${P}_has && ${P}_w == w) return;
  ${P}_has = true; ${P}_w = w;
  int de = int(uInv[${c}].y);
  vec2 z[${D}];
#if ${rd ? 1 : 0} && defined(IX_NR_N) && !defined(IX_NR_PASS) && IX_NR_N >= ${T}
  if (uNrRead == 1 && w == ixPixW) {
${fetch('uNrTex')}
    bool good = true;
    for (int i = 0; i < ${D}; i++) {
      ${P}_r[i] = z[i]; ${P}_k[i] = abs(z[i].x) < ${NEWT_FINITE};
      if (${P}_k[i] && !${P}_hit(z[i], w, t)) good = false;
    }
    if (good) return;
  }
#endif
  bool got = false;
#if ${rd ? 1 : 0} && defined(IX_NR_PASS) && IX_NR_N >= ${T}
  if (uNrPrevOn == 1) {
    vec2 z0[${D}];
    ${P}_start(w, de, z0);
${fetch('uNrPrev')}
    for (int i = 0; i < ${D}; i++) if (!(abs(z[i].x) < ${NEWT_FINITE})) z[i] = z0[i];
    got = ${P}_aberth(w, de, z, ${Inverse.NEWT_ABERTH_IT});
  }
#endif
  if (!got) {
    ${P}_start(w, de, z);
    ${P}_aberth(w, de, z, ${Inverse.NEWT_ABERTH_IT});
  }
  for (int i = 0; i < ${D}; i++) {
    vec2 v = z[i];
    bool ok = i < de && ixFin(v) && ${P}_settle(v, w, t);
    for (int m = 0; m < ${D}; m++) { if (m >= i) break; if (ok && ${P}_k[m] && cx_abs(v - ${P}_r[m]) <= ${NEWT_DEDUPE} * (1.0 + cx_abs(${P}_r[m]))) ok = false; }
    ${P}_r[i] = v; ${P}_k[i] = ok;
  }
}
int ${P}_nb(Lf L) { return ixFin(L.u) ? ${D} : 0; }
bool ${P}_one_b(inout Lf L, int b) {
  vec2 w = L.u;
  float t = uInv[${c}].x;
  ${P}_roots(w, t);
  if (!${P}_k[b]) return false;
  vec2 u = ${P}_r[b];
  return ixApply(L, u, cinv(${P}_d(u, t)), ${NOR});
}
`;
  }
  // the NEWT roots pass's main (07-inverse-api.js, IX_NR_PASS) for polynomial NEWT op j of degree D at cell c: the
  // pixel's w as INV_MAIN's flat one, its roots (newtPolyFns' _roots), two to a target
  function newtRootsMain(j, c, D) {
    const P = `ix${j}`, T = Math.ceil(D / 2), R = (i) => (i < D ? `${P}_k[${i}] ? ${P}_r[${i}] : vec2(${IX_NR_NONE})` : `vec2(${IX_NR_NONE})`);
    return `
void main() {
  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);
  ixPixW = w; ixNrTexel = ivec2(gl_FragCoord.xy - uVp.xy);
  ${P}_roots(w, uInv[${c}].x);
${Array.from({ length: T }, (_, k) => `#if IX_NR_N > ${k}
  o${k || ''} = vec4(${R(2 * k)}, ${R(2 * k + 1)});
#endif`).join('\n')}
}
`;
  }
  // the NEWT roots pass's main (07-inverse-api.js, IX_NR_PASS) for NEWT op j at cell c with no polynomial degree:
  // the pixel's w as INV_MAIN's flat one; member 0's grid walk (newtCoreFns' _walkg) resumed from the previous frame's
  // root at its last grid stage kp (uNrPrev0.xy, uNrPrev1.x) when kp is at most this frame's k0, else from w (the root
  // found is the full walk's either way); o = (the root at k0, member 0), o1 = (k0, 0, member 1: deflated, an op with
  // no seeding ops), IX_NR_NONE where none
  function newtGridMain(j, c, seeded, pole) {
    const P = `ix${j}`, K = Inverse.NEWT_K, NONE = `vec2(${IX_NR_NONE})`;
    return `
void main() {
  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);
  ixPixW = w; ixNrTexel = ivec2(gl_FragCoord.xy - uVp.xy);
  float t = uInv[${c}].x;
  int k0 = min(${K}, int(floor(${K}.0 * t)));
  vec2 u = w, ug;
  int ks = 0;
#if IX_NR_N >= 2
  if (uNrPrevOn == 1) {
    vec2 up = texelFetch(uNrPrev0, ixNrTexel, 0).xy;
    int kp = int(texelFetch(uNrPrev1, ixNrTexel, 0).x);
    if (abs(up.x) < ${NEWT_FINITE} && kp >= 0 && kp <= k0) { u = up; ks = kp; }
  }
#endif
  bool ok = ${P}_walkg(w, t, ks, u, ug);
  o = vec4(ug, ok ? u : ${NONE});
#if IX_NR_N >= 2
  vec2 v = ${NONE};
${seeded ? '' : pole ? `  vec2 v1;
  if (${P}_pole2(w, t, ok, u, v1)) v = v1;
` : `  vec2 v1;
  if (ok && ${P}_defl(w, t, u, v1)) v = v1;
`}  o1 = vec4(float(k0), 0.0, v);
#endif
}
`;
  }
  // GLSL of the per-op functions of op j (forward index) with parameters at uInv[c ...]; rd: the op is the NEWT roots
  // pass's (buildInverse's nr), whose members its functions read
  function invOpFns(o, j, c, rd) {
    const P = `ix${j}`, U = (i) => `uInv[${c + i}]`;
    const lam0 = j === 0 ? 'true' : 'false';
    const NOR = 'false, 1e38, IX_NOLG, false, vec2(0.0), vec2(0.0)';
    const one = (body) => `bool ${P}_one(inout Lf L) {\n  if (!ixFin(L.u)) return false;\n  vec2 w = L.u;\n${body}\n}\n`;
    const rng = (u, d, lvl, lg) => `  return ixApply(L, ${u}, ${d}, false, ${lvl}, ${lg}, false, vec2(0.0), vec2(0.0));`;
    const sg = (x) => `(${x} < 0.0 ? 1.0 : -1.0)`;   // -sgn(x), sgn(0) = 1 (Inverse's sgn)
    switch (o.kind) {
      case 'X': return `bool ${P}_one(inout Lf L) { return false; }\n`;
      // (Inverse's opNewt walks: step o.step's homotopy, chainHom, which the carried colour's program compiles in after
      // this, hence its declaration; member 0 continued in t from w, member 1 deflated by member 0. A Newton step takes
      // H' by a forward difference (_fd) that reuses H_t(u), two evaluations of H, and is capped at a quarter of
      // 1 + |u|; the members' derivative is a central one. _root keeps member 0's walk for its w, so member 1 does not
      // walk again)
      case 'NEWT': {
        const H = (u, t) => `chainHom(${o.step}, ${u}, ${t})`;
        const D = newtDeg(o);
        if (D) return newtPolyFns(o, j, c, D, H, rd);
        const bk = newtBack(o);
        if (bk) return newtSeededFns(o, j, c, bk, H, rd);
        const NL = Inverse.NEWT_LADDER.length, NB = 2 + NL, pole = newtPole(o);
        return `vec2 chainHom(int i, vec2 z, float t);
${newtCoreFns(P, H, rd)}bool ${P}_has = false, ${P}_ok = false;
vec2 ${P}_w = vec2(0.0), ${P}_u = vec2(0.0);
bool ${P}_root(vec2 w, float t, out vec2 u) {
  if (${P}_has && ${P}_w == w) { u = ${P}_u; return ${P}_ok; }
  bool ok = ${P}_m0(w, t, u);
  ${P}_has = true; ${P}_w = w; ${P}_u = u; ${P}_ok = ok;
  return ok;
}
// member 1: Newton deflated by member 0's u, from 2w - u
bool ${P}_defl(vec2 w, float t, vec2 u, out vec2 v) {
  v = 2.0 * w - u;
  for (int it = 0; it < ${Inverse.NEWT_DEF}; it++) {
    vec2 hv = ${H('v', 't')};
    vec2 g = cdiv(${P}_fd(v, hv, t), hv - w) - cinv(v - u);
    if (!(dot(g, g) > 0.0)) return false;
    v -= cinv(g);
    if (!ixFin(v)) return false;
  }
  return ${P}_hit(v, w, t) && cx_abs(v - u) > ${NEWT_DEDUPE} * (1.0 + cx_abs(u));
}
${pole ? `// member 1 of a step with a simple pole (InvOps.opNewt's pole): Newton from the root the pole puts over w; kept when it
// hits w and, when member 0 exists (k0), differs from it
bool ${P}_pole2(vec2 w, float t, bool k0, vec2 u, out vec2 v) {
  vec4 pa = uInv[${c + IX_SLOTS.NEWT}], pb = uInv[${c + IX_SLOTS.NEWT + 1}];
  vec2 d = w - (1.0 - t) * pa.xy - t * pb.xy;
  v = vec2(0.0);
  if (!(dot(d, d) > 0.0)) return false;
  v = pa.xy + t * cdiv(pa.zw, d);
  bool okv = ${P}_land(v, w, t);
  return okv && !(k0 && cx_abs(v - u) <= ${NEWT_DEDUPE} * (1.0 + cx_abs(u)));
}
` : ''}vec2 ${P}_r[${NB}];
bool ${P}_k[${NB}];
void ${P}_roots(vec2 w, float t) {
  if (${P}_has && ${P}_w == w) return;
  ${P}_has = true; ${P}_w = w;
  vec2 u, v = vec2(0.0);
  ${P}_k[0] = ${P}_root(w, t, u);
  ${P}_r[0] = u;
  ${P}_k[1] = ${pole ? `${P}_pole2(w, t, ${P}_k[0], u, v)` : `${P}_k[0] && ${P}_defl(w, t, u, v)`};
  ${P}_r[1] = v;
  vec4 an = uInv[${c}];
  bool anch = an.y >= an.w;
  vec2 lo = anch ? vec2(an.z, an.w) : vec2(w.x / (1.0 - t), w.y / (1.0 - t) - ${Inverse.NEWT_SPAN.toFixed(1)});
  float span = anch ? an.y - an.w : ${(2 * Inverse.NEWT_SPAN).toFixed(1)};
  float lad[${NL}] = float[${NL}](${Inverse.NEWT_LADDER.map((d) => d.toFixed(6)).join(', ')});
  for (int i = 0; i < ${NL}; i++) {
    vec2 v = lo + vec2(0.0, span * lad[i]);
    bool okv = ${P}_land(v, w, t);
    for (int m = 0; m < ${NB}; m++) { if (m >= i + 2) break; if (okv && ${P}_k[m] && cx_abs(v - ${P}_r[m]) <= ${NEWT_DEDUPE} * (1.0 + cx_abs(${P}_r[m]))) okv = false; }
    ${P}_r[i + 2] = v; ${P}_k[i + 2] = okv;
  }
}
int ${P}_nb(Lf L) { return ixFin(L.u) ? ${NB} : 0; }
bool ${P}_one_b(inout Lf L, int b) {
  vec2 w = L.u;
  float t = ${U(0)}.x;
  ${P}_roots(w, t);
  if (!${P}_k[b]) return false;
  vec2 u = ${P}_r[b];
  return ixApply(L, u, cinv(${P}_d(u, t)), ${NOR});
}
`;
      }
      case 'AFF': return one(`  vec4 P = ${U(0)};\n  return ixApply(L, cmul(w - P.zw, P.xy), P.xy, ${NOR});`);
      case 'MOB': return one(`  vec4 P0 = ${U(0)}, P1 = ${U(1)};
  vec2 den = P1.zw - cmul(P1.xy, w);
  if (den.x == 0.0 && den.y == 0.0) return false;
  return ixApply(L, cdiv(cmul(P0.xy, w) - P0.zw, den), cdiv(cdiv(${U(2)}.xy, den), den), ${NOR});`);
      case 'LOG': return one(`  vec2 P = ${U(0)}.xy, u = cexp(w);
  float a = w.y - P.x, b = P.y - w.y;
  return ixApply(L, u, u, false, min(a, b), a < b ? vec2(0.0, 1.0) : vec2(0.0, -1.0), ${lam0}, w, vec2(1.0, 0.0));`);
      case 'ASIN': return one(rng('csin(w)', 'ccos(w)', 'CX_HALF_PI - abs(w.x)', `vec2(${sg('w.x')}, 0.0)`));
      case 'ACOS': return one(`  bool lo = w.x < CX_PI - w.x;\n${rng('ccos(w)', '-csin(w)', 'lo ? w.x : CX_PI - w.x', 'vec2(lo ? 1.0 : -1.0, 0.0)')}`);
      case 'ATAN': return one(`  vec2 c = ccos(w);\n  if (uAncJ == ${j}) ixAncTan(w);\n${rng('ctan(w)', 'cinv(cmul(c, c))', 'CX_HALF_PI - abs(w.x)', `vec2(${sg('w.x')}, 0.0)`)}`);
      case 'ASINH': return one(rng('csinh(w)', 'ccosh(w)', 'CX_HALF_PI - abs(w.y)', `vec2(0.0, ${sg('w.y')})`));
      case 'ACOSH': return one(`  float a = w.x, b = CX_PI - abs(w.y);\n${rng('ccosh(w)', 'csinh(w)', 'min(a, b)', `a < b ? vec2(1.0, 0.0) : vec2(0.0, ${sg('w.y')})`)}`);
      case 'ATANH': return one(`  vec2 c = ccosh(w);\n  if (uAncJ == ${j}) ixAncTanh(w);\n${rng('ctanh(w)', 'cinv(cmul(c, c))', 'CX_HALF_PI - abs(w.y)', `vec2(0.0, ${sg('w.y')})`)}`);
      case 'IJOUK': return one(`  float s = ${U(0)}.x;
  vec2 u = (w + cinv(w)) * 0.5;
  if (!ixFin(u)) return false;
  float r = cx_abs(w);
${rng('u', '(vec2(1.0, 0.0) - cinv(cmul(w, w))) * 0.5', 's * (r - 1.0)', 'w * (s / (r > 0.0 ? r : 1.0))')}`);
      case 'CONJ': return one('  return ixApply(L, vec2(w.x, -w.y), vec2(0.0), true, 1e38, IX_NOLG, false, vec2(0.0), vec2(0.0));');
      // ---- finite families: ixJ_nb(L) members, ixJ_one_b(L, b) applies member b ----
      case 'IPOW': return `int ${P}_nb(Lf L) {
  if (!ixFin(L.u)) return 0;
  vec4 P = ${U(0)};
  if (L.u.x == 0.0 && L.u.y == 0.0) return P.x > 0.0 ? 1 : 0;
  return int(P.y + 0.5);
}
bool ${P}_one_b(inout Lf L, int b) {
  vec4 P = ${U(0)};
  vec2 w = L.u;
  if (w.x == 0.0 && w.y == 0.0) return ixApply(L, vec2(0.0), vec2(cx_inf(), 0.0), ${NOR});
  vec2 q = P.x > 0.0 ? w : cinv(w);
  float r = pow(cx_abs(q), P.z), th = (carg(q) + CX_TAU * float(b)) * P.z;
  vec2 u = r * vec2(cos(th), sin(th));
  // one Newton step for u^n = q, u += (q / u^(n-1) - u) / n (products only): pow is exp2(log2(x) y) on the GPU, good
  // to about 1e-4, and that moved the image's edge by 1e-4 |w| (400 px for z^3 at |w| = 98, s = 3e4: issue #72, the
  // quality scene cube_far_deep); the step squares the error, to float32's own
  vec2 un = vec2(1.0, 0.0);
  for (int i = 1; i < max(16, uNoUnroll); i++) { if (float(i) >= P.y) break; un = cmul(un, u); }
  vec2 u1 = u + (cdiv(q, un) - u) / P.y;
  if (ixFin(u1)) u = u1;
  return ixApply(L, u, cdiv(u, P.x * w), ${NOR});
}
`;
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
      // ---- log family (ROOTPOW): L_m = u0 + m st with u0 = beta Log w, st = S = 2 pi i beta, d0 = beta / w ----
      case 'ROOTPOW': return `int ${P}_nb(Lf L) { return ixFin(L.u) && (L.u.x != 0.0 || L.u.y != 0.0) ? 1 : 0; }
bool ${P}_line(Lf L, int b, out vec2 u0, out vec2 st, out vec2 d0) {
  vec4 P = ${U(0)};
  u0 = cmul(P.xy, clog(L.u, CX_PI, 0.0)); st = ${U(1)}.zw; d0 = cdiv(P.xy, L.u);
  return ixFin(u0);
}
bool ${P}_at(Lf L, float m, vec2 u0, vec2 st, vec2 d0, inout Lf R) {
  vec4 P = ${U(0)};
  vec2 Lm = u0 + m * st, u = cexp(Lm);
  ${j === 0 ? '' : 'if (!ixFin(u)) return false;'}
  float a = Lm.y - P.z, b = P.w - Lm.y;
  vec2 g = ixUnit(vec2(d0.y, d0.x));
  R = L;
  return ixApply(R, u, cmul(d0, u), false, min(a, b) * ${U(1)}.x * cx_abs(L.u), a < b ? g : -g, ${lam0}, Lm, d0);
}
`;
    }
    if (IX_ADD[o.kind]) {
      // ---- additive families: members u = u0 + m st of base b; d0 = du/dw (the same for every member of a base) ----
      const nbFin = 'ixFin(L.u)';
      let nb, line;
      switch (o.kind) {
        case 'EXP': nb = `${nbFin} && (L.u.x != 0.0 || L.u.y != 0.0) ? 1 : 0`; line = 'u0 = clog(w, CX_PI, 0.0); st = vec2(0.0, CX_TAU); d0 = cinv(w);'; break;
        case 'EXPC': nb = `${nbFin} && (L.u.x != 0.0 || L.u.y != 0.0) ? 1 : 0`; line = `vec4 P = ${U(0)};\n  u0 = cmul(clog(w, CX_PI, 0.0), P.xy); st = P.zw; d0 = cdiv(P.xy, w);`; break;
        case 'SIN': nb = `${nbFin} ? 2 : 0`; line = 'vec2 a = ix_asin(w), s = ix_sqrt1m(w);   // cos(asin w) = sqrt(1 - w^2)\n  u0 = b == 0 ? a : vec2(CX_PI, 0.0) - a; st = vec2(CX_TAU, 0.0); d0 = cinv(b == 0 ? s : -s);'; break;
        case 'COS': nb = `${nbFin} ? 2 : 0`; line = 'vec2 a = vec2(CX_HALF_PI, 0.0) - ix_asin(w), s = ix_sqrt1m(w);   // sin(acos w) = sqrt(1 - w^2)\n  u0 = b == 0 ? a : -a; st = vec2(CX_TAU, 0.0); d0 = cinv(b == 0 ? -s : s);'; break;
        case 'TAN': nb = `${nbFin} && !(L.u.x == 0.0 && abs(L.u.y) == 1.0) ? 1 : 0`; line = 'u0 = ix_atan(w); st = vec2(CX_PI, 0.0); d0 = cinv(vec2(1.0, 0.0) + cmul(w, w));'; break;
        case 'SINH': nb = `${nbFin} ? 2 : 0`; line = 'vec2 a = ix_asinh(w), s = ix_sqrt1m(vec2(-w.y, w.x));   // cosh(asinh w) = sqrt(1 + w^2)\n  u0 = b == 0 ? a : vec2(0.0, CX_PI) - a; st = vec2(0.0, CX_TAU); d0 = cinv(b == 0 ? s : -s);'; break;
        case 'COSH': nb = `${nbFin} ? 2 : 0`; line = 'vec2 s = cmul(csqrtp(w - vec2(1.0, 0.0)), csqrtp(w + vec2(1.0, 0.0)));   // sinh(acosh w)\n  vec2 a = clog(w + s, CX_PI, 0.0);\n  u0 = b == 0 ? a : -a; st = vec2(0.0, CX_TAU); d0 = cinv(b == 0 ? s : -s);'; break;
        case 'TANH': nb = `${nbFin} && !(L.u.y == 0.0 && abs(L.u.x) == 1.0) ? 1 : 0`; line = 'u0 = ix_atanh(w); st = vec2(0.0, CX_PI); d0 = cinv(vec2(1.0, 0.0) - cmul(w, w));'; break;
      }
      return `int ${P}_nb(Lf L) { return ${nb}; }
bool ${P}_line(Lf L, int b, out vec2 u0, out vec2 st, out vec2 d0) {
  vec2 w = L.u;
  ${line}
  return ixFin(u0);
}
bool ${P}_at(Lf L, float m, vec2 u0, vec2 st, vec2 d0, inout Lf R) {
  vec2 u = u0 + m * st;
  if (!ixFin(u)) return false;
  R = L;
  return ixApply(R, u, d0, false, 1e38, IX_NOLG, false, vec2(0.0), vec2(0.0));
}
`;
    }
    throw new Error('GLChain inverse: no GLSL for op ' + o.kind);
  }
  // the walker: one loop per multivalued op, nested outermost op first; inactive ops (step outside (uIxA, uIxB]) pass
  // the state through (single-valued: skipped; multivalued: one iteration). Mirrors Inverse.enumerate's rec().
  function invWalkerSrc(ops) {
    const N = ops.length, out = ['void invWalk(vec2 w) {', `  Lf L${N} = ixStart(w);`];
    const fams = [];       // enclosing family loops (window-type: additive and log), innermost last
    const emit = (j, cur, d, inLoop) => {
      const ind = '  '.repeat(d);
      const exit = inLoop ? 'continue;' : 'return;';
      if (j < 0) {
        out.push(`${ind}bool cv_;`, `${ind}invLeaf(${cur}, cv_);`);
        // every enclosing active family loop counts covering members per direction (the tail closure, 4.1)
        for (const f of fams) out.push(`${ind}if (act${f}) { if (goUp${f}) cU${f} = cv_ ? cU${f} + 1 : 0; else cD${f} = cv_ ? cD${f} + 1 : 0; }`);
        return;
      }
      const o = ops[j], k = o.step, R = `L${j}`, P = `ix${j}`;
      if (!IX_FIN[o.kind] && !IX_ADD[o.kind] && o.kind !== 'ROOTPOW') {
        out.push(`${ind}Lf ${R} = ${cur};`, `${ind}if (ixAct(${k}) && !${P}_one(${R})) ${exit}`);
        emit(j - 1, R, d, inLoop);
        return;
      }
      if (IX_FIN[o.kind]) {
        out.push(`${ind}int nb${j} = ixAct(${k}) ? ${P}_nb(${cur}) : 1;`,
          `${ind}for (int b${j} = 0; b${j} < ${ixFinMax(o)}; b${j}++) {`,
          `${ind}  if (b${j} >= nb${j}) break;`,
          `${ind}  Lf ${R} = ${cur};`,
          `${ind}  if (ixAct(${k}) && !${P}_one_b(${R}, b${j})) continue;`);
        emit(j - 1, R, d + 1, true);
        out.push(`${ind}}`);
        return;
      }
      // window-type family (additive or log): bases, the member range and two cursors (3.5, 3.6)
      const nbMax = o.kind === 'ROOTPOW' ? 1 : IX_ADD[o.kind];
      const isLog = o.kind === 'ROOTPOW';
      const c = o.cell;
      const s = (x) => `${x}${j}`;
      const i2 = ind + '  ', i4 = ind + '    ';
      out.push(`${ind}bool ${s('act')} = ixAct(${k});`,
        `${ind}for (int ${s('b')} = 0; ${s('b')} < ${nbMax}; ${s('b')}++) {`,
        `${i2}if (${s('b')} > 0 && !${s('act')}) break;`,
        `${i2}vec2 ${s('u0')} = vec2(0.0), ${s('st')} = vec2(0.0), ${s('d0')} = vec2(0.0);`,
        `${i2}float ${s('lo')} = 0.0, ${s('hi')} = 0.0, ${s('hl')} = IX_INF, ${s('hh')} = -IX_INF, ${s('ms')} = 0.0;`,
        `${i2}if (${s('act')}) {`,
        `${i2}  if (${s('b')} >= ${P}_nb(${cur})) break;`,
        `${i2}  if (!${P}_line(${cur}, ${s('b')}, ${s('u0')}, ${s('st')}, ${s('d0')})) continue;`,
        isLog
          ? `${i2}  ixRangeLog(${j}, ${cur}, ${s('u0')}, ${s('st')}, uInv[${c}], uInv[${c + 1}], ${s('lo')}, ${s('hi')}, ${s('hl')}, ${s('hh')}, ${s('ms')});`
          : `${i2}  ixRangeAdd(${j}, ${cur}, ${s('u0')}, ${s('st')}, ${s('d0')}, ${s('lo')}, ${s('hi')}, ${s('hl')}, ${s('hh')}, ${s('ms')});`,
        `${i2}  if (${s('lo')} > ${s('hi')}) continue;`,
        `${i2}}`,
        `${i2}float ${s('up')} = ${s('ms')}, ${s('dn')} = ${s('ms')} - 1.0;`,
        `${i2}if (${s('dn')} >= ${s('hl')} && ${s('dn')} <= ${s('hh')}) ${s('dn')} = ${s('hl')} - 1.0;`,
        `${i2}bool ${s('aU')} = !${s('act')} || (${s('up')} >= ${s('lo')} && ${s('up')} <= ${s('hi')});`,
        `${i2}bool ${s('aD')} = ${s('act')} && ${s('dn')} >= ${s('lo')} && ${s('dn')} <= ${s('hi')};`,
        `${i2}int ${s('turn')} = 0, ${s('cU')} = 0, ${s('cD')} = 0, ${s('nmax')} = ${s('act')} ? uIxN[${j}] : 1;`,
        `${i2}bool ${s('goUp')} = true;`,
        `${i2}for (int ${s('t')} = 0; ${s('t')} < 64; ${s('t')}++) {`,
        `${i4}if (${s('t')} >= ${s('nmax')} || !(${s('aU')} || ${s('aD')})) break;`,
        `${i4}if (${s('aU')} && ${s('aD')}) { ${s('goUp')} = (${s('turn')} & 1) == 0; ${s('turn')}++; } else ${s('goUp')} = ${s('aU')};`,
        `${i4}float ${s('m')} = ${s('goUp')} ? ${s('up')} : ${s('dn')};`,
        `${i4}if (${s('goUp')}) { ${s('up')} += 1.0; if (${s('up')} >= ${s('hl')} && ${s('up')} <= ${s('hh')}) ${s('up')} = ${s('hh')} + 1.0; if (${s('up')} > ${s('hi')}) ${s('aU')} = false; }`,
        `${i4}else { ${s('dn')} -= 1.0; if (${s('dn')} >= ${s('hl')} && ${s('dn')} <= ${s('hh')}) ${s('dn')} = ${s('hl')} - 1.0; if (${s('dn')} < ${s('lo')}) ${s('aD')} = false; }`,
        `${i4}Lf ${R} = ${cur};`,
        `${i4}if (${s('act')}) { if (!${P}_at(${cur}, ${s('m')}, ${s('u0')}, ${s('st')}, ${s('d0')}, ${R})) { if (${s('goUp')}) ${s('cU')} = 0; else ${s('cD')} = 0; continue; } }`,
        `${i4}else ${s('aU')} = false;`,
        `${i4}ixLastOk = false;`);
      fams.push(j);
      emit(j - 1, R, d + 2, true);
      fams.pop();
      // the early stop (3.6) against the K-th key, or with K > B the tail rule (gl.js ixDKTail) against the buffer's
      // last key, for a side still in range up to infinity, without a hole, whose last three members covered
      out.push(`${i4}if (${s('act')} && uIxStopOp == ${j} && ixLastOk) {`,
        `${i4}  float ${s('sk')} = ixDK(); bool ${s('tl')} = false;`,
        `${i4}  if (!(${s('sk')} < 1e37) && !(${s('hl')} <= ${s('hh')}) && (${s('goUp')} ? ${s('cU')} >= 3 && ${s('hi')} >= IX_INF : ${s('cD')} >= 3 && ${s('lo')} <= -IX_INF)) { ${s('sk')} = ixDKTail(); ${s('tl')} = true; }`,
        `${i4}  if (${s('sk')} < 1e37 && ${isLog ? `ixStopLog(${j}, ${s('st')}, ${s('goUp')}, ${s('sk')})` : `ixStop${'Add'}(${j}, ${s('st')}, ${s('goUp')}, ${s('u0')} + ${s('m')} * ${s('st')}, ${s('sk')})`}) { if (${s('tl')}) ixTailInf = true; if (${s('goUp')}) ${s('aU')} = false; else ${s('aD')} = false; }`,
        `${i4}}`,
        `${i2}}`,
        `${i2}if (${s('act')} && ((${s('aU')} && ${s('cU')} >= 3) || (${s('aD')} && ${s('cD')} >= 3))) ixTailInf = true;`,
        `${ind}}`);
    };
    emit(N - 1, `L${N}`, 1, false);
    out.push('}');
    return out.join('\n') + '\n';
  }
  // the uInv values of op o (Inverse.stepOps op with its parameters in o.p): see the GLSL above for the layout
  function invOpValues(o, put, c) {
    const p = o.p || {};
    const z = (v) => v || CX.C(0, 0);
    switch (o.kind) {
      case 'AFF': { const ia = CX.inv(p.a); put(c, ia.re, ia.im, p.b.re, p.b.im); break; }
      case 'MOB': {
        const [a, b, cc, d] = CX.mobScaled(p.m), det = CX.sub(CX.mul(a, d), CX.mul(b, cc));
        put(c, d.re, d.im, b.re, b.im); put(c + 1, cc.re, cc.im, a.re, a.im); put(c + 2, det.re, det.im, 0, 0);
        break;
      }
      case 'IPOW': { const an = Math.abs(p.n); put(c, p.n, an, 1 / an, 0); break; }
      case 'ROOTPOW': {
        const beta = p.beta, S = CX.C(-2 * Math.PI * beta.im, 2 * Math.PI * beta.re);
        put(c, beta.re, beta.im, p.lo, p.hi);
        put(c + 1, CX.abs(p.s), p.mode === 'int' ? 0 : p.mode === 'finite' ? 1 : 2, S.re, S.im);
        break;
      }
      case 'EXPC': { const iL = CX.inv(p.L0), st = CX.mul(CX.C(0, 2 * Math.PI), iL); put(c, iL.re, iL.im, st.re, st.im); break; }
      case 'LOG': put(c, p.lo, p.hi, 0, 0); break;
      case 'IJOUK': put(c, p.sg, 0, 0, 0); break;
      case 'NEWT': {
        if (p.deg) {
          put(c, p.t, p.de, 0, 0);
          for (let k = 0; k <= p.deg; k += 2) {
            const a = p.a[k], b = k + 1 <= p.deg ? p.a[k + 1] : CX.C(0, 0);
            put(c + IX_SLOTS.NEWT + k / 2, a.re, a.im, b.re, b.im);
          }
          break;
        }
        put(c, p.t, p.anchor ? p.anchor.y1 : -1, p.anchor ? p.anchor.re : 0, p.anchor ? p.anchor.y0 : 0);
        let cell = c + IX_SLOTS.NEWT;
        for (const q of p.back || []) { invOpValues(q, put, cell); cell += IX_SLOTS[q.kind] || 0; }
        if (p.pole) { put(cell, p.pole.p.re, p.pole.p.im, p.pole.res.re, p.pole.res.im); put(cell + 1, p.pole.reg.re, p.pole.reg.im, 0, 0); }
        break;
      }
      case 'QUAD': put(c, p.a.re, p.a.im, p.b.re, p.b.im); put(c + 1, p.c.re, p.c.im, 0, 0); break;
      case 'RAT2': {
        const [P0, P1, P2] = p.P.map(z), [Q0, Q1, Q2] = p.Q.map(z);
        put(c, P0.re, P0.im, P1.re, P1.im); put(c + 1, P2.re, P2.im, Q0.re, Q0.im); put(c + 2, Q1.re, Q1.im, Q2.re, Q2.im);
        break;
      }
    }
  }
  // generated text by inverse key (it depends on the op structure only): parameter edits rebuild no GLSL
  const invTextCache = new Map();
  function buildInverse(steps, built) {
    // the ops of every live step and the key (the same string as Inverse.inverseKey, from one stepOps per step)
    const ops = [], sigs = [];
    steps.forEach((st, i) => {
      const b = built[i];
      if (!st || st.on === false) { sigs.push('off'); return; }
      if (!b || b.error || !b.def) { sigs.push('err'); return; }
      const r = Inverse.stepOps(b);
      if (!r.ok) { sigs.push('X'); ops.push({ kind: 'X', step: i + 1, node: 0, op: null }); return; }
      sigs.push(r.ops.map(Inverse.opSig));
      r.ops.forEach((o, n) => ops.push({ kind: o.kind, step: i + 1, node: n, op: o }));
    });
    const key = JSON.stringify(['inv2', sigs]);
    if (ops.filter((o) => o.kind !== 'X').length > IX_OPS_MAX) return { ok: false, reason: 'chain too long', key };
    let slots = 0;
    ops.forEach((o, j) => { o.j = j; o.cell = slots; slots += ixSlots(o); });
    const S = Math.max(1, slots), N = Math.max(1, ops.length);
    // compile-time features of this op list (smaller programs): IX_LAM, Lambda = log z can reach a leaf (op 0 is LOG or
    // ROOTPOW); IX_MOB, the Mobius-prefix centre and stop can apply (an additive family whose prefix is AFF / MOB with
    // at least one MOB)
    const lam = ops.length > 0 && (ops[0].kind === 'LOG' || ops[0].kind === 'ROOTPOW');
    const mob = ops.some((o, j) => IX_ADD[o.kind] && ops.slice(0, j).every((q) => q.kind === 'AFF' || q.kind === 'MOB') && ops.slice(0, j).some((q) => q.kind === 'MOB'));
    // IX_ANC: an ATANH / ATAN op can be the saturation anchor of a plan (SPEC 13.12; Inverse.prepare decides, uAncJ
    // names the op): its member records the stable offset from +-1 (+-i) for the leaf (gl.js ixAnchorPx)
    const anc = ops.some((o) => o.kind === 'ATANH' || o.kind === 'ATAN');
    const head = `#define IX_LAM ${lam ? 1 : 0}
#define IX_MOB ${mob ? 1 : 0}
#define IX_ANC ${anc ? 1 : 0}
${anc ? INV_ANC : ''}
uniform vec4 uInv[${S}];
uniform vec2 uIxRef[${N}];   // op inputs' reference points (log families: lambda_ref, SPEC 3.2)
uniform int uIxN[${N}];      // per-op scan budget (3.4)
uniform int uIxRK[${N}];     // range kind: 0 none, 1 clip, 2 box, 3 branch
uniform vec4 uIxAB[${N}];    // clip: (A, B) of u = A z + B
uniform vec4 uIxBox[${N}];   // box: (e, lo, hi), +-1e30 unbounded
uniform int uIxStopOp; uniform vec4 uIxStopMob; uniform vec4 uIxStopT[2];
uniform bool uIxStopMobOn; uniform float uIxPAccInP;
`;
    let txt = invTextCache.get(key);
    if (!txt) {
      // (the NEWT roots pass of the last NEWT op, 07-inverse-api.js draws it: a polynomial one's roots, ceil(D / 2)
      // targets; another's member 0 on the grid and member 1, two)
      const nq = ops.filter((o) => o.kind === 'NEWT').pop(), D = nq ? newtDeg(nq) : 0;
      const nr = !nq ? null : D ? { j: nq.j, targets: Math.ceil(D / 2), main: newtRootsMain(nq.j, nq.cell, D) }
        : { j: nq.j, targets: 2, main: newtGridMain(nq.j, nq.cell, !!newtBack(nq), !!newtPole(nq)) };
      txt = { lib: head + INV_LIB + ops.map((o) => invOpFns(o, o.j, o.cell, o === nq)).join(''), walker: invWalkerSrc(ops), nr };
      invTextCache.set(key, txt);
      if (invTextCache.size > 32) invTextCache.delete(invTextCache.keys().next().value);
    }
    const { lib, walker, nr } = txt;
    let vals = null;
    return {
      ok: true, key, lib, walker, nr, nOps: ops.length, slots: S,
      ops: ops.map((o) => ({ kind: o.kind, step: o.step, node: o.node, j: o.j, cell: o.cell })),
      fill(out) {
        if (!vals) {
          vals = new Float64Array(4 * S);
          const put = (c, a, b, cc, d) => { vals[4 * c] = a; vals[4 * c + 1] = b; vals[4 * c + 2] = cc; vals[4 * c + 3] = d; };
          for (const o of ops) if (o.op) invOpValues(o.op, put, o.cell);
        }
        for (let i = 0; i < vals.length; i++) out[i] = vals[i];
        return out;
      },
    };
  }

  return { LIB, build, buildInverse, mobPathData, levelGLSL, circleRel: GPU_REL, ZETA_LN_K_COUNT, INV_LIB, seriesTrust };

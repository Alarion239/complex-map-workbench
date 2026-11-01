  // ---------- exact images: the per-pixel inverse pass (SPEC 4.2-4.3) ----------
  // Program text: HEAD + GLChain.LIB + inverse.lib + UTIL (+ SHADE_GLOBE on the globe) + INV_HEAD + inverse.walker +
  // INV_MAIN. INV_HEAD defines what the generated walker calls: the member ranges (ixRangeAdd / ixRangeLog, with the
  // shape's clip primitive), the early stop (ixStopAdd / ixStopLog), the sheet key and invLeaf (coverage of one
  // candidate: the region's signed distance in px, the range level, the facing rule, then admission into the
  // compile-time B-entry buffer with shading on admission and the twin merge). The CPU twin is Inverse.enumerate.
  // Shape: per-pass uniforms uShape (kind, complement, polygon vertex count, offset of the vertices in the record),
  // uShA, uShB (drawPreimage's record), uShC (inside at z = 0, boundary through 0, -, -), uFormSlot; the record in
  // the points texture (unit 4) at uShOff holds the clip primitive (header, 2 texels per piece) and polygon vertices.
  // IX_RECORD(L, D, cov) is a hook for the parity test (test/glsl_inverse_test.js), empty here.
  const INV_HEAD = (B, forms) => `
#ifndef IX_RECORD
#define IX_RECORD(L, D, cov)
#endif
const float IX_LN2 = 0.6931471805599453;
const float IX_BIG = 1e9;
#if IX_LAM
#define IX_HASLAM(L) (L).hasLam
#else
#define IX_HASLAM(L) false
#endif
uniform vec4 uVp; uniform vec2 uCenter; uniform vec2 uCenterLo; uniform vec2 uInvScale;
uniform vec4 uWin; uniform float uWinR; uniform float uWinRs; uniform vec2 uSing[4]; uniform int uSingN;
// uKsat: the front count K of the drawn alpha (uncapped); uKall = 1: every covering candidate counts (the shape's own
// alpha: when K > IX_B the early stop is off, and the candidates the buffer does not keep enter the composite through
// their transmittance ixTr); uKall = 0 (hover-dimmed draws): K capped at IX_B, the stop at the IX_B-th key
uniform int uKsat; uniform int uKall;
// uIxTail = 1: the shape's coverage is monotone along the stop op's member lines (Inverse.prepare's tail flag): with
// uKall and K > IX_B, a side whose members provably all cover and all lie behind the buffer ends in the tail closure
uniform int uIxTail;
uniform highp sampler2D uPts; uniform int uShOff; uniform ivec4 uShape; uniform vec4 uShA; uniform vec4 uShB; uniform vec4 uShC;
uniform int uFormSlot;
uniform vec4 uClipH; uniform vec4 uClipP[16]; uniform vec4 uShBox; uniform int uIxOne;   // the clip primitive: (nIn, nHole), 2 texels per piece (the first 8 here)
${PAT_UNIFORMS}out vec4 o;
${PAT_FNS}${forms || 'float formulaLevel(int f, vec2 z) { return -1.0; }\n'}
vec2 ixDwX, ixDwY;
const int IX_B = ${B};
float bD[IX_B]; vec2 bZ[IX_B]; float bC[IX_B]; float bG[IX_B]; highp uint bCol[IX_B];   // colour: 8 bits per channel
highp uint ixPack(vec3 c) { uvec3 u = uvec3(clamp(c, 0.0, 1.0) * 255.0 + 0.5); return u.r | (u.g << 8) | (u.b << 16); }
vec3 ixUnpack(highp uint u) { return vec3(float(u & 255u), float((u >> 8) & 255u), float((u >> 16) & 255u)) / 255.0; }
int nb; int nCov; float U; bool ixTailInf; float ixTr;
bool ixLastOk; bool ixLastFin; float ixLastD; vec2 ixLastZ;
vec4 ixRec(int i) { i += uShOff; return texelFetch(uPts, ivec2(i & 1023, i >> 10), 0); }
float ixBoxDistTo(vec2 z, vec4 b) { return cx_abs(max(max(b.xy - z, z - b.zw), vec2(0.0))); }
// ---- the shape's clip primitive along a line (Region.shapeClip): pieces 1 disc (c, r), 2 box (x0, x1 | y0, y1),
// 3 half-plane cross(d, z - a) > 0 (a | d); grown by m (in-pieces) or shrunk (hole pieces, m < 0)
vec2 ixClipPiece(vec4 P0, vec4 P1, vec2 z0, vec2 q, float m) {
  const vec2 E = vec2(IX_INF, -IX_INF);
  float qq = dot(q, q);
  int t = int(P0.x + 0.5);
  if (t == 1) {
    float r = P0.w + m;
    if (!(r > 0.0) || !(qq > 0.0)) return E;
    vec2 dd = P0.yz - z0;
    float ql = sqrt(qq), tc = dot(dd, q) / qq, h = abs(q.x * dd.y - q.y * dd.x) / ql;
    if (!(h <= r)) return E;
    float hc = sqrt((r - h) * (r + h)) / ql;
    return vec2(tc - hc, tc + hc);
  }
  if (t == 3) {
    vec2 d = P1.xy;
    float L0 = d.x * (z0.y - P0.z) - d.y * (z0.x - P0.y) + m * length(d), cq = d.x * q.y - d.y * q.x;
    if (!(abs(cq) > 1e-30)) return L0 > 0.0 ? vec2(-IX_INF, IX_INF) : E;
    float tt = -L0 / cq;
    return cq > 0.0 ? vec2(tt, IX_INF) : vec2(-IX_INF, tt);
  }
  if (t == 4) {               // v16 'g': {f(z0 + t q) < 2m} relative to the anchor P0.yz; A = P0.w >= 0, B = P1.xy, C = P1.z
    vec2 u0 = z0 - P0.yz;
    float a = P0.w * qq, b = 2.0 * (P0.w * dot(u0, q) + dot(P1.xy, q));
    float c = P0.w * dot(u0, u0) + 2.0 * dot(P1.xy, u0) + P1.z - 2.0 * m;
    if (!(a > 0.0)) {
      if (!(abs(b) > 1e-30)) return c < 0.0 ? vec2(-IX_INF, IX_INF) : E;
      float tt = -c / b;
      return b > 0.0 ? vec2(-IX_INF, tt) : vec2(tt, IX_INF);
    }
    float D = b * b - 4.0 * a * c;
    if (!(D > 0.0)) return E;
    float qr = -0.5 * (b + (b >= 0.0 ? 1.0 : -1.0) * sqrt(D)), t1 = qr / a, t2 = c / qr;
    return vec2(min(t1, t2), max(t1, t2));
  }
  if (t == 2) {
    float x0 = P0.y - m, x1 = P0.z + m, y0 = P1.x - m, y1 = P1.y + m;
    if (!(x0 <= x1 && y0 <= y1)) return E;
    vec2 r = vec2(-IX_INF, IX_INF);
    if (!(abs(q.x) > 1e-30)) { if (!(z0.x >= x0 && z0.x <= x1)) return E; }
    else { float t1 = (x0 - z0.x) / q.x, t2 = (x1 - z0.x) / q.x; r = vec2(max(r.x, min(t1, t2)), min(r.y, max(t1, t2))); }
    if (!(abs(q.y) > 1e-30)) { if (!(z0.y >= y0 && z0.y <= y1)) return E; }
    else { float t1 = (y0 - z0.y) / q.y, t2 = (y1 - z0.y) / q.y; r = vec2(max(r.x, min(t1, t2)), min(r.y, max(t1, t2))); }
    return r;
  }
  return vec2(-IX_INF, IX_INF);
}
// one loop over the in-pieces and the hole pieces (one clip call site: the compiled program stays small); the
// first 8 pieces come from uniforms, the rest (complements of convex polygons) from the record. uIxOne = 1: loop
// bounds the compiler cannot unroll (unrolling only multiplies the code here)
bool ixShapeClip(vec2 z0, vec2 q, float m, out float lo, out float hi, out float hlo, out float hhi) {
  int nIn = int(uClipH.x + 0.5), nAll = nIn + int(uClipH.y + 0.5);
  lo = -IX_INF; hi = IX_INF; hlo = IX_INF; hhi = -IX_INF;
  float l2 = -IX_INF, h2 = IX_INF;
  for (int i = 0; i < 68 * uIxOne; i++) {
    if (i >= nAll) break;
    vec4 P0 = i < 8 ? uClipP[2 * i] : ixRec(1 + 2 * i), P1 = i < 8 ? uClipP[2 * i + 1] : ixRec(2 + 2 * i);
    bool hole = i >= nIn;
    vec2 r = ixClipPiece(P0, P1, z0, q, hole ? -m : m);
    if (hole) { l2 = max(l2, r.x); h2 = min(h2, r.y); }
    else { lo = max(lo, r.x); hi = min(hi, r.y); }
  }
  if (nAll > nIn && l2 < h2) { hlo = l2; hhi = h2; }
  return lo <= hi;
}
// ---- the shape's level (positive inside) and gradient: Region.levelOf, Inverse's kindLevel ----
vec3 ixKindLevel(vec2 z) {
  int kind = uShape.x;
  if (kind == 1) {
    vec2 v = z - uShA.xy;
    float d = cx_abs(v);
    return d > 0.0 ? vec3(uShA.z - d, -v / d) : vec3(uShA.z, 0.0, 0.0);
  }
  if (kind == 2) {
    float L = z.x - uShA.x;
    vec2 g = vec2(1.0, 0.0);
    if (uShA.z - z.x < L) { L = uShA.z - z.x; g = vec2(-1.0, 0.0); }
    if (z.y - uShA.y < L) { L = z.y - uShA.y; g = vec2(0.0, 1.0); }
    if (uShA.w - z.y < L) { L = uShA.w - z.y; g = vec2(0.0, -1.0); }
    return vec3(L, g);
  }
  if (kind == 3) {
    int n = uShape.z, s = uShape.w;
    bool inside = false;
    float dm = 1e38;
    vec2 qn = z;
    vec2 b = ixRec(s + n - 1).xy;
    for (int i = 0; i < 64 * uIxOne; i++) {
      if (i >= n) break;
      vec2 a = ixRec(s + i).xy;
      if ((a.y > z.y) != (b.y > z.y) && z.x < (b.x - a.x) * (z.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      vec2 dd = b - a;
      float LL = dot(dd, dd);
      float t = LL > 0.0 ? clamp(dot(z - a, dd) / LL, 0.0, 1.0) : 0.0;
      vec2 p = a + t * dd;
      float d = cx_abs(z - p);
      if (d < dm) { dm = d; qn = p; }
      b = a;
    }
    float sg = inside ? 1.0 : -1.0;
    return dm > 0.0 ? vec3(sg * dm, sg * (z - qn) / dm) : vec3(0.0);
  }
  if (kind == 4) return vec3(uShA.z * (z.y - uShA.y) - uShA.w * (z.x - uShA.x), -uShA.w, uShA.z);
  if (kind == 8) {            // v16 gdisc: -f/2 and its gradient, relative to the anchor uShA.xy (A uShA.z, C uShA.w, B uShB.xy)
    vec2 u = z - uShA.xy;
    return vec3(-0.5 * (uShA.z * dot(u, u) + 2.0 * dot(uShB.xy, u) + uShA.w), -(uShA.z * u + uShB.xy));
  }
  if (kind == 5) {
    vec2 v = z - uShA.xy;
    float d = cx_abs(v);
    vec2 u = d > 0.0 ? v / d : vec2(0.0);
    return d - uShA.z < uShA.w - d ? vec3(d - uShA.z, u) : vec3(uShA.w - d, -u);
  }
  if (kind == 6) {
    vec2 v = z - uShA.xy, u1 = uShB.xy, u2 = uShB.zw;
    float d = cx_abs(v);
    vec2 u = d > 0.0 ? v / d : vec2(0.0);
    float a = u1.x * v.y - u1.y * v.x, b = -(u2.x * v.y - u2.y * v.x);
    vec3 res;
    if (uShA.w >= 360.0) res = vec3(d, u);
    else if (uShA.w <= 180.0) res = a < b ? vec3(a, -u1.y, u1.x) : vec3(b, u2.y, -u2.x);
    else res = a > b ? vec3(a, -u1.y, u1.x) : vec3(b, u2.y, -u2.x);
    if (uShA.z > 0.0 && uShA.z - d < res.x) res = vec3(uShA.z - d, -u);
    return res;
  }
  return vec3(-1.0, 0.0, 0.0);
}
// a formula shape's level with its complement (formulas only: their gradient is taken by central differences)
float ixFormLevel(vec2 z) { float L = formulaLevel(uFormSlot, z); return uShape.y == 1 ? -L : L; }
void ixFromGrad(float L, float gx, float gy, out float s, out vec2 n) {
  vec2 g = vec2(gx, gy);
  float m = max(abs(gx), abs(gy));
  n = vec2(0.0);
  if (!(m > 0.0) || !(m < 3.4e38)) { s = L > 0.0 ? 1e38 : -1e38; return; }
  float gl = length(g / m) * m;
  s = L / gl; n = g / gl;
}
// formulas: central differences of the full level along the footprints
void ixCentral(vec2 z, vec2 dX, vec2 dY, out float s, out vec2 n) {
  float L0 = ixFormLevel(z);
  n = vec2(0.0);
  if (!(L0 > -1e37)) { s = -1e38; return; }
  vec2 dl = vec2(ixFormLevel(z + dX) - ixFormLevel(z - dX), ixFormLevel(z + dY) - ixFormLevel(z - dY)) * 0.5;
  if (!ixFin(dl)) { s = L0 > 0.0 ? 1e38 : -1e38; return; }
  ixFromGrad(L0, dl.x, dl.y, s, n);
}
// direction tests in log space (the Lambda rule): level e^{Re L} cross(d, e^{i th}), gradient in (Re L, th)
void ixDirHalf(vec2 d, float th, vec2 dLX, vec2 dLY, float sg, out float s, out vec2 n) {
  vec2 e = vec2(cos(th), sin(th));
  float l = sg * (d.x * e.y - d.y * e.x), dt = sg * dot(d, e);
  ixFromGrad(l, l * dLX.x + dt * dLX.y, l * dLY.x + dt * dLY.y, s, n);
}
// signed distance (image px, positive inside) of a candidate to the region boundary and its unit image-space normal
// (SPEC 4.3), with the Lambda rule for |Re Lambda| > 60
void ixShapePx(vec2 z, bool zf, vec2 dX, vec2 dY, Lf L, vec2 dLX, vec2 dLY, out float s, out vec2 n) {
  int kind = uShape.x;
  float cs = uShape.y == 1 ? -1.0 : 1.0;
  s = -1e38; n = vec2(0.0);
  if (IX_HASLAM(L) && abs(L.lam.x) > 60.0) {
    bool big = L.lam.x > 0.0, at0 = uShC.x > 0.5;
    float th = L.lam.y;
    if (kind == 4) { if (big || uShC.y > 0.5) ixDirHalf(uShA.zw, th, dLX, dLY, cs, s, n); else s = at0 ? IX_BIG : -IX_BIG; return; }
    if (kind == 8) { if (big) s = uShA.z < 0.0 ? IX_BIG : -IX_BIG; else if (uShC.y > 0.5) ixDirHalf(uShB.zw, th, dLX, dLY, 1.0, s, n); else s = at0 ? IX_BIG : -IX_BIG; return; }
    if (kind == 6 && !(uShA.z > 0.0)) {
      if (!(big || uShC.y > 0.5)) { s = at0 ? IX_BIG : -IX_BIG; return; }
      if (uShA.w >= 360.0) { s = cs > 0.0 ? IX_BIG : -IX_BIG; return; }
      float sA, sB; vec2 nA, nB;
      ixDirHalf(uShB.xy, th, dLX, dLY, 1.0, sA, nA);
      ixDirHalf(-uShB.zw, th, dLX, dLY, 1.0, sB, nB);
      bool pickA = uShA.w <= 180.0 ? sA < sB : sA > sB;
      s = pickA ? sA : sB; n = pickA ? nA : nB;
      if (cs < 0.0) { s = -s; n = -n; }
      return;
    }
    if (kind != 7) { s = big ? (cs < 0.0 ? IX_BIG : -IX_BIG) : (at0 ? IX_BIG : -IX_BIG); return; }      // bounded kinds
    // formulas: evaluated at e^{+-60 + i Im Lambda} (below, with the plain ones)
    z = cexp(vec2(big ? 60.0 : -60.0, th)); dX = cmul(z, dLX); dY = cmul(z, dLY); zf = true;
  } else if (!zf || abs(z.x) > 1e30 || abs(z.y) > 1e30) return;
  if (uShBox.x <= uShBox.z) {
    // polygons and bounded formulas lie in the box uShBox: a point outside it by more than 2 footprints is outside
    // the shape by more than 2 px (|grad L| = 1 for polygons; formulas: their level is a distance in z units, too)
    float db = ixBoxDistTo(z, uShBox), fpx = cx_abs(dX) + cx_abs(dY);
    if (db > 2.0 * fpx) { s = uShape.y == 1 ? IX_BIG : -max(db / max(fpx, 1e-30), 2.0); return; }
  }
  if (kind == 7) { ixCentral(z, dX, dY, s, n); return; }
  vec3 r = ixKindLevel(z);
  if (cx_isnan(r.x)) return;
  vec2 g = cs * r.yz;
  ixFromGrad(cs * r.x, dot(g, dX), dot(g, dY), s, n);
}
// ---- sheet order (SPEC 5): D = log2(1 + dist(z, W) / R) + sum over P of max(0, log2(rs / |z - p|)) ----
float ixBoxDist(vec2 z) { return ixBoxDistTo(z, uWin); }
float ixSheetKey(vec2 z, bool zf, Lf L) {
  if (IX_HASLAM(L) && L.lam.x > 60.0) return (L.lam.x - log(uWinR)) / IX_LN2;
  if (!zf) return 1e38;
  float D = log2(1.0 + ixBoxDist(z) / uWinR);
  for (int i = 0; i < 4; i++) {
    if (i >= uSingN) break;
    vec2 p = uSing[i];
    if (IX_HASLAM(L) && L.lam.x < -60.0 && p.x == 0.0 && p.y == 0.0) D += max(0.0, log2(uWinRs) - L.lam.x / IX_LN2);
    else D += max(0.0, log2(uWinRs / cx_abs(z - p)));
  }
  return D;
}
// ---- member ranges (SPEC 3.6) ----
void ixRangeFinish(inout float lo, inout float hi, inout float hlo, inout float hhi, inout float ms) {
  if (hlo <= hhi) {      // a hole reaching infinity: a one-sided range
    if (hlo <= -IX_INF) { lo = max(lo, hhi + 1.0); hlo = IX_INF; hhi = -IX_INF; }
    else if (hhi >= IX_INF) { hi = min(hi, hlo - 1.0); hlo = IX_INF; hhi = -IX_INF; }
  }
  if (lo > hi) return;
  ms = min(hi, max(lo, ms));
  if (ms >= hlo && ms <= hhi) ms = (ms - hlo <= hhi - ms) ? hlo - 1.0 : hhi + 1.0;
}
vec2 ixMobT(vec2 u) {
  vec2 num = cmul(uIxStopT[0].xy, u) + uIxStopT[0].zw, den = cmul(uIxStopT[1].xy, u) + uIxStopT[1].zw;
  return vec2(num.x * den.x + num.y * den.y, num.y * den.x - num.x * den.y) / dot(den, den);
}
// 2^D of a finite point without the logs (the same order as ixSheetKey)
float ixKeyExp(vec2 z) {
  float K = 1.0 + ixBoxDist(z) / uWinR;
  for (int i = 0; i < 4; i++) { if (i >= uSingN) break; K *= max(1.0, uWinRs / cx_abs(z - uSing[i])); }
  return K;
}
// the Mobius-prefix centre: the smallest key among the u-projection, the member nearest the reference in z and the
// member farthest from the accumulation point, each with its neighbours (Inverse's mobCentre; every distinct member
// is evaluated once, in the CPU's order, so the first minimum is the same)
float ixMobCentre(vec2 base, vec2 p, vec2 uc, float ms) {
  if (!ixFin(uc)) return ms;
  vec2 A = base - uc, Bq = base - uIxStopMob.xy;
  float a = dot(p, p), b1 = 2.0 * dot(A, p), c1 = dot(A, A), b2 = 2.0 * dot(Bq, p), c2 = dot(Bq, Bq);
  float qa = a * (b2 - b1), qb = 2.0 * a * (c2 - c1), qc = b1 * c2 - b2 * c1;
  float cand[6];
  cand[0] = ms; cand[1] = floor(-dot(Bq, p) / a + 0.5);
  cand[2] = cand[3] = cand[4] = cand[5] = IX_INF;
  if (abs(qa) > 1e-30) {
    float D = qb * qb - 4.0 * qa * qc;
    if (D >= 0.0) {
      float sq = sqrt(D), r1 = (-qb - sq) / (2.0 * qa), r2 = (-qb + sq) / (2.0 * qa);
      cand[2] = floor(r1); cand[3] = ceil(r1); cand[4] = floor(r2); cand[5] = ceil(r2);
    }
  } else if (abs(qb) > 1e-30) { float r = -qc / qb; cand[2] = floor(r); cand[3] = ceil(r); }
  float best = ms, bK = 3e38;
  for (int t = 0; t < 18 * uIxOne; t++) {
    int i = t / 3;
    float c = cand[i];
    if (!(abs(c) < 1e30)) continue;
    float m2 = c + float(t - 3 * i - 1);
    bool seen = false;
    for (int q = 0; q < 6; q++) { if (q >= i) break; if (abs(cand[q]) < 1e30 && abs(m2 - cand[q]) <= 1.0) seen = true; }
    if (seen) continue;
    vec2 zz = ixMobT(base + m2 * p);
    if (!ixFin(zz)) continue;
    float K = ixKeyExp(zz);
    if (K < bK) { bK = K; best = m2; }
  }
  return best;
}
// additive family: members u_m = base + m p; d0 = du/dw
void ixRangeAdd(int j, Lf L, vec2 base, vec2 p, vec2 d0, out float lo, out float hi, out float hlo, out float hhi, out float ms) {
  lo = -IX_INF; hi = IX_INF; hlo = IX_INF; hhi = -IX_INF;
  vec2 ref = uIxRef[j];
  ms = ixFin(ref) ? floor(cdiv(ref - base, p).x + 0.5) : 0.0;
  if (!(abs(ms) < 1e30)) ms = 0.0;
#if IX_MOB
  if (j == uIxStopOp && uIxStopMobOn) ms = ixMobCentre(base, p, ref, ms);
#endif
  int rk = uIxRK[j];
  if (rk == 1) {
    // the member line z_m = z0 + m q clipped to the shape grown by the anti-aliasing margin (1.5 image px in z, at most
    // half a member spacing)
    vec2 A = uIxAB[j].xy, z0 = cdiv(base - uIxAB[j].zw, A), q = cdiv(p, A);
    float qa = cx_abs(q);
    float rho = cx_abs(d0) * ixScale(L.J) * ixPix / cx_abs(A);
    float mt = min(1.5 * rho / qa, 0.5);
    if (!(mt >= 0.0)) mt = 0.5;
    float tl, th, tl2, th2;
    if (!ixShapeClip(z0, q, mt * qa, tl, th, tl2, th2)) { lo = 1.0; hi = 0.0; return; }
    lo = max(lo, ceil(tl) - 1.0); hi = min(hi, floor(th) + 1.0);
    if (tl2 <= th2) { hlo = floor(tl2) + 2.0; hhi = ceil(th2) - 2.0; }
  } else if (rk == 2) {
    vec4 bx = uIxBox[j];
    float pa = cx_abs(p), t0 = dot(base, p) / pa;
    if (bx.z > -IX_INF) lo = max(lo, ceil((bx.z - t0) / pa) - 1.0);
    if (bx.w < IX_INF) hi = min(hi, floor((bx.w - t0) / pa) + 1.0);
  }
  ixRangeFinish(lo, hi, hlo, hhi, ms);
}
// log family (ROOTPOW): L_m = L0 + m S; P = (beta, branch lo, hi), Q = (|s|, mode 0 int / 1 finite / 2 inf, S)
float ixToM(float t, vec2 L0, vec2 S) { return t >= IX_INF ? (S.x > 0.0 ? IX_INF : -IX_INF) : (log(t) - L0.x) / S.x; }
void ixRangeLog(int j, Lf L, vec2 L0, vec2 S, vec4 P, vec4 Q, out float lo, out float hi, out float hlo, out float hhi, out float ms) {
  lo = -IX_INF; hi = IX_INF; hlo = IX_INF; hhi = -IX_INF;
  int mode = int(Q.y + 0.5);
  if (mode == 0) { ms = floor(((P.z + P.w) * 0.5 - L0.y) / (CX_TAU * P.x) + 0.5); lo = ms; hi = ms; return; }
  ms = floor(dot(uIxRef[j] - L0, S) / dot(S, S) + 0.5);
  if (!(abs(ms) < 1e30)) ms = 0.0;
  if (mode == 1) {
    float xa = (P.z - L0.y) / S.y, xb = (P.w - L0.y) / S.y;
    lo = ceil(min(xa, xb)) - 1.0; hi = floor(max(xa, xb)) + 1.0;
  }
  int rk = uIxRK[j];
  if (rk == 1) {
    // the member ray z = za + t dz, t = |u_m|: the union of the clips of the rays turned by 0 and +-da (the margin as
    // an angle), the hole the intersection of their holes
    vec2 A = uIxAB[j].xy, za = -cdiv(uIxAB[j].zw, A);
    float da = min(1.5 * cx_abs(P.xy) * ixScale(L.J) * ixPix / cx_abs(L.u), 0.3);
    if (!(da >= 0.0)) da = 0.3;
    float rlo = IX_INF, rhi = -IX_INF, rhl = -IX_INF, rhh = IX_INF;
    for (int i = 0; i < 3 * uIxOne; i++) {
      if (i > 0 && !(da > 0.0)) break;
      float an = L0.y + (i == 0 ? 0.0 : (i == 1 ? -da : da));
      float tl, th, tl2, th2;
      ixShapeClip(za, cdiv(vec2(cos(an), sin(an)), A), 0.0, tl, th, tl2, th2);
      if (max(tl, 0.0) < th) { rlo = min(rlo, max(tl, 0.0)); rhi = max(rhi, th); }
      rhl = max(rhl, tl2); rhh = min(rhh, th2);
    }
    float tlo = max(rlo, 0.0), thi = rhi;
    if (!(tlo < thi)) { lo = 1.0; hi = 0.0; return; }
    float a = tlo > 0.0 ? ixToM(tlo, L0, S) : (S.x > 0.0 ? -IX_INF : IX_INF), b = ixToM(thi, L0, S);
    lo = max(lo, ceil(min(a, b)) - 1.0); hi = min(hi, floor(max(a, b)) + 1.0);
    if (rhl <= rhh && rhh > 0.0) {
      float ha = rhl > 0.0 ? ixToM(rhl, L0, S) : (S.x > 0.0 ? -IX_INF : IX_INF), hb = ixToM(rhh, L0, S);
      hlo = floor(min(ha, hb)) + 2.0; hhi = ceil(max(ha, hb)) - 2.0;
    }
  } else if (rk == 2) {
    vec4 bx = uIxBox[j];
    float a = bx.z > -IX_INF ? (bx.z - L0.x) / S.x : (S.x > 0.0 ? -IX_INF : IX_INF);
    float b = bx.w < IX_INF ? (bx.w - L0.x) / S.x : (S.x > 0.0 ? IX_INF : -IX_INF);
    float mn = min(a, b), mx = max(a, b);
    if (mn > -IX_INF) lo = max(lo, ceil(mn) - 1.0);
    if (mx < IX_INF) hi = min(hi, floor(mx) + 1.0);
  }
  ixRangeFinish(lo, hi, hlo, hhi, ms);
}
// ---- compositing buffer (4.2): front to back by D, ties larger Im z, then larger Re z ----
// the buffer is indexed by loop counters only (unrolled: entries stay in registers, no thread-memory spill)
int ixK() { return min(uKsat, IX_B); }
float ixDK() {
  if (uKall > 0 && uKsat > IX_B) return 1e38;      // the K-th key is not kept: no early stop
  int k = ixK();
  float dk = 1e38;
  for (int i = 0; i < IX_B; i++) if (i == k - 1 && i < nb) dk = bD[i];
  return dk;
}
// The tail rule (K > IX_B for the shape's own alpha, where ixDK() turns the early stop off). Every covering candidate the
// buffer does not keep enters the composite only through ixTr, and the walk sets ixTailInf when a side, still running
// at the end of its budget, ends with three covering members; the composite is then the buffer, plus the rest of the
// light in the buffer's mean colour: ixTr is discarded. So a side of the stop op may stop as soon as (the walker checks
// the side's part: still in range up to infinity, no hole, its last three members covering) its members provably
// (uIxTail, Inverse.prepare) all cover from here on, the union U is final (1), and their keys provably exceed the
// buffer's last key (the stop's lower bound against bD[IX_B - 1]): the full walk would admit none of them, would keep
// the side running to the end of its budget and would close the tail. The composite is the same; the members it
// skipped would only have scaled ixTr. (An unbounded side of a monotone family: exp(H), z^i(H) at alpha <= 0.5 walk
// B + 2 members instead of the whole window.)
float ixDKTail() {
  if (uIxTail == 0 || !(uKall > 0 && uKsat > IX_B) || nb < IX_B || !(U >= 1.0)) return 1e38;
  return bD[IX_B - 1];
}
// a covering candidate the buffer does not keep (not admitted, or dropped off its end): its transmittance, with the
// drawn alpha and the coverage relative to the running union U, enters the composite behind the buffer
void ixRest(float cv) { ixTr *= 1.0 - uAlpha * min(1.0, cv / max(U, 1e-6)); }
bool ixFront(float D1, vec2 t1, float D2, vec2 t2) {
  if (D1 != D2) return D1 < D2;
  if (t1.y != t2.y) return t1.y > t2.y;
  return t1.x > t2.x;
}
// ---- early stop (3.6) ----
float ixRayBoxDist(vec2 a, vec2 v, float smax) {
  float lo = 0.0, hi = smax;
  if (!(abs(v.x) > 1e-30)) { if (a.x < uWin.x || a.x > uWin.z) lo = IX_INF; }
  else { float t1 = (uWin.x - a.x) / v.x, t2 = (uWin.z - a.x) / v.x; lo = max(lo, min(t1, t2)); hi = min(hi, max(t1, t2)); }
  if (!(abs(v.y) > 1e-30)) { if (a.y < uWin.y || a.y > uWin.w) lo = IX_INF; }
  else { float t1 = (uWin.y - a.y) / v.y, t2 = (uWin.w - a.y) / v.y; lo = max(lo, min(t1, t2)); hi = min(hi, max(t1, t2)); }
  if (lo <= hi) return 0.0;
  float d = ixBoxDist(a);
  if (smax < IX_INF) d = min(d, ixBoxDist(a + smax * v));
  float vv = dot(v, v);
  if (vv > 0.0) {
    for (int i = 0; i < 4; i++) {
      vec2 c = vec2(i < 2 ? uWin.x : uWin.z, (i & 1) == 0 ? uWin.y : uWin.w);
      float s = clamp(dot(c - a, v) / vv, 0.0, smax);
      d = min(d, cx_abs(a + s * v - c));
    }
  }
  return d;
}
// additive family at the stop op: the Mobius rule (members on an arc converging to pAcc) or the AFF rule (a proven
// lower bound of the keys still to come on the ray z_m + s dir q)
bool ixStopAdd(int j, vec2 p, bool goUp, vec2 umem, float dk) {
#if IX_MOB
  if (uIxStopMobOn) {
    if (!ixLastFin) return false;
    if (dot(umem - uIxStopMob.xy, p) * (goUp ? 1.0 : -1.0) < 0.0) return false;
    vec2 pa = uIxStopMob.zw;
    float r = cx_abs(ixLastZ - pa);
    float LB = log2(1.0 + max(0.0, ixBoxDist(pa) - r) / uWinR) + (uIxPAccInP > 0.5 ? max(0.0, log2(uWinRs / r)) : 0.0);
    return LB > dk;
  }
#endif
  if (!(dk < 1e37) || uIxRK[j] != 1) return false;
  float lb = ixLastD;
  // (the members still to come start at the next one, z_m + q: a member past the front need not be walked to stop)
  if (ixLastFin) { vec2 q = cdiv(p, uIxAB[j].xy), qd = goUp ? q : -q; lb = log2(1.0 + ixRayBoxDist(ixLastZ + qd, qd, IX_INF) / uWinR); }
  return lb > dk + 1e-12;
}
bool ixStopLog(int j, vec2 S, bool goUp, float dk) {
  if (!(dk < 1e37) || uIxRK[j] != 1) return false;
  float dir = goUp ? 1.0 : -1.0, lb;
  if (!ixLastFin) lb = dir * S.x > 0.0 ? ixLastD : -1e38;
  else {
    vec2 za = -cdiv(uIxAB[j].zw, uIxAB[j].xy), z = za + (ixLastZ - za) * exp(dir * S.x);   // the next member
    if (!ixFin(z)) z = ixLastZ;
    if (dir * S.x > 0.0) lb = log2(1.0 + ixRayBoxDist(z, z - za, IX_INF) / uWinR);
    else {
      lb = log2(1.0 + ixRayBoxDist(z, za - z, 1.0) / uWinR);
      for (int i = 0; i < 4; i++) {
        if (i >= uSingN) break;
        float far = max(cx_abs(z - uSing[i]), cx_abs(za - uSing[i]));
        if (far < uWinRs) lb += log2(uWinRs / far);
      }
    }
  }
  return lb > dk + 1e-12;
}
// ---- patterns with analytic footprints (6.1, 6.2) ----
vec2 ixDivL(vec2 a, vec2 b) { return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / max(dot(b, b), 1e-37); }
// UTIL's checker for the analytic footprints. For a filter narrower than a cell (w < 1) the box-filtered square wave is
// the ramp clamp(2 q / w, -1, 1) around the nearest cell edge n (q = p - n, exact in float32), signed (-1)^n: the same
// value as UTIL's difference of two fract() terms, without its cancellation (at deep zooms that difference was rounding
// noise: colours past c0 / c1, then the average, P2 review). Interiors are exactly +-1; the ramp is at least 2 ulps of
// p wide. Wider filters (w >= 1, moire-faded anyway) keep UTIL's form.
float ixSq(float p, float w) {
  if (w >= 1.0) return clamp(2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w, -1.0, 1.0);
  float n = floor(p + 0.5), q = p - n;
  float sgn = n - 2.0 * floor(0.5 * n) > 0.5 ? -1.0 : 1.0;
  return sgn * clamp(2.0 * q / max(w, max(2.4e-7 * abs(p), 1e-30)), -1.0, 1.0);
}
float ixChecker(vec2 p, vec2 w) { return 0.5 - 0.5 * ixSq(p.x, w.x) * ixSq(p.y, w.y); }
// vSrc: the source point relative to vQ (0, or near a saturation anchor its pattern-aligned origin: SPEC 13.12)
// gpA: near a saturation anchor (p != 0), the log-polar cell coordinates relative to the corner nearest to log p (xy)
// and that corner's integer shift mod 2 (zw); gpA.z = -1 otherwise
vec3 ixPattern(vec2 vSrc, vec2 vQ, vec2 gK, vec4 gpA, vec2 dX, vec2 dY, bool hasLam, vec2 lam, vec2 dLX, vec2 dLY, float vJac) {
${PATTERN_SRC('analytic')}  return col;
}
#if IX_ANC
// ---- saturation anchors (SPEC 13.12; Inverse.anchorModel / anchorPx): z = p + delta near p = (+-1 - B) / A (tan: +-i).
// Per anchor a, uAnc[4a..4a+3] = model (type 0 none / 1 sure / 2 cone / 3 circle, its radius m, flag, sgn), geometry
// (cone: u1, u2; circle: v0 = p - c, r, K), pattern (p - Q, Q), (p, log p; log p.x < -1e29: p = 0). uAncAB = (A, B)
// of the affine ops between the anchor op and z, uAncLA = log A.
uniform vec4 uAncAB; uniform vec2 uAncLA; uniform vec4 uAnc[8]; uniform vec4 uAncK; uniform vec4 uAncG[2];
bool ixAnchorPx(int a, vec2 dz, vec2 lz, vec2 dX, vec2 dY, vec2 dLX, vec2 dLY, out float s, out vec2 n) {
  vec4 M = uAnc[4 * a], G = uAnc[4 * a + 1];
  int type = int(M.x + 0.5);
  s = -1e38; n = vec2(0.0);
  if (type == 0 || !(exp(min(lz.x, 80.0)) < M.y)) return false;
  if (type == 1) { s = M.z * IX_BIG; return true; }
  if (type == 2) {
    float sA, sB; vec2 nA, nB;
    ixDirHalf(G.xy, lz.y, dLX, dLY, 1.0, sA, nA);
    ixDirHalf(-G.zw, lz.y, dLX, dLY, 1.0, sB, nB);
    bool pickA = M.z > 0.5 ? sA < sB : sA > sB;
    s = (pickA ? sA : sB) * M.w; n = (pickA ? nA : nB) * M.w;
    return true;
  }
  float sg = M.z * M.w;
  if (lz.x < -60.0) { ixDirHalf(ixUnit(vec2(-G.y, G.x)), lz.y, dLX, dLY, sg, s, n); return true; }   // the tangent at p
  vec2 v = G.xy + dz;
  float vv = cx_abs(v);
  float Lc = (G.w - 2.0 * dot(G.xy, dz) - dot(dz, dz)) / (G.z + vv);
  vec2 g = -v / max(vv, 1e-37);
  ixFromGrad(sg * Lc, sg * dot(g, dX), sg * dot(g, dY), s, n);
  return true;
}
#endif
float ixLog2Det(vec4 J) {
  float m = max(max(abs(J.x), abs(J.y)), max(abs(J.z), abs(J.w)));
  if (!(m > 0.0) || !(m < 3.4e38)) return 0.0;
  vec4 K = J / m;
  return log2(abs(K.x * K.w - K.y * K.z)) + 2.0 * log2(m);
}
// ---- one candidate (SPEC 4.2 Leaf): coverage with the facing rule, then admission (twin merge, shading on admission)
// shading on admission: the candidate's packed colour
highp uint ixShadeAdm(vec2 z, bool zf, vec2 dX, vec2 dY, Lf L, vec2 pv, vec2 pq, vec2 pk, vec4 pg, bool phl, vec2 plam, vec2 dLX, vec2 dLY) {
#ifdef IX_CARRY
  // (#584) the carried colour: the colour plane's colour of the sheet's point (the steps view's program variant)
  if (uPattern == 9) return ixPack(ixCarryCol(z, zf, dX, dY));
#endif
  // (the area-scale pattern's log2 |dw/dz| only for that pattern)
  float vJac = uPattern == 7 ? -0.5 * (IX_HASLAM(L) ? 2.0 * L.lam.x / IX_LN2 + ixLog2Det(L.JL) : ixLog2Det(L.J)) : 0.0;
  // an overflowed z (only with Lambda) shades as a far point in its direction: cells too small, the moire average
  // (a non-finite footprint: a critical value at the pixel centre, shaded with the moire average)
  bool fin = zf && ixFin(dX) && ixFin(dY);
  vec2 dXs = fin ? dX : vec2(1e30), dYs = fin ? dY : vec2(1e30);
  if (!zf) pv = 1e30 * vec2(cos(L.lam.y), sin(L.lam.y));
  return ixPack(ixPattern(pv, pq, pk, pg, dXs, dYs, phl, plam, dLX, dLY, vJac));
}
void ixAdmit(float D, vec2 tz, float cv, float ga, float fp, vec2 z, bool zf, vec2 dX, vec2 dY, Lf L, vec2 pv, vec2 pq, vec2 pk, vec4 pg, bool phl, vec2 plam, vec2 dLX, vec2 dLY) {
${B >= 8 ? `  // (B = 8, alpha < 0.5: up to 17 covering candidates per pixel, admission was 60 % of the pass.) The common case, a
  // candidate that cannot merge with a twin (fully covering, or no range gradient) while the admission limit is the
  // buffer's end: behind the last entry of a full buffer it is not kept (one comparison); otherwise it is inserted
  // from the end, entries behind it moving back one slot, up to the first entry in front of it (one comparison for
  // the walk's usual, key-ordered arrivals). The same buffer as the scan and shift below, which candidates that may
  // merge with a twin (partial and bound) still take. exp(H) at alpha 0.3, dpr 2: 6.0 -> 4.5 ms per pass (for B 3
  // and 5 this path measured 4-10 % slower: the scan below stays there).
  if ((cv >= 1.0 || ga >= 50.0) && ixK() + 2 >= IX_B) {
    if (nb == IX_B && !ixFront(D, tz, bD[IX_B - 1], bZ[IX_B - 1])) { ixRest(cv); return; }
    if (nb == IX_B) ixRest(bC[IX_B - 1]);
    highp uint col = ixShadeAdm(z, zf, dX, dY, L, pv, pq, pk, pg, phl, plam, dLX, dLY);
    int p = min(nb, IX_B - 1);
    bool done = false;
    for (int i = IX_B - 1; i > 0; i--) {
      if (done || i > p) continue;
      if (ixFront(D, tz, bD[i - 1], bZ[i - 1])) { bD[i] = bD[i - 1]; bZ[i] = bZ[i - 1]; bC[i] = bC[i - 1]; bG[i] = bG[i - 1]; bCol[i] = bCol[i - 1]; }
      else { bD[i] = D; bZ[i] = tz; bC[i] = cv; bG[i] = ga; bCol[i] = col; done = true; }
    }
    if (!done) { bD[0] = D; bZ[0] = tz; bC[0] = cv; bG[0] = ga; bCol[0] = col; }
    nb = min(nb + 1, IX_B);
    return;
  }
` : ''}  // position: the entries in front of the candidate (a prefix of the sorted buffer)
  int pos = 0;
  for (int i = 0; i < IX_B; i++) if (i < nb && !ixFront(D, tz, bD[i], bZ[i])) pos = i + 1;
  // twin merge with the neighbour at pos - 1 (first) or pos
  if (cv < 1.0 && ga < 50.0) {
    int tw = -1;
    for (int i = 0; i < IX_B; i++) {
      if (tw < 0 && (i == pos - 1 || i == pos) && i < nb && bC[i] < 1.0 && bG[i] < 50.0 && cos(ga - bG[i]) < -0.5 && cx_abs(z - bZ[i]) <= fp) tw = i;
    }
    if (tw >= 0) {
      for (int i = 0; i < IX_B; i++) if (i == tw) { bC[i] = min(1.0, bC[i] + cv); U = max(U, bC[i]); }
      return;
    }
  }
  if (pos >= min(IX_B, ixK() + 2)) { ixRest(cv); return; }
  if (nb == IX_B) ixRest(bC[IX_B - 1]);
  highp uint col = ixShadeAdm(z, zf, dX, dY, L, pv, pq, pk, pg, phl, plam, dLX, dLY);
  for (int i = IX_B - 1; i > 0; i--) {
    if (i > pos) { bD[i] = bD[i - 1]; bZ[i] = bZ[i - 1]; bC[i] = bC[i - 1]; bG[i] = bG[i - 1]; bCol[i] = bCol[i - 1]; }
    else if (i == pos) { bD[i] = D; bZ[i] = tz; bC[i] = cv; bG[i] = ga; bCol[i] = col; }
  }
  if (pos == 0) { bD[0] = D; bZ[0] = tz; bC[0] = cv; bG[0] = ga; bCol[0] = col; }
  nb = min(nb + 1, IX_B);
}
float invLeaf(Lf L, out bool cov) {
  vec2 z = L.u;
  bool zf = ixFin(z);
  vec2 dX = vec2(L.J.x * ixDwX.x + L.J.y * ixDwX.y, L.J.z * ixDwX.x + L.J.w * ixDwX.y);
  vec2 dY = vec2(L.J.x * ixDwY.x + L.J.y * ixDwY.y, L.J.z * ixDwY.x + L.J.w * ixDwY.y);
  vec2 dLX = vec2(0.0), dLY = vec2(0.0);
  if (IX_HASLAM(L)) {
    dLX = vec2(L.JL.x * ixDwX.x + L.JL.y * ixDwX.y, L.JL.z * ixDwX.x + L.JL.w * ixDwX.y);
    dLY = vec2(L.JL.x * ixDwY.x + L.JL.y * ixDwY.y, L.JL.z * ixDwY.x + L.JL.w * ixDwY.y);
  }
  // (a critical value exactly at the pixel centre: dz/dw infinite or NaN, float32 having an exact 0 there; the
  // pixel's preimage is a small neighbourhood of the critical point: ixFromGrad answers +-1e38 for a non-finite
  // gradient, so the region's sign there decides, and ixAdmit shades with the moire average, never NaN (a black
  // pixel). The float64 twin also takes footprints past 1e12 (1 + |z|) as critical.)
  float s; vec2 n;
  bool done = false;
  // the pattern's inputs: the source point (relative to its pattern origin) and log z with its footprints
  vec2 pv = z, pq = vec2(0.0), pk = vec2(0.0), plam = L.lam, pdLX = dLX, pdLY = dLY;
  vec4 pg = vec4(0.0, 0.0, -1.0, 0.0);
  bool phl = IX_HASLAM(L);
#if IX_ANC
  // near a saturation anchor: the shape's local model there, on the stable offset delta = z - p (SPEC 13.12)
  if (ixAncA >= 0) {
    int a = ixAncA;
    vec2 adz = cdiv(ixAncD, uAncAB.xy), alz = ixAncL - uAncLA;
    vec2 adLX = cmul(ixAncDL, ixDwX), adLY = cmul(ixAncDL, ixDwY);
    done = ixAnchorPx(a, adz, alz, dX, dY, adLX, adLY, s, n);
    vec4 PQ = uAnc[4 * a + 2], PL = uAnc[4 * a + 3];
    pv = PQ.xy + adz; pq = PQ.zw; pk = a == 0 ? uAncK.xy : uAncK.zw; phl = true;
    if (PL.z < -1e29) { plam = alz; pdLX = adLX; pdLY = adLY; }
    else {
      vec2 eps = cdiv(adz, PL.xy), zz = PL.xy + adz;
      vec2 l1 = cx_abs(eps) < 1e-4 ? eps - 0.5 * cmul(eps, eps) : clog(vec2(1.0, 0.0) + eps, CX_PI, 0.0);
      plam = PL.zw + l1;
      pdLX = cdiv(dX, zz); pdLY = cdiv(dY, zz);
      vec4 GA = uAncG[a];
      pg = vec4(l1 * (16.0 / TAU) + GA.xy, GA.zw);
    }
  }
#endif
  if (!done) ixShapePx(z, zf, dX, dY, L, dLX, dLY, s, n);
  bool bound = L.lvl < 1e30 && (L.lg.x != 0.0 || L.lg.y != 0.0);
  vec2 lgi = bound ? ixUnit(vec2(dot(L.lg, ixDwX), dot(L.lg, ixDwY))) : vec2(0.0);
  bool facing = bound && dot(n, lgi) < -0.5;
  float cv = clamp(facing ? min(s, 0.5) + min(L.lvl, 0.5) : min(s, L.lvl) + 0.5, 0.0, 1.0);
  float D = ixSheetKey(z, zf, L);
  cov = cv > 0.0;
  ixLastOk = true; ixLastFin = zf; ixLastD = D; ixLastZ = z;
  if (cov) {
    nCov++;
    U = max(U, cv);
    vec2 tz = zf ? z : (IX_HASLAM(L) ? 1e30 * vec2(cos(L.lam.y), sin(L.lam.y)) : vec2(0.0));
    // carg, not atan(y, x): ANGLE's Metal translation returns +pi/2 for atan(-1, -0.0), and a range gradient along the
    // pixel y axis has x = -0.0, so the two sides of a healed cut through pixel centres never merged (a half-covered
    // line; P2 app review)
    // (only a partial candidate can merge with a twin, and only with a partial entry: a full one keeps no angle)
    float ga = bound && zf && cv < 1.0 ? carg(lgi) : 100.0;
    ixAdmit(D, tz, cv, ga, cx_abs(dX) + cx_abs(dY), z, zf, dX, dY, L, pv, pq, pk, pg, phl, plam, pdLX, pdLY);
  }
  IX_RECORD(L, D, cov)
  return D;
}
`;
  // a globe program's pixel is anisotropic: the walk's range levels are converted to pixels along the footprint vectors
  // (GLChain's ixFoot under IX_ANISO; set by INV_MAIN(globe))
  const INV_GLOBE_PRE = '#define IX_ANISO 1\nvec2 ixAwX, ixAwY;\n';
  // B: compile-time buffer size; globe: Sphere view geometry (P3)
  const INV_MAIN = (globe) => `
${globe ? 'in vec3 vP; uniform vec3 uEye;' : ''}
void main() {
${globe ? `  vec3 P = normalize(vP);
  // S = 0, N = infinity, the conjugate lift's inverse w = (P.x - i P.y) / (1 - P.z); near the north pole w = 1 / u
  // with u = (P.x + i P.y) / (1 + P.z), no cancellation
  vec2 w = P.z <= 0.0 ? vec2(P.x, -P.y) / (1.0 - P.z) : cinv(P.xy / (1.0 + P.z));
  ixDwX = dFdx(w); ixDwY = dFdy(w);
  ixAwX = ixDwX; ixAwY = ixDwY;
  ixPix = sqrt(abs(ixDwX.x * ixDwY.y - ixDwX.y * ixDwY.x));` : `  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);
  ixDwX = vec2(uInvScale.x, 0.0); ixDwY = vec2(0.0, uInvScale.y);
  ixPix = uInvScale.x;`}
  nb = 0; nCov = 0; U = 0.0; ixTailInf = false; ixTr = 1.0; ixLastOk = false; ixLastFin = false; ixLastD = 0.0; ixLastZ = vec2(0.0);
  invWalk(w);
  float T = 1.0;
  vec3 C = vec3(0.0);
  for (int i = 0; i < IX_B; i++) {
    if (i >= nb || T < 1.0 / 255.0) break;
    float a = uAlpha * bC[i] / U;
    C += T * a * ixUnpack(bCol[i]);
    T *= 1.0 - a;
  }
  // behind the buffer: the covering candidates it did not keep (their exact transmittance ixTr, coloured with the
  // buffer's mean: they are not shaded), then the tail closure for infinitely many sheets beyond a truncated window
  if (nb > 0 && T >= 1.0 / 255.0 && (ixTr < 1.0 || ixTailInf)) {
    vec3 mc = vec3(0.0);
    for (int i = 0; i < IX_B; i++) { if (i >= nb) break; mc += ixUnpack(bCol[i]); }
    mc /= float(nb);
    C += T * (1.0 - ixTr) * mc; T *= ixTr;
    if (ixTailInf) { C += T * mc; T = 0.0; }
  }
${globe ? `  float a = U * (1.0 - T);
  if (!(a > 0.0)) { o = vec4(0.0); return; }
  vec3 v = normalize(uEye - vP);
  o = vec4(toSrgb(shade(toLin(U * C / a), P, v, 1.0)) * a, a);` : '  o = vec4(U * C, U * (1.0 - T));'}
}
`;
  // half-resolution passes (cost guard, motion frames): the half-size target, upscaled bilinearly over the pane
  const INV_UP_FS = `
uniform sampler2D uHalf; uniform vec4 uVp; uniform vec2 uHalfSz;
out vec4 o;
void main() { o = textureLod(uHalf, (gl_FragCoord.xy - uVp.xy) / uVp.zw * uHalfSz, 0.0); }
`;


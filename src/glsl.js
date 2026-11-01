'use strict';
// GPU mirror of the function chain. GLChain.build(steps, built) turns the app's step array into GLSL ES 3.00
// that evaluates exactly the maps of funcs.js / cx.js (same branches, cuts, sheets and homotopies).
// Structure (step types, on/off, errors, coefficient counts, custom formulas) is baked into the source and
// summarised by `key`; every numeric parameter lives in `uniform vec4 uChain[]`, written by fill(), so
// dragging a parameter or a branch cut never forces a recompile.
const GLChain = (() => {
  const C = CX.C;
  const DEG = Math.PI / 180; // same expression as funcs.js, so cut*DEG is bit-identical

  // Helper library. Public names (see the interface): cmul cdiv cinv cexp clog cpowr cpow cipow csqrtp
  // csin ccos ctan csinh ccosh ctanh casin cacos catan casinh cacosh catanh cfin carg.
  // Internal helpers are prefixed cx_ to stay out of the includer's namespace.
  const LIB = `
const float CX_PI = 3.141592653589793;
// [issue #72] a uniform nothing sets, so it is 0: max(N, uNoUnroll) is N, but no compiler can know that, so it keeps the
// loop a loop. ANGLE's Direct3D 11 back end hands the code to FXC, which unrolls a loop of constant trip count (its
// body copied N times; its link time grows much faster than the code). highp: declared alike in both stages.
uniform highp int uNoUnroll;
const float CX_TAU = 6.283185307179586;
const float CX_HALF_PI = 1.5707963267948966;
float cx_inf() { return uintBitsToFloat(0x7f800000u); }
float cx_nan() { return uintBitsToFloat(0x7fc00000u); }
// Bit tests (GPU compilers may fold x != x or isnan() away). cx_isinf: a point at infinity, i.e. some component
// is +-inf and none is NaN (typically a float32 overflow of a value the CPU still holds in double).
// highp: fragment shaders default to mediump int, which may be 16 bits.
bool cx_isnan(float x) { return (floatBitsToUint(x) & 0x7fffffffu) > 0x7f800000u; }
bool cx_isinf(vec2 z) { highp uvec2 u = floatBitsToUint(z) & 0x7fffffffu; return max(u.x, u.y) == 0x7f800000u; }
bool cx_signbit(float x) { return (floatBitsToUint(x) & 0x80000000u) != 0u; }
// sin/cos of +-inf is NaN (as Math.sin/cos); GPU built-ins return a finite value there
float cx_sin(float x) { return abs(x) <= 3.4e38 ? sin(x) : cx_nan(); }
float cx_cos(float x) { return abs(x) <= 3.4e38 ? cos(x) : cx_nan(); }
float cx_sinh(float x) {
  float ax = abs(x);
  if (ax < 0.25) { float x2 = x * x; return x * (1.0 + x2 / 6.0 * (1.0 + x2 / 20.0 * (1.0 + x2 / 42.0))); }
  float e = exp(ax);
  float s = 0.5 * (e - 1.0 / e);
  return x < 0.0 ? -s : s;
}
float cx_cosh(float x) { float e = exp(abs(x)); return 0.5 * (e + 1.0 / e); }
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b) {
  if (b.x == 0.0 && b.y == 0.0) return vec2((a.x == 0.0 && a.y == 0.0) ? cx_nan() : cx_inf());
  // a finite numerator over an infinite denominator (typically one that overflowed float32 but is finite in the
  // CPU's double): the quotient is below float32 resolution, while Smith's ratio would be inf / inf = NaN
  if (cx_isinf(b) && abs(a.x) <= 3.4e38 && abs(a.y) <= 3.4e38) return vec2(0.0);
  if (abs(b.x) >= abs(b.y)) {
    float r = b.y / b.x; float d = b.x + b.y * r;
    return vec2((a.x + a.y * r) / d, (a.y - a.x * r) / d);
  }
  float r = b.x / b.y; float d = b.x * r + b.y;
  return vec2((a.x * r + a.y) / d, (a.y * r - a.x) / d);
}
vec2 cinv(vec2 z) { return cdiv(vec2(1.0, 0.0), z); }
float cx_abs(vec2 z) {
  float m = max(abs(z.x), abs(z.y));
  if (m > 1e-18 && m < 1e18) return length(z);
  if (m == 0.0 || !(m < 3.0e38)) return m;
  // large: scale by 2^-100 and back (exact); 1/m itself is subnormal above 8.5e37 and the GPU flushes it to 0, so
  // |z| came out 0 there (a cosh path's 1.5e38, then z^1.365, drew at the origin instead of at infinity)
  if (m >= 1e18) return length(z * 7.888609052210118e-31) * 1.2676506002282294e30;
  return m * length(z * (1.0 / m));
}
bool cfin(vec2 w) {
  if (!(abs(w.x) < 1e30 && abs(w.y) < 1e30)) return false;
  vec2 s = w * 1e-20;
  return dot(s, s) < 1e20;
}
// Math.atan2 semantics. GPU atan(y, x) ignores signed zeros (and is unreliable for x = -0), so zero components
// are handled with sign-bit tests: atan2(+-0, x) = +-pi for x < 0 or x = -0, +-0 otherwise; atan2(y, +-0) = +-pi/2.
// Infinite components get the direction of the infinity (IEEE atan2) instead of the GPU's NaN.
float carg(vec2 z) {
  if (cx_isinf(z)) z = vec2(abs(z.x) > 3.4e38 ? sign(z.x) : z.x * 1e-38, abs(z.y) > 3.4e38 ? sign(z.y) : z.y * 1e-38);
  if (z.y == 0.0) {
    float r = (z.x < 0.0 || (z.x == 0.0 && cx_signbit(z.x))) ? CX_PI : 0.0;
    return cx_signbit(z.y) ? -r : r;
  }
  if (z.x == 0.0) return z.y > 0.0 ? CX_HALF_PI : -CX_HALF_PI;
  return atan(z.y, z.x);
}
// CX.argCut: (theta - 2pi, theta]; like the CPU, theta = pi leaves atan2's (-pi, pi] (incl. -pi at y = -0) as is
float cx_argcut(vec2 z, float theta) {
  float t = carg(z);
  if (theta == CX_PI) return t;
  return t - CX_TAU * ceil((t - theta) / CX_TAU);
}
vec2 cexp(vec2 z) {
  // |e^z| = e^{Re z} is below float32 resolution; also when Im z overflowed (cos(inf) would give 0 * NaN)
  if (z.x < -104.0 && !cx_isnan(z.y)) return vec2(0.0);
  float e = exp(z.x);
  if (z.y == 0.0) return vec2(e, 0.0);
  return vec2(e * cx_cos(z.y), e * cx_sin(z.y));
}
vec2 cx_expm1(vec2 u) {
  if (dot(u, u) < 0.01) {
    vec2 one = vec2(1.0, 0.0);
    vec2 p = one + u / 7.0;
    p = one + cmul(u / 6.0, p); p = one + cmul(u / 5.0, p); p = one + cmul(u / 4.0, p);
    p = one + cmul(u / 3.0, p); p = one + cmul(u / 2.0, p);
    return cmul(u, p);
  }
  return cexp(u) - vec2(1.0, 0.0);
}
vec2 clog(vec2 z, float theta, float k) {
  float r = cx_abs(z);
  return vec2(r == 0.0 ? -cx_inf() : log(r), cx_argcut(z, theta) + CX_TAU * k);
}
vec2 cpowr(vec2 z, float s, float theta, float k) {
  float r = cx_abs(z);
  if (r == 0.0) return s > 0.0 ? vec2(0.0) : (s == 0.0 ? vec2(1.0, 0.0) : vec2(cx_inf()));
  float t = (cx_argcut(z, theta) + CX_TAU * k) * s;
  float m = pow(r, s);
  return vec2(m * cx_cos(t), m * cx_sin(t));
}
vec2 cx_powg(vec2 z, vec2 w, float theta, float k) {
  if (z.x == 0.0 && z.y == 0.0) return w.x > 0.0 ? vec2(0.0) : vec2(cx_inf());
  return cexp(cmul(w, clog(z, theta, k)));
}
vec2 cpow(vec2 z, vec2 w, float theta, float k) {
  if (w.y == 0.0) return cpowr(z, w.x, theta, k);
  return cx_powg(z, w, theta, k);
}
// z^(+-|n|) by binary exponentiation, mirroring CX.ipow (whose exponents stay within |n| <= 4096): m = ToInt32(|n|),
// the first round always runs (the CPU tests the double |n| > 0) and m >> 1 is an arithmetic shift.
// A negative power is computed as (1/z)^|n|, which stays finite where z^|n| overflows float32.
vec2 cx_ipow32(vec2 z, bool neg, highp int m) {
  vec2 r = vec2(1.0, 0.0);
  vec2 b = neg ? cinv(z) : z;
  for (int j = 0; j < max(32, uNoUnroll); j++) {
    if (j > 0 && m <= 0) break;
    if ((m & 1) == 1) r = cmul(r, b);
    b = cmul(b, b);
    m = m >> 1;
  }
  return r;
}
vec2 cipow(vec2 z, int n) {
  if (n == 0) return vec2(1.0, 0.0);
  return cx_ipow32(z, n < 0, n < 0 ? -n : n);
}
// e^{b L} for a constant base c with L = log c: like Expr.compile, CX.exp(b) when c is exactly e (L = 1), since
// b * 1 would turn an infinite component of b (e.g. log 0) into inf * 0 = NaN
vec2 cx_expmul(vec2 b, vec2 L) { return cexp(L == vec2(1.0, 0.0) ? b : cmul(b, L)); }
// constant exponent of a custom formula: m = (mode, re, im, -); 0 integer, 1 real, 2 complex
vec2 cx_powk(vec2 a, vec4 m, float theta) {
  if (m.x < 0.5) return cipow(a, int(m.y));
  if (m.x < 1.5) return cpowr(a, m.y, theta, 0.0);
  return cx_powg(a, m.yz, theta, 0.0);
}
vec2 csqrtp(vec2 a) {
  float r = cx_abs(a);
  if (r == 0.0) return vec2(0.0);
  if (a.x >= 0.0) { float t = sqrt(0.5 * (r + a.x)); return vec2(t, a.y / (2.0 * t)); }
  float t = sqrt(0.5 * (r - a.x));
  return vec2(abs(a.y) / (2.0 * t), a.y >= 0.0 ? t : -t);
}
vec2 csin(vec2 a) { return vec2(cx_sin(a.x) * cx_cosh(a.y), cx_cos(a.x) * cx_sinh(a.y)); }
vec2 ccos(vec2 a) { return vec2(cx_cos(a.x) * cx_cosh(a.y), -cx_sin(a.x) * cx_sinh(a.y)); }
vec2 csinh(vec2 a) { return vec2(cx_sinh(a.x) * cx_cos(a.y), cx_cosh(a.x) * cx_sin(a.y)); }
vec2 ccosh(vec2 a) { return vec2(cx_cosh(a.x) * cx_cos(a.y), cx_sinh(a.x) * cx_sin(a.y)); }
vec2 ctan(vec2 a) {
  if (abs(a.y) > 20.0) return vec2(0.0, sign(a.y));
  float c = cx_cos(a.x), s = cx_sin(a.x), sh = cx_sinh(a.y), ch = cx_cosh(a.y);
  return vec2(s * c, sh * ch) / (c * c + sh * sh);
}
vec2 ctanh(vec2 a) { vec2 t = ctan(vec2(-a.y, a.x)); return vec2(t.y, -t.x); }
vec2 cx_asin0(vec2 a) {
  vec2 s = csqrtp(vec2(1.0, 0.0) - cmul(a, a));
  vec2 l = clog(vec2(-a.y, a.x) + s, CX_PI, 0.0);
  return vec2(l.y, -l.x);
}
// asin is odd off its cuts; evaluating in the lower half-plane avoids the cancellation in iz + sqrt(1 - z^2)
vec2 casin(vec2 a) { return a.y > 0.0 ? -cx_asin0(-a) : cx_asin0(a); }
vec2 cacos(vec2 a) { vec2 s = casin(a); return vec2(CX_HALF_PI - s.x, -s.y); }
vec2 catan(vec2 a) {
  vec2 iz = vec2(-a.y, a.x);
  vec2 d = clog(vec2(1.0, 0.0) - iz, CX_PI, 0.0) - clog(vec2(1.0, 0.0) + iz, CX_PI, 0.0);
  return vec2(-0.5 * d.y, 0.5 * d.x);
}
vec2 casinh(vec2 a) { vec2 s = casin(vec2(-a.y, a.x)); return vec2(s.y, -s.x); }
vec2 cacosh(vec2 a) { return clog(a + cmul(csqrtp(a - vec2(1.0, 0.0)), csqrtp(a + vec2(1.0, 0.0))), CX_PI, 0.0); }
vec2 catanh(vec2 a) { vec2 t = catan(vec2(-a.y, a.x)); return vec2(t.y, -t.x); }
// (az+b)/(cz+d); at an overflowed argument, the value at infinity a/c (where the CPU's double gives ~a/c)
vec2 cx_mob(vec2 a, vec2 b, vec2 c, vec2 d, vec2 z) {
  if (cx_isinf(z)) return cdiv(a, c);
  return cdiv(cmul(a, z) + b, cmul(c, z) + d);
}
// Mobius map of a step: q = (mode, -, k), r = (alpha, beta). mode 0: (az+b)/(cz+d); mode 1 (nearly degenerate,
// ad - bc tiny against the entries): k + (alpha z + beta)/(cz+d) with (a,b) = k(c,d) + (alpha,beta) split on the
// CPU, which keeps the pole/zero pair accurate; mode 2 (degenerate): the constant k, but NaN (the CPU's 0/0) at
// r.zw when r.x = 1. An exactly degenerate map (ad - bc = 0) is constant on the CPU at its removable point too
// (funcs.js mobiusBuild, review math-6), so it never sets r.x.
vec2 cx_mobstep(vec2 z, vec4 ab, vec4 cd, vec4 q, vec4 r) {
  if (q.x > 1.5) return (r.x > 0.5 && z == r.zw) ? vec2(cx_nan()) : q.zw;
  if (q.x > 0.5) return q.zw + cx_mob(r.xy, r.zw, cd.xy, cd.zw, z);
  return cx_mob(ab.xy, ab.zw, cd.xy, cd.zw, z);
}
// Mobius one-parameter path A^t (A in SL2, Re tr A >= 0), as a matrix up to scale:
// p0 = (mode, -, lam) with Re lam >= 0, p1 = (M0, M1), p2 = (M2, M3), p3 = (P0, P1), p4 = (P2, P3), p5 = (Q0, Q3).
// mode 1 (parabolic): M = N, A^t = I + tN.
// mode 2: M = J, A^t = cosh(t lam) I + sinh(t lam) J = e^{t lam} (P + e^{-2 t lam} Q) with the spectral projectors
// P = (I + J)/2, Q = (I - J)/2 (Q1 = -P1, Q2 = -P2). Once Re(t lam) is large, cosh - sinh cancels catastrophically
// in float32, so the projector form is used there (it has no cancellation: |e^{-2 t lam}| < 1/e).
void cx_mobmat(float t, vec4 p0, vec4 p1, vec4 p2, vec4 p3, vec4 p4, vec4 p5,
               out vec2 m0, out vec2 m1, out vec2 m2, out vec2 m3) {
  if (p0.x < 1.5) {
    m0 = vec2(1.0, 0.0) + p1.xy * t; m1 = p1.zw * t; m2 = p2.xy * t; m3 = vec2(1.0, 0.0) + p2.zw * t;
    return;
  }
  vec2 l = p0.zw * t;
  if (l.x > 0.5) {
    vec2 e = cexp(-2.0 * l);
    vec2 oe = vec2(1.0, 0.0) - e;
    m0 = p3.xy + cmul(e, p5.xy); m1 = cmul(p3.zw, oe); m2 = cmul(p4.xy, oe); m3 = p4.zw + cmul(e, p5.zw);
    return;
  }
  vec2 ch = ccosh(l), st = csinh(l);
  m0 = ch + cmul(st, p1.xy); m1 = cmul(st, p1.zw); m2 = cmul(st, p2.xy); m3 = ch + cmul(st, p2.zw);
}
vec2 cx_mobpath(vec2 z, float t, vec4 p0, vec4 p1, vec4 p2, vec4 p3, vec4 p4, vec4 p5) {
  vec2 m0, m1, m2, m3;
  cx_mobmat(t, p0, p1, p2, p3, p4, p5, m0, m1, m2, m3);
  return cx_mob(m0, m1, m2, m3, z);
}
// the path applied to u, or with inv to w = 1/u, for arguments whose reciprocal is the one representable in float32
// (one function for both, so a caller that picks one at run time has the path inlined once)
vec2 cx_mobpathu(vec2 u, float t, bool inv, vec4 p0, vec4 p1, vec4 p2, vec4 p3, vec4 p4, vec4 p5) {
  vec2 m0, m1, m2, m3;
  cx_mobmat(t, p0, p1, p2, p3, p4, p5, m0, m1, m2, m3);
  return inv ? cx_mob(m1, m0, m3, m2, u) : cx_mob(m0, m1, m2, m3, u);
}
` + natLib();

  // Natural paths (funcs.js): the small-argument series of the odd functions (a (1 + c3 a^2 + ... + c13 a^12) for
  // |a| < 0.1, as Funcs' serS) and log(1 + v) (8 terms for |v| < 0.1, float32 accurate), so the first frames of a
  // zoom path (t ~ 1e-5) do not cancel
  function natLib() {
    const lit = (x) => { const v = String(Math.fround(x)); return /[.eE]/.test(v) ? v.replace(/e\+?/, 'e') : v + '.0'; };
    const SER = {
      sin: ['csin', [-1 / 6, 1 / 120, -1 / 5040, 1 / 362880, -1 / 39916800, 1 / 6227020800]],
      sinh: ['csinh', [1 / 6, 1 / 120, 1 / 5040, 1 / 362880, 1 / 39916800, 1 / 6227020800]],
      tan: ['ctan', [1 / 3, 2 / 15, 17 / 315, 62 / 2835, 1382 / 155925, 21844 / 6081075]],
      tanh: ['ctanh', [-1 / 3, 2 / 15, -17 / 315, 62 / 2835, -1382 / 155925, 21844 / 6081075]],
      asin: ['casin', [1 / 6, 3 / 40, 15 / 336, 105 / 3456, 945 / 42240, 10395 / 599040]],
      asinh: ['casinh', [-1 / 6, 3 / 40, -15 / 336, 105 / 3456, -945 / 42240, 10395 / 599040]],
      atan: ['catan', [-1 / 3, 1 / 5, -1 / 7, 1 / 9, -1 / 11, 1 / 13]],
      atanh: ['catanh', [1 / 3, 1 / 5, 1 / 7, 1 / 9, 1 / 11, 1 / 13]],
    };
    let out = '';
    for (const [nm, [bi, c]] of Object.entries(SER)) {
      out += `vec2 cx_${nm}S(vec2 a) {\n  if (dot(a, a) >= 0.01) return ${bi}(a);\n  vec2 a2 = cmul(a, a);\n  vec2 s = vec2(${lit(c[5])}, 0.0);\n`;
      for (let i = 4; i >= 0; i--) out += `  s = vec2(${lit(c[i])}, 0.0) + cmul(a2, s);\n`;
      out += '  return a + cmul(a, cmul(a2, s));\n}\n';
    }
    out += 'vec2 cx_log1p(vec2 v) {\n  if (dot(v, v) >= 0.01) return clog(vec2(1.0, 0.0) + v, CX_PI, 0.0);\n  vec2 s = vec2(-0.125, 0.0);\n';
    for (let k = 7; k >= 1; k--) out += `  s = vec2(${lit((k % 2 ? 1 : -1) / k)}, 0.0) + cmul(v, s);\n`;
    out += '  return cmul(v, s);\n}\n';
    return out;
  }

  // ---- CPU-side precomputation ----
  // Mirror of CX.mobPath: returns {mode, lam, M, P, Q} or null (degenerate). mode 1: parabolic, M = N.
  // mode 2: M = J and the spectral projectors P = (I + J)/2 = (A - e^{-lam} I)/(2 sinh lam) (all four entries)
  // and Q = (I - J)/2 = (e^{lam} I - A)/(2 sinh lam) (diagonal only), so that A^t = e^{t lam}(P + e^{-2 t lam} Q).
  // The spectral form keeps the small diagonal entries of P and Q accurate (1 + J would round them to ~1e-16).
  function mobPathData(m) {
    if (!(CX.mobRel(m) >= CX.MOB_EPS)) return null;
    let [a, b, c, d] = CX.mobScaled(m);
    const det = CX.sub(CX.mul(a, d), CX.mul(b, c));
    const s = CX.sqrt(det);
    a = CX.div(a, s); b = CX.div(b, s); c = CX.div(c, s); d = CX.div(d, s);
    let tr = CX.add(a, d);
    if (tr.re < 0 || (tr.re === 0 && tr.im < 0)) { a = CX.neg(a); b = CX.neg(b); c = CX.neg(c); d = CX.neg(d); tr = CX.neg(tr); }
    const half = CX.scale(tr, 0.5);
    const N = [CX.sub(a, half), b, c, CX.sub(d, half)];
    if (CX.abs(CX.sub(half, CX.ONE)) < 1e-9) return { mode: 1, lam: C(0, 0), M: N };
    let lam = CX.acosh(half);
    // cosh(t lam) I + sinh(t lam) J is unchanged by (lam, J) -> (-lam, -J); pick Re lam >= 0 so |e^{-2 t lam}| <= 1
    if (lam.re < 0) lam = CX.neg(lam);
    const sh = CX.sinh(lam);
    const sh2 = CX.scale(sh, 2), ep = CX.exp(lam), em = CX.exp(CX.neg(lam));
    const A = [a, b, c, d];
    return {
      mode: 2, lam, M: N.map((x) => CX.div(x, sh)),
      P: [CX.div(CX.sub(a, em), sh2), CX.div(b, sh2), CX.div(c, sh2), CX.div(CX.sub(d, em), sh2)],
      Q: [CX.div(CX.sub(ep, A[0]), sh2), CX.div(CX.sub(ep, A[3]), sh2)],
    };
  }
  // Split of a Mobius map for evaluation (see cx_mobstep): {mode, k, alpha, beta}.
  function mobStepData(m) {
    const [a, b, c, d] = m;
    const z = { mode: 0, k: C(0, 0), alpha: C(0, 0), beta: C(0, 0) };
    const sc = (CX.abs(a) + CX.abs(b)) * (CX.abs(c) + CX.abs(d));
    const n2 = CX.abs2(c) + CX.abs2(d);
    if (!(sc > 0) || !Number.isFinite(sc) || !(n2 > 0) || !Number.isFinite(n2)) return z;
    const rel = CX.abs(CX.sub(CX.mul(a, d), CX.mul(b, c))) / sc;
    if (!(rel < 1e-3)) return z;
    // least-squares k: (a, b) - k (c, d) is orthogonal to (c, d)
    const k = CX.scale(CX.add(CX.mul(a, CX.conj(c)), CX.mul(b, CX.conj(d))), 1 / n2);
    // below 1e-12 the CPU's own map is constant up to rounding (its pole and zero coincide to ~1e-16), except at
    // the pole itself, where it is 0/0. When that pole is a float32 point, alpha = (1, 0) and beta = pole make the
    // GPU return NaN there too. An exactly degenerate map is the constant a/c everywhere on the CPU, its removable
    // point included (funcs.js mobiusBuild), so it gets no NaN point.
    if (rel < 1e-12) {
      const p = CX.isZero(c) || CX.mobDetZero(m) ? null : CX.neg(CX.div(d, c));
      const exact = p && Math.fround(p.re) === p.re && Math.fround(p.im) === p.im && !CX.isFin(CX.mobApply(m, p));
      return { mode: 2, k, alpha: C(exact ? 1 : 0, 0), beta: exact ? p : C(0, 0) };
    }
    return { mode: 1, k, alpha: CX.sub(a, CX.mul(k, c)), beta: CX.sub(b, CX.mul(k, d)) };
  }

  // Uniform allocator in vec2 cells (two per vec4 slot). A writer fills cell values on demand.
  function makeAlloc() {
    let cells = 0;
    const comp = (c, k) => `uChain[${c >> 1}].${(c & 1 ? 'zw' : 'xy')[k]}`;
    return {
      cell() {
        const c = cells++;
        return { c, v: `uChain[${c >> 1}].${c & 1 ? 'zw' : 'xy'}`, x: comp(c, 0), y: comp(c, 1) };
      },
      slot() {
        if (cells & 1) cells++;
        const s = cells >> 1;
        cells += 2;
        return { s, c: 2 * s, v: `uChain[${s}]` };
      },
      get slots() { return Math.max(1, (cells + 1) >> 1); },
    };
  }

  // linear homotopy (1-t) z + t f(z); exact identity at t = 0 even where f overflows float32
  const LIN = (P) => `if (t == 0.0) return z;\n  vec2 w = ${P}_f(z);\n  return z * (1.0 - t) + w * t;`;
  // a step's path with the t = 1 shortcut, the map itself there (exactly): every path but a straight line's (LIN, whose
  // z (1 - t) + f(z) t is not f(z) where z is infinite) and a plan that handles t = 1 in its own body (own1, issue #355)
  const exactAt1 = (pl) => !pl.h.startsWith('if (t == 0.0)');
  const withOne = (P, pl) => (!exactAt1(pl) || pl.own1 ? pl.h : `if (t == 1.0) return ${P}_f(z);\n  ${pl.h}`);

  // Allocates six consecutive slots for a Mobius path; returns {p0, call(zExpr, tExpr), callu(uExpr, tExpr, invExpr),
  // write(put, data)}. call applies the path to z, callu to u, or to 1/u where inv.
  function pathSlots(A) {
    const s = [A.slot(), A.slot(), A.slot(), A.slot(), A.slot(), A.slot()];
    const args = s.map((x) => x.v).join(', ');
    const c0 = s[0].c;
    return {
      p0: s[0].v,
      call: (z, t) => `cx_mobpath(${z}, ${t}, ${args})`,
      callu: (u, t, inv) => `cx_mobpathu(${u}, ${t}, ${inv}, ${args})`,
      write(put, d) {
        for (let i = 0; i < 12; i++) put(c0 + i, 0, 0); // mode 0 (degenerate: linear fallback); no stale values
        if (!d) return;
        put(c0, d.mode, 0);
        put(c0 + 1, d.lam.re, d.lam.im);
        for (let i = 0; i < 4; i++) put(c0 + 2 + i, d.M[i].re, d.M[i].im); // cells 2..5: slots 1, 2
        if (d.mode !== 2) return;
        for (let i = 0; i < 4; i++) put(c0 + 6 + i, d.P[i].re, d.P[i].im); // cells 6..9: slots 3, 4
        put(c0 + 10, d.Q[0].re, d.Q[0].im); put(c0 + 11, d.Q[1].re, d.Q[1].im); // slot 5
      },
    };
  }
  // hom via Mobius path, with the app's linear fallback when the CPU hom is null (degenerate map), and the map itself
  // at t = 1 (own1: one call of the map serves both, so FXC, which inlines every call, writes the map once)
  const pathHom = (P, path) => `if (${path.p0}.x < 0.5 || t == 1.0) {\n    if (t == 0.0) return z;\n    vec2 w = ${P}_f(z);\n    return t == 1.0 ? w : z * (1.0 - t) + w * t;\n  }\n  return ${path.call('z', 't')};`;

  const putC = (put, cell, v) => put(cell.c, v.re, v.im);

  // [issue #5] a series on the GPU: SER_GPU terms of a power or Dirichlet series in uniforms (half each way for a
  // Laurent series), SER_GPU_LOOP terms of any other sum, its index a loop variable (as many as the CPU takes, so both
  // stop at the same point and agree where the series converges slowly)
  const SER_GPU = 96, SER_GPU_LOOP = 512;
  // (a Dirichlet series on the GPU: its |Im w| limit, CX_ZETA_TMAX, and cx_zetaEM's six B₂ⱼ/(2j)!, written into its code:
  // the special functions' library is linked only for their calls)
  const DIR_TMAX = 120, EM6 = '0.08333333333333333, -0.001388888888888889, 0.0000330687830687831, -8.267195767195768e-7, 2.08767569878681e-8, -5.284190138687493e-10';
  // the terms' float32 rounding (about 1.2e-7 of the sum of their sizes M) above 5e-4 of 1 + |S|: cancelled (the GLSL
  // test skips the same points: its cancellation probe)
  const SER_CANCEL = (M, S) => `${M} * 1.2e-7 > 5e-4 * (1.0 + cx_abs(${S}))`;
  // the trusted radius of one side of a power series (sg 1: |w| ≤ r; sg −1: |w| ≥ r) with ng terms kept: past it the
  // terms dropped (up to the CPU's) exceed 1e-6 of those kept, or the terms exceed 1e18, in logs; never past the radius
  // of convergence R
  function trustedR(sd, sg, ng, R) {
    const e = sd.e.map((x) => x * sg), la = sd.a.map((a) => Math.log(CX.abs(a)));
    const conv = sg > 0 ? R : (R > 0 ? 1 / R : Infinity);
    if (sd.done && sd.a.length <= ng) return sg > 0 ? Infinity : 0;
    // coefficients that underflowed to 0 in float64 after the last finite ones (1/(2n+1)! past n = 85) are not 0: their
    // logs continue the line through the last two finite ones (an overestimate where they fall faster than geometric)
    const fi = la.map((x, k) => (Number.isFinite(x) ? k : -1)).filter((k) => k >= 0);
    if (!sd.done && fi.length >= 2 && fi[fi.length - 1] < la.length - 1) {
      const k1 = fi[fi.length - 2], k2 = fi[fi.length - 1], sl = (la[k2] - la[k1]) / (e[k2] - e[k1]);
      for (let k = k2 + 1; k < la.length; k++) la[k] = la[k2] + sl * (e[k] - e[k2]);
    }
    const lse = (x, y) => (x === -Infinity ? y : y === -Infinity ? x : Math.max(x, y) + Math.log1p(Math.exp(-Math.abs(x - y))));
    const ok = (lr) => {
      let head = -Infinity, tail = -Infinity;
      for (let k = 0; k < la.length; k++) { if (la[k] === -Infinity) continue; const v = la[k] + e[k] * lr; if (k < ng) head = lse(head, v); else tail = lse(tail, v); }
      // (and float32 holds the terms there, and their squares: |b| above 1e18 overflows cx_abs)
      return tail <= head + Math.log(1e-6) && head <= Math.log(1e18);
    };
    let lo = -60, hi = Math.log(Math.min(conv, 1e12));
    if (!(hi > lo)) return sg > 0 ? 0 : Infinity;
    if (ok(hi)) lo = hi;
    else for (let i = 0; i < 50; i++) { const m = 0.5 * (lo + hi); if (ok(m)) lo = m; else hi = m; }
    const r = lo <= -60 ? 0 : Math.exp(lo);
    return sg > 0 ? r : (r > 0 ? 1 / r : Infinity);
  }
  // the radii between which the GPU evaluates a power or Laurent series' plan: {out, in}
  function seriesTrust(plan) {
    const two = plan.up && plan.down, NG = two ? SER_GPU / 2 : SER_GPU;
    return { out: plan.up ? trustedR(plan.up, 1, NG, plan.R) : Infinity, in: plan.down ? trustedR(plan.down, -1, NG, plan.r) : 0 };
  }
  // ---- custom formulas: mirror Expr.compile ----
  // a subtree that holds a shared number (its value is a uniform, never in the program key)
  const hasParam = (n) => (n.t === 'num' ? n.param != null : Object.keys(n).some((k) => {
    const x = n[k];
    return !!x && typeof x === 'object' && (Array.isArray(x) ? x.some((y) => !!y && !!y.t && hasParam(y)) : !!x.t && hasParam(x));
  }));
  // ---- [issue #395] a large formula of z, constants, + − × ÷, integer powers and log alone (the Mountain King's
  // sum of 15 log pairs of 10 shapes): its ops, in the order the straight-line code takes them, go into uniforms,
  // four to a vec4, and one loop runs them on a small stack, calling the same cmul / cdiv / clog (cx_ipow32 or cipow
  // for a power) on the same values in the same order, so the values are the same. Written out, Direct3D's FXC
  // inlines every helper at every call: 29 log nodes made the sheet function 196 KiB and the Landscape edge
  // programs 220 and 466 KiB (link time grows about as size^2.9). Smaller formulas keep their straight-line code.
  // The threshold, in ops: below it the straight-line code stays (it is cheap to compile, and a uniform-driven loop
  // costs a few instructions per op at every pixel); above it the written-out code is what FXC takes minutes over
  // (the Mountain King's exponent: 283 ops). The default page's and the gallery's formulas are far below it.
  // GLChain.ratLogMin(n) changes it (the GLSL page's A/B: the same chain, both ways, the same values bit for bit)
  let RL_MIN = 64;
  // the number of ops of such a formula (postfix, a constant subtree one op), or 0 when it holds anything else
  function ratLogOps(ast) {
    const dep = Expr.depends;
    let n = 0, ok = true;
    const walk = (x) => {
      if (!ok) return;
      if (!dep(x)) { n++; return; }
      switch (x.t) {
        case 'var': if (x.n !== 'z') ok = false; n++; return;
        case 'neg': walk(x.a); n++; return;
        case 'add': case 'sub': case 'mul': case 'div':
          walk(x.a); walk(x.b);
          // (a constant operand is folded into the op: its own op is not one)
          n += dep(x.a) && dep(x.b) ? 1 : 0;
          return;
        case 'pow': {
          // (an integer exponent without a shared number: written out by genCustom, cipow in the sheet code)
          if (dep(x.b) || hasParam(x.b) || (Funcs.branchNode && Funcs.branchNode(x))) { ok = false; return; }
          const v = Expr.compile(x.b, { theta: 0 })(C(0, 0));
          if (!(v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096)) { ok = false; return; }
          walk(x.a); n++;
          return;
        }
        case 'call': if (x.f !== 'log') { ok = false; return; } walk(x.a); n++; return;
        default: ok = false;
      }
    };
    walk(ast);
    return ok ? n : 0;
  }
  // the op list of such a formula, in the order the straight-line code takes them: ops (5-bit codes), and the values
  // they read, in the order they read them: consts (a constant node, or {pow: n} an integer exponent) and logs (the
  // log nodes, for their sheet digits). Read in order, each from one block of consecutive cells, so an op names
  // none, and four ops go in a float (16 to a vec4): the uniforms stay near what the written-out code used.
  // Ops: 0 z, 1 a constant, 2-5 + − × ÷, 6 neg, 7 an integer power, 8 log, 9-12 x op k, 13-16 k op x (k a constant)
  function ratLogList(ast) {
    const dep = Expr.depends, ops = [], consts = [], logs = [];
    let d = 0, maxD = 0;
    const up = () => { d++; maxD = Math.max(maxD, d); };
    const BIN = { add: 0, sub: 1, mul: 2, div: 3 };
    const walk = (x) => {
      if (!dep(x)) { consts.push(x); ops.push(1); up(); return; }
      switch (x.t) {
        case 'var': ops.push(0); up(); return;
        case 'neg': walk(x.a); ops.push(6); return;
        case 'add': case 'sub': case 'mul': case 'div': {
          const k = BIN[x.t];
          if (!dep(x.b)) { walk(x.a); consts.push(x.b); ops.push(9 + k); return; }
          if (!dep(x.a)) { walk(x.b); consts.push(x.a); ops.push(13 + k); return; }
          walk(x.a); walk(x.b); ops.push(2 + k); d--;
          return;
        }
        case 'pow': { walk(x.a); consts.push({ pow: Expr.compile(x.b, { theta: 0 })(C(0, 0)).re, node: x }); ops.push(7); return; }
        case 'call': { walk(x.a); logs.push(x); ops.push(8); return; }
      }
      throw new Error(`GLChain: not a log-pair formula ('${x.t}')`);
    };
    walk(ast);
    return { ops, consts, logs, maxD: Math.max(1, maxD) };
  }
  // n consecutive cells (A.cell), -> the first one's index
  function ratLogCells(A, n, each) {
    let c0 = -1;
    for (let i = 0; i < n; i++) {
      const cell = A.cell();
      if (i === 0) c0 = cell.c; else if (cell.c !== c0 + i) throw new Error('GLChain: cells not consecutive');
      each(cell, i);
    }
    return Math.max(0, c0);
  }
  // the ops' slots (consecutive, four 5-bit codes to a float) and their writer; -> the first slot. The map's code and
  // the sheet code of one formula have the same ops: one chain's allocator gives them one set of slots (its values()
  // writes every plan, so the slots are written whichever plan takes them)
  const rlShared = new WeakMap();
  function ratLogOpSlots(A, ops, writers, ast) {
    if (!rlShared.has(A)) rlShared.set(A, new Map());
    const key = astSig(ast), seen = rlShared.get(A).get(key);
    if (seen != null) return seen;
    const ns = Math.ceil(ops.length / 16), sl = [];
    for (let k = 0; k < ns; k++) sl.push(A.slot());
    if (!sl.every((x, k) => x.s === sl[0].s + k)) throw new Error('GLChain: op slots not consecutive');
    const f = (i) => { let v = 0; for (let j = 3; j >= 0; j--) v = v * 32 + (4 * i + j < ops.length ? ops[4 * i + j] : 0); return v; };
    writers.push((put) => { sl.forEach((x, k) => { put(x.c, f(4 * k), f(4 * k + 1)); put(x.c + 1, f(4 * k + 2), f(4 * k + 3)); }); });
    rlShared.get(A).set(key, sl[0].s);
    return sl[0].s;
  }
  // a cell by index (consecutive cells: two to a vec4)
  const RL_CELL = (i) => `(${i} - 2 * (${i} / 2) == 1 ? uChain[${i} / 2].zw : uChain[${i} / 2].xy)`;
  // the loop's head: op i's code (highp: a float of four codes passes 16 bits), and the constants' pointer kc
  const RL_HEAD = (s0, n, k0) => `  highp int kc = ${k0};
  for (int i = 0; i < max(${n}, uNoUnroll); i++) {
    vec4 o4 = uChain[${s0} + (i >> 4)];
    int j4 = (i >> 2) & 3;
    highp int w4 = int(j4 == 0 ? o4.x : j4 == 1 ? o4.y : j4 == 2 ? o4.z : o4.w);
    highp int op = (w4 >> (5 * (i & 3))) & 31;
    vec2 kv = vec2(0.0);
    if (op == 1 || op == 7 || op >= 9) { kv = ${RL_CELL('kc')}; kc++; }`;

  // baked: when given (a custom step, whose key holds it), constant exponents are specialized and their kinds pushed
  // here; without it (d/dz, whose key holds its own source) they stay uniforms through cx_powk
  function genCustom(ast, P, A, TH, writers, lines, baked = null, shape = []) {
    let tmp = 0, out = lines;
    const dep = Expr.depends;
    const tv = (expr) => { const nm = `${P}_${tmp++}`; out.push(`  vec2 ${nm} = ${expr};`); return nm; };
    // [issue #5] the loop variables of the sums being generated, innermost last
    const idxVar = [];
    let sums = 0;
    const constOf = (n, th) => Expr.compile(n, { theta: th })(C(0, 0));
    // a loop's trip count as a uniform (a cell its writer fills with n, or with n() at write time), never a constant:
    // D3D's FXC (ANGLE on Windows) unrolls a loop with a constant bound, so a long series body becomes hundreds of copies
    // and minutes of compiling; a uniform bound keeps it a loop
    const uBound = (n) => { const c = A.cell(); writers.push((put) => put(c.c, typeof n === 'function' ? n() : n, 0)); return `int(${c.x})`; };
    const UN = {
      sin: 'csin', cos: 'ccos', tan: 'ctan', sinh: 'csinh', cosh: 'ccosh', tanh: 'ctanh',
      asin: 'casin', acos: 'cacos', atan: 'catan', asinh: 'casinh', acosh: 'cacosh', atanh: 'catanh', exp: 'cexp',
      gamma: 'cx_gamma', zeta: 'cx_zeta', digamma: 'cx_digamma', zetad: 'cx_zetad', fact: 'cx_fact',
    };
    const RECIP = { cot: 'ctan', sec: 'ccos', csc: 'csin', coth: 'ctanh' };
    const NAN = 'vec2(cx_nan())';
    // ---- [issue #5] sums and products ----
    // A power or Laurent series (Expr's plan): its coefficients, computed on the CPU in float64, scaled to the trusted
    // radius s (b_k = a_k s^{e_k}), in uniform slots, so |u| = |w|/s <= 1 and float32 neither overflows nor loses the
    // small coefficients; Horner's rule in u^p when the exponents step by p, else the powers one after another. NaN
    // beyond the trusted radii (where the first terms leave a tail above 1e-6 of them, or past the radius of convergence)
    // and where the terms cancel by more than three digits.
    function powerGL(n, plan, id) {
      const sides = [plan.up ? 1 : 0, plan.down ? -1 : 0].filter(Boolean), NG = sides.length === 2 ? SER_GPU / 2 : SER_GPU;
      const arith = (sd, sg) => { const e = sd.e.map((x) => x * sg), p = e.length > 1 ? e[1] - e[0] : 1; return p >= 1 && e.every((x, k) => x === e[0] + p * k); };
      const geo = A.cell(), rho = A.cell(), slots = [];
      shape.push('P' + sides.map((sg) => (arith(sg > 0 ? plan.up : plan.down, sg) ? 'h' : 's') + sg).join(''));
      out.push(`  vec2 ${id}_w = z - ${geo.v};`);
      const sideGL = (sg) => {
        const sd = sg > 0 ? plan.up : plan.down, h = arith(sd, sg);
        const s0 = A.slot(), sl = [s0];
        for (let k = 1; k < NG; k++) sl.push(A.slot());
        if (!sl.every((x, k) => x.s === s0.s + k)) throw new Error('GLChain: series slots not consecutive');
        const ep = A.cell(), sc = A.cell(), nk = uBound(() => Math.min(NG, sd.e.length));
        slots.push({ sg, sd, h, s0, ep, sc });
        const t = sg > 0 ? 'p' : 'm', u = `${id}_u${t}`, H = `${id}_H${t}`, M = `${id}_M${t}`;
        // u = w/s outside (s/w inside); Horner: H = Σ b_k v^k with v = u^p, times u^{e0}; M the same sum of |b_k| |v|^k
        out.push(`  vec2 ${u} = ${sg > 0 ? `${id}_w / ${sc.x}` : `cdiv(vec2(${sc.x}, 0.0), ${id}_w)`};`);
        if (h) {
          out.push(`  vec2 ${u}v = cx_ipowi(${u}, ${ep.y}), ${H} = vec2(0.0); float ${u}a = cx_abs(${u}v), ${M} = 0.0;
  for (int k = ${nk} - 1; k >= 0; k--) { vec4 q = uChain[${s0.s} + k]; ${H} = cmul(${H}, ${u}v) + q.xy; ${M} = ${M} * ${u}a + cx_abs(q.xy); }
  ${H} = cmul(${H}, cx_ipowi(${u}, ${ep.x})); ${M} *= pow(max(cx_abs(${u}), 1e-30), ${ep.x});`);
        } else {
          out.push(`  vec2 ${H} = vec2(0.0), ${u}P = vec2(1.0, 0.0); float ${M} = 0.0;
  for (int k = 0; k < ${nk}; k++) { vec4 q = uChain[${s0.s} + k]; if (q.w < 0.5) break; ${u}P = cmul(${u}P, cx_ipowi(${u}, q.z)); vec2 t = cmul(q.xy, ${u}P); ${H} += t; ${M} += cx_abs(t); }`);
        }
        return { H, M };
      };
      const parts = sides.map(sideGL);
      const S = `${id}_S`, M = `${id}_M`;
      out.push(`  vec2 ${S} = ${parts.map((x) => x.H).join(' + ')}; float ${M} = ${parts.map((x) => x.M).join(' + ')};
  float ${id}_aw = cx_abs(${id}_w);
  if (!(${id}_aw <= ${rho.x}) || !(${id}_aw >= ${rho.y}) || ${SER_CANCEL(M, S)}) ${S} = ${NAN};`);
      writers.push((put) => {
        put(geo.c, plan.c.re, plan.c.im);
        const tr = seriesTrust(plan), rOut = tr.out, rIn = tr.in;
        for (const x of slots) {
          const t = x.sg > 0 ? rOut : rIn;
          // the scale: the trusted radius (1 for a series without one, or one past float32)
          const sc = Number.isFinite(t) && t > 1e-30 && t < 1e30 ? t : 1;
          put(x.sc.c, sc, 0);
          const e = x.sd.e.map((v) => v * x.sg);
          put(x.ep.c, e[0] || 0, e.length > 1 ? e[1] - e[0] : 1);
          for (let k = 0; k < NG; k++) {
            const a = x.sd.a[k], c = x.s0.c + 2 * k;
            if (!a || k >= e.length) { put(c, 0, 0); put(c + 1, 0, 0); continue; }
            // (outside u = w/s: b_k = a_k s^{e_k}; inside u = s/w: b_k = a_k s^{−e_k})
            const m = CX.abs(a), lm = Math.log(m) + e[k] * x.sg * Math.log(sc), b = m > 0 && lm > -700 && lm < 700 ? CX.scale(a, Math.exp(lm) / m) : C(0, 0);
            put(c, Math.fround(b.re) || 0, Math.fround(b.im) || 0);
            put(c + 1, x.h ? 0 : e[k] - (k ? e[k - 1] : 0), 1);
          }
        }
        // (in float32 rounded inwards: a radius just below 1 must not become 1, the natural boundary of Σ z^{2^n})
        const f32 = (x, up) => { const f = Math.fround(x); return f === x || !Number.isFinite(f) ? f : (f > x) === up ? f : f + (up ? 1 : -1) * Math.max(Math.abs(f), 1e-38) * 1.2e-7; };
        put(rho.c, f32(Math.min(rOut, 3e38), false), f32(rIn, true));
      });
      return S;
    }
    // Σ a(n) n^{−z} (Expr's dirichlet plan), by the plan's kind in a uniform (mode), so new coefficients never recompile:
    //  1. coefficients b_{n mod q} n^p from K0 on (CX.dirichletForm): Euler–Maclaurin per residue, as CX.dirichletEM with
    //     N = |Im w| + 10 and six Bernoulli terms (cx_zetaEM's), the head terms a_n n^{−p} and the b_r in slots; NaN for
    //     |Im w| > CX_ZETA_TMAX (cx_zeta's blank);
    //  0. any other: SER_GPU terms, a_k and log k in slots, NaN where the rest may exceed 1e-4 of the sum (G K^{σ−Re z}/(Re z − σ),
    //     G the largest |a_j| j^{1−σ} past them);
    //  2. a coefficient undefined: NaN.
    // NaN for Re z ≤ σ and where the terms cancel by more than three digits
    function dirichletGL(n, plan, id) {
      const NG = SER_GPU, s0 = A.slot(), sl = [s0];
      for (let k = 1; k < NG; k++) sl.push(A.slot());
      if (!sl.every((x, k) => x.s === s0.s + k)) throw new Error('GLChain: series slots not consecutive');
      const g1 = A.slot(), g2 = A.slot(), F = () => plan.form;
      const nk = uBound(() => (plan.form || plan.bad != null ? 0 : Math.min(plan.a.length, NG)));
      const nh = uBound(() => (F() ? F().head.length : 0)), nq = uBound(() => (F() ? F().q : 0));
      const nc = uBound(DIR_TMAX + 10);
      shape.push('D');
      const S = `${id}_S`, M = `${id}_M`, w = `${id}_w`;
      out.push(`  vec2 ${S} = vec2(0.0); float ${M} = 0.0; vec4 ${id}_g = ${g1.v}, ${id}_h = ${g2.v};
  if (${id}_g.y > 1.5) ${S} = ${NAN};
  else if (${id}_g.y > 0.5) {
    vec2 ${w} = z - vec2(${id}_h.x, 0.0), wm = ${w} - vec2(1.0, 0.0);
    float q = ${id}_h.y, K0 = ${id}_h.z;
    int N = int(ceil(abs(${w}.y))) + 10;
    for (int k = 0; k < ${nh}; k++) { vec4 a = uChain[${s0.s} + k]; vec2 t = cmul(a.xy, cexp(-${w} * a.z)); ${S} += t; ${M} += cx_abs(t); }
    for (int m = 0; m < ${nc}; m++) {
      if (m >= N) break;
      for (int r = 0; r < ${nq}; r++) {
        vec2 b = uChain[${s0.s} + ${nh} + r].xy;
        if (b == vec2(0.0)) continue;
        vec2 t = cmul(b, cexp(-${w} * log(K0 + float(r) + q * float(m)))); ${S} += t; ${M} += cx_abs(t);
      }
    }
    // the tails: X^{−w} (½ + Σ c_j P_j (q/X)^{2j−1}) per residue, and the poles X_0^{1−w} (B/(w − 1) − Σ b_r d_r E((1 − w) d_r))/q
    // (d_r = log(X_r/X_0) by its atanh series, E(u) = (e^u − 1)/u by its Taylor series for |u| < 1/2)
    float X0 = K0 + q * float(N);
    const float ${id}_c[6] = float[6](${EM6});
    vec2 P[6];
    P[0] = ${w};
    for (int j = 1; j < 6; j++) P[j] = cmul(P[j - 1], cmul(${w} + vec2(float(2 * j - 1), 0.0), ${w} + vec2(float(2 * j), 0.0)));
    vec2 pole = ${id}_g.zw == vec2(0.0) ? vec2(0.0) : cdiv(${id}_g.zw, wm);
    for (int r = 0; r < ${nq}; r++) {
      vec2 b = uChain[${s0.s} + ${nh} + r].xy;
      if (b == vec2(0.0)) continue;
      float X = X0 + float(r), h = q / X, h2 = h * h;
      vec2 br = vec2(0.0);
      for (int j = 5; j >= 0; j--) br = br * h2 + ${id}_c[j] * P[j];
      br = br * h + vec2(0.5, 0.0);
      vec2 t = cmul(b, cmul(cexp(-${w} * log(X)), br)); ${S} += t; ${M} += cx_abs(t);
      if (r > 0) {
        float y = float(r) / (2.0 * X0 + float(r)), y2 = y * y, d = 2.0 * y * (1.0 + y2 * (1.0 / 3.0 + y2 * (0.2 + y2 / 7.0)));
        vec2 u = -wm * d, E;
        if (cx_abs(u) < 0.5) E = vec2(1.0, 0.0) + cmul(u, vec2(0.5, 0.0) + cmul(u, vec2(1.0 / 6.0, 0.0) + cmul(u, vec2(1.0 / 24.0, 0.0) + cmul(u, vec2(1.0 / 120.0, 0.0) + cmul(u, vec2(1.0 / 720.0, 0.0) + u / 5040.0)))));
        else E = cdiv(cexp(u) - vec2(1.0, 0.0), u);
        pole -= cmul(b, E) * d;
      }
    }
    pole = cmul(pole, cexp(-${w} * log(X0))) * (X0 / q);
    ${S} += pole; ${M} += cx_abs(pole);
    if (abs(${w}.y) > ${DIR_TMAX}.0) ${S} = ${NAN};
  } else {
    for (int k = 0; k < ${nk}; k++) { vec4 q = uChain[${s0.s} + k]; vec2 t = cmul(q.xy, cexp(-z * q.z)); ${S} += t; ${M} += cx_abs(t); }
    float sp = z.x - ${id}_g.x;
    if (!(${id}_h.w * pow(${id}_h.z, -sp) / sp <= 1e-4 * cx_abs(${S}))) ${S} = ${NAN};
  }
  if (!(z.x > ${id}_g.x + 1e-6) || ${SER_CANCEL(M, S)}) ${S} = ${NAN};`);
      writers.push((put) => {
        const Fm = plan.form, sig = Number.isNaN(plan.sigma) ? 0 : Math.max(-1e30, plan.sigma);
        const slot = (k, x, y, zz) => { put(s0.c + 2 * k, x, y); put(s0.c + 2 * k + 1, zz, 1); };
        for (let k = 0; k < NG; k++) slot(k, 0, 0, 0);
        if (plan.bad != null) { put(g1.c, 0, 2); put(g1.c + 1, 0, 0); put(g2.c, 0, 0); put(g2.c + 1, 0, 0); return; }
        if (Fm) {
          Fm.head.forEach((x, k) => slot(k, x.re, x.im, Math.log(Fm.lo + k)));
          Fm.b.forEach((x, r) => slot(Fm.head.length + r, x.re, x.im, 0));
          put(g1.c, sig, 1); put(g1.c + 1, Fm.B.re, Fm.B.im);
          put(g2.c, Fm.p, Fm.q); put(g2.c + 1, Fm.K0, 0);
          return;
        }
        const K = Math.min(plan.a.length, NG);
        for (let k = 0; k < K; k++) slot(k, plan.a[k].re, plan.a[k].im, Math.log(plan.lo + k));
        let G = 0;
        for (let j = K; j < plan.a.length; j++) G = Math.max(G, CX.abs(plan.a[j]) * Math.pow(plan.lo + j, 1 - plan.sigma));
        put(g1.c, sig, 0); put(g1.c + 1, 0, 0);
        put(g2.c, 0, 0); put(g2.c + 1, plan.lo + K - 1, G);
      });
      return S;
    }
    // any other sum or product: a loop over the index (a float), at most SER_GPU_LOOP terms (each way for n ∈ ℤ), its
    // terms generated inside the loop; an infinite one stops when three terms in a row are below 1e-7 of the sum (factors
    // within 1e-7 of 1). NaN when an infinite one reaches the cap first, when a finite one has more terms than the cap,
    // and where the terms cancel by more than three digits.
    function loopGL(n, id) {
      const prod = n.op === 'prod';
      shape.push(prod ? 'Lp' : 'L');
      const lo = g(n.lo), hi = g(n.hi), cap = uBound(SER_GPU_LOOP);
      const S = `${id}_S`, M = `${id}_M`, OK = `${id}_ok`;
      out.push(`  vec2 ${S} = vec2(${prod ? '1.0' : '0.0'}, 0.0); float ${M} = 0.0; bool ${OK} = true;
  float ${id}_lo = ${lo}.x, ${id}_hi = ${hi}.x;`);
      // one loop body for every case (a constant-bound loop written out per case was four copies of the term code, which
      // D3D's FXC unrolls): nsd sides, each from its first index in its direction: n ∈ ℤ is 0, 1, 2, … then −1, −2, …
      // (both bounds infinite), an upper bound only runs down from it, else up from the lower one. Its bounds are
      // values, not constants, so the loops stay loops
      const k = `${id}_k`, saved = out, inner = [];
      out = inner;
      idxVar.push({ v: n.v, k });
      let t;
      try { t = g(n.a); } finally { idxVar.pop(); out = saved; }
      const LO = `${id}_lo`, HI = `${id}_hi`;
      // (at the cap: terms falling as k^{-p}, p > 1.5 from the largest of six terms at N/4, N/2 and N, as the CPU's window,
      // and the same over both halves, leave the rest t (k + ½) (k/(k + ½))^p/(p − 1), added when it is under a tenth of
      // the sum, as the CPU does: Expr's tailOf)
      out.push(`  int ${id}_nsd = ${LO} < -1e30 && ${HI} > 1e30 ? 2 : 1;
  for (int sd = 0; sd < ${id}_nsd; sd++) {
    float from = ${id}_nsd == 2 ? (sd == 0 ? 0.0 : -1.0) : ${LO} < -1e30 ? ${HI} : ${LO};
    float dir = ${id}_nsd == 2 ? (sd == 0 ? 1.0 : -1.0) : ${LO} < -1e30 ? -1.0 : 1.0;
    bool inf = dir > 0.0 ? ${HI} > 1e30 : ${LO} < -1e30;
    int run = 0; bool done = false; float mq = 0.0, kq = 0.0, mh = 0.0, kh = 0.0, dl = 0.0, kl = 0.0, dz = 0.0; vec2 tl = vec2(0.0);
    for (int j = 0; j < ${cap}; j++) {
      float ${k} = from + dir * float(j);
      if (dir > 0.0 ? ${k} > ${HI} : ${k} < ${LO}) { done = true; break; }
${inner.map((x) => '    ' + x).join('\n')}
      vec2 t = ${t};
      ${prod ? `${S} = cmul(${S}, t); vec2 u = t - vec2(1.0, 0.0); float d = cx_abs(u); if (${S} == vec2(0.0)) { done = true; break; }` : `${S} += t; ${M} += cx_abs(t); vec2 u = t; float d = cx_abs(t);`}
      if (j > ${SER_GPU_LOOP / 4 - 6} && j <= ${SER_GPU_LOOP / 4}) { mq = max(mq, d); kq = abs(${k}); }
      if (j > ${SER_GPU_LOOP / 2 - 6} && j <= ${SER_GPU_LOOP / 2}) { mh = max(mh, d); kh = abs(${k}); }
      if (j > ${SER_GPU_LOOP - 7}) dl = max(dl, d);
      tl = u; kl = abs(${k});
      // (a term exactly 0 right after terms that were not small is float32's overflow, 2^k past k = 127: NaN, not a sum)
      if (d == 0.0 && dz > 1e-7 * ${prod ? '1.0' : `cx_abs(${S})`}) { ${OK} = false; done = true; break; }
      if (d > 0.0) dz = d;
      if (inf && d <= 1e-7 * ${prod ? '1.0' : `cx_abs(${S})`}) { run++; if (run >= 3) { done = true; break; } } else run = 0;
    }
    if (!done && inf && dl > 0.0 && mh > dl && mq > mh && kl > kh && kh > kq && kq > 0.0) {
      float p = log(mh / dl) / log(kl / kh), p1 = log(mq / mh) / log(kh / kq);
      vec2 r = tl * ((kl + 0.5) * pow(kl / (kl + 0.5), p) / (p - 1.0));
      if (p > 1.5 && p <= 1.25 * p1 && cx_abs(r) <= 0.1 * ${prod ? '1.0' : `cx_abs(${S})`}) { ${S} = ${prod ? `cmul(${S}, cexp(r))` : `${S} + r`}; done = true; }
    }
    if (!done) ${OK} = false;
  }`);
      out.push(`  if (!${OK}${prod ? '' : ` || ${SER_CANCEL(M, S)}`}) ${S} = ${NAN};`);
      return S;
    }
    // [issue #6] a recurrence, as Expr's: N (a uniform, so dragging it never recompiles) steps of at most ITER_CAP, its
    // rule generated inside the loop; ∞ once |u| passes 1e18 (float32 squares it in cx_abs), NaN for a bad N. The loop's
    // bound is N itself, not a constant, so a compiler that unrolls constant loops (FXC behind ANGLE) cannot
    function genIter(n) {
      const id = `${P}_r${sums++}`, u = `${id}_u`, N = `${id}_n`;
      shape.push('I');
      const u0 = g(n.lo), nn = g(n.hi);
      const saved = out, inner = [];
      out = inner;
      idxVar.push({ v: n.v, k: u, cx: true });
      let t;
      try { t = g(n.a); } finally { idxVar.pop(); out = saved; }
      out.push(`  vec2 ${u} = ${u0}; float ${N} = ${nn}.x;
  if (!(${N} >= 0.0 && ${N} <= ${Expr.ITER_CAP}.0 && ${N} == floor(${N}))) ${u} = ${NAN};
  else for (int j = 0; j < int(${N}); j++) {
    float m = cx_abs(${u});
    if (!(m <= 1e18)) { ${u} = m > 1e18 ? vec2(cx_inf()) : ${NAN}; break; }
${inner.map((x) => '  ' + x).join('\n')}
    ${u} = ${t};
  }`);
      return u;
    }
    function genSum(n) {
      const id = `${P}_s${sums++}`;
      let plan = Expr.planOf(n);
      if (!plan && !idxVar.length) { try { Expr.compile(n); } catch (e) { /* summed as it is */ } plan = Expr.planOf(n); }
      // (a plan's terms never involve an outer index: inside another sum the loop is used)
      if (plan && !idxVar.length) return plan.kind === 'dirichlet' ? dirichletGL(n, plan, id) : powerGL(n, plan, id);
      return loopGL(n, id);
    }

    function g(n) {
      if (!dep(n)) {
        const cell = A.cell();
        writers.push((put, th) => putC(put, cell, constOf(n, th)));
        return cell.v;
      }
      switch (n.t) {
        case 'idx': {
          const e = [...idxVar].reverse().find((x) => x.v === n.v);
          if (!e) throw new Error(`GLChain: index ${n.v} outside its sum`);
          return e.cx ? e.k : `vec2(${e.k}, 0.0)`;
        }
        case 'iter': return genIter(n);
        case 'binom': { const a = g(n.a), b = g(n.b); return tv(`cx_binom(${a}, ${b})`); }
        case 'sum': return genSum(n);
        case 'var':
          switch (n.n) {
            case 'z': return 'z';
            case 'x': return 'vec2(z.x, 0.0)';
            case 'y': return 'vec2(z.y, 0.0)';
            case 'r': return 'vec2(cx_abs(z), 0.0)';
            case 'theta': return 'vec2(carg(z), 0.0)';
          }
          break;
        case 'neg': return tv(`-${g(n.a)}`);
        case 'add': { const a = g(n.a), b = g(n.b); return tv(`${a} + ${b}`); }
        case 'sub': { const a = g(n.a), b = g(n.b); return tv(`${a} - ${b}`); }
        case 'mul': { const a = g(n.a), b = g(n.b); return tv(`cmul(${a}, ${b})`); }
        case 'div': { const a = g(n.a), b = g(n.b); return tv(`cdiv(${a}, ${b})`); }
        case 'pow': {
          if (!dep(n.b) && baked && !hasParam(n.b)) {
            // a constant exponent without a shared number: its kind, and an integer's value, go into the program key
            // (baked; Expr.compile takes constants at their principal value whatever the cut), so only the branch of
            // cx_powk that it takes is compiled. Direct3D's FXC inlines all three branches at every call
            // site and unrolls cx_ipow32's 32 rounds: 0.5 to 1.4 s of compile per power (sound/impl/CUSTOM-PLAN.md P1).
            // (Measured on Iris Xe, D3D11, 16 call sites in one program: cx_powk 6.8 to 16 s, cx_ipow32 alone 0.15 to
            // 0.45 s, cpowr or cx_powg alone 0.6 to 2.2 s, so the cost is the three branches together. cx_ipow32 keeps
            // its constant-bound loop: the same rounds with the test at the end of the loop took 0.9 to 2.1 s.)
            const a = g(n.a);
            // (classified at cut 0, written at the step's cut th: the same value, a constant is principal whatever the cut)
            const v = constOf(n.b, 0);
            if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) {
              // cx_ipow32's rounds written out for this n: the same cmul calls in the same order, so the same values
              baked.push(['i', v.re]);
              if (v.re === 0) return 'vec2(1.0, 0.0)';   // (z^0 = 1 at ∞ and NaN too, as Expr.compile gives)
              let m = Math.abs(v.re), b = v.re < 0 ? tv(`cinv(${a})`) : a, r = 'vec2(1.0, 0.0)';
              for (;;) {
                if (m & 1) r = tv(`cmul(${r}, ${b})`);
                m >>= 1;
                if (m <= 0) return r;
                b = tv(`cmul(${b}, ${b})`);
              }
            }
            const cell = A.cell();
            if (v.im === 0) {
              baked.push(['r']);
              writers.push((put, th) => put(cell.c, constOf(n.b, th).re, 0));
              return tv(`cpowr(${a}, ${cell.x}, ${TH}, 0.0)`);
            }
            baked.push(['c']);
            writers.push((put, th) => putC(put, cell, constOf(n.b, th)));
            return tv(`cx_powg(${a}, ${cell.v}, ${TH}, 0.0)`);
          }
          if (!dep(n.b)) {
            const a = g(n.a);
            const s = A.slot();
            writers.push((put, th) => {
              const v = constOf(n.b, th);
              if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) { put(s.c, 0, v.re); put(s.c + 1, 0, 0); }
              else if (v.im === 0) { put(s.c, 1, v.re); put(s.c + 1, 0, 0); }
              else { put(s.c, 2, v.re); put(s.c + 1, v.im, 0); }
            });
            return tv(`cx_powk(${a}, ${s.v}, ${TH})`);
          }
          if (!dep(n.a)) {
            const b = g(n.b);
            const cell = A.cell();
            writers.push((put, th) => {
              const base = constOf(n.a, th);
              putC(put, cell, base.re === Math.E && base.im === 0 ? C(1, 0) : CX.log(base)); // principal, like Expr.compile
            });
            return tv(`cx_expmul(${b}, ${cell.v})`);
          }
          const a = g(n.a), b = g(n.b);
          return tv(`cpow(${a}, ${b}, ${TH}, 0.0)`);
        }
        case 'root': {
          const a = g(n.a);
          const cell = A.cell();
          writers.push((put, th) => putC(put, cell, CX.div(CX.ONE, constOf(n.n, th))));
          return tv(`cpow(${a}, ${cell.v}, ${TH}, 0.0)`);
        }
        case 'call': {
          let a = g(n.a);
          if (!/^[A-Za-z_]\w*$/.test(a)) a = tv(a); // swizzle a plain name
          if (n.f === 'log') return tv(`clog(${a}, ${TH}, 0.0)`);
          if (n.f === 'sqrt') return tv(`cpowr(${a}, 0.5, ${TH}, 0.0)`);
          if (UN[n.f]) return tv(`${UN[n.f]}(${a})`);
          if (RECIP[n.f]) return tv(`cinv(${RECIP[n.f]}(${a}))`);
          switch (n.f) {
            case 'abs': return tv(`vec2(cx_abs(${a}), 0.0)`);
            case 'conj': return tv(`vec2(${a}.x, -${a}.y)`);
            case 're': return tv(`vec2(${a}.x, 0.0)`);
            case 'im': return tv(`vec2(${a}.y, 0.0)`);
            case 'arg': return tv(`vec2(carg(${a}), 0.0)`);
          }
          throw new Error(`GLChain: unknown function ${n.f}`);
        }
      }
      throw new Error(`GLChain: cannot compile '${n.t}'`);
    }
    // [issue #395] a large log-pair formula: its ops in uniforms and one loop (ratLogList), not written out
    if (baked && ratLogOps(ast) >= RL_MIN) {
      shape.push('L');
      const { ops, consts, maxD } = ratLogList(ast);
      const k0 = ratLogCells(A, consts.length, (cell, i) => {
        const x = consts[i];
        if (x.pow != null) { baked.push(['i', x.pow]); writers.push((put) => put(cell.c, x.pow, 0)); }
        else writers.push((put, th) => putC(put, cell, constOf(x, th)));
      });
      const s0 = ratLogOpSlots(A, ops, writers, ast);
      const K = `${P}_k`, q = `${P}_q`;
      out.push(`  vec2 ${K}[${maxD}];
  int ${q} = 0;
${RL_HEAD(s0, ops.length, k0)}
    if (op == 0) { ${K}[${q}] = z; ${q}++; }
    else if (op == 1) { ${K}[${q}] = kv; ${q}++; }
    else if (op >= 2 && op <= 5) {
      vec2 b = ${K}[${q} - 1], a = ${K}[${q} - 2];
      ${q}--;
      ${K}[${q} - 1] = op == 2 ? a + b : op == 3 ? a - b : op == 4 ? cmul(a, b) : cdiv(a, b);
    } else {
      vec2 x = ${K}[${q} - 1];
      highp int e = int(kv.x);
      ${K}[${q} - 1] = op == 6 ? -x : op == 8 ? clog(x, ${TH}, 0.0)
        : op == 7 ? (e == 0 ? vec2(1.0, 0.0) : cx_ipow32(x, e < 0, e < 0 ? -e : e))
        : op == 9 ? x + kv : op == 10 ? x - kv : op == 11 ? cmul(x, kv) : op == 12 ? cdiv(x, kv)
        : op == 13 ? kv + x : op == 14 ? kv - x : op == 15 ? cmul(kv, x) : cdiv(kv, x);
    }
  }`);
      return tv(`${K}[0]`);
    }
    return g(ast);
  }


  // ---- [issue #4] Γ, ψ, ζ and ζ′ in float32, after CX.lgamma, CX.digamma, CX.zeta, CX.zetaDeriv: put in front of a
  // chain's (or a region formula's) source only when it calls them, so no other program compiles them (specialLib)
  const GAMMA_LIB = `
// sin(πz) and sin(πs/2) with the real part reduced by the period first (float32 keeps the phase)
vec2 cx_pimod(vec2 z) { return vec2(CX_PI * (z.x - 2.0 * floor(0.5 * z.x)), CX_PI * z.y); }
vec2 cx_halfpimod(vec2 s) { return vec2(CX_HALF_PI * (s.x - 4.0 * floor(0.25 * s.x)), CX_HALF_PI * s.y); }
// log sin w, some branch, without overflow for large |Im w|
vec2 cx_logsin(vec2 w) {
  if (abs(w.y) <= 10.0) return clog(csin(w), CX_PI, 0.0);
  float s = w.y > 0.0 ? 1.0 : -1.0;
  vec2 q = cexp(vec2(-2.0 * s * w.y, 2.0 * s * w.x));
  return vec2(s * w.y, -s * w.x) + clog(vec2(1.0, 0.0) - q, CX_PI, 0.0) + vec2(-0.6931471805599453, s * CX_HALF_PI);
}
// log Γ(z), Re z >= 1/2: Lanczos g = 5 (Godfrey's coefficients, accurate past float32)
vec2 cx_lgamma1(vec2 z) {
  vec2 t = z + vec2(5.5, 0.0);
  vec2 tmp = t - cmul(z + vec2(0.5, 0.0), clog(t, CX_PI, 0.0));
  vec2 ser = vec2(1.000000000190015, 0.0);
  ser += cdiv(vec2(76.18009172947146, 0.0), z + vec2(1.0, 0.0));
  ser += cdiv(vec2(-86.50532032941677, 0.0), z + vec2(2.0, 0.0));
  ser += cdiv(vec2(24.01409824083091, 0.0), z + vec2(3.0, 0.0));
  ser += cdiv(vec2(-1.231739572450155, 0.0), z + vec2(4.0, 0.0));
  ser += cdiv(vec2(0.001208650973866179, 0.0), z + vec2(5.0, 0.0));
  ser += cdiv(vec2(-0.000005395239384953, 0.0), z + vec2(6.0, 0.0));
  return clog(cdiv(ser * 2.5066282746310005, z), CX_PI, 0.0) - tmp;
}
// log Γ(z): the reflection log π − log sin(πz) − log Γ(1 − z) for Re z < 1/2; a pole: Re = +inf. (issue #72) One call
// of cx_lgamma1, its argument chosen first: FXC (Direct3D 11) inlines every call, and the Lanczos body was there twice
vec2 cx_lgamma(vec2 z) {
  bool refl = z.x < 0.5;
  if (refl && z.y == 0.0 && z.x == floor(z.x)) return vec2(cx_inf(), 0.0);
  vec2 L = cx_lgamma1(refl ? vec2(1.0, 0.0) - z : z);
  return refl ? vec2(1.1447298858494002, 0.0) - cx_logsin(cx_pimod(z)) - L : L;
}
// Γ(z): exp(log Γ); beyond float32 the point at infinity (cx_isinf)
vec2 cx_gamma(vec2 z) {
  if (!cfin(z)) return vec2(cx_nan());
  vec2 L = cx_lgamma(z);
  if (L.x > 88.7) return vec2(cx_inf());
  return cexp(L);
}
// ψ(z): the reflection ψ(1 − z) − π cot(πz), the recurrence up to |z| >= 10, the asymptotic series
vec2 cx_digamma(vec2 z) {
  if (!cfin(z)) return vec2(cx_nan());
  vec2 acc = vec2(0.0);
  if (z.x < 0.5) {
    if (z.y == 0.0 && z.x == floor(z.x)) return vec2(cx_inf());
    acc = -CX_PI * cinv(ctan(cx_pimod(z)));
    z = vec2(1.0, 0.0) - z;
  }
  for (int i = 0; i < max(12, uNoUnroll); i++) { if (cx_abs(z) >= 10.0) break; acc -= cinv(z); z += vec2(1.0, 0.0); }
  vec2 w2 = cinv(cmul(z, z));
  vec2 ser = cmul(w2, vec2(1.0 / 12.0, 0.0) + cmul(w2, vec2(-1.0 / 120.0, 0.0) + cmul(w2, vec2(1.0 / 252.0, 0.0) + cmul(w2, vec2(-1.0 / 240.0, 0.0)))));
  return acc + clog(z, CX_PI, 0.0) - 0.5 * cinv(z) - ser;
}
`;
  // ζ, ζ′ (they need Γ's part: log sin, Lanczos, ψ)
  const ZETA_LIB = `
// ζ on the GPU up to |Im s| = CX_ZETA_TMAX (beyond: NaN, a blank, never a wrong value; the CPU goes further)
const float CX_ZETA_TMAX = 120.0;
const float CX_EMC[6] = float[6](0.08333333333333333, -0.001388888888888889, 0.0000330687830687831, -8.267195767195768e-7, 2.08767569878681e-8, -5.284190138687493e-10);
// Euler–Maclaurin, N = |Im s| + 10, six Bernoulli terms; P_j N^{1-2j} kept as one factor Q (no overflow). Re s >= 0
vec2 cx_zetaEM(vec2 s) {
  if (s.x == 1.0 && s.y == 0.0) return vec2(cx_inf());
  int N = int(ceil(abs(s.y))) + 10;
  vec2 sum = vec2(0.0);
  for (int k = 1; k < max(200, uNoUnroll); k++) { if (k >= N) break; sum += cexp(-s * log(float(k))); }
  float fN = float(N), lnN = log(fN);
  vec2 Nms = cexp(-s * lnN);
  sum += 0.5 * Nms + cdiv(Nms * fN, s - vec2(1.0, 0.0));
  vec2 Q = s / fN, bt = CX_EMC[0] * Q;
  for (int j = 1; j < 6; j++) {
    Q = cmul(Q, cmul(s + vec2(float(2 * j - 1), 0.0), s + vec2(float(2 * j), 0.0))) / (fN * fN);
    bt += CX_EMC[j] * Q;
  }
  return sum + cmul(bt, Nms);
}
// ζ′ by the same sum differentiated term by term (Q as above, R = P′_j N^{1-2j})
vec2 cx_zetaEMd(vec2 s) {
  if (s.x == 1.0 && s.y == 0.0) return vec2(cx_inf());
  int N = int(ceil(abs(s.y))) + 10;
  vec2 sum = vec2(0.0);
  for (int k = 2; k < max(200, uNoUnroll); k++) { if (k >= N) break; float lk = log(float(k)); sum -= cexp(-s * lk) * lk; }
  float fN = float(N), lnN = log(fN);
  vec2 Nms = cexp(-s * lnN), r = cinv(s - vec2(1.0, 0.0));
  sum -= 0.5 * lnN * Nms + cmul(Nms * fN, r * lnN + cmul(r, r));
  vec2 Q = s / fN, R = vec2(1.0 / fN, 0.0), bt = CX_EMC[0] * (R - lnN * Q);
  for (int j = 1; j < 6; j++) {
    vec2 q = cmul(s + vec2(float(2 * j - 1), 0.0), s + vec2(float(2 * j), 0.0)), qd = 2.0 * s + vec2(float(4 * j - 1), 0.0);
    R = (cmul(R, q) + cmul(Q, qd)) / (fN * fN);
    Q = cmul(Q, q) / (fN * fN);
    bt += CX_EMC[j] * (R - lnN * Q);
  }
  return sum + cmul(bt, Nms);
}
// ζ(s): Euler–Maclaurin for Re s >= 0; the functional equation 2^s π^{s-1} sin(πs/2) Γ(1 − s) ζ(1 − s), in log form.
// (issue #72) cx_zetaEM, its 200-term loop and all, is called once (at s or at 1 − s)
vec2 cx_zeta(vec2 s) {
  if (!cfin(s) || abs(s.y) > CX_ZETA_TMAX) return vec2(cx_nan());
  bool fe = s.x < 0.0;
  if (fe && s.y == 0.0 && s.x == 2.0 * floor(0.5 * s.x)) return vec2(0.0);
  vec2 one = vec2(1.0, 0.0) - s;
  vec2 Z = cx_zetaEM(fe ? one : s);
  if (!fe) return Z;
  vec2 L = s * 0.6931471805599453 + (s - vec2(1.0, 0.0)) * 1.1447298858494002 + cx_logsin(cx_halfpimod(s)) + cx_lgamma1(one);
  if (L.x > 88.7) return vec2(cx_inf());
  return cmul(cexp(L), Z);
}
// ζ′(s): for Re s < 0, from ζ = χ ζ(1 − s): χ (L′ ζ(1 − s) − ζ′(1 − s)), near the real axis without the log form
vec2 cx_zetad(vec2 s) {
  if (!cfin(s) || abs(s.y) > CX_ZETA_TMAX) return vec2(cx_nan());
  // (issue #72: cx_zetaEMd and cx_lgamma1 called once each)
  vec2 one = vec2(1.0, 0.0) - s, z1d = cx_zetaEMd(s.x >= 0.0 ? s : one);
  if (s.x >= 0.0) return z1d;
  vec2 z1 = cx_zetaEM(one), lg1 = cx_lgamma1(one);
  vec2 base = vec2(0.6931471805599453 + 1.1447298858494002, 0.0) - cx_digamma(one);
  vec2 hs = cx_halfpimod(s);
  if (abs(s.y) < 1.0) {
    vec2 A = cexp(s * 0.6931471805599453 + (s - vec2(1.0, 0.0)) * 1.1447298858494002 + lg1);
    vec2 sn = csin(hs), cs = ccos(hs);
    return cmul(A, cmul(cmul(sn, base), z1) + CX_HALF_PI * cmul(cs, z1) - cmul(sn, z1d));
  }
  vec2 L = s * 0.6931471805599453 + (s - vec2(1.0, 0.0)) * 1.1447298858494002 + cx_logsin(hs) + lg1;
  if (L.x > 88.7) return vec2(cx_inf());
  vec2 Ld = base + CX_HALF_PI * cinv(ctan(hs));
  return cmul(cexp(L), cmul(Ld, z1) - z1d);
}
`;
  // [issue #5] the series' helpers: w^e for an integer e held as a float (binary powers, at most 31 squarings; |e| past
  // 2^31 only for |w| <= 1, where it is 0, or 1 on the circle)
  const IPOWI_LIB = `
vec2 cx_ipowi(vec2 w, float e) {
  if (e == 0.0) return vec2(1.0, 0.0);
  if (e == 1.0) return w;
  float n = abs(e);
  vec2 r = vec2(1.0, 0.0), b = w;
  if (n > 2147483647.0) { float a = cx_abs(w); r = a < 1.0 ? vec2(0.0) : a == 1.0 ? vec2(1.0, 0.0) : vec2(cx_inf()); return r; }
  for (int i = 0; i < max(31, uNoUnroll); i++) {
    if (mod(n, 2.0) == 1.0) r = cmul(r, b);
    n = floor(0.5 * n);
    if (n == 0.0) break;
    b = cmul(b, b);
  }
  return e < 0.0 ? cinv(r) : r;
}
`;
  // n! and the binomial coefficient (they need Γ's part)
  const FACT_LIB = `
vec2 cx_fact(vec2 z) { return cx_gamma(z + vec2(1.0, 0.0)); }
// (issue #72: the three log Γ through one call site)
vec2 cx_binom(vec2 a, vec2 b) {
  vec2 acc = vec2(0.0);
  for (int i = 0; i < max(3, uNoUnroll); i++) {
    vec2 L = cx_lgamma((i == 0 ? a : i == 1 ? b : a - b) + vec2(1.0, 0.0));
    acc = i == 0 ? L : acc - L;
    if (i == 2) break;
  }
  return cexp(acc);
}
`;
  // (issue #72) the parts a source calls and those they need, in order: Γ no longer brings ζ
  // along, nor w^e (a series) Γ and ζ
  const specialLib = (src) => {
    const zeta = /\bcx_zetad?\(/.test(src), fact = /\bcx_(fact|binom)\(/.test(src);
    const gamma = zeta || fact || /\bcx_(gamma|lgamma|digamma)\(/.test(src);
    return (gamma ? GAMMA_LIB : '') + (zeta ? ZETA_LIB : '') + (/\bcx_ipowi\(/.test(src) ? IPOWI_LIB : '') + (fact ? FACT_LIB : '');
  };
  const withSpecial = (src) => specialLib(src) + src;

  // ---- natural paths (Funcs: ZOOM, joukHom, ratPath, genericZoomNat): h bodies in z and t, mirroring the CPU ----
  // nat: the built step's descriptor {kind, fn | n | dp, dq}; returns {h, write(put, b)} or null (no GPU path: the
  // straight line). Data that depend on the parameters (zeros, the zoom centre) are uniforms, filled from b.natData;
  // a flag cell .x = 0 (no data: a constant, a zero leading coefficient) falls back to the straight line, like the CPU.
  const ASH1 = Math.log(1 + Math.SQRT2), SQ2 = Math.SQRT2;
  const ZOOM_GL = {
    sin: 'return cx_sinS(z * t) / t;', sinh: 'return cx_sinhS(z * t) / t;', tan: 'return cx_tanS(z * t) / t;', tanh: 'return cx_tanhS(z * t) / t;',
    arcsin: 'return cx_asinS(z * t) / t;', arsinh: 'return cx_asinhS(z * t) / t;', arctan: 'return cx_atanS(z * t) / t;', artanh: 'return cx_atanhS(z * t) / t;',
    cos: 'return vec2((1.0 - t) * CX_HALF_PI, 0.0) + cmul(vec2(cos(CX_PI * t), sin(CX_PI * t)), cx_sinS((z - vec2(CX_HALF_PI, 0.0)) * t) / t);',
    arccos: 'return vec2(t * CX_HALF_PI, 0.0) + cmul(vec2(cos(CX_PI * t), sin(CX_PI * t)), cx_asinS(z * t) / t);',
  };
  const NAT_NMAX = 24; // the zoom path's shifted-form coefficients as uniforms up to this degree (Funcs.ZP_MAX)
  function natPlan(P, nat, A, extra = {}) {
    if (!nat) return null;
    const T0 = 'if (t <= 0.0) return z;\n  ';
    switch (nat.kind) {
      case 'zoom': {
        if (ZOOM_GL[nat.fn]) return { h: T0 + ZOOM_GL[nat.fn], write() {} };
        if (nat.fn === 'cosh') {
          return {
            h: `${T0}const float P = ${flt(ASH1)}, Q = ${flt(SQ2)};
  vec2 h = (z - vec2(P, 0.0)) * (0.5 * t);
  return cmul(csinh(vec2(P, 0.0) + h), cx_sinhS(h)) * (2.0 / t) + vec2((1.0 - t) * P + t * Q, 0.0);`,
            write() {},
          };
        }
        if (nat.fn === 'arcosh') {
          return {
            h: `${T0}const float P = ${flt(ASH1)}, Q = ${flt(SQ2)};
  vec2 d = (z - vec2(Q, 0.0)) * t, x = vec2(Q, 0.0) + d;
  vec2 s = cmul(csqrtp(x - vec2(1.0, 0.0)), csqrtp(x + vec2(1.0, 0.0)));
  vec2 den = s + vec2(1.0, 0.0);
  vec2 v = cx_abs(den) > 1e-3 ? cmul(d, vec2(1.0, 0.0) + cdiv(x + vec2(Q, 0.0), den)) * (1.0 / (1.0 + Q)) : (x + s) * (1.0 / (1.0 + Q)) - vec2(1.0, 0.0);
  return cx_log1p(v) / t + vec2((1.0 - t) * Q + t * P, 0.0);`,
            write() {},
          };
        }
        return null;
      }
      case 'jouk': {
        // inside the unit disk the branch arg Cz in (pi/2, 3pi/2): tanh((1 + t) artanh z - i pi t/2) (Funcs joukHom);
        // c J (nat.scaled): times c^t, lc = log c a uniform
        const J = 'vec2 J = dot(z, z) < 1.0 ? cx_tanhS(cx_atanhS(z) * (1.0 + t) - vec2(0.0, CX_HALF_PI * t)) : cinv(cx_tanhS(cx_atanhS(cinv(z)) * (1.0 + t)));';
        if (!nat.scaled) return { h: `${T0}${J}\n  return J;`, write() {} };
        const lc = A.cell();
        return { h: `${T0}${J}\n  return cmul(cexp(${lc.v} * t), J);`, write(put, b) { const d = Funcs.natData(b); putC(put, lc, d && d.lc ? d.lc : C(0, 0)); } };
      }
      // the Moebius one-parameter group (degree 1, however entered): the path slots of the affine and Moebius steps
      case 'mob': {
        const path = pathSlots(A);
        return { h: pathHom(P, path), own1: true, write(put, b) { const d = Funcs.natData(b); path.write(put, d && d.m ? mobPathData(d.m) : null); } };
      }
      // a (z - c)^n: (1 - t) c + a^t (z - c)^{1+(n-1)t}, principal (Funcs powPath)
      case 'pow': {
        const c = A.cell(), la = A.cell(), n = A.cell();
        return {
          h: `${T0}return ${c.v} * (1.0 - t) + cmul(cexp(${la.v} * t), cpowr(z - ${c.v}, 1.0 + (${n.x} - 1.0) * t, CX_PI, 0.0));`,
          // (the same path on the local cut opposite its input at the cell centre zc, sheet 0: chainSheetHom)
          hc: `${T0}return ${c.v} * (1.0 - t) + cmul(cexp(${la.v} * t), cpowr(z - ${c.v}, 1.0 + (${n.x} - 1.0) * t, carg(zc - ${c.v}) + CX_PI, 0.0));`,
          write(put, b) { const d = Funcs.natData(b); putC(put, c, d ? d.c : C(0, 0)); putC(put, la, d ? d.la : C(0, 0)); put(n.c, d ? d.n : 1, 0); },
        };
      }
      // any other analytic formula: f inlined at p + t(z - p) (Funcs genericZoomNat); below t0 (>= 1e-3) the blend
      // z + (t/t0)(H_t0(z) - z), as the CPU
      case 'gzoom': {
        const p = A.cell(), fp = A.cell(), ll = A.cell(), g = A.cell();
        // (issue #355: one call of f, at the point below t0 too and at t = 1, where the path is f(z) itself: FXC
        // inlines every call, and a formula's f can be tens of KB; the values are the former ones, H(max(t, t0)))
        return {
          own1: true, h: `${T0}float t0 = ${g.x}, tt = t == 1.0 ? 1.0 : max(t, t0);\n  vec2 fa = ${P}_f(t == 1.0 ? z : ${p.v} + (z - ${p.v}) * tt);\n  if (t == 1.0) return fa;\n  vec2 h = ${p.v} * (1.0 - tt) + ${fp.v} * tt + cmul(cexp(${ll.v} * (tt - 1.0)), fa - ${fp.v}) / tt;\n  return t < t0 ? z + (h - z) * (t / t0) : h;`,
          write(put, b) { const d = Funcs.natData(b); for (const [cell, k] of [[p, 'p'], [fp, 'fp'], [ll, 'll']]) putC(put, cell, d ? d[k] : C(0, 0)); put(g.c, d && d.t0 ? d.t0 : 1e-3, 0); },
        };
      }
      case 'ijouk': {
        const sg = extra.sg;
        return { h: `${T0}return cinv(cx_tanhS(cx_atanhS(cinv(z)) * (1.0 - 0.5 * t) - vec2(0.0, ${sg.x} < 0.0 ? CX_HALF_PI * t : 0.0)));`, write() {} };
      }
      case 'exp': return { h: 'if (t < 1e-6) return z;\n  return cx_expm1(z * t) * (1.0 / t) + vec2(t, 0.0);', write() {} };
      case 'log': {
        const c = extra.cut;
        return {
          h: `if (t <= 0.0) return z;
  float u = 1.0 - t;
  if (u < 1e-6) return clog(z, ${c}, 0.0);
  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);
  return cx_expm1(clog(z, ${c}, 0.0) * u) * (1.0 / u) + vec2(u, 0.0);`,
          write() {},
        };
      }
      case 'ratzoom': {
        const M = Math.max(nat.dp, nat.dq), dp = nat.dp, dq = nat.dq;
        // flag.x: data present, flag.y: rN (the shifted form's radius); q0 = Q(p)
        const flag = A.cell(), p = A.cell(), fp = A.cell(), ll = A.cell(), q0 = A.cell();
        // P and Q: the step's own coefficient cells when it has them with these very values (extra.shared: the poly
        // step, Q = 1; a rational step with a non-constant denominator), so the path adds no uniforms per coefficient,
        // and the far form is P_f itself; otherwise cells of its own (the zeros-and-poles step, a custom formula)
        const sh = extra.shared || null;
        const Pc = sh ? sh.P : Array.from({ length: dp + 1 }, () => A.cell());
        const Qc = sh ? sh.Q : Array.from({ length: dq + 1 }, () => A.cell());
        // Near p: up to degree NAT_NMAX the Taylor coefficients N of the shifted form (exact to float32 rounding,
        // computed once in double); above it, so that a polynomial of a thousand terms needs no second thousand
        // uniforms, the same quantity as divided differences, u N(e) = u (q0 P[p,x] − p0 Q[p,x]) / n1 with
        // P[p,x] = (P(x) − P(p))/(x − p) by synthetic division (no cancellation at x = p either); kn = q0/n1, p0 = P(p)
        // (0 at an exact zero), the remainder of the division dropped as the CPU drops it
        const useN = M <= NAT_NMAX;
        const Nc = useN ? Array.from({ length: M }, () => A.cell()) : [];
        const kn = useN ? null : A.cell(), p0 = useN || !Qc ? null : A.cell();
        const horner = (cs, nm, at) => `vec2 ${nm} = vec2(0.0);\n` + cs.map((c) => `  ${nm} = cmul(${nm}, ${at}) + ${c.v};`).join('\n');
        // the quotient of the polynomial with coefficients cs (highest first) by (x - p), at x: a loop over the
        // uniform array when the cells are consecutive (the step's own coefficients), else unrolled
        const quot = (cs, nm) => {
          const n = cs.length - 1;
          if (n < 1) return `vec2 ${nm} = vec2(0.0);`;
          const c0 = cs[0].c;
          if (cs.every((c, i) => c.c === c0 + i) && n > 8) {
            return `vec2 ${nm} = vec2(0.0), ${nm}b = vec2(0.0);
  for (int k = 0; k < ${n}; k++) {
    int ci = ${c0} + k;
    vec4 s = uChain[ci >> 1];
    ${nm}b = cmul(${nm}b, ${p.v}) + ((ci & 1) == 0 ? s.xy : s.zw);
    ${nm} = cmul(${nm}, x) + ${nm}b;
  }`;
          }
          return `vec2 ${nm} = vec2(0.0), ${nm}b = vec2(0.0);\n` + cs.slice(0, n).map((c) => `  ${nm}b = cmul(${nm}b, ${p.v}) + ${c.v}; ${nm} = cmul(${nm}, x) + ${nm}b;`).join('\n');
        };
        const near = useN
          ? `${horner(Nc, 'n', 'e')}
    return c + cmul(cexp(${ll.v} * t), cdiv(cmul(cmul(u, n), ${q0.v}), q));`
          : `${quot(Pc, 'dP')}
    ${Qc ? `${quot(Qc, 'dQ')}\n    vec2 dd = cmul(${q0.v}, dP) - cmul(${p0.v}, dQ);` : 'vec2 dd = dP;'}
    return c + cmul(cexp(${ll.v} * t), cdiv(cmul(cmul(u, dd), ${kn.v}), q));`;
        const far = sh ? `${P}_f(x)` : Qc ? 'cdiv(pp, q)' : 'pp';
        const h = `${T0}if (${flag.x} < 0.5) { ${LIN(P)} }
  vec2 u = z - ${p.v}, e = u * t, x = ${p.v} + e;
  vec2 c = ${p.v} * (1.0 - t) + ${fp.v} * t;
  ${Qc ? horner(Qc, 'q', 'x') : 'vec2 q = vec2(1.0, 0.0);'}
  if (cx_abs(e) < ${flag.y}) {
    ${near}
  }
  ${sh ? '' : horner(Pc, 'pp', 'x')}
  return c + cmul(cexp(${ll.v} * (t - 1.0)), ${far} - ${fp.v}) / t;`;
        return {
          h,
          write(put, b) {
            const d = Funcs.natData(b);
            const ok = !!d && d.N && d.N.length === M && d.P.length === dp + 1 && d.Q.length === dq + 1;
            put(flag.c, ok ? 1 : 0, ok ? Math.min(d.rN, 3e38) : 0);
            for (const [c, v] of [[p, ok ? d.p : C(0, 0)], [fp, ok ? d.fp : C(0, 0)], [ll, ok ? d.ll : C(0, 0)], [q0, ok ? d.q0 : C(0, 0)]]) putC(put, c, v);
            Nc.forEach((c, k) => putC(put, c, ok ? d.N[k] : C(0, 0)));
            if (kn) putC(put, kn, ok ? CX.div(d.q0, d.n1) : C(0, 0));
            if (p0) putC(put, p0, ok ? d.p0 : C(0, 0));
            if (sh) return; // the step writes its coefficients itself
            Pc.forEach((c, k) => putC(put, c, ok ? d.P[k] : C(0, 0)));
            if (Qc) Qc.forEach((c, k) => putC(put, c, ok ? d.Q[k] : C(0, 0)));
          },
        };
      }
    }
    return null;
  }

  // ---- per-step code generation ----
  // Returns {sig, f, h, write(put)}: f is the body of vec2 P_f(vec2 z), h of vec2 P_h(vec2 z, float t).
  function stepPlan(P, b, A) {
    const v = b.vals;
    const type = b.def.id;
    const trig = { sin: 'csin', cos: 'ccos', tan: 'ctan', sinh: 'csinh', cosh: 'ccosh', tanh: 'ctanh', arcsin: 'casin', arccos: 'cacos', arctan: 'catan', arsinh: 'casinh', arcosh: 'cacosh', artanh: 'catanh' };
    if (trig[type]) {
      const np = natPlan(P, b.nat, A);
      return { sig: [type], f: `return ${trig[type]}(z);`, h: np ? np.h : LIN(P), own1: !!(np && np.own1), write() {} };
    }
    switch (type) {
      case 'mul': {
        const c = A.cell(), path = pathSlots(A);
        return {
          sig: [type], f: `return cmul(${c.v}, z);`, h: pathHom(P, path), own1: true,
          write(put) { putC(put, c, v.c); path.write(put, CX.isZero(v.c) ? null : mobPathData([v.c, C(0, 0), C(0, 0), C(1, 0)])); },
        };
      }
      case 'add': {
        const c = A.cell();
        return { sig: [type], f: `return z + ${c.v};`, h: `return z + ${c.v} * t;`, write(put) { putC(put, c, v.c); } };
      }
      case 'affine': {
        const a = A.cell(), bb = A.cell(), path = pathSlots(A);
        return {
          sig: [type], f: `return cmul(${a.v}, z) + ${bb.v};`, h: pathHom(P, path), own1: true,
          write(put) { putC(put, a, v.a); putC(put, bb, v.b); path.write(put, CX.isZero(v.a) ? null : mobPathData([v.a, v.b, C(0, 0), C(1, 0)])); },
        };
      }
      case 'recip': {
        const path = pathSlots(A);
        return { sig: [type], f: 'return cinv(z);', h: pathHom(P, path), own1: true, write(put) { path.write(put, mobPathData([C(0, 0), C(1, 0), C(1, 0), C(0, 0)])); } };
      }
      case 'mobius': case 'blaschke': {
        let m;
        if (type === 'mobius') m = [v.a, v.b, v.c, v.d];
        else {
          const e = C(Math.cos(v.phi * DEG), Math.sin(v.phi * DEG));
          m = [e, CX.neg(CX.mul(e, v.a)), CX.neg(CX.conj(v.a)), C(1, 0)];
        }
        // the map is invariant under scaling; a power of two (exact) brings entries beyond float32 range back.
        // The path gets the unscaled matrix, like CX.mobPath (which scales it the same way itself).
        let ms = m;
        const mx = Math.max(...m.map((x) => Math.max(Math.abs(x.re), Math.abs(x.im))));
        if (mx > 0 && Number.isFinite(mx)) {
          const s = 2 ** -Math.round(Math.log2(mx));
          if (s !== 1 && s > 0 && Number.isFinite(s)) ms = m.map((x) => CX.scale(x, s));
        }
        const s0 = A.slot(), s1 = A.slot(), s2 = A.slot(), s3 = A.slot(), path = pathSlots(A);
        return {
          sig: [type], f: `return cx_mobstep(z, ${s0.v}, ${s1.v}, ${s2.v}, ${s3.v});`, h: pathHom(P, path), own1: true,
          write(put) {
            for (let i = 0; i < 4; i++) put(s0.c + i, ms[i].re, ms[i].im);
            const sd = mobStepData(ms);
            put(s2.c, sd.mode, 0); put(s2.c + 1, sd.k.re, sd.k.im);
            put(s3.c, sd.alpha.re, sd.alpha.im); put(s3.c + 1, sd.beta.re, sd.beta.im);
            path.write(put, mobPathData(m));
          },
        };
      }
      case 'pown': {
        // q = (n, n < 0, hi, lo): n as a float for the homotopy exponent, and the exact int32 bits of
        // ToInt32(|n|) as two 16-bit halves (Funcs.build keeps |n| <= 4096, so that is just |n|, as in CX.ipow)
        const q = A.slot(), path = pathSlots(A);
        const m = `highp uint mh = uint(${q.v}.z), ml = uint(${q.v}.w);\n  highp int m = int((mh << 16u) | ml);`;
        // (one call each of cpowr, cx_ipow32 and the path, so FXC, which inlines every call, writes each once)
        const ph = (cut) => `float n = ${q.v}.x;
  if (n >= 0.0 || t < 0.5) return cpowr(z, n >= 0.0 ? 1.0 + (n - 1.0) * t : 1.0 + (-n - 1.0) * (2.0 * t), ${cut}, 0.0);
  ${m}
  // inversion path applied to z^|n|; for |z| > 1 via u = (1/z)^|n|, since z^|n| itself may overflow float32
  bool inv = dot(z, z) > 1.0;
  return ${path.callu('cx_ipow32(z, inv, m)', '2.0 * t - 1.0', 'inv')};`;
        return {
          sig: [type], f: `if (${q.v}.x == 0.0) return vec2(1.0, 0.0);\n  ${m}\n  return cx_ipow32(z, ${q.v}.y > 0.5, m);`,
          h: ph('CX_PI'),
          // (the path z^(1 + (n - 1)t) has a cut for 0 < t < 1: in chainSheetHom it runs on the local cut opposite its
          // input at the cell centre zc, sheet 0, so the landscape's edge pass finds that cut by continuation)
          hc: ph('carg(zc) + CX_PI'),
          write(put) {
            const u = (Math.abs(v.n) | 0) >>> 0; // ToUint32(ToInt32(|n|))
            put(q.c, v.n, v.n < 0 ? 1 : 0); put(q.c + 1, u >>> 16, u & 0xffff);
            path.write(put, mobPathData([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]));
          },
        };
      }
      case 'root': {
        const cut = A.cell(), al = A.cell();
        return {
          sig: [type], f: `return cpowr(z, ${al.x}, ${cut.x}, ${cut.y});`,
          h: `return cpowr(z, 1.0 + (${al.x} - 1.0) * t, ${cut.x}, ${cut.y});`,
          write(put) {
            const n = Math.max(2, v.n);
            put(cut.c, v.cut * DEG, ((v.k % n) + n) % n);
            put(al.c, 1 / n, 0);
          },
        };
      }
      case 'powa': {
        const cut = A.cell(), al = A.cell();
        return {
          sig: [type], f: `return cpow(z, ${al.v}, ${cut.x}, ${cut.y});`,
          h: `return cpow(z, vec2(1.0 + (${al.x} - 1.0) * t, ${al.y} * t), ${cut.x}, ${cut.y});`,
          write(put) { put(cut.c, v.cut * DEG, v.k); putC(put, al, v.alpha); },
        };
      }
      case 'exp':
        return {
          sig: [type], f: 'return cexp(z);',
          h: 'if (t < 1e-6) return z;\n  return cx_expm1(z * t) * (1.0 / t) + vec2(t, 0.0);', write() {},
        };
      case 'log': {
        const cut = A.cell();
        return {
          sig: [type], f: `return clog(z, ${cut.x}, ${cut.y});`,
          h: `if (t <= 0.0) return z;
  float u = 1.0 - t;
  if (u < 1e-6) return clog(z, ${cut.x}, ${cut.y});
  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);
  return cx_expm1(clog(z, ${cut.x}, ${cut.y}) * u) * (1.0 / u) + vec2(u, 0.0);`,
          write(put) { put(cut.c, v.cut * DEG, v.k); },
        };
      }
      case 'joukowski': {
        const np = natPlan(P, b.nat, A);
        return { sig: [type], f: 'return (z + cinv(z)) * 0.5;', h: np ? np.h : LIN(P), own1: !!(np && np.own1), write() {} };
      }
      case 'ijouk': {
        const sg = A.cell();
        // interior branch z - s equals 1/(z + s) since (z - s)(z + s) = 1; the latter avoids cancellation
        return {
          sig: [type],
          f: `vec2 e = z + cmul(csqrtp(z - vec2(1.0, 0.0)), csqrtp(z + vec2(1.0, 0.0)));\n  return ${sg.x} > 0.0 ? e : cinv(e);`,
          h: (natPlan(P, b.nat, A, { sg }) || { h: LIN(P) }).h, write(put) { put(sg.c, v.branch === 'interior' ? -1 : 1, 0); },
        };
      }
      case 'conj':
        return { sig: [type], f: 'return vec2(z.x, -z.y);', h: 'return vec2(z.x, z.y * (1.0 - 2.0 * t));', write() {} };
      // [issue #4] Γ deforms along the generic zoom path (its data are uniforms), ζ along the straight line
      case 'gamma': {
        const np = natPlan(P, b.nat, A);
        return { sig: [type, b.nat ? b.nat.kind : 'lin'], f: 'return cx_gamma(z);', h: np ? np.h : LIN(P), own1: !!(np && np.own1), write(put) { if (np) np.write(put, b); } };
      }
      case 'zeta':
        return { sig: [type], f: 'return cx_zeta(z);', h: LIN(P), write() {} };
      // [issue #260] Φ_M(z) = φ_z(z) and φ_c(z) as CX.bottcher: the orbit to |w| > 10⁴ kept in an array (N ≤ 64, a
      // uniform; neither loop unrolls, issue #72), then back by the square root nearest each orbit point. float32 holds
      // w² to 10⁸ and c/w² without overflow. φ_c is NaN where |φ_c| ≤ e^{G_c(0)}, a uniform. (The escape test on |w|²
      // and the roots by length(), whose argument stays below 10⁸ here, not by cx_abs and csqrtp: 1.7 times faster on
      // SwiftShader; the root keeps csqrtp's form, with no cancellation)
      case 'dh': case 'bottcher': {
        const nn = A.cell(), jc = type === 'bottcher' ? A.cell() : null;
        const NM = Funcs.DH_NMAX;
        return {
          sig: [type],
          f: `vec2 orb[${NM + 1}];
  vec2 c = ${jc ? jc.v : 'z'}, w = z;
  int n = -1;
  for (int k = 0; k < max(${NM + 1}, uNoUnroll); k++) {
    orb[k] = w;
    if (dot(w, w) > 1e8) { n = k; break; }
    if (float(k) >= ${nn.x}) break;
    w = cmul(w, w) + c;
  }
  if (n < 0) return vec2(cx_nan());
  vec2 p = cmul(w, csqrtp(vec2(1.0, 0.0) + cdiv(cdiv(c, w), w)));
  for (int j = 1; j < max(${NM + 1}, uNoUnroll); j++) {
    if (j > n) break;
    float m = length(p), t = sqrt(0.5 * (m + abs(p.x)));
    vec2 r = p.x >= 0.0 ? vec2(t, p.y / (2.0 * t)) : vec2(abs(p.y) / (2.0 * t), p.y >= 0.0 ? t : -t), o = orb[n - j];
    p = dot(r, o) >= 0.0 ? r : -r;
  }
  ${jc ? `if (!(cx_abs(p) > ${nn.y})) return vec2(cx_nan());\n  ` : ''}return p;`,
          h: LIN(P),
          write(put) { put(nn.c, v.N, jc ? b.dh.rho : 0); if (jc) putC(put, jc, v.c); },
        };
      }
      case 'poly': case 'rational': {
        const lists = type === 'poly' ? [CX.polyTrim(v.co)] : [CX.polyTrim(v.p), CX.polyTrim(v.q)];
        const cells = lists.map((co) => co.map(() => A.cell()));
        const horner = (cs, nm) => `vec2 ${nm} = vec2(0.0);\n` + cs.map((c) => `  ${nm} = cmul(${nm}, z) + ${c.v};`).join('\n');
        const f = type === 'poly' ? `${horner(cells[0], 'p')}\n  return p;` : `${horner(cells[0], 'p')}\n  ${horner(cells[1], 'q')}\n  return cdiv(p, q);`;
        // the zoom path reads P and Q from these cells when they hold exactly its P and Q (a constant denominator
        // divides the numerator there, so a rational step with one keeps cells of its own)
        const shared = type === 'poly' ? { P: cells[0], Q: null } : lists[1].length > 1 ? { P: cells[0], Q: cells[1] } : null;
        const np = natPlan(P, b.nat, A, { shared });
        return {
          sig: [type, ...lists.map((l) => l.length), b.nat ? b.nat.kind : 'lin'], f, h: np ? np.h : LIN(P), own1: !!(np && np.own1), hc: np && np.hc,
          write(put) { lists.forEach((co, j) => co.forEach((c, i) => putC(put, cells[j][i], c))); if (np) np.write(put, b); },
        };
      }
      case 'zp': {
        // a ∏ (z − ζ_k)/(z − p_k) × the unpaired factors, as Funcs evaluates it (no overflow of either product alone);
        // the values are uniforms, so dragging a zero or a pole never recompiles (the counts are the signature)
        const zp = b.zp, nz = zp.zeros.length, np = zp.poles.length, deg = Math.max(nz, np);
        const a = A.cell(), zc = zp.zeros.map(() => A.cell()), pc = zp.poles.map(() => A.cell());
        let f = `if (${a.v} == vec2(0.0)) return vec2(0.0);\n  `; // a = 0: the constant 0, the poles too (removable)
        for (const c of pc) f += `if (z == ${c.v}) return vec2(cx_inf());\n  `;
        f += `vec2 w = ${a.v};\n`;
        for (let i = 0; i < deg; i++) {
          if (i < nz && i < np) f += `  w = cmul(w, cdiv(z - ${zc[i].v}, z - ${pc[i].v}));\n`;
          else if (i < nz) f += `  w = cmul(w, z - ${zc[i].v});\n`;
          else f += `  w = cdiv(w, z - ${pc[i].v});\n`;
        }
        f += '  return w;';
        const np2 = natPlan(P, b.nat, A);
        return {
          sig: [type, nz, np, b.nat ? b.nat.kind : 'lin'], f, h: np2 ? np2.h : LIN(P), own1: !!(np2 && np2.own1), hc: np2 && np2.hc,
          write(put) {
            putC(put, a, zp.a);
            zc.forEach((c, i) => putC(put, c, zp.zeros[i]));
            pc.forEach((c, i) => putC(put, c, zp.poles[i]));
            if (np2) np2.write(put, b);
          },
        };
      }
      case 'series':
      case 'recurrence':
      case 'custom': {
        if (b.rec) return b.repeat ? repPlan(P, b, A) : recPlan(P, b, A);
        const ast = b.ast || Expr.parse(v.expr);
        const cut = A.cell();
        const TH = cut.x;
        const writers = [], lines = [], shape = [];
        const baked = [];
        const res = genCustom(ast, P, A, TH, writers, lines, baked, shape);
        const np = natPlan(P, b.nat, A, { cut: TH });
        return {
          sig: [type, astSig(ast), b.nat ? JSON.stringify(b.nat) : 'lin', baked, pairBaked(ast), ...(shape.length ? [shape.join()] : [])], f: `${lines.join('\n').trimStart()}\n  return ${res};`, h: np ? np.h : LIN(P), own1: !!(np && np.own1), hc: np && np.hc,
          write(put) { const th = v.cut * DEG; put(cut.c, th, 0); for (const w of writers) w(put, th); if (np) np.write(put, b); },
        };
      }
    }
    return null;
  }

  // The program key of a formula: its tree without positions or spelling (z^{i} and z^i, \\frac12 and 1/2 are one key),
  // a shared number by its name, and no number's value: every number is a uniform (genCustom, genCustomPair and
  // derivPlan write constants at fill time), so changing one does not compile again. What the code is built from
  // goes in beside it: the exponents genCustom bakes in (its baked list), those the sheet code bakes in (pairBaked),
  // and d/dz's own source (build).
  function astSig(n) {
    return JSON.stringify(n, (k, x) => (k === 'pos' || k === 'len' || k === 'lit' || k === 's' || k === 'name' ? undefined
      : x && typeof x === 'object' && x.t === 'num' ? (x.param != null ? ['#', x.param] : '#')
        // ([issue #6] a recurrence's constant N is a uniform: a new N is the same program)
        : x && typeof x === 'object' && x.t === 'iter' && !Expr.depends(x.hi) ? Object.assign({}, x, { hi: '#N' }) : x));
  }
  // What the sheet code (genCustomPair) builds from the values of constant exponents without a shared number, in tree
  // order: Funcs.branchNode null (an integer, |n| <= 4096) writes the integer into cipow; any other exponent is a
  // branch node, 'n', whose value and sheet count are uniforms. An exponent with a shared number is always a branch
  // node there (paramPow), whatever its value, so the code does not depend on it and a slider never compiles again
  function pairBaked(ast) {
    const out = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (!n.t) return;
      for (const k of Object.keys(n)) if (n[k] && typeof n[k] === 'object') walk(n[k]);
      if (n.t === 'pow' && Expr.depends(n) && !Expr.depends(n.b) && !hasParam(n.b)) {
        const bn = Funcs.branchNode ? Funcs.branchNode(n) : null;
        out.push(bn ? 'n' : Expr.compile(n.b)(C(0, 0)).re);
      }
    };
    walk(ast);
    return out;
  }
  // A formula recognized as catalog steps (Funcs: b.rec): each step's own plan, as functions of their own (P r j), and
  // the step as their composition; its homotopy runs the steps' own homotopies in turn, step j on [j/n, (j+1)/n]
  // (Funcs' asChain). The key holds the steps' keys only (the sheet view runs the steps too, sheetPlan; d/dz has its
  // own key part), never the spelling: z^{i} and z^i are one program, and a shared number never recompiles it.
  function recPlan(P, b, A) {
    const subs = b.rec.built.map((sb, j) => {
      const Q = `${P}r${j}`;
      const pl = stepPlan(Q, sb, A);
      if (!pl) throw new Error('GLChain: no plan for a recognized step');
      return { Q, pl };
    });
    const n = subs.length;
    let pre = '';
    for (const { Q, pl } of subs) {
      if (pl.pre) pre += pl.pre;
      pre += `vec2 ${Q}_f(vec2 z) {\n  ${pl.f}\n}\n`;
      const h = withOne(Q, pl);
      pre += `vec2 ${Q}_h(vec2 z, float t) {\n  ${h}\n}\n`;
    }
    const f = subs.map(({ Q }) => `z = ${Q}_f(z);`).join('\n  ') + '\n  return z;';
    let h = 'if (t <= 0.0) return z;\n  ';
    if (n === 1) h += `return ${subs[0].Q}_h(z, t);`;
    else {
      h += `float s = t * ${n}.0;\n  `;
      // (issue #355: a sub-step whose path is its map at 1 goes through the path at min(s - j, 1), so its map is
      // written once in the path, not again for the later sub-steps: the same values)
      subs.forEach(({ Q, pl }, j) => { h += j === n - 1 ? `return ${Q}_h(z, s - ${j}.0);` : exactAt1(pl) ? `z = ${Q}_h(z, min(s - ${j}.0, 1.0));\n  if (s < ${j + 1}.0) return z;\n  ` : `if (s < ${j + 1}.0) return ${Q}_h(z, s - ${j}.0);\n  z = ${Q}_f(z);\n  `; });
    }
    // (own1 below: every sub-step's path is its map at 1, so is this one, and the shortcut that would write every map
    // again is left out)
    // (the landscape's cut kinds, GLChain cutKinds: a sub-step with such a cut, in its map or its path; a sub-step's
    // path with a principal cut of its own (hc) runs inside the formula's path, which has no local-cut form)
    const ck = subs.map(({ Q, pl }) => cutKindOf(Q, pl));
    return {
      sig: ['custom', 'rec', subs.map(({ pl }) => pl.sig)], pre, f, h, own1: subs.every(({ pl }) => exactAt1(pl)),
      cutF: ck.some((c) => c.fo), cutH: ck.some((c) => c.ho) || subs.some(({ pl }) => !!pl.hc),
      write(put) { for (const { pl } of subs) pl.write(put); },
    };
  }
  // [issue #6] Repeat × N (Funcs.repeatBuilt: b.rec runs the block's last step, then the block N − 1 times): the block's
  // steps once each, as functions of their own (P r j), and a loop whose trip count N − 1 is a uniform, so a new N (a
  // typed N, a shared number's slider) is the same program. The path runs the 1 + (N − 1) len steps in turn, each on
  // an equal part of t, as the CPU's does
  function repPlan(P, b, A) {
    const rp = b.repeat, block = rp.block;
    const subs = block.map((sb, j) => {
      const Q = `${P}r${j}`;
      const pl = stepPlan(Q, sb, A);
      if (!pl) throw new Error('GLChain: no plan for a repeated step');
      return { Q, pl };
    });
    const len = subs.length, last = subs[len - 1].Q, nc = A.cell();
    let pre = '';
    for (const { Q, pl } of subs) {
      if (pl.pre) pre += pl.pre;
      pre += `vec2 ${Q}_f(vec2 z) {\n  ${pl.f}\n}\n`;
      const h = withOne(Q, pl);
      pre += `vec2 ${Q}_h(vec2 z, float t) {\n  ${h}\n}\n`;
    }
    const passes = `int(${nc.x})`;
    const f = `z = ${last}_f(z);\n  for (int k = 0; k < ${passes}; k++) {\n    ${subs.map(({ Q }) => `z = ${Q}_f(z);`).join('\n    ')}\n  }\n  return z;`;
    const h = `if (t <= 0.0) return z;\n  if (t >= 1.0) return ${P}_f(z);\n  float s = t * (1.0 + ${nc.x} * ${len}.0);\n  if (s < 1.0) return ${last}_h(z, s);\n  z = ${last}_f(z); s -= 1.0;\n`
      + `  for (int k = 0; k < ${passes}; k++) {\n${subs.map(({ Q }) => `    if (s < 1.0) return ${Q}_h(z, s);\n    z = ${Q}_f(z); s -= 1.0;`).join('\n')}\n  }\n  return z;`;
    const ck = subs.map(({ Q, pl }) => cutKindOf(Q, pl));
    return {
      sig: ['custom', 'repeat', subs.map(({ pl }) => pl.sig)], pre, f, h,
      cutF: ck.some((c) => c.fo), cutH: ck.some((c) => c.ho) || subs.some(({ pl }) => !!pl.hc),
      write(put) { put(nc.c, rp.n - 1, 0); for (const { pl } of subs) pl.write(put); },
    };
  }
  // A step's cuts that the sheets cannot continue (inverse trig functions, the Joukowski branches, arg in a formula):
  // fo in its map, ho in its path at 0 < t < 1 (a path through the map itself inherits the map's)
  const NONSHEET_CUT = /\b(?:casin|cacos|catan|casinh|cacosh|catanh|csqrtp|cx_atanhS|cx_asinS|cx_atanS|cx_asinhS)\s*\(|vec2\(carg\(/;
  function cutKindOf(P, plan) {
    const fo = plan.cutF !== undefined ? plan.cutF : NONSHEET_CUT.test((plan.pre || '') + plan.f);
    const ho = plan.cutH !== undefined ? plan.cutH : NONSHEET_CUT.test(plan.h) || (plan.h.includes(`${P}_f(`) && fo);
    return { fo, ho };
  }

  // ---- d/dz: derivative of one step (for the exact chain rule) ----
  // {f: body of vec2 P_df(vec2 z), write} from Funcs.derivAst (exact numbers, the step's cut), or null
  function derivPlan(P, b, A) {
    if (typeof Funcs.derivAst !== 'function') return null;
    const d = Funcs.derivAst(b, { stable: true });
    if (!d || d.error) return null;
    const cut = A.cell();
    const writers = [], lines = [];
    const res = genCustom(d.ast, `${P}_d`, A, cut.x, writers, lines);
    return {
      f: `${lines.join('\n').trimStart()}\n  return ${res};`,
      write(put) { const th = d.cut * DEG; put(cut.c, th, 0); for (const w of writers) w(put, th); },
    };
  }

  // ---- whole Riemann surfaces (chainSheet): pair evaluation (cell centre zc, point z) with local cuts ----
  // Mirrors Funcs.sheetEval: every multivalued piece takes the cut opposite its input at zc and the sheet read from
  // the digits of combo (cxs0_dig). Sheet counts (radices) are uniforms, so no parameter value is baked in.
  // Custom formulas: vec4 P_s(vec4 p, inout highp int c), node by node as Funcs' pairCompile (children first).
  function genCustomPair(ast, P, A, writers, lines, theta = Math.PI) {
    let tmp = 0;
    const dep = Expr.depends;
    const rads = [];
    const constOf = (n) => Expr.compile(n)(C(0, 0));
    const pair = (ec, ew) => { const nm = `${P}_${tmp++}`; lines.push(`  vec2 ${nm}c = ${ec};`, `  vec2 ${nm}w = ${ew};`); return [`${nm}c`, `${nm}w`]; };
    const both = (fn, a) => pair(fn(a[0]), fn(a[1]));
    const UN = {
      sin: 'csin', cos: 'ccos', tan: 'ctan', sinh: 'csinh', cosh: 'ccosh', tanh: 'ctanh',
      asin: 'casin', acos: 'cacos', atan: 'catan', asinh: 'casinh', acosh: 'cacosh', atanh: 'catanh', exp: 'cexp',
      gamma: 'cx_gamma', zeta: 'cx_zeta', digamma: 'cx_digamma', zetad: 'cx_zetad',
    };
    const RECIP = { cot: 'ctan', sec: 'ccos', csc: 'csin', coth: 'ctanh' };
    // (an exponent with a shared number, z^{a}: a branch node whatever a is, its value and sheet count read when the
    // uniforms are filled; an integer a is one sheet, a digit of radix 1 that takes nothing from c, and cpow on any
    // sheet is z^a. So the code, and the key (astSig, pairBaked), do not depend on a. The price: an integer a goes
    // through cpow (exp and log, about 1e-4 relative at large |z|) where a typed integer takes cipow, in the sheet view only)
    const paramPow = (b) => {
      const vOf = () => constOf(b), intOf = (v) => v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096;
      return { kind: 'powc', get v() { return vOf(); }, get n() { const v = vOf(); return intOf(v) ? 1 : Funcs.sheetCount(v); } };
    };
    // a branch node: its sheet (one digit of c) and its local cut (opposite its input at the centre)
    // (v16.1 review math-3: the sheet numbered from the formula's own cut theta, Funcs' sheetOff: rc.y = theta)
    function node(bn, inC) {
      const rc = A.cell(), i = rads.length;
      rads.push(rc);
      writers.push((put) => put(rc.c, bn.n, theta));
      lines.push(`  float ${P}_s${i} = cxs0_dig(${rc.x}, c) + floor((${rc.y} - carg(${inC})) / (2.0 * CX_PI));`, `  float ${P}_t${i} = carg(${inC}) + CX_PI;`);
      return [`${P}_t${i}`, `${P}_s${i}`];
    }
    function g(n) {
      if (!dep(n)) {
        const cell = A.cell();
        writers.push((put) => putC(put, cell, constOf(n)));
        return [cell.v, cell.v];
      }
      switch (n.t) {
        case 'var':
          switch (n.n) {
            case 'z': return ['zc', 'zw'];
            case 'x': return both((a) => `vec2(${a}.x, 0.0)`, ['zc', 'zw']);
            case 'y': return both((a) => `vec2(${a}.y, 0.0)`, ['zc', 'zw']);
            case 'r': return both((a) => `vec2(cx_abs(${a}), 0.0)`, ['zc', 'zw']);
            case 'theta': return both((a) => `vec2(carg(${a}), 0.0)`, ['zc', 'zw']);
          }
          break;
        case 'neg': return both((a) => `-${a}`, g(n.a));
        case 'add': case 'sub': case 'mul': case 'div': {
          const a = g(n.a), b = g(n.b);
          const op = { add: (x, y) => `${x} + ${y}`, sub: (x, y) => `${x} - ${y}`, mul: (x, y) => `cmul(${x}, ${y})`, div: (x, y) => `cdiv(${x}, ${y})` }[n.t];
          return pair(op(a[0], b[0]), op(a[1], b[1]));
        }
        case 'pow': {
          const bn = !dep(n.b) && hasParam(n.b) ? paramPow(n.b) : Funcs.branchNode(n);
          if (!dep(n.b)) {
            const a = g(n.a);
            if (!bn) { const k = constOf(n.b).re; return both((x) => `cipow(${x}, ${k})`, a); }
            const v = A.cell();
            writers.push((put) => putC(put, v, bn.v));
            const [th, s] = node(bn, a[0]);
            return both((x) => `cpow(${x}, ${v.v}, ${th}, ${s})`, a);
          }
          if (!dep(n.a)) {
            const b = g(n.b);
            const cell = A.cell();
            writers.push((put) => { const base = constOf(n.a); putC(put, cell, base.re === Math.E && base.im === 0 ? C(1, 0) : CX.log(base)); });
            return both((x) => `cx_expmul(${x}, ${cell.v})`, b);
          }
          const a = g(n.a), b = g(n.b);
          const [th, s] = node(bn, a[0]);
          return pair(`cpow(${a[0]}, ${b[0]}, ${th}, ${s})`, `cpow(${a[1]}, ${b[1]}, ${th}, ${s})`);
        }
        case 'root': {
          const a = g(n.a), bn = Funcs.branchNode(n);
          const v = A.cell();
          writers.push((put) => putC(put, v, bn.s));
          const [th, s] = node(bn, a[0]);
          return both((x) => `cpow(${x}, ${v.v}, ${th}, ${s})`, a);
        }
        case 'call': {
          let a = g(n.a);
          if (n.f === 'log' || n.f === 'sqrt') {
            const [th, s] = node(Funcs.branchNode(n), a[0]);
            return both((x) => (n.f === 'log' ? `clog(${x}, ${th}, ${s})` : `cpowr(${x}, 0.5, ${th}, ${s})`), a);
          }
          if (!/^[A-Za-z_]\w*$/.test(a[0])) a = pair(a[0], a[1]);
          if (UN[n.f]) return both((x) => `${UN[n.f]}(${x})`, a);
          if (RECIP[n.f]) return both((x) => `cinv(${RECIP[n.f]}(${x}))`, a);
          switch (n.f) {
            case 'abs': return both((x) => `vec2(cx_abs(${x}), 0.0)`, a);
            case 'conj': return both((x) => `vec2(${x}.x, -${x}.y)`, a);
            case 're': return both((x) => `vec2(${x}.x, 0.0)`, a);
            case 'im': return both((x) => `vec2(${x}.y, 0.0)`, a);
            case 'arg': return both((x) => `vec2(carg(${x}), 0.0)`, a);
          }
          throw new Error(`GLChain: unknown function ${n.f}`);
        }
      }
      throw new Error(`GLChain: cannot compile '${n.t}'`);
    }
    // [issue #395] a large log-pair formula: its ops in uniforms and one loop on (zc, zw) pairs (ratLogList); each log
    // node's sheet digit and local cut as node() writes them, in the same order
    if (ratLogOps(ast) >= RL_MIN) {
      const { ops, consts, logs, maxD } = ratLogList(ast);
      const k0 = ratLogCells(A, consts.length, (cell, i) => {
        const x = consts[i];
        writers.push((put) => (x.pow != null ? put(cell.c, x.pow, 0) : putC(put, cell, constOf(x))));
      });
      // (each log node's cell as node() writes it: its sheet count and the formula's cut, in tree order)
      const r0 = ratLogCells(A, logs.length, (cell, i) => { const bn = Funcs.branchNode(logs[i]); rads.push(cell); writers.push((put) => put(cell.c, bn.n, theta)); });
      const s0 = ratLogOpSlots(A, ops, writers, ast);
      const K = `${P}_k`, q = `${P}_q`;
      lines.push(`  vec4 ${K}[${maxD}];
  int ${q} = 0;
  highp int lc = ${r0};
${RL_HEAD(s0, ops.length, k0)}
    if (op == 0) { ${K}[${q}] = vec4(zc, zw); ${q}++; }
    else if (op == 1) { ${K}[${q}] = vec4(kv, kv); ${q}++; }
    else if (op >= 2 && op <= 5) {
      vec4 b = ${K}[${q} - 1], a = ${K}[${q} - 2];
      ${q}--;
      ${K}[${q} - 1] = op == 2 ? vec4(a.xy + b.xy, a.zw + b.zw) : op == 3 ? vec4(a.xy - b.xy, a.zw - b.zw)
        : op == 4 ? vec4(cmul(a.xy, b.xy), cmul(a.zw, b.zw)) : vec4(cdiv(a.xy, b.xy), cdiv(a.zw, b.zw));
    } else if (op == 8) {
      vec4 x = ${K}[${q} - 1];
      vec2 rc = ${RL_CELL('lc')};
      lc++;
      float s = cxs0_dig(rc.x, c) + floor((rc.y - carg(x.xy)) / (2.0 * CX_PI)), t = carg(x.xy) + CX_PI;
      ${K}[${q} - 1] = vec4(clog(x.xy, t, s), clog(x.zw, t, s));
    } else {
      vec4 x = ${K}[${q} - 1];
      highp int e = int(kv.x);
      ${K}[${q} - 1] = op == 6 ? -x : op == 7 ? vec4(cipow(x.xy, e), cipow(x.zw, e))
        : op == 9 ? vec4(x.xy + kv, x.zw + kv) : op == 10 ? vec4(x.xy - kv, x.zw - kv)
        : op == 11 ? vec4(cmul(x.xy, kv), cmul(x.zw, kv)) : op == 12 ? vec4(cdiv(x.xy, kv), cdiv(x.zw, kv))
        : op == 13 ? vec4(kv + x.xy, kv + x.zw) : op == 14 ? vec4(kv - x.xy, kv - x.zw)
        : op == 15 ? vec4(cmul(kv, x.xy), cmul(kv, x.zw)) : vec4(cdiv(kv, x.xy), cdiv(kv, x.zw));
    }
  }`);
      return { res: pair(`${K}[0].xy`, `${K}[0].zw`), rads, block: { c0: r0, n: logs.length } };
    }
    const res = g(ast);
    return { res, rads };
  }
  // the statements that read a sheet plan's digits without acting (a step not applied yet): its own skip() (a block of
  // consecutive radix cells read in one loop, issue #395), or one cxs0_dig per radix
  const skipOf = (sp) => (sp.skip ? sp.skip() : sp.rads.map((r) => `cxs0_dig(${r}, c);`).join(' '));
  // Sheet plan of one step: null (single-valued: both points through P_f), or {rads: [radix cell .x], apply: GLSL
  // statements updating vec4 p (digits already read into P_sh0..), fn: extra functions, write}
  function sheetPlan(P, b, A) {
    const v = b.vals, type = b.def.id;
    if (type === 'root' || type === 'powa' || type === 'log') {
      const rc = A.cell(), al = type === 'log' ? null : A.cell();
      const n = Math.max(2, v.n);
      const f = type === 'root' ? (x) => `cpowr(${x}, ${al.x}, th, s)` : type === 'powa' ? (x) => `cpow(${x}, ${al.v}, th, s)` : (x) => `clog(${x}, th, s)`;
      // the step's path at 0 < t < 1 on the same sheet and local cut (the deformation's sheets, Funcs' homPair): z^e
      // with e = 1 + (alpha - 1)t, log through cxs0_lh (P_h of the step, on (th, s))
      const g = type === 'root' ? (x) => `cpowr(${x}, e, th, s)` : type === 'powa' ? (x) => `cpow(${x}, e, th, s)` : (x) => `cxs0_lh(${x}, th, s, u)`;
      const ge = type === 'root' ? (t) => `float e = 1.0 + (${al.x} - 1.0) * ${t};` : type === 'powa' ? (t) => `vec2 e = vec2(1.0 + (${al.x} - 1.0) * ${t}, ${al.y} * ${t});` : (t) => `float u = 1.0 - ${t};`;
      // (v16.1 review math-3) the sheet numbered from the step's own cut and branch (Funcs' sheetOff): rc.y = its cut
      // + 2 pi k, the digit shifted by floor((rc.y - arg c0) / 2 pi), c0 the input at the cell centre (0 by default)
      const kk = type === 'root' ? (((v.k | 0) % n) + n) % n : v.k | 0, Th = (v.cut ?? 180) * Math.PI / 180 + 2 * Math.PI * kk;
      const sOf = (s0) => `${s0} + floor((${rc.y} - carg(p.xy)) / (2.0 * CX_PI))`;
      return {
        rads: [rc.x],
        apply: (s) => `{ float s = ${sOf(s[0])}; float th = carg(p.xy) + CX_PI; p = vec4(${f('p.xy')}, ${f('p.zw')}); }`,
        homApply: (s, t) => `{ float s = ${sOf(s[0])}; float th = carg(p.xy) + CX_PI; ${ge(t)} p = vec4(${g('p.xy')}, ${g('p.zw')}); }`,
        fn: '',
        write(put) {
          if (type === 'root') { put(rc.c, n <= Funcs.SHEET_MAX ? n : 0, Th); put(al.c, 1 / n, 0); }
          else if (type === 'powa') { put(rc.c, Funcs.sheetCount(v.alpha), Th); putC(put, al, v.alpha); }
          else put(rc.c, 0, Th);
        },
      };
    }
    if (type !== 'custom') return null;
    // a recognized formula: its steps' pieces in turn (as Funcs.sheetEval), a single-valued step through its own Q_f
    if (b.rec) {
      const subs = b.rec.built.map((sb, j) => ({ Q: `${P}r${j}`, sp: sheetPlan(`${P}r${j}`, sb, A) }));
      if (!subs.some((x) => x.sp)) return null;
      let fn = '', hfn = '', body = '', hbody = '';
      const rads = [];
      const n = subs.length;
      // the path at 0 < t < 1 (the deformation's sheets): its steps' paths in turn, step q on [q/n, (q+1)/n] (recPlan,
      // Funcs' homPair): the steps before in full, step q at x - q, the steps after it only read their digits
      subs.forEach(({ Q, sp }, q) => {
        if (!sp) {
          body += `  p = vec4(${Q}_f(p.xy), ${Q}_f(p.zw));\n`;
          hbody += `  if (j > ${q}) p = vec4(${Q}_f(p.xy), ${Q}_f(p.zw));\n  else if (j == ${q} && x > ${q}.0) p = vec4(${Q}_h(p.xy, x - ${q}.0), ${Q}_h(p.zw, x - ${q}.0));\n`;
          return;
        }
        fn += sp.fn;
        hfn += sp.hfn || '';
        rads.push(...sp.rads);
        body += sp.custom ? `  ${sp.apply()}\n` : `  { float s0 = cxs0_dig(${sp.rads[0]}, c); ${sp.apply(['s0'])} }\n`;
        if (sp.custom) {
          const hom = sp.homCall ? sp.homCall(`x - ${q}.0`) : 'p = vec4(cx_nan());';
          hbody += `  if (j > ${q}) ${sp.apply()}\n  else if (j == ${q} && x > ${q}.0) ${hom}\n  else { ${skipOf(sp)} }\n`;
        } else {
          hbody += `  { float s0 = cxs0_dig(${sp.rads[0]}, c);\n    if (j > ${q}) ${sp.apply(['s0'])}\n    else if (j == ${q} && x > ${q}.0) ${sp.homApply(['s0'], `(x - ${q}.0)`)}\n  }\n`;
        }
      });
      return {
        rads, custom: true, apply: () => `p = ${P}_s(p, c);`,
        skip: () => subs.filter((x) => x.sp).map((x) => skipOf(x.sp)).join(' '),
        homCall: (t) => `p = ${P}_sh(p, c, ${t});`,
        fn: `${fn}vec4 ${P}_s(vec4 p, inout highp int c) {\n${body}  return p;\n}\n`,
        // (the path's function goes with chainSheetHom, into the sheet programs only: GLChain's sheetHom)
        hfn: `${hfn}vec4 ${P}_sh(vec4 p, inout highp int c, float t) {\n  float x = t * ${n}.0;\n  int j = min(${n - 1}, int(floor(x)));\n${hbody}  return p;\n}\n`,
        write(put) { for (const { sp } of subs) if (sp) sp.write(put); },
      };
    }
    const ast = b.ast || Expr.parse(v.expr);
    // no branch node: single-valued, both points go through P_f (and no uniforms are spent on a pair version)
    // (an exponent with a shared number is a node whatever its value: genCustomPair's paramPow)
    const hasNode = (n) => !!n && typeof n === 'object' && !!n.t && (!!Funcs.branchNode(n) || (n.t === 'pow' && Expr.depends(n) && !Expr.depends(n.b) && hasParam(n.b)) || ['a', 'b'].some((k) => hasNode(n[k])));
    if (!hasNode(ast)) return null;
    const writers = [], lines = [];
    const { res, rads, block } = genCustomPair(ast, `${P}_p`, A, writers, lines, (v.cut ?? 180) * Math.PI / 180);
    if (!rads.length) return null;
    return {
      rads: rads.map((r) => r.x),
      custom: true,
      ...(block ? { skip: () => `for (int i = 0; i < max(${block.n}, uNoUnroll); i++) { highp int ri = ${block.c0} + i; cxs0_dig(${RL_CELL('ri')}.x, c); }` } : {}),
      apply: () => `p = ${P}_s(p, c);`,
      fn: `vec4 ${P}_s(vec4 p, inout highp int c) {\n  vec2 zc = p.xy, zw = p.zw;\n${lines.join('\n')}\n  return vec4(${res[0]}, ${res[1]});\n}\n`,
      write(put) { for (const w of writers) w(put); },
    };
  }

  // circle formula radius on the GPU for nesting level L (float32: rounding eps |G| / r, so larger than the CPU's)
  const GPU_REL = (L) => 1e-2 * Math.pow(3, Math.max(0, L - 1));
  const flt = (x) => { const s = String(Math.fround(x)); return /[.eE]/.test(s) ? s.replace(/e\+?/, 'e') : s + '.0'; };

  function build(steps, built) {
    const A = makeAlloc();
    const sigs = [], plans = [];
    steps.forEach((st, k) => {
      const b = built[k];
      const P = `cxs${k + 1}`;
      let plan = null;
      if (!st || st.on === false) sigs.push('off');
      else if (!b || b.error || !b.def) sigs.push('err');
      else if (b.op === 'deriv') { plan = { deriv: true }; sigs.push('deriv'); }
      else {
        try { plan = stepPlan(P, b, A); } catch (e) { plan = null; }
        sigs.push(plan ? plan.sig : 'unsupported');
      }
      plans.push(plan ? { P, k: k + 1, plan } : null);
    });
    const live = plans.filter(Boolean);
    const maps = live.filter((x) => !x.plan.deriv);
    const dks = live.filter((x) => x.plan.deriv).map((x) => x.k);

    // the exact chain rule for the first d/dz: a derivative plan for every map before it
    let exact = false;
    const dpl = [];
    if (dks.length) {
      exact = true;
      for (const x of maps) {
        if (x.k > dks[0]) break;
        let dp = null;
        try { dp = derivPlan(x.P, built[x.k - 1], A); } catch (e) { dp = null; }
        if (!dp) { exact = false; break; }
        dpl.push({ x, dp });
      }
      if (!exact) dpl.length = 0;
      for (const { x, dp } of dpl) sigs[x.k - 1] = [sigs[x.k - 1], 'd', dp.f];
      sigs[dks[0] - 1] = ['deriv', exact ? 'x' : 'c'];
    }
    // circle levels: the first d/dz 0 (exact) or 1, every later one one more
    const lev = new Map();
    dks.forEach((k, i) => lev.set(k, i === 0 ? (exact ? 0 : 1) : lev.get(dks[i - 1]) + 1));
    // sheet plans (multivalued maps); the sheet view's d/dz steps are all circle formulas, levels 1, 2, ...
    const spl = new Map();
    for (const x of maps) {
      let sp = null;
      try { sp = sheetPlan(x.P, built[x.k - 1], A); } catch (e) { sp = null; }
      if (sp) spl.set(x.k, sp);
    }

    const slots = A.slots;
    let src = `uniform vec4 uChain[${slots}];\nuniform highp int uSheetW;\n`;
    for (const { P, plan } of maps) {
      if (plan.pre) src += plan.pre;
      src += `vec2 ${P}_f(vec2 z) {\n  ${plan.f}\n}\n`;
      // at t = 1 every homotopy equals the map itself (exactly so on the CPU up to float64 rounding)
      const h = withOne(P, plan);
      src += `vec2 ${P}_h(vec2 z, float t) {\n  ${h}\n}\n`;
    }
    // a d/dz step is not a map of w: chainStep and chainHom give NaN there (callers mix chainStage(k - 1) and
    // chainStage(k) instead)
    src += 'vec2 chainStep(int i, vec2 z) {\n';
    for (const { P, k } of maps) src += `  if (i == ${k}) return ${P}_f(z);\n`;
    for (const k of dks) src += `  if (i == ${k}) return vec2(cx_nan());\n`;
    src += '  return z;\n}\n';
    src += 'vec2 chainHom(int i, vec2 z, float t) {\n';
    for (const { P, k } of maps) src += `  if (i == ${k}) return ${P}_h(z, t);\n`;
    for (const k of dks) src += `  if (i == ${k}) return vec2(cx_nan());\n`;
    src += '  return z;\n}\n';
    // (issue #72) chainAt(k, z, t, how): step k skipped (how 0), in full (1) or along its path at t (2), every step's
    // map and path written once. The map modes 1-3 (gl.js MAP) walk the chain in one loop through it: ANGLE's
    // Direct3D 11 back end hands the code to FXC, which inlines every call, so chainRange, chainHom and postOf each
    // carried a copy of every step (6 to 8, and more, per deformation program). A path with the t = 1 shortcut is
    // the map at t = 1 (exactly), so in full it is the path at 1 and the map is not written again; a straight-line
    // path (no shortcut: z (1 - t) + f(z) t is not f(z) where z is infinite) calls the map itself.
    src += 'vec2 chainAt(int k, vec2 z, float t, int how) {\n  if (how == 0) return z;\n';
    for (const { P, k, plan } of maps) {
      src += plan.h.startsWith('if (t == 0.0)') ? `  if (k == ${k}) return how == 1 ? ${P}_f(z) : ${P}_h(z, t);\n`
        : `  if (k == ${k}) return ${P}_h(z, how == 1 ? 1.0 : t);\n`;
    }
    for (const k of dks) src += `  if (k == ${k}) return vec2(cx_nan());\n`;
    src += '  return z;\n}\n';
    // all at once (mode 3): every step's homotopy at the same t, H_t = h_{b,t} o ... o h_{a+1,t}, through chainHom (so
    // the step functions are not inlined a second time; a d/dz gives NaN there, an off or failed step the identity)
    src += `vec2 chainHomAll(vec2 z, int a, int b, float t) {\n  for (int k = 1; k <= ${Math.max(1, steps.length)}; k++) {\n    if (k > b) break;\n    if (k > a) z = chainHom(k, z, t);\n  }\n  return z;\n}\n`;
    src += `bool chainIsDeriv(int k) {\n  return ${dks.length ? dks.map((k) => `k == ${k}`).join(' || ') : 'false'};\n}\n`;
    // the maps in (a, b] applied to a point (no d/dz inside)
    const raw = dks.length ? 'cxs0_raw' : 'chainRange';
    src += `vec2 ${raw}(vec2 z, int a, int b) {\n`;
    for (const { P, k } of maps) src += `  if (a < ${k} && b >= ${k}) z = ${P}_f(z);\n`;
    src += '  return z;\n}\n';
    const u8 = 'vec2 cxs0_u8(int j) {\n  const float h = 0.7071067811865476;\n'
      + '  if (j == 0) return vec2(1.0, 0.0);\n  if (j == 1) return vec2(h, h);\n  if (j == 2) return vec2(0.0, 1.0);\n  if (j == 3) return vec2(-h, h);\n'
      + '  if (j == 4) return vec2(-1.0, 0.0);\n  if (j == 5) return vec2(-h, -h);\n  if (j == 6) return vec2(0.0, -1.0);\n  return vec2(h, -h);\n}\n';
    if (!dks.length) src += 'vec2 chainStage(int k, vec2 z) {\n  return chainRange(z, 0, k);\n}\n';
    else {
      for (const { x, dp } of dpl) src += `vec2 ${x.P}_df(vec2 z) {\n  ${dp.f}\n}\n`;
      src += u8;
      // G_d for every d/dz step d: the exact chain rule, or (1/8r) sum G_{d-1}(z + r u_j) conj(u_j)
      dks.forEach((d, i) => {
        const p = i ? dks[i - 1] : 0;
        src += `vec2 cxs0_g${d}(vec2 z) {\n`;
        if (lev.get(d) === 0) {
          src += '  vec2 D = vec2(1.0, 0.0);\n';
          for (const { x } of dpl) src += `  D = cmul(D, ${x.P}_df(z)); z = ${x.P}_f(z);\n`;
          src += '  return D;\n}\n';
        } else {
          const inner = (e) => (p ? `cxs0_g${p}(${e})` : e);
          src += `  float r = ${flt(GPU_REL(lev.get(d)))} * (1.0 + cx_abs(z));\n  vec2 acc = vec2(0.0);\n`
            + '  for (int j = 0; j < 8; j++) {\n    vec2 u = cxs0_u8(j);\n'
            + `    vec2 g = cxs0_raw(${inner('z + r * u')}, ${p}, ${d - 1});\n`
            + '    acc += cmul(g, vec2(u.x, -u.y));\n  }\n  return acc / (8.0 * r);\n}\n';
        }
      });
      // G_k: the last d/dz at or before k, then the maps after it
      src += 'vec2 chainStage(int k, vec2 z) {\n  int base = 0;\n';
      [...dks].reverse().forEach((d, i) => { src += `  ${i ? 'else ' : ''}if (k >= ${d}) { z = cxs0_g${d}(z); base = ${d}; }\n`; });
      src += '  return cxs0_raw(z, base, k);\n}\n';
      // a range that starts at a stage point a > 0 cannot cross a d/dz (its input is a function of z, not a point)
      src += 'vec2 chainRange(vec2 z, int a, int b) {\n  if (a <= 0) return chainStage(b, z);\n'
        + `  if (${dks.map((d) => `(a < ${d} && b >= ${d})`).join(' || ')}) return vec2(cx_nan());\n  return cxs0_raw(z, a, b);\n}\n`;
    }
    // chainSheet(zc, z, b, combo): G_b(z) on surface `combo` of the cell centred at zc (see Funcs.sheetEval)
    // chainSheetRange(zc, z, a, b, combo): the steps in (a, b] from points of the w_a-plane, digits for their pieces only
    if (!dks.length && !spl.size) {
      src += 'vec2 chainSheet(vec2 zc, vec2 z, int b, int combo) {\n  return chainRange(z, 0, b);\n}\n';
      src += 'vec2 chainSheetRange(vec2 zc, vec2 z, int a, int b, int combo) {\n  return chainRange(z, a, b);\n}\n';
    }
    else {
      src += 'int cxs0_rad(float n) { return n > 0.5 ? int(n + 0.5) : 2 * uSheetW + 1; }\n'
        + '// the next sheet number from the mixed-radix digits of c (lowest first)\n'
        + 'float cxs0_dig(float n, inout highp int c) {\n  highp int r = max(cxs0_rad(n), 1);\n  highp int q = c / r;\n  highp int d = c - q * r;\n'
        + '  c = q;\n  return n > 0.5 ? float(d) : float(d - uSheetW);\n}\n';
      for (const sp of spl.values()) src += sp.fn;
      // steps in (a, b] applied to the pair p; the digits of c are read for the pieces in (d0, b] (d0 = 0 or a)
      src += 'vec4 cxs0_sraw(vec4 p, int a, int b, highp int c, int d0) {\n';
      for (const { P, k } of maps) {
        const sp = spl.get(k);
        if (!sp) { src += `  if (a < ${k} && b >= ${k}) p = vec4(${P}_f(p.xy), ${P}_f(p.zw));\n`; continue; }
        if (sp.custom) {
          src += `  if (b >= ${k} && d0 < ${k}) {\n    if (a < ${k}) ${sp.apply()}\n    else { ${skipOf(sp)} }\n  }\n`;
        } else {
          src += `  if (b >= ${k} && d0 < ${k}) {\n    float s0 = cxs0_dig(${sp.rads[0]}, c);\n    if (a < ${k}) ${sp.apply(['s0'])}\n  }\n`;
        }
      }
      src += '  return p;\n}\n';
      if (dks.length) {
        dks.forEach((d, i) => {
          const p = i ? dks[i - 1] : 0;
          const inner = (t) => (p ? `cxs0_sg${p}(zc, ${t}, combo)` : `vec4(zc, ${t})`);
          src += `vec4 cxs0_sg${d}(vec2 zc, vec2 z, int combo) {\n`
            + `  float R = ${flt(GPU_REL(i + 1))};\n  float rc = R * (1.0 + cx_abs(zc)), rz = R * (1.0 + cx_abs(z));\n  vec2 ac = vec2(0.0), az = vec2(0.0);\n`
            + '  for (int j = 0; j < 8; j++) {\n    vec2 u = cxs0_u8(j), uc = vec2(u.x, -u.y);\n'
            + `    ac += cmul(cxs0_sraw(${inner('zc + rc * u')}, ${p}, ${d - 1}, combo, 0).zw, uc);\n`
            + `    az += cmul(cxs0_sraw(${inner('z + rz * u')}, ${p}, ${d - 1}, combo, 0).zw, uc);\n`
            + '  }\n  return vec4(ac / (8.0 * rc), az / (8.0 * rz));\n}\n';
        });
      }
      src += 'vec2 chainSheet(vec2 zc, vec2 z, int b, int combo) {\n  vec4 p = vec4(zc, z);\n  int base = 0;\n';
      [...dks].reverse().forEach((d, i) => { src += `  ${i ? 'else ' : ''}if (b >= ${d}) { p = cxs0_sg${d}(zc, z, combo); base = ${d}; }\n`; });
      src += '  return cxs0_sraw(p, base, b, combo, 0).zw;\n}\n';
      // (one call of cxs0_sraw, chainSheet's for a <= 0, else the range's: FXC inlines every call, issue #395)
      src += 'vec2 chainSheetRange(vec2 zc, vec2 z, int a, int b, int combo) {\n  vec4 p = vec4(zc, z);\n  int base = a, d0 = a;\n  if (a <= 0) {\n    base = 0; d0 = 0;\n'
        + [...dks].reverse().map((d, i) => `    ${i ? 'else ' : ''}if (b >= ${d}) { p = cxs0_sg${d}(zc, z, combo); base = ${d}; }\n`).join('') + '  }\n'
        + (dks.length ? `  else if (${dks.map((d) => `(a < ${d} && b >= ${d})`).join(' || ')}) return vec2(cx_nan());\n` : '') + '  return cxs0_sraw(p, base, b, combo, d0).zw;\n}\n';
    }

    // chainSheetHom(zc, z, mode, base, a, hi, b, post, t, combo): a deformation map (gl.js map modes 1 and 3: step hi
    // at t, or the steps (a, b] at t, from the stage base, the post (b, post] in full) on surface combo, as
    // Funcs.sheetMapEval: cxs0_how says how step k is applied (0 not, 1 in full, 2 its path at t); the digits of combo
    // are read for the pieces of the steps applied, in chain order, so at t = 1 the surfaces are chainSheet's
    // (its own source, sheetHom, after the chain's: only the sheet programs take it, so every other program compiles
    // the chain as before)
    let sh = '';
    // the log's path at 0 < t < 1 on sheet s of the cut th, u = 1 - t (P_h of a log step: (z^u - 1)/u + u)
    if (spl.size) {
      sh += 'vec2 cxs0_lh(vec2 z, float th, float s, float u) {\n  if (u < 1e-6) return clog(z, th, s);\n'
        + '  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);\n  return cx_expm1(clog(z, th, s) * u) * (1.0 / u) + vec2(u, 0.0);\n}\n';
      for (const sp of spl.values()) sh += sp.hfn || '';
    }
    sh += 'int cxs0_how(int k, int mode, int base, int a, int hi, int b, int post) {\n'
      + '  if (mode == 1) { if (k > base && k < hi) return 1; if (k == hi) return 2; }\n'
      + '  else if (mode == 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }\n'
      + '  if (post > b && k > b && k <= post) return 1;\n  return 0;\n}\n';
    // end > 0 (F's last step, v16.1 review math-5): F's digits, every live step in (base, end]; a step the map does not
    // apply yet reads its digits and does not act (Funcs.sheetMapEval's end)
    let hcFns = '';
    const shHead = sh.length;
    sh += 'vec2 chainSheetHom(vec2 zc, vec2 z, int mode, int base, int a, int hi, int b, int post, float t, int combo, int end) {\n'
      + '  vec4 p = vec4(zc, z);\n  highp int c = combo;\n  int h;\n';
    for (const { P, k, plan } of live) {
      sh += `  h = cxs0_how(${k}, mode, base, a, hi, b, post);\n`;
      if (plan.deriv) { sh += '  if (h > 0) return vec2(cx_nan());\n'; continue; }
      const sp = spl.get(k);
      if (!sp && plan.hc) {
        // (a path with a cut of its own, z^n's z^(1 + (n - 1)t): on the local cut opposite its input at the centre)
        hcFns += `vec2 ${P}_hc(vec2 z, float t, vec2 zc) {\n  ${plan.hc}\n}\n`;
        sh += `  if (h == 1 || (h == 2 && t >= 1.0)) p = vec4(${P}_f(p.xy), ${P}_f(p.zw));\n  else if (h == 2 && t > 0.0) p = vec4(${P}_hc(p.xy, t, p.xy), ${P}_hc(p.zw, t, p.xy));\n`;
      } else if (!sp) {
        sh += `  if (h == 1 || (h == 2 && t >= 1.0)) p = vec4(${P}_f(p.xy), ${P}_f(p.zw));\n  else if (h == 2 && t > 0.0) p = vec4(${P}_h(p.xy, t), ${P}_h(p.zw, t));\n`;
      } else if (sp.custom) {
        const hom = sp.homCall ? sp.homCall('t') : 'p = vec4(cx_nan());';
        sh += `  if (h == 1 || (h == 2 && t >= 1.0)) ${sp.apply()}\n  else if (h == 2 && t > 0.0) ${hom}\n  else if (h == 2 || (h == 0 && ${k} > base && ${k} <= end)) { ${skipOf(sp)} }\n`;
      } else {
        sh += `  if (h > 0) {\n    float s0 = cxs0_dig(${sp.rads[0]}, c);\n    if (h == 1 || t >= 1.0) ${sp.apply(['s0'])}\n    else if (t > 0.0) ${sp.homApply(['s0'], 't')}\n  }\n  else if (${k} > base && ${k} <= end) cxs0_dig(${sp.rads[0]}, c);\n`;
      }
    }
    sh += '  return p.zw;\n}\n';
    sh = sh.slice(0, shHead) + hcFns + sh.slice(shHead);
    // the landscape's cut kinds per live step (gl.js cutModeOf): f its map, h its path at 0 < t < 1: 'none' (no cut),
    // 'sheet' (cuts the sheets continue: chainSheetRange / chainSheetHom), 'other' (cuts they cannot: an inverse trig
    // function, a Joukowski branch, arg, a formula's path through its branch points), 'deriv' (a d/dz)
    // (sheet 0 at a cell's own centre is F's value only where every multivalued piece takes its principal branch, the
    // cut at 180 degrees and branch 0: a root on branch k or another cut angle is found by bisection, as 'other')
    const principalCut = (bb) => {
      if (!bb || !bb.def) return true;
      const id = bb.def.id, v = bb.vals || {};
      const c180 = v.cut === undefined || v.cut === 180;
      if (id === 'root') { const n = Math.max(2, v.n); return c180 && ((((v.k || 0) % n) + n) % n) === 0; }
      if (id === 'powa' || id === 'log') return c180 && !(v.k || 0);
      if (id === 'custom' && bb.rec) return c180 && bb.rec.built.every(principalCut);
      if (id === 'custom') return c180;
      return true;
    };
    const cutKinds = [];
    for (const { P, k, plan } of live) {
      if (plan.deriv) { cutKinds.push({ k, f: 'deriv', h: 'deriv' }); continue; }
      const { fo, ho } = cutKindOf(P, plan), sp = spl.get(k), pc = principalCut(built[k - 1]);
      cutKinds.push({
        k,
        f: fo ? 'other' : sp ? (pc ? 'sheet' : 'other') : 'none',
        h: ho ? 'other' : sp ? (sp.custom && !sp.homCall ? 'other' : pc ? 'sheet' : 'other') : plan.hc ? 'sheet' : 'none',
      });
    }

    // (Γ, ψ, ζ, ζ′: their library only in a chain that calls them, also from the sheet code)
    src = specialLib(src + sh) + src;
    let cache = null;
    function values() {
      if (cache) return cache;
      const vals = new Float64Array(4 * slots);
      const put = (c, re, im) => { vals[2 * c] = re; vals[2 * c + 1] = im; };
      for (const { plan } of maps) plan.write(put);
      for (const { dp } of dpl) dp.write(put);
      for (const sp of spl.values()) sp.write(put);
      return (cache = vals);
    }
    const sheetList = Funcs.sheetSteps ? Funcs.sheetSteps(steps, built) : [];
    // the inverse program's parts (SPEC 4.1), built on first use: a forward-only draw never pays for them. The steps'
    // on / off flags are taken now (stepOps reads only the built steps).
    const onOff = steps.map((st) => (st ? { on: st.on !== false } : null));
    let inverse;
    return {
      key: JSON.stringify(['glc1', sigs]),
      source: src,
      // chainSheetHom and its helpers (the deformation's sheets, notes/v16-user5/SHEETS-DESIGN.md): GLSL to put after
      // source in the programs that call it
      sheetHom: sh,
      get inverse() {
        if (inverse === undefined) {
          try { inverse = buildInverse(onOff, built); } catch (e) { inverse = { ok: false, reason: 'inverse: ' + (e && e.message), key: null }; }
        }
        return inverse;
      },
      slots,
      fill(out) { const v = values(); for (let i = 0; i < v.length; i++) out[i] = v[i]; return out; },
      // live d/dz steps (chainIsDeriv), whether the first is the exact chain rule
      derivs: dks, derivExact: exact,
      cutKinds,
      // multivalued pieces for the sheet view: steps [{k, n, node}] (n sheets, 0: a window of 2W + 1),
      // combos(W, b, a): number of surfaces of the steps in (a, b] (capped at Funcs.SHEET_MAX; total(...) uncapped)
      sheets: {
        steps: sheetList,
        combos: (W = 2, b = steps.length, a = 0) => Funcs.sheetCombos(steps, built, W, b, Funcs.SHEET_MAX, a),
        total: (W = 2, b = steps.length, a = 0) => Funcs.sheetCombos(steps, built, W, b, Infinity, a),
        // a deformation map's pieces (Funcs.sheetMapPieces: chainSheetHom reads their digits), null when it cannot be
        // drawn as sheets
        mapPieces: (map, end) => (Funcs.sheetMapPieces ? Funcs.sheetMapPieces(steps, built, map, end || 0) : null),
      },
    };
  }

  // ---- region formulas: mirror Expr.compileLevel ----
  // levelGLSL(levelAst, name) -> {source, ok}: `float name(vec2 z)`, positive inside, like Expr.compileLevel
  // (a < b gives b − a, a > b gives a − b on real parts, NaN becomes −inf; and = min, or = max, not = −).
  // Constants are baked in as literals (locals, so infinities are allowed); the formula uses the principal branch,
  // as compileLevel does. Needs LIB. levelAst may also be the formula text (parsed with allowRel).
  // On failure, ok is false and the source defines name as −1 everywhere.
  function levelGLSL(levelAst, name = 'cxLevel') {
    const fallback = { source: `float ${name}(vec2 z) { return -1.0; }\n`, ok: false };
    if (!levelAst || !/^[A-Za-z_]\w*$/.test(name)) return fallback;
    const lit = (x) => {
      if (Number.isNaN(x)) return 'cx_nan()';
      if (!Number.isFinite(x)) return x > 0 ? 'cx_inf()' : '-cx_inf()';
      const s = String(Math.fround(x));
      return /[.eE]/.test(s) ? s.replace(/e\+?/, 'e') : s + '.0';
    };
    try {
      if (typeof levelAst === 'string') levelAst = Expr.parse(levelAst, { allowRel: true });
      const vals = new Map();
      let cells = 0;
      // allocator as in build(), but every cell is a local vec2 / vec4 constant of this function
      const A = {
        cell() { const c = cells; cells += 1; const v = `${name}_k${c}`; return { c, v, x: `${v}.x`, y: `${v}.y`, slot: false }; },
        slot() { const c = cells; cells += 2; return { s: c, c, v: `${name}_k${c}`, slot: true }; },
      };
      const kinds = new Map();
      const wrap = (fn) => () => { const r = fn(); kinds.set(r.c, r.slot); return r; };
      A.cell = wrap(A.cell); A.slot = wrap(A.slot);
      const lines = [];
      let part = 0;
      function lv(n) {
        switch (n.t) {
          case 'cmp': {
            const writers = [];
            const P = `${name}_${part++}`;
            const a = genCustom(n.a, `${P}a`, A, 'CX_PI', writers, lines);
            const b = genCustom(n.b, `${P}b`, A, 'CX_PI', writers, lines);
            for (const w of writers) w((c, re, im) => vals.set(c, [re, im]), Math.PI);
            const d = `${P}d`;
            lines.push(`  float ${d} = ${n.op === '<' || n.op === '<=' ? `${b}.x - ${a}.x` : `${a}.x - ${b}.x`};`);
            lines.push(`  if (cx_isnan(${d})) ${d} = -cx_inf();`);
            return d;
          }
          case 'and': { const a = lv(n.a), b = lv(n.b); return `min(${a}, ${b})`; }
          case 'or': { const a = lv(n.a), b = lv(n.b); return `max(${a}, ${b})`; }
          case 'not': return `(-(${lv(n.a)}))`;
        }
        throw new Error($t('Combine comparisons with and / or / not'));
      }
      if (!Expr.hasBool(levelAst)) return fallback;
      const res = lv(levelAst);
      const decl = [];
      for (const [c, isSlot] of [...kinds.entries()].sort((p, q) => p[0] - q[0])) {
        const v0 = vals.get(c) || [0, 0];
        if (isSlot) {
          const v1 = vals.get(c + 1) || [0, 0];
          decl.push(`  vec4 ${name}_k${c} = vec4(${lit(v0[0])}, ${lit(v0[1])}, ${lit(v1[0])}, ${lit(v1[1])});`);
        } else decl.push(`  vec2 ${name}_k${c} = vec2(${lit(v0[0])}, ${lit(v0[1])});`);
      }
      return { source: withSpecial(`float ${name}(vec2 z) {\n${decl.join('\n')}\n${lines.join('\n')}\n  return ${res};\n}\n`), ok: true };
    } catch (e) {
      return fallback;
    }
  }

  // =================================================================================================================
  // Exact images: the per-pixel inverse walk (notes/sphere-design/SPEC.md 4.1). GLChain.build(...).inverse holds
  //   key     Inverse.inverseKey(steps, built): the op structure of every live step ('X' for a step without an
  //           enumerator); parameter values (and ROOTPOW's mode) are uniforms, so a parameter change keeps it
  //   lib     uInv[] and the per-op uniforms, INV_LIB, and the per-op functions ixJ_* (no walker)
  //   walker  invWalk(w): the static loop nest over the full op list, outermost op first; gl.js places it after its
  //           INV_HEAD (which defines invLeaf, ixRangeAdd / ixRangeLog, ixStopAdd / ixStopLog, ixDK)
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
  const IX_SLOTS = { AFF: 1, MOB: 3, IPOW: 1, ROOTPOW: 2, EXPC: 1, LOG: 1, IJOUK: 1, QUAD: 2, RAT2: 3 };
  const IX_FIN = { IPOW: 16, JOUK: 2, QUAD: 2, RAT2: 2 };
  const IX_ADD = { EXP: 1, EXPC: 1, SIN: 2, COS: 2, TAN: 1, SINH: 2, COSH: 2, TANH: 1 };
  const IX_OPS_MAX = 16;
  // GLSL of the per-op functions of op j (forward index) with parameters at uInv[c ...]
  function invOpFns(o, j, c) {
    const P = `ix${j}`, U = (i) => `uInv[${c + i}]`;
    const lam0 = j === 0 ? 'true' : 'false';
    const NOR = 'false, 1e38, IX_NOLG, false, vec2(0.0), vec2(0.0)';
    const one = (body) => `bool ${P}_one(inout Lf L) {\n  if (!ixFin(L.u)) return false;\n  vec2 w = L.u;\n${body}\n}\n`;
    const rng = (u, d, lvl, lg) => `  return ixApply(L, ${u}, ${d}, false, ${lvl}, ${lg}, false, vec2(0.0), vec2(0.0));`;
    const sg = (x) => `(${x} < 0.0 ? 1.0 : -1.0)`;   // -sgn(x), sgn(0) = 1 (Inverse's sgn)
    switch (o.kind) {
      case 'X': return `bool ${P}_one(inout Lf L) { return false; }\n`;
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
          `${ind}for (int b${j} = 0; b${j} < ${IX_FIN[o.kind]}; b${j}++) {`,
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
      sigs.push(r.ops.map((o) => o.kind));
      r.ops.forEach((o, n) => ops.push({ kind: o.kind, step: i + 1, node: n, op: o }));
    });
    const key = JSON.stringify(['inv2', sigs]);
    if (ops.filter((o) => o.kind !== 'X').length > IX_OPS_MAX) return { ok: false, reason: 'chain too long', key };
    let slots = 0;
    ops.forEach((o, j) => { o.j = j; o.cell = slots; slots += IX_SLOTS[o.kind] || 0; });
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
      txt = { lib: head + INV_LIB + ops.map((o) => invOpFns(o, o.j, o.cell)).join(''), walker: invWalkerSrc(ops) };
      invTextCache.set(key, txt);
      if (invTextCache.size > 32) invTextCache.delete(invTextCache.keys().next().value);
    }
    const { lib, walker } = txt;
    let vals = null;
    return {
      ok: true, key, lib, walker, nOps: ops.length, slots: S,
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

  const ratLogMin = (n) => { const o = RL_MIN; if (n != null) RL_MIN = n; return o; };
  return { LIB, build, mobPathData, levelGLSL, circleRel: GPU_REL, INV_LIB, seriesTrust, ratLogMin };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Funcs } from './funcs.js';
import { Inverse } from './inverse.js';
export { GLChain, GLChain as 'module.exports' };

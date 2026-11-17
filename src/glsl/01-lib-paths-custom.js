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
  // z (1 - t) + f(z) t is not f(z) where z is infinite) and a plan that handles t = 1 in its own body (own1)
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
      // one loop body for every case (a constant-bound loop written out per case would be four copies of the term code, which
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
    return g(ast);
  }



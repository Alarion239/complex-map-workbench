#version 300 es
precision highp float;

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
vec2 cx_sinS(vec2 a) {
  if (dot(a, a) >= 0.01) return csin(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(1.6059044372074283e-10, 0.0);
  s = vec2(-2.5052107943679403e-8, 0.0) + cmul(a2, s);
  s = vec2(0.0000027557318844628753, 0.0) + cmul(a2, s);
  s = vec2(-0.00019841270113829523, 0.0) + cmul(a2, s);
  s = vec2(0.008333333767950535, 0.0) + cmul(a2, s);
  s = vec2(-0.1666666716337204, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_sinhS(vec2 a) {
  if (dot(a, a) >= 0.01) return csinh(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(1.6059044372074283e-10, 0.0);
  s = vec2(2.5052107943679403e-8, 0.0) + cmul(a2, s);
  s = vec2(0.0000027557318844628753, 0.0) + cmul(a2, s);
  s = vec2(0.00019841270113829523, 0.0) + cmul(a2, s);
  s = vec2(0.008333333767950535, 0.0) + cmul(a2, s);
  s = vec2(0.1666666716337204, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_tanS(vec2 a) {
  if (dot(a, a) >= 0.01) return ctan(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(0.0035921279340982437, 0.0);
  s = vec2(0.0088632358238101, 0.0) + cmul(a2, s);
  s = vec2(0.021869488060474396, 0.0) + cmul(a2, s);
  s = vec2(0.05396825447678566, 0.0) + cmul(a2, s);
  s = vec2(0.13333334028720856, 0.0) + cmul(a2, s);
  s = vec2(0.3333333432674408, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_tanhS(vec2 a) {
  if (dot(a, a) >= 0.01) return ctanh(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(0.0035921279340982437, 0.0);
  s = vec2(-0.0088632358238101, 0.0) + cmul(a2, s);
  s = vec2(0.021869488060474396, 0.0) + cmul(a2, s);
  s = vec2(-0.05396825447678566, 0.0) + cmul(a2, s);
  s = vec2(0.13333334028720856, 0.0) + cmul(a2, s);
  s = vec2(-0.3333333432674408, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_asinS(vec2 a) {
  if (dot(a, a) >= 0.01) return casin(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(0.017352763563394547, 0.0);
  s = vec2(0.022372158244252205, 0.0) + cmul(a2, s);
  s = vec2(0.0303819440305233, 0.0) + cmul(a2, s);
  s = vec2(0.0446428582072258, 0.0) + cmul(a2, s);
  s = vec2(0.07500000298023224, 0.0) + cmul(a2, s);
  s = vec2(0.1666666716337204, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_asinhS(vec2 a) {
  if (dot(a, a) >= 0.01) return casinh(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(0.017352763563394547, 0.0);
  s = vec2(-0.022372158244252205, 0.0) + cmul(a2, s);
  s = vec2(0.0303819440305233, 0.0) + cmul(a2, s);
  s = vec2(-0.0446428582072258, 0.0) + cmul(a2, s);
  s = vec2(0.07500000298023224, 0.0) + cmul(a2, s);
  s = vec2(-0.1666666716337204, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_atanS(vec2 a) {
  if (dot(a, a) >= 0.01) return catan(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(0.07692307978868484, 0.0);
  s = vec2(-0.09090909361839294, 0.0) + cmul(a2, s);
  s = vec2(0.1111111119389534, 0.0) + cmul(a2, s);
  s = vec2(-0.1428571492433548, 0.0) + cmul(a2, s);
  s = vec2(0.20000000298023224, 0.0) + cmul(a2, s);
  s = vec2(-0.3333333432674408, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_atanhS(vec2 a) {
  if (dot(a, a) >= 0.01) return catanh(a);
  vec2 a2 = cmul(a, a);
  vec2 s = vec2(0.07692307978868484, 0.0);
  s = vec2(0.09090909361839294, 0.0) + cmul(a2, s);
  s = vec2(0.1111111119389534, 0.0) + cmul(a2, s);
  s = vec2(0.1428571492433548, 0.0) + cmul(a2, s);
  s = vec2(0.20000000298023224, 0.0) + cmul(a2, s);
  s = vec2(0.3333333432674408, 0.0) + cmul(a2, s);
  return a + cmul(a, cmul(a2, s));
}
vec2 cx_log1p(vec2 v) {
  if (dot(v, v) >= 0.01) return clog(vec2(1.0, 0.0) + v, CX_PI, 0.0);
  vec2 s = vec2(-0.125, 0.0);
  s = vec2(0.1428571492433548, 0.0) + cmul(v, s);
  s = vec2(-0.1666666716337204, 0.0) + cmul(v, s);
  s = vec2(0.20000000298023224, 0.0) + cmul(v, s);
  s = vec2(-0.25, 0.0) + cmul(v, s);
  s = vec2(0.3333333432674408, 0.0) + cmul(v, s);
  s = vec2(-0.5, 0.0) + cmul(v, s);
  s = vec2(1.0, 0.0) + cmul(v, s);
  return cmul(v, s);
}

uniform vec4 uChain[5];
uniform highp int uSheetW;
vec2 cxs1_f(vec2 z) {
  vec2 cxs1_0 = cpowr(z, 0.5, uChain[0].x, 0.0);
  return cxs1_0;
}
vec2 cxs1_h(vec2 z, float t) {
  if (t <= 0.0) return z;
  float t0 = uChain[2].x, tt = t == 1.0 ? 1.0 : max(t, t0);
  vec2 fa = cxs1_f(t == 1.0 ? z : uChain[0].zw + (z - uChain[0].zw) * tt);
  if (t == 1.0) return fa;
  vec2 h = uChain[0].zw * (1.0 - tt) + uChain[1].xy * tt + cmul(cexp(uChain[1].zw * (tt - 1.0)), fa - uChain[1].xy) / tt;
  return t < t0 ? z + (h - z) * (t / t0) : h;
}
vec2 chainStep(int i, vec2 z) {
  if (i == 1) return cxs1_f(z);
  if (i == 2) return vec2(cx_nan());
  if (i == 3) return vec2(cx_nan());
  return z;
}
vec2 chainHom(int i, vec2 z, float t) {
  if (i == 1) return cxs1_h(z, t);
  if (i == 2) return vec2(cx_nan());
  if (i == 3) return vec2(cx_nan());
  return z;
}
vec2 chainAt(int k, vec2 z, float t, int how) {
  if (how == 0) return z;
  if (k == 1) return cxs1_h(z, how == 1 ? 1.0 : t);
  if (k == 2) return vec2(cx_nan());
  if (k == 3) return vec2(cx_nan());
  return z;
}
vec2 chainHomAll(vec2 z, int a, int b, float t) {
  for (int k = 1; k <= 3; k++) {
    if (k > b) break;
    if (k > a) z = chainHom(k, z, t);
  }
  return z;
}
bool chainIsDeriv(int k) {
  return k == 2 || k == 3;
}
vec2 cxs0_raw(vec2 z, int a, int b) {
  if (a < 1 && b >= 1) z = cxs1_f(z);
  return z;
}
vec2 cxs1_df(vec2 z) {
  vec2 cxs1_d_0 = cpowr(z, 0.5, uChain[2].z, 0.0);
  vec2 cxs1_d_1 = cmul(uChain[3].zw, cxs1_d_0);
  vec2 cxs1_d_2 = cdiv(uChain[3].xy, cxs1_d_1);
  return cxs1_d_2;
}
vec2 cxs0_u8(int j) {
  const float h = 0.7071067811865476;
  if (j == 0) return vec2(1.0, 0.0);
  if (j == 1) return vec2(h, h);
  if (j == 2) return vec2(0.0, 1.0);
  if (j == 3) return vec2(-h, h);
  if (j == 4) return vec2(-1.0, 0.0);
  if (j == 5) return vec2(-h, -h);
  if (j == 6) return vec2(0.0, -1.0);
  return vec2(h, -h);
}
vec2 cxs0_g2(vec2 z) {
  vec2 D = vec2(1.0, 0.0);
  D = cmul(D, cxs1_df(z)); z = cxs1_f(z);
  return D;
}
vec2 cxs0_g3(vec2 z) {
  float r = 0.009999999776482582 * (1.0 + cx_abs(z));
  vec2 acc = vec2(0.0);
  for (int j = 0; j < 8; j++) {
    vec2 u = cxs0_u8(j);
    vec2 g = cxs0_raw(cxs0_g2(z + r * u), 2, 2);
    acc += cmul(g, vec2(u.x, -u.y));
  }
  return acc / (8.0 * r);
}
vec2 chainStage(int k, vec2 z) {
  int base = 0;
  if (k >= 3) { z = cxs0_g3(z); base = 3; }
  else if (k >= 2) { z = cxs0_g2(z); base = 2; }
  return cxs0_raw(z, base, k);
}
vec2 chainRange(vec2 z, int a, int b) {
  if (a <= 0) return chainStage(b, z);
  if ((a < 2 && b >= 2) || (a < 3 && b >= 3)) return vec2(cx_nan());
  return cxs0_raw(z, a, b);
}
int cxs0_rad(float n) { return n > 0.5 ? int(n + 0.5) : 2 * uSheetW + 1; }
// the next sheet number from the mixed-radix digits of c (lowest first)
float cxs0_dig(float n, inout highp int c) {
  highp int r = max(cxs0_rad(n), 1);
  highp int q = c / r;
  highp int d = c - q * r;
  c = q;
  return n > 0.5 ? float(d) : float(d - uSheetW);
}
vec4 cxs1_s(vec4 p, inout highp int c) {
  vec2 zc = p.xy, zw = p.zw;
  float cxs1_p_s0 = cxs0_dig(uChain[4].x, c) + floor((uChain[4].y - carg(zc)) / (2.0 * CX_PI));
  float cxs1_p_t0 = carg(zc) + CX_PI;
  vec2 cxs1_p_0c = cpowr(zc, 0.5, cxs1_p_t0, cxs1_p_s0);
  vec2 cxs1_p_0w = cpowr(zw, 0.5, cxs1_p_t0, cxs1_p_s0);
  return vec4(cxs1_p_0c, cxs1_p_0w);
}
vec4 cxs0_sraw(vec4 p, int a, int b, highp int c, int d0) {
  if (b >= 1 && d0 < 1) {
    if (a < 1) p = cxs1_s(p, c);
    else { cxs0_dig(uChain[4].x, c); }
  }
  return p;
}
vec4 cxs0_sg2(vec2 zc, vec2 z, int combo) {
  float R = 0.009999999776482582;
  float rc = R * (1.0 + cx_abs(zc)), rz = R * (1.0 + cx_abs(z));
  vec2 ac = vec2(0.0), az = vec2(0.0);
  for (int j = 0; j < 8; j++) {
    vec2 u = cxs0_u8(j), uc = vec2(u.x, -u.y);
    ac += cmul(cxs0_sraw(vec4(zc, zc + rc * u), 0, 1, combo, 0).zw, uc);
    az += cmul(cxs0_sraw(vec4(zc, z + rz * u), 0, 1, combo, 0).zw, uc);
  }
  return vec4(ac / (8.0 * rc), az / (8.0 * rz));
}
vec4 cxs0_sg3(vec2 zc, vec2 z, int combo) {
  float R = 0.029999999329447746;
  float rc = R * (1.0 + cx_abs(zc)), rz = R * (1.0 + cx_abs(z));
  vec2 ac = vec2(0.0), az = vec2(0.0);
  for (int j = 0; j < 8; j++) {
    vec2 u = cxs0_u8(j), uc = vec2(u.x, -u.y);
    ac += cmul(cxs0_sraw(cxs0_sg2(zc, zc + rc * u, combo), 2, 2, combo, 0).zw, uc);
    az += cmul(cxs0_sraw(cxs0_sg2(zc, z + rz * u, combo), 2, 2, combo, 0).zw, uc);
  }
  return vec4(ac / (8.0 * rc), az / (8.0 * rz));
}
vec2 chainSheet(vec2 zc, vec2 z, int b, int combo) {
  vec4 p = vec4(zc, z);
  int base = 0;
  if (b >= 3) { p = cxs0_sg3(zc, z, combo); base = 3; }
  else if (b >= 2) { p = cxs0_sg2(zc, z, combo); base = 2; }
  return cxs0_sraw(p, base, b, combo, 0).zw;
}
vec2 chainSheetRange(vec2 zc, vec2 z, int a, int b, int combo) {
  vec4 p = vec4(zc, z);
  int base = a, d0 = a;
  if (a <= 0) {
    base = 0; d0 = 0;
    if (b >= 3) { p = cxs0_sg3(zc, z, combo); base = 3; }
    else if (b >= 2) { p = cxs0_sg2(zc, z, combo); base = 2; }
  }
  else if ((a < 2 && b >= 2) || (a < 3 && b >= 3)) return vec2(cx_nan());
  return cxs0_sraw(p, base, b, combo, d0).zw;
}
vec2 cxs0_lh(vec2 z, float th, float s, float u) {
  if (u < 1e-6) return clog(z, th, s);
  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);
  return cx_expm1(clog(z, th, s) * u) * (1.0 / u) + vec2(u, 0.0);
}
int cxs0_how(int k, int mode, int base, int a, int hi, int b, int post) {
  if (mode == 1) { if (k > base && k < hi) return 1; if (k == hi) return 2; }
  else if (mode == 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }
  if (post > b && k > b && k <= post) return 1;
  return 0;
}
float cxs0_dom = 1e30;
vec2 chainSheetHom(vec2 zc, vec2 z, int mode, int base, int a, int hi, int b, int post, float t, int combo, int end) {
  vec4 p = vec4(zc, z);
  highp int c = combo;
  int h;
  cxs0_dom = 1e30;
  h = cxs0_how(1, mode, base, a, hi, b, post);
  if (h == 1 || (h == 2 && t >= 1.0)) p = cxs1_s(p, c);
  else if (h == 2 && t > 0.0) p = vec4(cx_nan());
  else if (h == 2 || (h == 0 && 1 > base && 1 <= end)) { cxs0_dig(uChain[4].x, c); }
  h = cxs0_how(2, mode, base, a, hi, b, post);
  if (h > 0) return vec2(cx_nan());
  h = cxs0_how(3, mode, base, a, hi, b, post);
  if (h > 0) return vec2(cx_nan());
  return p.zw;
}


uniform highp sampler2D uPts;
uniform highp sampler2D uModes;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 zz = texelFetch(uPts, ivec2(c.x, 0), 0);
  vec2 z = zz.xy;
  vec4 m = texelFetch(uModes, ivec2(0, c.y), 0);
  vec2 w;
  // (v16.1) mode 9: chainSheetHom; m = (9, mode + 4 post + 256 end, t, combo), the second texel (base, a, hi, b)
  if (m.x > 8.75 && m.x < 9.25) {
    vec4 m2 = texelFetch(uModes, ivec2(1, c.y), 0);
    int pk = int(m.y + 0.5), pq = pk / 4;
    w = chainSheetHom(zz.zw, z, pk - 4 * pq, int(m2.x + 0.5), int(m2.y + 0.5), int(m2.z + 0.5), int(m2.w + 0.5), pq - 64 * (pq / 64), m.z, int(m.w + 0.5), pk / 256);
  } else
  if (m.x < 0.5) w = chainRange(z, int(m.y), int(m.z));
  else if (m.x < 1.5) w = chainStep(int(m.y), z);
  else if (m.x < 2.5) w = chainHom(int(m.y), z, m.z);
  else if (m.x < 3.5) w = chainStage(int(m.y), z);
  else if (m.x < 4.5) w = chainSheet(zz.zw, z, int(m.y), int(m.z));
  else if (m.x < 5.5) w = chainSheetRange(zz.zw, z, int(m.y), int(m.z), int(m.w));
  /*CARRY*/
  else if (m.x > 6.5) {
    int xi = int(m.x + 0.5), md = xi - 16 * (xi / 16), kk = xi / 16, b = int(m.y + 0.5), post = int(m.z + 0.5);
    vec2 u = chainRange(z, 0, md == 7 ? kk - 1 : kk);
    if (md == 7) u = m.w <= 0.0 ? u : chainHom(kk, u, m.w);
    else u = m.w <= 0.0 ? u : chainHomAll(u, kk, b, m.w);
    w = post > b ? chainRange(u, b, post) : u;
  }
  else w = chainHomAll(z, int(m.y), int(m.z), m.w);
  o = vec4(w, cfin(w) ? 1.0 : 0.0, 1.0);
}
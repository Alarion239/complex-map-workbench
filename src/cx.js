// @ts-check
'use strict';
// The interface strings: $t, $tx, $tn and I18N come from i18n.js, first in the build. A node test that loads cx.js
// without it gets them here: require('./i18n.js'), or, in a vm context without require, this English-only stub
// (the same placeholder rule as i18n.js; English is the identity, notes/i18n/DESIGN.md 1).
if (typeof I18N === 'undefined' && typeof globalThis !== 'undefined' && typeof /** @type {any} */ (globalThis).$t !== 'function') {
  if (typeof require === 'function') require('./i18n.js');
  else {
    const fill = (s, p) => {
      if (!p) return s;
      const tex = /[$\\]/.test(s);
      return s.replace(/%\{([A-Za-z_][A-Za-z0-9_]*)\}|\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, a, b) => {
        const k = a || (!tex && b);
        return k && Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m;
      });
    };
    const $t = (s, p) => fill(s, p), $tx = (c, s, p) => fill(s, p);
    const $tn = (one, many, n, p) => fill(n === 1 ? one : many, Object.assign({ n: String(n) }, p));
    const I18N = { lang: 'en', t: $t, tx: $tx, tn: $tn, fill, num: (n) => String(n), fnName: (n) => n, notation: (s) => s, texNum: (x) => String(x), comma: () => false };
    Object.assign(globalThis, { I18N, $t, $tx, $tn });
  }
}
// Complex arithmetic. Numbers are plain {re, im} objects.
const CX = (() => {
  const TAU = 2 * Math.PI;
  const C = (re, im = 0) => ({ re, im });
  const ZERO = C(0, 0), ONE = C(1, 0), I = C(0, 1);
  const INF = C(Infinity, Infinity);

  const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
  const sub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
  const neg = (a) => ({ re: -a.re, im: -a.im });
  const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const scale = (a, s) => ({ re: a.re * s, im: a.im * s });
  const conj = (a) => ({ re: a.re, im: -a.im });
  const abs = (a) => Math.hypot(a.re, a.im);
  const abs2 = (a) => a.re * a.re + a.im * a.im;
  const arg = (a) => Math.atan2(a.im, a.re);
  const isFin = (a) => Number.isFinite(a.re) && Number.isFinite(a.im);
  const eq = (a, b, eps = 0) => Math.abs(a.re - b.re) <= eps && Math.abs(a.im - b.im) <= eps;
  const isZero = (a) => a.re === 0 && a.im === 0;

  function div(a, b) {
    // Smith's algorithm
    if (b.re === 0 && b.im === 0) {
      if (a.re === 0 && a.im === 0) return C(NaN, NaN);
      return C(Infinity, Infinity);
    }
    if (Math.abs(b.re) >= Math.abs(b.im)) {
      const r = b.im / b.re, d = b.re + b.im * r;
      return C((a.re + a.im * r) / d, (a.im - a.re * r) / d);
    } else {
      const r = b.re / b.im, d = b.re * r + b.im;
      return C((a.re * r + a.im) / d, (a.im * r - a.re) / d);
    }
  }
  const inv = (a) => div(ONE, a);

  function exp(a) {
    const e = Math.exp(a.re);
    if (a.im === 0) return C(e, 0);
    return C(e * Math.cos(a.im), e * Math.sin(a.im));
  }

  // Argument in (theta - 2pi, theta]; theta = pi gives the principal branch.
  // A cut along the negative real axis (theta = pi + 2 pi m) reads the sign of a zero imaginary part as the principal
  // branch does at every m: -1 - 0i is the limit from below (theta - 2 pi), -1 + 0i is theta. So argCut(pi + 2 pi m) is
  // argCut(pi) + 2 pi m on the ray too, as the catalog's (cut, sheet) form computes it (review math-3: a formula with
  // its cut at 540 or -180 and its split steps differed there)
  function argCut(a, theta = Math.PI) {
    let t = Math.atan2(a.im, a.re);
    if (theta !== Math.PI) {
      const m = (theta - Math.PI) / TAU, mr = Math.round(m);
      if (Math.abs(m - mr) < 1e-12) t += TAU * mr;
      else t -= TAU * Math.ceil((t - theta) / TAU);
    }
    return t;
  }
  // log with branch cut along the ray at angle theta, on sheet k.
  function log(a, theta = Math.PI, k = 0) {
    return C(Math.log(Math.hypot(a.re, a.im)), argCut(a, theta) + TAU * k);
  }
  // z^s for real s, branch as in log
  function powReal(a, s, theta = Math.PI, k = 0) {
    const r = Math.hypot(a.re, a.im);
    if (r === 0) return s > 0 ? C(0, 0) : (s === 0 ? C(1, 0) : INF);
    const t = (argCut(a, theta) + TAU * k) * s;
    const m = Math.pow(r, s);
    return C(m * Math.cos(t), m * Math.sin(t));
  }
  // z^w for complex w
  function pow(a, w, theta = Math.PI, k = 0) {
    if (w.im === 0) return powReal(a, w.re, theta, k);
    if (a.re === 0 && a.im === 0) return w.re > 0 ? C(0, 0) : INF;
    return exp(mul(w, log(a, theta, k)));
  }
  // z^n for an integer n by binary exponentiation. Plain arithmetic (not n & 1, n >> 1), so an n beyond int32
  // is never truncated; callers keep |n| <= 4096, where this is bit-identical to the GPU's cx_ipow32.
  function ipow(a, n) {
    if (n === 0) return C(1, 0);
    let neg_ = n < 0; n = Math.abs(n);
    let r = C(1, 0), b = a;
    while (n > 0) { if (n % 2 === 1) r = mul(r, b); b = mul(b, b); n = Math.floor(n / 2); }
    return neg_ ? inv(r) : r;
  }
  function sqrt(a) { // principal
    const r = Math.hypot(a.re, a.im);
    if (r === 0) return C(0, 0);
    if (a.re >= 0) {
      const t = Math.sqrt(0.5 * (r + a.re));
      return C(t, a.im / (2 * t));
    } else {
      const t = Math.sqrt(0.5 * (r - a.re));
      return C(Math.abs(a.im) / (2 * t), a.im >= 0 ? t : -t);
    }
  }
  const sin = (a) => C(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
  const cos = (a) => C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
  // tan z, without cancellation near its poles and without the old clamp to +-i for |Im z| > 20 (which also made tanh
  // exactly +-1 for |Re z| > 20). |Im z| <= 1: (sin x cos x + i sinh y cosh y) / (cos^2 x + sinh^2 y), where
  // cos 2x + cosh 2y = 2 (cos^2 x + sinh^2 y) no longer cancels at the poles (the GPU's ctan uses the same form);
  // |Im z| > 1: tan z = s i (1 - q) / (1 + q), s = sign(Im z), q = e^{2isz} with |q| = e^{-2|Im z|} < e^-2.
  function tan(a) {
    const x = a.re, y = a.im;
    if (Math.abs(y) > 1) {
      const s = y > 0 ? 1 : -1;
      const q = exp(C(-2 * s * y, 2 * s * x));
      const r = div(sub(ONE, q), add(ONE, q));
      return C(-s * r.im, s * r.re);
    }
    const c = Math.cos(x), sn = Math.sin(x), sh = Math.sinh(y), ch = Math.cosh(y);
    const d = c * c + sh * sh;
    return C(sn * c / d, sh * ch / d);
  }
  const sinh = (a) => C(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im));
  const cosh = (a) => C(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im));
  function tanh(a) { // tanh z = -i tan(iz)
    const t = tan(C(-a.im, a.re));
    return C(t.im, -t.re);
  }
  // Principal inverse trig functions (standard cuts).
  function asin0(a) { // -i log(iz + sqrt(1 - z^2))
    const iz = C(-a.im, a.re);
    const s = sqrt(sub(ONE, mul(a, a)));
    const l = log(add(iz, s));
    return C(l.im, -l.re);
  }
  // asin is odd off its cuts: iz and sqrt(1 - z^2) nearly cancel where Im z > 0 (and on the cut z < -1), losing about
  // 2 log10|z| digits; there it is evaluated as -asin0(-z), whose sum does not cancel. The same values (the GPU's
  // casin uses this form); on the cuts the sides are those of asin0.
  function asin(a) { return a.im > 0 || (a.im === 0 && a.re < 0) ? neg(asin0(neg(a))) : asin0(a); }
  const acos = (a) => sub(C(Math.PI / 2, 0), asin(a));
  function atan(a) { // (i/2)(log(1 - iz) - log(1 + iz))
    const iz = C(-a.im, a.re);
    const d = sub(log(sub(ONE, iz)), log(add(ONE, iz)));
    return C(-d.im / 2, d.re / 2);
  }
  function asinh(a) { // log(z + sqrt(z^2+1))  = -i asin(iz)
    const s = asin(C(-a.im, a.re));
    return C(s.im, -s.re);
  }
  function acosh(a) { // log(z + sqrt(z-1) sqrt(z+1))
    return log(add(a, mul(sqrt(sub(a, ONE)), sqrt(add(a, ONE)))));
  }
  function atanh(a) { // -i atan(iz)
    const t = atan(C(-a.im, a.re));
    return C(t.im, -t.re);
  }

  // the inverse Joukowski map z + sg sqrt(z - 1) sqrt(z + 1) (principal roots): the interior branch (sg < 0) as
  // 1 / (z + s), equal to z - s since (z - s)(z + s) = z^2 - s^2 = 1, without the cancellation of z - s at large |z|
  function ijouk(z, sg) {
    const e = add(z, mul(sqrt(sub(z, ONE)), sqrt(add(z, ONE))));
    return sg < 0 ? inv(e) : e;
  }

  // ---- the Gamma function, the digamma function and the Riemann zeta function (issue #4) ----
  // log sin w, without overflow for large |Im w|: sin w = ∓(e^{∓iw} / 2i)(1 − e^{±2iw}) for ±Im w > 20, so the branch
  // of the result is arbitrary (its exponential is sin w)
  function logSin(w) {
    if (Math.abs(w.im) <= 20) return log(sin(w));
    const s = w.im > 0 ? 1 : -1;
    // log(e^{-isw} (1 - e^{2isw}) / (2i)) with s = sign(Im w): sin w = -s e^{-isw} (1 - e^{2isw}) / (2i)
    const q = exp(C(-2 * s * w.im, 2 * s * w.re));
    const L = add(C(s * w.im, -s * w.re), log(sub(ONE, q)));
    // − log(2i) and the sign −s: log(−s/(2i)) = log(s i / 2)
    return add(L, C(Math.log(0.5), s * Math.PI / 2));
  }
  // log Γ(z) (some branch: exp of it is Γ(z)). Lanczos, g = 7, n = 9, for Re z ≥ 1/2; the reflection
  // Γ(z) Γ(1 − z) = π / sin(πz) otherwise. A pole (z = 0, −1, −2, …) gives Re = +∞
  const LZ_G = 7;
  const LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const LOG_2PI_2 = 0.5 * Math.log(TAU), LOG_PI = Math.log(Math.PI);
  function lgamma(z) {
    if (z.re < 0.5) {
      // log Γ(z) = log π − log sin(πz) − log Γ(1 − z)
      if (z.im === 0 && Number.isInteger(z.re)) return C(Infinity, 0);
      return sub(sub(C(LOG_PI, 0), logSin(scale(z, Math.PI))), lgamma(sub(ONE, z)));
    }
    const x = sub(z, ONE);
    let A = C(LZ[0], 0);
    for (let k = 1; k < LZ.length; k++) A = add(A, div(C(LZ[k], 0), add(x, C(k, 0))));
    const t = add(x, C(LZ_G + 0.5, 0));
    // ½ log 2π + (x + ½) log t − t + log A
    return add(add(C(LOG_2PI_2, 0), mul(add(x, C(0.5, 0)), log(t))), sub(log(A), t));
  }
  function gamma(z) {
    // (n − 1)! exactly for the positive integers whose factorial is finite
    if (z.im === 0 && Number.isInteger(z.re) && z.re >= 1 && z.re <= 171) { let f = 1; for (let k = 2; k < z.re; k++) f *= k; return C(f, 0); }
    const L = lgamma(z);
    if (L.re === Infinity) return INF;
    return exp(L);
  }
  // [issue #5] z! = Γ(z + 1), exact for the integers 0 … 170 (171! overflows: +∞); a negative integer is a pole (∞)
  function fact(z) {
    if (z.im === 0 && Number.isInteger(z.re) && z.re >= 0) { if (z.re > 170) return C(Infinity, 0); let f = 1; for (let k = 2; k <= z.re; k++) f *= k; return C(f, 0); }
    return gamma(add(z, ONE));
  }
  // the binomial coefficient (a choose b): for an integer b ≥ 0 the falling factorial a(a−1)…(a−b+1)/b!, a product of
  // b factors (exact for small integers, any complex a); a negative integer b gives 0; otherwise
  // Γ(a + 1)/(Γ(b + 1) Γ(a − b + 1)) in log form
  function binom(a, b) {
    if (b.im === 0 && Number.isInteger(b.re)) {
      const k = b.re;
      if (k < 0) return C(0, 0);
      if (a.im === 0 && Number.isInteger(a.re) && a.re >= 0 && k > a.re) return C(0, 0);
      // symmetry for integers, so C(1000, 998) takes 2 factors
      const m = a.im === 0 && Number.isInteger(a.re) && a.re >= 0 && a.re - k < k ? a.re - k : k;
      if (m > 4096) return C(NaN, NaN);
      let r = C(1, 0);
      for (let j = 0; j < m; j++) { const t = mul(r, sub(a, C(j, 0))); r = C(t.re / (j + 1), t.im / (j + 1)); }
      return r;
    }
    const L = sub(lgamma(add(a, ONE)), add(lgamma(add(b, ONE)), lgamma(add(sub(a, b), ONE))));
    return L.re === Infinity ? INF : exp(L);
  }
  // ψ(z) = Γ′(z)/Γ(z): the reflection ψ(z) = ψ(1 − z) − π cot(πz) for Re z < 1/2, the recurrence ψ(z) = ψ(z + 1) − 1/z
  // up to |z| ≥ 10, then the asymptotic series log z − 1/(2z) − Σ B₂ₖ / (2k z²ᵏ)
  const PSI_B = [1 / 12, -1 / 120, 1 / 252, -1 / 240, 1 / 132, -691 / 32760, 1 / 12];
  function digamma(z) {
    if (z.re < 0.5) {
      if (z.im === 0 && Number.isInteger(z.re)) return INF;
      const pz = scale(z, Math.PI);
      return sub(digamma(sub(ONE, z)), scale(inv(tan(pz)), Math.PI));
    }
    let acc = ZERO;
    let w = z;
    while (abs(w) < 10) { acc = sub(acc, inv(w)); w = add(w, ONE); }
    const w2 = inv(mul(w, w));
    let p = w2, ser = ZERO;
    for (const b of PSI_B) { ser = add(ser, scale(p, b)); p = mul(p, w2); }
    return add(acc, sub(sub(log(w), scale(inv(w), 0.5)), ser));
  }
  // ζ(s): Euler–Maclaurin for Re s ≥ 0, ζ(s) = Σ_{k<N} k^{−s} + N^{1−s}/(s − 1) + N^{−s}/2
  // + Σ_{j≤M} B₂ⱼ/(2j)! s(s+1)…(s+2j−2) N^{−s−2j+1}, with N = |Im s| + 15 and M = 10 (the remainder is below
  // (|s|/2πN)^{2M+2}, about 10⁻¹⁸); no 0/0 on Re s = 1, as the alternating-series route has; the pole at s = 1 is ∞.
  // Re s < 0: the functional equation ζ(s) = 2^s π^{s−1} sin(πs/2) Γ(1 − s) ζ(1 − s), its first factors combined in
  // log form (sin and Γ over- and underflow separately). |Im s| > ZETA_MAX: NaN (not computed, never a wrong value)
  const ZETA_MAX = 5000;
  const EM_C = (() => {
    // B₂ⱼ/(2j)! for j = 1 … 10
    const B = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510, 43867 / 798, -174611 / 330];
    let f = 1;
    return B.map((b, j) => { f *= (2 * j + 1) * (2 * j + 2); return b / f; });
  })();
  function zetaEM(s) {
    if (s.re === 1 && s.im === 0) return INF;
    const N = Math.ceil(Math.abs(s.im)) + 15;
    const ms = neg(s);
    let sum = ZERO;
    for (let k = 1; k < N; k++) sum = add(sum, exp(scale(ms, Math.log(k))));
    const lnN = Math.log(N), Nms = exp(scale(ms, lnN));   // N^{−s}
    sum = add(sum, scale(Nms, 0.5));
    sum = add(sum, div(scale(Nms, N), sub(s, ONE)));
    // the Bernoulli terms: P_j = s(s+1)…(s+2j−2), N^{−s−2j+1}
    let P = s, Np = scale(Nms, 1 / N);
    for (let j = 0; j < EM_C.length; j++) {
      if (j) { P = mul(P, mul(add(s, C(2 * j - 1, 0)), add(s, C(2 * j, 0)))); Np = scale(Np, 1 / (N * N)); }
      sum = add(sum, scale(mul(P, Np), EM_C[j]));
    }
    return sum;
  }
  // ζ′(s): the same Euler–Maclaurin sum differentiated term by term for Re s ≥ 0; for Re s < 0, from ζ(s) = χ(s) ζ(1 − s):
  // ζ′(s) = χ(s) (L′(s) ζ(1 − s) − ζ′(1 − s)), L′ = log 2 + log π + (π/2) cot(πs/2) − ψ(1 − s), in log form except near
  // the real axis, where χ cot(πs/2) is taken as 2^s π^{s−1} (π/2) cos(πs/2) Γ(1 − s) (finite at the trivial zeros)
  function zetaEMd(s) {
    if (s.re === 1 && s.im === 0) return INF;
    const N = Math.ceil(Math.abs(s.im)) + 15;
    const ms = neg(s);
    let sum = ZERO;
    for (let k = 2; k < N; k++) { const lk = Math.log(k); sum = sub(sum, scale(exp(scale(ms, lk)), lk)); }
    const lnN = Math.log(N), Nms = exp(scale(ms, lnN)), s1 = sub(s, ONE);
    sum = sub(sum, scale(Nms, 0.5 * lnN));
    // d/ds N^{1−s}/(s − 1) = −N^{1−s} (log N/(s − 1) + 1/(s − 1)²)
    const r = inv(s1);
    sum = sub(sum, mul(scale(Nms, N), add(scale(r, lnN), mul(r, r))));
    let P = s, Pd = ONE, Np = scale(Nms, 1 / N);
    for (let j = 0; j < EM_C.length; j++) {
      if (j) {
        const q = mul(add(s, C(2 * j - 1, 0)), add(s, C(2 * j, 0))), qd = add(scale(s, 2), C(4 * j - 1, 0));
        Pd = add(mul(Pd, q), mul(P, qd)); P = mul(P, q); Np = scale(Np, 1 / (N * N));
      }
      sum = add(sum, scale(mul(sub(Pd, scale(P, lnN)), Np), EM_C[j]));
    }
    return sum;
  }
  function zetaDeriv(s) {
    if (!isFin(s) || Math.abs(s.im) > ZETA_MAX) return C(NaN, NaN);
    if (s.re >= 0) return zetaEMd(s);
    const one = sub(ONE, s), z1 = zetaEM(one), z1d = zetaEMd(one);
    const base = sub(C(Math.LN2 + LOG_PI, 0), digamma(one));
    const hs = scale(s, Math.PI / 2);
    if (Math.abs(s.im) < 1) {
      // χ = A sin(πs/2), A = 2^s π^{s−1} Γ(1 − s)
      const A = mul(exp(add(scale(s, Math.LN2), scale(sub(s, ONE), LOG_PI))), gamma(one));
      const sn = sin(hs), cs = cos(hs);
      return mul(A, sub(add(mul(mul(sn, base), z1), scale(mul(cs, z1), Math.PI / 2)), mul(sn, z1d)));
    }
    const chi = exp(add(add(add(scale(s, Math.LN2), scale(sub(s, ONE), LOG_PI)), logSin(hs)), lgamma(one)));
    const Ld = add(base, scale(inv(tan(hs)), Math.PI / 2));
    return mul(chi, sub(mul(Ld, z1), z1d));
  }
  function zeta(s) {
    if (!isFin(s) || Math.abs(s.im) > ZETA_MAX) return C(NaN, NaN);
    if (s.re >= 0) return zetaEM(s);
    // the trivial zeros −2, −4, …: exactly 0
    if (s.im === 0 && s.re % 2 === 0) return ZERO;
    const one = sub(ONE, s);
    const L = add(add(add(scale(s, Math.LN2), scale(sub(s, ONE), LOG_PI)), logSin(scale(s, Math.PI / 2))), lgamma(one));
    return mul(exp(L), zetaEM(one));
  }
  // ---- Dirichlet series Σ a_k k^{−s} (issues #242, #244) ----
  // k^{−w} for k = 1 … K: completely multiplicative, so one exp per prime and a product for the others (the smallest
  // prime factor table grows on demand). A few ulps from the direct exp at most. The table is shared: valid until the
  // next call
  /** @type {{ n: number, p: Int32Array }} */
  const SPF = { n: 0, p: new Int32Array(0) };
  function spf(K) {
    if (SPF.n < K) {
      const n = Math.max(K, 2 * SPF.n, 4096), p = new Int32Array(n + 1);
      for (let i = 2; i <= n; i++) if (!p[i]) for (let j = i; j <= n; j += i) if (!p[j]) p[j] = i;
      SPF.n = n; SPF.p = p;
    }
    return SPF.p;
  }
  let PT = { re: new Float64Array(0), im: new Float64Array(0) };
  /** @param {{re: number, im: number}} w @param {number} K */
  function powTable(w, K) {
    if (PT.re.length <= K) PT = { re: new Float64Array(2 * K + 2), im: new Float64Array(2 * K + 2) };
    const P = spf(K), re = PT.re, im = PT.im;
    re[1] = 1; im[1] = 0;
    for (let k = 2; k <= K; k++) {
      const p = P[k];
      if (p === k) { const L = Math.log(k), m = Math.exp(-w.re * L), t = -w.im * L; re[k] = m * Math.cos(t); im[k] = m * Math.sin(t); } else {
        const j = k / p;
        re[k] = re[p] * re[j] - im[p] * im[j]; im[k] = re[p] * im[j] + im[p] * re[j];
      }
    }
    return PT;
  }
  // the form of the coefficients a (a_k for k = lo, lo + 1, …): from some K0 on, a_k = b_{(k − K0) mod q} k^p, with a period
  // q ≤ DIR_Q and a real power p (1, 1/n², (−1)^n, i^n, n² cos(πn/2) and the characters), checked to 1e-11 over the
  // second half of a at least, and at most DIR_HEAD other terms before K0. {q, p, b, B, K0, lo, head} (head: a_k k^{−p}
  // for k < K0; B = Σ b_r, exactly 0 when it vanishes to rounding: the series then converges for Re s > p, else for
  // Re s > p + 1), or null
  const DIR_Q = 24, DIR_HEAD = 64;
  function dirichletForm(lo, a) {
    const n = a.length, jE = n - 1;
    if (n < 64) return null;
    const make = (q, p, b, jH) => {
      let B = ZERO, m = 0;
      for (const x of b) { B = add(B, x); m += abs(x); }
      if (abs(B) <= 1e-12 * m) B = ZERO;
      return { q, p, b, B, K0: lo + jH, lo, head: a.slice(0, jH).map((x, i) => scale(x, Math.pow(lo + i, -p))) };
    };
    // (coefficients that end in zeros: a Dirichlet polynomial)
    let last = jE;
    while (last >= 0 && isZero(a[last])) last--;
    if (last < n / 2) return last < DIR_HEAD ? make(1, 0, [ZERO], last + 1) : null;
    for (let q = 1; q <= DIR_Q; q++) {
      // p from two terms of one residue: the largest in the last period and the one about half the terms before it
      let j1 = jE;
      for (let j = jE - 1; j > jE - q; j--) if (abs(a[j]) > abs(a[j1])) j1 = j;
      const j0 = j1 - q * Math.floor(n / 2 / q);
      let p = Math.log(abs(a[j1]) / abs(a[j0])) / Math.log((lo + j1) / (lo + j0));
      if (!Number.isFinite(p)) continue;
      if (Math.abs(p - Math.round(2 * p) / 2) < 1e-9) p = Math.round(2 * p) / 2;
      // b by the residue of the index j = k − lo (K0 − lo is a multiple of q)
      const b = [];
      let bm = 0;
      for (let j = jE - q + 1; j <= jE; j++) { b[j % q] = scale(a[j], Math.pow(lo + j, -p)); bm = Math.max(bm, abs(b[j % q])); }
      // (to 1e-11 of the term, or 1e-12 of the sequence's size there: sin(πn/2) is 1e-13, not 0, at large even n)
      const near = (x, k) => { const kp = Math.pow(k, p), y = scale(b[(k - lo) % q], kp); return Math.hypot(x.re - y.re, x.im - y.im) <= 1e-11 * Math.max(abs(x), abs(y)) + 1e-12 * bm * kp; };
      let j = jE;
      while (j >= 0 && near(a[j], lo + j)) j--;
      const jH = Math.ceil((j + 1) / q) * q;
      // (b again from the first period kept: the formula's values are most exact at small n, as (−1)^n, an exp past n = 1100)
      if (jH <= DIR_HEAD && jH <= n / 2) return make(q, p, b.map((x, r) => scale(a[jH + r], Math.pow(lo + jH + r, -p))), jH);
    }
    return null;
  }
  // (e^u − 1)/u, accurate near u = 0
  function expm1Over(u) {
    if (u.re === 0 && u.im === 0) return ONE;
    const em = Math.expm1(u.re), h = Math.sin(u.im / 2);
    return div(C(em * Math.cos(u.im) - 2 * h * h, (em + 1) * Math.sin(u.im)), u);
  }
  // Σ_{k ≥ lo} a_k k^{−s} for coefficients of that form, where it converges (Re w > 1, or > 0 when B = 0; w = s − p):
  // {S, A} (A: the sum of the sizes of what was added, for the cancellation test). Per residue r, Σ_{m ≥ N} (X_r + qm)^{−w}
  // by Euler–Maclaurin in m, as zetaEM: X^{−w} (X/(q(w − 1)) + ½ + Σ_{j≤M} B₂ⱼ/(2j)! P_j (q/X)^{2j−1}), X = K0 + r + qN,
  // P_j = w(w+1)…(w+2j−2), N = |Im w| + 15. The poles X_r^{1−w}/(q(w − 1)) are summed as
  // X_0^{1−w} (B/(w − 1) − Σ b_r d_r (e^{(1−w)d_r} − 1)/((1−w)d_r))/q, d_r = log(X_r/X_0), so they cancel exactly when
  // B = 0 (η, characters): no 0/0 at w = 1
  function dirichletEM(F, s) {
    const w = sub(s, C(F.p, 0)), q = F.q, b = F.b, K0 = F.K0, nb = b.every(isZero);
    const N = Math.ceil(Math.abs(w.im)) + 15, X0 = K0 + q * N, K = nb ? K0 : X0 + q - 1;
    const { re, im } = powTable(w, K);
    let Sr = 0, Si = 0, A = 0;
    F.head.forEach((h, i) => { const k = F.lo + i, tr = h.re * re[k] - h.im * im[k], ti = h.re * im[k] + h.im * re[k]; Sr += tr; Si += ti; A += Math.hypot(tr, ti); });
    if (nb) return { S: C(Sr, Si), A };
    for (let k = K0, r = 0; k < X0; k++, r = r + 1 === q ? 0 : r + 1) {
      const x = b[r], tr = x.re * re[k] - x.im * im[k], ti = x.re * im[k] + x.im * re[k];
      Sr += tr; Si += ti; A += Math.hypot(tr, ti);
    }
    // P_j, then per residue the bracket ½ + Σ c_j P_j h^{2j−1} (h = q/X) by Horner in h²
    const P = [w];
    for (let j = 1; j < EM_C.length; j++) P.push(mul(P[j - 1], mul(add(w, C(2 * j - 1, 0)), add(w, C(2 * j, 0)))));
    const w1 = sub(w, ONE), u0 = neg(w1);
    let pole = isZero(F.B) ? ZERO : div(F.B, w1);
    for (let r = 0; r < q; r++) {
      if (isZero(b[r])) continue;
      const X = X0 + r, h = q / X, h2 = h * h;
      let br = ZERO;
      for (let j = EM_C.length - 1; j >= 0; j--) br = add(scale(br, h2), scale(P[j], EM_C[j]));
      br = add(scale(br, h), C(0.5, 0));
      const t = mul(b[r], mul(C(re[X], im[X]), br));
      Sr += t.re; Si += t.im; A += abs(t);
      if (r) { const d = Math.log1p(r / X0); pole = sub(pole, scale(mul(b[r], expm1Over(scale(u0, d))), d)); }
    }
    pole = scale(mul(pole, C(re[X0], im[X0])), X0 / q);
    return { S: C(Sr + pole.re, Si + pole.im), A: A + abs(pole) };
  }
  // Σ a_k k^{−s} over the coefficients a (from k = lo) for coefficients of no such form, absolutely convergent for
  // Re s > σ: s ↦ {S, A} summed until the rest, at most G k^{σ−Re s}/(Re s − σ) with G the largest |a_j| j^{1−σ} past
  // k (past a: that of its last 64), is below tol of the sum; null when it is still above end of it after all of a
  function dirichletPartial(lo, a, sigma, tol, end) {
    const n = a.length, K = lo + n - 1, G = new Float64Array(n + 1);
    G[n] = Math.max(...a.slice(-64).map((x, j) => abs(x) * Math.pow(K - 63 + j, 1 - sigma)));
    for (let j = n - 1; j >= 0; j--) G[j] = Math.max(G[j + 1], abs(a[j]) * Math.pow(lo + j, 1 - sigma));
    return (s) => {
      const { re, im } = powTable(s, K), sp = s.re - sigma;
      let Sr = 0, Si = 0, A = 0;
      for (let j = 0; j < n; j++) {
        const x = a[j], k = lo + j;
        if (x.re === 0 && x.im === 0) continue;
        const tr = x.re * re[k] - x.im * im[k], ti = x.re * im[k] + x.im * re[k];
        Sr += tr; Si += ti; A += Math.hypot(tr, ti);
        if (j >= 8 && (j & 7) === 0 && G[j + 1] * Math.pow(k, -sp) / sp <= tol * Math.hypot(Sr, Si)) break;
        if (j === n - 1 && !(G[n] * Math.pow(k, -sp) / sp <= end * Math.hypot(Sr, Si))) return null;
      }
      return { S: C(Sr, Si), A };
    };
  }
  // Möbius matrices [a,b,c,d] and the one-parameter path A^t (A normalised to SL2).
  // The same map scaled by a power of two (exact), so that its largest entry has magnitude about 1.
  function mobScaled(m) {
    const mx = Math.max(...m.map((x) => Math.max(Math.abs(x.re), Math.abs(x.im))));
    if (!(mx > 0) || !Number.isFinite(mx)) return m;
    const s = 2 ** -Math.round(Math.log2(mx));
    return s === 1 || !(s > 0) || !Number.isFinite(s) ? m : m.map((x) => scale(x, s));
  }
  // Scale-invariant size of ad − bc: |ad − bc| / (|a||d| + |b||c|), 0 when both products vanish.
  // A matrix is treated as invertible (a Möbius map) only when this is at least MOB_EPS.
  const MOB_EPS = 1e-9;
  function mobRel(m) {
    const [a, b, c, d] = mobScaled(m);
    const s = abs(a) * abs(d) + abs(b) * abs(c);
    if (!(s > 0) || !Number.isFinite(s)) return 0;
    const r = abs(sub(mul(a, d), mul(b, c))) / s;
    return Number.isFinite(r) ? r : 0;
  }
  // Exact test of ad − bc = 0 for the given doubles (error-free products and an exact expansion sum).
  // false when that cannot be decided exactly (underflow), so a caller never calls a nonconstant map constant.
  function twoSum(x, y) { const s = x + y, bb = s - x; return [s, (x - (s - bb)) + (y - bb)]; }
  function split(x) { const c = 134217729 * x, hi = c - (c - x); return [hi, x - hi]; }
  function twoProd(x, y) {
    const p = x * y, [xh, xl] = split(x), [yh, yl] = split(y);
    return [p, xl * yl - (((p - xh * yh) - xl * yh) - xh * yl)];
  }
  function sumIsZero(xs) {
    let e = [];
    for (const x of xs) {
      let q = x;
      const h = [];
      for (const c of e) { const [s, r] = twoSum(q, c); if (r !== 0) h.push(r); q = s; }
      if (q !== 0) h.push(q);
      e = h;
    }
    return e.length === 0;
  }
  function mobDetZero(m) {
    const [a, b, c, d] = mobScaled(m);
    const terms = [[a.re, d.re, 1, 0], [a.im, d.im, -1, 0], [b.re, c.re, -1, 0], [b.im, c.im, 1, 0],
      [a.re, d.im, 1, 1], [a.im, d.re, 1, 1], [b.re, c.im, -1, 1], [b.im, c.re, -1, 1]];
    const parts = [[], []];
    for (const [x, y, sg, k] of terms) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      if (x === 0 || y === 0) continue;
      const [p, r] = twoProd(x, y);
      if (Math.abs(p) < 1e-290 || !Number.isFinite(p)) return false;
      parts[k].push(sg * p, sg * r);
    }
    return sumIsZero(parts[0]) && sumIsZero(parts[1]);
  }
  function mobApply(m, z) {
    const num = add(mul(m[0], z), m[1]);
    const den = add(mul(m[2], z), m[3]);
    return div(num, den);
  }
  function mobPath(m) {
    if (!(mobRel(m) >= MOB_EPS)) return null;
    let [a, b, c, d] = mobScaled(m);
    const det = sub(mul(a, d), mul(b, c));
    const s = sqrt(det);
    a = div(a, s); b = div(b, s); c = div(c, s); d = div(d, s);
    let tr = add(a, d);
    if (tr.re < 0 || (tr.re === 0 && tr.im < 0)) { a = neg(a); b = neg(b); c = neg(c); d = neg(d); tr = neg(tr); }
    const half = scale(tr, 0.5);
    const N = [sub(a, half), b, c, sub(d, half)];
    if (abs(sub(half, ONE)) < 1e-9) {
      // parabolic (or identity): A^t = I + tN
      return (t) => [add(ONE, scale(N[0], t)), scale(N[1], t), scale(N[2], t), add(ONE, scale(N[3], t))];
    }
    const lam = acosh(half);
    const sh = sinh(lam);
    const J = N.map((x) => div(x, sh));
    return (t) => {
      const ch = cosh(scale(lam, t)), st = sinh(scale(lam, t));
      return [add(ch, mul(st, J[0])), mul(st, J[1]), mul(st, J[2]), add(ch, mul(st, J[3]))];
    };
  }

  // Polynomial helpers: coefficient arrays from highest degree to constant.
  function polyEval(co, z) {
    let r = C(0, 0);
    for (let i = 0; i < co.length; i++) r = add(mul(r, z), co[i]);
    return r;
  }
  function polyTrim(co) {
    let i = 0;
    while (i < co.length - 1 && isZero(co[i])) i++;
    return co.slice(i);
  }
  // Durand–Kerner roots
  function polyRoots(co) {
    co = polyTrim(co);
    const n = co.length - 1;
    if (n < 1) return [];
    const lead = co[0];
    const mono = co.map((c) => div(c, lead));
    let roots = [];
    const seed = C(0.4, 0.9);
    let p = C(1, 0);
    for (let i = 0; i < n; i++) { roots.push(p); p = mul(p, seed); }
    // scale by Cauchy bound
    let R = 1;
    for (let i = 1; i <= n; i++) R = Math.max(R, 1 + abs(mono[i]));
    roots = roots.map((r) => scale(r, R * 0.5));
    for (let it = 0; it < 500; it++) {
      let delta = 0;
      for (let i = 0; i < n; i++) {
        let den = C(1, 0);
        for (let j = 0; j < n; j++) if (j !== i) den = mul(den, sub(roots[i], roots[j]));
        const step = div(polyEval(mono, roots[i]), den);
        if (isFin(step)) { roots[i] = sub(roots[i], step); delta = Math.max(delta, abs(step)); }
      }
      if (delta < 1e-14) break;
    }
    return roots;
  }

  // Formatting. fmtNum is for display text: 4 decimals (trailing zeros dropped) when 1e-3 <= |x| < 1e4,
  // otherwise 1.23×10⁴ with a superscript exponent, never 'e'. The sign stays ASCII '-' (callers that show it
  // turn it into U+2212). fmt and fmtExact write text that goes back into inputs and that Expr parses back.
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const fixed = (x, digits) => { const s = x.toFixed(digits).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
  // [mantissa, exponent] with trailing zeros of the mantissa dropped
  function sci(x, decimals) {
    const [m, e] = x.toExponential(decimals).split('e');
    return [m.includes('.') ? m.replace(/\.?0+$/, '') : m, +e];
  }
  function fmtNum(x, digits = 4) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '-∞' : 'NaN');
    if (Math.abs(x) < 1e-12) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e4 || ax < 1e-3) {
      const [m, e] = sci(x, Math.max(2, digits - 2));
      return `${m}×10${String(e).split('').map((ch) => (ch === '-' ? '⁻' : SUP[+ch])).join('')}`;
    }
    return fixed(x, digits);
  }
  // parseable plain text, rounded to `digits` decimals (an 'e' exponent outside [1e-4, 1e15))
  function numIn(x, digits = 4) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '-∞' : 'NaN');
    if (Math.abs(x) < 1e-12) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e15 || ax < 1e-4) { const [m, e] = sci(x, Math.max(1, digits - 1)); return `${m}e${e}`; }
    return fixed(x, digits);
  }
  // shortest text that Expr parses back to exactly x: the round-trip decimal, or a small fraction p/q
  // when that decimal is long (1/3 rather than 0.3333333333333333)
  function numExact(x) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : (x < 0 ? '-∞' : 'NaN');
    if (x === 0) return '0';
    const s = String(x).replace('e+', 'e');
    const sig = s.replace(/^-/, '').split('e')[0].replace('.', '').replace(/^0+/, '').length;
    const ax = Math.abs(x);
    if (sig > 10 && ax >= 1e-6 && ax < 1e9) {
      // continued-fraction convergents h/k of |x| with k <= 10000
      let h0 = 1, h1 = 0, k0 = 0, k1 = 1, y = ax;
      for (let i = 0; i < 40; i++) {
        const q = Math.floor(y);
        [h0, h1] = [q * h0 + h1, h0];
        [k0, k1] = [q * k0 + k1, k0];
        if (k0 > 10000) break;
        if (h0 / k0 === ax) return `${x < 0 ? '-' : ''}${h0}/${k0}`;
        const fr = y - q;
        if (!(fr > 0)) break;
        y = 1 / fr;
      }
    }
    return s;
  }
  function cxText(a, num) {
    if (!isFin(a)) return '∞';
    const re = num(a.re), im = num(a.im);
    if (im === '0') return re;
    let imAbs = num(Math.abs(a.im));
    if (imAbs.includes('/')) imAbs = `(${imAbs})`;
    const imStr = (imAbs === '1' ? '' : imAbs) + 'i';
    if (re === '0') return (a.im < 0 ? '-' : '') + imStr;
    return re + (a.im < 0 ? ' - ' : ' + ') + imStr;
  }
  const fmtExact = (a) => cxText(a, numExact);
  function fmt(a, digits = 4) {
    if (!isFin(a)) return '∞';
    const re = numIn(a.re, digits), im = numIn(a.im, digits);
    if (im === '0') return re;
    const imAbs = numIn(Math.abs(a.im), digits);
    const imStr = (imAbs === '1' ? '' : imAbs) + 'i';
    if (re === '0') return (a.im < 0 ? '-' : '') + imStr;
    return re + (a.im < 0 ? ' - ' : ' + ') + imStr;
  }
  // LaTeX for a real number: decimals when 1e-4 <= |x| < 1e5, otherwise m\times 10^{n} (which Expr parses back)
  // EXACT: constants are written so they parse back to the same double (used when copying LaTeX)
  let EXACT = false;
  function setTexExact(on) { EXACT = !!on; }
  // the decimal comma of Russian and Italian print (0{,}5, I18N.texNum); copied LaTeX (EXACT) and English keep the point
  const dec = (s) => (I18N.comma() ? I18N.texNum(s) : s);
  function texNum(x, digits = 4) {
    if (!Number.isFinite(x)) return x > 0 ? '\\infty' : (x < 0 ? '-\\infty' : '\\text{NaN}');
    if (EXACT) {
      const t = numExact(x);
      if (t.includes('/')) { const [p, q] = t.replace('-', '').split('/'); return `${x < 0 ? '-' : ''}\\frac{${p}}{${q}}`; }
      if (t.includes('e')) { const [m, e] = t.split('e'); return `${m}\\times 10^{${+e}}`; }
      return t;
    }
    if (Math.abs(x) < 1e-12) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e5 || ax < 1e-4) { const [m, e] = sci(x, Math.max(1, digits - 2)); return `${dec(m)}\\times 10^{${e}}`; }
    return dec(fixed(x, digits));
  }
  // LaTeX for a complex constant; wrap: whether to parenthesise sums
  function tex(a, digits = 4) {
    if (!isFin(a)) return '\\infty';
    const near = (x, v) => (EXACT ? x === v : Math.abs(x - v) < 1e-12);
    const real = (x) => {
      if (near(x, Math.PI)) return '\\pi';
      if (near(x, -Math.PI)) return '-\\pi';
      if (near(x, Math.PI / 2)) return '\\tfrac{\\pi}{2}';
      if (near(x, -Math.PI / 2)) return '-\\tfrac{\\pi}{2}';
      return texNum(x, digits);
    };
    const re = real(a.re), imv = Math.abs(a.im);
    if (texNum(a.im, digits) === '0') return re;
    let ims = real(imv);
    // a command name must not run into the i (\pi i, not the undefined \pii)
    ims = ims === '1' ? 'i' : ims + (/[A-Za-z]$/.test(ims) ? ' i' : 'i');
    if (re === '0') return (a.im < 0 ? '-' : '') + ims;
    return re + (a.im < 0 ? '-' : '+') + ims;
  }

  return {
    setTexExact,
    TAU, C, ZERO, ONE, I, INF, add, sub, neg, mul, div, inv, scale, conj, abs, abs2, arg, isFin, eq, isZero,
    exp, log, argCut, pow, powReal, ipow, sqrt, sin, cos, tan, sinh, cosh, tanh, asin, acos, atan, asinh, acosh, atanh, ijouk, lgamma, gamma, fact, binom, digamma, zeta, zetaDeriv, ZETA_MAX, dirichletForm, dirichletEM, dirichletPartial, powTable, DIR_Q, DIR_HEAD,
    mobApply, mobPath, mobScaled, mobRel, mobDetZero, MOB_EPS, polyEval, polyTrim, polyRoots, fmtNum, fmt, fmtExact, numExact, texNum, tex,
  };
})();
if (typeof module !== 'undefined') module.exports = CX;

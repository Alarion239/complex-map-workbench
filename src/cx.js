'use strict';
// The interface strings: $t, $tx, $tn and I18N come from i18n.js, first in the build. A node test that loads cx.js
// without it gets them here: require('./i18n.js'), or, in a vm context without require, this English-only stub
// (the same placeholder rule as i18n.js; English is the identity, notes/i18n/DESIGN.md 1).
if (typeof I18N === 'undefined' && typeof globalThis !== 'undefined' && typeof globalThis.$t !== 'function') {
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
    const I18N = { lang: 'en', t: $t, tx: $tx, tn: $tn, fill, num: (n) => String(n), fnName: (n) => n, notation: (s) => s, texNum: (x) => String(x) };
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
  function argCut(a, theta = Math.PI) {
    let t = Math.atan2(a.im, a.re);
    if (theta !== Math.PI) t -= TAU * Math.ceil((t - theta) / TAU);
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
  // the decimal comma of Russian print (0{,}5, I18N.texNum); copied LaTeX (EXACT) and English keep the point
  const dec = (s) => (I18N.lang === 'ru' ? I18N.texNum(s) : s);
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
    exp, log, argCut, pow, powReal, ipow, sqrt, sin, cos, tan, sinh, cosh, tanh, asin, acos, atan, asinh, acosh, atanh, ijouk,
    mobApply, mobPath, mobScaled, mobRel, mobDetZero, MOB_EPS, polyEval, polyTrim, polyRoots, fmtNum, fmt, fmtExact, numExact, texNum, tex,
  };
})();
if (typeof module !== 'undefined') module.exports = CX;

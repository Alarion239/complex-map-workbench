'use strict';
// The SIN family base asin(w) = -i log(iw + sqrt(1 - w^2)) (CX.asin, the op table's definition) in float32, as a
// GLSL port would evaluate it, vs the cancellation-free form; error of the base in z units and as w = sin(z) error.
const T = require('./truth.js');
const f = Math.fround;
const c32 = (re, im) => ({ re: f(re), im: f(im) });
const mul = (a, b) => c32(f(a.re * b.re) - f(a.im * b.im), f(a.re * b.im) + f(a.im * b.re));
const sqrt32 = (a) => { const r = f(Math.hypot(a.re, a.im)); if (r === 0) return c32(0, 0); if (a.re >= 0) { const t = f(Math.sqrt(f(0.5 * f(r + a.re)))); return c32(t, f(a.im / f(2 * t))); } const t = f(Math.sqrt(f(0.5 * f(r - a.re)))); return c32(f(Math.abs(a.im) / f(2 * t)), a.im >= 0 ? t : -t); };
const log32 = (a) => c32(f(Math.log(f(Math.hypot(a.re, a.im)))), f(Math.atan2(a.im, a.re)));
function asin32(w, stable) {
  const s = sqrt32(c32(1 - f(f(w.re * w.re) - f(w.im * w.im)), -f(2 * f(w.re * w.im)))), iw = c32(-w.im, w.re);
  const t1 = c32(f(iw.re + s.re), f(iw.im + s.im)), t2 = c32(f(s.re - iw.re), f(s.im - iw.im));
  const l = !stable || Math.hypot(t1.re, t1.im) >= Math.hypot(t2.re, t2.im) ? log32(t1) : (() => { const q = log32(t2); return c32(-q.re, -q.im); })();
  return c32(l.im, -l.re);
}
for (const mag of [3, 10, 30, 100, 300, 1000]) {
  let worst = 0, worstS = 0, wrel = 0;
  for (let k = 0; k < 720; k++) {
    const th = Math.PI * k / 360, w = c32(mag * Math.cos(th), mag * Math.sin(th));
    const exact = T.asinA(w);
    const a = asin32(w, false), b = asin32(w, true);
    const e = Math.hypot(a.re - exact.re, a.im - exact.im), eS = Math.hypot(b.re - exact.re, b.im - exact.im);
    worst = Math.max(worst, e); worstS = Math.max(worstS, eS);
    const sw = CX.sin(a); wrel = Math.max(wrel, Math.hypot(sw.re - w.re, sw.im - w.im) / mag);
  }
  console.log(`|w| = ${String(mag).padStart(4)}: float32 asin base error up to ${worst.toExponential(1)} (sin(base) off by ${(100 * wrel).toFixed(2)} % of |w|); stable form ${worstS.toExponential(1)}`);
}

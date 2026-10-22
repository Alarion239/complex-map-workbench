'use strict';
// Shared pieces of the inverse-first prototype: the app's own CX/Funcs (forward maps, exactly as the app evaluates
// them), a pluggable complex arithmetic (float64, or float32 emulated by rounding every operation), the cases with
// their views and their EXACT image (independent closed forms), the sheet-ordering key D, PNG output.
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
global.CX = require(path.join(ROOT, 'src/cx.js'));
global.Expr = require(path.join(ROOT, 'src/parse.js'));
global.Funcs = require(path.join(ROOT, 'src/funcs.js'));
const PNG = require(path.join(ROOT, 'test/regress/quality/pngio.js'));

const PI = Math.PI, TAU = 2 * PI;

// ---------- complex arithmetic with a rounding function R (identity: float64; Math.fround: float32 emulation) ----------
function arith(R) {
  const C = (re, im = 0) => ({ re: R(re), im: R(im) });
  const add = (a, b) => C(a.re + b.re, a.im + b.im);
  const sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(R(a.re * b.re) - R(a.im * b.im), R(a.re * b.im) + R(a.im * b.re));
  const scale = (a, s) => C(a.re * s, a.im * s);
  function div(a, b) {
    if (b.re === 0 && b.im === 0) return C(a.re === 0 && a.im === 0 ? NaN : Infinity, Infinity);
    if (Math.abs(b.re) >= Math.abs(b.im)) { const r = R(b.im / b.re), d = R(b.re + R(b.im * r)); return C(R(a.re + R(a.im * r)) / d, R(a.im - R(a.re * r)) / d); }
    const r = R(b.re / b.im), d = R(R(b.re * r) + b.im); return C(R(R(a.re * r) + a.im) / d, R(R(a.im * r) - a.re) / d);
  }
  const abs = (a) => R(Math.hypot(a.re, a.im));
  const arg = (a) => R(Math.atan2(a.im, a.re));
  const exp = (a) => { const e = R(Math.exp(a.re)); return a.im === 0 ? C(e, 0) : C(e * R(Math.cos(a.im)), e * R(Math.sin(a.im))); };
  const log = (a) => C(Math.log(abs(a)), arg(a));
  function sqrt(a) {
    const r = abs(a); if (r === 0) return C(0, 0);
    if (a.re >= 0) { const t = R(Math.sqrt(R(0.5 * R(r + a.re)))); return C(t, a.im / R(2 * t)); }
    const t = R(Math.sqrt(R(0.5 * R(r - a.re)))); return C(Math.abs(a.im) / R(2 * t), a.im >= 0 ? t : -t);
  }
  const sin = (a) => C(R(Math.sin(a.re)) * R(Math.cosh(a.im)), R(Math.cos(a.re)) * R(Math.sinh(a.im)));
  const cos = (a) => C(R(Math.cos(a.re)) * R(Math.cosh(a.im)), -R(Math.sin(a.re)) * R(Math.sinh(a.im)));
  // principal arcsin, evaluated in the lower half-plane like the GPU's casin (no cancellation in iz + sqrt(1 - z^2))
  function asin0(a) { const s = sqrt(sub(C(1, 0), mul(a, a))); const l = log(add(C(-a.im, a.re), s)); return C(l.im, -l.re); }
  const asin = (a) => (a.im > 0 ? scale(asin0(scale(a, -1)), -1) : asin0(a));
  function ipow(a, n) { let r = C(1, 0), b = a, m = Math.abs(n); while (m > 0) { if (m % 2 === 1) r = mul(r, b); b = mul(b, b); m = Math.floor(m / 2); } return n < 0 ? div(C(1, 0), r) : r; }
  return { R, C, add, sub, mul, scale, div, abs, arg, exp, log, sqrt, sin, cos, asin, ipow };
}
const A64 = arith((x) => x), A32 = arith(Math.fround);

// ---------- regions: level (positive inside, |grad| = 1 near the boundary), level at infinity (sign only) ----------
const REG = {
  H: { desc: 'Im z > 0', level: (z) => z.im, inf: 0, lam: (L) => Math.sin(L.im), bbox: { x0: -Infinity, x1: Infinity, y0: 0, y1: Infinity } },          // lam: sign/shape of the level for z = e^L, |z| huge
  strip: { desc: '|Im z| < pi/2', level: (z) => PI / 2 - Math.abs(z.im), inf: 0, bbox: { x0: -Infinity, x1: Infinity, y0: -PI / 2, y1: PI / 2 } },
  disc1: { desc: '|z| < 1', level: (z) => 1 - Math.hypot(z.re, z.im), inf: -1 },
  ext1: { desc: '|z| > 1', level: (z) => Math.hypot(z.re, z.im) - 1, inf: 1 },
  Q1: { desc: 'quadrant', level: (z) => Math.min(z.re, z.im), inf: 0 },
  slit: { desc: '|z| > 0', level: (z) => Math.hypot(z.re, z.im), inf: 1 },
  halfstrip: { desc: '|Re z| < pi/2, Im z > 0', level: (z) => Math.min(PI / 2 - Math.abs(z.re), z.im), inf: 0, bbox: { x0: -PI / 2, x1: PI / 2, y0: 0, y1: Infinity } },
};

// ---------- steps: forward (the app's CX, float64) ----------
function fwdStep(s) {
  switch (s.type) {
    case 'powa': return (z) => CX.pow(z, s.alpha, s.cut, s.k);
    case 'log': return (z) => CX.log(z, s.cut, s.k);
    case 'exp': return CX.exp;
    case 'recip': return CX.inv;
    case 'mobius': return (z) => CX.mobApply(s.m, z);
    case 'pown': return (z) => CX.ipow(z, s.n);
    case 'root': return (z) => CX.powReal(z, 1 / s.n, s.cut, s.k);
    case 'sin': return CX.sin;
  }
  throw new Error(s.type);
}
const chainF = (steps) => { const fs = steps.map(fwdStep); return (z) => { for (const f of fs) z = f(z); return z; }; };
// value of the chain AT a special point of the source sphere (0 or infinity): 'undef' (no limit), 'inf', or a value.
// (the app would derive this per step from a declared singularity table; here it is given per case)

// ---------- the cases ----------
const C = (re, im = 0) => ({ re, im });
const I = C(0, 1);
const W = 410, Hh = 516;   // the right (and left) pane at 1440x900, dpr 1 (as test/regress/quality)
const CASES = {
  zi_H: {
    note: 'z^i, H (principal, cut 180)', steps: [{ type: 'powa', alpha: C(0, 1), cut: PI, k: 0 }], region: 'H',
    src: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 186 }, sing: [C(0, 0)],
    special: { zero: 'undef', inf: 'undef' },
    truth: (w) => { const r = Math.hypot(w.re, w.im); return r > Math.exp(-PI) && r < 1; },
    // polar checker parity of every preimage (all sheets agree): ln r = arg w + 2 pi m, theta = -ln|w|
    parity: (w) => { const g = [Math.atan2(w.im, w.re) * 16 / TAU, -Math.log(Math.hypot(w.re, w.im)) * 16 / TAU]; return (((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2; },
    parityEdge: (w, s) => { // distance (px) to the nearest polar cell edge in the image
      const r = Math.hypot(w.re, w.im), a = Math.atan2(w.im, w.re) * 16 / TAU, l = -Math.log(r) * 16 / TAU;
      const da = Math.abs(a - Math.round(a)) * TAU / 16 * r * s, dl = Math.abs(l - Math.round(l)) * TAU / 16 * r * s;
      return Math.min(da, dl);
    },
    mult: 'infinite',
  },
  logH: {
    note: 'log, H', steps: [{ type: 'log', cut: PI, k: 0 }], region: 'H',
    src: { cx: 0, cy: 1, s: 60 }, view: { cx: -0.18, cy: PI / 2, s: 97 }, sing: [C(0, 0)],
    special: { zero: 'inf', inf: 'inf' },
    truth: (w) => w.im > 0 && w.im < PI, mult: 'one',
  },
  expH: {
    note: 'exp, H', steps: [{ type: 'exp' }], region: 'H',
    src: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 60 }, sing: [],
    special: { zero: 1, inf: 'undef' },
    truth: (w) => !(w.re === 0 && w.im === 0), mult: 'infinite',
  },
  e1z_disc: {
    note: 'e^{1/z}, |z| < 1', steps: [{ type: 'recip' }, { type: 'exp' }], region: 'disc1',
    src: { cx: 0, cy: 0, s: 120 }, view: { cx: 0, cy: 0, s: 60 }, sing: [C(0, 0)],
    special: { zero: 'undef', inf: 1 },
    truth: (w) => !(w.re === 0 && w.im === 0), mult: 'infinite',
  },
  exp_strip: {
    note: 'exp, |Im z| < pi/2', steps: [{ type: 'exp' }], region: 'strip',
    src: { cx: 0, cy: 0, s: 52 }, view: { cx: 2, cy: 0, s: 40 }, sing: [],
    special: { zero: 1, inf: 'undef' },
    truth: (w) => w.re > 0, mult: 'one',
  },
  cayley_H: {
    note: 'Cayley (z-i)/(z+i), H', steps: [{ type: 'mobius', m: [C(1), C(0, -1), C(1), C(0, 1)] }], region: 'H',
    src: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 }, sing: [],
    special: { zero: null, inf: C(1, 0) },
    truth: (w) => Math.hypot(w.re, w.im) < 1, mult: 'one',
  },
  // further acceptance cases (inverse path only in this prototype)
  sq_Q1: {
    note: 'z^2, quadrant', steps: [{ type: 'pown', n: 2 }], region: 'Q1', src: { cx: 0.6, cy: 0.6, s: 70 }, view: { cx: 0, cy: 2, s: 60 }, sing: [],
    special: { zero: C(0), inf: 'inf' }, truth: (w) => w.im > 0, mult: 'one',
  },
  sin_halfstrip: {
    note: 'sin, half-strip', steps: [{ type: 'sin' }], region: 'halfstrip', src: { cx: 0, cy: 1.25, s: 105 }, view: { cx: 0, cy: 2, s: 50 }, sing: [],
    special: { zero: C(0), inf: 'undef' }, truth: (w) => w.im > 0, mult: 'one',
  },
  recip_ext: {
    note: '1/z, |z| > 1', steps: [{ type: 'recip' }], region: 'ext1', src: { cx: 0, cy: 0, s: 60 }, view: { cx: 0, cy: 0, s: 180 }, sing: [],
    special: { zero: 'inf', inf: C(0) }, truth: (w) => { const r = Math.hypot(w.re, w.im); return r > 0 && r < 1; }, mult: 'one',
  },
  sqrt_slit: {
    note: 'sqrt, slit plane', steps: [{ type: 'root', n: 2, cut: PI, k: 0 }], region: 'slit', src: { cx: 0, cy: 0, s: 70 }, view: { cx: 1, cy: 0, s: 120 }, sing: [],
    special: { zero: C(0), inf: 'inf' }, truth: (w) => w.re > 0, mult: 'one',
  },
};
// view variants: default, zoomed out 4x / 16x, deep zooms on special image points
function viewOf(cs, variant) {
  const v = Object.assign({}, cs.view);
  if (variant === 'out4') v.s /= 4;
  if (variant === 'out16') v.s /= 16;
  if (variant === 'zoom1') { v.cx = 1; v.cy = 0; v.s *= 64; }      // Cayley: the image of infinity
  if (variant === 'zoom0') { v.cx = 0; v.cy = 0; v.s *= 128; }     // 1/z: the image of infinity
  return v;
}
// pixel centre (i, j) -> world point of a view (y up)
const pix = (v, i, j) => C(v.cx + (i + 0.5 - W / 2) / v.s, v.cy - (j + 0.5 - Hh / 2) / v.s);
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - Hh / 2 / v.s, y1: v.cy + Hh / 2 / v.s });

// ---------- the sheet-ordering key D(z) (design section 5): ln(1 + dist(z, source window)/R) + sum over undefined
// points p near the window of max(0, ln(r_s / |z - p|)) + 1e-3 |z - c| / R. lam: log z when known (huge |z|). ----------
function keyFn(cs) {
  const b = boxOf(cs.src), c = C(cs.src.cx, cs.src.cy), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2;
  const rs = R / 8;
  const sing = cs.sing.filter((p) => Math.max(b.x0 - p.re, p.re - b.x1, b.y0 - p.im, p.im - b.y1, 0) < 2 * R);
  return (z, lam) => {
    let dbox;
    if (lam && lam.re > 600) dbox = lam.re - Math.log(R);
    else if (lam && lam.re < -600) dbox = Math.log(1 + Math.hypot(c.re, c.im) / R);
    else {
      const dx = Math.max(b.x0 - z.re, 0, z.re - b.x1), dy = Math.max(b.y0 - z.im, 0, z.im - b.y1);
      dbox = Math.log1p(Math.hypot(dx, dy) / R);
    }
    let ds = 0;
    for (const p of sing) {
      const d = lam && p.re === 0 && p.im === 0 ? lam.re : Math.log(Math.hypot(z.re - p.re, z.im - p.im));
      ds += Math.max(0, Math.log(rs) - d);
    }
    const dc = lam && Math.abs(lam.re) > 600 ? 0 : Math.hypot(z.re - c.re, z.im - c.im) / R;
    return dbox + ds + 1e-3 * Math.min(dc, 1e6);
  };
}

function writePNG(file, w, h, rgba) { require('fs').writeFileSync(file, PNG.encode(w, h, rgba)); }

module.exports = { PI, TAU, arith, A64, A32, REG, fwdStep, chainF, CASES, viewOf, pix, boxOf, keyFn, W, H: Hh, C, writePNG };

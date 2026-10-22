'use strict';
// Independent review helpers for P1 (src/inverse.js). Uses only the app's own modules (CX, Expr, Funcs, Region) and
// the public Inverse API under test; no code from walk.js or the builder's tests.
const path = require('path');
const SRC = path.resolve(__dirname, '../../../src');
global.CX = require(path.join(SRC, 'cx.js'));
global.Expr = require(path.join(SRC, 'parse.js'));
global.Funcs = require(path.join(SRC, 'funcs.js'));
global.Region = require(path.join(SRC, 'region.js'));
const Inverse = require(path.join(SRC, 'inverse.js'));
const C = CX.C;
const PI = Math.PI, TAU = 2 * PI;

let seed = 1;
const setSeed = (s) => { seed = s >>> 0 || 1; };
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const ru = (a, b) => a + (b - a) * rnd();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const cs = (z) => `${+z.re.toPrecision(6)}${z.im < 0 ? '' : '+'}${+z.im.toPrecision(6)}i`;
const fmt = (z) => (z && CX.isFin(z) ? `${z.re.toPrecision(8)}${z.im < 0 ? '' : '+'}${z.im.toPrecision(8)}i` : String(z && `${z.re},${z.im}`));

// steps -> {steps, built, plan, F (the app's own forward: composition of b.f)}
function chain(list, a, b) {
  const steps = list.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const built = steps.map((st) => Funcs.build(st));
  for (const bb of built) if (bb.error) throw new Error('build error: ' + bb.error + ' in ' + JSON.stringify(list));
  const plan = Inverse.planChain(steps, built, a, b);
  const A = a || 0, B = b == null ? steps.length : b;
  const F = (z) => { let u = z; for (let k = A; k < B; k++) u = built[k].f(u); return u; };
  return { steps, built, plan, F, list };
}
const boxOf = (cx, cy, s, w = 410, h = 516) => ({ x0: cx - w / 2 / s, x1: cx + w / 2 / s, y0: cy - h / 2 / s, y1: cy + h / 2 / s });
const WIN0 = boxOf(0, 0, 60);

// my own sheet key (SPEC 5.1)
function myD(z, win, P) {
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8;
  const dx = Math.max(win.x0 - z.re, 0, z.re - win.x1), dy = Math.max(win.y0 - z.im, 0, z.im - win.y1);
  let D = Math.log2(1 + Math.hypot(dx, dy) / R);
  for (const p of P || []) D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im)));
  return D;
}
const myFront = (a, b) => (a.D !== b.D ? a.D < b.D : a.z.im !== b.z.im ? a.z.im > b.z.im : a.z.re > b.z.re);

// random shapes anywhere in a +-100 box
function randShape(kinds) {
  const k = pick(kinds || ['disc', 'rect', 'polygon', 'halfplane', 'annulus', 'sector', 'sector0', 'cdisc', 'crect', 'chalf', 'formula']);
  const c = [ru(-100, 100), ru(-100, 100)];
  const r = Math.exp(ru(Math.log(0.05), Math.log(60)));
  switch (k) {
    case 'disc': return { kind: 'disc', c, r };
    case 'cdisc': return { kind: 'disc', c, r, complement: true };
    case 'rect': return { kind: 'rect', a: c, b: [c[0] + ru(-1, 1) * r * 2, c[1] + ru(-1, 1) * r * 2] };
    case 'crect': return { kind: 'rect', a: c, b: [c[0] + ru(0.1, 1) * r * 2, c[1] + ru(0.1, 1) * r * 2], complement: true };
    case 'polygon': {
      const n = 3 + Math.floor(rnd() * 10), pts = [];
      for (let i = 0; i < n; i++) { const t = TAU * (i + ru(0, 0.8)) / n, rr = r * ru(0.3, 1); pts.push([c[0] + rr * Math.cos(t), c[1] + rr * Math.sin(t)]); }
      return { kind: 'polygon', pts };
    }
    case 'halfplane': { const t = ru(-PI, PI); return { kind: 'halfplane', a: c, b: [c[0] + Math.cos(t), c[1] + Math.sin(t)] }; }
    case 'chalf': { const t = ru(-PI, PI); return { kind: 'halfplane', a: c, b: [c[0] + Math.cos(t), c[1] + Math.sin(t)], complement: true }; }
    case 'annulus': return { kind: 'annulus', c, r1: r * ru(0.1, 0.9), r2: r };
    case 'sector': { const t1 = ru(-180, 180); return { kind: 'sector', c, r, t1, t2: t1 + ru(10, 350) }; }
    case 'sector0': { const t1 = ru(-180, 180); return { kind: 'sector', c, r: 0, t1, t2: t1 + ru(10, 350), complement: rnd() < 0.3 }; }
    case 'formula': {
      const a = ru(0.2, 30);
      const f = pick([`|\\Im z|<${a.toFixed(3)}`, `\\Re z>${c[0].toFixed(3)}`, `|\\Re z-${0}|<${a.toFixed(3)}, \\Im z>${c[1].toFixed(3)}`, `|z|<${a.toFixed(3)}`]);
      return { kind: 'formula', expr: f };
    }
  }
}
// sample a point strictly inside the shape (level > margin) within a box around the shape (+-100 for unbounded)
function sampleIn(shape, margin = 1e-6, box) {
  const L = Region.levelOf(shape);
  const bb = Region.bboxOf(shape) || box || { x0: -150, x1: 150, y0: -150, y1: 150 };
  for (let t = 0; t < 4000; t++) {
    const z = C(ru(bb.x0, bb.x1), ru(bb.y0, bb.y1));
    if (L(z) > margin) return z;
  }
  return null;
}
// numeric derivative of the app's forward chain
function dF(F, z) {
  const h = 1e-6 * (1 + CX.abs(z));
  const a = F(C(z.re + h, z.im)), b = F(C(z.re - h, z.im));
  return CX.scale(CX.sub(a, b), 1 / (2 * h));
}
module.exports = { Inverse, C, PI, TAU, rnd, ru, pick, setSeed, cs, fmt, chain, boxOf, WIN0, myD, myFront, randShape, sampleIn, dF };
// PATCH=1: accurate inverse trig for the op table's family bases (isolates their cancellation from other defects).
// Only CX.asin/acos/asinh/atan/atanh as looked up at call time are replaced; the catalog's forward maps captured
// CX's functions at load and keep the app's own values.
if (process.env.PATCH) {
  const { C: Cc, sub, mul, log, sqrt, add, div } = CX;
  const ONE = Cc(1, 0);
  const asin = (w) => {
    const s = sqrt(sub(ONE, mul(w, w))), iw = Cc(-w.im, w.re);
    const t1 = add(iw, s), t2 = sub(s, iw);
    const l = CX.abs(t1) >= CX.abs(t2) ? log(t1) : CX.neg(log(t2));
    return Cc(l.im, -l.re);
  };
  const atanS = (w) => { const iw = Cc(-w.im, w.re); const d = sub(log(sub(ONE, iw)), log(add(ONE, iw))); return Cc(-d.im / 2, d.re / 2); };
  const atan = (w) => {
    if (CX.abs(w) <= 1 || w.re === 0) return atanS(w);
    const r = atanS(div(ONE, w));
    return Cc(Math.sign(w.re) * Math.PI / 2 - r.re, -r.im);
  };
  CX.asin = asin;
  CX.acos = (w) => sub(Cc(Math.PI / 2, 0), asin(w));
  CX.asinh = (w) => { const s = asin(Cc(-w.im, w.re)); return Cc(s.im, -s.re); };
  CX.atan = atan;
  CX.atanh = (w) => { const t = atan(Cc(-w.im, w.re)); return Cc(t.im, -t.re); };
  console.log('[PATCH] accurate asin/acos/asinh/atan/atanh for the op bases');
}

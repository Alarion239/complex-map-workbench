'use strict';
// Adversarial check 8: the forward fallback (SPEC 8.4/8.7, lead mesher notes/proto/lead/sphm_lead.js) puts a base
// octahedron vertex exactly at z = 0, which is also the default origin of the polar / sphere-checker / polar-web /
// source-phase patterns. Per-vertex pattern attributes at that vertex are ln(1e-300)*16/2pi = -1759 cells, so every
// triangle of the fan around 0 interpolates across ~1757 cells: the shader's fwidth calls it moire and paints the
// average colour, and the mesher's pattern test (pxPerCell < 2 -> "moire zone") accepts it without splitting.
// Scene: Cayley map (regular at 0, F(0) = -1) of H with the polar pattern; parity of the top layer vs the exact source
// cell, scored only where cells are >= 3 px and >= 1.5 px from a cell edge (the suite's rule), split by distance to
// F(0) = -1 in the image.
//   node notes/proto/adv-math/p8_fallback_polar_pole.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
global.CX = global.CX || require(path.join(ROOT, 'src/cx.js'));
global.Expr = global.Expr || require(path.join(ROOT, 'src/parse.js'));
global.Funcs = global.Funcs || require(path.join(ROOT, 'src/funcs.js'));
const RC = require(path.join(ROOT, 'notes/proto/lead/run_cases_lead.js'));
const { C } = CX;
const TAU = 2 * Math.PI;
const b = Funcs.build({ type: 'mobius', params: Object.assign(Funcs.defaults('mobius'), { a: '1', b: '-i', c: '1', d: 'i' }) });
const F = (z) => b.f(z); F.steps = [b];
const inv = (w) => CX.div(CX.mul(C(0, 1), CX.add(C(1, 0), w)), CX.sub(C(1, 0), w));   // z = i(1+w)/(1-w)
for (const [name, view] of [['cayley_H polar, view on F(0) = -1, s 190', { cx: -0.6, cy: 0.3, s: 190 }], ['same, s 400', { cx: -0.8, cy: 0.15, s: 400 }]]) {
  const cs = {
    name, base: 'cayley_polar', F, shape: { kind: 'halfplane', a: [0, 0], b: [1, 0] }, left: { cx: 0, cy: 1, s: 60 },
    view: Object.assign({ kind: 'flat', W: 410, H: 516 }, view), pattern: 'polar',
    truth: (w) => Math.hypot(w.re, w.im) < 1,
    parity: (w) => {
      const z = inv(w), r = Math.hypot(z.re, z.im);
      const dzdw = 2 / Math.hypot(1 - w.re, -w.im) ** 2;                 // |dz/dw| = 2/|1-w|^2
      const g = dzdw / r * 16 / TAU;
      return { gx: Math.log(r) * 16 / TAU, gy: Math.atan2(z.im, z.re) * 16 / TAU, gradx: g, grady: g };
    },
  };
  const r = RC.runCase(cs);
  console.log(`${name}: IoU ${r.iou.toFixed(4)}  polar parity wrong ${r.parity_wrong}/${r.parity_scored}  (${(100 * r.parity_wrong / r.parity_scored).toFixed(1)} %)  ${r.ms} ms`);
}

// An ineligible map (degree-3 polynomial, not monomial + constant: SPEC 3.3) on an unbounded shape (-> SphereMesh),
// with z = 0 (the pole vertex and the polar origin) INSIDE the shape: F(z) = z^3/50 + z, shape Im z > -1.
{
  const bp = Funcs.build({ type: 'poly', params: Object.assign(Funcs.defaults('poly'), { co: '0.02, 0, 1, 0' }) });
  const Fp = (z) => bp.f(z); Fp.steps = [bp];
  const near0 = (w) => { let z = w; for (let i = 0; i < 30; i++) { const f = CX.sub(bp.f(z), w), d = CX.add(CX.scale(CX.mul(z, z), 0.06), C(1, 0)); z = CX.sub(z, CX.div(f, d)); } return z; };
  for (const s of [190, 600]) {
    const cs = {
      name: `z^3/50+z on Im z > -1, polar, s ${s}`, base: 'poly_polar', F: Fp, shape: { kind: 'halfplane', a: [0, -1], b: [1, -1] }, left: { cx: 0, cy: 0, s: 60 },
      view: { kind: 'flat', W: 410, H: 516, cx: 0, cy: 0, s }, pattern: 'polar',
      truth: (w) => near0(w).im > -1,
      parity: (w) => {
        const z = near0(w), r = Math.hypot(z.re, z.im);
        const g = 1 / Math.hypot(1 + 0.06 * (z.re * z.re - z.im * z.im), 0.12 * z.re * z.im) / r * 16 / TAU;
        return { gx: Math.log(r) * 16 / TAU, gy: Math.atan2(z.im, z.re) * 16 / TAU, gradx: g, grady: g };
      },
    };
    const r = RC.runCase(cs);
    console.log(`${cs.name}: IoU ${r.iou.toFixed(4)}  polar parity wrong ${r.parity_wrong}/${r.parity_scored}  (${(100 * r.parity_wrong / r.parity_scored).toFixed(1)} %)  ${r.ms} ms`);
  }
}

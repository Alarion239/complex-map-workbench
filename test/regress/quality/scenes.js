'use strict';
// Image-quality scenes: a saved app state per scene plus the EXACT ground truth of its image.
//
// Ground truth is computed independently of the app (own complex helpers below, no app code): for a pixel w of the
// right plane, pre(w) lists every candidate preimage z (all branches where the map is not injective); w is in the
// true image when some candidate lies in the source region (region(z), the exact level set of the shape).
// dF(z) = |F'(z)| gives the local scale (image checker cell size in px = cell * dF * s).
// sdf(w), when given, is the exact signed distance (w units, > 0 inside) to the true boundary; otherwise the runner
// derives it from the truth mask with a Euclidean distance transform.
//
// Every scene is rendered twice: 'mask' (pattern solid) and 'pattern' (pattern checker). Bounded controls also keep
// golden PNGs. The right view is pinned (state.rightView) so a change of the auto-fit can never move a scene.
//
// Scenes of exact images through infinity (notes/sphere-design/SPEC.md 12.4, phase P0) add variants (sc.variants):
//   'polar'  pattern polar (log-polar checker); scored with truth.parityAll(w), defined where every sheet has the same
//            parity (z^i of H), on all fill pixels whatever their number of preimages
//   'mask85' solid at alpha 0.85, 'mask20' solid at alpha 0.2: opacity_min (metrics.js) must reach 1 where infinitely
//            many sheets overlap
// truth.holeDisc {c, r}: a disc that must stay empty (z^i of H: |w| < e^-pi); reported as hole_leak.
// truth.accum: the accumulation set P of SPEC 3.7 (finite pulled-back points where sheets accumulate: z^i and e^{1/z}
//   -> {0}; exp -> {}), used with the scene's clipWin for the sheet key D of SPEC 5.1: where several members cover a
//   pixel, the pattern shown is the FRONT member's (metrics.js 'front' / 'polar' parity modes).
// truth.annotSdf(w): distance (w units) to strokes that legitimately cross the inside of the image (healed_cut: log's
//   cut line, drawn dashed over the disc); strict runs allow stroke colours only within the band around them.

const PI = Math.PI;
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im);
const sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const abs = (a) => Math.hypot(a.re, a.im);
const cexp = (a) => { const e = Math.exp(a.re); return C(e * Math.cos(a.im), e * Math.sin(a.im)); };
const clog = (a) => C(Math.log(abs(a)), Math.atan2(a.im, a.re));             // principal: arg in (-pi, pi]
const csqrt = (a) => { const r = Math.sqrt(abs(a)), t = Math.atan2(a.im, a.re) / 2; return C(r * Math.cos(t), r * Math.sin(t)); };
const casin = (a) => { // principal arcsin: -i log(i a + sqrt(1 - a^2))
  const s = csqrt(sub(C(1), mul(a, a)));
  const l = clog(add(mul(C(0, 1), a), s));
  return C(l.im, -l.re);
};
const ccos = (a) => C(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
const I = C(0, 1);
const TAU = 2 * PI;
const E_MPI = Math.exp(-PI);   // inner radius of the z^i image of the upper half-plane
const range = (a, b) => { const o = []; for (let m = a; m <= b; m++) o.push(m); return o; };
// parity of the 16-sector log-polar checker (app pattern 'polar': floor(ln|z| 16/2pi) + floor(arg z 16/2pi) mod 2)
// read in w-units for a map that sends ln|z| and arg z to w-plane polar coordinates: g = (gx, gy) cell coordinates,
// unit = w-length of one cell (both directions), so the edge distance is in w units too
function polarCell(gx, gy, unit) {
  const par = (((Math.floor(gx) + Math.floor(gy)) % 2) + 2) % 2;
  const edge = Math.min(Math.abs(gx - Math.round(gx)), Math.abs(gy - Math.round(gy))) * unit;
  return { par, cell: unit, edge };
}

function pointInPoly(pts, z) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > z.im) !== (b[1] > z.im) && z.re < (b[0] - a[0]) * (z.im - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
// the app's 1-2-5 step (Axes.niceStep): pattern cell = niceStep(size / 10), size = the largest bounded area's bbox side,
// or the meshing window's larger side when no area is bounded (app.js patternCell)
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

// nominal size of the left plane at 1440x900, dpr 1, both panels shown (the meshing window = the left view box)
const LEFT_W = 410, LEFT_H = 516;
const boxOf = (v, w = LEFT_W, h = LEFT_H) => ({ x0: v.cx - w / 2 / v.s, x1: v.cx + w / 2 / v.s, y0: v.cy - h / 2 / v.s, y1: v.cy + h / 2 / v.s });

const STRIP = (y0, y1) => (w) => Math.min(w.im - y0, y1 - w.im);
const logRange = (w) => w.im > -PI && w.im <= PI;   // the principal log's image strip

const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const CAYLEY = { a: '1', b: '-i', c: '1', d: 'i' };
const JOUK_C = [-0.12, 0.1], JOUK_R = 1.1244998888;
const POLY = [[-1.5, 0.3], [1.2, 0.2], [1.8, 1.4], [0.3, 2.2], [-1.2, 1.6]];
const DISC3 = { c: [0.6, 0.3], r: 0.8 };

// ---- the maps and regions (state + truth); the views that are rendered are listed in SCENES below ----
const BASE = {
  logH: {
    shapes: [H], steps: [{ type: 'log', params: { cut: 180, k: 0 } }], srcView: { cx: 0, cy: 1, s: 60 },
    truth: {
      desc: '0 < Im w < pi',
      pre: (w) => (logRange(w) ? [cexp(w)] : []),
      region: (z) => z.im > 0,
      dF: (z) => 1 / abs(z),
      sdf: STRIP(0, PI),
    },
  },
  exp_strip: {
    shapes: [{ kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }], steps: [{ type: 'exp', params: {} }],
    srcView: { cx: 0, cy: 0, s: 52 },
    truth: {
      desc: 'Re w > 0',
      pre: (w) => { const l = clog(w); return [l, add(l, C(0, 2 * PI)), add(l, C(0, -2 * PI))]; },
      region: (z) => Math.abs(z.im) < PI / 2,
      dF: (z) => Math.exp(z.re),
      sdf: (w) => w.re,
    },
  },
  cayley_H: {
    shapes: [H], steps: [{ type: 'mobius', params: CAYLEY }], srcView: { cx: 0, cy: 1, s: 60 },
    truth: {
      desc: '|w| < 1',
      pre: (w) => [div(mul(I, add(C(1), w)), sub(C(1), w))],
      region: (z) => z.im > 0,
      dF: (z) => { const q = abs(add(z, I)); return 2 / (q * q); },
      sdf: (w) => 1 - abs(w),
    },
  },
  recip_ext: {
    shapes: [{ kind: 'disc', c: [0, 0], r: 1, complement: true }], steps: [{ type: 'recip', params: {} }],
    srcView: { cx: 0, cy: 0, s: 60 },
    truth: {
      desc: '0 < |w| < 1',
      pre: (w) => (w.re === 0 && w.im === 0 ? [] : [div(C(1), w)]),
      region: (z) => abs(z) > 1,
      dF: (z) => 1 / (abs(z) * abs(z)),
      sdf: (w) => Math.min(1 - abs(w), abs(w)),
    },
  },
  sq_Q1: {
    shapes: [{ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }], steps: [{ type: 'pown', params: { n: 2 } }],
    srcView: { cx: 0.6, cy: 0.6, s: 70 },
    truth: {
      desc: 'Im w > 0',
      pre: (w) => { const s = csqrt(w); return [s, C(-s.re, -s.im)]; },
      region: (z) => z.re > 0 && z.im > 0,
      dF: (z) => 2 * abs(z),
      sdf: (w) => w.im,
    },
  },
  sqrt_slit: {
    shapes: [{ kind: 'formula', expr: '|z|>0' }], steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }],
    srcView: { cx: 0, cy: 0, s: 70 },
    truth: {
      desc: 'Re w > 0',
      // the principal root's image is arg w in (-pi/2, pi/2]
      pre: (w) => (w.re > 0 ? [mul(w, w)] : []),
      region: (z) => abs(z) > 0,
      dF: (z) => 1 / (2 * Math.sqrt(abs(z))),
      sdf: (w) => w.re,
    },
  },
  sin_halfstrip: {
    shapes: [{ kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }], steps: [{ type: 'sin', params: {} }],
    srcView: { cx: 0, cy: 1.25, s: 105 },
    truth: {
      desc: 'Im w > 0',
      pre: (w) => { const a = casin(w); return [a, sub(C(PI), a), sub(C(-PI), a)]; },
      region: (z) => Math.abs(z.re) < PI / 2 && z.im > 0,
      dF: (z) => abs(ccos(z)),
      sdf: (w) => w.im,
    },
  },
  disc_cube: {
    shapes: [{ kind: 'disc', c: DISC3.c, r: DISC3.r }], steps: [{ type: 'pown', params: { n: 3 } }],
    srcView: { cx: 0.4, cy: 0.2, s: 120 },
    truth: {
      desc: 'some cube root of w in the disc',
      pre: (w) => {
        const r = Math.cbrt(abs(w)), t = Math.atan2(w.im, w.re);
        return [0, 1, 2].map((k) => C(r * Math.cos((t + 2 * PI * k) / 3), r * Math.sin((t + 2 * PI * k) / 3)));
      },
      region: (z) => Math.hypot(z.re - DISC3.c[0], z.im - DISC3.c[1]) < DISC3.r,
      dF: (z) => 3 * abs(z) * abs(z),
      // z^3 folds the disc over itself: part of the boundary circle's image (drawn as a stroke) runs inside the image
      srcSdf: (z) => DISC3.r - Math.hypot(z.re - DISC3.c[0], z.im - DISC3.c[1]),
    },
  },
  joukowski: {
    shapes: [{ kind: 'disc', c: JOUK_C, r: JOUK_R, complement: true }], steps: [{ type: 'joukowski', params: {} }],
    srcView: { cx: 0, cy: 0, s: 70 },
    truth: {
      desc: 'w +- sqrt(w^2 - 1) outside the circle (the exterior of the airfoil)',
      pre: (w) => { const s = mul(csqrt(sub(w, C(1))), csqrt(add(w, C(1)))); return [add(w, s), sub(w, s)]; },
      region: (z) => Math.hypot(z.re - JOUK_C[0], z.im - JOUK_C[1]) > JOUK_R,
      dF: (z) => abs(sub(C(1), div(C(1), mul(z, z)))) / 2,
    },
  },
  annulus_log: {
    shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }], steps: [{ type: 'log', params: { cut: 180, k: 0 } }],
    srcView: { cx: 0, cy: 0, s: 70 },
    truth: {
      desc: 'log 0.5 < Re w < log 2, -pi < Im w < pi',
      pre: (w) => (logRange(w) ? [cexp(w)] : []),
      region: (z) => { const r = abs(z); return r > 0.5 && r < 2; },
      dF: (z) => 1 / abs(z),
      sdf: (w) => Math.min(w.re - Math.log(0.5), Math.log(2) - w.re, w.im + PI, PI - w.im),
    },
  },
  poly_mobius: {
    shapes: [{ kind: 'polygon', pts: POLY }], steps: [{ type: 'mobius', params: CAYLEY }],
    srcView: { cx: 0.15, cy: 1.2, s: 80 },
    truth: {
      desc: 'inverse Cayley of w in the pentagon',
      pre: (w) => [div(mul(I, add(C(1), w)), sub(C(1), w))],
      region: (z) => pointInPoly(POLY, z),
      dF: (z) => { const q = abs(add(z, I)); return 2 / (q * q); },
    },
  },

  // ---- exact images through infinity (SPEC 12.4). The truths below enumerate every member of the infinite (or
  // finite) preimage families that can lie in the region; membership is exact (no sampling, no app code). ----
  zi_H: {
    // z^i = e^{i Log z} (complex power alpha = i, principal branch: cut 180 deg, sheet 0) of the upper half-plane
    shapes: [H], steps: [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], srcView: { cx: 0, cy: 1, s: 60 },
    truth: {
      desc: 'e^-pi < |w| < 1 (the disc |w| < e^-pi stays empty)',
      // w = e^{i L}, L = Log z = ln|z| + i arg z  =>  i L = Log w + 2 pi i m  =>  L = Arg w + 2 pi m - i ln|w|.
      // The principal branch needs Im L = -ln|w| in (-pi, pi] (only such members exist); then z_m = e^{L_m}
      // differ only in |z_m| = e^{Arg w + 2 pi m}, and z_m is in H iff arg z_m = -ln|w| is in (0, pi).
      pre: (w) => {
        const r = abs(w);
        if (!(r > 0) || !Number.isFinite(r)) return [];
        const t = -Math.log(r);
        if (!(t > -PI && t <= PI)) return [];
        const a = Math.atan2(w.im, w.re);
        return range(-2, 2).map((m) => { const R = Math.exp(a + TAU * m); return C(R * Math.cos(t), R * Math.sin(t)); });
      },
      region: (z) => z.im > 0,
      dF: (z) => Math.exp(-Math.atan2(z.im, z.re)) / abs(z),   // |i z^{i-1}| = |z^i| / |z| = e^{-arg z} / |z|
      sdf: (w) => Math.min(abs(w) - E_MPI, 1 - abs(w)),
      // log-polar checker of z: ln|z_m| = Arg w + 2 pi m, arg z_m = -ln|w|; the 16-cell index of ln|z| shifts by 16 m,
      // so every sheet has the same parity: floor(Arg w 16/2pi) + floor(-ln|w| 16/2pi) mod 2. One cell is 2pi/16 of
      // Arg w (arc |w| 2pi/16) by 2pi/16 of ln|w| (radial |w| 2pi/16, to first order).
      // Exception (metrics.js, polar mode with the sheet order): the app paints solid c0 where the source point is within
      // cell/12 of the polar origin; sheets m <= -1 always lie there, sheet 0 when Arg w < ln(cell/12)
      parityAll: (w) => { const r = abs(w); return polarCell(Math.atan2(w.im, w.re) * 16 / TAU, -Math.log(r) * 16 / TAU, r * TAU / 16); },
      holeDisc: { c: [0, 0], r: E_MPI },
      accum: [C(0, 0)],
    },
  },
  expH: {
    shapes: [H], steps: [{ type: 'exp', params: {} }], srcView: { cx: 0, cy: 1, s: 60 },
    truth: {
      desc: 'w != 0 (every w != 0 has infinitely many preimages Log w + 2 pi i m in H)',
      // members Log w + 2 pi i m; Im = Arg w + 2 pi m > 0 for every m >= 1 (and m = 0 when Arg w > 0)
      pre: (w) => { if (w.re === 0 && w.im === 0) return []; const l = clog(w); return range(-1, 3).map((m) => add(l, C(0, TAU * m))); },
      region: (z) => z.im > 0,
      dF: (z) => Math.exp(z.re),
      sdf: (w) => abs(w),
      // the boundary stroke (the image of the real axis: the positive real ray) runs through the inside of the image
      srcSdf: (z) => z.im,
      accum: [],
    },
  },
  e1z_disc: {
    // e^{1/z} as the chain [1/z, exp] of the unit disc
    shapes: [{ kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'recip', params: {} }, { type: 'exp', params: {} }],
    srcView: { cx: 0, cy: 0, s: 120 },
    truth: {
      desc: 'w != 0 (e^{1/z} of |z| < 1: every w != 0 infinitely often, near the essential singularity 0)',
      // 1/z = Log w + 2 pi i m: z_m = 1/(Log w + 2 pi i m) is in the disc iff |Log w + 2 pi i m| > 1 (every m != 0)
      pre: (w) => { if (w.re === 0 && w.im === 0) return []; const l = clog(w); return range(-2, 2).map((m) => div(C(1), add(l, C(0, TAU * m)))); },
      region: (z) => abs(z) < 1,
      dF: (z) => { const r2 = z.re * z.re + z.im * z.im; return Math.exp(z.re / r2) / r2; },   // |e^{1/z}| / |z|^2
      sdf: (w) => abs(w),
      // the boundary stroke (the image of |z| = 1: the closed curve e^{e^{i phi}}) runs through the inside of the image
      srcSdf: (z) => 1 - abs(z),
      accum: [C(0, 0)],   // the essential singularity of e^{1/z}
    },
  },
  exp_far_disc: {
    // a bounded shape far from the left view's centre: the inverse path must take its members from the shape (m = 9,
    // 10), not from a window around the view (SPEC 15 M1); the left view is zoomed out to +-80 x +-100
    shapes: [{ kind: 'disc', c: [0, 60], r: 1 }], steps: [{ type: 'exp', params: {} }],
    srcView: { cx: 0, cy: 0, s: 205 / 80 },
    truth: {
      desc: 'exp of |z - 60i| < 1: w inside iff some Log w + 2 pi i m lies in the disc (m = 9 or 10)',
      pre: (w) => { if (w.re === 0 && w.im === 0) return []; const l = clog(w); return range(7, 12).map((m) => add(l, C(0, TAU * m))); },
      region: (z) => Math.hypot(z.re, z.im - 60) < 1,
      dF: (z) => Math.exp(z.re),
    },
  },
  ez2_disc: {
    // custom e^{z^2} of a small disc off the axes (an outer exp over a non-affine prefix z^2), default left view
    shapes: [{ kind: 'disc', c: [3, 3], r: 0.3 }], steps: [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }],
    srcView: { cx: 0, cy: 0, s: 60 },
    truth: {
      desc: 'e^{z^2} of |z - (3+3i)| < 0.3: some square root of Log w + 2 pi i m lies in the disc',
      // z^2 = Log w + 2 pi i m, z = +-sqrt(...); over the disc Im z^2 is in (15.3, 20.7), so m in {2, 3}: m = -1..6
      // and both roots are enumerated
      pre: (w) => {
        if (w.re === 0 && w.im === 0) return [];
        const l = clog(w), out = [];
        for (const m of range(-1, 6)) { const s = csqrt(add(l, C(0, TAU * m))); out.push(s, C(-s.re, -s.im)); }
        return out;
      },
      region: (z) => Math.hypot(z.re - 3, z.im - 3) < 0.3,
      dF: (z) => 2 * abs(z) * Math.exp(z.re * z.re - z.im * z.im),
    },
  },
  healed_cut: {
    // [log, exp] of a disc that crosses log's cut (the negative real axis): exp heals the cut, the image is the disc
    shapes: [{ kind: 'disc', c: [-1, 0], r: 0.6 }], steps: [{ type: 'log', params: { cut: 180, k: 0 } }, { type: 'exp', params: {} }],
    srcView: { cx: -1, cy: 0, s: 150 },
    truth: {
      desc: 'the disc |w + 1| < 0.6 itself (exp(log z) = z)',
      // log's image is the strip -pi < Im u <= pi; exp is injective there, so z = e^{Log w} (= w)
      pre: (w) => (w.re === 0 && w.im === 0 ? [] : [cexp(clog(w))]),
      region: (z) => Math.hypot(z.re + 1, z.im) < 0.6,
      dF: () => 1,
      sdf: (w) => 0.6 - Math.hypot(w.re + 1, w.im),
      // the app draws log's cut (the negative real axis of its input) through the steps that follow: exp sends it to
      // the negative real axis of w, a dashed line across the disc
      annotSdf: (w) => (w.re <= 0 ? Math.abs(w.im) : abs(w)),
    },
  },
};
// P2 review scenes (SPEC 13.12):
//  - saturation points: artanh / arctan of the unit disc map it onto the strips |Im w| < pi/4 / |Re w| < pi/4, which
//    run to infinity; far out float32 tanh w is exactly +-1 (tanh 8 = 1 - 2.3e-7). Exact truth by the identity
//    |tanh w| < 1 <=> |Im w| < pi/4 in the strip |Im w| < pi/2 (|tan w| < 1 <=> |Re w| < pi/4 in |Re w| < pi/2): the
//    candidate carried to region() is w itself (a float64 tanh rounds to +-1 there too)
//  - a deep zoom (s = 3e4) onto the image boundary of z^3 of an off-centre disc: below the float32 resolution of the
//    walk the app draws such a bounded shape forward (precision); the image must stay exact either way
BASE.atanh_D = {
  shapes: [{ kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'artanh', params: {} }], srcView: { cx: 0, cy: 0, s: 120 },
  truth: {
    desc: 'artanh of |z| < 1: the strip |Im w| < pi/4, to infinity',
    pre: (w) => (Math.abs(w.im) < PI / 2 ? [w] : []),
    region: (u) => Math.abs(u.im) < PI / 4,
    dF: () => 1,
    sdf: (w) => PI / 4 - Math.abs(w.im),
  },
};
BASE.atan_D = {
  shapes: [{ kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'arctan', params: {} }], srcView: { cx: 0, cy: 0, s: 120 },
  truth: {
    desc: 'arctan of |z| < 1: the strip |Re w| < pi/4, to infinity',
    pre: (w) => (Math.abs(w.re) < PI / 2 ? [w] : []),
    region: (u) => Math.abs(u.re) < PI / 4,
    dF: () => 1,
    sdf: (w) => PI / 4 - Math.abs(w.re),
  },
};
const CUBE_C = [3, 3], CUBE_R = 0.5;
BASE.cube_far_deep = {
  shapes: [{ kind: 'disc', c: CUBE_C, r: CUBE_R }], steps: [{ type: 'pown', params: { n: 3 } }], srcView: { cx: 3, cy: 3, s: 120 },
  truth: {
    desc: 'z^3 of |z - (3+3i)| < 0.5: some cube root of w lies in the disc',
    pre: (w) => { const r = Math.cbrt(abs(w)), t = Math.atan2(w.im, w.re) / 3; return [0, 1, 2].map((j) => C(r * Math.cos(t + j * TAU / 3), r * Math.sin(t + j * TAU / 3))); },
    region: (z) => Math.hypot(z.re - CUBE_C[0], z.im - CUBE_C[1]) < CUBE_R,
    dF: (z) => 3 * (z.re * z.re + z.im * z.im),
  },
};
// the image of the disc's point 3.5 + 3i (on its boundary): (3.5 + 3i)^3 = -51.625 + 83.25i
const CUBE_W0 = { cx: -51.625, cy: 83.25 };
// variants: the runs of the scene (default mask + pattern); see VARIANTS below
// the same map written as a custom formula (the decomposition of a formula must give the same image)
BASE.e1z_custom = Object.assign({}, BASE.e1z_disc, { steps: [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z}}', cut: 180 } }] });
// rational custom formulas in which z occurs more than once (SPEC 3.3 rev 3: the inverse renderer's RAT2): example 9,
// "A formula in LaTeX", w = (z^2 - 1)/(z^2 + 1) of the square |Re z|, |Im z| < 1.5. The poles +-i lie inside, so the
// image contains a neighbourhood of infinity; w = 1 (the value at infinity) and a bounded hole around it are not
// attained. Truth: z^2 = (1 + w)/(1 - w), both square roots.
const SQ9 = 1.5;
BASE.rat9 = {
  shapes: [{ kind: 'rect', a: [-SQ9, -SQ9], b: [SQ9, SQ9] }], steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }],
  srcView: { cx: 0, cy: 0, s: 80 },
  truth: {
    desc: 'some square root of (1 + w)/(1 - w) in the square (w != 1)',
    pre: (w) => { if (w.re === 1 && w.im === 0) return []; const s = csqrt(div(add(C(1), w), sub(C(1), w))); return [s, C(-s.re, -s.im)]; },
    region: (z) => Math.abs(z.re) < SQ9 && Math.abs(z.im) < SQ9,
    dF: (z) => { const q = add(mul(z, z), C(1)); return 4 * abs(z) / (abs(q) * abs(q)); },
  },
};
// the Joukowski airfoil (scene joukowski: the catalog step) written as the custom formula (z + 1/z)/2 (RAT2 then AFF)
BASE.jouk_custom = Object.assign({}, BASE.joukowski, { steps: [{ type: 'custom', params: { expr: '\\frac{z+\\frac{1}{z}}{2}', cut: 180 } }] });
// the zeros-and-poles step (notes/ui-design/zeros-poles.md): zeros +-1 and the pole 0, f(z) = (z^2 - 1)/z = z - 1/z,
// of the disc |z - 1.2i| < 0.8 (0 outside it). The roots of z^2 - wz - 1 = 0 have product -1, and both lie in the disc
// for some w: the map folds the disc onto itself (two sheets, RAT2 in the inverse renderer), so part of the image of
// the boundary circle runs inside the image (srcSdf excludes its stroke band).
const ZPD = { c: [0, 1.2], r: 0.8 };
BASE.zp_disc = {
  shapes: [{ kind: 'disc', c: ZPD.c, r: ZPD.r }], steps: [{ type: 'zp', params: { a: '1', zeros: '1, -1', poles: '0' } }],
  srcView: { cx: 0, cy: 1.2, s: 110 },
  truth: {
    desc: 'a root of z^2 - wz - 1 = 0 in the disc |z - 1.2i| < 0.8',
    pre: (w) => { const s = csqrt(add(mul(w, w), C(4))); return [mul(add(w, s), C(0.5)), mul(sub(w, s), C(0.5))]; },
    region: (z) => Math.hypot(z.re - ZPD.c[0], z.im - ZPD.c[1]) < ZPD.r,
    dF: (z) => abs(add(C(1), div(C(1), mul(z, z)))),
    srcSdf: (z) => ZPD.r - Math.hypot(z.re - ZPD.c[0], z.im - ZPD.c[1]),
  },
};
// Repeat × N (#6): z^2 + c three times (the block [z^2, + c] under Repeat, N = 3) of a disc around the critical point
// 0, so the map folds it onto itself. Truth: every branch of the three square roots, w -> +-sqrt(w - c), 8 candidates.
const Q3 = { c: [0.2, 0.1], r: 0.8 }, Q3C = C(-0.3, 0.2);
BASE.quad3_disc = {
  shapes: [{ kind: 'disc', c: Q3.c, r: Q3.r }],
  steps: [{ type: 'pown', params: { n: 2 } }, { type: 'add', params: { c: '-0.3+0.2i' }, repeat: { n: 3, len: 2 } }],
  srcView: { cx: 0.2, cy: 0.1, s: 150 },
  truth: {
    desc: 'some branch of (z^2 + c)^{-3} of w in the disc',
    pre: (w) => {
      let zs = [w];
      for (let k = 0; k < 3; k++) zs = zs.flatMap((u) => { const s = csqrt(sub(u, Q3C)); return [s, C(-s.re, -s.im)]; });
      return zs;
    },
    region: (z) => Math.hypot(z.re - Q3.c[0], z.im - Q3.c[1]) < Q3.r,
    dF: (z) => { let u = z, d = 1; for (let k = 0; k < 3; k++) { d *= 2 * abs(u); u = add(mul(u, u), Q3C); } return d; },
    srcSdf: (z) => Q3.r - Math.hypot(z.re - Q3.c[0], z.im - Q3.c[1]),
  },
};
// The Douady–Hubbard map Φ_M (#260) of a disc outside M near the 1/4 limb (min |Φ_M| on it 1.026): this file's own
// Böttcher coordinate (the orbit of 0 to |u| > 1e8, then back by the square root nearest each orbit point) and its own
// inverse: the external ray of arg w traced from |c| = 64 down to |w| (Newton on u_m(c) = w^{2^m}, the target beyond
// 1e8; T. Kawahira, 2009), 8 steps per halving of the potential, then checked forward to 1e-10
const DHM = (() => {
  function phi(c) {
    const orb = [c];
    let u = c;
    for (let k = 0; abs(u) <= 1e8; k++) { if (k > 4000) return null; u = add(mul(u, u), c); orb.push(u); }
    let p = mul(u, csqrt(add(C(1), div(div(c, u), u))));
    for (let k = orb.length - 2; k >= 0; k--) {
      const r = csqrt(p), o = orb[k];
      p = r.re * o.re + r.im * o.im >= 0 ? r : C(-r.re, -r.im);
    }
    return p;
  }
  const L0 = Math.log(64), TGT = Math.log(1e8);
  function inv(w) {
    const Lw = Math.log(abs(w)), th = Math.atan2(w.im, w.re) / TAU;
    if (!(Lw > 1e-9)) return null;
    const n = Math.max(1, Math.ceil(8 * Math.log2(L0 / Lw)));
    let c = C(64 * Math.cos(TAU * th) - 0.5, 64 * Math.sin(TAU * th));
    for (let j = 1; j <= n; j++) {
      const L = L0 * Math.pow(Lw / L0, j / n);
      let m = 0;
      while (L * 2 ** m < TGT) m++;
      let a = th;
      for (let i = 0; i < m; i++) { a *= 2; a -= Math.floor(a); }
      const t = cexp(C(L * 2 ** m, TAU * a));
      for (let it = 0; it < 60; it++) {
        let u = c, d = C(1);
        for (let k = 0; k < m; k++) { const ud = mul(u, d); d = C(2 * ud.re + 1, 2 * ud.im); u = add(mul(u, u), c); }
        const dc = div(sub(u, t), d);
        c = sub(c, dc);
        if (!(abs(dc) > 1e-15 * abs(c))) break;
      }
    }
    const back = phi(c);
    return back && abs(sub(back, w)) <= 1e-10 * abs(w) ? c : null;
  }
  return { phi, inv };
})();
const DH_D = { c: [0.6, 0.9], r: 0.3 };
// (Φ_M is one-to-one, so the image of the disc is inside Φ_M of its circle: w beyond that circle's bounding box,
// sampled at 1440 points and widened by 0.02, has no preimage in the disc, and its ray is not traced)
const DH_BOX = (() => {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (let i = 0; i < 1440; i++) {
    const a = TAU * i / 1440, w = DHM.phi(C(DH_D.c[0] + DH_D.r * Math.cos(a), DH_D.c[1] + DH_D.r * Math.sin(a)));
    b.x0 = Math.min(b.x0, w.re - 0.02); b.x1 = Math.max(b.x1, w.re + 0.02); b.y0 = Math.min(b.y0, w.im - 0.02); b.y1 = Math.max(b.y1, w.im + 0.02);
  }
  return b;
})();
BASE.dh_disc = {
  shapes: [{ kind: 'disc', c: DH_D.c, r: DH_D.r }],
  steps: [{ type: 'dh', params: { N: 64 } }],
  srcView: { cx: 0.6, cy: 0.9, s: 300 },
  truth: {
    desc: 'Φ_M^{-1}(w), the external ray of arg w traced to |w|, in the disc',
    pre: (w) => { if (w.re < DH_BOX.x0 || w.re > DH_BOX.x1 || w.im < DH_BOX.y0 || w.im > DH_BOX.y1) return []; const z = DHM.inv(w); return z ? [z] : []; },
    region: (z) => Math.hypot(z.re - DH_D.c[0], z.im - DH_D.c[1]) < DH_D.r,
    dF: (z) => { const h = 1e-6, a = DHM.phi(C(z.re + h, z.im)), b = DHM.phi(C(z.re - h, z.im)); return a && b ? abs(sub(a, b)) / (2 * h) : 1; },
    srcSdf: (z) => DH_D.r - Math.hypot(z.re - DH_D.c[0], z.im - DH_D.c[1]),
  },
};
const scene = (base, name, group, rightView, note, variants) => Object.assign({ name, base, group, rightView, note }, BASE[base], variants ? { variants } : {});
const LOGH_VIEW = { cx: -0.18, cy: PI / 2, s: 97 };   // the app's auto-fit of this scene (rounded)

// The rendered scenes. 'unbounded': images of unbounded regions, cut off today somewhere (the change should fill them
// to the view edges: their IoU / holes improve). 'bounded': controls that must not change (metrics + golden PNGs).
const SCENES = [
  scene('logH', 'logH', 'unbounded', LOGH_VIEW, 'log of the upper half-plane, default zoom'),
  scene('logH', 'logH_out4', 'unbounded', Object.assign({}, LOGH_VIEW, { s: LOGH_VIEW.s / 4 }), 'log of the upper half-plane, zoomed out 4x'),
  scene('logH', 'logH_out16', 'unbounded', Object.assign({}, LOGH_VIEW, { s: LOGH_VIEW.s / 16 }), 'log of the upper half-plane, zoomed out 16x'),
  scene('exp_strip', 'exp_strip', 'unbounded', { cx: 2, cy: 0, s: 40 }, 'exp of the strip |Im z| < pi/2'),
  scene('cayley_H', 'cayley_H', 'unbounded', { cx: 0, cy: 0, s: 190 }, 'Cayley map (z - i)/(z + i) of the upper half-plane'),
  scene('cayley_H', 'cayley_H_zoom1', 'unbounded', { cx: 1, cy: 0, s: 190 * 64 }, 'Cayley of the upper half-plane, 64x zoom on w = 1 (the image of infinity)'),
  scene('recip_ext', 'recip_ext', 'unbounded', { cx: 0, cy: 0, s: 180 }, '1/z of the exterior |z| > 1'),
  scene('recip_ext', 'recip_ext_zoom0', 'unbounded', { cx: 0, cy: 0, s: 180 * 128 }, '1/z of |z| > 1, 128x zoom on w = 0 (the image of infinity)'),
  scene('sq_Q1', 'sq_Q1', 'unbounded', { cx: 0, cy: 2, s: 60 }, 'z^2 of the first quadrant'),
  scene('sqrt_slit', 'sqrt_slit', 'unbounded', { cx: 1, cy: 0, s: 120 }, 'principal sqrt of the slit plane (formula |z| > 0, cut 180 deg)'),
  scene('sqrt_slit', 'sqrt_slit_out16', 'unbounded', { cx: 1, cy: 0, s: 120 / 16 }, 'principal sqrt of the slit plane, zoomed out 16x'),
  scene('sin_halfstrip', 'sin_halfstrip', 'unbounded', { cx: 0, cy: 2, s: 50 }, 'sin of the half-strip |Re z| < pi/2, Im z > 0'),
  scene('disc_cube', 'disc_cube', 'bounded', { cx: 0.15, cy: 1, s: 74.5 }, 'disc |z - (0.6+0.3i)| < 0.8 (contains 0) under z^3: overlapping sheets'),
  scene('joukowski', 'joukowski', 'bounded', { cx: 0, cy: 0, s: 117 }, 'the Joukowski airfoil example: exterior of a circle through 1 under (z + 1/z)/2'),
  scene('annulus_log', 'annulus_log', 'bounded', { cx: 0, cy: 0, s: 72 }, 'principal log of the annulus 0.5 < |z| < 2 (a rectangle)'),
  scene('poly_mobius', 'poly_mobius', 'bounded', { cx: 0, cy: 0, s: 200 }, 'a pentagon in the upper half-plane under the Cayley map'),
  // exact images through infinity (SPEC 12.4, P0): today these are wrong somewhere (the z^i hole is filled, low alpha
  // is not opaque where infinitely many sheets overlap); the inverse renderer should raise them as IMPROVED.
  // group 'infinite': infinitely many sheets / unbounded ranges; 'bounded_far' etc. are bounded shapes whose
  // per-pixel ranges come from the shape (they must stay exact).
  scene('zi_H', 'zi_H', 'infinite', { cx: 0, cy: 0, s: 190 }, 'z^i of the upper half-plane: the annulus e^-pi < |w| < 1, the hole must stay empty', ['mask', 'pattern', 'polar', 'mask85', 'mask20']),
  scene('zi_H', 'zi_H_out4', 'infinite', { cx: 0, cy: 0, s: 190 / 4 }, 'z^i of the upper half-plane, zoomed out 4x', ['mask', 'pattern', 'polar']),
  scene('zi_H', 'zi_H_out16', 'infinite', { cx: 0, cy: 0, s: 190 / 16 }, 'z^i of the upper half-plane, zoomed out 16x', ['mask', 'pattern']),
  scene('expH', 'expH', 'infinite', { cx: 0, cy: 0, s: 60 }, 'exp of the upper half-plane: every w != 0, infinitely many sheets', ['mask', 'pattern', 'mask85', 'mask20']),
  scene('expH', 'expH_out16', 'infinite', { cx: 0, cy: 0, s: 60 / 16 }, 'exp of the upper half-plane, zoomed out 16x', ['mask', 'pattern']),
  scene('e1z_disc', 'e1z_disc', 'infinite', { cx: 0, cy: 0, s: 60 }, 'e^{1/z} (chain [1/z, exp]) of the unit disc: every w != 0', ['mask', 'pattern', 'mask85', 'mask20']),
  scene('e1z_disc', 'e1z_disc_out16', 'infinite', { cx: 0, cy: 0, s: 60 / 16 }, 'e^{1/z} of the unit disc, zoomed out 16x', ['mask', 'pattern']),
  scene('e1z_custom', 'e1z_custom', 'infinite', { cx: 0, cy: 0, s: 60 }, 'custom formula e^{1/z} of the unit disc', ['mask', 'pattern', 'mask85']),
  scene('exp_far_disc', 'exp_far_disc', 'bounded_far', { cx: 0, cy: 0, s: 60 }, 'exp of |z - 60i| < 1 with the left view zoomed out to +-80 x +-100 (members m = 9, 10)'),
  scene('ez2_disc', 'ez2_disc', 'bounded_far', { cx: 3.3, cy: -3.15, s: 22 }, 'custom e^{z^2} of |z - (3+3i)| < 0.3, default left view; right view fitted to the image'),
  scene('healed_cut', 'healed_cut', 'bounded_cut', { cx: -1, cy: 0.5 / 150, s: 150 }, '[log, exp] of |z + 1| < 0.6: a cut that a later step heals; the cut runs through pixel centres (0.5 px offset)'),
  // P2 review (SPEC 13.12): saturation points at 6x and 12x zoom-out, a deep zoom, z^i's polar cells at alpha < 1
  scene('atanh_D', 'atanh_D_s20', 'saturation', { cx: 0, cy: 0, s: 20 }, 'artanh of the unit disc, zoomed out 6x: the strip |Im w| < pi/4 to the view edges', ['mask', 'mask85']),
  scene('atanh_D', 'atanh_D_s10', 'saturation', { cx: 0, cy: 0, s: 10 }, 'artanh of the unit disc, zoomed out 12x (|Re w| to 20: tanh w = +-1 in float32)', ['mask', 'mask85']),
  scene('atan_D', 'atan_D_s20', 'saturation', { cx: 0, cy: 0, s: 20 }, 'arctan of the unit disc, zoomed out 6x: the strip |Re w| < pi/4', ['mask']),
  scene('atan_D', 'atan_D_s10', 'saturation', { cx: 0, cy: 0, s: 10 }, 'arctan of the unit disc, zoomed out 12x', ['mask']),
  scene('cube_far_deep', 'cube_far_deep', 'deep', Object.assign({ s: 3e4 }, CUBE_W0), 'z^3 of |z - (3+3i)| < 0.5 at s = 3e4 on the image of its boundary point 3.5 + 3i', ['mask', 'pattern']),
  scene('zi_H', 'zi_H_polar85', 'infinite', { cx: 0, cy: 0, s: 190 }, 'z^i of the upper half-plane, polar pattern at alpha 0.85: every sheet the same parity, so the cells keep their exact colours', ['polar85', 'polar50']),
  // rational custom formulas (SPEC 3.3 rev 3): exact through the poles and the value at infinity
  scene('rat9', 'rat9', 'rational', { cx: 1.4, cy: 0, s: 110 }, 'example 9: custom (z^2-1)/(z^2+1) of the square |Re z|, |Im z| < 1.5 (poles +-i inside): the hole around w = 1 stays empty', ['mask', 'pattern']),
  scene('rat9', 'rat9_out8', 'rational', { cx: 0, cy: 0, s: 110 / 8 }, 'example 9 zoomed out 8x: the image covers a neighbourhood of infinity, filled to the view edges', ['mask', 'pattern']),
  scene('jouk_custom', 'jouk_custom', 'rational', { cx: 0, cy: 0, s: 117 }, 'the Joukowski airfoil as the custom formula (z + 1/z)/2: the same image as the catalog step', ['mask', 'pattern']),
  // the zeros-and-poles step: (z^2 - 1)/z by its zeros +-1 and pole 0 (RAT2, two sheets over a fold)
  scene('zp_disc', 'zp_disc', 'rational', { cx: 0, cy: 2.19, s: 250 }, 'zeros-and-poles step, zeros +-1 and pole 0: (z^2-1)/z of the disc |z - 1.2i| < 0.8 (folded onto itself)', ['mask', 'pattern']),
  // Repeat × N (#6): a block of steps run three times, the inverse renderer's ops three times over (8 branches)
  scene('quad3_disc', 'quad3_disc', 'rational', { cx: 0.25, cy: 0.5, s: 80 }, 'Repeat x 3 of [z^2, + (-0.3+0.2i)] of the disc |z - (0.2+0.1i)| < 0.8 (contains 0): degree 8, folded', ['mask', 'pattern']),
  // the Douady–Hubbard map (#260): no inverse enumerator, so the image is the CPU mesh of the disc mapped forward
  scene('dh_disc', 'dh_disc', 'conformal', { cx: 1.067, cy: 0.868, s: 400 }, 'the Douady–Hubbard map Phi_M of the disc |z - (0.6+0.9i)| < 0.3 by the 1/4 limb (|Phi_M| > 1.026 on it)', ['mask', 'pattern']),
];

// [#385 follow-up] the globes: no flat ground truth fits a sphere, so these runs are scored by their golden diff alone
// (paired: against the reference's render on the same machine) and only reported, never gated (compare_quality.py);
// a change to the globe's shading or camera shows up as a pixel diff in the quality job's summary. Each pins its camera
// (__cmwCam: the app's default pose at the suite's 1440 x 900, written out, so a change of the default camera shows too)
// and names the canvas it draws on; state: the saved state's own keys over DISPLAY's
const SPHERE_SCENES = [
  { name: 'sphere_disc_sq', group: 'sphere', canvas: 'canvasR', cam: { side: 'R', yaw: -Math.PI / 3, pitch: Math.PI / 10, dist: 7.158 },
    note: "the exact image of the disc |z - (0.3+0.2i)| < 0.5 under z^2 on Y's globe (pinned camera)",
    shapes: [{ kind: 'disc', c: [0.3, 0.2], r: 0.5 }], steps: [{ type: 'pown', params: { n: 2 } }], srcView: { cx: 0, cy: 0, s: 120 },
    state: { rightMode: 'sphere', sphereMode: 'image' } },
  { name: 'sphere_phase', group: 'sphere', canvas: 'canvasL', cam: { side: 'L', yaw: -Math.PI / 3, pitch: -2 * Math.PI / 15, dist: 5.035 },
    note: "the Phase view on X's globe, F(z) = z (pinned camera): the sphere's shading and the phase colours",
    shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 120 },
    state: { dc: 'phase', rightMode: 'sphere', sphereMode: 'color' } },
];

// display settings shared by every scene: no coordinate net, unit circle, view outline or region outline; alpha 1
const DISPLAY = {
  rightMode: 'image', focus: 0, alpha: 1, lines: false, unit: false, fov: false, outline: false, chev: false,
  patternScale: 1, meshN: 240, hideLeft: false, hideRight: false, solo: null, sheets: false, leftSphere: false,
};
// variant -> the app pattern it renders with; VARIANT_STATE: further state overrides; VARIANT_CLASS: the pixel
// classifier (metrics.js): 'mask' = fill c0 only, 'pattern' = c0, its alternate color and their blends
const VARIANTS = { mask: 'solid', pattern: 'checker', polar: 'polar', mask85: 'solid', mask20: 'solid', polar85: 'polar', polar50: 'polar' };
const VARIANT_STATE = { mask85: { alpha: 0.85 }, mask20: { alpha: 0.2 }, polar85: { alpha: 0.85 }, polar50: { alpha: 0.5 } };
const VARIANT_CLASS = { mask: 'mask', pattern: 'pattern', polar: 'pattern', mask85: 'mask', mask20: 'mask', polar85: 'pattern', polar50: 'pattern' };
const DEFAULT_VARIANTS = ['mask', 'pattern'];
// the scene groups of the original suite (recorded 2026-10-19): their runs keep exactly the metrics they had; the
// groups added for SPEC 12.4 also report opacity on their mask-type runs
const LEGACY_GROUPS = new Set(['unbounded', 'bounded']);

function bboxSide(s) {
  if (s.complement) return 0;
  if (s.kind === 'disc') return 2 * s.r;
  if (s.kind === 'annulus') return 2 * Math.max(s.r1, s.r2);
  if (s.kind === 'rect') return Math.max(Math.abs(s.b[0] - s.a[0]), Math.abs(s.b[1] - s.a[1]));   // rat9 (the only rect scene)
  if (s.kind === 'polygon') {
    const xs = s.pts.map((p) => p[0]), ys = s.pts.map((p) => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  return 0;   // half-plane, formula, unbounded sector: no bbox
}
function cellOf(sc) {
  let size = 0;
  for (const s of sc.shapes) size = Math.max(size, bboxSide(s));
  if (!size) { const b = boxOf(sc.srcView); size = Math.max(b.x1 - b.x0, b.y1 - b.y0); }
  return niceStep(size / 10);
}
// the saved app state of a scene variant (written to localStorage before the app opens)
function stateOf(sc, variant) {
  const shapes = sc.shapes.map((s, i) => Object.assign({ id: 's' + (i + 1), ci: 0, visible: true }, JSON.parse(JSON.stringify(s))));
  const steps = sc.steps.map((st) => Object.assign({ type: st.type, params: Object.assign({}, st.params), on: true }, st.repeat ? { repeat: Object.assign({}, st.repeat) } : {}));
  return Object.assign({ v3: true, v4: true, v5: true, nextId: 50, targets: [] }, DISPLAY, {
    pattern: VARIANTS[variant], shapes, steps, srcView: Object.assign({}, sc.srcView), clipWin: boxOf(sc.srcView),
    rightView: sc.rightView ? Object.assign({}, sc.rightView) : null,
  }, VARIANT_STATE[variant] || {});
}
// all runs: scene x variant, in a fixed order
//   kind: the classifier ('mask' | 'pattern'); parity: 'checker' (unique preimage, planar cells) | 'front' (planar
//   cells of the front member, any number of preimages) | 'polar' (truth.parityAll of the front member, every fill
//   pixel) | null; opacity: report the fill opacity (mask-type runs of the new groups); strict: the metric rules of the
//   new groups (metrics.js); sheet: the sheet order of SPEC 5.1 (the saved clipWin, truth.accum); rc: the radius of
//   the polar pattern's solid disc around the origin (pattern cell / 12; the polar origin is 0 in every scene)
function runs(filter) {
  const out = [];
  for (const sc of SPHERE_SCENES) {
    const id = `${sc.name}.look`;
    if (filter && !filter.some((f) => id === f || sc.name === f || id.startsWith(f))) continue;
    const shapes = sc.shapes.map((sh, i) => Object.assign({ id: 's' + (i + 1), ci: 0, visible: true }, JSON.parse(JSON.stringify(sh))));
    const steps = sc.steps.map((st) => ({ type: st.type, params: Object.assign({}, st.params), on: true }));
    const state = Object.assign({ v3: true, v4: true, v5: true, nextId: 50, targets: [] }, DISPLAY, { pattern: 'checker', shapes, steps, srcView: Object.assign({}, sc.srcView) }, sc.state);
    out.push({ id, scene: Object.assign({ truth: { desc: 'none: golden diff only (a globe)' }, rightView: null }, sc), variant: 'look', kind: null, parity: null, opacity: false, strict: false,
      alpha: DISPLAY.alpha, golden: true, sphere: true, canvas: sc.canvas, cam: sc.cam, cell: 0, state, cellErr: false, sheet: null, rc: 0 });
  }
  for (const sc of SCENES) for (const v of sc.variants || DEFAULT_VARIANTS) {
    const id = `${sc.name}.${v}`;
    if (filter && !filter.some((f) => id === f || sc.name === f || id.startsWith(f))) continue;
    const kind = VARIANT_CLASS[v];
    const strict = !LEGACY_GROUPS.has(sc.group);
    const parity = v === 'pattern' ? (strict ? 'front' : 'checker') : /^polar/.test(v) ? 'polar' : null;
    if (parity === 'polar' && typeof sc.truth.parityAll !== 'function') throw new Error(`${id}: the polar variant needs truth.parityAll`);
    // cell_err (metrics.js): the polar runs of z^i at alpha < 1 (P2 review: the light cells reach c1)
    const state = stateOf(sc, v), cell = cellOf(sc);
    out.push({ id, scene: sc, variant: v, kind, parity, opacity: kind === 'mask' && strict, strict, alpha: (VARIANT_STATE[v] || {}).alpha ?? DISPLAY.alpha,
      golden: sc.group === 'bounded', cell, state, cellErr: /^polar\d/.test(v),
      sheet: strict ? { win: state.clipWin, P: sc.truth.accum || [] } : null, rc: v === 'polar' ? cell * state.patternScale / 12 : 0 });
  }
  return out;
}

module.exports = { SCENES, SPHERE_SCENES, VARIANTS, VARIANT_STATE, VARIANT_CLASS, LEGACY_GROUPS, runs, stateOf, cellOf, niceStep, boxOf, cx: { C, add, sub, mul, div, abs, cexp, clog, csqrt, casin } };

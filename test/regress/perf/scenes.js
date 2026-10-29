'use strict';
// Scenes of the perf suite: saved states (the app's localStorage format, see blankState()/loadState() in
// src/app.js) written before the app loads. Keep them stable: the baseline is only comparable for identical scenes.
// Shape ids are fixed so __cmwInfo() rows can be matched across runs.

const BASE = { v3: true, v4: true, v5: true, nextId: 50, focus: 0, rightMode: 'image', targets: [], pattern: 'checker', lines: true, unit: true, snap: true, alpha: 0.85, outline: true, leftSphere: false, sheets: false, rightView: null };

const SCENES = {
  // the example a first visit opens (EX[1] 'Strip to disk': |Im z| < pi/2 -> exp -> (w-1)/(w+1))
  default: {
    label: 'default example (strip -> exp -> Mobius)',
    state: {
      shapes: [
        { id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
        { id: 's2', kind: 'line', a: [0, 0.8], b: [1, 0.8] },
        { id: 's3', kind: 'point', p: [0, 0], label: 'z₀' },
      ],
      steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }],
      srcView: { cx: 0, cy: 0, s: 52 },
    },
  },
  // log of the upper half-plane: an unbounded region whose image (the strip 0 < Im w < pi) is today cut off at
  // both ends; the coming change should make it reach the edges of the view at any zoom
  logUHP: {
    label: 'log of the upper half-plane (unbounded)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }],
      srcView: { cx: 0, cy: 0.5, s: 60 },
    },
  },
  // a 4-step chain with a pole, a branch cut and a power (fix-ups on the CPU)
  // [#253] shapes of planes 1, 2 and 3 of a 3-step chain beside one of the z-plane: X (the z-plane) pulls each
  // back per pixel through its steps (O(n²) step evaluations a pixel over the planes), Y draws them forward
  stages3: {
    label: 'shapes in planes 1-3 of z^2 -> +1 -> exp (preimages pulled back in X)',
    state: {
      shapes: [
        { id: 's1', kind: 'disc', c: [0.2, 0.1], r: 0.5 },
        { id: 's2', kind: 'disc', c: [1, 0.5], r: 0.6, stage: 1 },
        { id: 's3', kind: 'halfplane', a: [1.5, 0], b: [1.5, 1], stage: 2 },
        { id: 's4', kind: 'annulus', c: [0, 0], r1: 2, r2: 5, stage: 3 },
      ],
      steps: [
        { type: 'pown', params: { n: 2 }, on: true },
        { type: 'add', params: { c: '1' }, on: true },
        { type: 'exp', params: {}, on: true },
      ],
      srcView: { cx: 0, cy: 0, s: 110 },
    },
  },
  chain4: {
    label: '4-step chain (translate, square, Cayley, log)',
    state: {
      shapes: [
        { id: 's1', kind: 'disc', c: [0.3, 0.2], r: 1.2 },
        { id: 's2', kind: 'cgrid', a: [-1, -1], b: [1, 1], n: 6 },
      ],
      steps: [
        { type: 'add', params: { c: '0.3+0.2i' }, on: true },
        { type: 'pown', params: { n: 2 }, on: true },
        { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true },
        { type: 'log', params: { cut: 180, k: 0 }, on: true },
      ],
      srcView: { cx: 0, cy: 0, s: 70 },
    },
  },
  // a Mobius step with a scrubbable angle (the phi label of a disk automorphism)
  scrub: {
    label: 'disk automorphism (scrub phi)',
    state: {
      shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1, nc: 5, nr: 16 }],
      steps: [{ type: 'blaschke', params: { a: '0.5+0.3i', phi: 0 }, on: true }],
      srcView: { cx: 0, cy: 0, s: 110 },
    },
  },
  // polynomial with three preimages per point (hover tracking follows 3 roots)
  cubic: {
    label: 'z^3 - 1 (hover tracks three preimages)',
    state: {
      shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.3 }],
      steps: [{ type: 'custom', params: { expr: 'z^3-1', cut: 180 }, on: true }],
      srcView: { cx: 0, cy: 0, s: 90 },
    },
  },

  // ---- scenes of SPEC 12.5 (phase P0): exact images through infinity. The right view is pinned (the views of the
  // quality suite's scenes), so a change of the auto-fit cannot change what a unit measures. ----
  // z^i of the upper half-plane: the annulus e^-pi < |w| < 1, infinitely many sheets accumulating at z = 0
  ziH: {
    label: 'z^i of the upper half-plane (infinitely many sheets)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
      steps: [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true }],
      srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 190 },
    },
  },
  // P5 (SPEC 12.5): the forward fallback. e^{z + 1/z} of the upper half-plane (a custom formula with z twice: no
  // inverse, drawn from a SphereMesh), and exp(exp(z)) of it (an unbounded range outside the innermost family: forward)
  custom_e_z1z: {
    label: 'e^{z+1/z} of the upper half-plane (custom, forward: SphereMesh)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
      steps: [{ type: 'custom', params: { expr: 'e^{z+\\frac{1}{z}}', cut: 180 }, on: true }],
      srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 40 },
    },
  },
  expexp_H: {
    label: 'exp(exp z) of the upper half-plane (forward by the outer-family rule: SphereMesh)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
      steps: [{ type: 'exp', params: {}, on: true }, { type: 'exp', params: {}, on: true }],
      srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 40 },
    },
  },
  // exp of the upper half-plane: every w != 0, infinitely many sheets
  expH: {
    label: 'exp of the upper half-plane (infinitely many sheets)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
      steps: [{ type: 'exp', params: {}, on: true }],
      srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 60 },
    },
  },
  // the quality suite's bounded golden scenes (disc_cube, joukowski, annulus_log, poly_mobius), same maps, shapes and
  // views, in the perf suite's look (checker, alpha 0.85, net and unit circle on)
  disc_cube: {
    label: 'disc |z - (0.6+0.3i)| < 0.8 under z^3 (bounded, overlapping sheets)',
    state: {
      shapes: [{ id: 's1', kind: 'disc', c: [0.6, 0.3], r: 0.8 }],
      steps: [{ type: 'pown', params: { n: 3 }, on: true }],
      srcView: { cx: 0.4, cy: 0.2, s: 120 }, rightView: { cx: 0.15, cy: 1, s: 74.5 },
    },
  },
  joukowski: {
    label: 'Joukowski airfoil (bounded control)',
    state: {
      shapes: [{ id: 's1', kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }],
      steps: [{ type: 'joukowski', params: {}, on: true }],
      srcView: { cx: 0, cy: 0, s: 70 }, rightView: { cx: 0, cy: 0, s: 117 },
    },
  },
  annulus_log: {
    label: 'principal log of 0.5 < |z| < 2 (bounded control)',
    state: {
      shapes: [{ id: 's1', kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }],
      srcView: { cx: 0, cy: 0, s: 70 }, rightView: { cx: 0, cy: 0, s: 72 },
    },
  },
  poly_mobius: {
    label: 'pentagon under the Cayley map (bounded control)',
    state: {
      shapes: [{ id: 's1', kind: 'polygon', pts: [[-1.5, 0.3], [1.2, 0.2], [1.8, 1.4], [0.3, 2.2], [-1.2, 1.6]] }],
      steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }],
      srcView: { cx: 0.15, cy: 1.2, s: 80 }, rightView: { cx: 0, cy: 0, s: 200 },
    },
  },
  // a disk automorphism (scrubbable phi) followed by the Mobius map (1 + w)/(1 - w) (preset 'Disk -> right
  // half-plane'), of the upper half-plane. The chain's pole is blaschke^-1(1), a point of the unit circle that MOVES
  // with phi: it crosses the half-plane's boundary (the real axis, a long line) at phi = 61.93 deg, inside the scrub
  // 40 -> 80 -> 40 deg (dragging the phi label right raises phi by 1 deg per 4 px). So the scrub moves a pulled-back
  // singular point across the boundary, the case where P4's refinement (reach and samples around singular points,
  // on settle only) could be tempted to resample on every motion frame (SPEC 9.1, review E4)
  mobius_halfplane: {
    label: 'disk automorphism then (1 + w)/(1 - w) of the upper half-plane (scrub phi: the pole crosses the boundary)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
      steps: [{ type: 'blaschke', params: { a: '0.5+0.3i', phi: 40 }, on: true }, { type: 'mobius', params: { a: '1', b: '1', c: '-1', d: '1' }, on: true }],
      srcView: { cx: 0, cy: 0.5, s: 60 }, rightView: { cx: 0, cy: 0, s: 60 },
    },
  },
  // the Mandelbrot example (#6) at its default N: the region is the escape test |iter(u^2 + z, u, 0, 64)| <= 2 (a loop
  // of 64 per pixel, its bound a uniform) and the map the Recurrence step u_12; Phase and Landscape paint F per pixel
  mandel: {
    label: 'the Mandelbrot example (escape-test region, Recurrence step u_12)',
    state: {
      shapes: [{ id: 's1', kind: 'formula', expr: '|\\operatorname{iter}(u^2+z, u, 0, 64)|\\le 2' }],
      steps: [{ type: 'recurrence', params: { u0: '0', g: 'u^2+z', N: 12, cut: 180 }, on: true }],
      srcView: { cx: -0.6, cy: 0, s: 150 },
    },
  },
  // the Douady–Hubbard map Φ_M (#260) at its N = 64: the GPU program keeps the orbit in an array and goes back by 64
  // square roots at most; four external rays and two equipotentials of M (CPU curves) ride along
  dh: {
    label: 'the Douady–Hubbard map Phi_M (N = 64) with four external rays and two equipotentials',
    state: {
      shapes: [['0', 0], ['1/3', 1], ['1/7', 2], ['1/2', 3]].map(([t, i]) => ({ id: 's' + (i + 1), kind: 'dhray', theta: t, c: null }))
        .concat([1.05, 1.3].map((r, i) => ({ id: 's' + (i + 5), kind: 'dheq', r, c: null }))),
      steps: [{ type: 'dh', params: { N: 64 }, on: true }],
      srcView: { cx: -0.6, cy: 0, s: 150 },
    },
  },
  // expH plus a small disc: hovering the disc's row in the shape list dims the half-plane (alpha / 2)
  hoverdim: {
    label: 'exp of the upper half-plane and of a disc (shape-list hover dims the other shape)',
    state: {
      shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }, { id: 's2', kind: 'disc', c: [0.5, 1], r: 0.5 }],
      steps: [{ type: 'exp', params: {}, on: true }],
      srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 60 },
    },
  },
  // wave 1's pointer paths (issue #63; notes/ux-build/w1-review-regress.json regress-6): a Line grid plus several
  // circles, so the snap and detent search of a hover, a drag or a glide has many curves near the pointer; the unit
  // circle C carries a glider g, and the disc d1 is dragged with Snap on
  gridCircles: {
    label: 'Line grid plus circles (snap and detent targets)',
    state: {
      shapes: [
        { id: 's1', kind: 'cgrid', a: [-2, -1.5], b: [2, 1.5], n: 8 },
        { id: 'C', kind: 'circle', c: [0, 0], r: 1 },
        { id: 'c2', kind: 'circle', c: [0.8, 0.4], r: 0.6 },
        { id: 'c3', kind: 'circle', c: [-0.9, -0.3], r: 0.75 },
        { id: 'c4', kind: 'circle', c: [0.2, -0.9], r: 0.45 },
        { id: 'c5', kind: 'circle', c: [-0.4, 0.8], r: 0.5 },
        { id: 'c6', kind: 'circle', c: [1.3, -0.6], r: 0.35 },
        { id: 'd1', kind: 'disc', c: [-1.2, 0.9], r: 0.3 },
        { id: 'g', kind: 'point', p: [Math.cos(0.2 * Math.PI), Math.sin(0.2 * Math.PI)], t: 0.1, def: { op: 'glider', args: [{ s: 'C', part: 0 }] } },
      ],
      steps: [{ type: 'pown', params: { n: 2 }, on: true }],
      srcView: { cx: 0, cy: 0, s: 110 },
    },
  },
};

// the pole of mobius_halfplane's chain, z_p(phi) = blaschke^-1(1) = (a + e^{-i phi}) / (1 + conj(a) e^{-i phi}) (phi in
// degrees; a = 0.5 + 0.3i): Im z_p > 0 puts it inside the half-plane, < 0 outside, 0 on its boundary
const MOBIUS_HALFPLANE_A = [0.5, 0.3];
function mobiusHalfplanePole(phiDeg, a = MOBIUS_HALFPLANE_A) {
  const t = -phiDeg * Math.PI / 180, er = Math.cos(t), ei = Math.sin(t);
  const nr = a[0] + er, ni = a[1] + ei;                                  // a + e^{-i phi}
  const dr = 1 + a[0] * er + a[1] * ei, di = a[0] * ei - a[1] * er;      // 1 + conj(a) e^{-i phi}
  const d = dr * dr + di * di;
  return { re: (nr * dr + ni * di) / d, im: (ni * dr - nr * di) / d };
}

function sceneState(name, over = {}) {
  const sc = SCENES[name];
  if (!sc) throw new Error('unknown scene ' + name);
  return Object.assign({}, BASE, JSON.parse(JSON.stringify(sc.state)), over);
}

// shapes for the in-page mesh benchmark (Region.buildMesh), one per area kind, plus unbounded variants
const MESH_SHAPES = [
  { name: 'disc', s: { kind: 'disc', c: [0.2, -0.1], r: 1.3 }, area: Math.PI * 1.3 * 1.3 },
  { name: 'annulus', s: { kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, area: Math.PI * (4 - 0.25) },
  { name: 'rect', s: { kind: 'rect', a: [-1.5, -1], b: [1.5, 1] }, area: 6 },
  { name: 'sector', s: { kind: 'sector', c: [0, 0], r: 2, t1: 10, t2: 130 }, area: Math.PI * 4 * 120 / 360 },
  { name: 'polygon', s: { kind: 'polygon', pts: [[-1.5, -1], [1.5, -1.2], [1.8, 0.9], [0.1, 1.6], [-1.2, 0.8]] }, area: null },
  { name: 'formula_disc', s: { kind: 'formula', expr: '|z-0.5|<1.5' }, area: Math.PI * 2.25 },
  // unbounded
  { name: 'halfplane', s: { kind: 'halfplane', a: [0, 0], b: [1, 0] }, unbounded: true },
  { name: 'sector_inf', s: { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, unbounded: true },
  { name: 'disc_complement', s: { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, unbounded: true },
  { name: 'formula_strip', s: { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, unbounded: true },
  { name: 'formula_halfstrip', s: { kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, unbounded: true },
];

module.exports = { SCENES, sceneState, MESH_SHAPES, mobiusHalfplanePole, MOBIUS_HALFPLANE_A };

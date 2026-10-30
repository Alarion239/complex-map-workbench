#!/usr/bin/env node
'use strict';
// Independent second computation of the exact truths of the quality scenes added for SPEC 12.4 (P0).
//
//   node test/regress/quality/verify_truth.js [scene ...]        (default: every scene of the new groups)
//
// For every rendered view of a scene it checks the truth of scenes.js (an inverse: pre(w) + region(z)) against:
//   (A) a FORWARD rasterisation: the region is sampled densely (spacing <= 0.4 image px, adapted to |F'|), each
//       sample is mapped with this file's own forward formula w = F(z), and the pixel it lands in is marked hit.
//         hit_outside  hit pixels whose centre the truth puts outside, farther than 1 px from the true boundary
//                      (a sample lies within 0.71 px of its pixel centre)            -> must be 0
//         miss_inside  pixels the truth puts inside, deeper than 1.5 px, that no sample hit -> must be 0
//       (A) shows image within truth and truth within image at pixel resolution, from the forward side.
//   (B) soundness of pre: at every pixel centre w, each candidate z that the truth accepts maps back,
//       |F(z) - w| <= 1e-9 (1 + |w|)                                                  -> max residual reported
//   (C) the scene's saved state describes the same map: the app's own step functions (src/funcs.js, composed in
//       chain order) agree with F at random points of the region to 1e-9 (1 + |F|). This is the only part that
//       loads app code, and only to check that the state and the truth talk about the same map.
//   (D) polar parity (scenes with truth.parityAll): at random w inside, every member z_m in the region has the
//       log-polar checker parity floor(ln|z| 16/2pi) + floor(arg z 16/2pi) mod 2 of parityAll(w)  -> 0 mismatches
//   (E) the hole disc (truth.holeDisc): no forward sample lands inside it                -> 0
//   (F) the pattern shown where several sheets overlap: this file's own model of the renderer the spec describes
//       (its own member enumerators, its own sheet key D of SPEC 5.1 with the tie rule of 5.2, the app's polar
//       pattern with its solid c0 disc |z| < cell/12) gives the displayed parity of every pixel; it must equal the
//       parity metrics.js scores (planar checker of the front member, 'front'; log-polar, 'polar') at every pixel
//       metrics.js scores                                                                -> 0 mismatches
//       (front_disc: pixels whose front member lies in the polar pattern's c0 disc: the rule matters there)
//
//   node test/regress/quality/verify_truth.js --selftest
// checks the metrics of every run of the new scenes on synthetic renders: the IDEAL render (painted by the model of
// (F): front member's pattern, c0 disc, opaque fill) must score IoU 1, holes 0, spill 0, parity 1 (on at least 1000
// pixels where the truth can score that many), opacity 1, colour error 0, hole_leak 0; then deliberate defects must
// move their metric: the hole painted (opaque, and one sheet at alpha 0.2 on mask20) -> hole_leak; a translucent
// single sheet -> opacity 0.2; flipped parity -> polar parity 0; the sheet BEHIND the front painted -> parity drops;
// the polar pattern without its c0 disc -> parity < 1 (zi_H views); a crack at 0.75 coverage -> opacity 0.75; the
// fill 15 % darker or in the edge colour -> holes; 5 % darker -> colour error; a blank pattern render -> parity null
// (never a perfect 1); every pixel in the excluded band -> opacity, colour and parity null.
//
// The P2 review scenes (SPEC 13.12): artanh / arctan of the unit disc (group 'saturation') state their truth in the
// w-plane (the strip, by the identity |tanh w| < 1 <=> |Im w| < pi/4): their pre() returns w itself, so (B) is
// replaced by (B') at every pixel centre w where float64 resolves it (|Re w| <= 16 for artanh, |Im w| <= 16 for arctan):
// z = tanh w (tan w) computed here must lie in the unit disc, with F(z) = w (the principal branch), exactly when the
// truth says inside (pixels within 1e-9 of |z| = 1 skipped); (A) counts only the pixels of that window (beyond it tanh w rounds to +-1 in float64, so no forward
// sample can land there; the identity covers it: tanh(x +- i pi/4) has modulus 1 for every real x); (C) draws its random
// points from the disc itself (ZREG). z^3 at s = 3e4 (group 'deep') is an ordinary scene. The polar model of (F) takes
// the run's c0 disc (zi_H_polar85: none, as the inverse renderer draws log-polar cells to |z| -> 0 at alpha < 1).
// Exit status 0 when every check passes, 1 otherwise.
const path = require('path');
const SC = require('./scenes');
const M = require('./metrics');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const W = 410, H = 516;
const PI = Math.PI, TAU = 2 * PI;

// ---- own forward maps (plain Math; no scenes.js helpers, no app code) ----
const fexp = (x, y) => { const e = Math.exp(x); return [e * Math.cos(y), e * Math.sin(y)]; };
const FWD = {
  // z^i = e^{i Log z} = e^{-arg z} e^{i ln|z|}
  zi_H: (x, y) => { const t = Math.atan2(y, x), l = 0.5 * Math.log(x * x + y * y), m = Math.exp(-t); return [m * Math.cos(l), m * Math.sin(l)]; },
  expH: fexp,
  e1z_disc: (x, y) => { const d = x * x + y * y; return fexp(x / d, -y / d); },
  e1z_custom: (x, y) => { const d = x * x + y * y; return fexp(x / d, -y / d); },
  exp_far_disc: fexp,
  ez2_disc: (x, y) => fexp(x * x - y * y, 2 * x * y),
  // exp(Log z), principal log (arg in (-pi, pi])
  healed_cut: (x, y) => fexp(0.5 * Math.log(x * x + y * y), Math.atan2(y, x)),
  // artanh z = (1/2) Log((1 + z)/(1 - z)); arctan z = (i/2) Log((1 - iz)/(1 + iz)) = -i artanh(iz)
  atanh_D: (x, y) => fatanh(x, y),
  atan_D: (x, y) => { const [a, b] = fatanh(-y, x); return [b, -a]; },
  cube_far_deep: (x, y) => [x * x * x - 3 * x * y * y, 3 * x * x * y - y * y * y],
  // (z^2 - 1)/(z^2 + 1) and (z + 1/z)/2, written out in real arithmetic
  rat9: (x, y) => { const a = x * x - y * y, b = 2 * x * y, d = (a + 1) * (a + 1) + b * b; return [((a - 1) * (a + 1) + b * b) / d, (b * (a + 1) - (a - 1) * b) / d]; },
  jouk_custom: (x, y) => { const d = x * x + y * y; return [(x + x / d) / 2, (y - y / d) / 2]; },
  // the zeros-and-poles step with zeros +-1 and pole 0: (z^2 - 1)/z = z - 1/z
  zp_disc: (x, y) => { const d = x * x + y * y; return [x - x / d, y + y / d]; },
  // Repeat x 3 of [z^2, + c], c = -0.3 + 0.2i (#229)
  quad3_disc: (x, y) => { let u = x, v = y; for (let k = 0; k < 3; k++) { const t = u * u - v * v - 0.3; v = 2 * u * v + 0.2; u = t; } return [u, v]; },
  // the Douady–Hubbard map Φ_M (#260) by the Böttcher product Φ_M(c) = c ∏_{k≥1} (1 + c/u_k²)^{1/2^k} (u_1 = c,
  // u_{k+1} = u_k² + c), each factor on its principal branch: valid where every |c/u_k²| < 1, which this disc's orbits
  // reach after a few steps; the first factors are taken by the continuation of the whole product along the segment
  // from c + 20 (far out, where all are small) to c (the factor's argument followed, never jumping by more than π/2)
  dh_disc: (x, y) => fdh(x, y),
};
// log Φ_M(c) - log c = Σ_k 2^{-k} log(1 + c/u_k²) with u_k the orbit of c (u_1 = c); each term's logarithm is the one
// continued from far out: from the previous point when it is within 0.01 (the samplers go row by row), else along
// c + 20 t for t from 1 down to 0 in 400 steps; each term kept within half its period (2π / 2^k) of where it was
const DH_LAST = { x: NaN, y: NaN, t: null };
function fdhTerms(cx, cy) {
  const out = [];
  let ux = cx, uy = cy;
  for (let k = 1; k <= 60; k++) {
    const d = ux * ux + uy * uy;
    if (d > 1e60) break;
    // c/u² = c conj(u)² / |u|⁴
    const vx = ux * ux - uy * uy, vy = -2 * ux * uy, qx = (cx * vx - cy * vy) / (d * d), qy = (cx * vy + cy * vx) / (d * d);
    out.push([0.5 * Math.log((1 + qx) * (1 + qx) + qy * qy) / 2 ** k, Math.atan2(qy, 1 + qx) / 2 ** k, 2 * Math.PI / 2 ** k]);
    const nx = ux * ux - uy * uy + cx; uy = 2 * ux * uy + cy; ux = nx;
  }
  return out;
}
function fdhFollow(t, prev) {
  for (let k = 0; k < t.length && k < prev.length; k++) {
    while (t[k][1] - prev[k][1] > t[k][2] / 2) t[k][1] -= t[k][2];
    while (t[k][1] - prev[k][1] < -t[k][2] / 2) t[k][1] += t[k][2];
  }
  return t;
}
function fdh(x, y) {
  let prev;
  if (Math.hypot(x - DH_LAST.x, y - DH_LAST.y) < 0.01) prev = DH_LAST.t;
  else { prev = fdhTerms(x + 20, y); for (let j = 399; j >= 1; j--) prev = fdhFollow(fdhTerms(x + 20 * j / 400, y), prev); }
  const t = fdhFollow(fdhTerms(x, y), prev);
  DH_LAST.x = x; DH_LAST.y = y; DH_LAST.t = t;
  let lr = 0.5 * Math.log(x * x + y * y), li = Math.atan2(y, x);
  for (const [a, b] of t) { lr += a; li += b; }
  const m = Math.exp(lr);
  return [m * Math.cos(li), m * Math.sin(li)];
}
function fatanh(x, y) {
  // (1 + z)/(1 - z) = ((1 + x) + iy)((1 - x) + iy) / |1 - z|^2 = (1 - x^2 - y^2 + 2iy) / ((1 - x)^2 + y^2)
  const d = (1 - x) * (1 - x) + y * y, re = (1 - x * x - y * y) / d, im = 2 * y / d;
  return [0.25 * Math.log(re * re + im * im), 0.5 * Math.atan2(im, re)];
}
// the scenes whose truth works in the w-plane (pre(w) = [w]): the region in z, and the window of w that float64 resolves
const ZREG = { atanh_D: (z) => z.re * z.re + z.im * z.im < 1, atan_D: (z) => z.re * z.re + z.im * z.im < 1 };
const ZWIN = { atanh_D: (w) => Math.abs(w.re) <= 16, atan_D: (w) => Math.abs(w.im) <= 16 };
// z = tanh w (tan w = -i tanh(iw)) in float64: w = x + iy, tanh w = (sinh 2x + i sin 2y) / (cosh 2x + cos 2y)
const ftanh = (x, y) => { const d = Math.cosh(2 * x) + Math.cos(2 * y); return { re: Math.sinh(2 * x) / d, im: Math.sin(2 * y) / d }; };
const ZOF = { atanh_D: (w) => ftanh(w.re, w.im), atan_D: (w) => { const t = ftanh(-w.im, w.re); return { re: t.im, im: -t.re }; } };

// ---- samplers: call put(x, y) for points of the region (or of a part of it whose image covers the view) ----
// s: px per w unit of the view, R: the view's half-diagonal in w units (|w| beyond it is off the view)
const STEP_PX = 0.4;
const SAMPLERS = {
  // polar parameters (ln r, theta), theta in (0, pi): ln r over one full turn of Arg w (+ overlap); |dw| <= |w| |d|
  zi_H: (put, s) => {
    const st = STEP_PX / s;     // |w| < 1
    for (let th = st / 2; th < PI; th += st) for (let lr = -PI - 0.05; lr <= PI + 0.05; lr += st) { const r = Math.exp(lr); put(r * Math.cos(th), r * Math.sin(th)); }
  },
  // z = x + iy, y in (0, 2 pi] (one period of exp covers every w != 0 once), x from |w| = 0.3 px to beyond the view
  expH: (put, s, R) => {
    for (let x = Math.log(0.3 / s); x <= Math.log(1.2 * R);) {
      const st = STEP_PX / (s * Math.exp(x));
      for (let y = st / 2; y <= TAU + st; y += st) put(x, y);
      x += st;
    }
  },
  // u = 1/z = x + iy with y in [20, 20 + 2 pi): |u| >= 20, so z = 1/u is in the unit disc; exp(u) covers the view
  e1z_disc: (put, s, R) => {
    for (let x = Math.log(0.3 / s); x <= Math.log(1.2 * R);) {
      const st = STEP_PX / (s * Math.exp(x));
      for (let y = 20; y < 20 + TAU + st; y += st) { const d = x * x + y * y; put(x / d, -y / d); }
      x += st;
    }
  },
  exp_far_disc: (put, s) => grid(put, 0, 60, 1, STEP_PX / (s * Math.E)),
  // |F'| = |2z| |e^{z^2}| <= 2 (|3+3i| + 0.3) e^{2 |3+3i| 0.3 + 0.09} on the disc
  ez2_disc: (put, s) => grid(put, 3, 3, 0.3, STEP_PX / (s * 2 * (Math.hypot(3, 3) + 0.3) * Math.exp(2 * Math.hypot(3, 3) * 0.3 + 0.09))),
  healed_cut: (put, s) => grid(put, -1, 0, 0.6, STEP_PX / s),
  // |F'| = 8 |z| |u_1| |u_2| <= 8 * 1.03 * 1.42 * 2.37 < 28 on the disc (|z| <= |0.2 + 0.1i| + 0.8)
  quad3_disc: (put, s) => grid(put, 0.2, 0.1, 0.8, STEP_PX / (s * 28)),
  // |Φ_M'| < 2.17 on the disc (sampled at 20000 points: 2.16)
  dh_disc: (put, s) => grid(put, 0.6, 0.9, 0.3, STEP_PX / (s * 2.5)),
};
SAMPLERS.e1z_custom = SAMPLERS.e1z_disc;
// artanh: z = tanh u over a grid of u (the parametrisation only places the samples: each is mapped with the forward
// formula above), |Im u| < pi/4 + 0.05 and |Re u| to 17, kept when |z| < 1; |dw| = |du| / |1 - z^2| |dz| ...: the
// grid step is in u = w directly (dw/du = 1 up to rounding), so 0.4 px spacing in w
SAMPLERS.atanh_D = (put, s) => {
  const st = STEP_PX / s;
  for (let v = -PI / 4 - 0.05; v <= PI / 4 + 0.05; v += st) for (let u = -17; u <= 17; u += st) { const z = ftanh(u, v); if (z.re * z.re + z.im * z.im < 1) put(z.re, z.im); }
};
SAMPLERS.atan_D = (put, s) => {
  const st = STEP_PX / s;
  for (let u = -PI / 4 - 0.05; u <= PI / 4 + 0.05; u += st) for (let v = -17; v <= 17; v += st) { const z = ZOF.atan_D({ re: u, im: v }); if (z.re * z.re + z.im * z.im < 1) put(z.re, z.im); }
};
// z^3 near z0 = 3.5 + 3i (the view's centre is z0^3): a box of z around z0 that maps over the whole view (|F'| =
// 3|z|^2 >= 3 (|z0| - h)^2), sampled at 0.4 px / max |F'|, kept in the disc
SAMPLERS.cube_far_deep = (put, s, R) => {
  const z0 = [3.5, 3], a = Math.hypot(z0[0], z0[1]), view = Math.hypot(W, H) / 2 / s;
  const h = 1.3 * view / (3 * (a - 0.01) ** 2), st = STEP_PX / (s * 3 * (a + h) ** 2);
  for (let y = z0[1] - h; y <= z0[1] + h; y += st) for (let x = z0[0] - h; x <= z0[0] + h; x += st) if ((x - 3) ** 2 + (y - 3) ** 2 < 0.25) put(x, y);
};
// rational maps: a quadtree over the box [x0, x0 + size] x [y0, y0 + size] (cells kept by keep(x, y)); bound(xc, yc, r)
// is an upper bound of |F'| over the disc of radius r around the cell centre, Infinity near a pole (the cell is split);
// far(xc, yc, r) is true when the cell's image lies off the view (|w| > R everywhere on it)
function quad(put, x0, y0, size, s, keep, bound, far, depth = 0) {
  const r = size * Math.SQRT1_2, xc = x0 + size / 2, yc = y0 + size / 2;
  if (far(xc, yc, r)) return;
  const b = bound(xc, yc, r), st = STEP_PX / (s * b);
  if (!(st >= size / 256) && depth < 40) {
    const h = size / 2;
    for (const [dx, dy] of [[0, 0], [h, 0], [0, h], [h, h]]) quad(put, x0 + dx, y0 + dy, h, s, keep, bound, far, depth + 1);
    return;
  }
  if (!(st > 0)) return;
  for (let y = y0 + st / 2; y < y0 + size; y += st) for (let x = x0 + st / 2; x < x0 + size; x += st) if (keep(x, y)) put(x, y);
}
// |z^2 +- 1| over D(zc, r): |zc^2 +- 1| -+ r (2 |zc| + r)
const z2pm = (xc, yc, r, sg) => { const a = xc * xc - yc * yc + sg, b = 2 * xc * yc, m = Math.hypot(a, b), dl = r * (2 * Math.hypot(xc, yc) + r); return [m - dl, m + dl]; };
SAMPLERS.rat9 = (put, s, R) => quad(put, -1.5, -1.5, 3, s, (x, y) => Math.abs(x) < 1.5 && Math.abs(y) < 1.5,
  // F' = 4z/(z^2 + 1)^2
  (xc, yc, r) => { const lo = z2pm(xc, yc, r, 1)[0]; return lo > 0 ? 4 * (Math.hypot(xc, yc) + r) / (lo * lo) : Infinity; },
  (xc, yc, r) => { const nm = z2pm(xc, yc, r, -1)[0], dn = z2pm(xc, yc, r, 1)[1]; return nm > 1.05 * R * dn; });
// the exterior of the airfoil circle; |w| = |z + 1/z|/2 >= (|z| - 1)/2: |z| > 2R + 1 is off the view
const JC = [-0.12, 0.1], JR = 1.1244998888;
SAMPLERS.jouk_custom = (put, s, R) => { const L = 2 * R + 2; quad(put, -L, -L, 2 * L, s, (x, y) => Math.hypot(x - JC[0], y - JC[1]) > JR,
  // F' = (1 - 1/z^2)/2, the circle keeps |z| >= JR - |JC| > 0.97
  (xc, yc, r) => { const m = Math.max(0.97, Math.hypot(xc, yc) - r); return (1 + 1 / (m * m)) / 2; },
  (xc, yc, r) => (Math.hypot(xc, yc) - r - 1) / 2 > 1.05 * R || Math.hypot(xc - JC[0], yc - JC[1]) + r < JR); };
// the disc |z - 1.2i| < 0.8 keeps |z| >= 0.4: |F'| = |1 + 1/z^2| <= 1 + 1/(|zc| - r)^2 on a cell
SAMPLERS.zp_disc = (put, s) => quad(put, -0.8, 0.4, 1.6, s, (x, y) => Math.hypot(x, y - 1.2) < 0.8,
  (xc, yc, r) => { const m = Math.max(0.4, Math.hypot(xc, yc) - r); return 1 + 1 / (m * m); }, () => false);
function grid(put, cx, cy, r, st) {
  for (let y = cy - r + st / 2; y < cy + r; y += st) for (let x = cx - r + st / 2; x < cx + r; x += st) if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) put(x, y);
}
// random points of the region for (C): a box per scene (the region intersected with it)
const RAND_BOX = {
  zi_H: [-5, 5, 1e-3, 5], expH: [-4, 3, 1e-3, 20], e1z_disc: [-1, 1, -1, 1], e1z_custom: [-1, 1, -1, 1],
  exp_far_disc: [-1, 1, 59, 61], ez2_disc: [2.7, 3.3, 2.7, 3.3], healed_cut: [-1.6, -0.4, -0.6, 0.6],
  atanh_D: [-1, 1, -1, 1], atan_D: [-1, 1, -1, 1], cube_far_deep: [2.5, 3.5, 2.5, 3.5],
  rat9: [-1.5, 1.5, -1.5, 1.5], jouk_custom: [-4, 4, -4, 4], zp_disc: [-0.8, 0.8, 0.4, 2], quad3_disc: [-0.6, 1, -0.7, 0.9], dh_disc: [0.3, 0.9, 0.6, 1.2],
};


// ---- (F) own model of the inverse renderer's pattern (SPEC 5 sheet order + the app's patterns) ----
// members of the region over w, with this file's own formulas (wider index ranges than the truths enumerate)
const lnabs = (w) => 0.5 * Math.log(w.re * w.re + w.im * w.im), argw = (w) => Math.atan2(w.im, w.re);
const MEMBERS = {
  zi_H: (w) => { const t = -lnabs(w), a = argw(w), o = []; if (!(t > 0 && t < PI)) return o; for (let m = -8; m <= 8; m++) { const R = Math.exp(a + TAU * m); o.push({ re: R * Math.cos(t), im: R * Math.sin(t) }); } return o; },
  expH: (w) => { const o = []; for (let m = -3; m <= 12; m++) { const z = { re: lnabs(w), im: argw(w) + TAU * m }; if (z.im > 0) o.push(z); } return o; },
  e1z_disc: (w) => { const o = []; for (let m = -12; m <= 12; m++) { const x = lnabs(w), y = argw(w) + TAU * m, d = x * x + y * y; const z = { re: x / d, im: -y / d }; if (Math.hypot(z.re, z.im) < 1) o.push(z); } return o; },
  exp_far_disc: (w) => { const o = []; for (let m = 0; m <= 20; m++) { const z = { re: lnabs(w), im: argw(w) + TAU * m }; if (Math.hypot(z.re, z.im - 60) < 1) o.push(z); } return o; },
  ez2_disc: (w) => {
    const o = [];
    for (let m = -4; m <= 10; m++) {
      const x = lnabs(w), y = argw(w) + TAU * m, r = Math.sqrt(Math.hypot(x, y)), h = Math.atan2(y, x) / 2;
      for (const sg of [1, -1]) { const z = { re: sg * r * Math.cos(h), im: sg * r * Math.sin(h) }; if (Math.hypot(z.re - 3, z.im - 3) < 0.3) o.push(z); }
    }
    return o;
  },
  healed_cut: (w) => (Math.hypot(w.re + 1, w.im) < 0.6 ? [{ re: w.re, im: w.im }] : []),
};
MEMBERS.e1z_custom = MEMBERS.e1z_disc;
// z^2 = (1 + w)/(1 - w): both square roots in the square; z = w +- sqrt(w - 1) sqrt(w + 1) outside the circle
const csq = (a, b) => { const r = Math.sqrt(Math.hypot(a, b)), t = Math.atan2(b, a) / 2; return [r * Math.cos(t), r * Math.sin(t)]; };
MEMBERS.rat9 = (w) => {
  const d = (1 - w.re) * (1 - w.re) + w.im * w.im;
  if (!(d > 0)) return [];
  const [x, y] = csq(((1 + w.re) * (1 - w.re) - w.im * w.im) / d, (w.im * (1 - w.re) + (1 + w.re) * w.im) / d);
  return [{ re: x, im: y }, { re: -x, im: -y }].filter((z) => Math.abs(z.re) < 1.5 && Math.abs(z.im) < 1.5);
};
MEMBERS.jouk_custom = (w) => {
  const [a, b] = csq(w.re - 1, w.im), [c, e] = csq(w.re + 1, w.im), s = [a * c - b * e, a * e + b * c];
  return [{ re: w.re + s[0], im: w.im + s[1] }, { re: w.re - s[0], im: w.im - s[1] }].filter((z) => Math.hypot(z.re - JC[0], z.im - JC[1]) > JR);
};
// z^2 - wz - 1 = 0: z = (w +- sqrt(w^2 + 4))/2, in the disc
MEMBERS.zp_disc = (w) => {
  const [a, b] = csq(w.re * w.re - w.im * w.im + 4, 2 * w.re * w.im);
  return [{ re: (w.re + a) / 2, im: (w.im + b) / 2 }, { re: (w.re - a) / 2, im: (w.im - b) / 2 }].filter((z) => Math.hypot(z.re, z.im - 1.2) < 0.8);
};
// (z^2 + c)^{-3} of w: the 8 branches of the three square roots, kept in the disc |z - (0.2 + 0.1i)| < 0.8
MEMBERS.quad3_disc = (w) => {
  let zs = [[w.re, w.im]];
  for (let k = 0; k < 3; k++) zs = zs.flatMap(([a, b]) => { const [x, y] = csq(a + 0.3, b - 0.2); return [[x, y], [-x, -y]]; });
  return zs.filter(([x, y]) => Math.hypot(x - 0.2, y - 0.1) < 0.8).map(([x, y]) => ({ re: x, im: y }));
};
// Φ_M is one-to-one: the member is the z in the disc with fdh(z) = w, by Newton (the derivative by differences), from
// the last member found when it was for a w within 0.01, else along the segment from Φ_M(0.6 + 0.9i) to w in 16 steps;
// none outside the box of fdh of the disc's circle (widened by 0.02), and none unless fdh(z) = w to 1e-10
const DHM_BOX = (() => {
  const b = [Infinity, -Infinity, Infinity, -Infinity];
  for (let i = 0; i < 720; i++) { const a = TAU * i / 720, [u, v] = fdh(0.6 + 0.3 * Math.cos(a), 0.9 + 0.3 * Math.sin(a)); b[0] = Math.min(b[0], u - 0.02); b[1] = Math.max(b[1], u + 0.02); b[2] = Math.min(b[2], v - 0.02); b[3] = Math.max(b[3], v + 0.02); }
  return b;
})();
const DHM_LAST = { w: null, z: null };
function dhSolve(z, w) {
  for (let it = 0; it < 40; it++) {
    const f = fdh(z.re, z.im), h = 1e-7, g = fdh(z.re + h, z.im), d = [(g[0] - f[0]) / h, (g[1] - f[1]) / h], e = [f[0] - w.re, f[1] - w.im], dd = d[0] * d[0] + d[1] * d[1];
    const dz = { re: (e[0] * d[0] + e[1] * d[1]) / dd, im: (e[1] * d[0] - e[0] * d[1]) / dd };
    z = { re: z.re - dz.re, im: z.im - dz.im };
    if (!(Math.hypot(dz.re, dz.im) > 1e-14)) break;
  }
  return z;
}
// (the check evaluates fdh afresh, along its whole path from far out: a branch followed from the previous point can be
// wrong near M, where a factor turns by more than half its period within 0.01, and Newton then finds a z on it)
const fdhFresh = (x, y) => { DH_LAST.x = NaN; return fdh(x, y); };
MEMBERS.dh_disc = (w) => {
  if (w.re < DHM_BOX[0] || w.re > DHM_BOX[1] || w.im < DHM_BOX[2] || w.im > DHM_BOX[3]) return [];
  const ok = (z) => { const f = fdhFresh(z.re, z.im); return Math.hypot(f[0] - w.re, f[1] - w.im) <= 1e-10 * Math.hypot(w.re, w.im); };
  const fromCentre = () => {
    const [u0, v0] = fdhFresh(0.6, 0.9);
    let z = { re: 0.6, im: 0.9 };
    for (let j = 1; j <= 16; j++) z = dhSolve(z, { re: u0 + (w.re - u0) * j / 16, im: v0 + (w.im - v0) * j / 16 });
    return z;
  };
  let z = DHM_LAST.w && Math.hypot(w.re - DHM_LAST.w.re, w.im - DHM_LAST.w.im) < 0.01 ? dhSolve(DHM_LAST.z, w) : fromCentre();
  if (!ok(z)) { z = fromCentre(); if (!ok(z)) return []; }
  DHM_LAST.w = { re: w.re, im: w.im }; DHM_LAST.z = z;
  return Math.hypot(z.re - 0.6, z.im - 0.9) < 0.3 ? [z] : [];
};
// the w-plane scenes: the member is carried as u = w, as their truth does (the self-test paints a mask there)
MEMBERS.atanh_D = (w) => (Math.abs(w.im) < PI / 4 ? [{ re: w.re, im: w.im }] : []);
MEMBERS.atan_D = (w) => (Math.abs(w.re) < PI / 4 ? [{ re: w.re, im: w.im }] : []);
MEMBERS.cube_far_deep = (w) => {
  const r = Math.cbrt(Math.hypot(w.re, w.im)), t = Math.atan2(w.im, w.re) / 3, o = [];
  for (let j = 0; j < 3; j++) { const z = { re: r * Math.cos(t + j * TAU / 3), im: r * Math.sin(t + j * TAU / 3) }; if ((z.re - 3) ** 2 + (z.im - 3) ** 2 < 0.25) o.push(z); }
  return o;
};
// SPEC 3.7: the accumulation sets (z^i and e^{1/z}: {0}; the others none)
const ACCUM = { zi_H: [[0, 0]], e1z_disc: [[0, 0]], e1z_custom: [[0, 0]] };
// the left view's box at 410 x 516 px (the meshing window clipWin of the saved state)
const winOf = (sc) => { const v = sc.srcView; return [v.cx - 205 / v.s, v.cx + 205 / v.s, v.cy - 258 / v.s, v.cy + 258 / v.s]; };
// SPEC 5.1 written out again: D = log2(1 + dist(z, W) / R) + sum_p max(0, log2(rs / |z - p|)), rs = R / 8
function keyOf(sc) {
  const [x0, x1, y0, y1] = winOf(sc), R = Math.hypot(x1 - x0, y1 - y0) / 2, rs = R / 8, P = ACCUM[sc.base] || [];
  return (z) => {
    const dx = z.re < x0 ? x0 - z.re : z.re > x1 ? z.re - x1 : 0, dy = z.im < y0 ? y0 - z.im : z.im > y1 ? z.im - y1 : 0;
    let D = Math.log2(1 + Math.sqrt(dx * dx + dy * dy) / R);
    for (const [px, py] of P) { const d = Math.hypot(z.re - px, z.im - py); if (d < rs) D += Math.log2(rs / d); }
    return D;
  };
}
const dFnum = (base, z) => { const f = FWD[base], h = 1e-7 * Math.max(1, Math.hypot(z.re, z.im)), a = f(z.re, z.im), b = f(z.re + h, z.im); return Math.hypot(b[0] - a[0], b[1] - a[1]) / h; };
// the displayed pattern at w: {inside, par (0 c0 | 1 alt | -1 averaged), front, members, disc (front in the c0 disc)}
// mode 'checker' (planar, cell) or 'polar' (16 sectors, solid c0 for |z| < cell/12); which = 0 front, 1 the member
// behind it (a defect for the self-test); rc: false paints the polar pattern without its c0 disc (a defect)
function displayed(sc, w, mode, cell, spx, which = 0, rc = true) {
  const ms = MEMBERS[sc.base](w);
  if (!ms.length) return { inside: false };
  const key = keyOf(sc);
  const ord = ms.map((z) => ({ z, D: key(z) })).sort((a, b) => (a.D !== b.D ? a.D - b.D : b.z.im !== a.z.im ? b.z.im - a.z.im : b.z.re - a.z.re));
  const f = ord[Math.min(which, ord.length - 1)].z;
  const sc_ = dFnum(sc.base, f) * spx;
  if (mode === 'polar') {
    const r = Math.hypot(f.re, f.im);
    if (rc && r < cell / 12) return { inside: true, par: 0, front: f, disc: true, n: ms.length };
    const gx = Math.log(r) * 16 / TAU, gy = Math.atan2(f.im, f.re) * 16 / TAU;
    if (r * TAU / 16 * sc_ < 2) return { inside: true, par: -1, front: f, n: ms.length };
    return { inside: true, par: (((Math.floor(gx) + Math.floor(gy)) % 2) + 2) % 2, front: f, n: ms.length };
  }
  if (cell * sc_ < 2) return { inside: true, par: -1, front: f, n: ms.length };
  return { inside: true, par: (((Math.floor(f.re / cell) + Math.floor(f.im / cell)) % 2) + 2) % 2, front: f, n: ms.length };
}
// (F) for a scene view: compare the model with the parity metrics.js would score
function frontCheck(sc, map, mode) {
  const run = SC.runs([sc.name]).find((r) => r.scene === sc && (mode === 'polar' ? r.parity === 'polar' : r.variant === 'pattern'));
  if (!run) return null;
  const T = M.truthGrid(sc.truth, run.cell, map, W, H, { parity: run.parity, sheet: run.sheet, rc: run.rc });
  let n = 0, bad = 0, disc = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    if (!(T.parity[k] >= 0 && T.cellPx[k] >= M.PARITY_MIN_CELL && T.edgePx[k] >= M.PARITY_MIN_EDGE) || Math.abs(T.sdf[k]) <= M.BAND) continue;
    const d = displayed(sc, map.at(i, j), mode === 'polar' ? 'polar' : 'checker', run.cell * run.state.patternScale, map.spx, 0, mode !== 'polar' || run.rc > 0);
    n++;
    if (d.disc) disc++;
    if (!d.inside || d.par !== T.parity[k]) bad++;
  }
  return { n, bad, disc };
}

function appMap(sc) {
  global.CX = global.CX || require(path.join(ROOT, 'src/cx.js'));
  global.Expr = global.Expr || require(path.join(ROOT, 'src/parse.js'));
  const Funcs = global.Funcs || (global.Funcs = require(path.join(ROOT, 'src/funcs.js')));
  // (a step's Repeat × N as the app runs it: Funcs.applyRepeats, quad3_disc's [z², + c] three times)
  const steps = sc.steps.map((st) => Object.assign({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true }, st.repeat ? { repeat: Object.assign({}, st.repeat) } : {}));
  const built = Funcs.applyRepeats(steps, steps.map((st) => Funcs.build(st)));
  built.forEach((b, i) => { if (b.error || typeof b.f !== 'function') throw new Error(`${sc.name}: step ${steps[i].type} does not build: ${b.error}`); });
  const F = Funcs.stageFunctions(steps, built)[steps.length];
  return (x, y) => { const z = F({ re: x, im: y }); return [z.re, z.im]; };
}

// a tiny seeded PRNG (mulberry32), so every run checks the same points
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function verify(sc) {
  const out = { scene: sc.name, base: sc.base, ok: true, notes: [] };
  const fwd = FWD[sc.base], sampler = SAMPLERS[sc.base];
  if (!fwd || !sampler) throw new Error(`no forward map / sampler for ${sc.base}`);
  const v = sc.rightView, s = v.s, R = Math.hypot(W, H) / 2 / s + Math.hypot(v.cx, v.cy);
  const map = { at: (i, j) => ({ re: v.cx + (i + 0.5 - W / 2) / s, im: v.cy - (j + 0.5 - H / 2) / s }), spx: s };
  const T = M.truthGrid(sc.truth, SC.cellOf(sc), map, W, H, { parity: null });
  const hit = new Uint8Array(W * H);
  let n = 0, inView = 0, inHole = 0;
  const hd = sc.truth.holeDisc;
  const t0 = Date.now();
  sampler((x, y) => {
    n++;
    const [wr, wi] = fwd(x, y);
    if (hd && Math.hypot(wr - hd.c[0], wi - hd.c[1]) < hd.r * (1 - 1e-9)) inHole++;
    const i = Math.floor((wr - v.cx) * s + W / 2), j = Math.floor(H / 2 - (wi - v.cy) * s);
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    inView++;
    hit[j * W + i] = 1;
  }, s, R);
  let hitOutside = 0, missInside = 0, nInDeep = 0, outWin = 0;
  const zwin = ZWIN[sc.base];
  for (let k = 0; k < W * H; k++) {
    if (zwin && !zwin(map.at(k % W, (k / W) | 0))) { outWin++; continue; }
    const d = T.sdf[k];
    if (hit[k] && !T.inside[k] && d < -1.0) hitOutside++;
    if (T.inside[k] && d > 1.5) { nInDeep++; if (!hit[k]) missInside++; }
  }
  // (B) soundness of every accepted candidate at every pixel centre; (B') for the w-plane scenes: inside per the truth
  // <=> tanh w (tan w) in the unit disc, where float64 resolves it
  let maxRes = 0, nCand = 0, zBad = 0, zN = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const w = map.at(i, j);
    if (ZOF[sc.base]) {
      if (!zwin(w)) continue;
      const z = ZOF[sc.base](w), m = Math.hypot(z.re, z.im);
      if (!Number.isFinite(m) || Math.abs(m - 1) < 1e-9) continue;
      // w is in the image <=> z = tanh w lies in the disc and the forward map sends z back to w (not to w - k pi i:
      // tanh has period pi i; the branch test tolerates the float64 loss of artanh near |z| = 1)
      const [fr, fi] = fwd(z.re, z.im), back = Math.hypot(fr - w.re, fi - w.im) < 0.1;
      zN++;
      if ((m < 1 && back) !== !!T.inside[j * W + i]) zBad++;
      continue;
    }
    let cands = [];
    try { cands = sc.truth.pre(w).filter((z) => Number.isFinite(z.re) && Number.isFinite(z.im) && sc.truth.region(z)); } catch (e) { cands = []; }
    for (const z of cands) {
      nCand++;
      const [fr, fi] = fwd(z.re, z.im);
      maxRes = Math.max(maxRes, Math.hypot(fr - w.re, fi - w.im) / (1 + Math.hypot(w.re, w.im)));
    }
  }
  // (C) the app's own step functions, composed, agree with the forward formula
  const app = appMap(sc);
  const rnd = rng(12345), box = RAND_BOX[sc.base], zreg = ZREG[sc.base] || sc.truth.region;
  let appMax = 0, appN = 0;
  for (let t = 0; t < 200000 && appN < 2000; t++) {
    const x = box[0] + (box[1] - box[0]) * rnd(), y = box[2] + (box[3] - box[2]) * rnd();
    if (!zreg({ re: x, im: y })) continue;
    const [a, b] = app(x, y), [c, d] = fwd(x, y);
    if (!Number.isFinite(c) || !Number.isFinite(d)) continue;
    appN++;
    appMax = Math.max(appMax, Math.hypot(a - c, b - d) / (1 + Math.hypot(c, d)));
  }
  // (D) polar parity of every member
  let polarN = 0, polarBad = 0;
  if (typeof sc.truth.parityAll === 'function') {
    const r2 = rng(777);
    for (let t = 0; t < 20000; t++) {
      const rr = Math.exp(-PI) + (1 - Math.exp(-PI)) * r2(), a = -PI + TAU * r2(), w = { re: rr * Math.cos(a), im: rr * Math.sin(a) };
      const p = sc.truth.parityAll(w);
      if (p.edge < 1e-9 * p.cell) continue;
      for (const z of sc.truth.pre(w)) {
        if (!sc.truth.region(z)) continue;
        const gx = Math.log(Math.hypot(z.re, z.im)) * 16 / TAU, gy = Math.atan2(z.im, z.re) * 16 / TAU;
        const par = (((Math.floor(gx) + Math.floor(gy)) % 2) + 2) % 2;
        polarN++;
        if (par !== p.par) polarBad++;
      }
    }
  }
  // (F) the displayed pattern of the front sheet (planar checker; log-polar with its c0 disc where the scene has it)
  const fc = frontCheck(sc, map, 'checker'), fp = typeof sc.truth.parityAll === 'function' ? frontCheck(sc, map, 'polar') : null;
  Object.assign(out, { view: v, samples: n, samples_in_view: inView, ms: Date.now() - t0, inside_deep_px: nInDeep, hit_outside: hitOutside, miss_inside: missInside,
    cand_checked: nCand, pre_max_residual: maxRes, z_checked: zN, z_bad: zBad, out_window_px: outWin, app_points: appN, app_max_residual: appMax, polar_members: polarN, polar_bad: polarBad, hole_samples: hd ? inHole : null,
    front_px: fc ? fc.n : null, front_bad: fc ? fc.bad : null, polar_front_px: fp ? fp.n : null, polar_front_bad: fp ? fp.bad : null, polar_front_disc: fp ? fp.disc : null });
  if (hitOutside) { out.ok = false; out.notes.push(`${hitOutside} hit pixels outside the truth`); }
  if (missInside) { out.ok = false; out.notes.push(`${missInside} deep interior pixels never hit`); }
  if (!(maxRes <= 1e-9)) { out.ok = false; out.notes.push(`pre() residual ${maxRes}`); }
  if (ZOF[sc.base]) {
    if (zBad || zN < 1000) { out.ok = false; out.notes.push(`tanh/tan check: ${zBad} of ${zN} pixel centres disagree with the truth`); }
    out.notes.push(`(B') ${zN} px by tanh/tan; ${outWin} px beyond the float64 window`);
  }
  if (appN < 1000 || !(appMax <= 1e-9)) { out.ok = false; out.notes.push(`app map disagrees (${appN} points, max ${appMax})`); }
  if (polarBad) { out.ok = false; out.notes.push(`${polarBad} members with another polar parity`); }
  if (hd && inHole) { out.ok = false; out.notes.push(`${inHole} forward samples inside the hole disc`); }
  if (fc && fc.bad) { out.ok = false; out.notes.push(`front-sheet checker: ${fc.bad} of ${fc.n} scored pixels disagree with the model`); }
  if (fp && fp.bad) { out.ok = false; out.notes.push(`front-sheet polar parity: ${fp.bad} of ${fp.n} scored pixels disagree with the model`); }
  if (!nInDeep) out.notes.push('no deep interior pixel in view');
  return out;
}

// ---- metric self-test on synthetic renders ----
const hexc = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const COLS = { c0: hexc('#3B6FD4'), alt: hexc('#8CABE5'), plane: hexc('#FCFDFD'), edge: hexc('#093B9B') };   // metrics.js defaults (light theme)
const mixc = (a, b, t) => a.map((x, q) => Math.round(t * x + (1 - t) * b[q]));
// paint a render of a run: the ideal renderer (model (F)) or one with a deliberate defect; returns the metrics
function paint(run, defect) {
  const sc = run.scene, v = sc.rightView, s = v.s;
  const map = { at: (i, j) => ({ re: v.cx + (i + 0.5 - W / 2) / s, im: v.cy - (j + 0.5 - H / 2) / s }), spx: s };
  const T = M.truthGrid(sc.truth, run.cell, map, W, H, { parity: run.parity, sheet: run.sheet, rc: run.rc, annot: run.strict });
  const rgba = Buffer.alloc(W * H * 4);
  const hd = sc.truth.holeDisc;
  const mode = run.parity === 'polar' ? 'polar' : 'checker', cell = run.cell * run.state.patternScale;
  const which = defect === 'back' ? 1 : 0, rc = defect !== 'norc' && (run.parity !== 'polar' || run.rc > 0);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, w = map.at(i, j);
    let col = COLS.plane;
    if (defect !== 'band') {
      const d = displayed(sc, w, mode, cell, s, which, rc);
      if (d.inside && defect !== 'blank') {
        let par = run.kind === 'pattern' ? d.par : 0;
        if (defect === 'flip' && par >= 0) par = 1 - par;
        col = par === 1 ? COLS.alt : par === 0 ? COLS.c0 : mixc(COLS.c0, COLS.alt, 0.5);
        if (defect === 'alpha') col = mixc(col, COLS.plane, 0.2);
        if (defect === 'crack' && j === Math.round(H / 2 - (0 - v.cy) * s - 0.5)) col = mixc(col, COLS.plane, 0.75);
        if (defect === 'dark85') col = col.map((c) => Math.round(0.85 * c));
        if (defect === 'dark95') col = col.map((c) => Math.round(0.95 * c));
        if (defect === 'edge') col = COLS.edge;
      }
    }
    if (hd && Math.hypot(w.re - hd.c[0], w.im - hd.c[1]) < hd.r) {
      if (defect === 'leak') col = COLS.c0;
      if (defect === 'leak20') col = mixc(COLS.c0, COLS.plane, 0.2);
    }
    rgba[4 * k] = col[0]; rgba[4 * k + 1] = col[1]; rgba[4 * k + 2] = col[2]; rgba[4 * k + 3] = 255;
  }
  if (defect === 'band') T.sdf.fill(0);   // every pixel in the excluded band: nothing can be scored
  const ev = M.evaluate({ rgba, W, H, truthG: T, classify: M.makeClassifier({}, run.kind), variant: run.kind, parity: run.parity,
    opacity: run.opacity ? M.makeOpacity({}) : null, strict: run.strict, colorErr: run.strict ? M.makeColorErr({}, run.kind) : null });
  return Object.assign(ev.metrics, { problems: ev.problems });
}
function selftest() {
  const runs = SC.runs().filter((r) => !SC.LEGACY_GROUPS.has(r.scene.group));
  let bad = 0;
  const check = (id, what, ok, got) => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(24)} ${what.padEnd(46)} ${got}`); };
  const multi = (run) => ['zi_H', 'expH', 'e1z_disc', 'e1z_custom'].includes(run.scene.base);
  for (const run of runs) {
    const m = paint(run, null);
    const parOk = m.parity_acc === undefined || (m.parity_acc === 1 && (m.parity_n >= 1000 || m.parity_exp < 1000));
    const perfect = m.iou === 1 && m.hole === 0 && m.spill === 0 && parOk && (m.opacity_min == null || m.opacity_min === 1) && m.color_off === 0 && (m.hole_leak == null || m.hole_leak === 0);
    check(run.id, 'ideal render scores perfectly', perfect, JSON.stringify({ iou: m.iou, hole: m.hole, spill: m.spill, parity: m.parity_acc, parity_n: m.parity_n, parity_exp: m.parity_exp, opacity_min: m.opacity_min, color_off: m.color_off, hole_leak: m.hole_leak }));
    if (run.parity === 'polar') {
      const f = paint(run, 'flip'); check(run.id, 'flipped parity -> parity 0', f.parity_acc === 0 && f.parity_n > 0, `parity ${f.parity_acc} (n ${f.parity_n})`);
      // finding 3: the old truth ignored the app's c0 disc; a render without it must not score perfectly
      if (m.polar_front_disc_px > 0) { const g = paint(run, 'norc'); check(run.id, `no c0 disc (${m.polar_front_disc_px} px decided by it) -> < 1`, g.parity_acc < 1, `parity ${g.parity_acc} (n ${g.parity_n})`); }
    }
    // finding 7: the pattern of the front sheet is scored where several sheets overlap
    if (run.parity === 'front' && multi(run) && m.parity_exp >= 1000) { const f = paint(run, 'back'); check(run.id, 'the sheet behind the front -> parity < 0.95', f.parity_acc < 0.95 && f.parity_n >= 1000, `parity ${f.parity_acc} (n ${f.parity_n})`); }
    if (run.parity) { const f = paint(run, 'blank'); check(run.id, 'blank render -> parity null (not 1)', f.parity_acc === null && f.problems.some((p) => /parity scored on 0/.test(p)), `parity ${f.parity_acc}; ${f.problems.join('; ')}`); }
    if (run.scene.truth.holeDisc && run.variant === 'mask') { const f = paint(run, 'leak'); check(run.id, 'hole painted -> hole_leak = all', f.hole_leak === f.hole_leak_px, `hole_leak ${f.hole_leak}/${f.hole_leak_px}`); }
    // finding 8: one translucent sheet in the hole of the alpha-0.2 run
    if (run.scene.truth.holeDisc && run.variant === 'mask20') { const f = paint(run, 'leak20'); check(run.id, 'alpha-0.2 sheet in the hole -> hole_leak = all', f.hole_leak === f.hole_leak_px && f.hole_leak > 0, `hole_leak ${f.hole_leak}/${f.hole_leak_px}`); }
    if (run.opacity && run.variant === 'mask20') { const f = paint(run, 'alpha'); check(run.id, 'one sheet at alpha 0.2 -> opacity 0.2', Math.abs(f.opacity_min - 0.2) < 0.01 && f.iou < 0.01, `opacity_min ${f.opacity_min} iou ${f.iou}`); }
    if (run.opacity && run.scene.name === 'healed_cut') { const f = paint(run, 'crack'); check(run.id, 'crack at coverage 0.75 -> 0.75', Math.abs(f.opacity_min - 0.75) < 0.01 && f.iou === 1, `opacity_min ${f.opacity_min} iou ${f.iou} lt99 ${f.opacity_lt99}`); }
    // finding 1: a wrong fill colour (darker, or a stroke colour) never scores as perfect
    if (run.variant === 'mask' || run.variant === 'mask20' || run.variant === 'pattern' || run.variant === 'polar') {
      const d85 = paint(run, 'dark85'), d95 = paint(run, 'dark95'), e = paint(run, 'edge');
      // (healed_cut: the band around its dashed cut line, 3.7 % of the disc, allows stroke colours)
      check(run.id, 'fill 15 % darker -> holes, colour error', d85.hole > 0.95 && d85.iou < 0.01 && d85.color_off > 0.99, `hole ${d85.hole} iou ${d85.iou} color_off ${d85.color_off} opacity ${d85.opacity_min}`);
      check(run.id, 'fill 5 % darker -> colour error', d95.color_off > 0.99, `hole ${d95.hole} color_off ${d95.color_off} mean ${d95.color_err_mean}`);
      check(run.id, 'fill in the edge colour -> holes', e.hole > 0.95 && e.iou < 0.01 && e.color_off > 0.99, `hole ${e.hole} iou ${e.iou} color_off ${e.color_off}`);
    }
    // finding 1 (3): nothing to score is unknown (null with a problem), never a perfect 1
    if (run.variant === 'mask' || run.variant === 'pattern') {
      const f = paint(run, 'band');
      const nul = (k) => f[k] === undefined || f[k] === null;
      check(run.id, 'all pixels in the band -> null metrics', nul('opacity_min') && nul('color_off') && nul('parity_acc') && f.problems.length > 0, `opacity ${f.opacity_min} color_off ${f.color_off} parity ${f.parity_acc}; ${f.problems.length} problem(s)`);
    }
  }
  console.log(bad ? `\n${bad} self-test check(s) FAILED` : `\nall metric self-tests passed (${runs.length} runs)`);
  process.exitCode = bad ? 1 : 0;
}

function main() {
  if (process.argv.includes('--selftest')) { selftest(); return; }
  const want = process.argv.slice(2);
  const scenes = SC.SCENES.filter((sc) => !SC.LEGACY_GROUPS.has(sc.group) && (!want.length || want.some((f) => sc.name === f || sc.base === f)));
  let bad = 0;
  console.log('scene              samples(view)        inside px  hit_out  miss_in  pre_resid  app_resid(n)       polar(bad/n)  hole  front(bad/n)  polar-front(bad/n, disc)  ms');
  for (const sc of scenes) {
    const r = verify(sc);
    if (!r.ok) bad++;
    console.log(`${(r.ok ? 'ok  ' : 'FAIL') + ' ' + r.scene.padEnd(15)} ${String(r.samples).padStart(9)} (${String(r.samples_in_view).padStart(8)}) ${String(r.inside_deep_px).padStart(9)} ${String(r.hit_outside).padStart(8)} ${String(r.miss_inside).padStart(8)}  ${r.pre_max_residual.toExponential(1).padStart(8)}  ${r.app_max_residual.toExponential(1).padStart(8)} (${r.app_points})  ${r.polar_members ? `${r.polar_bad}/${r.polar_members}` : '-'}`.padEnd(118) +
      ` ${r.hole_samples == null ? '-' : r.hole_samples}  ${r.front_px == null ? '-' : `${r.front_bad}/${r.front_px}`}  ${r.polar_front_px == null ? '-' : `${r.polar_front_bad}/${r.polar_front_px}, ${r.polar_front_disc}`}  ${r.ms}` + (r.notes.length ? '  ! ' + r.notes.join('; ') : ''));
  }
  console.log(bad ? `\n${bad} scene view(s) FAILED` : `\nall ${scenes.length} scene views verified`);
  process.exitCode = bad ? 1 : 0;
}
if (require.main === module) main();
module.exports = { verify, FWD, SAMPLERS, MEMBERS, displayed };

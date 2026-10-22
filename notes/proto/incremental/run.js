'use strict';
// Runs the incremental-design prototype on the acceptance scenes and measures cost and image quality against the
// exact ground truth. Usage: node run.js [sceneFilter...] [--K=3] [--png]
const fs = require('fs');
const path = require('path');
const { build, CX, C } = require('./layer.js');

const PI = Math.PI;
const W = 410, H = 516;          // the plane size of the quality suite (1440x900, both planes shown)
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const step = (type, params = {}) => Funcs.build({ type, params });
const chain = (...fs_) => (z) => { for (const f of fs_) z = f(z); return z; };
const niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };

const Hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const abs = (w) => Math.hypot(w.re, w.im);
const clog = (w) => C(Math.log(abs(w)), Math.atan2(w.im, w.re));
const EPI = Math.exp(-PI);
// truth: inT(w) (in the true image), sdf(w) in w units (> 0 inside), pre(w) the preimage whose pattern the top sheet
// shows (single-valued cases only), polar: the pattern is the polar checker about 0 (z^i: every sheet agrees)
const SC = {
  zi_H: { shape: Hp, F: step('powa', { alpha: 'i', cut: 180, k: 0 }).f, src: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 180 },
    inT: (w) => abs(w) < 1 && abs(w) > EPI, sdf: (w) => Math.min(1 - abs(w), abs(w) - EPI), polar: true,
    // the polar checker of a preimage: ln r = arg w (+ 2 pi k), theta = -ln|w|
    polarOf: (w) => [Math.atan2(w.im, w.re), -Math.log(abs(w))] },
  log_H: { injective: true, shape: Hp, F: step('log', { cut: 180, k: 0 }).f, src: { cx: 0, cy: 1, s: 60 }, view: { cx: -0.18, cy: PI / 2, s: 97 },
    inT: (w) => w.im > 0 && w.im < PI, sdf: (w) => Math.min(w.im, PI - w.im), pre: (w) => CX.exp(w) },
  exp_H: { shape: Hp, F: step('exp').f, src: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 40 },
    inT: (w) => abs(w) > 0, sdf: (w) => Math.min(abs(w), 1 / abs(w)) },
  einv_disc: { shape: { kind: 'disc', c: [0, 0], r: 1 }, F: chain(step('recip').f, step('exp').f), src: { cx: 0, cy: 0, s: 110 }, view: { cx: 0, cy: 0, s: 40 },
    inT: (w) => abs(w) > 0, sdf: (w) => Math.min(abs(w), 1 / abs(w)) },
  exp_strip: { shape: { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, F: step('exp').f, src: { cx: 0, cy: 0, s: 52 }, view: { cx: 2, cy: 0, s: 40 },
    inT: (w) => w.re > 0, sdf: (w) => w.re, pre: (w) => clog(w) },
  cayley_H: { injective: true, shape: Hp, F: step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }).f, src: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 },
    inT: (w) => abs(w) < 1, sdf: (w) => 1 - abs(w), pre: (w) => CX.div(CX.mul(C(0, 1), CX.add(C(1), w)), CX.sub(C(1), w)) },
  sq_Q1: { shape: { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, F: step('pown', { n: 2 }).f, src: { cx: 0.6, cy: 0.6, s: 70 }, view: { cx: 0, cy: 2, s: 60 },
    inT: (w) => w.im > 0, sdf: (w) => w.im, pre: (w) => CX.sqrt(w) },
  sin_hs: { shape: { kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, F: step('sin').f, src: { cx: 0, cy: 1.25, s: 105 }, view: { cx: 0, cy: 2, s: 50 },
    inT: (w) => w.im > 0, sdf: (w) => w.im, pre: (w) => CX.asin(w) },
  recip_ext: { injective: true, shape: { kind: 'disc', c: [0, 0], r: 1, complement: true }, F: step('recip').f, src: { cx: 0, cy: 0, s: 60 }, view: { cx: 0, cy: 0, s: 180 },
    inT: (w) => abs(w) < 1 && abs(w) > 0, sdf: (w) => Math.min(1 - abs(w), abs(w)), pre: (w) => CX.inv(w) },
  sqrt_slit: { injective: true, shape: { kind: 'formula', expr: '|z|>0' }, F: step('root', { n: 2, cut: 180, k: 0 }).f, src: { cx: 0, cy: 0, s: 70 }, view: { cx: 1, cy: 0, s: 120 },
    inT: (w) => w.re > 0, sdf: (w) => w.re, pre: (w) => CX.mul(w, w) },
  // bounded controls (golden today): how much of their core would the layer claim?
  disc_cube: { shape: { kind: 'disc', c: [0.6, 0.3], r: 0.8 }, F: step('pown', { n: 3 }).f, src: { cx: 0.4, cy: 0.2, s: 120 }, view: { cx: 0.15, cy: 1, s: 74.5 }, control: true },
  annulus_log: { injective: true, shape: { kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, F: step('log', { cut: 180, k: 0 }).f, src: { cx: 0, cy: 0, s: 70 }, view: { cx: 0, cy: 0, s: 72 }, control: true },
  poly_mobius: { injective: true, shape: { kind: 'polygon', pts: [[-1.5, 0.3], [1.2, 0.2], [1.8, 1.4], [0.3, 2.2], [-1.2, 1.6]] }, F: step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }).f, src: { cx: 0.15, cy: 1.2, s: 80 }, view: { cx: 0, cy: 0, s: 200 }, control: true },
  joukowski: { shape: { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, F: step('joukowski').f, src: { cx: 0, cy: 0, s: 70 }, view: { cx: 0, cy: 0, s: 117 }, control: true },
};
// the views of each scene: default, zoomed out 4x and 16x (plus the zooms of the quality suite)
function viewsOf(name, sc) {
  if (sc.control) return [['default', sc.view]];
  const v = sc.view, out = [['default', v], ['out4', Object.assign({}, v, { s: v.s / 4 })], ['out16', Object.assign({}, v, { s: v.s / 16 })]];
  if (name === 'cayley_H') out.push(['zoom64_w1', { cx: 1, cy: 0, s: 190 * 64 }]);
  if (name === 'zi_H') { out.push(['zoom8_hole', { cx: 0, cy: 0, s: 180 * 8 }]); out.push(['zoom8_rim', { cx: Math.exp(-Math.PI), cy: 0, s: 180 * 32 }]); }
  if (name === 'recip_ext') out.push(['zoom128_w0', { cx: 0, cy: 0, s: 180 * 128 }]);
  return out;
}

// ---------------- reference render (emulates the GPU: core L = 4 interpolating z, the layer interpolating per-vertex
// pattern coordinates) and metrics ----------------
function render(res, view, sc, cell, chartAware = !process.argv.includes('--naive')) {
  const s = view.s;
  const px = (w) => [(w.re - view.cx) * s + W / 2, H / 2 - (w.im - view.cy) * s];
  const cover = new Uint16Array(W * H);
  const topPar = new Int8Array(W * H).fill(-1);
  const parOf = (a, b) => ((Math.floor(a) + Math.floor(b)) % 2 + 2) % 2;
  const edgeD = new Float32Array(W * H).fill(99);   // distance to a checker cell edge, in px (for exclusions)
  function raster(p0, p1, p2, fn) {
    const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxx = Math.min(W - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxy = Math.min(H - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    if (minx > maxx || miny > maxy) return;
    const ar = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
    if (!(Math.abs(ar) > 0)) return;
    const sg = ar > 0 ? 1 : -1;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const xc = x + 0.5, yc = y + 0.5;
      const e0 = sg * ((p1[0] - p0[0]) * (yc - p0[1]) - (p1[1] - p0[1]) * (xc - p0[0]));
      const e1 = sg * ((p2[0] - p1[0]) * (yc - p1[1]) - (p2[1] - p1[1]) * (xc - p1[0]));
      const e2 = sg * ((p0[0] - p2[0]) * (yc - p2[1]) - (p0[1] - p2[1]) * (xc - p2[0]));
      if (e0 >= 0 && e1 >= 0 && e2 >= 0) fn(y * W + x, e1 / (sg * ar), e2 / (sg * ar), e0 / (sg * ar));   // weights of p0, p1, p2
    }
  }
  // pattern coordinates: polar (ln r, arg) / 16 cells per turn, or the Cartesian checker / cell
  const pc = (z) => (sc.polar ? [Math.log(abs(z)) * 16 / (2 * PI), Math.atan2(z.im, z.re) * 16 / (2 * PI)] : [z.re / cell, z.im / cell]);
  const sorted = res.out.map((t, i) => [t, i]).sort((a, b) => b[0].key - a[0].key || a[1] - b[1]).map((x) => x[0]);
  for (const t of sorted) {
    const p = t.w.map(px);
    if (chartAware && t.ch === 1 && t.z.every(Boolean)) {
      // chart-aware: interpolate u = 1/(z - c) (linear in the triangle's own chart), then z = c + 1/u per pixel
      const u = t.z.map((z) => CX.inv(CX.sub(z, res.cc)));
      raster(p[0], p[1], p[2], (i, a, b, c) => {
        cover[i]++;
        const uu = C(a * u[0].re + b * u[1].re + c * u[2].re, a * u[0].im + b * u[1].im + c * u[2].im);
        const g = pc(CX.add(res.cc, CX.inv(uu)));
        topPar[i] = parOf(g[0], g[1]);
      });
      continue;
    }
    // per-vertex pattern coordinates, unwrapped / reduced per triangle (the CPU-supplied bundle)
    let q = t.z.map((z) => pc(z || t.z.find(Boolean)));
    if (sc.polar) { const a0 = q[0][1]; for (const v of q) { while (v[1] - a0 > 8) v[1] -= 16; while (v[1] - a0 < -8) v[1] += 16; } }
    else { const ox = Math.floor(q[0][0] / 2) * 2, oy = Math.floor(q[0][1] / 2) * 2; q = q.map((v) => [v[0] - ox, v[1] - oy]); }
    raster(p[0], p[1], p[2], (i, a, b, c) => {
      cover[i]++;
      const g0 = a * q[0][0] + b * q[1][0] + c * q[2][0], g1 = a * q[0][1] + b * q[1][1] + c * q[2][1];
      topPar[i] = parOf(g0, g1);
    });
  }
  for (const t of res.coreTris) {
    const p = t.w.map(px);
    raster(p[0], p[1], p[2], (i, a, b, c) => {
      cover[i]++;
      const z = C(a * t.z[0].re + b * t.z[1].re + c * t.z[2].re, a * t.z[0].im + b * t.z[1].im + c * t.z[2].im);
      const g = pc(z);
      topPar[i] = parOf(g[0], g[1]);
    });
  }
  return { cover, topPar };
}
function metrics(res, view, sc, name) {
  const s = view.s;
  const b = boxOf(view);
  const cell = niceStep(Math.max(...[boxOf(sc.src)].map((x) => Math.max(x.x1 - x.x0, x.y1 - x.y0))) / 10);
  const { cover, topPar } = render(res, view, sc, cell);
  let nIn = 0, nOut = 0, hole = 0, spill = 0, nPar = 0, okPar = 0, minCov = Infinity, ziHole = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const w = C(b.x0 + (x + 0.5) / s, b.y1 - (y + 0.5) / s);
    const i = y * W + x;
    if (sc.inT) {
      const sd = sc.sdf(w) * s;
      if (Math.abs(sd) < 2) continue;
      const t = sc.inT(w), r = cover[i] > 0;
      if (t) { nIn++; if (!r) hole++; minCov = Math.min(minCov, cover[i]); } else { nOut++; if (r) spill++; }
      if (name === 'zi_H' && abs(w) < EPI && r) ziHole++;
      // pattern parity (single-valued truth or the polar checker of z^i), away from cell edges
      if (t && r && (sc.pre || sc.polarOf)) {
        let g;
        if (sc.polarOf) { const q = sc.polarOf(w); g = [q[0] * 16 / (2 * PI), q[1] * 16 / (2 * PI)]; }
        else { const z = sc.pre(w); g = [z.re / cell, z.im / cell]; }
        // distance to a cell edge in px, via the local scale of g (finite differences)
        const dw = 1 / s;
        let gx, gy;
        if (sc.polarOf) { const q1 = sc.polarOf(C(w.re + dw, w.im)), q2 = sc.polarOf(C(w.re, w.im + dw)); gx = [(q1[0] - (g[0] * 2 * PI / 16)) * 16 / (2 * PI), (q1[1] - g[1] * 2 * PI / 16) * 16 / (2 * PI)]; gy = [(q2[0] - g[0] * 2 * PI / 16) * 16 / (2 * PI), (q2[1] - g[1] * 2 * PI / 16) * 16 / (2 * PI)]; }
        else { const z1 = sc.pre(C(w.re + dw, w.im)), z2 = sc.pre(C(w.re, w.im + dw)); gx = [(z1.re / cell) - g[0], (z1.im / cell) - g[1]]; gy = [(z2.re / cell) - g[0], (z2.im / cell) - g[1]]; }
        const fr = (v) => Math.min(v - Math.floor(v), Math.ceil(v) - v);
        const d0 = fr(g[0]) / Math.max(1e-12, Math.hypot(gx[0], gy[0])), d1 = fr(g[1]) / Math.max(1e-12, Math.hypot(gx[1], gy[1]));
        const cellPx = 1 / Math.max(Math.hypot(gx[0], gy[0]), Math.hypot(gx[1], gy[1]));
        if (Math.min(d0, d1) < 1.5 || cellPx < 3) continue;
        nPar++;
        if (((Math.floor(g[0]) + Math.floor(g[1])) % 2 + 2) % 2 === topPar[i]) okPar++;
      }
    }
  }
  // chord deviation of the emitted layer triangles (true image of the chart midpoints vs the drawn chords), in px
  const devs = [];
  const F = sc.F;
  const LV = require('./layer.js').Region.levelOf(sc.shape), lv = (z) => LV(z);
  const inv = (u) => CX.inv(u);
  let k = 0;
  const stride = Math.max(1, Math.floor(res.out.length / 30000));
  for (let j = 0; j < res.out.length; j += stride) {
    const t = res.out[j];
    if (t.cap || t.z.some((z) => !z)) continue;
    const p = t.w.map((w) => [(w.re - view.cx) * s + W / 2, H / 2 - (w.im - view.cy) * s]);
    if (Math.max(p[0][0], p[1][0], p[2][0]) < 0 || Math.min(p[0][0], p[1][0], p[2][0]) > W || Math.max(p[0][1], p[1][1], p[2][1]) < 0 || Math.min(p[0][1], p[1][1], p[2][1]) > H) continue;
    const toCh = (z) => (t.ch === 0 ? z : inv(CX.sub(z, res.cc)));
    const fromCh = (u) => (t.ch === 0 ? u : CX.add(res.cc, inv(u)));
    const u = t.z.map(toCh);
    let d = 0;
    for (const [a, bb, cc] of [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]) {
      const um = C(a * u[0].re + bb * u[1].re + cc * u[2].re, a * u[0].im + bb * u[1].im + cc * u[2].im);
      // points outside the region (a chord of a clipped polygon across the curved boundary) are not part of the
      // image: the boundary's own accuracy is tested by the layer on the level set
      if (!(lv(fromCh(um)) > 0)) continue;
      const wm = F(fromCh(um));
      const wl = C(a * t.w[0].re + bb * t.w[1].re + cc * t.w[2].re, a * t.w[0].im + bb * t.w[1].im + cc * t.w[2].im);
      d = Math.max(d, Math.hypot(wm.re - wl.re, wm.im - wl.im) * s);
    }
    if (Number.isFinite(d)) devs.push(d);
    k++;
  }
  devs.sort((a, b) => a - b);
  const q = (f) => (devs.length ? devs[Math.min(devs.length - 1, Math.floor(f * devs.length))] : 0);
  return {
    iou: sc.inT ? (nIn - hole) / (nIn + spill || 1) : null, hole: sc.inT ? hole / (nIn || 1) : null, spill: sc.inT ? spill / (nOut || 1) : null,
    nHole: hole, nSpill: spill, parity: nPar ? okPar / nPar : null, nPar, minCov: minCov === Infinity ? null : minCov, ziHole,
    devMax: q(1), devP99: q(0.99), devP50: q(0.5), nDev: devs.length,
  };
}

// ---------------- the Sphere view: coverage of the image sphere in two hemisphere charts (w and 1/w) ----------------
function metricsSphere(res, sc, R) {
  const G = Math.ceil(2 * R);
  const lift = (w) => { if (!w) return [0, 0, 1]; const q = w.re * w.re + w.im * w.im; if (q > 1) { const iq = 1 / q; return [2 * w.re * iq / (1 + iq), 2 * w.im * iq / (1 + iq), (1 - iq) / (1 + iq)]; } return [2 * w.re / (q + 1), 2 * w.im / (q + 1), (q - 1) / (q + 1)]; };
  const mapA = (w) => (w ? [w.re * R + R, R - w.im * R] : null);
  const mapB = (w) => { if (!w) return [R, R]; const q = w.re * w.re + w.im * w.im; return q > 0 ? [w.re / q * R + R, R + w.im / q * R] : null; };
  const covA = new Uint16Array(G * G), covB = new Uint16Array(G * G);
  function raster(p0, p1, p2, cov) {
    const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxx = Math.min(G - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxy = Math.min(G - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
    if (minx > maxx || miny > maxy) return;
    const ar = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]); if (!(Math.abs(ar) > 0)) return; const sg = ar > 0 ? 1 : -1;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const xc = x + 0.5, yc = y + 0.5;
      const e0 = sg * ((p1[0] - p0[0]) * (yc - p0[1]) - (p1[1] - p0[1]) * (xc - p0[0])), e1 = sg * ((p2[0] - p1[0]) * (yc - p1[1]) - (p2[1] - p1[1]) * (xc - p1[0])), e2 = sg * ((p0[0] - p2[0]) * (yc - p2[1]) - (p0[1] - p2[1]) * (xc - p2[0]));
      if (e0 >= 0 && e1 >= 0 && e2 >= 0) cov[y * G + x]++;
    }
  }
  for (const t of res.out.concat(res.coreTris)) {
    const ab = t.w.map((w) => (w ? Math.hypot(w.re, w.im) : Infinity));
    if (ab.every((x) => x <= 2)) raster(...t.w.map(mapA), covA);
    if (ab.every((x) => x >= 0.5)) { const q = t.w.map(mapB); if (q.every(Boolean)) raster(...q, covB); }
  }
  let nIn = 0, nOut = 0, hole = 0, spill = 0, minCov = Infinity;
  for (const [cov, inv] of [[covA, false], [covB, true]]) for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const u = C((x + 0.5 - R) / R, (R - (y + 0.5)) / R);
    const d = Math.hypot(u.re, u.im);
    if (inv ? d >= 1 : d > 1) continue;
    const w = inv ? CX.inv(C(u.re, u.im)) : u;
    if (!(Number.isFinite(w.re) && Number.isFinite(w.im))) continue;
    const q = w.re * w.re + w.im * w.im;
    if (Math.abs(sc.sdf(w)) * 2 / (1 + q) * R < 2) continue;
    const t = sc.inT(w), r = cov[y * G + x] > 0;
    if (t) { nIn++; if (!r) hole++; minCov = Math.min(minCov, cov[y * G + x]); } else { nOut++; if (r) spill++; }
  }
  // 3D chord deviation (globe px)
  const devs = [];
  const LV = require('./layer.js').Region.levelOf(sc.shape);
  const stride = Math.max(1, Math.floor(res.out.length / 30000));
  for (let j = 0; j < res.out.length; j += stride) {
    const t = res.out[j];
    if (t.cap || t.z.some((z) => !z)) continue;
    const toCh = (z) => (t.ch === 0 ? z : CX.inv(CX.sub(z, res.cc))), fromCh = (u) => (t.ch === 0 ? u : CX.add(res.cc, CX.inv(u)));
    const u = t.z.map(toCh), L = t.w.map(lift);
    let d = 0;
    for (const [a, b, c] of [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]) {
      const zm = fromCh(C(a * u[0].re + b * u[1].re + c * u[2].re, a * u[0].im + b * u[1].im + c * u[2].im));
      if (!(LV(zm) > 0)) continue;
      const wm = sc.F(zm);
      const p = lift(Number.isFinite(wm.re) && Number.isFinite(wm.im) ? wm : null);
      d = Math.max(d, Math.hypot(p[0] - (a * L[0][0] + b * L[1][0] + c * L[2][0]), p[1] - (a * L[0][1] + b * L[1][1] + c * L[2][1]), p[2] - (a * L[0][2] + b * L[1][2] + c * L[2][2])) * R);
    }
    devs.push(d);
  }
  devs.sort((a, b) => a - b);
  const q = (f) => (devs.length ? devs[Math.min(devs.length - 1, Math.floor(f * devs.length))] : 0);
  return { iou: (nIn - hole) / (nIn + spill || 1), hole: hole / (nIn || 1), spill: spill / (nOut || 1), nHole: hole, nSpill: spill, minCov: minCov === Infinity ? null : minCov, devMax: q(1), devP99: q(0.99), devP50: q(0.5), parity: null, nPar: 0 };
}

// ---------------- main ----------------
const args = process.argv.slice(2);
const flt = args.filter((a) => !a.startsWith('--'));
const Kopt = +((args.find((a) => a.startsWith('--K=')) || '--K=1').slice(4));
const rows = [];
for (const [name, sc] of Object.entries(SC)) {
  if (flt.length && !flt.some((f) => name.startsWith(f))) continue;
  const SPHR = args.find((a) => a.startsWith('--sphere')) ? +(args.find((a) => a.startsWith('--sphere')).split('=')[1] || 250) : 0;
  for (const [vn, view] of (SPHR ? [['sphere', sc.view]] : viewsOf(name, sc))) {
    const v = Object.assign({ W, H }, view);
    const res = build({ F: sc.F, shape: sc.shape, srcWin: boxOf(sc.src), view: v, K: Kopt, injective: !!sc.injective, sphere: SPHR ? { R: SPHR } : null });
    const m = sc.control ? {} : SPHR ? metricsSphere(res, sc, SPHR) : metrics(res, v, sc, name);
    const r = { scene: name, view: vn, ms: +res.ms.toFixed(1), classMs: +res.tClass.toFixed(1), meshMs: +res.tMesh.toFixed(1), covMs: +res.tCov.toFixed(1), layerMs: +res.tLayer.toFixed(1), evals: res.st.evals, tris: res.out.length, core: res.coreTris.length,
      claimed: res.st.claimed, prop: res.st.propagated, certified: res.st.certified, outer: res.st.outer, collar: res.st.collarRoots,
      popped: res.st.popped, culled: res.st.culled, capped: res.st.capped, sat: res.st.saturated, satTests: res.st.satTests, satPts: res.st.satPolyPts,
      dropSub: res.st.dropSub, dropFloor: res.st.dropFloor, dropOut: res.st.dropOut, apexStop: res.st.apexStop, budget: res.st.budget, maxKey: res.st.maxKey, ...m };
    rows.push(r);
    const f = (x, d = 4) => (x == null ? '-' : typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(d)) : String(x));
    console.log(`${name.padEnd(12)} ${vn.padEnd(11)} ms ${f(r.ms, 1).padStart(7)} (class ${f(r.classMs, 1)})  evals ${String(r.evals).padStart(8)}  layer tris ${String(r.tris).padStart(7)}  core subtris ${String(r.core).padStart(6)}  claimed ${r.claimed}(+${r.prop}) cert ${r.certified} outer ${r.outer} collar ${r.collar} | popped ${r.popped} cull ${r.culled} cap ${r.capped} sat ${r.sat}/${r.satTests} drop sub ${r.dropSub} floor ${r.dropFloor} out ${r.dropOut} apexStop ${r.apexStop} budget ${r.budget} maxKey ${r.maxKey}` +
      (sc.control ? '' : `\n${''.padEnd(25)}IoU ${f(r.iou)} hole ${f(r.hole, 5)} (${r.nHole}) spill ${f(r.spill, 5)} (${r.nSpill}) parity ${f(r.parity)} (${r.nPar}) minCov ${f(r.minCov)} dev px max ${f(r.devMax, 3)} p99 ${f(r.devP99, 3)} p50 ${f(r.devP50, 3)}${name === 'zi_H' ? ` zi-hole-covered ${r.ziHole}` : ''}`));
  }
}
fs.writeFileSync(path.join(__dirname, `results_K${Kopt}${args.some((a) => a.startsWith('--sphere')) ? '_sphere' : ''}.json`), JSON.stringify(rows, null, 1));

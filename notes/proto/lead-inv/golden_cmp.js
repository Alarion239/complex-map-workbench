'use strict';
// How much would the golden PNGs of the bounded controls move if bounded shapes were drawn by the inverse path?
// Emulates today's forward draw (Region.buildMesh at Q = 60, the L = 4 GPU template, the 0.2-edge midpoint test,
// linear interpolation of the source point inside each sub-triangle, fwidth of that interpolant, mesh order, alpha 1)
// and the inverse path (render.js), composites both with the same boundary stroke and casing (the line renderer is
// not changed), and applies the suite's golden_diff metric (1 px blur, > 8/255 in any channel).
//   node notes/proto/lead-inv/golden_cmp.js
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../..');
const R = require('./render.js');
const Region = require(path.join(ROOT, 'src/region.js'));
const Q = require(path.join(ROOT, 'test/regress/quality/scenes.js'));
const MET = require(path.join(ROOT, 'test/regress/quality/metrics.js'));
const PNG = require(path.join(ROOT, 'test/regress/quality/pngio.js'));
const { C } = CX;
const W = R.W, H = R.H;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const EDGE = hex('#093B9B'), HALO = hex('#FCFDFD'), PLANE = hex('#FCFDFD');

function forward(sc, view, pattern) {
  const steps = sc.steps.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: true }));
  const built = steps.map((s) => Funcs.build(s));
  const F = (z) => { for (const b of built) z = b.f(z); return z; };
  const shape = sc.shapes[0];
  const mesh = Region.buildMesh(shape, Q.boxOf(sc.srcView), 60);
  const cell = Q.cellOf(sc);
  const col = new Float32Array(W * H * 3), cov = new Uint8Array(W * H);
  const L = 4, S = mesh.src, T = mesh.tri;
  const sub = [];
  for (let i = 0; i < L; i++) for (let j = 0; i + j < L; j++) {
    sub.push([[i, j], [i + 1, j], [i, j + 1]]);
    if (i + j < L - 1) sub.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]);
  }
  const px = (w) => [(w.re - view.cx) * view.s + W / 2, H / 2 - (w.im - view.cy) * view.s];
  let dropped = 0, drawn = 0;
  for (let t = 0; t < T.length / 3; t++) {
    const A = C(S[2 * T[3 * t]], S[2 * T[3 * t] + 1]), B = C(S[2 * T[3 * t + 1]], S[2 * T[3 * t + 1] + 1]), Cc = C(S[2 * T[3 * t + 2]], S[2 * T[3 * t + 2] + 1]);
    const at = (i, j) => C(A.re + (B.re - A.re) * i / L + (Cc.re - A.re) * j / L, A.im + (B.im - A.im) * i / L + (Cc.im - A.im) * j / L);
    for (const st of sub) {
      const s3 = st.map(([i, j]) => at(i, j)), w3 = s3.map(F);
      if (!w3.every((w) => CX.isFin(w))) { dropped++; continue; }
      const sm = C((s3[0].re + s3[1].re + s3[2].re) / 3, (s3[0].im + s3[1].im + s3[2].im) / 3), wm = F(sm);
      const e = Math.max(CX.abs(CX.sub(w3[1], w3[0])), CX.abs(CX.sub(w3[2], w3[1])), CX.abs(CX.sub(w3[0], w3[2])));
      const mean = C((w3[0].re + w3[1].re + w3[2].re) / 3, (w3[0].im + w3[1].im + w3[2].im) / 3);
      if (!(CX.abs(CX.sub(wm, mean)) <= 0.2 * e)) { dropped++; continue; }
      drawn++;
      const p = w3.map(px);
      const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
      if (!(Math.abs(den) > 1e-12)) continue;
      // the affine map pixel -> source of this sub-triangle (for fwidth)
      const bary = (x, y) => { const l0 = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / den, l1 = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / den; return [l0, l1, 1 - l0 - l1]; };
      const srcAt = (b) => C(b[0] * s3[0].re + b[1] * s3[1].re + b[2] * s3[2].re, b[0] * s3[0].im + b[1] * s3[1].im + b[2] * s3[2].im);
      const o = srcAt(bary(0, 0)), dX = CX.sub(srcAt(bary(1, 0)), o), dY = CX.sub(srcAt(bary(0, 1)), o);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const b = bary(x + 0.5, y + 0.5);
        if (b[0] < -1e-12 || b[1] < -1e-12 || b[2] < -1e-12) continue;
        const z = srcAt(b);
        const pc = R.patternColor(pattern, z, dX, dY, null, cell);
        const k = y * W + x;
        col[3 * k] = pc.col[0]; col[3 * k + 1] = pc.col[1]; col[3 * k + 2] = pc.col[2]; cov[k] = 1;
      }
    }
  }
  return { col, cov, dropped, drawn };
}

const out = [];
for (const name of ['disc_cube', 'joukowski', 'annulus_log', 'poly_mobius']) {
  const sc = Q.SCENES.find((s) => s.name === name);
  const view = sc.rightView;
  const map = { at: (i, j) => C(view.cx + (i + 0.5 - W / 2) / view.s, view.cy - (j + 0.5 - H / 2) / view.s), spx: view.s };
  const TG = MET.truthGrid(sc.truth, Q.cellOf(sc), map, W, H);
  for (const variant of ['mask', 'pattern']) {
    const pattern = variant === 'mask' ? 'solid' : 'checker';
    const fw = forward(sc, view, pattern);
    const inv = R.render(sc, view, pattern);
    // composite: fill over the plane (forward: aliased centre coverage; inverse: its own AA), then the casing and
    // stroke that the unchanged line renderer draws on the image of the boundary
    const A = Buffer.alloc(W * H * 4), B = Buffer.alloc(W * H * 4);
    let diffVisible = 0, covDiff = 0, n = 0;
    for (let k = 0; k < W * H; k++) {
      const d = Math.min(Math.abs(TG.sdf[k]), TG.stroke ? TG.stroke[k] : Infinity);
      const fa = fw.cov[k] ? [fw.col[3 * k], fw.col[3 * k + 1], fw.col[3 * k + 2]] : PLANE;
      const ib = [inv.rgba[4 * k] / 255, inv.rgba[4 * k + 1] / 255, inv.rgba[4 * k + 2] / 255];
      const fin = (c) => { if (d < 0.75) return EDGE; if (d < 1.75) return c.map((x, q) => x * 0.15 + HALO[q] * 0.85); return c; };
      const ca = fin(fa), cb = fin(ib);
      for (let q = 0; q < 3; q++) { A[4 * k + q] = Math.round(255 * ca[q]); B[4 * k + q] = Math.round(255 * cb[q]); }
      A[4 * k + 3] = B[4 * k + 3] = 255;
      if (d > 2.5) { n++; const dm = Math.max(...[0, 1, 2].map((q) => Math.abs(A[4 * k + q] - B[4 * k + q]))); if (dm > 8) diffVisible++; if ((fw.cov[k] > 0) !== (inv.cov[k] > 0.5)) covDiff++; }
    }
    const gd = MET.goldenDiff(A, B, W, H);
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'out', `golden_${name}.${variant}.fwd.png`), PNG.encode(W, H, A));
    fs.writeFileSync(path.join(__dirname, 'out', `golden_${name}.${variant}.diff.png`), PNG.encode(W, H, gd.map));
    const line = `${(name + '.' + variant).padEnd(22)} golden_diff ${(100 * gd.frac).toFixed(3)} % (${gd.n} px)   unblurred > 8/255 away from strokes: ${diffVisible} px   coverage disagreements away from strokes: ${covDiff}   fwd drawn ${fw.drawn} dropped ${fw.dropped}`;
    console.log(line); out.push(line);
  }
}
fs.writeFileSync(path.join(__dirname, 'golden_cmp.txt'), out.join('\n') + '\n');

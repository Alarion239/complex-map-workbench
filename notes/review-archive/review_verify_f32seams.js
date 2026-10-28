// Reviewer scratch: CPU emulation (float32 via Math.fround) of the cached REGION_VS path for the left pane
// (identity map), to check whether region fills drop sub-triangles / leave cracks far from the origin.
global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
global.Funcs = require('../../src/funcs.js');
const Region = require('../../src/region.js');
const f = Math.fround;

function run(expr, cx, cy, s, cssW, cssH, dpr, base, fma) {
  const hw = cssW / 2 / s, hh = cssH / 2 / s;
  const win = { x0: +(cx - hw).toPrecision(6), x1: +(cx + hw).toPrecision(6), y0: +(cy - hh).toPrecision(6), y1: +(cy + hh).toPrecision(6) };
  const mesh = Region.buildMesh({ kind: 'formula', expr }, win, base);
  const inst = Region.meshInstances(mesh);
  const n = inst.length / 6;
  const L = 4;
  // template (as regionTemplate)
  const pts = [];
  const idx = new Map();
  for (let i = 0; i <= L; i++) for (let j = 0; i + j <= L; j++) { idx.set(i * (L + 1) + j, pts.length / 2); pts.push(f(i / L), f(j / L)); }
  const V = pts.length / 2;
  const tris = [];
  for (let i = 0; i < L; i++) for (let j = 0; i + j < L; j++) {
    tris.push([[i, j], [i + 1, j], [i, j + 1]]);
    if (i + j < L - 1) tris.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]);
  }
  tris.forEach((t) => { const b = t.map(([i, j]) => [i / L, j / L]); pts.push(f((b[0][0] + b[1][0] + b[2][0]) / 3), f((b[0][1] + b[1][1] + b[2][1]) / 3)); });
  const tid = tris.map((t) => t.map(([i, j]) => idx.get(i * (L + 1) + j)));
  // bary in float32: A + (B-A)*tx + (C-A)*ty, left to right (or with fma)
  const bary = (ax, bx, cxx, tx, ty) => {
    const d1 = f(bx - ax), d2 = f(cxx - ax);
    if (fma) return f(f(ax + d1 * tx) + d2 * ty); // fused multiply-add (one rounding each)
    return f(f(ax + f(d1 * tx)) + f(d2 * ty));
  };
  const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
  const sx = f(2 * s * dpr / W), sy = f(2 * s * dpr / H);
  const ucx = f(cx), ucy = f(cy);
  const cover = new Uint16Array(W * H);
  let fail = 0, total = 0, nonfinite = 0;
  const vkey = new Map(); let mism = 0, shared = 0; // compare positions computed for the same exact source point
  const toPx = (wx, wy) => [ (f(f(wx - ucx) * sx) + 1) / 2 * W, (f(f(wy - ucy) * sy) + 1) / 2 * H ];
  const edge = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  for (let t = 0; t < n; t++) {
    const ax = inst[6 * t], ay = inst[6 * t + 1], bx = inst[6 * t + 2], by = inst[6 * t + 3], c_x = inst[6 * t + 4], c_y = inst[6 * t + 5];
    const w = [];
    for (let k = 0; k < pts.length / 2; k++) w.push([bary(ax, bx, c_x, pts[2 * k], pts[2 * k + 1]), bary(ay, by, c_y, pts[2 * k], pts[2 * k + 1])]);
    // exact (double) lattice points, to compare neighbours' float32 results
    for (let k = 0; k < V; k++) {
      const tx = pts[2 * k], ty = pts[2 * k + 1];
      const ex = ax + (bx - ax) * tx + (c_x - ax) * ty, ey = ay + (by - ay) * tx + (c_y - ay) * ty;
      const key = ex.toPrecision(13) + ',' + ey.toPrecision(13);
      const prev = vkey.get(key);
      if (prev) { shared++; if (prev[0] !== w[k][0] || prev[1] !== w[k][1]) mism++; } else vkey.set(key, w[k]);
    }
    tris.forEach((tr, ti) => {
      total++;
      const [w0, w1, w2] = tid[ti].map((k) => w[k]);
      const wm = w[V + ti];
      const mx = f(f(f(f(w0[0] + w1[0]) + w2[0])) / 3), my = f(f(f(f(w0[1] + w1[1]) + w2[1])) / 3);
      const dl = Math.hypot(f(wm[0] - mx), f(wm[1] - my));
      const e = Math.max(Math.hypot(f(w1[0] - w0[0]), f(w1[1] - w0[1])), Math.hypot(f(w2[0] - w1[0]), f(w2[1] - w1[1])), Math.hypot(f(w0[0] - w2[0]), f(w0[1] - w2[1])));
      const good = f(dl) <= f(f(0.2 * e) + 1e-30);
      if (!good) { fail++; return; }
      // rasterize (pixel centres, top-left-ish rule via half-open test)
      const P = [w0, w1, w2].map((q) => toPx(q[0], q[1]));
      let x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      let y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      if (x1 < 0 || y1 < 0 || x0 >= W || y0 >= H) return;
      const area = edge(P[0][0], P[0][1], P[1][0], P[1][1], P[2][0], P[2][1]);
      if (area === 0) return;
      const sg = area > 0 ? 1 : -1;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const px = xx + 0.5, py = yy + 0.5;
        const e0 = sg * edge(P[1][0], P[1][1], P[2][0], P[2][1], px, py), e1 = sg * edge(P[2][0], P[2][1], P[0][0], P[0][1], px, py), e2 = sg * edge(P[0][0], P[0][1], P[1][0], P[1][1], px, py);
        if (e0 >= 0 && e1 >= 0 && e2 >= 0 && (e0 > 0 || e1 > 0 || e2 > 0)) cover[yy * W + xx]++;
      }
    });
  }
  let holes = 0, dbl = 0, inside = 0;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const zx = cx + ((xx + 0.5) - W / 2) / (s * dpr), zy = cy + ((yy + 0.5) - H / 2) / (s * dpr);
    if (Math.hypot(zx - Math.round(zx / 100) * 100, zy) >= 0.999 && expr.includes('100')) continue;
    inside++;
    if (cover[yy * W + xx] === 0) holes++; else if (cover[yy * W + xx] > 1) dbl++;
  }
  return { expr, center: [cx, cy], s, win, baseTris: n, subTris: total, centroidRejected: fail, rejectedPct: +(100 * fail / total).toFixed(2), sharedLatticeRecomputed: shared, latticeMismatch: mism, px: W * H, inside, holes, holesPct: +(100 * holes / inside).toFixed(3), doubleCovered: dbl };
}

const fma = process.argv[2] === "fma"; if (process.argv[3]) { const [e, cx, cy, s] = process.argv.slice(3); console.log(JSON.stringify(run(e, +cx, +cy, +s, 616, 616, 2, 60, fma))); process.exit(0); }
console.log('mode', fma ? 'fma' : 'separate roundings');
console.log(JSON.stringify(run('|z-100|<1', 100.5, 0.3, 6e4, 616, 616, 2, 60, fma)));
console.log(JSON.stringify(run('|z|<1', 0.5, 0.3, 6e4, 616, 616, 2, 60, fma)));
console.log(JSON.stringify(run('|z-100|<1', 100.5, 0.3, 6e3, 616, 616, 2, 60, fma)));
console.log(JSON.stringify(run('|z-100|<1', 100.5, 0.3, 2e4, 616, 616, 2, 60, fma)));

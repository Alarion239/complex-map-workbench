// Reviewer scratch (skeptic q9): CPU emulation of the float32 cached region pipeline (TF_REGION_VS + REGION_VS, identity map).
global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
global.Funcs = require('../../src/funcs.js');
const Region = require('../../src/region.js');
const f = Math.fround;
function regionTemplate(L) {
  const idx = new Map(), pts = [];
  for (let i = 0; i <= L; i++) for (let j = 0; i + j <= L; j++) { idx.set(i * (L + 1) + j, pts.length / 2); pts.push(i / L, j / L); }
  const V = pts.length / 2, tris = [];
  for (let i = 0; i < L; i++) for (let j = 0; i + j < L; j++) {
    tris.push([[i, j], [i + 1, j], [i, j + 1]]);
    if (i + j < L - 1) tris.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]);
  }
  const recs = [];
  tris.forEach((t, ti) => {
    const id = t.map(([i, j]) => idx.get(i * (L + 1) + j));
    const b = t.map(([i, j]) => [i / L, j / L]);
    pts.push((b[0][0] + b[1][0] + b[2][0]) / 3, (b[0][1] + b[1][1] + b[2][1]) / 3);
    recs.push({ id, c: V + ti });
  });
  return { pts: new Float32Array(pts), recs };
}
function run(label, shape, view, fma) {
  const dpr = 2, W = 1232, H = 1232;
  const hw = W / 2 / dpr / view.s;
  const win = { x0: +(view.cx - hw).toPrecision(6), x1: +(view.cx + hw).toPrecision(6), y0: +(view.cy - hw).toPrecision(6), y1: +(view.cy + hw).toPrecision(6) };
  const mesh = Region.buildMesh(shape, win, 60);
  const inst = Region.meshInstances(mesh);
  const n = inst.length / 6;
  const tpl = regionTemplate(4), P = tpl.pts.length / 2;
  const cx = f(view.cx), cy = f(view.cy), sx = f(2 * view.s * dpr / W), sy = f(2 * view.s * dpr / H);
  const cover = new Uint8Array(W * H);
  let rejected = 0, total = 0;
  const bary = (ax, ay, bx, by, Cx, Cy, tx, ty) => fma
    ? [f(f(ax + f(bx - ax) * tx) + f(Cx - ax) * ty), f(f(ay + f(by - ay) * tx) + f(Cy - ay) * ty)]
    : [f(f(ax + f(f(bx - ax) * tx)) + f(f(Cx - ax) * ty)), f(f(ay + f(f(by - ay) * tx)) + f(f(Cy - ay) * ty))];
  const len = (x, y) => f(Math.sqrt(f(f(x * x) + f(y * y))));
  for (let k = 0; k < n; k++) {
    const a = inst.subarray(6 * k, 6 * k + 6);
    const w = [];
    for (let p = 0; p < P; p++) w.push(bary(a[0], a[1], a[2], a[3], a[4], a[5], tpl.pts[2 * p], tpl.pts[2 * p + 1]));
    for (const r of tpl.recs) {
      total++;
      const [w0, w1, w2] = r.id.map((i) => w[i]), wm = w[r.c];
      const e = Math.max(len(f(w1[0] - w0[0]), f(w1[1] - w0[1])), len(f(w2[0] - w1[0]), f(w2[1] - w1[1])), len(f(w0[0] - w2[0]), f(w0[1] - w2[1])));
      const mx = f(f(f(w0[0] + w1[0]) + w2[0]) / 3), my = f(f(f(w0[1] + w1[1]) + w2[1]) / 3);
      if (!(len(f(wm[0] - mx), f(wm[1] - my)) <= f(0.2 * e) + 1e-30)) { rejected++; if (!process.env.NOREJ) continue; }
      const pv = [w0, w1, w2].map(([x, y]) => [Math.round((f(f(x - cx) * sx) + 1) * 0.5 * W * 256) / 256, Math.round((f(f(y - cy) * sy) + 1) * 0.5 * H * 256) / 256]);
      const [[x0, y0], [x1, y1], [x2, y2]] = pv;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (area === 0) continue;
      const sg = Math.sign(area);
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const qx = px + 0.5, qy = py + 0.5;
        if (sg * ((x1 - x0) * (qy - y0) - (y1 - y0) * (qx - x0)) >= 0 && sg * ((x2 - x1) * (qy - y1) - (y2 - y1) * (qx - x1)) >= 0 && sg * ((x0 - x2) * (qy - y2) - (y0 - y2) * (qx - x2)) >= 0) cover[py * W + px] = 1;
      }
    }
  }
  let holes = 0, cnt = 0; const cols = new Set(), rows = new Set();
  for (let py = 100; py < 900; py++) for (let px = 100; px < 900; px++) {
    const zx = view.cx + (px + 0.5 - W / 2) / (view.s * dpr), zy = view.cy + (py + 0.5 - H / 2) / (view.s * dpr);
    if (Math.hypot(zx - shape.c[0], zy - shape.c[1]) >= shape.r) continue;
    cnt++;
    if (!cover[py * W + px]) { holes++; cols.add(px); rows.add(py); }
  }
  console.log(label, fma ? 'fma  ' : 'nofma', 'base', n, 'sub', total, 'centroidRejected', rejected, 'holes', holes + '/' + cnt, (100 * holes / cnt).toFixed(2) + '%', 'cols', cols.size, 'rows', rows.size);
}
for (const fma of [false, true]) {
  run('far   |z-100|<1 @100.5+0.3i s=6e4', { kind: 'disc', c: [100, 0], r: 1 }, { cx: 100.5, cy: 0.3, s: 6e4 }, fma);
  run('ctrl  |z|<1     @0.5+0.3i   s=6e4', { kind: 'disc', c: [0, 0], r: 1 }, { cx: 0.5, cy: 0.3, s: 6e4 }, fma);
  run('far   |z-100|<1 @100.5+0.3i s=6e3', { kind: 'disc', c: [100, 0], r: 1 }, { cx: 100.5, cy: 0.3, s: 6e3 }, fma);
  run('far   |z-100|<1 @100.5+0.3i s=2e4', { kind: 'disc', c: [100, 0], r: 1 }, { cx: 100.5, cy: 0.3, s: 2e4 }, fma);
  run('near1 |z|<1     @0.5+0.3i   s=1e7', { kind: 'disc', c: [0, 0], r: 1 }, { cx: 0.5, cy: 0.3, s: 1e7 }, fma);
  run('near1 |z|<2     @1.2+0.3i   s=1e7', { kind: 'disc', c: [0, 0], r: 2 }, { cx: 1.2, cy: 0.3, s: 1e7 }, fma);
  run('near1 |z|<2     @1.2+0.3i   s=1e6', { kind: 'disc', c: [0, 0], r: 2 }, { cx: 1.2, cy: 0.3, s: 1e6 }, fma);
}

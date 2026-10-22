'use strict';
// Precision of the inverse path in float32 at deep zoom on the image of infinity of the Cayley map (w = 1): the pixel
// position w = centre + offset rounded to float32 (as COLORPLOT_FS forms it) versus an ANCHORED first step, where the
// CPU folds the view centre into the first inverse step in float64 (den = (a - c cx) - c delta, num = (d cx - b) + d delta)
// so that only the small offset delta is float32. Metric: boundary error = max over boundary pixels of
// |coverage - exact area fraction| (16x16 supersampled truth), and IoU.
const K = require('./common.js');
const { W, H, C } = K;
const A = K.A32, R = Math.fround;
const cs = K.CASES.cayley_H;
function run(zoom, anchored) {
  const view = { cx: 1, cy: 0, s: 190 * zoom }, pxw = 1 / view.s;
  const m = cs.steps[0].m; // [a, b, c, d]
  const [a, b, c, d] = m;
  const inv = [d, CX.neg(b), CX.neg(c), a];
  // float64 parts at the centre
  const cen = C(view.cx, view.cy);
  const num0 = CX.add(CX.mul(inv[0], cen), inv[1]), den0 = CX.add(CX.mul(inv[2], cen), inv[3]);
  let emax = 0, inter = 0, uni = 0;
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
    const dx = R((i + 0.5 - W / 2) / view.s), dy = R(-(j + 0.5 - H / 2) / view.s);
    let z, J;
    if (anchored) {
      const del = A.C(dx, dy);
      const num = A.add(A.C(num0.re, num0.im), A.mul(A.C(inv[0].re, inv[0].im), del));
      const den = A.add(A.C(den0.re, den0.im), A.mul(A.C(inv[2].re, inv[2].im), del));
      z = A.div(num, den);
      const det = CX.sub(CX.mul(inv[0], inv[3]), CX.mul(inv[1], inv[2]));
      J = A.div(A.C(det.re, det.im), A.mul(den, den));
    } else {
      const w = A.C(R(view.cx) + dx, R(view.cy) + dy);
      const den = A.add(A.mul(A.C(inv[2].re, inv[2].im), w), A.C(inv[3].re, inv[3].im));
      z = A.div(A.add(A.mul(A.C(inv[0].re, inv[0].im), w), A.C(inv[1].re, inv[1].im)), den);
      const det = CX.sub(CX.mul(inv[0], inv[3]), CX.mul(inv[1], inv[2]));
      J = A.div(A.C(det.re, det.im), A.mul(den, den));
    }
    const sd = z.im / (Math.hypot(J.re, J.im) * pxw);
    const cov = Math.min(1, Math.max(0, sd + 0.5));
    // exact fraction (float64, 16x16)
    let n = 0;
    for (let p = 0; p < 16; p++) for (let q = 0; q < 16; q++) { const wx = view.cx + (i + (p + 0.5) / 16 - W / 2) / view.s, wy = view.cy - (j + (q + 0.5) / 16 - H / 2) / view.s; if (Math.hypot(wx, wy) < 1) n++; }
    const f = n / 256;
    if (f > 0 && f < 1) emax = Math.max(emax, Math.abs(cov - f));
    const t = Math.hypot(view.cx + (i + 0.5 - W / 2) / view.s, view.cy - (j + 0.5 - H / 2) / view.s) < 1;
    if (t && cov >= 0.5) inter++; if (t || cov >= 0.5) uni++;
  }
  return { emax, iou: inter / uni };
}
console.log('Cayley(H) at w = 1, float32 emulation: zoom   plain(centre+offset) boundary err / IoU     anchored first step');
for (const z of [64, 1024, 16384, 262144, 4194304]) {
  const p = run(z, false), q = run(z, true);
  console.log(`  x${String(z).padEnd(8)} pixel ${(1 / (190 * z)).toExponential(1)}   ${p.emax.toFixed(3)} / ${p.iou.toFixed(4)}            ${q.emax.toFixed(3)} / ${q.iou.toFixed(4)}`);
}

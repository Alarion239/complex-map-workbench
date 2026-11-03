// P3 review checks (notes/sphere-design/SPEC.md 13.16) in the classic view (ci/suite_views.js: classic): the Sphere
// checker on the globes and the Checker on the left plane against the truth. The steps view has no region pattern (one
// colouring: ux on #719), so these stay with the classic view; the other P3 review checks are test/p3_review_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_review_classic_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
// (the page quiet: no pane frame pending, after at least floor ms)
const rest = (floor) => settled({ floor, max: 30000 });
await view(1440, 900, false);
// page helpers (window.__rv): a pane's pixels; the pick grid of a pane at CSS pixel centres; the globe's point labels
const RV = `window.__rv = {
  grab(side) { const cv = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR'); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); return { D: x.getImageData(0, 0, g.width, g.height).data, W: g.width, H: g.height }; },
  picks(side) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const pick = side === 'L' ? __cmwSphereWL : __cmwSphereW; const Wd = Math.floor(r.width), Hd = Math.floor(r.height), P = new Array(Wd * Hd); for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) P[y * Wd + x] = pick(x + 0.5, y + 0.5); return { P, Wd, Hd, cw: r.width, ch: r.height }; },
  // the globe's point labels (0, infinity, 1, i, -1, -i), left out 16 px around each
  labels(side) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const pc = GLR.camera(__cmwCam(side), r.width, r.height); const proj = (p) => { const q = GLR.M4.apply(pc.MVP, p); return q[3] > 1e-6 ? [(q[0] / q[3] * 0.5 + 0.5) * r.width, (1 - (q[1] / q[3] * 0.5 + 0.5)) * r.height] : null; }; const labs = [[0, 0, 1.1], [0, 0, -1.1], [1.06, 0, 0.1], [0, -1.06, 0.1], [-1.06, 0, 0.1], [0, 1.06, 0.1]].map(proj).filter(Boolean); return (x, y) => labs.some((q) => Math.hypot(q[0] - x, q[1] - y) < 16); },
}; 1`;
// (the helpers live in the page: defined again after every load)
const load0 = load;
load = async (...a) => { const r = await load0(...a); await ev(RV); return r; };

// ---- 1. the Sphere checker on the globes against the truth: z-globe at stage 0 (|z| > 0.6, around infinity) and the
// w-globe of Cayley(H) (z = i(1 + w)/(1 - w)). Cell of a point z: (floor(arg z n / 2 pi), floor(2 atan|z| n / 2 pi)),
// c0 where their sum is even (SPEC 6.3). The frame drawn with pattern 'sphere' equals the frame drawn 'solid' (c0) at
// c0 pixels (within 6/255) and differs at c1 pixels (by 10/255 or more: c1 against c0 shaded toward the globe's dark
// limb); pixels within 4 px of a cell edge, a rim or a label are left out
const sphereCheck = async (side, zOf, cls) => ev(`await (async () => {
  const side = ${JSON.stringify(side)}, zOf = ${zOf}, cls = ${cls};
  __cmwSet('pattern', 'sphere'); await new Promise((r) => setTimeout(r, 900));
  const A = __rv.grab(side);
  __cmwSet('pattern', 'solid'); await new Promise((r) => setTimeout(r, 900));
  const B = __rv.grab(side);
  __cmwSet('pattern', 'sphere');
  const n = __cmwLook('s1', side).sphN, G = __rv.picks(side), { P, Wd, Hd } = G, dpr = A.W / G.cw, onLabel = __rv.labels(side);
  const cell = new Int32Array(Wd * Hd).fill(-1 >>> 1), C = new Int8Array(Wd * Hd);
  for (let k = 0; k < Wd * Hd; k++) {
    const w = P[k]; if (!w) continue;
    C[k] = cls(w); if (C[k] !== 1) continue;
    const z = zOf(w); if (!z || !Number.isFinite(z[0]) || !Number.isFinite(z[1])) continue;
    const gx = Math.floor(Math.atan2(z[1], z[0]) * n / (2 * Math.PI)), gy = Math.floor(2 * Math.atan(Math.hypot(z[0], z[1])) * n / (2 * Math.PI));
    cell[k] = (gx + 64) * 1024 + gy;
  }
  const o = { n, c0: 0, c1: 0, bad0: 0, bad1: 0, ex: [] };
  for (let y = 5; y < Hd - 5; y += 2) for (let x = 5; x < Wd - 5; x += 2) {
    const k = y * Wd + x; if (C[k] !== 1 || cell[k] === (-1 >>> 1) || onLabel(x, y)) continue;
    let same = true;
    for (let dy = -4; dy <= 4 && same; dy++) for (let dx = -4; dx <= 4; dx++) { const q = (y + dy) * Wd + x + dx; if (C[q] !== 1 || cell[q] !== cell[k]) { same = false; break; } }
    if (!same) continue;
    const gx = Math.floor(cell[k] / 1024) - 64, gy = cell[k] % 1024, even = ((gx + gy) % 2 + 2) % 2 === 0;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * A.W + Math.floor((x + 0.5) * dpr));
    const dm = Math.max(Math.abs(A.D[i] - B.D[i]), Math.abs(A.D[i + 1] - B.D[i + 1]), Math.abs(A.D[i + 2] - B.D[i + 2]));
    if (even) { o.c0++; if (dm > 6) { o.bad0++; if (o.ex.length < 4) o.ex.push(['c0', x, y, dm]); } }
    else { o.c1++; if (dm < 10) { o.bad1++; if (o.ex.length < 4) o.ex.push(['c1', x, y, dm]); } }
  }
  return o;
})()`, 120000);
const base1 = { pattern: 'sphere', alpha: 1, lines: false, unit: false };
await load('p3rvC0' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.6, complement: true }], steps: [ZI], srcView: { cx: 0, cy: 0, s: 60 } }, base1));
await ev('__cmwSetView("L", "sphere"); 1'); await rest(2500);
await ev('__cmwCam("L", { pitch: 0.9, yaw: -1.0, dist: 3.4 }); 1'); await rest(900);
R.chkL0 = await sphereCheck('L', '(w) => w', '(w) => (Math.hypot(w[0], w[1]) > 0.6 ? 1 : -1)');
ok('Sphere checker on the z-globe at stage 0 = the cells of z (around infinity)', R.chkL0.c0 >= 300 && R.chkL0.c1 >= 300 && R.chkL0.bad0 === 0 && R.chkL0.bad1 === 0, R.chkL0);
await shot('p3rv_chk_L0');
await load('p3rvCc' + Date.now(), Object.assign({ shapes: [H], steps: [CAY], srcView: { cx: 0, cy: 1, s: 60 } }, base1));
await ev('__cmwSetView("R", "sphere"); 1'); await rest(2500);
await ev('__cmwCam("R", { pitch: 0.35, yaw: -0.4, dist: 3.4 }); 1'); await rest(900);
R.chkCay = await sphereCheck('R', '(w) => { const dx = 1 - w[0], dy = -w[1], q = dx * dx + dy * dy; if (q < 1e-24) return null; const nx = 1 + w[0], ny = w[1]; const ux = (nx * dx + ny * dy) / q, uy = (ny * dx - nx * dy) / q; return [-uy, ux]; }', '(w) => (Math.hypot(w[0], w[1]) < 1 ? 1 : -1)');
ok('Sphere checker on the w-globe of Cayley(H) = the cells of z = i(1 + w)/(1 - w)', R.chkCay.c0 >= 300 && R.chkCay.c1 >= 300 && R.chkCay.bad0 === 0 && R.chkCay.bad1 === 0, R.chkCay);
await shot('p3rv_chk_cay');

// ---- 2. the left plane at stage 1 of [z^i, z^2] with the Checker against Inverse.renderCPU with the same pattern:
// colours away from the rims and the cell edges (where anti-aliasing differs) agree within 40/255
await load('p3rvG' + Date.now(), Object.assign({ shapes: [H], steps: [ZI, { type: 'pown', params: { n: 2 }, on: true }], focus: 2, srcView: { cx: 0, cy: 1, s: 60 } }, base1, { pattern: 'checker' }));
await rest(3000);
R.gChk = await ev(`(() => {
  const lk = __cmwLook('s1', 'L');
  const St = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const steps = [St('powa', { alpha: 'i', cut: 180, k: 0 }), St('pown', { n: 2 })], built = steps.map(Funcs.build);
  const plan = Inverse.planChain(steps, built, 0, 1);
  const s = lk.view.s * lk.dpr, W = lk.W, Hh = lk.H;
  const view = { cx: lk.view.cx, cy: lk.view.cy, s, W, H: Hh, win: lk.win };
  const r = Inverse.renderCPU(plan, { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }, view, { alpha: 1, pattern: 'checker', cell: lk.cell, color: lk.color, color2: lk.color2, ink: lk.edge, plane: lk.plane, dpr: lk.dpr });
  const A = __rv.grab('L'), D = A.D, par = r.stats.par;
  const e = Math.exp(-Math.PI);
  let n = 0, bad = 0, c0 = 0, c1 = 0; const ex = [];
  for (let j = 3; j < Hh - 3; j++) for (let i = 3; i < W - 3; i++) {
    const wr = view.cx + (i + 0.5 - W / 2) / s, wi = view.cy - (j + 0.5 - Hh / 2) / s, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * s < 4 * lk.dpr) continue;
    const k = j * W + i; if (par[k] < 0) continue;
    let same = true;
    for (let dy = -3; dy <= 3 && same; dy++) for (let dx = -3; dx <= 3; dx++) if (par[k + dy * W + dx] !== par[k]) { same = false; break; }
    if (!same) continue;
    n++; if (par[k]) c1++; else c0++;
    const dm = Math.max(Math.abs(D[4 * k] - r.rgba[4 * k]), Math.abs(D[4 * k + 1] - r.rgba[4 * k + 1]), Math.abs(D[4 * k + 2] - r.rgba[4 * k + 2]));
    if (dm > 40) { bad++; if (ex.length < 4) ex.push([i, j, dm, [D[4 * k], D[4 * k + 1], D[4 * k + 2]], [r.rgba[4 * k], r.rgba[4 * k + 1], r.rgba[4 * k + 2]]]); }
  }
  return { n, c0, c1, bad, frac: bad / Math.max(1, n), ex, paths: __cmwPaths().filter((p) => p.role === 'L').map((p) => p.path) };
})()`, 120000);
ok('left plane at stage 1, Checker = renderCPU (colours within 40/255 off the rims and cell edges)', R.gChk.n > 20000 && R.gChk.c0 > 1000 && R.gChk.c1 > 1000 && R.gChk.frac <= 1e-3 && R.gChk.paths.includes('inverse'), R.gChk);

return { pass: fails.length === 0, fails, results: R };

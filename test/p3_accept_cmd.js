// P3 acceptance (notes/sphere-design/SPEC.md 12.4 (f)-(i), (n); notes/ui-design/panels.md 9.0 and 11): the exact globes,
// the left plane at a focused stage, the spherical checker on the GPU, the figure export, and the globe orientation.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_accept_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
// The P3 review's checks (globe strokes, patterns on the globes and the focused left plane, a two-globe export, the
// main thread at dpr 2) are in test/p3_review_cmd.js (SPEC 13.16).
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const base = { pattern: 'solid', alpha: 1, lines: false, unit: false };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
const settle = async (ms = 2500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// a globe pane's fill against the truth: every pixel's point w (the pane's own pick) is classified by cls(w) (page code:
// 1 inside, -1 outside, 0 neither); a pixel is fill where the frame differs from the same frame drawn with the fill
// transparent (alpha 0: the globe, its graticule, the boundary strokes and the shading are the same in both, so the
// test sees the fill alone). Samples within 4 screen px of a class change (the rims, where the strokes are) and off the
// globe are skipped; every STEP-th pixel is checked -> counts of inside / outside samples and the ones that disagree
const grab = (side) => ev(`(() => { const cv = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); window.__p3grab = window.__p3grab || {}; window.__p3grab[${JSON.stringify(side)}] = x.getImageData(0, 0, g.width, g.height).data; return [g.width, g.height]; })()`);
const globeCheck = async (side, cls, step = 2) => {
  await grab(side);
  await ev('window.__p3D1 = window.__p3grab[' + JSON.stringify(side) + ']; __cmwSet("alpha", 0); 1');
  await sleep(700);
  await grab(side);
  await ev('window.__p3D0 = window.__p3grab[' + JSON.stringify(side) + ']; __cmwSet("alpha", 1); 1');
  await sleep(700);
  return ev(`(() => {
  const cv = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}), r = cv.getBoundingClientRect();
  const D1 = window.__p3D1, D0 = window.__p3D0, GW = cv.width, dpr = cv.width / r.width;
  const pick = ${side === 'L' ? '__cmwSphereWL' : '__cmwSphereW'};
  const cls = ${cls};
  const Wd = Math.floor(r.width), Hd = Math.floor(r.height), C = new Int8Array(Wd * Hd), WW = [];
  // the globe's point labels (0, infinity, 1, i, -1, -i: drawn over the frame in both) are left out, 16 px around each
  const pc = GLR.camera(__cmwCam(${JSON.stringify(side)}), r.width, r.height);
  const proj = (p) => { const q = GLR.M4.apply(pc.MVP, p); return q[3] > 1e-6 ? [(q[0] / q[3] * 0.5 + 0.5) * r.width, (1 - (q[1] / q[3] * 0.5 + 0.5)) * r.height] : null; };
  const labs = [[0, 0, 1.1], [0, 0, -1.1], [1.06, 0, 0.1], [0, -1.06, 0.1], [-1.06, 0, 0.1], [0, 1.06, 0.1]].map(proj).filter(Boolean);
  const onLabel = (x, y) => labs.some((q) => Math.hypot(q[0] - x, q[1] - y) < 16);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const w = pick(x + 0.5, y + 0.5); C[y * Wd + x] = w ? (cls(w) || 2) : 3; WW.push(w); }
  const near = (x, y) => { const c = C[y * Wd + x]; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= Hd) return true; if (dx * dx + dy * dy <= 16 && C[yy * Wd + xx] !== c) return true; } return false; };
  const o = { inN: 0, inBad: 0, outN: 0, outBad: 0, badIn: [], badOut: [] };
  for (let y = 4; y < Hd - 4; y += ${step}) for (let x = 4; x < Wd - 4; x += ${step}) {
    const c = C[y * Wd + x]; if (c !== 1 && c !== -1) continue;
    if (near(x, y) || onLabel(x, y)) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * GW + Math.floor((x + 0.5) * dpr));
    const fill = Math.abs(D1[i] - D0[i]) + Math.abs(D1[i + 1] - D0[i + 1]) + Math.abs(D1[i + 2] - D0[i + 2]) > 24;
    const w = WW[y * Wd + x];
    if (c > 0) { o.inN++; if (!fill) { o.inBad++; if (o.badIn.length < 4) o.badIn.push([x, y, w.map((v) => +v.toPrecision(4)), [D1[i], D1[i + 1], D1[i + 2]]]); } }
    else { o.outN++; if (fill) { o.outBad++; if (o.badOut.length < 4) o.badOut.push([x, y, w.map((v) => +v.toPrecision(4)), [D1[i], D1[i + 1], D1[i + 2]], [D0[i], D0[i + 1], D0[i + 2]]]); } }
  }
  return o;
})()`, 60000);
};
const EPI = Math.exp(-Math.PI);
// the annulus e^-pi < |w| < 1 (z^i of H): inside beyond 3 px of both rims; outside: the hole cap and beyond |w| = 1
const ANNULUS = `(w) => { const a = Math.hypot(w[0], w[1]), e = ${EPI}; return a > e && a < 1 ? 1 : -1; }`;

// ---- (f) Y Sphere, z^i(H): the hole cap empty, the annulus filled, rims exact; seen from below (the hole) and the side
await view(1440, 900, false);
await load('p3acc' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwSetView("R", "sphere"); 1');
await settle();
R.pathsZi = await ev('__cmwPaths()');
ok('(f) z^i(H) on the w-globe draws inverse', R.pathsZi.some((p) => p.role === 'R' && p.viewKind === 'globe' && p.path === 'inverse'), R.pathsZi);
// the camera under the south pole, zoomed in on the hole cap (|w| < e^-pi is a cap of 5 degrees; closer, the
// strokes, drawn on a shell 0.4 % above the globe, stand several px off their rims at the view's edges: parallax)
await ev('__cmwCam("R", { pitch: -1.45, yaw: -0.6, dist: 2.2 }); 1'); await settle(900);
R.f_hole = await globeCheck('R', ANNULUS);
ok('(f) hole cap: globe-coloured, >= 400 samples', R.f_hole.outN >= 400 && R.f_hole.outBad === 0, R.f_hole);
ok('(f) annulus near the hole: fill, >= 400 samples', R.f_hole.inN >= 400 && R.f_hole.inBad === 0, R.f_hole);
await shot('p3_f_hole');
await ev('__cmwCam("R", { pitch: -0.35, yaw: -0.9, dist: 8 }); 1'); await settle(900);
R.f_side = await globeCheck('R', ANNULUS);
ok('(f) annulus from the side: fill / outside clean', R.f_side.inN >= 400 && R.f_side.inBad === 0 && R.f_side.outBad === 0, R.f_side);
await shot('p3_f_side');

// ---- (f) the Cayley images: (z - i)/(z + i) of H is |w| < 1 (w = 1 the image of infinity: no notch); of the lower
// half-plane it is |w| > 1, which covers the north pole (the image of z = -i)
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
const DISC_IN = `(w) => (Math.hypot(w[0], w[1]) < 1 ? 1 : -1)`;
await load('p3cay' + Date.now(), Object.assign({ shapes: [H], steps: [CAY], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwSetView("R", "sphere"); 1'); await settle();
R.pathsCay = await ev('__cmwPaths()');
// looking at w = 1 (the image of infinity) from outside the equator: (1, 0, 0) under the conjugate lift
await ev('__cmwCam("R", { pitch: 0.05, yaw: 0, dist: 3 }); 1'); await settle(900);
R.cay_w1 = await globeCheck('R', DISC_IN);
ok('(f) Cayley(H) at w = 1: no notch (fill inside |w| < 1 up to 3 px of the rim)', R.cay_w1.inN >= 400 && R.cay_w1.inBad === 0 && R.cay_w1.outBad === 0, R.cay_w1);
await shot('p3_f_cayley_w1');
await load('p3cay2' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'halfplane', a: [1, 0], b: [0, 0] }], steps: [CAY], srcView: { cx: 0, cy: -1, s: 60 } }, base));
await ev('__cmwSetView("R", "sphere"); 1'); await settle();
await ev('__cmwCam("R", { pitch: 1.45, yaw: -0.6, dist: 3 }); 1'); await settle(900);
const DISC_OUT = `(w) => (Math.hypot(w[0], w[1]) > 1 ? 1 : -1)`;
R.cay_N = await globeCheck('R', DISC_OUT);
// (the pole pixel itself has no w: the pick returns null at infinity; its neighbours have |w| in the thousands)
R.cay_N_far = await ev(`(() => { let n = 0, m = 0; const r = document.getElementById('canvasR').getBoundingClientRect(); for (let y = 3; y < r.height - 3; y += 2) for (let x = 3; x < r.width - 3; x += 2) { const w = __cmwSphereW(x, y); if (w && Math.hypot(w[0], w[1]) > 50) n++; } return n; })()`);
ok('(f) Cayley of the lower half-plane covers the north pole', R.cay_N.inN >= 400 && R.cay_N.inBad === 0 && R.cay_N.outBad === 0 && R.cay_N_far > 50, [R.cay_N, R.cay_N_far]);
await shot('p3_f_cayley_N');

// ---- log(H) on the w-globe reaches the pole: the strip 0 < Im w < pi, filled up to the pole
await load('p3log' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwSetView("R", "sphere"); 1'); await settle();
await ev('__cmwCam("R", { pitch: 1.2, yaw: -1.57, dist: 3 }); 1'); await settle(900);
// (the cusp at the pole, where the strip is under a pixel wide and its pixels are partly covered, is left to logH_far)
const STRIP = `(w) => (Math.hypot(w[0], w[1]) > 50 ? 0 : w[1] > 0 && w[1] < Math.PI ? 1 : -1)`;
R.logH = await globeCheck('R', STRIP, 1);
// the fill pixel nearest the pole: its |w|, and the strip's width there in pixels (pi / footprint): the fill reaches
// the pole when it ends where the strip is about a pixel wide (the lifted mesh stopped where it was still wide)
R.logH_far = await ev(`(() => {
  const cv = document.getElementById('canvasR'), r = cv.getBoundingClientRect(), D1 = window.__p3D1, D0 = window.__p3D0, GW = cv.width, dpr = cv.width / r.width;
  let best = null;
  for (let y = 2; y < r.height - 2; y++) for (let x = 2; x < r.width - 2; x++) {
    const w = __cmwSphereW(x + 0.5, y + 0.5); if (!w || !(w[1] > 0 && w[1] < Math.PI)) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * GW + Math.floor((x + 0.5) * dpr));
    if (Math.abs(D1[i] - D0[i]) + Math.abs(D1[i + 1] - D0[i + 1]) + Math.abs(D1[i + 2] - D0[i + 2]) <= 24) continue;
    const a = Math.hypot(w[0], w[1]);
    if (!best || a > best.a) { const w1 = __cmwSphereW(x + 1.5, y + 0.5), w2 = __cmwSphereW(x + 0.5, y + 1.5); const fp = Math.max(Math.hypot(w1[0] - w[0], w1[1] - w[1]), Math.hypot(w2[0] - w[0], w2[1] - w[1])); best = { a: +a.toFixed(2), widthPx: +(Math.PI / fp).toFixed(2), x, y }; }
  }
  return best;
})()`, 60000);
ok('(f) log(H) reaches the pole: the fill ends where the strip is under 2.5 px wide', !!R.logH_far && R.logH_far.widthPx < 2.5, R.logH_far);
ok('(f) log(H) on the w-globe: the strip filled, nothing outside', R.logH.inN >= 400 && R.logH.inBad === 0 && R.logH.outBad === 0, R.logH);
await shot('p3_f_logH');

// ---- X Sphere at stage 0: an unbounded region covers infinity without a hole (H, and the exterior of a disc)
await load('p3x0' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.6, complement: true }], steps: [ZI], srcView: { cx: 0, cy: 0, s: 60 } }, base));
await ev('__cmwSetView("L", "sphere"); 1'); await settle();
R.pathsX0 = await ev('__cmwPaths()');
ok('X Sphere at stage 0 draws inverse', R.pathsX0.some((p) => p.role === 'L' && p.viewKind === 'globe' && p.path === 'inverse'), R.pathsX0);
await ev('__cmwCam("L", { pitch: 1.3, yaw: -1.0, dist: 3 }); 1'); await settle(900);
const EXT = `(w) => (Math.hypot(w[0], w[1]) > 0.6 ? 1 : -1)`;
R.x0 = await globeCheck('L', EXT);
ok('X Sphere at stage 0: |z| > 0.6 covers the north pole, no hole', R.x0.inN >= 400 && R.x0.inBad === 0 && R.x0.outBad === 0, R.x0);
await shot('p3_x0_ext');
// and the upper half-plane at stage 0, seen around the north pole (its rim, the real axis, runs through infinity)
await load('p3x0h' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwSetView("L", "sphere"); 1'); await settle();
await ev('__cmwCam("L", { pitch: 1.3, yaw: -1.0, dist: 3 }); 1'); await settle(900);
R.x0H = await globeCheck('L', `(w) => (w[1] > 0 ? 1 : -1)`);
R.x0H_far = await ev(`(() => { let n = 0; const r = document.getElementById('canvasL').getBoundingClientRect(); for (let y = 3; y < r.height - 3; y += 2) for (let x = 3; x < r.width - 3; x += 2) { const w = __cmwSphereWL(x, y); if (w && w[1] > 0 && Math.hypot(w[0], w[1]) > 20) n++; } return n; })()`);
ok('X Sphere at stage 0: Im z > 0 exact around the north pole', R.x0H.inN >= 400 && R.x0H.inBad === 0 && R.x0H.outN >= 400 && R.x0H.outBad === 0 && R.x0H_far > 50, [R.x0H, R.x0H_far]);
await shot('p3_x0_H');

// ---- the globe scissor of bounded shapes (4.8 on the globe): a disc's exact image is not clipped. Y globe: z^i of
// |z - (0.3+0.8i)| < 0.3 (w is in the image iff -ln|w| lies in (-pi, pi] and z = e^{Arg w} e^{-i ln|w|} is in the
// disc); X globe at stage 0: the disc itself
const DISC = { id: 's1', kind: 'disc', c: [0.3, 0.8], r: 0.3 };
await load('p3sc' + Date.now(), Object.assign({ shapes: [DISC], steps: [ZI], srcView: { cx: 0.3, cy: 0.8, s: 200 } }, base));
await ev('__cmwSetView("R", "sphere"); __cmwSetView("L", "sphere"); 1'); await settle();
const DZI = `(w) => { const a = Math.hypot(w[0], w[1]), L = -Math.log(a); if (!(L > -Math.PI && L <= Math.PI)) return -1; const m = Math.exp(Math.atan2(w[1], w[0])), zx = m * Math.cos(-Math.log(a)), zy = m * Math.sin(-Math.log(a)); return Math.hypot(zx - 0.3, zy - 0.8) < 0.3 ? 1 : -1; }`;
for (const [side, cam, cls, tag] of [['R', { pitch: -0.9, yaw: -1.2, dist: 3.2 }, DZI, 'sc_R'], ['L', { pitch: -0.5, yaw: -1.7, dist: 3.2 }, `(w) => (Math.hypot(w[0] - 0.3, w[1] - 0.8) < 0.3 ? 1 : -1)`, 'sc_L']]) {
  await ev(`__cmwCam(${JSON.stringify(side)}, ${JSON.stringify(cam)}); 1`); await settle(900);
  R[tag] = await globeCheck(side, cls, 1);
  // the scissor the pass used (the same function, this camera): a real one, smaller than the pane
  const g0 = await ev('GLR.inverseGlobeScissors'); await ev(`__cmwCam(${JSON.stringify(side)}); __cmwSet('alpha', 1); 1`); await settle(400);
  const g1 = await ev('GLR.inverseGlobeScissors');
  R[tag + '_sc'] = { passes: g1.n - g0.n, avgPx: g1.n > g0.n ? Math.round((g1.px - g0.px) / (g1.n - g0.n)) : 0, panePx: await ev(`(() => { const cv = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}); return cv.width * cv.height; })()`) };
  ok(`globe scissor (${side}) in use, smaller than the pane`, R[tag + '_sc'].passes > 0 && R[tag + '_sc'].avgPx < 0.6 * R[tag + '_sc'].panePx, R[tag + '_sc']);
  ok(`globe scissor (${side}): the disc's exact image is whole`, R[tag].inN >= 200 && R[tag].inBad === 0 && R[tag].outBad === 0, R[tag]);
  await shot('p3_' + tag);
}
R.sc_paths = await ev('__cmwPaths().map((p) => p.role + p.viewKind + ":" + p.path)');

// ---- (n) the left globe at leftStage() = 1 of [z^i, z^2] (focus on step 2): the exact annulus on the z-globe of w1
await load('p3n' + Date.now(), Object.assign({ shapes: [H], steps: [ZI, { type: 'pown', params: { n: 2 }, on: true }], focus: 2, srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwSetView("L", "sphere"); 1'); await settle();
R.pathsN = await ev('__cmwPaths()');
R.stageN = await ev('__cmwLook("s1", "L").stage');
ok('(n) left globe at stage 1 draws inverse', R.stageN === 1 && R.pathsN.some((p) => p.role === 'L' && p.viewKind === 'globe' && p.path === 'inverse'), [R.stageN, R.pathsN]);
await ev('__cmwCam("L", { pitch: -1.45, yaw: -0.6, dist: 2.2 }); 1'); await settle(900);
R.n_hole = await globeCheck('L', ANNULUS);
ok('(n) left globe: hole cap empty, annulus filled', R.n_hole.outN >= 400 && R.n_hole.outBad === 0 && R.n_hole.inN >= 400 && R.n_hole.inBad === 0, R.n_hole);
await shot('p3_n_hole');

// ---- (g) the left plane at stage 1 of [z^i, z^2] is exact: its fill equals the CPU render of z^i(H) (IoU >= 0.999)
await ev('__cmwSetView("L", "plane"); 1'); await settle();
R.pathsG = await ev('__cmwPaths()');
ok('(g) left plane at stage 1 draws inverse', R.pathsG.some((p) => p.role === 'L' && p.viewKind === 'flat' && p.path === 'inverse'), R.pathsG);
R.g = await ev(`(() => {
  const lk = __cmwLook('s1', 'L');
  const St = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const steps = [St('powa', { alpha: 'i', cut: 180, k: 0 }), St('pown', { n: 2 })], built = steps.map(Funcs.build);
  const plan = Inverse.planChain(steps, built, 0, 1);
  const s = lk.view.s * lk.dpr, W = lk.W, Hh = lk.H;
  const view = { cx: lk.view.cx, cy: lk.view.cy, s, W, H: Hh, win: lk.win };
  const t0 = performance.now();
  const r = Inverse.renderCPU(plan, { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }, view, { alpha: 1, pattern: 'solid', color: lk.color, color2: lk.color2, ink: lk.edge });
  const cv = document.getElementById('canvasL'), g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height;
  const x = g.getContext('2d'); x.drawImage(cv, 0, 0); const D = x.getImageData(0, 0, g.width, g.height).data;
  let inter = 0, uni = 0, n = 0, gOnly = 0, cOnly = 0;
  const e = Math.exp(-Math.PI);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const wr = view.cx + (i + 0.5 - W / 2) / s, wi = view.cy - (j + 0.5 - Hh / 2) / s, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * s < 4 * lk.dpr) continue;   // the boundary strokes (line renderer)
    const k = j * W + i, gp = D[4 * k] < 0.6 * D[4 * k + 2] && D[4 * k + 2] > 60, cp = r.stats.alpha[k] > 0.5;
    n++; if (gp && cp) inter++; if (gp || cp) uni++; if (gp && !cp) gOnly++; if (cp && !gp) cOnly++;
  }
  return { iou: uni ? inter / uni : 1, n, inter, gOnly, cOnly, cpuMs: Math.round(performance.now() - t0), W, H: Hh };
})()`);
ok('(g) left plane at stage 1 = CPU render of z^i(H), IoU >= 0.999', R.g.iou >= 0.999 && R.g.inter > 1000, R.g);
await shot('p3_g_left');

// ---- (i) the spherical checker on the GPU: log(H) columns at Re w = ln tan(j pi / 16) +- 0.5 px
await load('p3i' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base, { pattern: 'sphere' }));
await settle();
R.menu = await ev(`[...document.querySelectorAll('#patternSeg .pat')].map((b) => b.getAttribute('aria-label'))`);
ok('(i) the menu offers Sphere checker', R.menu.includes('Sphere checker'), R.menu);
R.i = await ev(`(() => {
  const lk = __cmwLook('s1', 'R'), s = lk.view.s * lk.dpr, W = lk.W, Hh = lk.H;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const c0 = hex(lk.color), c1 = hex(lk.color2);
  const cv = document.getElementById('canvasR'), g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height;
  const x = g.getContext('2d'); x.drawImage(cv, 0, 0); const D = x.getImageData(0, 0, g.width, g.height).data;
  const tOf = (k) => { let num = 0, den = 0; for (let q = 0; q < 3; q++) { const d = c1[q] - c0[q]; num += (D[4 * k + q] - c0[q]) * d; den += d * d; } return num / den; };
  const wy = 5 * Math.PI / 16, j = Math.round(Hh / 2 - (wy - lk.view.cy) * s - 0.5);
  const vals = []; for (let i = 0; i < W; i++) vals.push(tOf(j * W + i));
  const xs = []; for (let i = 1; i < W; i++) { const a = vals[i - 1] - 0.5, b = vals[i] - 0.5; if (a * b < 0) xs.push(i - 1 + a / (a - b) + 0.5); }
  let worst = 0, matched = 0, expected = 0;
  for (let q = 1; q < 16; q++) {
    const re = Math.log(Math.tan(q * Math.PI / 16)), px = (re - lk.view.cx) * s + W / 2;
    if (px < 3 || px > W - 3) continue;
    const wl = (re - Math.log(Math.tan((q - 1) * Math.PI / 16))) * s, wr = (Math.log(Math.tan((q + 1) * Math.PI / 16)) - re) * s;
    if (!(wl >= 3 && wr >= 3)) continue;
    expected++;
    const d = Math.min(...xs.map((c) => Math.abs(c - px)));
    worst = Math.max(worst, d); if (d <= 0.5) matched++;
  }
  return { expected, matched, worst: +worst.toFixed(3), crossings: xs.length, sphN: lk.sphN };
})()`);
ok('(i) GPU sphere checker log(H) columns within 0.5 px', R.i.expected >= 4 && R.i.matched === R.i.expected, R.i);
await shot('p3_i_logH_sphere');

// ---- (h) the figure export at 300 dpi of z^i(H): exact (the analytic annulus) and equal to the screen scaled;
// a cancelled export returns at once and never blocks the main thread for more than 50 ms
await load('p3h' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await settle();
R.h = await ev(`await (async () => {
  const lk = __cmwLook('s1', 'R'), cv = document.getElementById('canvasR'), rr = cv.getBoundingClientRect();
  const dpr = 300 / 96, w = rr.width, h = rr.height;
  const url = __cmwRenderOff('R', w, h, dpr);
  const img = new Image(); img.src = url; await img.decode();
  const g = document.createElement('canvas'); g.width = img.width; g.height = img.height; const x = g.getContext('2d'); x.drawImage(img, 0, 0);
  const E = x.getImageData(0, 0, g.width, g.height).data, EW = g.width, EH = g.height;
  const g2 = document.createElement('canvas'); g2.width = cv.width; g2.height = cv.height; const x2 = g2.getContext('2d'); x2.drawImage(cv, 0, 0);
  const D = x2.getImageData(0, 0, g2.width, g2.height).data, SW = g2.width, SH = g2.height;
  const fill = (A, k) => A[4 * k] < 0.6 * A[4 * k + 2] && A[4 * k + 2] > 60;
  const e = Math.exp(-Math.PI), v = lk.view;
  // the export against the truth (outside 4 screen px of the rims, where the strokes are)
  const se = v.s * w / w * dpr;   // export px per unit (the view scaled with the panel: same window)
  let n = 0, bad = 0, inter = 0, uni = 0;
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const wr = v.cx + (i + 0.5 - EW / 2) / se, wi = v.cy - (j + 0.5 - EH / 2) / se, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * v.s < 4) continue;
    const t = a > e && a < 1, f = fill(E, j * EW + i);
    n++; if (t !== f) bad++;
  }
  // the screen against the export sampled at screen pixel centres
  const ss = v.s * lk.dpr;
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    const wr = v.cx + (i + 0.5 - SW / 2) / ss, wi = v.cy - (j + 0.5 - SH / 2) / ss, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * v.s < 4) continue;
    const ei = Math.min(EW - 1, Math.floor((i + 0.5) / SW * EW)), ej = Math.min(EH - 1, Math.floor((j + 0.5) / SH * EH));
    const fs = fill(D, j * SW + i), fe = fill(E, ej * EW + ei);
    if (fs && fe) inter++; if (fs || fe) uni++;
  }
  return { EW, EH, dpiOk: Math.abs(EW / w - 300 / 96) < 0.01, n, bad, truthErr: bad / Math.max(1, n), iou: uni ? inter / uni : 1 };
})()`);
ok('(h) the export is 300 dpi', R.h.dpiOk, R.h);
ok('(h) the export is exact (fill = annulus away from the strokes)', R.h.n > 100000 && R.h.truthErr <= 1e-4, R.h);
ok('(h) the export equals the screen scaled, IoU >= 0.999', R.h.iou >= 0.999, R.h);
// cancellation: a new chain (its inverse program compiles: prepareExport waits), cancelled after 40 ms
await load('p3hc' + Date.now(), Object.assign({ shapes: [H, { id: 's2', kind: 'disc', c: [0.4, 0.8], r: 0.3 }], steps: [ZI, { type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await sleep(30);
R.hc = await ev(`await (async () => {
  const long = [];
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch (e) {}
  let live = true; const t0 = performance.now();
  setTimeout(() => { live = false; }, 40);
  const res = await __cmwBuildFigure({ alive: () => live });
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 60));
  po.disconnect();
  // the full export afterwards (not cancelled): its time
  const t2 = performance.now(); const f = await __cmwBuildFigure({}); const t3 = performance.now();
  return { cancelled: res === null, returnedMs: Math.round(t1 - t0), longTasks: long, fullMs: Math.round(t3 - t2), fullOk: !!(f && f.svg && f.svg.length > 1000) };
})()`);
ok('(h) a cancelled export returns null soon after the cancel', R.hc.cancelled && R.hc.returnedMs < 40 + 80, R.hc);
ok('(h) no main-thread task over 50 ms while preparing and cancelling', (R.hc.longTasks || [null]).every((d) => d !== null && d <= 50), R.hc);
ok('(h) the export completes when not cancelled', R.hc.fullOk, R.hc);

// the dialog: options toggled while a figure is being made (each change cancels the one in progress): the last one
// wins, and no main-thread task over 50 ms meanwhile (after the first preview, whose caption typesetting is MathJax's)
await ev(`document.getElementById('exportBtn').click(); 1`); await sleep(300);
await ev(`(() => { const b = [...document.querySelectorAll('button, [role=menuitem]')].find((x) => /Figure for an article/.test(x.textContent)); if (b) b.click(); return !!b; })()`);
const waitPreview = async () => { for (let i = 0; i < 100; i++) { const r = await ev(`(() => { const p = document.querySelector('.fig-preview'); return !!(p && !p.classList.contains('busy') && p.querySelector('img')); })()`); if (r) return true; await sleep(100); } return false; };
R.dlgFirst = await waitPreview();
R.dlg = await ev(`await (async () => {
  const long = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch (e) {}
  const btn = (v) => document.querySelector('#figWidth > button[data-v="' + v + '"]');
  const seq = ['3.4', '7', '3.4', '7', '3.4'];
  for (const v of seq) { btn(v).click(); await new Promise((r) => setTimeout(r, 15)); }
  for (let i = 0; i < 100; i++) { const p = document.querySelector('.fig-preview'); if (p && !p.classList.contains('busy')) break; await new Promise((r) => setTimeout(r, 50)); }
  await new Promise((r) => setTimeout(r, 100));
  po.disconnect();
  const note = (document.querySelector('.fig-note') || {}).textContent || '';
  return { long, note: note.slice(0, 40), last: /Single column/.test(note) };
})()`, 60000);
await ev(`(() => { const b = [...document.querySelectorAll('.modal .btn')].find((x) => x.textContent === 'Close'); if (b) b.click(); return 1; })()`);
ok('(h) the dialog: the last option wins', R.dlgFirst && R.dlg.last, R.dlg);
ok('(h) the dialog: no main-thread task over 50 ms while options change', (R.dlg.long || [null]).every((d) => d !== null && d <= 50), R.dlg);

// ---- (c) on the globe: mixed paths keep list order (rev 2): H inverse under a disc drawn forward (forced) gives the
// same frame as both inverse, but where the forward mesh and the exact image differ (rims): <= 0.5 % of the pane
await load('p3c' + Date.now(), { shapes: [H, { id: 's2', kind: 'disc', c: [0.3, 0.8], r: 0.3 }], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 }, pattern: 'checker', alpha: 0.85, lines: false, unit: false });
await ev('__cmwSetView("R", "sphere"); 1'); await settle();
await ev('__cmwCam("R", { pitch: -0.35, yaw: -0.9, dist: 8 }); 1'); await settle(900);
await grab('R'); await ev('window.__p3Inv = window.__p3grab.R; __cmwForceForward(["s2"]); 1'); await settle(1500);
R.c_paths = await ev('__cmwPaths().filter((p) => p.role === "R").map((p) => p.id + ":" + p.path)');
await grab('R'); await ev('window.__p3Fwd = window.__p3grab.R; __cmwForceForward([]); 1'); await settle(900);
R.c = await ev(`(() => { const A = window.__p3Inv, B = window.__p3Fwd; let n = 0, d = 0, dd = 0; for (let i = 0; i < A.length; i += 4) { n++; const m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (m > 3) d++; if (m > 0) dd++; } return { n, diff3: d, frac: +(d / n).toFixed(5), anyDiff: dd }; })()`);
ok('(c) globe: s1 inverse, s2 forced forward', JSON.stringify(R.c_paths) === JSON.stringify(['s1:inverse', 's2:forward']), R.c_paths);
ok('(c) globe: mixed paths in list order, frame differs <= 0.5 % from all-inverse', R.c.frac <= 0.005 && R.c.anyDiff > 0, R.c);

// ---- the globe orientation (panels.md 9.0): a screen triangle on the w-globe maps to a w triangle of the same
// handedness (with the plain lift every globe was a mirror image)
await load('p3o' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'disc', c: [0.5, 0], r: 0.45 }], steps: [], srcView: { cx: 0.5, cy: 0, s: 300 } }, base, { pattern: 'tiles' }));
await ev('__cmwSetView("L", "sphere"); __cmwSetView("R", "sphere"); 1'); await settle();
R.hand = await ev(`(() => {
  const out = { R: [0, 0], L: [0, 0] };
  for (const [side, pick] of [['R', __cmwSphereW], ['L', __cmwSphereWL]]) {
    const r = document.getElementById(side === 'R' ? 'canvasR' : 'canvasL').getBoundingClientRect();
    for (let y = 20; y < r.height - 20; y += 23) for (let x = 20; x < r.width - 20; x += 23) {
      const a = pick(x, y), b = pick(x + 4, y), c = pick(x, y - 4);
      if (!a || !b || !c) continue;
      const wa = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      out[side][wa > 0 ? 0 : 1]++;
    }
  }
  return out;
})()`);
ok('globe orientation: every picked triangle keeps its handedness (both globes)', R.hand.R[0] > 50 && R.hand.R[1] === 0 && R.hand.L[0] > 50 && R.hand.L[1] === 0, R.hand);
await shot('p3_orient_tiles');
R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

// P3 acceptance (notes/sphere-design/SPEC.md 12.4 (f), (g), (n); notes/ui-design/panels.md 9.0 and 11) in the steps view
// (ci/suite_views.js: steps({ pin: true })): the exact globes, a later plane at a focused stage, and the globe
// orientation. The z-globe is plane z on the Sphere surface and the w-globe a later plane on it; the steps view shows
// one plane in the left pane. The figure export's checks (h) are test/p3_accept_export_cmd.js, the spherical checker's
// (i) test/p3_accept_classic_cmd.js.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_accept_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
// The P3 review's checks (globe strokes, patterns on the globes and the focused left plane, a two-globe export, the
// main thread at dpr 2) are in test/p3_review_cmd.js (SPEC 13.16).
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// (the phase colouring: a saturated hue at every point, never the paper's or the globe's grey; Inside regions)
const base = { dc: 'phase', lines: false, unit: false };
const IN = (at) => ({ sv: { at, scope: 'in' } });
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
const settle = async (ms = 2500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
// a plane of the steps view on a surface: plane k ('sphere' or 'plane'), shown at once
const plane = (k, surf) => ev(`__cmwSteps({ go: ${k}, now: true, surf: '${surf}' }); 1`);
// how the shown plane drew shape id: 'inverse' or 'forward' (__cmwDrawn, with exact images on)
const drawn = (id) => ev(`__cmwDrawn()['L|${id}'] || null`);
// a pixel is fill (page code FILL(A, B, i), A the frame Inside regions, B the same frame coloured Everywhere, i the
// pixel's offset) where A shows B's colour: within 24/255 summed over the channels, or A not grey (its channels spread
// by 24/255 or more) with B's hue (each channel's share of the sum within 0.03; a line of the globe's net drawn over
// one frame and not the other darkens a pixel without changing its hue). Outside a region A shows the bare globe, grey
const FILL = `((A, B, i) => {
  if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) <= 24) return true;
  if (Math.max(A[i], A[i + 1], A[i + 2]) - Math.min(A[i], A[i + 1], A[i + 2]) < 24) return false;
  const sa = A[i] + A[i + 1] + A[i + 2], sb = Math.max(1, B[i] + B[i + 1] + B[i + 2]);
  return [0, 1, 2].every((c) => Math.abs(A[i + c] / sa - B[i + c] / sb) < 0.03);
})`;
// the shown globe's fill against the truth: every pixel's point w (the globe's pick, __cmwSphereWL) is classified by
// cls(w) (page code: 1 inside, -1 outside, 0 neither) and its fill read by FILL. Samples within 4 screen px of a class
// change (the rims, where the strokes are) and off the globe are skipped; every STEP-th pixel is checked -> counts of
// inside / outside samples and the ones that disagree
const grab = (side) => ev(`(() => { const cv = document.getElementById('canvasL'); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); window.__p3grab = window.__p3grab || {}; window.__p3grab[${JSON.stringify(side)}] = x.getImageData(0, 0, g.width, g.height).data; return [g.width, g.height]; })()`);
// (the two frames: __p3D1 Inside regions, __p3D0 Everywhere)
const frames = async () => {
  await grab('L');
  await ev('window.__p3D1 = window.__p3grab.L; __cmwSteps({ scope: "all" }); 1');
  await sleep(700);
  await grab('L');
  await ev('window.__p3D0 = window.__p3grab.L; __cmwSteps({ scope: "in" }); 1');
  await sleep(700);
};
const globeCheck = async (cls, step = 2) => {
  await frames();
  return ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect();
  const D1 = window.__p3D1, D0 = window.__p3D0, GW = cv.width, dpr = cv.width / r.width;
  const pick = __cmwSphereWL;
  const cls = ${cls};
  const Wd = Math.floor(r.width), Hd = Math.floor(r.height), C = new Int8Array(Wd * Hd), WW = [];
  // the globe's point labels (0, infinity, 1, i, -1, -i: drawn over the frame in both) are left out, 16 px around each
  const pc = GLR.camera(__cmwCam('L'), r.width, r.height);
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
    const fill = ${FILL}(D1, D0, i);
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

// ---- (f) the w-globe, z^i(H): the hole cap empty, the annulus filled, rims exact; seen from below (the hole) and the side
await view(1440, 900, false);
await load('p3acc' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base, IN(1)));
if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) {
  return { pass: false, fails: [{ name: 'the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)' }], results: R };
}
await plane(1, 'sphere');
await settle();
R.pathZi = await drawn('s1');
ok('(f) z^i(H) on the w-globe draws inverse', R.pathZi === 'inverse', R.pathZi);
// the camera under the south pole, zoomed in on the hole cap (|w| < e^-pi is a cap of 5 degrees; closer, the
// strokes, drawn on a shell 0.4 % above the globe, stand several px off their rims at the view's edges: parallax)
await ev('__cmwCam("L", { pitch: -1.45, yaw: -0.6, dist: 2.2 }); 1'); await settle(900);
R.f_hole = await globeCheck(ANNULUS);
ok('(f) hole cap: globe-coloured, >= 400 samples', R.f_hole.outN >= 400 && R.f_hole.outBad === 0, R.f_hole);
ok('(f) annulus near the hole: fill, >= 400 samples', R.f_hole.inN >= 400 && R.f_hole.inBad === 0, R.f_hole);
await shot('p3_f_hole');
await ev('__cmwCam("L", { pitch: -0.35, yaw: -0.9, dist: 8 }); 1'); await settle(900);
R.f_side = await globeCheck(ANNULUS);
ok('(f) annulus from the side: fill / outside clean', R.f_side.inN >= 400 && R.f_side.inBad === 0 && R.f_side.outBad === 0, R.f_side);
await shot('p3_f_side');

// ---- (f) the Cayley images: (z - i)/(z + i) of H is |w| < 1 (w = 1 the image of infinity: no notch); of the lower
// half-plane it is |w| > 1, which covers the north pole (the image of z = -i)
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
const DISC_IN = `(w) => (Math.hypot(w[0], w[1]) < 1 ? 1 : -1)`;
await load('p3cay' + Date.now(), Object.assign({ shapes: [H], steps: [CAY], srcView: { cx: 0, cy: 1, s: 60 } }, base, IN(1)));
await plane(1, 'sphere'); await settle();
R.pathCay = await drawn('s1');
// looking at w = 1 (the image of infinity) from outside the equator: (1, 0, 0) under the conjugate lift
await ev('__cmwCam("L", { pitch: 0.05, yaw: 0, dist: 3 }); 1'); await settle(900);
R.cay_w1 = await globeCheck(DISC_IN);
ok('(f) Cayley(H) at w = 1: no notch (fill inside |w| < 1 up to 3 px of the rim)', R.cay_w1.inN >= 400 && R.cay_w1.inBad === 0 && R.cay_w1.outBad === 0, R.cay_w1);
await shot('p3_f_cayley_w1');
await load('p3cay2' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'halfplane', a: [1, 0], b: [0, 0] }], steps: [CAY], srcView: { cx: 0, cy: -1, s: 60 } }, base, IN(1)));
await plane(1, 'sphere'); await settle();
await ev('__cmwCam("L", { pitch: 1.45, yaw: -0.6, dist: 3 }); 1'); await settle(900);
const DISC_OUT = `(w) => (Math.hypot(w[0], w[1]) > 1 ? 1 : -1)`;
R.cay_N = await globeCheck(DISC_OUT);
// (the pole pixel itself has no w: the pick returns null at infinity; its neighbours have |w| in the thousands)
R.cay_N_far = await ev(`(() => { let n = 0, m = 0; const r = document.getElementById('canvasL').getBoundingClientRect(); for (let y = 3; y < r.height - 3; y += 2) for (let x = 3; x < r.width - 3; x += 2) { const w = __cmwSphereWL(x, y); if (w && Math.hypot(w[0], w[1]) > 50) n++; } return n; })()`);
ok('(f) Cayley of the lower half-plane covers the north pole', R.cay_N.inN >= 400 && R.cay_N.inBad === 0 && R.cay_N.outBad === 0 && R.cay_N_far > 50, [R.cay_N, R.cay_N_far]);
await shot('p3_f_cayley_N');

// ---- log(H) on the w-globe reaches the pole: the strip 0 < Im w < pi, filled up to the pole
await load('p3log' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base, IN(1)));
await plane(1, 'sphere'); await settle();
await ev('__cmwCam("L", { pitch: 1.2, yaw: -1.57, dist: 3 }); 1'); await settle(900);
// (the cusp at the pole, where the strip is under a pixel wide and its pixels are partly covered, is left to logH_far)
const STRIP = `(w) => (Math.hypot(w[0], w[1]) > 50 ? 0 : w[1] > 0 && w[1] < Math.PI ? 1 : -1)`;
R.logH = await globeCheck(STRIP, 1);
// the fill pixel nearest the pole: its |w|, and the strip's width there in pixels (pi / footprint): the fill reaches
// the pole when it ends where the strip is about a pixel wide (the lifted mesh stopped where it was still wide)
R.logH_far = await ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), D1 = window.__p3D1, D0 = window.__p3D0, GW = cv.width, dpr = cv.width / r.width;
  let best = null;
  for (let y = 2; y < r.height - 2; y++) for (let x = 2; x < r.width - 2; x++) {
    const w = __cmwSphereWL(x + 0.5, y + 0.5); if (!w || !(w[1] > 0 && w[1] < Math.PI)) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * GW + Math.floor((x + 0.5) * dpr));
    if (!${FILL}(D1, D0, i)) continue;
    const a = Math.hypot(w[0], w[1]);
    if (!best || a > best.a) { const w1 = __cmwSphereWL(x + 1.5, y + 0.5), w2 = __cmwSphereWL(x + 0.5, y + 1.5); const fp = Math.max(Math.hypot(w1[0] - w[0], w1[1] - w[1]), Math.hypot(w2[0] - w[0], w2[1] - w[1])); best = { a: +a.toFixed(2), widthPx: +(Math.PI / fp).toFixed(2), x, y }; }
  }
  return best;
})()`, 60000);
ok('(f) log(H) reaches the pole: the fill ends where the strip is under 2.5 px wide', !!R.logH_far && R.logH_far.widthPx < 2.5, R.logH_far);
ok('(f) log(H) on the w-globe: the strip filled, nothing outside', R.logH.inN >= 400 && R.logH.inBad === 0 && R.logH.outBad === 0, R.logH);
await shot('p3_f_logH');

// ---- the z-globe (plane z): an unbounded region covers infinity without a hole (H, and the exterior of a disc)
await load('p3x0' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.6, complement: true }], steps: [ZI], srcView: { cx: 0, cy: 0, s: 60 } }, base, IN(0)));
await plane(0, 'sphere'); await settle();
R.pathX0 = await drawn('s1');
ok('the z-globe draws inverse', R.pathX0 === 'inverse', R.pathX0);
await ev('__cmwCam("L", { pitch: 1.3, yaw: -1.0, dist: 3 }); 1'); await settle(900);
const EXT = `(w) => (Math.hypot(w[0], w[1]) > 0.6 ? 1 : -1)`;
R.x0 = await globeCheck(EXT);
ok('the z-globe: |z| > 0.6 covers the north pole, no hole', R.x0.inN >= 400 && R.x0.inBad === 0 && R.x0.outBad === 0, R.x0);
await shot('p3_x0_ext');
// and the upper half-plane on the z-globe, seen around the north pole (its rim, the real axis, runs through infinity)
await load('p3x0h' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base, IN(0)));
await plane(0, 'sphere'); await settle();
await ev('__cmwCam("L", { pitch: 1.3, yaw: -1.0, dist: 3 }); 1'); await settle(900);
R.x0H = await globeCheck(`(w) => (w[1] > 0 ? 1 : -1)`);
R.x0H_far = await ev(`(() => { let n = 0; const r = document.getElementById('canvasL').getBoundingClientRect(); for (let y = 3; y < r.height - 3; y += 2) for (let x = 3; x < r.width - 3; x += 2) { const w = __cmwSphereWL(x, y); if (w && w[1] > 0 && Math.hypot(w[0], w[1]) > 20) n++; } return n; })()`);
ok('the z-globe: Im z > 0 exact around the north pole', R.x0H.inN >= 400 && R.x0H.inBad === 0 && R.x0H.outN >= 400 && R.x0H.outBad === 0 && R.x0H_far > 50, [R.x0H, R.x0H_far]);
await shot('p3_x0_H');

// ---- the globe scissor of bounded shapes (4.8 on the globe): a disc's exact image is not clipped. Y globe: z^i of
// |z - (0.3+0.8i)| < 0.3 (w is in the image iff -ln|w| lies in (-pi, pi] and z = e^{Arg w} e^{-i ln|w|} is in the
// disc); X globe at stage 0: the disc itself
const DISC = { id: 's1', kind: 'disc', c: [0.3, 0.8], r: 0.3 };
await load('p3sc' + Date.now(), Object.assign({ shapes: [DISC], steps: [ZI], srcView: { cx: 0.3, cy: 0.8, s: 200 } }, base, IN(1)));
const DZI = `(w) => { const a = Math.hypot(w[0], w[1]), L = -Math.log(a); if (!(L > -Math.PI && L <= Math.PI)) return -1; const m = Math.exp(Math.atan2(w[1], w[0])), zx = m * Math.cos(-Math.log(a)), zy = m * Math.sin(-Math.log(a)); return Math.hypot(zx - 0.3, zy - 0.8) < 0.3 ? 1 : -1; }`;
R.sc_paths = [];
const DZ = `(w) => (Math.hypot(w[0] - 0.3, w[1] - 0.8) < 0.3 ? 1 : -1)`;
for (const [k, cam, cls, tag] of [[1, { pitch: -0.9, yaw: -1.2, dist: 3.2 }, DZI, 'sc_w1'], [0, { pitch: -0.5, yaw: -1.7, dist: 3.2 }, DZ, 'sc_z']]) {
  await plane(k, 'sphere'); await settle();
  await ev(`__cmwCam('L', ${JSON.stringify(cam)}); 1`); await settle(900);
  R[tag] = await globeCheck(cls, 1);
  // the scissor the pass used (the same function, this camera): a real one, smaller than the pane
  const g0 = await ev('GLR.inverseGlobeScissors'); await ev(`__cmwCam('L'); __cmwSet('alpha', 1); 1`); await settle(400);
  const g1 = await ev('GLR.inverseGlobeScissors');
  R[tag + '_sc'] = { passes: g1.n - g0.n, avgPx: g1.n > g0.n ? Math.round((g1.px - g0.px) / (g1.n - g0.n)) : 0, panePx: await ev(`(() => { const cv = document.getElementById('canvasL'); return cv.width * cv.height; })()`) };
  ok(`globe scissor (plane ${k}) in use, smaller than the pane`, R[tag + '_sc'].passes > 0 && R[tag + '_sc'].avgPx < 0.6 * R[tag + '_sc'].panePx, R[tag + '_sc']);
  ok(`globe scissor (plane ${k}): the disc's exact image is whole`, R[tag].inN >= 200 && R[tag].inBad === 0 && R[tag].outBad === 0, R[tag]);
  R.sc_paths.push(k + ':' + (await drawn('s1')));
  await shot('p3_' + tag);
}

// ---- (n) plane w1 of [z^i, z^2] on the globe (focus on step 2, leftStage() = 1): the exact annulus
await load('p3n' + Date.now(), Object.assign({ shapes: [H], steps: [ZI, { type: 'pown', params: { n: 2 }, on: true }], focus: 2, srcView: { cx: 0, cy: 1, s: 60 } }, base, IN(1)));
await plane(1, 'sphere'); await settle();
R.pathN = await drawn('s1');
R.stageN = await ev('__cmwLook("s1", "L").stage');
ok('(n) plane w1 on the globe draws inverse', R.stageN === 1 && R.pathN === 'inverse', [R.stageN, R.pathN]);
await ev('__cmwCam("L", { pitch: -1.45, yaw: -0.6, dist: 2.2 }); 1'); await settle(900);
R.n_hole = await globeCheck(ANNULUS);
ok('(n) plane w1 on the globe: hole cap empty, annulus filled', R.n_hole.outN >= 400 && R.n_hole.outBad === 0 && R.n_hole.inN >= 400 && R.n_hole.inBad === 0, R.n_hole);
await shot('p3_n_hole');

// ---- (g) plane w1 of [z^i, z^2] on the Plane surface is exact: its fill equals the CPU render of z^i(H) (IoU >= 0.999)
await plane(1, 'plane'); await settle();
R.pathG = await drawn('s1');
ok('(g) plane w1 draws inverse', R.pathG === 'inverse', R.pathG);
// (a pixel's fill read by FILL, as on the globe)
await frames();
R.g = await ev(`(() => {
  const lk = __cmwLook('s1', 'L');
  const St = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const steps = [St('powa', { alpha: 'i', cut: 180, k: 0 }), St('pown', { n: 2 })], built = steps.map(Funcs.build);
  const plan = Inverse.planChain(steps, built, 0, 1);
  const s = lk.view.s * lk.dpr, W = lk.W, Hh = lk.H;
  const view = { cx: lk.view.cx, cy: lk.view.cy, s, W, H: Hh, win: lk.win };
  const t0 = performance.now();
  const r = Inverse.renderCPU(plan, { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }, view, { alpha: 1, pattern: 'solid', color: lk.color, color2: lk.color2, ink: lk.edge });
  const D1 = window.__p3D1, D0 = window.__p3D0;
  let inter = 0, uni = 0, n = 0, gOnly = 0, cOnly = 0;
  const e = Math.exp(-Math.PI);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const wr = view.cx + (i + 0.5 - W / 2) / s, wi = view.cy - (j + 0.5 - Hh / 2) / s, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * s < 4 * lk.dpr) continue;   // the boundary strokes (line renderer)
    const k = j * W + i, gp = ${FILL}(D1, D0, 4 * k), cp = r.stats.alpha[k] > 0.5;
    n++; if (gp && cp) inter++; if (gp || cp) uni++; if (gp && !cp) gOnly++; if (cp && !gp) cOnly++;
  }
  return { iou: uni ? inter / uni : 1, n, inter, gOnly, cOnly, cpuMs: Math.round(performance.now() - t0), W, H: Hh };
})()`);
ok('(g) plane w1 = CPU render of z^i(H), IoU >= 0.999', R.g.iou >= 0.999 && R.g.inter > 1000, R.g);
await shot('p3_g_left');

// ---- (c) on the globe: mixed paths: H inverse beside a disc drawn forward (forced) gives the same frame as both
// inverse, but where the forward mesh and the exact image differ (rims): <= 0.5 % of the pane. (The disc lies in the
// lower half-plane: one colouring fills every region, so a disc inside H would add nothing to the frame.)
await load('p3c' + Date.now(), Object.assign({ shapes: [H, { id: 's2', kind: 'disc', c: [0.3, -0.8], r: 0.3 }], steps: [ZI],
  srcView: { cx: 0, cy: 1, s: 60 } }, base, IN(1)));
await plane(1, 'sphere'); await settle();
await ev('__cmwCam("L", { pitch: -0.35, yaw: -0.9, dist: 8 }); 1'); await settle(900);
await grab('L'); await ev('window.__p3Inv = window.__p3grab.L; __cmwForceForward(["s2"]); 1'); await settle(1500);
R.c_paths = [await drawn('s1'), await drawn('s2')].map((p, i) => 's' + (i + 1) + ':' + p);
await grab('L'); await ev('window.__p3Fwd = window.__p3grab.L; __cmwForceForward([]); 1'); await settle(900);
R.c = await ev(`(() => { const A = window.__p3Inv, B = window.__p3Fwd; let n = 0, d = 0, dd = 0; for (let i = 0; i < A.length; i += 4) { n++; const m = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (m > 3) d++; if (m > 0) dd++; } return { n, diff3: d, frac: +(d / n).toFixed(5), anyDiff: dd }; })()`);
ok('(c) globe: s1 inverse, s2 forced forward', JSON.stringify(R.c_paths) === JSON.stringify(['s1:inverse', 's2:forward']), R.c_paths);
ok('(c) globe: mixed paths, frame differs <= 0.5 % from all-inverse', R.c.frac <= 0.005 && R.c.anyDiff > 0, R.c);

// ---- the globe orientation (panels.md 9.0): a screen triangle on a globe maps to a triangle of the same handedness
// (with the plain lift every globe was a mirror image): the z-globe (plane z) and the w-globe (plane w1)
await load('p3o' + Date.now(), Object.assign({ shapes: [{ id: 's1', kind: 'disc', c: [0.5, 0], r: 0.45 }], steps: [ZI], srcView: { cx: 0.5, cy: 0, s: 300 } }, base, IN(0)));
const hand = () => ev(`(() => {
  const out = [0, 0], r = document.getElementById('canvasL').getBoundingClientRect();
  for (let y = 20; y < r.height - 20; y += 23) for (let x = 20; x < r.width - 20; x += 23) {
    const a = __cmwSphereWL(x, y), b = __cmwSphereWL(x + 4, y), c = __cmwSphereWL(x, y - 4);
    if (!a || !b || !c) continue;
    const wa = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    out[wa > 0 ? 0 : 1]++;
  }
  return out;
})()`);
R.hand = {};
for (const k of [0, 1]) { await plane(k, 'sphere'); await settle(); R.hand[k] = await hand(); }
ok('globe orientation: every picked triangle keeps its handedness (both globes)',
  R.hand[0][0] > 50 && R.hand[0][1] === 0 && R.hand[1][0] > 50 && R.hand[1][1] === 0, R.hand);
await shot('p3_orient_tiles');
R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

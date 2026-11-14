// P3 acceptance in the steps view (notes/sphere-design/SPEC.md 12.4 (f), (h)): the globe of the plane after the map, at
// rest on that plane, is exact. z^i(H): the hole cap empty, the annulus filled, rims exact, seen from below (the hole) and
// the side; the Cayley images (w = 1, the image of infinity, without a notch; the lower half-plane's cover of the north
// pole); log(H) filled up to the pole. The globe is the left pane at plane 1 on the Sphere surface; its pixels are
// classified with the page's pick of the left pane (__cmwSphereWL). At the end, (h): the plane's 300 dpi figure export
// is exact and equals the screen, a cancelled export returns at once, and the dialog's last option wins.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the images shard (ci/browser_shards.js).
// Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, globeCheck, neutralFrame, handedness, countPicks, fillSrc, FILL_DIFF, ANNULUS } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'globe_fill_kit.js'), 'utf8'));
// the bounds of p3_accept_cmd.js: the fewest picked triangles of a handedness count, the fewest samples a fill check needs, the
// least IoU of the GPU fill with the CPU render and the fewest pixels both fill
const MIN_PICKS = 50, MIN_SAMPLES = 400, MIN_IOU = 0.999, MIN_INTER = 1000;
const base = { pattern: 'solid', alpha: 1, lines: false, unit: false };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
// the neutral reference's region: with s1 hidden, Inside regions colours only this small disc (a few pixels of its image) and
// leaves the rest of the globe neutral, the frame the fill is measured against (globe_fill_kit.js). It sits where its image
// is outside the truth the scene checks (its colour is in both frames, so it reads as no fill there): LOWER (z = 3 - 3i)
// for the scenes whose truth is in the upper half-plane or an image of it, UPPER for the lower half-plane's, INSIDE (z = 0.3 + 0.2i)
// for the exterior of the disc of radius 0.6
const REF = (c) => ({ id: 's2', kind: 'disc', c, r: 0.05 });
const LOWER = [3, -3], UPPER = [3, 3], INSIDE = [0.3, 0.2];
// the radius of the disc whose exterior the X Sphere scenes at plane 0 cover
const EXT_R = 0.6;
// the fewest pole-side samples (far from the origin of the plane) a scene must show for its north-pole check to count
const MIN_FAR = 50;
// the margin around the boundary strokes (the line renderer's, drawn on both frames) a fill sample keeps clear of, in CSS px, and the
// CPU render's alpha above which a pixel counts as covered
const STROKE_MARGIN_PX = 4, COVERED_ALPHA = 0.5;
// the |w| beyond which a point is pole-side, in the Cayley scene and at plane 0
const CAY_POLE_R = 50, X0_POLE_R = 20;
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
// the page's own idle: the glide finished, the globe's links built and its jobs done
const wait = () => settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSteps().moving && GLR.pendingLinks === 0 && !__cmwSphere().running && !__cmwSphere().jobs.length' });
// a scene at plane 1 on the Sphere surface, the camera set, the picture settled
const globe = async (ns, shapes, steps, srcView, cam, at = 1) => {
  await load(ns + Date.now(), Object.assign({ shapes, steps, srcView }, base));
  // (the regions' outlines left out: they are drawn in the region's colour on both frames, over the rim)
  await ev(`__cmwHideStrokes(true); __cmwSteps({ go: ${at}, now: true, surf: "sphere", scope: "in", T: 0 }); 1`);
  await wait();
  await ev(`__cmwCam("L", ${JSON.stringify(cam)}); 1`);
  await wait();
};
// what the pane drew its regions with: the steps globe's carry path ('inverse', the exact pass, or 'mesh', the forward
// meshes: __cmwSvGlobe), the shapes' paths (a shape the exact pass cannot take reads 'forward'), and the pane's own GPU status.
// (__cmwPaths' status field reads 'pending' for good on the steps globe, which draws with programs of its own, so it is not asked)
const paths = async () => ({ carry: await ev('(() => { const g = __cmwSvGlobe(0.5, 0.5); return { carried: g.carried, path: g.path }; })()'), paths: await ev('__cmwPaths()'), status: await ev('__cmwPaneStatus("L")') });
const check = (side, cls, step) => globeCheck(side, cls, step, 'scope');

// ---- z^i(H): the camera under the south pole, zoomed in on the hole cap (|w| < e^-pi is a cap of 5 degrees; closer, the
// strokes, drawn on a shell 0.4 % above the globe, stand several px off their rims at the view's edges: parallax), then the side
await view(1440, 900, false);
await globe('p3accs', [H, REF(LOWER)], [ZI], { cx: 0, cy: 1, s: 60 }, { pitch: -1.45, yaw: -0.6, dist: 2.2 });
R.pathsZi = await paths();
ok('(f) z^i(H) on the w-globe draws inverse (the globe carries its regions by the exact pass; no shape is forward; nothing pending, compiling or failed)', R.pathsZi.carry.carried && R.pathsZi.carry.path === 'inverse' && R.pathsZi.paths.some((p) => p.role === 'L' && p.viewKind === 'globe') && !R.pathsZi.paths.some((p) => p.path === 'forward') && !!R.pathsZi.status && !R.pathsZi.status.pending && !R.pathsZi.status.compiling && !R.pathsZi.status.error, R.pathsZi);
R.f_hole = await check('L', ANNULUS);
ok(`(f) hole cap: globe-coloured, >= ${MIN_SAMPLES} samples`, R.f_hole.outN >= MIN_SAMPLES && R.f_hole.outBad === 0, R.f_hole);
ok(`(f) annulus near the hole: fill, >= ${MIN_SAMPLES} samples`, R.f_hole.inN >= MIN_SAMPLES && R.f_hole.inBad === 0, R.f_hole);
await shot('p3s_f_hole');
await ev('__cmwCam("L", { pitch: -0.35, yaw: -0.9, dist: 8 }); 1'); await wait();
R.f_side = await check('L', ANNULUS);
ok('(f) annulus from the side: fill / outside clean', R.f_side.inN >= MIN_SAMPLES && R.f_side.inBad === 0 && R.f_side.outBad === 0, R.f_side);
await shot('p3s_f_side');
// the signal tells the paths apart: with every shape forced forward the globe's regions are the meshes, and the shapes read forward
// (one forced and one not is the mixed case below)
await ev('__cmwForceForward(["s1", "s2"]); 1'); await wait();
R.forced = await paths();
ok('(f) control: forced forward, the globe carries by the meshes and the shapes read forward', R.forced.carry.path === 'mesh' && R.forced.paths.some((p) => p.role === 'L' && p.path === 'forward'), R.forced);
await ev('__cmwForceForward([]); 1'); await wait();

// ---- the Cayley images: (z - i)/(z + i) of H is |w| < 1 (w = 1 the image of infinity: no notch); of the lower
// half-plane it is |w| > 1, which covers the north pole (the image of z = -i)
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
const DISC_IN = `(w) => (Math.hypot(w[0], w[1]) < 1 ? 1 : -1)`;
const DISC_OUT = `(w) => (Math.hypot(w[0], w[1]) > 1 ? 1 : -1)`;
// looking at w = 1 (the image of infinity) from outside the equator: (1, 0, 0) under the conjugate lift
await globe('p3accsc', [H, REF(LOWER)], [CAY], { cx: 0, cy: 1, s: 60 }, { pitch: 0.05, yaw: 0, dist: 3 });
R.cay_w1 = await check('L', DISC_IN);
ok('(f) Cayley(H) at w = 1: no notch (fill inside |w| < 1 up to 3 px of the rim)', R.cay_w1.inN >= MIN_SAMPLES && R.cay_w1.inBad === 0 && R.cay_w1.outBad === 0, R.cay_w1);
await shot('p3s_f_cayley_w1');
await globe('p3accsd', [{ id: 's1', kind: 'halfplane', a: [1, 0], b: [0, 0] }, REF(UPPER)], [CAY], { cx: 0, cy: -1, s: 60 }, { pitch: 1.45, yaw: -0.6, dist: 3 });
R.cay_N = await check('L', DISC_OUT);
// (the pole pixel itself has no w: the pick returns null at infinity; its neighbours have |w| in the thousands)
R.cay_N_far = await countPicks('L', `(w) => Math.hypot(w[0], w[1]) > ${CAY_POLE_R}`);
ok('(f) Cayley of the lower half-plane covers the north pole', R.cay_N.inN >= MIN_SAMPLES && R.cay_N.inBad === 0 && R.cay_N.outBad === 0 && R.cay_N_far > MIN_FAR, [R.cay_N, R.cay_N_far]);
await shot('p3s_f_cayley_N');

// ---- log(H) on the w-globe reaches the pole: the strip 0 < Im w < pi, filled up to the pole
await globe('p3accsl', [H, REF(LOWER)], [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], { cx: 0, cy: 1, s: 60 }, { pitch: 1.2, yaw: -1.57, dist: 3 });
// (the cusp at the pole, where the strip is under a pixel wide and its pixels are partly covered, is left to logH_far)
const STRIP = `(w) => (Math.hypot(w[0], w[1]) > 50 ? 0 : w[1] > 0 && w[1] < Math.PI ? 1 : -1)`;
R.logH = await check('L', STRIP, 1);
// the fill pixel nearest the pole: its |w|, and the strip's width there in pixels (pi / footprint): the fill reaches
// the pole when it ends where the strip is about a pixel wide (a lifted mesh that stopped where the strip is still wide would fail)
R.logH_far = await ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), D1 = window.__p3D1, D0 = window.__p3D0, Db = window.__p3Db, GW = cv.width, dpr = cv.width / r.width;
  const fillAt = ${fillSrc('scope')};
  let best = null;
  for (let y = 2; y < r.height - 2; y++) for (let x = 2; x < r.width - 2; x++) {
    const w = __cmwSphereWL(x + 0.5, y + 0.5); if (!w || !(w[1] > 0 && w[1] < Math.PI)) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * GW + Math.floor((x + 0.5) * dpr));
    if (fillAt(i, 1) !== 1) continue;
    const a = Math.hypot(w[0], w[1]);
    if (!best || a > best.a) { const w1 = __cmwSphereWL(x + 1.5, y + 0.5), w2 = __cmwSphereWL(x + 0.5, y + 1.5); const fp = Math.max(Math.hypot(w1[0] - w[0], w1[1] - w[1]), Math.hypot(w2[0] - w[0], w2[1] - w[1])); best = { a: +a.toFixed(2), widthPx: +(Math.PI / fp).toFixed(2), x, y }; }
  }
  return best;
})()`, 60000);
ok('(f) log(H) reaches the pole: the fill ends where the strip is under 2.5 px wide', !!R.logH_far && R.logH_far.widthPx < 2.5, R.logH_far);
ok('(f) log(H) on the w-globe: the strip filled, nothing outside', R.logH.inN >= MIN_SAMPLES && R.logH.inBad === 0 && R.logH.outBad === 0, R.logH);
await shot('p3s_f_logH');

// ---- plane 0 on the Sphere surface: an unbounded region covers infinity without a hole (the exterior of a disc, and H)
const EXT = `(w) => (Math.hypot(w[0], w[1]) > ${EXT_R} ? 1 : -1)`;
await globe('p3accx', [{ id: 's1', kind: 'disc', c: [0, 0], r: EXT_R, complement: true }, REF(INSIDE)], [ZI], { cx: 0, cy: 0, s: 60 }, { pitch: 1.3, yaw: -1.0, dist: 3 }, 0);
R.pathsX0 = await paths();
// (plane 0 has no carried colour: the globe is the colour plane, its regions drawn by the plain inverse program, whose
// status __cmwPaths does read)
ok('X Sphere at stage 0 draws inverse', R.pathsX0.paths.some((p) => p.role === 'L' && p.viewKind === 'globe' && p.path === 'inverse') && !R.pathsX0.paths.some((p) => p.path !== 'inverse') && !!R.pathsX0.status && !R.pathsX0.status.pending && !R.pathsX0.status.compiling && !R.pathsX0.status.error, R.pathsX0);
R.x0 = await check('L', EXT);
ok(`X Sphere at stage 0: |z| > ${EXT_R} covers the north pole, no hole`, R.x0.inN >= MIN_SAMPLES && R.x0.inBad === 0 && R.x0.outBad === 0, R.x0);
await shot('p3s_x0_ext');
// and the upper half-plane, seen around the north pole (its rim, the real axis, runs through infinity)
await globe('p3accxh', [H, REF(LOWER)], [ZI], { cx: 0, cy: 1, s: 60 }, { pitch: 1.3, yaw: -1.0, dist: 3 }, 0);
R.x0H = await check('L', `(w) => (w[1] > 0 ? 1 : -1)`);
R.x0H_far = await countPicks('L', `(w) => w[1] > 0 && Math.hypot(w[0], w[1]) > ${X0_POLE_R}`);
ok('X Sphere at stage 0: Im z > 0 exact around the north pole', R.x0H.inN >= MIN_SAMPLES && R.x0H.inBad === 0 && R.x0H.outN >= MIN_SAMPLES && R.x0H.outBad === 0 && R.x0H_far > MIN_FAR, [R.x0H, R.x0H_far]);
await shot('p3s_x0_H');


// ---- the globe orientation (panels.md 9.0): a screen triangle on the w-globe maps to a w triangle of the same handedness
// (the plain lift would make every globe a mirror image)
for (const at of [0, 1]) {
  await globe('p3so' + at, [{ id: 's1', kind: 'disc', c: [0.5, 0], r: 0.45 }], [ZI], { cx: 0.5, cy: 0, s: 300 }, { pitch: 0.4, yaw: 0.3, dist: 3 }, at);
  // (the picks are the steps globe's: a pane that is not a globe would pick plane points, whose handedness is the same)
  R['onGlobe' + at] = await ev('__cmwPaths().some((p) => p.role === "L" && p.viewKind === "globe")');
  ok(`globe orientation at plane ${at}: the pane picked is the globe`, R['onGlobe' + at] === true, R['onGlobe' + at]);
  R['hand' + at] = await handedness('L');
  ok(`globe orientation at plane ${at}: every picked triangle keeps its handedness`, R['hand' + at][0] > MIN_PICKS && R['hand' + at][1] === 0, R['hand' + at]);
}

// ---- (n) the globe at plane 1 of [z^i, z^2]: the exact annulus on the z-globe of w1 (a step beyond the shown plane changes nothing)
const POW2 = { type: 'pown', params: { n: 2 }, on: true };
await globe('p3sn', [H, REF(LOWER)], [ZI, POW2], { cx: 0, cy: 1, s: 60 }, { pitch: -1.45, yaw: -0.6, dist: 2.2 });
R.pathsN = await paths();
ok('(n) globe at plane 1 of [z^i, z^2] draws inverse', R.pathsN.carry.carried && R.pathsN.carry.path === 'inverse' && !R.pathsN.paths.some((p) => p.path === 'forward'), R.pathsN);
R.n_hole = await check('L', ANNULUS);
ok('(n) globe: hole cap empty, annulus filled', R.n_hole.outN >= MIN_SAMPLES && R.n_hole.outBad === 0 && R.n_hole.inN >= MIN_SAMPLES && R.n_hole.inBad === 0, R.n_hole);
await shot('p3s_n_hole');

// ---- (g) the plane at plane 1 of [z^i, z^2] is exact: its fill equals the CPU render of z^i(H) (IoU >= 0.999)
await load('p3sg' + Date.now(), Object.assign({ shapes: [H, REF(LOWER)], steps: [ZI, POW2], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwHideStrokes(true); __cmwSteps({ go: 1, now: true, surf: "plane", scope: "in", T: 0 }); 1'); await wait();
R.pathsG = await ev('__cmwPaths()');
ok('(g) plane at plane 1 draws inverse', R.pathsG.some((p) => p.role === 'L' && p.viewKind === 'flat' && p.path === 'inverse'), R.pathsG);
// the fill is read against the neutral frame, as the globe's is (D1: as drawn, Db: the shape hidden)
await grab('L');
await ev('window.__p3D1 = window.__p3grab.L; 1');
await neutralFrame('L', 's1');
R.g = await ev(`(() => {
  const lk = __cmwLook('s1', 'L');
  const St = (type, params) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const steps = [St('powa', { alpha: 'i', cut: 180, k: 0 }), St('pown', { n: 2 })], built = steps.map(Funcs.build);
  const plan = Inverse.planChain(steps, built, 0, 1);
  const s = lk.view.s * lk.dpr, W = lk.W, Hh = lk.H;
  const view = { cx: lk.view.cx, cy: lk.view.cy, s, W, H: Hh, win: lk.win };
  const t0 = performance.now();
  const r = Inverse.renderCPU(plan, { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }, view, { alpha: 1, pattern: 'solid', color: lk.color, color2: lk.color2, ink: lk.edge });
  const D = window.__p3D1, Db = window.__p3Db;
  let inter = 0, uni = 0, n = 0, gOnly = 0, cOnly = 0;
  const e = Math.exp(-Math.PI);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const wr = view.cx + (i + 0.5 - W / 2) / s, wi = view.cy - (j + 0.5 - Hh / 2) / s, a = Math.hypot(wr, wi);
    if (Math.min(Math.abs(a - 1), Math.abs(a - e)) * s < ${STROKE_MARGIN_PX} * lk.dpr) continue;   // the boundary strokes (line renderer)
    const k = j * W + i, gp = Math.abs(D[4 * k] - Db[4 * k]) + Math.abs(D[4 * k + 1] - Db[4 * k + 1]) + Math.abs(D[4 * k + 2] - Db[4 * k + 2]) > ${FILL_DIFF}, cp = r.stats.alpha[k] > ${COVERED_ALPHA};
    n++; if (gp && cp) inter++; if (gp || cp) uni++; if (gp && !cp) gOnly++; if (cp && !gp) cOnly++;
  }
  return { iou: uni ? inter / uni : 1, n, inter, gOnly, cOnly, cpuMs: Math.round(performance.now() - t0), W, H: Hh };
})()`);
ok(`(g) plane at plane 1 = CPU render of z^i(H), IoU >= ${MIN_IOU}`, R.g.iou >= MIN_IOU && R.g.inter > MIN_INTER, R.g);
await shot('p3s_g_plane');

// ---- the globe scissor of bounded shapes: a disc's exact image is not clipped. z^i of |z - (0.3+0.8i)| < 0.3 on the w-globe
// (w is in the image iff -ln|w| lies in (-pi, pi] and z = e^{Arg w} e^{-i ln|w|} is in the disc); at plane 0 the disc itself.
// The pass is scissored to its image's w-box (GLR.inverseGlobeScissors counts the scissored passes and their device px).
// (the bounds of p3_accept_cmd.js: the fewest inside samples, and the scissored pass's share of the pane at most; the redraw
// is a camera nudge of SC_NUDGE in the distance)
const MIN_INSIDE = 200, SC_SHARE = 0.6, SC_NUDGE = 0.01;
const DISC = { id: 's1', kind: 'disc', c: [0.3, 0.8], r: 0.3 };
const DZI = `(w) => { const a = Math.hypot(w[0], w[1]), L = -Math.log(a); if (!(L > -Math.PI && L <= Math.PI)) return -1; const m = Math.exp(Math.atan2(w[1], w[0])), zx = m * Math.cos(-Math.log(a)), zy = m * Math.sin(-Math.log(a)); return Math.hypot(zx - 0.3, zy - 0.8) < 0.3 ? 1 : -1; }`;
const DISC_AT_0 = `(w) => (Math.hypot(w[0] - 0.3, w[1] - 0.8) < 0.3 ? 1 : -1)`;
for (const [at, cam, cls, tag, what] of [[1, { pitch: -0.9, yaw: -1.2, dist: 3.2 }, DZI, 'sc_w', 'w-globe'], [0, { pitch: -0.5, yaw: -1.7, dist: 3.2 }, DISC_AT_0, 'sc_z', 'z-globe at plane 0']]) {
  await globe('p3sc' + at, [DISC, REF(LOWER)], [ZI], { cx: 0.3, cy: 0.8, s: 200 }, cam, at);
  R[tag] = await check('L', cls);
  // the scissor of a pass at this camera: a real one, smaller than the pane (a nudged camera redraws the pane)
  const g0 = await ev('GLR.inverseGlobeScissors'); await ev(`__cmwCam("L", ${JSON.stringify(Object.assign({}, cam, { dist: cam.dist + SC_NUDGE }))}); 1`); await wait();
  const g1 = await ev('GLR.inverseGlobeScissors');
  R[tag + '_sc'] = { passes: g1.n - g0.n, avgPx: g1.n > g0.n ? Math.round((g1.px - g0.px) / (g1.n - g0.n)) : 0, panePx: await ev(`(() => { const cv = document.getElementById('canvasL'); return cv.width * cv.height; })()`) };
  ok(`globe scissor (${what}) in use, smaller than the pane`, R[tag + '_sc'].passes > 0 && R[tag + '_sc'].avgPx < SC_SHARE * R[tag + '_sc'].panePx, R[tag + '_sc']);
  ok(`globe scissor (${what}): the disc's exact image is whole`, R[tag].inN >= MIN_INSIDE && R[tag].inBad === 0 && R[tag].outBad === 0, R[tag]);
  await shot('p3s_' + tag);
}

// ---- mixed carry paths on the globe: one shape forced forward, the other kept on the exact pass. With [H, a disc] through
// z^i at plane 1 (checker pattern), forcing the disc forward leaves H on the exact pass; the globe's regions are the exact
// pass's and the disc's mesh together, and the frame matches the all-exact frame to within FRAME_DIFF of the pane's pixels
// (the bound of p3_accept_cmd.js's mixed-paths case)
const FILL_ALPHA = 0.85, FRAME_DIFF = 0.005;
// the share of pixels in the pane's last grab that differ from the grab kept in window[ref] (the pixel-diff of the frame comparisons)
const frameDiff = (ref) => `(() => { const A = window.${ref}, B = window.__p3grab.L; let d = 0, n = 0; for (let k = 0; k < A.length; k += 4) { n++; if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > ${FILL_DIFF}) d++; } return { d, n, share: d / n }; })()`;
const MIXED_DISC = { id: 's2', kind: 'disc', c: [0.5, 1.5], r: 0.4 };
await globe('p3accm', [H, MIXED_DISC], [ZI], { cx: 0, cy: 1, s: 60 }, { pitch: -0.35, yaw: -0.9, dist: 8 });
await ev(`__cmwSet("pattern", "checker"); __cmwSet("alpha", ${FILL_ALPHA}); 1`); await wait();
R.mixedExact = await paths();
await grab('L'); await ev('window.__p3Mx = window.__p3grab.L; 1');
await ev('__cmwForceForward(["s2"]); 1'); await wait();
R.mixed = await paths();
await grab('L');
R.mixedDiff = await ev(frameDiff('__p3Mx'));
const pathOfShape = (r, id) => (r.paths.find((p) => p.role === 'L' && p.viewKind === 'globe' && p.id === id) || {}).path;
ok('mixed paths: the exact frame draws both shapes inverse', R.mixedExact.carry.path === 'inverse', R.mixedExact);
// (a shape's status reads 'pending' on the steps globe, so H's path is read off the globe's: mixed, the exact pass and a mesh)
ok('mixed paths: the disc reads forward and the globe carries by both paths (not all mesh)', pathOfShape(R.mixed, 's2') === 'forward' && R.mixed.carry.path === 'mixed', R.mixed);
ok(`mixed paths: the frame is within ${100 * FRAME_DIFF} % of the all-exact frame`, R.mixedDiff.share <= FRAME_DIFF, R.mixedDiff);
await shot('p3s_mixed');
await ev('__cmwForceForward([]); 1'); await wait();

// ---- the all-mesh frame against the all-exact one (both shapes forced forward): the carried globe is drawn on the unit
// sphere, so the line work (silhouette, graticule, region rims) lands on the same pixels as the exact pass's
// the negative control: the all-exact frame against itself after a camera yaw of CONTROL_YAW moves every line of the frame
// by about a pixel, so the same measure reads more than FRAME_DIFF (the bound is tight enough to see a line off its pixels)
const CONTROL_YAW = 0.004;
await globe('p3accr', [H, MIXED_DISC], [ZI], { cx: 0, cy: 1, s: 60 }, { pitch: -0.35, yaw: -0.9, dist: 8 });
await ev(`__cmwSet("pattern", "checker"); __cmwSet("alpha", ${FILL_ALPHA}); 1`); await wait();
await grab('L'); await ev('window.__p3Ex = window.__p3grab.L; 1');
await ev('__cmwForceForward(["s1", "s2"]); 1'); await wait();
await grab('L');
R.meshDiff = await ev(frameDiff('__p3Ex'));
ok(`all-mesh frame: within ${100 * FRAME_DIFF} % of the all-exact frame`, R.meshDiff.share <= FRAME_DIFF, R.meshDiff);
await shot('p3s_allmesh');
await ev('__cmwForceForward([]); 1'); await wait();
await ev(`__cmwCam("L", ${JSON.stringify({ pitch: -0.35, yaw: -0.9 + CONTROL_YAW, dist: 8 })}); 1`); await wait();
await grab('L');
R.controlDiff = await ev(frameDiff('__p3Ex'));
ok(`all-mesh frame: the measure sees a line shift (control: the exact frame yawed by ${CONTROL_YAW}, over ${100 * FRAME_DIFF} %)`, R.controlDiff.share > FRAME_DIFF, R.controlDiff);
await ev('__cmwForceForward([]); 1'); await wait();

// ---- the carried mesh frame's graticule: over the colour at or before the colour plane T, none past it (the exact frame's
// rule), held between planes 0 and 1 on a step with no inverse, so that the glide takes the carried mesh
const NON_ANALYTIC = { type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true };
for (const [x, T, lines] of [[0.5, 1, true], [0.95, 0, false], [0.95, 1, true], [0.5, 0, false]]) {
  await load('p3accg' + Date.now(), Object.assign({ shapes: [H], steps: [NON_ANALYTIC], srcView: { cx: 0, cy: 1, s: 60 } }, base));
  await ev(`__cmwHideStrokes(true); __cmwSteps({ go: 0, now: true, surf: "sphere", scope: "in", T: ${T} }); __cmwSteps({ x: ${x} }); 1`);
  // (settled on the held place: the last frame is the glide's, drawn by the carried mesh. A view held between two planes
  // reads as moving for as long as it is held, so the wait is the held frame's (test/cdp_kit/README.md): its programs
  // linked and warm, no glide or play under way, and the carried mesh's frame at u = x)
  await settled({ max: 60000, until: `(() => { const g = __cmwSvGlobe(0.5, 0.5), s = __cmwSteps(); return __cmwSvFixed() && s.ready.ready && !s.anim && !s.play && GLR.pendingLinks === 0 && g.path === 'mesh' && Math.abs(g.u - ${x}) < 1e-9 && GLR.carriedGlobeGraticule !== null; })()` });
  const held = R['held_' + x + '_' + T] = { x: await ev('__cmwSteps().x'), path: await ev('__cmwSvGlobe(0.5, 0.5).path'), lines: await ev('GLR.carriedGlobeGraticule') };
  ok(`held frame (x ${x}, colour plane ${T}): the carried mesh ${lines ? 'draws' : 'leaves out'} the graticule over its colour`, held.x === x && held.path === 'mesh' && held.lines === lines, held);
}

// ---- (h) the figure export of the plane at plane 1 of z^i(H), at 300 dpi: exact (the analytic annulus) and equal to the screen
// scaled. The fill is read against the neutral export and the neutral screen (the shape's eye in the list hidden), as (g) reads it.
// A cancelled export returns at once and never blocks the main thread for more than LONG_TASK_MS
const FIG_DPI = 300, CSS_DPI = 96, MIN_EXPORT_SAMPLES = 100000, MAX_TRUTH_ERR = 1e-4, LONG_TASK_MS = 50;
// the cancel comes CANCEL_MS after the export starts, and the export must have returned within CANCEL_SLACK_MS after it
const CANCEL_MS = 40, CANCEL_SLACK_MS = 80;
await load('p3sh' + Date.now(), Object.assign({ shapes: [H, REF(LOWER)], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, base));
await ev('__cmwHideStrokes(true); __cmwSteps({ go: 1, now: true, surf: "plane", scope: "in", T: 0 }); 1'); await wait();
// the export at FIG_DPI of the pane's plane (its plot box, the rulers left out) into the page's window[key] -> its [width, height] in px
const exportInto = (key) => ev(`await (async () => {
  const lk = __cmwLook('s1', 'L');
  const img = new Image(); img.src = __cmwRenderOff('L', lk.W, lk.H, ${FIG_DPI} / ${CSS_DPI}); await img.decode();
  const g = document.createElement('canvas'); g.width = img.width; g.height = img.height; const x = g.getContext('2d'); x.drawImage(img, 0, 0);
  window.${key} = x.getImageData(0, 0, g.width, g.height).data;
  return [g.width, g.height];
})()`, 60000);
// the screen and the export as drawn (D1, E1) and with s1 hidden (Db, Eb)
await grab('L'); await ev('window.__p3D1 = window.__p3grab.L; 1');
R.hSize = await exportInto('__p3E1');
const eyeS1 = JSON.stringify('#shapeList .shape[data-id="s1"] .eye');
await ev(`document.querySelector(${eyeS1}).click(); 1`); await wait();
await grab('L'); await ev('window.__p3Db = window.__p3grab.L; 1');
await exportInto('__p3Eb');
await ev(`document.querySelector(${eyeS1}).click(); 1`); await wait();
R.h = await ev(`(() => {
  const lk = __cmwLook('s1', 'L'), cv = document.getElementById('canvasL');
  const [EW, EH] = ${JSON.stringify(R.hSize)}, E1 = window.__p3E1, Eb = window.__p3Eb, D1 = window.__p3D1, Db = window.__p3Db, SW = cv.width, SH = cv.height;
  const fill = (A, B, k) => Math.abs(A[4 * k] - B[4 * k]) + Math.abs(A[4 * k + 1] - B[4 * k + 1]) + Math.abs(A[4 * k + 2] - B[4 * k + 2]) > ${FILL_DIFF};
  const e = Math.exp(-Math.PI), v = lk.view, rim = (a) => Math.min(Math.abs(a - 1), Math.abs(a - e)) * v.s < ${STROKE_MARGIN_PX};
  // the export against the truth (outside STROKE_MARGIN_PX screen px of the rims, where the strokes are), at the export's px per unit
  const se = v.s * EW / lk.W;
  let n = 0, bad = 0, inter = 0, uni = 0;
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const a = Math.hypot(v.cx + (i + 0.5 - EW / 2) / se, v.cy - (j + 0.5 - EH / 2) / se);
    if (rim(a)) continue;
    n++; if ((a > e && a < 1) !== fill(E1, Eb, j * EW + i)) bad++;
  }
  // the screen against the export sampled at screen pixel centres
  const ss = v.s * lk.dpr;
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    if (rim(Math.hypot(v.cx + (i + 0.5 - SW / 2) / ss, v.cy - (j + 0.5 - SH / 2) / ss))) continue;
    const ei = Math.min(EW - 1, Math.floor((i + 0.5) / SW * EW)), ej = Math.min(EH - 1, Math.floor((j + 0.5) / SH * EH));
    const fs = fill(D1, Db, j * SW + i), fe = fill(E1, Eb, ej * EW + ei);
    if (fs && fe) inter++; if (fs || fe) uni++;
  }
  return { EW, EH, dpi: +(EW / lk.W * ${CSS_DPI}).toFixed(2), SW, SH, W: lk.W, H: lk.H, n, bad, truthErr: bad / Math.max(1, n), inter, iou: uni ? inter / uni : 1 };
})()`, 60000);
ok(`(h) the export is ${FIG_DPI} dpi`, Math.abs(R.h.dpi - FIG_DPI) < 0.5, R.h);
ok('(h) the export is exact (fill = annulus away from the strokes)', R.h.n > MIN_EXPORT_SAMPLES && R.h.truthErr <= MAX_TRUTH_ERR, R.h);
ok(`(h) the export equals the screen scaled, IoU >= ${MIN_IOU}`, R.h.iou >= MIN_IOU && R.h.inter > MIN_INTER, R.h);
// cancellation: a new chain (its inverse program compiles: the export waits for it), the steps view's figure cancelled after CANCEL_MS
await load('p3shc' + Date.now(), Object.assign({ shapes: [H, { id: 's2', kind: 'disc', c: [0.4, 0.8], r: 0.3 }], steps: [ZI, { type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 1, s: 60 } }, base));
// (MathJax started: its own start, after the first paint, is not the export's main-thread time, #288)
await settled({ max: 20000, until: '!!(window.MathJax && MathJax.startup && MathJax.startup.document) && __cmwFig.XD.ready()' });
await ev('__cmwSteps({ go: 1, now: true }); 1');
R.hc = await ev(`await (async () => {
  const long = [];
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch (e) {}
  let live = true; const t0 = performance.now();
  setTimeout(() => { live = false; }, ${CANCEL_MS});
  const res = await __cmwFig.build({ svPic: 'plane', alive: () => live });
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 60));
  po.disconnect();
  // the full export afterwards (not cancelled): its time
  const t2 = performance.now(); const f = await __cmwFig.build({ svPic: 'plane' }); const t3 = performance.now();
  return { cancelled: res === null, returnedMs: Math.round(t1 - t0), longTasks: long, fullMs: Math.round(t3 - t2), fullOk: !!(f && f.svg && f.svg.length > 1000), view: f && f.view };
})()`, 120000);
ok('(h) a cancelled export returns null soon after the cancel', R.hc.cancelled && R.hc.returnedMs < CANCEL_MS + CANCEL_SLACK_MS, R.hc);
ok(`(h) no main-thread task over ${LONG_TASK_MS} ms while preparing and cancelling`, (R.hc.longTasks || [null]).every((d) => d !== null && d <= LONG_TASK_MS), R.hc);
ok('(h) the export of the shown plane completes when not cancelled', R.hc.fullOk, R.hc);

// the dialog: options toggled while a figure is being made (each change cancels the one in progress): the last one wins, and no
// main-thread task over LONG_TASK_MS meanwhile (after the first preview, whose caption typesetting is MathJax's). Its width switch is
// Columns, 1 / 2, in the Article preset. A figure takes up to DLG_WAIT_MS to build with software rendering
const DLG_WAIT_MS = 60000;
const dlgReady = () => settled({ max: DLG_WAIT_MS, until: '(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()' });
await key('e', 4);
R.dlgFirst = (await dlgReady()).ok;
await clickSel('#xfFor button[data-v="article"]'); await dlgReady();
await clickSel('#xfCols button[data-v="2"]'); R.dlgFirst = R.dlgFirst && (await dlgReady()).ok;
R.dlg = await ev(`await (async () => {
  const long = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
  try { po.observe({ type: 'longtask' }); } catch (e) {}
  const btn = (v) => document.querySelector('#xfCols button[data-v="' + v + '"]');
  for (const v of ['1', '2', '1', '2', '1']) { btn(v).click(); await new Promise((r) => setTimeout(r, 15)); }
  for (const t0 = performance.now(); performance.now() - t0 < ${DLG_WAIT_MS};) { const d = __cmwFig.dialog(); if (d && d.fig && !d.building) break; await new Promise((r) => setTimeout(r, 50)); }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  po.disconnect();
  const d = __cmwFig.dialog(), on = document.querySelector('#xfCols [aria-checked="true"]');
  return { long, cols: d && d.fig ? d.fig.cols : null, checked: on ? on.dataset.v : null, last: !!(d && d.fig && String(d.fig.cols) === '1' && on && on.dataset.v === '1'), building: !!(d && d.building) };
})()`, DLG_WAIT_MS + 30000);
await key('Escape');
ok('(h) the dialog: the last option wins', R.dlgFirst && R.dlg.last, R.dlg);
ok(`(h) the dialog: no main-thread task over ${LONG_TASK_MS} ms while options change`, (R.dlg.long || [null]).every((d) => d !== null && d <= LONG_TASK_MS), R.dlg);

return { pass: fails.length === 0, fails, results: R };

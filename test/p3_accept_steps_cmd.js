// P3 acceptance (f) in the steps view (notes/sphere-design/SPEC.md 12.4 (f)): the globe of the plane after the map, at rest
// on that plane, is exact. z^i(H): the hole cap empty, the annulus filled, rims exact, seen from below (the hole) and the
// side; the Cayley images (w = 1, the image of infinity, without a notch; the lower half-plane's cover of the north
// pole); log(H) filled up to the pole. The globe is the left pane at plane 1 on the Sphere surface; its pixels are
// classified with the page's pick of the left pane (__cmwSphereWL).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the render shard (ci/browser_shards.js).
// Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { globeCheck, fillSrc, ANNULUS } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'globe_fill_kit.js'), 'utf8'));
const base = { pattern: 'solid', alpha: 1, lines: false, unit: false };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
// the page's own idle: the glide finished, the globe's links built and its jobs done
const wait = () => settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSteps().moving && GLR.pendingLinks === 0 && !__cmwSphere().running && !__cmwSphere().jobs.length' });
// a scene at plane 1 on the Sphere surface, the camera set, the picture settled
const globe = async (ns, shapes, steps, srcView, cam) => {
  await load(ns + Date.now(), Object.assign({ shapes, steps, srcView }, base));
  // (the regions' outlines left out: they are drawn in the region's colour on both frames, over the rim)
  await ev('__cmwHideStrokes(true); __cmwSteps({ go: 1, now: true, surf: "sphere", scope: "in", T: 0 }); 1');
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
await globe('p3accs', [H], [ZI], { cx: 0, cy: 1, s: 60 }, { pitch: -1.45, yaw: -0.6, dist: 2.2 });
R.pathsZi = await paths();
ok('(f) z^i(H) on the w-globe draws inverse (the globe carries its regions by the exact pass; no shape is forward; nothing pending, compiling or failed)', R.pathsZi.carry.carried && R.pathsZi.carry.path === 'inverse' && R.pathsZi.paths.some((p) => p.role === 'L' && p.viewKind === 'globe') && !R.pathsZi.paths.some((p) => p.path === 'forward') && !!R.pathsZi.status && !R.pathsZi.status.pending && !R.pathsZi.status.compiling && !R.pathsZi.status.error, R.pathsZi);
R.f_hole = await check('L', ANNULUS);
ok('(f) hole cap: globe-coloured, >= 400 samples', R.f_hole.outN >= 400 && R.f_hole.outBad === 0, R.f_hole);
ok('(f) annulus near the hole: fill, >= 400 samples', R.f_hole.inN >= 400 && R.f_hole.inBad === 0, R.f_hole);
await shot('p3s_f_hole');
await ev('__cmwCam("L", { pitch: -0.35, yaw: -0.9, dist: 8 }); 1'); await wait();
R.f_side = await check('L', ANNULUS);
ok('(f) annulus from the side: fill / outside clean', R.f_side.inN >= 400 && R.f_side.inBad === 0 && R.f_side.outBad === 0, R.f_side);
await shot('p3s_f_side');
// the signal tells the paths apart: with the shape forced forward the globe's regions are the meshes, and the shape reads forward
await ev('__cmwForceForward(["s1"]); 1'); await wait();
R.forced = await paths();
ok('(f) control: forced forward, the globe carries by the meshes and the shape reads forward', R.forced.carry.path === 'mesh' && R.forced.paths.some((p) => p.path === 'forward'), R.forced);
await ev('__cmwForceForward([]); 1'); await wait();

// ---- the Cayley images: (z - i)/(z + i) of H is |w| < 1 (w = 1 the image of infinity: no notch); of the lower
// half-plane it is |w| > 1, which covers the north pole (the image of z = -i)
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
const DISC_IN = `(w) => (Math.hypot(w[0], w[1]) < 1 ? 1 : -1)`;
const DISC_OUT = `(w) => (Math.hypot(w[0], w[1]) > 1 ? 1 : -1)`;
// looking at w = 1 (the image of infinity) from outside the equator: (1, 0, 0) under the conjugate lift
await globe('p3accsc', [H], [CAY], { cx: 0, cy: 1, s: 60 }, { pitch: 0.05, yaw: 0, dist: 3 });
R.cay_w1 = await check('L', DISC_IN);
ok('(f) Cayley(H) at w = 1: no notch (fill inside |w| < 1 up to 3 px of the rim)', R.cay_w1.inN >= 400 && R.cay_w1.inBad === 0 && R.cay_w1.outBad === 0, R.cay_w1);
await shot('p3s_f_cayley_w1');
await globe('p3accsd', [{ id: 's1', kind: 'halfplane', a: [1, 0], b: [0, 0] }], [CAY], { cx: 0, cy: -1, s: 60 }, { pitch: 1.45, yaw: -0.6, dist: 3 });
R.cay_N = await check('L', DISC_OUT);
// (the pole pixel itself has no w: the pick returns null at infinity; its neighbours have |w| in the thousands)
R.cay_N_far = await ev(`(() => { let n = 0; const r = document.getElementById('canvasL').getBoundingClientRect(); for (let y = 3; y < r.height - 3; y += 2) for (let x = 3; x < r.width - 3; x += 2) { const w = __cmwSphereWL(x, y); if (w && Math.hypot(w[0], w[1]) > 50) n++; } return n; })()`);
ok('(f) Cayley of the lower half-plane covers the north pole', R.cay_N.inN >= 400 && R.cay_N.inBad === 0 && R.cay_N.outBad === 0 && R.cay_N_far > 50, [R.cay_N, R.cay_N_far]);
await shot('p3s_f_cayley_N');

// ---- log(H) on the w-globe reaches the pole: the strip 0 < Im w < pi, filled up to the pole
await globe('p3accsl', [H], [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], { cx: 0, cy: 1, s: 60 }, { pitch: 1.2, yaw: -1.57, dist: 3 });
// (the cusp at the pole, where the strip is under a pixel wide and its pixels are partly covered, is left to logH_far)
const STRIP = `(w) => (Math.hypot(w[0], w[1]) > 50 ? 0 : w[1] > 0 && w[1] < Math.PI ? 1 : -1)`;
R.logH = await check('L', STRIP, 1);
// the fill pixel nearest the pole: its |w|, and the strip's width there in pixels (pi / footprint): the fill reaches
// the pole when it ends where the strip is about a pixel wide (a lifted mesh that stopped where the strip is still wide would fail)
R.logH_far = await ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), D1 = window.__p3D1, D0 = window.__p3D0, GW = cv.width, dpr = cv.width / r.width;
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
ok('(f) log(H) on the w-globe: the strip filled, nothing outside', R.logH.inN >= 400 && R.logH.inBad === 0 && R.logH.outBad === 0, R.logH);
await shot('p3s_f_logH');

return { pass: fails.length === 0, fails, results: R };

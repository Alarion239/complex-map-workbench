// P5 acceptance in the browser (notes/sphere-design/SPEC.md 8, 12.3, 12.4 (k)): the forward fallback SphereMesh.
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/p5_accept_cmd.js
// Prints {pass, fails, results}.
//  (k) the crack test: exact images off, each scene's fill drawn solid at alpha 1 from its SphereMesh; every interior
//      pixel (the analytic truth, 4 px from the rims) is covered (fill = the frame differs from the same frame at alpha 0)
//  12.3 the trouble classification (__cmwSmVerdict) is the same at 1x, 4x and 1/4x right-view zoom for every quality scene
//  8.8 a left pan that re-centres the meshing window: no frame shows today's GPU image (the old mesh stands in until
//      the new one lands), and the slices of every job stay within 6 ms
//  the forward image of exp(H) against the exact inverse image
//  memory: one mesh per slot at rest (after pattern and alpha changes), the export's meshes freed once the figure is
//      drawn, and after a context loss the pre-mapped GPU bytes equal the bytes of the meshes drawn
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const req = process.getBuiltinModule('module').createRequire(process.cwd() + '/');
const Q = req('./test/regress/quality/scenes.js');
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const solid = { pattern: 'solid', alpha: 1, lines: false, unit: false, exactImages: false };
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// wait until every SphereMesh job has published and the right canvas is still. `want`: the least number of meshes and of
// builds the scene must have reached (a job is asked for by a draw, so on a slow renderer there can be none yet)
const settle = async (ms = 120000, want = {}) => {
  const t0 = Date.now();
  let s = null;
  for (;;) {
    await sleep(300);
    s = JSON.parse(await ev('JSON.stringify(__cmwSphere())'));
    const there = s.entries.length >= (want.entries || 0) && s.stats.built >= (want.built || 0);
    if (!s.running && !s.jobs.length && there && Date.now() - t0 > 1200) break;
    if (Date.now() - t0 > ms) break;
  }
  await sleep(400);
  await ev(rAF2);
  return s;
};
// load() waits a fixed 2.2 s after it navigates; on a busy machine the page has not run its start-up by then and the
// hooks below are not defined yet (#301: "ReferenceError: __cmwSmVerdict is not defined"). So wait for the hooks this suite
// calls, as long as it takes, and fail with the hook that never came rather than a ReferenceError later. Then count what the
// app draws (watchDraws below).
const HOOKS = ['__cmwSphere', '__cmwSmVerdict', '__cmwSmReset', '__cmwSet', '__cmwState', '__cmwW2S', '__cmwHideStrokes', '__cmwBuildFigure', '__cmwDrawn'];
const loadReady = async (ns, st, ms = 120000) => {
  const r = await load(ns, st);
  const t0 = Date.now();
  let missing = HOOKS;
  for (;;) {
    // (an evaluation can land while the page is still being replaced: that is not an answer either)
    try { missing = await ev(`(() => { const m = ${JSON.stringify(HOOKS)}.filter((h) => typeof window[h] !== 'function'); if (typeof GLR !== 'object' || !GLR) m.push('GLR'); return m; })()`); } catch (e) { missing = HOOKS; }
    // (an evaluation that comes back as an exception: the page's main thread is busy or the page is gone)
    if (!Array.isArray(missing)) missing = { page: JSON.stringify(missing).slice(0, 200) };
    if (Array.isArray(missing) && missing.length === 0) break;
    if (Date.now() - t0 > ms) { const where = await ev('({ href: location.href, readyState: document.readyState })').catch((e) => String(e).slice(0, 80)); throw new Error(`the app's test hooks are not defined ${ms / 1000} s after load(${ns}): ${JSON.stringify(missing)}; the page: ${JSON.stringify(where)}`); }
    await sleep(250);
  }
  await watchDraws();
  return r;
};
// The app draws at requestAnimationFrame, and on a slow renderer (SwiftShader, a busy machine) a frame comes seconds after
// the state it shows, so the canvas a moment after settle() can be an older frame: the GPU stand-in drawn before the
// SphereMesh was published, or the frame before an alpha change (#301). This hook counts the app's frames (GLR.begin) and the
// SphereMeshes it draws (GLR.drawPreMapped, with the alpha); meshDrawn() waits for a draw after a change.
const watchDraws = () => ev(`(() => { if (window.__p5w) return 1; const w = window.__p5w = { frames: 0, pm: 0, alpha: null }; const wrap = (k, f) => { const g = GLR[k]; GLR[k] = function (...a) { f(...a); return g.apply(this, a); }; }; wrap('begin', () => { w.frames++; }); wrap('drawPreMapped', (res, st) => { if (res && res.n) { w.pm++; w.alpha = st.alpha; } }); return 1; })()`);
// run `trigger` (a statement that makes the app redraw), then wait until the app has drawn a SphereMesh (at `alpha`, when
// given) in a frame after it, and one more frame has passed: the canvas then shows that state. false when none came
const meshDrawn = async (trigger, alpha, ms = 90000) => {
  const n0 = await ev('window.__p5w.pm');
  await ev(trigger);
  const t0 = Date.now();
  for (;;) {
    const w = await ev('({ pm: window.__p5w.pm, alpha: window.__p5w.alpha })');
    if (w.pm > n0 && (alpha === undefined || w.alpha === alpha)) break;
    if (Date.now() - t0 > ms) return false;
    await sleep(100);
  }
  await ev(rAF2);
  return true;
};
// the exact image: wait until the pane has drawn the shape by the inverse path (`__cmwDrawn`), then a frame more
const exactDrawn = async (ms = 90000) => {
  const t0 = Date.now();
  for (;;) {
    if ((await ev('__cmwDrawn()["R|s1"]')) === 'inverse') break;
    if (Date.now() - t0 > ms) return false;
    await sleep(150);
  }
  await ev(rAF2);
  return true;
};
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasR'); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); window.__p5 = window.__p5 || {}; window.__p5[${JSON.stringify(tag)}] = x.getImageData(0, 0, g.width, g.height).data; return [g.width, g.height]; })()`);
// interior pixels of the truth cls(w) (1 inside, -1 outside) not covered by the fill
const crack = (cls) => ev(`(() => {
  const cv = document.getElementById('canvasR'), r = cv.getBoundingClientRect(), dpr = cv.width / r.width, GW = cv.width;
  // (__cmwW2S answers page coordinates: made relative to the canvas)
  const rel = (p) => [p[0] - r.left, p[1] - r.top];
  const o = rel(__cmwW2S('R', 0, 0)), x1 = rel(__cmwW2S('R', 1, 0)), y1 = rel(__cmwW2S('R', 0, 1)), sx = x1[0] - o[0], sy = o[1] - y1[1];
  const cls = ${cls};
  const ec = getComputedStyle(document.documentElement).getPropertyValue('--c1-edge').trim(), EDGE = [1, 3, 5].map((k) => parseInt(ec.slice(k, k + 2), 16));
  const wOf = (x, y) => [(x - o[0]) / sx, (o[1] - y) / sy];
  const A = window.__p5.a1, B = window.__p5.a0;
  let inN = 0, miss = 0, outN = 0, spill = 0; const ex = [];
  for (let y = 6; y < r.height - 6; y += 2) for (let x = 6; x < r.width - 6; x += 2) {
    const c = cls(wOf(x + 0.5, y + 0.5));
    let near = false;
    for (let k = 0; k < 12 && !near; k++) { const t = k * Math.PI / 6; if (cls(wOf(x + 0.5 + 4 * Math.cos(t), y + 0.5 + 4 * Math.sin(t))) !== c) near = true; }
    if (near) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * GW + Math.floor((x + 0.5) * dpr));
    const fill = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 24;
    // (a pixel under a stroke is the same in both frames: not a crack; the strokes are hidden in these frames, so this
    // only skips pixels some other edge-coloured mark covers)
    if (!fill && Math.abs(B[i] - EDGE[0]) + Math.abs(B[i + 1] - EDGE[1]) + Math.abs(B[i + 2] - EDGE[2]) < 90) continue;
    if (c > 0) { inN++; if (!fill) { miss++; if (ex.length < 4) ex.push([x, y, wOf(x, y).map((v) => +v.toPrecision(4))]); } }
    else if (c < 0) { outN++; if (fill) spill++; }
  }
  return { inN, miss, outN, spill, ex };
})()`);

// ---- (k) the crack test ----
const EPI = Math.exp(-Math.PI);
const CRACK = [
  ['expH', [{ type: 'exp', params: {} }], [H], { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 30 }, '(w) => (Math.hypot(w[0], w[1]) > 0.02 ? 1 : 0)'],
  ['ziH', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], [H], { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 190 }, `(w) => { const a = Math.hypot(w[0], w[1]); return a > ${EPI} && a < 1 ? 1 : -1; }`],
  ['logH', [{ type: 'log', params: { cut: 180, k: 0 } }], [H], { cx: 0, cy: 1, s: 60 }, { cx: -0.18, cy: Math.PI / 2, s: 97 }, '(w) => (w[1] > 0 && w[1] < Math.PI ? 1 : -1)'],
  ['e1z', [{ type: 'recip', params: {} }, { type: 'exp', params: {} }], [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], { cx: 0, cy: 0, s: 120 }, { cx: 0, cy: 0, s: 60 }, '(w) => (Math.hypot(w[0], w[1]) > 0.05 ? 1 : 0)'],
  ['cayleyH', [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }], [H], { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 190 }, '(w) => (Math.hypot(w[0], w[1]) < 1 ? 1 : -1)'],
];
await view(1440, 900, false);
R.crack = {};
for (const [name, steps, shapes, srcView, rightView, cls] of CRACK) {
  await loadReady('p5k' + name + Date.now(), Object.assign({ shapes, steps: steps.map((s) => Object.assign({ on: true }, s)), srcView, rightView }, solid));
  const st = await settle(60000, { entries: 1, built: 1 });
  // (the shape's strokes are left out of both frames: the fill under the image of the boundary inside the image, e.g.
  // exp(H)'s positive real axis or e^{1/z}'s exp of the unit circle, is tested too; the 85 % casing over it hid it)
  // (each frame is grabbed once the app has drawn the mesh in that state, not after a fixed wait: see meshDrawn)
  const drew = [await meshDrawn('__cmwHideStrokes(true); 1', 1)];
  await grab('a1');
  drew.push(await meshDrawn('__cmwSet("alpha", 0); 1', 0));
  await grab('a0');
  drew.push(await meshDrawn('__cmwSet("alpha", 1); 1', 1));
  await ev('__cmwHideStrokes(false)');
  const c = await crack(cls);
  R.crack[name] = Object.assign(c, { meshes: st.entries.map((e) => ({ why: e.why, n: e.n, partial: e.partial, ms: e.ms })), maxSlice: +st.stats.maxSlice.toFixed(1) });
  ok(`(k) ${name}: drawn from a SphereMesh`, st.entries.length > 0, st.entries.length);
  ok(`(k) ${name}: the app drew the mesh in each of the three frames compared`, drew.every(Boolean), drew);
  ok(`(k) ${name}: interior pixels not covered = 0`, c.miss === 0 && c.inN > 1000, c);
  ok(`(k) ${name}: no fill outside the image`, c.spill === 0, c);
  ok(`(k) ${name}: no slice over 6 ms`, st.stats.maxSlice <= 6, st.stats.maxSlice);
}

// ---- 12.3: the classification is view-independent (1x, 4x, 1/4x right-view zoom), every quality scene ----
R.verdict = { n: 0, forward: 0, differ: [], stalled: [] };
const seen = new Set();
for (const run of Q.runs()) {
  if (seen.has(run.scene.name) || !run.scene.rightView) continue;
  seen.add(run.scene.name);
  const v = [];
  for (const k of [1, 4, 0.25]) {
    const st = Object.assign({}, run.state, { exactImages: false, rightView: Object.assign({}, run.scene.rightView, { s: run.scene.rightView.s * k }) });
    await loadReady('p5v' + Date.now(), st);
    // (the verdict reads the pane's GPU resources: it is asked for once the app has drawn a frame after the hooks were there (one
    // is asked for here: the first may have come before) and the LED rests)
    await ev('window.__p5f = window.__p5w.frames; __cmwHideStrokes(false); 1');
    let rested = false;
    for (let i = 0; i < 240 && !rested; i++) { const b = await ev('({ led: document.getElementById("rightLed").className, drew: window.__p5w.frames > window.__p5f, pending: GLR.frameStatus().pending })'); rested = b.drew && !b.pending && !/busy/.test(b.led); if (!rested) await sleep(250); }
    if (!rested) R.verdict.stalled.push(`${run.scene.name} @${k}`);
    v.push(JSON.stringify(await ev('__cmwSmVerdict("R")')));
  }
  R.verdict.n++;
  if (v[0] !== v[1] || v[0] !== v[2]) R.verdict.differ.push({ scene: run.scene.name, v });
  if (/unbounded|trouble/.test(v[0])) R.verdict.forward++;
}
ok('12.3: every load drew a frame and rested before its verdict was read', R.verdict.stalled.length === 0, R.verdict.stalled.slice(0, 4));
ok('12.3: the SphereMesh verdict is the same at 1x, 4x and 1/4x for every quality scene', R.verdict.differ.length === 0, R.verdict.differ.slice(0, 4));

// ---- 8.8: a left pan that re-centres clipWin; the stand-in is the old mesh, never the GPU image ----
await loadReady('p5pan' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 30 } }, solid, { pattern: 'checker', alpha: 0.85 }));
await settle(120000, { entries: 1, built: 1 });
ok('8.8: the app drew the mesh before the rest frame was grabbed', await meshDrawn('__cmwHideStrokes(false); 1'));
await grab('rest0');
const rL = await ev('(() => { const r = document.getElementById("canvasL").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()');
const cxL = rL[0] + rL[2] / 2, cyL = rL[1] + rL[3] / 2;
await ev('__cmwSmReset ? 1 : 0');
const st0 = JSON.parse(await ev('JSON.stringify(__cmwSphere())'));
// a 45% pan of the left view (re-centres the meshing window at rest)
// (a middle-button drag pans the left view)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cxL, y: cyL });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cxL, y: cyL, button: 'middle', buttons: 4, clickCount: 1 });
for (let i = 1; i <= 12; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cxL - 0.45 * rL[2] * i / 12, y: cyL, button: 'middle', buttons: 4 }); await sleep(16); }
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cxL - 0.45 * rL[2], y: cyL, button: 'middle', buttons: 0, clickCount: 1 });
R.panWin = await ev('JSON.stringify(__cmwState().view)');
await sleep(260);
const during = [];
let nDur = 0;
for (let i = 0; i < 40; i++) {
  const s = JSON.parse(await ev('JSON.stringify(__cmwSphere())'));
  during.push({ jobs: s.jobs.length, entries: s.entries.length });
  // (frames while the rebuild runs: the old mesh stands in, compared below with the rest frame and the truth)
  if (s.jobs.length && nDur < 4) { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); await grab('dur' + nDur++); }
  if (!s.running && !s.jobs.length && i > 4) break;
  await sleep(150);
}
const st1 = await settle(120000, { entries: 1, built: 2 });
ok('8.8: the app drew the rebuilt mesh before the rest frame after it was grabbed', await meshDrawn('__cmwHideStrokes(false); 1'));
await grab('rest1');
await ev('__cmwSet("exactImages", true); 1');
const truthOk = await exactDrawn();
await grab('truth1');
await ev('__cmwSet("exactImages", false); 1');
const diff = (a, b) => ev(`(() => { const A = window.__p5[${JSON.stringify(a)}], B = window.__p5[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, n8 = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i+1] - B[i+1]), Math.abs(A[i+2] - B[i+2])); n++; if (d > 8) n8++; if (d > 32) n32++; } return { frac8: +(n8 / n).toFixed(5), frac32: +(n32 / n).toFixed(5) }; })()`);
R.panFrames = { n: nDur, restVsTruth: await diff('rest1', 'truth1'), duringVsRest: [], duringVsTruth: [] };
for (let k = 0; k < nDur; k++) { R.panFrames.duringVsRest.push(await diff('dur' + k, 'rest1')); R.panFrames.duringVsTruth.push(await diff('dur' + k, 'truth1')); }
R.pan = { before: st0.entries.length, during: during.slice(0, 6), after: st1.entries.map((e) => ({ why: e.why, n: e.n, partial: e.partial })), maxSlice: +st1.stats.maxSlice.toFixed(1), built: st1.stats.built };
ok('8.8: a re-centred window rebuilds the mesh', st1.stats.built >= 2, st1.stats);
ok('8.8: the exact image was drawn', truthOk);
ok('8.8: the slices of the rebuild stay within 6 ms', st1.stats.maxSlice <= 6, st1.stats.maxSlice);
ok('8.8: the rest frame after the rebuild matches the exact image (<= 0.5 % of pixels > 8/255)', R.panFrames.restVsTruth && R.panFrames.restVsTruth.frac8 <= 0.005, R.panFrames.restVsTruth);
ok('8.8: frames during the rebuild match the rest frame (<= 0.5 % of pixels > 32/255)', R.panFrames.duringVsRest.every((d) => d && d.frac32 <= 0.005), R.panFrames);
ok('8.8: frames during the rebuild match the exact image (<= 0.5 % of pixels > 32/255)', R.panFrames.duringVsTruth.every((d) => d && d.frac32 <= 0.005), R.panFrames);

// ---- the forward image of exp(H) (checker, alpha 0.85) against the exact inverse image ----
await loadReady('p5cmp' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 30 } }, solid, { pattern: 'checker', alpha: 0.85 }));
await settle(120000, { entries: 1, built: 1 });
ok('exp(H) forward vs inverse: the app drew the mesh before the forward frame was grabbed', await meshDrawn('__cmwHideStrokes(false); 1'));
await grab('fwd');
await ev('__cmwSet("exactImages", true); 1');
const invOk = await exactDrawn();
await grab('inv');
R.fwdVsInv = await ev(`(() => { const A = window.__p5.fwd, B = window.__p5.inv; let n = 0, n8 = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i+1] - B[i+1]), Math.abs(A[i+2] - B[i+2])); n++; if (d > 8) n8++; if (d > 32) n32++; } return { n, frac8: +(n8 / n).toFixed(5), frac32: +(n32 / n).toFixed(5) }; })()`);
ok('exp(H) forward vs inverse: the exact image was drawn', invOk);
ok('exp(H) forward vs inverse: <= 0.5 % of the pixels differ by more than 8/255', R.fwdVsInv.frac8 <= 0.005, R.fwdVsInv);
// (P5 review) the same for infinitely-sheeted chains whose sheets meet inside the view: e^{1/z} of the unit disc
// (checker) and z^i of H (polar): the forward draw's front sheet is chosen per sample by the inverse path's key (SPEC
// 13.22; before, a per-leaf choice showed triangle-jagged shard seams where sheets meet)
R.fwdVsInvSheets = {};
for (const [name, steps, shapes, srcView, rightView, pattern] of [
  ['e1z_checker', [{ type: 'recip', params: {}, on: true }, { type: 'exp', params: {}, on: true }], [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], { cx: 0, cy: 0, s: 120 }, { cx: 0, cy: 0, s: 60 }, 'checker'],
  ['ziH_polar', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true }], [H], { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 190 }, 'polar'],
]) {
  await loadReady('p5cmp' + name + Date.now(), Object.assign({ shapes, steps, srcView, rightView }, solid, { pattern, alpha: 1 }));
  await settle(120000, { entries: 1, built: 1 });
  ok(`${name} forward vs inverse: the app drew the mesh before the forward frame was grabbed`, await meshDrawn('__cmwHideStrokes(false); 1'));
  await grab('fwd');
  await ev('__cmwSet("exactImages", true); 1');
  const exact = await exactDrawn();
  await grab('inv');
  R.fwdVsInvSheets[name] = await ev(`(() => { const A = window.__p5.fwd, B = window.__p5.inv; let n = 0, n8 = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i+1] - B[i+1]), Math.abs(A[i+2] - B[i+2])); n++; if (d > 8) n8++; if (d > 32) n32++; } return { n, frac8: +(n8 / n).toFixed(5), frac32: +(n32 / n).toFixed(5) }; })()`);
  ok(`${name} forward vs inverse: the exact image was drawn`, exact);
  ok(`${name} forward vs inverse: <= 0.5 % of the pixels differ by more than 32/255 (open: shard seams)`, R.fwdVsInvSheets[name].frac32 <= 0.005, R.fwdVsInvSheets[name]);
}
// ---- 10.6: an export of a forward-drawn panel meshes at the export's own resolution, then draws with it ----
// (7 in at 300 dpi: more than 2x the screen's zoom, so the screen mesh is not valid for it; a 3 in figure reuses it)
await ev('__cmwSet("exactImages", false); 1');
const stE0 = await settle();
// (ev does not await a promise: the figure's result is polled)
await ev('window.__p5fig = null; __cmwBuildFigure({ panels: ["R"], widthIn: 7 }).then((f) => { window.__p5fig = { ok: !!f, partial: f ? f.partial : null }; }, (e) => { window.__p5fig = { ok: false, err: String(e) }; }); 1');
let fig = null;
for (let i = 0; i < 400 && !fig; i++) { await sleep(300); fig = await ev('window.__p5fig'); }
const figOk = !!(fig && fig.ok);
const stE1 = JSON.parse(await ev('JSON.stringify(__cmwSphere())'));
const exE = stE1.entries.filter((e) => e.why === 'export');
R.export = { figOk, fig, built: stE1.lastExport, kept: exE.length, preBytes: [stE0.preBytes, stE1.preBytes], cpuBytes: [stE0.cpuBytes, stE1.cpuBytes], maxSlice: +stE1.stats.maxSlice.toFixed(1) };
ok('10.6: the export built a SphereMesh at its own resolution', figOk && stE1.lastExport && stE1.lastExport.length >= 1, R.export);
ok('10.6: the export meshes are freed once the figure is drawn', exE.length === 0 && stE1.preBytes <= stE0.preBytes && stE1.cpuBytes <= stE0.cpuBytes, R.export);
ok('10.6: the export mesh ended on no budget', stE1.lastExport && stE1.lastExport.every((e) => !e.partial), R.export);

// ---- memory: one mesh per slot at rest (pattern and alpha changes), example 9 ----
await loadReady('p5mem' + Date.now(), Object.assign({ shapes: [H], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 30 } }, solid, { pattern: 'checker', alpha: 0.85 }));
await settle(120000, { entries: 1, built: 1 });
// (each change is a new mesh: wait for its build, a job is asked for by a draw that may come late)
let builtNow = 1;
for (const [k, v] of [['pattern', 'polar'], ['alpha', 0.6], ['pattern', 'checker'], ['alpha', 0.9]]) { await ev(`__cmwSet(${JSON.stringify(k)}, ${JSON.stringify(v)}); 1`); builtNow = (await settle(60000, { entries: 1, built: builtNow + 1 })).stats.built; }
const stM = JSON.parse(await ev('JSON.stringify(__cmwSphere())'));
const perSlot = {};
for (const e of stM.entries) perSlot[e.slot] = (perSlot[e.slot] || 0) + 1;
R.memory = { entries: stM.entries.length, perSlot, preBytes: stM.preBytes, cpuBytes: stM.cpuBytes, built: stM.stats.built };
ok('memory: one SphereMesh per slot at rest after 4 content changes', Object.values(perSlot).every((n) => n === 1) && stM.stats.built >= 5, R.memory);
// ---- a context loss: the pre-mapped GPU accounting restarts from the meshes re-uploaded ----
const drawnBytes = () => ev('(() => { const s = __cmwSphere(); return s.entries.filter((e) => e.gpu).length; })()');
await ev('(() => { const x = GLR.gl.getExtension("WEBGL_lose_context"); window.__p5lc = x; x.loseContext(); return 1; })()');
await sleep(500);
await ev('window.__p5lc.restoreContext(); 1');
await sleep(1500);
await settle();
const stC = JSON.parse(await ev('JSON.stringify(__cmwSphere())'));
const nGpu = await drawnBytes();
R.contextLoss = { preBytes: stC.preBytes, before: stM.preBytes, entriesOnGpu: nGpu, entries: stC.entries.length };
ok('context loss: the pre-mapped bytes count only the meshes uploaded after the restore', stC.preBytes <= stM.preBytes + 1 && (nGpu > 0 ? stC.preBytes > 0 : stC.preBytes === 0), R.contextLoss);
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

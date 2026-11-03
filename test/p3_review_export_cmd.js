// P3 review checks of the figure export (notes/sphere-design/SPEC.md 13.16): a two-globe 300 dpi export against the
// truth, and the main thread during a two-globe export at dpr 2. They wait for the steps view's export of the shown
// plane (#620's export items, ci/suite_views.js: port('export')) and run in the classic view until then.
// A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/p3_review_export_cmd.js
// Prints {pass, fails, results}; pass is true when every check holds.
// (the daemon's port, as its load() opens it)
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
const settle = async (ms = 2500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);
// page helpers (window.__rv): a pane's (or an off-screen render's) pixels; the pick grid of a pane at CSS pixel centres
const RV = `window.__rv = {
  grab(side) { const cv = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR'); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); return { D: x.getImageData(0, 0, g.width, g.height).data, W: g.width, H: g.height }; },
  async off(side, d) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const img = new Image(); img.src = __cmwRenderOff(side, r.width, r.height, d); await img.decode(); const g = document.createElement('canvas'); g.width = img.width; g.height = img.height; const x = g.getContext('2d'); x.drawImage(img, 0, 0); return { D: x.getImageData(0, 0, g.width, g.height).data, W: g.width, H: g.height }; },
  picks(side) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const pick = side === 'L' ? __cmwSphereWL : __cmwSphereW; const Wd = Math.floor(r.width), Hd = Math.floor(r.height), P = new Array(Wd * Hd); for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) P[y * Wd + x] = pick(x + 0.5, y + 0.5); return { P, Wd, Hd, cw: r.width, ch: r.height }; },
  // the globe's point labels (0, infinity, 1, i, -1, -i), left out 16 px around each
  labels(side) { const r = document.getElementById(side === 'L' ? 'canvasL' : 'canvasR').getBoundingClientRect(); const pc = GLR.camera(__cmwCam(side), r.width, r.height); const proj = (p) => { const q = GLR.M4.apply(pc.MVP, p); return q[3] > 1e-6 ? [(q[0] / q[3] * 0.5 + 0.5) * r.width, (1 - (q[1] / q[3] * 0.5 + 0.5)) * r.height] : null; }; const labs = [[0, 0, 1.1], [0, 0, -1.1], [1.06, 0, 0.1], [0, -1.06, 0.1], [-1.06, 0, 0.1], [0, 1.06, 0.1]].map(proj).filter(Boolean); return (x, y) => labs.some((q) => Math.hypot(q[0] - x, q[1] - y) < 16); },
  hex: (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
}; 1`;
// (the helpers live in the page: defined again after every load)
const load0 = load;
load = async (...a) => { const r = await load0(...a); await ev(RV); return r; };

// ---- 1. a two-globe export at 300 dpi against the truth: z^i(H) on the w-globe (the annulus) and H on the z-globe at
// stage 0; fill = the panel rendered at alpha 1 minus the same at alpha 0, sampled at the pane's CSS pixel centres
await load('p3rvE' + Date.now(), Object.assign({ shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 } }, { pattern: 'solid', alpha: 1, lines: true, unit: false }));
await ev('__cmwSetView("R", "sphere"); __cmwSetView("L", "sphere"); 1'); await settle(3000);
await ev('__cmwCam("R", { pitch: -0.35, yaw: -0.9 }); __cmwCam("L", { pitch: 0.6, yaw: -1.0 }); 1'); await settle(1200);
const EPI = Math.exp(-Math.PI);
R.exp2 = await ev(`await (async () => {
  const d = 300 / 96, res = {};
  const truth = { R: (w) => { const a = Math.hypot(w[0], w[1]); return a > ${EPI} && a < 1 ? 1 : -1; }, L: (w) => (w[1] > 0 ? 1 : -1) };
  const E1 = { L: await __rv.off('L', d), R: await __rv.off('R', d) };
  __cmwSet('alpha', 0); await new Promise((r) => setTimeout(r, 600));
  const E0 = { L: await __rv.off('L', d), R: await __rv.off('R', d) };
  __cmwSet('alpha', 1); await new Promise((r) => setTimeout(r, 400));
  for (const side of ['L', 'R']) {
    const G = __rv.picks(side), { P, Wd, Hd } = G, onLabel = __rv.labels(side), cls = truth[side];
    const C = new Int8Array(Wd * Hd); for (let k = 0; k < Wd * Hd; k++) C[k] = P[k] ? (Math.hypot(P[k][0], P[k][1]) > 1e4 ? 0 : cls(P[k])) : 3;
    const a = E1[side], b = E0[side], W = a.W;
    const o = { EW: a.W, EH: a.H, dpiOk: Math.abs(a.W / G.cw - d) < 0.01, inN: 0, inBad: 0, outN: 0, outBad: 0 };
    for (let y = 4; y < Hd - 4; y += 2) for (let x = 4; x < Wd - 4; x += 2) {
      const c = C[y * Wd + x]; if (c !== 1 && c !== -1) continue;
      let near = false; for (let dy = -4; dy <= 4 && !near; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 16 && C[(y + dy) * Wd + x + dx] !== c) { near = true; break; }
      if (near || onLabel(x, y)) continue;
      const i = 4 * (Math.floor((y + 0.5) * d) * W + Math.floor((x + 0.5) * d));
      const fill = Math.abs(a.D[i] - b.D[i]) + Math.abs(a.D[i + 1] - b.D[i + 1]) + Math.abs(a.D[i + 2] - b.D[i + 2]) > 24;
      if (c > 0) { o.inN++; if (!fill) o.inBad++; } else { o.outN++; if (fill) o.outBad++; }
    }
    res[side] = o;
  }
  return res;
})()`, 180000);
for (const side of ['L', 'R']) { const o = R.exp2[side] || {}; ok(`two-globe export at 300 dpi (${side}): exact fill`, o.dpiOk && o.inN >= 400 && o.outN >= 400 && o.inBad === 0 && o.outBad === 0, R.exp2); }

// ---- 2. the main thread at dpr 2: a two-globe 300 dpi export (example 1 with X Sphere and Y Sphere, three fresh
// pages): no task over 50 ms
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
R.exp2long = [];
for (const ex of [1, 4, 1]) {
  await nav(`http://localhost:${PORT}/test.html?ns=p3rvX` + Date.now()); await sleep(1200);
  await ev(`__cmwExample(${ex}); 1`); await sleep(2500);
  await ev('__cmwSetView("L", "sphere"); 1'); await sleep(2500);
  await ev('__cmwSetView("R", "sphere"); 1'); await sleep(3000);
  R.exp2long.push(await ev(`await (async () => {
    const long = []; const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) long.push(Math.round(e.duration)); });
    po.observe({ type: 'longtask' }); await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now(); const f = await __cmwBuildFigure({ widthIn: 7, caption: false }); const t1 = performance.now();
    await new Promise((r) => setTimeout(r, 120)); po.disconnect();
    return { ex: ${ex}, ms: Math.round(t1 - t0), long, ok: !!(f && f.svg && f.svg.length > 1000), paths: __cmwPaths().map((p) => p.role + p.viewKind + ':' + p.path) };
  })()`, 60000));
}
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
ok('two-globe 300 dpi export at dpr 2: completes, no main-thread task over 50 ms', R.exp2long.every((r) => r.ok && r.long.every((d) => d <= 50) && r.paths.includes('Rglobe:inverse') && r.paths.includes('Lglobe:inverse')), R.exp2long);

R.logs = logs().filter((l) => /error|exception/i.test(l.t) && !/404/.test(l.m)).slice(0, 6);
ok('no console errors', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

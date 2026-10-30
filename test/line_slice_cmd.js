// The line job is sliced inside one curve too (issue #325): with a map made deliberately slow (each evaluation the
// line refinement makes waits SLOW_US µs, a test wrap of Region.Lines.refineGen / refine), an edit of the chain
// refines a long line through the pole, a second line, a disc around it and a half-plane's edge in pieces of at most
// SLICE_MAX ms of uninterrupted refinement (before: one piece per curve, a long line about 8000 evaluations), and gives
// the same polylines as the unsliced refinement (__cmwLines: their size and a weighted sum) and the same picture at
// rest (the right plane's pixels). A zoom of the left plane (every shape a new line key: refineNow's synchronous try
// in the frame, then the job) keeps every piece within the same bound. A piece is gated by its evaluations, at the mean cost of one in the unsliced run
// (the page's clock is coarse: an evaluation costs about 0.1 ms here, not SLOW_US µs): its wall time also counts the
// machine's own pauses (a busy software-GL runner preempts the page's thread for 10 ms and more between two
// evaluations), reported beside it (p95, max) with the page's long tasks, not gated: on software GL a frame is itself
// a long task, and an edit's first frame may compile the new formula's shader (up to about a second here).
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/line_slice_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''))); };
const SLOW_US = 20, SLICE_MAX = 15;
const SCENE = {
  shapes: [
    { id: 'a', kind: 'line', a: [-1, 0], b: [1, 0], ci: 0, visible: true },
    { id: 'b', kind: 'line', a: [0.3, -1], b: [0.3, 1], ci: 1, visible: true },
    { id: 'c', kind: 'disc', c: [0.3, 0], r: 0.3, ci: 2, visible: true },
    { id: 'd', kind: 'halfplane', a: [0, -1], b: [1, -1], ci: 3, visible: true },
  ],
  steps: [{ type: 'custom', params: { expr: '1/z' }, on: true }],
};
async function openApp() {
  const ns = 'ls' + Date.now();
  await view(1440, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', sel: 1, srcView: { cx: 0, cy: 0, s: 120 } }, SCENE);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2300);
  await settle(1500);
  for (let i = 0; i < 40 && !(await ev('typeof __cmwP === "function" && !!document.querySelector(".card")')); i++) await sleep(250);
}
// every shape's lines refined and the job done (at most s seconds)
const linesDone = async (s = 90) => {
  for (let i = 0; i < s * 4; i++) {
    const L = await ev('__cmwLines()');
    if (L.length && L.every((x) => x.refined && x.current) && !L[0].running) return L;
    await sleep(250);
  }
  return null;
};
// the slow map and the timing of uninterrupted refinement: each span of work of one refinement (a whole Lines.refine
// call, or one step of refineGen between its yields); sliced: false runs refineGen without pauses (the reference)
const instrument = (sliced) => ev(`(() => {
  const L = Region.Lines;
  L.__orig = L.__orig || { refine: L.refine, refineGen: L.refineGen };
  const spin = (us) => { const t = performance.now() + us / 1000; while (performance.now() < t) { /* the slow map */ } };
  const slowF = (F) => (Array.isArray(F) ? F : [F]).map((f) => (typeof f === 'function' ? (z) => { window.__ev++; spin(${SLOW_US}); return f(z); } : f));
  window.__spans = []; window.__spanEv = []; window.__ev = 0;
  L.refine = function (curves, F, sing, caps) { const t = performance.now(), e = window.__ev; try { return L.__orig.refine(curves, slowF(F), sing, caps); } finally { window.__spans.push(performance.now() - t); window.__spanEv.push(window.__ev - e); } };
  if (L.__orig.refineGen) L.refineGen = function* (curves, F, sing, caps) {
    const g = L.__orig.refineGen(curves, slowF(F), sing, ${sliced} ? caps : Object.assign({}, caps, { pc: null }));
    for (;;) { const t = performance.now(), e = window.__ev, r = g.next(); window.__spans.push(performance.now() - t); window.__spanEv.push(window.__ev - e); if (r.done) return r.value; yield; }
  };
  window.__lt = window.__lt || [];
  if (!window.__ltOn) { window.__ltOn = 1; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' }); } catch (e) { /* none */ } }
  return !!L.__orig.refineGen;
})()`);
// the formula field set to expr and applied (Enter): the pole moves (the line spec's key is the chain's structure and
// its singular points), the line job refines every shape
const setExpr = async (expr) => {
  const f = await ev(`(() => { const i = document.querySelector('input[data-pkey="expr"], textarea[data-pkey="expr"]'); if (!i) return false; i.focus(); i.select(); return true; })()`);
  if (!f) return false;
  await type(expr); await key('Enter');
  return true;
};
const rightPx = async (name) => { await shot(name, { x: 706, y: 44, width: 432, height: 570 }); return fs.readFileSync(DIR + '/shots/' + name + '.png'); };
const run = async (sliced, expr) => {
  info.gen = await instrument(sliced);
  const t0 = await ev('performance.now()');
  ok(`${sliced ? 'sliced' : 'reference'}: the formula field`, await setExpr(expr), null);
  const L = await linesDone();
  const spans = await ev('window.__spans'), spanEv = await ev('window.__spanEv'), lt = ((await ev('window.__lt')) || []).filter(([s]) => s >= t0);
  const p95 = (a) => +([...a].sort((x, y) => x - y)[Math.floor(0.95 * (a.length - 1))] || 0).toFixed(1);
  return { L, evals: await ev("window.__ev"), spans: spans.length, evMax: Math.max(0, ...spanEv), p95: p95(spans), max: +Math.max(0, ...spans).toFixed(1), total: Math.round(spans.reduce((a, b) => a + b, 0)), ltMax: Math.round(Math.max(0, ...lt.map(([, d]) => d))), ltN: lt.length };
};

await openApp();
ok('the scene refines its lines', !!(await linesDone()), await ev('__cmwLines()'));
// sliced, then the reference over the same edit (back to 1/z first, then the same formula again)
info.sliced = await run(true, '1/(z-0.05)');
await settle(800);
const pxS = await rightPx('line-slice-sliced');
await run(true, '1/z');
info.ref = await run(false, '1/(z-0.05)');
await settle(800);
const pxR = await rightPx('line-slice-ref');
const sig = (r) => r && r.L ? r.L.map((x) => [x.id, x.pts, x.sum]) : null;
ok('both edits finish refining', !!(info.sliced.L && info.ref.L), [!!info.sliced.L, !!info.ref.L]);
ok('the refinement made thousands of slow evaluations (the scene is a real test)', info.sliced.evals > 4000, info.sliced.evals);
// (the mean cost of one evaluation, from the unsliced run: its spans are nearly all evaluation)
const evMs = info.ref.evals ? info.ref.total / info.ref.evals : 0;
info.evMs = +evMs.toFixed(4);
info.sliced.evMaxMs = +(info.sliced.evMax * evMs).toFixed(1); info.ref.evMaxMs = +(info.ref.evMax * evMs).toFixed(1);
ok(`sliced: no span of uninterrupted line refinement over ${SLICE_MAX} ms of evaluations`, evMs > 0 && info.sliced.evMaxMs <= SLICE_MAX, info.sliced);
ok('the reference is not sliced (one span per curve, and a long one)', info.ref.evMaxMs > 2 * SLICE_MAX, info.ref);
ok('the sliced polylines are the reference\'s', JSON.stringify(sig(info.sliced)) === JSON.stringify(sig(info.ref)), [sig(info.sliced), sig(info.ref)]);
ok('the same picture at rest (the right plane\'s pixels)', pxS.equals(pxR), [pxS.length, pxR.length]);
// ([#325 review] refineNow: a zoom of the left plane gives every shape a new line key, which refineNow tries in the
// frame first; with the slow map it stops at the frame's budget (drawn unrefined) and the job refines the rest: no
// synchronous piece over SLICE_MAX ms of evaluations either)
{
  await instrument(true);
  const t0 = await ev('performance.now()');
  // (four wheel steps at the left plane's centre: about 4.6 x, a new clip window)
  const cl = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  for (let i = 0; i < 4; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: cl[0], y: cl[1], deltaX: 0, deltaY: -240 }); await sleep(120); }
  await sleep(1500);
  const L = await linesDone();
  const spanEv = await ev('window.__spanEv'), lt = ((await ev('window.__lt')) || []).filter(([s0]) => s0 >= t0);
  info.zoom = { done: !!L, evals: await ev('window.__ev'), spans: spanEv.length, evMax: Math.max(0, ...spanEv), ltMax: Math.round(Math.max(0, ...lt.map(([, d]) => d))) };
  info.zoom.evMaxMs = +(info.zoom.evMax * evMs).toFixed(1);
  ok('zoom: the lines are refined for the new view', !!L, await ev('__cmwLines()'));
  ok('zoom: the refinement ran (slow evaluations after the zoom)', info.zoom.evals > 1000, info.zoom);
  ok(`zoom: no piece of line refinement over ${SLICE_MAX} ms of evaluations, in the frame or the job`, evMs > 0 && info.zoom.evMaxMs <= SLICE_MAX, info.zoom);
}
info.sliced.L = info.ref.L = undefined;
await grab();
ok('no page errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };

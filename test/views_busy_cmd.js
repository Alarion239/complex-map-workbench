// The test hook __cmwViewsBusy() (src/app/21-test-hooks.js) says whether the views are still moving to where an action
// leaves them, so a suite waits on that (test/lib/wait_kit.js viewsQuiet) and not on a fixed sleep (#2147). The steps
// view on plane z, with a half-plane on it:
// - at rest, it is false;
// - right after a wheel zoom on the plane (real wheel events), it is true: X's meshing window (clipWin) re-centres
//   200 ms after the last tick (sourceViewChanged);
// - right after a click on Zoom out (a real click), it is true: the view tweens out, then clipWin re-centres;
// - after each, once viewsQuiet() returns, the view and clipWin are where the action leaves them: neither changes over
//   the next HOLD_MS, read every STEP_MS, and each moved (the control: the action did move the views).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views-2 shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { viewsQuiet } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails, max: 20000 });
const HOLD_MS = 1500, STEP_MS = 100, TICKS = 3, DELTA = -300;
const shapes = [{ id: 'h1', ci: 0, visible: true, kind: 'halfplane', a: [0, 0], b: [1, 0] }];
await view(1200, 800, false, false);
await loadView('steps', 'vb' + Date.now(), { v3: true, v4: true, v5: true, v6: true, nextId: 50, srcView: { cx: 0, cy: 0, s: 60 }, shapes, steps: [{ type: 'pown', params: { n: 2 }, on: true }] });
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwViewsBusy === 'function' && !!__cmwLook('h1', 'L') && __cmwLook('h1', 'L').stage === 0` });
await viewsQuiet();
// the views now: X's camera and clipWin
const now = () => ev(`(() => { const k = __cmwLook('h1', 'L'); return { view: { cx: k.view.cx, cy: k.view.cy, s: k.view.s }, win: k.win, busy: __cmwViewsBusy() }; })()`);
const same = (a, b) => JSON.stringify([a.view, a.win]) === JSON.stringify([b.view, b.win]);
// once viewsQuiet() returns: the views then, and whether they stay so for HOLD_MS
async function landed() {
  await viewsQuiet();
  const at = await now(), moved = [];
  for (let t = 0; t < HOLD_MS; t += STEP_MS) { await sleep(STEP_MS); const b = await now(); if (!same(at, b)) moved.push({ t, b }); }
  return { at, moved: moved.slice(0, 3) };
}
const rest = info.rest = await now();
ok('at rest: the views are not busy', rest.busy === false, rest);
// a wheel zoom in at the plane's centre
const c = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
for (let i = 0; i < TICKS; i++) await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c[0], y: c[1], deltaX: 0, deltaY: DELTA });
const w0 = info.wheelNow = await now();
ok('right after a wheel zoom: the views are busy (clipWin still to re-centre)', w0.busy === true, w0);
const w = info.wheel = await landed();
ok('after a wheel zoom, once viewsQuiet() returns: the zoom and clipWin\'s re-centre have landed (the camera zoomed, clipWin moved)', w.at.view.s > rest.view.s * 1.5 && JSON.stringify(w.at.win) !== JSON.stringify(rest.win), { rest, at: w.at });
ok(`after a wheel zoom, once viewsQuiet() returns: neither the view nor clipWin changes over ${HOLD_MS} ms`, w.moved.length === 0, w);
// the Zoom out button (a real click): a 180 ms tween out by 1.6, then clipWin's re-centre
await clickSel('#leftZoomOut');
const z0 = info.zoomOutNow = await now();
ok('right after a click on Zoom out: the views are busy (the tween, then clipWin)', z0.busy === true, z0);
const z = info.zoomOut = await landed();
ok('after Zoom out, once viewsQuiet() returns: the tween and clipWin\'s re-centre have landed (the camera zoomed out by 1.6, clipWin moved)', Math.abs(z.at.view.s * 1.6 / w.at.view.s - 1) < 1e-9 && JSON.stringify(z.at.win) !== JSON.stringify(w.at.win), { before: w.at, at: z.at });
ok(`after Zoom out, once viewsQuiet() returns: neither the view nor clipWin changes over ${HOLD_MS} ms`, z.moved.length === 0, z);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, fails, info };

// A Split while the steps view's glide is in flight with All at once (S.homAll): the formula's unit [j, j+1) becomes [j, j+n), and
// the span, which keeps its progress u, carries those n steps as a group that runs as the formula's own homotopy did. The left
// pane at the same u is pixel-equal across the Split (the exact plot), and the group lasts to the end of that glide.
// Negative control: the same frame with the group dropped from the span differs from the frame before the Split.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (named bounds: the time to reach a state, the channel difference that counts as a differing pixel, and the progress and area bounds)
const SETTLE_MS = 20000, LOAD_MS = 40000, GLIDE_MS = 120000, END_MS = 240000;
const FREEZE_CLOCK_MS = 1e-9, GLIDE_CLOCK_MS = 40, FREEZE_X = 1.2, END_EPS = 1e-6, PLANE_EPS = 1e-9;
const CH_TOL = 8, U_EPS = 1e-4, PX_EQUAL_MAX = 0, CTRL_MIN_FRAC = 0.05;
// (the compared crop of the left pane: EDGE_PX in from its border and below its head; KEY_SKIP_PX more at the top, past the
// colour key, whose caption names the colour plane's function; BOTTOM_SKIP_PX off the bottom: the ruler and the controls
// over the plot's lower edge)
const EDGE_PX = 2, KEY_SKIP_PX = 90, BOTTOM_SKIP_PX = 120;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
// (waits end on the condition they wait for, not on a time)
const until = (expr, max = SETTLE_MS) => settled({ until: expr, max });
const quiet = () => settled({});
const F1 = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const CHAIN = [{ type: 'exp', params: {}, on: true }, F1('\\sin(z^2+1)'), { type: 'mul', params: { c: '2' }, on: true }];
const ns = 'ssr' + Date.now();
const open = async (extra = {}) => {
  const st = Object.assign({ homAll: true, v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, steps: CHAIN }, extra);
  await view(1440, 900, false, false);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length > 1", LOAD_MS);
};
const sv = () => ev('(() => { const q = __cmwSteps(); return { x: q.x, T: q.T, planes: q.planes, stage: q.stage, win: q.win, i: q.i, names: q.names, label: q.label, src: q.paths && q.paths.src && { Tend: q.paths.src.Tend, seq: q.paths.src.seq, startId: q.paths.src.startId } }; })()');
const hide = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
// the left pane below the colour key (whose text names the colour plane's function: it changes with the Split); bare: the
// colour layer alone, else with the points and the paths' trails on
const pane = async (bare = true) => { if (bare) await ev('__cmwSteps({ bare: true })'); await hide(true); await quiet(); const r = await ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + ${EDGE_PX} : r.top; return { x: Math.round(r.left) + ${EDGE_PX}, y: Math.round(t) + ${KEY_SKIP_PX}, width: Math.round(r.width) - 2 * ${EDGE_PX}, height: Math.round(r.bottom - t - ${KEY_SKIP_PX} - ${BOTTOM_SKIP_PX}) }; })()`); const i = await img(r); await hide(false); if (bare) await ev('__cmwSteps({ bare: false })'); return i; };
const diff = (a, b) => { if (a.w !== b.w || a.h !== b.h) return -1; let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.abs(a.data[j] - b.data[j]) > CH_TOL || Math.abs(a.data[j + 1] - b.data[j + 1]) > CH_TOL || Math.abs(a.data[j + 2] - b.data[j + 2]) > CH_TOL) n++; return n; };
const where = (a, b) => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, mx = 0; for (let j = 0; j < a.data.length; j += a.ch) { const d = Math.max(Math.abs(a.data[j] - b.data[j]), Math.abs(a.data[j + 1] - b.data[j + 1]), Math.abs(a.data[j + 2] - b.data[j + 2])); if (d > CH_TOL) { const p = j / a.ch, x = p % a.w, y = Math.floor(p / a.w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); mx = Math.max(mx, d); } } return [x0, y0, x1, y1, mx]; };
const splitNow = async () => { await clickSel('#svStrip .sv-step[data-k="2"] .sv-fchip'); await until("!!document.querySelector('#propsPanel .split-offer .so-btn')"); await clickSel('#propsPanel .split-offer .so-btn'); await until('__cmwSteps().planes.length === 6'); };
await open();
const restWin = (await sv()).win;
await ev('__cmwSteps({ clock: ' + GLIDE_CLOCK_MS + ' })'); await ev('__cmwSteps({ go: 3 })');
await until('__cmwSteps().x > ' + FREEZE_X, GLIDE_MS); await ev('__cmwSteps({ clock: ' + FREEZE_CLOCK_MS + ' })'); await quiet();
const x0 = (await sv()).x;
const g0 = await pane(), o0 = await pane(false), p0 = await sv();
// (no Split: a glide moves the picture, never the view, so the window mid-glide is the one at rest on plane 0)
ok('the window mid-glide is the camera at rest, with no Split', JSON.stringify(p0.win) === JSON.stringify(restWin) && p0.x > FREEZE_X, [restWin, p0.win, p0.x]);
await splitNow();
const g1 = await pane(), o1 = await pane(false), p1 = await sv();
info.x = [x0, p0.x, p1.x]; info.win = [p0.win, p1.win]; info.idx = [p0.i, p1.i]; info.px = diff(g0, g1); info.where = where(g0, g1); info.area = g0.w * g0.h;
info.span = await ev('__cmwSteps().span');
ok('the span is remapped to [0, 5] and carries the split steps as a group', !!info.span && info.span.x0 === 0 && info.span.x1 === 5 && !!info.span.grp && info.span.grp.n === 3, info.span);
ok('the glide keeps its progress u (x 0..3 → 0..5)', Math.abs(p1.x / 5 - x0 / 3) < U_EPS, [x0, p1.x]);
ok('the frame after the Split equals the frame before (the exact plot at the same u)', info.px >= 0 && info.px <= PX_EQUAL_MAX, [info.px, info.where]);
ok('the left pane shows the same window across the Split (the ruler follows the plot)', JSON.stringify(p0.win) === JSON.stringify(p1.win), info.win);
// (the whole screen, not the bare plot: the points and the trails, the plane the thread is on, the head and the key)
info.overPx = diff(o0, o1);
ok('the pane with its points and trails is unchanged by the Split', info.overPx >= 0 && info.overPx <= PX_EQUAL_MAX, [info.overPx, where(o0, o1)]);
ok('the trails are the same one homotopy over the span (Tend 1, from the first plane)', JSON.stringify(p0.src) === JSON.stringify(p1.src) && !!p1.src && p1.src.seq === false && p1.src.Tend === 1 && p1.src.startId === true, [p0.src, p1.src]);
ok('the plane the thread is on is unchanged', p0.i === p1.i, [p0.i, p1.i]);
ok('the head and the key name the same maps', JSON.stringify(p0.names) === JSON.stringify(p1.names), [p0.names, p1.names]);
// the glide goes on to its plane, then the next glide uses the sub-steps: no group
await ev('__cmwSteps({ clock: ' + GLIDE_CLOCK_MS + ' })');
await until('Math.abs(__cmwSteps().x - 5) < ' + END_EPS + ' && !__cmwSteps().moving', END_MS); await quiet();
ok('the glide ends on the last plane (5)', Math.abs((await sv()).x - 5) < PLANE_EPS, await sv());
await ev('__cmwSteps({ clock: ' + FREEZE_CLOCK_MS + ' })'); await ev('__cmwSteps({ go: 0 })');
info.next = await ev('__cmwSteps().span');
ok('the next glide runs the sub-steps (a span over [0, 5], no group)', !!info.next && info.next.x1 === 5 && !info.next.grp, info.next);
// negative control: the same Split with the group dropped from the span (the sub-steps' own homotopies at one u) is not the
// formula's picture, so the frame check above can fail
await open();
await ev('__cmwSteps({ clock: ' + GLIDE_CLOCK_MS + ' })'); await ev('__cmwSteps({ go: 3 })');
await until('__cmwSteps().x > ' + FREEZE_X, GLIDE_MS); await ev('__cmwSteps({ clock: ' + FREEZE_CLOCK_MS + ' })'); await quiet();
const c0 = await pane();
await splitNow();
await ev('__cmwSteps({ span: [0, 5] })'); await quiet();
const c1 = await pane();
info.noGroupPx = diff(c0, c1);
ok('the same frame without the group differs from the frame before the Split (negative control)', info.noGroupPx > CTRL_MIN_FRAC * info.area, [info.noGroupPx, info.area]);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };

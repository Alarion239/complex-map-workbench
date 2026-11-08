// A Split while the steps view's glide is in flight with All at once (S.homAll): the formula's unit [j, j+1) becomes [j, j+n), and
// the span, which keeps its progress u, carries those n steps as a group that runs as the formula's own homotopy did. The left
// pane at the same u is pixel-equal across the Split (the exact plot), and the group lasts to the end of that glide.
// Negative control: the same frame with the group dropped from the span differs from the frame before the Split.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
// (waits end on the condition they wait for, not on a time)
const until = (expr, max = 20000) => settled({ until: expr, max });
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
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane') && __cmwSteps().planes.length > 1", 40000);
};
const sv = () => ev('(() => { const q = __cmwSteps(); return { x: q.x, T: q.T, planes: q.planes, stage: q.stage }; })()');
const hide = (on) => ev(`(() => { let s = document.getElementById('qaNoToast'); if (!s) { s = document.createElement('style'); s.id = 'qaNoToast'; document.head.append(s); } s.textContent = ${on} ? '#toastHost{visibility:hidden!important} .tip,[role=tooltip]{display:none!important}' : ''; return 1; })()`);
// (below the colour key, whose text names the colour plane's function: it changes with the Split)
const pane = async () => { await ev('__cmwSteps({ bare: true })'); await hide(true); await quiet(); const r = await ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + 2 : r.top; return { x: Math.round(r.left) + 2, y: Math.round(t) + 90, width: Math.round(r.width) - 4, height: Math.round(r.bottom - t - 210) }; })()`); const i = await img(r); await hide(false); await ev('__cmwSteps({ bare: false })'); return i; };
const diff = (a, b) => { if (a.w !== b.w || a.h !== b.h) return -1; let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.abs(a.data[j] - b.data[j]) > 8 || Math.abs(a.data[j + 1] - b.data[j + 1]) > 8 || Math.abs(a.data[j + 2] - b.data[j + 2]) > 8) n++; return n; };
const where = (a, b) => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, mx = 0; for (let j = 0; j < a.data.length; j += a.ch) { const d = Math.max(Math.abs(a.data[j] - b.data[j]), Math.abs(a.data[j + 1] - b.data[j + 1]), Math.abs(a.data[j + 2] - b.data[j + 2])); if (d > 8) { const p = j / a.ch, x = p % a.w, y = Math.floor(p / a.w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); mx = Math.max(mx, d); } } return [x0, y0, x1, y1, mx]; };
const split = async () => {
   await clickSel('#svStrip .sv-step[data-k="2"] .sv-fchip'); await until("!!document.querySelector('#propsPanel .split-offer .so-btn')"); await clickSel('#propsPanel .split-offer .so-btn'); await until('__cmwSteps().planes.length === 6'); await quiet(); };


const freezeAt = (x0) => ev(`new Promise((r) => { const f = () => { const x = __cmwSteps().x; if (x > ${x0}) { __cmwSteps({ clock: 0.0001 }); r(x); } else requestAnimationFrame(f); }; f(); })`);
const splitNow = async () => { await clickSel('#svStrip .sv-step[data-k="2"] .sv-fchip'); await until("!!document.querySelector('#propsPanel .split-offer .so-btn')"); await clickSel('#propsPanel .split-offer .so-btn'); await until('__cmwSteps().planes.length === 6'); };
await open();
info.q0 = await ev('(() => { const q = __cmwSteps(); return { homAll: q.homAll, span: q.span, x: q.x, planes: q.planes, anim: q.anim }; })()');
await ev('__cmwSteps({ clock: 40 })'); await ev('__cmwSteps({ go: 3 })');
info.q1 = await ev('(() => { const q = __cmwSteps(); return { span: q.span, x: q.x, all: q.all, anim: q.anim && { from: q.anim.from, to: q.anim.to, ms: q.anim.ms } }; })()');
await until('__cmwSteps().x > 1.2', 120000); await ev('__cmwSteps({ clock: 0.0001 })'); await quiet();
const x0 = (await sv()).x;
const g0 = await pane(), p0 = await sv();
await splitNow();
const g1 = await pane(), p1 = await sv();
info.x = [x0, p0.x, p1.x]; info.px = diff(g0, g1); info.where = where(g0, g1); info.area = g0.w * g0.h;
info.span = await ev('__cmwSteps().span');
ok('the span is remapped to [0, 5] and carries the split steps as a group', !!info.span && info.span.x0 === 0 && info.span.x1 === 5 && !!info.span.grp && info.span.grp.n === 3, info.span);
ok('the glide keeps its progress u (x 0..3 → 0..5)', Math.abs(p1.x / 5 - x0 / 3) < 1e-4, [x0, p1.x]);
ok('the frame after the Split equals the frame before (the exact plot at the same u)', info.px >= 0 && info.px < 0.005 * info.area, [info.px, info.where]);
// the glide goes on to its plane, then the next glide uses the sub-steps: no group
await ev('__cmwSteps({ clock: 40 })');
await until('Math.abs(__cmwSteps().x - 5) < 1e-6 && !__cmwSteps().moving', 240000); await quiet();
ok('the glide ends on the last plane (5)', Math.abs((await sv()).x - 5) < 1e-9, await sv());
await ev('__cmwSteps({ clock: 0.0001 })'); await ev('__cmwSteps({ go: 0 })');
info.next = await ev('__cmwSteps().span');
ok('the next glide runs the sub-steps (a span over [0, 5], no group)', !!info.next && info.next.x1 === 5 && !info.next.grp, info.next);
// negative control: the same Split with the group dropped from the span (the sub-steps' own homotopies at one u) is not the
// formula's picture, so the frame check above can fail
await open();
await ev('__cmwSteps({ clock: 40 })'); await ev('__cmwSteps({ go: 3 })');
await until('__cmwSteps().x > 1.2', 120000); await ev('__cmwSteps({ clock: 0.0001 })'); await quiet();
const c0 = await pane();
await splitNow();
await ev('__cmwSteps({ span: [0, 5] })'); await quiet();
const c1 = await pane();
info.noGroupPx = diff(c0, c1);
ok('the same frame without the group differs from the frame before the Split (negative control)', info.noGroupPx < 0 || info.noGroupPx > 0.05 * info.area, [info.noGroupPx, info.area]);
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };

// A Split while the steps view's thread is parked between planes (#945): the formula's unit [j, j+1) becomes [j, j+n), so the
// thread keeps its picture (the left pane is pixel-equal across the Split), the colour plane stays the chain's last, a step shown
// alone past the formula stays that step, and Undo gives the place back.
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
  const st = Object.assign({ v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'r1', kind: 'rect', a: [-1.2, -1.2], b: [1.2, 1.2] }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, steps: CHAIN }, extra);
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

// ---- parked at x = 1.5, inside the formula's unit [1, 2): it becomes [1, 4), so x = 2.5
await open();
await ev('__cmwSteps({ park: 1.5 })'); await until('Math.abs(__cmwSteps().x - 1.5) < 1e-6');
const a = await pane(), s0 = await sv(); await shot('ssr-before');
await split();
const s1 = await sv();
ok('3 steps became 5', s1.planes.length === 6, s1);
ok('parked: x 1.5 → 2.5', Math.abs(s1.x - 2.5) < 1e-9, [s0, s1]);
ok('the colour plane stays the last (F)', s1.T === 5 || s1.T === -1, s1);
await shot('ssr-after'); { const a2 = await pane(); info.parkedPx = diff(a, a2); info.parkedWhere = where(a, a2); }
ok('parked: the frame is pixel-equal', info.parkedPx === 0, [info.parkedPx, info.parkedWhere]);
// (Undo through the top bar's button, as the toast's Undo does: the toast goes by itself 6 s after the Split, and a page that
// takes longer to get here has no toast to click)
await ev("document.getElementById('undoBtn').click()");
const undone = await until('__cmwSteps().planes.length === 4'); await quiet();
ok('Undo: the click landed (the chain has its 3 steps again)', undone.ok, undone);
const s2 = await sv();
ok('Undo: 3 steps and x = 1.5 again', s2.planes.length === 4 && Math.abs(s2.x - 1.5) < 1e-9, s2);

// ---- parked past the formula (x = 2.5, on the way to f3): x moves by n - 1
await open();
await ev('__cmwSteps({ park: 2.5 })'); await until('Math.abs(__cmwSteps().x - 2.5) < 1e-6');
const b = await pane(); await split();
const s3 = await sv();
ok('past the formula: x 2.5 → 4.5', Math.abs(s3.x - 4.5) < 1e-9, s3);
info.pastPx = diff(b, await pane());
ok('past the formula: the frame is pixel-equal', info.pastPx === 0, info.pastPx);

// ---- f2 shown alone is split: its first new step stays shown alone (the toast says so), the whole chain's place stays
await open({ sv: { at: 1.5, T: -1, scope: 'all', surf: 'plane', speed: 'normal', alone: 2 } });
await until("!!document.querySelector('#svStrip .sv-whole')");
await clickSel('#svStrip .sv-step[data-k="2"] .sv-fchip'); await until("!!document.querySelector('#propsPanel .split-offer .so-btn')");
const hasOffer = await ev(`!!document.querySelector('#propsPanel .split-offer .so-btn')`);
if (hasOffer) {
  await clickSel('#propsPanel .split-offer .so-btn'); await until('__cmwSteps().planes.length === 2'); await quiet();
  const s4 = await sv();
  ok('f2 alone: its first new step stays shown alone', await ev(`!!document.querySelector('#svStrip .sv-whole')`) && s4.planes.length === 2, s4);
  await clickSel('#svStrip .sv-alone .sv-whole'); await until("!document.querySelector('#svStrip .sv-whole')"); await quiet();
  const s5 = await sv();
  ok('Whole chain after it: the place is the remapped one (the page opens on the plane 2, which becomes 4)', s5.planes.length === 6 && Math.abs(s5.x - 4) < 1e-9, s5);
} else ok('f2 alone: the Split offer is there', false, 'no offer');

// ---- a glide in flight: the Split remaps it (the same picture, the same destination, no stop)
// (SV.clock freezes the glide's time between the two pictures: it advances a thousandth of a millisecond a frame)
const freezeAt = (x0) => ev(`new Promise((r) => { const f = () => { const x = __cmwSteps().x; if (x > ${x0}) { __cmwSteps({ clock: 0.0001 }); r(x); } else requestAnimationFrame(f); }; f(); })`);
const splitNow = async () => { await clickSel('#svStrip .sv-step[data-k="2"] .sv-fchip'); await until("!!document.querySelector('#propsPanel .split-offer .so-btn')"); await clickSel('#propsPanel .split-offer .so-btn'); await until('__cmwSteps().planes.length === 6'); };
{
  await open();
  await ev('__cmwSteps({ clock: 40 })'); await ev('__cmwSteps({ go: 3 })');
  const x0 = await freezeAt(1.2);
  const g0 = await pane(), p0 = await sv();
  await splitNow();
  const g1 = await pane(), p1 = await sv();
  const want = (x0 < 1 ? x0 : x0 < 2 ? 1 + (x0 - 1) * 3 : x0 + 2);
  info.glideX = [x0, p0.x, p1.x, want];
  ok('glide in flight: the place is remapped (x 1.2+ → splitMorphT)', Math.abs(p1.x - want) < 0.02, info.glideX);
  info.glidePx = diff(g0, g1);
  ok('glide in flight: the frame after the Split equals the frame before (within the glide tolerance)', info.glidePx >= 0 && info.glidePx < 0.005 * g0.w * g0.h, [info.glidePx, where(g0, g1)]);
  // the glide goes on and parks on the plane it was heading for: f3's plane, which is index 5 after the Split
  await ev('__cmwSteps({ clock: 40 })');
  await until('Math.abs(__cmwSteps().x - 5) < 1e-6', 60000); await quiet();
  const p2 = await sv();
  ok('glide in flight: it ends on the plane it was heading for (3 → 5)', Math.abs(p2.x - 5) < 1e-9, p2);
}
// ---- the same, with Play (its range kept, the loop kept) and Undo of the Split in flight
{
  await open();
  await ev('__cmwSteps({ clock: 40 })'); await ev('__cmwSteps({ play: true })');
  const x0 = await freezeAt(1.2);
  await splitNow();
  const p1 = await sv();
  ok('play in flight: the place is remapped', Math.abs(p1.x - (x0 < 1 ? x0 : x0 < 2 ? 1 + (x0 - 1) * 3 : x0 + 2)) < 0.02, [x0, p1.x]);
  ok('play in flight: it still plays', (await ev('__cmwSteps().play')) === 'glide', await ev('__cmwSteps().play'));
  await ev('__cmwSteps({ clock: 40 })');
  await until('Math.abs(__cmwSteps().x - 5) < 1e-6 && __cmwSteps().play === null', 60000); await quiet();
  ok('play in flight: it stops at the last plane (5)', Math.abs((await sv()).x - 5) < 1e-9, await sv());
}
{
  await open();
  await ev('__cmwSteps({ clock: 40 })'); await ev('__cmwSteps({ go: 3 })');
  await freezeAt(1.2);
  await splitNow();
  await ev('__cmwSteps({ clock: 0.0001 })');
  const xa = (await sv()).x, ga = await pane();
  await ev("document.getElementById('undoBtn').click()"); await until('__cmwSteps().planes.length === 4');
  const xb = (await sv()).x; info.undoX = [xa, xb, await sv()];
  ok('Undo in flight: the place goes back (x remapped by the inverse)', Math.abs(xb - (1 + (xa - 1) / 3)) < 0.05, [xa, xb]);
  await ev('__cmwSteps({ clock: 40 })');
  await until('Math.abs(__cmwSteps().x - 3) < 1e-6', 60000);
  ok('Undo in flight: the glide ends on its plane (3)', Math.abs((await sv()).x - 3) < 1e-9, [await sv(), info.undoX]);
}
{
  // reduced motion: a Play ticks a plane at a time; the Split during it remaps its end
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await open();
  await ev('__cmwSteps({ go: 1, now: true })'); await ev('__cmwSteps({ play: true })');
  await splitNow();
  await until('Math.abs(__cmwSteps().x - 5) < 1e-6', 30000);
  ok('reduced motion: the Play\'s ticks end on the remapped last plane (5)', Math.abs((await sv()).x - 5) < 1e-9, await sv());
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass, fails, info };

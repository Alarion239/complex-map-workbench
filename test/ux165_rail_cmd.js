// v16.5 wave 1, the rail piece (notes/ux-build/rail/SPEC.md 5.2): snapping points to the grid and to figures, railing on
// curves with a pull to free a point, "needs distinct points", moves that snap, Alt to move freely. In the real app with
// real pointer events: the laptop 1366 × 768 (mouse), the phone 412 × 860 (Android emulation, touch through
// Input.dispatchTouchEvent), 915 × 412 for the slides and the pull.
//   A the Point tool on the shown unit circle: a fixed unit circle and a point on it, one undo step; the hover chip; Alt
//     places a free point; the phone tap 12 px off
//   B dragged round 270° (mouse, finger): on the circle all the way; at 90° exactly i; Snap off: no detent
//   C the pull: 30 px out still on it (the stretch line); 50 px held 200 ms frees it ("z₁ is free", the detach cue); a
//     40 px sweep for 60 ms does not; a finger 64 px for 200 ms; one undo step, Undo puts it back on the circle
//   D the same gesture onto Line 1: a point on Line 1, its midpoint followed every frame; a drop on a crossing (a meet
//     point); a drop on z₀ (the warn ring, not merged)
//   E Orthogonal: two picks on one circle, twice; opposite picks at the detents (the diameter); 3 points on one circle;
//     3 points through three crossings; a press on the first pick (the warn ring and "needs distinct points")
//   F the grid: 0.5 + i at 52 px per unit, 0.55 + 1.05i at 520; a dragged point; a disc moved by its body; Alt raw
//   G Alt: a glider Alt-dragged comes off at once; Alt at the drop keeps it free
//   I Russian chips, dark, the phone chip 48 px above the finger inside the pane, nothing at rest
//   J BUDGET60: a glider with 10 perpendicular circles on it dragged round the unit circle
//   K the sphere: a point on a curve slides on the globe; a pull frees it; the Point tool on a drawn curve there
//   B (also) the detent tick with Snap ticks on; H (run last) Esc during a drag restores, no step; a second finger
//     restores; one finger slides again after it
// A command file for a CDP daemon (test/cdp_kit README):  python3 build.py && test/<you>_cdp/q.sh test/ux165_rail_cmd.js
const ONLY = typeof __ONLY !== 'undefined' ? __ONLY : null;
const run = (k) => !ONLY || ONLY.includes(k);
const fails = [], info = {};
let checks = 0;
const ok = (name, cond, got) => { checks++; if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = [];
const grab = async () => { errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''))); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const NS = 'rail' + (Date.now() % 100000);
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
const A = (deg, r = 1, c = [0, 0]) => W(c[0] + r * Math.cos(deg * Math.PI / 180), c[1] + r * Math.sin(deg * Math.PI / 180));
const CI = (o) => ev(`__cmwCI(${JSON.stringify(o || null)})`);
const ST = () => CI({ shapes: true });
const DBG = () => CI();
const byId = (st, id) => st.list.find((s) => s.id === id);
const last = (st) => st.list[st.list.length - 1];
const scale = async () => { const a = await W(0, 0), b = await W(1, 0); return b[0] - a[0]; };
const tool = async (id) => { await ev(`(() => { const b = [...document.querySelectorAll('[data-tool="${id}"]')].find((e) => e.offsetParent) || document.querySelector('[data-tool="${id}"]'); b.click(); return 1; })()`); await settle(120); };
const chipOf = async () => { const d = await DBG(); return d.ring ? d.ring.chip : null; };
const spyCues = () => ev(`(() => { window.__cues = []; if (!Sound.prefs().on || !Sound.prefs().ui) Sound.set({ on: true, ui: true }); if (!Sound.__railSpy) { const p = Sound.play; Sound.play = function (n, o) { __cues.push(n); return p.apply(this, arguments); }; Sound.__railSpy = 1; } return 1; })()`);
const cues = () => ev(`(window.__cues || []).slice()`);
const undo = async () => { await ev(`document.getElementById('undoBtn').click(), 1`); await settle(200); };
const abs = (p) => Math.hypot(p[0], p[1]);
// a mouse drag through world points (mods: 1 Alt), sampling the state after each frame when asked
async function mdrag(path, o = {}) {
  const m = o.mods || 0;
  const [x0, y0] = path[0];
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, modifiers: m });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1, modifiers: m });
  const samples = [];
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, modifiers: o.altFrom != null && i >= o.altFrom ? 1 : m });
    await sleep(o.dt || 18);
    if (o.sample) { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); samples.push(await o.sample(i)); }
  }
  if (o.hold) await sleep(o.hold);
  if (o.beforeUp) await o.beforeUp();
  const [x1, y1] = path[path.length - 1];
  if (o.noUp) return samples;
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1, modifiers: o.upMods != null ? o.upMods : m });
  return samples;
}
async function tdrag(path, o = {}) {
  const [x0, y0] = path[0];
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  await sleep(30);
  const samples = [];
  for (let i = 1; i < path.length; i++) {
    const [x, y] = path[i];
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await sleep(o.dt || 18);
    if (o.sample) { await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); samples.push(await o.sample(i)); }
  }
  if (o.hold) await sleep(o.hold);
  if (o.beforeUp) await o.beforeUp();
  if (o.noUp) return samples;
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return samples;
}
const tap = async (x, y, ms = 60) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(ms); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
// points along a circle (deg a0 to a1, step) at radius r
const arc = async (a0, a1, step, r = 1, c = [0, 0]) => { const out = []; const n = Math.round(Math.abs(a1 - a0) / step); for (let i = 0; i <= n; i++) out.push(await A(a0 + (a1 - a0) * i / n, r, c)); return out; };
const line = (p, q, n) => Array.from({ length: n + 1 }, (_, i) => [p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]);
const SHOT = (n) => shot('w1-rail/' + n);
const U0 = (extra) => Object.assign({ unit: true, snap: true, shapes: [], nextId: 10 }, extra || {});
const C1 = { id: 'C', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true };
const gl = (id, t, c = 'C', extra) => Object.assign({ id, kind: 'point', p: [Math.cos(2 * Math.PI * t), Math.sin(2 * Math.PI * t)], t, ci: 1, visible: true, def: { op: 'glider', args: [{ s: c, part: 0 }] } }, extra || {});

async function section(k, f) { if (!run(k)) return; try { await f(); } catch (e) { fails.push({ name: k + ' threw', got: String(e && e.stack || e).slice(0, 600) }); } await grab(); }

// ---------------------------------------------------------------- A
await section('A', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'a', U0());
  await settle(900);
  await spyCues();
  await tool('point');
  const s = await scale();
  info.scaleA = s;
  // hover 3 px off the circle at 37° (no detent near): "on the unit circle"
  const p37 = await A(37, 1 + 3 / s);
  await move(p37[0], p37[1]); await settle(150);
  info.hover37 = await chipOf();
  ok('A hover 3 px off the shown unit circle: the chip "on the unit circle"', info.hover37 === 'on the unit circle', info.hover37);
  await SHOT('after-laptop-hover-unit');
  const n0 = (await ST()).n;
  await click(p37[0], p37[1]); await settle();
  let st = await ST();
  const U1 = st.list.filter((x) => x.fixed === 'unit'), g = last(st);
  info.A1 = { n0, n: st.n, list: st.list.map((x) => [x.id, x.kind, x.def && x.def.op, x.fixed]) };
  ok('A click 3 px off: the fixed unit circle made once and a point on it', U1.length === 1 && g.kind === 'point' && g.def && g.def.op === 'glider' && g.def.args[0].s === U1[0].id, info.A1);
  ok('A the point lies on the unit circle (|p| = 1 to 1e-15)', Math.abs(abs(g.p) - 1) <= 1e-15, g.p);
  ok('A one undo step', st.n === n0 + 1, { n0, n: st.n });
  ok('A its parameter is the angle (37°)', Math.abs(g.t - 37 / 360) < 0.004, g.t);
  // still with the Point tool: a drag from the point moves it round the circle (no new point), one undo step
  const gS = await W(g.p[0], g.p[1]), nA = st.list.length, nA0 = st.n;
  await mdrag(await arc(37, 97, 7).then((a) => [gS].concat(a.slice(1)))); await settle();
  st = await ST();
  const gD = byId(st, g.id);
  info.Adrag = { t: gD.t * 360, n: st.list.length, nA, hist: [nA0, st.n] };
  ok('A the Point tool drags the point it placed round the circle (no new point, one step)', gD.def && gD.def.op === 'glider' && Math.abs(gD.t * 360 - 97) < 1.5 && Math.abs(abs(gD.p) - 1) <= 1e-15 && st.list.length === nA && st.n === nA0 + 1, info.Adrag);
  // a click on it (no drag): nothing new, no step
  const gC = await W(gD.p[0], gD.p[1]);
  await click(gC[0], gC[1]); await settle();
  st = await ST();
  ok('A a click on it with the Point tool: no new point, no step', st.list.length === nA && st.n === nA0 + 1, { n: st.list.length, h: st.n });
  // Alt-click 3 px off the circle elsewhere: a free point, raw
  const p140 = await A(140, 1 + 3 / s);
  await move(p140[0], p140[1]);
  await click(p140[0], p140[1], { mods: 1 }); await settle();
  st = await ST();
  const fr = last(st);
  ok('A Alt-click near the circle: a free point where pressed (no snap)', fr.kind === 'point' && !fr.def && Math.abs(abs(fr.p) - (1 + 3 / s)) < 0.01, fr);
  // the phone: a tap 12 px off the circle
  await view(412, 860, false, true);
  await load(NS + 'aph', U0());
  await settle(1000);
  await tool('point');
  const sp = await scale();
  const t50 = await A(50, 1 + 12 / sp);
  await tap(t50[0], t50[1]); await settle();
  st = await ST();
  const gp = last(st);
  info.Aph = { sp, list: st.list.map((x) => [x.id, x.kind, x.def && x.def.op, x.fixed, x.p]) };
  ok('A phone: a tap 12 px off the unit circle makes a point on it', gp && gp.def && gp.def.op === 'glider' && Math.abs(abs(gp.p) - 1) <= 1e-15 && st.list.filter((x) => x.fixed === 'unit').length === 1, info.Aph);
  await SHOT('after-phone-point-on-unit');
});

// ---------------------------------------------------------------- B
await section('B', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'b', U0({ shapes: [C1, gl('g', 37 / 360)], nextId: 20 }));
  await settle(900);
  await tool('select');
  const degs = [37].concat(Array.from({ length: 55 }, (_, i) => 40 + 5 * i));
  const path = []; for (const a of degs) path.push(await A(a));
  const samples = await mdrag(path, { sample: async (i) => { const st = await ST(); const g = byId(st, 'g'); return { deg: degs[i], p: g.p, def: g.def && g.def.op }; } });
  await settle();
  const onAll = samples.every((x) => x.def === 'glider' && Math.abs(abs(x.p) - 1) <= 1e-15);
  ok('B dragged round 270°: on the circle all the way', onAll, samples.filter((x) => !(x.def === 'glider' && Math.abs(abs(x.p) - 1) <= 1e-15)).slice(0, 3));
  // at 90° (the pointer at 90°): exactly i
  const at90 = samples.find((x) => x.deg === 90);
  ok('B at 90° with Snap on: exactly i', at90 && at90.p[0] === 0 && at90.p[1] === 1, at90);
  const n1 = (await ST()).n;
  // the snap tick (its own switch, off by default): silent by default; switched on, a detent caught ticks once
  await spyCues();
  const g9 = byId(await ST(), 'g');
  await mdrag([await A(g9.t * 360), await A(g9.t * 360 - 20), await A(g9.t * 360 - 30)]); await settle();
  const c0 = await cues();
  await ev(`Sound.set({ snap: true }), window.__cues = [], 1`);
  const g8 = byId(await ST(), 'g');
  await mdrag([await A(g8.t * 360), await A(g8.t * 360 - 25), await A(g8.t * 360 - 30)]); await settle();
  const c1 = await cues();
  await ev(`Sound.set({ snap: false }), 1`);
  info.Btick = { c0, c1, t: [g9.t * 360, g8.t * 360] };
  ok('B the detent tick: none by default, one per detent with Snap ticks on', !c0.includes('snap') && c1.filter((x) => x === 'snap').length >= 1, info.Btick);
  // Snap off: no detent (the pointer 2° from 90°)
  await ev(`document.getElementById('snapBtn').click(), 1`); await settle(100);
  const g0 = byId(await ST(), 'g');
  const p2 = await mdrag([await A(g0.t * 360), await A(88), await A(92)]);
  await settle();
  const g1 = byId(await ST(), 'g');
  ok('B Snap off: no detent (92° stays 92°)', g1.def && Math.abs(g1.t - 92 / 360) < 0.002 && g1.p[0] !== 0, g1);
  await ev(`document.getElementById('snapBtn').click(), 1`); await settle(100);
  // the finger, 915 × 412 (landscape phone)
  await view(915, 412, false, true);
  await load(NS + 'bph', U0({ shapes: [C1, gl('g', 37 / 360)], nextId: 20 }));
  await settle(1000);
  await tool('select');
  const tp = await arc(37, 307, 6);
  const ts = await tdrag(tp, { sample: async () => { const g = byId(await ST(), 'g'); return { p: g.p, def: g.def && g.def.op }; } });
  await settle();
  ok('B finger: dragged round 270° on the circle all the way', ts.length > 20 && ts.every((x) => x.def === 'glider' && Math.abs(abs(x.p) - 1) <= 1e-15), ts.filter((x) => !(x.def === 'glider')).slice(0, 3));
  const gF = byId(await ST(), 'g');
  ok('B finger: it ends at 307° (a 15° detent at 300° is 7° away: the finger catches within 10 px)', gF.def && Math.abs(gF.t * 360 - 307) < 8, gF.t * 360);
});

// ---------------------------------------------------------------- C
await section('C', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'c', U0({ shapes: [C1, gl('g', 0)], nextId: 20 }));
  await settle(900);
  await spyCues();
  await tool('select');
  const s = await scale();
  const n0 = (await ST()).n;
  const P0 = await A(0);
  // 30 px out: still on the circle, the stretch line drawn
  const out30 = line(P0, [P0[0] + 30, P0[1]], 6);
  await mdrag(out30, { noUp: true });
  await settle(60);
  let d = await DBG(), g = byId(await ST(), 'g');
  info.C30 = { rail: d.rail, chip: d.ring && d.ring.chip, g: g.def };
  ok('C 30 px out: still on the circle', g.def && g.def.op === 'glider' && Math.abs(abs(g.p) - 1) <= 1e-15, g);
  ok('C 30 px out: the stretch line and "Pull further to free"', d.rail && d.rail.stretch && d.rail.stretch.k > 0.35 && /^Pull further to free /.test(d.ring && d.ring.chip || ''), info.C30);
  // the stretch line's pixels: the overlay at a dash between the point and the pointer differs from the plane
  await SHOT('after-laptop-stretch');
  // 50 px, held 200 ms: free
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: P0[0] + 50, y: P0[1], button: 'left', buttons: 1 });
  await sleep(220); await settle(30);
  d = await DBG(); g = byId(await ST(), 'g');
  info.C50 = { g, free: d.freeChip, cues: await cues() };
  ok('C 50 px held 200 ms: the point comes off (no definition, at the pointer)', !g.def && Math.abs(g.p[0] - (1 + 50 / s)) < 0.02, info.C50);
  ok('C the chip "z₁ is free" and the detach cue', /is free$/.test(d.freeChip || '') && (await cues()).includes('detach'), info.C50);
  await SHOT('after-laptop-freed');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: P0[0] + 50, y: P0[1], button: 'left', clickCount: 1 });
  await settle();
  const n1 = (await ST()).n;
  ok('C one undo step for the whole drag', n1 === n0 + 1, { n0, n1 });
  await undo();
  g = byId(await ST(), 'g');
  ok('C Undo: back on the circle at its t', g.def && g.def.op === 'glider' && g.t === 0 && g.p[0] === 1 && g.p[1] === 0, g);
  // a 45 px sweep lasting 60 ms does not free it
  const sweep = [P0, [P0[0] + 20, P0[1]], [P0[0] + 45, P0[1]], [P0[0] + 45, P0[1] + 1], [P0[0] + 10, P0[1] + 2], [P0[0] + 2, P0[1]]];
  await mdrag(sweep, { dt: 20 });
  await settle();
  g = byId(await ST(), 'g');
  ok('C a 45 px sweep for 60 ms: still on the circle', g.def && g.def.op === 'glider', g);
  // the finger: 64 px held 200 ms
  await view(915, 412, false, true);
  await load(NS + 'cph', U0({ shapes: [C1, gl('g', 0)], nextId: 20 }));
  await settle(1000);
  await tool('select');
  const Q0 = await A(0);
  await tdrag(line(Q0, [Q0[0] + 40, Q0[1]], 4), { noUp: true });
  await settle(30);
  g = byId(await ST(), 'g');
  ok('C finger 40 px out: still on the circle (touch let-go at 64)', g.def && g.def.op === 'glider', g);
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Q0[0] + 70, y: Q0[1], id: 1 }] });
  await sleep(220); await settle(30);
  g = byId(await ST(), 'g');
  ok('C finger 70 px held 200 ms: free', !g.def, g);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle();
});

// ---------------------------------------------------------------- D
await section('D', async () => {
  await view(1366, 768, false, false);
  const L1 = { id: 'L1', kind: 'line', a: [-3, 1.5], b: [3, 1.5], ci: 2, visible: true };
  const C2 = { id: 'C2', kind: 'circle', c: [0, 1.5], r: 1, ci: 3, visible: true };
  const q = { id: 'q', kind: 'point', p: [-1, -1.5], ci: 4, visible: true };
  const M = { id: 'M', kind: 'point', p: [0, 0], ci: 5, visible: true, def: { op: 'midpoint', args: [{ s: 'g' }, { s: 'q' }] } };
  const f = { id: 'f', kind: 'point', p: [2.2, -1.2], ci: 6, visible: true };
  const f2 = { id: 'f2', kind: 'point', p: [-2.2, -1.2], ci: 6, visible: true };
  await load(NS + 'd', U0({ unit: false, shapes: [C1, gl('g', 0), L1, C2, q, M, f, f2], nextId: 40 }));
  await settle(900);
  await tool('select');
  const n0 = (await ST()).n;
  const P0 = await A(0), out = await W(1.9, 0.4), onL = await W(2.2, 1.5);
  const path = line(P0, out, 8).concat(line(out, [onL[0], onL[1] + 2], 8).slice(1));
  const smp = await mdrag(path, { hold: 0, sample: async () => { const st = await ST(); const g = byId(st, 'g'), m = byId(st, 'M'); return { g: g.p, m: m.p, def: g.def && g.def.op }; } });
  await settle();
  const st = await ST(), g = byId(st, 'g');
  info.D1 = { g, n0, n: st.n };
  ok('D pulled off and dropped on Line 1: a point on Line 1', g.def && g.def.op === 'glider' && g.def.args[0].s === 'L1' && g.p[1] === 1.5, g);
  ok('D one undo step for slide, pull and drop', st.n === n0 + 1, info.D1);
  ok('D the midpoint followed every frame', smp.every((x) => Math.abs(x.m[0] - (x.g[0] - 1) / 2) < 1e-12 && Math.abs(x.m[1] - (x.g[1] - 1.5) / 2) < 1e-12), smp.slice(0, 2));
  // a drop on Line 1 ∩ Circle 2 at (1, 1.5): the meet point
  const F0 = await W(2.2, -1.2), X = await W(1, 1.5);
  await spyCues();
  await mdrag(line(F0, [X[0] + 2, X[1] + 1], 10));
  await settle();
  const ff = byId(await ST(), 'f');
  ok('D a free point dropped on a crossing becomes the meet point', ff.def && ff.def.op === 'meet' && Math.abs(ff.p[0] - 1) < 1e-12 && Math.abs(ff.p[1] - 1.5) < 1e-12, ff);
  ok('D the attach cue at the drop', (await cues()).includes('attach'), await cues());
  // a drop on z₀ (q): the warn ring during the drag, not merged
  const F2 = await W(-2.2, -1.2), Q = await W(-1, -1.5);
  let warn = null;
  await mdrag(line(F2, [Q[0] + 2, Q[1] + 1], 10), { beforeUp: async () => { await settle(30); const d = await DBG(); warn = d.ring && { chip: d.ring.chip, warn: d.ring.warn }; } });
  await settle();
  const f2b = byId(await ST(), 'f2');
  info.D3 = { warn, f2b };
  ok('D over z₀: the warn ring "… is already here"', warn && warn.warn && /is already here$/.test(warn.chip), warn);
  ok('D dropped on z₀: not merged (free, beside it)', !f2b.def && !f2b.at && !(f2b.p[0] === -1 && f2b.p[1] === -1.5), f2b);
  // ⋯ Put on this curve on the shown unit circle (a display curve): its fixed shape and the point on it, one undo step
  await load(NS + 'dm', U0({ shapes: [{ id: 'u', kind: 'point', p: [Math.cos(0.9), Math.sin(0.9)], ci: 4, visible: true }], nextId: 40 }));
  await settle(900);
  await tool('select');
  const m0 = (await ST()).n, U = await W(Math.cos(0.9), Math.sin(0.9));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: U[0], y: U[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: U[0], y: U[1], button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: U[0], y: U[1], button: 'right', buttons: 0, clickCount: 1 });
  await settle(300);
  const mi = await ev(`(() => { const b = [...document.querySelectorAll('.ctx-menu .mi')].find((e) => e.textContent.trim().startsWith('Put on this curve')); if (b) b.click(); return [...document.querySelectorAll('.ctx-menu .mi')].map((e) => e.textContent.trim()); })()`);
  await settle(300);
  const sm = await ST(), uu = byId(sm, 'u'), uc = sm.list.find((x) => x.fixed === 'unit');
  info.Dmenu = { mi, uu, uc: uc && uc.id, n: sm.n, m0 };
  ok('D ⋯ Put on this curve on the unit circle: the point on it, the fixed unit circle made, one undo step', uu.def && uu.def.op === 'glider' && uc && uu.def.args[0].s === uc.id && Math.abs(Math.hypot(uu.p[0], uu.p[1]) - 1) < 1e-15 && sm.n === m0 + 1, info.Dmenu);
});

// ---------------------------------------------------------------- E
await section('E', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'e', U0());
  await settle(900);
  await tool('perp');
  const pick = async (deg) => { const p = await A(deg); await move(p[0], p[1]); await settle(60); await click(p[0], p[1]); await settle(150); };
  await pick(200);
  await pick(100); await pick(150);
  await pick(250); await pick(300);
  let st = await ST();
  const Ks = st.list.filter((x) => x.def && x.def.op === 'perp'), Us = st.list.filter((x) => x.fixed === 'unit');
  const toast = await ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()).join(' | ')`);
  info.E1 = { list: st.list.map((x) => [x.id, x.kind, x.def && x.def.op, x.fixed, x.t]), toast };
  ok('E Orthogonal: two picks on the unit circle, twice: both circles made, one unit circle', Ks.length === 2 && Us.length === 1 && !/distinct/.test(toast), info.E1);
  const orth = (K) => { const dc = Math.hypot(K.c[0], K.c[1]); return Math.abs((dc * dc - K.r * K.r - 1) / (2 * K.r)); };
  for (const K of Ks) {
    const P = byId(st, K.def.args[1].s), Q = byId(st, K.def.args[2].s);
    ok('E ' + K.id + ': through its two points on C, orthogonal to C', P.def.op === 'glider' && Q.def.op === 'glider' && orth(K) < 1e-12 && Math.abs(Math.hypot(P.p[0] - K.c[0], P.p[1] - K.c[1]) - K.r) < 1e-12 && Math.abs(Math.hypot(Q.p[0] - K.c[0], Q.p[1] - K.c[1]) - K.r) < 1e-12, { K, P: P.p, Q: Q.p });
  }
  await SHOT('after-laptop-perp-two-on-one');
  // opposite picks at the detents: the diameter
  await pick(30); await pick(210);
  st = await ST();
  const K3 = last(st);
  ok('E opposite picks (30°, 210°): the diameter (A = 0, through 0)', K3.def && K3.def.op === 'perp' && K3.A === 0 && K3.kind === 'line', { kind: K3.kind, A: K3.A, a: K3.a, b: K3.b });
  // a press on the first pick: the warn ring and "needs distinct points"
  await pick(60);
  const p60 = await A(60);
  await move(p60[0] + 2, p60[1]); await settle(80);
  const d = await DBG();
  ok('E hover on the first pick: the warn ring "… needs distinct points"', d.ring && d.ring.warn && /needs distinct points$/.test(d.ring.chip), d.ring);
  await SHOT('after-laptop-distinct-warn');
  const nb = (await ST()).list.length;
  await click(p60[0] + 2, p60[1]); await settle(150);
  ok('E a press on the first pick: refused (no new shape)', (await ST()).list.length === nb, nb);
  await key('Escape'); await key('Escape'); await settle(100);
  // 3 points on one circle: accepted, the circle itself
  await tool('circle3');
  await pick(20); await pick(75); await pick(130);
  st = await ST();
  const K4 = last(st);
  ok('E 3 points with three picks on one circle: accepted, equals C', K4.def && K4.def.op === 'circle3' && Math.abs(K4.r - 1) < 1e-12 && Math.abs(K4.c[0]) < 1e-12 && Math.abs(K4.c[1]) < 1e-12, K4);
  // 3 points through three different crossings
  await load(NS + 'e2', U0({ unit: false, shapes: [{ id: 'La', kind: 'line', a: [-3, 0.5], b: [3, 0.5], ci: 1, visible: true }, { id: 'Lb', kind: 'line', a: [0.3, -3], b: [0.3, 3], ci: 2, visible: true }, Object.assign({}, C1, { id: 'Cc' })], nextId: 30 }));
  await settle(900);
  await tool('circle3');
  const X1 = await W(0.3, 0.5), X2 = await W(Math.sqrt(0.75), 0.5), X3 = await W(0.3, Math.sqrt(1 - 0.09));
  for (const X of [X1, X2, X3]) { await move(X[0] + 1, X[1] + 1); await settle(40); await click(X[0] + 1, X[1] + 1); await settle(150); }
  st = await ST();
  const K5 = last(st), ms = st.list.filter((x) => x.def && x.def.op === 'meet');
  ok('E 3 points through three different crossings: accepted', K5.def && K5.def.op === 'circle3' && ms.length === 3 && !K5.cundef, { K5: K5.def, ms: ms.length });
});

// ---------------------------------------------------------------- Eph (the user's case on the phone: real taps)
await section('Eph', async () => {
  await view(412, 860, false, true);
  // a drawn circle (Circle 1, c = −2.5i, r = 0.8, clear of the unit circle and the real axis) and the shown unit circle
  const Cd = { id: 'Cd', kind: 'circle', c: [0, -2.5], r: 0.8, ci: 0, visible: true };
  await load(NS + 'eph', U0({ shapes: [Cd], nextId: 40 }));
  await settle(1000);
  await tool('perp');
  const sp = await scale();
  // taps 5 px off the curve (a finger is never exact)
  const tpick = async (deg, r = 1, c = [0, 0]) => { const p = await A(deg, r + 5 / sp, c); await tap(p[0], p[1]); await settle(200); };
  const toastNow = () => ev(`[...document.querySelectorAll('#toastHost .toast')].map((t) => t.textContent.trim()).join(' | ')`);
  // C = Circle 1, then two places on Circle 1
  // (the picks clear of the imaginary axis: a tap within 22 px of where it crosses Circle 1 is that crossing)
  await tpick(0, 0.8, Cd.c); await tpick(140, 0.8, Cd.c); await tpick(40, 0.8, Cd.c);
  let st = await ST();
  let Ks = st.list.filter((x) => x.def && x.def.op === 'perp');
  const t1 = await toastNow();
  info.Eph1 = { list: st.list.map((x) => [x.id, x.kind, x.def && x.def.op, x.def && x.def.args && x.def.args[0] && x.def.args[0].s]), toast: t1 };
  ok('Eph phone: C = Circle 1, two taps on Circle 1: the circle is made (no "needs distinct points")', Ks.length === 1 && !/distinct/.test(t1), info.Eph1);
  const orthTo = (K, C) => { const dc = Math.hypot(K.c[0] - C.c[0], K.c[1] - C.c[1]); return Math.abs((dc * dc - K.r * K.r - C.r * C.r) / (2 * K.r * C.r)); };
  if (Ks[0] && Ks[0].c) {
    const P = byId(st, Ks[0].def.args[1].s), Q = byId(st, Ks[0].def.args[2].s);
    ok('Eph its two points are points on Circle 1, the circle orthogonal to Circle 1 through both', P.def && P.def.op === 'glider' && P.def.args[0].s === 'Cd' && Q.def && Q.def.op === 'glider' && Q.def.args[0].s === 'Cd' && orthTo(Ks[0], Cd) < 1e-12, { K: Ks[0], P, Q });
  }
  // the shown unit circle, then two places on it (it becomes the fixed shape "unit" at the finish); the tool keeps its C,
  // so two more taps on it make the second circle (picks at the 15° detents, clear of the axes)
  await load(NS + 'eph2', U0({ nextId: 60 }));
  await settle(1000);
  await tool('perp');
  await tpick(200); await tpick(120); await tpick(150);
  await tpick(240); await tpick(300);
  st = await ST();
  Ks = st.list.filter((x) => x.def && x.def.op === 'perp');
  const t2 = await toastNow();
  info.Eph2 = { n: Ks.length, units: st.list.filter((x) => x.fixed === 'unit').length, toast: t2, list: st.list.map((x) => [x.id, x.kind, x.def && x.def.op, x.fixed, x.def && x.def.args && x.def.args.map((a) => a.s).join(',')]) };
  const U = st.list.find((x) => x.fixed === 'unit');
  ok('Eph phone: two taps on the unit circle, twice: both circles made on it, one unit circle', Ks.length === 2 && info.Eph2.units === 1 && Ks.every((K) => K.def.args[0].s === U.id && K.def.args.slice(1).every((a) => { const P = byId(st, a.s); return P.def && P.def.op === 'glider' && P.def.args[0].s === U.id; })) && !/distinct/.test(t2), info.Eph2);
  for (const K of Ks) ok('Eph ' + K.id + ' orthogonal to the unit circle', orthTo(K, { c: [0, 0], r: 1 }) < 1e-12, K);
  await SHOT('after-phone-perp-two-on-one');
});

// ---------------------------------------------------------------- F
await section('F', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'f', U0({ unit: false, srcView: { cx: 0, cy: 0, s: 52 } }));
  await settle(900);
  await tool('point');
  const s = await scale();
  info.Fs = s;
  const G = await W(0.5, 1);
  await move(G[0] + 6, G[1]); await settle(80);
  info.Fchip = await chipOf();
  ok('F hover 6 px from 0.5 + i: "grid point 0.5 + i"', info.Fchip === 'grid point 0.5 + i', info.Fchip);
  await SHOT('after-laptop-grid-ring');
  await click(G[0] + 6, G[1]); await settle();
  let p = last(await ST());
  ok('F the Point tool at 52 px per unit: exactly 0.5 + 1i', s === 52 && p.p[0] === 0.5 && p.p[1] === 1, { s, p: p.p });
  // 520 px per unit: 0.55 + 1.05i
  await load(NS + 'f2', U0({ unit: false, srcView: { cx: 0.5, cy: 1, s: 520 } }));
  await settle(900);
  await tool('point');
  const G2 = await W(0.55, 1.05);
  await click(G2[0] + 6, G2[1] - 3); await settle();
  p = last(await ST());
  ok('F at 520 px per unit: exactly 0.55 + 1.05i', p && p.p[0] === 0.55 && p.p[1] === 1.05, p && p.p);
  // a free point dragged near 2.5 + 1.5i; a disc moved by its body; Alt-move raw
  await load(NS + 'f3', U0({ unit: false, shapes: [{ id: 'z', kind: 'point', p: [1.73, 1.62], ci: 0, visible: true }, { id: 'D', kind: 'disc', c: [-2.13, -1.07], r: 0.6, ci: 1, visible: true }], nextId: 30 }));
  await settle(900);
  await tool('select');
  const s3 = await scale();
  const Z0 = await W(1.73, 1.62), Z1 = await W(2.5, 1.5);
  await mdrag(line(Z0, [Z1[0] + 3, Z1[1] + 2], 10)); await settle();
  p = byId(await ST(), 'z');
  ok('F a free point dragged 3 px from 2.5 + 1.5i: exactly 2.5 + 1.5i', p.p[0] === 2.5 && p.p[1] === 1.5, p.p);
  const n0 = (await ST()).n;
  const D0 = await W(-2.13 + 0.3, -1.07), Dc = await W(-1, -1);
  // (the press 0.3 right of the centre: the anchor is the centre, its want = the pointer − 0.3)
  await mdrag(line(D0, [Dc[0] + 0.3 * s3 + 4, Dc[1] + 3], 12)); await settle();
  let D = byId(await ST(), 'D');
  ok('F a disc moved by its body: its centre lands on the lattice (−1 − i)', D.c[0] === -1 && D.c[1] === -1, D.c);
  ok('F one undo step for the move', (await ST()).n === n0 + 1, (await ST()).n);
  const Dd = await W(-1 + 0.3, -1);
  await mdrag(line(Dd, [Dd[0] + 27, Dd[1] + 1], 8), { mods: 1 }); await settle();
  D = byId(await ST(), 'D');
  ok('F Alt-move: raw (off the lattice)', Math.abs(D.c[0] - (-1 + 27 / s3)) < 0.002 && Math.abs(D.c[1] - (-1 - 1 / s3)) < 0.002, { c: D.c, s3 });
});

// ---------------------------------------------------------------- G
await section('G', async () => {
  await view(1366, 768, false, false);
  const L1 = { id: 'L1', kind: 'line', a: [-3, 1.5], b: [3, 1.5], ci: 2, visible: true };
  await load(NS + 'g', U0({ unit: false, shapes: [C1, gl('g', 0), L1], nextId: 30 }));
  await settle(900);
  await tool('select');
  const P0 = await A(0);
  await mdrag(line(P0, [P0[0] + 6, P0[1] - 4], 2), { mods: 1, noUp: true });
  await settle(30);
  let d = await DBG(), g = byId(await ST(), 'g');
  ok('G Alt-drag of a point on a curve: free from the first move, no stretch', !g.def && !(d.rail && d.rail.stretch), { g, rail: d.rail });
  const onL = await W(1.3, 1.5);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: onL[0], y: onL[1] + 2, button: 'left', buttons: 1, modifiers: 1 });
  await sleep(30);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: onL[0], y: onL[1] + 2, button: 'left', clickCount: 1, modifiers: 1 });
  await settle();
  g = byId(await ST(), 'g');
  ok('G Alt held at the drop over Line 1: stays free', !g.def && Math.abs(g.p[1] - 1.5) > 1e-3, g);
});

// ---------------------------------------------------------------- I
await section('I', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'iru', U0());
  await nav(`${U}?ns=${NS}iru&lang=ru`); await settle(1500);
  await tool('point');
  const s = await scale();
  const p = await A(37, 1 + 3 / s);
  await move(p[0], p[1]); await settle(100);
  const c1 = await chipOf();
  ok('I RU: «привязка: единичная окружность»', c1 === 'привязка: единичная окружность', c1);
  await SHOT('after-ru-hover-unit');
  const G = await W(0.5, 1);
  await move(G[0] + 5, G[1]); await settle(80);
  const c2 = await chipOf();
  ok('I RU: «узел сетки 0,5 + i»', c2 === 'узел сетки 0,5 + i', c2);
  await click(p[0], p[1]); await settle();
  await tool('select');
  const g = last(await ST());
  const P = await W(g.p[0], g.p[1]);
  await mdrag(line(P, [P[0] + 90, P[1]], 3), { noUp: true });
  await settle(30);
  const fc = (await DBG()).freeChip;
  ok('I RU: «Точка z₁ отвязана»', /^Точка z.+ отвязана$/.test(fc || ''), fc);
  await SHOT('after-ru-freed');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: P[0] + 90, y: P[1], button: 'left', clickCount: 1 });
  await settle();
  // dark: the stretch line and the detent chip
  await view(1366, 768, true, false);
  await load(NS + 'idk', U0({ shapes: [C1, gl('g', 0)], nextId: 30 }));
  await settle(900);
  await tool('select');
  const Q = await A(0);
  await mdrag((await arc(0, 90, 6)), { noUp: true });
  await settle(30);
  const c3 = await chipOf();
  ok('I the detent chip "on Circle 1 at 90°"... at i on a circle that is a shape: its name and the place', /^on .+ at (i|90°)$/.test(c3 || ''), c3);
  await SHOT('after-dark-detent-chip');
  const Pi = await A(90);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Pi[0], y: Pi[1] - 28, button: 'left', buttons: 1 });
  await settle(30);
  await SHOT('after-dark-stretch');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Pi[0], y: Pi[1] - 28, button: 'left', clickCount: 1 });
  await settle();
  // the phone: the chip 48 px above the finger, inside the pane; nothing at rest
  await view(412, 860, false, true);
  await load(NS + 'iph', U0({ shapes: [C1, gl('g', 0.25)], nextId: 30 }));
  await settle(1000);
  await tool('select');
  const T0 = await A(90);
  const tp = await arc(90, 120, 5);
  await tdrag(tp, { noUp: true });
  await settle(30);
  const d = await DBG();
  const fin = tp[tp.length - 1], rect = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`);
  info.Ichip = { chip: d.chipRect, fin, rect };
  const cr = d.chipRect;
  ok('I phone: the chip about 48 px above the finger and inside the pane', cr && Math.abs((cr.y + cr.h / 2) - (cr.at[1] - 48)) <= 2 && cr.x >= 4 && cr.y >= 4 && cr.x + cr.w <= cr.pw - 4 + 1 && cr.y + cr.h <= cr.ph - 4 + 1, info.Ichip);
  await SHOT('after-phone-slide-chip');
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(1400);
  const rest = await DBG();
  ok('I at rest: no ring, no rail, no chip', !rest.ring && !rest.rail && !rest.freeChip, { ring: rest.ring, rail: rest.rail, fc: rest.freeChip });
});

// ---------------------------------------------------------------- J
await section('J', async () => {
  await view(1366, 768, false, false);
  const perfOnce = async (k) => {
    const shapes = [C1, gl('g', 0.1)];
    for (let i = 0; i < 10; i++) {
      const a = (i + 0.5) / 10 * 2 * Math.PI, R = 1.4 + 0.5 * (i % 3);
      shapes.push({ id: 'q' + i, kind: 'point', p: [R * Math.cos(a), R * Math.sin(a)], ci: 2, visible: true });
      shapes.push({ id: 'k' + i, kind: i % 2 ? 'circle' : 'disc', c: [0, 0], r: 1, ci: i % 8, visible: true, def: { op: 'perp', args: [{ s: 'C', part: 0 }, { s: 'g' }, { s: 'q' + i }], fill: i % 2 ? 'none' : 'in' } });
    }
    await load(NS + 'j' + k, U0({ shapes, steps: [{ type: 'recip', params: {}, on: true }], nextId: 500 }));
    await settle(1500);
    await tool('select');
    await ev(`(()=>{ window.__frw = []; window.__frd = []; window.__pm = []; let lastT = 0;
      if (!window.__rafWrapped) { window.__rafWrapped = true; const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => raf((ts) => { const t0 = performance.now(); cb(ts); if (window.__frw) window.__frw.push(performance.now() - t0); }); }
      const tick = (ts) => { if (!window.__frd) return; if (lastT) window.__frd.push(ts - lastT); lastT = ts; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      let t0 = 0; window.addEventListener('pointermove', () => { t0 = performance.now(); }, true); window.addEventListener('pointermove', () => { if (window.__pm) window.__pm.push(performance.now() - t0); });
      return 1; })()`);
    await mdrag(await arc(36, 300, 6), { dt: 16 });
    await settle(200);
    return ev(`(()=>{ const q = (a, p) => { const b = (a || []).slice().sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(2) : null; };
      const r = { work_p95: q(__frw, 0.95), delta_p95: q(__frd, 0.95), move_p95: q(__pm, 0.95), n: (__frd || []).length };
      window.__frw = null; window.__frd = null; window.__pm = null; return r; })()`);
  };
  const r1 = await perfOnce(1), r2 = await perfOnce(2);
  const r = Object.assign({}, (r1.work_p95 + r1.delta_p95 <= r2.work_p95 + r2.delta_p95) ? r1 : r2);
  r.runs = [[r1.work_p95, r1.delta_p95, r1.move_p95], [r2.work_p95, r2.delta_p95, r2.move_p95]];
  info.perf = r;
  const st = await ST(), g = byId(st, 'g');
  ok('J the glider moved round and its 10 circles followed', g.def && g.t > 0.7 && st.list.filter((x) => x.def && x.def.op === 'perp').every((k) => !k.cundef), g.t);
  ok('J BUDGET60: rAF work p95 ≤ 14 ms', r.work_p95 != null && r.work_p95 <= 14, r);
  ok('J BUDGET60: pointermove p95 ≤ 14 ms', r.move_p95 != null && r.move_p95 <= 14, r);
  ok('J BUDGET60: frame delta p95 ≤ 16.8 ms', r.delta_p95 != null && r.delta_p95 <= 16.8, r);
});

// ---------------------------------------------------------------- K (the sphere: a point on a curve slides on the globe; a pull frees it)
await section('K', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'k', U0({ unit: false, shapes: [Object.assign({}, C1, { r: 0.8 }), gl('g', 0.1)], nextId: 30 }));
  await settle(900);
  await ev(`__cmwSetView('L', 'sphere'), 1`); await settle(1200);
  await tool('select');
  const GS = (re, im) => ev(`(() => { const P = Region.Globe.lift(${re}, ${im}); return __cmwCI({ gs: ['L', P] }); })()`);
  const pt = (deg) => GS(0.8 * Math.cos(deg * Math.PI / 180), 0.8 * Math.sin(deg * Math.PI / 180));
  let g = byId(await ST(), 'g');
  const path = []; for (let a = 36; a <= 120; a += 6) path.push(await pt(a));
  const n0 = (await ST()).n;
  await mdrag(path, { dt: 24 }); await settle(300);
  g = byId(await ST(), 'g');
  info.K1 = { t: g.t, p: g.p, def: g.def, n0, n: (await ST()).n };
  ok('K on the globe: the point slides on its circle (still on it, t moved to about 120°)', g.def && g.def.op === 'glider' && Math.abs(Math.hypot(g.p[0], g.p[1]) - 0.8) < 1e-12 && Math.abs(g.t * 360 - 120) < 4, info.K1);
  ok('K one undo step', (await ST()).n === n0 + 1, info.K1);
  // a pull: about 100 px off the rail on the screen (outward, across the circle's image), held 200 ms
  const P = await pt(120), Po = await GS(1.6 * Math.cos(2 * Math.PI / 3), 1.6 * Math.sin(2 * Math.PI / 3));
  const ul = Math.hypot(Po[0] - P[0], Po[1] - P[1]), u = [(Po[0] - P[0]) / ul, (Po[1] - P[1]) / ul];
  const at = (k) => [P[0] + u[0] * k, P[1] + u[1] * k];
  await mdrag([P, at(50), at(100)], { hold: 220, beforeUp: async () => { const q = at(101); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: q[0], y: q[1], button: 'left', buttons: 1 }); await sleep(30); } });
  await settle(300);
  g = byId(await ST(), 'g');
  ok('K a pull on the globe frees it', !g.def && Math.abs(Math.hypot(g.p[0], g.p[1]) - 0.8) > 0.05, g);
  await SHOT('after-globe-pulled');
  // (SPEC 1.2 (c)) the Point tool on the drawn circle on the globe, 3 px off it: a point on it, one undo step; away from
  // every curve: a free point
  await tool('point');
  const n1 = (await ST()).n, Q = await pt(70), Qo = await GS(1.2 * Math.cos(70 * Math.PI / 180), 1.2 * Math.sin(70 * Math.PI / 180));
  const ql = Math.hypot(Qo[0] - Q[0], Qo[1] - Q[1]);
  await click(Q[0] + 3 * (Qo[0] - Q[0]) / ql, Q[1] + 3 * (Qo[1] - Q[1]) / ql); await settle(300);
  let st = await ST(); const k2 = last(st);
  info.K2 = { k2, n1, n: st.n };
  ok('K the Point tool on the globe: a point on the drawn circle (|p| = 0.8), one undo step', k2.kind === 'point' && k2.def && k2.def.op === 'glider' && k2.def.args[0].s === 'C' && Math.abs(Math.hypot(k2.p[0], k2.p[1]) - 0.8) < 1e-12 && st.n === n1 + 1, info.K2);
  await click(Q[0] + 3 * (Qo[0] - Q[0]) / ql + 1, Q[1] + 3 * (Qo[1] - Q[1]) / ql + 1); await settle(700);
  ok('K a double press places no second point', (await ST()).list.length === st.list.length, (await ST()).list.length);
  const F2 = await GS(0.45 * Math.cos(70 * Math.PI / 180), 0.45 * Math.sin(70 * Math.PI / 180));
  await click(F2[0], F2[1]); await settle(300);
  st = await ST(); const k3 = last(st);
  ok('K away from the circle on the globe: a free point', k3.kind === 'point' && !k3.def && k3.id !== k2.id, k3);
  await SHOT('after-globe-point-on-circle');
  // (SPEC 1.3) the lifted lattice snaps on the drawn tiers, halves included: a segment started 4 px from a lattice point
  await tool('segment');
  const zz = [0.3, 0.45], e3 = 1e-3, Z0 = await GS(zz[0], zz[1]), Zx = await GS(zz[0] + e3, zz[1]), Zy = await GS(zz[0], zz[1] + e3);
  const lsc = Math.min(Math.hypot(Zx[0] - Z0[0], Zx[1] - Z0[1]), Math.hypot(Zy[0] - Z0[0], Zy[1] - Z0[1])) / e3;
  const stp = await ev(`Constr.gridStep(${lsc})`), gx = +(Math.round(zz[0] / stp) * stp).toPrecision(12), gy = +(Math.round(zz[1] / stp) * stp).toPrecision(12);
  const G0 = await GS(gx, gy), G1 = await GS(gx + 0.25, gy - 0.15);
  await mdrag(line([G0[0] + 3, G0[1] + 2], G1, 8)); await settle(300);
  const sg = last(await ST());
  info.Klat = { lsc, stp, half: !Number.isInteger(Math.log10(stp)), g: [gx, gy], a: sg.a, kind: sg.kind };
  ok('K the globe lattice: the segment starts exactly on the lattice point of the drawn tier', sg.kind === 'segment' && sg.a[0] === gx && sg.a[1] === gy, info.Klat);
});

// ---------------------------------------------------------------- H (last: in headless Chrome a two-finger touch sequence
// leaves the next page without touch events, so nothing runs after it)
await section('H', async () => {
  await view(1366, 768, false, false);
  await load(NS + 'h', U0({ shapes: [C1, gl('g', 0)], nextId: 30 }));
  await settle(900);
  await tool('select');
  const n0 = (await ST()).n;
  await mdrag(await arc(0, 40, 5), { noUp: true });
  await key('Escape'); await settle(100);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 10, y: 10, button: 'left', clickCount: 1 });
  await settle();
  let g = byId(await ST(), 'g');
  ok('H Esc during a slide: back at the press (t = 0), no undo step', g.def && g.t === 0 && (await ST()).n === n0, { g, n: (await ST()).n, n0 });
  // pulled off, then Esc: back on the circle
  const P0 = await A(0);
  await mdrag(line(P0, [P0[0] + 100, P0[1]], 4), { noUp: true });
  await settle(30);
  await key('Escape'); await settle(100);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 10, y: 10, button: 'left', clickCount: 1 });
  g = byId(await ST(), 'g');
  ok('H Esc after a pull: the point is back on its circle, no step', g.def && g.def.op === 'glider' && g.t === 0 && (await ST()).n === n0, g);
  // a second finger during a slide: back at the press
  await view(412, 860, false, true);
  await load(NS + 'hph', U0({ shapes: [C1, gl('g', 0)], nextId: 30 }));
  await settle(1000);
  await tool('select');
  const m0 = (await ST()).n;
  const pp = await arc(0, 40, 5);
  await tdrag(pp, { noUp: true });
  const o2 = await W(-1.5, -1.5);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pp[pp.length - 1][0], y: pp[pp.length - 1][1], id: 1 }, { x: o2[0], y: o2[1], id: 2 }] });
  await sleep(40);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle();
  g = byId(await ST(), 'g');
  ok('H a second finger during a slide: back at the press, no step', g.def && g.t === 0 && (await ST()).n === m0, { g, n: (await ST()).n, m0 });
  // after the two fingers: a tap on the empty plane, then one finger slides the point again
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: o2[0], y: o2[1], id: 1 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(200);
  await tdrag(await arc(0, 30, 5)); await settle(200);
  g = byId(await ST(), 'g');
  ok('H after the two fingers, one finger slides the point again', g.def && Math.abs(g.t * 360 - 30) < 1, g.t * 360);
});

ok('no exceptions or console errors', errs.length === 0, errs.slice(0, 5));
return { checks, failed: fails.length, fails, info };

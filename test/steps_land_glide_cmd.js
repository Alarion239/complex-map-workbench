// The steps view's Landscape between two planes (#846): plane a's surface carried by the glide's map, each point at its
// height and colour on plane a, which at u = 1 is plane b's surface. The default page (z, exp, Möbius) on the
// Landscape:
// - parked at u = 0.25, 0.5, 0.75 between z and w₁: carried frames (__cmwLandCarry), each unlike both planes at rest
//   and each nearer its neighbour on the thread than the two planes are to each other (the picture moves on); the
//   block's width changes by under 3 % between u = 0.45 and 0.55, where the parked view's nearer plane changes;
// - held by either end (a scrub on the rail, not let go, at u = 0.005 and 0.995): carried frames that are the planes at
//   rest there, within the exact-image tolerance (at most 2 % of the pane's pixels more than 32/255 apart: the rest
//   frame's refined walls and cut rims are not drawn while moving);
// - a glide (svGo), its clock stepped by fifths of its length, draws carried frames at three or more places between
//   the planes;
// - under reduced motion a glide is a change of plane at once, and play ticks one plane at a time: no carried frame.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// the left pane's pixels, kept in the page under tag
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'); window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; return [cv.width, cv.height]; })()`);
// the share of pixels of a more than 32/255 apart from b in a channel
const diff = (a, b) => ev(`(() => { const A = window.__ss[${JSON.stringify(a)}], B = window.__ss[${JSON.stringify(b)}]; if (!A || !B || A.length !== B.length) return null; let n = 0, n32 = 0; for (let i = 0; i < A.length; i += 4) { n++; const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d > 32) n32++; } return +(n32 / n).toFixed(4); })()`);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landglide${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 60000 });
ok('the Landscape is shown on plane z', (await ev('__cmwLandCarry === undefined ? "none" : __cmwLandCarry()')) === null, await ev('typeof __cmwLandCarry'));
await rest(1); await grab('rest1');
await rest(0); await grab('rest0');
info.planes = await diff('rest0', 'rest1');
// ---- parked between z and w₁ ----
const between = {};
for (const x of [0.25, 0.5, 0.75]) {
  await rest(0);
  await park(x);
  const c = await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)');
  const cc = c ? JSON.parse(c) : null;
  ok(`parked at ${x}: a carried frame of plane z at u = ${x}`, !!cc && cc.s === 0 && Math.abs(cc.u - x) < 1e-6, c);
  await grab('x' + x);
  between[x] = { from0: await diff('x' + x, 'rest0'), from1: await diff('x' + x, 'rest1') };
  ok(`parked at ${x}: unlike both planes at rest`, between[x].from0 > 0.01 && between[x].from1 > 0.01, between[x]);
}
// (the block goes from z's to w₁'s with u: no step where the parked view's nearer plane changes, at u = 0.5)
const boxAt = async (x) => { await rest(0); await park(x); const c = await ev('typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null'); return c && c.box ? c.box.x1 - c.box.x0 : null; };
const w45 = await boxAt(0.45), w55 = await boxAt(0.55);
info.boxW = { w45, w55 };
ok('the block moves on smoothly across u = 0.5 (width within 3 % between 0.45 and 0.55)', w45 > 0 && w55 > 0 && Math.abs(Math.log(w55 / w45)) < 0.03, info.boxW);
between.d1 = await diff('x0.25', 'x0.5'); between.d2 = await diff('x0.5', 'x0.75');
info.between = between;
ok('the frames move on: each nearer its neighbour than the planes are to each other', between.d1 < info.planes && between.d2 < info.planes, between);
// ---- by the ends: the thread held at x mid-scrub (not let go: a parked view snaps to a plane within 1/8 of it) ----
info.ends = {};
for (const [x, tag, restTag] of [[0.005, 'h0', 'rest0'], [0.995, 'h1', 'rest1']]) {
  await rest(0);
  { const h = await hold(x); ok(`the thread is held at ${x}`, h.ok, h); }
  await ev(rAF2);
  const c = await ev('typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null');
  await grab(tag);
  info.ends[tag] = { u: c ? c.u : null, d: await diff(tag, restTag) };
  await ev('window.__svScrubUp(), 1');
  await settled({ max: 60000 });
  ok(`held at ${x}: a carried frame`, !!c && Math.abs(c.u - x) < 0.002, c);
  ok(`held at ${x}: the plane at rest there (≤ 2 % of pixels > 32/255)`, info.ends[tag].d != null && info.ends[tag].d <= 0.02, info.ends[tag]);
}
// ---- a glide ----
await rest(0);
// (the glide's clock, performance.now, held and stepped by a fifth of its length: the frames it draws do not depend
// on the machine's frame rate)
await ev(`(() => { const now = performance.now.bind(performance); window.__clk = now(); window.__realNow = now; performance.now = () => window.__clk; __cmwSteps({ go: 1 }); return 1; })()`);
await ev(rAF2);
const anim = await ev('JSON.stringify(__cmwSteps().anim)');
const A = anim ? JSON.parse(anim) : null;
const us = [];
for (let k = 1; A && k <= 4; k++) {
  await ev(`window.__clk = ${A.t0 + (A.ms * k) / 5}; 1`);
  // (awaited in the page: a promise that is the expression's value comes back unawaited (H.ev's REPL mode), so the
  // clock would step on before the glide drew a frame at it)
  await ev(`await ${rAF2}; 1`);
  const c = await ev('typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null');
  if (c && c.u > 0 && c.u < 1 && !us.includes(c.u.toFixed(3))) us.push(c.u.toFixed(3));
}
await ev('performance.now = window.__realNow; 1');
await settled({ max: 60000 });
info.glide = us.length;
ok('a glide draws carried frames at three or more places', us.length >= 3, { us, anim });
// ---- reduced motion ----
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await rest(1);
await ev('__cmwSteps({ go: 0 }); 1');
ok('reduced motion: a glide changes plane at once', (await ev('__cmwSvX()')) === 0, await ev('__cmwSvX()'));
await ev(`window.__lg = null; new Promise((done) => {
  const xs = [];
  __cmwSteps({ play: true });
  const t0 = performance.now();
  const tick = () => {
    xs.push(__cmwSvX());
    if (typeof __cmwLandCarry !== 'function' || __cmwLandCarry()) xs.push('carry');
    if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else done(xs);
  };
  requestAnimationFrame(tick);
}).then((v) => { window.__lg = v; }), 1`);
await settled({ max: 30000, panes: false, until: 'window.__lg !== null' });
const ticks = (await ev('window.__lg')) || ['none'];
info.reducedTicks = [...new Set(ticks)];
ok('reduced motion: play ticks one plane at a time, no carried frame', ticks.every((x) => Number.isInteger(x)) && new Set(ticks).size >= 2, info.reducedTicks);
await send('Emulation.setEmulatedMedia', { features: [] });
return { pass: fails.length === 0, fails, info };

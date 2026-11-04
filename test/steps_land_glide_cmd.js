// The steps view's Landscape between two planes (#846): plane a's surface carried by the glide's map, each point at its
// height and colour on plane a, which at u = 1 is plane b's surface. The default page (z, exp, Möbius) on the
// Landscape:
// - parked at u = 0.25, 0.5, 0.75 between z and w₁: carried frames (__cmwLandCarry), each unlike both planes at rest
//   and each nearer its neighbour on the thread than the two planes are to each other (the picture moves on); the
//   block's width changes by under 3 % between u = 0.45 and 0.55, where the parked view's nearer plane changes;
// - a glide (svGo) draws carried frames at three or more places between the planes, and its first and last frames
//   (u ≤ 0.1, ≥ 0.9) are the planes at rest, within the exact-image tolerance (at most 2 %
//   of the pane's pixels more than 32/255 apart: the rest frame's refined walls and cut rims are not drawn while
//   moving);
// - under reduced motion a glide is a change of plane at once, and play ticks one plane at a time: no carried frame.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
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
// ---- by the ends ----
// ---- a glide ----
await rest(0);
await ev(`window.__lg = null; new Promise((done) => {
  const seen = new Set();
  __cmwSteps({ go: 1 });
  const t0 = performance.now();
  const tick = () => {
    const c = typeof __cmwLandCarry === 'function' ? __cmwLandCarry() : null;
    if (c && c.u > 0 && c.u < 1) {
      seen.add(c.u.toFixed(3));
      // (the frame on the canvas is the one c describes: the first and the last of the glide kept)
      const cv = document.getElementById('canvasL'), px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      if (!window.__ss.g0) { window.__ss.g0 = px; window.__g0u = c.u; }
      window.__ss.g1 = px; window.__g1u = c.u;
    }
    if (performance.now() - t0 < 6000 && __cmwSteps().moving !== false) requestAnimationFrame(tick); else done([...seen]);
  };
  requestAnimationFrame(tick);
}).then((v) => { window.__lg = v; }), 1`);
await settled({ max: 30000, panes: false, until: 'window.__lg !== null' });
const us = (await ev('window.__lg')) || [];
info.glide = us.length;
ok('a glide draws carried frames at three or more places', us.length >= 3, us);
// (the glide's first and last frames against the planes at rest, by how far from them they are: u ≤ 0.1 within 2 %)
info.ends = { u0: await ev('window.__g0u'), e0: await diff('g0', 'rest0'), u1: await ev('window.__g1u'), e1: await diff('g1', 'rest1') };
ok('by plane z: the plane at rest (≤ 2 % of pixels > 32/255)', info.ends.u0 <= 0.1 && info.ends.e0 != null && info.ends.e0 <= 0.02, info.ends);
ok('by plane w₁: the plane at rest (≤ 2 % of pixels > 32/255)', info.ends.u1 >= 0.9 && info.ends.e1 != null && info.ends.e1 <= 0.02, info.ends);
await settled({ max: 60000 });
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

// The steps view's Landscape from the colour plane T to the plane after it: the carried surface
// flattens into plane T+1's flat view. The default page (z, exp, Möbius), colour plane w₁, Everywhere:
// - plane w₂ at rest is the same picture on the Landscape surface as on the Plane surface (both draw X → Y with the
//   colour carried from w₁ over the whole plane, at most 2 % of the pane's pixels more than 32/255 apart);
// - parked at u = 0.25, 0.5 and 0.75 between w₁ and w₂: the pane has X → Y's layout, and each frame is a carried frame
//   of plane w₁ flattened by u (__cmwLandCarry's flat), each farther from w₁ at rest than the one before (compared
//   where the two canvases overlap on the page);
// - held at u = 0.0002 and 0.9998 (the rail's place set, not let go): the frame against w₁ and w₂ at rest, where the
//   canvases overlap on the page, within the moving frames' tolerance (at most 0.5 % of pixels more than 32/255 apart), Inside
//   regions and Everywhere;
// - a glide back from w₂ to w₁ draws flattened carried frames at three or more places on its way;
// - under reduced motion the glide from w₁ to w₂ changes plane at once: no flattened frame.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
// the left pane's pixels and where its canvas is on the page (device px), kept in the page under tag
const grab = (tag) => ev(`(() => { const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), k = cv.width / r.width; window.__ss = window.__ss || {}; window.__ss[${JSON.stringify(tag)}] = { d: cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, x: Math.round(r.left * k), y: Math.round(r.top * k), w: cv.width, h: cv.height }; return [cv.width, cv.height]; })()`);
// the share of pixels more than 32/255 apart in a channel, over the part of the page both canvases cover
const diff = (a, b) => ev(`(() => { const A = window.__ss[${JSON.stringify(a)}], B = window.__ss[${JSON.stringify(b)}]; if (!A || !B) return null; const x0 = Math.max(A.x, B.x), y0 = Math.max(A.y, B.y), x1 = Math.min(A.x + A.w, B.x + B.w), y1 = Math.min(A.y + A.h, B.y + B.h); let n = 0, n32 = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = ((y - A.y) * A.w + x - A.x) * 4, j = ((y - B.y) * B.w + x - B.x) * 4; n++; if (Math.max(Math.abs(A.d[i] - B.d[j]), Math.abs(A.d[i + 1] - B.d[j + 1]), Math.abs(A.d[i + 2] - B.d[j + 2])) > 32) n32++; } return n ? +(n32 / n).toFixed(4) : null; })()`);
// held on the rail at x: its place set and the frame drawn, as a press that has not let go
const hold = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const carried = async () => { const c = await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)'); return c ? JSON.parse(c) : null; };
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landflat${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
// ---- plane w₂ at rest: the Plane surface's picture ----
await ev(`__cmwSteps({ scope: 'all', surf: 'plane', T: 1, go: 2, now: true }); 1`);
await settled({ max: 60000 });
await ev(rAF2);
await grab('plane2');
await ev(`__cmwSteps({ surf: 'land' }); 1`);
await rest(2);
await grab('land2');
info.rest2 = await diff('land2', 'plane2');
ok('plane w₂ at rest: the same on the Landscape surface as on the Plane (≤ 2 % of pixels > 32/255)', info.rest2 != null && info.rest2 <= 0.02, info.rest2);
// ---- parked between w₁ and w₂ ----
info.parked = {};
let last = null;
await rest(1);
await grab('land1');
for (const x of [1.25, 1.5, 1.75]) {
  await rest(1);
  await park(x);
  const c = await carried(), main = await ev('__cmwSteps().main');
  await grab('x' + x);
  const d = await diff('x' + x, 'land1');
  info.parked[x] = { main, flat: c && c.flat, d };
  ok(`parked at ${x}: X → Y's layout, plane w₁'s surface flattened by ${(x - 1).toFixed(2)}`, main === 'xy' && !!c && c.s === 1 && Math.abs(c.flat - (x - 1)) < 1e-6, info.parked[x]);
  ok(`parked at ${x}: farther from w₁ at rest than the frame before`, d != null && (last == null || d > last), { d, last });
  last = d;
}
// ---- the ends, held: against the rest frames ----
info.ends = {};
for (const scope of ['in', 'all']) {
  await ev(`__cmwSteps({ scope: '${scope}' }); 1`);
  await rest(1);
  await grab('e1');
  await hold(1.0002);
  await grab('h1');
  await rest(2);
  await grab('e2');
  await rest(1);
  await hold(1.9998);
  await grab('h2');
  const d0 = await diff('h1', 'e1'), d1 = await diff('h2', 'e2');
  info.ends[scope] = { start: d0, end: d1 };
  ok(`${scope}: held at u = 0.0002, the frame is w₁'s at rest (≤ 0.5 % of pixels > 32/255)`, d0 != null && d0 <= 0.005, d0);
  ok(`${scope}: held at u = 0.9998, the frame is w₂'s at rest (≤ 0.5 % of pixels > 32/255)`, d1 != null && d1 <= 0.005, d1);
}
await ev(`__cmwSteps({ scope: 'all' }); 1`);
// ---- a glide back from w₂ to w₁ ----
await rest(2);
await ev(`window.__lf = null; new Promise((done) => {
  const seen = new Set();
  __cmwSteps({ go: 1 });
  const t0 = performance.now();
  const tick = () => {
    const c = typeof __cmwLandCarry === 'function' ? __cmwLandCarry() : null;
    if (c && c.flat > 0 && c.flat < 1) seen.add(c.flat.toFixed(3));
    if (performance.now() - t0 < 6000 && __cmwSteps().moving !== false) requestAnimationFrame(tick); else done([...seen]);
  };
  requestAnimationFrame(tick);
}).then((v) => { window.__lf = v; }), 1`);
await settled({ max: 30000, panes: false, until: 'window.__lf !== null' });
const back = (await ev('window.__lf')) || [];
info.back = back.length;
ok('a glide back from w₂ to w₁ draws flattened carried frames at three or more places', back.length >= 3, back);
await settled({ max: 60000 });
// ---- reduced motion ----
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await rest(1);
await ev(`window.__lf = null; new Promise((done) => {
  const seen = [];
  __cmwSteps({ go: 2 });
  const t0 = performance.now();
  const tick = () => {
    const c = typeof __cmwLandCarry === 'function' ? __cmwLandCarry() : null;
    seen.push([__cmwSvX(), !!(c && c.flat > 0)]);
    if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else done(seen);
  };
  requestAnimationFrame(tick);
}).then((v) => { window.__lf = v; }), 1`);
await settled({ max: 30000, panes: false, until: 'window.__lf !== null' });
const rm = (await ev('window.__lf')) || [[null, true]];
ok('reduced motion: w₁ to w₂ changes plane at once, with no flattened frame', rm.every(([x, f]) => x === 2 && !f), rm.slice(0, 4));
await send('Emulation.setEmulatedMedia', { features: [] });
return { pass: fails.length === 0, fails, info };

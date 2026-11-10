// The steps view's Landscape frame between two planes has the box (and, through the same views, the height scale) of the shared camera and u, never of the
// history of the page (#1475). Roots as preimages, sheets off, the glide from plane 0 to plane 1 held at BOX_U. A page that has parked at plane 0 and plane 1
// (the long-lived page) and a page loaded afresh and never parked past plane 0 (the fresh page) draw the same frame at each u:
// - row 1: the box (half-widths and centre) is the same on both pages at every u of BOX_U;
// - row 2: the fresh page at 1 - 1e-4 has the parked plane 1's box (no jump on arrival);
// - row 3: the height scale, read as the frame's height-axis labels (__cmwLandTicks: they sit where the scale puts them), is the same on both pages at every
//   u;
// - the parked planes' boxes are the camera's at rest (PARKED_HALF: the values the parked frames drew before the glide's views were changed, read at the base)
//   and the same on both pages;
// - control 1: on one page, the camera zoomed through the app's zoom at plane 0 scales the box at every u by the camera's own change (s before over s after), so
//   a box frozen at any constant fails;
// - control 2: on the long-lived page the mirror's view (V.left) multiplied by LEFT_CTL while parked at plane 0 does not change the box at any u (a box that
//   reads the mirror fails).
// Every read waits for the scene to be ready and settled. A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard
// (ci/browser_shards.js). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORTS = /localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8'));
if (!PORTS) throw new Error('steps_land_box: the daemon\'s port is not in cdpd.js');
const PORT = PORTS[1];
const BOX_U = [0.25, 0.5, 1 - 1e-4];
const BOX_TOL = 1e-9;   // (relative to the box's width: the same arithmetic on both pages)
const PARKED_HALF = [4.8111, 3.7889], PARKED_TOL = 1e-4;   // (the parked planes' half-width and half-height at 1440 x 900, read at the base)
const TICK_TOL = 1e-6;   // (CSS pixels)
const LEFT_CTL = 3, ZOOM_FACTOR = 2;
const SETTLE_MS = 60000;
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EXAMPLE = names.indexOf('Roots as preimages');
if (EXAMPLE < 0) throw new Error('steps_land_box: the example Roots as preimages is not in the guide');
await view(1440, 900, false, false);
const ready = async () => { await settled({ max: SETTLE_MS, until: '__cmwSteps().ready.ready' }); await ev(rAF2); };
const loadPage = async () => {
  await go(`http://localhost:${PORT}/test.html?ns=landbox${Date.now()}&view=steps`);
  await settled({ max: SETTLE_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
  await ev(`__cmwExample(${EXAMPLE}); 1`); await settled({ max: SETTLE_MS });
  await ev(`__cmwSet('alpha', 1), __cmwSet('height', 'im'), __cmwSet('sheets', false), 1`);
  await ready();
};
const rest = async (i) => { await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${i}, now: true, clock: 0 }); 1`); await settled({ max: SETTLE_MS }); await ready(); };
const setU = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: SETTLE_MS }); await ready(); };
const read = async () => { await ready(); return ev(`(() => { const b = __cmwLandCarry(true); return { box: b && { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }, ticks: __cmwLandTicks() }; })()`); };
const same = (a, b) => !!a && !!b && ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(a[k] - b[k]) <= BOX_TOL * (b.x1 - b.x0));
const scaled = (a, b, f) => !!a && !!b && ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(a[k] - b[k] * f) <= BOX_TOL * (b.x1 - b.x0));
const sameTicks = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length > 0 && a.length === b.length && a.every((t, i) => Math.abs(t - b[i]) <= TICK_TOL);
const half = (b) => b && [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2].map((v) => +v.toPrecision(6));
// the app's own zoom (the wheel's function) of the plane the camera is, run while the steps view shows the plane, then the Landscape again
const flat = async (f) => { await ev(`__cmwSteps({ surf: 'plane' }); 1`); await ready(); await f(); await ev(`__cmwSteps({ surf: 'land' }); 1`); await ready(); };
const wheel = (f) => flat(() => ev(`__cmwLandViews({ zoom: ${f} }); 1`));

// the long-lived page: parked at plane 0 and plane 1, then back at plane 0
await loadPage();
await rest(0); const longP0 = await read();
await rest(1); const longP1 = await read();
await rest(0);
const long = {};
for (const u of BOX_U) { await setU(u); long[u] = await read(); }
// control 2: the mirror's view multiplied while parked at plane 0
await rest(0);
const views0 = await ev('__cmwLandViews()');
await ev(`__cmwLandViews({ leftScale: ${LEFT_CTL} }); 1`);
const mirrored = {};
for (const u of BOX_U) { await setU(u); mirrored[u] = await read(); }

// the fresh page
await loadPage();
await rest(0); const freshP0 = await read();
const fresh = {};
for (const u of BOX_U) { await setU(u); fresh[u] = await read(); }
await rest(1); const freshP1 = await read();
ok('the parked plane 0 has the same box on the fresh and the long-lived page', same(freshP0.box, longP0.box), { fresh: half(freshP0.box), long: half(longP0.box) });
ok('the parked plane 1 has the same box on the fresh and the long-lived page', same(freshP1.box, longP1.box), { fresh: half(freshP1.box), long: half(longP1.box) });
for (const [name, p] of [['plane 0', freshP0], ['plane 1', freshP1]]) {
  const h = half(p.box);
  ok(`the parked ${name}'s box is the camera's at rest (half-widths ${PARKED_HALF})`, h && Math.abs(h[0] - PARKED_HALF[0]) <= PARKED_TOL && Math.abs(h[1] - PARKED_HALF[1]) <= PARKED_TOL, { half: h });
}
for (const u of BOX_U) {
  ok(`row 1: u = ${u}: the glide's box is the same on the fresh and the long-lived page`, same(fresh[u].box, long[u].box), { fresh: half(fresh[u].box), long: half(long[u].box) });
  ok(`row 3: u = ${u}: the glide's height scale (its axis labels) is the same on the fresh and the long-lived page`, sameTicks(fresh[u].ticks, long[u].ticks), { fresh: fresh[u].ticks, long: long[u].ticks });
  ok(`control 2: u = ${u}: the long-lived page's box does not follow the mirror's view (x${LEFT_CTL})`, same(mirrored[u].box, long[u].box), { mirrored: half(mirrored[u].box), long: half(long[u].box), views0 });
}
ok(`row 2: the fresh page's box at u = ${BOX_U[2]} is the parked plane 1's (no jump on arrival)`, same(fresh[BOX_U[2]].box, freshP1.box), { glide: half(fresh[BOX_U[2]].box), parked: half(freshP1.box) });

// control 1: the camera zoomed by the wheel at plane 0, on this page
await rest(0);
const s0 = (await ev('__cmwLandViews()')).src.s;
await wheel(ZOOM_FACTOR); await ready();
const s1 = (await ev('__cmwLandViews()')).src.s;
ok(`control 1: the wheel zooms the camera (${s0} to ${s1})`, s1 > s0 * 1.5, { s0, s1 });
for (const u of BOX_U) {
  await setU(u);
  const z = await read();
  ok(`control 1: u = ${u}: the zoomed glide's box is the same page's unzoomed one scaled by the camera's change (${s0} / ${s1})`, scaled(z.box, fresh[u].box, s0 / s1), { zoomed: half(z.box), unzoomed: half(fresh[u].box) });
}
return { pass: !fails.length, fails, info };

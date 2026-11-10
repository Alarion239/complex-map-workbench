// The steps view's Landscape frame between two planes has the box (and, as it is read from the same views, the height scale) of the shared camera and u, never of the history of the page
// (#1475). Roots as preimages, sheets off, the glide from plane 0 to plane 1 held at BOX_U. A page that has parked at plane 0 and plane 1 (the long-lived
// page) and a page loaded afresh and never parked past plane 0 (the fresh page) draw the same box at each u:
// - row 1: the box (half-widths and centre) is the same on both pages at every u of BOX_U;
// - row 2: the fresh page at 1 - 1e-4 has the parked plane 1's box (no jump on arrival);
// - the parked planes' boxes are the same on both pages (the parked frames are the reference and have no history);
// - control 1: with the shared camera zoomed by ZOOM_CTL before the glide the box at every u is 1 / ZOOM_CTL of the box without (a box frozen at any constant fails);
// - control 2: on the long-lived page the mirror's view (V.left) multiplied by LEFT_CTL while parked at plane 0 does not change the box at any u (a box
//   that reads the mirror fails).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BOX_U = [0.25, 0.5, 1 - 1e-4];
const BOX_TOL = 1e-9;   // (relative to the box's width: the same arithmetic on both pages)
const ZOOM_CTL = 2, LEFT_CTL = 3;
const SETTLE_MS = 60000;
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EXAMPLE = names.indexOf('Roots as preimages');
await view(1440, 900, false, false);
const loadPage = async () => {
  await go(`http://localhost:${PORT}/test.html?ns=landbox${Date.now()}&view=steps`);
  await settled({ max: SETTLE_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
  await ev(`__cmwExample(${EXAMPLE}); 1`); await settled({ max: SETTLE_MS });
  await ev(`__cmwSet('alpha', 1), __cmwSet('height', 'im'), __cmwSet('sheets', false), 1`);
  await settled({ max: SETTLE_MS, until: '__cmwSteps().ready.ready' });
};
const rest = async (i) => { await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${i}, now: true, clock: 0 }); 1`); await settled({ max: SETTLE_MS }); await ev(rAF2); };
const setU = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: SETTLE_MS }); await ev(rAF2); };
const read = () => ev(`(() => { const b = __cmwLandCarry(true); return { box: b && { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 } }; })()`);
const same = (a, b) => !!a && !!b && ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(a[k] - b[k]) <= BOX_TOL * (b.x1 - b.x0));
const scaled = (a, b, f) => !!a && !!b && ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(a[k] - b[k] * f) <= BOX_TOL * (b.x1 - b.x0));
const half = (b) => b && [b.x1 - b.x0, b.y1 - b.y0].map((v) => +v.toPrecision(6));

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
for (const u of BOX_U) {
  ok(`row 1: u = ${u}: the glide's box is the same on the fresh and the long-lived page`, same(fresh[u].box, long[u].box), { fresh: half(fresh[u].box), long: half(long[u].box) });
  ok(`control 2: u = ${u}: the long-lived page's box does not follow the mirror's view (x${LEFT_CTL})`, same(mirrored[u].box, long[u].box), { mirrored: half(mirrored[u].box), long: half(long[u].box), views0 });
}
ok(`row 2: the fresh page's box at u = ${BOX_U[2]} is the parked plane 1's (no jump on arrival)`, same(fresh[BOX_U[2]].box, freshP1.box), { glide: half(fresh[BOX_U[2]].box), parked: half(freshP1.box) });

// control 1: the shared camera zoomed before the glide
await loadPage();
await rest(0);
await ev(`__cmwLandViews({ srcScale: ${ZOOM_CTL} }); 1`);
for (const u of BOX_U) {
  await setU(u);
  const z = await read();
  ok(`control 1: u = ${u}: with the camera zoomed by ${ZOOM_CTL} the glide's box is 1/${ZOOM_CTL} of the unzoomed one`, scaled(z.box, fresh[u].box, 1 / ZOOM_CTL) || scaled(z.box, long[u].box, 1 / ZOOM_CTL), { zoomed: half(z.box), fresh: half(fresh[u].box), long: half(long[u].box) });
}
return { pass: !fails.length, fails, info };

// H.settled's `faces` option (test/cdp_kit/cdpd.js): the wait also ends only when the page's font faces have landed, document.fonts
// saying it is loaded, with the layout flushed first (a face is requested when its text is laid out).
//   - with the faces still loading, the wait does not end before they land: it answers ok at about the time they land;
//   - with the faces never landing, it runs out at its bound and answers not ok;
//   - without the option, the same page answers at once (the option is what waits);
//   - the layout is read before the faces' state: the faces' state is read after document.body.offsetHeight.
// The faces' state is stood in for by a getter on document.fonts, so the check does not depend on the network. A command file for a CDP
// daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const LAND_MS = 700, SHORT_MAX_MS = 1200, LONG_MAX_MS = 8000, EARLY_MS = 300;
await go(`http://localhost:${PORT}/test.html`);
await ev(`(() => { window.__fs = 'loading'; Object.defineProperty(document.fonts, 'status', { get() { return window.__fs; }, configurable: true }); return 1; })()`);
// (they land LAND_MS from now)
await ev(`setTimeout(() => { window.__fs = 'loaded'; }, ${LAND_MS}); 1`);
const t0 = Date.now();
const landed = await settled({ faces: true, only: true, max: LONG_MAX_MS, poll: 50 });
const ms = Date.now() - t0;
info.landed = { ok: landed.ok, ms };
ok('faces: the wait ends when the faces land, not before', landed.ok && ms >= LAND_MS - EARLY_MS, info.landed);
ok('faces: the wait ends soon after they land', ms < LAND_MS + 3000, info.landed);
// (the faces never land)
await ev(`window.__fs = 'loading'; 1`);
const never = await settled({ faces: true, only: true, max: SHORT_MAX_MS, poll: 50 });
info.never = { ok: never.ok };
ok('faces: faces that never land run the wait out at its bound, and it answers not ok', never.ok === false, info.never);
// (control: the same page, the faces loading, without the option)
const t1 = Date.now();
const without = await settled({ only: true, max: LONG_MAX_MS });
info.without = { ok: without.ok, ms: Date.now() - t1 };
ok('control: without the option the wait does not ask for the faces', without.ok && Date.now() - t1 < LAND_MS, info.without);
// (the layout is flushed before the faces are read)
await ev(`window.__order = []; (() => { const h = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'); Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get() { window.__order.push('layout'); return h.get.call(this); }, configurable: true }); Object.defineProperty(document.fonts, 'status', { get() { window.__order.push('faces'); return 'loaded'; }, configurable: true }); return 1; })()`);
await settled({ faces: true, only: true, max: LONG_MAX_MS });
const order = await ev(`window.__order.join(',')`);
info.order = order.slice(0, 80);
ok('faces: the layout is read just before the faces\' state', /^layout,faces/.test(order), info.order);
return { pass: fails.length === 0, fails, info };

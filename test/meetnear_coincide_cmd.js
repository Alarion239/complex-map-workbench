// Issue #269: a curve lying exactly on a display curve (a freehand curve along |z| = 1, the Mountain King's laps) is not
// a crossing of that curve: the press on it offers the curve's own menu, not "Mark the intersection"; a genuine crossing
// with it (here a second circle through 1/2 ± 0.866i) is still one. In the real app, with real pointer events.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 300) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const W = (re, im, side = 'L') => ev(`__cmwW2S('${side}', ${re}, ${im})`);
// (a freehand curve, as the Mountain King's: two laps of |z| = 1, drawn as a polyline, a traced piece)
const LAPS = Array.from({ length: 401 }, (_, i) => [Math.cos(i * Math.PI / 100), Math.sin(i * Math.PI / 100)]);
const STATE = {
  shapes: [
    { id: 's1', kind: 'curve', pts: LAPS, ci: 0, visible: true },
    { id: 's2', kind: 'circle', c: [0, 0], r: 0.4, ci: 1, visible: true },
    { id: 's3', kind: 'circle', c: [0.4, 0], r: 0.4, ci: 2, visible: true },
  ],
  steps: [{ type: 'zp', params: { a: '1', zeros: '1+0.5i', poles: '' }, on: true }],
  srcView: { cx: 0, cy: 0, s: 120 }, nextId: 50, pattern: 'checker',
};
const NS = 'mn' + (Date.now() % 1000000);
// (snapAt takes pane-local pixels; the page positions come from __cmwW2S)
const snap = (x, y) => ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); const t = Construct.snapAt('L', ${x} - r.left, ${y} - r.top, { points: true, cross: true, curves: true, disp: true, touch: true }); return t ? { cls: t.cls, ref: t.ref || null } : null; })()`);
const menuAt = async (x, y, touch) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  await settle(300);
  const m = await ev(`[...document.querySelectorAll('.ctx-menu .mi')].map((b) => b.textContent.trim())`);
  await key('Escape'); await settle(150);
  return m;
};
await view(1440, 900, false, false);
await load(NS, STATE);
await settle(800);
// on s1 at 40 degrees: away from 1, i, -1, -i and from s2
const a = 40 * Math.PI / 180, p = await W(Math.cos(a), Math.sin(a));
const t1 = await snap(p[0], p[1]);
info.onCircle = t1;
ok('a press on a curve drawn on the unit circle is the curve, not a crossing', !!t1 && t1.cls === 'curve', t1);
// further up the circle (away from 1, i, -1, -i)
for (const deg of [125, 150, 55]) {
  const r = deg * Math.PI / 180, q = await W(Math.cos(r), Math.sin(r));
  const t = await snap(q[0], q[1]);
  ok(`a press on the curve at ${deg} degrees is the curve`, !!t && t.cls === 'curve', t);
}
// the drawn curve is what the press is near (not only the display circle)
const dr = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); const q = __cmwW2S('L', Math.cos(0.7), Math.sin(0.7)); const t = Construct.snapAt('L', q[0] - r.left, q[1] - r.top, { points: false, cross: false, curves: true }); return t ? { cls: t.cls, s: t.ref && t.ref.s } : null; })()`);
ok('the drawn curve is found there', !!dr && dr.s === 's1', dr);
// a genuine crossing of two other drawn circles is still a crossing, with its menu item
const c = await W(0.2, Math.sqrt(0.12)), t2 = await snap(c[0], c[1]);
info.cross = t2;
ok('a genuine crossing of two drawn circles is still a crossing', !!t2 && t2.cls === 'cross', t2);
// (the menus last: a right press leaves the pane in another state)
const m1 = await menuAt(p[0], p[1]);
info.menuOn = m1;
ok('its menu has no "Mark the intersection"', !m1.some((x) => /Mark the intersection/.test(x)), m1);
const m2 = await menuAt(c[0] + 1, c[1] + 1);
ok('its menu offers "Mark the intersection"', m2.some((x) => /Mark the intersection/.test(x)), m2);
const e = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors', !e.length, e.slice(0, 3));
return { pass: !fails.length, fails, info };

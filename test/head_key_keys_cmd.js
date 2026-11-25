// The key in a pane's head (the steps view's Height key #leftLegend) is operated from the keyboard: it is in the focus order, a
// button with aria-expanded, its panel (the key's picture) opens when it takes keyboard focus, Enter or Space keeps it open and a second
// press closes it, Escape closes it with the focus staying on the key, and the mouse's way (hover opens it, a click keeps it open) is as
// it was. With real key events and a real pointer, at 1280 x 800 and 900 x 700. A command file for a CDP daemon (test/cdp_kit README);
// prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const TABS = 80, SETTLE_MAX = 4000;
let ID = 'leftLegend';   // (the key under test: the steps view's Height key)
// the key, as the page and a person see it: its role, its place in the focus order, aria-expanded, whether it has the focus and whether its panel (the
// canvas under it) is shown
const state = () => ev(`(() => { const k = document.getElementById('${ID}'), c = k.querySelector('canvas');
  return { role: k.getAttribute('role'), tab: k.tabIndex, expanded: k.getAttribute('aria-expanded'), focused: document.activeElement === k, shown: !!c && getComputedStyle(c).display !== 'none', cls: k.className, label: k.getAttribute('aria-label') }; })()`);
const reach = async () => {
  await ev(`document.activeElement && document.activeElement.blur(); 1`);
  for (let i = 0; i < TABS; i++) { await key('Tab'); if ((await ev('document.activeElement.id')) === ID) return i + 1; }
  return 0;
};
// (focus events, and so :focus-visible, reach a page only while it has focus: a headless page is made to, until the rows end)
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
const SEED = { steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], shapes: [{ kind: 'disc', c: [0, 0], r: 1, id: 's1' }], sv: { at: 0, T: 1, scope: 'all', surf: 'land' } };
// (standards-ok: the classic view's Regions key, in Y's head, goes with Y's pane, which the classic view does not draw, #994;
// the Height key is read at both sizes the Regions key was)
const CASES = [{ w: 1280, h: 800, id: 'leftLegend', steps: true }, { w: 900, h: 700, id: 'leftLegend', steps: true }];
for (const { w, h, id, steps } of CASES) {
  ID = id;
  const tag = `${steps ? 'steps ' : ''}${w}×${h}`;
  await view(w, h, false, false);
  const ns = `hkk${w}${Date.now() % 100000}`;
  if (steps) await seed(ns, SEED);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: 30000, until: `!!document.getElementById('${ID}') && !document.getElementById('${ID}').hidden && !!document.getElementById('${ID}').closest('.pane-head') && document.getElementById('${ID}').getClientRects().length > 0` });
  const rest = await state();
  ok(`${tag}: the key in the head is a button in the focus order, closed (aria-expanded false)`, rest.role === 'button' && rest.tab === 0 && rest.expanded === 'false' && !rest.shown, rest);
  const n = await reach();
  ok(`${tag}: Tab reaches the key`, n > 0, n);
  if (!n) continue;
  const foc = await state();
  ok(`${tag}: its panel opens when it takes the focus (shown, aria-expanded true)`, foc.focused && foc.shown && foc.expanded === 'true', foc);
  await key('Escape');
  await settled({ max: SETTLE_MAX, panes: false, only: true, until: `getComputedStyle(document.querySelector('#${ID} canvas')).display === 'none'` });
  const esc = await state();
  ok(`${tag}: Escape closes the panel, the focus stays on the key`, esc.focused && !esc.shown && esc.expanded === 'false', esc);
  await key('Enter');
  await settled({ max: SETTLE_MAX, panes: false, only: true, until: `getComputedStyle(document.querySelector('#${ID} canvas')).display !== 'none'` });
  const ent = await state();
  ok(`${tag}: Enter keeps it open (the class open, aria-expanded true)`, ent.focused && ent.shown && ent.expanded === 'true' && /\bopen\b/.test(ent.cls), ent);
  await key('Enter');
  await settled({ max: SETTLE_MAX, panes: false, only: true, until: `getComputedStyle(document.querySelector('#${ID} canvas')).display === 'none'` });
  const ent2 = await state();
  ok(`${tag}: a second Enter closes it`, ent2.focused && !ent2.shown && ent2.expanded === 'false' && !/\bopen\b/.test(ent2.cls), ent2);
  await key(' ');
  await settled({ max: SETTLE_MAX, panes: false, only: true, until: `getComputedStyle(document.querySelector('#${ID} canvas')).display !== 'none'` });
  const sp = await state();
  ok(`${tag}: Space keeps it open as Enter does`, sp.focused && sp.shown && sp.expanded === 'true', sp);
  await key('Escape');
  await settled({ max: SETTLE_MAX, panes: false, only: true, until: `getComputedStyle(document.querySelector('#${ID} canvas')).display === 'none'` });
  ok(`${tag}: Escape closes a panel that was kept open`, !(await state()).shown, await state());
  // the mouse: the pointer opens the panel and, away from it, it closes; a click keeps it open
  await ev(`document.activeElement.blur(); 1`);
  const r = await ev(`(() => { const b = document.getElementById('${ID}').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  const hov = await settled({ max: SETTLE_MAX, panes: false, only: true, until: `getComputedStyle(document.querySelector('#${ID} canvas')).display !== 'none'` });
  ok(`${tag}: pointing at the key shows its panel`, hov.ok, await state());
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  const kept = await settled({ max: SETTLE_MAX, panes: false, only: true, until: `/\\bopen\\b/.test(document.getElementById('${ID}').className)` });
  const away = await state();
  ok(`${tag}: a click keeps the panel open with the pointer away`, kept.ok && away.shown, away);
  info[tag] = { rest, foc, esc, ent, ent2, sp, away };
}
await send('Emulation.setFocusEmulationEnabled', { enabled: false });
return { pass: fails.length === 0, fails, info };

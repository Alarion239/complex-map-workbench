// A menu item's accessible name is its label, not its icon doubled: the plane menu's closed-curve item on the residue example's
// circle has the icon ∮ (a text glyph in the item's `mi-ic` span) and a label that starts with the same glyph, and a screen reader
// said "∮∮ F dz around Circle 1". The icon is decoration (aria-hidden), so the name is the label alone, in en, ru and it. Read
// through the accessibility tree, for every item of the menu: each is named by its label, never with its icon read before it
// (∮ ∮ F dz, ℂ New complex number), and none loses its name; the closed-curve item's name starts with ∮ once. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const flat = (t) => t.replace(/\s+/g, ' ').trim();
const CLICK_MS = 5000;   // how long a right-click may take to open its menu, ms
// the accessible name of the element number `i` of `sel`, from the accessibility tree
const nameOf = async (sel, i) => {
  const { root } = await send('DOM.getDocument', { depth: 0 });
  const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel });
  const nodeId = nodeIds[i];
  if (!nodeId) return null;
  const { nodes } = await send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
  const n = nodes && nodes[0];
  return n && !n.ignored && n.name ? n.name.value : '';
};
const rclick = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 0, clickCount: 1 });
  return settled({ max: CLICK_MS, until: `!!document.querySelector('#popHost .pop.menu.pm')` });
};
await view(1280, 800, false, false);
const EXAMPLE_AT = exampleNames().indexOf('A residue by integration');   // the example's place in the page's list
for (const lang of ['en', 'ru', 'it']) {
  await go(`http://localhost:${PORT}/test.html?ns=mname${lang}${Date.now() % 100000}&lang=${lang}`);
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && !!window.__cmwPlaneMenu' });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false); return 1; })()`);
  ok(`${lang}: the example is found`, EXAMPLE_AT >= 0, EXAMPLE_AT);
  if (EXAMPLE_AT < 0) continue;
  await ev(`__cmwExample(${EXAMPLE_AT}); 1`);
  await settled({ max: 20000 });
  // the circle |z - i| = 1: its rightmost point
  const [x, y] = await ev(`__cmwPlaneMenu().w2s('L', 1, 1)`);
  const w = await rclick(x, y);
  ok(`${lang}: a right-click on the circle opens the plane menu`, w.ok, w);
  if (!w.ok) continue;
  const items = await ev(`[...document.querySelectorAll('#popHost .pop.menu.pm .mi')].map((b) => ({ ic: (b.querySelector('.mi-ic') || {}).textContent || '', label: (b.querySelector('.mi-label') || {}).textContent || '', pm: b.dataset.pm }))`);
  info[lang] = { items: [] };
  for (let i = 0; i < items.length; i++) {
    const name = await nameOf('#popHost .pop.menu.pm .mi', i), it = items[i];
    info[lang].items.push({ ...it, name });
    ok(`${lang}: the item "${it.label.slice(0, 40)}" has a name`, !!name, { it, name });
    if (it.ic.trim() && name) ok(`${lang}: the item "${it.label.slice(0, 40)}" is named by its label: the icon ${it.ic.trim()} is not read before it`, name.startsWith(flat(it.label)), { it, name });
  }
  const loop = items.findIndex((it) => it.label.startsWith('∮'));
  ok(`${lang}: the menu has the closed curve's ∮ item`, loop >= 0, items);
  if (loop >= 0) {
    const name = info[lang].items[loop].name;
    ok(`${lang}: the ∮ item's name starts with ∮ once`, name.startsWith('∮') && !name.startsWith('∮∮') && !name.startsWith('∮ ∮'), name);
  }
  await key('Escape');
}
return { pass: fails.length === 0, fails, info };

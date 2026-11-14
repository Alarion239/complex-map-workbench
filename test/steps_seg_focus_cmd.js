// The steps view's segmented controls keep the keyboard focus when they change (#1613): the Landscape's Height group (the arrows
// and a click), and the Phase style group on a plane; after each change document.activeElement is the checked
// radio of the same group, not the page body. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=segfocus${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
const press = async (key, code) => { const p = { key, code: key, windowsVirtualKeyCode: code }; await send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); };
// where the focus is: the group it is in and whether that radio is the checked one
const where = () => ev(`(() => { const a = document.activeElement, g = a && a.closest && a.closest('[role="radiogroup"]'); return { tag: a && a.tagName, group: g ? g.id : null, v: a && a.dataset ? a.dataset.v : null, checked: !!a && a.getAttribute('aria-checked') === 'true' }; })()`);
const settle = async () => { await settled({ max: 8000, only: true }); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const LEG = async (name, id, plane) => {
  await ev(`__cmwSteps(${JSON.stringify(plane)}); 1`);
  await settled({ max: 60000 });
  const n = await ev(`document.querySelectorAll('#${id} [role="radio"]').length`);
  ok(`${name}: the group is on the page with its radios`, n >= 3, n);
  if (n < 3) return;
  await ev(`(document.querySelector('#${id} [role="radio"][aria-checked="true"]') || document.querySelector('#${id} [role="radio"]')).focus(), 1`);
  const w0 = await where();
  ok(`${name}: the checked radio takes the focus`, w0.group === id && w0.checked, w0);
  for (let i = 0; i < 2; i++) {
    await press('ArrowRight', 39); await settle();
    const w = await where();
    ok(`${name}: after → (${i + 1}) the focus is on the checked radio of the group`, w.group === id && w.checked, w);
  }
  // a click on a segment other than the checked one
  const v = await ev(`(() => { const r = [...document.querySelectorAll('#${id} [role="radio"]')].find((b) => b.getAttribute('aria-checked') !== 'true'); const b = r.getBoundingClientRect(); return { v: r.dataset.v, x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await click(v.x, v.y); await settle();
  const w = await where();
  ok(`${name}: after a click on ${v.v} the focus is on the checked radio of the group`, w.group === id && w.checked && w.v === v.v, w);
};
await LEG('Landscape Height', 'heightSeg', { scope: 'all', surf: 'land', go: 0, now: true });
await LEG('Phase style', 'dcSeg', { scope: 'all', surf: 'plane', go: 0, now: true });
return { pass: fails.length === 0, fails, info };

// The steps view's menu buttons say whether their menu is open (ARIA's menu button): aria-expanded is "false" at rest, "true"
// while the menu is open, and "false" again after each way out of it: Escape, a choice, a press outside. Over the Scope and
// Surface buttons of the steps head and the Speed button of the Playback row. A command file for a CDP
// daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await view(1024, 768, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=menuexp${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!document.querySelector(".sv-surf1")' });
const state = (sel) => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); return { exp: b && b.getAttribute('aria-expanded'), menu: !!document.querySelector('#popHost .pop.menu') }; })()`);
const centre = (sel) => ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
// (armOutside listens for the press outside from a timer started when the menu opens: one frame and a timer later it is listening)
const open = async (sel) => { const [x, y] = await centre(sel); await click(x, y); await settled({ max: 8000, only: true, until: `!!document.querySelector('#popHost .pop.menu')` }); await ev('new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))'); };
const closed = async () => { await settled({ max: 8000, only: true, until: `!document.querySelector('#popHost .pop.menu')` }); };
// (the Scope button shows once the scope is Inside regions)
await ev(`__cmwSteps({ scope: 'in' }); 1`);
await settled({ max: 8000, only: true, until: `!!document.querySelector('.sv-scope-menu') && document.querySelector('.sv-scope-menu').getClientRects().length > 0` });
const SELS = ['.sv-scope-menu', '.sv-surf1', '.sv-speed'];
info.buttons = await ev(`[...document.querySelectorAll('button[aria-haspopup="menu"]')].filter((b) => b.getClientRects().length).map((b) => b.className.split(' ').slice(-1)[0])`);
for (const sel of SELS) {
  const here = await ev(`!!document.querySelector(${JSON.stringify(sel)}) && document.querySelector(${JSON.stringify(sel)}).getClientRects().length > 0`);
  ok(`${sel} is on the page`, here, here);
  if (!here) continue;
  ok(`${sel} at rest: aria-expanded is false`, (await state(sel)).exp === 'false', await state(sel));
  await open(sel);
  ok(`${sel} with its menu open: aria-expanded is true`, (await state(sel)).exp === 'true', await state(sel));
  await key('Escape'); await closed();
  ok(`${sel} after Escape: aria-expanded is false`, (await state(sel)).exp === 'false', await state(sel));
  await open(sel);
  await key('Enter'); await closed();
  ok(`${sel} after a choice: aria-expanded is false`, (await state(sel)).exp === 'false', await state(sel));
  // a press outside, at an empty part of the tools panel, clear of the menu, its button and the pad (the page closes a menu on a capture-phase pointerdown, which the kit's click sends)
  await open(sel);
  const [ox, oy] = await ev(`(() => { const r = document.querySelector('#leftPanel').getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 12]; })()`);
  info['outside ' + sel] = await ev(`(() => { const e = document.elementFromPoint(${ox}, ${oy}); const m = document.querySelector('#popHost .pop.menu'); return { at: e && (e.id || e.className || e.tagName), inMenu: !!m && !!e && m.contains(e) }; })()`);
  await click(ox, oy); await closed();
  ok(`${sel} after a press outside: aria-expanded is false`, (await state(sel)).exp === 'false', await state(sel));
}
return { pass: fails.length === 0, fails, info };

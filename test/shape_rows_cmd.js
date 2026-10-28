// Shapes list rows (issue #38, UX43): two lines (the name, then the set in rendered maths), a half-plane without a unit
// normal said in words, tooltips in the spoken text (never raw LaTeX), and Rename: the row's ⋯ menu and a second click on
// the name (a laptop) make the name a field; Enter keeps it, Esc leaves it, an empty name restores the automatic one;
// a name lives in the shape (saved and undone with it). A command file for a CDP daemon (test/cdp_kit).
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const ROWS = `[...document.querySelectorAll('#shapeList .shape')].map((b) => ({ id: b.dataset.id, k: b.querySelector('.shape-name .k').textContent, tex: b.querySelector('.shape-name .d').dataset.tex || '', dtitle: b.querySelector('.shape-name .d').title }))`;
const shapes = () => ev('JSON.stringify(__cmwP().shapes.map((s) => ({ id: s.id, kind: s.kind, name: s.name || null, label: s.label || null })))').then(JSON.parse);
await view(1440, 900, false, false);
await load('shaperows' + Date.now(), {
  shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }, { id: 'b', kind: 'halfplane', a: [0, 0], b: [2, 1] }, { id: 'c', kind: 'circle', c: [0, 0], r: 2 }, { id: 'p', kind: 'point', p: [1, 1] }],
  steps: [{ type: 'recip', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' },
});
await settle(1500);
const rows = await ev(ROWS);
info.rows = rows;
ok('the list has the four rows', rows.length >= 4, rows);
// two lines: the set sits under the name
const geo = await ev(`(() => { const b = document.querySelector('#shapeList .shape[data-id="a"]'), k = b.querySelector('.shape-name .k').getBoundingClientRect(), d = b.querySelector('.shape-name .d').getBoundingClientRect(); return { kBottom: k.bottom, dTop: d.top, kLeft: k.left, dLeft: d.left }; })()`);
ok('the row has two lines: the set under the name', geo.dTop >= geo.kBottom - 1 && Math.abs(geo.dLeft - geo.kLeft) < 2, geo);
const hp = rows.find((r) => r.id === 'b');
ok('a half-plane with no unit normal is said in words', /left of the line from/.test(hp.tex) && !/operatorname\{Im\}/.test(hp.tex), hp);
ok('a tooltip is the spoken text, not LaTeX', rows.every((r) => !/\\\\(?:operatorname|frac|text|le|lt)\b|[{}]/.test(r.dtitle)), rows.map((r) => r.dtitle));
// Rename from the row's ⋯ menu
await ev(`document.querySelector('#shapeList .shape[data-id="a"] .more').click()`); await settle(400);
const items = await ev(`[...document.querySelectorAll('[role="menuitem"]')].map((e) => e.textContent.trim())`);
ok('the ⋯ menu offers Rename', items.some((t) => /^Rename/.test(t)), items);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /^Rename/.test(e.textContent.trim())).click()`); await settle(300);
ok('Rename makes the name a field', await ev(`!!document.querySelector('#shapeList .shape[data-id="a"] .k input')`), null);
await ev(`(() => { const i = document.querySelector('#shapeList .shape[data-id="a"] .k input'); i.value = 'My disc'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await settle(500);
let sh = await shapes();
ok('Enter keeps the name in the shape', sh.find((s) => s.id === 'a').name === 'My disc', sh);
ok('the row shows it', (await ev(ROWS)).find((r) => r.id === 'a').k === 'My disc', null);
// Esc leaves it as it was
await ev(`document.querySelector('#shapeList .shape[data-id="c"] .more').click()`); await settle(300);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /^Rename/.test(e.textContent.trim())).click()`); await settle(300);
await ev(`(() => { const i = document.querySelector('#shapeList .shape[data-id="c"] .k input'); i.value = 'junk'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); })()`); await settle(400);
sh = await shapes();
ok('Esc leaves the name as it was', sh.find((s) => s.id === 'c').name === null, sh);
// a second click on the name (a laptop)
const kc = await ev(`(() => { const r = document.querySelector('#shapeList .shape[data-id="b"] .shape-name .k').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; })()`);
await click(kc[0], kc[1]); await sleep(120);
const kc2 = await ev(`(() => { const r = document.querySelector('#shapeList .shape[data-id="b"] .shape-name .k').getBoundingClientRect(); return [r.left + 10, r.top + r.height / 2]; })()`);
await click(kc2[0], kc2[1]); await settle(300);
ok('a second click on the name renames it', await ev(`!!document.querySelector('#shapeList .shape[data-id="b"] .k input')`), null);
await ev(`(() => { const i = document.querySelector('#shapeList .shape[data-id="b"] .k input'); i.value = 'Slanted half-plane'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await settle(500);
sh = await shapes();
ok('the half-plane has its name', sh.find((s) => s.id === 'b').name === 'Slanted half-plane', sh);
// a point's name is its label
await ev(`document.querySelector('#shapeList .shape[data-id="p"] .more').click()`); await settle(300);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /^Rename/.test(e.textContent.trim())).click()`); await settle(300);
await ev(`(() => { const i = document.querySelector('#shapeList .shape[data-id="p"] .k input'); i.value = 'Q'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await settle(500);
sh = await shapes();
ok('a point\'s name is its label', sh.find((s) => s.id === 'p').label === 'Q', sh);
// an empty name goes back to the automatic one
await ev(`document.querySelector('#shapeList .shape[data-id="a"] .more').click()`); await settle(300);
await ev(`[...document.querySelectorAll('[role="menuitem"]')].find((e) => /^Rename/.test(e.textContent.trim())).click()`); await settle(300);
await ev(`(() => { const i = document.querySelector('#shapeList .shape[data-id="a"] .k input'); i.value = ''; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); })()`); await settle(500);
sh = await shapes();
ok('an empty name restores the automatic one', sh.find((s) => s.id === 'a').name === null && /^Disc 1$/.test((await ev(ROWS)).find((r) => r.id === 'a').k), [sh, await ev(ROWS)]);
// Italian: the half-plane's words, and no row cut off at the name
await nav(`${(await ev('location.href')).split('?')[0]}?ns=shaperowsit${Date.now()}&lang=it`); await settle(1500);
const it = await ev(ROWS);
info.it = it.map((r) => r.k);
return { pass: fails.length === 0, fails, info };

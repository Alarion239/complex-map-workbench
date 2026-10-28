// Esc steps out one level at a time, and each active mode is a chip in the pane head (issue #31): the tool, a step shown
// alone, an expanded plane, the deformation. A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('modechips' + Date.now(), { shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
const st = () => ev(`(() => ({ tool: (document.querySelector('.tool[data-tool][aria-pressed="true"]') || { dataset: {} }).dataset.tool, chips: [...document.querySelectorAll('.mode-chip, .alone-chip:not([hidden])')].map((c) => c.textContent.replace(/\\s+/g, ' ').trim()), solo: document.getElementById('leftSolo').getAttribute('aria-pressed') + document.getElementById('rightSolo').getAttribute('aria-pressed'), merged: document.getElementById('panes').className }))()`);
const clickText = (sel, re) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((x) => ${re}.test(x.textContent)); if (b) b.click(); return !!b; })()`);
// the tool is the first level
await key('l'); await settle(200);
await ev(`document.getElementById('leftSolo').click()`); await settle(400);
let s = await st();
ok('an expanded plane shows a chip, Esc on it once the tool is closed', s.tool === 'line' && s.chips.some((c) => /^Y hidden/.test(c)), s);
await key('Escape'); await settle(300);
s = await st();
ok('Esc 1 leaves the tool, the plane stays expanded', s.tool === 'select' && s.chips.some((c) => /Y hidden/.test(c) && /Esc/.test(c)), s);
await key('Escape'); await settle(400);
s = await st();
ok('Esc 2 shows both planes', !s.chips.some((c) => /hidden/.test(c)) && s.solo === 'falsefalse', s);
// a step alone, then the expanded plane: alone goes first
await ev(`document.querySelector('#pipeline .card').click()`); await settle(300);
await ev(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Show f\\d+ alone$/.test(x.getAttribute('aria-label') || '') || /Show alone/.test(x.textContent)); if (b) b.click(); return !!b; })()`); await settle(600);
await ev(`document.getElementById('rightSolo').click()`); await settle(400);
s = await st();
ok('a step alone and an expanded plane both show', s.chips.some((c) => /alone/.test(c)) && s.chips.some((c) => /hidden/.test(c)), s);
await key('Escape'); await settle(300);
s = await st();
ok('Esc closes the selection or the alone mode first, one level only', s.chips.length >= 1, s);
for (let i = 0; i < 4; i++) { await key('Escape'); await settle(300); }
s = await st();
ok('Esc walks out of alone and the expanded plane', s.chips.length === 0 && s.solo === 'falsefalse', s);
// the deformation is the last level
await key('m'); await settle(800);
s = await st();
ok('the deformation shows a chip with its key', s.chips.some((c) => /^Deformation/.test(c)) && /merged/.test(s.merged), s);
await key('Escape'); await settle(500);
s = await st();
ok('Esc ends the deformation', !s.chips.some((c) => /Deformation/.test(c)), s);
return { pass: fails.length === 0, fails, info };

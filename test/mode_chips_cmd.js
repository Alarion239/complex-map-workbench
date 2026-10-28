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
// a Construct tool shows in the head with its pick count, and Esc leaves it
await key('e'); await settle(300);
const s0 = await st();
ok('a Construct tool is a chip in the head with its count', s0.tool === 'circle3' && s0.chips.some((c) => /Circle through 3 points · 1 of 3/.test(c) && /Esc/.test(c)), s0);
await key('Escape'); await settle(300);
const s1 = await st();
ok('Esc leaves the Construct tool and its chip', s1.tool === 'select' && !s1.chips.some((c) => /Circle through/.test(c)), s1);
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
await ev(`document.querySelector('#pipeline .card').click()`); await settle(800);
await clickText('button', '/Show alone/'); await settle(600);
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
// an expanded plane leaves the other one as a labelled strip at the edge, which brings it back
await ev(`document.getElementById('leftSolo').click()`); await settle(400);
const strip = await ev(`(() => { const e = document.getElementById('hiddenStrip'); return e && !e.hidden ? { t: e.textContent, side: e.dataset.side, w: Math.round(e.getBoundingClientRect().width) } : null; })()`);
ok('the hidden plane is a strip at the edge, named', strip && /Y hidden/.test(strip.t) && strip.side === 'R' && strip.w > 8, strip);
await ev(`document.getElementById('hiddenStrip').click()`); await settle(400);
s = await st();
ok('pressing the strip shows both planes', s.solo === 'falsefalse' && !(await ev(`!document.getElementById('hiddenStrip').hidden`)), s);
// Y's head with the chain empty at 1366 x 768 keeps its title (the Add function button shrinks to its plus first)
await view(1366, 768, false, false);
await load('modechipsy' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1800);
const yh = await ev(`(() => { const t = document.getElementById('rightTitle'); return { w: Math.round(t.getBoundingClientRect().width), txt: t.textContent.slice(0, 12), tiny: document.getElementById('paneR').classList.contains('tiny') }; })()`);
ok('Y keeps its title at 1366 with the chain empty', yh.w > 20 && !yh.tiny, yh);
return { pass: fails.length === 0, fails, info };

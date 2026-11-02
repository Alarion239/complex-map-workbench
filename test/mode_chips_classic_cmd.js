// Esc steps out one level at a time, and each active mode is a chip in the classic pane head (issue #31): the tool, a step shown
// alone, an expanded plane, the deformation. The tool's own cases are mode_chips_cmd.js, which runs in the steps view; this suite
// covers the classic views, which have the pane heads and the deformation dock. A command file for a CDP daemon.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'mode_chips_kit.js'), 'utf8')), st = K.st;
await K.open();
// the tool is the first level
await key('l'); await settled({ floor: 200 });
await ev(`document.getElementById('leftSolo').click()`); await settled({ floor: 400 });
let s = await st();
ok('an expanded plane shows a chip, Esc on it once the tool is closed', s.tool === 'line' && s.chips.some((c) => /^Y hidden/.test(c)), s);
await key('Escape'); await settled({ floor: 300 });
s = await st();
ok('Esc 1 leaves the tool, the plane stays expanded', s.tool === 'select' && s.chips.some((c) => /Y hidden/.test(c) && /Esc/.test(c)), s);
await key('Escape'); await settled({ floor: 400 });
s = await st();
ok('Esc 2 shows both planes', !s.chips.some((c) => /hidden/.test(c)) && s.solo === 'falsefalse', s);
// a step alone, then the expanded plane: alone goes first
const cc = await ev(`(() => { const r = document.querySelector('#pipeline .card:not(.region-card)').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await click(cc[0], cc[1]); await settled({ floor: 800 });
// (the Inspector shows the step's button a moment after the card is picked, longer on a slow machine: waited for)
const aloneBtn = `(() => [...document.querySelectorAll('button')].find((x) => /^Show f\\S* alone$/.test(x.getAttribute('aria-label') || '') || /Show alone/.test(x.textContent)))()`;
await settled({ until: `!!${aloneBtn}`, max: 12000 });
await ev(`${aloneBtn}.click()`);
await settled({ floor: 800 });
await ev(`document.getElementById('rightSolo').click()`); await settled({ floor: 400 });
s = await st();
ok('a step alone and an expanded plane both show', s.chips.some((c) => /alone/.test(c)) && s.chips.some((c) => /hidden/.test(c)), s);
await key('Escape'); await settled({ floor: 300 });
s = await st();
ok('Esc closes the selection or the alone mode first, one level only', s.chips.length >= 1, s);
for (let i = 0; i < 4; i++) { await key('Escape'); await settled({ floor: 300 }); }
s = await st();
ok('Esc walks out of alone and the expanded plane', s.chips.length === 0 && s.solo === 'falsefalse', s);
// the deformation is the last level
await key('m'); await settled({ floor: 800 });
s = await st();
ok('the deformation shows a chip with its key', s.chips.some((c) => /^Deformation/.test(c)) && /merged/.test(s.merged), s);
await key('Escape'); await settled({ floor: 500 });
s = await st();
ok('Esc ends the deformation', !s.chips.some((c) => /Deformation/.test(c)), s);
// an expanded plane leaves the other one as a labelled strip at the edge, which brings it back
await ev(`document.getElementById('leftSolo').click()`); await settled({ floor: 400 });
const strip = await ev(`(() => { const e = document.getElementById('hiddenStrip'); return e && !e.hidden ? { t: e.textContent, side: e.dataset.side, w: Math.round(e.getBoundingClientRect().width) } : null; })()`);
ok('the hidden plane is a strip at the edge, named', strip && /Y hidden/.test(strip.t) && strip.side === 'R' && strip.w > 8, strip);
await ev(`document.getElementById('hiddenStrip').click()`); await settled({ floor: 400 });
s = await st();
ok('pressing the strip shows both planes', s.solo === 'falsefalse' && !(await ev(`!document.getElementById('hiddenStrip').hidden`)), s);
// Y's head with the chain empty at 1366 x 768 keeps its title (the Add function button shrinks to its plus first)
await view(1366, 768, false, false);
await load('modechipsy' + Date.now(), { shapes: [], steps: [], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settled({ floor: 1800 });
const yh = await ev(`(() => { const t = document.getElementById('rightTitle'); return { w: Math.round(t.getBoundingClientRect().width), txt: t.textContent.slice(0, 12), tiny: document.getElementById('paneR').classList.contains('tiny') }; })()`);
ok('Y keeps its title at 1366 with the chain empty', yh.w > 20 && !yh.tiny, yh);
return { pass: fails.length === 0, fails, info };

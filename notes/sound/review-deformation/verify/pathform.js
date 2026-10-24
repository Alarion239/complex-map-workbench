// snddef-10: the hook's path form. z^9 at 1.2 e^{i170°}; the transport open and paused at 0; t moved in 4 jumps of 0.25
// reported as paths (soundFunctionChanged({ at })): the run must be the winding of t -> H_t(z), 3.778 turns, 3 bells.
// The same jumps reported bare (no path) give the nearest turn each jump (a wrong count), as documented.
const PORT = 8954;
await view(1440, 900, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
const ns = 'xvspath' + Date.now();
const o = { v3: true, v4: true, shapes: [], steps: [{ type: 'custom', params: { expr: 'z^9', cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 120 } };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}` }); await sleep(2400);
await ev(`__cmwSetMain('phase')`); await sleep(900);
await click(5, 300); await sleep(200);
await ev(`Sound.set({ on: true, vol: 0.7, ui: true, events: true, sonify: true }, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); __cmwSet('loop', false); 1`);
await ev(`(() => { window.__T = []; const f = Sound.turn; Sound.turn = function (...a) { __T.push(a[0].dir); return f.apply(this, a); }; return 1; })()`);
const th = 170 * Math.PI / 180;
const p = await ev(`__cmwW2S('L', ${1.2 * Math.cos(th)}, ${1.2 * Math.sin(th)})`);
await move(p[0] + 3, p[1]); await sleep(40); await move(p[0], p[1]); await sleep(200);
await ev(`__cmwMorph({ open: true }); __cmwMorph({ playing: false }); __cmwMorph({ T: 0 }); 1`); await sleep(600);
await ev('__T.length = 0; 1');
for (let i = 0; i < 4; i++) { await ev(`__cmwSound({ pathT: [${i * 0.25}, ${(i + 1) * 0.25}] })`); await sleep(120); }
await sleep(300);
const s = await ev('__cmwSound()'), bells = await ev('__T.slice()');
const ok = s.run && Math.abs(s.run.phi - 3.7778) < 0.01 && bells.length === 3;
return { pass: !!ok, run: s.run, bells, rest: s.rest, perEval: s.perEval, exc: logs().filter((l) => /EXC|Error/.test(l.t + (l.m || ''))).slice(0, 3) };

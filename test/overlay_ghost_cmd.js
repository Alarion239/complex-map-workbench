// Issue #297: X's overlay kept example 7's cut handle (the ring and the chip "θ 180°") after example 8 loaded, about one
// cold load in three on SwiftShader: every overlay pass after the load cleared the canvas and drew nothing there, and
// the GPU-accelerated canvas still held example 7's picture. The overlays' contexts are CPU-backed now (view.js, Pane).
//   A  both overlay contexts are CPU-backed (willReadFrequently): the fix itself; false before it, every time
//   B  the overlay still draws and clears: example 7's handle is on the screen, and after example 8 nothing in the cut
//      ink is left in its box (read from a screenshot: a readback of the canvas can itself move it off the GPU)
//   C  cold loads (a fresh Chrome each, no GPU program cache: test/overlay_ghost_repro.js, the overlay read back once
//      after the waits): none keeps the handle. In this daemon's own page (programs cached) and read from screenshots,
//      the race did not show before the fix (20 of 20 loads clean), so B alone would not catch it
// A command file for the CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
await view(1280, 800, false);
await load('ovg' + Date.now(), {});
for (let k = 0; k < 120 && !(await ev(`document.readyState === 'complete' && !!document.querySelector('#pipeline .card')`)); k++) await sleep(250);

// A
info.attrs = await ev(`['overlayL', 'overlayR'].map((id) => { const c = document.getElementById(id), a = c && c.getContext('2d').getContextAttributes(); return a ? !!a.willReadFrequently : null; })`);
ok('A: both overlay contexts are CPU-backed (willReadFrequently)', info.attrs[0] === true && info.attrs[1] === true, info.attrs);

// B
// the pixels near the cut ink (TH.cut, #CC3311 in the light theme) in a box of the screen
const ink = async (clip) => { const p = await img(clip); let n = 0; for (let i = 0; i < p.w * p.h; i++) { const r = p.data[i * p.ch], g = p.data[i * p.ch + 1], b = p.data[i * p.ch + 2]; if (Math.abs(r - 0xCC) < 40 && Math.abs(g - 0x33) < 40 && Math.abs(b - 0x11) < 40) n++; } return n; };
// ci/equiv.js's waits between scenes: a moment, the programs linked, the cards drawn, a moment
const settle = async () => {
  await sleep(1500);
  for (let k = 0; k < 40 && await ev('typeof GLR !== "undefined" && GLR.compiling === true'); k++) await sleep(250);
  for (let k = 0; k < 40 && await ev(`(() => { try { return __cmwCards().cards.some((c) => !c.sig || c.stale); } catch (e) { return false; } })()`); k++) await sleep(250);
  await sleep(1500);
};
await ev('(__cmwExample(7), 1)');
await settle();
const hs = await ev('__cmwCutHandles()');
ok('B: example 7 has its cut handle', hs.length === 1, hs);
if (hs.length) {
  const clip = { x: Math.round(hs[0].x) - 10, y: Math.round(hs[0].y) - 14, width: 110, height: 28 };
  info.before = await ink(clip);
  ok('B: example 7\'s handle is drawn on X', info.before > 50, info.before);
  await ev('(__cmwExample(8), 1)');
  await settle();
  info.after = await ink(clip);
  info.left = await ev('__cmwCutHandles().length');
  ok('B: example 8 has no cut handle', info.left === 0, info.left);
  ok('B: nothing of example 7\'s handle is left on X after example 8', info.after <= 50, info.after);
}
// C
// COLD cold loads, each in a fresh Chrome without a GPU program cache (test/overlay_ghost_repro.js): before the fix,
// 14 of 16 such loads kept the handle in the overlay's backing store on SwiftShader
const COLD = 10;
const { coldLoads } = process.mainModule.require(path.join(DIR, '..', 'overlay_ghost_repro.js'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const cold = await coldLoads(`http://localhost:${PORT}/`, COLD);
info.cold = cold.map((r) => (r.err ? 'err' : r.ghost ? `GHOST ${r.px}` : 'clean')).join(', ');
ok(`C: every one of ${COLD} cold loads ran (example 7 has its handle)`, cold.length === COLD && cold.every((r) => !r.err), cold.filter((r) => r.err));
ok(`C: no cold load keeps example 7's handle in X's overlay after example 8`, cold.every((r) => !r.ghost), info.cold);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };

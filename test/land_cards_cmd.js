// Landscape step cards without parallel compile (issue #72): on a page without KHR_parallel_shader_compile (SwiftShader,
// lavapipe) every link is synchronous, so a Landscape card never starts one. "Sheets of the logarithm" (the pane draws
// All sheets, the card the principal branch): through its load and a pan no card links a program from cardLand, the
// card shows its Phase picture, and once the pane has linked the principal branch (All sheets off) the card draws the
// relief. On a page with parallel compile the card's links are background ones, and the suite only reports.
// A command file for a CDP daemon:  <runner> test/land_cards_cmd.js
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
await view(1440, 900, false);
await load('lcards' + Date.now(), {});
// (every link and every card draw, with who asked: the stack names cardLand / cardPhase)
await ev(`(() => {
  const L = window.__lc = { links: [], land: 0, phase: 0 };
  const P = WebGL2RenderingContext.prototype, lp = P.linkProgram;
  P.linkProgram = function (p) { const s = new Error().stack || ''; L.links.push(/cardLand/.test(s) ? 'cardLand' : /renderThumb/.test(s) ? 'card' : 'pane'); return lp.call(this, p); };
  const dl = GLR.drawLandscape, dc = GLR.drawColorPlot;
  GLR.drawLandscape = function () { if (/cardLand/.test(new Error().stack || '')) L.land++; return dl.apply(this, arguments); };
  GLR.drawColorPlot = function () { if (/cardPhase/.test(new Error().stack || '')) L.phase++; return dc.apply(this, arguments); };
  return 1; })()`);
info.parallel = await ev("!!GLR.gl.getExtension('KHR_parallel_shader_compile')");
let idx = -1;
for (let i = 0; i < 24 && idx < 0; i++) {
  await ev(`(__cmwExample(${i}), 1)`); await sleep(150);
  if (/Sheets of the logarithm/.test(await ev(`(document.querySelector('#examplesBtn .exlabel') || {}).textContent || ''`))) idx = i;
}
ok('the example "Sheets of the logarithm" is found', idx >= 0, idx);
await ev('(window.__lc.links.length = 0, window.__lc.land = 0, window.__lc.phase = 0, 1)');
await ev(`(__cmwExample(${idx}), 1)`);
await settle(14000);
const atLoad = await ev('JSON.parse(JSON.stringify(window.__lc))');
info.load = atLoad;
// a pan of X (the Landscape follows the z-window; the cards with it)
const r = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
await ev('(window.__lc.links.length = 0, window.__lc.land = 0, window.__lc.phase = 0, 1)');
await drag(r[0], r[1], r[0] + 80, r[1] + 30);
await settle(8000);
const atPan = await ev('JSON.parse(JSON.stringify(window.__lc))');
info.pan = atPan;
if (info.parallel === false) {
  ok('load: no card links a Landscape program', !atLoad.links.includes('cardLand'), atLoad);
  ok('pan: no card links a Landscape program', !atPan.links.includes('cardLand'), atPan);
  ok('the card shows its Phase picture meanwhile', atLoad.phase + atPan.phase > 0 && atLoad.land + atPan.land === 0, { atLoad, atPan });
  // All sheets off: the pane links the principal branch, and the card then draws the relief
  await ev('(window.__lc.land = 0, __cmwSet("sheets", false), 1)');
  // (the pane's links of the principal branch take about 20 s on SwiftShader)
  let after = null;
  for (let i = 0; i < 30 && !(after && after.land > 0); i++) { await settle(2000); after = await ev('JSON.parse(JSON.stringify(window.__lc))'); }
  info.sheetsOff = after;
  ok('All sheets off: the card draws the relief once the pane has linked it', after.land > 0, after);
}
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, nfails: fails.length, fails: fails.slice(0, 30), info };

// Plaster on the steps view's Landscape (#1385). The Colouring choice's Plaster is the relief alone, lit: it sets the view's D.phase
// false, keeps that choice checked, and the surface is drawn without the phase colours (a handful of coloured pixels, where Tiles
// has thousands). A later svApply (a jump to a plane) leaves it where it is. Tiles and Plain are the controls: each sets D.phase
// true, and the picture is coloured again.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const still = (o = {}) => settled(Object.assign({ until: 'window.__cmwSteps && !__cmwSteps().moving' }, o));
const VIEW_W = 1440, VIEW_H = 900;
const COLOURED = 30;            // a pixel is coloured when its channels differ by more than this
const MIN_COLOURED_PX = 2000;   // Tiles paints at least this many coloured pixels on the relief
const PLASTER_SHARE = 0.02;     // Plaster has at most this share of Tiles' coloured pixels
const REPAINT_SHARE = 0.9;      // Tiles again has at least this share of its first count
const ns = 'svplaster' + Date.now();
const CUBE = { type: 'pown', params: { n: 3 }, on: true };
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [CUBE], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(VIEW_W, VIEW_H, false, false);
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" });
await ev(`(__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }), 1)`); await still();
// (the Colouring choice is in the foot's Display options on a laptop: opened when it is not in the page)
const press = async (v) => { await ev(`(document.getElementById('landPaint') || document.querySelector('#leftFoot .opts-btn').click(), document.querySelector('#landPaint button[data-v="${v}"]').click(), 1)`); await still(); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const read = () => ev(`(() => {
  const cv = document.getElementById('canvasL'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${COLOURED}) n++;
  const on = document.querySelector('#landPaint button.on'), seg = document.getElementById('landPaint');
  return { phase: __cmwState().view.D.phase, checked: on ? on.dataset.v : null, has: !!seg, coloured: n };
})()`);
await ev(`(document.getElementById('landPaint') || document.querySelector('#leftFoot .opts-btn').click(), 1)`); await still();
const tiles = await read();
ok('the Colouring choice is on the Landscape, at Tiles to begin with', tiles.has && tiles.checked === 'tiles' && tiles.phase === true, tiles);
ok('Tiles paints the relief in colour', tiles.coloured >= MIN_COLOURED_PX, tiles);
await press('plaster');
const plaster = await read();
ok('Plaster is applied: D.phase is false', plaster.phase === false, plaster);
ok('and the choice stays on Plaster', plaster.checked === 'plaster', plaster);
ok('the relief is drawn without the phase colours', plaster.coloured <= tiles.coloured * PLASTER_SHARE, { tiles: tiles.coloured, plaster: plaster.coloured });
await ev(`(__cmwSteps({ go: 0, now: true }), 1)`); await still();
const after = await read();
ok('a later svApply leaves Plaster where it is', after.phase === false && after.checked === 'plaster', after);
// the controls: the other colourings still apply
await press('tiles');
const back = await read();
ok('Tiles after Plaster: D.phase is true, the choice is Tiles, the picture is coloured again', back.phase === true && back.checked === 'tiles' && back.coloured >= tiles.coloured * REPAINT_SHARE, { back, tiles: tiles.coloured });
await press('phase');
const plain = await read();
ok('Plain: D.phase is true and the choice is Plain', plain.phase === true && plain.checked === 'phase' && plain.coloured > 0, plain);
// the Landscape's key stays its height key under Plaster, at plane 0 and at a plane past the colour plane (where a carried wheel would
// otherwise be named), and under Tiles as the control
// (ring: the key draws the hue ring; glyph: the chip's glyph is the hue wheel, a conic gradient, and the neutral ink under Plaster)
const legend = () => ev('(() => { const l = __cmwLegend(); const b = document.getElementById("leftLegend"); return { kind: l.kind, caption: l.caption, ring: l.ring, shown: !!b && !b.hidden, glyph: b ? getComputedStyle(b, "::before").backgroundImage : null }; })()');
const CARRIED = /carried/;
for (const [name, colouring, at] of [['Tiles', 'tiles', 1], ['Plaster', 'plaster', 0], ['Plaster', 'plaster', 1]]) {
  await press(colouring);
  await ev(`(__cmwSteps({ T: 0, go: ${at}, now: true }), 1)`); await still();
  const lg = await legend();
  ok(`${name} at plane ${at}: the key is the Landscape's height key, shown`, lg.kind === '3d' && lg.shown, lg);
  ok(`${name} at plane ${at}: and it does not name a carried colour`, !CARRIED.test(lg.caption || ''), lg);
  const hue = colouring === 'tiles';
  ok(`${name} at plane ${at}: the key ${hue ? 'draws' : 'does not draw'} the hue ring`, lg.ring === hue, lg);
  ok(`${name} at plane ${at}: the chip's glyph is ${hue ? 'the hue wheel' : 'neutral'}`, /conic-gradient/.test(lg.glyph || '') === hue, lg);
}
await press('plaster');
// the cold-load cases: a saved state whose view is the Landscape with Plaster keeps it; one whose view has no D entry, or has D.phase
// true, opens coloured, with no error
const loadSavedView = async (tag, viewState) => {
  const k = ns + tag;
  await ev(`localStorage.setItem('complex-map-workbench-v1:${k}', ${JSON.stringify(JSON.stringify(Object.assign({}, st, { view: viewState })))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${k}&lang=en&view=steps`);
  await still({ until: "window.__cmwSteps && __cmwSteps().on && !__cmwSteps().moving && !!document.querySelector('#svStrip .sv-rail')" });
  await ev(`(__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }), 1)`); await still();
  await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  return read();
};
const savedPlaster = await loadSavedView('plaster', { main: 'land', D: { phase: false } });
ok('a saved Landscape with Plaster opens on Plaster, grey', savedPlaster.phase === false && savedPlaster.coloured <= tiles.coloured * PLASTER_SHARE, savedPlaster);
const savedTiles = await loadSavedView('tiles', { main: 'land', D: { phase: true } });
ok('a saved Landscape with phase colours opens coloured', savedTiles.phase === true && savedTiles.coloured >= tiles.coloured * REPAINT_SHARE, savedTiles);
const savedNoD = await loadSavedView('nod', { main: 'land' });
ok('a saved view with no D entry opens the Landscape coloured, with phase on', savedNoD.phase === true && savedNoD.coloured >= tiles.coloured * REPAINT_SHARE, savedNoD);
info.coloured = { tiles: tiles.coloured, plaster: plaster.coloured, back: back.coloured, plain: plain.coloured };
return { pass: !fails.length, fails, info };

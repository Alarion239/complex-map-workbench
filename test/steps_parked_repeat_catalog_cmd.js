// A repeated catalog step's parked plane, Inside regions (#1487): Integer power z³ repeated REPEAT_N times is the map
// z³ repeated, which the exact REPT renderer draws when the step is written as the formula z^3 (#1472). The catalog step
// draws through the same REPT op (InvOps' reptForm): on the parked plane after it, with a disc DISC crossing the unit
// circle as the region,
// - the plane is drawn within PARKED_SETTLE ms (parked_kit's PARKED_DRAWN), and its REPT draw walked at least one tile
//   (__cmwRept({ tileStats }));
// - its pixels are the formula's: at most DIFF_MAX_SHARE of the pane's pixels differ by over PIX_TOL in some channel
//   from the same plane drawn with the formula (the two ops' coefficients differ by a power of 2, so float32 may round
//   a pixel at the image's edge the other way), and the formula's plane is not paper alone (the control: a drawing of
//   nothing would match nothing).
// Each page is opened in the steps view (test.html?view=steps) with the state seeded in its namespace.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const VIEW_W = 1200, VIEW_H = 800, VIEW_SCALE = 140;   // px: the page, and the scene's px per unit
const REPEAT_N = 20;               // the copies of the step
const DISC = { c: [1, 0], r: 0.12 };   // the region: a disc across the unit circle, so its image is neither empty nor the plane
const SETTLE_LONG = 60000, PARKED_SETTLE = 60000;   // ms
const PIX_TOL = 24;                // a pixel differs over this in some channel (0..255)
const DIFF_MAX_SHARE = 0.005;      // the share of the pane's pixels that may differ between the two planes
const PAPER_MIN = 235;             // paper's least channel
const ready = () => settled({ max: SETTLE_LONG, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
const { PARKED_DRAWN, parkInside } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'parked_kit.js'), 'utf8'))({ ev, settled, exampleNames });
await view(VIEW_W, VIEW_H, false, false);
const STEPS = {
  catalog: { type: 'pown', params: { n: 3 }, on: true, repeat: { n: REPEAT_N, len: 1 } },
  formula: { type: 'custom', params: { expr: 'z^3', cut: 180 }, on: true, repeat: { n: REPEAT_N, len: 1 } },
};
// the parked plane after the step, Inside regions: its pixels (the left pane's canvas), the REPT tiles walked, its paths
const parked = async (key) => {
  const ns = 'spc' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
    shapes: [{ id: 's1', kind: 'disc', c: DISC.c, r: DISC.r, ci: 0, visible: true }], steps: [STEPS[key]] };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=en`);
  await ready();
  await ev('__cmwRept({ tileStats: true }); 1');
  await parkInside(SETTLE_LONG);
  const drawn = await settled({ max: PARKED_SETTLE, until: PARKED_DRAWN });
  const tiles = await ev('__cmwRept({ tileStats: true })');
  const paths = await ev('__cmwSteps().paths');
  await ev(`window.__spcPx = (() => { const c = document.getElementById('canvasL'); return { w: c.width, h: c.height, d: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }; })(); 1`);
  const px = await ev('window.__spcPx');
  return { drawn: drawn.ok, tiles, paths, px };
};
const cat = await parked('catalog'), frm = await parked('formula');
let diff = 0, paper = 0, n = 0;
if (cat.px.w === frm.px.w && cat.px.h === frm.px.h) {
  const a = cat.px.d, b = frm.px.d;
  for (let i = 0; i < a.length; i += 4) {
    n++;
    if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > PIX_TOL) diff++;
    if (b[i] > PAPER_MIN && b[i + 1] > PAPER_MIN && b[i + 2] > PAPER_MIN) paper++;
  }
}
info.catalog = { drawn: cat.drawn, tiles: cat.tiles, paths: cat.paths };
info.formula = { drawn: frm.drawn, tiles: frm.tiles, paths: frm.paths };
info.pixels = { n, diff, share: n ? +(diff / n).toFixed(5) : null, formulaPaper: n ? +(paper / n).toFixed(4) : null };
ok(`Integer power z³ ×${REPEAT_N}, parked Inside regions: the plane is drawn within ${PARKED_SETTLE} ms, by a REPT draw that walked a tile`, cat.drawn && !!cat.tiles && cat.tiles.tilesA + cat.tiles.tilesB > 0, info.catalog);
ok(`the same plane with the step written as the formula z^3 is drawn, and is not paper alone (control)`, frm.drawn && !!frm.tiles && frm.tiles.tilesA + frm.tiles.tilesB > 0 && n > 0 && paper < n, { formula: info.formula, pixels: info.pixels });
ok(`Integer power z³ ×${REPEAT_N}'s parked plane is the formula's: at most ${DIFF_MAX_SHARE * 100} % of the pane's pixels differ`, n > 0 && diff / n <= DIFF_MAX_SHARE, info.pixels);
return { pass: fails.length === 0, fails, info };

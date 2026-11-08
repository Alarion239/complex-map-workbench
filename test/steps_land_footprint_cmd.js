// The steps view's Landscape with Inside regions: the region's outline on the floor (#1156, ux's ruling on #1174: a thin
// line in the theme's footprint colour, under the relief), carried by the glide as the surface is. The default page (z, exp,
// Möbius; the region |Im z| < π/2, drawn as its boundary lines Im z = ±π/2):
// - at rest on plane z and on plane w₁ and held at u = 0.25 and 0.5 between them: the floor pixel under the place of
//   boundary points of the region (z for plane z; exp z for plane w₁; the glide's map at u between) is the footprint ink in
//   Inside regions' frame and is not in Everywhere's frame (where the shape's own colour is on the floor), for at least
//   one of the boundary points that are not covered by the relief (FOOT_MIN of them).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const INK_TOL = 12, FOOT_MIN = 1;
// where the region's boundary points are drawn on the floor in the last frame: places(zs) is a page expression giving
// the floor place of each boundary point; the answer lists the pane's device pixels of the floor under them
const hits = (placeExpr) => ev(`(() => {
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--land-footprint').trim();
  const rgb = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  const cv = document.getElementById('canvasL'), k = cv.width / cv.getBoundingClientRect().width, cx = cv.getContext('2d');
  const img = cx.getImageData(0, 0, cv.width, cv.height).data;
  const near = (px, py) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = Math.round(px) + dx, y = Math.round(py) + dy; if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) continue;
    const i = 4 * (y * cv.width + x); if (Math.max(Math.abs(img[i] - rgb[0]), Math.abs(img[i + 1] - rgb[1]), Math.abs(img[i + 2] - rgb[2])) <= ${INK_TOL}) return true; } return false; };
  const out = [];
  for (const sgn of [1, -1]) for (let x = -1.5; x <= 1.51; x += 0.25) {
    const z = [x, sgn * Math.PI / 2], w = (${placeExpr})(z[0], z[1]);
    const p = w && __cmwLandFloorPx(w[0], w[1]);
    out.push(p ? near(p[0] * k, p[1] * k) : null);
  }
  return out;
})()`);
const frame = async (scope, setup) => {
  await ev(`__cmwSteps({ scope: '${scope}', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  await ev(setup);
  await settled({ max: 60000 });
  await ev(rAF2);
};
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landfoot${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
const cases = [
  ['plane z at rest', '__cmwSteps({ go: 0, now: true }); 1', '(x, y) => [x, y]'],
  ['plane w1 at rest', '__cmwSteps({ go: 1, now: true }); 1', '(x, y) => [Math.exp(x) * Math.cos(y), Math.exp(x) * Math.sin(y)]'],
  ['u = 0.25', '__cmwSteps({ park: 0.25 }); 1', '(x, y) => { const w = __cmwSvGlobe(x, y).w; return w; }'],
  ['u = 0.5', '__cmwSteps({ park: 0.5 }); 1', '(x, y) => { const w = __cmwSvGlobe(x, y).w; return w; }'],
];
info.n = {};
for (const [name, setup, place] of cases) {
  await frame('all', setup);
  const all = await hits(place);
  await frame('in', setup);
  const inn = await hits(place);
  const n = inn.filter((v, i) => v && !all[i]).length;
  info.n[name] = { inside: inn.filter(Boolean).length, everywhere: all.filter(Boolean).length, n };
  ok(`${name}: the footprint ink is on the floor under at least ${FOOT_MIN} boundary points of the region, and not in Everywhere's frame`, n >= FOOT_MIN, info.n[name]);
}
return { pass: fails.length === 0, fails, info };

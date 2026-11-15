// The steps view's Landscape glide over a multivalued step draws every sheet, as the plane it arrives at does: the
// glide's frames are the copies of the carried surface, one per sheet combo of the steps the glide crosses, each placed
// by the glide's map continued on its combo, at its heights and in its colour on it (svGlideSheets, GLR.drawLandscape's
// carry.copies). Leaving plane a the copies appear at once, as All sheets draws plane a; parked with All sheets off,
// plane a shows the principal sheet alone. The Landscape, Everywhere, Im heights, the colour plane the last plane (so the
// plane a glide arrives at is coloured by its own variable), the pane's words off (held_frames.js wordsOff). Square
// root alone (from plane z) and z³ − 3z then square root (from plane w₁: the cubic's step is before the carry's source
// and has no copy), the glide onto the square root's plane at u = NEAR, 1/2 and 1 − NEAR, each frame drawn as it is and
// with the principal combo alone (__cmwSteps({ glideSheets: 1 }), the K = 1 control):
// - every frame between the planes draws one copy, the root's other sheet, and the control none;
// - departure, u = NEAR: the frame's surface (pixels of saturation over 30, as steps_land_cover counts them) is plane a
//   parked with All sheets on's, within SAME_SURF of it, and the control's at least MISS_SURF less than the frame's.
//   (Not pixel for pixel: All sheets scale Im heights by a percentile over every sheet, a carried frame by the median of
//   the plane's, so All sheets' relief stands taller, about 5 % more surface here; the root's other sheet is about a
//   quarter of the frame's surface)
// - arrival, u = 1 − NEAR: the frame is plane b parked, at most END_FRAC of its pixels more than DIFF_TOL apart
//   (held_frames.js), and the control at least MISS further from it
//   (the other sheet's half of the relief is missing). The view is a small window about 0 (S.srcView.s = SCALE), which
//   the square root maps onto a disc that covers it: the carried points reach the whole of plane b's window.
// - Inside regions, an annulus about 0 under the square root: plane w parked shows the principal sheet's image of the
//   region, and so does the glide onto it: no copy at u = 1/2 and 1 − NEAR.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare, wordsOff } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const NEAR = 1e-4;                    // the glide's places near its ends: u and 1 − u
const END_FRAC = 0.01;                // the share of pixels a frame near an end may differ from that end's plane
const MISS = 0.03;                    // how much further from it the control is, at least
const SAME_SURF = 0.08;               // departure: the share by which the surface may differ from All sheets' plane
const MISS_SURF = 0.15;               // departure: the share by which the control's surface is smaller than the frame's, at least
const SCALE = 900;                    // px per unit: a window of about ±0.5, inside the disc its square root covers
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), CUBIC = step('custom', { expr: 'z^3-3z', cut: 180 });
await view(1440, 900, false, false);
// (the Landscape's surface pixels: saturation over 30)
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) n++; return n; })()`);
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, copies }) => ({ u, s, copies }))(__cmwLandCarry() || {}))'));
// the chain steps on the Landscape (All sheets: sheets), Im heights, parked on plane k
const open = async (steps, sheets, k) => {
  await loadView('steps', 'landcopies' + Date.now(), { shapes: [], steps, sheets, srcView: { cx: 0, cy: 0, s: SCALE } });
  await settled({ max: 30000, until: READY });
  await wordsOff();
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true }); 1`);
  await settled({ max: 60000 });
  await ev(`(document.querySelector('#heightSeg button[data-v="im"]') || {}).click?.(), 1`);
  await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
  await settled({ max: 60000 });
};
// the glide held at x with the copies drawn as they are (k 0) or the principal combo alone (k 1): its frame held as tag
const at = async (x, k, tag) => {
  await ev(`__cmwSteps({ glideSheets: ${k}, x: ${x} }); 1`);
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, await grab(tag), null);
  return Object.assign(await carried(), { surface: await surface() });
};
for (const [name, steps] of [['square root', [ROOT]], ['z³ − 3z then square root', [CUBIC, ROOT]]]) {
  const r = info[name] = {}, b = steps.length, a = b - 1;
  // plane a parked with All sheets on: its surface
  await open(steps, true, a);
  ok(`${name}: plane ${a} with All sheets is still`, await grab('all'), null);
  const allSurf = r.allSurface = await surface();
  await open(steps, false, b);
  ok(`${name}: plane ${b} parked is still`, await grab('pb'), null);
  await ev(`__cmwSteps({ go: ${a}, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [NEAR, 0.5, 1 - NEAR]) {
    const all = await at(a + u, 0, `u${u}`);
    const one = await at(a + u, 1, `k${u}`);
    r[`u ${u}`] = { all, one };
    ok(`${name}, u = ${u}: a carried frame from plane ${a} with the other sheet's copy`, all.s === a && all.copies === 1, all);
    ok(`${name}, u = ${u}: with the principal combo alone (K = 1) no copy is drawn`, one.s === a && one.copies === 0, one);
  }
  const dep = r.departure = { all: r[`u ${NEAR}`].all.surface, one: r[`u ${NEAR}`].one.surface, allSheets: allSurf };
  ok(`${name}, u = ${NEAR}: the surface is plane ${a}'s with All sheets (within ${SAME_SURF})`, Math.abs(dep.all - allSurf) <= SAME_SURF * allSurf, dep);
  ok(`${name}, u = ${NEAR}: the control's surface is at least ${MISS_SURF} smaller than the frame's`, dep.one <= (1 - MISS_SURF) * dep.all, dep);
  const arr = r.arrival = { all: await compare(`u${1 - NEAR}`, 'pb'), one: await compare(`k${1 - NEAR}`, 'pb') };
  ok(`${name}, u = ${1 - NEAR}: the frame is plane ${b} parked (within ${END_FRAC})`, !!arr.all && arr.all.frac <= END_FRAC, arr);
  ok(`${name}, u = ${1 - NEAR}: the control is at least ${MISS} further from it`, !!arr.all && !!arr.one && arr.one.frac >= arr.all.frac + MISS, arr);
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
// ---- Inside regions: an annulus under the square root ----
{
  const ns = 'landcopiesin' + Date.now(), r = info.inside = {};
  await loadView('steps', ns, { shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2, ci: 0, visible: true }], steps: [ROOT], srcView: { cx: 0, cy: 0, s: 90 } });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSteps({ scope: 'in', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [0.5, 1 - NEAR]) {
    const c = r[`u ${u}`] = await at(u, 0, `in${u}`);
    ok(`Inside regions, u = ${u}: a carried frame of the principal sheet's image of the region alone (no copy)`, c.s === 0 && c.copies === 0, c);
  }
}
return { pass: fails.length === 0, fails, info };

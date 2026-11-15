// The steps view's Landscape glide over a multivalued step draws every sheet, as the plane it arrives at does: the
// glide's frames are the copies of the carried surface, one per sheet combo of the steps the glide crosses, each placed
// by the glide's map continued on its combo, at its heights and in its colour on it (svGlideSheets, GLR.drawLandscape's
// carry.copies). The Landscape, Everywhere, Im heights, the colour plane the last plane (so the plane a glide arrives at
// is coloured by its own variable), the pane's words off (held_frames.js wordsOff). Square root alone (from plane z) and
// z³ − 3z then square root (from plane w₁: the cubic's step is before the carry's source and has no copy), the glide
// onto the square root's plane at u = NEAR, 1/2 and 1 − NEAR, each frame drawn as it is and with the principal combo
// alone (__cmwSteps({ glideSheets: 1 }), the K = 1 control):
// - every frame between the planes draws one copy, the root's other sheet, and the control none;
// - at u = NEAR, where the copy lies on the principal surface (the glide's map near the identity on either sheet), the
//   frame is the control's: at most SAME_FRAC of its pixels more than DIFF_TOL apart (held_frames.js), so the copy
//   shows nowhere through the principal surface;
// - at u = 1/2 and 1 − NEAR the surface (pixels of saturation over 30, as steps_land_cover counts them) is at least
//   COVER times the control's: the root's other sheet carries the other half of the points (the principal one's are a
//   half-plane), as plane w at rest shows them. (Not the plane at rest's own count: the carried points are the image of
//   the source plane's window, a disc's worth of the window it arrives at)
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare, wordsOff } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const NEAR = 1e-4;                    // the glide's places near its ends: u and 1 − u
const SAME_FRAC = 0.005;              // the share of pixels the departure frame and its control may differ by
const COVER = 1.6;                    // the surface with the copy, at least this many times the principal sheet's alone
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), CUBIC = step('custom', { expr: 'z^3-3z', cut: 180 });
await view(1440, 900, false, false);
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, copies }) => ({ u, s, copies }))(__cmwLandCarry() || {}))'));
// (the Landscape's surface pixels: saturation over 30)
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 30) n++; return n; })()`);
// the glide held at x with the copies drawn as they are (k 0) or the principal combo alone (k 1): its frame kept as tag
const at = async (x, k, tag) => {
  await ev(`__cmwSteps({ glideSheets: ${k}, x: ${x} }); 1`);
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, await grab(tag), null);
  return Object.assign(await carried(), { surface: await surface() });
};
for (const [name, steps] of [['square root', [ROOT]], ['z³ − 3z then square root', [CUBIC, ROOT]]]) {
  const r = info[name] = {};
  await loadView('steps', 'landcopies' + Date.now(), { shapes: [], steps, srcView: { cx: 0, cy: 0, s: 90 } });
  await settled({ max: 30000, until: READY });
  await wordsOff();
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  await ev(`(document.querySelector('#heightSeg button[data-v="im"]') || {}).click?.(), 1`);
  const b = steps.length, a = b - 1;
  await ev(`__cmwSteps({ go: ${a}, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [NEAR, 0.5, 1 - NEAR]) {
    const all = await at(a + u, 0, `u${u}`), one = await at(a + u, 1, `k${u}`);
    r[`u ${u}`] = { all, one };
    ok(`${name}, u = ${u}: a carried frame from plane ${a} with the other sheet's copy`, all.s === a && all.copies === 1, all);
    ok(`${name}, u = ${u}: with the principal combo alone (K = 1) no copy is drawn`, one.s === a && one.copies === 0, one);
    if (u === NEAR) {
      const d = r[`u ${u}`].d = await compare(`u${u}`, `k${u}`);
      ok(`${name}, u = ${u}: the copy shows nowhere through the principal surface (the control's frame within ${SAME_FRAC})`, !!d && d.frac <= SAME_FRAC, d);
    } else ok(`${name}, u = ${u}: the surface with the copy is at least ${COVER} times the principal sheet's alone`, all.surface >= COVER * one.surface, { all: all.surface, one: one.surface });
  }
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
return { pass: fails.length === 0, fails, info };

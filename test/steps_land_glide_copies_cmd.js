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
// - departure, u = NEAR: the frame is plane a parked with All sheets on, at most END_FRAC of its pixels more than
//   DIFF_TOL apart (held_frames.js), and the control is at least MISS further from it;
// - arrival, u = 1 − NEAR: over the window ARRIVE (the part of the pane the carried points reach: the image of plane a's
//   window, a disc's worth of plane b's), the frame is plane b parked, within END_FRAC, and the control at least MISS
//   further from it (the other sheet's half of the relief is missing).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare, wordsOff, keep, compareKept } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const NEAR = 1e-4;                    // the glide's places near its ends: u and 1 − u
const END_FRAC = 0.01;                // the share of pixels a frame near an end may differ from that end's plane
const MISS = 0.03;                    // how much further from it the control is, at least
const ARRIVE = { x: [0.3, 0.7], y: [0.3, 0.7] };
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), CUBIC = step('custom', { expr: 'z^3-3z', cut: 180 });
await view(1440, 900, false, false);
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, copies }) => ({ u, s, copies }))(__cmwLandCarry() || {}))'));
// the chain steps on the Landscape (All sheets: sheets), Im heights, parked on plane k
const open = async (steps, sheets, k) => {
  await loadView('steps', 'landcopies' + Date.now(), { shapes: [], steps, sheets, srcView: { cx: 0, cy: 0, s: 90 } });
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
  return carried();
};
for (const [name, steps] of [['square root', [ROOT]], ['z³ − 3z then square root', [CUBIC, ROOT]]]) {
  const r = info[name] = {}, b = steps.length, a = b - 1;
  // plane a parked with All sheets on (kept across the page loads)
  await open(steps, true, a);
  ok(`${name}: plane ${a} with All sheets is still`, await grab('all'), null);
  await keep('all');
  await open(steps, false, b);
  ok(`${name}: plane ${b} parked is still`, await grab('pb'), null);
  await ev(`__cmwSteps({ go: ${a}, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [NEAR, 0.5, 1 - NEAR]) {
    const all = await at(a + u, 0, `u${u}`);
    if (u === NEAR) await keep(`u${u}`);
    const one = await at(a + u, 1, `k${u}`);
    if (u === NEAR) await keep(`k${u}`);
    r[`u ${u}`] = { all, one };
    ok(`${name}, u = ${u}: a carried frame from plane ${a} with the other sheet's copy`, all.s === a && all.copies === 1, all);
    ok(`${name}, u = ${u}: with the principal combo alone (K = 1) no copy is drawn`, one.s === a && one.copies === 0, one);
  }
  const dep = r.departure = { all: compareKept(`u${NEAR}`, 'all'), one: compareKept(`k${NEAR}`, 'all') };
  ok(`${name}, u = ${NEAR}: the frame is plane ${a} with All sheets (within ${END_FRAC})`, !!dep.all && dep.all.frac <= END_FRAC, dep);
  ok(`${name}, u = ${NEAR}: the control is at least ${MISS} further from it`, !!dep.all && !!dep.one && dep.one.frac >= dep.all.frac + MISS, dep);
  const arr = r.arrival = { all: await compare(`u${1 - NEAR}`, 'pb', ARRIVE), one: await compare(`k${1 - NEAR}`, 'pb', ARRIVE), whole: await compare(`u${1 - NEAR}`, 'pb') };
  ok(`${name}, u = ${1 - NEAR}: the frame is plane ${b} parked over the carried points' window (within ${END_FRAC})`, !!arr.all && arr.all.frac <= END_FRAC, arr);
  ok(`${name}, u = ${1 - NEAR}: the control is at least ${MISS} further from it`, !!arr.all && !!arr.one && arr.one.frac >= arr.all.frac + MISS, arr);
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
return { pass: fails.length === 0, fails, info };

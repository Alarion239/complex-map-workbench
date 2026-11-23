// The steps view's Landscape glide over a multivalued step draws every sheet, as the plane it arrives at does: the
// glide's frames are the copies of the carried surface, one per sheet combo of the steps the glide crosses, each placed
// by the glide's map continued on its combo, at its heights and in its colour on it (svGlideSheets, GLR.drawLandscape's
// carry.copies). Leaving plane a the copies appear at once, as All sheets draws plane a; parked with All sheets off,
// plane a shows the principal sheet alone. The Landscape, Everywhere, Im heights, the colour plane the last plane (so
// the plane a glide arrives at is coloured by its own variable), the pane's words off (held_frames.js wordsOff). Square
// root alone (from plane z) and z³ − 3z then square root (from plane w₁: the cubic's step is before the carry's source
// and has no copy), the glide onto the square root's plane at u = NEAR, 1/2 and 1 − NEAR, each frame drawn as it is and
// with the principal combo alone (__cmwSteps({ glideSheets: 1 }), the K = 1 control):
// - every frame between the planes draws one copy, the root's other sheet, and the control none;
// - departure, u = NEAR: the frame's surface (pixels of saturation over SAT, as steps_land_cover counts them) is plane
//   a parked with All sheets on's, within SAME_SURF of it, and the control's at least MISS_SURF less than the frame's.
//   (Not pixel for pixel: All sheets scale Im heights by a percentile over every sheet, a carried frame by the median
//   of the plane's, so All sheets' relief stands taller, about 5 % more surface here; the root's other sheet is about a
//   quarter of the frame's surface)
// - arrival, u = 1 − NEAR: the frame is plane b parked, at most END_FRAC of its pixels more than DIFF_TOL apart
//   (held_frames.js), and the control at least MISS further from it
//   (the other sheet's half of the relief is missing). The view is a small window about 0 (S.srcView.s = SCALE), which
//   the square root maps onto a disc that covers it: the carried points reach the whole of plane b's window.
// - the same arrival at the page's default window (S.srcView.s = WIDE), square root alone: there the corners of plane
//   b's window come from outside the carried box, on both sheets, so each copy draws the far patches the principal
//   surface draws, on its combo. The frame is plane b parked within END_FRAC, and bare where plane b has surface at
//   most WIDE_BARE pixels: every surface's far patches tear along the cut's image too, and the seams close that tear
//   past the box as they do on it (a slit across the relief, widening outward, left over 800 bare).
// - the seam where the two sheets meet: every surface drawn tears along the image of the cut, so each is drawn again
//   with the cut turned half a turn (svGlideSeams), continuous there. At u = 1/2 and 1 − NEAR, against the same frame
//   without those surfaces (the control, __cmwSteps({ glideSeams: 0 })): the seams leave at most SEAM_GAP pixels bare
//   that the control covers, and the control leaves at least SLIT_MIN bare where the frame with them has surface
//   (the slit);
//   at 1 − NEAR, against plane b parked, the frame is bare no more often than the control, and at most ARRIVE_BARE
//   pixels: the surface's outer edge, a pixel apart, and the arg line along the cut's image, a little paler where the
//   two sheets' branch point patches meet (saturation SAT or less, though drawn). (Each sheet's copy draws that patch
//   on its side of the cut, so the control's slit lies out on the box's cells alone)
// - Inside regions, an annulus about 0 under the square root: plane w parked shows the principal sheet's image of the
//   region, and so does the glide onto it: no copy at u = 1/2 and 1 − NEAR.
// - the page's own heights (log |F|) and window, square root alone: leaving plane z the other sheet has the principal's
//   modulus, so its copy lies in the principal surface's place on triangles of its own. Held at u = NEAR, 0.02, 0.05
//   and 0.15, the frame and the control (the principal combo alone) differ in at most SPECKLE isolated pixels where
//   both show surface (over SPECKLE_TOL in a channel, with at most two of their eight neighbours so): the principal
//   surface is the one shown where they coincide, where a tie in depth speckled the whole surface with the copy's
//   colours. (Where the copy slides out of it, near the cut, the two differ in whole wedges, which have few isolated
//   pixels; where it reaches past the principal surface's rim, turned about the branch point with its own far patches,
//   it adds surface where the control shows paper, at a grazing angle a dotted line of single pixels)
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
const SEAM_GAP = 20;                  // the pixels the seams' surfaces may leave bare that the frame without them covers (edges)
const ARRIVE_BARE = 300;              // arrival: the pixels the frame with the seams may leave bare against the parked plane
const SLIT_MIN = 200;                 // the slit the control leaves along the seam, at least
const SCALE = 900;                    // px per unit: a window of about ±0.5, inside the disc its square root covers
const WIDE = 60;                      // px per unit: the page's default window
const WIDE_BARE = 400;                // the pixels its arrival may leave bare where plane b parked has surface
const SPECKLE = 40, SPECKLE_TOL = 24; // log |F| heights: the isolated pixels the frame and the control may differ in, and by how much
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), CUBIC = step('custom', { expr: 'z^3-3z', cut: 180 });
await view(1440, 900, false, false);
// SAT: a surface pixel's saturation (max − min channel) is over it, as steps_land_cover counts them; floor and paper
// are grey
const SAT = 30;
// (the Landscape's surface pixels: saturation over SAT)
const surface = () => ev(`(() => { const cv = document.getElementById('canvasL'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${SAT}) n++; return n; })()`);
// the pixels bare (saturation SAT or less: floor or paper) in the kept frame tag where the kept frame ref shows
// surface: n; reverse: the other way round
const gap = (tag, ref) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(tag)}], B = window.__heldPx[${JSON.stringify(ref)}]; const sat = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${SAT}; const W = document.getElementById('canvasL').width; let n = 0, reverse = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < A.length; i += 4) { const a = sat(A, i), b = sat(B, i); if (b && !a) { n++; const p = i / 4, x = p % W, y = (p - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } if (a && !b) reverse++; } return { n, reverse, box: n ? [x0, x1, y0, y1] : null }; })()`);
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, copies }) => ({ u, s, copies }))(__cmwLandCarry() || {}))'));
// the chain steps on the Landscape (All sheets: sheets), Im heights, parked on plane k, at scale px per unit
const open = async (steps, sheets, k, scale = SCALE) => {
  await loadView('steps', 'landcopies' + Date.now(), { shapes: [], steps, sheets, srcView: { cx: 0, cy: 0, s: scale } });
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
    ok(`${name}, u = ${u}: a carried frame from plane ${a} with the other sheet's copy and the two surfaces' seams`, all.s === a && all.copies === 3, all);
    ok(`${name}, u = ${u}: with the principal combo alone (K = 1) no copy is drawn`, one.s === a && one.copies === 0, one);
  }
  const dep = r.departure = { all: r[`u ${NEAR}`].all.surface, one: r[`u ${NEAR}`].one.surface, allSheets: allSurf };
  ok(`${name}, u = ${NEAR}: the surface is plane ${a}'s with All sheets (within ${SAME_SURF})`, Math.abs(dep.all - allSurf) <= SAME_SURF * allSurf, dep);
  ok(`${name}, u = ${NEAR}: the control's surface is at least ${MISS_SURF} smaller than the frame's`, dep.one <= (1 - MISS_SURF) * dep.all, dep);
  const arr = r.arrival = { all: await compare(`u${1 - NEAR}`, 'pb'), one: await compare(`k${1 - NEAR}`, 'pb') };
  ok(`${name}, u = ${1 - NEAR}: the frame is plane ${b} parked (within ${END_FRAC})`, !!arr.all && arr.all.frac <= END_FRAC, arr);
  ok(`${name}, u = ${1 - NEAR}: the control is at least ${MISS} further from it`, !!arr.all && !!arr.one && arr.one.frac >= arr.all.frac + MISS, arr);
  // the seam: no gap where the two sheets meet, at u = 1/2 and 1 − NEAR, against the frame without the seams' surfaces
  for (const u of [0.5, 1 - NEAR]) {
    await ev('__cmwSteps({ glideSeams: 0 }); 1');
    await at(a + u, 0, `ns${u}`);
    await ev('__cmwSteps({ glideSeams: 1 }); 1');
    await at(a + u, 0, `s${u}`);
    const g = r[`seam ${u}`] = { seams: await gap(`s${u}`, 'pb'), none: await gap(`ns${u}`, 'pb'), slit: await gap(`ns${u}`, `s${u}`) };
    ok(`${name}, u = ${u}: the seams' surfaces only add surface (at most ${SEAM_GAP} px bare that the frame without them covers)`, g.slit.reverse <= SEAM_GAP, g);
    ok(`${name}, u = ${u}: the control, without them: the slit along the seam, at least ${SLIT_MIN} px bare where the frame with them has surface`, g.slit.n >= SLIT_MIN, g);
    if (u !== 0.5) ok(`${name}, u = ${u}: against plane ${b} parked, the frame with the seams is bare no more often than without them, and at most ${ARRIVE_BARE} px`, g.seams.n <= g.none.n && g.seams.n <= ARRIVE_BARE, g);
  }
  await ev('__cmwSteps({ glideSeams: 1 }); 1');
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
// ---- the arrival at the page's default window: the copy's far patches ----
{
  const r = info.wide = {};
  await open([ROOT], false, 1, WIDE);
  ok(`square root, s = ${WIDE}: plane 1 parked is still`, await grab('wpb'), null);
  await ev('__cmwSteps({ go: 0, now: true }); 1');
  await settled({ max: 60000 });
  r.frame = await at(1 - NEAR, 0, 'wide');
  r.arrival = await compare('wide', 'wpb');
  r.bare = await gap('wide', 'wpb');
  ok(`square root, s = ${WIDE}, u = ${1 - NEAR}: the frame is plane 1 parked (within ${END_FRAC}), the copy's far corners drawn`, !!r.arrival && r.arrival.frac <= END_FRAC, r);
  ok(`square root, s = ${WIDE}, u = ${1 - NEAR}: bare where plane 1 parked has surface at most ${WIDE_BARE} px (no slit along the cut past the box)`, r.bare.n <= WIDE_BARE, r);
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
// ---- the page's own heights (log |F|) and window: no speckle where the copy lies in the principal surface's place ----
{
  const r = info.modulus = {};
  // (the pixels where the kept frames a and b both show surface (saturation over SAT) and are over SPECKLE_TOL apart,
  // with at most two of their eight neighbours so)
  const speckle = (a, b) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], W = document.getElementById('canvasL').width, H = A.length / 4 / W;
    const sat = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${SAT};
    const D = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) { const i = 4 * k; D[k] = sat(A, i) && sat(B, i) && Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${SPECKLE_TOL} ? 1 : 0; }
    let n = 0, all = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (!D[k]) continue; all++; const m = D[k - W - 1] + D[k - W] + D[k - W + 1] + D[k - 1] + D[k + 1] + D[k + W - 1] + D[k + W] + D[k + W + 1]; if (m <= 2) n++; }
    return { isolated: n, apart: all }; })()`);
  await loadView('steps', 'landcopiesabs' + Date.now(), { shapes: [], steps: [ROOT], sheets: false });
  await settled({ max: 30000, until: READY });
  await wordsOff();
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  r.height = await ev('(document.querySelector("#heightSeg button[aria-pressed=true], #heightSeg button.on") || {}).dataset?.v || null');
  for (const u of [NEAR, 0.02, 0.05, 0.15]) {
    const all = await at(u, 0, `m${u}`);
    const one = await at(u, 1, `mk${u}`);
    const sp = r[`u ${u}`] = Object.assign({ copies: all.copies }, await speckle(`m${u}`, `mk${u}`));
    ok(`log |F| heights, u = ${u}: where both show surface, the frame with the other sheet's copy and the control differ in at most ${SPECKLE} isolated pixels (no speckle)`, all.copies >= 1 && sp.isolated <= SPECKLE, sp);
  }
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
return { pass: fails.length === 0, fails, info };

// A glide frame draws the cut the way the plane it is nearest to draws it at rest: the casing, the line, the hatches on its closed side, the dot at
// the branch point and the handle (the picture is the pane's canvas with its overlay over it). The glide frame END_EPS of a step from plane 0, with
// Square root's cut on plane 0, is compared with that parked plane over the band BAND_PX of rows each side of the cut's ray, which holds the cut and
// nothing else of the picture but the colour: each pixel passes when some pixel of the parked frame's 3 x 3 around it is within TOL levels of it (the
// ruler's one pixel of rasterization), and at most SAME_FRAC of the band's pixels may fail. The handle's disc is checked apart, in a box around the
// parked handle, the same way, and the glide leaves it no hit target (an inert handle). Controls (each must fail the same measure): the glide frame against the plane it arrives at, and the parked plane
// against itself shifted SHIFT_PX px. A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (TOL levels of 255 per channel; SAME_FRAC the share of a region's pixels that may fail; CONTROL_FACTOR how many times SAME_FRAC a control must exceed;
// MIN_PIXELS the least count compared; BAND_PX rows each side of the cut's row; DISC_R the half width of the box around the handle's disc; CHIP_W how far right of the handle the chip's label reaches;
// SHIFT_PX the shift of the control; CHIP_EDGE_MAX the share of the handle chip's pixels that may have no pixel of the parked chip's 3 x 3 within TOL (the label's glyphs are anti-aliased at the handle's place, which
// a glide frame has moved by 0.04 px at END_EPS: text edges differ by more than TOL for that; the share falls with the motion, which CHIP_SCALE checks, and a 2 px shift of the chip fails it); CHIP_SCALE the most the share may be, at a tenth of END_EPS, of that at END_EPS; END_EPS how far a step the glide frame is from its parked plane, so that its motion is below a hundredth of a pixel)
const TOL = 6, SAME_FRAC = 0.005, CONTROL_FACTOR = 10, MIN_PIXELS = 5000, BAND_PX = 12, DISC_R = 9, CHIP_W = 90, SHIFT_PX = 2, END_EPS = 1e-4, CHIP_EDGE_MAX = 0.1, CHIP_SCALE = 0.2, MID_U = 0.5, STEP_U = 0.02, JUMP_RATIO = 3, JUMP_FLOOR_PX = 4;
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = exampleNames();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// the picture of the left pane (its canvas with its overlay over it) kept in the page as window.__cutPx[tag] once two reads 100 ms apart agree
const grab = async (tag) => {
  for (let k = 0; k < 40; k++) {
    const r = await ev(`(() => {
      const cv = document.getElementById('canvasL'), ov = document.getElementById('overlayL'), c = document.createElement('canvas');
      c.width = cv.width; c.height = cv.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0); x.drawImage(ov, 0, 0, cv.width, cv.height);
      const d = x.getImageData(0, 0, c.width, c.height).data, key = d.length + ':' + d.reduce((a, v, i) => (i % 97 === 0 ? (a * 31 + v) | 0 : a), 7);
      window.__cutPx = window.__cutPx || {};
      const same = window.__cutKey === key; window.__cutKey = key; window.__cutPx[${JSON.stringify(tag)}] = d; return { same, W: c.width, H: c.height };
    })()`);
    if (r.same) return r;
    await pause(100);
  }
  return null;
};
const frameAt = async (state) => {
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: false }); ${state}; 1`);
  await settled({ max: 20000 });
};
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=glidecut${Date.now()}` });
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
await ev(`__cmwExample(${names.indexOf('Square root and its sheets')}); 1`); await settled({ max: 20000 });
await frameAt('__cmwSteps({ park: 0 })'); const dim = await grab('parked0');
ok('the parked plane 0 is drawn', !!dim, dim);
await frameAt(`__cmwSteps({ x: ${END_EPS} })`); ok('the glide frame near plane 0 is drawn', !!(await grab('glide')), null);
const glideHandles = await ev('__cmwCutHandles().length');
await frameAt(`__cmwSteps({ x: ${END_EPS / 10} })`); ok('the glide frame a tenth of that near plane 0 is drawn', !!(await grab('glideTenth')), null);
const glidePath = await ev('(__cmwSteps().glide || {}).path');
// the handle drawn across the middle of the glide: its place at u = MID_U - 2 STEP_U ... MID_U + 2 STEP_U; the jump from one side of the middle to the other is at most JUMP_RATIO times the larger move between neighbouring steps (and JUMP_FLOOR_PX px)
const handleAt = async (u) => { await frameAt(`__cmwSteps({ x: ${u} })`); return ev('(() => { const m = __cmwCutMarks()[0]; return m ? [m.x, m.y] : null; })()'); };
const mid = [];
for (const k of [-3, -1, 1, 3]) mid.push(await handleAt(MID_U + k * STEP_U / 2));
info.mid = mid;
ok('the glide frame draws the cut handle on both sides of the middle', mid.every((m) => !!m), mid);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
if (mid.every((m) => !!m)) {
  const jump = dist(mid[1], mid[2]), walk = Math.max(dist(mid[0], mid[1]), dist(mid[2], mid[3]));
  info.midJump = { jump, walk };
  ok(`the handle is continuous across the middle: its move from u = ${MID_U - STEP_U / 2} to ${MID_U + STEP_U / 2} is at most ${JUMP_RATIO} times the move between neighbouring steps (at least ${JUMP_FLOOR_PX} px)`, jump <= Math.max(JUMP_FLOOR_PX, JUMP_RATIO * walk), { jump, walk });
}
await frameAt('__cmwSteps({ park: 1 })'); ok('the parked plane 1 is drawn', !!(await grab('parked1')), null);
await frameAt('__cmwSteps({ park: 0 })'); await grab('parked0');
// the picture of a region of a frame against a parked one: { n, fail, failShift } (n: the pixels, fail: the share without a pixel of the other's 3 x 3 within TOL; failShift: the same with this frame shifted SHIFT_PX px)
const measure = (tag, ref, box, skip = null) => ev(`(() => {
  const G = window.__cutPx[${JSON.stringify(tag)}], P = window.__cutPx[${JSON.stringify(ref)}], W = ${dim.W}, H = ${dim.H}, b = ${JSON.stringify(box)}, skip = ${JSON.stringify(skip)};
  const near = (gx, gy, x, y) => {
    const gi = 4 * (gy * W + gx);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = Math.min(W - 1, Math.max(0, x + dx)), Y = Math.min(H - 1, Math.max(0, y + dy)), i = 4 * (Y * W + X);
      if (Math.max(Math.abs(G[gi] - P[i]), Math.abs(G[gi + 1] - P[i + 1]), Math.abs(G[gi + 2] - P[i + 2])) <= ${TOL}) return true;
    }
    return false;
  };
  let n = 0, fail = 0, shifted = 0;
  for (let y = Math.max(0, b.y0); y < Math.min(H, b.y1); y++) for (let x = Math.max(0, b.x0); x < Math.min(W, b.x1); x++) {
    if (skip && x >= skip.x0 && x < skip.x1) continue;
    n++; if (!near(x, y, x, y)) fail++; if (!near(Math.min(W - 1, x + ${SHIFT_PX}), y, x, y)) shifted++;
  }
  return { n, fail: n ? +(fail / n).toFixed(4) : null, failShift: n ? +(shifted / n).toFixed(4) : null };
})()`);
// the cut's row and the handle of plane 0, read from the parked frame: the handle's place (canvas pixels) is where the page reports its hit target
await frameAt('__cmwSteps({ park: 0 })'); await grab('parked0');
const hd = await ev(`(() => { const hs = __cmwCutHandles(), cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(); const h = hs[0]; return h ? { x: (h.x - r.left) * cv.width / r.width, y: (h.y - r.top) * cv.height / r.height } : null; })()`);
ok('the parked plane 0 has a cut handle', !!hd, hd);
const row = Math.round(hd.y), hx = Math.round(hd.x);
// (the band holds the cut's line, hatches and dot but not the handle's chip, which is judged apart under its own bound, CHIP_EDGE_MAX; the disc is checked apart too)
const band = { x0: 0, x1: dim.W, y0: row - BAND_PX, y1: row + BAND_PX }, disc = { x0: hx - DISC_R, x1: hx + DISC_R, y0: row - DISC_R, y1: row + DISC_R };
const chipSkip = { x0: hx + DISC_R, x1: hx + CHIP_W }, chip = { x0: chipSkip.x0, x1: chipSkip.x1, y0: row - BAND_PX, y1: row + BAND_PX };
const rows = {
  'the glide frame': await measure('glide', 'parked0', band, chipSkip), 'the glide frame, its handle': await measure('glide', 'parked0', disc),
  'the parked plane against itself': await measure('parked0', 'parked0', band, chipSkip),
  'the glide frame against plane 1': await measure('glide', 'parked1', band, chipSkip),
  'the glide frame, its chip': await measure('glide', 'parked0', chip), 'the glide frame a tenth of that near, its chip': await measure('glideTenth', 'parked0', chip), 'the parked plane against itself, the chip': await measure('parked0', 'parked0', chip),
};
info.path = glidePath; info.glideHandles = glideHandles; info.rows = rows;
ok(`the glide near plane 0 is drawn by the inverse pass`, glidePath === 'inverse', glidePath);
ok(`the cut's band of the glide frame ${END_EPS} past plane 0 is the parked plane's within one pixel, at most ${SAME_FRAC * 100} % of its pixels without a pixel of its 3 x 3 within ${TOL} levels`, rows['the glide frame'].n > MIN_PIXELS && rows['the glide frame'].fail <= SAME_FRAC, rows['the glide frame']);
ok(`the cut's handle disc of the glide frame is the parked plane's, within the same bound`, rows['the glide frame, its handle'].n > 0 && rows['the glide frame, its handle'].fail <= SAME_FRAC, rows['the glide frame, its handle']);
ok('the glide frame draws the handle but gives it no hit target (it is inert while the glide moves)', glideHandles === 0, glideHandles);
ok(`the handle's chip (label and pill) of the glide frame: at most ${CHIP_EDGE_MAX * 100} % of its pixels without a pixel of the parked chip's 3 x 3 within ${TOL} levels`, rows['the glide frame, its chip'].n > 0 && rows['the glide frame, its chip'].fail <= CHIP_EDGE_MAX, rows['the glide frame, its chip']);
ok(`the chip's difference is rasterization: at a tenth of that distance from plane 0 the share is at most ${CHIP_SCALE} of it`, rows['the glide frame a tenth of that near, its chip'].fail <= CHIP_SCALE * rows['the glide frame, its chip'].fail, { tenth: rows['the glide frame a tenth of that near, its chip'], full: rows['the glide frame, its chip'] });
ok(`the control: the parked chip against itself shifted ${SHIFT_PX} px: more than ${CHIP_EDGE_MAX * 100} % of its pixels fail`, rows['the parked plane against itself, the chip'].failShift > CHIP_EDGE_MAX, rows['the parked plane against itself, the chip']);
ok('the control: the parked chip against itself: no pixel fails', rows['the parked plane against itself, the chip'].fail === 0, rows['the parked plane against itself, the chip']);
ok('the control: the parked plane against itself: no pixel fails', rows['the parked plane against itself'].fail === 0, rows['the parked plane against itself']);
ok(`the control: the parked plane against itself shifted ${SHIFT_PX} px: more than ${CONTROL_FACTOR * SAME_FRAC * 100} % of the band fails`, rows['the parked plane against itself'].failShift > CONTROL_FACTOR * SAME_FRAC, rows['the parked plane against itself']);
ok(`the control: the same glide frame against plane 1: more than ${CONTROL_FACTOR * SAME_FRAC * 100} % of the band fails`, rows['the glide frame against plane 1'].fail > CONTROL_FACTOR * SAME_FRAC, rows['the glide frame against plane 1']);
return { pass: fails.length === 0, fails, info };

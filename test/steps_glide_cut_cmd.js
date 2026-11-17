// A glide frame draws the cut the way the plane it is nearest to draws it at rest: the casing, the line, the hatches on its closed side, the dot at
// the branch point and the handle (the picture is the pane's canvas with its overlay over it). The glide frame END_EPS of a step from plane 0, with
// Square root's cut on plane 0, is compared with that parked plane over the band BAND_PX of rows each side of the cut's ray, which holds the cut and
// nothing else of the picture but the colour: each pixel passes when some pixel of the parked frame's 3 x 3 around it is within TOL levels of it (the
// ruler's one pixel of rasterization), and at most SAME_FRAC of the band's pixels may fail. The handle's disc is checked apart, in a box around the
// parked handle, the same way, and the glide leaves it no hit target (an inert handle). Controls (each must fail the same measure): the glide frame against the plane it arrives at, and the parked plane
// against itself shifted SHIFT_PX px. The dashed bank's dashes keep the parked plane's phase at the arrival and through the glide (read off the line's red
// along the bank's polyline). A glide frame's handle is never drawn hot, and labels keep clear of its chip. The glide frames are under way, the thread held by a scrub on the rail; a frame parked between two planes draws no handle.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (TOL levels of 255 per channel; SAME_FRAC the share of a region's pixels that may fail; CONTROL_FACTOR how many times SAME_FRAC a control must exceed;
// MIN_PIXELS the least count compared; BAND_PX rows each side of the cut's row; DISC_R the half width of the box around the handle's disc; CHIP_W how far right of the handle the chip's label reaches;
// SHIFT_PX the shift of the control; CHIP_EDGE_MAX the share of the handle chip's pixels that may have no pixel of the parked chip's 3 x 3 within TOL (the label's glyphs are anti-aliased at the handle's place, which
// a glide frame has moved by 0.04 px at END_EPS: text edges differ by more than TOL for that; the share falls with the motion, which CHIP_SCALE checks, and a 2 px shift of the chip fails it); CHIP_SCALE the most the share may be, at a tenth of END_EPS, of that at END_EPS; END_EPS how far a step the glide frame is from its parked plane, so that its motion is below a hundredth of a pixel)
const TOL = 6, SAME_FRAC = 0.005, CONTROL_FACTOR = 10, MIN_PIXELS = 5000, BAND_PX = 12, DISC_R = 9, CHIP_W = 90, SHIFT_PX = 2, END_EPS = 1e-4, CHIP_EDGE_MAX = 0.1, CHIP_SCALE = 0.2, MID_U = 0.5, STEP_U = 0.02, JUMP_RATIO = 3, JUMP_FLOOR_PX = 4;
const names = exampleNames();
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
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
  await ev('if (window.__svScrubUp) { window.__svScrubUp(); window.__svScrubUp = null; } 1');
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: false }); ${state}; 1`);
  await settled({ max: 20000 });
};
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=glidecut${Date.now()}` });
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
// a glide frame at u, under way: the thread held there by a scrub on the rail not let go, as a user holds it (held_frames.js), then put at u exactly
const heldAt = async (u) => {
  await frameAt('__cmwSteps({ park: 0 })');
  await hold(u);
  await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: 20000 });
};
await ev(`__cmwExample(${names.indexOf('Square root and its sheets')}); 1`); await settled({ max: 20000 });
await frameAt('__cmwSteps({ park: 0 })'); const dim = await grab('parked0');
ok('the parked plane 0 is drawn', !!dim, dim);
await heldAt(END_EPS); ok('the glide frame near plane 0 is drawn', !!(await grab('glide')), null);
const glideHandles = await ev('__cmwCutHandles().length');
await heldAt(END_EPS / 10); ok('the glide frame a tenth of that near plane 0 is drawn', !!(await grab('glideTenth')), null);
const glidePath = await ev('(__cmwSteps().glide || {}).path');
// the handle drawn across the middle of the glide: its place at u = MID_U - 2 STEP_U ... MID_U + 2 STEP_U; the jump from one side of the middle to the other is at most JUMP_RATIO times the larger move between neighbouring steps (and JUMP_FLOOR_PX px)
const handleAt = async (u) => { await heldAt(u); return ev('(() => { const m = __cmwCutMarks()[0]; return m ? [m.x, m.y] : null; })()'); };
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
// A frame parked between two planes draws no handle: there one would look draggable and take no press. The pictures (the pane with its overlay) of the
// glide frame held at MID_U and of the frame parked there are read in the held frame's chip box: from DISC_R + CHIP_GAP px right of its handle to CHIP_W,
// BAND_PX rows each side, clear of the cut's line through the handle. A pixel there in the cut's red counts (the chip's border and its "θ" label; the
// control: the held frame's count is over MIN_INK)
const MIN_INK = 50, CHIP_GAP = 4;
const inkAt = (tag, m) => ev(`(() => {
  // (m: the mark's place on the page, as __cmwCutMarks gives it)
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), k = cv.width / r.width, W = cv.width, H = cv.height, d = window.__cutPx[${JSON.stringify(tag)}], m = ${JSON.stringify(m)};
  const mx = m[0] - r.left, my = m[1] - r.top;
  let n = 0;
  for (let y = Math.max(0, Math.round((my - ${BAND_PX}) * k)); y < Math.min(H, Math.round((my + ${BAND_PX}) * k)); y++)
    for (let x = Math.max(0, Math.round((mx + ${DISC_R + CHIP_GAP}) * k)); x < Math.min(W, Math.round((mx + ${CHIP_W}) * k)); x++) { const i = 4 * (y * W + x); if (d[i] > 150 && d[i + 1] < 110 && d[i + 2] < 100) n++; }
  return n;
})()`);
await heldAt(MID_U);
const heldMark = await ev('(() => { const m = __cmwCutMarks()[0]; return m ? [m.x, m.y] : null; })()');
ok('the glide frame held at the middle is drawn', !!(await grab('heldMid')), null);
await frameAt(`__cmwSteps({ park: ${MID_U} })`);
ok('the frame parked at the middle is drawn', !!(await grab('pausedMid')), null);
const paused = { moving: await ev('__cmwSteps().moving'), label: await ev('__cmwSteps().label'), marks: await ev('__cmwCutMarks().length'), handles: await ev('__cmwCutHandles().length'), heldMark };
if (heldMark) Object.assign(paused, { heldInk: await inkAt('heldMid', heldMark), ink: await inkAt('pausedMid', heldMark) });
info.paused = paused;
ok(`the control: the glide frame held at u = ${MID_U} draws its handle's chip, over ${MIN_INK} pixels of the cut's red in its box`, !!heldMark && paused.heldInk > MIN_INK, paused);
ok(`a frame parked at u = ${MID_U}, between two planes, draws no cut handle: no mark, no hit target and none of the chip's red in the held frame's chip box`, paused.marks === 0 && paused.handles === 0 && paused.ink === 0, paused);
// A glide frame's handle is never drawn hot: the hover a parked plane's handle had (the pointer left on it, the pane's pointer not moved since) does
// not carry over to the inert mark. Two pictures are compared within RING_R px of a handle, the pixels more than TOL levels apart counted: the parked
// plane 0 with the pointer on its handle against with the pointer away (the control: a hot handle is drawn bigger, HOT_MIN px differ at least), then
// the frame held at MID_U, the pointer left on plane 0's handle against away from it, round its mark: at most HOT_TOL px differ
const RING_R = 10, HOT_MIN = 20, HOT_TOL = 3;
const ringDiff = (a, b, m) => ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), k = cv.width / r.width, W = cv.width, H = cv.height, A = window.__cutPx[${JSON.stringify(a)}], B = window.__cutPx[${JSON.stringify(b)}];
  const cx = (${m[0]} - r.left) * k, cy = (${m[1]} - r.top) * k, R = ${RING_R} * k;
  let n = 0;
  for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(H, Math.ceil(cy + R)); y++)
    for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(W, Math.ceil(cx + R)); x++) {
      const i = 4 * (y * W + x);
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R && Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${TOL}) n++;
    }
  return n;
})()`);
await frameAt('__cmwSteps({ park: 0 })');
const hot = { handle: await ev('(() => { const h = __cmwCutHandles()[0]; return h ? [h.x, h.y] : null; })()') };
const isXY = (q) => Array.isArray(q) && q.length === 2 && q.every(Number.isFinite);
ok('the parked plane 0 has a cut handle to hover', isXY(hot.handle), hot);
if (isXY(hot.handle)) {
  const away = [hot.handle[0] + 150, hot.handle[1] - 120];
  await move(...away); await settled({ max: 20000 }); ok('the parked plane 0, the pointer away, is drawn', !!(await grab('p0cold')), null);
  await move(...hot.handle); await settled({ max: 20000 }); ok('the parked plane 0, the pointer on its handle, is drawn', !!(await grab('p0hot')), null);
  await heldAt(MID_U); hot.mark = await ev('(() => { const m = __cmwCutMarks()[0]; return m ? [m.x, m.y] : null; })()');
  ok('the frame held at the middle, the pointer left on plane 0\'s handle, is drawn', !!(await grab('heldHot')), null);
  await frameAt('__cmwSteps({ park: 0 })'); await move(...away); await settled({ max: 20000 });
  await heldAt(MID_U); ok('the frame held at the middle, the pointer away, is drawn', !!(await grab('heldCold')), null);
  hot.parked = await ringDiff('p0hot', 'p0cold', hot.handle);
  if (hot.mark) hot.held = await ringDiff('heldHot', 'heldCold', hot.mark);
}
info.hot = hot;
ok(`the control: the parked plane 0's handle with the pointer on it is drawn hot: ${HOT_MIN} px or more round it differ from the pointer away`, hot.parked >= HOT_MIN, hot);
ok(`the mark of the frame held at u = ${MID_U} is not drawn hot after the pointer was left on plane 0's handle: at most ${HOT_TOL} px round it differ from the pointer away`, !!hot.mark && hot.held <= HOT_TOL, hot);
// Labels keep clear of a glide frame's handle: a point put where its picture in the frame held at MID_U lies LABEL_DX, LABEL_DY px from the mark (its
// place in plane z solved from the frame's own map, __cmwSteps().glide.H, to within LABEL_FIT px), so that its label's first spots are on the handle's
// chip. No label of that frame overlaps the chip's box, as the label pass keeps it: CHIP_BOX px left, right, up and down of the mark
const LABEL_DX = 30, LABEL_DY = 6, LABEL_FIT = 3, CHIP_BOX = [8, 84, 11, 11];
await heldAt(MID_U);
const lab = await ev(`(() => {
  const r = document.getElementById('canvasL').getBoundingClientRect(), m = __cmwCutMarks()[0], g = __cmwSteps().glide;
  if (!m || !g || !g.H) return null;
  const tx = m.x - r.left + ${LABEL_DX}, ty = m.y - r.top + ${LABEL_DY};
  const scr = (z) => { const w = g.H(z); return w && Number.isFinite(w.re) && Number.isFinite(w.im) ? [g.w / 2 + (w.re - g.view.cx) * g.view.s, g.h / 2 - (w.im - g.view.cy) * g.view.s] : null; };
  let best = null, bd = Infinity;
  for (let a = -4; a <= 4; a += 0.02) for (let b = -4; b <= 4; b += 0.02) { const p = scr({ re: a, im: b }); if (p) { const dd = Math.hypot(p[0] - tx, p[1] - ty); if (dd < bd) { bd = dd; best = [a, b]; } } }
  return best && { z: best, fit: +bd.toFixed(2) };
})()`);
ok(`a point of plane z lands ${LABEL_DX}, ${LABEL_DY} px from the held frame's mark, within ${LABEL_FIT} px`, !!lab && lab.fit <= LABEL_FIT, lab);
if (lab) {
  await frameAt('__cmwSteps({ park: 0 })');
  await ev(`__cmwSet('shapes', __cmwShapes().shapes.concat([{ id: 'chipLabel', kind: 'point', p: ${JSON.stringify(lab.z)}, ci: 1, visible: true }])), 1`);
  await settled({ max: 20000 });
  await heldAt(MID_U); await settled({ max: 20000, until: '__cmwLabelsPlaced().length > 0' });
  Object.assign(lab, await ev(`(() => {
    const r = document.getElementById('canvasL').getBoundingClientRect(), m = __cmwCutMarks()[0];
    if (!m) return { mark: null };
    const mx = m.x - r.left, my = m.y - r.top, b = { x0: mx - ${CHIP_BOX[0]}, x1: mx + ${CHIP_BOX[1]}, y0: my - ${CHIP_BOX[2]}, y1: my + ${CHIP_BOX[3]} };
    const placed = __cmwLabelsPlaced(), on = placed.filter((q) => q.x < b.x1 && q.x1 > b.x0 && q.y < b.y1 && q.y1 > b.y0);
    return { mark: [mx, my], box: b, placed, on };
  })()`));
}
info.labels = lab;
ok('the frame held at the middle places labels', !!lab && !!lab.placed && lab.placed.length > 0, lab);
ok('no label of the frame held at the middle lies on its handle\'s chip', !!lab && !!lab.mark && Array.isArray(lab.on) && lab.on.length === 0, lab);
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
// The dashed bank: its dashes keep the phase the parked plane gives them, counted from the bank's start, at the arrival (the glide frame END_EPS short of
// plane 1 against the parked plane 1) and through the glide (at DASH_US). The phase is read off the pane's canvas along the bank's own polyline
// (__cmwCutCurves), a sample every DASH_STEP px of arc length from DASH_SKIP px on, a sample on where the line's red is there: the offset in [0, DASH_PERIOD)
// whose pattern (on for DASH_ON px of each DASH_PERIOD, the app's [6, 4]) agrees with most samples. Each reading needs MIN_DASH_SAMPLES samples and an agreement
// of DASH_AGREE (the pattern was read, not noise). Control: the parked plane's samples read DASH_SHIFT px further along give a phase more than PHASE_TOL away
const DASH_ON = 6, DASH_PERIOD = 10, DASH_STEP = 0.25, DASH_SKIP = 4, MIN_DASH_SAMPLES = 500, DASH_AGREE = 0.8, PHASE_TOL = 1, DASH_SHIFT = 3, DASH_US = [0.5, 0.9];
const dashPhase = (shift = 0) => ev(`(() => {
  const cv = document.getElementById('canvasL'), r = cv.getBoundingClientRect(), k = cv.width / r.width, W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  const bank = __cmwCutCurves().find((c) => c.step === 1 && !c.solid);
  if (!bank) return null;
  // (the line's red at a pixel: the cut's ink, not its casing nor the picture under it)
  const red = (x, y) => { const j = 4 * (y * W + x); return d[j] > 170 && d[j + 1] < 120 && d[j + 2] < 100; };
  const on = [], ts = [];
  let t = 0;
  for (let i = 1; i < bank.s.length; i++) {
    const a = bank.s[i - 1], b = bank.s[i];
    if (!a || !b) break;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let u = 0; u < L; u += ${DASH_STEP}) {
      const px = (a[0] + (b[0] - a[0]) * u / L) * k, py = (a[1] + (b[1] - a[1]) * u / L) * k, x = Math.round(px), y = Math.floor(py);
      if (t + u < ${DASH_SKIP} || x < 1 || y < 0 || x >= W || y >= H) continue;
      on.push(red(x, y) || red(x - 1, y)); ts.push(t + u + ${shift});
    }
    t += L;
  }
  let best = { phase: null, agree: -1 };
  for (let o = 0; o < ${DASH_PERIOD}; o += ${DASH_STEP}) {
    let g = 0;
    for (let i = 0; i < on.length; i++) if (on[i] === ((ts[i] + o) % ${DASH_PERIOD} < ${DASH_ON})) g++;
    if (g > best.agree) best = { phase: o, agree: g };
  }
  return { n: on.length, phase: best.phase, agree: +(best.agree / Math.max(1, on.length)).toFixed(3) };
})()`);
const phaseGap = (a, b) => { const g = Math.abs(a - b) % DASH_PERIOD; return Math.min(g, DASH_PERIOD - g); };
const read = (q) => !!q && q.n > MIN_DASH_SAMPLES && q.agree >= DASH_AGREE;
await frameAt('__cmwSteps({ park: 1 })');
const dash = { parked1: await dashPhase(), parked1Shifted: await dashPhase(DASH_SHIFT) };
await frameAt(`__cmwSteps({ x: ${1 - END_EPS} })`); dash.arrive = await dashPhase();
for (const u of DASH_US) { await frameAt(`__cmwSteps({ x: ${u} })`); dash['u' + u] = await dashPhase(); }
info.dash = dash;
ok('the parked plane 1\'s dashed bank is read', read(dash.parked1), dash.parked1);
ok(`the control: the parked plane 1's dashes read ${DASH_SHIFT} px further along are more than ${PHASE_TOL} px out of phase`, read(dash.parked1Shifted) && phaseGap(dash.parked1Shifted.phase, dash.parked1.phase) > PHASE_TOL, dash);
ok(`the dashed bank of the glide frame ${END_EPS} short of plane 1 has the parked plane 1's dash phase, within ${PHASE_TOL} px`, read(dash.arrive) && read(dash.parked1) && phaseGap(dash.arrive.phase, dash.parked1.phase) <= PHASE_TOL, dash);
for (const u of DASH_US) ok(`the dashed bank at u = ${u} has the parked plane's dash phase from the bank's start, within ${PHASE_TOL} px`, read(dash['u' + u]) && read(dash.parked1) && phaseGap(dash['u' + u].phase, dash.parked1.phase) <= PHASE_TOL, dash);
return { pass: fails.length === 0, fails, info };

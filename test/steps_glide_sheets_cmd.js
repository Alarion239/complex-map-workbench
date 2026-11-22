// The steps view's 2D glide over a multivalued step draws every sheet, as the plane it arrives at does: the glide's
// frames are the copies of plane z, one per sheet combo of the steps it crosses, each placed by the glide's map
// continued on its combo and coloured on it. The Plane surface, Everywhere, the colour plane the last plane (so the
// plane a glide arrives at is coloured by its own variable over the whole plane), no lines, paths or strokes, and
// the arrival plane's picture under a glide's carried colour left out (__cmwSteps({ restPaint: 0 }); that picture is
// steps_glide_rest_paint_cmd.js's), so that a frame's paper is where no copy is drawn:
// - square root alone (the inverse path) and z⁵ − 5z then square root (the mesh path: a quintic has no inverse plan),
//   the glide onto the square root's plane at u = SHORT, 1/2 and 1 − SHORT, and at u = TINY and 1 − TINY:
//   - no frame leaves paper where the copies' images cover the plane: its paper share is at most PAPER_MAX (one sheet
//     leaves the left half paper, about 0.5);
//   - at u = 1 − TINY the frame is as close to the plane it arrives at, parked, as the frame at u = TINY is to the
//     plane it leaves (no sheet is missing at either end): the share of pixels more than DIFF_TOL apart
//     (held_frames.js) at most SAME_FRAC over the departure's. (A glide frame and a parked plane are drawn by different
//     passes, whose colour bands meet a pixel apart: a few per cent of the pane at either end, with the principal sheet
//     alone too; one sheet missing on arrival is half the pane);
// - each frame between the planes is coloured as the parked plane it arrives at: its share of pixels of saturation over
//   SAT (no paper, no black) at least the parked plane's less COLOUR_TOL;
// - the K = 1 control (__cmwSteps({ glideSheets: 1 }): the principal combo alone) leaves the left half paper again, so
//   the rows above read the sheets the glide draws;
// - the logarithm (an infinitely sheeted step), zoomed out to LOG_SCALE px per unit: the glide's record names the sheets
//   it draws (sheetKs), the window −W..W about the principal sheet, each once (W = S.sheetW, 2), and near u = 1 the
//   frame is as much paper above the real axis as below it, within SYM_TOL (the window of sheets is symmetric about 0);
// - combos the glide's planes cannot tell apart are drawn once, and combos they can are all drawn (a frame is placed by
//   the map to the plane it leaves and coloured by the map to the plane it reaches), at u = 1/2:
//   - log, exp, sin, then a cube root, onto the root's plane: exp undoes the logarithm's sheet before both planes, so the
//     record's sheets are the root's 3, not the 8 its 15 combos would fill;
//   - square root then z², onto z²'s plane: z² undoes the root's sheet on the plane the glide reaches but not on the one
//     it leaves, so both sheets are drawn (2) and the frame leaves no paper (at most PAPER_MAX);
//   - log then exp, onto exp's plane: the same, the logarithm's 5 sheets;
// - Inside regions, an annulus about 0 under the square root: plane w parked shows the principal sheet's image of the
//   region, and so does the glide onto it: no copies (its record's sheets 1), and at u = 1 − TINY the frame is as close
//   to the parked plane as at u = TINY to the plane it leaves, within SAME_FRAC.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SHORT = 0.002, TINY = 1e-4;     // the glide's places near its ends: u and 1 − u
const PAPER_MAX = 0.005;              // the share of the pane a frame may leave paper (the cut's seam, the pane's rim)
const SAME_FRAC = 0.005;              // how much further the arrival frame may be from its plane than the departure frame from its own
const ONE_SHEET = 0.4;                // with the principal combo alone, at least this share is paper near u = 1
const SAT = 40, COLOUR_TOL = 0.05;    // a coloured pixel's saturation (max − min channel), and how much less of them a frame may have
const LOG_SCALE = 12, SYM_TOL = 0.03; // the logarithm's zoomed-out view (px per unit), and how far apart its halves' paper may be
const READY = 'typeof __cmwSteps === "function" && !!window.GLR';
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const step = (type, params) => ({ type, params: params || {}, on: true });
const ROOT = step('root', { n: 2, cut: 180 }), QUINTIC = step('custom', { expr: 'z^5-5z', cut: 180 });
await view(1440, 900, false, false);
// PAPER: the page's white, a channel over it is paper
const PAPER = 250;
// (the share of the kept frame tag that is paper: every channel over PAPER)
const paper = (tag) => ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}]; let n = 0, p = 0; for (let i = 0; i < P.length; i += 4) { n++; if (P[i] > ${PAPER} && P[i + 1] > ${PAPER} && P[i + 2] > ${PAPER}) p++; } return +(p / n).toFixed(4); })()`);
// (the share of the kept frame tag that is coloured: saturation over SAT; with half: the top or bottom half's paper)
const coloured = (tag) => ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}]; let n = 0, c = 0; for (let i = 0; i < P.length; i += 4) { n++; if (Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${SAT}) c++; } return +(c / n).toFixed(4); })()`);
const halfPaper = (tag, top) => ev(`(() => { const P = window.__heldPx[${JSON.stringify(tag)}], cv = document.getElementById('canvasL'), W = cv.width, H = cv.height; let n = 0, p = 0; for (let y = ${top ? 0 : 'Math.ceil(H / 2)'}; y < ${top ? 'Math.floor(H / 2)' : 'H'}; y++) for (let x = 0; x < W; x++) { const i = 4 * (y * W + x); n++; if (P[i] > ${PAPER} && P[i + 1] > ${PAPER} && P[i + 2] > ${PAPER}) p++; } return +(p / n).toFixed(4); })()`);
const at = async (x, tag) => {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, await grab(tag), null);
  return { paper: await paper(tag), coloured: await coloured(tag), glide: JSON.parse(await ev('JSON.stringify((({ path, u, sheets, sheetKs }) => ({ path, u, sheets, sheetKs }))(__cmwSteps().glide || {}))')) };
};
for (const [name, steps, path] of [['square root', [ROOT], 'inverse'], ['z⁵ − 5z then square root', [QUINTIC, ROOT], 'mesh']]) {
  const r = info[name] = {};
  await loadView('steps', 'glidesheets' + Date.now(), { shapes: [], steps, srcView: { cx: 0, cy: 0, s: 90 } });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true, restPaint: 0 }); 1`);
  await settled({ max: 60000 });
  const b = steps.length, a = b - 1;
  // the planes at the glide's ends, parked
  for (const k of [a, b]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
    await settled({ max: 60000 });
    ok(`${name}: plane ${k} parked is still`, await grab(`p${k}`), null);
    r[`parked ${k}`] = { paper: await paper(`p${k}`), coloured: await coloured(`p${k}`) };
  }
  ok(`${name}: plane ${b} parked is coloured all over (paper ≤ ${PAPER_MAX})`, r[`parked ${b}`].paper <= PAPER_MAX, r[`parked ${b}`]);
  await ev(`__cmwSteps({ go: ${a}, now: true }); 1`);
  await settled({ max: 60000 });
  for (const u of [SHORT, 0.5, 1 - SHORT]) {
    const f = r[`u ${u}`] = await at(a + u, `u${u}`);
    ok(`${name}, u = ${u}: the ${path} path draws the glide`, f.glide.path === path, f);
    ok(`${name}, u = ${u}: every sheet's copy is drawn (paper ≤ ${PAPER_MAX})`, f.paper <= PAPER_MAX, f);
    ok(`${name}, u = ${u}: the frame is coloured as plane ${b} parked (within ${COLOUR_TOL})`, f.coloured >= r[`parked ${b}`].coloured - COLOUR_TOL, { frame: f.coloured, parked: r[`parked ${b}`].coloured });
  }
  const d = {};
  for (const [u, end] of [[TINY, a], [1 - TINY, b]]) {
    r[`u ${u}`] = await at(a + u, `t${u}`);
    d[end] = r[`u ${u} against ${end}`] = await compare(`t${u}`, `p${end}`);
  }
  ok(`${name}, u = ${1 - TINY}: the frame is as close to plane ${b} parked as u = ${TINY} is to plane ${a} (within ${SAME_FRAC})`, !!d[a] && !!d[b] && d[b].frac <= d[a].frac + SAME_FRAC, d);
  // the K = 1 control: the principal combo alone leaves the left half paper
  await ev('__cmwSteps({ glideSheets: 1 }); 1');
  const c = r.control = await at(a + 1 - SHORT, 'k1');
  ok(`${name}: with the principal combo alone (K = 1) the frame near u = 1 is about half paper (≥ ${ONE_SHEET})`, c.paper >= ONE_SHEET, c);
  await ev('__cmwSteps({ glideSheets: 0 }); 1');
}
// ---- the logarithm zoomed out: the window of sheets about the principal one ----
{
  const r = info.log = {};
  await loadView('steps', 'glidesheetslog' + Date.now(), { shapes: [], steps: [step('log', { cut: 180 })], srcView: { cx: 0, cy: 0, s: LOG_SCALE } });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true, restPaint: 0 }); 1`);
  await settled({ max: 60000 });
  const f = r.arrival = await at(1 - SHORT, 'log');
  const ks = (f.glide.sheetKs || []).map((o) => o[0]).sort((x, y) => x - y);
  ok('logarithm: the glide draws the sheets −2..2 about the principal one, each once', JSON.stringify(ks) === JSON.stringify([-2, -1, 0, 1, 2]), f.glide);
  r.top = await halfPaper('log', true); r.bottom = await halfPaper('log', false);
  ok(`logarithm, u = ${1 - SHORT}: as much paper above the real axis as below it (within ${SYM_TOL})`, Math.abs(r.top - r.bottom) <= SYM_TOL, r);
}
// ---- combos the glide's planes can or cannot tell apart ----
// exp undoes the logarithm's sheet (exp(log z + 2πik) = z) and z² the square root's, so the planes after them cannot
// tell those combos apart; a glide onto such a plane still leaves the plane before, which can
{
  const COINCIDE = [
    { name: 'log, exp, sin, cube root', steps: [step('log', { cut: 180 }), step('exp'), step('sin'), step('root', { n: 3, cut: 180 })], b: 4, sheets: 3, ks: (g) => JSON.stringify((g.sheetKs || []).map((o) => o[1]).sort((x, y) => x - y)) === '[0,1,2]', what: 'the root\'s three sheets, each once' },
    { name: 'square root then z²', steps: [step('root', { n: 2, cut: 180 }), step('pown', { n: 2 })], b: 2, sheets: 2, paper: true, what: 'both sheets of the root' },
    { name: 'log then exp', steps: [step('log', { cut: 180 }), step('exp')], b: 2, sheets: 5, what: 'the logarithm\'s five sheets' },
  ];
  for (const c of COINCIDE) {
    const r = info[c.name] = {};
    await loadView('steps', 'glidesheetsco' + Date.now(), { shapes: [], steps: c.steps, srcView: { cx: 0, cy: 0, s: 90 } });
    await settled({ max: 30000, until: READY });
    await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: ${c.b - 1}, now: true, bare: true, restPaint: 0 }); 1`);
    await settled({ max: 60000 });
    const f = r.mid = await at(c.b - 0.5, 'co' + c.b);
    ok(`${c.name}, u = 0.5: the glide draws ${c.what}`, f.glide.sheets === c.sheets && (!c.ks || c.ks(f.glide)), f.glide);
    if (c.paper) ok(`${c.name}, u = 0.5: no paper (≤ ${PAPER_MAX})`, f.paper <= PAPER_MAX, f);
  }
}
// ---- Inside regions: an annulus under the square root ----
{
  const r = info.inside = {};
  const ns = 'glidesheetsin' + Date.now();
  await loadView('steps', ns, { shapes: [{ id: 'a1', kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2, ci: 0, visible: true }], steps: [ROOT], srcView: { cx: 0, cy: 0, s: 90 } });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'in', surf: 'plane', go: 0, now: true, bare: true, restPaint: 0 }); 1`);
  await settled({ max: 60000 });
  for (const k of [0, 1]) {
    await ev(`__cmwSteps({ go: ${k}, now: true }); 1`);
    await settled({ max: 60000 });
    ok(`Inside regions: plane ${k} parked is still`, await grab(`ip${k}`), null);
  }
  await ev('__cmwSteps({ go: 0, now: true }); 1');
  await settled({ max: 60000 });
  const d = {};
  for (const [u, end] of [[TINY, 0], [1 - TINY, 1]]) {
    const f = r[`u ${u}`] = await at(u, `it${u}`);
    ok(`Inside regions, u = ${u}: the principal sheet's image of the region alone (no copies)`, f.glide.sheets === 1, f);
    d[end] = r[`u ${u} against ${end}`] = await compare(`it${u}`, `ip${end}`);
  }
  ok(`Inside regions, u = ${1 - TINY}: the frame is as close to plane 1 parked as u = ${TINY} is to plane 0 (within ${SAME_FRAC})`, !!d[0] && !!d[1] && d[1].frac <= d[0].frac + SAME_FRAC, d);
}
return { pass: fails.length === 0, fails, info };

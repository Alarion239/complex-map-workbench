// The steps view's glide a -> b draws, at a pixel no point of the glide reaches and where plane a has a value, what
// plane b draws there at rest (#1443's ux rule, case b): never blank. The Douady–Hubbard map (its default scene: one
// step, Everywhere, the strokes hidden): the map is onto the outside of the unit disc, so on the glide 0 -> 1 the
// points of plane 0 never reach the inside of the unit disc; parked plane 1 colours every pixel.
//  - At u in PAPER_U the glide frame has no more blank pixels (the plane's paper colour, each channel within PAPER_TOL)
//    than parked plane 1, give or take PAPER_SLACK of the pane: today the place no point reaches is blank.
//  - At u = ARRIVE_U, inside the unit disc (|w| < DISC_IN) and where plane 0 has a value (c = w escapes under
//    z -> z^2 + c within ESCAPE_N steps, so it is outside M and away from its boundary, where case a's hatch is
//    drawn instead), the frame shows parked plane 1's pixel (each channel within MATCH_TOL of one in its 3 x 3
//    neighbourhood) at at least MATCH_MIN of at least MIN_DISC pixels: no pop at the arrival.
//    (Each frame's places w are read from its own camera, and the pixel compared is parked plane 1's at the same w.)
//  - Control: parked plane 0 differs from parked plane 1 there (at most CONTROL_MAX of those pixels match), so the
//    match is plane 1's own picture and not any coloured frame.
// The glide is drawn by the inverse pass (path 'inverse'), the path the Douady–Hubbard glide takes (#1339); the paint is
// under the carried colour, so the carried meshes' path takes it too.
// On the Sphere (#2383), the same glide on the globe: at u in PAPER_U the globe has no more paper pixels than the globe
// at rest on plane 1, give or take PAPER_SLACK of the pane (the arrival plane's colour under the carried globe, as on the
// plane). The camera is the same in all three frames, so the paper around the globe counts alike in each.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PAPER_U = [0.5, 0.998], ARRIVE_U = 0.998, PAPER_TOL = 2, PAPER_SLACK = 0.005;
const DISC_IN = 0.95, ESCAPE_N = 24, MATCH_TOL = 6, MATCH_MIN = 0.98, MIN_DISC = 2000, CONTROL_MAX = 0.5;
const SETTLE_MS = 60000;
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const names = exampleNames();
const EXAMPLE = names.indexOf('The Douady–Hubbard map');
ok('the example The Douady–Hubbard map is in the guide', EXAMPLE >= 0, names.length);
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=svrestpaint${Date.now()}&view=steps`);
await settled({ max: SETTLE_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwExample(${EXAMPLE}); 1`);
await settled({ max: SETTLE_MS, until: '__cmwSteps().ready.ready' });
await ev(`__cmwSet('morphPaths', false), __cmwHideStrokes(true), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const park = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max: SETTLE_MS, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-12 && GLR.pendingLinks === 0 && !__cmwSteps().hold` });
  return grab('X' + x);
};
for (const x of [0, ARRIVE_U, 0.5]) ok(`the frame at x = ${x} settles`, await park(x), null);
const rec = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u, w: g.w, h: g.h }; })()');
info.glide = rec;
ok('the frame at u = 0.5 is a glide frame', !!rec && Math.abs(rec.u - 0.5) < 1e-9, rec);
ok('the glide is drawn by the inverse pass (path \'inverse\', the Douady–Hubbard glide\'s)', !!rec && rec.path === 'inverse', rec && rec.path);
// (parked plane 1: the glide run to its end; a held x keeps the plane the thread was last let go on)
await ev(`__cmwSteps({ go: 1, now: true }), 1`);
const at1 = await settled({ max: SETTLE_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 1 && __cmwSteps().i === 1 && GLR.pendingLinks === 0' });
ok('the thread parks on plane 1', at1.ok, at1);
ok('parked plane 1 settles', await grab('X1'), null);
const paperRGB = await ev(`(() => { const s = __cmwP().shapes[0]; const h = s ? __cmwLook(s.id, 'L').plane : null; return h ? [0, 2, 4].map((k) => parseInt(h.replace('#', '').slice(k, k + 2), 16)) : null; })()`);
info.paper = paperRGB;
ok('the plane\'s paper colour is read', Array.isArray(paperRGB) && paperRGB.every(Number.isFinite), paperRGB);
// the blank pixels of frame tag: the paper colour, each channel within PAPER_TOL
const blank = (tag) => ev(`(() => {
  const D = window.__heldPx[${JSON.stringify(tag)}], P = ${JSON.stringify(paperRGB)};
  let n = 0;
  for (let i = 0; i < D.length; i += 4) if (Math.abs(D[i] - P[0]) <= ${PAPER_TOL} && Math.abs(D[i + 1] - P[1]) <= ${PAPER_TOL} && Math.abs(D[i + 2] - P[2]) <= ${PAPER_TOL}) n++;
  return { n, of: D.length / 4 };
})()`);
const b1 = info.blank1 = await blank('X1');
for (const u of PAPER_U) {
  const q = info[`blank ${u}`] = await blank('X' + u);
  ok(`at u = ${u} the glide frame is not blank where no point arrives: no more paper pixels than parked plane 1, give or take ${PAPER_SLACK * 100} % of the pane`, q.n <= b1.n + PAPER_SLACK * q.of, { glide: q, plane1: b1 });
}
// inside the unit disc, outside M (c = w escaping within ESCAPE_N steps): of frame tag's pixels, at their places w by
// its own camera, how many show frame ref's pixel at the same w by ref's camera (each channel within MATCH_TOL of one
// in its 3 x 3 neighbourhood)
const disc = (tag, ref) => ev(`(() => {
  // (each frame's camera, as grab() kept it: a glide frame's is its record's, the view its colour was drawn with)
  const cam = (k) => { const a = window.__heldAt[k]; return (a.g && a.g.view) || a.v; };
  const ct = cam(${JSON.stringify(tag)}), cr = cam(${JSON.stringify(ref)}), cw = ${rec ? rec.w : 0}, ch = ${rec ? rec.h : 0};
  const D = window.__heldPx[${JSON.stringify(tag)}], R = window.__heldPx[${JSON.stringify(ref)}], c = document.getElementById('canvasL'), W = c.width, H = c.height, dpr = W / cw;
  const esc = (cr, ci) => { let x = 0, y = 0; for (let k = 0; k < ${ESCAPE_N}; k++) { const t = x * x - y * y + cr; y = 2 * x * y + ci; x = t; if (x * x + y * y > 4) return true; } return false; };
  let n = 0, hit = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const re = ct.cx + ((x + 0.5) / dpr - cw / 2) / ct.s, im = ct.cy - ((y + 0.5) / dpr - ch / 2) / ct.s;
    if (Math.hypot(re, im) >= ${DISC_IN} || !esc(re, im)) continue;
    const rx = Math.round(((re - cr.cx) * cr.s + cw / 2) * dpr - 0.5), ry = Math.round((ch / 2 - (im - cr.cy) * cr.s) * dpr - 0.5);
    if (rx < 1 || ry < 1 || rx >= W - 1 || ry >= H - 1) continue;
    n++;
    const i = 4 * (y * W + x);
    let found = false;
    for (let dy = -1; dy <= 1 && !found; dy++) for (let dx = -1; dx <= 1 && !found; dx++) {
      const j = 4 * ((ry + dy) * W + rx + dx);
      if (Math.abs(D[i] - R[j]) <= ${MATCH_TOL} && Math.abs(D[i + 1] - R[j + 1]) <= ${MATCH_TOL} && Math.abs(D[i + 2] - R[j + 2]) <= ${MATCH_TOL}) found = true;
    }
    if (found) hit++;
  }
  return { n, hit, frac: +(hit / Math.max(1, n)).toFixed(4) };
})()`);
const a = info.arrive = await disc('X' + ARRIVE_U, 'X1');
ok(`at u = ${ARRIVE_U}, inside the unit disc where plane 0 has a value, the glide shows parked plane 1 (at least ${MATCH_MIN * 100} % of ${MIN_DISC}+ pixels)`, a.n >= MIN_DISC && a.frac >= MATCH_MIN, a);
const c0 = info.control = await disc('X0', 'X1');
ok(`control: parked plane 0 is not parked plane 1 there (at most ${CONTROL_MAX * 100} % match)`, c0.n >= MIN_DISC && c0.frac <= CONTROL_MAX, c0);
// ---- the Sphere: the same glide on the globe ----
await ev(`__cmwSteps({ go: 0, now: true }), 1`);
await settled({ max: SETTLE_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 0 && GLR.pendingLinks === 0' });
await ev(`__cmwSteps({ surf: 'sphere' }), 1`);
await settled({ max: SETTLE_MS, until: `__cmwSteps().surf === 'sphere' && __cmwSteps().ready.ready` });
const parkS = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max: SETTLE_MS, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-12 && GLR.pendingLinks === 0 && !__cmwSteps().hold` });
  return grab('S' + x);
};
for (const u of PAPER_U) ok(`Sphere: the frame at u = ${u} settles`, await parkS(u), null);
await ev(`__cmwSteps({ go: 1, now: true }), 1`);
const at1s = await settled({ max: SETTLE_MS, until: '!__cmwSteps().moving && __cmwSteps().x === 1 && __cmwSteps().i === 1 && GLR.pendingLinks === 0' });
ok('Sphere: the thread parks on plane 1', at1s.ok, at1s);
ok('Sphere: the globe at rest on plane 1 settles', await grab('S1'), null);
const s1 = info.sphereBlank1 = await blank('S1');
ok('Sphere: the globe at rest on plane 1 is drawn (fewer paper pixels than the pane)', s1.n < 0.9 * s1.of, s1);
for (const u of PAPER_U) {
  const q = info[`sphere blank ${u}`] = await blank('S' + u);
  ok(`Sphere: at u = ${u} the globe is not blank where no point arrives: no more paper pixels than the globe at rest on plane 1, give or take ${PAPER_SLACK * 100} % of the pane`, q.n <= s1.n + PAPER_SLACK * q.of, { glide: q, plane1: s1 });
}
return { pass: fails.length === 0, fails, info };

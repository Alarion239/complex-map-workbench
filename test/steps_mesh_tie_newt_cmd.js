// The carried meshes' frames of a map whose sheets tie, where the inverse pass does not draw (#1054): z³ then cos, colour
// from z, Everywhere. About the window's centre every w has three sheets of z³ at the same distance D, so the sheet key
// alone decides which one is in front (larger Im z, the tie order). Its plane at rest (cos has no exact inverse) and its
// glide a step at a time from plane 1 to 2 are both drawn by the carried meshes (the rest and glide records say 'mesh').
// The frame has to be as smooth as the same frame with the window moved off z = 0 by OFF_CX: there the three sheets are at
// different distances, so none tie and the key orders them by D, through the same meshes, the same map and cos's same
// detail. A front sheet that flips from one triangle of the mesh to the next (the tie decided by the mesh's own error in
// the key) makes the 3 x 3 pixels about a point differ: at most ROUGH_MARGIN more of the points may be rough.
// The tied frames are drawn through the resolve of ties (GLR.carryResolve: __cmwSteps().resolved counts its frames), and the
// off-centre ones, whose sheets cannot tie, are not: they draw each mesh once.
// The resolve ties only sheets z³'s rotation carries into each other (#2208): drawn again with the band's floor raised to
// BAND_WIDE units of the key (__cmwSteps({ tieBand })), the tied frames change in at most BAND_DIFF_MAX of the pane's pixels,
// so sheets whose keys are merely near stay in the key's order wherever the band reaches.
// The control: z³ then 1 z at rest on plane 2, the same ties drawn by the inverse pass (which orders keys within its band
// by the tie order, Inverse.order), is smooth by the same measure: at most SMOOTH_MAX of its points are rough.
// At rest the pre-mapped meshes (SphereMeshes) take over once built (__cmwSteps().carryPre): their frame is as smooth
// inside the disc about w = 1, where cos's critical value bends the mesh most (at most DISC_ROUGH_MAX of the points 0.12 to
// 0.38 from w = 1, off the real axis, are rough), and the band's floor at BAND_WIDE moves it as little; its map cos(z³)
// keeps a sixth turn (GLR.carryResolveOrd() 6). Left of Re w = LEFT_X (past the arc of triangles, #2286), once they
// cover it, at most LEFT_ROUGH_MAX of its points are rough: sheets of equal angle about the centre and unequal radius
// are not the rotation's partners. Behind the arc's tip (TIP, about w = -1, cos's critical value) at most
// EXACT_WRONG_MAX of the points show the second sheet in the inverse pass's order rather than the front one (plane z's
// colours at the two, where they differ by over TIP_APART: the nearer is the one shown). Once the render-ahead probe has
// drawn its frames off-screen, __cmwSteps().carryPre still counts the screen frame's pre-mapped draws (#2298).
// The source points' target's fallbacks: RG16F (GLR.carryProbes({ kpos: 'half' })) tests the same orbit, as smooth;
// none ('none') ties by the band alone (GLR.carryResolveOrd() 0) and still draws.
// Each page is opened in the steps view (carry_kit's openSteps: test.html?view=steps).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { DRAWN, openSteps, toPlane, rough, lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// (the roughness: carry_kit's rough(), its 20 x 14 grid 0.09 apart about the window centre; a point is rough over a spread of 30)
const SMOOTH_MAX = 0.1;            // the share of rough points the inverse pass's frame may have
const ROUGH_MARGIN = 0.05;         // the share of points more than the off-centre frame's that the centred frame may have rough
const OFF_CX = 0.4;                // the window's centre off z = 0 (plane units) for the frames without ties
const DRAWN_WAIT = 60000, GLIDE_WAIT = 120000, REST_WAIT = 20000;   // ms
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;   // the glide's time a frame while it runs, and once frozen
const FREEZE_X = 1.6;              // the glide from plane 1 is frozen once the thread is past this, short of plane 2
const BAND_WIDE = 256, BAND_DIFF_MAX = 0.01;   // the band's floor raised to, and the share of the pane that may change then
const PIX_TOL = 24;                // a pixel changes over this in some channel (0..255)
const DISC_ROUGH_MAX = 0.05;       // the share of the points inside the disc about w = 1 that may be rough
const TIP = { x0: -3.6, x1: -2.6, y0: -1.2, y1: 1.2, nx: 10, ny: 12 };   // the box behind the arc's tip (w near -1), short of the arc (#2286)
const EXACT_WRONG_MAX = 0.02;      // the share of the box's points that may show the second sheet rather than the front one
const TIP_APART = 40;              // the two sheets' colours on plane z differ by over this in some channel for a point to count
const PRE_WAIT = 30000;            // ms for the pre-mapped meshes to take over at rest
const LEFT_X = -3.4;               // the pane read left of this Re w (left of the arc of triangles at rest, #2286)
const LEFT_ROUGH_MAX = 0.05;       // the share of those points that may be rough (the region meshes' frame there reads 0)
await view(1200, 800, false, false);
const ZCUBE = { type: 'pown', params: { n: 3 }, on: true };
const STEPS = [ZCUBE, { type: 'cos', params: {}, on: true }], CONTROL = [ZCUBE, { type: 'mul', params: { c: '1' }, on: true }];
const open = (cx, steps = STEPS) => openSteps(PORT, steps, { srcView: { cx, cy: 0, s: 80 } });
// the share of the pane's pixels that change when the frame on the pane is drawn again with the band's floor at BAND_WIDE
const PIX = `window.__mtPx = () => { const c = document.getElementById('canvasL'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; }; 1`;
const redrawBand = async (band) => {
  const r0 = await ev('__cmwSteps().resolved');
  await ev(`__cmwSteps({ tieBand: ${band} }); 1`);
  await settled({ max: DRAWN_WAIT, until: `__cmwSteps().resolved > ${r0} && ${DRAWN}` });
};
const bandShift = async () => {
  await ev(PIX);
  await ev('(window.__mtA = __mtPx(), 1)');
  await redrawBand(BAND_WIDE);
  const share = await ev(`(() => { const a = window.__mtA, b = __mtPx(); let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > ${PIX_TOL}) n++; return n / (a.length / 4); })()`);
  await redrawBand(null);
  return share;
};
// plane 2 at rest, the window's centre at cx
const restFrame = async (cx, steps) => {
  await open(cx, steps);
  await toPlane(2);
  await settled({ max: REST_WAIT, until: '!!__cmwSteps().rest && __cmwSteps().rest.a === 2' });
  const rest = await ev('(() => { const r = __cmwSteps().rest; return r && { a: r.a, path: r.path }; })()');
  return Object.assign({ rest, resolved: await ev('__cmwSteps().resolved') }, await rough(), cx === 0 && !steps ? { wide: await bandShift() } : {});
};
// the glide from plane 1 to 2, a step at a time, frozen past FREEZE_X, the window's centre at cx
const glideFrame = async (cx) => {
  await open(cx);
  await toPlane(1);
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev('__cmwSteps({ go: 2 })');
  await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${FREEZE_X}`, only: true });
  await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
  await settled({ max: DRAWN_WAIT, until: DRAWN });
  const glide = await ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, rec: q.glide && { path: q.glide.path, reason: q.glide.reason } }; })()');
  return Object.assign({ glide, resolved: await ev('__cmwSteps().resolved') }, await rough(), cx === 0 ? { wide: await bandShift() } : {});
};
const control = await restFrame(0, CONTROL);
info.control = control;
ok('the page reads the control\'s grid', control.n >= 0.9 * control.of, control);
ok('the control, z³ then 1 z at rest on plane 2, is drawn by the inverse pass', !!control.rest && control.rest.a === 2 && control.rest.path === 'inverse', control.rest);
ok(`the inverse pass's frame of z³'s tied sheets is smooth: at most ${SMOOTH_MAX * 100} % of the points are rough`, control.share <= SMOOTH_MAX, control);
const legs = [['rest', restFrame, 'plane 2 at rest'], ['glide', glideFrame, 'the glide from plane 1 to 2']];
for (const [key, frame, what] of legs) {
  const off = await frame(OFF_CX), tie = await frame(0);
  info[key] = { tie, off };
  for (const [f, where] of [[tie, 'centred'], [off, 'off-centre']]) {
    ok(`the page reads the grid of ${what} (${where})`, f.n >= 0.9 * f.of, f);
    if (key === 'rest') ok(`${what} (${where}) is drawn by the carried meshes`, !!f.rest && f.rest.a === 2 && f.rest.path === 'mesh', f.rest);
    else ok(`${what} (${where}) is frozen a step at a time, short of plane 2, and drawn by the carried meshes`, !f.glide.all && f.glide.x > FREEZE_X && f.glide.x < 2 && !!f.glide.rec && f.glide.rec.path === 'mesh', f.glide);
  }
  ok(`${what} (centred) is drawn through the resolve of ties, and off the centre without it`, tie.resolved > 0 && off.resolved === 0, { tie: tie.resolved, off: off.resolved });
  ok(`the carried meshes' frame of ${what}, where z³'s sheets tie, is as smooth as off the centre (within ${ROUGH_MARGIN * 100} % of the points)`, tie.share <= off.share + ROUGH_MARGIN, { tie, off });
  ok(`${what} (centred) drawn with the band's floor at ${BAND_WIDE} changes in at most ${BAND_DIFF_MAX * 100} % of the pane: only z³'s rotated sheets tie`, typeof tie.wide === 'number' && tie.wide <= BAND_DIFF_MAX, { wide: tie.wide });
}
// plane 2 at rest once the pre-mapped meshes draw it: the points about w = 1 (rings 0.12 to 0.38 out, off the real axis)
const DISC = []; for (let r = 0.12; r < 0.39; r += 0.065) for (let i = 0; i < 24; i++) { const a = (i + 0.5) * Math.PI / 12; if (Math.abs(Math.sin(a)) * r > 0.03) DISC.push([1 + r * Math.cos(a), r * Math.sin(a)]); }
// the pane left of Re w = LEFT_X (a 12 x 12 grid inside the pane), rough as carry_kit's rough() counts it; __mtLeftPaper():
// how many of its points are still bare paper (the first pre-mapped mesh covers part of the pane, the next the rest)
const LEFT_PTS = `(() => { const m = __cmwCards().main, c = document.getElementById('canvasL'), hw = c.width / (2 * m.view.s * m.dpr), hh = c.height / (2 * m.view.s * m.dpr);
  const x0 = m.view.cx - 0.95 * hw, x1 = Math.min(${LEFT_X}, m.view.cx + 0.95 * hw), pts = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) pts.push([x0 + (i + 0.5) / 12 * (x1 - x0), m.view.cy + ((j + 0.5) / 12 - 0.5) * 1.9 * hh]);
  return pts; })()`;
const LEFT_PAPER = `window.__mtLeftPaper = () => { const m = __cmwCards().main, c = document.getElementById('canvasL'), g = c.getContext('2d'), v = m.view, d = m.dpr;
  return ${LEFT_PTS}.filter(([x, y]) => { const p = g.getImageData(Math.round(c.width / 2 + (x - v.cx) * v.s * d), Math.round(c.height / 2 - (y - v.cy) * v.s * d), 1, 1).data; return p[0] > 235 && p[1] > 235 && p[2] > 235; }).length; }; 1`;
const leftRough = async () => {
  const pts = await ev(LEFT_PTS);
  const px = (await lpx(pts)).px.filter(Boolean);
  const n = px.filter((p) => Math.max(...[0, 1, 2].map((c) => Math.max(...p.map((x) => x[c])) - Math.min(...p.map((x) => x[c])))) > 30).length;
  return { of: pts.length, n: px.length, rough: n, share: n / px.length };
};
const discRough = async () => {
  const px = (await lpx(DISC)).px.filter(Boolean);
  const n = px.filter((p) => Math.max(...[0, 1, 2].map((c) => Math.max(...p.map((x) => x[c])) - Math.min(...p.map((x) => x[c])))) > 30).length;
  return { n: px.length, rough: n, share: n / px.length };
};
await open(0);
await toPlane(2);
const preOk = await settled({ max: PRE_WAIT, until: `__cmwSteps().carryPre > 0 && ${DRAWN}` });
await ev(LEFT_PAPER);
const covered = await settled({ max: PRE_WAIT, until: `__mtLeftPaper() === 0 && ${DRAWN}` });
const left = Object.assign(await leftRough(), { covered: covered.ok });
info.left = { pre: left };
ok(`plane 2 at rest on the pre-mapped meshes, left of Re w = ${LEFT_X} once they cover it: at most ${LEFT_ROUGH_MAX * 100} % of the points rough`, left.covered && left.n >= 0.9 * left.of && left.share <= LEFT_ROUGH_MAX, info.left);
// (the render-ahead probe, svAheadProbe, draws the motion's frames off-screen at idle once it has ended: the frame on the
// screen keeps its own count of pre-mapped draws, #2298)
{
  const end = await settled({ max: PRE_WAIT * 2, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' });
  const r = await ev('(() => { const s = __cmwSteps(), p = s.aheadProbe; return { pre: s.carryPre, probe: p && { state: p.state, frames: p.frames, rejects: p.rejects.length } }; })()');
  info.probe = r;
  ok('plane 2 at rest: once the render-ahead probe has drawn its frames off-screen, __cmwSteps().carryPre still counts the pre-mapped draws of the frame on the screen', end.ok && !!r.probe && r.probe.frames + r.probe.rejects > 0 && r.pre > 0, r);
}
// the points z of the key's window with cos(z³) = w: z³ = ±acos w + 2 pi k, and their cube roots
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const csqrt = (a) => { const r = Math.hypot(a[0], a[1]), x = Math.sqrt(Math.max(0, (r + a[0]) / 2)), y = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [x, a[1] < 0 ? -y : y]; };
const cacos = (w) => { const q = csqrt([1 - cmul(w, w)[0], -cmul(w, w)[1]]), u = [w[0] - q[1], w[1] + q[0]]; return [Math.atan2(u[1], u[0]), -Math.log(Math.hypot(u[0], u[1]))]; };
const tipCand = (win) => (w) => {
  const A = cacos(w), R = Math.max(...[[win.x0, win.y0], [win.x0, win.y1], [win.x1, win.y0], [win.x1, win.y1]].map((p) => Math.hypot(p[0], p[1]))), K = Math.ceil(R ** 3 / (2 * Math.PI)) + 1, out = [];
  for (let k = -K; k <= K; k++) for (const s of [1, -1]) {
    const a = [s * A[0] + 2 * Math.PI * k, s * A[1]], r = Math.cbrt(Math.hypot(a[0], a[1])), th = Math.atan2(a[1], a[0]) / 3;
    for (let j = 0; j < 3; j++) { const z = [r * Math.cos(th + 2 * Math.PI * j / 3), r * Math.sin(th + 2 * Math.PI * j / 3)]; if (z[0] >= win.x0 && z[0] <= win.x1 && z[1] >= win.y0 && z[1] <= win.y1) out.push({ z, out: false }); }
  }
  return out;
};
{
  // (each point's two first sheets in the inverse pass's order, Inverse.order under __cmwSvKey(2); plane z's colours at both,
  // and the frame's pixel nearer the second's where the two differ by over TIP_APART)
  const win = (await ev('__cmwSvKey(2)')).win, cand = tipCand(win), pts = [];
  for (let i = 0; i < TIP.nx; i++) for (let j = 0; j < TIP.ny; j++) pts.push([TIP.x0 + (i + 0.5) / TIP.nx * (TIP.x1 - TIP.x0), TIP.y0 + (j + 0.5) / TIP.ny * (TIP.y1 - TIP.y0)]);
  const lists = pts.map((w) => cand(w).map((c) => c.z));
  const two = await ev(`(() => { const k = __cmwSvKey(2), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])), per: k.per && CX.C(k.per[0], k.per[1]) };
    return ${JSON.stringify(lists)}.map((L) => { const o = Inverse.order(L.map((p, i) => ({ z: CX.C(p[0], p[1]), D: Inverse.sheetKey(prep, CX.C(p[0], p[1]), null), lam: null, i }))); return o.length > 1 ? [o[0].i, o[1].i] : null; }); })()`);
  const got = (await lpx(pts)).px;
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); 1`);
  await settled({ max: PRE_WAIT * 2, until: `__cmwSteps().stage === 0 && __cmwSvFixed() && ${DRAWN}` });
  const idx = pts.map((w, k) => two[k]).map((t, k) => t && [lists[k][t[0]], lists[k][t[1]]]);
  const ref = (await lpx(idx.flatMap((t) => (t ? t : [[0, 0], [0, 0]])))).px;
  const c4 = (p) => p && p[4], dist = (a, b) => Math.max(...[0, 1, 2].map((c) => Math.abs(a[c] - b[c])));
  let n = 0, wrong = 0; const ex = [];
  pts.forEach((w, k) => {
    const g = c4(got[k]), f = c4(ref[2 * k]), q = c4(ref[2 * k + 1]);
    if (!idx[k] || !g || !f || !q || dist(f, q) <= TIP_APART) return;
    n++;
    if (dist(g, q) < dist(g, f)) { wrong++; if (ex.length < 4) ex.push({ w, got: g, front: f, second: q }); }
  });
  info.tip = { n, wrong, of: pts.length, pre: preOk.ok, ex };
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 2, now: true }); 1`);
  await settled({ max: PRE_WAIT * 2, until: `__cmwSteps().stage === 2 && __mtLeftPaper() === 0 && ${DRAWN}` });
  ok(`plane 2 at rest on the pre-mapped meshes, about the arc's tip (w = -1): at most ${EXACT_WRONG_MAX * 100} % of the points show the second sheet's colour rather than the front one's`, preOk.ok && left.covered && n >= 0.25 * pts.length && wrong <= EXACT_WRONG_MAX * n, info.tip);
}
const pre = { ok: preOk.ok, ord: await ev('GLR.carryResolveOrd()'), disc: await discRough(), wide: await bandShift() };
info.pre = pre;
ok('plane 2 at rest: the pre-mapped meshes take over, through the resolve with its map\'s rotation: a sixth turn (z³ changes sign, cos is even)', pre.ok && pre.ord === 6, pre);
ok(`plane 2 at rest on the pre-mapped meshes: at most ${DISC_ROUGH_MAX * 100} % of the points inside the disc about w = 1 are rough`, pre.disc.n >= 0.9 * DISC.length && pre.disc.share <= DISC_ROUGH_MAX, pre.disc);
ok(`plane 2 at rest on the pre-mapped meshes, with the band's floor at ${BAND_WIDE}: at most ${BAND_DIFF_MAX * 100} % of the pane changes`, typeof pre.wide === 'number' && pre.wide <= BAND_DIFF_MAX, { wide: pre.wide });
for (const kpos of ['half', 'none']) {
  await ev(`GLR.carryProbes({ kpos: '${kpos}' }); 1`);
  await redrawBand(null);
  const f = { ord: await ev('GLR.carryResolveOrd()'), disc: await discRough() };
  info['kpos_' + kpos] = f;
  if (kpos === 'half') ok(`the source points' target in half floats: the same orbit, as smooth inside the disc (at most ${DISC_ROUGH_MAX * 100} %)`, f.ord === 6 && f.disc.share <= DISC_ROUGH_MAX, f);
  else ok('with no float target for the source points the resolve ties by the band alone, and the frame draws', f.ord === 0 && f.disc.n >= 0.9 * DISC.length, f);
}
await ev('GLR.carryProbes({}); 1');
return { pass: fails.length === 0, fails, info };

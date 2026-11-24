// The steps view's region meshes at rest on a plane whose map stretches the whole plane's mesh far (z³ then cos, colour
// from z, Everywhere, alpha 1, plane 2): every point of the pane shows the front sheet, also where the pane is wide. The
// carried colour leaves out a mapped triangle longer than its length cap (a point the map sends far); about cos's critical
// values (|z| about 1.5, |F'| about 46) the front sheet's whole-plane cells are drawn about half the pane long, so a cap of
// a third of the pane left the wide pane's corners bare and other sheets showing past them. Each leg (LEGS) opens the page
// anew at its size and reads the region meshes' frame (the pre-mapped meshes dropped, __cmwSmReset, and the frame drawn
// before one is built again: __cmwSphere() with no entry, the fix-up installed) at a GRID_NX x GRID_NY grid of points w
// over the pane:
// - no point is bare paper (every channel over PAPER_MIN);
// - off the real axis's strip (|Im w| > AXIS_STRIP, where the map's cut and its tied sheets meet: #2286's) at no fewer
//   than FRONT_MIN of the points the frame shows the front sheet: the colour plane z shows at the first of w's preimages
//   in the inverse pass's order under __cmwSvKey(2) (each channel within MATCH; the preimages: z³ = ±acos w + 2πk and
//   their cube roots, in the key's window).
// (control) the cap leaves out what the map sends far: 1/z at rest on plane 1 (its pole at 0, the cells about it sent
// across the plane), POLE_LEGS: no point of the grid bare paper, and the front sheet, its one preimage 1/w (a pixel of plane z
// within NEAR of 1/w: plane z's axes and lines are thin, and a preimage on one is read off it), at no fewer than FRONT_MIN of
// the grid's points: no streak of a cell sent across the pole.
// The page is opened in the steps view (carry_kit's openSteps: test.html?view=steps).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { DRAWN, openSteps, toPlane, lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const GRID_NX = 24, GRID_NY = 16, PAPER_MIN = 235;   // the pane's grid, and paper's least channel
const MATCH = 40, FRONT_MIN = 0.99;   // a pixel is a sheet's within this largest channel difference; the share of the points that show the front sheet
const AXIS_STRIP = 0.4;   // the real axis's strip, |Im w| up to this (plane units)
const PLANE_WAIT = 60000;   // ms
const NEAR = 3;   // the pole legs: plane z's pixels read about a preimage, up to this many CSS px from it on each axis
// the legs: the window (CSS px) and its device pixel ratio (1200 x 800: no bare corner there, other sheets past the cut cells)
const LEGS = [{ id: 'desk1440', w: 1440, h: 900, dpr: 1 }, { id: 'desk1440@2', w: 1440, h: 900, dpr: 2 }, { id: 'desk1920', w: 1920, h: 1080, dpr: 1 }, { id: 'desk1200', w: 1200, h: 800, dpr: 1 }];
const STEPS = [{ type: 'pown', params: { n: 3 }, on: true }, { type: 'cos', params: {}, on: true }];
const POLE_LEGS = [{ id: 'pole1440', w: 1440, h: 900, dpr: 1 }, { id: 'pole1200', w: 1200, h: 800, dpr: 1 }];
const POLE_STEPS = [{ type: 'recip', params: {}, on: true }];
// the points z of the key's window with cos(z³) = w: z³ = ±acos w + 2πk, and their cube roots
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const csqrt = (a) => { const r = Math.hypot(a[0], a[1]), x = Math.sqrt(Math.max(0, (r + a[0]) / 2)), y = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [x, a[1] < 0 ? -y : y]; };
const cacos = (w) => { const q = csqrt([1 - cmul(w, w)[0], -cmul(w, w)[1]]), u = [w[0] - q[1], w[1] + q[0]]; return [Math.atan2(u[1], u[0]), -Math.log(Math.hypot(u[0], u[1]))]; };
const cand = (win) => (w) => {
  const A = cacos(w), R = Math.max(...[[win.x0, win.y0], [win.x0, win.y1], [win.x1, win.y0], [win.x1, win.y1]].map((p) => Math.hypot(p[0], p[1]))), K = Math.ceil(R ** 3 / (2 * Math.PI)) + 1, out = [];
  for (let k = -K; k <= K; k++) for (const s of [1, -1]) {
    const a = [s * A[0] + 2 * Math.PI * k, s * A[1]], r = Math.cbrt(Math.hypot(a[0], a[1])), th = Math.atan2(a[1], a[0]) / 3;
    for (let j = 0; j < 3; j++) {
      const z = [r * Math.cos(th + 2 * Math.PI * j / 3), r * Math.sin(th + 2 * Math.PI * j / 3)];
      if (z[0] >= win.x0 && z[0] <= win.x1 && z[1] >= win.y0 && z[1] <= win.y1 && !out.some((q) => Math.hypot(q[0] - z[0], q[1] - z[1]) < 1e-9)) out.push(z);
    }
  }
  return out;
};
const dist = (a, b) => Math.max(...[0, 1, 2].map((c) => Math.abs(a[c] - b[c])));
for (const L of LEGS) {
  await send('Emulation.setDeviceMetricsOverride', { width: L.w, height: L.h, deviceScaleFactor: L.dpr, mobile: false });
  await openSteps(PORT, STEPS, { srcView: { cx: 0, cy: 0, s: 80 } });
  await toPlane(2);
  // (the grid's points w: the centres of its cells over the pane)
  const q0 = await lpx([]), hw = q0.pw / (2 * q0.view.s * q0.dpr), hh = q0.ph / (2 * q0.view.s * q0.dpr), PTS = [];
  for (let j = 0; j < GRID_NY; j++) for (let i = 0; i < GRID_NX; i++) PTS.push([q0.view.cx - hw + (i + 0.5) / GRID_NX * 2 * hw, q0.view.cy + hh - (j + 0.5) / GRID_NY * 2 * hh]);
  // (the region meshes: the pre-mapped ones dropped, read once the fix-up is installed and before one is built again)
  await ev('__cmwSmReset(), 1');
  const region = await settled({ max: PLANE_WAIT, until: `__cmwSphere().entries.length === 0 && __cmwSvFixed() && ${DRAWN}` });
  const entries = await ev('__cmwSphere().entries.length'), got = (await lpx(PTS)).px;
  // (each point's front sheet: the first of its preimages in the inverse pass's order, and plane z's colour there)
  const win = (await ev('__cmwSvKey(2)')).win, lists = PTS.map(cand(win));
  const front = await ev(`(() => { const k = __cmwSvKey(2), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])), per: k.per && CX.C(k.per[0], k.per[1]) };
    return ${JSON.stringify(lists)}.map((L) => L.length ? Inverse.order(L.map((p, i) => ({ z: CX.C(p[0], p[1]), D: Inverse.sheetKey(prep, CX.C(p[0], p[1]), null), lam: null, i })))[0].i : -1); })()`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); 1`);
  await settled({ max: PLANE_WAIT, until: `__cmwSteps().stage === 0 && ${DRAWN}` });
  const zs = front.map((f, k) => (f >= 0 ? lists[k][f] : [1e9, 1e9])), ref = (await lpx(zs)).px;
  const paper = [], wrong = [];
  let n = 0, fronts = 0;
  PTS.forEach((w, k) => {
    const g = got[k] && got[k][4], r = ref[k] && ref[k][4], cell = [k % GRID_NX, Math.floor(k / GRID_NX)];
    if (!g) return;
    if (g.slice(0, 3).every((c) => c > PAPER_MIN)) paper.push(cell);
    if (front[k] < 0 || !r || Math.abs(w[1]) <= AXIS_STRIP) return;
    n++;
    if (dist(g, r) <= MATCH) fronts++; else if (wrong.length < 8) wrong.push({ cell, w: w.map((v) => +v.toFixed(2)), got: g.slice(0, 3), front: r.slice(0, 3) });
  });
  const share = n ? +(fronts / n).toFixed(4) : 0;
  info[L.id] = { region, entries, points: PTS.length, read: n, paper, front: share, wrong };
  ok(`${L.id}: z³ then cos at rest, plane 2, the region meshes' frame: no point of the pane is bare paper`, region.ok && entries === 0 && got.filter(Boolean).length === PTS.length && paper.length === 0, info[L.id]);
  ok(`${L.id}: z³ then cos at rest, plane 2, the region meshes' frame shows the front sheet at ${FRONT_MIN * 100} % of the pane's points off the real axis's strip or more`, region.ok && entries === 0 && n >= 0.8 * PTS.length && share >= FRONT_MIN, info[L.id]);
}
for (const L of POLE_LEGS) {
  await send('Emulation.setDeviceMetricsOverride', { width: L.w, height: L.h, deviceScaleFactor: L.dpr, mobile: false });
  await openSteps(PORT, POLE_STEPS, { srcView: { cx: 0, cy: 0, s: 80 } });
  await toPlane(1);
  const q0 = await lpx([]), hw = q0.pw / (2 * q0.view.s * q0.dpr), hh = q0.ph / (2 * q0.view.s * q0.dpr), PTS = [];
  for (let j = 0; j < GRID_NY; j++) for (let i = 0; i < GRID_NX; i++) PTS.push([q0.view.cx - hw + (i + 0.5) / GRID_NX * 2 * hw, q0.view.cy + hh - (j + 0.5) / GRID_NY * 2 * hh]);
  await ev('__cmwSmReset(), 1');
  const region = await settled({ max: PLANE_WAIT, until: `__cmwSphere().entries.length === 0 && __cmwSvFixed() && ${DRAWN}` });
  const entries = await ev('__cmwSphere().entries.length'), got = (await lpx(PTS)).px;
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); 1`);
  await settled({ max: PLANE_WAIT, until: `__cmwSteps().stage === 0 && ${DRAWN}` });
  // (each point's one preimage, 1/w, and plane z's pixels about it: its axes and the lines the colouring draws are
  // a pixel or two wide, and a preimage that close to one is read off the line's pixels too)
  const s0 = (await lpx([])).view.s, OFF = [-NEAR, 0, NEAR].flatMap((a) => [-NEAR, 0, NEAR].map((b) => [a / s0, b / s0]));
  const near = (await lpx(PTS.flatMap(([x, y]) => { const d = x * x + y * y; return OFF.map(([a, b]) => [x / d + a, -y / d + b]); }))).px;
  const ref = PTS.map((w, k) => near.slice(k * OFF.length, (k + 1) * OFF.length));
  const paper = [], wrong = [];
  let n = 0, fronts = 0;
  PTS.forEach((w, k) => {
    const g = got[k] && got[k][4], r = ref[k][OFF.length >> 1], rs = ref[k].filter(Boolean).flat(), cell = [k % GRID_NX, Math.floor(k / GRID_NX)];
    if (!g) return;
    if (g.slice(0, 3).every((c) => c > PAPER_MIN)) paper.push(cell);
    if (!r) return;
    n++;
    if (rs.some((p) => dist(g, p) <= MATCH)) fronts++; else if (wrong.length < 8) wrong.push({ cell, w: w.map((v) => +v.toFixed(2)), got: g.slice(0, 3), front: r[4].slice(0, 3) });
  });
  const share = n ? +(fronts / n).toFixed(4) : 0;
  info[L.id] = { region, entries, points: PTS.length, read: n, paper, front: share, wrong };
  ok(`${L.id}: 1/z at rest, plane 1, the region meshes' frame: no point of the pane is bare paper`, region.ok && entries === 0 && got.filter(Boolean).length === PTS.length && paper.length === 0, info[L.id]);
  ok(`${L.id}: 1/z at rest, plane 1, the region meshes' frame shows the front sheet (1/w) at ${FRONT_MIN * 100} % of the pane's points or more: no streak across the pole`, region.ok && entries === 0 && n >= 0.8 * PTS.length && share >= FRONT_MIN, info[L.id]);
}
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
return { pass: fails.length === 0, fails, info };

// The steps view's pre-mapped meshes (SphereMesh) at rest about a critical value's preimages: z³ then cos, colour from z,
// Everywhere, alpha 1, plane 2. Over an arc of w (Re w from the pane's left edge or ARC.x0 to ARC.x1, the pane's height,
// off the real axis) every point is an exact tie: cos(z³) is sixfold symmetric about 0, so the first sheets of each w
// have one key and the tie order alone (larger Im z, Inverse.order) puts one in front. The arc runs through cos's
// critical value w = -1, whose preimages (z³ = π, |z| about 1.46) fold the map: a mesh that stops short of the leaves
// there (its work or node budget, refined in device pixels) draws other sheets, or colours of none, triangle by triangle.
// Each leg (LEGS: a desktop pane at dpr 1 and 2, 390 x 844 and 360 x 780 phones at dpr 2) opens the page anew at its size:
// - each point's first four sheets in the inverse pass's order under __cmwSvKey(2); plane z's colours at them (read on plane
//   0); the frame's pixel is the nearest of the four within MATCH, else none;
// - (control) the region meshes' frame (the pre-mapped meshes dropped, __cmwSmReset, and the frame before one is built
//   again: __cmwSteps().carryPre 0) shows the front sheet at no fewer than FRONT_MIN of the points;
// - once the pre-mapped meshes are built (__cmwSphere()'s jobs done: the pane's and its outer ring's), the plane's frame
//   shows the front sheet at no fewer than FRONT_MIN of the points too (whichever draws it: the pre-mapped meshes, or the
//   region meshes again once their fix-up has nothing left that needs one), and no point of the arc's strip along the
//   real axis (|Im w| < ARC.axis, AXIS_Y) is bare paper;
// - no frame they draw, from the first until both are built, leaves a point of the pane bare paper (a PAPER_NX x PAPER_NY
//   grid, every channel over PAPER_MIN), as the region meshes' frame leaves none (control).
// The page is opened in the steps view (carry_kit's openSteps: test.html?view=steps).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { DRAWN, openSteps, toPlane, lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const ARC = { x0: -3.4, x1: -1.2, y: 3.75, step: 0.1, axis: 0.04, edge: 0.05 };   // the arc's grid of w (plane units); |Im w| > axis, and edge inside the pane's sides
const AXIS_Y = [-0.03, -0.01, 0.01, 0.03], AXIS_STEP = 0.02;   // the strip along the real axis: its rows of Im w, and its step in Re w
const MATCH = 40;                  // a pixel is a sheet's when its largest channel difference from that sheet's colour is within this
const FRONT_MIN = 0.99;            // the share of the counted points that show the front sheet
const PRE_WAIT = 60000, PLANE_WAIT = 60000;   // ms
const PAPER_NX = 24, PAPER_NY = 16, PAPER_MIN = 235;   // the pane's grid for bare paper, and paper's least channel
// the legs: the window (CSS px), its device pixel ratio, and whether it is a phone (touch, mobile metrics)
const LEGS = [{ id: 'desk', w: 1200, h: 800, dpr: 1, phone: false }, { id: 'desk@2', w: 1200, h: 800, dpr: 2, phone: false }, { id: 'phone@2', w: 390, h: 844, dpr: 2, phone: true }, { id: 'phone360@2', w: 360, h: 780, dpr: 2, phone: true }];
const STEPS = [{ type: 'pown', params: { n: 3 }, on: true }, { type: 'cos', params: {}, on: true }];
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
for (const L of LEGS) {
  await send('Emulation.setDeviceMetricsOverride', { width: L.w, height: L.h, deviceScaleFactor: L.dpr, mobile: L.phone });
  await send('Emulation.setTouchEmulationEnabled', { enabled: L.phone, maxTouchPoints: L.phone ? 5 : 1 });
  await openSteps(PORT, STEPS, { srcView: { cx: 0, cy: 0, s: 80 } });
  // (the arc's grid and the axis strip, inside the pane's sides)
  const box = await ev(`(() => { const m = __cmwCards().main, c = document.getElementById('canvasL'), hw = c.width / (2 * m.view.s * m.dpr), hh = c.height / (2 * m.view.s * m.dpr); return { x0: m.view.cx - hw, y1: m.view.cy + hh, dpr: m.dpr }; })()`);
  const PTS = [], AXIS = [];
  for (let x = Math.max(ARC.x0, Math.ceil((box.x0 + ARC.edge) / ARC.step) * ARC.step); x <= ARC.x1 + 1e-9; x += ARC.step) for (let y = -Math.min(ARC.y, box.y1 - ARC.edge); y <= Math.min(ARC.y, box.y1 - ARC.edge) + 1e-9; y += ARC.step) if (Math.abs(y) > ARC.axis) PTS.push([+x.toFixed(2), +y.toFixed(2)]);
  for (let x = box.x0 + ARC.edge; x <= ARC.x1 + 1e-9; x += AXIS_STEP) for (const y of AXIS_Y) AXIS.push([+x.toFixed(3), y]);
  // (every animation frame drawn by a pre-mapped mesh, __cmwSteps().carryPre > 0: the points of a PAPER_NX x PAPER_NY grid over
  // the pane that are bare paper, each channel over PAPER_MIN; the most in any one frame, until __arcPaperStop)
  await ev(`(() => { const P = window.__arcPaper = { frames: 0, most: 0, at: null, on: true };
    const tick = () => { if (!P.on) return;
      if (__cmwSteps().carryPre > 0) { const c = document.getElementById('canvasL'), g = c.getContext('2d'); let n = 0;
        for (let i = 0; i < ${PAPER_NX}; i++) for (let j = 0; j < ${PAPER_NY}; j++) { const d = g.getImageData(Math.floor((i + 0.5) / ${PAPER_NX} * c.width), Math.floor((j + 0.5) / ${PAPER_NY} * c.height), 1, 1).data; if (d[0] > ${PAPER_MIN} && d[1] > ${PAPER_MIN} && d[2] > ${PAPER_MIN}) n++; }
        P.frames++; if (n > P.most) { P.most = n; P.at = performance.now(); } }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick); return 1; })()`);
  await toPlane(2);
  // (the plane at rest once its pre-mapped meshes are built: none still building or asked for, the pane's and its outer ring's)
  const pre = await settled({ max: PRE_WAIT, until: `!!__cmwSteps().rest && __cmwSteps().rest.a === 2 && __cmwSphere().entries.length > 0 && __cmwSphere().jobs.length === 0 && !__cmwSphere().kick && ${DRAWN}` });
  const win = (await ev('__cmwSvKey(2)')).win, lists = PTS.map(cand(win));
  const order = await ev(`(() => { const k = __cmwSvKey(2), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])), per: k.per && CX.C(k.per[0], k.per[1]) };
    return ${JSON.stringify(lists)}.map((L) => Inverse.order(L.map((p, i) => ({ z: CX.C(p[0], p[1]), D: Inverse.sheetKey(prep, CX.C(p[0], p[1]), null), lam: null, i }))).slice(0, 4).map((o) => o.i)); })()`);
  const paper = await ev('(() => { const P = window.__arcPaper; P.on = false; return { frames: P.frames, most: P.most }; })()');
  const frames = { pre: { wait: pre, carryPre: await ev('__cmwSteps().carryPre'), mesh: await ev('__cmwSphere().entries.map((e) => ({ partial: e.partial, nodes: e.nodes, work: e.work, why: e.budgetWhy }))'), px: (await lpx(PTS)).px, axis: (await lpx(AXIS)).px } };
  // (the region meshes: the pre-mapped ones dropped, read before one is built again)
  await ev('__cmwSmReset(), 1');
  const region = await settled({ max: PLANE_WAIT, until: `__cmwSteps().carryPre === 0 && ${DRAWN}` });
  frames.region = { wait: region, carryPre: await ev('__cmwSteps().carryPre'), px: (await lpx(PTS)).px, axis: (await lpx(AXIS)).px };
  const regionPaper = await ev(`(() => { const c = document.getElementById('canvasL'), g = c.getContext('2d'); let n = 0;
    for (let i = 0; i < ${PAPER_NX}; i++) for (let j = 0; j < ${PAPER_NY}; j++) { const d = g.getImageData(Math.floor((i + 0.5) / ${PAPER_NX} * c.width), Math.floor((j + 0.5) / ${PAPER_NY} * c.height), 1, 1).data; if (d[0] > ${PAPER_MIN} && d[1] > ${PAPER_MIN} && d[2] > ${PAPER_MIN}) n++; }
    return n; })()`);
  info[L.id] = { dpr: box.dpr, points: PTS.length, axis: AXIS.length, paper: { region: regionPaper, pre: paper } };
  ok(`${L.id}: z³ then cos at rest, plane 2, the region meshes' frame (control): no point of the pane is bare paper`, region.ok && regionPaper === 0, info[L.id].paper);
  ok(`${L.id}: z³ then cos at rest, plane 2: no frame drawn by the pre-mapped meshes, from the first until both are built, leaves a point of the pane bare paper`, paper.frames > 0 && paper.most === 0, info[L.id].paper);
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); 1`);
  await settled({ max: PLANE_WAIT, until: `__cmwSteps().stage === 0 && ${DRAWN}` });
  const ref = (await lpx(order.flatMap((o, k) => o.map((i) => lists[k][i])))).px;
  const dist = (a, b) => Math.max(...[0, 1, 2].map((c) => Math.abs(a[c] - b[c])));
  const classify = (px) => {
    const t = { n: 0, rank: [0, 0, 0, 0], none: 0, ex: [] };
    let at = 0;
    PTS.forEach((w, k) => {
      const g = px[k] && px[k][4], refs = ref.slice(at, at + order[k].length).map((q) => q && q[4]);
      at += order[k].length;
      if (!g || !refs.length || refs.some((q) => !q)) return;
      t.n++;
      let best = -1, bd = Infinity;
      refs.forEach((q, i) => { const d = dist(g, q); if (d < bd) { bd = d; best = i; } });
      if (bd > MATCH) t.none++; else t.rank[best]++;
      if ((bd > MATCH || best > 0) && t.ex.length < 4) t.ex.push({ w, got: g.slice(0, 3), rank: bd > MATCH ? null : best });
    });
    t.front = t.n ? +(t.rank[0] / t.n).toFixed(4) : 0;
    return t;
  };
  const isPaper = (p) => !!p && p[4].slice(0, 3).every((c) => c > PAPER_MIN);
  for (const [key, what] of [['region', 'the region meshes\' frame (control)'], ['pre', 'the frame once the pre-mapped meshes are built']]) {
    const f = frames[key], c = classify(f.px), bare = AXIS.filter((w, k) => isPaper(f.axis[k]));
    info[L.id][key] = { wait: f.wait, carryPre: f.carryPre, mesh: f.mesh, tally: c, axisPaper: bare.length, axisEx: bare.slice(0, 4) };
    ok(`${L.id}: z³ then cos at rest, plane 2, ${what}: the arc's points show the front sheet at ${FRONT_MIN * 100} % or more of ${PTS.length}`, f.wait.ok && (key !== 'region' || f.carryPre === 0) && c.n >= 0.9 * PTS.length && c.front >= FRONT_MIN, info[L.id][key]);
    ok(`${L.id}: z³ then cos at rest, plane 2, ${what}: no point of the arc's strip along the real axis (${AXIS.length}) is bare paper`, f.wait.ok && f.axis.filter(Boolean).length >= 0.9 * AXIS.length && bare.length === 0, info[L.id][key]);
  }
}
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
return { pass: fails.length === 0, fails, info };

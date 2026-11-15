// The steps view's glide on the Sphere surface looks as the exact picture at the same u: held at
// u = 0.25, 0.5 and 0.75 of a glide between two coloured planes, each pixel of the globe shows the colour that plane
// z's parked globe shows at the point the glide's map H_u carries there, lit for its place on the moving globe.
// The reference is held_frames.js's globeJudge: per sample point w of the sphere's front side (a lattice of the sphere,
// its pixel P on the moving globe), z0 = H_u^-1(w) by Newton's method (the step is a Möbius map, so z0 is the one
// point), and its pixel Q on the parked globe of plane z, where it shows on the front side; the globe's light is taken
// out at Q and put back at P; points next to a colour line, a stroke or the limb are not compared. At most OVER_MAX of
// at least N_MIN compared points may be more than TOL levels apart in a channel.
// Both scopes: Everywhere (the whole globe in colour) and Inside regions (the colour inside the regions, which move).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const TOL = 8, OVER_MAX = 0.005, N_MIN = 300, LOOK_U = [0.25, 0.5, 0.75];
await view(1200, 800);
const ST = {
  pattern: 'phase', outline: true, lines: false, unit: false, alpha: 1, v3: true, v4: true, v5: true, v6: true, nextId: 50,
  focus: 0, rightMode: 'image',
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }],
  shapes: [{ id: 'd0', kind: 'disc', c: [0.2, 0.6], r: 0.9, ci: 0, visible: true }],
  targets: [],
};
const NS = 'svslook' + Date.now();
await seed(NS, ST);
await go(`http://localhost:${PORT}/test.html?ns=${NS}&view=steps`);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvGlobe === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
await ev(`__cmwSet('morphPaths', false), 1`);
// the kept frames (grab) and the moving globe against the exact picture (globeJudge): test/lib/held_frames.js
const { grab, globeJudge } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const compare = (P, F) => globeJudge(P, F, { tol: TOL, minN: N_MIN, maxOver: OVER_MAX });
// (a kept frame read in the page: its pixels, the canvas's size and its device pixels per CSS pixel)
const FRAME = `const frame = (t) => { const c = document.getElementById('canvasL'); return { W: c.width, H: c.height, k: c.width / c.getBoundingClientRect().width, d: window.__heldPx[t] }; };`;
for (const scope of ['all', 'in']) {
  await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: ${JSON.stringify(scope)}, T: 1 }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && GLR.pendingLinks === 0' });
  ok(`${scope}: plane z's parked globe settles`, await grab('P'), null);
  for (const u of LOOK_U) {
    await ev(`__cmwSteps({ x: ${u} }); 1`);
    await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${u}) < 1e-9 && GLR.pendingLinks === 0 && __cmwSvGlobe(0, 0).path === 'inverse'` });
    ok(`${scope}, u = ${u}: the moving globe settles`, await grab('F'), null);
    const r = await compare('P', 'F');
    R[`${scope} ${u}`] = r;
    ok(`${scope === 'all' ? 'Everywhere' : 'Inside regions'}, u = ${u}: the moving globe is the exact picture at u (at most ${OVER_MAX * 100} % of ≥ ${N_MIN} points over ${TOL} levels)`,
      r.path === 'inverse' && r.n >= N_MIN && r.over <= OVER_MAX, r);
  }
}
// The strokes: with two Möbius steps, a curve and a region's border of plane z and of plane w1, held at u = 0.25 and
// 0.75 of the glide w1 -> w2, are where H_u carries them from the parked globe of w1: each stroke pixel of the parked
// globe (where the frame with the strokes hidden differs by more than 60 levels in sum) is picked to its point z of w1
// (__cmwGlobeSnap's raw pick), carried to w = H_u(z), and the moving globe has a stroke pixel within STROKE_R px of w's
// pixel, for at least HIT_MIN of at least MIN_SAMPLES of them, for plane w1's circle and for every stroke together.
const HIT_MIN = 0.9, MIN_SAMPLES = 40, STROKE_R = 3;
const ST2 = {
  pattern: 'phase', outline: true, lines: false, unit: false, alpha: 1, v3: true, v4: true, v5: true, v6: true, nextId: 50,
  focus: 0, rightMode: 'image',
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [
    { id: 'l0', kind: 'line', a: [-2, 0.6], b: [2, 0.9], ci: 0, visible: true },
    { id: 'd0', kind: 'disc', c: [-0.3, -0.3], r: 0.5, ci: 1, visible: true },
    { id: 'c1', kind: 'circle', c: [0.1, 0.2], r: 0.5, ci: 2, visible: true, stage: 1 },
    { id: 'd1', kind: 'disc', c: [-0.4, -0.3], r: 0.3, ci: 3, visible: true, stage: 1 },
  ],
  targets: [],
};
const C1 = ST2.shapes[2];
await seed(NS + 'b', ST2);
await go(`http://localhost:${PORT}/test.html?ns=${NS}b&view=steps`);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvGlobe === "function" && !!window.GLR && GLR.pendingLinks === 0' });
await ev(`__cmwSet('morphPaths', false), 1`);
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere', scope: 'all', T: 2 }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving && GLR.pendingLinks === 0' });
// (the frame as it is and with the strokes hidden)
const grab2 = async (tag) => {
  ok(`the frame ${tag} settles`, await grab(tag), null);
  await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000, until: 'GLR.pendingLinks === 0' });
  ok(`the frame ${tag} without strokes settles`, await grab(tag + '0'), null);
  await ev('__cmwHideStrokes(false), 1'); await settled({ max: 20000, until: 'GLR.pendingLinks === 0' });
};
await grab2('S');
for (const u of [0.25, 0.75]) {
  await ev(`__cmwSteps({ x: ${1 + u} }); 1`);
  await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${1 + u}) < 1e-9 && GLR.pendingLinks === 0` });
  await grab2('M');
  const r = await ev(`(() => {
    ${FRAME}
    const P = frame('S'), P0 = frame('S0'), M = frame('M'), M0 = frame('M0'), W = P.W, Hh = P.H, k = P.k, g = __cmwSvGlobe(0, 0), H = g.H;
    const drawn = (D, D0, i) => Math.abs(D.d[i] - D0.d[i]) + Math.abs(D.d[i + 1] - D0.d[i + 1]) + Math.abs(D.d[i + 2] - D0.d[i + 2]) > 60;
    const R = Math.round(${STROKE_R} * k), c1 = ${JSON.stringify(C1)};
    const all = { n: 0, hit: 0 }, own = { n: 0, hit: 0 };
    let back = 0;
    for (let y = 2; y < Hh - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
      const i = 4 * (y * W + x);
      if (!drawn(P, P0, i)) continue;
      const q = __cmwGlobeSnap('L', (x + 0.5) / k, (y + 0.5) / k);
      if (!q || !q.g) continue;
      const z = { re: q.g[0], im: q.g[1] }, w = H(z), s = w && __cmwGlobeXY('L', w.re, w.im);
      if (!s) { back++; continue; }
      const wx = Math.round(s[0] * k - 0.5), wy = Math.round(s[1] * k - 0.5);
      if (!(wx >= R && wy >= R && wx < W - R && wy < Hh - R)) { back++; continue; }
      let found = false;
      for (let dy = -R; dy <= R && !found; dy++) for (let dx = -R; dx <= R && !found; dx++) { const j = 4 * ((wy + dy) * W + wx + dx); if (drawn(M, M0, j)) found = true; }
      const mine = Math.abs(Math.hypot(z.re - c1.c[0], z.im - c1.c[1]) - c1.r) < 0.03;
      all.n++; if (found) all.hit++;
      if (mine) { own.n++; if (found) own.hit++; }
    }
    return { all, own, back, path: g.path };
  })()`);
  R[`strokes ${u}`] = r;
  ok(`strokes, u = ${u}: every stroke is where H_u carries it (≥ ${HIT_MIN * 100} % of ≥ ${MIN_SAMPLES})`, r.all.n >= MIN_SAMPLES && r.all.hit >= HIT_MIN * r.all.n, r);
  ok(`strokes, u = ${u}: plane w1's circle is where H_u carries it (≥ ${HIT_MIN * 100} % of ≥ ${MIN_SAMPLES})`, r.own.n >= MIN_SAMPLES && r.own.hit >= HIT_MIN * r.own.n, r);
}
// Past the colour plane (T = 1: plane w2 is past it) the globe shows the colour carried there, as the plane does,
// at rest and moving, with no fade: the glide w1 -> w2 held at u = 0.25 and 0.75 is drawn by the inverse pass and is
// the exact picture at u (as above, from w1's parked globe); at rest on w2 the globe draws the carried colour; and
// at u = 0.998 the moving globe is w2's resting globe (a mean within END_MEAN levels on the whole frame).
const END_MEAN = 1.5;
await ev(`__cmwSteps({ go: 1, now: true, T: 1 }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving && GLR.pendingLinks === 0' });
ok("past the colour plane: plane w1's parked globe settles", await grab('P'), null);
for (const u of [0.25, 0.75]) {
  await ev(`__cmwSteps({ x: ${1 + u} }); 1`);
  await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${1 + u}) < 1e-9 && GLR.pendingLinks === 0` });
  ok(`past the colour plane, u = ${u}: the moving globe settles`, await grab('F'), null);
  const r = await compare('P', 'F');
  R[`past T ${u}`] = r;
  ok(`past the colour plane, u = ${u}: the moving globe is the exact picture at u, drawn by the inverse pass (at most ${OVER_MAX * 100} % of ≥ ${N_MIN} points over ${TOL} levels)`,
    r.path === 'inverse' && r.n >= N_MIN && r.over <= OVER_MAX, r);
}
await ev(`__cmwSteps({ go: 2, now: true }); 1`);
await settled({ max: 60000, until: '!__cmwSteps().moving && GLR.pendingLinks === 0' });
ok("plane w2's resting globe settles", await grab('E'), null);
R.restPastT = await ev('__cmwSvGlobe(0, 0)');
ok('at rest past the colour plane the globe shows the carried colour (the inverse pass)', R.restPastT && R.restPastT.path === 'inverse', R.restPastT);
await ev(`__cmwSteps({ x: 1.998 }); 1`);
await settled({ max: 60000, until: 'Math.abs(__cmwSteps().x - 1.998) < 1e-9 && GLR.pendingLinks === 0' });
ok('the globe just before w2 settles', await grab('F'), null);
R.endPastT = await ev(`(() => {
  const A = window.__heldPx.E, B = window.__heldPx.F;
  let sum = 0;
  for (let i = 0; i < A.length; i += 4) sum += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
  return { mean: +(sum / (A.length / 4)).toFixed(3), path: __cmwSvGlobe(0, 0).path };
})()`);
ok(`just before w2 the moving globe is w2's resting globe (a mean within ${END_MEAN} levels)`, R.endPastT.path === 'inverse' && R.endPastT.mean <= END_MEAN, R.endPastT);
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

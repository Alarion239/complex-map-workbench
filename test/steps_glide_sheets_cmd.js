// A glide frame is the parked plane it leaves and the parked plane it arrives at, a hair from either (issue #1413, part of #1194;
// the standing rule: moving frames look like parked planes). With Show all sheets, the parked plane past a multi-valued step
// draws all its sheets; the glide frame END_EPS of a step short of that plane must be the same picture, and the frame END_EPS
// past the plane the step leaves the same as that plane: at most SAME_FRAC of the pixels (not paper in both frames) more than TOL
// levels apart. The frame sits END_EPS of a step from the plane, so the glide's own motion is sub-pixel and the parked plane
// stands for the exact picture of the glide there. A pixel on an edge of the colour (the parked frame's 3 x 3 neighbourhood
// spans more than EDGE_LEVELS in a channel: a ring or a sector's boundary, which the two paths filter apart) is left out; at
// most EDGE_MAX_SHARE of the compared pixels may be (measured 8.5 % and 8.1 %: the rings, the sectors and the seam), and with
// every pixel an edge the cap fails (a control). The edge pixels are compared apart (the ruler ruling's one pixel of rasterization):
// each passes when some pixel of the parked frame's 3 x 3 around it is within TOL levels of the glide's; at most SAME_FRAC of them
// may fail; the controls are the parked plane against itself (none fails) and against itself shifted EDGE_SHIFT_PX px (the measure must fail), which hold whatever the glide draws. The colour layer alone (strokes hidden, bare).
// Chains, each at both ends of its last step:
// - Square root alone: the glide is the inverse pass's (glide.path 'inverse');
// - the cubic z^3 - 3z, then the Square root: the exact renderer inverts no cubic, so the glide is the carried meshes' (glide.path 'mesh').
// A control must fail the same measure: the same glide frame against the plane the step starts from, more than CONTROL_FACTOR
// times SAME_FRAC over TOL. A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js
// names. Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (TOL levels of 255 per channel; SAME_FRAC the share of the pixels over TOL; CONTROL_FACTOR how many times SAME_FRAC a control
// must exceed; MIN_PIXELS the least count compared; WHITE a channel above which a pixel is paper; EDGE_LEVELS the span that
// makes a pixel an edge; EDGE_MAX_SHARE the most of the compared pixels that may be left out as edges; EDGE_SHIFT_PX the shift of the edge measure's control; END_EPS how far a step
// the glide frame is from its parked plane, so its motion is below a hundredth of a pixel; RELOAD_MS the wait for the page a
// figure's opening reloads)
const TOL = 6, SAME_FRAC = 0.005, CONTROL_FACTOR = 10, MIN_PIXELS = 5000, WHITE = 250, EDGE_LEVELS = 24, EDGE_MAX_SHARE = 0.1, EDGE_SHIFT_PX = 2, END_EPS = 1e-4, RELOAD_MS = 4000;
const CUBIC = { type: 'custom', params: { expr: 'z^3-3z', cut: 180 } };
const CHAINS = [
  { label: 'Square root alone', example: 'Square root and its sheets', pre: [], last: 1, path: 'inverse' },
  { label: 'the cubic z^3-3z, then the Square root', example: 'Square root and its sheets', pre: [CUBIC], last: 2, path: 'mesh' },
];
// (the example names: test/lib/carry_kit.js; the frames kept once still: grab, test/lib/held_frames.js)
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const names = exampleNames();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// the chain opened: the example, then its steps preceded by c.pre (a figure opened from its state reloads the page)
const openChain = async (c) => {
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=sheets${Date.now()}` });
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
  await ev(`__cmwExample(${names.indexOf(c.example)}); 1`); await settled({ max: 20000 });
  if (!c.pre.length) return;
  await ev(`(() => { const st = __cmwP().figure; st.steps = ${JSON.stringify(c.pre)}.concat(st.steps); setTimeout(() => __cmwPOpen(st), 0); return 1; })()`);
  await pause(RELOAD_MS);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && __cmwP().steps.length === ${c.pre.length + 1}` });
};
// the glide frame at gx against the parked plane px: {n, over, max, drawn, drawnOver, edgeShare, edgeFail, edgeFailShifted, path} (drawn: the pixels the glide draws, of n; edgeShare: the share of the pixels not paper in both frames that are left out as edges; edgeFail: the share of those edge pixels with no pixel of the parked 3 x 3 within TOL of the glide's, and the same with the glide frame shifted EDGE_SHIFT_PX px)
const measure = async (c, gx, px, edgeLevels = EDGE_LEVELS) => {
  await openChain(c);
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); __cmwSteps({ park: ${px} }); 1`);
  await settled({ max: 20000 }); ok(`${c.label}: the parked plane ${px} is drawn`, await grab('parked'), null);
  await ev(`__cmwSteps({ x: ${gx} }); 1`);
  await settled({ max: 20000 }); ok(`${c.label}: the glide frame at ${gx} is drawn`, await grab('glide'), null);
  const path = await ev('(__cmwSteps().glide || {}).path');
  const r = await ev(`(() => {
    const cv = document.getElementById('canvasL'), W = cv.width, H = cv.height, G = window.__heldPx.glide, P = window.__heldPx.parked;
    const edge = (x, y) => {
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = Math.min(W - 1, Math.max(0, x + dx)), Y = Math.min(H - 1, Math.max(0, y + dy)), v = P[4 * (Y * W + X) + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
        if (hi - lo > ${edgeLevels}) return true;
      }
      return false;
    };
    // an edge pixel (not paper in both frames) passes when some pixel of the parked frame's 3 x 3 around it is within TOL of the glide's
    const near = (gx, gy, x, y) => {
      const gi = 4 * (gy * W + gx);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = Math.min(W - 1, Math.max(0, x + dx)), Y = Math.min(H - 1, Math.max(0, y + dy)), i = 4 * (Y * W + X);
        if (Math.max(Math.abs(G[gi] - P[i]), Math.abs(G[gi + 1] - P[i + 1]), Math.abs(G[gi + 2] - P[i + 2])) <= ${TOL}) return true;
      }
      return false;
    };
    let n = 0, over = 0, max = 0, dn = 0, dover = 0, all = 0, edges = 0, edgeFail = 0, edgeFailShifted = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = 4 * (y * W + x);
      const gp = G[i] > ${WHITE} && G[i + 1] > ${WHITE} && G[i + 2] > ${WHITE}, pp = P[i] > ${WHITE} && P[i + 1] > ${WHITE} && P[i + 2] > ${WHITE};
      if (gp && pp) continue;
      all++;
      if (edge(x, y)) { edges++; if (!near(x, y, x, y)) edgeFail++; if (!near(Math.min(W - 1, x + ${EDGE_SHIFT_PX}), y, x, y)) edgeFailShifted++; continue; }
      const d = Math.max(Math.abs(G[i] - P[i]), Math.abs(G[i + 1] - P[i + 1]), Math.abs(G[i + 2] - P[i + 2]));
      n++; max = Math.max(max, d); if (d > ${TOL}) over++;
      if (!gp) { dn++; if (d > ${TOL}) dover++; }
    }
    return { n, max, over: n ? +(over / n).toFixed(4) : null, drawn: dn, drawnOver: dn ? +(dover / dn).toFixed(4) : null, edgeShare: all ? +(edges / all).toFixed(4) : null, edgeFail: edges ? +(edgeFail / edges).toFixed(4) : null, edgeFailShifted: edges ? +(edgeFailShifted / edges).toFixed(4) : null };
  })()`);
  return Object.assign(r, { path });
};
for (const c of CHAINS) {
  const a = c.last - 1, b = c.last, gx = b - END_EPS;
  const lo = await measure(c, a + END_EPS, a);
  info[`${c.label}: glide ${END_EPS} past plane ${a}`] = lo;
  ok(`${c.label}: the glide at the start of its last step is drawn by the ${c.path} path`, lo.path === c.path, lo);
  ok(`${c.label}: the frame ${END_EPS} past plane ${a} is the parked plane, at most ${SAME_FRAC * 100} % of the pixels more than ${TOL} levels off`, lo.n > MIN_PIXELS && lo.over <= SAME_FRAC, lo);
  ok(`${c.label}: the edge pixels of the frame ${END_EPS} past plane ${a} are the parked plane's within one pixel, at most ${SAME_FRAC * 100} % of them without a pixel of its 3 x 3 within ${TOL} levels`, lo.edgeFail !== null && lo.edgeFail <= SAME_FRAC, lo);
  const hi = await measure(c, gx, b);
  info[`${c.label}: glide ${END_EPS} short of plane ${b}`] = hi;
  ok(`${c.label}: the glide at the end of its last step is drawn by the ${c.path} path`, hi.path === c.path, hi);
  ok(`${c.label}: at most ${EDGE_MAX_SHARE * 100} % of the pixels compared are left out as colour edges`, hi.edgeShare !== null && hi.edgeShare <= EDGE_MAX_SHARE, hi);
  ok(`${c.label}: where the glide at the end of its last step draws, it is the parked plane, at most ${SAME_FRAC * 100} % of those pixels more than ${TOL} levels off`, hi.drawn > MIN_PIXELS && hi.drawnOver <= SAME_FRAC, hi);
  ok(`${c.label}: the frame ${END_EPS} short of plane ${b} is the parked plane (every sheet), at most ${SAME_FRAC * 100} % of the pixels more than ${TOL} levels off`, hi.n > MIN_PIXELS && hi.over <= SAME_FRAC, hi);
  ok(`${c.label}: the edge pixels of the frame ${END_EPS} short of plane ${b} are the parked plane's within one pixel, at most ${SAME_FRAC * 100} % of them without a pixel of its 3 x 3 within ${TOL} levels`, hi.edgeFail !== null && hi.edgeFail <= SAME_FRAC, hi);
  const self = await measure(c, a, a);
  info[`${c.label} (control: plane ${a} against itself)`] = self;
  ok(`${c.label} (control): the parked plane ${a} against itself: no edge pixel fails`, self.edgeFail === 0, self);
  ok(`${c.label} (control): the parked plane ${a} against itself shifted ${EDGE_SHIFT_PX} px: more than ${CONTROL_FACTOR * SAME_FRAC * 100} % of the edge pixels fail`, self.edgeFailShifted > CONTROL_FACTOR * SAME_FRAC, self);
  const allEdges = await measure(c, gx, b, 0);
  info[`${c.label} (control: every pixel an edge)`] = allEdges;
  ok(`${c.label} (control): with every pixel an edge, more than ${EDGE_MAX_SHARE * 100} % of the pixels compared are left out`, allEdges.edgeShare > EDGE_MAX_SHARE, allEdges);
  const wrong = await measure(c, gx, a);
  info[`${c.label} (control: plane ${a})`] = wrong;
  ok(`${c.label} (control): the same frame against plane ${a}: more than ${CONTROL_FACTOR * SAME_FRAC * 100} % of the pixels over ${TOL} levels`, wrong.over > CONTROL_FACTOR * SAME_FRAC, wrong);
}
return { pass: fails.length === 0, fails, info };

// A glide frame's dashed cut banks keep the parked plane's dash phase on arrival (#2004), where a bank's image bends
// sharply. The dashes are laid from the bank's start along its screen polyline, so the phase at a point is the
// polyline's arc length up to it. arcosh and arccos as one-step chains, Everywhere, at 1200 × 800: their banks' images
// are the edges of a half-strip and a strip, turning a right angle at each corner. At the glide frame ARRIVE_EPS short
// of plane w1, which samples the banks thinned (SV_CUT_THIN), each point of a dashed bank that the parked plane w1
// draws in the pane lies at the parked plane's arc from the bank's start, within ARC_TOL px. (At ARRIVE_EPS the glide's
// map moves a point by under 0.01 px, and the arcs agree within 0.005 px; a thinned polyline that cuts arcosh's corner
// unlike the plane at rest shifts every dash after it by 0.7 px.)
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { UNHELD } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (ARRIVE_EPS: inside the glide's thinned sampling, which starts past SV_REST_U = 3e-7; ARC_TOL px; NEAR_PX: how far
// a parked point may lie from the glide's polyline and still be read on it; MIN_POINTS: the least points read a bank)
const ARRIVE_EPS = 1e-6, ARC_TOL = 0.1, NEAR_PX = 0.5, MIN_POINTS = 50;
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_chain_kit.js'), 'utf8'))({ ev, go, view, settled, PORT });
const D1 = { id: 'd1', kind: 'disc', c: [0.4, 0.2], r: 0.8, ci: 0, visible: true };
// a page in the steps view on the one-step chain step, Everywhere, the plane surface
const open = async (step, tag) => {
  const r = await K.openChain({ ns: `${tag}${Date.now()}`, steps: [Object.assign({ on: true }, step)], w: 1200, h: 800, shapes: [D1], max: 60000,
    until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwCutCurves === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
};
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); return settled({ max: 120000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
const place = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  return settled({ max: 120000, until: `GLR.pendingLinks === 0 && ${UNHELD} && Math.abs(__cmwSvX() - ${x}) < 1e-9 && (() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
};
// the dashed banks of the step's cut as drawn (__cmwCutCurves): each one's screen polyline with the arc from its start
// at every point (a gap restarts nothing here: the banks read are one run in the pane)
const dashedBanks = () => ev(`__cmwCutCurves().filter((c) => !c.solid && !c.pre).map((c) => {
  let a = 0, p = null; const out = [];
  for (const q of c.s) { if (!q) { p = null; continue; } if (p) a += Math.hypot(q[0] - p[0], q[1] - p[1]); out.push([q[0], q[1], a]); p = q; }
  return out;
})`);
const paneBox = () => ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
// for each point of the parked bank P inside the pane, the arc at its foot on the glide's polyline G (within NEAR_PX)
// minus its own: the largest gap and the count read
function arcGaps(P, G, box) {
  let worst = 0, n = 0, at = null;
  for (const q of P) {
    if (q[0] < 0 || q[1] < 0 || q[0] > box.w || q[1] > box.h) continue;
    let best = null;
    for (let k = 1; k < G.length; k++) {
      const a = G[k - 1], b = G[k], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      const s = L2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2)) : 0;
      const d = Math.hypot(a[0] + s * dx - q[0], a[1] + s * dy - q[1]);
      if (!best || d < best.d) best = { d, arc: a[2] + s * (b[2] - a[2]) };
    }
    if (!best || best.d > NEAR_PX) continue;
    n++;
    const g = Math.abs(best.arc - q[2]);
    if (g > worst) { worst = g; at = [Math.round(q[0]), Math.round(q[1])]; }
  }
  return { n, worst: +worst.toFixed(3), at };
}
for (const type of ['arcosh', 'arccos']) {
  await open({ type }, `cutdash${type}`);
  ok(`${type}: plane w1 at rest settles`, (await rest(1)).ok, null);
  const parked = await dashedBanks(), box = await paneBox();
  ok(`${type}: plane w1 at rest settles back on plane z`, (await rest(0)).ok, null);
  ok(`${type}: a glide frame ${ARRIVE_EPS} short of plane w1 is drawn`, (await place(1 - ARRIVE_EPS)).ok, null);
  const glide = await dashedBanks();
  const gaps = parked.map((P, i) => arcGaps(P, glide[i] || [], box));
  info[type] = { banks: [parked.length, glide.length], gaps };
  ok(`${type}: the glide frame and plane w1 draw the same dashed banks`, parked.length > 0 && parked.length === glide.length, info[type]);
  gaps.forEach((g, i) => {
    ok(`${type}, dashed bank ${i + 1}: read at ${MIN_POINTS} points at least in the pane`, g.n >= MIN_POINTS, g);
    ok(`${type}, dashed bank ${i + 1}: the glide frame ${ARRIVE_EPS} short of plane w1 lays its dashes at plane w1's phase (arc from the bank's start within ${ARC_TOL} px)`, g.n >= MIN_POINTS && g.worst <= ARC_TOL, g);
  });
}
return { pass: fails.length === 0, fails, info };

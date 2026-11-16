// The steps view's carried colour where the region meshes carry the whole plane: parked mid-glide, at each point
// w the colour of the point z that lands there must be the colour plane's colour of z, which plane z shows at z when
// it is coloured from the same colour plane (the reference, at rest on plane z, Everywhere, in the same camera). A point
// counts as wrong when its pixel differs by more than 14 in a channel from all 9 pixels around z's (a phase edge or a
// contour between two pixels is not an error); at most 1 % may be, and none may sit on the bare paper.
// Each frame is one the carried meshes draw (svCarryRegions), which the suite checks: the glide's record says 'mesh'.
// - Beside a region defined on a later plane (a disc on w₁), a region of plane z, Inside regions, coloured from z,
//   parked at x = 1/2 under z + 0.2 conj(z) (not analytic: its glide runs the straight line, and no inverse pass draws
//   it): the whole plane is carried and the moving regions keep it; the points checked are the plane-z region's, at
//   1.1 x + 0.9 i y.
// - A d/dz between plane z and the colour plane (z², d/dz, exp; coloured from w₃: exp(2z) at z), Everywhere, parked at
//   x = 5/2, past the d/dz (plane w₂'s points 2z on exp's zoom path at t = 1/2: 2(e^z − 1) + 1/2); the colour evaluates
//   the chain through the d/dz.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { lpx, paneOf, tally, grid, shown } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
await view(1200, 800, false, false);
// (quiet: the tiling's fix-up landed, every program linked, and a frame drawn after that, which the link's own redraw
// asks for)
const wait = async () => {
  await settled({ max: 60000, until: '__cmwSvFixed() && GLR.pendingLinks === 0' });
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
};
const open = async (state, tag) => {
  const ns = `cpl${tag}${Date.now()}`;
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof __cmwLPx === "function" && typeof __cmwSvFixed === "function" && !!window.GLR' });
  await ev("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
};
const step = (type, params) => ({ type, params: params || {}, on: true });
const base = (steps, shapes) => ({ v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
// the points z of an n x n grid over the pane's middle 90 % that pick(z) keeps, and their places w = place(z), where
// those show on the pane
const pairs = (P, n, pick, place) => {
  const W = [], Z = [];
  for (const z of grid(P, n, n, 0.9)) {
    if (!pick(z)) continue;
    const w = place(z);
    if (w && w.every(Number.isFinite) && shown(P, w)) { W.push(w); Z.push(z); }
  }
  return { W, Z };
};
// at: the frame's state (park: the thread's place); T: the colour plane; path: the
// glide record's path the frame must have (the carried meshes': 'mesh'), null for a frame that writes no record
async function check(tag, at, T, W, Z, min, path) {
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true, T })}); 1`);
  await wait();
  const ref = (await lpx(Z)).px;
  await ev(`__cmwSteps(${JSON.stringify(Object.assign({ surf: 'plane', T }, at))}); 1`);
  await wait();
  const state = await ev('__cmwSteps()'), got = (await lpx(W)).px;
  const fmt = (v) => v.map((q) => +q.toFixed(3));
  info[tag] = Object.assign(tally(got, ref, { note: (k) => ({ w: fmt(W[k]), z: fmt(Z[k]) }) }), { state: { x: state.x, T: state.T, scope: state.scope, core: state.core, all: state.all, between: state.between, glide: state.glide && { path: state.glide.path, reason: state.glide.reason, u: state.glide.u } } });
  ok(`${tag}: parked at x = ${at.park}, coloured from w${T}`, Math.abs(state.x - at.park) < 1e-9 && state.T === T, info[tag].state);
  ok(`${tag}: the colour plane's colour of each point, at most 1 % wrong`, info[tag].n >= min && info[tag].wrong <= 0.01 * info[tag].n, info[tag]);
  ok(`${tag}: no point on the bare paper`, info[tag].paper === 0, info[tag]);
  if (path) ok(`${tag}: drawn by the carried meshes (the glide's path '${path}')`, !!state.glide && state.glide.path === path, info[tag].state);
}

// ---- beside a region of a later plane (a disc on w₁), a region of plane z, under a step with no inverse ----
{
  // (z + 0.2 conj(z): not analytic, so its glide runs the straight line and no inverse pass draws it; at t = 1/2 the
  // points z = x + iy land at 1.1 x + 0.9 i y)
  const D0 = { c: [-1.2, 0.6], r: 0.6 };
  await open(base([step('custom', { expr: 'z+0.2*conj(z)', cut: 180 })], [{ id: 's0', kind: 'disc', c: D0.c, r: D0.r, ci: 1, visible: true },
    { id: 's1', kind: 'disc', c: [1.5, 0], r: 0.8, stage: 1, ci: 0, visible: true }]), 'l');
  const P = await paneOf();
  // (0.12 inside its rim, so the outline is clear)
  const { W, Z } = pairs(P, 90, (z) => Math.hypot(z[0] - D0.c[0], z[1] - D0.c[1]) < D0.r - 0.12, (z) => [1.1 * z[0], 0.9 * z[1]]);
  await check('beside a region of w1, Inside regions', { scope: 'in', park: 0.5 }, 0, W, Z, 100, 'mesh');
}

// ---- a d/dz between plane z and the colour plane, glided past it ----
{
  await open(base([step('pown', { n: 2 }), step('deriv'), step('exp')], []), 'd');
  const P = await paneOf();
  // (x = 5/2: plane w₂'s points 2z on exp's zoom path at t = 1/2, w = 2(e^z - 1) + 1/2, kept to |Im z| < 2.5 and
  // Re z > -1.2, where e^z does not squeeze the plane into a few pixels; the points z + 2 pi i k that land there too
  // have z's colour, exp(2z) having the period pi i)
  // (the colour exp(2z) steps at its band edges, |exp(2z)| a power of 1.69, and its 12 sectors' edges: points within
  // 0.02 of one are left out, where a place a pixel off shows the next band)
  const clear = (z) => { const bx = 2 * z[0] / Math.log(1.69), by = z[1] / (Math.PI / 12); return Math.abs(bx - Math.round(bx)) * Math.log(1.69) / 2 > 0.02 && Math.abs(by - Math.round(by)) * Math.PI / 12 > 0.02; };
  // (the frame is nearest plane w₃, which is coloured: the colour plot's grid is drawn over it at the integers of w
  // (colourGrid's step at this zoom), so a place within 2.5 px of one is left out too)
  const offGrid = (v) => Math.abs(v - Math.round(v)) * P.v.s > 2.5;
  const place = (z) => { const e = Math.exp(z[0]), w = [2 * (e * Math.cos(z[1]) - 1) + 0.5, 2 * e * Math.sin(z[1])]; return w.every(offGrid) ? w : null; };
  const past = pairs(P, 60, (z) => clear(z) && Math.abs(z[1]) < 2.5 && z[0] > -1.2, place);
  await check('a d/dz before the colour plane, glided past it', { scope: 'all', park: 2.5 }, 3, past.W, past.Z, 200, 'mesh');
}

return { pass: fails.length === 0, fails, info };

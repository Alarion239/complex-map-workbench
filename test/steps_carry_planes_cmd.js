// The steps view's carried colour where the region meshes carry the whole plane (#589): parked mid-glide, at each point
// w the colour of the point z that lands there must be the colour plane's colour of z, which plane z shows at z when
// it is coloured from the same colour plane (the reference, at rest on plane z, in the same camera). A point counts as
// wrong when its pixel differs by more than 14 in a channel from all 9 pixels around z's (a phase edge or a contour
// between two pixels is not an error); at most 1 % may be.
// - Beside a region defined on a later plane (a disc on w₁ under z²), a region of plane z, Inside regions, coloured
//   from z, parked at x = 1/2: the whole plane is carried and the moving regions keep it; the points checked are the
//   plane-z region's, which the power path's z^(3/2) places.
// - A d/dz between the glide and the colour plane (z², d/dz, exp; coloured from w₃: exp(2z) at z), Everywhere: parked
//   at x = 1/2, before the d/dz (the points placed by z^(3/2)), and at x = 5/2, past it (plane w₂'s points 2z on exp's
//   zoom path at t = 1/2: 2(e^z − 1) + 1/2); the colour evaluates the chain through the d/dz.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const wait = async () => { await settled({ max: 60000, until: '__cmwSvFixed()' }); };
const open = async (state, tag) => {
  const ns = `cpl${tag}${Date.now()}`;
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof __cmwLPx === "function" && typeof __cmwSvFixed === "function" && !!window.GLR' });
};
const step = (type, params) => ({ type, params: params || {}, on: true });
const base = (steps, shapes) => ({ v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
// the pane's camera and size in CSS pixels; whether a point is well inside it
const paneOf = async () => ev('(() => { const q = __cmwLPx([]); return { v: q.view, w: q.pw / q.dpr, h: q.ph / q.dpr }; })()');
const inside = (P, p) => Math.abs(p[0] - P.v.cx) <= 0.45 * P.w / P.v.s && Math.abs(p[1] - P.v.cy) <= 0.45 * P.h / P.v.s;
// the points z of a grid over the pane's inner 90 % that pick(z) keeps, each with its place w = place(z) (null: left out)
const pairs = (P, n, pick, place) => {
  const W = [], Z = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const z = [P.v.cx + (i / (n - 1) - 0.5) * 0.9 * P.w / P.v.s, P.v.cy + (j / (n - 1) - 0.5) * 0.9 * P.h / P.v.s];
    if (!pick(z)) continue;
    const w = place(z);
    if (!w || !w.every(Number.isFinite) || !inside(P, w)) continue;
    W.push(w); Z.push(z);
  }
  return { W, Z };
};
async function check(tag, at, T, W, Z, min) {
  await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true, T })}); 1`);
  await wait();
  const ref = await ev(`__cmwLPx(${JSON.stringify(Z)}).px`);
  await ev(`__cmwSteps(${JSON.stringify(Object.assign({ surf: 'plane', T }, at))}); 1`);
  await wait();
  const state = await ev('__cmwSteps()'), got = await ev(`__cmwLPx(${JSON.stringify(W)}).px`);
  let n = 0, wrong = 0, worst = 0;
  const ex = [];
  for (let k = 0; k < W.length; k++) {
    if (!got[k] || !ref[k]) continue;
    n++;
    const p = got[k][4];
    let best = 1e9;
    for (const q of ref[k]) best = Math.max(0, Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]))));
    worst = Math.max(worst, best);
    if (best > 14) { wrong++; if (ex.length < 6) ex.push({ w: W[k].map((v) => +v.toFixed(3)), z: Z[k].map((v) => +v.toFixed(3)), got: p.slice(0, 3), want: ref[k][4].slice(0, 3) }); }
  }
  info[tag] = { n, wrong, worst, ex, state: { x: state.x, T: state.T, scope: state.scope } };
  ok(`${tag}: parked at x = ${at.park}, coloured from w${T}`, Math.abs(state.x - at.park) < 1e-9 && state.T === T, info[tag].state);
  ok(`${tag}: the colour plane's colour of each point, at most 1 % wrong`, n >= min && wrong <= 0.01 * n, info[tag]);
}
const cpow = (z, p) => { const r = Math.hypot(z[0], z[1]) ** p, a = Math.atan2(z[1], z[0]) * p; return [r * Math.cos(a), r * Math.sin(a)]; };

// ---- beside a region of a later plane (a disc on w₁ under z²), a region of plane z ----
{
  // (the plane-z disc within |arg z| < pi / 3, where z^(3/2) puts no other point on its points' places, clear of w₁'s
  // disc pulled back, about ±sqrt 2)
  const D0 = { c: [1.3, -0.8], r: 0.45 };
  await open(base([step('pown', { n: 2 })], [{ id: 's0', kind: 'disc', c: D0.c, r: D0.r, ci: 1, visible: true },
    { id: 's1', kind: 'disc', c: [2, 0], r: 0.8, stage: 1, ci: 0, visible: true }]), 'l');
  const P = await paneOf();
  // (0.12 inside its rim, so the outline is clear)
  const { W, Z } = pairs(P, 90, (z) => Math.hypot(z[0] - D0.c[0], z[1] - D0.c[1]) < D0.r - 0.12, (z) => cpow(z, 1.5));
  await check('beside a region of w1, Inside regions', { scope: 'in', park: 0.5 }, 0, W, Z, 40);
}

// ---- a d/dz between the glide and the colour plane ----
{
  await open(base([step('pown', { n: 2 }), step('deriv'), step('exp')], []), 'd');
  const P = await paneOf();
  // (x = 1/2: z^(3/2), principal; z in |arg z| < pi / 3 - 0.06, the points with no other point on them, and away from 0)
  // (the colour exp(2z) steps at its band edges, |exp(2z)| a power of 1.69, and its 12 sectors' edges: points within
  // 0.02 of one are left out, where a place a pixel off shows the next band)
  const clear = (z) => { const bx = 2 * z[0] / Math.log(1.69), by = z[1] / (Math.PI / 12); return Math.abs(bx - Math.round(bx)) * Math.log(1.69) / 2 > 0.02 && Math.abs(by - Math.round(by)) * Math.PI / 12 > 0.02; };
  const right = (z) => clear(z) && Math.abs(Math.atan2(z[1], z[0])) < Math.PI / 3 - 0.06 && Math.hypot(z[0], z[1]) > 0.2;
  const before = pairs(P, 60, right, (z) => cpow(z, 1.5));
  await check('d/dz past the colour plane\'s chain, before it', { scope: 'all', park: 0.5 }, 3, before.W, before.Z, 200);
  // (x = 5/2: w = 2(e^z - 1) + 1/2; the front point at w is the one with |Im z| < pi, kept to |Im z| < 2.5, and
  // Re z > -1.2, where e^z does not squeeze the plane into a few pixels)
  const past = pairs(P, 60, (z) => clear(z) && Math.abs(z[1]) < 2.5 && z[0] > -1.2, (z) => { const e = Math.exp(z[0]); return [2 * (e * Math.cos(z[1]) - 1) + 0.5, 2 * e * Math.sin(z[1])]; });
  await check('d/dz past the colour plane\'s chain, past it', { scope: 'all', park: 2.5 }, 3, past.W, past.Z, 300);
}
return { pass: fails.length === 0, fails, info };

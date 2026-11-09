// The steps view's glides of the maps that are one-to-one onto the outside of a disk and tangent to the identity at infinity
// (the Douady–Hubbard map, the Böttcher coordinate), under Everywhere, sheets off (the front member alone is drawn, as a
// parked plane is). For each, at u = END, 0.5 and 1 - END:
// - path: the glide's record says 'inverse' (the carried mesh draws a step whose Newton walks have no seed);
// - ends: the frame at END is plane 0's parked frame and the one at 1 - END is plane 1's, pixel by pixel away from the colour
//   lines (held_frames.js's sameAway: at least MIN_SAME pixels, at most SAME_FRAC of them more than LOOK_TOL apart);
// - band: at 1 - END, the pixels w with 1 < |w| < BAND_OUT, where the image meets the disk the map leaves out and the
//   identity is the worst seed of the point over w, are plane 1's too (at least MIN_BAND pixels, at most SAME_FRAC over);
// - middle: at u = 0.5 the frame is the CPU reference's (held_frames.js's refOf, __giRef: at each sampled pixel w, the
//   front z with H_u(z) = w by Newton's method from a grid of seeds over the window, coloured as plane 0's parked frame
//   colours z), at most SAME_FRAC of the compared pixels more than LOOK_TOL off.
// - members: the plan's own members (Inverse.homOps' NEWT op's pre) over sample points w, outside the band and in it, are
//   exactly one (degree 1); the control, a quadratic, has two.
// Controls: the ray's stages off (Inverse.NEWT_RAY.SUB = 0) leave the band off plane 1's; the step without the property takes the carried mesh, and then its band at 1 - END is off plane 1's by more than
// SAME_FRAC (the whole frame's difference, 0.3 %, is below it: the band is the measure that tells them apart); a step whose map is not tangent to the identity (the Gamma function) with the property forced on keeps the mesh
// too (the seed is verified, not trusted).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { grab, sameAway, refOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005, LOOK_TOL = 3, MIN_SAME = 20000, MIN_BAND = 100, REF_STEP = 8;   // (steps_newt_everywhere_cmd.js's bounds)
const END = 1e-4;          // the glide's ends: u = END and 1 - END
const BAND_OUT = 1.1;      // the band's outer radius, in plane w
const READY_MS = 60000, FRAME_MS = 300000, WARM_MS = 120000, SETTLE_MS = 1500;   // waits (ms): a page, a frame, the prestart, a frame's last draws
const MEMBER_US = [0.5, 1 - END];   // the homotopy's t for the member counts
// sample points w for the member counts: outside the band, and in it ([re, im])
const W_OUT = [[3, 0], [0, -2], [-1.5, 1.5], [1.2, 0.8]], W_BAND = [[1.05, 0], [-1.05, 0], [0, -1.05], [-0.74, 0.74], [0.5, 0.93]];
// a point whose ray needs more halvings than Inverse.NEWT_RAY.HALVINGS: |w| - 1 below exp(log R 2^-HALVINGS) - 1 (about 8.5e-4 for R = 32, 12 halvings)
const W_TOO_NEAR = [[1.0004 * Math.cos(0.4), 1.0004 * Math.sin(0.4)]];
const RAY_SUB = 4;   // the stages per halving the page is built with (Inverse.NEWT_RAY.SUB)
const SRC = { cx: 0, cy: 0, s: 60 };
const ready = () => settled({ max: READY_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
// the frame at thread place x, once a frame there was drawn, and its record
const at = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max: FRAME_MS, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
  await ev(`new Promise((r) => setTimeout(r, ${SETTLE_MS})), 1`);
  return ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
};
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: READY_MS, until: `__cmwSteps().x === ${k}` });
  await ev(`new Promise((r) => setTimeout(r, ${SETTLE_MS})), 1`);
};
// the device pixels whose plane-w point has 1 < |w| < BAND_OUT (the glide's record has the view)
const IN_BAND = `(x, y) => { const g = __cmwSteps().glide, v = g.view, d = document.getElementById('canvasL').width / g.w, r = Math.hypot(v.cx + (x / d - g.w / 2) / v.s, v.cy - (y / d - g.h / 2) / v.s); return r > 1 && r < ${BAND_OUT}; }`;
// a one-step scene of type id with params, Everywhere, sheets off, planes 0 and 1 parked and kept (P0, P1)
const scene = async (id, params, tag) => {
  const ns = 'ge' + tag + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: id, params, on: true }], nextId: 50, focus: 0, srcView: SRC };
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps`);
  await ready();
  await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
  await park(0); await grab('P0');
  await park(1); await grab('P1');
};
// the step's definition built with the identity seed set to on
const forceProp = (id, on) => ev(`(() => { const d = Funcs.DEFS.${id}, b = d.build; d.build = function () { const r = b.apply(this, arguments); r.identitySeed = ${on}; return r; }; __cmwStepParam(0, 'N', 63); return 1; })()`);

// the number of members of the Newton plan of the step { type, params } at t over each w ([re, im]), in the page
const members = (step, t, ws) => ev(`(() => { const b = Funcs.build(${JSON.stringify(step)}), r = Inverse.homOps(b, ${t}); if (!r.ok) return { ok: false, reason: r.reason }; const op = r.ops[r.ops.length - 1]; return { ok: true, kind: op.kind, n: ${JSON.stringify(ws)}.map(([re, im]) => op.pre({ re, im }).length) }; })()`);
const STEPS = [['dh', 'Douady–Hubbard', { N: 64 }], ['bottcher', 'Böttcher', { c: '-1', N: 64 }]];
await view(1440, 900, false, false);
for (const [id, name, params] of STEPS) {
  await scene(id, params, id);
  for (const [u, ref] of [[END, 'P0'], [1 - END, 'P1']]) {
    const g = await at(u);
    await grab('G' + u);
    const r = await sameAway('G' + u, ref, LOOK_TOL, null);
    info[`${id} u ${u}`] = { g, r };
    ok(`${name} at u = ${u}: drawn by the inverse pass`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${name} at u = ${u}: the parked plane's frame (at least ${MIN_SAME} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, !!r && r.n >= MIN_SAME && r.over <= SAME_FRAC, r);
    if (u > 0.5) {
      const band = await sameAway('G' + u, ref, LOOK_TOL, IN_BAND);
      info[`${id} band`] = band;
      ok(`${name} at u = ${u}: the band 1 < |w| < ${BAND_OUT} is the parked plane's (at least ${MIN_BAND} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, !!band && band.n >= MIN_BAND && band.over <= SAME_FRAC, band);
    }
  }
  {
    const near = await members({ type: id, params }, 1 - END, W_TOO_NEAR);
    info[`${id} too near`] = near;
    ok(`${name}: a w nearer the disk than the ray's halvings reach has no member (the member fails in the CPU and the program alike)`, !!near && near.ok && near.n.every((n) => n === 0), near);
  }
  for (const t of MEMBER_US) {
    const out = await members({ type: id, params }, t, W_OUT), band = await members({ type: id, params }, t, W_BAND);
    info[`${id} members ${t}`] = { out, band };
    ok(`${name} at t = ${t}: one member over each w outside the band (degree 1)`, !!out && out.ok && out.n.every((n) => n === 1), out);
    // (the band is in H_t's image fully only near t = 1: at t = 0.5 the straight-line homotopy leaves some of it uncovered, so there
    // a point has at most one member)
    ok(`${name} at t = ${t}: ${t > 0.5 ? 'one member' : 'at most one member'} over each w in the band (degree 1)`, !!band && band.ok && band.n.every((n) => (t > 0.5 ? n === 1 : n <= 1)), band);
  }
  {
    const g = await at(0.5);
    await grab('G0.5');
    const r = await refOf('P0', 'G0.5', LOOK_TOL, REF_STEP);
    info[`${id} u 0.5`] = { g, r };
    ok(`${name} at u = 0.5: drawn by the inverse pass`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${name} at u = 0.5: the CPU reference's colours (at least ${MIN_BAND} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, !!r && !!r.ref && r.ref.n >= MIN_BAND && r.ref.over <= SAME_FRAC, r);
  }
  // control: without the property the glide takes the mesh, and its end is off plane 1's
  await forceProp(id, false);
  await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
  {
    const g = await at(1 - END);
    await grab('C');
    const r = await sameAway('C', 'P1', LOOK_TOL, IN_BAND);
    info[`${id} control`] = { g, r };
    ok(`${name} without the property: the carried mesh (control)`, !!g && g.path === 'mesh' && /Newton inverse/.test(g.reason || ''), g);
    ok(`${name} without the property: the band is off plane 1's by more than ${SAME_FRAC * 100} % (control)`, !!r && r.n >= MIN_BAND && r.over > SAME_FRAC, r);
  }
}
// control, paired at N = 63: with the ray's stages (SUB = 4) the band is the parked plane's, with none (SUB = 0: the seed is landed on w
// directly) it is off
for (const [id, name, params] of STEPS) {
  for (const sub of [RAY_SUB, 0]) {
    await scene(id, params, id + 'sub' + sub);
    await ev(`Inverse.NEWT_RAY.SUB = ${sub}, __cmwStepParam(0, 'N', 63)`);
    await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
    await park(1); await grab('P1c');
    const g = await at(1 - END);
    await grab('C0');
    const band = await sameAway('C0', 'P1c', LOOK_TOL, IN_BAND);
    info[`${id} N 63 sub ${sub}`] = { g, band };
    if (sub) ok(`${name} at N = 63 with ${sub} stages per halving: the band is the parked plane's`, !!band && band.n >= MIN_BAND && band.over <= SAME_FRAC, { g, band });
    else ok(`${name} at N = 63 with no ray stages: the band is off plane 1's by more than ${SAME_FRAC * 100} % (control)`, !!band && band.n >= MIN_BAND && band.over > SAME_FRAC, { g, band });
  }
}
// control: a map of degree 2 has two members over those points
{
  const cube = await members({ type: 'custom', params: { expr: 'z^2 + z + 1', cut: 180 } }, 0.5, W_OUT);
  info['cube members'] = cube;
  ok('the control, a quadratic: two members over each w outside the band', !!cube && cube.ok && cube.n.every((n) => n === 2), cube);
}
// control: a map not tangent to the identity at infinity keeps the mesh with the property forced on
await scene('gamma', {}, 'gamma');
await forceProp('gamma', true);
await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
{
  const g = await at(0.5);
  info['gamma forced'] = g;
  ok('the Gamma function with the property forced on: the carried mesh (the seed is verified, control)', !!g && g.path === 'mesh', g);
}
return { pass: fails.length === 0, fails, info };

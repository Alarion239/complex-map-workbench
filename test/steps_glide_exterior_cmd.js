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
// Controls: the step without the property takes the carried mesh, and then its band at 1 - END is off plane 1's by more than
// SAME_FRAC (the whole frame's difference, 0.3 %, is below it: the band is the measure that tells them apart); a step whose map is not tangent to the identity (the Gamma function) with the property forced on keeps the mesh
// too (the seed is verified, not trusted).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { grab, sameAway, refOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005, LOOK_TOL = 3, MIN_SAME = 20000, MIN_BAND = 200, REF_STEP = 8;   // (steps_newt_everywhere_cmd.js's bounds)
const END = 1e-4;          // the glide's ends: u = END and 1 - END
const BAND_OUT = 1.1;      // the band's outer radius, in plane w
const READY_MS = 60000, FRAME_MS = 300000, WARM_MS = 120000, SETTLE_MS = 1500;   // waits (ms): a page, a frame, the prestart, a frame's last draws
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
// the step's definition built with the property set to on
const forceProp = (id, on) => ev(`(() => { const d = Funcs.DEFS.${id}, b = d.build; d.build = function () { const r = b.apply(this, arguments); r.props = Object.assign({}, r.props, { identitySeed: ${on} }); return r; }; __cmwStepParam(0, 'N', 63); return 1; })()`);

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

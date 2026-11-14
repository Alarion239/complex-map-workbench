// A steps-view glide through a Newton-inverted homotopy at the default Everywhere scope. The guard (svInvPaths) lets the
// inverse pass draw it when the step's NEWT op has seeds or finds every root (a polynomial of exact degree 2 to
// NEWT_POLY_MAX, Aberth's method); the other gallery examples whose first glide is such a step keep the carried mesh
// (#1321: their inverse frames are blank or miss members). The cases: the partial sums of the exponential (degree 8) takes
// the inverse path; the zeros of the zeta function, the poles of the Gamma function, a natural boundary, zeta as a Dirichlet
// series, the Mandelbrot set, the Douady-Hubbard map and the Böttcher coordinates of a Julia set stay on the mesh.
// The partial sums, sheets off (the front member alone is drawn, as a parked plane is), at u = endFor's first end, 0.5 and
// its last end:
// - path: the glide's record says 'inverse';
// - ends: the first is plane 0's parked frame and the last plane 1's, pixel by pixel away from the colour lines
//   (held_frames.js's sameAway: at least MIN_SAME pixels, at most SAME_FRAC of them more than LOOK_TOL apart, as
//   steps_glide_look_cmd.js:54-55). The step's path moves a point by u |p(z) - z|: the ends are endFor's, the u at which
//   the window's largest displacement is a tenth of a pixel;
// - members: at u = 0.5 the frame is the exact picture, held_frames.js's refOf (plane 0's parked frame pulled through
//   H_u's inverse by Newton's method from a seed grid, away from the colour lines), at least MIN_COMPARED pixels, at most
//   SAME_FRAC of them more than LOOK_TOL apart: a frame that misses a member of H_u over a pixel disagrees with it there;
// - control: with All sheets the members behind the front one show through at the layers' opacity, so the first end is
//   not plane 0's frame (a frame that never drew them would pass the ends above).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = exampleNames();
const { grab, sameAway, refOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005, LOOK_TOL = 3, MIN_SAME = 20000, MIN_COMPARED = 1000;   // (steps_glide_look_cmd.js:54-55)
// waits (ms) for a page to be ready, for the glide's frame at the slowest, and for the prestart's warm draw; the reference's sampling step (px); the displacement grid's points per side
const READY_MS = 60000, FRAME_MS = 600000, WARM_MS = 120000, REF_STEP = 10, DISP_GRID = 41, OPACITY = 0.85, OPACITY_LOW = 0.3;   // (the Opacity slider's default and a low value)
const CASES = [
  { ex: 'Zeros of the zeta function' },
  { ex: 'Poles of the Gamma function' },
  { ex: 'Partial sums of the exponential', poly: true },
  { ex: 'A natural boundary' },
  { ex: 'Zeta as a Dirichlet series' },
  { ex: 'The Mandelbrot set' },
  { ex: 'The Douady–Hubbard map' },
  { ex: 'Böttcher coordinates of a Julia set' },
];
const ready = () => settled({ max: READY_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
// the frame at thread place x, once a frame there was drawn, and its record
const at = async (x, max = FRAME_MS) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
  return ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
};
// The end u of a polynomial step under Everywhere. H_u(z) - z = u (f(z) - z), so a point moves u |f(z) - z| along the glide, and
// the window holds points where that is large (a polynomial of high degree): the frame at u is plane 0's within a tenth of a CSS
// pixel only where u max |f(z) - z| <= DISP_PX, u over the window (the left pane's view, DISP_GRID x DISP_GRID points), from the glide's
// H at the frame held now (at u0). The end is that u, at most END_MAX; at least END_MIN, END_MIN_RESTS times the page's SV_REST_U (read from the
// page: at or below it a thread is the plane at rest, with no glide frame, so END_MIN is the product's own first moving u): then the end is
// END_MIN and the check reports the displacement it leaves. END_LOOSE is the control: a first moving u that far from 1 leaves more than DISP_PX. Answers
// { end, disp: the largest displacement in CSS px at END_MIN's u }
const END_MAX = 1e-4, END_MIN_RESTS = 2, END_LOOSE = 2e-6, DISP_PX = 0.1, FORMER_REST_U = 5e-7;   // (FORMER_REST_U: a rest band the page does not have; its first moving u, END_MIN_RESTS x it, is the control that END_MIN must come from the page's band)
let END_MIN = 0;   // (END_MIN_RESTS x the page's SV_REST_U, set by endFor)
const endFor = async (u0) => {
  const rest = await ev('({ u: __cmwSteps().restU, min: __cmwSteps().restUMin })');
  END_MIN = END_MIN_RESTS * rest.u;
  return endForAt(u0, rest);
};
const endForAt = (u0, rest) => ev(`(() => {
  const g = __cmwSteps().glide, H = g.H, v = g.view, n = ${DISP_GRID}, hw = g.w / 2 / v.s, hh = g.h / 2 / v.s;
  let D = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const z = { re: v.cx - hw + 2 * hw * i / (n - 1), im: v.cy - hh + 2 * hh * j / (n - 1) }, w = H(z);
    if (w && Number.isFinite(w.re) && Number.isFinite(w.im)) D = Math.max(D, Math.hypot(w.re - z.re, w.im - z.im));
  }
  const perU = D / ${u0} * v.s;   // CSS px of displacement per unit u
  const want = perU > 0 ? ${DISP_PX} / perU : ${END_MAX};
  const end = Math.min(${END_MAX}, Math.max(${END_MIN}, want));
  return { end, disp: +(perU * ${END_MIN}).toFixed(3), perU, loose: +(perU * ${END_LOOSE}).toFixed(3), restU: ${rest.u}, restUMin: ${rest.min} };
})()`);
// the thread parked on plane k, once the plane's frame is drawn with its own programs (__cmwSteps().ready: a parked plane
// past the colour plane asks for its inverse program at its first frame, and where links run in the background that
// frame is the stand-in until it lands and the plane is drawn again)
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: READY_MS, until: `__cmwSteps().x === ${k} && __cmwSteps().ready.ready` });
};

await view(1440, 900, false, false);
for (const c of CASES) {
  const ex = names.indexOf(c.ex);
  ok(`${c.ex}: the example is found`, ex >= 0, names.length);
  if (ex < 0) continue;
  await go(`${BASE}/test.html?ns=ne${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev("__cmwSet('sheets', false), __cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
  await park(0); const s0 = await grab('P0');
  await park(1); const s1 = await grab('P1');
  ok(`${c.ex}: the parked frames are still`, s0 && s1, { s0, s1 });
  const rec = {};
  if (!c.poly) {
    // (a step whose members the guard cannot certify, #1321: neither seeds nor every root (Aberth); the carried mesh draws it)
    const g = await at(0.5);
    rec['u 0.5'] = { g };
    ok(`${c.ex} at u = 0.5: still the carried mesh (its inverse frame misses members, #1321)`, !!g && g.path === 'mesh' && g.b === 1, g);
    info[c.ex] = rec;
    continue;
  }
  await at(0.5);
  const poly = await endFor(0.5);
  rec.poly = poly;
  ok(`${c.ex}: the front member at u = ${poly.end} moves a point less than ${DISP_PX} CSS px (END_MIN = ${END_MIN} leaves ${poly.disp})`, poly.end > END_MIN || poly.disp <= DISP_PX, poly);
  ok(`${c.ex}: the page's SV_REST_U (${poly.restU}) stays above its float32 floor (${poly.restUMin}), where 1 - t is exact`, poly.restU > poly.restUMin, poly);
  ok(`${c.ex}: the control: a first moving u of ${END_LOOSE} leaves ${poly.loose} CSS px, over ${DISP_PX}`, poly.loose > DISP_PX, poly);
  const former = +(poly.perU * END_MIN_RESTS * FORMER_REST_U).toFixed(3);
  ok(`${c.ex}: the control: the former rest band ${FORMER_REST_U} (first moving u ${END_MIN_RESTS * FORMER_REST_U}) leaves ${former} CSS px, over ${DISP_PX}, and the page's band ${poly.restU} is below it`, former > DISP_PX && poly.restU < FORMER_REST_U, { former, restU: poly.restU });
  for (const [u, ref] of [[poly.end, 'P0'], [1 - poly.end, 'P1']]) {
    const g = await at(u);
    const still = await grab('G' + u);
    const r = await sameAway('G' + u, ref, LOOK_TOL, null);
    rec[`u ${u}`] = { g, still, r };
    ok(`${c.ex} at u = ${u}: drawn by the inverse pass (Everywhere)`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${c.ex} at u = ${u}, sheets off: the parked plane's frame (away from the colour lines: at least ${MIN_SAME} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, still && !!r && r.n >= MIN_SAME && r.over <= SAME_FRAC, { r, still });
  }
  {
    const g = await at(0.5);
    const still = await grab('G0.5');
    const r = await refOf('P0', 'G0.5', LOOK_TOL, REF_STEP);
    rec['u 0.5'] = { g, still, r };
    ok(`${c.ex} at u = 0.5: drawn by the inverse pass (Everywhere)`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${c.ex} at u = 0.5, sheets off: the exact picture's front member (at least ${MIN_COMPARED} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, still && !!r && !!r.ref && r.ref.n >= MIN_COMPARED && r.ref.over <= SAME_FRAC, { r, still });
  }
  // the colour plane before the glide (plane 0), sheets off: plane 1 is past the colour plane and honours the Opacity slider, so
  // the glide's opacity goes from 1 (plane 0's look) at its first end to the slider's at its last, and both ends are their
  // parked planes; the control: at a slider of OPACITY_LOW the last end is the parked plane at that opacity, which differs from
  // the one at OPACITY (the check would pass a frame that ignores the slider only if the two parked planes agreed)
  await ev(`__cmwSet('alpha', ${OPACITY}), __cmwSteps({ T: 0 }), 1`);
  await settled({ max: WARM_MS, until: '__cmwSteps().ready.ready' });
  await park(0); const q0 = await grab('Q0');
  await park(1); const q1 = await grab('Q1');
  ok(`${c.ex}, colour plane 0: the parked frames are still`, q0 && q1, { q0, q1 });
  // (the parked plane 1 past the colour plane is drawn by the inverse pass, as the glide's last frames are: not by the carried meshes)
  const rest = await ev('JSON.parse(JSON.stringify(__cmwSteps().rest))');
  ok(`${c.ex}, colour plane 0: the parked plane 1 is drawn by the inverse pass`, !!rest && rest.a === 1 && rest.path === 'inverse', rest);
  for (const [u, ref] of [[poly.end, 'Q0'], [1 - poly.end, 'Q1']]) {
    const g = await at(u);
    const still = await grab('Z' + u);
    const r = await sameAway('Z' + u, ref, LOOK_TOL, null);
    rec[`T0 u ${u}`] = { g, still, r };
    ok(`${c.ex}, colour plane 0, opacity ${OPACITY} at u = ${u}: the parked plane's frame (at least ${MIN_SAME} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, still && !!r && r.n >= MIN_SAME && r.over <= SAME_FRAC, { r, still });
  }
  await ev(`__cmwSet('alpha', ${OPACITY_LOW}), 1`);
  await park(1); await grab('R1');
  await at(0.5);   // (a frame at the same u is not redrawn when only the opacity changed)
  {
    const g = await at(1 - poly.end);
    const still = await grab('ZL');
    const r = await sameAway('ZL', 'R1', LOOK_TOL, null), d = await sameAway('R1', 'Q1', LOOK_TOL, null), e = await sameAway('ZL', 'Q1', LOOK_TOL, null);
    rec['T0 low'] = { g, still, r, d, e };
    ok(`${c.ex}, colour plane 0, opacity ${OPACITY_LOW} at the last end: the parked plane at that opacity`, still && !!r && r.n >= MIN_SAME && r.over <= SAME_FRAC, { r, still, glideVsOpacityParked: e });
    ok(`${c.ex}, colour plane 0: the parked plane 1 at ${OPACITY_LOW} differs from that at ${OPACITY} (the control)`, !!d && d.over > SAME_FRAC, d);
  }
  await ev(`__cmwSet('alpha', ${OPACITY}), __cmwSteps({ T: 1 }), 1`);
  // the control: with All sheets the members behind the front one show through, so the frame at the first end is not plane 0's
  // (the check above would pass a frame that never draws them)
  await ev("__cmwSet('sheets', true), 1");
  {
    const g = await at(poly.end);
    const still = await grab('GS');
    const r = await sameAway('GS', 'P0', LOOK_TOL, null);
    rec['all sheets'] = { g, still, r };
    ok(`${c.ex} at u = ${poly.end}, All sheets: differs from the parked plane (control: over ${SAME_FRAC * 100} %)`, still && !!r && r.over > SAME_FRAC, { r, still });
  }
  info[c.ex] = rec;
}
return { pass: fails.length === 0, fails, info };

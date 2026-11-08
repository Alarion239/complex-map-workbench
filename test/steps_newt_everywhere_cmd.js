// A steps-view glide through a step with no exact inverse (a Newton-inverted homotopy with no seeds of its own), at the
// default Everywhere scope, is drawn by the inverse pass: its Newton ladder sits on the source window's image. The gallery
// examples whose first glide (plane 0 to plane 1) is such a step: the zeros of the zeta function, the poles of the Gamma
// function, the partial sums of the exponential, a natural boundary, zeta as a Dirichlet series, the Mandelbrot set, the
// Douady-Hubbard map and the Böttcher coordinates of a Julia set. Each is held at u = END_U[0], 0.5 and END_U[1]:
// - path: the glide's record says 'inverse' (its reason is reported otherwise);
// - ends: u = END_U[0] is plane 0's parked frame and u = END_U[1] plane 1's, pixel by pixel away from the colour lines
//   (held_frames.js's sameAway: at least MIN_SAME pixels, at most SAME_FRAC of them more than LOOK_TOL apart, as
//   steps_glide_look_cmd.js:54-55). The polynomial steps run their path faster than the glide's u, so their ends are
//   endFor's: the u at which the window's largest displacement is half a pixel;
// - members: at u = 0.5 the frame is the exact picture, held_frames.js's refOf (plane 0's parked frame pulled through
//   H_u's inverse by Newton's method from a seed grid, away from the colour lines), at least MIN_COMPARED pixels, at most
//   SAME_FRAC of them more than LOOK_TOL apart: a frame that misses a member of H_u over a pixel disagrees with it there.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'").replace(/\\u2019/g, '’'));
const { grab, sameAway, refOf } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005, LOOK_TOL = 3, MIN_SAME = 20000, MIN_COMPARED = 1000, END_U = [0.002, 0.998];   // (steps_glide_look_cmd.js:54-55)
const CASES = [
  { ex: 'Zeros of the zeta function' },
  { ex: 'Poles of the Gamma function' },
  { ex: 'Partial sums of the exponential', poly: true },
  { ex: 'A natural boundary' },
  { ex: 'Zeta as a Dirichlet series' },
  { ex: 'The Mandelbrot set', poly: true },
  { ex: 'The Douady–Hubbard map', poly: true },
  { ex: 'Böttcher coordinates of a Julia set', poly: true },
];
const ready = () => settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
// the frame at thread place x, once a frame there was drawn, and its record
const at = async (x, max = 600000) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
  return ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
};
// The end u of a polynomial step under Everywhere. H_u(z) - z = u (f(z) - z), so a point moves u |f(z) - z| along the glide, and
// the window holds points where that is large (a polynomial of high degree): the frame at u is plane 0's within half a CSS
// pixel only where u max |f(z) - z| <= HALF_PX, u over the window (the left pane's view, 41 x 41 points), from the glide's
// H at the frame held now (at u0). The end is that u, at most END_MAX; at least END_MIN, below which 1 - end is not a
// float32 the page's t can take: then the end is END_MIN and the check reports the displacement it leaves. Answers
// { end, disp: the largest displacement in CSS px at END_MIN's u }
const END_MAX = 1e-4, END_MIN = 1e-6, HALF_PX = 0.5;
const endFor = (u0) => ev(`(() => {
  const g = __cmwSteps().glide, H = g.H, v = g.view, n = 41, hw = g.w / 2 / v.s, hh = g.h / 2 / v.s;
  let D = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const z = { re: v.cx - hw + 2 * hw * i / (n - 1), im: v.cy - hh + 2 * hh * j / (n - 1) }, w = H(z);
    if (w && Number.isFinite(w.re) && Number.isFinite(w.im)) D = Math.max(D, Math.hypot(w.re - z.re, w.im - z.im));
  }
  const perU = D / ${u0} * v.s;   // CSS px of displacement per unit u
  const want = perU > 0 ? ${HALF_PX} / perU : ${END_MAX};
  const end = Math.min(${END_MAX}, Math.max(${END_MIN}, want));
  return { end, disp: +(perU * ${END_MIN}).toFixed(3), perU };
})()`);
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: 60000, until: `__cmwSteps().x === ${k}` });
};

await view(1440, 900, false, false);
for (const c of CASES) {
  const ex = names.indexOf(c.ex);
  ok(`${c.ex}: the example is found`, ex >= 0, names.length);
  if (ex < 0) continue;
  await go(`${BASE}/test.html?ns=ne${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev("__cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
  await park(0); const s0 = await grab('P0');
  await park(1); const s1 = await grab('P1');
  ok(`${c.ex}: the parked frames are still`, s0 && s1, { s0, s1 });
  const rec = {};
  let poly = null;
  if (c.poly) {
    await at(0.5);
    poly = await endFor(0.5);
    rec.poly = poly;
    ok(`${c.ex}: the frame at u = ${poly.end} moves a point less than ${HALF_PX} CSS px (END_MIN = ${END_MIN} leaves ${poly.disp})`, poly.end > END_MIN || poly.disp <= HALF_PX, poly);
  }
  for (const [u, ref] of [[poly ? poly.end : END_U[0], 'P0'], [poly ? 1 - poly.end : END_U[1], 'P1']]) {
    const g = await at(u);
    const still = await grab('G' + u);
    const r = await sameAway('G' + u, ref, LOOK_TOL, null);
    rec[`u ${u}`] = { g, still, r };
    ok(`${c.ex} at u = ${u}: drawn by the inverse pass (Everywhere)`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${c.ex} at u = ${u}: the parked plane's frame (away from the colour lines: at least ${MIN_SAME} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, still && !!r && r.n >= MIN_SAME && r.over <= SAME_FRAC, { r, still });
  }
  {
    const g = await at(0.5);
    const still = await grab('G0.5');
    const r = await refOf('P0', 'G0.5', LOOK_TOL, 10);
    rec['u 0.5'] = { g, still, r };
    ok(`${c.ex} at u = 0.5: drawn by the inverse pass (Everywhere)`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${c.ex} at u = 0.5: the exact picture's members (at least ${MIN_COMPARED} pixels, at most ${SAME_FRAC * 100} % over ${LOOK_TOL})`, still && !!r && !!r.ref && r.ref.n >= MIN_COMPARED && r.ref.over <= SAME_FRAC, { r, still });
  }
  info[c.ex] = rec;
}
return { pass: fails.length === 0, fails, info };

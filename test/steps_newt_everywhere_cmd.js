// A steps-view glide through a step with no exact inverse (a Newton-inverted homotopy with no seeds of its own), at the
// default Everywhere scope, is drawn by the inverse pass: its Newton ladder sits on the source window's image. The gallery
// examples whose first glide (plane 0 to plane 1) is such a step: the zeros of the zeta function, the poles of the Gamma
// function, the partial sums of the exponential, a natural boundary, zeta as a Dirichlet series, the Mandelbrot set, the
// Douady-Hubbard map and the Böttcher coordinates of a Julia set. Each is held at u = END_U[0], 0.5 and END_U[1]:
// - path: the glide's record says 'inverse' (its reason is reported otherwise);
// - ends: u = END_U[0] is plane 0's parked frame and u = END_U[1] plane 1's, pixel by pixel away from the colour lines
//   (held_frames.js's sameAway: at least MIN_SAME pixels, at most SAME_FRAC of them more than LOOK_TOL apart, as
//   steps_glide_look_cmd.js:54-55). The polynomial steps run their path faster than the glide's u, so their ends are
//   POLY_END (as steps_glide_look_cmd's `end`);
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
const SAME_FRAC = 0.005, LOOK_TOL = 3, MIN_SAME = 20000, MIN_COMPARED = 1000, POLY_END = 1e-4, END_U = [0.002, 0.998];   // (steps_glide_look_cmd.js:54-55)
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
  for (const [u, ref] of [[c.poly ? POLY_END : END_U[0], 'P0'], [c.poly ? 1 - POLY_END : END_U[1], 'P1']]) {
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

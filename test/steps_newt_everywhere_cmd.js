// A steps-view glide through a step with no exact inverse (a Newton-inverted homotopy with no seeds of its own), at the
// default Everywhere scope, is drawn by the inverse pass: its Newton ladder sits on the source window's image. The gallery
// examples whose first glide (plane 0 to plane 1) is such a step: the zeros of the zeta function, the poles of the Gamma
// function, the partial sums of the exponential, a natural boundary, zeta as a Dirichlet series, the Mandelbrot set, the
// Douady-Hubbard map and the Böttcher coordinates of a Julia set. Each is held at u = END_U[0], 0.5 and END_U[1]:
// - path: the glide's record says 'inverse' (its reason is reported otherwise);
// - ends: u = END_U[0] is plane 0's parked frame and u = END_U[1] plane 1's, at most SAME_FRAC of the pixels more than
//   DIFF_TOL apart (steps_glide_look_cmd.js:54, test/lib/held_frames.js:90). The polynomial steps run their path faster
//   than the glide's u, so their ends are POLY_END (as steps_glide_look_cmd's `end`);
// - members: at u = 0.5 the frame is the exact picture, test/lib/held_frames.js's __giRef (plane 0's parked frame pulled
//   through H_u's inverse by Newton's method from a seed grid), at most SAME_FRAC of the sampled pixels more than DIFF_TOL
//   apart: a frame that misses a member of H_u over a pixel disagrees with it there. The reference must sample at least
//   MIN_REF pixels, and finds a member at each.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'").replace(/\\u2019/g, '’'));
const { GI_REF, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005, MIN_REF = 500, POLY_END = 1e-4, END_U = [0.002, 0.998], REF_TOL = DIFF_TOL, REF_STEP = 10;
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
// (the page's helpers: the left pane's pixels, and the share of two frames' pixels more than DIFF_TOL apart in a channel)
const HELP = `window.__ne = window.__ne || {};
window.__neGrab = () => { const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return { W: c.width, H: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; };
window.__neOver = (A, B) => { let n = 0, over = 0; for (let i = 0; i < A.d.length; i += 4) { n++; if (Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2])) > ${DIFF_TOL}) over++; } return over / n; };
${GI_REF}
1`;
// the frame at thread place x, once a frame there was drawn, and its record
const at = async (x, max = 600000) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max, until: `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
  await ev('await new Promise((r) => setTimeout(r, 1500)), 1');
  return ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
};
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: 60000, until: `__cmwSteps().x === ${k}` });
  await ev('await new Promise((r) => setTimeout(r, 2500)), 1');
};

await view(1440, 900, false, false);
for (const c of CASES) {
  const ex = names.indexOf(c.ex);
  ok(`${c.ex}: the example is found`, ex >= 0, names.length);
  if (ex < 0) continue;
  await go(`${BASE}/test.html?ns=ne${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(HELP);
  await ev(`__cmwExample(${ex}), 1`);
  await ev("__cmwSteps({ bare: true, scope: 'all' }), 1");
  await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
  await park(0); await ev('window.__ne.p0 = __neGrab(), 1');
  await park(1); await ev('window.__ne.p1 = __neGrab(), 1');
  const rec = {};
  for (const [u, ref] of [[c.poly ? POLY_END : END_U[0], 'p0'], [c.poly ? 1 - POLY_END : END_U[1], 'p1']]) {
    const g = await at(u);
    const over = await ev(`__neOver(__neGrab(), window.__ne.${ref})`);
    rec[`u ${u}`] = { g, over };
    ok(`${c.ex} at u = ${u}: drawn by the inverse pass (Everywhere)`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${c.ex} at u = ${u}: the parked plane's frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, over <= SAME_FRAC, { over, g });
  }
  {
    const g = await at(0.5);
    const r = await ev(`__giRef(window.__ne.p0, __neGrab(), ${REF_TOL}, ${REF_STEP})`);
    rec['u 0.5'] = { g, r };
    ok(`${c.ex} at u = 0.5: drawn by the inverse pass (Everywhere)`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${c.ex} at u = 0.5: the exact picture's members (at least ${MIN_REF} pixels, at most ${SAME_FRAC * 100} % over ${REF_TOL})`, r.n >= MIN_REF && r.over <= SAME_FRAC, r);
  }
  info[c.ex] = rec;
}
return { pass: fails.length === 0, fails, info };

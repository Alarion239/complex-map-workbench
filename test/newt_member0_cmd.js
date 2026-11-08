// Member 0 of a generic NEWT op in the inverse program (#1380): the Newton kit's _roots walks member 0 from w, continued in
// t, which Inverse.opNewt's op.pre(w) (float64) lists first (m = 0). On the whole 40 x 40 grid of points over the window,
// at u = 1e-4, 0.002 and 0.5, the GPU's member 0 must be kept, hit w (residual within NEWT_HIT_F) and be the
// CPU's (within NEWT_DEDUPE (1 + |z|), the product's "same root" rule); both bounds are read from src/glsl.js. The step is the series (a plain NEWT op); the members are the ones the page's NEWT
// roots pass writes (test/glsl_inverse_test.js, `single` with `hom` and `members`).
// u = 0.5 is asserted too: at 140 of the 1600 points the float32 walk of member 0 does not reach the float64 one (a product
// defect, #1396), so that check is red and listed in KNOWN (ci/browser_suites.js). Not asserted: the other members (the
// ladder's and the deflated one; #1396); zeta, whose program the page cannot run (it lacks the chain data; #1397).
// Control: the GPU's member 0 of u = 0.002 is not the CPU's of u = 0.5, and the same comparison reports it.
// Page: dist/glsl-inverse-test.html (test/make_glsl_inverse_test.py).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// a NEWT op's member hits w when its residual |H_t(z) - w| / (1 + |w|) is within NEWT_HIT_F, and two members are the same
// root within NEWT_DEDUPE (1 + |z|): the product's own bounds, read from src/glsl.js
const GLSL = fs.readFileSync(path.join(DIR, '../../src/glsl.js'), 'utf8');
const NEWT_HIT_F = Number(/const NEWT_HIT_F = '([^']+)'/.exec(GLSL)[1]), NEWT_DEDUPE = Number(/NEWT_DEDUPE = '([^']+)'/.exec(GLSL)[1]);
const GRID = 40, U = [1e-4, 0.002], U_FAR = 0.5;
// (the points of u = 0.5 where the float32 walk does not reach the float64 one: an open product defect, #1396, listed in KNOWN
// of ci/browser_suites.js)
const U_ALL = [...U, U_FAR];
const SHAPE = { id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }, WIN = { x0: -4, x1: 4, y0: -4, y1: 4 };
await nav(`http://localhost:${PORT}/glsl-inverse-test.html`);
const grid = async (u) => {
  const r = await evp(`__invTestRun(${JSON.stringify({ single: { steps: [['series', {}]], shape: SHAPE, win: WIN, pts: [], pix: 0.03, alpha: 1, hom: u, members: true, grid: GRID } })})`, 1800000);
  if (!Array.isArray(r)) throw new Error('no members: ' + JSON.stringify(r));
  return r;
};
const member0 = (list) => list.find((z) => z[2] === 0);
const same = (g, c) => !!g && g[3] <= NEWT_HIT_F && Math.hypot(g[0] - c[0], g[1] - c[1]) <= NEWT_DEDUPE * (1 + Math.hypot(c[0], c[1]));
// the points where the CPU has member 0, and how many of them the GPU's member 0 does not match
const mismatch = (gpuPts, cpuPts) => {
  let n = 0, bad = 0;
  gpuPts.forEach((p, k) => { const c = member0(cpuPts[k].cpu); if (!c) return; n++; if (!same(member0(p.gpu), c)) bad++; });
  return { points: n, mismatch: bad };
};
const at = {};
for (const u of [...U, U_FAR]) at[u] = await grid(u);
for (const u of U_ALL) {
  const r = mismatch(at[u], at[u]);
  info[`series u=${u}`] = r;
  ok(`series at u = ${u}: the GPU's member 0 is the CPU's at every point (residual within NEWT_HIT_F, z within NEWT_DEDUPE (1 + |z|))`, r.points > 1000 && r.mismatch === 0, r);
}
{
  const r = mismatch(at[U[1]], at[U_FAR]);
  info.control = r;
  ok(`control: the GPU's member 0 of u = ${U[1]} is not the CPU's of u = ${U_FAR}, and the comparison reports it`, r.mismatch > 0, r);
}
return { pass: fails.length === 0, fails: fails.slice(0, 10), info };

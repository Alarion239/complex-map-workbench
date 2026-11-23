// The order of a polynomial NEWT op's roots in the inverse program against InvOps' op.pre(w) (float64): the NEWT roots
// pass (newtPolyFns' _roots, its _order) keeps them in increasing Re + 0.37 Im, as op.pre numbers its members m. For a
// glide's homotopy of z^5 + z, z^5 - 2z + 1, z^6 + z and z^7 + 3z^2 - 1 at a u inside the glide (a polynomial NEWT op of
// degree D), on the whole GRID x GRID grid of points over the window, the roots the pass writes (test/glsl_inverse_test.js,
// `single` with `hom` and `members`; its slots 0 ... D - 1, the ones the pass fills) are compared with op.pre(w)'s members:
// - at every point the GPU's kept roots come in increasing Re + 0.37 Im (each key at most KEY_TOL (1 + |z|) below the one
//   before it: float32's rounding of two keys that are equal), whichever of Aberth's start points found each;
// - at each point where they are the same roots (each GPU root within NEWT_DEDUPE (1 + |z|) of a CPU member, one to one),
//   they come in the same order: the GPU's k-th kept slot is the CPU's k-th member;
// - such points are most of the grid (at least MIN_SAME of each case's points), so the row cannot pass on a few.
// Controls: one point's GPU roots with its first two swapped are reported as out of order by the same comparison, and as
// out of key order.
// Page: dist/glsl-inverse-test.html (test/make_glsl_inverse_test.py).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const GLSL = fs.readFileSync(path.join(DIR, '../../src/glsl.js'), 'utf8');
const NEWT_DEDUPE = Number(/NEWT_DEDUPE = '([^']+)'/.exec(GLSL)[1]);
// the grid (24 x 24 = 576 points a case) and the share of its points whose roots must be the same on both sides
const GRID = 24, MIN_SAME = 0.9, KEY_TOL = 1e-5;
const SHAPE = { id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }, WIN = { x0: -4, x1: 4, y0: -4, y1: 4 };
// [formula, the glide's u, the op's degree D]
const CASES = [['z^5+z', 0.5, 5], ['z^5-2z+1', 0.25, 5], ['z^6+z', 0.75, 6], ['z^7+3z^2-1', 0.5, 7]];
await nav(`http://localhost:${PORT}/glsl-inverse-test.html`);
const members = async (expr, u) => {
  const r = await evp(`__invTestRun(${JSON.stringify({ single: { steps: [['custom', { expr, cut: 180 }]], shape: SHAPE, win: WIN, pts: [], pix: 0.03, alpha: 1, hom: u, members: true, grid: GRID } })})`, 1800000);
  if (!Array.isArray(r)) throw new Error(`${expr}: no members: ${JSON.stringify(r)}`);
  return r;
};
const near = (g, c) => Math.hypot(g[0] - c[0], g[1] - c[1]) <= NEWT_DEDUPE * (1 + Math.hypot(c[0], c[1]));
// one point: 'same order', 'other order' (the same roots, one to one, in another order) or 'other roots'
const compare = (gpu, cpu) => {
  if (gpu.length !== cpu.length) return 'other roots';
  const taken = new Set();
  for (const g of gpu) {
    const k = cpu.findIndex((c, i) => !taken.has(i) && near(g, c));
    if (k < 0) return 'other roots';
    taken.add(k);
  }
  return gpu.every((g, k) => near(g, cpu[k])) ? 'same order' : 'other order';
};
// a point's kept GPU roots in slot order (the slots below D) and its CPU members in m order
const sides = (p, D) => ({ gpu: p.gpu.filter((g) => g[2] < D).sort((a, b) => a[2] - b[2]), cpu: p.cpu.slice().sort((a, b) => a[2] - b[2]) });
// the GPU's kept roots in increasing Re + 0.37 Im, to float32's rounding
const orderKey = (g) => g[0] + 0.37 * g[1];
const sorted = (gpu) => gpu.every((g, k) => k === 0 || orderKey(g) >= orderKey(gpu[k - 1]) - KEY_TOL * (1 + Math.hypot(g[0], g[1])));
let probe = null;
for (const [expr, u, D] of CASES) {
  const pts = await members(expr, u), r = { points: pts.length, 'same order': 0, 'other order': 0, 'other roots': 0, unsorted: 0, firstOther: null, firstUnsorted: null };
  for (const p of pts) {
    const s = sides(p, D), v = compare(s.gpu, s.cpu);
    r[v]++;
    if (!sorted(s.gpu)) { r.unsorted++; if (!r.firstUnsorted) r.firstUnsorted = { w: p.w, keys: s.gpu.map((g) => +orderKey(g).toFixed(5)) }; }
    if (v === 'other order' && !r.firstOther) r.firstOther = { w: p.w, gpu: s.gpu.map((g) => g.slice(0, 2)), cpu: s.cpu.map((c) => c.slice(0, 2)) };
    if (!probe && v === 'same order' && s.gpu.length >= 2) probe = s;
  }
  info[`${expr} at u = ${u}`] = r;
  const same = r['same order'] + r['other order'];
  ok(`${expr} at u = ${u}: at every point the GPU's kept roots come in increasing Re + 0.37 Im`, r.points === GRID * GRID && r.unsorted === 0, r);
  ok(`${expr} at u = ${u}: where the GPU's roots are the CPU's, they come in the CPU's order (Re + 0.37 Im)`, r['other order'] === 0, r);
  ok(`${expr} at u = ${u}: the GPU's roots are the CPU's at ${MIN_SAME * 100} % of the points or more`, same >= MIN_SAME * r.points, r);
}
// control: the same roots with two swapped are out of order
const swapped = probe && [probe.gpu[1], probe.gpu[0], ...probe.gpu.slice(2)];
ok('control: a point\'s GPU roots with the first two swapped are reported as in another order, and as out of key order', !!probe && compare(swapped, probe.cpu) === 'other order' && !sorted(swapped), probe);
return { pass: fails.length === 0, fails, info };

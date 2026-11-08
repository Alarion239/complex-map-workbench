// Member 0 of a generic NEWT op in the inverse program (#1380): the Newton kit's _roots walks member 0 from w, continued in
// t, along with the ladder's members. At the probe points below the ladder's seeds do not reach one of the CPU's members
// (Inverse.opNewt's op.pre(w), float64) but member 0's walk does, so the GPU's kept members must hold each CPU member within
// NEWT_HIT_F (1 + |z|). The step is the series (a plain NEWT op), at u = 0.002 and 0.5, on the 40 x 40 grid over the window
// (the page's roots pass: test/glsl_inverse_test.js, `single` with `hom` and `members`); the probes are the grid points where
// a member was missing before member 0 was walked and none is now. Control: the CPU's members of u = 0.5 are not the GPU's
// of u = 0.002 at the same points, and the same comparison reports it.
// Page: dist/glsl-inverse-test.html (test/make_glsl_inverse_test.py).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// a NEWT op's member hits w within NEWT_HIT_F (1 + |w|); a member's z is the same within it (1 + |z|)
const NEWT_HIT_F = 1e-3;
const GRID = 40;
const SHAPE = { id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }, WIN = { x0: -4, x1: 4, y0: -4, y1: 4 };
// the probes, (column, row) of the grid, by u
const PROBES = {
  0.002: [[39, 0], [38, 1], [38, 2], [39, 2], [38, 4], [39, 4], [38, 5], [39, 5], [39, 6], [39, 33], [38, 34], [39, 34], [38, 35], [39, 35], [38, 37], [39, 37], [38, 38], [39, 39]],
  0.5: [[20, 1], [21, 1], [27, 1], [30, 1], [32, 1], [33, 1], [36, 1], [37, 1], [22, 2], [24, 2], [25, 2], [29, 2], [30, 2], [31, 2], [20, 5], [21, 5], [23, 5], [24, 5]],
};
await nav(`http://localhost:${PORT}/glsl-inverse-test.html`);
const grid = async (u) => {
  const r = await evp(`__invTestRun(${JSON.stringify({ single: { steps: [['series', {}]], shape: SHAPE, win: WIN, pts: [], pix: 0.03, alpha: 1, hom: u, members: true, grid: GRID } })})`, 1800000);
  if (!Array.isArray(r)) throw new Error('no members: ' + JSON.stringify(r));
  return r;
};
const near = (z, list) => list.some((q) => Math.hypot(z[0] - q[0], z[1] - q[1]) <= NEWT_HIT_F * (1 + Math.hypot(q[0], q[1])));
// the CPU members of a probe that the GPU's kept members do not hold
const missing = (cpu, gpu) => cpu.filter((z) => !near(z, gpu)).length;
const at = {};
for (const u of Object.keys(PROBES)) {
  at[u] = await grid(Number(u));
  let miss = 0;
  for (const [i, j] of PROBES[u]) { const p = at[u][j * GRID + i]; miss += missing(p.cpu, p.gpu); }
  info[`series u=${u}`] = { probes: PROBES[u].length, missing: miss };
  ok(`series at u = ${u}: the GPU's kept members hold every CPU member at the ${PROBES[u].length} probes`, miss === 0, { miss });
}
// control: the CPU's members of u = 0.5 against the GPU's of u = 0.002, at the probes of u = 0.002
{
  let miss = 0;
  for (const [i, j] of PROBES[0.002]) miss += missing(at[0.5][j * GRID + i].cpu, at[0.002][j * GRID + i].gpu);
  info.control = { missing: miss };
  ok('control: the GPU members of u = 0.002 do not hold the CPU members of u = 0.5, and the comparison reports it', miss > 0, { miss });
}
return { pass: fails.length === 0, fails: fails.slice(0, 10), info };

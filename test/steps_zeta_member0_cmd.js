// Member 0 of the zeta example's NEWT roots pass in the steps view (#1397): the glide of the example's step is drawn by
// the inverse pass, whose NEWT roots pass (GLR.newtRoots, one frame, for every pixel) writes member 0 of its NEWT op, the
// root continued in t from w. At a few pixels, at u = 0.002 of the glide, once the pole tracks exist (no hold), the GPU's
// member 0 is present and is Inverse's op.pre(w) member 0, the same root within NEWT_DEDUPE (1 + |z|), the product's own
// "same root" bound, read from src/glsl.js. Not asserted: u = 0.5, where the float32 walk of member 0 does not reach the
// float64 one at some pixels (a product defect, #1396: the assertion returns with its fix; the count is in info). It reads the pass's own target through __cmwNewtProbe (a test
// hook: the published page has none), so it is the page's frame that is measured, not a separate program.
// Control: the GPU's member 0 at u = 0.002 is not the CPU's at u = 0.5, and the same comparison reports it.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const names = exampleNames();
const GLSL = fs.readFileSync(path.join(DIR, '../../src/glsl.js'), 'utf8');
const NEWT_DEDUPE = Number(/NEWT_DEDUPE = '([^']+)'/.exec(GLSL)[1]);
// (the waits' limits, from a lavapipe run: the pole tracks ready in 2.3 s, a frame with the probe program's compile in 21.5 s;
// the limits are 26 and 14 times those, for a shared runner)
const U_NEAR = 0.002, U_FAR = 0.5, READY_MS = 60000, FRAME_MS = 300000;
// (fractions of the pane from its left and bottom: points inside the critical strip's picture)
const PTS = [[0.45, 0.3], [0.5, 0.5], [0.55, 0.7], [0.48, 0.85], [0.52, 0.15], [0.5, 0.35], [0.47, 0.6]];
const ready = () => settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
const same = (g, c) => !!g && Math.hypot(g[0] - c[0], g[1] - c[1]) <= NEWT_DEDUPE * (1 + Math.hypot(c[0], c[1]));
// the points where the CPU has a member 0, and how many of them the GPU's member 0 is not
const compare = (gpuRows, cpuRows) => {
  let n = 0;
  const bad = [];
  gpuRows.forEach((r, k) => { const c = cpuRows[k] && cpuRows[k].cpu; if (!c) return; n++; if (!same(r.gpu, c)) bad.push({ w: r.w, gpu: r.gpu, cpu: c }); });
  return { points: n, mismatch: bad.length, bad };
};
const ex = names.indexOf('Zeros of the zeta function');
ok('the zeta example is found', ex >= 0, names.length);
await view(1440, 900, false, false);
await go(`${BASE}/test.html?ns=zm${Date.now()}&lang=en&view=steps`);
await ready();
await ev(`__cmwExample(${ex}), 1`);
await ev("__cmwSteps({ bare: true, scope: 'in' }), 1");
const tReady = Date.now();
await settled({ max: READY_MS, until: '__cmwSteps().ready.ready' });
const readyMs = Date.now() - tReady;
await ev('__cmwNewtProbe(), 1');
const rows = {}, took = {};
let t0 = Date.now();
for (const u of [U_NEAR, U_FAR]) {
  await ev(`__cmwSteps({ x: ${u} }), 1`);
  // (the frame at u: drawn by the inverse pass, with its NEWT roots pass's probe taken at this u)
  await settled({ max: FRAME_MS, until: `(() => { const g = __cmwSteps().glide, p = __cmwNewtProbe(${JSON.stringify(PTS)}); return !!g && Math.abs(g.u - ${u}) < 1e-9 && g.path === 'inverse' && !!p && p.length > 0 && Math.abs(p[0].t - ${u}) < 1e-9; })()` });
  rows[u] = await ev(`__cmwNewtProbe(${JSON.stringify(PTS)})`);
  took[u] = Date.now() - t0; t0 = Date.now();
}
info.tookMs = { ready: readyMs, frames: took };
{
  const r = compare(rows[U_NEAR], rows[U_NEAR]);
  info[`u ${U_NEAR}`] = { r, rows: rows[U_NEAR] };
  ok(`zeta at u = ${U_NEAR}: the GPU's member 0 is present and is op.pre(w) member 0 at all ${PTS.length} pixels`, r.points === PTS.length && r.mismatch === 0, r);
}
// (u = 0.5, reported, not asserted: the count that #1396's fix brings to 0, where that assertion returns)
info[`u ${U_FAR} (reported, not asserted)`] = compare(rows[U_FAR], rows[U_FAR]);
{
  const r = compare(rows[U_NEAR], rows[U_FAR]);
  info.control = r;
  ok(`control: the GPU's member 0 at u = ${U_NEAR} is not the CPU's at u = ${U_FAR}, and the comparison reports it`, r.mismatch > 0, r);
}
return { pass: fails.length === 0, fails, info };

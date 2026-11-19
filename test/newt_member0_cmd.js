// The members of a generic NEWT op in the inverse program against Inverse.opNewt's op.pre(w) (float64): the
// Newton kit's _roots on the GPU (float32) walks the same members, InvOps.opNewt's. The step is the series (a plain NEWT op),
// the members the ones the page's NEWT roots pass writes (test/glsl_inverse_test.js, `single` with `hom` and `members`), on
// the whole 40 x 40 grid of points over the window. A member hits w with its residual |H_t(z) - w| / (1 + |w|) within
// NEWT_HIT_F, and two members are one root within NEWT_DEDUPE (1 + |z|): the product's bounds, read from src/glsl.js.
// - u = 1e-4 and 0.002: the GPU's member 0 is the CPU's at every point.
// - u = 0.5, where float32 cannot hold every member, the classes it cannot are named and counted:
//   - cancelled: the GPU's series is NaN where its float32 terms cancel (glsl.js's SER_CANCEL: the sizes of the terms M
//     times its rounding above a share of 1 + |S|; for this series, sum of z^n / n!, M = e^|z| and S = e^z), so a member
//     whose float64 walk (InvOps.opNewt's own iterates, op.pre(w, trace)) meets such a point, at its root or on the way, has
//     no float32 walk;
//   - member 1, Newton deflated by member 0 from 2w - u0: its 24 steps settle or not by the rounding (float32 against float64
//     of one and the same walk keep a different member 1 at 67 of the 1600 points): counted, not asserted.
//   Asserted: a member 0 the GPU keeps is the CPU's at every point; the CPU's member 0 and every member of its ladder are among
//   the GPU's members wherever their walk is clear of the cancelled points; and every GPU member is a float32 rendering of a
//   root (polished in float64 by InvOps.opNewt's own polish, op.polish, it hits w within its 1e-9 and moves by at most
//   NEWT_DEDUPE (1 + |z|)).
// Controls: the cancelled points are some of the grid, not most of it (between MIN_CANCELLED and MAX_CANCELLED of the CPU's
// members 0); the GPU's member 0 of u = 0.002 is not the CPU's of u = 0.5, and the same comparison reports it.
// Not covered: zeta, whose program the page cannot run (it lacks the chain data; #1397).
// Page: dist/glsl-inverse-test.html (test/make_glsl_inverse_test.py).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const GLSL = fs.readFileSync(path.join(DIR, '../../src/glsl.js'), 'utf8');
const NEWT_HIT_F = Number(/const NEWT_HIT_F = '([^']+)'/.exec(GLSL)[1]), NEWT_DEDUPE = Number(/NEWT_DEDUPE = '([^']+)'/.exec(GLSL)[1]);
// (SER_CANCEL: `${M} * ROUND > SHARE * (1.0 + cx_abs(${S}))`; a template of another form stops the suite with a message)
const cancelAt = /const SER_CANCEL = \(M, S\) => `\$\{M\} \* ([0-9.e-]+) > ([0-9.e-]+) \* \(1\.0 \+ cx_abs/.exec(GLSL);
if (!cancelAt) throw new Error('src/glsl.js: SER_CANCEL is not `${M} * ROUND > SHARE * (1.0 + cx_abs(${S}))`, the form this suite reads its rounding and share from');
const [, CANCEL_ROUND, CANCEL_SHARE] = cancelAt.map(Number);
// (the CPU's own hit bound, InvOps.opNewt's hits)
const CPU_HIT = 1e-9;
const GRID = 40, U = [1e-4, 0.002], U_FAR = 0.5, MIN_CANCELLED = 0.01, MAX_CANCELLED = 0.25;
// the controls' floors: a row holds over at least this many members, so that it cannot pass on a few points or none.
// The 40 x 40 grid gives a member 0 at every one of its 1,600 points, members of the ladder at 328 of them (at u = 0.5)
// and 2,188 GPU members there; each floor is well under its count
const MIN_MEMBERS_0 = 1000, MIN_LADDER = 100, MIN_GPU_MEMBERS = 1000;
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
for (const u of U) {
  const r = mismatch(at[u], at[u]);
  info[`series u=${u}`] = r;
  ok(`series at u = ${u}: the GPU's member 0 is the CPU's at every point (residual within NEWT_HIT_F, z within NEWT_DEDUPE (1 + |z|))`, r.points > MIN_MEMBERS_0 && r.mismatch === 0, r);
}
{
  const r = mismatch(at[U[1]], at[U_FAR]);
  info.control = r;
  ok(`control: the GPU's member 0 of u = ${U[1]} is not the CPU's of u = ${U_FAR}, and the comparison reports it`, r.mismatch > 0, r);
}
// u = 0.5: each point's members sorted into the classes above, in the page (the series' homotopy and InvOps.opNewt's walk)
const far = await ev(`(() => {
  const pts = ${JSON.stringify(at[U_FAR])}, U = ${U_FAR}, DED = ${NEWT_DEDUPE}, HIT = ${NEWT_HIT_F}, CPU_HIT = ${CPU_HIT};
  const st = { type: 'series', params: Funcs.defaults('series'), on: true }, b = Funcs.build(st);
  const op = Inverse.homOps(b, U).ops.find((q) => q.kind === 'NEWT');
  const Ht = b.hom(U), fin = (z) => !!z && Number.isFinite(z.re) && Number.isFinite(z.im);
  // the GPU's series is cancelled at z: the sizes of its terms, e^|z|, times the rounding above the share of 1 + |e^z|
  const cancelled = (z) => fin(z) && Math.exp(Math.hypot(z.re, z.im)) * ${CANCEL_ROUND} > ${CANCEL_SHARE} * (1 + Math.exp(z.re));
  // the walks of w's members 0 and 2 + i (the ladder's), every iterate: InvOps.opNewt's own, as op.pre(w, trace) makes them
  const walks = (w) => { const out = {}; op.pre(w, (m, v) => (out[m] || (out[m] = [])).push(v)); return out; };
  const near = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1]) <= DED * (1 + Math.hypot(c[0], c[1]));
  const r = { points: 0, cpuM0: 0, cancelledM0: 0, wrongM0: [], missingM0: [], cpuOthers: 0, cancelledOthers: 0, missingOthers: [], m1Differ: 0, notRoots: [], gpuMembers: 0 };
  pts.forEach((p) => {
    const w = { re: p.w[0], im: p.w[1] }, walk = walks(w);
    r.points++;
    const c0 = p.cpu.find((c) => c[2] === 0), g0 = p.gpu.find((g) => g[2] === 0);
    if (g0 && !(c0 && near(g0, c0))) r.wrongM0.push({ w: p.w, gpu: g0, cpu: c0 || null });
    if (c0) {
      r.cpuM0++;
      if ((walk[0] || []).some(cancelled)) r.cancelledM0++;
      else if (!p.gpu.some((g) => g[3] <= HIT && near(g, c0))) r.missingM0.push({ w: p.w, cpu: c0, gpu: p.gpu });
    }
    for (const c of p.cpu) {
      if (c[2] === 0) continue;
      if (c[2] === 1) { if (!p.gpu.some((g) => near(g, c))) r.m1Differ++; continue; }
      r.cpuOthers++;
      if ((walk[c[2]] || []).some(cancelled)) r.cancelledOthers++;
      else if (!p.gpu.some((g) => g[3] <= HIT && near(g, c))) r.missingOthers.push({ w: p.w, cpu: c, gpu: p.gpu });
    }
    for (const g of p.gpu) {
      r.gpuMembers++;
      if (g[2] === 1 && !p.cpu.some((c) => near(g, c))) r.m1Differ++;
      const v = op.polish({ re: g[0], im: g[1] }, w);
      const hv = fin(v) && Ht(v), res = hv ? Math.hypot(hv.re - w.re, hv.im - w.im) / (1 + Math.hypot(w.re, w.im)) : Infinity;
      if (!(res <= CPU_HIT && Math.hypot(v.re - g[0], v.im - g[1]) <= DED * (1 + Math.hypot(v.re, v.im)))) r.notRoots.push({ w: p.w, gpu: g, res });
    }
  });
  return r;
})()`);
const brief = (list) => ({ count: list.length, first: list.slice(0, 4) });
info[`series u=${U_FAR}`] = { points: far.points, cpuM0: far.cpuM0, cancelledM0: far.cancelledM0, cpuOthers: far.cpuOthers, cancelledOthers: far.cancelledOthers, member1Differs: far.m1Differ, gpuMembers: far.gpuMembers, wrongM0: brief(far.wrongM0), missingM0: brief(far.missingM0), missingOthers: brief(far.missingOthers), notRoots: brief(far.notRoots) };
ok(`series at u = ${U_FAR}: a member 0 the GPU keeps is the CPU's member 0 at every point`, far.points === GRID * GRID && far.wrongM0.length === 0, brief(far.wrongM0));
ok(`series at u = ${U_FAR}: the CPU's member 0 is among the GPU's members wherever its walk is clear of the series' cancelled points`, far.cpuM0 > MIN_MEMBERS_0 && far.missingM0.length === 0, brief(far.missingM0));
ok(`series at u = ${U_FAR}: every member of the CPU's ladder is among the GPU's members wherever its walk is clear of the series' cancelled points`, far.cpuOthers > MIN_LADDER && far.missingOthers.length === 0, brief(far.missingOthers));
ok(`series at u = ${U_FAR}: every GPU member is a root of H_t (polished in float64 it hits w within ${CPU_HIT} and moves by at most NEWT_DEDUPE (1 + |z|))`, far.gpuMembers > MIN_GPU_MEMBERS && far.notRoots.length === 0, brief(far.notRoots));
ok(`control: the series' cancelled points are some of the grid, not most of it (between ${MIN_CANCELLED} and ${MAX_CANCELLED} of the CPU's members 0)`, far.cancelledM0 >= MIN_CANCELLED * far.cpuM0 && far.cancelledM0 <= MAX_CANCELLED * far.cpuM0, { cancelledM0: far.cancelledM0, cpuM0: far.cpuM0 });
return { pass: fails.length === 0, fails: fails.slice(0, 10), info };

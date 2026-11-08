// The deformation on a Dirichlet series (ζ as Σ n^{−z}) against the same scene with z² + 1: its start and the choice of
// its paths, with the main thread's long tasks. In the steps view the start is the thread parked halfway from z to w₁
// (a glide's frame) and the paths are the glide's (__cmwSteps().paths.ready); in the classic view it is the click on
// Deformation and the X → Y path selection (rightMode image, __cmwMorphCache().ready). The series is sampled by
// Euler–Maclaurin per residue, no slower than a formula, so the park and the choice stay within a margin of the
// formula's; the absolute times on software GL are dominated by the shader link, which both scenes pay. Also: η
// ((−1)^{n+1}) builds as a Dirichlet series and deforms. It runs pinned to the steps view (ci/suite_views.js:
// steps({ pin: true })): the classic view's Deformation has no control that opens it, so its X → Y selection is not a
// feature to test. A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const shapes = [{ id: 's1', kind: 'rect', a: [1.5, -6], b: [5, 6] }];
const series = (an) => [{ type: 'series', params: { kind: 'dirichlet', an, c: '0' }, on: true }];
const OBS = `window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) __lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' })`;
// open the scene, start the deformation, wait for its paths: {park ms (the start), ready ms, long tasks, largest}
async function run(name, steps) {
  await load('defdir' + name + Date.now(), { shapes, steps, rightMode: 'image', srcView: { cx: 3, cy: 0, s: 60 } });
  await settled({ until: 'typeof __cmwSteps === "function" && typeof __cmwP === "function"', max: 30000 });
  await sleep(4000);
  const on = await ev('__cmwSteps().on');
  await ev(OBS);
  const err = await ev('__cmwP().errors.join("")');
  const start = on ? '__cmwSteps({ park: 0.5 })' : '__cmwMorph({ open: true })';
  const r = await ev(`(() => { const t0 = performance.now(); ${start}; return { t0, park: performance.now() - t0 }; })()`);
  const T = Date.now();
  let ready = false, paths = null;
  const PATHS = on ? '__cmwSteps().paths' : '(() => { const m = __cmwMorphCache(); return { ready: m.ready, kept: m.zs ? m.zs.length : 0 }; })()';
  while (Date.now() - T < 60000) { await sleep(200); paths = await ev(PATHS); if (paths && paths.ready === true) { ready = true; break; } }
  const at = await ev('performance.now()');
  const lt = (await ev('__lt')).filter(([s]) => s >= r.t0);
  await ev(on ? '__cmwSteps({ go: 0, now: true })' : '__cmwMorph({ open: true })'); await settled({ until: on ? '!__cmwSteps().moving' : '__cmwMorph().open === true', max: 8000 });
  const durs = lt.map(([, d]) => d);
  return { on, err, ready, kept: paths && paths.kept, park: Math.round(r.park), readyMs: Math.round(at - r.t0), tasks: lt.length,
    largest: Math.round(Math.max(0, ...durs)), blocked: Math.round(durs.reduce((a, d) => a + d, 0)) };
}
await view(1440, 900, false);
// a measurement, not a verdict: N loads of each scene, one run each, listed as a failure so that the runner prints them
const N = Number(process.env.CMW_DD_N || 5);
const zs = [], ps = [];
for (let i = 0; i < N; i++) { zs.push(await run('zeta' + i, series('1'))); ps.push(await run('poly' + i, [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }])); }
ok('MEASURE ' + JSON.stringify({ zeta: zs.map((r) => [r.readyMs, r.blocked, r.largest]), poly: ps.map((r) => [r.readyMs, r.blocked, r.largest]) }), false, '');
return { pass: false, fails };

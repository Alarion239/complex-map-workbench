// The deformation on a Dirichlet series (ζ as Σ n^{−z}) against the same scene with z² + 1: its start and the choice of
// its paths, with the main thread's long tasks. In the steps view the start is the thread parked halfway from z to w₁
// (a glide's frame) and the paths are the glide's (__cmwSteps().paths.ready). The series is sampled by
// Euler–Maclaurin per residue, no slower than a formula, so the park stays within a margin of the formula's. The paths
// wait for the main thread, which software GL holds while it compiles the glide's inverse programs: nearly all of
// ζ's 12-18 s on a 4-core runner (z² + 1, whose programs are built before the start, takes 0.4-0.8 s), so the time on
// ζ is gated as that block itself, against a budget (ZETA_BLOCKED_MS), not as a multiple of z² + 1's. Also: η
// ((−1)^{n+1}) builds as a Dirichlet series and deforms. It runs pinned to the steps view (ci/suite_views.js:
// steps({ pin: true })). A command file for a CDP daemon.
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
  const r = await ev(`(() => { const t0 = performance.now(); __cmwSteps({ park: 0.5 }); return { t0, park: performance.now() - t0 }; })()`);
  const T = Date.now();
  let ready = false, paths = null;
  while (Date.now() - T < 60000) { await sleep(200); paths = await ev('__cmwSteps().paths'); if (paths && paths.ready === true) { ready = true; break; } }
  const at = await ev('performance.now()');
  const lt = (await ev('__lt')).filter(([s]) => s >= r.t0);
  await ev('__cmwSteps({ go: 0, now: true })'); await settled({ until: '!__cmwSteps().moving', max: 8000 });
  const durs = lt.map(([, d]) => d);
  return { on, err, ready, kept: paths && paths.kept, park: Math.round(r.park), readyMs: Math.round(at - r.t0), tasks: lt.length,
    largest: Math.round(Math.max(0, ...durs)), blocked: Math.round(durs.reduce((a, d) => a + d, 0)) };
}
await view(1440, 900, false);
// (each scene twice; the better run counts, so a busy shared runner does not decide it)
const best = (a, b) => ({ ...(a.readyMs <= b.readyMs ? a : b), park: Math.min(a.park, b.park), blocked: Math.min(a.blocked, b.blocked),
  ready: a.ready && b.ready, err: a.err || b.err, on: a.on && b.on });
const twice = async (name, steps) => best(await run(name, steps), await run(name + '2', steps));
const zeta = await twice('zeta', series('1'));
const poly = await twice('poly', [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }]);
const eta = await run('eta', series('(-1)^{n+1}'));
const chose = (r) => r.err === '' && r.ready && r.kept > 0;
ok('ζ as a Dirichlet series builds and its deformation chooses its paths', chose(zeta), zeta);
ok('z² + 1 builds and its deformation chooses its paths', chose(poly), poly);
ok('η, (−1)^{n+1} as a Dirichlet series, builds and deforms', chose(eta), eta);
// gated: ζ's main-thread block, absolute. The block is the compile of the glide's inverse programs on llvmpipe, which takes the cores it
// is given (measured on 4 cores, 2 and 1, idle: ζ's block 10.5-11.1 s, 20 s, 36 s, and 15-16 s, 26-30 s, 49-52 s while other jobs ran; z² + 1's
// ready time stays 0.6-1.2 s throughout), so z² + 1 is no scale for it: a ratio to it fails a slow machine (49 s on one core is 46-55 times)
// and passes a ζ build twice as slow (27 s is 42 times). The budget is for 4 cores and widens by 4 / cores below that. 25 s is 1.4 times
// the slowest hosted block seen (17.5 s on the slow runners; 12 s on the fast), 1.6 times the loaded local block and 2.3 times the idle one.
// It fails a ζ build twice as slow on the slow runners (35 s) but not on the fast runners or locally (24 s, 22 s: a busy-wait of 12 s in the
// first inverse draw gives 22.4 s, green; 30 s gives 40.5 s, red); the ungated timing rows below report that (#1365)
const ZETA_BLOCKED_MS = 25000;
const cores = Math.max(1, Math.min(4, (await ev('navigator.hardwareConcurrency')) || 4));
const budget = Math.round(ZETA_BLOCKED_MS * 4 / cores);
ok(`the main thread is held at most ${budget} ms (${ZETA_BLOCKED_MS} ms on 4 cores, ${cores} here) by ζ's deformation build`, zeta.blocked <= budget && zeta.ready, { zeta, poly, budget, cores });
ok('the start on ζ (the park halfway) takes at most 100 ms more than on z² + 1', zeta.park <= poly.park + 100, { zeta, poly });
// tighter: reported, not gated (ci/browser_suites.js TIMING)
ok('timing: the paths on ζ within 5 times those of z² + 1', zeta.readyMs <= 5 * poly.readyMs, { zeta, poly });
ok('timing: the start on ζ within 50 ms of z² + 1', zeta.park <= poly.park + 50, { zeta, poly });
ok('timing: the paths on ζ within 3 times z² + 1 and 1 s, at most 1 s more blocked',
  zeta.readyMs <= 3 * poly.readyMs + 1000 && zeta.blocked <= poly.blocked + 1000, { zeta, poly });
return { pass: fails.length === 0, fails, zeta, poly, eta };

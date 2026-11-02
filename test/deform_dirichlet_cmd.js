// [issue #244] The deformation on a Dirichlet series (ζ as Σ n^{−z}) against the same scene with z² + 1, in the steps
// view: the thread parked halfway from z to w₁ (a glide's frame) and the choice of its paths (the paths the glide draws,
// until __cmwSteps().paths.ready), with the main thread's long tasks. The series is no slower to sample than a formula
// (#257: Euler–Maclaurin per residue), so the park and the choice stay within a margin of the formula's; the absolute
// times on software GL are dominated by the shader link, which both scenes pay. Also: η ((−1)^{n+1}) builds as a
// Dirichlet series and deforms (#242).
// It runs in the steps view (ci/suite_views.js: steps({ pin: true })).
// A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const shapes = [{ id: 's1', kind: 'rect', a: [1.5, -6], b: [5, 6] }];
const series = (an) => [{ type: 'series', params: { kind: 'dirichlet', an, c: '0' }, on: true }];
const OBS = `window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) __lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' })`;
// open the scene on plane z, park the thread halfway to w₁, wait for the paths: {park ms, ready ms, long tasks, largest}
async function run(name, steps) {
  await load('defdir' + name + Date.now(), { shapes, steps, srcView: { cx: 3, cy: 0, s: 60 } });
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
  await ev('__cmwSteps({ go: 0, now: true })'); await sleep(300);
  return { on, err, ready, kept: paths && paths.kept, park: Math.round(r.park), readyMs: Math.round(at - r.t0), tasks: lt.length, largest: Math.round(Math.max(0, ...lt.map(([, d]) => d))), blocked: Math.round(lt.reduce((a, [, d]) => a + d, 0)) };
}
await view(1440, 900, false);
// (each scene twice; the better run counts, so a busy shared runner does not decide it)
const best = (a, b) => ({ ...(a.readyMs <= b.readyMs ? a : b), park: Math.min(a.park, b.park), blocked: Math.min(a.blocked, b.blocked), ready: a.ready && b.ready, err: a.err || b.err, on: a.on && b.on });
const twice = async (name, steps) => best(await run(name, steps), await run(name + '2', steps));
const zeta = await twice('zeta', series('1'));
const poly = await twice('poly', [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }]);
const eta = await run('eta', series('(-1)^{n+1}'));
ok('the scenes open in the steps view', zeta.on && poly.on && eta.on, [zeta.on, poly.on, eta.on]);
ok('ζ as a Dirichlet series builds and its glide chooses its paths', zeta.err === '' && zeta.ready && zeta.kept > 0, zeta);
ok('z² + 1 builds and its glide chooses its paths', poly.err === '' && poly.ready && poly.kept > 0, poly);
ok('η, (−1)^{n+1} as a Dirichlet series, builds and deforms (#242)', eta.err === '' && eta.ready && eta.kept > 0, eta);
// gated, generous: before #257 the choice on ζ was not ready within the minute (the check above) and the click took
// ~3 s. (GitHub's lavapipe runner takes ~16 times z² + 1's choice on ζ, this machine's SwiftShader ~2 times)
ok('the paths on ζ are ready within 30 times those of z² + 1 and 2 s', zeta.readyMs <= 30 * poly.readyMs + 2000, { zeta, poly });
ok('the park halfway on ζ takes at most 100 ms more than on z² + 1', zeta.park <= poly.park + 100, { zeta, poly });
// tighter: reported, not gated (ci/browser_suites.js TIMING)
ok('timing: the paths on ζ within 5 times those of z² + 1', zeta.readyMs <= 5 * poly.readyMs, { zeta, poly });
ok('timing: the park halfway on ζ within 50 ms of z² + 1', zeta.park <= poly.park + 50, { zeta, poly });
ok('timing: the paths on ζ within 3 times z² + 1 and 1 s, at most 1 s more blocked', zeta.readyMs <= 3 * poly.readyMs + 1000 && zeta.blocked <= poly.blocked + 1000, { zeta, poly });
return { pass: fails.length === 0, fails, zeta, poly, eta };

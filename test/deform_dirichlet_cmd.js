// [issue #244] The deformation on a Dirichlet series (ζ as Σ n^{−z}) against the same scene with z² + 1: the click on
// Deformation and the X → Y path selection (rightMode image, until __cmwMorphCache().ready), with the main thread's long
// tasks. The series is no slower to sample than a formula (#257: Euler–Maclaurin per residue), so the click and the
// selection stay within a margin of the formula's; the absolute times on software GL are dominated by the shader link,
// which both scenes pay. Also: η ((−1)^{n+1}) builds as a Dirichlet series and deforms (#242).
// A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const shapes = [{ id: 's1', kind: 'rect', a: [1.5, -6], b: [5, 6] }];
const series = (an) => [{ type: 'series', params: { kind: 'dirichlet', an, c: '0' }, on: true }];
const OBS = `window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) __lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask' })`;
// open the scene, click Deformation, wait for the selection: {click ms, ready ms, long tasks, largest}
async function run(name, steps) {
  await load('defdir' + name + Date.now(), { shapes, steps, rightMode: 'image', srcView: { cx: 3, cy: 0, s: 60 } });
  await sleep(4000);
  await ev(OBS);
  const err = await ev('__cmwP().errors.join("")');
  const r = await ev(`(() => { const t0 = performance.now(); document.getElementById('morphBtn').click(); return { t0, click: performance.now() - t0 }; })()`);
  const T = Date.now();
  let ready = false;
  while (Date.now() - T < 60000) { await sleep(200); const m = await ev('__cmwMorphCache().ready'); if (m === true) { ready = true; break; } }
  const at = await ev('performance.now()');
  const lt = (await ev('__lt')).filter(([s]) => s >= r.t0);
  await ev(`document.getElementById('morphBtn').click()`); await sleep(300);
  return { err, ready, click: Math.round(r.click), readyMs: Math.round(at - r.t0), tasks: lt.length, largest: Math.round(Math.max(0, ...lt.map(([, d]) => d))), blocked: Math.round(lt.reduce((a, [, d]) => a + d, 0)) };
}
await view(1440, 900, false);
const zeta = await run('zeta', series('1'));
const poly = await run('poly', [{ type: 'custom', params: { expr: 'z^2+1', cut: 180 }, on: true }]);
const eta = await run('eta', series('(-1)^{n+1}'));
ok('ζ as a Dirichlet series builds and its deformation chooses its paths', zeta.err === '' && zeta.ready, zeta);
ok('z² + 1 builds and its deformation chooses its paths', poly.err === '' && poly.ready, poly);
ok('η, (−1)^{n+1} as a Dirichlet series, builds and deforms (#242)', eta.err === '' && eta.ready, eta);
// (timing: reported, not gated in CI, ci/browser_suites.js)
ok('the Deformation click on ζ takes at most 50 ms more than on z² + 1', zeta.click <= poly.click + 50, { zeta, poly });
ok('the X → Y selection on ζ is ready within 3 times that of z² + 1 and 1 s', zeta.readyMs <= 3 * poly.readyMs + 1000, { zeta, poly });
ok('the X → Y selection on ζ blocks the main thread at most 1 s more than z² + 1', zeta.blocked <= poly.blocked + 1000, { zeta, poly });
return { pass: fails.length === 0, fails, zeta, poly, eta };

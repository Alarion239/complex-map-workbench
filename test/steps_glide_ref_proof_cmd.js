// A probe, not a suite (#857): the exact reference (held_frames.js __giRef) against the renderer and against plane 1's parked
// frame on the Joukowski airfoil, Inside regions, with every root (__giAllRoots) and with the roots in the regions.
// Run: node ci/browser.js --no-build --only steps_glide_ref_proof; the numbers are in .ci/browser/<file>.json (info).
const out = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, refOf, compare, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=proof${Date.now()}`);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && !!window.GLR' });
await ev(`__cmwExample(${names.indexOf('Joukowski airfoil')}); 1`); await settled({ max: 60000 });
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'in', surf: 'plane' }), 1`);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
await rest(0); await grab('R0');
for (const u of [0.999]) {
  out['held' + u] = (await hold(u)).ok; await grab('M' + u);
  for (const all of [true, false]) { await ev(`window.__giAllRoots = ${all}, 1`); out[`u${u} ${all ? 'old (all roots)' : 'new (roots in the region)'} vs the moving frame`] = await refOf('R0', 'M' + u, DIFF_TOL); }
  if (u === 0.999) {
    await ev('window.__svScrubUp(), 1'); await rest(1); await grab('R1');
    out.movingVsParked = await compare('M0.999', 'R1');
    out.R1 = await ev(`(() => { const c = document.getElementById('canvasL'); return [c.width, c.height]; })()`);
    for (const all of [true, false]) { await ev(`window.__giAllRoots = ${all}, 1`); out[`u${u} ${all ? 'old (all roots)' : 'new (roots in the region)'} vs plane 1's PARKED frame`] = await refOf('R0', 'R1', DIFF_TOL); }
  } else { await ev('window.__svScrubUp(), 1'); await rest(0); }
}
return { pass: true, fails: [], info: out };

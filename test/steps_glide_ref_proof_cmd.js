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
const SCOPE = process.env.GI_SCOPE || 'in';
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${SCOPE}', surf: 'plane' }), 1`);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
const cam = () => ev(`(() => { const v = (window.paneL || {}).view; const g = __cmwSteps().glide; return JSON.stringify(g && g.view); })()`);
for (const u of SCOPE === 'all' ? [0.25, 0.5, 0.75] : [0.25, 0.75, 0.999]) {
  // (plane 0's parked frame under the camera the glide then uses: the camera can change between visits)
  await rest(0); await grab('R0');
  out['held' + u] = (await hold(u)).ok; await grab('M' + u);
  const cm = await cam();
  if (SCOPE === 'all') {
    // (a frame the carried mesh draws has no sheet key in its record: the inverse pass's key of the glide's frame at u)
    out['path' + u] = await ev(`(() => { const g = __cmwSteps().glide; if (!g.key) { const k = __cmwSvKey(g.b, g.u), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])) }; g.key = (z) => Inverse.sheetKey(prep, z, null); } return { path: g.path, b: g.b, u: g.u, why: g.reason }; })()`);
    await ev('window.__giAllRoots = false, 1');
    for (const tol of [3, 32]) out[`Everywhere u${u} vs the moving frame at ${tol}`] = await refOf('R0', 'M' + u, tol);
  } else
  for (const all of [true, false]) { await ev(`window.__giAllRoots = ${all}, 1`); out[`u${u} ${all ? 'old (all roots)' : 'new (roots in the region)'} vs the moving frame`] = await refOf('R0', 'M' + u, DIFF_TOL); }
  if (process.env.GI_IMG && u < 0.9) {
    await ev(fs.readFileSync(process.env.GI_DIAG, 'utf8') + '; 1');
    const png = async (js, name) => fs.writeFileSync(path.join(process.env.GI_IMG, name), Buffer.from((await ev(js)).split(',')[1], 'base64'));
    await png(`__giPng(__heldPx['M${u}'])`, `u${u}_renderer.png`);
    await png(`__giPng(__heldPx.R0)`, `u${u}_plane0.png`);
    await png(`(() => { const c = document.getElementById('canvasL'); return __giImg(__heldPx.R0, c.width, c.height, true); })()`, `u${u}_ref_old.png`);
    await png(`(() => { const c = document.getElementById('canvasL'); return __giImg(__heldPx.R0, c.width, c.height, false); })()`, `u${u}_ref_new.png`);
  }
  await ev('window.__svScrubUp(), 1');
  await rest(0); await grab('R0b'); out['base unchanged ' + u] = await compare('R0', 'R0b');
  if (u === 0.999 && SCOPE !== 'all') {
    await hold(u); await grab('M2'); out.cam = [cm, await cam()];
    await ev('window.__svScrubUp(), 1'); await rest(1); await grab('R1');
    out.movingVsParked = await compare('M2', 'R1');
    for (const all of [true, false]) { await ev(`window.__giAllRoots = ${all}, 1`); out[`u${u} ${all ? 'old (all roots)' : 'new (roots in the region)'} vs plane 1's PARKED frame`] = await refOf('R0', 'R1', DIFF_TOL); }
    if (process.env.GI_DIAG) {
      await ev(fs.readFileSync(process.env.GI_DIAG, 'utf8') + '; 1');
      out.diag = await ev(`(() => { const c = document.getElementById('canvasL'), K = window.__heldPx, f = (t) => ({ W: c.width, H: c.height, d: K[t] }); return __giDiag(f('R0'), f('R1'), ${DIFF_TOL}); })()`);
    }
  }
}
return { pass: true, fails: [], info: out };

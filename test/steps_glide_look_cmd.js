// The steps view's glide looks like its planes: the frames of a glide from plane z to the next, held still on the rail
// (a scrub not let go: the moving frames) and read from the left pane's canvas, against the frames at rest on those
// planes. Three cases: the default example (Strip to disk, Inside regions), the Joukowski airfoil (Inside regions) and
// the Mountain King Everywhere (the whole plane carried forward). Paths are off: the glide's paths are drawn over the
// colour, which is what is read. Each case checks three things, each its own failure:
// - the same look: a moving frame a hair from a plane (x = EDGE from either end) is that plane's rest frame, at most
//   SAME_FRAC of the pixels more than DIFF_TOL apart (the tolerance of steps_sm_standin_cmd.js, a frame and the rest
//   frame after it), with its largest and mean difference reported;
// - no fade: the first and the last frames of a glide (x = FIRST from either end, a 60 fps frame of a Normal glide)
//   draw no plane's colour at a partial opacity over the moving picture (a crossfade), and their mean luminance and
//   alpha are reported beside the rest frame's;
// - no mesh: the frame held half-way does not depend on the meshes it is drawn with: drawn again with meshes of half
//   the resolution (Mesh quality halved), at most SAME_FRAC of the pixels more than DIFF_TOL apart.
// The device pixel ratio is the kit's (CMW_DPR); ci/browser_suites.js runs this at 1 and at 2.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, compare, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005;
const EDGE = 0.005, FIRST = 0.02;
await view(1200, 800, false, false);
info.dpr = await ev('devicePixelRatio');
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
// (at rest on plane i, its frame drawn)
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
// (let go of the thread held a hair from a plane: it settles there; then back on plane z)
const letGo = async () => { await ev('window.__svScrubUp(), 1'); await rest(0); };
const CASES = [
  { tag: 'Strip to disk', example: null, scope: 'in' },
  { tag: 'Joukowski airfoil', example: 'Joukowski airfoil', scope: 'in' },
  { tag: 'Mountain King, Everywhere', example: 'In the Hall of the Mountain King', scope: 'all' },
];
for (const c of CASES) {
  const r = info[c.tag] = {};
  await go(`http://localhost:${PORT}/test.html?ns=look${Date.now()}`);
  await ready();
  if (c.example) {
    const ex = names.indexOf(c.example);
    ok(`${c.tag}: the example is found`, ex >= 0, names.length);
    await ev(`__cmwExample(${ex}); 1`);
    await settled({ max: 60000 });
  }
  await ev(`__cmwSet('morphPaths', false), __cmwSteps(${JSON.stringify({ scope: c.scope, surf: 'plane' })}), 1`);
  // (the opacity of each colour plot drawn since the last reset: window.__plotAlphas)
  await ev(`(() => { const f = GLR.drawColorPlot; window.__plotAlphas = []; GLR.drawColorPlot = function (o) { window.__plotAlphas.push(o.alpha == null ? 1 : o.alpha); return f.apply(this, arguments); }; return 1; })()`);
  await rest(1);
  r.rest1 = await grab('R1');
  await rest(0);
  r.rest0 = await grab('R0');
  // ---- the same look a hair from each plane ----
  const look = {};
  for (const [x, end] of [[EDGE, 'R0'], [1 - EDGE, 'R1']]) {
    look[x] = { held: (await hold(x)).ok, still: await grab('M' + x) };
    look[x].diff = await compare('M' + x, end);
    await letGo();
  }
  r.look = look;
  const lookOk = (x) => look[x].held && look[x].still && look[x].diff && look[x].diff.frac <= SAME_FRAC;
  ok(`${c.tag}: a moving frame a hair from plane z (x = ${EDGE}) is plane z's rest frame (at most ${SAME_FRAC * 100} % of pixels > ${DIFF_TOL}/255 apart)`, lookOk(EDGE), look[EDGE]);
  ok(`${c.tag}: a moving frame a hair from the next plane (x = ${1 - EDGE}) is that plane's rest frame (at most ${SAME_FRAC * 100} % of pixels > ${DIFF_TOL}/255 apart)`, lookOk(1 - EDGE), look[1 - EDGE]);
  // ---- no fade at a glide's ends ----
  const fade = {};
  for (const [x, end] of [[FIRST, 'R0'], [1 - FIRST, 'R1']]) {
    const held = (await hold(x)).ok;
    // (a redraw of the held frame, its plots' opacities recorded)
    await ev('window.__plotAlphas = [], __cmwHideStrokes(false), 1');
    const still = await grab('F' + x);
    const alphas = [...new Set(await ev('window.__plotAlphas'))].map((a) => +a.toFixed(4));
    const d = await compare('F' + x, end);
    fade[x] = { held, still, alphas, lum: d && d.lum, alpha: d && d.alpha };
    await letGo();
  }
  r.fade = fade;
  const crossfade = (x) => !fade[x].held || !fade[x].still || fade[x].alphas.some((a) => a > 0 && a < 1);
  ok(`${c.tag}: no fade: the first frame of the glide (x = ${FIRST}) blends no plane's colour at a partial opacity (lum and alpha: moving, rest)`, !crossfade(FIRST), fade[FIRST]);
  ok(`${c.tag}: no fade: the last frame of the glide (x = ${1 - FIRST}) blends no plane's colour at a partial opacity (lum and alpha: moving, rest)`, !crossfade(1 - FIRST), fade[1 - FIRST]);
  // ---- no mesh half-way ----
  const meshN = await ev('__cmwState().meshN');
  const held = (await hold(0.5)).ok, a = await grab('H');
  await ev(`__cmwSet('meshN', ${Math.round(meshN / 2)}), 1`);
  await settled({ max: 60000, until: `__cmwState().meshN === ${Math.round(meshN / 2)} && GLR.pendingLinks === 0` });
  const b = await grab('Hhalf');
  await ev(`__cmwSet('meshN', ${meshN}), 1`);
  r.mesh = { meshN, held, still: a && b, diff: await compare('H', 'Hhalf') };
  ok(`${c.tag}: no mesh: the frame held half-way is the same with meshes of half the resolution (at most ${SAME_FRAC * 100} % of pixels > ${DIFF_TOL}/255 apart)`, held && a && b && r.mesh.diff && r.mesh.diff.frac <= SAME_FRAC, r.mesh);
  await letGo();
}
return { pass: fails.length === 0, fails, info };

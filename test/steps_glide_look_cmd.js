// The steps view's glide looks like its planes: the frames of a glide from plane z to the next, held still on the rail
// (a scrub not let go: the moving frames) and read from the left pane's canvas, against the frames at rest on those
// planes. The cases: the default example (Strip to disk) Inside regions and Everywhere, the Joukowski airfoil (Inside
// regions) and the Mountain King Everywhere (the whole plane carried forward). Paths are off: the glide's paths are drawn over the
// colour, which is what is read. Each case checks three things, each its own failure:
// - the same look: the moving frame at u (LOOK_U) is the exact picture at the same u, test/lib/held_frames.js's
//   __giRef: plane z's parked frame pulled through H_u's inverse (Newton's method, the front sheet by the glide's sheet
//   key), sampled every 10 px away from the colour lines, at least MIN_COMPARED pixels; at most SAME_FRAC of them more
//   than DIFF_TOL apart (the tolerance of steps_sm_standin_cmd.js, a frame and the rest frame after it). A frame drawn
//   by the carried mesh has no sheet key in its record, so no reference: it fails as such;
// - no fade: the first and the last frames of a glide (x = FIRST from either end, a 60 fps frame of a Normal glide)
//   draw no plane's colour at a partial opacity over the moving picture (a crossfade), and their mean luminance and
//   alpha are reported beside the rest frame's;
// - no mesh: the frame held half-way does not depend on the meshes it is drawn with: drawn again with meshes of half
//   the resolution (Mesh quality halved), at most SAME_FRAC of the pixels more than DIFF_TOL apart; and, Everywhere
//   on the default example, it has no more straight hard edges (steps over DIFF_TOL to the next row or column in runs
//   of at least EDGE_RUN CSS pixels, as the rows of the whole plane's stretched outer cells and the ring's coarse cells
//   leave) than the rest frame of either plane, at most SAME_FRAC of the pixels more.
// The device pixel ratio is the kit's (CMW_DPR); LOOK_CASES (a preamble) names the cases a run makes, all by default:
// ci/browser_suites.js runs the default example Inside regions, the Joukowski airfoil and the Mountain King at 1, and the
// default example Inside regions and Everywhere at 2.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, compare, edgeRuns, refOf, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005;
const LOOK_U = [0.25, 0.75], MIN_COMPARED = 1000, FIRST = 0.02;
const EDGE_RUN = 16;
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
  { tag: 'Strip to disk, Everywhere', example: null, scope: 'all', edges: true },
];
// one case: its frames read and its checks made, its findings in r
async function look(c, r) {
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
  r.step = 'the rest frames';
  await rest(1);
  r.rest1 = await grab('R1');
  await rest(0);
  r.rest0 = await grab('R0');
  // ---- the same look as the exact picture at the same u ----
  r.step = 'the same look';
  const look = {};
  for (const u of LOOK_U) {
    const held = (await hold(u)).ok, still = await grab('M' + u);
    look[u] = Object.assign({ held, still }, await refOf('R0', 'M' + u, DIFF_TOL));
    await letGo();
  }
  r.look = look;
  for (const u of LOOK_U) {
    const L = look[u], R = L.ref;
    ok(`${c.tag}: the moving frame at u = ${u} is the exact picture at u (plane z's parked frame through H_u's inverse: at most ${SAME_FRAC * 100} % of the compared pixels > ${DIFF_TOL}/255 apart; no reference without the glide's sheet key)`, L.held && L.still && !!R && R.n >= MIN_COMPARED && R.over <= SAME_FRAC, L);
  }
  // ---- no fade at a glide's ends ----
  r.step = 'no fade';
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
  r.step = 'no mesh';
  const meshN = await ev('__cmwState().meshN');
  const held = (await hold(0.5)).ok, a = await grab('H');
  await ev(`__cmwSet('meshN', ${Math.round(meshN / 2)}), 1`);
  await settled({ max: 60000, until: `__cmwState().meshN === ${Math.round(meshN / 2)} && GLR.pendingLinks === 0` });
  const b = await grab('Hhalf');
  await ev(`__cmwSet('meshN', ${meshN}), 1`);
  r.mesh = { meshN, held, still: a && b, diff: await compare('H', 'Hhalf') };
  ok(`${c.tag}: no mesh: the frame held half-way is the same with meshes of half the resolution (at most ${SAME_FRAC * 100} % of pixels > ${DIFF_TOL}/255 apart)`, held && a && b && r.mesh.diff && r.mesh.diff.frac <= SAME_FRAC, r.mesh);
  if (c.edges) await straightEdges(c, r, held && a);
  await letGo();
  r.step = 'done';
}
// the frame held half-way (H) against the rest frames: its straight hard edges, and whether it has more
async function straightEdges(c, r, held) {
  r.step = 'the straight edges half-way';
  const run = EDGE_RUN * info.dpr, E = { held: await edgeRuns('H', run), rest0: await edgeRuns('R0', run), rest1: await edgeRuns('R1', run) };
  const n = (e) => (e ? e.h + e.v : NaN);
  E.more = n(E.held) - Math.max(n(E.rest0), n(E.rest1));
  E.frac = +(E.more / (E.held ? E.held.px : NaN)).toFixed(4);
  r.edges = E;
  ok(`${c.tag}: no mesh: the frame held half-way has no more straight hard edges (runs of ${EDGE_RUN} px, rows h and columns v) than a rest frame, at most ${SAME_FRAC * 100} % of pixels more`, held && E.frac <= SAME_FRAC, E);
}
// (a case that throws, its page lost or a read that never answers, fails as such; the next case runs in a fresh page)
const only = typeof LOOK_CASES !== 'undefined' ? LOOK_CASES : null;
for (const c of CASES.filter((k) => !only || only.includes(k.tag))) {
  const r = info[c.tag] = {}, t0 = Date.now();
  try { await look(c, r); } catch (e) { ok(`${c.tag}: the case runs to its end`, false, { at: r.step, error: String(e && e.message || e).slice(0, 300) }); }
  r.s = Math.round((Date.now() - t0) / 1000);
}
return { pass: fails.length === 0, fails, info };

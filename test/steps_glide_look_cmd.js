// The steps view's glide looks like its planes: the frames of a glide from plane z to the next, held still on the rail
// (a scrub not let go: the moving frames) and read from the left pane's canvas, against the frames at rest on those
// planes. The cases: the default example (Strip to disk) Inside regions and Everywhere, the Joukowski airfoil (Inside
// regions, and Everywhere: a homotopy inverted by Newton, every point over w), the Mountain King Everywhere (the
// whole plane carried forward) and the logarithm of an annulus Everywhere (a glide with no inverse, drawn by the
// carried mesh). Paths are off: the glide's paths are drawn over the colour, which is what is read.
// Each case checks these things, each in checks of their own:
// - the same look: the moving frame at u (LOOK_U) is the exact picture at the same u, test/lib/held_frames.js's
//   __giRef: plane z's parked frame pulled through H_u's inverse (Newton's method, the front sheet by the glide's sheet
//   key), sampled every 10 px away from the colour lines, at least MIN_COMPARED pixels; at most SAME_FRAC of them more
//   than LOOK_TOL apart (3 levels on 99.5 %). A frame drawn
//   by the carried mesh has no sheet key in its record, so no reference: it fails as such. And the lines over the
//   colour in those frames are the rest renderer's: its major grid over the colour (held_frames.js's gridOver: where
//   that stroke shows, at least MIN_LINE_PX pixels, at most SAME_FRAC more off it than plane z's rest frame read the
//   same way), and each open set's outline dashed (outlines: its ink in pieces no wider than a dash, the share in wider
//   ones at most the rest frame's + SAME_FRAC); a case with no open set's outline on the plane has no dash to check;
// - the logarithm's coverage (in place of the same look: a frame the carried mesh draws has no exact reference): the
//   colour layer alone (__cmwSteps({ bare })) of the frames at u (LOOK_U and COVER_U) sampled every 3 device px, the
//   pixels more than 3 CSS px from the edge of H_u's image (the log step's homotopy H_t(z) = (z^s - 1)/s + s, s = 1 - t,
//   sends the plane cut along (-inf, 0] onto the sector s - 1/s + rho e^(i phi), |phi| < s pi): inside it, none is the
//   bare paper (the commonest colour outside it), and outside it none is drawn, at most COVER_TOL of each;
// - the ends: the frames at x = END_X from either end (__cmwSteps({ x }), a glide's frame there) are the planes' parked
//   frames, pixel by pixel away from the colour lines (held_frames.js's sameAway: at least MIN_SAME pixels, at most
//   SAME_FRAC more than LOOK_TOL apart); the logarithm's inside H_u's image only;
// - the same overlays: a moving frame a hair from a plane (x = EDGE from either end) draws what that plane's rest frame
//   draws over the colour, which the same look's comparison skips (it leaves out the pixels by lines): as many graph
//   paper draws (GLR.drawGrid), as many dashed outlines (open sets: GLR.drawLines with a dash), and the colour plot's
//   grid (its 2D strokes: the major grid, the axes' casing, the axes) when the rest frame has it;
// - no fade: the first and the last frames of a glide (x = FIRST from either end, a 60 fps frame of a Normal glide)
//   draw no plane's colour at a partial opacity over the moving picture (a crossfade), and their mean luminance and
//   alpha are reported beside the rest frame's;
// - no mesh: the frame held half-way does not depend on the meshes it is drawn with: drawn again with meshes of half
//   the resolution (Mesh quality halved), at most SAME_FRAC of the pixels more than DIFF_TOL apart; and, Everywhere
//   on the default example, it has no more straight hard edges (steps over DIFF_TOL to the next row or column in runs
//   of at least EDGE_RUN CSS pixels, as the rows of the whole plane's stretched outer cells and the ring's coarse cells
//   leave) than the rest frame of either plane, at most SAME_FRAC of the pixels more.
// The strokes of the curves and region borders through a glide are steps_glide_strokes_cmd.js's. The pane is 1200 x 800
// CSS px (the views shard's time; the look's spec names 1440 x 900). The device pixel ratio is the kit's (CMW_DPR);
// LOOK_CASES (a preamble) names the cases a run makes, all by default: ci/browser_suites.js runs the default example
// Inside regions, the Joukowski airfoil both ways, the Mountain King and the logarithm at 1, and the default example Inside regions and
// Everywhere at 2.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, compare, sameAway, edgeRuns, refOf, gridOver, outlines, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const SAME_FRAC = 0.005;
const LOOK_U = [0.25, 0.5, 0.75], LOOK_TOL = 3, END_X = 0.001, MIN_SAME = 20000, MIN_COMPARED = 1000, MIN_LINE_PX = 100, FIRST = 0.02, EDGE = 0.005;
const EDGE_RUN = 16, COVER_U = [0.02, 0.98], COVER_TOL = 0.001;
await view(1200, 800, false, false);
info.dpr = await ev('devicePixelRatio');
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
// (at rest on plane i, its frame drawn)
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
// (let go of the thread held a hair from a plane: it settles there; then back on plane z)
// the overlays of the left pane's frame drawn next (a redraw asked for): {grid: GLR.drawGrid's draws, dashed:
// GLR.drawLines' draws with a dash, colourGrid: the colour plot's grid in 2D on the left pane (the major grid in --dc-line at 1 px, then the
// axes' casing in --dc-casing at 2.5 px and the axes in --dc-line at 1.25 px, three strokes in a row)}
const overlays = async () => {
  await ev(`(() => {
    if (!window.__ovWrap) {
      window.__ovWrap = 1;
      const g = GLR.drawGrid, l = GLR.drawLines, cx = document.getElementById('canvasL').getContext('2d'), st = cx.stroke;
      // (the whole stack: the mask's outlines are drawn deep inside drawScene)
      const left = () => { const n = Error.stackTraceLimit; Error.stackTraceLimit = 100; const st = new Error().stack || ''; Error.stackTraceLimit = n; return st.includes('renderLeft'); };
      GLR.drawGrid = function () { if (window.__ov && left()) window.__ov.grid++; return g.apply(this, arguments); };
      GLR.drawLines = function (res, o) { if (window.__ov && o && o.dash && left()) window.__ov.dashed++; return l.apply(this, arguments); };
      cx.stroke = function () { if (window.__ov) window.__ov.strokes.push([String(this.strokeStyle).toLowerCase(), this.lineWidth]); return st.apply(this, arguments); };
    }
    window.__ov = { grid: 0, dashed: 0, strokes: [] };
    __cmwHideStrokes(false);
    return 1;
  })()`);
  // (until the frame has drawn and its counts hold still from one poll to the next: the frame's draws are all in)
  await ev('window.__ovN = -1, 1');
  await settled({ max: 20000, panes: false, until: '(() => { const n = window.__ov.strokes.length + window.__ov.grid + window.__ov.dashed, same = n === window.__ovN; window.__ovN = n; return n > 0 && same; })()' });
  return ev(`(() => {
    const o = window.__ov, css = (v, d) => { const c = document.createElement('canvas').getContext('2d'); c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d; return String(c.strokeStyle).toLowerCase(); };
    const line = css('--dc-line', '#ffffff'), casing = css('--dc-casing', '#0b1114'), S = o.strokes;
    let colourGrid = false;
    for (let i = 0; i + 2 < S.length; i++) if (S[i][0] === line && S[i][1] === 1 && S[i + 1][0] === casing && S[i + 1][1] === 2.5 && S[i + 2][0] === line && S[i + 2][1] === 1.25) colourGrid = true;
    window.__ov = null;
    return { grid: o.grid, dashed: o.dashed, colourGrid, strokes: S.length };
  })()`);
};
const letGo = async () => { await ev('window.__svScrubUp(), 1'); await rest(0); };
const CASES = [
  { tag: 'Strip to disk', example: null, scope: 'in' },
  { tag: 'Joukowski airfoil', example: 'Joukowski airfoil', scope: 'in' },
  // (the exact picture's Newton seeds a 24 x 16 grid: from 8 x 6, Newton misses the points of H_.25 in the disc by its
  // lower semicircle, the path's cut, at over half of the two-point w on the window)
  { tag: 'Joukowski airfoil, Everywhere', example: 'Joukowski airfoil', scope: 'all', seeds: [24, 16] },
  { tag: 'Mountain King, Everywhere', example: 'In the Hall of the Mountain King', scope: 'all' },
  { tag: 'Strip to disk, Everywhere', example: null, scope: 'all', edges: true },
  { tag: 'Logarithm, Everywhere', example: 'Logarithm of an annulus', scope: 'all', cover: true },
];
// (the page's __logSector(): for the glide's last frame, where its device pixel (x, y) is against H_u's image, the
// sector the log step's homotopy H_t(z) = (z^s - 1)/s + s, s = 1 - t, sends the plane cut along (-inf, 0] onto: 1 inside
// it, -1 outside it, 0 within 3 CSS px of its edge)
const LOG_SECTOR = `window.__logSector = () => {
  const g = __cmwSteps().glide, v = g.view, dpr = document.getElementById('canvasL').width / g.w, s = 1 - g.u, A = s - 1 / s;
  return (x, y) => {
  const pr = v.cx + ((x + 0.5) / dpr - g.w / 2) / v.s - A, pi = v.cy - ((y + 0.5) / dpr - g.h / 2) / v.s;
  const rho = Math.hypot(pr, pi), dphi = s * Math.PI - Math.abs(Math.atan2(pi, pr));
  return (Math.abs(dphi) < Math.PI / 2 ? rho * Math.sin(Math.abs(dphi)) : rho) < 3 / v.s ? 0 : dphi > 0 ? 1 : -1;
  };
}, 1`;
// the logarithm's coverage of the frame held at u: its colour layer alone read every 3 device px, against the sector:
// {u, ins, holes (inside it, on the paper), outs, strays (outside it, drawn)}
const coverage = async (tag) => {
  await ev('__cmwSteps({ bare: true }), 1');
  const still = await grab('C' + tag);
  const r = await ev(`(() => {
    const g = __cmwSteps().glide, c = document.getElementById('canvasL'), W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, K = __logSector(), ins = [], outs = [];
    for (let y = 2; y < H - 2; y += 3) for (let x = 2; x < W - 2; x += 3) {
      const k = K(x, y), i = 4 * (y * W + x);
      if (k) (k > 0 ? ins : outs).push([d[i], d[i + 1], d[i + 2]]);
    }
    const n = new Map();
    for (const p of outs) n.set(p.join(), (n.get(p.join()) || 0) + 1);
    const top = [...n].sort((a, b) => b[1] - a[1])[0], paper = top ? top[0].split(',').map(Number) : [d[0], d[1], d[2]];
    const isP = (p) => Math.max(Math.abs(p[0] - paper[0]), Math.abs(p[1] - paper[1]), Math.abs(p[2] - paper[2])) <= 3;
    return { u: +g.u.toFixed(4), path: g.path, paper, ins: ins.length, holes: ins.filter(isP).length, outs: outs.length, strays: outs.filter((p) => !isP(p)).length };
  })()`);
  await ev('__cmwSteps({ bare: false }), 1');
  return Object.assign({ still }, r);
};
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
  if (c.cover) await ev(LOG_SECTOR);
  // (the opacity of each colour plot drawn since the last reset: window.__plotAlphas)
  await ev(`(() => { const f = GLR.drawColorPlot; window.__plotAlphas = []; GLR.drawColorPlot = function (o) { window.__plotAlphas.push(o.alpha == null ? 1 : o.alpha); return f.apply(this, arguments); }; return 1; })()`);
  r.step = 'the rest frames';
  await rest(1);
  r.rest1 = await grab('R1');
  ok(`${c.tag}: plane 1's parked frame settles`, r.rest1, null);
  await rest(0);
  r.rest0 = await grab('R0');
  ok(`${c.tag}: plane z's parked frame settles`, r.rest0, null);
  // ---- the same look as the exact picture at the same u ----
  r.step = 'the same look';
  const look = {}, lines = {};
  for (const u of LOOK_U) {
    const held = (await hold(u)).ok, still = await grab('M' + u);
    ok(`${c.tag}: the moving frame at u = ${u} settles`, still, null);
    if (c.seeds) await ev(`window.__giSeeds = ${JSON.stringify(c.seeds)}, 1`);
    look[u] = Object.assign({ held, still }, await refOf('R0', 'M' + u, LOOK_TOL));
    if (c.seeds) await ev('delete window.__giSeeds, 1');
    // (the lines over the colour, read while the glide's record has this frame's camera)
    lines[u] = { grid: await gridOver('M' + u), outlines: await outlines('M' + u) };
    if (!lines.rest) lines.rest = { grid: await gridOver('R0'), outlines: await outlines('R0') };
    if (c.cover) look[u].cover = await coverage(u);
    await letGo();
  }
  if (c.cover) for (const u of COVER_U) { const held = (await hold(u)).ok; look[u] = { held, cover: await coverage(u) }; await letGo(); }
  r.look = look;
  r.lines = lines;
  for (const u of c.cover ? LOOK_U.concat(COVER_U) : []) {
    const V = look[u].cover;
    ok(`${c.tag}: the frame at u = ${u} covers H_u's image and nothing past it (its colour layer: at most ${COVER_TOL * 100} % of the pixels inside on the paper and of those outside drawn)`, look[u].held && V.still && V.ins > 1000 && V.outs > 0 && V.holes <= COVER_TOL * V.ins && V.strays <= COVER_TOL * V.outs, look[u]);
  }
  for (const u of c.cover ? [] : LOOK_U) {
    const L = look[u], R = L.ref;
    ok(`${c.tag}: the moving frame at u = ${u} is the exact picture at u (plane z's parked frame through H_u's inverse: at most ${SAME_FRAC * 100} % of the compared pixels > ${LOOK_TOL}/255 apart; no reference without the glide's sheet key)`, L.held && L.still && !!R && R.n >= MIN_COMPARED && R.over <= SAME_FRAC, L);
  }
  // ---- the lines over the colour, as the rest renderer draws them ----
  // (the rest frame of plane z read the same way is the model's own fit: its share off is the floor)
  const g0 = lines.rest.grid, gridOk = (q) => !!q && !!g0 && q.n >= MIN_LINE_PX && q.over - g0.over <= SAME_FRAC;
  ok(`${c.tag}: the grid over the colour at u = ${LOOK_U.join(' and ')}, as at rest (its major lines at --dc-line-a over the colour where they show: at least ${MIN_LINE_PX} such pixels, at most ${SAME_FRAC * 100} % more > ${DIFF_TOL}/255 off than plane z's rest frame)`, LOOK_U.every((u) => gridOk(lines[u].grid)), { moving: LOOK_U.map((u) => lines[u].grid), rest: lines.rest.grid });
  // (an open set's outline: dashed at rest, so in pieces no wider than a dash; its share of wider pieces is the rest
  // frame's, at most SAME_FRAC more)
  const dashed = (lines.rest.outlines || []).filter((o) => o.open && o.px > 0);
  const dashOk = (u) => dashed.every((o0) => { const o = (lines[u].outlines || []).find((q) => q.id === o0.id); return !!o && o.px > 0 && o.long - o0.long <= SAME_FRAC; });
  ok(`${c.tag}: the open sets' outlines dashed at u = ${LOOK_U.join(' and ')}, as at rest (the share of their ink in pieces wider than a dash at most the rest frame's + ${SAME_FRAC * 100} %)`, LOOK_U.every(dashOk), { dashedAtRest: dashed.length, moving: LOOK_U.map((u) => lines[u].outlines), rest: lines.rest.outlines });
  // ---- the ends: the glide's first and last frames are the planes' parked frames ----
  r.step = 'the ends';
  const ends = {};
  for (const [x, k] of [[END_X, 0], [1 - END_X, 1]]) {
    await rest(k);
    const restOk = await grab('E' + k);
    await ev(`__cmwSteps({ x: ${x} }), 1`);
    await settled({ max: 60000, until: `GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - ${x}) < 1e-9 && __cmwSteps().moving` });
    const still = await grab('E' + x), g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u }; })()');
    // (the logarithm's: inside H_u's image, outside which the frame is the bare paper, as its coverage checks, and the
    // colour plane's parked frame has its own colours)
    ends[x] = Object.assign({ restOk, still, g }, await sameAway('E' + x, 'E' + k, LOOK_TOL, c.cover ? '((K) => (x, y) => K(x, y) > 0)(__logSector())' : null));
    await rest(0);
  }
  r.ends = ends;
  for (const [x, k] of [[END_X, 0], [1 - END_X, 1]]) {
    const E = ends[x];
    ok(`${c.tag}: the glide's frame at x = ${x} is plane ${k}'s parked frame (away from the colour lines: at least ${MIN_SAME} pixels, at most ${SAME_FRAC * 100} % > ${LOOK_TOL}/255 apart)`, E.restOk && E.still && E.n >= MIN_SAME && E.over <= SAME_FRAC, E);
  }
  // ---- the same overlays a hair from each plane ----
  r.step = 'the same overlays';
  const over = {};
  for (const [x, k] of [[EDGE, 0], [1 - EDGE, 1]]) {
    await rest(k);
    const atRest = await overlays();
    const held = (await hold(x)).ok, moving = await overlays();
    over[x] = { held, rest: atRest, moving };
    await letGo();
  }
  r.over = over;
  for (const [x, k] of [[EDGE, 0], [1 - EDGE, 1]]) {
    const O = over[x], R = O.rest, M = O.moving;
    ok(`${c.tag}: a moving frame a hair from plane ${k} (x = ${x}) draws that plane's overlays: its graph paper draws, its dashed outlines and the colour plot's grid (rest, moving)`, O.held && !!R && !!M && R.grid === M.grid && R.dashed === M.dashed && (!R.colourGrid || M.colourGrid), O);
  }
  // ---- no fade at a glide's ends ----
  r.step = 'no fade';
  const fade = {};
  for (const [x, end] of [[FIRST, 'R0'], [1 - FIRST, 'R1']]) {
    const held = (await hold(x)).ok;
    // (a redraw of the held frame, its plots' opacities recorded)
    await ev('window.__plotAlphas = [], __cmwHideStrokes(false), 1');
    const still = await grab('F' + x);
    ok(`${c.tag}: the held frame at x = ${x} settles`, still, null);
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

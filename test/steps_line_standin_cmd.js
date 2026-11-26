// The outlines of plane z's shapes on a later plane while the chain's first programs link: a cold load with ?glhold
// (GLR.holdLinks keeps every chain program's link pending, the lines' tfLine among them), z² then z + 1, a disc and a
// circle on plane z, the steps view at rest on w₂. With no earlier version of the chain to stand in, the outlines are
// drawn from the map's CPU twin (the lines' stand-in, drawLines' st.cpu): at points along each shape's image on w₂, the
// frame drawn while the links are held is the frame drawn once they land (each point's pixel within 32 levels of one of
// the 3 x 3 pixels about it in the linked frame, at least 95 % of the points), each shape's made at the lines' own
// template size (8). The stand-in's CPU budget (CPU_LINE_MS, 25 ms) picks a smaller size when the first segments' time
// extrapolates past it, which a busy machine stretches, so this page sets the budget to 1e6 ms (?glline) and the size
// is the one the stand-in takes when it fits. An expensive series (about 2 ms an evaluation on the CI machines) gets
// none under the real budget: the lines are refused within the budget and a segment, as GLR.lineStandIns records.
// The globe (lineS) on the same chain, w₂ on the Sphere, the links held: its outlines are read as the pixels the
// shapes' strokes change (the frame against __cmwHideStrokes'), and while the links are held the linked frame's are
// drawn (at most GLOBE_MISS of them with none of the held frame's within 2 px), each a stand-in at the lines' template
// size.
// A command file for a CDP daemon; CI runs it in the views shard (ci/browser_shards.js). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const W = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'wait_kit.js'), 'utf8'))({ settled, ev, sleep, fails });
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const GLOBE_MISS = 0.05;   // the most of the linked globe's outline pixels the held frame may miss
const base = 'http://localhost:' + ((/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]);
await view(1280, 800, false, false);
const SHAPES = [{ kind: 'disc', c: [0.3, 0.2], r: 0.6, id: 's1' }, { kind: 'circle', c: [-0.5, -0.3], r: 0.4, id: 's2' }];
// (points on each shape's image on w₂: z on its boundary, w = z² + 1)
const pts = SHAPES.flatMap((s) => Array.from({ length: 48 }, (_, k) => {
  const a = 2 * Math.PI * (k + 0.5) / 48, x = s.c[0] + s.r * Math.cos(a), y = s.c[1] + s.r * Math.sin(a);
  return [x * x - y * y + 1, 2 * x * y];
}));
// (the meshing window the stand-ins are measured in, saved with the state: a thread saved on a later plane with no window is
// meshed in the settled pane's, which changes how many outlines are made and what each costs, and this suite reads the outlines)
const CLIP_WIN = { x0: -2.75, x1: 2.75, y0: -4.166666666666667, y1: 4.166666666666667 };
const ns = 'sls' + Date.now();
await seed(ns, { steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: 'z+1', cut: 180 }, on: true }], shapes: SHAPES, sv: { at: 2, T: 0, scope: 'all', surf: 'plane' }, clipWin: CLIP_WIN });
await go(`${base}/test.html?ns=${ns}&view=steps&glhold&glline=1e6`);
await settled({ max: 30000, panes: false, until: "typeof __cmwSteps === 'function' && !!window.GLR && GLR.ok" });
// (held: the frame pending on the lines' own program, read once two reads 300 ms apart agree: the regions' stand-in
// meshes are made in idle slices)
await settled({ panes: false });
const { reading: px1, agreed: still } = await W.still(async () => (await K.lpx(pts)).px, 300, 12000, true);
const held = { x: await ev('__cmwSteps().x'), pending: await ev('GLR.frameStatus().pending'), progs: await ev('GLR.chainProgs()'), px: px1, still, made: await ev('GLR.lineStandIns()') };
info.held = { x: held.x, still, pending: held.pending, tfLine: held.progs.includes('tfLine'), read: held.px.filter(Boolean).length };
ok('(held: at rest on w₂, the frame pending, the lines\' program among those held)', held.x === 2 && still && held.pending === true && info.held.tfLine && info.held.read >= 80, info.held);
await ev('GLR.holdLinks(false), 1');
const linked = await settled({ max: 30000 });
const rel = { pending: await ev('GLR.frameStatus().pending'), px: (await K.lpx(pts)).px };
info.linked = { wait: linked, pending: rel.pending };
ok('(released: the frame drawn by the chain\'s own programs)', linked.ok && rel.pending === false, info.linked);
info.outline = K.tally(held.px, rel.px, { tol: 32, note: (k) => ({ w: pts[k].map((v) => +v.toFixed(3)) }) });
ok('while the links are held: the outlines on w₂ are the linked frame\'s (at least 95 % of the points within 32 levels)', info.outline.n >= 80 && info.outline.wrong <= 0.05 * info.outline.n, info.outline);
info.made = held.made;
ok('while the links are held: each shape\'s outline is a stand-in at the lines\' template size (8)', held.made.length === SHAPES.length && held.made.every((r) => r.m === 8), info.made);
ok('timing: each outline\'s stand-in takes at most the real budget here (25 ms; the page\'s own budget is set)', held.made.length === SHAPES.length && held.made.every((r) => r.ms <= 25), info.made);
// the globe: the pixels the shapes' strokes change in the frame (against the frame with them hidden), as indices
const globeStrokes = async (tag) => {
  for (const hide of [false, true]) { await ev(`__cmwHideStrokes(${hide}), 1`); await settled({ panes: false }); await grab(tag + (hide ? '0' : '')); }
  await ev('__cmwHideStrokes(false), 1');
  return ev(`(() => { const K = window.__heldPx, D = K[${JSON.stringify(tag)}], D0 = K[${JSON.stringify(tag + '0')}], W = document.getElementById('canvasL').width, idx = [];
    for (let i = 0; i < D.length; i += 4) if (Math.abs(D[i] - D0[i]) + Math.abs(D[i + 1] - D0[i + 1]) + Math.abs(D[i + 2] - D0[i + 2]) > 60) idx.push(i / 4);
    return { W, idx }; })()`);
};
// (the share of a's pixels with none of b's within 2 px)
const missOf = (a, b) => {
  const set = new Set(b.idx);
  let n = 0;
  for (const j of a.idx) {
    const x = j % a.W, y = (j - x) / a.W;
    let f = false;
    for (let dy = -2; dy <= 2 && !f; dy++) for (let dx = -2; dx <= 2 && !f; dx++) if (set.has((y + dy) * a.W + x + dx)) f = true;
    if (!f) n++;
  }
  return a.idx.length ? n / a.idx.length : 1;
};
{
  const nsg = 'slg' + Date.now();
  await seed(nsg, { steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: 'z+1', cut: 180 }, on: true }], shapes: SHAPES, sv: { at: 2, T: 0, scope: 'all', surf: 'sphere' }, clipWin: CLIP_WIN });
  await go(`${base}/test.html?ns=${nsg}&view=steps&glhold&glline=1e6`);
  await settled({ max: 30000, panes: false, until: "typeof __cmwSteps === 'function' && !!window.GLR && GLR.ok" });
  await settled({ panes: false });
  const g = { surf: await ev('__cmwSteps().surf'), x: await ev('__cmwSteps().x'), pending: await ev('GLR.frameStatus().pending'), tfLine: (await ev('GLR.chainProgs()')).includes('tfLine') };
  const heldG = await globeStrokes('GH'), madeG = await ev('GLR.lineStandIns()');
  ok('(the globe held: at rest on w₂ on the Sphere, the frame pending, the lines\' program among those held)', g.surf === 'sphere' && g.x === 2 && g.pending === true && g.tfLine, g);
  await ev('GLR.holdLinks(false), 1');
  const linkedG = await settled({ max: 30000 });
  const relG = await globeStrokes('GL');
  info.globe = Object.assign(g, { linked: linkedG.ok, heldPx: heldG.idx.length, linkedPx: relG.idx.length, missing: missOf(relG, heldG), made: madeG });
  ok(`the globe, while the links are held: its outlines are the linked frame's (at most ${GLOBE_MISS} of their pixels missing)`, linkedG.ok && relG.idx.length >= 1000 && info.globe.missing <= GLOBE_MISS, info.globe);
  ok('the globe, while the links are held: each shape\'s outline is a stand-in at the lines\' template size (8)', madeG.length === SHAPES.length && madeG.every((r) => r.m === 8), madeG);
}
// an expensive series: its stand-in is refused (the first segment's evaluations show it would not fit), not made
const ns2 = 'slx' + Date.now();
await seed(ns2, { steps: [{ type: 'custom', params: { expr: '\\sum_{n=1}^{10000} \\frac{z^n}{n}', cut: 180 }, on: true }], shapes: SHAPES, sv: { at: 1, T: 0, scope: 'all', surf: 'plane' }, clipWin: CLIP_WIN });
await go(`${base}/test.html?ns=${ns2}&view=steps&glhold`);
await settled({ max: 30000, panes: false, until: "typeof __cmwSteps === 'function' && !!window.GLR && GLR.ok" });
const exWait = await settled({ only: true, max: 30000, until: `GLR.lineStandIns().length >= ${SHAPES.length}` });
info.expensive = { wait: exWait, x: await ev('__cmwSteps().x'), made: await ev('GLR.lineStandIns()') };
ok('an expensive series: no stand-in, each outline refused', exWait.ok && info.expensive.x === 1 && info.expensive.made.length === SHAPES.length && info.expensive.made.every((r) => r.m === 0), info.expensive);
// (the probe: the first CPU_LINE_PROBE segments, each at the template size M, 2M + 1 evaluations: the refusal comes at the
// latest there, however fast the machine runs, so the evaluations made are bounded without a clock)
const PROBE_EVALS = 8 * (2 * 8 + 1);
ok('an expensive series: each outline is refused within the probe\'s evaluations (' + PROBE_EVALS + '), whatever the machine\'s speed', info.expensive.made.length === SHAPES.length && info.expensive.made.every((r) => r.m === 0 && r.ev > 0 && r.ev <= PROBE_EVALS), info.expensive);
ok('timing: an expensive series\' outlines are refused within the budget and a segment (60 ms)', info.expensive.made.length === SHAPES.length && info.expensive.made.every((r) => r.ms <= 60), info.expensive);
await ev('GLR.holdLinks(false), 1');
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, fails, info };

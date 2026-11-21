// The steps view's All-at-once glide (map mode 3) on the globe, drawn per pixel by the inverse pass (#1742, after
// steps_all_exact_cmd.js on the plane): each step of the span at its own time (invSpanPath through svGlobeCarryInv).
//  - on [f, 1 z] (the second step the identity at every t), the globe's All-at-once frame at u is the globe's
//    step-at-a-time frame of [f] at the same u, pixel for pixel within DIFF_TOL on all but SAME_MAX of the pane, for f = z³
//    and eᶻ (colour from z, Everywhere); both frames are the inverse pass's;
//  - Cayley, then z³: the frames past u = 0.3 and 0.6 are the inverse pass's, all at once;
//  - a span with a step whose homotopy is inverted by Newton's method ([inverse Joukowski, 1 z]: its NEWT op) keeps the
//    carried mesh; [cos, 1 z], whose homotopy has an exact inverse (cos's zoom path), is the inverse pass's on the globe.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { grab, keep, compareKept, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const EXP = { type: 'exp', params: {}, on: true }, POW = (n) => ({ type: 'pown', params: { n }, on: true }), SIN = { type: 'sin', params: {}, on: true };
const CAYLEY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, MOB_STRIP = { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true };
const MUL = (c) => ({ type: 'mul', params: { c }, on: true });
// [f, 1 z] against [f]
const SAME = [{ name: 'z³', f: POW(3), s: 80 }, { name: 'eᶻ', f: EXP, s: 80 }, { name: 'sin z', f: SIN, s: 80 }];
const SAME_U = [0.3, 0.7];
const SAME_MAX = 0.002;            // the share of the pane the two frames may differ in by more than DIFF_TOL
// composed spans
const CHAINS = [
  { name: 'Strip to disk (eᶻ, then (z − 1)/(z + 1))', steps: [EXP, MOB_STRIP], s: 52 },
  { name: 'Cayley, then z³', steps: [CAYLEY, POW(3)], s: 90, arrive: false },
  { name: '1.2 z, then Joukowski', steps: [MUL('1.2'), { type: 'joukowski', params: {}, on: true }], s: 80 },
];
const AT_U = [0.3, 0.6], NEAR_END = 0.985;
const ARRIVE_MAX = 0.005;          // the share of the pane the last frame may differ from the plane at rest in
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;   // the glide's time a frame while it runs, and once frozen
const START_WAIT = 30000, GLIDE_WAIT = 180000, DRAWN_WAIT = 120000;   // ms
// (frames the held glide is given to move in, at GLIDE_CLOCK_MS each: past HELD_X it would have moved; it starts at 0)
const HOLD_FRAMES = 60, HELD_X = 0.05;
await view(1200, 800, false, false);
const drawn = `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()`;
// the frame's state, and how the globe drew its colour (__cmwSvGlobe: 'inverse' or 'mesh')
const rec = () => ev('(() => { const q = __cmwSteps(), g = __cmwSvGlobe(0, 0); return { x: q.x, all: q.all, mode: q.between && q.between.mode, surf: q.surf, globe: { path: g.path, u: g.u } }; })()');
const open = async (steps, s, homAll, query = '') => {
  const ns = 'svae' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s }, homAll };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps${query}`);
  await settled({ max: START_WAIT, panes: !query, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')` });
  await adopted();
  await ev(`__cmwSet('alpha', 1), __cmwSet('morphPaths', false), 1`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'sphere', go: 0, now: true })`); await settled({});
  await ev('__cmwSteps({ T: 0 })'); await settled({});
  return ev('__cmwSteps().planes.length - 1');
};
// at rest on plane i, its frame drawn
const rest = async (i) => { await ev(`__cmwSteps({ clock: 0 }), __cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: DRAWN_WAIT, until: `!__cmwSteps().moving && __cmwSvFixed() && ${drawn}` }); };
// the All-at-once glide from plane z to plane n frozen once the thread is past x
const frozenPast = async (n, x) => {
  await rest(0);
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev(`__cmwSteps({ go: ${n} })`);
  await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${x}`, only: true });
  await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
  await settled({ max: DRAWN_WAIT, until: drawn });
  return rec();
};
for (const c of SAME.filter((q) => q.name !== 'sin z')) for (const u of SAME_U) {
  const tag = `${c.name}, u ${u}`;
  await open([c.f, MUL('1')], c.s, true);
  const g = await frozenPast(2, 2 * u);
  ok(`${tag}: [f, 1 z] all at once on the globe: a frame between the planes, the inverse pass's`, g.all && g.mode === 3 && g.surf === 'sphere' && g.globe.path === 'inverse', g);
  ok(`${tag}: the All-at-once frame settles`, await grab('A'), null);
  await keep('A');
  const at = g.x / 2;
  await open([c.f], c.s, false);
  await ev(`__cmwSteps({ x: ${at} }), 1`);
  await settled({ max: DRAWN_WAIT, until: `Math.abs(__cmwSteps().x - ${at}) < 1e-12 && ${drawn}` });
  const h = await rec();
  ok(`${tag}: [f] a step at a time on the globe at the same u: the inverse pass's frame`, h.mode === 1 && h.surf === 'sphere' && h.globe.path === 'inverse' && Math.abs(h.globe.u - at) < 1e-9, h);
  ok(`${tag}: the step-at-a-time frame settles`, await grab('B'), null);
  await keep('B');
  const d = compareKept('A', 'B');
  info[tag] = { g, h, d };
  ok(`${tag}: the two globes are one picture (at most ${SAME_MAX * 100} % of the pane apart)`, !!d && d.shown[0] && d.shown[1] && d.frac <= SAME_MAX, d);
}
{
  const c = CHAINS[1];
  const n = await open(c.steps, c.s, true);
  for (const u of AT_U) {
    const g = await frozenPast(n, u * n);
    info[`${c.name} u ${u}`] = g;
    ok(`${c.name} u ${u}: a globe frame between the planes, all at once, the inverse pass's`, g.all && g.mode === 3 && g.globe.path === 'inverse', g);
  }
}
{
  const n = await open([{ type: 'ijouk', params: {}, on: true }, MUL('1')], 80, true);
  const g = await frozenPast(n, 0.5 * n);
  info.newt = g;
  ok('[inverse Joukowski, 1 z] on the globe: a frame between the planes, all at once, the carried mesh draws it', g.all && g.mode === 3 && g.globe.path === 'mesh', g);
}
// a span whose step has an exact inverse homotopy (cos's zoom path) is the inverse pass's on the globe too
{
  const n = await open([{ type: 'cos', params: {}, on: true }, MUL('1')], 80, true);
  const g = await frozenPast(n, 0.5 * n);
  info.cos = g;
  ok('[cos, 1 z] on the globe: a frame between the planes, all at once, the inverse pass draws it', g.all && g.mode === 3 && g.globe.path === 'inverse', g);
}
// an All-at-once glide the globe's inverse pass draws waits while that pass's programs link, not only while a carried
// mesh does: loaded with every link held (?glhold), then only the plane's colour program held (the globe draws none: the
// carried meshes link, and the inverse pass is not started while a forward program of the chain links), the glide
// pressed on the test clock with the Play gate off stays where it was; let go, it runs and its frame is the inverse pass's
{
  const c = CHAINS[1];
  const n = await open(c.steps, c.s, true, '&glhold');
  await ev('__cmwSteps({ gate: false }), GLR.holdLinks(true, ["color"]), 1');
  const linked = await settled({ max: DRAWN_WAIT, panes: false, only: true, until: 'GLR.pending().length > 0 && GLR.pending().every((p) => /^color\\|/.test(p.id))' });
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} }), __cmwSteps({ go: ${n} }), 1`);
  await ev('(async () => { for (let i = 0; i < HOLD_FRAMES; i++) await new Promise((r) => requestAnimationFrame(r)); return 1; })()'.replace('HOLD_FRAMES', String(HOLD_FRAMES)));
  const held = info['inverse links held'] = Object.assign(await rec(), { linked: linked.ok, pending: await ev('GLR.pending().map((p) => p.id.split("|")[0])') });
  ok('All at once on the globe, the inverse pass waiting on the colour program (the carried meshes linked): the glide holds on plane z', held.linked && held.x < HELD_X, held);
  await ev('GLR.holdLinks(false), 1');
  const ran = await settled({ max: GLIDE_WAIT, panes: false, only: true, until: `__cmwSteps().x > ${0.5 * n}` });
  const g = info['inverse links let go'] = Object.assign(await rec(), { ran: ran.ok });
  ok('the links let go: the glide runs, and its frame is the inverse pass\'s', g.ran && g.all && g.globe.path === 'inverse', g);
  await ev('__cmwSteps({ clock: 0, gate: true }), 1');
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };

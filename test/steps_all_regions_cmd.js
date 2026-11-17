// The steps view's All-at-once glide (map mode 3) with regions of later planes, drawn per pixel by the inverse pass (#1742,
// after steps_all_exact_cmd.js): a region of plane k is tested in the pass on its own plane at rest (it holds the points z
// whose F_{0->k}(z) it holds), and the span's map moves them, as in a step-at-a-time glide.
//  - on [f, 1 z] with a disc on plane 2 (the second step the identity at every t), the All-at-once frame at u is the
//    step-at-a-time frame of [f] with the same disc on plane 1 at the same u, Inside regions and Everywhere, pixel for pixel
//    within DIFF_TOL on all but SAME_MAX of the pane, for f = z³ and eᶻ; both frames are the inverse pass's;
//  - Inside regions on Strip to disk with a disc on its last plane: the frames past u = 0.3 and 0.6 are the inverse pass's,
//    All at once, and the frame just short of the last plane is the plane at rest on all but ARRIVE_MAX of the pane.
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
await view(1200, 800, false, false);
const drawn = `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()`;
const rec = () => ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, mode: q.between && q.between.mode, rec: q.glide && { all: q.glide.all, u: q.glide.u, path: q.glide.path, reason: q.glide.reason } }; })()');
const open = async (steps, s, homAll, shapes = [], scope = 'all') => {
  const ns = 'svae' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s }, homAll };
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')` });
  await adopted();
  await ev(`__cmwSet('alpha', 1), __cmwSet('morphPaths', false), 1`);
  await ev(`__cmwSteps({ scope: '${scope}', surf: 'plane', go: 0, now: true })`); await settled({});
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
const DISC = (stage) => ({ id: 'd' + stage, kind: 'disc', c: [0.3, 0.2], r: 0.6, stage, ci: 1, visible: true });
for (const c of SAME.filter((q) => q.name !== 'sin z')) for (const scope of ['in', 'all']) for (const u of SAME_U) {
  const tag = `${c.name}, ${scope === 'in' ? 'Inside regions' : 'Everywhere'}, u ${u}`;
  await open([c.f, MUL('1')], c.s, true, [DISC(2)], scope);
  const g = await frozenPast(2, 2 * u);
  ok(`${tag}: [f, 1 z] all at once with a disc on plane 2: a frame between the planes, the inverse pass's`, g.all && g.mode === 3 && !!g.rec && g.rec.all && g.rec.path === 'inverse', g);
  ok(`${tag}: the All-at-once frame settles`, await grab('A'), null);
  await keep('A');
  const at = g.x / 2;
  await open([c.f], c.s, false, [DISC(1)], scope);
  await ev(`__cmwSteps({ x: ${at} }), 1`);
  await settled({ max: DRAWN_WAIT, until: `Math.abs(__cmwSteps().x - ${at}) < 1e-12 && ${drawn}` });
  const h = await rec();
  ok(`${tag}: [f] with the disc on plane 1, a step at a time at the same u: the inverse pass's frame`, h.mode === 1 && !!h.rec && h.rec.path === 'inverse' && Math.abs(h.rec.u - at) < 1e-9, h);
  ok(`${tag}: the step-at-a-time frame settles`, await grab('B'), null);
  await keep('B');
  const d = compareKept('A', 'B');
  info[tag] = { g, h, d };
  ok(`${tag}: the two frames are one picture (at most ${SAME_MAX * 100} % of the pane apart)`, !!d && d.shown[0] && d.shown[1] && d.frac <= SAME_MAX, d);
}
{
  const c = CHAINS[0], name = `${c.name}, Inside regions, a disc on its last plane`;
  const n = await open(c.steps, c.s, true, [Object.assign(DISC(2), { c: [0.2, 0.1], r: 0.5 })], 'in');
  await rest(n);
  ok(`${name}: the last plane's frame at rest settles`, await grab('RN'), null);
  for (const u of AT_U) {
    const g = await frozenPast(n, u * n);
    info[`${name} u ${u}`] = g;
    ok(`${name} u ${u}: a frame between the planes, all at once, the inverse pass's`, g.all && g.mode === 3 && !!g.rec && g.rec.all && g.rec.path === 'inverse', g);
  }
  const g = await frozenPast(n, NEAR_END * n);
  ok(`${name}: the frame short of the last plane settles`, await grab('E'), null);
  const d = await compare('E', 'RN');
  info[`${name} arrive`] = { g, d };
  ok(`${name}: the frame short of the last plane is the inverse pass's`, g.all && g.mode === 3 && !!g.rec && g.rec.path === 'inverse', g);
  ok(`${name}: it is the plane at rest (at most ${ARRIVE_MAX * 100} % of the pane apart)`, !!d && d.frac <= ARRIVE_MAX, d);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };

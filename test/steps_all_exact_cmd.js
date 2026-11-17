// The steps view's All-at-once glide (S.homAll, map mode 3) drawn per pixel by the inverse pass (#1742): each step of the
// span stands for its homotopy at its own time (invSpanPath), as a step-at-a-time glide's frame stands for its one step's
// (invHomPath), so a frame between the planes is the inverse pass's picture of the span's map at u.
//  - the span composes as one step does: on [f, 1 z] (the second step the identity at every t) the All-at-once frame at u
//    is the step-at-a-time frame of [f] at the same u, pixel for pixel within DIFF_TOL on all but SAME_MAX of the pane,
//    for f = z³, eᶻ and sin z (colour from z, Everywhere); both frames are the inverse pass's;
//  - composed spans (Strip to disk; Cayley, then z³; 1.2 z, then Joukowski): the frames past u = 0.3 and 0.6 are the
//    inverse pass's, All at once, and the frame just short of the last plane is the plane at rest on all but ARRIVE_MAX of
//    the pane (no pop when it lands); not for z³ last, whose homotopy z^(1 + 2t) still differs from z³ in a wedge by its
//    cut there (3.2 % of the pane at u = 0.9945 a step at a time, as all at once);
//  - a span with a step whose homotopy is inverted by Newton's method ([cos, 1 z]) keeps the carried meshes, with the reason.
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
const open = async (steps, s, homAll) => {
  const ns = 'svae' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s }, homAll };
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')` });
  await adopted();
  await ev(`__cmwSet('alpha', 1), __cmwSet('morphPaths', false), 1`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true })`); await settled({});
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
// ---- [f, 1 z] all at once against [f] a step at a time, at the same u ----
for (const c of SAME) for (const u of SAME_U) {
  const tag = `${c.name}, u ${u}`;
  await open([c.f, MUL('1')], c.s, true);
  const g = await frozenPast(2, 2 * u);
  ok(`${tag}: [f, 1 z] all at once: a frame between the planes, the inverse pass's`, g.all && g.mode === 3 && !!g.rec && g.rec.all && g.rec.path === 'inverse', g);
  ok(`${tag}: the All-at-once frame settles`, await grab('A'), null);
  await keep('A');
  // (the span's progress is x / 2; step 1 runs at that time, step 2 is the identity)
  const at = g.x / 2;
  await open([c.f], c.s, false);
  await ev(`__cmwSteps({ x: ${at} }), 1`);
  await settled({ max: DRAWN_WAIT, until: `Math.abs(__cmwSteps().x - ${at}) < 1e-12 && ${drawn}` });
  const h = await rec();
  ok(`${tag}: [f] a step at a time at the same u: the inverse pass's frame`, h.mode === 1 && !!h.rec && h.rec.path === 'inverse' && Math.abs(h.rec.u - at) < 1e-9, h);
  ok(`${tag}: the step-at-a-time frame settles`, await grab('B'), null);
  await keep('B');
  const d = compareKept('A', 'B');
  info[tag] = { g, h, d };
  ok(`${tag}: the two frames are one picture (at most ${SAME_MAX * 100} % of the pane apart)`, !!d && d.shown[0] && d.shown[1] && d.frac <= SAME_MAX, d);
}
// ---- composed spans ----
for (const c of CHAINS) {
  const n = await open(c.steps, c.s, true);
  await rest(n);
  ok(`${c.name}: the last plane's frame at rest settles`, await grab('RN'), null);
  for (const u of AT_U) {
    const g = await frozenPast(n, u * n);
    info[`${c.name} u ${u}`] = g;
    ok(`${c.name} u ${u}: a frame between the planes, all at once, the inverse pass's`, g.all && g.mode === 3 && !!g.rec && g.rec.all && g.rec.path === 'inverse', g);
  }
  if (c.arrive === false) continue;
  const g = await frozenPast(n, NEAR_END * n);
  ok(`${c.name}: the frame short of the last plane settles`, await grab('E'), null);
  const d = await compare('E', 'RN');
  info[`${c.name} arrive`] = { g, d };
  ok(`${c.name}: the frame short of the last plane is the inverse pass's`, g.all && g.mode === 3 && !!g.rec && g.rec.path === 'inverse', g);
  ok(`${c.name}: it is the plane at rest (at most ${ARRIVE_MAX * 100} % of the pane apart)`, !!d && d.frac <= ARRIVE_MAX, d);
}
// a span with a step inverted by Newton's method keeps the carried meshes, and says why
{
  const n = await open([{ type: 'cos', params: {}, on: true }, MUL('1')], 80, true);
  const g = await frozenPast(n, 0.5 * n);
  info.newt = g;
  ok('[cos, 1 z]: a frame between the planes, all at once', g.all && g.mode === 3, g);
  ok("[cos, 1 z]: the carried meshes draw it, the reason naming Newton's method", !!g.rec && g.rec.path === 'mesh' && /Newton/.test(g.rec.reason || ''), g.rec);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };

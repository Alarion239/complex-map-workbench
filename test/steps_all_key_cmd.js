// The steps view's All-at-once glide (S.homAll, map mode 3) keys its carried meshes' sheets by the span's last plane, so
// its frames put in front the sheet the inverse pass shows where the glide lands (#1771). On [1.2 z, Joukowski], colour
// from z, Everywhere: Joukowski's two sheets over a point w are z and 1/z, and the key's pole at z = 0 (plane w₂'s) puts the
// outer one in front. Keyed by the span's first plane, which has no pole, the inner sheet, nearer the window's centre, is
// in front of every frame, and the glide's last frame and the plane it lands on differ over three quarters of the pane.
//  - the glide frozen just short of w₂ is a frame between the planes, all at once (mode 3), drawn by the carried meshes;
//  - that frame and the frame at rest on w₂ (the inverse pass) differ in at most ARRIVE_MAX of the pane;
//  - control: a frame early in the glide (x near EARLY_X) differs from the rest frame in more than EARLY_MIN of the
//    pane, so the comparison can fail.
// Downward, on [Joukowski, 1.2 z, Cayley, z³] from w₄ to w₁ (#1742), at the phone's DOWN_VIEW, where the sheet the frame
// puts in front covers most of the pane: the span's key at u has to meet plane w₁'s at rest as u -> 0, as it meets plane
// w₄'s as u -> 1. The Cayley homotopy's pole, pulled back through Joukowski, sits beside Joukowski's own pole at 0 for
// every t > 0, so a key made of the span's points alone keeps two penalties there to the end, and its seam lies on
// another ellipse than w₁'s (36 % of the pane apart).
//  - the glide frozen just short of w₁ (x below DOWN_FINE_X) is a frame between the planes, all at once;
//  - it and the frame at rest on w₁ differ in at most ARRIVE_MAX of the pane.
// The downward frames come to w₁'s as x - 1 does (lavapipe, 360 × 640: 1.4 % of the pane at x 1.012, 0.8 % at 1.0056),
// so the glide runs on to DOWN_NEAR_X at GLIDE_CLOCK_MS a frame (where a frame moves x by about 0.01) and from there to
// DOWN_FINE_X at FINE_CLOCK_MS (about 0.0006 a frame): the frame it freezes on lies in a band of x a few of those wide,
// whatever the frame rate.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const JOUK = { type: 'joukowski', params: {}, on: true };
const STEPS = [{ type: 'mul', params: { c: '1.2' }, on: true }, JOUK];
const CH_TOL = 40;                 // a pixel differs when a channel differs by more than this (0..255)
const ARRIVE_MAX = 0.02;           // the share of the pane the last frame may differ from the rest frame in (measured 0.2 %)
const EARLY_X = 0.5, EARLY_MIN = 0.2;   // the control's frame, and the share of the pane it differs from the rest frame in, at least
const NEAR_END_X = 1.97;           // the glide is frozen once the thread is past this, short of plane 2
const DOWN = [JOUK, { type: 'mul', params: { c: '1.2' }, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }];
const DOWN_NEAR_X = 1.06;          // the downward glide slows to FINE_CLOCK_MS once the thread is below this
const DOWN_FINE_X = 1.006;         // and is frozen once it is below this, short of plane 1
const FINE_CLOCK_MS = 2;
const DOWN_VIEW = [360, 640];      // the phone's view, where the downward glide's arrival was measured (#1788)
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;
const START_WAIT = 30000, GLIDE_WAIT = 180000, DRAWN_WAIT = 120000;
await view(1200, 800, false, false);
const drawn = `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()`;
// the left pane's colour layer alone: the pane less CROP_SIDE at each side (its border), CROP_HEAD below its head (the
// chips over the plane: the scale and the status) and CROP_FOOT above its foot (the view buttons), px
const CROP_SIDE = 8, CROP_HEAD = 70, CROP_FOOT = 40;
const paneRect = () => ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + ${CROP_HEAD} : r.top; return { x: Math.round(r.left) + ${CROP_SIDE}, y: Math.round(t), width: Math.round(r.width) - 2 * ${CROP_SIDE}, height: Math.round(r.bottom - t - ${CROP_FOOT}) }; })()`);
// (the glide's formula tile, #1533, a chip over the plane while the thread is between planes, hidden: the frames compared
// are the colour layer's)
const tileHidden = (on) => ev(`(() => { let s = document.getElementById('qaNoTile'); if (!s) { s = document.createElement('style'); s.id = 'qaNoTile'; document.head.append(s); } s.textContent = ${on} ? '#svTile{visibility:hidden!important}' : ''; return 1; })()`);
const grab = async () => { await ev('__cmwSteps({ bare: true })'); await tileHidden(true); await settled({}); const i = await img(await paneRect()); await tileHidden(false); await ev('__cmwSteps({ bare: false })'); return i; };
// (the share of the pixels whose largest channel difference is over CH_TOL: a screenshot decodes to RGB or RGBA (png.js's
// ch), which test/lib/pixel_diff.js's RGBA compare does not read)
const share = (a, b) => { let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.max(Math.abs(a.data[j] - b.data[j]), Math.abs(a.data[j + 1] - b.data[j + 1]), Math.abs(a.data[j + 2] - b.data[j + 2])) > CH_TOL) n++; return n / (a.w * a.h); };
const open = async (steps = STEPS) => {
  const ns = 'svak' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 }, homAll: true };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')` });
  await adopted();
  await ev(`__cmwSet('alpha', 1), __cmwSet('morphPaths', false), 1`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true })`); await settled({});
  await ev('__cmwSteps({ T: 0 })'); await settled({});
};
// the glide to plane `to` (w₂ by default), frozen once the thread is past x (below x when it glides down)
// (fine: a second x, past x, the glide goes on to at FINE_CLOCK_MS a frame before it is frozen)
const frozenPast = async (x, to = 2, down = false, fine = null) => {
  const past = (v) => `__cmwSteps().x ${down ? '<' : '>'} ${v}`;
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev(`__cmwSteps({ go: ${to} })`);
  await settled({ max: GLIDE_WAIT, until: past(x), only: true });
  if (fine != null) { await ev(`__cmwSteps({ clock: ${FINE_CLOCK_MS} })`); await settled({ max: GLIDE_WAIT, until: past(fine), only: true }); }
  await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
  await settled({ max: DRAWN_WAIT, until: drawn });
  return ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, mode: q.between && q.between.mode }; })()');
};
// at rest on plane i (w₂ by default), its frame drawn
const restOn = async (i = 2) => {
  await ev(`__cmwSteps({ clock: 0 })`); await ev(`__cmwSteps({ go: ${i}, now: true })`);
  await settled({ max: START_WAIT, until: '!__cmwSteps().moving && __cmwSvFixed()' });
  await settled({ max: DRAWN_WAIT, until: `__cmwSvFixed() && ${drawn}` });
  return ev('__cmwSteps().rest');
};
await open();
const g = await frozenPast(NEAR_END_X);
info.last = g;
ok('the glide is frozen short of w₂, all at once (map mode 3)', g.all && g.mode === 3 && g.x > NEAR_END_X && g.x < 2, g);
const last = await grab();
const rest = await restOn();
info.rest = rest;
ok('at rest on w₂ the inverse pass draws the plane', !!rest && rest.a === 2 && rest.path === 'inverse', rest);
const R = await grab();
info.arrive = share(last, R);
ok(`the glide's last frame is the plane it lands on (at most ${ARRIVE_MAX * 100} % of the pane differs)`, info.arrive <= ARRIVE_MAX, info.arrive);
// control: early in the glide the picture is another
await open();
const e = await frozenPast(EARLY_X);
info.early = Object.assign({ share: share(await grab(), R) }, e);
ok(`control: a frame early in the glide differs from w₂'s in over ${EARLY_MIN * 100} % of the pane`, e.all && e.mode === 3 && info.early.share > EARLY_MIN, info.early);
// downward: from w₄ to w₁, at the phone's view
{
  await view(DOWN_VIEW[0], DOWN_VIEW[1], false, true);
  await open(DOWN);
  await restOn(4);
  const d = await frozenPast(DOWN_NEAR_X, 1, true, DOWN_FINE_X);
  info.down = d;
  ok('down: the glide from w₄ is frozen short of w₁, all at once (map mode 3)', d.all && d.mode === 3 && d.x < DOWN_FINE_X && d.x > 1, d);
  const dl = await grab();
  const r1 = await restOn(1);
  ok('down: at rest on w₁ the inverse pass draws the plane', !!r1 && r1.a === 1 && r1.path === 'inverse', r1);
  info.downArrive = share(dl, await grab());
  ok(`down: the glide's last frame is w₁, the plane it lands on (at most ${ARRIVE_MAX * 100} % of the pane differs)`, info.downArrive <= ARRIVE_MAX, info.downArrive);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };

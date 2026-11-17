// The steps view's All-at-once glide (S.homAll, map mode 3) keys its carried meshes' sheets by the span's last plane, so
// its frames put in front the sheet the inverse pass shows where the glide lands (#1771). On [1.2 z, Joukowski], colour
// from z, Everywhere: Joukowski's two sheets over a point w are z and 1/z, and the key's pole at z = 0 (plane w₂'s) puts the
// outer one in front. Keyed by the span's first plane, which has no pole, the inner sheet, nearer the window's centre, is
// in front of every frame, and the glide's last frame and the plane it lands on differ over three quarters of the pane.
//  - the glide frozen just short of w₂ is a frame between the planes, all at once (mode 3), drawn by the carried meshes;
//  - that frame and the frame at rest on w₂ (the inverse pass) differ in at most ARRIVE_MAX of the pane;
//  - control: a frame early in the glide (x near EARLY_X) differs from the rest frame in more than EARLY_MIN of the
//    pane, so the comparison can fail.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const STEPS = [{ type: 'mul', params: { c: '1.2' }, on: true }, { type: 'joukowski', params: {}, on: true }];
const CH_TOL = 40;                 // a pixel differs when a channel differs by more than this (0..255)
const ARRIVE_MAX = 0.02;           // the share of the pane the last frame may differ from the rest frame in (measured 0.2 %)
const EARLY_X = 0.5, EARLY_MIN = 0.2;   // the control's frame, and the share of the pane it differs from the rest frame in, at least
const NEAR_END_X = 1.97;           // the glide is frozen once the thread is past this, short of plane 2
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;
const START_WAIT = 30000, GLIDE_WAIT = 180000, DRAWN_WAIT = 120000;
await view(1200, 800, false, false);
const drawn = `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()`;
// the left pane's colour layer alone: the pane less CROP_SIDE at each side (its border), CROP_HEAD below its head (the
// chips over the plane: the scale and the status) and CROP_FOOT above its foot (the view buttons), px
const CROP_SIDE = 8, CROP_HEAD = 70, CROP_FOOT = 40;
const paneRect = () => ev(`(() => { const r = document.getElementById('paneL').getBoundingClientRect(); const h = document.querySelector('#paneL .pane-head'); const t = h ? h.getBoundingClientRect().bottom + ${CROP_HEAD} : r.top; return { x: Math.round(r.left) + ${CROP_SIDE}, y: Math.round(t), width: Math.round(r.width) - 2 * ${CROP_SIDE}, height: Math.round(r.bottom - t - ${CROP_FOOT}) }; })()`);
const grab = async () => { await ev('__cmwSteps({ bare: true })'); await settled({}); const i = await img(await paneRect()); await ev('__cmwSteps({ bare: false })'); return i; };
// (the share of the pixels whose largest channel difference is over CH_TOL: a screenshot decodes to RGB or RGBA (png.js's
// ch), which test/lib/pixel_diff.js's RGBA compare does not read)
const share = (a, b) => { let n = 0; for (let j = 0; j < a.data.length; j += a.ch) if (Math.max(Math.abs(a.data[j] - b.data[j]), Math.abs(a.data[j + 1] - b.data[j + 1]), Math.abs(a.data[j + 2] - b.data[j + 2])) > CH_TOL) n++; return n / (a.w * a.h); };
const open = async () => {
  const ns = 'svak' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], steps: STEPS, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 }, homAll: true };
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')` });
  await adopted();
  await ev(`__cmwSet('alpha', 1), __cmwSet('morphPaths', false), 1`);
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true })`); await settled({});
  await ev('__cmwSteps({ T: 0 })'); await settled({});
};
// the glide from z to w₂, frozen once the thread is past x
const frozenPast = async (x) => {
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev('__cmwSteps({ go: 2 })');
  await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${x}`, only: true });
  await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
  await settled({ max: DRAWN_WAIT, until: drawn });
  return ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, mode: q.between && q.between.mode }; })()');
};
const restOnW2 = async () => {
  await ev(`__cmwSteps({ clock: 0 })`); await ev('__cmwSteps({ go: 2, now: true })');
  await settled({ max: START_WAIT, until: '!__cmwSteps().moving && __cmwSvFixed()' });
  await settled({ max: DRAWN_WAIT, until: `__cmwSvFixed() && ${drawn}` });
  return ev('__cmwSteps().rest');
};
await open();
const g = await frozenPast(NEAR_END_X);
info.last = g;
ok('the glide is frozen short of w₂, all at once (map mode 3)', g.all && g.mode === 3 && g.x > NEAR_END_X && g.x < 2, g);
const last = await grab();
const rest = await restOnW2();
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
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };

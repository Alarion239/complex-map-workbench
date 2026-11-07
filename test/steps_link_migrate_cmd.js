// Classic-era saves and links open in the steps view: a state written by the classic view (its legacy fields
// rightMode, sphereMode, leftSphere, material and solo; the U-b `view`; a deformation range and the Deformation's time
// figMorph; a right pane's camera rightView) opens in the steps view on its equivalent (Views.svOf through svAdopt), and
// the links that carry such a state open the same way: #cmw=0. (plain JSON), #cmw=1. (deflate-raw), and a hash with cmw
// after another part. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info, errs }.
// (the classic view's own picture is not tested here: this suite proves that the steps view shows the same thing)
const zlib = process.mainModule.require('zlib');
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {}, errs = [];
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the steps view's state as the test hooks read it: the place (x, T), the colour plane's scope and surface, the chain's planes,
// the selected step, the deformation range and whether the deformation is open
const READ = `(() => { const s = __cmwSteps(), c = __cmwState(); return { on: s.on, x: s.x, T: s.T, scope: s.scope, surf: s.surf, planes: s.planes, sel: s.sel, homRange: s.homRange, range: s.range, solo: s.solo, main: s.main, view: c.view, morphOpen: c.morph.open }; })()`;
const READY = "typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving";
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const openAt = async (url) => { await go(url); await settled({ max: 30000, until: READY }); };
// A link or a scene opens in a second load: openFigure writes the state and reloads the page, after the first load has
// settled. So the reads wait for that load's own toast ("Opened the figure from the link." or "Opened the scene.", shown
// 400 ms after it) and the steps view on it, and the navigation the reload itself causes is waited through, not read. Any
// other error still fails the suite; the deadline is 30 s.
const NAV = /navigated or closed/;
const reloadedFigure = async (toastText) => {
  const until = `(() => { const t = document.body && document.body.innerText || ''; return t.includes(${JSON.stringify(toastText)}) && typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving; })()`;
  for (let i = 0; i < 120; i++) {
    let r = null;
    try { r = await ev(until); } catch (e) { if (!NAV.test(String(e && e.message || e))) throw e; }
    if (r && r.__exc && NAV.test(String(r.__exc))) r = null;
    if (r === true) return;
    await sleep(250);
  }
  throw new Error(`the figure did not open: no "${toastText}" on the reloaded page`);
};
const grab = async (name) => { const e = exc(await logs()); if (e.length) errs.push({ name, e: e.slice(0, 3) }); };
// a link's payload, as the app makes it: #cmw=0.<base64url JSON> or #cmw=1.<base64url of deflate-raw JSON>
const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const linkOf = (s, zip) => { const raw = Buffer.from(JSON.stringify({ v: 1, s })); return zip ? '1.' + b64u(zlib.deflateRawSync(raw)) : '0.' + b64u(raw); };
const STEPS = [{ type: 'pown', params: { n: 2 } }, { type: 'exp', params: {} }, { type: 'pown', params: { n: 3 } }];
// a formula inequality is an area: the classic X → Y opens with its colour inside the areas
const AREA = [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }];
const XY = { steps: STEPS, shapes: AREA };

// [name, the saved classic-era state, what the steps view must show (the keys of READ it checks)]
const CASES = [
  ['X → Y with areas (rightMode image)', { ...XY, rightMode: 'image', sel: 2 }, { on: true, x: 0, T: 3, scope: 'in', surf: 'plane', planes: [0, 1, 2, 3], sel: 2 }],
  ['X → Y without areas', { steps: STEPS, rightMode: 'image' }, { on: true, x: 0, T: 3, scope: 'all', surf: 'plane' }],
  ['Phase (rightMode color)', { ...XY, rightMode: 'color' }, { on: true, x: 0, T: 3, scope: 'all', surf: 'plane' }],
  ['Landscape, plaster (rightMode 3d)', { ...XY, rightMode: '3d', material: 'plaster' }, { on: true, x: 0, T: 3, surf: 'land' }],
  ['Landscape, phase paint (rightMode 3d)', { ...XY, rightMode: '3d', material: 'phase' }, { on: true, x: 0, T: 3, surf: 'land' }],
  ['z-sphere under X → Y (leftSphere)', { ...XY, rightMode: 'image', leftSphere: true }, { on: true, x: 0, T: 3, scope: 'in', surf: 'sphere' }],
  ['U-b view without main (landscape)', { ...XY, rightMode: undefined, view: { L: { surf: 'land', phase: true } } }, { on: true, surf: 'land' }],
  ['view with main phase', { ...XY, rightMode: undefined, view: { main: 'phase', P: { surf: 'plane', eq: false }, D: { phase: true } } }, { on: true, x: 0, scope: 'all', surf: 'plane' }],
  ['deformation range and figMorph (Deformation open)', { ...XY, homRange: { a: 2, b: 3 }, figMorph: { T: 1.5 } }, { on: true, homRange: [2, 3], morphOpen: false }],
  // (solo() is 'L' while the steps view is on: it has one pane, so a saved solo R does not expand a pane)
  ['solo R (the right pane expanded)', { ...XY, rightMode: 'image', solo: 'R' }, { on: true, x: 0, T: 3, scope: 'in', surf: 'plane', solo: 'L' }],
  ['right pane camera (rightView)', { ...XY, rightMode: 'image', rightView: { cx: 0.5, cy: -0.25, s: 120 } }, { on: true, x: 0, scope: 'in' }],
];

// the main a saved view with no rightMode names, as the app loads it (before the steps view adopts it)
const LOADED_MAIN = { 'U-b view without main (landscape)': { main: 'land' }, 'view with main phase': { main: 'phase', side: 'P', surf: 'plane' } };
let n = 0;
for (const [name, st, want] of CASES) {
  n++;
  const ns = 'lmig' + n + Date.now();
  // the classic-era state is saved for ns, then the steps view opens on it
  // the save is written by the classic view (a classic-era save), then the steps view opens it: the view the classic page reads is the
  // state's own, and the steps view adopts its equivalent (Views.svOf)
  await loadView('classic', ns, st);
  await settled({ max: 15000, until: "typeof __cmwState === 'function'" });
  const asLoaded = await ev('__cmwState().view');   // (the classic view's picture of the save)
  info[name + ' (as loaded)'] = asLoaded;
  if (name in LOADED_MAIN) { const L = LOADED_MAIN[name]; ok(name + ': the saved view is loaded as ' + L.main, asLoaded && asLoaded.main === L.main && (!L.side || asLoaded[L.side].surf === L.surf), asLoaded); }
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  const got = await ev(READ);
  info[name] = got;
  for (const k of Object.keys(want)) ok(`${name}: ${k}`, eq(got[k], want[k]), { k, want: want[k], got });
  await grab(name);
  // the state the steps view writes back keeps the classic-era fields it has no place for: the right pane's camera (rightView),
  // the expanded pane (solo), the deformation range (homRange) and the step selected (sel)
  if (name.startsWith('right pane')) {
    // (the save is written on pagehide: poll for the saved right-pane camera, not a fixed wait)
    const key = JSON.stringify('complex-map-workbench-v1:' + ns);
    await ev('window.dispatchEvent(new Event("pagehide")); 1');
    await settled({ max: 15000, panes: false, until: `(() => { const o = JSON.parse(localStorage.getItem(${key})); return !!(o && o.rightView); })()` });
    const saved = await ev(`(() => { const o = JSON.parse(localStorage.getItem(${key})); return o ? o.rightView : null; })()`);
    info['right pane camera, after a save'] = saved;
    ok('rightView survives the steps view and a save', eq(saved, { cx: 0.5, cy: -0.25, s: 120 }), saved);
  }
}

// the links: the same classic-era state as the saved-state case above (X → Y with areas), in each link form. A fresh namespace
// has no saved state, so the link opens the figure itself.
const LINK_STATE = { ...XY, rightMode: 'image', sel: 2 };
const LINK_WANT = { on: true, x: 0, T: 3, scope: 'in', surf: 'plane', planes: [0, 1, 2, 3], sel: 2 };
const FORMS = [
  ['link #cmw=0. (plain JSON)', (ns) => `${BASE}/test.html?ns=${ns}&view=steps#cmw=${linkOf(LINK_STATE, false)}`],
  ['link #cmw=1. (deflate-raw)', (ns) => `${BASE}/test.html?ns=${ns}&view=steps#cmw=${linkOf(LINK_STATE, true)}`],
  ['link after another hash part (#x&cmw=)', (ns) => `${BASE}/test.html?ns=${ns}&view=steps#x&cmw=${linkOf(LINK_STATE, true)}`],
];
for (const [name, url] of FORMS) {
  n++;
  const ns = 'lmig' + n + Date.now();
  await go(url(ns));
  await reloadedFigure('Opened the figure from the link.');
  const got = await ev(READ);
  info[name] = got;
  for (const k of Object.keys(LINK_WANT)) ok(`${name}: ${k}`, eq(got[k], LINK_WANT[k]), { k, want: LINK_WANT[k], got });
  await grab(name);
}

// a link that carries the figure's camera (figCam) and its figMorph: the steps view reads both once, at the load, and its save
// keeps neither. The camera's value and figMorph's T are not checked here: the test hooks do not expose the 3D camera, and the
// steps view does not carry figMorph's T into its Morph transport (a parity gap, see the PR).
n++;
{
  const ns = 'lmig' + n + Date.now();
  const key = JSON.stringify('complex-map-workbench-v1:' + ns);
  const fig = { ...LINK_STATE, figCam: { yaw: 0.4, pitch: -0.3, d: 1.5, tx: 0.1, ty: -0.2 }, figMorph: { T: 1.5 } };
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps#cmw=${linkOf(fig, true)}`);
  const got = await ev(READ);
  info['link with figCam and figMorph'] = got;
  for (const k of Object.keys(LINK_WANT)) ok(`figCam link: ${k}`, eq(got[k], LINK_WANT[k]), { k, want: LINK_WANT[k], got });
  await ev('window.dispatchEvent(new Event("pagehide")); 1');
  await settled({ max: 15000, panes: false, until: `(() => { const o = JSON.parse(localStorage.getItem(${key})); return !!(o && !('figCam' in o)); })()` });
  const saved = await ev(`(() => { const o = JSON.parse(localStorage.getItem(${key})); return o ? { figCam: 'figCam' in o, figMorph: 'figMorph' in o } : null; })()`);
  info['figCam and figMorph, after a save'] = saved;
  ok('figCam and figMorph are read once and not kept by the save', !!saved && !saved.figCam && !saved.figMorph, saved);
  await grab('figCam link');
}

// the open page's own route (a scene file and a link pasted into it both open a state through openFigure)
n++;
{
  const ns = 'lmig' + n + Date.now();
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  await ev(`__cmwPOpen(${JSON.stringify(LINK_STATE)}, 'scene'); 1`);
  await reloadedFigure('Opened the scene.');
  const got = await ev(READ);
  info['open a classic state in the page (scene)'] = got;
  for (const k of Object.keys(LINK_WANT)) ok(`scene: ${k}`, eq(got[k], LINK_WANT[k]), { k, want: LINK_WANT[k], got });
  await grab('scene');
}

// the open route's own keys and toasts (openFigure): the opened figure records how it was opened (cmw-opened), the figure it
// replaces is kept for the undo (cmw-before-open), and a link or scene that holds no figure says so in a toast
const FIND = `(() => { const f = (st, t) => { for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k.startsWith(t + ':') || k === t) return st.getItem(k); } return null; }; return { opened: f(sessionStorage, 'cmw-opened'), before: f(localStorage, 'cmw-before-open') }; })()`;
// openFigure writes its keys and reloads the page: they are read at the pagehide of the old page, into a probe key that the
// page does not use (the new page clears the keys at its load)
const PROBE = 'cmw-test-probe-open';
const probeOpen = async (st, how) => {
  await ev(`window.addEventListener('pagehide', () => { localStorage.setItem('${PROBE}', JSON.stringify(${FIND})); }); __cmwPOpen(${JSON.stringify(st)}, ${JSON.stringify(how)}); 1`);
  await settled({ max: 30000, until: READY });
  const raw = await ev(`(() => { const v = localStorage.getItem('${PROBE}'); localStorage.removeItem('${PROBE}'); return v; })()`);
  return raw ? JSON.parse(raw) : null;
};
const TOASTED = (t) => `document.body.innerText.includes(${JSON.stringify(t)})`;
n++;
{
  const ns = 'lmig' + n + Date.now();
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  const got = await probeOpen(LINK_STATE, 'link');
  info['open a link: the route and the kept figure'] = got;
  ok('a link open records cmw-opened = link', got.opened === 'link', got);
  ok('a link open keeps the figure it replaces (cmw-before-open)', typeof got.before === 'string' && got.before.length > 0, got.before && got.before.length);
  const sc = await probeOpen(LINK_STATE, 'scene');
  ok('a scene open records cmw-opened = scene', sc.opened === 'scene', sc);
  await grab('open route');
}
n++;
{
  const ns = 'lmig' + n + Date.now();
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  await ev(`__cmwPOpen(null, 'link'); 1`);
  await settled({ max: 5000, panes: false, until: TOASTED('This link does not hold a figure.') });
  ok('an empty link says it holds no figure (toast)', await ev(TOASTED('This link does not hold a figure.')), 'no toast');
  await ev(`__cmwPOpen(null, 'scene'); 1`);
  await settled({ max: 5000, panes: false, until: TOASTED('This scene could not be read.') });
  ok('an unreadable scene says so (toast)', await ev(TOASTED('This scene could not be read.')), 'no toast');
  await grab('open errors');
}

for (const e of errs) ok('no errors: ' + e.name, false, e.e);
return { pass: fails.length === 0, fails, info, errs };

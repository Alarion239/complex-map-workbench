// Classic-era saves and links open in the steps view: a state written by the classic view (its legacy fields
// rightMode, sphereMode, leftSphere, material and solo; the U-b `view`; a deformation range and the Deformation's time
// figMorph; a right pane's camera rightView) opens in the steps view on its equivalent (Views.svOf through svAdopt), and
// the links that carry such a state open the same way: #cmw=0. (plain JSON), #cmw=1. (deflate-raw), and a hash with cmw
// after another part. The steps view also honours the query flags ?ns= (a page's own storage) and ?i18n-debug (the recorded lookup
// misses). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info, errs }.
// (the classic view's own picture is not tested here: this suite proves that the steps view shows the same thing)
const { BASE, linkOf, reloadedFigure } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'link_kit.js'), 'utf8'));
const fails = [], info = {}, errs = [];
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// the steps view's state as the test hooks read it: the place (x, T), the colour plane's scope and surface, the chain's planes,
// the selected step, the deformation range and whether the deformation is open
const READ = `(() => { const s = __cmwSteps(), c = __cmwState(); return { on: s.on, x: s.x, T: s.T, scope: s.scope, surf: s.surf, planes: s.planes, sel: s.sel, homRange: s.homRange, range: s.range, solo: s.solo, main: s.main, view: c.view, morphOpen: c.morph.open }; })()`;
// (a place between two planes counts as moving, so a view opened there is ready once its hook has the planes: parked)
const READY = "typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving";
const READY_PARKED = "typeof __cmwSteps === 'function' && __cmwSteps().on && __cmwSteps().ready.ready";
const OPEN_MS = 30000;
// where the app saves the state of the page with ?ns=<ns> (the bare key without a namespace)
const storeKey = (ns) => 'complex-map-workbench-v1' + (ns ? ':' + ns : '');
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
// The page is ready when READY holds, on a document other than the one that was open (the kit's reloaded(old, ...)): a reload
// that swaps the page during the wait cuts the call off, and reloaded asks again of the new page, up to OPEN_MS; a page that
// never gets there is a failed check naming the missing part, and any other error is thrown. (The state is read through the hooks: a pane still refining its
// Landscape does not hold the wait.)
const untilReady = async (name, old, parked) => {
  let err = null;
  try { await reloaded(old, parked ? READY_PARKED : READY, { limitMs: OPEN_MS }); } catch (e) {
    err = String((e && e.message) || e);
    if (!/^the page did not finish reloading within/.test(err)) throw e;
  }
  ok(name, !err, err);
};
const openAt = async (url, parked) => {
  const old = await ev('performance.timeOrigin');
  await go(url);
  await untilReady(`the steps view opened: ${url.replace(/^.*test\.html/, '').slice(0, 60)}`, old, parked);
};
// (reloadedFigure(old, toastText), from test/lib/link_kit.js: the page a link or a scene opens in, waited for through the kit's
// reloaded(old, ...))
const grab = async (name) => { const e = exc(await logs()); if (e.length) errs.push({ name, e: e.slice(0, 3) }); };
const STEPS = [{ type: 'pown', params: { n: 2 } }, { type: 'exp', params: {} }, { type: 'pown', params: { n: 3 } }];
// a formula inequality is an area: the classic X → Y opens with its colour inside the areas
const AREA = [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }];
const XY = { steps: STEPS, shapes: AREA };

// [name, the saved classic-era state, what the steps view must show (the keys of READ it checks)]
const CASES = [
  ['X → Y with areas (rightMode image)', { ...XY, rightMode: 'image', sel: 2 }, { on: true, x: 0, T: 3, scope: 'in', surf: 'plane', planes: [0, 1, 2, 3], sel: 2 }],
  ['X → Y without areas', { steps: STEPS, rightMode: 'image' }, { on: true, x: 0, T: 3, scope: 'all', surf: 'plane' }],
  ['Phase (rightMode color)', { ...XY, rightMode: 'color' }, { on: true, x: 0, T: 3, scope: 'all', surf: 'plane' }],
  ['Sphere colour (rightMode sphere, sphereMode color)', { ...XY, rightMode: 'sphere', sphereMode: 'color' }, { on: true, x: 0, T: 3, surf: 'sphere' }],
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
const LOADED_MAIN = { 'U-b view without main (landscape)': { main: 'land' }, 'view with main phase': { main: 'phase', side: 'P', surf: 'plane' }, 'Sphere colour (rightMode sphere, sphereMode color)': { main: 'phase', side: 'P', surf: 'sphere' } };
let n = 0;
for (const [name, st, want] of CASES) {
  n++;
  const ns = 'lmig' + n + Date.now();
  // the classic-era state is saved for ns, then the steps view opens on it
  // the save is written by the classic view (a classic-era save), then the steps view opens it: the view the classic page reads is the
  // state's own, and the steps view adopts its equivalent (Views.svOf)
  await loadView('classic', ns, st);
  await settled({ max: 15000, only: true, until: "typeof __cmwState === 'function'" });   // (the hook alone: a pane still refining does not hold it)
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
    const key = JSON.stringify(storeKey(ns));
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
  const old = await ev('performance.timeOrigin');
  await go(url(ns));
  await reloadedFigure(old, 'Opened the figure from the link.');
  const got = await ev(READ);
  info[name] = got;
  for (const k of Object.keys(LINK_WANT)) ok(`${name}: ${k}`, eq(got[k], LINK_WANT[k]), { k, want: LINK_WANT[k], got });
  await grab(name);
}

// a link that carries the figure's camera (figCam) and its figMorph: the steps view reads both once, at the load, and its save
// keeps neither. The camera's value is read through __cmwState().cam, and figMorph's T is the steps view's place x (it has no
// Morph transport).
n++;
{
  const ns = 'lmig' + n + Date.now();
  const key = JSON.stringify(storeKey(ns));
  const fig = { ...LINK_STATE, figCam: { yaw: 0.4, pitch: -0.3, d: 1.5, tx: 0.1, ty: -0.2 }, figMorph: { T: 1.5 } };
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps#cmw=${linkOf(fig, true)}`, true);
  const got = await ev(READ);
  info['link with figCam and figMorph'] = got;
  for (const k of Object.keys(LINK_WANT)) ok(`figCam link: ${k}`, eq(got[k], k === 'x' ? 1.5 : LINK_WANT[k]), { k, want: LINK_WANT[k], got });
  const cam = await ev('__cmwState().cam');
  ok('figCam link: the camera is the link\'s', !!cam && [['yaw', 0.4], ['pitch', -0.3], ['d', 1.5], ['tx', 0.1], ['ty', -0.2]].every(([c, v]) => Math.abs(cam[c] - v) < 1e-9), cam);
  await ev('window.dispatchEvent(new Event("pagehide")); 1');
  await settled({ max: 15000, panes: false, until: `(() => { const o = JSON.parse(localStorage.getItem(${key})); return !!(o && !('figCam' in o)); })()` });
  const saved = await ev(`(() => { const o = JSON.parse(localStorage.getItem(${key})); return o ? { figCam: 'figCam' in o, figMorph: 'figMorph' in o } : null; })()`);
  info['figCam and figMorph, after a save'] = saved;
  ok('figCam and figMorph are read once and not kept by the save', !!saved && !saved.figCam && !saved.figMorph, saved);
  await grab('figCam link');
}

// the two cameras a page holds, the Landscape's (cam) and the z-globe's (camL); near: whether camera a is camera b to within tol
// (CAM_EXACT for values that pass through JSON unchanged, CAM_TOL for those the page works out, as a zoom against the fit)
const CAM_EXACT = 1e-9, CAM_TOL = 1e-6;
const camsOf = () => ev('(() => { const c = __cmwState(); return { cam: c.cam, camL: c.camL }; })()');
const near = (a, b, tol) => !!a && !!b && ['yaw', 'pitch', 'd', 'tx', 'ty'].every((k) => Math.abs(a[k] - b[k]) < tol);
// a figure's link opened in a fresh namespace: the cameras of the page it opens on. The page is waited for at rest (the toast, the
// steps view, not moving) unless atRest is false: a Landscape still refining holds no camera, so its link waits for the toast and
// the steps view only
const OPEN_TOAST = 'Opened the figure from the link.';
const openCams = async (state, tag, atRest = true) => {
  const old = await ev('performance.timeOrigin');
  // (go opens the url again when the document it is waiting for is slow to arrive, and a link opened again finds the state its own
  // first open saved, and asks before opening it)
  // raw-navigate: a link is opened by a raw navigation and the kit's reloaded, which waits for the link's reload
  await send('Page.navigate', { url: `${BASE}/test.html?ns=lmig${n}${tag}${Date.now()}${Math.floor(Math.random() * 1e6)}&view=steps#cmw=${linkOf(state, true)}` });
  try {
    if (atRest) await reloadedFigure(old, OPEN_TOAST);
    else await reloaded(old, `document.body.innerText.includes(${JSON.stringify(OPEN_TOAST)}) && typeof __cmwSteps === 'function' && __cmwSteps().on`, { limitMs: OPEN_MS });
  } catch (e) {
    const page = await ev(`({ toast: (document.getElementById('toastHost') || {}).innerText, steps: typeof __cmwSteps === 'function' ? { on: __cmwSteps().on, moving: __cmwSteps().moving } : null, hash: location.hash.slice(0, 20) })`);
    throw new Error(`${tag}: ${e.message}; the page: ${JSON.stringify(page)}`);
  }
  return camsOf();
};

// figCam names its camera (`of`): a link saved while the steps view shows the z-globe carries camL and opens on camL; a figCam
// without `of` (a classic-saved link, the Landscape's) moves cam only and leaves camL where it was
n++;
{
  const GLOBE = { ...XY, rightMode: 'image', leftSphere: true };
  const open = (figCam) => openCams({ ...GLOBE, figCam }, 'g');
  const base = { yaw: 0.2, pitch: -0.1, d: 1, tx: 0, ty: 0 };
  await open(base);   // no `of`: the Landscape's camera
  const land0 = await camsOf();
  const sph = { yaw: 0.7, pitch: 0.35, d: 1.4, tx: 0.05, ty: -0.15, of: 'sphere' };
  await open(sph);
  const got = await camsOf();
  const { of, ...sphCam } = sph;
  ok('figCam of sphere: camL is the link\'s', near(got.camL, sphCam, CAM_EXACT), got);
  ok('figCam of sphere: cam is untouched', !near(got.cam, sphCam, CAM_EXACT) && !near(got.cam, base, CAM_EXACT), got);
  ok('figCam without `of`: cam is the link\'s', near(land0.cam, base, CAM_EXACT), land0);
  ok('figCam without `of`: camL is untouched', !near(land0.camL, base, CAM_EXACT), land0);
  const out = await ev('__cmwFigureState().figCam');
  info['figCam written on the globe'] = out;
  ok('figCam round trip: the sphere camera is written back with of "sphere"', !!out && out.of === 'sphere' && near(out, sphCam, CAM_EXACT), out);
  await grab('figCam of');
}

// the camera the Landscape block moves to: yaw and pitch (radians) and the pan, and the zoom against the fit; the wait for the
// Landscape to settle after the surface change
const MOVED_CAM = { yaw: 0.9, pitch: 0.25, tx: 0.08, ty: -0.12 }, CAM_ZOOM = 1.6, LAND_SETTLE_MS = 60000;
// a link made from the steps view's Landscape carries its moved camera and opens on it: the link is built from the figure the
// view writes (figureState), not by hand; a link made from the same figure without figCam opens on the default camera
n++;
{
  await openCams({ ...XY, rightMode: 'image' }, 'a');
  await ev(`__cmwSteps({ surf: 'land' }); 1`);
  await settled({ max: LAND_SETTLE_MS });
  const base = (await camsOf()).cam;
  await ev(`(() => { const c = __cmwCam('L'); __cmwCam('L', { yaw: ${MOVED_CAM.yaw}, pitch: ${MOVED_CAM.pitch}, dist: c.dist * ${CAM_ZOOM}, tx: ${MOVED_CAM.tx}, ty: ${MOVED_CAM.ty} }); })(), 1`);
  const want = { ...MOVED_CAM, d: base.d * CAM_ZOOM };
  const fig = await ev('__cmwFigureState()');
  const out = fig && fig.figCam;
  info['figCam written on the Landscape'] = out;
  ok('Landscape link: figCam is written without `of`', !!out && !('of' in out), out);
  ok('Landscape link: the camera written is the one on the view', near(out, want, CAM_TOL), { out, want });
  const got = await openCams(fig, 'b', false);
  info['Landscape link opened'] = got;
  ok('Landscape link: cam is the written camera on reopening', near(got.cam, out, CAM_TOL), { out, got });
  const bare = { ...fig };
  delete bare.figCam;
  const plain = await openCams(bare, 'c', false);
  ok('Landscape link without figCam: cam is not the moved camera (the control)', !near(plain.cam, out, CAM_TOL), { out, plain });
  await grab('Landscape link');
}

// the open page's own route (a scene file and a link pasted into it both open a state through openFigure)
n++;
{
  const ns = 'lmig' + n + Date.now();
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  const old = await ev('performance.timeOrigin');
  await ev(`__cmwPOpen(${JSON.stringify(LINK_STATE)}, 'scene'); 1`);
  await reloadedFigure(old, 'Opened the scene.');
  const got = await ev(READ);
  info['open a classic state in the page (scene)'] = got;
  for (const k of Object.keys(LINK_WANT)) ok(`scene: ${k}`, eq(got[k], LINK_WANT[k]), { k, want: LINK_WANT[k], got });
  await grab('scene');
}

// the open route's own keys and toasts (openFigure): the opened figure records how it was opened (cmw-opened), the figure it
// the previous figure is kept under cmw-before-open for the undo, and a link or scene that holds no figure says so in a toast
const FIND = `(() => { const f = (st, t) => { for (let i = 0; i < st.length; i++) { const k = st.key(i); if (k.startsWith(t + ':') || k === t) return st.getItem(k); } return null; }; return { opened: f(sessionStorage, 'cmw-opened'), before: f(localStorage, 'cmw-before-open') }; })()`;
// openFigure writes its keys and reloads the page: they are read at the pagehide of the old page, into a probe key that the
// page does not use (the new page clears the keys at its load)
const PROBE = 'cmw-test-probe-open';
const probeOpen = async (st, how) => {
  const old = await ev('performance.timeOrigin');
  // (the open is deferred past this call's reply: its reload would otherwise close the target while the call waits for it)
  await ev(`window.addEventListener('pagehide', () => { localStorage.setItem('${PROBE}', JSON.stringify(${FIND})); }); setTimeout(() => __cmwPOpen(${JSON.stringify(st)}, ${JSON.stringify(how)}), 0); 1`);
  // the read retries while the page reloads (the target is closed for a moment): the first read that answers is the new page's
  let raw = null;
  for (let i = 0; i < 60 && !raw; i++) {
    try { raw = await ev(`(() => { const v = localStorage.getItem('${PROBE}'); localStorage.removeItem('${PROBE}'); return v; })()`); } catch (e) { raw = null; }
    if (!raw) await new Promise((r) => setTimeout(r, 500));
  }
  await untilReady('the steps view opened after the figure reload', old);
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
  ok('a link open keeps the previous figure (cmw-before-open)', typeof got.before === 'string' && got.before.length > 0, got.before && got.before.length);
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

// a link or a scene carries the figure, not the viewer's panels: no hideLeft or hideRight whichever panels are hidden, and a
// right plane that is still fitted to its content (auto) has no rightView
n++;
{
  const ns = 'lmig' + n + Date.now();
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  await ev('__cmwSet("hideLeft", true); __cmwSet("hideRight", true); 1');
  const fs = await ev('(() => { const o = __cmwFigureState(); return { keys: Object.keys(o).filter((k) => /^hide/.test(k)), rightView: o.rightView, steps: o.steps.length }; })()');
  info['figureState'] = fs;
  ok('figureState: no hideLeft or hideRight', !!fs && eq(fs.keys, []), fs);
  ok('figureState: rightView is null while the right plane is fitted (auto)', !!fs && fs.rightView === null, fs);
  await grab('figureState');
}

// ?ns=<name> gives a page its own storage: the figure a namespaced steps page saves is under its own key, not the bare one, and
// neither another namespace nor the page without ?ns sees it
n++;
{
  const nsA = 'lmigA' + n + Date.now(), nsB = 'lmigB' + n + Date.now();
  const stepsSaved = (ns) => ev(`(() => { const v = localStorage.getItem(${JSON.stringify(storeKey(ns))}); return v ? JSON.parse(v).steps.length : null; })()`);
  const chainTypes = () => ev('__cmwFigureState().steps.map((st) => st.type)');
  const LINK_TYPES = LINK_STATE.steps.map((st) => st.type);   // (a page with no saved figure opens a worked example, a different chain)
  const old = await ev('performance.timeOrigin');
  await go(`${BASE}/test.html?ns=${nsA}&view=steps#cmw=${linkOf(LINK_STATE, true)}`);
  await reloadedFigure(old, 'Opened the figure from the link.');
  await ev('window.dispatchEvent(new Event("pagehide")); 1');
  await settled({ max: 15000, panes: false, until: `(() => { const v = localStorage.getItem(${JSON.stringify(storeKey(nsA))}); return !!v && JSON.parse(v).steps.length === ${LINK_STATE.steps.length}; })()` });
  const saved = { own: await stepsSaved(nsA), bare: await stepsSaved('') };
  info['?ns: where the figure is saved'] = saved;
  ok('?ns: the figure is saved under the namespace', saved.own === LINK_STATE.steps.length, saved);
  ok('?ns: nothing is saved under the bare key', saved.bare === null, saved);
  await openAt(`${BASE}/test.html?ns=${nsB}&view=steps`);
  const other = await chainTypes();
  ok('?ns: another namespace opens without the figure', other.length > 0 && !eq(other, LINK_TYPES), other);
  await openAt(`${BASE}/test.html?view=steps`);
  const bare = await chainTypes();
  ok('without ?ns: the page does not see the namespace\'s figure', bare.length > 0 && !eq(bare, LINK_TYPES), bare);
  await grab('?ns');
}

// ?i18n-debug records the lookups an interface language has no entry for (I18N.missing); without it, and without ?lang=, nothing is
// recorded. The language is the device setting (cmw-lang), Russian here, so that ?lang= is not what turns the recording on.
n++;
{
  const ns = 'lmigI' + n + Date.now();
  const PROBE = 'a sentence no language has ' + ns;
  const probed = () => ev(`(() => { const ru = $t('Link copied.'); $t(${JSON.stringify(PROBE)}); return { debug: I18N._debug, ru: ru !== 'Link copied.', recorded: [...I18N.missing].includes(${JSON.stringify(PROBE)}) }; })()`);
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  await ev(`localStorage.setItem('cmw-lang:${ns}', 'ru'); 1`);
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  const off = await probed();
  info['?i18n-debug: without the flag'] = off;
  ok('?i18n-debug: the steps view is in Russian from the device setting', off.ru, off);
  ok('without ?i18n-debug: no lookup miss is recorded', !off.debug && !off.recorded, off);
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps&i18n-debug`);
  const on = await probed();
  info['?i18n-debug: with the flag'] = on;
  ok('?i18n-debug: a lookup miss is recorded in the steps view', on.debug && on.ru && on.recorded, on);
  await grab('?i18n-debug');
}

for (const e of errs) ok('no errors: ' + e.name, false, e.e);
return { pass: fails.length === 0, fails, info, errs };

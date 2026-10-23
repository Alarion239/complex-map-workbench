// The deformation after the 2026-10-22 request ("Remove linear homotopy. Make deformation lines togglable. What is
// natural path? ... room for improvement?"): no straight-line option (old saves migrate), the Paths toggle (docked
// button, key P, palette, saved, figure export), the natural paths of Joukowski / cos / rational maps, and the steps
// all at once (map mode 3, t in [0, 1]). A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/deform_nat_cmd.js
// Prints {pass, fails, shots}; screenshots go to <daemon folder>/shots/nat-*.png (light and dark).
const fails = [], shots = [];
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const NS = 'deformnat' + Date.now();
const saved = (ns = NS) => ev(`JSON.parse(localStorage.getItem('complex-map-workbench-v1:${ns}') || '{}')`);
// (exceptions and console errors of the app; a 404 of the static server's favicon is not one)
const exc = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
const errs = [];
const grab = async () => { errs.push(...exc(await logs())); };
const at = async (T) => { await ev(`__cmwMorph({ T: ${T} })`); await settle(700); };

// 1. an old save with the straight line: migrated to the natural paths, no path select in the transport
await view(1440, 900, false);
await load(NS, { shapes: [{ id: 's1', kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, { id: 's2', kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888 }],
  steps: [{ type: 'joukowski', params: {}, on: true }], hom: 'linear', pattern: 'checker', srcView: { cx: 0, cy: 0, s: 70 } });
await settle(800);
await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await at(0.5);
let st = await ev('__cmwState()');
ok('old linear save: the natural path (mode 1)', st.homView && st.homView.map.mode === 1, st.homView && st.homView.map);
ok('no path select (straight line removed)', !(await ev(`!!document.getElementById('homSel')`)), null);
ok('one step: no order select', !(await ev(`!!document.getElementById('homOrderSel')`)), null);
await ev('__cmwMorph({ open: false })'); await settle(300);
let sv = await saved();
ok('saved state: no hom key', !('hom' in sv) && sv.homAll === false, { hom: sv.hom, homAll: sv.homAll });

// 2. the Paths toggle: a pressed button in the docked bar, key P, saved, the palette
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await at(0.6);
const pb = await ev(`(() => { const b = document.getElementById('pathsBtn'); return b ? { pressed: b.getAttribute('aria-pressed'), text: b.textContent, inDock: !!b.closest('#tdockR'), w: b.getBoundingClientRect().width } : null; })()`);
ok('Paths toggle in the docked bar, pressed', pb && pb.pressed === 'true' && pb.text === 'Paths' && pb.inDock && pb.w > 30, pb);
await move(700, 400);
await key('p'); await settle(400);
ok('key P turns the paths off', (await ev(`document.getElementById('pathsBtn').getAttribute('aria-pressed')`)) === 'false', null);
sv = await saved();
ok('Paths off is saved', sv.morphPaths === false, sv.morphPaths);
await shot('nat-joukowski-paths-off-light'); shots.push('nat-joukowski-paths-off-light');
await key('p'); await settle(400);
ok('key P turns the paths on again', (await ev(`document.getElementById('pathsBtn').getAttribute('aria-pressed')`)) === 'true', null);
ok('the Point tool did not take the key', (await ev(`document.querySelector('.tool[aria-pressed="true"], .tool.on') ? (document.querySelector('.tool[aria-pressed="true"], .tool.on').dataset.tool || document.querySelector('.tool[aria-pressed="true"], .tool.on').id) : ''`)) !== 'point', null);
// palette entry
await key('/'); await settle(300); await type('paths'); await settle(400);
const pal = await ev(`(document.getElementById('popHost') || document.body).innerText`);
ok('palette: the paths entry', /hide the paths/i.test(pal), pal.slice(0, 300));
await key('Escape'); await settle(200);

// 3. Joukowski at t = 0.5 (the unit circle closes onto [-1, 1]): light and dark
await at(0.5);
await shot('nat-joukowski-light'); shots.push('nat-joukowski-light');
// export: Paths row, arrows on and off
const figOn = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? { n: f.morph ? f.morph.kept.length : -1, cap: f.captionTex } : { n: -2, cap: '' }; })()`, 60000);
const figOff = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4, paths: false }); return f ? { n: f.morph ? f.morph.kept.length : -1, cap: f.captionTex } : { n: -2, cap: '' }; })()`, 60000);
ok('figure with paths: arrows and their sentence', figOn.n > 0 && /Arrows are the paths/.test(figOn.cap), { n: figOn.n });
ok('figure without paths: no arrows, no arrow sentence', figOff.n === 0 && !/Arrows are the paths/.test(figOff.cap), { n: figOff.n });
ok('caption names the Joukowski path', /coth/.test(figOn.cap) && /arcoth/.test(figOn.cap), figOn.cap.slice(0, 400));
await view(1440, 900, true); await settle(900);
await shot('nat-joukowski-dark'); shots.push('nat-joukowski-dark');
await view(1440, 900, false); await settle(500);
await ev('__cmwMorph({ open: false })');

// 4. cos on the strip 0 < Re z < pi (arccos's range; the path about pi/2 never folds it), t = 0.5
await load(NS + 'c', { shapes: [{ id: 's1', kind: 'rect', a: [0, -1], b: [Math.PI, 1] }, { id: 's2', kind: 'cgrid', a: [0, -1], b: [Math.PI, 1], n: 6 }],
  steps: [{ type: 'cos', params: {}, on: true }], pattern: 'checker', srcView: { cx: 1.5, cy: 0, s: 80 } });
await settle(800); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await at(0.5);
await shot('nat-cos-light'); shots.push('nat-cos-light');
st = await ev('__cmwState()');
ok('cos: natural path (mode 1)', st.homView && st.homView.map.mode === 1, st.homView && st.homView.map);
await view(1440, 900, true); await settle(900);
await shot('nat-cos-dark'); shots.push('nat-cos-dark');
await view(1440, 900, false); await settle(400);
await ev('__cmwMorph({ open: false })');

// 5. three steps all at once (strip -> exp -> Cayley -> square): the order select, t in [0, 1], map mode 3
await load(NS + 'a', { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.2], b: [1.5, 1.2], n: 6 }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 } });
await settle(800); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
ok('three steps: the order select, one after another', (await ev(`document.getElementById('homOrderSel') && document.getElementById('homOrderSel').value`)) === 'steps', null);
await at(1.5);
await ev(`(() => { const s = document.getElementById('homOrderSel'); s.value = 'all'; s.dispatchEvent(new Event('change')); })()`); await settle(600);
st = await ev('__cmwState()');
ok('all at once: map mode 3 over (0, 3]', st.homView && st.homView.map.mode === 3 && st.homView.map.a === 0 && st.homView.map.b === 3, st.homView && st.homView.map);
ok('all at once: the same moment, rescaled (1.5 / 3 = 0.5)', Math.abs(st.morph.T - 0.5) < 1e-9, st.morph.T);
const dock = await ev(`({ max: document.getElementById('morphRange').max, label: document.getElementById('morphLabel').textContent, ticks: [...document.querySelectorAll('#tdockR .ttick')].map((e) => e.textContent) })`);
ok('all at once: the scrubber runs over [0, 1], one tick', +dock.max === 1 && /\/ 1$/.test(dock.label) && dock.ticks.length === 1, dock);
sv = await saved(NS + 'a');
ok('all at once is saved', sv.homAll === true, sv.homAll);
await at(0.5);
await shot('nat-allatonce-light'); shots.push('nat-allatonce-light');
const figA = await ev(`await (async () => { const f = await __cmwBuildFigure({ panels: ['R'], morph: true, caption: true, widthIn: 3.4 }); return f ? { n: f.morph ? f.morph.kept.length : -1, cap: f.captionTex } : { n: -2, cap: '' }; })()`, 60000);
ok('all at once: the caption says so', /at once/.test(figA.cap) && /0\\le t\\le 1/.test(figA.cap), figA.cap.slice(0, 500));
// CPU and GPU agree on a frame: the CPU map of a few points vs the drawn paths' heads is covered by the GLSL parity
// test (mode 6 rows); here the play loop must run on [0, 1] and stop at 1
await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(2600);
st = await ev('__cmwState()');
ok('all at once plays to t = 1 (no step holds)', st.morph.T <= 1 + 1e-9, st.morph.T);
await ev('__cmwMorph({ playing: false })');
await view(1440, 900, true); await at(0.5); await settle(600);
await shot('nat-allatonce-dark'); shots.push('nat-allatonce-dark');
await view(1440, 900, false); await settle(400);
// back to one after another: T scales up again
await ev(`(() => { const s = document.getElementById('homOrderSel'); s.value = 'steps'; s.dispatchEvent(new Event('change')); })()`); await settle(500);
st = await ev('__cmwState()');
ok('one after another again: mode 1, T x 3', st.homView && st.homView.map.mode === 1 && Math.abs(st.morph.T - 1.5) < 1e-9, { map: st.homView && st.homView.map, T: st.morph.T });
await ev('__cmwMorph({ open: false })');

// 6. a rational map (z^2 - 1)/(z^2 + 1), t = 0.5: the zoom path
await load(NS + 'r', { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.5], b: [1.5, 1.5], n: 6 }],
  steps: [{ type: 'rational', params: { p: '1, 0, -1', q: '1, 0, 1' }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 } });
await settle(800); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await at(0.5);
await shot('nat-rational-light'); shots.push('nat-rational-light');
await view(1440, 900, true); await settle(900);
await shot('nat-rational-dark'); shots.push('nat-rational-dark');
await view(1440, 900, false); await settle(400);
// Phase with the deformation: H_t painted (mode 1) and the transport docked there, no Paths toggle
await ev(`__cmwSetMain('phase')`); await settle(800);
ok('Phase + deformation: no Paths toggle', !(await ev(`!!document.getElementById('pathsBtn')`)), null);
await shot('nat-rational-phase-light'); shots.push('nat-rational-phase-light');
await ev(`__cmwSetMain('xy')`); await ev('__cmwMorph({ open: false })'); await settle(300);

// 7. Joukowski on the unit disk (|z| < 0.9, polar grid), t = 0.4: the disk branch, no tear across (-1, 1)
await load(NS + 'j', { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 0.9, nc: 6, nr: 12 }],
  steps: [{ type: 'joukowski', params: {}, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 160 } });
await settle(800); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
await at(0.4);
await shot('nat-joukdisk-light'); shots.push('nat-joukdisk-light');
await ev('__cmwMorph({ open: false })'); await settle(300);
// 8. a chain with d/dz: the Paths toggle is there but disabled (no paths are drawn), and P does nothing
await load(NS + 'd', { shapes: [{ id: 's1', kind: 'rect', a: [-1, -1], b: [1, 1] }], steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'deriv', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } });
await settle(800); await grab();
await ev('__cmwMorph({ open: true, playing: false })'); await settle(600);
const pd = await ev(`(() => { const b = document.getElementById('pathsBtn'); return b ? { dis: b.disabled, pressed: b.getAttribute('aria-pressed'), tip: b.dataset.tip } : null; })()`);
ok('with d/dz: the Paths toggle is disabled and says why', pd && pd.dis === true && pd.pressed === 'false' && /d\/dz/.test(pd.tip), pd);
await move(700, 400); await key('p'); await settle(300);
const sv2 = await saved(NS + 'd');
ok('with d/dz: key P changes nothing', sv2.morphPaths !== false, sv2.morphPaths);
await ev('__cmwMorph({ open: false })'); await settle(300);

await grab();
ok('no exceptions or console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, shots };

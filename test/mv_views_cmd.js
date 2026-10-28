// Merged views (notes/ui-design/merged-views.md, revising U-b): the top bar's view switch (X → Y · Phase · Landscape,
// keys 1 2 3), the merged full-width Phase and Landscape views, each view's own plane view and cameras, the Deformation
// toggle (M) in every view (X → Y: the panes merge into one plane; the transport docked under the plot), export
// following the view, the saved-state migration, the examples, and the layout-aware test hooks.
// Supersedes test/ub_views_cmd.js (U-b's pane controls). A command file for a CDP daemon (test/cdp_kit README):
//   python3 build.py && test/<you>_cdp/q.sh test/mv_views_cmd.js
// Prints {pass, fails, ...}; pass is true when every check holds.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const vw = () => ev('__cmwView()');
const lay = () => ev('__cmwLayout()');
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const rect = (id) => ev(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })()`);
const radios = (id) => ev(`[...document.querySelectorAll('#${id} > button')].map((b) => [b.dataset.mode, b.getAttribute('aria-checked')])`);
const scaleL = () => ev(`(() => { const a = __cmwW2S('L', 0, 0), b = __cmwW2S('L', 1, 0); return +(b[0] - a[0]).toFixed(3); })()`);

// 1. a fresh state: X → Y, the switch in the top bar, Plane · Sphere in both heads, the Deformation toggle in the top
// bar (not in a pane head), no Phase toggle
await view(1440, 900, false);
await nav((process.env.CMW_BASE || 'http://localhost:8793/') + 'test.html?ns=mvviews' + Date.now());
await settle(2200);
logs();
let v = await vw();
ok('default view: X → Y, both Plane', v.main === 'xy' && v.L.surf === 'plane' && v.R.surf === 'plane', v);
ok('switch radios', JSON.stringify(await radios('viewSwitch')) === JSON.stringify([['xy', 'true'], ['phase', 'false'], ['land', 'false']]), await radios('viewSwitch'));
ok('X head: Plane · Sphere', JSON.stringify(await radios('leftTabs')) === JSON.stringify([['plane', 'true'], ['sphere', 'false']]), await radios('leftTabs'));
ok('Y head: Plane · Sphere', JSON.stringify(await radios('rightTabs')) === JSON.stringify([['plane', 'true'], ['sphere', 'false']]), await radios('rightTabs'));
const where = await ev(`({ inTop: !!document.querySelector('#top #morphBtn'), inHead: !!document.querySelector('.pane-head #morphBtn'), phaseBtn: !!document.getElementById('phaseBtn'), label: document.getElementById('morphBtn').textContent })`);
ok('Deformation toggle in the top bar only', where.inTop && !where.inHead && !where.phaseBtn && where.label === 'Deformation', where);
let L0 = await lay();
ok('split: both panes, equal widths', L0.merged === null && L0.shown.length === 2 && Math.abs(L0.wL - L0.wR) < 2, L0);
const split = L0.wL;
// 2. keys by e.code: 1 2 3 pick the view; Phase and Landscape are one wide left panel, no gutter, no expand buttons
await move(5, 5);
await key('2'); await settle(600);
v = await vw(); let Lp = await lay();
ok('key 2: Phase', v.main === 'phase' && Lp.merged === 'L' && Lp.shown.join() === 'L', { v, Lp });
ok('Phase is full width', Lp.wL > 2 * split, { wL: Lp.wL, split });
const chrome = await ev(`({ paneR: getComputedStyle(document.getElementById('paneR')).display, gutter: getComputedStyle(document.getElementById('gutterCol')).display, leftSolo: document.getElementById('leftSolo').hidden, title: document.getElementById('leftTitle').textContent })`);
ok('Phase: no second pane, no gutter, no expand button', chrome.paneR === 'none' && chrome.gutter === 'none' && chrome.leftSolo === true, chrome);
ok('Phase title', /z-plane\s*phase of F/.test(chrome.title), chrome.title);
// (v16.5 UX20: on a desktop the plane's option bar left the picture: its controls are in the Display options popover
// of the pane head; a real click opens it, and it is closed again after the checks)
const optsXY = () => ev(`(() => { const e = document.querySelector('#leftFoot .opts-btn'); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
const openOpts = async () => { const b = await optsXY(); if (b && (await ev(`document.querySelector('#leftFoot .opts-btn').getAttribute('aria-expanded')`)) !== 'true') { await click(b[0], b[1]); await settle(300); } return !!b; };
const closeOpts = async () => { await ev(`(() => { const b = document.querySelector('#leftFoot .opts-btn'); if (b && b.getAttribute('aria-expanded') === 'true') b.click(); return 1; })()`); await settle(200); };
await openOpts();
ok('Phase strip (v16.5 UX20: in Display options): the style control shows', !!(await rect('dcSeg')), await rect('dcSeg'));
await closeOpts();
ok('Phase legend, no Key switch there (review: it acted on a hidden pane)', await ev(`!document.getElementById('leftLegend').hidden && document.getElementById('wKeyRow').hidden`), null);
await key('3'); await settle(900);
v = await vw(); Lp = await lay();
ok('key 3: Landscape', v.main === 'land' && Lp.merged === 'L' && Lp.wL > 2 * split, { v, Lp });
ok('Landscape: no surface switch', await ev(`document.getElementById('leftTabs').parentElement.hidden`), null);
await openOpts();
const lp = await ev(`({ paint: (document.querySelector('#landPaint > button.on') || {}).dataset?.v, height: !!document.getElementById('heightSeg'), dc: !!document.getElementById('dcSeg') })`);
ok('Landscape strip: height and one colouring control (Tiles · Plain · Plaster)', lp.height && !lp.dc && ['tiles', 'phase'].includes(lp.paint), lp);
await clickSel('#landPaint > button[data-v="plaster"]'); await settle(300);
ok('Plaster: the landscape paints no phase', (await vw()).D.phase === false && (await ev('__cmwState().mode')) === '3d', await vw());
await clickSel('#landPaint > button[data-v="tiles"]'); await settle(300);
await closeOpts();
await key('1'); await settle(600);
L0 = await lay();
ok('key 1: X → Y split again', L0.main === 'xy' && L0.merged === null && Math.abs(L0.wL - split) < 2, L0);
// one map for the surfaces (review): Shift 1, 2 the left or only panel (X in X → Y, the portrait in Phase), Shift 3, 4 Y
await key('4', 8); await settle(500);
ok('Shift 4 in X → Y: Y Sphere', (await vw()).R.surf === 'sphere' && (await vw()).L.surf === 'plane', await vw());
await key('3', 8); await settle(300);
ok('Shift 3 in X → Y: Y Plane', (await vw()).R.surf === 'plane', await vw());
await key('2', 8); await settle(500);
ok('Shift 2 in X → Y: X Sphere', (await vw()).L.surf === 'sphere' && (await vw()).R.surf === 'plane', await vw());
await key('1', 8); await settle(300);
ok('Shift 1 in X → Y: X Plane', (await vw()).L.surf === 'plane', await vw());
ok('head buttons show their keys', (await ev(`[...document.querySelectorAll('#leftTabs > button, #rightTabs > button')].map((b) => b.dataset.tip).join('|')`)) === 'Plane  ⇧1|Sphere  ⇧2|Plane  ⇧3|Sphere  ⇧4', await ev(`[...document.querySelectorAll('#leftTabs > button, #rightTabs > button')].map((b) => b.dataset.tip).join('|')`));
await key('2'); await settle(400);
await key('2', 8); await settle(800);
v = await vw();
ok('Shift 2 in Phase: the phase sphere; X → Y keeps X Plane', v.P.surf === 'sphere' && v.L.surf === 'plane' && v.R.surf === 'plane', v);
ok('phase sphere title', /z-sphere\s*phase of F/.test(await ev(`document.getElementById('leftTitle').textContent`)), await ev(`document.getElementById('leftTitle').textContent`));
// 3. each view keeps its own plane view and cameras
await key('1', 8); await settle(500);              // the phase panel back on its Plane
const sPhase0 = await scaleL();
await clickSel('#leftZoomIn'); await settle(700);
const sPhase1 = await scaleL();
await key('1'); await settle(600);
const sXY = await scaleL();
await key('2'); await settle(600);
const sPhase2 = await scaleL();
ok('each view keeps its plane view', sPhase1 > sPhase0 * 1.1 && Math.abs(sXY - sPhase0) < 1e-6 * sPhase0 + 1e-3 && Math.abs(sPhase2 - sPhase1) < 1e-3, { sPhase0, sPhase1, sXY, sPhase2 });
await key('2', 8); await settle(700);
await ev('__cmwCam("L", { yaw: 1.1, pitch: 0.3 }); 1'); await settle(300);
await key('1'); await settle(300);
await ev('__cmwSetView("L", "sphere"); 1'); await settle(700);
const camXY = await ev('__cmwCam("L")');
await key('2'); await settle(500);
const camP = await ev('__cmwCam("L")');
ok('each view keeps its globe camera', Math.abs(camP.yaw - 1.1) < 1e-6 && Math.abs(camXY.yaw - 1.1) > 1e-3, { camXY, camP });
await key('1', 8); await settle(300);
await key('1'); await settle(300);
await ev('__cmwSetView("L", "plane"); 1'); await settle(500);

// 4. the Deformation toggle in every view (default example: a strip, exp, a Moebius step)
let mb = await ev(`({ dis: document.getElementById('morphBtn').getAttribute('aria-disabled'), tip: document.getElementById('morphBtn').dataset.tip })`);
ok('Deformation enabled with steps', mb.dis === 'false' && /Deformation/.test(mb.tip), mb);
await clickSel('#morphBtn'); await settle(900);
await ev('__cmwMorph({ T: 0.55 }); 1'); await settle(900);
let Ld = await lay();
ok('X → Y + Deformation: one plane (the right pane, full width)', Ld.deform && Ld.merged === 'R' && Ld.shown.join() === 'R' && Ld.wR > 2 * split, Ld);
const rt = await ev(`document.getElementById('rightTitle').textContent`);
ok('deformation title (v16.5 UX103: in words)', /^Deformation\s*from z to w$/.test(rt), rt);
const dockR = await rect('tdockR'), plotR = await rect('plotR');
ok('transport docked under the plot, full width of the panel', dockR && plotR && dockR[1] >= plotR[1] + plotR[3] && dockR[2] > plotR[2], { dockR, plotR });
ok('transport is not in the options strip', await ev(`!document.querySelector('#rightFoot #morphPlay') && !!document.querySelector('#tdockR #morphPlay') && !!document.getElementById('pathsBtn')`), null);
const sel = await ev('await __cmwMorphSel()', 60000);
ok('live paths chosen', sel && sel.n > 0, sel && { n: sel.n, nCands: sel.nCands });
R.paths = sel && sel.n;
// a scrub never re-chooses the paths: the cache stays valid at every t
const cacheAt = [];
for (const T of [0.1, 0.35, 0.8, 1.3, 1.9]) { await ev(`__cmwMorph({ T: ${T} }); 1`); await sleep(40); cacheAt.push(await ev('__cmwMorphCache()')); }
ok('scrub keeps the cached selection (no job)', cacheAt.every((c) => c.ready && !c.job), cacheAt);
await ev('__cmwMorph({ T: 0.55 }); 1'); await settle(500);
await shot('mv_xy_deform');
// pan keeps the live paths (review: a 60 px pan re-chose the whole set)
{
  const z0 = (await ev('__cmwMorphCache()')).zs;
  const pr = await ev(`(() => { const r = document.getElementById('plotR').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  await drag(pr[0], pr[1], pr[0] + 60, pr[1] + 10, 8, 16); await settle(900);
  const c1 = await ev('__cmwMorphCache()');
  ok('a pan keeps the kept start points', c1.ready && JSON.stringify(c1.zs) === JSON.stringify(z0), { n0: z0 && z0.length, c1: c1.zs && c1.zs.length });
  await drag(pr[0] + 60, pr[1] + 10, pr[0], pr[1], 8, 16); await settle(500);
}
// the legend's rows say what grey and the lines are (review: the chip's lower half was blank)
ok('deformation legend: X and the paths', await ev(`(() => { const c = document.getElementById('legendCanvas'), x = c.getContext('2d'), d = x.getImageData(0, 96, c.width, 48).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n > 200; })()`), null);
// draw tools are dimmed and say why (review: a drag drew nothing, silently)
ok('draw tools dimmed in the merged plane', await ev(`(() => { const b = document.querySelector('.tool[data-tool="disc"]'); return b.classList.contains('globe-off') && /Turn off Deformation/.test(b.dataset.tip); })()`), null);
// Y Sphere while deforming: one globe, with the live paths and the Paths check (review)
await key('4', 8); await settle(1200);
Ld = await lay();
ok('X → Y Sphere + Deformation: one globe', Ld.merged === 'R' && (await vw()).R.surf === 'sphere', Ld);
ok('globe: the Paths toggle and the same title as the plane', !!(await ev(`!!document.getElementById('pathsBtn')`)) && /^Deformation\s*from /.test(await ev(`document.getElementById('rightTitle').textContent`)), await ev(`document.getElementById('rightTitle').textContent`));
for (let i = 0; i < 40 && !(await ev('__cmwMorphCache().ready')); i++) await sleep(150);
await settle(400);
ok('globe: live paths chosen', ((await ev('__cmwMorphCache()')).zs || []).length > 0, await ev('__cmwMorphCache()'));
await shot('mv_globe_paths');
await key('3', 8); await settle(500);
// Phase + Deformation: the wide portrait of H_t with the same transport, docked in its panel
await key('2'); await settle(900);
Ld = await lay();
const dockL = await rect('tdockL');
ok('Phase + Deformation: the wide panel, the transport docked in it, titled H_t', Ld.deform && Ld.merged === 'L' && !!dockL && !(await rect('tdockR')) && /phase of Ht/.test(await ev(`document.getElementById('leftTitle').textContent`)), { Ld, dockL, t: await ev(`document.getElementById('leftTitle').textContent`) });
ok('no Paths toggle outside the deformation plane', !(await ev(`!!document.getElementById('pathsBtn')`)), null);
await key('3'); await settle(900);
Ld = await lay();
ok('Landscape + Deformation', Ld.deform && Ld.merged === 'L' && !!(await rect('tdockL')) && /log\|Ht\|/.test(await ev(`document.getElementById('leftTitle').textContent`)), Ld);
await key('1'); await settle(600);
await key('m'); await settle(700);
Ld = await lay();
ok('M turns it off: the panes split again', !Ld.deform && Ld.merged === null && Ld.shown.length === 2 && !(await rect('tdockR')), Ld);
// the deformation plane keeps its own view (review: zooms leaked into Y's split view and back)
{
  const scR = () => ev(`(() => { const a = __cmwW2S('R', 0, 0), b = __cmwW2S('R', 1, 0); return +(b[0] - a[0]).toFixed(3); })()`);
  const y0 = await scR();
  await key('m'); await settle(800);
  const d0 = await scR();
  await clickSel('#rightZoomIn'); await settle(500); await clickSel('#rightZoomIn'); await settle(700);
  const d1 = await scR();
  await key('m'); await settle(700);
  const y1 = await scR();
  await key('m'); await settle(700);
  const d2 = await scR();
  await key('m'); await settle(500);
  // (Y's split view is auto-fitted here, so it may be refitted on the way back: the same view within 0.5 %, not the
  // deformation's zoom)
  ok('own deformation view: Y unchanged, the deformation keeps its zoom', d1 > d0 * 1.2 && Math.abs(y1 - y0) < 5e-3 * y0 && Math.abs(d2 - d1) < 1e-3, { y0, d0, d1, y1, d2 });
}
// a focused step deforms that step only
// (v15: a click selects the step; Show alone is a double-click)
await ev(`(() => { const c = document.querySelector('.card[data-k="2"]'); if (c) c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); return 1; })()`); await settle(500);
await key('m'); await settle(700);
const fst = await ev("__cmwState()");
ok("focused step: its own deformation", fst.focus === 2 && fst.morph.open && /^Step 1 of 1 · (f\S+|d\/dz) · \d+ %$/.test(await ev(`document.getElementById('morphLabel').textContent`)), { focus: fst.focus, label: await ev(`document.getElementById('morphLabel').textContent`) });
// the half-plane source e^X is clipped to the image's frame (review: a 25 px blob and one path at 10 / div)
await ev('__cmwMorph({ T: 0.5 }); 1'); await settle(400);
const fsel = await ev('await __cmwMorphSel({ force: true })', 60000);
const fsc = await ev(`(() => { const a = __cmwW2S('R', 0, 0), b = __cmwW2S('R', 1, 0); return b[0] - a[0]; })()`);
ok('focused unbounded source: readable frame and paths', fsel && fsel.n >= 8 && fsc > 60, { n: fsel && fsel.n, nCands: fsel && fsel.nCands, pxPerUnit: fsc });
await key('m'); await settle(300);
await clickSel('#viewAllBtn'); await settle(400);

// 5. export follows the view (the Export figure dialog, notes/export-design/AS-BUILT.md): X → Y the two-panel figure,
// the deformation its filmstrip (or the paths figure), Phase and Landscape their one panel
const figDialog = async () => {
  await clickSel('#exportBtn'); await sleep(250);
  await ev(`(() => { const b = [...document.querySelectorAll('.pop.menu button, .pop.menu [role="menuitem"]')].find((x) => /Export figure/.test(x.textContent)); if (b) b.click(); return !!b; })()`);
  for (let i = 0; i < 120; i++) { await sleep(150); const f = await ev(`(() => { const d = __cmwFig.dialog(); return !!(d && d.fig && !d.building); })()`); if (f) break; }
  const r = await ev(`(() => { const f = __cmwLastFigure(); const deform = [...document.querySelectorAll('#xfDeform > button')].map((b) => b.textContent); return { view: f && f.view, deform, panels: f && f.info && f.info.panels ? f.info.panels.join('') : '', images: f ? (f.svg.match(/<image/g) || []).length : -1, W: f && f.W, H: f && f.H, cap: f && f.captionTex }; })()`);
  await key('Escape'); await sleep(300);
  return r;
};
R.figXY = await figDialog();
ok('X → Y exports the two-panel figure', R.figXY.view === 'xy' && R.figXY.panels === 'LR' && R.figXY.images === 2 && R.figXY.deform.length === 0, R.figXY);
await key('m'); await settle(900);
R.figDef = await figDialog();
ok('Deformation exports the filmstrip (or the paths figure)', R.figDef.view === 'morph' && R.figDef.deform.join() === 'Filmstrip,Paths' && R.figDef.images === 4, R.figDef);
await key('m'); await settle(500);
await key('2'); await settle(700);
R.figPhase = await figDialog();
ok('Phase exports one panel (and its ring key)', R.figPhase.view === 'phase' && R.figPhase.images === 2 && R.figPhase.deform.length === 0, R.figPhase);
await key('3'); await settle(900);
R.figLand = await figDialog();
ok('Landscape exports one panel', R.figLand.view === 'land' && R.figLand.images === 1, R.figLand);
// with the deformation on, the one panel is H_t and the caption says so (review: it named F under a picture of H_t)
await key('m'); await settle(900); await ev('__cmwMorph({ T: 0.6 }); 1'); await settle(600);
R.figLandDef = await figDialog();
// (round 3, notes/export-design/ROUND3.md: the deformation exports as a deformation in every view; one frame at t is a
// choice of the Deformation row)
ok('Landscape + Deformation: a filmstrip of H_t, caption of H_t', R.figLandDef.images === 4 && R.figLandDef.deform.join() === 'Filmstrip,One frame' && /^Landscapes of \$H_t\$/.test(R.figLandDef.cap) && /\\log\|H_t\|/.test(R.figLandDef.cap) && !/andscape of \$F/.test(R.figLandDef.cap), R.figLandDef);
await key('2'); await settle(900);
R.figPhaseDef = await figDialog();
ok('Phase + Deformation: a filmstrip of H_t (and the ring key), caption of H_t', R.figPhaseDef.images === 5 && /^Phase portraits of \$H_t\$/.test(R.figPhaseDef.cap) && /\\arg H_t/.test(R.figPhaseDef.cap) && !/portrait of \$F/.test(R.figPhaseDef.cap), R.figPhaseDef);
// X → Y + Deformation on the globe: one panel of the globe of H_t, as on screen (review: the split figure, squashed)
await key('1'); await settle(500); await key('4', 8); await settle(1200);
R.figGlobeDef = await figDialog();
ok('globe deformation exports a filmstrip of globes of H_t (or the paths, or one frame)', R.figGlobeDef.view === 'xyR' && R.figGlobeDef.images === 4 && R.figGlobeDef.deform.join() === 'Filmstrip,Paths,One frame' && /^The deformation \$H_t\$ on the Riemann sphere/.test(R.figGlobeDef.cap), R.figGlobeDef);
await key('3', 8); await settle(500); await key('m'); await settle(600);
// a chain with a d/dz step (no deformation figure): the merged plane, one panel of H_t
await ev(`__cmwExample(12); 1`); await settle(1200);
await key('1'); await settle(500);
await key('m'); await settle(900); await ev('__cmwMorph({ T: 0.5 }); 1'); await settle(600);
R.figDeriv = await figDialog();
ok('d/dz chain deformation exports a filmstrip of the merged plane of H_t', R.figDeriv.view === 'xyR' && R.figDeriv.images === 4 && /H_t/.test(R.figDeriv.cap), R.figDeriv);
await key('m'); await settle(500);
await ev(`__cmwExample(1); 1`); await settle(1200);
await key('1'); await settle(500);

// 6. the hooks the perf and quality suites read
ok('__cmwPaneOf', (await ev(`['image', 'color', '3d', 'sphere'].map((m) => __cmwPaneOf(m)).join('')`)) === 'RLLR', null);
ok('__cmwOtherPane in X → Y', (await ev(`__cmwOtherPane('image')`)) === 'L', await ev(`__cmwOtherPane('image')`));
await ev('__cmwSet("rightMode", "color"); 1'); await settle(500);
ok('__cmwSet rightMode color: Phase, merged', (await vw()).main === 'phase' && (await ev(`__cmwOtherPane('color')`)) === null && (await lay()).merged === 'L', await lay());
await ev('__cmwSet("rightMode", "image"); 1'); await settle(500);
ok('__cmwSet rightMode image: X → Y split', (await vw()).main === 'xy' && (await lay()).merged === null, await lay());
const tm = await ev('__cmwTime(1)');
ok('__cmwTime times both panes in X → Y', tm.left > 0 && tm.right > 0, tm);

// 7. every example opens in the view it was made for (the old rightMode, migrated)
const want = { 'A formula in LaTeX': 'phase', 'A residue by integration': 'phase', 'The derivative in the chain': 'phase', 'Sheets of the logarithm': 'land' };
const exs = [];
for (let i = 0; i < 14; i++) {
  await ev(`__cmwExample(${i}); 1`); await sleep(500);
  const name = await ev(`(document.querySelector('#examplesBtn .exlabel') || {}).textContent || ''`);
  const vv = await vw(), ll = await lay();
  exs.push([i, name, vv.main, ll.deform]);
  ok(`example ${i} ${name}`, vv.main === (want[name] || 'xy') && ll.merged === (vv.main !== 'xy' ? 'L' : ll.deform ? 'R' : null), { vv, ll });
}
R.examples = exs;
const empty = exs.find((x) => /Empty/.test(x[1]));
await ev(`__cmwExample(${empty ? empty[0] : 0}); 1`); await settle(500);
mb = await ev(`({ dis: document.getElementById('morphBtn').getAttribute('aria-disabled'), tip: document.getElementById('morphBtn').dataset.tip })`);
ok('no step: Deformation disabled, says why', mb.dis === 'true' && /Add a function/.test(mb.tip), mb);
await key('m'); await settle(300);
ok('no step: M does not merge', !(await lay()).deform, await lay());

// 8. old saved states open in the equivalent view; the state is written back in the new form
const st = { v3: true, v4: true, v5: true, shapes: [{ kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'pown', params: { n: 2 } }], nextId: 9, focus: 0 };
const loads = [
  [{ rightMode: 'color' }, { main: 'phase' }],
  [{ rightMode: 'image', leftSphere: true }, { main: 'xy', L: 'sphere' }],
  [{ rightMode: '3d', material: 'plaster' }, { main: 'land', D: false }],
  [{ rightMode: 'sphere', sphereMode: 'image', spherePlane: true }, { main: 'xy', R: 'sphere', Req: true }],
  [{ rightMode: 'sphere', sphereMode: 'color' }, { main: 'phase', P: 'sphere' }],
  [{ rightMode: 'morph' }, { main: 'xy', deform: true }],
  [{ rightMode: undefined, v6: true, view: { L: { surf: 'land', phase: true }, R: { surf: 'plane' } } }, { main: 'land', D: true }],
  [{ rightMode: undefined, v6: true, view: { L: { surf: 'sphere', phase: true, eq: true }, R: { surf: 'sphere' } } }, { main: 'phase', P: 'sphere', R: 'sphere' }],
];
const match = (vv, ll, w) => vv.main === w.main && (!w.L || vv.L.surf === w.L) && (!w.R || vv.R.surf === w.R) && (!w.P || vv.P.surf === w.P) && (w.D === undefined || vv.D.phase === w.D) && (!w.Req || vv.R.eq) && (!!w.deform === ll.deform);
for (const [o, w] of loads) {
  const ns = 'mvviewsload' + Date.now();
  await load(ns, Object.assign({}, st, o));
  await settle(600);
  const vv = await vw(), ll = await lay();
  ok(`saved ${JSON.stringify(o)}`, match(vv, ll, w), { vv, ll });
  await sleep(500);
  const saved = await ev(`(() => { const k = 'complex-map-workbench-v1:' + ${JSON.stringify(ns)}; const o = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.removeItem(k); return { legacy: ['rightMode', 'sphereMode', 'leftSphere', 'material', 'spherePlane', 'deform'].filter((x) => x in o), view: o.view }; })()`);
  ok(`saved ${JSON.stringify(o)} rewritten`, !saved.legacy.length && saved.view && saved.view.main === w.main, saved);
}

// 9a. every visible top-bar control fits at phone widths (review: the more menu fell off at 390 and below)
for (const w of [360, 375, 390]) {
  await view(w, 800, false, true);
  await nav((process.env.CMW_BASE || 'http://localhost:8793/') + 'test.html?ns=mvtop' + w);
  await settle(1500);
  const bad = await ev(`(() => { const W = innerWidth, out = []; for (const e of document.querySelectorAll('#top > *')) { if (e.offsetParent === null) continue; const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > W + 0.5 || r.left < -0.5)) out.push([e.id || String(e.className.baseVal || e.className), Math.round(r.left), Math.round(r.right)]); } const m = document.getElementById('hdrMoreBtn').getBoundingClientRect(); if (!(m.width > 0) || m.right > W) out.push(['hdrMoreBtn hidden or cut', m.left, m.right]); return out; })()`);
  ok(`top bar fits at ${w}`, !bad.length, bad);
}
// 9. narrow and dark: the switch and the toggle stay in the bar, no horizontal scroll, one panel per merged view
for (const [w, h, dark, mobile, tag] of [[390, 844, false, true, 'phone_light'], [390, 844, true, true, 'phone_dark'], [1024, 768, true, false, 'tablet_dark'], [1440, 900, true, false, 'desk_dark']]) {
  await view(w, h, dark, mobile);
  await nav((process.env.CMW_BASE || 'http://localhost:8793/') + 'test.html?ns=mvnarrow' + tag);
  await settle(2000);
  await ev('__cmwExample(1); 1'); await settle(800);
  const geo = await ev(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, vsw: (() => { const r = document.getElementById('viewSwitch').getBoundingClientRect(); return [r.left, r.right, r.height]; })(), mb: (() => { const r = document.getElementById('morphBtn').getBoundingClientRect(); return [r.left, r.right]; })() })`);
  ok(`${tag}: no horizontal scroll, controls in the bar`, geo.sw <= geo.iw && geo.vsw[1] <= geo.iw && geo.mb[1] <= geo.iw && geo.vsw[2] > 0, geo);
  await shot(`mv_${tag}_xy`);
  await key('2'); await settle(900);
  ok(`${tag}: Phase is one panel`, (await ev(`getComputedStyle(document.getElementById('paneR')).display`)) === 'none', null);
  await shot(`mv_${tag}_phase`);
  await key('1'); await settle(400);
  await key('m'); await settle(900);
  await ev('__cmwMorph({ T: 0.55 }); 1'); await settle(900);
  const g2 = await ev(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, L: getComputedStyle(document.getElementById('paneL')).display })`);
  ok(`${tag}: deformation is one plane`, g2.L === 'none' && g2.sw <= g2.iw, g2);
  await shot(`mv_${tag}_deform`);
  await key('3'); await settle(1200);
  await shot(`mv_${tag}_land_deform`);
  await key('m'); await settle(300); await key('1'); await settle(300);
}
await view(1440, 900, false, false);
const exc = logs().filter((l) => l.t === 'EXC' || /Uncaught|TypeError|ReferenceError/.test(l.m || ''));
ok('no exceptions', !exc.length, exc.slice(0, 5));
return { pass: !fails.length, fails, R };

// Merged views (notes/ui-design/merged-views.md, revising U-b): the saved-state migration to the top bar's views
// (X → Y · Phase · Landscape) from the single right-pane view of the first builds (rightMode, sphereMode, leftSphere,
// material, spherePlane) and from U-b's pane views (view.L = {surf: plane | sphere | land, phase, eq}), plus the legacy
// round trip the test hooks use, the pane the perf suite drags and the merged pane. A view of Y (an old Y Sphere,
// view.R) is dropped: no view draws Y. Run: node test/t_views.js
const { Views } = require('../src/view.js');
let fails = 0, n = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, got, want) {
  n++;
  if (!eq(got, want)) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); }
}
const sv = (surf = 'plane', e = false) => ({ surf, eq: e });
// a view: main, X → Y's X, the phase panel's surface, the landscape's colouring
const V = (main, o = {}) => ({ main, L: o.L || sv(), P: o.P || sv(), D: { phase: o.D === undefined ? true : o.D } });
const mig = (o) => Views.migrate(Object.assign({}, o));

// the first builds' single view (panels.md 10), row by row
check('image', mig({ rightMode: 'image' }).view, V('xy'));
check('image + leftSphere', mig({ rightMode: 'image', leftSphere: true }).view, V('xy', { L: sv('sphere') }));
check('color', mig({ rightMode: 'color' }).view, V('phase'));
check('color + leftSphere: the portrait on the plane, X → Y keeps the z-sphere', mig({ rightMode: 'color', leftSphere: true }).view, V('phase', { L: sv('sphere') }));
check('3d plaster', mig({ rightMode: '3d', material: 'plaster', dc: 'grid' }), { dc: 'grid', view: V('land', { D: false }), landPlain: false });
check('3d tiles keeps a Tiles-paintable style', mig({ rightMode: '3d', material: 'tiles', dc: 'grid' }), { dc: 'grid', view: V('land'), landPlain: false });
check('3d tiles with Plain: Tiles', mig({ rightMode: '3d', material: 'tiles', dc: 'phase' }), { dc: 'enhanced', view: V('land'), landPlain: false });
check('3d phase material: Plain relief, dc kept', mig({ rightMode: '3d', material: 'phase', dc: 'enhanced' }), { dc: 'enhanced', view: V('land'), landPlain: true });
check('3d no material (the default, phase): Plain relief, dc kept', mig({ rightMode: '3d', dc: 'enhanced' }), { dc: 'enhanced', view: V('land'), landPlain: true });
for (const dc of ['grid', 'cauchy', 'modulus', 'classic']) check(`3d with dc ${dc}: dc kept`, mig({ rightMode: '3d', dc }).dc, dc);
check('3d phase material with Plain: no override needed', mig({ rightMode: '3d', material: 'phase', dc: 'phase' }), { dc: 'phase', view: V('land'), landPlain: false });
check('sphere image: X → Y, its Y Sphere dropped', mig({ rightMode: 'sphere', sphereMode: 'image' }).view, V('xy'));
check('sphere image + plane + leftSphere: X Sphere kept', mig({ rightMode: 'sphere', sphereMode: 'image', spherePlane: true, leftSphere: true }).view, V('xy', { L: sv('sphere') }));
check('sphere (no sphereMode: image)', mig({ rightMode: 'sphere' }).view, V('xy'));
check('sphere color: the phase sphere', mig({ rightMode: 'sphere', sphereMode: 'color' }).view, V('phase', { P: sv('sphere') }));
check('sphere color + plane', mig({ rightMode: 'sphere', sphereMode: 'color', spherePlane: true, leftSphere: true }).view, V('phase', { L: sv('sphere'), P: sv('sphere', true) }));
for (const old of ['preimage', 'integral', 'nonsense', undefined]) check(`old mode ${old}`, mig({ rightMode: old }).view, V('xy'));
// an old Morph view: X → Y, with no deformation flag (the deformation transport is gone)
check('old Morph view: X → Y', mig({ rightMode: 'morph' }).view, V('xy'));
check('no deform flag', ['morph', 'image'].map((m) => 'deform' in mig({ rightMode: m })), [false, false]);
// solo: a wide panel needs none; the split view keeps its expanded pane
check('color solo R: the portrait is a wide panel now', mig({ rightMode: 'color', solo: 'R' }).solo, null);
check('3d solo L (the regions plane): both panes', mig({ rightMode: '3d', solo: 'L' }).solo, null);
check('image solo R: unchanged', mig({ rightMode: 'image', solo: 'R' }).solo, 'R');
check('image solo L: unchanged', mig({ rightMode: 'image', solo: 'L' }).solo, 'L');
check('sphere image solo R: unchanged', mig({ rightMode: 'sphere', sphereMode: 'image', solo: 'R' }).solo, 'R');
check('no solo stays absent', 'solo' in mig({ rightMode: 'color' }), false);
// U-b's pane views (v6) -> the top bar's views
const L6 = (surf, phase = false, e = false) => ({ surf, phase, eq: e });
check('v6 X Plane, Y Plane', mig({ view: { L: L6('plane'), R: sv() } }).view, V('xy'));
check('v6 X Sphere, Y Sphere: Y dropped', mig({ view: { L: L6('sphere'), R: sv('sphere', true) } }).view, V('xy', { L: sv('sphere') }));
check('v6 X Plane + Phase: Phase', mig({ view: { L: L6('plane', true), R: sv('sphere') } }).view, V('phase'));
check('v6 X Sphere + Phase: the phase sphere', mig({ view: { L: L6('sphere', true, true), R: sv() } }).view, V('phase', { L: sv('sphere', true), P: sv('sphere', true) }));
check('v6 Landscape, Phase on', mig({ view: { L: L6('land', true), R: sv() }, landPlain: true, dc: 'grid' }), { view: V('land'), landPlain: true, dc: 'grid' });
check('v6 Landscape, plaster', mig({ view: { L: L6('land', false), R: sv() } }).view, V('land', { D: false }));
check('revision-1 Y phase dropped', mig({ view: { L: L6('plane'), R: { surf: 'plane', phase: true } } }).view, V('xy'));
check('a Y landscape is not a view', mig({ view: { L: L6('land', true), R: { surf: 'land' } } }).view, V('land'));
check('v6 keeps its solo', mig({ view: { L: L6('plane'), R: sv() }, solo: 'R' }).solo, 'R');
// v7 (merged views)
check('no view, no rightMode: the default', mig({}).view, Views.blank());
check('a v7 view is kept', mig({ view: V('phase', { L: sv('sphere'), P: sv('sphere', true), D: false }) }).view, V('phase', { L: sv('sphere'), P: sv('sphere', true), D: false }));
check('a v7 view\'s Y is dropped', mig({ view: Object.assign(V('xy'), { R: sv('sphere', true) }) }).view, V('xy'));
check('rightMode wins over a stale view', mig({ rightMode: 'color', view: V('land') }).view, V('phase'));
check('clean junk', Views.clean({ main: 'cube', L: { surf: 'cube', phase: 1 }, R: 7 }), V('phase'));
check('clean junk v7', Views.clean({ main: 'land', L: 3, P: { surf: 'land' }, D: 'x' }), V('land'));
{
  const o = mig({ rightMode: 'sphere', sphereMode: 'color', leftSphere: true, material: 'tiles', spherePlane: true, dc: 'grid' });
  check('legacy fields removed', Views.LEGACY.filter((k) => k in o), []);
}
// toLegacy -> migrate keeps the picture (the hooks' __cmwSet('rightMode', ...))
for (const v of [V('xy'), V('xy', { L: sv('sphere') }), V('phase'), V('land', { D: false }), V('land'), V('phase', { P: sv('sphere', true) })]) for (const dc of ['enhanced', 'phase', 'grid']) {
  const o = Object.assign(Views.toLegacy(v, dc), { dc });
  Views.migrate(o);
  check(`round trip ${JSON.stringify(v)} ${dc}`, { x: Views.xOf(o.view), main: o.view.main, dc: o.dc, landPlain: o.landPlain },
    { x: Views.xOf(v), main: v.main, dc, landPlain: false });
}
{
  const o = Object.assign(Views.toLegacy(V('land'), 'grid', true), { dc: 'grid' });
  Views.migrate(o);
  check('round trip landPlain', { view: o.view, dc: o.dc, landPlain: o.landPlain }, { view: V('land'), dc: 'grid', landPlain: true });
}
// xOf: X's picture in each view
check('xOf xy', Views.xOf(V('xy', { L: sv('sphere', true) })), { surf: 'sphere', phase: false, eq: true });
check('xOf phase', Views.xOf(V('phase', { P: sv('sphere') })), { surf: 'sphere', phase: true, eq: false });
check('xOf land plaster', Views.xOf(V('land', { D: false })), { surf: 'land', phase: false, eq: false });
// the merged pane: Phase and Landscape are one wide left pane; X → Y is split
check('merged', [Views.merged(V('xy')), Views.merged(V('phase')), Views.merged(V('land'))], [null, 'L', 'L']);
// the pane that shows the picture an old rightMode named (perf suite, layout-aware units)
check('paneOf', ['image', 'color', '3d', 'sphere'].map((m) => Views.paneOf(m)).concat(Views.paneOf('sphere', 'color')), ['R', 'L', 'L', 'R', 'L']);
console.log(fails ? `${fails} of ${n} FAILED` : `all ${n} passed`);
process.exit(fails ? 1 : 0);

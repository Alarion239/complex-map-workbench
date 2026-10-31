// Unit checks of the tour engine's geometry added in the polish round (notes/tour/POLISH.md): the exact spotlight path
// (rrPath with per-corner radii) and the clipped-away rule. (notes/tour-r3/SPEC.md 1.4: the callout's placement,
// place() with the safe area and open layers, and the docked callout, placeDock and dockGutter, are gone with the
// callout; the strip is in the layout.) DOM-free: node test/t_tour_engine.js
const { Tour } = require('../src/tour.js');
const T = Tour._t;
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
// rrPath: per-corner radii, and the bounding box is the rect exactly
const path = T.rrPath({ l: 10, t: 20, r: 110, b: 60, rad: [6, 6, 0, 0] });
const nums = path.match(/-?[\d.]+/g).map(Number);
ok('rrPath: per-corner radii', /A6 6 0 0 1 110 26/.test(path) && /A0 0 0 0 1 100 60|A0 0 0 0 1 110 60/.test(path), path);
ok('rrPath: a single radius still works', /A8 8/.test(T.rrPath({ l: 0, t: 0, r: 100, b: 50, rad: 8 })));
ok('rrPath: radii never exceed half the side', !/A30 /.test(T.rrPath({ l: 0, t: 0, r: 40, b: 40, rad: 30 })));
ok('rrPath: numbers present', nums.length > 10);
// the review of the polish round (notes/tour/review-polish.json)
// polish-1: a part cut to nothing by a panel that cannot scroll is clipped away; one bigger than its panel is not
const box = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b });
ok('clipped away: the transport below the squeezed panes (0 px left)', T.clippedAway(box(92, 77, 752, 117), { clip: { l: 91, t: 44, r: 753, b: 68 } }));
ok('clipped away: a sliver of 4 px of a 40 px control', T.clippedAway(box(0, 64, 100, 104), { clip: { l: 0, t: 0, r: 400, b: 68 } }));
ok('clipped away: 20 % of a control that would fit', T.clippedAway(box(0, 60, 100, 110), { clip: { l: 0, t: 0, r: 400, b: 70 } }));
ok('not clipped away: whole', !T.clippedAway(box(10, 10, 100, 40), { clip: { l: 0, t: 0, r: 400, b: 300 } }));
ok('not clipped away: no clipping panel (the viewport is not one)', !T.clippedAway(box(10, -100, 100, -60), { clip: null }));
ok('not clipped away: bigger than its panel, its visible part is lit', !T.clippedAway(box(0, 0, 100, 2000), { clip: { l: 0, t: 0, r: 400, b: 300 } }));
ok('no placement left (v16.4)', !T.place && !T.placeDock && !T.placeMini && !T.dockGutter);
console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

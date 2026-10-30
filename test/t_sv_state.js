// The steps view's saved state (#366 issue C): S.sv = {at, T, scope, surf} is repaired by Views.cleanSv, survives
// JSON (a save, a link and an undo entry are all JSON of it), and an old view opens on its equivalent (Views.svOf).
// Run: node test/t_sv_state.js
const { Views } = require('../src/view.js');
let fails = 0, n = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, got, want) { n++; if (!eq(got, want)) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } }
const P = [0, 1, 2, 3];   // z and three active steps
const ok = { at: 1.4, T: 2, scope: 'in', surf: 'sphere' };
check('no sv: none', Views.cleanSv(undefined, P), null);
check('not an object: none', Views.cleanSv('x', P), null);
check('an array: none', Views.cleanSv([1], P), null);
check('valid, with a fractional at', Views.cleanSv(ok, P), ok);
// the round trips: a save, a link (JSON through the state) and an undo entry
for (const via of ['save', 'link', 'undo']) check('round trip ' + via + ' keeps a fractional at', Views.cleanSv(JSON.parse(JSON.stringify({ sv: ok })).sv, P), ok);
check('at past the last plane is clamped', Views.cleanSv({ ...ok, at: 9.5 }, P).at, 3);
check('negative at is clamped', Views.cleanSv({ ...ok, at: -2 }, P).at, 0);
check('NaN / string at is 0', [Views.cleanSv({ ...ok, at: NaN }, P).at, Views.cleanSv({ ...ok, at: '1' }, P).at], [0, 0]);
check('a shorter chain clamps at', Views.cleanSv(ok, [0, 1]).at, 1);
check('T the shorter chain lacks is the last plane (-1)', Views.cleanSv(ok, [0, 1]).T, -1);
check('T equal to the last plane is -1', Views.cleanSv({ ...ok, T: 3 }, P).T, -1);
check('fractional T is -1', Views.cleanSv({ ...ok, T: 1.5 }, P).T, -1);
check('a bypassed step is not a plane for T', Views.cleanSv({ ...ok, T: 2 }, [0, 1, 3]).T, -1);
check('unknown scope', Views.cleanSv({ ...ok, scope: 'x' }, P).scope, 'all');
check('unknown surface', Views.cleanSv({ ...ok, surf: 'cube' }, P).surf, 'plane');
check('missing fields take defaults', Views.cleanSv({}, P), { at: 0, T: -1, scope: 'all', surf: 'plane' });
check('idempotent', Views.cleanSv(Views.cleanSv({ ...ok, at: 9 }, P), P), Views.cleanSv({ ...ok, at: 9 }, P));
check('no planes given still returns a state', Views.cleanSv(ok, null).at, 0);
// old states: X → Y, Phase, Landscape (concept §6), from their legacy links as migrate reads them
const old = (o, areas) => Views.svOf(Views.migrate(Object.assign({}, o)).view, areas);
check('X → Y with areas: Inside regions at the last plane', old({ rightMode: 'image' }, true), { at: 0, T: -1, scope: 'in', surf: 'plane' });
check('X → Y without areas: everywhere', old({ rightMode: 'image' }, false).scope, 'all');
check('X → Y on the z-sphere keeps the sphere', old({ rightMode: 'image', leftSphere: true }, false).surf, 'sphere');
check('Phase: last plane, coloured everywhere (even with areas)', old({ rightMode: 'color' }, true), { at: 0, T: -1, scope: 'all', surf: 'plane' });
check('Phase on the sphere', old({ rightMode: 'sphere', sphereMode: 'color' }, false).surf, 'sphere');
check('Landscape: the relief', old({ rightMode: '3d' }, true), { at: 0, T: -1, scope: 'all', surf: 'land' });
check('a U-b view (no main) with the landscape', old({ view: { L: { surf: 'land', phase: true } } }, false).surf, 'land');
check('no view at all: X → Y', old({}, false).surf, 'plane');
console.log(fails ? `${fails} of ${n} failed` : `all ${n} passed`);
process.exit(fails ? 1 : 0);

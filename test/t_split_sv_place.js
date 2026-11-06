// The steps view's place after a Split of step k into n steps (Funcs.splitSvPlace): the thread keeps its picture. A place in
// planes goes through splitMorphT on the formula's unit [j, j+1), a stage past the formula goes up by n-1, the formula's own plane
// goes to its last new step, a step shown alone past the formula moves with it, and a bypassed step (j < 0) moves no place.
// Run: node test/t_split_sv_place.js
global.CX = require('../src/cx.js'); global.Expr = require('../src/parse.js');
const Funcs = global.Funcs = require('../src/funcs.js'); global.Region = require('../src/region.js');
let fails = 0, n = 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const check = (name, got, want) => { n++; if (!eq(got, want)) { fails++; console.log('FAIL', name, '\n  got ', JSON.stringify(got), '\n  want', JSON.stringify(want)); } };
const P = (o, k, N, j) => Funcs.splitSvPlace(Object.assign({ x: 0, rest: true, T: -1, alone: 0, back: null }, o), k, N, j);
// step 2 (j = 1) split into 3: x < j, in [j, j+1), at j+1, past it
for (const [x, want] of [[0.5, 0.5], [1, 1], [1.5, 2.5], [1.25, 1.75], [2, 4], [2.5, 4.5]]) {
  check('x ' + x, P({ x }, 2, 3, 1).x, want);
  check('x ' + x + ' = splitMorphT', P({ x }, 2, 3, 1).x, Funcs.splitMorphT(x, 1, 3));
}
check('not at rest: x kept', P({ x: 1.5, rest: false }, 2, 3, 1).x, 1.5);
check('colour plane before', P({ T: 1 }, 2, 3, 1).T, 1);
check('colour plane on the formula: its last step', P({ T: 2 }, 2, 3, 1).T, 4);
check('colour plane past it', P({ T: 3 }, 2, 3, 1).T, 5);
check('colour plane: the last plane stays -1', P({ T: -1 }, 2, 3, 1).T, -1);
check('alone before', P({ alone: 1 }, 2, 3, 1).alone, 1);
check('alone on the formula: its first new step', P({ alone: 2 }, 2, 3, 1).alone, 2);
check('alone past it', P({ alone: 3 }, 2, 3, 1).alone, 5);
check('alone: x kept', P({ alone: 3, x: 0.5 }, 2, 3, 1).x, 0.5);
check('back place and colour', P({ alone: 3, back: { i: 1.5, T: 2 } }, 2, 3, 1).back, { i: 2.5, T: 4 });
check('bypassed: no place moves', [P({ x: 1.5 }, 2, 3, -1).x, P({ T: 3 }, 2, 3, -1).T], [1.5, 5]);
console.log(n - fails + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);

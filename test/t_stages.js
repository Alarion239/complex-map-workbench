// Shapes in the planes of the chain (#253): Funcs.stageFollow, the plane a shape of stage k lands in after the chain
// is edited (the step objects before and after): it follows the step whose output it is; when that step is gone, the
// plane before the first later step still in the chain (a removed step's input, a replaced step's output, after the
// last of a split's steps), or the end of the chain; 0 is the z-plane.
// Run: node test/t_stages.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
let bad = 0, n = 0;
const check = (name, got, want) => { n++; if (got !== want) { bad++; console.log('FAIL', name, 'got', got, 'want', want); } };
const [a, b, c, d, x, y] = [{ t: 'a' }, { t: 'b' }, { t: 'c' }, { t: 'd' }, { t: 'x' }, { t: 'y' }];
const old = [a, b, c, d];   // plane 2 is the output of b
const F = (cur, k) => Funcs.stageFollow(old, cur, k);
check('nothing changed', F([a, b, c, d], 2), 2);
check('a step inserted before it moves it on', F([x, a, b, c, d], 2), 3);
check('a step inserted after it leaves it', F([a, b, x, c, d], 2), 2);
check('a step before it removed moves it back', F([b, c, d], 2), 1);
check('its own step removed: that step\'s input plane', F([a, c, d], 2), 1);
check('its own step replaced: the new step\'s output', F([a, x, c, d], 2), 2);
check('its own step split in two: after the last of them', F([a, x, y, c, d], 2), 3);
check('its step moved later: it goes with it', F([a, c, b, d], 2), 3);
check('the last step removed: the new end', F([a, b, c], 4), 3);
check('the first step removed, a shape of its output: the z-plane', F([b, c, d], 1), 0);
check('the chain cleared: the z-plane', F([], 3), 0);
check('the z-plane stays the z-plane', F([x, a, b, c, d], 0), 0);
check('a stage past the old chain is clamped', Funcs.stageFollow([a], [a, b], 3), 2);
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);

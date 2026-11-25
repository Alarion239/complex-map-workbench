// ci/glprof.js's walks name examples by their English names (src/app/15-examples-guide.js): every name the extended and
// mountain walks use is an example's (and the steps walk's, #439), read by ci/steps_scenes.js's exampleNames (as glprof's exampleIndex does), and the GPU gate offers each walk. Node only.
// Run: node test/t_glprof_walks.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SC = require('../ci/steps_scenes');
const G = fs.readFileSync(path.join(ROOT, 'ci', 'glprof.js'), 'utf8');
const W = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'gpu-gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

// the examples' names as glprof's exampleIndex reads them
const names = SC.exampleNames(ROOT);
ok('the examples are found', names.length > 20, names.length);
const list = /const EXTENDED_EXAMPLES = (\[[^\n]*\]);/.exec(G);
const mk = /const MOUNTAIN_KING = ('[^'\n]*');/.exec(G);
ok('glprof names its extended examples and the Mountain King', !!list && !!mk);
const ext = list ? JSON.parse(list[1].replace(/'/g, '"')) : [];
for (const n of ext) ok(`extended: "${n}" is an example`, names.includes(n));
const king = mk ? mk[1].slice(1, -1) : '';
ok(`mountain: "${king}" is an example`, names.includes(king));
ok('glprof accepts the five walks', /\['all', 'quick', 'extended', 'mountain', 'steps'\]\.includes\(WALK\)/.test(G));
ok('the GPU gate offers them', /options: \[all, extended, quick, mountain, steps\]/.test(W));
// (#439) the steps walk's examples: names, or the Mountain King
const sw = /function stepsWalk\(\) \{[\s\S]*?for \(const nm of \[([^\]]*)\]\)/.exec(G);
ok('glprof names the steps walk\'s examples', !!sw);
for (const n of sw ? sw[1].split(',').map((x) => x.trim()) : []) {
  const nm = n === 'MOUNTAIN_KING' ? king : n.replace(/^'|'$/g, '');
  ok(`steps: "${nm}" is an example`, names.includes(nm));
}
const kingWalk = G.slice(G.indexOf('function mountainKing'), G.indexOf('// --walk steps'));
ok('the mountain walk opens the Landscape (landEdgeS, #395) and the glide (#355) in the steps view', /SC\.main\('land'\)/.test(kingWalk) && /SC\.glide\('last'\)/.test(kingWalk) && !/__cmw(SetMain|Morph)/.test(G));
// (#2067) the steps walk's rest before its first glide waits for the glides' warm-up (true at once without it), and the
// glide's first frame by the inverse pass is timed, against a glide record taken before the key
const stepsWalkSrc = G.slice(G.indexOf('function stepsWalk'), G.indexOf('function extended'));
const restU = /const STEPS_REST = "([^"]*)";/.exec(G), glideU = /const STEPS_GLIDE = "([^"]*)";/.exec(G);
ok('steps: the rest waits for __cmwSteps().invWarm, and only where the hook has it (!== false)', !!restU && /invWarm/.test(restU[1]) && /!== false/.test(restU[1]));
ok('steps: the glide\'s until is its first inverse frame (or its end) in a new glide record', !!glideU && /path === 'inverse'/.test(glideU[1]) && /window\.__gpGlide0/.test(glideU[1]) && /!q\.moving/.test(glideU[1]));
ok('steps: the rest step and the glide step use them, the glide step taking the record before its key', /until: STEPS_REST/.test(stepsWalkSrc) && /window\.__gpGlide0 = __cmwSteps\(\)\.glide, \$\{svKey\('PageDown'\)\}/.test(stepsWalkSrc) && /until: STEPS_GLIDE/.test(stepsWalkSrc));
// the two conditions as statements: a page whose hook has no invWarm (a build without the warm-up) passes the rest at once
for (const [nm, src] of [['rest', restU && restU[1]], ['glide', glideU && glideU[1]]]) {
  let parsed = true;
  try { new Function(`return ${src};`); } catch (e) { parsed = false; }
  ok(`steps: the ${nm} condition parses`, !!src && parsed);
}
if (restU) {
  const at = (v) => new Function('__cmwSteps', `return ${restU[1]};`)(() => (v === undefined ? {} : { invWarm: v }));
  ok('steps: the rest condition is true without the hook\'s invWarm, false while the warm-up runs, true once done', at(undefined) === true && at(false) === false && at(true) === true);
}
if (glideU) {
  const g0 = { path: 'inverse' }, at = (g, moving) => { global.window = { __gpGlide0: g0 }; return new Function('__cmwSteps', `return ${glideU[1]};`)(() => ({ glide: g, moving })); };
  ok('steps: the glide condition waits for a new record, then its inverse frame or the glide\'s end', at(g0, true) === false && at({ path: 'mesh' }, true) === false && at({ path: 'inverse' }, true) === true && at({ path: 'mesh' }, false) === true && at(null, true) === false);
}
console.log(`t_glprof_walks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

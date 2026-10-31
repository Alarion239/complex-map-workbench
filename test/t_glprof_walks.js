// ci/glprof.js's walks name examples by their English names (src/app/15-examples-guide.js): every name the extended and
// mountain walks use is an example's (and the steps walk's, #439), read with glprof's own pattern, and the GPU gate offers each walk. Node only.
// Run: node test/t_glprof_walks.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const G = fs.readFileSync(path.join(ROOT, 'ci', 'glprof.js'), 'utf8');
const W = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'gpu-gate.yml'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

// the examples' names as glprof's exampleIndex reads them
const src = fs.readFileSync(path.join(ROOT, 'src', 'app', '15-examples-guide.js'), 'utf8');
const names = [...src.matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
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
ok('the mountain walk opens the Landscape (landEdgeS, #395) and the deformation (#355)', /__cmwSetMain\('land'\)/.test(G.slice(G.indexOf('function mountainKing'))) && /__cmwMorph\(\{ open: true, T: 0\.5 \}\)/.test(G.slice(G.indexOf('function mountainKing'), G.indexOf('function extended'))));
console.log(`t_glprof_walks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

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
ok('glprof accepts the six walks', /\['all', 'quick', 'extended', 'mountain', 'steps', 'typed'\]\.includes\(WALK\)/.test(G));
ok('the GPU gate offers them', /options: \[all, extended, quick, mountain, steps, typed\]/.test(W));
// (#439) the steps walk's examples: names, or the Mountain King
const sw = /function stepsWalk\(\) \{[\s\S]*?for \(const nm of \[([^\]]*)\]\)/.exec(G);
ok('glprof names the steps walk\'s examples', !!sw);
for (const n of sw ? sw[1].split(',').map((x) => x.trim()) : []) {
  const nm = n === 'MOUNTAIN_KING' ? king : n.replace(/^'|'$/g, '');
  ok(`steps: "${nm}" is an example`, names.includes(nm));
}
const kingWalk = G.slice(G.indexOf('function mountainKing'), G.indexOf('// --walk steps'));
ok('the mountain walk opens the Landscape (landEdgeS, #395) and the glide (#355) in the steps view', /SC\.main\('land'\)/.test(kingWalk) && /SC\.glide\('last'\)/.test(kingWalk) && !/__cmw(SetMain|Morph)/.test(G));
// (--walk typed) every formula of the typed walk's corpus builds as a custom step, and the walk types only what fits its limit
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
global.GLChain = require('../src/glsl.js');
const P = require('../src/params.js');
P._local([]);
const { CORPUS, START } = require('../ci/glprof_typed.js');
const build = (expr) => Funcs.build({ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr, cut: 180 }), on: true });
ok('the typed walk has its corpus', CORPUS.length === 9, CORPUS.length);
for (const e of [START, ...CORPUS.flatMap((c) => c.steps || [c.expr])]) {
  let b = null;
  try { b = build(e); } catch (err) { b = { error: String(err) }; }
  ok(`typed: "${e.slice(0, 40)}" builds`, !!b && !b.error, b && b.error);
}
ok('typed: five Moebius maps in five steps and in one formula', CORPUS.some((c) => c.steps && c.steps.length === 5) && CORPUS.some((c) => c.expr && c.expr.length > 100));
console.log(`t_glprof_walks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

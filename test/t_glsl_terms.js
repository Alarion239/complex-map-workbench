// The GLSL of a sum that is a loop (src/glsl.js, loopGL): a pixel takes at most SER_GPU_TERMS terms in all, across every sum of a
// step, so its time is bounded however the sums nest. The step's function declares the pixel's terms left once (a float, at the top);
// the loop with no sum inside it counts its iterations down from there (each one a term) and fails when they are spent, and every
// loop around it stops once they are. A chain with no sum, and one whose sums are all power or Dirichlet series (no loop), has none.
// (The CPU's twin, Expr's SER_BUDGET, is pinned in test/t_sum_caps.js.) The values are the glsl pages' (node ci/glsl.js --only series).
// Run: node test/t_glsl_terms.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const GLChain = require('../src/glsl.js');
global.GLChain = GLChain;
const P = require('../src/params.js');
P._local([]);
let fails = 0, n = 0;
const ok = (c, msg, info) => { n++; if (!c) { fails++; console.log('FAIL', msg, info === undefined ? '' : JSON.stringify(info)); } };
const custom = (expr) => ({ type: 'custom', params: Object.assign(Funcs.defaults('custom'), { expr, cut: 180 }), on: true });
const source = (expr) => {
  const steps = [custom(expr)], built = Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s)));
  return GLChain.build(steps, built).source;
};
const count = (text, re) => (text.match(re) || []).length;
const DECL = /float \w+_tl = (\d+)\.0;/g, DEC = /\w+_tl -= 1\.0;/g, STOP = /if \(\w+_tl < 0\.0\)/g;
ok(GLChain.TERMS_BUDGET === 2048, 'the budget is 2048 terms', GLChain.TERMS_BUDGET);
const nested = source('\\sum_{m=1}^{\\infty} \\sum_{n=1}^{40} \\frac{1}{(m+n+z)^2}');
ok(count(nested, DECL) === 1 && new RegExp(`float \\w+_tl = ${Expr.SER_BUDGET}\\.0;`).test(nested), 'a nested sum: the pixel\'s terms are declared once, at the budget', count(nested, DECL));
ok(count(nested, DEC) === 1, 'a nested sum: only the loop with no sum inside it counts a term', count(nested, DEC));
ok(count(nested, STOP) === 2, 'a nested sum: each of its two loops stops when the terms are spent', count(nested, STOP));
const single = source('\\sum_{n=1}^{\\infty} \\frac{\\sin(n z)}{2^n}');
ok(count(single, DECL) === 1 && count(single, DEC) === 1 && count(single, STOP) === 1, 'a single loop sum: one declaration, one count, one stop', { decl: count(single, DECL), dec: count(single, DEC), stop: count(single, STOP) });
const deep = source('\\sum_{a=1}^{4} \\sum_{b=1}^{4} \\sum_{c=1}^{4} \\frac{1}{(a+b+c+z)^2}');
ok(count(deep, DEC) === 1 && count(deep, STOP) === 3, 'three nested loops: the innermost counts, all three stop', { dec: count(deep, DEC), stop: count(deep, STOP) });
for (const [tag, expr] of [['a chain with no sum', 'z^2+1'], ['a power series (no loop)', '\\sum_{n=0}^{\\infty} \\frac{z^n}{n!}'], ['a Dirichlet series (no loop)', '\\sum_{n=1}^{\\infty} n^{-z}']]) {
  const src = source(expr);
  ok(count(src, DECL) === 0 && count(src, DEC) === 0 && count(src, STOP) === 0, `${tag}: no terms counter`, { decl: count(src, DECL), dec: count(src, DEC), stop: count(src, STOP) });
}
console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(fails ? 1 : 0);

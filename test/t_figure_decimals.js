// The figure's tick precision (#2146): XD.decimals (src/figure/01-composer.js, as Figure.geom.decimals) is the fewest decimals that
// represent a tick step, the same for every step the figures use (1, 0.5, 0.25, 0.1, 0.01, 1000, ...) and right below 1e-6 and 1e-9, where
// an absolute tolerance read a step as a whole number (5e-11 gave 0) and the count stopped at 6. Run: node test/t_figure_decimals.js
const vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js');
global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js');
global.Region = require(R + '/src/region.js');
global.window = global;
vm.runInThisContext(require('./src_text').source('figure.js', R + '/src', { esm: 'strip' }) + '\n;globalThis.Figure = Figure;', { filename: 'figure.js' });
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const decimals = Figure.geom && Figure.geom.decimals;
ok(typeof decimals === 'function', 'Figure.geom.decimals is XD.decimals');
for (const [step, want] of [[1, 0], [2, 0], [5, 0], [10, 0], [1000, 0], [0.5, 1], [0.2, 1], [0.1, 1], [0.05, 2], [0.25, 2], [0.01, 2], [0.001, 3],
  [0.30000000000000004, 1], [2e-7, 7], [1e-8, 8], [5e-11, 11], [1e-9, 9], [2.5e-10, 11], [1e-12, 12]]) {
  const got = typeof decimals === 'function' ? decimals(step) : null;
  ok(got === want, `decimals(${step}) is ${want}`, got);
}
// every nice step (1, 2 or 5 times a power of ten) from 1e-11 to 1e4 reads as the digits it has
for (let e = -11; e <= 4; e++) for (const m of [1, 2, 5]) {
  const step = +(m + 'e' + e), want = Math.max(0, -e), got = typeof decimals === 'function' ? decimals(step) : null;
  ok(got === want, `decimals(${m}e${e}) is ${want}`, got);
}
console.log(`${pass}/${pass + fail} passed${fail ? ', ' + fail + ' FAILED' : ''}`);
process.exit(fail ? 1 : 0);

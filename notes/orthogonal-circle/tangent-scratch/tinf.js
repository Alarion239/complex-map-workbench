// T -> inf along a line C: touch(C, T, P) tends to the parallel through P (= touch(C, inf, P)). Run with node.
'use strict';
const path = require('path');
const K = require(path.join(__dirname, '../../v16.2-candidate/src/constr.js'));
const src = require('fs').readFileSync(path.join(__dirname, 'texp.js'), 'utf8');
// reuse touchZ from texp.js without running its report: evaluate only the definitions
const defs = src.split('// ---------------------------------------------------------------- measuring')[0].replace(/^'use strict';/m, '');
const M = new Function('require', '__dirname', defs + '; return { touchZ, tangentZ };')(require, __dirname);
const C = K.line2([0, 0], [1, 0.5]), P = [0.3, 1], probes = [[0.3, -0.4], [-0.7, 0.1], [2, 2]];
const par = M.touchZ(C, 'inf', P);
for (const k of [1, 3, 6, 9, 12, 15]) for (const sg of [1, -1]) {
  const T = [sg * 10 ** k, sg * 0.5 * 10 ** k];
  const Kf = M.touchZ(C, T, P);
  const d = Math.max(...probes.map((z) => Math.abs(K.fOf(Kf, z) - K.fOf(par, z))));
  console.log(`T = ${sg > 0 ? '+' : '-'}1e${k} along C: max level difference from the parallel ${d.toExponential(1)}`);
}

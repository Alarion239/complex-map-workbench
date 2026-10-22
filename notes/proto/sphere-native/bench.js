'use strict';
// Benchmark: every acceptance case, CPU ms = median of 3 runs (after a JIT warm-up), quality from the last run.
//   node notes/proto/sphere-native/bench.js [filter...]   -> table on stdout, results.json next to this file
const path = require('path');
const fs = require('fs');
const R = require('./run_cases.js');
const { Mesher } = require('./sphm.js');

const args = process.argv.slice(2);
const sel = R.CASES.filter((c) => !args.length || args.some((a) => c.name === a || c.name.startsWith(a)));
R.runCase(R.CASES[0]);   // warm-up
const rows = [];
for (const cs of sel) {
  const ms = [];
  for (let k = 0; k < 2; k++) {
    const M = Mesher({ F: cs.F, shape: cs.shape, left: Object.assign({ W: 410, H: 516 }, cs.left), view: cs.view, pattern: cs.pattern, cell: cs.cell, alpha: cs.alpha ?? 1, guard: cs.guard ?? 1 });
    ms.push(M.run(20000).ms);
  }
  const r = R.runCase(cs);
  ms.push(r.ms);
  ms.sort((a, b) => a - b);
  r.ms_median = +ms[1].toFixed(1);
  rows.push(r);
  const L = r.leaves;
  console.log(`| ${r.name} | ${r.ms_median} | ${r.nodes} | ${r.evals} | ${L.final} | ${r.out_tris} | ${L.culled} | ${L.saturated} | ${L.dropped} | ${r.dev_max_px} | ${r.dev_p999_px} | ` +
    (r.iou != null ? `${r.iou.toFixed(4)} | ${r.hole_px} | ${r.spill_px} | ` : '- | - | - | ') +
    (r.parity_scored != null ? `${r.parity_wrong}/${r.parity_scored}` : '-') + ' | ' +
    (r.zi_hole_px != null ? `${r.zi_hole_covered}/${r.zi_hole_px}` : r.hole_samples != null ? `${r.hole_samples_covered}/${r.hole_samples}` : '-') + ' |');
}
fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(rows, (k, v) => (k === 'out' ? undefined : v), 1));

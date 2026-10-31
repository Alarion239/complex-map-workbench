#!/usr/bin/env node
'use strict';
// The layout ratchet (#470): the violations of test/layout_invariants_cmd.js may not grow beyond ci/layout_baseline.json,
// and the baseline only shrinks, as ci/lint_ratchet.js does for lint. A violation is a row of the suite's report, keyed
// by its boxes' structure (test/lib/layout.js key()); the baseline holds, per run (en, ru, it), each row's key and the
// number of matrix points it was seen at. A key the baseline lacks fails; a key the baseline has and the run did not
// see is fixed: lower the baseline. The counts are reported, not gated (on software GL a row is seen at a point or
// two more or less from run to run).
//   node ci/layout_ratchet.js check RESULT.json...    exit 1 on a new key
//   node ci/layout_ratchet.js update RESULT.json...   write the runs' keys as the baseline (refused on a new key;
//                                                     --init writes them all, for the first baseline)
// RESULT.json: ci/browser.js's result of a run (.ci/browser/layout_invariants_cmd.js_<label>.json), or the suite's own
// result ({ report, label }).
const fs = require('fs');
const path = require('path');

const BASELINE = process.env.CMW_LAYOUT_BASELINE || path.join(__dirname, 'layout_baseline.json');   // (the env: test/t_layout_ratchet.js)
const argv = process.argv.slice(2);
const mode = argv[0], init = argv.includes('--init'), files = argv.slice(1).filter((a) => a !== '--init');
if (!['check', 'update'].includes(mode) || !files.length) {
  console.error('usage: node ci/layout_ratchet.js check|update [--init] RESULT.json...');
  process.exit(2);
}
const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { runs: {} };
const runs = {};
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const out = j.out || j, label = j.run || out.label || (out.info && out.info.label);
  if (!out || !Array.isArray(out.report) || !label) { console.error(`${f}: not a layout_invariants_cmd.js result with a label`); process.exit(2); }
  runs[label] = Object.fromEntries(out.report.map((r) => [r.id, r.n]));
}
let grew = false;
const lines = [];
for (const [label, now] of Object.entries(runs)) {
  const b = base.runs[label] || {};
  const added = Object.keys(now).filter((k) => !(k in b)), fixed = Object.keys(b).filter((k) => !(k in now));
  if (added.length) grew = true;
  lines.push(`${label}: ${Object.keys(now).length} rows (baseline ${Object.keys(b).length})${added.length ? `; NEW: ${added.join('; ')}` : ''}${fixed.length ? `; fixed, lower the baseline: ${fixed.join('; ')}` : ''}`);
}
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Layout ratchet\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n`);
if (mode === 'update') {
  if (grew && !init) { console.error('refusing to add to the baseline: fix the new violations, or declare them in the suite with a reason'); process.exit(1); }
  const next = { about: 'test/layout_invariants_cmd.js: per run, each violation row\'s key and the matrix points it was seen at (ci/layout_ratchet.js)', runs: Object.assign({}, base.runs, runs) };
  fs.writeFileSync(BASELINE, JSON.stringify(next, null, 1) + '\n');
  console.log('baseline written');
} else if (grew) {
  console.error('layout ratchet: new violations (fix them, or declare them in DECLARED of test/layout_invariants_cmd.js with a reason)');
  process.exit(1);
}

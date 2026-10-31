#!/usr/bin/env node
'use strict';
// The layout ratchet (#470): the violations of test/layout_invariants_cmd.js may not grow beyond ci/layout_baseline.json,
// and the baseline only shrinks, as ci/lint_ratchet.js does for lint. A violation is a row of the suite's report, keyed
// by its boxes' structure (test/lib/layout.js key()); the baseline holds, per run (en, ru, it), the matrix and renderer it
// was made over, the states that did not open, and each row's key with the number of matrix points it was seen at. A
// key the baseline lacks fails; a key the baseline has and the run did not see is fixed: lower the baseline. The counts
// are reported, not gated (on software GL a row is seen at a point or two more or less from run to run). Another
// matrix needs --init; the suite gates only on the baseline's renderer (CI's lavapipe), and so does check here.
//   node ci/layout_ratchet.js check RESULT.json...    exit 1 on a new key
//   node ci/layout_ratchet.js update RESULT.json...   write the runs' keys as the baseline (refused on a new key;
//                                                     --init: for a run with no baseline, or one made over
//                                                     another matrix or renderer; --rules: the checks themselves
//                                                     changed in this diff (test/lib/layout.js, the suite's DECLARED),
//                                                     and their new keys are taken in (tiers on #499))
// RESULT: ci/browser.js's result of a run (.ci/browser/layout_invariants_cmd.js_<label>.json), the suite's own result
// ({ report, label }), or a job's log (its LAYOUT-RESULT lines: ci/browser_suites.js logLine), as saved from GitHub.
const fs = require('fs');
const path = require('path');

const BASELINE = process.env.CMW_LAYOUT_BASELINE || path.join(__dirname, 'layout_baseline.json');   // (the env: test/t_layout_ratchet.js)
const argv = process.argv.slice(2);
const mode = argv[0], init = argv.includes('--init'), rules = argv.includes('--rules'), files = argv.slice(1).filter((a) => !/^--(init|rules)$/.test(a));
if (!['check', 'update'].includes(mode) || !files.length) {
  console.error('usage: node ci/layout_ratchet.js check|update [--init|--rules] RESULT.json|JOB.log...');
  process.exit(2);
}
const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { runs: {} };
const runs = {};
const results = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const lines = text.split('\n').map((l) => /LAYOUT-RESULT (\{.*\})\s*$/.exec(l)).filter(Boolean);
  if (lines.length) { for (const m of lines) results.push([f, JSON.parse(m[1])]); continue; }
  results.push([f, JSON.parse(text)]);
}
for (const [f, j] of results) {
  const out = j.out || j, label = j.run || out.label || (out.info && out.info.label);
  if (!out || !Array.isArray(out.report) || !label) { console.error(`${f}: not a layout_invariants_cmd.js result with a label`); process.exit(2); }
  const info = out.info || {};
  runs[label] = { matrix: info.matrix || null, renderer: info.renderer || null, skipped: info.skipped || [], rows: Object.fromEntries(out.report.map((r) => [r.id, r.n])) };
}
let grew = false, grewSame = false;   // (grewSame: a run grew over its baseline's own matrix and renderer, which --init may not take in)
const lines = [];
for (const [label, run] of Object.entries(runs)) {
  const B = base.runs[label], now = run.rows, b = (B && B.rows) || {};
  if (B && (B.matrix !== run.matrix || B.renderer !== run.renderer)) { grew = true; lines.push(`${label}: made over another ${B.matrix !== run.matrix ? 'matrix' : 'renderer'} than the baseline (${B.renderer}): update --init on a CI run`); continue; }
  const added = Object.keys(now).filter((k) => !(k in b)), fixed = Object.keys(b).filter((k) => !(k in now));
  const lost = run.skipped.filter((k) => !((B && B.skipped) || []).includes(k));
  if (added.length || lost.length) { grew = true; if (B) grewSame = true; }
  lines.push(`${label}: ${Object.keys(now).length} rows (baseline ${Object.keys(b).length})${added.length ? `; NEW: ${added.join('; ')}` : ''}${lost.length ? `; did not open: ${lost.join('; ')}` : ''}${fixed.length ? `; fixed, lower the baseline: ${fixed.join('; ')}` : ''}`);
}
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Layout ratchet\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n`);
if (mode === 'update') {
  // (--init does not take in new violations of a run whose matrix and renderer are the baseline's: those go through
  // DECLARED with a reason, or --rules when the checks themselves changed)
  if (grew && !rules && (!init || grewSame)) { console.error(init ? 'refusing --init: the runs have a baseline over the same matrix and renderer; fix the new violations, declare them in the suite with a reason, or (when this diff changes the checks) use --rules' : 'refusing to add to the baseline: fix the new violations, or declare them in the suite with a reason'); process.exit(1); }
  const next = { about: 'test/layout_invariants_cmd.js: per run, its matrix and renderer, the states that did not open, and each violation row\'s key with the matrix points it was seen at (ci/layout_ratchet.js)', runs: Object.assign({}, base.runs, runs) };
  fs.writeFileSync(BASELINE, JSON.stringify(next, null, 1) + '\n');
  console.log('baseline written');
} else if (grew) {
  console.error('layout ratchet: new violations (fix them, or declare them in DECLARED of test/layout_invariants_cmd.js with a reason)');
  process.exit(1);
}

#!/usr/bin/env node
'use strict';
// The lint ratchet (issue #20, phase 1): ESLint errors and tsc errors may not grow beyond ci/lint_baseline.json, and the
// baseline may only shrink. The count a tool reports today is the baseline; fix findings, then lower the baseline.
// A baseline of 0 is the floor: the tool is clean, and any error it reports fails the check (the baseline cannot go
// lower, and `update` never raises it).
//   node ci/lint_ratchet.js check eslint.json tsc.txt     exit 1 when either count is above its baseline
//   node ci/lint_ratchet.js update eslint.json tsc.txt    write the counts as the new baseline (refused when one is higher)
// eslint.json: `eslint -f json -o eslint.json`; tsc.txt: the output of `npm run typecheck` (tsc's plain output).
// ESLint warnings are not counted: the rules that warn (max-lines, no-shadow, ...) are on their way to errors one by one.
const fs = require('fs');
const path = require('path');

const BASELINE = process.env.CMW_LINT_BASELINE || path.join(__dirname, 'lint_baseline.json');   // (the env: test/t_lint_ratchet.js)
const [mode, eslintFile, tscFile] = process.argv.slice(2);
if (!['check', 'update'].includes(mode) || !eslintFile || !tscFile) {
  console.error('usage: node ci/lint_ratchet.js check|update eslint.json tsc.txt');
  process.exit(2);
}

const eslintErrors = JSON.parse(fs.readFileSync(eslintFile, 'utf8'))
  .reduce((n, f) => n + f.messages.filter((m) => m.severity === 2).length, 0);
const tscErrors = (fs.readFileSync(tscFile, 'utf8').match(/\): error TS\d+/g) || []).length;
const now = { eslintErrors, tscErrors };
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

let grew = false;
const lines = [];
for (const k of Object.keys(now)) {
  const d = now[k] - base[k];
  const floor = base[k] === 0;
  const state = d > 0 ? (floor ? `GREW by ${d} from the floor (0)` : `GREW by ${d}`)
    : d < 0 ? `below the baseline by ${-d}: lower it (node ci/lint_ratchet.js update ...)` : floor ? 'at the floor (0): no error may be added' : 'at the baseline';
  if (d > 0) grew = true;
  lines.push(`${k}: ${now[k]} (baseline ${base[k]}): ${state}`);
}
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Lint ratchet\n\n${lines.map((l) => `- ${l}`).join('\n')}\n\n`);

if (mode === 'update') {
  if (grew) { console.error('refusing to raise the baseline: fix the new findings instead'); process.exit(1); }
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
  console.log('baseline written');
} else if (grew) {
  console.error('lint ratchet: the error counts above grew; fix the new findings (the baseline only shrinks)');
  process.exit(1);
}

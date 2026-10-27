'use strict';
// Runs every unit test (test/t_*.js) one after another; exit 1 when any fails. Each test's output goes to the log in a
// collapsible group; the job summary gets one row per test.
//   node ci/snapshots.js && node ci/unit.js [--only REGEX]
// CMW_SPEED_SCALE scales the absolute speed limits of the construction tests (CI sets it: hosted runners are slower
// than the development Mac the limits were set on).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, summary, esc } = require('./lib');

const only = process.argv.includes('--only') ? new RegExp(process.argv[process.argv.indexOf('--only') + 1]) : null;
const tests = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /^t_.*\.js$/.test(f) && (!only || only.test(f))).sort();
const gh = !!process.env.GITHUB_ACTIONS;
const rows = [];
let failed = 0;
for (const f of tests) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join('test', f)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 30 * 60 * 1000 });
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  const lines = out.trim().split('\n');
  const last = lines[lines.length - 1] || '';
  const fails = lines.filter((l) => /^\s*FAIL\b/.test(l));
  if (!ok) failed++;
  if (gh) console.log(`::group::${ok ? 'pass' : 'FAIL'} ${f} (${s} s)`);
  else console.log(`== ${ok ? 'pass' : 'FAIL'} ${f} (${s} s)`);
  console.log(out.trimEnd());
  if (gh) console.log('::endgroup::');
  if (!ok && gh) console.log(`::error title=${f} failed::${(fails[0] || r.error?.message || last).slice(0, 300)}`);
  rows.push(`| ${ok ? '✅' : '❌'} | \`${f}\` | ${s} s | ${esc((ok ? last : fails.slice(0, 3).join('; ') || r.error?.message || last).slice(0, 200))} |`);
}
summary([`### Unit tests: ${tests.length - failed} of ${tests.length} passed`, '', '| | test | time | result |', '|---|---|---|---|', ...rows, ''].join('\n'));
process.exit(failed ? 1 : 0);

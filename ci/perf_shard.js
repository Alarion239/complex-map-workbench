'use strict';
// One shard of the paired perf gate (ci/perf_shards.js): every unit of the shard runs on the reference app and on this
// checkout's app back to back on the same machine, each in its own headless Chrome (test/regress/perf/run.js --ab), and
// this checkout is gated against the reference with the suite's tolerances (compare_perf.py, the 60 fps budget and
// perf/accepted.json included). A unit with a failing metric is run twice more on both sides and its metrics become the
// median of the 3 attempts (as perf/run.sh confirms failures): a real regression fails again, a noise spike does not.
//   node ci/perf_shard.js --shard ID --ref <commit> [--reps N] [--confirm N] [--settle-timeout MS] [--force] [--no-build]
// Exit 0 pass, 1 regression, 2 setup problem (a unit that stalls, a build that fails).
const fs = require('fs');
const path = require('path');
const { ROOT, PY, summary, run, esc } = require('./lib');
const { buildReference, sameApp } = require('./reference');
const { SHARDS } = require('./perf_shards');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const shard = SHARDS.find((s) => s.id === opt('--shard'));
const ref = opt('--ref', 'origin/main');
const REPS = opt('--reps', '3');
const CONFIRM = Number(opt('--confirm', '2'));
const PERF = path.join(ROOT, 'test', 'regress', 'perf');
const CMP = path.join(ROOT, 'test', 'regress', 'compare_perf.py');

async function main() {
  if (!shard) { console.error(`--shard must be one of: ${SHARDS.map((s) => s.id).join(', ')}`); return 2; }
  const title = `Perf ${shard.id} (${process.platform}${process.env.RUNNER_NAME ? ', ' + process.env.RUNNER_NAME : ''})`;
  if (!argv.includes('--force') && sameApp(ref)) {
    summary(`### ${title}\n\nNo change to the app (src/, build.py) since \`${ref}\`: nothing to compare.\n`);
    return 0;
  }
  if (!argv.includes('--no-build') && run(PY, ['build.py']) !== 0) throw new Error('build failed');
  const R = buildReference(ref);
  const OUT = path.join(ROOT, '.ci', 'perf', shard.id);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const f = (n) => path.join(OUT, n);
  // CI machines are never idle: no waiting for a quiet machine (both sides of a pair see the same load); a unit may
  // take long on software rendering
  const common = ['--reps', REPS, '--load-wait', '0', '--load-max', '100000', '--unit-timeout', opt('--unit-timeout', '1800'), '--settle-timeout', opt('--settle-timeout', '20000')];
  const paired = (only, k) => {
    const rc = run(process.execPath, [path.join(PERF, 'run.js'), '--ab', R.dist, '--out', f(`cur-${k}.json`), '--ab-out', f(`ref-${k}.json`), '--only', only, ...common]);
    if (rc !== 0) throw new Error(rc === 4 ? 'a unit stalled (run.js exit 4): see the log' : `run.js exited ${rc}`);
  };
  const compare = (b, c, json, fu) => {
    const a = [CMP, '--baseline', b, '--results', c, '--json', json];
    if (fu) a.push('--failing-units', fu);
    const rc = run(PY, a);
    if (rc >= 2) throw new Error(`compare_perf.py exited ${rc}`);
    return JSON.parse(fs.readFileSync(json, 'utf8'));
  };
  console.log(`shard ${shard.id}: ${shard.re}; reference ${R.sha.slice(0, 12)} (${ref})`);
  paired(shard.re, 1);
  let v = compare(f('ref-1.json'), f('cur-1.json'), f('compare-1.json'), f('failing-units.txt'));
  let confirmed = false;
  if (v.failed && CONFIRM > 0) {
    // ('*': a metric of no unit, suite.no_errors: a page exception, never noise)
    const units = fs.readFileSync(f('failing-units.txt'), 'utf8').split('\n').map((s) => s.trim()).filter((u) => u && u !== '*');
    if (units.length) {
      console.log(`confirming ${units.join(', ')}: ${CONFIRM} more paired attempt(s)`);
      const re = `^(${units.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`;
      for (let k = 2; k <= CONFIRM + 1; k++) paired(re, k);
      const ks = Array.from({ length: CONFIRM + 1 }, (_, i) => i + 1);
      for (const side of ['cur', 'ref']) {
        if (run(PY, [path.join(PERF, 'merge_runs.py'), '--checks', 'majority', ...ks.map((k) => f(`${side}-${k}.json`)), '-o', f(`${side}.json`)]) !== 0) throw new Error('merge_runs.py failed');
      }
      v = compare(f('ref.json'), f('cur.json'), f('compare.json'));
      confirmed = true;
    }
  }
  const meta = JSON.parse(fs.readFileSync(f('cur-1.json'), 'utf8')).meta || {};
  const fails = v.rows.filter((r) => r.status === 'FAIL');
  const improved = v.rows.filter((r) => r.status === 'IMPROVED');
  const lines = [`### ${title}: ${fails.length ? `❌ ${fails.length} metric(s) worse than the reference` : '✅ not slower than the reference'}`, '',
    `${shard.what}. Reference \`${R.sha.slice(0, 12)}\` (\`${ref}\`); GPU: ${esc(meta.browser && meta.browser.gpu || '?')}; ${meta.seconds || '?'} s` +
    `${confirmed ? '; failures re-run twice, medians of 3 attempts' : ''}. ${Object.entries(v.counts).map(([k, n]) => `${k} ${n}`).join(', ')}.`, ''];
  if (fails.length) lines.push('| metric | reference → this change |', '|---|---|', ...fails.slice(0, 40).map((r) => `| \`${r.metric}\` | ${esc(r.text)} |`), '');
  if (improved.length) lines.push(`<details><summary>${improved.length} improved</summary>\n\n${improved.slice(0, 60).map((r) => `- \`${r.metric}\` ${esc(r.text)}`).join('\n')}\n</details>`, '');
  if (v.warnings && v.warnings.length) lines.push(...v.warnings.map((w) => `> ${esc(w)}`), '');
  summary(lines.join('\n'));
  return fails.length ? 1 : 0;
}
main().then((rc) => process.exit(rc), (e) => { console.error(e); summary(`### Perf ${shard ? shard.id : '?'}: setup problem\n\n\`${esc(String(e.message || e))}\`\n`); process.exit(2); });

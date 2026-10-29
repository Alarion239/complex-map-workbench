'use strict';
// One shard of the paired perf gate (ci/perf_shards.js): every unit of the shard runs on the reference app and on this
// checkout's app back to back on the same machine, each in its own headless Chrome (test/regress/perf/run.js --ab), and
// this checkout is gated against the reference with the suite's tolerances (compare_perf.py --paired, the 60 fps
// budget and perf/accepted.json included; a check or limit that fails on the reference too is reported, not failed).
// A unit with a failing metric is run twice more on both sides, in the opposite order (run.js --ab-flip: on some
// machines the side measured second is slower); a metric then fails only when the medians of the 3 attempts fail and
// most of the attempts, each against its own reference, fail too: a real regression fails again, a noise spike or
// the cost of going second does not. --tol-scale S widens the timing and GPU-memory allowances S-fold (GitHub's machines: 3).
// --advisory (GitHub's machines, whose timings swing both ways by more than any tolerance): a timing or memory metric
// that got worse is reported (the summary, a warning annotation each) and does not fail the job; a check that fails, a
// value that is missing or null (a timeout) and an error of the suite still do.
//   node ci/perf_shard.js --shard ID --ref <commit> [--reps N] [--confirm N] [--tol-scale S] [--advisory] [--table] [--settle-timeout MS] [--force] [--no-build]
// Exit 0 pass (or advisory warnings only), 1 regression, 2 setup problem (a unit that stalls, a build that fails).
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
const SCALE = opt('--tol-scale', '1');
const ADVISORY = argv.includes('--advisory');
// --table (the GPU gate): the log lists every metric, reference -> this change and its verdict (compare_perf.py --table),
// for the first attempt and for the medians of a confirmation: a reader of the job log needs no artifact
const TABLE = argv.includes('--table');
// what --advisory only reports: measured timings and memory (checks and missing values still fail)
const MEASURED = new Set(['frame_ms', 'cpu_ms', 'latency_ms', 'jank_ms', 'settle_ms', 'oneshot_ms', 'throughput', 'mem_bytes', 'limit']);
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
  const paired = (only, k, flip) => {
    const rc = run(process.execPath, [path.join(PERF, 'run.js'), '--ab', R.dist, '--out', f(`cur-${k}.json`), '--ab-out', f(`ref-${k}.json`), '--only', only, ...common, ...(flip ? ['--ab-flip'] : [])]);
    if (rc !== 0) throw new Error(rc === 4 ? 'a unit stalled (run.js exit 4): see the log' : `run.js exited ${rc}`);
  };
  const compare = (b, c, json, fu, table) => {
    const a = [CMP, '--baseline', b, '--results', c, '--json', json, '--paired', '--tol-scale', SCALE];
    if (fu) a.push('--failing-units', fu);
    if (table && TABLE) a.push('--table');
    const rc = run(PY, a);
    if (rc >= 2) throw new Error(`compare_perf.py exited ${rc}`);
    return JSON.parse(fs.readFileSync(json, 'utf8'));
  };
  console.log(`shard ${shard.id}: ${shard.re}; reference ${R.sha.slice(0, 12)} (${ref})`);
  paired(shard.re, 1);
  let v = compare(f('ref-1.json'), f('cur-1.json'), f('compare-1.json'), f('failing-units.txt'), true);
  let confirmed = false, attempts = null;
  if (v.failed && CONFIRM > 0) {
    // ('*': a metric of no unit, suite.no_errors: a page exception, never noise)
    const units = fs.readFileSync(f('failing-units.txt'), 'utf8').split('\n').map((s) => s.trim()).filter((u) => u && u !== '*');
    if (units.length) {
      console.log(`confirming ${units.join(', ')}: ${CONFIRM} more paired attempt(s), the sides in the opposite order`);
      const re = `^(${units.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`;
      for (let k = 2; k <= CONFIRM + 1; k++) paired(re, k, true);
      const ks = Array.from({ length: CONFIRM + 1 }, (_, i) => i + 1);
      for (const side of ['cur', 'ref']) {
        if (run(PY, [path.join(PERF, 'merge_runs.py'), '--checks', 'majority', ...ks.map((k) => f(`${side}-${k}.json`)), '-o', f(`${side}.json`)]) !== 0) throw new Error('merge_runs.py failed');
      }
      v = compare(f('ref.json'), f('cur.json'), f('compare.json'), null, true);
      // each attempt against its own reference (attempt 1: compare-1.json)
      const per = [JSON.parse(fs.readFileSync(f('compare-1.json'), 'utf8')), ...ks.slice(1).map((k) => compare(f(`ref-${k}.json`), f(`cur-${k}.json`), f(`compare-${k}.json`)))];
      attempts = ks.length;
      const failsIn = (m) => per.filter((x) => x.rows.some((r) => r.metric === m && r.status === 'FAIL')).length;
      for (const r of v.rows) {
        if (r.status !== 'FAIL' || r.metric.startsWith('suite.')) continue;   // (an error of the suite is never noise)
        r.attempts = failsIn(r.metric);
        if (r.attempts * 2 <= attempts) { r.status = 'NOISE'; r.text += ` (failed in ${r.attempts} of ${attempts} attempts: noise)`; }
        else r.text += ` (failed in ${r.attempts} of ${attempts} attempts)`;
      }
      confirmed = true;
    }
  }
  const meta = JSON.parse(fs.readFileSync(f('cur-1.json'), 'utf8')).meta || {};
  for (const r of v.rows) if (ADVISORY && r.status === 'FAIL' && MEASURED.has(r.kind) && typeof r.new === 'number') r.status = 'WARN';
  const fails = v.rows.filter((r) => r.status === 'FAIL');
  const warned = v.rows.filter((r) => r.status === 'WARN');
  const improved = v.rows.filter((r) => r.status === 'IMPROVED');
  const both = v.rows.filter((r) => r.status === 'BOTH');
  const noise = v.rows.filter((r) => r.status === 'NOISE');
  const counts = {};
  for (const r of v.rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const verdict = fails.length ? `❌ ${fails.length} metric(s) worse than the reference`
    : warned.length ? `⚠️ ${warned.length} timing(s) worse than the reference (advisory: timings are not gated on this machine)` : '✅ not slower than the reference';
  const lines = [`### ${title}: ${verdict}`, '',
    `${shard.what}. Reference \`${R.sha.slice(0, 12)}\` (\`${ref}\`); GPU: ${esc(meta.browser && meta.browser.gpu || '?')}; ${meta.seconds || '?'} s` +
    `${SCALE !== '1' ? `; timing allowances x ${SCALE}` : ''}${confirmed ? `; failing units re-run with the sides swapped, medians of ${attempts} attempts` : ''}. ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')}.`, ''];
  if (fails.length) lines.push('| metric | reference → this change |', '|---|---|', ...fails.slice(0, 40).map((r) => `| \`${r.metric}\` | ${esc(r.text)} |`), '');
  if (warned.length) lines.push('Advisory (timings and memory are not gated here):', '', '| metric | reference → this change |', '|---|---|', ...warned.slice(0, 40).map((r) => `| \`${r.metric}\` | ${esc(r.text)} |`), '');
  if (noise.length) lines.push(`<details><summary>${noise.length} failed once, not confirmed (noise)</summary>\n\n${noise.slice(0, 60).map((r) => `- \`${r.metric}\` ${esc(r.text)}`).join('\n')}\n</details>`, '');
  if (both.length) lines.push(`<details><summary>${both.length} fail on the reference too (this machine; not this change's)</summary>\n\n${both.slice(0, 60).map((r) => `- \`${r.metric}\` ${esc(r.text)}`).join('\n')}\n</details>`, '');
  if (improved.length) lines.push(`<details><summary>${improved.length} improved</summary>\n\n${improved.slice(0, 60).map((r) => `- \`${r.metric}\` ${esc(r.text)}`).join('\n')}\n</details>`, '');
  // [#292] new units: not in the reference's results, or the reference could not run them (it lacks the feature)
  const fresh = new Map();
  for (const r of v.rows) {
    if (r.status !== 'NEW') continue;
    const u = r.unit_id || r.metric.split('.')[0], e = fresh.get(u) || { n: 0, why: r.ref_unsupported || null };
    e.n++; fresh.set(u, e);
  }
  if (fresh.size) lines.push(`<details><summary>${fresh.size} new unit(s), reported and not compared</summary>\n\n${[...fresh].slice(0, 60).map(([u, e]) => `- \`${u}\` (${e.n} metric(s)): ${esc(e.why ? `the reference cannot run it: ${e.why}` : 'not in the reference')}`).join('\n')}\n</details>`, '');
  if (v.warnings && v.warnings.length) lines.push(...v.warnings.map((w) => `> ${esc(w)}`), '');
  summary(lines.join('\n'));
  for (const r of warned.slice(0, 10)) console.log(`::warning title=Perf ${shard.id} (advisory)::${r.metric}: ${r.text}`);
  return fails.length ? 1 : 0;
}
main().then((rc) => process.exit(rc), (e) => { console.error(e); summary(`### Perf ${shard ? shard.id : '?'}: setup problem\n\n\`${esc(String(e.message || e))}\`\n`); process.exit(2); });

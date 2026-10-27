'use strict';
// The image-quality gate, paired: the quality suite (test/regress/quality) renders its scenes with the reference app
// and with this checkout's app on the same machine, and this checkout must not score worse than the reference
// (compare_quality.py with the reference's metrics as the baseline; the bounded controls' golden diff is taken against
// the reference's renders). The committed baseline and goldens were recorded on a Mac GPU and do not carry over to
// other renderers (software rendering scores some scenes differently); --absolute also gates against them (the
// self-hosted Mac).
//   node ci/quality.js --ref <commit> [--shard i/n] [--absolute] [--force] [--no-build]
// A run that fails is rendered again on both sides; it fails only when it fails twice (renders are not always
// bit-identical between two runs of the same build). Exit 0 pass, 1 regression, 2 setup problem.
const fs = require('fs');
const path = require('path');
const { ROOT, PY, serve, summary, run, esc } = require('./lib');
const { buildReference, sameApp } = require('./reference');
const SC = require('../test/regress/quality/scenes');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const ref = opt('--ref', 'origin/main');
const [si, sn] = opt('--shard', '1/1').split('/').map(Number);
const OUT = path.join(ROOT, '.ci', 'quality');
const RUNNER = path.join(ROOT, 'test', 'regress', 'quality', 'run_quality.js');
const CMP = path.join(ROOT, 'test', 'regress', 'compare_quality.py');
const title = `Image quality${sn > 1 ? ` ${si}/${sn}` : ''} (${process.platform}${process.env.CMW_ANGLE ? ', ' + process.env.CMW_ANGLE : ''})`;

// the shard's runs: those of every n-th scene of scenes.js, so each shard gets a mix of light and heavy ones (by run
// id: run_quality.js --only also takes a prefix, and a scene's name is a prefix of others', logH of logH_out4)
function shardRuns() {
  const all = SC.runs().map((r) => r.id);
  const names = [...new Set(all.map((id) => id.split('.')[0]))].filter((_, i) => i % sn === si - 1);
  return { names, ids: all.filter((id) => names.includes(id.split('.')[0])) };
}
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
function quality(base, out, only, golden) {
  const a = [RUNNER, '--base-url', base.replace(/\/$/, ''), '--out', out, '--only', only.join(',')];
  if (golden) a.push('--golden', golden);
  const rc = run(process.execPath, a);
  if (rc >= 2 || !fs.existsSync(path.join(out, 'metrics.json'))) throw new Error(`the quality runner failed (exit ${rc}) for ${out}`);
}
function compare(baseline, current, json) {
  const a = [CMP, '--current', current, '--only-present', '--json', json];
  if (baseline) a.push('--baseline', baseline);
  const rc = run(PY, a);
  if (rc >= 2) throw new Error(`compare_quality.py failed (exit ${rc})`);
  return readJson(json);
}

async function main() {
  if (!argv.includes('--force') && sameApp(ref)) {
    summary(`### ${title}\n\nNo change to the app (src/, build.py) since \`${ref}\`: nothing to compare.\n`);
    return 0;
  }
  if (!argv.includes('--no-build') && run(PY, ['build.py']) !== 0) { console.error('build failed'); return 2; }
  const R = buildReference(ref);
  const { names: scenes, ids } = shardRuns();
  console.log(`reference ${R.sha.slice(0, 12)}; scenes: ${scenes.join(', ')}`);
  fs.rmSync(OUT, { recursive: true, force: true });
  const cur = await serve(path.join(ROOT, 'dist')), rf = await serve(R.dist);
  try {
    const d = (n) => path.join(OUT, n);
    quality(rf.base, d('ref'), ids);
    quality(cur.base, d('cur'), ids, path.join(d('ref'), 'renders'));
    let v = compare(path.join(d('ref'), 'metrics.json'), d('cur'), d('compare.json'));
    // a failing run is rendered again on both sides; it fails only if it fails again
    const failing = [...new Set(v.failures.map((f) => f.run).filter((r) => r !== '*'))];
    let confirmed = v.failures;
    if (failing.length) {
      console.log(`re-rendering ${failing.length} failing run(s) on both sides: ${failing.join(', ')}`);
      quality(rf.base, d('ref2'), failing);
      quality(cur.base, d('cur2'), failing, path.join(d('ref2'), 'renders'));
      const v2 = compare(path.join(d('ref2'), 'metrics.json'), d('cur2'), d('compare2.json'));
      const again = new Set(v2.failures.map((f) => f.run));
      confirmed = v.failures.filter((f) => f.run === '*' || again.has(f.run));
    }
    let abs = null;
    if (argv.includes('--absolute')) abs = compare(null, d('cur'), d('compare-absolute.json'));
    const lines = [`### ${title}: ${confirmed.length || (abs && !abs.pass) ? '❌ worse than the reference' : '✅ not worse than the reference'}`, '',
      `Reference \`${R.sha.slice(0, 12)}\` (\`${ref}\`), ${scenes.length} scenes, ${v.runs.length} runs; ${v.improvements.length} metric(s) improved.`, ''];
    if (confirmed.length) lines.push('| run | metric | reference → this change |', '|---|---|---|', ...confirmed.map((f) => `| \`${f.run}\` | ${f.metric} | ${esc(f.message)} |`), '');
    const flaky = v.failures.filter((f) => !confirmed.includes(f));
    if (flaky.length) lines.push(`Not confirmed on a second render (noise): ${[...new Set(flaky.map((f) => f.run))].join(', ')}`, '');
    if (abs) lines.push(`Against the committed baseline (Mac GPU): ${abs.pass ? 'pass' : `**${abs.failures.length} failure(s)**: ` + abs.failures.slice(0, 10).map((f) => `\`${f.run}\` ${f.metric} ${esc(f.message)}`).join('; ')}`, '');
    summary(lines.join('\n'));
    return confirmed.length || (abs && !abs.pass) ? 1 : 0;
  } finally { cur.server.close(); rf.server.close(); }
}
main().then((rc) => process.exit(rc), (e) => { console.error(e); summary(`### ${title}: setup problem\n\n\`${esc(String(e.message || e))}\`\n`); process.exit(2); });

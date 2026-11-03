'use strict';
// The perf shards of a GPU gate run, collected: each shard job writes .ci/perf/<id>/verdict.json (ci/perf_shard.js) and
// uploads it in its artifact; the job that ends the run downloads them into one directory and this prints one table, a
// row per shard (shard, verdict, failing rows, time), for the run's summary.
// A shard whose job died before it wrote anything has no verdict: the plan's list of shards (--expect, the plan's `shards`
// output) makes it a row of its own, "no verdict", counted as not passing.
//   node ci/perf_verdicts.js DIR [--expect '["steps-king", ...]']   every verdict.json under DIR
const fs = require('fs');
const path = require('path');
const { summary, esc } = require('./lib');

function found(dir) {
  const out = [];
  for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...found(p));
    else if (e.name === 'verdict.json') { try { out.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch (err) { /* a half-written record: left out */ } }
  }
  return out;
}

// [{ leaf, verdict, ... }] and the leaves the run chose -> the markdown table, in the order of the leaves' ids; a record
// passes when its shard exited 0 (PASS, BOTH, SKIPPED: nothing to compare)
function table(records, expected = []) {
  const have = new Set(records.map((r) => r.leaf));
  const missing = expected.filter((id) => !have.has(id));
  if (!records.length && !missing.length) return '### Perf shards: no verdict found\n\nNo shard wrote a verdict (a job that did not start, or one that failed before the comparison).\n';
  const rows = [...records.map((r) => ({ leaf: r.leaf, r })), ...missing.map((leaf) => ({ leaf, r: null }))].sort((a, b) => a.leaf.localeCompare(b.leaf)).map(({ leaf, r }) => r
    ? `| \`${esc(leaf)}\` | ${r.verdict} (exit ${r.exit}) | ${r.fail} | ${r.both} | ${r.pass} | ${r.passes} | ${r.seconds} s | ${r.error ? esc(r.error) : r.failing && r.failing.length ? r.failing.slice(0, 5).map((m) => '`' + esc(m) + '`').join(', ') : ''} |`
    : `| \`${esc(leaf)}\` | no verdict | | | | | | the job wrote none: it did not start, or died before the comparison |`);
  const bad = records.filter((r) => r.exit !== 0).length + missing.length;
  const total = records.length + missing.length;
  return ['### Perf shards: ' + (bad ? `${bad} of ${total} not passing` : `${total} passing`), '',
    '| shard | verdict | FAIL | BOTH | PASS | passes | time | failing rows |', '|---|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
}

if (require.main === module) {
  const a = process.argv.slice(2);
  let expected = [];
  try { expected = a.includes('--expect') ? JSON.parse(a[a.indexOf('--expect') + 1] || '[]') : []; } catch (e) { console.error('--expect takes a JSON array of shard ids'); process.exit(2); }
  const md = table(found(a.find((x) => !x.startsWith('--') && x !== a[a.indexOf('--expect') + 1]) || '.ci/perf-all'), expected);
  console.log(md);
  summary(md);
}
module.exports = { found, table };

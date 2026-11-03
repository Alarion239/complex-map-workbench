'use strict';
// The perf shards of a GPU gate run, collected: each shard job writes .ci/perf/<id>/verdict.json (ci/perf_shard.js) and
// uploads it in its artifact; the job that ends the run downloads them into one directory and this prints one table, a
// row per shard (shard, verdict, failing rows, time), for the run's summary.
//   node ci/perf_verdicts.js DIR   every verdict.json under DIR
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

// [{ leaf, verdict, ... }] -> the markdown table, in the order of the leaves' ids
function table(records) {
  if (!records.length) return '### Perf shards: no verdict found\n\nNo shard wrote a verdict (a job that did not start, or one that failed before the comparison).\n';
  const rows = [...records].sort((a, b) => a.leaf.localeCompare(b.leaf)).map((r) =>
    `| \`${esc(r.leaf)}\` | ${r.verdict} (exit ${r.exit}) | ${r.fail} | ${r.both} | ${r.pass} | ${r.passes} | ${r.seconds} s | ${r.failing && r.failing.length ? r.failing.slice(0, 5).map((m) => '`' + esc(m) + '`').join(', ') : ''} |`);
  const bad = records.filter((r) => r.verdict !== 'PASS' && r.verdict !== 'BOTH').length;
  return ['### Perf shards: ' + (bad ? `${bad} of ${records.length} not passing` : `${records.length} passing`), '',
    '| shard | verdict | FAIL | BOTH | PASS | passes | time | failing rows |', '|---|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
}

if (require.main === module) {
  const md = table(found(process.argv[2] || '.ci/perf-all'));
  console.log(md);
  summary(md);
}
module.exports = { found, table };

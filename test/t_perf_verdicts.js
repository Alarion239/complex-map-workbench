// Unit checks of ci/perf_verdicts.js: the table of the shards' verdicts that a GPU gate run prints. Run: node test/t_perf_verdicts.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { found, table } = require('../ci/perf_verdicts.js');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
const rec = (leaf, verdict, extra = {}) => Object.assign({ leaf, head: 'abcd1234', ref: 'ef567890', verdict, exit: verdict === 'PASS' ? 0 : 1, fail: 0, both: 0, pass: 43, passes: 1, seconds: 240, failing: [] }, extra);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-verdicts-'));
for (const [artifact, r] of [['gpu-perf-macOS-steps-king', rec('steps-king', 'FAIL', { fail: 2, failing: ['sv.glide.king.longest_ms', 'sv.scrub.in.king.gl_copies'] })], ['gpu-perf-macOS-steps-zeta', rec('steps-zeta', 'PASS')]]) {
  const d = path.join(dir, artifact, 'steps-x'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'verdict.json'), JSON.stringify(r));
}
fs.writeFileSync(path.join(dir, 'gpu-perf-macOS-steps-king', 'verdict.json'), '{ half');
const got = found(dir);
ok('every verdict.json under the directory is read, a half-written one is left out', got.map((r) => r.leaf).sort().join() === 'steps-king,steps-zeta', got);
const t = table(got);
ok('the table has a row per shard, the failing rows, and the count of those not passing', /1 of 2 not passing/.test(t) && /\| `steps-king` \| FAIL \(exit 1\) \| 2 \|/.test(t) && /sv\.glide\.king\.longest_ms/.test(t) && /\| `steps-zeta` \| PASS \(exit 0\)/.test(t), t);
ok('rows are in the order of the shard ids', t.indexOf('steps-king') < t.indexOf('steps-zeta'));
ok('all passing', /2 passing/.test(table([rec('a', 'PASS'), rec('b', 'BOTH', { exit: 0 })])));
ok('INVALID counts as not passing, SKIPPED as passing', /1 of 1 not passing/.test(table([rec('a', 'INVALID', { exit: 3 })])) && /2 passing/.test(table([rec('a', 'SKIPPED', { exit: 0 }), rec('b', 'PASS')])));
const gone = table([rec('steps-zeta', 'PASS')], ['steps-zeta', 'steps-king']);
ok('an expected shard with no record is a row of its own and counts as not passing', /1 of 2 not passing/.test(gone) && /\| `steps-king` \| no verdict \|/.test(gone), gone);
ok('only expected shards with no record are added', /1 passing/.test(table([rec('steps-zeta', 'PASS')], ['steps-zeta'])) && /1 of 1 not passing/.test(table([], ['steps-king'])));
ok('a shard that died shows its error', /1 of 1 not passing/.test(table([rec('a', 'INVALID', { exit: 2, error: 'run.js exit 4' })])) && /run\.js exit 4/.test(table([rec('a', 'INVALID', { exit: 2, error: 'run.js exit 4' })])));
ok('no verdict at all says so', /no verdict found/.test(table([])) && found(path.join(dir, 'nope')).length === 0);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

'use strict';
// The loaded-machine guard of the paired perf gate (ci/perf_shard.js; ci/README.md, Perf on a loaded machine): a
// reading taken while something else runs on the machine says nothing about the code, so each pass waits for a quiet
// machine, and what still ran busy is marked BUSY by test/regress/compare_perf.py and counted by no verdict.
//   defaultLoadMax(cores)    -> the 1-minute load above which a machine is busy: max(4, 0.45 x cores), as in run.js
//   topProcesses()           -> the busiest processes at the time of the call, as text (ps; macOS and Linux forms), ''
//                               when ps fails
//   quietWait(opts)          -> waits until the 1-minute load is under `limit`, at most `maxWaitMs`; logs the load
//                               before and after and, when busy, the busiest processes; resolves { before, after,
//                               waitedMs, quiet }. opts: limit, and the ones with defaults: load() (os.loadavg()[0]),
//                               maxWaitMs (5 min), pollMs (5 s), sleep(ms), clock() (ms), top(), log(line)
//   attemptTally(perPass, m) -> { n, fails } for metric m over the rows of each pass (compare_perf.py's rows): the
//                               passes that measured it and did not start busy, and those where it FAILED
//   shardExit(fails, busy)   -> the shard's exit code: 1 when a metric failed, 3 when nothing counted as failed but a
//                               FAIL is BUSY (invalid: machine busy), 0 otherwise
const os = require('os');
const { spawnSync } = require('child_process');

const MAX_WAIT_MS = 5 * 60 * 1000;
const POLL_MS = 5000;
const TOP_LINES = 8;

const defaultLoadMax = (cores) => Math.max(4, cores * 0.45);

function topProcesses() {
  // macOS: ps -r sorts by CPU; Linux (procps): --sort=-pcpu
  for (const sort of ['-r', '--sort=-pcpu']) {
    const r = spawnSync('ps', ['-Ao', 'pcpu,comm', sort], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout) return r.stdout.split('\n').slice(0, TOP_LINES).join('\n');
  }
  return '';
}

async function quietWait({ load = () => os.loadavg()[0], limit, maxWaitMs = MAX_WAIT_MS, pollMs = POLL_MS,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), clock = Date.now, top = topProcesses, log = console.log }) {
  const t0 = clock(), before = load();
  log(`load before the pass: ${before.toFixed(1)} (quiet under ${limit})`);
  if (before < limit) return { before, after: before, waitedMs: 0, quiet: true };
  log(`busy; the busiest processes:\n${top()}`);
  while (load() >= limit && clock() - t0 < maxWaitMs) await sleep(pollMs);
  const after = load(), waitedMs = clock() - t0, quiet = after < limit;
  const still = quiet ? '' : ` (still over ${limit}; the units that start busy are marked BUSY)`;
  log(`load after waiting ${(waitedMs / 1000).toFixed(0)} s: ${after.toFixed(1)}${still}`);
  if (!quiet) log(`the busiest processes:\n${top()}`);
  return { before, after, waitedMs, quiet };
}

function attemptTally(perPass, metric) {
  let n = 0, fails = 0;
  for (const rows of perPass) {
    const r = rows.find((x) => x.metric === metric);
    if (!r || r.status === 'BUSY') continue;
    n++;
    if (r.status === 'FAIL') fails++;
  }
  return { n, fails };
}

const shardExit = (fails, busy) => (fails ? 1 : busy ? 3 : 0);

module.exports = { defaultLoadMax, topProcesses, quietWait, attemptTally, shardExit };

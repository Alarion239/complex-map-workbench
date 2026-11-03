// Unit checks of ci/perf_busy.js, the loaded-machine guard of the paired perf gate (ci/README.md, Perf on a loaded
// machine): the wait for a quiet machine (a fake load source and clock, so it runs anywhere), the tally of attempts
// that started quiet, and the exit code of a shard whose failures were all BUSY.
//   node test/t_perf_busy.js
const { defaultLoadMax, quietWait, attemptTally, shardExit } = require('../ci/perf_busy.js');
let n = 0, fails = 0;
const ok = (name, c, info) => {
  n++;
  if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
};

// a machine whose 1-minute load follows `loads` (the last value stays), a clock that only sleep() moves
function machine(loads) {
  const m = { t: 0, reads: 0, slept: [], logs: [], tops: 0 };
  m.load = () => loads[Math.min(m.reads++, loads.length - 1)];
  m.clock = () => m.t;
  m.sleep = async (ms) => { m.slept.push(ms); m.t += ms; };
  m.top = () => { m.tops++; return '99.0 com.example.build'; };
  m.log = (l) => m.logs.push(l);
  return m;
}
const wait = (m, extra) => quietWait(Object.assign(
  { load: m.load, clock: m.clock, sleep: m.sleep, top: m.top, log: m.log, limit: 4.5, pollMs: 1000, maxWaitMs: 10000 },
  extra));

(async () => {
  ok('defaultLoadMax: max(4, 0.45 x cores): 4.5 on the 10-core Mac, 4 on 4 cores',
    defaultLoadMax(10) === 4.5 && defaultLoadMax(4) === 4 && defaultLoadMax(32) === 14.4);

  // a quiet machine: no wait, the load is logged once, no process list
  let m = machine([1.2]);
  let r = await wait(m);
  ok('quiet: returns at once',
    r.quiet && r.waitedMs === 0 && m.slept.length === 0 && r.before === 1.2 && r.after === 1.2, r);
  ok('quiet: logs the load before, not the processes',
    m.logs.length === 1 && /before the pass: 1\.2/.test(m.logs[0]) && m.tops === 0, m.logs);

  // a busy machine that calms down: waits poll by poll, logs the load before and after and the busiest processes
  m = machine([75.8, 75.8, 40, 12, 3.1]);
  r = await wait(m);
  ok('busy then quiet: waits until the load is under the limit',
    r.quiet && r.before === 75.8 && r.after === 3.1 && m.slept.length === 3, { r, slept: m.slept });
  ok('busy then quiet: logs before, the busiest processes and after',
    /before the pass: 75\.8/.test(m.logs[0]) && /busiest processes/.test(m.logs[1]) &&
    m.logs[1].includes('com.example.build') && /after waiting 3 s: 3\.1/.test(m.logs[2]) && m.logs.length === 3, m.logs);

  // a machine that never calms down: gives up after maxWaitMs, says so, and lists the processes again
  m = machine([30]);
  r = await wait(m);
  ok('never quiet: stops at the limit of the wait',
    !r.quiet && r.waitedMs === 10000 && m.slept.length === 10, { r, slept: m.slept.length });
  ok('never quiet: says the units that start busy are marked',
    m.logs.some((l) => /still over 4\.5.*BUSY/.test(l)) && m.tops === 2, m.logs);

  // the limit is strict: a load equal to it is busy
  m = machine([4.5, 4.5, 4.4]);
  r = await wait(m);
  ok('a load equal to the limit is busy', r.before === 4.5 && r.quiet && m.slept.length === 1, { r, slept: m.slept });

  // the attempts of a metric: a pass that started busy (BUSY) is none, a pass that did not measure it is none
  const row = (metric, status) => ({ metric, status });
  const perPass = [[row('a.f', 'BUSY'), row('b.f', 'FAIL')], [row('a.f', 'FAIL')],
    [row('a.f', 'PASS'), row('b.f', 'FAIL')], [row('a.f', 'FAIL')]];
  ok('attemptTally: BUSY passes are no attempts',
    JSON.stringify(attemptTally(perPass, 'a.f')) === '{"n":3,"fails":2}', attemptTally(perPass, 'a.f'));
  ok('attemptTally: a pass without the metric is none',
    JSON.stringify(attemptTally(perPass, 'b.f')) === '{"n":2,"fails":2}', attemptTally(perPass, 'b.f'));
  ok('attemptTally: no pass has it', JSON.stringify(attemptTally(perPass, 'c.f')) === '{"n":0,"fails":0}');

  // the exit code: a counted failure is 1 (red is red), BUSY failures alone are 3 (invalid), nothing is 0
  ok('shardExit: a clean red', shardExit(1, 0) === 1 && shardExit(2, 3) === 1);
  ok('shardExit: only BUSY failures is invalid: machine busy (3)', shardExit(0, 2) === 3);
  ok('shardExit: nothing failed', shardExit(0, 0) === 0);

  console.log(`${n - fails}/${n} passed`);
  process.exit(fails ? 1 : 0);
})();

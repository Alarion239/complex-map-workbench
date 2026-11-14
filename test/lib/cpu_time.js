'use strict';
// The CPU time of this process (user + system), for the unit tests' timing rows: a row judges what the code computes, not
// what else the machine runs, so a busy machine does not count in it (a wall-clock p95 read 3 to 8 ms for a splitter that
// takes under 1 ms alone, with eight busy loops on four cores). The CPU clock counts in ticks, shorter than which a reading
// is not exact, so a row times many calls at once (tens of ms of CPU) and divides, as test/lib/speed_ref.js does for the
// drag rounds.
//   const { cpuPerCall } = require('./lib/cpu_time');
//   cpuPerCall(fn, n)  -> the CPU time of one call of fn(i), in ms: n calls, fn(0) to fn(n - 1), timed together
const cpuNow = () => { const c = process.cpuUsage(); return (c.user + c.system) / 1000; };
const cpuPerCall = (fn, n) => { const c0 = cpuNow(); for (let i = 0; i < n; i++) fn(i); return (cpuNow() - c0) / n; };
module.exports = { cpuNow, cpuPerCall };

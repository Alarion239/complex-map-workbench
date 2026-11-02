'use strict';
// A speed reference for the construction tests (t_constr.js's sections): the cost of one fixed operation, measured in
// the same run as the code a test guards, so that a limit is a ratio ("perpForm takes under N reference operations")
// that holds on any machine instead of microseconds that hold on one. The operation is BigInt arithmetic on a double's
// mantissa, the kind the exact forms (perpForm, touchForm, tangentForm) spend their time on.
//   const { unitsOf, cpuUnitsOf } = require('./lib/speed_ref');
//   unitsOf(fn)           -> the cost of one call of fn(i) in reference operations: ROUNDS rounds of CALLS calls of fn,
//                            each followed by a round of the reference, the least of each (the least disturbed round,
//                            taken at the same moments, so a load that comes and goes moves both)
//   cpuUnitsOf(step)      -> the CPU time of one call of step(f) in reference operations: ROUNDS rounds of DRAG_FRAMES
//                            calls, each followed by a round of the reference, the least of each. The drag is timed as
//                            CPU time (a drag is judged by what it computes, not by what else the machine runs), the
//                            reference as wall time: a reference round is about 2 ms, shorter than the tick a CPU clock
//                            may count in, while a drag round is DRAG_FRAMES frames (tens of ms). The least round of
//                            the reference is likely one with no time off the CPU, so its wall time is close to its
//                            CPU time.
// ROUNDS: enough rounds that one of each lands in a quiet moment of a machine running more busy loops than it has cores
// (all of t_constr.js's checks passed under six busy loops on four cores).
const ROUNDS = 7, CALLS = 20000;
// the frames of one drag round (about 40 ms of CPU for a drag with 10 dependents, more for 50: many ticks of a
// tick-counting CPU clock, so it cannot read 0)
const DRAG_FRAMES = 300;
// the reference operation's input: a double that changes by REF_STEP per call from REF_START, whose 52-bit mantissa
// is split into the high 20 bits (MANTISSA_HI_MASK) and the low 32
const REF_START = 1.1, REF_STEP = 1e-3, MANTISSA_HI_MASK = 0xfffff;
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);

// ns per call of fn(i) over one round of n calls
function roundNs(fn, n) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn(i);
  return Number(process.hrtime.bigint() - t0) / n;
}

let sink = 0n;   // (keeps the loop's result alive; masked to SINK_MASK so that it stays small)
const SINK_MASK = 0xffffffffn;
function reference(i) {
  F64[0] = i * REF_STEP + REF_START;
  const m = (BigInt(U32[1] & MANTISSA_HI_MASK) << 32n) | BigInt(U32[0]);
  sink = (sink + ((m * m + (m << 7n)) >> 3n)) & SINK_MASK;
}

function unitsOf(fn) {
  let best = Infinity, ref = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    best = Math.min(best, roundNs(fn, CALLS));
    ref = Math.min(ref, roundNs(reference, CALLS));
  }
  return best / ref;
}

function cpuUnitsOf(step) {
  let best = Infinity, ref = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    const c0 = process.cpuUsage();
    for (let f = 0; f < DRAG_FRAMES; f++) step(f);
    const c = process.cpuUsage(c0);
    best = Math.min(best, (c.user + c.system) * 1000 / DRAG_FRAMES);
    ref = Math.min(ref, roundNs(reference, CALLS));
  }
  return best / ref;
}

module.exports = { unitsOf, cpuUnitsOf };

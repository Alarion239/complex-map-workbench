'use strict';
// A speed reference for the construction tests (t_constr.js's sections): the cost of one fixed operation, measured in
// the same run as the code a test guards, so that a limit is a ratio ("perpForm takes under N reference operations")
// that holds on any machine instead of microseconds that hold on one. The operation is BigInt arithmetic on a double's
// mantissa, the kind the exact forms (perpForm, touchForm, tangentForm) spend their time on.
//   const { refNs, unitsOf } = require('./lib/speed_ref');
//   unitsOf(fn)           -> the cost of one call of fn(i) in reference operations: ROUNDS rounds of CALLS calls of fn,
//                            each followed by a round of the reference, the least of each (the least disturbed round,
//                            taken at the same moments, so a load that comes and goes moves both)
//   refNs()               -> ns for one reference operation (best of ROUNDS rounds of CALLS), for a measurement that
//                            is not a call count (a CPU time): take it before and after and use the smaller
const ROUNDS = 7, CALLS = 20000;
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

let sink = 0n;   // (keeps the loop's result alive)
function reference(i) {
  F64[0] = i * REF_STEP + REF_START;
  const m = (BigInt(U32[1] & MANTISSA_HI_MASK) << 32n) | BigInt(U32[0]);
  sink += (m * m + (m << 7n)) >> 3n;
}

function unitsOf(fn) {
  let best = Infinity, ref = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    best = Math.min(best, roundNs(fn, CALLS));
    ref = Math.min(ref, roundNs(reference, CALLS));
  }
  return best / ref;
}

function refNs() {
  let ref = Infinity;
  for (let r = 0; r < ROUNDS; r++) ref = Math.min(ref, roundNs(reference, CALLS));
  return ref;
}

module.exports = { refNs, unitsOf };

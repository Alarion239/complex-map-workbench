'use strict';
// A speed reference for the construction tests (t_constr.js's sections): the cost of one fixed operation, measured in
// the same run as the code a test guards, so that a limit is a ratio ("perpForm takes under N reference operations")
// that holds on any machine instead of microseconds that hold on one. The operation is BigInt arithmetic on a double's
// mantissa, the kind the exact forms (perpForm, touchForm, tangentForm) spend their time on.
//   const { refNs, bestNs } = require('./lib/speed_ref');
//   refNs()               -> ns for one reference operation (best of ROUNDS rounds of CALLS)
//   bestNs(fn, n)         -> ns for one call of fn(i), the best of ROUNDS rounds of n calls (the least disturbed round;
//                            n defaults to CALLS)
const ROUNDS = 7, CALLS = 20000;
// the reference operation's input: a double that changes by REF_STEP per call from REF_START, whose 52-bit mantissa
// is split into the high 20 bits (MANTISSA_HI_MASK) and the low 32
const REF_START = 1.1, REF_STEP = 1e-3, MANTISSA_HI_MASK = 0xfffff;
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);

function bestNs(fn, n = CALLS) {
  let best = Infinity;
  for (let r = 0; r < ROUNDS; r++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < n; i++) fn(i);
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / n);
  }
  return best;
}

let sink = 0n;   // (keeps the loop's result alive)
function refNs() {
  return bestNs((i) => {
    F64[0] = i * REF_STEP + REF_START;
    const m = (BigInt(U32[1] & MANTISSA_HI_MASK) << 32n) | BigInt(U32[0]);
    sink += (m * m + (m << 7n)) >> 3n;
  });
}

module.exports = { refNs, bestNs };

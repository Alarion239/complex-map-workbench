'use strict';
// End-to-end effect of the cancellation in the SIN/COS/SINH/COSH/TAN bases (CX.asin & co.) in float64:
// coverage of image points of shapes whose intermediate values are large, w itself moderate.
const L = require('./lib.js');
const { Inverse, C, fmt } = L;
function run(name, list, shape, pix = 1e-3, NS = 2000) {
  const ch = L.chain(list);
  const prep = Inverse.prepare(ch.plan, { win: L.WIN0, shape });
  if (!prep.ok) { console.log(name, 'forward', prep.reason); return; }
  let n = 0, miss = 0, off = 0, ex = null;
  for (let t = 0; t < NS; t++) {
    const z = L.sampleIn(shape, 1e-6), w = ch.F(z);
    if (!CX.isFin(w)) continue;
    n++;
    const r = Inverse.enumerate(ch.plan, prep, w, pix, { K: 16, B: 16 });
    if (!(r.U > 0)) { miss++; if (!ex) ex = `z = ${fmt(z)}, w = ${fmt(w)}`; continue; }
    // the sample's own preimage, to 1e-6
    if (!r.leaves.some((lf) => lf.cov && CX.abs(CX.sub(lf.z, z)) < 1e-6 * (1 + CX.abs(z)))) off++;
  }
  console.log(`${name}: ${miss} of ${n} image points NOT COVERED, ${off} more whose own preimage is off by > 1e-6${ex ? ` (e.g. ${ex})` : ''}`);
}
run('log(cos z), |z + 20i| < 1', [{ type: 'cos' }, { type: 'log' }], { kind: 'disc', c: [0, -20], r: 1 });
run('log(sin z), |z - 1 - 19i| < 1', [{ type: 'sin' }, { type: 'log' }], { kind: 'disc', c: [1, 19], r: 1 });
run('log(sinh z), |z - 19| < 1', [{ type: 'sinh' }, { type: 'log' }], { kind: 'disc', c: [19, 0], r: 1 });
run('sin z, |z - 2 - 10i| < 1 (|w| ~ 1e4)', [{ type: 'sin' }], { kind: 'disc', c: [2, 10], r: 1 }, 1);
run('sin z, |z - 2 - 14i| < 1 (|w| ~ 6e5)', [{ type: 'sin' }], { kind: 'disc', c: [2, 14], r: 1 }, 100);

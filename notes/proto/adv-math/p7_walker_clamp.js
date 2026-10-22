'use strict';
// Adversarial check 7: the SPEC 4.1 walker loop, transcribed literally, with the 3.6 clamp of exp(H) (halfplane support
// in the period direction e = i: lower bound 0). The loop marks a direction finished as soon as m lies outside
// [lo, hi]; ms (m*, centred on clipWin) is never moved into the clamp. When the left view sits more than half a
// period outside the clamp, m* < lo: t = 0 (plus) finishes the plus direction, t = 1 the minus one: no member is
// visited at all, although [m*-M, m*+M] intersects the clamp. Truth: exp(H) = C \ {0} (every pixel covered).
//   node notes/proto/adv-math/p7_walker_clamp.js
const TAU = 2 * Math.PI;
function pixel(argw, imRef, M = 8) {
  const ms = Math.round((imRef - argw) / TAU);                          // EXP centre (SPEC 3.2)
  const t0 = argw;                                                      // <(base - B)/A, e> for e = i: Im Log w
  const lo = Math.max(ms - M, Math.ceil((0 - t0) / TAU) - 1), hi = ms + M;   // window ∩ clamp [lo_s = 0, +inf)
  let dP = false, dM = false, visited = 0, covering = 0;
  for (let t = 0; t < 17; t++) {
    if (t > 2 * M) break;
    const plus = (t & 1) === 0, m = ms + (plus ? 1 : -1) * Math.floor((t + 1) / 2);
    if (m < lo || m > hi) { if (plus) dP = true; else dM = true; if (dP && dM) break; continue; }
    if (plus ? dP : dM) { if (dP && dM) break; continue; }
    visited++;
    if (argw + TAU * m > 0) covering++;                                 // Im z_m > 0: inside H
  }
  return { ms, lo, hi, visited, covering };
}
for (const imRef of [1, -3, -6, -20]) {
  let empty = 0, n = 0;
  for (let k = 0; k < 360; k++) { const a = -Math.PI + (k + 0.5) * TAU / 360; n++; if (pixel(a, imRef).covering === 0) empty++; }
  const ex = pixel(0.5, imRef);
  console.log(`left view centred at Im z = ${String(imRef).padStart(3)}: exp(H) pixels with no covering member ${empty}/${n}   (Arg w 0.5: m* ${ex.ms}, range [${ex.lo}, ${ex.hi}], visited ${ex.visited})`);
}

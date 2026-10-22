'use strict';
// Adversarial check 5: SPEC 4.3 "Λ rule": when |Re Λ| > 60, "halfplane through a and sector with r = 0 use the
// direction e^{i Im Λ} (|z| dominates |a|)". That premise holds only for Re Λ > +60. For Re Λ < -60 (|z| < 1e-26),
// z is essentially 0 and the halfplane/sector test must be the test AT 0 (unless the boundary passes through 0).
// Emulation: log of halfplanes (one LOG member, Λ = w), right view zoomed out 32x (half-width 109), float64 truth
// vs the spec's rule as written. Spurious fill = pixels the rule fills where no preimage lies in the region.
//   node notes/proto/adv-math/p5_lambda_rule.js
const PI = Math.PI;
function run(name, hp, view) {
  const [ax, ay] = hp.a, [bx, by] = hp.b;
  const dl = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / dl, dy = (by - ay) / dl;
  const level = (x, y) => dx * (y - ay) - dy * (x - ax);              // cross(d, z - a): > 0 inside (left of a->b)
  let spill = 0, holes = 0, n = 0;
  for (let j = 0; j < 516; j += 2) for (let i = 0; i < 410; i += 2) {
    const u = view.cx + (i + 0.5 - 205) / view.s, v = view.cy - (j + 0.5 - 258) / view.s;   // pixel w = Λ = u + iv
    if (!(v > -PI && v <= PI)) continue;                              // principal log range
    n++;
    // truth (float64; for u < -700 e^u underflows to 0, which is the correct limit z -> 0)
    const r = Math.exp(u), truth = level(r * Math.cos(v), r * Math.sin(v)) > 0;
    // SPEC 4.3 as written: |Re Λ| > 60 -> direction test
    let spec;
    if (Math.abs(u) > 60) spec = level(Math.cos(v), Math.sin(v)) - level(0, 0) > 0;   // direction e^{iv} in the asymptotic cone
    else spec = truth;
    if (spec && !truth) spill++;
    if (!spec && truth) holes++;
  }
  console.log(`${name.padEnd(36)} principal-strip px ${n}: spurious fill ${spill}, holes ${holes}`);
}
const out32 = { cx: 0, cy: 0, s: 60 / 32 };
run('log of H (Im z > 0) [control]', { a: [0, 0], b: [1, 0] }, out32);
run('log of Im z > 1', { a: [0, 1], b: [1, 1] }, out32);
run('log of Re z < -1', { a: [-1, 0], b: [-1, 1] }, out32);
run('log of Re z > 1', { a: [1, 1], b: [1, 0] }, out32);
run('log of Im z > 1, zoomed out 16x (suite max)', { a: [0, 1], b: [1, 1] }, { cx: 0, cy: 0, s: 60 / 16 });

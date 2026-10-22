'use strict';
// Adversarial check 3: ROOTPOW mode 'finite' (SPEC 3.2 row ROOTPOW): "m in [ceil(min(xa,xb)) - 1, floor(max) + 1];
// over 17 members: window", window centre m* = round((Re beta Log w - ln|ref|) / (2 pi Im beta)).
// For a REAL exponent alpha (beta = 1/alpha real, not an integer) with |alpha| >= 16 the padded member range has
// > 17 entries, so the window is used, and Im beta = 0 makes m* = +-Infinity / NaN: no members at all (empty image).
// For nearly-real complex alpha the centre lands hundreds of members outside the valid range: empty or partial.
// Test: random z in a disc / in H, w = f(z) with the app's own powa step, is a covering preimage enumerated?
//   node notes/proto/adv-math/p3_rootpow_finite.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;
function run(alpha, shape, cRef) {
  const steps = [{ type: 'powa', params: Object.assign(Funcs.defaults('powa'), { alpha, cut: 180, k: 0 }), on: true }];
  const built = steps.map((s) => Funcs.build(s));
  const plan = INV.planChain(steps, built);
  const refs = INV.makeRefs(plan, cRef);
  const L = Region.levelOf(shape), bb = Region.bboxOf(shape) || { x0: -3, x1: 3, y0: 0, y1: 3 };
  let seed = 11, n = 0, miss = 0, cand = 0;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (n < 3000) {
    const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
    if (!(L(z) > 1e-6)) continue;
    const w = built[0].f(z);
    if (!CX.isFin(w)) continue;
    n++;
    const lv = INV.enumerate(plan, w, refs, 1e-3, { cap: false });
    cand += lv.length;
    if (!lv.some((lf) => CX.isFin(lf.z) && L(lf.z) > -1e-9 && lf.lvl > 0)) miss++;
  }
  console.log(`alpha ${String(alpha).padEnd(9)} ${shape.kind.padEnd(9)} members/px ${(cand / n).toFixed(1).padStart(5)}  missed ${miss}/${n}`);
}
const disc = { kind: 'disc', c: [1, 0.5], r: 0.3 }, H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
for (const a of ['15', '15.5', '16', '17', '20', '20+0.1i', '20+2i', '0.05', '-18']) {
  run(a, disc, C(1, 0.5));
  run(a, H, C(0, 1));
}

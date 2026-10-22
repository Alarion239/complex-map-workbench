'use strict';
// prepare() cost per shape (the CPU work a parameter scrub pays per frame and pane): AFF-prefix clips are O(ops);
// non-affine prefixes run the adaptive float64 range box.
//   node notes/proto/lead-rev/r7_prepcost.js
const W2 = require('./walk.js');
const { C } = CX;
const WIN0 = { x0: -3.4, x1: 3.4, y0: -4.3, y1: 4.3 };
const cases = [
  ['exp(H)', [{ type: 'exp' }], { kind: 'halfplane', a: [0, 0], b: [1, 0] }],
  ['z^i(H)', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], { kind: 'halfplane', a: [0, 0], b: [1, 0] }],
  ['exp∘exp disc r=1 at 3', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0], r: 1 }],
  ['e^{z^2} disc r=0.3 at 3+3i', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }], { kind: 'disc', c: [3, 3], r: 0.3 }],
  ['e^{1/z^2} disc at 0.6+0.5i', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }], { kind: 'disc', c: [0.6, 0.5], r: 0.2 }],
  ['tan∘exp rect [0,3]x[-1,1]', [{ type: 'exp' }, { type: 'tan' }], { kind: 'rect', a: [0, -1], b: [3, 1] }],
  ['sin∘exp polygon', [{ type: 'exp' }, { type: 'sin' }], { kind: 'polygon', pts: [[0, 0], [2, 0.3], [1.5, 1.5], [0.2, 1]] }],
];
for (const [name, steps, shape] of cases) {
  const { plan } = W2.planOf(steps);
  W2.prepare(plan, shape, WIN0);
  const t0 = process.hrtime.bigint(); const N = 20;
  let p; for (let i = 0; i < N; i++) p = W2.prepare(plan, shape, WIN0);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  console.log(`${name.padEnd(30)} prepare ${ms.toFixed(3)} ms  ok ${p.ok}  budgets ${p.N.filter((x, i) => p.fam[i]).join('x')}  ranges ${p.rspec.filter(Boolean).map((r) => r.kind).join(',')}`);
}

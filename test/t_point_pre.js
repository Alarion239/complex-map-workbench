// A point's exact preimages through a chain (#291, #252 option 3): Inverse.pointPre composes the ops' exact branches
// when every op has finitely many. Each listed z maps to p to 1e-9, the count is the product of the branch counts (the
// distinct roots of a generic p), non-rational steps and chains above the cap are not exact (the app searches there).
// Run: node test/t_point_pre.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Inverse = require('../src/inverse.js');
const C = CX.C;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const step = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const chain = (steps) => ({ steps, built: steps.map((st) => Funcs.build(st)) });
const F = (ch, a, b) => (z) => { for (let k = a; k < b; k++) z = ch.built[k].f(z); return z; };
// every listed z maps to p, the list has `want` distinct points
function exact(name, steps, p, want, a = 0, b = steps.length) {
  const ch = chain(steps), plan = Inverse.planChain(ch.steps, ch.built, a, b), r = Inverse.pointPre(plan, p);
  check(`${name}: exact`, r.exact, r.reason);
  if (!r.exact) return r;
  const f = F(ch, a, b), worst = Math.max(0, ...r.zs.map((z) => CX.abs(CX.sub(f(z), p)) / (1 + CX.abs(p))));
  check(`${name}: every z maps to p to 1e-9`, worst <= 1e-9, worst);
  const distinct = r.zs.filter((z, i) => r.zs.findIndex((q) => CX.abs(CX.sub(q, z)) <= 1e-9 * (1 + CX.abs(z))) === i);
  check(`${name}: ${want} distinct preimages`, distinct.length === want, distinct.length);
  check(`${name}: total ${want}`, r.total === want, r.total);
  return r;
}
const p = C(0.3, 0.7);
exact('z^8', [step('pown', { n: 8 })], p, 8);
exact('z^2 -> +1 -> z^2 (degree 4)', [step('pown', { n: 2 }), step('add', { c: '1' }), step('pown', { n: 2 })], p, 4);
exact('Möbius -> z^3', [step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }), step('pown', { n: 3 })], p, 3);
exact('z^2 + 1 as a formula, then z^8 (degree 16)', [step('custom', { expr: 'z^2+1' }), step('pown', { n: 8 })], p, 16);
exact('z^8 -> z^8 (degree 64, the cap)', [step('pown', { n: 8 }), step('pown', { n: 8 })], p, 64);
// the planes in between: steps 2..3 only (a point of w3 seen in w1)
exact('z^2 -> +1 -> z^3, from w1 to w3', [step('pown', { n: 2 }), step('add', { c: '1' }), step('pown', { n: 3 })], p, 3, 1, 3);
// a critical value: z^2 at p = 0 has the double root 0 (once), at p = -0.01 the two roots ±0.1i
let r = exact('z^2 at p = -0.01', [step('pown', { n: 2 })], C(-0.01, 0), 2);
check('z^2 at p = -0.01: ±0.1i', r.exact && r.zs.some((z) => CX.abs(CX.sub(z, C(0, 0.1))) < 1e-12) && r.zs.some((z) => CX.abs(CX.sub(z, C(0, -0.1))) < 1e-12), JSON.stringify(r.zs));
{
  const ch = chain([step('pown', { n: 2 })]), q = Inverse.pointPre(Inverse.planChain(ch.steps, ch.built), C(0, 0));
  check('z^2 at the critical value 0: the root 0, once', q.exact && q.zs.length === 1 && CX.abs(q.zs[0]) === 0, JSON.stringify(q));
}
// not exact: infinitely many branches, a degree the catalog does not invert, above the cap
for (const [name, steps] of [['exp', [step('exp')]], ['sin', [step('sin')]], ['z^3 + z (a cubic)', [step('custom', { expr: 'z^3+z' })]],
  ['z^8 -> z^16 (128 > the cap)', [step('pown', { n: 8 }), step('pown', { n: 16 })]]]) {
  const ch = chain(steps), q = Inverse.pointPre(Inverse.planChain(ch.steps, ch.built), p);
  check(`${name}: not exact (the app searches)`, !q.exact, JSON.stringify(q).slice(0, 120));
}
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);

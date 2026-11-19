// Inverse.critValues (src/inverse.js): the critical values, in its last plane, of a chain whose steps have finitely many
// exact branches, which the off-view count (src/app/07-preimages-integrals.js, drawPullOff) reads to leave out a region
// that holds one. Each value returned is one: its preimages merge (fewer distinct points than the branch count), and a
// point beside it has the full count; the known ones are listed (z³ after a Möbius map: 0; z² + c: c; Joukowski: ±1;
// z² + 2z: −1; (z² − 1)/(z² + 1): ±1); a chain with a step whose values are not known answers null.
// Run: node test/t_inverse_critvalues.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const C = CX.C;
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const planOf = (list) => { const steps = list.map(([t, p]) => St(t, p)); return Inverse.planChain(steps, steps.map(Funcs.build), 0, steps.length); };
const near = (a, b) => CX.abs(CX.sub(a, b)) <= 1e-9 * (1 + CX.abs(b));
// (the point beside a critical value: off it by this much, relative)
const BESIDE = 1e-3;
const CASES = [
  { name: 'Möbius, then z³', chain: [['mobius'], ['pown', { n: 3 }]], want: [C(0, 0)] },
  { name: 'z², then + (−0.4 + 0.3i)', chain: [['pown', { n: 2 }], ['add', { c: '-0.4+0.3i' }]], want: [C(-0.4, 0.3)] },
  { name: 'Joukowski', chain: [['joukowski']], want: [C(1, 0), C(-1, 0)] },
  { name: 'z² + 2z', chain: [['custom', { expr: 'z^2+2z' }]], want: [C(-1, 0)] },
  { name: '(z² − 1)/(z² + 1)', chain: [['custom', { expr: '(z^2-1)/(z^2+1)' }]], want: [C(-1, 0), C(1, 0)] },
  { name: 'z³, then z²', chain: [['pown', { n: 3 }], ['pown', { n: 2 }]], want: [C(0, 0)] },
  { name: 'a Möbius map alone', chain: [['mobius']], want: [] },
];
for (const c of CASES) {
  const plan = planOf(c.chain), cv = Inverse.critValues(plan);
  check(`${c.name}: a plan with exact branches`, !!plan && plan.ok, plan && plan.reason);
  check(`${c.name}: critical values listed`, Array.isArray(cv), cv);
  if (!Array.isArray(cv)) continue;
  check(`${c.name}: the known values, and only those`, c.want.every((w) => cv.some((v) => near(v, w))) && cv.every((v) => c.want.some((w) => near(v, w))), JSON.stringify(cv));
  for (const v of cv) {
    const at = Inverse.pointPre(plan, v), by = Inverse.pointPre(plan, CX.add(v, C(BESIDE * (1 + CX.abs(v)), BESIDE)));
    check(`${c.name}: the branches merge at ${v.re},${v.im}`, at.exact && by.exact && at.zs.length < by.zs.length, [at.zs && at.zs.length, by.zs && by.zs.length]);
  }
}
check('exp: no exact branches, so no list', Inverse.critValues(planOf([['exp']])) === null);
console.log(`t_inverse_critvalues: ${n - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);

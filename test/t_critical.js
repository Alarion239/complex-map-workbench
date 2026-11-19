// Critical points, critical values and join radii (src/critical.js; #1980, the Stack's P0b). A join radius of a target
// disc |w − c| < r is the distance from c to a critical value: the plan's oracles M1 z² (c = 1) 1, M2 Joukowski
// (c = 0.6 + 0.5i) 0.64, M3 z³ − 1.2z + 0.3 (c = 1.1) 0.294 and M4 z → z² → w₁² − 1 (c = 0.5 + 0.5i) 1.58. Every
// step of the catalog answers: its critical points (f′ vanishes there, to CRIT_TOL, and f takes the value listed), none
// (a one-to-one step), a lattice in the window (sin, cos, sinh, cosh), asymptotic values (exp, tan, tanh), or not known
// with a reason (Γ, ζ, d/dz, a series, a recurrence). Chains: a critical point of a later step counts where the steps
// before it reach it.
// Run: node test/t_critical.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Inverse = require('../src/inverse.js');
const C = CX.C, abs = CX.abs, sub = CX.sub;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } };
let Critical = null;
try { Critical = require('../src/critical.js'); } catch (e) { Critical = null; }
check('src/critical.js loads', !!Critical && typeof Critical.ofChain === 'function');
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const W = { x0: -4, x1: 4, y0: -3, y1: 3 };
// f′ at a critical point, relative to |f| near it, below CRIT_TOL; a listed value is f there to VAL_TOL
const CRIT_TOL = 1e-6, VAL_TOL = 1e-9;
const near = (a, b, tol = VAL_TOL) => a !== null && b !== null && abs(sub(a, b)) <= tol * (1 + abs(b));
const ofChain = (steps) => (Critical ? Critical.ofChain(steps, steps.map((st) => Funcs.build(st)), 0, steps.length, W) : null);
const F = (steps) => { const bs = steps.map((st) => Funcs.build(st)); return (z) => bs.reduce((u, b) => b.f(u), z); };
const deriv = (f, z) => { const h = 1e-5 * (1 + abs(z)); return CX.scale(sub(f(CX.add(z, C(h, 0))), f(sub(z, C(h, 0)))), 0.5 / h); };
const sameSet = (got, want) => got.length === want.length && want.every((w) => got.some((g) => near(g, w))) && got.every((g) => want.some((w) => near(g, w)));
// every listed point is critical (f′ ≈ 0) and maps to its value
function pointsHold(name, steps, r) {
  const f = F(steps), bad1 = r.points.list.filter((p) => !(abs(deriv(f, p.z)) <= CRIT_TOL * (1 + abs(f(p.z)))) || (p.w !== null && !near(f(p.z), p.w, 1e-7)));
  check(`${name}: each critical point listed has f′ = 0 and its value`, bad1.length === 0, bad1);
}

// ---- the plan's oracles: the join radii of M1 to M4 ----
const ORACLES = [
  { name: 'M1 z²', steps: [St('pown', { n: 2 })], c: C(1), values: [C(0)], points: [C(0)], radii: [1] },
  { name: 'M2 Joukowski', steps: [St('joukowski')], c: C(0.6, 0.5), values: [C(1), C(-1)], points: [C(1), C(-1)], radii: [Math.hypot(0.4, 0.5), Math.hypot(1.6, 0.5)] },
  { name: 'M3 z³ − 1.2z + 0.3', steps: [St('custom', { expr: 'z^3-1.2z+0.3' })], c: C(1.1), values: [C(0.3 - 0.8 * Math.sqrt(0.4)), C(0.3 + 0.8 * Math.sqrt(0.4))],
    points: [C(Math.sqrt(0.4)), C(-Math.sqrt(0.4))], radii: [1.1 - 0.3 - 0.8 * Math.sqrt(0.4), 1.1 - 0.3 + 0.8 * Math.sqrt(0.4)] },
  { name: 'M4 z → z² → w₁² − 1', steps: [St('pown', { n: 2 }), St('custom', { expr: 'z^2-1' })], c: C(0.5, 0.5), values: [C(-1)], points: [C(0)], radii: [Math.hypot(1.5, 0.5)] },
];
const PAGE = { 'M1 z²': 1, 'M2 Joukowski': 0.64, 'M3 z³ − 1.2z + 0.3': 0.294, 'M4 z → z² → w₁² − 1': 1.58 };
for (const o of ORACLES) {
  const r = ofChain(o.steps);
  if (!r) { check(`${o.name}: answered`, false); continue; }
  check(`${o.name}: its critical values`, r.values.known && sameSet(r.values.list.map((v) => v.w), o.values), r.values);
  check(`${o.name}: its critical points, all of them`, r.points.complete && sameSet(r.points.list.map((p) => p.z), o.points), r.points);
  pointsHold(o.name, o.steps, r);
  const radii = Critical.joinRadii(r.values.list, o.c).map((e) => e.r);
  check(`${o.name}: the join radii ${o.radii.map((x) => x.toFixed(4)).join(', ')}`, radii.length === o.radii.length && radii.every((x, i) => Math.abs(x - o.radii[i]) < 1e-9), radii);
  check(`${o.name}: the first join radius is the page's ${PAGE[o.name]}`, Math.abs(radii[0] - PAGE[o.name]) < 0.005, radii[0]);
}

// ---- every step of the catalog ----
// one-to-one steps: no critical points, no values
for (const [type, params] of [['mul'], ['add'], ['affine'], ['recip'], ['mobius'], ['blaschke'], ['pown', { n: 1 }], ['pown', { n: -1 }], ['root'], ['powa'], ['log'], ['arcsin'], ['arccos'],
  ['arctan'], ['arsinh'], ['arcosh'], ['artanh'], ['ijouk'], ['conj'], ['dh'], ['bottcher']]) {
  const r = ofChain([St(type, params)]);
  check(`${type}${params ? ' ' + JSON.stringify(params) : ''}: none`, !!r && r.values.known && !r.values.list.length && r.points.complete && !r.points.list.length, r);
}
// finitely many critical points: all listed, and the values
const FINITE = [
  ['z³', [St('pown', { n: 3 })], [C(0)], [C(0)]],
  ['z⁻² (the critical point 0 a pole; the value 0 from infinity)', [St('pown', { n: -2 })], [C(0)], [C(0)]],
  ['z³ − z (poly)', [St('poly', { co: '1, 0, -1, 0' })], [C(-2 / 3 / Math.sqrt(3)), C(2 / 3 / Math.sqrt(3))], [C(1 / Math.sqrt(3)), C(-1 / Math.sqrt(3))]],
  ['(z² + 1)/(z² − 1) (rational, degree 2)', [St('rational', { p: '1, 0, 1', q: '1, 0, -1' })], [C(-1), C(1)], [C(0)]],
  ['z² + 1/z (a rational formula of degree 3)', [St('custom', { expr: 'z^2+\\frac{1}{z}' })], null, null],
  ['z¹³ + z (degree 13, by its formula)', [St('custom', { expr: 'z^{13}+z' })], null, null],
  ['zeros 1, −1, 2i, no poles', [St('zp', { zeros: '1, -1, 2i', poles: '' })], null, null],
];
for (const [name, steps, values, points] of FINITE) {
  const r = ofChain(steps);
  if (!r) { check(`${name}: answered`, false); continue; }
  check(`${name}: values and points known, all of them`, r.values.known && r.points.complete, r);
  if (values && values.every(Boolean)) check(`${name}: its critical values`, sameSet(r.values.list.map((v) => v.w), values), r.values.list);
  if (points) check(`${name}: its critical points`, sameSet(r.points.list.map((p) => p.z), points), r.points.list);
  pointsHold(name, steps, r);
}
{
  // (z² + 1/z: f′ = 2z − 1/z² vanishes at the cube roots of 1/2, three critical points, three values)
  const r = ofChain([St('custom', { expr: 'z^2+\\frac{1}{z}' })]);
  check('z² + 1/z: three critical points, the cube roots of 1/2', !!r && r.points.list.length === 3 && r.points.list.every((p) => Math.abs(abs(p.z) - Math.cbrt(0.5)) < 1e-9), r && r.points);
  const z13 = ofChain([St('custom', { expr: 'z^{13}+z' })]);
  check('z¹³ + z: twelve critical points', !!z13 && z13.points.list.length === 12 && z13.values.list.length === 12, z13 && z13.points.list.length);
}
// a lattice of critical points: those in the window, the values ±1 or ±i
for (const [type, values] of [['sin', [C(1), C(-1)]], ['cos', [C(1), C(-1)]], ['sinh', [C(0, 1), C(0, -1)]], ['cosh', [C(1), C(-1)]]]) {
  const r = ofChain([St(type)]);
  if (!r) { check(`${type}: answered`, false); continue; }
  check(`${type}: the values ${values.map((v) => `${v.re}+${v.im}i`).join(', ')}`, r.values.known && sameSet(r.values.list.map((v) => v.w), values), r.values);
  check(`${type}: infinitely many points, those in the window listed`, !r.points.complete && r.points.inWindow && r.points.list.length >= 2, r.points);
  pointsHold(type, [St(type)], r);
}
// asymptotic values, no critical points
for (const [type, values] of [['exp', [C(0)]], ['tan', [C(0, 1), C(0, -1)]], ['tanh', [C(1), C(-1)]]]) {
  const r = ofChain([St(type)]);
  check(`${type}: no critical points, the asymptotic values`, !!r && r.values.known && r.values.list.every((v) => v.kind === 'asymptotic') && sameSet(r.values.list.map((v) => v.w), values) && r.points.complete && !r.points.list.length, r);
}
// not known, with the reason
for (const [type, params, word] of [['gamma', {}, 'infinitely many'], ['zeta', {}, 'infinitely many'], ['deriv', {}, 'not'], ['series', {}, 'not known'], ['recurrence', {}, 'not known']]) {
  const r = ofChain([St(type, params)]);
  check(`${type}: not known, and says why`, !!r && !r.values.known && typeof r.values.reason === 'string' && r.values.reason.includes(word) && !r.points.complete && !!r.points.reason, r && r.values);
}

// ---- chains ----
{
  // M3, then z²: M3's two critical points, and its three roots (where z² is critical), 0 among the values
  const steps = [St('custom', { expr: 'z^3-1.2z+0.3' }), St('pown', { n: 2 })], r = ofChain(steps);
  check('M3 then z²: 5 critical points, 3 values (0 among them)', !!r && r.points.complete && r.points.list.length === 5 && r.values.list.length === 3 && r.values.list.some((v) => near(v.w, C(0))), r);
  if (r) pointsHold('M3 then z²', steps, r);
}
{
  // log, then z²: z²'s critical point 0 is log 1, so z = 1 is critical
  const steps = [St('log'), St('pown', { n: 2 })], r = ofChain(steps);
  check('log then z²: the critical point 1, the value 0', !!r && sameSet(r.points.list.map((p) => p.z), [C(1)]) && sameSet(r.values.list.map((v) => v.w), [C(0)]), r);
}
{
  // exp, then z² − 1: exp never takes 0, so z² − 1's critical point is not reached; −1 is exp's asymptotic value carried
  const r = ofChain([St('exp'), St('custom', { expr: 'z^2-1' })]);
  check('exp then z² − 1: no critical point, −1 an asymptotic value', !!r && !r.points.list.length && r.values.list.length === 1 && near(r.values.list[0].w, C(-1)) && r.values.list[0].kind === 'asymptotic', r);
}
{
  // a step whose critical points are not known makes the chain's not known
  const r = ofChain([St('pown', { n: 2 }), St('gamma')]);
  check('z² then Γ: not known, step 2 named', !!r && !r.values.known && r.values.reason.startsWith('step 2:'), r && r.values);
}
// ---- multiplicities: f′ vanishes to order mult at a critical point (an op's own data, and InvOps.ratCritical's)
{
  const { InvOps } = require('../src/invops.js');
  const has = (cr, u, mult) => cr.crit.some((e) => (u === null ? e.u === null : e.u !== null && near(e.u, u, 1e-7)) && e.mult === mult);
  const st = St('pown', { n: 3 }), cr = Inverse.pointPlan([st], [Funcs.build(st)]).ops[0].critical();
  check('z³ (IPOW): 0 with multiplicity 2, infinity with 2', has(cr, C(0), 2) && has(cr, null, 2) && cr.crit.length === 2, cr);
  // z³(z − 1)²/(z + 2): p′q − pq′ = 2z²(z − 1)(2z² + 4z − 3), so 0 ×2, 1, −1 ± √10/2, and infinity ×3 (2·5 − 2 = 8)
  const expand = (roots) => roots.reduce((q, r) => q.concat([C(0)]).map((c, i) => (i ? CX.sub(c, CX.mul(r, q[i - 1])) : c)), [C(1)]);
  const P = expand([C(0), C(0), C(0), C(1), C(1)]), Q = [C(1), C(2)], f = (z) => CX.div(CX.polyEval(P, z), CX.polyEval(Q, z));
  const rc = InvOps.ratCritical(P, Q, f), s10 = Math.sqrt(10) / 2;
  check('z³(z − 1)²/(z + 2): 0 ×2, 1, −1 ± √10/2 and infinity ×3', has(rc, C(0), 2) && has(rc, C(1), 1) && has(rc, C(-1 + s10), 1) && has(rc, C(-1 - s10), 1) && has(rc, null, 3) && rc.crit.length === 5, rc);
  // z⁴ − 1 as one polynomial step: 0 ×3, infinity ×3
  const z4 = St('poly', { co: '1, 0, 0, 0, -1' }), c4 = Inverse.pointPlan([z4], [Funcs.build(z4)]).ops;
  const all4 = c4.flatMap((o) => o.critical().crit);
  check('z⁴ − 1: 0 with multiplicity 3', all4.some((e) => e.u !== null && near(e.u, C(0), 1e-7) && e.mult === 3), all4);
}
// ---- chains through infinity
for (const [name, steps, want] of [
  // (a later sin, cos or tan has no value at infinity: z²'s critical point there gives none)
  ['z² → sin', [St('pown', { n: 2 }), St('sin')], [C(0), C(1), C(-1)]],
  ['z² → cos', [St('pown', { n: 2 }), St('cos')], [C(1), C(-1)]],
  ['z² → tan', [St('pown', { n: 2 }), St('tan')], [C(0), C(0, 1), C(0, -1)]],
  // (1/z carries infinity to 0, where z² is critical: 0 is a critical value of 1/z²)
  ['1/z → z²', [St('recip'), St('pown', { n: 2 })], [C(0)]],
]) {
  const r = ofChain(steps);
  check(`${name}: the values ${want.map((w) => `${w.re}+${w.im}i`).join(', ')}, and no other`, !!r && r.values.known && sameSet(r.values.list.map((v) => v.w), want), r && r.values);
}
{
  // a critical point at infinity of a later step comes back at the poles of the steps before it
  const r1 = ofChain([St('recip'), St('pown', { n: 2 })]);
  check('1/z → z²: the critical point 0 (a double pole: its value infinity), all of them', !!r1 && r1.points.complete && r1.points.list.length === 1 && near(r1.points.list[0].z, C(0)) && r1.points.list[0].w === null, r1 && r1.points);
  const r2 = ofChain([St('joukowski'), St('custom', { expr: 'z^2-1' })]);
  check('Joukowski → z² − 1: the critical points ±1, ±i and 0 (a double pole)', !!r2 && r2.points.complete && sameSet(r2.points.list.map((p) => p.z), [C(1), C(-1), C(0, 1), C(0, -1), C(0)]), r2 && r2.points);
  // (tan's poles are poles of tan(z)²: their value is infinity, not the float that tan(π/2) rounds to)
  const r3 = ofChain([St('tan'), St('pown', { n: 2 })]);
  check('tan → z²: no critical value or point value is a rounded pole', !!r3 && r3.points.list.length > 0 && r3.points.list.every((p) => p.w === null || abs(p.w) < 1e6) && r3.values.list.every((v) => abs(v.w) < 1e6), r3);
}
// ---- a pole of order 2 or more: its value is infinity, never a huge or infinite float
for (const [name, st, want] of [
  ['(z² + 1)/(z − 0.1)²', St('rational', { p: '1, 0, 1', q: '1, -0.2, 0.01' }), [C(1 / 1.01 + 0)]],
  ['(z⁴ − 0.3z³ + 0.03z² − 0.001z + 1)/(z − 0.1)³', St('rational', { p: '1, -0.3, 0.03, -0.001, 1', q: '1, -0.3, 0.03, -0.001' }), null],
]) {
  const r = ofChain([st]);
  const finiteOnly = !!r && r.values.known && r.values.list.every((v) => CX.isFin(v.w) && abs(v.w) < 1e6);
  check(`${name}: every value finite and of the map's size, and so every join radius`, finiteOnly && Critical.joinRadii(r.values.list, C(0)).every((e) => e.r < 1e6), r && r.values);
  if (want) check(`${name}: the value 1/1.01 at −10, and the double pole's none`, !!r && sameSet(r.values.list.map((v) => v.w), want.map(() => C(0.99009900990099))), r && r.values);
}
{
  // Inverse.critValues on the app's own path (planChain): a double pole adds no value
  const st = St('custom', { expr: '\\frac{z^2+1}{(z-1)^2}' }), cv = Inverse.critValues(Inverse.planChain([st], [Funcs.build(st)]));
  check('Inverse.critValues((z² + 1)/(z − 1)²) through planChain: [0.5]', Array.isArray(cv) && sameSet(cv, [C(0.5)]), cv);
}
// Inverse.critValues reads the ops' critical points too: M3 through pointPlan
{
  const st = St('custom', { expr: 'z^3-1.2z+0.3' }), cv = Inverse.critValues(Inverse.pointPlan([st], [Funcs.build(st)]));
  check('Inverse.critValues of M3 (pointPlan): its two values', Array.isArray(cv) && sameSet(cv, ORACLES[2].values), cv);
}
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);

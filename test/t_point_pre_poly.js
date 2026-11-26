// A point's exact preimages through a polynomial step of degree 3 to 12 (#1979, the Stack's P0a): Inverse.pointPlan
// gives such a step its roots (homOps at t = 1, one NEWT op), so Inverse.pointPre lists every z with f(z) = w. Checked
// against Durand–Kerner on the step's own coefficients (CX.polyRoots, an independent solver): every root is found to
// ROOT_TOL, none twice, at generic w and next to a critical value; at a critical value the multiple root comes once
// with its multiplicity, within MULT_TOL of the critical point, and the multiplicities sum to the degree. A degree above
// 12, or a step that is not a polynomial, is still not exact.
// Run: node test/t_point_pre_poly.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Inverse = require('../src/inverse.js');
const C = CX.C, abs = CX.abs, sub = CX.sub;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } };
const step = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const cs = (z) => `${z.re}${z.im < 0 ? '-' : '+'}${Math.abs(z.im)}i`;
// a simple root to 1e-9 of its size; a multiple root of multiplicity m moves by about (ε |w| / |f^(m)/m!|)^(1/m) when
// w is rounded, so a double root's place is good to about √ε
const ROOT_TOL = 1e-9, MULT_TOL = 1e-7, FAMILY = 400, FLOOR_KFOLD = 360, FLOOR_PAIR = 175, FLOOR_EXACT = 195;
const near = (a, b, tol) => abs(sub(a, b)) <= tol * (1 + abs(b));
const hasPlan = typeof Inverse.pointPlan === 'function';
check('Inverse.pointPlan exists', hasPlan);
function pre(steps, w) {
  if (!hasPlan) return { exact: false, reason: 'no Inverse.pointPlan' };
  const built = steps.map((st) => Funcs.build(st));
  return Inverse.pointPre(Inverse.pointPlan(steps, built), w);
}
// the roots of co (high-first) minus w by Durand–Kerner
const dk = (co, w) => CX.polyRoots(co.slice(0, -1).concat([sub(co[co.length - 1], w)]));
// pointPre's roots at w against Durand–Kerner's: the same points to ROOT_TOL, each simple, none twice
function same(name, st, co, w) {
  const r = pre([st], w), d = co.length - 1;
  check(`${name} at ${cs(w)}: exact`, r.exact, r.reason);
  if (!r.exact) return;
  const want = dk(co, w), miss = want.filter((z) => !r.zs.some((q) => near(q, z, ROOT_TOL)));
  const extra = r.zs.filter((q) => !want.some((z) => near(q, z, ROOT_TOL)));
  check(`${name} at ${cs(w)}: the ${d} roots of Durand–Kerner, to ${ROOT_TOL}`, r.zs.length === d && !miss.length && !extra.length && r.mult.every((m) => m === 1) && r.total === d,
    { got: r.zs.length, mult: r.mult, miss, extra });
}
// a multiple root: z0 once with multiplicity m among `count` points, the multiplicities summing to the degree; the
// other points are `others` (the simple roots), each to tol
function multiple(name, st, w, z0, m, count, d, others, tol = MULT_TOL) {
  const r = pre([st], w), at = r.exact ? r.zs.findIndex((z) => near(z, z0, MULT_TOL)) : -1;
  check(`${name} at ${cs(w)}: ${count} points, ${cs(z0)} ×${m} among them, the multiplicities summing to ${d}`,
    r.exact && r.zs.length === count && at >= 0 && r.mult[at] === m && r.mult.reduce((a, k) => a + k, 0) === d && r.total === d, r);
  if (!r.exact || at < 0) return;
  const rest = r.zs.filter((z, i) => i !== at), miss = others.filter((z) => !rest.some((q) => near(q, z, tol)));
  check(`${name} at ${cs(w)}: the other points are its other roots`, rest.length === others.length && !miss.length, { rest, miss });
}
// the roots of a polynomial built from its roots, at w = 0: every one, simple, to ROOT_TOL
function simpleRoots(name, roots) {
  const r = pre([polyOf(roots)], C(0)), miss = roots.filter((z) => !(r.zs || []).some((q) => near(q, z, ROOT_TOL)));
  check(`${name}: the ${roots.length} roots, each once and simple, to ${ROOT_TOL}`, r.exact && r.zs.length === roots.length && r.mult.every((k) => k === 1) && !miss.length && r.total === roots.length, { got: r.zs, mult: r.mult, miss });
}

// a polynomial step from its roots (high-first coefficients)
const expand = (roots) => roots.reduce((p, r) => p.concat([C(0)]).map((c, i) => (i ? sub(c, CX.mul(r, p[i - 1])) : c)), [C(1)]);
const polyOf = (roots) => step('poly', { co: expand(roots).map(cs).join(', ') });
// M3, the plan's test cubic z³ − 1.2z + 0.3, as a formula: its critical points ±√0.4, their values 0.3 ∓ 0.8√0.4
const M3 = step('custom', { expr: 'z^3-1.2z+0.3' }), M3co = [C(1), C(0), C(-1.2), C(0.3)];
const s4 = Math.sqrt(0.4), f3 = (x) => x * x * x - 1.2 * x + 0.3;
for (const w of [C(1.1), C(0.3, 0.7), C(-2, -1), C(0), C(f3(s4) + 1e-6), C(f3(s4) - 1e-9), C(f3(-s4), 1e-9), C(f3(-s4) + 1e-6, -1e-6)]) same('M3', M3, M3co, w);
multiple('M3 at its critical value f(√0.4)', M3, C(f3(s4)), C(s4), 2, 2, 3, [C(-2 * s4)]);
// (1e-13 below it: two simple roots 4.6e-7 apart, which stay two)
same('M3', M3, M3co, C(f3(s4) - 1e-13));
// (the polynomial NEWT op itself, as homOps gives it at t = 1: its members carry the double root's multiplicity. A cubic
// is inverted in closed form (RAT3), so the op is z^5 - 5z's at its critical value f(1) = -4: the double root 1 and the
// three roots of z^3 + 2z^2 + 3z + 4)
{
  const op = Inverse.homOps(Funcs.build(step('custom', { expr: 'z^5-5z' })), 1).ops[0], mem = op.pre(C(-4)), at = mem.findIndex((q) => near(q.u, C(1), MULT_TOL));
  const others = dk([C(1), C(2), C(3), C(4)], C(0)), rest = mem.filter((q, i) => i !== at);
  check('z⁵ − 5z\'s NEWT op at f(1) = −4: four members, 1 ×2 among them, the others the roots of z³ + 2z² + 3z + 4', op.kind === 'NEWT' && mem.length === 4 && at >= 0 && mem[at].mult === 2 && others.every((z) => rest.some((q) => near(q.u, z, MULT_TOL))), mem.map((q) => [q.u, q.mult]));
}
multiple('M3 at its critical value f(−√0.4)', M3, C(f3(-s4)), C(-s4), 2, 2, 3, [C(2 * s4)]);

// the catalog's polynomial step, a zeros-and-poles step with no poles and a rational step over a constant: one solver
same('z³ − z (poly)', step('poly', { co: '1, 0, -1, 0' }), [C(1), C(0), C(-1), C(0)], C(0.2, -0.3));
same('2(z − 1)(z + i)(z − 0.5) (zeros, no poles)', step('zp', { a: '2', zeros: '1, -i, 0.5', poles: '' }),
  [C(2), C(-3, 2), C(1, -3), C(0, 1)], C(-0.4, 0.9));
same('(z⁴ + z + 1) / 2 (rational over a constant)', step('rational', { p: '1, 0, 0, 1, 1', q: '2' }), [C(0.5), C(0), C(0), C(0.5), C(0.5)], C(0.7, 0.1));

// every degree from 3 to 12: seeded random complex coefficients, at generic w and next to a critical value
let seed = 19791119;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const r1 = () => Math.round((rnd() * 4 - 2) * 100) / 100;
for (let d = 3; d <= 12; d++) {
  const co = Array.from({ length: d + 1 }, (_, k) => (k === 0 ? C(1 + Math.round(rnd() * 100) / 100, r1() / 4) : C(r1(), r1())));
  const st = step('poly', { co: co.map(cs).join(', ') }), b = Funcs.build(st);
  // a critical point: a root of f′, and its value; the points 1e-6 and 1e-9 times 1 + |value| off it
  const dco = co.slice(0, -1).map((c, i) => CX.scale(c, d - i)), cp = CX.polyRoots(dco)[0], v = b.f(cp), sv = 1 + abs(v);
  for (const w of [C(r1(), r1()), C(r1() * 3, r1() * 3), CX.add(v, C(1e-6 * sv, 0)), CX.add(v, C(0, -1e-9 * sv))]) same(`degree ${d}`, st, co, w);
}

// multiple roots at a critical value: a triple root, three double roots, a quadruple root of a degree-12 polynomial
multiple('(z − 1)³(z + 2)', polyOf([C(1), C(1), C(1), C(-2)]), C(0), C(1), 3, 2, 4, [C(-2)]);
multiple('(z − 1)²(z + 1)²(z − 2)², its root 2', polyOf([C(1), C(1), C(-1), C(-1), C(2), C(2)]), C(0), C(2), 2, 3, 6, [C(1), C(-1)]);
{
  const r = pre([polyOf([C(1), C(1), C(-1), C(-1), C(2), C(2)])], C(0));
  check('(z − 1)²(z + 1)²(z − 2)² at 0: 1, −1 and 2, each ×2', r.exact && r.zs.length === 3 && r.mult.every((m) => m === 2)
    && [C(1), C(-1), C(2)].every((z0) => r.zs.some((z) => near(z, z0, MULT_TOL))), r);
}
const eighth = Array.from({ length: 8 }, (_, k) => C(1.5 * Math.cos(Math.PI * (2 * k + 1) / 8), 1.5 * Math.sin(Math.PI * (2 * k + 1) / 8)));
multiple('(z − 0.5i)⁴ times 8 simple factors (degree 12)', polyOf([C(0, 0.5), C(0, 0.5), C(0, 0.5), C(0, 0.5), ...eighth]), C(0), C(0, 0.5), 4, 9, 12, eighth);
// roots out to |z| ≈ 3, where rounding is larger: two simple roots 1e-5 apart (w = 0 about 1.4e-7 from a critical
// value) stay two and are both found; an exact double root of a degree-12 polynomial is found, ×2
const A11 = [C(2), C(2 + 1e-5), C(-2), C(0, 2), C(0, -2), C(-2, 2), C(1, -2), C(-1, -2), C(2, 2), C(-2, -2), C(1, 2)];
simpleRoots('roots 2 and 2 + 1e-5 among 11 out to |z| ≈ 2.8', A11);
const B12 = [[2.37, 0.19], [2.58, 0.34], [0.64, -0.63], [0.47, -0.32], [1.68, 1.63], [1.17, -1.42], [-0.96, 1.95], [-2.26, -1.22], [0.98, 2.28], [0.51, 2.27]].map(([a, b]) => C(a, b));
multiple('a double root at 2.46 − 1.2i among 10 simple ones (degree 12)', polyOf([C(2.46, -1.2), C(2.46, -1.2), ...B12]), C(0), C(2.46, -1.2), 2, 11, 12, B12);
// a 4-fold root with a simple root 0.07 (and 0.49) away, degree 12: the simple root is not taken into the group, and the
// 4-fold root comes once, ×4
const P = (l) => l.map(([a, b]) => C(a, b));
const F1 = P([[0.17, -1.94], [0.09, 0.76], [-1.18, -1.15], [-1.27, 1.16], [0.48, -0.48], [1.01, -1.03], [-0.51, -1.1], [1.73, -0.55]]);
multiple('0.13 − 2i ×4 beside 0.17 − 1.94i', polyOf([C(0.13, -2), C(0.13, -2), C(0.13, -2), C(0.13, -2), ...F1]), C(0), C(0.13, -2), 4, 9, 12, F1);
const F2 = P([[0.05, -2.48], [-0.94, 1.95], [-0.44, -0.35], [-2.05, 1.31], [-1.46, -2.12], [0.35, 0.14], [1.7, -1.94], [-2.11, 1.25]]);
multiple('−0.23 − 2.89i ×4 beside 0.05 − 2.48i', polyOf([C(-0.23, -2.89), C(-0.23, -2.89), C(-0.23, -2.89), C(-0.23, -2.89), ...F2]), C(0), C(-0.23, -2.89), 4, 9, 12, F2);
// a 4-fold root with a simple root a few thousandths away: the simple root keeps its own place, apart from the group.
// f' there is only about (5e-3)⁴ times the rest, so rounding moves that root by about 1e-7 of its size, and the simple
// roots are checked to NEAR_MULT
const NEAR_MULT = 1e-5;
const G6 = P([[-0.687, -0.099], [-1.17, 0.121]]);
multiple('(z + 0.689 + 0.094i)⁴ beside −0.687 − 0.099i (degree 6)', polyOf([C(-0.689, -0.094), C(-0.689, -0.094), C(-0.689, -0.094), C(-0.689, -0.094), ...G6]), C(0), C(-0.689, -0.094), 4, 3, 6, G6, NEAR_MULT);
const G12 = P([[-0.17, 2.82], [-1.27, 1.21], [0.42, -0.58], [-0.41, -1.26], [1.08, -2.44], [1.45, 0.15], [1.75, -1.33], [0.23, 2.16]]);
multiple('−0.16 + 2.9i ×4 beside −0.17 + 2.82i (degree 12)', polyOf([C(-0.16, 2.9), C(-0.16, 2.9), C(-0.16, 2.9), C(-0.16, 2.9), ...G12]), C(0), C(-0.16, 2.9), 4, 9, 12, G12, NEAR_MULT);
// pointPre's answer for the roots `roots` at w = 0 against them, exact to POLY_RES as src/invops.js says: true roots
// within POLY_RES (1 + |z|) of each other (a chain of them) may come as one member. Each member goes to its nearest
// distinct true root, within POLY_RES (1 + |z|) of it, and no two members to the same one (a multiple root is not split);
// the members of each chain of roots have its multiplicity. {exact, err: '' when right}
const POLY_RES = 1e-2;
function atRes(roots) {
  const r = pre([polyOf(roots)], C(0));
  if (!r.exact) return { exact: false, err: '' };
  const D = [];
  for (const z of roots) { const e = D.find((q) => abs(sub(q.z, z)) <= 1e-12 * (1 + abs(z))); if (e) e.k++; else D.push({ z, k: 1 }); }
  const top = D.map((_, i) => i), find = (i) => (top[i] === i ? i : (top[i] = find(top[i])));
  D.forEach((a, i) => D.forEach((b, j) => { if (j > i && near(b.z, a.z, POLY_RES)) top[find(i)] = find(j); }));
  const want = new Map(), got = new Map(), taken = new Set(), errs = [];
  D.forEach((d, i) => want.set(find(i), (want.get(find(i)) || 0) + d.k));
  r.zs.forEach((z, m) => {
    const i = D.reduce((best, q, j) => (abs(sub(q.z, z)) < abs(sub(D[best].z, z)) ? j : best), 0);
    if (!near(z, D[i].z, POLY_RES)) { errs.push(`${cs(z)} is no root`); return; }
    if (taken.has(i)) errs.push(`${cs(D[i].z)} is split`);
    taken.add(i);
    got.set(find(i), (got.get(find(i)) || 0) + r.mult[m]);
  });
  for (const [c, k] of want) if (got.get(c) !== k) errs.push(`${cs(D[c].z)} ×${k} has ${got.get(c) || 0}`);
  return { exact: true, err: errs.join('; ') };
}
{
  // a double and a triple root 6e-5 apart, degree 12, where rounding spreads them 0.08: right to POLY_RES where exact
  // (no member 0.08 off in their cloud)
  const R = P([[-0.9341128907270848, -2.1476425193775563], [-0.9341128907270848, -2.1476425193775563], [-0.9340554204173177, -2.1476184451486784], [-0.9340554204173177, -2.1476184451486784], [-0.9340554204173177, -2.1476184451486784], [-0.37885362360029046, -1.5611011570115079], [2.313042398562536, -0.06975604449194375], [-1.5549094160163155, 0.2762565857647208], [-1.072906504020072, -1.711407858129532], [-1.0163548541919554, -2.1892230001085875], [-1.1765271348575228, -2.073035806460783], [2.181351204481983, 0.35248438453218733]]);
  const e = atRes(R);
  check('a double and a triple root 6e-5 apart (degree 12): right to POLY_RES where exact', !e.err, e);
}
{
  // a 4-fold root with a simple root 1e-3 away (degree 6): rounding cannot tell the five apart, and they are not split
  // into simple members 9e-4 apart in the 4-fold root's cloud; one ×5 member stands for them, within POLY_RES
  const z0 = C(-0.689, -0.094), e = atRes([z0, z0, z0, z0, CX.add(z0, C(1e-3 * Math.cos(0.7), 1e-3 * Math.sin(0.7))), C(-1.17, 0.121)]);
  check('(z + 0.689 + 0.094i)⁴ beside a simple root 1e-3 away (degree 6): exact, and right to POLY_RES', e.exact && !e.err, e);
}
// seeded families: right to POLY_RES wherever pointPre says it is exact, and exact in at least `floor` of the cases
{
  let s5 = 7;
  const r5 = () => (s5 = (s5 * 1103515245 + 12345) % 2147483648) / 2147483648;
  const disc = (lo, hi) => { const rr = Math.sqrt(lo * lo + (hi * hi - lo * lo) * r5()), a = 2 * Math.PI * r5(); return C(rr * Math.cos(a), rr * Math.sin(a)); };
  const near1 = (z0, lo, hi) => { const s = 10 ** (Math.log10(lo) + Math.log10(hi / lo) * r5()), a = 2 * Math.PI * r5(); return CX.add(z0, C(s * Math.cos(a), s * Math.sin(a))); };
  const family = (name, count, floor, make) => {
    let exact = 0;
    const wrong = [];
    for (let c = 0; c < count; c++) { const e = atRes(make()); if (e.exact) exact++; if (e.err) wrong.push(e.err); }
    check(`${name}, ${count} seeded cases: right to POLY_RES wherever exact`, !wrong.length, wrong);
    check(`${name}: exact in at least ${floor} of ${count}`, exact >= floor, exact);
  };
  const fill = (roots, d, R) => { while (roots.length < d) roots.push(disc(0, R)); return roots; };
  family('a k-fold root (k = 2 to 4) beside a simple one 1e-3 to 0.3 away, |z| 0.5 to 2.9', FAMILY, FLOOR_KFOLD, () => {
    const k = 2 + Math.floor(r5() * 3), d = 6 + Math.floor(r5() * 7), z0 = disc(0.5, 2.9);
    return fill([...Array(k).fill(z0), near1(z0, 1e-3, 0.3)], d, 2.9);
  });
  family('a double and a triple root 1e-5 to 1e-3 apart, degree 12', 200, FLOOR_PAIR, () => {
    const z0 = disc(0.5, 2.5), z1 = near1(z0, 1e-5, 1e-3);
    return fill([z0, z0, z1, z1, z1], 12, 2.5);
  });
  family('an exact k-fold root (k = 2 to 5), |z| <= 2', 200, FLOOR_EXACT, () => {
    const k = 2 + Math.floor(r5() * 4), z0 = disc(0, 2);
    return fill(Array(k).fill(z0), Math.max(k + 1, 3 + Math.floor(r5() * 10)), 2);
  });
}
// twelve roots at seeded random places on |z| = 3, where H_t's own rounding is about 1e-7: each a root to its rounding
// bound, every one found
{
  let s3 = 99;
  const r3 = () => (s3 = (s3 * 1103515245 + 12345) % 2147483648) / 2147483648;
  simpleRoots('twelve roots at random on |z| = 3', Array.from({ length: 12 }, () => { const a = 2 * Math.PI * r3(); return C(3 * Math.cos(a), 3 * Math.sin(a)); }));
}
{
  // ten roots on |z| = 2.9, w 1e-8 (1 + |v|) from the critical value v next to the first critical point: every root, simple
  const roots = Array.from({ length: 10 }, (_, k) => C(2.9 * Math.cos(0.12 + 0.63 * k), 2.9 * Math.sin(0.12 + 0.63 * k)));
  const co = expand(roots), dco = co.slice(0, -1).map((c, i) => CX.scale(c, 10 - i)), v = CX.polyEval(co, CX.polyRoots(dco)[0]);
  same('ten roots on |z| = 2.9', polyOf(roots), co, CX.add(v, C(1e-8 * (1 + abs(v)), 0)));
}

// a chain: M3, then z² (6 preimages: Durand–Kerner's roots of M3 at both square roots of w)
{
  const w = C(0.4, -0.3), s = CX.sqrt(w), r = pre([M3, step('pown', { n: 2 })], w), want = [...dk(M3co, s), ...dk(M3co, CX.neg(s))];
  check('M3 then z² at 0.4 − 0.3i: 6 roots, those of Durand–Kerner', r.exact && r.zs.length === 6 && r.total === 6 && want.every((z) => r.zs.some((q) => near(q, z, ROOT_TOL))), r);
}

// the order is the solver's: the same w gives the same list
{
  const a = pre([M3], C(0.3, 0.7)), b = pre([M3], C(0.3, 0.7));
  check('M3: the same w lists the same roots in the same order', a.exact && b.exact && a.zs.every((z, i) => z.re === b.zs[i].re && z.im === b.zs[i].im), [a.zs, b.zs]);
}

// still not exact: a degree above 12, a step that is not a polynomial
for (const [name, st] of [['z¹³ + z', step('custom', { expr: 'z^{13}+z' })], ['exp', step('exp')]]) {
  const r = pre([st], C(0.3, 0.7));
  check(`${name}: not exact`, hasPlan && !r.exact, r);
}
// a rational map of degree 4 is inverted in closed form (RAT4): z³ + 1/z at w, the 4 roots of z⁴ − w z + 1, each simple
{
  const w = C(0.3, 0.7), r = pre([step('custom', { expr: 'z^3+\\frac{1}{z}' })], w), want = dk([C(1), C(0), C(0), CX.neg(w), C(1)], C(0));
  check('z³ + 1/z: exact, the 4 roots of z⁴ − w z + 1', r.exact && r.zs.length === 4 && r.total === 4 && want.every((z) => r.zs.some((q) => near(q, z, ROOT_TOL))), r);
}
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);

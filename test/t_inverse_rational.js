// Rational custom formulas in the exact (inverse) renderer (SPEC 3.3 rev 3): a custom step, or a part of one, in which
// z occurs more than once and that is rational in z, e.g. (z^2-1)/(z^2+1) (example 9), (z+1/z)/2, z^2+2z,
// (z-a)(z-b)/(z-c). Its preimages of w are ALL roots of P(u) - w Q(u) = 0 with P/Q in lowest terms.
//   (a) the eligibility table (decomposition or the reason it goes forward)
//   (b) the normal form: exact coefficients, common factors (removable singularities) divided out
//   (c) round trips on random points: every candidate maps back (sound), every sampled preimage is found (complete),
//       the number of finite candidates is the degree
//   (d) the degenerate values: the value at infinity (degree drop), critical values (double roots), near-degenerate w
//   (e) the same map as a catalog 'rational' step gives the same candidates
//   (f) fuzz: random degree <= 2 rational formulas written in several ways
// Run: node test/t_inverse_rational.js [--quick] [--table]   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const Inverse = require('../src/inverse.js');
const C = CX.C;
const QUICK = process.argv.includes('--quick');
const TABLE = process.argv.includes('--table');
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
let seed = 4242;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rc = (s = 2) => C((rnd() * 2 - 1) * s, (rnd() * 2 - 1) * s);
const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
const boxOf = (cx, cy, s, w = 410, h = 516) => ({ x0: cx - w / 2 / s, x1: cx + w / 2 / s, y0: cy - h / 2 / s, y1: cy + h / 2 / s });
const WIN0 = boxOf(0, 0, 60);
const BIG = { kind: 'disc', c: [0, 0], r: 1e6 };
const t0 = Date.now();
const kindsOf = (r) => (r.ok ? r.ops.map((o) => o.kind).join('>') : null);
const build = (expr, cut = 180) => { const st = St('custom', { expr, cut }); return { st, b: Funcs.build(st) }; };
const near = (a, b, tol) => CX.abs(CX.sub(a, b)) <= tol;
// all leaves of w (finite and of any range level) for a plan prepared on a shape
function leavesOf(plan, prep, w) { return Inverse.enumerate(plan, prep, w, 1, { full: 40, ramp: 1e-9 }).leaves; }
// how far from u the forward map's own rounding of w = f(u) can move a preimage: |dz| = eps |w| / |f'(u)| at a simple
// point; near a critical point of order k (|f'| tiny) the k-th root of it (z^16 near 0: w = -1 exactly)
function lost(f, u, w) {
  const h = 1e-4 * (1 + CX.abs(u)), d = CX.abs(CX.sub(f(CX.add(u, C(h, 0))), f(CX.sub(u, C(h, 0))))) / (2 * h);
  const e = 4e-16 * (1 + CX.abs(w));
  if (d > 1e-3) return 0;
  return Math.max(e / (d || 1e-300), Math.pow(e, 1 / 16));
}

// =================================================================================================================
// (a) eligibility
// =================================================================================================================
console.log('--- (a) eligibility table');
const TABLE_ROWS = [
  // [formula, expected op kinds | 'X:' + a substring of the reason]
  ['\\frac{z^2-1}{z^2+1}', 'RAT2'],
  ['(z+1/z)/2', 'RAT2>AFF'],
  ['\\frac{z+\\frac{1}{z}}{2}', 'RAT2>AFF'],
  ['z^2+2z', 'QUAD'],
  ['z\\cdot z', 'QUAD'],
  ['z(z+1)', 'QUAD'],
  ['\\frac{(z-1)(z-2i)}{z-0.5}', 'RAT2'],
  ['\\frac{z^2+z}{z^2+1}', 'RAT2'],
  ['\\frac{1}{z}+\\frac{1}{z+1}', 'RAT2'],
  ['\\frac{z}{z^2+1}', 'RAT2'],
  ['\\frac{z+1/z}{z-1/z}', 'RAT2'],
  ['\\frac{z^2-1}{z-1}', 'AFF'],
  ['\\frac{z^2}{z^2+z}', 'MOB'],
  ['\\frac{1}{z}+\\frac{1}{z}', 'MOB'],
  ['\\frac{z+1}{z-1}+z^0', 'MOB'],
  ['\\frac{(z-1)^2(z+2)}{(z-1)^2(z+3)}', 'MOB'],
  // common factors of unequal multiplicity (exact gcd over Z[i], SPEC 3.3): reduced exactly, never a false RAT2
  ['\\frac{(z-1)^3}{(z-1)^2(z+2)}', 'MOB'], ['\\frac{(z-1)^3}{(z-1)^2(z+1)}', 'MOB'], ['\\frac{(z-2)^3}{(z-2)^2(z+1)}', 'MOB'],
  ['\\frac{(z+i)^3}{(z+i)^2(z-1)}', 'MOB'], ['\\frac{z^2-2z+1}{z^2-1}', 'MOB'], ['\\frac{z^2+2z+1}{z^2+3z+2}', 'MOB'],
  ['\\frac{(z-1)^2}{(z-1)(z^2+1)}', 'RAT2'], ['\\frac{(z-0.5)^2}{(z-0.5)(z+1)}', 'MOB'], ['\\frac{(z-i)^2}{(z-i)(z+1)}', 'MOB'],
  ['\\frac{(z-1)^4}{(z-1)^3(z+1)}', 'MOB'], ['\\frac{z^2-2z+1}{z^3-1}', 'RAT2'], ['\\frac{(z-1/3)^3}{(z-1/3)^2(z+1)}', 'MOB'],
  ['\\frac{(z-\\pi)^3}{(z-\\pi)^2(z+1)}', 'MOB'], ['\\frac{z^2-0.01}{z-0.1}', 'AFF'],
  // a near-common root inside a cluster is refused, not deflated in floats
  ['\\frac{(z-1)^3}{(z-1)^2(z-1.0000000001)}', 'X:nearly share a root'],
  ['\\log\\frac{z-1}{z+1}', 'MOB>LOG'],
  ['\\sqrt{z^2-1}', 'IPOW>AFF>ROOTPOW'],
  ['\\sqrt{(z-1)(z+1)}', 'QUAD>ROOTPOW'],
  ['\\left(\\frac{z-i}{z+i}\\right)^3', 'MOB>IPOW'],
  ['e^{z+\\frac{1}{z}}', 'RAT2>EXP'],
  ['\\sin(z+1/z)', 'RAT2>SIN'],
  ['z^3+\\frac{1}{z^3}', 'IPOW>RAT2'],
  ['\\frac{z^4-1}{z^4+1}', 'IPOW>MOB'],
  ['z^4+2z^2', 'IPOW>QUAD'],
  ['\\frac{z^{16}+1}{z^{16}-1}', 'IPOW>MOB'],
  ['(z+0.1)^2-z^2', 'AFF'],
  ['z^3-z', 'X:polynomial formula of degree 3'],
  ['z^2+\\frac{1}{z}', 'X:rational formula of degree 3'],
  ['\\frac{z^3-1}{z^2+1}', 'X:rational formula of degree 3'],
  ['(z^2+z)^2', 'QUAD>IPOW'],
  ['z^4+z^3+1', 'X:polynomial formula of degree 4'], ['(z^2+z^3)^2', 'X:polynomial formula of degree 3'],
  ['\\frac{z^{17}+1}{z^{17}-1}', 'X:rational formula of degree 17'],
  ['(z+1)^{40}-z^{40}', 'X:degree above 32'],
  ['\\frac{z}{z}', 'X:constant map'],
  ['(z-1)^2/(z-1)^2', 'X:constant map'],
  ['z^{z}', 'X:variable base and exponent'],
  ['z\\overline{z}', 'X:not rational in z (a conjugate)'],
  ['z+\\sin z', 'X:not rational in z (\\sin)'],
  ['z+\\sqrt{z}', 'X:not rational in z'],
  ['z^{1.5}+z', 'X:not rational in z (a non-integer power)'],
  ['z+e^{z}', 'X:not rational in z'],
];
const tableOut = [];
for (const [e, want] of TABLE_ROWS) {
  const { b } = build(e);
  if (b.error) { check(`build ${e}`, false, b.error); continue; }
  const r = Inverse.stepOps(b);
  const got = r.ok ? kindsOf(r) : 'X:' + r.reason;
  tableOut.push([e, got]);
  const ok = want.startsWith('X:') ? (!r.ok && r.reason.includes(want.slice(2))) : got === want;
  check(`eligibility ${e}`, ok, `want ${want}, got ${got}`);
}
if (TABLE) for (const [e, got] of tableOut) console.log(`  ${e.padEnd(40)} ${got}`);

// =================================================================================================================
// (b) the normal form
// =================================================================================================================
console.log('--- (b) normal form');
{
  const rf = (e) => Inverse.rationalForm(Expr.parse(e));
  const eqCo = (a, b) => a.length === b.length && a.every((x, i) => x.re === b[i][0] && x.im === b[i][1]);
  const r9 = rf('\\frac{z^2-1}{z^2+1}');
  check('example 9: P = z^2 - 1 exactly', r9.ok && eqCo(r9.P, [[1, 0], [0, 0], [-1, 0]]), JSON.stringify(r9.P));
  check('example 9: Q = z^2 + 1 exactly', r9.ok && eqCo(r9.Q, [[1, 0], [0, 0], [1, 0]]), JSON.stringify(r9.Q));
  check('example 9: exact, degree 2, nothing removed', r9.ok && r9.exact && r9.deg === 2 && !r9.removed.length);
  const rj = rf('z+\\frac{1}{z}');
  check('z + 1/z = (z^2 + 1)/z exactly', rj.ok && eqCo(rj.P, [[1, 0], [0, 0], [1, 0]]) && eqCo(rj.Q, [[1, 0], [0, 0]]) && rj.exact);
  const rr = rf('\\frac{z^2-1}{z-1}');
  check('(z^2 - 1)/(z - 1): the common root 1 is removed', rr.ok && rr.deg === 1 && rr.removed.length === 1 && near(rr.removed[0], C(1, 0), 1e-12) && rr.Q.length === 1);
  const rc3 = rf('\\frac{(z-1)^2(z+2)}{(z-1)^2(z+3)}');
  check('a double common root is removed twice', rc3.ok && rc3.deg === 1 && rc3.removed.length === 2, JSON.stringify(rc3));
  const rz = rf('\\frac{z^3+z}{z^3-z}');
  check('a common power of z is removed exactly', rz.ok && rz.deg === 2 && rz.exact && !rz.removed.length, JSON.stringify(rz));
  const ra = rf('\\frac{z-1}{z-1.001}');
  check('roots 1e-3 apart are kept apart (a Möbius map)', ra.ok && ra.deg === 1);
  const rb = rf('\\frac{z^2-1}{(z-1)(z+1.000000001)}');
  check('roots 1e-9 apart are ambiguous (a pole-zero dipole): reason', !rb.ok && /nearly share a root/.test(rb.reason), rb.reason);
  const rb2 = rf('\\frac{z-1}{z-1.0000001}');
  check('roots 1e-7 apart are ambiguous: reason', !rb2.ok && /nearly share a root/.test(rb2.reason), rb2.reason);
  const rb3 = rf('\\frac{z^2-1}{(z-1)(z+1.0000000000000002)}');
  check('roots at rounding distance are common: constant', !rb3.ok && /constant/.test(rb3.reason), rb3.reason);
  const rs = rf('\\frac{(10^{6}z)^2+1}{(10^{6}z)^2-1}');
  const mx = rs.ok ? Math.max(...rs.P.concat(rs.Q).map(CX.abs)) : 0;
  check('coefficients are scaled by a power of 2 to about 1', rs.ok && mx >= 0.5 && mx <= 2, mx);
  const rn = rf('(z+0.1)^2-z^2-0.2z');
  check('a cancelled coefficient is rounding noise, not a degree', !rn.ok || rn.deg === 0, JSON.stringify(rn));
  // unequal multiplicities: the exact gcd leaves P, Q coprime and exact (the old float deflation left 1e-6 errors)
  const rm = rf('\\frac{(z-1)^3}{(z-1)^2(z+2)}');
  check('(z-1)^3/((z-1)^2(z+2)) = (z-1)/(z+2) exactly, 1 removed twice', rm.ok && rm.deg === 1 && rm.removed.length === 2
    && rm.removed.every((r) => near(r, C(1, 0), 1e-9)) && rm.P.every((c) => c.im === 0) && CX.abs(CX.add(CX.div(rm.P[1], rm.P[0]), C(1, 0))) === 0
    && CX.abs(CX.sub(CX.div(rm.Q[1], rm.Q[0]), C(2, 0))) === 0, JSON.stringify(rm));
  const r01 = rf('(z+0.1)(z+0.2)-z^2-0.3z');
  check('decimal literals are exact: (z+0.1)(z+0.2) - z^2 - 0.3z is the constant 0.02', !r01.ok && /constant/.test(r01.reason), JSON.stringify(r01));
}
// common factors of random multiplicities (exact roots from a small pool: integers, i, halves, 1/3): the exact gcd
// reduces every one; the reduced degree is max(deg P, deg Q) after cancellation, P/Q agrees with the formula off
// the removed roots, and nothing is refused as 'nearly share a root'
{
  const pool = [['1', C(1, 0)], ['-2', C(-2, 0)], ['i', C(0, 1)], ['0.5', C(0.5, 0)], ['\\frac{1}{3}', C(1 / 3, 0)], ['(1+i)', C(1, 1)]];
  let bad = 0, cases = 0;
  for (let t = 0; t < 60; t++) {
    const mp = pool.map(() => Math.floor(rnd() * 3)), mq = pool.map(() => Math.floor(rnd() * 3));
    const dp = mp.reduce((a, b) => a + b, 0), dq = mq.reduce((a, b) => a + b, 0);
    if (!dp || !dq || dp > 8 || dq > 8) continue;
    const side = (m) => pool.map(([tx], k) => (m[k] ? `(z-${tx})^{${m[k]}}` : '')).join('');
    const e = `\\frac{${side(mp)}}{${side(mq)}}`;
    const rem = pool.map((_, k) => Math.min(mp[k], mq[k])), d = Math.max(dp, dq) - rem.reduce((a, b) => a + b, 0);
    const r = Inverse.rationalForm(Expr.parse(e));
    cases++;
    if (d === 0) { if (r.ok || !/constant/.test(r.reason)) { bad++; console.log('  want constant', e, r.reason); } continue; }
    if (!r.ok || r.deg !== d || r.removed.length !== rem.reduce((a, b) => a + b, 0)) { bad++; console.log('  ', e, JSON.stringify({ ok: r.ok, reason: r.reason, deg: r.deg, want: d, removed: r.removed && r.removed.length })); continue; }
    const f = Expr.compile(Expr.parse(e));
    for (let k = 0; k < 6; k++) {
      const z = rc(2), w = f(z), v = CX.div(CX.polyEval(r.P, z), CX.polyEval(r.Q, z));
      if (CX.isFin(w) && CX.abs(w) < 1e6 && !(CX.abs(CX.sub(w, v)) <= 1e-9 * (1 + CX.abs(w)))) { bad++; console.log('  value', e, z, w, v); break; }
    }
  }
  check(`random common factors (${cases} formulas): exact reduction, degree, removed count and values`, bad === 0 && cases > 20, `${bad} bad`);
}
// a removed common root is a hole of the reduced op: point pull-backs leave it out (the formula is 0/0 there), and an
// area containing it paints the true image only (the false RAT2 painted the whole w-plane)
{
  for (const [e, w0, r0] of [['\\frac{(z-1)^3}{(z-1)^2(z+2)}', C(0, 0), C(1, 0)], ['\\frac{(z-1)^2}{z-1}', C(0, 0), C(1, 0)], ['\\frac{z^2-1}{z-1}', C(2, 0), C(1, 0)]]) {
    const { st, b } = build(e);
    const plan = Inverse.planChain([st], [b]);
    const ops = plan.ok ? plan.ops : [];
    const holes = ops.flatMap((o) => o.holes || []);
    check(`${e}: the removed point is a hole`, holes.some((h) => near(h, r0, 1e-9)), JSON.stringify(holes));
    const sing = plan.ok ? Inverse.singular(plan, WIN0, ['undef', 'branch', 'pole'], 16) : [];
    check(`${e}: no singular point at the hole`, !sing.some((x) => near(x.z, r0, 1e-6)), JSON.stringify(sing));
    const fwd = ops.length ? ops[ops.length - 1] : null;
    const pre = fwd ? fwd.pre(w0).map((m) => m.u) : [];
    check(`${e}: pre(lim) still solves the reduced form`, pre.some((u) => near(u, r0, 1e-9)), JSON.stringify(pre));
  }
  const W = 82, H = 60, s = 10;
  for (const e of ['\\frac{(z-1)^3}{(z-1)^2(z+2)}', '\\frac{(z-1)^3}{(z-1)^2(z+1)}', '\\frac{(z+i)^3}{(z+i)^2(z-1)}']) {
    const { st, b } = build(e);
    const plan = Inverse.planChain([st], [b]);
    if (!plan.ok) { check(`plan ${e}`, false, plan.reason); continue; }
    const rr = Inverse.rationalForm(Expr.parse(e)), c = rr.removed[0];
    const disc = { kind: 'disc', c: [c.re, c.im], r: 0.25 };
    const view = { cx: 0, cy: 0, s };
    const win = { x0: -W / 2 / s, x1: W / 2 / s, y0: -H / 2 / s, y1: H / 2 / s };
    const r = Inverse.renderCPU(plan, [disc], Object.assign({ W, H, win }, view), { pattern: 'solid' });
    let painted = 0;
    for (let i = 0; i < W * H; i++) if (r.stats.alpha[i] > 0.5) painted++;
    // the true image of |z - r| < 0.25 under the reduced Möbius map is a small disc: a few px at s = 10
    check(`${e}: a disc around the removed point paints its true image only`, painted > 0 && painted < 0.05 * W * H, `${painted} of ${W * H} px`);
  }
}

// =================================================================================================================
// (c) round trips: sound, complete, the degree's count
// =================================================================================================================
console.log('--- (c) round trips');
const RT = [
  ['\\frac{z^2-1}{z^2+1}', 2], ['(z+1/z)/2', 2], ['z^2+2z', 2], ['\\frac{(z-1)(z-2i)}{z-0.5}', 2], ['\\frac{z^2+z}{z^2+1}', 2],
  ['\\frac{1}{z}+\\frac{1}{z+1}', 2], ['\\frac{z}{z^2+1}', 2], ['\\frac{z+1/z}{z-1/z}', 2], ['\\frac{z^2-1}{z-1}', 1], ['\\frac{z^2}{z^2+z}', 1],
  ['\\frac{(1+i)z^2-3}{(2-i)z^2+z-0.5i}', 2], ['\\frac{(z-0.3)(z+0.7i)}{(z+1)(z-2)}', 2], ['z^3+\\frac{1}{z^3}', 6], ['\\frac{z^4-1}{z^4+1}', 4],
  ['z^4+2z^2', 4], ['\\left(\\frac{z-i}{z+i}\\right)^3', 3], ['\\frac{z^{16}+1}{z^{16}-1}', 16],
  // families over a rational part (the count is not checked)
  ['\\log\\frac{z-1}{z+1}', 0], ['\\sqrt{z^2-1}', 0], ['e^{z+\\frac{1}{z}}', 0], ['\\sin(z+1/z)', 0],
];
const shape = { kind: 'disc', c: [0, 0], r: 3 };
for (const [e, deg] of RT) {
  const { st, b } = build(e);
  const plan = Inverse.planChain([st], [b]);
  if (!plan.ok) { check(`plan ${e}`, false, plan.reason); continue; }
  const prep = Inverse.prepare(plan, { win: WIN0, shape: deg ? BIG : shape });
  if (!prep.ok) { check(`prepare ${e}`, false, prep.reason); continue; }
  let unsound = 0, miss = 0, dec = 0, cnt = 0, tried = 0, worst = 0;
  const T = QUICK ? 120 : 400;
  for (let t = 0; t < T; t++) {
    const u = rc(2.5), w = b.f(u);
    if (!CX.isFin(w) || CX.abs(w) > 1e8) continue;
    tried++;
    let x = u; for (const o of plan.ops) x = o.fwd(x);
    if (!near(x, w, 1e-9 * (1 + CX.abs(w)))) dec++;
    const lv = leavesOf(plan, prep, w).filter((lf) => CX.isFin(lf.z) && lf.lvl > 1e-7);
    for (const lf of lv) {
      const wb = b.f(lf.z), err = CX.abs(CX.sub(wb, w)) / (1 + CX.abs(w));
      worst = Math.max(worst, err);
      if (!(err <= 1e-8)) unsound++;
    }
    if (!lv.some((lf) => near(lf.z, u, 1e-7 * (1 + CX.abs(u)) + lost(b.f, u, w)))) miss++;
    if (deg && lv.length !== deg) cnt++;
  }
  check(`round trip ${e} [${kindsOf(plan)}]`, !unsound && !miss && !dec && !cnt && tried > (QUICK ? 50 : 200),
    `unsound ${unsound} missed ${miss} decomposition ${dec} count ${cnt} (of ${tried}); worst |f(z) - w| ${worst.toExponential(1)}`);
}

// =================================================================================================================
// (d) degenerate values of w
// =================================================================================================================
console.log('--- (d) degenerate values');
{
  const prepOf = (e) => { const { st, b } = build(e); const plan = Inverse.planChain([st], [b]); return { plan, prep: Inverse.prepare(plan, { win: WIN0, shape: BIG }), b }; };
  const fin = (ls) => ls.filter((lf) => CX.isFin(lf.z));
  const back = (b, ls, w, tol = 1e-8) => ls.every((lf) => CX.abs(CX.sub(b.f(lf.z), w)) <= tol * (1 + CX.abs(w)));
  // example 9: w = 1 is the value at infinity (double): no finite preimage; w = -1 a critical value (z = 0 double)
  const E9 = prepOf('\\frac{z^2-1}{z^2+1}');
  check('example 9 at w = 1 (only z = infinity): no candidate', fin(leavesOf(E9.plan, E9.prep, C(1, 0))).length === 0);
  const lm1 = fin(leavesOf(E9.plan, E9.prep, C(-1, 0)));
  check('example 9 at w = -1 (critical value): z = 0, counted once', lm1.length === 1 && near(lm1[0].z, C(0, 0), 1e-12), JSON.stringify(lm1.map((l) => l.z)));
  for (const eps of [1e-6, 1e-10, 1e-13]) {
    const w = C(1 + eps, eps), ls = fin(leavesOf(E9.plan, E9.prep, w));
    check(`example 9 near the value at infinity (w = 1 + ${eps}(1 + i)): two far preimages that map back`, ls.length === 2 && back(E9.b, ls, w, 1e-6) && ls.every((l) => CX.abs(l.z) > 0.1 / Math.sqrt(eps)),
      JSON.stringify(ls.map((l) => [l.z, E9.b.f(l.z)])));
  }
  // (z^2 + z)/(z^2 + 1): the degree drops by one at w = 1 (z = 1 and infinity)
  const D = prepOf('\\frac{z^2+z}{z^2+1}');
  const l1 = fin(leavesOf(D.plan, D.prep, C(1, 0)));
  check('(z^2+z)/(z^2+1) at w = 1: the degree drops, z = 1 alone', l1.length === 1 && near(l1[0].z, C(1, 0), 1e-12), JSON.stringify(l1.map((l) => l.z)));
  for (const eps of [1e-6, 1e-10, 1e-13]) {
    const w = C(1 + eps, 0), ls = fin(leavesOf(D.plan, D.prep, w));
    check(`(z^2+z)/(z^2+1) at w = 1 + ${eps}: z near 1 and a far root, both map back`, ls.length === 2 && back(D.b, ls, w, 1e-6) && ls.some((l) => near(l.z, C(1, 0), 1e-3)), JSON.stringify(ls.map((l) => l.z)));
  }
  // critical values of a generic rational map: P'Q - PQ' = 0 at z_c, w_c = f(z_c): the double root is found
  {
    const { b } = D;
    // (z^2 + z)/(z^2 + 1): N(z) = (2z + 1)(z^2 + 1) - (z^2 + z) 2z = -z^2 + 2z + 1, z_c = 1 +- sqrt 2
    for (const zc of [C(1 + Math.SQRT2, 0), C(1 - Math.SQRT2, 0)]) {
      const wc = b.f(zc), ls = fin(leavesOf(D.plan, D.prep, wc));
      check(`(z^2+z)/(z^2+1) at the critical value f(${zc.re.toFixed(3)}): the double root`, ls.length >= 1 && ls.every((l) => near(l.z, zc, 1e-6)) && back(b, ls, wc), JSON.stringify(ls.map((l) => l.z)));
    }
  }
  // a removable singularity: (z^2 - 1)/(z - 1) = z + 1 for z != 1; at w = 3 the preimage is 2 (never the common root)
  const RS = prepOf('\\frac{z^2-1}{z-1}');
  const l3 = fin(leavesOf(RS.plan, RS.prep, C(3, 0)));
  check('removable singularity: (z^2-1)/(z-1) at w = 3 -> z = 2 only', l3.length === 1 && near(l3[0].z, C(2, 0), 1e-12));
  const lr = fin(leavesOf(RS.plan, RS.prep, C(0.5, 0.25)));
  check('removable singularity: one preimage, never z = 1', lr.length === 1 && !near(lr[0].z, C(1, 0), 1e-6));
  // poles: Q = 0 is never a candidate (w finite); w = infinity is not a pixel
  const P9 = fin(leavesOf(E9.plan, E9.prep, C(1e7, -3e6)));
  check('example 9 at a huge w: two candidates next to the poles +-i, both map back', P9.length === 2 && P9.every((l) => Math.min(CX.abs(CX.sub(l.z, C(0, 1))), CX.abs(CX.sub(l.z, C(0, -1)))) < 1e-3) && back(E9.b, P9, C(1e7, -3e6), 1e-6));
  // the plan's singular points: the poles of the rational part, and infinity -> the value at infinity
  const sg = Inverse.singular(E9.plan, WIN0, ['pole']);
  check('example 9 poles = +-i', sg.length === 2 && sg.every((s) => near(s.z, C(0, 1), 1e-9) || near(s.z, C(0, -1), 1e-9)), JSON.stringify(sg));
  const LG = prepOf('\\log\\frac{z^2+z}{z^2+1}');
  const br = Inverse.singular(LG.plan, WIN0, ['branch']).map((s) => s.z);
  // log's branch point 0 pulls back to z = 0, -1; infinity pulls back to the poles +-i (and infinity: not finite)
  check('log of a rational part: branch points pulled back through RAT2', [C(0, 0), C(-1, 0), C(0, 1), C(0, -1)].every((p) => br.some((z) => near(z, p, 1e-9))), JSON.stringify(br));
}

// =================================================================================================================
// (e) the catalog 'rational' step with the same P/Q gives the same candidates
// =================================================================================================================
console.log('--- (e) custom vs catalog rational');
{
  const pairs = [['\\frac{z^2-1}{z^2+1}', { p: '1, 0, -1', q: '1, 0, 1' }], ['\\frac{(1+i)z^2-3}{(2-i)z^2+z-0.5i}', { p: '1+i, 0, -3', q: '2-i, 1, -0.5i' }], ['\\frac{z^2+2}{z}', { p: '1, 0, 2', q: '1, 0' }]];
  for (const [e, pq] of pairs) {
    const A = build(e), Bst = St('rational', pq), Bb = Funcs.build(Bst);
    const pa = Inverse.planChain([A.st], [A.b]), pb = Inverse.planChain([Bst], [Bb]);
    const qa = Inverse.prepare(pa, { win: WIN0, shape: BIG }), qb = Inverse.prepare(pb, { win: WIN0, shape: BIG });
    let diff = 0;
    for (let t = 0; t < 100; t++) {
      const w = rc(3);
      const la = leavesOf(pa, qa, w).map((l) => l.z), lb = leavesOf(pb, qb, w).map((l) => l.z);
      if (la.length !== lb.length || !la.every((z) => lb.some((y) => near(z, y, 1e-12 * (1 + CX.abs(z)))))) diff++;
    }
    check(`custom ${e} = catalog rational ${JSON.stringify(pq)}`, pa.ok && pb.ok && kindsOf(pa) === kindsOf(pb) && diff === 0, `${kindsOf(pa)} vs ${kindsOf(pb)}, ${diff} differ`);
  }
}

// =================================================================================================================
// (f) fuzz: random rational formulas of degree <= 2, written expanded, factored and as partial fractions
// =================================================================================================================
console.log('--- (f) fuzz');
{
  const num = (x) => String(+x.toFixed(3));
  const cs = (z) => `(${num(z.re)}${z.im < 0 ? '-' : '+'}${num(Math.abs(z.im))}i)`;
  const forms = [
    () => `\\frac{${cs(rc())}z^2+${cs(rc())}z+${cs(rc())}}{${cs(rc())}z^2+${cs(rc())}z+${cs(rc())}}`,
    () => `\\frac{(z-${cs(rc())})(z-${cs(rc())})}{z-${cs(rc())}}`,
    () => `${cs(rc())}z+\\frac{${cs(rc())}}{z-${cs(rc())}}`,
    () => `\\frac{${cs(rc())}}{z-${cs(rc())}}+\\frac{${cs(rc())}}{z-${cs(rc())}}`,
    () => `\\frac{z-${cs(rc())}}{(z-${cs(rc())})(z-${cs(rc())})}`,
    () => `${cs(rc())}z^2+${cs(rc())}z+${cs(rc())}`,
    () => `\\frac{z}{${cs(rc())}}+\\frac{${cs(rc())}}{z}`,
  ];
  let cases = 0, failed = 0, inel = 0;
  const N = QUICK ? 60 : 250;
  for (let k = 0; k < N; k++) {
    const e = forms[k % forms.length]();
    const { st, b } = build(e);
    if (b.error) continue;
    const plan = Inverse.planChain([st], [b]);
    if (!plan.ok) { inel++; console.log('  ineligible:', e, plan.reason); continue; }
    const prep = Inverse.prepare(plan, { win: WIN0, shape: BIG });
    cases++;
    let unsound = 0, miss = 0;
    for (let t = 0; t < 40; t++) {
      const u = rc(2.5), w = b.f(u);
      if (!CX.isFin(w) || CX.abs(w) > 1e6) continue;
      const lv = leavesOf(plan, prep, w).filter((lf) => CX.isFin(lf.z));
      // the forward map's own conditioning near a double root or a pole: |dw| ~ |f'(z)| |dz|
      for (const lf of lv) if (!(CX.abs(CX.sub(b.f(lf.z), w)) <= 1e-7 * (1 + CX.abs(w)))) unsound++;
      if (!lv.some((lf) => near(lf.z, u, 1e-6 * (1 + CX.abs(u)) + lost(b.f, u, w)))) miss++;
    }
    if (unsound || miss) { failed++; console.log('  fuzz fail:', e, kindsOf(plan), `unsound ${unsound} missed ${miss}`); }
  }
  check(`fuzz: ${cases} random rational formulas round-trip`, failed === 0 && inel === 0 && cases > N / 2, `${failed} failing, ${inel} ineligible`);
}

console.log(`\n${n} checks, ${bad} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(bad ? 1 : 0);

// All sheets while the deformation shows (notes/v16-user5/SHEETS-DESIGN.md), on the shipped modules: the sheets of H_t
// at t = end are F's All sheets combo for combo, bit for bit; at t = 0 they are H_0's (the deformed pieces the identity,
// every one of their sheets the same surface); the counts; the nodes between steps; the worked numbers of the user's
// case (sin √z, √ bracketed); the maps that cannot be drawn as sheets. Run: node test/t_sheets_deform.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
try { global.Recognize = require('../src/recognize.js'); } catch (e) { /* optional */ }
const FN = require('../src/funcs.js');
const HomRange = require('../src/homrange.js');
const { C } = CX;
let checks = 0, failed = 0;
const check = (name, cond, got) => { checks++; if (!cond) { failed++; if (failed < 60) console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
const same = (x, y) => x === y || (Number.isNaN(x) && Number.isNaN(y));
const eqb = (u, v) => same(u.re, v.re) && same(u.im, v.im);
const near = (u, v, tol = 1e-12) => CX.abs(CX.sub(u, v)) <= tol * (1 + CX.abs(v));

function chain(stepsIn) {
  let uidN = 0;
  const S = { focus: 0, homAll: false, steps: stepsIn.map((s) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: s.on !== false, uid: 'f' + (++uidN) })) };
  const built = S.steps.map((st) => FN.build(st)), stageFns = FN.stageFunctions(S.steps, built);
  const n = () => S.steps.length;
  const isDeriv = (k) => { const st = S.steps[k - 1], b = built[k - 1]; return !!st && st.on !== false && !!b && !b.error && (st.type === 'deriv' || b.op === 'deriv'); };
  const stepFn = (k) => { const st = S.steps[k - 1], b = built[k - 1]; if (!st || st.on === false || !b || b.error || isDeriv(k) || typeof b.f !== 'function') return null; return b.f; };
  const stepActive = (k) => !!stepFn(k) || isDeriv(k);
  const stageF = (k) => stageFns[Math.max(0, Math.min(n(), k))] || ((z) => z);
  const rangeF = (a, b) => { if (!a) return stageF(b); const fs = []; for (let i = a + 1; i <= b; i++) { const f = stepFn(i); if (f) fs.push(f); } return (z) => { for (const f of fs) z = f(z); return z; }; };
  const HR = HomRange.make({ n, stepFn, isDeriv, stepActive, stageF, rangeF, built: () => built, C });
  return { S, HR, built, n };
}
// the app's endMap (F on the left plane) and leftStage
const endMap = (S, n) => (S.focus === 0 ? { mode: 0, a: 0, b: n } : { mode: 0, a: S.focus - 1, b: S.focus });
const W = 2;
// points and cell centres (a centre a little off its point, as a grid cell's)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const PTS = [];
for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
  const z = C(-3 + 6 * (i + 0.5 + 0.3 * (rnd() - 0.5)) / 9 + 1e-3, -3 + 6 * (j + 0.5 + 0.3 * (rnd() - 0.5)) / 9 + 1e-3);
  const r = 0.03 * (1 + CX.abs(z));
  PTS.push([C(z.re + 0.6 * r, z.im - 0.8 * r), z]);
}
const CHAINS = {
  sinsqrt: [{ type: 'root', params: { n: 2 } }, { type: 'sin' }],
  sinsqrt90: [{ type: 'root', params: { n: 2, cut: -90 } }, { type: 'sin' }],
  root3exp: [{ type: 'root', params: { n: 3, cut: 45, k: 3 } }, { type: 'exp' }],
  logsin: [{ type: 'log' }, { type: 'sin' }],
  mullogroot: [{ type: 'mul', params: { c: '1+i' } }, { type: 'log' }, { type: 'root' }],
  powa23: [{ type: 'powa', params: { alpha: '0.6666666666666666' } }, { type: 'sin' }],
  powacx: [{ type: 'powa', params: { alpha: '0.5+0.4i' } }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
  recsqrt: [{ type: 'custom', params: { expr: '\\sqrt{z^2-1}' } }, { type: 'cos' }],
  reclog: [{ type: 'custom', params: { expr: '2\\log(z+1)' } }, { type: 'root', params: { n: 2 } }],
  pairpost: [{ type: 'sin' }, { type: 'custom', params: { expr: '\\log z+\\sqrt{z}' } }],
  root30: [{ type: 'root', params: { n: 30 } }, { type: 'sin' }],
};
let cases = 0;
// every configuration of a chain: no bracket (one after another, all at once), each bracket, each focus
function configs(ch) {
  const n = ch.n(), out = [];
  out.push({ name: 'whole', focus: 0, hr: null, all: false });
  if (n > 1) out.push({ name: 'whole all', focus: 0, hr: null, all: true });
  for (let a = 1; a <= n; a++) for (let b = a; b <= n; b++) if (!(a === 1 && b === n)) { out.push({ name: `bracket ${a}-${b}`, focus: 0, hr: { a, b }, all: false }); if (b > a) out.push({ name: `bracket ${a}-${b} all`, focus: 0, hr: { a, b }, all: true }); }
  for (let k = 1; k <= n; k++) out.push({ name: `focus ${k}`, focus: k, hr: null, all: false });
  return out;
}
for (const [cname, steps] of Object.entries(CHAINS)) {
  const ch = chain(steps), S = ch.S, n = ch.n(), built = ch.built;
  for (const cf of configs(ch)) {
    S.focus = cf.focus; S.homAll = cf.all; if (cf.hr) S.homRange = { a: cf.hr.a, b: cf.hr.b }; else delete S.homRange;
    const nm = `${cname} ${cf.name}`;
    const R = ch.HR.range(S);
    if (!R.steps.length) continue;
    const lenT = ch.HR.allAtOnce(S, R) ? 1 : R.steps.length;
    const leftStage = S.focus === 0 ? 0 : S.focus - 1;
    const st = (T) => ch.HR.state(S, T, true).map;
    const F = endMap(S, n);
    const deformed = R.steps.map((k) => built[k - 1]);
    const ok = FN.sheetMapPieces(S.steps, built, { mode: 3, base: leftStage, a: R.lo, b: R.b, post: R.p1, t: 0.5 });
    const expectOk = deformed.every(FN.sheetHomOk);
    check(`${nm}: drawable as sheets iff every deformed step has a sheet path`, !!ok === expectOk, { ok: !!ok, expectOk });
    if (!ok) continue;
    cases++;
    // ---- t = end: F's surfaces, combo for combo, bit for bit ----
    const mEnd = st(lenT);
    const KF = FN.sheetCombos(S.steps, built, W, F.b, Infinity, F.a), KE = FN.sheetMapCombos(S.steps, built, mEnd, W, Infinity);
    check(`${nm}: count at the end = F's`, KE === KF, { KE, KF, mEnd });
    for (let c = 0; c < Math.min(KF, 12); c++) for (const [zc, z] of PTS) {
      const a = FN.sheetMapEval(S.steps, built, mEnd, zc, z, c, W), b = FN.sheetEval(S.steps, built, F.b, zc, z, c, W, { a: F.a });
      if (!eqb(a, b)) { check(`${nm}: end combo ${c} = F's at ${z.re},${z.im}`, false, [a, b]); break; }
      checks++;
    }
    // ---- t = 0: H_0's surfaces; the deformed pieces are the identity on every sheet ----
    const m0 = st(0);
    const P0 = FN.sheetMapPieces(S.steps, built, m0);
    const K0 = FN.sheetMapCombos(S.steps, built, m0, W, Infinity);
    // the expected value: the steps applied in full (pre, post) on their own digits, through sheetEval in two parts
    const fullRad = [], homRad = [];
    for (const p of P0) (p.how === 1 ? fullRad : homRad).push(p);
    for (let c = 0; c < Math.min(K0, 24); c++) for (const [zc, z] of PTS.slice(0, 30)) {
      const got = FN.sheetMapEval(S.steps, built, m0, zc, z, c, W);
      // decode c over P0 (chain order): the full pieces' digits, in order, make the H_0 combo of pre then post
      let cc = c; const dig = [];
      for (const p of P0) { const r = p.n > 0 ? p.n : 2 * W + 1; dig.push(cc % r); cc = Math.floor(cc / r); }
      const lo = m0.mode === 1 ? m0.hi - 1 : m0.a, b = m0.post > (m0.b || 0) ? m0.b : null;
      let cPre = 0, mul = 1, cPost = 0, mulP = 1;
      P0.forEach((p, i) => { const r = p.n > 0 ? p.n : 2 * W + 1; if (p.how === 1 && p.k <= lo) { cPre += dig[i] * mul; mul *= r; } else if (p.how === 1) { cPost += dig[i] * mulP; mulP *= r; } });
      const base = m0.base || 0;
      let pc = zc, pz = z;
      if (lo > base) { pc = FN.sheetEval(S.steps, built, lo, zc, zc, cPre, W, { a: base }); pz = FN.sheetEval(S.steps, built, lo, zc, z, cPre, W, { a: base }); }
      let want = pz;
      if (b !== null) want = FN.sheetEval(S.steps, built, m0.post, pc, pz, cPost, W, { a: b });
      if (!eqb(got, want)) { check(`${nm}: t = 0 combo ${c} = H_0's sheet at ${z.re},${z.im}`, false, [got, want, m0]); break; }
      checks++;
    }
    // ---- in between: combos run continuously into the end (no jump at t -> end), the count never exceeds F's ----
    for (const T of [0.25 * lenT, 0.5 * lenT, 0.999 * lenT]) {
      const m = st(T), K = FN.sheetMapCombos(S.steps, built, m, W, Infinity);
      check(`${nm}: count at T=${T} <= F's`, K <= KF, { K, KF });
    }
  }
}
check('cases ran', cases >= 60, cases);

// ---- nodes between steps (one after another): at T = 1 the second step starts on copies of the first's sheets ----
{
  const ch = chain([{ type: 'root', params: { n: 2 } }, { type: 'log' }]), S = ch.S, built = ch.built;
  const mA = { mode: 1, hi: 1, t: 1 }, mB = ch.HR.state(S, 1, true).map;
  check('node: T = 1 is step 2 at t = 0', mB.mode === 1 && mB.hi === 2 && mB.t === 0, mB);
  check('node: counts 2 then 10', FN.sheetMapCombos(S.steps, built, mA, W, Infinity) === 2 && FN.sheetMapCombos(S.steps, built, mB, W, Infinity) === 10);
  for (const [zc, z] of PTS.slice(0, 20)) for (let c = 0; c < 10; c++) {
    const a = FN.sheetMapEval(S.steps, built, mA, zc, z, c % 2, W), b = FN.sheetMapEval(S.steps, built, mB, zc, z, c, W);
    if (!eqb(a, b)) { check('node: equal surfaces', false, [a, b]); break; }
    checks++;
  }
}

// ---- the user's case: chain √, sin; √ bracketed (Only f1, inside F) ----
{
  const ch = chain(CHAINS.sinsqrt), S = ch.S, built = ch.built;
  S.homRange = { a: 1, b: 1 };
  const m = (T) => ch.HR.state(S, T, true).map;
  check('user: map at t = 1/2', JSON.stringify(m(0.5)) === JSON.stringify({ mode: 1, hi: 1, t: 0.5, post: 2, b: 1 }), m(0.5));
  for (const T of [0, 0.25, 0.5, 1]) check(`user: two surfaces at t = ${T}`, FN.sheetMapCombos(S.steps, built, m(T), W, Infinity) === 2);
  const z = C(4, 0);
  const at = (T, c) => FN.sheetMapEval(S.steps, built, m(T), z, z, c, W);
  // t = 0: both sin 4; t = 1: sin 2 and sin(-2) = -sin 2; t = 1/2 (z^(3/4)): sin(4^(3/4)) and sin(4^(3/4) e^(3 pi i/2)) = -i sinh(4^(3/4))
  check('user: t = 0 both sin 4', eqb(at(0, 0), CX.sin(z)) && eqb(at(0, 1), CX.sin(z)), [at(0, 0), at(0, 1)]);
  check('user: t = 1 sin 2', near(at(1, 0), C(Math.sin(2), 0), 1e-15), at(1, 0));
  check('user: t = 1 -sin 2', near(at(1, 1), C(-Math.sin(2), 0), 1e-15), at(1, 1));
  const r = Math.pow(4, 0.75);
  check('user: t = 1/2 sheet 0 = sin 4^(3/4)', near(at(0.5, 0), C(Math.sin(r), 0)), at(0.5, 0));
  check('user: t = 1/2 sheet 1 = -i sinh 4^(3/4)', near(at(0.5, 1), C(0, -Math.sinh(r)), 1e-12), at(0.5, 1));
  // the principal sheet at the centre is the plain H_t (cut 180°): combo 0 with zc = z, off the negative axis
  for (const [, w] of PTS) {
    if (Math.abs(w.im) < 1e-6 && w.re < 0) continue;
    for (const T of [0.3, 0.7]) {
      const a = FN.sheetMapEval(S.steps, built, m(T), w, w, 0, W), b = ch.HR.cpuMap(m(T))(w);
      if (!eqb(a, b)) { check('user: sheet 0 at the centre = H_t', false, [w, T, a, b]); break; }
      checks++;
    }
  }
  // Im parts come apart: at t = 1/2 the two sheets differ in Im at almost every point
  let apart = 0;
  for (const [zc, w] of PTS) { const a = FN.sheetMapEval(S.steps, built, m(0.5), zc, w, 0, W), b = FN.sheetMapEval(S.steps, built, m(0.5), zc, w, 1, W); if (Math.abs(a.im - b.im) > 1e-6) apart++; }
  check('user: the two sheets come apart in Im at t = 1/2', apart > 0.9 * PTS.length, apart);
}

// ---- (v16.1 review math-5) F's digits: end = F's last step. Every configuration of every chain: the count is F's at
// every t; at the end each surface is F's, bit for bit; one after another, surface c is continuous through every node
// (the left limit T = j - 1e-9 and the node T = j agree combo for combo: no re-indexing, no surface that vanishes) ----
let endCases = 0;
for (const [cname, steps] of Object.entries(CHAINS)) {
  const ch = chain(steps), S = ch.S, n = ch.n(), built = ch.built;
  for (const cf of configs(ch)) {
    S.focus = cf.focus; S.homAll = cf.all; if (cf.hr) S.homRange = { a: cf.hr.a, b: cf.hr.b }; else delete S.homRange;
    const nm = `end ${cname} ${cf.name}`, R = ch.HR.range(S);
    if (!R.steps.length) continue;
    const leftStage = S.focus === 0 ? 0 : S.focus - 1, F = endMap(S, n), end = F.b;
    if (!FN.sheetMapPieces(S.steps, built, { mode: 3, base: leftStage, a: R.lo, b: R.b, post: R.p1, t: 0.5 })) continue;
    endCases++;
    const all = ch.HR.allAtOnce(S, R), lenT = all ? 1 : R.steps.length, st = (T) => ch.HR.state(S, T, true).map;
    const KF = FN.sheetCombos(S.steps, built, W, F.b, Infinity, F.a), KFc = FN.sheetCombos(S.steps, built, W, F.b, FN.SHEET_MAX, F.a);
    for (const T of [0, 0.3 * lenT, 0.5 * lenT, 0.999 * lenT, lenT]) {
      const m = st(T);
      check(`${nm}: count at T=${T} = F's`, FN.sheetMapCombos(S.steps, built, m, W, Infinity, end) === KF && FN.sheetMapCombos(S.steps, built, m, W, FN.SHEET_MAX, end) === KFc, { T, m });
    }
    const mEnd = st(lenT);
    for (let c = 0; c < Math.min(KFc, 24); c++) for (const [zc, z] of PTS.slice(0, 20)) {
      const a = FN.sheetMapEval(S.steps, built, mEnd, zc, z, c, W, end), b = FN.sheetEval(S.steps, built, F.b, zc, z, c, W, { a: F.a });
      if (!eqb(a, b)) { check(`${nm}: end combo ${c} = F's`, false, [a, b]); break; }
      checks++;
    }
    if (!all) for (let j = 1; j < lenT; j++) {
      const mL = st(j - 1e-9), mN = st(j);
      for (let c = 0; c < Math.min(KFc, 24); c++) for (const [zc, z] of PTS.slice(0, 12)) {
        const a = FN.sheetMapEval(S.steps, built, mL, zc, z, c, W, end), b = FN.sheetMapEval(S.steps, built, mN, zc, z, c, W, end);
        if (!(Number.isFinite(a.re) && Number.isFinite(b.re)) || !near(a, b, 1e-6)) { if (Number.isFinite(b.re) || Number.isFinite(a.re)) { check(`${nm}: node ${j} combo ${c} continuous`, false, [a, b]); break; } }
        checks++;
      }
    }
  }
}
check('end cases ran', endCases >= 60, endCases);
// the review's chain: 4th root, log, sin, cube root; bracket 1-2 one after another. Before the node (T -> 1-) and at
// it (T = 1) the same 24 surfaces of F's 60 (F's first 24), continuous; the end equals F's
{
  const ch = chain([{ type: 'root', params: { n: 4 } }, { type: 'log' }, { type: 'sin' }, { type: 'root', params: { n: 3 } }]), S = ch.S, built = ch.built;
  S.homRange = { a: 1, b: 2 };
  const end = 4, st = (T) => ch.HR.state(S, T, true).map;
  for (const T of [0.5, 0.999999, 1, 1.5, 2]) check(`math-5 chain: 24 surfaces at T=${T}`, FN.sheetMapCombos(S.steps, built, st(T), W, FN.SHEET_MAX, end) === 24 && FN.sheetMapCombos(S.steps, built, st(T), W, Infinity, end) === 60);
  let lost = 0;
  for (let c = 0; c < 24; c++) for (const [zc, z] of PTS.slice(0, 20)) {
    const a = FN.sheetMapEval(S.steps, built, st(0.9999999), zc, z, c, W, end), b = FN.sheetMapEval(S.steps, built, st(1), zc, z, c, W, end);
    if (Number.isFinite(a.re) && Number.isFinite(b.re) && !near(a, b, 1e-5)) lost++;
    checks++;
  }
  check('math-5 chain: no surface changes at the node', lost === 0, lost);
}
// (v16.1 review math-3) sheets numbered from the step's own cut and branch: surface 0 is the step itself (the plain H_t
// while deforming, F at rest) at every point, with the cell centre at the point; a window is centred on F's branch
{
  const pts = PTS.map(([, z]) => z);
  for (const [cname, steps] of Object.entries({ sinsqrt90: CHAINS.sinsqrt90, root3exp: CHAINS.root3exp, logk3: [{ type: 'log', params: { k: 3, cut: 60 } }, { type: 'sin' }], powa23cut: [{ type: 'powa', params: { alpha: '0.6666666666666666', cut: -120, k: 2 } }, { type: 'sin' }], recsqrt: CHAINS.recsqrt })) {
    const ch = chain(steps), S = ch.S, built = ch.built, n = ch.n();
    const Ff = FN.stageFunctions(S.steps, built)[n];
    // (the combo of sheet 0 of every piece: digit 0 of a finite piece, digit W of a window, whose digit d is sheet d - W)
    let c0 = 0, mul = 1;
    for (const e of FN.sheetSteps(S.steps, built)) { const r = e.n > 0 ? e.n : 2 * W + 1; if (!(e.n > 0)) c0 += W * mul; mul *= r; }
    let bad = 0;
    for (const z of pts) { const a = FN.sheetEval(S.steps, built, n, z, z, c0, W), b = Ff(z); if (Number.isFinite(b.re) && !near(a, b, 1e-9)) bad++; checks++; }
    check(`math-3 ${cname}: F's surface 0 is F at rest`, bad === 0, bad);
    S.homRange = { a: 1, b: 1 };
    for (const T of [0.25, 0.5, 0.75]) {
      const m = ch.HR.state(S, T, true).map, H = ch.HR.cpuMap(m);
      let badT = 0;
      for (const z of pts) { const a = FN.sheetMapEval(S.steps, built, m, z, z, c0, W, n), b = H(z); if (Number.isFinite(b.re) && !near(a, b, 1e-9)) badT++; checks++; }
      check(`math-3 ${cname}: surface 0 is the plain H_t at T=${T}`, badT === 0, badT);
    }
  }
}
// (v16.1 review math-7) the drawn count and the caption's count agree: a typed near-fraction is a window
check('math-7: alpha 0.333333333 is a window', FN.stepSheets(FN.build({ type: 'powa', params: Object.assign(FN.defaults('powa'), { alpha: '0.333333333' }) }))[0].n === 0);
check('math-7: alpha 1/3 has 3 sheets', FN.stepSheets(FN.build({ type: 'powa', params: Object.assign(FN.defaults('powa'), { alpha: '0.3333333333333333' }) }))[0].n === 3);
check('math-7: sheetCount = sheetCountOf for q <= 24', [0.5, 0.25, 1.2, 0.1, 2 / 3, 5 / 7, -1.5, 3].every((x) => FN.sheetCount(x) === FN.sheetCountOf(x)) && FN.sheetCount(0.333333333) === 0);

// ---- maps that cannot be drawn as sheets ----
{
  const ch = chain([{ type: 'custom', params: { expr: '\\log z+\\sqrt{z}' } }, { type: 'sin' }]), S = ch.S, built = ch.built;
  check('unsupported: a deformed formula with branch points, not catalog steps', FN.sheetMapPieces(S.steps, built, { mode: 1, hi: 1, t: 0.5, b: 1, post: 2 }) === null);
  check('supported: the same formula in full (post)', !!FN.sheetMapPieces(S.steps, built, { mode: 1, hi: 2, t: 0.5 }));
  check('unsupported: NaN', Number.isNaN(FN.sheetMapEval(S.steps, built, { mode: 1, hi: 1, t: 0.5, b: 1, post: 2 }, C(1, 1), C(1, 1), 0, W).re));
  const dch = chain([{ type: 'root' }, { type: 'deriv' }]);
  check('unsupported: a d/dz among the steps', FN.sheetMapPieces(dch.S.steps, dch.built, { mode: 1, hi: 1, t: 0.5 }) === null || FN.sheetMapPieces(dch.S.steps, dch.built, { mode: 3, a: 0, b: 2, t: 0.5 }) === null);
  check('unsupported: mode 2', FN.sheetMapPieces(S.steps, built, { mode: 2, a: 0, b: 1, t: 0.5 }) === null);
  check('mode 0 = sheetEval', eqb(FN.sheetMapEval(S.steps, built, { mode: 0, a: 0, b: 2 }, C(1, 1), C(1.1, 1), 3, W), FN.sheetEval(S.steps, built, 2, C(1, 1), C(1.1, 1), 3, W, { a: 0 })));
}

console.log(`${checks} checks, ${failed} failed (${cases} cases)`);
process.exit(failed ? 1 : 0);

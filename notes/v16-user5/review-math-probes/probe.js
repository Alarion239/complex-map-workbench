const R = '<project>/work/xvta/src/';
global.CX = require(R + 'cx.js'); global.Expr = require(R + 'parse.js');
try { global.Recognize = require(R + 'recognize.js'); } catch (e) {}
const FN = require(R + 'funcs.js'); const HomRange = require(R + 'homrange.js'); const { C } = CX;
function chain(stepsIn) {
  let uidN = 0;
  const S = { focus: 0, homAll: false, steps: stepsIn.map((s) => ({ type: s.type, params: Object.assign(FN.defaults(s.type), s.params || {}), on: true, uid: 'f' + (++uidN) })) };
  const built = S.steps.map((st) => FN.build(st)), stageFns = FN.stageFunctions(S.steps, built);
  const n = () => S.steps.length;
  const isDeriv = (k) => { const b = built[k - 1]; return !!b && !b.error && (S.steps[k-1].type === 'deriv' || b.op === 'deriv'); };
  const stepFn = (k) => { const b = built[k - 1]; if (!b || b.error || isDeriv(k) || typeof b.f !== 'function') return null; return b.f; };
  const stepActive = (k) => !!stepFn(k) || isDeriv(k);
  const stageF = (k) => stageFns[Math.max(0, Math.min(n(), k))] || ((z) => z);
  const rangeF = (a, b) => { if (!a) return stageF(b); const fs = []; for (let i = a + 1; i <= b; i++) { const f = stepFn(i); if (f) fs.push(f); } return (z) => { for (const f of fs) z = f(z); return z; }; };
  const HR = HomRange.make({ n, stepFn, isDeriv, stepActive, stageF, rangeF, built: () => built, C });
  return { S, HR, built, n };
}
const fmt = (w) => `${w.re.toFixed(6)}${w.im >= 0 ? '+' : ''}${w.im.toFixed(6)}i`;
// 1. the user's case
{
  const ch = chain([{ type: 'root', params: { n: 2 } }, { type: 'sin' }]);
  ch.S.homRange = { a: 1, b: 1 };
  for (const T of [0, 0.5, 1]) {
    const m = ch.HR.state(ch.S, T, true).map;
    const K = FN.sheetMapCombos(ch.S.steps, ch.built, m, 2);
    const z = C(4, 0.001);
    console.log('user T', T, JSON.stringify(m), 'K', K, [0, 1].map((c) => fmt(FN.sheetMapEval(ch.S.steps, ch.built, m, z, z, c, 2))).join(' | '));
  }
}
// 2. cap gap: root 4, log, sin, cbrt ; bracket 1..2, one after another
{
  const ch = chain([{ type: 'root', params: { n: 4 } }, { type: 'log' }, { type: 'sin' }, { type: 'root', params: { n: 3 } }]);
  ch.S.homRange = { a: 1, b: 2 };
  const W = 2;
  const Fp = FN.sheetSteps(ch.S.steps, ch.built);
  console.log('F pieces', JSON.stringify(Fp), 'F combos', FN.sheetCombos(ch.S.steps, ch.built, W, 4, Infinity));
  const z = C(1.3, 0.7);
  // F's drawn surfaces (first 24)
  const Fvals = []; for (let c = 0; c < 24; c++) Fvals.push(FN.sheetEval(ch.S.steps, ch.built, 4, z, z, c, W));
  const near = (u, v) => CX.abs(CX.sub(u, v)) < 1e-9;
  for (const T of [0.999999, 1, 1.5, 2]) {
    const m = ch.HR.state(ch.S, T, true).map;
    const K = FN.sheetMapCombos(ch.S.steps, ch.built, m, W), tot = FN.sheetMapCombos(ch.S.steps, ch.built, m, W, Infinity);
    const vals = []; for (let c = 0; c < K; c++) vals.push(FN.sheetMapEval(ch.S.steps, ch.built, m, z, z, c, W));
    // last-step digit of cbrt per surface
    const ps = FN.sheetMapPieces(ch.S.steps, ch.built, m);
    let rad = 1; for (const p of ps.slice(0, -1)) rad *= p.n > 0 ? p.n : 2 * W + 1;
    const dcb = []; for (let c = 0; c < K; c++) dcb.push(Math.floor(c / rad) % 3);
    console.log('T', T, JSON.stringify(m), 'pieces', ps.map((p) => p.k + ':' + p.n).join(','), 'K', K, 'total', tot, 'cbrt digits drawn', [...new Set(dcb)].join(','));
  }
  // values at the end of the first step (T=1-) vs right after (T=1): which surfaces vanish
  const mA = ch.HR.state(ch.S, 0.9999999, true).map, mB = ch.HR.state(ch.S, 1, true).map;
  const KA = FN.sheetMapCombos(ch.S.steps, ch.built, mA, W), KB = FN.sheetMapCombos(ch.S.steps, ch.built, mB, W);
  const A = [], B = []; for (let c = 0; c < KA; c++) A.push(FN.sheetMapEval(ch.S.steps, ch.built, mA, z, z, c, W)); for (let c = 0; c < KB; c++) B.push(FN.sheetMapEval(ch.S.steps, ch.built, mB, z, z, c, W));
  const lost = A.filter((u) => !B.some((v) => CX.abs(CX.sub(u, v)) < 1e-5));
  console.log('surfaces before node', KA, 'after', KB, 'values before with no surface after:', lost.length, lost.map(fmt).join(' '));
  // surfaces at the end vs F
  const mE = ch.HR.state(ch.S, 2, true).map;
  const E = []; for (let c = 0; c < 24; c++) E.push(FN.sheetMapEval(ch.S.steps, ch.built, mE, z, z, c, W));
  console.log('end == F bitwise', E.every((u, i) => u.re === Fvals[i].re && u.im === Fvals[i].im));
  const notF = A.filter((u) => !Fvals.some((v) => near(u, v)));
  console.log('surfaces at T=1- (step 1 ending, values already equal its end) not among F drawn values:', notF.length);
}
// 3. sheets of z^s that tend to F's sheet: sheet m+2
{
  const z = C(2, 1), th = Math.atan2(z.im, z.re) + Math.PI;
  for (const t of [0.5, 0.9, 0.99]) {
    const s = 1 - t / 2;
    const v = (m) => CX.pow(z, C(s, 0), th, m);
    console.log('t', t, 'sheet0', fmt(v(0)), 'sheet2', fmt(v(2)), 'sheet1', fmt(v(1)), 'sheet3', fmt(v(3)));
  }
}

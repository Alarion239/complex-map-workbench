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
const W = 2;
// A. root n=3 cut 45 branch k=3, then exp; one after another, t=0.5 on step 1: plain H_t vs drawn sheets
for (const [nm, steps] of Object.entries({
  root3k3: [{ type: 'root', params: { n: 3, cut: 45, k: 3 } }, { type: 'exp' }],
  root2k1: [{ type: 'root', params: { n: 2, k: 1 } }, { type: 'sin' }],
  logk1: [{ type: 'log', params: { k: 1 } }, { type: 'sin' }],
  logk3: [{ type: 'log', params: { k: 3 } }, { type: 'sin' }],
})) {
  const ch = chain(steps);
  const st = ch.HR.state(ch.S, 0.5, true);
  const K = FN.sheetMapCombos(ch.S.steps, ch.built, st.map, W);
  const z = C(1.2, 0.9);
  const plain = st.F(z);
  const sh = []; for (let c = 0; c < K; c++) sh.push(FN.sheetMapEval(ch.S.steps, ch.built, st.map, z, z, c, W));
  const hit = sh.findIndex((v) => CX.abs(CX.sub(v, plain)) < 1e-9);
  const stE = ch.HR.state(ch.S, 2, true); const FE = stE.F(z);
  const shE = []; for (let c = 0; c < K; c++) shE.push(FN.sheetMapEval(ch.S.steps, ch.built, stE.map, z, z, c, W));
  console.log(nm, 'K', K, 'plain H_0.5', fmt(plain), 'equals drawn sheet', hit, '| drawn:', sh.map(fmt).join(' '), '| at end F(z) among drawn:', shE.findIndex((v) => CX.abs(CX.sub(v, FE)) < 1e-9));
}
// B. sqrt sqrt chain, one after another: drawn K at step 1 vs F's
{
  const ch = chain([{ type: 'root', params: { n: 2 } }, { type: 'root', params: { n: 2 } }]);
  for (const T of [0.5, 1.5]) { const m = ch.HR.state(ch.S, T, true).map; console.log('sqrt sqrt T', T, 'drawn K', FN.sheetMapCombos(ch.S.steps, ch.built, m, W), 'F K', FN.sheetCombos(ch.S.steps, ch.built, W, 2)); }
  const ch2 = chain([{ type: 'sin' }, { type: 'root', params: { n: 3 } }]);
  for (const T of [0.5, 1.5]) { const m = ch2.HR.state(ch2.S, T, true).map; console.log('sin cbrt T', T, 'drawn K', FN.sheetMapCombos(ch2.S.steps, ch2.built, m, W), 'F K', FN.sheetCombos(ch2.S.steps, ch2.built, W, 2)); }
}
// C. typed alpha 0.333333333
{
  const ch = chain([{ type: 'powa', params: { alpha: '0.333333333' } }]);
  console.log('alpha 0.333333333 stepSheets', JSON.stringify(FN.stepSheets(ch.built[0])), 'sheetCount', FN.sheetCount(C(0.333333333, 0)));
  const ch2 = chain([{ type: 'powa', params: { alpha: '0.3333333333' } }]);
  console.log('alpha 0.3333333333 stepSheets', JSON.stringify(FN.stepSheets(ch2.built[0])));
}

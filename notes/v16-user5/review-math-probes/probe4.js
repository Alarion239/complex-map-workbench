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
const ch = chain([{ type: 'root', params: { n: 2, cut: -90 } }, { type: 'sin' }]);
ch.S.homRange = { a: 1, b: 1 };
for (const T of [0.5, 1]) {
  const st = ch.HR.state(ch.S, T, true);
  let miss = 0, tot = 0, ex = null;
  for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
    const z = C(-3 + 6 * (i + 0.5) / 40, -3 + 6 * (j + 0.5) / 40);
    const p = st.F(z);
    const d = [0, 1].map((c) => FN.sheetMapEval(ch.S.steps, ch.built, st.map, z, z, c, W));
    tot++;
    if (!d.some((v) => CX.abs(CX.sub(v, p)) < 1e-9 * (1 + CX.abs(p)))) { miss++; if (!ex) ex = { z: fmt(z), plain: fmt(p), drawn: d.map(fmt) }; }
  }
  console.log('cut -90, T', T, 'points where the plain H_t (the caption\'s) is on no drawn sheet:', miss, 'of', tot, JSON.stringify(ex));
}

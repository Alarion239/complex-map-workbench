const T = require('./twin.js'); const { FN, C, mk, hOf, muOf, scan } = T;
const bx = { x0: -2.1, x1: 1.9, y0: -2.03, y1: 1.97 };   // a panned view: no symmetry
// 1. z^2 (pown) during the deformation: the path z^(1+t) has a real cut; GPU: chainSheetHom applies P_h = mapF (no sheet piece)
for (const [n, t] of [[2, 0.5], [2, 0.25], [3, 0.5], [-2, 0.2]]) {
  const { S, built } = mk([{ type: 'pown', params: { n } }]);
  const F = built[0].hom(t);
  for (const m of ['im', 're']) { const mu = muOf(F, m, bx), hf = hOf(m, mu); scan(`pown n=${n} t=${t} ${m}`, bx, (z) => hf(F(z)), F, (zc, z) => F(z), [C(0, 0)], 1); }
}
// 2. pre-filter blind spot on the shipped cases
const cases = [['sqrt', [{ type: 'root', params: { n: 2 } }], 'im'], ['log', [{ type: 'log' }], 'im'], ['z^i', [{ type: 'powa', params: { alpha: 'i' } }], 'im'], ['cbrt(z2-1)', [{ type: 'custom', params: { expr: '(z^2-1)^{1/3}', cut: 180 } }], 'im'], ['z^-1/2', [{ type: 'powa', params: { alpha: '-0.5' } }], 'im'], ['log z + 0.3 i z^-1/2... sqrt(z)/z', [{ type: 'custom', params: { expr: '\\frac{\\sqrt{z}}{z}', cut: 180 } }], 'im']];
for (const [id, steps, m] of cases) {
  const { S, built, F } = mk(steps); const mu = muOf(F, m, bx), hf = hOf(m, mu);
  scan(id + ' ' + m, bx, (z) => hf(F(z)), F, (zc, z) => FN.sheetEval(S, built, S.length, zc, z, 0, 0, { a: 0 }), [C(0, 0), C(1, 0), C(-1, 0)], 1);
}
{
  const { S, built } = mk([{ type: 'root', params: { n: 2 } }, { type: 'sin' }]);
  for (const t of [0.2, 0.5, 0.8]) { const map = { mode: 1, base: 0, hi: 1, a: 0, b: 1, post: 2, t }; const ht = built[0].hom(t), F = (z) => CX.sin(ht(z));
    for (const m of ['im', 're']) { const mu = muOf(F, m, bx), hf = hOf(m, mu); scan(`sinsqrt t=${t} ${m}`, bx, (z) => hf(F(z)), F, (zc, z) => FN.sheetMapEval(S, built, map, zc, z, 0, 0), [C(0, 0)], 1); } }
}

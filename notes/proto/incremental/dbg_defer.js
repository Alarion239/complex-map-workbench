const L = require('./layer.js');
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const r = Funcs.build({ type: 'recip', params: {} }).f, e = Funcs.build({ type: 'exp', params: {} }).f;
const F = (z) => e(r(z));
for (const [df, dm] of JSON.parse(process.argv[2] || '[[0.8,2],[0,2],[0,4],[2,0]]')) {
  const res = L.build({ F, shape: { kind: 'disc', c: [0, 0], r: 1 }, srcWin: boxOf({ cx: 0, cy: 0, s: 110 }), view: { cx: 0, cy: 0, s: 40, W, H }, K: 1, maxEval: 4e6, deferFrac: df, deferMax: dm });
  console.log(df, dm, 'evals', res.st.evals, 'popped', res.st.popped, 'satTests', res.st.satTests, 'sat', res.st.saturated, 'deferred', res.st.deferred, 'guard', res.st.guardFail, 'budget', res.st.budget, 'ms', res.ms.toFixed(0), 'tris', res.out.length, 'satPts', res.st.satPolyPts);
}

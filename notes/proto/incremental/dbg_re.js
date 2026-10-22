const L = require('./layer.js');
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const zi = Funcs.build({ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }).f, sq = Funcs.build({ type: 'root', params: { n: 2, cut: 180, k: 0 } }).f;
for (const reemit of [false, true]) {
  const a = L.build({ F: zi, shape: { kind: 'halfplane', a: [0, 0], b: [1, 0] }, srcWin: boxOf({ cx: 0, cy: 1, s: 60 }), view: { cx: 0, cy: 0, s: 1440, W, H }, K: 1, reemit });
  const b = L.build({ F: sq, shape: { kind: 'formula', expr: '|z|>0' }, srcWin: boxOf({ cx: 0, cy: 0, s: 70 }), view: { cx: 1, cy: 0, s: 120, W, H }, K: 1, reemit, injective: true });
  console.log('reemit', reemit, '| zi8x evals', a.st.evals, 'emitted', a.st.emitted, 'reemitted', a.st.reemitted, 'out', a.out.length, 'budget', a.st.budget, '| sqrt evals', b.st.evals, 'emitted', b.st.emitted, 'reemitted', b.st.reemitted, 'out', b.out.length);
}

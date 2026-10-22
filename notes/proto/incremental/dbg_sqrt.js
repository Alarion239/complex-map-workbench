const { build, CX, C } = require('./layer.js');
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const F = Funcs.build({ type: 'root', params: { n: 2, cut: 180, k: 0 } }).f;
const hist = {};
const res = build({ F, shape: { kind: 'formula', expr: '|z|>0' }, srcWin: boxOf({ cx: 0, cy: 0, s: 70 }), view: { cx: 1, cy: 0, s: 30, W, H }, K: 1, hist, injective: true, maxEval: 6e5, sample: +process.argv[2] || 0 });
console.log(res.st);
console.log(Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 12));

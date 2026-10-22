const L = require('./layer.js');
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const F = Funcs.build({ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }).f;
const hist = {}, fracHist = {}, trace = [];
const res = L.build({ F, shape: { kind: 'halfplane', a: [0, 0], b: [1, 0] }, srcWin: boxOf({ cx: 0, cy: 1, s: 60 }), view: { cx: 0, cy: 0, s: 180, W, H }, K: 1, sphere: { R: 250 }, hist, fracHist, trace, maxEval: 1.5e6, jumpDump: true });
console.log(res.st, fracHist);
console.log(Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 12));
const by = {}; for (const t of trace) by[t.why + ' ' + t.ch] = (by[t.why + ' ' + t.ch] || 0) + 1; console.log(by);

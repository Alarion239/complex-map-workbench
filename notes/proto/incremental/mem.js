// CPU memory of one layer build (node --expose-gc), and the cost of preparing the GPU upload (counting sort by key
// into the 144 B/triangle interleaved format)
const L = require('./layer.js');
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const cases = {
  zi: [Funcs.build({ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }).f, { kind: 'halfplane', a: [0, 0], b: [1, 0] }, { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 180 }],
  expH: [Funcs.build({ type: 'exp', params: {} }).f, { kind: 'halfplane', a: [0, 0], b: [1, 0] }, { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 40 }],
};
for (const [name, [F, shape, src, view]] of Object.entries(cases)) {
  global.gc(); const m0 = process.memoryUsage().heapUsed;
  const res = L.build({ F, shape, srcWin: boxOf(src), view: Object.assign({ W, H }, view), K: 3 });
  global.gc(); const m1 = process.memoryUsage().heapUsed;
  const t0 = process.hrtime.bigint();
  const n = res.out.length, buf = new Float32Array(n * 3 * 12);
  const cnt = new Map(); for (const t of res.out) cnt.set(t.key, (cnt.get(t.key) || 0) + 1);
  const keys = [...cnt.keys()].sort((a, b) => b - a); let o = 0; const start = new Map(); for (const k of keys) { start.set(k, o); o += cnt.get(k); }
  for (const t of res.out) { const i = start.get(t.key); start.set(t.key, i + 1); for (let v = 0; v < 3; v++) { const w = t.w[v] || { re: 0, im: 0 }; const b = (i * 3 + v) * 12; buf[b] = w.re - view.cx; buf[b + 1] = w.im - view.cy; } }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(name, 'popped', res.st.popped, 'emitted', n, 'retained heap MB', ((m1 - m0) / 1e6).toFixed(1), 'bytes/popped node', Math.round((m1 - m0) / res.st.popped), 'upload prep ms', ms.toFixed(1), 'buffer MB', (buf.byteLength / 1e6).toFixed(1));
  global.keep = res;
}

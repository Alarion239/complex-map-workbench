// where are the holes of one scene/view?
const { build, CX, C } = require('./layer.js');
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const step = (type, params = {}) => Funcs.build({ type, params });
const Hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const view = { cx: 1, cy: 0, s: 190 * 64, W, H };
const F = step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }).f;
const res = build({ F, shape: Hp, srcWin: boxOf({ cx: 0, cy: 1, s: 60 }), view, K: 1 });
const s = view.s, px = (w) => [(w.re - view.cx) * s + W / 2, H / 2 - (w.im - view.cy) * s];
const cover = new Uint16Array(W * H);
function raster(p0, p1, p2) {
  const minx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0]))), maxx = Math.min(W - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
  const miny = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1]))), maxy = Math.min(H - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));
  const ar = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]); if (!(Math.abs(ar) > 0)) return; const sg = ar > 0 ? 1 : -1;
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) { const xc = x + .5, yc = y + .5;
    const e0 = sg * ((p1[0] - p0[0]) * (yc - p0[1]) - (p1[1] - p0[1]) * (xc - p0[0])), e1 = sg * ((p2[0] - p1[0]) * (yc - p1[1]) - (p2[1] - p1[1]) * (xc - p1[0])), e2 = sg * ((p0[0] - p2[0]) * (yc - p2[1]) - (p0[1] - p2[1]) * (xc - p2[0]));
    if (e0 >= 0 && e1 >= 0 && e2 >= 0) cover[y * W + x]++; }
}
for (const t of res.out.concat(res.coreTris)) raster(...t.w.map(px));
const b = boxOf(view); const holes = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const w = C(b.x0 + (x + .5) / s, b.y1 - (y + .5) / s); const sd = (1 - Math.hypot(w.re, w.im)) * s; if (sd > 2 && !cover[y * W + x]) holes.push([x, y, +sd.toFixed(1), +(Math.hypot(w.re - 1, w.im) * s).toFixed(1)]); }
console.log(res.st, 'holes', holes.length, JSON.stringify(holes.slice(0, 40)));
// which discarded triangles cover the holes?
const trace = [];
build({ F, shape: Hp, srcWin: boxOf({ cx: 0, cy: 1, s: 60 }), view, K: 1, trace });
const inTri = (p, a, b, c) => { const d = (u, v, w) => (v[0] - u[0]) * (w[1] - u[1]) - (w[0] - u[0]) * (v[1] - u[1]); const s1 = d(a, b, p), s2 = d(b, c, p), s3 = d(c, a, p); return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0); };
for (const h of holes.slice(0, 3)) {
  const p = [h[0] + .5, h[1] + .5];
  const hits = trace.filter((t) => t.v.every((v) => v.w) && inTri(p, ...t.v.map((v) => px(v.w))));
  console.log('hole', h, 'covered by discarded:', hits.map((t) => t.why + ' key ' + t.key + ' ch ' + t.ch + ' ' + t.v.map((v) => px(v.w).map((x) => x.toFixed(0)).join(',')).join(' | ')));
}
const by = {}; for (const t of trace) by[t.why] = (by[t.why] || 0) + 1; console.log(by);

// Topological watertightness check: edges of all drawn triangles (layer + certified core lattice), keyed by source
// points (rounded to 1e-12 relative, so the core lattice's a + (b - a) i/4 and the layer's nested midpoints match).
// An interior edge appears twice. An open edge (once) is legitimate on the region boundary, at culled / saturated /
// capped frontiers or the view; a T-JUNCTION is an open edge (a, b) whose other side is split: open edges (a, m), (m, b)
// with m strictly between a and b on the same source line.
const L = require('./layer.js');
const C = L.C, CX = L.CX;
const W = 410, H = 516;
const boxOf = (v) => ({ x0: v.cx - W / 2 / v.s, x1: v.cx + W / 2 / v.s, y0: v.cy - H / 2 / v.s, y1: v.cy + H / 2 / v.s });
const st = (type, params = {}) => Funcs.build({ type, params }).f;
const Hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const cases = [
  ['zi_H', st('powa', { alpha: 'i', cut: 180, k: 0 }), Hp, { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 180 }],
  ['log_H out16', st('log', { cut: 180, k: 0 }), Hp, { cx: 0, cy: 1, s: 60 }, { cx: -0.18, cy: Math.PI / 2, s: 97 / 16 }],
  ['exp_H', st('exp'), Hp, { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 40 }],
  ['einv', (z) => st('exp')(st('recip')(z)), { kind: 'disc', c: [0, 0], r: 1 }, { cx: 0, cy: 0, s: 110 }, { cx: 0, cy: 0, s: 40 }],
  ['cayley 64x', st('mobius', { a: '1', b: '-i', c: '1', d: 'i' }), Hp, { cx: 0, cy: 1, s: 60 }, { cx: 1, cy: 0, s: 190 * 64 }],
  ['sqrt out4', st('root', { n: 2, cut: 180, k: 0 }), { kind: 'formula', expr: '|z|>0' }, { cx: 0, cy: 0, s: 70 }, { cx: 1, cy: 0, s: 30 }],
];
const kf = (x) => { if (x === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(x))); return (Math.round(x / Math.pow(10, e - 11)) * Math.pow(10, e - 11)).toPrecision(12); };
const key = (z) => kf(z.re) + ',' + kf(z.im);
for (const [name, F, shape, src, view] of cases) {
  const res = L.build({ F, shape, srcWin: boxOf(src), view: Object.assign({ W, H }, view), K: 1, injective: name.startsWith('log') || name.startsWith('cayley') || name.startsWith('sqrt') });
  const tris = res.out.filter((t) => !t.cap && t.z.every(Boolean)).map((t) => ({ z: t.z, ch: t.ch })).concat(res.coreTris.map((t) => ({ z: t.z, ch: 0 })));
  const E = new Map(), P = new Map();
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const a = t.z[k], b = t.z[(k + 1) % 3], ka = key(a), kb = key(b);
    if (ka === kb) continue;
    P.set(ka, a); P.set(kb, b);
    const ek = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    E.set(ek, (E.get(ek) || 0) + 1);
  }
  const open = [...E].filter(([, n]) => n === 1).map(([k]) => k.split('|'));
  const nb = new Map();
  for (const [a, b] of open) { (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
  let tj = 0;
  const ex = [];
  for (const [a, b] of open) {
    const za = P.get(a), zb = P.get(b);
    for (const m of nb.get(a) || []) {
      if (m === b) continue;
      const zm = P.get(m);
      // m strictly between a and b, (m, b) open as well
      const d = CX.sub(zb, za), q = CX.sub(zm, za), L2 = d.re * d.re + d.im * d.im;
      const t = (q.re * d.re + q.im * d.im) / L2, cr = Math.abs(q.re * d.im - q.im * d.re) / Math.sqrt(L2);
      if (t > 1e-9 && t < 1 - 1e-9 && cr < 1e-9 * Math.sqrt(L2) && (nb.get(m) || []).includes(b)) { tj++; if (ex.length < 3) ex.push([za, zm, zb]); }
    }
  }
  console.log(name.padEnd(12), 'triangles', tris.length, 'edges', E.size, 'open edges', open.length, 'T-junctions', tj, ex.length ? JSON.stringify(ex[0]) : '');
}

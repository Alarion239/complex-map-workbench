global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Region = require('../src/region.js');
const C = CX.C;
const win = { x0: -3, x1: 3, y0: -3, y1: 3 };
const shapes = [
  { kind: 'disc', c: [0, 0], r: 1 },
  { kind: 'formula', expr: '|\\Im z| < \\pi/2' },
  { kind: 'formula', expr: '1<|z|<2, \\Re z > 0' },
  { kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 },
  { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 },
  { kind: 'polygon', pts: [[0, 0], [1, 0], [0, 1]] },
  { kind: 'rect', a: [-1, -1], b: [1, 1] },
  { kind: 'disc', c: [0, 0], r: 1, complement: true },
];
for (const s of shapes) {
  const t0 = Date.now();
  const m = Region.buildMesh(s, win, 140);
  const t1 = Date.now();
  // area estimate
  let area = 0;
  for (let t = 0; t < m.tri.length / 3; t++) {
    const a = m.tri[3 * t], b = m.tri[3 * t + 1], c = m.tri[3 * t + 2];
    area += Math.abs((m.src[2 * b] - m.src[2 * a]) * (m.src[2 * c + 1] - m.src[2 * a + 1]) - (m.src[2 * c] - m.src[2 * a]) * (m.src[2 * b + 1] - m.src[2 * a + 1])) / 2;
  }
  const mm = Region.mapMesh(m, (z) => CX.log(z));
  const t2 = Date.now();
  console.log(s.kind, s.expr || '', 'verts', m.src.length / 2, 'tris', m.tri.length / 3, 'area', area.toFixed(4), 'contours', m.contours.map((c) => c.pts.length + (c.closed ? 'c' : 'o')).join(' '), 'kept after log', mm.tri.length / 3, `mesh ${t1 - t0}ms map ${t2 - t1}ms`);
}
console.log('expected areas: pi=', Math.PI.toFixed(4), 'strip 6*pi=', (6 * Math.PI).toFixed(4), 'half annulus', (1.5 * Math.PI).toFixed(4), 'annulus', (Math.PI * (4 - 0.25)).toFixed(4));
// curve mapping
const view = { cx: 0, cy: 0, s: 100, w: 600, h: 600 };
const circ = Region.curvesOf({ kind: 'circle', c: [0, 0], r: 1 }, win)[0];
let t0 = Date.now();
let pl = Region.mapCurve(circ, (z) => CX.log(z), view);
console.log('log of unit circle: polylines', pl.length, pl.map((p) => p.length / 2), (Date.now() - t0) + 'ms');
pl = Region.mapCurve(circ, (z) => CX.inv(CX.sub(z, C(1, 0))), view);
console.log('1/(z-1) of unit circle: polylines', pl.length, pl.map((p) => p.length / 2));
pl = Region.mapCurve(circ, (z) => CX.mul(z, z), view);
console.log('z^2 of unit circle', pl.length, pl.map((p) => p.length / 2));
const arc = Region.arc3(C(1, 0), C(0, 1), C(-1, 0));
console.log('arc3 mid', CX.fmt(arc.f(0.5)), 'end', CX.fmt(arc.f(1)));
const arc2 = Region.arc3(C(1, 0), C(0, -1), C(-1, 0));
console.log('arc3 lower mid', CX.fmt(arc2.f(0.5)), 'end', CX.fmt(arc2.f(1)));

// The Homework orientation chevrons (figure.js senseAt, chevronAt): every boundary piece is marked so that its set
// stays on the left (notes/export-design/DESIGN.md), in the source panel and, as F is conformal, in the image panel;
// the mark keeps clear of the axes, their crossing and their tick labels. Run: node test/t_figure_chevron.js
// (The export window of unbounded sets, the same at every pane size, is checked in the browser: xrfix2_cdp/win.js.)
const vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js');
global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js');
global.Region = require(R + '/src/region.js');
global.window = global;
vm.runInThisContext(require('./src_text').source('figure.js', R + '/src', { esm: 'strip' }) + '\n;globalThis.Figure = Figure;', { filename: 'figure.js' });
const { senseAt, chevronAt } = Figure.geom;
const C = CX.C;
let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); } };
const win = { x0: -6, x1: 6, y0: -6, y1: 6 };
const id = (z) => z;
// the direction of travel (sense applied) at s, as a unit vector
const travel = (c, sense, s, F = id) => { const a = F(c.f(s)), b = F(c.f(Math.min(1, Math.max(0, s + sense * 1e-5)))); const dx = b.re - a.re, dy = b.im - a.im, l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
// the set is on the left of the travel: a point a little to the left is inside (level > 0)
const leftInside = (s0, c, sense, s) => { const z = c.f(s), [tx, ty] = travel(c, sense, s), L = Region.levelOf(s0); return L(C(z.re - 1e-3 * ty, z.im + 1e-3 * tx)) > 0 && L(C(z.re + 1e-3 * ty, z.im - 1e-3 * tx)) < 0; };
const SS = [0.05, 0.2, 0.37, 0.5, 0.63, 0.81, 0.95];

// 1. annulus 0.5 <= |z| <= 2: the inner circle runs clockwise, the outer counterclockwise
{
  const sh = { kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, [inner, outer] = Region.curvesOf(sh, win), L = Region.levelOf(sh);
  for (const s of SS) {
    ok(senseAt(inner, L, s, win) === -1, 'annulus inner circle is clockwise', s);
    ok(senseAt(outer, L, s, win) === 1, 'annulus outer circle is counterclockwise', s);
    ok(leftInside(sh, inner, senseAt(inner, L, s, win), s), 'annulus inner: the set on the left', s);
    ok(leftInside(sh, outer, senseAt(outer, L, s, win), s), 'annulus outer: the set on the left', s);
  }
  // under log the inner circle's image (Re w = log 0.5) runs down, the outer one's (Re w = log 2) up
  const s = 0.3, d1 = travel(inner, senseAt(inner, L, s, win), s, CX.log), d2 = travel(outer, senseAt(outer, L, s, win), s, CX.log);
  ok(d1[1] < -0.99, 'log annulus: the left edge runs down', d1);
  ok(d2[1] > 0.99, 'log annulus: the right edge runs up', d2);
}
// 2. the complement of a disc (Joukowski): its circle runs clockwise; a disc runs counterclockwise
{
  const co = { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, c1 = Region.curvesOf(co, win)[0], L1 = Region.levelOf(co);
  const di = { kind: 'disc', c: [0, 0], r: 2 }, c2 = Region.curvesOf(di, win)[0], L2 = Region.levelOf(di);
  for (const s of SS) {
    ok(senseAt(c1, L1, s, win) === -1, 'complement of a disc: clockwise', s);
    ok(leftInside(co, c1, senseAt(c1, L1, s, win), s), 'complement: the set on the left', s);
    ok(senseAt(c2, L2, s, win) === 1, 'disc: counterclockwise', s);
  }
}
// 3. half-plane Im z >= 0 drawn both ways round: travel to the right along the real axis
for (const [a, b] of [[[0, 0], [1, 0]], [[1, 0], [0, 0]]]) {
  const sh = { kind: 'halfplane', a, b }, c = Region.curvesOf(sh, win)[0], L = Region.levelOf(sh);
  // (with a, b swapped the half-plane is Im z <= 0: still on the left)
  const st = senseAt(c, L, 0.5, win), d = travel(c, st, 0.5);
  ok(leftInside(sh, c, st, 0.5), 'half-plane: the set on the left', { a, b });
  ok(Math.abs(Math.abs(d[0]) - 1) < 1e-9, 'half-plane: travel along the real axis', d);
}
// 4. quarter plane 0 <= arg z <= 90 deg: out along the real ray, in along the imaginary ray
{
  const sh = { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, [r1, r2] = Region.curvesOf(sh, win), L = Region.levelOf(sh);
  const s1 = chevronAt(r1, id, null, { box: { x0: -0.5, x1: 2.5, y0: -0.5, y1: 2.5 }, st: [0.5, 0.5] }, null, win);
  const s2 = chevronAt(r2, id, null, { box: { x0: -0.5, x1: 2.5, y0: -0.5, y1: 2.5 }, st: [0.5, 0.5] }, null, win);
  ok(s1 != null && s2 != null, 'quarter plane: both rays get a chevron (long rays sampled in the window)', [s1, s2]);
  if (s1 != null && s2 != null) {
    const d1 = travel(r1, senseAt(r1, L, s1, win), s1), d2 = travel(r2, senseAt(r2, L, s2, win), s2);
    ok(d1[0] > 0.99, 'quarter plane: out along the positive real axis', d1);
    ok(d2[1] < -0.99, 'quarter plane: in along the positive imaginary axis', d2);
    const z1 = r1.f(s1), z2 = r2.f(s2);
    ok(Math.hypot(z1.re, z1.im) > 0.4 && Math.hypot(z2.re, z2.im) > 0.4, 'quarter plane: chevrons away from the vertex', [z1, z2]);
    // between two ticks (a step of 0.5: not on a multiple of 0.5)
    const q = (v) => Math.abs(v / 0.5 - Math.round(v / 0.5));
    ok(q(z1.re) > 0.2 && q(z2.im) > 0.2, 'quarter plane: chevrons between ticks', [z1.re, z2.im]);
    // under z^2 the second ray's image (the negative real axis) runs toward 0: the upper half-plane on its left
    const d3 = travel(r2, senseAt(r2, L, s2, win), s2, (z) => CX.mul(z, z));
    ok(d3[0] > 0.99, 'quarter plane under z^2: the image of the imaginary ray runs right', d3);
  }
}
// 5. Cayley half-plane: the chevron is off the origin in z and off both axes in w
{
  const sh = { kind: 'halfplane', a: [0, 0], b: [1, 0] }, c = Region.curvesOf(sh, win)[0];
  const cay = (z) => CX.div(CX.sub(z, C(0, 1)), CX.add(z, C(0, 1)));
  const pL = { box: { x0: -4, x1: 4, y0: -1, y1: 5 }, st: [1, 1] }, pR = { box: { x0: -1.5, x1: 1.5, y0: -1.5, y1: 1.5 }, st: [0.5, 0.5] };
  const s = chevronAt(c, id, cay, pL, pR, win);
  ok(s != null, 'Cayley: a chevron is placed');
  if (s != null) {
    const z = c.f(s), w = cay(z);
    ok(Math.abs(z.re) > 0.8, 'Cayley: z away from the axes crossing', z);
    ok(Math.abs(w.re) > 0.25 && Math.abs(w.im) > 0.25, 'Cayley: w away from both axes', w);
  }
}
console.log(`t_figure_chevron: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);

// P4 review fixes (SPEC 9.1): node checks of Region.Lines (run: node test/t_lines.js)
// - dash arcs anchored near the view (float32 resolves the dash period on reach-extended polylines)
// - runs stop once the image wraps (z^i) and long curves end where their image is no longer resolved (exp)
// - log keeps its reach (both ends far out), Mobius-affine tails still reach far
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Region = require('../src/region.js');
const { C } = CX;
const L = Region.Lines;
let fails = 0;
const ok = (cond, msg, extra) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); if (!cond) fails++; };
const win = { x0: -4, x1: 4, y0: -4, y1: 4 };
const ctr = [0, 0], R = Math.hypot(8, 8) / 2;
const segs = (ps) => ps.reduce((n, p) => n + Math.max(0, p.length / 2 - 1), 0);
const today = (s) => Region.curvesOf(s, win).map((c) => Region.sampleCurve(c, win)).filter((p) => p.length >= 4);
const refined = (s, F, sing) => L.refine(Region.curvesOf(s, win, { reach: 'sphere' }), [F], sing, { win, origin: ctr, maxInsert: 8192, maxEval: 2048 });
const f32 = (x) => Math.fround(x);
// the float32 step of the arc value at the segment nearest the view centre must resolve a dash period (8.5 px; at
// 100 px per unit that is 0.085 units): require a step under 1e-4
function arcStepNearView(ps, F) {
  const a = L.arcs(ps, F, ctr, R);
  let o = 0, best = Infinity, val = 0;
  for (const p of ps) for (let i = 0; i + 1 < p.length / 2; i++, o += 2) {
    const d = Math.hypot((p[2 * i] + p[2 * i + 2]) / 2, (p[2 * i + 1] + p[2 * i + 3]) / 2);
    if (d < best) { best = d; val = a[o]; }
  }
  return { val, step: Math.abs(val) > 0 ? Math.abs(f32(val) - f32(f32(val) * (1 + 2 ** -23))) || 0 : 0 };
}
// 1. open half-plane under 2z + 1: the boundary's tails reach far, the dash arc near the view stays small
{
  const H = { kind: 'halfplane', a: [0, 0], b: [1, 0], complement: true };
  const F = (z) => C(2 * z.re + 1, 2 * z.im);
  const ps = refined(H, F, []);
  let maxX = 0;
  for (const p of ps) for (let i = 0; i < p.length; i += 2) maxX = Math.max(maxX, Math.abs(p[i]));
  ok(maxX > 1e15, 'affine: refined tails reach far', maxX);
  const r = arcStepNearView(ps, F), id = arcStepNearView(ps, (z) => z);
  ok(Math.abs(r.val) < 10 && r.step < 1e-4, 'affine: right-plane dash arc near the view is resolved', r);
  ok(Math.abs(id.val) < 10 && id.step < 1e-4, 'affine: left-plane dash arc near the view is resolved', id);
  // the dash phase near the view is the same for today's samples and the refined ones
  const a0 = L.arcs(today(H), F, ctr, R), a1 = L.arcs(ps, F, ctr, R);
  const at = (ps2, a, x) => { let o = 0; for (const p of ps2) for (let i = 0; i + 1 < p.length / 2; i++, o += 2) if (p[2 * i] <= x && p[2 * i + 2] > x || p[2 * i] >= x && p[2 * i + 2] < x) return a[o] + a[o + 1] * (x - p[2 * i]) / (p[2 * i + 2] - p[2 * i]); return NaN; };
  const d = Math.max(...[-3, -1, 0.5, 2.7].map((x) => Math.abs(at(today(H), a0, x) - at(ps, a1, x))));
  ok(d < 1e-4, 'affine: same dash phase for today\'s and the refined samples', d);
}
// 2. exp of the vertical line Re z = -0.5: no more segments than today, no chords across the image disc
{
  const s = { kind: 'line', a: [-0.5, 0], b: [-0.5, 1] };
  const F = (z) => CX.exp(z);
  const t = today(s), ps = refined(s, F, []);
  // the renderer draws each segment as M = 8 linear pieces of its image: count the pieces whose chord cuts into the disc
  const inside = (pp) => {
    let n = 0;
    for (const p of pp) for (let i = 0; i + 1 < p.length / 2; i++) {
      const W = [];
      for (let k = 0; k <= 8; k++) W.push(F(C(p[2 * i] + (p[2 * i + 2] - p[2 * i]) * k / 8, p[2 * i + 1] + (p[2 * i + 3] - p[2 * i + 1]) * k / 8)));
      for (let k = 0; k < 8; k++) if (Math.hypot((W[k].re + W[k + 1].re) / 2, (W[k].im + W[k + 1].im) / 2) < 0.57) n++;
    }
    return n;
  };
  ok(segs(ps) <= segs(t), 'exp vertical line: refined segments <= today', { refined: segs(ps), today: segs(t) });
  ok(inside(ps) < inside(t) / 4, 'exp vertical line: chord midpoints inside |w| < 0.57 cut', { refined: inside(ps), today: inside(t) });
  // the left plane keeps its line well past the view (the cut is outside expandBox(win, 4))
  let maxY = 0;
  for (const p of ps) for (let i = 1; i < p.length; i += 2) maxY = Math.max(maxY, Math.abs(p[i]));
  ok(maxY >= 16, 'exp vertical line: line kept beyond 4 window half-sizes', maxY);
}
// 3. z^i of the real axis: split at 0, each run toward 0 and each tail stops after the image wrapped
{
  const s = { kind: 'line', a: [0, 0], b: [1, 0] };
  const F = (z) => (z.re === 0 && z.im === 0 ? C(NaN, NaN) : CX.exp(CX.mul(C(0, 1), CX.log(z))));
  const t = today(s), ps = refined(s, F, [{ z: C(0, 0) }]);
  ok(ps.length === 2, 'z^i: line split at 0', ps.length);
  ok(segs(ps) <= segs(t) + 300, 'z^i: refined segments bounded', { refined: segs(ps), today: segs(t) });
  // both circles still drawn whole near 0: the inserted runs turn at least once
  let minX = Infinity;
  for (const p of ps) for (let i = 0; i < p.length; i += 2) if (p[i] !== 0) minX = Math.min(minX, Math.abs(p[i]));
  ok(minX < Math.exp(-2 * Math.PI) * 8 / 700, 'z^i: runs toward 0 cover a full turn', minX);
}
// 4. log of the real axis: reach kept toward 0 and toward infinity (strokes reach both edges of a zoomed-out view)
{
  const s = { kind: 'line', a: [0, 0], b: [1, 0] };
  const F = (z) => CX.log(z);
  const ps = refined(s, F, [{ z: C(0, 0) }]);
  let minX = Infinity, maxX = 0;
  for (const p of ps) for (let i = 0; i < p.length; i += 2) { const x = Math.abs(p[i]); if (x > 0) minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  ok(minX < 1e-25 && maxX > 1e25, 'log: reach kept at both ends', { minX, maxX });
}
// 5. 1 / (z - 100) on the real axis: the pole far out is crossed (a single unresolved segment is not a cut)
{
  const s = { kind: 'line', a: [0, 0.001], b: [1, 0.001] };
  const F = (z) => CX.div(C(1, 0), C(z.re - 100, z.im));
  const ps = refined(s, F, []);
  let maxX = -Infinity;
  for (const p of ps) for (let i = 0; i < p.length; i += 2) maxX = Math.max(maxX, p[i]);
  ok(maxX > 1000, 'Mobius: the line continues past a pole far out', maxX);
}
// 6. a bounded polyline keeps today's dash origin (its first sample): golden dashes of closed boundaries do not move
{
  const s = { kind: 'circle', c: [0.5, 0], r: 1 };
  const ps = today(s), a = L.arcs(ps, (z) => z, ctr, R);
  ok(a[0] === 0, 'circle: dash arc starts at its first sample', a[0]);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

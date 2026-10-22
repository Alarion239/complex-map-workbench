// The app's curve-formula shape kind (Region.KINDS.fcurve, notes/curves-design.md 4.0), run: node test/t_fcurve.js
// - Region.curveDesc caches Curves.fromFormula by source; traceWin holds the window it is asked for
// - the sticky trace window: pans and zooms inside it reuse the trace and the curve objects; leaving it re-traces
// - every traced sample lies on the curve (Re z^2 = 1: |x^2 - y^2 - 1| tiny), samples are fine (spacing)
// - hit tests on traced samples, sphereCurvesOf ends 'inf' tails at the north pole, exact pieces stay exact
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Curves = require('../src/curves.js');
const { C } = CX;
let fails = 0, passes = 0;
const ok = (cond, msg, extra) => { if (cond) passes++; else fails++; console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };
const inWin = (a, b) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;

// traceWin
for (const w of [{ x0: -3.6, x1: 3.6, y0: -4.7, y1: 4.7 }, { x0: 10.01, x1: 10.02, y0: -0.003, y1: 0.004 }, { x0: -1e6, x1: 3e6, y0: 5, y1: 7 }]) {
  const t = Region.traceWin(w), m = Math.max(w.x1 - w.x0, w.y1 - w.y0);
  ok(inWin(w, t) && t.x1 - t.x0 <= 2.25 * m + 1e-12 * m, 'traceWin holds the window and is at most 2.25x its size', [w, t]);
}
const s = { kind: 'fcurve', expr: 'Re z^2 = 1' };
const d = Region.curveDesc(s);
ok(Region.curveDesc({ kind: 'fcurve', expr: 'Re z^2 = 1' }) === d, 'curveDesc is cached by source');
ok(Region.KINDS.fcurve.type === 'curve' && Region.KINDS.fcurve.tex(s) === Expr.toTex(Expr.parse('Re z^2 = 1', { allowRel: true })).s, 'kind fcurve: a curve, TeX of its equation');
const W = { x0: -3.6, x1: 3.6, y0: -4.7, y1: 4.7 };
const cs = Region.curvesOf(s, W);
ok(cs.length === 2 && cs.every((c) => c.traced && !c.closed && c.ends && c.ends[0] === 'inf' && c.ends[1] === 'inf'), 'the hyperbola: two traced branches, both ends at infinity', cs.map((c) => c.ends));
let worst = 0, maxGap = 0;
const tw = d._tw, diag = Math.hypot(tw.x1 - tw.x0, tw.y1 - tw.y0);
for (const c of cs) for (let i = 0; i < c.pts.length; i++) {
  const z = c.pts[i];
  worst = Math.max(worst, Math.abs(z.re * z.re - z.im * z.im - 1) / Math.max(1, z.re * z.re + z.im * z.im));
  if (i && Math.abs(z.re) < 4 && Math.abs(z.im) < 5) maxGap = Math.max(maxGap, Math.hypot(z.re - c.pts[i - 1].re, z.im - c.pts[i - 1].im));
}
ok(worst < 1e-12, 'every traced sample is on the curve (relative residual)', worst);
ok(maxGap <= diag / 1600 * 1.05, 'samples near the window are at most the trace window diagonal / 1600 apart', [maxGap, diag / 1600]);
// sticky window: a pan inside it and a zoom in by 2.5x reuse the same objects; a zoom in by 4x or a far pan re-traces
ok(Region.curvesOf(s, { x0: -3.2, x1: 4.0, y0: -4.7, y1: 4.7 }) === cs, 'a pan inside the trace window reuses the curves');
ok(Region.curvesOf(s, { x0: -2.7, x1: 2.7, y0: -3.5, y1: 3.5 }) === cs, 'a zoom-in to 0.4 of the trace window reuses the curves');
const cz = Region.curvesOf(s, { x0: -0.9, x1: 0.9, y0: -1.1, y1: 1.1 });
ok(cz !== cs, 'a zoom-in past a third of the trace window re-traces');
const cf = Region.curvesOf(s, { x0: 96.4, x1: 103.6, y0: -4.7, y1: 4.7 });
ok(cf !== cs, 'a far pan re-traces');
const cr = Region.curvesOf(s, W, { reach: 'sphere' });
ok(cr.length === 2 && cr.every((c) => c.outer && c.cell > 0), "reach 'sphere' gives the traced ends their outer box (Lines.refine continues them as rays)", cr.map((c) => !!c.outer));
// hit tests
ok(Region.hitTest(s, C(Math.sqrt(1.36), 0.6), 0.01, W) && !Region.hitTest(s, C(0, 0), 0.01, W), 'hit test: on the branch yes, at 0 no');
// globe: lifted samples, ends at N
const sc = Region.sphereCurvesOf(s, 160, W);
ok(sc.length === 2 && sc.every((c) => c.pts[0].join() === '0,0,1' && c.pts[c.pts.length - 1].join() === '0,0,1'), 'sphereCurvesOf: both branches start and end at the north pole');
// a closed traced curve, an exact piece in a mixed formula, a refused formula
const ov = Region.curvesOf({ kind: 'fcurve', expr: '|z^2-1| = 2' }, W);
ok(ov.length === 1 && ov[0].closed && ov[0].pts[0] === ov[0].pts[ov[0].pts.length - 1], 'the Cassini oval is one closed loop');
const mx = Region.curvesOf({ kind: 'fcurve', expr: '|z| = 1 or Re z^2 = 1' }, W);
ok(mx.some((c) => !c.traced && c.closed && !c.pts) && mx.filter((c) => c.traced).length === 2, 'a mixed formula: its circle exact (Region circle), its hyperbola traced', mx.map((c) => [!!c.traced, c.closed]));
let err = null;
try { Region.curvesOf({ kind: 'fcurve', expr: 'z = 1' }, W); } catch (e) { err = e; }
ok(err && /real/.test(err.message), 'a refused equation throws its classification message', err && err.message);
ok(Region.fcurveTrace(s, W).polys.length === 2, 'fcurveTrace: the trace the curves come from');
console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);

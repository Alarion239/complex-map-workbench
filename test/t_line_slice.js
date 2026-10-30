// The line refinement is resumable (issue #325): Lines.refineGen with a pacer that is always due (it yields at every
// chance) gives the same polylines as Lines.refine, bit for bit, for lines, rays, segments, discs, half-planes,
// polygons, arcs, annuli and strips under 1/z, exp, tan, z^2 and z^i, with the chain's singular points given and
// scanned for (jumpScan); a long curve yields many times, and the yields fall between a few evaluations of the map.
// Run: node test/t_line_slice.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Region = require('../src/region.js');

let n = 0, bad = 0;
const check = (name, ok, got) => { n++; if (!ok) { bad++; console.log('FAIL', name, JSON.stringify(got)); } };
const C = (re, im) => ({ re, im });
const MAPS = {
  inv: (z) => { const d = z.re * z.re + z.im * z.im; return C(z.re / d, -z.im / d); },
  exp: (z) => CX.exp(z),
  tan: (z) => CX.div(CX.sin(z), CX.cos(z)),
  sq: (z) => C(z.re * z.re - z.im * z.im, 2 * z.re * z.im),
  zi: (z) => CX.exp(CX.mul(C(0, 1), CX.log(z))),
};
const win = { x0: -2, x1: 2, y0: -1.5, y1: 1.5 };
const SHAPES = [
  { kind: 'line', a: [-1, 0], b: [1, 0] }, { kind: 'line', a: [0, -1], b: [0, 1] }, { kind: 'line', a: [0.3, -1], b: [0.3, 1] },
  { kind: 'ray', a: [0, 0], b: [1, 1] }, { kind: 'segment', a: [-1, -0.5], b: [1, 0.5] },
  { kind: 'disc', c: [0.3, 0], r: 0.3 }, { kind: 'disc', c: [0, 0], r: 1 }, { kind: 'halfplane', a: [0, -1], b: [1, -1] },
  { kind: 'polygon', pts: [[-1, -1], [1, -1], [0, 1]] }, { kind: 'arc', a: [1, 0], m: [0, 1], b: [-1, 0] },
  { kind: 'annulus', c: [0, 0], r1: 0.5, r2: 1.2 }, { kind: 'strip', a: [0, -0.5], b: [1, -0.5], w: 1 },
];
const bits = (ps) => ps.map((p) => Buffer.from(new Float64Array(p).buffer).toString('base64')).join('|');
const caps = (pc) => Object.assign({ win, origin: [0, 0], maxInsert: 8192, maxEval: 2048 }, pc ? { pc } : {});
let cases = 0, same = 0, maxGap = 0, longYields = Infinity;
for (const [mn, F0] of Object.entries(MAPS)) {
  for (const sh of SHAPES) {
    for (const sing of [null, [{ z: C(0, 0), kind: 'pole' }]]) {
      let cs = [];
      try { cs = Region.curvesOf(Object.assign({ id: 'x', visible: true }, sh), win, { reach: 'sphere' }); } catch (e) { continue; }
      for (const c of cs) {
        // (the evaluations between two yields: the pacer counts them)
        let ev = 0, since = 0, yields = 0;
        const F = (z) => { ev++; since++; return F0(z); };
        const a = Region.Lines.refine([c], [F0], sing, caps());
        const g = Region.Lines.refineGen([c], [F], sing, caps({ due: () => true }));
        let r;
        for (;;) { since = 0; r = g.next(); maxGap = Math.max(maxGap, since); if (r.done) break; yields++; }
        cases++;
        if (bits(a) === bits(r.value)) same++; else console.log('differs:', mn, sh.kind, sing ? 'sing' : 'scan');
        if (c.long && ev > 1000) longYields = Math.min(longYields, yields / ev);
      }
    }
  }
}
check('the curves, maps and both kinds of singular points make over 100 cases', cases > 100, cases);
check('refineGen paced at every chance gives Lines.refine\'s polylines bit for bit, in every case', same === cases, [same, cases]);
check('between two yields at most a few evaluations of the map (≤ 8)', maxGap <= 8, maxGap);
check('a long curve yields at least once per 4 evaluations', longYields >= 0.25, longYields);
// the sync forms are the generators drained: jumpScan as before, sampleCurve unchanged without a pacer
{
  const c = Region.curvesOf({ id: 'x', kind: 'line', a: [-1, 0], b: [1, 0], visible: true }, win, { reach: 'sphere' })[0];
  const pts = Region.sampleCurve(c, win);
  check('sampleCurve (no tail) still samples the line', pts.length > 100, pts.length);
  const js = Region.Lines.jumpScan(pts, MAPS.inv, 2048);
  check('jumpScan finds 1/z\'s pole on the real axis', js.length >= 1 && js.every((p) => Math.hypot(p.z.re, p.z.im) < 1e-6), js);
}
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);

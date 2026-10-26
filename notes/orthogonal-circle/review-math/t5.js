const K = require('./load.js');
const rec = (st) => K.recompute(st, { all: true }, {});
const by = (st, id) => st.shapes.find((x) => x.id === id);
function scene(C) {
  return { shapes: [C, { id: 'p', kind: 'point', p: [0.3, 0.2] }, { id: 'q', kind: 'point', p: [1.7, -0.6] },
    { id: 'k', kind: 'circle', c: [0,0], r: 1, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'none' } },
    { id: 'm0', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
    { id: 'm1', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 1 } },
    { id: 'g', kind: 'point', p: [0,0], t: 0.37, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } }], targets: [], steps: [] };
}
// a sweep: f(st, s) moves something; report jumps of m0, m1, g (in the sphere's chordal metric, so passing through INF is fine)
const chord = (a, b) => { const S = (z) => { if (!z) return null; const r2 = z[0]*z[0]+z[1]*z[1]; return [2*z[0]/(1+r2), 2*z[1]/(1+r2), (r2-1)/(r2+1)]; }; const A = S(a), B = S(b); return Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2]); };
const pos = (s) => s.cundef ? null : (s._atInf ? [1e300, 0] : s.p);
function sweep(lab, C, mover, N = 4000) {
  const st = scene(C); rec(st);
  let prev = null, worst = { m: 0, g: 0 }, undef = 0, swaps = 0, cosw = 0;
  for (let i = 0; i <= N; i++) {
    mover(st, i / N); rec(st);
    const k = by(st, 'k');
    const cur = { m0: pos(by(st, 'm0')), m1: pos(by(st, 'm1')), g: pos(by(st, 'g')) };
    if (!cur.m0 || !cur.m1 || k.cundef) { undef++; prev = null; continue; }
    if (prev && prev.m0) {
      const j0 = chord(prev.m0, cur.m0), j1 = chord(prev.m1, cur.m1), jx = chord(prev.m0, cur.m1) + chord(prev.m1, cur.m0);
      worst.m = Math.max(worst.m, j0, j1); if (jx < j0 + j1 - 1e-9 && j0 + j1 > 1e-3) swaps++;
      worst.g = Math.max(worst.g, chord(prev.g, cur.g));
    }
    prev = cur;
  }
  console.log(lab.padEnd(44), 'undef', undef, 'worst meet step', worst.m.toExponential(2), 'swaps', swaps, 'worst glider step', worst.g.toExponential(2));
}
const circ = { id: 'c', kind: 'circle', c: [0, 0], r: 1 };
sweep('P across C (circle), radial', JSON.parse(JSON.stringify(circ)), (st, s) => { by(st, 'p').p = [0.2 + 1.6 * s, 0.1 + 0.3 * s]; });
sweep('C centre across PQ', JSON.parse(JSON.stringify(circ)), (st, s) => { by(st, 'c').c = [1 - 2 * s, -1 + 1.5 * s]; });
sweep('C radius 0.05 -> 3', JSON.parse(JSON.stringify(circ)), (st, s) => { by(st, 'c').r = 0.05 + 3 * s; });
sweep('Q around P full turn (line case twice)', JSON.parse(JSON.stringify(circ)), (st, s) => { by(st, 'q').p = [0.3 + 1.5 * Math.cos(6.283 * s), 0.2 + 1.5 * Math.sin(6.283 * s)]; });
sweep('C line, Q around P', { id: 'c', kind: 'line', a: [-1, -0.5], b: [2, 0.4] }, (st, s) => { by(st, 'q').p = [0.3 + 1.5 * Math.cos(6.283 * s), 0.2 + 1.5 * Math.sin(6.283 * s)]; });
sweep('C line rotating about a', { id: 'c', kind: 'line', a: [-1, -0.5], b: [2, 0.4] }, (st, s) => { by(st, 'c').b = [-1 + 3 * Math.cos(6.283 * s), -0.5 + 3 * Math.sin(6.283 * s)]; });
sweep('C arc (3pt) flattening through line', { id: 'c', kind: 'arc', a: [-2, -1], m: [0, 0.5], b: [2, -1] }, (st, s) => { by(st, 'c').m = [0, 0.5 - 3 * s]; });
// circle3 C passing through its line case
function c3scene() { const st = scene({ id: 'c0', kind: 'point', p: [9, 9] }); st.shapes.splice(0, 1, { id: 'u', kind: 'point', p: [-2, -1] }, { id: 'v', kind: 'point', p: [0, 0.5] }, { id: 'w', kind: 'point', p: [2, -1] }, { id: 'c', kind: 'circle', c: [0,0], r: 1, def: { op: 'circle3', args: [{ s: 'u' }, { s: 'v' }, { s: 'w' }], fill: 'none' } }); return st; }
{
  const st = c3scene(); rec(st);
  let prev = null, worst = 0, wg = 0, und = 0;
  for (let i = 0; i <= 4000; i++) { by(st, 'v').p = [0.01, 0.5 - 3 * i / 4000]; rec(st); const cur = { m0: pos(by(st,'m0')), m1: pos(by(st,'m1')), g: pos(by(st,'g')) }; if (!cur.m0 || !cur.m1) { und++; prev = null; continue; } if (prev) { worst = Math.max(worst, chord(prev.m0, cur.m0), chord(prev.m1, cur.m1)); wg = Math.max(wg, chord(prev.g, cur.g)); } prev = cur; }
  console.log('circle3 C through its line case'.padEnd(44), 'undef', und, 'worst meet step', worst.toExponential(2), 'worst glider step', wg.toExponential(2));
}

const K = require('./load.js');
const rec = (st) => K.recompute(st, { all: true }, {});
const by = (st, id) => st.shapes.find((x) => x.id === id);
// C: the line through 0 and 1+2i (tilted). P, Q on decimal grid points on a perpendicular (direction 2 - i).
let stats = { line: 0, circ: 0, leftOK: 0, leftBad: 0, rmin: Infinity };
const out = [];
for (let i = -5; i <= 5; i++) for (let j = 1; j <= 4; j++) {
  const P = [+(0.1 * i).toFixed(1), +(0.1 * j + 0.2).toFixed(1)];
  for (const kk of [1, 2, 3]) {
    const Q = [+(P[0] + 0.2 * kk).toFixed(1), +(P[1] - 0.1 * kk).toFixed(1)];
    const st = { shapes: [ { id: 'c', kind: 'line', a: [0, 0], b: [1, 2] }, { id: 'p', kind: 'point', p: P }, { id: 'q', kind: 'point', p: Q },
      { id: 'k', kind: 'circle', c: [0,0], r: 1, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'in' } },
      { id: 'm0', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
      { id: 'm1', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 1 } } ], targets: [], steps: [] };
    rec(st);
    const k = by(st, 'k');
    if (k._g.A === 0) stats.line++; else { stats.circ++; stats.rmin = Math.min(stats.rmin, 1 / Math.abs(k._g.A)); }
    // the side that is inside, tested at the point P + left normal of P->Q (small offset): left of P->Q is the exact-line rule
    const d = [Q[0] - P[0], Q[1] - P[1]], L = Math.hypot(...d), w = [P[0] - d[1] / L * 0.05 + d[0] * 0.5, P[1] + d[0] / L * 0.05 + d[1] * 0.5];
    const leftIn = K.fOf(k._g, w) < 0;
    if (leftIn) stats.leftOK++; else stats.leftBad++;
    if (out.length < 4 && k._g.A !== 0) out.push({ P, Q, kind: k.kind, complement: k.complement, A: k._g.A, r: k.r, m0: by(st, 'm0').p, m1: by(st,'m1').p, m1inf: !!by(st,'m1')._atInf });
  }
}
console.log(stats); console.log(out);

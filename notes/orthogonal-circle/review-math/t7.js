const K = require('./load.js');
const rec = (st) => K.recompute(st, { all: true }, {});
// a chain: touch on perp on circle3; tangents; meets; gliders; Use complement on some
const st = { shapes: [
  { id: 'u', kind: 'point', p: [-2, -1] }, { id: 'v', kind: 'point', p: [0.1, 0.7] }, { id: 'w', kind: 'point', p: [2, -1.3] },
  { id: 'c', kind: 'circle', c: [0,0], r: 1, def: { op: 'circle3', args: [{ s: 'u' }, { s: 'v' }, { s: 'w' }], fill: 'in', flip: true } },
  { id: 'p', kind: 'point', p: [0.3, 0.2] }, { id: 'q', kind: 'point', p: [1.7, -0.6] },
  { id: 'k', kind: 'circle', c: [0,0], r: 1, def: { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'in' } },
  { id: 'g', kind: 'point', p: [0,0], t: 0.123456789, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } },
  { id: 'x', kind: 'point', p: [3.3, 2.1] },
  { id: 'h', kind: 'circle', c: [0,0], r: 1, def: { op: 'touch', args: [{ s: 'k', part: 0 }, { s: 'g' }, { s: 'x' }], fill: 'in' } },
  { id: 'tg', kind: 'line', a: [0,0], b: [1,0], def: { op: 'tangent', args: [{ s: 'h', part: 0 }, { s: 'x' }], index: 1, fill: 'none' } },
  { id: 'tp', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'tg', part: 0 }, { s: 'h', part: 0 }], index: 0 } },
  { id: 'm', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'h', part: 0 }, { s: 'k', part: 0 }], index: 1 } },
  { id: 'n', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
], targets: [], steps: [] };
rec(st);
const dump = (st) => JSON.stringify(st.shapes.map((s) => [s.id, s.kind, s.p, s.c, s.r, s.a, s.b, s.complement, s._g && [s._g.A, s._g.B, s._g.C, s._g.o], s.cundef]));
const before = dump(st);
const saved = JSON.parse(JSON.stringify(st, (k, v) => (k.startsWith('_') ? undefined : v)));
K.validate(saved, {}); rec(saved);
console.log('reload bitwise:', dump(saved) === before);
// recompute a second time (idempotence)
rec(saved); console.log('recompute idempotent:', dump(saved) === before);
console.log(st.shapes.filter((s) => s.cundef).map((s) => s.id + ':' + s.cundef.code));

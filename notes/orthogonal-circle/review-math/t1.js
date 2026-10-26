const K = require('./load.js');
const rec = (st) => K.recompute(st, { all: true }, {});
const by = (st, id) => st.shapes.find((x) => x.id === id);
// 1. perp built on a touching circle; Use complement on the touching circle
{
  const st = { shapes: [
    { id: 'c', kind: 'circle', c: [0, 0], r: 1 },
    { id: 't', kind: 'point', p: [0,0], t: 0.1, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } },
    { id: 'p', kind: 'point', p: [2, 0.5] },
    { id: 'k', kind: 'circle', c: [0,0], r: 1, def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't' }, { s: 'p' }], fill: 'none' } },
    { id: 'a', kind: 'point', p: [1.5, -0.3] }, { id: 'b', kind: 'point', p: [0.4, 1.7] },
    { id: 'q', kind: 'circle', c: [0,0], r: 1, def: { op: 'perp', args: [{ s: 'k', part: 0 }, { s: 'a' }, { s: 'b' }], fill: 'in' } },
    { id: 'g', kind: 'point', p: [0,0], t: 0.3, def: { op: 'glider', args: [{ s: 'q', part: 0 }] } },
    { id: 'u', kind: 'circle', c: [0,0], r: 1, def: { op: 'touch', args: [{ s: 'k', part: 0 }, { s: 'p' }, { s: 'a' }], fill: 'in' } },
  ], targets: [], steps: [] };
  rec(st);
  const snap = () => ({ q: JSON.stringify(by(st,'q')._g && [by(st,'q')._g.A, by(st,'q')._g.B]), qk: by(st,'q').kind, qc: by(st,'q').complement, g: by(st,'g').p.slice(), u: by(st,'u')._g && [by(st,'u')._g.A], uc: by(st,'u').complement, uk: by(st, 'u').kind });
  const s0 = snap();
  by(st, 'k').def.flip = !by(st, 'k').def.flip;   // Use complement on the touching circle K
  rec(st);
  const s1 = snap();
  console.log('perp on touch C, before:', s0);
  console.log('after Use complement on C:', s1);
}

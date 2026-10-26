const K = require('./load.js');
const K162 = require('<project>/notes/v16.2-candidate/src/constr.js');
const by = (st, id) => st.shapes.find((x) => x.id === id);
function run(KK, op) {
  const st = { shapes: [
    { id: 'c', kind: 'circle', c: [0, 0], r: 1 }, { id: 'line', kind: 'line', a: [-2, 0.3], b: [2, 0.5] },
    { id: 'p', kind: 'point', p: [0.3, 0.2] }, { id: 'q', kind: 'point', p: [1.7, -0.6] }, { id: 'x', kind: 'point', p: [-0.4, 1.9] },
    { id: 'k', kind: 'circle', c: [0,0], r: 1, def: op === 'perp' ? { op: 'perp', args: [{ s: 'c', part: 0 }, { s: 'p' }, { s: 'q' }], fill: 'in' } : { op: 'circle3', args: [{ s: 'p' }, { s: 'q' }, { s: 'x' }], fill: 'in' } },
    { id: 'm0', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
    { id: 'n0', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'line', part: 0 }], index: 0 } },
  ], targets: [], steps: [] };
  KK.recompute(st, { all: true }, {});
  const b = [by(st, 'm0').p.slice(), by(st, 'n0').p.slice()];
  by(st, 'k').def.flip = !by(st, 'k').def.flip; KK.recompute(st, { all: true }, {});
  const a = [by(st, 'm0').p.slice(), by(st, 'n0').p.slice()];
  console.log(op, KK === K ? 'v16.3' : 'v16.2', 'K∩C idx0', b[0].map((v) => v.toFixed(4)), '->', a[0].map((v) => v.toFixed(4)), '| K∩line idx0', b[1].map((v) => v.toFixed(4)), '->', a[1].map((v) => v.toFixed(4)));
}
run(K, 'perp'); run(K, 'circle3'); run(K162, 'circle3');

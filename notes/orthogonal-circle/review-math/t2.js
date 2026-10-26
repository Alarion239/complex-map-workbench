const K = require('./load.js');
const rec = (st) => K.recompute(st, { all: true }, {});
const by = (st, id) => st.shapes.find((x) => x.id === id);
// rect's handle a as T on side 0 (bottom). Then move b below a: a is now on the top side.
const st = { shapes: [
  { id: 'r', kind: 'rect', a: [0, 0], b: [2, 1] },
  { id: 'p', kind: 'point', p: [1, 2] },
  { id: 'k', kind: 'circle', c: [0,0], r: 1, def: { op: 'touch', args: [{ s: 'r', part: 0 }, { s: 'r', h: 'a' }, { s: 'p' }], fill: 'none' } },
  { id: 'm', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'r', part: 0 }], index: 0 } },
], targets: [], steps: [] };
console.log('onCurveByRefs(a, side0) =', K.onCurveByRefs(st, { s: 'r', h: 'a' }, { s: 'r', part: 0 }));
rec(st);
const show = (lab) => { const k = by(st, 'k'), m = by(st, 'm'); const side = K.pieces(by(st, 'r'))[0]; console.log(lab, 'K', k.kind, k.c, k.r, k.cundef || '', '| meet', m.p, m.cundef || '', '| side0', side.a, side.b, '| f_side(meet)=', K.fOf(side.G, m.p)); };
show('before');
by(st, 'r').b = [2, -1]; rec(st);
show('after b -> 2-i');
console.log('onCurveByRefs(a, side0) now =', K.onCurveByRefs(st, { s: 'r', h: 'a' }, { s: 'r', part: 0 }));
// what Intersect would see (pieces)
console.log('Constr.meets on pieces:', JSON.stringify(K.meets(K.pieces(by(st,'k'))[0], K.pieces(by(st,'r'))[0])));

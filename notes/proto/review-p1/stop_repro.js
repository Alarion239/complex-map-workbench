'use strict';
// Early stop (SPEC 3.6, AFF prefix rule "stop dir when D(z_m) > D_K") is not exact: concrete pixels where the
// default walk's front entry differs from the full enumeration, with NO truncated window.
const L = require('./lib.js');
const T = require('./truth.js');
const { Inverse, C, fmt } = L;
function show(name, list, shape, win, w, pix) {
  const ch = L.chain(list);
  const prep = Inverse.prepare(ch.plan, { win, shape });
  const r = Inverse.enumerate(ch.plan, prep, w, pix, { K: 1, paths: true });
  const full = Inverse.enumerate(ch.plan, prep, w, pix, { K: 1, full: 40 });
  // my own truth: all preimages in the shape, my D
  const Lv = Region.levelOf(shape);
  const tr = T.preimages(ch, w, 45).filter((z) => Lv(z) > 0).map((z) => ({ z, D: L.myD(z, prep.win, prep.sing) })).sort((a, b) => (L.myFront(a, b) ? -1 : 1));
  const e0 = r.entries[0], f0 = full.entries[0];
  console.log(`${name}  [${ch.plan.ops.map((o) => o.kind).join('>')}] stopOp=${prep.stopOp} N=${prep.N.join('x')} P={${prep.sing.map(fmt).join(', ')}}`);
  console.log(`  w = ${fmt(w)}: walk front z = ${fmt(e0.z)} (D ${e0.D.toFixed(4)}, path ${e0.lf.path}), truncated=${r.truncated}, visited ${r.visited}`);
  console.log(`  full-mode front z = ${fmt(f0.z)} (D ${f0.D.toFixed(4)});  independent truth front z = ${fmt(tr[0].z)} (D ${tr[0].D.toFixed(4)})`);
}
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
// (a) P terms make D multi-modal along the member line: sin then z^(0.5+0.5i), P = {0, +-pi, -2pi}
show('(a) sin∘z^{0.5+0.5i} on H', [{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5+0.5i' } }], H,
  { x0: -13.441024143992228, x1: 8.60042248608354, y0: -11.866015724846067, y1: 15.87395125349319 }, C(0.86944444, 0.056666667), 1 / 60);
// (b) a rotated AFF prefix and a non-square left view: ms is not at the minimum of D, and D_K comes from the other base
show('(b) sinh((0.96+0.28i)z) on H', [{ type: 'affine', params: { a: '0.96+0.28i', b: '0' } }, { type: 'sinh' }], H,
  { x0: 1.1302840752749583, x1: 15.295811717947167, y0: -12.217919052556617, y1: 5.609915736757675 }, C(-1.4083333, -0.23), 1 / 20);
show('(c) sinh((0.8+0.6i)z+0.3) on H', [{ type: 'affine', params: { a: '0.8+0.6i', b: '0.3' } }, { type: 'sinh' }], H,
  { x0: -2.07391279256092, x1: 3.5120622998293216, y0: -2.325692679345213, y1: 4.704461339370311 }, C(0.12916667, -6.035), 1 / 40);

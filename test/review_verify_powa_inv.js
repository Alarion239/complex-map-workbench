global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
function mk(type, params) {
  const p = Object.assign(Funcs.defaults(type), params);
  const b = Funcs.build({ type, params: p });
  if (b.error) throw new Error(b.error);
  return b;
}
function check(label, params, pts) {
  const b = mk('powa', params);
  const ib = mk(b.inverse.type, b.inverse.params);
  console.log(`\n${label}: params=${JSON.stringify(params)} injective-lamp=${b.props.injective} inverse=${JSON.stringify(b.inverse)}`);
  for (const w of pts) {
    const fi = b.f(ib.f(w));
    const iff = ib.f(b.f(w));
    console.log(`  w=${CX.fmt(w)}  f(inv(w))=${CX.fmt(fi)}  inv(f(w))=${CX.fmt(iff)}`);
  }
}
const P = [C(0.3, 0.4), C(-1, 0.2), C(1000, 0), C(0.001, 0), C(0.3, 0.7)];
check('baseline α=1.5 default', { alpha: '1.5' }, P);
check('α=1.5 k=1', { alpha: '1.5', k: 1 }, P);
check('α=1.5 cut=90', { alpha: '1.5', cut: 90 }, P);
check('α=0.4 k=1 (injective)', { alpha: '0.4', k: 1 }, [C(-1, 0.2), C(-1,-0.2), C(0.3,0.4)]);
check('α=0.5+0.5i (injective)', { alpha: '0.5+0.5i' }, P);
check('α=i k=-3', { alpha: 'i', k: -3 }, P);
// other inverses for comparison
for (const [t, pr] of [['pown', { n: 3 }], ['root', { n: 3, cut: 90, k: 2 }], ['exp', {}], ['log', { cut: 45, k: 2 }]]) {
  const b = mk(t, pr), ib = mk(b.inverse.type, b.inverse.params);
  let maxR = 0, maxL = 0;
  for (const w of P) { maxR = Math.max(maxR, CX.abs(CX.sub(b.f(ib.f(w)), w)) / CX.abs(w)); maxL = Math.max(maxL, CX.abs(CX.sub(ib.f(b.f(w)), w)) / CX.abs(w)); }
  console.log(`compare ${t} ${JSON.stringify(pr)} -> ${JSON.stringify(b.inverse)}: max rel err f(inv)=${maxR.toExponential(2)} inv(f)=${maxL.toExponential(2)} inj=${b.props.injective}`);
}

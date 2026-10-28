global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
const B = (type, params) => Funcs.build({ type, params: Object.assign(Funcs.defaults(type), params) });
const cases = [
  ['mul', { c: '100000' }], ['mul', { c: '0.000001' }], ['mul', { c: '3' }], ['mul', { c: '7' }],
  ['add', { c: '200000' }], ['add', { c: '100000' }], ['add', { c: '99999' }],
  ['mobius', { a: '1', b: '0.00001', c: '0', d: '1' }],
  ['affine', { a: '20000', b: '1' }], ['affine', { a: '0.00005', b: '0' }],
  ['mul', { c: '50000i' }], ['powa', { alpha: '100000' }],
];
for (const [t, p] of cases) {
  const b = B(t, p);
  if (b.error) { console.log(t, p, 'ERR', b.error); continue; }
  const ip = b.inverse.params;
  const ib = Funcs.build({ type: b.inverse.type, params: Object.assign(Funcs.defaults(b.inverse.type), ip) });
  const parsed = {};
  for (const k of Object.keys(ip)) if (typeof ip[k] === 'string') { try { parsed[k] = CX.fmt(Expr.constValue(ip[k]), 8); } catch (e) { parsed[k] = 'ERR ' + e.message; } }
  const w = C(0.3, 0.4);
  const rt = ib.error ? ib.error : b.f(ib.f(w));
  console.log(t.padEnd(7), JSON.stringify(p).padEnd(40), 'inv params', JSON.stringify(ip).padEnd(48), 'parsed as', JSON.stringify(parsed), '| f(inv(.3+.4i)) =', ib.error ? rt : CX.fmt(rt, 6));
}
console.log('Expr.constValue("1.0000e-5") =', CX.fmt(Expr.constValue('1.0000e-5'), 8), ' 1.0000*e - 5 =', 1 * Math.E - 5);
console.log('Expr.constValue("1e5") =', CX.fmt(Expr.constValue('1e5'), 8));
// tex formatting
for (const [t, p] of [['add', { c: '-100000' }], ['mul', { c: '0.00001' }]]) {
  const b = B(t, p); const s = b.tex({ s: 'z', p: 4 }).s;
  let back; try { back = Expr.compile ? 'n/a' : ''; } catch (e) {}
  console.log(t, p, 'tex:', s);
}

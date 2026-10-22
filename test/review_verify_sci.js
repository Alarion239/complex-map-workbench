global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
for (const s of ['1e-12','1e12','2.5e3','1.0000e-5','1.0000e6+2i','1E5']) {
  try { console.log(s, '->', CX.fmt(Expr.constValue(s), 6)); } catch (e) { console.log(s, 'ERR', e.message); }
}
console.log('fmt 1e-5:', CX.fmt(C(1e-5,0),6), 'fmt 1e6+2i:', CX.fmt(C(1e6,2),6), 'fmt 2e-5', CX.fmt(C(-2e-5,0),6));
global.Funcs = Funcs;
const b = Funcs.build({ type: 'mul', params: { c: '100000' } });
console.log('inverse params', JSON.stringify(b.inverse));
const bi = Funcs.build(b.inverse);
const z = C(0.3, 0.7);
console.log('f^-1(f(z)) =', CX.fmt(bi.f(b.f(z)), 6));
const t = Funcs.build({ type: 'add', params: { c: '0.00002' } });
console.log('add inverse', JSON.stringify(t.inverse), CX.fmt(Funcs.build(t.inverse).vals.c, 6));

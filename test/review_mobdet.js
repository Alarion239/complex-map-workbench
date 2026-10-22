global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
function show(label, params, extra) {
  const b = Funcs.build({ type: 'mobius', params: Object.assign(Funcs.defaults('mobius'), params) });
  if (b.error) { console.log(label, 'ERR', b.error); return; }
  const P = b.props;
  const vals = [C(0.3,0.7), C(-1.2,0.4), C(2,-1), C(0,0)].map(z => CX.fmt(b.f(z), 17));
  console.log(label, JSON.stringify(Object.fromEntries(Object.entries(P).filter(([k,v])=>v||k==='deg'))), 'hom:', !!b.hom, 'inv:', !!b.inverse);
  console.log('   f samples', vals.join(' | '));
  const comp = Funcs.composeProps([P].concat(extra||[]));
  if (extra) console.log('   composed with extra', JSON.stringify(Object.fromEntries(Object.entries(comp).filter(([k,v])=>v||k==='deg'))));
}
const a = Expr.constValue('10\\sqrt{2}');
console.log('a=', a, 'det=', CX.sub(CX.mul(a,a), C(200,0)));
show('const 10sqrt2', { a: '10\\sqrt{2}', b: '10', c: '20', d: '10\\sqrt{2}' });
show('identity 1e-8', { a: '0.00000001', b: '0', c: '0', d: '0.00000001' });
const sq = Funcs.build({ type: 'pown', params: Funcs.defaults('pown') });
show('identity 1e-8 + next', { a: '0.00000001', b: '0', c: '0', d: '0.00000001' }, sq.error ? [] : [sq.props]);
show('1/z scaled 1e-8', { a: '0', b: '0.00000001', c: '0.00000001', d: '0' });
show('const sqrt2 rel', { a: '\\sqrt{2}', b: '1', c: '2', d: '\\sqrt{2}' });
show('const sqrt3', { a: '\\sqrt{3}', b: '1', c: '3', d: '\\sqrt{3}' });
show('const 10sqrt3', { a: '10\\sqrt{3}', b: '10', c: '30', d: '10\\sqrt{3}' });

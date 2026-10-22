global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
for (const s of ['1e-12', '1e12', '2.5e3', '1E5', '1e-8']) { try { console.log(JSON.stringify(s), '->', CX.fmt(Expr.constValue(s), 8)); } catch (e) { console.log(s, 'ERR', e.message); } }
// invert round trips
for (const [type, params] of [['mul', {c:'100000'}], ['mul', {c:'0.00001'}], ['affine', {a:'200000', b:'1'}], ['mobius', {a:'1', b:'0', c:'0', d:'100000'}], ['add', {c:'0.00002'}], ['pown', {n:-3}]]) {
  const b = Funcs.build({type, params: Object.assign(Funcs.defaults(type), params)});
  const inv = b.inverse;
  const bi = Funcs.build({type: inv.type, params: Object.assign(Funcs.defaults(inv.type), inv.params)});
  const z = C(0.3, 0.7);
  const back = bi.error ? 'ERR ' + bi.error : CX.fmt(bi.f(b.f(z)), 8);
  console.log(type, JSON.stringify(params), '-> inverse', JSON.stringify(inv), ' f^-1(f(0.3+0.7i)) =', back);
}
for (const e of ['z^{1000}', 'z^{500}', 'z^{250}', 'z^{201}', 'z^{202}', '(z^{4096})^{4096}', 'z^{1000}+z']) {
  const b = Funcs.build({type:'custom', params:{expr:e, cut:180}});
  console.log(e, 'polynomial', b.props.polynomial, 'proper', b.props.proper, 'deg', b.props.deg, 'exact', b.props.degExact, 'constant', b.props.constant);
}
for (const [p,q] of [['1,-1','1,-3,3,-1'], ['1,-1','1,-4,6,-4,1'], ['1,0','1,0,0,0'], ['1,2','1,6,12,8'], ['1,-1','1,-5,10,-10,5,-1']]) {
  const b = Funcs.build({type:'rational', params:{p,q}});
  console.log('rational', p, '/', q, 'deg', b.props.deg, 'exact', b.props.degExact, 'proper', b.props.proper);
}

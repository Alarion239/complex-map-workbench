global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
const show = (label, st) => {
  const b = Funcs.build(st);
  if (b.error) { console.log(label, 'ERROR', b.error); return b; }
  const P = b.props;
  console.log(label, '| on:', Object.keys(P).filter(k => P[k] === true).join(','), '| deg', P.deg, '| f(0.3+0.7i)=', CX.fmt(b.f(C(0.3,0.7)),8), 'f(2)=', CX.fmt(b.f(C(2,0)),8), '| tex', b.tex({s:'z',p:4}).s, '| hom', !!b.hom, '| inverse', JSON.stringify(b.inverse));
};
show('mobius a=d=0.00000001', {type:'mobius', params:{a:'0.00000001', b:'0', c:'0', d:'0.00000001'}});
show('mobius a=0.0000001,b=0,c=0.0000001,d=0.0000002', {type:'mobius', params:{a:'0.0000001', b:'0', c:'0.0000001', d:'0.0000002'}});
show('mobius a=10^{-8} b=1 c=1 d=10^{-8}', {type:'mobius', params:{a:'10^{-8}', b:'1', c:'1', d:'10^{-8}'}});
show('blaschke a=0.9999999', {type:'blaschke', params:{a:'0.9999999', phi:0}});
show('affine a=10^{-15}', {type:'affine', params:{a:'10^{-15}', b:'0'}});
show('mul c=10^{-300}', {type:'mul', params:{c:'10^{-300}'}});
show('mul c=10^{-400}', {type:'mul', params:{c:'10^{-400}'}});
show('pown n=-4096', {type:'pown', params:{n:-4096}});
show('root n=1000 k=999', {type:'root', params:{n:1000, cut:180, k:999}});

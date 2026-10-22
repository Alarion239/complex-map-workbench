global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
for (const p of [{a:'1',b:'0',c:'0',d:'0'},{a:'0',b:'0',c:'0',d:'0'},{a:'1',b:'1',c:'0',d:'0'}]) {
  const b = Funcs.build({ type: 'mobius', params: Object.assign(Funcs.defaults('mobius'), p) });
  if (b.error) { console.log(JSON.stringify(p), 'ERROR', b.error); continue; }
  const P = b.props;
  console.log(JSON.stringify(p), 'props:', Funcs.PROP_KEYS.filter(k=>P[k]).join(','), 'deg', P.deg, 'const', P.constant, 'domain', b.domain, 'poles', JSON.stringify(b.poles));
  console.log('  tex:', b.tex({s:'z',p:4}).s);
  for (const z of [C(0,0), C(0.3,0.7), C(-1,0), C(2,-1)]) console.log('  f(', CX.fmt(z), ') =', JSON.stringify(b.f(z)));
  const comp = Funcs.composeProps([P]);
  console.log('  composed:', JSON.stringify(comp));
}

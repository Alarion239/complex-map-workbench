global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
function run(params) {
  const p = Object.assign(Funcs.defaults('mobius'), params);
  const b = Funcs.build({ type: 'mobius', params: p });
  if (b.error) { console.log('ERR', b.error); return; }
  const words = Funcs.PROP_KEYS.filter((k) => b.props[k]).join(',');
  console.log(JSON.stringify(params), '->', words, 'deg', b.props.deg, 'const', b.props.constant, 'inverse', !!b.inverse);
  for (const z of [C(0.3, 0.7), C(-2, 1), C(5, -3)]) console.log('  f(', CX.fmt(z), ')=', CX.fmt(b.f(z), 12));
}
run({ a: '10\\sqrt{2}', b: '10', c: '20', d: '10\\sqrt{2}' });
run({ a: '0.00000001', b: '0', c: '0', d: '0.00000001' });
const s = 10 * Math.SQRT2; console.log('det fp', s * s - 200, 'sqrt(2)*10 via Math.sqrt', 10*Math.sqrt(2)*10*Math.sqrt(2)-200);

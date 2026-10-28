global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const C = CX.C;
for (const n of [2, 2147483647, 2147483648, 4294967296, 4294967297, 1e300, -4294967296]) {
  const b = Funcs.build({ type: 'pown', params: { n } });
  if (b.error) { console.log(n, 'ERR', b.error); continue; }
  const vals = [C(0.5, 0), C(2, 0), C(0.3, 0.4), C(1.1, 0.2)].map((z) => CX.fmt(b.f(z)));
  const P = b.props;
  console.log(String(n).padEnd(22), 'deg', P.deg, 'lamps', Funcs.PROP_KEYS.filter((k) => P[k]).join(','), '| f:', vals.join('  '));
}

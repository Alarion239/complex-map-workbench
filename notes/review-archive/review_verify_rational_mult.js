global.CX = require('../../src/cx.js'); global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
const cases = [
  ['1,-2', '1,-8,24,-32,16'],
  ['1,-1', '1,-4,6,-4,1'],
  ['1,-1', '1,-2,1'],
  ['1,-1', '1,-3,3,-1'],
  ['1,-2', '1,-6,12,-8'],
  ['1,-2', '1,-4,4'],
  ['1,0', '1,0,0'],
  ['1,0', '1,0,0,0,0'],
];
for (const [p, q] of cases) {
  const b = Funcs.build({ type: 'rational', params: { p, q } });
  if (b.error) { console.log(p, '/', q, 'ERR', b.error); continue; }
  const P = b.props;
  const pc = CX.polyTrim(p.split(',').map((x) => CX.C(+x, 0)));
  const vals = (b.poles || b.built && b.built.poles || []);
  console.log(p, '/', q, '-> deg', P.deg, 'degExact', P.degExact, 'proper', P.proper, 'mobius', P.mobius, 'injective', P.injective);
  const roots = CX.polyRoots(q.split(',').map((x) => CX.C(+x, 0)));
  const pmax = Math.max(...pc.map(CX.abs)); const dp = pc.length - 1;
  console.log('   roots', roots.map((r) => CX.fmt(r, 8)).join(' ; '));
  console.log('   |p(r)| vs thr', roots.map((r) => CX.abs(CX.polyEval(pc, r)).toExponential(2) + '/' + (1e-6 * pmax * Math.pow(1 + CX.abs(r), dp)).toExponential(2)).join(' '));
}

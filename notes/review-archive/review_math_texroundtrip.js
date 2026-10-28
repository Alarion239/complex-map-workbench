// Reviewer scratch: the displayed (and copyable) LaTeX of each catalog step, re-parsed by the app's own
// parser, should evaluate to the same function as the step (default params, default cuts).
global.CX = require('../../src/cx.js'); global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js'); const C = CX.C;
const pts = [C(0.3, 0.7), C(-2, 0.3), C(-2, -0.3), C(0.8, -0.5), C(1.7, 1.1), C(-0.6, -1.4)];
for (const id of Object.keys(Funcs.DEFS)) {
  const b = Funcs.build({ type: id, params: Funcs.defaults(id) });
  const tex = b.tex({ s: 'z', p: 4 }).s;
  let g;
  try { g = Expr.compile(Expr.parse(tex)); } catch (e) { console.log(id.padEnd(9), JSON.stringify(tex), 'PARSE ERROR', e.message); continue; }
  const bad = pts.filter((z) => { const a = b.f(z), c = g(z); return CX.isFin(a) && CX.abs(CX.sub(a, c)) > 1e-3 * (1 + CX.abs(a)); });
  if (bad.length) console.log(id.padEnd(9), JSON.stringify(tex).padEnd(40), 'differs at', bad.map((z) => `${CX.fmt(z)}: step ${CX.fmt(b.f(z), 4)} vs formula ${CX.fmt(g(z), 4)}`).join('; '));
}
console.log('done');

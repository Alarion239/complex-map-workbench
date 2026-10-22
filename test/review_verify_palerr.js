global.CX = require('../src/cx.js');
const Expr = require('../src/parse.js');
for (const q of ['\\Gamma(z)', '\\sinc z', 'e^{z}\\cdotp z', '\\sinn z', 'z^', '\\foo(z)', 'sinc(z)', 'gamma(z)']) {
  const heur = /[z(\\^|<>]/.test(q.trim());
  try { const a = Expr.parse(q, { allowRel: true }); console.log(JSON.stringify(q), 'heur', heur, 'PARSED', Expr.toTex(a).s); }
  catch (e) { console.log(JSON.stringify(q), 'heur', heur, 'ERR', e.message); }
}

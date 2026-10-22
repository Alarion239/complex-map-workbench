const { Curves, P } = require('./load.js');
const cases = process.argv.slice(2).length ? process.argv.slice(2) : [
  // complex-sided equations that ARE curves
  'z = \\bar z', '\\bar z = 1/z', 'z - \\bar z = 2i', '\\bar z = -z', 'z^2 = |z|^2', 'z/\\bar z = 1', '(1+i)\\operatorname{Re} z = 1+i', 'z^2 = \\bar z^2',
  // areas disguised as equations
  '\\operatorname{Re} z = |\\operatorname{Re} z|', '\\sqrt{z^2} = z',
  // touching zero sets
  '|z| = \\operatorname{Re} z', '\\arg(z^2) = \\pi', '|z^2-1| = 0', '(\\operatorname{Re} z)^2 (\\operatorname{Im} z)^2 = 0', '\\sqrt{|\\operatorname{Re} z|} = 0',
  // misc
  'Re z = 0 and Re z = 0', 'Re z = 0 or Re z = 0', '0 < Re z = 1', 'Re z => 0', 'Re z =< 0', 'Re z != 0', '\\operatorname{Re} z \\ne 0', 'Re z = ', '= 1', 'Re z = 0,',
  'x = 1', 'r = 1', '\\theta = 1', 'y = x^2', 'y = 1/x', '|z-1| = |z+1|', '|z|=|z-1|', 'Re(z) = Im(z)', '\\arg z = \\arg(z-1)', 'Im\\sqrt z = 1',
  '\\ln(Re z) = Im z', 'e^{Re z} = 2', 'Re z^2 = 1',
];
for (const s of cases) {
  let line;
  try {
    const ast = P(s), c = Expr.classifyRelation(ast);
    line = c.dim + (c.error ? ' ERR: ' + c.error.slice(0, 90) : '') + (c.pieces ? ' pieces=' + c.pieces.length + ' real=' + c.pieces.map((p) => p.real).join(',') : '');
    if (c.dim === 'curve') {
      const d = Curves.fromFormula(ast);
      line += ' exact=' + JSON.stringify(Curves.shapesOf(d)) + ' notes=' + JSON.stringify(d.notes) + ' tex=' + Expr.toTex(ast).s;
    }
  } catch (e) { line = 'THROW ' + e.message + ' @' + e.pos; }
  console.log(s.padEnd(48), line);
}

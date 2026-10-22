// old (milestone-p4) vs new parse.js: same AST / error / tex / level for a corpus, with and without allowRel
global.CX = require('../../../src/cx.js');
const NEW = require('../../../src/parse.js');
delete require.cache[require.resolve('../../../src/parse.js')];
const OLD = require('../../milestone-p4/src/parse.js');
const corpus = ['z^2', '|z|<1', '1<|z|<2', '0<\\Im z<\\pi, \\Re z>0', 'x^2+y^2 \\le 4 \\lor y>3', '\\neg (|z|<1)', '|z| \\ge 1 \\land Re z < 0', 'Re z = 0', 'a = b', 'z, 1', '|z|<1,', '<1', 'z<', '(|z|<1)', '|z|<1 or', '1<2', 'z==1', '|z|<=1', '|z|=<1', '||z|<1|', '\\sin(z<1)', 'Re z < 0 & Im z > 0', 'Re z<0&&Im z>0', '(Re z < 0) < 1', 'f(z) = z^2', 'w = z^2', '\\frac{z<1}{2}', '|z|<1 \\lor |z-2|<1 \\land Re z>2', '|z-1|<1 , |z+1|<1', 'z≤1', 'z ≥ 1', '\\le', 'z < 1 < 2 < 3'];
const S = (f) => { try { return JSON.stringify(f()); } catch (e) { return 'ERR ' + e.message + ' @' + e.pos; } };
let diffs = 0;
for (const s of corpus) for (const allowRel of [false, true]) {
  for (const [what, f] of [['ast', (E) => E.parse(s, { allowRel })], ['tex', (E) => E.toTex(E.parse(s, { allowRel })).s], ['lvl', (E) => { const L = E.compileLevel(E.parse(s, { allowRel })); return [L(CX.C(0.3, 0.4)), L(CX.C(-2, 1))]; }]]) {
    const a = S(() => f(OLD)), b = S(() => f(NEW));
    if (a !== b) { diffs++; console.log(`DIFF ${what} allowRel=${allowRel} ${s}\n   old ${a.slice(0, 160)}\n   new ${b.slice(0, 160)}`); }
  }
}
console.log('diffs', diffs);

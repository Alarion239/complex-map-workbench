// the stage sequence z -> w1 -> ... -> F as the catalog steps' own TeX would write it (read-only experiment)
const R = process.argv[2];
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
Expr.setNames({ get: (n) => (n === 'a' ? 0.7 : undefined), display: (n) => n });
for (const s of process.argv.slice(3)) {
  const ast = Expr.parse(s);
  const rc = Recognize.chain(ast, 180, {});
  if (!rc) { console.log(JSON.stringify(s), '-> no reading'); continue; }
  const b = Funcs.build({ type: 'custom', params: { expr: s, cut: 180 }, on: true });
  let arg = { s: 'z', p: 4 }; const st = ['z']; const names = [];
  for (const x of rc.steps) {
    const bb = x.type === 'custom' ? null : Funcs.buildVals(x.type, x.vals);
    if (!bb || bb.error) { st.push('?'); names.push(x.type); continue; }
    arg = bb.tex(arg); st.push(arg.s); names.push(bb.def.label);
  }
  console.log(JSON.stringify(s), rc.partial ? '(partial)' : '', '\n   stages:', st.join('  ↦  '), '\n   names :', names.join(' → '), '\n   typed :', Expr.toTex(ast).s, '\n   note  :', b.recNote || '-');
}

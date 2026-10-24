// the proposed preview rows: stage after each group = the formula's own piece (group srcs substituted, as typed);
// stages inside a multi-step group = the catalog step's TeX on the stage before; a group whose catalog end differs from
// the typed piece shows "catalog = typed". Read-only experiment.
const R = process.argv[2];
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
Expr.setNames({ get: (n) => (n === 'a' ? 0.7 : undefined), display: (n) => n });
const subst = (ast, by) => { if (!ast || typeof ast !== 'object') return ast; if (ast.t === 'var' && ast.n === 'z') return by; const o = Object.assign({}, ast); for (const k of ['a', 'b', 'n']) if (o[k]) o[k] = subst(o[k], by); return o; };
const LBL = (b) => ({ mul: 'Scaling', add: 'Translation', root: b.vals && b.vals.n === 2 ? 'Square root' : 'Root' })[b.def.id] || b.def.label;
for (const s of process.argv.slice(3)) {
  const ast = Expr.parse(s);
  const rc = Recognize.chain(ast, 180, {});
  if (!rc) { console.log(JSON.stringify(s), '-> no reading: no offer'); continue; }
  const rows = []; let stageAst = { t: 'var', n: 'z' };
  for (const g of rc.groups) {
    let arg = { s: Expr.toTex(stageAst).s, p: 4 };
    for (let j = g.from; j < g.to; j++) {
      const x = rc.steps[j];
      const b = x.type === 'custom' ? null : Funcs.buildVals(x.type, x.vals);
      const name = b ? LBL(b) : 'Custom formula';
      if (j < g.to - 1) { arg = b ? b.tex(arg) : { s: '?', p: 4 }; rows.push([arg.s, name]); }
      else {
        const typedEnd = subst(g.src, stageAst);
        const typed = Expr.toTex(typedEnd).s;
        const cat = b ? b.tex(arg).s : typed;
        rows.push([g.to - g.from > 1 && cat.replace(/\s/g, '') !== typed.replace(/\s/g, '') ? `${cat} = ${typed}` : typed, name]);
        stageAst = typedEnd;
      }
    }
  }
  console.log(JSON.stringify(s) + (rc.partial ? ' (partial)' : ''));
  console.log('   z');
  for (const [t, n] of rows) console.log('   ↦ ' + t.padEnd(52) + n);
  console.log('   params: ' + rc.steps.map((x) => x.type + JSON.stringify(Object.fromEntries(Object.entries(x.vals).filter(([k]) => k !== 'ast').map(([k, v]) => [k, v && v.re !== undefined ? (v.im ? `${v.re}${v.im < 0 ? '' : '+'}${v.im}i` : v.re) : v])))).join(' ; '));
}

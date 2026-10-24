// read the examples with the recognizer (read-only experiment on work/xvr-final-snap/src)
const R = process.argv[2];
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const fmt = (v) => { if (v && typeof v === 'object' && 're' in v) return `${+v.re.toFixed(4)}${v.im ? (v.im < 0 ? '-' : '+') + Math.abs(+v.im.toFixed(4)) + 'i' : ''}`; if (Array.isArray(v)) return '[' + v.map(fmt).join(',') + ']'; if (v && typeof v === 'object' && v.t) return Expr.toTex(v).s; return String(v); };
const list = process.argv.slice(3);
for (const s of list) {
  let ast; try { ast = Expr.parse(s); } catch (e) { console.log(s, 'PARSE ERR', e.message); continue; }
  let rc = null; try { rc = Recognize.chain(ast, 180, {}); } catch (e) { rc = 'ERR ' + e.message; }
  const b = Funcs.build ? null : null;
  if (!rc || typeof rc === 'string') { console.log(JSON.stringify(s), '->', rc); continue; }
  const steps = rc.steps.map((st) => st.type + '(' + Object.entries(st.vals).map(([k, v]) => k + '=' + fmt(v)).join(' ') + ')');
  const groups = rc.groups.map((g) => `[${g.from},${g.to}) ${Expr.toTex(g.src).s}`);
  console.log(JSON.stringify(s), '->', steps.join(' ; '), rc.partial ? 'PARTIAL' : '', '\n     groups:', groups.join(' | '), '\n     inp:', rc.steps.map((st) => st.inp ? Expr.toTex(st.inp).s : '-').join(' | '));
}

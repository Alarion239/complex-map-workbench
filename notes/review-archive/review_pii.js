global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
for (const [type, c] of [['add', 'i\\pi'], ['add', '\\pi i'], ['mul', '\\pi i'], ['add', '1-i\\pi'], ['add', 'i*pi']]) {
  const b = Funcs.build({ type, params: Object.assign(Funcs.defaults(type), { c }) });
  if (b.error) { console.log(type, c, 'ERR', b.error); continue; }
  const s = b.tex({ s: 'z', p: 4 }).s;
  console.log(type, JSON.stringify(c), '->', s);
  try { Expr.parse(s); console.log('  reparse ok'); } catch (e) { console.log('  reparse error:', e.message); }
}

global.CX = require('../../src/cx.js');
global.Expr = require('../../src/parse.js');
const Funcs = require('../../src/funcs.js');
global.Funcs = Funcs;
const GLChain = require('../../src/glsl.js');
for (const depth of [100, 1000, 3000, 10000]) {
  const expr = '('.repeat(depth) + 'z' + ')'.repeat(depth);
  const t0 = Date.now();
  const b = Funcs.build({type:'custom', params:{expr, cut:180}});
  console.log('parens', depth, b.error ? 'ERROR: ' + b.error : 'ok', Date.now() - t0, 'ms');
}
for (const depth of [50, 200, 1000]) {
  const expr = '\\sin('.repeat(depth) + 'z' + ')'.repeat(depth);
  const t0 = Date.now();
  const b = Funcs.build({type:'custom', params:{expr, cut:180}});
  let gl = '';
  try { const g = GLChain.build([{type:'custom', params:{expr, cut:180}, on:true}], [b]); gl = 'glsl ' + g.source.length + ' chars key ' + g.key.slice(0,60); } catch (e) { gl = 'GLERR ' + e.message; }
  console.log('sin nest', depth, b.error ? 'ERROR: ' + b.error : 'ok', Date.now() - t0, 'ms', gl);
}
for (const n of [1000, 5000]) {
  const expr = Array.from({length:n}, () => 'z').join('+');
  const t0 = Date.now();
  const b = Funcs.build({type:'custom', params:{expr, cut:180}});
  console.log('sum', n, b.error ? 'ERROR: ' + b.error : 'ok deg ' + b.props.deg, Date.now() - t0, 'ms');
}

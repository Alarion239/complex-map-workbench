const R = process.argv[2];
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
global.GLChain = require(R + '/src/glsl.js');
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : n==='b'?0.3:n==='c'?1.2:n==='d'?0.5:undefined), display: (n) => n });
const T = (label, fn, N = 20) => { fn(); const t0 = process.hrtime.bigint(); let r; for (let i = 0; i < N; i++) r = fn(); console.log(label.padEnd(30), (Number(process.hrtime.bigint() - t0) / 1e6 / N).toFixed(3), 'ms'); return r; };
for (const tex of process.argv.slice(3)) {
  console.log('==', tex);
  const ast = Expr.parse(tex);
  const rf = T('rationalForm', () => Inverse.rationalForm(ast));
  console.log(' rf ok', rf.ok, 'removed', rf.removed && rf.removed.length, 'notRational', rf.notRational, 'degP', rf.P && rf.P.length - 1, 'degQ', rf.Q && rf.Q.length - 1, rf.reason || '');
  const rc = T('Recognize.chain', () => Recognize.chain(ast, 180));
  console.log(' chain', rc && rc.steps.map((s) => s.type).join('>'), rc && rc.partial);
  if (rc) {
    const built = T('buildVals steps', () => rc.steps.map((s) => s.type === 'custom' ? Funcs.buildVals('custom', { expr: Expr.toTex(s.vals.ast).s, cut: 180, ast: s.vals.ast, part: true }) : Funcs.buildVals(s.type, s.vals)), 5);
    const f = Expr.compile(ast);
    const P = [CX.C(0.37, -0.81), CX.C(-1.3, 0.6), CX.C(2.1, 1.7), CX.C(-0.45, -2.2), CX.C(0.9, 0.05), CX.C(-0.6, -0.35), CX.C(1.7, -0.4)];
    for (const p of P) { let z = p; for (const b of built) z = b.f(z); const w = f(p); console.log('  probe', CX.abs(CX.sub(w, z)) / (1 + CX.abs(w)), CX.abs(w)); }
  }
  T('Funcs.build', () => Funcs.build({ type: 'custom', params: { expr: tex, cut: 180 }, on: true }), 10);
  T('Expr.parse', () => Expr.parse(tex));
  T('customInverse via stepOps', () => Inverse.stepOps(Funcs.build({ type: 'custom', params: { expr: tex, cut: 180 }, on: true })), 5);
}

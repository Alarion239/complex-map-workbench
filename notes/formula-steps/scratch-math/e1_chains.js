require('./load.js');
const C = CX.C;
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const F = process.argv.slice(2).length ? process.argv.slice(2) : ['\\sin(z^2+1)', '\\frac{2z+1}{z-1}', 'e^{iz}+e^{-iz}', 'z^{i}', '(z-a)^3', '\\sqrt{1-z^2}', '\\log\\frac{1+z}{1-z}', 'z^2+\\sin z', '\\frac{1}{z}+z',
  '2(z-1)^3+5', '\\frac{z}{3}', '\\log(-z)', 'z^{a}', '\\frac{az+1}{z+a}', '\\sin z', 'e^{2z+1}', '\\cot z', '\\log(\\sin z)', '\\sqrt{z^2}', '\\frac{z^2-1}{z^2+1}', '\\log(z^z)', 'e^{z^2}\\sin z', '(z-1)(z+2)', '\\sin(z)+\\cos(z)', '3^{iz}', 'e^{a z}', '\\frac{1}{(z-a)^2}', 'z^3-1', '1/(1+e^{-z})', '\\log(z+\\sqrt{z^2+1})'];
const fmt = (v) => (v && typeof v === 'object' && 're' in v ? CX.fmtExact(v) : Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']' : v && v.t ? Expr.toTex(v).s : JSON.stringify(v));
for (const s of F) {
  const ast = Expr.parse(s);
  const b = Funcs.buildVals('custom', { expr: s, cut: 180 });
  const rc = Recognize.chain(ast, 180);
  const steps = rc ? rc.steps.map((x) => x.type + '(' + Object.entries(x.vals).map(([k, v]) => k + '=' + fmt(v)).join(', ') + ')').join(' -> ') : 'null';
  console.log(s.padEnd(30), '|', steps, rc && rc.partial ? '[partial]' : '', '| rec:', b.rec ? 'yes' : 'no', '| groups:', rc ? rc.groups.map((g) => `[${g.from},${g.to}) ${Expr.toTex(g.src).s}`).join('; ') : '');
}

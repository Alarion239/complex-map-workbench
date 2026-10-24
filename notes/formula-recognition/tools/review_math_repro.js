// Reproduces the evidence of ../review-math.json (adversarial math review of src/recognize.js, work/xvr).
// node notes/formula-recognition/tools/review_math_repro.js   (reads work/xvr/src; read-only)
const R = require('path').join(__dirname, '../../../work/xvr');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
global.GLChain = require(R + '/src/glsl.js');
const C = CX.C;
let A = 0.7; Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const build = (expr, cut = 180) => Funcs.build({ type: 'custom', params: { expr, cut }, on: true });
const z0 = (v) => (Object.is(v, -0) ? '-0' : String(v));
const fmt = (v) => `${z0(v.re)}${v.im < 0 || Object.is(v.im, -0) ? '' : '+'}${z0(v.im)}i`;
const sig = (b) => (b.rec ? b.rec.built.map((x) => x.def.id).join(' > ') : 'not recognized');
const lamps = (b) => ['entire', 'mobius', 'proper', 'injective'].filter((k) => b.props[k]).join(',') + (b.props.deg != null ? ` deg=${b.props.deg}${b.props.degExact ? '' : '?'}` : '');
function at(expr, p, cut = 180) {
  const b = build(expr, cut), f = Expr.compile(Expr.parse(expr), { theta: cut * Math.PI / 180 });
  console.log(`  ${expr} (cut ${cut}) [${sig(b)}] at ${fmt(p)}: formula ${fmt(f(p))}, chain ${b.rec ? fmt(b.f(p)) : '-'}`);
}
console.log('math-1 signed zeros through merged Mobius / rational steps');
at('\\log(-z)', C(1, 0)); at('\\sqrt{-z}', C(2.5, 0)); at('(-z)^{i}', C(1, 0)); at('\\sqrt{-z^2}', C(-2, 0)); at('\\log(-z^2)', C(0.5, 0));
at('\\sqrt{-1-z}', C(2, 0)); at('\\sqrt{-(z-1)}', C(2, 0)); at('\\log(-\\frac{z}{2})', C(2, 0)); at('\\log(\\frac{z}{2})', C(-2, -0)); at('\\sqrt{2z-1}', C(-2, -0)); at('\\sqrt{(z+(-1))+z}', C(-2, -0));
console.log('math-2 cut normalisation (finish) versus Expr argCut(theta)');
at('\\log z', C(-2, -0), -180); at('\\sqrt{z}', C(-2, -0), -180); at('z^{i}', C(-2, -0), -180); at('\\sqrt{z}', C(-2, -0), 540);
at('\\sqrt[3]{\\frac{z}{z}}', C(2.169822686896577, 0.20989867076738689), 360); at('\\sqrt{\\cot(\\sin(z)\\cos(z))}', C(-1.9489676323481684, -2.298996875667477), 270);
console.log('math-3 removable points and infinity through merged Mobius maps');
for (const e of ['\\sin(\\frac{1}{\\frac{1}{z}})', '\\sqrt{\\frac{1}{\\frac{1}{z}}}', 'e^{\\frac{1}{1/z+1}}']) { at(e, C(0, 0)); console.log('    lamps', lamps(build(e))); }
at('\\operatorname{arsinh}(\\frac{2-i}{\\operatorname{artanh}(z)})', C(-1, 0)); at('\\coth((2-i)-\\operatorname{artanh}(z))', C(-1, 0));
console.log('math-4 overflow: identities finite where the spelled formula is NaN');
at('\\frac{\\sin(e^{z})}{\\cos(e^{z})}', C(7, 1)); at('e^{3z}e^{-2z}', C(240, 0.5)); at('\\sin(z)\\cos(z)', C(0.4, 710));
console.log('math-5 a shared number decides the structure');
for (const e of ['\\frac{z^{a}}{z+1}', 'z^{a}z', 'z^{a}+z', 'e^{z+a}', '\\frac{az+1}{z+a}']) console.log('  ' + e + ': ' + [-1, 0, 1, 2, 2.5, 3].map((a) => { A = a; return `a=${a}: ${sig(build(e))}`; }).join(' | '));
A = 0.7;
console.log('math-6 exact decimal literals in the rational normal form');
for (const e of ['(0.1+0.2-0.3)z^3+2z', '(0.1+0.2-0.3)z^2+z+1']) { const b = build(e); console.log(`  ${e} [${sig(b)}] lamps ${lamps(b)}`); at(e, C(1e8, 0)); }
console.log('math-7 (Expr, not the recognizer) negative constants are not principal');
for (const e of ['\\sqrt{-1}', '\\log(-1)', '(-8)^{1/3}', '(-1)^{z}']) console.log(`  ${e} at z=0.5: ${fmt(Expr.compile(Expr.parse(e))(C(0.5, 0)))}`);

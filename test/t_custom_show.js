// A formula step's display form (Funcs.build: params.show, params.showOf = Funcs.showKey(params.expr)):
//  1. showKey: 8 hex digits, FNV-1a of the trimmed text (a fixed vector), different formulas differ;
//  2. a step with a matching key has b.show; the map (values at probes), b.tex, the cuts and the guarantees are those of
//     the same step without it (display only);
//  3. show(a) writes the display form in the step's input: every z outside control words and \text-like groups, an
//     atom bare ({w_{1}}), anything else in \left( \right); z alone keeps the text; p 0;
//  4. no display form when the key is missing or stale (the formula edited), the text empty or not a string, the
//     formula has an error, or the step is not a formula step.
// node test/t_custom_show.js [-v]
const path = require('path');
const R = path.join(__dirname, '..');
global.CX = require(R + '/src/cx.js'); global.Expr = require(R + '/src/parse.js');
global.Funcs = require(R + '/src/funcs.js'); global.Region = require(R + '/src/region.js');
global.Inverse = require(R + '/src/inverse.js'); global.Recognize = require(R + '/src/recognize.js');
const V = process.argv.includes('-v');
let n = 0, bad = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } else if (V) console.log('ok  ', name, info); };
const C = CX.C;

// 1. the key
const K = Funcs.showKey;
check('showKey: 8 hex digits', /^[0-9a-f]{8}$/.test(K('z^2')), K('z^2'));
check('showKey: FNV-1a of the empty text', K('') === '811c9dc5', K(''));
check('showKey: FNV-1a of "a" (the reference vector)', K('a') === 'e40c292c', K('a'));
check('showKey: trimmed', K('  z^2 \n') === K('z^2'));
check('showKey: one character differs', K('z^2+1') !== K('z^2+2'));
check('showKey: stable', K('\\frac{1}{z}') === K('\\frac{1}{z}'));

// 2. display only
const LONGF = 'exp(' + Array.from({ length: 30 }, (_, j) => `0.1*log(z-(0.5+0.${String(j).padStart(2, '0')}i))`).join('+') + ')';
const SHOW = '\\prod_{j=1}^{30}(z-p_j)^{1/10}';
const forms = ['\\frac{z^2-1}{z^2+1}', 'z^3-3z', 'sqrt(z^2-1)', LONGF];
const probes = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05)];
for (const expr of forms) {
  const plain = Funcs.build({ type: 'custom', params: { expr, cut: 180 } });
  const shown = Funcs.build({ type: 'custom', params: { expr, cut: 180, show: SHOW, showOf: K(expr) } });
  const tag = expr.slice(0, 24);
  check(`${tag}: builds`, !plain.error && !shown.error, plain.error || shown.error);
  check(`${tag}: has the display form`, typeof shown.show === 'function' && !plain.show);
  check(`${tag}: the same values`, probes.every((p) => { const a = plain.f(p), b = shown.f(p); return (CX.isFin(a) ? CX.abs(CX.sub(a, b)) === 0 : !CX.isFin(b)); }));
  check(`${tag}: the same formula TeX`, plain.tex({ s: 'w_{1}', p: 4 }).s === shown.tex({ s: 'w_{1}', p: 4 }).s);
  check(`${tag}: the same props`, JSON.stringify(plain.props) === JSON.stringify(shown.props));
  check(`${tag}: the same cuts`, JSON.stringify((plain.cuts || []).length) === JSON.stringify((shown.cuts || []).length));
}
check('the long formula: its TeX is long (the Inspector does not typeset it)', Funcs.build({ type: 'custom', params: { expr: LONGF, cut: 180 } }).tex({ s: 'z', p: 4 }).s.length >= 700);

// 3. in the step's input
const sb = Funcs.build({ type: 'custom', params: { expr: 'z^2', cut: 180, show: 'c\\,z^{s}\\zeta(z)+\\text{zeros }\\operatorname{Rez}', showOf: K('z^2') } });
const a1 = sb.show({ s: 'w_{1}', p: 4 });
check('show: an atom input bare', a1.s === 'c\\,{w_{1}}^{s}\\zeta({w_{1}})+\\text{zeros }\\operatorname{Rez}', a1.s);
check('show: counts as a sum', a1.p === 0);
const a2 = sb.show({ s: 'z+1', p: 0 });
check('show: a sum input in brackets', a2.s === 'c\\,\\left(z+1\\right)^{s}\\zeta(\\left(z+1\\right))+\\text{zeros }\\operatorname{Rez}', a2.s);
check('show: z itself keeps the text', sb.show({ s: 'z', p: 4 }).s === 'c\\,z^{s}\\zeta(z)+\\text{zeros }\\operatorname{Rez}');
check('show: trimmed', Funcs.build({ type: 'custom', params: { expr: 'z^2', cut: 180, show: '  z^2  ', showOf: K('z^2') } }).show({ s: 'z', p: 4 }).s === 'z^2');

// 4. none
const none = (params, type = 'custom') => !Funcs.build({ type, params }).show;
check('no key: none', none({ expr: 'z^2', cut: 180, show: 'z^2' }));
check('a stale key (the formula edited): none', none({ expr: 'z^2+1', cut: 180, show: 'z^2', showOf: K('z^2') }));
check('an empty text: none', none({ expr: 'z^2', cut: 180, show: '   ', showOf: K('z^2') }));
check('not a string: none', none({ expr: 'z^2', cut: 180, show: 7, showOf: K('z^2') }));
check('an error: none', Funcs.build({ type: 'custom', params: { expr: 'z^2+x', cut: 180, show: 'z^2', showOf: K('z^2+x') } }).error && none({ expr: 'z^2+x', cut: 180, show: 'z^2', showOf: K('z^2+x') }));
check('a catalog step: none', none({ a: '2', b: '0', show: 'z', showOf: K('') }, 'affine') && none({ a: '2', show: 'z', showOf: K(undefined) }, 'mul'));

// a display form from a link or a scene is typeset as it opens: one that links, styles, names DOM nodes, loads an
// extension, defines a macro or writes MathML is refused (the formula is shown)
for (const bad of ['\\href{javascript:alert(1)}{z^2}', '\\style{color:red}{z^2}', '\\class{x}{z}', '\\cssId{x}{z}', '\\require{html}z',
  '\\newcommand{\\f}{z}\\f', '\\def\\f{z}\\f', '\\mmlToken{mi}{z}', '\\unicode{65}', '\\data{a=1}{z}', 'z\\tag{1}']) {
  check(`a display form refused: ${bad}`, none({ expr: 'z^2', cut: 180, show: bad, showOf: K('z^2') }));
}
check('an ordinary display form is kept (\\frac, \\text{class}, \\left)', !none({ expr: 'z^2', cut: 180, show: '\\frac{z}{2}\\,\\text{class}\\left(z\\right)', showOf: K('z^2') }));

console.log(`t_custom_show: ${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);

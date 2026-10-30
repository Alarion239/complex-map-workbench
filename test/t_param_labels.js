// A step field's label is shown as text (#336): no raw TeX source (a_n, u_{k+1}, \frac) in any Funcs.DEFS param
// label; a subscript is written in Unicode (aₙ, u₀, uₖ₊₁), and such a label has its name for a screen reader in
// letters (q.say, "u k+1") unless it is in words.
// Run: node test/t_param_labels.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const TEX = /[_^\\{}]/, SUB = /[₀-ₜᵢ-ᵪ]/;
for (const [type, d] of Object.entries(Funcs.DEFS)) {
  for (const q of d.params || []) {
    const lab = String(q.label);
    check(`${type}.${q.key}: the label "${lab}" has no raw TeX`, !TEX.test(lab));
    // (a label in words, "coefficients aₙ, …, a₀", names itself)
    if (SUB.test(lab) && !/\p{L}{3,}/u.test(lab)) check(`${type}.${q.key}: the label "${lab}" in subscripts has a name in letters`, typeof q.say === 'string' && !!q.say && !SUB.test(q.say) && !TEX.test(q.say), q.say);
  }
}
const lab = (type, key) => (Funcs.DEFS[type].params.find((q) => q.key === key) || {}).label;
check('the series\' a_n reads aₙ =', lab('series', 'an') === 'aₙ =', lab('series', 'an'));
check('the recurrence\'s u_0 reads u₀ =', lab('recurrence', 'u0') === 'u₀ =', lab('recurrence', 'u0'));
check('the recurrence\'s rule reads uₖ₊₁ =', lab('recurrence', 'g') === 'uₖ₊₁ =', lab('recurrence', 'g'));
console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);

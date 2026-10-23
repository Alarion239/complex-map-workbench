// node test/t_i18n_parse.js : the Russian names in the parser change no formula. Every string literal of the sources
// and the tests (the catalog's examples and presets, the tour, the examples menu, every test formula), every catalog
// step's TeX and menu TeX, and the TeX the parser prints back, parse to the same tree in the base parser
// (notes/gate-morph-zp-r1/src) and in src/parse.js, in English and in Russian; inputs the base refuses get the same
// English message. Then the Russian spellings evaluate as the English ones.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'notes/gate-morph-zp-r1/src');
function load(dir, files, lang) {
  const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout, Intl };
  vm.createContext(ctx);
  const NAMES = { cx: 'CX', parse: 'Expr', funcs: 'Funcs' };
  for (const f of files) {
    const p = path.join(dir, f + '.js');
    vm.runInContext(fs.readFileSync(p, 'utf8') + (NAMES[f] ? `\n;globalThis.${NAMES[f]} = ${NAMES[f]};` : ''), ctx, { filename: p });
    if (f === 'i18n_ru' && lang) vm.runInContext(`I18N._setLang(${JSON.stringify(lang)})`, ctx);
  }
  return ctx;
}
const base = load(BASE, ['cx', 'parse', 'funcs']);
const en = load(path.join(ROOT, 'src'), ['i18n', 'i18n_ru', 'cx', 'parse', 'funcs'], null);
const ru = load(path.join(ROOT, 'src'), ['i18n', 'i18n_ru', 'cx', 'parse', 'funcs'], 'ru');
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', msg); } };

// the corpus: every string literal in the sources and tests
const corpus = new Set();
const files = [];
const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const st = fs.statSync(p); if (st.isDirectory()) { if (!/_cdp$|node_modules|shots|fixtures/.test(n)) walk(p); } else if (/\.(js|html)$/.test(n) && st.size < 2e6 && !/^i18n_ru\.js$/.test(n)) files.push(p); } };
walk(path.join(ROOT, 'src')); walk(path.join(ROOT, 'test')); walk(BASE);
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.|\$(?!\{))*)`/g)) {
    const raw = m[0];
    if (raw.length > 400) continue;
    try { const v = vm.runInNewContext(raw); if (typeof v === 'string' && v.trim() && v.length < 300) corpus.add(v); } catch (e) { /* not a plain literal */ }
  }
}
// the catalog: menu TeX, each step's TeX with its defaults, domains
for (const d of Object.values(base.Funcs.DEFS)) {
  corpus.add(d.menuTex);
  const b = base.Funcs.build({ type: d.id, params: base.Funcs.defaults(d.id) });
  if (b && !b.error && typeof b.tex === 'function') { try { corpus.add(b.tex({ s: 'z', p: 4 }).s); corpus.add(b.tex({ s: '(z+1)', p: 4 }).s); } catch (e) { /* d/dz needs a chain */ } }
  if (b && b.domain) corpus.add(b.domain('z'));
}
const tree = (E, s, o) => { try { return JSON.stringify(E.parse(s, o)); } catch (e) { return 'ERR ' + e.message + ' @' + e.pos; } };
let parsed = 0, refused = 0;
const newly = new Set();   // refused by the base, read now: written with a Russian form
const round = new Set();
for (const s of corpus) {
  for (const o of [undefined, { allowRel: true }]) {
    const a = tree(base.Expr, s, o), b = tree(en.Expr, s, o), c = tree(ru.Expr, s, o);
    if (a.startsWith('ERR')) {
      refused++;
      // a refused formula keeps its English message, unless it is written with a Russian form and now parses
      const ruForm = /\b(tg|ctg|cth|sh|ch|th|arctg|arsh|arch|arth|cosec|Ln)\b|\{,\}|\\text\{(или|и|не)\}/.test(s);
      ok(b === a || (ruForm && !b.startsWith('ERR')), `English message for ${JSON.stringify(s)}: base ${a}, now ${b}`);
      if (ruForm && !b.startsWith('ERR')) newly.add(s);
      ok(c.startsWith('ERR') === b.startsWith('ERR') && (!b.startsWith('ERR') || c === tree(ru.Expr, s, o)), `Russian refuses what English refuses: ${JSON.stringify(s)}: ${c}`);
    } else {
      parsed++;
      ok(b === a, `same tree in English for ${JSON.stringify(s)}`);
      ok(c === a, `same tree in Russian for ${JSON.stringify(s)}`);
      try { round.add(base.Expr.toTex(base.Expr.parse(s, o)).s); } catch (e) { /* toTex of a bare boolean */ }
    }
  }
}
// the TeX the parser prints back (what the app writes into captions and copies)
for (const s of round) for (const o of [undefined, { allowRel: true }]) {
  const a = tree(base.Expr, s, o), b = tree(en.Expr, s, o);
  ok(b === a, `printed TeX ${JSON.stringify(s)}`);
}
console.log('refused by the base, read now (Russian forms):', [...newly].map((x) => JSON.stringify(x)).join(' '));
ok(parsed > 800 && refused > 1000, `corpus: ${corpus.size} literals, ${parsed} parses, ${refused} refusals, ${round.size} printed`);
// the Russian spellings, in either language, evaluate as the English ones
const C = en.CX.C, z0 = C(0.3, 0.7);
const val = (E, s, o) => en.CX.fmt(E.compile(E.parse(s, o))(z0), 9);
const pairs = [['tg z', 'tan z'], ['ctg z', 'cot z'], ['sh z', 'sinh z'], ['ch z', 'cosh z'], ['th z', 'tanh z'], ['cth z', 'coth z'],
  ['arctg z', 'arctan z'], ['arsh z', 'asinh z'], ['arch(z+2)', 'acosh(z+2)'], ['arth z', 'atanh z'], ['cosec z', 'csc z'], ['Ln z', 'log z'],
  ['\\tg z', '\\tan z'], ['\\sh^2 z-\\ch^2 z', '-1'], ['\\operatorname{arsh} z', '\\operatorname{arsinh} z'], ['\\operatorname{Ln}(z+1)', '\\log(z+1)'],
  ['\\arctg\\frac{z}{2}', '\\arctan\\frac{z}{2}'], ['0{,}25z^{1{,}5}', '0.25z^{1.5}']];
for (const [a, b] of pairs) for (const E of [en.Expr, ru.Expr]) {
  try { ok(val(E, a) === val(base.Expr, b), `${a} = ${b}`); } catch (e) { ok(false, `${a}: ${e.message}`); }
}
// an unfinished formula in Russian notation: in Russian the message of the pass that read the Russian forms (not
// "unknown symbol t"); in English the base's message, as before
const errOf = (E, s, o) => { try { E.parse(s, o); return null; } catch (e) { return e.message; } };
for (const [s, want, o] of [['tg(z', 'Ожидалось «)»'], ['\\tg', 'После tg не хватает выражения'],
  ['\\operatorname{tg}', 'После tg не хватает выражения'], ['Ln(', 'Выражение не закончено'], ['0{,}5+', 'Выражение не закончено'],
  ['|z|<1 \\text{или}', 'Выражение не закончено', { allowRel: true }], ['sh(z', 'Ожидалось «)»']]) {
  ok(errOf(ru.Expr, s, o) === want, `Russian message for ${JSON.stringify(s)}: ${errOf(ru.Expr, s, o)}`);
  ok(errOf(en.Expr, s, o) === errOf(base.Expr, s, o), `English message for ${JSON.stringify(s)}: ${errOf(en.Expr, s, o)}`);
}
ok(tree(ru.Expr, 'cosecot z') === tree(base.Expr, 'cosecot z'), 'cosecot z reads as in the base, in Russian');
console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks pass (${corpus.size} literals, ${parsed} parse, ${refused} refused, ${round.size} printed back)`);
process.exit(fails ? 1 : 0);

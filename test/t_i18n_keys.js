// node test/t_i18n_keys.js : every $t / $tx / $tn key used in src/*.js has a Russian entry in the shipped table
// (src/i18n_ru.js, made by tools/make_ru_table.py), and each Russian form fills exactly the placeholders of its English
// template (with i18n.js's rule: %{name} always, {name} only in a template without TeX). A plural entry has all four
// Russian forms, and each carries the count when the English does. Re-run after tools/make_ru_table.py.
'use strict';
const fs = require('fs');
const path = require('path');
const I18N = require('../src/i18n.js');
const { sites, CTX } = require('./i18n_sites.js');
const SRC = path.join(__dirname, '../src');
const RU_JS = require('./src_text').source('i18n_ru.js', { esm: 'strip' });
const RU = JSON.parse(new Function('let j; const I18N = { define: (l, s) => { j = s; } };' + RU_JS + '; return j;')());
const has = (k) => Object.prototype.hasOwnProperty.call(RU, k);
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('FAIL', msg); } };
const set = (s) => [...new Set(I18N.names(s))].sort().join(',');
const all = sites(SRC);
const seen = new Set();
for (const s of all) {
  if (seen.has(s.key)) continue;
  seen.add(s.key);
  const words = /[A-Za-z]{2,}/.test(s.src.replace(/\\[A-Za-z]+|\$[^$]*\$|%?\{[A-Za-z_]\w*\}/g, ' '));
  if (!has(s.key)) {
    // a key whose Russian is its English (pure math such as \tan) needs no entry; one with words does
    ok(!words, `no Russian entry for ${s.where} ${JSON.stringify(s.key)}`);
    continue;
  }
  const v = RU[s.key];
  const want = s.kind === 'tn' ? [...new Set([...I18N.names(s.one), ...I18N.names(s.src)])].sort().join(',') : set(s.src);
  if (s.kind === 'tn') {
    ok(v && typeof v === 'object', `${s.where}: a $tn key needs plural forms: ${JSON.stringify(s.key)}`);
    for (const f of ['one', 'few', 'many', 'other']) {
      ok(typeof (v || {})[f] === 'string', `${s.where}: plural form ${f} of ${JSON.stringify(s.key)}`);
      if (typeof (v || {})[f] === 'string') ok(set(v[f]) === want, `${s.where}: placeholders of the ${f} form ${JSON.stringify(v[f])}: want ${want}`);
    }
  } else {
    const forms = typeof v === 'string' ? [v] : Object.values(v);
    for (const f of forms) ok(set(f) === want, `${s.where}: placeholders of ${JSON.stringify(f)}: got ${set(f)}, want ${want}`);
    // math and product names that Russian writes the same way (phase 2b): the pattern «arg z», the voice engine
    const LATIN_OK = new Set(['Arg z', 'audio\u0004worklet']);
    ok(!words || LATIN_OK.has(s.key) || forms.some((f) => /[А-яЁё]/.test(f)), `${s.where}: the Russian of ${JSON.stringify(s.key)} has Cyrillic`);
  }
}
ok(seen.size >= 200, 'call sites found: ' + seen.size);
// the Russian of every call site, filled the way the call fills it, keeps the English math: same $…$ count
I18N._setLang('ru');
new Function('I18N', RU_JS)(I18N);
for (const k of seen) {
  if (!has(k) || k.includes(CTX)) continue;
  const n = (x) => (String(x).match(/\$/g) || []).length;
  // (review math-9: the empty-canvas caption sets its variable in math in Russian, two more $)
  const extra = k === '(a) The %{lvar}-plane. (b) The image under %{map}.%{pat}' ? 2 : 0;
  ok(n(I18N.t(k)) === n(k) + extra, `inline math kept in ${JSON.stringify(k).slice(0, 80)}`);
}
I18N._setLang('en');
console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks pass (${seen.size} keys)`);
process.exit(fails ? 1 : 0);

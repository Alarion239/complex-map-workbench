// node test/t_i18n.js : the i18n module (src/i18n.js), the shipped Russian table (src/i18n_ru.js), the parser's Russian
// names. Adapted from notes/i18n/proto/t_i18n.js (phase 1): the same checks against the shipped files.
'use strict';
const fs = require('fs');
const path = require('path');
const I18N = require('../src/i18n.js');
const XL = path.resolve(__dirname, '../src');
// the shipped table is one JSON string in a JS call: I18N.define('ru', "...")
const RU_JS = fs.readFileSync(path.join(XL, 'i18n_ru.js'), 'utf8');
const RU_ALL = JSON.parse(new Function('let j; const I18N = { define: (l, s) => { j = s; } };' + RU_JS + '; return j;')());
new Function('I18N', RU_JS)(I18N);
// the entries the structural checks cover: the sample of phase 1 (proto/ru.json) as shipped, and every key a call
// site in src/ uses (test/t_i18n_keys.js checks that each has one); the rest of the table is the table owner's
const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, '../notes/i18n/proto/ru.json'), 'utf8'));
const SITES = require('./i18n_sites.js').sites(XL).map((s) => s.key);
const RU = {};
for (const k of new Set([...Object.keys(SAMPLE), ...SITES])) if (Object.prototype.hasOwnProperty.call(RU_ALL, k)) RU[k] = RU_ALL[k];

let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const as = (l, fn) => I18N.using(l, fn);

// ---- 1. the language ----
// detection as phase 2b turns it on (auto: true); phase 2a ships it off: a Russian browser keeps English
const R = (o) => I18N._resolve(Object.assign({ auto: true }, o));
const nav = (langs, language) => ({ languages: langs, language });
eq(I18N._resolve({ nav: nav(['ru-RU']) }), I18N._autoDetect ? 'ru' : 'en', 'detection follows AUTO_DETECT');
eq(I18N._resolve({ nav: nav(['ru-RU']), param: 'ru' }), 'ru', '?lang=ru with detection off');
eq(I18N._resolve({ nav: nav(['en']), pref: 'ru' }), 'ru', 'a stored Russian setting with detection off');
eq(R({ nav: nav(['ru-RU', 'en']) }), 'ru', 'ru-RU first');
eq(R({ nav: nav(['ru']) }), 'ru', 'ru first');
eq(R({ nav: nav(['RU-ru']) }), 'ru', 'case');
eq(R({ nav: nav(['en-US', 'ru']) }), 'en', 'ru second is not enough');
eq(R({ nav: nav(['uk-UA', 'ru']) }), 'en', 'Ukrainian first');
eq(R({ nav: nav([], 'ru-RU') }), 'ru', 'navigator.language fallback');
eq(R({ nav: nav(['rue']) }), 'en', 'rue is not ru');
eq(R({ nav: nav(['ru']), pref: 'en' }), 'en', 'setting English beats a Russian browser');
eq(R({ nav: nav(['en-GB']), pref: 'ru' }), 'ru', 'setting Russian beats an English browser');
eq(R({ nav: nav(['ru']), ns: 'qa' }), 'en', 'test namespace: English on a Russian machine');
eq(R({ nav: nav(['ru']), ns: 'qa', pref: 'ru' }), 'ru', 'test namespace that asks for Russian');
eq(R({ nav: nav(['en']), ns: 'qa', param: 'ru' }), 'ru', '?lang=ru');
eq(I18N.lang, 'en', 'node: no window, English');

// ---- 2. English is untouched ----
for (const k of Object.keys(RU)) {
  if (typeof RU[k] !== 'string') { const [one, many] = k.split('\u0004'); eq(I18N.tn(one, many, 1), I18N.fill(one, { n: 1 }), 'en tn identity ' + one); eq(I18N.tn(one, many, 3), I18N.fill(many, { n: 3 }), 'en tn identity ' + many); continue; }
  if (k.includes('\u0004')) { const [c, s] = k.split('\u0004'); eq(I18N.tx(c, s), s, 'en tx identity ' + s); continue; }
  eq(I18N.t(k), k, 'en identity ' + k);
}
eq(I18N.t('Saved {file}.', { file: 'a.png' }), 'Saved a.png.', 'en fill');
eq(I18N.t('\\operatorname{Re} z > %{a}', { a: 2 }), '\\operatorname{Re} z > 2', 'TeX template: %{a} is the placeholder');
eq(I18N.t('\\operatorname{Re} z > {a}', { a: 2 }), '\\operatorname{Re} z > {a}', 'TeX template: {a} is a TeX group, never filled');
// i18n-4: a parameter named like a TeX group never fills the group
eq(I18N.fill('$H_t(%{v})=%{v}^{n}$', { v: 'z', n: 3 }), '$H_t(z)=z^{n}$', 'math template: ^{n} stays a group');
eq(I18N.fill('$e^{t}$ at t = %{t}', { t: 0.5 }), '$e^{t}$ at t = 0.5', 'math template: e^{t} stays');
eq(I18N.fill('Saved {file}.', { file: 'x' }), 'Saved x.', 'plain template: {name} works');
eq(I18N.fill('all steps · t = {2}', { 2: 'a' }), 'all steps · t = {2}', 'a non-identifier is never a placeholder');
eq(I18N.names('$%{a}^{b}$ and %{c}').join(','), 'a,c', 'names() of a math template');
eq(I18N.names('{a} and {b}').join(','), 'a,b', 'names() of a plain template');
eq(typeof globalThis.$t + typeof globalThis.$tx + typeof globalThis.$tn, 'functionfunctionfunction', 'i18n-22: $t, $tx, $tn are globals for node tests');
eq(I18N.tn('{n} shape', '{n} shapes', 1), '1 shape', 'en one');
eq(I18N.tn('{n} shape', '{n} shapes', 0), '0 shapes', 'en zero');
eq(I18N.tn('{n} shape', '{n} shapes', 1.5), '1.5 shapes', 'en fraction');
eq(I18N.notation('\\tan z+\\sinh z+\\log z'), '\\tan z+\\sinh z+\\log z', 'en notation untouched');
eq(I18N.texNum(0.5), '0.5', 'en decimal point');
eq(I18N.texInterval(0.5, 1), '[0.5,1]', 'en interval');
eq(I18N.nbsp('в плоскости z'), 'в плоскости z', 'en: no Russian typography');
eq(I18N.missing.size, 0, 'no miss recorded outside a debug run');
eq(I18N.num(0.85), '0.85', 'en number');
eq(I18N.list(['a', 'b', 'c']), 'a, b, and c', 'en list');

// ---- 3. the Russian table ----
const toks = (s, re) => (String(s).match(re) || []).sort().join(' ');
const PH = /\{[A-Za-z_][A-Za-z0-9_]*\}/g, TAG = /<\/?[a-z][a-z0-9]*/g, CMD = /\\[A-Za-z]+/g, MATH = /\$[^$]*\$/g;
const forms = (v) => (typeof v === 'string' ? [v] : Object.values(v));
for (const [k, v] of Object.entries(RU)) {
  // a context entry: ctx + CTX + source; a plural entry: one + CTX + many, checked against the many form
  const src = k.includes('\u0004') ? k.split('\u0004')[1] : k;
  if (typeof v !== 'string') {
    for (const f of ['one', 'few', 'many', 'other']) ok(typeof v[f] === 'string' && v[f].length > 0, `plural form ${f} of ${k}`);
    // i18n-5: Russian 'one' also covers 21, 31, 101, so every form carries the count when the plural source does
    if (I18N.names(src).includes('n')) for (const f of ['one', 'few', 'many', 'other']) ok(I18N.names(v[f] || '').includes('n'), `plural form ${f} of ${k} has {n}`);
  }
  // phase 2b: entries that differ from their source by design. A copied-LaTeX comment ('% ...') adds the Russian
  // preamble lines (fontenc, babel, fontspec); a figure caption sets its panel letters in \textit (italic Cyrillic а, б);
  // \Im and \Re print as \operatorname{Im}, \operatorname{Re} (the app's own form); a speech pattern holds $1 $2; the
  // serial comma is empty in Russian; an appositive ', outlined,' becomes a parenthesis ' (контур)'; palette search
  // aliases keep their English words and add Russian ones
  const latexComment = /^%/.test(src), alias = typeof v === 'string' && v.startsWith(src) && v.length > src.length;
  const normCmd = (x) => toks(String(x).replace(/\\textit(?=\{)/g, '').replace(/\\(Im|Re)\b(?!\{)/g, '\\operatorname'), CMD);
  for (const f of forms(v)) {
    ok(f.trim().length > 0 || k === 'serial\u0004,', 'empty translation ' + k);
    const noText = (x) => String(x).replace(/\\text\{[^}]*\}/g, '\\text{}');   // words inside \text{} are translated
    const opn = (x) => noText(x).replace(/\\operatorname\{(Im|Re)\}/g, '\\$1');
    if (!latexComment) eq(toks(opn(f), PH), toks(opn(src), PH), 'placeholders/TeX groups of ' + k);
    else eq(toks(f, /%\{[A-Za-z_]\w*\}/g), toks(src, /%\{[A-Za-z_]\w*\}/g), 'placeholders of the LaTeX comment ' + k);
    eq(toks(f, TAG), toks(src, TAG), 'tags of ' + k);
    if (!latexComment) eq(normCmd(f), normCmd(src), 'TeX commands of ' + k);
    // (review math-9: the empty-canvas caption sets its variable in math in Russian; the English source writes it as text)
    const mathVar = k === '(a) The %{lvar}-plane. (b) The image under %{map}.%{pat}';
    if (!/\$\d/.test(src)) eq(toks(f, MATH).replace(mathVar ? '$%{lvar}$' : '\u0000', '').trim(), toks(src, MATH), 'inline math of ' + k);
    ok(!/^\s|\s$/.test(f) || /^\s|\s$/.test(src) || /^[,;]/.test(src), 'stray space in ' + k);
    // the whole text pasted twice (phase 2b found one: the Sound paragraph of the guide)
    ok(f.length < 80 || f.indexOf(f.slice(0, 60), 1) < 0, 'repeated text in ' + k);
    // no English left: drop math, tags with their math content, placeholders, TeX; then allow key names, formats,
    // the brand, autonyms and the formula keywords shown in <i>
    const ALLOW = new Set(['Enter', 'Esc', 'Shift', 'Delete', 'Tab', 'Ctrl', 'Alt', 'Space', 'LaTeX', 'TeX', 'PDF', 'PNG', 'SVG', 'English', 'Complex', 'Map', 'Workbench', 'Re', 'Im', 'arg', 'ln', 'tg', 'ctg', 'sh', 'ch', 'th', 'cth', 'arctg', 'arsh', 'arch', 'arth', 'cosec',
      // the formula language and the math in the parser's messages (phase 2a): keywords, names, products of letters
      'and', 'or', 'not', 'ad', 'bc', 'dz', 'arcctg', 'arccot', 'acot', 'lg', 'Ln', 'Arg', 'arcth', 'arcoth', 'artanh',
      // phase 2b: key names, file formats and units, products, LaTeX names, math words (exp, const, az + b)
      'Escape', 'pdf', 'png', 'svg', 'txt', 'tex', 'pt', 'in', 'cm', 'mm', 'Overleaf', 'Beamer', 'Docs', 'Slides', 'Google', 'WebGL', 'Web', 'Audio', 'AudioWorklet',
      'arXiv', 'tbp', 'figure', 'amsart', 'Letter', 'REVTeX', 'IEEE', 'iPhone', 'iPad', 'pdfLaTeX', 'XeLaTeX', 'LuaLaTeX', 'exp', 'const', 'az', 'cz', 'arg', 'Res', 'sin', 'cos', 'fontenc']);
    const rest = f.replace(MATH, ' ').replace(/<(i|var|sub|sup|kbd)>.*?<\/\1>/g, ' ').replace(/<[^>]*>/g, ' ').replace(PH, ' ').replace(/\\[A-Za-z]+(\{[^}]*\})?/g, ' ');
    // a LaTeX comment's package options, arguments and font files are code
    const rest2 = latexComment ? rest.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/[\w-]+\.otf/g, ' ') : rest;
    const latin = (rest2.match(/[A-Za-z]{2,}/g) || []).filter((w) => !ALLOW.has(w));
    ok(latin.length === 0 || alias, `English left in ${JSON.stringify(f)}: ${latin.join(', ')}`);
    ok(!/[a-zA-Z][а-яё]|[а-яё][a-zA-Z]/i.test(rest), 'mixed-script word in ' + f);
  }
}
// every string of the static page has a translation (what the walker will look up)
const page = fs.readFileSync(path.join(XL, 'page.html'), 'utf8');
let body = page.slice(page.indexOf('<div id="app">')).replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
body = body.replace(/<h1 class="wordmark" data-i18n="no">[\s\S]*?<\/h1>/, '');
// phase 2b adds the two markers to page.html (DESIGN.md 2); until then the wordmark and the inline-math label are skipped
if (!/data-i18n="no"/.test(page)) body = body.replace(/<h1 class="wordmark"[^>]*>[\s\S]*?<\/h1>/, '');
if (!/data-i18n="html"/.test(page)) body = body.replace(/Key in the <i>w<\/i>-plane/g, '');
const keys = new Set();
body = body.replace(/<span data-i18n="html">([\s\S]*?)<\/span>/g, (m, inner) => { keys.add(inner.trim()); return ''; });
for (const m of body.matchAll(/>([^<>]*)</g)) { const s = m[1].trim(); if (/[A-Za-z]{2,}/.test(s)) keys.add(s); }
for (const m of body.matchAll(/(?:title|aria-label|placeholder|data-tip)="([^"]*)"/g)) { const s = m[1].split('  ')[0].trim(); if (/[A-Za-z]{2,}/.test(s)) keys.add(s); }
for (const k of keys) ok(Object.prototype.hasOwnProperty.call(RU_ALL, k), 'page.html string without a translation: ' + k);
ok(keys.size >= 75, 'page.html strings found: ' + keys.size);

// ---- 4. Russian lookups, plurals, word order ----
as('ru', () => {
  eq(I18N.t('Fit view'), 'Вписать в окно', 'ru t');
  eq(I18N.t('Saved {file}.', { file: 'a.png' }), 'Файл a.png сохранён.', 'ru fill, word order');
  eq(I18N.tx('pred', 'conformal'), 'конформно', 'context: predicate');
  eq(I18N.t('conformal'), 'конформное', 'context: no context');
  const sh = (n) => I18N.tn('{n} shape', '{n} shapes', n);
  eq(I18N.tn('{n} shape', '{n} figures', 2), '2 figures', 'i18n-5: another pair with the same singular does not collide');
  const want = { 1: '1 фигура', 2: '2 фигуры', 4: '4 фигуры', 5: '5 фигур', 11: '11 фигур', 12: '12 фигур', 14: '14 фигур', 21: '21 фигура', 22: '22 фигуры', 25: '25 фигур', 101: '101 фигура', 111: '111 фигур', 0: '0 фигур', 1.5: '1,5 фигуры' };
  for (const [n, w] of Object.entries(want)) eq(sh(+n), w, 'ru plural ' + n);
  eq(I18N.list(['конформно', 'однолистно', 'ограничено']), 'конформно, однолистно и ограничено', 'ru list, no serial comma');
  const p = I18N.parts('{F} is {props}; these properties are guaranteed by the chain.', { F: { m: 'F' }, props: [{ t: 'конформно' }] });
  eq(JSON.stringify(p), JSON.stringify(['Отображение ', { m: 'F' }, ' ', [{ t: 'конформно' }], '; эти свойства гарантирует цепочка.']), 'parts keep values and Russian order');
  eq(I18N.using('en', () => I18N.t('Figure {n}.', { n: 1 })), 'Figure 1.', 'English caption from a Russian interface');
  eq(I18N.t('Figure {n}.', { n: 1 }), 'Рис. 1.', 'Russian caption');
  // notation: whole commands only
  eq(I18N.notation('\\tan z'), '\\operatorname{tg} z', 'tg');
  eq(I18N.notation('\\tanh z'), '\\operatorname{th} z', 'th, not tg+h');
  eq(I18N.notation('\\cot z+\\coth z+\\csc z'), '\\operatorname{ctg} z+\\operatorname{cth} z+\\operatorname{cosec} z', 'ctg, cth, cosec');
  eq(I18N.notation('\\sinh\\cosh'), '\\operatorname{sh}\\operatorname{ch}', 'sh ch');
  eq(I18N.notation('\\arctan z'), '\\operatorname{arctg} z', 'arctg');
  eq(I18N.notation('\\operatorname{arsinh} z+\\operatorname{arcosh} z+\\operatorname{artanh} z'), '\\operatorname{arsh} z+\\operatorname{arch} z+\\operatorname{arth} z', 'area functions');
  eq(I18N.notation('\\log z'), '\\ln z', 'ln');
  eq(I18N.notation('\\sin z+\\arcsin z+\\operatorname{Re} z+\\arg z+\\exp z'), '\\sin z+\\arcsin z+\\operatorname{Re} z+\\arg z+\\exp z', 'unchanged names');
  eq(I18N.notation('\\logo'), '\\logo', 'no partial command');
  eq(I18N.notation('\\log_2|F|'), '\\log_2|F|', 'log with a base stays log');
  eq(I18N.notation('\\lfloor\\log_2|f|\\rfloor'), '\\lfloor\\log_2|f|\\rfloor', 'phase bands: log_2 stays');
  eq(I18N.notation('\\log^2 z'), '\\ln^2 z', 'a power of log z is ln');
  eq(I18N.notation('\\coth\\bigl((1-t/2)\\operatorname{arcoth}z\\bigr)'), '\\operatorname{cth}\\bigl((1-t/2)\\operatorname{arcth}z\\bigr)', 'arcoth -> arcth, one notation per formula');
  eq(I18N.notation('\\operatorname{arccoth} z'), '\\operatorname{arcth} z', 'arccoth -> arcth');
  eq(I18N.fnName('arcoth'), 'arcth', 'plain arcth');
  eq(I18N.fnName('sinh'), 'sh', 'plain name');
  // decimal comma in Russian captions: numbers are formatted where they are made (i18n-7), never by a regex over
  // finished TeX; GLOSSARY 2.3: a semicolon in a bracket pair only when an endpoint is a decimal
  eq(`|F'(z)|=${I18N.texNum(0.5)}`, "|F'(z)|=0{,}5", 'decimal comma');
  eq(I18N.texNum('-1.25'), '-1{,}25', 'negative decimal');
  eq(I18N.texNum(2), '2', 'integer');
  eq(I18N.texNum('\\pi/2'), '\\pi/2', 'TeX passes through');
  eq(I18N.texInterval(-1, 1), '[-1,1]', 'integer interval keeps the comma (GLOSSARY 2.3, lead-2)');
  eq(I18N.texInterval('-\\pi/2', '3\\pi/2', '()'), '(-\\pi/2,3\\pi/2)', 'interval of multiples of pi keeps the comma');
  eq(I18N.texInterval('-\\pi', '\\pi', '(]'), '(-\\pi,\\pi]', 'half-open interval keeps the comma');
  eq(I18N.texInterval(0.5, 1), '[0{,}5;\\,1]', 'one decimal endpoint: semicolon');
  eq(I18N.texInterval(1.25, 0.5, '()'), '(1{,}25;\\,0{,}5)', 'point with decimals: semicolon');
  eq(`\\text{сетка } ${I18N.texInterval(-2, 2)}\\times${I18N.texInterval(-1.5, 1.5)}`, '\\text{сетка } [-2,2]\\times[-1{,}5;\\,1{,}5]', 'grid: each bracket decides alone');
  eq(I18N.texSep([-2, 2]) + ' ' + I18N.texSep([0.5, 2]), ', ;\\,', 'math.grid_math_min_math {sep}');
  eq(I18N.texNum('469.75') === '469{,}75' && I18N.at('en').texNum('469.75'), '469.75', 'a dimension is made by the English formatter, never rewritten');
  eq(`p=${I18N.texNum(1.25)}+${I18N.texNum(0.5)}i`, 'p=1{,}25+0{,}5i', 'complex number');
  eq(I18N.nums([0.5, 0.3]), '0,5; 0,3', 'i18n-14: two numbers on screen are joined by a semicolon');
  // Russian caption typography (i18n-11, GLOSSARY 3.6)
  eq(I18N.nbsp('образ в плоскости и круг с центром'), 'образ в\u00a0плоскости и\u00a0круг с\u00a0центром', 'no-break space after one-letter words');
  eq(I18N.nbsp('а — круг; б — образ'), 'а\u00a0— круг; б\u00a0— образ', 'no-break space before the em dash');
  eq(I18N.nbsp('Рис. 1. Образ'), 'Рис.\u00a01. Образ', 'Рис. and its number');
  eq(I18N.nbspTeX('а\u00a0— б'), 'а~— б', 'U+00A0 is ~ in LaTeX');
  // notation: residue, multivalued functions (i18n-8)
  eq(I18N.notation('\\operatorname{Res}_{z=i} F'), '\\operatorname{Res}_{z=i} F', 'Res stays Res (DESIGN.md 6, i18n-8)');
  eq(I18N.notation('\\operatorname{Im}\\log z', 'ru', { multi: true }), '\\operatorname{Im}\\operatorname{Ln} z', 'all sheets: Ln');
  eq(I18N.notation('\\arg z', 'ru', { multi: true }), '\\operatorname{Arg} z', 'all values: Arg');
  eq(I18N.notation('\\log_2|F|', 'ru', { multi: true }), '\\log_2|F|', 'multi: log_2 still stays');
  eq(I18N.notation('\\log z', 'en', { multi: true }), '\\log z', 'multi: English unchanged');
  eq(I18N.fnName('Res'), 'Res', 'plain Res stays');
  // robustness (i18n-19)
  eq(I18N.t('constructor'), 'constructor', 'a key such as constructor is not inherited');
  eq(I18N.tn('constructor', 'toString', 2), 'toString', 'tn on an inherited name');
  eq(JSON.stringify(I18N.parts('{n} shape', { n: 2 })), JSON.stringify([2, ' shape']), 'parts() on a key with no string entry');
  eq(I18N.quote('Точно'), '«Точно»', 'ёлочки');
  eq(I18N.num(0.85), '0,85', 'decimal comma on screen (GLOSSARY.md 5)');
});

// ---- 5. pseudo-localization ----
as('pseudo', () => {
  const src = 'Click the first vertex or press Enter to close';
  const p = I18N.t(src);
  const letters = (s) => (s.match(/[A-Za-zА-Яа-яЁё]/g) || []).length;
  ok(letters(p) >= letters(src) * 1.33, 'pseudo lengthens by about 35 %: ' + p);
  ok(/[Ж-ю]/.test(p), 'pseudo has Cyrillic');
  const hide = I18N.t('Hide');
  ok(letters(hide) >= 8, 'i18n-15: a short label doubles: ' + hide);
  ok(letters(I18N.t('Fit view')) >= Math.round(7 * 1.6), 'i18n-15: up to 20 letters, +60 %');
  eq(I18N.t('Saved {file}.', { file: 'a.png' }).includes('a.png'), true, 'pseudo keeps placeholders');
  ok(I18N.t('Key in the <i>w</i>-plane').includes('<i>w</i>'), 'pseudo keeps tags and their math');
  ok(I18N.t('\\text{a}').includes('\\text'), 'pseudo keeps TeX commands');
});

// ---- 6. keys on any layout ----
const K = I18N.keyOf;
eq(K({ key: 'я', code: 'KeyZ' }), 'z', 'ЙЦУКЕН Я is Z');
eq(K({ key: 'Я', code: 'KeyZ', shiftKey: true }), 'Z', 'Shift Я');
eq(K({ key: 'м', code: 'KeyV' }), 'v', 'М is V (Select)');
eq(K({ key: 'х', code: 'BracketLeft' }), '[', 'Х is [');
eq(K({ key: 'ъ', code: 'BracketRight' }), ']', 'Ъ is ]');
eq(K({ key: 'л', code: 'KeyK', metaKey: true }), 'k', '⌘Л is ⌘K');
eq(K({ key: 'a', code: 'KeyQ' }), 'a', 'AZERTY keeps its letters');
eq(K({ key: '?', code: 'Digit7', shiftKey: true }), '?', 'Russian ? on Shift 7');
eq(K({ key: '.', code: 'Slash' }), '.', 'Russian . on the slash key stays .');
eq(K({ key: 'Escape', code: 'Escape' }), 'Escape', 'named keys');
eq(K({ key: 'ж', code: 'Semicolon' }), ';', 'Ж is ;');
eq(K({ key: 'α', code: 'KeyA' }), 'a', 'Greek layout too');
// i18n-6: every letter shortcut on ЙЦУКЕН (tools, views, ⌘ keys, the export ⌘E, sound ⇧M and Z O D L)
const JC = { KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г', KeyI: 'ш', KeyO: 'щ', KeyP: 'з', KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о', KeyK: 'л', KeyL: 'д', KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь' };
for (const L of 'VPSLRCAFDBGOHNKTMZEY') {
  const code = 'Key' + L;
  eq(K({ key: JC[code], code }), L.toLowerCase(), `ЙЦУКЕН ${JC[code]} is ${L}`);
  eq(K({ key: JC[code].toUpperCase(), code, shiftKey: true }), L, `ЙЦУКЕН Shift ${JC[code]} is Shift ${L}`);
  eq(K({ key: JC[code], code, metaKey: true }), L.toLowerCase(), `ЙЦУКЕН ⌘${JC[code]} is ⌘${L}`);
}
eq(K({ key: 'б', code: 'Comma' }), ',', 'Б is ,');
eq(K({ key: 'ю', code: 'Period' }), '.', 'Ю is .');
// i18n-20: the palette key on ЙЦУКЕН-PC (the '/' key types '.')
ok(I18N.isPaletteSlash({ key: '/', code: 'Slash' }), 'US /');
ok(I18N.isPaletteSlash({ key: '.', code: 'Slash' }), 'ЙЦУКЕН-PC: the / key types . and opens the palette');
ok(!I18N.isPaletteSlash({ key: '.', code: 'Period' }), 'a real . key is not the palette');
ok(!I18N.isPaletteSlash({ key: '-', code: 'Slash' }), "QWERTZ '-' on that key keeps its meaning");
ok(!I18N.isPaletteSlash({ key: ',', code: 'Slash', shiftKey: true }), 'Shift is not the palette');

// ---- 6b. robustness, switching, async caption language ----
{
  const RU2 = Object.assign({}, RU_ALL, { 'Plural as plain {x}': { one: 'один %{x}', few: 'два {x}', many: 'много {x}', other: 'дробь {x}' } });
  I18N.load('ru', RU2);
  as('ru', () => eq(JSON.stringify(I18N.parts('Plural as plain {x}', { x: 7 })), JSON.stringify(['дробь ', 7]), 'i18n-19: parts() on a plural entry uses its other form'));
  I18N.load('ru', RU_ALL);
}
// i18n-3: no reload unless the setting and the work were both written and read back
{
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const silent = { getItem: () => null, setItem() {}, removeItem() {} };      // a store that drops writes
  let failed = null, saves = 0;
  I18N.onSwitch(() => { saves++; return true; }, (why) => { failed = why; });
  I18N._store(blocked);
  let r = I18N.setPref('ru');
  ok(!r.ok && !r.reload && failed === 'storage' && saves === 0, 'blocked storage: no reload, a note instead: ' + JSON.stringify(r));
  failed = null; I18N._store(silent);
  r = I18N.setPref('ru');
  ok(!r.ok && !r.reload && failed === 'storage', 'storage that drops writes: no reload');
  const m = mem(); failed = null; I18N._store(m);
  I18N.onSwitch(() => false, (why) => { failed = why; });
  r = I18N.setPref('ru');
  ok(!r.ok && failed === 'storage' && I18N.readPref() === 'auto', 'the work could not be saved: no reload, the setting rolls back');
  I18N.onSwitch(() => { saves++; return true; }, (why) => { failed = why; });
  failed = null; saves = 0;
  r = I18N.setPref('ru');
  ok(r.ok && r.reload && saves === 1 && I18N.readPref() === 'ru' && failed === null, 'storage works: save, then reload');
  r = I18N.setPref('en');
  ok(r.ok && !r.reload && I18N.readPref() === 'en', 'same language: the setting is written, no reload');
  I18N._store(null); I18N.onSwitch(null);
}
// i18n-9: an English caption built from a Russian interface stays English across awaits
const asyncChecks = async () => {
  I18N._setLang('ru');
  const C = I18N.at('en');
  await new Promise((r) => setTimeout(r, 5));
  const cap = [C.t('Figure {n}.', { n: 1 }), C.notation('w=\\tan z'), C.texInterval(0.5, 1), C.num(0.5), C.list(['a', 'b'])].join(' ');
  await Promise.resolve();
  eq(cap, 'Figure 1. w=\\tan z [0.5,1] 0.5 a and b', 'at(en) after awaits in a Russian UI');
  ok(!/[А-яЁё]/.test(cap) && !/tg/.test(cap), 'no Cyrillic and no tg in the English caption');
  const R2 = I18N.at('ru');
  await new Promise((r) => setTimeout(r, 5));
  I18N._setLang('en');
  eq([R2.t('Figure {n}.', { n: 1 }), R2.notation('w=\\tan z'), R2.texNum(0.5)].join(' '), 'Рис. 1. w=\\operatorname{tg} z 0{,}5', 'at(ru) after awaits in an English UI');
};

// ---- 7. the parser accepts both spellings (src/parse.js) ----
global.CX = require(path.join(XL, 'cx.js'));
const Expr = require(path.join(XL, 'parse.js'));
const C = CX.C, z0 = C(0.3, 0.7);
const val = (s, o) => CX.fmt(Expr.compile(Expr.parse(s, o))(z0), 9);
const pairs = [
  ['tg z', 'tan z'], ['ctg z', 'cot z'], ['sh z', 'sinh z'], ['ch z', 'cosh z'], ['th z', 'tanh z'], ['cth z', 'coth z'],
  ['arctg z', 'arctan z'], ['arsh z', 'asinh z'], ['arch(z+2)', 'acosh(z+2)'], ['arth z', 'atanh z'], ['cosec z', 'csc z'],
  ['\\tg z', '\\tan z'], ['\\ctg z', '\\cot z'], ['\\sh z', '\\sinh z'], ['\\ch z', '\\cosh z'], ['\\th z', '\\tanh z'],
  ['\\cth z', '\\coth z'], ['\\arctg z', '\\arctan z'], ['\\cosec z', '\\csc z'], ['\\operatorname{tg} z', '\\tan z'],
  ['\\operatorname{arsh} z', '\\operatorname{arsinh} z'], ['\\operatorname{sh}^2 z-\\operatorname{ch}^2 z', '-1'],
  ['ln z', 'log z'], ['2 sh z ch z', 'sinh(2z)'], ['tg^2 z + 1', '1/cos(z)^2'],
];
for (const [a, b] of pairs) {
  try { eq(val(a), val(b), `parser: ${a} = ${b}`); } catch (e) { ok(false, `parser ${a}: ${e.message}`); }
}
// the English names keep their meaning (theta, cosh, arccosh, arcsinh, sech is still unknown)
for (const [a, b] of [['theta', 'arg(z)'], ['cosh z', '(e^z+e^-z)/2'], ['arccosh(z+2)', 'acosh(z+2)'], ['arcsinh z', 'asinh z'], ['\\theta', 'arg z']]) {
  try { eq(val(a), val(b), `parser keeps ${a}`); } catch (e) { ok(false, `parser keeps ${a}: ${e.message}`); }
}
// i18n-8: Ln is the principal logarithm when typed (as Log); lg, arcctg, arccot and acot get a specific message in
// Russian; i18n-14: a decimal comma gets a hint in Russian. English messages are unchanged.
eq(val('Ln z'), val('log z'), 'parser: Ln z = log z (principal branch)');
eq(val('\\operatorname{Ln} z'), val('log z'), 'parser: \\operatorname{Ln}');
const perr = (s, o) => { try { Expr.parse(s, o); return 'ok'; } catch (e) { return e.message; } };
eq(perr('lg z'), "Unknown symbol 'l'", 'English message unchanged: lg');
eq(perr('arcctg z'), "Unknown symbol 'a'", 'English message unchanged: arcctg');
eq(perr('z^0,5'), "Unexpected ','", 'English message unchanged: 0,5');
as('ru', () => {
  ok(/Десятичного логарифма lg/.test(perr('lg z')), 'ru: lg message ' + perr('lg z'));
  for (const s of ['arcctg z', 'arccot z', 'acot z', '\\operatorname{arcctg} z']) ok(/здесь нет: пишите arctg\(1\/z\)/.test(perr(s)), 'ru: message for ' + s + ': ' + perr(s));
  ok(/отделяйте точкой/.test(perr('z^0,5')) && /отделяйте точкой/.test(perr('0,5*z')), 'ru: decimal comma hint');
  eq(perr('sin('), 'Выражение не закончено', 'ru: a parse message in Russian');
  eq(perr('q'), 'Неизвестный символ «q»', 'ru: placeholders in a Russian message');
  eq(perr('|z|<1, Re z>0', { allowRel: true }), 'ok', 'ru: a comma between conditions still works');
  eq(perr('arccos z'), 'ok', 'ru: arccos still parses');
});
let threw = false;
try { Expr.parse('sech z'); } catch (e) { threw = true; }
ok(threw, 'sech is still unknown');
ok(Expr.toTex(Expr.parse('tg z')).s.includes('\\tan'), 'the generator stays English: tg z prints as \\tan z (I18N.notation turns it back)');

// phase 2a: Russian TeX reads back. The decimal comma (CX.texNum in Russian: 0{,}5) and the words for or, and, not
// (I18N.notation writes \text{или}) parse in either language; before, each was an error, so no formula changed.
eq(val('0{,}5z'), val('0.5z'), 'parser: 0{,}5 is 0.5');
eq(val('z^{1{,}25}+2{,}5'), val('z^{1.25}+2.5'), 'parser: decimal commas in an exponent and a sum');
eq(perr('0{,}z'), "Unexpected ','", 'a comma group without digits after it is still the same error');
const lvl = (s, z) => Expr.compileLevel(Expr.parse(s, { allowRel: true }))(z);
for (const z of [C(0, 0), C(2, 0), C(5, 0), C(1, 0.5)]) {
  eq(lvl('|z|<1\\ \\text{или}\\ |z-2|<1', z), lvl('|z|<1\\ \\text{or}\\ |z-2|<1', z), 'parser: \\text{или} is or at ' + CX.fmt(z));
  eq(lvl('|z|<2\\ \\text{и}\\ \\text{не}(|z|<1)', z), lvl('|z|<2 and not(|z|<1)', z), 'parser: \\text{и}, \\text{не} at ' + CX.fmt(z));
}
eq(I18N.notation('|z|<1\\ \\text{or}\\ |z-2|<1', 'ru'), '|z|<1\\ \\text{или}\\ |z-2|<1', 'notation: or in a region formula');
eq(I18N.notation(I18N.notation('\\tanh z+\\log z+\\operatorname{arcoth} z\\ \\text{or}', 'ru'), 'ru'), I18N.notation('\\tanh z+\\log z+\\operatorname{arcoth} z\\ \\text{or}', 'ru'), 'notation is idempotent (TeX.set and the caption code may both apply it)');
for (const t of ['\\operatorname{tg} z', '\\operatorname{th} z+\\ln z', '\\operatorname{ctg} z\\cdot\\operatorname{cth} z']) eq(perr(t), 'ok', 'Russian notation from I18N.notation parses: ' + t);
// arcoth appears only in the Joukowski captions; the formula language has no arcoth in either spelling
eq(perr('\\operatorname{arcth}(z+2)'), "Unknown name 'arcth'", 'arcth: no inverse coth in the formula language');
eq(perr('\\operatorname{arcoth}(z+2)'), "Unknown name 'arcoth'", 'arcoth: the same in English');
eq(val(I18N.notation('\\tan z+\\sinh z-\\operatorname{artanh}(z/2)', 'ru')), val('\\tan z+\\sinh z-\\operatorname{artanh}(z/2)'), 'notation keeps the value');
// the language is fixed at load: $t in a module is the identity in English, and every key's English is itself
eq(I18N.lang, 'en', 'English after the checks');
eq(I18N.texDecimal(0.5, 'ru'), '0{,}5', 'texDecimal is texNum');

// region TeX in Russian: every number has the decimal comma (num() and fmt() alike), and the grid's interval takes the
// semicolon when an end is a decimal (GLOSSARY 2.3). One shape of each kind; display only (saved work keeps srcTex).
{
  const vm = require('vm');
  const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout, Intl };
  vm.createContext(ctx);
  const NAMES = { cx: 'CX', parse: 'Expr', region: 'Region' };
  for (const f of ['i18n', 'i18n_ru', 'cx', 'parse', 'region']) {
    vm.runInContext(fs.readFileSync(path.join(XL, f + '.js'), 'utf8') + (NAMES[f] ? `\n;globalThis.${NAMES[f]} = ${NAMES[f]};` : ''), ctx, { filename: f + '.js' });
    if (f === 'i18n_ru') vm.runInContext("I18N._setLang('ru')", ctx);
  }
  const a = [-0.5, 0.25], b = [1, 1.25], c = [0.5, 0.25];
  const shapes = {
    point: { p: a }, segment: { a, b }, line: { a, b }, ray: { a, b }, circle: { c, r: 1.5 }, arc: { a, m: [0.25, 1.5], b },
    curve: { pts: [a, b, c] }, cgrid: { a, b, n: 8 }, pgrid: { c: [0.5, 0], r: 1.5, nc: 6, nr: 12 }, disc: { c, r: 1.5 },
    rect: { a, b }, polygon: { pts: [a, b, c] }, halfplane: { a: [0, 0.5], b: [-1, 0.5] }, annulus: { c, r1: 0.75, r2: 1.5 },
    sector: { c: [0.5, 0], r: 2.5, t1: 22.5, t2: 60 }, formula: { expr: '|z-1|<2' }, fcurve: { expr: 'e^{it}' },
    hline: { kind: 'line', a: [0, 0.5], b: [1, 0.5] },
  };
  const kinds = Object.keys(ctx.Region.KINDS);
  for (const k of kinds) ok(Object.prototype.hasOwnProperty.call(shapes, k), 'region check covers the kind ' + k);
  for (const [name, sh] of Object.entries(shapes)) {
    const kind = sh.kind || name;
    let tex;
    try { tex = ctx.Region.KINDS[kind].tex(Object.assign({ kind }, sh)); } catch (e) { tex = 'THROW ' + e.message; }
    ok(!/\d\.\d/.test(tex) && !/THROW/.test(tex), `region ${name} in Russian: no decimal point: ${tex}`);
  }
  const tx = (sh) => ctx.Region.KINDS[sh.kind].tex(sh);
  eq(tx({ kind: 'cgrid', a, b, n: 8 }), '\\text{сетка } [-0{,}5;\\,1]\\times[0{,}25;\\,1{,}25]', 'region: the grid in Russian');
  eq(tx({ kind: 'cgrid', a: [-1, -1], b: [1, 2], n: 8 }), '\\text{сетка } [-1,1]\\times[-1,2]', 'region: a grid of integers keeps the comma');
  eq(tx({ kind: 'pgrid', c: [0.5, 0], r: 1.5, nc: 6, nr: 12 }), as('ru', () => I18N.t('\\text{polar grid}, |%{c}|\\le %{r}', { c: 'z-0{,}5', r: '1{,}5' })), 'region: the polar grid in Russian');
  // a formula's TeX is the reader's own formula printed back by Expr.toTex, which stays English (it feeds saved work and
  // the copied LaTeX): '|z-0.5|<1.5' typed is shown with its point
  eq(tx({ kind: 'formula', expr: '|z-0.5|<1.5' }), '\\left|z-0.5\\right| < 1.5', 'region: a typed formula is shown as typed');
  eq(tx({ kind: 'disc', c: [0, 0], r: 1.5e-4 }), '|z|<1{,}5×10⁻⁴', 'region: the mantissa of a small radius');
  vm.runInContext("I18N._setLang('en')", ctx);
  eq(tx({ kind: 'cgrid', a, b, n: 8 }), '\\text{grid } [-0.5,1]\\times[0.25,1.25]', 'region: the grid in English');
  eq(tx({ kind: 'disc', c, r: 1.5 }), '|z-(0.5+0.25i)|<1.5', 'region: a disc in English');
}
// ---- 8. phase 2b: detection on, the decimal-comma hint, the leftovers table ----
eq(I18N._autoDetect, true, 'phase 2b: a Russian browser gets Russian (AUTO_DETECT on)');
eq(I18N._resolve({ nav: nav(['ru-RU', 'en']) }), 'ru', 'phase 2b: ru-RU resolves to Russian');
{
  const msg = (src, lang) => as(lang, () => { try { Expr.parse(src); return null; } catch (e) { return e.message; } });
  const HINT = as('ru', () => I18N.t('Use a decimal point: 0.5'));
  eq(HINT, 'Дробную часть отделяйте точкой: 0.5', 'the hint in Russian');
  for (const src of ['0,5', 'sin(0,5z)', 'z^0,5', '2,5+i', 'e^{0,5z}']) ok((msg(src, 'ru') || '').includes(HINT), `ru: "${src}" gets the decimal-point hint: ${msg(src, 'ru')}`);
  ok(/\. Дробную часть отделяйте точкой: 0\.5$/.test(msg('sin(0,5z)', 'ru')), 'ru: the hint follows the message after a full stop: ' + msg('sin(0,5z)', 'ru'));
  eq((msg('0,5', 'ru').match(/Дробную часть/g) || []).length, 1, 'ru: the hint is said once');
  eq(msg('sin(z', 'ru'), 'Ожидалось «)»', 'ru: no hint without a decimal comma');
  for (const src of ['0,5', 'sin(0,5z)', 'z^0,5']) ok(!/decimal point/.test(msg(src, 'en') || '') && msg(src, 'en') === msg(src, 'en'), `en: "${src}" keeps the base message: ${msg(src, 'en')}`);
  eq(msg('0,5', 'en'), "Unexpected ','", 'en: 0,5 keeps its English message');
  eq(Expr.parse('|z|<1, 0<\\Im z', { allowRel: true }) != null, true, 'a comma between conditions still parses');
}
{
  const LO = JSON.parse(fs.readFileSync(path.join(__dirname, '../notes/i18n/ru/phase2b-leftovers.json'), 'utf8'));
  let n = 0;
  for (const [id, v] of Object.entries(LO)) {
    if (id.startsWith('_')) continue;
    n++;
    const key = (v.ctx ? v.ctx + '\u0004' : '') + v.en;
    eq(RU_ALL[key], v.ru, 'leftover ' + id + ' shipped');
    ok(Object.prototype.hasOwnProperty.call(RU, key) || ['audio'].includes(v.ctx), 'leftover ' + id + ' has a call site in src/');
  }
  ok(n >= 20, 'leftovers: ' + n);
  // the strings phase 2b wrapped (they were left in English): each is in the shipped table
  for (const k of ['Display options', 'Reset camera', 'Snap while drawing', 'Bypass this step', 'guaranteed', 'not guaranteed', 'Theme: {name}', 'Log-polar', 'Pause', 'Play', 'Show', 'Hide',
    'Radii must be 0 or more', 'Use a whole number from 1 to 60', 'Half-strip to half-plane', 'Principal branch', 'WebGL2 is unavailable, so regions cannot be drawn', 'Domain plane', 'Image plane']) ok(Object.prototype.hasOwnProperty.call(RU_ALL, k), 'phase 2b wrapped string in the table: ' + k);
}
// ---------------- phase 2b review fixes (notes/i18n/ledger-2b.json) ----------------
{
  // english-1: only a non-Latin letter typed without Alt falls back to the physical key
  const k = (key, code, o) => I18N.keyOf(Object.assign({ key, code }, o || {}));
  eq(k('я', 'KeyZ'), 'z', 'keyOf: ЙЦУКЕН я is z'); eq(k('х', 'BracketLeft'), '[', 'keyOf: х is [');
  eq(k('å', 'BracketLeft'), 'å', 'keyOf: Swedish å keeps its key'); eq(k('ü', 'BracketLeft'), 'ü', 'keyOf: German ü keeps its key');
  eq(k('ł', 'KeyK', { altKey: true, ctrlKey: true }), 'ł', 'keyOf: AltGr+K (ł) keeps its key'); eq(k('ż', 'KeyZ', { altKey: true, ctrlKey: true }), 'ż', 'keyOf: AltGr+Z (ż) keeps its key');
  eq(k('Ω', 'KeyZ', { altKey: true, metaKey: true }), 'Ω', 'keyOf: Option+Z keeps its key'); eq(k('л', 'KeyK', { ctrlKey: true }), 'k', 'keyOf: Ctrl+Л is k');
  // ui-1, ui-6, math-10, math-18: region formulas in Russian
  const rel = (src, lang) => as(lang, () => { try { const a = Expr.parse(src, { allowRel: true }); return Expr.toTex(a).s; } catch (e) { return 'ERR ' + e.message; } });
  for (const src of ['|z| < 0,5', 'Re z > 0,5', 'z^0,5 < 1']) ok(/^ERR Дробную часть отделяйте точкой/.test(rel(src, 'ru')), `ru: region "${src}" gets the decimal-point hint: ${rel(src, 'ru')}`);
  for (const src of ['Re z<1,0<Im z', '|z|<1, Re z>0', '1,0,-1,0']) eq(rel(src, 'ru'), rel(src, 'en'), `ru: "${src}" reads as in English`);
  eq(rel('|z|<1 и Re z>0', 'ru'), rel('|z|<1 and Re z>0', 'ru'), 'ru: и is and');
  eq(rel('Re z>0 или Im z<1', 'ru'), rel('Re z>0 or Im z<1', 'ru'), 'ru: или is or');
  eq(rel('не |z|<1', 'ru'), rel('not |z|<1', 'ru'), 'ru: не is not');
  // verify-5: a comma between digits still read as two conditions gives a note (Russian only), never a change of meaning
  const relNote = (src, lang) => as(lang, () => { const notes = []; try { Expr.parse(src, { allowRel: true, notes }); } catch (e) { return 'ERR ' + e.message; } return notes.join('|'); });
  for (const src of ['Re z>0,5<|z|', 'Re z<1,0<Im z']) { ok(/^Запятая между цифрами разделяет условия/.test(relNote(src, 'ru')), `verify-5: "${src}" gets the note: ${relNote(src, 'ru')}`); eq(rel(src, 'ru'), rel(src, 'en'), `verify-5: "${src}" still reads as in English`); eq(relNote(src, 'en'), '', `verify-5: English "${src}": no note`); }
  for (const src of ['|z|<1, Re z>0', '|z|<1 и Re z>0', 'Re z > 0.5']) eq(relNote(src, 'ru'), '', `verify-5: "${src}": no note`);
  // verify-6: a misplaced word is named as typed, not by its English meaning
  for (const [src, w] of [['и |z|<1', 'и'], ['или', 'или'], ['Re z>0 или или Im z<0', 'или']]) ok(rel(src, 'ru').includes('«' + w + '»') && !/«(and|or|not)»/.test(rel(src, 'ru')), `verify-6: "${src}" names «${w}»: ${rel(src, 'ru')}`);
  eq(rel('and |z|<1', 'en'), "ERR Unexpected 'and'", 'verify-6: English names and as before');
  // math-1: list fields in Russian
  let Funcs = null;
  try { global.Expr = Expr; Funcs = require(path.join(XL, 'funcs.js')); } catch (e) { ok(false, 'funcs.js loads: ' + e.message); }
  if (Funcs) {
    // typed: the text was typed into the field (the card registers it with Funcs.typedList); else it was loaded
    const zp = (zeros, lang, typed) => as(lang, () => { const st = { type: 'zp', params: { a: '1', zeros, poles: '2' } }; if (typed) Funcs.typedList(st, 'zeros', zeros); const r = Funcs.build(st); return r.error ? 'ERR ' + r.error : r.tex({ s: 'z', p: 4 }).s; });
    ok(/^ERR.*Дробную/.test(zp('0,5, -1', 'ru', true)), 'ru: typed zeros "0,5, -1" is refused, not read as 0, 5, -1: ' + zp('0,5, -1', 'ru', true));
    eq(zp('0,5; -1', 'ru', true), zp('0.5, -1', 'ru'), 'ru: typed zeros "0,5; -1" are 0.5 and -1');
    eq(zp('0,5, -1', 'en', true), zp('0, 5, -1', 'en'), 'en: zeros "0,5, -1" read as before');
    // verify-1: a saved list reads the same in both languages (a language switch keeps the work)
    for (const [src, same] of [['1,0.5', '1, 0.5'], ['0,5; -1', '0.5, -1'], ['1,0,1', '1, 0, 1'], ['(1+i)/2; 0,25i', '(1+i)/2, 0.25i']]) {
      const r = zp(same, 'en');
      ok(!/^ERR/.test(r), `verify-1: "${same}" builds: ${r}`);
      eq(zp(src, 'en'), r, `verify-1: saved zeros "${src}" in English`);
      eq(zp(src, 'ru'), zp(same, 'ru'), `verify-1: saved zeros "${src}" in Russian`);
    }
    const poly = (co, lang, typed) => as(lang, () => { const st = { type: 'poly', params: { co } }; if (typed) Funcs.typedList(st, 'co', co); const r = Funcs.build(st); return r.error ? 'ERR ' + r.error : r.tex({ s: 'z', p: 4 }).s; });
    eq(poly('1,0,1', 'ru'), poly('1,0,1', 'en'), 'verify-1: saved coefficients "1,0,1" read as in English after a switch to Russian');
    ok(/^ERR.*Дробную/.test(poly('1,0,1', 'ru', true)), 'verify-1: coefficients typed "1,0,1" in Russian get the hint: ' + poly('1,0,1', 'ru', true));
    eq(poly('1,0,1', 'en', true), poly('1, 0, 1', 'en'), 'verify-1: typing in English is never checked');
    eq(poly('0,5; 1', 'en'), poly('0.5, 1', 'en'), 'verify-1: saved Russian coefficients "0,5; 1" read in English');
    // an undo restores copies of the steps (app.js restore -> Funcs.typedKeep): a text typed and refused stays refused
    as('ru', () => {
      const a = { type: 'poly', params: { co: '1,5' } };
      Funcs.typedList(a, 'co', '1,5'); a.params.co = '1.5'; Funcs.typedList(a, 'co', '1.5');
      ok(!Funcs.build(a).error, 'verify-1: the corrected text builds');
      const b = { type: 'poly', params: { co: '1,5' } }; Funcs.typedKeep([a], [b]);
      ok(/Дробную/.test(Funcs.build(b).error || ''), 'verify-1: an undo back to the refused text keeps the hint');
      const c = { type: 'poly', params: { co: '1,0,1' } }; Funcs.typedKeep([a], [c]);
      ok(!Funcs.build(c).error, 'verify-1: an undo to a text never typed reads by the common rule');
      const d = { type: 'zp', params: { a: '1', zeros: '1,5', poles: '' } }; Funcs.typedKeep([a], [d]);
      ok(!Funcs.build(d).error, 'verify-1: a step of another type at that place is not carried');
    });
    as('en', () => { const e = { type: 'poly', params: { co: '1,5' } }; Funcs.typedList(e, 'co', '1,5'); ok(!Funcs.build(e).error, 'verify-1: English typing is never refused'); });
  }
  // ui-12, ui-14: the table's typography
  let dash = 0, unit = 0;
  for (const [k, v] of Object.entries(RU_ALL)) for (const x of typeof v === 'string' ? [v] : Object.values(v)) { if (/[^\s~\u00a0] —/.test(x)) { dash++; if (dash < 4) console.log('  dash:', k.slice(0, 60)); } if (/[\d}] (см|мм|пт|дюйм|dpi|Гц|мс|мин)(?![0-9A-Za-zА-Яа-яЁё])/.test(x)) unit++; }
  eq(dash, 0, 'Russian: a no-break space before every em dash');
  // every review fix is shipped (notes/i18n/ru/phase2b-fixes.json wins over the other tables)
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '../notes/i18n/ru/phase2b-fixes.json'), 'utf8'));
  for (const [id, v] of Object.entries(FX)) if (!id.startsWith('_')) eq(RU_ALL[(v.ctx ? v.ctx + '\u0004' : '') + v.en], v.ru, 'review fix ' + id + ' shipped');
  eq(unit, 0, 'Russian: a no-break space between a number and its unit');
}
asyncChecks().then(() => {
  console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks pass`);
  process.exit(fails ? 1 : 0);
});

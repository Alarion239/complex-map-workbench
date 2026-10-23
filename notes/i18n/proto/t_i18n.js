// node notes/i18n/proto/t_i18n.js : the i18n module, the Russian table, the parser's Russian names
'use strict';
const fs = require('fs');
const path = require('path');
const I18N = require('./i18n.js');
const RU = JSON.parse(fs.readFileSync(path.join(__dirname, 'ru.json'), 'utf8'));
const XL = path.resolve(__dirname, '../../../work/xl/src');
I18N.load('ru', RU);

let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('FAIL', msg); } };
const eq = (a, b, msg) => ok(a === b, `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const as = (l, fn) => I18N.using(l, fn);

// ---- 1. the language ----
const R = I18N._resolve;
const nav = (langs, language) => ({ languages: langs, language });
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
  for (const f of forms(v)) {
    ok(f.trim().length > 0, 'empty translation ' + k);
    eq(toks(f, PH), toks(src, PH), 'placeholders/TeX groups of ' + k);
    eq(toks(f, TAG), toks(src, TAG), 'tags of ' + k);
    eq(toks(f, CMD), toks(src, CMD), 'TeX commands of ' + k);
    eq(toks(f, MATH), toks(src, MATH), 'inline math of ' + k);
    ok(!/^\s|\s$/.test(f) || /^\s|\s$/.test(src), 'stray space in ' + k);
    // no English left: drop math, tags with their math content, placeholders, TeX; then allow key names, formats,
    // the brand, autonyms and the formula keywords shown in <i>
    const ALLOW = new Set(['Enter', 'Esc', 'Shift', 'Delete', 'Tab', 'Ctrl', 'Alt', 'Space', 'LaTeX', 'TeX', 'PDF', 'PNG', 'SVG', 'English', 'Complex', 'Map', 'Workbench', 'Re', 'Im', 'arg', 'ln', 'tg', 'ctg', 'sh', 'ch', 'th', 'cth', 'arctg', 'arsh', 'arch', 'arth', 'cosec']);
    const rest = f.replace(MATH, ' ').replace(/<(i|var|sub|sup|kbd)>.*?<\/\1>/g, ' ').replace(/<[^>]*>/g, ' ').replace(PH, ' ').replace(/\\[A-Za-z]+(\{[^}]*\})?/g, ' ');
    const latin = (rest.match(/[A-Za-z]{2,}/g) || []).filter((w) => !ALLOW.has(w));
    ok(latin.length === 0, `English left in ${JSON.stringify(f)}: ${latin.join(', ')}`);
    ok(!/[a-zA-Z][а-яё]|[а-яё][a-zA-Z]/i.test(rest), 'mixed-script word in ' + f);
  }
}
// every string of the static page has a translation (what the walker will look up)
const page = fs.readFileSync(path.join(XL, 'page.html'), 'utf8');
let body = page.slice(page.indexOf('<div id="app">')).replace(/<!--[\s\S]*?-->/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '');
body = body.replace(/<h1 class="wordmark" data-i18n="no">[\s\S]*?<\/h1>/, '');
const keys = new Set();
body = body.replace(/<span data-i18n="html">([\s\S]*?)<\/span>/g, (m, inner) => { keys.add(inner.trim()); return ''; });
for (const m of body.matchAll(/>([^<>]*)</g)) { const s = m[1].trim(); if (/[A-Za-z]{2,}/.test(s)) keys.add(s); }
for (const m of body.matchAll(/(?:title|aria-label|placeholder|data-tip)="([^"]*)"/g)) { const s = m[1].split('  ')[0].trim(); if (/[A-Za-z]{2,}/.test(s)) keys.add(s); }
for (const k of keys) ok(Object.prototype.hasOwnProperty.call(RU, k), 'page.html string without a translation: ' + k);
ok(keys.size >= 80, 'page.html strings found: ' + keys.size);

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
  eq(I18N.notation('\\operatorname{Res}_{z=i} F'), '\\operatorname{Res}_{z=i} F', 'Res stays (GLOSSARY 1.4)');
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
  const RU2 = Object.assign({}, RU, { 'Plural as plain {x}': { one: 'один %{x}', few: 'два {x}', many: 'много {x}', other: 'дробь {x}' } });
  I18N.load('ru', RU2);
  as('ru', () => eq(JSON.stringify(I18N.parts('Plural as plain {x}', { x: 7 })), JSON.stringify(['дробь ', 7]), 'i18n-19: parts() on a plural entry uses its other form'));
  I18N.load('ru', RU);
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

// ---- 7. the parser accepts both spellings (work/xl/src/parse.js) ----
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
const ruMsgs = new Set();
as('ru', () => {
  ok(/base-10/.test(perr('lg z')), 'ru: lg message ' + perr('lg z'));
  for (const s of ['arcctg z', 'arccot z', 'acot z', '\\operatorname{arcctg} z']) ok(/not available/.test(perr(s)), 'ru: message for ' + s);
  ok(/decimal point/.test(perr('z^0,5')) && /decimal point/.test(perr('0,5*z')), 'ru: decimal comma hint');
  eq(perr('|z|<1, Re z>0', { allowRel: true }), 'ok', 'ru: a comma between conditions still works');
  eq(perr('arccos z'), 'ok', 'ru: arccos still parses');
  // review i18n-14: no formula hint for the arc-cotangent (arctg(1/z) is wrong for Re z < 0 under arcctg x in (0, pi))
  for (const s of ['arcctg z', 'arccot z', 'acot z']) ok(!/arctg\(|arctan\(|write/.test(perr(s)), 'ru: no formula hint for ' + s);
  for (const s of ['arcctg z', 'arccot z', 'acot z', 'lg z', 'z^0,5']) ruMsgs.add(perr(s));
});
// review i18n-14: every message the engineering round added has its Russian, keyed on the exact English
{
  const CH = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ru', 'chrome.json'), 'utf8'));
  const byEn = new Map(Object.values(CH).filter((v) => v && v.en).map((v) => [v.en, v.ru]));
  const msgs = [...ruMsgs];
  msgs.push('The language cannot change: this browser blocks site storage, and a reload would lose your work.');
  for (const m of msgs) ok(byEn.has(m) && /[а-яё]/i.test(byEn.get(m)), 'Russian for the new message: ' + m);
  const full = JSON.parse(fs.readFileSync(path.join(XL, 'ru_full.json'), 'utf8'));
  for (const m of msgs) ok(typeof full[m] === 'string', 'ru_full.json has: ' + m);
}
let threw = false;
try { Expr.parse('sech z'); } catch (e) { threw = true; }
ok(threw, 'sech is still unknown');
ok(Expr.toTex(Expr.parse('tg z')).s.includes('\\tan'), 'the generator stays English: tg z prints as \\tan z (I18N.notation turns it back)');

asyncChecks().then(() => {
  console.log(fails ? `${fails} of ${checks} checks FAILED` : `all ${checks} checks pass`);
  process.exit(fails ? 1 : 0);
});

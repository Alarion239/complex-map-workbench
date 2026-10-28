// Hear the function in Russian and Italian (perfwin/sound/impl/SOUND-PLAN.md 5.4): every text of the sound popover
// (page.html #sndPop, translated by its exact English at load: I18N.applyStatic), its attributes, every $t string of
// the sound glue in src/app.js (the block from "---- Hear the function under the pointer" to the keyboard probe's
// end) and every string of the tour's Sound chapter has an entry in both tables, with the same placeholders.
//   node test/t_i18n_it_sound.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const table = (f, lang) => {
  const m = read(f).match(new RegExp(`I18N\\.define\\('${lang}', ("(?:[^"\\\\]|\\\\.)*")\\);`));
  return JSON.parse(JSON.parse(m[1]));
};
const RU = table('src/i18n_ru.js', 'ru'), IT = table('src/i18n_it.js', 'it');
let n = 0;
const fails = [];
const ok = (name, cond, got) => { n++; if (!cond) fails.push({ name, got }); };
const phs = (s) => (String(s).match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) || []).sort().join(',');
const check = (where, key) => {
  for (const [lang, T] of [['ru', RU], ['it', IT]]) {
    const v = T[key];
    ok(`${lang}: ${where}: ${key.slice(0, 70)}`, typeof v === 'string' || (v && typeof v === 'object'), v);
    if (typeof v === 'string' && !/[$\\]/.test(key)) ok(`${lang}: placeholders of ${key.slice(0, 50)}`, phs(v) === phs(key), [phs(key), phs(v)]);
  }
};

// 1. the popover's static texts, attributes and its one data-i18n="html" sentence
const page = read('src/page.html');
const pop = page.slice(page.indexOf('<div class="snd-pop" id="sndPop"'), page.indexOf('<div id="sndLive"'));
ok('the popover is found', pop.length > 500, pop.length);
const html = pop.match(/<span data-i18n="html">([\s\S]*?)<\/span><\/small>/);
ok('the Hear the function description is one html key', !!html);
if (html) check('popover html', html[1].trim());
const bare = pop.replace(/<span data-i18n="html">[\s\S]*?<\/span><\/small>/, '</small>');
for (const m of bare.matchAll(/>([^<>]+)</g)) {
  const k = m[1].trim();
  if (!k || !/[A-Za-z]{2,}/.test(k) || /^Audio engine: not started$/.test(k)) continue;
  check('popover text', k);
}
for (const m of bare.matchAll(/(?:aria-label|title)="([^"]+)"/g)) if (/[A-Za-z]{2,}/.test(m[1])) check('popover attribute', m[1]);
for (const id of ['sndNotes', 'sndGlide', 'sndGlideNo']) ok(`the popover has #${id}`, pop.includes(`id="${id}"`));

// 2. the sound glue's own strings
const app = read('src/app.js');
const a0 = app.indexOf('// ---- Hear the function under the pointer ----'), a1 = app.indexOf('// ---------------- guided tour');
ok('the sound glue is found', a0 > 0 && a1 > a0, [a0, a1]);
const glue = app.slice(app.indexOf('// ---------------- sound ('), a1);
const unq = (q, s) => (q === "'" ? s.replace(/\\'/g, "'") : s);
let sites = 0;
for (const m of glue.matchAll(/\$t\((['`])((?:\\.|(?!\1).)*?)\1/g)) { sites++; check('app.js $t', unq(m[1], m[2])); }
for (const m of glue.matchAll(/\$tn\('((?:\\.|[^'])*)', '((?:\\.|[^'])*)'/g)) { sites++; check('app.js $tn', m[1] + '\u0004' + m[2]); }
ok('the glue has its strings', sites > 60, sites);
for (const k of ['Hear the function: notes', 'Hear the function: glide', 'Hear the function: notes.', 'Hear the function: glide.', 'Glide needs a browser with AudioWorklet.', 'Branch cut: F jumps by a factor {factor}.', 'Play the composition (Grieg, arranged on this curve)', 'Listening along at {speed} pixels a second: the curve is too long or too short for 250.']) {
  ok(`the glue says ${k}`, glue.includes(k) || app.includes(k));
  check('named', k);
}

// 3. the tour's Sound chapter
const tour = read('src/tour.js');
const t0 = tour.indexOf("id: 'sound', title: 'Sound'"), t1 = tour.indexOf('\n    },\n    {', t0);
ok('the tour chapter is found', t0 > 0 && t1 > t0, [t0, t1]);
const ch = tour.slice(t0, t1);
for (const m of ch.matchAll(/(?:title|body|touch|narrow|lead|text|off|then): '((?:\\.|[^'])*)'/g)) {
  const k = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  if (/[A-Za-z]{2,}/.test(k)) check('tour', k);
}
for (const m of tour.matchAll(/name: '(Phase lines)'/g)) check('tour scene', m[1]);

if (fails.length) { for (const f of fails.slice(0, 30)) console.log('FAIL', f.name, JSON.stringify(f.got === undefined ? null : f.got).slice(0, 160)); }
console.log(fails.length ? `${fails.length} of ${n} checks FAILED` : `all ${n} sound i18n checks pass`);
process.exitCode = fails.length ? 1 : 0;

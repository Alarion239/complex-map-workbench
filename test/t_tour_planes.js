// The steps view's tour chapter "Planes" and its words (#442): its eight steps, each with its body, its task for the desk and for
// touch, and the event that closes it; every string has an entry in the Russian and the Italian table with the same maths and
// key tokens ($..$, {C}); the placing the steps ask of the app (svPlace) and the anchors they point at are known; and the steps view's
// words that are $t strings in src/ (the plane's title past the colour plane, the dot's "Go to w₁", the key line) have both
// languages too.   node test/t_tour_planes.js
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
const { Tour } = require('../src/tour.js');
const T = Tour._t;
let n = 0;
const fails = [];
const ok = (name, cond, got) => { n++; if (!cond) fails.push({ name, got }); };
const maths = (s) => (String(s).match(/\$[^$]+\$/g) || []).join('|');
const keys = (s) => (String(s).match(/\{[A-Za-z+]\}/g) || []).join('|');
const phs = (s) => (String(s).match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) || []).sort().join(',');

const P = T.PLANES;
ok('the chapter is there', !!P && P.id === 'planes', P && P.id);
ok('eight steps, in the spec\'s order', JSON.stringify(P.steps.map((s) => s.id)) === JSON.stringify(['plane', 'thread', 'park', 'colour', 'carried', 'inside', 'surface', 'step']), P.steps.map((s) => s.id));
ok('step ids unique', new Set(P.steps.map((s) => s.id)).size === P.steps.length);
ok('its scene exists', !!T.SCENES[P.scene], P.scene);
ok('at most 8 steps and about two minutes', P.steps.length === 8 && P.time === '2 min');

// every step: copy, task (desk and touch), the event that closes it, the placing, the anchors
const EVENTS = { plane: 'view-moved', thread: 'plane-changed', park: 'thread-parked', colour: 'colour-plane-set', carried: 'probe', inside: 'scope-changed', surface: 'surface-changed', step: 'step-selected' };
for (const s of P.steps) {
  const id = `planes/${s.id}`;
  ok(`${id}: title, body`, !!s.title && !!s.body);
  ok(`${id}: a task with its desk and touch words`, !!s.try && !!s.try.text && !!s.try.touch, s.try);
  ok(`${id}: done on ${EVENTS[s.id]}`, s.try.on === EVENTS[s.id], s.try.on);
  ok(`${id}: placed by svPlace before it`, (s.before || []).some((a) => a[0] === 'svPlace'), s.before);
  for (const a of [].concat(s.anchor, s.also || [])) ok(`${id}: anchor ${a} is known`, a in T.ANCHORS, a);
  // the tests of the closing events: an event of another kind or value does not close it
  if (s.id === 'carried') ok(`${id}: only a probe past the colour plane closes it`, s.try.test({ past: true }) && !s.try.test({ past: false }));
  if (s.id === 'inside') ok(`${id}: only Inside regions closes it`, s.try.test({ s: 'in' }) && !s.try.test({ s: 'all' }));
  if (s.id === 'surface') ok(`${id}: only Sphere closes it`, s.try.test({ s: 'sphere' }) && !s.try.test({ s: 'land' }));
  if (s.id === 'step') ok(`${id}: only the chip f₁ closes it`, s.try.test({ k: 1 }) && !s.try.test({ k: 2 }));
  if (s.id === 'plane') ok(`${id}: an orbit does not close it`, s.try.test({ how: 'zoom' }) && !s.try.test({ how: 'orbit' }));
}
ok('svPlace is one of the actions that need a borrowed canvas', read('src/tour.js').includes("'select', 'plane', 'svPlace'"));

// the words: the chapter's title and time, and every step's title, body and task, in both languages with the same markup
const strings = new Set([P.title]);
for (const s of P.steps) for (const t of [s.title, s.body, s.try.text, s.try.touch]) strings.add(t);
for (const en of strings) {
  for (const [lang, tab] of [['ru', RU], ['it', IT]]) {
    const v = tab[en];
    ok(`${lang}: "${en.slice(0, 40)}" has an entry`, typeof v === 'string' && v.length > 0, en);
    if (typeof v !== 'string') continue;
    ok(`${lang}: "${en.slice(0, 40)}" keeps its maths`, maths(en) === maths(v), [maths(en), maths(v)]);
    ok(`${lang}: "${en.slice(0, 40)}" keeps its keys`, keys(en) === keys(v), [keys(en), keys(v)]);
    ok(`${lang}: "${en.slice(0, 40)}" is not the English`, v !== en, v);
  }
}
ok('the time has its translation', !!RU['2 min'] && !!IT['2 min']);

// the steps view's own strings: the plane's title past the colour plane, the dot's tooltip, the key line (a context of its own)
for (const [lang, tab, want] of [['ru', RU, ['colour carried from {p}', 'Go to {p}', 'key line\u0004colour carried from {p}']], ['it', IT, ['colour carried from {p}', 'Go to {p}', 'key line\u0004colour carried from {p}']]]) {
  for (const k of want) {
    ok(`${lang}: "${k.replace('\u0004', ' / ')}" has an entry`, typeof tab[k] === 'string', k);
    if (typeof tab[k] === 'string') ok(`${lang}: "${k.replace('\u0004', ' / ')}" keeps its placeholder`, phs(k) === phs(tab[k].replace(/%\{/g, '{')), [phs(k), phs(tab[k])]);
  }
}
ok('the old title is gone from the tables', !('colour of {p}, carried' in RU) && !('colour of {p}, carried' in IT));

if (fails.length) { for (const f of fails.slice(0, 40)) console.log('FAIL', f.name, JSON.stringify(f.got)); console.log(`${n - fails.length}/${n} passed`); process.exit(1); }
console.log(`${n}/${n} passed`);

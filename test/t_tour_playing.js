// The steps view's tour chapter "Playing the chain": the events its tasks wait for are sent by the steps view
// (play-started by svPlay, loop-changed by svSetLoop, range-set by a committed range), and the chapter's steps, words and
// anchors are known.   node test/t_tour_playing.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let n = 0;
const fails = [];
const ok = (name, cond, got) => { n++; if (!cond) fails.push({ name, got }); };

// the body of a top-level function of the steps view (up to the next function at the same indent)
const SV = read('src/app/19-steps-view.js');
const body = (name) => { const m = SV.match(new RegExp(`\\n  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n`)); return m ? m[0] : ''; };

ok('svPlayNow sends play-started', /tourEmit\('play-started'/.test(body('svPlayNow')));

ok('svSetLoop sends loop-changed with the new state', /tourEmit\('loop-changed', \{ on/.test(body('svSetLoop')));

ok('a committed range sends range-set', /tourEmit\('range-set'/.test(body('svSetRange')) && /tourEmit\('range-set'/.test(body('svRangeUp')));

// the chapter, its steps and words
const table = (f, lang) => {
  const m = read(f).match(new RegExp(`I18N\\.define\\('${lang}', ("(?:[^"\\\\]|\\\\.)*")\\);`));
  return JSON.parse(JSON.parse(m[1]));
};
const RU = table('src/i18n_ru.js', 'ru');
const { Tour } = require('../src/tour.js');
const T = Tour._t;
const keys = (x) => (String(x).match(/\{[A-Za-z+]\}/g) || []).join('|');
const P = T.PLAYING;
ok('the chapter is there', !!P && P.id === 'playing', P && P.id);
ok('three steps, in the outline\'s order', JSON.stringify(P.steps.map((s) => s.id)) === JSON.stringify(['play', 'speed', 'range']), P.steps.map((s) => s.id));
ok('its scene exists', !!T.SCENES[P.scene], P.scene);
const EVENTS = { play: 'play-started', speed: 'loop-changed', range: 'range-set' };
const strings = new Set([P.title]);
for (const s of P.steps) {
  const id = `playing/${s.id}`;
  ok(`${id}: done on ${EVENTS[s.id]}`, s.try.on === EVENTS[s.id], s.try.on);
  ok(`${id}: placed by svPlace before it`, (s.before || []).some((a) => a[0] === 'svPlace'), s.before);
  for (const a of [].concat(s.anchor, s.also || [])) ok(`${id}: anchor ${a} is known`, a in T.ANCHORS, a);
  for (const t of [s.title, s.body, s.deskTouch, s.phoneFine, s.touch, s.try.text, s.try.deskTouch, s.try.phoneFine, s.try.touch]) if (t) strings.add(t);
}
for (const en of strings) {
  const v = RU[en];
  ok(`ru: "${en.slice(0, 40)}" has an entry`, typeof v === 'string' && v.length > 0, en);
  ok(`ru: "${en.slice(0, 40)}" keeps its keys`, keys(en) === keys(v), [keys(en), keys(v)]);
  ok(`ru: "${en.slice(0, 40)}" is not the English`, v !== en, v);
}
ok('the chapter replaces Views and Deformation when the steps view is on', !T.SV_ON || (!T.CHAPTERS.some((c) => c.id === 'views' || c.id === 'deform') && T.CHAPTERS.some((c) => c.id === 'playing')));

if (fails.length) { for (const f of fails.slice(0, 40)) console.log('FAIL', f.name, JSON.stringify(f.got)); console.log(`${n - fails.length}/${n} passed`); process.exit(1); }
console.log(`${n}/${n} passed`);

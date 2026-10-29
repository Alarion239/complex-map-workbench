// v16.5 wave 1, the learn piece (notes/ux-build/w1-learn-AS-BUILT.md): the DOM-free parts. The learning lane's API
// (UX21, UX74), the tour copy it changed (UX77 Details, UX90 the welcome, UX20 the Phase key step), and the Russian of
// this piece (UX78, UX93: the tour is «обучение», short one-line phone tiles; every string of the table shipped).
// The browser side is test/ux165_learn_cmd.js. Run: node test/t_ux165_learn.js
const fs = require('fs');
const path = require('path');
const { Tour } = require('../src/tour.js');
const T = Tour._t;
let fails = 0, n = 0;
const ok = (name, cond, info) => { n++; if (!cond) { fails++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); } };
const step = (ch, id) => T.CHAPTERS.find((c) => c.id === ch).steps.find((s) => s.id === id);

// ---- the lane (UX21, UX74): part of the API; a no-op without a DOM
for (const k of ['lane', 'laneHide', 'laneId']) ok(`Tour.${k} is a function`, typeof Tour[k] === 'function');
ok('no DOM: Tour.lane shows nothing', Tour.lane({ id: 'x', title: 't' }) === false);
ok('no DOM: no lane line', Tour.laneId() === null);
ok('no DOM: Tour.laneHide is safe', (() => { try { Tour.laneHide('x'); return true; } catch (e) { return false; } })());
const SRC = require('./src_text').source('tour.js', { esm: 'strip' });
ok('the first-run suggestion is a lane line, not the old card', /laneShow\(\{ id: 'suggest'/.test(SRC) && !/class: 'tour-suggest'/.test(SRC));
ok('the lane reserves its room as the strip does (--tour-h, --ph-tour)', /--tour-h', \(LANE_H \+ SLOT_GAP\)/.test(SRC) && /--ph-tour', \(mode === 'port' \? 56/.test(SRC));
ok('UX21: the line\'s words are never cut: laneFit drops the optional part (the invitation\'s description) before cutting', /function laneFit\(\)/.test(SRC) && /drop: 'body'/.test(SRC) && /\.tour-lane\[data-mode="desk"\]:not\(\.two\) \.tl-text/.test(SRC));
// (src/app/*.js joined, as build.py does, and the modules moved out of it: src/soundhooks.js, the Try line;
// src/morphpaths.js; src/examples.js, the example fit and the guide)
const APP = ['soundhooks.js', 'morphpaths.js', 'examples.js'].reduce((t, f) => t + '\n' + require('./src_text').source(f), require('./src_text').appText());
ok('UX74: the Try line drops the example\'s name first', /drop: 'title', onClose/.test(APP));
ok('UX20: the example fit measures X\'s bar only on the plane (it is in the head on a desktop)', /f\.parentNode === \$\('plotL'\)/.test(APP));
ok('UX20: the head note gives way before the title (fitTitle noNote)', /function fitTitle\(side, noNote[,)]/.test(APP) && /\$t\('Preimage in X'\)/.test(APP));
ok('UX20: the empty chain\'s call to action goes into Y\'s head on a desktop', /head\.insertBefore\(er, leg\)/.test(APP));
ok('UX103: the readout names the step\'s function', /\$t\('Step \{k\} of \{m\} · \{f\} · \{p\} %'/.test(APP) && /\$t\('All steps at once · \{p\} %'/.test(APP));
ok('UX72: Listen along in the row menu and in the selected curve\'s editor, both through sndListenAsk', (() => {
  const ed = APP.slice(APP.indexOf('  function shapeEditor(s) {'), APP.indexOf('  // ---------------- formula region input'));
  return /'data-act': 'listen-along'/.test(ed) && /sndListenAsk\(s\)/.test(ed) && /\$t\('Listen along it'\), run: \(\) => \(snd\.play \? sndStopPlay\(true\) : sndListenAsk\(s\)\)/.test(APP);
})());
ok('a tour start takes the slot from a lane line', /hideSuggest\(false\);\n\s*laneHide\(null, false\);/.test(SRC));

// ---- the copy (UX77, UX90, UX20)
const w = step('basics', 'welcome');
const plain = (s) => T.plainCopy(s, 'Ctrl');
ok('UX90: the welcome lead says what is cleared', w.lead === 'Practice freely: what you draw here is cleared at the end.', w.lead);
ok('UX90: the lead keeps the strip\'s rule (one sentence, at most 60, a full stop)', plain(w.lead).length <= 60 && /\.$/.test(w.lead));
ok('UX77: Details adds to the lead (it no longer repeats it)', !w.body.includes(w.lead) && /your own work comes back exactly as it was/.test(w.body), w.body);
ok('UX77: Details starts folded on every size', /whyOpen = rec\.why != null \? rec\.why : false/.test(SRC) && !/vpSize\(\)\.w >= 1280 && vpSize\(\)\.h >= 800/.test(SRC));
ok('UX77: the toggle is called Details', /\$t\('Details'\)/.test(SRC) && !/\$t\('Why'\)/.test(SRC));
const key = step('views', 'key');
// (#247: the check is a toggle in Y's head, so the task names the check alone; the head's ⋯ is lit when it is behind it)
ok('UX20: the Phase key step lights the head\'s ⋯ button when the check is behind it', key.anchor[1] === 'rightOpts' && key.try.text === 'Turn on Phase key.', key.try);
ok('UX20: the step\'s task text keeps the strip\'s length', plain(key.try.text).length <= 60, key.try.text);

// ---- Russian (UX78, UX93 and every string of this piece)
const RU = JSON.parse(fs.readFileSync(path.join(__dirname, '../notes/i18n/ru/v165-ux-learn.json'), 'utf8'));
const ents = Object.entries(RU).filter(([k]) => !k.startsWith('_'));
ok('the table has the piece\'s strings', ents.length >= 70, ents.length);
ok('every entry has en and ru', ents.every(([, v]) => v.en && v.ru), ents.filter(([, v]) => !(v.en && v.ru)).map(([k]) => k));
const MK = fs.readFileSync(path.join(__dirname, '../tools/make_ru_table.py'), 'utf8');
// (wave 1 merge: V165_HERE is one set holding every piece's table, this one among them)
ok('make_ru_table.py reads the table after every v16.4 one', /V165_HERE = \{[^}]*'v165-ux-learn\.json'[^}]*\}/.test(MK) && MK.indexOf("glob('v165-*.json')") > MK.lastIndexOf("glob('v164-*.json')"));
const TABLE = (() => { const s = require('./src_text').source('i18n_ru.js', { esm: 'strip' }); const m = /I18N\.define\('ru', (".*")\);\s*$/ms.exec(s); return JSON.parse(JSON.parse(m[1])); })();
const keyOf = (v) => (v.ctx ? v.ctx + '\u0004' : '') + v.en;
// (the old Help "Deformation" paragraph has no stopgap Russian any more: the app calls the release's paragraph, whose
// Russian comes from v164-help.json)
const missing = ents.filter(([, v]) => !(keyOf(v) in TABLE));
ok('every string of the piece is in the shipped table', missing.length === 0, missing.map(([k]) => k));
ok('no stopgap entry is left for the older Help "Deformation" paragraph, and the release\'s paragraph is in the table',
  !ents.some(([, v]) => /^Stopgap/.test(v.note || '')) && !ents.some(([k]) => /^help\.deformation\./.test(k))
  && Object.keys(TABLE).some((k) => k.startsWith('<b>Deformation</b> in the top bar') && /when the step is analytic, is analytic for every/.test(k) && APP.includes(k)));
ok('UX78: «Дальше автоматически»', TABLE['Move on by itself'] === 'Дальше автоматически', TABLE['Move on by itself']);
ok('UX93: the tour is «Обучение»', TABLE['Guided tour'] === 'Обучение' && TABLE['⋯ › Guided tour'] === '⋯ › Обучение');
const obzor = Object.entries(TABLE).filter(([k, v]) => /tour|Tour/.test(k) && (typeof v === 'string' ? [v] : Object.values(v)).some((x) => /[Оо]бзор/.test(x)));
ok('UX93: no tour string still says «обзор»', obzor.length === 0, obzor.map(([k]) => k));
ok('UX93: the welcome title fits a 360 px strip', TABLE['Welcome to the Workbench'] === 'Добро пожаловать');
const tiles = ents.filter(([, v]) => v.ctx === 'phone tile');
ok('UX93: the phone tile names are one word or two short ones, without a soft hyphen', tiles.length === 7 && tiles.every(([, v]) => !/­/.test(v.ru) && v.ru.split(' ').every((wd) => wd.length <= 9)), tiles.map(([, v]) => v.ru));
// the strip's Russian rule: leads and tasks at most 64 as read
for (const id of ['lead.welcome2', 'try.key.desk']) ok(`Russian ${id}: at most 64 as read`, plain(RU[id].ru).length <= 64, RU[id].ru);
// every placeholder of the English is in the Russian
for (const [k, v] of ents) {
  const ph = (s) => [...s.matchAll(/%?\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  ok(`placeholders of ${k}`, ph(v.en) === ph(v.ru), [v.en, v.ru]);
}

console.log(fails ? `${fails} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(fails ? 1 : 0);

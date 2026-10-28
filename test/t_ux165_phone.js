// v16.5 wave 1, the phone piece (notes/ux-build/w1-phone-AS-BUILT.md): the tour's touch wording and its keyboard chapter
// (UX17), DOM-free. The browser side is test/ux165_phone_cmd.js. Run: node test/t_ux165_phone.js
const fs = require('fs');
const path = require('path');
let COARSE = false;
global.matchMedia = (q) => ({ matches: /pointer:\s*coarse/.test(q) ? COARSE : false, addEventListener() {}, removeEventListener() {} });
const { Tour } = require('../src/tour.js');
const T = Tour._t;
let fails = 0, n = 0;
const ok = (name, cond, info) => { n++; if (!cond) { fails++; console.log('FAIL', name, info !== undefined ? JSON.stringify(info) : ''); } };
const RU = (() => { let tab = {}; const src = fs.readFileSync(path.join(__dirname, '../src/i18n_ru.js'), 'utf8'); const I18N = { define: (l, x) => { tab = JSON.parse(x); } }; (new Function('I18N', src))(I18N); return tab; })();

const C = T.CHAPTERS;
const keysAt = C.findIndex((c) => c.id === 'keys');
ok('the keys chapter exists and is marked for the keyboard', keysAt >= 0 && C[keysAt].desk === true);
ok('only the keys chapter is for the keyboard', C.filter((c) => c.desk).length === 1);

// the chapter is offered with a fine pointer, not with a coarse one
COARSE = false;
ok('laptop: Palette and keys is offered', T.chapterShown(C[keysAt]));
ok('laptop: seek reaches the keys chapter', JSON.stringify(T.seek(keysAt, 0, 1)) === JSON.stringify({ ci: keysAt, si: 0 }));
COARSE = true;
ok('touch: Palette and keys is not offered', !T.chapterShown(C[keysAt]));
const fwd = T.seek(keysAt, 0, 1);
ok('touch: seek passes over the keys chapter going forward', fwd === null || fwd.ci > keysAt, fwd);
const before = T.seek(keysAt - 1, C[keysAt - 1].steps.length, 1);
ok('touch: Next from the chapter before it does not land in it', before === null || before.ci !== keysAt, before);
if (keysAt + 1 < C.length) {
  const back = T.seek(keysAt + 1, -1, -1);
  ok('touch: Back from the chapter after it lands in the one before it', back && back.ci === keysAt - 1 && back.si === C[keysAt - 1].steps.length - 1, back);
}
ok('touch: every other chapter is offered', C.every((c, i) => i === keysAt || T.chapterShown(c)));

// the Inspector step: its own title and line on touch
const insp = C.flatMap((c) => c.steps).find((s) => s.id === 'inspector');
ok('the Inspector step has a touch title and line', insp && insp.titleTouch === 'The editor' && /editor/.test(insp.leadTouch));
ok('leadFor: touch line on touch', T.leadFor(insp, { coarse: true }) === insp.leadTouch && T.leadFor(insp, { coarse: false }) === insp.lead);
ok('leadFor: a step with no touch line keeps its lead', (() => { const s = { lead: 'x.' }; return T.leadFor(s, { coarse: true }) === 'x.'; })());
ok('the touch line follows the strip\'s rule: one sentence, at most 60, a full stop', T.plainCopy(insp.leadTouch, 'Ctrl').length <= 60 && /\.$/.test(insp.leadTouch) && !/\. \S/.test(insp.leadTouch));

// a scene's own copy on touch
const dom = C.flatMap((c) => c.steps).find((s) => s.id === 'domain');
ok('Natural domain: the scene copy on touch', /^Tap the F tile/.test(T.copyFor(dom, 'residueZp', { coarse: true })) && /Inspector/.test(T.copyFor(dom, 'residueZp', { coarse: false })));

// no step a touch screen offers names a desktop place or gesture (body, task, line, scene copy, title)
const DESK = /\b(click|clicks|right-click|double-click|shift-click|hover|Inspector|lens|left pane|right pane|on the (left|right))\b|Drag a card|\{(Shift|Alt|Ctrl|Cmd|Mod)\}/i;
const bad = [];
for (const c of C) {
  if (!T.chapterShown(c)) continue;
  for (const s of c.steps) {
    const texts = [T.copyFor(s, null, { coarse: true, narrow: true }), s.try ? T.tryFor(s.try, { coarse: true }) : '', T.leadFor(s, { coarse: true }) || '', ...Object.keys(s.byScene || {}).map((k) => T.copyFor(s, k, { coarse: true }))];
    for (const t of texts) if (t && DESK.test(T.plainCopy(t, 'Ctrl'))) bad.push(`${c.id}/${s.id}: ${t.slice(0, 90)}`);
    const title = s.titleTouch || s.title;
    if (DESK.test(title)) bad.push(`${c.id}/${s.id} title: ${title}`);
  }
}
ok('touch copy names no desktop place or gesture', bad.length === 0, bad);
COARSE = false;

// every new string of this piece has its Russian (notes/i18n/ru/v165-ux-phone.json, through tools/make_ru_table.py)
const SRC = ['app.js', 'inspector.js', 'phone.js', 'tour.js'].map((f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const table = JSON.parse(fs.readFileSync(path.join(__dirname, '../notes/i18n/ru/v165-ux-phone.json'), 'utf8'));
const missing = [];
for (const [k, v] of Object.entries(table)) {
  if (k.startsWith('_') || !v || !v.en) continue;
  const lit = v.en.replace(/\\/g, '\\\\');
  if (!SRC.includes(v.en) && !SRC.includes(lit) && !SRC.includes(v.en.replace(/'/g, "\\'"))) continue;   // (a string another table holds, or a wording this piece's code no longer uses)
  if (RU[v.en] == null) missing.push(k);
}
ok('every string of this piece that the code uses is in src/i18n_ru.js', missing.length === 0, missing);
for (const s of [insp.titleTouch, insp.leadTouch, dom.touchByScene.residueZp]) ok(`Russian for "${s.slice(0, 40)}"`, typeof RU[s] === 'string' && RU[s].length > 3);

console.log(fails ? `${fails}/${n} failed` : `${n}/${n} passed`);
process.exit(fails ? 1 : 0);

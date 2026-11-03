// Unit checks of the notes in ci/suite_views.js (standards' rule 5a): the note of every suite tagged port(area, note) says
// what the suite still waits on, in words: it is not empty, and it carries no issue number and no plan label ("K1 item
// 11", "#620 item 2").
//   node test/t_suite_views.js
const { VIEWS } = require('../ci/suite_views.js');
let n = 0, fails = 0;
const ok = (name, c, info) => {
  n++;
  if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
};

const ports = Object.entries(VIEWS).filter(([, tag]) => tag.view === 'port');
ok('there are port suites to check', ports.length > 0);

const empty = ports.filter(([, tag]) => !tag.note || !tag.note.trim()).map(([f]) => f);
ok('every port note says what the suite waits on', empty.length === 0, empty);

const numbered = ports.filter(([, tag]) => /#\d+/.test(tag.note || '')).map(([f]) => f);
ok('no port note names an issue number', numbered.length === 0, numbered);

const labelled = ports.filter(([, tag]) => /\b[A-Z]\d+ (?:item|W\d|batch|step)\b|\bitem \d+\b/i.test(tag.note || '')).map(([f]) => f);
ok('no port note carries a plan label ("K1 item N")', labelled.length === 0, labelled);

// the classic reasons are held to the same rule
const whyBad = Object.entries(VIEWS).filter(([, tag]) => tag.view === 'classic' && (!tag.why || /#\d+|\bitem \d+\b/i.test(tag.why))).map(([f]) => f);
ok('every classic reason is non-empty and names no issue number', whyBad.length === 0, whyBad);

// the check itself bites
const bad = { a: { view: 'port', area: 'render', note: '' }, b: { view: 'port', area: 'render', note: 'after #717' }, c: { view: 'port', area: 'render', note: 'K1 item 3' } };
const flagged = Object.entries(bad).filter(([, t]) => !t.note || /#\d+/.test(t.note) || /\bitem \d+\b/i.test(t.note)).map(([f]) => f);
ok('the check flags an empty note, an issue number and a plan label', flagged.join() === 'a,b,c', flagged);

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

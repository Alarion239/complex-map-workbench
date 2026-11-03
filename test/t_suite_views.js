// Unit checks of the notes in ci/suite_views.js: the note of every suite tagged port(area, note) says in words what the
// suite still waits on. It is not empty, and it names no issue number and carries no plan label (an issue's item or step
// number): such a note goes stale, and the standards check rejects it. The notes go through that check itself, as the
// comment lines of a change to this file.
//   node test/t_suite_views.js
const { VIEWS } = require('../ci/suite_views.js');
const { parseDiff, check } = require('../ci/standards.js');
let n = 0, fails = 0;
const ok = (name, c, info) => {
  n++;
  if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
};

const ports = Object.entries(VIEWS).filter(([, tag]) => tag.view === 'port');
ok('there are port suites to check', ports.length > 0);

const empty = ports.filter(([, tag]) => !tag.note || !tag.note.trim()).map(([f]) => f);
ok('every port note says what the suite waits on', empty.length === 0, empty);

// the standards check's findings for a note, read as a comment line the change adds to ci/suite_views.js
const standardsOf = (note) => check(parseDiff(['diff --git a/ci/suite_views.js b/ci/suite_views.js', '--- a/ci/suite_views.js', '+++ b/ci/suite_views.js',
  '@@ -0,0 +1 @@', `+// ${note}`].join('\n'))).map((f) => `${f.rule}:${f.why}`);
// a note may name an issue number in no form the check rejects, and a bare `#N` is none the check can tell from a
// reference to a decision, so the issue number is checked here too
const issueNumber = (text) => /#\d+/.test(text || '');

const flagged = ports.filter(([, tag]) => standardsOf(tag.note || '').length).map(([f, tag]) => `${f}: ${standardsOf(tag.note).join(', ')}`);
ok('no port note trips the standards check (history words, plan labels)', flagged.length === 0, flagged);

const numbered = ports.filter(([, tag]) => issueNumber(tag.note)).map(([f]) => f);
ok('no port note names an issue number', numbered.length === 0, numbered);

// the classic reasons are held to the same rules
const whyBad = Object.entries(VIEWS).filter(([, tag]) => tag.view === 'classic' && (!tag.why || issueNumber(tag.why) || standardsOf(tag.why).length)).map(([f]) => f);
ok('every classic reason is non-empty and passes the same rules', whyBad.length === 0, whyBad);

// the check itself bites: through the standards check, not a copy of its patterns
ok('a plan label and a history word are found by the standards check', standardsOf('K1 item 3').length === 1 && standardsOf('used to wait on the tour').length === 1);
ok('an issue number is found, and a clean note is clean', issueNumber('after #717') && !issueNumber('waits on the tour') && standardsOf('waits on the tour').length === 0);

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

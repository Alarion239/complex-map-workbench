// Unit checks of ci/standards.js, the report-only standards check on a change's added lines (ci/README.md, Standards
// check): history words, plan labels, dropped assertions, the opt-out marker, scope, and a clean change.
//   node test/t_standards.js
const { commentOf, assertionsOf, parseDiff, check } = require('../ci/standards.js');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };

// a one-file diff from added and removed lines
const diff = (file, added, removed = []) => parseDiff([
  `diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, `@@ -1,${removed.length} +1,${added.length} @@`,
  ...removed.map((l) => '-' + l), ...added.map((l) => '+' + l)].join('\n'));
const rules = (file, added, removed) => check(diff(file, added, removed)).map((f) => f.rule + ':' + f.why);

// comments are told from code and strings
ok('commentOf: a line comment', commentOf('x = 1; // the radius', 'a.js') === ' the radius');
ok('commentOf: a URL and a string are not comments', commentOf('u = "http://a/b"; s = \'// no\';', 'a.js') === '' && commentOf('fetch(`https://x`)', 'a.js') === '');
ok('commentOf: a block comment line and its star lines', commentOf('/* a note */', 'a.js') === ' a note ' && commentOf(' * text', 'a.js') === ' text');
ok('commentOf: # is a comment in Python and YAML only', commentOf('x = 1  # note', 'a.py') === ' note' && commentOf('color: "#fff"', 'a.yml') === '' && commentOf('a #b', 'a.js') === '');
ok('commentOf: an html comment', commentOf('<!-- note -->', 'a.html') === ' note -->');
ok('assertionsOf: calls, not definitions or comments', assertionsOf('ok(\'a\', 1); check(2); assert.equal(1, 1);', 'a.js') === 3 && assertionsOf('const ok = (n, c) => c; function check(x) {}', 'a.js') === 0 && assertionsOf('x(); // ok(1)', 'a.js') === 0);

// history
for (const c of ['// the map was clamped to the disc', '// used to be a table', '// now it caches the table', '// replaces the loop', '// previously global', '// no longer uses the table',
  '// instead of the old table', '// v17 only', '// after beta.3', '// wave 14 batch', '// fixed in #552', ' * after #587']) {
  ok(`history: ${c}`, rules('src/app/x.js', [c.startsWith(' *') ? c : `const a = 1; ${c}`]).some((r) => r.startsWith('history:')), rules('src/app/x.js', [c]));
}
ok('history: a clean comment is clean', rules('src/app/x.js', ['// clamps the radius to the unit disc', 'const knowing = 1; // known']).length === 0);
for (const c of ['// no longer than the pane', '// where it was set by the user', '// the value is now 3', '// it was a loop in the draft', '// now or never', '/** the clock */ o.now = 1;']) {
  ok(`history: descriptive wording is clean: ${c}`, rules('src/app/x.js', [c]).length === 0, rules('src/app/x.js', [c]));
}
ok('commentOf: a block comment ends at its close', commentOf('/** a */ o.now = 1;', 'a.js') === '* a ' && commentOf('f(/* a */ 1); // b', 'a.js') === ' a   b');
ok('history: a comment after a closed block comment is read', rules('src/app/x.js', ['/* a */ f(); // was removed in v16.5']).length === 1);
ok('history: code is not read (a string saying "now")', rules('src/app/x.js', ['const s = "now it was"; const w = ["v17"];']).length === 0);
ok('history: a python comment', rules('tools/x.py', ['x = 1  # used to be 2']).length === 1);

// plan labels
for (const c of ['// K1 item 3', '// #620 item 2', '// step 2 of #620', '// [v17 D5] mesh']) {
  ok(`plan: ${c}`, rules('ci/x.js', [c]).some((r) => r.startsWith('plan:') || r.startsWith('history:')), rules('ci/x.js', [c]));
}
ok('plan: K1 item is a plan label', rules('ci/x.js', ['// K1 item 3']).join() === 'plan:a plan label');
ok('plan: a single cite of a decision issue is fine', rules('src/x.js', ['// see #620 for the decision', '// the chain limit (issue #234)']).length === 0);

// dropped assertions
ok('asserts: fewer assertions in a test file', rules('test/t_a.js', ['ok(1);'], ['ok(1);', 'ok(2);', 'check(3);']).join() === 'asserts:3 assertions removed, 1 added');
ok('asserts: the same or more is fine', rules('test/t_a.js', ['ok(1);', 'ok(2);'], ['ok(1);']).length === 0);
ok('asserts: a browser suite counts too', rules('test/x_cmd.js', [], ['check("a", 1);']).join() === 'asserts:1 assertions removed, 0 added');
ok('asserts: a moved assertion nets zero', rules('test/t_a.js', ['ok(1);'], ['ok(1);']).length === 0);
ok('asserts: other files are not counted', rules('test/lib/x.js', [], ['ok(1);']).length === 0 && rules('src/x.js', [], ['ok(1);']).length === 0);
ok('asserts: a deleted test file', (() => {
  const f = parseDiff(['diff --git a/test/t_a.js b/test/t_a.js', '--- a/test/t_a.js', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-ok(1);', '-ok(2);'].join('\n'));
  return check(f).map((x) => x.why).join() === '2 assertions removed, 0 added (file deleted)';
})());

ok('asserts: a split moves assertions to a new file', (() => {
  const f = parseDiff(['diff --git a/test/t_a.js b/test/t_a.js', '--- a/test/t_a.js', '+++ b/test/t_a.js', '@@ -1,2 +1,0 @@', '-ok(1);', '-ok(2);',
    'diff --git a/test/t_b.js b/test/t_b.js', '--- /dev/null', '+++ b/test/t_b.js', '@@ -0,0 +1,2 @@', '+ok(1);', '+ok(2);'].join('\n'));
  return check(f).length === 0;
})());

ok('asserts: a gain in an existing file does not hide a loss', (() => {
  const f = parseDiff(['diff --git a/test/t_a.js b/test/t_a.js', '--- a/test/t_a.js', '+++ b/test/t_a.js', '@@ -1 +0,0 @@', '-ok(1);',
    'diff --git a/test/t_b.js b/test/t_b.js', '--- a/test/t_b.js', '+++ b/test/t_b.js', '@@ -0,0 +1 @@', '+ok(1);'].join('\n'));
  return check(f).map((x) => x.file).join() === 'test/t_a.js';
})());
ok('asserts: a partly moved split names the rest', (() => {
  const f = parseDiff(['diff --git a/test/t_a.js b/test/t_a.js', '--- a/test/t_a.js', '+++ b/test/t_a.js', '@@ -1,2 +0,0 @@', '-ok(1);', '-ok(2);',
    'diff --git a/test/t_b.js b/test/t_b.js', '--- /dev/null', '+++ b/test/t_b.js', '@@ -0,0 +1 @@', '+ok(1);'].join('\n'));
  return check(f).map((x) => x.why).join() === '2 assertions removed, 0 added; 1 of them moved to a new file';
})());

// opt-out, scope, generated files
ok('opt-out: a marker with a reason skips its line', rules('src/x.js', ['// now it caches the table (standards-ok: the word is the subject)']).length === 0 && rules('src/x.js', ['// now it caches the table // standards-ok: a quote']).length === 0);
ok('opt-out: a marker without a reason is a finding', rules('src/x.js', ['// was here standards-ok:']).join() === 'marker:standards-ok: needs a reason');
ok('opt-out: a marker in a test file allows its assertion drop', rules('test/t_a.js', ['// standards-ok: folded into t_b.js'], ['ok(1);', 'ok(2);']).length === 0);
ok('scope: only src, ci, test and tools', rules('notes/x.md', ['// was now']).length === 0 && rules('README.md', ['// was now']).length === 0);
ok('scope: generated files are ignored', rules('src/i18n_ru.js', ['// was now']).length === 0 && rules('src/seasong.js', ['// was']).length === 0 && rules('src/cyr.js', ['// was']).length === 0);
ok('scope: json and markdown carry no comments', rules('tools/it_table.json', ['"x": "was now"']).length === 0 && rules('test/README.md', ['was now']).length === 0);

// a clean change
ok('clean: a typical change has no findings', check(diff('src/app/x.js', ['// clamps r to [0, 1]; the unit disc', 'const r = Math.min(1, r0);'])).length === 0 && check(diff('test/t_x.js', ['ok("a", 1);', 'ok("b", 2);'], ['ok("a", 1);'])).length === 0);
// line numbers
ok('findings carry the line of the added line', check(parseDiff(['diff --git a/src/x.js b/src/x.js', '--- a/src/x.js', '+++ b/src/x.js', '@@ -5,0 +7,2 @@', '+const a = 1;', '+// now it caches the table'].join('\n')))[0].line === 8);

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

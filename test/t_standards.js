// Unit checks of ci/standards.js, the standards check on a change's added lines (ci/README.md, Standards
// check): history words, plan labels, dropped assertions, the opt-out marker, scope, a clean change, the command line's
// exit with and without --block, and the Gate's step passing --block.
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
// (review and verify labels, bracketed or in parentheses: the labels of a review round's findings)
for (const c of ['/* [review user-11] a definition wraps */', '/* (r3 review user-7: a chevron after the count) */', '// [verify-1] it goes first',
  '// Russian only (verify-5): a comma', '/* (r3 verify-2: x stays in the row) */', '// ([check app-5] at the foot)', '// (UX20) the key',
  '// it ends the hold (r3 review regress-1)', '// (review v16 regress-6: saved from here on)', '// (r3 review fix pass) a lit part',
  '// 27 to 38 fps orbiting, r3 review speed-1)', '/* (r3 review: the row keeps the full width) */',
  '// (review regress-7: a rebuilt panel destroys its old mount)', '// ([v16.5 fix regress-6] F(z) of the probe)']) {
  ok(`plan: a review label: ${c}`, rules('src/x.js', [c]).some((r) => r === 'plan:a review label'), rules('src/x.js', [c]));
}
for (const c of ['// a review of the user\'s settings', '// verify that the map is entire', '// check the app state, then the user', '// the UX of the strip',
  '// review step 2', '/* --user-1: a custom property */', '// a review of the panel', '// the r3 tour', '// a regression in the speed',
  '// regress to the old view', '// the speed-up of the mesh', '// as it is seen (notes/sea-song/r2 review picture-3)']) {
  ok(`plan: prose is not a review label: ${c}`, !rules('src/x.js', [c]).some((r) => r === 'plan:a review label'), rules('src/x.js', [c]));
}
ok('plan: a suite under test/ may name the review finding its rows pin', rules('test/ux165_plane_cmd.js', ['// UX52: a refused pick in the chip']).length === 0
  && rules('test/t_i18n.js', ['// verify-5: a comma between digits']).length === 0, rules('test/ux165_plane_cmd.js', ['// UX52: a refused pick in the chip']));
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

// a deleted suite is retired by a ledger line with a reason and its lines dropped from what runs (ci/retired_suites.js)
{
  const del = (f, n = 2) => [`diff --git a/test/${f} b/test/${f}`, `--- a/test/${f}`, '+++ /dev/null', `@@ -1,${n} +0,0 @@`, ...Array.from({ length: n }, (_, i) => `-ok(${i});`)];
  const edit = (file, removed, added) => [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, `@@ -1,${removed.length} +1,${added.length} @@`,
    ...removed.map((l) => '-' + l), ...added.map((l) => '+' + l)];
  const ledger = (lines) => edit('ci/retired_suites.js', [], lines);
  const views = edit('ci/suite_views.js', ["  'x_cmd.js': classic('why'),"], []);
  const shards = edit('ci/browser_shards.js', ["  { id: 'a', suites: ['y_cmd.js', 'x_cmd.js#part', 'z_cmd.js'] },"], ["  { id: 'a', suites: ['y_cmd.js', 'z_cmd.js'] },"]);
  const excluded = edit('ci/browser_suites.js', ["  'x_cmd.js': 'a benchmark, no verdict',"], []);
  const timing = edit('ci/browser_suites.js', ["  'x_cmd.js': [t(/fast/)],"], []);
  const why = (lines) => check(parseDiff(lines.join('\n'))).map((x) => x.rule + ':' + x.why);
  const REASON = "  'x_cmd.js': 'the classic transport it drove is gone (#994); the steps view has y_cmd',";
  ok('retired: a deleted suite with no ledger line is a finding', why([...del('x_cmd.js'), ...views, ...shards]).join() === 'asserts:2 assertions removed, 0 added (file deleted)');
  ok('retired: a ledger line and the suite dropped from views and shards: no finding', why([...del('x_cmd.js'), ...ledger([REASON]), ...views, ...shards]).length === 0, why([...del('x_cmd.js'), ...ledger([REASON]), ...views, ...shards]));
  ok('retired: a ledger line and the suite dropped from EXCLUDED: no finding', why([...del('x_cmd.js'), ...ledger([REASON]), ...excluded]).length === 0);
  ok('retired: still in a shard list, it is a finding', why([...del('x_cmd.js'), ...ledger([REASON]), ...views]).join() === 'asserts:2 assertions removed, 0 added (file deleted)');
  ok('retired: a dropped TIMING entry is not a drop from what runs', why([...del('x_cmd.js'), ...ledger([REASON]), ...timing]).length === 1);
  ok('retired: a ledger line with no reason does not retire it', why([...del('x_cmd.js'), ...ledger(["  'x_cmd.js': '',"]), ...views, ...shards]).length === 1);
  ok('retired: a ledger line for a file the change keeps is a finding', why([...ledger([REASON])]).join() === 'retired:names test/x_cmd.js, which this change does not delete');
  // (a unit test runs because it exists: its ledger line alone retires it)
  const UNIT = "  't_x.js': 'it tested the classic transport, gone in #994',";
  ok('retired: a deleted unit test with a ledger line: no finding', why([...del('t_x.js'), ...ledger([UNIT])]).length === 0, why([...del('t_x.js'), ...ledger([UNIT])]));
  ok('retired: a deleted unit test with no ledger line is a finding', why([...del('t_x.js')]).join() === 'asserts:2 assertions removed, 0 added (file deleted)');
  // (a suite the base's shard lists never named ran in the catch-all shard: dropped from the views, it is gone)
  const base = (text) => (f) => (f === 'ci/browser_shards.js' ? text : null);
  const whyB = (lines, text) => check(parseDiff(lines.join('\n')), base(text)).map((x) => x.rule + ':' + x.why);
  const SHARDS_BASE = "const SHARDS = [{ id: 'a', suites: ['y_cmd.js', 'z_cmd.js'] }, { id: 'new', rest: true, suites: [] }];";
  ok('retired: a catch-all suite dropped from the views, with a ledger line: no finding', whyB([...del('x_cmd.js'), ...ledger([REASON]), ...views], SHARDS_BASE).length === 0, whyB([...del('x_cmd.js'), ...ledger([REASON]), ...views], SHARDS_BASE));
  ok('retired: a suite a base shard line names must leave it', whyB([...del('x_cmd.js'), ...ledger([REASON]), ...views], "const SHARDS = [{ id: 'a', suites: ['x_cmd.js'] }];").length === 1);
  ok('retired: with no base to read, a catch-all suite still needs a shard line dropped', why([...del('x_cmd.js'), ...ledger([REASON]), ...views]).length === 1);
  ok('retired: another deleted suite is still counted', why([...del('x_cmd.js'), ...del('w_cmd.js', 1), ...ledger([REASON]), ...views, ...shards]).join() === 'asserts:1 assertions removed, 0 added (file deleted)');
}
// the ledger names no file that is still in test/
{
  const fs = require('fs'), path = require('path');
  const { RETIRED } = require('../ci/retired_suites.js');
  const kept = Object.keys(RETIRED).filter((f) => fs.existsSync(path.join(__dirname, f)));
  ok('ci/retired_suites.js names no file still in test/', kept.length === 0, kept);
  ok('ci/retired_suites.js: every entry has a reason', Object.values(RETIRED).every((r) => typeof r === 'string' && r.trim().length > 10));
}

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

// a version in a path or a file name is a name, not a label (a comment that cites notes/constructions-v16/SPEC.md); the
// label itself is still found
ok('history: a version in a path is no label', rules('src/app/x.js', ['// the model (notes/constructions-v16/SPEC.md 20.2)', '// the snapshot in notes/v16.2-candidate/src', '// see SPEC-v17.md', '// as notes/v16-user5/SHEETS-DESIGN.md has it', '// the sound_v152 fixture']).length === 0);
// (a point release, the release series' own name and a label after a hyphen are labels too)
const LABELS = ['// as in v16.5', '// (v16)', '// since v17.0-beta.3', '// v17.x keeps it', '// v16.5.1 changed this', '// the pre-v16 behaviour', '// until v16.2. The rest'];
ok('history: a version label alone is still found', LABELS.every((l) => rules('src/app/x.js', [l]).length === 1), LABELS.filter((l) => rules('src/app/x.js', [l]).length !== 1));

// the command line: findings exit 1 only with --block (a scratch git repository holding ci/standards.js and ci/lib.js,
// a commit, then an added test-file comment with a history word); a clean diff exits 0 with --block too
{
  const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmw-std-'));
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', env: Object.assign({}, process.env, { GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' }) });
  try {
    fs.mkdirSync(path.join(dir, 'ci')); fs.mkdirSync(path.join(dir, 'test'));
    for (const f of ['standards.js', 'lib.js']) fs.copyFileSync(path.join(__dirname, '..', 'ci', f), path.join(dir, 'ci', f));
    fs.writeFileSync(path.join(dir, 'test', 't_x.js'), 'ok(1);\n');
    for (const a of [['init', '-q'], ['add', '.'], ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base']]) run('git', a);
    const cli = (...a) => run(process.execPath, ['ci/standards.js', '--ref', 'HEAD', ...a]).status;
    const clean = [cli(), cli('--block')];
    fs.writeFileSync(path.join(dir, 'test', 't_x.js'), 'ok(1);\n// the table was removed\n');
    const found = [cli(), cli('--block')];
    ok('the command line: a clean diff exits 0, with --block too', clean[0] === 0 && clean[1] === 0, clean);
    ok('the command line: a finding exits 0 without --block, 1 with it', found[0] === 0 && found[1] === 1, found);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// the Gate's Plan job runs the check blocking (.github/workflows/gate.yml: its standards step passes --block)
{
  const yml = require('fs').readFileSync(require('path').join(__dirname, '..', '.github', 'workflows', 'gate.yml'), 'utf8');
  const step = yml.split('\n').filter((l) => /node ci\/standards\.js/.test(l));
  ok('the Gate: its one standards step passes --block', step.length === 1 && /--block\b/.test(step[0]), step);
}

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

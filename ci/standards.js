'use strict';
// The standards check: what CONTRIBUTING.md's Code rules and Review checklist let a script see, read from the lines a
// change adds (the Plan job runs it; ci/README.md, Standards check). Three rules:
//   history   a comment that tells the code's history: the words, version and wave labels and changelog issue numbers
//             of HISTORY below
//   plan      a plan label in a comment: the labels of PLAN below (an entry's third part: the files it leaves alone)
//   asserts   a test file (test/t_*.js, test/*_cmd.js) whose diff removes more assertions (check/ok/assert calls) than it
//             adds, unless the diff creates a test file that takes them over (a split), or retires the file (below)
//   retired   a suite the diff deletes is retired, its assertions not counted as dropped, when the same diff names it in
//             the ledger ci/retired_suites.js with a reason and drops it from what runs: from ci/suite_views.js and
//             ci/browser_shards.js (a suite the base's shard lists never named ran in the catch-all shard, so it has no
//             shard line to drop), or from ci/browser_suites.js (EXCLUDED). A unit test (test/t_*.js) runs because it
//             exists, so its ledger line alone retires it. A ledger entry the diff adds for a file it does not delete is a
//             finding
// Only comments on added lines of src/, ci/, test/ and tools/ are read, and not the generated files. An added line
// opts out with `standards-ok: <reason>` in its own comment; a test file opts out of the assertion count with the
// same marker on any line it adds. A marker with no reason is itself a finding.
//   node ci/standards.js [--ref REV] [--github] [--block]
// --ref: the diff against REV (default HEAD~1; the Plan job passes the base of the paired gates). --github: warning
// annotations on the lines and the job summary. It reports and exits 0 unless --block is given, then exits 1 when
// anything is found.
const { execFileSync } = require('child_process');
const { ROOT, summary, esc } = require('./lib');

// room for the diff of a large change (256 MiB); git's output is read whole
const GIT_BUFFER = 1 << 28;
// the part of an offending line a report shows, and the most warning annotations one run writes (GitHub keeps at most
// 10 warning annotations per step and 50 per job; the job summary lists every finding)
const SHOWN_CHARS = 100, MAX_ANNOTATIONS = 50;
const SCOPE = /^(src|ci|test|tools)\//;
const GENERATED = /^(src\/(i18n_[a-z]+|cyr|seasong)\.js|src\/.*\.min\.js|tools\/vendor\/|test\/fixtures\/)/;
const COMMENTED = /\.(js|mjs|cjs|ts|py|yml|yaml|sh|css|html)$/;
const TEST_FILE = /^test\/(t_[^/]*\.js|[^/]*_cmd\.js)$/;

// `was`, `now` and `no longer` alone describe code as it is; they count only beside a verb of change
const CHANGED = 'replaced|removed|added|changed|moved|renamed|dropped|fixed|introduced|split|merged|deleted|rewritten|extracted|cut|clamped|capped';
const HISTORY = [
  [new RegExp(`\\bwas (?:then |first |later )?(?:${CHANGED})\\b`, 'i'), 'was <changed>'], [/\bused to\b/i, 'used to'],
  [/\bnow (?:\w+ )?(?:has|have|caches|stores?|keeps?|clamps?|holds?|reads?|takes?|uses?|runs?|shows?|draws?|calls?|returns?|lives?|goes|comes|sits)\b/i, 'now <verb>'],
  [/\bpreviously\b/i, 'previously'], [/\bno longer (?:has|have|holds?|reads?|takes?|uses?|runs?|shows?|draws?|calls?|needs?|exists?|returns?|goes|comes)\b/i, 'no longer <verb>'],
  [/\breplaces\b/i, 'replaces'], [/\binstead of the old\b/i, 'instead of the old'],
  // (a version inside a path, notes/constructions-v16/, or before a file's extension, SPEC-v17.md, is a name, not a label;
  // a point release, a release series ending in .x and a label after a hyphen are labels)
  [/(?<![/\w])v1\d(?:\.\d+)*(?:\.x)?(?:-beta(?:\.\d+)?)?\b(?![\w.-]*\/)(?!\.(?:md|js|json|html|txt|py|ya?ml|css)\b)/i, 'a version label'], [/(?<![-_/.\w])beta\.\d+\b(?![/.]\w)/i, 'a version label'],
  [/\bwaves? \d+\b/i, 'a wave label'],
  [/\b(?:fixed|fixes|added|removed|changed|introduced) (?:in|by|after) #\d+/i, 'an issue number as a changelog'],
  [/\bafter #\d+/i, 'an issue number as a changelog'],
];
const PLAN = [
  [/\b[A-Z]\d+ (?:item|W\d|batch|step)\b/, 'a plan label'],
  [/#\d+ (?:item|step|phase|part) \d+/i, 'an issue number as a plan step'],
  [/\b(?:item|step|phase) \d+ of #\d+/i, 'an issue number as a plan step'],
  [/\[[A-Za-z]{1,3}\d+(?: [^\]]*)?\]/, 'a bracketed plan label'],
  // (the number of a review round's finding, bracketed or not: a review, check or verify item, a UX item, a
  // regression or speed item; a numbered review round itself, outside a path; a suite under test/ names the finding
  // its rows pin, so the rule leaves test/ alone)
  [/\b(?:review|check) (?:user|app|ux)-\d+\b|\b(?:verify|regress|speed)-\d+\b|\bUX ?\d{1,3}\b|(?<!\/)\br\d+ review\b/, 'a review label',
    /^test\//],
];
const MARKER = /standards-ok:(.*)$/;
// a call that checks something: check(, ok(, assert( and assert.method(; not a definition (function check(, ok = (...))
const ASSERT = /(?<![.\w$])(?<!function\s)(?:check|ok|assert)\s*\(|(?<![.\w$])assert\.\w+\s*\(/g;

// the comment parts of one added line: `//`, `/* */`, ` * ` and `<!-- -->` anywhere outside a string, and `#` in Python,
// YAML and shell. A string is read by quotes on this line only.
function commentParts(line, file) {
  const hash = /\.(py|ya?ml|sh)$/.test(file);
  const t = line.trimStart();
  if (/^\*(?!\/)/.test(t)) return [t.slice(1)];
  const out = [];
  let q = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue; }
    if (c === '\'' || c === '"' || c === '`') { if (!(c === '\'' && /\w/.test(line[i - 1] || ''))) q = c; continue; }
    if (!hash && c === '/' && line[i + 1] === '/' && line[i - 1] !== ':') return [...out, line.slice(i + 2)];
    if (!hash && c === '/' && line[i + 1] === '*') {
      const e = line.indexOf('*/', i + 2);
      if (e < 0) return [...out, line.slice(i + 2)];
      out.push(line.slice(i + 2, e));
      i = e + 1;
      continue;
    }
    if (c === '<' && line.startsWith('<!--', i)) return [...out, line.slice(i + 4)];
    if (hash && c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return [...out, line.slice(i + 1)];
  }
  return out;
}
const commentOf = (line, file) => commentParts(line, file).join(' ');

// the assertions on one line of code: how many calls it holds
function assertionsOf(line, file) {
  let code = line;
  for (const c of commentParts(line, file)) code = code.replace(c, '');
  return (code.match(ASSERT) || []).length;
}

// unified diff (-U0) -> [{ file, deleted, added: [{ n, text }], removed: [text] }]: a renamed file under its new name, a
// deleted file under its old one with only removed lines
function parseDiff(text) {
  const out = [];
  let cur = null, n = 0, from = null;
  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) { cur = null; from = null; continue; }
    if (raw.startsWith('--- ')) { from = raw === '--- /dev/null' ? null : raw.slice(4).replace(/^a\//, ''); continue; }
    if (raw.startsWith('+++ ')) {
      const to = raw === '+++ /dev/null' ? null : raw.slice(4).replace(/^b\//, '');
      cur = { file: to || from, deleted: !to, created: !from, added: [], removed: [] };
      out.push(cur);
      continue;
    }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
    if (h) { n = +h[1]; continue; }
    if (!cur) continue;
    if (raw.startsWith('+')) cur.added.push({ n: n++, text: raw.slice(1) });
    else if (raw.startsWith('-')) cur.removed.push(raw.slice(1));
  }
  return out;
}

const LEDGER = 'ci/retired_suites.js';
// the suites a parsed diff retires (a Set of test/ paths), and the findings of ledger entries for files it does not delete.
// baseOf(path): the text of a file at the diff's base, or null (a suite in no shard line there ran in the catch-all shard)
function retiredBy(files, baseOf = () => null) {
  const byFile = (name) => files.find((f) => f.file === name) || { added: [], removed: [] };
  const entry = (b) => new RegExp(`^\\s*'${b.replace(/[.]/g, '\\.')}':`);
  const named = (b) => new RegExp(`'${b.replace(/[.]/g, '\\.')}[#']`);
  // dropped from a list: a removed line names it and no added line does
  const dropped = (name, re) => { const f = byFile(name); return f.removed.some((l) => re.test(l)) && !f.added.some((a) => re.test(a.text)); };
  const deleted = new Set(files.filter((f) => f.deleted && TEST_FILE.test(f.file)).map((f) => f.file));
  const retired = new Set(), found = [];
  for (const a of byFile(LEDGER).added) {
    const m = /^\s*'([^']+_cmd\.js|t_[^']+\.js)':\s*(['`"])(.*)$/.exec(a.text);
    if (!m) continue;
    const file = 'test/' + m[1], b = m[1];
    if (!deleted.has(file)) { found.push({ file: LEDGER, line: a.n, rule: 'retired', text: a.text.trim(), why: `names ${file}, which this change does not delete` }); continue; }
    if (!m[3].replace(/['`",\s]/g, '')) continue;   // (no reason: not retired)
    if (b.startsWith('t_')) { retired.add(file); continue; }
    // (in ci/browser_suites.js only an EXCLUDED line, whose value is its reason string, counts: a SUITES or TIMING entry
    // dropped alone leaves the suite running)
    const excluded = new RegExp(entry(b).source + `\\s*'`);
    const shardsBase = baseOf('ci/browser_shards.js');
    const offShards = dropped('ci/browser_shards.js', named(b)) || (shardsBase != null && !named(b).test(shardsBase));
    const gone = (dropped('ci/suite_views.js', entry(b)) && offShards) || dropped('ci/browser_suites.js', excluded);
    if (gone) retired.add(file);
  }
  return { retired, found };
}

// the findings of a parsed diff: [{ file, line, rule, text, why }]; baseOf as for retiredBy
function check(files, baseOf) {
  const { retired, found } = retiredBy(files, baseOf), counted = [];
  for (const f of files) {
    if (!SCOPE.test(f.file) || GENERATED.test(f.file)) continue;
    const marked = f.added.some((a) => (MARKER.exec(commentOf(a.text, f.file)) || [])[1]?.trim());
    if (COMMENTED.test(f.file)) {
      for (const a of f.added) {
        const c = commentOf(a.text, f.file);
        if (!c) continue;
        const m = MARKER.exec(c);
        if (m) {
          if (!m[1].trim()) found.push({ file: f.file, line: a.n, rule: 'marker', text: a.text.trim(), why: 'standards-ok: needs a reason' });
          continue;
        }
        for (const [rule, list] of [['history', HISTORY], ['plan', PLAN]]) {
          for (const [re, what, skip] of list) if (!(skip && skip.test(f.file)) && re.test(c)) { found.push({ file: f.file, line: a.n, rule, text: a.text.trim(), why: what }); break; }
        }
      }
    }
    if (TEST_FILE.test(f.file) && !marked && !retired.has(f.file)) {
      const count = (lines) => lines.reduce((s, l) => s + assertionsOf(l, f.file), 0);
      counted.push({ f, before: count(f.removed), after: count(f.added.map((a) => a.text)) });
    }
  }
  // assertions moved into a file the diff creates (a split) are not dropped; a gain in a file that already existed does not
  // make up for a loss elsewhere
  let moved = counted.filter((x) => x.f.created).reduce((s, x) => s + x.after, 0);
  for (const { f, before: b, after: a } of counted) {
    if (a >= b || f.created) continue;
    const lost = b - a, covered = Math.min(lost, moved);
    moved -= covered;
    if (covered < lost) found.push({ file: f.file, line: f.added.length ? f.added[0].n : 1, rule: 'asserts', text: '', why: `${b} assertions removed, ${a} added${f.deleted ? ' (file deleted)' : ''}${covered ? `; ${covered} of them moved to a new file` : ''}` });
  }
  return found;
}

function report(found) {
  const rules = { history: 'history words in a comment', plan: 'plan label in a comment', asserts: 'dropped test assertions', retired: 'ledger entry for a file kept', marker: 'opt-out without a reason' };
  if (!found.length) return '### Standards check: nothing found\n\nA finding fails the Gate, which runs this check with --block. Opt a line out with `standards-ok: <reason>` in its comment.\n';
  const rows = found.map((x) => `| ${x.rule} | \`${x.file}:${x.line}\` | ${esc(x.why)} | ${x.text ? '`' + esc(x.text.slice(0, SHOWN_CHARS)) + '`' : ''} |`);
  const by = Object.entries(rules).map(([k, v]) => [v, found.filter((x) => x.rule === k).length]).filter(([, c]) => c).map(([v, c]) => `${c} ${v}`);
  return ['### Standards check: ' + by.join(', '), '', 'Each fails the Gate, which runs this check with --block: fix it, or opt its line out with `standards-ok: <reason>` in its comment.', '',
    '| rule | where | found | line |', '|---|---|---|---|', ...rows, ''].join('\n');
}

function diffAgainst(ref) {
  return execFileSync('git', ['diff', '--unified=0', '--no-color', '--find-renames', ref, '--', 'src', 'ci', 'test', 'tools'], { cwd: ROOT, encoding: 'utf8', maxBuffer: GIT_BUFFER });
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const ref = a.includes('--ref') ? a[a.indexOf('--ref') + 1] : 'HEAD~1';
  const found = check(parseDiff(diffAgainst(ref)), (file) => { try { return execFileSync('git', ['show', `${ref}:${file}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: GIT_BUFFER }); } catch (e) { return null; } });
  const gh = a.includes('--github') || !!process.env.GITHUB_ACTIONS;
  if (gh) for (const x of found.slice(0, MAX_ANNOTATIONS)) console.log(`::warning file=${x.file},line=${x.line},title=standards ${x.rule}::${x.why}`);
  for (const x of found) console.log(`${x.file}:${x.line}: ${x.rule}: ${x.why}${x.text ? '  ' + x.text.slice(0, SHOWN_CHARS) : ''}`);
  summary(report(found));
  process.exit(a.includes('--block') && found.length ? 1 : 0);
}
module.exports = { commentOf, assertionsOf, parseDiff, check, retiredBy, report };

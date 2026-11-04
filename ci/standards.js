'use strict';
// The standards check: what CONTRIBUTING.md's Code rules and Review checklist let a script see, read from the lines a
// change adds (the Plan job runs it; ci/README.md, Standards check). Three rules:
//   history   a comment that tells the code's history: the words, version and wave labels and changelog issue numbers
//             of HISTORY below
//   plan      a plan label in a comment: the labels of PLAN below
//   asserts   a test file (test/t_*.js, test/*_cmd.js) whose diff removes more assertions (check/ok/assert calls) than it
//             adds, unless the diff creates a test file that takes them over (a split)
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
  [/\bv1\d(?:\.\d+)?(?:-beta(?:\.\d+)?)?\b/i, 'a version label'], [/\bbeta\.\d+\b/i, 'a version label'],
  [/\bwaves? \d+\b/i, 'a wave label'],
  [/\b(?:fixed|fixes|added|removed|changed|introduced) (?:in|by|after) #\d+/i, 'an issue number as a changelog'],
  [/\bafter #\d+/i, 'an issue number as a changelog'],
];
const PLAN = [
  [/\b[A-Z]\d+ (?:item|W\d|batch|step)\b/, 'a plan label'],
  [/#\d+ (?:item|step|phase|part) \d+/i, 'an issue number as a plan step'],
  [/\b(?:item|step|phase) \d+ of #\d+/i, 'an issue number as a plan step'],
  [/\[[A-Za-z]{1,3}\d+(?: [^\]]*)?\]/, 'a bracketed plan label'],
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

// the findings of a parsed diff: [{ file, line, rule, text, why }]
function check(files) {
  const found = [], counted = [];
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
          for (const [re, what] of list) if (re.test(c)) { found.push({ file: f.file, line: a.n, rule, text: a.text.trim(), why: what }); break; }
        }
      }
    }
    if (TEST_FILE.test(f.file) && !marked) {
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
  const rules = { history: 'history words in a comment', plan: 'plan label in a comment', asserts: 'dropped test assertions', marker: 'opt-out without a reason' };
  if (!found.length) return '### Standards check: nothing found\n\nReport only (no check here fails the Gate). Opt a line out with `standards-ok: <reason>` in its comment.\n';
  const rows = found.map((x) => `| ${x.rule} | \`${x.file}:${x.line}\` | ${esc(x.why)} | ${x.text ? '`' + esc(x.text.slice(0, SHOWN_CHARS)) + '`' : ''} |`);
  const by = Object.entries(rules).map(([k, v]) => [v, found.filter((x) => x.rule === k).length]).filter(([, c]) => c).map(([v, c]) => `${c} ${v}`);
  return ['### Standards check: ' + by.join(', '), '', 'Report only. Review each; opt a line out with `standards-ok: <reason>` in its comment.', '',
    '| rule | where | found | line |', '|---|---|---|---|', ...rows, ''].join('\n');
}

function diffAgainst(ref) {
  return execFileSync('git', ['diff', '--unified=0', '--no-color', '--find-renames', ref, '--', 'src', 'ci', 'test', 'tools'], { cwd: ROOT, encoding: 'utf8', maxBuffer: GIT_BUFFER });
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const ref = a.includes('--ref') ? a[a.indexOf('--ref') + 1] : 'HEAD~1';
  const found = check(parseDiff(diffAgainst(ref)));
  const gh = a.includes('--github') || !!process.env.GITHUB_ACTIONS;
  if (gh) for (const x of found.slice(0, MAX_ANNOTATIONS)) console.log(`::warning file=${x.file},line=${x.line},title=standards ${x.rule}::${x.why}`);
  for (const x of found) console.log(`${x.file}:${x.line}: ${x.rule}: ${x.why}${x.text ? '  ' + x.text.slice(0, SHOWN_CHARS) : ''}`);
  summary(report(found));
  process.exit(a.includes('--block') && found.length ? 1 : 0);
}
module.exports = { commentOf, assertionsOf, parseDiff, check, report };

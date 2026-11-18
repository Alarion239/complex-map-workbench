'use strict';
// The CDP kit's nav(url) waits for the new page itself: its load event, the app's start-up and the page's quiet
// (test/cdp_kit/cdpd.js, kit_nav_cmd.js). A suite that sleeps a fixed time after it, or calls a sleep-based settle(ms), waits
// twice, and the fixed time is what a slower runner breaks. This test reads the browser suites CI runs in the steps view and
// finds each `nav(` followed straight away by a fixed wait: `sleep(N)`, or `settle(N)` where the file's settle is sleep-based,
// as the next statement on its line or at the start of the next line. A condition wait between them (`shapesIn()`, `hooked()`)
// is another matter. A fixed wait that waits for something nav's quiet does not cover says so with `nav-sleep: <what it waits
// for>` in a comment on either of those lines.
// test/nav_waits_baseline.json counts the sites a suite may still hold, and it is empty by design: every fixed wait after nav()
// waits on a condition or gives its reason, so the test fails on any new site (wait on a condition, or give the reason), and on
// an entry above the sites found (lower it: `node test/t_nav_waits.js write`), so the file cannot go stale.
// Run: node test/t_nav_waits.js   (write: rewrite the baseline from the sites found now)
const fs = require('fs');
const path = require('path');

const dir = __dirname, BASELINE = path.join(dir, 'nav_waits_baseline.json');
const REASON = /nav-sleep:\s*\S/;
// the suites' own settle(ms): a sleep and two animation frames; a few use the kit's settled instead and are not fixed waits
const SLEEPY_SETTLE = /\bconst settle = async \(ms[^)]*\) => \{ await sleep\(ms\)/;

// the index of the ')' that closes the call whose '(' is at i: strings, template literals and their ${ } are skipped
function closeOf(s, i) {
  const stack = [];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j], top = stack[stack.length - 1];
    if (top === "'" || top === '"' || top === '`') {
      if (c === '\\') j++;
      else if (c === top) stack.pop();
      else if (top === '`' && c === '$' && s[j + 1] === '{') { stack.push('{'); j++; }
    } else if (c === "'" || c === '"' || c === '`') stack.push(c);
    else if (top === '{') { if (c === '}') stack.pop(); else if (c === '{') stack.push('{'); }
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return j;
  }
  return -1;
}

// the 1-based lines of a suite's text where a nav() is followed straight away by a fixed wait with no reason given
function waitSites(text) {
  const lines = text.split(/\r?\n/), sleepy = SLEEPY_SETTLE.test(text);
  const fixed = new RegExp('^;?\\s*await\\s+(?:sleep' + (sleepy ? '|settle' : '') + ')\\(\\s*\\d+\\s*\\)');
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\/\//.test(lines[i])) continue;
    for (let at = lines[i].indexOf('await nav('); at >= 0; at = lines[i].indexOf('await nav(', at + 1)) {
      const end = closeOf(lines[i], at + 'await nav'.length);
      if (end < 0) continue;
      // the statement right after the call: on its line, else the next line's first
      const rest = lines[i].slice(end + 1), tail = /^;?\s*$/.test(rest) ? (lines[i + 1] || '').trim() : rest;
      if (fixed.test(tail) && !REASON.test(lines[i] + ' ' + (lines[i + 1] || ''))) found.push(i + 1);
    }
  }
  return found;
}

let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

// the finder itself, on sample suites
const SETTLE_DEF = 'const settle = async (ms = 400) => { await sleep(ms); await ev(FRAMES); };\n';
const sample = (code) => waitSites(SETTLE_DEF + code).length;
check('a nav() then sleep(N) is a site', sample('await nav(`${U}?ns=a`); await sleep(1500);') === 1);
check('a nav() then settle(N) on the next line is a site', sample('await nav(`${U}?ns=a`);\nawait settle(900);') === 1);
check('a call with parentheses and a template inside is read whole', sample("await nav(`${f(1, ')')}`); await settle(500); const q = await ev('1');") === 1);
check('two nav() on a line are each read', sample('await nav(a); await nav(b); await sleep(300);') === 1);
check('a reason on the line makes it no site', sample('await nav(a); await sleep(2600); // nav-sleep: nothing shows, which only time can show') === 0);
check('a condition wait between them is no site', sample('await nav(a); await shapesIn(11); await settle(500);') === 0);
check('a nav() with nothing after it is no site', sample('await nav(a);\nconst st = await ST();') === 0);
check('a settle that is not a sleep is no site', waitSites('const settle = async (ms = 300) => { await settled({ floor: ms }); };\nawait nav(a); await settle(900);').length === 0);
check('a commented nav() is no site', sample('// await nav(a); await sleep(900);') === 0);

// the suites CI runs in the steps view: the classic and port ones go with the classic views, and the excluded files are
// recorders and benchmarks
const { VIEWS } = require('../ci/suite_views.js'), { EXCLUDED } = require('../ci/browser_suites.js');
const suites = fs.readdirSync(dir).filter((f) => /_cmd\.js$/.test(f) && VIEWS[f] && VIEWS[f].view === 'steps' && !EXCLUDED[f]);
const found = {};
for (const f of suites) {
  const sites = waitSites(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (sites.length) found[f] = sites.length;
}
if (process.argv[2] === 'write') {
  fs.writeFileSync(BASELINE, JSON.stringify(found, null, 1) + '\n');
  console.log(`wrote ${path.basename(BASELINE)}: ${Object.keys(found).length} suites, ${Object.values(found).reduce((a, b) => a + b, 0)} sites`);
  process.exit(0);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const more = [], stale = [];
for (const f of new Set([...Object.keys(baseline), ...Object.keys(found)])) {
  const was = baseline[f] || 0, now = found[f] || 0;
  if (now > was) more.push(`${f}: ${now} sites, the baseline has ${was}`);
  if (now < was) stale.push(`${f}: ${now} sites, the baseline has ${was}`);
}
check('no suite has a nav() followed by a fixed wait that the baseline does not hold (wait on a condition, or give a nav-sleep reason)', more.length === 0, more.join('\n  '));
check('no baseline entry is above the sites found (run: node test/t_nav_waits.js write)', stale.length === 0, stale.join('\n  '));
console.log(`${n - bad}/${n} passed${bad ? ', ' + bad + ' FAILED' : ''}`);
process.exit(bad ? 1 : 0);

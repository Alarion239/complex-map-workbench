'use strict';
// A browser suite opens a page through the CDP kit: go(url) / load(...) / loadView(...) / nav(url) wait for the page's load event
// and the app's start-up, and reopen a document whose body stopped arriving (test/cdp_kit/cdpd.js: docStalled(), GO_STALL_MS,
// LOAD_RELOADS). A suite that calls send('Page.navigate', ...) itself has none of that: a stalled load waits out the whole
// settled() limit (60 s) and throws, usually as `ReferenceError: __cmwSteps is not defined` or a read of `undefined`.
// This test reads the browser suites (test/*_cmd.js) and the kits they share (test/lib/*.js) and finds each raw
// send('Page.navigate' (single or double quotes) on a line that is not a comment. The kit's own go() / load() / nav() are
// the implementation (test/cdp_kit/) and are not read. A site that has to stay (a suite that tests navigation itself, a smoke
// test of an old release) says why with `raw-navigate: <why>` in a comment on its line or the line before.
// test/raw_navigates_baseline.json counts the sites a file may still hold: the test fails on any new site (open the page with
// go() / loadView(), or give the reason), and on an entry above the sites found (lower it: `node test/t_raw_navigates.js
// write`), so the file cannot go stale. `write` only lowers: it refuses to raise an entry or add a file (`write --raise` does, for the
// baseline's first writing). A tranche that moves a suite to go() / loadView() lowers its entry in the same change.
// Run: node test/t_raw_navigates.js   (write: rewrite the baseline from the sites found now)
const fs = require('fs');
const path = require('path');

const dir = __dirname, BASELINE = path.join(dir, 'raw_navigates_baseline.json');
const REASON = /raw-navigate:\s*\S/;
const RAW = /\bsend\(\s*(['"])Page\.navigate\1/g;

// the 1-based lines of a text where a raw Page.navigate is sent with no reason given (a line holding two calls is listed twice)
function rawSites(text) {
  const lines = text.split(/\r?\n/), found = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\/\//.test(lines[i])) continue;
    const n = (lines[i].match(RAW) || []).length;
    if (!n || REASON.test(lines[i] + ' ' + (i ? lines[i - 1] : ''))) continue;
    for (let k = 0; k < n; k++) found.push(i + 1);
  }
  return found;
}

// the entries a rewrite of the baseline would raise (or add): what `write` refuses
const raisedBy = (found, was) => Object.keys(found).filter((f) => found[f] > (was[f] || 0)).map((f) => `${f}: ${found[f]} sites, the baseline has ${was[f] || 0}`);

let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

// the finder itself, on sample text
check("a send('Page.navigate', ...) is a site", rawSites("await send('Page.navigate', { url });").length === 1);
check('double quotes are read too', rawSites('await send("Page.navigate", { url });').length === 1);
check('a method of the same prefix is no site', rawSites("const h = await send('Page.navigateToHistoryEntry', { entryId: 1 });").length === 0);
check('a send on another method is no site', rawSites("await send('Page.reload');").length === 0);
check('two calls on a line are two sites', rawSites("await send('Page.navigate', { url: a }); await sleep(300); await send('Page.navigate', { url: b });").length === 2);
check('a commented line is no site', rawSites("// await send('Page.navigate', { url });").length === 0);
check('a reason on the line makes it no site', rawSites("await send('Page.navigate', { url });   // raw-navigate: this suite tests the navigation itself").length === 0);
check('a reason on the line before makes it no site', rawSites("// raw-navigate: an old release has no go()\nawait send('Page.navigate', { url });").length === 0);
check('a reason two lines before does not count', rawSites("// raw-navigate: why\nconst a = 1;\nawait send('Page.navigate', { url });").length === 1);
check('an empty reason is no reason', rawSites("await send('Page.navigate', { url }); // raw-navigate:").length === 1);
check('a rewrite that raises an entry or adds a file is listed, one that lowers or keeps them is not', raisedBy({ a: 3, b: 1, c: 2 }, { a: 2, b: 1, d: 4 }).length === 2 && raisedBy({ a: 1, b: 1 }, { a: 2, b: 1, d: 4 }).length === 0);
check('the sites are listed by line', rawSites("a();\nawait send('Page.navigate', { url });\nb();").join() === '2');

// the browser suites and the kits they share
const files = [
  ...fs.readdirSync(dir).filter((f) => /_cmd\.js$/.test(f)),
  ...fs.readdirSync(path.join(dir, 'lib')).filter((f) => /\.js$/.test(f)).map((f) => 'lib/' + f),
].sort();
const found = {};
for (const f of files) {
  const sites = rawSites(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (sites.length) found[f] = sites.length;
}
if (process.argv[2] === 'write') {
  const was = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
  const raised = raisedBy(found, was);
  if (raised.length && process.argv[3] !== '--raise') {
    console.log(`refusing to raise the baseline (open the page with go() / loadView(), or give a raw-navigate reason; --raise overrides):\n  ${raised.join('\n  ')}`);
    process.exit(1);
  }
  fs.writeFileSync(BASELINE, JSON.stringify(found, null, 1) + '\n');
  console.log(`wrote ${path.basename(BASELINE)}: ${Object.keys(found).length} files, ${Object.values(found).reduce((a, b) => a + b, 0)} sites`);
  process.exit(0);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const more = [], stale = [];
for (const f of new Set([...Object.keys(baseline), ...Object.keys(found)])) {
  const was = baseline[f] || 0, now = found[f] || 0;
  if (now > was) more.push(`${f}: ${now} sites, the baseline has ${was}`);
  if (now < was) stale.push(`${f}: ${now} sites, the baseline has ${was}`);
}
check('no file has a raw Page.navigate that the baseline does not hold (open the page with go() / loadView(), or give a raw-navigate reason)', more.length === 0, more.join('\n  '));
check('no baseline entry is above the sites found (run: node test/t_raw_navigates.js write)', stale.length === 0, stale.join('\n  '));
console.log(`${n - bad}/${n} passed${bad ? ', ' + bad + ' FAILED' : ''}`);
process.exit(bad ? 1 : 0);

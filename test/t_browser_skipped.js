// ci/browser_skipped.js: a suite's `skipped` rows (rows that made no check because the runner was late) are read from its result and
// listed in ci/browser.js's summary. Run: node test/t_browser_skipped.js
'use strict';
const { skippedOf, skippedMarkdown } = require('../ci/browser_skipped');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
const esc = (s) => String(s).replace(/\|/g, '\\|'), short = (v, n = 300) => (String(v).length > n ? String(v).slice(0, n) + '…' : String(v));

ok('a result with a skipped list gives its rows', JSON.stringify(skippedOf({ pass: 5, of: 5, skipped: ['x: the 400 ms block', 'key: the wheel'] })) === '["x: the 400 ms block","key: the wheel"]');
ok('a result with an empty list has none', skippedOf({ skipped: [] }).length === 0);
for (const [what, out] of [['no skipped', { pass: 1, of: 1 }], ['a skipped that is not a list', { skipped: 'x' }], ['null', null], ['undefined', undefined], ['a number', 3]]) ok(`${what}: none`, skippedOf(out).length === 0, out);
ok('a row that is not a string is read as its text', skippedOf({ skipped: [3] })[0] === '3');

ok('nothing skipped: no lines in the summary', skippedMarkdown([], esc, short).length === 0);
const md = skippedMarkdown([{ name: 'tour_auto_cmd.js', row: 'x: the 400 ms block | the poll was late' }, { name: 'tour_auto_classic_cmd.js', row: 'key: the wheel' }], esc, short).join('\n');
ok('the summary names each suite and row', /`tour_auto_cmd\.js`/.test(md) && /`tour_auto_classic_cmd\.js`/.test(md) && /key: the wheel/.test(md), md);
ok('a "|" in a row does not break the table', /the 400 ms block \\\| the poll was late/.test(md), md);
ok('the list is in one details block that says they are not failures', (md.match(/<details>/g) || []).length === 1 && /not failures/.test(md), md);
const long = skippedMarkdown([{ name: 'a_cmd.js', row: 'r'.repeat(500) }], esc, short).join('\n');
ok('a long row is cut', long.length < 800 && /…/.test(long), long.length);

console.log(`t_browser_skipped: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

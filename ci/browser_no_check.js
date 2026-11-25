// A suite may return `noCheck`: the names of the rows that made no check in this run because of the runner (tour_auto's spike rows when
// the poll came too late: the row passes, and this list is what says it tested nothing). ci/browser.js shows them in the suite's log, in
// its head line and in the summary; they are not failures. (The field is `noCheck`, not `skipped`: tour_phone and tour_audit return a
// `skipped` of their own, the tour's "step skipped" log lines, which a normal run has. A result with no `noCheck`, or one that is not a
// list, has none.)
'use strict';

const noCheckOf = (out) => (out && Array.isArray(out.noCheck) ? out.noCheck.map(String) : []);

// the summary's lines for the suites' rows that made no check: [{ name, row }] -> markdown lines ([] when none); `esc` and `short` are browser.js's
const noCheckMarkdown = (list, esc, short) => (!list.length ? [] : [
  '<details><summary>Rows that made no check in this run (the runner was too late for them: not failures)</summary>', '',
  '| suite | row |', '|---|---|', ...list.map((x) => `| \`${x.name}\` | ${esc(short(x.row, 240))} |`), '', '</details>', '']);

module.exports = { noCheckOf, noCheckMarkdown };

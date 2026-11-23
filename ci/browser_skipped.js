// A suite may return `skipped`: the names of the rows that made no check in this run because of the runner (tour_auto's spike rows
// when the poll came too late: the row passes, and this list is what says it tested nothing). ci/browser.js shows them in the suite's
// log, in its head line and in the summary; they are not failures. (A result with no `skipped`, or one that is not a list, has none.)
'use strict';

const skippedOf = (out) => (out && Array.isArray(out.skipped) ? out.skipped.map(String) : []);

// the summary's lines for the suites' skipped rows: [{ name, row }] -> markdown lines ([] when none); `esc` and `short` are browser.js's
const skippedMarkdown = (list, esc, short) => (!list.length ? [] : [
  '<details><summary>Rows that made no check in this run (the runner was too late for them: not failures)</summary>', '',
  '| suite | row |', '|---|---|', ...list.map((x) => `| \`${x.name}\` | ${esc(short(x.row, 240))} |`), '', '</details>', '']);

module.exports = { skippedOf, skippedMarkdown };

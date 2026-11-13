// ci/browser_suites.js: the TIMING entries whose `measured` predicate decides from a check's recorded detail whether its
// failure is a timing one. tour_auto's Grieg check records [durMs, caps, lts] (caps: [ms, text] per caption shown); a
// caption that came late is timing, a caption that never came (or a piece with no duration) is a correctness failure.
// Run: node test/t_browser_suites.js
'use strict';
const { TIMING } = require('../ci/browser_suites');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

// the entry of a suite's list that a failed check of that name and detail matches (ci/browser.js: matches)
const timing = (file, name, detail) => (TIMING[file] || []).some((k) => k.re.test(name) && (!k.measured || !!k.measured(detail)));

const GRIEG = 'Grieg: captions change at 0.2, 0.29 and 0.51 of the playback (± 300 ms, from its start, late only as far as the page was blocked: the branch-point pairs, the second downbeat crack, the second lap)';
// the first 24 characters of each caption, as the suite records them (src/tour.js, the sound/song step)
const CAPS = [[0, 'Each note is a phase lin'], [4200, 'Each step is two branch '], [6100, 'The crack is the branch '], [10700, 'The second lap is the sa'], [21000, 'Every note was a phase l']];
const detail = (caps, dur = 21000) => [dur, caps, []];

ok('Grieg: the captions of today, late (a loaded runner), are timing', timing('tour_auto_cmd.js', GRIEG, detail(CAPS.map(([t, c]) => [t + 900, c]))));
ok('Grieg: the captions of today, on time, are timing too (the check failed on its time alone)', timing('tour_auto_cmd.js', GRIEG, detail(CAPS)));
for (const i of [0, 1, 2, 3]) ok(`Grieg: a missing caption (${CAPS[i][1].slice(0, 12)}) is not timing`, !timing('tour_auto_cmd.js', GRIEG, detail(CAPS.filter((_, k) => k !== i))), CAPS[i]);
ok('Grieg: the captions of before 65d46d45 do not stand in for today\'s', !timing('tour_auto_cmd.js', GRIEG, detail([[0, 'The cut'], [3000, 'Each turn is'], [9000, 'The ending']])));
ok('Grieg: a piece with no duration is not timing', !timing('tour_auto_cmd.js', GRIEG, detail(CAPS, 0)));
ok('Grieg: no captions at all is not timing', !timing('tour_auto_cmd.js', GRIEG, detail([])));
ok('Grieg: a detail of another shape is not timing', !timing('tour_auto_cmd.js', GRIEG, CAPS) && !timing('tour_auto_cmd.js', GRIEG, undefined));
ok('Grieg: the other checks of the piece (no move, moves on) stay gated', !timing('tour_auto_cmd.js', 'Grieg: no move for the whole piece, then the result line', detail(CAPS)));

console.log(`t_browser_suites: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

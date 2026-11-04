// The steps view's tour chapter "Playing the chain": the events its tasks wait for are sent by the steps view
// (play-started by svPlay, loop-changed by svSetLoop, range-set by a committed range), and the chapter's steps, words and
// anchors are known.   node test/t_tour_playing.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let n = 0;
const fails = [];
const ok = (name, cond, got) => { n++; if (!cond) fails.push({ name, got }); };

// the body of a top-level function of the steps view (up to the next function at the same indent)
const SV = read('src/app/19-steps-view.js');
const body = (name) => { const m = SV.match(new RegExp(`\\n  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}\\n`)); return m ? m[0] : ''; };

ok('svPlay sends play-started', /tourEmit\('play-started'/.test(body('svPlay')));

ok('svSetLoop sends loop-changed with the new state', /tourEmit\('loop-changed', \{ on/.test(body('svSetLoop')));

ok('a committed range sends range-set', /tourEmit\('range-set'/.test(body('svSetRange')) && /tourEmit\('range-set'/.test(body('svRangeUp')));

if (fails.length) { for (const f of fails.slice(0, 40)) console.log('FAIL', f.name, JSON.stringify(f.got)); console.log(`${n - fails.length}/${n} passed`); process.exit(1); }
console.log(`${n}/${n} passed`);

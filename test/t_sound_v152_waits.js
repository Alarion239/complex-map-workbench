// The fixed waits of the browser suite test/sound_v152_cmd.js (#1214). Its waits for the page and for the audio are
// condition-based (settled(), go()); what stays a fixed time is input pacing (the pointer's trace, a long press), a
// latency the engine reports, and a window in which silence is the check. Each kept call site is listed below with its
// count, so a new fixed sleep or setTimeout in the suite fails here until it is listed with its reason.
//   node test/t_sound_v152_waits.js
const fs = require('fs');
const path = require('path');

const SUITE = path.join(__dirname, 'sound_v152_cmd.js');
const ALLOWED = [
  { re: /sleep\(dt\)/, n: 1, why: 'the pointer glide: one step per frame of the trace' },
  { re: /sleep\(16\)/, n: 5, why: 'the pointer and touch traces: one 60 Hz step each' },
  { re: /sleep\(650\)/, n: 1, why: 'a touch held past the phone long-press threshold' },
  { re: /confirmMs/, n: 1, why: "a slow finger's crossing sounds Sound.HT.HT.confirmMs after it (read from the engine)" },
  { re: /sleep\(300\)/, n: 2, why: 'the notes in flight after a lift or a stroke, read in 300 ms steps until none comes' },
  { re: /setTimeout\(r, 800\)/, n: 1, why: 'silence window: no note while the pointer rests' },
  { re: /setTimeout\(r, 150\)/, n: 1, why: 'silence window: nothing is made after Sound.set off' },
];

const lines = fs.readFileSync(SUITE, 'utf8').split('\n');
const sites = lines.map((l, i) => ({ i: i + 1, l })).filter((x) => /sleep\(|setTimeout\(/.test(x.l));
const counts = ALLOWED.map(() => 0);
const unlisted = [];
for (const s of sites) {
  const k = ALLOWED.findIndex((a) => a.re.test(s.l));
  if (k < 0) unlisted.push(`${s.i}: ${s.l.trim().slice(0, 120)}`);
  else counts[k]++;
}

let bad = 0;
const fail = (msg) => { bad++; console.log('FAIL ' + msg); };
for (const u of unlisted) fail(`fixed wait not listed in ALLOWED (${u})`);
ALLOWED.forEach((a, k) => {
  if (counts[k] !== a.n) fail(`${a.re} has ${counts[k]} call site(s), listed ${a.n} (${a.why})`);
});
const page = lines.filter((l) => /setTimeout\(r, (2200|400)\)|sleep\((400|2200)\)/.test(l));
if (page.length) fail(`the page load waits on a fixed time again: ${page.map((l) => l.trim().slice(0, 100)).join(' | ')}`);
if (!/await settled\(\{ until: `typeof __cmwSound/.test(lines.join('\n'))) fail('loadHere does not wait for the app hooks (settled until __cmwSound)');
console.log(`${sites.length} fixed-wait call sites in sound_v152_cmd.js, ${sites.length - unlisted.length} listed; ${bad ? bad + ' problem(s)' : 'ok'}`);
if (bad) process.exitCode = 1;

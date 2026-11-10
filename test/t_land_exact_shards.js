// Every case of the two exact-glide browser suites (test/steps_land_exact_cmd.js, steps_land_exact_all_cmd.js) runs once
// in CI. CI runs a case by its own run (ci/browser_suites.js, CMW_ONLY = the case's tag) in the shard that lists it
// ('file#label', ci/browser_shards.js), so a case missing from the runs or from the shards does not run at all. This
// compares the tags in test/lib/land_exact.js with the runs and the shards.
//   node test/t_land_exact_shards.js
const fs = require('fs');
const path = require('path');
const { SUITES } = require('../ci/browser_suites.js');
const { SHARDS } = require('../ci/browser_shards.js');
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };

// the cases that a suite's runs do not list, each with the reason (a case in this list must be one the suite would run, and
// has no run); empty: every case has a run
const ALL_EXEMPT = {};

const lib = fs.readFileSync(path.join(__dirname, 'lib', 'land_exact.js'), 'utf8');
const TAGS = [...lib.matchAll(/^\s*\{ tag: '([^']+)'/gm)].map((m) => m[1]);

// the problems of one suite: its runs against the cases it would run, and the runs against the shards
function problems(tags, labels, exempt, shardEntries, file) {
  const bad = [];
  const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
  for (const t of tags) if (!labels.includes(t) && !(t in exempt)) bad.push(`${t}: a case with no run`);
  for (const [l, c] of count(labels)) {
    if (c > 1) bad.push(`${l}: ${c} runs`);
    if (!tags.includes(l)) bad.push(`${l}: a run of no case`);
    if (l in exempt) bad.push(`${l}: run and exempt`);
  }
  for (const t of Object.keys(exempt)) if (!tags.includes(t)) bad.push(`${t}: exempt but not a case`);
  for (const l of labels) {
    const c = shardEntries.filter((e) => e === `${file}#${l}`).length;
    if (c !== 1) bad.push(`${file}#${l}: in ${c} shards`);
  }
  return bad;
}
const entries = SHARDS.flatMap((s) => s.suites);
const FILES = [['steps_land_exact_cmd.js', {}], ['steps_land_exact_all_cmd.js', ALL_EXEMPT]];

ok('the cases are read from land_exact.js (nine)', TAGS.length === 9 && new Set(TAGS).size === 9, TAGS);
for (const [f, exempt] of FILES) {
  const labels = SUITES[f].runs.map((r) => r.label);
  const bad = problems(TAGS, labels, exempt, entries, f);
  ok(`${f}: every case has one run, in one shard`, bad.length === 0, bad);
  ok(`${f}: a run sets CMW_ONLY to its own label`, SUITES[f].runs.every((r) => r.env && r.env.CMW_ONLY === r.label));
}

// controls: each kind of loss fails the check
const L = TAGS.slice(), E = TAGS.map((t) => `x#${t}`);
const has = (bad, s) => bad.some((b) => b.includes(s));
ok('control: a case dropped from the runs fails', has(problems(TAGS, L.slice(1), {}, E, 'x'), `${TAGS[0]}: a case with no run`));
ok('control: a run listed twice fails', has(problems(TAGS, L.concat(L[0]), {}, E, 'x'), `${TAGS[0]}: 2 runs`));
ok('control: a run of no case fails', has(problems(TAGS, L.concat('nope'), {}, E, 'x'), 'nope: a run of no case'));
ok('control: a run in no shard fails', has(problems(TAGS, L, {}, E.filter((e) => e !== `x#${L[0]}`), 'x'), `x#${L[0]}: in 0 shards`));
ok('control: a run in two shards fails', has(problems(TAGS, L, {}, E.concat(`x#${L[0]}`), 'x'), `x#${L[0]}: in 2 shards`));
ok('control: an exemption of a case that is not one fails', has(problems(TAGS, L, { nope: 'r' }, E, 'x'), 'nope: exempt but not a case'));
ok('control: an exemption of a case that has a run fails', has(problems(TAGS, L, { [L[0]]: 'r' }, E, 'x'), `${L[0]}: run and exempt`));

console.log(fails ? `${fails} of ${n} failed` : `all ${n} ok`);
process.exit(fails ? 1 : 0);

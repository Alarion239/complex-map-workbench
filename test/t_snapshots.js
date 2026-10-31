'use strict';
// [#427] ci/snapshots.js: each snapshot names its commit in full (a shallow clone fetches it by itself, which needs the
// whole hash), and every test that reads a snapshot asks for it with snapshotDir, so a missing one fails with what to
// run instead of a bare ENOENT or "Cannot find module".
// Run: node test/t_snapshots.js
const fs = require('fs');
const path = require('path');
const { SNAPSHOTS } = require('../ci/snapshots');

let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

check('three snapshots, each with a full commit hash', SNAPSHOTS.length === 3 && SNAPSHOTS.every((s) => /^[0-9a-f]{40}$/.test(s.commit)), SNAPSHOTS);
const T = __dirname, tests = fs.readdirSync(T).filter((x) => x.endsWith('.js') && x !== 't_snapshots.js');
// (a require or path.join whose string names a snapshot's src/: a path around snapshotDir)
for (const s of SNAPSHOTS) {
  const direct = new RegExp(`(require|path\\.join)\\([^)]*['"][^'"]*${s.dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/src`);
  const by = tests.filter((f) => direct.test(fs.readFileSync(path.join(T, f), 'utf8')));
  check(`${s.dir}/src: no test reads it but through snapshotDir`, !by.length, by);
}
const users = tests.filter((x) => /snapshotDir\('notes\//.test(fs.readFileSync(path.join(T, x), 'utf8')));
check('the snapshot readers ask through snapshotDir', ['constr_between_tests.js', 'constr_perp_tests.js', 'constr_seg_tests.js', 'constr_touch_tests.js', 't_i18n_english.js', 't_i18n_parse.js'].every((f) => users.includes(f)), users);
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);

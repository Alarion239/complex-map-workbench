'use strict';
// Restores the source snapshots some unit tests compare against, from the git history (they were never committed):
//   notes/gate-morph-zp-r1/src  v13, before the strings were wrapped (t_i18n_english, t_i18n_parse)
//   notes/v16.2-candidate/src   v16.2 (t_constr: constr_perp_tests, constr_touch_tests read v16.2's constr.js)
//   notes/v16.3-candidate/src   v16.3 (t_constr: constr_seg_tests reads v16.3's constr.js)
// Needs the full history (actions/checkout with fetch-depth: 0). A snapshot this script wrote carries the commit in
// <dir>/.commit and is replaced when the commit differs; a folder without that file (made by hand) is left as it is.
//   node ci/snapshots.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./lib');

const SNAPSHOTS = [
  { dir: 'notes/gate-morph-zp-r1', commit: '5d5e724', what: 'v13' },
  { dir: 'notes/v16.2-candidate', commit: 'd07ae97', what: 'v16.2' },
  { dir: 'notes/v16.3-candidate', commit: 'c8221ff', what: 'v16.3' },
];

for (const s of SNAPSHOTS) {
  const out = path.join(ROOT, s.dir, 'src'), mark = path.join(ROOT, s.dir, '.commit');
  if (fs.existsSync(out)) {
    if (!fs.existsSync(mark)) { console.log(`${s.dir}/src: present (not written by this script: left as it is)`); continue; }
    if (fs.readFileSync(mark, 'utf8').trim() === s.commit) { console.log(`${s.dir}/src: present (${s.commit})`); continue; }
    fs.rmSync(out, { recursive: true, force: true });
  }
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', s.commit, 'src'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of files) {
    const dest = path.join(ROOT, s.dir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, execFileSync('git', ['show', `${s.commit}:${f}`], { cwd: ROOT, maxBuffer: 1 << 28 }));
  }
  fs.writeFileSync(mark, s.commit + '\n');
  console.log(`${s.dir}/src: ${files.length} files from ${s.commit} (${s.what})`);
}

'use strict';
// Restores the source snapshots some unit tests compare against, from the git history (they were never committed):
//   notes/gate-morph-zp-r1/src  v13, before the strings were wrapped (t_i18n_english, t_i18n_parse)
//   notes/v16.2-candidate/src   v16.2 (t_constr: constr_perp_tests, constr_touch_tests read v16.2's constr.js)
//   notes/v16.3-candidate/src   v16.3 (t_constr: constr_seg_tests, constr_between_tests read v16.3's constr.js)
// A commit the clone does not have (a shallow clone: a worker's depth 50) is fetched by itself first
// (git fetch --depth=1 origin <sha>, #427); CI checks out with fetch-depth: 0. A snapshot this script wrote carries the
// commit in <dir>/.commit and is replaced when the commit differs; a folder without that file (made by hand) is left as
// it is. The tests ask for their folder with snapshotDir: a missing one fails with what to run, never a skip.
//   node ci/snapshots.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./lib');

const SNAPSHOTS = [
  { dir: 'notes/gate-morph-zp-r1', commit: '5d5e724821658cb346c449e6d1f721807bc9ae25', what: 'v13' },
  { dir: 'notes/v16.2-candidate', commit: 'd07ae97d341f7883e5fba393079c5eb23193ae1a', what: 'v16.2' },
  { dir: 'notes/v16.3-candidate', commit: 'c8221ff235118db92f4c74f34ccf35eda316084c', what: 'v16.3' },
];

// the snapshot's src/ folder for a test; missing: a FAIL line ci/unit.js shows, and exit 1
function snapshotDir(dir) {
  const s = SNAPSHOTS.find((x) => x.dir === dir), out = path.join(ROOT, dir, 'src');
  if (!s) throw new Error(`no snapshot ${dir} in ci/snapshots.js`);
  if (!fs.existsSync(out)) {
    console.log(`FAIL ${dir}/src is missing: run node ci/snapshots.js (it restores ${s.what} from commit ${s.commit.slice(0, 7)})`);
    process.exit(1);
  }
  return out;
}

const git = (args, opt = {}) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opt });
function have(commit) { try { git(['cat-file', '-e', `${commit}^{commit}`], { stdio: 'ignore' }); return true; } catch (e) { return false; } }

function main() {
  let bad = 0;
  for (const s of SNAPSHOTS) {
    const out = path.join(ROOT, s.dir, 'src'), mark = path.join(ROOT, s.dir, '.commit'), short = s.commit.slice(0, 7);
    if (fs.existsSync(out)) {
      if (!fs.existsSync(mark)) { console.log(`${s.dir}/src: present (not written by this script: left as it is)`); continue; }
      if (fs.readFileSync(mark, 'utf8').trim() === s.commit) { console.log(`${s.dir}/src: present (${short})`); continue; }
      fs.rmSync(out, { recursive: true, force: true });
    }
    if (!have(s.commit)) {
      // (a shallow clone has not got it: fetch that one commit, not the history)
      console.log(`${s.dir}: commit ${short} is not in this clone; git fetch --depth=1 origin ${s.commit}`);
      try { git(['fetch', '--depth=1', 'origin', s.commit], { stdio: ['ignore', 'ignore', 'pipe'] }); } catch (e) { /* said below */ }
      if (!have(s.commit)) {
        console.log(`FAIL ${s.dir}/src: commit ${short} (${s.what}) could not be fetched from origin; fetch it (git fetch --depth=1 origin ${s.commit}) or unshallow the clone (git fetch --unshallow), then run node ci/snapshots.js again`);
        bad++;
        continue;
      }
    }
    const files = git(['ls-tree', '-r', '--name-only', s.commit, 'src']).split('\n').filter(Boolean);
    for (const f of files) {
      const dest = path.join(ROOT, s.dir, f);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, execFileSync('git', ['show', `${s.commit}:${f}`], { cwd: ROOT, maxBuffer: 1 << 28 }));
    }
    fs.writeFileSync(mark, s.commit + '\n');
    console.log(`${s.dir}/src: ${files.length} files from ${short} (${s.what})`);
  }
  process.exit(bad ? 1 : 0);
}

module.exports = { SNAPSHOTS, snapshotDir };
if (require.main === module) main();

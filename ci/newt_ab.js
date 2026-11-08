'use strict';
// Bit-for-bit comparison of the NEWT ops' GPU output between a base build and this checkout's build, on the software
// renderer (test/newt_ab_cmd.js records every scene's raw float targets and settled canvas as hashes):
//   node ci/newt_ab.js [--base REF] [--keep] [--no-control]      REF defaults to origin/claude/funny-darwin-l5uis3
// Builds REF and the working tree, records both, and requires equal records: exit 1 on any differing target.
// Negative control: a third build of the working tree with the Newton step's cap (0.25 (1 + |u|)) moved by one part
// in 2.5e6 must differ from the base in at least one target, else the comparison cannot see a change and the run fails.
// Needs the browser setup of ci/README.md (CHROME_BIN, CMW_ANGLE, CMW_CHROME_ARGS). CMW_NEWT_AB_ONLY narrows the scenes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT } = require('./lib');

const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = opt('--base', 'origin/claude/funny-darwin-l5uis3');
// The step cap in src/glsl.js and its control value.
const CAP = '0.25 * (1.0 + cx_abs(u))', CAP_CONTROL = '0.2500001 * (1.0 + cx_abs(u))';
// Files the recording needs in a tree that predates them.
const KIT = ['test/newt_ab_cmd.js', 'ci/suite_views.js', 'ci/browser_shards.js'];

const sh = (cmd, args, cwd, env) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env), maxBuffer: 1 << 28 });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'newt_ab-'));
const trees = [];
// A tree of `ref` (a worktree), the working tree's recording kit copied in, optionally edited by `edit(src/glsl.js text)`.
const tree = (name, ref, overlay, edit) => {
  const dir = path.join(tmp, name);
  if (ref) {
    const w = sh('git', ['worktree', 'add', '--detach', dir, ref], ROOT);
    if (!w.ok) throw new Error('worktree ' + ref + ': ' + w.out);
    trees.push(dir);
  } else {
    fs.mkdirSync(dir);
    for (const f of sh('git', ['ls-files'], ROOT).out.split('\n').filter(Boolean)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
    }
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  if (overlay) for (const f of KIT) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  if (edit) {
    const p = path.join(dir, 'src/glsl.js'), s = fs.readFileSync(p, 'utf8'), t = edit(s);
    if (t === s) throw new Error('the control edit changed nothing');
    fs.writeFileSync(p, t);
  }
  return dir;
};
const record = (name, dir) => {
  const out = path.join(tmp, name + '.json');
  console.log(`${name}: building and recording in ${dir}`);
  if (!sh('python3', ['build.py'], dir).ok) throw new Error(name + ': build failed');
  const r = sh('node', ['ci/browser.js', '--no-build', '--only', 'newt_ab'], dir, { CMW_NEWT_AB_OUT: out });
  if (!fs.existsSync(out)) throw new Error(name + ': no record\n' + r.out.slice(-2000));
  if (!r.ok) console.log(name + ': the recording suite failed its own checks:\n' + r.out.split('\n').filter((l) => /FAIL/.test(l)).slice(0, 5).join('\n'));
  return { rec: JSON.parse(fs.readFileSync(out, 'utf8')), ok: r.ok };
};
// Targets that differ between two records, 'scene target'.
const diff = (a, b) => {
  const d = []; let n = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    for (const t of new Set([...Object.keys(a[k] || {}), ...Object.keys(b[k] || {})])) {
      n++;
      if (!a[k] || !b[k] || !a[k][t] || !b[k][t] || a[k][t].h !== b[k][t].h) d.push(`${k} ${t}`);
    }
  }
  return { n, d };
};

let code = 0;
try {
  const A = record('base', tree('base', BASE, true));
  const B = record('head', tree('head', null, false));
  const C = argv.includes('--no-control') ? null : record('control', tree('control', null, false, (s) => s.split(CAP).join(CAP_CONTROL)));
  const ab = diff(A.rec, B.rec), ac = C ? diff(A.rec, C.rec) : null;
  console.log(`A/B: ${ab.n} targets compared, ${ab.d.length} differ${ab.d.length ? ': ' + ab.d.slice(0, 20).join('; ') : ''}`);
  if (ac) console.log(`control: ${ac.d.length} of ${ac.n} targets differ from the base${ac.d.length ? '' : ' (the comparison cannot see a change)'}`);
  if (ab.d.length || (ac && !ac.d.length) || !A.ok || !B.ok) code = 1;
  console.log(code ? 'FAIL' : ac ? 'PASS: 0 differing bits, and the control is seen' : 'PASS: 0 differing bits (no control run)');
} catch (e) {
  console.log('FAIL ' + e.message);
  code = 1;
} finally {
  if (!argv.includes('--keep')) {
    for (const d of trees) sh('git', ['worktree', 'remove', '--force', d], ROOT);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
process.exit(code);

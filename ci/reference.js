'use strict';
// The reference app of a paired gate: the build of another commit (the PR's base, the previous main, a release), made
// in a git worktree under .ci/ so it never touches the checkout. Reused when it is already built.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, PY, run } = require('./lib');

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

// -> { sha, dir, dist } with dir/dist/test.html built
function buildReference(ref) {
  const sha = git('rev-parse', '--verify', `${ref}^{commit}`);
  const dir = path.join(ROOT, '.ci', `ref-${sha.slice(0, 12)}`);
  const dist = path.join(dir, 'dist');
  if (fs.existsSync(path.join(dist, 'test.html'))) return { sha, dir, dist };
  if (fs.existsSync(dir)) { try { git('worktree', 'remove', '--force', dir); } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); } }
  git('worktree', 'prune');
  git('worktree', 'add', '--detach', dir, sha);
  // (the build may run the bundler, which the worktree finds in the checkout's node_modules: npm ci has run there)
  const nm = path.join(ROOT, 'node_modules');
  if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(dir, 'node_modules'), 'junction');
  if (run(PY, ['build.py'], { cwd: dir }) !== 0) throw new Error(`the reference ${sha} did not build`);
  return { sha, dir, dist };
}

// true when the app (src/, build.py and its tools/src_parts.py; or the given paths) is the same at ref as in the
// checkout: a paired gate then has nothing to compare
function sameApp(ref, paths = ['src', 'build.py', 'tools/src_parts.py']) {
  try { execFileSync('git', ['diff', '--quiet', ref, '--', ...paths], { cwd: ROOT }); return true; } catch (e) { return false; }
}

module.exports = { buildReference, sameApp, git };

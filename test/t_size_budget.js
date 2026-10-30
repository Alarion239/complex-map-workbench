'use strict';
// node test/t_size_budget.js : the file-size budget only goes down (issue #20; eslint.config.js's SIZE_BUDGET,
// CONTRIBUTING.md). Each limit may not rise above its number on the branch this one starts from (the pull request's
// base, GITHUB_BASE_REF in CI, else origin/main; a base without SIZE_BUDGET has nothing to compare), and each names a
// file that exists. Notes only, so that a change elsewhere that shrinks a file never fails here: a number above its
// file's size (lower it to the size) and a file now under the 1,500-line aim (drop it from SIZE_BUDGET).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Linter } = require('eslint');

const ROOT = path.join(__dirname, '..');
const AIM = 1500;
const budgetOf = (text) => {
  const m = /const SIZE_BUDGET = \{([\s\S]*?)\n\};/.exec(text || '');
  return m ? Object.fromEntries([...m[1].matchAll(/'([^']+)': (\d+)/g)].map((x) => [x[1], +x[2]])) : null;
};
// max-lines' count of a file: blank and comment lines left out
const linter = new Linter();
const sizeOf = (file) => {
  const msgs = linter.verify(fs.readFileSync(path.join(ROOT, file), 'utf8'), { languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, rules: { 'max-lines': ['warn', { max: 1, skipBlankLines: true, skipComments: true }] } });
  const m = msgs.find((x) => x.ruleId === 'max-lines');
  return m ? +/\((\d+)\)/.exec(m.message)[1] : 1;
};
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return null; } };

let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const now = budgetOf(fs.readFileSync(path.join(ROOT, 'eslint.config.js'), 'utf8'));
check('eslint.config.js has a SIZE_BUDGET', !!now);
for (const [file, max] of Object.entries(now || {})) {
  const exists = fs.existsSync(path.join(ROOT, file));
  check(`${file} exists`, exists);
  if (!exists) continue;
  const size = sizeOf(file);
  if (size <= AIM) console.log(`note: ${file} is ${size} lines, under the ${AIM}-line aim: drop it from SIZE_BUDGET`);
  else if (size < max) console.log(`note: ${file} is ${size} lines, under its limit ${max}: lower the limit to ${size}`);
}
// the base branch's numbers
const ref = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';
const base = git('merge-base', 'HEAD', ref);
const was = base ? budgetOf(git('show', `${base}:eslint.config.js`)) : null;
if (!was) console.log(`no SIZE_BUDGET at the base (${ref}${base ? ' ' + base.slice(0, 7) : ', not found'}): nothing to compare`);
for (const [file, max] of Object.entries(now || {})) if (was && was[file] != null) check(`${file}: its limit does not rise (base ${was[file]})`, max <= was[file], `now ${max}`);
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);

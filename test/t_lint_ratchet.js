'use strict';
// node test/t_lint_ratchet.js : ci/lint_ratchet.js (the lint ratchet, issue #20): a count above the baseline fails, below it
// asks to lower it, `update` never raises the baseline, and a baseline of 0 is the floor, where a single error fails.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lintratchet-'));
const tool = path.join(__dirname, '..', 'ci', 'lint_ratchet.js');
const baseline = path.join(dir, 'baseline.json');
const es = (k) => { const f = path.join(dir, `es${k}.json`); fs.writeFileSync(f, JSON.stringify([{ messages: Array.from({ length: k }, () => ({ severity: 2 })).concat([{ severity: 1 }]) }])); return f; };
const ts = (k) => { const f = path.join(dir, `ts${k}.txt`); fs.writeFileSync(f, Array.from({ length: k }, (_, i) => `src/x.js(${i + 1},1): error TS2339: nothing`).join('\n') + '\n'); return f; };
const run = (mode, e, t) => spawnSync(process.execPath, [tool, mode, es(e), ts(t)], { encoding: 'utf8', env: Object.assign({}, process.env, { CMW_LINT_BASELINE: baseline }) });
const set = (e, t) => fs.writeFileSync(baseline, JSON.stringify({ eslintErrors: e, tscErrors: t }));

set(0, 5);
let r = run('check', 0, 5); check('at the baseline passes', r.status === 0 && /tscErrors: 5 \(baseline 5\): at the baseline/.test(r.stdout), r.stdout);
r = run('check', 0, 6); check('above the baseline fails', r.status === 1 && /GREW by 1/.test(r.stdout), r.stdout);
r = run('check', 0, 3); check('below the baseline passes and asks to lower it', r.status === 0 && /below the baseline by 2: lower it/.test(r.stdout), r.stdout);
r = run('update', 0, 3); check('update lowers the baseline', r.status === 0 && JSON.parse(fs.readFileSync(baseline, 'utf8')).tscErrors === 3, r.stdout + r.stderr);
r = run('update', 0, 4); check('update refuses to raise it', r.status === 1 && JSON.parse(fs.readFileSync(baseline, 'utf8')).tscErrors === 3, r.stdout + r.stderr);
r = run('check', 1, 3); check('a warning is not counted, an ESLint error is', r.status === 1 && /eslintErrors: 1 \(baseline 0\)/.test(r.stdout), r.stdout);
// the floor: 0 is the baseline, one error fails
set(0, 0);
r = run('check', 0, 0); check('at the floor passes and says so', r.status === 0 && /tscErrors: 0 \(baseline 0\): at the floor \(0\)/.test(r.stdout) && /eslintErrors: 0 \(baseline 0\): at the floor \(0\)/.test(r.stdout), r.stdout);
r = run('check', 0, 1); check('one tsc error above the floor fails', r.status === 1 && /GREW by 1 from the floor \(0\)/.test(r.stdout), r.stdout);
r = run('check', 1, 0); check('one ESLint error above the floor fails', r.status === 1 && /eslintErrors: 1 .*from the floor/.test(r.stdout), r.stdout);
r = run('update', 0, 1); check('update does not move the floor', r.status === 1 && JSON.parse(fs.readFileSync(baseline, 'utf8')).tscErrors === 0, r.stdout + r.stderr);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`t_lint_ratchet: ${n - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);

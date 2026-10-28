// #20 phase 3, step 5: the app's state S is written through named state functions (src/app/01-core.js, the state
// section). This test reads the app's sources and fails on a direct write of what has been put behind them so far:
// S itself is replaced by setState only. Node, no browser.
'use strict';
const fs = require('fs');
const path = require('path');
const { appText, source } = require('./src_text');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 600) : '')); } };
// the app (src/app/*.js joined) and the modules moved out of it, which reach S through their api (A.S)
const MODULES = fs.readFileSync(path.join(__dirname, '..', 'build.py'), 'utf8').match(/'(commands|soundhooks|export|morphpaths|integrals|examples)\.js'/g).map((s) => s.slice(1, -1));
const files = [['src/app.js', appText()], ...MODULES.map((f) => ['src/' + f, source(f)])];
// the lines that write a name: a plain assignment (not ==, =>), with no property or identifier character before it
const writes = (text, re) => text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => re.test(l.replace(/\/\/.*$/, '')));
const S_WRITE = /(^|[^\w$.])(A\.)?S\s*=(?![=>])/;
const where = [];
for (const [f, t] of files) for (const [n, l] of writes(t, S_WRITE)) if (!/function setState\(next\) \{ S = next; \}|^\s*let S = null;/.test(l)) where.push(`${f}:${n}: ${l.trim()}`);
ok('S is replaced by setState only', where.length === 0, where);
ok('setState is defined once, in the state section', (appText().match(/function setState\(/g) || []).length === 1);
console.log(`t_state_writes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

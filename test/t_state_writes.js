// #20 phase 3, step 5: the app's state S is written through named state functions (src/app/01-core.js, the state
// section). This test reads the app's sources and fails on a direct write of what has been put behind them so far:
// S itself is replaced by setState only (5a); the panes' hideLeft and hideRight are set by setHidden only (5b); the
// chain's selection and focused step by setSel and setFocusStep only (5c); the shapes, steps, targets and parameters
// lists by setShapes, setSteps, setTargets, setParams, pushShape, pushStep, pushTarget and spliceSteps only (5d). Node,
// no browser.
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
// (5b) the panes' hide flags
const HIDE_WRITE = /\bS\.hide(Left|Right)\s*=(?![=>])/;
const hides = [];
for (const [f, t] of files) for (const [n, l] of writes(t, HIDE_WRITE)) if (!/function setHidden\(side, on\)/.test(l)) hides.push(`${f}:${n}: ${l.trim()}`);
ok('hideLeft and hideRight are set by setHidden only', hides.length === 0, hides);
// (5c) the chain's selection and focused step (a write, or a compound assignment)
const SEL_WRITE = /(^|[^\w$.])(A\.)?S\.(sel|focus)\s*([-+*]?=(?![=>])|\+\+|--)/;
const sels = [];
for (const [f, t] of files) for (const [n, l] of writes(t, SEL_WRITE)) if (!/function (setSel\(v\)|setFocusStep\(k\))/.test(l)) sels.push(`${f}:${n}: ${l.trim()}`);
ok('S.sel and S.focus are set by setSel and setFocusStep only', sels.length === 0, sels);
// (5d) the lists: replaced, or changed in place by an array method
const LIST_WRITE = /(^|[^\w$.])(A\.)?S\.(shapes|steps|targets|params)(\s*=(?![=>])|\.(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\(|\.length\s*=(?![=>]))/;
const LIST_FNS = /function (setShapes|setSteps|setTargets|setParams|pushShape|pushStep|pushTarget|spliceSteps)\(/;
const lists = [];
for (const [f, t] of files) for (const [n, l] of writes(t, LIST_WRITE)) if (!LIST_FNS.test(l)) lists.push(`${f}:${n}: ${l.trim()}`);
ok('the shapes, steps, targets and parameters lists are changed by their state functions only', lists.length === 0, lists);
console.log(`t_state_writes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

'use strict';
// node test/t_mk_function.js : tools/mk_function.js still runs on the app's sources and still makes src/seasong.js (the
// Mountain King as a function, notes/sea-song/FUNCTION.md). The tool evaluates src/cx.js, parse.js, funcs.js and the modules
// they need in a vm; when those became ES modules (#20) it threw on `export`, and nothing noticed, because nothing ran it.
// Here: (1) `node tools/mk_function.js --dry` exits 0 and reports the theme heard exactly (editDistance 0, 29 logs, 25
// pairs, four cracks); (2) the data it makes, required from here (so it writes nothing), is the data in src/seasong.js: a
// change to the parser or the tool that moves the example's chain shows as a difference here, to be regenerated
// (node tools/mk_function.js), not found by someone running the tool a year on.
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const tool = path.join(__dirname, '..', 'tools', 'mk_function.js');

const r = spawnSync(process.execPath, [tool, '--dry'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
check('the tool runs (--dry) and exits 0', r.status === 0, (r.stderr || '').split('\n').slice(0, 4).join(' | '));
let rep = null;
try { rep = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch (e) { check('the tool reports its numbers as JSON', false, String(r.stdout).slice(-200)); }
if (rep) {
  check('the theme is heard exactly: editDistance 0', rep.editDistance === 0, rep);
  check('29 principal logs, 25 Apollonius pairs, four cracks', rep.logs === 29 && rep.pairs === 25 && rep.cuts === 4, rep);
  check('|ln|F|| stays under 0.03 along the path (no band edge)', rep.lnAbsF && Math.max(...rep.lnAbsF.map(Math.abs)) < 0.03, rep.lnAbsF);
}
// (the tool, required: dry, it prints its report and writes nothing)
const log = console.log; console.log = () => {};
let gen = null, err = null;
try { gen = require(tool); } catch (e) { err = e; } finally { console.log = log; }
check('the tool can be required (and writes nothing)', !!gen && !err, err && err.message);
if (gen) {
  const have = require('../src/seasong.js').SEASONG;
  let same = true, why = '';
  try { assert.deepStrictEqual(JSON.parse(JSON.stringify(gen.SEASONG)), JSON.parse(JSON.stringify(have))); } catch (e) { same = false; why = String(e.message).split('\n').slice(0, 3).join(' | '); }
  check('the data the tool makes is the data in src/seasong.js (else: node tools/mk_function.js)', same, why);
}
console.log(`t_mk_function: ${n - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);

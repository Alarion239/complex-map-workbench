// The perf and quality suites (test/regress) drive the steps view through its hooks (__cmwSteps), never the classic
// views: no file of their code calls __cmwSetMain or __cmwMorph, writes the classic view fields (rightMode), clicks a
// step card (#pipeline .card) or pins the classic view. The perf suite lists no unit of a feature the classic removal
// deleted (#622: the step cards, the Deformation bar and its playback, the right pane), and ci/perf_shards.js names
// none. Run: node test/t_regress_steps.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'test', 'regress');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

// every code file of the suites (their scenes, runners and comparers; not the recorded baselines and renders)
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/^(golden|golden-pre-p3|out|results|__pycache__)$/.test(e.name)) walk(p); } else if (/\.(js|sh|py)$/.test(e.name)) files.push(p);
  }
};
walk(DIR);
ok('the suites have code files', files.length >= 10, files.length);
const CLASSIC = [
  ['__cmwSetMain', /__cmwSetMain\b/],
  ['__cmwMorph', /__cmwMorph\b/],
  ['rightMode', /\brightMode\b/],
  ["'#pipeline .card'", /#pipeline \.card/],
  ['the classic view pin', /__cmwPinView\s*=\s*['"]classic|[?&]view=classic/],
];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  for (const [name, re] of CLASSIC) {
    const at = lines.map((l, i) => (re.test(l) ? i + 1 : 0)).filter(Boolean);
    ok(`${path.relative(ROOT, f)} holds no ${name}`, !at.length, at.length ? `lines ${at.join(', ')}` : undefined);
  }
}

// the units of deleted features: the step cards, the Deformation bar's open and playback, the right pane (no unit
// pans or zooms it, or describes it)
const DELETED = /^(cards\.|morph\.|scrub\.morph$|pointer\.roots_morph_pan$|phone\.morph$)/;
const list = execFileSync(process.execPath, [path.join(DIR, 'perf', 'run.js'), '--list'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const units = list.map((l) => l.split(/\s+/)[0]);
ok('the perf suite lists its units', units.length >= 20, units.length);
const gone = units.filter((u) => DELETED.test(u));
ok('the perf suite lists no unit of a deleted feature', !gone.length, gone);
const desc = list.filter((l) => /\b(pan|zoom) (L\/R|R)\b|deformation/.test(l));
ok('no perf unit describes a right pane or a deformation', !desc.length, desc);
const shards = fs.readFileSync(path.join(ROOT, 'ci', 'perf_shards.js'), 'utf8');
for (const word of ['cards', 'morph']) ok(`ci/perf_shards.js names no ${word} unit`, !new RegExp(`\\b${word}\\b`).test(shards.replace(/\/\/.*$/gm, '')));
const run = fs.readFileSync(path.join(DIR, 'perf', 'run.js'), 'utf8');
ok("run.js measures no pane 'R'", !/(panSide|zoomSide|dragLeg|paneRect|paneShot|shotAtRest)\([^)]*'R'/.test(run));

console.log(`t_regress_steps: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// The app has one plane, pane L: no code draws, fits or reads a view of the right pane (Y) or keeps its state. The
// right pane's renderers (renderRight and what only it drew), its view and camera (V.right, rightAuto, camS), its
// stage glide (trans), its fit (fitRight), its hover, the classic deformation transport that showed in it (morphOn,
// openTransport, homView), the w-plane targets' editing in it, the classic layout's Y and solo switches and the view
// mapper's pane of an old view (Views.paneOf) are gone, Views.merged never names pane R, and solo() is always 'L'.
// (The pane's DOM and its Pane object, paneR, stay until P9b, #995.)
// Run: node test/t_no_right_pane.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name) && !/^i18n_/.test(e.name)) files.push(p); } };
walk(path.join(ROOT, 'src'));
ok('src has its scripts', files.length > 50, files.length);

const GONE = ['renderRight', 'renderSphere', 'renderMorph', 'drawXTint', 'drawMorphOutline', 'keyUnder', 'wKeyOn', 'wKeyAvail',
  'fillTargets2D', 'strokeTargets', 'drawFov', 'drawCutBanks', 'requestInverseFor', 'updateCalcChip', 'targetNote',
  'fitRight', 'fitRightSliced', 'defFitView', 'rightAuto', 'camS', 'CAMS', 'rightStage', 'transState', 'rHover',
  'setSolo', 'morphOn', 'homView', 'openTransport', 'closeTransport', 'targetsEditable', 'idleRight',
  '__cmwPaneOf', '__cmwOtherPane', '__cmwSphereW', '__cmwMorph', '__cmwGlide', '__cmwLayout'];
const src = files.map((f) => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]);
for (const name of GONE) {
  const re = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
  const at = src.filter(([, s]) => re.test(s)).map(([f]) => f);
  ok(`no ${name} in src`, !at.length, at);
}
for (const [name, re] of [['V.right', /\bV\.right\b/], ['Views.paneOf', /\bViews\.paneOf\b/], ['dirty.R', /\bdirty\.R\b/]]) {
  const at = src.filter(([, s]) => re.test(s)).map(([f]) => f);
  ok(`no ${name} in src`, !at.length, at);
}
const view = fs.readFileSync(path.join(ROOT, 'src', 'view.js'), 'utf8');
ok('Views.merged never names pane R', /const merged = \(v\) => \(v\.main !== 'xy' \? 'L' : null\);/.test(view));

// solo() is the one plane's
const core = fs.readFileSync(path.join(ROOT, 'src', 'app', '01-core.js'), 'utf8');
const m = /function solo\(\)\s*\{([^}]*)\}|const solo = \(\) => ([^;\n]*)/.exec(core);
ok("solo() returns 'L' and nothing else", !!m && /return 'L'|^\s*'L'\s*$/.test(m[1] || m[2]) && !/'R'|null/.test(m[1] || m[2]), m && (m[1] || m[2]));

console.log(`t_no_right_pane: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

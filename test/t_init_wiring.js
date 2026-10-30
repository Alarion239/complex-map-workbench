'use strict';
// [#385] init() is the app's start-up (src/app/20-init.js, every change to it a T3 run of the Gate): the wiring of an
// area (its buttons, menus, keys and observers) is in that area's part as a setup…() that init() calls, so that a
// change to it runs that area's shards (ci/impact.js). This test reads init()'s own text and fails on a listener or an
// observer that is not one of the start-up's own: a new one belongs in the part of its area.
// Run: node test/t_init_wiring.js
const fs = require('fs');
const path = require('path');

let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

const lines = fs.readFileSync(path.join(__dirname, '../src/app/20-init.js'), 'utf8').split(/\r?\n/);
const at = lines.indexOf('  function init() {'), end = lines.indexOf('  }', at);
check('20-init.js has init()', at >= 0 && end > at);
const body = lines.slice(at + 1, end).filter((l) => !/^\s*\/\//.test(l));
// the start-up's own: the focus noted for undo, the state written when the page goes, the planes' size, the theme
const OWN = [
  "document.addEventListener('pointerdown'", "document.addEventListener('keydown'",
  "window.addEventListener('pagehide'", "document.addEventListener('visibilitychange'",
  "new ResizeObserver(() => onPaneResize())",
  "matchMedia('(prefers-color-scheme: dark)').addEventListener('change'", 'new MutationObserver(themeChanged)',
  "window.addEventListener('hashchange'",
];
const found = [];
for (const l of body) {
  for (const m of l.matchAll(/(?:\$\('[^']*'\)|matchMedia\('[^']*'\)|[\w$.]+)\.addEventListener\((?:'[^']*'|[\w$]+)|new (?:Mutation|Resize|Intersection)Observer\([^;]*?\)(?=[.;])/g)) found.push(m[0]);
}
const stray = found.filter((f) => !OWN.includes(f));
check('init() adds no listener or observer of an area (those are in the area\'s part, as a setup…())', !stray.length, stray);
check('init() still has the start-up\'s own (this test reads its text)', found.length >= 6, found);
// each setup init() calls is defined once, in a part other than 20-init.js
const app = fs.readdirSync(path.join(__dirname, '../src/app')).filter((f) => /^\d\d-.*\.js$/.test(f));
const defs = {};
for (const f of app) for (const m of fs.readFileSync(path.join(__dirname, '../src/app', f), 'utf8').matchAll(/^ {2}function (setup\w+|phoneApi)\(/gm)) (defs[m[1]] = defs[m[1]] || []).push(f);
const calls = [...new Set(body.join('\n').match(/\b(?:setup\w+|phoneApi)(?=\()/g) || [])];
check('init() calls the areas\' setups', calls.length >= 10, calls);
for (const c of calls) check(`${c}: defined once`, (defs[c] || []).length === 1, defs[c] || 'nowhere');

console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);

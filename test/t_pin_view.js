// The kit's view pin (test/cdp_kit/pin_view.js, #443 and #620): run in a sandbox with a page's window and location.
// Without __cmwPinView a page is pinned classic unless its URL asks for ?view=steps; with __cmwPinView = 'steps' (cdpd.js,
// CMW_VIEW=steps: a ported suite) it is pinned steps unless its URL asks for ?view=classic; a page that set cmwView
// itself keeps it. Run: node test/t_pin_view.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'cdp_kit', 'pin_view.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
// (the view the app opens with: 19-steps-view.js's own test, cmwView === 'steps' or ?view=steps)
const run = (search, win = {}) => {
  const window = Object.assign({}, win);
  vm.runInNewContext(SRC, { window, location: { search }, URLSearchParams });
  return { pinned: window.cmwView, steps: window.cmwView === 'steps' || new URLSearchParams(search).get('view') === 'steps' };
};
ok('no pin, no view in the URL -> classic', !run('?ns=a').steps && run('?ns=a').pinned === 'classic', run('?ns=a'));
ok('no pin, ?view=steps -> steps', run('?ns=a&view=steps').steps);
ok('pin steps, no view in the URL -> steps', run('?ns=a', { __cmwPinView: 'steps' }).steps, run('?ns=a', { __cmwPinView: 'steps' }));
ok('pin steps, ?view=classic -> classic', !run('?ns=a&view=classic', { __cmwPinView: 'steps' }).steps, run('?ns=a&view=classic', { __cmwPinView: 'steps' }));
ok('pin steps, ?view=steps -> steps', run('?view=steps', { __cmwPinView: 'steps' }).steps);
ok('a page that set cmwView keeps it', run('?ns=a', { cmwView: 'steps' }).steps && !run('?ns=a', { cmwView: 'classic', __cmwPinView: 'steps' }).steps);
console.log(`t_pin_view: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

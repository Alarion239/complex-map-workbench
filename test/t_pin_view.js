// The kit's view pin (test/cdp_kit/pin_view.js, #443 and #620): run in a sandbox with a page's window and location.
// Without __cmwPinView a page opens in the steps view unless its URL asks for ?view=classic; with __cmwPinView = 'classic'
// (cdpd.js, CMW_VIEW=classic: a classic or not yet ported suite) it is pinned classic unless its URL asks for
// ?view=steps; a page that set cmwView itself keeps it. Run: node test/t_pin_view.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'cdp_kit', 'pin_view.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };
// (the view the app opens with: 19-steps-view.js's own test, ?view=classic or cmwView === 'classic' opens the classic views)
const run = (search, win = {}) => {
  const window = Object.assign({}, win);
  vm.runInNewContext(SRC, { window, location: { search }, URLSearchParams });
  return { pinned: window.cmwView, steps: (new URLSearchParams(search).get('view') || window.cmwView) !== 'classic' };
};
ok('no pin, no view in the URL -> steps', run('?ns=a').steps && run('?ns=a').pinned === 'steps', run('?ns=a'));
ok('no pin, ?view=classic -> classic', !run('?ns=a&view=classic').steps, run('?ns=a&view=classic'));
ok('no pin, ?view=steps -> steps', run('?ns=a&view=steps').steps);
ok('pin classic, no view in the URL -> classic', !run('?ns=a', { __cmwPinView: 'classic' }).steps, run('?ns=a', { __cmwPinView: 'classic' }));
ok('pin classic, ?view=steps -> steps', run('?ns=a&view=steps', { __cmwPinView: 'classic' }).steps, run('?ns=a&view=steps', { __cmwPinView: 'classic' }));
ok('pin classic, ?view=classic -> classic', !run('?view=classic', { __cmwPinView: 'classic' }).steps);
ok('a page that set cmwView keeps it', !run('?ns=a', { cmwView: 'classic' }).steps && run('?ns=a', { cmwView: 'steps', __cmwPinView: 'classic' }).steps);
console.log(`t_pin_view: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

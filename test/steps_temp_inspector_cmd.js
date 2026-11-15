// The steps view's temporary Inspector: with the right panel hidden (]) the rail's Edit button opens the Inspector as a
// dialog over the stage's right edge; Esc, the Close button and a second press of Edit each close it, and the panel
// stays hidden afterwards; with the panel showing, Edit shows the docked panel instead and no dialog opens.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS_MOD = 100000, VIEW_W = 1366, VIEW_H = 768, WAIT_MS = 10000;
const NS = 'svtmp' + (Date.now() % NS_MOD);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// (waits on the condition the next check reads: a wait that runs out is reported by the kit)
const until = (expr, max = WAIT_MS) => settled({ until: expr, max });
const quiet = () => settled({ max: WAIT_MS });
const STEP = { type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true };
const SHAPE = { id: 'A', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true };
const IS_TEMP = `document.getElementById('propsPanel').classList.contains('temp')`;
const IS_HIDDEN = `document.querySelector('.layout').classList.contains('hide-right')`;
const isTemp = () => ev(IS_TEMP);
const hidden = () => ev(IS_HIDDEN);
const role = () => ev(`document.getElementById('propsPanel').getAttribute('role')`);
// the rail's Edit button; the wait is for the temporary Inspector to be open (`opens`) or closed
const pressEdit = async (opens) => { await ev(`document.getElementById('rightRailEdit').click()`); await until(`${IS_TEMP} === ${opens}`); };
const blur = () => ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);
await view(VIEW_W, VIEW_H, false, false);
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [SHAPE], nextId: 30, focus: 0, steps: [STEP] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`);
await until(`typeof __cmwSteps === 'function' && __cmwSteps().planes.length >= 2 && !!document.getElementById('rightRailEdit') && !!document.getElementById('propsPanel')`);
await blur();

ok('the panel starts showing', !(await hidden()), null);
ok('no temporary Inspector at the start', !(await isTemp()), null);

// hide the panel: the rail's Edit button opens the temporary Inspector
await key(']'); await until(IS_HIDDEN);
ok('] hides the panel', await hidden(), null);
await pressEdit(true);
ok('Edit opens the temporary Inspector', await isTemp(), null);
ok('it is a dialog named Inspector', await role() === 'dialog' && await ev(`document.getElementById('propsPanel').getAttribute('aria-label')`) === 'Inspector', await role());
ok('it holds the Inspector contents', await ev(`!!document.querySelector('#propsPanel .insp-sel')`), null);
ok('the panel is still hidden under it', await hidden(), null);

// Esc closes it
await blur(); await key('Escape'); await until(`!(${IS_TEMP})`);
ok('Esc closes the temporary Inspector', !(await isTemp()), null);
ok('closed, it is the region again', await role() === 'region', await role());
ok('the panel stays hidden after Esc', await hidden(), null);

// a second press of Edit closes it
await pressEdit(true);
ok('Edit opens it again', await isTemp(), null);
await pressEdit(false);
ok('a second Edit closes it', !(await isTemp()), null);

// its Close button closes it
await pressEdit(true);
await ev(`document.querySelector('#propsPanel .tbar .icon-btn').click()`); await until(`!(${IS_TEMP})`);
ok('the Close button closes it', !(await isTemp()), null);

// with the panel showing, Edit opens no dialog (a negative: read once the page has gone quiet, which a delayed open would not survive)
await key(']'); await until(`!(${IS_HIDDEN})`);
ok('] shows the panel again', !(await hidden()), null);
await ev(`document.getElementById('rightRailEdit').click()`); await quiet();
ok('with the panel showing, Edit opens no temporary Inspector', !(await isTemp()), null);

info.checks = 'steps view: temporary Inspector opens from the rail, closes on Esc, Edit and Close, and is not used with the panel showing';
return { pass: fails.length === 0, fails, info };

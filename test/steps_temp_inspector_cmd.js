// The steps view's temporary Inspector: with the right panel hidden (]) the rail's Edit button opens the Inspector as a
// dialog over the stage's right edge; Esc, the Close button and a second press of Edit each close it, and the panel
// stays hidden afterwards; with the panel showing, Edit shows the docked panel instead and no dialog opens.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS = 'svtmp' + (Date.now() % 100000);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await settled({ floor: ms }); };
const STEP = { type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true };
const SHAPE = { id: 'A', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true };
const isTemp = () => ev(`document.getElementById('propsPanel').classList.contains('temp')`);
const hidden = () => ev(`document.querySelector('.layout').classList.contains('hide-right')`);
const role = () => ev(`document.getElementById('propsPanel').getAttribute('role')`);
const pressEdit = async () => { await ev(`document.getElementById('rightRailEdit').click()`); await settle(500); };
const blur = () => ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);
await view(1366, 768, false, false);
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [SHAPE], nextId: 30, focus: 0, steps: [STEP] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`); await settle(1500);
await blur();

ok('the panel starts showing', !(await hidden()), null);
ok('no temporary Inspector at the start', !(await isTemp()), null);

// hide the panel: the rail's Edit button opens the temporary Inspector
await key(']'); await settle(600);
ok('] hides the panel', await hidden(), null);
await pressEdit();
ok('Edit opens the temporary Inspector', await isTemp(), null);
ok('it is a dialog named Inspector', await role() === 'dialog' && await ev(`document.getElementById('propsPanel').getAttribute('aria-label')`) === 'Inspector', await role());
ok('it holds the Inspector contents', await ev(`!!document.querySelector('#propsPanel .insp-sel')`), null);
ok('the panel is still hidden under it', await hidden(), null);

// Esc closes it
await blur(); await key('Escape'); await settle(400);
ok('Esc closes the temporary Inspector', !(await isTemp()), null);
ok('closed, it is the region again', await role() === 'region', await role());
ok('the panel stays hidden after Esc', await hidden(), null);

// a second press of Edit closes it
await pressEdit();
ok('Edit opens it again', await isTemp(), null);
await pressEdit();
ok('a second Edit closes it', !(await isTemp()), null);

// its Close button closes it
await pressEdit();
await ev(`document.querySelector('#propsPanel .tbar .icon-btn').click()`); await settle(400);
ok('the Close button closes it', !(await isTemp()), null);

// with the panel showing, Edit opens no dialog
await key(']'); await settle(600);
ok('] shows the panel again', !(await hidden()), null);
await pressEdit();
ok('with the panel showing, Edit opens no temporary Inspector', !(await isTemp()), null);

info.checks = 'steps view: temporary Inspector opens from the rail, closes on Esc, Edit and Close, and is not used with the panel showing';
return { pass: fails.length === 0, fails, info };

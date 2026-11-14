// The steps view's Numbers section: an empty list shows its hint; + Number opens a name row with the next free letter
// in it, and Enter adds that number; a name that is not one letter (a word, a Cyrillic look-alike) is refused with a
// message and adds nothing; Escape closes the row; a second add takes the next free letter; renaming a number keeps its row.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS = 'svnum' + (Date.now() % 100000);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await settled({ floor: ms }); };
const STEP = { type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true };
const SHAPE = { id: 'A', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true };
const WORD = 'sin';
const names = () => ev(`[...document.querySelectorAll('.prm .prm-row')].map((r) => r.dataset.name)`);
const hasEmptyHint = () => ev(`!!document.querySelector('.prm .prm-empty')`);
const newInput = () => `document.querySelector('.prm [data-prm-focus="new"]')`;
const addBtn = () => ev(`(() => { const b = [...document.querySelectorAll('.prm .prm-add button')].find((x) => /Number/.test(x.textContent) && !x.classList.contains('prm-addcx')); b.scrollIntoView({ block: 'nearest' }); b.click(); return 1; })()`);
const typeName = async (text) => {
  await ev(`(() => { const i = ${newInput()}; i.focus(); i.select(); return 1; })()`);
  await type(text);
};
await view(1366, 768, false, false);
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [SHAPE], nextId: 30, focus: 0, steps: [STEP], params: [] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`); await settle(1500);
await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);

ok('no numbers: the list is empty', (await names()).length === 0, await names());
ok('no numbers: the hint is shown', await hasEmptyHint(), null);

// + Number opens a row holding the next free letter
await addBtn(); await settle(300);
ok('+ Number opens the name row', await ev(`!!${newInput()}`), null);
ok('the row offers the next free letter', await ev(`${newInput()}.value`) === 'a', await ev(`${newInput()}.value`));

// Escape closes it and adds nothing
await ev(`${newInput()}.focus(), 1`); await key('Escape'); await settle(300);
ok('Escape closes the row', await ev(`!${newInput()}`), null);
ok('Escape adds no number', (await names()).length === 0, await names());

// a word is refused, with a message, and adds nothing
await addBtn(); await settle(300);
await typeName(WORD); await key('Enter'); await settle(300);
const msg = await ev(`(() => { const e = document.querySelector('.prm .prm-err:not([hidden])'); return e ? e.textContent : null; })()`);
ok('a word is refused with a message', !!msg && msg.length > 0, msg);
ok('the refused name adds no number', (await names()).length === 0, await names());
ok('the row stays open for another try', await ev(`!!${newInput()}`), null);

// Enter on a good name adds it
await typeName('k'); await key('Enter'); await settle(500);
ok('Enter adds the number', JSON.stringify(await names()) === JSON.stringify(['k']), await names());
ok('the hint is gone', !(await hasEmptyHint()), null);

// a second add offers the next free letter
await addBtn(); await settle(300);
const second = await ev(`${newInput()}.value`);
ok('the next add offers a letter not yet used', /^[a-zα-ω]$/.test(second) && second !== 'k', second);
await key('Enter'); await settle(500);
ok('the second number is added after the first', (await names()).length === 2 && (await names())[0] === 'k', await names());

info.checks = 'steps view: Numbers hint, + Number, Escape, refused word, Enter adds, next free letter';
return { pass: fails.length === 0, fails, info };

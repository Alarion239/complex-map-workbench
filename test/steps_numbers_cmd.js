// The steps view's Numbers section: an empty list shows its hint; + Number opens a name row with the next free letter
// in it, and Enter adds that number; a word, and a Cyrillic letter that is not a look-alike, are refused with their
// message and add nothing; a Cyrillic look-alike (к for k) is read as its Latin letter; Escape closes the row; a second
// add takes the next free letter; renaming a number keeps its row (its place among the numbers and its value).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS_MOD = 100000, VIEW_W = 1366, VIEW_H = 768, WAIT_MS = 10000;
const NS = 'svnum' + (Date.now() % NS_MOD);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// (waits on the condition the next check reads: a wait that runs out is reported by the kit)
const until = (expr, max = WAIT_MS) => settled({ until: expr, max });
const STEP = { type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true };
const SHAPE = { id: 'A', kind: 'circle', c: [0, 0], r: 0.8, ci: 0, visible: true };
const WORD = 'sin', WORD_MSG = 'sin is a function or a word: a name is one letter (a, k, a₁) or a Greek letter (α, ρ)';
const CYRILLIC = 'б', CYRILLIC_MSG = 'The letter “б” is Cyrillic: names are written in Latin letters. Switch the keyboard layout.';
const LOOK_ALIKE = 'к', LOOK_ALIKE_AS = 'k';   // (Cyrillic ka, read as Latin k)
const names = () => ev(`[...document.querySelectorAll('.prm .prm-row')].map((r) => r.dataset.name)`);
const hasEmptyHint = () => ev(`!!document.querySelector('.prm .prm-empty')`);
const newInput = () => `document.querySelector('.prm [data-prm-focus="new"]')`;
const errText = () => ev(`(() => { const e = document.querySelector('.prm .prm-err:not([hidden])'); return e ? e.textContent : null; })()`);
const valueOf = (name) => ev(`(() => { const i = document.querySelector('.prm .prm-row[data-name="${name}"] .prm-val'); return i ? i.value : null; })()`);
const addBtn = async () => {
  await ev(`(() => { const b = [...document.querySelectorAll('.prm .prm-add button')].find((x) => /Number/.test(x.textContent) && !x.classList.contains('prm-addcx')); b.scrollIntoView({ block: 'nearest' }); b.click(); return 1; })()`);
  await until(`!!${newInput()}`);
};
const typeName = async (text) => {
  await ev(`(() => { const i = ${newInput()}; i.focus(); i.select(); return 1; })()`);
  await type(text);
};
// a name entered with Enter: refused (the message shows) or added (the number count is `count`)
const enterRefused = async (text) => { await typeName(text); await key('Enter'); await until(`!!document.querySelector('.prm .prm-err:not([hidden])') && document.querySelector('.prm .prm-err:not([hidden])').textContent.length > 0`); };
const enterAdded = async (text, count) => { await typeName(text); await key('Enter'); await until(`document.querySelectorAll('.prm .prm-row').length === ${count}`); };
await view(VIEW_W, VIEW_H, false, false);
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [SHAPE], nextId: 30, focus: 0, steps: [STEP], params: [] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`);
await until(`typeof __cmwSteps === 'function' && __cmwSteps().planes.length >= 2 && !!document.querySelector('.prm .prm-add')`);
await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);

ok('no numbers: the list is empty', (await names()).length === 0, await names());
ok('no numbers: the hint is shown', await hasEmptyHint(), null);

// + Number opens a row holding the next free letter
await addBtn();
ok('+ Number opens the name row', await ev(`!!${newInput()}`), null);
ok('the row offers the next free letter', await ev(`${newInput()}.value`) === 'a', await ev(`${newInput()}.value`));

// Escape closes it and adds nothing
await ev(`${newInput()}.focus(), 1`); await key('Escape'); await until(`!${newInput()}`);
ok('Escape closes the row', await ev(`!${newInput()}`), null);
ok('Escape adds no number', (await names()).length === 0, await names());

// a word is refused, with its message, and adds nothing
await addBtn();
await enterRefused(WORD);
ok('a word is refused with its message', (await errText()) === WORD_MSG, await errText());
ok('the refused word adds no number', (await names()).length === 0, await names());
ok('the row stays open for another try', await ev(`!!${newInput()}`), null);

// a Cyrillic letter that is not a look-alike is refused, with its message, and adds nothing
await enterRefused(CYRILLIC);
ok('a Cyrillic letter is refused with its message', (await errText()) === CYRILLIC_MSG, await errText());
ok('the refused Cyrillic letter adds no number', (await names()).length === 0, await names());

// Enter on a good name adds it
await enterAdded('k', 1);
ok('Enter adds the number', JSON.stringify(await names()) === JSON.stringify(['k']), await names());
ok('the hint is gone', !(await hasEmptyHint()), null);

// a second add offers the next free letter
await addBtn();
const second = await ev(`${newInput()}.value`);
ok('the next add offers a letter not yet used', /^[a-zα-ω]$/.test(second) && second !== 'k', second);
await key('Enter'); await until(`document.querySelectorAll('.prm .prm-row').length === 2`);
ok('the second number is added after the first', (await names()).length === 2 && (await names())[0] === 'k', await names());

// a Cyrillic look-alike is read as its Latin letter: a Cyrillic к is the Latin k, which exists, so it is refused as a
// repeat; a look-alike of a free letter is added under the Latin name
await addBtn();
await enterRefused(LOOK_ALIKE);
ok('a look-alike of an existing name is read as that Latin letter (it already exists)', /k already exists/.test(await errText() || ''), await errText());
await typeName('с'); await key('Enter'); await until(`document.querySelectorAll('.prm .prm-row').length === 3`);
const withLook = await names();
ok('a look-alike of a free letter is added under its Latin name', withLook.length === 3 && withLook[2] === 'c', withLook);

// renaming a number keeps its row: the same place among the numbers, the same value
const valueBefore = await valueOf(LOOK_ALIKE_AS), orderBefore = await names();
await ev(`document.querySelector('.prm .prm-row[data-name="${LOOK_ALIKE_AS}"] .prm-name').click(), 1`);
await until(`!!document.querySelector('.prm input[aria-label^="New name for"]')`);
await type('m'); await key('Enter');
await until(`document.querySelectorAll('.prm .prm-row[data-name="m"]').length === 1`);
const orderAfter = await names();
ok('a renamed number keeps its place among the numbers', JSON.stringify(orderAfter) === JSON.stringify(orderBefore.map((n) => (n === LOOK_ALIKE_AS ? 'm' : n))), [orderBefore, orderAfter]);
ok('and its value', (await valueOf('m')) === valueBefore && valueBefore !== null, [valueBefore, await valueOf('m')]);
ok('the old name has no row', await ev(`document.querySelectorAll('.prm .prm-row[data-name="${LOOK_ALIKE_AS}"]').length === 0`), null);

info.checks = 'steps view: Numbers hint, + Number, Escape, refused word and Cyrillic letter (their messages), look-alikes, Enter adds, next free letter, rename keeps the row';
return { pass: fails.length === 0, fails, info };

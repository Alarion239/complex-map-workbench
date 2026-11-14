// The steps view's Examples gallery: the button opens a menu whose first row is the empty canvas; Escape closes it
// and adds nothing; choosing an example closes the menu and loads that example's curves and steps; the menu then marks
// that example as the current one; choosing New empties the sceneNow and moves the mark back to New.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS = 'svex' + (Date.now() % 100000);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 250) => { await settled({ floor: ms }); };
const NEW_ROW = 'New: empty canvas';
const EXAMPLE = 'Strip to disk';
const MIN_EXAMPLES = 10;   // the gallery holds many; the count only has to show it is a list of examples, not one row
const menuOpen = () => ev(`!!document.querySelector('#popHost .pop.examples')`);
const rowNames = () => ev(`[...document.querySelectorAll('#popHost .pop.examples .ex-item:not([hidden]) .ex-name')].map((e) => e.textContent)`);
const currentRow = () => ev(`(() => { const b = document.querySelector('#popHost .pop.examples .ex-item[aria-current="true"] .ex-name'); return b ? b.textContent : null; })()`);
const openGal = async () => { await ev(`document.getElementById('examplesBtn').click()`); await settled({ until: `!!document.querySelector('#popHost .pop.examples')`, only: true }); };
const pickRow = async (name) => {
  await ev(`(() => { const n = ${JSON.stringify(name)}; const b = [...document.querySelectorAll('#popHost .pop.examples .ex-item')].find((x) => x.querySelector('.ex-name').textContent === n); b.click(); return 1; })()`);
  await settle(1500);
};
const sceneNow = async () => { const s = await ev('__cmwP()'); return { steps: s.steps.length, shapes: s.shapes.length }; };
await view(1366, 768, false, false);
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [], nextId: 30, focus: 0, steps: [] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`); await settle(1500);
await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);

const before = await sceneNow();
ok('the page starts as an empty canvas', before.steps === 0 && before.shapes === 0, before);

await openGal();
const names = await rowNames();
ok('the gallery lists the examples', names.length >= MIN_EXAMPLES, names.length);
ok('its first row is the empty canvas', names[0] === NEW_ROW, names[0]);
ok(`it lists ${EXAMPLE}`, names.includes(EXAMPLE), names);

// Escape closes the menu and loads nothing
await key('Escape'); await settle(300);
ok('Escape closes the gallery', !(await menuOpen()), null);
ok('Escape loads nothing', JSON.stringify(await sceneNow()) === JSON.stringify(before), await sceneNow());

// choosing an example loads it
await openGal(); await pickRow(EXAMPLE);
ok('choosing an example closes the gallery', !(await menuOpen()), null);
const loaded = await sceneNow();
ok('the example brings its steps', loaded.steps > 0, loaded);
ok('the example brings its curves', loaded.shapes > 0, loaded);
await openGal();
ok('the gallery marks the loaded example as current', await currentRow() === EXAMPLE, await currentRow());

// New empties the sceneNow
await pickRow(NEW_ROW);
const after = await sceneNow();
ok('New empties the steps', after.steps === 0, after);
ok('New empties the curves', after.shapes === 0, after);
await openGal();
ok('the mark is back on New', await currentRow() === NEW_ROW, await currentRow());
await key('Escape'); await settle(200);

info.checks = 'steps view: Examples gallery opens, lists, closes on Escape, loads an example, New empties';
return { pass: fails.length === 0, fails, info };

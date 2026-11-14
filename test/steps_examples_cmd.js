// The steps view's Examples gallery: the button opens a menu whose first row is the empty canvas; Escape closes it
// and adds nothing; choosing an example closes the menu and loads that example's curves and steps; the menu then marks
// that example as the current one; choosing New empties the scene and moves the mark back to New.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const BASE = `http://localhost:${(/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1]}`;
const NS_MOD = 100000, VIEW_W = 1366, VIEW_H = 768, WAIT_MS = 10000;
const NS = 'svex' + (Date.now() % NS_MOD);
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// (waits on the condition the next check reads: a wait that runs out is reported by the kit)
const until = (expr, max = WAIT_MS) => settled({ until: expr, max });
const NEW_ROW = 'New: empty canvas';
const EXAMPLE = 'Strip to disk';
const MIN_EXAMPLES = 10;   // the gallery holds many; the count only has to show it is a list of examples, not one row
const MENU_GONE = `!document.querySelector('#popHost .pop.examples')`;
const SCENE_EMPTY = `__cmwP().steps.length === 0 && __cmwP().shapes.length === 0`;
const SCENE_LOADED = `__cmwP().steps.length > 0 && __cmwP().shapes.length > 0`;
const menuOpen = () => ev(`!!document.querySelector('#popHost .pop.examples')`);
const rowNames = () => ev(`[...document.querySelectorAll('#popHost .pop.examples .ex-item:not([hidden]) .ex-name')].map((e) => e.textContent)`);
const currentRow = () => ev(`(() => { const b = document.querySelector('#popHost .pop.examples .ex-item[aria-current="true"] .ex-name'); return b ? b.textContent : null; })()`);
const openGal = async () => { await ev(`document.getElementById('examplesBtn').click()`); await settled({ until: `!!document.querySelector('#popHost .pop.examples')`, only: true }); };
// choose a row; the wait is for what choosing it does: the menu gone and the scene (`sceneIs`, an expression) as the row brings it
const pickRow = async (name, sceneIs) => {
  await ev(`(() => { const n = ${JSON.stringify(name)}; const b = [...document.querySelectorAll('#popHost .pop.examples .ex-item')].find((x) => x.querySelector('.ex-name').textContent === n); b.click(); return 1; })()`);
  await until(`${MENU_GONE} && ${sceneIs}`);
};
const sceneNow = async () => { const s = await ev('__cmwP()'); return { steps: s.steps.length, shapes: s.shapes.length }; };
await view(VIEW_W, VIEW_H, false, false);
await load(NS, { v3: true, v4: true, v5: true, v6: true, unit: false, snap: true, shapes: [], nextId: 30, focus: 0, steps: [] });
await nav(`${BASE}/test.html?ns=${NS}&lang=en&view=steps`);
await until(`typeof __cmwSteps === 'function' && !!document.getElementById('examplesBtn') && ${SCENE_EMPTY}`);
await ev(`document.activeElement && document.activeElement.blur && document.activeElement.blur(), 1`);

const before = await sceneNow();
ok('the page starts as an empty canvas', before.steps === 0 && before.shapes === 0, before);

await openGal();
const names = await rowNames();
ok('the gallery lists the examples', names.length >= MIN_EXAMPLES, names.length);
ok('its first row is the empty canvas', names[0] === NEW_ROW, names[0]);
ok(`it lists ${EXAMPLE}`, names.includes(EXAMPLE), names);

// Escape closes the menu and loads nothing
await key('Escape'); await until(MENU_GONE);
ok('Escape closes the gallery', !(await menuOpen()), null);
ok('Escape loads nothing', JSON.stringify(await sceneNow()) === JSON.stringify(before), await sceneNow());

// choosing an example loads it
await openGal(); await pickRow(EXAMPLE, SCENE_LOADED);
ok('choosing an example closes the gallery', !(await menuOpen()), null);
const loaded = await sceneNow();
ok('the example brings its steps', loaded.steps > 0, loaded);
ok('the example brings its curves', loaded.shapes > 0, loaded);
await openGal();
ok('the gallery marks the loaded example as current', await currentRow() === EXAMPLE, await currentRow());

// New empties the scene
await pickRow(NEW_ROW, SCENE_EMPTY);
const after = await sceneNow();
ok('New empties the steps', after.steps === 0, after);
ok('New empties the curves', after.shapes === 0, after);
await openGal();
ok('the mark is back on New', await currentRow() === NEW_ROW, await currentRow());
await key('Escape'); await until(MENU_GONE);

info.checks = 'steps view: Examples gallery opens, lists, closes on Escape, loads an example, New empties';
return { pass: fails.length === 0, fails, info };

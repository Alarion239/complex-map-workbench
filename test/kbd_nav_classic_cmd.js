// Laptop keyboard in the classic view (issue #44, UX98): the chain is one Tab stop and the arrows move between its cards, and F6 /
// Shift+F6 move between the areas: top bar, tools, X, Y, chain, Inspector. kbd_nav_cmd.js, which runs in the steps view, has the
// tool grid, the steps view's areas and the plane's Tab; this is the classic views' part, until K3. A command file for a CDP daemon.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'kbd_nav_kit.js'), 'utf8')), where = K.where;
await K.open();
// one Tab stop per group
const stops = await ev(`({ tools: [...document.querySelectorAll('#tools .tool')].filter((t) => t.tabIndex >= 0).length, all: document.querySelectorAll('#tools .tool').length, chain: [...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].filter((t) => t.tabIndex >= 0).length, cards: document.querySelectorAll('#pipeline .card, #pipeline .ftile').length })`);
info.stops = stops;
ok('the chain is one Tab stop', stops.chain === 1 && stops.cards >= 3, stops);
// F6 around the areas
await ev(`[...document.querySelectorAll('#tools .tool')].find((t) => t.tabIndex === 0).focus()`); await settled({});
const order = [];
for (let i = 0; i < 6; i++) { await key('F6'); await settled({}); const w = await where(); order.push(K.area(w)); }
info.f6 = order;
ok('F6 goes tools → X → Y → chain → Inspector → top bar → tools', JSON.stringify(order) === JSON.stringify(['x', 'y', 'chain', 'inspector', 'top', 'tools']), order);
const back = [];
for (let i = 0; i < 2; i++) { await key('F6', 8); await settled({}); const w = await where(); back.push(K.area(w)); }
ok('Shift+F6 goes back: top bar, then Inspector', JSON.stringify(back) === JSON.stringify(['top', 'inspector']), back);
// the chain: arrows move between its cards (the existing keys), and the Tab stop follows
await ev(`[...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].find((t) => t.tabIndex === 0).focus()`); await settled({});
await key('ArrowRight'); await settled({});
const cw = await where();
const ct = await ev(`[...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].filter((t) => t.tabIndex >= 0).length`);
ok('the chain keeps one Tab stop after an arrow', cw && cw.inChain && ct === 1, [cw, ct]);
return { pass: fails.length === 0, fails, info };

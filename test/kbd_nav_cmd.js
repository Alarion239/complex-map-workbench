// Laptop keyboard in the steps view (issue #44, UX98): the tool grid is one Tab stop and the arrows move inside it, and F6 / Shift+F6
// move between the areas: top bar, tools, the plane, the thread (on its ring), the Inspector, wrapping both ways; Tab on a focused
// plane steps through its shapes; the Construct tools have letters. The classic view's chain cards and its X → Y → chain areas are
// kbd_nav_classic_cmd.js. A command file for a CDP daemon.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'kbd_nav_kit.js'), 'utf8')), where = K.where;
await K.open();
// one Tab stop per group
const stops = await ev(`({ tools: [...document.querySelectorAll('#tools .tool')].filter((t) => t.tabIndex >= 0).length, all: document.querySelectorAll('#tools .tool').length, chain: [...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].filter((t) => t.tabIndex >= 0).length, cards: document.querySelectorAll('#pipeline .card, #pipeline .ftile').length })`);
info.stops = stops;
ok('the tool grid is one Tab stop', stops.tools === 1 && stops.all > 5, stops);
// arrows inside the tool grid
await ev(`[...document.querySelectorAll('#tools .tool')].find((t) => t.tabIndex === 0).focus()`); await settled({});
const w0 = await where();
await key('ArrowRight'); await settled({});
const w1 = await where();
ok('→ moves to the next tool', w1 && w1.inTools && w1.tool !== w0.tool, [w0, w1]);
const tabbable = await ev(`[...document.querySelectorAll('#tools .tool')].filter((t) => t.tabIndex >= 0).map((t) => t.dataset.tool)`);
ok('the focused tool is the one Tab stop', tabbable.length === 1 && tabbable[0] === w1.tool, tabbable);
await key('ArrowLeft'); await settled({});
ok('← moves back', (await where()).tool === w0.tool, await where());
await key('End'); await settled({});
const wEnd = await where();
await key('Home'); await settled({});
ok('Home and End go to the ends', (await where()).tool !== wEnd.tool && wEnd.inTools, [wEnd, await where()]);
// F6 around the areas
await ev(`[...document.querySelectorAll('#tools .tool')].find((t) => t.tabIndex === 0).focus()`); await settled({});
const order = [];
for (let i = 0; i < 5; i++) { await key('F6'); await settled({}); const w = await where(); order.push(K.area(w)); }
info.f6 = order;
ok('F6 goes tools → plane → thread → Inspector → top bar → tools', JSON.stringify(order) === JSON.stringify(['x', 'thread', 'inspector', 'top', 'tools']), order);
const back = [];
for (let i = 0; i < 2; i++) { await key('F6', 8); await settled({}); const w = await where(); back.push(K.area(w)); }
ok('Shift+F6 goes back: top bar, then Inspector', JSON.stringify(back) === JSON.stringify(['top', 'inspector']), back);
// Tab on a focused plane steps through its shapes (the plane takes focus from F6 once it is a stop: sound on, as in the sound suite)
await load('kbdnav2' + Date.now(), { shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }, { id: 'b', kind: 'disc', c: [2, 0], r: 0.5 }], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } }); await settled({});
await ev(`(() => { const c = document.getElementById('overlayL'); c.tabIndex = 0; c.focus(); })()`); await settled({});
const sel = () => ev(`(document.querySelector('#propsPanel') || document.body).textContent.replace(/\\s+/g, ' ').slice(0, 60)`);
await key('Tab'); await settled({ until: `/Disc \\d/.test(document.getElementById('propsPanel').textContent)` });
const t1 = await sel();
await key('Tab'); await settled({ until: `/Disc 2/.test(document.getElementById('propsPanel').textContent)` });
const t2 = await sel();
ok('Tab on a plane selects a shape, then the next', /Disc 2/.test(t2), [t1, t2]);
await key('Tab', 8); await settled({ until: `/Disc 1/.test(document.getElementById('propsPanel').textContent)` });
ok('Shift+Tab goes back to the first shape', /Disc 1/.test(await sel()), await sel());
// the Construct tools have letters
const letters = { E: 'circle3', I: 'meet', U: 'midpoint', Q: 'bisector', W: 'perp', J: 'touch', Y: 'hyper' };
await ev(`document.activeElement.blur()`);
for (const [k, tool] of Object.entries(letters)) {
  await key(k.toLowerCase()); await settled({ until: `!!document.querySelector('.tool[data-tool][aria-pressed="true"]') && document.querySelector('.tool[data-tool][aria-pressed="true"]').dataset.tool === ${JSON.stringify(tool)}`, max: 3000 });
  const on = await ev(`(document.querySelector('.tool[data-tool][aria-pressed="true"]') || { dataset: {} }).dataset.tool`);
  ok('the letter ' + k + ' picks ' + tool, on === tool, on);
}
return { pass: fails.length === 0, fails, info };

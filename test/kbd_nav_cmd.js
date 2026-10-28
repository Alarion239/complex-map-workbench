// Laptop keyboard (issue #44, UX98): the tool grids and the chain are one Tab stop each, the arrows move inside them, and
// F6 / Shift+F6 move between the areas: top bar, tools, X, Y, chain, Inspector. A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const where = () => ev(`(() => { const a = document.activeElement; if (!a) return null; return { tag: a.tagName, id: a.id || '', cls: String(a.className).slice(0, 40), tool: a.dataset && a.dataset.tool || '', k: a.dataset && a.dataset.k || '', inTop: !!a.closest('#top'), inTools: !!a.closest('#tools'), inChain: !!a.closest('#pipeline'), inProps: !!a.closest('#propsPanel'), xCanvas: !!(a.parentElement && a.closest('#paneL')), yCanvas: !!a.closest('#paneR') }; })()`);
await view(1440, 900, false, false);
await load('kbdnav' + Date.now(), { shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
// one Tab stop per group
const stops = await ev(`({ tools: [...document.querySelectorAll('#tools .tool')].filter((t) => t.tabIndex >= 0).length, all: document.querySelectorAll('#tools .tool').length, chain: [...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].filter((t) => t.tabIndex >= 0).length, cards: document.querySelectorAll('#pipeline .card, #pipeline .ftile').length })`);
info.stops = stops;
ok('the tool grid is one Tab stop', stops.tools === 1 && stops.all > 5, stops);
ok('the chain is one Tab stop', stops.chain === 1 && stops.cards >= 3, stops);
// arrows inside the tool grid
await ev(`[...document.querySelectorAll('#tools .tool')].find((t) => t.tabIndex === 0).focus()`); await settle(200);
const w0 = await where();
await key('ArrowRight'); await settle(200);
const w1 = await where();
ok('→ moves to the next tool', w1 && w1.inTools && w1.tool !== w0.tool, [w0, w1]);
const tabbable = await ev(`[...document.querySelectorAll('#tools .tool')].filter((t) => t.tabIndex >= 0).map((t) => t.dataset.tool)`);
ok('the focused tool is the one Tab stop', tabbable.length === 1 && tabbable[0] === w1.tool, tabbable);
await key('ArrowLeft'); await settle(200);
ok('← moves back', (await where()).tool === w0.tool, await where());
await key('End'); await settle(200);
const wEnd = await where();
await key('Home'); await settle(200);
ok('Home and End go to the ends', (await where()).tool !== wEnd.tool && wEnd.inTools, [wEnd, await where()]);
// F6 around the areas
await ev(`[...document.querySelectorAll('#tools .tool')].find((t) => t.tabIndex === 0).focus()`); await settle(200);
const order = [];
for (let i = 0; i < 6; i++) { await key('F6'); await settle(250); const w = await where(); order.push(w && (w.inTop ? 'top' : w.inTools ? 'tools' : w.xCanvas ? 'x' : w.yCanvas ? 'y' : w.inChain ? 'chain' : w.inProps ? 'inspector' : JSON.stringify(w))); }
info.f6 = order;
ok('F6 goes tools → X → Y → chain → Inspector → top bar → tools', JSON.stringify(order) === JSON.stringify(['x', 'y', 'chain', 'inspector', 'top', 'tools']), order);
const back = [];
for (let i = 0; i < 2; i++) { await key('F6', 8); await settle(250); const w = await where(); back.push(w && (w.inTop ? 'top' : w.inTools ? 'tools' : w.xCanvas ? 'x' : w.yCanvas ? 'y' : w.inChain ? 'chain' : w.inProps ? 'inspector' : '?')); }
ok('Shift+F6 goes back: top bar, then Inspector', JSON.stringify(back) === JSON.stringify(['top', 'inspector']), back);
// the chain: arrows move between its cards (the existing keys), and the Tab stop follows
await ev(`[...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].find((t) => t.tabIndex === 0).focus()`); await settle(200);
await key('ArrowRight'); await settle(300);
const cw = await where();
const ct = await ev(`[...document.querySelectorAll('#pipeline .card, #pipeline .ftile')].filter((t) => t.tabIndex >= 0).length`);
ok('the chain keeps one Tab stop after an arrow', cw && cw.inChain && ct === 1, [cw, ct]);
return { pass: fails.length === 0, fails, info };

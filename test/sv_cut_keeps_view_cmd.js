// Dragging a branch cut's handle in a later plane of the steps view leaves the camera where the user panned it: the
// "Logarithm of an annulus" example in its plane w₁, the plane panned, then the handle pressed and dragged up. A command
// file for a CDP daemon (test/cdp_kit README); prints { pass, of, fails }.
const R = [];
const check = (name, pass, detail) => R.push([name, !!pass, detail]);
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const ns = 'cutkeeps' + Date.now();
const SCENE = { srcView: { cx: 0, cy: 0, s: 70 }, shapes: [{ id: 's1', kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2, ci: 0, visible: true }, { id: 's2', kind: 'circle', c: [0, 0], r: 1, ci: 1, visible: true }, { id: 's3', kind: 'segment', a: [0.5, 0.5], b: [1.5, 1.5], ci: 2, visible: true }], steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], focus: 1 };
await loadView('steps', ns, SCENE);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: 60000 });
const box = () => ev('JSON.stringify(__cmwStageBox())');
const handles = () => ev('__cmwCutHandles()');
const b = await handles();
check('the plane has a carried cut handle', b.length === 1 && b[0].carried, b);
const home = await box();
await drag(b[0].x - 150, b[0].y - 200, b[0].x - 230, b[0].y - 150, 6, 20);
await settled({ max: 20000 });
const panned = await box();
check('the pan moved the camera', panned !== home, { home, panned });
const h = (await handles())[0];
await click(h.x, h.y);
await settled({ max: 20000 });
check('a press on the cut handle leaves the panned camera where it was', (await box()) === panned, { panned, now: await box() });
const h1 = (await handles())[0];
await drag(h1.x, h1.y, h1.x, h1.y - 50, 8, 20);
await settled({ max: 20000 });
const h2 = (await handles())[0];
check('the drag turned the cut (the press reached the handle)', !!h2 && h2.deg !== h1.deg, { was: h1.deg, now: h2 && h2.deg });
check('and a drag of the handle leaves the panned camera where it was', (await box()) === panned, { panned, now: await box() });
// an example loaded after the pan opens at its own view, not at the one the user had panned to
await ev('__cmwExample(0)'); await settled({ max: 60000 });
const loaded = await box();
const ns2 = 'cutkeeps2' + Date.now();
await loadView('steps', ns2, SCENE);
await go(`http://localhost:${PORT}/test.html?ns=${ns2}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: 60000 });
await ev('__cmwExample(0)'); await settled({ max: 60000 });
check('an example loaded after a pan opens at its own view', loaded === (await box()), { loaded, own: await box() });
const fails = R.filter((r) => !r[1]);
return { pass: R.length - fails.length, of: R.length, fails };

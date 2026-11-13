// A selected shape's handles are drawn on its own plane only: a disc drawn on w₁ (stage 1) and selected shows no centre or radius
// handle on plane z, while a z shape selected keeps its handles there. Steps view, 1440 x 900, en.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// a wait on the page's own state; a timeout is a failed check by the caller reading its result
const ready = async (expr, max = 20000) => (await settled({ until: expr, max, only: true })).ok;
const STATE = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 's1', kind: 'disc', c: [0.8, -0.6], r: 0.5, ci: 0, visible: true }, { id: 's2', kind: 'disc', c: [-1.2, 1.4], r: 0.5, ci: 1, visible: true, stage: 1 }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const ns = 'stagehandles' + Date.now();
await view(1440, 900, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` });
await ready('document.readyState === "complete"');
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
ok('the steps view is up on plane z with its shapes', await ready('!!window.__cmwSteps && __cmwSteps().on && __cmwSteps().i === 0 && __cmwShapes().shapes.length === 2'), null);
const ink = (z) => ev(`__cmwOverlayInk('L', ${JSON.stringify(z)}, 7)`);
const pick = async (id) => { await ev(`__cmwSelect(${JSON.stringify(id)}); 1`); await ready(`__cmwShapes().selected === ${JSON.stringify(id)}`); await settled({ panes: false }); };
await pick('s1');
const z0 = [await ink([0.8, -0.6]), await ink([1.3, -0.6])];
ok('a selected z disc keeps its centre and radius handles on plane z', z0[0] > 0 && z0[1] > 0, z0);
await pick('s2');
const w0 = [await ink([-1.2, 1.4]), await ink([-0.7, 1.4])];
ok('a selected disc of w₁ draws no centre or radius handle on plane z', w0[0] === 0 && w0[1] === 0, w0);
return { pass: fails.length === 0, fails, info };

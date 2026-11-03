// H.seed, H.isSteps and the pinned view of H.loadView (test/cdp_kit/cdpd.js): the suites that open a page with a state of their
// own and the suites that check their view use them.
//   - seed writes the saved state the app reads under ?ns= (a page opened afterwards has those steps);
//   - isSteps answers whether the page shows the steps view;
//   - loadView with no view opens the kit's pinned view, the steps view for this suite's tag (ci/suite_views.js), and with
//     a view it opens that one whatever the pin is.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const STATE = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const ready = `typeof __cmwSteps === 'function' && typeof __cmwP === 'function'`;
const types = () => ev(`__cmwP().steps.map((s) => s.type).join()`);
await view(1440, 900, false, false);

const ns = 'kitseed' + Date.now();
await seed(ns, STATE);
await go(`http://localhost:${PORT}/test.html?ns=${ns}`); await settled({ until: ready });
ok('seed: the app opened afterwards has the seeded steps', (await types()) === 'sin,exp', await types());
ok('isSteps: the page is in the steps view under the steps pin', (await isSteps()) === true, await isSteps());

await loadView(null, 'kitpin' + Date.now(), STATE); await settled({ until: ready });
ok('loadView with no view: the pinned (steps) view, with the state', (await isSteps()) === true && (await types()) === 'sin,exp', { sv: await isSteps(), types: await types() });

await loadView('classic', 'kitclassic' + Date.now(), STATE); await settled({ until: ready });
ok('loadView with a view: that view whatever the pin is (classic)', (await isSteps()) === false, await isSteps());
ok('... and the state is the seeded one', (await types()) === 'sin,exp', await types());

await loadView('steps', 'kitsteps' + Date.now(), STATE); await settled({ until: ready });
ok('loadView steps: the steps view', (await isSteps()) === true, await isSteps());
info.ok = fails.length === 0;
return { pass: fails.length === 0, fails, info };

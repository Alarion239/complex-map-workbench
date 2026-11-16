// A figure names a point it shows on a later plane as the image on that plane (a one-panel or two-panel figure writes F(z₀), w₁(z₀)):
// primes counts the maps from the point's own plane, so the plane shown is the point's stage plus primes. On zeta then z², a point
// drawn on z is w₁(z₀) one map on and F(z₀) two maps on (the whole map), and a point drawn on w₁ is w₂(w₁,₁) one map on: the
// plane's name applied to a name that already carries the plane, w₁(w₁,₁), was the plane it came from.
// The name is read from the app's own pointLabel in the figure's mode (__cmwPointName).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'fpn' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 'sa', kind: 'point', p: [0.4, 0.3], ci: 1, visible: true, stage: 0, num: 0 }, { id: 'sb', kind: 'point', p: [1.0, 0.5], ci: 2, visible: true, stage: 1, num: 1 }],
  steps: [{ type: 'zeta', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
await view(1280, 800, false, false);
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
await settled({ max: 30000, until: "typeof __cmwPointName === 'function' && typeof __cmwSteps === 'function' && __cmwP().steps.length === 2" });
const name = (id, primes) => ev(`__cmwPointName(${JSON.stringify(id)}, ${primes})`);
const got = { z1: await name('sa', 1), z2: await name('sa', 2), w1: await name('sb', 1), w0: await name('sb', 0) };
info.names = got;
ok('a point drawn on z, one map on, is w₁(z₀)', got.z1 === 'w₁(z₀)', got);
ok('a point drawn on z, two maps on (the whole map), is F(z₀)', got.z2 === 'F(z₀)', got);
ok('a point drawn on w₁, one map on (shown on w₂), is w₂(w₁,₁)', got.w1 === 'w₂(w₁,₁)', got);
ok('a point on its own plane keeps its name, with no prime: w₁,₁', got.w0 === 'w₁,₁', got);
return { pass: fails.length === 0, fails, info };

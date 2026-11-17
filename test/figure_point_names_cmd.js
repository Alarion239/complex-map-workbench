// A figure names a point it shows on a later plane as the image on that plane (a one-panel or two-panel figure writes F(z₀), w₁(z₀)):
// primes counts the maps from the point's own plane, so the plane shown is the point's stage plus primes. On zeta then z²:
// - a point drawn on z is w₁(z₀) one map on and F(z₀) two maps on (the whole map);
// - a point drawn on w₁ is w₂(w₁,₁) one map on: the plane it is shown on, applied to its own name;
// - a point on its own plane keeps its name, with no prime: w₁,₁;
// - with the second step focused (the classic view's), a carried point reads f₂(...) at either distance, drawn on z or on w₁.
// The name is read from the app's own pointLabel in the figure's mode (__cmwPointName).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const st = (focus) => ({ v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 'sa', kind: 'point', p: [0.4, 0.3], ci: 1, visible: true, stage: 0, num: 0 }, { id: 'sb', kind: 'point', p: [1.0, 0.5], ci: 2, visible: true, stage: 1, num: 1 }],
  steps: [{ type: 'zeta', params: {}, on: true }, { type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus, srcView: { cx: 0, cy: 0, s: 90 } });
await view(1280, 800, false, false);
// (the names of the four cases, in a page that opens with the step `focus` focused: 0 is the whole chain, in the steps view; a
// focused step is the classic view's)
const names = async (focus) => {
  const ns = `fpn${focus}x${Date.now()}`;
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st(focus)))}); 1`);
  await go(focus ? `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=classic` : `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwPointName === 'function' && typeof __cmwCards === 'function' && __cmwP().steps.length === 2 && __cmwCards().focus === ${focus}` });
  const name = (id, primes) => ev(`__cmwPointName(${JSON.stringify(id)}, ${primes})`);
  return { z1: await name('sa', 1), z2: await name('sa', 2), w1: await name('sb', 1), w0: await name('sb', 0) };
};
const whole = info.whole = await names(0);
ok('a point drawn on z, one map on, is w₁(z₀)', whole.z1 === 'w₁(z₀)', whole);
ok('a point drawn on z, two maps on (the whole map), is F(z₀)', whole.z2 === 'F(z₀)', whole);
ok('a point drawn on w₁, one map on (shown on w₂), is w₂(w₁,₁)', whole.w1 === 'w₂(w₁,₁)', whole);
ok('a point on its own plane keeps its name, with no prime: w₁,₁', whole.w0 === 'w₁,₁', whole);
const two = info.focus2 = await names(2);
ok('with step 2 focused, a point drawn on z, one map on, is f₂(z₀)', two.z1 === 'f₂(z₀)', two);
ok('with step 2 focused, a point drawn on z, two maps on, is f₂(z₀)', two.z2 === 'f₂(z₀)', two);
ok('with step 2 focused, a point drawn on w₁, one map on, is f₂(w₁,₁)', two.w1 === 'f₂(w₁,₁)', two);
ok('with step 2 focused, a point on its own plane keeps its name: w₁,₁', two.w0 === 'w₁,₁', two);
return { pass: fails.length === 0, fails, info };

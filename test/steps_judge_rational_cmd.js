// held_frames.js's judge on a rational map's glide (#2029): (z^2 + 1)/(z^2 + z + 1), Everywhere, the colour plane the
// last plane, its zoom path drawn by the inverse pass's exact ops (AFF, RAT2, AFF). Over the left of the pane the two
// points of plane z over w have sheet keys a few thousandths of an octave apart, more than Inverse.front's tie band:
// the smaller key is the front point there, and the judge's reference orders them by Inverse.front itself.
// - exactness: the frame held at u = 1/4 and at u = 1/2 is the inverse pass's, and its carried colour is the exact
//   picture (held_frames.js's judge);
// - controls, each with at least JUDGE_MIN_N pixels compared, fail the judge: the frame of the other u, graded by this
//   u's record, and a cross-fade of the two planes' parked frames at u.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views-1 shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, fade, wordsOff, judge, JUDGE_MIN_N } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
// a page opened in the steps view on the one-step chain, Everywhere, the colour plane the last plane, its labels off
const open = async (step, tag) => {
  const ns = `${tag}${Date.now()}`;
  const state = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
    shapes: [{ id: 'd1', kind: 'disc', c: [0.4, 0.2], r: 0.8, ci: 0, visible: true }], steps: [Object.assign({ on: true }, step)] };
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
  await wordsOff();
  await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
};
// at rest on plane i, its frame drawn
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 120000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
await view(1200, 800, false, false);

const US = [0.25, 0.5], NAME = '(z^2 + 1)/(z^2 + z + 1)';
await open({ type: 'rational', params: { p: '1, 0, 1', q: '1, 1, 1' } }, 'judgerat');
await rest(1);
ok(`${NAME}: plane w1 at rest settles`, await grab('R1'), null);
await rest(0);
ok(`${NAME}: plane z at rest settles`, await grab('R0'), null);
for (const u of US) {
  { const h = await hold(u); ok(`${NAME} u = ${u}: the thread is held`, h.ok, h); }
  ok(`${NAME} u = ${u}: the moving frame settles`, await grab('M' + u), null);
  const g = await ev('(() => { const g = __cmwSteps().glide; return g && { b: g.b, u: g.u, path: g.path, alpha: g.alpha }; })()');
  ok(`${NAME} u = ${u}: the frame is the inverse pass's`, !!g && g.path === 'inverse' && g.b === 1 && Math.abs(g.u - u) < 1e-9, g);
  const j = await judge('R0', 'M' + u);
  info[`judge u=${u}`] = j;
  ok(`${NAME} u = ${u}: the carried colour is the exact picture (judge passes)`, j.pass, j);
  ok(`${NAME} u = ${u}: the cross-fade frame exists`, await fade('R0', 'R1', u, 'X' + u), null);
  const c = await judge('R0', 'X' + u, { as: 'M' + u });
  info[`control cross-fade u=${u}`] = c;
  ok(`${NAME} u = ${u}: control: a cross-fade of the two planes' frames does not pass the judge`, !c.pass && c.n >= JUDGE_MIN_N, c);
  await ev('window.__svScrubUp(), 1');
  await rest(0);
}
// (each u's frame graded by the other u's record)
for (const [u, o] of [US, [...US].reverse()]) {
  const c = await judge('R0', 'M' + o, { as: 'M' + u });
  info[`control frame u=${o} as u=${u}`] = c;
  ok(`${NAME}: control: the frame at u = ${o} does not pass the judge of u = ${u}`, !c.pass && c.n >= JUDGE_MIN_N, c);
}

return { pass: fails.length === 0, fails, info };

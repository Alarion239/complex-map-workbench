// The steps view's glide of z^n for n < 0 (pown's path: z^{1+2(|n|-1)t} to t = 1/2, then the elliptic Möbius path from
// the identity to 1/w after z^|n|), Everywhere, the colour plane with a disc about 0 (#1491):
// - cost: the frame held at x = 0.5, the left pane drawn ten times in a row and read back each time (__cmwTime), against
//   z^2's in the same scene: on the plane, z^-2's and z^-1's within twice z^2's; on the sphere, z^-2's within twice
//   z^2's. The inverse pass took these steps by Newton's continuation from seeds at every pixel, and z^-2's frame cost
//   7.3 times z^2's on the plane and 4.1 times on the sphere (lavapipe, 4 cores); their closed forms (Inverse.homOps)
//   cost about what z^2's does. Timing rows (reported, not gated): within 1.3 times;
// - exactness: z^-2 held at x = 0.3 (on the power path) and at 0.75 (on the Möbius path): the frame is the inverse
//   pass's, and its carried colour is the exact picture (held_frames.js's judge); a cross-fade of the two planes'
//   frames, the negative control, is not.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, fade, judge, JUDGE_MIN_N, UNHELD } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
// a page opened in the steps view on a saved state, under a namespace of its own that starts with tag
const openState = async (state, tag) => {
  const ns = `${tag}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
};
const STATE = (n) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n }, on: true }] });
// at rest on plane i of surface surf, its frame drawn
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
await view(1200, 800, false, false);

// ---- cost: the frame held at x = 0.5, ms per draw of the left pane (the median of three reads of ten draws) ----
const HELD_X = 0.5, RATIO = 2, TIMING_RATIO = 1.3;
async function cost(n, surf) {
  await openState(STATE(n), `negpow${n}${surf}`);
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: '${surf}' }), 1`);
  await rest(0);
  await ev(`__cmwSteps({ x: ${HELD_X} }), 1`);
  await settled({ max: 60000, until: `${UNHELD} && Math.abs(__cmwSvX() - ${HELD_X}) < 1e-9` });
  const reads = [];
  for (let i = 0; i < 3; i++) reads.push(await ev('__cmwTime(10).left'));
  const ms = [...reads].sort((a, b) => a - b)[1];
  return { ms, reads, path: await ev('(() => { const g = __cmwSteps().glide; return g ? g.path : null; })()') };
}
for (const surf of ['plane', 'sphere']) {
  const base = await cost(2, surf);
  info[`cost ${surf} z^2`] = base;
  ok(`${surf}: z^2's held frame is timed`, base.ms > 0, base);
  for (const n of surf === 'plane' ? [-2, -1] : [-2]) {
    const c = await cost(n, surf);
    info[`cost ${surf} z^${n}`] = c;
    ok(`${surf}: z^${n}'s held frame is timed`, c.ms > 0, c);
    ok(`${surf}: z^${n}'s held frame costs at most ${RATIO} times z^2's`, c.ms > 0 && c.ms <= RATIO * base.ms, { n: c, z2: base });
    ok(`timing: ${surf}: z^${n}'s held frame costs at most ${TIMING_RATIO} times z^2's`, c.ms > 0 && c.ms <= TIMING_RATIO * base.ms, { n: c, z2: base });
  }
}

// ---- exactness: z^-2 held on each part of its path ----
// (every 7 px: at u = 0.75 a quarter of the samples have their z off the canvas, near the pole at 0 and far out)
const JUDGE_STEP = 7;
await openState(STATE(-2), 'negpowexact');
await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
await rest(1);
ok('z^-2: plane w1 parked frame settles', await grab('R1'), null);
await rest(0);
ok('z^-2: plane z parked frame settles', await grab('R0'), null);
for (const u of [0.3, 0.75]) {
  { const h = await hold(u); ok(`z^-2 u = ${u}: the thread is held`, h.ok, h); }
  ok(`z^-2 u = ${u}: the moving frame settles`, await grab('M' + u), null);
  const g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, b: g.b }; })()');
  ok(`z^-2 u = ${u}: the frame is the inverse pass's`, !!g && g.path === 'inverse', g);
  const j = await judge('R0', 'M' + u, { step: JUDGE_STEP });
  info['judge u=' + u] = j;
  ok(`z^-2 u = ${u}: the carried colour is the exact picture's (judge passes)`, j.pass, j);
  ok(`z^-2 u = ${u}: the cross-fade frame exists`, await fade('R0', 'R1', u, 'X' + u), null);
  const c = await judge('R0', 'X' + u, { step: JUDGE_STEP });
  info['control u=' + u] = c;
  ok(`z^-2 u = ${u}: negative control: a cross-fade of the two planes' frames does not pass the judge`, !c.pass && c.n >= JUDGE_MIN_N, c);
  await ev('window.__svScrubUp(), 1');
  await rest(0);
}

return { pass: fails.length === 0, fails, info };

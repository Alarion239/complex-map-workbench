// The steps view's glides whose homotopy has a closed-form inverse (#1937, design A), Everywhere, the colour plane the
// last plane: each frame is the inverse pass's, with no Newton's method, and is the same however its place was reached.
// The steps (CASES):
// - cos, cosh, arccos and arcosh play their zoom paths (NatPaths.ZOOM): cos about π/2 by sin's ops, arccos about 0 by
//   arcsin's, cosh about arsinh 1 and arcosh about √2 by their own, each between two affine maps (Inverse.homOps);
// - the cubic z^3 - 2z + 1 and the quartic z^3 + 1/z play their zoom paths by the closed-form cubic and quartic
//   (InvOps.opRatN: Cardano's and Ferrari's roots) between two affine maps.
// The rows:
// - at each of a step's us the frame is drawn by the inverse pass (the glide's record, path 'inverse') and none of the
//   ops it inverted is NEWT; for cos and the cubic at u = 0.5, and for the quartic at u = 0.25, the carried colour is
//   the exact picture (held_frames.js's judge; the quartic's frame at u = 0.5 gives it fewer than JUDGE_MIN_N pixels to
//   compare);
// - the same place either way (cos and the cubic): the frame at u = 0.5 reached through 0.1, ..., 0.4 from plane z and
//   through 0.9, ..., 0.6 from plane w1: at most SAME_FRAC of the pixels more than DIFF_TOL apart;
// - arrival: the frame at u = 1 - 10^-4 against plane w1 at rest away from the lines (held_frames.js's sameAway: the
//   dashes of an image's edge start where its path does, which moves with u), at most ARRIVAL_FRAC of the pixels more
//   than DIFF_TOL apart, for each step (a u close enough to 1 that a fast but continuous end of the motion does not
//   count);
// - cost (cos): the frame held at u = 0.5, the left pane drawn ten times in a row and read back each time (__cmwTime),
//   against z^2's in the same session: within the step's cost times (lavapipe: cos about 1.3-1.6). Timing rows
//   (reported, not gated, cos and the cubic): within its timing times. The cubic's cost is a timing row only: on lavapipe
//   its frame costs 1.23-1.60 times z^2's by its closed form and 1.49-1.79 by Newton's method (six rounds each, one
//   session), and the hosted runner's Gates read 1.38-1.45, so no bound tells the two apart and a gated one fails runs
//   with the closed form; a cubic that falls back to Newton fails the rows above (none of its ops is NEWT). Its
//   reported level, 1.65, is above the closed form's spread on both machines.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, compare, sameAway, wordsOff, judge, UNHELD, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
// a page opened in the steps view on the one-step chain step, Everywhere, the colour plane the last plane, its labels off
const open = async (step, tag) => {
  const ns = `${tag}${Date.now()}`;
  const state = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
    shapes: [{ id: 'd1', kind: 'disc', c: [0.4, 0.2], r: 0.8, ci: 0, visible: true }], steps: [Object.assign({ on: true }, step)] };
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
  await wordsOff();
  await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
};
// at rest on plane i, its frame drawn
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 120000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
// the thread placed at x directly, once a glide frame at x was drawn and the programs are linked
const place = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  return settled({ max: 120000, until: `GLR.pendingLinks === 0 && ${UNHELD} && Math.abs(__cmwSvX() - ${x}) < 1e-9 && (() => { const g = __cmwSteps().glide; return !!g && Math.abs(g.u - ${x}) < 1e-9; })()` });
};
const record = () => ev('(() => { const g = __cmwSteps().glide; return g && { b: g.b, u: g.u, path: g.path, reason: g.reason, ops: g.ops }; })()');
const noNewton = (g) => !!g && Array.isArray(g.ops) && g.ops.length > 0 && !g.ops.includes('NEWT');
await view(1200, 800, false, false);

// the steps: us, where the frame's path and ops are read; judge, the u (one of us) where its colour is judged; same, the frame at 0.5
// from either end; cost and timing: the bounds of its held frame against z^2's, gated and reported (none: not timed)
const CASES = {
  cos: { step: { type: 'cos' }, us: [0.25, 0.5, 0.75], judge: 0.5, same: true, cost: 2.5, timing: 1.6 },
  cosh: { step: { type: 'cosh' }, us: [0.5] },
  arccos: { step: { type: 'arccos' }, us: [0.5] },
  arcosh: { step: { type: 'arcosh' }, us: [0.5] },
  cubic: { step: { type: 'poly', params: { co: '1, 0, -2, 1' } }, us: [0.25, 0.5, 0.75], judge: 0.5, same: true, timing: 1.65 },
  quartic: { step: { type: 'custom', params: { expr: 'z^3+\\frac{1}{z}', cut: 180 } }, us: [0.25, 0.5, 0.75], judge: 0.25 },
};
const SAME_FRAC = 1e-4, ARRIVAL_FRAC = 0.002, ARRIVAL_U = 1 - 1e-4;

// ---- each step: the inverse pass with no Newton op, and the arrival ----
for (const [name, c] of Object.entries(CASES)) {
  await open(c.step, `closed${name}`);
  await rest(1);
  ok(`${name}: plane w1 at rest settles`, await grab(`${name}R1`), null);
  await rest(0);
  ok(`${name}: plane z at rest settles`, await grab(`${name}R0`), null);
  for (const u of c.us) {
    { const h = await hold(u); ok(`${name} u = ${u}: the thread is held`, h.ok, h); }
    ok(`${name} u = ${u}: the moving frame settles`, await grab(`${name}M${u}`), null);
    const g = await record();
    info[`${name} u=${u}`] = g;
    ok(`${name} u = ${u}: the frame is the inverse pass's`, !!g && g.path === 'inverse' && g.b === 1, g);
    ok(`${name} u = ${u}: no op the inverse pass inverted is Newton's`, noNewton(g), g);
    if (c.judge === u) {
      const j = await judge(`${name}R0`, `${name}M${u}`);
      info[`${name} judge u=${u}`] = j;
      ok(`${name} u = ${u}: the carried colour is the exact picture (judge passes)`, j.pass, j);
    }
    await ev('window.__svScrubUp(), 1');
    await rest(0);
  }
  const p = await place(ARRIVAL_U);
  ok(`${name}: a frame at u = 1 - 1e-4 is drawn`, p.ok, p);
  ok(`${name} u = 1 - 1e-4: the frame settles`, await grab(`${name}A`), null);
  const d = await sameAway(`${name}A`, `${name}R1`, DIFF_TOL);
  info[`${name} arrival`] = d;
  ok(`${name}: the frame at u = 1 - 1e-4 is plane w1 at rest away from the lines (at most ${ARRIVAL_FRAC} of the pixels more than ${DIFF_TOL} apart)`, !!d && d.n > 0 && d.over <= ARRIVAL_FRAC, d);
}

// ---- the same frame at u = 0.5 from either end ----
const walk = async (xs, tag) => {
  for (const x of xs) { const p = await place(x); if (!p.ok) return { at: x, p }; }
  return (await grab(tag)) ? null : { grab: tag };
};
for (const [name, c] of Object.entries(CASES).filter(([, q]) => q.same)) {
  await open(c.step, `closedsame${name}`);
  await rest(0);
  const fromZ = await walk([0.1, 0.2, 0.3, 0.4, 0.5], `${name}Z`);
  ok(`${name}: u = 0.5 reached from plane z is drawn`, fromZ === null, fromZ);
  const gz = await record();
  await rest(1);
  const fromW = await walk([0.9, 0.8, 0.7, 0.6, 0.5], `${name}W`);
  ok(`${name}: u = 0.5 reached from plane w1 is drawn`, fromW === null, fromW);
  const gw = await record();
  const d = await compare(`${name}Z`, `${name}W`);
  info[`${name} same`] = { d, gz, gw };
  ok(`${name}: u = 0.5 from either end is the same frame (at most ${SAME_FRAC} of the pixels more than ${DIFF_TOL} apart)`, !!d && d.frac <= SAME_FRAC, { d, gz, gw });
}

// ---- cost: the frame held at u = 0.5 against z^2's, ms per draw of the left pane (the median of three reads of ten draws) ----
async function cost(step, tag) {
  await open(step, tag);
  await rest(0);
  const p = await place(0.5);
  const reads = [];
  for (let i = 0; i < 3; i++) reads.push(await ev('__cmwTime(10).left'));
  return { ms: [...reads].sort((a, b) => a - b)[1], reads, placed: p.ok, glide: await record() };
}
{
  const z2 = await cost({ type: 'pown', params: { n: 2 } }, 'closedcostz2');
  info.cost = { z2 };
  ok('cost: z^2\'s held frame is timed', z2.ms > 0 && z2.placed, z2);
  for (const [name, c] of Object.entries(CASES).filter(([, q]) => q.cost || q.timing)) {
    const k = await cost(c.step, `closedcost${name}`);
    info.cost[name] = k;
    ok(`cost: ${name}'s held frame is timed`, k.ms > 0 && k.placed, k);
    if (c.cost) ok(`cost: ${name}'s held frame costs at most ${c.cost} times z^2's`, k.ms > 0 && k.ms <= c.cost * z2.ms, { z2, [name]: k });
    ok(`timing: ${name}'s held frame costs at most ${c.timing} times z^2's`, k.ms > 0 && k.ms <= c.timing * z2.ms, { z2, [name]: k });
  }
}

return { pass: fails.length === 0, fails, info };

// The steps view's glide changes a later plane's region from the look it has on the glide's first plane to the one it
// has on the plane the glide reaches step by step, with no switch at the midpoint: on the glide a -> b = 0 -> 1 (two
// Möbius steps; a disc on plane 0, two discs on plane 1), the frames held still on the rail at U_STEPS, STEP apart about
// u = 0.5, differ across the midpoint (the share of pixels more than DIFF_TOL apart, held_frames.js's compare) by at
// most JUMP_K times the larger of the steps on either side of it. The control: the frames held at CONTROL_U, far apart
// on the glide, differ on more than CONTROL_FRAC of the pixels. Inside regions and Everywhere (SCOPES).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const STEP = 0.02, U_STEPS = [0.5 - 1.5 * STEP, 0.5 - 0.5 * STEP, 0.5 + 0.5 * STEP, 0.5 + 1.5 * STEP], CONTROL_U = [0.3, 0.7];
const JUMP_K = 1.5, CONTROL_FRAC = 0.2, SCOPES = ['in', 'all'];
await view(1200, 800);
const ST = {
  pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50,
  srcView: { cx: 0, cy: 0, s: 110 },
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [
    { id: 'p0', kind: 'disc', c: [0.2, -0.2], r: 1.4, ci: 1, visible: true },
    { id: 'c1', kind: 'disc', c: [0.4, 0.3], r: 0.6, ci: 2, visible: true, stage: 1 },
    { id: 'd1', kind: 'disc', c: [-0.5, 0.4], r: 0.3, ci: 3, visible: true, stage: 1 },
  ],
  targets: [],
};
await load('svblend' + Date.now(), ST);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
const { hold, grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
for (const scope of SCOPES) {
  const r = info[scope] = {};
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${scope}', surf: 'plane' }), 1`);
  await rest(0);
  for (const u of [...U_STEPS, ...CONTROL_U]) {
    ok(`${scope}: the thread is held at u = ${u}`, (await hold(u)).ok, u);
    ok(`${scope}: the frame held at u = ${u} is still`, await grab(scope + u), u);
    await ev('window.__svScrubUp(), 1');
    await rest(0);
  }
  const diff = async (a, b) => { const d = await compare(scope + a, scope + b); return d ? d.frac : null; };
  const [u0, u1, u2, u3] = U_STEPS;
  r.before = await diff(u0, u1); r.across = await diff(u1, u2); r.after = await diff(u2, u3);
  r.control = await diff(...CONTROL_U);
  ok(`${scope}: across u = 0.5 the frame changes no more than JUMP_K (${JUMP_K}) times the steps beside it`, r.across != null && r.before != null && r.after != null && r.across <= JUMP_K * Math.max(r.before, r.after), r);
  ok(`${scope}: control: the frames at u = ${CONTROL_U.join(' and ')} differ on more than ${CONTROL_FRAC * 100} % of the pixels`, r.control != null && r.control > CONTROL_FRAC, r);
}
return { pass: fails.length === 0, fails, info };

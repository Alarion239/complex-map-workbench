// The render-ahead frames (#1339) on the Stack (#2283): a slow glide on the Stack has its frames drawn ahead off-screen,
// as on the Plane, and they are the floor's flat picture, which the Stack's camera maps as it shows them. z^-2 with a disc
// about 0, Everywhere, at the fast speed, on the Stack; the cost at most which a motion plays live is set to 0 (ahead: {
// ms: 0 }) and the wait's cap lifted, so the frames are drawn ahead on any machine:
// - first: the chain's first glide plays live, and its frame cost is measured after it ends (the probe draws its frames);
// - made: the next glide 0 -> 1 waits until its frames are made, every one the inverse pass's;
// - same: straight down (the floor's map the identity), frame k drawn ahead is the left pane drawn live, byte for byte,
//   at k = 1 and N/2; control: frame k + 1 is not;
// - tilted: with the camera turned to Tilt during the glide, the frames still shown are the ones drawn ahead (the camera
//   is no part of their key), and the Stack draws them through its camera: the pane's top-left corner, off the tilted
//   floor, is the bare plane;
// - frame 0: on a zeros-and-poles chain, straight down, frame 0 drawn ahead (the plane z at the glide's start) is the live
//   frame 0, byte for byte (control: frame 0 against the live frame 1 differs).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); return !!cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const WAIT_MS = 120000, DEG = Math.PI / 180;
const ZP = [{ type: 'zp', params: { a: '1', zeros: '1+0.5i', poles: '' }, on: true }];
const STATE = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 }, sv: { speed: 'fast' },
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.5, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: -2 }, on: true }] };
const open = async (state) => {
  const ns = `stackahead${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const up = await settled({ only: true, max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwAhead === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!up.ok) throw new Error('the page hooks are not up: ' + JSON.stringify(up));
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'stack', ahead: { ms: 0, waitMs: ${WAIT_MS} } }), 1`);
};
await view(900, 600, false, false);
await open(STATE);
const S = () => ev('(() => { const s = __cmwSteps(); return { x: s.x, anim: !!s.anim, moving: s.moving, ahead: s.ahead, surf: s.surf, cost: s.aheadCost, probe: s.aheadProbe }; })()');
const stack = () => ev('typeof __cmwStack === "function" ? __cmwStack() : null');
const rest = async (i) => {
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  await settled({ only: true, max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === ${i} && __cmwSteps().ready.ready` });
};
const cam = (yaw, pitch) => ev(`__cmwCam('L', { yaw: ${yaw * DEG}, pitch: ${pitch * DEG} }), 1`);
// the left pane's top-left device pixel, and the plane's colour (--plane), as [r, g, b]
const corner = () => ev(`(() => { const d = document.getElementById('canvasL').getContext('2d').getImageData(2, 2, 1, 1).data, p = getComputedStyle(document.documentElement).getPropertyValue('--plane').trim(); return { px: [d[0], d[1], d[2]], plane: [1, 3, 5].map((i) => parseInt(p.slice(i, i + 2), 16)) }; })()`);
const bare = (c) => !!c && c.px.every((v, i) => Math.abs(v - c.plane[i]) <= 2);
// the chain's first glide 0 -> 1, then its cost measured by the probe: -> the steps view's state after it
const prime = async () => {
  await rest(0);
  await ev('__cmwSteps({ clock: 1000 / 60, go: 1 }), 1');
  await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });
  const m = await settled({ only: true, max: WAIT_MS, until: '(() => { const p = __cmwSteps().aheadProbe; return !!p && p.state !== "waiting" && p.state !== "drawing"; })()' });
  return { m, s: await S() };
};
await rest(0);
const s0 = await S(), st0 = await stack();
ok('the page shows the Stack', s0.surf === 'stack' && !!st0 && st0.on, { s0, st0 });

// ---- first: the chain's first glide plays live; its cost is measured after it ends ----
const { m, s: f } = await prime();
info.first = { cost: f.cost, probe: f.probe };
ok('first: on the Stack, the chain\'s frame cost is measured once its first glide has ended (the probe drew its frames)', m.ok && !!f.probe && f.probe.state === 'done' && f.cost > 0, info.first);

// ---- made and same: straight down, the glide 0 -> 1 with its clock still ----
await rest(0);
await cam(0, 90);
await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
const g = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' });
const s = await S(), R = s.ahead;
info.made = R && Object.assign({}, R, { recs: R.recs && R.recs.slice(0, 4) });
ok('made: the glide starts', g.ok && s.anim, { g, s: { anim: s.anim, moving: s.moving } });
ok('made: on the Stack its frames are drawn ahead, all of them', !!R && R.state === 'done' && R.n === R.N && R.N > 2, info.made);
ok('made: every frame is the inverse pass\'s', !!R && !!R.recs && R.recs.length === R.N && R.recs.every((p, k) => p === 'inverse' || k === 0), R && R.recs);
if (R && R.state === 'done') {
  for (const k of [1, R.N >> 1]) {
    const c = await ev(`__cmwAhead(${k})`), x = await ev(`__cmwAhead(${Math.min(R.N - 1, k + 1)}, ${k})`);
    info[`same k=${k}`] = { same: c, next: x };
    ok(`same k = ${k}: straight down, the frame drawn ahead is the live frame, byte for byte`, !!c && c.n > 0 && c.diff === 0, c);
    ok(`same control k = ${k}: frame k + 1 is not`, !!x && x.n > 0 && x.diff > 0, x);
  }
  // ---- tilted: the camera turned during the glide; the frames shown are still the ones drawn ahead ----
  await cam(-30, 35);
  const before = (await S()).ahead.shown;
  await ev('__cmwTime(10).left');
  const after = await S(), st = await stack(), c = await corner();
  info.tilted = { shown: after.ahead && after.ahead.shown - before, state: after.ahead && after.ahead.state, camera: st && st.drawn && st.drawn.camera, corner: c };
  ok('tilted: the frames shown are still the ones drawn ahead', !!after.ahead && after.ahead.state === 'done' && after.ahead.shown - before >= 10, info.tilted);
  ok('tilted: the Stack draws them through its camera', !!st && !!st.drawn && Math.abs(st.drawn.camera.pitch - 35 * DEG) < 1e-9, info.tilted);
  ok('tilted: the floor drawn from them is mapped by the camera: the pane\'s top-left corner is the bare plane', bare(c), c);
}
await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });

// ---- frame 0: a zeros-and-poles chain's frame 0 drawn ahead, straight down ----
await open(Object.assign({}, STATE, { steps: ZP }));
const z0 = await prime();
info.zpFirst = { cost: z0.s.cost, probe: z0.s.probe };
await rest(0);
await cam(0, 90);
await ev('__cmwSteps({ clock: 1e-6 }), __cmwSteps({ go: 1 }), 1');
const gz = await settled({ only: true, max: WAIT_MS, until: '!!__cmwSteps().anim' });
const Rz = (await S()).ahead;
info.zp = { up: gz.ok, state: Rz && Rz.state, n: Rz && Rz.n, N: Rz && Rz.N };
ok('frame 0: the zeros-and-poles chain\'s frames are drawn ahead on the Stack', gz.ok && !!Rz && Rz.state === 'done' && Rz.n === Rz.N, info.zp);
if (Rz && Rz.state === 'done') {
  const c0 = await ev('__cmwAhead(0)'), x0 = await ev('__cmwAhead(0, 1)');
  info.zp0 = { same: c0, next: x0 };
  ok('frame 0: straight down, frame 0 drawn ahead is the live frame 0, byte for byte', !!c0 && c0.n > 0 && c0.diff === 0, c0);
  ok('frame 0 control: frame 0 drawn ahead is not the live frame 1', !!x0 && x0.n > 0 && x0.diff > 0, x0);
}
await ev('__cmwSteps({ clock: 1000 / 60 }), 1');
await settled({ only: true, max: 60000, until: '!__cmwSteps().moving' });

return { pass: fails.length === 0, passed: pass, fails, info };

// A globe gesture ends at the place the pointer is released, also when no move reached that place (moves can be merged or
// dropped while a frame is busy; a quick flick is a press and a release): the first Disc drag onto N on the X globe
// (p3b_accept_cmd.js's step 1: the rim through N, stored as a half-plane). The pointer is released 3 px from N in each case:
// - after every move of the drag (the whole path): a half-plane;
// - after all moves but the last (the last place only in the release, 29 px short of N before it): a half-plane, not a disc;
// - with no move after the press (a press at the cap's centre, a release at N): a half-plane.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the images shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const SETTLE_MS = 900, LOAD_MS = 1500, CAM_MS = 800, TOOL_MS = 300, MOVE_GAP_MS = 16; // waits for frames to run
const LOAD_MAX_MS = 30000;
const settle = async (ms = SETTLE_MS) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
const VIEW_W = 1440, VIEW_H = 900;
const CAM = { pitch: 0.55, yaw: -1.0 }; // N is on screen from here
const CAP_Y = 1.2; // a source point near the cap's centre (the unit disc's rim is at 1)
const PAST_N = [3, 2]; // px from N where the pointer is released
const SRC_SCALE = 80; // px per unit of the source plane
await view(VIEW_W, VIEW_H, false);
const at = async (x, y) => {
  const o = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left, r.top]; })()`);
  const q = await ev(`__cmwGlobeXY('L', ${x}, ${y})`);
  return q ? [o[0] + q[0], o[1] + q[1]] : null;
};
const N_STEPS = 12;
for (const [name, moves] of [['the whole path', N_STEPS], ['all moves but the last', N_STEPS - 1], ['no move after the press', 0]]) {
  await load('globerel' + Date.now(), { shapes: [], steps: [CAY], srcView: { cx: 0, cy: 0, s: SRC_SCALE }, snap: true });
  await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.getElementById("canvasL")' });
  await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere' }); 1`); await settle(LOAD_MS);
  await ev(`__cmwCam("L", ${JSON.stringify(CAM)}); 1`); await settle(CAM_MS);
  const inf = await at(NaN, NaN);
  await ev(`document.querySelector('#tools .tool[data-tool="disc"]').click(); 1`); await settle(TOOL_MS);
  const c0 = await at(0, CAP_Y);
  ok(`${name}: N and the cap's centre are on screen`, !!inf && !!c0, { inf, c0 });
  if (!inf || !c0) continue;
  const x1 = inf[0] + PAST_N[0], y1 = inf[1] + PAST_N[1];
  await drag(c0[0], c0[1], x1, y1, N_STEPS, MOVE_GAP_MS, { moves });
  await settle();
  const S = await ev('__cmwShapes()');
  info[name] = S.shapes.map((s) => ({ kind: s.kind, a: s.a, b: s.b, c: s.c, r: s.r }));
  ok(`${name}: the Disc whose rim is released on N is stored as a half-plane`, S.shapes.length === 1 && S.shapes[0].kind === 'halfplane', info[name]);
}
return { pass: fails.length === 0, fails, info };

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
const settle = async (ms = 900) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const CAY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
await view(1440, 900, false);
const at = async (x, y) => {
  const o = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left, r.top]; })()`);
  const q = await ev(`__cmwGlobeXY('L', ${x}, ${y})`);
  return q ? [o[0] + q[0], o[1] + q[1]] : null;
};
const N_STEPS = 12;
for (const [name, moves] of [['the whole path', N_STEPS], ['all moves but the last', N_STEPS - 1], ['no move after the press', 0]]) {
  await load('globerel' + Date.now(), { shapes: [], steps: [CAY], srcView: { cx: 0, cy: 0, s: 80 }, snap: true });
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.getElementById("canvasL")' });
  await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere' }); 1`); await settle(1500);
  await ev('__cmwCam("L", { pitch: 0.55, yaw: -1.0 }); 1'); await settle(800);
  const inf = await at(NaN, NaN);
  await ev(`document.querySelector('#tools .tool[data-tool="disc"]').click(); 1`); await settle(300);
  const c0 = await at(0, 1.2);
  ok(`${name}: N and the cap's centre are on screen`, !!inf && !!c0, { inf, c0 });
  if (!inf || !c0) continue;
  const x1 = inf[0] + 3, y1 = inf[1] + 2;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c0[0], y: c0[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c0[0], y: c0[1], button: 'left', clickCount: 1 });
  for (let i = 1; i <= moves; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c0[0] + (x1 - c0[0]) * i / N_STEPS, y: c0[1] + (y1 - c0[1]) * i / N_STEPS, button: 'left', buttons: 1 });
    await sleep(16);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
  await settle();
  const S = await ev('__cmwShapes()');
  info[name] = S.shapes.map((s) => ({ kind: s.kind, a: s.a, b: s.b, c: s.c, r: s.r }));
  ok(`${name}: the Disc whose rim is released on N is stored as a half-plane`, S.shapes.length === 1 && S.shapes[0].kind === 'halfplane', info[name]);
}
return { pass: fails.length === 0, fails, info };

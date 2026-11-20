// The cut control in later planes (steps view): a cut is a curve in its own plane and every later plane shows that curve
// carried there by the map, with the θ handle on it, and a drag of the handle turns the cut by the pointer's pull-back.
// - the logarithm (cut 180°), plane w₁: both banks are the lines Im w = ±π (the counter-clockwise bank solid, the other dashed),
//   the handle lies on one of them, and a drag of the handle up turns θ the way that bank moves (Im w = θ − 2π: up is θ
//   larger); the θ chip carries the step's subscript;
// - √z, plane w₁: the two banks are the rays at θ/2 and θ/2 + π;
// - a drag into a region with no pull-back holds θ;
// - the handle's reach: 22 px for a finger, 12 px for a mouse; a zero or pole nearer than the handle takes the press.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const open = async (type, params, plane, before, after) => {
  const ns = 'cutcurve' + Date.now();
  await loadView('steps', ns, { srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: (before || []).concat([{ type, params, on: true }], after || []), height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ go: ${plane}, now: true }); 1`); await settled({ max: 60000 });
};
const J = (e) => ev(`(${e})`);
const cut = () => handles().then((h) => (h[0] ? h[0].deg : null));
const curves = () => J('__cmwCutCurves()');
const handles = () => J('__cmwCutHandles()');

await open('log', { cut: 180 }, 1);
let cv = await curves(), hs = await handles();
const solid = cv.find((c) => c.solid), dash = cv.find((c) => !c.solid);
ok('log: both banks drawn', !!solid && !!dash && solid.w.length > 100 && dash.w.length > 100, cv.map((c) => [c.solid, c.w.length]));
const dev = (c, im) => Math.max(...c.w.map((p) => Math.abs(p[1] - im)));
info.logDev = [solid && dev(solid, -Math.PI), dash && dev(dash, Math.PI)];
ok('log: the solid bank is Im w = θ − 2π = −π', !!solid && dev(solid, -Math.PI) < 1e-5, info.logDev);
ok('log: the dashed bank is Im w = θ = π', !!dash && dev(dash, Math.PI) < 1e-5, info.logDev);
ok('log: one carried handle, on the solid bank', hs.length === 1 && hs[0].carried && Math.abs(hs[0].w.im + Math.PI) < 1e-5, hs);
// a drag of the handle up by 40 px turns θ the way Im w = θ − 2π moves (up is larger)
const c0 = hs[0].deg;
await ev('1'); await drag(hs[0].x, hs[0].y, hs[0].x, hs[0].y - 40, 8, 20); await settled({ max: 20000 });
const c1 = await cut();
info.drag = [c0, c1];
const turn = ((c1 - c0 + 540) % 360) - 180;
info.turn = turn;
ok('log: dragging the handle up raises θ (modulo the turn into the next sheet)', turn > 5 && turn < 90, info.drag);
hs = await handles();
cv = await curves();
const s2 = cv.find((c) => c.solid);
ok('log: the handle is on the moved curve', hs.length === 1 && Math.abs(hs[0].w.im - s2.w[0][1]) < 1e-4, [hs[0] && hs[0].w, s2.w[0]]);

await open('root', { n: 2, cut: 180 }, 1);
cv = await curves();
const ang = (c) => c.w.slice(5, 60).map((p) => Math.atan2(p[1], p[0]));
const spread = (a) => Math.max(...a) - Math.min(...a);
const A = cv.find((c) => c.solid), B = cv.find((c) => !c.solid);
info.root = [A && ang(A)[0], B && ang(B)[0]];
ok('root: two banks, each a ray from the origin', !!A && !!B && spread(ang(A)) < 1e-4 && spread(ang(B)) < 1e-4, info.root);
ok('root: the banks are θ/2 and θ/2 + π', !!A && !!B && Math.abs(Math.abs(ang(A)[0] - ang(B)[0]) - Math.PI) < 1e-4, info.root);

await open('log', { cut: 180 }, 1);
hs = await handles();
const before = hs[0].deg;
// the solid bank is the image's lower edge: a drag below it leaves the principal branch's image, and the cut keeps turning (the pull-back runs on the continued map), as it does for a drag the other way
await drag(hs[0].x, hs[0].y, hs[0].x, hs[0].y + 80, 8, 20); await settled({ max: 20000 });
info.hold = [before, await cut()];
ok("a drag past the image's edge keeps turning the cut", info.hold[1] < before - 30, info.hold);

// a plane before the cut: the chain z + 1, then the logarithm (cut 180°); on plane z the cut is the preimage of its ray,
// the real half-line left of −1, the handle is on it, and a drag of the handle sets θ by mapping the pointer forward
await open('log', { cut: 180 }, 0, [{ type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }]);
cv = await curves(); hs = await handles();
const pre = cv.find((c) => c.pre);
info.pre = pre && pre.w.map((t) => [t.length, Math.max(...t.map((q) => Math.abs(q[1]))), Math.max(...t.map((q) => q[0]))]);
ok('before the cut: the preimage curve is the real half-line left of −1', !!pre && pre.w.length === 1 && pre.w[0].length > 100 && info.pre[0][1] < 1e-6 && info.pre[0][2] < -1 + 1e-6, info.pre);
ok('before the cut: a carried handle on it', hs.length >= 1 && hs.some((h) => h.carried && Math.abs(h.wz.im) < 1e-6), hs);
const h = hs.find((q) => q.carried), d0 = h.deg;
await drag(h.x, h.y, h.x, h.y - 40, 8, 20); await settled({ max: 20000 });
const h2 = (await handles()).find((q) => q.carried);
const turn2 = h2 ? ((h2.deg - d0 + 540) % 360) - 180 : null;
info.turn2 = turn2;
ok('before the cut: dragging the handle up turns θ down (arg of z + 1 falls from π)', turn2 !== null && turn2 < -1, [d0, h2 && h2.deg]);
// a later step with no exact preimage (the exponential has infinitely many): the drag follows the root by continuation
await open('log', { cut: 180 }, 2, [], [{ type: 'exp', params: {}, on: true }]);
hs = await handles();
ok('after exp: a carried handle', hs.length === 1 && hs[0].carried, hs);
if (hs.length) {
  const e0 = hs[0].deg;
  await drag(hs[0].x, hs[0].y, hs[0].x + 12, hs[0].y - 12, 8, 20); await settled({ max: 20000 });
  const e1 = (await handles())[0];
  info.expTurn = [e0, e1 && e1.deg];
  ok('after exp: a drag of the handle turns θ', !!e1 && Math.abs(e1.deg - e0) > 0.5, info.expTurn);
}
// the handle's reach: a finger takes it within 22 px of its centre (a 44 px target), a mouse within 12 px; a press further out
// pans the plane and leaves the cut
{
  const IN_T = 21, OUT_T = 24, IN_M = 11, OUT_M = 14, PULL = 40, GAP_MS = 16;
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const press = async (kind, dx) => {
    await open('log', { cut: 180 }, 1);
    const h = (await handles())[0], c0 = h.deg, x = h.x + dx, y = h.y;
    if (kind === 'touch') {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i <= 8; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - PULL * i / 8, id: 1 }] }); await sleep(GAP_MS); }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      for (let i = 1; i <= 8; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: y - PULL * i / 8, button: 'left', buttons: 1 }); await sleep(GAP_MS); }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y: y - PULL, button: 'left', clickCount: 1 });
    }
    await settled({ max: 20000 });
    const c1 = await cut();
    return Math.abs(((c1 - c0 + 540) % 360) - 180) > 1;
  };
  info.reach = { touchIn: await press('touch', IN_T), touchOut: await press('touch', OUT_T), mouseIn: await press('mouse', IN_M), mouseOut: await press('mouse', OUT_M) };
  ok(`at rest, a finger ${IN_T} px from the handle's centre takes it (θ turns)`, info.reach.touchIn, info.reach);
  ok(`at rest, a finger ${OUT_T} px away does not (the plane pans, θ stays)`, !info.reach.touchOut, info.reach);
  ok(`at rest, a mouse ${IN_M} px from the centre takes it`, info.reach.mouseIn, info.reach);
  ok(`at rest, a mouse ${OUT_M} px away does not: its reach stays 12 px`, !info.reach.mouseOut, info.reach);
  // a zero a few px from the handle: a press nearer the handle takes the handle, one nearer the zero takes the zero (both reach
  // 22 px for a finger). The logarithm's handle on plane w₁, a zeros-and-poles step there with a zero GAP_PX px from it
  const GAP_PX = 16, T_NEAR = 0.3, T_FAR = 0.7;
  const openZero = async (re, im) => open('log', { cut: 180 }, 1, [], [{ type: 'zp', params: { a: '1', zeros: `${re}+${im}i`, poles: '' }, on: true }]);
  await openZero(0, 0);
  const hc0 = (await handles())[0];
  await openZero(hc0.w.re + 0.1, hc0.w.im);
  const zp1 = (await J('__cmwZp()')).handles[0], hc1 = (await handles())[0], ppu = Math.hypot(zp1.x - hc1.x, zp1.y - hc1.y) / 0.1;
  await openZero(hc0.w.re + GAP_PX / ppu, hc0.w.im);
  const near = async (t) => {
    await openZero(hc0.w.re + GAP_PX / ppu, hc0.w.im);
    const hc = (await handles())[0], zp = (await J('__cmwZp()')).handles[0], c0 = hc.deg, z0 = (await J('__cmwZp()')).params.zeros;
    const x = hc.x + t * (zp.x - hc.x), y = hc.y + t * (zp.y - hc.y);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let i = 1; i <= 8; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - PULL * i / 8, id: 1 }] }); await sleep(GAP_MS); }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settled({ max: 20000 });
    const c1 = (await handles())[0], z1 = (await J('__cmwZp()')).params.zeros;
    return { cut: !!c1 && Math.abs(((c1.deg - c0 + 540) % 360) - 180) > 1, zero: z1 !== z0, gap: Math.hypot(zp.x - hc.x, zp.y - hc.y) };
  };
  info.nearer = { handle: await near(T_NEAR), zero: await near(T_FAR) };
  ok(`a press nearer the handle than the zero (${GAP_PX} px apart) takes the handle`, info.nearer.handle.cut && !info.nearer.handle.zero, info.nearer);
  ok('a press nearer the zero than the handle takes the zero', info.nearer.zero.zero && !info.nearer.zero.cut, info.nearer);
  await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
}
return { pass: !fails.length, fails, info };

// The steps view's moving paths on the Plane, after a pan: a selection is kept while at most one kept start's place has
// left the pane, and chosen again when more have (mfViewOk). A start's place is where its path starts on screen: its
// image under H_0, the glide's start (pathsGen), not the start z itself. z² then exp, Everywhere, a disc, the glide
// from w₁ to w₂ held at x = 1.5 (H_0(z) = z², not the identity):
// - the pans searched (in PAN_STEP px, within the 30 % of the pane a pan keeps a selection for) where testing the start z
//   and testing its image z² disagree; at least one is found;
// - for each kind found, after that pan the selection is chosen again exactly when more than one start image has left
//   the pane (__cmwSteps().paths.chosen moves or not).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const PAN_STEP = 8, WAIT_MS = 1200, SCALE = 380;
const QUIET = '__cmwSteps().ready.ready && GLR.pendingLinks === 0';
// (the left plane's box on the page; a wheel turn of dy over (x, y))
const plot = () => ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()`);
const wheel = async (x, y, dy) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); };
const paths = () => ev('(({ heads, chosen, keptZ, src }) => ({ heads, chosen, keptZ, startId: src && src.startId }))(__cmwSteps().paths)');
// the scene at its view, the glide held, its first selection landed: { view, w, h, p }
const scene = async () => {
  await view(1200, 800, false, false);
  const ns = 'svppan' + Date.now();
  await seed(ns, {
    v3: true, v4: true, v5: true, v6: true, alpha: 1, nextId: 50, focus: 0, rightMode: 'image',
    shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
    steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'exp', params: {}, on: true }],
  });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && !!window.GLR` });
  await ev(`__cmwSet('morphPaths', true); __cmwSteps({ go: 1, now: true, surf: 'plane', scope: 'all' }); 1`);
  await settled({ max: 90000, until: QUIET });
  await ev('__cmwSteps({ x: 1.5 }); 1');
  await settled({ max: 90000, until: QUIET });
  // (zoomed in about the disc and its image, SCALE px a unit, so that a pan of 30 % of the pane moves the starts across its
  // edges)
  const r0 = await plot();
  for (let i = 0; i < 40 && (await ev('__cmwSteps().win[2]')) < SCALE; i++) { await wheel(r0.x + r0.w / 2, r0.y + r0.h / 2, -120); await sleep(60); }
  await settled({ max: 90000, until: `${QUIET} && __cmwSteps().paths.heads > 0` });
  await sleep(WAIT_MS);
  return ev(`(() => { const [cx, cy, s] = __cmwSteps().win, r = document.getElementById('canvasL').getBoundingClientRect(); return { view: { cx, cy, s }, w: r.width, h: r.height }; })()`);
};
const s0 = info.scene = await scene();
const p0 = info.start = await paths();
ok('the glide from w₁ to w₂ does not start at the identity, and its paths are drawn', p0.startId === false && p0.heads > 0 && p0.keptZ && p0.keptZ.length > 2, p0);
// how many places have left the pane under the view moved by (dx, dy) px: of the starts z, and of their images z²
const offAt = (v, w, h, dx, dy, pts) => pts.filter(([x, y]) => { const px = w / 2 + (x - (v.cx + dx / v.s)) * v.s, py = h / 2 - (y - (v.cy - dy / v.s)) * v.s; return !(px >= 0 && py >= 0 && px <= w && py <= h); }).length;
const zs = p0.keptZ || [], ims = zs.map(([x, y]) => [x * x - y * y, 2 * x * y]);
const found = {};
for (let dx = -0.29 * s0.w; dx <= 0.29 * s0.w; dx += PAN_STEP) for (let dy = -0.29 * s0.h; dy <= 0.29 * s0.h; dy += PAN_STEP) {
  const oz = offAt(s0.view, s0.w, s0.h, dx, dy, zs), oi = offAt(s0.view, s0.w, s0.h, dx, dy, ims);
  const kind = oi > 1 && oz <= 1 ? 'images out, starts in' : oi <= 1 && oz > 1 ? 'images in, starts out' : null;
  if (kind && !found[kind]) found[kind] = { dx, dy, offZ: oz, offIm: oi };
}
info.found = found;
ok('a pan within 30 % of the pane is found where the starts z and their images z² disagree', Object.keys(found).length > 0, { zs, ims });
for (const [kind, f] of Object.entries(found)) {
  const r = await scene();
  const c0 = (await paths()).chosen;
  const rp = await plot(), x0 = rp.x + rp.w / 2, y0 = rp.y + rp.h / 2;
  await drag(x0, y0, x0 - f.dx, y0 - f.dy, 14, 20);
  await settled({ max: 90000, until: QUIET });
  // (the counts again under the view the drag reached)
  const [vx, vy, vs] = await ev('__cmwSteps().win'), mv = { cx: vx, cy: vy, s: vs };
  f.reached = mv; f.offZ = offAt(mv, r.w, r.h, 0, 0, zs); f.offIm = offAt(mv, r.w, r.h, 0, 0, ims);
  await sleep(WAIT_MS);
  await ev('__cmwSteps({ x: 1.5 }); 1');
  await settled({ max: 90000, until: QUIET });
  await sleep(WAIT_MS);
  const c1 = (await paths()).chosen;
  const again = c1 > c0, want = f.offIm > 1;
  info[kind] = Object.assign({ c0, c1, again, view: r.view }, f);
  ok(`${kind} (${f.offIm} of ${ims.length} images out, ${f.offZ} starts out): the paths are ${want ? 'chosen again' : 'kept'}`, again === want, info[kind]);
}
return { pass: fails.length === 0, fails, info };

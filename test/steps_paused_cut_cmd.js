// A frame parked between two planes turns a cut by its handle. Square root, its cut on plane z at 180°, the glide z -> w₁ parked at
// x = MID_U:
// - the frame draws one handle that takes presses (__cmwCutHandles) and no inert mark (__cmwCutMarks), at the frame's image of its point on
//   the ray (the glide's map at u, __cmwSteps().glide.Hb, within AT_PX);
// - a drag of it along the frame's image of the circle about the branch point, from the handle's angle to TO_DEG, turns the cut there (within
//   TOL_DEG, the card's angle, 225° kept as −135° on the next sheet);
// - the picture follows: the parked frame after the drag is the frame of a page that opens with the cut there, parked at the same place (in
//   blocks of BLOCK px, at most SAME_FRAC of them with a mean channel more than TOL levels apart); control: the frame before the drag differs
//   from it in more than CTL_FRAC of them;
// - hovering the handle lights it, as at rest (the overlay about it changes, and comes back when the pointer leaves);
// - the frame is still parked there, and the drag panned nothing (the view's centre within 1e-9).
// Paths are off (their points are picked per view, not per chain). The branch point of the square root's cut is 0. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const MID_U = 0.5, TO_DEG = 225, ARC_N = 30, AT_PX = 1.5, TOL_DEG = 1, BLOCK = 8, TOL = 6, SAME_FRAC = 0.01, CTL_FRAC = 0.02;
// (SAME_FRAC and CTL_FRAC: on lavapipe the frame after the drag is 0 % of the blocks apart from the reopened page's, and the
// frame before it 5.3 %; the bounds sit between, with that margin on each side)
// (MOVE_GAP_MS: a frame's time between two of the drag's moves, pacing the synthetic input as a hand would; there is no
// condition to wait on between moves)
const MOVE_GAP_MS = 16;
// (HOVER_PX: the half side of the overlay square read about the handle; HOVER_OFF: px away, off it; HOVER_MIN: the changed
// values below which the handle reads as unlit, a few stray antialiased ones)
const HOVER_PX = 14, HOVER_OFF = 60, HOVER_MIN = 20;
// the page with the root's cut and sheet, parked at MID_U
const openParked = async (cut, k) => {
  await view(1200, 800, false, false);
  await loadView('steps', 'svpc' + Date.now(), {
    v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 90 },
    steps: [{ type: 'root', params: { n: 2, cut, k }, on: true }],
    shapes: [{ id: 'a', kind: 'disc', c: [0, 0], r: 2, ci: 0, visible: true }],
  });
  await settled({ max: 40000, until: `typeof __cmwSteps === 'function' && typeof __cmwCutHandles === 'function' && !!document.querySelector('#svStrip .sv-step')` });
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ park: ${MID_U} }), 1`);
  await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${MID_U}) < 1e-9 && !__cmwSteps().anim && GLR.pendingLinks === 0 && __cmwCutHandles().length > 0` });
};
// the left canvas's picture in blocks of BLOCK px: each block's mean r, g, b
const blocks = () => ev(`(() => { const c = document.getElementById('canvasL'), W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, B = ${BLOCK}, out = [];
  for (let y = 0; y + B <= H; y += B) for (let x = 0; x + B <= W; x += B) { const m = [0, 0, 0]; for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const q = 4 * ((y + j) * W + x + i); m[0] += d[q]; m[1] += d[q + 1]; m[2] += d[q + 2]; } out.push(m.map((v) => Math.round(v / (B * B)))); }
  return out; })()`);
const apart = (A, B) => (A && B && A.length === B.length ? A.filter((a, i) => a.some((v, c) => Math.abs(v - B[i][c]) > TOL)).length / A.length : 1);
await openParked(180, 0);
// the frame's map of plane z, the handle and the screen place of a plane-z point in the frame, read in the page
const state = () => ev(`(() => {
  const H = __cmwCutHandles(), M = __cmwCutMarks(), g = __cmwSteps().glide, v = __cmwSteps().win;
  return { handles: H, marks: M.length, x: __cmwSteps().x, cut: +__cmwP().steps[0].params.cut, k: +__cmwP().steps[0].params.k, win: v, hasHb: !!(g && g.Hb) };
})()`);
const scr = (pts) => ev(`(() => { const g = __cmwSteps().glide, r = document.getElementById('canvasL').getBoundingClientRect();
  return ${JSON.stringify(pts)}.map(([re, im]) => { const w = g.Hb({ re, im }), s = __cmwPlaneMenu().w2s('L', w.re, w.im); return [s[0], s[1]]; }); })()`);
const s0 = await state();
info.before = s0;
ok(`a frame parked at x = ${MID_U} draws one cut handle that takes presses, and no inert mark`, s0.handles.length === 1 && s0.marks === 0 && s0.hasHb, s0);
if (s0.handles.length === 1 && s0.hasHb) {
  const h = s0.handles[0], R = Math.hypot(h.wz.re, h.wz.im), a0 = Math.atan2(h.wz.im, h.wz.re);
  const [hs] = await scr([[h.wz.re, h.wz.im]]);
  info.handleAt = { h: [h.x, h.y], image: hs };
  ok(`the handle is at the frame's image of its point on the ray (within ${AT_PX} px)`, Math.hypot(hs[0] - h.x, hs[1] - h.y) <= AT_PX, info.handleAt);
  // (the arc from the handle's angle, just counter-clockwise of 180°, on round to TO_DEG)
  const a1 = TO_DEG * Math.PI / 180, from = a0 < 0 ? a0 + 2 * Math.PI : a0;
  const arc = Array.from({ length: ARC_N + 1 }, (_, i) => { const t = from + (a1 - from) * i / ARC_N; return [R * Math.cos(t), R * Math.sin(t)]; });
  const pts = await scr(arc), target = pts[pts.length - 1];
  // hovering the handle lights it on the parked frame as at rest: the overlay's pixels within HOVER_PX of the handle with
  // the pointer on it differ from those with the pointer HOVER_OFF px away (more than HOVER_MIN of them), and come back
  // when it leaves
  const patch = () => ev(`(() => { const o = document.getElementById('overlayL'), r = o.getBoundingClientRect(), d = o.width / r.width, R = ${HOVER_PX};
    return Array.from(o.getContext('2d').getImageData(Math.round((${h.x} - r.left - R) * d), Math.round((${h.y} - r.top - R) * d), Math.round(2 * R * d), Math.round(2 * R * d)).data); })()`);
  const pointAt = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); await settled({ max: 10000, until: '!__cmwSteps().anim' }); };
  const differ = (A, B) => A.filter((v, i) => v !== B[i]).length;
  await pointAt(h.x + HOVER_OFF, h.y + HOVER_OFF);
  const off = await patch();
  await pointAt(h.x, h.y);
  const on = await patch();
  await pointAt(h.x + HOVER_OFF, h.y + HOVER_OFF);
  const back = await patch();
  info.hover = { on: differ(off, on), back: differ(off, back) };
  ok(`hovering the handle lights it on the parked frame (more than ${HOVER_MIN} of the overlay's values near it change)`, info.hover.on > HOVER_MIN, info.hover);
  ok('the pointer leaving the handle puts its look back', info.hover.back === 0, info.hover);
  const before = await blocks(), v0 = s0.win;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: h.x, y: h.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: h.x, y: h.y, button: 'left', clickCount: 1 });
  for (const p of pts) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1], button: 'left', buttons: 1 }); await sleep(MOVE_GAP_MS); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target[0], y: target[1], button: 'left', clickCount: 1 });
  await settled({ max: 60000, until: `GLR.pendingLinks === 0 && !__cmwSteps().anim` });
  const s1 = await state();
  info.after = s1;
  const turned = ((s1.cut - TO_DEG) % 360 + 540) % 360 - 180;
  ok(`the drag turns the cut to ${TO_DEG}° (within ${TOL_DEG}°; the card keeps it in (−180°, 180°] on the next sheet)`, Math.abs(turned) <= TOL_DEG, { cut: s1.cut, k: s1.k });
  ok(`the frame is still parked at x = ${MID_U}, and the drag panned nothing`, Math.abs(s1.x - MID_U) < 1e-9 && s1.win.every((q, i) => Math.abs(q - v0[i]) < 1e-9), { x: s1.x, win: s1.win, was: v0 });
  const after = await blocks();
  await openParked(s1.cut, s1.k);
  const ref = await blocks();
  info.picture = { after: apart(after, ref), before: apart(before, ref) };
  ok(`the picture follows: the parked frame after the drag is the frame of a page opened with the cut there (at most ${SAME_FRAC * 100} % of the blocks apart)`, info.picture.after <= SAME_FRAC, info.picture);
  ok(`control: the frame before the drag differs from it (more than ${CTL_FRAC * 100} % of the blocks apart)`, info.picture.before > CTL_FRAC, info.picture);
}
return { pass: fails.length === 0, fails, info };

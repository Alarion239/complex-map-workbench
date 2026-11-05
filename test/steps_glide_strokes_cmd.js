// The steps view's glide draws every shape's stroke where its plane's picture moves: a curve and a region's border, of
// the z-plane and of a later plane, held still mid-glide at u = 0.25 and 0.75 are where the parked frame of the glide's
// first plane puts them, carried by the glide's homotopy H_u (the exact picture at u). Each stroke pixel of the parked
// frame (its shape's ink, where the frame with the strokes hidden differs) is moved by H_u to w; the moving frame has
// that shape's ink within STROKE_R px of w, where the same frame with the strokes hidden differs, for at least
// HIT_MIN of them.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const HIT_MIN = 0.9, MIN_SAMPLES = 40, STROKE_R = 3, INK_TOL = 40, LOOK_U = [0.25, 0.75];
await view(1200, 800);
const ST = {
  pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50,
  srcView: { cx: 0, cy: 0, s: 110 },
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [
    { id: 'l0', kind: 'line', a: [-2, 0.6], b: [2, 0.9], ci: 0, visible: true },
    { id: 'd0', kind: 'disc', c: [-0.3, -0.3], r: 0.5, ci: 1, visible: true },
    { id: 'c1', kind: 'circle', c: [0.4, 0.3], r: 0.6, ci: 2, visible: true, stage: 1 },
    { id: 'd1', kind: 'disc', c: [-0.5, 0.4], r: 0.3, ci: 3, visible: true, stage: 1 },
  ],
  targets: [],
};
await load('svstrokes' + Date.now(), ST);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane' }), 1`);
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (the left canvas's still pixels, with the shapes' strokes drawn or hidden, kept in __heldPx[tag])
const snap = async (tag, hide) => {
  await ev(`__cmwHideStrokes(${!!hide}), __cmwSteps({ bare: false }), 1`);
  await settled({ max: 20000 });
  ok(`the frame ${tag} settles`, await grab(tag), null);
  if (hide) { await ev('__cmwHideStrokes(false), 1'); await settled({ max: 20000 }); }
};
const at = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0` }); };
// a shape's strokes in the parked frame P (P0: strokes hidden) carried by the glide's H_u into the moving frame M (M0)
const carried = (id) => ev(`(() => {
  const g = __cmwSteps().glide, K = window.__heldPx, P = K.P, P0 = K.P0, M = K.M, M0 = K.M0, c = document.getElementById('canvasL');
  const W = c.width, H = c.height, dpr = W / g.w, v = g.view, hex = __cmwLook(${JSON.stringify(id)}, 'L').edge.replace('#', '');
  const ink = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const near = (D, i) => Math.max(Math.abs(D[i] - ink[0]), Math.abs(D[i + 1] - ink[1]), Math.abs(D[i + 2] - ink[2])) <= ${INK_TOL};
  const drawn = (D, D0, i) => Math.abs(D[i] - D0[i]) + Math.abs(D[i + 1] - D0[i + 1]) + Math.abs(D[i + 2] - D0[i + 2]) > 60;
  const R = Math.round(${STROKE_R} * dpr);
  let n = 0, hit = 0, off = 0;
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
    const i = 4 * (y * W + x);
    if (!near(P, i) || !drawn(P, P0, i)) continue;
    const z = { re: v.cx + ((x + 0.5) / dpr - g.w / 2) / v.s, im: v.cy - ((y + 0.5) / dpr - g.h / 2) / v.s }, w = g.Hb(z);
    const wx = Math.round(((w.re - v.cx) * v.s + g.w / 2) * dpr - 0.5), wy = Math.round((g.h / 2 - (w.im - v.cy) * v.s) * dpr - 0.5);
    if (!(wx >= R && wy >= R && wx < W - R && wy < H - R)) { off++; continue; }
    n++;
    let found = false;
    for (let dy = -R; dy <= R && !found; dy++) for (let dx = -R; dx <= R && !found; dx++) { const j = 4 * ((wy + dy) * W + wx + dx); if (near(M, j) && drawn(M, M0, j)) found = true; }
    if (found) hit++;
  }
  return { n, hit, off, frac: +(hit / Math.max(1, n)).toFixed(3), path: g.path, b: g.b, u: +g.u.toFixed(3) };
})()`);
// glide a -> a + 1: the shapes of planes up to a move with it
for (const [a, ids] of [[0, ['l0', 'd0']], [1, ['l0', 'd0', 'c1', 'd1']]]) {
  const r = info['glide ' + a] = {};
  await ev(`__cmwSteps({ go: ${a}, now: true }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === ${a} && GLR.pendingLinks === 0` });
  await snap('P'); await snap('P0', true);
  for (const u of LOOK_U) {
    await at(a + u);
    await snap('M'); await snap('M0', true);
    for (const id of ids) {
      const q = r[`${id} u=${u}`] = await carried(id);
      ok(`glide from plane ${a}: ${id}'s stroke at u = ${u} is its parked stroke carried by H_u (at least ${HIT_MIN * 100} % of ${MIN_SAMPLES}+ stroke pixels within ${STROKE_R} px)`, q.n >= MIN_SAMPLES && q.frac >= HIT_MIN, q);
    }
  }
}
return { pass: fails.length === 0, fails, info };

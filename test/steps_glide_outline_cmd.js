// The steps view's glide strokes the shapes of the plane it reaches, as that plane's parked frame strokes them (the
// shape's colour over its casing), from the frame where that plane is the nearer one: a region's outline, a circle and a
// segment. On the glide a -> b = 0 -> 1 (step 1 a Möbius map h), held still on the rail at u in HOLD_U and parked at
// U_END, each stroke pixel of plane 1's parked frame (its shape's ink, within INK_TOL, where the frame with the strokes
// hidden differs) at w is carried to the exact place of that point at u, H_u(h^-1(w)) (H_u: the glide's homotopy,
// __cmwSteps().glide.Hb), and the frame at u has that shape's ink within RING_R CSS px of it, where the same frame with
// the strokes hidden differs, for at least HIT_MIN of at least MIN_RING of them. And the strokes stack in the shapes'
// order, as at rest: where the line l0 of plane 0, listed after the disc c1 of plane 1, crosses c1's outline (the pixels
// of l0's ink in plane 1's parked frame with c1's ink within CROSS_R px), the frame at U_END has l0's ink at the same
// pixel (within 1 px) for at least STACK_MIN of at least MIN_CROSS of them. Inside regions and Everywhere (SCOPES).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const HIT_MIN = 0.9, MIN_RING = 100, RING_R = 3, INK_TOL = 24, HOLD_U = [0.6, 0.75], U_END = 0.998, SCOPES = ['in', 'all'];
const CROSS_R = 4, STACK_MIN = 0.95, MIN_CROSS = 40;
await view(1200, 800);
// (step 1, h(z) = (a z + b) / (c z + d), the Cayley map: its coefficients as [re, im], for the inverse the check carries
// plane 1's outline back with)
const H1 = { a: [1, 0], b: [0, -1], c: [1, 0], d: [0, 1] };
const ST = {
  pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50,
  srcView: { cx: 0, cy: 0, s: 110 },
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [
    { id: 'c1', kind: 'disc', c: [0.4, 0.3], r: 0.6, ci: 2, visible: true, stage: 1 },
    { id: 'd1', kind: 'disc', c: [-0.5, 0.4], r: 0.3, ci: 3, visible: true, stage: 1 },
    { id: 'k1', kind: 'circle', c: [0.3, -0.6], r: 0.5, ci: 4, visible: true, stage: 1 },
    { id: 's1', kind: 'segment', a: [-1.5, -1], b: [1.2, -1.4], ci: 5, visible: true, stage: 1 },
    // (the real axis: on plane 1, h takes it to the unit circle, which crosses c1's outline)
    { id: 'l0', kind: 'line', a: [-2, 0], b: [2, 0], ci: 0, visible: true },
  ],
  targets: [],
};
await load('svoutline' + Date.now(), ST);
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
ok('the page shows the steps view', await isSteps(), null);
const { hold, grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (the left canvas's still pixels, with the shapes' strokes drawn or hidden, kept in __heldPx[tag])
const snap = async (tag, hide) => {
  await ev(`__cmwHideStrokes(${!!hide}), __cmwSteps({ bare: false }), 1`);
  await settled({ max: 20000 });
  ok(`the frame ${tag} settles`, await grab(tag), null);
  if (hide) { await ev('__cmwHideStrokes(false), 1'); await settled({ max: 20000 }); }
};
const park = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0 && !__cmwSteps().hold` }); };
// plane 1's outline of shape id (P1, P10: strokes hidden) carried to the frame at u (M, M0)
const carried = (id) => ev(`(() => {
  const g = __cmwSteps().glide, K = window.__heldPx, P = K.P1, P0 = K.P10, M = K.M, M0 = K.M0, c = document.getElementById('canvasL');
  const W = c.width, H = c.height, dpr = W / g.w, v = g.view, hex = __cmwLook(${JSON.stringify(id)}, 'L').edge.replace('#', '');
  const ink = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const near = (D, i) => Math.max(Math.abs(D[i] - ink[0]), Math.abs(D[i + 1] - ink[1]), Math.abs(D[i + 2] - ink[2])) <= ${INK_TOL};
  const drawn = (D, D0, i) => Math.abs(D[i] - D0[i]) + Math.abs(D[i + 1] - D0[i + 1]) + Math.abs(D[i + 2] - D0[i + 2]) > 60;
  // (h^-1(w) = (d w - b) / (a - c w))
  const { a, b, c: cc, d } = ${JSON.stringify(H1)};
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const inv = (w) => {
    const n = mul(d, w), m = mul(cc, w), num = [n[0] - b[0], n[1] - b[1]], den = [a[0] - m[0], a[1] - m[1]], q = den[0] * den[0] + den[1] * den[1];
    return { re: (num[0] * den[0] + num[1] * den[1]) / q, im: (num[1] * den[0] - num[0] * den[1]) / q };
  };
  const R = Math.round(${RING_R} * dpr);
  let n = 0, hit = 0, off = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = 4 * (y * W + x);
    if (!near(P, i) || !drawn(P, P0, i)) continue;
    const z = inv([v.cx + ((x + 0.5) / dpr - g.w / 2) / v.s, v.cy - ((y + 0.5) / dpr - g.h / 2) / v.s]), w = g.Hb(z);
    const wx = Math.round(((w.re - v.cx) * v.s + g.w / 2) * dpr - 0.5), wy = Math.round((g.h / 2 - (w.im - v.cy) * v.s) * dpr - 0.5);
    if (!(wx >= R && wy >= R && wx < W - R && wy < H - R)) { off++; continue; }
    n++;
    let found = false;
    for (let dy = -R; dy <= R && !found; dy++) for (let dx = -R; dx <= R && !found; dx++) { const j = 4 * ((wy + dy) * W + wx + dx); if (near(M, j) && drawn(M, M0, j)) found = true; }
    if (found) hit++;
  }
  return { n, hit, off, frac: +(hit / Math.max(1, n)).toFixed(3), path: g.path, u: +g.u.toFixed(3) };
})()`);
const check = async (r, where) => {
  for (const id of ST.shapes.filter((x) => x.stage === 1).map((x) => x.id)) {
    const q = r[`${id} ${where}`] = await carried(id);
    ok(`${id}'s stroke ${where} is plane 1's parked stroke carried there (at least ${HIT_MIN * 100} % of ${MIN_RING}+ pixels, its ink within ${RING_R} px)`, q.n >= MIN_RING && q.frac >= HIT_MIN, q);
  }
};
// where l0 crosses c1's outline in plane 1's parked frame P1 (l0's ink with c1's within CROSS_R px): how many of those
// pixels have l0's ink within 1 px in the frame M (the line moves by a hair from U_END to the plane)
const stacked = () => ev(`(() => {
  const K = window.__heldPx, P = K.P1, M = K.M, c = document.getElementById('canvasL'), W = c.width, H = c.height, dpr = W / __cmwSteps().glide.w;
  const inkOf = (id) => { const h = __cmwLook(id, 'L').edge.replace('#', ''); return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)); };
  const top = inkOf('l0'), under = inkOf('c1');
  const near = (D, i, ink) => Math.max(Math.abs(D[i] - ink[0]), Math.abs(D[i + 1] - ink[1]), Math.abs(D[i + 2] - ink[2])) <= ${INK_TOL};
  const within = (D, x, y, r, ink) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (near(D, 4 * ((y + dy) * W + x + dx), ink)) return true; return false; };
  const R = Math.round(${CROSS_R} * dpr);
  let n = 0, kept = 0;
  for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
    if (!near(P, 4 * (y * W + x), top) || !within(P, x, y, R, under)) continue;
    n++;
    if (within(M, x, y, 1, top)) kept++;
  }
  return { n, kept, frac: +(kept / Math.max(1, n)).toFixed(3) };
})()`);
for (const scope of SCOPES) {
  const r = info[scope] = {};
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${scope}', surf: 'plane' }), 1`);
  await ev(`__cmwSteps({ go: 1, now: true }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 1 && GLR.pendingLinks === 0` });
  await snap('P1'); await snap('P10', true);
  await park(0);
  for (const u of HOLD_U) {
    r[`hold ${u}`] = await hold(u);
    await snap('M'); await snap('M0', true);
    await check(r, `held at u = ${u}`);
    await ev('window.__svScrubUp(), 1');
    await park(0);
  }
  await park(U_END);
  await snap('M'); await snap('M0', true);
  await check(r, `parked at u = ${U_END}`);
  const q = r.stack = await stacked();
  ok(`at u = ${U_END} the strokes stack as at rest: l0 over c1's outline where they cross (at least ${STACK_MIN * 100} % of ${MIN_CROSS}+ pixels)`, q.n >= MIN_CROSS && q.frac >= STACK_MIN, q);
}
return { pass: fails.length === 0, fails, info };

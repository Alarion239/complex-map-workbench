// The steps view's glide strokes the shapes of the plane it reaches, as that plane's parked frame strokes them (the
// shape's colour over its casing): a region's outline and each kind of curve the inverse pass strokes (a circle, a
// segment, a ray, an arc, a polyline, a constructed circle). On the glide a -> b = 0 -> 1 (step 1 a Möbius map h), held
// still on the rail at u in HOLD_U and parked at U_END, each stroke pixel of plane 1's parked frame (its shape's ink,
// within INK_TOL, where the frame with the strokes hidden differs) at w is carried to the exact place of that point at
// u, H_u(h^-1(w)) (H_u: the glide's homotopy, __cmwSteps().glide.Hb), and the frame at u has that shape's stroke within
// RING_R CSS px of it, for at least HIT_MIN of at least MIN_RING of them: a pixel that differs from the same frame with
// the strokes hidden and, as the stroke comes in over the glide at opacity u, lies TOWARD x u of a channel's range
// nearer the shape's ink than that frame's (from FULL_U on, the ink itself, within INK_TOL). Everywhere, before FULL_U,
// the drawn pixel alone: over the colour, a stroke at opacity u with its light casing can land farther from its ink
// than a background already near that ink. And the strokes stack in the shapes' order, as at rest: where the line l0 of
// plane 0, listed after the disc c1 of plane 1, crosses c1's outline (the pixels of l0's ink in plane 1's parked frame
// with c1's ink within CROSS_R px), the frame at U_END has l0's ink at the same pixel (within 1 px) for at least
// STACK_MIN of at least MIN_CROSS of them. And the stroke comes in at opacity u (strokeShare), held at SHARE_U and HOLD_U:
// where plane 1's stroke is carried, the drawn pixel is the frame with the strokes hidden plus a share s of the ink and a
// share of the casing, with the median s u within SHARE_TOL, and weaker at the first HOLD_U than at the last. So a stroke
// drawn whole from the midpoint, or not at all before it, or in another colour, fails in both scopes. A region's stroke
// comes in over its pulled-back layer, whose band (the same ink) goes out as the stroke comes in: there the median s is
// u + B (1 - u) (1 - u a), B the band's own share read from the same frame with Outlines off (at least LAYER_MIN at
// SHARE_U) and a the casing's alpha (the casing at u a covers the band before the ink at u lands).
// Inside regions and Everywhere (SCOPES); each failure names its scope.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const HIT_MIN = 0.9, MIN_RING = 100, RING_R = 3, INK_TOL = 24, HOLD_U = [0.6, 0.75], U_END = 0.998, SCOPES = ['in', 'all'];
const CROSS_R = 4, STACK_MIN = 0.95, MIN_CROSS = 40, FULL_U = 0.95, TOWARD = 0.05;
// the stroke's opacity (strokeShare): the fit's tolerance (of 255) and slack in s and t; held at SHARE_U too
// (SHARE_TOL: the median share's distance from u, which keeps the shares at HOLD_U apart; SHARE_FIT_MIN: the carried pixels with a fit)
const FIT_TOL = 14, SHARE_EPS = 0.05, SHARE_U = 0.3, SHARE_TOL = 0.06, SHARE_FIT_MIN = 0.9;
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
    { id: 'r1', kind: 'ray', a: [-1.8, 1.2], b: [-1.2, 1.6], ci: 6, visible: true, stage: 1 },
    { id: 'a1', kind: 'arc', a: [-0.8, 1.6], m: [-0.3, 2], b: [0.2, 1.6], ci: 7, visible: true, stage: 1 },
    { id: 'p1', kind: 'curve', pts: [[-3, -1], [-2.6, -0.4], [-2.2, -1], [-1.8, -0.4]], ci: 1, visible: true, stage: 1 },
    // (a constructed circle, through three hidden points: its record is the circle's equation, not its centre and radius)
    { id: 'q1', kind: 'point', p: [2, -1], ci: 0, visible: false, stage: 1 },
    { id: 'q2', kind: 'point', p: [2.8, -1.4], ci: 0, visible: false, stage: 1 },
    { id: 'q3', kind: 'point', p: [2.4, -2], ci: 0, visible: false, stage: 1 },
    { id: 'g1', kind: 'circle', c: [0, 0], r: 1, color: '#C0392B', visible: true, stage: 1, def: { op: 'circle3', args: [{ s: 'q1' }, { s: 'q2' }, { s: 'q3' }], fill: 'none' } },
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
  ok(`[${SCOPE_NOW}] the frame ${tag} settles`, await grab(tag), null);
  if (hide) { await ev('__cmwHideStrokes(false), 1'); await settled({ max: 20000 }); }
};
const park = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0 && !__cmwSteps().hold` }); };
// In the page, for shape id: the held frames (P1, P10: plane 1 parked, its strokes hidden; M, M0: the frame at u, its
// strokes hidden), the shape's ink and casing, and carry(each): each stroke pixel of plane 1's parked frame (its ink
// within INK_TOL, where P10 differs) carried to its place in the frame at u, H_u(h^-1(w)), and each(wx, wy) called there
// when that place is RING_R px or more inside the frame -> how many were carried off it. body measures and returns
// (frame: the kept frame read as M, 'M' by default; 'ML', the same frame with Outlines off, reads the pulled-back layer's
// band alone)
const onCarried = (id, body, frame = 'M') => ev(`(() => {
  const g = __cmwSteps().glide, K = window.__heldPx, P = K.P1, P0 = K.P10, M = K[${JSON.stringify(frame)}], M0 = K.M0, c = document.getElementById('canvasL');
  const W = c.width, H = c.height, dpr = W / g.w, v = g.view, look = __cmwLook(${JSON.stringify(id)}, 'L');
  const rgb = (h) => [0, 2, 4].map((k) => parseInt(h.replace('#', '').slice(k, k + 2), 16));
  const ink = rgb(look.edge), halo = rgb(look.halo);
  const near = (D, i) => Math.max(Math.abs(D[i] - ink[0]), Math.abs(D[i + 1] - ink[1]), Math.abs(D[i + 2] - ink[2])) <= ${INK_TOL};
  const drawn = (D, D0, i, k = 1) => Math.abs(D[i] - D0[i]) + Math.abs(D[i + 1] - D0[i + 1]) + Math.abs(D[i + 2] - D0[i + 2]) > 60 * k;
  // (h^-1(w) = (d w - b) / (a - c w))
  const { a, b, c: cc, d } = ${JSON.stringify(H1)};
  const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
  const inv = (w) => {
    const n = mul(d, w), m = mul(cc, w), num = [n[0] - b[0], n[1] - b[1]], den = [a[0] - m[0], a[1] - m[1]], q = den[0] * den[0] + den[1] * den[1];
    return { re: (num[0] * den[0] + num[1] * den[1]) / q, im: (num[1] * den[0] - num[0] * den[1]) / q };
  };
  const R = Math.round(${RING_R} * dpr);
  const carry = (each) => {
    let off = 0;
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = 4 * (y * W + x);
      if (!near(P, i) || !drawn(P, P0, i)) continue;
      const w = g.Hb(inv([v.cx + ((x + 0.5) / dpr - g.w / 2) / v.s, v.cy - ((y + 0.5) / dpr - g.h / 2) / v.s]));
      const wx = Math.round(((w.re - v.cx) * v.s + g.w / 2) * dpr - 0.5), wy = Math.round((g.h / 2 - (w.im - v.cy) * v.s) * dpr - 0.5);
      if (wx >= R && wy >= R && wx < W - R && wy < H - R) each(wx, wy); else off++;
    }
    return off;
  };
  ${body}
})()`);
// plane 1's outline of shape id carried to the frame at u: within RING_R px of each carried pixel, a pixel drawn there
// (differing from M0) that, as the stroke comes in over the glide at opacity u, has moved towards the shape's ink by
// TOWARD of a channel's range times u from M0 (Everywhere, before FULL_U, the drawn pixel alone); from FULL_U, the ink
const carried = (id, scope) => onCarried(id, `
  const fromInk = (D, i) => Math.max(Math.abs(D[i] - ink[0]), Math.abs(D[i + 1] - ink[1]), Math.abs(D[i + 2] - ink[2]));
  const inkAt = (i, k) => (k >= ${FULL_U} ? near(M, i) : ${JSON.stringify(scope)} === 'all' || fromInk(M, i) + ${TOWARD} * 255 * k <= fromInk(M0, i));
  let n = 0, hit = 0;
  const off = carry((wx, wy) => {
    n++;
    let found = false;
    for (let dy = -R; dy <= R && !found; dy++) for (let dx = -R; dx <= R && !found; dx++) { const j = 4 * ((wy + dy) * W + wx + dx); if (inkAt(j, g.u) && drawn(M, M0, j, g.u)) found = true; }
    if (found) hit++;
  });
  return { n, hit, off, frac: +(hit / Math.max(1, n)).toFixed(3), path: g.path, u: +g.u.toFixed(3) };`);
// The stroke's opacity at the carried place, for a shape of plane 1: within RING_R px of each carried pixel, the pixel
// whose drawn colour M fits M0 + s (ink - M0) + t (casing - M0) (the ink over its casing over the frame, a shape's stroke
// at rest, each at a share of its opacity) within FIT_TOL of a channel, with the largest s: the ink's share there, s = u
// at the stroke's middle when the stroke comes in at opacity u. A pixel with no such fit (another colour drawn there, as a
// magenta stroke would be) has share 0. -> {n, fit, med}: the carried pixels, those with a fit, the median share of all
// (frame: as onCarried's)
const strokeShare = (id, frame = 'M') => onCarried(id, `
  // (least squares for s and t in M - M0 = s a + t b, a = ink - M0, b = casing - M0; null when the fit misses by more than FIT_TOL)
  const fit = (i) => {
    const h = [M0[i], M0[i + 1], M0[i + 2]], dm = [0, 1, 2].map((k) => M[i + k] - h[k]), ai = ink.map((x, k) => x - h[k]), bi = halo.map((x, k) => x - h[k]);
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2], aa = dot(ai, ai), bb = dot(bi, bi), ab = dot(ai, bi), det = aa * bb - ab * ab;
    let s, t;
    if (Math.abs(det) < 1e-6 * aa * Math.max(1, bb)) { s = dot(dm, ai) / aa; t = 0; } else { s = (dot(dm, ai) * bb - dot(dm, bi) * ab) / det; t = (dot(dm, bi) * aa - dot(dm, ai) * ab) / det; }
    const miss = Math.max(...[0, 1, 2].map((k) => Math.abs(dm[k] - s * ai[k] - t * bi[k])));
    return miss <= ${FIT_TOL} && s >= -${SHARE_EPS} && t >= -${SHARE_EPS} && s + t <= 1 + ${SHARE_EPS} ? s : null;
  };
  const shares = [];
  let nfit = 0;
  carry((wx, wy) => {
    let best = null;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const s = fit(4 * ((wy + dy) * W + wx + dx)); if (s != null && (best == null || s > best)) best = s; }
    if (best != null) nfit++;
    shares.push(best == null ? 0 : best);
  });
  shares.sort((p, q) => p - q);
  return { n: shares.length, fit: nfit, med: shares.length ? +shares[shares.length >> 1].toFixed(3) : null };`, frame);
// the shapes of plane 1 the pass strokes; of them the regions, which a frame before plane 1 also draws pulled back, a
// layer over the colour (its band in the same ink, going out at 1 - u as the stroke comes in)
const STROKED = ST.shapes.filter((x) => x.stage === 1 && x.kind !== 'point').map((x) => x.id);
const LAYERED = new Set(ST.shapes.filter((x) => x.stage === 1 && x.kind === 'disc').map((x) => x.id));
// (the least share of the band alone, at SHARE_U, that shows the layer is drawn and measured)
const LAYER_MIN = 0.2;
const check = async (r, where, scope) => {
  for (const id of STROKED) {
    const q = r[`${id} ${where}`] = await carried(id, scope);
    ok(`[${scope}] ${id}'s stroke ${where} is plane 1's parked stroke carried there (at least ${HIT_MIN * 100} % of ${MIN_RING}+ pixels, its ink within ${RING_R} px)`, q.n >= MIN_RING && q.frac >= HIT_MIN, q);
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
let SCOPE_NOW = '';
for (const scope of SCOPES) {
  SCOPE_NOW = scope;
  const r = info[scope] = {};
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${scope}', surf: 'plane' }), 1`);
  await ev(`__cmwSteps({ go: 1, now: true }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 1 && GLR.pendingLinks === 0` });
  await snap('P1'); await snap('P10', true);
  await park(0);
  for (const u of [SHARE_U, ...HOLD_U]) {
    r[`hold ${u}`] = await hold(u);
    await snap('M'); await snap('M0', true);
    // (ML: the same frame with Outlines off, the strokes left out and the pulled-back layer kept)
    await ev(`__cmwSet('outline', false), 1`); await snap('ML'); await ev(`__cmwSet('outline', true), 1`); await settled({ max: 20000 });
    if (u !== SHARE_U) await check(r, `held at u = ${u}`, scope);
    for (const id of STROKED) {
      const q = r[`share ${id} ${u}`] = await strokeShare(id);
      if (LAYERED.has(id)) {
        // (a region: its stroke at opacity u, the casing at u of its own alpha a under the ink, over the pulled-back
        // layer's band, whose share B is read with Outlines off; they composite to u + B (1 - u) (1 - u a))
        const L = r[`band ${id} ${u}`] = await strokeShare(id, 'ML'), B = L.med ?? 0, ca = await ev(`__cmwLook(${JSON.stringify(id)}, 'L').haloA`);
        const want = u + B * (1 - u) * (1 - u * ca);
        if (u === SHARE_U) ok(`[${scope}] ${id}'s pulled-back layer is drawn under the incoming stroke at u = ${u}: its band's median share is at least ${LAYER_MIN}`, B >= LAYER_MIN, L);
        ok(`[${scope}] ${id}'s stroke held at u = ${u} comes in at opacity u over the pulled-back layer: the ink's median share where plane 1's stroke is carried is u + B (1 - u) (1 - u a) within ${SHARE_TOL}, B the band's share with Outlines off and a the casing's alpha (a stroke drawn whole, not drawn, or in another colour is not), with a fit at ${SHARE_FIT_MIN * 100} % of ${MIN_RING}+ pixels`, q.n >= MIN_RING && q.fit >= SHARE_FIT_MIN * q.n && q.med != null && Math.abs(q.med - want) <= SHARE_TOL, Object.assign({ want: +want.toFixed(3), B, ca }, q));
        continue;
      }
      ok(`[${scope}] ${id}'s stroke held at u = ${u} comes in at opacity u: the ink's median share where plane 1's stroke is carried is u within ${SHARE_TOL} (a stroke drawn whole, not drawn, or in another colour is not), with a fit at ${SHARE_FIT_MIN * 100} % of ${MIN_RING}+ pixels`, q.n >= MIN_RING && q.fit >= SHARE_FIT_MIN * q.n && Math.abs(q.med - u) <= SHARE_TOL, q);
    }
    await ev('window.__svScrubUp(), 1');
    await park(0);
  }
  // (the opacity grows with u: weaker at the first HOLD_U than at the last, each shape)
  for (const id of STROKED) {
    const lo = r[`share ${id} ${HOLD_U[0]}`], hi = r[`share ${id} ${HOLD_U[HOLD_U.length - 1]}`];
    ok(`[${scope}] ${id}'s stroke is weaker at u = ${HOLD_U[0]} than at u = ${HOLD_U[HOLD_U.length - 1]} (the ink's median share)`, lo.med != null && hi.med != null && lo.med < hi.med, { lo, hi });
  }
  await park(U_END);
  await snap('M'); await snap('M0', true);
  await check(r, `parked at u = ${U_END}`, scope);
  const q = r.stack = await stacked();
  ok(`[${scope}] at u = ${U_END} the strokes stack as at rest: l0 over c1's outline where they cross (at least ${STACK_MIN * 100} % of ${MIN_CROSS}+ pixels)`, q.n >= MIN_CROSS && q.frac >= STACK_MIN, q);
}
return { pass: fails.length === 0, fails, info };

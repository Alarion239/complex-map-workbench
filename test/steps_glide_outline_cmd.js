// The steps view's glide strokes the shapes of the plane it reaches, as that plane's parked frame strokes them (the
// shape's colour over its casing): a region's outline and each kind of curve the inverse pass strokes (a circle, a
// segment, a ray, an arc, a polyline, a constructed circle). On the glide a -> b = 0 -> 1 (step 1 a Möbius map h), held
// still on the rail at u in HOLD_U and parked at U_END, each stroke pixel of plane 1's parked frame (its shape's ink at
// the stroke's alpha, a grid's 0.8, over its casing over the frame with the strokes hidden, within INK_TOL, where that
// frame differs) at w is carried to the exact place of that point at
// u, H_u(h^-1(w)) (H_u: the glide's homotopy, __cmwSteps().glide.Hb), and the frame at u has that shape's stroke within
// RING_R CSS px of it, for at least HIT_MIN of at least MIN_RING of them: a pixel that differs from the same frame with
// the strokes hidden and, as the stroke comes in over the glide at opacity u, lies TOWARD x u of a channel's range
// times the stroke's alpha nearer the shape's ink than that frame's (from FULL_U on, the ink at its alpha, within INK_TOL). Everywhere, before FULL_U,
// the drawn pixel alone: over the colour, a stroke at opacity u with its light casing can land farther from its ink
// than a background already near that ink. And the strokes stack in the shapes' order, as at rest: where the line l0 of
// plane 0, listed after the disc c1 of plane 1, crosses c1's outline (the pixels of l0's ink in plane 1's parked frame
// with c1's ink within CROSS_R px), the frame at U_END has l0's ink at the same pixel (within 1 px) for at least
// STACK_MIN of at least MIN_CROSS of them. And the stroke comes in at opacity u (strokeShare), held at SHARE_U and HOLD_U:
// where plane 1's stroke is carried, the drawn pixel is the frame with the strokes hidden plus a share s of the ink and a
// share of the casing, with the median s u times the stroke's alpha within SHARE_TOL, and weaker at the first HOLD_U than at the last. So a stroke
// drawn whole from the midpoint, or not at all before it, or in another colour, fails in both scopes. Inside regions and
// Everywhere (SCOPES); each failure names its scope.
// Two scenes, each failure naming its own: 'kinds' (the shapes above, step 2 a translation) and 'traced' (step 2 the
// Douady–Hubbard map, plane 1 its parameter plane): the curves the pass strokes by their polylines at rest, a freehand
// curve of more than 64 vertices, a formula curve, an external ray of M and an equipotential, and the two grids, by
// their records, and a disc, so that Inside regions draws by the inverse pass; with no crossing to stack, so no
// stacking check. At device pixel ratio 2: a grid's 1 px line at alpha 0.8 inks no whole pixel at 1. And each curve
// stroked by its polylines has at most GLR.INV_CURVE_MAX vertices, simplified at a tolerance of at most TRACE_PX px.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const HIT_MIN = 0.9, MIN_RING = 100, RING_R = 3, INK_TOL = 24, HOLD_U = [0.6, 0.75], U_END = 0.998, SCOPES = ['in', 'all'];
const CROSS_R = 4, STACK_MIN = 0.95, MIN_CROSS = 40, FULL_U = 0.95, TOWARD = 0.05;
// (the curves stroked by their polylines at rest, and how far those polylines may be from the samples: TRACE_PX CSS px)
const TRACED = ['curve', 'fcurve', 'dhray', 'dheq'], TRACE_PX = 0.5;
// the stroke's opacity (strokeShare): the fit's tolerance (of 255) and slack in s and t; held at SHARE_U too
// (SHARE_TOL: the median share's distance from u, which keeps the shares at HOLD_U apart; SHARE_FIT_MIN: the carried pixels with a fit)
const FIT_TOL = 14, SHARE_EPS = 0.05, SHARE_U = 0.3, SHARE_TOL = 0.06, SHARE_FIT_MIN = 0.9;
// (step 1, h(z) = (a z + b) / (c z + d), the Cayley map: its coefficients as [re, im], for the inverse the check carries
// plane 1's outline back with)
const H1 = { a: [1, 0], b: [0, -1], c: [1, 0], d: [0, 1] };
const BASE = { pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50, srcView: { cx: 0, cy: 0, s: 110 }, targets: [] };
const CAYLEY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true };
// (the freehand curve of 'traced': 150 vertices, a wave)
const WAVE = Array.from({ length: 150 }, (_, i) => [-2.6 + i * 0.03, -1.6 + 0.25 * Math.sin(i * 0.15)]);
const SCENES = [{ tag: 'kinds', stack: true, st: Object.assign({}, BASE, {
  steps: [CAYLEY, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
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
}) }, { tag: 'traced', stack: false, dpr: 2, st: Object.assign({}, BASE, {
  steps: [CAYLEY, { type: 'dh', params: { N: 64 }, on: true }],
  shapes: [
    { id: 'f1', kind: 'curve', pts: WAVE, ci: 1, visible: true, stage: 1 },
    { id: 'e1', kind: 'fcurve', expr: '|z-1|+|z+1|=3.4', ci: 2, visible: true, stage: 1 },
    { id: 'g1', kind: 'cgrid', a: [1, 0.4], b: [2.2, 1.6], n: 4, ci: 3, visible: true, stage: 1 },
    { id: 'g2', kind: 'pgrid', c: [-1.9, 1.2], r: 0.5, nc: 2, nr: 6, ci: 4, visible: true, stage: 1 },
    { id: 'h1', kind: 'dhray', theta: '1/3', c: null, ci: 5, visible: true, stage: 1 },
    { id: 'h2', kind: 'dheq', r: 1.5, c: null, ci: 6, visible: true, stage: 1 },
    // (a region, so that Inside regions draws the frame by the inverse pass)
    { id: 'd2', kind: 'disc', c: [2.4, -0.6], r: 0.4, ci: 7, visible: true, stage: 1 },
  ],
}) }];
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
const onCarried = (id, body) => ev(`(() => {
  const g = __cmwSteps().glide, K = window.__heldPx, P = K.P1, P0 = K.P10, M = K.M, M0 = K.M0, c = document.getElementById('canvasL');
  const W = c.width, H = c.height, dpr = W / g.w, v = g.view, look = __cmwLook(${JSON.stringify(id)}, 'L');
  const rgb = (h) => [0, 2, 4].map((k) => parseInt(h.replace('#', '').slice(k, k + 2), 16));
  const ink = rgb(look.edge), halo = rgb(look.halo), sk = __cmwStroke(${JSON.stringify(id)}), A = sk.alpha, CA = sk.casingAlpha || 0;
  // (D at i is the ink at the stroke's alpha A over its casing at its own alpha CA over D0, the frame with the strokes
  // hidden, within INK_TOL)
  const near = (D, D0, i) => [0, 1, 2].every((k) => { const c = D0[i + k] + CA * (halo[k] - D0[i + k]); return Math.abs(D[i + k] - c - A * (ink[k] - c)) <= ${INK_TOL}; });
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
      if (!near(P, P0, i) || !drawn(P, P0, i)) continue;
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
  const inkAt = (i, k) => (k >= ${FULL_U} ? near(M, M0, i) : ${JSON.stringify(scope)} === 'all' || fromInk(M, i) + ${TOWARD} * 255 * A * k <= fromInk(M0, i));
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
const strokeShare = (id) => onCarried(id, `
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
  return { n: shares.length, fit: nfit, med: shares.length ? +shares[shares.length >> 1].toFixed(3) : null, alpha: A };`);
// the shapes of plane 1 the pass strokes (the scene's)
let STROKED = [];
const check = async (r, where, scope) => {
  for (const id of STROKED) {
    const q = r[`${id} ${where}`] = await carried(id, scope);
    ok(`[${SCOPE_NOW}] ${id}'s stroke ${where} is plane 1's parked stroke carried there (at least ${HIT_MIN * 100} % of ${MIN_RING}+ pixels, its ink within ${RING_R} px)`, q.n >= MIN_RING && q.frac >= HIT_MIN, q);
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
for (const sc of SCENES) {
  // (each scene sets its own device pixel ratio: sc.dpr, else the run's, view()'s)
  if (sc.dpr) await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: sc.dpr, mobile: false });
  else await view(1200, 800);
  await load(`svoutline-${sc.tag}-${Date.now()}`, sc.st);
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
  ok(`[${sc.tag}] the page shows the steps view`, await isSteps(), null);
  STROKED = sc.st.shapes.filter((x) => x.stage === 1 && x.kind !== 'point').map((x) => x.id);
  // (a traced curve's polylines, as the pass strokes them, __cmwTrace: within the pass's GLR.INV_CURVE_MAX vertices,
  // at the base tolerance, which is at most TRACE_PX CSS px at plane 1's camera, and every sample at rest within that
  // tolerance of them)
  for (const id of sc.st.shapes.filter((x) => x.stage === 1 && TRACED.includes(x.kind)).map((x) => x.id)) {
    const q = info[`trace ${id}`] = await ev(`(() => {
      const T = __cmwTrace(${JSON.stringify(id)}), s = __cmwLook(${JSON.stringify(id)}, 'L').view.s;
      if (!T) return null;
      const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, u = L > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0; return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy); };
      let dev = 0;
      T.samples.forEach((p, k) => { const l = T.lines[k]; for (let i = 0; i + 1 < p.length; i += 2) { let m = Infinity; for (let j = 1; j < l.length; j++) m = Math.min(m, segD(p[i], p[i + 1], l[j - 1], l[j])); if (l.length === 1) m = Math.hypot(p[i] - l[0][0], p[i + 1] - l[0][1]); dev = Math.max(dev, m); } });
      return { n: T.n, max: GLR.INV_CURVE_MAX, tol: T.tol, base: T.base, px: +(T.base * s).toFixed(3), dev, samples: T.samples.reduce((k, p) => k + p.length / 2, 0) };
    })()`);
    ok(`[${sc.tag}] ${id}'s polylines for the pass: at most GLR.INV_CURVE_MAX vertices, at the base tolerance (at most ${TRACE_PX} px at rest), every sample within it`, !!q && q.n <= q.max && q.tol === q.base && q.px <= TRACE_PX && q.dev <= q.tol * (1 + 1e-9), q);
  }
  for (const scope of SCOPES) {
    SCOPE_NOW = `${sc.tag}, ${scope}`;
    const r = info[SCOPE_NOW] = {};
    await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${scope}', surf: 'plane' }), 1`);
    await ev(`__cmwSteps({ go: 1, now: true }), 1`);
    await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 1 && GLR.pendingLinks === 0` });
    await snap('P1'); await snap('P10', true);
    await park(0);
    for (const u of [SHARE_U, ...HOLD_U]) {
      r[`hold ${u}`] = await hold(u);
      await snap('M'); await snap('M0', true);
      if (u !== SHARE_U) await check(r, `held at u = ${u}`, scope);
      for (const id of STROKED) {
        const q = r[`share ${id} ${u}`] = await strokeShare(id);
        ok(`[${SCOPE_NOW}] ${id}'s stroke held at u = ${u} comes in at opacity u: the ink's median share where plane 1's stroke is carried is u (times the stroke's alpha) within ${SHARE_TOL} (a stroke drawn whole, not drawn, or in another colour is not), with a fit at ${SHARE_FIT_MIN * 100} % of ${MIN_RING}+ pixels`, q.n >= MIN_RING && q.fit >= SHARE_FIT_MIN * q.n && Math.abs(q.med - q.alpha * u) <= SHARE_TOL, q);
      }
      await ev('window.__svScrubUp(), 1');
      await park(0);
    }
    // (the opacity grows with u: weaker at the first HOLD_U than at the last, each shape)
    for (const id of STROKED) {
      const lo = r[`share ${id} ${HOLD_U[0]}`], hi = r[`share ${id} ${HOLD_U[HOLD_U.length - 1]}`];
      ok(`[${SCOPE_NOW}] ${id}'s stroke is weaker at u = ${HOLD_U[0]} than at u = ${HOLD_U[HOLD_U.length - 1]} (the ink's median share)`, lo.med != null && hi.med != null && lo.med < hi.med, { lo, hi });
    }
    await park(U_END);
    await snap('M'); await snap('M0', true);
    await check(r, `parked at u = ${U_END}`, scope);
    if (!sc.stack) continue;
    const q = r.stack = await stacked();
    ok(`[${SCOPE_NOW}] at u = ${U_END} the strokes stack as at rest: l0 over c1's outline where they cross (at least ${STACK_MIN * 100} % of ${MIN_CROSS}+ pixels)`, q.n >= MIN_CROSS && q.frac >= STACK_MIN, q);
  }
}
return { pass: fails.length === 0, fails, info };

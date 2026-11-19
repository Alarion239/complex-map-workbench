// Inside regions, the steps view's glide draws a region of a later plane where the exact picture at u puts it (#861,
// #732): the parked frame of the glide's first plane draws the region pulled back onto that plane (its points z with
// F_{0->k}(z) in it, coloured from z, at the pullbacks' opacity). Chain of two Möbius steps, a disc on each of planes 1
// and 2, the glide 0 -> 1 held still at u = 0.002, 0.5 and 0.998:
// - the frame is the inverse pass's (__cmwSteps().glide.path);
// - it is the exact picture at u (held_frames refOf): the parked frame's colours through H_u's inverse, within REF_TOL
//   on all but SAME_FRAC of at least MIN_COMPARED pixels;
// - the boundaries (the pixels of the parked frame more than EDGE_DIFF/765 off the same frame with no shapes: MIN_EDGE or
//   more of them) are within STROKE_R px of their image under H_u at HIT_MIN of them, the pulled-back regions' band;
// - the glide's ends are within END_FRAC of the pixels of the parked frames of its planes;
// - each pixel of the parked frame the regions draw (where the same frame with no shapes differs) is drawn within
//   STROKE_R px of its image under H_u in the moving frame (where the same frame with no shapes differs), for at least
//   HIT_MIN of at least MIN_SAMPLES of them. The frames with no shapes are another page's, carried over as bytes.
// And the layer a region of a later plane has over the colour (LAYER: f = z² and a disc on w₁, Everywhere; Joukowski, its
// region on z and a disc on w₁, Inside regions, where the outer preimage lies in z's own region): in a window about a
// preimage, the glide's first frame (u = 0.002, the inverse pass's) is the parked frame on z within END_FRAC of the
// pixels and with a mean difference at most LAYER_SHARE of the layer's own (the parked frame against the same frame
// without that region, the control: more than LAYER_CTL of the pixels and a mean of more than LAYER_MEAN apart).
// Inside regions the colour inside keeps its full strength and the layer there is the band alone (#1889), a line a pixel
// or so wide: in a window about the preimage's boundary, the band's pixels (the parked frame more than BAND_D, channels
// summed, from the frame without that region; at least BAND_N of them) differ from that frame in the glide's first
// frame too, within a pixel, at BAND_HIT of them or more.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const HIT_MIN = 0.9, MIN_SAMPLES = 40, MIN_EDGE = 200, EDGE_DIFF = 300, STROKE_R = 3, DIFF_MIN = 24, REF_TOL = 3, SAME_FRAC = 0.01, MIN_COMPARED = 1000, END_FRAC = 0.02, LOOK_U = [0.002, 0.5, 0.998];
await view(1200, 800);
const ST = {
  pattern: 'phase', outline: true, lines: true, unit: false, alpha: 0.85, v3: true, v4: true, v5: true, nextId: 50,
  srcView: { cx: 0, cy: 0, s: 110 },
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }],
  shapes: [
    { id: 'c1', kind: 'disc', c: [0.4, 0.3], r: 0.6, ci: 2, visible: true, stage: 1 },
    { id: 'd1', kind: 'disc', c: [-0.5, 0.4], r: 0.3, ci: 3, visible: true, stage: 1 },
    { id: 'c2', kind: 'disc', c: [0.2, -0.2], r: 0.5, ci: 4, visible: true, stage: 2 },
  ],
  targets: [],
};
const sceneFrames = async (ns, shapes) => {
  await load(ns + Date.now(), Object.assign({}, ST, { shapes }));
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
  ok('the page shows the steps view', await isSteps(), null);
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'in', surf: 'plane' }), 1`);
};
const { grab, refOf, compare, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (the left canvas's still pixels kept in __heldPx[tag])
const at = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-9 && GLR.pendingLinks === 0` }); };
const still = async (tag) => { await ev(`__cmwSteps({ bare: false }), 1`); await settled({ max: 20000 }); ok(`the frame ${tag} settles`, await grab(tag), null); };
// the parked frame on plane 0 and the frames held at each u, kept in the page as __heldPx[tag]
const take = async (suffix) => {
  await ev(`__cmwSteps({ go: 0, now: true }), 1`);
  await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 0 && GLR.pendingLinks === 0` });
  await still('P' + suffix);
  for (const u of suffix === 'B' ? [] : LOOK_U) {
    await at(u); await still('M' + u + suffix);
    if (!suffix) {
      const g = await ev(`(({ path, reason }) => ({ path, reason }))(__cmwSteps().glide)`);
      info['record u=' + u] = g;
      ok(`the frame at u = ${u} is the inverse pass's (the later planes' regions in it)`, g.path === 'inverse', g);
    }
  }
  if (suffix === 'B') {
    for (const u of LOOK_U) {
      await at(u); await still('M' + u + suffix);
      const R = info['exact u=' + u] = (await refOf('P' + suffix, 'M' + u + suffix, REF_TOL)).ref;
      ok(`the frame at u = ${u} is the exact picture at u: the parked frame's colours (the region's colour from z) through H_u's inverse, at most ${SAME_FRAC * 100} % of the compared pixels > ${REF_TOL}/255 apart`, R && R.n >= MIN_COMPARED && R.over <= SAME_FRAC, R);
    }
  }
  if (!suffix) {
    await ev(`__cmwSteps({ go: 1, now: true }), 1`);
    await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 1 && GLR.pendingLinks === 0` });
    await still('P1');
  }
};

const pack = (tags) => ev(`(() => { const K = window.__heldPx, o = {}; for (const t of ${JSON.stringify(tags)}) { let b = ''; const d = K[t]; for (let i = 0; i < d.length; i += 32768) b += String.fromCharCode.apply(null, d.subarray(i, i + 32768)); o[t] = btoa(b); } return o; })()`);
const unpack = async (o) => {
  for (const t in o) {
    await ev(`(window.__b64 = window.__b64 || {})[${JSON.stringify(t)}] = ''`);
    for (let i = 0; i < o[t].length; i += 262144) await ev(`window.__b64[${JSON.stringify(t)}] += ${JSON.stringify(o[t].slice(i, i + 262144))}, 1`);
    ok(`the frame ${t} arrives`, await ev(`(() => { const K = window.__heldPx || (window.__heldPx = {}); K[${JSON.stringify(t)}] = Uint8ClampedArray.from(atob(window.__b64[${JSON.stringify(t)}]), (c) => c.charCodeAt(0)); return K[${JSON.stringify(t)}].length; })()`) === o[t].length * 3 / 4 - (o[t].endsWith('==') ? 2 : o[t].endsWith('=') ? 1 : 0), null);
  }
};
const carried = (u, min = DIFF_MIN) => ev(`(() => {
  const g = __cmwSteps().glide, K = window.__heldPx, P = K.P, P0 = K.P0, M = K['M' + ${u}], M0 = K['M' + ${u} + '0'], c = document.getElementById('canvasL');
  const W = c.width, H = c.height, dpr = W / g.w, v = g.view;
  const drawn = (D, D0, i) => Math.abs(D[i] - D0[i]) + Math.abs(D[i + 1] - D0[i + 1]) + Math.abs(D[i + 2] - D0[i + 2]) > ${min};
  const R = Math.round(${STROKE_R} * dpr);
  let n = 0, hit = 0, off = 0;
  for (let y = 2; y < H - 2; y += 2) for (let x = 2; x < W - 2; x += 2) {
    const i = 4 * (y * W + x);
    if (!drawn(P, P0, i)) continue;
    const z = { re: v.cx + ((x + 0.5) / dpr - g.w / 2) / v.s, im: v.cy - ((y + 0.5) / dpr - g.h / 2) / v.s }, w = g.Hb(z);
    const wx = Math.round(((w.re - v.cx) * v.s + g.w / 2) * dpr - 0.5), wy = Math.round((g.h / 2 - (w.im - v.cy) * v.s) * dpr - 0.5);
    if (!(wx >= R && wy >= R && wx < W - R && wy < H - R)) { off++; continue; }
    n++;
    let found = false;
    for (let dy = -R; dy <= R && !found; dy++) for (let dx = -R; dx <= R && !found; dx++) { const j = 4 * ((wy + dy) * W + wx + dx); if (drawn(M, M0, j)) found = true; }
    if (found) hit++;
  }
  return { n, hit, off, frac: +(hit / Math.max(1, n)).toFixed(3), path: g.path, reason: g.reason, b: g.b, u: +g.u.toFixed(3) };
})()`);

const tags = ['P'].concat(LOOK_U.map((u) => 'M' + u));
// (the exact picture at u, for a region of a plane past the glide's: its pullback keeps one opacity all along, and the
// parked frame's colours are then the reference all along)
await sceneFrames('svlaterB', ST.shapes.slice(2)); await take('B');
await sceneFrames('svlater', ST.shapes); await take('');
// (the glide's ends meet the parked frames of its planes: the regions of the plane it leaves and of the plane it
// reaches at their own opacity, with no jump on arrival)
for (const [name, base, tag] of [['start', 'P', 'M' + LOOK_U[0]], ['arrival', 'P1', 'M' + LOOK_U[LOOK_U.length - 1]]]) {
  const c = info['end ' + name] = await compare(base, tag);
  ok(`the frame at the glide's ${name} is the parked frame's within ${END_FRAC * 100} % of the pixels (> ${DIFF_TOL}/255 apart)`, c.frac <= END_FRAC, c);
}
const kept = await pack(tags);
await sceneFrames('svlater0', []); await take('0');
await unpack(kept);
const r = info.glide0 = {};
for (const u of LOOK_U) {
  await at(u);
  const q = r['u=' + u] = await carried(u);
  const e = r['edge u=' + u] = await carried(u, EDGE_DIFF);
  ok(`glide from plane 0: the boundaries at u = ${u} are the parked boundaries carried by H_u (the pixels more than ${EDGE_DIFF}/765 off the frame with no shapes: at least ${HIT_MIN * 100} % of ${MIN_EDGE}+ pixels within ${STROKE_R} px)`, e.n >= MIN_EDGE && e.frac >= HIT_MIN, e);
  ok(`glide from plane 0: the later planes' pullbacks at u = ${u} are the parked pullbacks carried by H_u (at least ${HIT_MIN * 100} % of ${MIN_SAMPLES}+ pixels within ${STROKE_R} px)`, q.n >= MIN_SAMPLES && q.frac >= HIT_MIN, q);
}

// ---- the layer of a later plane's region, at the glide's start ----
const LAYER_SHARE = 0.35, LAYER_CTL = 0.01, LAYER_MEAN = 3, BAND_D = 24, BAND_N = 20, BAND_HIT = 0.9;
// the band's pixels in window win (canvas fractions): where the parked frame Q differs from Q0 (the frame without the
// region) by more than BAND_D; hit, those where the glide's frame QM differs from Q0 by more than BAND_D / 2 at one of
// the 3 x 3 pixels about it
const bandKept = (win) => ev(`(() => {
  const K = window.__heldPx, Q = K.Q, QM = K.QM, Q0 = K.Q0, c = document.getElementById('canvasL'), W = c.width, H = c.height;
  const x0 = Math.max(1, Math.floor(${win.x[0]} * W)), x1 = Math.min(W - 2, Math.ceil(${win.x[1]} * W)), y0 = Math.max(1, Math.floor(${win.y[0]} * H)), y1 = Math.min(H - 2, Math.ceil(${win.y[1]} * H));
  const d = (A, i) => Math.abs(A[i] - Q0[i]) + Math.abs(A[i + 1] - Q0[i + 1]) + Math.abs(A[i + 2] - Q0[i + 2]);
  let n = 0, hit = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (d(Q, 4 * (y * W + x)) <= ${BAND_D}) continue;
    n++;
    let h = false;
    for (let b = -1; b <= 1 && !h; b++) for (let a = -1; a <= 1 && !h; a++) h = d(QM, 4 * ((y + b) * W + x + a)) > ${BAND_D} / 2;
    if (h) hit++;
  }
  return { n, hit, frac: n ? +(hit / n).toFixed(3) : 0 };
})()`);
const sh = (id, o) => Object.assign({ id, ci: 0, visible: true }, o);
const LAYER = [
  { key: 'z², Everywhere', scope: 'all', view: { cx: 0, cy: 0, s: 120 }, steps: [{ type: 'pown', params: { n: 2 }, on: true }], own: [],
    later: sh('L1', { kind: 'disc', c: [2, 0], r: 0.4, ci: 1, stage: 1 }), at: [1.4142, 0.07], r: 0.25 },
  { key: 'Joukowski, Inside regions', scope: 'in', view: { cx: 0, cy: 0, s: 70 }, steps: [{ type: 'joukowski', params: {}, on: true }],
    own: [sh('j1', { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }), sh('j2', { kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888, ci: 2 })],
    later: sh('L1', { kind: 'disc', c: [1.5, 0.3], r: 0.25, ci: 1, stage: 1 }), at: [3.2, 0.66], r: 0.25, band: true },
];
// a window of the left canvas (fractions) about the plane point at, r on each side
const winOf = ([re, im], r) => ev(`(() => { const c = document.getElementById('canvasL').getBoundingClientRect(), a = __cmwPlaneMenu().w2s('L', ${re - r}, ${im + r}), b = __cmwPlaneMenu().w2s('L', ${re + r}, ${im - r});
  return { x: [(a[0] - c.left) / c.width, (b[0] - c.left) / c.width], y: [(a[1] - c.top) / c.height, (b[1] - c.top) / c.height] }; })()`);
for (const L of LAYER) {
  const open = async (shapes) => {
    await load('svlayer' + Date.now(), Object.assign({}, ST, { srcView: L.view, steps: L.steps, shapes }));
    await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
    await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: '${L.scope}', surf: 'plane', go: 0, now: true }), 1`);
    await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSteps().x === 0 && __cmwSteps().scope === '${L.scope}' && GLR.pendingLinks === 0` });
  };
  await open(L.own); await still('Q0');
  const q0 = await pack(['Q0']);
  await open(L.own.concat([L.later])); await still('Q');
  await at(LOOK_U[0]); await still('QM');
  const g = await ev(`(({ path, reason }) => ({ path, reason }))(__cmwSteps().glide)`);
  await unpack(q0);
  const win = await winOf(L.at, L.r);
  const c = info[`layer ${L.key}`] = { g, win, start: await compare('Q', 'QM', win), control: await compare('Q', 'Q0', win) };
  ok(`${L.key}: the glide's first frame is the inverse pass's`, g.path === 'inverse', c);
  if (L.band) {
    const b = c.band = await bandKept(win);
    ok(`${L.key}: the glide's first frame (u = ${LOOK_U[0]}) keeps the later plane's region's band as the parked frame on z draws it (at least ${BAND_HIT * 100} % of its ${BAND_N}+ pixels about the preimage's boundary, within a pixel)`, b.n >= BAND_N && b.frac >= BAND_HIT, c);
    continue;
  }
  ok(`${L.key}: the glide's first frame (u = ${LOOK_U[0]}) keeps the layer of the later plane's region as the parked frame on z draws it (about a preimage, at most ${END_FRAC * 100} % of the pixels > ${DIFF_TOL}/255 apart, a mean difference at most ${LAYER_SHARE} of the layer's own)`, !!c.start && !!c.control && c.start.frac <= END_FRAC && c.start.mean <= LAYER_SHARE * c.control.mean, c);
  ok(`${L.key}: control: the parked frame without that region differs there (more than ${LAYER_CTL * 100} % of the pixels > ${DIFF_TOL}/255 apart, a mean of more than ${LAYER_MEAN})`, !!c.control && c.control.frac > LAYER_CTL && c.control.mean > LAYER_MEAN, c);
}
return { pass: fails.length === 0, fails, info };

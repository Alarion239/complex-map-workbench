// The steps view at rest on a plane: a region of a later plane is drawn here as its preimage, its own layer (a fill
// and its boundary over the plane's colour), in both scopes, wherever the plane's own regions colour the picture:
// - f = z², a disc on w₁: on z, Everywhere and Inside regions, each of its two preimages is drawn (read off the axes,
//   which are drawn over everything); parked at x = 0.2 between z and w₁ (a glide's frame, the map z^1.2), the one in
//   the right half-plane is drawn too (the glide keeps the layer: the inverse pass's, svStagedLayer);
// - Joukowski airfoil (its own region on z, the outside of the circle), a disc on w₁: on z, Inside regions and
//   Everywhere, the outer preimage, which lies in z's own region, is drawn, and the inner one too;
// - Cayley then cube (its half-plane on z), a rectangle on w₂: on w₁ and on z, in both scopes, its three preimages; and
//   with the colour from z, on w₁, a plane past the colour plane (the colour carried to it).
// Each reading compares the plane with the later region and without it (the same chain, scope and view): inside a
// preimage the picture differs by more than PRE_D (Everywhere: its fill; Inside regions over the paper: the colour the
// region keeps), somewhere on a short segment across a preimage's boundary (z², Joukowski) by more than EDGE_D in one
// pixel (its outline: more than the fill, Everywhere), far from every preimage by at most OUT_D (control: the same
// picture read twice). Inside regions, a preimage the plane's own regions already colour (where the two scopes agree
// without the later region) keeps that colour at full strength and the layer draws its band alone, no fill (#1889): there
// the picture at the preimage's centre pixel differs by at most FILL_K of Everywhere's there (the fill alone: the band
// and its casing take most of a small preimage's 5 × 5 patch).
// The boundary band against the colour it covers: at rest on z, in the light and the dark theme, the strongest
// pixel of the mark (the band over its casing) against the same pixel of the picture without the later region reaches
// the 3:1 of a graphical object (CONTRAST), in a box BOX_PX about one preimage: z², Everywhere, and Joukowski in both
// scopes (Inside regions its outer preimage, in z's own region, is the band alone over the colour). The glide's end:
// z², Everywhere, the frame held at END_X (the inverse pass's layer) draws the band and its casing as plane z at rest
// does.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// the colour difference (summed over r, g, b) that counts as a fill drawn (a 5 × 5 mean; the fill is at half strength
// over the colour), as an outline drawn (one pixel), and the most far from every preimage (a 5 × 5 mean); FILL_K: the
// most share of Everywhere's difference at a preimage's centre pixel that Inside regions may show there (no fill)
const PRE_D = 8, EDGE_D = 30, OUT_D = 3, FILL_K = 0.85;
async function openApp(st) {
  const ns = 'pbl' + Date.now();
  await view(1440, 900, false, false);
  await loadView('steps', ns, Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image' }, st));
  await settled({ max: 40000, until: `typeof __cmwSteps === 'function' && typeof __cmwP === 'function' && !!document.querySelector('#svStrip .sv-step')` });
}
// a plane (an integer x) or a frame parked between two planes (x not an integer); drawn: once the inverse pass draws it
// (a frame with no region at all, Inside regions, draws no colour and keeps no glide's record)
const atX = async (x, drawn) => {
  if (Number.isInteger(x)) { await atPlane(x); return; }
  await ev(`__cmwSteps({ park: ${x} }), 1`);
  await settled({ max: 30000, until: `(() => { const s = __cmwSteps(); return Math.abs(s.x - ${x}) < 1e-9 && !s.anim${drawn ? " && !!s.glide && s.glide.path === 'inverse'" : ''}; })()` });
};
const atPlane = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return s.x === ${i} && !s.anim && !s.moving; })()` }); };
const setScope = async (sc) => { await ev(`__cmwSteps({ scope: '${sc}' }), 1`); await settled({ until: `__cmwSteps().scope === '${sc}'` }); };
// a page read retried at most 3 times on CDP's -32603 (Internal error), which a getImageData read can answer once while
// the GPU process is busy with a parked frame's first draw; any other error is thrown
async function read3(expr) {
  for (let i = 0; ; i++) {
    try { return await ev(expr); } catch (e) { if (i >= 2 || !/-32603/.test(String(e))) throw e; await settled({ floor: 300 }); }
  }
}
// the mean colour of the (2 h + 1)² device pixels about each plane point (re, im) of the left pane (h = 2: 5 × 5;
// h = 0: the one pixel there), or null off the pane
const patches = (pts, h = 2) => read3(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, g = c.getContext('2d');
  return ${JSON.stringify(pts)}.map(([re, im]) => { const p = __cmwPlaneMenu().w2s('L', re, im), x = Math.round((p[0] - r.left) * k), y = Math.round((p[1] - r.top) * k);
    if (x < 3 || y < 3 || x > c.width - 4 || y > c.height - 4) return null;
    const d = g.getImageData(x - ${h}, y - ${h}, ${2 * h + 1}, ${2 * h + 1}).data, m = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) m[j] += d[i + j] / ${(2 * h + 1) ** 2};
    return m.map((v) => Math.round(v * 10) / 10); }); })()`);
// the colours of the 24 device pixels along the segment [p, q] of plane points, or null off the pane
const across = ([p, q]) => read3(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, g = c.getContext('2d');
  const a = __cmwPlaneMenu().w2s('L', ${p[0]}, ${p[1]}), b = __cmwPlaneMenu().w2s('L', ${q[0]}, ${q[1]});
  return Array.from({ length: 24 }, (_, i) => { const t = i / 23, x = Math.round(((1 - t) * a[0] + t * b[0] - r.left) * k), y = Math.round(((1 - t) * a[1] + t * b[1] - r.top) * k);
    return x < 0 || y < 0 || x >= c.width || y >= c.height ? null : [...g.getImageData(x, y, 1, 1).data].slice(0, 3); }); })()`);
const diff = (a, b) => (a && b ? Math.round(10 * a.reduce((s, v, j) => s + Math.abs(v - b[j]), 0)) / 10 : Infinity);
// (a plane's picture is read until two readings 300 ms apart agree: it draws a frame or two after the plane is reached)
async function steady(pts) {
  let last = await patches(pts);
  for (let i = 0; i < 30; i++) {
    await settled({ floor: 300 });
    const now = await patches(pts);
    if (now.every((p, j) => p && last[j] && diff(p, last[j]) <= 0.5)) return now;
    last = now;
  }
  return last;
}
// each case: its chain, its own shapes, the later region, the planes and the points read there
const sh = (id, o) => Object.assign({ id, ci: 0, visible: true }, o);
const CASES = [
  {
    key: 'z²', view: { cx: 0, cy: 0, s: 120 }, steps: [{ type: 'pown', params: { n: 2 }, on: true }],
    own: [], later: sh('L1', { kind: 'disc', c: [2, 0], r: 0.4, ci: 1, stage: 1 }),
    planes: {
      0: { pre: [[1.4177, 0.0705], [-1.4177, -0.0705]], edge: [[[1.4213, 0.1], [1.4213, 0.18]], [[-1.4213, -0.1], [-1.4213, -0.18]]], out: [[0.6, 1.2], [-0.6, -1.2]] },
      0.2: { pre: [[1.5175, 0.0909]], edge: [[[1.5229, 0.13], [1.5229, 0.23]]], out: [[0.6, 1.2], [-0.6, -1.2]] },
    },
  },
  {
    key: 'Joukowski', view: { cx: 0, cy: 0, s: 70 }, steps: [{ type: 'joukowski', params: {}, on: true }],
    own: [sh('j1', { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }), sh('j2', { kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888, ci: 2 })],
    later: sh('L1', { kind: 'disc', c: [1.5, 0.3], r: 0.25, ci: 1, stage: 1 }),
    planes: { 0: { pre: [[2.6463, 0.6926]], inner: [[0.3537, -0.0926]], edge: [[[3.12, 0.666], [3.28, 0.657]]], out: [[-2.5, -2], [-2.5, 2]] } },
  },
  {
    key: 'Cayley then cube', view: { cx: 0, cy: 1, s: 60 }, steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }],
    own: [sh('c1', { kind: 'halfplane', a: [0, 0], b: [1, 0] })],
    later: sh('L1', { kind: 'rect', a: [-0.38, -0.08], b: [-0.22, 0.08], ci: 1, stage: 2 }),
    planes: { 1: { pre: [[0.335, 0.58], [-0.669, 0], [0.335, -0.58]], out: [[0.9, 2.4], [-2.2, -2.4]] }, 0: { pre: [[-1.489, 0.709], [1.489, 0.709], [0, 0.198]], out: [[-3, 3.5], [3, 3.2]] } },
  },
  {
    key: 'Cayley then cube, colour from z', T: 0, view: { cx: 0, cy: 1, s: 60 }, steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }],
    own: [sh('c1', { kind: 'halfplane', a: [0, 0], b: [1, 0] })],
    later: sh('L1', { kind: 'rect', a: [-0.38, -0.08], b: [-0.22, 0.08], ci: 1, stage: 2 }),
    planes: { 1: { pre: [[0.335, 0.58], [-0.669, 0], [0.335, -0.58]], out: [[0.9, 2.4], [-2.2, -2.4]] } },
  },
];
for (const c of CASES) {
  // (Everywhere's readings, kept for Inside regions': a point where the two scopes agree without the later region is
  // in the plane's own regions)
  const every = {};
  for (const scope of ['all', 'in']) {
    const read = {};
    for (const withL of [false, true]) {
      await openApp({ srcView: c.view, steps: c.steps, shapes: c.own.concat(withL ? [c.later] : []) });
      await setScope(scope);
      if (c.T != null) { await ev(`__cmwSteps({ T: ${c.T} }), 1`); await settled({ until: `__cmwSteps().T === ${c.T}` }); }
      for (const k of Object.keys(c.planes)) {
        await atX(+k, withL || scope === 'all');
        const P = c.planes[k], pts = [...P.pre, ...(P.inner || []), ...P.out];
        read[k + withL] = await steady(pts);
        read[k + withL + 'c'] = await patches([...P.pre, ...(P.inner || [])], 0);
        if (withL) read[k + 'state'] = await ev(`(() => { const s = __cmwSteps(); return { x: s.x, path: s.glide && s.glide.path, u: s.glide && s.glide.u }; })()`);
        if (!withL) read[k + 'again'] = await steady(pts);
        read[k + withL + 'edge'] = await Promise.all((P.edge || []).map(across));
      }
    }
    for (const k of Object.keys(c.planes)) {
      const P = c.planes[k], n0 = P.pre.length, n1 = n0 + (P.inner || []).length;
      const d = read[k + true].map((p, j) => diff(p, read[k + false][j])), d0 = read[k + 'again'].map((p, j) => diff(p, read[k + false][j]));
      const tag = `${c.key}, ${scope === 'all' ? 'Everywhere' : 'Inside regions'}, ${Number.isInteger(+k) ? 'plane ' + k : 'parked at x = ' + k}`;
      // (the preimages' centre pixels: the fill alone, Inside regions' FILL_K row)
      const dc = read[k + true + 'c'].map((p, j) => diff(p, read[k + false + 'c'][j]));
      if (scope === 'all') every[k] = { d, dc, at: read[k + false] };
      const own = scope === 'in' ? read[k + false].slice(0, n1).map((p, j) => diff(p, every[k].at[j]) <= OUT_D) : null;
      info[tag] = { d, d0, dc, state: read[k + 'state'], own, dAll: scope === 'in' ? every[k].d : null, dcAll: scope === 'in' ? every[k].dc : null };
      if (!Number.isInteger(+k)) ok(`${tag}: the frame is parked there, drawn by the inverse pass`, Math.abs(read[k + 'state'].x - +k) < 1e-9 && read[k + 'state'].path === 'inverse', read[k + 'state']);
      ok(`${tag}: control: the picture without the later region, read twice, is the same (within ${OUT_D})`, d0.every((x) => x <= OUT_D), d0);
      if (!own) {
        ok(`${tag}: each preimage of the later region is drawn (differs by more than ${PRE_D})`, d.slice(0, n0).every((x) => x > PRE_D && x < Infinity), d.slice(0, n0));
        if (n1 > n0) ok(`${tag}: the inner preimage is drawn too`, d.slice(n0, n1).every((x) => x > PRE_D && x < Infinity), d.slice(n0, n1));
      } else {
        const dA = every[k].d, dcA = every[k].dc;
        ok(`${tag}: each preimage over the paper keeps the region's colour (differs by more than ${PRE_D})`, d.slice(0, n1).every((x, j) => own[j] || (x > PRE_D && x < Infinity)), { d: d.slice(0, n1), own });
        ok(`${tag}: each preimage in the plane's own regions has no fill over the colour (at its centre pixel, differs by at most ${FILL_K} of Everywhere's; at least one such preimage where the plane has regions of its own)`, (!c.own.length || own.some(Boolean)) && dc.every((x, j) => !own[j] || x <= FILL_K * dcA[j]), { dc, own, dcAll: dcA });
      }
      const e = read[k + true + 'edge'].map((seg, j) => Math.max(...seg.map((p, i) => diff(p, read[k + false + 'edge'][j][i]))));
      info[tag].edge = e;
      if (e.length) ok(`${tag}: each preimage's boundary is outlined (one pixel across it differs by more than ${EDGE_D}${scope === 'all' ? ', and more than the fill' : ''})`, e.every((x) => x > EDGE_D && x < Infinity && (scope !== 'all' || x > Math.max(...d.slice(0, n0)))), e);
      ok(`${tag}: far from every preimage the picture is unchanged (within ${OUT_D})`, d.slice(n1).every((x) => x <= OUT_D), d.slice(n1));
    }
  }
}
// ---- the band against the colour it covers ----
// (CONTRAST: the least ratio of the mark's strongest pixel, by theme (the dark theme's light ink reaches 3.1:1 without
// a casing, the bar it keeps); MARK_D: a pixel's largest channel difference that counts it in the mark; BOX_PX: css px
// each side of the preimage's point read; END_X: the glide's frame read against the plane at rest, held there (a park
// this near a plane keeps to the plane); END_D, END_PX: a pixel that differs by more than END_D counts, and at most
// END_PX may (the band and its casing drawn alike at the glide's end; the glide's frame also marks the later region's
// centre beside it, which the plane at rest does not))
const CONTRAST = { light: 3, dark: 3.1 }, MARK_D = 24, BOX_PX = 40, END_X = 0.002, END_D = 48, END_PX = 80;
const box = (at) => read3(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, g = c.getContext('2d');
  const p = __cmwPlaneMenu().w2s('L', ${at[0]}, ${at[1]}), x0 = Math.max(0, Math.round((p[0] - r.left - ${BOX_PX}) * k)), y0 = Math.max(0, Math.round((p[1] - r.top - ${BOX_PX}) * k));
  const w = Math.min(c.width - x0, Math.round(2 * ${BOX_PX} * k)), h = Math.min(c.height - y0, Math.round(2 * ${BOX_PX} * k));
  return Array.from(g.getImageData(x0, y0, w, h).data); })()`);
// the WCAG contrast of two colours (test/lib/contrast.js), and the pixel at i of an RGBA array as a colour
const { ratio } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'contrast.js'), 'utf8'))();
const rgbAt = (d, i) => [d[i], d[i + 1], d[i + 2]];
const pxD = (a, b, i) => Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
const BANDS = [
  { c: CASES[0], scope: 'all', at: [1.4177, 0.0705] },
  { c: CASES[1], scope: 'all', at: [2.6463, 0.6926] },
  { c: CASES[1], scope: 'in', at: [2.6463, 0.6926] },
];
info.band = {};
for (const theme of ['light', 'dark']) {
  for (const B of BANDS) {
    const px = [];
    for (const withL of [false, true]) {
      await openApp({ srcView: B.c.view, steps: B.c.steps, shapes: B.c.own.concat(withL ? [B.c.later] : []) });
      await ev(`document.documentElement.setAttribute('data-theme', '${theme}'), 1`);
      await setScope(B.scope);
      await atX(0);
      await steady([B.at]);
      px.push(await box(B.at));
    }
    const [wo, w] = px;
    let n = 0, best = 0;
    for (let i = 0; i + 2 < w.length && i + 2 < wo.length; i += 4) {
      if (pxD(w, wo, i) < MARK_D) continue;
      n++;
      best = Math.max(best, ratio(rgbAt(w, i), rgbAt(wo, i)));
    }
    const tag = `${B.c.key}, ${B.scope === 'all' ? 'Everywhere' : 'Inside regions'}, plane 0, ${theme} theme`;
    info.band[tag] = { n, best: +best.toFixed(2) };
    ok(`${tag}: the preimage's band, over its casing, reaches ${CONTRAST[theme]}:1 against the colour it covers (its strongest pixel)`, n > 0 && best >= CONTRAST[theme], info.band[tag]);
  }
  // the glide's end: z², Everywhere, the frame held at END_X against plane z at rest, both with the later region: the
  // glide's layer (the inverse pass's) draws the band over its casing as the plane at rest does
  {
    const c = CASES[0], at = [1.4177, 0.0705];
    await openApp({ srcView: c.view, steps: c.steps, shapes: c.own.concat([c.later]) });
    await ev(`document.documentElement.setAttribute('data-theme', '${theme}'), 1`);
    await setScope('all');
    await atX(0);
    await steady([at]);
    const rest = await box(at);
    await ev(`__cmwSteps({ x: ${END_X} }), 1`);
    await settled({ max: 30000, until: `(() => { const s = __cmwSteps(); return Math.abs(s.x - ${END_X}) < 1e-9 && !!s.glide && s.glide.path === 'inverse'; })()` });
    await steady([at]);
    const held = await box(at), inverse = await ev(`(() => { const s = __cmwSteps(); return Math.abs(s.x - ${END_X}) < 1e-9 && !!s.glide && s.glide.path === 'inverse'; })()`);
    let n = 0;
    for (let i = 0; i + 2 < held.length && i + 2 < rest.length; i += 4) if (pxD(held, rest, i) > END_D) n++;
    const tag = `${c.key}, Everywhere, held at x = ${END_X}, ${theme} theme`;
    info.band[tag] = { n, inverse };
    ok(`${tag}: the frame is held there, drawn by the inverse pass`, inverse, info.band[tag]);
    ok(`${tag}: the glide's end draws the band and its casing as plane z at rest does (at most ${END_PX} pixels differ by more than ${END_D})`, inverse && n <= END_PX, info.band[tag]);
  }
}
return { pass: fails.length === 0, fails, info };

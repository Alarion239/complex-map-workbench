// Inside regions, the steps view keeps the colour inside a region pulled back from a later plane at full strength, as
// inside a region of the plane itself (#1889): the regions' mask is opaque inside every region, so the colour there is
// the colour Everywhere shows, not a mix of it and the paper. The chain [z + 0.5, z + 0.25] (translations: plane k's
// region D is D - 0.5 on plane 0 when on plane 1, D - 0.75 when on plane 2), a disc on plane 0 (own), one on plane 1 and
// one on plane 2 (pulled back), coloured from z, at 100 % opacity, no outlines. In the light and the dark theme:
// - at rest on plane 0, and at the glide 0 -> 1 held at u = 0.5 (the inverse pass's frame, where the region of plane 2
//   is past the plane the glide reaches): at the points of a grid inside each disc (within INNER of its radius, clear
//   of its boundary), the Inside regions pixel fitted as paper + s (Everywhere - paper) over the three channels gives s;
//   the median s of each disc is at least FULL (the region of plane 1 at rest and the one of plane 2 both ways: 0.42
//   before #1889, the mask's PULL_ALPHA);
// - the control: the disc of plane 0 gives s of at least FULL too;
// - the paper: the median of points outside every disc under Inside regions, at least PAPER_N of them; a sample counts
//   where its Everywhere pixel is at least MIN_DIFF from the paper (sum of the channels), at least MIN_N of them a disc;
// - both scopes are read with the layer of the later planes' regions left out (__cmwHideStrokes, which leaves it out with
//   the strokes: Everywhere draws a fill in it over the colour), so the fit compares colour with colour; and Inside regions
//   read with that layer shown is the same at the points of the pulled-back discs (median channel sum within FILL_D: the
//   layer is the region's boundary band alone there).
// - on the globe (surf 'sphere'), at rest on plane 0, light theme: at the points of each disc that face the camera, the
//   Inside regions pixel is the Everywhere one (median channel sum apart at most GLOBE_D, read with the layer left out):
//   the globe's mask holds the pulled-back regions too, so its colour is kept inside them (#1894: the regions' globe
//   alone showed there, plain); and with the layer shown, Inside regions is the same there (the band alone, FILL_D).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in misc-3 (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// the centre pixel of canvasL at each plane point [x, y] ([r, g, b, a], null off the pane), in the frame's camera: the
// glide record's view while a glide frame is drawn (the main card's view is the pane's own camera, not the frame's)
const px = (pts) => ev(`(() => {
  const c = document.getElementById('canvasL'), s = __cmwSteps(), m = __cmwCards().main, v = (s.x % 1 && s.glide && s.glide.view) || m.view;
  const d = m.dpr, W = c.width, H = c.height, img = c.getContext('2d').getImageData(0, 0, W, H).data;
  return ${JSON.stringify(pts)}.map(([x, y]) => {
    const i = Math.floor(W / 2 + (x - v.cx) * v.s * d), j = Math.floor(H / 2 - (y - v.cy) * v.s * d);
    if (i < 0 || j < 0 || i >= W || j >= H) return null;
    const n = 4 * (j * W + i);
    return [img[n], img[n + 1], img[n + 2], img[n + 3]];
  });
})()`);
const FULL = 0.95, INNER = 0.55, MIN_DIFF = 60, MIN_N = 12, PAPER_N = 12, FILL_D = 3;
await view(1200, 800);
const DISCS = [
  { id: 'o0', kind: 'disc', c: [-0.9, -0.45], r: 0.4, ci: 2, visible: true, stage: 0 },
  { id: 'p1', kind: 'disc', c: [0.55, 0.85], r: 0.45, ci: 3, visible: true, stage: 1 },
  { id: 'p2', kind: 'disc', c: [1.15, -0.25], r: 0.45, ci: 4, visible: true, stage: 2 },
];
// (each disc's place on plane 0: its centre less the translations up to its plane)
const SHIFT = [0, 0.5, 0.75];
const ST = {
  pattern: 'phase', outline: false, lines: false, unit: false, alpha: 1, v3: true, v4: true, v5: true, nextId: 50,
  srcView: { cx: 0, cy: 0, s: 150 },
  steps: [{ type: 'mobius', params: { a: '1', b: '0.5', c: '0', d: '1' }, on: true }, { type: 'mobius', params: { a: '1', b: '0.25', c: '0', d: '1' }, on: true }],
  shapes: DISCS, targets: [],
};
// the grid points of disc d within INNER of its radius on the frame's plane, shifted by its region's place there
const inside = (d, shift) => {
  const pts = [], c = [d.c[0] - shift, d.c[1]], R = INNER * d.r;
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const x = i / 4 * R, y = j / 4 * R; if (x * x + y * y <= R * R) pts.push([c[0] + x, c[1] + y]); }
  return pts;
};
// points of a 12 x 8 grid over the pane outside every disc's region (with a margin of 0.25)
const outside = (P, shifts) => K.grid(P, 12, 8, 0.9).filter(([x, y]) => DISCS.every((d, k) => Math.hypot(x - (d.c[0] - shifts[k]), y - d.c[1]) > d.r + 0.25));
const median = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; };
// s for each point: Inside = paper + s (Everywhere - paper), least squares over the channels; null where too close to the paper
const fit = (all, inn, paper) => all.map((A, k) => {
  const I = inn[k];
  if (!A || !I) return null;
  let num = 0, den = 0, dist = 0;
  for (let c = 0; c < 3; c++) { const e = A[c] - paper[c]; num += (I[c] - paper[c]) * e; den += e * e; dist += Math.abs(e); }
  return dist >= MIN_DIFF ? num / den : null;
});
// the frame read in both scopes at the points of each disc (shifts: each disc's region on this frame's plane)
const measure = async (tag, shifts) => {
  const P = await K.paneOf();
  const sets = DISCS.map((d, k) => inside(d, shifts[k])), far = outside(P, shifts);
  const read = async (scope, hide) => {
    await ev(`__cmwHideStrokes(${hide}), __cmwSteps({ scope: '${scope}' }), 1`);
    await settled({ max: 60000, until: 'GLR.pendingLinks === 0' });
    return { discs: await Promise.all(sets.map((s) => px(s))), far: (await px(far)).filter(Boolean) };
  };
  const A = await read('all', true), I = await read('in', true), L = await read('in', false);
  const paper = [0, 1, 2].map((c) => median(I.far.map((p) => p[c])));
  const out = { paper, nFar: I.far.length };
  ok(`${tag}: the paper read at ${PAPER_N} or more points outside the regions`, I.far.length >= PAPER_N, out);
  DISCS.forEach((d, k) => {
    const s = fit(A.discs[k], I.discs[k], paper).filter((v) => v != null);
    const r = out[d.id] = { n: s.length, s: +median(s).toFixed(3), lo: +Math.min(...s).toFixed(3) };
    const what = d.stage ? `the region of plane ${d.stage}, pulled back` : 'the region of plane 0 (the control)';
    ok(`${tag}: ${what} reads at ${MIN_N} or more points`, r.n >= MIN_N, r);
    ok(`${tag}: inside ${what}, the colour is Everywhere's at full strength (median s >= ${FULL})`, r.s >= FULL, r);
    if (!d.stage) return;
    const dl = L.discs[k].map((q, i) => (q && I.discs[k][i] ? Math.abs(q[0] - I.discs[k][i][0]) + Math.abs(q[1] - I.discs[k][i][1]) + Math.abs(q[2] - I.discs[k][i][2]) : null)).filter((v) => v != null);
    r.layer = median(dl);
    ok(`${tag}: inside ${what}, Inside regions' layer adds no fill over the colour (median difference with the layer shown <= ${FILL_D})`, dl.length >= MIN_N && r.layer <= FILL_D, r);
  });
  return out;
};

// the centre pixel of canvasL at each plane point [x, y] lifted onto the left globe (__cmwGlobeXY: the pane's px, null on
// the globe's far side): [r, g, b, a], or null
const gpx = (pts) => ev(`(() => {
  const c = document.getElementById('canvasL'), d = __cmwCards().main.dpr, W = c.width, H = c.height, img = c.getContext('2d').getImageData(0, 0, W, H).data;
  return ${JSON.stringify(pts)}.map(([x, y]) => {
    const q = __cmwGlobeXY('L', x, y);
    if (!q) return null;
    const i = Math.floor(q[0] * d), j = Math.floor(q[1] * d);
    if (i < 0 || j < 0 || i >= W || j >= H) return null;
    const n = 4 * (j * W + i);
    return [img[n], img[n + 1], img[n + 2], img[n + 3]];
  });
})()`);
// (GLOBE_CAMS: the cameras, in degrees, and the discs (by index) each reads)
const GLOBE_D = 6, GLOBE_CAMS = [{ yaw: -60, pitch: -24, discs: [1, 2] }, { yaw: 120, pitch: -24, discs: [0] }];
const sum3 = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
for (const theme of ['light', 'dark']) {
  await load(`svpbm${theme}${Date.now()}`, ST);
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
  ok(`${theme}: the page shows the steps view`, await isSteps(), null);
  await ev(`document.documentElement.setAttribute('data-theme', '${theme}'), __cmwSet('morphPaths', false), __cmwSteps({ T: 0, surf: 'plane', go: 0, now: true }), 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().x === 0 && GLR.pendingLinks === 0' });
  info[`${theme} rest`] = await measure(`${theme}, at rest on plane 0`, SHIFT);
  // (the glide 0 -> 1 at u = 0.5: plane 0's points moved by half the first step, so every region's place moves by +0.25)
  await ev('__cmwSteps({ x: 0.5 }), 1');
  await settled({ max: 60000, until: 'Math.abs(__cmwSteps().x - 0.5) < 1e-9 && GLR.pendingLinks === 0' });
  const g = await ev('(({ path, reason }) => ({ path, reason }))(__cmwSteps().glide || {})');
  ok(`${theme}: the frame at u = 0.5 is the inverse pass's`, g.path === 'inverse', g);
  // (the region of plane 1 is the plane the glide reaches, and blends its own look in by u: its row is the rest frame's)
  info[`${theme} u=0.5`] = await measure(`${theme}, the glide 0 -> 1 at u = 0.5`, SHIFT.map((s) => s - 0.25));
}
// ---- the globe (#1894) ----
{
  await load(`svpbmglobe${Date.now()}`, ST);
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR && GLR.pendingLinks === 0' });
  await ev(`document.documentElement.setAttribute('data-theme', 'light'), __cmwSet('morphPaths', false), __cmwSteps({ T: 0, surf: 'sphere', go: 0, now: true }), 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSteps().x === 0 && GLR.pendingLinks === 0' });
  const sets = DISCS.map((d, k) => inside(d, SHIFT[k]));
  // (each disc read with a camera it faces, GLOBE_CAMS: plane 0's points of modulus near 1 lie about the globe's equator)
  const A = [], I = [], L = [];
  for (const cam of GLOBE_CAMS) {
    await ev(`__cmwCam('L', { yaw: ${cam.yaw} * Math.PI / 180, pitch: ${cam.pitch} * Math.PI / 180 }), 1`);
    const read = async (scope, hide) => {
      await ev(`__cmwHideStrokes(${hide}), __cmwSteps({ scope: '${scope}' }), 1`);
      await settled({ max: 60000, until: 'GLR.pendingLinks === 0' });
      return Promise.all(cam.discs.map((k) => gpx(sets[k])));
    };
    const a = await read('all', true), i = await read('in', true), l = await read('in', false);
    cam.discs.forEach((k, n) => { A[k] = a[n]; I[k] = i[n]; L[k] = l[n]; });
  }
  await ev('__cmwHideStrokes(false), 1');
  const out = info.globe = { surf: await ev('__cmwSteps().surf || null') };
  DISCS.forEach((d, k) => {
    const dI = A[k].map((p, i) => (p && I[k][i] ? sum3(p, I[k][i]) : null)).filter((v) => v != null);
    const dL = L[k].map((p, i) => (p && I[k][i] ? sum3(p, I[k][i]) : null)).filter((v) => v != null);
    const r = out[d.id] = { n: dI.length, apart: median(dI), layer: median(dL) };
    const what = d.stage ? `the region of plane ${d.stage}, pulled back` : 'the region of plane 0 (the control)';
    ok(`the globe: ${what} reads at ${MIN_N} or more points facing the camera`, r.n >= MIN_N, r);
    ok(`the globe: inside ${what}, Inside regions shows Everywhere's colour (median channel sum apart <= ${GLOBE_D})`, r.apart <= GLOBE_D, r);
    if (d.stage) ok(`the globe: inside ${what}, Inside regions' layer adds no fill over the colour (median difference with the layer shown <= ${FILL_D})`, dL.length >= MIN_N && r.layer <= FILL_D, r);
  });
}
return { pass: fails.length === 0, fails, info };

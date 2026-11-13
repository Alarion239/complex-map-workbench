// The cut's image curve on the Sphere and through a glide (steps view, issue #912): the plane at rest draws a cut carried to
// a later plane with the θ handle on it; the Sphere and the glide's frames draw the same curve with no handle.
// - chain A: √z (cut 180°), then z + 2. On plane w₁ the banks are the two half-lines of the imaginary axis;
//   - at rest on the Sphere, plane w₁: both banks are drawn on the globe, the stroke's pixels at the exact image;
//   - parked half-way between w₁ and w₂ (u = .5), on the Sphere and on the plane: the banks are the exact image at u (the
//     rest samples moved by the homotopy z + t·2, that is +1), in the same ink at full opacity (one stroke, no fade),
//     sampled at every fourth rest sample while the picture moves;
//   - the θ handle is absent while the picture moves and back at rest on a plane.
// - chain B: z + 1 (Möbius), then the logarithm (cut 180°): the cut lives in plane w₁, past the glide z → w₁, so it is
//   drawn as its preimage on plane z (the real half-line left of −1), and mid-glide those samples are carried by the
//   homotopy (+ u): the frames at u = .5 are the parked samples + .5, at u = 1 they are the cut's own ray on plane w₁ (the
//   real half-line left of 0).
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const EXACT = 1e-5;        // a sample against its exact image: the maps are evaluated in double precision
const ON_LINE = 1e-3;      // a bank against its line: the ray's bank is offset 1e-7 rad, its far samples reach a few thousand
const NEAR_END = 0.2;      // how close to u = 0 or 1 the frame is parked: farther from a plane than an eighth of a step (.125), within which the thread settles on the plane
const INK_TOL = 40;        // per channel, #CC3311: the 1.75 px stroke's edge pixels are part paper; half strength is 100 off in green
const HALF = 0.5;          // the glide parked half-way
const SAMPLE_PX = 0.5;     // a drawn sample from the exact image, in px: at the surface they agree to the pick's own pixel (0.00 measured); at the 1.004 shell the median is 1.2 and at 1.01 2.9
const THIN = 4;            // the glide's frames take every fourth sample of the rest set
const MIN_VISIBLE = 50;    // the points of the rim bank that must show on the globe before it is read
const MIN_SEG = 1;         // a segment under this many px is a point to the eye; its midpoint is not tested
const CHORD_TOL = 0.05;    // a drawn segment's midpoint against the curve's circle, as a share of its radius (a pixel is about 1 %)
await view(1200, 800, false, false);
const J = (e) => ev(`(${e})`);
const open = async (steps) => {
  const ns = 'cutsph' + Date.now() + Math.floor(Math.random() * 1e6);
  await loadView('steps', ns, { srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
};
// (parked or at rest at thread place x: the frame is drawn when the cut curves stop changing between two polls)
const at = async (o, x) => {
  await ev(`__cmwSteps(${JSON.stringify(o)}); 1`);
  const r = await settled({
    max: 30000,
    until: `(() => { const s = __cmwSteps(), c = __cmwCutCurves(), k = JSON.stringify([s.x, c.length, c.map((q) => q.s && q.s.length && q.s[q.s.length >> 1])]); const same = window.__cutKey === k && Math.abs(s.x - ${x}) < 1e-3; window.__cutKey = k; return same; })()`,
  });
  ok('the frame settled at x = ' + x, r && r.ok, r);
};
const curves = () => J('__cmwCutCurves()');
const handles = () => J('__cmwCutHandles()');
// (the share of the points (CSS px) whose pixel, or one beside it, is the cut's ink)
const inkShare = (pts) => J(`(() => {
  const c = document.getElementById('canvasL'), s = document.createElement('canvas'), k = c.width / c.getBoundingClientRect().width;
  s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  const P = ${JSON.stringify(pts)}, ink = [204, 51, 17];
  const hit = P.filter((p) => {
    const d = g.getImageData(Math.round(p[0] * k) - 1, Math.round(p[1] * k) - 1, 3, 3).data;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - ink[0]) < ${INK_TOL} && Math.abs(d[i + 1] - ink[1]) < ${INK_TOL} && Math.abs(d[i + 2] - ink[2]) < ${INK_TOL}) return true;
    return false;
  });
  return { n: P.length, share: P.length ? hit.length / P.length : 0 };
})()`);
const onScreen = (c) => ((c && c.s) || []).filter((p) => p && p[0] > 2 && p[1] > 2 && p[0] < 1100 && p[1] < 700);
const distRe = (c, re) => Math.max(...c.w.map((p) => Math.abs(p[0] - re)));   // (distance of a bank from the line Re w = re)

// ---- chain A ----
await open([{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'add', params: { c: '2' }, on: true }]);
await at({ go: 1, now: true, surf: 'sphere' }, 1);
let cv = await curves();
const solid = cv.find((c) => c.solid), dash = cv.find((c) => !c.solid);
ok('sphere rest: both banks are drawn', !!solid && !!dash && solid.w.length > 100 && dash.w.length > 100, cv.map((c) => [c.solid, c.w.length]));
ok('sphere rest: the banks are the imaginary axis', !!solid && !!dash && distRe(solid, 0) < ON_LINE && distRe(dash, 0) < ON_LINE, solid && distRe(solid, 0));
const pick = onScreen(solid);
ok('sphere rest: the solid bank is visible on the globe', pick.length > 5, pick.length);
const restInk = await inkShare(pick);
info.restInk = restInk;
ok('sphere rest: the stroke is on the exact image (the ink at the samples)', restInk.share > 0.9, restInk);
const off = await inkShare(pick.map((p) => [p[0] + 9, p[1] + 9]));
ok('sphere rest: the ink is not beside the curve', off.share < 0.5, off);
ok('sphere rest: no handle on the globe', (await handles()).length === 0, await handles());
const restW = solid.w.map((p) => p[0]), restV = solid.w.map((p) => p[1]);
// (the glide's samples, every fourth of the rest set, against the rest samples moved by the homotopy)
const movedBy = (c, dx) => Math.max(...c.w.map((p, i) => Math.hypot(p[0] - (restW[i * THIN] + dx), p[1] - restV[i * THIN])));

await at({ park: 1 + HALF }, 1 + HALF);
cv = await curves();
const ms = cv.find((c) => c.solid), md = cv.find((c) => !c.solid);
ok('sphere glide: both banks are drawn', !!ms && !!md && ms.w.length > 20, cv.map((c) => [c.solid, c.w.length]));
info.shift = ms && movedBy(ms, 1);
ok('sphere glide: the banks are the exact image at u = .5 (the rest samples + 1)', !!ms && info.shift < EXACT && distRe(ms, 1) < ON_LINE, info.shift);
const gInk = await inkShare(onScreen(ms));
info.glideInk = gInk;
ok('sphere glide: drawn at full opacity, the ink at the samples (no fade)', gInk.n > 5 && gInk.share > 0.9, gInk);
ok('sphere glide: no handle', (await handles()).length === 0, await handles());

await at({ go: 1, now: true, surf: 'plane' }, 1);
await at({ park: 1 + HALF }, 1 + HALF);
cv = await curves();
const ps = cv.find((c) => c.solid);
ok('plane glide: the solid bank is the exact image at u = .5', !!ps && movedBy(ps, 1) < EXACT && distRe(ps, 1) < ON_LINE, ps && ps.w.length);
const pInk = await inkShare(onScreen(ps));
info.planeInk = pInk;
ok('plane glide: one stroke at full opacity (the ink at the samples)', pInk.n > 5 && pInk.share > 0.9, pInk);
ok('plane glide: the handle is hidden while the picture moves', (await handles()).length === 0, await handles());

await at({ go: 1, now: true }, 1);
ok('at rest on plane w₁: the handle is back', (await handles()).length === 1, await handles());

// ---- chain B: the cut of a plane past the glide ----
await open([{ type: 'mobius', params: { a: '1', b: '1', c: '0', d: '1' }, on: true }, { type: 'log', params: { cut: 180 }, on: true }]);
await at({ go: 0, now: true }, 0);
cv = await curves();
const pre = cv.find((c) => c.pre);
ok('chain B at rest on z: the cut is drawn as its preimage, one curve', !!pre && pre.w.length === 1 && pre.w[0].length > 100, pre && pre.w.length);
const w0 = (c) => (c && c.w[0]) || [];   // (a cut's first curve)
const base = w0(pre);
const preInk = await inkShare(onScreen({ s: (pre && pre.s[0]) || [] }));
ok('chain B at rest on z: the preimage is drawn in the ink', preInk.n > 5 && preInk.share > 0.9, preInk);
const preAt = async (x) => { await at({ park: x }, x); return (await curves()).find((c) => c.pre); };
const dist = (c, f) => Math.max(...w0(c).map((p, i) => Math.hypot(p[0] - f(base[i])[0], p[1] - f(base[i])[1])));
const mid = await preAt(HALF);
ok('chain B glide at u = .5: the preimage is drawn, the parked samples + .5', !!mid && w0(mid).length === base.length && dist(mid, (p) => [p[0] + HALF, p[1]]) < EXACT, mid && w0(mid).length);
const midInk = await inkShare(onScreen({ s: (mid && mid.s[0]) || [] }));
ok('chain B glide at u = .5: in the ink at full opacity', midInk.n > 5 && midInk.share > 0.9, midInk);
const start = await preAt(NEAR_END);
ok('chain B glide at u = .2: the parked samples + .2', !!start && w0(start).length === base.length && dist(start, (p) => [p[0] + NEAR_END, p[1]]) < EXACT, w0(start).length);
const end = await preAt(1 - NEAR_END);
ok('chain B glide at u = .8: the parked samples + .8, left of the cut\'s own ray at u = 1', !!end && w0(end).length === base.length && dist(end, (p) => [p[0] + 1 - NEAR_END, p[1]]) < EXACT && Math.max(...w0(end).map((p) => p[0])) < 0, w0(end).length);
info.pre = { base: base.length, mid: mid && w0(mid).length };

// ---- chain C: z^i, whose cut (180°) is the circle |w| = e^-π, wound round it in turns near the branch point: seen from
// below the hole it is a small circle on the globe, and every drawn segment of its clockwise bank must lie on it
await open([{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true }]);
await at({ go: 1, now: true, surf: 'sphere' }, 1);
await ev('__cmwCam("L", { pitch: -1.45, yaw: -0.6, dist: 2.2 }); 1');
const rimKey = await settled({
  max: 30000,
  until: `(() => { const c = __cmwCutCurves().find((q) => !q.solid), k = c ? c.s.filter(Boolean).length : 0; const same = k > ${MIN_VISIBLE} && window.__rimKey === k; window.__rimKey = k; return same; })()`,
});
ok('chain C on the globe: the rim bank is drawn and settles', rimKey && rimKey.ok, rimKey);
cv = await curves();
const rim = cv.find((c) => !c.solid);   // (the clockwise bank, arg z = π: |w| = e^-π; the other is |w| = e^π, at the north pole)
const chords = !rim ? null : await J(`(() => {
  const S = ${JSON.stringify(rim.s)}, R = Math.exp(-Math.PI);
  let n = 0, worst = 0;
  for (let i = 0; i + 1 < S.length; i++) {
    const p = S[i], q = S[i + 1];
    if (!p || !q || Math.hypot(p[0] - q[0], p[1] - q[1]) < ${MIN_SEG}) continue;
    const w = __cmwSphereWL((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    if (!w) continue;
    n++; worst = Math.max(worst, Math.abs(Math.hypot(w[0], w[1]) / R - 1));
  }
  return { n, worst: +worst.toFixed(4) };
})()`);
info.chords = chords;
ok('chain C on the globe: the cut hugs its circle (segment midpoints on |w| = e^-π)', !!chords && chords.n > 50 && chords.worst < CHORD_TOL, chords);

// ---- chain D: the cut of log (Im w = ±π) at the globe's limb, where a stroke off the surface is shifted by the parallax:
// the drawn samples lie on the line, as the picks see it (the offset in px through the pick's gradient of the distance to the line)
await open([{ type: 'log', params: { cut: 180, k: 0 }, on: true }]);
await at({ go: 1, now: true, surf: 'sphere' }, 1);
await ev('__cmwCam("L", { pitch: 1.2, yaw: -1.57, dist: 3 }); 1');
const limbKey = await settled({
  max: 30000,
  until: `(() => { const MIN_SAMPLES = 100, c = __cmwCutCurves().find((q) => !q.solid), k = c ? c.s.filter(Boolean).length : 0; const same = k > MIN_SAMPLES && window.__limbKey === k; window.__limbKey = k; return same; })()`,
});
ok('chain D on the globe: the cut at the limb is drawn and settles', limbKey && limbKey.ok, limbKey);
// The probe samples the cut inside the canvas window: EDGE_PX clear of the left and top edges, and the right and bottom
// bounds W_PX and H_PX, which keep the samples off the right and bottom margins of the 1100 × 700 frame (the same
// frame as onScreen above). The 90th percentile of the offsets is read at P90.
const limbOff = await J(`(() => {
  const EDGE_PX = 5, W_PX = 840, H_PX = 700, P90 = 0.9;
  const f = (v) => Math.min(Math.abs(v - Math.PI), Math.abs(v + Math.PI)), d = [];
  for (const c of __cmwCutCurves()) for (const p of c.s || []) {
    if (!p || p[0] < EDGE_PX || p[1] < EDGE_PX || p[0] > W_PX || p[1] > H_PX) continue;
    const w = __cmwSphereWL(p[0], p[1]), wx = __cmwSphereWL(p[0] + 1, p[1]), wy = __cmwSphereWL(p[0], p[1] + 1);
    if (!w || !wx || !wy) continue;
    const g = Math.hypot(f(wx[1]) - f(w[1]), f(wy[1]) - f(w[1]));
    if (g > 1e-9) d.push(f(w[1]) / g);
  }
  d.sort((a, b) => a - b);
  return { n: d.length, median: d.length ? +d[d.length >> 1].toFixed(2) : null, p90: d.length ? +d[Math.floor(d.length * P90)].toFixed(2) : null };
})()`);
info.limbOffset = limbOff;
ok('chain D on the globe: the drawn cut is on its exact image at the limb (px)', limbOff.n > 100 && limbOff.p90 <= SAMPLE_PX, limbOff); // 100: the same sample floor as the settle check above

const lg = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', lg.length === 0, lg);
return { pass: fails.length === 0, fails, info };

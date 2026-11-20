// A later plane's region drawn on a glide's frame (the inverse pass's layer, svStagedLayer: its band and casing), near
// a critical value of the frame's map: Cayley then cube, the upper half-plane its own region on z, a rectangle on w₂,
// Everywhere, the glide z → w₁ parked at x = 0.5, where the Möbius step's homotopy is a map of degree 2 with a critical
// value at about −1.13 − 2.03i of the frame. The rectangle has no preimage there, but the inverse branch's footprint
// blows up at it, and the band's linear estimate of the distance to the boundary put a band and its casing in the
// pixels about it: a starburst. Against the same frame without the rectangle, in a box SPECK_R about that point at most
// SPECK_MAX pixels differ by more than DIFF (none drawn there); the rectangle's three preimages' bands, away from it,
// are drawn (at least BAND_MIN such pixels there).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const DIFF = 48, SPECK_R = 0.4, SPECK_MAX = 2, BAND_MIN = 100, SPECK = [-1.13, -2.03];
const sh = (id, o) => Object.assign({ id, ci: 0, visible: true }, o);
const steps = [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'pown', params: { n: 3 }, on: true }];
const own = [sh('c1', { kind: 'halfplane', a: [0, 0], b: [1, 0] })];
const later = sh('L1', { kind: 'rect', a: [-0.38, -0.08], b: [-0.22, 0.08], ci: 1, stage: 2 });
// the left pane's pixels with the camera's mapping to plane points, in the glide's frame at x = 0.5, Everywhere
async function frame(withL) {
  await view(1280, 800, false, false);
  await loadView('steps', 'pbs' + Date.now(), { v3: true, v4: true, v5: true, v6: true, nextId: 50, rightMode: 'image', srcView: { cx: 0, cy: 1, s: 60 }, steps, shapes: own.concat(withL ? [later] : []) });
  await settled({ max: 40000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-step')` });
  await ev(`__cmwSteps({ scope: 'all' }), 1`);
  await settled({ until: `__cmwSteps().scope === 'all'` });
  await ev(`__cmwSteps({ park: 0.5 }), 1`);
  await settled({ max: 30000, until: `(() => { const s = __cmwSteps(); return Math.abs(s.x - 0.5) < 1e-9 && !s.anim && !!s.glide && s.glide.path === 'inverse'; })()` });
  return ev(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, m = __cmwPlaneMenu();
    const p0 = m.w2s('L', 0, 0), p1 = m.w2s('L', 1, 1);
    return { W: c.width, H: c.height, d: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data),
      o: [(p0[0] - r.left) * k, (p0[1] - r.top) * k], s: [(p1[0] - p0[0]) * k, (p1[1] - p0[1]) * k] }; })()`);
}
const A = await frame(false), B = await frame(true);
const sx = A.o[0] + SPECK[0] * A.s[0], sy = A.o[1] + SPECK[1] * A.s[1], R = SPECK_R * Math.abs(A.s[0]);
let near = 0, far = 0;
const ex = [];
for (let y = 0; y < A.H; y++) for (let x = 0; x < A.W; x++) {
  const i = 4 * (y * A.W + x);
  const d = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
  if (d <= DIFF) continue;
  if (Math.hypot(x - sx, y - sy) <= R) { near++; if (ex.length < 6) ex.push([x, y, d]); } else far++;
}
info.frame = { W: A.W, H: A.H, speckPx: [Math.round(sx), Math.round(sy)], R: Math.round(R), near, far, ex };
ok(`x = 0.5, Everywhere: no band or casing at the frame map's critical value (at most ${SPECK_MAX} pixels within ${SPECK_R} of it differ by more than ${DIFF} with the rectangle)`, near <= SPECK_MAX, info.frame);
ok(`x = 0.5, Everywhere: the rectangle's preimages are drawn away from it (at least ${BAND_MIN} pixels differ)`, far >= BAND_MIN, info.frame);
const exc = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || ''));
ok('no console errors', exc.length === 0, exc.slice(0, 4));
return { pass: fails.length === 0, fails, info };

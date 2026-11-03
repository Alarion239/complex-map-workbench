// The steps view on the Sphere surface draws the globe's net over the colour in both scopes (ux on #748: the net
// belongs to the surface, not to the colouring): z^i of the upper half-plane H in the Plain colouring, the left globe
// framed under Inside regions and under Everywhere, and the two frames compared inside the region. Plane z samples
// the meridians at odd multiples of 15 degrees, the ones the select tool's polar net draws and the plain graticule
// (every 30 degrees) does not; plane w1 samples its annulus e^-pi < |w| < 1. Pixels within 6 degrees of a region's
// rim are left out (its anti-aliased edge differs between the scopes), and so are those near the globe's silhouette.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js),
// pinned to the steps view (ci/suite_views.js). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const H = { id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] };
const ZI = { type: 'powa', params: { alpha: 'i', cut: 180, k: 0 }, on: true };
await view(1440, 900, false);
await load('svnet' + Date.now(), {
  dc: 'phase', shapes: [H], steps: [ZI], srcView: { cx: 0, cy: 1, s: 60 }, alpha: 1, lines: false, unit: false,
});
await settled({ max: 20000, until: 'typeof __cmwSteps === "function"' });
// canvasL's pixels kept in the page as __gn[tag]
const grab = (tag) => ev(`(() => {
  const c = document.getElementById('canvasL'), g = document.createElement('canvas');
  g.width = c.width; g.height = c.height; g.getContext('2d').drawImage(c, 0, 0);
  const px = g.getContext('2d').getImageData(0, 0, g.width, g.height).data;
  (window.__gn || (window.__gn = {}))[${JSON.stringify(tag)}] = px;
  return 1; })()`);
// the sampled pixels (sample(w): the globe point w at a pane pixel is one to compare) where the two frames differ by
// more than 15/255 summed over the channels
const compare = (a, b, sample) => ev(`(() => {
  const A = __gn[${JSON.stringify(a)}], B = __gn[${JSON.stringify(b)}], sample = ${sample};
  const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), dpr = c.width / r.width;
  let n = 0, bad = 0; const ex = [];
  for (let y = 2; y < r.height - 2; y++) for (let x = 2; x < r.width - 2; x++) {
    const w = __cmwSphereWL(x + 0.5, y + 0.5); if (!w || !sample(w)) continue;
    // (away from the globe's silhouette: the globe under every pixel 4 px off)
    if (![[-4, 0], [4, 0], [0, -4], [0, 4]].every(([dx, dy]) => __cmwSphereWL(x + 0.5 + dx, y + 0.5 + dy))) {
      continue;
    }
    const i = 4 * (Math.floor((y + 0.5) * dpr) * c.width + Math.floor((x + 0.5) * dpr)); n++;
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    if (d > 15) {
      bad++;
      if (ex.length < 4) ex.push([x, y, [A[i], A[i + 1], A[i + 2]], [B[i], B[i + 1], B[i + 2]]]);
    }
  }
  return { n, bad, ex }; })()`);
const RIM = 6 * Math.PI / 180;
const CASES = [
  // plane z, seen from above: inside H (arg z in (0, pi)) away from its rim, on a meridian at an odd multiple of
  // 15 degrees
  { k: 0, name: 'plane z', cam: '{ pitch: 1.3, yaw: -1.0, dist: 3 }', sample: `(w) => {
    const t = Math.atan2(w[1], w[0]); if (!(t > ${RIM} && t < Math.PI - ${RIM})) return false;
    const m = t * 12 / Math.PI, j = Math.round(m); return j % 2 === 1 && Math.abs(m - j) < 0.12; }` },
  // plane w1, seen from below: z^i(H), the annulus e^-pi < |w| < 1, away from its two circles (log|w| = -arg z)
  { k: 1, name: 'plane w1', cam: '{ pitch: -1.3, yaw: -1.0, dist: 3 }', sample: `(w) => {
    const L = -Math.log(Math.hypot(w[0], w[1])); return L > ${RIM} && L < Math.PI - ${RIM}; }` },
];
for (const c of CASES) {
  await ev(`__cmwSteps({ go: ${c.k}, now: true, surf: 'sphere' }); 1`); await settled({ max: 20000 });
  await ev(`__cmwCam("L", ${c.cam}); 1`); await settled({ max: 20000 });
  for (const scope of ['in', 'all']) {
    await ev(`__cmwSteps({ scope: '${scope}' }); 1`); await settled({ max: 20000 }); await grab(scope);
  }
  const r = info[c.name] = await compare('in', 'all', c.sample);
  ok(`${c.name} on the Sphere: inside the region, Inside regions draws the globe's net as Everywhere does`,
    r.n >= 300 && r.bad === 0, r);
}
return { pass: fails.length === 0, fails, info };

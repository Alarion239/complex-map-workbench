// The steps view's globe past the colour plane shows the colour carried from the colour plane (#729). The w-globe of
// the Cayley map w = (z - i)/(z + i) of the half plane H, with the colour plane z, at rest on plane 1 on the Sphere
// surface (the camera turned off the poles, the Tiles colouring): at each sample of the globe's pixels, the plane point
// w under the pixel (__cmwGlobeSnap) came from z = i(1 + w)/(1 - w), and the globe must show the colour plane z shows at
// z (the reference is plane z itself, Everywhere, in the same page). The globe is lit and plane z is not, so the hue of
// the pixel is compared, not its channels: a sample is wrong when its hue is more than HUE_TOL radians from the hue of
// all 9 pixels around z's, and bare when the globe shows paper (its channels within 6 of each other) where plane z is
// coloured. Left out: samples where plane z's colour is within SAT_MIN of grey (a zero's fade, the |g| = 1 stroke) or
// where its own 9 pixels differ in hue by more than EDGE_HUE (a phase edge), where z is off plane z's picture, and the
// globe's rim (RIM, the share of the globe's radius).
// (the limits: HUE_TOL, the largest hue difference, radians, of the globe's pixel from the nearest of z's 9; SAT_MIN, the
// spread between a pixel's largest and smallest channel that makes it coloured; EDGE_HUE, the hue difference, radians,
// among z's 9 pixels from which z is on a phase edge; MAX_BAD, the share of the samples that may be wrong (the flat
// carry suites' bound); MIN_SAMPLES, the samples that must be judged)
// Paths are off: the glide's paths are drawn over the colour, which is what is read.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const HUE_TOL = 0.25, SAT_MIN = 24, EDGE_HUE = 0.15, MAX_BAD = 0.01, MIN_SAMPLES = 300, RIM = 0.9;
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { lpx, bare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
await view(1200, 800, false, false);
const wait = async () => { await settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSphere().running && !__cmwSphere().jobs.length' }); };
const hue = (p) => Math.atan2(Math.sqrt(3) * (p[1] - p[2]), 2 * p[0] - p[1] - p[2]);
const hueD = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const spread = (p) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]);
const ns = 'svsc' + Date.now();
await seed(ns, {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, dc: 'enhanced',
  shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }],
  steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }],
  sv: { at: 1, T: 0 }, srcView: { cx: 0, cy: 0, s: 20 },
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwLPx === 'function' && typeof __cmwGlobeSnap === 'function'` });
await ev(`__cmwSet('morphPaths', false); 1`);
// the globe's pixels: where each is, the plane point w under it, and the point z it came from
const run = async (scope) => {
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere', scope: '${scope}', T: 0 }); __cmwCam('L', { pitch: 0.35, yaw: -0.4 }); 1`); await wait();
// (the globe's last frame drew the carried colour, and no GL frame is pending)
await settled({ max: 30000, until: `!__cmwSteps().moving && GLR.pendingLinks === 0 && __cmwSvGlobe(0, 0).carried` });
const geo = await ev(`(() => { const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), out = []; const g0 = __cmwGlobeSnap('L', r.width / 2, r.height / 2); const R = g0 && g0.R;
  for (let j = 0; j < 40; j++) for (let i = 0; i < 60; i++) { const x = r.width / 2 + (i / 59 - 0.5) * 2 * R * ${RIM}, y = r.height / 2 + (j / 39 - 0.5) * 2 * R * ${RIM}; if (Math.hypot(x - r.width / 2, y - r.height / 2) > R * ${RIM}) continue; const g = __cmwGlobeSnap('L', x, y); if (g && g.g) out.push([x, y, g.g[0], g.g[1]]); }
  return { R, pts: out, dpr: window.devicePixelRatio }; })()`);
ok('the globe is found', geo && geo.R > 50 && geo.pts.length > MIN_SAMPLES, geo && { R: geo.R, n: geo.pts && geo.pts.length });
const got = await ev(`(() => { const c = document.getElementById('canvasL'), x2 = c.getContext('2d'), k = c.width / c.getBoundingClientRect().width, d = x2.getImageData(0, 0, c.width, c.height).data; return ${JSON.stringify(geo.pts)}.map((p) => { const i = Math.floor(p[0] * k), j = Math.floor(p[1] * k), o = 4 * (j * c.width + i); return [d[o], d[o + 1], d[o + 2]]; }); })()`);
// z = i (1 + w) / (1 - w): numerator i (1 + a + i b) = -b + i (1 + a); divided by (1 - a - i b)
const keep = geo.pts.map(([, , a, b]) => scope === 'all' || Math.hypot(a, b) < 0.95);
const Zs = geo.pts.map(([, , a, b]) => { const dn = (1 - a) * (1 - a) + b * b, nr = -b, ni = 1 + a; return [(nr * (1 - a) - ni * b) / dn, (ni * (1 - a) + nr * b) / dn]; });
await ev(`__cmwSteps({ go: 0, now: true, surf: 'plane', scope: 'all', T: 0 }); 1`); await wait();
await settled({ max: 30000, until: `!__cmwSteps().moving && GLR.pendingLinks === 0` });
const ref = (await lpx(Zs)).px;
let n = 0, wrong = 0, paper = 0; const ex = [];
for (let k = 0; k < Zs.length; k++) {
  const r9 = ref[k]; if (!r9 || !keep[k]) continue;
  if (spread(r9[4]) < SAT_MIN) continue;
  const hs = r9.map(hue);
  if (Math.max(...hs.map((h) => hueD(h, hs[4]))) > EDGE_HUE) continue;
  n++;
  const p = got[k];
  if (bare(p)) { paper++; if (ex.length < 5) ex.push({ paper: true, w: geo.pts[k].slice(2).map((v) => +v.toFixed(3)), got: p }); }
  else if (Math.min(...hs.map((h) => hueD(h, hue(p)))) > HUE_TOL) { wrong++; if (ex.length < 5) ex.push({ w: geo.pts[k].slice(2).map((v) => +v.toFixed(3)), got: p, want: r9[4].slice(0, 3) }); }
}
info[scope] = { n, wrong, paper, ex };
ok(`${scope}: the w-globe shows the colour carried from z: enough samples judged`, n >= MIN_SAMPLES, info[scope]);
ok(`${scope}: at most 1 % have the wrong hue or show paper`, wrong + paper <= MAX_BAD * n, info[scope]);
ok(`${scope}: no bare paper where z is coloured`, paper === 0, info[scope]);
};
await run('all');
await run('in');
return { pass: fails.length === 0, fails, info };

// The steps view's carried colour against the exact one (#551): past the colour plane T a plane shows the colour plane's
// colours pushed forward by the points (svCarry, GLR.drawCarried), so a point w of the shown plane a should have the colour
// of one of its preimages in plane T. Over long chains whose inverse lists every preimage (Inverse.pointPre through the
// plan T → a: Möbius maps, powers, roots, log, Joukowski, translations; of exp's and sin's families the members
// m = -6 … 6), at three colour planes each, the plane is drawn
// in the Phase style (the colour of w is the wheel at arg w alone, GLR.phaseRGB's JS twin) and sampled on a grid: each
// sample whose preimages all lie where the colour changes slowly must match one of them, and a sample with a preimage
// must not be left blank. A case passes with at most MAX_BAD of its samples wrong.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = { cases: {} };
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MAX_BAD = 0.02;   // the share of a case's samples that may be wrong (antialiased seams, the probe's rounding)
const TOL = 24;         // a channel's distance to the exact colour, in 0-255
const M = (a, b, c, d) => ({ type: 'mobius', params: { a, b, c, d }, on: true });
const P = (n) => ({ type: 'pown', params: { n }, on: true });
const A = (c) => ({ type: 'add', params: { c }, on: true });
const R = (n) => ({ type: 'root', params: { n, cut: 180, k: 0 }, on: true });
const CAY = M('1', '-i', '1', 'i');
const E = { type: 'exp', params: {}, on: true }, SIN = { type: 'sin', params: {}, on: true }, J = { type: 'joukowski', params: {}, on: true };
const CHAINS = {
  'Cayley, cube, exp, Möbius': [CAY, P(3), E, M('1', '-1', '1', '1')],
  'exp, Möbius, square, sin': [E, M('1', '-1', '1', '1'), P(2), SIN],
  'square, log, Cayley, cube, exp': [P(2), { type: 'log', params: { cut: 180, k: 0 }, on: true }, CAY, P(3), E],
  'Joukowski, square, sin, +i, square': [J, P(2), SIN, A('i'), P(2)],
  'Joukowski, square, +i, √, Cayley': [J, P(2), A('i'), R(2), CAY],
  'z/10, square, Cayley, cube': [M('1', '0', '0', '10'), P(2), CAY, P(3)],
  'Cayley, cube, +i/2, square, Möbius': [CAY, P(3), A('0.5i'), P(2), M('1', '-1', '1', '1')],
  'the rabbit, three times': [P(2), A('-0.1226+0.7449i'), P(2), A('-0.1226+0.7449i'), P(2), A('-0.1226+0.7449i')],
};
// (the shown plane sampled against its exact preimages: { considered, wrong, blank, none, unlisted, beyond, beyondWrong,
// rate, ex })
const SAMPLE = `(() => {
    const c = document.getElementById('canvasL'), x = c.getContext('2d'), W = c.width, H = c.height, d = x.getImageData(0, 0, W, H).data;
    const b = c.getBoundingClientRect(), sx = b.width / W, sy = b.height / H, M = __cmwPlaneMenu();
    const NX = 40, NY = 25, m = 48, pts = [], at = [];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const px = Math.round(m + (W - 2 * m) * (i + 0.5) / NX), py = Math.round(m + (H - 2 * m) * (j + 0.5) / NY);
      for (const [ox, oy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) pts.push(M.s2w('L', b.left + (px + ox) * sx, b.top + (py + oy) * sy));
      at.push([px, py]);
    }
    const pre = __cmwSvPre(pts);
    // (the wheel's colour of each preimage once: a sample's preimages and its neighbours' carry it as z[2])
    const col = (z) => z[2] || (z[2] = GLR.phaseRGB(Math.atan2(z[1], z[0]), 0.75).map((v) => v * 255));
    const dist = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
    const near = (zs, z) => { let best = null, bd = Infinity; for (const q of zs) { const e = Math.hypot(q[0] - z[0], q[1] - z[1]); if (e < bd) { bd = e; best = q; } } return best; };
    // (of several preimages the sample must show the front one, by the carry's sheet key, its depth (__cmwSvKey): the
    // exact images' D, the smallest = log2(1 + dist(z, the camera's window) / R) + the sum over the plan's
    // accumulation points p of max(0, log2(rs / |z - p|)); on a tie (D = 0, in the window) the one nearest the
    // window's centre (#551, the carry's key: the principal branch around the view). Within a hair of a
    // tie (a seam between two sheets) either may show)
    const v = M.view('L'), hw = b.width / 2 / v.s, hh = b.height / 2 / v.s, K = __cmwSvKey();
    const Dk = (z) => {
      let D = Math.log2(1 + Math.hypot(Math.max(K.win[0] - z[0], 0, z[0] - K.win[2]), Math.max(K.win[1] - z[1], 0, z[1] - K.win[3])) / K.R);
      for (const p of K.sing) D += Math.max(0, Math.log2(K.rs / Math.max(Math.hypot(z[0] - p[0], z[1] - p[1]), 1e-30)));
      return Math.min(D, 1e6);
    };
    const inWin = (z) => Math.abs(z[0] - v.cx) < 1.5 * hw && Math.abs(z[1] - v.cy) < 1.5 * hh;
    const fronts = (zs) => {
      const cx0 = (K.win[0] + K.win[2]) / 2, cy0 = (K.win[1] + K.win[3]) / 2, rc = (z) => Math.hypot(z[0] - cx0, z[1] - cy0);
      const k = zs.map((z) => [Dk(z), z, rc(z)]).sort((p, q) => p[0] - q[0] || p[2] - q[2]);
      return k.filter((e) => e[0] - k[0][0] < 0.02 && (e[0] > 0 || e[2] - k[0][2] < 0.02 * K.R)).map((e) => e[1]);
    };
    let considered = 0, wrong = 0, blank = 0, none = 0, unlisted = 0, beyond = 0, beyondWrong = 0;
    const ex = [];
    for (let s = 0; s < at.length; s++) {
      const P0 = pre[5 * s];
      if (P0 == null) { unlisted++; continue; }
      if (!P0.length) { none++; continue; }
      const nb = [1, 2, 3, 4].map((k) => pre[5 * s + k]);
      const cand = fronts(P0), inW = cand.filter(inWin);
      // (where the colour changes fast, or a neighbour has another number of preimages: a seam, not a sample)
      if (nb.some((q) => !q || q.length !== P0.length)) continue;
      if (cand.length > 64 || cand.some((z) => nb.some((q) => dist(col(z), col(near(q, z))) > 8))) continue;
      considered++;
      if (!inW.length) beyond++;
      const [px, py] = at[s], o = 4 * (py * W + px), got = [d[o], d[o + 1], d[o + 2]];
      if (cand.some((z) => dist(got, col(z)) <= ${TOL})) continue;
      wrong++;
      if (!inW.length) beyondWrong++;
      const paper = dist(got, [252, 253, 253]) <= 12 || (Math.abs(got[0] - got[1]) + Math.abs(got[1] - got[2]) < 12);
      if (paper) blank++;
      if (ex.length < 3) ex.push({ px, py, got, want: cand.slice(0, 3).map((z) => col(z).map(Math.round)), inW: inW.length });
    }
    return { considered, wrong, blank, none, unlisted, beyond, beyondWrong, rate: considered ? +(wrong / considered).toFixed(4) : null, ex, sv: __cmwSteps().label };
  })()`;
const ns = 'sce' + Date.now();
let n = 0;
for (const [name, steps] of Object.entries(CHAINS)) {
  const last = steps.length, Ts = [...new Set([0, Math.floor(last / 2), last - 1])];
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps, nextId: 50, focus: 0, dc: 'phase', srcView: { cx: 0, cy: 0, s: 90 } };
  const id = ns + (n++);
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${id}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${id}&lang=en&view=steps` }); await sleep(3000);
  await ev(`__cmwSet('dc', 'phase'); 1`);
  for (const T of Ts) {
    // (on the last plane, past the colour plane: asked again until it holds, as a state the page loads late puts the view
    // back on its first plane)
    let there = false;
    for (let i = 0; i < 50 && !there; i++) {
      const sv = await ev('__cmwSteps()');
      there = sv.i === last && sv.T === T && !sv.moving;
      if (!there) { await ev(`__cmwSteps({ T: ${T} }); __cmwSteps({ go: ${last}, now: true }); 1`); await sleep(200); }
    }
    ok(`${name} / T = ${T}: the view is on the last plane`, there, await ev('__cmwSteps()'));
    if (!there) continue;
    // (the carry's program linked, the plane drawn again with it)
    for (let i = 0; i < 100; i++) { if (await ev('GLR.pendingLinks === 0')) break; await sleep(100); }
    await sleep(400);
    await ev(`__cmwSteps({ surf: 'plane' }); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
    const r = await ev(SAMPLE, 120000);
    const key = `${name} / T = ${T}`;
    info.cases[key] = r;
    // (a chain whose preimages here are too many to list, as exp first and sin after it: no samples, said in info)
    if (r && r.unlisted > 500) { r.note = 'the preimages cannot be listed here (more than 512)'; continue; }
    ok(`${key}: the carried colour is the exact one (at most ${MAX_BAD * 100} % of the samples off)`, r.considered >= 100 && r.rate <= MAX_BAD, r);
  }
}
// (perf on #574) a lost GL context: once the browser gives it back, the exact carry draws again, as exact (the last case's
// plane, sampled again)
await ev('(() => { const x = GLR.gl.getExtension("WEBGL_lose_context"); window.__sclc = x; x.loseContext(); return 1; })()');
await sleep(500);
await ev('window.__sclc.restoreContext(); 1');
await sleep(1500);
for (let i = 0; i < 100; i++) { if (await ev('GLR.pendingLinks === 0')) break; await sleep(100); }
await sleep(400);
await ev(`__cmwSteps({ surf: 'plane' }); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
info.restored = await ev(SAMPLE, 120000);
ok('after a lost and restored GL context the carried colour is exact again', info.restored && info.restored.considered >= 100 && info.restored.rate <= MAX_BAD, info.restored);
const all = Object.values(info.cases);
info.summary = `${all.filter((r) => r.considered >= 100 && r.rate <= MAX_BAD).length} of ${all.filter((r) => !r.note).length} cases pass; mean wrong ${(100 * all.reduce((s, r) => s + (r.rate || 0), 0) / all.filter((r) => !r.note).length).toFixed(1)} %`;
info.checks = 'the carried colour past the colour plane against the exact preimages: 8 long chains, 3 colour planes each';
return { pass: fails.length === 0, fails, info };

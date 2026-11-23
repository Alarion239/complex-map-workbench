// The Stack's tubes (19-stack-tubes.js): from the target disc on the glass, a tube per piece of its preimage down to the
// piece's lit patch on the floor, along the straight strands z → F(z). Read from the page (__cmwStack().drawn.tubes), on
// the plan's maps with the disc on w₁ selected on z, at the Stack's opening camera (Tilt):
//  - M1 z², |w − 1| < 0.5: 2 tubes; the −1 tube narrows a third of the way up, labelled
//    "narrows here: F′(−1) = −2, not a join"; the critical point 0 has a dashed strand to its value 0;
//  - M2 Joukowski, |w − 0.6 − 0.5i| < 0.35: 2 tubes, no narrowing, the critical points ±1's strands;
//  - M3 z³ − 1.2z + 0.3, |w − 1.1| < 0.25: 3 tubes, no narrowing, the critical points ±√0.4's strands;
//  - each tube's floor end is on its patch's edge (|F(z) − c| = r) and its glass end on the disc's rim, at F of its floor
//    end; both ends are where the floor's and the glass's maps put them; each piece has its own colour;
//  - the join ring on the glass is dashed in the cut's red (the overlay is red on it);
//  - the tubes' colours keep a 3:1 contrast with the plane in the light and the dark theme;
//  - on a phone (360 × 640) the Stack's Tilt draws the tubes, and M1's label lies inside the plane;
//  - straight down the tubes are not drawn;
//  - timing (reported, not gated): a phone's Tilt turn on M3, the CPU slowed 4×, draws the tubes in at most 4 ms a
//    frame (median) and 8 ms (90th percentile).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LOAD_MS = 40000, READY_MS = 60000;
const fails = [], info = {};
let pass = 0;
const ok = (name, cond, got) => { if (cond) pass++; else fails.push({ name, got }); };
const until = (expr, max = READY_MS) => settled({ until: expr, max });
const frames = () => ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
const DEG = Math.PI / 180;
const MAPS = {
  M1: { steps: [{ type: 'pown', params: { n: 2 }, on: true }], c: [1, 0], r: 0.5, pieces: 2, crit: 1, label: 'narrows here: F′(−1) = −2, not a join', s: 1 / 3 },
  M2: { steps: [{ type: 'joukowski', params: {}, on: true }], c: [0.6, 0.5], r: 0.35, pieces: 2, crit: 2 },
  M3: { steps: [{ type: 'custom', params: { expr: 'z^3-1.2z+0.3' }, on: true }], c: [1.1, 0], r: 0.25, pieces: 3, crit: 2 },
};
const hooked = () => ev('typeof __cmwStack === "function"');
const open = async (m, { w = 1440, h = 900, phone = false, theme = null } = {}) => {
  const ns = `tubes-${Date.now()}`, M = MAPS[m];
  const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'd', kind: 'disc', c: M.c, r: M.r, stage: 1 }], steps: M.steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: phone ? 60 : 110 } };
  await view(w, h, false, phone);
  await nav(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await nav(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await until("typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-plane')", LOAD_MS);
  await until('__cmwSteps().ready.ready && __cmwSteps().i === 0');
  if (theme) { await ev(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)}), 1`); await frames(); }
  await ev(`__cmwSelect('d'); 1`);
  await until(`__cmwShapes().selected === 'd' && typeof __cmwLookDown === 'function' && !!__cmwLookDown()`);
  await ev(`__cmwSteps({ surf: 'stack' }); 1`);
  if (await hooked()) await until(`__cmwSteps().surf === 'stack' && !!__cmwStack().drawn && !!__cmwStack().drawn.tubes`, 20000);
  await frames();
};
const drawn = async () => ((await hooked()) ? (await ev('__cmwStack()')).drawn : null);
// F(z) on the page, and a plane point's place in the pane's css px through a level's map m
const F = (re, im) => ev(`__cmwPlaneMenu().stage(1, ${re}, ${im})`);
const flat = async (re, im) => { const [x, y] = await ev(`__cmwPlaneMenu().w2s('L', ${re}, ${im})`), o = await ev(`(() => { const r = document.getElementById('overlayL').getBoundingClientRect(); return [r.left, r.top]; })()`); return [x - o[0], y - o[1]]; };
const through = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const near = (p, q, tol = 0.75) => !!p && !!q && Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol;
// the WCAG contrast of two #rrggbb colours
const lum = (hx) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

ok('the page has the Stack', await (async () => { await open('M1'); return hooked(); })(), null);
for (const m of ['M1', 'M2', 'M3']) {
  if (m !== 'M1') await open(m);
  const M = MAPS[m], d = await drawn(), T = d && d.tubes;
  info[m] = T && { pieces: T.pieces.length, inks: T.pieces.map((p) => p.ink), labels: T.labels, strands: T.strands.length, fade: T.fade };
  ok(`${m}: a tube per piece (${M.pieces})`, !!T && T.pieces.length === M.pieces, info[m]);
  if (!T) continue;
  ok(`${m}: each piece has its own colour, the violet first`, new Set(T.pieces.map((p) => p.ink)).size === T.pieces.length && T.pieces[0].ink === 5, T.pieces.map((p) => p.ink));
  // the ends: on the floor on the patch's edge, on the glass on the rim at F of the floor end, both where the levels put them
  let onEdge = 0, onRim = 0, atF = 0, floorPx = 0, glassPx = 0, n = 0;
  for (const P of T.pieces) for (const L of P.loops) for (let i = 0; i < L.floor.length; i++) {
    const z = L.floor[i], w = L.glass[i], fz = await F(...z.p);
    n++;
    if (Math.abs(Math.hypot(fz[0] - M.c[0], fz[1] - M.c[1]) - M.r) < 1e-3) onEdge++;
    if (Math.abs(Math.hypot(w.p[0] - M.c[0], w.p[1] - M.c[1]) - M.r) < 1e-3) onRim++;
    if (Math.hypot(fz[0] - w.p[0], fz[1] - w.p[1]) < 1e-9) atF++;
    if (near(through(d.floor, await flat(...z.p)), z.px)) floorPx++;
    if (near(through(d.glass, await flat(...w.p)), w.px)) glassPx++;
  }
  ok(`${m}: every tube's floor end lies on its lit patch's edge (|F(z) − c| = r)`, n > 0 && onEdge === n, { n, onEdge });
  ok(`${m}: every tube's glass end lies on the disc's rim, at F of its floor end`, n > 0 && onRim === n && atF === n, { n, onRim, atF });
  ok(`${m}: the ends are drawn where the floor's and the glass's maps put them`, n > 0 && floorPx === n && glassPx === n, { n, floorPx, glassPx });
  ok(`${m}: a dashed strand from each critical point to its value (${M.crit})`, T.strands.length === M.crit, T.strands);
  if (M.label) ok(`${m}: the narrowing is labelled "${M.label}", a third of the way up`, T.labels.length === 1 && T.labels[0].text === M.label && Math.abs(T.labels[0].s - M.s) < 1e-4, T.labels);
  else ok(`${m}: no narrowing`, T.labels.length === 0, T.labels);
  // the join ring, dashed in the cut's red, on the glass: red-dominant ink at a majority of points round it
  const red = await ev(`(() => {
    const d = __cmwStack().drawn, G = d.glass, c = [${M.c}], o = document.getElementById('overlayL'), dpr = o.width / o.getBoundingClientRect().width, r0 = o.getBoundingClientRect();
    const jr = ${m === 'M1' ? 1 : m === 'M2' ? 0.64 : 0.294};
    let hits = 0;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, p = __cmwPlaneMenu().w2s('L', c[0] + jr * Math.cos(a), c[1] + jr * Math.sin(a)), x = p[0] - r0.left, y = p[1] - r0.top;
      const q = [G[0] * x + G[2] * y + G[4], G[1] * x + G[3] * y + G[5]], px = o.getContext('2d').getImageData(Math.round(q[0] * dpr) - 3, Math.round(q[1] * dpr) - 3, 7, 7).data;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128 && px[i] > px[i + 1] + 60 && px[i] > px[i + 2] + 60) { hits++; break; }
    }
    return hits;
  })()`);
  ok(`${m}: the join ring on the glass is drawn in the cut's red`, red >= 6, red);
}
// the tubes straight down: not drawn, so the frame is Look down's
await open('M1');
if (await hooked()) {
  await ev(`__cmwCam('L', { yaw: 0, pitch: ${90 * DEG} }); 1`);
  await until(`(() => { const d = __cmwStack().drawn; return !!d && d.camera.pitch >= ${90 * DEG} - 1e-9; })()`, 10000);
}
const top = await drawn();
ok('straight down the tubes are not drawn', !!top && top.tubes === null, top && top.tubes);
// the themes: the tubes' colours against the plane
for (const theme of ['light', 'dark']) {
  await open('M1', { theme });
  const d = await drawn(), T = d && d.tubes;
  const cs = T && d.plane ? T.pieces.map((p) => contrast(p.colour, d.plane)) : [];
  info[theme] = { colours: T && T.pieces.map((p) => p.colour), plane: d && d.plane, cs };
  ok(`${theme}: the plane is the ${theme} theme's`, !!d && !!d.plane && (theme === 'dark' ? lum(d.plane) < 0.2 : lum(d.plane) > 0.8), d && d.plane);
  ok(`${theme}: the tubes keep a 3:1 contrast with the plane`, cs.length === 2 && cs.every((x) => x >= 3), info[theme]);
}
// a phone's Tilt
await open('M1', { w: 360, h: 640, phone: true });
const ph = await drawn(), pT = ph && ph.tubes;
const paneW = await ev(`document.getElementById('overlayL').getBoundingClientRect().width`), paneH = await ev(`document.getElementById('overlayL').getBoundingClientRect().height`);
info.phone = { tubes: pT && pT.pieces.length, labels: pT && pT.labels, pane: [paneW, paneH] };
ok('phone: the Stack\'s Tilt draws the tubes', !!pT && pT.pieces.length === 2, info.phone);
ok('phone: the narrowing\'s label lies inside the plane', !!pT && pT.labels.length === 1 && !!pT.labels[0].box && pT.labels[0].box[0] >= 0 && pT.labels[0].box[2] <= paneW && pT.labels[0].box[1] >= 0 && pT.labels[0].box[3] <= paneH, info.phone);

// the tubes' cost a frame while a phone's Tilt turns (M3, the CPU slowed 4×, as the perf suite's phone): reported, not
// gated (ci/browser_suites.js TIMING)
await open('M3', { w: 360, h: 640, phone: true });
const ms = [];
if (await hooked()) {
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (let i = 0; i < 24; i++) {
    await ev(`__cmwCam('L', { yaw: ${-30 * DEG} + ${i} * ${15 * DEG}, pitch: ${(20 + (i % 6) * 8) * DEG} }); 1`);
    await frames();
    const d = await drawn();
    if (d && d.tubes && d.tubes.ms != null) ms.push(d.tubes.ms);
  }
  await send('Emulation.setCPUThrottlingRate', { rate: 1 });
}
info.costEach = ms.map((x) => +x.toFixed(1));
ms.sort((a, b) => a - b);
const med = ms.length ? ms[ms.length >> 1] : null, p90 = ms.length ? ms[Math.floor(ms.length * 0.9)] : null;
info.cost = { frames: ms.length, med, p90, worst: ms.length ? ms[ms.length - 1] : null };
ok('timing: a phone\'s Tilt turn draws M3\'s tubes in at most 4 ms a frame (median) and 8 ms (90th percentile)', ms.length === 24 && med <= 4 && p90 <= 8, info.cost);

return { pass: fails.length === 0, passed: pass, fails, info };

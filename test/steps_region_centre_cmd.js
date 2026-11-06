// A region fill's carried colour is read at the pixel centre off the branch cuts (issue #966, GLR.drawRegion with
// st.carry): with the places the identity (the grid's own plane s), the fill of a disc is the colour plot of the map from
// s to T (GLR.drawColorPlot, {a: s, b: T}) pixel for pixel, inside the disc: the pixels along the fill's interior
// triangle edges too, where the point read at the centroid of the covered samples would be up to half a pixel off, a
// full colour step on a colour line. At most FRAC of the disc's pixels more than TOL levels apart. The chains are
// steps_carry_cmd.js's (the examples 1, 5, 8, 26 at s = 0, T = 1 and 2).
// And on chains with a cut: the steps view's glide frame at u = 0.5 drawn by the carried mesh (__cmwSteps({ mesh })) against the
// exact picture at the same u (the inverse pass), the colour layer alone (__cmwSteps({ bare })), in the same measure, the
// pixels within CUT_PX of the cut's image left out: Square root and its sheets, the Logarithm of an annulus.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const TOL = 6, FRAC = 0.002;
await view(1200, 800, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=regcentre${Date.now()}` });
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof GLR === "object" && typeof Region === "object"' });
const CASES = typeof RC_CASES !== 'undefined' ? RC_CASES : [[1, 1], [5, 1], [8, 2], [26, 2]];
for (const [ex, T] of CASES) {
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000 });
  const rr = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const W = 240, H = 160, v = { cx: 0.13, cy: -0.07, s: 40 }, R = 1.7;
    const st = { view: v, dpr: 1, style: 'enhanced', sectors: 12, grid: 0.5, plane: [0.99, 0.99, 0.99], ink: [0.07, 0.1, 0.12], dark: false };
    const win = { x0: v.cx - W / v.s, x1: v.cx + W / v.s, y0: v.cy - H / v.s, y1: v.cy + H / v.s };
    const res = GLR.createMesh(Region.meshInstances(Region.buildMesh({ kind: 'disc', c: [v.cx, v.cy], r: R }, win, 48)));
    const cv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const a = cv(), b = cv();
    for (let i = 0; i < 480; i++) {
      GLR.begin(W, H);
      GLR.drawRegion(res, Object.assign({ map: { mode: 0, a: 0, b: 0 }, L: 4, carry: { s: 0, T: ${T}, style: st.style, sectors: st.sectors, grid: st.grid, plane: st.plane, ink: st.ink, dark: st.dark }, sync: true, cacheKey: null }, st));
      GLR.blit(a.getContext('2d'));
      GLR.begin(W, H);
      GLR.drawColorPlot(Object.assign({ map: { mode: 0, a: 0, b: ${T} }, cauchy: null }, st));
      GLR.blit(b.getContext('2d'));
      if (!GLR.pendingLinks) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const pa = a.getContext('2d').getImageData(0, 0, W, H).data, pb = b.getContext('2d').getImageData(0, 0, W, H).data;
    let max = 0, over = 0, n = 0, blank = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = v.cx + (x + 0.5 - W / 2) / v.s, wy = v.cy - (y + 0.5 - H / 2) / v.s;
      if (Math.hypot(wx - v.cx, wy - v.cy) > R - 3 / v.s) continue;
      const i = 4 * (y * W + x);
      n++;
      if (pa[i + 3] === 0) blank++;
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
      max = Math.max(max, d); if (d > ${TOL}) over++;
    }
    return { max, over: +(over / n).toFixed(4), n, blank };
  })()` });
  const r = rr.exceptionDetails ? { err: rr.exceptionDetails.exception && rr.exceptionDetails.exception.description } : rr.result.value;
  info[`ex${ex} T${T}`] = r;
  ok(`ex ${ex}, T ${T}: the disc is drawn`, r.n > 5000 && r.blank === 0, r);
  ok(`ex ${ex}, T ${T}: the fill is the colour plot of {a: s, b: T} pixel for pixel, at most ${FRAC * 100} % of the pixels more than ${TOL} levels off`, r.over <= FRAC, r);
}

// chains with a cut: the carried mesh's frame against the exact picture
const CUT_PX = 10;
const CUTS = [
  { example: 'Square root and its sheets', points: `(() => { const P = []; for (const a of [135, 225]) for (let q = 0; q < 4000; q++) { const t = a * Math.PI / 180, r = 8 * q / 4000; P.push([r * Math.cos(t), r * Math.sin(t)]); } return P; })()` },
  { example: 'Logarithm of an annulus', points: `(() => { const P = [], s = 0.5; for (const g of [1, -1]) for (let q = 0; q < 20000; q++) { const r = Math.exp(-12 + 24 * q / 20000), ph = g * Math.PI * s; P.push([(Math.pow(r, s) * Math.cos(ph) - 1) / s + s, Math.pow(r, s) * Math.sin(ph) / s]); } return P; })()` },
];
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
for (const c of CUTS) {
  const ex = names.indexOf(c.example);
  ok(`${c.example}: the example is found`, ex >= 0, names.length);
  if (ex < 0) continue;
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=regcut${Date.now()}` });
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function"' });
  await ev(`__cmwExample(${ex}); 1`); await settled({ max: 20000 });
  // (the frame drawn: two reads of the left pane 200 ms apart agree, programs linked)
  const drawn = async () => { for (let n = 0; n < 150; n++) { await settled({ max: 20000 }); const same = await ev(`(() => { const cv = document.getElementById('canvasL'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) | 0; const same = window.__cutH === h; window.__cutH = h; return same; })()`); if (same) return true; await sleep(200); } return false; };
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); __cmwSteps({ scope: 'all', surf: 'plane', park: 0.5 }); 1`);
  ok(`${c.example}: the exact frame is drawn`, await drawn(), null);
  const exact = await ev('__cmwSteps().glide.path');
  await ev(`(() => { const cv = document.getElementById('canvasL'); window.__exactFrame = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height); return 1; })()`);
  await ev('__cmwSteps({ mesh: true }); 1');
  ok(`${c.example}: the mesh frame is drawn`, await drawn(), null);
  const mesh = await ev('__cmwSteps().glide.path');
  const r = await ev(`(() => {
    const cv = document.getElementById('canvasL'), rc = cv.getBoundingClientRect(), k = cv.width / rc.width, W = cv.width, H = cv.height, M = cv.getContext('2d').getImageData(0, 0, W, H).data, E = window.__exactFrame.data;
    const mask = new Uint8Array(W * H);
    for (const [re, im] of ${c.points}) { const p = __cmwW2S('L', re, im), x = Math.round((p[0] - rc.left) * k), y = Math.round((p[1] - rc.top) * k);
      for (let dy = -${CUT_PX}; dy <= ${CUT_PX}; dy++) for (let dx = -${CUT_PX}; dx <= ${CUT_PX}; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) mask[Y * W + X] = 1; } }
    let n = 0, over = 0, max = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = 4 * (y * W + x); if (mask[y * W + x]) continue;
      if (E[i] > 250 && E[i + 1] > 250 && E[i + 2] > 250 && M[i] > 250 && M[i + 1] > 250 && M[i + 2] > 250) continue;
      const d = Math.max(Math.abs(E[i] - M[i]), Math.abs(E[i + 1] - M[i + 1]), Math.abs(E[i + 2] - M[i + 2]));
      n++; max = Math.max(max, d); if (d > ${TOL}) over++;
    }
    return { n, max, over: +(over / n).toFixed(4) };
  })()`);
  r.paths = [exact, mesh];
  info[c.example] = r;
  ok(`${c.example}: the two frames are the inverse pass's and the carried mesh's`, exact === 'inverse' && mesh === 'mesh', r);
  ok(`${c.example}: the carried mesh's frame is the exact picture, at most ${FRAC * 100} % of the pixels more than ${TOL} levels off`, r.n > 5000 && r.over <= FRAC, r);
}
return { pass: fails.length === 0, fails, info };

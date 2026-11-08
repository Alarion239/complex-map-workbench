// A region fill's carried colour is read at the pixel centre off the branch cuts (issue #966, GLR.drawRegion with
// st.carry): with the places the identity (the grid's own plane s), the fill of a disc is the colour plot of the map from
// s to T (GLR.drawColorPlot, {a: s, b: T}) pixel for pixel, inside the disc: the pixels along the fill's interior
// triangle edges too, where the point read at the centroid of the covered samples would be up to half a pixel off, a
// full colour step on a colour line. At most FRAC of the disc's pixels more than TOL levels apart. The chains are
// steps_carry_cmd.js's (the examples 1, 5, 8, 26 at s = 0, T = 1 and 2). The control: the same fill against the colour plot
// one step earlier is far over FRAC, so the comparison is not vacuous.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (TOL levels of 255 per channel and FRAC of the pixels: the rasterization bounds, the measured floor of the centre read on the
// four chains; the centroid read puts several per cent of the pixels over TOL, CONTROL_MIN_FRAC the share a wrong T must reach)
const TOL = 6, FRAC = 0.002, CONTROL_MIN_FRAC = 0.05;
// (W x H the canvas in px, s px per unit, R the disc's radius; the disc's pixels within EDGE_MARGIN_PX of its boundary are left
// out; MIN_PIXELS the least pixel count inside it; MESH_RES the mesh's cells across; the frames wait for the programs to link:
// at most MAX_FRAMES, FRAME_GAP_MS apart)
const W = 240, H = 160, VIEW = { cx: 0.13, cy: -0.07, s: 40 }, R = 1.7, EDGE_MARGIN_PX = 3, MIN_PIXELS = 5000, MESH_RES = 48, MAX_FRAMES = 480, FRAME_GAP_MS = 250;
await view(1200, 800, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=regcentre${Date.now()}` });
await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof GLR === "object" && typeof Region === "object"' });
const CASES = [[1, 1], [5, 1], [8, 2], [26, 2]];
// (the fill carries Tfill, the colour plot it is compared with is at Tplot)
const compare = async (Tfill, Tplot) => {
  const rr = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const W = ${W}, H = ${H}, v = ${JSON.stringify(VIEW)}, R = ${R};
    const st = { view: v, dpr: 1, style: 'enhanced', sectors: 12, grid: 0.5, plane: [0.99, 0.99, 0.99], ink: [0.07, 0.1, 0.12], dark: false };
    const win = { x0: v.cx - W / v.s, x1: v.cx + W / v.s, y0: v.cy - H / v.s, y1: v.cy + H / v.s };
    const res = GLR.createMesh(Region.meshInstances(Region.buildMesh({ kind: 'disc', c: [v.cx, v.cy], r: R }, win, ${MESH_RES})));
    const cv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const a = cv(), b = cv();
    for (let i = 0; i < ${MAX_FRAMES}; i++) {
      GLR.begin(W, H);
      GLR.drawRegion(res, Object.assign({ map: { mode: 0, a: 0, b: 0 }, L: 4, carry: { s: 0, T: ${Tfill}, style: st.style, sectors: st.sectors, grid: st.grid, plane: st.plane, ink: st.ink, dark: st.dark }, sync: true, cacheKey: null }, st));
      GLR.blit(a.getContext('2d'));
      GLR.begin(W, H);
      GLR.drawColorPlot(Object.assign({ map: { mode: 0, a: 0, b: ${Tplot} }, cauchy: null }, st));
      GLR.blit(b.getContext('2d'));
      if (!GLR.pendingLinks) break;
      await new Promise((r) => setTimeout(r, ${FRAME_GAP_MS}));
    }
    const pa = a.getContext('2d').getImageData(0, 0, W, H).data, pb = b.getContext('2d').getImageData(0, 0, W, H).data;
    let max = 0, over = 0, n = 0, blank = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = v.cx + (x + 0.5 - W / 2) / v.s, wy = v.cy - (y + 0.5 - H / 2) / v.s;
      if (Math.hypot(wx - v.cx, wy - v.cy) > R - ${EDGE_MARGIN_PX} / v.s) continue;
      const i = 4 * (y * W + x);
      n++;
      if (pa[i + 3] === 0) blank++;
      const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
      max = Math.max(max, d); if (d > ${TOL}) over++;
    }
    return { max, over: +(over / n).toFixed(4), n, blank };
  })()` });
  return rr.exceptionDetails ? { err: rr.exceptionDetails.exception && rr.exceptionDetails.exception.description } : rr.result.value;
};
for (const [ex, T] of CASES) {
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000 });
  const r = await compare(T, T);
  info[`ex${ex} T${T}`] = r;
  ok(`ex ${ex}, T ${T}: the disc is drawn`, r.n > MIN_PIXELS && r.blank === 0, r);
  ok(`ex ${ex}, T ${T}: the fill is the colour plot of {a: s, b: T} pixel for pixel, at most ${FRAC * 100} % of the pixels more than ${TOL} levels off`, r.over <= FRAC, r);
  const c = await compare(T, T - 1);
  info[`ex${ex} T${T} control`] = c;
  ok(`ex ${ex}, T ${T} (control): against the colour plot at T - 1 more than ${CONTROL_MIN_FRAC * 100} % of the pixels are over ${TOL} levels`, c.over > CONTROL_MIN_FRAC, c);
}
return { pass: fails.length === 0, fails, info };

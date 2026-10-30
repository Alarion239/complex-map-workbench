// The steps view's carried colour on the GPU (issue #439, GLR.drawCarried): with the places the identity (the plane
// a the grid's own plane s), each fragment is the colour plane's colour of its point, so the picture is the colour
// plot of the map from s to T (GLR.drawColorPlot, {a: s, b: T}), pixel for pixel up to the grid's interpolation of
// the point (a few ulps), for every s <= T of a few chains: one step, two steps, a d/dz-free formula, the Mountain
// King. And the program is ready: drawCarried draws (it returns false while the program compiles).
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/steps_carry_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?view=steps&ns=carry${Date.now()}` }); await sleep(2300);
for (let i = 0; i < 120 && !(await ev('typeof __cmwExample === "function" && typeof GLR === "object"').catch(() => false)); i++) await sleep(250);
// [example index, its steps]
const CASES = typeof SC_CASES !== 'undefined' ? SC_CASES : [[1, 2], [5, 1], [8, 2], [26, 2], [17, 2]];
for (const [ex, n] of CASES) {
  await ev(`__cmwExample(${ex}); 1`);
  await sleep(1500);
  for (let s = 0; s <= n; s++) for (let T = s; T <= n; T++) {
    // (until both programs are ready: each draw returns false while its program compiles)
    const rr = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const W = 240, H = 160, v = { cx: 0.13, cy: -0.07, s: 40 }, st = { view: v, dpr: 1, style: 'enhanced', sectors: 12, grid: 0.5, plane: [0.99, 0.99, 0.99], ink: [0.07, 0.1, 0.12], dark: false };
      const cv = (k) => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
      const a = cv(), b = cv();
      for (let i = 0; i < 2400; i++) {
        GLR.begin(W, H);
        const ok1 = GLR.drawCarried(Object.assign({ map: { mode: 0, a: ${s}, b: ${s} }, s: ${s}, T: ${T}, lim: 1e30,
          mesh: { x0: v.cx - W / v.s, y0: v.cy - H / v.s, dx: 2 * W / v.s / 96, dy: 2 * H / v.s / 64, nx: 96, ny: 64 } }, st));
        if (ok1) GLR.blit(a.getContext('2d'));
        GLR.begin(W, H);
        GLR.drawColorPlot(Object.assign({ map: { mode: 0, a: ${s}, b: ${T} }, cauchy: null }, st));
        GLR.blit(b.getContext('2d'));
        if (ok1 && !GLR.pendingLinks) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      const pa = a.getContext('2d').getImageData(0, 0, W, H).data, pb = b.getContext('2d').getImageData(0, 0, W, H).data;
      let max = 0, over = 0, n = 0, blank = 0;
      for (let i = 0; i < pa.length; i += 4) {
        n++;
        if (pa[i + 3] === 0) blank++;
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        max = Math.max(max, d); if (d > 6) over++;
      }
      return { max, over: +(over / n).toFixed(4), blank };
    })()` });
    const r = rr.exceptionDetails ? { err: rr.exceptionDetails.exception && rr.exceptionDetails.exception.description } : rr.result.value;
    info[`ex${ex} s${s} T${T}`] = r;
    ok(`ex ${ex}, s ${s}, T ${T}: drawn (the program ready)`, r.blank === 0, r);
    // (an edge of a phase sector or a contour that falls between two pixels' rounding: a few pixels)
    ok(`ex ${ex}, s ${s}, T ${T}: the colour plot of {a: s, b: T}, pixel for pixel`, r.over <= 0.002, r);
  }
}
return { pass: fails.length === 0, fails, info };

// The Cauchy style's carried colour (GLR.drawCarried with the style's residue data, the chain's length as T of the Cauchy
// integral): the carried colour of the points of plane z is the Cauchy integral's colour of F = z + 1/z over the unit
// circle at each point, so with the places the identity it is the exact plot of the style on plane z (GLR.drawColorPlot of the
// same data), pixel for pixel up to the grid's interpolation of the point, for Both, Inside and Outside. Without residue
// data the carried colour stays the stages' colour.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PNG = process.mainModule.require(path.join(DIR, 'png.js'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// a pixel differs when a channel is off by more than this (of 255): the edge of a phase sector falling between two pixels' rounding
const PIXEL_TOL = 6;
// the share of pixels that may differ by more than PIXEL_TOL: those on an edge of a sector or of the curve
const EDGE_SHARE_MAX = 0.002;
// a colour pixel has channels that differ by more than this (of 255); a coloured reference has more than COLOUR_SHARE_MIN of them
const COLOUR_CHANNEL_GAP = 20, COLOUR_SHARE_MIN = 0.05;
// the plot's show settings as the residue data carries them: Both and Inside
const SHOW_BOTH = 0, SHOW_IN = 1;
// a wrong reference must differ from the carried colour on more than this share of pixels, far above EDGE_SHARE_MAX
const CONTROL_SHARE_MIN = 0.05;
// the pixel comparison's frame: its size in px and the carried mesh's cells across and down
const FRAME_W = 240, FRAME_H = 160, MESH_NX = 96, MESH_NY = 64;
// the shaders link in the background: the frame is drawn again every LINK_POLL_MS until they are linked, at most LINK_POLL_MAX times
const LINK_POLL_MS = 250, LINK_POLL_MAX = 480;
// the page's bounds for a ready page and for the view to settle, and the window's size
const PAGE_READY_MS = 30000, SETTLE_MS = 15000, WIN_W = 1200, WIN_H = 800;
const state = { shapes: [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }], steps: [{ type: 'custom', params: { expr: 'z+\\frac{1}{z}', cut: 180 }, on: true }], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc: 'cauchy', alpha: 1 };
await view(WIN_W, WIN_H, false, false);
const ns = 'cauchycarry' + Date.now();
await load(ns, state);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
await settled({ until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 0 && typeof GLR === "object"', max: PAGE_READY_MS });
await ev(`__cmwSelect('s1'); 1`);
await settled({ until: '!__cmwSteps().moving', max: SETTLE_MS });
for (const show of ['both', 'in', 'out']) {
  await ev(`__cmwCauchyOpt('${show}', true)`);
  const rr = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const W = ${FRAME_W}, H = ${FRAME_H}, v = { cx: 0.13, cy: -0.07, s: 70 }, cz = __cmwCauchyCarry();
    if (!cz) return { err: 'no residue data' };
    const st = { view: v, dpr: 1, style: 'cauchy', sectors: 12, grid: 0.5, plane: [0.99, 0.99, 0.99], ink: [0.07, 0.1, 0.12], dark: false };
    const cv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const a = cv(), b = cv(), c = cv();
    for (let i = 0; i < ${LINK_POLL_MAX}; i++) {
      GLR.begin(W, H);
      const ok1 = GLR.drawCarried(Object.assign({ map: { mode: 0, a: 0, b: 0 }, s: 0, T: 1, lim: 1e30, cauchy: cz,
        mesh: { x0: v.cx - W / v.s, y0: v.cy - H / v.s, dx: 2 * W / v.s / ${MESH_NX}, dy: 2 * H / v.s / ${MESH_NY}, nx: ${MESH_NX}, ny: ${MESH_NY} } }, st));
      if (ok1) GLR.blit(a.getContext('2d'));
      GLR.begin(W, H);
      GLR.drawColorPlot(Object.assign({ map: { mode: 0, a: 0, b: 1 }, cauchy: cz }, st));
      GLR.blit(b.getContext('2d'));
      GLR.begin(W, H);
      GLR.drawColorPlot(Object.assign({ map: { mode: 0, a: 0, b: 1 }, cauchy: Object.assign({}, cz, { show: cz.show === ${SHOW_BOTH} ? ${SHOW_IN} : ${SHOW_BOTH} }) }, st));
      GLR.blit(c.getContext('2d'));
      if (ok1 && !GLR.pendingLinks) break;
      await new Promise((r) => setTimeout(r, ${LINK_POLL_MS}));
    }
    const pa = a.getContext('2d').getImageData(0, 0, W, H).data, pb = b.getContext('2d').getImageData(0, 0, W, H).data, pc = c.getContext('2d').getImageData(0, 0, W, H).data;
    let over = 0, wrong = 0, n = 0, blank = 0, colour = 0;
    for (let i = 0; i < pa.length; i += 4) {
      n++;
      if (pa[i + 3] === 0) blank++;
      if (Math.abs(pb[i] - pb[i + 1]) > ${COLOUR_CHANNEL_GAP} || Math.abs(pb[i + 1] - pb[i + 2]) > ${COLOUR_CHANNEL_GAP}) colour++;
      if (Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2])) > ${PIXEL_TOL}) over++;
      if (Math.max(Math.abs(pa[i] - pc[i]), Math.abs(pa[i + 1] - pc[i + 1]), Math.abs(pa[i + 2] - pc[i + 2])) > ${PIXEL_TOL}) wrong++;
    }
    return { over: +(over / n).toFixed(4), wrong: +(wrong / n).toFixed(4), blank, colour: +(colour / n).toFixed(3), show: cz.show };
  })()` });
  const r = rr.exceptionDetails ? { err: rr.exceptionDetails.exception && rr.exceptionDetails.exception.description } : rr.result.value;
  info[show] = r;
  ok(`${show}: drawn (the program ready)`, r && r.blank === 0, r);
  ok(`${show}: the reference plot is coloured (the check is not between two blanks)`, r && r.colour > COLOUR_SHARE_MIN, r);
  ok(`${show}: the carried colour is the plot of the style on plane z, pixel for pixel`, r && r.over <= EDGE_SHARE_MAX, r);
  // negative control: the same comparison against the plot of another show setting (the other side of the curve coloured) must fail
  ok(`${show}: negative control: the plot of another show setting is not the carried colour`, r && r.wrong > CONTROL_SHARE_MIN, r);
}
// (Outside is the sharp case: F(z0) at an outside point is the colour of f₋ there, not the plain colour of F)
// (alpha 1: the sheet is opaque, so its pixels are the carried colour and not a blend with the plane behind it)
// the steps view itself: with the colour plane z and the thread parked at plane 1, the point F(z0) of plane 1 has the colour that z0 has on plane z
// (inside the circle coloured, outside the circle coloured, for Both); the pane's pixels at two points compared plane against plane
const pixel = async (x, y) => {
  const r = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  const png = PNG(Buffer.from(s.data, 'base64'));
  const p = await ev(`(() => { const p = __cmwW2S('L', ${x}, ${y}), r = document.getElementById('canvasL').getBoundingClientRect(); return [p[0] - r.left, p[1] - r.top]; })()`);
  return png.at(Math.round(p[0]), Math.round(p[1]));
};
const parkAt = async (g) => {
  await ev(`(__cmwSteps({ T: 0, go: ${g}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${g}`, max: SETTLE_MS });
};
// F(z) = z + 1/z at two points of plane z, 0.55 + 0.3i inside the circle and 1.9 + 0.45i outside it. F takes z and 1/z to the same
// point, so the point F(z0) of plane 1 carries the colour of whichever of the two the front sheet holds: the colour z0 has on plane z or
// the colour 1/z0 has there
const F = ([x, y]) => { const d = x * x + y * y; return [x + x / d, y - y / d]; };
const inv = ([x, y]) => { const d = x * x + y * y; return [x / d, -y / d]; };
const near = (p, q) => Math.max(...p.slice(0, 3).map((c, k) => Math.abs(c - q[k]))) <= PIXEL_TOL * 2;
for (const [show, z0] of [['both', [0.55, 0.3]], ['both', [1.9, 0.45]], ['out', [1.9, 0.45]], ['in', [0.55, 0.3]]]) {
  await ev(`__cmwCauchyOpt('${show}', true)`);
  await parkAt(0);
  const onZ = await pixel(z0[0], z0[1]), onZ2 = await pixel(...inv(z0));
  await parkAt(1);
  const onW = await pixel(...F(z0));
  info[show + ' z ' + z0] = { onZ, onZ2, onW, carry: await ev('JSON.stringify((() => { const c = __cmwCauchyCarry(); return c && { T: c.T, show: c.show, edges: c.edges.length }; })())'), steps: await ev('JSON.stringify(__cmwSteps().glide || null)') };
  ok(`${show}, z0 = ${z0}: the colour of F(z0) on plane 1 is the colour of z0 or of 1/z0 on plane z`, near(onZ, onW) || near(onZ2, onW), info[show + ' z ' + z0]);
  // negative control: i·z0 is a quarter turn from z0 (a different phase, in the same part of the plane), so the colour of F(z0)
  // is not its colour on plane z
  await parkAt(0);
  const turned = await pixel(-z0[1], z0[0]);
  ok(`${show}, z0 = ${z0}: negative control: the colour of F(z0) is not the colour of i·z0 on plane z`, !near(turned, onW), { turned, onW });
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error' || x.t === 'warn') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors or warnings', !errs.length, errs.slice(0, 4).map((x) => String(x.m).slice(0, 300)));
return { pass: fails.length === 0, fails, info };

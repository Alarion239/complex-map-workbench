// A cut whose image winds round a circle (z^i, cut 180°: the ray's bank traces the circle |w| = e^-π over and over as
// r → 0) strokes the dashed bank's turns once, so the ring keeps its dash gaps at every view: laying the [6, 4] pattern
// over each turn from its own phase (a shift of the circle's length mod 10 px per turn) fills the gaps at some scales.
// Plane w₁, the view zoomed so the ring is a circle of 60 to 100 px; the cut ink is sampled at 360 points round the ring.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const RING = Math.exp(-Math.PI);          // |w| of the dashed bank's circle
const SCALES = [1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950, 2000, 2100, 2200];   // px per unit
const MIN_GAP = 0.2;                      // the share of the ring's points with no ink: the pattern leaves 4 px in 10
await view(1200, 800, false, false);
const J = (e) => ev(`(${e})`);
const ring = async (s) => {
  const ns = 'cutring' + Date.now() + Math.floor(Math.random() * 1e6);
  await loadView('steps', ns, { srcView: { cx: 0, cy: 0, s }, shapes: [], steps: [{ type: 'powa', params: { alpha: 'i', cut: 180 }, on: true }], height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwCutCurves().length > 0' });
  return J(`(() => {
    const c = document.getElementById('canvasL'), s = document.createElement('canvas'), k = c.width / c.getBoundingClientRect().width;
    s.width = c.width; s.height = c.height;
    const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
    const r = c.getBoundingClientRect(), cx = r.width / 2, cy = r.height / 2, R = ${RING} * ${s}, ink = [204, 51, 17];
    let n = 0, hit = 0;
    for (let i = 0; i < 360; i++) {
      const a = i * Math.PI / 180;
      let on = false;
      // (the pixels across the stroke, along the radius: a window along the arc would close the dashes' gaps)
      for (const dr of [-1, 0, 1]) {
        const x = Math.round((cx + (R + dr) * Math.cos(a)) * k), y = Math.round((cy + (R + dr) * Math.sin(a)) * k);
        const d = g.getImageData(x, y, 1, 1).data;
        if (Math.abs(d[0] - ink[0]) < 40 && Math.abs(d[1] - ink[1]) < 40 && Math.abs(d[2] - ink[2]) < 40) on = true;
      }
      n++; if (on) hit++;
    }
    return { n, hit, R };
  })()`);
};
for (const s of SCALES) {
  const r = await ring(s);
  info['s' + s] = r;
  ok(`scale ${s}: the dashed ring is drawn`, r.hit > 60, r);
  ok(`scale ${s}: the dashed ring keeps its gaps (${MIN_GAP} of its points with no ink)`, r.hit / r.n < 1 - MIN_GAP, r);
}
const lg = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', lg.length === 0, lg);
return { pass: fails.length === 0, fails, info };

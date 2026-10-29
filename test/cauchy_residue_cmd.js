// The Cauchy style by the residue theorem (issue #235), in the real app: the plot of Φ = n F − Σ n PP from the poles
// inside the curve, its pixels against the quadrature's where both hold, its exact neutral outside for a hand-drawn
// curve, and the fallback to the quadrature where the theorem does not apply.
//   A  F = z + 1/z over the unit circle (a pole inside, f₊ = z, f₋ = 1/z): the plan (one simple pole at 0, n = 1);
//      with the outside shown as the integral (cauchyPlus) every pixel inside and outside the curve equals the
//      quadrature's, but the pixels at the curve (anti-aliasing); Inside only greys the outside, Outside only the inside
//   B  F = z over a hand-drawn wobbly curve (600 vertices): no pole, F inside, the outside exactly neutral (the
//      quadrature leaves a coloured residue there); a hand-drawn curve with F = 1/z: the formula holds
//   C  F = e^(1/z): an essential singularity, the formula is unverified, the quadrature draws (and says so)
//   D  a pole on the curve: not available (no formula)
// A command file for the CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PNG = process.mainModule.require(path.join(DIR, 'png.js'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const errs = (l) => l.filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource|favicon/.test(x.m || ''));
const WOB = Array.from({ length: 600 }, (_, i) => { const t = 2 * Math.PI * i / 600, r = 1 + 0.12 * Math.sin(3 * t) + 0.006 * Math.sin(97 * t); return [r * Math.cos(t), r * Math.sin(t)]; });
const stateOf = (shapes, steps) => ({ shapes, steps, srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker' });
const CIRCLE = [{ id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true }];
const CURVE = [{ id: 's1', kind: 'polygon', pts: WOB, ci: 0, visible: true }];   // (the Lasso's region: a closed polygon of its stroke)
const custom = (expr) => [{ type: 'custom', params: { expr, cut: 180 }, on: true }];
const open = async (shapes, steps) => {
  await view(1440, 900, false, false);
  await load('cr' + Date.now() + Math.floor(Math.random() * 1000), stateOf(shapes, steps));
  await settle(1200);
  await ev(`__cmwSetMain('phase'); __cmwSelect('s1'); document.querySelector('[id="dcSeg"] [data-v="cauchy"]').click(); 1`);
  await settle(1500);
};
// the plane's pixels (the left pane's canvas box), as PNG data
const rectL = () => ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const pic = async () => { const r = await rectL(); const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } }); return PNG(Buffer.from(s.data, 'base64')); };
const W2P = (re, im) => ev(`(() => { const p = __cmwW2S('L', ${re}, ${im}), r = document.getElementById('canvasL').getBoundingClientRect(); return [p[0] - r.left, p[1] - r.top]; })()`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const isGrey = (c) => Math.abs(c[0] - c[1]) < 14 && Math.abs(c[1] - c[2]) < 14;

// ---- A: z + 1/z over the unit circle
await open(CIRCLE, custom('z+\\frac{1}{z}'));
let cz = await ev('__cmwCauchy()');
info.A = cz;
ok('A the formula holds: one simple pole at 0 inside, n = 1', cz && cz.formula && cz.poles.length === 1 && cz.poles[0].order === 1 && cz.poles[0].n === 1 && Math.abs(cz.poles[0].z[0]) < 1e-9 && Math.abs(cz.poles[0].z[1]) < 1e-9, cz);
await ev('__cmwCauchyOpt("both", true)'); await settle();
const a1 = await pic();
await ev('__cmwCauchyQuad(true)'); await settle();
const a2 = await pic();
await ev('__cmwCauchyQuad(false)'); await settle();
// the pixels away from the curve (more than 4 px from the circle of radius 1 → 110 px) and away from the pole's neighbourhood
const c0 = await W2P(0, 0), R = 110, step = 7;
let bad = 0, tested = 0;
for (let y = 3; y < a1.h; y += step) for (let x = 3; x < a1.w; x += step) {
  const d = Math.hypot(x - c0[0], y - c0[1]);
  if (Math.abs(d - R) < 6 || d < 12) continue;
  tested++;
  if (dist(a1.at(x, y), a2.at(x, y)) > 40) bad++;
}
info.A_cmp = { tested, bad };
ok('A the residue picture equals the quadrature picture away from the curve (outside as the integral)', tested > 1500 && bad <= tested * 0.01, info.A_cmp);
// both halves, f₋ outside (the default): the outside is 1/z's phase, the inside z's
await ev('__cmwCauchyOpt("both", false)'); await settle();
const a3 = await pic();
const inP = [c0[0] + 0.5 * R, c0[1]], outP = [c0[0] + 1.7 * R, c0[1] - 0.4 * R];
await ev('__cmwCauchyOpt("in", false)'); await settle();
const a4 = await pic();
await ev('__cmwCauchyOpt("out", false)'); await settle();
const a5 = await pic();
ok('A Inside only: the outside is grey, the inside is not', isGrey(a4.at(outP[0], outP[1])) && !isGrey(a4.at(inP[0], inP[1])), [a4.at(outP[0], outP[1]), a4.at(inP[0], inP[1])]);
ok('A Outside only: the inside is grey, the outside is not', isGrey(a5.at(inP[0], inP[1])) && !isGrey(a5.at(outP[0], outP[1])), [a5.at(inP[0], inP[1]), a5.at(outP[0], outP[1])]);
ok('A Both = the two halves', dist(a3.at(outP[0], outP[1]), a5.at(outP[0], outP[1])) < 3 && dist(a3.at(inP[0], inP[1]), a4.at(inP[0], inP[1])) < 3, null);
ok('A the integral and f₋ outside differ (the sign: a half turn of the phase)', dist(a1.at(outP[0], outP[1]), a3.at(outP[0], outP[1])) > 30, [a1.at(outP[0], outP[1]), a3.at(outP[0], outP[1])]);

// ---- B: a hand-drawn curve
await open(CURVE, []);
cz = await ev('__cmwCauchy()');
info.B = cz;
ok('B F = z over a hand-drawn curve: the formula holds, no pole', cz && cz.formula && cz.poles.length === 0, cz);
await ev('__cmwCauchyOpt("both", false)'); await settle();
const b1 = await pic();
const c1 = await W2P(0, 0);
let nonGrey = 0, tot = 0;
for (let y = 3; y < b1.h; y += 5) for (let x = 3; x < b1.w; x += 5) {
  const d = Math.hypot(x - c1[0], y - c1[1]);
  if (d < 1.2 * 110 + 8 || (x < 130 && y < 50) || (x > b1.w - 60 && y > b1.h - 120)) continue;   // outside the curve's largest radius (1.12 · 110 px) and a margin; the scale chip and the zoom buttons are not the plot
  tot++; if (!isGrey(b1.at(x, y))) nonGrey++;
}
ok('B the outside of the hand-drawn curve is neutral grey everywhere (the formula gives exactly 0)', tot > 1000 && nonGrey === 0, { tot, nonGrey });
await ev('__cmwCauchyQuad(true)'); await settle();
const b2 = await pic();
let nonGrey2 = 0;
for (let y = 3; y < b2.h; y += 5) for (let x = 3; x < b2.w; x += 5) { const d = Math.hypot(x - c1[0], y - c1[1]); if (d >= 1.2 * 110 + 8 && !(x < 130 && y < 50) && !(x > b2.w - 60 && y > b2.h - 120) && !isGrey(b2.at(x, y))) nonGrey2++; }
info.B_quad = nonGrey2;
await ev('__cmwCauchyQuad(false)'); await settle();
await open(CURVE, custom('\\frac{1}{z-0.1}'));
cz = await ev('__cmwCauchy()');
ok('B F = 1/(z − 0.1) over the hand-drawn curve: one pole, the formula holds', cz && cz.formula && cz.poles.length === 1 && Math.abs(cz.poles[0].z[0] - 0.1) < 1e-9, cz);

// ---- C: e^(1/z)
await open(CIRCLE, custom('\\exp\\left(\\frac{1}{z}\\right)'));
cz = await ev('__cmwCauchy()');
info.C = cz;
ok('C e^(1/z): the formula is unverified, the quadrature draws', cz && !cz.formula && cz.why === 'unverified', cz);
const c2 = await pic();
ok('C the quadrature still draws something (the plane is not blank)', !isGrey(c2.at(c2.w / 2 + 40, c2.h / 2 - 30)) || !isGrey(c2.at(c2.w / 2 + 20, c2.h / 2 + 80)), null);

// ---- D: a pole on the curve
await open(CIRCLE, custom('\\frac{1}{z-1}'));
cz = await ev('__cmwCauchy()');
info.D = cz;
ok('D a pole on the curve: no formula (onCurve)', cz && !cz.formula && cz.why === 'onCurve', cz);

const e = errs(await logs());
ok('no page errors', !e.length, e.slice(0, 4).map((x) => String(x.m).slice(0, 200)));
return { pass: !fails.length, fails, info };

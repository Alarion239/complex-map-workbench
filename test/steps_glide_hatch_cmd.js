// The steps view's glide draws, at a pixel no point of the glide reaches, the departure plane's own no-value colour
// where that plane has no value at the pixel's point: the grey 45 degree hatch of dcolorAt's NaN branch, so the
// hatched region shrinks as the glide's points arrive (#1443's ux rule, case a). The Douady–Hubbard map (its default
// scene: one step, Everywhere): parked plane 0 hatches the inside of M, where the map is undefined. At u = DEPART_U the
// glide frame's hatch-grey pixels (the channels within GREY_SPREAD of each other and within GREY_LO..GREY_HI) inside M's
// main cardioid and period-2 bulb (shrunk by INSET, away from M's boundary) are at least HATCH_MIN of plane 0's, and
// plane 0 has at least MIN_HATCH of them. And the hatch shrinks as the points arrive: at u = ARRIVE_U the glide's points
// cover the part of the period-2 bulb outside the unit disc (the map is onto the outside of the unit disc), so the
// frame has at least SHRINK_MIN fewer hatch-grey pixels there than at DEPART_U (inside the unit disc no point arrives,
// and the hatch stays: what the plane past the glide shows there is #1443's).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const DEPART_U = 1e-4, ARRIVE_U = 0.998, HATCH_MIN = 0.9, SHRINK_MIN = 0.03, MIN_HATCH = 2000;
const GREY_SPREAD = 3, GREY_LO = 100, GREY_HI = 130, INSET = 0.9;
const SETTLE_MS = 60000;
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EXAMPLE = names.indexOf('The Douady–Hubbard map');
ok('the example The Douady–Hubbard map is in the guide', EXAMPLE >= 0, names.length);
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=svhatch${Date.now()}&view=steps`);
await settled({ max: SETTLE_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwExample(${EXAMPLE}); 1`);
await settled({ max: SETTLE_MS, until: '__cmwSteps().ready.ready' });
await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane' }), 1`);
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const park = async (x) => {
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  await settled({ max: SETTLE_MS, until: `Math.abs(__cmwSteps().x - ${x}) < 1e-12 && GLR.pendingLinks === 0 && !__cmwSteps().hold` });
  return grab('X' + x);
};
ok('plane 0 settles', await park(0), null);
ok(`the glide frame at u = ${DEPART_U} settles`, await park(DEPART_U), null);
const rec = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u, view: g.view, w: g.w, h: g.h }; })()');
info.glide = rec && { path: rec.path, u: rec.u };
ok(`the frame at u = ${DEPART_U} is a glide frame`, !!rec && Math.abs(rec.u - DEPART_U) < 1e-9, rec);
ok(`the glide frame at u = ${ARRIVE_U} settles`, await park(ARRIVE_U), null);
// the hatch-grey pixels of frame tag inside M's main cardioid (|1 - sqrt(1 - 4c)| < INSET) and its period-2 bulb
// (|c + 1| < INSET / 4), the frames sharing the glide's camera
const hatch = (tag) => ev(`(() => {
  const v = ${JSON.stringify(rec && rec.view)}, cw = ${rec ? rec.w : 0}, ch = ${rec ? rec.h : 0};
  const D = window.__heldPx[${JSON.stringify(tag)}], c = document.getElementById('canvasL'), W = c.width, H = c.height, dpr = W / cw;
  let inM = 0, grey = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const re = v.cx + ((x + 0.5) / dpr - cw / 2) / v.s, im = v.cy - ((y + 0.5) / dpr - ch / 2) / v.s;
    // sqrt(1 - 4c) by the principal root
    const ar = 1 - 4 * re, ai = -4 * im, m = Math.hypot(ar, ai), sr = Math.sqrt((m + ar) / 2), si = Math.sign(ai) * Math.sqrt(Math.max(0, (m - ar) / 2));
    const card = Math.hypot(1 - sr, -si) < ${INSET}, bulb = Math.hypot(re + 1, im) < ${INSET} / 4;
    if (!card && !bulb) continue;
    inM++;
    const i = 4 * (y * W + x), r = D[i], g = D[i + 1], b = D[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) <= ${GREY_SPREAD} && r >= ${GREY_LO} && r <= ${GREY_HI}) grey++;
  }
  return { inM, grey };
})()`);
const p0 = info.plane0 = await hatch('X0'), d = info.depart = await hatch('X' + DEPART_U), a = info.arrive = await hatch('X' + ARRIVE_U);
ok(`plane 0 hatches the inside of M (at least ${MIN_HATCH} hatch-grey pixels)`, p0.grey >= MIN_HATCH, p0);
ok(`at u = ${DEPART_U} the glide hatches what plane 0 hatches (at least ${HATCH_MIN * 100} % of plane 0's hatch-grey pixels)`, d.grey >= HATCH_MIN * p0.grey, { depart: d, plane0: p0 });
ok(`at u = ${ARRIVE_U} the hatch has shrunk where the glide's points arrive (at least ${SHRINK_MIN * 100} % fewer hatch-grey pixels than at u = ${DEPART_U})`, a.grey <= (1 - SHRINK_MIN) * d.grey, { arrive: a, depart: d });
return { pass: fails.length === 0, fails, info };

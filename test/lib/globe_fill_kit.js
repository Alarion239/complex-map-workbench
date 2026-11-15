// The globe suites' shared pixel check (p3_accept_cmd.js, p3_accept_steps_cmd.js): a globe pane's fill against the truth.
// An expression for eval in a suite, which supplies ev and settled: `const { grab, globeCheck, neutralFrame, handedness, countPicks, FILL_DIFF, EPI, ANNULUS } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'globe_fill_kit.js'), 'utf8'))`.
// globeCheck(side, cls, step, mode, id) picks each pixel's point with the page's pick of that side (__cmwSphereW for 'R',
// __cmwSphereWL for 'L'). A sample is fill when its frame differs from a reference frame without the fill by more than FILL_DIFF
// (the sum of the channels' differences); the frames are the page's D1 (as drawn), D0 and Db. mode 'alpha' (the classic
// panes): the reference D0 is the same frame with the fill's alpha 0. mode 'scope' (the steps view's globe, scope Inside
// regions, the region of shape id): D0 is the Everywhere frame, and the reference Db is the same frame with the shape hidden
// (Inside regions with no area drawn is the neutral globe: its tint, shading and rims, no colour); a sample the truth puts
// inside is left out where Everywhere shows nothing over Db (there is no colour to keep).
// fillSrc(mode) is the page function fillAt(i, c) (c: the truth's class of the sample, 1 inside, -1 outside) for either.
(() => {
// a globe pane's fill against the truth: every pixel's point w (the pane's own pick) is classified by cls(w) (page code:
// 1 inside, -1 outside, 0 neither); a pixel is fill where the frame differs from the same frame drawn with the fill
// transparent (alpha 0: the globe, its graticule, the boundary strokes and the shading are the same in both, so the
// test sees the fill alone). Samples within 4 screen px of a class change (the rims, where the strokes are) and off the
// globe are skipped; every STEP-th pixel is checked -> counts of inside / outside samples and the ones that disagree
// a sample is fill when its frame differs from the reference by more than this (the sum of the channels' differences)
const FILL_DIFF = 24;
const DIFF = (P, Q) => `Math.abs(${P}[i] - ${Q}[i]) + Math.abs(${P}[i + 1] - ${Q}[i + 1]) + Math.abs(${P}[i + 2] - ${Q}[i + 2])`;
const MODES = {
  alpha: { off: '__cmwSet("alpha", 0)', on: '__cmwSet("alpha", 1)', fill: `(i, c) => (${DIFF('D1', 'D0')} > ${FILL_DIFF} ? 1 : 0)` },
  scope: { off: '__cmwSteps({ scope: "all" })', on: '__cmwSteps({ scope: "in" })', fill: `(i, c) => (c > 0 && ${DIFF('D0', 'Db')} <= ${FILL_DIFF} ? -1 : ${DIFF('D1', 'Db')} > ${FILL_DIFF} ? 1 : 0)` },
};
const fillSrc = (mode) => MODES[mode].fill;
// the frame the toggle asked for is drawn: the page quiet, the steps view's glide done, no program linking
const quiet = () => settled({ max: 15000, until: '!(window.__cmwSteps && __cmwSteps().moving) && GLR.pendingLinks === 0' });
const grab = (side) => ev(`(() => { const cv = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}); const g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; const x = g.getContext('2d'); x.drawImage(cv, 0, 0); window.__p3grab = window.__p3grab || {}; window.__p3grab[${JSON.stringify(side)}] = x.getImageData(0, 0, g.width, g.height).data; return [g.width, g.height]; })()`);
// the steps view's neutral frame of a side into the page's Db: the shape's eye in the list hidden, shown again after
const neutralFrame = async (side, id = 's1') => {
  const eye = JSON.stringify(`#shapeList .shape[data-id="${id}"] .eye`);
  await ev(`document.querySelector(${eye}).click(); 1`);
  await quiet();
  await grab(side);
  await ev('window.__p3Db = window.__p3grab[' + JSON.stringify(side) + ']; document.querySelector(' + eye + ').click(); 1');
  await quiet();
};
const globeCheck = async (side, cls, step = 2, mode = 'alpha', id = 's1') => {
  await grab(side);
  await ev('window.__p3D1 = window.__p3grab[' + JSON.stringify(side) + ']; ' + MODES[mode].off + '; 1');
  await quiet();
  await grab(side);
  await ev('window.__p3D0 = window.__p3grab[' + JSON.stringify(side) + ']; ' + MODES[mode].on + '; 1');
  await quiet();
  if (mode === 'scope') await neutralFrame(side, id);
  return ev(`(() => {
  const cv = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}), r = cv.getBoundingClientRect();
  const D1 = window.__p3D1, D0 = window.__p3D0, Db = window.__p3Db, GW = cv.width, dpr = cv.width / r.width;
  const pick = ${side === 'L' ? '__cmwSphereWL' : '__cmwSphereW'};
  const cls = ${cls}, fillAt = ${fillSrc(mode)};
  const Wd = Math.floor(r.width), Hd = Math.floor(r.height), C = new Int8Array(Wd * Hd), WW = [];
  // the globe's point labels (0, infinity, 1, i, -1, -i: drawn over the frame in both) are left out, 16 px around each
  const pc = GLR.camera(__cmwCam(${JSON.stringify(side)}), r.width, r.height);
  const proj = (p) => { const q = GLR.M4.apply(pc.MVP, p); return q[3] > 1e-6 ? [(q[0] / q[3] * 0.5 + 0.5) * r.width, (1 - (q[1] / q[3] * 0.5 + 0.5)) * r.height] : null; };
  const labs = [[0, 0, 1.1], [0, 0, -1.1], [1.06, 0, 0.1], [0, -1.06, 0.1], [-1.06, 0, 0.1], [0, 1.06, 0.1]].map(proj).filter(Boolean);
  const onLabel = (x, y) => labs.some((q) => Math.hypot(q[0] - x, q[1] - y) < 16);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const w = pick(x + 0.5, y + 0.5); C[y * Wd + x] = w ? (cls(w) || 2) : 3; WW.push(w); }
  const near = (x, y) => { const c = C[y * Wd + x]; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= Hd) return true; if (dx * dx + dy * dy <= 16 && C[yy * Wd + xx] !== c) return true; } return false; };
  const o = { inN: 0, inBad: 0, outN: 0, outBad: 0, badIn: [], badOut: [] };
  for (let y = 4; y < Hd - 4; y += ${step}) for (let x = 4; x < Wd - 4; x += ${step}) {
    const c = C[y * Wd + x]; if (c !== 1 && c !== -1) continue;
    if (near(x, y) || onLabel(x, y)) continue;
    const i = 4 * (Math.floor((y + 0.5) * dpr) * GW + Math.floor((x + 0.5) * dpr));
    const f = fillAt(i, c); if (f < 0) continue;
    const fill = f === 1;
    const w = WW[y * Wd + x];
    if (c > 0) { o.inN++; if (!fill) { o.inBad++; if (o.badIn.length < 4) o.badIn.push([x, y, w.map((v) => +v.toPrecision(4)), [D1[i], D1[i + 1], D1[i + 2]]]); } }
    else { o.outN++; if (fill) { o.outBad++; if (o.badOut.length < 4) o.badOut.push([x, y, w.map((v) => +v.toPrecision(4)), [D1[i], D1[i + 1], D1[i + 2]], [D0[i], D0[i + 1], D0[i + 2]]]); } }
  }
  return o;
})()`, 60000);
};
// the handedness of the pane's pick of a side: a screen triangle (x, y), (x + HAND_LEG, y), (x, y - HAND_LEG) maps to a triangle of the
// same orientation, counted as [kept, reversed] over a grid of the pane (the plain lift would make every globe a mirror image)
// (the grid: a pick every HAND_STEP px, HAND_MARGIN px in from the pane's edge; the triangle's legs are HAND_LEG px)
const HAND_MARGIN = 20, HAND_STEP = 23, HAND_LEG = 4;
const handedness = (side) => ev(`(() => {
  const out = [0, 0], pick = ${side === 'L' ? '__cmwSphereWL' : '__cmwSphereW'};
  const r = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}).getBoundingClientRect();
  for (let y = ${HAND_MARGIN}; y < r.height - ${HAND_MARGIN}; y += ${HAND_STEP}) for (let x = ${HAND_MARGIN}; x < r.width - ${HAND_MARGIN}; x += ${HAND_STEP}) {
    const a = pick(x, y), b = pick(x + ${HAND_LEG}, y), c = pick(x, y - ${HAND_LEG});
    if (!a || !b || !c) continue;
    out[(b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]) > 0 ? 0 : 1]++;
  }
  return out;
})()`);
// the number of pane pixels (every second one, 3 px in from the edge) whose point, by the pane's own pick, satisfies pred
// (page code: (w) => boolean)
const countPicks = (side, pred) => ev(`(() => { let n = 0; const pick = ${side === 'L' ? '__cmwSphereWL' : '__cmwSphereW'}, r = document.getElementById(${JSON.stringify(side === 'L' ? 'canvasL' : 'canvasR')}).getBoundingClientRect(); for (let y = 3; y < r.height - 3; y += 2) for (let x = 3; x < r.width - 3; x += 2) { const w = pick(x, y); if (w && (${pred})(w)) n++; } return n; })()`);
const EPI = Math.exp(-Math.PI);
// the annulus e^-pi < |w| < 1 (z^i of H): inside beyond 3 px of both rims; outside: the hole cap and beyond |w| = 1
const ANNULUS = `(w) => { const a = Math.hypot(w[0], w[1]), e = ${EPI}; return a > e && a < 1 ? 1 : -1; }`;
  return { grab, globeCheck, neutralFrame, handedness, countPicks, fillSrc, FILL_DIFF, EPI, ANNULUS };
})()

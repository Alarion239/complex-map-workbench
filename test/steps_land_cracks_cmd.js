// The steps view's Landscape glide with the sheets off leaves no background cracks inside the relief (#1448): the relief is redrawn
// alone on a transparent frame (window.__cmwLandRelief, one coverage byte a pixel), and a crack is a pixel that is not covered (or only
// partly) while at least CRACK_NEAR of its four neighbours SPAN pixels away along the axes are covered.
// - the parked planes 0 and 1 of each case, in the view of its glide frames, are the floor: at most CRACK_MAX cracks;
// - the issue's glide frames (from plane 0 to 1) have at most CRACK_MAX cracks: Joukowski airfoil at u = .25 (isometric and Top),
//   cube root at u = .5 (Top), the partial sums of the exponential at u = .25 (isometric and Top) and .5 (Top);
// - the control, at each case's first glide frame: CTL_HOLES one-pixel holes punched CTL_STEP pixels apart along a covered row of that
//   frame's relief count over CRACK_MAX, so a frame with cracks fails the measure.
// Im F, alpha 1, Everywhere, 1440 x 900. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const LOAD_MAX_MS = 60000;
const CRACK_NEAR = 3, FULL = 250, SPAN = 2;   // (a pixel counts when 3 of its 4 neighbours SPAN pixels away are covered at over FULL of 255)
const CRACK_MAX = 30;                        // (the bound: the parked planes' floor, #1342's measure)
const CTL_HOLES = 40, CTL_STEP = 5;
const TOP_CAM = { yaw: -Math.PI / 2, pitch: 88 * Math.PI / 180 };   // the Top view
// the cases: an example by name, or a chain; at each view, the glide's u of the issue's frames
const CASES = [
  { tag: 'Joukowski airfoil', example: 'Joukowski airfoil', at: { isometric: [0.25], Top: [0.25] } },
  { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], at: { Top: [0.5] } },
  { tag: 'Partial sums of the exponential', example: 'Partial sums of the exponential', at: { isometric: [0.25], Top: [0.25, 0.5] } },
];
const ONLY = process.env.CMW_ONLY ? new RegExp(process.env.CMW_ONLY) : null;
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const COUNT = `window.__lxCrack = (cov, w, h) => {
  const c = (x, y) => cov[y * w + x] > ${FULL};
  let n = 0;
  for (let y = ${SPAN}; y < h - ${SPAN}; y++) for (let x = ${SPAN}; x < w - ${SPAN}; x++) {
    if (c(x, y)) continue;
    if (c(x - ${SPAN}, y) + c(x + ${SPAN}, y) + c(x, y - ${SPAN}) + c(x, y + ${SPAN}) >= ${CRACK_NEAR}) n++;
  }
  return n;
};
window.__lxCount = () => { const r = __cmwLandRelief(); return r ? { n: __lxCrack(__cmwLandRelief.cov, r.w, r.h), covered: r.n } : null; };
window.__lxCtl = (holes, step) => {
  // (the longest covered run of a row of the last relief, a hole at every step-th pixel of it)
  const L = window.__cmwLandRelief; if (!L.cov) return null;
  const cov = L.cov.slice(), w = L.w, h = L.h;
  let best = null;
  for (let y = ${SPAN}; y < h - ${SPAN}; y++) {
    let run = 0, start = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && cov[y * w + x] > ${FULL}) { if (!run) start = x; run++; } else { if (!best || run > best.run) best = { y, start, run }; run = 0; }
    }
  }
  if (!best || best.run < holes * step) return { n: null, run: best && best.run };
  for (let i = 0; i < holes; i++) cov[best.y * w + best.start + ${SPAN} + i * step] = 0;
  return { n: __lxCrack(cov, w, h), run: best.run };
};
1`;
await view(1440, 900, false, false);
for (const c of CASES) {
  if (ONLY && !ONLY.test(c.tag)) continue;
  const ns = 'lcracks' + Date.now();
  if (c.example) {
    await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
    await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
    await ev(`__cmwExample(${names.indexOf(c.example)}); 1`); await settled({ max: LOAD_MAX_MS });
    await ev("__cmwSet('alpha', 1), __cmwSet('height', 'im'), __cmwSet('sheets', false), 1");
  } else {
    await loadView('steps', ns, { shapes: [], steps: c.steps, sheets: false, height: 'im' });
  }
  await settled({ max: LOAD_MAX_MS * 2, until: '__cmwSteps().ready.ready' });
  ok(`${c.tag}: the sheets are off`, (await ev('__cmwState().sheets')) === false, null);
  await ev(COUNT);
  const cam0 = await ev("__cmwCam('L')");
  let ctlDone = false;
  for (const [view_, cam] of [['isometric', cam0], ['Top', TOP_CAM]]) {
    if (!c.at[view_]) continue;
    await ev(`__cmwCam('L', ${JSON.stringify(cam)}); 1`);
    for (const k of [0, 1]) {
      await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
      const r = await ev('__lxCount()');
      info[`${c.tag}, ${view_}, plane ${k}`] = r;
      ok(`${c.tag}, ${view_}: the parked plane ${k} has at most ${CRACK_MAX} cracks`, !!r && r.n <= CRACK_MAX, r);
    }
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS });
    for (const u of c.at[view_]) {
      await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
      const r = await ev('__lxCount()');
      info[`${c.tag}, ${view_}, u=${u}`] = r;
      ok(`${c.tag}, ${view_}, u=${u}: the glide frame has at most ${CRACK_MAX} cracks inside the relief`, !!r && r.n <= CRACK_MAX, r);
      if (!ctlDone) {
        ctlDone = true;
        const ctl = await ev(`__lxCtl(${CTL_HOLES}, ${CTL_STEP})`);
        info[`${c.tag}, control`] = ctl;
        ok(`${c.tag}, ${view_}, u=${u}: control: ${CTL_HOLES} one-pixel holes in the relief count over ${CRACK_MAX} cracks`, !!ctl && ctl.n > CRACK_MAX, ctl);
      }
    }
  }
}
return { pass: fails.length === 0, fails, info };

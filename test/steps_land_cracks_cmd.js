// The steps view's exact Landscape glide with All sheets leaves no cracks inside the relief: the surface's pieces meet along every seam
// of a sheet (member against member), so no isolated background pixel shows between covered ones. The relief is redrawn alone on a
// transparent frame (window.__cmwLandRelief, one coverage byte a pixel); a crack is a pixel that is not covered (or only partly) while
// at least CRACK_NEAR of its four neighbours two pixels away along the axes are covered. A parked plane's frame is the floor.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const LOAD_MAX_MS = 60000;
const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
// the cases with a multivalued step, whose sheets meet in members along seams
const CASES = [
  { tag: 'Möbius, √', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [] },
  { tag: 'log of an annulus', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN },
  { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [] },
];
const TOP_CAM = { yaw: -Math.PI / 2, pitch: 88 * Math.PI / 180 };   // the Top view
const AT = [0.25, 0.5, 0.75];   // (the glide's u of the probes: between the two planes, where no end blend hides a crack)
const CRACK_NEAR = 3, FULL = 250, SPAN = 2;   // (a pixel counts when 3 of its 4 neighbours SPAN pixels away are covered at over FULL of 255)
// the largest count of the parked frames of the three cases in both views (log of an annulus, parked plane 0, isometric: 30); a moving
// frame's cracks are at most what a parked plane draws
const CRACK_MAX = 30;
// the measure's control: CTL_HOLES isolated one-pixel holes, CTL_STEP pixels apart along a row of the covered interior
const CTL_HOLES = 40, CTL_STEP = 5;
const COUNT = `window.__lxCrack = (cov, w, h) => {
  const c = (x, y) => cov[y * w + x] > ${FULL};
  let n = 0;
  for (let y = ${SPAN}; y < h - ${SPAN}; y++) for (let x = ${SPAN}; x < w - ${SPAN}; x++) {
    if (c(x, y)) continue;
    if (c(x - ${SPAN}, y) + c(x + ${SPAN}, y) + c(x, y - ${SPAN}) + c(x, y + ${SPAN}) >= ${CRACK_NEAR}) n++;
  }
  return n;
};
window.__lxCount = () => { const r = __cmwLandRelief(); return r ? __lxCrack(__cmwLandRelief.cov, r.w, r.h) : null; };
window.__lxCtl = (holes, step) => {
  // a row through the covered interior: its covered run's middle, a hole at every step-th pixel
  const r = __cmwLandRelief(); if (!r) return null;
  const cov = __cmwLandRelief.cov.slice(), w = r.w, h = r.h;
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
// the cross-layer pass's controls, each at a u of the case: with it off the cracks return (cube root); the guard refuses
// continuations onto a surface the frame does not draw there, and without it none is refused (log)
const CONTROLS = { 'cube root': { u: 0.5 }, 'log of an annulus': { u: 0.25 } };
const SEAM = `window.__lxSeam = () => { const m = __cmwLandSeamMiss(); const sum = (k) => m.reduce((a, L) => a + (L.why[k] || 0), 0); return { refused: sum(5), cont: m.reduce((a, L) => a + L.cont, 0) }; };
window.__lxProbe = (p) => { GLR.carryProbes(Object.assign({ ringWhy: true }, p)); return 1; };
1`;
const controls = async (c) => {
  const u = CONTROLS[c.tag].u;
  const at = async (probe) => { await ev(`__lxProbe(${JSON.stringify(probe)})`); await ev(`__cmwSteps({ x: ${u} }); 1`); await ev(`__cmwSteps({ x: ${u} + 0.01 }); 1`); await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); };
  await ev(SEAM);
  if (c.tag === 'cube root') {
    await at({ noRing: true });
    const n = await ev('__lxCount()');
    ok(`${c.tag}, u=${u}: control: without the cross-layer pass the frame has over ${CRACK_MAX} cracks (${n})`, n !== null && n > CRACK_MAX, { n });
  } else {
    await at({});
    const on = await ev('__lxSeam()');
    await at({ noGuard: true });
    const off = await ev('__lxSeam()');
    ok(`${c.tag}, u=${u}: the guard refuses continuations onto surfaces the frame does not draw (${on.refused})`, on.refused > 0, on);
    ok(`${c.tag}, u=${u}: control: without the guard none is refused and more vertices are continued (${off.refused}, ${off.cont} against ${on.cont})`, off.refused === 0 && off.cont > on.cont, { on, off });
  }
  await at({});
  await ev('GLR.carryProbes({}); 1');
};
await view(1440, 900, false, false);
for (const c of CASES) {
  const ns = 'cracks' + Date.now();
  await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets: true, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await settled({ max: LOAD_MAX_MS * 2, until: '__cmwSteps().ready.ready' });
  await ev(COUNT);
  const cam0 = await ev("__cmwCam('L')");
  for (const [view_, cam] of [['isometric', cam0], ['Top', TOP_CAM]]) {
    await ev(`__cmwCam('L', ${JSON.stringify(cam)}); 1`);
    for (const k of [0, 1]) {
      await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
      const n = await ev('__lxCount()');
      info[`${c.tag}, ${view_}, plane ${k}`] = n;
      ok(`${c.tag}, ${view_}: the parked plane ${k} has at most ${CRACK_MAX} cracks (${n})`, n !== null && n <= CRACK_MAX, { n });
      if (k === 0 && view_ === 'isometric') {
        const ctl = await ev(`__lxCtl(${CTL_HOLES}, ${CTL_STEP})`);
        ok(`${c.tag}: control: ${CTL_HOLES} one-pixel holes in the relief count over ${CRACK_MAX} cracks (${ctl && ctl.n})`, ctl && ctl.n > CRACK_MAX, ctl);
      }
    }
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS });
    for (const u of AT) {
      await ev(`__cmwSteps({ x: ${u} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
      const n = await ev('__lxCount()');
      info[`${c.tag}, ${view_}, u=${u}`] = n;
      ok(`${c.tag}, ${view_}, u=${u}: the frame has at most ${CRACK_MAX} cracks along its seams (${n})`, n !== null && n <= CRACK_MAX, { n });
    }
    if (view_ === 'isometric' && CONTROLS[c.tag]) await controls(c);
  }
}
return { pass: fails.length === 0, fails, info };

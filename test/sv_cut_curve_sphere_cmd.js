// The cut's image curve on the Sphere and through a glide (steps view; #912, after #891/#909's flat later planes):
// - chain: √z (cut 180°), then z + 2. On plane w₁ the banks are the imaginary axis's two half-lines (the rays at θ/2 and θ/2 + π);
// - at rest on the Sphere, plane w₁: both banks are drawn on the globe, their stroke's pixels at the exact image of the
//   cut (the samples' lifted screen points carry the cut ink);
// - parked half-way between w₁ and w₂ (u = .5), on the plane and on the Sphere: the banks are the exact image at u (the
//   rest samples moved by the homotopy z + t·2 = +1), drawn in the same ink at full opacity (one stroke, no fade);
// - the θ handle is absent while the picture moves (parked between planes) and back at rest on a plane.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const ns = 'cutsph' + Date.now();
await loadView('steps', ns, { srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: [{ type: 'root', params: { n: 2, cut: 180 }, on: true }, { type: 'add', params: { c: '2' }, on: true }], height: 'im' });
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
const J = (e) => ev(`(${e})`);
const quiet = () => settled({ floor: 400, max: 30000, until: 'window.__cmwSteps && !__cmwSteps().moving' });
const curves = () => J('__cmwCutCurves()');
const handles = () => J('__cmwCutHandles()');
// (the share of the points (CSS px) whose pixel, or one beside it, is the cut's ink #CC3311 to within 40 per channel (the
// stroke is 1.75 px wide, its edge pixels part paper): a stroke at full opacity, which a fade or a blend, at half strength
// 100 off in green, would not match)
const inkShare = (pts) => J(`(() => {
  const c = document.getElementById('canvasL'), s = document.createElement('canvas'), k = c.width / c.getBoundingClientRect().width;
  s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  const P = ${JSON.stringify(pts)}, ink = [204, 51, 17];
  const hit = P.filter((p) => {
    const d = g.getImageData(Math.round(p[0] * k) - 1, Math.round(p[1] * k) - 1, 3, 3).data;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - ink[0]) < 40 && Math.abs(d[i + 1] - ink[1]) < 40 && Math.abs(d[i + 2] - ink[2]) < 40) return true;
    return false;
  });
  return { n: P.length, share: P.length ? hit.length / P.length : 0 };
})()`);
const dev = (c, re) => Math.max(...c.w.map((p) => Math.abs(p[0] - re)));   // (distance of a bank from the line Re w = re)

// at rest on the Sphere, plane w₁
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere' }); 1`); await quiet();
let cv = await curves();
const solid = cv.find((c) => c.solid), dash = cv.find((c) => !c.solid);
ok('sphere rest: both banks are drawn', !!solid && !!dash && solid.w.length > 100 && dash.w.length > 100, cv.map((c) => [c.solid, c.w.length]));
ok('sphere rest: the banks are the imaginary axis', !!solid && !!dash && dev(solid, 0) < 1e-3 && dev(dash, 0) < 1e-3, solid && dev(solid, 0));
const vis = (c) => ((c && c.s) || []).filter((p) => p && p[0] > 2 && p[1] > 2 && p[0] < 1100 && p[1] < 700);
const pick = vis(solid);
ok('sphere rest: the solid bank is visible on the globe', pick.length > 5, [pick.length, solid && solid.s && solid.s.length, await J('__cmwSteps().surf')]);
const restInk = await inkShare(pick);
info.restInk = restInk;
ok('sphere rest: the stroke is on the exact image (the ink at the samples)', restInk.share > 0.9, restInk);
const off = await inkShare(pick.map((p) => [p[0] + 9, p[1] + 9]));
ok('sphere rest: the ink is not beside the curve', off.share < 0.5, off);
ok('sphere rest: no handle on the globe', (await handles()).length === 0, await handles());
const restW = solid.w.map((p) => p[0]), restV = solid.w.map((p) => p[1]);

// parked half-way between w₁ and w₂, on the Sphere
await ev(`__cmwSteps({ park: 1.5 }); 1`); await sleep(1200); await quiet();
cv = await curves();
const ms = cv.find((c) => c.solid), md = cv.find((c) => !c.solid);
ok('sphere glide: both banks are drawn', !!ms && !!md && ms.w.length > 100, cv.map((c) => [c.solid, c.w.length]));
const shift = ms ? Math.max(...ms.w.map((p, i) => Math.hypot(p[0] - (restW[i] + 1), p[1] - restV[i]))) : null;
info.shift = shift;
ok('sphere glide: the banks are the exact image at u = .5 (the rest samples + 1)', !!ms && ms.w.length === restW.length && shift < 1e-5 && dev(ms, 1) < 1e-3, shift);
const gInk = await inkShare(vis(ms));
info.glideInk = gInk;
ok('sphere glide: drawn at full opacity, the ink at the samples (no fade)', gInk.n > 5 && gInk.share > 0.9, gInk);
ok('sphere glide: no handle', (await handles()).length === 0, await handles());

// parked half-way, on the plane
await ev(`__cmwSteps({ go: 1, now: true, surf: 'plane' }); 1`); await quiet();
await ev(`__cmwSteps({ park: 1.5 }); 1`); await sleep(1200); await quiet();
cv = await curves();
const ps = cv.find((c) => c.solid);
ok('plane glide: the solid bank is the exact image at u = .5', !!ps && ps.w.length === restW.length && Math.max(...ps.w.map((p, i) => Math.hypot(p[0] - (restW[i] + 1), p[1] - restV[i]))) < 1e-5 && dev(ps, 1) < 1e-3, ps && ps.w.length);
const pInk = await inkShare(ps ? ps.s.filter((p) => p && p[0] > 2 && p[1] > 2 && p[0] < 1100 && p[1] < 700) : []);
info.planeInk = pInk;
ok('plane glide: one stroke at full opacity (the ink at the samples)', pInk.n > 5 && pInk.share > 0.9, pInk);
ok('plane glide: the handle is hidden while the picture moves', (await handles()).length === 0, await handles());

// back at rest on a plane: the handle is shown again
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await quiet();
ok('at rest on plane w₁: the handle is back', (await handles()).length === 1, await handles());

const lg = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', lg.length === 0, lg);
return { pass: fails.length === 0, fails, info };

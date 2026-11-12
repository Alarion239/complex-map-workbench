// The steps view's globe past the colour plane shows the same picture at rest and at the end of the glide into it, on a
// step with no inverse plan. Plane w1 of z^2 is the colour plane; w2 = w1 + 0.2 conj(w1) is a formula that is not
// analytic, so its glide takes the carried mesh and the globe at rest on w2 must too (as the plane does):
//  - at rest on w2 the globe's last frame is the carried mesh (__cmwSvGlobe(): path 'mesh'), in colour;
//  - at u = 0.998 of the glide w1 -> w2 (the thread at x = 1.998) it is the resting globe of w2 within END_MEAN levels
//    on the whole frame (the colour lines move by a fraction of a pixel); the glide's start, u = 0.002, is the resting
//    globe of w1 within START_MEAN levels (there the mesh's triangles are compared with the exact picture, per pixel),
//    with its graticule and highlight (the mean luminance within LUM_TOL levels). The paths are off (morphPaths), so
//    that the frames differ only by the globe.
// (the limits: END_MEAN and START_MEAN, the mean over a frame's pixels of the largest channel difference (levels of 255,
// held_frames' compare) that the moving globe may be from the resting one; LUM_TOL, the levels its mean luminance may
// be from the resting globe's (the graticule's lines and the highlight carry it); SAT_MIN, the spread between a sample's
// largest and smallest channel that makes it coloured and not grey paper; COLOURED_MIN, the share of the frame that
// is coloured at rest)
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const END_MEAN = 1.5, START_MEAN = 1.5, LUM_TOL = 0.5, SAT_MIN = 40, COLOURED_MIN = 0.05;
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (quiet: the programs and jobs are ready, no glide or play is under way and the sphere is idle; __cmwSteps().moving is also
// true for a place parked between two planes, which is a still view, so it is not the wait)
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && !(window.__cmwSphere && __cmwSphere().running)";
const quiet = () => settled({
  max: 20000,
  until: QUIET_UNTIL,
});
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (the share of the kept frame's pixels whose largest and smallest channel are more than SAT_MIN apart)
const colouredShare = (tag) => ev(`(() => {
  const P = window.__heldPx[${JSON.stringify(tag)}];
  let n = 0, sat = 0;
  for (let i = 0; i < P.length; i += 4) {
    n++;
    if (Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > ${SAT_MIN}) sat++;
  }
  return +(sat / n).toFixed(4); })()`);
// (the last globe frame's carry path, once the programs have linked)
const pathIs = async (want) => {
  let g = null;
  for (let i = 0; i < 40; i++) { g = await ev('__cmwSvGlobe(0, 0)'); if (g && g.path === want) break; await sleep(250); }
  return g;
};
await view(1200, 800, false, false);
const ns = 'svsr' + Date.now();
await seed(ns, {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }],
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function'` });
await ev(`__cmwSet('morphPaths', false); 1`);
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere', scope: 'all', T: 1 }); 1`); await quiet();
ok('the frame rest1 settles', await grab('rest1'), null);
await ev(`__cmwSteps({ go: 2, now: true }); 1`); await quiet();
R.rest2 = await pathIs('mesh') || {};
ok('the frame rest2 settles', await grab('rest2'), null);
R.rest2.coloured = await colouredShare('rest2');
ok('at rest on w2 (no inverse plan) the globe is the carried mesh', R.rest2.path === 'mesh', R.rest2);
ok('at rest on w2 the globe is in colour', R.rest2.coloured > COLOURED_MIN, R.rest2);
await ev(`__cmwSteps({ x: 1.998 }); 1`); await quiet();
R.end = await pathIs('mesh') || {};
ok('the frame end settles', await grab('end'), null);
R.end.differ = await compare('rest2', 'end');
ok('just before w2 the moving globe is the carried mesh', R.end.path === 'mesh', R.end);
ok('just before w2 the moving globe is the resting globe of w2 (a mean within END_MEAN levels)', R.end.differ.mean <= END_MEAN, R.end.differ);
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await quiet();
await ev(`__cmwSteps({ x: 1.002 }); 1`); await quiet();
ok('the frame start settles', await grab('start'), null);
R.start = { differ: await compare('rest1', 'start') };
ok('just past w1 the moving globe is the resting globe of w1 (a mean within START_MEAN levels)', R.start.differ.mean <= START_MEAN, R.start);
ok('just past w1 the moving globe has the resting globe\'s graticule and highlight (its mean luminance within LUM_TOL levels)', Math.abs(R.start.differ.lum[0] - R.start.differ.lum[1]) <= LUM_TOL, R.start);
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

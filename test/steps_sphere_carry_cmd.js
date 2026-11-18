// (Saved at 100 % opacity: a point's own colour is read; the Opacity slider's 85 % default mixes the layers behind.)
// The steps view's glide on the Sphere surface carries the colour with the points, as the plane does: between
// plane z and plane w1 of z^2, coloured from w1, a point z0 of plane z keeps its colour as it moves to H_u(z0). Parked
// at u = 0.25, 0.5 and 0.75:
//  - the globe's last frame drew the carried colour per pixel, through the inverse pass (__cmwSvGlobe(): path
//    'inverse': z^2's homotopy has an inverse plan);
//  - the globe is the exact picture at u (held_frames.js's globeJudge, from plane z's parked globe: each sample point w
//    of the sphere shows the colour of its front point z0 of H_u, lit for its place on the moving globe; at most
//    GLOBE_OVER of at least GLOBE_MIN_N points more than GLOBE_TOL levels apart in a channel), the points H_u covers
//    twice among them (the front one by the glide's sheet key);
//  - control: the cross-fade of the two planes' own globes at u (a blend of their colours at w) is not.
// The ends: at u = 0.002 (the thread set there, __cmwSteps({ x }), past the park's snap) the frame is the resting globe
// of plane z, and at u = 0.998 that of plane w1, within a mean of 1.5 levels on the whole frame, as steps_glide_inverse
// checks the plane's ends (the colour lines move by a fraction of a pixel): the colour is the moving point's own, not
// a blend of two globes.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
// (the limits: END_MEAN, the mean over a frame's pixels of the largest channel difference (levels of 255, held_frames'
// compare) that the moving globe may be from the resting one, as steps_glide_inverse's ends; SAT_MIN, the spread between a
// sample's largest and smallest channel that makes it coloured and not grey paper)
const END_MEAN = 1.5, SAT_MIN = 40;
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab, compare, fade, globeJudge, GLOBE_MIN_N } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (quiet: the programs and jobs are ready, no glide or play is under way and the sphere is idle; __cmwSteps().moving is also
// true for a place parked between two planes, which is a still view, so it is not the wait)
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && !(window.__cmwSphere && __cmwSphere().running)";
const quiet = () => settled({
  max: 20000,
  until: QUIET_UNTIL,
});
// (the left pane's colour at the globe's point (x, y) of the plane, read from the canvas; null off the pane)
const pixelAt = (x, y) => ev(`(() => {
  const q = __cmwGlobeXY('L', ${x}, ${y}), c = document.getElementById('canvasL');
  if (!q) return null;
  const k = c.width / c.getBoundingClientRect().width, px = Math.round(q[0] * k), py = Math.round(q[1] * k);
  if (px < 0 || py < 0 || px >= c.width || py >= c.height) return null;
  const s = document.createElement('canvas'); s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  return Array.from(g.getImageData(px, py, 1, 1).data.slice(0, 3));
})()`);
const sat = (p) => Math.max(...p) - Math.min(...p);
await view(1200, 800, false, false);
const ns = 'svsc' + Date.now();
const st = {
  v3: true, v4: true, v5: true, v6: true, alpha: 1, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }],
};
await seed(ns, st);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function'` });
await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: 'all', T: 1 }); 1`); await quiet();
const Z = [[0.3, 0.3], [0.6, 0.2], [0.4, -0.2], [0.2, 0.5]];
const rest = [];
for (const [x, y] of Z) rest.push(await pixelAt(x, y));
R.rest = rest;
ok('at rest on plane z: the sample points are in colour on the globe', rest.every((p) => p && sat(p) > SAT_MIN), rest);
ok('the frame rest settles', await grab('rest'), null);
// (plane w1's resting globe, for the control's cross-fade and the end)
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await quiet();
ok('the frame rest1 settles', await grab('rest1'), null);
await ev(`__cmwSteps({ go: 0, now: true }); 1`); await quiet();
// (the globe's frame drawn by the inverse pass, waited for after the thread is placed)
const inverseDrawn = () => settled({ max: 10000, until: "__cmwSvGlobe(0, 0).path === 'inverse'" });
await ev(`__cmwSteps({ x: 0.002 }); 1`);
await quiet();
await inverseDrawn();
ok('the frame start settles', await grab('start'), null);
R.start = { path: await ev('__cmwSvGlobe(0, 0).path'), differ: await compare('rest', 'start') };
ok(`just past plane z the moving globe is the resting globe (a mean within ${END_MEAN} levels), with no blend`,
  R.start.path === 'inverse' && R.start.differ.mean <= END_MEAN, R.start);
R.parked = {};
for (const u of [0.25, 0.5, 0.75]) {
  await ev(`__cmwSteps({ park: ${u} }); 1`);
  await quiet();
  await inverseDrawn();
  const g = await ev('__cmwSvGlobe(0, 0)');
  ok(`u = ${u}: the globe draws the carried colour per pixel (the inverse pass)`, !!(g && g.path === 'inverse'), g);
  ok(`u = ${u}: the moving globe settles`, await grab('F' + u), null);
  const j = await globeJudge('rest', 'F' + u);
  ok(`u = ${u}: the moving globe is the exact picture at u (globeJudge)`, j.pass, j);
  // (H_u(z) = z^(1 + u) takes two points of plane z to each w near the negative real axis: the judge's front of them)
  ok(`u = ${u}: points the glide covers twice are graded too`, j.several > 0, j);
  ok(`u = ${u}: the cross-fade frame exists`, await fade('rest', 'rest1', u, 'X' + u), null);
  const c = await globeJudge('rest', 'X' + u);
  ok(`u = ${u}: control: a cross-fade of the two planes' globes is not the exact picture`, !c.pass && c.n >= GLOBE_MIN_N, c);
  R.parked[u] = { carried: !!(g && g.carried), u: g && g.u, judge: j, control: c };
}
// (the other end: just before plane w1, against plane w1 at rest)
await ev(`__cmwSteps({ x: 0.998 }); 1`);
await quiet();
await inverseDrawn();
ok('the frame end settles', await grab('end'), null);
R.end = { path: await ev('__cmwSvGlobe(0, 0).path'), differ: await compare('rest1', 'end') };
ok(`just before plane w1 the moving globe is the resting globe of w1 (a mean within ${END_MEAN} levels on the whole frame)`,
  R.end.path === 'inverse' && R.end.differ.mean <= END_MEAN, R.end);
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

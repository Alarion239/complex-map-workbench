// The globe's depth again after the steps view's carried colour (drawSphere): the passes after the carried colour
// (the regions, their outlines, the preimages) are tested against the globe's depth, drawn again with the colour writes
// off. It is drawn by the depth-only program sphereDepth (SPHERE_VS's geometry, no colour), not by the colour globe's
// program P. z² then exp on the Sphere surface, Everywhere, a disc region, the glide from w₁ to w₂ held at x = 1.5,
// which the carried meshes draw (exp's homotopy after z² has no inverse plan there):
// - the frame's carried colour is drawn by the mesh path;
// - the depth again is drawn by sphereDepth (GLR._depthAgain counts the passes each program drew), once linked;
// - the frame is the frame with the depth again drawn by P, not a pixel more than SAME_TOL apart (both drawn as the
//   view draws its frames, read once the view is quiet);
// - control: left out, the frame differs from P's at at least SHOWN_MIN pixels, so the pass shapes this picture and the
//   row above can see a wrong depth;
// - info.cost: the left pane's ms a frame with each program.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const X = 1.5, SAME_TOL = 0, SHOWN_MIN = 500;
await view(1200, 800, false, false);
const ns = 'svdepth' + Date.now();
await seed(ns, {
  v3: true, v4: true, v5: true, v6: true, alpha: 1, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'exp', params: {}, on: true }],
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function' && !!window.GLR` });
// (the moving paths off: their traces on the globe are drawn again after the view is quiet, which these rows do not read)
await ev(`__cmwSet('morphPaths', false); __cmwSteps({ go: 1, now: true, surf: 'sphere', scope: 'all' }); 1`);
await settled({ max: 90000 });
await ev(`GLR._depthAgain = { P: false, skip: false, depth: 0, colour: 0, skipped: 0 }; __cmwSteps({ x: ${X} }); 1`);
await settled({ max: 90000 });
// the frame at X with the depth again drawn as asked (P, skip), FRAMES frames drawn as the view draws a frame
// (__cmwSteps({ x }) asks for one), the last read once the view is quiet: { tag, counts: the passes each program drew,
// left out, in those frames }; the rows ask for exactly FRAMES, so a frame not drawn in the wait is a red row
const FRAMES = 2;
const QUIET = '__cmwSteps().ready.ready && GLR.pendingLinks === 0';
const frame = async (tag, o) => {
  await ev(`Object.assign(GLR._depthAgain, { P: ${!!o.P}, skip: ${!!o.skip}, depth: 0, colour: 0, skipped: 0 }), 1`);
  for (let n = 1; n <= FRAMES; n++) {
    await ev(`__cmwSteps({ x: ${X} }), 1`);
    await settled({ max: 90000, until: `${QUIET} && GLR._depthAgain.depth + GLR._depthAgain.colour + GLR._depthAgain.skipped >= ${n}` });
  }
  ok(`${tag}: the frame is read`, !!(await grab(tag)), null);
  return { tag, counts: await ev('Object.assign({}, GLR._depthAgain)') };
};
// (the depth program links on its first use; the frames before it draw the pass with P)
await settled({ max: 30000, until: `(__cmwTime(1), GLR._depthAgain.depth > 0)` });
const g = info.globe = await ev('(({ carried, path, a, b, u }) => ({ carried, path, a, b, u }))(__cmwSvGlobe())');
ok(`x = ${X}: the globe's frame draws the carried colour by the carried meshes`, g.carried && g.path === 'mesh', g);
const dep = info.depth = await frame('dep', {});
ok(`the depth again is drawn by the depth-only program sphereDepth, in each of ${FRAMES} frames`, dep.counts.depth === FRAMES && dep.counts.colour === 0, dep);
const col = info.colourP = await frame('col', { P: true });
ok(`(with P asked) the depth again is drawn by the colour program, in each of ${FRAMES} frames`, col.counts.colour === FRAMES && col.counts.depth === 0, col);
const same = info.same = await compare(dep.tag, col.tag);
ok(`the frame with sphereDepth is the frame with P (at most ${SAME_TOL} apart in a channel)`, !!same && same.max <= SAME_TOL, same);
const skip = info.skip = await frame('skip', { skip: true });
ok(`(the control) the depth again is left out, in each of ${FRAMES} frames`, skip.counts.skipped === FRAMES && skip.counts.depth + skip.counts.colour === 0, skip);
const shown = info.shown = await compare(skip.tag, col.tag);
ok(`control: without the depth again the frame differs at at least ${SHOWN_MIN} pixels`, !!shown && shown.frac * shown.px >= SHOWN_MIN, shown);
const cost = async (P) => {
  await ev(`Object.assign(GLR._depthAgain, { P: ${P}, skip: false }), __cmwTime(1), 1`);
  const t = [];
  for (let i = 0; i < 3; i++) t.push(await ev('__cmwTime(1).left'));
  return t.sort((a, b) => a - b)[1];
};
info.cost = { depth: await cost(false), colour: await cost(true) };
await ev('GLR._depthAgain = null; 1');
return { pass: fails.length === 0, fails, info };

// The steps view's rest frame of a map whose sheets tie (z³: about the window centre every w has three sheets at the same
// distance D, so which sheet is in front is decided by the sheets' depth keys alone). The frame has to be smooth: the colour
// carried from z changes slowly across w (a hue per sheet, three sheets round the centre), so the 3 x 3 pixels about a point
// of the pane are nearly one colour. When the front sheet flips from one fragment to the next, they are not: the frame speckles.
// - the exact pass's frame (the plane at rest) is smooth by this measure: at most SMOOTH_MAX of the points are rough;
// - so is a frame of an All-at-once glide over [z³, 1 z] near its end (map mode 3), which the inverse pass draws, each step
//   at its own time (invSpanPath, #1742): at most ROUGH_MARGIN more of its points are rough than the rest frame's.
// - so is the carried meshes' frame of the same plane, every shape forced forward (__cmwForceForward(['__svAll']),
//   as for a step with no exact inverse), whose sheets' ties are resolved per pixel (GLR.carryResolve): at most
//   ROUGH_MARGIN more of its points are rough than the exact pass's (#1647).
// Each page is opened in the steps view (carry_kit's openSteps: test.html?view=steps).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { DRAWN, openSteps, toPlane, rough } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// (the roughness: carry_kit's rough(), its 20 x 14 grid 0.09 apart about the window centre; a point is rough over a spread of 30)
const SMOOTH_MAX = 0.1;            // the share of rough points the exact pass's frame may have
const ROUGH_MARGIN = 0.05;         // the share of points more than the rest frame's that the All-at-once frame may have rough
const DRAWN_WAIT = 60000, GLIDE_WAIT = 120000;   // ms
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;   // the glide's time a frame while it runs, and once frozen
const NEAR_END_X = 1.9;            // the All-at-once glide is frozen once the thread is past this, near its end on plane 2
await view(1200, 800, false, false);
const ZCUBE = [{ type: 'pown', params: { n: 3 }, on: true }];
// z³ at rest on plane 1, colour from z
const roughShare = async () => {
  await openSteps(PORT, ZCUBE);
  await toPlane(1);
  return rough();
};
const exactFrame = await roughShare();
info.exact = exactFrame;
ok('the page reads the grid', exactFrame.n >= 0.9 * exactFrame.of, info);
ok(`the exact pass's frame of z³ is smooth: at most ${SMOOTH_MAX * 100} % of the points are rough`, exactFrame.share <= SMOOTH_MAX, exactFrame);
// the carried meshes' frame of the same plane (every shape forced forward): where the sheets tie, the front sheet is the
// same from one fragment to the next (carryResolve)
await openSteps(PORT, ZCUBE);
await ev(`__cmwForceForward(['__svAll']); 1`);
await toPlane(1);
const meshFrame = await rough();
info.mesh = Object.assign(meshFrame, await ev('(() => { const q = __cmwSteps(); return { rest: q.rest, tieBand: q.tieBand, resolved: q.resolved }; })()'));
ok('the page reads the meshes\' grid', meshFrame.n >= 0.9 * meshFrame.of, meshFrame);
ok('the forced frame is drawn by the carried meshes', !!meshFrame.rest && meshFrame.rest.path === 'mesh', info.mesh);
ok(`the carried meshes' frame of z³ is as smooth as the exact pass's (within ${ROUGH_MARGIN * 100} % of the points)`, meshFrame.share <= exactFrame.share + ROUGH_MARGIN, { mesh: meshFrame, exact: exactFrame });
// an All-at-once glide over [z³, 1 z], frozen near its end: a frame of the span's map (mode 3), drawn by the inverse pass
await openSteps(PORT, ZCUBE.concat([{ type: 'mul', params: { c: '1' }, on: true }]), { homAll: true });
await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev('__cmwSteps({ go: 2 })');
await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${NEAR_END_X}`, only: true });
await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
await settled({ max: DRAWN_WAIT, until: DRAWN });
const glide = await ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, mode: q.between && q.between.mode, rec: q.glide && { all: q.glide.all, path: q.glide.path, reason: q.glide.reason } }; })()');
info.glide = glide;
ok('the glide is frozen near its end, short of plane 2, all at once (map mode 3)', glide.all && glide.mode === 3 && glide.x > NEAR_END_X && glide.x < 2, glide);
ok('the All-at-once frame is drawn by the inverse pass', !!glide.rec && glide.rec.all === true && glide.rec.path === 'inverse', glide.rec);
const allFrame = await rough();
info.all = allFrame;
ok('the page reads the All-at-once frame\'s grid', allFrame.n >= 0.9 * allFrame.of, allFrame);
ok(`an All-at-once glide's frame of z³ is as smooth as the rest frame (within ${ROUGH_MARGIN * 100} % of the points)`, allFrame.share <= exactFrame.share + ROUGH_MARGIN, { all: allFrame, exact: exactFrame });
return { pass: fails.length === 0, fails, info };

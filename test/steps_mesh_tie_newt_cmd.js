// The carried meshes' frames of a map whose sheets tie, where the inverse pass does not draw (#1054): z³ then cos, colour
// from z, Everywhere. About the window's centre every w has three sheets of z³ at the same distance D, so the sheet key
// alone decides which one is in front (larger Im z, the tie order). Its plane at rest (cos has no exact inverse) and its
// glide a step at a time from plane 1 to 2 are both drawn by the carried meshes (the rest and glide records say 'mesh').
// The frame has to be as smooth as the same frame with the window moved off z = 0 by OFF_CX: there the three sheets are at
// different distances, so none tie and the key orders them by D, through the same meshes, the same map and cos's same
// detail. A front sheet that flips from one triangle of the mesh to the next (the tie decided by the mesh's own error in
// the key) makes the 3 x 3 pixels about a point differ: at most ROUGH_MARGIN more of the points may be rough.
// The tied frames are drawn through the resolve of ties (GLR.carryResolve: __cmwSteps().resolved counts its frames), and the
// off-centre ones, whose sheets cannot tie, are not: they draw each mesh once.
// The control: z³ then 1 z at rest on plane 2, the same ties drawn by the inverse pass (which orders keys within its band
// by the tie order, Inverse.order), is smooth by the same measure: at most SMOOTH_MAX of its points are rough.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { DRAWN, openSteps, toPlane, rough } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// (the roughness: carry_kit's rough(), its 20 x 14 grid 0.09 apart about the window centre; a point is rough over a spread of 30)
const SMOOTH_MAX = 0.1;            // the share of rough points the inverse pass's frame may have
const ROUGH_MARGIN = 0.05;         // the share of points more than the off-centre frame's that the centred frame may have rough
const OFF_CX = 0.4;                // the window's centre off z = 0 (plane units) for the frames without ties
const DRAWN_WAIT = 60000, GLIDE_WAIT = 120000, REST_WAIT = 20000;   // ms
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;   // the glide's time a frame while it runs, and once frozen
const FREEZE_X = 1.6;              // the glide from plane 1 is frozen once the thread is past this, short of plane 2
await view(1200, 800, false, false);
const ZCUBE = { type: 'pown', params: { n: 3 }, on: true };
const STEPS = [ZCUBE, { type: 'cos', params: {}, on: true }], CONTROL = [ZCUBE, { type: 'mul', params: { c: '1' }, on: true }];
const open = (cx, steps = STEPS) => openSteps(PORT, steps, { srcView: { cx, cy: 0, s: 80 } });
// plane 2 at rest, the window's centre at cx
const restFrame = async (cx, steps) => {
  await open(cx, steps);
  await toPlane(2);
  await settled({ max: REST_WAIT, until: '!!__cmwSteps().rest && __cmwSteps().rest.a === 2' });
  const rest = await ev('(() => { const r = __cmwSteps().rest; return r && { a: r.a, path: r.path }; })()');
  return Object.assign({ rest, resolved: await ev('__cmwSteps().resolved') }, await rough());
};
// the glide from plane 1 to 2, a step at a time, frozen past FREEZE_X, the window's centre at cx
const glideFrame = async (cx) => {
  await open(cx);
  await toPlane(1);
  await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev('__cmwSteps({ go: 2 })');
  await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${FREEZE_X}`, only: true });
  await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
  await settled({ max: DRAWN_WAIT, until: DRAWN });
  const glide = await ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, rec: q.glide && { path: q.glide.path, reason: q.glide.reason } }; })()');
  return Object.assign({ glide, resolved: await ev('__cmwSteps().resolved') }, await rough());
};
const control = await restFrame(0, CONTROL);
info.control = control;
ok('the page reads the control\'s grid', control.n >= 0.9 * control.of, control);
ok('the control, z³ then 1 z at rest on plane 2, is drawn by the inverse pass', !!control.rest && control.rest.a === 2 && control.rest.path === 'inverse', control.rest);
ok(`the inverse pass's frame of z³'s tied sheets is smooth: at most ${SMOOTH_MAX * 100} % of the points are rough`, control.share <= SMOOTH_MAX, control);
const legs = [['rest', restFrame, 'plane 2 at rest'], ['glide', glideFrame, 'the glide from plane 1 to 2']];
for (const [key, frame, what] of legs) {
  const off = await frame(OFF_CX), tie = await frame(0);
  info[key] = { tie, off };
  for (const [f, where] of [[tie, 'centred'], [off, 'off-centre']]) {
    ok(`the page reads the grid of ${what} (${where})`, f.n >= 0.9 * f.of, f);
    if (key === 'rest') ok(`${what} (${where}) is drawn by the carried meshes`, !!f.rest && f.rest.a === 2 && f.rest.path === 'mesh', f.rest);
    else ok(`${what} (${where}) is frozen a step at a time, short of plane 2, and drawn by the carried meshes`, !f.glide.all && f.glide.x > FREEZE_X && f.glide.x < 2 && !!f.glide.rec && f.glide.rec.path === 'mesh', f.glide);
  }
  ok(`${what} (centred) is drawn through the resolve of ties, and off the centre without it`, tie.resolved > 0 && off.resolved === 0, { tie: tie.resolved, off: off.resolved });
  ok(`the carried meshes' frame of ${what}, where z³'s sheets tie, is as smooth as off the centre (within ${ROUGH_MARGIN * 100} % of the points)`, tie.share <= off.share + ROUGH_MARGIN, { tie, off });
}
return { pass: fails.length === 0, fails, info };

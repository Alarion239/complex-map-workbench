// The steps view's rest frame of a map whose sheets tie (z³: about the window centre every w has three sheets at the same
// distance D, so which sheet is in front is decided by the sheets' depth keys alone). The frame has to be smooth: the colour
// carried from z changes slowly across w (a hue per sheet, three sheets round the centre), so the 3 x 3 pixels about a point
// of the pane are nearly one colour. When the front sheet flips from one fragment to the next, they are not: the frame speckles.
// - the exact pass's frame (the plane at rest) is smooth by this measure: at most SMOOTH_MAX of the points are rough;
// - so is a frame of an All-at-once glide over [z³, 1 z] near its end (map mode 3), which the inverse pass draws, each step
//   at its own time (invSpanPath, #1742): at most ROUGH_MARGIN more of its points are rough than the rest frame's.
// The carried meshes' frame of the same plane (every shape forced forward, __cmwForceForward(['__svAll'])) is not yet: its leg
// waits on #1647, and comes back with the same measure when that is fixed.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const NX = 20, NY = 14;            // the points: a grid of NX x NY about the window centre
const STEP = 0.09;                 // the grid's spacing in plane units; the grid covers the middle of the pane
const SKEW = [0.003, 0.002];       // a shift off the exact centre and off the quadrant seams, plane units
const ROUGH_SPREAD = 30;           // the largest channel spread (0..255) over a point's 3 x 3 pixels above which the point is rough
const SMOOTH_MAX = 0.1;            // the share of rough points the exact pass's frame may have
const ROUGH_MARGIN = 0.05;         // the share of points more than the rest frame's that the All-at-once frame may have rough
const FIXED_WAIT = 15000, DRAWN_WAIT = 60000, START_WAIT = 30000, GLIDE_WAIT = 120000;   // ms
const GLIDE_CLOCK_MS = 20, FREEZE_CLOCK_MS = 1e-9;   // the glide's time a frame while it runs, and once frozen
const NEAR_END_X = 1.9;            // the All-at-once glide is frozen once the thread is past this, near its end on plane 2
await view(1200, 800, false, false);
const ZCUBE = [{ type: 'pown', params: { n: 3 }, on: true }];
const drawn = `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()`;
const open = async (steps, extra = {}) => {
  const ns = 'svmt' + Date.now();
  const st = Object.assign({ v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [], steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } }, extra);
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
};
// the share of the grid's points that are rough in the frame on the pane now
const measure = async () => {
  const V = (await lpx([])).view, pts = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) pts.push([V.cx + (i - (NX - 1) / 2) * STEP + SKEW[0], V.cy + (j - (NY - 1) / 2) * STEP + SKEW[1]]);
  const spread = (await lpx(pts)).px.filter(Boolean).map((p) => Math.max(...[0, 1, 2].map((c) => Math.max(...p.map((x) => x[c])) - Math.min(...p.map((x) => x[c])))));
  return { n: spread.length, rough: spread.filter((s) => s > ROUGH_SPREAD).length, share: spread.filter((s) => s > ROUGH_SPREAD).length / spread.length };
};
// z³ at rest on plane 1, colour from z
const roughShare = async () => {
  await open(ZCUBE);
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
  await settled({ max: FIXED_WAIT, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving && __cmwSvFixed()` });
  await settled({ max: DRAWN_WAIT, until: `__cmwSvFixed() && ${drawn}` });
  return measure();
};
const exactFrame = await roughShare();
info.exact = exactFrame;
ok('the page reads the grid', exactFrame.n >= 0.9 * NX * NY, info);
ok(`the exact pass's frame of z³ is smooth: at most ${SMOOTH_MAX * 100} % of the points are rough`, exactFrame.share <= SMOOTH_MAX, exactFrame);
// an All-at-once glide over [z³, 1 z], frozen near its end: a frame of the span's map (mode 3), drawn by the inverse pass
await open(ZCUBE.concat([{ type: 'mul', params: { c: '1' }, on: true }]), { homAll: true });
await ev(`__cmwSteps({ clock: ${GLIDE_CLOCK_MS} })`); await ev('__cmwSteps({ go: 2 })');
await settled({ max: GLIDE_WAIT, until: `__cmwSteps().x > ${NEAR_END_X}`, only: true });
await ev(`__cmwSteps({ clock: ${FREEZE_CLOCK_MS} })`);
await settled({ max: DRAWN_WAIT, until: drawn });
const glide = await ev('(() => { const q = __cmwSteps(); return { x: q.x, all: q.all, mode: q.between && q.between.mode, rec: q.glide && { all: q.glide.all, path: q.glide.path, reason: q.glide.reason } }; })()');
info.glide = glide;
ok('the glide is frozen near its end, short of plane 2, all at once (map mode 3)', glide.all && glide.mode === 3 && glide.x > NEAR_END_X && glide.x < 2, glide);
ok('the All-at-once frame is drawn by the inverse pass', !!glide.rec && glide.rec.all === true && glide.rec.path === 'inverse', glide.rec);
const allFrame = await measure();
info.all = allFrame;
ok('the page reads the All-at-once frame\'s grid', allFrame.n >= 0.9 * NX * NY, allFrame);
ok(`an All-at-once glide's frame of z³ is as smooth as the rest frame (within ${ROUGH_MARGIN * 100} % of the points)`, allFrame.share <= exactFrame.share + ROUGH_MARGIN, { all: allFrame, exact: exactFrame });
return { pass: fails.length === 0, fails, info };

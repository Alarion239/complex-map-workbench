// The steps view's rest frame of a map whose sheets tie (z³: about the window centre every w has three sheets at the same
// distance D, so which sheet is in front is decided by the sheets' depth keys alone). The frame has to be smooth: the colour
// carried from z changes slowly across w (a hue per sheet, three sheets round the centre), so the 3 x 3 pixels about a point
// of the pane are nearly one colour. When the front sheet flips from one fragment to the next, they are not: the frame speckles.
// - the exact pass's frame (the plane at rest) is smooth by this measure: at most SMOOTH_MAX of the points are rough.
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
const FIXED_WAIT = 15000, DRAWN_WAIT = 60000, START_WAIT = 30000;   // ms
await view(1200, 800, false, false);
const roughShare = async () => {
  const ns = 'svmt' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, alpha: 1, shapes: [],
    steps: [{ type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps`);
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
  await settled({ max: FIXED_WAIT, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving && __cmwSvFixed()` });
  await settled({ max: DRAWN_WAIT, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
  const V = (await lpx([])).view, pts = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) pts.push([V.cx + (i - (NX - 1) / 2) * STEP + SKEW[0], V.cy + (j - (NY - 1) / 2) * STEP + SKEW[1]]);
  const spread = (await lpx(pts)).px.filter(Boolean).map((p) => Math.max(...[0, 1, 2].map((c) => Math.max(...p.map((x) => x[c])) - Math.min(...p.map((x) => x[c])))));
  return { n: spread.length, rough: spread.filter((s) => s > ROUGH_SPREAD).length, share: spread.filter((s) => s > ROUGH_SPREAD).length / spread.length };
};
const exactFrame = await roughShare();
info.exact = exactFrame;
ok('the page reads the grid', exactFrame.n >= 0.9 * NX * NY, info);
ok(`the exact pass's frame of z³ is smooth: at most ${SMOOTH_MAX * 100} % of the points are rough`, exactFrame.share <= SMOOTH_MAX, exactFrame);
return { pass: fails.length === 0, fails, info };

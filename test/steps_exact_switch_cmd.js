// The steps view's rest frame is the exact pass's whatever a saved exactImages (an internal switch, no option in the page) says,
// and nothing else changes with it:
// - at rest on a plane past the colour plane, the frame with the switch off is the frame with it on (the exact pass's);
// - a glide frame under the switch off is the same as under the switch on, drawn by the inverse pass ('inverse');
// - the classic view still takes the switch: with it off a region is drawn forward ('exact images off'), with it on by the
//   inverse pass.
// A control: the measure tells two different frames apart (plane 0's rest frame against plane 1's).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const { lpx } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const NX = 20, NY = 14;            // the points: a grid of NX x NY about the window centre
const STEP = 0.09;                 // the grid's spacing in plane units
const SKEW = [0.003, 0.002];       // a shift off the exact centre and off the quadrant seams, plane units
const POINT_TOL = 6;               // the largest channel difference (0..255) at which two frames' point is the same colour
const SAME_SHARE = 0.02;           // the share of the points two frames of one picture may differ at
const GLIDE_X = 0.5;               // the glide's place between plane 0 and plane 1
const FIXED_WAIT = 15000, DRAWN_WAIT = 60000, START_WAIT = 30000;   // ms
await view(1200, 800, false, false);
const state = (exact) => ({ v3: true, v4: true, v5: true, v6: true, exactImages: exact, alpha: 1, shapes: [],
  steps: [{ type: 'pown', params: { n: 3 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } });
const open = async (st, query) => {
  const ns = 'svsw' + Date.now();
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en${query}` });
};
const drawn = () => settled({ max: DRAWN_WAIT, until: `(() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
const openSteps = async (exact) => {
  await open(state(exact), '&view=steps');
  await settled({ max: START_WAIT, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
};
const toPlane = async (i) => {
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="${i}"]').click(); 1`);
  await settled({ max: FIXED_WAIT, until: `__cmwSteps().stage === ${i} && !__cmwSteps().moving && __cmwSvFixed()` });
  await settled({ max: DRAWN_WAIT, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
};
const points = async () => {
  const V = (await lpx([])).view, pts = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) pts.push([V.cx + (i - (NX - 1) / 2) * STEP + SKEW[0], V.cy + (j - (NY - 1) / 2) * STEP + SKEW[1]]);
  return (await lpx(pts)).px.map((p) => p && p[4]);
};
// the share of the points at which two frames' colours are more than POINT_TOL apart (points read in both)
const differ = (a, b) => {
  let n = 0, d = 0;
  a.forEach((x, i) => { const y = b[i]; if (!x || !y) return; n++; if (Math.max(...[0, 1, 2].map((c) => Math.abs(x[c] - y[c]))) > POINT_TOL) d++; });
  return { n, d, share: n ? d / n : 1 };
};
// the plane's rest frame (plane 1), then its glide frame, then plane 0's rest frame, with the switch on and off
const run = async (exact) => {
  await openSteps(exact);
  await toPlane(1);
  const rest = await points();
  await ev(`__cmwSteps({ x: ${GLIDE_X} }); 1`);
  // (the view parked between two planes counts as moving, so the wait is for the parked frame's own glide record: no glide
  // or play under way, and the record of the frame at u = GLIDE_X, which a frame of the glide to plane 1 does not write)
  await settled({ max: DRAWN_WAIT, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play && !!s.glide && Math.abs(s.glide.u - ${GLIDE_X}) < 1e-9 && !!s.glide.path; })()` });
  await drawn();
  const glide = await points(), glidePath = await ev(`(__cmwSteps().glide || {}).path`);
  await toPlane(0);
  const plane0 = await points();
  return { rest, glide, plane0, glidePath };
};
const on = await run(true), off = await run(false);
info.n = on.rest.filter(Boolean).length;
ok('the page reads the grid', info.n >= 0.9 * NX * NY && off.rest.filter(Boolean).length >= 0.9 * NX * NY, info);
const restSame = differ(on.rest, off.rest), glideSame = differ(on.glide, off.glide), ctl = differ(on.rest, on.plane0);
info.rest = restSame; info.glide = glideSame; info.control = ctl; info.glideRec = { on: on.glidePath, off: off.glidePath };
ok(`at rest the frame with the switch off is the frame with it on (at most ${SAME_SHARE * 100} % of the points differ)`, restSame.share <= SAME_SHARE, restSame);
ok(`a glide frame under the switch off is the one under the switch on (at most ${SAME_SHARE * 100} % of the points differ)`, glideSame.share <= SAME_SHARE, glideSame);
ok('a glide is drawn by the inverse pass under the switch off, as under the switch on', on.glidePath === 'inverse' && off.glidePath === 'inverse', info.glideRec);
ok(`control: the measure tells plane 1's rest frame from plane 0's (over ${SAME_SHARE * 100} % of the points differ)`, ctl.share > SAME_SHARE, ctl);
// the classic view: a region's path takes the switch
const classicPath = async (exact) => {
  const st = Object.assign(state(exact), { shapes: [{ id: 's1', kind: 'disc', c: [0.3, 0.1], r: 1, ci: 0, visible: true }], steps: [{ type: 'pown', params: { n: 2 }, on: true }] });
  await open(st, '&view=classic');
  await settled({ max: START_WAIT, until: `typeof __cmwPaths === 'function'` });
  await drawn();
  return JSON.parse(await ev(`JSON.stringify(__cmwPaths())`));
};
const cOn = await classicPath(true), cOff = await classicPath(false);
// (the classic left pane draws the source plane, an identity map that is always forward: the image is the right pane's)
const pick = (r) => r.filter((e) => e.id === 's1' && e.role === 'R').map((e) => ({ role: e.role, path: e.path, reason: e.reason }));
info.classic = { on: pick(cOn), off: pick(cOff) };
ok('classic: with the switch on a region is drawn by the inverse pass', pick(cOn).length > 0 && pick(cOn).every((e) => e.path === 'inverse'), info.classic.on);
ok("classic: with the switch off the same region is drawn forward ('exact images off')", pick(cOff).length > 0 && pick(cOff).every((e) => e.path === 'forward' && e.reason === 'exact images off'), info.classic.off);
return { pass: fails.length === 0, fails, info };

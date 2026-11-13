// The steps view's glide record says why a frame took the carried mesh (svGlideRec: path, reason):
// - a scene whose only shape is a curve (no area region), Inside regions, glide z -> w1: nothing region-wise is drawn, so
//   the frame's path reads 'none' with the reason "no area region to draw", not 'mesh' with a d/dz reason (there is no
//   d/dz step in the chain);
// - control: an area region on a plane behind a real d/dz step still reads the d/dz reason, as 'mesh';
// - control: an area region on plane 0 is drawn by the inverse pass, with no reason.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const U = 0.5;   // the glide's frame: halfway from plane 0 to plane 1
const DEFL_REASON = 'a region of a plane behind a d/dz step', NO_AREA = 'no area region to draw';
const scene = (shapes, steps) => ({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, shapes, steps, srcView: { cx: 0, cy: 0, s: 90 } });
const CURVE = { id: 'c1', kind: 'curve', pts: [[-1, 0], [-0.5, 0.6], [0, 0.2], [0.5, 0.8], [1, 0.1]], ci: 0, visible: true };
const DISC = (extra) => Object.assign({ id: 'd1', kind: 'disc', c: [0.3, 0.2], r: 1.4, ci: 0, visible: true }, extra || {});
const POWN = { type: 'pown', params: { n: 2 }, on: true }, DERIV = { type: 'deriv', params: {}, on: true };
const open = async (st) => {
  const ns = `sgl${Date.now() % 1000000}`;
  await view(1200, 800, false, false);
  await go(`${BASE}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`${BASE}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
  await ev(`__cmwSteps({ scope: 'in' }); 1`);
  await settled({ max: 30000, panes: false });
};
const glideAt = async (x) => {
  await ev(`__cmwSteps(${JSON.stringify({ x })}); 1`);
  await settled({ max: 30000, panes: false });
  return ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
};
{
  await open(scene([CURVE], [POWN]));
  const g = await glideAt(U);
  info.curveOnly = g;
  ok('a curve only (no area), Inside regions: the frame reads path none', !!g && g.b === 1 && g.path === 'none', g);
  ok('a curve only: the reason says there is no area region, not a d/dz step', !!g && g.reason === NO_AREA, g);
}
{
  await open(scene([DISC({ stage: 2 })], [POWN, DERIV]));
  const g = await glideAt(U);
  info.behindDeriv = g;
  ok('a region on a plane behind a real d/dz step: the frame takes the mesh', !!g && g.b === 1 && g.path === 'mesh', g);
  ok('a region behind a real d/dz step: the reason is the d/dz one', !!g && g.reason === DEFL_REASON, g);
}
{
  await open(scene([DISC()], [POWN]));
  const g = await glideAt(U);
  info.areaOnPlane0 = g;
  ok('an area region on plane 0: the frame is drawn by the inverse pass', !!g && g.b === 1 && g.path === 'inverse', g);
  ok('an area region on plane 0: no reason', !!g && g.reason == null, g);
}
return { pass: fails.length === 0, fails: fails.slice(0, 10), info };

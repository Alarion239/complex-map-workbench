// The steps view's globe at rest past the colour plane, drawn by the carried mesh (#590): the mesh orders its sheets
// by the sheet key the inverse pass and the 2D carried meshes use (svSheetKey, from the tiling's window clipWin), not
// by a window of its own around the camera. A step with no inverse plan (z + 0.2 conj(z), not analytic) from plane z,
// coloured from z, at rest on w₁, Everywhere, on the Sphere: the globe's path is 'mesh', and the key the mesh was built
// with (__cmwSvGlobe().meshWin) has clipWin's window. Then the camera S.srcView is moved off clipWin by PAN of its
// width (less than the 0.3 that re-centres clipWin, so clipWin stays): the key's window is clipWin's still, where a
// window around the camera would move with it.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
// (PAN: the camera's move, a share of clipWin's width; EPS: the windows' match, a share of that width)
const PAN = 0.2, EPS = 1e-9;
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && GLR.pendingLinks === 0 && __cmwSvFixed() && !(window.__cmwSphere && __cmwSphere().running)";
const quiet = async () => {
  await settled({ max: 60000, until: QUIET_UNTIL });
  await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
};
const same = (a, b, w) => !!a && !!b && ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(a[k] - b[k]) <= EPS * w);
const globe = () => ev('(() => { const g = __cmwSvGlobe(0, 0); return { path: g.path, meshWin: g.meshWin, clipWin: g.clipWin }; })()');

await view(1200, 800, false, false);
const state = { v3: true, v4: true, v5: true, v6: true, shapes: [], steps: [{ type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const ns = `svgk${Date.now()}`;
await go(`http://localhost:${PORT}/gl-helpers.html`);
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function' && !!window.GLR" });
await ev(`__cmwSet('morphPaths', false); __cmwSteps({ go: 1, now: true, T: 0, scope: 'all', surf: 'sphere' }); 1`);
await quiet();

R.rest = await globe();
const c = R.rest.clipWin, W = c ? c.x1 - c.x0 : 0;
ok('at rest on w1, coloured from z, the globe is drawn by the carried mesh', R.rest.path === 'mesh', R.rest);
ok("the mesh's sheet key has clipWin's window", W > 0 && same(R.rest.meshWin, c, W), R.rest);

// (the camera moved off clipWin by PAN of its width, clipWin kept)
R.src = (await ev('__cmwLandViews()')).src;
await ev(`__cmwSet('srcView', { cx: ${JSON.stringify(R.src.cx)} + ${PAN * W}, cy: ${JSON.stringify(R.src.cy)}, s: ${JSON.stringify(R.src.s)} }); 1`);
await quiet();
R.panned = await globe();
R.panned.src = (await ev('__cmwLandViews()')).src;
ok(`the camera moved by ${PAN} of clipWin's width, clipWin kept`, Math.abs(R.panned.src.cx - R.src.cx - PAN * W) < 1e-6 * W && same(R.panned.clipWin, c, W), R.panned);
ok('panned, the globe is drawn by the carried mesh', R.panned.path === 'mesh', R.panned);
ok("panned, the mesh's sheet key has clipWin's window still", same(R.panned.meshWin, c, W), R.panned);

R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };

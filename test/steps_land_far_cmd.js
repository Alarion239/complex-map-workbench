// The steps view's carried Landscape past its box: the far patch's height is smooth about the height map's poles. The
// default page (z, exp, Möbius), Everywhere, T = w₁, the glide z → w₁ held at u = 0.25 and 0.5. Plane z outside the carried box
// is carried into the block by the far patch (svLandFar), whose cells are coarse; the height h(F) of that region has a log
// spike at each pole of exp's Möbius image (z = ±3πi, ±5πi, ...), which a coarse cell facets. Each pole in the far
// patch's inner ring gets a pole patch of its own (svLandPatches, svLandHeightPoles). Read on the CPU from the last
// frame's carry (__cmwLandFarErr: for each cell of a far patch outside the pole patches' discs whose centre's image is in
// the block, the four corners' mean of ln(1 + |h|) against its value at the cell's centre):
// - the carried frame draws a pole patch about 3πi and -3πi;
// - at the glide's ends (u = 0.002 and 0.998: the parked plane's heights) the same bound holds for the cells in the block;
// - inside each pole patch, at the patch's own resolution, no cell's chord is off by more than 0.25 either (the far ring's cells
//   are not passing for being moved into a disc);
// - in the inner ring no cell's chord is off by more than 0.25 (0.25 is the height of a quarter of a spike's unit), outside the patches;
// - with the pole patches' discs counted too, cells are off by more than that: the check reads something;
// - the carried frame covers its block (no point bare, __cmwLandCover).
// The outer ring (past four times the box's inscribed circle) is read and not checked: it reaches out to infinity, where
// every pole is a spike the patches cannot all reach.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const TOL = 0.25;
// (the inner ring's points a side: its cell counts below are those of a 256-point ring, scaled by the area of its cells)
const FAR_N = 128;
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landfar${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 0, now: true }); 1`);
await settled({ max: 60000 });
// the far carry is the carried mesh's: a Möbius glide frame is drawn by the exact inverse path by default (a silent fallback to the mesh
// fails the first check), so the frames below run with the mesh switch, with which the same frame is not exact (the control)
await ev(`__cmwSteps({ go: 0, now: true }); 1`);
await settled({ max: 60000 });
await hold(0.5);
const pathOf = () => ev('(() => { const c = __cmwLandCarry(); return c ? c.path || "mesh" : null; })()');
info.pathDefault = await pathOf();
ok('a Möbius glide frame is drawn by the exact inverse path', info.pathDefault === 'inverse', info.pathDefault);
await ev('window.__svScrubUp(), 1');
await settled({ max: 60000 });
await ev('__cmwLandMeshOnly(true); 1');
await ev(`__cmwSteps({ go: 0, now: true }); 1`);
await settled({ max: 60000 });
await hold(0.5);
info.pathMesh = await pathOf();
ok('the control: with the mesh switch the same frame is not drawn by the inverse path', info.pathMesh !== 'inverse', info.pathMesh);
await ev('window.__svScrubUp(), 1');
await settled({ max: 60000 });
for (const u of [0.002, 0.25, 0.5, 0.998]) {
  await ev(`__cmwSteps({ go: 0, now: true }); 1`);
  await settled({ max: 60000 });
  await hold(u);
  const tag = `held at u = ${u}`;
  const c = info[u] = {
    carried: JSON.parse(await ev('JSON.stringify((({ u, s, polar }) => ({ u, s, polar }))(__cmwLandCarry() || {}))')),
    err: JSON.parse(await ev(`JSON.stringify(__cmwLandFarErr(${TOL}))`, 120000)),
    whole: JSON.parse(await ev(`JSON.stringify(__cmwLandFarErr(${TOL}, false))`, 120000)),
    poles: JSON.parse(await ev(`JSON.stringify(__cmwLandFarErr(${TOL}, true, 'polar'))`, 120000)),
    covered: JSON.parse(await ev('JSON.stringify(__cmwLandCover(480, 400, true))', 120000)),
  };
  const at = (y) => (c.carried.polar || []).some(([px, py]) => Math.abs(px) < 1e-6 && Math.abs(py - y) < 1e-6);
  // (at the glide's ends the frame is the parked plane's own heights: the same bound over the cells whose images are in the
  // block, which are few, since the map there is nearly the identity and takes the far ring away from it; the pole patches'
  // cells are not in the block, so the checks that read them are the glide's)
  const end = u < 0.01 || u > 0.99;
  ok(`${tag}: a carried frame from plane z`, c.carried.s === 0 && Math.abs(c.carried.u - u) < 0.004, c.carried);
  ok(`${tag}: the far patch's inner ring has cells, none off by more than ${TOL}${end ? '' : ' outside the pole patches'}`, !!c.err && c.err[0].cells > (end ? 1000 : 10000) * (FAR_N / 256) ** 2 && c.err[0].bad === 0, c.err && c.err[0]);
  if (!end) {
    ok(`${tag}: a pole patch about 3πi and -3πi`, at(3 * Math.PI) && at(-3 * Math.PI), c.carried);
    ok(`${tag}: counting the pole patches' discs too, cells are off by more than ${TOL}`, !!c.whole && c.whole[0].bad > 0, c.whole && c.whole[0]);
    ok(`${tag}: inside each pole patch, at its own resolution, no cell off by more than ${TOL}`, !!c.poles && c.poles.length >= 6 && c.poles.every((q) => q.cells > 100 && q.bad === 0), c.poles);
  }
  ok(`${tag}: the carried frame covers its block`, !!c.covered && c.covered.bare === 0, c.covered);
  await ev('window.__svScrubUp(), 1');
  await settled({ max: 60000 });
}
return { pass: fails.length === 0, fails, info };

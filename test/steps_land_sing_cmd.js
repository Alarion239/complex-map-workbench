// The steps view's Landscape carried through a point where the map is unbounded without being a pole: Möbius
// (z - 0.1i)/(z + 0.1i), then √ (the dipole). Colour from z (T = z), Everywhere, sheets off. Along the glide w₁ → w₂ the
// carry's map from z is the Möbius step to a power p from 1 to 1/2, which goes to ∞ like |z + 0.1i|^-p at the Möbius
// step's pole -0.1i: for p < 1 Newton's method on 1/F does not settle there, and the box grid's |F| next to it is small
// (about 1.3 to 3.3), so the patch search (svLandPatches through svPolesIn with sing) has to refine its starts to that
// point by other means (#1460).
// Read from the last frame's carry (__cmwLandCarry, __cmwLandCover: the points of a 480 x 400 grid over the block that no
// kept carried triangle covers) held at u = 0.1, 0.5 and 0.998 of the glide and at rest on plane w₂:
// - a carried frame from plane z with a patch about -0.1i (within 1e-6);
// - with the box grid alone (the hook without the patches), points are bare, and the patch covers some of them;
// - at u = 0.1 and at rest, no point of the block is bare. (Between them the principal branch of the power reaches only
//   the sector |arg w| < p pi of the block, about 71 % of it at u = 0.5 and 50 % near u = 1: the rest is bare at any
//   resolution.)
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js lists it in.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const STEPS = [{ type: 'mobius', params: { a: '1', b: '-0.1i', c: '1', d: '0.1i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }];
const SING = [0, -0.1];
await view(1440, 900, false, false);
const ns = 'landsing' + Date.now();
await loadView('steps', ns, { shapes: [], steps: STEPS, sheets: false, height: 'im' });
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 0, go: 1, now: true }); 1`);
await settled({ max: 60000 });
const carried = async () => await evJson('JSON.stringify((({ u, s, patches, polar }) => ({ u, s, patches, polar: (polar || []).slice(0, patches || 0).map((p) => [p[0], p[1]]) }))(__cmwLandCarry() || {}))');
const cover = async (patches = true) => await evJson(`JSON.stringify(__cmwLandCover(480, 400, ${patches}))`);
for (const [tag, x, whole] of [['held at u = 0.1', 1.1, true], ['held at u = 0.5', 1.5, false], ['held at u = 0.998', 1.998, false], ['at rest on plane w₂', 2, true]]) {
  await ev(`__cmwSteps({ x: ${x} }); 1`);
  await settled({ max: 60000 });
  await ev(rAF2);
  const c = info[tag] = { carried: await carried(), covered: await cover(), grid: await cover(false) };
  const near = (c.carried.polar || []).some((p) => Math.hypot(p[0] - SING[0], p[1] - SING[1]) < 1e-6);
  ok(`${tag}: a carried frame from plane z`, c.carried.s === 0, c.carried);
  ok(`${tag}: a patch about the singular point -0.1i`, near, c.carried);
  ok(`${tag}: the box grid alone leaves points bare, and the patch covers some of them`, !!c.grid && !!c.covered && c.grid.bare > 0 && c.covered.bare < c.grid.bare, { covered: c.covered, grid: c.grid });
  if (whole) ok(`${tag}: the carried frame covers its block`, !!c.covered && c.covered.bare === 0, c.covered);
}
return { pass: !fails.length, fails, info };

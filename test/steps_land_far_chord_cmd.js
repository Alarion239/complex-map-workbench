// The steps view's Landscape draws the far patches' cells only where their chords are the surface. The far patches are
// the two rings of cells over plane s outside its carried box (up to a thousand box sizes out), where a map that is
// periodic (exp) puts poles of the height inside a cell: with only its corners' heights, the cell's two triangles are a
// flat facet over the pole's peak (boxy terraces beside the centre peak, a tile floating over the low ground). A cell
// whose height at its middle or at its triangles' centroids is more than CHORD_TOL of the height range from the mean of
// its corners' heights is left out.
// The default page (z, exp, Möbius), Everywhere, Landscape, coloured from w1, the thread held (a scrub pressed, not let
// go) at z -> w1 u = 0.25 and 0.5, in the ln |F| height. For each far ring (__cmwLandFar: the triangles of the cells the
// last frame drew, the exact height at each triangle's centroid on the CPU against the mean of its corners' GPU heights):
//  - the drawn triangles that are off by more than CHORD_TOL of the height range: none;
//  - the triangles left out, as a share of those with all three corners placed: at most MAX_LEFT_OUT (the patch is not
//    emptied to meet the first check), and some are drawn.
// (the limits: CHORD_TOL, the share of the height range a drawn chord may be off, below the least step the eye reads as a
// terrace; MAX_LEFT_OUT, the share of a ring's placed triangles that may be left out)
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const CHORD_TOL = 0.1, MAX_LEFT_OUT = 0.05;
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=sfc${Date.now()}`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwLandFar === 'function' && __cmwSteps().planes && __cmwSteps().planes.length > 1` });
await ev(`__cmwSet('morphPaths', false); __cmwSteps({ go: 0, now: true, surf: 'land', scope: 'all', T: 1 }); 1`);
await settled({ max: 60000 });
// the thread pressed on the rail and moved to x between plane 0 and plane 1, not let go: the gliding frame
const hold = async (x) => {
  await ev(`(() => {
    const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const cx = ns[0][0] + (ns[1][0] - ns[0][0]) * ${x}, cy = ns[0][1];
    const e = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 71, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
    e('pointerdown', ns[0][0] - 2); e('pointermove', ns[0][0] + 10); e('pointermove', cx);
    window.__svScrubUp = () => e('pointerup', cx);
    return 1;
  })()`);
  await settled({ max: 60000, until: `GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - ${x}) < 0.01 && __cmwLandFar() && __cmwLandFar().length === 2` });
};
for (const x of [0.25, 0.5]) {
  await hold(x);
  const rings = await ev('__cmwLandFar(' + CHORD_TOL + ')');
  info['u = ' + x] = rings;
  ok(`u = ${x}: the two far rings are read`, Array.isArray(rings) && rings.length === 2 && rings.every((r) => !r.error), rings);
  for (const r of rings || []) {
    const placed = r.drawn + r.out;
    ok(`u = ${x}, ring ${r.N}: no drawn triangle's chord height is off by more than ${CHORD_TOL} of the height range`, r.bad === 0, r);
    ok(`u = ${x}, ring ${r.N}: at most ${MAX_LEFT_OUT * 100} % of the placed triangles are left out, and some are drawn`, r.drawn > 0 && r.out <= MAX_LEFT_OUT * placed, r);
  }
  await ev('window.__svScrubUp(); 1');
  await settled({ max: 60000 });
}
return { pass: fails.length === 0, fails, info };

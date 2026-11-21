// The steps view's Landscape carried through a point where the map is unbounded without being a pole: Möbius
// (z - 0.1i)/(z + 0.1i), then √ (the dipole). Colour from z (T = z), Everywhere, sheets off. Along the glide w₁ → w₂ the
// carry's map from z is the Möbius step to a power p from 1 to 1/2, which goes to ∞ like |z + 0.1i|^-p at the Möbius
// step's pole -0.1i: for p < 1 Newton's method on 1/F does not settle there, and the box grid's |F| next to it is small
// (about 1.3 to 3.3), so the patch search (svLandPatches through svPolesIn with sing) has to refine its starts to that
// point by other means (#1460). The power's principal branch has its cut on the segment from -0.1i to 0.1i (where the
// Möbius step is negative), so it reaches only the sector |arg w| < p pi of the block; the wedge past it is bare at any
// resolution (#1910).
// Read from the last frame's carry (__cmwLandCarry, __cmwLandCover: the points of a 480 x 400 grid over the block that no
// kept carried triangle covers) held at u = 0.1, 0.5 and 0.998 of the glide and at rest on plane w₂:
// - a carried frame from plane z with a patch about -0.1i (within 1e-6), its rings starting at the cut (the seam,
//   svPatchSeam, at angle pi/2 from the patch's centre within SEAM_TOL, on each ring it samples);
// - with the box grid alone (the hook without the patches), points are bare, and the patch covers some of them;
// - the patch about the branch point 0.1i (svLandBranches) draws only where the rest leave a hole: the frame with it and
//   the frame without it (__cmwSteps({ landBranches: 0 })) are at most BAND_PX pixels over 16/255 apart in a channel.
//   (Drawn over the box's finer cells, its coarse outer cells carried the shading bands' edges in straight segments)
// - at rest, no point of the block is bare.
// Held at those u and at every u = 0.04 to 0.96 in steps of 0.04 (p read from the map at 0.05i, on the cut):
// - no point of the wedge |arg w| > p pi + EDGE is covered (no carried triangle straddles the cut and bridges it), at
//   least MIN_N points read;
// - no point of the sector |arg w| < p pi - EDGE with |w| at least NEAR_W is bare (the patch's rings reach the cut's
//   sides, not short of them in steps), at least MIN_N points read. (Within NEAR_W of 0, the image of the cut's
//   other end 0.1i, a branch point of the power, a few points the patch's cells there reach only to their size are bare.)
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
// (SEAM_TOL: the patch's centre is the refined point, a few 1e-12 off -0.1i, an angle of about 1e-6 on its innermost ring)
const EDGE = 0.02, NEAR_W = 0.3, MIN_N = 200, SEAM_TOL = 1e-5, BAND_PX = 40;
// (the Landscape canvas kept as tag; the pixels of two kept frames over 16/255 apart in a channel)
const keep = (tag) => ev(`window.__lsKeep = window.__lsKeep || {}; window.__lsKeep[${JSON.stringify(tag)}] = (() => { const cv = document.getElementById('canvasL'); return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; })(); 1`);
const apart = (a, b) => ev(`(() => { const A = window.__lsKeep[${JSON.stringify(a)}], B = window.__lsKeep[${JSON.stringify(b)}]; let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > 16) n++; return n; })()`);
// the branch's sector and the wedge past it, read with the patches: p from the map at 0.05i (on the cut, where the Möbius
// step is negative, so its image is at arg p pi), the points of each
const branch = async () => evJson(`JSON.stringify((() => {
  const c = __cmwLandCarry(), w = __cmwEval('cpuMap', c.map, [[0, 0.05]])[0], p = Math.abs(Math.atan2(w[1], w[0])) / Math.PI, a = (x, y) => Math.abs(Math.atan2(y, x));
  return { p, sector: __cmwLandCover(480, 400, true, [], (x, y) => a(x, y) < p * Math.PI - ${EDGE} && Math.hypot(x, y) >= ${NEAR_W}),
    wedge: __cmwLandCover(480, 400, true, [], (x, y) => a(x, y) > p * Math.PI + ${EDGE}) };
})())`);
const branchRows = (tag, b) => {
  ok(`${tag}: no point of the wedge past the branch (|arg w| > ${b.p.toFixed(3)} pi) is covered`, !!b.wedge && b.wedge.n >= MIN_N && b.wedge.bare === b.wedge.n, { p: b.p, n: b.wedge && b.wedge.n, covered: b.wedge && b.wedge.n - b.wedge.bare });
  ok(`${tag}: no point of the branch's sector (|arg w| < ${b.p.toFixed(3)} pi, |w| at least ${NEAR_W}) is bare`, !!b.sector && b.sector.n >= MIN_N && b.sector.bare === 0, { p: b.p, sector: b.sector });
};
const hold = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
for (const [tag, x, rest] of [['held at u = 0.1', 1.1, false], ['held at u = 0.5', 1.5, false], ['held at u = 0.998', 1.998, false], ['at rest on plane w₂', 2, true]]) {
  await hold(x);
  const c = info[tag] = { carried: await carried(), covered: await cover(), grid: await cover(false) };
  const near = (c.carried.polar || []).some((p) => Math.hypot(p[0] - SING[0], p[1] - SING[1]) < 1e-6);
  ok(`${tag}: a carried frame from plane z`, c.carried.s === 0, c.carried);
  ok(`${tag}: a patch about the singular point -0.1i`, near, c.carried);
  ok(`${tag}: the box grid alone leaves points bare, and the patch covers some of them`, !!c.grid && !!c.covered && c.grid.bare > 0 && c.covered.bare < c.grid.bare, { covered: c.covered, grid: c.grid });
  if (rest) { ok(`${tag}: the carried frame covers its block`, !!c.covered && c.covered.bare === 0, c.covered); continue; }
  // (the frame without the branch point's patch, then with it again)
  await keep('with');
  await ev('__cmwSteps({ landBranches: 0 }); 1'); await hold(x);
  const without = await carried();
  await keep('without');
  await ev('__cmwSteps({ landBranches: 1 }); 1'); await hold(x);
  const band = c.band = { apart: await apart('with', 'without'), patches: c.carried.patches, without: without.patches };
  ok(`${tag}: the branch point's patch draws only in the holes the rest leave (at most ${BAND_PX} px over 16/255 apart from the frame without it)`, band.without === band.patches - 1 && band.apart <= BAND_PX, band);
  // (the patch's seam: pi/2 from its centre, the direction of the cut to 0.1i, on every ring it samples)
  const seam = c.seam = await ev('(() => { const c = __cmwLandCarry(), p = (c.polar || []).find((q) => Math.hypot(q[0], q[1] + 0.1) < 1e-6); return p && p.seam ? [...p.seam] : null; })()');
  ok(`${tag}: the patch's rings start at the cut (its seam at angle pi/2 from -0.1i)`, Array.isArray(seam) && seam.every((t) => Math.abs(Math.atan2(Math.sin(t - Math.PI / 2), Math.cos(t - Math.PI / 2))) < SEAM_TOL), seam);
  branchRows(tag, c.branch = await branch());
}
// (the glide's frames between: every 0.04 of u)
for (let k = 1; k <= 24; k++) {
  const u = +(0.04 * k).toFixed(2), tag = `held at u = ${u}`;
  await hold(1 + u);
  branchRows(tag, info[tag] = await branch());
}
return { pass: !fails.length, fails, info };

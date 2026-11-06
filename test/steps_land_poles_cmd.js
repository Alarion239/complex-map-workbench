// The steps view's Landscape carried by a Möbius step: the carried surface covers its block. The default page,
// Everywhere, T = w₁ or w₂: plane w₂ is plane w₁'s points carried by the Möbius step, which takes the neighbourhood of
// its pole w₁ = −1 over the far plane, where the box grid's cells stretch past the tear limit and are left out (the
// patch about the pole, svLandPatches, covers them), and takes plane w₁ outside the carried box to a disc about the
// image of ∞ (the far patch, svLandFar, covers it). Read on the CPU from the last frame's carry (__cmwLandCover: the
// points of a 480 x 400 grid over the block that no kept carried triangle covers), for plane w₂ at rest and held
// along the glide w₁ → w₂ at u = 0.25, 0.5 and 0.9998:
// - a carried frame that draws one patch, about the pole (found again as the glide's t moves);
// - no point of the block is bare;
// - with the box grid alone (the hook without the patches), points are bare: the check reads something;
// - with the pole patch but not the far patch, points are bare too: the far patch covers what it alone can;
// - mid-glide, held at u = 0.85 and 0.95 of the glide w₁ → w₂: the pole patch, no bare point, and bare points with the box grid alone.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
await view(1440, 900, false, false);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const cover = async (patches = true) => JSON.parse(await ev(`JSON.stringify(__cmwLandCover(480, 400, ${patches === 'poles' ? "'poles'" : patches}))`));
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, patches }) => ({ u, s, patches }))(__cmwLandCarry() || {}))'));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landpoles${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 2, now: true }); 1`);
await settled({ max: 60000 });
await rest(2);
info.rest = await carried();
ok('T = w₁: plane w₂ at rest is carried from w₁ with a patch about the pole', info.rest.s === 1 && info.rest.patches === 1, info.rest);
info.cRest = await cover();
ok('T = w₁: plane w₂ at rest covers its block', !!info.cRest && info.cRest.bare === 0, info.cRest);
info.gRest = await cover(false);
ok('T = w₁: plane w₂ at rest, the box grid alone leaves points bare', !!info.gRest && info.gRest.bare > 0, info.gRest);
await rest(1);
for (const T of [1, 2]) {
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  await settled({ max: 60000 });
  for (const x of [1.25, 1.5, 1.9998]) {
    const tag = `T = w${T === 1 ? '₁' : '₂'}, held at ${x}`;
    await ev(`__cmwSteps({ x: ${x} }); 1`);
    await settled({ max: 60000 });
    await ev(rAF2);
    const c = info[`${T} ${x}`] = { carried: await carried(), covered: await cover(), poles: await cover('poles'), grid: await cover(false) };
    ok(`${tag}: a carried frame from plane w₁ with a patch about the pole`, c.carried.s === 1 && c.carried.patches === 1, c.carried);
    ok(`${tag}: the carried frame covers its block`, !!c.covered && c.covered.bare === 0, c.covered);
    ok(`${tag}: without the far patch, points are bare`, !!c.poles && c.poles.bare > 0, c.poles);
    ok(`${tag}: the box grid alone leaves points bare`, !!c.grid && c.grid.bare > 0, c.grid);
  }
}
// mid-glide, the carried frame held (held_frames' hold: the thread not let go, settled on the place and the moving frame) on
// the glide w₁ → w₂ at u = 0.85 and 0.95, where the cells about the pole have stretched past the tear limit: one patch is
// drawn, no point of the block is bare, and the box grid alone leaves points bare (at u = 0.5 and 0.7 it leaves none, so
// those frames would not read the patch)
info.mid = {};
for (const u of [0.85, 0.95]) {
  await rest(0);
  await hold(1 + u);
  const m = info.mid[u] = { carried: await carried(), covered: await cover(), grid: await cover(false) };
  ok(`held at u = ${u}: a carried frame drawing one patch`, !!m.carried && m.carried.s === 1 && Math.abs(m.carried.u - u) < 0.004 && m.carried.patches === 1, m.carried);
  ok(`held at u = ${u}: the carried frame covers its block`, !!m.covered && m.covered.bare === 0, m.covered);
  ok(`held at u = ${u}: the box grid alone leaves points bare`, !!m.grid && m.grid.bare > 0, m.grid);
  await ev('window.__svScrubUp(), 1');
  await settled({ max: 60000 });
}
return { pass: fails.length === 0, fails, info };

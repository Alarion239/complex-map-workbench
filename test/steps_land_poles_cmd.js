// The steps view's Landscape carried by a Möbius step: the carried surface covers its block about the step's pole. The
// default page, Everywhere, T = w₁: plane w₂ is plane w₁'s points carried by the Möbius step, which takes the
// neighbourhood of its pole w₁ = −1 over the far plane, where the box grid's cells stretch past the tear limit and are
// left out; the patch about the pole (svLandPatches) covers them. Read on the CPU from the last frame's carry
// (__cmwLandCover: the points of a 480 x 400 grid over the block that no kept carried triangle covers), for plane w₂ at
// rest and held at u = 0.9998 of the glide w₁ → w₂. The step also takes plane w₁ outside the carried box to a disc
// about the image of ∞, which the carry does not draw; the check counts that region (plane w₁ past the circle inside
// the box, on the CPU only) as covered:
// - a carried frame that draws one patch, about the pole;
// - no point of the block is bare;
// - with the box grid alone (the hook without the patch), points are bare: the check reads something.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
await view(1440, 900, false, false);
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// (plane s past the circle inside its carried box, to a thousand times the box's size)
const past = 'const c = __cmwLandCarry(), s = c.src, w = s.x1 - s.x0, h = s.y1 - s.y0; [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, Math.min(w, h) / 2, 1000 * Math.max(w, h)]';
const cover = async (patches = true) => JSON.parse(await ev(`JSON.stringify(__cmwLandCover(480, 400, ${patches}, [(() => { ${past.replace(/; \[/, '; return [')}; })()]))`));
const carried = async () => JSON.parse(await ev('JSON.stringify((({ u, s, patches }) => ({ u, s, patches }))(__cmwLandCarry() || {}))'));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landpoles${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 1, go: 2, now: true }); 1`);
await settled({ max: 60000 });
await rest(2);
info.rest = await carried();
ok('T = w₁: plane w₂ at rest is carried from w₁ with a patch about the pole', info.rest.s === 1 && info.rest.patches === 1, info.rest);
info.cRest = await cover();
ok('T = w₁: plane w₂ at rest covers its block (but plane w₁ past its box, #971)', !!info.cRest && info.cRest.bare === 0, info.cRest);
info.gRest = await cover(false);
ok('T = w₁: plane w₂ at rest, the box grid alone leaves points bare', !!info.gRest && info.gRest.bare > 0, info.gRest);
await rest(1);
await ev(`__cmwSteps({ x: 1.9998 }); 1`);
await settled({ max: 60000 });
await ev(rAF2);
info.held = await carried();
ok('held at 1.9998: a carried frame with a patch about the pole', info.held.s === 1 && info.held.patches === 1, info.held);
info.cHeld = await cover();
ok('held at 1.9998: the carried frame covers its block (but plane w₁ past its box, #971)', !!info.cHeld && info.cHeld.bare === 0, info.cHeld);
info.gHeld = await cover(false);
ok('held at 1.9998: the box grid alone leaves points bare', !!info.gHeld && info.gHeld.bare > 0, info.gHeld);
return { pass: fails.length === 0, fails, info };

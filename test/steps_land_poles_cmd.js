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
const { hold, grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
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
// mid-glide (u = 0.5): the frame held there has no holes. A background pixel is bare (its channels within 6 of each
// other, carry_kit.js's bare test); the background the fill reaches from the frame's border is the paper, and a bare
// pixel it does not reach is enclosed by surface: a hole. No reference frame: the count is the one the rest frames
// allow (none: the coverage checks above want bare === 0).
const MID_U = 0.5;
await rest(0);
const midHeld = (await hold(MID_U)).ok, midStill = await grab('poleM05');
ok('u = 0.5: the moving frame settles', midStill === true, { midHeld, midStill });
await ev('window.__svScrubUp && window.__svScrubUp(), 1');
await rest(0);
info.holes = await ev(`(() => {
  const P = window.__heldPx && window.__heldPx.poleM05, c = document.getElementById('canvasL');
  if (!P || !c || P.length !== 4 * c.width * c.height) return null;
  const W = c.width, H = c.height, bare = new Uint8Array(W * H), seen = new Uint8Array(W * H), q = [];
  for (let i = 0; i < W * H; i++) { const r = P[4 * i], g = P[4 * i + 1], b = P[4 * i + 2]; bare[i] = Math.max(r, g, b) - Math.min(r, g, b) < 6 ? 1 : 0; }
  const seed = (i) => { if (bare[i] && !seen[i]) { seen[i] = 1; q.push(i); } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  for (let k = 0; k < q.length; k++) { const i = q[k], x = i % W, y = (i - x) / W;
    if (x > 0) seed(i - 1); if (x < W - 1) seed(i + 1); if (y > 0) seed(i - W); if (y < H - 1) seed(i + W); }
  let n = 0, first = null, bg = 0;
  for (let i = 0; i < W * H; i++) if (bare[i]) { bg++; if (!seen[i]) { n++; if (!first) { const x = i % W, y = (i - x) / W; first = [x, y]; } } }
  let surf = 0; for (let i = 0; i < W * H; i++) if (!bare[i]) surf++;
  return { holes: n, first, bare: bg, surface: +(surf / (W * H)).toFixed(4), px: W * H };
})()`);
ok('u = 0.5: no holes (no bare pixel enclosed by surface in the moving frame)', !!info.holes && info.holes.holes === 0 && info.holes.surface > 0.03, info.holes);
return { pass: fails.length === 0, fails, info };

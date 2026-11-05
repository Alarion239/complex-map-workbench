// The steps view's Landscape carried near a pole of the carry's map: the carried surface has no holes there. The
// default page (z, exp, Möbius), Everywhere, the shapes hidden. With T = w₁, plane w₂ is plane w₁'s points carried by the Möbius step, whose pole w₁ = −1 it carries
// over the far plane, where the box's cells stretch past the tear limit and are left out; with T = w₂, plane w₂ is its
// own relief, the same heights h(F) on a grid of its own, with no holes (the reference). The colours differ (w₁'s
// phase carried against w₂'s), so a frame is read for where the surface is: a pixel of the phase colours (chroma, its
// largest channel less its smallest, over 40/255) against the floor and the background, which are grey:
// - plane w₂ at rest with T = w₁, and held at u = 0.9998 of the glide w₁ → w₂: the pixels where the reference shows
//   the surface and the frame does not (holes) are at most 0.1 % of the pane's;
// - those frames draw the carried grid's patches (__cmwLandCarry's patches), at least one, about the pole.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
// (the share of the pane's pixels that are surface in kept frame ref and not in kept frame a)
const holes = (a, ref) => ev(`(() => {
  const A = window.__heldPx[${JSON.stringify(a)}], R = window.__heldPx[${JSON.stringify(ref)}];
  if (!A || !R || A.length !== R.length) return null;
  const surf = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > 40;
  let n = 0, inR = 0, gone = 0;
  for (let i = 0; i < A.length; i += 4) { n++; if (surf(R, i)) { inR++; if (!surf(A, i)) gone++; } }
  return { holes: +(gone / n).toFixed(5), surface: +(inR / n).toFixed(4) };
})()`);
const carried = async () => JSON.parse(await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)'));
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landpoles${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 2, go: 2, now: true }); 1`);
await settled({ max: 60000 });
// (the shapes hidden, by their rows' eyes: the surface is all a frame shows)
info.hidden = await ev(`(() => { let n = 0; for (const b of document.querySelectorAll('button.icon-btn.eye')) if (/^Hide/.test(b.getAttribute('aria-label') || '')) { b.click(); n++; } return n; })()`);
await settled({ max: 60000 });
await rest(2);
info.own = await carried();
ok('T = w₂: plane w₂ is its own relief (no carry)', !info.own, info.own);
ok('the reference frame is still', await grab('own'), null);
await ev(`__cmwSteps({ T: 1 }); 1`);
await rest(2);
info.rest = await carried();
ok('T = w₁: plane w₂ at rest is carried from w₁', !!info.rest && info.rest.s === 1, info.rest);
ok('T = w₁: plane w₂ at rest draws a patch about the pole', !!info.rest && info.rest.patches >= 1, info.rest);
ok('T = w₁: the rest frame is still', await grab('rest'), null);
info.dRest = await holes('rest', 'own');
ok('the reference shows a surface', !!info.dRest && info.dRest.surface > 0.2, info.dRest);
ok('T = w₁: plane w₂ at rest has no holes (≤ 0.1 % of the pane)', !!info.dRest && info.dRest.holes <= 0.001, info.dRest);
await rest(1);
await ev(`__cmwSteps({ x: 1.9998 }); 1`);
await settled({ max: 60000 });
await ev(rAF2);
info.held = await carried();
ok('held at 1.9998: a carried frame with a patch about the pole', !!info.held && info.held.patches >= 1, info.held);
ok('held at 1.9998: the frame is still', await grab('held'), null);
info.dHeld = await holes('held', 'own');
ok('held at 1.9998: no holes (≤ 0.1 % of the pane)', !!info.dHeld && info.dHeld.holes <= 0.001, info.dHeld);
return { pass: fails.length === 0, fails, info };

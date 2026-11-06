// The steps view's Landscape with All sheets and the colour plane mid-chain: every sheet stands at h(F), as the single
// surface does, whatever T. A chain z, √, Möbius (two sheets over z and every plane after √), All sheets on, the
// Landscape, the shapes hidden. Plane z with T = w₂ (the last plane) is its own relief, h(F) on F's sheets (the
// reference); with T = w₁ it is plane z's points carried (the identity carry), coloured by √ (the stages up to T):
// - plane z at rest with T = w₁: a carried frame that draws the sheets, with the reference's scale and its cells refined
//   about the walls (the pole of F at z = −1 is a spike, as the reference's, not a sail), coloured by √ at every fragment;
// - its surface stands where the reference's does: read for where the surface is (a pixel of the phase colours, its
//   largest channel less its smallest over 16/255, against the grey floor and backdrop), the pixels that are surface
//   in one frame and not in the other are at most 1 % of the pane's (the colours differ: √'s phase against F's).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const carried = async () => JSON.parse(await ev('JSON.stringify(typeof __cmwLandCarry === "function" ? __cmwLandCarry() : null)'));
// (the share of the pane's pixels that are surface in one of kept frames a and b and not in the other)
const apart = (a, b) => ev(`(() => {
  const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}];
  if (!A || !B || A.length !== B.length) return null;
  const surf = (P, i) => Math.max(P[i], P[i + 1], P[i + 2]) - Math.min(P[i], P[i + 1], P[i + 2]) > 16;
  let n = 0, sa = 0, sb = 0, x = 0;
  for (let i = 0; i < A.length; i += 4) { n++; const p = surf(A, i), q = surf(B, i); sa += p; sb += q; x += p !== q; }
  return { apart: +(x / n).toFixed(5), surface: [+(sa / n).toFixed(4), +(sb / n).toFixed(4)] };
})()`);
const CHAIN = [{ type: 'root', params: { n: 2 }, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }];
const ns = 'landsheetsh' + Date.now();
await loadView('steps', ns, { shapes: [], steps: CHAIN, sheets: true });
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', T: 2, go: 0, now: true }); 1`);
await settled({ max: 60000 });
info.planes = await ev('__cmwSteps().planes');
ok('the chain has three planes', Array.isArray(info.planes) && info.planes.length === 3, info.planes);
for (const i of [0]) {
  await ev(`__cmwSteps({ T: 2 }); 1`);
  await rest(i);
  const own = info['own' + i] = await carried();
  ok(`T = w₂, plane ${i}: its own relief`, !own, own);
  ok(`T = w₂, plane ${i}: the reference frame is still`, await grab('own' + i), null);
  await ev(`__cmwSteps({ T: 1 }); 1`);
  await rest(i);
  const c = info['mid' + i] = await carried();
  ok(`T = w₁, plane ${i}: a carried frame with the sheets`, !!c && c.sheets === true, c);
  ok(`T = w₁, plane ${i}: the rest frame's cells are refined about the walls, as the own relief's are`, !!c && c.refined === true, c);
  ok(`T = w₁, plane ${i}: the frame is still`, await grab('mid' + i), null);
  const d = info['d' + i] = await apart('mid' + i, 'own' + i);
  ok(`T = w₁, plane ${i}: the frames show a surface`, !!d && d.surface[1] > 0.03, d);
  ok(`T = w₁, plane ${i}: the sheets stand where h(F)'s do (≤ 1 % of the pane apart)`, !!d && d.apart <= 0.01, d);
}
// the relief is h(F) whatever T: with the colour kept to a disc far from the pole (Inside regions, plain paper elsewhere),
// plane z's frames with T = w₂ and T = w₁ are the same shape about the pole at z = −1 (a window of the pane around it:
// none of its pixels more than 32/255 apart, held_frames.js's DIFF_TOL: the two frames draw the same cells), at the
// pane heights of the CI's and of a few others (the spike's edge crosses a pixel centre at some of them)
for (const dh of [0, -17, -7, -2, 3, 11, 20]) {
  await view(1440, 900 + dh, false, false);
  const ns2 = 'landsheetshb' + Date.now();
  await loadView('steps', ns2, { shapes: [{ id: 'd1', kind: 'disc', c: [7, 5], r: 0.4, ci: 0, visible: true }], steps: CHAIN, sheets: true });
  await go(`http://localhost:${PORT}/test.html?ns=${ns2}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'in', surf: 'land', T: 2, go: 0, now: true }); 1`);
  await rest(0);
  ok(`bare (pane ${900 + dh}), T = w₂: the own relief is still`, await grab('bare2'), null);
  // (the frame settled() returned on is the refined one: the pane draws no other frame afterwards. An app that reported
  // settled with its refinement still to come draws one, and its pixels differ from the first's. The wait is for that
  // event, the pane's next draw, and ends at 3 s without one)
  const t0 = await ev('__cmwPaneStatus("L").t');
  info['redraw' + dh] = await ev(`new Promise((res) => { const end = performance.now() + 3000; const f = () => { const s = __cmwPaneStatus('L'); if (s && s.t !== ${t0}) res(true); else if (performance.now() > end) res(false); else setTimeout(f, 50); }; f(); })`);
  await settled({ max: 60000 }); await ev(rAF2);
  ok(`bare (pane ${900 + dh}), T = w₂: the pane drew no other frame after settled()`, info['redraw' + dh] === false, info['redraw' + dh]);
  ok(`bare (pane ${900 + dh}), T = w₂: a later frame is still`, await grab('bare2late'), null);
  const late = info['late' + dh] = await compare('bare2', 'bare2late', { x: [0.28, 0.62], y: [0.2, 0.6] });
  ok(`bare (pane ${900 + dh}): the first rest frame is the later frame (none of the window apart)`, !!late && late.frac === 0, late);
  await ev(`__cmwSteps({ T: 1 }); 1`);
  await rest(0);
  ok(`bare (pane ${900 + dh}), T = w₁: the carried frame is still`, await grab('bare1'), null);
  // (the pane's window around the pole at z = −1 under the default camera: the funnel and its wall, clear of the sheets' far edges)
  const win = info['bare' + dh] = await compare('bare2', 'bare1', { x: [0.28, 0.62], y: [0.2, 0.6] });
  ok(`bare (pane ${900 + dh}): the relief about the pole is the same with T = w₁ as with T = w₂ (none of the window apart)`, !!win && win.frac === 0, win);
}
return { pass: fails.length === 0, fails, info };

// The Landscape's refinement textures are released when the view leaves Landscape, and built again when Landscape
// comes back (GLR.releaseLandscape, called from renderLeft; GLR.landHeld counts the bytes,
// test.html only).
// It runs twice (ci/browser_suites.js): pinned to the steps view (ci/suite_views.js: steps({ pin: true })), where
// Landscape is Plane ▾ → Landscape and leaving it Plane again, and in the classic view, where the left pane's view is
// switched to Landscape and back to X → Y.
// A browser suite for a command-file daemon (test/cdp_kit): the page at CMW_BASE test.html, the way landscape_walls_cmd.js loads.
// Result: { pass, fails, held }.
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [], held = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const HELD = `(() => { const h = GLR.landHeld(); return { total: h.total, refined: h.by.refined, levels: h.by.levels, list: h.by.list, heights: h.by.heights, edges: h.by.edges, scratch: h.scratch }; })()`;
const refined = async (max = 40000) => { for (let t = 0; t < max; t += 250) { if (await ev('(() => { const q = GLR.landRefine(false, 256); return !!(q && q.land); })()')) return true; await sleep(250); } return false; };
const CASES = [
  { id: 'sqrt-im', steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 }, on: true }], h: 'im', v: { cx: 0, cy: 0, s: 80 } },
  { id: 'tan-re', steps: [{ type: 'tan', params: {}, on: true }], h: 're', v: { cx: 0, cy: 0, s: 60 } },
];
// (into Landscape and out of it, in the view this run opened)
const enter = (sv) => (sv ? `__cmwSteps({ surf: 'land' }).surf` : '__cmwSetMain("land")');
const leave = (sv) => (sv ? `__cmwSteps({ surf: 'plane' }).surf` : '__cmwSetMain("xy")');
await view(1440, 900, false, false);
for (const c of CASES) {
  held[c.id] = {};
  const tag = c.id + ': ';
  await load('lwrel' + c.id + Date.now(), { shapes: [], steps: c.steps, pattern: 'checker', srcView: c.v, view: { main: 'land' }, sheets: false, height: c.h });
  await settled({ until: 'typeof __cmwSteps === "function" && typeof GLR === "object" && !!GLR.landHeld', max: 30000 });
  await settle(1200);
  const sv = held[c.id].steps = await ev('__cmwSteps().on');
  await ev(enter(sv)); await settle(1200);
  const L = await ev('(() => { const s = __cmwSteps(); return { surf: s.surf, main: s.main }; })()');
  ok(tag + 'the switch to Landscape shows the landscape', L.main === 'land' && (!sv || L.surf === 'land'), L);
  ok(tag + 'the refinement is built in Landscape', await refined(), null);
  // a play's worth of deformation, then rest: the steps view's thread steps a plane at a time in Landscape (to w₁ and
  // back to z); the classic view's Deformation plays through T
  if (sv) for (const k of [1, 0]) { await ev(`__cmwSteps({ go: ${k} })`); await settle(900); }
  else {
    await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
    for (const T of [0.5, 0.3, 0.2]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); }
    await ev('__cmwMorph({ open: false })'); await settle(700);
  }
  ok(tag + 'the refinement is built at rest after the deformation', await refined(), null);
  const A = held[c.id].inLandscape = await ev(HELD);
  ok(tag + 'Landscape holds its refinement', A.refined > 0 && A.levels > 0, A);
  await ev(leave(sv)); await settle(1500);
  const B = held[c.id].left = await ev(HELD);
  ok(tag + 'leaving Landscape frees the refinement', B.refined === 0 && B.levels === 0 && B.list === 0 && B.scratch === 0, B);
  ok(tag + '… and keeps the heights', B.heights === A.heights && B.heights > 0, [B.heights, A.heights]);
  ok(tag + 'the freed bytes are the refinement\'s', B.total < A.total, [B.total, A.total]);
  await ev(enter(sv)); await settle(1200);
  ok(tag + 'Landscape back: the refinement is built again', await refined(), null);
  const C = held[c.id].back = await ev(HELD);
  ok(tag + '… with the refinement\'s textures', C.refined > 0, C);
  const st = await ev('JSON.stringify(GLR.frameStatus ? GLR.frameStatus() : null)');
  ok(tag + 'no GL error after the round trip', !/"error":"?[^n"]/.test(st || '') || /"error":null/.test(st || ''), st);
}
return { pass: fails.length === 0, fails, held };

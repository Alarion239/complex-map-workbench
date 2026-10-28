// Issue #50: the Landscape's refinement textures are released when the left pane shows another view, and built again when
// Landscape comes back (GLR.releaseLandscape, called from renderLeft; GLR.landHeld counts the bytes, test.html only).
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
await view(1440, 900, false, false);
for (const c of CASES) {
  held[c.id] = {};
  const tag = c.id + ': ';
  await load('lwrel' + c.id + Date.now(), { shapes: [], steps: c.steps, pattern: 'checker', srcView: c.v, view: { main: 'land' }, sheets: false, height: c.h });
  await settle(1200); await ev('__cmwSetMain("land")'); await settle(1200);
  ok(tag + 'the refinement is built in Landscape', await refined(), null);
  // a play's worth of deformation, then rest
  await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await settle(900);
  for (const T of [0.5, 0.3, 0.2]) { await ev(`__cmwMorph({ T: ${T} })`); await settle(900); }
  ok(tag + 'the refinement is built at rest after the deformation', await refined(), null);
  const A = held[c.id].inLandscape = await ev(HELD);
  ok(tag + 'Landscape holds its refinement', A.refined > 0 && A.levels > 0, A);
  await ev('__cmwMorph({ open: false })'); await settle(700);
  await ev('__cmwSetMain("xy")'); await settle(1500);
  const B = held[c.id].left = await ev(HELD);
  ok(tag + 'leaving Landscape frees the refinement', B.refined === 0 && B.levels === 0 && B.list === 0 && B.scratch === 0, B);
  ok(tag + '… and keeps the heights', B.heights === A.heights && B.heights > 0, [B.heights, A.heights]);
  ok(tag + 'the freed bytes are the refinement\'s', B.total < A.total, [B.total, A.total]);
  await ev('__cmwSetMain("land")'); await settle(1200);
  ok(tag + 'Landscape back: the refinement is built again', await refined(), null);
  const C = held[c.id].back = await ev(HELD);
  ok(tag + '… with the refinement\'s textures', C.refined > 0, C);
  const st = await ev('JSON.stringify(GLR.frameStatus ? GLR.frameStatus() : null)');
  ok(tag + 'no GL error after the round trip', !/"error":"?[^n"]/.test(st || '') || /"error":null/.test(st || ''), st);
}
return { pass: fails.length === 0, fails, held };

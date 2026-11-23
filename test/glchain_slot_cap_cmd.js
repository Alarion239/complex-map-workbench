// GLChain's cap on a chain's uniform slots (#1928): GLChain.maxChainSlots(vecs) = the smaller of the GPU's fragment and
// vertex uniform-vector limits less GLChain.OTHER_UNIFORM_VECS, the most other uniform vectors any chain program takes.
// - the count: over every chain program (each map mode, vertex and fragment stage), counted from its source, the most
//   other uniform vectors is OTHER_UNIFORM_VECS; the counter's control reads a known source (mat4 + vec4[3] = 7);
// - a fresh load of the largest chain (d/dz e^z 0.2z+1, 208 slots, over the cap at the spec minimum of 224 vectors)
//   builds with the page's GPU limit and draws with no refusal;
// - a chain one Möbius step over the page's cap is refused, and the pane's GL status says it needs more shader parameters;
// - the glide onto a square root's plane at the end of a refused chain (svGlideSheets' copies of the chain, one per
//   sheet, take the chain's slots): no frame throws the refusal, each frame is drawn to its end with the chain alone, and
//   the pane's GL status still reads the refusal.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in misc-3 (ci/browser_shards.js).
// Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
// the steps view opened on the chain steps
const openSteps = async (tag, steps) => {
  const ns = tag + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [], steps });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR" });
};
await openSteps('npgbase', [{ type: 'pown', params: { n: 2 }, on: true }]);
// The slot cap: the most uniform vectors any chain program's other uniforms take, counted from the program sources (every chain program,
// each map mode, vertex and fragment stage), is GLChain.OTHER_UNIFORM_VECS; the control counts a source with a known
// uniform set (mat4 + vec4[3] = 7, a sampler and uChain not counted)
{
  const ev0 = await ev(`(() => {
    const COST = { float: 1, int: 1, uint: 1, bool: 1, vec2: 1, vec3: 1, vec4: 1, ivec2: 1, ivec3: 1, ivec4: 1, uvec2: 1, uvec3: 1, uvec4: 1, bvec2: 1, bvec3: 1, bvec4: 1, mat2: 2, mat3: 3, mat4: 4 };
    const count = (src) => { let n = 0; const re = /uniform\\s+(?:(?:highp|mediump|lowp)\\s+)?(\\w+)\\s+([^;]+);/g; let m; while ((m = re.exec(src))) { const c = COST[m[1]]; if (c == null) continue; for (const d of m[2].split(',')) { if (/\\buChain\\b/.test(d)) continue; const a = /\\[\\s*(\\d+)\\s*\\]/.exec(d); n += c * (a ? +a[1] : 1); } } return n; };
    const ctl = count('uniform vec4 uChain[9];\\nuniform mat4 b;\\nuniform sampler2D t;\\nuniform vec4 d[3];');
    let worst = { n: 0 }, progs = 0;
    for (const name of Object.keys(GLR._src.DEFS)) {
      if (!GLR._src.DEFS[name].chain) continue;
      for (let mode = 0; mode < 3; mode++) {
        let pair; try { pair = GLR.landSrc(name, mode); } catch (e) { continue; }
        if (!pair) continue;
        progs++;
        pair.forEach((src, k) => { const n = count(src); if (n > worst.n) worst = { n, name, mode, stage: k ? 'fs' : 'vs' }; });
      }
    }
    return { ctl, worst, progs, named: GLChain.OTHER_UNIFORM_VECS };
  })()`);
  R.slotCap = ev0;
  ok('slot cap: the counter reads the control source as mat4 + vec4[3] = 7 vectors', ev0.ctl === 7, ev0);
  ok(`slot cap: ${ev0.progs} chain programs counted; the most other uniform vectors of any program is ${ev0.worst.n} (${ev0.worst.name} mode ${ev0.worst.mode} ${ev0.worst.stage}), equal to GLChain.OTHER_UNIFORM_VECS (${ev0.named})`, ev0.progs > 0 && ev0.worst.n === ev0.named, ev0);
}
// A fresh load of the largest chain (d/dz e^z 0.2z+1, 208 slots: over the cap the spec minimum of 224 vectors would give)
// draws with no refusal, and the build used the page's GPU limit, not the default
{
  const spec = await ev(`(() => { const d = (t, o) => ({ type: t, params: Object.assign(Funcs.defaults(t), o), on: true }); return [d('affine', { a: '0.2', b: '1' }), d('custom', { expr: '\\\\sum_{n=0}^{\\\\infty} \\\\frac{z^n}{n!}' }), d('deriv', {})]; })()`);
  const ns = 'npgbig' + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [], steps: spec });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR" });
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  const got = await ev(`(() => { const st = __cmwSteps(); const steps = ${JSON.stringify(spec)}; let slots = null, err = ''; try { slots = GLChain.build(steps, steps.map((x) => Funcs.build(x))).slots; } catch (e) { err = String(e.message); } const vecs = Math.min(GLR.gl.getParameter(GLR.gl.MAX_FRAGMENT_UNIFORM_VECTORS), GLR.gl.getParameter(GLR.gl.MAX_VERTEX_UNIFORM_VECTORS)); return JSON.stringify({ slots, err, vecs, minCap: GLChain.maxChainSlots(224), frame: GLR.frameStatus().error }); })()`);
  // (a page without the cap answers an exception object, not the JSON: read as the error it is)
  const g = typeof got === 'string' ? JSON.parse(got) : { err: JSON.stringify(got) };
  R.bigChain = g;
  ok(`208-slot chain: built with the page's limit (${g.vecs} vectors; ${g.slots} slots over the ${g.minCap} the spec minimum allows; ${g.err || 'no error'})`, g.slots > g.minCap && !g.err && g.vecs > 224, g);
  ok(`208-slot chain: the pane draws with no refusal (frame status "${g.frame}")`, g.frame === '', g);
}
// A chain the build refuses (Möbius steps, 11 slots each, over the GPU's slot cap) is not drawn from an earlier version: the pane's GL status
// reads the refusal in plain words, and the step is not accepted silently
{
  const defs = await ev("Funcs.defaults('mobius')");
  // one step over the live cap: the cap for the page's GPU limit, over the slots one Möbius step takes
  const nSteps = await ev(`(() => { const st = { type: 'mobius', params: Funcs.defaults('mobius'), on: true }; const per = GLChain.build([st], [Funcs.build(st)]).slots; const vecs = Math.min(GLR.gl.getParameter(GLR.gl.MAX_FRAGMENT_UNIFORM_VECTORS), GLR.gl.getParameter(GLR.gl.MAX_VERTEX_UNIFORM_VECTORS)); return Math.floor(GLChain.maxChainSlots(vecs) / per) + 1; })()`);
  const ns = 'npgcap' + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [], steps: Array.from({ length: nSteps }, () => ({ type: 'mobius', params: defs, on: true })) });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR" });
  // (the refusal shows once the pane's first frame is drawn: waited for, the wait's end read)
  const seen = await settled({ only: true, max: 30000, until: "/more shader parameters/.test(String(GLR.frameStatus().error))" });
  const st = await ev('JSON.stringify({ err: GLR.frameStatus().error, last: GLR.error })');
  R.refusedChain = { st, nSteps, seen };
  ok(`refused chain: the pane's GL status says the chain needs more shader parameters (${st})`, /more shader parameters/.test(String(st)), st);
}
// The glide onto the square root's plane at the end of a chain the build refuses: svGlideSheets' copies (one per sheet
// combo) take the chain's slots, so none is built, and a glide frame throws nothing (each frame threw the build's
// refusal again); the pane's GL status reads the refusal, as the parked plane's does
{
  const nSteps = await ev(`(() => { const st = { type: 'mobius', params: Funcs.defaults('mobius'), on: true }; const per = GLChain.build([st], [Funcs.build(st)]).slots; const vecs = Math.min(GLR.gl.getParameter(GLR.gl.MAX_FRAGMENT_UNIFORM_VECTORS), GLR.gl.getParameter(GLR.gl.MAX_VERTEX_UNIFORM_VECTORS)); return Math.floor(GLChain.maxChainSlots(vecs) / per) + 1; })()`);
  const defs = await ev("Funcs.defaults('mobius')");
  const steps = [...Array.from({ length: nSteps }, () => ({ type: 'mobius', params: defs, on: true })), { type: 'root', params: { n: 2, cut: 180 }, on: true }];
  const ns = 'npgglide' + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image', shapes: [], steps });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: "typeof __cmwSteps === 'function' && !!window.GLR" });
  const a = nSteps, b = nSteps + 1;
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', go: ${a}, now: true }); 1`);
  await settled({ only: true, max: 30000, until: "/more shader parameters/.test(String(GLR.frameStatus().error))" });
  // (from here on, the refusals the page logs: the build's message, however the error reaches the console)
  await ev(`(() => { window.__refusals = 0; const e0 = console.error; console.error = (...xs) => { if (xs.some((x) => /uniform slots exceed the cap/.test(String((x && x.message) || x)))) window.__refusals++; return e0.apply(console, xs); }; return 1; })()`);
  const us = [0.25, 0.5, 0.75], frames = [];
  for (const u of us) {
    await ev(`__cmwSteps({ x: ${a + u} }); 1`);
    await settled({ max: 30000 });
    frames.push(JSON.parse(await ev(`JSON.stringify({ sheets: (__cmwSteps().glide || {}).sheets || null, err: GLR.frameStatus().error })`)));
  }
  const refusals = await ev('window.__refusals');
  R.refusedGlide = { nSteps, frames, refusals };
  ok(`refused chain's glide onto the square root's plane (${us.length} frames): no frame throws the build's refusal (${refusals} thrown)`, refusals === 0, R.refusedGlide);
  ok("refused chain's glide: every frame is drawn to its end, its record the chain alone (1 sheet)", frames.every((f) => f.sheets === 1), frames);
  ok("refused chain's glide: the pane's GL status reads the refusal on every frame", frames.every((f) => /more shader parameters/.test(String(f.err))), frames);
}
 return { pass: fails.length === 0, fails, results: R };
return { pass: fails.length === 0, fails, results: R };

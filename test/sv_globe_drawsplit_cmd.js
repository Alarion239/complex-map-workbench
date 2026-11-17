// Where a frame of the steps view's glide on the globe spends its GPU time (#1074; info only, gates nothing): the
// default page, Surface: Sphere, Everywhere and Inside regions, the thread held at x = 0.5 and moved by 0.0005 back
// and forth for FRAMES frames. Every GL draw (and clear) of those frames is timed alone, a 1-px readPixels before and
// after it so that the GPU has finished the work before it and finishes its own, and summed per program (a hash of
// its source and the first functions it defines) and per call site (the first frames of its JS stack). The sums are
// therefore the GPU's time per draw kind, not a frame time (the syncs serialise the frame). Also the left pane drawn
// and read back five times (__cmwTime(5).left), unsynchronised per draw. The GPU gate runs it on the Mac in mode
// suites (gpu-gate.yml), for #1074's split there; lavapipe's is on #1074.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const FRAMES = 30, HELD_X = 0.5;
// (the page's WebGL2 calls wrapped once: __split.on times them, __split.by[program][site] = { ms, n })
const WRAP = `(() => {
  if (window.__split) return 1;
  const P = WebGL2RenderingContext.prototype, cur = new WeakMap(), names = new WeakMap();
  window.__split = { on: false, by: {} };
  const use = P.useProgram;
  P.useProgram = function (p) { cur.set(this, p); return use.call(this, p); };
  const rp = P.readPixels;
  const sync = (gl) => {
    const fmt = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT), typ = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
    const A = typ === gl.FLOAT ? Float32Array : typ === gl.UNSIGNED_INT ? Uint32Array : typ === gl.INT ? Int32Array : typ === gl.HALF_FLOAT ? Uint16Array : Uint8Array;
    const pb = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
    if (pb) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    try { rp.call(gl, 0, 0, 1, 1, fmt, typ, new A(4)); } catch (e) { gl.finish(); }
    if (pb) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pb);
  };
  const name = (gl, p) => {
    if (!p) return 'no program';
    let n = names.get(p);
    if (n) return n;
    const src = (gl.getAttachedShaders(p) || []).map((s) => gl.getShaderSource(s) || '').join('\\n');
    let h = 0; for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    const fns = [...src.matchAll(/\\b(?:vec[234]|float|void|bool|int)\\s+(\\w+)\\s*\\(/g)].map((m) => m[1]).filter((f) => !/^(main|cx_|c[a-z]+$)/.test(f));
    n = (h >>> 0).toString(16).slice(0, 6) + ' ' + [...new Set(fns)].slice(0, 5).join(',');
    names.set(p, n);
    return n;
  };
  for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'clear', 'blitFramebuffer']) {
    const o = P[f];
    P[f] = function (...a) {
      if (!__split.on) return o.apply(this, a);
      sync(this);
      const t0 = performance.now(), r = o.apply(this, a);
      sync(this);
      const dt = performance.now() - t0;
      const site = (new Error().stack || '').split('\\n').slice(2, 6).map((l) => (/at (\\S+)/.exec(l) || [])[1]).filter(Boolean).join(' < ');
      const k = f + ' ' + name(this, cur.get(this));
      const e = (__split.by[k] = __split.by[k] || {}), s = (e[site] = e[site] || { ms: 0, n: 0 });
      s.ms += dt; s.n++;
      return r;
    };
  }
  return 1;
})()`;
await view(1200, 800, false, false);
for (const scope of ['all', 'in']) {
  await go(`http://localhost:${PORT}/test.html?ns=split${scope}${Date.now()}&view=steps`);
  const up = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwTime === "function"' });
  if (!up.ok) { fails.push({ name: `${scope}: the page hooks are up`, got: up }); continue; }
  await ev(`__cmwSteps({ scope: '${scope}', surf: 'sphere', go: 0, now: true }), 1`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && __cmwSvX() === 0' });
  await ev(`__cmwSteps({ x: ${HELD_X} }), 1`);
  await settled({ max: 60000, until: `Math.abs(__cmwSvX() - ${HELD_X}) < 1e-9` });
  const frame = [];
  for (let i = 0; i < 3; i++) frame.push(await ev('__cmwTime(5).left'));
  await ev(WRAP);
  await ev(`(window.__splitDone = false, __split.by = {}, __split.on = true, (() => { let k = 0; const f = () => { __cmwSteps({ x: ${HELD_X} + (k % 2) * 0.0005, now: true }); if (++k <= ${FRAMES}) requestAnimationFrame(f); else { __split.on = false; window.__splitDone = true; } }; requestAnimationFrame(f); })(), 1)`);
  await settled({ max: 600000, until: 'window.__splitDone === true' });
  const by = await ev('__split.by');
  const rows = [];
  for (const [k, sites] of Object.entries(by || {})) for (const [site, s] of Object.entries(sites)) rows.push({ draw: k, site, msPerFrame: +(s.ms / FRAMES).toFixed(2), perFrame: +(s.n / FRAMES).toFixed(2) });
  rows.sort((a, b) => b.msPerFrame - a.msPerFrame);
  info[scope] = { frameMs: frame, renderer: await ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); return g ? g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER) : null; })()`),
    gpuMsPerFrame: +rows.reduce((t, r) => t + r.msPerFrame, 0).toFixed(2), draws: rows.slice(0, 16) };
  if (!rows.length) fails.push({ name: `${scope}: the held frames drew something`, got: info[scope] });
}
return { pass: fails.length === 0, fails, info };

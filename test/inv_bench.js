'use strict';
// The generated-program benchmark of the inverse renderer (SPEC 4.7; results in SPEC 13.10). Page script of
// dist/inv-bench.html (test/make_inv_bench.py); driven by test/inv_bench_cmd.js through a CDP daemon.
//
// Every number comes from the programs glsl.js and gl.js generate for the scene (GLChain.build(...).inverse +
// INV_HEAD + walker + INV_MAIN), drawn by GLR.drawInverse exactly as the app will draw them:
//  - compile / link: the program's sources compiled by hand (a nonce defeats ANGLE's program cache): compileShader
//    until the fragment shader's COMPLETION_STATUS_KHR, then linkProgram until the program's;
//  - first draw: GLR.drawInverse with a fresh (nonce) program: call -> program ready (background compile) -> the first
//    draw synchronised by a 1-pixel readPixels (ANGLE Metal finishes a pipeline at its first draw);
//  - per pass: 24 passes each followed by a 1-pixel readPixels (GPU-synchronised, as the perf suite's frames), and
//    24 passes then one readPixels (throughput); EXT_disjoint_timer_query_webgl2 when the browser has it.
window.IB = (() => {
  const C = CX.C;
  const St = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
  const boxOf = (v, w = 410, h = 516) => ({ x0: v.cx - w / 2 / v.s, x1: v.cx + w / 2 / v.s, y0: v.cy - h / 2 / v.s, y1: v.cy + h / 2 / v.s });
  const H = { id: 1, kind: 'halfplane', a: [0, 0], b: [1, 0] };
  const star = (n, cx, cy, r1, r2) => Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * i / n, r = i % 2 ? r1 : r2; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
  const SCENES = {
    zi_H: { steps: [St('powa', { alpha: 'i', cut: 180, k: 0 })], shape: H, view: { cx: 0, cy: 0, s: 190 }, src: { cx: 0, cy: 1, s: 60 }, pattern: 'polar', cell: 1 },
    expH: { steps: [St('exp')], shape: H, view: { cx: 0, cy: 0, s: 60 }, src: { cx: 0, cy: 1, s: 60 }, pattern: 'checker', cell: 0.5 },
    e1z_disc: { steps: [St('recip'), St('exp')], shape: { id: 1, kind: 'disc', c: [0, 0], r: 1 }, view: { cx: 0, cy: 0, s: 60 }, src: { cx: 0, cy: 0, s: 120 }, pattern: 'checker', cell: 0.2 },
    sin_halfstrip: { steps: [St('sin')], shape: { id: 1, kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, view: { cx: 0, cy: 2, s: 50 }, src: { cx: 0, cy: 1.25, s: 105 }, pattern: 'checker', cell: 0.5 },
    // a 3-op chain: affine, then exp twice (two window families: the outer one bounded by its range box)
    expexp_disc: { steps: [St('affine', { a: '0.8', b: '0.1i' }), St('exp'), St('exp')], shape: { id: 1, kind: 'disc', c: [0, 0], r: 1.2 }, view: { cx: 0, cy: 0, s: 30 }, src: { cx: 0, cy: 0, s: 80 }, pattern: 'checker', cell: 0.25 },
    poly40_exp: { steps: [St('exp')], shape: { id: 1, kind: 'polygon', pts: star(40, 0.2, 1.4, 0.7, 1.15) }, view: { cx: 0, cy: 0, s: 60 }, src: { cx: 0, cy: 1, s: 90 }, pattern: 'checker', cell: 0.25 },
    formula_strip_exp: { steps: [St('exp')], shape: { id: 1, kind: 'formula', expr: '|\\Im z|<1' }, view: { cx: 1, cy: 0, s: 50 }, src: { cx: 0, cy: 0, s: 60 }, pattern: 'checker', cell: 0.5 },
    // bounded golden controls (the swiftshader.ratio scenes)
    disc_cube: { steps: [St('pown', { n: 3 })], shape: { id: 1, kind: 'disc', c: [0.6, 0.3], r: 0.8 }, view: { cx: 0.15, cy: 1, s: 74.5 }, src: { cx: 0.4, cy: 0.2, s: 120 }, pattern: 'checker', cell: 0.25 },
    joukowski: { steps: [St('joukowski')], shape: { id: 1, kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, view: { cx: 0, cy: 0, s: 117 }, src: { cx: 0, cy: 0, s: 70 }, pattern: 'checker', cell: 0.25 },
    annulus_log: { steps: [St('log', { cut: 180, k: 0 })], shape: { id: 1, kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, view: { cx: 0, cy: 0, s: 72 }, src: { cx: 0, cy: 0, s: 70 }, pattern: 'checker', cell: 0.25 },
  };
  let canvas = null, gl = null;
  function init() {
    if (gl) return true;
    canvas = document.createElement('canvas');
    canvas.width = 1640; canvas.height = 2064;
    if (!GLR.init(canvas)) return false;
    gl = GLR.gl;
    return true;
  }
  let nonce = 0;
  const now = () => performance.now();
  const sleep0 = () => new Promise((r) => setTimeout(r, 0));
  const px1 = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px1);
  // the scene's chain, plan, prep and packed record; returns the drawInverse state (minus view / look)
  function setup(name, opts = {}) {
    const sc = SCENES[name];
    const steps = sc.steps, built = steps.map(Funcs.build);
    GLR.setChain(GLChain.build(steps, built));
    const plan = Inverse.planChain(steps, built, 0, steps.length);
    if (!plan.ok) return { error: 'plan: ' + plan.reason };
    const win = boxOf(sc.src);
    const t0 = now();
    const prep = Inverse.prepare(plan, { win, shape: sc.shape });
    const prepMs = now() - t0;
    if (!prep.ok) return { error: 'prep: ' + prep.reason };
    GLR.packShapes([sc.shape], { debounce: false });
    return { sc, plan, prep, prepMs, map: { mode: 0, a: 0, b: steps.length } };
  }
  function lookOf(sc, alpha) {
    return { color: '#3B6FD4', color2: '#8CABE5', edge: '#093B9B', ink: '#093B9B', alpha, alphaOwn: alpha, pattern: sc.pattern, cell: sc.cell, lines: false };
  }
  const PLANE = [0xFC / 255, 0xFD / 255, 0xFD / 255, 1];
  function stOf(s, dpr, alpha, globe, extra) {
    const st = { map: s.map, plan: s.plan, prep: s.prep, shape: s.sc.shape, look: lookOf(s.sc, alpha), dpr, view: s.sc.view, viewKind: globe ? 'globe' : 'flat', extra };
    return st;
  }
  const W = 410, Hh = 516;
  function frame(dpr, globe, s, st) {
    const pw = W * dpr, ph = Hh * dpr;
    GLR.begin(pw, ph, PLANE);
    if (globe) {
      const r = GLR.drawSphere({ cam: { yaw: -0.6, pitch: -0.35, dist: 4.2 }, mode: 'image', regions: [], lines: [], plane: false, dpr, colors: {} });
      st.sphere = r;
    }
    return GLR.drawInverse(st);
  }
  // a nonce that reaches the Metal source: a uniform the compilers cannot fold (a comment is stripped by ANGLE's
  // translator, and macOS caches compiled Metal libraries system-wide, across browser processes)
  const nonceTag = () => 'uBenchNonce' + (++nonce) + '_' + Math.floor(Math.random() * 1e9);
  const withNonce = (main, tag) => main.replace('invWalk(w);', `w.x += ${tag}; invWalk(w);`);
  // compile and link of the program's sources, by hand (cold: a nonce)
  async function compileLink(B, globe, forms) {
    const [vs, fs0] = GLR._src.invSources(B, globe, forms);
    const tag = nonceTag(), fs = withNonce(fs0.replace('precision highp sampler2D;\n', `precision highp sampler2D;\nuniform float ${tag};\n`), tag);
    if (fs === fs0) return { error: 'nonce not placed' };
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const t0 = now();
    const sv = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(sv, vs); gl.compileShader(sv);
    const sf = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(sf, fs); gl.compileShader(sf);
    if (ext) while (!gl.getShaderParameter(sf, ext.COMPLETION_STATUS_KHR)) await sleep0();
    const okF = gl.getShaderParameter(sf, gl.COMPILE_STATUS);
    const t1 = now();
    if (!okF) return { error: gl.getShaderInfoLog(sf), srcLen: fs.length };
    const p = gl.createProgram(); gl.attachShader(p, sv); gl.attachShader(p, sf); gl.linkProgram(p);
    if (ext) while (!gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) await sleep0();
    const okL = gl.getProgramParameter(p, gl.LINK_STATUS);
    const t2 = now();
    const err = okL ? null : gl.getProgramInfoLog(p);
    gl.deleteProgram(p); gl.deleteShader(sv); gl.deleteShader(sf);
    return { compileMs: +(t1 - t0).toFixed(1), linkMs: +(t2 - t1).toFixed(1), srcLen: fs.length, error: err };
  }
  // GLR.drawInverse's own path with a fresh program: call -> ready -> first synchronised draw
  async function firstDraw(s, dpr, alpha, globe) {
    const tag = nonceTag();
    const extra = { pre: `uniform float ${tag};\n`, main: withNonce(GLR._src.INV_MAIN(globe), tag) };
    const st = stOf(s, dpr, alpha, globe, extra);
    const t0 = now();
    let r = frame(dpr, globe, s, st);
    const tCall = now() - t0;
    const B = GLR._src.invB(alpha);
    while (r === 'pending') {
      await sleep0();
      const q = GLR._src.invProgram(B, globe, false, extra);
      if (q.state !== 'pending') break;
      if (now() - t0 > 20000) return { error: 'compile timeout' };
    }
    const tReady = now() - t0;
    const t1 = now();
    r = frame(dpr, globe, s, st);
    sync();
    const tFirst = now() - t1;
    return { result: r, callMs: +tCall.toFixed(1), readyMs: +tReady.toFixed(1), firstDrawMs: +tFirst.toFixed(1), totalMs: +(tReady + tFirst).toFixed(1), extra, st };
  }
  // per-pass cost: frames of k back-to-back passes (k = 0 and KP), each synchronised by a 1-pixel readPixels,
  // interleaved; marginal = (median(t_KP) - median(t_0)) / KP. Robust to the frame's fixed costs (clear, MSAA
  // resolve, the readback) and to the GPU's clock ramp. passSyncMs: a frame of one pass, synchronised (as the perf
  // suite's frames). GPU timer queries are not used: on ANGLE Metal a query splits the render pass, whose load and
  // store of the whole target dominate (measured: a null pass "takes" 1.7 ms at dpr 2).
  const KP = 6;
  async function passes(s, st, dpr, globe, n = 24) {
    const one = (k) => {
      GLR.begin(W * dpr, Hh * dpr, PLANE);
      if (globe) st.sphere = GLR.drawSphere({ cam: { yaw: -0.6, pitch: -0.35, dist: 4.2 }, mode: 'image', regions: [], lines: [], plane: false, dpr, colors: {} });
      for (let i = 0; i < k; i++) GLR.drawInverse(st);
      sync();
    };
    for (let i = 0; i < 4; i++) one(1);
    const t0s = [], tks = [], t1s = [];
    for (let r = 0; r < n; r++) {
      let t = now(); one(0); t0s.push(now() - t);
      t = now(); one(KP); tks.push(now() - t);
      t = now(); one(1); t1s.push(now() - t);
      if (r % 4 === 3) await sleep0();
    }
    const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
    const per = (med(tks) - med(t0s)) / KP;
    return { passMs: +per.toFixed(3), frame1Ms: +med(t1s).toFixed(3), frame0Ms: +med(t0s).toFixed(3) };
  }
  // PNG of the current frame (flipped to top-down)
  function png(dpr) {
    const w = W * dpr, h = Hh * dpr, buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const ctx = c2.getContext('2d'), id = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) id.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(id, 0, 0);
    return c2.toDataURL('image/png');
  }
  // one scene: compile / link (B 8 and 16), and per (dpr, alpha, view kind) the first draw and the passes
  async function run(name, opts = {}) {
    if (!init()) return { error: 'no webgl2' };
    const s = setup(name);
    if (s.error) return { name, error: s.error };
    const out = { name, prepMs: +s.prepMs.toFixed(2), N: s.prep.N, inner: s.prep.inner, stopOp: s.prep.stopOp, mob: !!s.prep.stopMob, rows: [] };
    const globes = opts.globe === false ? [false] : opts.globeOnly ? [true] : [false, true];
    out.compile = {};
    for (const a of opts.alphas || [1, 0.85]) for (const g of globes) out.compile[(g ? 'globe' : 'flat') + '.B' + GLR._src.invB(a)] = await compileLink(GLR._src.invB(a), g, GLR.packShapes([s.sc.shape], { debounce: false }).forms);
    for (const dpr of opts.dprs || [1, 2]) {
      for (const alpha of opts.alphas || [1, 0.85]) {
        for (const g of globes) {
          const f = await firstDraw(s, dpr, alpha, g);
          if (f.error) { out.rows.push({ dpr, alpha, view: g ? 'globe' : 'flat', error: f.error }); continue; }
          const p = await passes(s, f.st, dpr, g, opts.n || 24);
          const row = { dpr, alpha, view: g ? 'globe' : 'flat', result: f.result, readyMs: f.readyMs, firstDrawMs: f.firstDrawMs, totalMs: f.totalMs };
          Object.assign(row, p);
          if (opts.png && dpr === 1 && !g) { frame(dpr, g, s, f.st); row.png = png(dpr); }
          out.rows.push(row);
        }
      }
    }
    return out;
  }
  return { SCENES, run, setup, init, frame, stOf, png, compileLink, get gl() { return gl; } };
})();

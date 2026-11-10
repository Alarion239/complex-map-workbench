'use strict';
// Scratch measurement (#1323): the GPU cost of one evaluation per pixel of a step's homotopy H_t (chainHom) on a W x H
// framebuffer, for the Mountain King's step 2 (the 29-log sum zoom, the exp zoom, the multiply) and for DH, on the same GPU.
// A program evaluates chainHom REP times per pixel (z shifted by a pixel-dependent amount), timed over draws with a readback;
// the per-evaluation cost is (t(REP2) - t(REP1)) / (REP2 - REP1). Results in window.__logCost.
(function () {
  const R = window.__logCost = { done: false, errors: [], rows: [], renderer: null };
  const W = 1200, H = 800, REP1 = 1, REP2 = 4, DRAWS = 3, T = 0.2;   // T in the first third: the log sum's own homotopy
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { R.errors.push('no webgl2 / EXT_color_buffer_float'); R.done = true; return; }
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  R.renderer = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }';
  const MAIN = (idx, rep, t) => `
out vec4 o;
void main() {
  vec2 z = (gl_FragCoord.xy - vec2(${W / 2}.0, ${H / 2}.0)) / 400.0;
  vec2 acc = vec2(0.0);
  for (int k = 0; k < ${rep}; k++) acc += chainHom(${idx}, z + vec2(0.003 * float(k), 0.0), ${t});
  o = vec4(acc, 0.0, 1.0);
}`;
  const compile = (chainSrc, main) => {
    const mk = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + GLChain.LIB + '\n' + chainSrc + '\n' + main));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
  const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const vao = gl.createVertexArray();
  const px = new Float32Array(4);
  const timeIt = (prog, uvec) => {
    gl.useProgram(prog);
    gl.uniform4fv(gl.getUniformLocation(prog, 'uChain'), uvec);
    const sw = gl.getUniformLocation(prog, 'uSheetW'); if (sw) gl.uniform1i(sw, 1);
    gl.viewport(0, 0, W, H); gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px);   // (a warm-up)
    const ms = [];
    for (let i = 0; i < DRAWS; i++) { const t0 = performance.now(); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, px); ms.push(performance.now() - t0); }
    return ms.sort((a, b) => a - b)[DRAWS >> 1];
  };
  const CASES = [
    { name: 'Mountain King step 2 (the 29-log sum, t in the first third)', steps: SEASONG.steps.map((s) => Object.assign({ on: true }, s)), idx: 2, t: T },
    { name: 'DH (N = 64)', steps: [{ type: 'dh', params: Object.assign(Funcs.defaults('dh'), { N: Funcs.DH_NMAX }), on: true }], idx: 1, t: 0.5 },
    { name: 'Bottcher c = -1', steps: [{ type: 'bottcher', params: Object.assign(Funcs.defaults('bottcher'), { c: '-1', N: Funcs.DH_NMAX }), on: true }], idx: 1, t: 0.5 },
  ];
  try {
    for (const c of CASES) {
      const built = Funcs.applyRepeats(c.steps, c.steps.map((s) => Funcs.build(s)));
      const gc = GLChain.build(c.steps, built);
      const uvec = new Float32Array(4 * gc.slots); gc.fill(uvec);
      const t0 = performance.now();
      const p1 = compile(gc.source, MAIN(c.idx, REP1, c.t.toFixed(3))), p2 = compile(gc.source, MAIN(c.idx, REP2, c.t.toFixed(3)));
      const compileMs = performance.now() - t0;
      const a = timeIt(p1, uvec), b = timeIt(p2, uvec);
      R.rows.push({ case: c.name, frame: `${W}x${H}`, rep1Ms: +a.toFixed(1), rep2Ms: +b.toFixed(1), perEvalMs: +((b - a) / (REP2 - REP1)).toFixed(2), compileMs: Math.round(compileMs) });
    }
  } catch (err) { R.errors.push(String(err && err.stack || err)); }
  R.done = true;
})();

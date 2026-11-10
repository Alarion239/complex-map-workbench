'use strict';
// GPU measurement (float32, as the shader computes it) of member 0's walk in the Newton kit (src/glsl.js, newtCoreFns /
// ${P}_run, mode WALK): the grid stages k / NEWT_K up to k0 = floor(NEWT_K t), one step at t, then the polish (NEWT_POL steps,
// ended early when a step moves u by at most NEWT_STEP_TOL (1 + |u|)), on the DH and Böttcher homotopies at t = 0.5 over a grid
// of w with |w| > 1. Counts, over the pixels whose walk ran and whose hit test holds: the polish steps taken, and how many leave
// u bit for bit unchanged at their last step (the hit test is then at the same (z, t) as that step's H). Results in window.__dhPolish.
(function () {
  const R = window.__dhPolish = { done: false, errors: [], rows: [], renderer: null };
  const T = 0.5, NEWT_K = 32, NEWT_POL = 4, STEP_TOL = '1e-5', HIT_F = '1e-3';
  const GW = 160, GH = 90, SCALE = 20;                 // pixels of the w grid, per unit
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { R.errors.push('no webgl2 / EXT_color_buffer_float'); R.done = true; return; }
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  R.renderer = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }';
  const MAIN = `
uniform highp sampler2D uPts;
out vec4 o;
bool fin(vec2 u) { return abs(u.x) < 1e37 && abs(u.y) < 1e37; }
// _step of the kit's dual-derivative form (not a CHECK, not deflated)
bool nstep(inout vec2 u, vec2 w, float t) {
  vec2 d, hu; float tl;
  hu = chainHomD(1, u, t, d, tl);
  if (!(dot(d, d) > 0.0)) return false;
  vec2 st = cdiv(hu - w, d);
  float sl = cx_abs(st), mx = 0.25 * (1.0 + cx_abs(u));
  u -= sl > mx ? st * (mx / sl) : st;
  return fin(u);
}
void main() {
  vec2 w = texelFetch(uPts, ivec2(gl_FragCoord.xy), 0).xy;
  vec2 u = w, p = w;
  bool ok = true;
  int k0 = min(${NEWT_K}, int(floor(${NEWT_K}.0 * ${T.toFixed(1)})));
  for (int k = 1; k <= ${NEWT_K}; k++) { if (k > k0) break; ok = nstep(u, w, float(k) / ${NEWT_K}.0); if (!ok) break; }
  if (ok) ok = nstep(u, w, ${T.toFixed(1)});
  int pol = 0; bool same = false;
  if (ok) for (int n = 0; n < ${NEWT_POL}; n++) {
    p = u;
    ok = nstep(u, w, ${T.toFixed(1)});
    pol++;
    if (!ok) break;
    same = u == p;
    if (cx_abs(u - p) <= ${STEP_TOL} * (1.0 + cx_abs(u))) break;
  }
  vec2 d, h; float tl;
  h = chainHomD(1, u, ${T.toFixed(1)}, d, tl);
  bool hit = ok && fin(u) && cx_abs(h - w) + tl <= ${HIT_F} * (1.0 + cx_abs(w));
  o = vec4(float(pol), same ? 1.0 : 0.0, hit ? 1.0 : 0.0, ok ? 1.0 : 0.0);
}`;
  const compile = (chainSrc) => {
    const mk = (type, s) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + GLChain.LIB + '\n' + chainSrc + '\n' + MAIN));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const mkTex = (w, h, data) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    return t;
  };
  const CHAINS = [{ name: 'dh', type: 'dh', params: {} }, { name: 'bottcher c = -1', type: 'bottcher', params: { c: '-1' } }];
  const ws = [];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const re = (i + 0.5 - GW / 2) / SCALE * 2.5, im = (j + 0.5 - GH / 2) / SCALE * 2.5; if (Math.hypot(re, im) > 1) ws.push([Math.fround(re), Math.fround(im)]); }
  try {
    for (const ch of CHAINS) {
      const steps = [{ type: ch.type, params: Object.assign(Funcs.defaults(ch.type), ch.params, { N: Funcs.DH_NMAX }), on: true }];
      const built = Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s)));
      const gc = GLChain.build(steps, built);
      const prog = compile(gc.source);
      const uvec = new Float32Array(4 * gc.slots); gc.fill(uvec);
      const nz = ws.length, d = new Float32Array(4 * nz);
      ws.forEach((z, i) => { d[4 * i] = z[0]; d[4 * i + 1] = z[1]; });
      const outTex = mkTex(nz, 1, null), fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
      gl.useProgram(prog);
      gl.uniform4fv(gl.getUniformLocation(prog, 'uChain'), uvec);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mkTex(nz, 1, d));
      gl.uniform1i(gl.getUniformLocation(prog, 'uPts'), 0);
      const sw = gl.getUniformLocation(prog, 'uSheetW'); if (sw) gl.uniform1i(sw, 1);
      gl.viewport(0, 0, nz, 1);
      gl.bindVertexArray(gl.createVertexArray());
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const out = new Float32Array(4 * nz);
      gl.readPixels(0, 0, nz, 1, gl.RGBA, gl.FLOAT, out);
      const row = { chain: ch.name, pixels: nz, hit: 0, ranOk: 0, polHist: [0, 0, 0, 0, 0], lastUnchanged: 0, lastUnchangedOfHit: 0 };
      for (let i = 0; i < nz; i++) {
        const pol = out[4 * i], same = out[4 * i + 1], hit = out[4 * i + 2], ok = out[4 * i + 3];
        if (ok) row.ranOk++;
        if (hit) { row.hit++; row.polHist[pol]++; if (same) row.lastUnchangedOfHit++; }
        if (ok && same) row.lastUnchanged++;
      }
      R.rows.push(row);
    }
  } catch (err) { R.errors.push(String(err && err.stack || err)); }
  R.done = true;
})();

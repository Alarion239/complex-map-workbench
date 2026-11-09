'use strict';
// GPU check of DH's and Böttcher's H as the shader computes it (src/glsl.js, the 'dh' / 'bottcher' plan): the orbit kept in
// variables for its first DH_REG points and recomputed from z beyond them, against the same function with the orbit in a
// 65-entry array. Both run as chainStep (mode 1 of test/glsl_test.js) on the same GPU over z in the pixel grids of
// the neighbourhood of the boundary of M, where the orbits are long; the values must agree bit for bit at z and at two offsets
// (so a difference quotient H' agrees too). The orbit length of each point is read off the CPU walk of the rounded z.
// Controls: the recomputation off by one step must differ. Results in window.__dhOrbit.
(function () {
  const R = window.__dhOrbit = { done: false, errors: [], rows: [], controls: [], renderer: null };
  const DH_RE = /vec2 o0, o1, o2, o3, o4, o5, o6, o7;/;
  const PTS = 4096, HSTEP = 1 / 1024;              // points per set; the offset of the difference quotient
  const NMAX = Funcs.DH_NMAX, ESC2 = 1e8;          // the shader's escape test on |w|^2
  const MIN_LONG = 1000, MIN_LONGER = 20;          // required points with n > 16 and n > 32
  const f = Math.fround;

  // orbit length of the shader's walk (n = k at the first |w|^2 > 1e8), in double on the rounded z; -1: no escape in NMAX steps
  const orbitLength = (zr, zi) => {
    let wr = zr, wi = zi;
    for (let k = 0; k <= NMAX; k++) {
      if (wr * wr + wi * wi > ESC2) return k;
      if (k >= NMAX) break;
      [wr, wi] = [wr * wr - wi * wi + zr, 2 * wr * wi + zi];
    }
    return -1;
  };

  // points near the boundary: bisection on a segment from an interior point to a far point, kept in float32; each bisection
  // step contributes the pair of points on both sides of the boundary
  let seed = 20241109;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pts = [];
  const have = { n16: 0, n32: 0 };
  const take = (re, im) => {
    const n = orbitLength(f(re), f(im));
    if (n < 0) return;
    pts.push([f(re), f(im), n]);
    if (n > 16) have.n16++;
    if (n > 32) have.n32++;
  };
  const INNER = [[0, 0], [-1, 0], [-0.12, 0.74], [0.28, 0.01], [-0.12, -0.74], [-1.3, 0.01]];
  for (let guard = 0; pts.length < PTS && guard < 4000; guard++) {
    const [ar, ai] = INNER[guard % INNER.length];
    const ang = 2 * Math.PI * rnd(), rad = 1 + 1.5 * rnd();
    let ir = ar, ii = ai, er = ar + rad * Math.cos(ang), ei = ai + rad * Math.sin(ang);
    if (orbitLength(f(er), f(ei)) < 0) continue;
    for (let it = 0; it < 26 && pts.length < PTS; it++) {
      const mr = (ir + er) / 2, mi = (ii + ei) / 2;
      take(mr, mi);
      if (orbitLength(f(mr), f(mi)) < 0) { ir = mr; ii = mi; } else { er = mr; ei = mi; }
    }
  }
  const nz = pts.length;
  if (have.n16 < MIN_LONG || have.n32 < MIN_LONGER) R.errors.push(`too few long orbits: n>16 ${have.n16} (need ${MIN_LONG}), n>32 ${have.n32} (need ${MIN_LONGER})`);

  // ---------- the shaders: the array form is the registers form with the orbit's bookkeeping replaced ----------
  const steps = [{ type: 'dh', params: Object.assign(Funcs.defaults('dh'), { N: NMAX }), on: true }];
  const built = Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s)));
  const gc = GLChain.build(steps, built);
  const REG = gc.source;
  const swap = (s, from, to, what) => { if (!(from instanceof RegExp ? from.test(s) : s.includes(from))) throw new Error(`pattern not found: ${what}`); return s.replace(from, to); };
  const ARR = (() => {
    let s = REG;
    s = swap(s, DH_RE, `vec2 orb[${NMAX + 1}];`, 'registers');
    s = swap(s, /if \(k == 0\) o0 = w;[^\n]*\n/, 'orb[k] = w;\n', 'register writes');
    s = swap(s, /if \(q < 8\) \{[^\n]*\n\s*else \{[^\n]*\}\n/, 'o = orb[q];\n', 'register reads');
    return s;
  })();
  const SKEW = swap(REG, 'i < q; i++', 'i < q + 1; i++', 'recomputation loop');   // control: off by one

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) { R.errors.push('no webgl2 / EXT_color_buffer_float'); R.done = true; return; }
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  R.renderer = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0); gl_Position = vec4(p, 0.0, 1.0); }';
  const MAIN = `
uniform highp sampler2D uPts;
out vec4 o;
void main() {
  vec2 w = chainStep(1, texelFetch(uPts, ivec2(gl_FragCoord.xy), 0).xy);
  o = vec4(w, 0.0, 1.0);
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
  const outTex = mkTex(nz, 1, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
  const vao = gl.createVertexArray();
  const uvec = new Float32Array(4 * gc.slots); gc.fill(uvec);
  const run = (prog, zs) => {
    const d = new Float32Array(4 * nz);
    zs.forEach((z, i) => { d[4 * i] = z[0]; d[4 * i + 1] = z[1]; });
    gl.useProgram(prog);
    gl.uniform4fv(gl.getUniformLocation(prog, 'uChain'), uvec);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mkTex(nz, 1, d));
    gl.uniform1i(gl.getUniformLocation(prog, 'uPts'), 0);
    const sw = gl.getUniformLocation(prog, 'uSheetW'); if (sw) gl.uniform1i(sw, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, nz, 1);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Float32Array(4 * nz);
    gl.readPixels(0, 0, nz, 1, gl.RGBA, gl.FLOAT, out);
    return new Uint32Array(out.buffer).filter((_, i) => i % 4 < 2);
  };
  const setZ = [pts.map((p) => [p[0], p[1]]), pts.map((p) => [f(p[0] + HSTEP), p[1]]), pts.map((p) => [p[0], f(p[1] + HSTEP)])];
  const NAMES = ['z', 'z+h', 'z+ih'];
  const isNaNBits = (u) => ((u >>> 23) & 255) === 255 && (u & 0x7fffff) !== 0;
  const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 2) { const nanA = isNaNBits(a[i]) || isNaNBits(a[i + 1]), nanB = isNaNBits(b[i]) || isNaNBits(b[i + 1]); if (nanA !== nanB || (!nanA && (a[i] !== b[i] || a[i + 1] !== b[i + 1]))) n++; } return n; };
  try {
    const pArr = compile(ARR), pReg = compile(REG), pSkew = compile(SKEW);
    // orbit length histogram of the walk at each set's z (the offset points have their own orbits)
    setZ.forEach((zs, s) => {
      const lens = zs.map((z) => orbitLength(z[0], z[1]));
      const hist = { 'n<=8': 0, '8<n<=16': 0, '16<n<=32': 0, 'n>32': 0, 'none': 0 };
      lens.forEach((n) => { hist[n < 0 ? 'none' : n <= 8 ? 'n<=8' : n <= 16 ? '8<n<=16' : n <= 32 ? '16<n<=32' : 'n>32']++; });
      const a = run(pArr, zs), r = run(pReg, zs), k = run(pSkew, zs);
      R.rows.push({ set: NAMES[s], points: nz, hist, arrayVsRegistersDiffer: differ(a, r) });
      R.controls.push({ set: NAMES[s], skewedRecomputeDiffers: differ(a, k), longTailOnly: lens.reduce((m, n, i) => m + (n > 8 && differ(a.slice(2 * i, 2 * i + 2), k.slice(2 * i, 2 * i + 2)) > 0 ? 1 : 0), 0) });
    });
    R.have = have;
    R.ok = !R.errors.length && R.rows.every((r) => r.arrayVsRegistersDiffer === 0) && R.controls.every((c) => c.skewedRecomputeDiffers > 0);
  } catch (err) { R.errors.push(String(err && err.stack || err)); }
  R.done = true;
})();

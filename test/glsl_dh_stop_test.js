'use strict';
// GPU check of the certified early stop of the orbit in DH's and Böttcher's H (src/glsl.js, the 'dh' / 'bottcher' plan): H as the
// shader computes it against the same shader with the stop removed (the full orbit to |w| > 10⁴), as chainStep (mode 1 of
// test/glsl_test.js) on the same GPU, over a dense grid of the plane, rings out to |z| = 1000 and the neighbourhood of ∂M.
// The stop certifies |H - H_full| <= DH_STOP_TOL (1 + |H|) with DH_STOP_TOL = HIT / 16, and the NaN pattern (the orbit
// that needs more than N steps) is the same. Controls: a bound 1000 times too loose must fail the certificate, and the
// stop must act (some H differ from the full orbit's). Results in window.__dhStop.
(function () {
  const R = window.__dhStop = { done: false, errors: [], rows: [], controls: [], renderer: null };
  const HIT = 1e-3, TOL = HIT / 16;
  const PTS = 8192;
  const f = Math.fround;
  const NMAX = Funcs.DH_NMAX;
  const orbitLength = (zr, zi, cr, ci) => {
    let wr = zr, wi = zi;
    for (let k = 0; k <= NMAX; k++) {
      if (wr * wr + wi * wi > 1e8) return k;
      if (k >= NMAX) break;
      [wr, wi] = [wr * wr - wi * wi + cr, 2 * wr * wi + ci];
    }
    return -1;
  };
  let seed = 20241109;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const CHAINS = [{ name: 'dh', params: {}, c: null }, { name: 'bottcher c = 0.3+0.6i', type: 'bottcher', params: { c: '0.3+0.6i' }, c: [0.3, 0.6] }];
  const plane = [];
  for (let i = 0; i < 64; i++) for (let j = 0; j < 64; j++) plane.push([f(-2.6 + 3.8 * (i + 0.5) / 64), f(-1.6 + 3.2 * (j + 0.5) / 64)]);
  const rings = [];
  for (let i = 0; i < 4096; i++) { const r = Math.pow(10, 0.3 + 2.7 * rnd()), a = 2 * Math.PI * rnd(); rings.push([f(r * Math.cos(a)), f(r * Math.sin(a))]); }
  const boundary = (c) => {
    const out = [], inner = [[0, 0], [-1, 0], [-0.12, 0.74], [0.28, 0.01], [-0.12, -0.74], [-1.3, 0.01]];
    const cOf = (z) => (c ? c : z);
    const esc = (z) => orbitLength(z[0], z[1], ...cOf(z)) >= 0;
    for (let g = 0; out.length < PTS && g < 4000; g++) {
      let a = inner[g % inner.length], ang = 2 * Math.PI * rnd(), rad = 1 + 1.5 * rnd();
      let e = [a[0] + rad * Math.cos(ang), a[1] + rad * Math.sin(ang)];
      if (!esc([f(e[0]), f(e[1])])) continue;
      for (let it = 0; it < 26 && out.length < PTS; it++) {
        const m = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2];
        out.push([f(m[0]), f(m[1])]);
        if (esc([f(m[0]), f(m[1])])) e = m; else a = m;
      }
    }
    return out;
  };
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
  const vao = gl.createVertexArray();
  const swap = (s, from, to, what) => { if (!(from instanceof RegExp ? from.test(s) : s.includes(from))) throw new Error(`pattern not found: ${what}`); return s.replace(from, to); };
  const STOP_LINE = /    if \(float\(k\) \+ 6\.0 <= [^\n]*\n/;
  const TOL_RE = /(<= )([0-9.]+e-[0-9]+)( \* w2 \* w2)/;
  try {
    for (const ch of CHAINS) {
      const steps = [{ type: ch.type || 'dh', params: Object.assign(Funcs.defaults(ch.type || 'dh'), ch.params, { N: NMAX }), on: true }];
      const built = Funcs.applyRepeats(steps, steps.map((s) => Funcs.build(s)));
      const gc = GLChain.build(steps, built);
      const EARLY = gc.source;
      const FULL = swap(EARLY, STOP_LINE, '', 'the stop line');
      const LOOSE = swap(EARLY, TOL_RE, (m, a, v, b) => a + (+v * 1e6).toExponential(6) + b, 'the stop tolerance');   // (squared bound: 1000 times the bound)
      const uvec = new Float32Array(4 * gc.slots); gc.fill(uvec);
      const progs = { EARLY: compile(EARLY), FULL: compile(FULL), LOOSE: compile(LOOSE) };
      const run = (prog, zs) => {
        const nz = zs.length, d = new Float32Array(4 * nz);
        zs.forEach((z, i) => { d[4 * i] = z[0]; d[4 * i + 1] = z[1]; });
        const outTex = mkTex(nz, 1, null), fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0);
        gl.useProgram(prog);
        gl.uniform4fv(gl.getUniformLocation(prog, 'uChain'), uvec);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mkTex(nz, 1, d));
        gl.uniform1i(gl.getUniformLocation(prog, 'uPts'), 0);
        const sw = gl.getUniformLocation(prog, 'uSheetW'); if (sw) gl.uniform1i(sw, 1);
        gl.viewport(0, 0, nz, 1);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const out = new Float32Array(4 * nz);
        gl.readPixels(0, 0, nz, 1, gl.RGBA, gl.FLOAT, out);
        return out;
      };
      if (ch.c) ch.rho = CX.dhCritRho(CX.C(ch.c[0], ch.c[1]), NMAX);
      const sets = { plane, rings, boundary: boundary(ch.c) };
      for (const [name, zs] of Object.entries(sets)) {
        const a = run(progs.EARLY, zs), b = run(progs.FULL, zs), l = run(progs.LOOSE, zs);
        const cmp = (x) => {
          let worst = 0, nanDiff = 0, differ = 0, over = 0;
          for (let i = 0; i < zs.length; i++) {
            const xr = x[4 * i], xi = x[4 * i + 1], br = b[4 * i], bi = b[4 * i + 1];
            const nx = !(Math.abs(xr) < Infinity) || xr !== xr, nb = !(Math.abs(br) < Infinity) || br !== br;
            // (the NaN of φ_c below the critical potential rho moves with H by at most the bound, so a flip is allowed
            // where the finite value is within the bound of rho)
            if (nx !== nb) {
              const hr = nx ? br : xr, hi = nx ? bi : xi, m = Math.hypot(hr, hi);
              if (!(ch.rho && Math.abs(m - ch.rho) <= TOL * (1 + m))) nanDiff++;
              continue;
            }
            if (nx) continue;
            const d = Math.hypot(xr - br, xi - bi), q = d / (1 + Math.hypot(br, bi));
            if (xr !== br || xi !== bi) differ++;
            if (q > worst) worst = q;
            if (q > TOL) over++;
          }
          return { worstOverTol: worst / TOL, nanDiff, differ, over };
        };
        R.rows.push({ chain: ch.name, set: name, points: zs.length, early: cmp(a) });
        R.controls.push({ chain: ch.name, set: name, loose: cmp(l) });
      }
    }
    R.ok = !R.errors.length
      && R.rows.every((r) => r.early.over === 0 && r.early.nanDiff === 0)
      && R.rows.some((r) => r.early.differ > 0)
      && R.controls.some((c) => c.loose.over > 0);
  } catch (err) { R.errors.push(String(err && err.stack || err)); }
  R.done = true;
})();

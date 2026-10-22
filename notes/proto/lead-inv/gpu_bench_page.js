// GPU feasibility check of the per-pixel inverse pass (SPEC 4): hand-written GLSL ES 3.00 for four scenes, run in
// headless Chrome (ANGLE Metal) by gpu_bench_cmd.js. Measures the GPU-synchronised time per full-pane pass and reads
// back the z^i(H) image to check the hole and the ring radii in float32.
/* eslint-disable */
async function runBench(opts) {
  const out = { ua: navigator.userAgent, results: [] };
  const cv = document.createElement('canvas');
  document.body.appendChild(cv);
  const gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) return { error: 'no webgl2' };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  out.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;
  const HEAD = `#version 300 es
precision highp float; precision highp int;
uniform vec2 uC; uniform float uS; uniform vec4 uVp; uniform vec4 uWin; uniform float uR; uniform float uRs; uniform float uAlpha; uniform int uK;
uniform vec2 uRef; uniform float uCell; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uPlane;
out vec4 o;
const float PI = 3.141592653589793, TAU = 6.283185307179586, LN2 = 0.6931471805599453;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cdiv(vec2 a, vec2 b) { float d = dot(b, b); return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
vec2 cexp(vec2 z) { float e = exp(z.x); return vec2(e * cos(z.y), e * sin(z.y)); }
vec2 clog(vec2 z) { return vec2(log(length(z)), atan(z.y, z.x)); }
vec2 csqrt(vec2 a) { float r = length(a); if (r == 0.0) return vec2(0.0); if (a.x >= 0.0) { float t = sqrt(0.5 * (r + a.x)); return vec2(t, a.y / (2.0 * t)); } float t = sqrt(0.5 * (r - a.x)); return vec2(abs(a.y) / (2.0 * t), a.y >= 0.0 ? t : -t); }
vec2 casin0(vec2 a) { vec2 s = csqrt(vec2(1.0, 0.0) - cmul(a, a)); vec2 l = clog(vec2(-a.y, a.x) + s); return vec2(l.y, -l.x); }
vec2 casin(vec2 a) { return a.y > 0.0 ? -casin0(-a) : casin0(a); }
vec2 ccos(vec2 a) { return vec2(cos(a.x) * cosh(a.y), -sin(a.x) * sinh(a.y)); }
float checker(vec2 p, vec2 w) {
  w = max(w, vec2(1e-7));
  vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}
float moire(vec2 w) { return smoothstep(0.18, 0.45, max(w.x, w.y)); }
// front-to-back buffer of the B nearest covering candidates (D asc; ties: larger tie key first)
const int B = 8;
float bD[B]; float bT[B]; float bC[B]; vec3 bCol[B]; int nb = 0;
void ins(float D, float T, float c, vec3 col) {
  if (nb == B && !(D < bD[B - 1] || (D == bD[B - 1] && T > bT[B - 1]))) return;
  int i = min(nb, B - 1);
  for (int q = B - 1; q > 0; q--) {
    if (q > i) continue;
    bool prevWorse = bD[q - 1] > D || (bD[q - 1] == D && bT[q - 1] < T);
    if (!prevWorse) break;
    bD[q] = bD[q - 1]; bT[q] = bT[q - 1]; bC[q] = bC[q - 1]; bCol[q] = bCol[q - 1]; i = q - 1;
  }
  bD[i] = D; bT[i] = T; bC[i] = c; bCol[i] = col;
  if (nb < B) nb++;
}
float DK() { return nb >= uK ? bD[uK - 1] : 1e38; }
// sheet key: log2(1 + dist(z, window)/R) (+ singular depth added by the caller)
float Dwin(vec2 z) { vec2 d = max(max(uWin.xy - z, z - uWin.zw), vec2(0.0)); return log2(1.0 + length(d) / uR); }
vec4 composite() {
  float U = 0.0; for (int i = 0; i < B; i++) if (i < nb) U = max(U, bC[i]);
  float T = 1.0; vec3 c = vec3(0.0);
  for (int i = 0; i < B; i++) { if (i >= nb || T < 1.0 / 255.0) break; float a = uAlpha * bC[i] / U; c += T * a * bCol[i]; T *= 1.0 - a; }
  float A = U * (1.0 - T);
  return vec4(U * c + (1.0 - A) * uPlane, 1.0);
}
vec2 pixW(out float pxw) { pxw = 1.0 / uS; vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw; return uC + f * pxw; }
`;
  // z^i of H: Lambda_m = (arg w + 2 pi m, -ln|w|), z = e^Lambda; polar pattern from Lambda; singular point 0
  const ZI = HEAD + `
void main() {
  float pxw; vec2 w = pixW(pxw);
  float r = length(w); vec2 Lw = clog(w);
  vec2 beta = vec2(0.0, -1.0);
  vec2 bL = cmul(beta, Lw);
  float lo = -PI, hi = PI;
  float lvl = min(bL.y - lo, hi - bL.y) * r / pxw;   // the range level is the same for every m
  if (lvl < -1.0) { o = vec4(uPlane, 1.0); return; }
  vec2 dLdw = cdiv(beta, w);            // dLambda/dw
  vec2 dLX = dLdw * pxw, dLY = cmul(dLdw, vec2(0.0, pxw));
  float ms = floor((bL.x - log(length(uRef))) / (TAU * beta.y) + 0.5);
  bool doneP = false, doneM = false;
  for (int j = 0; j < 17; j++) {
    bool plus = (j % 2) == 0; int k = (j + 1) / 2;
    if (plus ? doneP : doneM) continue;
    float m = ms + (plus ? float(k) : -float(k));
    vec2 L = vec2(bL.x - TAU * m * beta.y, bL.y + TAU * m * beta.x);
    float sreg = r * sin(L.y) / pxw;     // Im z / (|dz/dw| px): no overflow through Lambda
    float cv = clamp(min(sreg, lvl) + 0.5, 0.0, 1.0);
    vec2 z = L.x < 80.0 ? cexp(L) : vec2(1e30);
    float D = Dwin(z) + max(0.0, log2(uRs) - L.x / LN2);
    if (cv > 0.0) {
      vec2 g = L * (16.0 / TAU), gw = (abs(dLX) + abs(dLY)) * (16.0 / TAU);
      vec3 col = mix(mix(uC0, uC1, checker(g, gw)), 0.5 * (uC0 + uC1), moire(gw));
      ins(D, z.y * 1e6 + z.x, cv, col);
    }
    if (D > DK()) { if (plus) doneP = true; else doneM = true; }
    if (doneP && doneM) break;
  }
  o = composite();
}`;
  // exp of H: u_m = Log w + 2 pi i m (= z); checker on z; window distance only
  const EXPH = HEAD + `
void main() {
  float pxw; vec2 w = pixW(pxw);
  vec2 Lw = clog(w); vec2 dz = cdiv(vec2(1.0, 0.0), w); float J = length(dz);
  vec2 dX = dz * pxw, dY = cmul(dz, vec2(0.0, pxw));
  float ms = floor((uRef.y - Lw.y) / TAU + 0.5);
  bool doneP = false, doneM = false;
  for (int j = 0; j < 17; j++) {
    bool plus = (j % 2) == 0; int k = (j + 1) / 2;
    if (plus ? doneP : doneM) continue;
    vec2 z = vec2(Lw.x, Lw.y + TAU * (ms + (plus ? float(k) : -float(k))));
    float cv = clamp(z.y / (J * pxw) + 0.5, 0.0, 1.0);
    float D = Dwin(z);
    if (cv > 0.0) {
      vec2 g = z / uCell, gw = (abs(dX) + abs(dY)) / uCell;
      ins(D, z.y * 1e6 + z.x, cv, mix(mix(uC0, uC1, checker(g, gw)), 0.5 * (uC0 + uC1), moire(gw)));
    }
    if (D > DK()) { if (plus) doneP = true; else doneM = true; }
    if (doneP && doneM) break;
  }
  o = composite();
}`;
  // e^{1/z} on |z| < 1: u_m = Log w + 2 pi i m (stage 1), z = 1/u_m; singular point 0
  const E1Z = HEAD + `
void main() {
  float pxw; vec2 w = pixW(pxw);
  vec2 Lw = clog(w); vec2 dudw = cdiv(vec2(1.0, 0.0), w);
  float ms = floor((uRef.y - Lw.y) / TAU + 0.5);
  bool doneP = false, doneM = false;
  for (int j = 0; j < 17; j++) {
    bool plus = (j % 2) == 0; int k = (j + 1) / 2;
    if (plus ? doneP : doneM) continue;
    vec2 u = vec2(Lw.x, Lw.y + TAU * (ms + (plus ? float(k) : -float(k))));
    vec2 z = cdiv(vec2(1.0, 0.0), u);
    vec2 dz = -cmul(cmul(z, z), dudw); float J = length(dz);
    vec2 dX = dz * pxw, dY = cmul(dz, vec2(0.0, pxw));
    float cv = clamp((1.0 - length(z)) / (J * pxw) + 0.5, 0.0, 1.0);
    float D = Dwin(z) + max(0.0, log2(uRs / length(z)));
    if (cv > 0.0) {
      vec2 g = z / uCell, gw = (abs(dX) + abs(dY)) / uCell;
      ins(D, z.y * 1e6 + z.x, cv, mix(mix(uC0, uC1, checker(g, gw)), 0.5 * (uC0 + uC1), moire(gw)));
    }
    if (D > DK()) { if (plus) doneP = true; else doneM = true; }
    if (doneP && doneM) break;
  }
  o = composite();
}`;
  // sin of the half-strip, no pruning: two families x 17 members, the level by central differences (a formula shape)
  const SINHS = HEAD + `
float lev(vec2 z) { return min(0.5 * PI - abs(z.x), z.y); }
void main() {
  float pxw; vec2 w = pixW(pxw);
  vec2 a = casin(w);
  for (int b = 0; b < 2; b++) {
    vec2 base = b == 0 ? a : vec2(PI, 0.0) - a;
    float ns = floor((uRef.x - base.x) / TAU + 0.5);
    bool doneP = false, doneM = false;
    for (int j = 0; j < 17; j++) {
      bool plus = (j % 2) == 0; int k = (j + 1) / 2;
      if (plus ? doneP : doneM) continue;
      vec2 z = base + vec2(TAU * (ns + (plus ? float(k) : -float(k))), 0.0);
      vec2 dz = cdiv(vec2(1.0, 0.0), ccos(z));
      vec2 dX = dz * pxw, dY = cmul(dz, vec2(0.0, pxw));
      float l0 = lev(z), lx = 0.5 * (lev(z + dX) - lev(z - dX)), ly = 0.5 * (lev(z + dY) - lev(z - dY));
      float cv = clamp(l0 / max(length(vec2(lx, ly)), 1e-30) + 0.5, 0.0, 1.0);
      float D = Dwin(z);
      if (cv > 0.0) {
        vec2 g = z / uCell, gw = (abs(dX) + abs(dY)) / uCell;
        ins(D, z.y * 1e6 + z.x, cv, mix(mix(uC0, uC1, checker(g, gw)), 0.5 * (uC0 + uC1), moire(gw)));
      }
      if (D > DK()) { if (plus) doneP = true; else doneM = true; }
      if (doneP && doneM) break;
    }
  }
  o = composite();
}`;
  function prog(fs) {
    const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const vao = gl.createVertexArray();
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const scenes = [
    { name: 'zi_H', fs: ZI, view: { cx: 0, cy: 0, s: 190 }, win: { cx: 0, cy: 1, s: 60 }, ref: [0, 1], cell: 1 },
    { name: 'expH', fs: EXPH, view: { cx: 0, cy: 0, s: 60 }, win: { cx: 0, cy: 1, s: 60 }, ref: [0, 1], cell: 1 },
    { name: 'e1z_disc', fs: E1Z, view: { cx: 0, cy: 0, s: 60 }, win: { cx: 0, cy: 0, s: 120 }, ref: [1 / (0.25 * 3.4167 * Math.cos(0.3)), -0.3], cell: 0.2 },
    { name: 'sin_halfstrip', fs: SINHS, view: { cx: 0, cy: 2, s: 50 }, win: { cx: 0, cy: 1.25, s: 105 }, ref: [0, 1.25], cell: 0.5 },
  ];
  for (const sc of scenes) {
    let p;
    const tc = performance.now();
    try { p = prog(sc.fs); } catch (e) { out.results.push({ name: sc.name, error: String(e.message || e).slice(0, 400) }); continue; }
    const compileMs = performance.now() - tc;
    const L = (n) => gl.getUniformLocation(p, n);
    const rec = { name: sc.name, compileMs: +compileMs.toFixed(1), sizes: [] };
    for (const [Wp, Hp, scale] of [[410, 516, 1], [820, 1032, 2], [1640, 2064, 4]]) {
      cv.width = Wp; cv.height = Hp;
      gl.viewport(0, 0, Wp, Hp);
      gl.useProgram(p);
      gl.bindVertexArray(vao);
      const s = sc.view.s * scale;
      gl.uniform2f(L('uC'), sc.view.cx, sc.view.cy); gl.uniform1f(L('uS'), s); gl.uniform4f(L('uVp'), 0, 0, Wp, Hp);
      const hw = 205 / sc.win.s, hh = 258 / sc.win.s;
      gl.uniform4f(L('uWin'), sc.win.cx - hw, sc.win.cy - hh, sc.win.cx + hw, sc.win.cy + hh);
      const R = Math.hypot(hw, hh);
      gl.uniform1f(L('uR'), R); gl.uniform1f(L('uRs'), R / 8);
      gl.uniform1f(L('uAlpha'), opts.alpha); gl.uniform1i(L('uK'), opts.alpha >= 1 ? 1 : Math.min(8, Math.ceil(Math.log(1 / 255) / Math.log(1 - opts.alpha))));
      gl.uniform2f(L('uRef'), sc.ref[0], sc.ref[1]); gl.uniform1f(L('uCell'), sc.cell);
      gl.uniform3fv(L('uC0'), hex('#3B6FD4')); gl.uniform3fv(L('uC1'), hex('#8CABE5')); gl.uniform3fv(L('uPlane'), hex('#FCFDFD'));
      const px = new Uint8Array(4);
      // warm up, then N GPU-synchronised frames
      for (let i = 0; i < 3; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const N = 30, t0 = performance.now();
      for (let i = 0; i < N; i++) { gl.drawArrays(gl.TRIANGLES, 0, 3); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      const ms = (performance.now() - t0) / N;
      rec.sizes.push({ px: `${Wp}x${Hp}`, mpix: +(Wp * Hp / 1e6).toFixed(2), msPerPass: +ms.toFixed(2) });
      if (scale === 1 && sc.name === 'zi_H') {
        // read back the image: the hole |w| < e^-pi must stay plane-coloured; count fill pixels by radius band
        const buf = new Uint8Array(Wp * Hp * 4);
        gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let holeN = 0, holeFill = 0, annN = 0, annPlane = 0, outN = 0, outFill = 0;
        const plane = hex('#FCFDFD').map((x) => Math.round(255 * x));
        for (let y = 0; y < Hp; y++) for (let x = 0; x < Wp; x++) {
          const wx = (x + 0.5 - Wp / 2) / s, wy = (y + 0.5 - Hp / 2) / s, r = Math.hypot(wx, wy);
          const k = 4 * (y * Wp + x), isPlane = Math.abs(buf[k] - plane[0]) + Math.abs(buf[k + 1] - plane[1]) + Math.abs(buf[k + 2] - plane[2]) <= 3;
          if (r < Math.exp(-Math.PI) - 1.5 / s) { holeN++; if (!isPlane) holeFill++; }
          else if (r > Math.exp(-Math.PI) + 1.5 / s && r < 1 - 1.5 / s) { annN++; if (isPlane) annPlane++; }
          else if (r > 1 + 1.5 / s) { outN++; if (!isPlane) outFill++; }
        }
        rec.check = { holeN, holeFill, annN, annPlane, outN, outFill };
        rec.png = cv.toDataURL('image/png');
      }
    }
    out.results.push(rec);
  }
  return out;
}

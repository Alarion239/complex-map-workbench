'use strict';
// GPU renderer (WebGL2). The function chain is compiled to GLSL (GLChain) and evaluated per vertex / per pixel.
// One shared offscreen WebGL2 context renders every view; results are blitted into the pane canvases.
//
// Colors passed in are sRGB floats [r, g, b] in 0..1 (hex strings are accepted too). 2D fills blend in sRGB like
// the rest of the page; 3D surfaces (landscape, sphere) are lit in linear light and encoded back to sRGB.
//
// Map cache (spec 8.1): drawRegion / drawLines with a non-empty st.cacheKey evaluate the chain once per unique
// template point into an RG32F texture (drawn as one-pixel points with EXT_color_buffer_float, else through a
// transform-feedback buffer) that later frames read with texelFetch. Those frames run a shader without the chain:
// panning changes uniforms only. Without a cacheKey (homotopy frames, thumbnails) the same evaluation goes to a
// per-resource scratch texture (tmpEntry), so 2D views need no per-vertex chain program.
//
// Precision: meshes and lines are sent relative to a per-resource origin O (float64 on the CPU); shaders evaluate
// the chain at O + local, with O as a hi/lo float pair, and identity views place the local coordinates directly.
//
// Compiles (spec 8.7): with KHR_parallel_shader_compile, chain programs compile in the background. Until a new
// chain's program is ready, the newest earlier chain whose program is ready keeps drawing (frameStatus().pending),
// and onReady fires when the compile lands. A failed compile is reported by frameStatus().error. Landed programs
// are taken into use one per FRESH_MS (canFinish). Side mode (GLR.side) draws another chain (example thumbnails)
// without touching the current one, its history or their programs.
const GLR = (() => {
  let canvas = null, gl = null, ok = false, lost = false;
  // the current chain version and recent earlier ones: {key, info, data, hash, sigs}
  let cur = { key: '__none__', info: null, data: new Float32Array(4), hash: '', sigs: [] };
  const hist = [];
  const progs = new Map(); // `${name}|${key}` -> {name, key, ch, state: 'pending'|'ready'|'error', p, loc, error, used}
  let lastError = '';
  let maxTex = 4096;
  let pcExt = null;        // KHR_parallel_shader_compile
  let rtOK = false;        // EXT_color_buffer_float: map caches are drawn into their RG32F texture (tfEntry)
  let syncDepth = 0;       // > 0: chain programs are waited for (tests)
  // side mode (GLR.side): setChain and the draws use a chain that is not the user's (example thumbnails) without
  // touching cur or hist; side = the saved {cur} while it lasts
  let sideMode = false, side = null;
  const sideChs = new Map();
  let frameErr = '', framePending = false;
  const live = new Set(); // resources that may hold map caches (freed on context loss)

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function hexRGB(hex) {
    const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex).trim());
    const v = m ? parseInt(m[1], 16) : 0x888888;
    return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
  }
  // accepts [r,g,b] floats or '#rrggbb'
  const col3 = (c, def) => (c == null ? (typeof def === 'string' ? hexRGB(def) : def) : (typeof c === 'string' ? hexRGB(c) : c));
  const lin1 = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toLin3 = (c) => [lin1(c[0]), lin1(c[1]), lin1(c[2])];
  const lum = (c) => 0.2126 * lin1(c[0]) + 0.7152 * lin1(c[1]) + 0.0722 * lin1(c[2]);

  // ---------------- GLSL sources ----------------
  const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
#define PI 3.141592653589793
#define TAU 6.283185307179586
`;
  // The map of a draw (uMode): 0 stages a..b (chainRange), 1 the natural homotopy of step uHi at uT, 2 the straight
  // line from stage a to stage b at uT, 3 the natural homotopies of the steps in (a, b] all at once at uT
  // (chainHomAll: H_t = h_{b,t} o ... o h_{a+1,t}; never across a d/dz). s is the point of the source plane: stage a for mode 0, else stage uBase
  // (map.base; 0, the z-plane, by default).
  // A chain with d/dz steps (GLChain's chainStage / chainIsDeriv): stage maps G_k are functions of z, a d/dz step
  // has no homotopy of its own, so mode 1 at a d/dz step mixes G_(hi-1)(s) and G_hi(s), and mode 2 takes G_b(s)
  // when a d/dz step lies in (a, b] (chainRange from a > 0 cannot cross one).
  // (v16 deformation range, notes/deform-range/SPEC.md 4: modes 1 and 3 may carry a post, the steps (uB, uPost] after
  // the bracket in full, maps only by the d/dz rule; none when uPost <= uB. Every homotopy is the identity at t <= 0:
  // H_0 = post o pre exactly. ?: evaluates only the chosen operand, so t = 0 costs no homotopy.)
  const POST_OF = `
vec2 postOf(vec2 w) { return uPost > uB ? chainRange(w, uB, uPost) : w; }
`;
  const MAP_PLAIN = POST_OF + `
vec2 mapPoint(vec2 s) {
  if (uMode == 1) { vec2 z = chainRange(s, uBase, uHi - 1); return postOf(uT <= 0.0 ? z : chainHom(uHi, z, uT)); }
  if (uMode == 2) { vec2 z0 = chainRange(s, uBase, uA); vec2 z1 = chainRange(z0, uA, uB); return mix(z0, z1, uT); }
  if (uMode == 3) { vec2 z = chainRange(s, uBase, uA); return postOf(uT <= 0.0 ? z : chainHomAll(z, uA, uB, uT)); }
  return chainRange(s, uA, uB);
}
`;
  const MAP_STAGE = (n) => POST_OF + `
bool derivIn(int a, int b) {
  for (int k = 1; k <= ${Math.max(1, n)}; k++) { if (k > b) break; if (k > a && chainIsDeriv(k)) return true; }
  return false;
}
vec2 mapPoint(vec2 s) {
  if (uMode == 1) {
    vec2 z = chainRange(s, uBase, uHi - 1);
    // (a d/dz focus has the z-plane on the left; the line's ends are exact, as homrange.js lerpE: review v16 math-2)
    if (chainIsDeriv(uHi)) return postOf(uT <= 0.0 ? z : uT >= 1.0 ? chainStage(uHi, s) : mix(z, chainStage(uHi, s), uT));
    return postOf(uT <= 0.0 ? z : chainHom(uHi, z, uT));
  }
  if (uMode == 2) {
    vec2 z0 = chainRange(s, uBase, uA);
    vec2 z1 = uA > 0 && derivIn(uA, uB) ? chainStage(uB, s) : chainRange(z0, uA, uB);
    return mix(z0, z1, uT);
  }
  if (uMode == 3) { vec2 z = chainRange(s, uBase, uA); return postOf(uT <= 0.0 ? z : chainHomAll(z, uA, uB, uT)); }
  return chainRange(s, uA, uB);
}
`;
  const hasStages = (info) => !!info && /\bchainStage\b/.test(info.source || '') && /\bchainIsDeriv\b/.test(info.source || '');
  const hasSheets = (info) => !!info && /\bchainSheetRange\b/.test(info.source || '');
  const MAP = (info) => `
uniform int uMode; uniform int uA; uniform int uB; uniform int uHi; uniform float uT; uniform int uBase; uniform int uPost;
${hasStages(info) ? MAP_STAGE(sigsOf(info.key).length) : MAP_PLAIN}
// the plotted function of the color plot, landscape and phase sphere (derivatives are d/dz steps of the chain)
vec2 mapF(vec2 z) { return mapPoint(z); }
`;
  // identical to GLChain.LIB's cfin, for programs that do not include the chain
  const FIN = `
bool cfin(vec2 w) {
  if (!(abs(w.x) < 1e30 && abs(w.y) < 1e30)) return false;
  vec2 s = w * 1e-20;
  return dot(s, s) < 1e20;
}
`;
  // fragment helpers (spec 6.3) and the OKLCH phase wheel (spec 6.8, one LUT fetch)
  const UTIL = `
uniform sampler2D uLut;
vec3 toLin(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 wheel(float th, float L) {
  float v = (0.5 + 31.0 * clamp((L - 0.05) / 0.93, 0.0, 1.0)) / 32.0;
  return textureLod(uLut, vec2(th * (1.0 / TAU), v), 0.0).rgb;
}
vec3 gray(float L) { return toSrgb(vec3(L * L * L)); }
float checker(vec2 p, vec2 w) {
  w = max(w, vec2(1e-7));
  vec2 i = 2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w;
  return 0.5 - 0.5 * i.x * i.y;
}
// lines at integer x, px device pixels wide; w = fwidth(x)
float iso(float x, float w, float px) { float d = abs(fract(x + 0.5) - 0.5) / max(w, 1e-6); return 1.0 - smoothstep(0.5 * px - 0.5, 0.5 * px + 0.6, d); }
// the single line x = 0
float iso0(float x, float w, float px) { float d = abs(x) / max(w, 1e-30); return 1.0 - smoothstep(0.5 * px - 0.5, 0.5 * px + 0.6, d); }
float moire(vec2 w) { return smoothstep(0.18, 0.45, max(w.x, w.y)); }
// isolines fade out where they would be denser than 3 px
float dfade(float w) { return 1.0 - smoothstep(0.15, 0.35, w); }
float Gsaw(float x) { float f = fract(x); return 0.5 * floor(x) + 0.5 * f * f; }
float sawAA(float x, float w) { w = max(w, 1e-5); return (Gsaw(x + 0.5 * w) - Gsaw(x - 0.5 * w)) / w; }
float argWidth(vec2 z) { return min(fwidth(atan(z.y, z.x)), fwidth(atan(-z.y, -z.x))); }
float wabs(vec2 w) {
  float m = max(abs(w.x), abs(w.y));
  if (!(m > 0.0)) return 0.0;
  if (m > 1e18 || m < 1e-18) return m * length(w / m);
  return length(w);
}
float wang(vec2 w) { return (w.x == 0.0 && w.y == 0.0) ? 0.0 : atan(w.y, w.x); }
`;
  // domain coloring styles (spec 6.8); needs UTIL
  const DCOLOR = `
uniform int uStyle; uniform float uSectors; uniform float uGrid; uniform vec3 uPlane; uniform vec3 uInk; uniform float uDark; uniform float uDpr; uniform float uPhaseLines;
vec3 dcolor(vec2 w) {
  // every derivative first, in uniform control flow
  float r = wabs(w);
  float th = wang(w);
  float q = TAU / max(uSectors, 1.0);
  float lr = log(clamp(r, 1e-37, 3e38));
  float flr = fwidth(lr);
  float xm = lr / q, fm = flr / q;
  float xp = th / q, fp = argWidth(w) / q;
  vec2 g = w / max(uGrid, 1e-30);
  vec2 gw = fwidth(g);
  vec2 fw0 = fwidth(w);
  if (!(abs(w.x) < 3e38 && abs(w.y) < 3e38)) {
    if (abs(w.x) > 3e38 || abs(w.y) > 3e38) return vec3(0.96078);  // +-infinity: #F5F5F5
    float h = (gl_FragCoord.x + gl_FragCoord.y) * 0.70710678 / (6.0 * uDpr);  // NaN: #7F7F7F, 45 deg hatch #6A6A6A
    return mix(vec3(0.49804), vec3(0.41569), iso(h, 1.0 / (6.0 * uDpr), uDpr));
  }
  if (uStyle == 2) {        // Phase
    vec3 c = wheel(th, 0.75);
    if (uPhaseLines > 0.5) c = mix(c, vec3(0.0), 0.20 * iso(xp, fp, 1.0) * dfade(fp));
    return c;
  }
  if (uStyle == 1) {        // Modulus (classic): zeros black, poles white
    float u = (2.0 / PI) * atan(r);
    float L = 0.08 + 0.88 * u;
    vec3 c = mix(gray(L), wheel(th, L), min(1.0, 5.2 * u * (1.0 - u)));
    float l2 = lr * 1.4426950408889634, f2 = flr * 1.4426950408889634;
    return mix(c, vec3(0.0), 0.15 * iso(l2, f2, 1.0) * dfade(f2));
  }
  if (uStyle == 4) {        // Contours
    vec3 c = mix(uPlane, wheel(th, 0.75), 0.12);
    c = mix(c, uInk, 0.5 * iso(xm, fm, uDpr) * dfade(fm));
    c = mix(c, wheel(th, uDark > 0.5 ? 0.80 : 0.55), iso(xp, fp, 1.25 * uDpr) * dfade(fp));
    return mix(c, uInk, iso0(lr, flr, 1.75 * uDpr));
  }
  if (uStyle == 3) {        // Grid: pullback of the image's coordinate net
    vec3 c = mix(wheel(th, 0.90), uPlane, 0.35);
    float l1 = max(iso(g.x, gw.x, uDpr) * dfade(gw.x), iso(g.y, gw.y, uDpr) * dfade(gw.y));
    float l5 = max(iso(g.x / 5.0, gw.x / 5.0, 1.75 * uDpr) * dfade(gw.x / 5.0), iso(g.y / 5.0, gw.y / 5.0, 1.75 * uDpr) * dfade(gw.y / 5.0));
    float l0 = max(iso0(w.x, fw0.x, 1.75 * uDpr), iso0(w.y, fw0.y, 1.75 * uDpr));
    c = mix(c, wheel(th, 0.45), 0.85 * l1);
    return mix(c, wheel(th, 0.30), max(l5, l0));
  }
  // Tiles (enhanced): conformal squares, modulus x e^(2pi/n) and phase 2pi/n per tile
  float sm = sawAA(xm, fm), sp = sawAA(xp, fp);
  float d = 1.0 - smoothstep(0.25, 0.6, max(fm, fp));
  float L = 0.62 + d * (0.20 * (sm - 0.5) + 0.07 * (sp - 0.5));
  return mix(wheel(th, L), vec3(1.0), 0.6 * iso0(lr, flr, 1.25));
}
`;
  // fixed-in-world light rig (spec 6.9), all in linear light
  const SHADE = `
uniform vec3 uKeyDir; uniform vec3 uFillDir; uniform vec3 uSky; uniform vec3 uGround;
uniform float uSpecK; uniform float uSpecE; uniform float uRimK;
vec3 shade(vec3 alb, vec3 n, vec3 v, float ao) {
  float s = 1.0;
  if (dot(n, v) < 0.0) { n = -n; s = 0.6; }   // back faces: flipped normal at 0.6
  float ndl = max(dot(n, uKeyDir), 0.0);
  vec3 light = vec3(0.80 * ndl * (0.5 + 0.5 * ao));
  light += 0.18 * uSky * max(dot(n, uFillDir), 0.0);
  light += mix(uGround, uSky, 0.5 + 0.5 * n.z) * (0.40 * ao);
  vec3 c = alb * light;
  vec3 h = normalize(uKeyDir + v);
  c += uSpecK * pow(max(dot(n, h), 0.0), uSpecE) * step(1e-4, ndl);
  c += uRimK * pow(1.0 - max(dot(n, v), 0.0), 3.0) * uSky;
  return c * s;
}
`;
  const FADE = `
uniform vec4 uFade; uniform int uFadeMode; uniform float uFadeW;
float fadeOf(vec2 s) {
  if (uFadeMode == 1) {
    float d = min(min(s.x - uFade.x, uFade.z - s.x), min(s.y - uFade.y, uFade.w - s.y));
    return smoothstep(0.0, uFadeW, d);
  }
  if (uFadeMode == 2) return smoothstep(0.0, uFadeW, uFade.z - length(s - uFade.xy));
  return 1.0;
}
`;
  // The conjugate lift (notes/ui-design/panels.md 9.0): P(z) = (2x, -2y, |z|^2 - 1) / (|z|^2 + 1), 0 at the south pole,
  // infinity at the north pole. Seen from outside through the right-handed camera it keeps the plane's orientation
  // (the plain lift (2x, 2y, ...) drew every globe as a mirror image: a half-plane on the wrong side of its arrow, the
  // Tiles F reversed). Its inverse is w = (P.x - i P.y) / (1 - P.z) = 1 / ((P.x + i P.y) / (1 + P.z)). Every place a
  // point meets the sphere uses it: this lift, the globe shaders' inverses, and app.js (picking, marks, labels).
  const LIFT = `
vec3 lift(vec2 w) {
  float q = dot(w, w);
  vec2 c = vec2(w.x, -w.y);
  if (q > 1.0) { float iq = 1.0 / q; return vec3(2.0 * c * iq, 1.0 - iq) / (1.0 + iq); }
  return vec3(2.0 * c, q - 1.0) / (q + 1.0);
}
`;
  // source points arrive relative to the resource origin O = uOrgHi + uOrgLo (a float64 split in two floats)
  const SRC = `
uniform vec2 uOrgHi; uniform vec2 uOrgLo;
vec2 srcOf(vec2 l) { return uOrgHi + (l + uOrgLo); }
`;
  // where the mapped value of a template point comes from: 'tex' the cached texture, 'chain' the chain at O + l,
  // 'local' the identity in local coordinates (2D identity views), 'abs' the identity in absolute coordinates
  const FETCH = (mode) => (mode === 'tex' ? `
uniform highp sampler2D uW; uniform int uTexW; uniform int uP;
vec2 W(float k, vec2 s) { int i = gl_InstanceID * uP + int(k + 0.5); return texelFetch(uW, ivec2(i % uTexW, i / uTexW), 0).xy; }
` : `
vec2 mapL(vec2 l) { return ${mode === 'chain' ? 'mapPoint(srcOf(l))' : mode === 'abs' ? 'srcOf(l)' : 'l'}; }
vec2 W(float k, vec2 s) { return mapL(s); }
`);
  // A lattice point on an edge shared by two base triangles is computed by the same expression from both sides
  // (endpoints in a canonical order), so neighbouring sub-triangles meet without cracks at any zoom.
  const BARY = `
vec2 edgePt(vec2 P, vec2 Q, float t) {
  bool sw = Q.x < P.x || (Q.x == P.x && Q.y < P.y);
  vec2 a = sw ? Q : P, b = sw ? P : Q;
  float u = sw ? 1.0 - t : t;
  return u <= 0.0 ? a : (u >= 1.0 ? b : a + (b - a) * u);
}
vec2 bary(vec2 t) {
  if (t.y == 0.0) return edgePt(aAB.xy, aAB.zw, t.x);
  if (t.x == 0.0) return edgePt(aAB.xy, aC, t.y);
  if (t.x + t.y == 1.0) return edgePt(aAB.zw, aC, t.y);
  return aAB.xy + (aAB.zw - aAB.xy) * t.x + (aC - aAB.xy) * t.y;
}
`;
  // The midpoint test of a mapped sub-triangle, measured in a frame scaled to its largest coordinate (squared
  // lengths of values above ~1e19 overflow float32, which passed every triangle), with a few float32 ulps of slack
  // so tiny far-out triangles are not lost to rounding.
  const VALID = `
float amax(vec2 v) { return max(abs(v.x), abs(v.y)); }
bool midOk(vec2 w0, vec2 w1, vec2 w2, vec2 wm) {
  float m = max(max(amax(w0), amax(w1)), max(amax(w2), amax(wm)));
  float k = m > 1e18 ? 1.0 / m : 1.0;
  vec2 a = w0 * k, b = w1 * k, c = w2 * k, d = wm * k;
  float e = max(max(length(b - a), length(c - b)), length(a - c));
  return length(d - (a + b + c) / 3.0) <= 0.2 * e + 1e-6 * m * k + 1e-30;
}
float len2(vec2 v) { float m = amax(v); return m > 1e18 ? m * length(v / m) : length(v); }
`;

  // ---------- 2D regions: instanced base triangles, each split into L^2 by a template ----------
  // fetch: 'tex' | 'chain' | 'local' (see FETCH); 'local' places the mesh by uRel = O - view centre
  const REGION_VS = (sphere, fetch) => `
layout(location = 0) in vec4 aTpl0;
layout(location = 1) in vec4 aTpl1;
layout(location = 6) in vec4 aIdx;
layout(location = 2) in vec4 aAB;
layout(location = 3) in vec2 aC;
layout(location = 4) in float aSkip;
out vec2 vSrc;
flat out float vJac;
${sphere ? 'out vec3 vNor; out vec3 vPos;' : ''}
uniform vec2 uCenter; uniform vec2 uCenterLo; uniform vec2 uScale; uniform vec2 uRel; uniform vec2 uSrcOff;
uniform mat4 uMVP;
${SRC}
${FETCH(fetch)}
${LIFT}
${BARY}
${VALID}
void main() {
  vec2 s0 = bary(aTpl0.xy), s1 = bary(aTpl0.zw), s2 = bary(aTpl1.xy);
  vec2 w0 = W(aIdx.x, s0), w1 = W(aIdx.y, s1), w2 = W(aIdx.z, s2);
  vec2 wm = W(aIdx.w, (s0 + s1 + s2) / 3.0);
  int c = int(aTpl1.z + 0.5);
  // pattern coordinates: the source point relative to a pattern-aligned origin near O (uSrcOff = O - Q)
  vSrc = (c == 0 ? s0 : (c == 1 ? s1 : s2)) + uSrcOff;
  float sa = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  float wa = (w1.x - w0.x) * (w2.y - w0.y) - (w2.x - w0.x) * (w1.y - w0.y);
  vJac = 0.5 * log2(max(abs(wa), 1e-35) / max(abs(sa), 1e-35));
  bool good = aSkip < 0.5 && cfin(w0) && cfin(w1) && cfin(w2) && cfin(wm);
${sphere ? `
  vec3 p0 = lift(w0), p1 = lift(w1), p2 = lift(w2), pm = lift(wm);
  float e = max(max(length(p1 - p0), length(p2 - p1)), length(p0 - p2));
  good = good && length(pm - (p0 + p1 + p2) / 3.0) <= 0.2 * e + 1e-7;
  vec3 p = c == 0 ? p0 : (c == 1 ? p1 : p2);
  if (!good) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vNor = p; vPos = p * 1.002;
  gl_Position = uMVP * vec4(p * 1.002, 1.0);` : `
  good = good && midOk(w0, w1, w2, wm);
  vec2 w = c == 0 ? w0 : (c == 1 ? w1 : w2);
  if (!good) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = vec4(${fetch === 'local' ? '(w + uRel) * uScale' : '((w - uCenter) - uCenterLo) * uScale'}, 0.0, 1.0);`}
}
`;
  // ---- region patterns (SPEC 6.1): one template, two footprint modes ----
  // PATTERN_SRC(mode) is the pattern part of a fragment main: from the source point vSrc (relative to the
  // pattern-aligned origin uQ) it sets col. 'fwidth': footprints by screen-space derivatives, exactly the text
  // REGION_FS always had (a string test holds REGION_FS(false / true) byte-identical to test/fixtures). 'analytic':
  // footprints from the per-pixel derivatives dX, dY (dz per pixel step) of the inverse walk, and log-polar
  // coordinates from Lambda = log z when the walk has it (exact for any |z|); it also needs vJac as a local.
  // The pattern formulas themselves (PAT_CHAIN) are the same text in both.
  const PAT_UNIFORMS = `uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uK;
uniform float uAlpha; uniform int uPattern; uniform float uCell; uniform float uLines; uniform float uDpr;
uniform vec3 uShrink; uniform vec3 uGrow; uniform vec3 uMid; uniform vec2 uOrigin; uniform vec2 uQ;
uniform float uSphN;
`;
  const PAT_FNS = `float sdBox(vec2 q, vec2 a, vec2 b) { vec2 c = 0.5 * (a + b), h = 0.5 * (b - a); vec2 d = abs(q - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float net(vec2 g, vec2 gw) { return max(iso(g.x, gw.x, 1.0), iso(g.y, gw.y, 1.0)) * (1.0 - moire(gw)); }
`;
  const PAT_PRE = {
    fwidth: `  // pattern coordinates are the source point, carried through the map (vSrc is relative to the pattern-aligned
  // origin uQ; sa is the absolute source point, for what is not periodic)
  vec2 sa = vSrc + uQ;
  vec2 g = vSrc / uCell;
  vec2 gw = fwidth(g);
  vec2 sp = vSrc - uOrigin;
  float rr = length(sp);
  vec2 gp = vec2(log(max(rr, 1e-30)), atan(sp.y, sp.x)) * (16.0 / TAU);
  vec2 gpw = vec2(fwidth(gp.x), argWidth(sp) * (16.0 / TAU));
  float gr = rr / uCell, fgr = fwidth(gr);
  float ra = atan(sp.y, sp.x) * (12.0 / PI), fra = argWidth(sp) * (12.0 / PI);
  float lr = log(max(length(sa), 1e-30)) * (6.0 / PI), flr = fwidth(lr);
  vec2 fs = fwidth(vSrc);
  float m = moire(gw);
  vec3 c0 = uC0, c1 = uC1, k = uK;
  vec3 col = c0;
`,
    // SPEC 6.2: fw(p) = |dp/dX| + |dp/dY| with dp/dX = <grad p, dX>; d(log v) = dz / v
    analytic: `  vec2 sa = vSrc + vQ;
  vec2 g = vSrc / uCell;
  vec2 fs = abs(dX) + abs(dY);
  vec2 gw = fs / uCell;
  // a footprint far below the resolution the AA filters assume (they clamp widths to 1e-7 / 1e-6 cells, and fract()
  // of a tiny negative coordinate rounds to 1): a sheet compressed onto a cell corner, as z = 0 at the far end of
  // log(H), showed the average colour (or isolines everywhere). The position relative to the nearest cell edge is
  // magnified with the footprint (same coverage fractions, same distances in pixels), clamped short of the next edge
  // (only where the footprint is above the float32 resolution of g: deeper, g itself is rounding noise and ixChecker
  // spreads the edge over that resolution instead)
  if (uPattern != 3 && max(gw.x, gw.y) < 1e-6 && max(gw.x, gw.y) > 4.8e-7 * max(abs(g.x), abs(g.y))) {
    vec2 ne = floor(g + 0.5);
    float sc = 1e-3 / max(max(gw.x, gw.y), 1e-37);
    g = ne + clamp((g - ne) * sc, -0.49, 0.49);
    gw *= sc;
  }
#if IX_ANC
  g += gK;   // an integer cell shift (0 but near a saturation anchor: vSrc is then relative to its nearest cell corner)
#endif
  // the polar and log-radius coordinates only for the patterns that read them (2, 5: polar; 6: log radius): the
  // shading runs inside the walk, once per admitted candidate, and these logs, arguments and divisions were most of
  // the checker's cost (same expressions, same values)
  bool lamP = hasLam && uOrigin == vec2(0.0) && uQ == vec2(0.0);
  vec2 gp = vec2(0.0), gpw = vec2(0.0), sl8 = vec2(0.0), slw8 = vec2(0.0);
  float gr = 0.0, fgr = 0.0, ra = 0.0, fra = 0.0, lr = 0.0, flr = 0.0;
  if (uPattern == 2 || uPattern == 5 || uPattern == 8) {
  vec2 sp = vSrc - (uOrigin - vQ);
  vec2 qX = lamP ? dLX : ixDivL(dX, sp), qY = lamP ? dLY : ixDivL(dY, sp);
  float rr = lamP ? exp(min(lam.x, 80.0)) : cx_abs(sp);
  float th = lamP ? lam.y : carg(sp);
  gp = vec2(lamP ? lam.x : log(max(rr, 1e-30)), th) * (16.0 / TAU);
  // the spherical checker's (ln rho, theta) and footprints (|Re(dz/v)|, |Im(dz/v)| summed over X and Y), exact for any
  // |z| with Lambda (SPEC 6.3)
  sl8 = gp * (TAU / 16.0); slw8 = vec2(abs(qX.x) + abs(qY.x), abs(qX.y) + abs(qY.y));
#if IX_ANC
  if (lamP && gpA.z > -0.5) gp = gpA.xy;   // near a saturation anchor: relative to its nearest polar cell corner (precise)
#endif
  gpw = vec2(abs(qX.x) + abs(qY.x), abs(qX.y) + abs(qY.y)) * (16.0 / TAU);
#if IX_ANC
  // the same magnification for the log-polar cells (a sheet near a polar cell corner at a saturation anchor)
  if (max(gpw.x, gpw.y) < 1e-6 && max(gpw.x, gpw.y) > 4.8e-7 * max(abs(gp.x), abs(gp.y))) {
    vec2 ne = floor(gp + 0.5);
    float sc = 1e-3 / max(max(gpw.x, gpw.y), 1e-37);
    gp = ne + clamp((gp - ne) * sc, -0.49, 0.49);
    gpw *= sc;
  }
  if (lamP && gpA.z > -0.5) gp += gpA.zw;   // and that corner's integer cell shift (mod 2: the checker's period)
#endif
  gr = rr / uCell; fgr = (abs(qX.x) + abs(qY.x)) * gr;
  ra = th * (12.0 / PI); fra = (abs(qX.y) + abs(qY.y)) * (12.0 / PI);
  }
  if (uPattern == 6) {
  vec2 sX = ixDivL(dX, sa), sY = ixDivL(dY, sa);
  lr = log(max(cx_abs(sa), 1e-30)) * (6.0 / PI); flr = (abs(sX.x) + abs(sY.x)) * (6.0 / PI);
  }
  float m = moire(gw);
  vec3 c0 = uC0, c1 = uC1, k = uK;
  vec3 col = c0;
`,
  };
  // pre-mapped triangles (SphereMesh, SPEC 8.7, P5): the pattern coordinates arrive interpolated from the CPU mesh:
  // vG = (z - Q_t) / cell (reduced per triangle by multiples of 10 cells), vP = (ln |z|, arg z) * 16 / tau (arg
  // unwrapped per triangle; the mesh keeps both within 0.5 px of the true ones) or, for graph paper (4), the source
  // point itself. Footprints by fwidth, as the 'fwidth' mode. The pattern formulas (PAT_CHAIN) are the shared text.
  PAT_PRE.pre = `  vec2 g = vG;
  vec2 gw = fwidth(g);
  vec2 gp = vP, gpw = fwidth(vP);
  float rr = exp(clamp(gp.x * (TAU / 16.0), -80.0, 80.0));
  float th = gp.y * (TAU / 16.0);
  vec2 sa = uPattern == 4 ? vP : rr * vec2(cos(th), sin(th));
  vec2 fs = uPattern == 4 ? fwidth(vP) : gw * uCell;
  float gr = rr / uCell, fgr = fwidth(gr);
  float ra = th * (12.0 / PI), fra = gpw.y * 1.5;
  float lr = gp.x * (TAU / 16.0) * (6.0 / PI), flr = gpw.x * (TAU / 16.0) * (6.0 / PI);
  float m = moire(gw);
  vec3 c0 = uC0, c1 = uC1, k = uK;
  vec3 col = c0;
`;
  const PAT_CHAIN = `  if (uPattern == 1) {              // Checker
    col = mix(mix(c0, c1, checker(g, gw)), 0.5 * (c0 + c1), m);
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(g, gw));
  } else if (uPattern == 2) {       // Conformal checker: 16 sectors, radial ratio e^(pi/8)
    col = mix(mix(c0, c1, checker(gp, gpw)), 0.5 * (c0 + c1), moire(gpw));
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(gp, gpw));
    float rc = gr * 12.0;
    col = mix(c0, col, clamp(0.5 + (rc - 1.0) / max(fgr * 12.0, 1e-9), 0.0, 1.0));
  } else if (uPattern == 3) {       // Orientation tiles with an F per cell
    vec3 ca = c1, cb = mix(c1, c0, 0.35);
    col = mix(ca, cb, checker(g, gw));
    vec2 q = g - floor(g);
    float d = min(sdBox(q, vec2(0.30, 0.18), vec2(0.42, 0.82)), min(sdBox(q, vec2(0.30, 0.70), vec2(0.72, 0.82)), sdBox(q, vec2(0.30, 0.46), vec2(0.62, 0.56))));
    float pw = max(0.5 * (gw.x + gw.y), 1e-12);
    float cov = clamp(0.5 - d / pw, 0.0, 1.0) * smoothstep(10.0, 16.0, 1.0 / (pw * uDpr));
    col = mix(mix(col, k, cov), 0.5 * (ca + cb), m);
  } else if (uPattern == 4) {       // Graph paper: two families, source axes
    float re1 = iso(g.x, gw.x, 1.25 * uDpr) * dfade(gw.x), re5 = iso(g.x / 5.0, gw.x / 5.0, 1.75 * uDpr) * dfade(gw.x / 5.0);
    float im1 = iso(g.y, gw.y, 1.0 * uDpr) * dfade(gw.y), im5 = iso(g.y / 5.0, gw.y / 5.0, 1.5 * uDpr) * dfade(gw.y / 5.0);
    float ax = max(iso0(sa.x, fs.x, 2.0 * uDpr), iso0(sa.y, fs.y, 2.0 * uDpr));
    col = mix(c1, mix(c0, k, 0.5), 0.3 * m);
    col = mix(col, c0, max(im1, im5));
    col = mix(col, k, max(re1, re5));
    col = mix(col, k, ax);
  } else if (uPattern == 5) {       // Polar web
    col = mix(c1, mix(c0, k, 0.5), 0.2 * moire(vec2(fgr)));
    col = mix(col, c0, iso(gr, fgr, uDpr) * dfade(fgr));
    col = mix(col, k, 0.7 * iso(ra, fra, uDpr) * dfade(fra));
    col = mix(col, k, iso(ra / 6.0, fra / 6.0, 1.75 * uDpr) * dfade(fra / 6.0));
  } else if (uPattern == 6) {       // Source phase (ignores the shape color)
    float sw = mix(sawAA(lr, flr), 0.5, moire(vec2(flr)));
    col = wheel(atan(sa.y, sa.x), 0.62 + 0.14 * sw);
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(g, gw));
  } else if (uPattern == 7) {       // Area scale: blue shrinks, amber grows
    float t = clamp(vJac / 3.0, -1.0, 1.0);
    col = t < 0.0 ? mix(uMid, uShrink, pow(-t, 0.8)) : mix(uMid, uGrow, pow(t, 0.8));
    col = mix(col, k, 0.18 * max(iso(g.x, gw.x, uDpr), iso(g.y, gw.y, uDpr)) * (1.0 - m));
  } else if (uPattern == 8) {       // Sphere checker: n longitude sectors x n / 2 latitude bands of the Riemann sphere
    vec2 sl = gp * (TAU / 16.0), slw = gpw * (TAU / 16.0);   // (ln rho, theta) about the origin and their footprints
    float ex = exp(-abs(sl.x));
    float lat = sl.x > 0.0 ? PI - 2.0 * atan(ex) : 2.0 * atan(ex);   // 2 atan(rho): 0 at the origin, pi at infinity
    vec2 gs = vec2(sl.y * uSphN / TAU, lat * 0.5 * uSphN / PI);
    vec2 gsw = vec2(slw.y * uSphN / TAU, slw.x * (2.0 * ex / (1.0 + ex * ex)) * 0.5 * uSphN / PI);
    col = mix(mix(c0, c1, checker(gs, gsw)), 0.5 * (c0 + c1), moire(gsw));
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(gs, gsw));
  } else {                          // Solid
    if (uLines > 0.5) col = mix(col, k, 0.35 * net(g, gw));
  }
`;
  const PAT8_SL = '    vec2 sl = gp * (TAU / 16.0), slw = gpw * (TAU / 16.0);   // (ln rho, theta) about the origin and their footprints\n';
  // The analytic mode differs from the shared formulas in two places (the 'fwidth' text, and so REGION_FS, is
  // untouched): (1) the polar checker's near-origin fade to c0 is skipped where Lambda = log z is exact (lamP): there
  // the log-polar cells are resolved for any |z| and the moire fade averages what is below a pixel, so the sheets of
  // z^i near 0 keep their cells (with the fade, the second sheet in D order swapped between a faded near-0 sheet and a
  // far one: seams along rays and light cells pulled toward c0 at every alpha < 1, P2 review); (2) the checker filter is
  // ixChecker: clamped to [0, 1] with its width floored at the float32 resolution of the cell coordinates (deep zooms:
  // differences of fract() at rounding level overshot past c0 / c1, then collapsed to the average, P2 review).
  const PAT_POLAR_FADE = '    col = mix(c0, col, clamp(0.5 + (rc - 1.0) / max(fgr * 12.0, 1e-9), 0.0, 1.0));\n';
  // (3) the spherical checker reads (ln rho, theta) from the walk's own block (sl8, slw8), not from the anchored gp
  const PATTERN_SRC = (mode) => PAT_PRE[mode] + (mode === 'analytic'
    ? PAT_CHAIN.replace(PAT_POLAR_FADE, '    if (!lamP)' + PAT_POLAR_FADE.slice(3)).replace(PAT8_SL, '    vec2 sl = sl8, slw = slw8;\n').replace(/\bchecker\(/g, 'ixChecker(')
    : PAT_CHAIN);
  const REGION_FS = (sphere) => `
in vec2 vSrc;
flat in float vJac;
${sphere ? 'in vec3 vNor; in vec3 vPos; uniform vec3 uEye; uniform mat4 uMVP;' : ''}
${PAT_UNIFORMS}out vec4 o;
${PAT_FNS}void main() {
${PATTERN_SRC('fwidth')}  float a = uAlpha * fadeOf(sa);
${sphere ? `
  vec3 n = normalize(vNor);
  vec3 v = normalize(uEye - vPos);
  col = toSrgb(shade(toLin(col), n, v, 1.0));
  // depth of the shell |p| = 1.002 where this pixel's ray meets it (the hit nearer the triangle): the flat chord of a
  // strongly stretched triangle sags below the tessellated globe, whose vertices then showed through as holes
  vec3 dv = vPos - uEye;
  float dl = length(dv);
  vec3 dr = dv / max(dl, 1e-20);
  float pb = dot(uEye, dr), pd = pb * pb - (dot(uEye, uEye) - 1.004004);
  float fd = gl_FragCoord.z;
  if (pd >= 0.0) {
    float sq = sqrt(pd), t1 = -pb - sq, t2 = -pb + sq;
    vec4 cp = uMVP * vec4(uEye + (abs(t1 - dl) <= abs(t2 - dl) ? t1 : t2) * dr, 1.0);
    if (cp.w > 0.0) fd = clamp(0.5 + 0.5 * cp.z / cp.w, 0.0, 1.0);
  }
  gl_FragDepth = fd;` : ''}
  o = vec4(col * a, a);
}
`;
  // ---- pre-mapped triangles (SPEC 8.7, P5): SphereMesh's leaves, mapped on the CPU, drawn far to near ----
  // aPos = w - w0 (flat; uRel = view centre - w0, a float64 difference) or the conjugate lift of w (globe); aAttr the
  // pattern coordinates (PAT_PRE.pre); aTri the triangle's area scale (vJac, the Area scale pattern)
  const PRE_VS = (sphere) => `
layout(location = 0) in ${sphere ? 'vec3' : 'vec2'} aPos;
layout(location = 1) in vec4 aAttr;
layout(location = 2) in float aTri;
out vec2 vG; out vec2 vP;
flat out float vJac;
${sphere ? 'out vec3 vNor; out vec3 vPos;\nuniform mat4 uMVP;' : 'uniform vec2 uRel; uniform vec2 uScale;'}
void main() {
  vG = aAttr.xy; vP = aAttr.zw; vJac = aTri;
${sphere ? '  vNor = aPos; vPos = aPos * 1.002;\n  gl_Position = uMVP * vec4(aPos * 1.002, 1.0);' : '  gl_Position = vec4((aPos - uRel) * uScale, 0.0, 1.0);'}
}
`;
  // the sheet key of the inverse path (SPEC 5.1, 5.2) per fragment, as its depth (flat pre-mapped meshes, uKeyOn 1):
  // the front sheet of every sample is the one the inverse path shows, not the leaf order's (a leaf's D is one value
  // for the whole leaf, and leaves of equal D were ordered by their vertices' Im z: triangle-jagged shard seams where
  // sheets meet). Depth: D = 0 (inside W, outside every rs-disc: the tie class) in [0.05, 0.45], larger Im z nearer,
  // then larger Re z; D > 0 in [0.5, 0.95], monotone in D. sa (PAT_PRE.pre) is the fragment's source point.
  const PRE_KEY_UNI = 'uniform int uKeyOn; uniform vec4 uKWin; uniform float uKR; uniform float uKRs; uniform vec2 uKSing[4]; uniform int uKSingN;\n';
  const PRE_KEY = `  if (uKeyOn > 0) {
    vec2 q = max(max(uKWin.xy - sa, sa - uKWin.zw), 0.0);
    float D = log2(1.0 + length(q) / uKR);
    for (int i = 0; i < 4; i++) { if (i >= uKSingN) break; D += max(0.0, log2(uKRs / max(length(sa - uKSing[i]), 1e-30))); }
    D = min(D, 1e6);
    vec2 tk = clamp((sa - uKWin.xy) / max(uKWin.zw - uKWin.xy, vec2(1e-30)), 0.0, 1.0);
    gl_FragDepth = D > 0.0 ? 0.5 + 0.45 * D / (D + 4.0) : 0.45 - 0.4 * (tk.y + 1e-3 * tk.x) / 1.001;
  } else gl_FragDepth = gl_FragCoord.z;
`;
  // REGION_FS with the source point replaced by the interpolated pattern coordinates (and no stretched-mesh feather)
  const REGION_PRE_FS = (sphere) => {
    let t = REGION_FS(sphere);
    const key = sphere ? [] : [['out vec4 o;\n', 'out vec4 o;\n' + PRE_KEY_UNI], ['  o = vec4(col * a, a);\n}', PRE_KEY + '  o = vec4(col * a, a);\n}']];
    for (const [a, b] of [['in vec2 vSrc;\n', 'in vec2 vG; in vec2 vP;\n'], [PATTERN_SRC('fwidth'), PAT_PRE.pre + PAT_CHAIN], ['float a = uAlpha * fadeOf(sa);', 'float a = uAlpha;'], ...key]) {
      if (!t.includes(a)) throw new Error('REGION_PRE_FS: ' + a.slice(0, 40));
      t = t.split(a).join(b);
    }
    return t;
  };
  // the map cache: one mapped value per unique template point. rt (EXT_color_buffer_float): each value is drawn as a
  // one-pixel point straight into its texel of the RG32F cache texture (point i = instance * uP + vertex lands on
  // texel (i % W, i / W), the same layout as the transform-feedback copy). A plain draw, so the program is ready when
  // its background compile is: ANGLE builds the transform-feedback variant of a vertex shader only at its first
  // transform-feedback draw, which held the GPU process (every frame on the page) for 60-110 ms per chain program
  // right after each step was added (spec 8.7). Without the extension: transform feedback, copied via a buffer.
  const TF_EMIT = (rt) => (rt ? `
flat out vec2 tfOut;
uniform int uP; uniform int uRtW; uniform vec2 uRtSz;
void emit(vec2 w) {
  tfOut = w;
  int i = gl_InstanceID * uP + gl_VertexID;
  gl_Position = vec4((vec2(float(i % uRtW), float(i / uRtW)) + 0.5) / uRtSz * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
` : `
out vec2 tfOut;
void emit(vec2 w) { tfOut = w; gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0; }
`);
  const TF_REGION_VS = (rt) => `
layout(location = 0) in vec2 aT;
layout(location = 2) in vec4 aAB;
layout(location = 3) in vec2 aC;
${TF_EMIT(rt)}
${SRC}
${BARY}
void main() { emit(mapPoint(srcOf(bary(aT)))); }
`;
  const TF_LINE_VS = (rt) => `
layout(location = 0) in vec2 aT;
layout(location = 2) in vec4 aP;
${TF_EMIT(rt)}
${SRC}
void main() { emit(mapPoint(srcOf(mix(aP.xy, aP.zw, aT.x)))); }
`;
  // TEMP-DEBUG-HOOK (removed before publishing)
  // (v16 tests, GLR.evalMap: points through mapPoint, read back by transform feedback; test.html only: review v16 regress-7)
  const EVAL_VS = `
layout(location = 0) in vec2 aP;
out vec2 tfOut;
void main() { tfOut = mapPoint(aP); gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0; }
`;
  // TEMP-DEBUG-HOOK
  const TF_FS = `
out vec4 o;
void main() { o = vec4(0.0); }
`;
  const RT_FS = `
flat in vec2 tfOut;
out vec4 o;
void main() { o = vec4(tfOut, 0.0, 1.0); }
`;

  // ---------- anti-aliased thick lines: instanced source segments, subdivided ----------
  // variant: '' (2D view), 'S' (on the sphere), 'F' (curves printed on the landscape floor, in the floor's plane)
  // fetch: as FETCH ('local' only for '' and 'abs' only for 'F': identity maps without the chain)
  // Pieces meet in mitred joins, so a translucent stroke or casing covers each pixel once: no darker beads where
  // round caps would overlap. Each end needs its neighbour's far point: a texel fetch on the cached path, one more
  // evaluation on the uncached one (homotopies). True ends and sharp turns get round caps.
  // Dashes: aArc = (arc length at the segment start, segment length) along the mapped curve in plane units,
  // computed on the CPU per map; uArcPx converts to device px.
  const LINE_VS = (variant, fetch) => `
layout(location = 0) in vec4 aTpl;   // t0, t1, end (0/1), side (-1/1)
layout(location = 6) in vec4 aIdx;   // template point indices of t0, t1, midpoint
layout(location = 2) in vec4 aP;     // P0.xy, P1.xy (relative to the origin)
layout(location = 10) in vec2 aJ;    // instance offsets of the previous / next segment (0 = none)
layout(location = 11) in vec4 aN;    // the previous segment's start, the next segment's end
layout(location = 12) in vec2 aArc;  // arc length at the segment start, segment length (dashes)
uniform vec2 uCenter; uniform vec2 uCenterLo; uniform vec2 uScale; uniform vec2 uRel; uniform vec2 uPx; uniform float uWidth; uniform float uDpr;
uniform mat4 uMVP; uniform vec4 uBox; uniform vec2 uAspect; uniform float uFloorZ; uniform vec4 uClip; uniform float uArcPx;
out vec2 vLocal;
out vec2 vSrc;
flat out float vLen;
flat out float vHalf;
flat out vec2 vCap;
flat out float vArcA;
${SRC}
${FETCH(fetch)}
${fetch === 'tex' ? 'vec2 Wn(int inst, int k) { int i = inst * uP + k; return texelFetch(uW, ivec2(i % uTexW, i / uTexW), 0).xy; }' : ''}
${LIFT}
${VALID}
vec4 clipOf(vec2 w) {
${variant === 'S' ? '  return uMVP * vec4(lift(w) * 1.004, 1.0);'
    : variant === 'F' ? '  vec2 uv = (w - uBox.xy) / uBox.zw; return uMVP * vec4((uv - 0.5) * 2.0 * uAspect, uFloorZ + 0.002, 1.0);'
      : fetch === 'local' ? '  return vec4((w + uRel) * uScale, 0.0, 1.0);'
        : '  return vec4(((w - uCenter) - uCenterLo) * uScale, 0.0, 1.0);'}
}
${variant === 'F' ? '' : `// a segment that is a dot: its start, middle and end within a quarter pixel of its start (which 0: this instance's
// segment, 1: the previous one). Only a dot's first piece is drawn (its other pieces are culled, and the neighbours cap
// against it); every piece of any other segment is drawn, sub-pixel or not, and they meet in mitred joins
bool segDot(int which) {
  int Ms = int(aIdx.z - aIdx.x + 0.5) - 1, h = Ms / 2;
${fetch === 'tex' ? `  int inst = gl_InstanceID + (which == 1 ? int(aJ.x) : 0);
  vec2 wS = Wn(inst, 0), wH = Wn(inst, h), wE = Wn(inst, Ms);` : `  vec2 a = which == 1 ? aN.xy : aP.xy, b = which == 1 ? aP.xy : aP.zw;
  vec2 wS = mapL(a), wH = mapL(mix(a, b, float(h) / float(Ms))), wE = mapL(b);`}
  vec4 cS = clipOf(wS), cH = clipOf(wH), cE = clipOf(wE);
  if (!(cfin(wS) && cfin(wH) && cfin(wE) && cS.w > 1e-6 && cH.w > 1e-6 && cE.w > 1e-6)) return false;
  vec2 qS = cS.xy / cS.w * 0.5 * uPx, qH = cH.xy / cH.w * 0.5 * uPx, qE = cE.xy / cE.w * 0.5 * uPx;
  float cq = 0.25 * uDpr;
  return len2(qE - qS) < cq && len2(qH - qS) < cq;
}`}
void main() {
  vec2 s0 = mix(aP.xy, aP.zw, aTpl.x), s1 = mix(aP.xy, aP.zw, aTpl.y);
  vec2 w0 = W(aIdx.x, s0), w1 = W(aIdx.y, s1), wm = W(aIdx.z, 0.5 * (s0 + s1));
${variant === 'F' ? `
  // floor print: clip the mapped piece to the floor plate uClip = (x0, y0, x1, y1) in the floor's plane (Liang-Barsky)
  {
    vec2 dd = w1 - w0;
    float ta = 0.0, tb = cfin(w0) && cfin(w1) ? 1.0 : -1.0;
    if (abs(dd.x) < 1e-30) { if (w0.x < uClip.x || w0.x > uClip.z) tb = -1.0; }
    else { float t0 = (uClip.x - w0.x) / dd.x, t1 = (uClip.z - w0.x) / dd.x; ta = max(ta, min(t0, t1)); tb = min(tb, max(t0, t1)); }
    if (abs(dd.y) < 1e-30) { if (w0.y < uClip.y || w0.y > uClip.w) tb = -1.0; }
    else { float t0 = (uClip.y - w0.y) / dd.y, t1 = (uClip.w - w0.y) / dd.y; ta = max(ta, min(t0, t1)); tb = min(tb, max(t0, t1)); }
    if (!(tb > ta)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    vec2 a = w0 + dd * ta, b = w0 + dd * tb;
    w0 = a; w1 = b; wm = 0.5 * (a + b);
  }` : ''}
  vec4 c0 = clipOf(w0), c1 = clipOf(w1), cm = clipOf(wm);
  bool good = cfin(w0) && cfin(w1) && cfin(wm) && c0.w > 1e-6 && c1.w > 1e-6 && cm.w > 1e-6;
  vec2 q0 = c0.xy / c0.w * 0.5 * uPx, q1 = c1.xy / c1.w * 0.5 * uPx, qm = cm.xy / cm.w * 0.5 * uPx;
  float len = len2(q1 - q0);
${variant === 'S' ? `
  vec3 a3 = lift(w0), b3 = lift(w1), m3 = lift(wm);
  good = good && length(m3 - 0.5 * (a3 + b3)) <= 0.3 * length(b3 - a3) + 1e-5;` : variant === 'F' ? '' : `
  good = good && len2(qm - 0.5 * q0 - 0.5 * q1) <= 0.3 * len + 0.75 * uDpr;`}
  // sub-pixel pieces of a segment that is a dot (wholly within a quarter pixel) add nothing but overdraw: culled, the
  // dot drawn by the segment's first piece (where a map compresses a curve into a point, thousands of them would stack
  // on a few pixels). Sub-pixel pieces of any other segment are drawn and meet in mitred joins: a compressed run is
  // continuous and covers each pixel once. Culling every sub-pixel piece after a segment's first left only each
  // segment's first piece where a whole segment spans a few pixels in sub-pixel pieces: a string of separate dots
  // (P3 review); thinning the run to one capped piece per quarter-pixel cell closed it, but its capsules overlapped
  // (each pixel under several: the stroke's anti-aliased edge saturated, a 1.5 px stroke drew 2 px solid)
${variant === 'F' ? `  if (len < 0.25 * uDpr && aTpl.x > 0.0) {
    good = false;
  }` : `  int dotOwn = -1;   // this segment is a dot: -1 not evaluated yet, 0 no, 1 yes
  if (len < 0.25 * uDpr && aTpl.x > 0.0) {
    dotOwn = segDot(0) ? 1 : 0;
    if (dotOwn == 1) good = false;
  }`}
${fetch === 'tex' && variant === '' ? `  // pile-ups (13.14): where a map compresses a curve into a point (exp toward 0, a Mobius map toward the image of
  // its pole), thousands of whole segments lie within a pixel, and each drew its first piece there: thousands of
  // blended layers on a few pixels, 5 ms of a 9 ms frame at dpr 1 (the default example). A segment wholly within a
  // quarter pixel whose start shares its quarter-pixel cell with the previous segment's start adds nothing that dot
  // does not draw: culled. A run of them keeps one dot per cell it passes (a third of a pixel apart at most, each over
  // two pixels across), and its long neighbours cap against it (the joins below)
  if (good && aTpl.x == 0.0 && aJ.x != 0.0 && len < 0.25 * uDpr) {
    int Ms = int(aIdx.z - aIdx.x + 0.5) - 1;
    vec2 wE = Wn(gl_InstanceID, Ms), wH = Wn(gl_InstanceID, Ms / 2), wP = Wn(gl_InstanceID + int(aJ.x), 0);
    vec4 cE = clipOf(wE), cH = clipOf(wH), cP = clipOf(wP);
    if (cfin(wE) && cfin(wH) && cfin(wP) && cE.w > 1e-6 && cH.w > 1e-6 && cP.w > 1e-6) {
      vec2 qE = cE.xy / cE.w * 0.5 * uPx, qH = cH.xy / cH.w * 0.5 * uPx, qP = cP.xy / cP.w * 0.5 * uPx;
      float cq = 0.25 * uDpr;
      if (len2(qE - q0) < cq && len2(qH - q0) < cq && floor(q0 / cq) == floor(qP / cq)) good = false;
    }
  }
` : ''}  if (!good) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 d = len > 1e-6 ? (q1 - q0) / len : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  float hw = 0.5 * uWidth + 1.0;
  bool atEnd = aTpl.z > 0.5;
  float side = aTpl.w;
  // joins: a neighbour piece shares the end point; both cut along the bisector of their normals
  bool capA = true, capB = true;
  vec2 nA = n, nB = n;
${variant !== 'F' ? `
  {
    int k0 = int(aIdx.x + 0.5), Mi = int(aIdx.z - aIdx.x + 0.5) - 1;${fetch === 'tex' ? `
    int inst = gl_InstanceID;
    bool hA = k0 > 0 || aJ.x != 0.0, hB = k0 + 1 < Mi || aJ.y != 0.0;
    vec2 wA = k0 > 0 ? Wn(inst, k0 - 1) : Wn(inst + int(aJ.x), Mi - 1);
    vec2 wB = k0 + 1 < Mi ? Wn(inst, k0 + 2) : Wn(inst + int(aJ.y), 1);` : `
    // uncached (homotopies): two more evaluations per vertex
    bool hA = k0 > 0 || aJ.x != 0.0, hB = k0 + 1 < Mi || aJ.y != 0.0;
    vec2 sA = k0 > 0 ? mix(aP.xy, aP.zw, float(k0 - 1) / float(Mi)) : mix(aN.xy, aP.xy, float(Mi - 1) / float(Mi));
    vec2 sB = k0 + 1 < Mi ? mix(aP.xy, aP.zw, float(k0 + 2) / float(Mi)) : mix(aP.zw, aN.zw, 1.0 / float(Mi));
    vec2 wA = hA ? mapL(sA) : vec2(0.0);
    vec2 wB = hB ? mapL(sB) : vec2(0.0);`}
    vec4 cA = clipOf(wA), cB = clipOf(wB);
    // a neighbour that the cull above removes (sub-pixel, not first in its segment, its segment a dot) gets a cap
    // instead of a mitre
    bool firstA = k0 > 0 ? k0 == 1 : Mi == 1, firstB = k0 + 1 >= Mi;
    if (hA && cfin(wA) && cA.w > 1e-6 && len >= 0.02 * uDpr) {
      vec2 qa = cA.xy / cA.w * 0.5 * uPx, e = q0 - qa;
      float la = len2(e);
      if (la >= 0.02 * uDpr && (firstA || la >= 0.25 * uDpr || (k0 > 0 ? (dotOwn == -1 ? !segDot(0) : dotOwn == 0) : !segDot(1)))) { nA = vec2(-e.y, e.x) / la; capA = dot(nA, n) < 0.35; }
    }
    if (hB && cfin(wB) && cB.w > 1e-6 && len >= 0.02 * uDpr) {
      vec2 qb = cB.xy / cB.w * 0.5 * uPx, e = qb - q1;
      float lb = len2(e);
      if (lb >= 0.02 * uDpr && (firstB || lb >= 0.25 * uDpr || (dotOwn == -1 ? !segDot(0) : dotOwn == 0))) { nB = vec2(-e.y, e.x) / lb; capB = dot(nB, n) < 0.35; }
    }
  }` : ''}
  vec2 q;
  if (!atEnd) {
    if (capA) q = q0 - d * hw + n * side * hw;
    else { vec2 nm = normalize(nA + n); q = q0 + nm * (side * hw / dot(nm, n)); }
  } else {
    if (capB) q = q1 + d * hw + n * side * hw;
    else { vec2 nm = normalize(nB + n); q = q1 + nm * (side * hw / dot(nm, n)); }
  }
  vLocal = vec2(dot(q - q0, d), side * hw);
  vCap = vec2(capA ? 1.0 : 0.0, capB ? 1.0 : 0.0);
  vSrc = ${variant === 'F' ? 'atEnd ? w1 : w0' : 'srcOf(atEnd ? s1 : s0)'};
  vLen = len; vHalf = 0.5 * uWidth;
  vArcA = (aArc.x + aArc.y * aTpl.x) * uArcPx;
  float zc = atEnd ? c1.z / c1.w : c0.z / c0.w;
  gl_Position = vec4(q / (0.5 * uPx), ${variant === 'S' ? 'zc - 0.0004' : variant === 'F' ? 'zc' : '0.0'}, 1.0);
}
`;
  const LINE_FS = `
in vec2 vLocal;
in vec2 vSrc;
flat in float vLen;
flat in float vHalf;
flat in vec2 vCap;
flat in float vArcA;
uniform vec3 uColor; uniform float uAlpha;
uniform vec2 uDash;   // on, off (device px); on = 0: solid
out vec4 o;
void main() {
  // distance to the piece: a capsule at capped ends, the infinite centre line across mitred joins
  float x = clamp(vLocal.x, vCap.x > 0.5 ? 0.0 : -1e30, vCap.y > 0.5 ? vLen : 1e30);
  float dist = length(vec2(vLocal.x - x, vLocal.y));
  float a = clamp(vHalf - dist + 0.5, 0.0, 1.0) * uAlpha * fadeOf(vSrc);
  if (uDash.x > 0.0) {
    // on-interval [0, on) of each period along the arc, anti-aliased over 1 px at both ends
    float u = mod(vArcA + vLocal.x, uDash.x + uDash.y);
    a *= clamp(max(min(u, uDash.x - u), u - uDash.x - uDash.y) + 0.5, 0.0, 1.0);
  }
  if (a <= 0.003) discard;
  o = vec4(uColor * a, a);
}
`;

  // ---------- 3D marks: screen-space lines, discs and rings ----------
  const MARK_EMIT = `
uniform mat4 uMVP; uniform vec2 uPx; uniform float uZBias; uniform float uZFix;
out vec2 vL;
flat out vec4 vS;
void emitLine(vec4 c0, vec4 c1, int k, float hw) {
  if (c0.w <= 1e-6 || c1.w <= 1e-6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 q0 = c0.xy / c0.w * 0.5 * uPx, q1 = c1.xy / c1.w * 0.5 * uPx;
  float len = length(q1 - q0);
  vec2 d = len > 1e-6 ? (q1 - q0) / len : vec2(1.0, 0.0);
  vec2 n = vec2(-d.y, d.x);
  float h = hw + 1.0;
  bool atEnd = k == 1 || k == 2 || k == 4;
  float side = (k == 2 || k == 4 || k == 5) ? 1.0 : -1.0;
  vec2 q = (atEnd ? q1 + d * h : q0 - d * h) + n * side * h;
  vL = vec2(atEnd ? len + h : -h, side * h);
  vS = vec4(0.0, len, hw, 0.0);
  float zc = atEnd ? c1.z / c1.w : c0.z / c0.w;
  // uZFix > -1: one constant depth, so with depth writes on a polyline's overlapping caps blend only once
  gl_Position = vec4(q / (0.5 * uPx), uZFix > -1.0 ? uZFix : zc - uZBias, 1.0);
}
void emitSprite(vec4 c, int k, float kind, float R, float hw) {
  if (c.w <= 1e-6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 corner = vec2((k == 1 || k == 2 || k == 4) ? 1.0 : -1.0, (k == 2 || k == 4 || k == 5) ? 1.0 : -1.0);
  float E = R + hw + 1.0;
  vec2 q = c.xy / c.w * 0.5 * uPx + corner * E;
  vL = corner * E;
  vS = vec4(kind, R, hw, 0.0);
  gl_Position = vec4(q / (0.5 * uPx), c.z / c.w - uZBias, 1.0);
}
`;
  const MARK_VS = `
layout(location = 7) in vec3 aA;
layout(location = 8) in vec3 aB;
layout(location = 9) in vec4 aSpr;   // kind (0 line, 1 disc, 2 ring), radius px, half width px
${MARK_EMIT}
void main() {
  if (aSpr.x < 0.5) emitLine(uMVP * vec4(aA, 1.0), uMVP * vec4(aB, 1.0), gl_VertexID, aSpr.z);
  else emitSprite(uMVP * vec4(aA, 1.0), gl_VertexID, aSpr.x, aSpr.y, aSpr.z);
}
`;
  const MARK_FS = `
in vec2 vL;
flat in vec4 vS;
uniform vec3 uColor; uniform float uAlpha;
out vec4 o;
void main() {
  float a;
  if (vS.x < 0.5) { float x = clamp(vL.x, 0.0, vS.y); a = clamp(vS.z - length(vec2(vL.x - x, vL.y)) + 0.5, 0.0, 1.0); }
  else if (vS.x < 1.5) a = clamp(vS.y - length(vL) + 0.5, 0.0, 1.0);
  else a = clamp(vS.z - abs(length(vL) - vS.y) + 0.5, 0.0, 1.0);
  a *= uAlpha;
  if (a <= 0.003) discard;
  o = vec4(uColor * a, a);
}
`;

  // ---------- full-screen passes ----------
  const QUAD_VS = `
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;
  // graph paper, axes and unit circle (spec 6.1); geometry precomputed in JS in device px near the view centre
  const GRID_FS = `
uniform vec4 uVp; uniform float uDpr;
uniform vec4 uBg;            // rgb, 1 = opaque plane
uniform vec4 uTier[6];       // X0, Y0 (device px of a line near the centre), spacing (device px), alpha
uniform vec3 uTierCol[6];
uniform vec4 uAxis;          // X of x = 0, Y of y = 0 (device px, snapped), width, alpha
uniform vec3 uAxisCol;
uniform vec4 uCasing;        // rgb, alpha: casing under the axes (portrait overlay)
uniform vec4 uTickX;         // X0, spacing, half length, width (device px)
uniform vec4 uTickY;
uniform vec4 uUnit;          // origin (device px), radius (device px), alpha
uniform vec3 uUnitCol; uniform vec2 uDash;   // dash count, radius in CSS px
uniform vec4 uUnitL;         // local form (radius >> viewport): e (signed distance at the view centre), n, |C|
uniform vec4 uUnitA;         // dash phase and axis-tick arc offset at the view centre (CSS px), -, local (1)
out vec4 o;
float band(float x, float c, float w) { return clamp(min(x + 0.5, c + 0.5 * w) - max(x - 0.5, c - 0.5 * w), 0.0, 1.0); }
void main() {
  vec2 f = gl_FragCoord.xy - uVp.xy;
  vec4 col = uBg.w > 0.5 ? vec4(uBg.rgb, 1.0) : vec4(0.0);
  for (int i = 0; i < 6; i++) {               // finer tiers first, so coarse tiers win
    vec4 t = uTier[i];
    if (t.w <= 0.0) continue;
    vec2 k = floor((f - t.xy) / t.z + 0.5);
    vec2 c = floor(t.xy + k * t.z) + 0.5;     // each line snapped to a pixel centre: crisp 1 device px
    vec2 dpx = abs(f - c);
    float cov = 1.0 - smoothstep(0.0, 1.0, min(dpx.x, dpx.y));
    col = mix(col, vec4(uTierCol[i], 1.0), cov * t.w);
  }
  if (uAxis.w > 0.0) {
    if (uCasing.a > 0.0) {
      float cc = max(band(f.x, uAxis.x, uAxis.z + 2.0 * uDpr), band(f.y, uAxis.y, uAxis.z + 2.0 * uDpr));
      col = mix(col, vec4(uCasing.rgb, 1.0), cc * uCasing.a);
    }
    float ca = max(band(f.x, uAxis.x, uAxis.z), band(f.y, uAxis.y, uAxis.z));
    // ticks at the ruler-labelled steps, across the axes
    float kx = floor((f.x - uTickX.x) / uTickX.y + 0.5);
    float tx = band(f.x, floor(uTickX.x + kx * uTickX.y) + 0.5, uTickX.w) * band(f.y, uAxis.y, 2.0 * uTickX.z);
    float ky = floor((f.y - uTickY.x) / uTickY.y + 0.5);
    float ty = band(f.y, floor(uTickY.x + ky * uTickY.y) + 0.5, uTickY.w) * band(f.x, uAxis.x, 2.0 * uTickY.z);
    col = mix(col, vec4(uAxisCol, 1.0), max(ca, max(tx, ty)) * uAxis.w);
  }
  if (uUnit.w > 0.0) {
    float rd, arc, ad;                                         // signed distance (device px), arc (CSS px), arc to an axis crossing
    if (uUnitA.w > 0.5) {
      // far zoom: the circle near the view, from float64 geometry at the view centre (float32 absolute pixel
      // coordinates of a radius of 1e7 px would quantise the band away)
      vec2 q = f - 0.5 * uVp.zw;
      float qn = dot(q, uUnitL.yz);
      rd = uUnitL.x + qn + 0.5 * (dot(q, q) - qn * qn) / uUnitL.w;
      float dth = atan(dot(q, vec2(-uUnitL.z, uUnitL.y)), uUnitL.w + qn);
      arc = uUnitA.x + dth * uDash.y;
      ad = abs(uUnitA.y + dth * uDash.y);
    } else {
      vec2 d = f - uUnit.xy;
      rd = length(d) - uUnit.z;
      float th = atan(d.y, d.x);
      float q = PI * 0.5;
      arc = th * uDash.y;
      ad = abs(th - floor(th / q + 0.5) * q) * uDash.y;
    }
    float covR = band(rd, 0.0, uDpr);
    if (covR > 0.0) {
      float P = TAU * uDash.y / uDash.x;                       // dash period in CSS px
      float u = mod(arc, P);
      float covA = clamp(max(min(u, 2.0 - u), u - P) * uDpr + 0.5, 0.0, 1.0);   // dashed 2/3
      covA = max(covA, clamp((3.0 - ad) * uDpr + 0.5, 0.0, 1.0));
      col = mix(col, vec4(uUnitCol, 1.0), covR * covA * uUnit.w);
    }
  }
  o = col;
}
`;
  const COLORPLOT_FS = `
uniform vec2 uCenter; uniform vec2 uInvScale; uniform vec4 uVp;
out vec4 o;
void main() {
  vec2 z = uCenter + (gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw) * uInvScale;
  o = vec4(dcolor(mapF(z)), 1.0);
}
`;
  // the Cauchy integral of the nodes (zeta_j, w_j = F(zeta_j) dzeta_j / 2 pi i): sum_j w_j / (zeta_j - z). Inside the
  // closed curve it reproduces F, outside it is 0 (Cauchy's integral formula). Nodes are relative to an origin O, so
  // zeta_j - z keeps float32 precision near the curve. No chain: it compiles once.
  const CAUCHY_FS = `
uniform vec2 uRelC; uniform vec2 uInvScale; uniform vec4 uVp;
uniform highp sampler2D uNodes; uniform int uNodeN;
out vec4 o;
void main() {
  vec2 z = uRelC + (gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw) * uInvScale;   // relative to the node origin
  vec2 s = vec2(0.0);
  float m = 0.0;
  for (int j = 0; j < uNodeN; j++) {
    vec4 t = texelFetch(uNodes, ivec2(j, 0), 0);   // one row: no integer division per node
    vec2 d = t.xy - z;
    vec2 q = vec2(t.z * d.x + t.w * d.y, t.w * d.x - t.z * d.y) / max(dot(d, d), 1e-30);
    s += q;
    m += abs(q.x) + abs(q.y);
  }
  vec3 c = dcolor(s);
  // a sum that cancels to float32 rounding is 0 (outside the curve): no phase, a neutral grey instead of noise
  if (!(wabs(s) > 2e-5 * m)) c = mix(uPlane, vec3(0.5), 0.6);
  o = vec4(c, 1.0);
}
`;
  // ---------- preimages: where w = F(z) lands in target shapes of the w-plane (Preimage mode) ----------
  // Targets come in a float texture row: 6 texels per target (kind, complement, first point, point count | shape
  // parameters A | B | fill colour, alpha | edge colour, width (device px) | w-grid cell, -), then polygon and
  // polyline vertices. Every derivative is taken once, of w (dw/dx, dw/dy): the targets' functions are then
  // differenced along them, so no derivative sits in data-dependent control flow and widths are exact in pixels
  // for a conformal map (the pixel distance to a curve is |w - q| / |n . dw|, q the nearest point of the curve).
  // sphere: drawn over the Riemann sphere (SPHERE_VS geometry), z from the stereographic projection of the point
  const PRE_FS = (forms, sphere) => `
${sphere ? 'in vec3 vP;' : ''}
uniform vec2 uCenter; uniform vec2 uInvScale; uniform vec4 uVp; uniform float uDpr;
uniform highp sampler2D uPts; uniform int uTN; uniform vec3 uHalo; uniform float uHaloA;
out vec4 o;
vec4 R(int i) { return texelFetch(uPts, ivec2(i, 0), 0); }
float crs(vec2 u, vec2 v) { return u.x * v.y - u.y * v.x; }
vec2 segNear(vec2 p, vec2 a, vec2 b) { vec2 d = b - a; float L = dot(d, d); float t = L > 0.0 ? clamp(dot(p - a, d) / L, 0.0, 1.0) : 0.0; return a + t * d; }
vec2 nearer(vec2 p, vec2 q, vec2 q2) { return dot(p - q2, p - q2) < dot(p - q, p - q) ? q2 : q; }
// >= 0 inside the angular range that runs ccw over span degrees from the direction B.xy to B.zw (Region's sectorLevel)
float angIn(vec2 v, float span, vec4 B) {
  float a = crs(B.xy, v), b = -crs(B.zw, v);
  return span >= 360.0 ? 1.0 : (span <= 180.0 ? min(a, b) : max(a, b));
}
${forms || 'float formulaLevel(int f, vec2 w) { return -1.0; }\n'}
// area targets: the level of Region.levelOf, positive inside (NaN counts as outside)
float areaLevel(int kind, vec4 K, vec4 A, vec4 B, vec2 w) {
  float L = -1.0;
  if (kind == 1) L = A.z - length(w - A.xy);
  else if (kind == 2) L = min(min(w.x - A.x, A.z - w.x), min(w.y - A.y, A.w - w.y));
  else if (kind == 3) {
    int s = 6 * uTN + int(K.z + 0.5), n = int(K.w + 0.5);   // vertices follow the records
    bool inside = false;
    float dm = 1e38;
    for (int k = 0; k < 256; k++) {
      if (k >= n) break;
      vec2 a = R(s + k).xy, b = R(s + (k == 0 ? n - 1 : k - 1)).xy;
      if ((a.y > w.y) != (b.y > w.y) && w.x < (b.x - a.x) * (w.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      dm = min(dm, length(w - segNear(w, a, b)));
    }
    L = inside ? dm : -dm;
  }
  else if (kind == 4) L = crs(A.zw, w - A.xy);
  else if (kind == 5) { float d = length(w - A.xy); L = min(d - A.z, A.w - d); }
  else if (kind == 6) {
    vec2 v = w - A.xy;
    float g = A.w >= 360.0 ? length(v) : angIn(v, A.w, B);
    if (A.z > 0.0) g = min(g, A.z - length(v));
    L = g;
  }
  else if (kind == 7) L = formulaLevel(int(K.z + 0.5), w);
  else if (kind == 8) { vec2 u = w - A.xy; L = -0.5 * (A.z * dot(u, u) + 2.0 * dot(B.xy, u) + A.w); }   // v16 gdisc: -f/2
  if (K.y > 0.5) L = -L;
  return L > -1e30 ? min(L, 1e30) : -1e30;
}
// curve targets: the nearest point of the curve
vec2 curveNear(int kind, vec4 K, vec4 A, vec4 B, vec2 w) {
  if (kind == 11) return segNear(w, A.xy, A.zw);
  if (kind == 12 || kind == 13) {
    float L = dot(A.zw, A.zw);
    float t = L > 0.0 ? dot(w - A.xy, A.zw) / L : 0.0;
    return A.xy + (kind == 13 ? max(t, 0.0) : t) * A.zw;
  }
  if (kind == 14 || kind == 15) {
    vec2 v = w - A.xy;
    float l = length(v);
    vec2 q = A.xy + (l > 0.0 ? v / l : vec2(1.0, 0.0)) * A.z;
    if (kind == 15 && angIn(v, A.w, B) < 0.0) q = nearer(w, A.xy + B.xy * A.z, A.xy + B.zw * A.z);
    return q;
  }
  if (kind == 16) {
    int s = 6 * uTN + int(K.z + 0.5), n = int(K.w + 0.5);   // vertices follow the records
    vec2 q = R(s).xy;
    for (int k = 1; k < 256; k++) { if (k >= n) break; q = nearer(w, q, segNear(w, R(s + k - 1).xy, R(s + k).xy)); }
    return q;
  }
  if (kind == 17) {           // Cartesian grid: n + 1 lines each way across the rectangle A.xy - A.zw
    vec2 lo = min(A.xy, A.zw), hi = max(A.xy, A.zw);
    float n = max(B.x, 1.0);
    vec2 st = max(hi - lo, vec2(1e-30)) / n;
    vec2 i = clamp(floor((w - lo) / st + 0.5), vec2(0.0), vec2(n));
    return nearer(w, vec2(lo.x + i.x * st.x, clamp(w.y, lo.y, hi.y)), vec2(clamp(w.x, lo.x, hi.x), lo.y + i.y * st.y));
  }
  if (kind == 18) {           // polar grid: nc circles, nr rays of length r about A.xy
    vec2 v = w - A.xy;
    float l = length(v), dr = A.z / max(B.x, 1.0);
    float i = clamp(floor(l / dr + 0.5), 1.0, max(B.x, 1.0));
    vec2 qc = A.xy + (l > 0.0 ? v / l : vec2(1.0, 0.0)) * i * dr;
    float nr = max(B.y, 1.0);
    float an = floor(atan(v.y, v.x) * nr / TAU + 0.5) * TAU / nr;
    vec2 u = vec2(cos(an), sin(an));
    vec2 qr = A.xy + clamp(dot(v, u), 0.0, A.z) * u;
    return nearer(w, qc, qr);
  }
  if (kind == 20) {           // v16 gcurve: two Newton steps on f / 2 (the signed distance near the curve)
    vec2 q = w;
    for (int k = 0; k < 2; k++) {
      vec2 u = q - A.xy;
      float f2 = 0.5 * (A.z * dot(u, u) + 2.0 * dot(B.xy, u) + A.w);
      vec2 g = A.z * u + B.xy;
      float gg = dot(g, g);
      if (gg > 0.0) q -= f2 * g / gg;
    }
    return q;
  }
  return w + vec2(1e30);
}
void main() {
${sphere ? `  vec3 n = normalize(vP);
  vec2 z = vec2(n.x, -n.y) / max(1.0 - n.z, 1e-7);   // S = 0, N = infinity (the conjugate lift's inverse)` : `  vec2 z = uCenter + (gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw) * uInvScale;`}
  vec2 w = mapPoint(z);
  vec2 dx = dFdx(w), dy = dFdy(w);
  bool fin = cfin(w);
  if (!(cfin(dx) && cfin(dy))) { dx = vec2(0.0); dy = vec2(0.0); }
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uTN || !fin) break;
    vec4 K = R(6 * i), A = R(6 * i + 1), B = R(6 * i + 2), Cf = R(6 * i + 3), E = R(6 * i + 4), G = R(6 * i + 5);
    int kind = int(K.x + 0.5);
    if (kind < 10) {
      float L = areaLevel(kind, K, A, B, w);
      vec2 gL = vec2(areaLevel(kind, K, A, B, w + dx), areaLevel(kind, K, A, B, w + dy)) - L;
      float sd = L / max(length(gL), 1e-30);                    // signed distance in device px, positive inside
      float cov = clamp(sd + 0.5, 0.0, 1.0);
      // the w-plane's grid, pulled back: lines of Re w and Im w every G.x, faded where they crowd
      vec2 gx = vec2(length(vec2(dx.x, dy.x)), length(vec2(dx.y, dy.y)));
      vec2 dg = abs(fract(w / G.x + 0.5) - 0.5) * G.x / max(gx, vec2(1e-30));
      vec2 fade = smoothstep(vec2(5.0 * uDpr), vec2(12.0 * uDpr), G.x / max(gx, vec2(1e-30)));
      vec2 lg = clamp(0.5 * uDpr - dg + 0.5, 0.0, 1.0) * fade;
      vec3 c = mix(Cf.rgb, E.rgb, 0.4 * max(lg.x, lg.y));
      float a = Cf.a * cov;
      acc = vec4(c * a, a) + acc * (1.0 - a);
      float ce = clamp(0.5 * max(uDpr, 0.55 * E.w) - abs(sd) + 0.5, 0.0, 1.0) * 0.9;   // the boundary
      acc = vec4(E.rgb * ce, ce) + acc * (1.0 - ce);
    } else if (kind == 19) {
      // a curve formula's piece: g = 0 (formula K.z; K.w = 1: a complex piece, g = A - B as the pair of formulas K.z
      // (Re) and K.z + 1 (Im)), restricted to the formula B.x > 0 (when B.x >= 0). Distance in device px |g| / |dg|
      // with dg the larger of the forward and backward differences along dw/dx, dw/dy. A crossing is where g is
      // linear at pixel scale: forward and backward differences that disagree by more than half the larger one are a
      // jump (a branch cut) or a pole (g from -inf to +inf: the differences differ by 1.3-1.7x), not a crossing
      int gi = int(K.z + 0.5);
      float pd;
      if (K.w > 0.5) {
        vec2 D = vec2(formulaLevel(gi, w), formulaLevel(gi + 1, w));
        vec2 Dx = vec2(formulaLevel(gi, w + dx), formulaLevel(gi + 1, w + dx));
        vec2 Dy = vec2(formulaLevel(gi, w + dy), formulaLevel(gi + 1, w + dy));
        vec2 Bx = vec2(formulaLevel(gi, w - dx), formulaLevel(gi + 1, w - dx));
        vec2 By = vec2(formulaLevel(gi, w - dy), formulaLevel(gi + 1, w - dy));
        vec4 dF = vec4(Dx - D, Dy - D), dB = vec4(D - Bx, D - By);
        float lf = length(dF), lb = length(dB), lm = max(lf, lb);
        if (!(length(D) < 1e30) || !(lm < 1e30) || length(dF - dB) > 0.5 * lm + 1e-30) continue;
        pd = length(D) / max(lm, 1e-30);
      } else {
        float L = formulaLevel(gi, w);
        vec2 gF = vec2(formulaLevel(gi, w + dx), formulaLevel(gi, w + dy)) - L;
        vec2 gB = L - vec2(formulaLevel(gi, w - dx), formulaLevel(gi, w - dy));
        float lf = length(gF), lb = length(gB), lm = max(lf, lb);
        if (!(abs(L) < 1e30) || !(lm < 1e30) || length(gF - gB) > 0.5 * lm + 1e-30) continue;
        pd = abs(L) / max(lm, 1e-30);
      }
      float cov = 1.0;
      if (B.x > -0.5) {
        int ri = int(B.x + 0.5);
        float RL = formulaLevel(ri, w);
        vec2 gR = vec2(formulaLevel(ri, w + dx), formulaLevel(ri, w + dy)) - RL;
        float sr = RL / max(length(gR), 1e-30);
        cov = RL > -1e30 ? clamp(sr + 0.5, 0.0, 1.0) : 0.0;
      }
      float hw = 0.5 * E.w;
      float ch = clamp(hw + uDpr - pd + 0.5, 0.0, 1.0) * uHaloA * cov;
      acc = vec4(uHalo * ch, ch) + acc * (1.0 - ch);
      float cl = clamp(hw - pd + 0.5, 0.0, 1.0) * Cf.a * cov;
      acc = vec4(Cf.rgb * cl, cl) + acc * (1.0 - cl);
    } else {
      vec2 e = w - curveNear(kind, K, A, B, w);
      float g = length(e);
      vec2 nv = g > 0.0 ? e / g : vec2(0.0);
      float pd = g > 0.0 ? g / max(length(vec2(dot(nv, dx), dot(nv, dy))), 1e-30) : 0.0;   // device px
      float hw = 0.5 * E.w;
      float ch = clamp(hw + uDpr - pd + 0.5, 0.0, 1.0) * uHaloA;
      acc = vec4(uHalo * ch, ch) + acc * (1.0 - ch);
      float cl = clamp(hw - pd + 0.5, 0.0, 1.0) * Cf.a;
      acc = vec4(Cf.rgb * cl, cl) + acc * (1.0 - cl);
    }
  }
  o = acc;
}
`;

  // ---------- exact images: the per-pixel inverse pass (SPEC 4.2-4.3) ----------
  // Program text: HEAD + GLChain.LIB + inverse.lib + UTIL (+ SHADE on the globe) + INV_HEAD + inverse.walker +
  // INV_MAIN. INV_HEAD defines what the generated walker calls: the member ranges (ixRangeAdd / ixRangeLog, with the
  // shape's clip primitive), the early stop (ixStopAdd / ixStopLog), the sheet key and invLeaf (coverage of one
  // candidate: the region's signed distance in px, the range level, the facing rule, then admission into the
  // compile-time B-entry buffer with shading on admission and the twin merge). The CPU twin is Inverse.enumerate.
  // Shape: per-pass uniforms uShape (kind, complement, polygon vertex count, offset of the vertices in the record),
  // uShA, uShB (drawPreimage's record), uShC (inside at z = 0, boundary through 0, -, -), uFormSlot; the record in
  // the points texture (unit 4) at uShOff holds the clip primitive (header, 2 texels per piece) and polygon vertices.
  // IX_RECORD(L, D, cov) is a hook for the parity test (test/glsl_inverse_test.js), empty here.
  const INV_HEAD = (B, forms) => `
#ifndef IX_RECORD
#define IX_RECORD(L, D, cov)
#endif
const float IX_LN2 = 0.6931471805599453;
const float IX_BIG = 1e9;
#if IX_LAM
#define IX_HASLAM(L) (L).hasLam
#else
#define IX_HASLAM(L) false
#endif
uniform vec4 uVp; uniform vec2 uCenter; uniform vec2 uCenterLo; uniform vec2 uInvScale;
uniform vec4 uWin; uniform float uWinR; uniform float uWinRs; uniform vec2 uSing[4]; uniform int uSingN;
// uKsat: the front count K of the drawn alpha (uncapped); uKall = 1: every covering candidate counts (the shape's own
// alpha: when K > IX_B the early stop is off, and the candidates the buffer does not keep enter the composite through
// their transmittance ixTr); uKall = 0 (hover-dimmed draws): K capped at IX_B, the stop at the IX_B-th key
uniform int uKsat; uniform int uKall;
// uIxTail = 1: the shape's coverage is monotone along the stop op's member lines (Inverse.prepare's tail flag): with
// uKall and K > IX_B, a side whose members provably all cover and all lie behind the buffer ends in the tail closure
uniform int uIxTail;
uniform highp sampler2D uPts; uniform int uShOff; uniform ivec4 uShape; uniform vec4 uShA; uniform vec4 uShB; uniform vec4 uShC;
uniform int uFormSlot;
uniform vec4 uClipH; uniform vec4 uClipP[16]; uniform vec4 uShBox; uniform int uIxOne;   // the clip primitive: (nIn, nHole), 2 texels per piece (the first 8 here)
${PAT_UNIFORMS}out vec4 o;
${PAT_FNS}${forms || 'float formulaLevel(int f, vec2 z) { return -1.0; }\n'}
vec2 ixDwX, ixDwY;
const int IX_B = ${B};
float bD[IX_B]; vec2 bZ[IX_B]; float bC[IX_B]; float bG[IX_B]; highp uint bCol[IX_B];   // colour: 8 bits per channel
highp uint ixPack(vec3 c) { uvec3 u = uvec3(clamp(c, 0.0, 1.0) * 255.0 + 0.5); return u.r | (u.g << 8) | (u.b << 16); }
vec3 ixUnpack(highp uint u) { return vec3(float(u & 255u), float((u >> 8) & 255u), float((u >> 16) & 255u)) / 255.0; }
int nb; int nCov; float U; bool ixTailInf; float ixTr;
bool ixLastOk; bool ixLastFin; float ixLastD; vec2 ixLastZ;
vec4 ixRec(int i) { i += uShOff; return texelFetch(uPts, ivec2(i & 1023, i >> 10), 0); }
float ixBoxDistTo(vec2 z, vec4 b) { return cx_abs(max(max(b.xy - z, z - b.zw), vec2(0.0))); }
// ---- the shape's clip primitive along a line (Region.shapeClip): pieces 1 disc (c, r), 2 box (x0, x1 | y0, y1),
// 3 half-plane cross(d, z - a) > 0 (a | d); grown by m (in-pieces) or shrunk (hole pieces, m < 0)
vec2 ixClipPiece(vec4 P0, vec4 P1, vec2 z0, vec2 q, float m) {
  const vec2 E = vec2(IX_INF, -IX_INF);
  float qq = dot(q, q);
  int t = int(P0.x + 0.5);
  if (t == 1) {
    float r = P0.w + m;
    if (!(r > 0.0) || !(qq > 0.0)) return E;
    vec2 dd = P0.yz - z0;
    float ql = sqrt(qq), tc = dot(dd, q) / qq, h = abs(q.x * dd.y - q.y * dd.x) / ql;
    if (!(h <= r)) return E;
    float hc = sqrt((r - h) * (r + h)) / ql;
    return vec2(tc - hc, tc + hc);
  }
  if (t == 3) {
    vec2 d = P1.xy;
    float L0 = d.x * (z0.y - P0.z) - d.y * (z0.x - P0.y) + m * length(d), cq = d.x * q.y - d.y * q.x;
    if (!(abs(cq) > 1e-30)) return L0 > 0.0 ? vec2(-IX_INF, IX_INF) : E;
    float tt = -L0 / cq;
    return cq > 0.0 ? vec2(tt, IX_INF) : vec2(-IX_INF, tt);
  }
  if (t == 4) {               // v16 'g': {f(z0 + t q) < 2m} relative to the anchor P0.yz; A = P0.w >= 0, B = P1.xy, C = P1.z
    vec2 u0 = z0 - P0.yz;
    float a = P0.w * qq, b = 2.0 * (P0.w * dot(u0, q) + dot(P1.xy, q));
    float c = P0.w * dot(u0, u0) + 2.0 * dot(P1.xy, u0) + P1.z - 2.0 * m;
    if (!(a > 0.0)) {
      if (!(abs(b) > 1e-30)) return c < 0.0 ? vec2(-IX_INF, IX_INF) : E;
      float tt = -c / b;
      return b > 0.0 ? vec2(-IX_INF, tt) : vec2(tt, IX_INF);
    }
    float D = b * b - 4.0 * a * c;
    if (!(D > 0.0)) return E;
    float qr = -0.5 * (b + (b >= 0.0 ? 1.0 : -1.0) * sqrt(D)), t1 = qr / a, t2 = c / qr;
    return vec2(min(t1, t2), max(t1, t2));
  }
  if (t == 2) {
    float x0 = P0.y - m, x1 = P0.z + m, y0 = P1.x - m, y1 = P1.y + m;
    if (!(x0 <= x1 && y0 <= y1)) return E;
    vec2 r = vec2(-IX_INF, IX_INF);
    if (!(abs(q.x) > 1e-30)) { if (!(z0.x >= x0 && z0.x <= x1)) return E; }
    else { float t1 = (x0 - z0.x) / q.x, t2 = (x1 - z0.x) / q.x; r = vec2(max(r.x, min(t1, t2)), min(r.y, max(t1, t2))); }
    if (!(abs(q.y) > 1e-30)) { if (!(z0.y >= y0 && z0.y <= y1)) return E; }
    else { float t1 = (y0 - z0.y) / q.y, t2 = (y1 - z0.y) / q.y; r = vec2(max(r.x, min(t1, t2)), min(r.y, max(t1, t2))); }
    return r;
  }
  return vec2(-IX_INF, IX_INF);
}
// one loop over the in-pieces and the hole pieces (one clip call site: the compiled program stays small); the
// first 8 pieces come from uniforms, the rest (complements of convex polygons) from the record. uIxOne = 1: loop
// bounds the compiler cannot unroll (unrolling only multiplies the code here)
bool ixShapeClip(vec2 z0, vec2 q, float m, out float lo, out float hi, out float hlo, out float hhi) {
  int nIn = int(uClipH.x + 0.5), nAll = nIn + int(uClipH.y + 0.5);
  lo = -IX_INF; hi = IX_INF; hlo = IX_INF; hhi = -IX_INF;
  float l2 = -IX_INF, h2 = IX_INF;
  for (int i = 0; i < 68 * uIxOne; i++) {
    if (i >= nAll) break;
    vec4 P0 = i < 8 ? uClipP[2 * i] : ixRec(1 + 2 * i), P1 = i < 8 ? uClipP[2 * i + 1] : ixRec(2 + 2 * i);
    bool hole = i >= nIn;
    vec2 r = ixClipPiece(P0, P1, z0, q, hole ? -m : m);
    if (hole) { l2 = max(l2, r.x); h2 = min(h2, r.y); }
    else { lo = max(lo, r.x); hi = min(hi, r.y); }
  }
  if (nAll > nIn && l2 < h2) { hlo = l2; hhi = h2; }
  return lo <= hi;
}
// ---- the shape's level (positive inside) and gradient: Region.levelOf, Inverse's kindLevel ----
vec3 ixKindLevel(vec2 z) {
  int kind = uShape.x;
  if (kind == 1) {
    vec2 v = z - uShA.xy;
    float d = cx_abs(v);
    return d > 0.0 ? vec3(uShA.z - d, -v / d) : vec3(uShA.z, 0.0, 0.0);
  }
  if (kind == 2) {
    float L = z.x - uShA.x;
    vec2 g = vec2(1.0, 0.0);
    if (uShA.z - z.x < L) { L = uShA.z - z.x; g = vec2(-1.0, 0.0); }
    if (z.y - uShA.y < L) { L = z.y - uShA.y; g = vec2(0.0, 1.0); }
    if (uShA.w - z.y < L) { L = uShA.w - z.y; g = vec2(0.0, -1.0); }
    return vec3(L, g);
  }
  if (kind == 3) {
    int n = uShape.z, s = uShape.w;
    bool inside = false;
    float dm = 1e38;
    vec2 qn = z;
    vec2 b = ixRec(s + n - 1).xy;
    for (int i = 0; i < 64; i++) {
      if (i >= n) break;
      vec2 a = ixRec(s + i).xy;
      if ((a.y > z.y) != (b.y > z.y) && z.x < (b.x - a.x) * (z.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
      vec2 dd = b - a;
      float LL = dot(dd, dd);
      float t = LL > 0.0 ? clamp(dot(z - a, dd) / LL, 0.0, 1.0) : 0.0;
      vec2 p = a + t * dd;
      float d = cx_abs(z - p);
      if (d < dm) { dm = d; qn = p; }
      b = a;
    }
    float sg = inside ? 1.0 : -1.0;
    return dm > 0.0 ? vec3(sg * dm, sg * (z - qn) / dm) : vec3(0.0);
  }
  if (kind == 4) return vec3(uShA.z * (z.y - uShA.y) - uShA.w * (z.x - uShA.x), -uShA.w, uShA.z);
  if (kind == 8) {            // v16 gdisc: -f/2 and its gradient, relative to the anchor uShA.xy (A uShA.z, C uShA.w, B uShB.xy)
    vec2 u = z - uShA.xy;
    return vec3(-0.5 * (uShA.z * dot(u, u) + 2.0 * dot(uShB.xy, u) + uShA.w), -(uShA.z * u + uShB.xy));
  }
  if (kind == 5) {
    vec2 v = z - uShA.xy;
    float d = cx_abs(v);
    vec2 u = d > 0.0 ? v / d : vec2(0.0);
    return d - uShA.z < uShA.w - d ? vec3(d - uShA.z, u) : vec3(uShA.w - d, -u);
  }
  if (kind == 6) {
    vec2 v = z - uShA.xy, u1 = uShB.xy, u2 = uShB.zw;
    float d = cx_abs(v);
    vec2 u = d > 0.0 ? v / d : vec2(0.0);
    float a = u1.x * v.y - u1.y * v.x, b = -(u2.x * v.y - u2.y * v.x);
    vec3 res;
    if (uShA.w >= 360.0) res = vec3(d, u);
    else if (uShA.w <= 180.0) res = a < b ? vec3(a, -u1.y, u1.x) : vec3(b, u2.y, -u2.x);
    else res = a > b ? vec3(a, -u1.y, u1.x) : vec3(b, u2.y, -u2.x);
    if (uShA.z > 0.0 && uShA.z - d < res.x) res = vec3(uShA.z - d, -u);
    return res;
  }
  return vec3(-1.0, 0.0, 0.0);
}
// a formula shape's level with its complement (formulas only: their gradient is taken by central differences)
float ixFormLevel(vec2 z) { float L = formulaLevel(uFormSlot, z); return uShape.y == 1 ? -L : L; }
void ixFromGrad(float L, float gx, float gy, out float s, out vec2 n) {
  vec2 g = vec2(gx, gy);
  float m = max(abs(gx), abs(gy));
  n = vec2(0.0);
  if (!(m > 0.0) || !(m < 3.4e38)) { s = L > 0.0 ? 1e38 : -1e38; return; }
  float gl = length(g / m) * m;
  s = L / gl; n = g / gl;
}
// formulas: central differences of the full level along the footprints
void ixCentral(vec2 z, vec2 dX, vec2 dY, out float s, out vec2 n) {
  float L0 = ixFormLevel(z);
  n = vec2(0.0);
  if (!(L0 > -1e37)) { s = -1e38; return; }
  vec2 dl = vec2(ixFormLevel(z + dX) - ixFormLevel(z - dX), ixFormLevel(z + dY) - ixFormLevel(z - dY)) * 0.5;
  if (!ixFin(dl)) { s = L0 > 0.0 ? 1e38 : -1e38; return; }
  ixFromGrad(L0, dl.x, dl.y, s, n);
}
// direction tests in log space (the Lambda rule): level e^{Re L} cross(d, e^{i th}), gradient in (Re L, th)
void ixDirHalf(vec2 d, float th, vec2 dLX, vec2 dLY, float sg, out float s, out vec2 n) {
  vec2 e = vec2(cos(th), sin(th));
  float l = sg * (d.x * e.y - d.y * e.x), dt = sg * dot(d, e);
  ixFromGrad(l, l * dLX.x + dt * dLX.y, l * dLY.x + dt * dLY.y, s, n);
}
// signed distance (image px, positive inside) of a candidate to the region boundary and its unit image-space normal
// (SPEC 4.3), with the Lambda rule for |Re Lambda| > 60
void ixShapePx(vec2 z, bool zf, vec2 dX, vec2 dY, Lf L, vec2 dLX, vec2 dLY, out float s, out vec2 n) {
  int kind = uShape.x;
  float cs = uShape.y == 1 ? -1.0 : 1.0;
  s = -1e38; n = vec2(0.0);
  if (IX_HASLAM(L) && abs(L.lam.x) > 60.0) {
    bool big = L.lam.x > 0.0, at0 = uShC.x > 0.5;
    float th = L.lam.y;
    if (kind == 4) { if (big || uShC.y > 0.5) ixDirHalf(uShA.zw, th, dLX, dLY, cs, s, n); else s = at0 ? IX_BIG : -IX_BIG; return; }
    if (kind == 8) { if (big) s = uShA.z < 0.0 ? IX_BIG : -IX_BIG; else if (uShC.y > 0.5) ixDirHalf(uShB.zw, th, dLX, dLY, 1.0, s, n); else s = at0 ? IX_BIG : -IX_BIG; return; }
    if (kind == 6 && !(uShA.z > 0.0)) {
      if (!(big || uShC.y > 0.5)) { s = at0 ? IX_BIG : -IX_BIG; return; }
      if (uShA.w >= 360.0) { s = cs > 0.0 ? IX_BIG : -IX_BIG; return; }
      float sA, sB; vec2 nA, nB;
      ixDirHalf(uShB.xy, th, dLX, dLY, 1.0, sA, nA);
      ixDirHalf(-uShB.zw, th, dLX, dLY, 1.0, sB, nB);
      bool pickA = uShA.w <= 180.0 ? sA < sB : sA > sB;
      s = pickA ? sA : sB; n = pickA ? nA : nB;
      if (cs < 0.0) { s = -s; n = -n; }
      return;
    }
    if (kind != 7) { s = big ? (cs < 0.0 ? IX_BIG : -IX_BIG) : (at0 ? IX_BIG : -IX_BIG); return; }      // bounded kinds
    // formulas: evaluated at e^{+-60 + i Im Lambda} (below, with the plain ones)
    z = cexp(vec2(big ? 60.0 : -60.0, th)); dX = cmul(z, dLX); dY = cmul(z, dLY); zf = true;
  } else if (!zf || abs(z.x) > 1e30 || abs(z.y) > 1e30) return;
  if (uShBox.x <= uShBox.z) {
    // polygons and bounded formulas lie in the box uShBox: a point outside it by more than 2 footprints is outside
    // the shape by more than 2 px (|grad L| = 1 for polygons; formulas: their level is a distance in z units, too)
    float db = ixBoxDistTo(z, uShBox), fpx = cx_abs(dX) + cx_abs(dY);
    if (db > 2.0 * fpx) { s = uShape.y == 1 ? IX_BIG : -max(db / max(fpx, 1e-30), 2.0); return; }
  }
  if (kind == 7) { ixCentral(z, dX, dY, s, n); return; }
  vec3 r = ixKindLevel(z);
  if (cx_isnan(r.x)) return;
  vec2 g = cs * r.yz;
  ixFromGrad(cs * r.x, dot(g, dX), dot(g, dY), s, n);
}
// ---- sheet order (SPEC 5): D = log2(1 + dist(z, W) / R) + sum over P of max(0, log2(rs / |z - p|)) ----
float ixBoxDist(vec2 z) { return ixBoxDistTo(z, uWin); }
float ixSheetKey(vec2 z, bool zf, Lf L) {
  if (IX_HASLAM(L) && L.lam.x > 60.0) return (L.lam.x - log(uWinR)) / IX_LN2;
  if (!zf) return 1e38;
  float D = log2(1.0 + ixBoxDist(z) / uWinR);
  for (int i = 0; i < 4; i++) {
    if (i >= uSingN) break;
    vec2 p = uSing[i];
    if (IX_HASLAM(L) && L.lam.x < -60.0 && p.x == 0.0 && p.y == 0.0) D += max(0.0, log2(uWinRs) - L.lam.x / IX_LN2);
    else D += max(0.0, log2(uWinRs / cx_abs(z - p)));
  }
  return D;
}
// ---- member ranges (SPEC 3.6) ----
void ixRangeFinish(inout float lo, inout float hi, inout float hlo, inout float hhi, inout float ms) {
  if (hlo <= hhi) {      // a hole reaching infinity: a one-sided range
    if (hlo <= -IX_INF) { lo = max(lo, hhi + 1.0); hlo = IX_INF; hhi = -IX_INF; }
    else if (hhi >= IX_INF) { hi = min(hi, hlo - 1.0); hlo = IX_INF; hhi = -IX_INF; }
  }
  if (lo > hi) return;
  ms = min(hi, max(lo, ms));
  if (ms >= hlo && ms <= hhi) ms = (ms - hlo <= hhi - ms) ? hlo - 1.0 : hhi + 1.0;
}
vec2 ixMobT(vec2 u) {
  vec2 num = cmul(uIxStopT[0].xy, u) + uIxStopT[0].zw, den = cmul(uIxStopT[1].xy, u) + uIxStopT[1].zw;
  return vec2(num.x * den.x + num.y * den.y, num.y * den.x - num.x * den.y) / dot(den, den);
}
// 2^D of a finite point without the logs (the same order as ixSheetKey)
float ixKeyExp(vec2 z) {
  float K = 1.0 + ixBoxDist(z) / uWinR;
  for (int i = 0; i < 4; i++) { if (i >= uSingN) break; K *= max(1.0, uWinRs / cx_abs(z - uSing[i])); }
  return K;
}
// the Mobius-prefix centre: the smallest key among the u-projection, the member nearest the reference in z and the
// member farthest from the accumulation point, each with its neighbours (Inverse's mobCentre; every distinct member
// is evaluated once, in the CPU's order, so the first minimum is the same)
float ixMobCentre(vec2 base, vec2 p, vec2 uc, float ms) {
  if (!ixFin(uc)) return ms;
  vec2 A = base - uc, Bq = base - uIxStopMob.xy;
  float a = dot(p, p), b1 = 2.0 * dot(A, p), c1 = dot(A, A), b2 = 2.0 * dot(Bq, p), c2 = dot(Bq, Bq);
  float qa = a * (b2 - b1), qb = 2.0 * a * (c2 - c1), qc = b1 * c2 - b2 * c1;
  float cand[6];
  cand[0] = ms; cand[1] = floor(-dot(Bq, p) / a + 0.5);
  cand[2] = cand[3] = cand[4] = cand[5] = IX_INF;
  if (abs(qa) > 1e-30) {
    float D = qb * qb - 4.0 * qa * qc;
    if (D >= 0.0) {
      float sq = sqrt(D), r1 = (-qb - sq) / (2.0 * qa), r2 = (-qb + sq) / (2.0 * qa);
      cand[2] = floor(r1); cand[3] = ceil(r1); cand[4] = floor(r2); cand[5] = ceil(r2);
    }
  } else if (abs(qb) > 1e-30) { float r = -qc / qb; cand[2] = floor(r); cand[3] = ceil(r); }
  float best = ms, bK = 3e38;
  for (int t = 0; t < 18 * uIxOne; t++) {
    int i = t / 3;
    float c = cand[i];
    if (!(abs(c) < 1e30)) continue;
    float m2 = c + float(t - 3 * i - 1);
    bool seen = false;
    for (int q = 0; q < 6; q++) { if (q >= i) break; if (abs(cand[q]) < 1e30 && abs(m2 - cand[q]) <= 1.0) seen = true; }
    if (seen) continue;
    vec2 zz = ixMobT(base + m2 * p);
    if (!ixFin(zz)) continue;
    float K = ixKeyExp(zz);
    if (K < bK) { bK = K; best = m2; }
  }
  return best;
}
// additive family: members u_m = base + m p; d0 = du/dw
void ixRangeAdd(int j, Lf L, vec2 base, vec2 p, vec2 d0, out float lo, out float hi, out float hlo, out float hhi, out float ms) {
  lo = -IX_INF; hi = IX_INF; hlo = IX_INF; hhi = -IX_INF;
  vec2 ref = uIxRef[j];
  ms = ixFin(ref) ? floor(cdiv(ref - base, p).x + 0.5) : 0.0;
  if (!(abs(ms) < 1e30)) ms = 0.0;
#if IX_MOB
  if (j == uIxStopOp && uIxStopMobOn) ms = ixMobCentre(base, p, ref, ms);
#endif
  int rk = uIxRK[j];
  if (rk == 1) {
    // the member line z_m = z0 + m q clipped to the shape grown by the anti-aliasing margin (1.5 image px in z, at most
    // half a member spacing)
    vec2 A = uIxAB[j].xy, z0 = cdiv(base - uIxAB[j].zw, A), q = cdiv(p, A);
    float qa = cx_abs(q);
    float rho = cx_abs(d0) * ixScale(L.J) * ixPix / cx_abs(A);
    float mt = min(1.5 * rho / qa, 0.5);
    if (!(mt >= 0.0)) mt = 0.5;
    float tl, th, tl2, th2;
    if (!ixShapeClip(z0, q, mt * qa, tl, th, tl2, th2)) { lo = 1.0; hi = 0.0; return; }
    lo = max(lo, ceil(tl) - 1.0); hi = min(hi, floor(th) + 1.0);
    if (tl2 <= th2) { hlo = floor(tl2) + 2.0; hhi = ceil(th2) - 2.0; }
  } else if (rk == 2) {
    vec4 bx = uIxBox[j];
    float pa = cx_abs(p), t0 = dot(base, p) / pa;
    if (bx.z > -IX_INF) lo = max(lo, ceil((bx.z - t0) / pa) - 1.0);
    if (bx.w < IX_INF) hi = min(hi, floor((bx.w - t0) / pa) + 1.0);
  }
  ixRangeFinish(lo, hi, hlo, hhi, ms);
}
// log family (ROOTPOW): L_m = L0 + m S; P = (beta, branch lo, hi), Q = (|s|, mode 0 int / 1 finite / 2 inf, S)
float ixToM(float t, vec2 L0, vec2 S) { return t >= IX_INF ? (S.x > 0.0 ? IX_INF : -IX_INF) : (log(t) - L0.x) / S.x; }
void ixRangeLog(int j, Lf L, vec2 L0, vec2 S, vec4 P, vec4 Q, out float lo, out float hi, out float hlo, out float hhi, out float ms) {
  lo = -IX_INF; hi = IX_INF; hlo = IX_INF; hhi = -IX_INF;
  int mode = int(Q.y + 0.5);
  if (mode == 0) { ms = floor(((P.z + P.w) * 0.5 - L0.y) / (CX_TAU * P.x) + 0.5); lo = ms; hi = ms; return; }
  ms = floor(dot(uIxRef[j] - L0, S) / dot(S, S) + 0.5);
  if (!(abs(ms) < 1e30)) ms = 0.0;
  if (mode == 1) {
    float xa = (P.z - L0.y) / S.y, xb = (P.w - L0.y) / S.y;
    lo = ceil(min(xa, xb)) - 1.0; hi = floor(max(xa, xb)) + 1.0;
  }
  int rk = uIxRK[j];
  if (rk == 1) {
    // the member ray z = za + t dz, t = |u_m|: the union of the clips of the rays turned by 0 and +-da (the margin as
    // an angle), the hole the intersection of their holes
    vec2 A = uIxAB[j].xy, za = -cdiv(uIxAB[j].zw, A);
    float da = min(1.5 * cx_abs(P.xy) * ixScale(L.J) * ixPix / cx_abs(L.u), 0.3);
    if (!(da >= 0.0)) da = 0.3;
    float rlo = IX_INF, rhi = -IX_INF, rhl = -IX_INF, rhh = IX_INF;
    for (int i = 0; i < 3 * uIxOne; i++) {
      if (i > 0 && !(da > 0.0)) break;
      float an = L0.y + (i == 0 ? 0.0 : (i == 1 ? -da : da));
      float tl, th, tl2, th2;
      ixShapeClip(za, cdiv(vec2(cos(an), sin(an)), A), 0.0, tl, th, tl2, th2);
      if (max(tl, 0.0) < th) { rlo = min(rlo, max(tl, 0.0)); rhi = max(rhi, th); }
      rhl = max(rhl, tl2); rhh = min(rhh, th2);
    }
    float tlo = max(rlo, 0.0), thi = rhi;
    if (!(tlo < thi)) { lo = 1.0; hi = 0.0; return; }
    float a = tlo > 0.0 ? ixToM(tlo, L0, S) : (S.x > 0.0 ? -IX_INF : IX_INF), b = ixToM(thi, L0, S);
    lo = max(lo, ceil(min(a, b)) - 1.0); hi = min(hi, floor(max(a, b)) + 1.0);
    if (rhl <= rhh && rhh > 0.0) {
      float ha = rhl > 0.0 ? ixToM(rhl, L0, S) : (S.x > 0.0 ? -IX_INF : IX_INF), hb = ixToM(rhh, L0, S);
      hlo = floor(min(ha, hb)) + 2.0; hhi = ceil(max(ha, hb)) - 2.0;
    }
  } else if (rk == 2) {
    vec4 bx = uIxBox[j];
    float a = bx.z > -IX_INF ? (bx.z - L0.x) / S.x : (S.x > 0.0 ? -IX_INF : IX_INF);
    float b = bx.w < IX_INF ? (bx.w - L0.x) / S.x : (S.x > 0.0 ? IX_INF : -IX_INF);
    float mn = min(a, b), mx = max(a, b);
    if (mn > -IX_INF) lo = max(lo, ceil(mn) - 1.0);
    if (mx < IX_INF) hi = min(hi, floor(mx) + 1.0);
  }
  ixRangeFinish(lo, hi, hlo, hhi, ms);
}
// ---- compositing buffer (4.2): front to back by D, ties larger Im z, then larger Re z ----
// the buffer is indexed by loop counters only (unrolled: entries stay in registers, no thread-memory spill)
int ixK() { return min(uKsat, IX_B); }
float ixDK() {
  if (uKall > 0 && uKsat > IX_B) return 1e38;      // the K-th key is not kept: no early stop
  int k = ixK();
  float dk = 1e38;
  for (int i = 0; i < IX_B; i++) if (i == k - 1 && i < nb) dk = bD[i];
  return dk;
}
// The tail rule (K > IX_B for the shape's own alpha, where ixDK() turns the early stop off). Every covering candidate the
// buffer does not keep enters the composite only through ixTr, and the walk sets ixTailInf when a side, still running
// at the end of its budget, ends with three covering members; the composite is then the buffer, plus the rest of the
// light in the buffer's mean colour: ixTr is discarded. So a side of the stop op may stop as soon as (the walker checks
// the side's part: still in range up to infinity, no hole, its last three members covering) its members provably
// (uIxTail, Inverse.prepare) all cover from here on, the union U is final (1), and their keys provably exceed the
// buffer's last key (the stop's lower bound against bD[IX_B - 1]): the full walk would admit none of them, would keep
// the side running to the end of its budget and would close the tail. The composite is the same; the members it
// skipped would only have scaled ixTr. (An unbounded side of a monotone family: exp(H), z^i(H) at alpha <= 0.5 walk
// B + 2 members instead of the whole window.)
float ixDKTail() {
  if (uIxTail == 0 || !(uKall > 0 && uKsat > IX_B) || nb < IX_B || !(U >= 1.0)) return 1e38;
  return bD[IX_B - 1];
}
// a covering candidate the buffer does not keep (not admitted, or dropped off its end): its transmittance, with the
// drawn alpha and the coverage relative to the running union U, enters the composite behind the buffer
void ixRest(float cv) { ixTr *= 1.0 - uAlpha * min(1.0, cv / max(U, 1e-6)); }
bool ixFront(float D1, vec2 t1, float D2, vec2 t2) {
  if (D1 != D2) return D1 < D2;
  if (t1.y != t2.y) return t1.y > t2.y;
  return t1.x > t2.x;
}
// ---- early stop (3.6) ----
float ixRayBoxDist(vec2 a, vec2 v, float smax) {
  float lo = 0.0, hi = smax;
  if (!(abs(v.x) > 1e-30)) { if (a.x < uWin.x || a.x > uWin.z) lo = IX_INF; }
  else { float t1 = (uWin.x - a.x) / v.x, t2 = (uWin.z - a.x) / v.x; lo = max(lo, min(t1, t2)); hi = min(hi, max(t1, t2)); }
  if (!(abs(v.y) > 1e-30)) { if (a.y < uWin.y || a.y > uWin.w) lo = IX_INF; }
  else { float t1 = (uWin.y - a.y) / v.y, t2 = (uWin.w - a.y) / v.y; lo = max(lo, min(t1, t2)); hi = min(hi, max(t1, t2)); }
  if (lo <= hi) return 0.0;
  float d = ixBoxDist(a);
  if (smax < IX_INF) d = min(d, ixBoxDist(a + smax * v));
  float vv = dot(v, v);
  if (vv > 0.0) {
    for (int i = 0; i < 4; i++) {
      vec2 c = vec2(i < 2 ? uWin.x : uWin.z, (i & 1) == 0 ? uWin.y : uWin.w);
      float s = clamp(dot(c - a, v) / vv, 0.0, smax);
      d = min(d, cx_abs(a + s * v - c));
    }
  }
  return d;
}
// additive family at the stop op: the Mobius rule (members on an arc converging to pAcc) or the AFF rule (a proven
// lower bound of the keys still to come on the ray z_m + s dir q)
bool ixStopAdd(int j, vec2 p, bool goUp, vec2 umem, float dk) {
#if IX_MOB
  if (uIxStopMobOn) {
    if (!ixLastFin) return false;
    if (dot(umem - uIxStopMob.xy, p) * (goUp ? 1.0 : -1.0) < 0.0) return false;
    vec2 pa = uIxStopMob.zw;
    float r = cx_abs(ixLastZ - pa);
    float LB = log2(1.0 + max(0.0, ixBoxDist(pa) - r) / uWinR) + (uIxPAccInP > 0.5 ? max(0.0, log2(uWinRs / r)) : 0.0);
    return LB > dk;
  }
#endif
  if (!(dk < 1e37) || uIxRK[j] != 1) return false;
  float lb = ixLastD;
  // (the members still to come start at the next one, z_m + q: a member past the front need not be walked to stop)
  if (ixLastFin) { vec2 q = cdiv(p, uIxAB[j].xy), qd = goUp ? q : -q; lb = log2(1.0 + ixRayBoxDist(ixLastZ + qd, qd, IX_INF) / uWinR); }
  return lb > dk + 1e-12;
}
bool ixStopLog(int j, vec2 S, bool goUp, float dk) {
  if (!(dk < 1e37) || uIxRK[j] != 1) return false;
  float dir = goUp ? 1.0 : -1.0, lb;
  if (!ixLastFin) lb = dir * S.x > 0.0 ? ixLastD : -1e38;
  else {
    vec2 za = -cdiv(uIxAB[j].zw, uIxAB[j].xy), z = za + (ixLastZ - za) * exp(dir * S.x);   // the next member
    if (!ixFin(z)) z = ixLastZ;
    if (dir * S.x > 0.0) lb = log2(1.0 + ixRayBoxDist(z, z - za, IX_INF) / uWinR);
    else {
      lb = log2(1.0 + ixRayBoxDist(z, za - z, 1.0) / uWinR);
      for (int i = 0; i < 4; i++) {
        if (i >= uSingN) break;
        float far = max(cx_abs(z - uSing[i]), cx_abs(za - uSing[i]));
        if (far < uWinRs) lb += log2(uWinRs / far);
      }
    }
  }
  return lb > dk + 1e-12;
}
// ---- patterns with analytic footprints (6.1, 6.2) ----
vec2 ixDivL(vec2 a, vec2 b) { return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / max(dot(b, b), 1e-37); }
// UTIL's checker for the analytic footprints. For a filter narrower than a cell (w < 1) the box-filtered square wave is
// the ramp clamp(2 q / w, -1, 1) around the nearest cell edge n (q = p - n, exact in float32), signed (-1)^n: the same
// value as UTIL's difference of two fract() terms, without its cancellation (at deep zooms that difference was rounding
// noise: colours past c0 / c1, then the average, P2 review). Interiors are exactly +-1; the ramp is at least 2 ulps of
// p wide. Wider filters (w >= 1, moire-faded anyway) keep UTIL's form.
float ixSq(float p, float w) {
  if (w >= 1.0) return clamp(2.0 * (abs(fract((p - 0.5 * w) * 0.5) - 0.5) - abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w, -1.0, 1.0);
  float n = floor(p + 0.5), q = p - n;
  float sgn = n - 2.0 * floor(0.5 * n) > 0.5 ? -1.0 : 1.0;
  return sgn * clamp(2.0 * q / max(w, max(2.4e-7 * abs(p), 1e-30)), -1.0, 1.0);
}
float ixChecker(vec2 p, vec2 w) { return 0.5 - 0.5 * ixSq(p.x, w.x) * ixSq(p.y, w.y); }
// vSrc: the source point relative to vQ (0, or near a saturation anchor its pattern-aligned origin: SPEC 13.12)
// gpA: near a saturation anchor (p != 0), the log-polar cell coordinates relative to the corner nearest to log p (xy)
// and that corner's integer shift mod 2 (zw); gpA.z = -1 otherwise
vec3 ixPattern(vec2 vSrc, vec2 vQ, vec2 gK, vec4 gpA, vec2 dX, vec2 dY, bool hasLam, vec2 lam, vec2 dLX, vec2 dLY, float vJac) {
${PATTERN_SRC('analytic')}  return col;
}
#if IX_ANC
// ---- saturation anchors (SPEC 13.12; Inverse.anchorModel / anchorPx): z = p + delta near p = (+-1 - B) / A (tan: +-i).
// Per anchor a, uAnc[4a..4a+3] = model (type 0 none / 1 sure / 2 cone / 3 circle, its radius m, flag, sgn), geometry
// (cone: u1, u2; circle: v0 = p - c, r, K), pattern (p - Q, Q), (p, log p; log p.x < -1e29: p = 0). uAncAB = (A, B)
// of the affine ops between the anchor op and z, uAncLA = log A.
uniform vec4 uAncAB; uniform vec2 uAncLA; uniform vec4 uAnc[8]; uniform vec4 uAncK; uniform vec4 uAncG[2];
bool ixAnchorPx(int a, vec2 dz, vec2 lz, vec2 dX, vec2 dY, vec2 dLX, vec2 dLY, out float s, out vec2 n) {
  vec4 M = uAnc[4 * a], G = uAnc[4 * a + 1];
  int type = int(M.x + 0.5);
  s = -1e38; n = vec2(0.0);
  if (type == 0 || !(exp(min(lz.x, 80.0)) < M.y)) return false;
  if (type == 1) { s = M.z * IX_BIG; return true; }
  if (type == 2) {
    float sA, sB; vec2 nA, nB;
    ixDirHalf(G.xy, lz.y, dLX, dLY, 1.0, sA, nA);
    ixDirHalf(-G.zw, lz.y, dLX, dLY, 1.0, sB, nB);
    bool pickA = M.z > 0.5 ? sA < sB : sA > sB;
    s = (pickA ? sA : sB) * M.w; n = (pickA ? nA : nB) * M.w;
    return true;
  }
  float sg = M.z * M.w;
  if (lz.x < -60.0) { ixDirHalf(ixUnit(vec2(-G.y, G.x)), lz.y, dLX, dLY, sg, s, n); return true; }   // the tangent at p
  vec2 v = G.xy + dz;
  float vv = cx_abs(v);
  float Lc = (G.w - 2.0 * dot(G.xy, dz) - dot(dz, dz)) / (G.z + vv);
  vec2 g = -v / max(vv, 1e-37);
  ixFromGrad(sg * Lc, sg * dot(g, dX), sg * dot(g, dY), s, n);
  return true;
}
#endif
float ixLog2Det(vec4 J) {
  float m = max(max(abs(J.x), abs(J.y)), max(abs(J.z), abs(J.w)));
  if (!(m > 0.0) || !(m < 3.4e38)) return 0.0;
  vec4 K = J / m;
  return log2(abs(K.x * K.w - K.y * K.z)) + 2.0 * log2(m);
}
// ---- one candidate (SPEC 4.2 Leaf): coverage with the facing rule, then admission (twin merge, shading on admission)
// shading on admission: the candidate's packed colour
highp uint ixShadeAdm(vec2 z, bool zf, vec2 dX, vec2 dY, Lf L, vec2 pv, vec2 pq, vec2 pk, vec4 pg, bool phl, vec2 plam, vec2 dLX, vec2 dLY) {
  // (the area-scale pattern's log2 |dw/dz| only for that pattern)
  float vJac = uPattern == 7 ? -0.5 * (IX_HASLAM(L) ? 2.0 * L.lam.x / IX_LN2 + ixLog2Det(L.JL) : ixLog2Det(L.J)) : 0.0;
  // an overflowed z (only with Lambda) shades as a far point in its direction: cells too small, the moire average
  // (a non-finite footprint: a critical value at the pixel centre, shaded with the moire average)
  bool fin = zf && ixFin(dX) && ixFin(dY);
  vec2 dXs = fin ? dX : vec2(1e30), dYs = fin ? dY : vec2(1e30);
  if (!zf) pv = 1e30 * vec2(cos(L.lam.y), sin(L.lam.y));
  return ixPack(ixPattern(pv, pq, pk, pg, dXs, dYs, phl, plam, dLX, dLY, vJac));
}
void ixAdmit(float D, vec2 tz, float cv, float ga, float fp, vec2 z, bool zf, vec2 dX, vec2 dY, Lf L, vec2 pv, vec2 pq, vec2 pk, vec4 pg, bool phl, vec2 plam, vec2 dLX, vec2 dLY) {
${B >= 8 ? `  // (B = 8, alpha < 0.5: up to 17 covering candidates per pixel, admission was 60 % of the pass.) The common case, a
  // candidate that cannot merge with a twin (fully covering, or no range gradient) while the admission limit is the
  // buffer's end: behind the last entry of a full buffer it is not kept (one comparison); otherwise it is inserted
  // from the end, entries behind it moving back one slot, up to the first entry in front of it (one comparison for
  // the walk's usual, key-ordered arrivals). The same buffer as the scan and shift below, which candidates that may
  // merge with a twin (partial and bound) still take. exp(H) at alpha 0.3, dpr 2: 6.0 -> 4.5 ms per pass (for B 3
  // and 5 this path measured 4-10 % slower: the scan below stays there).
  if ((cv >= 1.0 || ga >= 50.0) && ixK() + 2 >= IX_B) {
    if (nb == IX_B && !ixFront(D, tz, bD[IX_B - 1], bZ[IX_B - 1])) { ixRest(cv); return; }
    if (nb == IX_B) ixRest(bC[IX_B - 1]);
    highp uint col = ixShadeAdm(z, zf, dX, dY, L, pv, pq, pk, pg, phl, plam, dLX, dLY);
    int p = min(nb, IX_B - 1);
    bool done = false;
    for (int i = IX_B - 1; i > 0; i--) {
      if (done || i > p) continue;
      if (ixFront(D, tz, bD[i - 1], bZ[i - 1])) { bD[i] = bD[i - 1]; bZ[i] = bZ[i - 1]; bC[i] = bC[i - 1]; bG[i] = bG[i - 1]; bCol[i] = bCol[i - 1]; }
      else { bD[i] = D; bZ[i] = tz; bC[i] = cv; bG[i] = ga; bCol[i] = col; done = true; }
    }
    if (!done) { bD[0] = D; bZ[0] = tz; bC[0] = cv; bG[0] = ga; bCol[0] = col; }
    nb = min(nb + 1, IX_B);
    return;
  }
` : ''}  // position: the entries in front of the candidate (a prefix of the sorted buffer)
  int pos = 0;
  for (int i = 0; i < IX_B; i++) if (i < nb && !ixFront(D, tz, bD[i], bZ[i])) pos = i + 1;
  // twin merge with the neighbour at pos - 1 (first) or pos
  if (cv < 1.0 && ga < 50.0) {
    int tw = -1;
    for (int i = 0; i < IX_B; i++) {
      if (tw < 0 && (i == pos - 1 || i == pos) && i < nb && bC[i] < 1.0 && bG[i] < 50.0 && cos(ga - bG[i]) < -0.5 && cx_abs(z - bZ[i]) <= fp) tw = i;
    }
    if (tw >= 0) {
      for (int i = 0; i < IX_B; i++) if (i == tw) { bC[i] = min(1.0, bC[i] + cv); U = max(U, bC[i]); }
      return;
    }
  }
  if (pos >= min(IX_B, ixK() + 2)) { ixRest(cv); return; }
  if (nb == IX_B) ixRest(bC[IX_B - 1]);
  highp uint col = ixShadeAdm(z, zf, dX, dY, L, pv, pq, pk, pg, phl, plam, dLX, dLY);
  for (int i = IX_B - 1; i > 0; i--) {
    if (i > pos) { bD[i] = bD[i - 1]; bZ[i] = bZ[i - 1]; bC[i] = bC[i - 1]; bG[i] = bG[i - 1]; bCol[i] = bCol[i - 1]; }
    else if (i == pos) { bD[i] = D; bZ[i] = tz; bC[i] = cv; bG[i] = ga; bCol[i] = col; }
  }
  if (pos == 0) { bD[0] = D; bZ[0] = tz; bC[0] = cv; bG[0] = ga; bCol[0] = col; }
  nb = min(nb + 1, IX_B);
}
float invLeaf(Lf L, out bool cov) {
  vec2 z = L.u;
  bool zf = ixFin(z);
  vec2 dX = vec2(L.J.x * ixDwX.x + L.J.y * ixDwX.y, L.J.z * ixDwX.x + L.J.w * ixDwX.y);
  vec2 dY = vec2(L.J.x * ixDwY.x + L.J.y * ixDwY.y, L.J.z * ixDwY.x + L.J.w * ixDwY.y);
  vec2 dLX = vec2(0.0), dLY = vec2(0.0);
  if (IX_HASLAM(L)) {
    dLX = vec2(L.JL.x * ixDwX.x + L.JL.y * ixDwX.y, L.JL.z * ixDwX.x + L.JL.w * ixDwX.y);
    dLY = vec2(L.JL.x * ixDwY.x + L.JL.y * ixDwY.y, L.JL.z * ixDwY.x + L.JL.w * ixDwY.y);
  }
  // (a critical value exactly at the pixel centre: dz/dw infinite or NaN, float32 having an exact 0 there; the
  // pixel's preimage is a small neighbourhood of the critical point: ixFromGrad answers +-1e38 for a non-finite
  // gradient, so the region's sign there decides, and ixAdmit shades with the moire average, never NaN (a black
  // pixel). The float64 twin also takes footprints past 1e12 (1 + |z|) as critical.)
  float s; vec2 n;
  bool done = false;
  // the pattern's inputs: the source point (relative to its pattern origin) and log z with its footprints
  vec2 pv = z, pq = vec2(0.0), pk = vec2(0.0), plam = L.lam, pdLX = dLX, pdLY = dLY;
  vec4 pg = vec4(0.0, 0.0, -1.0, 0.0);
  bool phl = IX_HASLAM(L);
#if IX_ANC
  // near a saturation anchor: the shape's local model there, on the stable offset delta = z - p (SPEC 13.12)
  if (ixAncA >= 0) {
    int a = ixAncA;
    vec2 adz = cdiv(ixAncD, uAncAB.xy), alz = ixAncL - uAncLA;
    vec2 adLX = cmul(ixAncDL, ixDwX), adLY = cmul(ixAncDL, ixDwY);
    done = ixAnchorPx(a, adz, alz, dX, dY, adLX, adLY, s, n);
    vec4 PQ = uAnc[4 * a + 2], PL = uAnc[4 * a + 3];
    pv = PQ.xy + adz; pq = PQ.zw; pk = a == 0 ? uAncK.xy : uAncK.zw; phl = true;
    if (PL.z < -1e29) { plam = alz; pdLX = adLX; pdLY = adLY; }
    else {
      vec2 eps = cdiv(adz, PL.xy), zz = PL.xy + adz;
      vec2 l1 = cx_abs(eps) < 1e-4 ? eps - 0.5 * cmul(eps, eps) : clog(vec2(1.0, 0.0) + eps, CX_PI, 0.0);
      plam = PL.zw + l1;
      pdLX = cdiv(dX, zz); pdLY = cdiv(dY, zz);
      vec4 GA = uAncG[a];
      pg = vec4(l1 * (16.0 / TAU) + GA.xy, GA.zw);
    }
  }
#endif
  if (!done) ixShapePx(z, zf, dX, dY, L, dLX, dLY, s, n);
  bool bound = L.lvl < 1e30 && (L.lg.x != 0.0 || L.lg.y != 0.0);
  vec2 lgi = bound ? ixUnit(vec2(dot(L.lg, ixDwX), dot(L.lg, ixDwY))) : vec2(0.0);
  bool facing = bound && dot(n, lgi) < -0.5;
  float cv = clamp(facing ? min(s, 0.5) + min(L.lvl, 0.5) : min(s, L.lvl) + 0.5, 0.0, 1.0);
  float D = ixSheetKey(z, zf, L);
  cov = cv > 0.0;
  ixLastOk = true; ixLastFin = zf; ixLastD = D; ixLastZ = z;
  if (cov) {
    nCov++;
    U = max(U, cv);
    vec2 tz = zf ? z : (IX_HASLAM(L) ? 1e30 * vec2(cos(L.lam.y), sin(L.lam.y)) : vec2(0.0));
    // carg, not atan(y, x): ANGLE's Metal translation returns +pi/2 for atan(-1, -0.0), and a range gradient along the
    // pixel y axis has x = -0.0, so the two sides of a healed cut through pixel centres never merged (a half-covered
    // line; P2 app review)
    // (only a partial candidate can merge with a twin, and only with a partial entry: a full one keeps no angle)
    float ga = bound && zf && cv < 1.0 ? carg(lgi) : 100.0;
    ixAdmit(D, tz, cv, ga, cx_abs(dX) + cx_abs(dY), z, zf, dX, dY, L, pv, pq, pk, pg, phl, plam, pdLX, pdLY);
  }
  IX_RECORD(L, D, cov)
  return D;
}
`;
  // a globe program's pixel is anisotropic: the walk's range levels are converted to pixels along the footprint vectors
  // (GLChain's ixFoot under IX_ANISO; set by INV_MAIN(globe))
  const INV_GLOBE_PRE = '#define IX_ANISO 1\nvec2 ixAwX, ixAwY;\n';
  // B: compile-time buffer size; globe: Sphere view geometry (P3)
  const INV_MAIN = (globe) => `
${globe ? 'in vec3 vP; uniform vec3 uEye;' : ''}
void main() {
${globe ? `  vec3 P = normalize(vP);
  // S = 0, N = infinity, the conjugate lift's inverse w = (P.x - i P.y) / (1 - P.z); near the north pole w = 1 / u
  // with u = (P.x + i P.y) / (1 + P.z), no cancellation
  vec2 w = P.z <= 0.0 ? vec2(P.x, -P.y) / (1.0 - P.z) : cinv(P.xy / (1.0 + P.z));
  ixDwX = dFdx(w); ixDwY = dFdy(w);
  ixAwX = ixDwX; ixAwY = ixDwY;
  ixPix = sqrt(abs(ixDwX.x * ixDwY.y - ixDwX.y * ixDwY.x));` : `  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);
  ixDwX = vec2(uInvScale.x, 0.0); ixDwY = vec2(0.0, uInvScale.y);
  ixPix = uInvScale.x;`}
  nb = 0; nCov = 0; U = 0.0; ixTailInf = false; ixTr = 1.0; ixLastOk = false; ixLastFin = false; ixLastD = 0.0; ixLastZ = vec2(0.0);
  invWalk(w);
  float T = 1.0;
  vec3 C = vec3(0.0);
  for (int i = 0; i < IX_B; i++) {
    if (i >= nb || T < 1.0 / 255.0) break;
    float a = uAlpha * bC[i] / U;
    C += T * a * ixUnpack(bCol[i]);
    T *= 1.0 - a;
  }
  // behind the buffer: the covering candidates it did not keep (their exact transmittance ixTr, coloured with the
  // buffer's mean: they are not shaded), then the tail closure for infinitely many sheets beyond a truncated window
  if (nb > 0 && T >= 1.0 / 255.0 && (ixTr < 1.0 || ixTailInf)) {
    vec3 mc = vec3(0.0);
    for (int i = 0; i < IX_B; i++) { if (i >= nb) break; mc += ixUnpack(bCol[i]); }
    mc /= float(nb);
    C += T * (1.0 - ixTr) * mc; T *= ixTr;
    if (ixTailInf) { C += T * mc; T = 0.0; }
  }
${globe ? `  float a = U * (1.0 - T);
  if (!(a > 0.0)) { o = vec4(0.0); return; }
  vec3 v = normalize(uEye - vP);
  o = vec4(toSrgb(shade(toLin(U * C / a), P, v, 1.0)) * a, a);` : '  o = vec4(U * C, U * (1.0 - T));'}
}
`;
  // half-resolution passes (cost guard, motion frames): the half-size target, upscaled bilinearly over the pane
  const INV_UP_FS = `
uniform sampler2D uHalf; uniform vec4 uVp; uniform vec2 uHalfSz;
out vec4 o;
void main() { o = textureLod(uHalf, (gl_FragCoord.xy - uVp.xy) / uVp.zw * uHalfSz, 0.0); }
`;

  // ---------- landscape (spec 6.9) ----------
  const HEIGHT = `
uniform int uHMode; uniform float uH; uniform float uMu;
// (height, valid) of a value w; the same formulas as the JS heightOf
vec2 heightW(vec2 w) {
  bool nanx = isnan(w.x) || !(w.x < 0.0 || w.x >= 0.0), nany = isnan(w.y) || !(w.y < 0.0 || w.y >= 0.0);
  bool infv = (!nanx && abs(w.x) > 3e38) || (!nany && abs(w.y) > 3e38);
  float mu = uMu > 0.0 ? uMu : 1.0;
  // linear Re / Im (modes 4, 5): the stacked sheets of a covering surface keep their true pitch (atan made plateaus)
  if (uHMode == 4 || uHMode == 5) {
    float x = uHMode == 4 ? w.x : w.y;
    bool bad = uHMode == 4 ? nanx : nany;
    return vec2(uH * clamp(x / mu, -1.25, 1.25), bad ? 0.0 : 1.0);
  }
  if (uHMode == 2 || uHMode == 3) {
    float x = uHMode == 2 ? w.x : w.y;
    bool bad = uHMode == 2 ? nanx : nany;
    return vec2(uH * (2.0 / PI) * atan(clamp(x / mu, -1e30, 1e30)), bad ? 0.0 : 1.0);
  }
  bool bad = (nanx || nany) && !infv;
  float r = infv ? 3e38 : wabs(w);
  float v = uHMode == 1 ? (4.0 / PI) * atan(min(r / mu, 1e30)) - 1.0 : (2.0 / PI) * atan(log(clamp(r, 1e-37, 3e38)) / 1.4);
  return vec2(uH * v, bad ? 0.0 : 1.0);
}
`;
  const LAND_TF_VS = `
uniform int uN; uniform vec4 uBox;
out vec4 tfOut;
void main() {
  int i = gl_VertexID % uN, j = gl_VertexID / uN;
  vec2 uv = vec2(float(i), float(j)) / float(uN - 1);
  vec2 w = mapF(uBox.xy + uv * uBox.zw);
  vec2 hv = heightW(w);
  vec2 wc = vec2(isnan(w.x) ? 1.0 : clamp(w.x, -3e38, 3e38), isnan(w.y) ? 0.0 : clamp(w.y, -3e38, 3e38));
  tfOut = vec4(wc, hv.y > 0.5 ? hv.x : 0.0, hv.y);
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;
  // normals by central differences (one-sided across cliffs) and ambient occlusion from a 9x9 box filter
  const LAND_NRM_VS = `
uniform highp sampler2D uT1; uniform int uN; uniform vec2 uAspect; uniform float uH;
out vec4 tfOut;
vec4 T(ivec2 p) { return texelFetch(uT1, p, 0); }
void main() {
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  vec4 c = T(p);
  float h = c.z;
  float cl = 0.3 * uH;
  vec2 dw = 2.0 * uAspect / float(uN - 1);
  vec4 L = T(max(p - ivec2(1, 0), ivec2(0))), R = T(min(p + ivec2(1, 0), ivec2(uN - 1)));
  vec4 D = T(max(p - ivec2(0, 1), ivec2(0))), U = T(min(p + ivec2(0, 1), ivec2(uN - 1)));
  bool oL = p.x > 0 && L.w > 0.5 && abs(L.z - h) <= cl, oR = p.x < uN - 1 && R.w > 0.5 && abs(R.z - h) <= cl;
  bool oD = p.y > 0 && D.w > 0.5 && abs(D.z - h) <= cl, oU = p.y < uN - 1 && U.w > 0.5 && abs(U.z - h) <= cl;
  float sx = oL && oR ? (R.z - L.z) / (2.0 * dw.x) : (oR ? (R.z - h) / dw.x : (oL ? (h - L.z) / dw.x : 0.0));
  float sy = oD && oU ? (U.z - D.z) / (2.0 * dw.y) : (oU ? (U.z - h) / dw.y : (oD ? (h - D.z) / dw.y : 0.0));
  vec3 n = normalize(vec3(-sx, -sy, 1.0));
  float sum = 0.0, cnt = 0.0;
  for (int dy = -4; dy <= 4; dy++) for (int dx = -4; dx <= 4; dx++) {
    ivec2 q = p + ivec2(dx, dy);
    if (q.x < 0 || q.y < 0 || q.x >= uN || q.y >= uN) continue;
    vec4 t = T(q);
    if (t.w > 0.5) { sum += t.z; cnt += 1.0; }
  }
  float ao = cnt > 0.0 ? 1.0 - clamp(6.0 * (sum / cnt - h), 0.0, 0.4) : 1.0;
  tfOut = vec4(n, c.w > 0.5 ? ao : 1.0);
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;
  const LAND_VS = `
uniform highp sampler2D uT1; uniform highp sampler2D uT2;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP;
out vec2 vZ; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge;
vec4 T(ivec2 p) { return texelFetch(uT1, p, 0); }
bool inGrid(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < uN && p.y < uN; }
// a triangle is drawn unless a vertex is NaN or it spans a cliff (height difference > 0.3 H)
bool triOK(vec4 a, vec4 b, vec4 c) {
  return a.w > 0.5 && b.w > 0.5 && c.w > 0.5 && max(max(a.z, b.z), c.z) - min(min(a.z, b.z), c.z) <= 0.3 * uH;
}
void main() {
  int M = uN - 1;
  int tri = gl_InstanceID % 2, cell = gl_InstanceID / 2;
  ivec2 c = ivec2(cell % M, cell / M);
  ivec2 A = c, B = tri == 0 ? c + ivec2(1, 0) : c + ivec2(1, 1), C = tri == 0 ? c + ivec2(1, 1) : c + ivec2(0, 1);
  vec4 ta = T(A), tb = T(B), tc = T(C);
  if (!triOK(ta, tb, tc)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  // opposite vertices of the neighbours across the edges opposite A, B and C
  ivec2 o0 = tri == 0 ? c + ivec2(2, 1) : c + ivec2(1, 2);
  ivec2 o1 = tri == 0 ? c + ivec2(0, 1) : c + ivec2(-1, 0);
  ivec2 o2 = tri == 0 ? c + ivec2(0, -1) : c + ivec2(1, 0);
  vEdge = vec3(inGrid(o0) && !triOK(tb, tc, T(o0)) ? 1.0 : 0.0,
               inGrid(o1) && !triOK(tc, ta, T(o1)) ? 1.0 : 0.0,
               inGrid(o2) && !triOK(ta, tb, T(o2)) ? 1.0 : 0.0);
  int k = gl_VertexID;
  ivec2 V = k == 0 ? A : (k == 1 ? B : C);
  vec4 tv = k == 0 ? ta : (k == 1 ? tb : tc);
  vec4 nv = texelFetch(uT2, V, 0);
  vec2 uv = vec2(V) / float(M);
  vZ = uBox.xy + uv * uBox.zw;
  vPos = vec3((uv - 0.5) * 2.0 * uAspect, tv.z);
  vNor = nv.xyz; vAO = nv.w;
  vBary = k == 0 ? vec3(1.0, 0.0, 0.0) : (k == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  gl_Position = uMVP * vec4(vPos, 1.0);
}
`;
  // ---- All sheets: the Riemann surface of a map with multivalued steps (GLChain's chainSheet) ----
  // Every grid cell is evaluated with LOCAL cuts placed opposite its centre zc (chainSheetRange(zc, z, a, b, combo)), once
  // per sheet combination (combo < uSheetK), so no cut crosses a cell and the cells of all sheets join seamlessly.
  // Vertices are not shared between cells: the height texture holds a 2 x 2 block per cell (its corners), one tile
  // of 2M x 2M texels (M = uN - 1 cells per side) per combo, uTileC tiles per row. Texel: (height, valid, nx, ny)
  // with the normal from central differences of the height on the same sheet (nz > 0 follows).
  const LAND_SHEET_TF_VS = `
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform int uSheetA; uniform int uSheetB; uniform int uSheetK; uniform int uTileC; uniform int uTexW;
out vec4 tfOut;
void main() {
  int M = uN - 1, T = 2 * M;
  ivec2 p = ivec2(gl_VertexID % uTexW, gl_VertexID / uTexW);
  ivec2 tile = p / T, q = p - tile * T;
  int combo = tile.y * uTileC + tile.x;
  ivec2 cell = q / 2, cor = q - cell * 2;
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  if (combo >= uSheetK) { tfOut = vec4(0.0); return; }
  vec2 d = uBox.zw / float(M);
  vec2 zc = uBox.xy + (vec2(cell) + 0.5) * d;
  vec2 z = uBox.xy + vec2(cell + cor) * d;
  vec2 e = 0.25 * d;
  // one call site of the chain: the corner, then x + e, x - e, y + e, y - e
  float h[5]; float ok[5];
  for (int k = 0; k < 5; k++) {
    vec2 o = k == 0 ? vec2(0.0) : (k == 1 ? vec2(e.x, 0.0) : (k == 2 ? vec2(-e.x, 0.0) : (k == 3 ? vec2(0.0, e.y) : vec2(0.0, -e.y))));
    vec2 hv = heightW(chainSheetRange(zc, z + o, uSheetA, uSheetB, combo));
    h[k] = hv.x; ok[k] = hv.y;
  }
  float cl = 0.3 * uH;
  vec2 sw = 2.0 * uAspect / uBox.zw;   // world units per unit of z
  bool oR = ok[1] > 0.5 && abs(h[1] - h[0]) <= cl, oL = ok[2] > 0.5 && abs(h[2] - h[0]) <= cl;
  bool oU = ok[3] > 0.5 && abs(h[3] - h[0]) <= cl, oD = ok[4] > 0.5 && abs(h[4] - h[0]) <= cl;
  float sx = oL && oR ? (h[1] - h[2]) / (2.0 * e.x) : (oR ? (h[1] - h[0]) / e.x : (oL ? (h[0] - h[2]) / e.x : 0.0));
  float sy = oD && oU ? (h[3] - h[4]) / (2.0 * e.y) : (oU ? (h[3] - h[0]) / e.y : (oD ? (h[0] - h[4]) / e.y : 0.0));
  vec3 n = normalize(vec3(-sx / sw.x, -sy / sw.y, 1.0));
  tfOut = vec4(ok[0] > 0.5 ? h[0] : 0.0, ok[0], n.x, n.y);
}
`;
  // one instance per (combo, cell, triangle); a triangle is dropped where a corner is not finite or it spans a cliff
  // (a pole: height difference > 0.3 H). The fragment stage evaluates F on the same sheet with the same cuts.
  const LAND_SHEET_VS = `
uniform highp sampler2D uT1;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP; uniform int uTileC;
out vec2 vZ; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge; flat out vec2 vZc; flat out int vCombo;
void main() {
  int M = uN - 1, T = 2 * M, per = 2 * M * M;
  int combo = gl_InstanceID / per, r = gl_InstanceID - combo * per;
  int tri = r % 2, cell = r / 2;
  ivec2 c = ivec2(cell % M, cell / M);
  ivec2 base = ivec2(combo % uTileC, combo / uTileC) * T + 2 * c;
  ivec2 A = ivec2(0), B = tri == 0 ? ivec2(1, 0) : ivec2(1, 1), C = tri == 0 ? ivec2(1, 1) : ivec2(0, 1);
  vec4 ta = texelFetch(uT1, base + A, 0), tb = texelFetch(uT1, base + B, 0), tc = texelFetch(uT1, base + C, 0);
  if (!(ta.y > 0.5 && tb.y > 0.5 && tc.y > 0.5 && max(max(ta.x, tb.x), tc.x) - min(min(ta.x, tb.x), tc.x) <= 0.3 * uH)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  int k = gl_VertexID;
  ivec2 V = k == 0 ? A : (k == 1 ? B : C);
  vec4 tv = k == 0 ? ta : (k == 1 ? tb : tc);
  vec2 uv = vec2(c + V) / float(M);
  vZ = uBox.xy + uv * uBox.zw;
  vZc = uBox.xy + (vec2(c) + 0.5) / float(M) * uBox.zw;
  vCombo = combo;
  vPos = vec3((uv - 0.5) * 2.0 * uAspect, tv.x);
  vNor = vec3(tv.zw, sqrt(max(1.0 - dot(tv.zw, tv.zw), 0.0)));
  vAO = 1.0;
  vBary = k == 0 ? vec3(1.0, 0.0, 0.0) : (k == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vEdge = vec3(0.0);
  gl_Position = uMVP * vec4(vPos, 1.0);
}
`;
  const LAND_COMMON = `
uniform int uMaterial; uniform vec3 uPlaster; uniform vec3 uModLine; uniform vec3 uArgLine; uniform vec3 uFogCol; uniform float uSea;
uniform vec3 uEye; uniform float uFogNear; uniform float uFogFar;
vec3 albedo(vec2 w) {
  if (uMaterial == 2) return uPlaster;
  if (uMaterial == 1) return dcolor(w);
  return wheel(wang(w), 0.72);
}
vec3 fogged(vec3 lin, vec3 pos) { return mix(lin, toLin(uFogCol), 0.15 * smoothstep(uFogNear, uFogFar, length(uEye - pos))); }
`;
  // sheet: the covering surface (All sheets): F on the triangle's own sheet, with the cuts of its cell (chainSheet)
  const LAND_FS = (sheet) => `
in vec2 vZ; in vec3 vPos; in vec3 vNor; in float vAO; in vec3 vBary;
flat in vec3 vEdge;
uniform vec3 uCut; uniform vec3 uUnder; uniform vec4 uBox;
out vec4 o;
${sheet ? `flat in vec2 vZc; flat in int vCombo; uniform int uSheetA; uniform int uSheetB;
vec2 landW(vec2 z) { return chainSheetRange(vZc, z, uSheetA, uSheetB, vCombo); }` : 'vec2 landW(vec2 z) { return mapF(z); }'}
void main() {
  vec2 w = landW(vZ);              // colour from F at the interpolated z: contours stay crisp
  float r = wabs(w);
  float q = TAU / max(uSectors, 1.0);
  float lr = log(clamp(r, 1e-37, 3e38)), flr = fwidth(lr);
  float xm = lr / q, fm = flr / q;
  float xp = wang(w) / q, fp = argWidth(w) / q;
  vec3 fb = fwidth(vBary);
  vec3 alb = albedo(w);
  bool plaster = uMaterial == 2;
  vec3 a = toLin(alb);
  vec3 ml = toLin(uModLine);
  a = mix(a, ml, (plaster ? 0.65 : 0.40) * iso(xm, fm, 0.9) * dfade(fm));              // ln|F| = k 2pi/n
  a = mix(a, plaster ? ml : toLin(uArgLine), (plaster ? 0.25 : 0.30) * iso(xp, fp, 0.7) * dfade(fp));  // arg F = k 2pi/n
  float ds = abs(lr) / max(flr, 1e-6);                                                  // sea level |F| = 1
  a = mix(a, toLin(vec3(0.0431, 0.0667, 0.0784)), uSea * 0.35 * (1.0 - smoothstep(1.0, 2.0, ds)));
  a = mix(a, vec3(1.0), uSea * 0.90 * (1.0 - smoothstep(0.375, 1.375, ds)));
  vec3 eb = vBary / max(fb, vec3(1e-6));                                                // exposed cliff edges
  float cliff = max(max(vEdge.x * (1.0 - smoothstep(1.5 * uDpr - 0.5, 1.5 * uDpr + 0.5, eb.x)),
                        vEdge.y * (1.0 - smoothstep(1.5 * uDpr - 0.5, 1.5 * uDpr + 0.5, eb.y))),
                        vEdge.z * (1.0 - smoothstep(1.5 * uDpr - 0.5, 1.5 * uDpr + 0.5, eb.z)));
  a = mix(a, toLin(uCut), cliff);
  // the rim of the surface (the domain's edges at their heights): seen from the side it draws the profile
  vec2 uv = (vZ - uBox.xy) / uBox.zw;
  vec2 er = min(uv, 1.0 - uv) / max(fwidth(uv), vec2(1e-9));
  float rim = 1.0 - smoothstep(0.75 * uDpr - 0.5, 0.75 * uDpr + 0.5, min(er.x, er.y));
  // an open surface, seen from both sides: the underside (the camera below the sheet, by the triangle's winding)
  // is desaturated towards a cool grey and darker, its contours kept
  vec3 n = normalize(vNor);
  vec3 v = normalize(uEye - vPos);
  vec3 c;
  if (gl_FrontFacing) {
    a = mix(a, ml, 0.55 * rim);
    c = shade(a, n, v, vAO);
  } else {
    // a soft headlight instead of the rig (the key light never reaches the underside): facets turned to the viewer
    // brighter, so the shape still reads; contours and the sea level stay as darker / lighter lines
    float g = dot(a, vec3(0.2126, 0.7152, 0.0722));
    a = mix(mix(a, vec3(g), 0.75), toLin(uUnder), 0.3);   // a quarter of the hue left: the phase still reads
    a = mix(a, ml, 0.65 * rim);
    c = a * (0.38 + 0.34 * max(dot(-n, v), 0.0));
  }
  o = vec4(toSrgb(fogged(c, vPos)), 1.0);
}
`;
  const FLOOR_VS = `
uniform mat4 uMVP; uniform vec2 uExt; uniform float uFloorZ;
out vec3 vPos;
void main() {
  int k = gl_VertexID;
  vec2 c = vec2((k == 1 || k == 2 || k == 4) ? 1.0 : -1.0, (k == 2 || k == 4 || k == 5) ? 1.0 : -1.0);
  vPos = vec3(c * uExt, uFloorZ);
  gl_Position = uMVP * vec4(vPos, 1.0);
}
`;
  // graph-paper tiers with per-fragment scale (perspective); composited premultiplied over col
  const TIERS = `
uniform vec3 uMinor; uniform vec3 uMed; uniform vec3 uMajor;
vec4 tiersOver(vec2 p, vec4 col, float amul) {
  vec2 fw = max(fwidth(p), vec2(1e-30));
  float s = 1.0 / (max(fw.x, fw.y) * uDpr);           // CSS px per unit
  float d0 = pow(10.0, ceil(log(8.0 / s) / log(10.0)));
  for (int i = 0; i < 6; i++) {
    float m = i == 0 ? 0.5 : (i == 1 ? 1.0 : (i == 2 ? 5.0 : (i == 3 ? 10.0 : (i == 4 ? 50.0 : 100.0))));
    float st = d0 * m, px = st * s;
    vec2 dpx = abs(fract(p / st + 0.5) - 0.5) * st / fw;
    float cov = 1.0 - smoothstep(0.0, 1.0, min(dpx.x, dpx.y));
    float t = smoothstep(log(12.0), log(240.0), log(px));
    vec3 c = t < 0.5 ? mix(uMinor, uMed, 2.0 * t) : mix(uMed, uMajor, 2.0 * t - 1.0);
    col = mix(col, vec4(c, 1.0), cov * smoothstep(8.0, 20.0, px) * amul);
  }
  return col;
}
`;
  const FLOOR_FS = `
in vec3 vPos;
uniform vec2 uExt; uniform vec2 uAspect; uniform vec4 uBox; uniform float uFloorZ;
uniform vec3 uFloorCol; uniform vec3 uShadow; uniform float uShadowA; uniform float uPrint; uniform float uPlateA;
uniform highp sampler2D uT1; uniform int uN; uniform int uSheetK; uniform int uTileC;
out vec4 o;
void main() {
  vec2 uv = vPos.xy / (2.0 * uAspect) + 0.5;
  vec2 z = uBox.xy + uv * uBox.zw;
  vec2 w = mapF(z);
  vec3 alb = albedo(w);
  vec3 col = tiersOver(z, vec4(uFloorCol, 1.0), 1.0).rgb;
  vec3 lin = mix(toLin(col), toLin(alb), 0.10 * uPrint);         // phase portrait printed at 10%
  // contact shading under the surface: where the sheet comes close to the plate (no walls, nothing outside);
  // All sheets (uSheetK > 0): the lowest sheet over the point, from the per-cell height tiles
  float contact = 0.0;
  if (max(abs(vPos.x) - uAspect.x, abs(vPos.y) - uAspect.y) <= 0.0) {
    if (uSheetK > 0) {
      int M = uN - 1;
      ivec2 c = clamp(ivec2(uv * float(M)), ivec2(0), ivec2(M - 1));
      ivec2 q = 2 * c + clamp(ivec2(fract(uv * float(M)) * 2.0), ivec2(0), ivec2(1));
      for (int k = 0; k < 24; k++) {
        if (k >= uSheetK) break;
        vec4 t = texelFetch(uT1, ivec2(k % uTileC, k / uTileC) * 2 * M + q, 0);
        if (t.y > 0.5) contact = max(contact, exp(-(t.x - uFloorZ) / 0.12));
      }
    } else {
      ivec2 ij = clamp(ivec2(uv * float(uN - 1) + 0.5), ivec2(0), ivec2(uN - 1));
      vec4 t = texelFetch(uT1, ij, 0);
      contact = t.w > 0.5 ? exp(-(t.z - uFloorZ) / 0.12) : 0.0;
    }
  }
  lin = mix(lin, toLin(uShadow), clamp(0.7 * uShadowA * contact, 0.0, 1.0));
  vec2 e = (uExt - abs(vPos.xy)) / (0.12 * uExt);                // the outer 12% fades out
  float a = uPlateA * smoothstep(0.0, 1.0, min(e.x, e.y));
  o = vec4(toSrgb(fogged(lin, vPos)) * a, a);
}
`;
  const ULEVEL_VS = `
uniform mat4 uMVP; uniform vec2 uAspect; uniform float uZ;
out vec2 vC;
void main() {
  int k = gl_VertexID;
  vC = vec2((k == 1 || k == 2 || k == 4) ? 1.0 : -1.0, (k == 2 || k == 4 || k == 5) ? 1.0 : -1.0);
  gl_Position = uMVP * vec4(vC * uAspect, uZ, 1.0);
}
`;
  const ULEVEL_FS = `
in vec2 vC;
uniform vec3 uColor; uniform float uDpr;
out vec4 o;
void main() {
  vec2 e = (1.0 - abs(vC)) / max(fwidth(vC), vec2(1e-6));
  float edge = 1.0 - smoothstep(0.5 * uDpr - 0.5, 0.5 * uDpr + 0.5, min(e.x, e.y));
  float a = mix(0.05, 0.35, edge);
  o = vec4(uColor * a, a);
}
`;
  // probe needle (domain point -> surface point), evaluated on the GPU; sheet: one needle and ring per sheet
  // combination (instance), each with the cuts placed opposite the probe itself
  const PROBE_VS = (sheet) => `
uniform vec2 uProbe; uniform vec4 uBox; uniform vec2 uAspect; uniform float uFloorZ; uniform float uDpr;
${sheet ? 'uniform int uSheetA; uniform int uSheetB;' : ''}
${MARK_EMIT}
void main() {
  vec2 w = ${sheet ? 'chainSheetRange(uProbe, uProbe, uSheetA, uSheetB, gl_InstanceID)' : 'mapF(uProbe)'};
  vec2 hv = heightW(w);
  vec2 uv = (uProbe - uBox.xy) / uBox.zw;
  vec2 xy = (uv - 0.5) * 2.0 * uAspect;
  vec3 top = vec3(xy, hv.y > 0.5 ? hv.x : uFloorZ), bot = vec3(xy, uFloorZ);
  int part = gl_VertexID / 6, k = gl_VertexID % 6;
  if (part == 0) emitLine(uMVP * vec4(bot, 1.0), uMVP * vec4(top, 1.0), k, 0.5 * uDpr);
  else if (part == 1) emitSprite(uMVP * vec4(top, 1.0), k, 2.0, 3.0 * uDpr, 0.5 * uDpr);
  else emitSprite(uMVP * vec4(bot, 1.0), k, 1.0, 1.5 * uDpr, 0.0);
}
`;

  // ---------- Riemann sphere (spec 6.10) ----------
  const SPHERE_VS = `
layout(location = 5) in vec3 aPos3;
uniform mat4 uMVP;
out vec3 vP;
void main() { vP = aPos3; gl_Position = uMVP * vec4(aPos3, 1.0); }
`;
  // uNet (panels.md 9.5, P3b): the graticule is the snap net of the active tool. 0: the polar net (meridians every
  // 15 deg, parallels |z| = 1/8 ... 8), for Select and the round kinds; 1: the lifted Cartesian lattice in the plane's
  // own graph-paper tiers, for the Cartesian kinds; 2: the P3 graticule (meridians every 30 deg, |z| = 1/4 ... 4) of a
  // globe that takes no drawing (Morph open, solo, a focused stage), which panels.md 9.5 leaves as it was. The real
  // great circle and |z| = 1 are drawn in all three.
  const SPHERE_FS = (phase) => `
in vec3 vP;
uniform vec3 uPlaneCol; uniform vec3 uGridMaj; uniform vec3 uAxisCol; uniform vec3 uEye; uniform int uNet;
out vec4 o;
void main() {
  vec3 n = normalize(vP);
  float nz = clamp(n.z, -1.0, 1.0);
  float y = 0.5 * log2(max(1.0 + nz, 1e-12) / max(1.0 - nz, 1e-12));   // log2 |z|
  float fy = fwidth(y);
  float mk = uNet == 2 ? (6.0 / PI) : (12.0 / PI);
  float th = atan(n.y, n.x) * mk;
  float fa = argWidth(n.xy) * mk;
  float fny = fwidth(n.y);
  vec2 z = vec2(n.x, -n.y) / max(1.0 - nz, 1e-7);   // S = 0, N = infinity (the conjugate lift's inverse)
${phase ? `
  vec3 base = dcolor(mapF(z));` : `
  vec3 base = uPlaneCol;`}
  float mer = iso(th, fa, 1.0) * dfade(fa);                                        // meridians every 15 (30) deg
  float par = iso(y, fy, 1.0) * dfade(fy) * step(0.5, abs(y)) * step(abs(y), uNet == 2 ? 2.5 : 3.5);  // |z| = 1/8 (1/4) ... 8 (4)
  float net = max(mer, par);
  if (uNet == 1) net = tiersOver(z, vec4(0.0), 1.0).a;                             // the lifted lattice (coverage)
  float eq = iso0(y, fy, 1.5 * uDpr);                                              // |z| = 1
  float re = iso0(n.y, fny, 1.25 * uDpr);                                          // real great circle
${phase ? `
  vec3 ink = vec3(0.0431, 0.0667, 0.0784);
  vec3 col = mix(base, ink, 0.18 * net);
  col = mix(col, ink, 0.35 * re);
  col = mix(col, ink, 0.45 * eq);` : `
  vec3 col = mix(base, uGridMaj, net);
  col = mix(col, uAxisCol, 0.7 * re);
  col = mix(col, uAxisCol, eq);`}
  vec3 v = normalize(uEye - vP);
  o = vec4(toSrgb(shade(toLin(col), n, v, 1.0)), 1.0);
}
`;
  const DISC_VS = `
uniform mat4 uMVP; uniform float uR;
out vec3 vPos;
void main() {
  int k = gl_VertexID;
  vec2 c = vec2((k == 1 || k == 2 || k == 4) ? 1.0 : -1.0, (k == 2 || k == 4 || k == 5) ? 1.0 : -1.0);
  vPos = vec3(c * uR * 1.02, 0.0);
  gl_Position = uMVP * vec4(vPos, 1.0);
}
`;
  const DISC_FS = `
in vec3 vPos;
uniform float uR; uniform vec3 uPlaneCol; uniform vec3 uAxisCol;
out vec4 o;
void main() {
  vec2 p = vPos.xy;
  float r = length(p), fr = fwidth(r);
  vec2 fp = fwidth(p);
  vec4 col = vec4(uPlaneCol, 1.0) * 0.14;
  col = tiersOver(p, col, 0.55);
  col = mix(col, vec4(uAxisCol, 1.0), 0.5 * max(iso0(p.x, fp.x, uDpr), iso0(p.y, fp.y, uDpr)));
  col = mix(col, vec4(uAxisCol, 1.0), 0.4 * iso0(r - uR, fr, uDpr));
  float inside = clamp((uR - r) / max(fr, 1e-6) + 0.5 + 0.5 * uDpr, 0.0, 1.0);
  col *= inside * (1.0 - smoothstep(0.45 * uR, uR, r));          // the rim fades out: no hard edge at the frame
  if (col.a <= 0.002) discard;
  o = col;
}
`;

  // ---------------- program management ----------------
  const SAMPLER_UNITS = { uLut: 0, uW: 1, uT1: 2, uT2: 3, uNodes: 4, uPts: 4 };
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  // Starts compiling and linking. Nothing here waits for the driver: with KHR_parallel_shader_compile the work
  // runs in the background until finishLink reads the result.
  function startLink(e, vsSrc, fsSrc, tf) {
    const p = gl.createProgram();
    e.vs = shader(gl.VERTEX_SHADER, vsSrc); e.fs = shader(gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, e.vs); gl.attachShader(p, e.fs);
    if (tf) gl.transformFeedbackVaryings(p, ['tfOut'], gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    e.p = p;
  }
  // Reads the link status (blocks until the driver is done) and the uniform locations.
  function finishLink(e) {
    const p = e.p;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = (!gl.getShaderParameter(e.vs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.vs))
        || (!gl.getShaderParameter(e.fs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.fs)) || gl.getProgramInfoLog(p) || 'link failed';
      gl.deleteShader(e.vs); gl.deleteShader(e.fs); gl.deleteProgram(p);
      e.p = e.vs = e.fs = null;
      e.state = 'error'; e.error = String(log).trim();
      lastError = e.error;
      console.warn('shader', e.name, e.error);   // shown in the pane in plain words (frameStatus)
      return;
    }
    gl.deleteShader(e.vs); gl.deleteShader(e.fs); e.vs = e.fs = null;
    const loc = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    gl.useProgram(p);
    for (let i = 0; i < nu; i++) {
      const u = gl.getActiveUniform(p, i);
      const name = u.name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(p, u.name);
      if (name in SAMPLER_UNITS) gl.uniform1i(loc[name], SAMPLER_UNITS[name]);
    }
    e.loc = loc; e.state = 'ready';
  }
  const F_UTIL = UTIL + FADE;
  // chain: the program includes the chain (one per chain structure); the others compile once
  const DEFS = {
    region: { chain: true, vs: () => REGION_VS(false, 'chain'), fs: () => F_UTIL + REGION_FS(false) },
    regionC: { chain: false, vs: () => FIN + REGION_VS(false, 'tex'), fs: () => F_UTIL + REGION_FS(false) },
    region0: { chain: false, vs: () => FIN + REGION_VS(false, 'local'), fs: () => F_UTIL + REGION_FS(false) },
    regionS: { chain: true, vs: () => REGION_VS(true, 'chain'), fs: () => F_UTIL + SHADE + REGION_FS(true) },
    regionSC: { chain: false, vs: () => FIN + REGION_VS(true, 'tex'), fs: () => F_UTIL + SHADE + REGION_FS(true) },
    regionP: { chain: false, vs: () => PRE_VS(false), fs: () => F_UTIL + REGION_PRE_FS(false) },
    regionSP: { chain: false, vs: () => PRE_VS(true), fs: () => F_UTIL + SHADE + REGION_PRE_FS(true) },
    line: { chain: true, vs: () => LINE_VS('', 'chain'), fs: () => FADE + LINE_FS },
    lineC: { chain: false, vs: () => FIN + LINE_VS('', 'tex'), fs: () => FADE + LINE_FS },
    line0: { chain: false, vs: () => FIN + LINE_VS('', 'local'), fs: () => FADE + LINE_FS },
    lineS: { chain: true, vs: () => LINE_VS('S', 'chain'), fs: () => FADE + LINE_FS },
    lineSC: { chain: false, vs: () => FIN + LINE_VS('S', 'tex'), fs: () => FADE + LINE_FS },
    lineF: { chain: false, vs: () => FIN + LINE_VS('F', 'abs'), fs: () => FADE + LINE_FS },
    lineFM: { chain: true, vs: () => LINE_VS('F', 'chain'), fs: () => FADE + LINE_FS },
    lineFC: { chain: false, vs: () => FIN + LINE_VS('F', 'tex'), fs: () => FADE + LINE_FS },
    // the map cache passes: a point draw into the cache texture (rt), else transform feedback
    tfRegion: { chain: true, vs: () => TF_REGION_VS(rtOK), fs: () => (rtOK ? RT_FS : TF_FS), tf: 'rt' },
    tfLine: { chain: true, vs: () => TF_LINE_VS(rtOK), fs: () => (rtOK ? RT_FS : TF_FS), tf: 'rt' },
    // TEMP-DEBUG-HOOK (removed before publishing)
    evalPt: { chain: true, vs: () => EVAL_VS, fs: () => TF_FS, tf: true },
    // TEMP-DEBUG-HOOK
    grid: { chain: false, vs: () => QUAD_VS, fs: () => GRID_FS },
    color: { chain: true, vs: () => QUAD_VS, fs: () => UTIL + DCOLOR + COLORPLOT_FS },
    cauchy: { chain: false, vs: () => QUAD_VS, fs: () => UTIL + DCOLOR + CAUCHY_FS },
    pre: { chain: true, vs: () => QUAD_VS, fs: () => PRE_FS('') },
    preS: { chain: true, vs: () => SPHERE_VS, fs: () => PRE_FS('', true) },
    landTF: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_TF_VS, fs: () => TF_FS, tf: true },
    landNrm: { chain: false, vs: () => LAND_NRM_VS, fs: () => TF_FS, tf: true },
    land: { chain: true, vs: () => LAND_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + LAND_FS(false) },
    floor: { chain: true, vs: () => FLOOR_VS, fs: () => UTIL + DCOLOR + LAND_COMMON + TIERS + FLOOR_FS },
    ulevel: { chain: false, vs: () => ULEVEL_VS, fs: () => ULEVEL_FS },
    probe: { chain: true, vs: () => UTIL_V + HEIGHT + PROBE_VS(false), fs: () => MARK_FS },
    // All sheets (only for chains whose source has chainSheetRange: see sheetPlan)
    landSheetTF: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_SHEET_TF_VS, fs: () => TF_FS, tf: true },
    landSheet: { chain: true, vs: () => LAND_SHEET_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + LAND_FS(true) },
    probeSheet: { chain: true, vs: () => UTIL_V + HEIGHT + PROBE_VS(true), fs: () => MARK_FS },
    mark: { chain: false, vs: () => MARK_VS, fs: () => MARK_FS },
    sphere: { chain: false, vs: () => SPHERE_VS, fs: () => UTIL + DCOLOR + SHADE + TIERS + SPHERE_FS(false) },
    sphereP: { chain: true, vs: () => SPHERE_VS, fs: () => UTIL + DCOLOR + SHADE + TIERS + SPHERE_FS(true) },
    disc: { chain: false, vs: () => DISC_VS, fs: () => UTIL + 'uniform float uDpr;\n' + TIERS + DISC_FS },
    invUp: { chain: false, vs: () => QUAD_VS, fs: () => INV_UP_FS },
  };
  // vertex-stage subset of UTIL (no derivatives)
  const UTIL_V = `
float wabs(vec2 w) {
  float m = max(abs(w.x), abs(w.y));
  if (!(m > 0.0)) return 0.0;
  if (m > 1e18 || m < 1e-18) return m * length(w / m);
  return length(w);
}
`;
  // A stage gets the chain library only when it calls into it (the fragment stages of the map-cache, region and line
  // programs do not), so each added step compiles about half the GLSL it used to (spec 8.7); a stage whose only use
  // is cfin gets FIN.
  let libRe = null;
  function libUse(src) {
    if (!libRe) {
      const L = typeof GLChain !== 'undefined' ? GLChain.LIB : '';
      const ids = new Set(['mapPoint', 'mapF', 'chainStep', 'chainRange', 'chainHom', 'chainHomAll', 'chainStage', 'chainIsDeriv', 'chainSheet', 'chainSheetRange', 'derivIn', 'uChain', 'uMode', 'uA', 'uB', 'uHi', 'uT', 'uBase', 'uPost', 'postOf', 'uSheetW', 'uDeriv']);
      for (const m of L.matchAll(/\b(?:vec[234]|float|int|bool|void|mat[234])\s+(\w+)\s*\(/g)) ids.add(m[1]);
      for (const m of L.matchAll(/#define\s+(\w+)/g)) ids.add(m[1]);
      ids.delete('cfin');
      libRe = new RegExp('\\b(?:' + [...ids].join('|') + '|cxs\\d+_\\w+)\\b');
    }
    return libRe.test(src) ? 2 : /\bcfin\b/.test(src) ? 1 : 0;
  }
  function sources(name, ch) {
    const d = DEFS[name];
    const vs = d.vs(), fs = d.fs();
    if (!d.chain) return [HEAD + vs, HEAD + fs];
    const lib = (typeof GLChain !== 'undefined' ? GLChain.LIB : '') + '\n' + ch.info.source + MAP(ch.info);
    const pre = (s) => ['', FIN, lib][libUse(s)];
    return [HEAD + pre(vs) + vs, HEAD + pre(fs) + fs];
  }
  // shader limits are reported in plain words in the pane (spec 8.6)
  function friendly(err) {
    if (/uniform/i.test(err)) return $t('This chain needs more shader parameters than this GPU allows. Remove or shorten a step.');
    return $t('The GPU could not compile this chain ({err}).', { err: String(err).split('\n')[0].slice(0, 90) });
  }
  let useClock = 0, pollT = 0;
  const PROG_KEEP = 3;   // chain versions kept per program (undo, redo and bypass toggles reuse them)
  // The program `name` for chain version ch (null for programs without the chain); start: begin compiling if needed.
  // Returns the program once it is ready, else null.
  function getProg(name, ch, start) {
    const d = DEFS[name];
    if (!d) throw new Error('unknown program ' + name);
    if (d.chain && !(ch && ch.info)) return null;
    const key = d.chain ? ch.key : 'static';
    const id = name + '|' + key;
    let e = progs.get(id);
    if (!e) {
      if (!start) return null;
      e = { name, key, chain: !!d.chain, ch: d.chain ? ch : null, state: 'pending', used: ++useClock, side: !!(sideMode && d.chain) };
      progs.set(id, e);
      e.rt = d.tf === 'rt' && rtOK;
      try { const [vs, fs] = sources(name, ch); startLink(e, vs, fs, d.tf === 'rt' ? !rtOK : d.tf); } catch (err) { e.state = 'error'; e.error = String(err.message || err); lastError = e.error; }
      if (d.chain) evictProgs(name);
    }
    e.used = ++useClock;
    if (d.chain) e.ch = ch;
    if (!sideMode) e.side = false;   // a side chain's program that the current chain now uses (an example loaded)
    if (e.state === 'pending') {
      // programs without the chain compile once at start-up; syncDepth (tests) waits as well
      if (!pcExt || !d.chain || syncDepth > 0) finishLink(e);
      else if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && canFinish(e)) finishLink(e);
      else schedulePoll();
    }
    return e.state === 'ready' ? e : null;
  }
  // Static programs started ahead of their first use, in the background (KHR_parallel_shader_compile): getProg links
  // a static program synchronously at its first use, so the first frame of a view paid for all of its programs. The
  // globes' (sphere, regionSC, lineSC, disc, mark) held the first frame after a switch to Sphere for 35-45 ms of main
  // thread, over 50 with the stage-0 inverse pass's start (P3 review). The app calls this when a switch to Sphere is
  // coming (the pointer over a Sphere control, or the switch itself, a frame ahead of its draw): the links run in
  // parallel, and the first use reads a finished one or waits for the slowest only. -> the number started
  function prestart(names) {
    if (!ok || lost || !pcExt) return 0;
    let n = 0;
    for (const name of names) {
      const d = DEFS[name], id = name + '|static';
      if (!d || d.chain || progs.has(id)) continue;
      const e = { name, key: 'static', chain: false, ch: null, state: 'pending', used: ++useClock, side: false };
      progs.set(id, e);
      e.rt = d.tf === 'rt' && rtOK;
      try { const [vs, fs] = sources(name, null); startLink(e, vs, fs, d.tf === 'rt' ? !rtOK : d.tf); n++; } catch (err) { e.state = 'error'; e.error = String(err.message || err); lastError = e.error; }
    }
    // finished by the poll when their links land (or at their first use, whichever comes first)
    if (n) schedulePoll();
    return n;
  }
  // A chain program whose background compile has landed is taken into use at most one per FRESH_MS while an earlier
  // version stands in (always for side chains): ANGLE completes a program's Metal side when it is first drawn, and
  // several of those in one frame held the GPU process, and so every frame on the page, for 100-250 ms (spec 8.7).
  const FRESH_MS = 48;
  let freshT = -1e9;
  function canFinish(e) {
    const now = performance.now();
    if (now - freshT < FRESH_MS && (e.side || hist.some((h) => { const q = progs.get(e.name + '|' + h.key); return q && q.state === 'ready'; }))) return false;
    freshT = now;
    return true;
  }
  // side chains keep their own programs (SIDE_KEEP per program name) and never evict the current chain's history
  const SIDE_KEEP = 12;
  function evictProgs(name) {
    const list = [...progs.values()].filter((e) => e.name === name && e.chain && e.key !== cur.key && e.side === sideMode && !(sideMode && side && e.key === side.cur.key));
    list.sort((a, b) => a.used - b.used);
    for (let i = 0; i < list.length - ((sideMode ? SIDE_KEEP : PROG_KEEP) - 1); i++) {
      const e = list[i];
      if (e.p) gl.deleteProgram(e.p);
      if (e.vs) gl.deleteShader(e.vs);
      if (e.fs) gl.deleteShader(e.fs);
      progs.delete(e.name + '|' + e.key);
    }
  }
  function schedulePoll() { if (!pollT) pollT = setTimeout(pollCompiles, 16); }
  function pollCompiles() {
    pollT = 0;
    if (!gl || lost) return;
    let main = false, sided = false, waiting = false;
    for (const e of progs.values()) {
      if (e.state !== 'pending') continue;
      if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && (e.inv || canFinish(e))) { (e.inv ? finishInv : finishLink)(e); if (e.side) sided = true; else main = true; } else waiting = true;
    }
    if (waiting) schedulePoll();
    // which draws can now redraw: main (the current chain and its history), side (side chains)
    if ((main || sided) && api.onReady) api.onReady({ main, side: sided });
  }
  // The program `name` for the current chain. While it compiles in the background, the newest earlier chain version
  // whose program is ready draws instead (use() maps the map spec onto that version), so a frame never waits for a
  // compile; null when nothing can draw: frameErr says why for a failed compile, framePending for one in flight.
  function program(name) {
    const P = getProg(name, cur, true);
    if (P) return P;
    const e = progs.get(name + '|' + (DEFS[name].chain ? cur.key : 'static'));
    if (e && e.state === 'error') { frameErr = friendly(e.error); return null; }
    if (!DEFS[name].chain || !cur.info) return null;
    framePending = true;
    if (sideMode) return null;   // a side chain draws only with its own programs
    for (const h of hist) { const Q = getProg(name, h, false); if (Q) return Q; }
    return null;
  }
  // a map spec of the current chain, applied to an earlier version ch: steps before the first structural change are
  // shared; a homotopy or morph through a changed step shows its start
  function mapFor(map, ch) {
    if (!map || !ch || ch === cur) return map;
    const a = ch.sigs, b = cur.sigs;
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    const mode = map.mode || 0;
    // (v16: a changed step inside the post: the start of the bracketed part, from the source plane)
    if ((mode === 1 || mode === 3) && (map.post || 0) >= p + 1) { const lo = mode === 1 ? (map.hi || 0) - 1 : (map.a || 0); return { mode: 0, a: map.base || 0, b: Math.min(lo, p) }; }
    if (mode === 1 && (map.hi || 0) > p) return { mode: 0, a: map.base || 0, b: (map.hi || 0) - 1 };
    if ((mode === 2 || mode === 3) && (map.b || 0) > p) return { mode: 0, a: map.base || 0, b: map.a || 0 };
    return map;
  }
  const LIVE = (sig) => sig !== 'off' && sig !== 'err' && sig !== 'unsupported';
  // true when no step that the map applies acts on the GPU (the chain skips the others): drawn without the chain
  function isIdent(map) {
    if (!cur.info) return true;
    const m = map || {}, mode = m.mode || 0;
    const lo = mode === 0 ? (m.a || 0) + 1 : (m.base || 0) + 1, hi = Math.max(mode === 1 ? (m.hi || 0) : (m.b || 0), mode === 1 || mode === 3 ? (m.post || 0) : 0);
    for (let k = Math.max(1, lo); k <= Math.min(hi, cur.sigs.length); k++) if (LIVE(cur.sigs[k - 1])) return false;
    return true;
  }
  // uniform helpers (missing uniforms are optimised away: location null is a no-op)
  const L_ = (P, n) => P.loc[n] ?? null;
  const u1f = (P, n, v) => gl.uniform1f(L_(P, n), v);
  const u1i = (P, n, v) => gl.uniform1i(L_(P, n), v);
  const u2f = (P, n, a, b) => gl.uniform2f(L_(P, n), a, b);
  const u3 = (P, n, v) => gl.uniform3f(L_(P, n), v[0], v[1], v[2]);
  const u4f = (P, n, a, b, c, d) => gl.uniform4f(L_(P, n), a, b, c, d);
  const uM4 = (P, n, m) => gl.uniformMatrix4fv(L_(P, n), false, m);
  function use(P, map) {
    gl.useProgram(P.p);
    if (P.chain) {
      if (P.loc.uChain) gl.uniform4fv(P.loc.uChain, P.ch.data);
      const m = mapFor(map, P.ch) || {};
      u1i(P, 'uMode', m.mode || 0); u1i(P, 'uA', m.a || 0); u1i(P, 'uB', m.b || 0); u1i(P, 'uHi', m.hi || 0); u1f(P, 'uT', m.t || 0); u1i(P, 'uBase', m.base || 0); u1i(P, 'uPost', m.post || 0);
    }
    if (P.loc.uLut) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lut()); }
  }
  // a float64 value as a float32 pair (hi + lo)
  const hi32 = Math.fround;
  // origin uniforms of a resource: O as hi/lo
  function originUniforms(P, org) {
    const ox = org ? org[0] : 0, oy = org ? org[1] : 0;
    u2f(P, 'uOrgHi', hi32(ox), hi32(oy)); u2f(P, 'uOrgLo', ox - hi32(ox), oy - hi32(oy));
  }
  const mapKeyOf = (m) => (m ? `${m.mode || 0},${m.a || 0},${m.b || 0},${m.hi || 0},${m.t || 0},${m.base || 0},${m.post || 0}` : '0');

  // ---------------- phase LUT: 256 x 32 RGBA8, oklch(L, min(0.13, 0.97 Cmax(L, h)), h), h = 29 deg + arg ----------------
  const LUT_W = 256, LUT_H = 32;
  let lutData = null, lutTex = null;
  function oklabLin(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const enc1 = (x) => { x = clamp(x, 0, 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
  const inGamut = (c) => c[0] >= -1e-7 && c[1] >= -1e-7 && c[2] >= -1e-7 && c[0] <= 1 + 1e-7 && c[1] <= 1 + 1e-7 && c[2] <= 1 + 1e-7;
  function cmax(L, h) {
    const ca = Math.cos(h), sa = Math.sin(h);
    let lo = 0, hi = 0.37;
    for (let i = 0; i < 24; i++) { const m = 0.5 * (lo + hi); if (inGamut(oklabLin(L, m * ca, m * sa))) lo = m; else hi = m; }
    return lo;
  }
  function lutBytes() {
    if (lutData) return lutData;
    const d = new Uint8Array(LUT_W * LUT_H * 4);
    const h0 = 29 * Math.PI / 180;
    for (let j = 0; j < LUT_H; j++) {
      const L = 0.05 + 0.93 * j / (LUT_H - 1);
      for (let i = 0; i < LUT_W; i++) {
        const h = h0 + 2 * Math.PI * (i + 0.5) / LUT_W;
        const C = Math.min(0.13, 0.97 * cmax(L, h));
        const c = oklabLin(L, C * Math.cos(h), C * Math.sin(h));
        const o = 4 * (j * LUT_W + i);
        d[o] = Math.round(enc1(c[0]) * 255); d[o + 1] = Math.round(enc1(c[1]) * 255); d[o + 2] = Math.round(enc1(c[2]) * 255); d[o + 3] = 255;
      }
    }
    return (lutData = d);
  }
  function lut() {
    if (lutTex) return lutTex;
    lutTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, LUT_W, LUT_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutBytes());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return lutTex;
  }
  // JS mirror of wheel(arg, L) (same texels, bilinear), for legends and readout swatches: sRGB floats
  function phaseRGB(arg, L) {
    const d = lutBytes();
    const u = (((arg / (2 * Math.PI)) % 1) + 1) % 1 * LUT_W - 0.5;
    const v = clamp((L - 0.05) / 0.93, 0, 1) * (LUT_H - 1);
    const i0 = Math.floor(u), fu = u - i0, j0 = Math.min(LUT_H - 2, Math.floor(v)), fv = v - j0;
    const at = (i, j, k) => d[4 * (j * LUT_W + ((i % LUT_W) + LUT_W) % LUT_W) + k] / 255;
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = at(i0, j0, k) * (1 - fu) + at(i0 + 1, j0, k) * fu, b = at(i0, j0 + 1, k) * (1 - fu) + at(i0 + 1, j0 + 1, k) * fu;
      out[k] = a * (1 - fv) + b * fv;
    }
    return out;
  }

  // ---------------- geometry templates ----------------
  const tplCache = new Map();
  function makeBuf(data, usage) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    return buf;
  }
  // Region template for L: lattice points (i, j), i + j <= L, then the L^2 sub-triangle centroids.
  // Draw records: 3 corners (bary), corner k, -, then the template point indices of the corners and centroid.
  function regionTemplate(L) {
    const key = 'r' + L;
    if (tplCache.has(key)) return tplCache.get(key);
    const idx = new Map();
    const pts = [];
    for (let i = 0; i <= L; i++) for (let j = 0; i + j <= L; j++) { idx.set(i * (L + 1) + j, pts.length / 2); pts.push(i / L, j / L); }
    const V = pts.length / 2;
    const tris = [];
    for (let i = 0; i < L; i++) for (let j = 0; i + j < L; j++) {
      tris.push([[i, j], [i + 1, j], [i, j + 1]]);
      if (i + j < L - 1) tris.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]);
    }
    const data = [];
    tris.forEach((t, ti) => {
      const id = t.map(([i, j]) => idx.get(i * (L + 1) + j));
      const b = t.map(([i, j]) => [i / L, j / L]);
      pts.push((b[0][0] + b[1][0] + b[2][0]) / 3, (b[0][1] + b[1][1] + b[2][1]) / 3);
      for (let k = 0; k < 3; k++) data.push(b[0][0], b[0][1], b[1][0], b[1][1], b[2][0], b[2][1], k, 0, id[0], id[1], id[2], V + ti);
    });
    const t = { buf: makeBuf(new Float32Array(data)), count: data.length / 12, P: pts.length / 2, pts: makeBuf(new Float32Array(pts)) };
    tplCache.set(key, t);
    return t;
  }
  // Line template for M pieces: points t = k / M (k = 0..M) then midpoints (k + 1/2) / M.
  function lineTemplate(M) {
    const key = 'l' + M;
    if (tplCache.has(key)) return tplCache.get(key);
    const data = [], pts = [];
    for (let k = 0; k <= M; k++) pts.push(k / M, 0);
    for (let k = 0; k < M; k++) pts.push((k + 0.5) / M, 0);
    for (let k = 0; k < M; k++) {
      const t0 = k / M, t1 = (k + 1) / M;
      const v = (e, s) => data.push(t0, t1, e, s, k, k + 1, M + 1 + k, 0);
      v(0, -1); v(1, -1); v(1, 1); v(0, -1); v(1, 1); v(0, 1);
    }
    const t = { buf: makeBuf(new Float32Array(data)), count: data.length / 8, P: pts.length / 2, pts: makeBuf(new Float32Array(pts)) };
    tplCache.set(key, t);
    return t;
  }

  // ---------------- resources ----------------
  // Region mesh: instances = Float32Array [ax,ay,bx,by,cx,cy] per triangle, relative to instances.origin (or
  // origin, float64 [x, y]; default 0)
  let skipIds = 0;
  function createMesh(instances, origin) {
    const buf = makeBuf(instances);
    const n = instances.length / 6;
    const org = origin || instances.origin || [0, 0];
    const res = { kind: 'mesh', buf, n, org: [org[0], org[1]], vaos: new Map(), skips: [], tf: null };
    res.skip0 = createSkip(res);
    live.add(res);
    return res;
  }
  // Per-triangle skip flags (1 = do not draw); a mesh can have several, one per view that refines it.
  function createSkip(res, flags) {
    const buf = makeBuf(flags || new Float32Array(res.n), gl.DYNAMIC_DRAW);
    const sk = { buf, id: ++skipIds };
    res.skips.push(sk);
    return sk;
  }
  function setSkip(skip, flags) {
    gl.bindBuffer(gl.ARRAY_BUFFER, skip.buf);
    gl.bufferData(gl.ARRAY_BUFFER, flags, gl.DYNAMIC_DRAW);
  }
  function attrib(loc, size, stride, off, div) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
    gl.vertexAttribDivisor(loc, div);
  }
  function meshVAO(res, L, skip) {
    skip = skip || res.skip0;
    const key = 'd' + L + '|' + skip.id;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = regionTemplate(L);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.buf);
    attrib(0, 4, 48, 0, 0); attrib(1, 4, 48, 16, 0); attrib(6, 4, 48, 32, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 24, 0, 1); attrib(3, 2, 24, 16, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, skip.buf);
    attrib(4, 1, 4, 0, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  function meshTFVAO(res, L) {
    const key = 't' + L;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = regionTemplate(L);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.pts);
    attrib(0, 2, 8, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 24, 0, 1); attrib(3, 2, 24, 16, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  // Lines: list of Float64Array/arrays of source points (x0,y0,x1,y1,...); consecutive points become segments.
  // Per segment: P0.xy, P1.xy, the instance offsets of the previous and next segment of the same polyline
  // (0 = none; a closed polyline wraps), then the previous segment's start and the next segment's end: the draw
  // uses them to mitre the joins between pieces. Points are stored relative to origin (float64 [x, y]; default:
  // the centre of the points' bounding box).
  const LSTRIDE = 10;
  function createLines(polys, origin) {
    let n = 0;
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const p of polys) {
      n += Math.max(0, p.length / 2 - 1);
      if (!origin) for (let i = 0; i + 1 < p.length; i += 2) if (Number.isFinite(p[i]) && Number.isFinite(p[i + 1])) { bx0 = Math.min(bx0, p[i]); bx1 = Math.max(bx1, p[i]); by0 = Math.min(by0, p[i + 1]); by1 = Math.max(by1, p[i + 1]); }
    }
    const org = origin || (bx1 >= bx0 ? [(bx0 + bx1) / 2, (by0 + by1) / 2] : [0, 0]);
    const ox = org[0], oy = org[1];
    const data = new Float32Array(n * LSTRIDE);
    let o = 0;
    for (const p of polys) {
      const m = Math.max(0, p.length / 2 - 1);
      if (!m) continue;
      const L = p.length;
      const closed = m > 1 && Math.abs(p[0] - p[L - 2]) <= 1e-12 * (1 + Math.abs(p[0])) && Math.abs(p[1] - p[L - 1]) <= 1e-12 * (1 + Math.abs(p[1]));
      for (let j = 0, i = 0; j < m; j++, i += 2) {
        const hp = j > 0 || closed, hn = j < m - 1 || closed;
        const ip = j > 0 ? i - 2 : L - 4, in_ = j < m - 1 ? i + 4 : 2;     // previous start, next end
        data[o++] = p[i] - ox; data[o++] = p[i + 1] - oy; data[o++] = p[i + 2] - ox; data[o++] = p[i + 3] - oy;
        data[o++] = j > 0 ? -1 : (closed ? m - 1 : 0);
        data[o++] = j < m - 1 ? 1 : (closed ? -(m - 1) : 0);
        data[o++] = (hp ? p[ip] : p[i]) - ox; data[o++] = (hp ? p[ip + 1] : p[i + 1]) - oy;
        data[o++] = (hn ? p[in_] : p[i + 2]) - ox; data[o++] = (hn ? p[in_ + 1] : p[i + 3]) - oy;
      }
    }
    const res = { kind: 'lines', buf: makeBuf(data), n, org: [ox, oy], vaos: new Map(), tf: null, arcs: new Map() };
    live.add(res);
    return res;
  }
  function lineVAO(res, M) {
    const key = 'd' + M;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = lineTemplate(M);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.buf);
    attrib(0, 4, 32, 0, 0); attrib(6, 4, 32, 16, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 4 * LSTRIDE, 0, 1); attrib(10, 2, 4 * LSTRIDE, 16, 1); attrib(11, 4, 4 * LSTRIDE, 24, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  function lineTFVAO(res, M) {
    const key = 't' + M;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = lineTemplate(M);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.pts);
    attrib(0, 2, 8, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 4 * LSTRIDE, 0, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  // (v16.1) frees the entries of res evaluated under the app key cacheKey, at every template size: the forward stand-in
  // a shape drew while its inverse program compiled, once the inverse pass draws it. Nothing looks that evaluation up
  // again unless the shape falls back to forward, which evaluates it anew (gate v16: sphere.logUHP kept 1.2 MB)
  function dropCached(res, cacheKey) {
    if (!res || !res.tf || !cacheKey) return 0;
    let n = 0;
    for (const e of [...res.tf.values()]) if (e.ck === cacheKey) { freeEntry(e); n++; }
    return n;
  }
  function freeCache(res) {
    if (res.tf) for (const e of [...res.tf.values()]) freeEntry(e);
    res.tf = null;
    if (res.tmp && gl) for (const e of res.tmp.values()) freeTmp(e);
    res.tmp = null;
  }
  // ---- pre-mapped meshes (SPEC 8.7): their own GPU budget (32 MB, least recently drawn first; preBytes), apart from
  // the map cache's cacheBytes: they cannot be recreated from GPU state (the app re-uploads an evicted one from its
  // published CPU data, res.n === 0). The app keeps one mesh per slot (shape, role, view kind) at rest, so the budget
  // only bounds transients (a stand-in next to its rebuild, an export's mesh while the figure draws)
  const PRE_BYTES = 32 * 1024 * 1024;
  let preBytes = 0;
  const preAll = new Map();   // res -> true, least recently drawn first
  // d: SphereMesh.publish() -> res {kind: 'pre', n (triangles), count (vertices), sph, org}
  function createPreMesh(d) {
    if (!ok || !d || !d.n) return null;
    const sph = !!d.pos3, pc = sph ? 3 : 2, stride = pc + 5, n = d.n;
    const data = new Float32Array(n * 3 * stride);
    for (let t = 0; t < n; t++) for (let j = 0; j < 3; j++) {
      const o = (t * 3 + j) * stride;
      if (sph) { data[o] = d.pos3[t * 9 + 3 * j]; data[o + 1] = d.pos3[t * 9 + 3 * j + 1]; data[o + 2] = d.pos3[t * 9 + 3 * j + 2]; }
      else { data[o] = d.pos[t * 6 + 2 * j]; data[o + 1] = d.pos[t * 6 + 2 * j + 1]; }
      const a = t * 12 + 4 * j;
      data[o + pc] = d.attr[a]; data[o + pc + 1] = d.attr[a + 1]; data[o + pc + 2] = d.attr[a + 2]; data[o + pc + 3] = d.attr[a + 3];
      data[o + pc + 4] = d.tri[t];
    }
    const buf = makeBuf(data);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    attrib(0, pc, stride * 4, 0, 0); attrib(1, 4, stride * 4, pc * 4, 0); attrib(2, 1, stride * 4, (pc + 4) * 4, 0);
    gl.bindVertexArray(null);
    const res = { kind: 'pre', buf, vao, n, count: 3 * n, sph, org: (d.origin || [0, 0]).slice(), bytes: data.byteLength, vaos: new Map(), skips: [] };
    preAll.set(res, true); preBytes += res.bytes;
    for (const [r] of preAll) { if (preBytes <= PRE_BYTES) break; if (r !== res) destroy(r); }
    return res;
  }
  // st: {view, dpr, color, color2, edge, ink, alpha, pattern, cell, lines, sphN, stretch, sphere: {MVP, eye},
  //      scissor [x, y, w, h] (device px of the pane, bottom-left origin),
  //      key: {win, R, rs, sing} (flat: the inverse path's sheet key, SPEC 5; null: the leaf order alone)}
  // With a key the front sheet is chosen per sample (PRE_KEY): one pass in the mesh's far-to-near order with the depth
  // test (LEQUAL, depth written), so the sample's nearest key is drawn last, over the layers drawn before it; a layer
  // the leaf order draws after a nearer one (only where the leaf order and the key disagree) is left out (alpha < 1).
  // (A depth-only pre-pass and separate passes for the layers behind and the front, which keep those layers, drew the
  // mesh three times: gl_FragDepth turns early depth tests off, and exp(exp z)(H)'s settle frames jank by 20 ms.)
  function drawPreMapped(res, st) {
    if (!ok || !res || !res.n) return;
    const sph = !!st.sphere;
    const P = program(sph ? 'regionSP' : 'regionP');
    if (!P) return;
    preAll.delete(res); preAll.set(res, true);
    use(P);
    if (sph) {
      uM4(P, 'uMVP', st.sphere.MVP);
      u3(P, 'uEye', st.sphere.eye);
      lightUniforms(P, sceneLight || defaultLight(false), 0.18, 40, 0.12);
    } else {
      const v = st.view, dpr = st.dpr || 1;
      u2f(P, 'uRel', v.cx - res.org[0], v.cy - res.org[1]);
      u2f(P, 'uScale', 2 * v.s * dpr / fw, 2 * v.s * dpr / fh);
    }
    // (origin [0, 0]: uQ = 0, the attributes are already reduced; the pattern origin is 0)
    regionUniforms(P, Object.assign({}, st, { fade: null }), [0, 0]);
    const sc = st.scissor;
    const scOn = sc ? gl.isEnabled(gl.SCISSOR_TEST) : false, prevSc = sc && scOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
    if (sc) {
      let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
      if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
      if (x1 <= x0 || y1 <= y0) return;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
    }
    // (the default framebuffer has a depth buffer; any other target draws in the leaf order)
    const k = !sph && st.key && st.key.win && gl.getParameter(gl.FRAMEBUFFER_BINDING) === null ? st.key : null;
    u1i(P, 'uKeyOn', k ? 1 : 0);
    gl.bindVertexArray(res.vao);
    if (k) {
      const w = k.win, sing = (k.sing || []).slice(0, 4), sv = new Float32Array(8);
      sing.forEach((p, i) => { sv[2 * i] = p.re; sv[2 * i + 1] = p.im; });
      u4f(P, 'uKWin', w.x0, w.y0, w.x1, w.y1); u1f(P, 'uKR', k.R); u1f(P, 'uKRs', k.rs);
      if (P.loc.uKSing) gl.uniform2fv(P.loc.uKSing, sv);
      u1i(P, 'uKSingN', sing.length);
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LEQUAL);
      gl.drawArrays(gl.TRIANGLES, 0, res.count);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LESS);
      if (!dt) gl.disable(gl.DEPTH_TEST);
    } else gl.drawArrays(gl.TRIANGLES, 0, res.count);
    gl.bindVertexArray(null);
    if (sc) { if (scOn) gl.scissor(prevSc[0], prevSc[1], prevSc[2], prevSc[3]); else gl.disable(gl.SCISSOR_TEST); }
  }
  function destroy(res) {
    if (!res || !gl) return;
    if (res.kind === 'pre') {
      if (preAll.delete(res)) preBytes -= res.bytes;
      if (res.vao) gl.deleteVertexArray(res.vao);
      if (res.buf) gl.deleteBuffer(res.buf);
      res.vao = res.buf = null; res.n = 0; res.count = 0;
      return;
    }
    freeCache(res);
    live.delete(res);
    for (const v of res.vaos.values()) gl.deleteVertexArray(v);
    gl.deleteBuffer(res.buf);
    for (const sk of res.skips || []) gl.deleteBuffer(sk.buf);
    for (const b of (res.arcs || new Map()).values()) gl.deleteBuffer(b);
    if (res.arcs) res.arcs.clear();
    res.vaos.clear();
    res.n = 0;
  }

  // ---------------- map cache (spec 8.1) ----------------
  // Each entry holds one RG32F texture. Transform feedback writes into one shared scratch buffer (grown to the largest
  // pass) that is copied into the entry's texture, so a cached evaluation is held once.
  let tfObj = null, scratch = null, scratchBytes = 0;
  const CACHE_MAX = 4;                     // entries per resource (2 for entries over BIG_ENTRY: Max meshes)
  const BIG_ENTRY = 48 * 1024 * 1024;      // a Max mesh (480 base cells per side) holds ~115 MB per evaluation
  const CACHE_BYTES = 256 * 1024 * 1024;   // all entries; ones drawn in the last 250 ms are never evicted
  const cacheAll = new Map();              // entry -> true, least recently used first
  const tmpAll = new Set();                // scratch evaluations (tmpEntry); counted in cacheBytes
  let cacheBytes = 0;
  function freeEntry(e) {
    if (!e) return;
    if (cacheAll.delete(e)) cacheBytes -= e.bytes;
    if (e.res && e.res.tf && e.res.tf.get(e.key) === e) e.res.tf.delete(e.key);
    if (gl && e.tex) gl.deleteTexture(e.tex);
    e.tex = null;
  }
  function floatTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // Runs a transform-feedback pass into the scratch buffer, then copies bytes of it into tex (W x H texels).
  function runTF(P, vao, mode, count, instances, bytes, tex, W, H, ifmt, fmt) {
    if (!tfObj) tfObj = gl.createTransformFeedback();
    if (!scratch || scratchBytes < bytes) {
      if (scratch) gl.deleteBuffer(scratch);
      scratch = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, scratch);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_COPY);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      scratchBytes = bytes;
    }
    gl.bindVertexArray(vao);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfObj);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, scratch);
    gl.beginTransformFeedback(gl.POINTS);
    if (instances > 0) gl.drawArraysInstanced(gl.POINTS, 0, count, instances);
    else gl.drawArrays(gl.POINTS, 0, count);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, scratch);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
  }
  // The map-cache pass without transform feedback: count x instances points of program P (current, uniforms set),
  // each drawn as one pixel into its texel of tex (W x H, RG32F). Blending, depth, culling and the scissor are off
  // for the pass; the pane's framebuffer, viewport and these switches are restored after it.
  // alloc false: tex already has W x H RG32F storage (a reused scratch texture)
  let rtFbo = null;
  function runRT(P, vao, count, instances, tex, W, H, alloc = true) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (alloc) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, W, H, 0, gl.RG, gl.FLOAT, null);
    if (!rtFbo) rtFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const caps = [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE, gl.SCISSOR_TEST].filter((c) => gl.isEnabled(c));
    for (const c of caps) gl.disable(c);
    gl.viewport(0, 0, W, H);
    u1i(P, 'uP', count); u1i(P, 'uRtW', W); u2f(P, 'uRtSz', W, H);
    gl.bindVertexArray(vao);
    if (instances > 0) gl.drawArraysInstanced(gl.POINTS, 0, count, instances);
    else gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vpX, vpY, fw, fh);
    for (const c of caps) gl.enable(c);
  }
  function touch(e) {
    e.t = performance.now();
    cacheAll.delete(e); cacheAll.set(e, true);
    e.res.tf.delete(e.key); e.res.tf.set(e.key, e);
    return e;
  }
  // The cached mapped values of res under map, for template size L (mesh) or M (lines); null = use the direct path.
  // The key is what the values depend on: the app's cacheKey (the geometry), L, the map, the chain structure and its
  // parameter values (of the chain version that computed them: an earlier one while the current one compiles).
  // Pf: use this transform-feedback program (an earlier chain version) instead of the current one
  function tfEntry(res, isMesh, L, map, cacheKey, Pf) {
    if (!res.tf) res.tf = new Map();
    const c = res.tf;
    const keyOf = (ch, m) => `${cacheKey}|${L}|${mapKeyOf(m)}|${ch.key}|${ch.hash}`;
    const hit = Pf ? null : c.get(keyOf(cur, map));
    if (hit) return touch(hit);
    const P = Pf || program(isMesh ? 'tfRegion' : 'tfLine');
    if (!P) return null;
    const key = keyOf(P.ch, mapFor(map, P.ch));
    const hit2 = c.get(key);
    if (hit2) return touch(hit2);
    const tpl = isMesh ? regionTemplate(L) : lineTemplate(L);
    const count = tpl.P * res.n;
    const W = Math.min(maxTex, 4096), H = Math.max(1, Math.ceil(count / W));
    if (H > maxTex) return null;
    const bytes = W * H * 8;
    while (c.size >= (bytes > BIG_ENTRY ? 2 : CACHE_MAX)) freeEntry(c.values().next().value);
    const now = performance.now();
    if (cacheBytes + bytes > CACHE_BYTES) freeStaleTmp(now);
    for (const e0 of [...cacheAll.keys()]) {
      if (cacheBytes + bytes <= CACHE_BYTES) break;
      if (now - e0.t > 250) freeEntry(e0);
    }
    const e = { tex: floatTex(), W, H, P: tpl.P, bytes, res, key, t: now, ck: cacheKey, L };
    use(P, map);
    originUniforms(P, res.org);
    const vao = isMesh ? meshTFVAO(res, L) : lineTFVAO(res, L);
    if (P.rt) runRT(P, vao, tpl.P, res.n, e.tex, W, H);
    else runTF(P, vao, gl.POINTS, tpl.P, res.n, bytes, e.tex, W, H, gl.RG32F, gl.RG);
    c.set(key, e); cacheAll.set(e, true); cacheBytes += bytes;
    if (P.ch === cur && !sideMode) dropSuperseded(c, e);
    return e;
  }
  // The current chain's evaluation of (cacheKey, L) supersedes what earlier chain versions computed for it while the
  // current program compiled (an older ready program under the same app key, or an earlier version's stand-in at this
  // template size): those entries can never be looked up again (the current chain's key is checked first, and the
  // stand-in is only drawn while the current program is pending), so they are freed now instead of holding their
  // texture until the resource is rebuilt (U-b gate: a loaded example kept a second full-size evaluation of each shape)
  function dropSuperseded(c, e) {
    for (const o of [...c.values()]) {
      if (o === e || o.L !== e.L) continue;
      if (o.ck === e.ck || o.ck === 'stand-in') freeEntry(o);
    }
  }
  // Draws without a cache key (homotopy frames, thumbnails) still evaluate the map once per template point, into
  // one scratch texture per resource and template size that each such draw overwrites (rt only). So 2D views never
  // need the per-vertex chain programs (region, line): adding a step compiles two chain programs instead of four
  // (spec 8.7), and a frame evaluates the chain ~10x less often than per vertex. null while nothing can evaluate.
  function tmpEntry(res, isMesh, L, map) {
    const P = program(isMesh ? 'tfRegion' : 'tfLine');
    if (!P) return null;
    const tpl = isMesh ? regionTemplate(L) : lineTemplate(L);
    const count = tpl.P * res.n;
    const W = Math.min(maxTex, 4096), H = Math.max(1, Math.ceil(count / W));
    if (H > maxTex || !P.rt) return null;
    if (!res.tmp) res.tmp = new Map();
    const slot = (isMesh ? 'm' : 'l') + L;
    const key = `${mapKeyOf(mapFor(map, P.ch))}|${P.ch.key}|${P.ch.hash}`;
    let e = res.tmp.get(slot);
    const now = performance.now();
    sweepTmpLater();
    if (e) e.t = now;
    if (e && e.W === W && e.H === H && e.key === key) return e;
    const alloc = !e || e.W !== W || e.H !== H;
    if (alloc) {
      if (e) freeTmp(e);
      e = { tex: floatTex(), W, H, P: tpl.P, bytes: W * H * 8, res, slot, key: '', t: now };
      if (cacheBytes + e.bytes > CACHE_BYTES) freeStaleTmp(now);
      res.tmp.set(slot, e); tmpAll.add(e); cacheBytes += e.bytes;
    }
    e.key = key;
    use(P, map);
    originUniforms(P, res.org);
    runRT(P, isMesh ? meshTFVAO(res, L) : lineTFVAO(res, L), tpl.P, res.n, e.tex, W, H, alloc);
    return e;
  }
  function bindCache(P, e) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    u1i(P, 'uTexW', e.W);
    u1i(P, 'uP', e.P);
  }

  // static 3D geometry
  let sphereGeo = null, emptyVAO = null;
  function icosphere(level) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    V = V.map((p) => { const l = Math.hypot(...p); return p.map((x) => x / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < level; s++) {
      const mid = new Map();
      const m = (a, b) => {
        const k = a < b ? a * 1e6 + b : b * 1e6 + a;
        if (mid.has(k)) return mid.get(k);
        const p = [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]];
        const l = Math.hypot(...p);
        V.push(p.map((x) => x / l));
        mid.set(k, V.length - 1);
        return V.length - 1;
      };
      const G = [];
      for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); G.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = G;
    }
    return { pos: new Float32Array(V.flat()), idx: new Uint32Array(F.flat()) };
  }
  function sphere() {
    if (sphereGeo) return sphereGeo;
    const g = icosphere(5);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, makeBuf(g.pos));
    attrib(5, 3, 12, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    sphereGeo = { vao, count: g.idx.length };
    return sphereGeo;
  }
  function empty() {
    if (!emptyVAO) emptyVAO = gl.createVertexArray();
    return emptyVAO;
  }
  // marks: instanced lines / discs / rings, 10 floats per instance (A, B, kind, radius, half width, -)
  let markVAO = null, markBuf = null;
  function drawMarks(MVP, list, rgb, alpha, opts = {}) {
    if (!list.length) return;
    const P = program('mark');
    if (!P) return;
    if (!markVAO) {
      markVAO = gl.createVertexArray();
      markBuf = gl.createBuffer();
      gl.bindVertexArray(markVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
      attrib(7, 3, 40, 0, 1); attrib(8, 3, 40, 12, 1); attrib(9, 4, 40, 24, 1);
      gl.bindVertexArray(null);
    }
    const data = new Float32Array(list.length * 10);
    list.forEach((m, i) => data.set(m, i * 10));
    use(P);
    uM4(P, 'uMVP', MVP);
    u2f(P, 'uPx', fw, fh);
    u1f(P, 'uZBias', opts.zBias || 0);
    u1f(P, 'uZFix', opts.once ? -0.9999 : -2);
    u3(P, 'uColor', rgb);
    gl.bindVertexArray(markVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const draw = (a) => { u1f(P, 'uAlpha', a); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, list.length); };
    if (opts.once) {                      // a translucent polyline drawn last: each pixel blends once
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
      draw(alpha);
    } else if (opts.xray) {               // hidden parts faint, visible parts full
      gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.depthFunc(gl.GREATER); draw(alpha * 0.35);
      gl.depthFunc(gl.LEQUAL); draw(alpha);
    } else draw(alpha);
    gl.bindVertexArray(null);
  }
  const segM = (a, b, hw) => [a[0], a[1], a[2], b[0], b[1], b[2], 0, 0, hw, 0];
  const dotM = (a, r) => [a[0], a[1], a[2], 0, 0, 0, 1, r, 0, 0];

  // ---------------- frame management ----------------
  let fw = 0, fh = 0, vpX = 0, vpY = 0;
  function init(cnv) {
    canvas = cnv || document.createElement('canvas');
    if (!cnv) { canvas.width = 640; canvas.height = 480; }
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      pcExt = gl.getExtension('KHR_parallel_shader_compile');
      rtOK = !!gl.getExtension('EXT_color_buffer_float');
      ok = true;
      canvas.addEventListener('webglcontextlost', (e) => {
        // a GPU reset: the browser may give the context back (webglcontextrestored); until then the app shows
        // a "restoring" state rather than the unsupported message
        e.preventDefault();
        ok = false; lost = true;
        for (const r of live) r.tf = r.tmp = null;   // GPU objects are gone with the context
        live.clear();
        cacheAll.clear(); tmpAll.clear(); cacheBytes = 0;
        // the pre-mapped meshes' buffers are gone too: forget them (destroy() on one of them later is a no-op), so the
        // budget counts only the meshes re-uploaded after the restore
        for (const [r] of preAll) { r.vao = r.buf = null; r.n = 0; r.count = 0; }
        preAll.clear(); preBytes = 0;
        clearTimeout(pollT); pollT = 0;
        if (api.onLost) api.onLost();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        // every GPU object is gone: forget them and let the app rebuild its meshes
        progs.clear(); tplCache.clear();
        sphereGeo = emptyVAO = markVAO = markBuf = lutTex = tfObj = scratch = nodeTex = nodeKey = ptsTex = rtFbo = null;
        invTex = halfTex = halfFbo = null; invTexKey = ''; halfW = halfH = 0; invUpWarm = false; invFailed.clear(); tqPending.length = 0; tqActive = null; tqChecked = false; tqExt = null;
        scratchBytes = 0;
        land = landS = null;
        maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        pcExt = gl.getExtension('KHR_parallel_shader_compile');
        rtOK = !!gl.getExtension('EXT_color_buffer_float');
        ok = true; lost = false;
        if (api.onRestore) api.onRestore();
      });
    } catch (e) {
      ok = false;
    }
    return ok;
  }
  function begin(pw, ph, clear) {
    if (canvas.width < pw || canvas.height < ph) {
      canvas.width = Math.max(canvas.width, Math.ceil(pw));
      canvas.height = Math.max(canvas.height, Math.ceil(ph));
    }
    // after beginHalfPre the frame has begun already (its status kept): back to the default framebuffer, the half
    // layer waiting for compositeHalf; otherwise a pre-pass layer nobody composited is stale
    if (preActive && fw === pw && fh === ph) { preActive = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    else {
      if (preActive) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      preActive = false;
      if (halfOpen && halfOpen.pre) halfOpen = null;
      frameErr = ''; framePending = false; invAltUsed = false; invFrame++;
    }
    fw = pw; fh = ph; vpX = 0; vpY = 0;
    gl.viewport(0, 0, pw, ph);
    gl.disable(gl.SCISSOR_TEST);
    const c = clear || [0, 0, 0, 0];
    gl.clearColor(c[0], c[1], c[2], c[3]);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    resetState();
  }
  // Optional: draw into a sub-rectangle (device px, bottom-left origin) of a shared stage canvas.
  function viewport(x, y, w, h, clear) {
    if (preActive) { preActive = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    if (halfOpen && halfOpen.pre) halfOpen = null;
    fw = w; fh = h; vpX = x; vpY = y;
    frameErr = ''; framePending = false; invAltUsed = false; invFrame++;
    gl.viewport(x, y, w, h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, w, h);
    if (clear !== false) {
      const c = clear || [0, 0, 0, 0];
      gl.clearColor(c[0], c[1], c[2], c[3]);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    resetState();
  }
  function resetState() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
  }
  // a promise that settles once the GPU has finished every command issued so far: a fence polled between tasks,
  // never waited on (SPEC 10.6: the export reads its rasters back only then, so a readback does not hold the main
  // thread while the GPU finishes 300 dpi passes; P3 review). Settles anyway after maxMs or on a lost context.
  // (a hidden page runs timers about once a second: a video made there polls through a message channel instead)
  const laterQ = [], laterCh = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
  if (laterCh) laterCh.port1.onmessage = () => { const f = laterQ.shift(); if (f) f(); };
  const later = (f) => { if (laterCh && typeof document !== 'undefined' && document.hidden) { laterQ.push(f); laterCh.port2.postMessage(0); } else setTimeout(f, 4); };
  function gpuDone(maxMs = 3000) {
    if (!ok || lost || !gl || typeof gl.fenceSync !== 'function') return Promise.resolve(false);
    let f = null;
    try { f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { f = null; }
    if (!f) return Promise.resolve(false);
    const t0 = performance.now();
    return new Promise((res) => {
      const poll = () => {
        let done = true;
        try { done = gl.isContextLost() || gl.getSyncParameter(f, gl.SYNC_STATUS) === gl.SIGNALED; } catch (e) { done = true; }
        if (done || performance.now() - t0 > maxMs) { try { gl.deleteSync(f); } catch (e) { /* lost */ } res(done); return; }
        later(poll);
      };
      later(poll);
    });
  }
  function blit(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, canvas.height - fh, fw, fh, 0, 0, fw, fh);
    ctx.restore();
  }
  // A new chain structure (key) becomes the current version; the previous one is kept (with its parameter values)
  // so its compiled programs can draw while the new ones compile.
  const sigsOf = (key) => { try { const k = JSON.parse(key); return Array.isArray(k[1]) ? k[1] : []; } catch (e) { return []; } };
  function setChain(info) {
    if (sideMode) {
      // a side chain: its own version object (never the user's, whose parameter values it would overwrite)
      let ch = sideChs.get(info.key);
      if (!ch) {
        ch = { key: info.key, info: null, data: null, hash: '', sigs: sigsOf(info.key) };
        sideChs.set(info.key, ch);
        if (sideChs.size > SIDE_KEEP) sideChs.delete(sideChs.keys().next().value);
      }
      cur = ch;
    } else if (info.key !== cur.key) {
      if (cur.info) hist.unshift(cur);
      const j = hist.findIndex((h) => h.key === info.key);
      cur = j >= 0 ? hist.splice(j, 1)[0] : { key: info.key, info: null, data: null, hash: '', sigs: sigsOf(info.key) };
      if (hist.length > PROG_KEEP) hist.length = PROG_KEEP;
    }
    cur.info = info;
    const n = Math.max(4, info.slots * 4);
    if (!cur.data || cur.data.length !== n) cur.data = new Float32Array(n); else cur.data.fill(0);
    info.fill(cur.data);
    cur.hash = Array.prototype.join.call(cur.data, ',');
  }
  // view: {cx, cy, s (css px/unit)}, dpr; org: the resource origin (float64). The view centre goes in as a hi/lo
  // pair, and uRel = O - centre (float64 difference) places identity draws.
  function view2D(P, v, dpr, org) {
    u2f(P, 'uCenter', hi32(v.cx), hi32(v.cy));
    u2f(P, 'uCenterLo', v.cx - hi32(v.cx), v.cy - hi32(v.cy));
    u2f(P, 'uScale', 2 * v.s * dpr / fw, 2 * v.s * dpr / fh);
    u2f(P, 'uPx', fw, fh);
    u1f(P, 'uDpr', dpr);
    const ox = org ? org[0] : 0, oy = org ? org[1] : 0;
    u2f(P, 'uRel', ox - v.cx, oy - v.cy);
    originUniforms(P, org);
  }

  // ---------------- graph paper (spec 6.1) ----------------
  const TIER_M = [0.5, 1, 5, 10, 50, 100];   // 0.5 keeps the d0 / 2 family when d0 steps a decade: no popping
  function nice125(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    for (const m of [1, 2, 5, 10]) if (m * p >= x * (1 - 1e-9)) return m * p;
    return 10 * p;
  }
  // st: {view:{cx,cy,s}, dpr, plane, minor, medium, major, axis, unit, unitAlpha, ticks?:{x,y},
  //      overlay?:{color, alpha, axisAlpha, casing, casingAlpha}}  (overlay: transparent, major tier + axes only)
  const tierBuf = new Float32Array(24), tierCol = new Float32Array(18);
  function drawGrid(st) {
    if (!ok) return;
    const P = program('grid');
    if (!P) return;
    const v = st.view, dpr = st.dpr || 1, s = v.s, W = fw, H = fh;
    const ov = st.overlay || null;
    const minor = col3(st.minor, '#E2EEF2'), medium = col3(st.medium, '#D3E6ED'), major = col3(st.major, '#B5D4E0');
    const d0 = Math.pow(10, Math.ceil(Math.log10(8 / s)));
    for (let i = 0; i < 6; i++) {
      const step = d0 * TIER_M[i], px = step * s;
      let a = smooth(8, 20, px);
      const t = smooth(Math.log(12), Math.log(240), Math.log(px));
      let c = t < 0.5 ? minor.map((x, k) => x + (medium[k] - x) * 2 * t) : medium.map((x, k) => x + (major[k] - x) * (2 * t - 1));
      if (ov) { c = col3(ov.color, [1, 1, 1]); a *= smooth(0.5, 1, t) * (ov.alpha ?? 0.22); }
      const kx = Math.round(v.cx / step), ky = Math.round(v.cy / step);
      tierBuf.set([W / 2 + (kx * step - v.cx) * s * dpr, H / 2 + (ky * step - v.cy) * s * dpr, px * dpr, a], 4 * i);
      tierCol.set(c, 3 * i);
    }
    use(P);
    u4f(P, 'uVp', vpX, vpY, W, H);
    u1f(P, 'uDpr', dpr);
    const plane = ov ? null : col3(st.plane, '#FCFDFD');
    u4f(P, 'uBg', plane ? plane[0] : 0, plane ? plane[1] : 0, plane ? plane[2] : 0, plane ? 1 : 0);
    gl.uniform4fv(L_(P, 'uTier'), tierBuf);
    gl.uniform3fv(L_(P, 'uTierCol'), tierCol);
    // axes, pixel-snapped: odd widths centred on a pixel centre, even widths on a pixel edge
    const axisCol = col3(ov ? ov.color : st.axis, '#2E3D47');
    const aw = 1.25 * dpr;
    const snap = (x) => (Math.round(aw) % 2 ? Math.floor(x) + 0.5 : Math.round(x));
    const AX = snap(W / 2 - v.cx * s * dpr), AY = snap(H / 2 - v.cy * s * dpr);
    const axisOn = st.axes !== false;
    u4f(P, 'uAxis', AX, AY, aw, axisOn ? (ov ? (ov.axisAlpha ?? 0.7) : 1) : 0);
    u3(P, 'uAxisCol', axisCol);
    const cas = ov && ov.casing ? col3(ov.casing, [0, 0, 0]) : null;
    u4f(P, 'uCasing', cas ? cas[0] : 0, cas ? cas[1] : 0, cas ? cas[2] : 0, cas ? (ov.casingAlpha ?? 0.4) : 0);
    // ticks at the ruler-labelled steps: >= 72 px apart along x, >= 48 px along y
    const tx = (st.ticks && st.ticks.x) || nice125(72 / s), ty = (st.ticks && st.ticks.y) || nice125(48 / s);
    const kx = Math.round(v.cx / tx), ky = Math.round(v.cy / ty);
    u4f(P, 'uTickX', W / 2 + (kx * tx - v.cx) * s * dpr, tx * s * dpr, 2.5 * dpr, dpr);
    u4f(P, 'uTickY', H / 2 + (ky * ty - v.cy) * s * dpr, ty * s * dpr, 2.5 * dpr, dpr);
    // unit circle: 1 px axis at unitAlpha, dashed 2/3 (a multiple of 4 dashes), 3 px ticks at the axes
    const UX = W / 2 - v.cx * s * dpr, UY = H / 2 - v.cy * s * dpr, UR = s * dpr;
    const near = Math.hypot(Math.max(0, Math.abs(UX - W / 2) - W / 2), Math.max(0, Math.abs(UY - H / 2) - H / 2));
    const visible = st.unit && !ov && UR > 2 && near < UR + 4 && Math.hypot(Math.abs(UX - W / 2) + W / 2, Math.abs(UY - H / 2) + H / 2) > UR - 4;
    u4f(P, 'uUnit', UX, UY, UR, visible ? (st.unitAlpha ?? 0.55) : 0);
    u3(P, 'uUnitCol', axisCol);
    const nDash = Math.max(4, 4 * Math.round(2 * Math.PI * s / 20));
    u2f(P, 'uDash', nDash, s);
    // beyond 2e5 device px the shader uses the circle's local form, computed here in float64
    const cAbs = Math.hypot(v.cx, v.cy), CL = cAbs * s * dpr;
    if (visible && UR > 2e5 && CL > 0) {
      const th0 = Math.atan2(v.cy, v.cx), per = 2 * Math.PI * s / nDash, q = Math.PI / 2;
      u4f(P, 'uUnitL', (cAbs - 1) * s * dpr, v.cx / cAbs, v.cy / cAbs, CL);
      u4f(P, 'uUnitA', (((th0 * s) % per) + per) % per, (th0 - Math.round(th0 / q) * q) * s, 0, 1);
    } else u4f(P, 'uUnitA', 0, 0, 0, 0);
    gl.bindVertexArray(empty());
    if (!ov) gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  // ---------------- regions and lines ----------------
  const PATTERNS = { solid: 0, checker: 1, polar: 2, tiles: 3, grid: 4, polargrid: 5, phase: 6, stretch: 7, sphere: 8 };
  function fadeUniforms(P, f) {
    if (f && f.R != null) {
      u1i(P, 'uFadeMode', 2); u4f(P, 'uFade', f.cx || 0, f.cy || 0, f.R, 0); u1f(P, 'uFadeW', 0.08 * f.R);
    } else if (f && f.x1 != null) {
      u1i(P, 'uFadeMode', 1); u4f(P, 'uFade', f.x0, f.y0, f.x1, f.y1); u1f(P, 'uFadeW', f.w != null ? f.w : 0.04 * Math.max(f.x1 - f.x0, f.y1 - f.y0));
    } else u1i(P, 'uFadeMode', 0);
  }
  function regionUniforms(P, st, org) {
    const c0 = col3(st.color, [0.5, 0.5, 0.5]);
    u3(P, 'uC0', c0);
    u3(P, 'uC1', col3(st.color2, c0));
    u3(P, 'uK', col3(st.edge, col3(st.ink, [0.07, 0.1, 0.13])));
    u1f(P, 'uAlpha', st.alpha ?? 0.85);
    u1i(P, 'uPattern', PATTERNS[st.pattern] ?? 1);
    const cell = st.cell || 1;
    u1f(P, 'uCell', cell);
    u1f(P, 'uLines', st.lines ? 1 : 0);
    u1f(P, 'uDpr', st.dpr || 1);
    // the spherical checker (SPEC 6.3): n longitude sectors, n = clamp(round(16 / pattern scale), 4, 64), even
    u1f(P, 'uSphN', Math.max(4, Math.min(64, 2 * Math.round((st.sphN || 16) / 2))));
    const sx = st.stretch || {};
    u3(P, 'uShrink', col3(sx.shrink, '#2E69B2'));
    u3(P, 'uGrow', col3(sx.grow, '#D79628'));
    u3(P, 'uMid', col3(sx.mid, '#E9F0F2'));
    // pattern coordinates are taken relative to Q, the resource origin snapped to 10 cells (every pattern repeats
    // over 10 cells), so they stay small numbers in float32 wherever the shape is
    const per = 10 * cell, ox = org ? org[0] : 0, oy = org ? org[1] : 0;
    const qx = Number.isFinite(Math.round(ox / per) * per) ? Math.round(ox / per) * per : 0;
    const qy = Number.isFinite(Math.round(oy / per) * per) ? Math.round(oy / per) * per : 0;
    u2f(P, 'uSrcOff', ox - qx, oy - qy);
    u2f(P, 'uQ', qx, qy);
    const o = st.origin || [0, 0];
    u2f(P, 'uOrigin', (o[0] ?? o.re ?? 0) - qx, (o[1] ?? o.im ?? 0) - qy);
    fadeUniforms(P, st.fade);
  }
  // tfEntry's answer while the current chain's transform-feedback program is still compiling (and no earlier one is
  // ready): the draw then uses whichever direct program is already ready, without starting another compile
  const PENDING = {};
  function readyProg(name) {
    const P = getProg(name, cur, false);
    if (P || sideMode) return P;
    for (const h of hist) { const Q = getProg(name, h, false); if (Q) return Q; }
    return null;
  }
  // nothing ready for a direct draw while the current chain compiles: an earlier version's cached evaluation of
  // the (translated) map stands in, so the pane keeps showing the previous image instead of going blank
  function stand(res, isMesh, L, map, name) {
    const d = progs.get(name + '|' + cur.key);
    if (!d || d.state !== 'pending' || sideMode) return null;   // a failed compile is reported, never covered up
    for (const h of hist) {
      const T = getProg(isMesh ? 'tfRegion' : 'tfLine', h, false);
      if (T) return tfEntry(res, isMesh, L, map, 'stand-in', T);
    }
    return null;
  }
  function freeTmp(e) {
    if (!tmpAll.delete(e)) return;
    cacheBytes -= e.bytes;
    if (gl && e.tex) gl.deleteTexture(e.tex);
    if (e.res.tmp && e.res.tmp.get(e.slot) === e) e.res.tmp.delete(e.slot);
  }
  // over the budget: scratch textures not drawn from for a second go first (a homotopy or thumbnails that ended)
  function freeStaleTmp(now) { for (const e of [...tmpAll]) if (now - e.t > 1000) freeTmp(e); }
  // and once the drawing that used them has been idle that long, whatever the budget: a scratch evaluation is only
  // reused by the next draw of the same map (the next frame of a playing homotopy, a thumbnail drawn again at once),
  // so after the step-card thumbnails or a finished homotopy it held its texture for nothing (U-b gate: the idle app
  // kept the thumbnails' evaluations of every shape). A later draw evaluates into a new one.
  let tmpSweepT = 0;
  function sweepTmpLater() {
    if (tmpSweepT) return;
    tmpSweepT = setTimeout(() => {
      tmpSweepT = 0;
      freeStaleTmp(performance.now());
      if (tmpAll.size) sweepTmpLater();
    }, 1200);
    if (tmpSweepT && tmpSweepT.unref) tmpSweepT.unref();   // (node tests: never keeps the process alive)
  }
  // cacheKey null: the per-resource scratch texture (tmpEntry), which only the rt path has
  function cached(res, isMesh, L, map, cacheKey) {
    const e = cacheKey ? tfEntry(res, isMesh, L, map, cacheKey) : tmpEntry(res, isMesh, L, map);
    if (e) return e;
    const s = progs.get((isMesh ? 'tfRegion' : 'tfLine') + '|' + cur.key);
    return s && s.state === 'pending' ? PENDING : null;
  }
  // Draw a region mesh. st: {map, view, dpr, L, color (c0), color2 (c1), edge (k), ink, alpha, pattern, cell, lines,
  //   skip, stretch:{shrink,grow,mid}, fade, origin, cacheKey, sphere:{MVP, eye}, sync (wait for compiles)}
  // Identity maps draw without the chain, in coordinates relative to the mesh origin.
  function drawRegion(res, st) {
    if (!ok || !res || !res.n) return;
    const L = st.L || 4, sph = !!st.sphere;
    if (st.sync) syncDepth++;
    try {
      const ident = !sph && isIdent(st.map);
      let e = (st.cacheKey || rtOK) && !ident ? cached(res, true, L, st.map, st.cacheKey || null) : null;
      const pend = e === PENDING;
      if (pend) e = null;
      const name = ident ? 'region0' : (sph ? 'regionS' : 'region') + (e ? 'C' : '');
      let P = pend ? readyProg(name) : program(name);
      if (!P && !ident && !e && (e = stand(res, true, L, st.map, pend ? 'tfRegion' : name))) P = program(sph ? 'regionSC' : 'regionC');
      if (!P) return;
      use(P, st.map);
      if (e) bindCache(P, e);
      if (sph) {
        uM4(P, 'uMVP', st.sphere.MVP);
        u3(P, 'uEye', st.sphere.eye);
        lightUniforms(P, sceneLight || defaultLight(false), 0.18, 40, 0.12);
        originUniforms(P, res.org);
      } else view2D(P, st.view, st.dpr || 1, res.org);
      regionUniforms(P, st, res.org);
      gl.bindVertexArray(meshVAO(res, L, st.skip));
      // st.scissors: draw only inside these rects (device px of the pane, bottom-left origin; SPEC 8.8: the GPU image
      // around a SphereMesh's guard box while its rebuild runs)
      if (st.scissors) {
        const scOn = gl.isEnabled(gl.SCISSOR_TEST), prevSc = scOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
        for (const sc of st.scissors) {
          let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
          if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
          if (x1 <= x0 || y1 <= y0) continue;
          gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, regionTemplate(L).count, res.n);
        }
        if (scOn) gl.scissor(prevSc[0], prevSc[1], prevSc[2], prevSc[3]); else gl.disable(gl.SCISSOR_TEST);
      } else gl.drawArraysInstanced(gl.TRIANGLES, 0, regionTemplate(L).count, res.n);
      gl.bindVertexArray(null);
    } finally { if (st.sync) syncDepth--; }
  }
  // st: {map, view, dpr, M, width (device px), color, alpha, casing:{color, alpha, width}, fade, cacheKey, sphere,
  //      floor, sync, dash:[on, off] (CSS px, 2D only; the casing stays solid), arc:{key, data}}
  // arc.data: per segment (in createLines order) the arc length of the mapped curve at the segment start and the
  // segment's length, in plane units (the dash phase follows the curve across pieces and segments).
  function drawLines(res, st) {
    if (!ok || !res || !res.n) return;
    const M = st.M || 8, sph = !!st.sphere, flo = !!st.floor, dpr = st.dpr || 1;
    if (st.sync) syncDepth++;
    try {
      const ident = !sph && isIdent(st.map);
      let e = (st.cacheKey || rtOK) && !ident ? cached(res, false, M, st.map, st.cacheKey || null) : null;
      const pend = e === PENDING;
      if (pend) e = null;
      const nameOf = () => (flo ? (ident ? 'lineF' : e ? 'lineFC' : 'lineFM') : sph ? (e ? 'lineSC' : 'lineS') : (ident ? 'line0' : e ? 'lineC' : 'line'));
      let P = pend ? readyProg(nameOf()) : program(nameOf());
      if (!P && !ident && !e && (e = stand(res, false, M, st.map, pend ? 'tfLine' : nameOf()))) P = program(nameOf());
      if (!P) return;
      use(P, st.map);
      if (e) bindCache(P, e);
      if (sph || flo) {
        const m = sph ? st.sphere : st.floor;
        uM4(P, 'uMVP', m.MVP);
        u2f(P, 'uPx', fw, fh);
        u1f(P, 'uDpr', dpr);
        originUniforms(P, res.org);
        if (flo) {
          u4f(P, 'uBox', m.box.x0, m.box.y0, m.box.x1 - m.box.x0, m.box.y1 - m.box.y0); u2f(P, 'uAspect', m.aspect[0], m.aspect[1]); u1f(P, 'uFloorZ', m.floorZ);
          const cl = m.clip || m.box;
          u4f(P, 'uClip', cl.x0, cl.y0, cl.x1, cl.y1);
        }
      } else view2D(P, st.view, dpr, res.org);
      fadeUniforms(P, st.fade);
      gl.bindVertexArray(lineVAO(res, M));
      const dash = !sph && !flo && st.dash && st.arc && st.arc.data && res.arcs && st.arc.data.length >= 2 * res.n ? st.dash : null;
      if (dash) {
        let b = res.arcs.get(st.arc.key);
        if (b) res.arcs.delete(st.arc.key);
        else {
          b = makeBuf(st.arc.data);
          if (res.arcs.size >= 3) { const [k0, b0] = res.arcs.entries().next().value; res.arcs.delete(k0); gl.deleteBuffer(b0); }
        }
        res.arcs.set(st.arc.key, b);
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        attrib(12, 2, 8, 0, 1);
        u1f(P, 'uArcPx', st.view.s * dpr);
      } else { gl.disableVertexAttribArray(12); gl.vertexAttrib2f(12, 0, 0); }
      const count = lineTemplate(M).count;
      const pass = (width, color, alpha, d) => {
        u1f(P, 'uWidth', width);
        u3(P, 'uColor', col3(color, [0, 0, 0]));
        u1f(P, 'uAlpha', alpha ?? 1);
        u2f(P, 'uDash', d ? d[0] * dpr : 0, d ? d[1] * dpr : 0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, count, res.n);
      };
      const cs = st.casing;
      if (cs && cs.width > 0 && (cs.alpha ?? 1) > 0) pass(cs.width, cs.color || [1, 1, 1], cs.alpha ?? 1, null);
      pass(st.width, st.color, st.alpha, dash);
      gl.bindVertexArray(null);
    } finally { if (st.sync) syncDepth--; }
  }

  // ---------------- phase portrait (spec 6.8) ----------------
  const STYLES = { enhanced: 0, classic: 1, phase: 2, grid: 3, modulus: 4 };
  function dcUniforms(P, st, dpr) {
    u1i(P, 'uStyle', STYLES[st.style] ?? 0);
    u1f(P, 'uSectors', st.sectors || 12);
    u1f(P, 'uGrid', st.grid || 0.5);
    u3(P, 'uPlane', col3(st.plane, st.dark ? '#0D1317' : '#FCFDFD'));
    u3(P, 'uInk', col3(st.ink, st.dark ? '#E3EAEE' : '#121A20'));
    u1f(P, 'uDark', st.dark ? 1 : 0);
    u1f(P, 'uDpr', dpr || 1);
    u1f(P, 'uPhaseLines', st.phaseLines ? 1 : 0);
  }
  // st: {map, view, dpr, style, sectors, grid, plane, ink, dark, phaseLines,
  //      cauchy: {nodes: Float32Array [x, y, wre, wim] * n (Calc.cauchyNodes), n} (the Cauchy integral of the nodes
  //      instead of F; the map is not used, style 'cauchy' colours like 'enhanced')}
  let nodeTex = null, nodeKey = null, nodeO = [0, 0], nodeW = 1;
  function cauchyNodes(c) {
    const n = Math.max(0, Math.min(c.n | 0, Math.floor(c.nodes.length / 4), maxTex));
    gl.activeTexture(gl.TEXTURE4);
    if (nodeTex && nodeKey === c.nodes && nodeKey.length === c.nodes.length) return n;
    // nodes relative to their centroid (float64 here), so zeta_j - z keeps its precision in float32
    let ox = 0, oy = 0;
    for (let j = 0; j < n; j++) { ox += c.nodes[4 * j]; oy += c.nodes[4 * j + 1]; }
    ox = n ? ox / n : 0; oy = n ? oy / n : 0;
    if (!Number.isFinite(ox + oy)) ox = oy = 0;
    nodeW = Math.max(1, n);
    const d = new Float32Array(nodeW * 4);
    for (let j = 0; j < n; j++) {
      d[4 * j] = c.nodes[4 * j] - ox; d[4 * j + 1] = c.nodes[4 * j + 1] - oy;
      d[4 * j + 2] = c.nodes[4 * j + 2]; d[4 * j + 3] = c.nodes[4 * j + 3];
    }
    if (!nodeTex) nodeTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, nodeW, 1, 0, gl.RGBA, gl.FLOAT, d);
    nodeKey = c.nodes; nodeO = [ox, oy];
    return n;
  }
  function drawColorPlot(st) {
    if (!ok) return;
    const cz = st.cauchy && st.cauchy.nodes && st.cauchy.nodes.length >= 4 ? st.cauchy : null;
    const P = program(cz ? 'cauchy' : 'color');
    if (!P) return;
    use(P, st.map);
    const dpr = st.dpr || 1;
    if (cz) {
      const n = cauchyNodes(cz);
      gl.bindTexture(gl.TEXTURE_2D, nodeTex);   // unit 4
      u1i(P, 'uNodeN', n);
      u2f(P, 'uRelC', st.view.cx - nodeO[0], st.view.cy - nodeO[1]);
    } else {
      u2f(P, 'uCenter', st.view.cx, st.view.cy);
    }
    u2f(P, 'uInvScale', 1 / (st.view.s * dpr), 1 / (st.view.s * dpr));
    u4f(P, 'uVp', vpX, vpY, fw, fh);
    dcUniforms(P, st, dpr);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
  }

  // ---------------- preimages (Preimage mode) ----------------
  const TKIND = { disc: 1, rect: 2, polygon: 3, halfplane: 4, annulus: 5, sector: 6, formula: 7, segment: 11, line: 12, ray: 13, circle: 14, arc: 15, curve: 16, cgrid: 17, pgrid: 18, fcurve: 19 };
  // v16 (notes/constructions-v16/SPEC.md 2.2): a gcircle disc or circle (s._g, A != 0) packs its exact form instead of
  // (c, r): kind 8 (gdisc, the area form: inverse and Preimage area paths) or 20 (gcurve, the curve paths), A = (o, A,
  // C), B = (B, tangent at 0 when the curve passes through 0 by incidence), relative to an anchor o re-anchored in
  // float64 at the point of the curve nearest formAnchor (the view's centre, GLR.setFormAnchor), so float32 sees only
  // small numbers near the view at any radius [C4, C5]
  let formAnchor = null;
  const gKind = (t) => (t && t._g && t._g.A !== 0 && (t.kind === 'disc' || t.kind === 'circle') ? (t.kind === 'disc' ? 8 : 20) : 0);
  function packForm(t) {
    let G = t._g;
    if (formAnchor && typeof Constr !== 'undefined' && Constr.reanchor && !G.thru0) G = Constr.reanchor(G, formAnchor);
    const gx = G.B[0] - G.A * G.o[0], gy = G.B[1] - G.A * G.o[1], gl = Math.hypot(gx, gy) || 1;
    const A = [G.o[0], G.o[1], G.A, G.C], B = [G.B[0], G.B[1], -gy / gl, gx / gl];
    return [...A, ...B].every(Number.isFinite) ? { kind: gKind(t), A, B, size: 2 / Math.abs(G.A), pts: null } : null;
  }
  // MAX_FORMS: formula level functions of the preimage pass (area formulas, traced curve pieces: a complex piece takes
  // two, a restriction one); the inverse renderer's formula areas have their own cap MAX_INV_FORMS (SPEC 4.4)
  const MAX_TARGETS = 16, MAX_PTS = 256, MAX_FORMS = 8, MAX_INV_FORMS = 4;
  let ptsTex = null;
  const preNames = [];     // programs with formula targets compiled in, oldest first
  function dropDef(name) {
    for (const [id, e] of [...progs]) {
      if (e.name !== name) continue;
      if (e.p) gl.deleteProgram(e.p);
      if (e.vs) gl.deleteShader(e.vs);
      if (e.fs) gl.deleteShader(e.fs);
      progs.delete(id);
    }
    delete DEFS[name];
  }
  // the program for a list of formula level functions (GLSL sources defining tlev0, tlev1, ...)
  function preProgram(forms, sph) {
    if (!forms.length) return program(sph ? 'preS' : 'pre');
    const src = forms.join('');
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (Math.imul(h, 31) + src.charCodeAt(i)) | 0;
    const name = (sph ? 'preS:' : 'pre:') + (h >>> 0).toString(36) + ':' + src.length;
    if (!DEFS[name]) {
      const disp = 'float formulaLevel(int f, vec2 w) {\n' + forms.map((_, i) => `  if (f == ${i}) return tlev${i}(w);\n`).join('') + '  return -1.0;\n}\n';
      DEFS[name] = { chain: true, vs: () => (sph ? SPHERE_VS : QUAD_VS), fs: () => PRE_FS(src + disp, sph) };
      preNames.push(name);
      while (preNames.length > 4) dropDef(preNames.shift());
    } else {
      preNames.splice(preNames.indexOf(name), 1);
      preNames.push(name);
    }
    return program(name);
  }
  // GLSL of a formula target's level function, named tlev<f>: the app's levelSrc (any function name) or GLChain's
  function formulaSource(t, f) {
    const name = 'tlev' + f;
    if (typeof t.levelSrc === 'string') {
      const m = /float\s+([A-Za-z_]\w*)\s*\(\s*vec2/.exec(t.levelSrc);
      if (m) return t.levelSrc.replace(new RegExp('\\b' + m[1] + '\\b', 'g'), name);
    }
    if (typeof GLChain === 'undefined' || typeof GLChain.levelGLSL !== 'function' || !t.expr) return null;
    const r = GLChain.levelGLSL(t.expr, name);
    return r && r.ok ? r.source : null;
  }
  const xyOf = (p) => (Array.isArray(p) ? [+p[0], +p[1]] : p ? [+(p.re ?? p.x), +(p.im ?? p.y)] : [NaN, NaN]);
  // the pieces of a curve formula target as level ASTs for GLChain.levelGLSL: {g: 'A = B' (levelGLSL's Re(A - B)),
  // gi: for complex sides 'Re(-i (A - B)) = 0' (Im(A - B)): the curve is where both parts vanish, stroked from the
  // smooth complex difference (|A - B| has a kink on the curve that the jump test took for a cut), r: the restriction
  // (positive inside) | null}. Isolated zeros (|z^2 - 1| = 0) have no stroke.
  function curveForms(t) {
    let d = null;
    try { d = typeof Region !== 'undefined' && Region.curveDesc ? Region.curveDesc(t) : null; } catch (e) { d = null; }
    if (!d) return [];
    const out = [];
    for (const pc of d.pieces) {
      if (pc.kind === 'zeros' || !pc.form || pc.form.t !== 'cmp') continue;
      const f = pc.form;
      const Z = { t: 'num', v: CX.C(0, 0) }, D = { t: 'sub', a: f.a, b: f.b };
      if (pc.real === 'complex') out.push({ g: { t: 'cmp', op: '=', a: D, b: Z }, gi: { t: 'cmp', op: '=', a: { t: 'mul', a: { t: 'num', v: CX.C(0, -1) }, b: D }, b: Z }, r: pc.formRestrict || null });
      else out.push({ g: f, r: pc.formRestrict || null });
    }
    return out;
  }
  // st: {map, view, dpr, targets: [{kind, shape fields as in Region (c, r, r1, r2, a, b, m, t1, t2, pts, n, nc, nr,
  //      complement, expr, levelSrc?), color: [r, g, b], edge?, alpha, width? (device px)}], halo?, wGrid?}
  // Area targets fill where w = F(z) lies inside them (with a faint pull-back of the w-plane's grid and their
  // boundary); curve targets draw their preimage curves. Points are not drawn (their preimages are roots: the app
  // finds them on the CPU). At most 16 targets and 256 polygon / polyline vertices in all.
  // st.sphere: {MVP} instead of view: over the Riemann sphere of that camera (the globe drawn first, depth kept)
  // A shape's record (drawPreimage's targets and the inverse pass's shapes, SPEC 4.3): {kind (TKIND), A, B, size,
  // pts ([x, y] of polygons and freehand curves, finite only)}, or null (an unknown kind, non-finite parameters)
  function packShape(t) {
    if (!t || !TKIND[t.kind]) return null;
    if (gKind(t)) return packForm(t);
    let kind = TKIND[t.kind], ps = null;
    let A = [0, 0, 0, 0], B = [0, 0, 0, 0], size = 0;
    const c = xyOf(t.c), a = xyOf(t.a), b = xyOf(t.b);
    const dir = (deg) => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
    if (kind === 3 || kind === 16) {
      ps = (t.pts || []).map(xyOf).filter((p) => Number.isFinite(p[0] + p[1]));
      if (ps.length) {
        const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
        size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      }
    } else if (kind === 1 || kind === 14) { A = [c[0], c[1], Math.abs(t.r), 0]; size = 2 * Math.abs(t.r); }
    else if (kind === 2) {
      A = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      size = Math.max(A[2] - A[0], A[3] - A[1]);
    } else if (kind === 4) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      A = [a[0], a[1], dx / L, dy / L];
    } else if (kind === 5) { A = [c[0], c[1], Math.min(t.r1, t.r2), Math.max(t.r1, t.r2)]; size = 2 * A[3]; }
    else if (kind === 6) {
      const span = (((t.t2 - t.t1) % 360) + 360) % 360 || 360;
      A = [c[0], c[1], t.r > 0 ? t.r : 0, span];
      B = [...dir(t.t1), ...dir(t.t1 + span)];
      size = t.r > 0 ? 2 * t.r : 0;
    } else if (kind === 11 || kind === 17) { A = [a[0], a[1], b[0], b[1]]; size = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); if (kind === 17) B = [Math.max(1, Math.min(60, t.n | 0)), 0, 0, 0]; }
    else if (kind === 12 || kind === 13) A = [a[0], a[1], b[0] - a[0], b[1] - a[1]];
    else if (kind === 15) {
      // the arc through a, m, b (Region.arc3): ccw from its start over span degrees
      const m = xyOf(t.m);
      const arc = typeof Region !== 'undefined' && Region.arc3 ? Region.arc3(CX.C(a[0], a[1]), CX.C(m[0], m[1]), CX.C(b[0], b[1])) : null;
      if (!arc || !arc.center) { kind = 11; A = [a[0], a[1], b[0], b[1]]; }
      else {
        const cx = arc.center.re, cy = arc.center.im, TAU = 2 * Math.PI;
        const ta = Math.atan2(a[1] - cy, a[0] - cx), tb = Math.atan2(b[1] - cy, b[0] - cx), tm = Math.atan2(m[1] - cy, m[0] - cx);
        const ccw = (x) => (((x - ta) % TAU) + TAU) % TAU;
        const s0 = ccw(tm) < ccw(tb) ? ta : tb, span = ccw(tm) < ccw(tb) ? ccw(tb) : TAU - ccw(tb);
        A = [cx, cy, arc.radius, span * 180 / Math.PI];
        B = [Math.cos(s0), Math.sin(s0), Math.cos(s0 + span), Math.sin(s0 + span)];
      }
    } else if (kind === 18) { A = [c[0], c[1], Math.abs(t.r), 0]; B = [Math.max(1, Math.min(40, t.nc | 0)), Math.max(1, Math.min(72, t.nr | 0)), 0, 0]; size = 2 * Math.abs(t.r); }
    if (![...A, ...B].every(Number.isFinite)) return null;
    return { kind, A, B, size, pts: ps };
  }
  function drawPreimage(st) {
    if (!ok || !st || !(st.view || st.sphere)) return;
    const recs = [], pts = [], forms = [];
    for (const t of st.targets || []) {
      if (recs.length >= MAX_TARGETS * 24) break;
      if (!t || t.visible === false || !TKIND[t.kind]) continue;
      const pk = packShape(t);
      if (!pk) continue;
      const { kind, A, B, size } = pk;
      let start = 0, count = 0;
      if (kind === 3 || kind === 16) {
        const ps = pk.pts;
        const room = MAX_PTS - pts.length;
        if (ps.length < (kind === 3 ? 3 : 2) || room < (kind === 3 ? 3 : 2)) continue;
        const n = Math.min(ps.length, room);
        start = pts.length; count = n;
        for (let i = 0; i < n; i++) pts.push(ps[Math.round(i * (ps.length - 1) / Math.max(1, n - 1))]);
      } else if (kind === 7) {
        if (forms.length >= MAX_FORMS) continue;
        const src = formulaSource(t, forms.length);
        if (!src) continue;
        start = forms.length;
        forms.push(src);
      } else if (kind === 19) {
        // a curve formula: one record per piece (its equation's g = A - B, |A - B| for complex sides; its restriction's
        // level, or -1), stroked where |g(w)| / |grad g| in device px is under half the width (PRE_FS)
        for (const pf of curveForms(t)) {
          const ng = pf.gi ? 2 : 1;
          if (recs.length >= MAX_TARGETS * 24 || forms.length + ng + (pf.r ? 1 : 0) > MAX_FORMS) break;
          const gs = formulaSource({ expr: pf.g }, forms.length);
          const gis = pf.gi ? formulaSource({ expr: pf.gi }, forms.length + 1) : null;
          const rs = pf.r ? formulaSource({ expr: pf.r }, forms.length + ng) : null;
          if (!gs || (pf.gi && !gis) || (pf.r && !rs)) continue;
          const gi = forms.length;
          forms.push(gs);
          if (gis) forms.push(gis);
          if (rs) forms.push(rs);
          const col = col3(t.color, [0.04, 0.23, 0.61]), edge = col3(t.edge, col.map((x) => 0.55 * x));
          recs.push(19, 0, gi, gis ? 1 : 0, 0, 0, 0, 0, rs ? gi + ng : -1, 0, 0, 0, ...col, t.alpha ?? 1, ...edge, t.width ?? 2 * (st.dpr || 1), 0, 0, 0, 0);
        }
        continue;
      }
      const area = kind < 10;
      const col = col3(t.color, area ? [0.23, 0.44, 0.83] : [0.04, 0.23, 0.61]);
      const cmp = t.complement && area && kind !== 8;   // (v16: a gdisc's form holds its side)
      const edge = col3(t.edge, col.map((x) => 0.55 * x));
      const cell = size > 0 ? nice125(size / 4) : (st.wGrid > 0 ? st.wGrid : 0.5);
      recs.push(kind, cmp ? 1 : 0, start, count, ...A, ...B, ...col, t.alpha ?? (area ? 0.4 : 1), ...edge, t.width ?? 2 * (st.dpr || 1), cell, 0, 0, 0);
    }
    const nt = recs.length / 24;
    if (!nt) return;
    const sph = !!st.sphere;
    const P = preProgram(forms, sph);
    if (!P) return;
    // records, then vertices, one texel each
    const W = nt * 6 + pts.length;     // at most 352 texels: one row
    const data = new Float32Array(W * 4);
    data.set(recs);
    pts.forEach((p, i) => { data[recs.length + 4 * i] = p[0]; data[recs.length + 4 * i + 1] = p[1]; });
    use(P, st.map);
    gl.activeTexture(gl.TEXTURE4);
    if (!ptsTex) ptsTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, ptsTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, 1, 0, gl.RGBA, gl.FLOAT, data);
    const dpr = st.dpr || 1;
    u1f(P, 'uDpr', dpr);
    u1i(P, 'uTN', nt);
    u3(P, 'uHalo', col3(st.halo, [1, 1, 1]));
    u1f(P, 'uHaloA', st.haloA ?? 0.85);
    if (sph) {
      // the globe's own triangles at its depth: only the visible hemisphere, nothing written
      uM4(P, 'uMVP', st.sphere.MVP);
      const g = sphere();
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);   // another program over the same triangles
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (!dt) gl.disable(gl.DEPTH_TEST);
      return;
    }
    u2f(P, 'uCenter', st.view.cx, st.view.cy);
    u2f(P, 'uInvScale', 1 / (st.view.s * dpr), 1 / (st.view.s * dpr));
    u4f(P, 'uVp', vpX, vpY, fw, fh);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  // ---------------- 3D ----------------
  const M4 = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    },
    persp(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    },
    lookAt(eye, at, up) {
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
      const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const z = norm(sub(eye, at)), x = norm(crs(up, z)), y = crs(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    },
    apply(m, p) {
      const x = p[0], y = p[1], z = p[2];
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
    },
  };
  function camera(cam, pw, ph) {
    const D = Math.PI / 180;
    cam = Object.assign({ yaw: -38 * D, pitch: 30 * D, dist: 8, tx: 0, ty: 0, tz: 0, fov: 28 * D }, cam);
    const eye = [
      cam.tx + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw),
      cam.ty + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
      cam.tz + cam.dist * Math.sin(cam.pitch),
    ];
    const V = M4.lookAt(eye, [cam.tx, cam.ty, cam.tz], [0, 0, 1]);
    const Pm = M4.persp(cam.fov || 28 * Math.PI / 180, pw / ph, Math.max(0.02, cam.dist * 0.02), cam.dist * 30);
    return { MVP: M4.mul(Pm, V), eye };
  }
  // Light rig, fixed in the world (spec 6.9): key azimuth 135 deg elevation 50 deg, fill azimuth -45 deg elevation
  // 20 deg. The azimuths are bearings (clockwise from +y, the hillshade convention), i.e. math angles -45 and 135:
  // with the default cameras (yaw -38 / -60) the key sits high over the viewer's shoulder and the fill rakes from
  // behind. Read as math angles the key would backlight every default view and leave the faces we look at in shade.
  const dirOf = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)]; };
  const bearing = (b) => 90 - b;
  const KEY_DIR = dirOf(bearing(135), 50), FILL_DIR = dirOf(bearing(-45), 20);
  let sceneLight = null;
  const defaultLight = (dark) => ({ sky: toLin3(hexRGB(dark ? '#9FB2C0' : '#E6EEF4')), ground: toLin3(hexRGB(dark ? '#3A3F44' : '#8C9296')) });
  function lightUniforms(P, lt, specK, specE, rimK) {
    u3(P, 'uKeyDir', KEY_DIR);
    u3(P, 'uFillDir', FILL_DIR);
    u3(P, 'uSky', lt.sky);
    u3(P, 'uGround', lt.ground);
    u1f(P, 'uSpecK', specK);
    u1f(P, 'uSpecE', specE);
    u1f(P, 'uRimK', rimK);
  }

  // Landscape colours (sRGB) with theme defaults derived from the background when the app omits them
  function landColors(st) {
    const c = st.colors || {};
    const bg = col3(st.bg, null);
    const dark = c.landBottom ? lum(col3(c.landBottom)) < 0.18 : (bg ? lum(bg) < 0.18 : false);
    const D = dark ? {
      floor: '#10181D', box: '#36474F', modLine: '#05090B', argLine: '#FFFFFF', plaster: '#C9CFD2', shadow: '#000000', shadowA: 0.55,
      hemiSky: '#9FB2C0', hemiGround: '#3A3F44', accent: '#52B7D3', minor: '#14212A', medium: '#1A2D38', major: '#21404F', landBottom: '#0A1013', cut: '#FF6B3D', probe: '#E3EAEE',
      under: '#5D6E78',
    } : {
      floor: '#FAFCFC', box: '#B3BEC4', modLine: '#18232A', argLine: '#FFFFFF', plaster: '#ECEEEC', shadow: '#2E3D47', shadowA: 0.30,
      hemiSky: '#E6EEF4', hemiGround: '#8C9296', accent: '#0A6A87', minor: '#E2EEF2', medium: '#D3E6ED', major: '#B5D4E0', landBottom: '#DCE4E7', cut: '#CC3311', probe: '#121A20',
      under: '#8A9AA4',
    };
    const o = { dark };
    for (const k of Object.keys(D)) o[k] = k === 'shadowA' ? (c.shadowA ?? D.shadowA) : col3(c[k], D[k]);
    return o;
  }
  // height pass cache: (chain, parameters, map, box, N, height mode, H, mu) -> textures
  let land = null;
  function landHeights(st, N, mode, H, mu, aspect) {
    const b = st.box;
    const P1 = program('landTF'), P2 = program('landNrm');
    if (!P1 || !P2) return land && land.N === N ? land : null;   // compiling: keep the last heights
    const key = [P1.ch.key, P1.ch.hash, mapKeyOf(mapFor(st.map, P1.ch)), b.x0, b.x1, b.y0, b.y1, N, mode, H, mu].join('|');
    if (land && land.key === key) return land;
    if (!land || land.N !== N) {
      if (land) { gl.deleteTexture(land.tex1); gl.deleteTexture(land.tex2); }
      land = { N, tex1: floatTex(), tex2: floatTex() };
    }
    const bytes = N * N * 16;
    use(P1, st.map);
    u1i(P1, 'uN', N);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu);
    runTF(P1, empty(), gl.POINTS, N * N, 0, bytes, land.tex1, N, N, gl.RGBA32F, gl.RGBA);
    use(P2);
    u1i(P2, 'uN', N);
    u2f(P2, 'uAspect', aspect[0], aspect[1]);
    u1f(P2, 'uH', H);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
    runTF(P2, empty(), gl.POINTS, N * N, 0, bytes, land.tex2, N, N, gl.RGBA32F, gl.RGBA);
    land.key = key;
    return land;
  }
  // ---- All sheets ----
  const SHEET_MAX = 24;
  // The sheet combinations of the current chain for map (mode 0: the steps in (a, b] from the w_a-plane) and window W
  // (sheets on each side of the principal one for log and irrational powers): {K (surfaces drawn, at most 24), total,
  // a, b, W, infinite (a log or irrational power among the steps), steps}; null when the map has no multivalued step
  // in (a, b], cannot be drawn as sheets (a homotopy, or a d/dz in (a, b] with a > 0) or the chain has no
  // chainSheetRange (GLChain). Combos 0..K-1 go to chainSheetRange as they are (it decodes them, steps in chain order).
  function sheetPlan(map, W) {
    const info = cur.info;
    if (!info || !hasSheets(info) || !info.sheets || !Array.isArray(info.sheets.steps)) return null;
    const m = map || {};
    if ((m.mode || 0) !== 0) return null;
    // a > 0: the steps in (a, b] from points of the w_a-plane (chainSheetRange); never across a d/dz (its input is a
    // function of z, not a point: chainSheetRange gives NaN there)
    const a = Math.max(0, m.a || 0), b = m.b || 0;
    if (a > 0 && (info.derivs || []).some((d) => d > a && d <= b)) return null;
    const all = info.sheets.steps.filter((s) => s && s.k >= 1);
    const steps = all.filter((s) => s.k > a && s.k <= b).sort((p, q) => p.k - q.k);
    if (!steps.length) return null;
    W = clamp(Math.round(W) || 2, 1, 4);
    // GLChain's counts for the stages in (a, b] (combos capped at 24, total not), else the product over the pieces
    let K = 1;
    for (const s of steps) K *= s.n > 0 ? s.n : 2 * W + 1;
    let total = K;
    try {
      if (typeof info.sheets.total === 'function') { const t = Math.floor(+info.sheets.total(W, b, a)); if (t > 0) total = t; }
      if (typeof info.sheets.combos === 'function') { const c = Math.floor(+info.sheets.combos(W, b, a)); if (c > 0) K = c; }
    } catch (e) { /* keep the product */ }
    K = Math.min(SHEET_MAX, K);
    if (K < 2) return null;
    return { K, total: Math.max(total, K), a, b, W, infinite: steps.some((s) => !(s.n > 0)), steps };
  }
  // per-cell sheet heights (LAND_SHEET_TF_VS): cache keyed like landHeights, plus the stage, window and combos
  let landS = null;
  function sheetHeights(st, sp, N, mode, H, mu, aspect) {
    const P1 = program('landSheetTF');
    if (!P1 || !hasSheets(P1.ch.info)) return landS && landS.want === N && landS.K === sp.K ? landS : null;
    // cells per side: about the plain landscape's cell count in all, at least 96 per side
    const K = sp.K, tileC = Math.ceil(Math.sqrt(K)), tileR = Math.ceil(K / tileC);
    let M = Math.max(Math.min(N - 1, 96), Math.floor(Math.sqrt(2 * (N - 1) * (N - 1) / K)));
    M = Math.max(8, Math.min(M, N - 1, Math.floor(maxTex / (2 * tileC)), Math.floor(maxTex / (2 * tileR))));
    const texW = tileC * 2 * M, texH = tileR * 2 * M;
    const b = st.box;
    const key = [P1.ch.key, P1.ch.hash, sp.a, sp.b, sp.W, K, b.x0, b.x1, b.y0, b.y1, M, mode, H, mu].join('|');
    if (landS && landS.key === key) return landS;
    if (!landS) landS = { tex1: floatTex() };
    use(P1, null);
    u1i(P1, 'uN', M + 1);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u2f(P1, 'uAspect', aspect[0], aspect[1]);
    u1i(P1, 'uSheetA', sp.a); u1i(P1, 'uSheetB', sp.b); u1i(P1, 'uSheetK', K); u1i(P1, 'uSheetW', sp.W); u1i(P1, 'uTileC', tileC); u1i(P1, 'uTexW', texW);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu);
    runTF(P1, empty(), gl.POINTS, texW * texH, 0, texW * texH * 16, landS.tex1, texW, texH, gl.RGBA32F, gl.RGBA);
    Object.assign(landS, { key, N: M + 1, want: N, K, tileC, a: sp.a, b: sp.b, W: sp.W, sheet: true });
    return landS;
  }
  const MATERIALS = { phase: 0, tiles: 1, plaster: 2 };
  // Geometry of the landscape block for a domain box and height scale (world units: the longer side spans [-1, 1]).
  // center / radius: the bounding sphere of the block with its floor plate, for camera fitting.
  function landGeom(box, scale) {
    const BW = box.x1 - box.x0, BH = box.y1 - box.y0, Mx = Math.max(BW, BH) || 1;
    const aspect = [BW / Mx, BH / Mx];
    const H = 0.55 * clamp(scale ?? 1, 0.05, 8);
    const floorZ = -H - 0.08;
    const ext = [aspect[0] + 0.16, aspect[1] + 0.16];
    return { aspect, H, floorZ, ext, Mx, center: [0, 0, 0.5 * (H + floorZ)], radius: Math.hypot(ext[0], ext[1], 0.5 * (H - floorZ)) };
  }
  // Camera distance at which a sphere of radius r fits a pw x ph frame (vertical fov) with a margin factor.
  function fitDist(r, fov, pw, ph, margin) {
    const asp = pw > 0 && ph > 0 ? Math.min(1, pw / ph) : 1;
    const half = Math.atan(Math.tan(0.5 * (fov || 28 * Math.PI / 180)) * Math.max(0.05, asp));
    return r / Math.sin(half) * (margin || 1.05);
  }
  // st: {map, box:{x0,x1,y0,y1}, cam, heightMode, scale, mu, material, unitLevel, sectors, cells, dpr, colors:{...},
  //      outlines:[{res, color, map, cacheKey}] (map: into the plane of the box), probe:{x, y},
  //      sheets:{W} (All sheets: every surface of the map's multivalued steps, see sheetPlan; info.sheets says what
  //      was drawn: {K, total, W, N, infinite}, null for the principal branch)}
  // map may be a homotopy (mode 1 / 2 at t): its heights are cached per t like any other map
  function drawLandscape(st) {
    if (!ok) return null;
    const { MVP, eye } = camera(st.cam, fw, fh);
    const box = st.box;
    const BW = box.x1 - box.x0, BH = box.y1 - box.y0;
    const { aspect, H, floorZ, Mx } = landGeom(box, st.scale);
    const modeName = st.heightMode || 'log';
    const mode = { log: 0, abs: 1, re: 2, im: 3, reLin: 4, imLin: 5 }[modeName] ?? 0;
    const mu = st.mu > 0 ? st.mu : 1;
    const N = clamp(Math.round(st.cells || 256), 32, 512);
    const dpr = st.dpr || Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const C = landColors(st);
    const material = MATERIALS[st.material] ?? (st.style === 'classic' ? 0 : 0);
    const lt = { sky: toLin3(C.hemiSky), ground: toLin3(C.hemiGround) };
    const heightOf = (v) => {
      if (mode === 0) return H * (2 / Math.PI) * Math.atan(Math.log(Math.max(v, 1e-300)) / 1.4);
      if (mode === 1) return H * ((4 / Math.PI) * Math.atan(v / mu) - 1);
      if (mode >= 4) return H * Math.max(-1.25, Math.min(1.25, v / mu));
      return H * (2 / Math.PI) * Math.atan(v / mu);
    };
    const info = { MVP, eye, aspect, floorZ, top: H, H, hs: H, heightOf, sheets: null };
    // All sheets (st.sheets: {W}): the covering surface, when the chain and the map allow it (else the principal
    // branch, info.sheets null); while its programs compile the principal branch stands in
    const sp = st.sheets ? sheetPlan(st.map, st.sheets.W) : null;
    const Ls = sp ? program('landSheet') : null;   // (both sheet programs start compiling here)
    let hs = sp ? sheetHeights(st, sp, N, mode, H, mu, aspect) : null;
    if (!Ls) hs = null;
    const hd = hs || landHeights(st, N, mode, H, mu, aspect);
    if (!hd) return info;
    if (hs) info.sheets = { K: hs.K, total: sp.total, W: sp.W, N: hs.N, infinite: sp.infinite };
    const ext = [aspect[0] + 0.16, aspect[1] + 0.16];
    const camD = Math.hypot(eye[0] - (st.cam.tx || 0), eye[1] - (st.cam.ty || 0), eye[2] - (st.cam.tz || 0));
    const fogNear = Math.max(0.01, camD - 1.6), fogFar = camD + 1.6;
    const common = (P) => {
      uM4(P, 'uMVP', MVP);
      u3(P, 'uEye', eye);
      u1f(P, 'uDpr', dpr);
      u1i(P, 'uN', hd.N);
      u4f(P, 'uBox', box.x0, box.y0, BW, BH);
      u2f(P, 'uAspect', aspect[0], aspect[1]);
      u1f(P, 'uH', H);
      u1f(P, 'uFloorZ', floorZ);
      u1i(P, 'uMaterial', material);
      u3(P, 'uPlaster', C.plaster);
      u3(P, 'uModLine', C.modLine);
      u3(P, 'uArgLine', C.argLine);
      // (the figure's art layer: no white sea-level line, |F| = 1 is an ordinary contour of the ln|F| family)
      u1f(P, 'uSea', st.seaLine === false ? 0 : 1);
      u3(P, 'uFogCol', C.landBottom);
      u1f(P, 'uFogNear', fogNear);
      u1f(P, 'uFogFar', fogFar);
      dcUniforms(P, { style: 'enhanced', sectors: st.sectors || 12, dark: C.dark }, dpr);
      u1i(P, 'uSheetK', hs ? hs.K : 0); u1i(P, 'uTileC', hs ? hs.tileC : 1);
      if (hs) { u1i(P, 'uSheetA', hs.a); u1i(P, 'uSheetB', hs.b); u1i(P, 'uSheetW', hs.W); }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, hd.tex1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, hs ? hd.tex1 : hd.tex2);
    };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.bindVertexArray(empty());
    // floor plate: faint graph paper, phase print, contact shading. Seen from above it lies under the surface; seen
    // from below the plate (the camera under it) it is drawn last, as a light veil, so the underside stays visible.
    const below = eye[2] < floorZ;
    const floorPass = (alpha) => {
      const Fp = program('floor');
      if (!Fp) return;
      use(Fp, st.map);
      common(Fp);
      u2f(Fp, 'uExt', ext[0], ext[1]);
      u3(Fp, 'uFloorCol', C.floor); u3(Fp, 'uMinor', C.minor); u3(Fp, 'uMed', C.medium); u3(Fp, 'uMajor', C.major);
      u3(Fp, 'uShadow', C.shadow); u1f(Fp, 'uShadowA', C.shadowA);
      u1f(Fp, 'uPrint', material === 2 || st.floorPrint === false ? 0 : 1);
      u1f(Fp, 'uPlateA', alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    if (!below) floorPass(0.8);
    gl.disable(gl.BLEND);
    // relief: an open sheet, both sides drawn (no skirt walls, no block)
    const Lp = hs ? Ls : program('land');
    if (Lp) {
      use(Lp, st.map);
      common(Lp);
      lightUniforms(Lp, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
      u3(Lp, 'uCut', C.cut);
      u3(Lp, 'uUnder', C.under);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, (hs ? hs.K : 1) * 2 * (hd.N - 1) * (hd.N - 1));
    }
    if (below) {
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      floorPass(0.22);
      gl.depthMask(true);
    }
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);
    // the domain's footprint on the plate (a faint rectangle; the surface itself has no sides)
    const ax = aspect[0], ay = aspect[1];
    const cs = [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]];
    let far = 0, fd = -1;
    cs.forEach((p, i) => { const d = Math.hypot(p[0] - eye[0], p[1] - eye[1]); if (d > fd) { fd = d; far = i; } });
    const boxM = [];
    for (let i = 0; i < 4; i++) boxM.push(segM([cs[i][0], cs[i][1], floorZ], [cs[(i + 1) % 4][0], cs[(i + 1) % 4][1], floorZ], 0.5 * dpr));
    gl.depthMask(false);
    drawMarks(MVP, boxM, C.box, below ? 0.4 : 0.8, { zBias: 0.0002 });
    info.backCorner = [cs[far][0], cs[far][1]];
    // source outlines printed on the floor plate: clipped to the plate, fading with its outer rim, and hidden
    // wherever the surface covers them (plain depth test: never drawn through the relief)
    const mg = 0.08 * Mx;
    const plate = { x0: box.x0 - mg, y0: box.y0 - mg, x1: box.x1 + mg, y1: box.y1 + mg, w: 0.9 * mg };
    gl.depthFunc(gl.LEQUAL);
    for (const o of st.outlines || []) {
      if (!o || !o.res) continue;
      drawLines(o.res, { map: o.map || null, cacheKey: o.cacheKey || null, dpr, M: 4, width: 1.25 * dpr, color: col3(o.color, C.modLine), alpha: below ? 0.45 : 1, fade: plate, floor: { MVP, box, aspect, floorZ, clip: plate } });
    }
    // unit level: the plane h(|F| = 1)
    if (st.unitLevel) {
      const Up = program('ulevel');
      if (Up) {
        use(Up);
        uM4(Up, 'uMVP', MVP);
        u2f(Up, 'uAspect', ax, ay);
        u1f(Up, 'uZ', heightOf(1));
        u3(Up, 'uColor', C.accent);
        u1f(Up, 'uDpr', dpr);
        gl.bindVertexArray(empty());
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
      }
    }
    // probe needle from the floor to (z, h(z))
    if (st.probe) {
      const Pp = program(hs ? 'probeSheet' : 'probe');
      if (Pp) {
        use(Pp, st.map);
        if (hs) { u1i(Pp, 'uSheetA', hs.a); u1i(Pp, 'uSheetB', hs.b); u1i(Pp, 'uSheetW', hs.W); }
        uM4(Pp, 'uMVP', MVP);
        u2f(Pp, 'uPx', fw, fh);
        u1f(Pp, 'uZBias', 0);
        u2f(Pp, 'uProbe', st.probe.x ?? st.probe.re ?? st.probe[0], st.probe.y ?? st.probe.im ?? st.probe[1]);
        u4f(Pp, 'uBox', box.x0, box.y0, BW, BH);
        u2f(Pp, 'uAspect', ax, ay);
        u1f(Pp, 'uFloorZ', floorZ);
        u1f(Pp, 'uDpr', dpr);
        u1i(Pp, 'uHMode', mode); u1f(Pp, 'uH', H); u1f(Pp, 'uMu', mu);
        u3(Pp, 'uColor', C.probe);
        gl.bindVertexArray(empty());
        // inside the block the needle is hidden: shown ghosted, so the ring on the surface leads
        const nI = hs ? hs.K : 1;
        gl.depthFunc(gl.GREATER); u1f(Pp, 'uAlpha', 0.2); gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, nI);
        gl.depthFunc(gl.LEQUAL); u1f(Pp, 'uAlpha', 1); gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, nI);
        gl.bindVertexArray(null);
      }
    }
    resetState();
    return info;
  }

  // SPEC 4.8 on a globe (P3): the scissor [x, y, w, h] (device px of the current pane, bottom-left origin, padded by pad)
  // of the image on the sphere of a w-box b, seen through MVP from eye; null when no scissor can be promised (the
  // image may reach the far side or the silhouette) or none is needed (it covers the pane); [0, 0, 0, 0] when it misses
  // the pane. The box's four sides (circles on the sphere, under the conjugate lift) are lifted and projected,
  // subdivided until consecutive screen points are under 2 px apart. Every boundary point must face the eye (by a
  // margin), and the sphere's point farthest from the eye must lie outside the box: then the box's image is a disc
  // inside the visible hemisphere, whose projection is bounded by its projected boundary
  function globeScissorOf(b, MVP, eye, pad = 4) {
    if (!b || ![b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) || b.x1 < b.x0 || b.y1 < b.y0) return null;
    const E = Math.hypot(eye[0], eye[1], eye[2]);
    if (!(E > 1.0001)) return null;
    const F = [-eye[0] / E, -eye[1] / E, -eye[2] / E];
    if (F[2] < 1 - 1e-9) {
      const fx = F[0] / (1 - F[2]), fy = -F[1] / (1 - F[2]);
      if (fx >= b.x0 && fx <= b.x1 && fy >= b.y0 && fy <= b.y1) return null;
    }
    const lift = (x, y) => {
      const q = x * x + y * y;
      if (q > 1) { const iq = 1 / q; return [2 * x * iq / (1 + iq), -2 * y * iq / (1 + iq), (1 - iq) / (1 + iq)]; }
      return [2 * x / (q + 1), -2 * y / (q + 1), (q - 1) / (q + 1)];
    };
    const at = (x, y) => {
      const p = lift(x, y), v = [eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]];
      if (!((v[0] * p[0] + v[1] * p[1] + v[2] * p[2]) > 0.02 * Math.hypot(v[0], v[1], v[2]))) return null;
      const c = M4.apply(MVP, p);
      if (!(c[3] > 1e-6)) return null;
      return [(c[0] / c[3] * 0.5 + 0.5) * fw, (c[1] / c[3] * 0.5 + 0.5) * fh];
    };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
    const add = (q) => { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; };
    for (const [ax, ay, bx, by] of [[b.x0, b.y0, b.x1, b.y0], [b.x1, b.y0, b.x1, b.y1], [b.x1, b.y1, b.x0, b.y1], [b.x0, b.y1, b.x0, b.y0]]) {
      const P = (t) => at(ax + (bx - ax) * t, ay + (by - ay) * t);
      const qa = P(0), qb = P(1);
      if (!qa || !qb) return null;
      add(qa); add(qb);
      const stack = [[0, 1, qa, qb, 0]];
      while (stack.length) {
        const [ta, tb, sa, sb, d] = stack.pop();
        if (Math.hypot(sb[0] - sa[0], sb[1] - sa[1]) <= 2 || d >= 14) continue;
        if (++n > 4096) return null;
        const tm = 0.5 * (ta + tb), sm = P(tm);
        if (!sm) return null;
        add(sm);
        stack.push([ta, tm, sa, sm, d + 1], [tm, tb, sm, sb, d + 1]);
      }
    }
    const cx0 = Math.max(0, Math.floor(x0) - pad), cy0 = Math.max(0, Math.floor(y0) - pad);
    const cx1 = Math.min(fw, Math.ceil(x1) + pad), cy1 = Math.min(fh, Math.ceil(y1) + pad);
    if (cx1 <= cx0 || cy1 <= cy0) return [0, 0, 0, 0];
    if (cx0 <= 0 && cy0 <= 0 && cx1 >= fw && cy1 >= fh) return null;
    return [cx0, cy0, cx1 - cx0, cy1 - cy0];
  }
  // st: {map, mode ('image'|'color'), cam, style, sectors, grid, colors:{plane, gridMajor, axis, ink, accent?, hemiSky?, hemiGround?},
  //      regions:[{res, st} | {inv, fwd: [{res, st}], onResult}], lines:[{res, st}], plane:bool, probe:{w}, dpr,
  //      pre:{map, targets, halo?, haloA?, wGrid?} (drawPreimage over the globe)}
  // A region entry with inv is an exact image (SPEC 4.6, 10.3): drawInverse's st (viewKind 'globe' and this frame's
  // camera are added here, and the scissor of inv.globeBox, a w-box of the image, when one can be promised), drawn at
  // its place in the list, so inverse and forward shapes interleave in list order; when it is not drawn ('pending',
  // 'error') its forward draws fwd stand in, at the same place. onResult(res) reports the outcome to the app.
  // map, and the maps of regions and lines, may be homotopies (mode 1 / 2 at t; without a cacheKey they are evaluated
  // into per-resource scratch textures, so playback adds no cache entries)
  function drawSphere(st) {
    if (!ok) return null;
    const { MVP, eye } = camera(st.cam, fw, fh);
    const c = st.colors || {};
    const plane = col3(c.plane, col3(st.shell, '#FCFDFD'));
    const dark = lum(plane) < 0.18;
    const gridMajor = col3(c.gridMajor, dark ? '#21404F' : '#B5D4E0');
    const axis = col3(c.axis, col3(st.ink, dark ? '#94A8B3' : '#2E3D47'));
    const accent = col3(c.accent, dark ? '#52B7D3' : '#0A6A87');
    const dpr = st.dpr || Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const lt = defaultLight(dark);
    if (c.hemiSky) lt.sky = toLin3(col3(c.hemiSky));
    if (c.hemiGround) lt.ground = toLin3(col3(c.hemiGround));
    sceneLight = lt;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    const phase = st.mode === 'color';
    const P = program(phase ? 'sphereP' : 'sphere');
    if (P) {
      use(P, st.map);
      uM4(P, 'uMVP', MVP);
      u3(P, 'uEye', eye);
      dcUniforms(P, { style: st.style, sectors: st.sectors, grid: st.grid, plane, ink: c.ink, dark }, dpr);
      u3(P, 'uPlaneCol', plane);
      u3(P, 'uGridMaj', gridMajor);
      u3(P, 'uAxisCol', axis);
      // the lattice's tiers in the grid colour (its coverage is what the shader uses)
      u1i(P, 'uNet', st.net === 'cart' ? 1 : st.net === 'polar' ? 0 : 2);
      u3(P, 'uMinor', gridMajor); u3(P, 'uMed', gridMajor); u3(P, 'uMajor', gridMajor);
      lightUniforms(P, lt, 0.18, 40, 0.12);
      const g = sphere();
      gl.disable(gl.BLEND);
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
    }
    // st.pre: target preimages over the globe (drawPreimage's st without view: {map, targets, halo, haloA, wGrid})
    if (st.pre && P) drawPreimage(Object.assign({}, st.pre, { sphere: { MVP, eye }, dpr, view: null }));
    // lifted regions and their edges: tested against the globe, never against each other (a casing written to
    // depth would otherwise hide parts of its own stroke)
    gl.depthMask(false);
    for (const r of st.regions || []) {
      if (r.inv) {
        let res = 'error';
        try {
          const sc = r.inv.globeBox ? globeScissorOf(r.inv.globeBox, MVP, eye, 4) : null;
          res = drawInverse(Object.assign({}, r.inv, { viewKind: 'globe', sphere: { MVP, eye }, scissor: sc }));
        } catch (err) { res = 'error'; if (r.onError) r.onError(err); }
        gl.depthMask(false);
        if (r.onResult) r.onResult(res);
        if (res === 'drawn') continue;
        for (const f of r.fwd || []) { if (f.pre) drawPreMapped(f.pre, Object.assign({}, f.st, { sphere: { MVP, eye } })); else drawRegion(f.res, Object.assign({}, f.st, { sphere: { MVP, eye } })); }
        continue;
      }
      if (r.pre) { drawPreMapped(r.pre, Object.assign({}, r.st, { sphere: { MVP, eye } })); continue; }
      drawRegion(r.res, Object.assign({}, r.st, { sphere: { MVP, eye } }));
    }
    for (const l of st.lines || []) drawLines(l.res, Object.assign({}, l.st, { sphere: { MVP, eye } }));
    // st.post: drawPreimage passes over everything drawn so far (P3b: the targets on the w-globe and a draft, each
    // exact per pixel through the identity map)
    for (const q of st.post || []) if (q && P) drawPreimage(Object.assign({}, q, { sphere: { MVP, eye }, dpr, view: null }));
    // equatorial plane, depth-clipped so the sphere sits half through it
    if (st.plane) {
      const Dp = program('disc');
      if (Dp) {
        use(Dp);
        uM4(Dp, 'uMVP', MVP);
        u1f(Dp, 'uR', 2.4);
        u1f(Dp, 'uDpr', dpr);
        u3(Dp, 'uPlaneCol', plane);
        u3(Dp, 'uAxisCol', axis);
        u3(Dp, 'uMinor', gridMajor); u3(Dp, 'uMed', gridMajor); u3(Dp, 'uMajor', gridMajor);
        gl.bindVertexArray(empty());
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
      }
      // projection ray N -> sphere point -> plane point
      const pw = st.probe && st.probe.w;
      if (pw) {
        const x = pw[0] ?? pw.re ?? pw.x, y = pw[1] ?? pw.im ?? pw.y;
        if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) < 1e6) {
          const q = x * x + y * y;
          // (the conjugate lift: the plane point of the projection ray is (x, -y, 0))
          const S = [2 * x / (q + 1), -2 * y / (q + 1), (q - 1) / (q + 1)], N = [0, 0, 1], Pl = [x, -y, 0];
          const hw = 0.5 * dpr;
          // N, S and Pl are collinear: one segment from N to the farther of the two
          const far = q < 1 ? S : Pl;
          drawMarks(MVP, [segM(N, far, hw), dotM(N, 2.5 * dpr), dotM(S, 2.5 * dpr), dotM(Pl, 2.5 * dpr)], accent, 1, { xray: true });
        }
      }
    }
    // silhouette: the circle of tangency seen from the eye, 1.25 px axis at 50%
    const D2 = eye[0] * eye[0] + eye[1] * eye[1] + eye[2] * eye[2];
    if (D2 > 1.0001) {
      const D = Math.sqrt(D2), e = eye.map((x) => x / D);
      const ctr = eye.map((x) => x / D2), rho = Math.sqrt(1 - 1 / D2);
      const up = Math.abs(e[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      let u = [up[1] * e[2] - up[2] * e[1], up[2] * e[0] - up[0] * e[2], up[0] * e[1] - up[1] * e[0]];
      const ul = Math.hypot(...u); u = u.map((x) => x / ul);
      const w = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
      const pt = (t) => [0, 1, 2].map((k) => ctr[k] + rho * (Math.cos(t) * u[k] + Math.sin(t) * w[k]));
      const sil = [];
      for (let i = 0; i < 160; i++) sil.push(segM(pt(2 * Math.PI * i / 160), pt(2 * Math.PI * (i + 1) / 160), 0.625 * dpr));
      drawMarks(MVP, sil, axis, 0.5, { once: true });   // last: it writes depth
    }
    resetState();
    return { MVP, eye };
  }

  // =================================================================================================================
  // Exact images: the inverse renderer (SPEC 4.2-4.5, 4.7, 4.8, 10.12)
  // =================================================================================================================
  // ---- shape records (4.3): drawPreimage's kind / A / B, plus the clip primitive and the polygon vertices ----
  const PACK_W = 1024;                  // texels per row of the frame's record texture
  const INV_POLY_MAX = 64;
  // the clip primitive of Region.clipPrimitive as texels: header (nIn, nHole), then 2 texels per piece
  const BIGF = 1e30, fcl = (x) => (x >= BIGF ? BIGF : x <= -BIGF ? -BIGF : x);
  function packPrim(prim, out) {
    const ins = prim ? prim.in || [] : [], holes = prim && prim.hole ? prim.hole : [];
    out.push(ins.length, holes.length, 0, 0);
    for (const pc of ins.concat(holes)) {
      if (pc.t === 'disc') out.push(1, pc.c[0], pc.c[1], pc.r, 0, 0, 0, 0);
      else if (pc.t === 'box') out.push(2, fcl(pc.x0), fcl(pc.x1), 0, fcl(pc.y0), fcl(pc.y1), 0, 0);
      else if (pc.t === 'half') out.push(3, pc.a[0], pc.a[1], 0, pc.d[0], pc.d[1], 0, 0);
      else if (pc.t === 'g') {
        let G = pc.G;
        if (formAnchor && typeof Constr !== 'undefined' && Constr.reanchor) G = Constr.reanchor(G, formAnchor);
        out.push(4, G.o[0], G.o[1], G.A, G.B[0], G.B[1], G.C, 0);
      }
      else out.push(0, 0, 0, 0, 0, 0, 0, 0);
    }
    return 1 + 2 * (ins.length + holes.length);       // texels: the header, then 2 per piece
  }
  let invTex = null, invTexKey = '', invTexRows = 0;
  let pack = null;                      // the frame's records: {recs: Map(id -> rec), forms, formsKey, data}
  // formula bundle (4.4): the first four visible formula shapes take slots 0-3; an edit is debounced 300 ms
  const FORM_DEBOUNCE = 300;
  const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; };
  let bundle = { srcs: [], key: hashStr(''), exprs: [], ids: [] }, bundleWant = null, bundleT = 0, bundleTimer = 0;
  // GLR.packShapes(list, opts) -> {recs, forms, formsKey}: packs every area shape of the frame once (one texture
  // upload when the records changed). rec (per shape id): {offset, kind, complement, formSlot, ok, reason, pending}.
  // ok false: the shape cannot be drawn inverse (more than 64 polygon vertices, a fifth formula shape, a formula
  // whose GLSL failed); pending: a formula edited within the last 300 ms (draw it forward meanwhile).
  function packShapes(list, opts = {}) {
    const now = opts.now ?? performance.now();
    const recs = new Map(), data = [];
    const want = [], wantExpr = [], wantIds = [];
    for (const s of list || []) {
      if (!s || s.visible === false || !TKIND[s.kind] || TKIND[s.kind] > 10) continue;
      const gk = gKind(s);
      const rec = { offset: 0, kind: gk || TKIND[s.kind], complement: gk ? false : !!s.complement, formSlot: -1, ok: true, reason: null, pending: false };
      recs.set(s.id, rec);
      let prim = null;
      try { prim = typeof Region !== 'undefined' && Region.clipPrimitive ? Region.clipPrimitive(s) : null; } catch (e) { prim = null; }
      const pk = packShape(s);
      if (!pk) { rec.ok = false; rec.reason = 'shape'; continue; }
      rec.A = pk.A; rec.B = pk.B;
      if (s.kind === 'polygon' && pk.pts.length > INV_POLY_MAX) { rec.ok = false; rec.reason = `polygon with more than ${INV_POLY_MAX} vertices`; }
      if (s.kind === 'formula') {
        if (want.length >= MAX_INV_FORMS) { rec.ok = false; rec.reason = 'fifth formula shape'; }
        else {
          const src = typeof GLChain !== 'undefined' && GLChain.levelGLSL ? GLChain.levelGLSL(s.expr, 'ilev' + want.length) : null;
          if (!src || !src.ok) { rec.ok = false; rec.reason = 'formula GLSL'; }
          else { rec.formSlot = want.length; want.push(src.source); wantExpr.push(String(s.expr)); wantIds.push(s.id); }
        }
      }
      // Lambda rule data (4.3): inside at z = 0; boundary through 0 (a half-plane line within 1e-12 |a| of 0, a sector
      // apex at 0)
      let at0 = 0, thru0 = 0;
      try { at0 = Region.levelOf(s)(CX.C(0, 0)) > 0 ? 1 : 0; } catch (e) { at0 = 0; }
      if (s.kind === 'halfplane') {
        const ax = s.a[0], ay = s.a[1], dx = s.b[0] - ax, dy = s.b[1] - ay, L = Math.hypot(dx, dy) || 1;
        thru0 = Math.abs((dx * ay - dy * ax) / L) <= 1e-12 * Math.hypot(ax, ay) ? 1 : 0;
      } else if (s.kind === 'sector') thru0 = Math.hypot(s.c[0], s.c[1]) <= 1e-12 ? 1 : 0;
      if (gk) thru0 = s._g.thru0 ? 1 : 0;             // v16: from incidence [C9]
      rec.C = [at0, thru0, 0, 0];
      rec.offset = data.length / 4;
      const n0 = data.length, n = packPrim(prim, data);
      rec.clipH = [data[n0], data[n0 + 1]];
      rec.clipU = new Float32Array(64);
      rec.clipU.set(data.slice(n0 + 4, n0 + 4 + 64));
      // the early-out box (polygons, bounded formulas); x0 > x1: none
      rec.box = [1, 1, 0, 0];
      if (!s.complement && (s.kind === 'polygon' || s.kind === 'formula')) {
        let bb = null;
        try { bb = s.kind === 'polygon' ? Region.bboxOf(s) : Region.formulaBox(s); } catch (e) { bb = null; }
        if (bb && [bb.x0, bb.x1, bb.y0, bb.y1].every(Number.isFinite) && bb.x0 <= bb.x1 && bb.y0 <= bb.y1) rec.box = [bb.x0, bb.y0, bb.x1, bb.y1];
      }
      rec.ptsOff = n;
      rec.nPts = 0;
      if (s.kind === 'polygon' && rec.ok) { rec.nPts = pk.pts.length; for (const p of pk.pts) data.push(p[0], p[1], 0, 0); }
    }
    // the formula bundle: an edit of the same formula shapes (same ids in the same slots) waits FORM_DEBOUNCE ms after
    // the last change, while the edited shapes are pending (forward) and the others keep the current program; a load,
    // an added or a removed formula shape switches at once
    const wkey = hashStr(want.join(''));
    if (wkey !== bundle.key) {
      const sameIds = bundle.ids && bundle.ids.length === wantIds.length && bundle.ids.every((id, i) => id === wantIds[i]);
      if (!bundleWant || bundleWant.key !== wkey) { bundleWant = { srcs: want, key: wkey, exprs: wantExpr, ids: wantIds }; bundleT = now; }
      if (!sameIds || opts.debounce === false || now - bundleT >= FORM_DEBOUNCE) { bundle = bundleWant; bundleWant = null; }
      else {
        for (const r of recs.values()) if (r.formSlot >= 0 && bundle.exprs[r.formSlot] !== wantExpr[r.formSlot]) { r.pending = true; r.ok = false; r.reason = 'formula edit pending'; }
        if (!bundleTimer && typeof setTimeout === 'function') bundleTimer = setTimeout(() => { bundleTimer = 0; if (api.onReady) api.onReady({ main: true }); }, FORM_DEBOUNCE + 20);
      }
    } else bundleWant = null;
    const fd = new Float32Array(Math.max(4, data.length));
    fd.set(data);
    pack = { recs, forms: bundle.srcs, formsKey: bundle.key, data: fd, texels: data.length / 4 };
    return { recs, forms: pack.forms, formsKey: pack.formsKey };
  }
  function uploadPack() {
    if (!pack) return;
    const texels = Math.max(1, pack.texels), rows = Math.ceil(texels / PACK_W);
    const key = pack.data.length + '|' + hashStr(Array.prototype.join.call(pack.data, ','));
    gl.activeTexture(gl.TEXTURE4);
    if (!invTex) invTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, invTex);
    if (key === invTexKey) return;
    const buf = new Float32Array(PACK_W * rows * 4);
    buf.set(pack.data.subarray(0, Math.min(pack.data.length, buf.length)));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, PACK_W, rows, 0, gl.RGBA, gl.FLOAT, buf);
    invTexKey = key; invTexRows = rows;
  }
  const formsSrc = (srcs) => (srcs.length ? srcs.join('') + 'float formulaLevel(int f, vec2 z) {\n' + srcs.map((_, i) => `  if (f == ${i}) return ilev${i}(z);\n`).join('') + '  return -1.0;\n}\n' : '');

  // ---- inverse programs (4.4): keyed inv|<inverse key>|<formula bundle>|B<n> (invS on the globe), in progs (so
  // context loss clears them) with their own LRU of 8 that never evicts a program drawn in this or the last frame.
  // Never a history stand-in. A failed compile is silent (one console line, no frameErr / lastError) and marks the
  // chain structure ineligible for the session.
  const INV_KEEP = 8;
  let invFrame = 0;                     // begin() / viewport() count: "this or the previous frame" = the last 4
  const invFailed = new Set();          // inverse keys whose program failed (session)
  function invProgKey(inv, B, globe, formsKey) { return `${globe ? 'invS' : 'inv'}|${inv.key}|${formsKey}|B${B}`; }
  // coldNonce (tests: the perf suite's cold-compile units, SPEC 13.12): every new inverse program gets a uniform the
  // compilers cannot fold, so its text is new to the machine (macOS caches compiled Metal libraries system-wide, and
  // ANGLE strips comments): its compile and first draw are cold, as on a user's first visit
  let coldNonce = 0;
  function invSources(info, B, globe, forms, extra) {
    const vs = globe ? SPHERE_VS : QUAD_VS;
    const L = typeof GLChain !== 'undefined' ? GLChain.LIB : '';
    let main = extra && extra.main ? extra.main : INV_MAIN(globe), pre = (globe ? INV_GLOBE_PRE : '') + (extra && extra.pre || '');
    if (coldNonce && !extra) {
      const tag = `uIxNonce${coldNonce++}_${Math.floor(Math.random() * 1e9)}`;
      pre += `uniform float ${tag};\n`;
      main = main.replace('  invWalk(w);', `  w.x += ${tag};\n  invWalk(w);`);
    }
    const fs = pre + L + info.inverse.lib + UTIL + (globe ? SHADE : '') + INV_HEAD(B, formsSrc(forms)) + info.inverse.walker + main;
    return [HEAD + vs, HEAD + fs];
  }
  function finishInv(e) {
    if (gl.isContextLost && gl.isContextLost()) return;      // not a failure: the restore recompiles
    const p = e.p;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = (!gl.getShaderParameter(e.vs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.vs))
        || (!gl.getShaderParameter(e.fs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.fs)) || gl.getProgramInfoLog(p) || 'link failed';
      gl.deleteShader(e.vs); gl.deleteShader(e.fs); gl.deleteProgram(p);
      e.p = e.vs = e.fs = null;
      e.state = 'error'; e.error = String(log).trim();
      if (!invFailed.has(e.ikey)) { invFailed.add(e.ikey); console.info('exact images: the inverse program did not compile; this chain draws forward (' + e.error.split('\n')[0].slice(0, 160) + ')'); }
      return;
    }
    gl.deleteShader(e.vs); gl.deleteShader(e.fs); e.vs = e.fs = null;
    const loc = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    gl.useProgram(p);
    for (let i = 0; i < nu; i++) {
      const u = gl.getActiveUniform(p, i);
      const name = u.name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(p, u.name);
      if (name in SAMPLER_UNITS) gl.uniform1i(loc[name], SAMPLER_UNITS[name]);
    }
    e.loc = loc; e.state = 'ready'; e.readyAt = performance.now();
  }
  function evictInv() {
    const list = [...progs.values()].filter((e) => e.inv && e.state !== 'pending' && invFrame - e.frame > 4);
    const n = [...progs.values()].filter((e) => e.inv).length;
    list.sort((a, b) => a.frame - b.frame || a.used - b.used);
    for (let i = 0; i < n - INV_KEEP && i < list.length; i++) {
      const e = list[i];
      if (e.p) gl.deleteProgram(e.p);
      progs.delete(e.id);
    }
  }
  // the inverse program for the current chain, B and view kind with the current formula bundle. start: begin its
  // compile when it is missing (never in side mode, never while forward programs of this chain still compile).
  // -> {state: 'ready' | 'pending' | 'error' | 'none', P, reason}
  function invProgram(B, globe, start, extra) {
    const info = cur.info, inv = info && info.inverse;
    if (!inv) return { state: 'none', reason: 'no inverse program for this chain' };
    if (!inv.ok) return { state: 'none', reason: inv.reason };
    if (invFailed.has(inv.key)) return { state: 'error', reason: 'compile failed' };
    const fk = (extra ? 'test:' + hashStr(extra.pre + extra.main) + '|' : '') + (pack ? pack.formsKey : '');
    const id = invProgKey(inv, B, globe, fk);
    let e = progs.get(id);
    if (!e) {
      if (!start || sideMode) return { state: 'none', reason: sideMode ? 'side draw' : 'not started' };
      for (const q of progs.values()) if (q.key === cur.key && q.state === 'pending' && !q.inv) return { state: 'pending', reason: 'forward programs first' };
      e = { id, name: globe ? 'invS' : 'inv', key: id, inv: true, ikey: inv.key, chain: false, state: 'pending', used: ++useClock, frame: invFrame, t0: performance.now() };
      progs.set(id, e);
      try {
        const [vs, fs] = invSources(info, B, globe, pack ? pack.forms : [], extra);
        e.srcLen = fs.length;
        startLink(e, vs, fs, false);
      } catch (err) { e.state = 'error'; e.error = String(err.message || err); if (!invFailed.has(inv.key)) { invFailed.add(inv.key); console.info('exact images: inverse program not built (' + e.error + ')'); } }
      evictInv();
    }
    e.used = ++useClock; e.frame = invFrame;
    if (e.state === 'pending') {
      if (!pcExt || syncDepth > 0 || gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR)) {
        finishInv(e);
        // landed outside the compile poll (a draw or a status query): tell the app as the poll would, once, after
        // this call (it warms the program at an idle moment and redraws the panes and thumbnails)
        if (e.state === 'ready' && syncDepth === 0) setTimeout(() => { if (api.onReady) api.onReady({ main: true, side: false }); }, 0);
      } else schedulePoll();
    }
    if (e.state === 'ready') return { state: 'ready', P: e };
    if (e.state === 'error') return { state: 'error', reason: e.error };
    return { state: 'pending', reason: 'compiling' };
  }
  // a ready inverse program of the current chain, view kind and formula bundle for another B class (never starts a
  // compile): a larger B first (exact for any alpha), else the largest smaller one (its front B sheets exact, the rest
  // through their transmittance, SPEC 13.12). warm: only programs already drawn (their first draw, the Metal pipeline
  // build, stalled the GPU process 75-200 ms: P2 review)
  function invAltProgram(Bwant, globe, extra, warm) {
    const info = cur.info, inv = info && info.inverse;
    if (!inv || !inv.ok || invFailed.has(inv.key)) return null;
    const fk = (extra ? 'test:' + hashStr(extra.pre + extra.main) + '|' : '') + (pack ? pack.formsKey : '');
    const order = [3, 5, INV_B_MAX].filter((b) => b !== Bwant).sort((a, b) => (a > Bwant) !== (b > Bwant) ? (a > Bwant ? -1 : 1) : (a > Bwant ? a - b : b - a));
    for (const B of order) {
      const e = progs.get(invProgKey(inv, B, globe, fk));
      if (e && e.state === 'ready' && (!warm || e.warm)) { e.used = ++useClock; e.frame = invFrame; return { P: e, B }; }
    }
    return null;
  }
  // ---- per-pass data from Inverse.prepare (cached per prep object and program op list) ----
  const passCache = new WeakMap();
  const isFinC = (z) => !!z && Number.isFinite(z.re) && Number.isFinite(z.im);
  function passData(inv, plan, prep) {
    let c = passCache.get(prep);
    if (c && c.inv === inv && c.plan === plan) return c.d;
    const N = Math.max(1, inv.nOps), ops = inv.ops;
    const d = { ref: new Float32Array(2 * N), N: new Int32Array(N).fill(1), RK: new Int32Array(N), AB: new Float32Array(4 * N), box: new Float32Array(4 * N),
      stopOp: -1, stopMob: [0, 0, 0, 0], stopT: new Float32Array(8), mobOn: false, pInP: 0, sing: new Float32Array(8), singN: 0, ok: true, reason: null,
      tail: prep.tail ? 1 : 0 };
    const TAU = 2 * Math.PI;
    for (let j = 0; j < plan.ops.length; j++) {
      const o = plan.ops[j];
      const g = ops.findIndex((q) => q.step === o.step && q.node === o.node && q.kind === o.kind);
      if (g < 0) { d.ok = false; d.reason = 'the plan does not match the chain\'s inverse program'; break; }
      const F = o.fam, ref = prep.refs[j];
      if (F && F.type === 'log') {
        // lambda_ref (3.2): ln|ref| + i Arg ref shifted into (lo, hi]
        let lr = { re: 0, im: 0 };
        if (isFinC(ref) && !(ref.re === 0 && ref.im === 0)) {
          lr = CX.log(ref);
          let im = lr.im + TAU * (Math.floor((F.lo - lr.im) / TAU) + 1);
          if (im > F.hi) im -= TAU;
          if (im <= F.lo) im += TAU;
          if (Number.isFinite(im)) lr = { re: lr.re, im };
        }
        d.ref[2 * g] = lr.re; d.ref[2 * g + 1] = lr.im;
      } else if (isFinC(ref)) { d.ref[2 * g] = ref.re; d.ref[2 * g + 1] = ref.im; }
      else { d.ref[2 * g] = NaN; d.ref[2 * g + 1] = NaN; }
      const Nj = prep.N[j];
      d.N[g] = Math.max(1, Math.min(64, Number.isFinite(Nj) ? Nj : 64));
      const sp = prep.rspec[j];
      if (sp && sp.kind === 'clip') { d.RK[g] = 1; d.AB.set([sp.A.re, sp.A.im, sp.B.re, sp.B.im], 4 * g); }
      else if (sp && sp.kind === 'box') { d.RK[g] = 2; d.box.set([sp.e ? sp.e.re : 0, sp.e ? sp.e.im : 0, fcl(sp.lo), fcl(sp.hi)], 4 * g); }
      else if (sp && sp.kind === 'branch') d.RK[g] = 3;
      if (prep.stopOp === j) d.stopOp = g;
    }
    if (prep.stopMob && d.stopOp >= 0) {
      const sm = prep.stopMob, T = CX.mobScaled(sm.T);
      d.mobOn = true; d.stopMob = [sm.uPole.re, sm.uPole.im, sm.pAcc.re, sm.pAcc.im]; d.pInP = sm.pInP ? 1 : 0;
      d.stopT.set([T[0].re, T[0].im, T[1].re, T[1].im, T[2].re, T[2].im, T[3].re, T[3].im]);
    }
    const sing = (prep.sing || []).slice(0, 4);
    sing.forEach((p, i) => { d.sing[2 * i] = p.re; d.sing[2 * i + 1] = p.im; });
    d.singN = sing.length;
    // saturation anchors (SPEC 13.12): the anchor op's index in the program, the affine ops' (A, B), each anchor's
    // model, geometry and (p, log p); the pattern origin (p - Q, Q) depends on the cell: drawInverse
    d.ancJ = -1; d.ancAB = [1, 0, 0, 0]; d.ancLA = [0, 0]; d.anc = new Float32Array(32); d.ancP = [];
    if (prep.anc && d.ok) {
      const A = prep.anc, o = plan.ops[A.op];
      const g = o ? ops.findIndex((q) => q.step === o.step && q.node === o.node && q.kind === o.kind) : -1;
      if (g >= 0) {
        d.ancJ = g; d.ancAB = [A.A.re, A.A.im, A.B.re, A.B.im]; d.ancLA = [A.logA.re, A.logA.im];
        const big = (x) => (Number.isFinite(x) ? Math.min(x, 1e30) : 1e30);
        A.models.forEach((M, a) => {
          const b = 16 * a, t = M.type || 0;
          d.anc.set([t, big(M.m), t === 1 ? M.flag : t === 2 ? (M.convex ? 1 : 0) : t === 3 ? M.sign : 0, M.sgn || 1], b);
          if (t === 2) d.anc.set([M.u1.re, M.u1.im, M.u2.re, M.u2.im], b + 4);
          else if (t === 3) d.anc.set([M.v0.re, M.v0.im, M.r, M.K], b + 4);
          const lp = M.pz.re === 0 && M.pz.im === 0 ? null : CX.log(M.pz);
          d.anc.set([M.pz.re, M.pz.im, lp ? lp.re : -1e30, lp ? lp.im : 0], b + 12);
          d.ancP.push(M.pz);
        });
      }
    }
    passCache.set(prep, { inv, plan, d });
    return d;
  }
  // ---- half-resolution target (cost guard) ----
  // A pane's consecutive half-resolution passes share one batch (P2 review: one target bind, clear and upsample per
  // pass cost more than half resolution saved): the first binds and clears the half target, each draws its scissored
  // part, and flushHalf() (before any other draw of GLR: the api entry points call it) upsamples the union of their
  // scissor boxes once.
  let halfTex = null, halfFbo = null, halfW = 0, halfH = 0;
  let halfOpen = null;   // {x0, y0, x1, y1 (device px of the pane, the union), scOn, prevSc, hw, hh, pre}
  // force: also a pre-pass layer (beginHalfPre), which other draws leave waiting for its place in list order
  function flushHalf(force) {
    if (!halfOpen || !gl || preActive) return;
    if (halfOpen.pre && force !== true) return;
    const hb = halfOpen;
    halfOpen = null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vpX, vpY, fw, fh);
    let x0 = vpX + hb.x0, y0 = vpY + hb.y0, x1 = vpX + hb.x1, y1 = vpY + hb.y1;
    if (hb.prevSc) { x0 = Math.max(x0, hb.prevSc[0]); y0 = Math.max(y0, hb.prevSc[1]); x1 = Math.min(x1, hb.prevSc[0] + hb.prevSc[2]); y1 = Math.min(y1, hb.prevSc[1] + hb.prevSc[3]); }
    if (x1 > x0 && y1 > y0) {
      const Q = program('invUp');
      if (Q) {
        use(Q);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
        gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, halfTex);
        u1i(Q, 'uHalf', 5);
        u4f(Q, 'uVp', vpX, vpY, fw, fh);
        u2f(Q, 'uHalfSz', hb.hw / halfW, hb.hh / halfH);
        gl.bindVertexArray(empty());
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }
    }
    if (hb.scOn) { gl.enable(gl.SCISSOR_TEST); gl.scissor(...hb.prevSc); } else gl.disable(gl.SCISSOR_TEST);
  }
  // Half resolution before the pane's main pass (13.14). Binding the half-size target in the middle of a pane's frame
  // ends its render pass: on Metal the multisampled colour and depth are stored, then reloaded for the upsample, which
  // at dpr 2 cost about what half resolution saved (forced half frames p95 10.3-12 ms, a full-resolution pass of a
  // quarter of the pixels 7.4-10.3). A pane in half-resolution motion therefore draws its leading run of inverse
  // passes first: beginHalfPre(pw, ph) begins the pane's frame (its size, status and state) without touching the
  // default framebuffer, drawInverse({..., half: true, halfPre: true}) draws into the half target ('nohalf': this pass
  // cannot draw at half resolution yet, nothing was drawn: the run ends there and the pass draws in the main pass),
  // begin(pw, ph) then starts the main pass, and compositeHalf() upsamples the layer at the run's place in list order.
  let preActive = false;
  function beginHalfPre(pw, ph) {
    if (!ok) return false;
    if (preActive) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    halfOpen = null;
    fw = pw; fh = ph; vpX = 0; vpY = 0;
    frameErr = ''; framePending = false; invAltUsed = false; invFrame++;
    preActive = true;
    resetState();
    return true;
  }
  function compositeHalf() {
    if (!halfOpen || !halfOpen.pre || preActive) return false;
    flushHalf(true);
    return true;
  }
  function halfTarget(w, h) {
    if (!halfFbo || halfW < w || halfH < h) {
      if (halfTex) gl.deleteTexture(halfTex);
      if (halfFbo) gl.deleteFramebuffer(halfFbo);
      halfW = Math.max(w, halfW); halfH = Math.max(h, halfH);
      halfTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, halfTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, halfW, halfH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      halfFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, halfFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, halfTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return halfFbo;
  }
  // K (SPEC 4.2): the front count for the early stop and admission: 1 when alpha >= 0.999, else
  // ceil(ln(1/255) / ln(1 - alpha))
  const invK = (alpha) => (alpha >= 0.999 ? 1 : Math.max(1, Math.ceil(Math.log(1 / 255) / Math.log(1 - Math.min(alpha, 0.999999)))));
  // B, the compile-time buffer (4.2; P2 benchmark, SPEC 13.10, 13.12): the buffer lives in registers across the whole
  // walk, and its size dominated the pass cost (dpr 2, z^i(H) marginal pass: B 3 1.4 ms at alpha 1, B 5 2.0 at 0.85,
  // B 8 3.3 at 0.7, B 16 8.4-10.8 at 0.5-0.3, P2 review). Classes by the shape's own (undimmed) alpha: 3 (alpha >=
  // 0.999, K 1), 5 (alpha >= 0.5), 8 (below). The buffer keeps the front B sheets exactly; the covering candidates it
  // does not keep enter the composite through their exact transmittance, coloured with the buffer's mean (the walk then
  // has no early stop: K > B). Their share of the light is (1 - alpha)^B: 0 for alpha >= 0.67 (B 5 holds K), at most
  // 3 % at alpha 0.5 (B 5) and 6 % at alpha 0.3 (B 8). A hover-dimmed draw keeps its shape's variant with K capped at
  // B (the tail closure covers the rest).
  const INV_B_MAX = 8;
  const invB = (alphaOwn) => (alphaOwn >= 0.999 ? 3 : alphaOwn >= 0.5 ? 5 : INV_B_MAX);
  // The cost guard's prediction (SPEC 10.12, 13.14): the GPU time of one inverse pass over px device pixels, in ms of the
  // suite's M4 at full clock (13.10's marginal cost), from the leaves the walk visits per pixel: the stop op walks K + 1
  // members with the early stop (B + 1 under the tail rule, K > B), every other op its whole budget (prep.N); 0.45 ms per
  // leaf and million pixels, plus 0.3. Measured at dpr 2 (0.85 Mpx), exp(H) / z^i(H): alpha 1 0.77 / -, 0.85 1.32 /
  // 1.92 ms, 0.3 3.14 / 4.12 (exp(H) walks 2, 4, 6, 9 leaves per pixel at alpha 1, 0.85, 0.5, 0.3; z^i(H) 2.1, 4.1, 6.2,
  // 9.1 per covered pixel); the model 1.02, 1.78, 2.54, 3.68. Not a timing: the GPU's clock decides that (13.14).
  function inverseEstimate(prep, alpha, alphaOwn, px) {
    if (!prep || !prep.ok || !(px > 0)) return 0;
    const B = invB(alphaOwn ?? alpha), K = Math.min(64, invK(alpha)), all = Math.abs(alpha - (alphaOwn ?? alpha)) < 1e-6;
    let L = 1;
    for (let j = 0; j < (prep.N || []).length; j++) {
      const n = Math.max(1, Number.isFinite(prep.N[j]) ? prep.N[j] : 64);
      L *= j === prep.stopOp && j === prep.inner ? Math.min(n, (all && K > B ? B : Math.min(K, B)) + 1) : n;
    }
    return px * 1e-6 * (0.3 + 0.45 * Math.min(L, 64));
  }
  // GLR.drawInverse(st) -> 'drawn' | 'pending' | 'error' (SPEC 4.5). st:
  //   map: GPU map spec, mode 0 (normalised) with stages (a, b]; plan: Inverse.planChain(steps, built, a, b) of the
  //   current chain; prep: Inverse.prepare(plan, {win, shape, ...}) of the shape (ok); shape (or shapeId): the shape,
  //   whose record GLR.packShapes packed this frame; viewKind 'flat' (default) | 'globe'; view {cx, cy, s}, dpr (flat)
  //   or sphere {MVP, eye} (globe); look {color, color2, edge, ink, alpha (drawn, hover-dimmed), alphaOwn (undimmed,
  //   sets B), pattern, cell, lines, stretch, origin}; scissor [x, y, w, h] device px (optional); half (cost guard).
  // 'pending' (a compile in flight or not yet allowed to start) sets frameStatus().pending; 'error': the shape cannot
  // be drawn inverse this frame (no program, a failed compile, a side draw without a ready program, a plan / prep
  // mismatch); both fall through to the forward draw.
  function drawInverse(st) {
    if (!ok || !st || !st.plan || !st.prep || !st.prep.ok) return 'error';
    const globe = st.viewKind === 'globe';
    const rec = pack && pack.recs.get(st.shapeId ?? (st.shape && st.shape.id));
    if (!rec || !rec.ok) return 'error';
    const look = st.look || {};
    let B = invB(look.alphaOwn ?? look.alpha ?? 1);
    let pr = invProgram(B, globe, true, st.extra);
    // A program that is still compiling, or ready but never drawn (cold: its first draw builds the Metal pipeline, a
    // 75-205 ms stall of the GPU process), is not drawn in a frame that defers cold programs: a live pane in motion
    // (st.motion) or any live frame (st.coldOk === false: the app warms it at an idle moment with warmInverse, then
    // redraws). Another ready, warm B class of the same program draws instead (the opacity slider, P2 review), else
    // the forward stand-in ('pending'). Exports (coldOk) and direct callers draw it, stall included.
    const defer = st.motion || st.coldOk === false;
    if (pr.state === 'pending' || (pr.state === 'ready' && !pr.P.warm && defer)) {
      const alt = invAltProgram(B, globe, st.extra, true);
      if (alt) { pr = { state: 'ready', P: alt.P }; B = alt.B; invAltUsed = true; }
      else if (pr.state === 'ready') pr = { state: 'pending', cold: true };
    }
    if (pr.state === 'pending') { framePending = true; return 'pending'; }
    if (pr.state !== 'ready') return 'error';
    const P = pr.P, inv = cur.info.inverse;
    P.warm = true;
    const d = passData(inv, st.plan, st.prep);
    if (!d.ok) return 'error';
    const map = st.map || {};
    // half resolution draws into another target format: a program's first half draw builds another Metal pipeline (a
    // stall), so a program not yet warm for it draws full resolution this frame and is warmed at the next quiet moment
    let half = !!st.half && !globe;
    if (half && (!P.warmHalf || !invUpWarm)) { half = false; P.warmHalfWanted = true; P.warmHalf = P.warmHalf && invUpWarm; }
    // a pre-pass draw (beginHalfPre) is a half-resolution draw or none
    const pre = !!st.halfPre && preActive;
    if (st.halfPre && (!pre || !half)) return 'nohalf';
    if (globe || !half) flushHalf();
    const hw = half ? Math.max(1, Math.ceil(fw / 2)) : fw, hh = half ? Math.max(1, Math.ceil(fh / 2)) : fh;
    gl.useProgram(P.p);
    if (!cur.invData || cur.invData.length !== 4 * inv.slots) { cur.invData = new Float32Array(4 * inv.slots); inv.fill(cur.invData); cur.invFill = inv; }
    else if (cur.invFill !== inv) { inv.fill(cur.invData); cur.invFill = inv; }
    if (P.loc.uInv) gl.uniform4fv(P.loc.uInv, cur.invData);
    u1i(P, 'uIxA', map.a || 0); u1i(P, 'uIxB', map.b || 0);
    if (P.loc.uIxRef) gl.uniform2fv(P.loc.uIxRef, d.ref);
    if (P.loc.uIxN) gl.uniform1iv(P.loc.uIxN, d.N);
    if (P.loc.uIxRK) gl.uniform1iv(P.loc.uIxRK, d.RK);
    if (P.loc.uIxAB) gl.uniform4fv(P.loc.uIxAB, d.AB);
    if (P.loc.uIxBox) gl.uniform4fv(P.loc.uIxBox, d.box);
    u1i(P, 'uIxStopOp', d.stopOp);
    u4f(P, 'uIxStopMob', ...d.stopMob);
    if (P.loc.uIxStopT) gl.uniform4fv(P.loc.uIxStopT, d.stopT);
    u1i(P, 'uIxStopMobOn', d.mobOn ? 1 : 0); u1f(P, 'uIxPAccInP', d.pInP);
    u1i(P, 'uIxTail', d.tail);
    const win = st.prep.win;
    u4f(P, 'uWin', win.x0, win.y0, win.x1, win.y1);
    u1f(P, 'uWinR', st.prep.R); u1f(P, 'uWinRs', st.prep.rs);
    if (P.loc.uSing) gl.uniform2fv(P.loc.uSing, d.sing);
    u1i(P, 'uSingN', d.singN);
    if (P.loc.uAncJ) {
      u1i(P, 'uAncJ', d.ancJ);
      if (d.ancJ >= 0) {
        u4f(P, 'uAncAB', ...d.ancAB); u2f(P, 'uAncLA', d.ancLA[0], d.ancLA[1]);
        // each anchor's pattern origin: Q, the cell corner nearest to p (the source point is passed as p - Q + delta,
        // precise), and the integer cell shift k mod 10 of Q (the patterns repeat over 10 cells), added after the
        // magnification of sub-pixel footprints
        const cell = (st.look && st.look.cell) || 1, K = [0, 0, 0, 0];
        d.ancP.forEach((p, a) => {
          const kx = Math.round(p.re / cell), ky = Math.round(p.im / cell);
          d.anc.set([p.re - kx * cell, p.im - ky * cell, kx * cell, ky * cell], 16 * a + 8);
          K[2 * a] = ((kx % 10) + 10) % 10; K[2 * a + 1] = ((ky % 10) + 10) % 10;
        });
        gl.uniform4fv(P.loc.uAnc, d.anc);
        if (P.loc.uAncK) u4f(P, 'uAncK', ...K);
        // log-polar: log p 16 / 2 pi = n + f (n the nearest integers): f, and n mod 2 (p = 0: none)
        if (P.loc.uAncG) {
          const G = new Float32Array(8);
          d.ancP.forEach((p, a) => {
            if (p.re === 0 && p.im === 0) { G.set([0, 0, -1, 0], 4 * a); return; }
            const l = CX.log(p), gx = l.re * 16 / (2 * Math.PI), gy = l.im * 16 / (2 * Math.PI), nx = Math.round(gx), ny = Math.round(gy);
            G.set([gx - nx, gy - ny, ((nx % 2) + 2) % 2, ((ny % 2) + 2) % 2], 4 * a);
          });
          gl.uniform4fv(P.loc.uAncG, G);
        }
      }
    }
    // K of the drawn alpha; a draw at the shape's own alpha counts every covering candidate (exact opacity past B),
    // a hover-dimmed one stops at the B-th key (its transient look may approximate the far sheets)
    const aDraw = look.alpha ?? 1, aOwn = look.alphaOwn ?? aDraw;
    u1i(P, 'uKsat', Math.max(1, Math.min(64, invK(aDraw))));
    u1i(P, 'uKall', Math.abs(aDraw - aOwn) < 1e-6 ? 1 : 0);
    // shape
    uploadPack();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, invTex);
    u1i(P, 'uShOff', rec.offset);
    gl.uniform4i(L_(P, 'uShape'), rec.kind, rec.complement ? 1 : 0, rec.nPts, rec.ptsOff);
    u4f(P, 'uShA', ...rec.A); u4f(P, 'uShB', ...rec.B); u4f(P, 'uShC', ...rec.C);
    u1i(P, 'uFormSlot', rec.formSlot); u1i(P, 'uIxOne', 1);
    if (P.loc.uClipP) { u4f(P, 'uClipH', rec.clipH[0], rec.clipH[1], 0, 0); gl.uniform4fv(P.loc.uClipP, rec.clipU); }
    u4f(P, 'uShBox', ...rec.box);
    // look (regionUniforms with the pattern origin Q = 0: the walk's z is absolute)
    regionUniforms(P, Object.assign({ pattern: 'solid' }, look, { dpr: st.dpr || 1 }), [0, 0]);
    if (P.loc.uLut) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lut()); }
    if (globe) {
      // (the scissor of the image's w-box on the sphere, globeScissorOf: device px of the pane, intersected with the
      // pane's own scissor)
      const gsc = st.scissor, gScOn = gsc ? gl.isEnabled(gl.SCISSOR_TEST) : false, gPrev = gsc && gScOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
      if (gsc) {
        let x0 = vpX + gsc[0], y0 = vpY + gsc[1], x1 = x0 + gsc[2], y1 = y0 + gsc[3];
        if (gPrev) { x0 = Math.max(x0, gPrev[0]); y0 = Math.max(y0, gPrev[1]); x1 = Math.min(x1, gPrev[0] + gPrev[2]); y1 = Math.min(y1, gPrev[1] + gPrev[3]); }
        if (x1 <= x0 || y1 <= y0) return 'drawn';
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
        invGlobeSc++; invGlobeScPx += (x1 - x0) * (y1 - y0);
      }
      uM4(P, 'uMVP', st.sphere.MVP); u3(P, 'uEye', st.sphere.eye);
      lightUniforms(P, sceneLight || defaultLight(false), 0.18, 40, 0.12);
      const g = sphere();
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (!dt) gl.disable(gl.DEPTH_TEST);
      if (gsc) { if (gScOn) gl.scissor(gPrev[0], gPrev[1], gPrev[2], gPrev[3]); else gl.disable(gl.SCISSOR_TEST); }
      invDraws++;
      return 'drawn';
    }
    const v = st.view || { cx: 0, cy: 0, s: 1 }, dpr = st.dpr || 1, inv1 = 1 / (v.s * dpr) * (half ? fw / hw : 1), inv2 = 1 / (v.s * dpr) * (half ? fh / hh : 1);
    u2f(P, 'uCenter', hi32(v.cx), hi32(v.cy));
    u2f(P, 'uCenterLo', v.cx - hi32(v.cx), v.cy - hi32(v.cy));
    u2f(P, 'uInvScale', inv1, inv2);
    // scissor: device px of the pane, intersected with the pane's own scissor (viewport())
    const sc = st.scissor;
    // (a pre-pass precedes begin(), which leaves the pane unscissored)
    const scOn = pre ? false : half && halfOpen ? halfOpen.scOn : gl.isEnabled(gl.SCISSOR_TEST);
    const prevSc = pre ? null : half && halfOpen ? halfOpen.prevSc : (scOn ? gl.getParameter(gl.SCISSOR_BOX) : null);
    if (half) {
      if (!halfOpen || halfOpen.hw !== hw || halfOpen.hh !== hh || !!halfOpen.pre !== pre) {
        if (halfOpen) { flushHalf(true); gl.useProgram(P.p); }     // (the upsample bound its own program)
        gl.bindFramebuffer(gl.FRAMEBUFFER, halfTarget(hw, hh));
        gl.viewport(0, 0, hw, hh);
        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        halfOpen = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, scOn, prevSc, hw, hh, pre };
      }
      if (sc) { gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(sc[0] / 2), Math.floor(sc[1] / 2), Math.ceil(sc[2] / 2) + 2, Math.ceil(sc[3] / 2) + 2); }
      else gl.disable(gl.SCISSOR_TEST);
      const b = sc ? [sc[0] - 2, sc[1] - 2, sc[0] + sc[2] + 4, sc[1] + sc[3] + 4] : [0, 0, fw, fh];
      halfOpen.x0 = Math.min(halfOpen.x0, Math.max(0, b[0])); halfOpen.y0 = Math.min(halfOpen.y0, Math.max(0, b[1]));
      halfOpen.x1 = Math.max(halfOpen.x1, Math.min(fw, b[2])); halfOpen.y1 = Math.max(halfOpen.y1, Math.min(fh, b[3]));
      u4f(P, 'uVp', 0, 0, hw, hh);
    } else {
      u4f(P, 'uVp', vpX, vpY, fw, fh);
      if (sc) {
        let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
        if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
        if (x1 <= x0 || y1 <= y0) return 'drawn';
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
      }
    }
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    invDraws++;
    if (half) invHalfDraws++;   // the batch stays open: flushHalf upsamples it
    else if (sc) {
      if (scOn) gl.scissor(...prevSc); else gl.disable(gl.SCISSOR_TEST);
    }
    gl.bindVertexArray(null);
    return 'drawn';
  }
  let invDraws = 0, invHalfDraws = 0, invAltUsed = false, invGlobeSc = 0, invGlobeScPx = 0;
  // draws the ready inverse programs that were never drawn into one pixel of the current target (their first draw
  // builds the Metal pipeline: a 75-200 ms stall of the GPU process), at a quiet moment chosen by the app, so the
  // frame that switches to them does not stall -> the number of programs warmed for full resolution (a frame drawn with
  // another B class meanwhile should be redrawn); warmed for half resolution only: not counted (nothing to redraw)
  // (flat and globe programs, with the render state of a real pass: the pipeline includes the target's format, blending and
  // write mask; uniforms left at 0 give alpha 0, so the pixel is unchanged; the next frame clears it anyway)
  // half: also the half-resolution pipelines that a refused half draw asked for (the app warms those only at a longer
  // idle: they are not urgent, full resolution draws meanwhile)
  function warmInverse(half = true) {
    if (!ok || lost) return 0;
    flushHalf();
    let n = 0, nFull = 0;
    const one = (e, half) => {
      if (half) { gl.bindFramebuffer(gl.FRAMEBUFFER, halfTarget(Math.max(1, halfW), Math.max(1, halfH))); gl.viewport(0, 0, 1, 1); }
      gl.useProgram(e.p);
      resetState();
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 1, 1);
      // a globe program draws the globe's vertex layout (the pipeline includes it): one triangle, uMVP still 0, so
      // nothing is rasterised
      if (e.name === 'invS') { const g = sphere(); gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0); }
      else { gl.bindVertexArray(empty()); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.bindVertexArray(null);
      gl.disable(gl.SCISSOR_TEST);
      if (half) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(vpX, vpY, fw, fh); }
      n++;
    };
    for (const e of progs.values()) {
      if (!invWarmable(e) || !e.p) continue;
      if (!e.warm) { one(e, false); e.warm = true; nFull++; }
      if (half && e.warmHalfWanted && !e.warmHalf && warmUpsample()) { one(e, true); e.warmHalf = true; e.warmHalfWanted = false; }
    }
    return nFull;
  }
  // the half-resolution upsample (invUp, a static program: its first use links synchronously and its first draw
  // builds a pipeline, together a 100-250 ms stall measured in the first half frame) is made ready with the first half
  // warm-up: one pixel into the current target, alpha 0 (the texture unit holds the half target, or nothing)
  let invUpWarm = false;
  function warmUpsample() {
    if (invUpWarm) return true;
    const Q = getProg('invUp', cur, true);
    if (!Q) return false;
    use(Q);
    resetState();
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 1, 1);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, halfTarget(Math.max(1, halfW), Math.max(1, halfH)) && halfTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(vpX, vpY, fw, fh);
    u1i(Q, 'uHalf', 5); u4f(Q, 'uVp', -1e6, -1e6, 1, 1); u2f(Q, 'uHalfSz', 0, 0);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
    invUpWarm = true;
    return true;
  }
  // a ready inverse program waits for warmInverse (a variant drawn in its place, or half resolution refused)
  // (only the current chain's programs: an older structure's program that was never drawn is not worth a stall)
  const invWarmable = (e) => e.inv && (e.name === 'inv' || e.name === 'invS') && e.state === 'ready' && !sideMode && !!cur.info && !!cur.info.inverse && e.ikey === cur.info.inverse.key;
  // 2: a program waits for its first (full-resolution) draw; 1: only half-resolution pipelines are wanted; 0: none
  const inverseColdState = () => {
    let s = 0;
    for (const e of progs.values()) if (invWarmable(e)) { if (!e.warm) return 2; if (e.warmHalfWanted && !e.warmHalf) s = 1; }
    return s;
  };
  const inverseColdWaiting = () => inverseColdState() > 0;
  // the app predicts half resolution in motion for a pane (app.js predictLevel): the current chain's programs get their
  // half-resolution pipelines at the same quiet moment as their first draw, not when the first half draw is refused
  function wantHalf() {
    for (const e of progs.values()) if (invWarmable(e) && !e.warmHalf) e.warmHalfWanted = true;
  }

  // ---- GPU timing for the cost guard (10.12): EXT_disjoint_timer_query_webgl2 around a pane's inverse passes ----
  let tqExt = null, tqChecked = false;
  const tqPending = [], tqDone = [];
  let tqActive = null;
  function tq() { if (!tqChecked && gl) { tqChecked = true; tqExt = gl.getExtension('EXT_disjoint_timer_query_webgl2'); } return tqExt; }
  const timer = {
    // true when GPU timer queries exist (else the guard falls back to frame intervals)
    get available() { return !!(ok && tq()); },
    // brackets the inverse passes of one pane in one frame (tag: 'L' | 'R' ...); one bracket at a time
    begin(tag) {
      if (!ok || !tq() || tqActive) return false;
      const q = gl.createQuery();
      gl.beginQuery(tqExt.TIME_ELAPSED_EXT, q);
      tqActive = { q, tag, t: performance.now() };
      return true;
    },
    end() {
      if (!tqActive) return;
      gl.endQuery(tqExt.TIME_ELAPSED_EXT);
      tqPending.push(tqActive); tqActive = null;
      if (tqPending.length > 16) { const o = tqPending.shift(); gl.deleteQuery(o.q); }
    },
    // completed measurements since the last poll: [{tag, ms, t}] (disjoint ones dropped). The disjoint flag is read
    // only when a result is available: getParameter(GPU_DISJOINT_EXT) is a synchronous round trip to the GPU process
    // (the availability check is not), which a busy GPU process turned into main-thread stalls on every frame
    poll() {
      if (!ok || !tqExt || !tqPending.length || !gl.getQueryParameter(tqPending[0].q, gl.QUERY_RESULT_AVAILABLE)) return [];
      const disjoint = gl.getParameter(tqExt.GPU_DISJOINT_EXT);
      const out = [];
      while (tqPending.length) {
        const r = tqPending[0];
        if (!gl.getQueryParameter(r.q, gl.QUERY_RESULT_AVAILABLE)) break;
        tqPending.shift();
        const ns = gl.getQueryParameter(r.q, gl.QUERY_RESULT);
        gl.deleteQuery(r.q);
        if (!disjoint) out.push({ tag: r.tag, ms: ns / 1e6, t: r.t });
      }
      return out;
    },
  };
  // ---- the cost guard's policy (10.12), per pane, against a fixed 60 Hz frame (the user's rule, 2026-10-20: "60 fps
  // is enough": frames only have to stay comfortably inside 60 fps, and image quality is never traded for a 120 Hz
  // budget, so the display's own refresh plays no part). Levels: 0 full resolution and exact images; 1 half resolution
  // of the inverse passes of motion frames (settled frames, thumbnails and exports stay full); 2 also the pane's
  // bounded clean shapes forward (the last resort). A reading is the GPU time of the pane's frame (the bracket: clear,
  // grid, fills, strokes; each the median of the pane's last 3, app.js), or without timer queries the frame's lag.
  // STREAK consecutive readings over BUDGET at the current level move one level up. Hysteresis: a level is left only
  // by a probe that measures the finer level: at the start of a motion burst, at least `gap` ms after the last change,
  // the pane draws one level finer; when its first STREAK readings there are all under EXIT, that level sticks;
  // otherwise the coarser level returns at once (the probe cost at most STREAK measured frames) and the next probe
  // waits twice as long (up to probeMax). Readings between EXIT and BUDGET change nothing. Pure bookkeeping: the app
  // feeds it one record per measured pane frame (with the level it was drawn at) and one call per motion burst.
  // BUDGET (SPEC 10.12, measured on the suite's M4): the GPU-synchronised frame is the pane's reading + 2.2 ms (main
  // thread, blit and sync; 1.7-2.9 ms over 17 pans), and the 60 fps ceiling with headroom is 12 ms of the 16.7 ms
  // frame (the perf suite's absolute rule); 12 - 2.2 - 1.8 (the other pane's forward redraw at dpr 2, when it shares
  // the frame) = 8 ms. When both live panes drew inverse passes in the measured frame, each gets half (f.share).
  // EXIT = 5 ms: a probe sticks only with frames near 7 ms, 3 ms below the trip point (the run-to-run swing of the
  // readings of one scene with the GPU's clock: 2-3 ms).
  // Readings are never compared across resolutions (an Apple GPU lowers its clock on cheaper frames: half readings rise
  // from 2.3 to 5.7 ms within a pan), only with the absolute thresholds at the level they were drawn at.
  const GUARD_FRAME_MS = 1000 / 60;
  function CostGuard(opts = {}) {
    const BUDGET = opts.budget ?? 8, EXIT = opts.exit ?? 5, STREAK = opts.streak ?? 3;
    // the frame-lag fallback: over 1.5 frames of 60 Hz is over budget, at most one frame is under EXIT
    const LAG_OVER = 1.5 * GUARD_FRAME_MS, LAG_EXIT = GUARD_FRAME_MS;
    const PROBE_MS = opts.probeMs ?? 4000, PROBE_MAX = opts.probeMax ?? 32000, MAXLV = 2;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const panes = new Map();
    const fresh = (s) => Object.assign(s, { over: 0, level: 0, floor: 0, raised: false, probe: false, probeN: 0, gap: PROBE_MS, changed: 0, log: 0 });
    const paneOf = (p) => { let s = panes.get(p); if (!s) { s = fresh({ key: null, last: null }); panes.set(p, s); } return s; };
    // (a probe never goes below the predicted floor: setFloor)
    const eff = (s) => Math.max(s.floor || 0, s.level - (s.probe ? 1 : 0));
    const note = (pane, s, what) => { if (s.log < 4 && typeof console !== 'undefined') { s.log++; console.info(`exact images: cost guard (${pane}): ${what}`); } };
    const out = (s, over) => { const lv = eff(s); return { level: lv, half: lv >= 1, demote: lv >= 2, budget: BUDGET, exit: EXIT, over }; };
    return {
      // frame(pane, {key, motion, inverse, gpuMs, intervalMs, level, share, t}): key = scene structure + map key
      // structure + B class + dpr (a new key starts at level 0); gpuMs: the timer reading of the pane's frame (null when
      // none); intervalMs: the frame's lag (without timer queries); inverse: inverse passes were drawn; level: the level
      // the measured frame was drawn at (a reading from another level is ignored; undefined: the current one); share:
      // the pane's share of the frame's GPU budget (0.5 when the other pane drew inverse passes in the same frame).
      // -> {level, half, demote, budget, exit, over}
      frame(pane, f) {
        const s = paneOf(pane);
        if (f.key !== undefined && f.key !== s.key) { fresh(s); s.key = f.key; }
        let over = null, under = false;
        const lv = eff(s);
        if (f.motion && f.inverse && (f.level === undefined || f.level === lv)) {
          const sh = f.share > 0 && f.share < 1 ? f.share : 1;
          if (f.gpuMs != null) { over = f.gpuMs > BUDGET * sh; under = f.gpuMs < EXIT * sh; }
          else if (f.intervalMs > 0) { over = f.intervalMs > LAG_OVER; under = f.intervalMs <= LAG_EXIT; }
        }
        if (over !== null) s.last = { gpuMs: f.gpuMs ?? null, intervalMs: f.intervalMs ?? null, over, under, level: lv };
        if (over === null) return out(s, over);
        const t = f.t ?? now();
        if (s.probe) {
          if (!under) {
            // the finer level does not fit: back at once, and the next probe waits longer
            s.probe = false; s.over = 0; s.changed = t; s.gap = Math.min(PROBE_MAX, 2 * s.gap);
          } else if (++s.probeN >= STREAK) {
            s.probe = false; s.level--; s.over = 0; s.changed = t; s.gap = PROBE_MS;
            note(pane, s, s.level ? 'bounded shapes back to exact images' : 'within the 60 fps budget again; full resolution');
          }
          return out(s, over);
        }
        s.over = over ? s.over + 1 : 0;
        if (s.over >= STREAK && s.level < MAXLV) {
          s.over = 0; s.level++; s.raised = false; s.changed = t; s.gap = PROBE_MS;
          note(pane, s, `over ${BUDGET} ms of GPU per frame (60 fps budget); ${s.level === 1 ? 'half resolution in motion' : 'bounded shapes drawn forward'}`);
        }
        return out(s, over);
      },
      // a motion burst of the pane starts: time for a probe of the finer level?
      burst(pane, t = now()) {
        const s = paneOf(pane);
        if (s.level > (s.floor || 0) && !s.probe && t - s.changed >= s.gap) { s.probe = true; s.probeN = 0; s.over = 0; }
        return out(s, null);
      },
      // the level the pane's passes are predicted to need (app.js predictLevel, GLR.inverseEstimate: 1 when they are
      // too heavy for full resolution in motion): the level never drops below it, probes stop at it, and readings at it
      // may still raise the level (a slower GPU). Set every frame (a new key starts at 0, then takes the floor).
      setFloor(pane, floor, t = now()) {
        const s = paneOf(pane), f = Math.max(0, Math.min(MAXLV, floor | 0));
        if (f === (s.floor || 0)) return out(s, null);
        // (a level the floor raised, not a measurement, follows it back down)
        if (f < (s.floor || 0) && s.raised && s.level > f) { s.level = f; s.probe = false; s.over = 0; s.changed = t; }
        s.floor = f;
        if (s.level < f) { s.level = f; s.raised = true; s.probe = false; s.over = 0; s.changed = t; s.gap = PROBE_MS; note(pane, s, 'predicted over the 60 fps budget; half resolution in motion'); }
        return out(s, null);
      },
      state(pane) { const s = paneOf(pane); return Object.assign(out(s, null), { over: s.over, last: s.last, probe: s.probe, gap: s.gap, stuck: s.level, floor: s.floor || 0 }); },
      reset(pane) { if (pane) panes.delete(pane); else panes.clear(); },
    };
  }

  const api = {
    init, begin, viewport, blit, gpuDone, prestart, setChain, drawGrid, drawRegion, drawLines, drawColorPlot, drawLandscape, drawSphere, drawPreimage,
    // exact images (SPEC 4.5): see packShapes, drawInverse, inverseStatus, timer, CostGuard above
    packShapes, setFormAnchor: (xy) => { formAnchor = Array.isArray(xy) && xy.every(Number.isFinite) ? xy.slice() : null; }, packShape, TKIND, drawInverse, timer, CostGuard, warmInverse, flushHalf, beginHalfPre, compositeHalf, inverseEstimate, wantHalf,
    // a ready inverse program waits for warmInverse (call it at a quiet moment, then redraw)
    get inverseColdWaiting() { return inverseColdWaiting(); },
    inverseColdState,
    // the current chain's inverse program for shapes of own (undimmed) alpha alphaOwn and a view kind, with the
    // frame's formula bundle (packShapes), without starting a compile: 'ready' | 'pending' | 'error' | 'none' (no
    // program for this chain, or its compile not started). pathOf's GLR.inverseReady(...) is status === 'ready'.
    inverseStatus(alphaOwn = 1, viewKind = 'flat') { return ok ? invProgram(invB(alphaOwn), viewKind === 'globe', false).state : 'none'; },
    // the same, starting the compile when allowed (not in side mode, after the chain's forward programs landed)
    inverseRequest(alphaOwn = 1, viewKind = 'flat') { if (!ok) return 'none'; const r = invProgram(invB(alphaOwn), viewKind === 'globe', true); if (r.state === 'pending') schedulePoll(); return r.state; },
    // the compile-time buffer size and the front count K of SPEC 4.2 for an alpha
    inverseB: (alphaOwn) => invB(alphaOwn), inverseK: (alpha) => invK(alpha),
    // SPEC 4.8: a w-box {x0, x1, y0, y1} of a shape's image -> drawInverse's scissor [x, y, w, h] in device px of the
    // current pane (bottom-left origin), padded by pad device px; null when it covers the pane (no scissor needed);
    // [0, 0, 0, 0] when it misses the pane (nothing to draw)
    globeScissorOf: (b, MVP, eye, pad = 4) => globeScissorOf(b, MVP, eye, pad),
    scissorOf(b, view, dpr = 1, pad = 4) {
      if (!b || !view || ![b.x0, b.x1, b.y0, b.y1].every(Number.isFinite)) return null;
      const k = view.s * dpr;
      const x0 = Math.floor(fw / 2 + (b.x0 - view.cx) * k) - pad, x1 = Math.ceil(fw / 2 + (b.x1 - view.cx) * k) + pad;
      const y0 = Math.floor(fh / 2 + (b.y0 - view.cy) * k) - pad, y1 = Math.ceil(fh / 2 + (b.y1 - view.cy) * k) + pad;
      const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(fw, x1), cy1 = Math.min(fh, y1);
      if (cx1 <= cx0 || cy1 <= cy0) return [0, 0, 0, 0];
      if (cx0 <= 0 && cy0 <= 0 && cx1 >= fw && cy1 >= fh) return null;
      return [cx0, cy0, cx1 - cx0, cy1 - cy0];
    },
    // the current chain's inverse structure: {ok, key, reason, nOps} (null without a chain)
    get inverseInfo() { const v = cur.info && cur.info.inverse; return v ? { ok: !!v.ok, key: v.key, reason: v.reason || null, nOps: v.nOps || 0 } : null; },
    // draws made with an inverse program since load (tests, perf counters)
    get inverseDraws() { return invDraws; },
    get inverseHalfDraws() { return invHalfDraws; },
    // globe passes drawn with a scissor (globeScissorOf) and their scissored device px (tests)
    get inverseGlobeScissors() { return { n: invGlobeSc, px: invGlobeScPx }; },
    // internals for tests: shader sources (REGION_FS byte identity, the parity page's recording program)
    _src: { REGION_FS: (s) => REGION_FS(!!s), PATTERN_SRC, INV_HEAD, INV_MAIN, LINE_VS, invB, invK, invSources: (B, globe, forms, extra) => invSources(cur.info, B, !!globe, forms || [], extra), invProgram, passData, invAltProgram,
      // tests: every new inverse program gets a unique uniform (a cold compile and first draw, SPEC 13.12)
      set coldCompiles(v) { coldNonce = v ? Math.max(1, coldNonce) : 0; }, get coldCompiles() { return coldNonce > 0; } },
    createMesh, createSkip, setSkip, createLines, destroy, dropCached, createPreMesh, drawPreMapped, get preBytes() { return preBytes; }, M4, camera, landGeom, fitDist, hexRGB, phaseRGB, PATTERNS, STYLES,
    get ok() { return ok; }, get lost() { return lost; }, get error() { return lastError; }, get gl() { return gl; }, get canvas() { return canvas; },
    // since the last begin/viewport: error (plain words) when a chain program failed to compile, pending when one
    // is still compiling (an earlier chain version, or nothing, was drawn instead; onReady follows)
    frameStatus() { return { error: frameErr, pending: framePending, alt: invAltUsed }; },
    // any chain program compiling in the background
    get compiling() { for (const e of progs.values()) if (e.state === 'pending') return true; return false; },
    // drops every cached map evaluation (e.g. to measure the uncached cost)
    clearCaches() { for (const r of live) freeCache(r); },
    get cacheBytes() { return cacheBytes; },
    // true: every compile is waited for (tests that compare frames drawn right after a chain change)
    set syncCompile(v) { syncDepth += v ? 1 : -1; },
    // side(true) ... side(false): setChain and the draws in between use a side chain (example thumbnails). The current
    // chain, its history and their programs are untouched; a side draw never stands in with them, so a side frame
    // whose programs are still compiling draws nothing (frameStatus().pending) and onReady({side: true}) follows.
    side(on) {
      if (on && !sideMode) { side = { cur }; sideMode = true; }
      else if (!on && sideMode) { cur = side.cur; side = null; sideMode = false; }
    },
    get chainKey() { return cur.key; },
    // All sheets for map (GPU map spec) with window W: {K (surfaces drawn, at most 24), total, W, infinite} or null
    // when the current chain cannot draw it (no multivalued step in (a, b], a homotopy, a d/dz in (a, b] with a > 0,
    // or no chainSheetRange in the chain's GLSL)
    // TEMP-DEBUG-HOOK (removed before publishing)
    // (v16 tests, SPEC 13.3) the points pts ([[x, y], ...]) through the current chain's mapPoint under map, read back by
    // transform feedback: a Float32Array of pairs, or null while the program compiles or without WebGL
    evalMap(map, pts) {
      if (!ok || lost || !cur.info) return null;
      syncDepth++;
      let P;
      try { P = getProg('evalPt', cur, true); } finally { syncDepth--; }
      if (!P) return null;
      const n = pts.length, data = new Float32Array(2 * n);
      pts.forEach((q, i) => { data[2 * i] = q[0]; data[2 * i + 1] = q[1]; });
      const vbo = gl.createBuffer(), out = gl.createBuffer(), vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, out); gl.bufferData(gl.ARRAY_BUFFER, 8 * n, gl.STREAM_READ);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      use(P, map);
      if (!tfObj) tfObj = gl.createTransformFeedback();
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfObj);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, out);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindVertexArray(null);
      const res = new Float32Array(2 * n);
      gl.bindBuffer(gl.ARRAY_BUFFER, out); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, res); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.deleteBuffer(vbo); gl.deleteBuffer(out); gl.deleteVertexArray(vao);
      return res;
    },
    // (v16 tests) the map-spec helpers: the cache key, the identity test and an earlier chain version's stand-in
    _map: { mapKeyOf: (m) => mapKeyOf(m), isIdent: (m) => isIdent(m), mapFor: (m, sigs) => mapFor(m, { sigs }) },
    // TEMP-DEBUG-HOOK
    sheetInfo(map, W) { const p = ok ? sheetPlan(map, W) : null; return p ? { K: p.K, total: p.total, W: p.W, infinite: p.infinite } : null; },
    // no program of chain structure key is still compiling (the ones its draws asked for landed or failed)
    ready(key) { for (const e of progs.values()) if (e.key === key && e.state === 'pending') return false; return true; },
    onRestore: null, onLost: null, onReady: null,
  };
  // a half-resolution batch is upsampled before any other draw (drawInverse flushes it itself)
  for (const k of ['begin', 'viewport', 'blit', 'drawGrid', 'drawRegion', 'drawPreMapped', 'drawLines', 'drawColorPlot', 'drawLandscape', 'drawSphere', 'drawPreimage']) {
    const f = api[k];
    // (a pre-pass layer waits for compositeHalf; the blit composites one that was left waiting)
    api[k] = function () { flushHalf(k === 'blit'); return f.apply(this, arguments); };
  }
  return api;
})();

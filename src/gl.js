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
uniform int uHMode; uniform float uH; uniform float uMu; uniform float uHClip;
// (height, valid) of a value w; the same formulas as the JS heightOf
vec2 heightW(vec2 w) {
  bool nanx = isnan(w.x) || !(w.x < 0.0 || w.x >= 0.0), nany = isnan(w.y) || !(w.y < 0.0 || w.y >= 0.0);
  bool infv = (!nanx && abs(w.x) > 3e38) || (!nany && abs(w.y) > 3e38);
  float mu = uMu > 0.0 ? uMu : 1.0;
  // linear Re / Im (modes 4, 5): the stacked sheets of a covering surface keep their true pitch (atan made plateaus).
  // The block ends at 1.25 H; the landscape's mesh (uHClip > 0) keeps heights up to uHClip H and is clipped at the
  // block exactly (LAND_SHEET_VS), everything else (the probe) stops at the block
  if (uHMode == 4 || uHMode == 5) {
    float x = uHMode == 4 ? w.x : w.y;
    bool bad = uHMode == 4 ? nanx : nany;
    float lim = uHClip > 0.0 ? uHClip : 1.25;
    return vec2(uH * clamp(x / mu, -lim, lim), bad ? 0.0 : 1.0);
  }
  // linear with a soft knee (modes 6, 7: All sheets while deforming): linear up to mu, then levelling off to 1.25 mu
  if (uHMode == 6 || uHMode == 7) {
    float x = clamp((uHMode == 6 ? w.x : w.y) / mu, -1e30, 1e30), a = abs(x), c = 0.5 / PI;
    bool bad = uHMode == 6 ? nanx : nany;
    return vec2(uH * sign(x) * (a <= 1.0 ? a : 1.0 + c * atan((a - 1.0) / c)), bad ? 0.0 : 1.0);
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
  // ---- adaptive refinement (notes/landscape-walls/DESIGN.md 3.3, r2/AS-BUILT.md) ----
  // Each base cell has two levels (Lx, Ly), 0..4: 1, 2, 4, 8 or 16 sub-cells along x and along y, from its chord
  // errors along each direction at the fitted camera (under 0.25 px), so a wall that runs along y is cut in strips
  // across it, not in squares. uLv: the levels (Lx + 8 Ly), four cells per texel along x. uLst: the refined cells
  // (cell index per texel, 1024 per row), grouped by (Lx, Ly). Positions are in 16ths of a cell (exact integers), so
  // a vertex two cells share comes from the same numbers in both.
  // While something moves the levels may be a frame or two older than the heights (read back fenced, never waited for:
  // r2 review math-3): a cell that now holds a real jump (LAND_EDGE_VS, the current heights') counts as level 0 in
  // every program, so its refined neighbours meet its base edges and the base draw splits it at the cut
  const REFINE = `
uniform highp sampler2D uLv; uniform highp sampler2D uLst; uniform int uM;
uniform highp sampler2D uE0; uniform highp sampler2D uE1; uniform highp sampler2D uE2; uniform int uCuts;
bool cellJump(ivec2 c) {
  return texelFetch(uE0, c, 0).w > 0.5 || texelFetch(uE0, c + ivec2(0, 1), 0).w > 0.5 || texelFetch(uE1, c, 0).w > 0.5
      || texelFetch(uE1, c + ivec2(1, 0), 0).w > 0.5 || texelFetch(uE2, c, 0).w > 0.5;
}
int lvRaw(ivec2 c) {
  vec4 t = texelFetch(uLv, ivec2(c.x >> 2, c.y), 0);
  int k = c.x & 3;
  return int((k == 0 ? t.x : (k == 1 ? t.y : (k == 2 ? t.z : t.w))) + 0.5);
}
ivec2 lvAt(ivec2 c) {
  if (c.x < 0 || c.y < 0 || c.x >= uM || c.y >= uM) return ivec2(-1);
  int v = lvRaw(c);
  if (v != 0 && uCuts > 0 && cellJump(c)) return ivec2(0);
  return ivec2(v & 7, v >> 3);
}
// drawn by the refined cells' draw, not a cell that now holds a jump
bool lvDrawnR(ivec2 c) { return lvRaw(c) != 0 && !(uCuts > 0 && cellJump(c)); }
ivec2 lstCell(int e) {
  int ci = int(texelFetch(uLst, ivec2(e & 1023, e >> 10), 0).x + 0.5);
  return ivec2(ci % uM, ci / uM);
}
`;
  // (the refinement's build: the levels and the refined vertices' positions; not in the draw programs, whose first
  // compile is a formula's first Landscape)
  const REFINE_BUILD = `
// sub-grid vertex s (0..2^Lx, 0..2^Ly) of cell c at levels L: its position in 16ths of a cell (xy) and the levels of
// its normal's spacing along x and y (zw; -1: a base vertex next to a base cell, whose height and normal are the base
// passes'). A vertex on a side of the cell moves to the nearest point of the grid of the lower of the two levels
// along that side (the level the side's own chord error asked for, which both cells reached): both cells then draw
// the same polyline there, with no T-junction and no crack.
ivec4 snapV(ivec2 c, ivec2 L, ivec2 s) {
  ivec2 n = ivec2(1 << L.x, 1 << L.y);
  ivec2 g = ivec2(s.x * (16 >> L.x), s.y * (16 >> L.y));
  ivec2 ln = L;
  bool sx = s.x == 0 || s.x == n.x, sy = s.y == 0 || s.y == n.y;
  if (sx != sy) {
    ivec2 nb = sx ? lvAt(c + ivec2(s.x == 0 ? -1 : 1, 0)) : lvAt(c + ivec2(0, s.y == 0 ? -1 : 1));
    if (nb.x < 0) nb = L;
    ln = min(L, nb);
    // (nearest, ties down: the same point from both sides)
    if (sx) { int st = 16 >> ln.y; g.y = ((2 * g.y + st - 1) / (2 * st)) * st; }
    else { int st = 16 >> ln.x; g.x = ((2 * g.x + st - 1) / (2 * st)) * st; }
  }
  if ((g.x == 0 || g.x == 16) && (g.y == 0 || g.y == 16)) {
    ivec2 q = c + (g >> 4);
    ivec2 m = ivec2(99);
    bool base = false;
    for (int k = 0; k < 4; k++) {
      ivec2 l = lvAt(q - ivec2(k & 1, k >> 1));
      if (l.x < 0) continue;
      m = min(m, l);
      if (l.x == 0 && l.y == 0) base = true;
    }
    ln = base ? ivec2(-1) : m;
  }
  return ivec4(c * 16 + g, ln);
}
// the level a chord error e (world units) asks for at uPxW px per world unit: the error falls by 4 per level on a
// smooth surface, so L = log4(e / 0.25 px), at most 4; sub-cells are kept over uMinPx of a pixel
uniform float uPxW; uniform float uCellW; uniform float uMinPx;
int levelOf(float e) {
  float ep = e * uPxW, f = uCellW * uPxW;
  int L = ep > 0.25 ? int(ceil(0.5 * log2(ep / 0.25))) : 0;
  int Lp = f > uMinPx ? int(ceil(log2(f / uMinPx))) : 0;
  return clamp(min(L, Lp), 0, 4);
}
// The levels (Lx + 8 Ly) of a cell from its 5 x 5 lattice of heights at quarter cells (lat, row-major from the corner
// 00): the largest second differences along x, along y and along the drawn diagonal (that one goes with the larger of
// the two), D in px. The chord error of a facet of side l (cells) is 2 D (l / (1/4))^2 / 16 = 2 D l^2 where the
// surface is quadratic, under 0.25 px when 4^L >= 8 D; one level more (4^L >= 32 D), since a wall's curvature peaks
// between the lattice's points (test/t_landwalls.js: 0.25 px is then met almost everywhere below the 16 sub-cells cap).
// (While something moves the cheaper estimate below, from the midpoints and the centre only.)
int levelD(float D) {
  float dp = D * uPxW;
  return dp > 0.03125 ? int(ceil(0.5 * log2(32.0 * dp))) : 0;
}
float levelsLat(float lat[25]) {
  float dx = 0.0, dy = 0.0, dd = 0.0;
  for (int b = 0; b < 5; b++) for (int a = 1; a < 4; a++) {
    dx = max(dx, abs(lat[b * 5 + a - 1] - 2.0 * lat[b * 5 + a] + lat[b * 5 + a + 1]));
    dy = max(dy, abs(lat[(a - 1) * 5 + b] - 2.0 * lat[a * 5 + b] + lat[(a + 1) * 5 + b]));
  }
  for (int b = 1; b < 4; b++) for (int a = 1; a < 4; a++) dd = max(dd, abs(lat[(b - 1) * 5 + a - 1] - 2.0 * lat[b * 5 + a] + lat[(b + 1) * 5 + a + 1]));
  if (dx >= dy) dx = max(dx, dd); else dy = max(dy, dd);
  float f = uCellW * uPxW;
  int Lp = f > uMinPx ? int(ceil(log2(f / uMinPx))) : 0;
  return float(clamp(min(levelD(dx), Lp), 0, 4) + 8 * clamp(min(levelD(dy), Lp), 0, 4));
}
// the lattice index of the p-th point a cell evaluates: uLat 1 the 21 that are not corners, 0 the bottom, top, left and
// right midpoints and the centre
uniform int uLat;
int latIdx(int p) { return uLat == 1 ? p + 1 + (p >= 3 ? 1 : 0) + (p >= 18 ? 1 : 0) : (p == 0 ? 2 : (p == 1 ? 22 : (p == 2 ? 10 : (p == 3 ? 14 : 12)))); }
// the cheaper levels from the corners (h: 00, 10, 01, 11) and the bottom, top, left and right midpoints and the centre
// (m0..m4): along x the bottom and top sides and the centre's horizontal chord, along y the left and right sides and
// its vertical one; the drawn diagonal goes with the larger
float levels2(vec4 h, float m0, float m1, float m2, float m3, float m4) {
  float ex = max(max(abs(m0 - 0.5 * (h.x + h.y)), abs(m1 - 0.5 * (h.z + h.w))), abs(m4 - 0.5 * (m2 + m3)));
  float ey = max(max(abs(m2 - 0.5 * (h.x + h.z)), abs(m3 - 0.5 * (h.y + h.w))), abs(m4 - 0.5 * (m0 + m1)));
  float ed = max(abs(m4 - 0.5 * (h.x + h.w)), abs(m4 - 0.5 * (h.y + h.z)));
  if (ex >= ey) ex = max(ex, ed); else ey = max(ey, ed);
  return float(levelOf(ex) + 8 * levelOf(ey));
}
`;
  // The principal surface's chain pass, as small as it was (one call site of the chain): F and its height at the grid's
  // vertices (uPass 0: uN x uN over the box: the mesh, or the quarter / half cells of the refinement's lattice), or at
  // the points of uPq (uPass 1: the refined vertices and their normals' neighbours, LAND_RP_VS). Everything else of
  // the refinement is in programs without the chain (LAND_LV_VS, LAND_RP_VS, LAND_RA_VS), compiled once per page: a
  // formula's first Landscape compiles what it compiled before (r2 cold opens: a larger chain program held the GPU
  // process for 0.7 to 0.9 s at its first use).
  const LAND_TF_VS = `
uniform int uN; uniform vec4 uBox; uniform int uPass; uniform highp sampler2D uPq;
out vec4 tfOut;
void main() {
  vec2 z;
  if (uPass == 1) z = texelFetch(uPq, ivec2(gl_VertexID & 2047, gl_VertexID >> 11), 0).xy;
  else z = uBox.xy + vec2(float(gl_VertexID % uN), float(gl_VertexID / uN)) / float(uN - 1) * uBox.zw;
  vec2 w = mapF(z);
  vec2 hv = heightW(w);
  vec2 wc = vec2(isnan(w.x) ? 1.0 : clamp(w.x, -3e38, 3e38), isnan(w.y) ? 0.0 : clamp(w.y, -3e38, 3e38));
  tfOut = vec4(wc, hv.y > 0.5 ? hv.x : 0.0, hv.y);
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;
  // The levels, four cells per invocation, from the heights at the cell's lattice (uLp: the chain pass on the grid of
  // quarter cells, uLat 1, or of half cells while something moves, uLat 0): a cell that touches a real cut
  // (LAND_EDGE_VS) or has a corner that is not finite on a map with cuts stays at 0; a lattice point that is not finite
  // asks for the most
  const LAND_LV_VS = REFINE + REFINE_BUILD + `
uniform highp sampler2D uLp; uniform int uJ0;
out vec4 tfOut;
// uLat 2 (moving, a mesh over 256 cells): uLp holds the base heights; the second differences around the cell at one
// cell's spacing (D at a quarter cell is a sixteenth of that), no evaluation of the chain (r2 review math-3)
float d2b(ivec2 p, ivec2 e, inout bool fin) {
  ivec2 a = clamp(p - e, ivec2(0), ivec2(uM)), b = clamp(p + e, ivec2(0), ivec2(uM));
  vec4 ta = texelFetch(uLp, a, 0), tp = texelFetch(uLp, p, 0), tb = texelFetch(uLp, b, 0);
  if (!(ta.w > 0.5 && tp.w > 0.5 && tb.w > 0.5)) fin = false;
  return abs(ta.z - 2.0 * tp.z + tb.z);
}
float levelsBase(ivec2 c, inout bool fin) {
  float dx = 0.0, dy = 0.0;
  for (int b = 0; b < 2; b++) for (int a = 0; a < 2; a++) {
    dx = max(dx, d2b(c + ivec2(a, b), ivec2(1, 0), fin));
    dy = max(dy, d2b(c + ivec2(a, b), ivec2(0, 1), fin));
  }
  float dd = max(d2b(c, ivec2(1, 1), fin), d2b(c + ivec2(1, 1), ivec2(1, 1), fin));
  if (dx >= dy) dx = max(dx, dd); else dy = max(dy, dd);
  float f = uCellW * uPxW;
  int Lp = f > uMinPx ? int(ceil(log2(f / uMinPx))) : 0;
  return float(clamp(min(levelD(dx / 16.0), Lp), 0, 4) + 8 * clamp(min(levelD(dy / 16.0), Lp), 0, 4));
}
bool jmp(int d, ivec2 p) { return d == 0 ? texelFetch(uE0, p, 0).w > 0.5 : (d == 1 ? texelFetch(uE1, p, 0).w > 0.5 : texelFetch(uE2, p, 0).w > 0.5); }
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  // (uJ0: the first row of cells of this strip; uLp holds the lattice's rows from s uJ0 on)
  int Mq = (uM + 3) / 4, q = gl_VertexID % Mq, j = uJ0 + gl_VertexID / Mq, s = uLat == 1 ? 4 : 2;
  float lv[4]; float lat[25];
  for (int k = 0; k < 4; k++) {
    lv[k] = 0.0;
    ivec2 c = ivec2(4 * q + k, j);
    if (c.x >= uM) continue;
    // (64: a cell left to the cut rule, never refined, and never filled in around a moving wall either, rfPlan; r3)
    lv[k] = 64.0;
    if (uCuts < 0) continue;
    if (uCuts > 0 && (jmp(0, c) || jmp(0, c + ivec2(0, 1)) || jmp(1, c) || jmp(1, c + ivec2(1, 0)) || jmp(2, c))) continue;
    bool fin = true, cfin = true;
    if (uLat == 2) {
      float l2 = levelsBase(c, fin);
      if (!fin && uCuts > 0) continue;
      lv[k] = !fin ? float(9 * levelOf(1e30)) : l2;
      continue;
    }
    for (int b = 0; b < 5; b++) for (int a = 0; a < 5; a++) {
      lat[b * 5 + a] = 0.0;
      if (uLat == 0 && ((a & 1) == 1 || (b & 1) == 1)) continue;
      vec4 t = texelFetch(uLp, c * s + ivec2(a, b) * s / 4 - ivec2(0, uJ0 * s), 0);
      lat[b * 5 + a] = t.z;
      if (!(t.w > 0.5)) { fin = false; if ((a == 0 || a == 4) && (b == 0 || b == 4)) cfin = false; }
    }
    if (!cfin && uCuts > 0) continue;
    lv[k] = !fin ? float(9 * levelOf(1e30)) : (uLat == 1 ? levelsLat(lat) : levels2(vec4(lat[0], lat[4], lat[20], lat[24]), lat[2], lat[22], lat[10], lat[14], lat[12]));
  }
  tfOut = vec4(lv[0], lv[1], lv[2], lv[3]);
}
`;
  // The refined vertices of one group (levels uL, its first list entry uGE, uTot vertices): RP the points to evaluate,
  // five per vertex (the vertex, then x + d, x - d, y + d, y - d at its normal's spacing); RA, after the chain pass on
  // them (uPv), the vertex records, two texels each: (h, valid, nx, ny), the normal by central differences, and (w, its
  // position in 16ths of a cell). A base vertex next to a base cell takes the base passes' height, value and normal
  const LAND_RP_VS = REFINE + REFINE_BUILD + `
uniform vec4 uBox; uniform ivec2 uL; uniform int uGE; uniform int uTot;
out vec4 tfOut;
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  int id = gl_VertexID / 5, k = gl_VertexID - 5 * id;
  tfOut = vec4(0.0);
  if (id >= uTot) return;
  ivec2 n = ivec2(1 << uL.x, 1 << uL.y);
  int S = (n.x + 1) * (n.y + 1), e = id / S, l = id - e * S;
  ivec4 sv = snapV(lstCell(uGE + e), uL, ivec2(l % (n.x + 1), l / (n.x + 1)));
  vec2 d = uBox.zw / float(uM) / vec2(float(1 << max(sv.z, 0)), float(1 << max(sv.w, 0)));
  vec2 z = uBox.xy + vec2(sv.xy) * (uBox.zw / float(16 * uM));
  tfOut = vec4(z + (k == 0 ? vec2(0.0) : (k == 1 ? vec2(d.x, 0.0) : (k == 2 ? vec2(-d.x, 0.0) : (k == 3 ? vec2(0.0, d.y) : vec2(0.0, -d.y))))), 0.0, 0.0);
}
`;
  const LAND_RA_VS = REFINE + REFINE_BUILD + `
uniform vec4 uBox; uniform vec2 uAspect; uniform ivec2 uL; uniform int uGE; uniform int uTot;
uniform highp sampler2D uT1; uniform highp sampler2D uT2; uniform highp sampler2D uPv;
out vec4 tfOut;
vec4 pv(int i) { return texelFetch(uPv, ivec2(i & 2047, i >> 11), 0); }
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  int id = gl_VertexID >> 1, part = gl_VertexID & 1;
  tfOut = vec4(0.0);
  if (id >= uTot) return;
  ivec2 n = ivec2(1 << uL.x, 1 << uL.y);
  int S = (n.x + 1) * (n.y + 1), e = id / S, l = id - e * S;
  ivec4 sv = snapV(lstCell(uGE + e), uL, ivec2(l % (n.x + 1), l / (n.x + 1)));
  bool corner = (sv.x & 15) == 0 && (sv.y & 15) == 0;
  vec4 p0 = corner ? texelFetch(uT1, sv.xy >> 4, 0) : pv(5 * id);
  if (part == 1) { tfOut = vec4(p0.xy, vec2(sv.xy)); return; }
  vec3 nrm;
  if (sv.z < 0) nrm = texelFetch(uT2, sv.xy >> 4, 0).xyz;
  else {
    vec2 d = uBox.zw / float(uM) / vec2(float(1 << max(sv.z, 0)), float(1 << max(sv.w, 0)));
    vec2 dw = d * 2.0 * uAspect / uBox.zw;   // the spacing in world units
    vec4 r = pv(5 * id + 1), lf = pv(5 * id + 2), u = pv(5 * id + 3), dn = pv(5 * id + 4);
    bool oR = r.w > 0.5, oL = lf.w > 0.5, oU = u.w > 0.5, oD = dn.w > 0.5;
    float h0 = p0.z;
    float sx = oL && oR ? (r.z - lf.z) / (2.0 * dw.x) : (oR ? (r.z - h0) / dw.x : (oL ? (h0 - lf.z) / dw.x : 0.0));
    float sy = oD && oU ? (u.z - dn.z) / (2.0 * dw.y) : (oU ? (u.z - h0) / dw.y : (oD ? (h0 - dn.z) / dw.y : 0.0));
    nrm = normalize(vec3(-sx, -sy, 1.0));
  }
  tfOut = vec4(p0.w > 0.5 ? p0.z : 0.0, p0.w, nrm.xy);
}
`;
  // The real discontinuities of the principal surface (notes/landscape-walls/DESIGN.md 3.1, 3.2): a steep slope is never
  // one. Per grid edge p -> p + d (uDir 0: d = (1, 0), 1: (0, 1), 2: (1, 1)) one transform-feedback texel
  // (t, height on p's side, height on the far side, jump): jump 1 when a cut crosses the edge at t, with the one-sided
  // heights of the two banks there; else (0.5, 0, 0, 0).
  // kind 'S' / 'H' (uCutMode 1; S the stages a..b, chainSheetRange; H a deformation, chainSheetHom): values are
  // compared with the continuation of p's branch along the edge (the cuts opposite p, combo 0, uSheetW = 0), at the
  // far end (its principal value read from the height pass) and at the midpoint (a cut crossed twice comes back to the
  // same branch at the far end); a different value is a cut, located by bisection with the same test. The principal
  // value inside the edge is the continuation at its own centre (every piece on its principal branch there: cutModeOf
  // picks this mode only then). Kind '2' (uCutMode 2): discontinuities the chain cannot continue (an inverse trig
  // function, arg, or a d/dz after a cut): a height step that does not shrink under bisection is a jump, unless F grows
  // without bound on both sides (a pole on the edge).
  // (Each kind has one call site of one chain evaluation, in loops whose trip counts are uniforms: the program stays
  // about the size of the height pass's and compiles about as fast, review pictures-1. No return inside a loop:
  // ANGLE's Metal translation lost the result of this pass when a loop returned early.)
  const LAND_EDGE_VS = (kind) => (kind === '2' ? `
vec2 princAt(vec2 z) { return mapF(z); }
vec2 contAt(vec2 zc, vec2 z) { return z; }
` : kind === 'H' ? `
vec2 princAt(vec2 z) { return z; }
vec2 contAt(vec2 zc, vec2 z) { return chainSheetHom(zc, z, uMode, uBase, uA, uHi, uB, uPost, uT, 0, 0); }
` : `
uniform int uSheetA; uniform int uSheetB;
vec2 princAt(vec2 z) { return z; }
vec2 contAt(vec2 zc, vec2 z) { return chainSheetRange(zc, z, uSheetA, uSheetB, 0); }
`) + `
uniform highp sampler2D uT1; uniform int uN; uniform vec4 uBox; uniform int uDir; uniform int uSteps; uniform int uTwo;
const int uCutMode = ${kind === '2' ? 2 : 1};
out vec4 tfOut;
vec2 zAt(ivec2 g) { return uBox.xy + vec2(g) / float(uN - 1) * uBox.zw; }
// c (the continuation) and p (the principal value) on the same branch; a value that is not finite tells nothing
bool sameBranch(vec2 c, vec2 p) {
  float ac = wabs(c), ap = wabs(p);
  if (!(ac < 1e30) || !(ap < 1e30)) return true;
  return length(c - p) <= 1e-3 * (ac + ap) + 1e-20;
}
vec4 edgeJump(ivec2 p, ivec2 q) {
  vec4 none = vec4(0.5, 0.0, 0.0, 0.0);
  if (q.x >= uN || q.y >= uN) return none;
  vec4 a = texelFetch(uT1, p, 0), b = texelFetch(uT1, q, 0);
  if (a.w < 0.5 || b.w < 0.5) return none;
  float tol = 2e-3 * uH;                 // under a pixel at the fitted camera: no visible step
  vec2 z0 = zAt(p), z1 = zAt(q);
  float lo = 0.0, hi = 1.0, hLo = a.z, hHi = b.z, d0 = abs(b.z - a.z), d3 = d0;
  // kind 2 starts on a height step only; |w| at the bracket's ends (a pole: both grow without bound)
  bool jump = uCutMode == 2 && d0 > tol, fin = true, twice = false;
  vec2 wLo = a.xy, wHi = b.xy;
  // kind S / H: step 0 the far end, step 1 the midpoint, then bisection while a cut is bracketed; kind 2: bisection
  int n = uCutMode == 1 ? uSteps + 2 : (jump ? uSteps - 1 : 0);
  for (int k = 0; k < n; k++) {
    float m = uCutMode == 1 && k == 0 ? 1.0 : 0.5 * (lo + hi);
    vec2 zm = mix(z0, z1, m);
    vec2 wp = b.xy, wc = b.xy;
    if (uCutMode == 2) wp = princAt(zm);
    else {
      // (the continuation from p, and the principal value at zm, the continuation at its own centre; at the far end
      // that is the height pass's: one call site for both)
      int nr = k == 0 ? 1 : uTwo;
      for (int r = 0; r < nr; r++) {
        vec2 v = contAt(r == 0 ? z0 : zm, zm);
        if (r == 0) wc = v; else wp = v;
      }
    }
    vec2 hp = heightW(wp);
    if (uCutMode == 1) {
      bool same = sameBranch(wc, wp);
      if (k == 0) {
        jump = !same;
        // (a flat edge, under a pixel of rise, is not looked at twice)
        if (!jump && !(d0 > tol)) break;
      } else if (k == 1 && !jump) {
        // (the far end on p's branch: a cut crossed twice shows at the midpoint, the bracket is then [0, 1/2])
        if (same) break;
        jump = true; twice = true; hi = m; if (hp.y > 0.5) hHi = hp.x;
      } else if (jump) {
        if (same) { lo = m; if (hp.y > 0.5) hLo = hp.x; } else { hi = m; if (hp.y > 0.5) hHi = hp.x; }
      }
    } else {
      if (!(hp.y > 0.5)) { fin = false; break; }
      if (abs(hp.x - hLo) >= abs(hHi - hp.x)) { hi = m; hHi = hp.x; wHi = wp; } else { lo = m; hLo = hp.x; wLo = wp; }
      if (k == 2) {
        d3 = abs(hHi - hLo);
        // (a continuous rise shrinks under bisection, by 8 over three halvings where it is smooth: stop early)
        if (d3 < 0.2 * d0) { jump = false; break; }
      }
    }
  }
  if (uCutMode == 1) {
    // (a step that vanishes at the crossing is no discontinuity of the height: Re of a root across its cut)
    jump = jump && abs(hHi - hLo) > tol;
  } else {
    float big = 1e3 * max(uMu, 1e-30);
    jump = jump && fin && abs(hHi - hLo) > 0.6 * d3 && abs(hHi - hLo) > 0.02 * uH && !(wabs(wLo) > big && wabs(wHi) > big);
  }
  // (w 2: the edge crosses a cut twice, or two cuts: the far end is on the near end's branch, the midpoint is not; its
  // triangles are left out, LAND_VS, as a cell that holds two cuts: nothing is drawn across either)
  return jump ? vec4(0.5 * (lo + hi), hLo, hHi, twice ? 2.0 : 1.0) : none;
}
void main() {
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  ivec2 q = p + (uDir == 0 ? ivec2(1, 0) : (uDir == 1 ? ivec2(0, 1) : ivec2(1, 1)));
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  tfOut = edgeJump(p, q);
}
`;
  // normals by central differences (one-sided across a real jump, LAND_EDGE_VS) and ambient occlusion from a 9x9 box
  // filter
  const LAND_NRM_VS = `
uniform highp sampler2D uT1; uniform highp sampler2D uE0; uniform highp sampler2D uE1; uniform int uN; uniform vec2 uAspect; uniform float uH;
uniform int uCuts;
out vec4 tfOut;
vec4 T(ivec2 p) { return texelFetch(uT1, p, 0); }
// (uCuts -1: the edge pass still compiles, the former rule stands in: a height step over 0.3 H)
bool jx(ivec2 p) { return uCuts > 0 ? texelFetch(uE0, p, 0).w > 0.5 : uCuts < 0 && abs(T(p + ivec2(1, 0)).z - T(p).z) > 0.3 * uH; }
bool jy(ivec2 p) { return uCuts > 0 ? texelFetch(uE1, p, 0).w > 0.5 : uCuts < 0 && abs(T(p + ivec2(0, 1)).z - T(p).z) > 0.3 * uH; }
void main() {
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  vec4 c = T(p);
  float h = c.z;
  vec2 dw = 2.0 * uAspect / float(uN - 1);
  vec4 L = T(max(p - ivec2(1, 0), ivec2(0))), R = T(min(p + ivec2(1, 0), ivec2(uN - 1)));
  vec4 D = T(max(p - ivec2(0, 1), ivec2(0))), U = T(min(p + ivec2(0, 1), ivec2(uN - 1)));
  bool oL = p.x > 0 && L.w > 0.5 && !jx(p - ivec2(1, 0)), oR = p.x < uN - 1 && R.w > 0.5 && !jx(p);
  bool oD = p.y > 0 && D.w > 0.5 && !jy(p - ivec2(0, 1)), oU = p.y < uN - 1 && U.w > 0.5 && !jy(p);
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
  // One instance per grid triangle, 9 vertices: up to 3 output triangles. A triangle is never dropped for being steep:
  // only a corner that is not finite drops it. A real jump (LAND_EDGE_VS) splits it along the chord between the
  // crossing points: each bank is drawn up to the cut with its own one-sided height there, nothing across it, and the
  // cut edge gets the cut colour's rim (vEdge). Two crossed edges: the corner they share on one bank, the other two
  // on the other (3 triangles). One crossed edge (the cut ends inside, at a branch point): a slit from the crossing
  // to the opposite corner. Three, or an edge crossed twice (LAND_EDGE_VS w 2: two cuts, or one cut twice, on one
  // edge): the triangle is left out (two cuts inside one cell; nothing is drawn across either).
  // uRef 0: the base cells (a refined cell is left to its own draw, uRefOn); uRef 1: one instance per triangle of the
  // sub-cells of one group's cells (levels uL, list entries from uRefE, vertex records from texel uRefT of uRf; 3
  // vertices each; vW: F at the vertex, for sub-cells under about a pixel, LAND_FS)
  // While something moves (uSteep 1), a base triangle with a corner sloped over 1 (its normal), in a cell without a
  // jump, is drawn by landB instead (LAND_B_VS), which has facetW; the levels come a frame or two late, and a wall that
  // has moved past them lies on base cells (r3 review pictures-1: at the Max mesh it moved 15 to 20 cells between two
  // reads near the domain's edge, past any fill-in around the walls of the last levels)
  const STEEP = `
// the jump data of the grid segment a -> b oriented from a: (t, height on a's bank, on b's bank, jump)
vec4 edgeOf(ivec2 a, ivec2 b) {
  if (uCuts <= 0) return vec4(0.5, 0.0, 0.0, 0.0);
  ivec2 d = b - a;
  bool rev = d.x < 0 || d.y < 0;
  ivec2 o = rev ? b : a, ad = abs(d);
  vec4 e = ad.y == 0 ? texelFetch(uE0, o, 0) : (ad.x == 0 ? texelFetch(uE1, o, 0) : texelFetch(uE2, o, 0));
  return rev ? vec4(1.0 - e.x, e.z, e.y, e.w) : e;
}
bool steepTri(ivec2 a, ivec2 b, ivec2 c) {
  vec3 na = texelFetch(uT2, a, 0).xyz, nb = texelFetch(uT2, b, 0).xyz, nc = texelFetch(uT2, c, 0).xyz;
  return length(na.xy) > abs(na.z) || length(nb.xy) > abs(nb.z) || length(nc.xy) > abs(nc.z);
}
`;
  const LAND_VS = REFINE + `
uniform highp sampler2D uT1; uniform highp sampler2D uT2;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP;
uniform int uRefOn; uniform int uSteep;
` + STEEP + `
out vec2 vZ; out vec2 vW; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge; flat out vec3 vBoxE;
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vEdge = vec3(0.0); vBoxE = vec3(0.0);
  int M = uN - 1;
  int tri = gl_InstanceID % 2, cell = gl_InstanceID / 2;
  ivec2 c = ivec2(cell % M, cell / M);
  if (uRefOn == 1 && lvDrawnR(c)) return;
  ivec2 V0 = c, V1 = tri == 0 ? c + ivec2(1, 0) : c + ivec2(1, 1), V2 = tri == 0 ? c + ivec2(1, 1) : c + ivec2(0, 1);
  vec4 t0 = texelFetch(uT1, V0, 0), t1 = texelFetch(uT1, V1, 0), t2 = texelFetch(uT1, V2, 0);
  if (t0.w < 0.5 || t1.w < 0.5 || t2.w < 0.5) return;
  // (uCuts -1: the edge pass still compiles; the former rule stands in for a moment: a height step over 0.3 H)
  if (uCuts < 0 && max(max(t0.z, t1.z), t2.z) - min(min(t0.z, t1.z), t2.z) > 0.3 * uH) return;
  vec4 e01 = edgeOf(V0, V1), e12 = edgeOf(V1, V2), e20 = edgeOf(V2, V0);
  bool j01 = e01.w > 0.5, j12 = e12.w > 0.5, j20 = e20.w > 0.5;
  int J = int(j01) + int(j12) + int(j20);
  if (J == 3 || max(max(e01.w, e12.w), e20.w) > 1.5) return;
  // rotate (winding kept): one jump on AB, or two on AB and AC (BC whole)
  int r = J == 1 ? (j01 ? 0 : (j12 ? 1 : 2)) : (J == 2 ? (!j12 ? 0 : (!j20 ? 1 : 2)) : 0);
  ivec2 A = r == 0 ? V0 : (r == 1 ? V1 : V2), B = r == 0 ? V1 : (r == 1 ? V2 : V0), C = r == 0 ? V2 : (r == 1 ? V0 : V1);
  int sub = gl_VertexID / 3, k = gl_VertexID - 3 * sub;
  // this vertex: a corner (src) or the crossing on A -> B / A -> C (x 1 / 2) on the bank of corner src
  ivec2 src = A; int x = 0;
  if (J == 0) { if (sub > 0 || (uSteep == 1 && steepTri(V0, V1, V2))) return; src = k == 0 ? A : (k == 1 ? B : C); }
  else if (J == 1) {
    if (sub > 1) return;
    if (sub == 0) { src = A; x = k == 1 ? 1 : 0; if (k == 2) src = C; vEdge = vec3(1.0, 0.0, 0.0); }
    else { src = k == 0 ? B : (k == 1 ? B : C); x = k == 0 ? 1 : 0; vEdge = vec3(0.0, 1.0, 0.0); }
  } else {
    if (sub == 0) { src = A; x = k; vEdge = vec3(1.0, 0.0, 0.0); }
    else if (sub == 1) { src = k == 0 ? B : (k == 1 ? B : C); x = k == 0 ? 1 : 0; }
    else { src = k == 0 ? B : C; x = k == 0 ? 1 : (k == 2 ? 2 : 0); vEdge = vec3(0.0, 1.0, 0.0); }
  }
  vec2 g = vec2(src);
  float h = texelFetch(uT1, src, 0).z;
  if (x > 0) {
    ivec2 E = x == 1 ? B : C;
    vec4 e = edgeOf(A, E);
    g = mix(vec2(A), vec2(E), e.x);
    h = src == A ? e.y : e.z;
  }
  vec4 nv = texelFetch(uT2, src, 0);
  vec2 uv = g / float(M);
  vZ = uBox.xy + uv * uBox.zw;
  vW = vec2(0.0);
  vPos = vec3((uv - 0.5) * 2.0 * uAspect, h);
  vNor = nv.xyz; vAO = nv.w;
  vBary = k == 0 ? vec3(1.0, 0.0, 0.0) : (k == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  gl_Position = uMVP * vec4(vPos, 1.0);
}
`;
  // the refined cells' draw (a program without the chain, so a formula's first Landscape compiles only what it did
  // before): one instance per triangle of the sub-cells of one group's cells (levels uL, list entries from uRefE,
  // vertex records from texel uRefT of uRf), 3 vertices each; F at the vertices (vW), interpolated: the sub-cells are
  // under about a pixel on screen, and in a figure the levels rise with its size
  const LAND_R_VS = REFINE + `
uniform highp sampler2D uT2; uniform highp sampler2D uRf;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform mat4 uMVP;
uniform ivec2 uL; uniform int uRefE; uniform int uRefT;
out vec2 vZ; out vec2 vW; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge; flat out vec3 vBoxE;
vec4 rfAt(int t) { return texelFetch(uRf, ivec2(t & 2047, t >> 11), 0); }
void refined() {
  ivec2 n = ivec2(1 << uL.x, 1 << uL.y);
  int per = 2 * n.x * n.y;
  int e = gl_InstanceID / per, r = gl_InstanceID - e * per;
  int tri = r & 1, sub = r >> 1, k = gl_VertexID;
  ivec2 s0 = ivec2(sub % n.x, sub / n.x);
  ivec2 sA = s0, sB = tri == 0 ? s0 + ivec2(1, 0) : s0 + ivec2(1, 1), sC = tri == 0 ? s0 + ivec2(1, 1) : s0 + ivec2(0, 1);
  int vb = uRefT + 2 * e * (n.x + 1) * (n.y + 1);
  int iA = vb + 2 * (sA.y * (n.x + 1) + sA.x), iB = vb + 2 * (sB.y * (n.x + 1) + sB.x), iC = vb + 2 * (sC.y * (n.x + 1) + sC.x);
  vec4 ta = rfAt(iA), tb = rfAt(iB), tc = rfAt(iC);
  if (k > 2 || ta.y < 0.5 || tb.y < 0.5 || tc.y < 0.5) return;
  int iv = k == 0 ? iA : (k == 1 ? iB : iC);
  vec4 tv = k == 0 ? ta : (k == 1 ? tb : tc), t2 = rfAt(iv + 1);
  ivec2 c = lstCell(uRefE + e);
  if (!lvDrawnR(c)) return;   // (a cell that now holds a jump: drawn by the base cells' draw)
  vec2 uv = t2.zw / float(16 * uM);
  vZ = uBox.xy + uv * uBox.zw;
  vW = t2.xy;
  vPos = vec3((uv - 0.5) * 2.0 * uAspect, tv.x);
  vNor = vec3(tv.zw, sqrt(max(1.0 - dot(tv.zw, tv.zw), 0.0)));
  // (ambient occlusion: the base corners', bilinear across the cell, so two cells agree along their side)
  vec2 f = t2.zw / 16.0 - vec2(c);
  float a00 = texelFetch(uT2, c, 0).w, a10 = texelFetch(uT2, c + ivec2(1, 0), 0).w;
  float a01 = texelFetch(uT2, c + ivec2(0, 1), 0).w, a11 = texelFetch(uT2, c + ivec2(1, 1), 0).w;
  vAO = mix(mix(a00, a10, f.x), mix(a01, a11, f.x), f.y);
  vBary = k == 0 ? vec3(1.0, 0.0, 0.0) : (k == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  gl_Position = uMVP * vec4(vPos, 1.0);
}
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vEdge = vec3(0.0); vBoxE = vec3(0.0);
  refined();
}
`;
  // the steep base triangles while something moves (STEEP): a program without the chain, F from the corners (vW), as
  // landR's sub-cells, so facetW draws their contours on the facet; compiled once per page, warmed with the
  // refinement's programs (rfWarmed)
  const LAND_B_VS = REFINE + `
uniform highp sampler2D uT1; uniform highp sampler2D uT2;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP;
uniform int uRefOn;
` + STEEP + `
out vec2 vZ; out vec2 vW; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge; flat out vec3 vBoxE;
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vEdge = vec3(0.0); vBoxE = vec3(0.0);
  int M = uN - 1;
  // (not instanced: three vertices per instance filled a fraction of each SIMD group, and the draw cost 1 to 3 ms at
  // the Max mesh)
  int id = gl_VertexID / 3, k = gl_VertexID - 3 * id, tri = id % 2, cell = id / 2;
  ivec2 c = ivec2(cell % M, cell / M);
  ivec2 V0 = c, V1 = tri == 0 ? c + ivec2(1, 0) : c + ivec2(1, 1), V2 = tri == 0 ? c + ivec2(1, 1) : c + ivec2(0, 1);
  // (the partition with land's draw, LAND_VS: a triangle without a jump on its edges, sloped over 1 at a corner)
  if (!steepTri(V0, V1, V2) || (uRefOn == 1 && lvDrawnR(c))) return;
  if (edgeOf(V0, V1).w > 0.5 || edgeOf(V1, V2).w > 0.5 || edgeOf(V2, V0).w > 0.5) return;
  vec4 t0 = texelFetch(uT1, V0, 0), t1 = texelFetch(uT1, V1, 0), t2 = texelFetch(uT1, V2, 0);
  if (t0.w < 0.5 || t1.w < 0.5 || t2.w < 0.5) return;
  if (uCuts < 0 && max(max(t0.z, t1.z), t2.z) - min(min(t0.z, t1.z), t2.z) > 0.3 * uH) return;
  ivec2 src = k == 0 ? V0 : (k == 1 ? V1 : V2);
  vec4 t = k == 0 ? t0 : (k == 1 ? t1 : t2), nv = texelFetch(uT2, src, 0);
  vec2 uv = vec2(src) / float(M);
  vZ = uBox.xy + uv * uBox.zw;
  vW = t.xy;
  vPos = vec3((uv - 0.5) * 2.0 * uAspect, t.z);
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
  // the surface number combo of the drawn map at (zc, z): mode 0 the steps (uSheetA, uSheetB] (chainSheetRange, as
  // before); a deformation (modes 1 and 3, the map's own uniforms) H_t on the sheets that become F's (chainSheetHom,
  // notes/v16-user5/SHEETS-DESIGN.md)
  const SHEET_MAP = `
uniform int uSheetA; uniform int uSheetB;
vec2 mapSheet(vec2 zc, vec2 z, int combo) {
  if (uMode == 1 || uMode == 3) return chainSheetHom(zc, z, uMode, uBase, uA, uHi, uB, uPost, uT, combo, uSheetB);
  return chainSheetRange(zc, z, uSheetA, uSheetB, combo);
}
`;
  // uPass 0: the base cells' corners (as above); the refinement: uPass 1 the levels, four cells per invocation, the largest chord
  // errors over the sheets (one pair of levels per cell for every sheet, so a cell's neighbours know it); 2 the refined
  // sub-cells' corners of one group (levels uL, first list entry uGE, uTot blocks), a block of 4 x 2 texels per
  // (sub-cell, combo), 512 blocks per two rows: the corners' (h, valid, nx, ny) in its left half, (w, position in
  // 16ths) in its right. A sub-cell takes the local cuts opposite its own centre, as a base cell does: the only cut
  // left inside a cell is at a branch point, in the one sub-cell (under half a pixel) that holds it (the log log z fin).
  const LAND_SHEET_TF_VS = (ref) => SHEET_MAP + (ref ? REFINE + REFINE_BUILD : '') + `
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform int uSheetK; uniform int uTileC; uniform int uTexW;
${ref ? 'uniform int uPass; uniform highp sampler2D uT1; uniform ivec2 uL; uniform int uGE; uniform int uTot; uniform int uRow0;' : ''}
out vec4 tfOut;
${ref ? `vec2 zOfG(vec2 G) { return uBox.xy + G * (uBox.zw / float(16 * uM)); }
ivec2 tileOf(int combo) { return ivec2(combo % uTileC, combo / uTileC) * (2 * uM); }
` : ''}
void main() {
  int M = uN - 1, T = 2 * M;
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  tfOut = vec4(0.0);
  vec2 d = uBox.zw / float(M);
  int n = 5, combo = 0, part = 0;
  ivec2 cor = ivec2(0), G = ivec2(0);
  vec2 z = vec2(0.0), zc = vec2(0.0), e = vec2(0.0);
${ref ? `  int Mq = (M + 3) / 4, q = 0, j = 0;
  if (uPass == 1) {
    q = gl_VertexID % Mq; j = gl_VertexID / Mq; n = (uLat == 1 ? 84 : 20) * uSheetK;
  } else if (uPass == 2) {
    int id = gl_VertexID + uRow0 * 2048;   // (uRow0: a chunk of the group's rows, built over several frames)
    ivec2 p = ivec2(id & 2047, id >> 11);
    int b = (p.y >> 1) * 512 + (p.x >> 2);
    if (b >= uTot) return;   // (uTot: the group's blocks)
    cor = ivec2(p.x & 1, p.y & 1);
    part = (p.x >> 1) & 1;
    ivec2 nn = ivec2(1 << uL.x, 1 << uL.y);
    combo = b % uSheetK;
    int r = b / uSheetK, ns = nn.x * nn.y, en = r / ns, sub = r - en * ns;
    ivec2 s0 = ivec2(sub % nn.x, sub / nn.x);
    ivec2 c = lstCell(uGE + en);
    ivec4 sv = snapV(c, uL, s0 + cor);
    G = sv.xy;
    vec2 sc = vec2(16 >> uL.x, 16 >> uL.y);
    zc = zOfG(vec2(c * 16) + vec2(s0) * sc + 0.5 * sc);
    z = zOfG(vec2(sv.xy));
    e = 0.5 * d / vec2(float(1 << max(sv.z, 0)), float(1 << max(sv.w, 0)));
    n = part == 1 ? 1 : 5;
  } else {
    ivec2 p = ivec2(gl_VertexID % uTexW, gl_VertexID / uTexW);
    ivec2 tile = p / T, qq = p - tile * T;
    combo = tile.y * uTileC + tile.x;
    ivec2 cell = qq / 2;
    cor = qq - cell * 2;
    if (combo >= uSheetK) return;
    zc = uBox.xy + (vec2(cell) + 0.5) * d;
    z = uBox.xy + vec2(cell + cor) * d;
    // (the normal from one cell's span: the slope the drawn triangles have, so a wall inside a cell shades as a wall)
    e = 0.5 * d;
  }
  float Hc = 1.4 * uH;   // (linear heights run on past the block: their error counts up to it)
  vec4 lv = vec4(0.0), hc = vec4(0.0);
  bool bad = false;
  float lat[25];
  int per = uLat == 1 ? 21 : 5;` : `  ivec2 p = ivec2(gl_VertexID % uTexW, gl_VertexID / uTexW);
  ivec2 tile = p / T, qq = p - tile * T;
  combo = tile.y * uTileC + tile.x;
  ivec2 cell = qq / 2;
  cor = qq - cell * 2;
  if (combo >= uSheetK) return;
  zc = uBox.xy + (vec2(cell) + 0.5) * d;
  z = uBox.xy + vec2(cell + cor) * d;
  // (the normal from one cell's span: the slope the drawn triangles have, so a wall inside a cell shades as a wall)
  e = 0.5 * d;`}
  // one call site of the chain, in a loop whose trip count is not a constant (a constant one is unrolled): the corner,
  // then x + e, x - e, y + e, y - e (part 1: the corner's value only)${ref ? '; pass 1: per cell and sheet its 5 points' : ''}
  float h[5]; float ok[5]; vec2 w0 = vec2(0.0);
  for (int k = 0; k < 5; k++) { h[k] = 0.0; ok[k] = 0.0; }
  for (int it = 0; it < n; it++) {
    int p = it, cq = combo, kc = 0;
    vec2 zq = z, zcq = zc;
${ref ? `    if (uPass == 1) {
      kc = it / (per * uSheetK);
      int rem = it - kc * per * uSheetK;
      cq = rem / per; p = rem - per * cq;
      ivec2 c = ivec2(4 * q + kc, j);
      if (c.x >= M) continue;
      if (p == 0) {
        ivec2 b = tileOf(cq) + 2 * c;
        vec4 a = texelFetch(uT1, b, 0), bb = texelFetch(uT1, b + ivec2(1, 0), 0), cc = texelFetch(uT1, b + ivec2(0, 1), 0), dd = texelFetch(uT1, b + ivec2(1, 1), 0);
        bad = !(a.y > 0.5 && bb.y > 0.5 && cc.y > 0.5 && dd.y > 0.5);
        hc = clamp(vec4(a.x, bb.x, cc.x, dd.x), -Hc, Hc);
        for (int i = 0; i < 25; i++) lat[i] = 0.0;
        lat[0] = hc.x; lat[4] = hc.y; lat[20] = hc.z; lat[24] = hc.w;
      }
      int li = latIdx(p);
      zcq = uBox.xy + (vec2(c) + 0.5) * d;
      zq = uBox.xy + (vec2(c) + vec2(float(li % 5), float(li / 5)) * 0.25) * d;
    } else` : ''} {
      zq = z + (p == 0 ? vec2(0.0) : (p == 1 ? vec2(e.x, 0.0) : (p == 2 ? vec2(-e.x, 0.0) : (p == 3 ? vec2(0.0, e.y) : vec2(0.0, -e.y)))));
    }
    vec2 w = mapSheet(zcq, zq, cq);
    vec2 hv = heightW(w);
${ref ? `    if (uPass == 1) {
      lat[latIdx(p)] = clamp(hv.x, -Hc, Hc);
      if (!(hv.y > 0.5)) bad = true;
      if (p == per - 1) {
        float l2 = bad ? float(9 * levelOf(1e30)) : (uLat == 1 ? levelsLat(lat) : levels2(hc, lat[2], lat[22], lat[10], lat[14], lat[12]));
        float o2 = kc == 0 ? lv.x : (kc == 1 ? lv.y : (kc == 2 ? lv.z : lv.w));
        int ox = int(o2 + 0.5), nx = int(l2 + 0.5);
        float r2 = float(max(ox & 7, nx & 7) + 8 * max(ox >> 3, nx >> 3));
        if (kc == 0) lv.x = r2; else if (kc == 1) lv.y = r2; else if (kc == 2) lv.z = r2; else lv.w = r2;
      }
      continue;
    }` : ''}
    if (it == 0) w0 = w;
    h[p] = hv.x; ok[p] = hv.y;
  }
${ref ? `  if (uPass == 1) { tfOut = lv; return; }
  if (part == 1) { tfOut = vec4(isnan(w0.x) ? 1.0 : clamp(w0.x, -3e38, 3e38), isnan(w0.y) ? 0.0 : clamp(w0.y, -3e38, 3e38), vec2(G)); return; }` : ''}
  vec2 sw = 2.0 * uAspect / uBox.zw;   // world units per unit of z
  // (no cliff rule: the cell's own continuation is continuous, a steep slope is a wall)
  bool oR = ok[1] > 0.5, oL = ok[2] > 0.5, oU = ok[3] > 0.5, oD = ok[4] > 0.5;
  float sx = oL && oR ? (h[1] - h[2]) / (2.0 * e.x) : (oR ? (h[1] - h[0]) / e.x : (oL ? (h[0] - h[2]) / e.x : 0.0));
  float sy = oD && oU ? (h[3] - h[4]) / (2.0 * e.y) : (oU ? (h[3] - h[0]) / e.y : (oD ? (h[0] - h[4]) / e.y : 0.0));
  vec3 nr = normalize(vec3(-sx / sw.x, -sy / sw.y, 1.0));
  tfOut = vec4(ok[0] > 0.5 ? h[0] : 0.0, ok[0], nr.x, nr.y);
}
`;
  // One instance per (combo, cell, triangle), 9 vertices: a triangle is left out only where a corner is not finite
  // (never for being steep: inside a cell the sheet is continuous, a steep slope is a wall). Linear heights (uClip):
  // the sheets run on beyond the block and are clipped exactly at its top and bottom, |h| = 1.25 H, the polygon left
  // of the triangle (up to 5 corners) drawn as a fan; the clipped edges are marked (vBoxE) for the rim. The fragment
  // stage evaluates F on the same sheet with the same cuts. uRef 0: the base cells (a refined one left to its own
  // draw); uRef L > 0: the level-L cells' sub-cells, one instance per (entry, sub-cell, combo, triangle), the corners
  // from uRf. The per-sheet cue (uCue, LAND_FS): each sheet behind the one before it by a few depth units, so where
  // two coincide (a deformation near t = 0) the first one shows, never a mix of the two.
  // (clip: the variant for linear heights, whose triangles are clipped at the block, landSheetC; its polygon's arrays
  // in the same program cost every vertex of every other mode too: the GPU sizes a program's registers by its largest
  // path, and the sheets' draw at the Max mesh took twice the base's, 27 to 38 fps orbiting, r3 review speed-1)
  const LAND_SHEET_VS = (clip) => REFINE + `
uniform highp sampler2D uT1; uniform highp sampler2D uRf;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP; uniform int uTileC; uniform int uClip;
uniform int uSheetK; uniform int uRef; uniform ivec2 uL; uniform int uRefE; uniform int uRefT; uniform int uRefOn; uniform float uZBias;
out vec2 vZ; out vec2 vW; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge; flat out vec3 vBoxE; flat out vec2 vZc; flat out int vCombo;
vec3 nrmOf(vec4 t) { return vec3(t.zw, sqrt(max(1.0 - dot(t.zw, t.zw), 0.0))); }
// one vertex: q (grid x, grid y in 16ths of a cell, height), its normal, F (vW), the box rims
void emitV(vec3 q, vec3 nrm, vec2 w, vec3 boxE, int k, ivec2 c, ivec2 s0, int L, int combo) {
  int M = uN - 1;
  vBoxE = boxE;
  vec2 uv = q.xy / float(16 * M);
  vZ = uBox.xy + uv * uBox.zw;
  vec2 sc = vec2(16 >> uL.x, 16 >> uL.y);
  vZc = L == 0 ? uBox.xy + (vec2(c) + 0.5) / float(M) * uBox.zw
               : uBox.xy + (vec2(c * 16) + vec2(s0) * sc + 0.5 * sc) * (uBox.zw / float(16 * M));
  // (F at a refined corner, for the fragments of sub-cells under about a pixel, uVW; a corner the block's clip made
  // has none, and those polygons are drawn with F at their own z)
  vW = w;
  vCombo = combo;
  vPos = vec3((uv - 0.5) * 2.0 * uAspect, q.z);
  vNor = nrm;
  vAO = 1.0;
  vBary = k == 0 ? vec3(1.0, 0.0, 0.0) : (k == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  gl_Position = uMVP * vec4(vPos, 1.0);
  gl_Position.z += uZBias * float(combo) * gl_Position.w;
}
void main() {
  int M = uN - 1, T = 2 * M;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vEdge = vec3(0.0); vBoxE = vec3(0.0);
  int combo, tri;
  ivec2 c, s0 = ivec2(0);
  int L = uRef, blk = 0;
  ivec2 n2 = ivec2(1 << uL.x, 1 << uL.y);
  if (L == 0) {
    int per = 2 * M * M;
    combo = gl_InstanceID / per;
    int r = gl_InstanceID - combo * per, cell = r / 2;
    tri = r % 2;
    c = ivec2(cell % M, cell / M);
    if (uRefOn == 1 && lvAt(c) != ivec2(0)) return;
  } else {
    tri = gl_InstanceID & 1;
    int b = gl_InstanceID >> 1;
    blk = uRefT + b;
    combo = b % uSheetK;
    int r = b / uSheetK, nn = n2.x * n2.y, en = r / nn, sub = r - en * nn;
    s0 = ivec2(sub % n2.x, sub / n2.x);
    c = lstCell(uRefE + en);
  }
  ivec2 A = ivec2(0), B = tri == 0 ? ivec2(1, 0) : ivec2(1, 1), C = tri == 0 ? ivec2(1, 1) : ivec2(0, 1);
  // the corners of this triangle's (sub-)cell on its sheet: (h, valid, nx, ny), and (positions in 16ths of a cell; a
  // refined corner's, and its value, from the right half of its block). (Two branches, not selects between the two
  // textures: the selects fetched from both in every vertex, and the sheets' draw took about twice the base's at the
  // Max mesh, r3 review speed-1)
  vec4 ta, tb, tc, pA, pB, pC;
  if (L == 0) {
    ivec2 o = ivec2(combo % uTileC, combo / uTileC) * T + 2 * c;
    ta = texelFetch(uT1, o + A, 0); tb = texelFetch(uT1, o + B, 0); tc = texelFetch(uT1, o + C, 0);
    pA = vec4(0.0, 0.0, vec2((c + A) * 16)); pB = vec4(0.0, 0.0, vec2((c + B) * 16)); pC = vec4(0.0, 0.0, vec2((c + C) * 16));
  } else {
    ivec2 o = ivec2(4 * (blk & 511), 2 * (blk >> 9));
    ta = texelFetch(uRf, o + A, 0); tb = texelFetch(uRf, o + B, 0); tc = texelFetch(uRf, o + C, 0);
    pA = texelFetch(uRf, o + A + ivec2(2, 0), 0); pB = texelFetch(uRf, o + B + ivec2(2, 0), 0); pC = texelFetch(uRf, o + C + ivec2(2, 0), 0);
  }
  if (!(ta.y > 0.5 && tb.y > 0.5 && tc.y > 0.5)) return;
  int sub = gl_VertexID / 3, k = gl_VertexID - 3 * sub;
  // (a triangle inside the block, every one without linear heights: its own corners, without the clip's polygon,
  // whose arrays the GPU keeps in memory; clipping every triangle took the sheets' draw at the Max mesh to twice the
  // base's, 27 to 38 fps orbiting, r3 review speed-1)
  if (${clip ? 'max(max(abs(ta.x), abs(tb.x)), abs(tc.x)) <= 1.25 * uH' : 'true'}) {
    if (sub > 0) return;
    vec4 tq = k == 0 ? ta : (k == 1 ? tb : tc), pq = k == 0 ? pA : (k == 1 ? pB : pC);
    emitV(vec3(pq.zw, tq.x), nrmOf(tq), pq.xy, vec3(0.0), k, c, s0, L, combo);
    return;
  }
${clip ? `  // the polygon: (grid x, grid y in 16ths of a cell, height), normal, plane flag (0 a corner, +1 / -1 on the top /
  // bottom of the block)
  vec3 Q[5]; vec3 Nn[5]; float Fl[5];
  for (int i = 0; i < 5; i++) { Q[i] = vec3(0.0); Nn[i] = vec3(0.0, 0.0, 1.0); Fl[i] = 0.0; }
  Q[0] = vec3(pA.zw, ta.x); Q[1] = vec3(pB.zw, tb.x); Q[2] = vec3(pC.zw, tc.x);
  vec2 Wv[3]; Wv[0] = pA.xy; Wv[1] = pB.xy; Wv[2] = pC.xy;
  Nn[0] = nrmOf(ta); Nn[1] = nrmOf(tb); Nn[2] = nrmOf(tc);
  int n = 3;
  if (uClip == 1) {
    float Hb = 1.25 * uH;
    for (int pass = 0; pass < 2; pass++) {
      float s = pass == 0 ? 1.0 : -1.0;
      vec3 R[5]; vec3 RN[5]; float RF[5];
      for (int i = 0; i < 5; i++) { R[i] = vec3(0.0); RN[i] = vec3(0.0, 0.0, 1.0); RF[i] = 0.0; }
      int m = 0;
      for (int i = 0; i < 5; i++) {
        if (i >= n) break;
        int j = i + 1 == n ? 0 : i + 1;
        bool inI = s * Q[i].z <= Hb, inJ = s * Q[j].z <= Hb;
        if (inI) { R[m] = Q[i]; RN[m] = Nn[i]; RF[m] = Fl[i]; m++; }
        if (inI != inJ) {
          // (from the lower end in grid order, so the two triangles of an edge find the same point)
          bool fw = Q[i].x < Q[j].x || (Q[i].x == Q[j].x && Q[i].y < Q[j].y);
          vec3 a = fw ? Q[i] : Q[j], b = fw ? Q[j] : Q[i];
          vec3 na = fw ? Nn[i] : Nn[j], nb = fw ? Nn[j] : Nn[i];
          // (a corner far beyond the block, both on its side, as at a pole: the crossing interpolated in 1 / h, exact
          // to first order at a simple pole, where linear interpolation hugs the near corner; review math-4)
          float t = s * a.z > 0.0 && s * b.z > 0.0 && max(abs(a.z), abs(b.z)) > 2.0 * Hb
            ? (1.0 / (s * Hb) - 1.0 / a.z) / (1.0 / b.z - 1.0 / a.z) : (s * Hb - a.z) / (b.z - a.z);
          t = clamp(t, 0.0, 1.0);
          R[m] = vec3(mix(a.xy, b.xy, t), s * Hb); RN[m] = normalize(mix(na, nb, t) + vec3(0.0, 0.0, 1e-6)); RF[m] = s; m++;
        }
      }
      for (int i = 0; i < 5; i++) { Q[i] = R[i]; Nn[i] = RN[i]; Fl[i] = RF[i]; }
      n = m;
    }
  }
  if (sub + 2 >= n) return;
  int i1 = sub + 1, i2 = sub + 2;
  int vi = k == 0 ? 0 : (k == 1 ? i1 : i2);
  // box rims: a polygon edge whose two ends lie on the same plane of the block
  vec3 boxE = vec3(Fl[i1] != 0.0 && Fl[i1] == Fl[i2] ? 1.0 : 0.0,
                   i2 == n - 1 && Fl[i2] != 0.0 && Fl[i2] == Fl[0] ? 1.0 : 0.0,
                   i1 == 1 && Fl[0] != 0.0 && Fl[0] == Fl[i1] ? 1.0 : 0.0);
  emitV(Q[vi], Nn[vi], vi < 3 ? Wv[vi] : vec2(0.0), boxE, k, c, s0, L, combo);
` : ''}}
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
  // sheet: the covering surface (All sheets): F on the triangle's own sheet, with the cuts of its cell (chainSheet).
  // The mesh follows the true surface to a quarter of a pixel where it is refined (REFINE), so F at the fragment's own
  // z is the surface's value at its height there; where it is not (a wall coarser than its pixels while something
  // moves, the refinement capped), the contour lines fade by how far the facet is from the true height
  const LAND_FS = (sheet, plain, lite) => `
in vec2 vZ; in vec2 vW; in vec3 vPos; in vec3 vNor; in float vAO; in vec3 vBary;
flat in vec3 vEdge; flat in vec3 vBoxE;
uniform vec3 uCut; uniform vec4 uBox;${lite ? '' : ' uniform int uVW;'}
out vec4 o;
${plain ? 'vec2 landW(vec2 z) { return vW; }' : sheet ? `flat in vec2 vZc; flat in int vCombo; uniform float uCue; uniform int uCueK;${SHEET_MAP}
vec2 landW(vec2 z) { return mapSheet(vZc, z, vCombo); }
// the per-sheet cue: the albedo's OKLab lightness times 1 + s, its hue and chroma kept
vec3 cueTint(vec3 c, float s) {
  vec3 l = pow(max(mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376,
                        0.0514459929, 0.1073969566, 0.6299787005) * c, vec3(0.0)), vec3(1.0 / 3.0));
  vec3 lab = mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662,
                  -0.0040720468, 0.4505937099, -0.8086757660) * l;
  lab.x = clamp(lab.x * (1.0 + s), 0.0, 1.0);
  l = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * lab;
  return clamp(mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147,
                    0.2309699292, -0.3413193965, 1.7076147010) * (l * l * l), 0.0, 1.0);
}` : 'vec2 landW(vec2 z) { return mapF(z); }'}
// On a steep facet (r3): the height's part of w from the facet's own height, the rest from F. A facet that is not yet
// on the true surface (a wall while something moves, a refinement that has not arrived) puts F's contours at the
// wrong heights: a sawtooth across its strips, and scratches where they fade. The true surface reaches the facet's
// height a small step along the gradient, and there the height's part is the facet's while the other part (Im F for
// Re F, arg F for |F|) is unchanged to first order: on a wall the two are conjugate (Cauchy-Riemann) and the other
// one's gradient is across the step. So the contours are the facet's level lines, straight and continuous from one
// strip to the next, and on a refined surface (a quarter of a pixel from the true one) nothing moves. Slopes under
// 1 (45 degrees) keep F as it is: there the step along the gradient is not small. (Not in the base cells' program, land:
// its fragment stage stays the base's, r3 cold opens: with this in it, a heavy formula's first Landscape held the GPU
// process 0.7 to 0.8 s where the base did not stall; the base cells are the flat ones, a wall is refined)
${lite ? '' : `vec2 facetW(vec2 w) {
  vec3 nf = normalize(vNor);
  float wt = smoothstep(1.0, 2.0, length(nf.xy) / max(abs(nf.z), 1e-4));
  vec2 ht = heightW(w);
  if (!(wt > 0.0) || ht.y < 0.5) return w;
  float h = mix(ht.x, vPos.z, wt) / uH, mu = uMu > 0.0 ? uMu : 1.0, hc = clamp(h, -0.99999, 0.99999);
  if (uHMode >= 2) {
    // (v16.4 merge: the knee modes 6, 7 of All sheets while deforming invert heightW's soft knee; 6 is Re F)
    float a = abs(h), c = 0.5 / PI;
    float x = uHMode >= 6 ? mu * sign(h) * (a <= 1.0 ? a : 1.0 + c * tan(min((a - 1.0) / c, 0.5 * PI - 1e-3))) : uHMode >= 4 ? mu * h : mu * tan(0.5 * PI * hc);
    if (uHMode == 2 || uHMode == 4 || uHMode == 6) w.x = x; else w.y = x;
    return w;
  }
  float r = wabs(w);
  if (!(r > 1e-30 && r < 1e30)) return w;
  float lr = uHMode == 1 ? log(max(mu * tan(0.25 * PI * (hc + 1.0)), 1e-37)) : 1.4 * tan(0.5 * PI * hc);
  return w * exp(clamp(lr, -85.0, 85.0) - log(r));
}`}
void main() {
  // colour from F at the interpolated z: contours stay crisp. (Sub-cells under about a pixel: F at their corners,
  // interpolated, which at that size is the same picture without the chain in every fragment of every tiny triangle)
${lite ? `  vec2 w0 = landW(vZ), w = w0;
  const float la = 1.0;` : `  vec2 w0 = uVW == 1 ? vW : landW(vZ), w = facetW(w0);
  float pw = max(max(length(dFdx(vPos)), length(dFdy(vPos))), 1e-9);
  vec2 ht = heightW(w);
  float la = ht.y > 0.5 ? 1.0 - smoothstep(1.0, 3.0, abs(ht.x - vPos.z) / pw) : 1.0;`}
  float r = wabs(w);
  float q = TAU / max(uSectors, 1.0);
  // (the lines' widths: the smaller of w's and F's as it is. On a silhouette the helper fragments of a quad sit off the
  // triangle, where the facet's height runs past the surface's, and w's alone made dots of the sea-level line there;
  // on a coarse wall F's alone runs across the whole wall within a facet and smeared its lines, r3)
  float lr = log(clamp(r, 1e-37, 3e38)), flr = min(fwidth(lr), fwidth(log(clamp(wabs(w0), 1e-37, 3e38))));
  float xm = lr / q, fm = flr / q;
  float xp = wang(w) / q, fp = min(argWidth(w), argWidth(w0)) / q;
  vec3 fb = fwidth(vBary);
  bool plaster = uMaterial == 2;
  vec3 a = toLin(albedo(w));
  vec3 ml = toLin(uModLine);
  a = mix(a, ml, la * (plaster ? 0.65 : 0.40) * iso(xm, fm, 0.9) * dfade(fm));              // ln|F| = k 2pi/n
  a = mix(a, plaster ? ml : toLin(uArgLine), la * (plaster ? 0.25 : 0.30) * iso(xp, fp, 0.7) * dfade(fp));  // arg F = k 2pi/n
  float ds = abs(lr) / max(flr, 1e-6);                                                  // sea level |F| = 1
  a = mix(a, toLin(vec3(0.0431, 0.0667, 0.0784)), la * uSea * 0.35 * (1.0 - smoothstep(1.0, 2.0, ds)));
  a = mix(a, vec3(1.0), la * uSea * 0.90 * (1.0 - smoothstep(0.375, 1.375, ds)));
${sheet ? `  // the per-sheet cue (notes/landscape-walls/USER-ADDENDUM.md): every sheet, the first one too, lighter or darker
  // in OKLab lightness by uCue (two sheets: the first lighter, the second darker; more: lighter, darker, unchanged in
  // turn, so any two consecutive sheets differ); the hue is arg F and stays. r2 review pictures-1: sheet 0, the one in
  // front where two coincide, had no tint, and the pair could not be told apart
  if (uCue > 0.0) {
    int m3 = vCombo - 3 * (vCombo / 3);
    float sg = uCueK == 2 ? (vCombo == 0 ? 1.0 : -1.0) : (m3 == 0 ? 1.0 : (m3 == 1 ? -1.0 : 0.0));
    a = cueTint(a, sg * uCue);
  }
` : ''}
  vec3 eb = vBary / max(fb, vec3(1e-6));                                                // the banks of a real cut
  float cliff = max(max(vEdge.x * (1.0 - smoothstep(1.5 * uDpr - 0.5, 1.5 * uDpr + 0.5, eb.x)),
                        vEdge.y * (1.0 - smoothstep(1.5 * uDpr - 0.5, 1.5 * uDpr + 0.5, eb.y))),
                        vEdge.z * (1.0 - smoothstep(1.5 * uDpr - 0.5, 1.5 * uDpr + 0.5, eb.z)));
  a = mix(a, toLin(uCut), cliff);
  // the rim of the surface (the domain's edges at their heights): seen from the side it draws the profile
  vec2 uv = (vZ - uBox.xy) / uBox.zw;
  vec2 er = min(uv, 1.0 - uv) / max(fwidth(uv), vec2(1e-9));
  float rim = 1.0 - smoothstep(0.75 * uDpr - 0.5, 0.75 * uDpr + 0.5, min(er.x, er.y));
  // where the block's top or bottom clips the surface: the same rim as the domain's edges
  rim = max(rim, max(max(vBoxE.x * (1.0 - smoothstep(0.75 * uDpr - 0.5, 0.75 * uDpr + 0.5, eb.x)),
                         vBoxE.y * (1.0 - smoothstep(0.75 * uDpr - 0.5, 0.75 * uDpr + 0.5, eb.y))),
                         vBoxE.z * (1.0 - smoothstep(0.75 * uDpr - 0.5, 0.75 * uDpr + 0.5, eb.z))));
  // an open surface, seen from both sides: the underside (the camera below the sheet, by the triangle's winding)
  vec3 n = normalize(vNor);
  vec3 v = normalize(uEye - vPos);
  vec3 c;
  if (gl_FrontFacing) {
    a = mix(a, ml, 0.55 * rim);
    c = shade(a, n, v, vAO);
  } else {
    // its own colouring, darker, under a soft headlight (the key light never reaches the underside): a sheet reads
    // as one surface from both sides, its contours and sea level kept (r2: round 1 desaturated it to a grey)
    a = mix(a, ml, 0.65 * rim);
    c = a * (0.30 + 0.30 * max(dot(-n, v), 0.0));
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
uniform vec2 uExt; uniform vec2 uAspect; uniform vec4 uBox; uniform float uFloorZ; uniform float uH;
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
        // (linear heights run on past the block, where the surface is clipped away: no contact from there, review
        // math-8)
        if (t.y > 0.5 && t.x >= -1.25 * uH) contact = max(contact, exp(-(t.x - uFloorZ) / 0.12));
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
${sheet ? SHEET_MAP : ''}
${MARK_EMIT}
void main() {
  vec2 w = ${sheet ? 'mapSheet(uProbe, uProbe, gl_InstanceID)' : 'mapF(uProbe)'};
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
  const SAMPLER_UNITS = { uLut: 0, uW: 1, uT1: 2, uT2: 3, uNodes: 4, uPts: 4, uE0: 5, uE1: 6, uE2: 7, uLv: 8, uLst: 9, uRf: 10, uLp: 11, uPq: 12, uPv: 13 };
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
    // (the heights, uPass 0, and the refinement, 1 and 2: one program, one call site of the chain, LAND_TF_VS)
    landTF: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_TF_VS, fs: () => TF_FS, tf: true },
    // (the refinement's levels and vertices: no chain, compiled once per page, LAND_LV_VS / LAND_RP_VS / LAND_RA_VS)
    landLv: { chain: false, vs: () => LAND_LV_VS, fs: () => TF_FS, tf: true },
    landRP: { chain: false, vs: () => LAND_RP_VS, fs: () => TF_FS, tf: true },
    landRA: { chain: false, vs: () => LAND_RA_VS, fs: () => TF_FS, tf: true },
    landNrm: { chain: false, vs: () => LAND_NRM_VS, fs: () => TF_FS, tf: true },
    // (the edge pass, one program per kind: S the stages' sheets, H a deformation's, 2 bisection; LAND_EDGE_VS)
    landEdgeS: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_EDGE_VS('S'), fs: () => TF_FS, tf: true },
    landEdgeH: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + LAND_EDGE_VS('H'), fs: () => TF_FS, tf: true },
    landEdge2: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_EDGE_VS('2'), fs: () => TF_FS, tf: true },
    // (the base cells: the base's fragment stage, F at the fragment and no fade, so a formula's first Landscape compiles
    // what it did before the walls; r2 review math-2)
    land: { chain: true, vs: () => LAND_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + LAND_FS(false, false, true) },
    landR: { chain: false, vs: () => LAND_R_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(false, true) },
    landB: { chain: false, vs: () => LAND_B_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(false, true) },
    floor: { chain: true, vs: () => FLOOR_VS, fs: () => UTIL + DCOLOR + LAND_COMMON + TIERS + FLOOR_FS },
    ulevel: { chain: false, vs: () => ULEVEL_VS, fs: () => ULEVEL_FS },
    probe: { chain: true, vs: () => UTIL_V + HEIGHT + PROBE_VS(false), fs: () => MARK_FS },
    // All sheets (only for chains whose source has chainSheetRange: see sheetPlan)
    // (its base pass, as in the base; the refinement's passes, uPass 1 and 2, in landSheetRF: inside landSheetTF they
    // made a formula's first All-sheets surface link 2 to 3 times as long and its first draw held the GPU process for
    // 0.5 to 1 s, r3. landSheetRF compiles once the surface is drawn and is taken into use when it has settled, sheetRF)
    landSheetTF: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + LAND_SHEET_TF_VS(false), fs: () => TF_FS, tf: true },
    landSheetRF: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + LAND_SHEET_TF_VS(true), fs: () => TF_FS, tf: true },
    landSheet: { chain: true, sheet: true, vs: () => LAND_SHEET_VS(false), fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(true) },
    landSheetC: { chain: true, sheet: true, vs: () => LAND_SHEET_VS(true), fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(true) },
    probeSheet: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + PROBE_VS(true), fs: () => MARK_FS },
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
      const ids = new Set(['mapPoint', 'mapF', 'chainStep', 'chainRange', 'chainHom', 'chainHomAll', 'chainStage', 'chainIsDeriv', 'chainSheet', 'chainSheetRange', 'chainSheetHom', 'derivIn', 'uChain', 'uMode', 'uA', 'uB', 'uHi', 'uT', 'uBase', 'uPost', 'postOf', 'uSheetW', 'uDeriv']);
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
    // (the sheet programs also take the deformation's sheets, chainSheetHom: GLChain's sheetHom)
    const lib = (typeof GLChain !== 'undefined' ? GLChain.LIB : '') + '\n' + ch.info.source + (d.sheet ? ch.info.sheetHom || '' : '') + MAP(ch.info);
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
      else if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && groupDone(e) && canFinish(e)) { finishLink(e); finishGroup(e); }
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
  // A surface's chain programs are taken into use together, in one frame: ANGLE completes each one's Metal side at its
  // first draw, and a formula's first Landscape drew its heights' program a frame or more before its surface's, which
  // held the GPU process twice (r2 review math-2: a second stall of 0.85 to 1.1 s under load; the base, one stall).
  // A member finishes only when every member of its group has compiled; the group counts as one for FRESH_MS
  const GROUPS = [['landTF', 'land', 'floor'], ['landSheetTF', 'landSheet', 'floor']];
  // (the floor goes with the surface it is drawn under: All sheets' when their programs were asked for, r3: through the
  // principal group it started the principal programs alongside the sheets', a second family compiling at a cold open)
  const groupOf = (name, key) => (name === 'floor' ? (progs.has('landSheet|' + key) ? GROUPS[1] : GROUPS[0]) : GROUPS.find((g) => g.includes(name)) || null);
  function groupDone(e) {
    const g = groupOf(e.name, e.key);
    if (!g || !pcExt) return true;
    for (const n of g) {
      if (n === e.name) continue;
      const q = progs.get(n + '|' + e.key);
      if (!q) { getProg(n, e.ch, true); return false; }
      if (q.state === 'pending' && !gl.getProgramParameter(q.p, pcExt.COMPLETION_STATUS_KHR)) return false;
    }
    return true;
  }
  function finishGroup(e) {
    const g = groupOf(e.name, e.key);
    if (!g) return;
    for (const n of g) { const q = progs.get(n + '|' + e.key); if (q && q !== e && q.state === 'pending') finishLink(q); }
  }
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
      if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && (e.inv || (groupDone(e) && canFinish(e)))) { (e.inv ? finishInv : finishLink)(e); if (!e.inv) finishGroup(e); if (e.side) sided = true; else main = true; } else if (e.state === 'pending') waiting = true;
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
  const u4i = (P, n, a, b, c, d) => gl.uniform4i(L_(P, n), a, b, c, d);
  const u2i = (P, n, a, b) => gl.uniform2i(L_(P, n), a, b);
  const uM4 = (P, n, m) => gl.uniformMatrix4fv(L_(P, n), false, m);
  function use(P, map) {
    gl.useProgram(P.p);
    P.used1 = true;
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
        lands.clear(); lastLand = landS = null;
        // (the refinement's programs are warmed again one per frame, and its read-back buffer is gone; r2 review math-4)
        rfWarmAll = false; rfWarmT = -1e9; rfWarmTex = null; rdBuf = null; rdBytes = 0;
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
  const lands = new Map();
  let lastLand = null;
  // How the real discontinuities of the principal surface are found (LAND_EDGE_VS uCutMode), from the steps the map
  // applies (GLChain cutKinds; review math-3): 0 none (no cut: the map is continuous away from its poles, no edge
  // pass), 1 by the continuation of the chain's sheets (roots, powers, log, z^n's path), 2 by bisection (cuts the
  // sheets cannot continue: an inverse trig or Joukowski step, arg in a formula, a formula's path through its branch
  // points, a d/dz after a cut, the straight-line map mode 2). A step's path counts only while it runs, 0 < t < 1.
  function cutModeOf(info, map) {
    if (!info || !Array.isArray(info.cutKinds)) return 0;
    const m = map || {}, mode = m.mode || 0, t = +m.t || 0;
    const base = m.base || 0, a = m.a || 0, b = m.b || 0, hi = m.hi || 0, post = m.post || 0;
    // (as the chain applies step k: 0 not, 1 in full, 2 its path at t; cxs0_how, MAP)
    const how = (k) => {
      if (mode === 0) return k > a && k <= b ? 1 : 0;
      if (mode === 2) return k > base && k <= b ? 1 : 0;
      if (mode === 1) { if (k > base && k < hi) return 1; if (k === hi) return 2; }
      else if (mode === 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }
      return post > b && k > b && k <= post ? 1 : 0;
    };
    let sheet = false, other = false, cut = false;
    for (const c of info.cutKinds) {
      const hw = how(c.k);
      if (!hw) continue;
      const kind = hw === 2 ? (t <= 0 ? 'none' : t >= 1 ? c.f : c.h) : c.f;
      if (kind === 'deriv') { if (cut) other = true; continue; }
      if (kind === 'other') other = true;
      else if (kind === 'sheet') sheet = true;
      if (kind !== 'none') cut = true;
    }
    if (!cut) return 0;
    return other || mode === 2 ? 2 : 1;
  }
  const edgeName = (cm, m) => (cm === 2 ? 'landEdge2' : m && (m.mode === 1 || m.mode === 3) ? 'landEdgeH' : 'landEdgeS');
  // A deformation at t = 0 has no cut yet: the edge pass its t > 0 will need starts compiling now, and is first drawn
  // (a pass that writes nothing) at rest once it has settled, before the play that needs it (r3 review speed-3)
  function edgeAhead(P1, em, st, rf, cmNow, P3now) {
    if (P1.ch !== cur) return;
    if (!(em.mode === 1 || em.mode === 3)) {
      // (no deformation shown: the edge passes a deformation of each step would use start compiling in the background,
      // at rest once this surface has been drawn, so that opening the deformation, which plays at once, finds them
      // linked; nothing is drawn with them here. r3 verify-1: compiled only at the open, the pass was never ready in a
      // rest frame and the whole play drew the former rule's torn walls)
      // (after this surface's own passes have been taken into use: the refinement's programs and the edge pass it
      // draws now, so that the cold open's links are not delayed by it)
      if (st.motion || !rf || !rf.Lp || !rf.Lp.drawnOnce || !rfWarmAll || !Array.isArray(P1.ch.info.cutKinds)) return;
      if (cmNow && !(P3now && P3now.used1)) return;
      for (const c of P1.ch.info.cutKinds) {
        if (!c || c.h === 'none' || c.h === 'deriv') continue;
        const hm = { mode: 1, base: 0, hi: c.k, t: 0.5 }, ca = cutModeOf(P1.ch.info, hm);
        // (its settle clock starts when its link lands, not at the open)
        const P = ca ? getProg(edgeName(ca, hm), cur, true) : null;
        if (P && !P.used1) settled(P);
      }
      return;
    }
    const ca = cutModeOf(P1.ch.info, Object.assign({}, em, { t: 0.5 }));
    if (!ca) return;
    const P = getProg(edgeName(ca, em), cur, true);
    if (!P || P.used1 || (st.motion && !st.full) || !settled(P)) return;
    use(P, st.map);
    u1i(P, 'uN', 2); u1i(P, 'uSteps', 0); u1i(P, 'uTwo', 0); u1i(P, 'uDir', 0);
    gl.activeTexture(gl.TEXTURE15);
    if (!rfWarmTex) rfWarmTex = floatTex();
    runTF(P, empty(), gl.POINTS, 1, 0, 16, rfWarmTex, 1, 1, gl.RGBA32F, gl.RGBA);
  }
  function landHeights(st, N, mode, H, mu, aspect, rf) {
    const b = st.box;
    const P1 = program('landTF'), P2 = program('landNrm');
    // (one cache per grid size: the stage cards' small landscapes no longer evict the pane's)
    let land = lands.get(N) || null;
    if (!P1 || !P2) return land;   // compiling: keep the last heights
    const cm = cutModeOf(P1.ch.info, mapFor(st.map, P1.ch));
    // the edge pass must be of the same chain version as the heights. While it compiles (a new chain), the surface is
    // drawn at once by the former rule (a triangle across a height step over 0.3 H left out: cuts -1), and with its
    // real cuts when the pass is ready (review pictures-1: the block stayed empty for seconds)
    const em = mapFor(st.map, P1.ch) || {};
    // (r3: once it has settled; a figure, a film or an export takes it as soon as it has compiled)
    // (never first drawn while something moves: the deformation's edge pass, first drawn 0.9 s into a play, held a
    // frame 90 to 250 ms, r3 review speed-3; at rest then)
    const P3r = cm ? program(edgeName(cm, em)) : null;
    // (a deformation's own pass, once it has settled, is first drawn even while it plays: the play starts at the open,
    // and waiting for a rest frame left the whole play, every loop, to the former rule's torn walls; one first-draw
    // instead, at the play's start when the pass was compiled ahead (edgeAhead), r3 verify-1)
    const defo = em.mode === 1 || em.mode === 3;
    const P3 = P3r && (rf && rf.full || (settled(P3r) && (P3r.used1 || defo || !(st.motion && !st.full)))) ? P3r : null;
    if (P3r && !P3 && st.motion) rfLater();
    if (!cm || !defo) edgeAhead(P1, em, st, rf, cm, P3r);
    const cuts = cm && (!P3 || P3.ch !== P1.ch) ? -1 : cm;
    const key = [P1.ch.key, P1.ch.hash, mapKeyOf(mapFor(st.map, P1.ch)), b.x0, b.x1, b.y0, b.y1, N, mode, H, mu, cuts].join('|');
    if (land && land.key === key) { lastLand = land; landRefine(st, land, P1, N, mode, H, mu, aspect, rf); return land; }
    if (!land) {
      // (the pane's grid and the stage cards' (64) are kept, one each: a former pane size is freed, review math-5)
      for (const [k, l] of lands) {
        if ((k === 64) !== (N === 64)) continue;
        rfFree(l);
        for (const t of [l.tex1, l.tex2, ...l.edges]) gl.deleteTexture(t);
        lands.delete(k);
        if (lastLand === l) lastLand = null;
      }
      land = { N, tex1: floatTex(), tex2: floatTex(), edges: [floatTex(), floatTex(), floatTex()] };
      lands.set(N, land);
    }
    lastLand = land;
    const bytes = N * N * 16;
    use(P1, st.map);
    u1i(P1, 'uN', N);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu); u1i(P1, 'uPass', 0);
    runTF(P1, empty(), gl.POINTS, N * N, 0, bytes, land.tex1, N, N, gl.RGBA32F, gl.RGBA);
    // the real jumps across the grid's edges (+x, +y, the diagonal)
    if (cuts > 0) {
      const m = mapFor(st.map, P3.ch) || {};
      use(P3, st.map);
      u1i(P3, 'uN', N);
      u4f(P3, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      u1i(P3, 'uHMode', mode); u1f(P3, 'uH', H); u1f(P3, 'uMu', mu);
      // (bisection steps: the cut to 2^-14 of an edge in mode 1, the step's shrinking over 12 halvings in mode 2)
      u1i(P3, 'uSteps', 13); u1i(P3, 'uTwo', 2);
      u1i(P3, 'uSheetA', m.a || 0); u1i(P3, 'uSheetB', m.b || 0); u1i(P3, 'uSheetW', 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
      for (let d = 0; d < 3; d++) {
        u1i(P3, 'uDir', d);
        // (runTF binds its target on the active unit: a spare one, so unit 2 keeps the heights)
        gl.activeTexture(gl.TEXTURE15);
        runTF(P3, empty(), gl.POINTS, N * N, 0, bytes, land.edges[d], N, N, gl.RGBA32F, gl.RGBA);
      }
    }
    land.cuts = cuts; land.P3 = P3;
    use(P2);
    u1i(P2, 'uN', N);
    u2f(P2, 'uAspect', aspect[0], aspect[1]);
    u1f(P2, 'uH', H);
    u1i(P2, 'uCuts', cuts);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
    for (let d = 0; d < 2; d++) { gl.activeTexture(gl.TEXTURE5 + d); gl.bindTexture(gl.TEXTURE_2D, land.edges[d]); }
    gl.activeTexture(gl.TEXTURE15);
    runTF(P2, empty(), gl.POINTS, N * N, 0, bytes, land.tex2, N, N, gl.RGBA32F, gl.RGBA);
    land.key = key;
    land.rkey = null;
    landRefine(st, land, P1, N, mode, H, mu, aspect, rf);
    return land;
  }
  // ---- adaptive refinement (REFINE; notes/landscape-walls/r2/AS-BUILT.md) ----
  // The levels come from the GPU (a pass of the height program); they are read back (a quarter of a float per cell)
  // and listed here, grouped by level, worst first within the budget; the refined vertices are a third pass of the
  // same program, and each level's sub-cells one instanced draw. The budget (evaluations of the chain) is the design's
  // capacity: while something moves the levels are capped (the walls stay closed, a little coarser) and the full
  // refinement follows when it stops (rfLater). A figure, a film or an export is always refined in full.
  const RF_W = 2048;                       // the refined textures' width in texels
  // evaluations of the chain at rest / while moving (the base passes are ~0.4 M, or 2.6 M for two sheets); at rest the
  // refined textures stay under ~40 MB
  const RF_REST = 6e6, RF_MOVE = 1.2e6;
  // All sheets at rest: built over several frames (sheetRefine), at most RF_FRAME evaluations each, RF_REST_S in all
  // (the user's case, sin sqrt z with All sheets at t = 0.2, needs about 13 M at the default mesh and 17 M at Max; its
  // refined texture is then ~70 to 90 MB, 128 bytes per sub-cell and sheet)
  const RF_REST_S = 18e6, RF_FRAME = 3e6;
  // the moving budget for a pane mesh of N vertices per side: RF_MOVE up to 256 cells, then falling with the cells'
  // count, since the base passes take the frame's GPU time as the mesh grows (at Max they take nearly all of it: the
  // refinement then made the GPU fall behind, and each read of the levels waited for it; r2 review math-3)
  const rfMove = (N) => RF_MOVE * Math.min(1, (256 / Math.max(N - 1, 1)) * (256 / Math.max(N - 1, 1)));
  let rfTimer = 0;
  // a mesh entry's refinement objects (textures, read-back buffer and fence), freed with it (r2 review math-4: a dropped
  // mesh left them to the garbage collector, ~100 MB at Max)
  function rfFree(o) {
    if (!o) return;
    for (const k of ['lvTex', 'lstTex', 'rfTex', 'latTex', 'ptsTex', 'evTex', 'lvTmp']) if (o[k]) { gl.deleteTexture(o[k]); o[k] = null; }
    if (o.nb) { rfFree(o.nb); o.nb = null; }
    if (o.rbBuf) { gl.deleteBuffer(o.rbBuf); o.rbBuf = null; }
    if (o.rbFence) { gl.deleteSync(o.rbFence); o.rbFence = null; }
    o.rf = null; o.lvKey = o.rkey = o.rbFor = null; o.lvRaw = null; o.rfRows = 0; o.rfRaw = o.rbData = null; o.lvDim = o.lstRows = 0;
  }
  function rfLater() {
    if (rfTimer || typeof setTimeout !== 'function') return;
    rfTimer = setTimeout(() => { rfTimer = 0; if (api.onReady) api.onReady({ main: true }); }, 180);
  }
  // The levels are read back synchronously only while something moves and every program of the frame has run before
  // (each read then waits for its own passes only). Otherwise, as at a new chain's first Landscape, whose Metal
  // pipelines compile in the GPU process, a synchronous read would hold the page until they have: the levels are
  // copied aside with a fence, the surface is drawn unrefined, and the refinement follows a frame or two later (rfPoll)
  let pollTimer = 0;
  function rfPoll() {
    if (pollTimer || typeof setTimeout !== 'function') return;
    pollTimer = setTimeout(() => { pollTimer = 0; if (api.onReady) api.onReady({ main: true }); }, 24);
  }
  // The refinement's programs have no chain: they compile once per page. Each one's first draw completes its Metal side
  // in the GPU process, which holds every frame meanwhile (spec 8.7: several in one frame held it for 100-250 ms, and a
  // formula's first Landscape, with its surface's own programs, is where they first came): they are taken into use one
  // per frame at least 48 ms apart, each by a draw that writes nothing, and not in the frame that first draws the
  // surface's own program. Until then the surface is drawn unrefined
  // (they link in the background, started together once the surface has been drawn: a static program's first use
  // otherwise linked it on the main thread, 30 to 280 ms for landLv at a cold open, r3 review speed-2)
  const RF_PROGS = ['landLv', 'landRP', 'landRA', 'landR', 'landB'];
  let rfWarmT = -1e9, rfWarmAll = false;
  function rfWarmed(Lp) {
    if (rfWarmAll) return true;
    if (!Lp || !Lp.drawnOnce) { rfPoll(); return false; }
    prestart(RF_PROGS);
    for (const name of RF_PROGS) {
      const e = progs.get(name + '|static');
      if (e && e.state === 'pending' && pcExt && !gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR)) { rfPoll(); return false; }
      const P = program(name);
      if (!P) { rfPoll(); return false; }   // (still linking, in the background)
      if (P.warm) continue;
      if (performance.now() - rfWarmT < 48) { rfPoll(); return false; }
      use(P);
      if (name === 'landR' || name === 'landB') {
        // (a triangle with all its corners at the origin of clip space: no fragment)
        uM4(P, 'uMVP', new Float32Array(16));
        gl.bindVertexArray(empty());
        if (name === 'landB') gl.drawArrays(gl.TRIANGLES, 0, 3); else gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1);
        gl.bindVertexArray(null);
      } else {
        u1i(P, 'uM', 1); u1i(P, 'uTot', 0); u1i(P, 'uCuts', -1);
        gl.activeTexture(gl.TEXTURE15);
        if (!rfWarmTex) rfWarmTex = floatTex();
        runTF(P, empty(), gl.POINTS, 1, 0, 16, rfWarmTex, 1, 1, gl.RGBA32F, gl.RGBA);
      }
      P.warm = true; rfWarmT = performance.now();
      rfPoll();
      return false;
    }
    rfWarmAll = true;
    return true;
  }
  let rfWarmTex = null;
  // o: the mesh entry; n floats of the scratch buffer; progs: the programs this frame's passes used; returns the levels
  // or null (pending)
  // The read-back buffer of o for one read, bytes long: a fresh one each time, as in r2 (r3: a kept one, written again
  // after its read, made Chrome warn that its shadow copy was discarded on every read, and the reads took 30 to 50 ms
  // at the Max mesh instead of under 1)
  function rbOf(o, bytes) {
    if (o.rbBuf) gl.deleteBuffer(o.rbBuf);
    o.rbBuf = gl.createBuffer(); o.rbBytes = bytes;
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, o.rbBuf);
    gl.bufferData(gl.COPY_WRITE_BUFFER, bytes, gl.STREAM_READ);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    return o.rbBuf;
  }
  function lvFetch(o, rkey, n, sync, progs) {
    if (sync) return readScratch(n);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, rbOf(o, 4 * n));
    gl.bindBuffer(gl.COPY_READ_BUFFER, scratch);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 4 * n);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    if (o.rbFence) gl.deleteSync(o.rbFence);
    o.rbFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    o.rbFor = rkey; o.rbN = n; o.rbProgs = progs; o.rbT = performance.now();
    rfPoll();
    return null;
  }
  // Reads the fenced levels of o when the GPU has them (-> true): into o.rbData, for o.rbDataFor
  // (force: a figure, a film or an export; getBufferSubData then waits for the GPU)
  function lvTake(o, force) {
    if (!o || !o.rbFence) return false;
    const st = force ? gl.ALREADY_SIGNALED : gl.clientWaitSync(o.rbFence, 0, 0);
    if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return false;
    // (read before the fence is deleted: the read is then known complete)
    const out = new Float32Array(o.rbN);
    const tq = performance.now();
    gl.bindBuffer(gl.COPY_READ_BUFFER, o.rbBuf);
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.deleteSync(o.rbFence); o.rbFence = null;
    for (const P of o.rbProgs || []) if (P) P.rfWarm = true;
    o.rbData = out; o.rbDataFor = o.rbFor;
    return true;
  }
  // The levels in flight are read when the GPU has done the last Landscape frame's work (lvTail, a fence at its end),
  // at the start of a frame or between frames (lvIdle, polled): getBufferSubData waits for the GPU process to work
  // through what is queued before it, and read in the middle of a frame, or before the GPU had finished the one
  // before, a read at the Max mesh while playing took 1.6 ms in the median and 9 to 30 ms one time in ten (r3, the
  // frames that ran over the vsync)
  let lvTail = null, lvIdleT = 0, lvIdleN = 0;
  // (a read waits for the GPU's idle moment at most LV_LATE ms after its pass: under load that moment can be missed
  // frame after frame, and the levels then stood still while the walls moved)
  const LV_LATE = 60;
  function lvCollect() {
    // (no read in flight: the tail fence goes, r3 review speed-4)
    if (lvTail && !lvInFlight()) { gl.deleteSync(lvTail); lvTail = null; }
    if (lvTail) {
      const st = gl.clientWaitSync(lvTail, 0, 0);
      if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) {
        const now = performance.now();
        for (const o of [...lands.values(), landS]) if (o && o.rbFence && now - (o.rbT || 0) > LV_LATE) lvTake(o);
        lvIdleArm();
        return;
      }
      gl.deleteSync(lvTail); lvTail = null;
    }
    for (const o of lands.values()) lvTake(o);
    lvTake(landS);
  }
  const lvInFlight = () => { for (const o of lands.values()) if (o.rbFence) return true; return !!(landS && landS.rbFence); };
  function lvIdleArm() {
    if (lvIdleT || typeof setTimeout !== 'function') return;
    lvIdleT = setTimeout(() => { lvIdleT = 0; if (!gl || lost || !lvInFlight()) return; lvCollect(); if (lvInFlight() && ++lvIdleN < 64) lvIdleArm(); else lvIdleN = 0; }, 3);
  }
  // (at the end of a Landscape frame that has levels in flight: the GPU is done with it when this fence signals)
  function lvTailMark() {
    if (!lvInFlight()) return;
    if (lvTail) gl.deleteSync(lvTail);
    lvTail = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    lvIdleN = 0; lvIdleArm();
  }
  // the fenced levels for rkey (any key: null), once read (null while pending)
  function lvReady(o, rkey) {
    if (!o.rbData || (rkey !== null && o.rbDataFor !== rkey)) { if (o.rbFence) rfPoll(); return null; }
    const out = o.rbData;
    o.rbGot = o.rbDataFor; o.rbData = null;
    return out;
  }
  // (through a buffer of its own, fenced and waited for: the scratch buffer, which every pass writes, is never read)
  let rdBuf = null, rdBytes = 0;
  function readScratch(n) {
    const out = new Float32Array(n);
    // (a fresh buffer each time, as in lvFetch: a READ buffer written again before Chrome saw its read loses its shadow)
    if (rdBuf) gl.deleteBuffer(rdBuf);
    rdBuf = gl.createBuffer(); rdBytes = 4 * n;
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, rdBuf); gl.bufferData(gl.COPY_WRITE_BUFFER, 4 * n, gl.STREAM_READ);
    gl.bindBuffer(gl.COPY_READ_BUFFER, scratch);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 4 * n);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    gl.clientWaitSync(f, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    gl.deleteSync(f);
    gl.bindBuffer(gl.COPY_READ_BUFFER, rdBuf);
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out, 0, n);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    return out;
  }
  // a transform-feedback pass of count points into rows y0.. of tex (W wide, already allocated)
  function runTFRows(P, count, tex, W, y0) {
    const rows = Math.ceil(count / W), bytes = rows * W * 16;
    if (!tfObj) tfObj = gl.createTransformFeedback();
    if (!scratch || scratchBytes < bytes) {
      if (scratch) gl.deleteBuffer(scratch);
      scratch = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, scratch);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_COPY);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      scratchBytes = bytes;
    }
    gl.bindVertexArray(empty());
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfObj);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, scratch);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, rows * W);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, scratch);
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, W, rows, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
  }
  // The refined cells, grouped by their levels (Lx, Ly): lvRaw the levels read back (Lx + 8 Ly, 4 cells per texel,
  // Mq x M); cost(Lx, Ly) the evaluations of one such cell, rowsOf(Lx, Ly, n) the rows n such cells take; cap the
  // budget: the levels drop by D (both directions) until the cost fits, and at rest (fill) the rest of the budget raises
  // whole groups back. rfPlan lists them (no GL: it also runs between frames, as soon as the levels are read, lvTake);
  // rfApply uploads the levels and the list (entries grouped, groups in order) and returns the groups {L: [Lx, Ly], n,
  // E (first entry), y0 (first row)}
  let nzK = new Int32Array(0), nzV = new Uint8Array(0), cutC = new Uint8Array(0);
  // dil (the principal surface while something moves, a number of cells): the unrefined cells within dil cells of a
  // refined one, across its wall (not a cell left to the cut rule), are refined to level 1 across the wall. The levels
  // come a frame or two late and from the cheaper estimate, and a wall that had moved into a cell they still call
  // flat was drawn with the base cells' chords and F at the fragment (no facetW there, see LAND_FS): the sawtooth of
  // r2 review verify-1. Level 1 costs 30 evaluations a cell
  function rfPlan(lvRaw, M, cost, rowsOf, cap, fill, dil) {
    const Mq = (M + 3) >> 2, len = lvRaw.length;
    // (one pass over the cells, the non-zero ones kept: r3, a Map per cell took 1.3 ms a build at the Max mesh, and
    // two passes over the 262 144 cells 1.5)
    if (nzK.length < len) { nzK = new Int32Array(len); nzV = new Uint8Array(len); }
    if (dil && cutC.length < len) cutC = new Uint8Array(len);
    if (dil) cutC.fill(0, 0, len);
    const u = new Uint32Array(lvRaw.buffer, lvRaw.byteOffset, len);
    const cnt = new Float64Array(64);
    let nn = 0;
    for (let k = 0; k < len; k++) if (u[k]) { const v = lvRaw[k] | 0; if (v > 0 && v < 64) { cnt[v]++; nzK[nn] = k; nzV[nn++] = v; } else if (dil && v === 64) cutC[k] = 1; }
    const codes = [];
    for (let v = 1; v < 64; v++) if (cnt[v]) codes.push(v);
    // (over the budget, every cell drops by the same d levels in both directions, so the chord error grows by the
    // same factor 4^d everywhere: a top cap left the steepest cells 16 times over and the rest exact; r2 review math-1)
    const capOf = (v, d) => Math.max((v & 7) - d, 0) + 8 * Math.max((v >> 3) - d, 0);
    const costOf = (w) => (w ? cost(w & 7, w >> 3) : 0);
    const total = (d) => { let c = 0; for (const v of codes) c += cnt[v] * costOf(capOf(v, d)); return c; };
    let D = 0;
    while (D < 4 && total(D) > cap) D++;
    const Lc = 4 - D;
    // (then what the drop left of the budget goes back to whole groups of equal wanted levels, a level at a time, the
    // steepest first: one drop is 4 times the cost, so it left up to three quarters of the budget unspent, and a finer
    // mesh, which wants a level less everywhere, could end with fewer evaluations than the default; r2 verify-4. At
    // rest only (fill): the moving budget keeps the uniform drop it was measured with)
    const fin = new Int32Array(64);
    for (const v of codes) fin[v] = capOf(v, D);
    let spent = total(D);
    const steep = codes.slice().sort((a, b) => Math.max(b & 7, b >> 3) - Math.max(a & 7, a >> 3) || ((b & 7) + (b >> 3)) - ((a & 7) + (a >> 3)) || a - b);
    for (let d = D - 1; fill && d >= 0; d--) {
      for (const v of steep) {
        const w0 = fin[v], w1 = capOf(v, d);
        if (w0 !== capOf(v, d + 1) || w1 === w0) continue;
        const up = cnt[v] * (costOf(w1) - costOf(w0));
        if (spent + up <= cap) { fin[v] = w1; spent += up; }
      }
    }
    const capped = codes.some((v) => fin[v] !== v);
    // (the levels uploaded: the cut rule's cells, 64 in the read-back, are 0 there)
    const lv = new Float32Array(len);
    for (let q = 0; q < nn; q++) lv[nzK[q]] = fin[nzV[q]];
    const gcnt = new Float64Array(64);
    for (const v of codes) if (fin[v]) gcnt[fin[v]] += cnt[v];
    let nx = 0;
    const ext = dil ? [] : null;
    if (dil) {
      // (dil cells out, across the wall: an x wall (Lx > 0) moves along x, a y wall along y)
      const S4 = 4 * Mq, vis = new Uint8Array(len);
      let front = [];
      // (from the walls, cells at level 2 or more: a level 1 cell's chord error unrefined is under a pixel)
      for (let q = 0; q < nn; q++) { const w = fin[nzV[q]]; if (Math.max(w & 7, w >> 3) >= 2) { front.push(nzK[q], ((w & 7) ? 1 : 0) + 8 * ((w >> 3) ? 1 : 0)); vis[nzK[q]] = 1; } }
      for (let step = 0; step < dil && front.length; step++) {
        const next = [];
        for (let f = 0; f < front.length; f += 2) {
          const k = front[f], add = front[f + 1], j = (k / S4) | 0, i = k - S4 * j;
          for (let d = 0; d < 4; d++) {
            if (d < 2 ? !(add & 7) : !(add >> 3)) continue;
            const ii = i + (d === 0 ? 1 : d === 1 ? -1 : 0), jj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (ii < 0 || jj < 0 || ii >= M || jj >= M) continue;
            const kk = S4 * jj + ii;
            // (through the refined cells around the wall too: the fill-in counts from the wall itself)
            if (vis[kk] || cutC[kk]) continue;
            vis[kk] = 1;
            next.push(kk, add);
            if (lv[kk]) continue;
            lv[kk] = add; gcnt[add]++; ext.push(kk); nx++;
            spent += costOf(add);
          }
        }
        front = next;
      }
    }
    const groups = [];
    for (let v = 1; v < 64; v++) if (gcnt[v]) groups.push({ v, L: [v & 7, v >> 3], n: gcnt[v] });
    let e = 0, y = 0;
    const at = new Int32Array(64);
    for (const g of groups) { g.E = e; g.y0 = y; at[g.v] = e; e += g.n; y += rowsOf(g.L[0], g.L[1], g.n); }
    const rows = Math.max(1, Math.ceil(e / 1024));
    const list = new Float32Array(rows * 1024);
    // (the cells in row-major order, as before: k = 4 j Mq + i; then the ones filled in, dil)
    for (let q = 0; q < nn; q++) {
      const w = fin[nzV[q]];
      if (!w) continue;
      const k = nzK[q], j = (k / (4 * Mq)) | 0, i = k - 4 * Mq * j;
      list[at[w]++] = j * M + i;
    }
    if (ext) for (const k of ext) { const w = lv[k], j = (k / (4 * Mq)) | 0, i = k - 4 * Mq * j; list[at[w]++] = j * M + i; }
    return { M, Mq, lv, list, lrows: rows, groups, entries: e, rows: y, capped, Lc, drop: D, evals: spent, need: total(0), filled: nx, want: codes.map((v) => (v & 7) + '' + (v >> 3) + ':' + cnt[v]).join(' ') };
  }
  function rfApply(o, p) {
    const { M, Mq, lv, list, lrows: rows, rows: y } = p;
    // (never upload levels of another grid's size: drawn unrefined instead, r3 verify-2)
    if (lv.length !== Mq * M * 4 || list.length < 1024 * rows) return { groups: [], entries: 0, rows: 0, capped: true, Lc: 0, drop: 0, evals: 0, need: 0, want: '', filled: 0 };
    if (!o.lvTex) { gl.activeTexture(gl.TEXTURE15); o.lvTex = floatTex(); o.lstTex = floatTex(); o.rfTex = floatTex(); }
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, o.lvTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    // (the same sizes as the last build: written in place, r3)
    if (o.lvDim === M) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Mq, M, gl.RGBA, gl.FLOAT, lv);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Mq, M, 0, gl.RGBA, gl.FLOAT, lv); o.lvDim = M; }
    gl.bindTexture(gl.TEXTURE_2D, o.lstTex);
    if (o.lstRows === rows) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, rows, gl.RED, gl.FLOAT, list);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1024, rows, 0, gl.RED, gl.FLOAT, list); o.lstRows = rows; }
    // (the refined texture: one allocation for all the groups' rows)
    if (y > 0) {
      gl.bindTexture(gl.TEXTURE_2D, o.rfTex);
      if (o.rfRows !== y) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, RF_W, y, 0, gl.RGBA, gl.FLOAT, null); o.rfRows = y; }
    }
    const { groups, entries, capped, Lc, drop, evals, need, want, filled } = p;
    return { groups, entries, rows: y, capped, Lc, drop, evals, need, want, filled };
  }
  function rfBuild(o, lvRaw, M, cost, rowsOf, cap, fill, dil) {
    return rfApply(o, rfPlan(lvRaw, M, cost, rowsOf, cap, fill, dil));
  }
  // the principal surface's refinement for the heights in land (rf: {pxW, motion, full, minPx}): the lattice's heights
  // (the chain pass on the grid of quarter cells), the levels (landLv), read back and listed (rfBuild); per group, the
  // points to evaluate (landRP), the chain pass on them, the vertex records (landRA)
  function landRefine(st, land, P0, N, mode, H, mu, aspect, rf) {
    const M = N - 1, Mq = (M + 3) >> 2, b = st.box;
    if (!rf || !(land.cuts >= 0)) { land.rf = null; return; }
    // (programs without the chain: they compile once per page, in the background; drawn unrefined until they land)
    if (!rfWarmed(rf.Lp)) { if (land.rfFor !== land.key) land.rf = null; return; }
    const PL = program('landLv'), PP = program('landRP'), PA = program('landRA'), P1 = P0;
    if (!PL || !PP || !PA) { land.rf = null; return; }
    const rkey = land.key + '|' + rf.pxW.toPrecision(3) + '|' + rf.minPx;
    const move = rf.motion && !rf.full;
    // (moving: the levels from the half cells, capped to the budget; at rest the quarter cells' lattice, in full: a
    // mesh built while moving is rebuilt when it stops, rfLater)
    // (uLat: 1 at rest, the quarter cells; moving, 0 the half cells, 2 over 256 cells the base heights only, math-3)
    const lat = !move, lmode = lat ? 1 : (M > 256 ? 2 : 0), lk = rkey + ['|c', '|L', '|b'][lmode];
    if (land.rkey === rkey && land.rf && (move || !land.rf.partial)) return;
    // (moving with the heights unchanged, as in an orbit or a zoom: the mesh built at rest stays, math-5)
    if (move && land.rf && !land.rf.partial && land.rfFor === land.key) return;
    // (moving with new heights over 256 cells, as the sheets: the base mesh, its steep triangles with facetW (landB),
    // refined when it stops. The levels' read-back waited 40 to 100 ms for the GPU process in every moving frame that
    // took one, 4 to 8 a second at the Max mesh (r3 review speed-3: hitches of 92 to 252 ms), and the levels came too
    // late for walls that moved 15 to 20 cells between two reads (pictures-1))
    if (move && M > 256) { if (land.rfFor !== land.key) land.rf = null; rfLater(); return; }
    const common = (P) => {
      u1i(P, 'uM', M); u4f(P, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); u2f(P, 'uAspect', aspect[0], aspect[1]);
      u1f(P, 'uPxW', rf.pxW); u1f(P, 'uCellW', 2 * Math.max(aspect[0], aspect[1]) / M); u1f(P, 'uMinPx', rf.minPx);
      u1i(P, 'uLat', lmode); u1i(P, 'uCuts', land.cuts);
    };
    const chain = (pass, n) => {
      use(P1, st.map);
      u1i(P1, 'uN', n); u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu); u1i(P1, 'uPass', pass);
    };
    gl.activeTexture(gl.TEXTURE15);
    for (const k of ['lvTex', 'lstTex', 'rfTex', 'latTex', 'ptsTex', 'evTex']) if (!land[k]) land[k] = floatTex();
    for (let d = 0; d < 3; d++) { gl.activeTexture(gl.TEXTURE5 + d); gl.bindTexture(gl.TEXTURE_2D, land.edges[d]); }
    if (land.lvKey !== lk) {
      // the fenced levels of this key, or while something moves of any earlier one (a frame or two late: never read
      // synchronously while moving, which held the CPU until the GPU had drained, r2 review math-3; a cell that now
      // holds a jump counts as level 0, REFINE)
      const got = lvReady(land, move ? null : lk);
      // (a read of another grid's levels is dropped: r3 verify-2)
      if (got && got.length === Mq * M * 4) { land.lvRaw = got; land.lvKey = land.rbGot; land.lvM = M; }
      // (a new pass once the one in flight has been read, lvCollect; meanwhile the list stands and its vertices follow
      // the heights)
      if (land.lvKey !== lk && !land.rbFence) {
        // The levels' pass: the lattice (the chain on the grid of quarter cells, of half cells while moving) in strips
        // of whole cells, each under ~8 MB, then the levels of the strip's cells, copied into the read-back buffer
        // (the whole lattice was 67 MB at Max, and the shared scratch buffer grew to match; r2 review math-4)
        const s = lat ? 4 : 2, sN = s * M + 1;
        const cs = Math.max(1, Math.min(M, Math.floor((8 * 1024 * 1024 / (16 * sN) - 1) / s)));
        rbOf(land, Mq * M * 16);
        if (!land.lvTmp) { gl.activeTexture(gl.TEXTURE15); land.lvTmp = floatTex(); }
        for (let j0 = 0; j0 < M; j0 += lmode === 2 ? M : cs) {
          if (lmode === 2) {
            use(PL); common(PL); u1i(PL, 'uJ0', 0);
            gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
            gl.activeTexture(gl.TEXTURE15);
            runTF(PL, empty(), gl.POINTS, Mq * M, 0, Mq * M * 16, land.lvTmp, Mq, M, gl.RGBA32F, gl.RGBA);
            gl.bindBuffer(gl.COPY_READ_BUFFER, scratch); gl.bindBuffer(gl.COPY_WRITE_BUFFER, land.rbBuf);
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, M * Mq * 16);
            gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
            continue;
          }
          const nr = Math.min(cs, M - j0), R = s * nr + 1;
          chain(0, sN);
          u4f(P1, 'uBox', b.x0, b.y0 + (b.y1 - b.y0) * j0 / M, b.x1 - b.x0, b.y1 - b.y0);
          gl.activeTexture(gl.TEXTURE15);
          runTF(P1, empty(), gl.POINTS, R * sN, 0, R * sN * 16, land.latTex, sN, R, gl.RGBA32F, gl.RGBA);
          use(PL); common(PL); u1i(PL, 'uJ0', j0);
          gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, land.latTex);
          gl.activeTexture(gl.TEXTURE15);
          runTF(PL, empty(), gl.POINTS, Mq * nr, 0, Mq * nr * 16, land.lvTmp, Mq, nr, gl.RGBA32F, gl.RGBA);
          gl.bindBuffer(gl.COPY_READ_BUFFER, scratch); gl.bindBuffer(gl.COPY_WRITE_BUFFER, land.rbBuf);
          gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, j0 * Mq * 16, nr * Mq * 16);
          gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
        }
        // (a figure, a film or an export: waited for; else fenced, picked up a frame or two later, rfPoll)
        if (land.rbFence) gl.deleteSync(land.rbFence);
        land.rbFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        land.rbFor = lk; land.rbN = Mq * M * 4; land.rbProgs = null; land.rbT = performance.now();
        if (rf.full) {
          lvTake(land, true);
          const lv = lvReady(land, lk);
          if (lv) { land.lvRaw = lv; land.lvKey = lk; land.lvM = M; }
        } else rfPoll();
      }
      if (land.lvKey !== lk && !(move && land.lvRaw && land.lvM === M)) { if (land.rfFor !== land.key) land.rf = null; return; }
    }
    // (a vertex record is two texels; its normal takes 4 evaluations besides its own)
    const nv = (lx, ly) => ((1 << lx) + 1) * ((1 << ly) + 1);
    // (moving, with the levels it was built from: the list stands, only its vertices are evaluated again for these
    // heights; the levels are read and listed again when the next ones land, a frame or two later)
    const cap = move ? rfMove(N) : RF_REST;
    const r = move && land.rf && land.rfRaw === land.lvRaw && land.rfCap === cap ? land.rf
      : rfBuild(land, land.lvRaw, M, (lx, ly) => 5 * nv(lx, ly), (lx, ly, n) => Math.ceil(2 * n * nv(lx, ly) / RF_W), cap, !move,
        // (moving: about 8 px either side of a wall, 2 to 4 cells, a wall playing at 1x moved that far between reads;
        // none over 256 cells: at Fine and Max even one cell held the frame's p95 1 to 3 ms over the base's, r3)
        !move || M > 256 ? 0 : Math.max(2, Math.min(4, Math.ceil(8 / Math.max(rf.pxW * 2 * Math.max(aspect[0], aspect[1]) / M, 0.5)))));
    land.rfRaw = land.lvRaw; land.rfCap = cap;
    for (const g of r.groups) {
      const nvg = g.n * nv(g.L[0], g.L[1]), rowsP = Math.ceil(5 * nvg / RF_W);
      const grp = (P) => { common(P); u2i(P, 'uL', g.L[0], g.L[1]); u1i(P, 'uGE', g.E); u1i(P, 'uTot', nvg); };
      gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, land.lvTex);
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, land.lstTex);
      use(PP); grp(PP);
      gl.activeTexture(gl.TEXTURE15);
      runTF(PP, empty(), gl.POINTS, rowsP * RF_W, 0, rowsP * RF_W * 16, land.ptsTex, RF_W, rowsP, gl.RGBA32F, gl.RGBA);
      chain(1, N);
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, land.ptsTex);
      gl.activeTexture(gl.TEXTURE15);
      runTF(P1, empty(), gl.POINTS, rowsP * RF_W, 0, rowsP * RF_W * 16, land.evTex, RF_W, rowsP, gl.RGBA32F, gl.RGBA);
      use(PA); grp(PA);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, land.tex2);
      gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, land.evTex);
      runTFRows(PA, 2 * nvg, land.rfTex, RF_W, g.y0);
    }
    // (built while moving, capped or from the cheaper levels: rebuilt in full when it stops)
    r.partial = move && (r.capped || !lat);
    land.rf = r; land.rkey = rkey; land.rfFor = land.key;
    if (r.partial) rfLater();
    // (at rest, built: the passes' scratch textures go, the lattice's, the points' and their values, up to ~30 MB at
    // the Max mesh after a play; they are made again when something moves, r3 review speed-4)
    if (!move && !rf.full) freeScratch(land);
  }
  function freeScratch(o) {
    for (const k of ['latTex', 'ptsTex', 'evTex', 'lvTmp']) if (o[k]) { gl.deleteTexture(o[k]); o[k] = null; }
  }
  // ---- All sheets ----
  const SHEET_MAX = 24;
  // The sheet combinations of the current chain for map (mode 0: the steps in (a, b] from the w_a-plane) and window W
  // (sheets on each side of the principal one for log and irrational powers): {K (surfaces drawn, at most 24), total,
  // a, b, W, infinite (a log or irrational power among the steps), steps}; null when the map has no multivalued step
  // in (a, b], cannot be drawn as sheets (a homotopy, or a d/dz in (a, b] with a > 0) or the chain has no
  // chainSheetRange (GLChain). Combos 0..K-1 go to chainSheetRange as they are (it decodes them, steps in chain order).
  function sheetPlan(map, W, end) {
    const info = cur.info;
    if (!info || !hasSheets(info) || !info.sheets || !Array.isArray(info.sheets.steps)) return null;
    const m = map || {};
    // a deformation (modes 1 and 3): H_t on the sheets that become F's (chainSheetHom; notes/v16-user5/SHEETS-DESIGN.md),
    // the pieces of the steps the map applies; a = the source stage, b = the last stage applied. end > 0 (F's last step,
    // v16.1 review math-5): F's pieces and digits throughout (b = end, chainSheetHom's end): surface c is F's surface c
    // at every t, a step not begun keeps its digits, and the count is F's
    if (m.mode === 1 || m.mode === 3) {
      end = Math.max(0, Math.floor(+end || 0));
      let ps = null;
      try { ps = typeof info.sheets.mapPieces === 'function' ? info.sheets.mapPieces(m, end) : null; } catch (e) { ps = null; }
      if (!ps || !ps.length) return null;
      W = clamp(Math.round(W) || 2, 1, 4);
      let total = 1;
      for (const s of ps) total *= s.n > 0 ? s.n : 2 * W + 1;
      const K = Math.min(SHEET_MAX, total);
      if (K < 2) return null;
      return { K, total, a: m.base || 0, b: end > 0 ? end : Math.max(m.mode === 1 ? m.hi || 0 : m.b || 0, m.post || 0), W, infinite: ps.some((s) => !(s.n > 0)), steps: ps, hom: true };
    }
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
  function sheetHeights(st, sp, N, mode, H, mu, aspect, rf) {
    const P1 = program('landSheetTF');
    if (!P1 || !hasSheets(P1.ch.info)) return landS && landS.want === N && landS.K === sp.K ? landS : null;
    // cells per side: about the plain landscape's cell count in all, at least 96 per side
    const K = sp.K, tileC = Math.ceil(Math.sqrt(K)), tileR = Math.ceil(K / tileC);
    let M = Math.max(Math.min(N - 1, 96), Math.floor(Math.sqrt(2 * (N - 1) * (N - 1) / K)));
    M = Math.max(8, Math.min(M, N - 1, Math.floor(maxTex / (2 * tileC)), Math.floor(maxTex / (2 * tileR))));
    const texW = tileC * 2 * M, texH = tileR * 2 * M;
    const b = st.box;
    // (the map's key too: a deformation's surfaces change with t)
    const key = [P1.ch.key, P1.ch.hash, sp.a, sp.b, sp.W, K, b.x0, b.x1, b.y0, b.y1, M, mode, H, mu, sp.hom ? mapKeyOf(st.map) : '0'].join('|');
    if (landS && landS.key === key) { sheetRefine(st, sp, landS, P1, mode, H, mu, aspect, rf); return landS; }
    if (!landS) landS = { tex1: floatTex() };
    use(P1, sp.hom ? st.map : null);
    u1i(P1, 'uN', M + 1);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u2f(P1, 'uAspect', aspect[0], aspect[1]);
    u1i(P1, 'uSheetA', sp.a); u1i(P1, 'uSheetB', sp.b); u1i(P1, 'uSheetK', K); u1i(P1, 'uSheetW', sp.W); u1i(P1, 'uTileC', tileC); u1i(P1, 'uTexW', texW);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu);
    // linear heights run on past the block (LAND_SHEET_VS clips the surface there exactly)
    u1f(P1, 'uHClip', mode === 4 || mode === 5 ? 1e4 : 0);
    u1i(P1, 'uPass', 0);
    gl.activeTexture(gl.TEXTURE15);
    runTF(P1, empty(), gl.POINTS, texW * texH, 0, texW * texH * 16, landS.tex1, texW, texH, gl.RGBA32F, gl.RGBA);
    Object.assign(landS, { key, N: M + 1, want: N, K, tileC, a: sp.a, b: sp.b, W: sp.W, sheet: true, rkey: null });
    sheetRefine(st, sp, landS, P1, mode, H, mu, aspect, rf);
    return landS;
  }
  // All sheets' refinement passes (landSheetRF, the chain program of heights ch): started once the surface has been
  // drawn, and taken into use RF_LATE ms after its link has landed. A chain program's first draw completes its Metal
  // side in the GPU process, and drawn at once after its link it held every frame of the page for 0.4 to 1 s; drawn
  // later, that work has mostly been done in the background (r3 cold opens: 0.6 s later, the stalls fell to a quarter).
  // A figure, a film or an export waits for it (the link read at once)
  const RF_LATE = 900;
  let rfLateT = 0;
  // a chain program that has not run yet counts as ready RF_LATE ms after its link landed (false meanwhile; the page
  // redraws when the time is up)
  function settled(P) {
    if (!P || P.used1) return !!P;
    const now = performance.now();
    if (!P.settleT) P.settleT = now;
    if (now - P.settleT >= RF_LATE) return true;
    if (!rfLateT && typeof setTimeout === 'function') rfLateT = setTimeout(() => { rfLateT = 0; if (api.onReady) api.onReady({ main: true }); }, RF_LATE - (now - P.settleT) + 8);
    return false;
  }
  function sheetRF(rf, ch) {
    if (!rf.full && !(rf.Ls && rf.Ls.drawnOnce)) { rfPoll(); return null; }
    let P = getProg('landSheetRF', ch, ch === cur);
    if (!P && rf.full) {
      const e = progs.get('landSheetRF|' + ch.key);
      if (e && e.state === 'pending') { finishLink(e); P = e.state === 'ready' ? e : null; }
    }
    if (!P) return null;   // (compiling: the poll redraws when it lands)
    return rf.full || settled(P) ? P : null;
  }
  // All sheets' refinement: one pair of levels per cell for every sheet; a refined sub-cell is a block of 4 x 2 texels
  // per sheet (its corners: heights and normals, then values and positions), 512 blocks per two rows
  function sheetRefine(st, sp, o, P0, mode, H, mu, aspect, rf) {
    const M = o.N - 1, Mq = (M + 3) >> 2, K = o.K, b = st.box;
    if (!rf) { o.rf = null; return; }
    // (the refinement's passes: their own program, once it has settled; until then the surface is drawn as it was for
    // these heights, else unrefined)
    const P1 = sheetRF(rf, P0.ch);
    if (!P1) { if (o.rfFor !== o.key) o.rf = null; return; }
    const rkey = o.key + '|' + rf.pxW.toPrecision(3) + '|' + rf.minPx;
    const move = rf.motion && !rf.full;
    // (moving: the levels from the midpoints and the centre, capped to the budget; at rest the lattice's, in full: a
    // mesh built while moving is rebuilt when it stops, rfLater)
    const lat = !move, lk = rkey + (lat ? '|L' : '|c');
    // (moving with a mesh over 256 cells: the sheets' base pass alone takes the frame's GPU time at Max, and a read
    // of the levels then waits for it; the base mesh while moving, refined when it stops; r2 review math-3)
    if (move && !rf.full && (o.want || 0) - 1 > 256) { if (o.rfFor !== o.key) o.rf = null; rfLater(); return; }
    if (o.rkey === rkey && o.rf && (move || !o.rf.partial)) return;
    if (move && o.rf && !o.rf.partial && o.rfFor === o.key) return;
    use(P1, sp.hom ? st.map : null);
    u1i(P1, 'uN', M + 1); u1i(P1, 'uM', M);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u2f(P1, 'uAspect', aspect[0], aspect[1]);
    u1i(P1, 'uSheetA', sp.a); u1i(P1, 'uSheetB', sp.b); u1i(P1, 'uSheetK', K); u1i(P1, 'uSheetW', sp.W); u1i(P1, 'uTileC', o.tileC);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu);
    u1f(P1, 'uHClip', mode === 4 || mode === 5 ? 1e4 : 0);
    u1f(P1, 'uPxW', rf.pxW); u1f(P1, 'uCellW', 2 * Math.max(aspect[0], aspect[1]) / M); u1f(P1, 'uMinPx', rf.minPx);
    u1i(P1, 'uLat', move ? 0 : 1);
    // (the textures are made before the heights are bound: floatTex binds its new texture on the active unit, and the
    // first level pass then read an empty uT1, every cell 'not finite', level 4 everywhere, and kept it)
    if (!o.lvTex) { gl.activeTexture(gl.TEXTURE15); o.lvTex = floatTex(); o.lstTex = floatTex(); o.rfTex = floatTex(); }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, o.tex1);
    if (o.lvKey !== lk) {
      // (as landRefine: while something moves the fenced levels of an earlier key stand in, never a synchronous read)
      const got = lvReady(o, move ? null : lk);
      // (a read of another grid's levels is dropped: All sheets' M follows the sheets' count, which changes between the
      // steps of a deformation, and the levels of the former M uploaded at the new size failed every frame, r3 verify-2)
      if (got && got.length === Mq * M * 4) { o.lvRaw = got; o.lvKey = o.rbGot; o.lvM = M; }
      if (o.lvKey !== lk && move && o.rbFence && o.lvRaw && o.lvM === M) { /* one read in flight: the earlier levels */ }
      else if (o.lvKey !== lk) {
        // (pending, or a read of other levels in flight, read first (rbOf): drawn as it was for these heights, else
        // unrefined meanwhile)
        if (o.rbFence && !rf.full) { if (o.rfFor !== o.key) o.rf = null; return; }
        u1i(P1, 'uPass', 1);
        gl.activeTexture(gl.TEXTURE15);
        if (!o.lvTmp) o.lvTmp = floatTex();
        runTF(P1, empty(), gl.POINTS, Mq * M, 0, Mq * M * 16, o.lvTmp, Mq, M, gl.RGBA32F, gl.RGBA);
        const lv = lvFetch(o, lk, Mq * M * 4, rf.full, [P1]);
        if (lv) { o.lvRaw = lv; o.lvKey = lk; o.lvM = M; }
        else if (!(move && o.lvRaw && o.lvM === M)) { if (o.rfFor !== o.key) o.rf = null; return; }
      }
    }
    const nb = (lx, ly) => K << (lx + ly);
    // (blocks of 8 texels, groups on whole pairs of rows: 512 blocks per pair, 24 evaluations each)
    const cost = (lx, ly) => 24 * nb(lx, ly), rowsOf = (lx, ly, n) => 2 * Math.ceil(n * nb(lx, ly) / 512);
    // the sub-cells' passes of t's groups from group t.gi, row t.row on, up to budget evaluations (a group's rows in
    // chunks of whole pairs); -> true when every group is built
    const passes = (t, budget) => {
      const r = t.r;
      u1i(P1, 'uPass', 2);
      gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, t.lvTex);
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, t.lstTex);
      let spent = 0;
      while (t.gi < r.groups.length) {
        const g = r.groups[t.gi], blocks = g.n * nb(g.L[0], g.L[1]), gr = 2 * Math.ceil(blocks / 512);
        const can = Math.max(2, 2 * Math.floor((budget - spent) / (2 * 256 * 24)));
        if (spent > 0 && spent + can * 256 * 24 > budget) break;
        const r1 = Math.min(gr, t.row + can);
        u2i(P1, 'uL', g.L[0], g.L[1]); u1i(P1, 'uGE', g.E); u1i(P1, 'uTot', blocks); u1i(P1, 'uRow0', t.row);
        runTFRows(P1, RF_W * (r1 - t.row), t.rfTex, RF_W, g.y0 + t.row);
        spent += (r1 - t.row) * 256 * 24;
        g.B = g.y0 / 2 * 512;   // (its first block)
        if (r1 >= gr) { t.gi++; t.row = 0; } else { t.row = r1; break; }
      }
      return t.gi >= r.groups.length;
    };
    if (move || rf.full) {
      // moving (the moving budget) or a figure, a film, an export (in full): one frame
      if (o.nb) { rfFree(o.nb); o.nb = null; }
      // (moving, with the levels it was built from: the list stands, its sub-cells are evaluated again, as landRefine)
      const cap = move ? rfMove(o.want) : RF_REST_S;
      const keep = move && o.rf && o.rfRaw === o.lvRaw && o.rfCap === cap;
      const t = { r: keep ? o.rf : rfBuild(o, o.lvRaw, M, cost, rowsOf, cap, !move), gi: 0, row: 0, lvTex: o.lvTex, lstTex: o.lstTex, rfTex: o.rfTex };
      o.rfRaw = o.lvRaw; o.rfCap = cap;
      passes(t, Infinity);
      const r = t.r;
      r.partial = move && (r.capped || !lat);
      o.rf = r; o.rkey = rkey; o.rfFor = o.key;
      if (r.partial) rfLater();
      return;
    }
    // At rest: built over several frames, at most RF_FRAME evaluations each, into textures of its own, and swapped in
    // when complete; meanwhile the mesh drawn is kept when it is of these heights (built while moving), else the
    // surface is drawn unrefined. The budget at rest is the user's case in full (r2 review math-1: capped at rest)
    if (!o.nb || o.nb.rkey !== rkey) {
      if (o.nb) rfFree(o.nb);
      o.nb = { rkey, gi: 0, row: 0, raw: o.lvRaw };
      o.nb.r = rfBuild(o.nb, o.lvRaw, M, cost, rowsOf, RF_REST_S, true);
    }
    if (o.rfFor !== o.key) o.rf = null;
    if (!passes(o.nb, RF_FRAME)) { rfPoll(); return; }
    for (const k of ['lvTex', 'lstTex', 'rfTex']) { if (o[k]) gl.deleteTexture(o[k]); o[k] = o.nb[k]; }
    o.rfRows = o.nb.rfRows; o.lvDim = o.nb.lvDim; o.lstRows = o.nb.lstRows;
    o.rf = o.nb.r; o.rf.partial = false; o.rkey = rkey; o.rfFor = o.key;
    o.rfRaw = o.nb.raw; o.rfCap = RF_REST_S;
    o.nb = null;
    freeScratch(o);
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
  // the pane's last Landscape (t: when one was last asked for; key: the chain whose own surface it drew), for the cards
  const landPane = { t: -1e9, key: null };
  let landPollT = 0;
  function landPoll() {
    if (landPollT || typeof setTimeout !== 'function') return;
    landPollT = setTimeout(() => { landPollT = 0; if (api.onReady) api.onReady({ main: true }); }, 120);
  }
  function drawLandscape(st) {
    if (!ok) return null;
    lvCollect();
    const { MVP, eye } = camera(st.cam, fw, fh);
    const box = st.box;
    const BW = box.x1 - box.x0, BH = box.y1 - box.y0;
    const { aspect, H, floorZ, Mx } = landGeom(box, st.scale);
    const modeName = st.heightMode || 'log';
    const mode = { log: 0, abs: 1, re: 2, im: 3, reLin: 4, imLin: 5, reKnee: 6, imKnee: 7 }[modeName] ?? 0;
    const mu = st.mu > 0 ? st.mu : 1;
    const N = clamp(Math.round(st.cells || 256), 32, 512);
    const dpr = st.dpr || Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const C = landColors(st);
    const material = MATERIALS[st.material] ?? (st.style === 'classic' ? 0 : 0);
    const lt = { sky: toLin3(C.hemiSky), ground: toLin3(C.hemiGround) };
    const heightOf = (v) => {
      if (mode === 0) return H * (2 / Math.PI) * Math.atan(Math.log(Math.max(v, 1e-300)) / 1.4);
      if (mode === 1) return H * ((4 / Math.PI) * Math.atan(v / mu) - 1);
      if (mode >= 6) { const x = v / mu, a = Math.abs(x), c = 0.5 / Math.PI; return H * Math.sign(x) * (a <= 1 ? a : 1 + c * Math.atan((a - 1) / c)); }
      if (mode >= 4) return H * Math.max(-1.25, Math.min(1.25, v / mu));
      return H * (2 / Math.PI) * Math.atan(v / mu);
    };
    const info = { MVP, eye, aspect, floorZ, top: H, H, hs: H, heightOf, sheets: null };
    // All sheets (st.sheets: {W}): the covering surface, when the chain and the map allow it (else the principal
    // branch, info.sheets null); while its programs compile the principal branch stands in
    const sp = st.sheets ? sheetPlan(st.map, st.sheets.W, st.sheets.end) : null;
    // A step card's Landscape (st.card) waits for the pane's: its programs start once the pane has drawn this chain's
    // surface, and are taken into use once they have settled (r3: compiled alongside the pane's All sheets, they slowed
    // its link, and their first draws in later frames stalled the GPU process again, r2 review verify-2)
    const now = performance.now();
    if (!st.card) landPane.t = now;
    else if (cur.info && !sideMode) {
      // (at most 3 s from a card's first wait for this chain: a long play or orbit no longer keeps the cards empty,
      // r3 review speed-5)
      if (landPane.waitKey !== cur.key) { landPane.waitKey = cur.key; landPane.wait0 = now; }
      if (landPane.key !== cur.key && now - landPane.t < 1500 && now - landPane.wait0 < 3000) { framePending = true; landPoll(); return info; }
      if (!settled(program('landTF')) || !settled(program('land'))) { framePending = true; return info; }
    }
    // (the surface's programs start compiling together; they are taken into use together, groupDone. All sheets: the
    // sheets' programs and the floor; the principal branch's start with a view that draws it, r3)
    if (cur.info && !sideMode) for (const n of sp ? ['landSheetTF', 'landSheet', 'floor'] : GROUPS[0]) getProg(n, cur, true);
    const Ls = sp ? program('landSheet') : null;   // (both sheet programs start compiling here)
    // the refinement's scale: px per world unit at the camera's fitted distance for this frame's size (not the orbit's
    // or the zoom's, so orbiting never rebuilds the mesh), quantized to quarter octaves (a resize by a few px keeps it)
    const fitD = fitDist(landGeom(box, st.scale).radius, (st.cam && st.cam.fov) || 28 * Math.PI / 180, fw, fh, 1.05);
    const pxW0 = fh / (2 * Math.tan(0.5 * ((st.cam && st.cam.fov) || 28 * Math.PI / 180)) * fitD);
    const dbg = {};
    // At rest (and in figures, films and exports) the scale is the camera's at the block's nearest point, when that is
    // nearer than the fitted distance (zoomed in, or the near side of the block in perspective): a finished zoom or
    // orbit rebuilds once. While something moves the fitted scale stands, and a mesh built at rest for the same heights
    // is kept (orbiting and zooming never rebuild). r2 review math-5
    let pxS = pxW0;
    if (!st.motion || st.full) {
      const ga = landGeom(box, st.scale);
      const q = [clamp(eye[0], -ga.ext[0], ga.ext[0]), clamp(eye[1], -ga.ext[1], ga.ext[1]), clamp(eye[2], ga.floorZ, ga.H)];
      const dN = Math.max(Math.hypot(eye[0] - q[0], eye[1] - q[1], eye[2] - q[2]), 0.15 * fitD);
      pxS = Math.max(pxW0, fh / (2 * Math.tan(0.5 * ((st.cam && st.cam.fov) || 28 * Math.PI / 180)) * dN));
    }
    const rf = st.refine === false || dbg.noRef ? null : { pxW: Math.pow(2, Math.round(4 * Math.log2(Math.max(pxS, 1))) / 4), motion: !!st.motion, full: !!st.full, minPx: dbg.minPx || 0.1, Lp: getProg('land', cur, false), Ls };
    let hs = sp ? sheetHeights(st, sp, N, mode, H, mu, aspect, rf) : null;
    if (!Ls) hs = null;
    // (while the sheets' programs compile, the principal branch stands in only with programs that have run before, an
    // earlier version of the chain's: a formula's first All-sheets Landscape drew its principal branch with programs of
    // its own first, and the GPU process stalled once for them and once more for the sheets', r2 review verify-2)
    const warm = (name) => { for (const ch of [cur, ...hist]) { const P = getProg(name, ch, false); if (P) return !!P.used1; } return false; };
    const hd = hs || (sp && !Ls && !(warm('land') && warm('landTF')) ? null : landHeights(st, N, mode, H, mu, aspect, rf));
    if (!hd) return info;
    // (the pane's other surface keeps its heights, not its refinement: toggling All sheets held both, r3 review speed-4)
    if (!st.card) {
      if (hs) { const lp = lands.get(N); if (lp && lp.lvTex) { rfFree(lp); freeScratch(lp); } }
      else if (landS && landS.lvTex) { rfFree(landS); freeScratch(landS); }
    }
    if (hs) info.sheets = { K: hs.K, total: sp.total, W: sp.W, N: hs.N, infinite: sp.infinite, hom: !!sp.hom };
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
    const Lp = hs ? (mode === 4 || mode === 5 ? program('landSheetC') : Ls) : program('land');
    // (asked for before Lp is bound: a program that finishes its link here binds itself)
    const LR = Lp && hd.rf && hd.rf.groups.length && !hs ? program('landR') : null;
    // (moving, the principal surface: its steep base triangles by landB, once the refinement's programs have run, STEEP;
    // not while the mesh built at rest for these heights stands, an orbit or a zoom: its walls are refined)
    const LB = Lp && !hs && rf && st.motion && !st.full && rfWarmAll && !(hd.rf && !hd.rf.partial && hd.rfFor === hd.key) ? program('landB') : null;
    if (Lp) {
      use(Lp, st.map);
      common(Lp);
      lightUniforms(Lp, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
      u3(Lp, 'uCut', C.cut);
      // (principal: up to 3 triangles where a real cut splits one; All sheets with linear heights: the triangle
      // clipped at the block, up to 3)
      u1i(Lp, 'uHMode', mode); u1f(Lp, 'uMu', mu);
      u2f(Lp, 'uAspect', aspect[0], aspect[1]);
      const clip = !!hs && (mode === 4 || mode === 5);
      if (hs) {
        u1i(Lp, 'uClip', clip ? 1 : 0);
        // the per-sheet cue (notes/landscape-walls/USER-ADDENDUM.md): strongest where a deformation's surfaces nearly
        // coincide (t near 0), faint at t = 1 and for a map's sheets at rest
        const cm = st.map && (st.map.mode === 1 || st.map.mode === 3) ? clamp(+st.map.t || 0, 0, 1) : 1;
        const cue = dbg.cue || st.sheetCue || 'tint';
        // (OKLab lightness x (1 +- uCue): +-14 % at t = 0, +-4 % at t = 1 and for a map's sheets; r2 review pictures-1)
        u1f(Lp, 'uCue', cue === 'none' ? 0 : 0.14 - 0.10 * cm * cm * (3 - 2 * cm));
        u1i(Lp, 'uCueK', hs.K);
        u1f(Lp, 'uZBias', 4e-6);
        u1i(Lp, 'uSheetK', hs.K);
      } else {
        u1i(Lp, 'uCuts', hd.cuts || 0);
        for (let d = 0; d < 3; d++) { gl.activeTexture(gl.TEXTURE5 + d); gl.bindTexture(gl.TEXTURE_2D, hd.edges[d]); }
      }
      // the base cells, then each group's sub-cells (REFINE). All sheets: the same program, sub-cells under about a
      // pixel taking F from their corners (uVW) on screen; the principal surface: a program without the chain (landR,
      // F from the vertices), drawn once it has compiled (until then the cells are drawn unrefined)
      const R = hd.rf && hd.rf.groups.length && (hs || LR) ? hd.rf : null;
      u1i(Lp, 'uM', hd.N - 1); u1i(Lp, 'uRef', 0); u1i(Lp, 'uRefOn', R ? 1 : 0); u1i(Lp, 'uVW', 0); u1i(Lp, 'uSteep', LB ? 1 : 0);
      if (R) {
        gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, hd.lvTex);
        gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, hd.lstTex);
        gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, hd.rfTex);
      }
      gl.drawArraysInstanced(gl.TRIANGLES, 0, !hs || clip ? 9 : 3, (hs ? hs.K : 1) * 2 * (hd.N - 1) * (hd.N - 1));
      const cellPx = rf ? rf.pxW * 2 * Math.max(aspect[0], aspect[1]) / (hd.N - 1) : 0;
      if (LB) {
        use(LB);
        common(LB);
        lightUniforms(LB, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
        u3(LB, 'uCut', C.cut); u1i(LB, 'uHMode', mode); u1f(LB, 'uMu', mu); u2f(LB, 'uAspect', aspect[0], aspect[1]);
        u1i(LB, 'uM', hd.N - 1); u1i(LB, 'uVW', 1); u1i(LB, 'uCuts', hd.cuts || 0); u1i(LB, 'uRefOn', R ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6 * (hd.N - 1) * (hd.N - 1));
      }
      if (R && LR) {
        use(LR);
        common(LR);
        lightUniforms(LR, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
        u3(LR, 'uCut', C.cut); u1i(LR, 'uHMode', mode); u1f(LR, 'uMu', mu); u2f(LR, 'uAspect', aspect[0], aspect[1]);
        u1i(LR, 'uM', hd.N - 1); u1i(LR, 'uVW', 1); u1i(LR, 'uCuts', hd.cuts || 0);
      }
      const PR = LR || Lp;
      if (R) for (const g of R.groups) {
        const n = 1 << (g.L[0] + g.L[1]);
        u1i(PR, 'uRef', 1); u2i(PR, 'uL', g.L[0], g.L[1]); u1i(PR, 'uRefE', g.E); u1i(PR, 'uRefT', hs ? g.y0 / 2 * 512 : g.y0 * RF_W);
        if (hs) u1i(PR, 'uVW', !st.full && !clip && cellPx / (1 << Math.min(g.L[0], g.L[1])) < 1.5 ? 1 : 0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, clip ? 9 : 3, g.n * n * 2 * (hs ? hs.K : 1));
      }
      info.refine = R ? { groups: R.groups.map((g) => [g.L[0], g.L[1], g.n]), capped: R.capped, Lc: R.Lc, pxW: rf && rf.pxW } : null;
      Lp.drawnOnce = true;
      if (hs && Ls) Ls.drawnOnce = true;
      if (!st.card && Lp.ch === cur) landPane.key = cur.key;
      lvTailMark();
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
    sheetInfo(map, W, end) { const p = ok ? sheetPlan(map, W, end) : null; return p ? { K: p.K, total: p.total, W: p.W, infinite: p.infinite, hom: !!p.hom } : null; },
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

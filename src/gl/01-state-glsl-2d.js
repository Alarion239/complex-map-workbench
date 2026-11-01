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
  let syncFwd = 0;         // > 0: chain and static programs are waited for, inverse ones as before (exports)
  // side mode (GLR.side): setChain and the draws use a chain that is not the user's (example thumbnails) without
  // touching cur or hist; side = the saved {cur} while it lasts
  let sideMode = false, side = null;
  const sideChs = new Map();
  let frameErr = '', framePending = false;
  // the programs of the current chain that a draw drew a stand-in for (an earlier version, the deformation's start, or
  // nothing), program id -> chain key, until each lands, fails or is dropped: frameStatus().waiting, over every pane of
  // the frame (pending is only the last begin's or viewport's: the Sphere view draws two panes); frameCompiling: since
  // the last begin or viewport (pending also holds a ready program's deferred first draw, which is no compile)
  const waitOn = new Map();
  let frameCompiling = false;
  function standIn(id) { if (!sideMode && id) { waitOn.set(id, cur.key); frameCompiling = true; } }
  function waitingNow() {
    const mk = sideMode && side ? side.cur.key : cur.key;   // (in GLR.side mode, cur is the side chain's: the main chain's waits stay)
    for (const [id, k] of waitOn) { const e = progs.get(id); if (!e || e.state !== 'pending' || k !== mk) waitOn.delete(id); }
    return waitOn.size > 0;
  }
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
  // The mode is compiled in (uMode a constant, mapPoint only that mode's body; getProg keeps one program per mode a
  // draw uses): ANGLE's Direct3D 11 back end (Windows) inlines every call and D3DCompile's time grows much faster than
  // the code, so the four modes in one program (seven copies of the chain) took 26-42 s to compile for exp then
  // Mobius on an Iris Xe, its mode 0 alone 0.3 s. A view that does not deform never compiles the homotopies.
  const POST_OF = `
vec2 postOf(vec2 w) { return uPost > uB ? chainRange(w, uB, uPost) : w; }
`;
  // (issue #72) modes 1-3 of a chain without d/dz (every chain but those, hasStages): one walk of the chain, k = 1..n, each step through one call of
  // chainAt (or chainStep): FXC inlines every call, and the bodies below as chainRange + chainHom + postOf carried a
  // copy of every step per call (6 to 8 per program, 17 with paths built of others). The same steps in the same order:
  // mode 1 (base, hi) in full, hi along its path at t (none at t <= 0), then the post (b, post] in full (hi <= b
  // whenever there is a post); mode 3 (base, a] in full, (a, b] along their paths, the post; mode 2 the stages a and
  // b, each from base (homrange.js's lerp of the two; base <= a). The bound is one no compiler can know (uNoUnroll,
  // LIB), so the walk stays a loop.
  const WALK = (n, how) => `vec2 z = s;
  for (int k = 1; k < max(${n + 1}, uNoUnroll); k++) {
    int how = ${how};
    z = chainAt(k, z, uT, how);
  }
  return z;`;
  const POST = '(uPost > uB && k > uB && k <= uPost) ? 1 : 0';
  const MAP_PLAIN = [
    () => 'return chainRange(s, uA, uB);',
    (n) => WALK(n, `k <= uBase ? 0 : k < uHi ? 1 : k == uHi ? (uT <= 0.0 ? 0 : 2) : ${POST}`),
    (n) => `vec2 z = s, z0 = s, z1 = s;
  for (int k = 1; k < max(${n + 1}, uNoUnroll); k++) {
    if (k > uBase && k <= max(uA, uB)) z = chainStep(k, z);
    if (k == uA) z0 = z;
    if (k == uB) z1 = z;
  }
  return mix(z0, z1, uT);`,
    (n) => WALK(n, `k <= uBase ? 0 : k <= uA ? 1 : k <= uB ? (uT <= 0.0 ? 0 : 2) : ${POST}`),
  ];
  const MAP_STAGE = [
    'return chainRange(s, uA, uB);',
    `vec2 z = chainRange(s, uBase, uHi - 1);
  // (a d/dz focus has the z-plane on the left; the line's ends are exact, as homrange.js lerpE: review v16 math-2)
  if (chainIsDeriv(uHi)) return postOf(uT <= 0.0 ? z : uT >= 1.0 ? chainStage(uHi, s) : mix(z, chainStage(uHi, s), uT));
  return postOf(uT <= 0.0 ? z : chainHom(uHi, z, uT));`,
    `vec2 z0 = chainRange(s, uBase, uA);
  vec2 z1 = uA > 0 && derivIn(uA, uB) ? chainStage(uB, s) : chainRange(z0, uA, uB);
  return mix(z0, z1, uT);`,
    'vec2 z = chainRange(s, uBase, uA); return postOf(uT <= 0.0 ? z : chainHomAll(z, uA, uB, uT));',
  ];
  const DERIV_IN = (n) => `
bool derivIn(int a, int b) {
  for (int k = 1; k <= ${Math.max(1, n)}; k++) { if (k > b) break; if (k > a && chainIsDeriv(k)) return true; }
  return false;
}
`;
  // (MAP_STAGE for a chain with a d/dz step only: every chain has chainStage and chainIsDeriv, which without one are
  // chainRange and false, and there MAP_STAGE's bodies are MAP_PLAIN's)
  const hasStages = (info) => !!info && /\bchainStage\b/.test(info.source || '') && /\bchainIsDeriv\b/.test(info.source || '')
    && !/bool chainIsDeriv\(int k\) \{\s*return false;/.test(info.source || '');
  const hasSheets = (info) => !!info && /\bchainSheetRange\b/.test(info.source || '');
  // the map mode a program is compiled for: 1, 2, 3 as in mapPoint, anything else the plain chain (0)
  const modeOf = (map) => { const m = (map && map.mode) || 0; return m === 1 || m === 2 || m === 3 ? m : 0; };
  const MAP = (info, mode) => {
    const st = hasStages(info);
    return `
const int uMode = ${mode}; uniform int uA; uniform int uB; uniform int uHi; uniform float uT; uniform int uBase; uniform int uPost;
${mode === 1 || mode === 3 ? POST_OF : ''}${st && mode === 2 ? DERIV_IN(sigsOf(info.key).length) : ''}
vec2 mapPoint(vec2 s) {
  ${st ? MAP_STAGE[mode] : MAP_PLAIN[mode](Math.max(1, sigsOf(info.key).length))}
}
// the plotted function of the color plot, landscape and phase sphere (derivatives are d/dz steps of the chain)
vec2 mapF(vec2 z) { return mapPoint(z); }
`;
  };
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
  // domain coloring styles (spec 6.8); needs UTIL. Phase colors (issue 8, src/palette.js): uPal is the chosen
  // palette's index in Palette.LIST, 0 the wheel; an Arb palette is baked in uPalT (Palette.bake): column i is
  // arg 2pi i / W, row j is 1 - 1/(1 + |w|^0.2) = j / (H - 1)
  const DCOLOR = `
uniform int uStyle; uniform float uSectors; uniform float uGrid; uniform vec3 uPlane; uniform vec3 uInk; uniform float uDark; uniform float uDpr; uniform float uPhaseLines;
uniform int uPal; uniform sampler2D uPalT;
// the Arb palette's color of w with arg th and ln|w| = lr
vec3 arbc(float th, float lr) {
  float m = 1.0 / (1.0 + exp(-0.2 * lr));
  return textureLod(uPalT, vec2(th * (1.0 / TAU) + ${0.5 / Palette.W}, (0.5 + ${Palette.H - 1}.0 * m) / ${Palette.H}.0), 0.0).rgb;
}
// a style's wheel(th, L) in the chosen palette, ref the style's neutral lightness: the wheel itself, or the Arb color
// pb darkened below ref and lightened above it (Palette.shade)
vec3 pwheel(float th, float L, float ref, vec3 pb) {
  if (uPal == 0) return wheel(th, L);
  return L <= ref ? pb * (L / ref) : mix(pb, vec3(1.0), (L - ref) / (1.0 - ref));
}
vec3 dcolorAt(vec2 w, float r, float th, float lr, float flr, float faw, vec2 g, vec2 gw, vec2 fw0);
vec3 dcolor(vec2 w) {
  // every derivative first, in uniform control flow
  float r = wabs(w);
  float th = wang(w);
  float lr = log(clamp(r, 1e-37, 3e38));
  vec2 g = w / max(uGrid, 1e-30);
  return dcolorAt(w, r, th, lr, fwidth(lr), argWidth(w), g, fwidth(g), fwidth(w));
}
// the same colour with the footprints given: wx, wy, the change of w over one device pixel across and down
// (a colour taken where the screen's derivatives mean nothing, as for each sheet inside the inverse pass's walk);
// d ln w = dw / w gives the widths of ln |w| and arg w
vec3 dcolorD(vec2 w, vec2 wx, vec2 wy) {
  float r = wabs(w);
  float th = wang(w);
  float lr = log(clamp(r, 1e-37, 3e38));
  float rr = max(r * r, 1e-37);
  vec2 lx = vec2(dot(wx, w), wx.y * w.x - wx.x * w.y) / rr, ly = vec2(dot(wy, w), wy.y * w.x - wy.x * w.y) / rr;
  vec2 fw0 = abs(wx) + abs(wy);
  return dcolorAt(w, r, th, lr, abs(lx.x) + abs(ly.x), abs(lx.y) + abs(ly.y), w / max(uGrid, 1e-30), fw0 / max(uGrid, 1e-30), fw0);
}
vec3 dcolorAt(vec2 w, float r, float th, float lr, float flr, float faw, vec2 g, vec2 gw, vec2 fw0) {
  float q = TAU / max(uSectors, 1.0);
  float xm = lr / q, fm = flr / q;
  float xp = th / q, fp = faw / q;
  vec3 pb = uPal == 0 ? vec3(0.0) : arbc(th, lr);
  if (!(abs(w.x) < 3e38 && abs(w.y) < 3e38)) {
    if (abs(w.x) > 3e38 || abs(w.y) > 3e38) return vec3(0.96078);  // +-infinity: #F5F5F5
    float h = (gl_FragCoord.x + gl_FragCoord.y) * 0.70710678 / (6.0 * uDpr);  // NaN: #7F7F7F, 45 deg hatch #6A6A6A
    return mix(vec3(0.49804), vec3(0.41569), iso(h, 1.0 / (6.0 * uDpr), uDpr));
  }
  if (uStyle == 2) {        // Phase
    vec3 c = pwheel(th, 0.75, 0.75, pb);
    if (uPhaseLines > 0.5) c = mix(c, vec3(0.0), 0.20 * iso(xp, fp, 1.0) * dfade(fp));
    return c;
  }
  if (uStyle == 1) {        // Modulus (classic): zeros black, poles white
    float u = (2.0 / PI) * atan(r);
    float L = 0.08 + 0.88 * u;
    // (an Arb palette carries |F| itself, all but the phase-only one)
    vec3 c = uPal == 0 ? mix(gray(L), wheel(th, L), min(1.0, 5.2 * u * (1.0 - u))) : uPal == 2 ? pwheel(th, L, 0.52, pb) : pb;
    float l2 = lr * 1.4426950408889634, f2 = flr * 1.4426950408889634;
    return mix(c, vec3(0.0), 0.15 * iso(l2, f2, 1.0) * dfade(f2));
  }
  if (uStyle == 4) {        // Contours
    vec3 c = mix(uPlane, pwheel(th, 0.75, 0.75, pb), 0.12);
    c = mix(c, uInk, 0.5 * iso(xm, fm, uDpr) * dfade(fm));
    c = mix(c, pwheel(th, uDark > 0.5 ? 0.80 : 0.55, 0.75, pb), iso(xp, fp, 1.25 * uDpr) * dfade(fp));
    return mix(c, uInk, iso0(lr, flr, 1.75 * uDpr));
  }
  if (uStyle == 3) {        // Grid: pullback of the image's coordinate net
    vec3 c = mix(pwheel(th, 0.90, 0.75, pb), uPlane, 0.35);
    float l1 = max(iso(g.x, gw.x, uDpr) * dfade(gw.x), iso(g.y, gw.y, uDpr) * dfade(gw.y));
    float l5 = max(iso(g.x / 5.0, gw.x / 5.0, 1.75 * uDpr) * dfade(gw.x / 5.0), iso(g.y / 5.0, gw.y / 5.0, 1.75 * uDpr) * dfade(gw.y / 5.0));
    float l0 = max(iso0(w.x, fw0.x, 1.75 * uDpr), iso0(w.y, fw0.y, 1.75 * uDpr));
    c = mix(c, pwheel(th, 0.45, 0.75, pb), 0.85 * l1);
    return mix(c, pwheel(th, 0.30, 0.75, pb), max(l5, l0));
  }
  // Tiles (enhanced): conformal squares, modulus x e^(2pi/n) and phase 2pi/n per tile
  float sm = sawAA(xm, fm), sp = sawAA(xp, fp);
  float d = 1.0 - smoothstep(0.25, 0.6, max(fm, fp));
  float L = 0.62 + d * (0.20 * (sm - 0.5) + 0.07 * (sp - 0.5));
  return mix(pwheel(th, L, 0.62, pb), vec3(1.0), 0.6 * iso0(lr, flr, 1.25));
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
  // The globe's light (issue #287), in place of SHADE in every program that draws on the sphere (the globe, its phase
  // portrait, the lifted and pre-mapped regions, the inverse pass), with the same shade() so their bodies are shared.
  // On the sphere the colour is the data (arg F and |F|, a shape's fill) and a sphere has no up, so turning it must not
  // change how readable a region is: the key light follows the camera (uKeyDir, a little above and to the left of the
  // eye: globeLight in 06-draws-3d.js), the ambient is even (no sky and ground), the highlight is small and weak, and
  // the limb darkens by at most 15 % for roundness. The face we look at shows its colour at about full strength, the
  // limb away from the key at about 0.68 of it (linear light), from every side. ao is unused (no occlusion on a ball).
  const SHADE_GLOBE = `
uniform vec3 uKeyDir;
vec3 shade(vec3 alb, vec3 n, vec3 v, float ao) {
  float s = 1.0;
  if (dot(n, v) < 0.0) { n = -n; s = 0.6; }   // back faces: flipped normal at 0.6
  float ndl = max(dot(n, uKeyDir), 0.0);
  float e = 1.0 - max(dot(n, v), 0.0);
  vec3 c = alb * ((0.80 + 0.22 * ndl) * (1.0 - 0.15 * e * e));
  vec3 h = normalize(uKeyDir + v);
  c += 0.05 * pow(max(dot(n, h), 0.0), 96.0);
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
  // o (flat only, the steps view's carried colour): carry, the absolute source point vP for the fragment stage, the
  // sheet key as the depth (preKeyDepth, uKeyOn), and the triangle test of a colour mesh (also a triangle a few pixels
  // small whose middle strays, a fold of the map where two sheets meet, kept: uKPx; none longer than uKLim, 0.35 of
  // the pane: a point the map sends far, whose triangle would cover the pane many times over); sheet, the places of
  // each triangle continued from its centre's sheet (chainSheetHom, the landscape's evalAt), so a triangle across a cut
  // of the deformation's path is continued, not torn and left out
  const REGION_VS = (sphere, fetch, o = {}) => `
layout(location = 0) in vec4 aTpl0;
layout(location = 1) in vec4 aTpl1;
layout(location = 6) in vec4 aIdx;
layout(location = 2) in vec4 aAB;
layout(location = 3) in vec2 aC;
layout(location = 4) in float aSkip;
out vec2 vSrc;
flat out float vJac;
${o.carry ? `out vec2 vP;\nuniform float uKPx; uniform float uKLim;\n${PRE_KEY_UNI}` : ''}${o.sheet ? 'out float vSide;\nflat out float vSideTol;\nuniform int uKPass;\n' : ''}${sphere ? 'out vec3 vNor; out vec3 vPos;' : ''}
uniform vec2 uCenter; uniform vec2 uCenterLo; uniform vec2 uScale; uniform vec2 uRel; uniform vec2 uSrcOff;
uniform mat4 uMVP;
${SRC}
${FETCH(fetch)}
${LIFT}
${BARY}
${VALID}
${o.sheet ? 'vec2 onCentreSheet(vec2 zc, vec2 s, out float side) { vec2 w = chainSheetHom(zc, srcOf(s), uMode, uBase, uA, uHi, uB, uPost, uT, 0, 0); side = cxs0_dom; return w; }\n' : ''}void main() {
  vec2 s0 = bary(aTpl0.xy), s1 = bary(aTpl0.zw), s2 = bary(aTpl1.xy);
${o.sheet ? `  vec2 zc = srcOf((s0 + s1 + s2) / 3.0);
  float d0, d1, d2, dMid;
  vec2 w0 = onCentreSheet(zc, s0, d0), w1 = onCentreSheet(zc, s1, d1), w2 = onCentreSheet(zc, s2, d2);
  vec2 wm = onCentreSheet(zc, (s0 + s1 + s2) / 3.0, dMid);
  // (uKPass 1: only a triangle across a clipped cut, again on the branch of a vertex past it, for its part there)
  if (uKPass == 1) {
    if (!(d0 < 0.0 || d1 < 0.0 || d2 < 0.0)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    zc = srcOf(d0 < 0.0 ? s0 : (d1 < 0.0 ? s1 : s2));
    w0 = onCentreSheet(zc, s0, d0); w1 = onCentreSheet(zc, s1, d1); w2 = onCentreSheet(zc, s2, d2);
    wm = onCentreSheet(zc, (s0 + s1 + s2) / 3.0, dMid);
  }` : `  vec2 w0 = W(aIdx.x, s0), w1 = W(aIdx.y, s1), w2 = W(aIdx.z, s2);
  vec2 wm = W(aIdx.w, (s0 + s1 + s2) / 3.0);`}
  int c = int(aTpl1.z + 0.5);
  // pattern coordinates: the source point relative to a pattern-aligned origin near O (uSrcOff = O - Q)
  vSrc = (c == 0 ? s0 : (c == 1 ? s1 : s2)) + uSrcOff;
${o.carry ? '  vP = srcOf(c == 0 ? s0 : (c == 1 ? s1 : s2));\n' : ''}${o.sheet ? `  vSide = c == 0 ? d0 : (c == 1 ? d1 : d2);
  // (a side value interpolated across the triangle is off by up to h^2 / 4 for |z|^2 - 1, h its longest source edge:
  // the fragments that close to the cut are kept, so the two sides meet without a gap)
  vec2 q0 = srcOf(s0), q1 = srcOf(s1), q2 = srcOf(s2);
  vSideTol = 0.25 * max(max(dot(q1 - q0, q1 - q0), dot(q2 - q1, q2 - q1)), dot(q0 - q2, q0 - q2));
` : ''}  float sa = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
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
${o.carry ? `  float ke = max(max(len2(w1 - w0), len2(w2 - w1)), len2(w0 - w2));
  good = good && (midOk(w0, w1, w2, wm) || ke < uKPx) && ke < uKLim;` : '  good = good && midOk(w0, w1, w2, wm);'}
  vec2 w = c == 0 ? w0 : (c == 1 ? w1 : w2);
  if (!good) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  gl_Position = vec4(${fetch === 'local' ? '(w + uRel) * uScale' : '((w - uCenter) - uCenterLo) * uScale'}, ${o.carry ? 'uKeyOn > 0 ? 2.0 * preKeyDepth(vP, false) - 1.0 : 0.0' : '0.0'}, 1.0);`}
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
  vec2 rt = preRT(gp);
  float rr = rt.x, th = rt.y;
  vec2 sa = uPattern == 4 ? vP : preSrc(gp);
  vec2 fs = uPattern == 4 ? fwidth(vP) : gw * uCell;
  float gr = rr / uCell, fgr = fwidth(gr);
  float ra = th * (12.0 / PI), fra = gpw.y * 1.5;
  float lr = gp.x * (TAU / 16.0) * (6.0 / PI), flr = gpw.x * (TAU / 16.0) * (6.0 / PI);
  float m = moire(gw);
  vec3 c0 = uC0, c1 = uC1, k = uK;
  vec3 col = c0;
`;
  // a pre-mapped mesh's polar pattern coordinates gp = (ln |z|, arg z) * 16 / tau back to (|z|, arg z) (preRT) and to the
  // source point z (preSrc): PAT_PRE.pre's and CARRY_FS's pre option's one conversion
  const PRE_SRC = `vec2 preRT(vec2 gp) { return vec2(exp(clamp(gp.x * (TAU / 16.0), -80.0, 80.0)), gp.y * (TAU / 16.0)); }
vec2 preSrc(vec2 gp) { vec2 rt = preRT(gp); return rt.x * vec2(cos(rt.y), sin(rt.y)); }
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
  // the front sheet of every sample is the one the inverse path shows (one D per leaf would draw jagged seams where
  // sheets meet). D is Inverse.sheetKey's: the distance to the window's centre, the poles penalised.
  // preKeyDepth(sa, stepped), sa the source point: x = 256 D + 0.999 (tie order), depth x / (x + 1024).
  // - 256 = 1 / Inverse.front's TIE_D: keys a tie step apart are one unit of x apart, and the tie order, in [0, 1) and
  //   scaled by 0.999 to stay below a unit, decides only between keys within a step. A map symmetric about the centre
  //   gives its sheets equal D, which the mesh's placement (1e-3 of |z|) would otherwise order fragment by fragment.
  // - stepped (a fragment stage: PRE_KEY, after PAT_PRE.pre or CARRY_FS): 256 D rounded to its step, as Inverse.front
  //   and the inverse pass compare keys, so two sheets in one step are ordered by the tie order alone. Not stepped (a
  //   vertex stage: REGION_VS's carry option): 256 D itself, since a depth interpolated across a triangle whose
  //   vertices straddle a step would order the sheets wrongly over the whole triangle.
  // - The tie order: larger Im z in front, then larger Re z, by the atan of the offset from the centre (the whole
  //   plane into a bounded range; Re z weighted 1e-3, normalised by 1.001).
  // - x / (x + 1024) maps x >= 0 into [0, 1), monotone, finest for small D (depth 0.5 at D = 4). D is capped at 1e4
  //   (a point that far behind is behind every point that matters) so x stays finite.
  const PRE_KEY_UNI = `uniform int uKeyOn; uniform vec4 uKWin; uniform float uKR; uniform float uKRs; uniform vec2 uKSing[4]; uniform int uKSingN;
float preKeyDepth(vec2 sa, bool stepped) {
  float D = log2(1.0 + length(sa - 0.5 * (uKWin.xy + uKWin.zw)) / uKR);
  for (int i = 0; i < 4; i++) { if (i >= uKSingN) break; D += max(0.0, log2(uKRs / max(length(sa - uKSing[i]), 1e-30))); }
  // (the tie order: larger Im z in front, then larger Re z, over the whole plane, in [0, 1))
  vec2 tk = atan((sa - 0.5 * (uKWin.xy + uKWin.zw)) / uKR) / 3.14159265 + 0.5;
  float d = min(D, 1e4) * 256.0;
  float x = (stepped ? floor(d + 0.5) : d) + 0.999 * (1.0 - (tk.y + 1e-3 * tk.x) / 1.001);
  return x / (x + 1024.0);
}
`;
  const PRE_KEY = '  gl_FragDepth = uKeyOn > 0 ? preKeyDepth(sa, true) : gl_FragCoord.z;\n';
  // REGION_FS with the source point replaced by the interpolated pattern coordinates (and no stretched-mesh feather)
  const REGION_PRE_FS = (sphere) => {
    let t = REGION_FS(sphere);
    const key = sphere ? [] : [['out vec4 o;\n', 'out vec4 o;\n' + PRE_KEY_UNI], ['  o = vec4(col * a, a);\n}', PRE_KEY + '  o = vec4(col * a, a);\n}']];
    for (const [a, b] of [['in vec2 vSrc;\n', 'in vec2 vG; in vec2 vP;\n' + PRE_SRC], [PATTERN_SRC('fwidth'), PAT_PRE.pre + PAT_CHAIN], ['float a = uAlpha * fadeOf(sa);', 'float a = uAlpha;'], ...key]) {
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
  // (#366 F) The colour carried by the points, on the GPU (the steps view's svCarry): a grid of uN cells over plane s
  // (uCGrid: its corner and cell), each cell two triangles, drawn without buffers (gl_VertexID). A vertex places its
  // triangle's three corners by mapPoint (the glide's map from plane s: uBase = s), so the triangle is the same in all
  // three, and one torn across a cut or a pole (an edge over uLim on the plane) is collapsed out of the picture; the
  // corners in a loop no compiler can unroll (uNoUnroll): one copy of the chain. vP: the point of plane s, exact in the
  // grid (affine), where the fragment stage evaluates the map into the colour plane.
  const CARRY_VS = `
uniform vec2 uCenter; uniform vec2 uCenterLo; uniform vec2 uScale;
uniform vec4 uCGrid; uniform ivec2 uN; uniform float uLim;
out vec2 vP;
void main() {
  int tri = gl_VertexID / 3, cn = gl_VertexID - 3 * tri, cell = tri / 2, hf = tri - 2 * cell;
  ivec2 c = ivec2(cell % uN.x, cell / uN.x);
  vec2 q0 = vec2(0.0), q1 = q0, q2 = q0, p = q0;
  bool ok = true;
  for (int k = 0; k < max(3, uNoUnroll); k++) {
    if (k >= 3) break;
    ivec2 o = k == 0 ? ivec2(0) : k == 1 ? (hf == 0 ? ivec2(1, 0) : ivec2(1, 1)) : (hf == 0 ? ivec2(1, 1) : ivec2(0, 1));
    vec2 pk = uCGrid.xy + vec2(c + o) * uCGrid.zw, qk = mapPoint(pk);
    if (!cfin(qk)) ok = false;
    if (k == 0) q0 = qk; else if (k == 1) q1 = qk; else q2 = qk;
    if (k == cn) p = pk;
  }
  ok = ok && length(q0 - q1) <= uLim && length(q1 - q2) <= uLim && length(q2 - q0) <= uLim;
  vec2 q = cn == 0 ? q0 : cn == 1 ? q1 : q2;
  vP = p;
  gl_Position = ok ? vec4(((q - uCenter) - uCenterLo) * uScale, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}
`;
  // its fragment stage: the colour plane's colour at the point's image there, G = chainRange(p, uGs, uGt) (the plot's
  // style, dcolor), exact at every fragment; id: plane s is the colour plane (G the identity), a stage without the chain.
  // Where the map from plane s folds (several points on one pixel past the colour plane), the inverse path's sheet key
  // of the point (PRE_KEY, its depth) picks the one the exact image shows, not the grid's order
  // (key false: no key here, the vertex stage's depth orders the sheets: REGION_VS's carry option)
  // (pre: a pre-mapped mesh's vP, PAT_PRE's (ln |z|, arg z) * 16 / tau, or z itself where uPreZ is 1 (graph paper's
  // mesh), turned back into the source point; clip: REGION_VS's sheet option's vSide, a fragment past a cut its
  // triangle's branch was continued across left out)
  const CARRY_FS = (id, key = true, pre = false, clip = false) => `
uniform int uGs; uniform int uGt;
${key ? PRE_KEY_UNI : ''}in vec2 vP;
${pre ? 'uniform int uPreZ;\n' + PRE_SRC : ''}${clip ? 'in float vSide;\nflat in float vSideTol;\n' : ''}out vec4 o;
void main() {
${clip ? '  if (vSide < -vSideTol) discard;\n' : ''}  vec2 sa = ${pre ? 'uPreZ == 1 ? vP : preSrc(vP)' : 'vP'};
${key ? PRE_KEY : ''}  o = vec4(dcolor(${id ? 'sa' : 'chainRange(sa, uGs, uGt)'}), 1.0);
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
  // the Cauchy integral by the residue theorem (issue #235): Phi(z) = n(z) F(z) - sum_k n_k PP_k(z), n the winding number
  // of the curve about z (the signed crossings of the ray towards +x with the polygon's edges, an exact integer), PP_k the
  // principal part of F at its pole p_k inside (up to order 4, coefficients a_-1 ... a_-4 from the CPU). Outside the
  // curve n = 0 and Phi = -sum_k n_k PP_k, so a curve with no pole inside has an exactly neutral outside. A chain
  // program (mapF is F): it compiles for a chain when the style is first shown. Edges relative to an origin O (the
  // curve's centre), as the quadrature's nodes, so z - p keeps float32 precision near the curve.
  // uShow.x: 0 both halves, 1 only inside (f+), 2 only outside; uShow.y: the outside's sign, -1 f- = sum n PP (F = f+ + f-),
  // +1 the integral itself (-f-)
  const CAUCHYF_FS = `
uniform vec2 uCenter; uniform vec2 uRelC; uniform vec2 uInvScale; uniform vec4 uVp;
uniform highp sampler2D uEdges; uniform int uEdgeN;
uniform int uPoleN; uniform vec4 uPole[16]; uniform vec4 uCoef[32]; uniform vec2 uShow;
out vec4 o;
vec2 cmx(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  vec2 off = (gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw) * uInvScale;
  vec2 z = uCenter + off, zr = uRelC + off;
  int wn = 0;
  for (int j = 0; j < uEdgeN; j++) {
    vec4 e = texelFetch(uEdges, ivec2(j, 0), 0);
    float side = (e.z - e.x) * (zr.y - e.y) - (zr.x - e.x) * (e.w - e.y);
    if (e.y <= zr.y) { if (e.w > zr.y && side > 0.0) wn++; }
    else if (e.w <= zr.y && side < 0.0) wn--;
  }
  bool inside = wn != 0;
  vec3 grey = mix(uPlane, vec3(0.5), 0.6);
  if ((inside && uShow.x > 1.5) || (!inside && uShow.x > 0.5 && uShow.x < 1.5)) { o = vec4(grey, 1.0); return; }
  vec2 pp = vec2(0.0);
  for (int k = 0; k < max(16, uNoUnroll); k++) {   // (a bound no compiler can know: FXC links a loop, not 16 copies, #72)
    if (k >= uPoleN) break;
    vec4 P = uPole[k];
    vec2 d = zr - P.xy;
    float d2 = dot(d, d);
    if (d2 < 1e-20 * (1.0 + dot(P.xy, P.xy))) { o = vec4(grey, 1.0); return; }
    vec2 u = vec2(d.x, -d.y) / d2;
    vec2 t = u, s = cmx(uCoef[2 * k].xy, t);
    if (P.z > 1.5) { t = cmx(t, u); s += cmx(uCoef[2 * k].zw, t); }
    if (P.z > 2.5) { t = cmx(t, u); s += cmx(uCoef[2 * k + 1].xy, t); }
    if (P.z > 3.5) { t = cmx(t, u); s += cmx(uCoef[2 * k + 1].zw, t); }
    pp += P.w * s;
  }
  vec2 nf = inside ? float(wn) * mapF(z) : vec2(0.0);
  vec2 w = inside ? nf - pp : -uShow.y * pp;
  // a value that cancels to float32 rounding (F against its own principal parts) is 0: neutral, not noise
  if (!(wabs(w) > 4e-6 * (wabs(nf) + wabs(pp)))) { o = vec4(grey, 1.0); return; }
  o = vec4(dcolor(w), 1.0);
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
// formula fa (and fb when two) at w and at the first n - 1 of w + dx, w + dy, w - dx, w - dy, from one call site of
// formulaLevel in a loop (issue #396: FXC inlines every call of formulaLevel, the dispatch over every level function,
// and the gradients' calls one by one wrote them all out about 21 times). a, b: (w + dx, w + dy, w - dx, w - dy)
void levelStencil(int fa, int fb, bool two, int n, vec2 w, vec2 dx, vec2 dy, out float la, out vec4 a, out float lb, out vec4 b) {
  la = 0.0; lb = 0.0; a = vec4(0.0); b = vec4(0.0);
  int m = two ? 2 * n : n;
  for (int s = 0; s < max(10, uNoUnroll); s++) {
    if (s >= m) break;
    bool first = s < n;
    int k = first ? s : s - n;
    vec2 o = k == 1 ? dx : k == 2 ? dy : k == 3 ? -dx : k == 4 ? -dy : vec2(0.0);
    float v = formulaLevel(first ? fa : fb, w + o);
    // (plain assignments: a blend would turn a level that is already infinite into NaN, review #406)
    if (first) { if (k == 0) la = v; else if (k == 1) a.x = v; else if (k == 2) a.y = v; else if (k == 3) a.z = v; else a.w = v; }
    else { if (k == 0) lb = v; else if (k == 1) b.x = v; else if (k == 2) b.y = v; else if (k == 3) b.z = v; else b.w = v; }
  }
}
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
      float s0, s1;
      vec4 sa, sb;
      levelStencil(gi, gi + 1, K.w > 0.5, 5, w, dx, dy, s0, sa, s1, sb);
      if (K.w > 0.5) {
        vec2 D = vec2(s0, s1), Dx = vec2(sa.x, sb.x), Dy = vec2(sa.y, sb.y), Bx = vec2(sa.z, sb.z), By = vec2(sa.w, sb.w);
        vec4 dF = vec4(Dx - D, Dy - D), dB = vec4(D - Bx, D - By);
        float lf = length(dF), lb = length(dB), lm = max(lf, lb);
        if (!(length(D) < 1e30) || !(lm < 1e30) || length(dF - dB) > 0.5 * lm + 1e-30) continue;
        pd = length(D) / max(lm, 1e-30);
      } else {
        float L = s0;
        vec2 gF = sa.xy - L;
        vec2 gB = L - sa.zw;
        float lf = length(gF), lb = length(gB), lm = max(lf, lb);
        if (!(abs(L) < 1e30) || !(lm < 1e30) || length(gF - gB) > 0.5 * lm + 1e-30) continue;
        pd = abs(L) / max(lm, 1e-30);
      }
      float cov = 1.0;
      if (B.x > -0.5) {
        int ri = int(B.x + 0.5);
        float RL, rl;
        vec4 rs, rt;
        levelStencil(ri, ri, false, 3, w, dx, dy, RL, rs, rl, rt);
        vec2 gR = rs.xy - RL;
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


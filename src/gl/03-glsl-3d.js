  // ---------- landscape (spec 6.9) ----------
  const HEIGHT = `
uniform int uHMode; uniform float uH; uniform float uMu; uniform float uHClip;
// modes 8, 9 (a glide between two planes whose height functions differ, Re / Im): (1 - uMix) g_a + uMix g_b, g_a with the
// scale uMu and g_b with uMu2; bit 0 of uEndLin: g_a is linear (else (2/pi) atan), bit 1: g_b is
uniform float uMu2; uniform float uMix; uniform int uEndLin;
float endH(float x, float mu, bool lin, float lim) { return lin ? clamp(x / mu, -lim, lim) : (2.0 / PI) * atan(clamp(x / mu, -1e30, 1e30)); }
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
  if (uHMode == 8 || uHMode == 9) {
    float x = uHMode == 8 ? w.x : w.y;
    bool bad = uHMode == 8 ? nanx : nany;
    float lim = uHClip > 0.0 ? uHClip : 1.25, mu2 = uMu2 > 0.0 ? uMu2 : mu;
    return vec2(uH * ((1.0 - uMix) * endH(x, mu, (uEndLin & 1) != 0, lim) + uMix * endH(x, mu2, (uEndLin & 2) != 0, lim)), bad ? 0.0 : 1.0);
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
  // While something moves the levels may be a frame or two older than the heights (read back fenced, never waited for):
  // a cell that holds a real jump (LAND_EDGE_VS, the current heights') counts as level 0 in
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
  // The principal surface's chain pass, kept small (one call site of the chain): F and its height at the grid's
  // vertices (uPass 0: uN x uN over the box: the mesh, or the quarter / half cells of the refinement's lattice), or at
  // the points of uPq (uPass 1: the refined vertices and their normals' neighbours, LAND_RP_VS). Everything else of
  // the refinement is in programs without the chain (LAND_LV_VS, LAND_RP_VS, LAND_RA_VS), compiled once per page: a
  // formula's first Landscape compiles what it compiled before (a larger chain program held the GPU
  // process for 0.7 to 0.9 s at its first use).
  // The heights pass (uPass 0: the grid), the refinement's chain pass (uPass 1: the points in uPq) and, in the same
  // program, the edge pass (uPass 3, LAND_EDGE_VS's work for the cut kind this program was built for): one
  // call site of the chain, evalAt, in one loop whose trip count is a uniform, so the program stays about the size of
  // the height pass's and the edge pass costs no second program's link and first draw. kind 'P': the principal map
  // (mapF), for the cuts the sheets cannot continue (kind 2, bisection on the height step); 'S' / 'H': the
  // continuation of the stages' sheets (chainSheetRange) or the deformation's (chainSheetHom), for a chain whose every
  // cut is one the sheets continue (kind 1): the principal value at z is the continuation at its own centre, so the
  // heights come from the same call. (No return inside a loop: ANGLE's Metal translation lost results, LAND_EDGE_VS.)
  // 'N': mapF, no edge pass, its code compiled out (tfKind: the landTF the app builds unless it is 'S'; D3D11 links
  // the edge loop slowly)
  const LAND_TF_VS = (kind = 'P') => (kind === 'H' ? `
vec2 evalAt(vec2 zc, vec2 z) { return chainSheetHom(zc, z, uMode, uBase, uA, uHi, uB, uPost, uT, 0, 0); }
` : kind === 'S' ? `
uniform int uSheetA; uniform int uSheetB;
vec2 evalAt(vec2 zc, vec2 z) { return chainSheetRange(zc, z, uSheetA, uSheetB, 0); }
` : `
vec2 evalAt(vec2 zc, vec2 z) { return mapF(z); }
`) + `
uniform int uN; uniform vec4 uBox; uniform int uPass; uniform highp sampler2D uPq;
uniform highp sampler2D uT1; uniform int uDir; uniform int uSteps; uniform int uTwo;
const int uCutMode = ${kind === 'P' ? 2 : 1};
out vec4 tfOut;
vec2 zAt(ivec2 g) { return uBox.xy + vec2(g) / float(uN - 1) * uBox.zw; }
bool sameBranch(vec2 c, vec2 p) {
  float ac = wabs(c), ap = wabs(p);
  if (!(ac < 1e30) || !(ap < 1e30)) return true;
  return length(c - p) <= 1e-3 * (ac + ap) + 1e-20;
}
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  bool edge = ${kind === 'N' ? 'false' : 'uPass == 3'};
  vec4 none = vec4(0.5, 0.0, 0.0, 0.0);
  // the point of the height passes, or the edge's ends (p, q: +x, +y or the diagonal, uDir) and its bracket
  vec2 z0 = vec2(0.0), z1 = vec2(0.0), wLo = vec2(0.0), wHi = vec2(0.0), wB = vec2(0.0), wc = vec2(0.0), wp = vec2(0.0);
  float lo = 0.0, hi = 1.0, hLo = 0.0, hHi = 0.0, d0 = 0.0, d3 = 0.0, tol = 2e-3 * uH;
  bool jump = false, fin = true, twice = false, done = false;
  int n = 1;
  if (edge) {
    ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
    ivec2 q = p + (uDir == 0 ? ivec2(1, 0) : (uDir == 1 ? ivec2(0, 1) : ivec2(1, 1)));
    n = 0;
    if (q.x < uN && q.y < uN) {
      vec4 a = texelFetch(uT1, p, 0), b = texelFetch(uT1, q, 0);
      if (a.w > 0.5 && b.w > 0.5) {
        z0 = zAt(p); z1 = zAt(q);
        hLo = a.z; hHi = b.z; d0 = abs(b.z - a.z); d3 = d0;
        wLo = a.xy; wHi = b.xy; wB = b.xy; wc = wB; wp = wB;
        // kind S / H: step 0 the far end, step 1 the midpoint, then bisection while a cut is bracketed (two calls a
        // step after the first: the continuation from p, then the principal value, the continuation at zm's own
        // centre); kind 2: bisection, only on a height step
        jump = uCutMode == 2 && d0 > tol;
        n = uCutMode == 1 ? 1 + (uSteps + 1) * max(uTwo, 1) : (jump ? uSteps - 1 : 0);
      }
    }
  } else if (uPass == 1) z0 = texelFetch(uPq, ivec2(gl_VertexID & 2047, gl_VertexID >> 11), 0).xy;
  else z0 = uBox.xy + vec2(float(gl_VertexID % uN), float(gl_VertexID / uN)) / float(uN - 1) * uBox.zw;
  vec2 wOut = vec2(0.0);
  for (int it = 0; it < n; it++) {
    int k = it, r = 0, nr = 1;
    if (edge && uCutMode == 1 && it > 0) { nr = max(uTwo, 1); k = 1 + (it - 1) / nr; r = it - 1 - (k - 1) * nr; }
    float m = edge ? (uCutMode == 1 && k == 0 ? 1.0 : 0.5 * (lo + hi)) : 0.0;
    vec2 zm = edge ? mix(z0, z1, m) : z0;
    vec2 v = evalAt(edge && uCutMode == 1 && r == 0 ? z0 : zm, zm);
    if (!edge) { wOut = v; break; }
    if (uCutMode == 1) {
      if (r == 0) wc = v; else wp = v;
      if (r < nr - 1) continue;
      vec2 hp = heightW(wp);
      bool same = sameBranch(wc, wp);
      if (k == 0) {
        jump = !same;
        // (a flat edge, under a pixel of rise, is not looked at twice)
        if (!jump && !(d0 > tol)) done = true;
      } else if (k == 1 && !jump) {
        // (the far end on p's branch: a cut crossed twice shows at the midpoint, the bracket is then [0, 1/2])
        if (same) done = true;
        else { jump = true; twice = true; hi = m; if (hp.y > 0.5) hHi = hp.x; }
      } else if (jump) {
        if (same) { lo = m; if (hp.y > 0.5) hLo = hp.x; } else { hi = m; if (hp.y > 0.5) hHi = hp.x; }
      }
      // (a step's values start from the far end's, the height pass's principal value there, as LAND_EDGE_VS's do)
      wc = wB; wp = wB;
    } else {
      wp = v;
      vec2 hp = heightW(wp);
      if (!(hp.y > 0.5)) { fin = false; done = true; }
      else {
        if (abs(hp.x - hLo) >= abs(hHi - hp.x)) { hi = m; hHi = hp.x; wHi = wp; } else { lo = m; hLo = hp.x; wLo = wp; }
        // (a continuous rise shrinks under bisection, by 8 over three halvings where it is smooth: stop early)
        if (k == 2) { d3 = abs(hHi - hLo); if (d3 < 0.2 * d0) { jump = false; done = true; } }
      }
    }
    if (done) break;
  }
  if (!edge) {
    vec2 hv = heightW(wOut);
    vec2 wcl = vec2(isnan(wOut.x) ? 1.0 : clamp(wOut.x, -3e38, 3e38), isnan(wOut.y) ? 0.0 : clamp(wOut.y, -3e38, 3e38));
    tfOut = vec4(wcl, hv.y > 0.5 ? hv.x : 0.0, hv.y);
    return;
  }
  if (uCutMode == 1) {
    // (a step that vanishes at the crossing is no discontinuity of the height: Re of a root across its cut)
    jump = jump && abs(hHi - hLo) > tol;
  } else {
    float big = 1e3 * max(max(uMu, uMu2), 1e-30);
    jump = jump && fin && abs(hHi - hLo) > 0.6 * d3 && abs(hHi - hLo) > 0.02 * uH && !(wabs(wLo) > big && wabs(wHi) > big);
  }
  // (w 2: the edge crosses a cut twice, or two cuts: its triangles are left out, LAND_VS)
  tfOut = jump ? vec4(0.5 * (lo + hi), hLo, hHi, twice ? 2.0 : 1.0) : none;
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
// (#72, #414: a bound no compiler can know keeps the four cells' loop a loop: one copy of the cell's body for FXC,
// which unrolled four, each with its 5 x 5 lattice and levelsLat's loops)
uniform highp int uNoUnroll;
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  // (uJ0: the first row of cells of this strip; uLp holds the lattice's rows from s uJ0 on)
  int Mq = (uM + 3) / 4, q = gl_VertexID % Mq, j = uJ0 + gl_VertexID / Mq, s = uLat == 1 ? 4 : 2;
  float lv[4]; float lat[25];
  for (int k = 0; k < max(4, uNoUnroll); k++) {
    if (k >= 4) break;
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
  // about the size of the height pass's and compiles about as fast. No return inside a loop:
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
    float big = 1e3 * max(max(uMu, uMu2), 1e-30);
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
  // ambient occlusion at grid vertex p of height h: how far the 9x9 box of finite heights around it (the heights in
  // uT1's z, finite where w > 0.5) rises above it, darkening by up to 0.4 (LAND_NRM_VS, LAND_CARRY_NRM_VS)
  const LAND_AO = `
float landAO(ivec2 p, float h) {
  float sum = 0.0, cnt = 0.0;
  for (int dy = -4; dy <= 4; dy++) for (int dx = -4; dx <= 4; dx++) {
    ivec2 q = p + ivec2(dx, dy);
    if (q.x < 0 || q.y < 0 || q.x >= uN || q.y >= uN) continue;
    vec4 t = texelFetch(uT1, q, 0);
    if (t.w > 0.5) { sum += t.z; cnt += 1.0; }
  }
  return cnt > 0.0 ? 1.0 - clamp(6.0 * (sum / cnt - h), 0.0, 0.4) : 1.0;
}
`;
  // normals by central differences (one-sided across a real jump, LAND_EDGE_VS) and ambient occlusion from a 9x9 box
  // filter (LAND_AO)
  // The cut edges of a grid, found into uE0 (the edge from p to p + (1, 0)) and uE1 (to p + (0, 1)) when uCuts is 1: cutX(p) and
  // cutY(p) tell whether that edge crosses a cut, so a normal there is one-sided on the vertex's own bank
  const LAND_CUT_EDGES = `
uniform highp sampler2D uE0; uniform highp sampler2D uE1; uniform int uCuts;
bool cutX(ivec2 p) { return uCuts > 0 && texelFetch(uE0, p, 0).w > 0.5; }
bool cutY(ivec2 p) { return uCuts > 0 && texelFetch(uE1, p, 0).w > 0.5; }
`;
  const LAND_NRM_VS = `
uniform highp sampler2D uT1; uniform int uN; uniform vec2 uAspect; uniform float uH;
out vec4 tfOut;
` + LAND_CUT_EDGES + LAND_AO + `
vec4 T(ivec2 p) { return texelFetch(uT1, p, 0); }
// (uCuts -1: the edge pass still compiles, the former rule stands in: a height step over 0.3 H)
bool jx(ivec2 p) { return cutX(p) || (uCuts < 0 && abs(T(p + ivec2(1, 0)).z - T(p).z) > 0.3 * uH); }
bool jy(ivec2 p) { return cutY(p) || (uCuts < 0 && abs(T(p + ivec2(0, 1)).z - T(p).z) > 0.3 * uH); }
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
  float ao = landAO(p, h);
  tfOut = vec4(n, c.w > 0.5 ? ao : 1.0);
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;
  // The steps view's carried landscape: plane s's grid over the box uSrc (uN x uN), each vertex at its image
  // under the glide's map from plane s (mapPoint: uBase = s) and at the height of the stages (uGs, uGt] there (s to
  // the plane the heights read, hT), so every point keeps its height while the plane moves. When the glide's far plane
  // reads its heights from another plane (uGt2, hT2: across a d/dz step), the height is blended linearly over uHu from
  // the first to the second, each end exactly its plane's (a point is kept where the end it is nearer to has a height).
  // tfOut: (place x, y, height, finite).
  // The carried grid's point of plane s at grid place ij (0 to uN - 1 each way): over the box uSrc, or, with uPolar
  // (pole x, y, r0, r1; r1 > 0), a patch about a pole of the glide's map: the angle once round clockwise with i (so its
  // triangles wind as the box's do, and face the same way), the radius from r0 to r1 geometrically with j. It covers,
  // with small cells, the far plane the pole's neighbourhood is carried to, where the box's cells stretch past uLim and
  // are left out
  // polarAt(P, ij, f): the place of patch P (x, y, r0, r1) at grid place ij, f the grid's spacing 1 / (N - 1)
  const POLAR_AT = `
vec2 polarAt(vec4 P, vec2 ij, float f) {
  float th = -6.283185307179586 * ij.x * f, r = P.z * pow(P.w / P.z, ij.y * f);
  return P.xy + r * vec2(cos(th), sin(th));
}
`;
  const CARRY_ZIN = POLAR_AT + `
uniform vec4 uPolar;
vec2 carryZIn(vec4 src, vec2 ij) {
  float f = 1.0 / float(uN - 1);
  if (uPolar.w <= 0.0) return src.xy + ij * f * src.zw;
  return polarAt(uPolar, ij, f);
}
`;
  const CARRY_Z = CARRY_ZIN + `
vec2 carryZ(vec2 ij) { return carryZIn(uSrc, ij); }
`;
  // the carried height of the point z of plane uGs: heightW of the stages (uGs, uGt], blended over uHu into that of (uGs, uGt2];
  // where only one of the two is finite, the nearer end's (needs uGs, uGt and chainRange)
  const CARRY_HEIGHT = `
uniform int uGt2; uniform float uHu;
vec2 carryHeight(vec2 z) {
  vec2 hv = heightW(chainRange(z, uGs, uGt));
  if (uGt2 == uGt) return hv;
  vec2 h2 = heightW(chainRange(z, uGs, uGt2));
  bool both = hv.y > 0.5 && h2.y > 0.5;
  return uHu >= 1.0 ? h2 : uHu <= 0.0 ? hv : both ? vec2(mix(hv.x, h2.x, uHu), 1.0) : uHu < 0.5 ? hv : h2;
}
`;
  // the same heights with the cuts of the steps placed opposite the point zc, a point of the same layer (the layer's own
  // branch continued from zc: chainSheetRange digit uOwn), so a point just past its branch's range keeps the layer's
  // surface; the layered glide's programs
  const CARRY_HEIGHT_ANCHORED = `
uniform int uOwn;
vec2 carryWA(vec2 zc, vec2 z, int b) { return chainSheetRange(zc, z, uGs, b, uOwn); }
vec2 carryHeightA(vec2 zc, vec2 z) {
  vec2 hv = heightW(carryWA(zc, z, uGt));
  if (uGt2 == uGt) return hv;
  vec2 h2 = heightW(carryWA(zc, z, uGt2));
  bool both = hv.y > 0.5 && h2.y > 0.5;
  return uHu >= 1.0 ? h2 : uHu <= 0.0 ? hv : both ? vec2(mix(hv.x, h2.x, uHu), 1.0) : uHu < 0.5 ? hv : h2;
}
`;
  const LAND_CARRY_TF_VS = `
uniform int uN; uniform vec4 uSrc; uniform int uGs; uniform int uGt;
out vec4 tfOut;
` + CARRY_Z + CARRY_HEIGHT + `
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vec2 z = carryZ(vec2(float(gl_VertexID % uN), float(gl_VertexID / uN)));
  vec2 q = mapPoint(z), hv = carryHeight(z);
  tfOut = cfin(q) && hv.y > 0.5 ? vec4(q, hv.x, 1.0) : vec4(0.0);
}
`;
  // the carried All sheets' places: plane s's grid over the box uSrc (uN x uN) moved by the glide's map (mapPoint, uBase =
  // s), without a height: (place x, y, 0, finite). The sheets keep their heights at plane s, of the stages (s, hT]
  // (LAND_SHEET_VS, uCarry 1 reads these places). With uPolar (CARRY_Z) the grid is a pole's patch
  const LAND_CARRY_PLACE_TF_VS = `
uniform int uN; uniform vec4 uSrc;
out vec4 tfOut;
` + CARRY_Z + `
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vec2 z = carryZ(vec2(float(gl_VertexID % uN), float(gl_VertexID / uN)));
  vec2 q = mapPoint(z);
  tfOut = cfin(q) ? vec4(q, 0.0, 1.0) : vec4(0.0);
}
`;
  // its normals: central differences of the moved points in the block (one-sided where a neighbour is not finite, is
  // across a tear (a step over uLim on the plane) or a height step over uStep), and the occlusion of the heights over
  // the grid (LAND_AO, as at rest)
  const LAND_CARRY_NRM_VS = `
uniform highp sampler2D uT1; uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uStep; uniform float uLim;
uniform float uPatch;
out vec4 tfOut;
` + LAND_CUT_EDGES + LAND_AO + `
vec4 T(ivec2 p) { return texelFetch(uT1, clamp(p, ivec2(0), ivec2(uN - 1)), 0); }
vec3 placeOf(vec4 t) { return vec3(((t.xy - uBox.xy) / uBox.zw - 0.5) * 2.0 * uAspect, t.z); }
bool near(vec4 a, vec4 b) { return b.w > 0.5 && length(b.xy - a.xy) <= uLim && abs(b.z - a.z) <= uStep; }
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  vec4 c = T(p);
  if (c.w < 0.5) { tfOut = vec4(0.0, 0.0, 1.0, 1.0); return; }
  vec4 L = T(p - ivec2(1, 0)), R = T(p + ivec2(1, 0)), D = T(p - ivec2(0, 1)), U = T(p + ivec2(0, 1));
  bool oL = p.x > 0 && near(c, L) && !cutX(p - ivec2(1, 0)), oR = p.x < uN - 1 && near(c, R) && !cutX(p);
  bool oD = p.y > 0 && near(c, D) && !cutY(p - ivec2(0, 1)), oU = p.y < uN - 1 && near(c, U) && !cutY(p);
  vec3 P0 = placeOf(c);
  vec3 dx = (oR ? placeOf(R) : P0) - (oL ? placeOf(L) : P0), dy = (oU ? placeOf(U) : P0) - (oD ? placeOf(D) : P0);
  vec3 n = cross(dx, dy);
  n = length(n) > 1e-20 ? normalize(n) : vec3(0.0, 0.0, 1.0);
  // (no occlusion on a patch (CARRY_Z): its 9 x 9 neighbours span radii many times apart, not a neighbourhood)
  tfOut = vec4(n, uPatch > 0.5 ? 1.0 : landAO(p, c.z));
}
`;
  // The block's clip, shared by the sheets' mesh (LAND_SHEET_VS) and the layered glide's (LAND_CARRY_VS): a convex polygon of up
  // to 5 corners, Q (x, y: the grid's or the plane's position, which orders an edge's ends; z: the height), with a payload A
  // mixed along an edge like the position, a normal Nn and a flag Fl (0 a corner, +1 / -1 on the top / bottom of the block),
  // cut at |h| = BLOCK_K H. The crossing of an edge with a corner far beyond the block, both ends on its side (a pole), is
  // interpolated in 1 / h, exact to first order at a simple pole, where linear interpolation hugs the near corner. The clipped
  // edges are marked by clipBoxE (the rim). Returns the number of corners left
  const BLOCK_K = 1.25;   // the block's height bound in block heights H: |h| <= BLOCK_K H (the clip, the layered draw's discard and the cap probe read this one value)
  const LAND_CLIP = `
const float BLOCK_K = ${BLOCK_K.toFixed(4)};
uniform int uClipLinear;   // (a test control: 1 takes every crossing linearly)
const float CLIP_FAR = 2.0;   // (corners farther than this many block edges beyond the block use the 1 / h crossing)
int blockClip(float Hb, int n, inout vec3 Q[5], inout vec4 A[5], inout vec3 Nn[5], inout float Fl[5]) {
  for (int pass = 0; pass < 2; pass++) {
    float s = pass == 0 ? 1.0 : -1.0;
    vec3 R[5]; vec4 RA[5]; vec3 RN[5]; float RF[5];
    for (int i = 0; i < 5; i++) { R[i] = vec3(0.0); RA[i] = vec4(0.0); RN[i] = vec3(0.0, 0.0, 1.0); RF[i] = 0.0; }
    int m = 0;
    for (int i = 0; i < 5; i++) {
      if (i >= n) break;
      int j = i + 1 == n ? 0 : i + 1;
      bool inI = s * Q[i].z <= Hb, inJ = s * Q[j].z <= Hb;
      if (inI) { R[m] = Q[i]; RA[m] = A[i]; RN[m] = Nn[i]; RF[m] = Fl[i]; m++; }
      if (inI != inJ) {
        // (from the lower end in grid order, so the two triangles of an edge find the same point)
        bool fw = Q[i].x < Q[j].x || (Q[i].x == Q[j].x && Q[i].y < Q[j].y);
        vec3 a = fw ? Q[i] : Q[j], b = fw ? Q[j] : Q[i];
        vec4 aa = fw ? A[i] : A[j], ab = fw ? A[j] : A[i];
        vec3 na = fw ? Nn[i] : Nn[j], nb = fw ? Nn[j] : Nn[i];
        float t = uClipLinear == 0 && s * a.z > 0.0 && s * b.z > 0.0 && max(abs(a.z), abs(b.z)) > CLIP_FAR * Hb
          ? (1.0 / (s * Hb) - 1.0 / a.z) / (1.0 / b.z - 1.0 / a.z) : (s * Hb - a.z) / (b.z - a.z);
        t = clamp(t, 0.0, 1.0);
        R[m] = vec3(mix(a.xy, b.xy, t), s * Hb); RA[m] = mix(aa, ab, t); RN[m] = normalize(mix(na, nb, t) + vec3(0.0, 0.0, 1e-6)); RF[m] = s; m++;
      }
    }
    for (int i = 0; i < 5; i++) { Q[i] = R[i]; A[i] = RA[i]; Nn[i] = RN[i]; Fl[i] = RF[i]; }
    n = m;
  }
  return n;
}
// the rim flags of the fan's triangle (0, i1, i2): a polygon edge whose two ends lie on the same plane of the block
vec3 clipBoxE(int i1, int i2, int n, float Fl[5]) {
  return vec3(Fl[i1] != 0.0 && Fl[i1] == Fl[i2] ? 1.0 : 0.0,
              i2 == n - 1 && Fl[i2] != 0.0 && Fl[i2] == Fl[0] ? 1.0 : 0.0,
              i1 == 1 && Fl[0] != 0.0 && Fl[0] == Fl[i1] ? 1.0 : 0.0);
}
`;
  // its draw: two triangles a cell (gl_VertexID), each corner at its moved place in the block over uBox; a triangle
  // with a corner not finite, an edge over uLim on the plane (torn across a cut or a pole of the glide's map) or a
  // height step over uStep (a cut of G, which the edge passes split at rest) is left out. uStep is 0.3 H for the
  // heights Re F and Im F, which step at a cut; ln |F| and |F| do not (a branch changes F's phase, not its size), and
  // there a steep pole wall is drawn as at rest (uStep infinite). vZ is the point of plane s, where the fragment stage
  // evaluates G exactly (LAND_FS's carry form)
  const LAND_CARRY_VS = (L = false, clip = false) => (clip ? LAND_CLIP : '') + `
uniform highp sampler2D uT1; uniform highp sampler2D uT2;
uniform int uN; uniform vec4 uBox; uniform vec4 uSrc; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP; uniform float uLim;
uniform float uStep;
// uZOn 1: each vertex's z is its texel of uZ (the exact glide's preimages), else carryZ's grid point
uniform highp sampler2D uZ; uniform int uZOn;
// uCuts 1 (the exact glide, whose cuts LAND_CARRY_EDGE_VS found into uE0, uE1, uE2): a triangle is drawn as LAND_VS draws
// it, 9 vertices each (uPer 9); else 3
uniform highp sampler2D uE0; uniform highp sampler2D uE1; uniform highp sampler2D uE2;
uniform int uCuts; uniform int uPer;
// uDrawCode over 0: only the triangles on that sheet (LAND_CARRY_FIX_VS), whose colour the draw's chain data is of
uniform float uDrawCode; uniform float uDrawCode0;
// the box's triangles whose centre is within uHoles[i].z of uHoles[i].xy are left out (uNHoles of them): polar patches draw there
uniform vec4 uHoles[4]; uniform int uNHoles;
out vec2 vZ; out vec2 vW; out vec3 vPos; out vec3 vNor; out float vAO; out vec3 vBary;
flat out vec3 vEdge; flat out vec3 vBoxE; flat out vec2 vZc; flat out float vCell;
` + CARRY_Z + `
// the jump data of the grid segment a -> b oriented from a: (t, height on a's bank, on b's bank, jump)
vec4 edgeOf(ivec2 a, ivec2 b) {
  if (uCuts <= 0) return vec4(0.5, 0.0, 0.0, 0.0);
  ivec2 d = b - a;
  bool rev = d.x < 0 || d.y < 0;
  ivec2 o = rev ? b : a, ad = abs(d);
  vec4 e = ad.y == 0 ? texelFetch(uE0, o, 0) : (ad.x == 0 ? texelFetch(uE1, o, 0) : texelFetch(uE2, o, 0));
  return rev ? vec4(1.0 - e.x, e.z, e.y, e.w) : e;
}
void main() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vEdge = vec3(0.0); vBoxE = vec3(0.0); vW = vec2(0.0); vZc = vec2(0.0);
  int M = uN - 1;
  int tri = gl_VertexID / uPer, loc = gl_VertexID - uPer * tri, cell = tri / 2, hf = tri - 2 * cell;
  vCell = uPolar.w > 0.0 ? -1.0 - float(cell) : float(cell);   // (the cap probe's cell index: a box cell is >= 0, a polar patch's cell is -1 - cell)
${clip ? '  // (clip: each sub-triangle is a fan of up to 3 triangles of the block-clipped polygon, 9 vertices)\n  int sub = loc / 9, fan = (loc - 9 * sub) / 3, k = loc - 9 * sub - 3 * fan;' : '  int sub = loc / 3, k = loc - 3 * sub;'}
  ivec2 c = ivec2(cell % M, cell / M);
  ivec2 V0 = c, V1 = hf == 0 ? c + ivec2(1, 0) : c + ivec2(1, 1), V2 = hf == 0 ? c + ivec2(1, 1) : c + ivec2(0, 1);
  vec4 t0 = texelFetch(uT1, V0, 0), t1 = texelFetch(uT1, V1, 0), t2 = texelFetch(uT1, V2, 0);
  if (t0.w < 0.5 || t1.w < 0.5 || t2.w < 0.5) return;
${L ? `  // (layered: a triangle is a layer's when its corners are all placed on it, own or continued, and one is own; its
  // colour is continued from that corner)
  if (t0.w < 5.0 || t1.w < 5.0 || t2.w < 5.0) return;
  bool o0 = t0.w < uDrawCode0 + 0.1, o1 = t1.w < uDrawCode0 + 0.1, o2 = t2.w < uDrawCode0 + 0.1;
  if (!(o0 || o1 || o2)) return;
  vZc = texelFetch(uZ, o0 ? V0 : (o1 ? V1 : V2), 0).xy;` : ''}
  if (length(t0.xy - t1.xy) > uLim || length(t1.xy - t2.xy) > uLim || length(t2.xy - t0.xy) > uLim) return;
  if (uPolar.w <= 0.0) {
    vec2 ctr = (t0.xy + t1.xy + t2.xy) / 3.0;
    for (int i = 0; i < 4; i++) if (i < uNHoles && length(ctr - uHoles[i].xy) < uHoles[i].z) return;
  }
  if (max(max(t0.z, t1.z), t2.z) - min(min(t0.z, t1.z), t2.z) > uStep) return;
  if (uDrawCode > 0.0) {
    float cc = t0.w > 5.0 ? t0.w : (t1.w > 5.0 ? t1.w : (t2.w > 5.0 ? t2.w : uDrawCode0));
    if (abs(cc - uDrawCode) > 0.5) return;
  }
  // (rotate, winding kept: one jump on AB, or two on AB and AC with BC whole; three, or an edge crossed twice: left out)
  vec4 e01 = edgeOf(V0, V1), e12 = edgeOf(V1, V2), e20 = edgeOf(V2, V0);
  bool j01 = e01.w > 0.5, j12 = e12.w > 0.5, j20 = e20.w > 0.5;
  int J = int(j01) + int(j12) + int(j20);
  if (max(max(e01.w, e12.w), e20.w) > 1.5) return;
  int r = J == 1 ? (j01 ? 0 : (j12 ? 1 : 2)) : (J == 2 ? (!j12 ? 0 : (!j20 ? 1 : 2)) : 0);
  ivec2 A = r == 0 ? V0 : (r == 1 ? V1 : V2), B = r == 0 ? V1 : (r == 1 ? V2 : V0), C = r == 0 ? V2 : (r == 1 ? V0 : V1);
  // a corner of sub-triangle sub (kk 0, 1, 2): a grid corner (src) or the crossing on A -> B / A -> C (x 1 / 2) on the bank of corner src
  ivec2 srcs[3], xos[3]; int xs[3]; vec3 vEd = vec3(0.0);
  for (int kk = 0; kk < 3; kk++) {
    ivec2 src = A, xo = A; int x = 0;
    if (J == 0) { if (sub > 0) return; src = kk == 0 ? A : (kk == 1 ? B : C); }
    else if (J == 1) {
      if (sub > 1) return;
      if (sub == 0) { src = A; x = kk == 1 ? 1 : 0; if (kk == 2) src = C; vEd = vec3(1.0, 0.0, 0.0); }
      else { src = kk == 0 ? B : (kk == 1 ? B : C); x = kk == 0 ? 1 : 0; vEd = vec3(0.0, 1.0, 0.0); }
    } else if (J == 3) {
      // (every edge crossed, where the cuts meet: each corner has its own piece, cut off by the chord between the crossings on its two edges)
      if (sub > 2) return;
      src = sub == 0 ? A : (sub == 1 ? B : C);
      xo = kk == 1 ? (sub == 0 ? B : (sub == 1 ? C : A)) : (sub == 0 ? C : (sub == 1 ? A : B));
      x = kk == 0 ? 0 : 1; vEd = vec3(1.0, 0.0, 0.0);
    } else {
      if (sub == 0) { src = A; x = kk; vEd = vec3(1.0, 0.0, 0.0); }
      else if (sub == 1) { src = kk == 0 ? B : (kk == 1 ? B : C); x = kk == 0 ? 1 : 0; }
      else { src = kk == 0 ? B : C; x = kk == 0 ? 1 : (kk == 2 ? 2 : 0); vEd = vec3(0.0, 1.0, 0.0); }
    }
    srcs[kk] = src; xs[kk] = x; xos[kk] = xo;
  }
  // (layered: a layer's cut separates its bank from the same surface in the next layer, as between the parked sheets, which draw no cut ink)
  vEdge = ${L ? 'vec3(0.0)' : 'vEd'};
  // the corner's place xy, preimage z, height h and normal data nv
  vec2 cxy[3], cz[3]; float ch[3]; vec4 cnv[3];
  for (int kk = 0; kk < 3; kk++) {
    if (!(${clip ? 'true' : 'kk == k'})) continue;
    ivec2 src = srcs[kk], xo = xos[kk]; int x = xs[kk];
    vec4 t = texelFetch(uT1, src, 0);
    cnv[kk] = texelFetch(uT2, src, 0);
    cxy[kk] = t.xy; cz[kk] = uZOn == 1 ? texelFetch(uZ, src, 0).xy : carryZ(vec2(src));
    ch[kk] = t.z;
    if (x > 0) {
      ivec2 F = J == 3 ? src : A, E = J == 3 ? xo : (x == 1 ? B : C);
      vec4 e = edgeOf(F, E);
      cxy[kk] = mix(texelFetch(uT1, F, 0).xy, texelFetch(uT1, E, 0).xy, e.x);
      cz[kk] = mix(texelFetch(uZ, F, 0).xy, texelFetch(uZ, E, 0).xy, e.x);
      ch[kk] = src == F ? e.y : e.z;
    }
  }
${clip ? `  vec3 Q[5]; vec4 QA[5]; vec3 Nn[5]; float Fl[5];
  for (int i = 0; i < 5; i++) { Q[i] = vec3(0.0); QA[i] = vec4(0.0); Nn[i] = vec3(0.0, 0.0, 1.0); Fl[i] = 0.0; }
  for (int i = 0; i < 3; i++) { Q[i] = vec3(cxy[i], ch[i]); QA[i] = vec4(cz[i], cnv[i].w, 0.0); Nn[i] = cnv[i].xyz; }
  int n = blockClip(BLOCK_K * uH, 3, Q, QA, Nn, Fl);
  if (fan + 2 >= n) return;
  int i1 = fan + 1, i2 = fan + 2, vi = k == 0 ? 0 : (k == 1 ? i1 : i2);
  vBoxE = clipBoxE(i1, i2, n, Fl);
  vZ = QA[vi].xy;
  vPos = vec3(((Q[vi].xy - uBox.xy) / uBox.zw - 0.5) * 2.0 * uAspect, Q[vi].z);
  vNor = Nn[vi]; vAO = QA[vi].z;` : `  vZ = cz[k];
  vPos = vec3(((cxy[k] - uBox.xy) / uBox.zw - 0.5) * 2.0 * uAspect, ch[k]);
  vNor = cnv[k].xyz; vAO = cnv[k].w;`}
  // (the anchor of the sheet-continued colour is the first corner of this piece: the piece beyond a cut is on the other bank, whose value
  // the cut separates from the first piece's; layered: the bank's corner when it is the layer's own, else the triangle's first own corner)
  ivec2 anchor = J == 3 ? (sub == 0 ? A : (sub == 1 ? B : C)) : ((J == 1 && sub == 1) || (J == 2 && sub >= 1) ? B : A);
${L ? '  if (texelFetch(uT1, anchor, 0).w < uDrawCode0 + 0.1) vZc = texelFetch(uZ, anchor, 0).xy;' : '  vZc = uZOn == 1 ? texelFetch(uZ, anchor, 0).xy : vZ;'}
  vBary = k == 0 ? vec3(1.0, 0.0, 0.0) : (k == 1 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  gl_Position = uMVP * vec4(vPos, 1.0);
}
`;
  // The exact glide's sheets: a vertex found by the inverse walk keeps the preimage z, but its step sheet is the one whose
  // glide, applied to z, lands on its place (a walk accepts a member a little past its sheet's range, where the forward
  // chain's principal branch is one sheet over). With the chain data of one sheet (uCode), a vertex not yet placed
  // whose glide image of z is within uTol of the place's size (|q - w| / (1 + |w|)) takes that sheet's height. The
  // texel's w is 1 for a vertex not placed on a sheet, else uCode
  const LAND_CARRY_FIX_VS = `
uniform int uN; uniform int uGs; uniform int uGt; uniform float uCode; uniform float uTol;
uniform highp sampler2D uT1; uniform highp sampler2D uZ;
out vec4 tfOut;
` + CARRY_HEIGHT + `
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  vec4 t = texelFetch(uT1, p, 0);
  tfOut = t;
  if (t.w < 0.5 || t.w > 5.0) return;
  vec2 z = texelFetch(uZ, p, 0).xy, q = mapPoint(z), h = carryHeight(z);
  if (h.y > 0.5 && cfin(q) && length(q - t.xy) <= uTol * (1.0 + length(t.xy))) tfOut = vec4(t.xy, h.x, uCode);
}
`;
  // The exact glide's cuts: one texel per grid edge (+x, +y, diagonal; uDir) of the glide's grid (uT1: place, height,
  // finite; uZ: the preimage of each place), as LAND_EDGE_VS finds a principal surface's: (t, height at the edge's
  // a end of the cut, at its b end, jump). The edge's preimages are joined by a chord and the height there bisected
  // while it steps: a step the bisection does not shrink, between heights that are not a pole's wall, is a cut. Only
  // the edges whose two vertices are on the sheet uCode (the texel's w, LAND_CARRY_FIX_VS) are looked at, with that
  // sheet's chain data; an edge whose end heights are not the chain's at its preimages has none. The edges whose ends are on
  // different sheets, or on none, have their own test (uCode -1)
  // The member-seam test of the exact glide's edge pass: the places of an edge are carried SEAM_NEWT_CONT equal steps of the place
  // by SEAM_NEWT_POL Newton iterations each; the preimages are one member when the carried one is within SEAM_REL of their
  // distance (plus SEAM_ABS, relative to |z|) of the other; an edge whose preimages are within SEAM_FAR times the
  // distance one member's derivative gives them is one member and is not tested
  // the place a sheet carried along a cross-sheet edge may miss the far end's by, relative to 1 + |w| (the tests' hook tolerance)
  const CROSS_REL = '1.5e-3';
  // a vertex placed on the glide's i-th sheet has texel w CARRY_SHEET_CODE + i; the cross-sheet edge test reads the combos of at most CARRY_SHEETS_MAX sheets
  const CARRY_SHEET_CODE = 10, CARRY_SHEETS_MAX = 16;
  const CARRY_ANCHOR_STEP = 0.01;   // (a continued texel's code is CARRY_CONT_CODE plus this times the 1-based place of its anchor in the 3 x 3 neighbourhood: LAND_CARRY_CONT_VS, landFrameVerts)
  const SEAM_NEWT_CONT = 2, SEAM_NEWT_POL = 4, SEAM_REL = '0.1', SEAM_ABS = '1e-5', SEAM_FAR = '4.0';
  const LAND_CARRY_EDGE_VS = (L = false) => `
uniform int uN; uniform int uDir; uniform int uSteps; uniform int uGs; uniform int uGt; uniform float uCode; uniform int uUsePrev; uniform int uSeam;
uniform int uSheetCombos[${CARRY_SHEETS_MAX}]; uniform int uCrossOn; uniform int uMidOn;
uniform highp sampler2D uT1; uniform highp sampler2D uZ; uniform highp sampler2D uE0;
out vec4 tfOut;
` + CARRY_HEIGHT + (L ? CARRY_HEIGHT_ANCHORED + `
// (layered: heights and places of a point of the edge, continued from the edge's own end eZc)
// (an edge between two own vertices: the layer's own cut may run between them, so its heights are the fixed cut's)
vec2 eZc; bool eFixed;
vec2 edgeH(vec2 z) { return eFixed ? carryHeight(z) : carryHeightA(eZc, z); }
vec2 edgeW(vec2 z) { return eFixed ? chainRange(z, uGs, uGt) : carryWA(eZc, z, uGt); }
` : `
vec2 edgeH(vec2 z) { return carryHeight(z); }
vec2 edgeW(vec2 z) { return chainRange(z, uGs, uGt); }
`) + `
// the preimage of the place w nearest z on the glide's own map (Newton's method with a central-difference derivative)
vec2 seamNewt(vec2 z, vec2 w) {
  for (int i = 0; i < ${SEAM_NEWT_POL}; i++) {
    float h = 1e-6 * (1.0 + length(z));
    vec2 q = mapPoint(z), d = (mapPoint(z + vec2(h, 0.0)) - mapPoint(z - vec2(h, 0.0))) / (2.0 * h);
    float dd = dot(d, d);
    if (!(dd > 0.0) || !cfin(q)) return z;
    vec2 r = q - w;
    z -= vec2(r.x * d.x + r.y * d.y, r.y * d.x - r.x * d.y) / dd;
  }
  return z;
}
// the preimage z0 of the place wa carried to the place wb in ${SEAM_NEWT_CONT} equal steps of the place; zMid: the first step's end
vec2 seamCont(vec2 z0, vec2 wa, vec2 wb, out vec2 zMid) {
  vec2 z = z0;
  zMid = z0;
  for (int k = 1; k <= ${SEAM_NEWT_CONT}; k++) {
    z = seamNewt(z, mix(wa, wb, float(k) / float(${SEAM_NEWT_CONT})));
    if (k == 1) zMid = z;
  }
  return z;
}
// where on its edge a bisection puts the cut (uMidOn 1, a test switch: the middle)
float cutShare(float lo, float hi) { return uMidOn == 1 ? 0.5 : 0.5 * (lo + hi); }
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  tfOut = vec4(0.5, 0.0, 0.0, 0.0);
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  // (uUsePrev: the edges an earlier sheet's pass found, in uE0, are kept)
  if (uUsePrev == 1) { vec4 e = texelFetch(uE0, p, 0); if (e.w > 0.5) { tfOut = e; return; } }
  ivec2 q = p + (uDir == 0 ? ivec2(1, 0) : (uDir == 1 ? ivec2(0, 1) : ivec2(1, 1)));
  if (q.x >= uN || q.y >= uN) return;
  vec4 a = texelFetch(uT1, p, 0), b = texelFetch(uT1, q, 0);
  // (uCode -1: an edge whose ends are not on one sheet: on two sheets, or on one and on none. The sheet of one end (a placed
  // one first) is carried along the edge from that end's preimage to the other's, by the anchored chain, and read against
  // the other end's own value there: its sheet's at its preimage, or its place where it is on none. The edge is
  // continuous where they agree (the sheets' labels change at cuts of their own, not of the map). Where they do not, it
  // crosses a cut, which is bisected along the chord of the preimages. A carried value that is not finite (a branch point on
  // the edge), or a sheet code outside the combos, leaves the edge crossed twice, which drops the triangles that hold it)
  if (uCode < 0.0) {
    if (uCrossOn == 0) return;
    bool pa = a.w > 5.0, pb = b.w > 5.0;
    if ((!pa && !pb) || (pa && pb && abs(a.w - b.w) < 0.5)) return;
    vec2 zp = texelFetch(uZ, p, 0).xy, zq = texelFetch(uZ, q, 0).xy;
    // (from the placed end; both placed: from a)
    bool fwd = pa;
    int cf = int((fwd ? a.w : b.w) + 0.5) - ${CARRY_SHEET_CODE}, ct = int((fwd ? b.w : a.w) + 0.5) - ${CARRY_SHEET_CODE};
    if (cf < 0 || cf >= ${CARRY_SHEETS_MAX} || ((fwd ? pb : pa) && (ct < 0 || ct >= ${CARRY_SHEETS_MAX}))) { tfOut = vec4(0.5, a.z, b.z, 2.0); return; }
    vec2 zf = fwd ? zp : zq, zt = fwd ? zq : zp;
    vec2 cv = chainSheetRange(zf, zt, uGs, uGt, uSheetCombos[cf]);
    vec2 own = (fwd ? pb : pa) ? chainSheetRange(zt, zt, uGs, uGt, uSheetCombos[ct]) : (fwd ? b.xy : a.xy);
    if (!cfin(cv) || !cfin(own)) { tfOut = vec4(0.5, a.z, b.z, 2.0); return; }
    if (!(length(cv - own) > ${CROSS_REL} * (length(own) + 1.0))) return;
    // the cut: along the chord of the preimages, the share m up to which the sheet of the first end is still its own piece (its
    // value carried from the first end is the one anchored at m itself), bisected as a cut within one sheet is
    float lo = 0.0, hi = 1.0;
    for (int it = 0; it < uSteps - 1; it++) {
      float m = 0.5 * (lo + hi);
      vec2 zm = mix(zf, zt, m), c1 = chainSheetRange(zf, zm, uGs, uGt, uSheetCombos[cf]), c2 = chainSheetRange(zm, zm, uGs, uGt, uSheetCombos[cf]);
      if (!cfin(c1) || !cfin(c2)) { tfOut = vec4(0.5, a.z, b.z, 2.0); return; }
      if (length(c1 - c2) <= ${CROSS_REL} * (length(c2) + 1.0)) lo = m; else hi = m;
    }
    float tc = cutShare(lo, hi);
    tfOut = vec4(fwd ? tc : 1.0 - tc, a.z, b.z, 1.0);
    return;
  }
  if (abs(a.w - uCode) > 0.5 || abs(b.w - uCode) > 0.5) return;
  float tol = 2e-3 * uH, d0 = abs(b.z - a.z);
  if (!(d0 > tol)) return;
  vec2 z0 = texelFetch(uZ, p, 0).xy, z1 = texelFetch(uZ, q, 0).xy;
${L ? `  bool ownA = a.w < uCode + 0.1, ownB = b.w < uCode + 0.1;
  if (!ownA && !ownB) return;
  eZc = ownA ? z0 : z1; eFixed = ownA && ownB;` : ''}
  vec2 ha = edgeH(z0), hb = edgeH(z1);
${L ? `  // (the continuation from the own end does not give the other end's height: the layer's own cut runs between them, and
  // the fixed cut's heights, which are the vertices', are bisected)
  if (!eFixed && (abs(ha.x - a.z) > tol || abs(hb.x - b.z) > tol)) { eFixed = true; ha = edgeH(z0); hb = edgeH(z1); }
  // (neither: the ends are on the two sides of a cut of the layer, each end's height a continuation from its own side;
  // the cut is taken mid-way, as between two sheets)
  if (!(ha.y > 0.5 && hb.y > 0.5) || abs(ha.x - a.z) > tol || abs(hb.x - b.z) > tol) { if (abs(b.z - a.z) > 0.02 * uH) tfOut = vec4(0.5, a.z, b.z, 1.0); return; }` : ''}
  if (!(ha.y > 0.5 && hb.y > 0.5) || abs(ha.x - a.z) > tol || abs(hb.x - b.z) > tol) return;
  vec2 wLo = edgeW(z0), wHi = edgeW(z1);
  float lo = 0.0, hi = 1.0, hLo = a.z, hHi = b.z, d3 = d0;
  bool jump = true, fin = true;
  for (int it = 0; it < uSteps - 1; it++) {
    float m = 0.5 * (lo + hi);
    vec2 zm = mix(z0, z1, m);
    vec2 hp = edgeH(zm), wp = edgeW(zm);
    if (!(hp.y > 0.5)) { fin = false; break; }
    if (abs(hp.x - hLo) >= abs(hHi - hp.x)) { hi = m; hHi = hp.x; wHi = wp; } else { lo = m; hLo = hp.x; wLo = wp; }
    // (a continuous rise shrinks under bisection, by 8 over three halvings where it is smooth: stop early)
    if (it == 2) { d3 = abs(hHi - hLo); if (d3 < 0.2 * d0) { jump = false; break; } }
  }
  float big = 1e3 * max(max(uMu, uMu2), 1e-30);
  jump = jump && fin && abs(hHi - hLo) > 0.6 * d3 && abs(hHi - hLo) > 0.02 * uH && !(wabs(wLo) > big && wabs(wHi) > big);
  if (jump) { tfOut = vec4(cutShare(lo, hi), hLo, hHi, 1.0); return; }
  // a member seam (uSeam 1): neither end's preimage carried along the edge's place reaches the other's, so the two
  // places hold different members of the glide's inverse and the edge is a cut between them, whatever the chord of
  // their preimages shows; each bank's height at the middle of the edge is its own member's there
  if (uSeam == 1) {
    float hd = 1e-6 * (1.0 + length(z0));
    vec2 dM = (mapPoint(z0 + vec2(hd, 0.0)) - mapPoint(z0 - vec2(hd, 0.0))) / (2.0 * hd);
    vec2 zA, zB, zA1 = seamCont(z0, a.xy, b.xy, zA), zB1 = seamCont(z1, b.xy, a.xy, zB);
    float reach = ${SEAM_REL} * length(z1 - z0) + ${SEAM_ABS} * (1.0 + length(z1));
    // (preimages no farther apart than the member's own derivative allows are one member)
    if (length(z1 - z0) * length(dM) > ${SEAM_FAR} * length(b.xy - a.xy) && length(zA1 - z1) > reach && length(zB1 - z0) > reach) {
      vec2 hA = carryHeight(zA), hB = carryHeight(zB);
      tfOut = vec4(0.5, hA.y > 0.5 ? hA.x : a.z, hB.y > 0.5 ? hB.x : b.z, 1.0);
      return;
    }
  }
}
`;
  // The layered glide's continuation of a layer past the range of its branch: a vertex the walk placed with a preimage z
  // that the layer's own glide does not land on its place (texel w 1) takes the height of the layer's branch
  // continued from an adjacent own vertex (its first own neighbour, the cut opposite that vertex's preimage), texel w
  // uContCode; the same point of the source plane keeps its surface across the branch's cut
  const LAND_CARRY_CONT_VS = `
uniform int uN; uniform int uGs; uniform int uGt; uniform float uCode; uniform float uContCode;
uniform highp sampler2D uT1; uniform highp sampler2D uZ;
// the step's cut leaving each of uCutN branch points of the z-plane: (re, im, angle); uCutRad: the radii of its probe points
uniform vec3 uCutZ[4]; uniform int uCutN; uniform vec2 uCutRad;
out vec4 tfOut;
` + CARRY_HEIGHT + CARRY_HEIGHT_ANCHORED + `
// whether the segment a -> b crosses the image under the layer's map of one of the cuts (the continuation anchor is on the
// other side of the step's cut): the image is a polyline through 12 points of the cut, from uCutRad.x out to uCutRad.y
bool crossesCut(vec2 a, vec2 b) {
  vec2 e = b - a;
  for (int h = 0; h < 4; h++) {
    if (h >= uCutN) break;
    vec2 dir = vec2(cos(uCutZ[h].z), sin(uCutZ[h].z)), o = mapPoint(uCutZ[h].xy + uCutRad.x * dir);
    for (int i = 1; i < 12; i++) {
      float r = uCutRad.x * pow(uCutRad.y / uCutRad.x, float(i) / 11.0);
      vec2 q = mapPoint(uCutZ[h].xy + r * dir), d = q - o, ao = a - o;
      float ed = e.x * d.y - e.y * d.x;
      if (abs(ed) >= 1e-30) {
        float mu = (d.x * ao.y - d.y * ao.x) / ed, lam = (ao.x * e.y - ao.y * e.x) / -ed;
        if (mu >= 0.0 && mu <= 1.0 && lam >= 0.0 && lam <= 1.0) return true;
      }
      o = q;
    }
  }
  return false;
}
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  vec4 t = texelFetch(uT1, p, 0);
  tfOut = t;
  if (t.w < 0.5 || t.w > 5.0) return;
  vec2 za = vec2(0.0);
  bool found = false;
  int anchorAt = 0;
  for (int j = 0; j < 9; j++) {
    ivec2 q = p + ivec2(j % 3 - 1, j / 3 - 1);
    if (j == 4 || q.x < 0 || q.y < 0 || q.x >= uN || q.y >= uN) continue;
    vec4 tq = texelFetch(uT1, q, 0);
    if (tq.w > 5.0 && tq.w < uCode + 0.1 && !crossesCut(tq.xy, t.xy)) { za = texelFetch(uZ, q, 0).xy; found = true; anchorAt = j + 1; break; }
  }
  if (!found) return;
  cxs0_out = false;
  vec2 h = carryHeightA(za, texelFetch(uZ, p, 0).xy);
  // (a continuation onto a branch outside the sheets' window is a surface the parked frame does not draw)
  if (cxs0_out) return;
  if (h.y > 0.5 && !(abs(h.x) > 3e38)) tfOut = vec4(t.xy, h.x, uContCode + ${CARRY_ANCHOR_STEP} * float(anchorAt));
}
`;
  // The layered glide's cross-layer continuation (one pass per target layer, on the layers' texels once every layer is
  // placed): a vertex of layer uK with no value or none confirmed (texel w under 5), beside an own vertex A (its first own
  // neighbour), lies across the step's cut from A. The surface continues there onto the member of another layer: the
  // layer whose own preimage at the vertex is nearest A's. It is that member when the two preimages are no farther apart
  // than the glide's derivative at A allows for the distance of the two places (the seam test's criterion, SEAM_FAR), and
  // the continuation of A's branch to it has the height that layer draws there (RING_GUARD). The vertex takes the place
  // of the grid, that preimage and that layer's height (so the two layers' copies of a surface piece coincide exactly), texel w uContCode (uHOff: a probe's offset of it, in H). uOutZ 0 writes the texel, 1 the preimage.
  const RING_LAYERS_MAX = 7, RING_GUARD = '2e-3', RING_CASES = Array.from({ length: RING_LAYERS_MAX }, (_, i) => i);
  const LAND_CARRY_RING_VS = `
uniform int uN; uniform vec4 uBox; uniform int uK; uniform int uLayers; uniform float uCode; uniform float uContCode; uniform int uOutZ; uniform int uWhy; uniform int uGuard; uniform float uHOff;
uniform int uGs; uniform int uGt;
uniform highp sampler2D uRT1[${RING_LAYERS_MAX}]; uniform highp sampler2D uRZ[${RING_LAYERS_MAX}];
out vec4 tfOut;
` + CARRY_HEIGHT + CARRY_HEIGHT_ANCHORED + `
// (uWhy 1, tests: a vertex the pass leaves off the layer has texel w minus the reason: 1 no own neighbour, 2 no own layer
// there, 3 not one member, 4 no height on the branch, 5 the guard)
void ringWhy(inout vec4 o, int why) { if (uWhy == 1 && uOutZ == 0) o.w = -float(why); }
// (a sampler array is indexed by constants only: one case a layer)
vec4 ringT(int j, ivec2 p) {
${RING_CASES.map((i) => `  if (j == ${i}) return texelFetch(uRT1[${i}], p, 0);`).join('\n')}
  return vec4(0.0);
}
vec4 ringZ(int j, ivec2 p) {
${RING_CASES.map((i) => `  if (j == ${i}) return texelFetch(uRZ[${i}], p, 0);`).join('\n')}
  return vec4(0.0);
}
void main() {
  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  ivec2 p = ivec2(gl_VertexID % uN, gl_VertexID / uN);
  vec4 t = ringT(uK, p), z0 = ringZ(uK, p);
  tfOut = uOutZ == 1 ? z0 : t;
  if (t.w >= 5.0) return;
  vec2 zA = vec2(0.0), pA = vec2(0.0);
  bool found = false;
  for (int j = 0; j < 9; j++) {
    ivec2 q = p + ivec2(j % 3 - 1, j / 3 - 1);
    if (j == 4 || q.x < 0 || q.y < 0 || q.x >= uN || q.y >= uN) continue;
    vec4 tq = ringT(uK, q);
    if (tq.w > 5.0 && tq.w < uCode + 0.1) { zA = ringZ(uK, q).xy; pA = tq.xy; found = true; break; }
  }
  if (!found) { ringWhy(tfOut, 1); return; }
  vec2 pP = uBox.xy + vec2(p) / float(uN - 1) * uBox.zw;
  float hd = 1e-6 * (1.0 + length(zA));
  vec2 dM = (mapPoint(zA + vec2(hd, 0.0)) - mapPoint(zA - vec2(hd, 0.0))) / (2.0 * hd);
  float best = 1e30, hj = 0.0, hit = 0.0;
  vec2 zj = vec2(0.0);
  int why = 2;
  for (int j = 0; j < ${RING_LAYERS_MAX}; j++) {
    if (j >= uLayers || j == uK) continue;
    vec4 tj = ringT(j, p);
    if (!(tj.w > 5.0 && tj.w < uCode + 0.1)) continue;
    vec2 zz = ringZ(j, p).xy;
    float d = length(zz - zA);
    // (the layers' preimages of a place can coincide: a candidate is taken by its height too)
    if (!(d * length(dM) <= ${SEAM_FAR} * length(pP - pA))) { why = max(why, 3); continue; }
    cxs0_out = false;
    vec2 h = carryHeightA(zA, zz);
    if (cxs0_out || !(h.y > 0.5) || abs(h.x) > 3e38) { why = max(why, 4); continue; }
    if (uGuard == 1 && abs(h.x - tj.z) > ${RING_GUARD} * uH) { why = max(why, 5); continue; }
    if (d < best) { best = d; zj = zz; hj = tj.z; hit = 1.0; }
  }
  if (hit < 0.5) { ringWhy(tfOut, why); return; }
  tfOut = uOutZ == 1 ? vec4(zj, z0.zw) : vec4(pP, hj + uHOff * uH, uContCode);
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
  // has moved past them lies on base cells (at the Max mesh it moves 15 to 20 cells between two
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
  // the surface number combo of the drawn map at (zc, z): mode 0 the steps (uSheetA, uSheetB] (chainSheetRange); a deformation (modes 1 and 3, the map's own uniforms) H_t on the sheets that become F's (chainSheetHom,
  // notes/v16-user5/SHEETS-DESIGN.md)
  const SHEET_MAP = `
uniform int uSheetA; uniform int uSheetB; uniform int uSheetMap[24];
vec2 mapSheet(vec2 zc, vec2 z, int surf) {
  int combo = uSheetMap[surf];
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
` + CARRY_ZIN + `
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
    zc = carryZIn(uBox, vec2(cell) + 0.5);
    z = carryZIn(uBox, vec2(cell + cor));
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
  zc = carryZIn(uBox, vec2(cell) + 0.5);
  z = carryZIn(uBox, vec2(cell + cor));
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
  // path, and the sheets' draw at the Max mesh takes twice the base's, 27 to 38 fps orbiting)
  const LAND_SHEET_VS = (clip) => REFINE + (clip ? LAND_CLIP : "") + `
uniform highp sampler2D uT1; uniform highp sampler2D uRf;
uniform int uN; uniform vec4 uBox; uniform vec2 uAspect; uniform float uH; uniform mat4 uMVP; uniform int uTileC; uniform int uClip;
uniform int uSheetK; uniform int uRef; uniform ivec2 uL; uniform int uRefE; uniform int uRefT; uniform int uRefOn; uniform float uZBias;
// the carried sheets (uCarry 1, the steps view's glide): the grid corners' places under the glide's map (uCP, over the grid
// of the cells, uN x uN; LAND_CARRY_PLACE_TF_VS) in the block over uCBox; a triangle with a corner not finite or an edge over
// uCLim on the plane (torn across a cut or a pole of the map) is left out
// A pole's patch (uPatch 1): the same, over the grid of the patch (CARRY_Z, uPolar), whose cells carry their own heights
// uCP and uT1 are the patch's too
uniform highp sampler2D uCP; uniform int uCarry; uniform vec4 uCBox; uniform float uCLim; uniform int uPatch;
` + CARRY_ZIN + `
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
  if (uCarry == 1) {
    // the vertex's place: the cell's four corners' places by bilinear weights, the tangents of the moved sheet from
    // their differences (the slopes of the height at rest, nrm, carried over) in the block over uCBox
    vec2 f = q.xy / 16.0 - vec2(c);
    vec4 p00 = texelFetch(uCP, c, 0), p10 = texelFetch(uCP, c + ivec2(1, 0), 0), p01 = texelFetch(uCP, c + ivec2(0, 1), 0), p11 = texelFetch(uCP, c + ivec2(1, 1), 0);
    vec2 pl = mix(mix(p00.xy, p10.xy, f.x), mix(p01.xy, p11.xy, f.x), f.y);
    vec2 toW = 2.0 * uAspect / uCBox.zw;
    vPos = vec3(((pl - uCBox.xy) / uCBox.zw - 0.5) * 2.0 * uAspect, q.z);
    vec2 dx = mix(p10.xy - p00.xy, p11.xy - p01.xy, f.y) * toW * float(M), dy = mix(p01.xy - p00.xy, p11.xy - p10.xy, f.x) * toW * float(M);
    vec2 rest = 2.0 * uAspect / float(M);
    float nz = max(nrm.z, 1e-6);
    vec3 tx = vec3(dx, -nrm.x / nz * rest.x), ty = vec3(dy, -nrm.y / nz * rest.y);
    if (uPatch == 1) {
      // (a patch's cells are not the plane's grid: the slopes come from the cell's four corners, each at its place)
      ivec2 o = ivec2(combo % uTileC, combo / uTileC) * (2 * M) + 2 * c;
      vec3 P00 = vec3(((p00.xy - uCBox.xy) / uCBox.zw - 0.5) * 2.0 * uAspect, texelFetch(uT1, o, 0).x);
      vec3 P10 = vec3(((p10.xy - uCBox.xy) / uCBox.zw - 0.5) * 2.0 * uAspect, texelFetch(uT1, o + ivec2(1, 0), 0).x);
      vec3 P01 = vec3(((p01.xy - uCBox.xy) / uCBox.zw - 0.5) * 2.0 * uAspect, texelFetch(uT1, o + ivec2(0, 1), 0).x);
      vec3 P11 = vec3(((p11.xy - uCBox.xy) / uCBox.zw - 0.5) * 2.0 * uAspect, texelFetch(uT1, o + ivec2(1, 1), 0).x);
      tx = mix(P10 - P00, P11 - P01, f.y); ty = mix(P01 - P00, P11 - P10, f.x);
      vZ = carryZIn(vec4(0.0), vec2(c) + f);
      vZc = carryZIn(vec4(0.0), vec2(c) + 0.5);
    }
    vec3 nc = cross(tx, ty);
    if (length(nc) > 1e-20) { nc = normalize(nc); vNor = nc.z < 0.0 ? -nc : nc; }
  }
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
  if (uCarry == 1) {
    vec4 ca = texelFetch(uCP, c + A, 0), cb = texelFetch(uCP, c + B, 0), cc = texelFetch(uCP, c + C, 0);
    if (ca.w < 0.5 || cb.w < 0.5 || cc.w < 0.5) return;
    if (length(ca.xy - cb.xy) > uCLim || length(cb.xy - cc.xy) > uCLim || length(cc.xy - ca.xy) > uCLim) return;
  }
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
  vec3 Q[5]; vec4 QA[5]; vec3 Nn[5]; float Fl[5];
  for (int i = 0; i < 5; i++) { Q[i] = vec3(0.0); QA[i] = vec4(0.0); Nn[i] = vec3(0.0, 0.0, 1.0); Fl[i] = 0.0; }
  Q[0] = vec3(pA.zw, ta.x); Q[1] = vec3(pB.zw, tb.x); Q[2] = vec3(pC.zw, tc.x);
  vec2 Wv[3]; Wv[0] = pA.xy; Wv[1] = pB.xy; Wv[2] = pC.xy;
  Nn[0] = nrmOf(ta); Nn[1] = nrmOf(tb); Nn[2] = nrmOf(tc);
  int n = 3;
  if (uClip == 1) n = blockClip(BLOCK_K * uH, n, Q, QA, Nn, Fl);
  if (sub + 2 >= n) return;
  int i1 = sub + 1, i2 = sub + 2;
  int vi = k == 0 ? 0 : (k == 1 ? i1 : i2);
  vec3 boxE = clipBoxE(i1, i2, n, Fl);
  emitV(Q[vi], Nn[vi], vi < 3 ? Wv[vi] : vec2(0.0), boxE, k, c, s0, L, combo);
` : ''}}
`;
  const LAND_COMMON = `
uniform int uMaterial; uniform vec3 uPlaster; uniform vec3 uModLine; uniform vec3 uArgLine; uniform vec3 uFogCol; uniform float uSea;
uniform vec3 uEye; uniform float uFogNear; uniform float uFogFar;
// (the steps view's Inside regions, uMaskOn 1: the points of the surface's plane in its carried region set, the
// mask's alpha over the box uMaskBox (row 0 at its top); outside it the surface is plain, uPlaster; with uMaskCut 1,
// the Landscape's Inside regions, the surface is not drawn there at all)
uniform sampler2D uMask; uniform float uMaskOn; uniform float uMaskCut; uniform vec4 uMaskBox;
const float CUT_EDGE_INK = 0.85;     // the outline along the edge of a cut surface: its share of the colour
float inRegions(vec2 z) {
  if (uMaskOn < 0.5) return 1.0;
  vec2 uv = (z - uMaskBox.xy) / uMaskBox.zw;
  return texture(uMask, vec2(uv.x, 1.0 - uv.y)).a;
}
vec3 albedo(vec2 w) {
  if (uMaterial == 2) return uPlaster;
  if (uMaterial == 1) return dcolor(w);
  float th = wang(w);
  return pwheel(th, 0.72, 0.72, uPal == 0 ? vec3(0.0) : arbc(th, log(clamp(wabs(w), 1e-37, 3e38))));
}
vec3 fogged(vec3 lin, vec3 pos) { return mix(lin, toLin(uFogCol), 0.15 * smoothstep(uFogNear, uFogFar, length(uEye - pos))); }
`;
  // sheet: the covering surface (All sheets): F on the triangle's own sheet, with the cuts of its cell (chainSheet).
  // The mesh follows the true surface to a quarter of a pixel where it is refined (REFINE), so F at the fragment's own
  // z is the surface's value at its height there; where it is not (a wall coarser than its pixels while something
  // moves, the refinement capped), the contour lines fade by how far the facet is from the true height
  // carry: the carried landscape's (LAND_CARRY_VS): F is G = the stages (uGs, uGt] at the point of plane s, the rim is
  // that of plane s's box uSrc, and the surface is clipped at the block's sides (uClipA: its half extent), past which
  // the moving plane's points may go. Where the places fold (several points of plane s on one spot, at one height:
  // exp's or a power's image, uKeyOn 1), the fragment's depth is moved back by uKeyEps times the sheet key of its point
  // (preKeyDepth, the 2D carried colour's order) as a share of its distance from the eye, so the point the 2D picture
  // shows is the one in front, and surfaces apart by more than that share keep their order. Far from the window's centre the
  // keys of folded places differ by little (D grows with the log of the distance), so the share must exceed what the depth
  // buffer resolves between near-equal heights at a grazing angle, or those places tie and speck. A layered draw (layered: a layer
  // is one member, the layers are depth-tested against each other) keeps the rasterised depth, which the key would push behind
  // the floor under the lowest layer
  // The cap probe (uCapProbe over 0, set by the test hooks only): the layered fragment writes its geometry in place of its colour, with no
  // map evaluated. 1: the preimage and the chain's anchor, vec4(vZ, vZc); 2: the drawn height, the layer's claim code, the grid cell
  // (>= 0 a box cell, else -1 - the patch's cell) and 1 over the covered pixels; 3: a constant, for checking the float target
  const CAP_PROBE_FS = `  if (uCapProbe != 0) { o = uCapProbe == 1 ? vec4(vZ, vZc) : uCapProbe == 2 ? vec4(vPos.z, float(uOwn), vCell, 1.0) : vec4(1.0, 2.0, 3.0, 4.0); return; }\n`;
  const LAND_FS = (sheet, plain, lite, carry = false, layered = false, clipped = false) => `
in vec2 vZ; in vec2 vW; in vec3 vPos; in vec3 vNor; in float vAO; in vec3 vBary;
flat in vec3 vEdge; flat in vec3 vBoxE;
uniform vec3 uCut; uniform vec4 uBox;${lite ? '' : ' uniform int uVW;'}${carry ? ` uniform float uKeyEps;\n${PRE_KEY_DECL}` : ''}${sheet ? ' uniform int uCarry; uniform vec2 uClipA; uniform int uCarryCol;' : ''}
out vec4 o;
${carry ? `uniform int uGs; uniform int uGt; uniform vec2 uClipA; uniform vec4 uSrc;\n${layered ? 'uniform float uH;\nflat in vec2 vZc; uniform int uOwn; uniform int uCapProbe; flat in float vCell;\nvec2 landW(vec2 z) { return chainSheetRange(vZc, z, uGs, uGt, uOwn); }' : 'uniform int uZOn; uniform int uSheetCombo; flat in vec2 vZc;\nvec2 landW(vec2 z) { return uZOn == 1 ? chainSheetRange(vZc, z, uGs, uGt, uSheetCombo) : chainRange(z, uGs, uGt); }'}` : plain ? 'vec2 landW(vec2 z) { return vW; }' : sheet ? `flat in vec2 vZc; flat in int vCombo; uniform float uCue; uniform int uCueK;${SHEET_MAP}
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
  if (uHMode >= 8) {
    // the mix of two end heights is strictly increasing in the value: bisect x = mu sinh(s)
    float mu2 = uMu2 > 0.0 ? uMu2 : mu, lo = -30.0, hi = 30.0;
    for (int it = 0; it < 28; it++) {
      float m = 0.5 * (lo + hi), x = mu * 0.5 * (exp(m) - exp(-m));
      float g = (1.0 - uMix) * endH(x, mu, (uEndLin & 1) != 0, 1e30) + uMix * endH(x, mu2, (uEndLin & 2) != 0, 1e30);
      if (g < h) lo = m; else hi = m;
    }
    float m = 0.5 * (lo + hi), x = mu * 0.5 * (exp(m) - exp(-m));
    if (uHMode == 8) w.x = x; else w.y = x;
    return w;
  }
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
${carry ? '  if (abs(vPos.x) > uClipA.x || abs(vPos.y) > uClipA.y) discard;\n' + (layered && !clipped ? '  // (the block ends at BLOCK_K H: the layer is cut there, as the sheets of the rest frame are, where a pole runs on past it)\n  if (abs(vPos.z) > ' + BLOCK_K.toFixed(4) + ' * uH) discard;\n' : '') + (layered ? CAP_PROBE_FS : '') : sheet ? '  if (uCarry == 1 && (abs(vPos.x) > uClipA.x || abs(vPos.y) > uClipA.y)) discard;\n' : ''}  // colour from F at the interpolated z: contours stay crisp. (Sub-cells under about a pixel: F at their corners,
  // interpolated, which at that size is the same picture without the chain in every fragment of every tiny triangle)
${lite ? `  vec2 w0 = landW(vZ), w = w0;
  const float la = 1.0;` : `  vec2 w0 = uVW == 1${sheet ? ' && uCarryCol == 0' : ''} ? vW : landW(vZ), w = ${sheet ? 'uCarryCol == 1 ? w0 : ' : ''}facetW(w0);
  float pw = max(max(length(dFdx(vPos)), length(dFdy(vPos))), 1e-9);
  vec2 ht = heightW(w);
  float la = ht.y > 0.5${sheet ? ' && uCarryCol == 0' : ''} ? 1.0 - smoothstep(1.0, 3.0, abs(ht.x - vPos.z) / pw) : 1.0;`}
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
  // (outside the carried region set: not drawn, or plain under the sheet cue, the cut's banks and the rim as
  // everywhere; a cut surface carries the outline of the set along its edge)
  float inside = inRegions(vZ);
  if (uMaskCut > 0.5) {
    if (inside < 0.5) discard;
    float edgePx = (inside - 0.5) / max(fwidth(inside), 1e-6);
    a = mix(a, ml, CUT_EDGE_INK * (1.0 - smoothstep(0.75 * uDpr - 0.5, 0.75 * uDpr + 0.5, edgePx)));
  } else a = mix(toLin(uPlaster), a, inside);
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
  // the rim of the surface (the domain's edges at their heights): seen from the side it draws the profile. The carried
  // surface goes on past its box's edge (the patches of CARRY_Z), so its rim is where the block's sides clip it
${carry ? `  vec2 er = (uClipA - abs(vPos.xy)) / max(fwidth(vPos.xy), vec2(1e-9));` : `  vec2 uv = (vZ - uBox.xy) / uBox.zw;
  vec2 er = min(uv, 1.0 - uv) / max(fwidth(uv), vec2(1e-9));`}
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
${carry && !layered ? '  gl_FragDepth = uKeyOn > 0 ? min(gl_FragCoord.z + (1.0 - gl_FragCoord.z) * uKeyEps * preKeyDepth(vZ, true), 1.0) : gl_FragCoord.z;\n' : ''}}
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
  // a cut surface (uMaskCut) casts no shadow where it is not drawn
  if (uMaskCut > 0.5) contact *= step(0.5, inRegions(z));
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
uniform vec2 uProbe; uniform float uFlat; uniform vec4 uBox; uniform vec2 uAspect; uniform float uFloorZ; uniform float uDpr;
${sheet ? SHEET_MAP : ''}
${MARK_EMIT}
void main() {
  vec2 w = ${sheet ? 'mapSheet(uProbe, uProbe, gl_InstanceID)' : 'mapF(uProbe)'};
  vec2 hv = heightW(w);
  vec2 uv = (uProbe - uBox.xy) / uBox.zw;
  vec2 xy = (uv - 0.5) * 2.0 * uAspect;
  vec3 top = vec3(xy, hv.y > 0.5 && uFlat < 0.5 ? hv.x : uFloorZ), bot = vec3(xy, uFloorZ);
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
  // globe that takes no drawing (Morph open, solo, a focused stage), which panels.md 9.5 keeps. The real
  // great circle and |z| = 1 are drawn in all three.
  // The graticule's coverages at the sphere point n (unit): net (the tier of uNet), re (the real great circle) and eq
  // (|z| = 1), each 0..1, and phaseLines' mix of them over a colour (the globe's phase portrait, and the steps view's
  // carried colour, which share it). Needs TIERS and UTIL.
  const SPHERE_LINES = `
uniform int uNet;
void sphereLines(vec3 n, out float net, out float re, out float eq) {
  float nz = clamp(n.z, -1.0, 1.0);
  float y = 0.5 * log2(max(1.0 + nz, 1e-12) / max(1.0 - nz, 1e-12));   // log2 |z|
  float fy = fwidth(y);
  float mk = uNet == 2 ? (6.0 / PI) : (12.0 / PI);
  float th = atan(n.y, n.x) * mk;
  float fa = argWidth(n.xy) * mk;
  float fny = fwidth(n.y);
  float mer = iso(th, fa, 1.0) * dfade(fa);                                        // meridians every 15 (30) deg
  float par = iso(y, fy, 1.0) * dfade(fy) * step(0.5, abs(y)) * step(abs(y), uNet == 2 ? 2.5 : 3.5);  // |z| = 1/8 (1/4) ... 8 (4)
  net = max(mer, par);
  if (uNet == 1) net = tiersOver(vec2(n.x, -n.y) / max(1.0 - nz, 1e-7), vec4(0.0), 1.0).a;   // the lifted lattice (coverage)
  eq = iso0(y, fy, 1.5 * uDpr);                                                    // |z| = 1
  re = iso0(n.y, fny, 1.25 * uDpr);                                                // real great circle
}
vec3 phaseLines(vec3 base, float net, float re, float eq) {
  vec3 ink = vec3(0.0431, 0.0667, 0.0784);
  vec3 col = mix(base, ink, 0.18 * net);
  col = mix(col, ink, 0.35 * re);
  return mix(col, ink, 0.45 * eq);
}
`;
  const SPHERE_FS = (phase) => `
in vec3 vP;
uniform vec3 uPlaneCol; uniform vec3 uGridMaj; uniform vec3 uAxisCol; uniform vec3 uEye;
out vec4 o;
void main() {
  vec3 n = normalize(vP);
  float net, re, eq;
  sphereLines(n, net, re, eq);
${phase ? `
  vec3 base = dcolor(mapF(vec2(n.x, -n.y) / max(1.0 - clamp(n.z, -1.0, 1.0), 1e-7)));   // S = 0, N = infinity (the conjugate lift's inverse)
  vec3 col = phaseLines(base, net, re, eq);` : `
  vec3 col = mix(uPlaneCol, uGridMaj, net);
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


'use strict';
// Image-quality metrics of one rendered right plane against the exact ground truth of its scene.
//
// Pixel classes (from the rendered color, nearest of a set of reference colors and their blends):
//   FILL  the shape's fill (c0; for the checker also its alternate color c0-alt and blends between them)
//   BG    the plane and its graph paper (plane, grid lines, axes)
//   ANNOT boundary strokes (edge color), cut banks and their blends. Not counted as fill or background.
//   UNKNOWN a color far (> UNKNOWN_DIST) from every reference color and blend: garbage (NaN black, a wrong color). It
//         counts as an error everywhere: as a hole inside the true image, as spill outside it.
// A blend of fill and plane (antialiasing, the far fade of a truncated mesh) counts as FILL when it is more than half
// fill, so "rendered as fill" means "at least 50 % covered".
//
// The band around the true boundary (|signed distance| <= BAND px) is excluded from every count: the app draws the
// boundary as a 1.5 px stroke on a 3.5 px halo, so within about 2.4 px of the boundary the fill is not visible
// whatever the fill does (measured: a 2 px band leaves halo pixels that flip with the sub-pixel phase of the
// boundary). Scenes whose map folds (truth.srcSdf) also exclude the band around the image of the region's boundary
// where it runs through the inside of the image (the stroke is drawn there too).
//
// Added for the exact-image scenes (SPEC 12.4):
//   polar parity  truth.parityAll(w) gives the log-polar checker parity of every sheet at w (they agree), so every
//                 fill pixel is scored (cells >= PARITY_MIN_CELL px, >= PARITY_MIN_EDGE px from a cell edge). The
//                 app paints solid c0 where the source point is within cell/12 of the polar origin (REGION_FS 'rc';
//                 kept on the inverse path, SPEC 6.2), so the parity shown is that of the FRONT sheet (opt.sheet):
//                 0 where the front member lies in that disc
//   front checker pattern runs with several preimages per pixel: the planar checker parity of the front member, the
//                 member with the smallest sheet key D of SPEC 5.1 (ties: larger Im z, then larger Re z)
//   (both)        a pixel whose front can swap with a member of another displayed parity (keys within TIE_OCT) is
//                 not scored (parity_excl_tie)
//   opacity       mask-type runs: the fill fraction t of each truth-interior pixel along plane -> c0 (0 = plane,
//                 1 = opaque fill; clamped to [0, 1]). opacity_min is the minimum, opacity_p01 the 1st percentile,
//                 opacity_lt99 the fraction of pixels below 0.99
//   color_off     the fraction of truth-interior pixels whose colour is farther than COLOR_TOL (RGB units) from the
//                 expected opaque fill colour (mask: c0; checker / polar: the segment c0 - c0-alt); color_err_mean,
//                 color_err_p99: the RGB distance itself
//   cell_err      parity-scored pixels of pattern runs (P2 review): the RGB distance from the colour of the TRUE cell
//                 (c0 for parity 0, c0-alt for parity 1): cell_err_p99, cell_err_max. Catches cells pulled toward the
//                 other colour (a translucent composite of sheets of another parity behind the front one) that
//                 color_off (the c0 - c0-alt segment) and the parity (nearest colour) let pass
//   hole_leak     truth.holeDisc {c, r}: pixels deeper than BAND inside that disc rendered as FILL (or UNKNOWN), and
//                 on mask-type runs also a translucent fill (on the plane -> c0 blend, opacity > LEAK_T)
// STRICT mode (the SPEC 12.4 groups; the original groups keep exactly their old metrics): an ANNOT pixel inside the
// truth, outside the bands, is a HOLE (a stroke-like colour where the fill must be: a darkened fill, the edge colour,
// a stroke drawn away from the true boundary), except inside truth.annotSdf's band (strokes that legitimately cross
// the image, e.g. healed_cut's dashed cut line); opacity and colour error are taken over EVERY interior pixel outside
// the bands (only stroke-coloured pixels inside the annotation band are skipped); and a metric with nothing (or much
// too little) to score is reported as null with a problem, never as a perfect 1.

const BAND = 2.5;          // px: the excluded band around the true boundary
const PAD = 6;             // px: the truth grid is padded so the distance transform sees boundaries just off the view
const PARITY_MIN_CELL = 3; // px: image checker cells smaller than this are not scored
const PARITY_MIN_EDGE = 1.5; // px: pixels this close to a checker cell edge are not scored
const UNKNOWN_DIST = 48;   // RGB distance (0-255 units) beyond which a color is ANNOT whatever is nearest
const COLOR_TOL = 6;       // RGB distance from the expected opaque fill colour above which a pixel counts in color_off
const LEAK_T = 0.05;       // mask-type runs: a hole pixel on the plane -> c0 blend with more fill than this leaks
const TIE_OCT = 0.01;      // octaves: members whose sheet keys D differ by less may swap front (SPEC 3.10 / 5.4: the
                           // front key is exact, or within 0.01 octave where a window is truncated; float32 keys
                           // are good to ~1e-6 octave)
const MIN_SCORED = 0.5;    // strict: opacity / parity are null when they scored fewer than this share of their pixels
const CL_BG = 0, CL_FILL = 1, CL_ANNOT = 2, CL_UNKNOWN = 3;

const hexRGB = (h, d) => { const m = /^#?([0-9a-f]{6})/i.exec(String(h || '').trim()); const x = m ? m[1] : d.slice(1); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };

const NEAR_ANNOT = 16;
const FILLSEG = 32;        // the nearest reference is a blend of a fill colour with the plane / graph paper
// colors: CSS tokens read from the page ({'--c1': '#3B6FD4', ...}); variant 'mask' (solid) or 'pattern' (checker)
function makeClassifier(colors, variant) {
  const g = (k, d) => hexRGB(colors[k], d);
  const c0 = g('--c1', '#3B6FD4'), alt = g('--c1-alt', '#8CABE5'), edge = g('--c1-edge', '#093B9B');
  const plane = g('--plane', '#FCFDFD'), minor = g('--grid-minor', '#E2EEF2'), medium = g('--grid-medium', '#D3E6ED'), major = g('--grid-major', '#B5D4E0');
  const axis = g('--axis', '#2E3D47'), cut = g('--cut', '#CC3311'), ink = g('--ink', '#121A20'), halo = g('--halo', '#FCFDFD');
  const F = CL_FILL, B = CL_BG, A = CL_ANNOT;
  // [colorA, colorB, classA, classB]: a blend nearer A than B takes A's class
  const segs = [];
  const seg = (a, b, ca, cb) => segs.push([a, b, ca, cb]);
  for (const x of [minor, medium, major, axis, halo]) seg(plane, x, B, B);
  seg(minor, medium, B, B); seg(medium, major, B, B); seg(major, axis, B, B); seg(minor, axis, B, B); seg(medium, axis, B, B);
  if (variant === 'pattern') { seg(c0, alt, F, F); seg(c0, plane, F, B); seg(alt, plane, F, B); }
  else seg(c0, plane, F, B);
  for (const f of variant === 'pattern' ? [c0, alt] : [c0]) { seg(edge, f, A, F); seg(cut, f, A, F); }
  seg(edge, plane, A, B); seg(cut, plane, A, B); seg(cut, edge, A, A); seg(ink, plane, A, B); seg(edge, halo, A, B);
  const cache = new Map();
  const d0 = alt[0] - c0[0], d1 = alt[1] - c0[1], d2 = alt[2] - c0[2], dd = d0 * d0 + d1 * d1 + d2 * d2 || 1;
  // -> class | (parity << 2): parity 0 = nearer c0, 1 = nearer the alternate color (checker only)
  return (r, gg, b) => {
    const key = (r << 16) | (gg << 8) | b;
    let v = cache.get(key);
    if (v !== undefined) return v;
    let best = Infinity, cls = A, ann = false, fseg = false;
    for (const [p, q, ca, cb] of segs) {
      const e0 = q[0] - p[0], e1 = q[1] - p[1], e2 = q[2] - p[2], L = e0 * e0 + e1 * e1 + e2 * e2;
      let t = L > 0 ? ((r - p[0]) * e0 + (gg - p[1]) * e1 + (b - p[2]) * e2) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const x0 = p[0] + t * e0 - r, x1 = p[1] + t * e1 - gg, x2 = p[2] + t * e2 - b, dist = x0 * x0 + x1 * x1 + x2 * x2;
      if (dist < best - 1e-9) { best = dist; cls = t < 0.5 ? ca : cb; ann = ca === A || cb === A; fseg = (ca === F && cb === B) || (ca === B && cb === F); }
    }
    if (Math.sqrt(best) > UNKNOWN_DIST) cls = CL_UNKNOWN;
    let par = 0;
    if (cls === F && variant === 'pattern') par = ((r - c0[0]) * d0 + (gg - c0[1]) * d1 + (b - c0[2]) * d2) / dd < 0.5 ? 0 : 1;
    // bit 4 (NEAR_ANNOT): the nearest reference is a blend with a stroke / annotation colour (the antialiased end of
    // a stroke over the fill); bit 5 (FILLSEG): a blend of a fill colour with the background (a translucent fill)
    v = cls | (par << 2) | (ann ? NEAR_ANNOT : 0) | (fseg ? FILLSEG : 0);
    cache.set(key, v);
    return v;
  };
}
// fill fraction of a colour along plane -> c0 (0 = plane, 1 = the opaque fill colour), clamped to [0, 1]
function makeOpacity(colors) {
  const c0 = hexRGB(colors['--c1'], '#3B6FD4'), plane = hexRGB(colors['--plane'], '#FCFDFD');
  const e0 = c0[0] - plane[0], e1 = c0[1] - plane[1], e2 = c0[2] - plane[2], L = e0 * e0 + e1 * e1 + e2 * e2 || 1;
  return (r, g, b) => Math.max(0, Math.min(1, ((r - plane[0]) * e0 + (g - plane[1]) * e1 + (b - plane[2]) * e2) / L));
}

// RGB distance of a colour from the expected OPAQUE fill colour: mask kinds c0; checker / polar the segment
// c0 - c0-alt (both checker colours and their antialiased / moire-averaged blends)
function makeColorErr(colors, kind) {
  const c0 = hexRGB(colors['--c1'], '#3B6FD4'), alt = hexRGB(colors['--c1-alt'], '#8CABE5');
  const b = kind === 'pattern' ? alt : c0;
  const e0 = b[0] - c0[0], e1 = b[1] - c0[1], e2 = b[2] - c0[2], L = e0 * e0 + e1 * e1 + e2 * e2;
  return (r, g, bb) => {
    let t = L > 0 ? ((r - c0[0]) * e0 + (g - c0[1]) * e1 + (bb - c0[2]) * e2) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(c0[0] + t * e0 - r, c0[1] + t * e1 - g, c0[2] + t * e2 - bb);
  };
}

// SPEC 5.1 sheet order (#584: as Inverse.sheetKey). win: the meshing window clipWin {x0, x1, y0, y1}; P: the key's
// points (points {re, im}). D(z) = log2(1 + |z - c| / R) + sum over p in P of max(0, log2(rs / |z - p|)), c the centre
// of W, R = half-diagonal of W, rs = R / 8.
function sheetKey(win, P = []) {
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8, cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
  return (z) => {
    let D = Math.log2(1 + Math.hypot(z.re - cx, z.im - cy) / R);
    for (const p of P) { const d = Math.hypot(z.re - p.re, z.im - p.im); if (d < rs) D += d > 0 ? Math.log2(rs / d) : Infinity; }
    return D;
  };
}
// members in front-to-back order: key D ascending; ties (equal D): larger Im z, then larger Re z in front (SPEC 5.2)
function frontOrder(cands, key) {
  // (keys in the same step of 2^-8 octave tie: Inverse.front's TIE_D)
  const q = (D) => (D === Infinity ? Infinity : Math.round(D * 256));
  const dk = (a, b) => (q(a.D) !== q(b.D) ? a.D - b.D : 0);
  return cands.map((z) => ({ z, D: key(z) })).sort((a, b) => dk(a, b) || (b.z.im - a.z.im) || (b.z.re - a.z.re));
}
// the displayed parity at a pixel from the front member, given tok(z) -> {par (0 | 1), cellPx, edgePx}. A member
// behind the front whose key is within TIE_OCT may be in front on the GPU: when it would show another parity (or one
// that is not scorable) the pixel is ambiguous (par -2). Two members both at key 0 (inside W, away from P) are
// ordered exactly by the tie rule.
const scorable = (t) => t.par >= 0 && t.cellPx >= PARITY_MIN_CELL && t.edgePx >= PARITY_MIN_EDGE;
function frontParity(ord, tok) {
  const f = ord[0], ft = tok(f.z);
  if (!scorable(ft)) return ft;
  for (let i = 1; i < ord.length; i++) {
    const o = ord[i];
    if (o.D - f.D > TIE_OCT) break;
    if (o.D === 0 && f.D === 0) continue;
    const t = tok(o.z);
    if (!scorable(t) || t.par !== ft.par) return { par: -2, cellPx: ft.cellPx, edgePx: ft.edgePx, tie: true };
  }
  return ft;
}

// squared Euclidean distance transform (Felzenszwalb & Huttenlocher) of a binary feature grid (1 = feature)
function edt2(feat, W, H) {
  const INF = 1e20, out = new Float64Array(W * H);
  const n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (len) => {
    let k = -1;
    for (let q = 0; q < len; q++) {
      if (f[q] >= INF) continue;
      while (k >= 0) {
        const s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        if (s <= z[k]) k--; else { k++; v[k] = q; z[k] = s; break; }
      }
      if (k < 0) { k = 0; v[0] = q; z[0] = -INF; }
      z[k + 1] = INF;
    }
    if (k < 0) { for (let q = 0; q < len; q++) d[q] = INF; return; }
    let j = 0;
    for (let q = 0; q < len; q++) { while (z[j + 1] < q) j++; const t = q - v[j]; d[q] = t * t + f[v[j]]; }
  };
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = feat[y * W + x] ? 0 : INF;
    pass(H);
    for (let y = 0; y < H; y++) out[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = out[y * W + x];
    pass(W);
    for (let x = 0; x < W; x++) out[y * W + x] = d[x];
  }
  return out;
}

// geo: {w, h, rect: [left, top, width, height], o: [x, y] client point of w = 0, x1: of w = 1, y1: of w = i}
function pixelMap(geo) {
  const [L, T, RW, RH] = geo.rect;
  const sx = geo.x1[0] - geo.o[0], sy = geo.o[1] - geo.y1[1];
  const kx = RW / geo.w, ky = RH / geo.h;            // CSS px per canvas pixel (1 / dpr)
  return {
    at: (i, j) => ({ re: (L + (i + 0.5) * kx - geo.o[0]) / sx, im: (geo.o[1] - (T + (j + 0.5) * ky)) / sy }),
    spx: sx / kx,                                     // canvas px per w unit
    view: { cx: (L + RW / 2 - geo.o[0]) / sx, cy: (geo.o[1] - T - RH / 2) / sy, s: sx },
  };
}

const fin = (z) => Number.isFinite(z.re) && Number.isFinite(z.im);
// exact truth on the pixel grid (padded by PAD for the distance transform)
// opt.parity: 'checker' (default: planar checker of the unique preimage), 'front' (planar checker of the front member,
// any number of preimages), 'polar' (truth.parityAll at every pixel inside; with opt.sheet the parity of the front
// member, solid c0 in the near-origin disc), or null (no parity)
// opt.sheet: {win, P} the sheet order of SPEC 5.1 (clipWin, accumulation set); opt.rc: the radius of the polar
// pattern's solid disc around the origin (pattern cell / 12, REGION_FS); opt.annot: compute truth.annotSdf's band
function truthGrid(truth, cell, map, W, H, opt = {}) {
  const parityMode = opt.parity === undefined ? 'checker' : opt.parity;
  const key = opt.sheet ? sheetKey(opt.sheet.win, opt.sheet.P || []) : () => 0;
  const rcR = opt.rc || 0;
  const Wp = W + 2 * PAD, Hp = H + 2 * PAD;
  const insideP = new Uint8Array(Wp * Hp);
  const nPre = new Uint8Array(W * H), parity = new Int8Array(W * H).fill(-1), cellPx = new Float32Array(W * H), edgePx = new Float32Array(W * H);
  const sdfPx = truth.sdf ? new Float64Array(W * H) : null;
  const strokePx = truth.srcSdf ? new Float32Array(W * H).fill(Infinity) : null;
  // distance (px) to strokes that legitimately cross the inside of the image (e.g. a cut line drawn over the fill)
  const annotPx = opt.annot && truth.annotSdf ? new Float32Array(W * H) : null;
  // pixels deeper than BAND inside the disc that must stay empty
  const hd = truth.holeDisc, holeIn = hd ? new Uint8Array(W * H) : null;
  let frontInDisc = 0;
  // planar checker token of a member z (cell px, distance to a cell edge in px)
  const checkerTok = (z) => {
    const sc = truth.dF(z) * map.spx, gx = z.re / cell, gy = z.im / cell;
    return { par: (((Math.floor(gx) + Math.floor(gy)) % 2) + 2) % 2, cellPx: cell * sc, edgePx: Math.min(Math.abs(gx - Math.round(gx)), Math.abs(gy - Math.round(gy))) * cell * sc };
  };
  for (let jp = 0; jp < Hp; jp++) {
    for (let ip = 0; ip < Wp; ip++) {
      const i = ip - PAD, j = jp - PAD, w = map.at(i, j);
      let all = [], cands = [];
      try { all = truth.pre(w).filter(fin); cands = all.filter((z) => truth.region(z)); } catch (e) { all = []; cands = []; }
      insideP[jp * Wp + ip] = cands.length > 0 ? 1 : 0;
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const k = j * W + i;
      nPre[k] = Math.min(255, cands.length);
      if (sdfPx) sdfPx[k] = truth.sdf(w) * map.spx;
      // distance to the image of the region's boundary, to first order, over every preimage (folds included)
      if (strokePx) for (const z of all) strokePx[k] = Math.min(strokePx[k], Math.abs(truth.srcSdf(z)) * truth.dF(z) * map.spx);
      if (annotPx) annotPx[k] = truth.annotSdf(w) * map.spx;
      if (holeIn) holeIn[k] = (hd.r - Math.hypot(w.re - hd.c[0], w.im - hd.c[1])) * map.spx > BAND ? 1 : 0;
      let t = null;
      if (parityMode === 'polar') {
        if (cands.length) {
          const p = truth.parityAll(w);
          const pa = { par: p.par, cellPx: p.cell * map.spx, edgePx: p.edge * map.spx };
          if (!opt.sheet) t = pa;
          else {
            // REGION_FS: col = mix(c0, checker, clamp(0.5 + (rc - 1) / fwidth)), rc = |z - o| * 12 / cell: solid c0
            // (parity 0) inside the disc, the polar checker outside, a 1 px fade between (scored only where both
            // sides show the same parity)
            const tok = (z) => {
              const r = Math.hypot(z.re, z.im), dpx = Math.abs(r - rcR) * truth.dF(z) * map.spx;
              if (r < rcR && dpx >= PARITY_MIN_EDGE) return { par: 0, cellPx: Infinity, edgePx: dpx, disc: true };
              if (dpx < PARITY_MIN_EDGE && pa.par !== 0) return { par: pa.par, cellPx: pa.cellPx, edgePx: Math.min(pa.edgePx, dpx) };
              return pa;
            };
            const ord = frontOrder(cands, key);
            t = frontParity(ord, tok);
            // scorable pixels (before the band exclusion) whose front member lies in the c0 disc: the rule decides them
            if (t.disc && scorable(t)) frontInDisc++;
          }
        }
      } else if (parityMode === 'front') {
        if (cands.length) t = frontParity(frontOrder(cands, key), checkerTok);
      } else if (parityMode === 'checker' && cands.length === 1) {
        t = checkerTok(cands[0]);
      }
      if (t) { parity[k] = t.par; cellPx[k] = t.cellPx; edgePx[k] = t.edgePx; }
    }
  }
  const inside = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) inside[j * W + i] = insideP[(j + PAD) * Wp + i + PAD];
  let sdf = sdfPx;
  if (!sdf) {
    // distance from each pixel center to the nearest pixel center of the other class, minus half a pixel
    const dOut = edt2(insideP.map((x) => 1 - x), Wp, Hp), dIn = edt2(insideP, Wp, Hp);
    sdf = new Float64Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const kp = (j + PAD) * Wp + i + PAD;
      sdf[j * W + i] = insideP[kp] ? Math.sqrt(dOut[kp]) - 0.5 : -(Math.sqrt(dIn[kp]) - 0.5);
    }
  }
  return { inside, nPre, parity, cellPx, edgePx, sdf, stroke: strokePx, annot: annotPx, sdfKind: truth.sdf ? 'analytic' : 'edt', parityMode, holeIn, frontInDisc };
}

const r6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : x);
function pctl(arr, p) { if (!arr.length) return 0; const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))]; }

// rgba: canvas pixels (W*H*4); returns {metrics, map: RGBA diagnostic image, problems: [string]}
// parity: 'checker' | 'front' | 'polar' | null (default: 'checker' for variant 'pattern', else none);
// opacity: a makeOpacity() function to report the fill opacity of the interior (mask-type runs);
// strict: the rules of the SPEC 12.4 groups (see the header); colorErr: a makeColorErr() function (strict runs)
function evaluate({ rgba, W, H, truthG, classify, variant, parity, opacity = null, band = BAND, strict = false, colorErr = null, cellColor = null }) {
  const T = truthG;
  const pm = parity !== undefined ? parity : (variant === 'pattern' ? 'checker' : null);
  const cls = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) cls[k] = classify(rgba[4 * k], rgba[4 * k + 1], rgba[4 * k + 2]);
  let nBand = 0, nIn = 0, nOut = 0, holes = 0, spill = 0, annIn = 0, annOut = 0, inter = 0, union = 0, fillIn = 0, unknown = 0;
  let parN = 0, parOk = 0, parMulti = 0, parSmall = 0, parEdge = 0, parTie = 0, parExp = 0, annHole = 0;
  let leakN = 0, leakIn = 0;
  const opa = opacity ? [] : null;
  const cellE = cellColor && pm ? [] : null;
  const cerr = strict && colorErr ? [] : null;
  const errD = [];
  const problems = [];
  const map = Buffer.alloc(W * H * 4);
  const put = (k, c) => { map[4 * k] = c[0]; map[4 * k + 1] = c[1]; map[4 * k + 2] = c[2]; map[4 * k + 3] = 255; };
  const COL = { band: [214, 214, 214], inOk: [168, 212, 168], inUnscored: [205, 230, 205], outOk: [255, 255, 255], hole: [228, 26, 28], spill: [30, 100, 230], annot: [245, 190, 40], parBad: [140, 20, 160], colorBad: [255, 120, 0] };
  // the truth's own verdict on whether a pixel can be scored for parity (strict: the expected count)
  const parKind = (k) => {
    if (pm === 'checker' ? T.nPre[k] !== 1 : T.parity[k] === -1) return 'multi';
    if (T.parity[k] === -2) return 'tie';
    if (T.cellPx[k] < PARITY_MIN_CELL) return 'small';
    if (T.edgePx[k] < PARITY_MIN_EDGE) return 'edge';
    return 'ok';
  };
  for (let k = 0; k < W * H; k++) {
    const d = T.sdf[k], c = cls[k] & 3, par = (cls[k] >> 2) & 1;
    if (T.holeIn && T.holeIn[k]) {
      leakIn++;
      // strict mask-type runs: a translucent fill (on the plane -> c0 blend) leaks too, e.g. one sheet at alpha 0.2
      const translucent = strict && opacity && (cls[k] & FILLSEG) && opacity(rgba[4 * k], rgba[4 * k + 1], rgba[4 * k + 2]) > LEAK_T;
      if (c === CL_FILL || c === CL_UNKNOWN || translucent) leakN++;
    }
    if (Math.abs(d) <= band || (T.stroke && T.stroke[k] <= band)) { nBand++; put(k, COL.band); continue; }
    if (T.inside[k]) {
      nIn++;
      // strokes allowed over the fill: within the annotation band (strict); everywhere (the original groups)
      const annOk = !strict || (T.annot && T.annot[k] <= band);
      const strokeLike = c === CL_ANNOT || (cls[k] & NEAR_ANNOT);
      if (strict && pm && parKind(k) === 'ok') parExp++;
      let ce = -1;
      if (strict && !(annOk && strokeLike)) {
        if (opa) opa.push(opacity(rgba[4 * k], rgba[4 * k + 1], rgba[4 * k + 2]));
        if (cerr) { ce = colorErr(rgba[4 * k], rgba[4 * k + 1], rgba[4 * k + 2]); cerr.push(ce); }
      }
      if (c === CL_ANNOT) {
        annIn++;
        if (annOk) { put(k, COL.annot); continue; }
        // strict: a stroke-coloured pixel where the fill must show is a hole
        annHole++; holes++; union++; errD.push(Math.abs(d)); put(k, COL.hole); continue;
      }
      if (!strict && opa && !(cls[k] & NEAR_ANNOT)) opa.push(opacity(rgba[4 * k], rgba[4 * k + 1], rgba[4 * k + 2]));
      union++;
      if (c === CL_BG || c === CL_UNKNOWN) { holes++; if (c === CL_UNKNOWN) unknown++; errD.push(Math.abs(d)); put(k, COL.hole); continue; }
      inter++; fillIn++;
      let col = COL.inOk;
      if (pm) {
        const pk = parKind(k);
        if (pk === 'multi') { parMulti++; col = COL.inUnscored; }
        else if (pk === 'tie') { parTie++; col = COL.inUnscored; }
        else if (pk === 'small') { parSmall++; col = COL.inUnscored; }
        else if (pk === 'edge') { parEdge++; col = COL.inUnscored; }
        else {
          parN++; if (par === T.parity[k]) parOk++; else col = COL.parBad;
          if (cellE) { const cc = cellColor(T.parity[k]); cellE.push(Math.hypot(rgba[4 * k] - cc[0], rgba[4 * k + 1] - cc[1], rgba[4 * k + 2] - cc[2])); }
        }
      }
      if (col !== COL.parBad && ce > COLOR_TOL) col = COL.colorBad;   // filled, but in a wrong colour (orange)
      put(k, col);
    } else {
      nOut++;
      if (c === CL_ANNOT) { annOut++; put(k, COL.annot); continue; }
      if (c === CL_FILL || c === CL_UNKNOWN) { spill++; union++; if (c === CL_UNKNOWN) unknown++; errD.push(Math.abs(d)); put(k, COL.spill); continue; }
      put(k, COL.outOk);
    }
  }
  const L = nBand / (2 * band);  // length of the true boundary in view, px (band area / band width)
  const Lf = Math.max(L, Math.min(W, H)); // floored, so a boundary that is almost out of view does not blow it up
  const m = {
    iou: union ? inter / union : 1,
    hole: nIn ? holes / nIn : 0,
    spill: nOut ? spill / nOut : 0,
    bnd_err_px: (holes + spill) / Lf,
    bnd_p95_px: errD.length >= 20 ? pctl(errD, 0.95) : 0,
    annot: (nIn + nOut) ? (annIn + annOut) / (nIn + nOut) : 0,
    n_in: nIn, n_out: nOut, n_band: nBand, n_hole: holes, n_spill: spill, n_unknown: unknown, bnd_len_px: L,
  };
  if (strict) {
    m.n_annot_hole = annHole;
    if (!nIn && !nOut) problems.push('every pixel lies in the excluded band: nothing was scored');
  }
  if (opa) {
    // fill opacity of the interior: min, 1st percentile, mean, fraction below 0.99 (n_opacity: pixels scored)
    let mn = 1, sum = 0, lt = 0;
    for (const t of opa) { if (t < mn) mn = t; sum += t; if (t < 0.99) lt++; }
    // strict: a metric that scored nothing (or far fewer pixels than the interior has) is unknown, not perfect
    const none = strict ? (!opa.length || opa.length < MIN_SCORED * nIn) : !opa.length;
    if (strict && none) problems.push(`opacity scored on ${opa.length} of ${nIn} interior pixels: reported as null`);
    m.opacity_min = none ? (strict ? null : 1) : mn;
    m.opacity_p01 = none ? (strict ? null : 1) : pctl(opa, 0.01);
    m.opacity_mean = none ? (strict ? null : 1) : sum / opa.length;
    m.opacity_lt99 = none ? (strict ? null : 0) : lt / opa.length;
    m.n_opacity = opa.length;
  }
  if (cerr) {
    // colour of the interior against the expected opaque fill colour (RGB units): share beyond COLOR_TOL, mean, p99
    let sum = 0, off = 0;
    for (const e of cerr) { sum += e; if (e > COLOR_TOL) off++; }
    const none = !cerr.length || cerr.length < MIN_SCORED * nIn;
    if (none) problems.push(`colour error scored on ${cerr.length} of ${nIn} interior pixels: reported as null`);
    m.color_off = none ? null : off / cerr.length;
    m.color_err_mean = none ? null : sum / cerr.length;
    m.color_err_p99 = none ? null : pctl(cerr, 0.99);
    m.n_color = cerr.length;
  }
  if (cellE) {
    m.cell_err_p99 = cellE.length ? pctl(cellE, 0.99) : null;
    m.cell_err_max = cellE.length ? Math.max(...cellE) : null;
  }
  if (T.holeIn) {
    // the disc that must stay empty: fill pixels deeper than the band inside it (count, of how many, fraction)
    m.hole_leak = leakN;
    m.hole_leak_px = leakIn;
    m.hole_leak_frac = leakIn ? leakN / leakIn : 0;
  }
  if (pm) {
    if (strict) {
      // parity of nothing is unknown: null when nothing was scored or far fewer pixels than the truth can score
      const none = !parN || parN < MIN_SCORED * parExp;
      if (none) problems.push(`parity scored on ${parN} of the ${parExp} pixels the truth can score: reported as null`);
      m.parity_acc = none ? null : parOk / parN;
      m.parity_exp = parExp;
      m.parity_excl_tie = fillIn ? parTie / fillIn : 0;
      if (pm === 'polar' && T.frontInDisc !== undefined) m.polar_front_disc_px = T.frontInDisc;
    } else m.parity_acc = parN ? parOk / parN : 1;
    m.parity_n = parN;
    m.parity_excl = fillIn ? 1 - parN / fillIn : 0;
    m.parity_excl_multi = fillIn ? parMulti / fillIn : 0;
    m.parity_excl_small = fillIn ? parSmall / fillIn : 0;
    m.parity_excl_edge = fillIn ? parEdge / fillIn : 0;
  }
  for (const k of Object.keys(m)) m[k] = r6(m[k]);
  return { metrics: m, map, problems };
}

// fraction of pixels whose color differs by more than thr (any channel, 0-255) after a 1 px blur ([1 2 1]/4, separable)
function blur(rgba, W, H) {
  const tmp = new Float32Array(W * H * 3), out = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    const a = rgba[4 * (y * W + Math.max(0, x - 1)) + c], b = rgba[4 * (y * W + x) + c], d = rgba[4 * (y * W + Math.min(W - 1, x + 1)) + c];
    tmp[3 * (y * W + x) + c] = (a + 2 * b + d) / 4;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
    const a = tmp[3 * (Math.max(0, y - 1) * W + x) + c], b = tmp[3 * (y * W + x) + c], d = tmp[3 * (Math.min(H - 1, y + 1) * W + x) + c];
    out[3 * (y * W + x) + c] = (a + 2 * b + d) / 4;
  }
  return out;
}
function goldenDiff(a, b, W, H, thr = 8) {
  const A = blur(a, W, H), B = blur(b, W, H);
  let n = 0;
  const map = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    const dm = Math.max(Math.abs(A[3 * k] - B[3 * k]), Math.abs(A[3 * k + 1] - B[3 * k + 1]), Math.abs(A[3 * k + 2] - B[3 * k + 2]));
    const g = Math.round(0.3 * a[4 * k] + 0.59 * a[4 * k + 1] + 0.11 * a[4 * k + 2]);
    const gg = Math.round(200 + 0.2 * g);
    if (dm > thr) { n++; map[4 * k] = 230; map[4 * k + 1] = 20; map[4 * k + 2] = 30; } else { map[4 * k] = gg; map[4 * k + 1] = gg; map[4 * k + 2] = gg; }
    map[4 * k + 3] = 255;
  }
  return { frac: r6(n / (W * H)), n, map };
}

// the colour of a checker cell by parity (0: c0, 1: c0-alt), for cell_err
function makeCellColor(colors) {
  const c0 = hexRGB(colors['--c1'], '#3B6FD4'), alt = hexRGB(colors['--c1-alt'], '#8CABE5');
  return (par) => (par ? alt : c0);
}

module.exports = { makeCellColor, CL_BG, CL_FILL, CL_ANNOT, CL_UNKNOWN, BAND, PAD, PARITY_MIN_CELL, PARITY_MIN_EDGE, UNKNOWN_DIST, COLOR_TOL, LEAK_T, TIE_OCT, MIN_SCORED, NEAR_ANNOT, FILLSEG, makeClassifier, makeOpacity, makeColorErr, sheetKey, frontOrder, frontParity, pixelMap, truthGrid, evaluate, goldenDiff, edt2 };

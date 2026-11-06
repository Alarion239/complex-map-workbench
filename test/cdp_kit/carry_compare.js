// The shared carried-vs-exact pixel check, page-side: run by H.carryCompare(opts) in the page of the steps view. The
// shown frame (a plane at rest; a parked frame answers { error }) is sampled on a grid of the left pane. Each sample w's
// points of plane z, each with its image in the colour plane T, are listed from the frame's own maps (__cmwSvFrame);
// they are ranked by the frame's sheet key (Inverse.sheetKey and Inverse.front, the region tiling's), and the pixel must
// have the front point's colour: the style's colouring of its image in T (opts.style 'phase' or 'enhanced', with
// opts.sectors; Inverse.dcolorRGB, the GPU's dcolorAt, with the footprints the neighbours give).
// A sample where the colour changes fast (a neighbour 1.5 px away has another number of points, or the front point's
// colour moves more than opts.steep) is not counted; a seam (another point within a hair of the front in the key) may
// show either.
// The points: Inverse.pointPre through the plan z → b (every branch, and opts.fam members of a periodic family).
// Regions as data: opts.own, the region's own points (Inside regions), { outside: [cx, cy, r] } or { annulus: [r1, r2] }
// about 0; opts.skip, points of plane z near which the plane draws over the colour, { circles: [[cx, cy, r], ...], eps };
// opts.skipW, samples near which the same holds in the shown plane, { discs: [[x, y, r], ...] }, { circles: [[cx, cy,
// r], ...], eps } (within eps of a circle) or { rays: [angle, ...], eps } (about 0); opts.cut, a cut of the map in
// plane z, { circle: [cx, cy, r] }: a sample whose point and its neighbours' lie on two sides of it is not judged.
// Returns { considered, wrong, blank, none, unlisted, filled, paper, rate, ex }: blank, a wrong sample on the plane's
// paper; filled, the samples with a point, judged or not; paper, the judged ones on the bare paper where their own
// colour is not near grey; ex, up to opts.nex
// wrong samples, each with w, its points [x, y, D] and the front's colour; paperAt, up to 8 of the samples on the paper.
// opts: { nx = 40, ny = 25, margin = 48 (device px), tol = 24 (a channel, 0-255), steep = 8, fam = 6, own, skip, skipW,
// nex = 3, style = 'phase', sectors = 12, at (points [x, y] of the shown plane to sample in place of the grid), surf ('sphere':
// the pane shows the plane on its globe, and each sample's point is the globe's pick, __cmwSphereWL; samples off the
// globe are left out; a pixel is judged up to the globe's light) }
(function carryCompare(o) {
  // (a pixel is grey, the bare paper, below PAPER_SPREAD between its channels; a point's own colour is not near grey
  // from OWN_SPREAD; a wrong pixel is blank (left unpainted) when its channels differ by less than BLANK in all; points
  // within SEAM_D of the front in the sheet key are a seam, either may show)
  const PAPER_SPREAD = 6, OWN_SPREAD = 24, BLANK = 12, SEAM_D = 0.02;
  o = Object.assign({ nx: 40, ny: 25, margin: 48, tol: 24, steep: 8, fam: 6, own: null, skip: null, skipW: null, cut: null, nex: 3, style: 'phase', sectors: 12 }, o || {});
  const C = CX.C;
  const angle = (a, b) => { const d = a - b; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  const own = !o.own ? null : o.own.outside ? (([x, y]) => Math.hypot(x - o.own.outside[0], y - o.own.outside[1]) > o.own.outside[2])
    : (([x, y]) => { const m = Math.hypot(x, y); return m > o.own.annulus[0] && m < o.own.annulus[1]; });
  const skip = !o.skip ? null : ([x, y]) => o.skip.circles.some(([cx, cy, r]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < o.skip.eps);
  const cutSide = !o.cut ? null : ([x, y]) => Math.hypot(x - o.cut.circle[0], y - o.cut.circle[1]) < o.cut.circle[2];
  const skipW = !o.skipW ? null : o.skipW.discs ? (([x, y]) => o.skipW.discs.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r))
    : o.skipW.circles ? (([x, y]) => o.skipW.circles.some(([cx, cy, r]) =>
        Math.abs(Math.hypot(x - cx, y - cy) - r) < o.skipW.eps))
      : (([x, y]) => o.skipW.rays.some((a) => angle(Math.atan2(y, x), a) < o.skipW.eps));
  const c = document.getElementById('canvasL'), x2d = c.getContext('2d'), W = c.width, H = c.height, d = x2d.getImageData(0, 0, W, H).data;
  const { pts, at } = samples(c);
  const fr = __cmwSvFrame(o.fam);
  if (fr.parked) return { error: 'the frame is parked between two planes; the check judges a plane at rest' };
  const K = fr.key;
  const prep = { win: K.win, R: K.R, rs: K.rs, sing: K.sing.map((q) => C(q[0], q[1])) };
  const pre = pointsOf(fr, pts);
  // (a point [x, y, gx, gy]: its colour, the style's colouring of its image in T (Inverse.dcolorRGB, the GPU's
  // dcolorAt as a point sample), kept on it)
  const col = (z) => z[4] || (z[4] = Inverse.dcolorRGB(o.style, Math.atan2(z[3], z[2]), Math.log(Math.max(Math.hypot(z[2], z[3]), 1e-300)), 0, 0, o.sectors).map((t) => t * 255));
  // (its colour with the GPU's footprints: ln|g| and arg g across one device pixel, from its nearest points at the
  // sample's neighbours 1.5 px right, left, down and up (nbs), as fwidth gives them: the style's anti-aliasing, its
  // |g| = 1 stroke, a zero's fade to grey)
  const colFp = (z, nbs) => {
    const lg = (q) => Math.log(Math.max(Math.hypot(q[2], q[3]), 1e-300)), ag = (q) => Math.atan2(q[3], q[2]);
    const m = nbs.map((q) => near(q, z));
    let flr = 0, faw = 0;
    if (m.every(Boolean)) {
      const da = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
      flr = (Math.abs(lg(m[0]) - lg(m[1])) + Math.abs(lg(m[2]) - lg(m[3]))) / 3;
      faw = (Math.abs(da(ag(m[0]), ag(m[1]))) + Math.abs(da(ag(m[2]), ag(m[3])))) / 3;
    }
    return Inverse.dcolorRGB(o.style, ag(z), lg(z), flr, faw, o.sectors).map((t) => t * 255);
  };
  const spread = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  const dist = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
  // (on the Sphere surface the globe is lit (SHADE_GLOBE in src/gl/01-state-glsl-2d.js): in linear light the colour is
  // scaled by LIT_LO..LIT_HI, its key light and limb darkening on the faces in front, and gains up to LIT_SPEC of
  // white in its highlight; a pixel matches when some light in those bounds brings the colour within tol of it)
  const LIT_LO = 0.68, LIT_HI = 1.02, LIT_SPEC = 0.05;
  const lin = (v) => { const t = v / 255; return t <= 0.04045 ? t / 12.92 : ((t + 0.055) / 1.055) ** 2.4; };
  const srgb = (t) => 255 * (t <= 0.0031308 ? 12.92 * t : 1.055 * Math.min(t, 1) ** (1 / 2.4) - 0.055);
  const lit = (got, want) => {
    const wl = want.map(lin);
    for (let a = LIT_LO; a <= LIT_HI + 1e-9; a += 0.01) {
      for (let h = 0; h <= LIT_SPEC + 1e-9; h += 0.005) {
        if (dist(got, wl.map((t) => srgb(a * t + h))) <= o.tol) return true;
      }
    }
    return false;
  };
  const match = (got, want) => dist(got, want) <= o.tol || (o.surf === 'sphere' && lit(got, want));
  const near = (zs, z) => { let best = null, bd = Infinity; for (const q of zs) { const e = Math.hypot(q[0] - z[0], q[1] - z[1]); if (e < bd) { bd = e; best = q; } } return best; };
  const keyOf = (z) => Math.min(Inverse.sheetKey(prep, C(z[0], z[1]), null), 1e6);
  // the front point and those within a hair of it (a seam: either may show)
  const fronts = (zs) => {
    const k = zs.map((z) => ({ z: C(z[0], z[1]), D: keyOf(z), p: z }));
    k.sort((p, q) => (Inverse.front(p, q) ? -1 : Inverse.front(q, p) ? 1 : 0));
    return k.filter((e) => e.D - k[0].D < SEAM_D).map((e) => e.p);
  };
  let considered = 0, wrong = 0, blank = 0, none = 0, unlisted = 0, filled = 0, paper = 0;
  const ex = [], paperAt = [];
  for (let s = 0; s < at.length; s++) {
    if (!pts[5 * s]) continue;   // (off the globe)
    let P0 = pre[5 * s];
    if (P0 == null) { unlisted++; continue; }
    if (skipW && skipW(pts[5 * s])) continue;
    if (skip && P0.some((z) => skip(z))) continue;
    if (own) P0 = P0.filter((z) => own(z));
    if (!P0.length) { none++; continue; }
    const nb = [1, 2, 3, 4].map((k) => (pre[5 * s + k] || []).filter((z) => !own || own(z)));
    filled++;
    if (nb.some((q) => q.length !== P0.length)) continue;
    const cand = fronts(P0);
    if (cand.length > 64 || cand.some((z) => nb.some((q) => dist(col(z), col(near(q, z))) > o.steep))) continue;
    // (on a cut of the map (opts.cut): a sample whose point and its neighbours' are on two sides of it shows either)
    if (cutSide && cand.some((z) => nb.some((q) => cutSide(near(q, z)) !== cutSide(z)))) continue;
    considered++;
    const [px, py] = at[s], n = 4 * (py * W + px), got = [d[n], d[n + 1], d[n + 2]];
    // (a judged sample on the paper where its own colour is not near grey: where the colour changes slowly, so not a
    // zero of the map nor its |g| = 1 stroke, which the steep test leaves out)
    if (spread(got) < PAPER_SPREAD && cand.every((z) => spread(colFp(z, nb)) >= OWN_SPREAD)) { paper++; if (paperAt.length < 8) paperAt.push({ px, py, w: pts[5 * s], got }); }
    if (cand.some((z) => match(got, colFp(z, nb)))) continue;
    wrong++;
    if (Math.abs(got[0] - got[1]) + Math.abs(got[1] - got[2]) < BLANK) blank++;
    if (ex.length < o.nex) ex.push({ px, py, w: pts[5 * s], got, want: cand.slice(0, 3).map((z) => colFp(z, nb).map(Math.round)), z: cand[0].slice(0, 2), all: P0.map((z) => [z[0], z[1], keyOf(z)]) });
  }
  return { considered, wrong, blank, none, unlisted, filled, paper, rate: considered ? +(wrong / considered).toFixed(4) : null, ex, paperAt };

  // the samples: the grid, or opts.at's points of the shown plane where they fall on the pane within the margin, each
  // with its 4 neighbours 1.5 device px away (pts: 5 plane points a sample; at: its device pixel)
  function samples(cv) {
    const b = cv.getBoundingClientRect(), sx = b.width / W, sy = b.height / H, M = __cmwPlaneMenu();
    const pts = [], at = [], cells = [];
    if (o.at) for (const [x, y] of o.at) { const q = M.w2s('L', x, y); if (!q) continue; const px = Math.round((q[0] - b.left) / sx), py = Math.round((q[1] - b.top) / sy); if (px >= o.margin && py >= o.margin && px < W - o.margin && py < H - o.margin) cells.push([px, py]); }
    else for (let j = 0; j < o.ny; j++) for (let i = 0; i < o.nx; i++) cells.push([Math.round(o.margin + (W - 2 * o.margin) * (i + 0.5) / o.nx), Math.round(o.margin + (H - 2 * o.margin) * (j + 0.5) / o.ny)]);
    // (on the Sphere surface a sample's point is the globe's own pick, null off the globe)
    const pick = o.surf === 'sphere' ? (x, y) => __cmwSphereWL(x * sx, y * sy) : (x, y) => M.s2w('L', b.left + x * sx, b.top + y * sy);
    for (const [px, py] of cells) {
      for (const [ox, oy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) pts.push(pick(px + ox, py + oy));
      at.push([px, py]);
    }
    return { pts, at };
  }
  // each sample's points of plane z, each with its image in the colour plane T, [x, y, gx, gy] (null: the frame's maps
  // could not list them all)
  function pointsOf(f, ws) {
    const roots = ws.map((w) => (w ? [C(w[0], w[1])] : null));
    return roots.map((vs, i) => {
      if (!ws[i] || !vs) return null;
      const zs = [];
      for (const v of vs) { const r = f.pre(v); if (!r) return null; zs.push(...r); }
      return zs.filter((z) => CX.abs(z) < 1e6).map((z) => { let g = null; try { g = f.G(z); } catch (e) { g = null; } return g && CX.isFin(g) ? [z.re, z.im, g.re, g.im] : null; }).filter(Boolean);
    });
  }
})

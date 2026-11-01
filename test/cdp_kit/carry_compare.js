// The shared carried-vs-exact pixel check, page-side: run by H.carryCompare(opts) in the page of the steps view. The
// shown frame (a plane at rest, or parked between two planes) is sampled on a grid of the left pane. Each sample w's
// points of plane z, each with its image in the colour plane T, are listed from the frame's own maps (__cmwSvFrame);
// they are ranked by the frame's sheet key (Inverse.sheetKey and Inverse.front, the region tiling's), and the pixel must
// have the front point's colour: the style's colouring of its image in T (opts.style 'phase' or 'enhanced', with
// opts.sectors; Inverse.dcolorRGB, the GPU's dcolorAt, with the footprints the neighbours give).
// A sample where the colour changes fast (a neighbour 1.5 px away has another number of points, or the front point's
// colour moves more than opts.steep) is not counted; a seam (another point within a hair of the front in the key) may
// show either.
// The points: at rest, Inverse.pointPre through the plan z → b (every branch, and opts.fam members of a periodic family).
// Parked (H_u after the steps before b), the points v of plane b - 1 with H_u(v) = w first: H_u on a 360 × 240 grid
// over the key's window widened by a window each side, its triangles filed by their images' boxes over the samples'
// box; a cell whose image is wide or undefined (beside a pole, across a cut, Joukowski's disc beside the tanh pole at
// |z| → 1) on a 16 × 16 grid of its own; each triangle whose image holds w a start for Newton, kept where it converges;
// and starts about each simple pole p of H_u, p + a / w (a its residue). Then the plan back to z.
// Regions as data: opts.own, the region's own points (Inside regions), { outside: [cx, cy, r] } or { annulus: [r1, r2] }
// about 0; opts.skip, points of plane z near which the plane draws over the colour, { circles: [[cx, cy, r], ...], eps };
// opts.skipW, samples near which the same holds in the shown plane, { discs: [[x, y, r], ...] } or { rays: [angle, ...],
// eps } (about 0).
// Returns { considered, wrong, blank, none, unlisted, filled, paper, rate, ex }: blank, a wrong sample on the plane's
// paper; filled, the samples with a point, judged or not; paper, the judged ones on the bare paper where their own
// colour is not near grey; ex, up to opts.nex
// wrong samples, each with w, its points [x, y, D] and the front's colour; paperAt, up to 8 of the samples on the paper.
// opts: { nx = 40, ny = 25, margin = 48 (device px), tol = 24 (a channel, 0-255), steep = 8, fam = 6, own, skip, skipW,
// nex = 3, style = 'phase', sectors = 12, at (points [x, y] of the shown plane to sample in place of the grid) }
(function carryCompare(o) {
  o = Object.assign({ nx: 40, ny: 25, margin: 48, tol: 24, steep: 8, fam: 6, own: null, skip: null, skipW: null, nex: 3, style: 'phase', sectors: 12 }, o || {});
  const C = CX.C;
  const angle = (a, b) => { const d = a - b; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); };
  const own = !o.own ? null : o.own.outside ? (([x, y]) => Math.hypot(x - o.own.outside[0], y - o.own.outside[1]) > o.own.outside[2])
    : (([x, y]) => { const m = Math.hypot(x, y); return m > o.own.annulus[0] && m < o.own.annulus[1]; });
  const skip = !o.skip ? null : ([x, y]) => o.skip.circles.some(([cx, cy, r]) => Math.abs(Math.hypot(x - cx, y - cy) - r) < o.skip.eps);
  const skipW = !o.skipW ? null : o.skipW.discs ? (([x, y]) => o.skipW.discs.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r))
    : (([x, y]) => o.skipW.rays.some((a) => angle(Math.atan2(y, x), a) < o.skipW.eps));
  const c = document.getElementById('canvasL'), x2d = c.getContext('2d'), W = c.width, H = c.height, d = x2d.getImageData(0, 0, W, H).data;
  const b = c.getBoundingClientRect(), sx = b.width / W, sy = b.height / H, M = __cmwPlaneMenu();
  const pts = [], at = [];
  // (the samples: the grid, or opts.at's points of the shown plane where they fall on the pane within the margin)
  const cells = [];
  if (o.at) for (const [x, y] of o.at) { const q = M.w2s('L', x, y); if (!q) continue; const px = Math.round((q[0] - b.left) / sx), py = Math.round((q[1] - b.top) / sy); if (px >= o.margin && py >= o.margin && px < W - o.margin && py < H - o.margin) cells.push([px, py]); }
  else for (let j = 0; j < o.ny; j++) for (let i = 0; i < o.nx; i++) cells.push([Math.round(o.margin + (W - 2 * o.margin) * (i + 0.5) / o.nx), Math.round(o.margin + (H - 2 * o.margin) * (j + 0.5) / o.ny)]);
  for (const [px, py] of cells) {
    for (const [ox, oy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) pts.push(M.s2w('L', b.left + (px + ox) * sx, b.top + (py + oy) * sy));
    at.push([px, py]);
  }
  const fr = __cmwSvFrame(o.fam), K = fr.key;
  const prep = { win: K.win, R: K.R, rs: K.rs, sing: K.sing.map((q) => C(q[0], q[1])) };
  const roots = fr.H ? deformRoots(fr, pts) : pts.map(([x, y]) => [C(x, y)]);
  const pre = roots.map((vs) => {
    const zs = [];
    for (const v of vs) { const r = fr.pre(v); if (!r) return null; zs.push(...r); }
    return zs.filter((z) => CX.abs(z) < 1e6).map((z) => { let g = null; try { g = fr.G(z); } catch (e) { g = null; } return g && CX.isFin(g) ? [z.re, z.im, g.re, g.im] : null; }).filter(Boolean);
  });
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
  const near = (zs, z) => { let best = null, bd = Infinity; for (const q of zs) { const e = Math.hypot(q[0] - z[0], q[1] - z[1]); if (e < bd) { bd = e; best = q; } } return best; };
  const keyOf = (z) => Math.min(Inverse.sheetKey(prep, C(z[0], z[1]), null), 1e6);
  // the front point and those within a hair of it (a seam: either may show)
  const fronts = (zs) => {
    const k = zs.map((z) => ({ z: C(z[0], z[1]), D: keyOf(z), p: z }));
    k.sort((p, q) => (Inverse.front(p, q) ? -1 : Inverse.front(q, p) ? 1 : 0));
    return k.filter((e) => e.D - k[0].D < 0.02).map((e) => e.p);
  };
  let considered = 0, wrong = 0, blank = 0, none = 0, unlisted = 0, filled = 0, paper = 0;
  const ex = [], paperAt = [];
  for (let s = 0; s < at.length; s++) {
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
    considered++;
    const [px, py] = at[s], n = 4 * (py * W + px), got = [d[n], d[n + 1], d[n + 2]];
    // (a judged sample on the paper where its own colour is not near grey: where the colour changes slowly, so not a
    // zero of the map nor its |g| = 1 stroke, which the steep test leaves out)
    if (spread(got) < 6 && cand.every((z) => spread(colFp(z, nb)) >= 24)) { paper++; if (paperAt.length < 8) paperAt.push({ px, py, w: pts[5 * s], got }); }
    if (cand.some((z) => dist(got, colFp(z, nb)) <= o.tol)) continue;
    wrong++;
    if (Math.abs(got[0] - got[1]) + Math.abs(got[1] - got[2]) < 12) blank++;
    if (ex.length < o.nex) ex.push({ px, py, w: pts[5 * s], got, want: cand.slice(0, 3).map((z) => colFp(z, nb).map(Math.round)), z: cand[0].slice(0, 2), all: P0.map((z) => [z[0], z[1], keyOf(z)]) });
  }
  return { considered, wrong, blank, none, unlisted, filled, paper, rate: considered ? +(wrong / considered).toFixed(4) : null, ex, paperAt };

  // The points v of plane b - 1 with H_u(v) = w, for each sample w ([C, ...] per point; see above)
  function deformRoots(f, ws) {
    const kw = f.key.win, mx = kw.x1 - kw.x0, my = kw.y1 - kw.y0, box = { x0: kw.x0 - mx, x1: kw.x1 + mx, y0: kw.y0 - my, y1: kw.y1 + my };
    const grid = imageGrid(f.H, box, ws, 360, 240, 16);
    const poles = f.poles(f.H, box, 16).map((p) => { const e = 1e-6 * (1 + CX.abs(p)); return { p, a: CX.scale(f.H(CX.add(p, C(e, 0))), e), r: 0.25 * mx }; });
    return ws.map(([re, im]) => {
      const w = C(re, im), tol = 1e-10 * (1 + CX.abs(w)), vs = [];
      const add = (v) => { if (v && CX.isFin(v) && !vs.some((q) => CX.abs(CX.sub(q, v)) < 1e-7 * (1 + CX.abs(v)))) vs.push(v); };
      for (const s of grid.starts(re, im)) add(f.newton(f.H, w, s.z, 1, tol, s.lim));
      for (const q of poles) add(f.newton(f.H, w, CX.add(q.p, CX.div(q.a, w)), 1, tol, q.r));
      return vs;
    });
  }
  // F on an nx × ny grid over box, its triangles filed by their images' boxes over the box of the points ws (64 × 40
  // buckets; a triangle over 64 of them left out); a cell whose image passes 4 buckets or is undefined somewhere, on a
  // sub × sub grid of its own. starts(x, y): for each filed triangle whose image holds (x, y), the same barycentric mix
  // of its points in the plane of F, { z, lim } with lim twice the triangle's size
  function imageGrid(F, box, ws, nx, ny, sub) {
    const BX = 64, BY = 40, hx = (box.x1 - box.x0) / nx, hy = (box.y1 - box.y0) / ny;
    const at2 = (x, y) => { let v = null; try { v = F(C(x, y)); } catch (e) { v = null; } return v && CX.isFin(v) ? [v.re, v.im, x, y] : null; };
    const pb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const [x, y] of ws) { pb.x0 = Math.min(pb.x0, x); pb.x1 = Math.max(pb.x1, x); pb.y0 = Math.min(pb.y0, y); pb.y1 = Math.max(pb.y1, y); }
    const bw = (pb.x1 - pb.x0) / BX || 1, bh = (pb.y1 - pb.y0) / BY || 1;
    const buckets = Array.from({ length: BX * BY }, () => /** @type {number[][]} */ ([]));
    const span = (t) => {
      if (t.some((q) => !q)) return { n: Infinity };
      const x0 = Math.min(t[0][0], t[1][0], t[2][0]), x1 = Math.max(t[0][0], t[1][0], t[2][0]), y0 = Math.min(t[0][1], t[1][1], t[2][1]), y1 = Math.max(t[0][1], t[1][1], t[2][1]);
      if (x1 < pb.x0 || x0 > pb.x1 || y1 < pb.y0 || y0 > pb.y1) return { n: 0, out: true };
      const a0 = Math.max(0, Math.floor((x0 - pb.x0) / bw)), a1 = Math.min(BX - 1, Math.floor((x1 - pb.x0) / bw)), b0 = Math.max(0, Math.floor((y0 - pb.y0) / bh)), b1 = Math.min(BY - 1, Math.floor((y1 - pb.y0) / bh));
      return { n: (a1 - a0 + 1) * (b1 - b0 + 1), a0, a1, b0, b1 };
    };
    const file = (t, sp) => { if (sp.out || !(sp.n <= 64)) return; const flat = t.flat(); for (let bj = sp.b0; bj <= sp.b1; bj++) for (let bi = sp.a0; bi <= sp.a1; bi++) buckets[bj * BX + bi].push(flat); };
    const g = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g.push(at2(box.x0 + i * hx, box.y0 + j * hy));
    const V = (i, j) => g[j * (nx + 1) + i];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const A = V(i, j), B = V(i + 1, j), Cc = V(i + 1, j + 1), D = V(i, j + 1), t1 = [A, B, Cc], t2 = [A, Cc, D], s1 = span(t1), s2 = span(t2);
      if (s1.n <= 4 && s2.n <= 4) { file(t1, s1); file(t2, s2); continue; }
      const x0 = box.x0 + i * hx, y0 = box.y0 + j * hy, f = [];
      for (let q = 0; q <= sub; q++) for (let r = 0; r <= sub; r++) f.push(at2(x0 + r * hx / sub, y0 + q * hy / sub));
      const G = (r, q) => f[q * (sub + 1) + r];
      for (let q = 0; q < sub; q++) for (let r = 0; r < sub; r++) for (const t of [[G(r, q), G(r + 1, q), G(r + 1, q + 1)], [G(r, q), G(r + 1, q + 1), G(r, q + 1)]]) file(t, span(t));
    }
    return {
      starts(re, im) {
        const bi = Math.min(BX - 1, Math.max(0, Math.floor((re - pb.x0) / bw))), bj = Math.min(BY - 1, Math.max(0, Math.floor((im - pb.y0) / bh))), out = [];
        for (const [ax, ay, azx, azy, bx, by, bzx, bzy, cx, cy, czx, czy] of buckets[bj * BX + bi]) {
          const dd = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
          if (!dd) continue;
          const l1 = ((by - cy) * (re - cx) + (cx - bx) * (im - cy)) / dd, l2 = ((cy - ay) * (re - cx) + (ax - cx) * (im - cy)) / dd, l3 = 1 - l1 - l2;
          if (l1 < -0.05 || l2 < -0.05 || l3 < -0.05) continue;
          out.push({ z: C(l1 * azx + l2 * bzx + l3 * czx, l1 * azy + l2 * bzy + l3 * czy), lim: 2 * Math.max(Math.hypot(bzx - azx, bzy - azy), Math.hypot(czx - azx, czy - azy)) });
        }
        return out;
      },
    };
  }
})

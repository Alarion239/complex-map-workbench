// (#551, #584, #590) The shared carried-vs-exact pixel check, page-side: run by H.carryCompare(opts) in the page of the
// steps view. The shown plane b (or opts.b) is sampled on a grid of the left pane; each sample w's points of plane z
// (__cmwSvPre: the plan z → b, every branch, and opts.fam members of a periodic family), each with its image in the
// colour plane T, are ranked by the steps view's own sheet key (__cmwSvKey: Inverse.sheetKey and Inverse.front, the
// region tiling's), and the pixel must have the front point's colour: the phase wheel at the arg of its image in T
// (GLR.phaseRGB at 0.75: the Phase style, opts.style 'phase'). A sample where the colour changes fast (a neighbour
// 1.5 px away has another number of points, or the front point's colour moves more than opts.steep) is not counted;
// a seam (another point within a hair of the front in the key) may show either. opts.own: the source of a predicate
// on a point [x, y] of plane z, the region's own points (Inside regions); a sample with none of them is not counted.
// opts.skip: the source of a predicate on a point [x, y] of plane z near which the plane draws over the colour (a region's
// outline, a label): a sample with any point there is not counted; opts.skipW: the same on the shown frame's point [x, y]
// (an image of a branch cut of the deformation, a label placed in that plane).
// Parked between two planes it is the frame (H_u after the steps before b) whose points __cmwSvPre lists, by the key of b.
// Returns { considered, wrong, blank, none, unlisted, rate, ex } (blank: a wrong sample left the plane's paper).
// opts: { b, nx = 40, ny = 25, margin = 48 (device px), tol = 24 (a channel, 0-255), steep = 8, fam = 6, own, skip, skipW,
// nex = 3 (wrong samples kept in ex, each with w, its points [x, y, D] and the front's colour) }
(function carryCompare(o) {
  o = Object.assign({ nx: 40, ny: 25, margin: 48, tol: 24, steep: 8, fam: 6, own: null, skip: null, skipW: null }, o || {});
  const own = o.own ? (0, eval)('(' + o.own + ')') : null, skip = o.skip ? (0, eval)('(' + o.skip + ')') : null, skipW = o.skipW ? (0, eval)('(' + o.skipW + ')') : null;
  const c = document.getElementById('canvasL'), x2d = c.getContext('2d'), W = c.width, H = c.height, d = x2d.getImageData(0, 0, W, H).data;
  const b = c.getBoundingClientRect(), sx = b.width / W, sy = b.height / H, M = __cmwPlaneMenu();
  const pts = [], at = [];
  for (let j = 0; j < o.ny; j++) for (let i = 0; i < o.nx; i++) {
    const px = Math.round(o.margin + (W - 2 * o.margin) * (i + 0.5) / o.nx), py = Math.round(o.margin + (H - 2 * o.margin) * (j + 0.5) / o.ny);
    for (const [ox, oy] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) pts.push(M.s2w('L', b.left + (px + ox) * sx, b.top + (py + oy) * sy));
    at.push([px, py]);
  }
  const pre = __cmwSvPre(pts, o.fam, o.b);
  const K = __cmwSvKey(pre.b);
  const prep = { win: K.win, R: K.R, rs: K.rs, sing: K.sing.map((q) => CX.C(q[0], q[1])) };
  // (a point [x, y, gx, gy]: its colour, the wheel at arg of its image in T, kept on it)
  const col = (z) => z[4] || (z[4] = GLR.phaseRGB(Math.atan2(z[3], z[2]), 0.75).map((t) => t * 255));
  const dist = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
  const near = (zs, z) => { let best = null, bd = Infinity; for (const q of zs) { const e = Math.hypot(q[0] - z[0], q[1] - z[1]); if (e < bd) { bd = e; best = q; } } return best; };
  // the front point and those within a hair of it (a seam: either may show)
  const fronts = (zs) => {
    const k = zs.map((z) => ({ z: CX.C(z[0], z[1]), D: Math.min(Inverse.sheetKey(prep, CX.C(z[0], z[1]), null), 1e6), p: z }));
    k.sort((p, q) => (Inverse.front(p, q) ? -1 : Inverse.front(q, p) ? 1 : 0));
    return k.filter((e) => e.D - k[0].D < 0.02).map((e) => e.p);
  };
  let considered = 0, wrong = 0, blank = 0, none = 0, unlisted = 0;
  const ex = [];
  for (let s = 0; s < at.length; s++) {
    let P0 = pre[5 * s];
    if (P0 == null) { unlisted++; continue; }
    if (skipW && skipW(pts[5 * s])) continue;
    if (skip && P0.some((z) => skip([z[0], z[1]]))) continue;
    if (own) P0 = P0.filter((z) => own([z[0], z[1]]));
    if (!P0.length) { none++; continue; }
    const nb = [1, 2, 3, 4].map((k) => (pre[5 * s + k] || []).filter((z) => !own || own([z[0], z[1]])));
    if (nb.some((q) => q.length !== P0.length)) continue;
    const cand = fronts(P0);
    if (cand.length > 64 || cand.some((z) => nb.some((q) => dist(col(z), col(near(q, z))) > o.steep))) continue;
    considered++;
    const [px, py] = at[s], n = 4 * (py * W + px), got = [d[n], d[n + 1], d[n + 2]];
    if (cand.some((z) => dist(got, col(z)) <= o.tol)) continue;
    wrong++;
    if (Math.abs(got[0] - got[1]) + Math.abs(got[1] - got[2]) < 12) blank++;
    if (ex.length < (o.nex || 3)) ex.push({ px, py, w: pts[5 * s], got, want: cand.slice(0, 3).map((z) => col(z).map(Math.round)), z: cand[0].slice(0, 2), all: P0.map((z) => [z[0], z[1], Inverse.sheetKey(prep, CX.C(z[0], z[1]), null)]) });
  }
  return { considered, wrong, blank, none, unlisted, rate: considered ? +(wrong / considered).toFixed(4) : null, ex };
})

// The steps view's Landscape glide is exact: a moving frame at u between plane z and the next is drawn like a parked
// frame, an N x N grid over the shown plane's box, but its height and colour at a place w come from the preimages
// z = H_u^-1(w) of the glide's map H_u (the inverse plan, src/inverse.js), not from plane z's grid pushed forward through
// H_u. The cases (Landscape of Im F, one pane and camera, each with Inside regions' sheets off or with All sheets):
// the square root under a Möbius map, the logarithm of an annulus, a cube root, the Joukowski airfoil, Roots as preimages
// and the partial sums of the exponential (the last two draw through the Newton's roots pass). Each is held at
// u = END_U, 0.002, 0.5, 0.998 and 1 - END_U of the glide from the first plane to the second, where:
// - the path: the frame's record says 'inverse' (render3D.carried.path), not 'mesh';
// - the geometry: at probe places w (a grid over the box and a pair either side of the real axis) the frame's per-vertex draw
//   data (window.__cmwLandFrameVerts(pts): per place the layers the frame draws there, { h: height, f: F, member, w }) is the CPU
//   reference's: the enumerator's preimages of w (window.__cmwLandEnum, src/inverse.js's Inverse.enumerate on the plan the frame
//   inverts), h the frame's own height of F(z); All sheets: every member (the same number of layers, the same heights within
//   HEIGHT_TOL); sheets off: one layer, the front member; and the layers' colour is the members' (arg F within PHASE_TOL);
// - the coverage: COVER_NX x COVER_NY places over the box are each drawn (the frame has a layer at its grid vertex) or covered (the
//   reference has a preimage there), and at most CELL_TOL of them differ either way; at the ends also the surface pixels (saturation
//   over 30, the measure of steps_land_cover_cmd.js's surface(), counted on the kit's kept pixels) are at least the parked plane's
//   less COVER_TOL; negative controls: a hole, and a wall filled across the cut, fail the comparison;
// - the image: u below 0.5 is plane z's parked frame and u above it the next plane's, at most SAME_FRAC of the pixels more
//   than DIFF_TOL apart (the exact images' tolerance, steps_sm_standin_cmd.js).
// An expression for eval in a command file of a CDP daemon (test/cdp_kit README), which sees its globals (fs, DIR, ev, go,
// settled, loadView, view): `return await eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'land_exact.js'), 'utf8'))(modes)`, with modes the
// Inside regions' sheets settings to run, [false] (sheets off) or [true] (All sheets). Answers {pass, fails, info}.
(async (MODES) => {
  const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
  const fails = [], info = {};
  const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
  const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
  const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
  const VIEW_W = 1440, VIEW_H = 900;
  const LOAD_MAX_MS = 60000;
  const END_U = 1e-4;   // (a polynomial's step runs its path several times as fast as the glide's u: its ends are this far from the planes)
  const TOP_CAM = { yaw: -Math.PI / 2, pitch: 88 * Math.PI / 180 };   // the Top view: the camera the end frames are also compared in, where a missing piece of the surface shows against the pale floor
  const GLIDE_MID = 0.5;   // (the glide's middle: probes before it are near plane z, after it near the next plane)
  const MID_U = [0.25, 0.75];   // (probes inside the glide: no parked plane to compare with, so the exact map alone judges them)
  const GLIDE_U = [END_U, 0.002, MID_U[0], GLIDE_MID, MID_U[1], 0.998, 1 - END_U];
  // (the probes at 0.002 and 0.998 are the far-end check: the height axis's scale is eased between the two planes' scales, so a correct
  // frame there matches the parked plane within SAME_FRAC; END_U is the ends of a polynomial's glide)
  const { grab, compare, DIFF_TOL, SAME_FRAC } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));   // (the look suite's constants)
  // the share of the parked plane's surface pixels a frame at an end may lack: it is the parked plane's within SAME_FRAC of its pixels,
  // so a surface pixel it lacks is one of those
  const COVER_TOL = SAME_FRAC;
  // The end frames in the Top view: at most HUE_OFF_MAX coloured pixels with a hue HUE_OFF_DEG or more from the parked plane's.
  // The floor is what a frame within float precision of the parked plane (u = 1e-5 and 0.99999) shows against it: 0 to 9 pixels on
  // the cases without a hue-shifted row, 23 on the Joukowski airfoil, the largest; a hue-shifted row at a sheet boundary is
  // over 200 (Roots 310 and Newton 201 at u = 0.99999). The bound is 4 times the largest floor, rounded up to 100. Two different
  // planes' parked frames are far over it (the control in each case).
  const HUE_OFF_DEG = 40, HUE_OFF_MAX = 100;
  const COMBO_CONTROL = ['Möbius, √', 'log of an annulus', 'cube root'];   // the cases with a multivalued step: a sheet combo one off must turn the Top view's hue over HUE_OFF_MAX
  // the coverage at every u, against the CPU reference: COVER_NX x COVER_NY places over the box, each drawn (the frame has a layer at
  // its grid vertex) or covered (the reference has a preimage there); the places that differ either way are at most CELL_TOL of them
  // (two places of the grid: a vertex beside a cut falls on either side of it); the controls' hole is 8 places and the wall fills one column
  // a member is a preimage of its place when the frame's homotopy maps it within HOM_TOL (relative) of the place; the control moves every place
  // by HOM_SHIFT, which must exceed it
  const HOM_TOL = 1e-5, HOM_SHIFT = 1e-3;
  const WIND_PLACES = 12, WIND_HMIN_CTL = 0.1;   // (places counted per frame; the control's step floor, as a fraction of a piece)
  const HOM_MAX = 400;   // (members checked per frame)
  const COVER_NX = 20, COVER_NY = 14, CELL_TOL = 0.02, HOLE_N = 8;
  // the exact image reference's raster (window.__lxRaster): the box's lattice (nx x ny cells, each halved up to depth times where the
  // surface needs it), a covered cell a facet when its centre's projection is within step half-resolution pixels of its corners' mean (the finest
  // cells: their corners within jump pixels, a larger jump is a cut's wall), at most cap places
  // looked up; the masks agree within slack half-resolution pixels (the frame's edge pixels and the projected points' rounding), and
  // at most RASTER_TOL of the reference's pixels are unmatched either way
  const MASK_ON = 0.5;   // the Inside-regions mask (window.__cmwLandMask, 0 to 1, null with none) at which a place counts as drawn: half
  const REF = { nx: 40, ny: 34, depth: 5, depthMax: 8, calm: 2, step: 0.75, jump: 3, cap: 600000, slack: 1, batch: 500 }
  const RASTER_TOL = SAME_FRAC;
  const STEP_MAX = 400;   // at most this many raster steps a frame (STEP_MS each): more is a reference that never finishes, and fails
  const SHALLOW = { depth: 1, depthMax: 2 }, LEVELS_CTL = 2;   // the controls' settings: a lattice too coarse to be converged, and too few levels to judge every cell
  const STEP_MS = 15000;   // a raster step's time in the page: a CDP call stays well under its limit
  const PHASE_TOL = 2 * Math.PI / 180, F_ABS_MIN = 1e-3;   // the member's colour (arg F): at most 2 degrees apart where |F| is not near 0
  const CUT_X = [0.1, 0.3], CUT_OFF = 0.01;                 // probes either side of the real axis: at these shares of the box's width, this share of its height off the axis
  const HEIGHT_TOL = 0.02;                      // the drawn height, world units (a box is about 2 wide)
  const PROBES = 5, SAT_MIN = 30;
  const BRANCH_NEAR = 2;   // grid scales: a flagged vertex this close to a branch point of the step (the case's branch list, in the step's input plane: z = 0 for the root and the logarithm, whose place is 0 or infinite) is in a cell the branch point drops
  const BRANCH_RING = 4;   // chords: the flagged edges this close to a vertex, and themselves at a branch point, set the grid's scale there (the largest of their chords); the scale is local because the grid is refined toward the branch point
  // The branch points of a scene's steps, in the plane of the glided step's input (the first step's, so the chain before it is the identity): the root's
  // and the logarithm's are 0, a Möbius map has none; any other type throws, so a new step type is classed here before a row can use it.
  const branchPoints = (steps) => steps.flatMap((s, i) => {
    if (s.type === 'mobius') return [];
    if (s.type !== 'root' && s.type !== 'log') throw new Error('branchPoints: no branch points are defined for the step type ' + s.type);
    if (i > 0) throw new Error('branchPoints: the forward chain before step ' + i + ' is not defined');
    return [[0, 0]];
  });
  const CUT_ROWS = { 'cube root': [0.25, 0.5, 0.75], 'log of an annulus': [0.25, 0.5, 0.75] };   // the frames whose cut edges are checked against the step's own cut
  // The grid has ROWS_SIDE rows on each side of the real axis and none on it (the axis is the cut of the roots and the logarithm, where
  // the side a place falls on is decided by the sign of a rounding error in float32 and in float64): a row is at (k + 0.5) / ROWS_SIDE
  // of the box's extent above and below the axis, so both sides have the same density.
  const ROWS_SIDE = 3;
  const Z_TOL = 1e-2;   // the frame's z is the shader's float inverse: a cube root's preimage is w cubed, so its relative error is three times the map's
  const SAME_Z = 1e-5;   // the distance under which two preimages the enumerator lists (the sheets beside the frame's own repeat them) are one member when their drawn heights agree too (members of different sheets of a step come together in z as u falls but are different surfaces)
  const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
  const CASES = [
    { tag: 'Möbius, √', steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [] },
    // the pole of the step (z = -1) is inside the box: the frame covers the block about it, the cover steps_land_poles holds for the mesh path
    { tag: 'Möbius with a pole in the box', steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }], shapes: [] },
    { tag: 'log of an annulus', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN },
    { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [] },
    { tag: 'Joukowski airfoil', example: 'Joukowski airfoil' },
    { tag: 'Roots as preimages', example: 'Roots as preimages' },
    { tag: 'Partial sums of the exponential (Newton)', example: 'Partial sums of the exponential' },
  ];
  // the page's helpers: the surface pixels of the left pane, and the CPU reference's members at places w: the enumerator's preimages
  // (window.__cmwLandEnum, src/inverse.js's Inverse.enumerate on the plan the frame inverts) without the repeats of one z, each
  // { z, f, h } (null when the frame was not drawn by the inverse path); the front member (sheets off) is the first
  const HELP = `window.__lx = {
    // the pixels where both frames are coloured (saturation over SAT_MIN) and their hues are more than HUE_OFF_DEG apart: a row the
    // colour of the wrong branch draws across a sheet boundary shows here, a shifted contour line (the same hue, lighter or darker) does not
    hueOff: (a, b) => {
      const x = window.__heldPx[a], y = window.__heldPx[b], hue = (d, i) => { const r = d[i], g = d[i + 1], bl = d[i + 2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl); if (mx - mn <= ${SAT_MIN}) return -1; const h = mx === r ? (g - bl) / (mx - mn) : (mx === g ? 2 + (bl - r) / (mx - mn) : 4 + (r - g) / (mx - mn)); return (h * 60 + 360) % 360; };
      let n = 0;
      for (let i = 0; i < x.length; i += 4) { const p = hue(x, i), q = hue(y, i); if (p >= 0 && q >= 0) { const d = Math.abs(p - q); if (Math.min(d, 360 - d) > ${HUE_OFF_DEG}) n++; } }
      return n;
    },
    // where the cut was found on each flagged edge, against the step's own cut (the negative real axis of its input plane, which is plane
    // z here): the worst distance of a crossing's preimage z* = a + t (b - a) to the ray, in shares of the edge's chord |b - a|, over the edges whose
    // crossing is inside the chord (n), and how many sit at an end of it (atEnd: the vertex itself is taken as the cut)
    cutT: () => {
      const r = window.__cmwLandCutEdges();
      if (!r) return null;
      const tol = Math.pow(2, 1 - r.steps);
      let worst = 0, atEnd = 0, n = 0;
      for (const [ax, ay, bx, by, t] of r.edges) {
        if (t < tol || t > 1 - tol) { atEnd++; continue; }
        n++;
        const x = ax + t * (bx - ax), y = ay + t * (by - ay), chord = Math.hypot(bx - ax, by - ay);
        worst = Math.max(worst, (x < 0 ? Math.abs(y) : Math.hypot(x, y)) / chord);
      }
      return { n, atEnd, worst, steps: r.steps };
    },
    // Each flagged edge whose cut is at an end of its chord (the vertex taken as the cut), in exactly one class: onCut (that vertex is within tol of
    // the chord's length of the step's cut), seam (the ends' codes differ, and their preimages are two members of the glide's map, by the page's seam
    // test: neither end's preimage, carried along the edge's place by Newton's method on the homotopy, reaches the other's, and the preimages are
    // farther apart than the map's derivative allows one member), branch (the vertex is within near grid scales of the step's branch point, z = 0, judged in the preimage because the
    // logarithm's branch point has no place: the cells that hold it are dropped and counted), or false (a cut drawn where there is neither a cut nor a seam)
    cutClasses: (near, ring, branchPts, only, lend) => {
      const r0 = window.__cmwLandCutEdges(), r = only ? Object.assign({}, r0, { edges: only }) : r0, tol = Math.pow(2, 1 - r.steps), out = { onCut: 0, seam: 0, branch: 0, falseN: 0, falseList: [], branchWorst: 0 };
      const cabs = (a) => Math.hypot(a[0], a[1]), csub = (a, b) => [a[0] - b[0], a[1] - b[1]], cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
      const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
      const mix = (a, b, t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      const Hz = (z, sh) => { const h = window.__cmwLandHom(z); return h && h[sh] && h[sh].H && h[sh].dH ? h[sh] : null; };
      const cont = (z0, wa, wb, sh) => { let z = z0; for (let k = 1; k <= r.seam.cont; k++) { const target = mix(wa, wb, k / r.seam.cont); for (let i = 0; i < r.seam.pol; i++) { const h = Hz(z, sh); if (!h || !(cabs(h.dH) > 0)) return z; z = csub(z, cdiv(csub(h.H, target), h.dH)); } } return z; };
      const dBranch = (p) => Math.min(...branchPts.map((b) => cabs(csub(p, b))));
      // (the grid's scale at v: the largest chord c among the flagged edges within ring chords of v that are themselves at a branch point, within near of c of it, so a coarse edge
      // elsewhere lends no reach; a branch vertex is then within (ring + near) of that chord of a branch point; lend lends every neighbour's chord, for the control that shows the restriction is needed)
      const scaleAt = (v, chord) => { let m = chord; for (const e of r.edges) { const c = Math.hypot(e[2] - e[0], e[3] - e[1]); if (c <= m) continue; const da = Math.hypot(e[0] - v[0], e[1] - v[1]), db = Math.hypot(e[2] - v[0], e[3] - v[1]); if (Math.min(da, db) <= ring * c && (lend || dBranch(da < db ? [e[0], e[1]] : [e[2], e[3]]) <= near * c)) m = c; } return m; };
      for (const [ax, ay, bx, by, t, ca, cb] of r.edges) {
        if (!(t < tol || t > 1 - tol)) continue;
        const za = [ax, ay], zb = [bx, by], chord = cabs(csub(zb, za)), v = t > 0.5 ? zb : za;
        if ((v[0] < 0 ? Math.abs(v[1]) : cabs(v)) <= tol * chord) { out.onCut++; continue; }
        // (each end on its own sheet, the glide's i-th sheet having the code sheetCode + i; an end on no sheet, the other's)
        const shOf = (c, o) => Math.max(0, Math.round((c > 5 ? c : o) - r.seam.sheetCode)), sha = shOf(ca, cb), shb = shOf(cb, ca);
        let seam = false;
        if (ca !== cb) {
          const ha = Hz(za, sha), hb = Hz(zb, shb);
          if (ha && hb) {
            const reach = r.seam.rel * chord + r.seam.abs * (1 + cabs(zb)), zA1 = cont(za, ha.H, hb.H, sha), zB1 = cont(zb, hb.H, ha.H, shb);
            seam = chord * cabs(ha.dH) > r.seam.far * cabs(csub(hb.H, ha.H)) && cabs(csub(zA1, zb)) > reach && cabs(csub(zB1, za)) > reach;
          }
        }
        if (seam) { out.seam++; continue; }
        const dBr = dBranch(v), sc = scaleAt(v, chord);
        if (dBr <= near * sc) { out.branch++; out.branchWorst = Math.max(out.branchWorst, dBr / sc); } else { out.falseN++; if (out.falseList.length < 5) out.falseList.push([ax, ay, bx, by, t, ca, cb, dBr, chord, sc]); }
      }
      return out;
    },
    cover: (tag) => { const d = window.__heldPx[tag]; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > ${SAT_MIN}) n++; return n; }
  };
  // The exact image reference, as a coverage mask at half the canvas's resolution: the box is sampled on a lattice that is refined
  // only where the surface needs it, and each place's member (the front one, or every member with All sheets) is projected to the
  // pane at its drawn height (window.__cmwLandProject); the half-resolution pixels those points land on are the surface the exact map
  // draws. A cell of the lattice is refined where its corners are not all covered or all uncovered, and where it is not a facet (the
  // projection of its centre is more than step half-resolution pixels from the corners' mean, or the corners' members do not pair up),
  // down to depth halvings; a facet is filled as two triangles; cap bounds the places looked up, and a mask that reaches it is reported incomplete. The frame's own mask is the relief
  // alone on a transparent frame (window.__cmwLandRelief), cut into the same pixels (a pixel is covered when half of its canvas
  // pixels are). Answers { n (reference pixels), extra, missing, off, places (looked up), capped, w, h } or null with no inverse path.
  // the corners' projected members pair when every corner has the same members, by id (sheet, member and combo: [x, y, id] each), in the same order
  window.__lxPaired = (P) => P.every((q) => q.length === P[0].length && q.every((m, k) => m[2] === P[0][k][2]));
  function* lxRaster(sheets, g) {
    const L = window.__cmwLandRelief && window.__cmwLandRelief.land, cv = document.getElementById('canvasL');
    if (!L || !window.__cmwLandRelief.cov) return null;
    const b = L.box, dpr = cv.width / cv.getBoundingClientRect().width, W2 = Math.ceil(cv.width / 2), H2 = Math.ceil(cv.height / 2);
    const NX = g.nx << g.depth, NY = g.ny << g.depth, S = 1 << g.depth, cache = new Map();
    const xy = (i, j) => [b.x0 + i * (b.x1 - b.x0) / NX, b.y0 + j * (b.y1 - b.y0) / NY];
    const key = (i, j) => i * (NY + 1) + j;
    let capped = false;
    const levels = g.levels || g.depth + 1;   // each level halves the cells: depth + 1 levels judge every cell down to one lattice step
    // the places' members projected, in half-resolution pixels: [] where the place has none, null where unknown (not looked up yet)
    function* look(list) {
      const need = list.filter(([i, j]) => !cache.has(key(i, j)));
      if (!need.length) return true;
      if (cache.size + need.length > g.cap) { capped = true; return false; }
      for (let at = 0; at < need.length; at += g.batch) {
        const part = need.slice(at, at + g.batch), e = __cmwLandEnum(part.map(([i, j]) => xy(i, j)));
        if (!e) return false;
        part.forEach(([i, j], k) => {
          // (a place outside the frame's Inside-regions mask is not drawn as relief: __cmwLandMask is 0 to 1, null with no mask)
          const mk = __cmwLandMask(...xy(i, j));
          let ms = mk !== null && mk < ${MASK_ON} ? [] : e[k].filter((m) => (sheets || m.front) && Number.isFinite(m.h));
          // (All sheets: a member a layer per forward combo, as the frame draws it)
          if (sheets && typeof __cmwLandRefSheets === 'function') ms = window.__lxExpand(ms, __cmwLandRefSheets);
          // (a point is its projection and its member's id: a facet pairs the same member at every corner)
          const pts = [];
          for (const m of ms) { const q = __cmwLandProject(...xy(i, j), m.h); if (q && Number.isFinite(q[0] + q[1])) pts.push([q[0] * dpr / 2, q[1] * dpr / 2, m.sheet + ':' + m.member + ':' + (m.combo || '')]); }
          cache.set(key(i, j), pts);
        });
        yield;
      }
      return true;
    }
    const mark = new Uint8Array(W2 * H2);
    const put = (q) => { const x = Math.floor(q[0]), y = Math.floor(q[1]); if (x >= 0 && y >= 0 && x < W2 && y < H2) mark[y * W2 + x] = 1; };
    // the pixels a triangle of projected places covers (a pixel whose centre is inside it, or within half a pixel of its edge)
    const fill = (A, B, C) => {
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]) - 0.5)), x1 = Math.min(W2 - 1, Math.ceil(Math.max(A[0], B[0], C[0]) + 0.5));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]) - 0.5)), y1 = Math.min(H2 - 1, Math.ceil(Math.max(A[1], B[1], C[1]) + 0.5));
      const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]);
      if (Math.abs(den) < 1e-12) { put(A); put(B); put(C); return; }
      const eps = 0.5 / Math.max(1, Math.hypot(B[0] - A[0], B[1] - A[1]), Math.hypot(C[0] - A[0], C[1] - A[1]), Math.hypot(C[0] - B[0], C[1] - B[1]));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5, l1 = ((B[1] - C[1]) * (px - C[0]) + (C[0] - B[0]) * (py - C[1])) / den, l2 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den, l3 = 1 - l1 - l2;
        if (l1 >= -eps && l2 >= -eps && l3 >= -eps) mark[y * W2 + x] = 1;
      }
    };
    // a cell whose corners all have the same number of members is a facet of each member k (the k-th of every corner) when the
    // projection of its centre is within g.step half-resolution pixels of the corners' mean: the facet's two triangles are filled
    let work = [];
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) work.push([i * S, j * S, S]);
    for (let level = 0; work.length && level < levels; level++) {
      const corners = (c) => [[c[0], c[1]], [c[0] + c[2], c[1]], [c[0], c[1] + c[2]], [c[0] + c[2], c[1] + c[2]]];
      const centre = (c) => [c[0] + c[2] / 2, c[1] + c[2] / 2];
      if (!(yield* look(work.flatMap(corners)))) { capped = true; break; }
      const maybe = work.filter((c) => c[2] > 1 && corners(c).every(([i, j]) => cache.get(key(i, j)).length > 0));
      if (!(yield* look(maybe.map(centre).filter(([i, j]) => Number.isInteger(i) && Number.isInteger(j))))) { capped = true; break; }
      const next = [];
      for (const c of work) {
        const P = corners(c).map(([i, j]) => cache.get(key(i, j))), covered = P.filter((q) => q.length).length;
        if (covered === 0) continue;
        const [ci, cj] = centre(c), M = Number.isInteger(ci) && Number.isInteger(cj) ? cache.get(key(ci, cj)) : null;
        const n = P[0].length;
        const far = (k) => Math.max(...[1, 2, 3].map((q) => Math.hypot(P[q][k][0] - P[0][k][0], P[q][k][1] - P[0][k][1])));
        // (the finest cells are facets only where their corners are within g.jump half-resolution pixels: a larger jump is a cut's wall, never filled)
        const facet = covered === 4 && window.__lxPaired(P) && (c[2] === 1 ? P[0].every((_, k) => far(k) <= g.jump) : M && M.length === n && P[0].every((_, k) => {
          const mx = (P[0][k][0] + P[1][k][0] + P[2][k][0] + P[3][k][0]) / 4, my = (P[0][k][1] + P[1][k][1] + P[2][k][1] + P[3][k][1]) / 4;
          return Math.hypot(M[k][0] - mx, M[k][1] - my) <= g.step;
        }));
        if (facet) { for (let k = 0; k < n; k++) { fill(P[0][k], P[1][k], P[2][k]); fill(P[1][k], P[2][k], P[3][k]); } continue; }
        if (c[2] === 1) { for (const q of P) for (const m of q) put(m); continue; }
        const h = c[2] / 2;
        next.push([c[0], c[1], h], [c[0] + h, c[1], h], [c[0], c[1] + h, h], [c[0] + h, c[1] + h, h]);
      }
      work = next;
    }
    if (work.length) capped = true;   // (cells still to judge when the levels ran out: the reference is incomplete)
    const cov = window.__cmwLandRelief.cov, w = window.__cmwLandRelief.w, frame = new Uint8Array(W2 * H2);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      let n = 0, t = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const px = 2 * x + dx, py = 2 * y + dy; if (px < w && py < window.__cmwLandRelief.h) { t++; if (cov[py * w + px] > 0) n++; } }
      frame[y * W2 + x] = t && 2 * n >= t ? 1 : 0;
    }
    window.__lxMasks = { ref: mark, frame, W2, H2 };
    const res = window.__lxCompare(mark, frame, W2, H2, g.slack, capped); res.places = cache.size; return res;
  }
  // the raster in steps of at most ms milliseconds a call (a CDP call that runs too long fails): start, then step until done
  window.__lxRasterStart = (sheets, g) => { window.__lxRun = lxRaster(sheets, g); return 1; };
  window.__lxRasterStep = (ms) => {
    const t0 = performance.now();
    for (;;) {
      const r = window.__lxRun.next();
      if (r.done) { window.__lxRun = null; return { done: true, res: r.value }; }
      if (performance.now() - t0 > ms) return { done: false };
    }
  };
  // the pixels of a mask a pixel of the other is not within slack pixels of, each way, as a share of the first's pixels
  // how far the masks of the run before (window.__lxPrev) and of the last run are from each other: the share of reference pixels of either
  // with none of the other within slack; 0 means one more level of the lattice changed no checked pixel
  window.__lxConv = (slack) => window.__lxCompare(window.__lxPrev.ref, window.__lxMasks.ref, window.__lxMasks.W2, window.__lxMasks.H2, slack, false).off;
  window.__lxCompare = (ref, frame, W2, H2, slack, capped) => {
    const grow = (m) => { const o = new Uint8Array(m.length); for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) if (m[y * W2 + x]) for (let dy = -slack; dy <= slack; dy++) for (let dx = -slack; dx <= slack; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W2 && Y < H2) o[Y * W2 + X] = 1; } return o; };
    const gr = grow(ref), gf = grow(frame);
    let n = 0, extra = 0, missing = 0;
    for (let i = 0; i < ref.length; i++) { if (ref[i]) { n++; if (!gf[i]) missing++; } if (frame[i] && !gr[i]) extra++; }
    return { n, extra, missing, off: n ? (extra + missing) / n : 1, capped: !!capped, w: W2, h: H2 };
  };
  // the largest |H(z) - w| over the members (each { z, lam, sheet, w }) by the frame's homotopy (window.__cmwLandHom, at the member's continued
  // log coordinate lam): 0 when each member is a preimage of its place; Infinity when the hook has no value there. shift moves every w by that
  // much, principal evaluates H at z's principal log instead of at lam (the controls)
  window.__lxHomMiss = (ms, shift, principal) => {
    const d = ms.map((m) => {
      const hs = typeof __cmwLandHom === 'function' ? __cmwLandHom(m.z, principal ? null : m.lam) : null, e = hs && hs[m.sheet] && hs[m.sheet].H;
      return e ? Math.hypot(e[0] - m.w[0] - shift, e[1] - m.w[1]) / (1 + Math.hypot(m.w[0], m.w[1])) : Infinity;
    });
    const bad = ms.map((m, i) => [i, d[i]]).filter(([, x]) => x > window.__lxHomTol);
    return { worst: d.reduce((a, b) => Math.max(a, b), 0), nBad: bad.length, sample: bad.slice(0, 4).map(([i, x]) => {
      // (the sheet whose homotopy maps the member to its place, when it is not the one it is labelled with: a label mismatch, not a wrong member)
      const hs = __cmwLandHom(ms[i].z, ms[i].lam) || [], per = hs.map((h) => (h.H ? Math.hypot(h.H[0] - ms[i].w[0], h.H[1] - ms[i].w[1]) / (1 + Math.hypot(ms[i].w[0], ms[i].w[1])) : Infinity));
      const best = per.reduce((a, v, k) => (v < per[a] ? k : a), 0);
      return { sheet: ms[i].sheet, member: ms[i].member, z: ms[i].z, lam: ms[i].lam, lvl: ms[i].lvl, w: ms[i].w, miss: x, bestSheet: best, bestMiss: per[best] };
    }) };
  };
  window.__lxPick = null;
  // the members expanded by the forward combos refsOf(z) gives ([{ combo, z, f, h }] per z): a member with more than one combo is that many
  // layers, the others stay as they are
  window.__lxExpand = (o, refsOf) => o.flatMap((m) => {
    const rs = refsOf(m.z).filter((r) => r.f && r.h !== null);
    return rs.length > 1 ? rs.map((r) => ({ z: m.z, f: r.f, h: r.h, sheet: m.sheet, member: m.member, combo: r.combo, lam: m.lam, lvl: m.lvl })) : [m];
  });
  window.__lxEnum = (pts, sheets) => {
    const e = typeof __cmwLandEnum === 'function' ? __cmwLandEnum(pts) : null;
    if (!e) return null;
    // (the front member first: the hook marks it, front: true, one per place; a place with members and none marked is counted in
    // window.__lxNoFront, which the suite fails on, and is not ordered by any rule here. The same z repeats on sheets that differ by
    // a multiple of n, so a z listed again is dropped.)
    window.__lxNoFront = 0;
    return e.map((ms) => {
      const best = ms.find((m) => m.front);
      if (ms.length && !best) window.__lxNoFront++;
      const use = best ? [best].concat(ms.filter((m) => m !== best)) : ms, o = [];
      for (const m of use) if (!o.some((x) => Math.hypot(x.z[0] - m.z[0], x.z[1] - m.z[1]) < ${SAME_Z} && Math.abs(x.h - m.h) <= ${HEIGHT_TOL})) o.push({ z: m.z, f: m.fd || m.f, h: m.hd ?? m.h, sheet: m.sheet, lam: m.lam, lvl: m.lvl });
      // (All sheets: a member of a chain with a multivalued step past plane 0 is drawn once per forward combo of the colour map's distinct
      // sheets, the parked frame's own: window.__cmwLandRefSheets(z), each { combo, z, f, h }; a chain without one has the member alone)
      return sheets && typeof __cmwLandRefSheets === 'function' ? window.__lxExpand(o, __cmwLandRefSheets) : o;
    });
  };
  1`;
  async function load(c, sheets) {
    const ns = 'landexact' + Date.now();
    if (c.example) {
      await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
      await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
      await ev(`__cmwExample(${names.indexOf(c.example)}); 1`); await settled({ max: LOAD_MAX_MS });
      await ev(`__cmwSet('alpha', 1), __cmwSet('height', 'im'), __cmwSet('sheets', ${sheets}), 1`);
    } else {
      await loadView('steps', ns, { shapes: c.shapes, steps: c.steps, sheets, height: 'im' });
      await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
      await settled({ max: LOAD_MAX_MS, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
    }
    await settled({ max: LOAD_MAX_MS * 2, until: '__cmwSteps().ready.ready' });   // (the prestart's idle warm draw lands in the GL canvas next to a requested frame while it runs)
    await ev(HELP);
  }
  // the plane at index k parked and its frame kept as tag; its height reading kept for the references
  // the exact image reference at the current u: the lattice refined from ref.depth to at most ref.depthMax until ref.calm consecutive levels
  // change no checked pixel (a feature thinner than a cell shows first at a deeper level). conv is the last pair's distance, firstConv the
  // first pair's, calm the unchanged levels in a row; a result not calm for ref.calm levels is not converged
  async function refine(sheets, ref) {
    let rk = null, conv = null, firstConv = null, calm = 0, depth = ref.depth;
    for (; depth <= ref.depthMax; depth++) {
      if (depth > ref.depth) await ev('window.__lxPrev = window.__lxMasks');
      await ev(`window.__lxRasterStart(${sheets}, ${JSON.stringify(Object.assign({}, ref, { depth }))})`);
      let st = { done: false };
      for (let k = 0; !st.done && k < STEP_MAX; k++) st = JSON.parse(await ev(`JSON.stringify(__lxRasterStep(${STEP_MS}))`));
      rk = st.done ? st.res : null;
      if (!rk) break;
      if (depth > ref.depth) { conv = await ev(`__lxConv(${ref.slack})`); if (firstConv === null) firstConv = conv; calm = conv === 0 ? calm + 1 : 0; if (calm >= ref.calm) break; }
    }
    depth = Math.min(depth, ref.depthMax);
    if (rk) Object.assign(rk, { depth, conv, firstConv, calm });
    return { rk, conv, firstConv, calm, depth };
  }
  async function park(k, tag) {
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: ${k}, now: true, clock: 0 }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
    const still = await grab(tag);   // (the kit's grab: the first pixels that stay the same from one read to the next)
    return ev(`(() => { const p = __cmwLandPick(); if (p && ${k} === 0) window.__lxPick = p; return { still: ${still}, cover: __lx.cover(${JSON.stringify(tag)}), pick: !!p }; })()`);
  }
  // the places a frame is probed at: PROBES columns at cell centres and ROWS_SIDE rows on each side of the real axis, and a pair either side of the real axis (the
  // cut of the square root, the cube root and the logarithm) at each of CUT_X
  const probes = (b) => {
    const o = [], w = b.x1 - b.x0, h = b.y1 - b.y0;
    for (let i = 0; i < PROBES; i++) for (const s of [1, -1]) for (let k = 0; k < ROWS_SIDE; k++) o.push([b.x0 + (i + 0.5) * w / PROBES, (k + 0.5) / ROWS_SIDE * (s > 0 ? b.y1 : b.y0)]);
    for (const xf of CUT_X) for (const s of [1, -1]) o.push([b.x0 + xf * w, s * CUT_OFF * h]);
    return o;
  };
  const cells = (b) => {
    const o = [];
    for (let j = 0; j < COVER_NY; j++) for (let i = 0; i < COVER_NX; i++) o.push([b.x0 + (i + 0.5) * (b.x1 - b.x0) / COVER_NX, b.y0 + (j + 0.5) * (b.y1 - b.y0) / COVER_NY]);
    return o;
  };
  // the places that differ between what a frame draws and what the reference covers, each way, as a share of all
  const coverDiff = (drawn, covered) => {
    let missing = 0, extra = 0;
    drawn.forEach((d, i) => { if (covered[i] && !d) missing++; else if (!covered[i] && d) extra++; });
    return { missing, extra, n: drawn.length, off: (missing + extra) / drawn.length };
  };
  // the controls: a frame equal to the reference passes; a frame with HOLE_N places of surface left out, and one that fills the
  // cut's column (a wall drawn across the cut) both fail
  {
    const cut = Math.floor(COVER_NX / 2), covered = [];
    for (let j = 0; j < COVER_NY; j++) for (let i = 0; i < COVER_NX; i++) covered.push(i !== cut);
    const hole = covered.slice(), wall = covered.slice();
    let k = 0;
    for (let i = 0; i < hole.length && k < HOLE_N; i++) if (hole[i]) { hole[i] = false; k++; }
    for (let i = 0; i < wall.length; i++) if (!wall[i]) wall[i] = true;
    ok('the coverage check passes a frame equal to the reference', coverDiff(covered, covered).off === 0, null);
    ok(`the coverage check fails a frame with a hole of ${HOLE_N} places`, coverDiff(hole, covered).off > CELL_TOL, coverDiff(hole, covered));
    ok('the coverage check fails a wall filled across the cut', coverDiff(wall, covered).off > CELL_TOL, coverDiff(wall, covered));
  }
  // A member is its preimage z; its drawn height and colour are then compared. The frame's z is float: Z_TOL of 1 + |z|.
  const sameZ = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= Z_TOL * (1 + Math.hypot(b[0], b[1]));
  // sheets off at one place: the frame has one layer, the front member's
  const frontSame = (have, wantAll) => have.length === 1 && sameZ(have[0].z, wantAll[0].z);
  // All sheets at one place: the layers and the members pair one to one, a layer with a member at its z and (the forward combos of one z are
  // told apart by height) its drawn height within HEIGHT_TOL
  const sameLayers = (have, want) => {
    if (have.length !== want.length) return false;
    const used = new Set();
    return want.every((m) => {
      const k = have.findIndex((l, i) => !used.has(i) && sameZ(l.z, m.z) && Math.abs(l.h - m.h) <= HEIGHT_TOL);
      if (k < 0) return false;
      used.add(k);
      return true;
    });
  };
  {
    const two = [{ z: [1, 0] }, { z: [-1, 0] }], L = (z) => ({ z });
    ok('the front check accepts the front member', frontSame([L([1, 0])], two), null);
    ok('the front check fails the other member', !frontSame([L([-1, 0])], two), null);
    ok('the front check fails a preimage of no member', !frontSame([L([3, 3])], two), null);
    ok('the front check fails two layers', !frontSame([L([1, 0]), L([1, 0])], two), null);
  }
  // the colour of a member: the angle between two values of F, or null where either is near 0
  const phaseGap = (a, b) => {
    if (Math.hypot(a[0], a[1]) < F_ABS_MIN || Math.hypot(b[0], b[1]) < F_ABS_MIN) return null;
    return Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
  };
  // a layer against its member: the drawn height within HEIGHT_TOL, and the colour (arg F) within PHASE_TOL where |F| is not near 0
  // (a layer or a member without F is counted as missing)
  const layerGap = (l, m) => {
    const o = { h: Math.abs(l.h - m.h) > HEIGHT_TOL, noF: !l.f || !m.f, ph: false, phN: false };
    if (!o.noF) { const g = phaseGap(l.f, m.f); o.phN = g !== null; o.ph = g !== null && g > PHASE_TOL; }
    return o;
  };
  {
    const m = { h: 0.3, f: [1, 1] }, a = Math.PI / 4 + 2 * PHASE_TOL;
    ok('the layer check passes a layer equal to its member', (() => { const g = layerGap({ h: 0.3, f: [2, 2] }, m); return !g.h && !g.ph && !g.noF && g.phN; })(), null);
    ok('the layer check fails a height off by twice the tolerance', layerGap({ h: 0.3 + 2 * HEIGHT_TOL, f: [1, 1] }, m).h, null);
    ok('the layer check fails a colour off by twice the tolerance', layerGap({ h: 0.3, f: [Math.cos(a), Math.sin(a)] }, m).ph, null);
    ok('the layer check counts a layer without F', layerGap({ h: 0.3 }, m).noF, null);
  }

  // the raster's controls, on synthetic masks through the page's comparison: equal masks, one a pixel off (inside slack) pass; a hole of
  // CTL_HOLE_R, a wall of CTL_WALL_W pixels and a mask CTL_SHIFT pixels off fail
  const CTL = { w: 200, h: 160, r: 60, holeR: 8, wallW: 6, shift: 4 };
  let rcDone = false;
  async function rasterControls() {
    const o = await ev(`(() => {
      const c = ${JSON.stringify(CTL)}, W = c.w, H = c.h, mk = (f) => { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = f(x, y) ? 1 : 0; return m; };
      const disc = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) <= r, cx = W / 2, cy = H / 2, ref = mk(disc(cx, cy, c.r));
      const cmp = (m) => __lxCompare(ref, m, W, H, ${REF.slack}, false).off;
      return {
        same: cmp(ref), one: cmp(mk(disc(cx + 1, cy, c.r))),
        hole: cmp(mk((x, y) => disc(cx, cy, c.r)(x, y) && !disc(cx + 20, cy, c.holeR)(x, y))),
        wall: cmp(mk((x, y) => disc(cx, cy, c.r)(x, y) || (x >= W - c.wallW && y > 20 && y < H - 20))),
        shift: cmp(mk(disc(cx + c.shift, cy, c.r)))
      };
    })()`);
    // the combos: a member with two forward combos expands to two layers (the other stays one), the layer check holds both, and a frame
    // drawing one combo of the two fails it
    const ex = await ev(`window.__lxExpand([{ z: [1, 0], f: [1, 0], h: 0.1, sheet: 0 }, { z: [2, 0], f: [1, 1], h: 0.2, sheet: 0 }], (z) => (z[0] === 1 ? [{ combo: [0], z, f: [1, 0], h: 0.1 }, { combo: [1], z, f: [-1, 0], h: -0.1 }] : [{ combo: [0], z, f: [1, 1], h: 0.2 }]))`);
    ok('the combos expand a member with two to two layers and leave the other one', Array.isArray(ex) && ex.length === 3 && ex.filter((m) => m.z[0] === 1).length === 2, ex);
    if (Array.isArray(ex)) {
      const L = (m) => ({ z: m.z, h: m.h });
      ok('the layer check passes a frame with both combos', sameLayers(ex.map(L), ex), null);
      ok('the layer check fails a frame drawing one of the two combos', !sameLayers(ex.slice(1).map(L), ex), null);
      ok('the layer check fails a frame drawing one combo twice (the combos share z, not height)', !sameLayers([ex[0], ex[0], ex[2]].map(L), ex), null);
    }
    // the branch points of a scene's steps: none for a Möbius map, the origin for a root, and an unknown type is refused
    ok('the branch points of a Möbius pole scene are none', JSON.stringify(branchPoints(CASES.find((x) => x.tag === 'Möbius with a pole in the box').steps)) === '[]', null);
    ok('the branch points of the cube root scene are the origin', JSON.stringify(branchPoints(CASES.find((x) => x.tag === 'cube root').steps)) === '[[0,0]]', null);
    ok('the branch points of an unknown step type are refused', (() => { try { branchPoints([{ type: 'unknown' }]); return false; } catch (e) { return true; } })(), null);
    // the facets: corners with the same member ids pair (the cell is a facet candidate), corners with different ids, or a different count, do not
    const pr = await ev(`(() => { const c = (id) => [0, 0, id], P = (...ids) => ids.map((l) => l.map(c)); return { same: __lxPaired(P(['0:0:'], ['0:0:'], ['0:0:'], ['0:0:'])), other: __lxPaired(P(['0:0:'], ['0:0:'], ['0:1:'], ['0:0:'])), count: __lxPaired(P(['0:0:'], ['0:0:', '0:1:'], ['0:0:'], ['0:0:'])) }; })()`);
    ok('the facet pairing holds corners with the same member ids', pr.same === true, pr);
    ok('the facet pairing fails corners with different member ids', pr.other === false, pr);
    ok('the facet pairing fails corners with different member counts', pr.count === false, pr);
    ok('the raster check passes equal masks', o.same === 0, o);
    ok(`the raster check passes a mask a pixel off (slack ${REF.slack})`, o.one <= RASTER_TOL, o);
    ok(`the raster check fails a hole of radius ${CTL.holeR}`, o.hole > RASTER_TOL, o);
    ok(`the raster check fails a wall of ${CTL.wallW} pixels`, o.wall > RASTER_TOL, o);
    ok(`the raster check fails a mask ${CTL.shift} pixels off`, o.shift > RASTER_TOL, o);
  }
  const setU = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); };
  // with a carried-frame probe set (window.__svCarryProbe: a control that breaks the draw on purpose), the frame at u is redrawn, read, and the probes cleared
  const withProbe = async (probe, u, read) => {
    try {
      await ev(`window.__svCarryProbe = Object.assign({}, window.__svCarryProbe, ${JSON.stringify(probe)}); 1`);
      await setU(MID_U[1] === u ? MID_U[0] : MID_U[1]); await setU(u);
      await ev('JSON.stringify(window.__cmwLandRelief ? __cmwLandRelief() : null)');
      return await read();
    } finally { await ev("window.__svCarryProbe = {}; 1"); await setU(u); await ev('JSON.stringify(window.__cmwLandRelief ? __cmwLandRelief() : null)'); }
  };
  await view(VIEW_W, VIEW_H, false, false);
  for (const c of CASES) for (const sheets of MODES) {
    const name = `${c.tag}, ${sheets ? 'All sheets' : 'sheets off'}`;
    const r = info[name] = {};
    await load(c, sheets);
    if (!rcDone) { rcDone = true; await rasterControls(); }
    const last = 1;   // (the glide from plane 0 to plane 1)
    const p0 = await park(0, 'P0'), p1 = await park(last, 'P1');
    ok(`${name}: the parked frames are still and have a height reading`, p0.still && p1.still && p0.pick && p1.pick, { p0, p1 });
    // the parked end planes again in the Top view
    const cam0 = await ev("__cmwCam('L')");
    await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`);
    const p0T = await park(0, 'P0T'), p1T = await park(last, 'P1T');
    await ev(`__cmwCam('L', ${JSON.stringify(cam0)}); 1`);
    ok(`${name}: the parked frames are still in the Top view`, p0T.still && p1T.still, { p0T, p1T });
    const hueCtl = await ev("__lx.hueOff('P0T', 'P1T')");
    ok(`${name}: control: the hue count tells two different planes' parked frames apart (${hueCtl} pixels, over ${HUE_OFF_MAX})`, hueCtl > HUE_OFF_MAX, { hueCtl });
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
    let branchSum = 0;   // (the branch cells counted over the case's cut rows)
    const brPts = CUT_ROWS[c.tag] ? branchPoints(c.steps) : [];
    for (const u0 of GLIDE_U) {
      const mid = MID_U.includes(u0), u = u0, first = u0 < GLIDE_MID && !mid, lastU = u0 > GLIDE_MID && !mid;   // (first: a probe near plane z, lastU: near the next plane)
      const t = `${name}, u=${u}`;
      await setU(u);
      const still = await grab('cur');
      const carry = await ev('(() => { const c = __cmwLandCarry(); return c && { path: c.path || null, u: c.u }; })()');
      const cov = { still, n: await ev(`__lx.cover('cur')`), d0: (await compare('cur', 'P0')).frac, d1: (await compare('cur', 'P1')).frac };
      r[u] = { carry, cov, p0: p0.cover, p1: p1.cover };
      ok(`${t}: a still, carried frame`, cov.still && !!carry, { carry, still: cov.still });
      // the path
      ok(`${t}: the frame is drawn by the inverse path`, carry && carry.path === 'inverse', carry);
      // the image at the ends
      if (first) ok(`${t}: plane z's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d0 <= SAME_FRAC, cov);
      if (lastU) ok(`${t}: the next plane's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d1 <= SAME_FRAC, cov);
      // the end frames in the Top view, against the parked plane there
      if (first || lastU) {
        await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        const stillT = await grab('curT');
        const dT = (await compare('curT', first ? 'P0T' : 'P1T')).frac;
        await ev(`__cmwCam('L', ${JSON.stringify(cam0)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        const hueN = await ev(`__lx.hueOff('curT', ${first ? "'P0T'" : "'P1T'"})`);
        r[u].top = { still: stillT, d: dT, hueN };
        ok(`${t}: in the Top view at most ${HUE_OFF_MAX} coloured pixels are of another hue than the parked plane's (${hueN} are; a hue-shifted row at a sheet boundary)`, hueN <= HUE_OFF_MAX, r[u].top);
        if (lastU && COMBO_CONTROL.includes(c.tag) && !r.comboControl) {
          // (the control: every sheet's combo one off, so the colour continues on the wrong branch of the step)
          let ctl;
          try {
            await ev("window.__svCarryProbe = Object.assign({}, window.__svCarryProbe, { comboShift: 1 }); 1"); await settled({ max: LOAD_MAX_MS });
            await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
            await grab('ctlT');
            ctl = await ev("__lx.hueOff('ctlT', 'P1T')");
          } finally {
            await ev("window.__svCarryProbe = {}; 1"); await ev(`__cmwCam('L', ${JSON.stringify(cam0)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          }
          r.comboControl = ctl;
          ok(`${t}: control: with every sheet's combo one off the Top view's hue is over ${HUE_OFF_MAX} pixels off (${ctl} are)`, ctl > HUE_OFF_MAX, { ctl });
        }
        ok(`${t}: ${first ? "plane z's" : "the next plane's"} parked frame in the Top view (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, stillT && dT <= SAME_FRAC, r[u].top);
      }
      // the surface pixels at the ends
      if (first || lastU) {
        const base = first ? p0.cover : p1.cover;
        ok(`${t}: at least the parked plane's surface pixels less ${COVER_TOL * 100} %`, cov.n >= (1 - COVER_TOL) * base, { n: cov.n, base });
      }
      // no edge of the frame is crossed twice (a branch point on an edge drops its triangles)
      {
        const drops = await ev('typeof __cmwLandDrops === \'function\' ? __cmwLandDrops() : null');
        ok(`${t}: no grid edge is crossed twice, so no triangle is left out (${drops} are)`, drops === 0, { drops });
      }
      // where the edge pass puts a cut on an edge is the step's own cut (the reference of these frames inside the glide, where no parked plane
      // exists: the scene's cut of the one step, the negative real axis of its input), to the bisection's resolution: the preimage of each flagged edge's cut is
      // within 2^-(steps - 1) of the edge's chord from the cut (the negative real axis of plane z)
      if ((CUT_ROWS[c.tag] || []).includes(u)) {
        const ct = await ev('__lx.cutT()');
        const tol = ct ? Math.pow(2, 1 - ct.steps) : 0;
        r[u].cut = ct;   // (atEnd: the flagged edges whose cut is at an end of the chord, the vertex itself, which are counted here and not judged)
        ok(`${t}: the cuts the edge pass finds are the step's own (${ct ? ct.n : '?'} flagged edges, over 0, with the cut inside the chord, and ${ct ? ct.atEnd : '?'} at an end of it; the worst is ${ct ? ct.worst.toExponential(2) : '?'} of the chord from the cut, at most ${tol.toExponential(2)})`, !!ct && ct.n > 0 && ct.worst <= tol, ct);
        // the flagged edges at an end of their chord: on the step's cut, or between two members of the glide's map (a seam, which the sheets-off
        // two-layer item (#1439) turns into layers), and never a cut where there is neither
        const cc = await ev(`__lx.cutClasses(${BRANCH_NEAR}, ${BRANCH_RING}, ${JSON.stringify(brPts)})`);
        r[u].cutClasses = cc;
        ok(`${t}: every flagged edge at an end of its chord is on the step's cut (${cc.onCut}), a member seam (${cc.seam}) or at its branch point (${cc.branch}, the farthest at ${cc.branchWorst.toExponential(2)} grid scales); ${cc.falseN} are none`, cc.falseN === 0, cc);
        // the control: flagged edges that are none (a vertex 1.2 from the branch point, off the cut, in one member) are counted as none, so the assertion over the real edges would
        // go red on one; a coarse flagged edge near it that is not at a branch point (its chord 0.7 reaches the vertex only if every neighbour lends its chord) does not hide it
        const synth = [[1.2, 0.1, 1.2001, 0.1, 0, 1, 1], [3, 0, 3, 0.7, 0.5, 1, 1]];
        const ctlB = await ev(`__lx.cutClasses(${BRANCH_NEAR}, ${BRANCH_RING}, ${JSON.stringify(brPts)}, ${JSON.stringify(synth)}, false)`);
        const ctlL = await ev(`__lx.cutClasses(${BRANCH_NEAR}, ${BRANCH_RING}, ${JSON.stringify(brPts)}, ${JSON.stringify(synth)}, true)`);
        ok(`${t}: control: a flagged edge away from the branch point, off the cut and in one member is none (${ctlB.falseN}), and a coarse edge away from it hides it only when every neighbour lends its chord (${ctlL.falseN})`, ctlB.falseN === 1 && ctlL.falseN === 0, { ctlB, ctlL });
        // the control: with no reach the branch cells are none, so the class is what clears them
        const ctlR = await ev(`__lx.cutClasses(0, ${BRANCH_RING}, ${JSON.stringify(brPts)})`);
        ok(`${t}: control: with no reach the ${cc.branch} branch cells are none (${ctlR.falseN})`, ctlR.falseN === cc.falseN + cc.branch, ctlR);
        branchSum += cc.branch;
        if (u === CUT_ROWS[c.tag][CUT_ROWS[c.tag].length - 1]) ok(`${name}: the branch cells over the cut rows are counted (${branchSum}, over 0)`, branchSum > 0, { branchSum });
        // the control: with every cut forced to the middle of its edge (probe midCut) the distance is about half the chord
        const ctlC = await withProbe({ midCut: true }, u, () => ev('__lx.cutT()'));
        ok(`${t}: control: with every cut at the middle of its edge the worst distance is over ${tol.toExponential(2)} of the chord (${ctlC ? ctlC.worst.toExponential(2) : '?'})`, !!ctlC && ctlC.worst > tol, ctlC);
      }
      // the geometry
      const box = await ev('(() => { const b = __cmwLandCarry(true) || (window.__lxPick && window.__lxPick.box); return b ? { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 } : null; })()');
      ok(`${t}: the frame's box is readable`, !!box, null);
      if (!box) continue;
      const pts = probes(box), cpts = cells(box);
      const hook = (q) => ev(`typeof __cmwLandFrameVerts === 'function' ? __cmwLandFrameVerts(${JSON.stringify(q)}) : null`);
      const got = await hook(pts), cgot = await hook(cpts);
      // (the place the frame draws a probe at is its nearest grid vertex: the reference is read there, where a cut or a steep height would make the probe's own offset a false failure)
      const at1 = (g, q) => q.map((p, i) => (g && g[i] && g[i][0] && g[i][0].w) || p);
      const vpts = at1(got, pts), cw = at1(cgot, cpts);
      const ref = await ev(`__lxEnum(${JSON.stringify(vpts)}, ${sheets})`);
      const noFront = await ev('window.__lxNoFront');
      ok(`${t}: the CPU reference (window.__cmwLandEnum) is readable: the frame is drawn by the inverse path`, Array.isArray(ref), null);
      ok(`${t}: the frame's draw data is readable (window.__cmwLandFrameVerts)`, Array.isArray(got) && Array.isArray(cgot), null);
      if (!Array.isArray(ref) || !Array.isArray(got) || !Array.isArray(cgot)) continue;
      const refN = ref.filter((x) => x.length).length;
      r[u] = Object.assign(r[u], { refPlaces: refN });
      ok(`${t}: the CPU reference finds preimages at a probe place (${refN} of ${pts.length})`, refN > 0, { refN });
      ok(`${t}: the hook marks the front member (front: true) at every place that has members; ${noFront} places without (the front member is the page's, never ordered here)`, noFront === 0, { noFront });
      {
        const ms = [];
        ref.forEach((l, i) => l.forEach((m) => { if (m.z && ms.length < HOM_MAX) ms.push({ z: m.z, lam: m.lam || null, lvl: m.lvl, sheet: m.sheet || 0, member: m.member, w: vpts[i] }); }));
        await ev(`window.__lxHomTol = ${HOM_TOL}; 1`);
        const mr = await ev(`__lxHomMiss(${JSON.stringify(ms)}, 0)`), mv = await ev(`__lxHomMiss(${JSON.stringify(ms)}, ${HOM_SHIFT})`), miss = mr.worst, moved = mv.worst;
        ok(`${t}: every enumerated member (${ms.length}) maps to its place under the frame's homotopy (window.__cmwLandHom) within ${HOM_TOL}`, ms.length > 0 && miss <= HOM_TOL, { miss, nBad: mr.nBad, n: ms.length, sample: mr.sample });
        ok(`${t}: the control: the places moved by ${HOM_SHIFT} are not matched by the homotopy (miss ${moved})`, moved > HOM_TOL, { moved });
        // (a member of the range ramp, lvl < 0, is outside its sheet's window: H is exact at its lam, and the principal log of z is another
        // branch. Every member is within the ramp; the principal evaluation and a ramp of 0 must each flag the members that are outside)
        const ramp = await ev('__cmwLandRamp()'), nRamp = ms.filter((m) => m.lvl < 0).length;
        const out = ms.filter((m) => !(m.lvl >= -ramp)).length;
        ok(`${t}: every enumerated member is within the range ramp (lvl >= -${ramp}); ${nRamp} of ${ms.length} are in it`, out === 0, { out, ramp, nRamp });
        // the completeness count: for probe places with members, the winding of the homotopy around each sheet's region (plus the plan's poles) equals the
        // members found there on every sheet; controls: a member removed, the poles omitted, a place on a cut lip, a step floor that cannot resolve a place near the boundary
        {
          const idx = []; ref.forEach((l, i) => { if (l.length) idx.push(i); });
          const pick = idx.filter((_, j) => j % Math.max(1, Math.ceil(idx.length / WIND_PLACES)) === 0).slice(0, WIND_PLACES);
          let nBadW = 0, nChecked = 0; const badW = [];
          for (const i of pick) {
            const wr = await ev(`__cmwLandWind(${JSON.stringify(vpts[i])}, {})`);
            for (const r of wr || []) { nChecked++; if (!r.ok) { nBadW++; if (badW.length < 4) badW.push(Object.assign({ place: vpts[i] }, r)); } }
          }
          ok(`${t}: the completeness count: the winding of the homotopy plus the poles equals the members found, on every sheet of ${pick.length} places (${nChecked} sheet counts)`, nChecked > 0 && nBadW === 0, { nBadW, nChecked, badW });
          if (pick.length) {
            const i0 = pick[0];
            const drop = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { dropOne: true })`);
            ok(`${t}: the control: one member removed breaks the count`, !!drop && drop.some((r) => !r.ok), { drop });
            const lipR = await ev(`__cmwLandWind(null, { onLip: true })`);
            // (a place on a lip is a root on the contour: the count must report it, as on the contour or as an unresolved step, and never as a count)
            const noCut = !!lipR && lipR.every((r) => r.status === 'noCut'), loud = !!lipR && lipR.every((r) => r.status === 'onContour' || r.status === 'unresolved' || r.status === 'noCut');
            ok(`${t}: the control: a place on a cut lip is not counted${noCut ? ' (this plan has no cut)' : ''}`, !!lipR && loud && (noCut || lipR.some((r) => r.status === 'onContour' || r.status === 'unresolved')), { lipR: lipR && lipR.slice(0, 3) });
            const near = await ev(`__cmwLandWind(null, { nearContour: true, hMin: ${WIND_HMIN_CTL} })`);
            ok(`${t}: the control: a place near the boundary with an unreachable step floor is unresolved, not counted`, !!near && near.some((r) => r.status === 'unresolved' || r.status === 'onContour'), { near });
            const nop = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noPoles: true })`), withP = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`);
            const poleCase = !!withP && withP.some((r) => r.P > 0);
            if (poleCase) ok(`${t}: the control: the poles omitted break the count`, !!nop && nop.some((r) => !r.ok), { nop });
          }
        }
        if (nRamp) {
          const pr = await ev(`__lxHomMiss(${JSON.stringify(ms)}, 0, true)`), tight = ms.filter((m) => !(m.lvl >= 0)).length;
          ok(`${t}: the control: the principal-branch homotopy flags the ramp members (miss ${pr.worst}); a ramp of 0 flags ${tight}`, pr.worst > HOM_TOL && tight === nRamp, { principal: pr.worst, tight, nRamp });
        }
      }
      let bad = 0, n = 0, badPh = 0, phN = 0, noF = 0, hBad = 0; const at = [], atPh = [], atH = [];
      pts.forEach((p, i) => {
        const wantAll = ref[i] || [], haveAll = got[i] || [];
        if (!wantAll.length) return;   // (a place with no preimage in the reference is not compared; the reference's own check says it finds some)
        const want = sheets ? wantAll : wantAll.slice(0, 1);   // (sheets off: the front member, the enumerator's first)
        n++;
        const same = sheets ? sameLayers(haveAll, want) : frontSame(haveAll, wantAll);
        if (!same) { bad++; if (at.length < 4) at.push({ p, want: want.map((x) => x.z), have: haveAll.map((x) => x.z) }); return; }
        // (every member the layers match by z, on a side sheet or on the real axis too: the drawn height and the colour)
        want.forEach((m) => {
          const l = haveAll.filter((x) => sameZ(x.z, m.z)).sort((p, q) => Math.abs(p.h - m.h) - Math.abs(q.h - m.h))[0];   // (the layer at its z nearest in height: sheets of a step share z)
          if (!l) return;
          const g = layerGap(l, m);
          if (g.h) { hBad++; if (atH.length < 4) atH.push({ p, have: l.h, want: m.h }); }
          if (g.noF) { noF++; return; }
          if (g.phN) phN++;
          if (g.ph) { badPh++; if (atPh.length < 4) atPh.push({ p, have: l.f, want: m.f }); }
        });
      });
      r[u].geometry = { n, bad, at, phN, badPh, noF, hBad };
      ok(`${t}: ${sheets ? 'every member' : 'the front member'} at every probe place, by preimage z (${n} places)`, n > 0 && bad === 0, { n, bad, at });
      ok(`${t}: the drawn height of every member within ${HEIGHT_TOL}`, hBad === 0, { hBad, atH });
      ok(`${t}: the members' colour (arg F) within ${PHASE_TOL * 180 / Math.PI} degrees (${phN} members; the draw data carries F: ${noF} without)`, noF === 0 && badPh === 0, { phN, badPh, noF, atPh });
      // the coverage: the places the frame draws against the places the reference covers
      const cref = await ev(`__lxEnum(${JSON.stringify(cw)}, false)`);   // (a place is covered when the enumerator has a member there)
      const cd = coverDiff(cgot.map((x) => !!(x && x.length)), cref.map((x) => x.length > 0));
      r[u].coverage = cd;
      // the exact image reference: the frame's relief against the raster of the reference's members, at this u
      const rl = await ev('JSON.stringify(window.__cmwLandRelief ? __cmwLandRelief() : null)');
      // (the lattice is refined, REF.depth up to REF.depthMax, until REF.calm consecutive levels change no checked pixel (a feature thinner than a
      // cell shows first at a deeper level): conv is the last pair's distance, firstConv the first pair's, calm the unchanged levels in a row; the
      // frame is judged against the finest. A reference not converged at depthMax fails)
      const { rk, conv, firstConv, calm, depth } = await refine(sheets, REF);
      r[u].raster = rk;
      ok(`${t}: the frame's relief is the exact map's, a coverage raster of ${rk ? rk.w + ' x ' + rk.h : '?'} half-resolution pixels (${rk ? rk.extra : '?'} extra, ${rk ? rk.missing : '?'} missing of ${rk ? rk.n : '?'}; at most ${RASTER_TOL * 100} % off, ${REF.slack} pixel slack; reference complete: ${rk ? !rk.capped : '?'})`, !!rl && !!rk && !rk.capped && rk.off <= RASTER_TOL, { rl, rk });
      ok(`${t}: the reference is converged: ${REF.calm} levels in a row change no pixel within ${REF.slack} (depth ${rk ? rk.depth : '?'} of at most ${REF.depthMax}; last pair off ${conv}, first pair ${firstConv})`, !!rk && calm >= REF.calm, { depth: rk && rk.depth, conv, firstConv, calm });
      if (c.tag === 'cube root' && u === MID_U[0]) {
        // the control: with every cross-sheet edge taken as continuous (probe noCross) the whole triangles across the cuts between sheets
        // come back as slivers, and the relief check fails
        const ctl = await withProbe({ noCross: true }, u, async () => (await refine(sheets, REF)).rk);
        ok(`${t}: control: with every cross-sheet edge taken as continuous the relief is over ${RASTER_TOL * 100} % off (${ctl ? ctl.extra : '?'} extra, ${ctl ? ctl.missing : '?'} missing of ${ctl ? ctl.n : '?'})`, !!ctl && ctl.off > RASTER_TOL, { ctl });
      }
      if (/Roots as preimages/.test(t) && u === 0.002) {
        // controls: a reference refined only over the SHALLOW levels is not converged (its pair still moves checked pixels), and
        // a raster given too few levels is reported capped, so the relief check fails
        const sh = await refine(sheets, Object.assign({}, REF, SHALLOW));
        ok(`${t}: the control: the shallow reference (depth ${SHALLOW.depth} to ${SHALLOW.depthMax}) is not converged (calm ${sh.calm} of ${REF.calm}, first pair off ${sh.firstConv})`, sh.firstConv > 0 && sh.calm < REF.calm, sh);
        const cp = await refine(sheets, Object.assign({}, REF, { depthMax: REF.depth, levels: LEVELS_CTL }));
        ok(`${t}: the control: a raster with ${LEVELS_CTL} levels is reported capped`, !!cp.rk && cp.rk.capped === true, { rk: cp.rk });
      }
      ok(`${t}: the places drawn are the places covered, both ways (${cd.missing} missing, ${cd.extra} extra of ${cd.n}; at most ${CELL_TOL * 100} % differ)`, cd.off <= CELL_TOL, cd);
    }
  }
  return { pass: !fails.length, fails, info };
})

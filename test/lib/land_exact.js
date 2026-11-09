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
  const MONO_CERT = 1e-5, MONO_NEWT_MAX = 12;   // a member of H_u = w: Newton's method on H, its residual within this share of 1 + |w| (H stalls at 5e-10 to 1e-6 on the far sheets and near a branch value: float64 in a large log coordinate; the design allows 1.5e-3), in at most this many steps
  const MONO_DLAM = 1e-3;   // the step of the central difference of H in the log coordinate (H's own evaluation is exact in it)
  const COUNT_R_MIN = 1e-6;   // the scene's count (__cmwLandWind) leaves out the members within this distance of the origin of plane z (its WIND_EPS_R); members that near are tracked but not counted
  const END_Z_TOL = 1e-3;   // an edge end's z is the frame's float32 inverse: a member of the enumerator is at it within this share of 1 + |z|
  const LAMBDA_SAME = 1e-4;   // two certified roots are one member when their log coordinates agree within this share of 1 + |lam| (whatever sheets list them): Newton's certificate is 1e-5 of H, and distinct members of a set are far apart in lam
  const SYN_ARM = 0.5;   // the made-up edge through a branch value: half its length in grid cells (its direction runs from the branch value toward the centre of the places the frame spans, so both its ends are in them)
  const BRANCH_LAM = 1e6;   // the log coordinate that stands for a branch point: e^-1e6 is 0 to float64, and a logarithm's output there is -1e6, far beyond any place of a frame
  const STRIP_TOL = 1e-9;   // radians: a member whose log coordinate's imaginary part is this far outside its sheet's window (lo, hi] of the first op (__cmwLandWin) is a range-ramp member the scene's count (a winding inside the window) leaves out; the enumerator's own level test (lvl >= 0, src/inverse.js) is the same rule
  const CTL_NA = { seam: ['log of an annulus@0.5', 'log of an annulus@0.75'], ramp: ['log of an annulus@0.75'] };   // the rows (case tag @ u) where a control has nothing to run on, so it is listed and checked: a row off the list that cannot run fails, and so does a row on it that can
  const RAMP_LATTICE = 40;   // places on a side of the lattice the ramp-member control searches
  const LOOP_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];   // the directions the displaced control moves its loops: each of the eight neighbours of the vertex
  const CELL_QUANT = 8;   // a branch cell is named by its lower-left corner in eighths of a grid cell
  const ORBIT_EXTRA = 2;   // the roots of an orbit added for a loop's image are at most the scene's member count here plus this many (past it the loop is unresolved)
  const MONO_FAR = 8;   // grid cells: a member set the enumerator does not complete is counted and certified this far from the place, and continued in
  const MONO_SEP = 0.5;   // a tracked member moves at most this share of its distance to the nearest other member in a step, so two members never swap
  const MONO_STEPS_MAX = 4000, MONO_MIN_DT = 1e-9;   // the tracker's steps along one path, and the smallest share of a segment a step may take (past them the path is unresolved, a red)
  const BRANCH_CELLS_PER_POINT = 4;   // the most cells of a grid one point can touch
  const MONO_DISPLACE = 3;   // grid cells: the control's loops are moved this far from the vertex, away from the cells that can hold its branch point
  const SAME_PLACE = [1.5, 0.37];   // a place away from the branch points and the cuts, where the control's one member is continued
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
    // The flagged edges whose cut is at an end of their chord (the vertex taken as the cut), the ones on the step's cut set aside (the vertex is within
    // tol of the chord's length of it): the rest are judged by certificates that read only the scene's homotopy H (__cmwLandHom) and the enumerator's
    // members as candidates, never the page's seam pass. The members of H_u at a place w are the certified roots found by Newton's method on H = w; a
    // path in w is tracked by continuing every member at once, a step accepted when Newton converges to MONO_CERT and no member moves more than MONO_SEP
    // of its distance to the nearest other member (halved otherwise; past MONO_STEPS_MAX steps or MONO_MIN_DT the path is unresolved).
    certPrep: () => {
      const r = window.__cmwLandCutEdges();
      if (!r) return null;
      const tol = Math.pow(2, 1 - r.steps), pend = [], out = { n: 0, onCut: 0 };
      let h = Infinity;
      for (const e of r.edges) { const d = Math.hypot(e[9] - e[7], e[10] - e[8]); if (d > 0 && d < h) h = d; }
      for (const e of r.edges) {
        const t = e[4];
        if (!(t < tol || t > 1 - tol)) continue;
        out.n++;
        const chord = Math.hypot(e[2] - e[0], e[3] - e[1]), v = t > 0.5 ? [e[2], e[3]] : [e[0], e[1]];
        if ((v[0] < 0 ? Math.abs(v[1]) : Math.hypot(v[0], v[1])) <= tol * chord) { out.onCut++; continue; }
        pend.push(e);
      }
      window.__lxPend = pend; window.__lxGrid = h; window.__lxSheetCode = r.seam.sheetCode;
      // the branch value of the branch point z = 0: the frame's homotopy at the log coordinate -BRANCH_LAM (z = e^-BRANCH_LAM, which is 0 to float64), and whether it
      // is inside the places the frame's edges span (null: not finite)
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const e of r.edges) for (const [x, y] of [[e[7], e[8]], [e[9], e[10]]]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const hb = window.__cmwLandHom([0, 0], [-${BRANCH_LAM}, 0]), wb = hb && hb[0] && hb[0].H;
      const inPlace = !!wb && Number.isFinite(wb[0]) && Number.isFinite(wb[1]) && wb[0] >= x0 && wb[0] <= x1 && wb[1] >= y0 && wb[1] <= y1;
      window.__lxRegion = [x0, x1, y0, y1];
      window.__lxWin = window.__cmwLandWin() || [];
      return { n: out.n, onCut: out.onCut, pending: pend.length, h, wb, inPlace, region: [x0, x1, y0, y1] };
    },
    // One pending edge's class: 'seam' (continuing its first end's member along the edge's place segment lands on a member other than the second
    // end's), 'branch' (the monodromy of the members round one of the four cells at its vertex has a cycle holding both ends' members, so a branch value
    // lies in that cell and joins exactly them; cell: its lower-left corner), 'false' (neither), or 'unresolved'. opt: sep false (no separation check),
    // swapB (the second member replaced by one that is no member), displace (the loops moved MONO_DISPLACE cells in each of eight directions:
    // loops: how many still certify), same (the place w0 of a made-up edge, the first member there continued one grid step along x, in place of
    // pending edge k: never a seam, a branch or a cut)
    certEdge: (k, opt) => {
      const cabs = (a) => Math.hypot(a[0], a[1]), csub = (a, b) => [a[0] - b[0], a[1] - b[1]], cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
      const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
      const clog = (a) => [Math.log(cabs(a)), Math.atan2(a[1], a[0])], mix = (a, b, t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      const sepOn = !(opt && opt.sep === false), h = window.__lxGrid;
      // H on a sheet at a member's log coordinate lam (z = e^lam): a member is solved and tracked in lam, where H is smooth at a branch value and a far
      // sheet's z is not large; a member with no log coordinate is solved in z
      const expc = (l) => { const e = Math.exp(l[0]); return [e * Math.cos(l[1]), e * Math.sin(l[1])]; };
      const homAt = (z, lam, sh) => { const q = window.__cmwLandHom(z, lam); const o = q && q[sh]; return o && o.H ? o : null; };
      let nfail = null;   // (why the last Newton solve gave up: the step, the residual or the missing homotopy value)
      const newton = (m, w, inZ) => {
        let z = m.z, lam = inZ ? null : m.lam;   // (inZ: the member is continued in z, where steps near a branch value may swap members)
        for (let i = 0; i < ${MONO_NEWT_MAX}; i++) {
          const o = homAt(z, lam, m.sheet);
          if (!o) { nfail = { i, why: 'hom', sheet: m.sheet }; return null; }
          const res = csub(o.H, w);
          const certRes = cabs(res) <= ${MONO_CERT} * (1 + cabs(w));
          if (lam) {
            const pl = csub(lam, [-${MONO_DLAM}, 0]), ml = csub(lam, [${MONO_DLAM}, 0]), a = homAt(expc(pl), pl, m.sheet), b = homAt(expc(ml), ml, m.sheet);
            if (!a || !b) { nfail = { i, why: 'dlam-hom' }; return null; }
            const d = [(a.H[0] - b.H[0]) / (2 * ${MONO_DLAM}), (a.H[1] - b.H[1]) / (2 * ${MONO_DLAM})], dl = cdiv(res, d);
            if (!(cabs(dl) < 1e30)) { nfail = { i, why: 'dlam' }; return null; }
            // (a root is certified when the residual is small and the correction it implies is within LAMBDA_SAME: where H is flat, as near a branch value, a small
            // residual alone is a position that may be far off)
            if (certRes && cabs(dl) <= ${LAMBDA_SAME}) return { z, lam, sheet: m.sheet, sheets: m.sheets, lvl: m.lvl };
            lam = csub(lam, dl); z = expc(lam);
            nfail = { i, res: cabs(res), dl: cabs(dl), sheet: m.sheet };
            continue;
          }
          if (certRes) return { z, lam, sheet: m.sheet, sheets: m.sheets, lvl: m.lvl };
          const dz = cdiv(res, o.dH);
          if (!(cabs(dz) < 1e30)) { nfail = { i, why: 'dz' }; return null; }
          z = csub(z, dz);
          nfail = { i, res: cabs(res), dz: cabs(dz), sheet: m.sheet };
        }
        return null;
      };
      // (the glide's sheets an edge's ends hold: sheet i has the code sheetCode + i; an end on no sheet takes the other's)
      const shOf = (c, o) => Math.max(0, Math.round((c > 5 ? c : o) - window.__lxSheetCode));
      let want = [0];
      // the distance of two members: in lam where both have one (two members of different sheets can share a z and differ by turns in lam), else in z
      const dist = (p, q) => (p.lam && q.lam ? cabs(csub(p.lam, q.lam)) : cabs(csub(p.z, q.z)));
      // the members of the wanted sheets at w as many as the scene's count says (__cmwLandWind: the winding count N of each sheet's H - w); where the enumerator
      // finds fewer (near a branch value) the set is the one MONO_FAR cells away, counted likewise, continued to w in the log coordinate
      const countAt = (w) => { const q = window.__cmwLandWind(w); return q ? q.reduce((n, r) => n + (want.includes(r.sheet) ? (r.status === 'ok' ? r.N : NaN) : 0), 0) : NaN; };
      // (the count N is of the members inside the frame's box in plane z: the set holds the members outside it too, and the enumerator's ramp members (level below 0, outside their sheet's window), a flagged edge's own member can be one)
      const box = (() => { const b = window.__cmwLandCarry(true); return b && { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }; })();
      const inBox = (m) => !box || (m.z[0] >= box.x0 && m.z[0] <= box.x1 && m.z[1] >= box.y0 && m.z[1] <= box.y1);
      const listAt = (w) => {
        const out = [];
        for (const e of (window.__cmwLandEnum([w]) || [[]])[0]) {
          if (!want.includes(e.sheet)) continue;   // (the sheets the edge's ends hold; the others only crowd the separation check)
          const m = newton({ z: e.z, lam: e.lam, sheet: e.sheet, sheets: [e.sheet], lvl: e.lvl }, w);
          if (!m) continue;
          const q = !(opt && opt.countRamp) && out.find((x) => dist(x, m) <= ${LAMBDA_SAME} * (1 + cabs(m.lam || m.z)));   // (countRamp: every sheet's entry is its own member, so the ramp sheets of a member count again)
          if (q) { if (!q.sheets.includes(m.sheet)) q.sheets.push(m.sheet); if (!(m.lvl < 0)) q.lvl = m.lvl; } else out.push(m);   // (a member any of whose sheets has it in its window is counted)
        }
        return out;
      };
      // (a member is in a sheet's window when the imaginary part of its log coordinate is in (lo, hi] of that sheet's first op, within STRIP_TOL; a member with no
      // log coordinate falls back to the enumerator's level; opt.countRamp counts the ramp members too: the control that the count catches them)
      const inWin = (m) => !m.lam || !window.__lxWin.length || (m.sheets || [m.sheet]).some((sh) => { const q = window.__lxWin[sh]; return !q || q.lo === null || (m.lam[1] > q.lo - ${STRIP_TOL} && m.lam[1] <= q.hi + ${STRIP_TOL}); });
      const counted = (set) => set.filter((m) => cabs(m.z) >= ${COUNT_R_MIN} && inBox(m) && (inWin(m) || !!(opt && opt.countRamp))).length;
      const membersN = (w) => {
        const n = countAt(w), out = listAt(w);
        if (counted(out) === n) return out;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const wf = [w[0] + dx * ${MONO_FAR} * h, w[1] + dy * ${MONO_FAR} * h], sf = listAt(wf);
          if (counted(sf) !== countAt(wf)) continue;
          const tr = track(sf, [wf, w]);
          if (tr && counted(tr) === n) return tr;
        }
        return null;
      };
      const membersAt = (w) => membersN(w) || [];   // (none: the set could not be counted and certified, which the callers report as unresolved)
      const sepOf = (set, i) => { let d = Infinity; set.forEach((m, j) => { if (j !== i) d = Math.min(d, dist(m, set[i])); }); return d; };
      let fail = null;   // (why the last path failed: the segment, the share of it, the member Newton lost or the separation check)
      const track = (set, pts) => {
        let cur = set, steps = 0;
        for (let s = 0; s + 1 < pts.length; s++) {
          let t0 = 0, dt = 1;
          while (t0 < 1) {
            if (++steps > ${MONO_STEPS_MAX}) { fail = { s, t0, why: 'steps' }; return null; }
            const t1 = Math.min(1, t0 + dt), w = mix(pts[s], pts[s + 1], t1), nx = cur.map((m) => newton(m, w, opt && opt.zchart));
            let good = nx.every(Boolean);
            if (good && sepOn) good = nx.every((m, i) => dist(m, cur[i]) <= ${MONO_SEP} * sepOf(nx, i));
            if (good) { cur = nx; t0 = t1; dt = Math.min(dt * 2, 1 - t0 || 1); } else { dt /= 2; if (dt < ${MONO_MIN_DT}) { fail = { s, t0, why: nx.every(Boolean) ? 'sep' : 'newton ' + nx.findIndex((m) => !m) + ' of ' + nx.length, nfail }; return null; } }
          }
        }
        return cur;
      };
      // (the member of a set nearest z on the sheet: two members of different sheets are two members even where their z coincide)
      const nearest = (set, z, sheet) => { let b = -1, d = Infinity; set.forEach((m, i) => { const q = (m.sheets || [m.sheet]).includes(sheet) ? (z.lam ? dist(m, z) : cabs(csub(m.z, z.z || z))) : Infinity; if (q < d) { d = q; b = i; } }); return { i: b, d }; };
      if (opt && opt.countAt) {
        // (the scene's count of the members at a place against the certified members there: every sheet; countRamp counts the ramp members too)
        want = (window.__cmwLandWind(opt.countAt) || []).map((r) => r.sheet);
        return { N: countAt(opt.countAt), n: counted(listAt(opt.countAt)) };
      }
      let e = window.__lxPend[k];
      if (opt && opt.syn) {
        // (a made-up edge through the branch value bv, from one side of it to the other (so the track along it cannot complete, as for a real edge at a branch
        // value): its ends are the vertices bv +- SYN_ARM cells toward the centre of the places the frame spans, the first end's member the first of the sheets with a member in
        // the box there, the second end's the next one at the other vertex; the sheets taken are those the scene counts a member of at the first vertex)
        const rg = window.__lxRegion, ang = Math.atan2((rg[2] + rg[3]) / 2 - opt.syn[1], (rg[0] + rg[1]) / 2 - opt.syn[0]), wv0 = [opt.syn[0] + Math.cos(ang) * ${SYN_ARM} * h, opt.syn[1] + Math.sin(ang) * ${SYN_ARM} * h], wo0 = [2 * opt.syn[0] - wv0[0], 2 * opt.syn[1] - wv0[1]];
        want = (window.__cmwLandWind(wv0) || []).filter((r) => r.status === 'ok' && r.N > 0).map((r) => r.sheet);
        const set0 = membersAt(wv0), setB0 = membersAt(wo0);
        if (set0.length < 2 || setB0.length < 2) return { cls: 'unresolved', why: 'syn', n: [set0.length, setB0.length], want, fail };
        const code = window.__lxSheetCode + set0[0].sheet, code1 = window.__lxSheetCode + setB0[1].sheet;
        e = [set0[0].z[0], set0[0].z[1], setB0[1].z[0], setB0[1].z[1], 0, code, code1, wv0[0], wv0[1], wo0[0], wo0[1]];
      }
      if (opt && opt.same) {
        const w0 = opt.same, w1 = [w0[0] + h, w0[1]], set0 = membersAt(w0), tr = set0.length ? track(set0, [w0, w1]) : null;
        if (!tr) return { cls: 'unresolved', why: 'same' };
        e = [set0[0].z[0], set0[0].z[1], tr[0].z[0], tr[0].z[1], 0, 1, 1, w0[0], w0[1], w1[0], w1[1]];
      }
      const [ax, ay, bx, by, t, ca, cb, wax, way, wbx, wby] = e;
      // (an end's sheet: the page's label where a member of that sheet is at the end's z, else the lowest sheet whose member is there; a label that no member
      // backs is not a certificate. Sheets of equal z (a root's sheets differing by turns) are told apart by the label)
      const sheetAt = (w, z, label) => {
        const at = (window.__cmwLandEnum([w]) || [[]])[0].filter((e) => cabs(csub(e.z, z)) <= ${END_Z_TOL} * (1 + cabs(z))).map((e) => e.sheet);
        return at.includes(label) || !at.length ? label : at[0];
      };
      const lA = shOf(ca, cb), lB = shOf(cb, ca), sA = sheetAt([wax, way], [ax, ay], lA), sB = sheetAt([wbx, wby], [bx, by], lB);
      want = [...new Set([sA, sB])];
      const atA = t < 0.5, zv = atA ? [ax, ay] : [bx, by], wv = atA ? [wax, way] : [wbx, wby], zo = atA ? [bx, by] : [ax, ay], wo = atA ? [wbx, wby] : [wax, way];
      // the seam: the first end's member continued along the edge to the second end's place, by a completed track with its sheet kept by continuity; it is a
      // seam when it arrives at a member of that place other than the second end's (found by its z among the members there, whatever label the page gave it)
      const shA = sA, shB = sB, setA = membersAt([wax, way]), ia = nearest(setA, [ax, ay], shA);
      const trA = ia.i >= 0 && ia.d <= ${MONO_SEP} * sepOf(setA, ia.i) ? track(setA, [[wax, way], [wbx, wby]]) : null;
      if (trA) {
        const setB = opt && opt.emptyB ? [] : membersAt([wbx, wby]), anyB = (() => { let b = -1, d = Infinity; setB.forEach((m, i) => { const q = cabs(csub(m.z, [bx, by])); if (q < d) { d = q; b = i; } }); return b; })();
        const c = trA[ia.i];
        if (anyB < 0) return { cls: 'unresolved', why: 'bset' };   // (no certified member at the second end's place: no certificate of a seam)
        if (dist(c, setB[anyB]) > ${LAMBDA_SAME} * (1 + cabs(c.lam || c.z))) return { cls: 'seam' };
      }
      // the branch value: the monodromy of the members round the cells at the vertex (based loops), and where a track fails round the 2 x 2 ring there
      const shV = atA ? shA : shB, shO = atA ? shB : shA;
      // (the sets the loops move hold the members of every sheet: a loop round a branch value carries a member to one of another sheet)
      want = (window.__cmwLandWind(wv) || []).map((r) => r.sheet);
      const setV = membersAt(wv), iv = nearest(setV, zv, shV), setO = membersAt(wo), io = nearest(setO, zo, shO);
      if (iv.i < 0 || io.i < 0) return { cls: 'unresolved', why: 'members', sets: [setV.length, setO.length, iv.i, io.i] };
      // (the other end's member carried to the vertex: along the edge, or round it by a detour one grid step to the side where the edge's track fails)
      let trO = track(setO, [wo, wv]);
      for (const [dx, dy] of trO ? [] : [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        trO = track(setO, [wo, [wo[0] + dx * h, wo[1] + dy * h], [wv[0] + dx * h, wv[1] + dy * h], wv]);
        if (trO) break;
      }
      if (!trO) return { cls: 'unresolved', why: 'edge', fail };
      // (the other end's member at the vertex: the one the vertex's set holds there, or, where the enumerator leaves it out (a member of the range ramp), the
      // carried member itself, a certified root of its sheet's H, joined to the set so that the loops move it too)
      let ib = opt && opt.swapB ? -2 : nearest(setV, trO[io.i], trO[io.i].sheet).i;
      if (ib === -1) { setV.push(trO[io.i]); ib = setV.length - 1; }
      const loop = (c0, sx, sy) => [wv, c0, [c0[0] + sx * h, c0[1]], [c0[0] + sx * h, c0[1] + sy * h], [c0[0], c0[1] + sy * h], c0, wv];
      const ring = [wv, [wv[0] + h, wv[1]], [wv[0] + h, wv[1] + h], [wv[0] - h, wv[1] + h], [wv[0] - h, wv[1] - h], [wv[0] + h, wv[1] - h], [wv[0] + h, wv[1]], wv];
      // (the member a tracked member has arrived at, by its log coordinate whatever sheets list it: the monodromy of a loop is read along the chain from a; the
      // chain is lost where an image is no member of the set, and the loop is then no certificate of either answer)
      const cyc = (pts) => {
        const tr = track(setV, pts);
        if (!tr) return null;
        iv.lam0 = tr[iv.i].lam && setV[iv.i].lam ? csub(tr[iv.i].lam, setV[iv.i].lam) : null;   // (the shift of a's log coordinate round the loop)
        let c = iv.i, hit = false, lost = false;
        for (let g = 0; g <= setV.length; g++) {
          const n = (() => { let b = -1, d = Infinity; setV.forEach((q, j) => { const x = dist(q, tr[c]); if (x < d) { d = x; b = j; } }); return d <= ${LAMBDA_SAME} * (1 + cabs(tr[c].lam || tr[c].z)) ? b : -1; })();
          if (n < 0) { lost = true; break; }
          if (n === ib) hit = true;
          if (n === iv.i) break;
          c = n;
        }
        return { hit, lost, shift: iv.lam0 };
      };
      // (the two ends hold one member, the same root whatever sheets the page gave them: no cut, no branch)
      if (ib === iv.i) return { cls: 'false', why: 'one member', dl: dist(setV[iv.i], trO[io.i]) };
      if (opt && opt.displace) {
        let n = 0;
        for (const [dx, dy] of ${JSON.stringify(LOOP_DIRS)}) {
          const c0 = [wv[0] + dx * ${MONO_DISPLACE} * h, wv[1] + dy * ${MONO_DISPLACE} * h];
          for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const q = cyc(loop(c0, sx, sy)); if (q && q.hit) { n++; break; } }
        }
        return { cls: 'displaced', loops: n };
      }
      // (the orbit of a: where a loop carries a to a member the set does not list, the roots a + k T, T the shift of its log coordinate round the loop, are certified
      // on the scene's H at the vertex and added, at most ORBIT_MAX of them: the loop is then read on the larger set, past the cap it stays unresolved)
      const orbitMax = Math.round(countAt(wv)) + ${ORBIT_EXTRA};
      let enlarged = false;
      const enlarge = (T) => {
        if (enlarged || !T || !(cabs(T) > 0)) return false;
        enlarged = true;
        let added = 0;
        for (let k = 1; added < orbitMax && k <= orbitMax; k++) for (const sg of [1, -1]) {
          const lam = [setV[iv.i].lam[0] + sg * k * T[0], setV[iv.i].lam[1] + sg * k * T[1]];
          const m = newton({ z: expc(lam), lam, sheet: setV[iv.i].sheet, sheets: setV[iv.i].sheets, lvl: setV[iv.i].lvl }, wv);
          if (m && !setV.some((x) => dist(x, m) <= ${LAMBDA_SAME} * (1 + cabs(m.lam)))) { setV.push(m); added++; }
        }
        return added > 0;
      };
      const read = (pts) => { let q = cyc(pts); if (q && q.lost && enlarge(q.shift)) q = cyc(pts); return q; };
      if (opt && opt.noLoops) return { cls: 'false', why: 'no loops' };   // (the no-reach control: with no loop to read, a branch edge is not certified)
      let unres = false;
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const q = read(loop(wv, sx, sy));
        if (!q) { unres = true; continue; }
        if (q.lost) unres = true;
        if (q.hit) return { cls: 'branch', cell: [Math.round(Math.min(wv[0], wv[0] + sx * h) / h * ${CELL_QUANT}), Math.round(Math.min(wv[1], wv[1] + sy * h) / h * ${CELL_QUANT})] };
      }
      if (unres) { const q = read(ring); if (q && q.hit) return { cls: 'branch', cell: [Math.round(wv[0] / h * ${CELL_QUANT}), Math.round(wv[1] / h * ${CELL_QUANT}), 'ring'] }; if (!q || q.lost) return { cls: 'unresolved', why: 'ring', fail }; }
      return { cls: 'false' };
    },
    // a place of the frame's region where the enumerator lists a range-ramp member (level below 0) on some sheet, found on a lattice of n x n places: null when there is none
    rampPlace: (n) => {
      const [x0, x1, y0, y1] = window.__lxRegion, b = window.__cmwLandCarry(true);   // (a ramp member in the box and beyond the count's inner radius, where the count would see it)
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const w = [x0 + (x1 - x0) * (i + 0.5) / n, y0 + (y1 - y0) * (j + 0.5) / n];
        if ((window.__cmwLandEnum([w]) || [[]])[0].some((e) => e.lvl < 0 && b && e.z[0] >= b.x0 && e.z[0] <= b.x1 && e.z[1] >= b.y0 && e.z[1] <= b.y1 && Math.hypot(e.z[0], e.z[1]) >= ${COUNT_R_MIN})) return w;
      }
      return null;
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
        // the flagged edges at an end of their chord: on the step's cut, a seam between two members of the glide's map (which the sheets-off two-layer
        // item (#1439) turns into layers) or a branch value in a cell at the vertex, each proved by the certificates of __lx.certEdge, never a cut
        // where there is none; the members are those of the scene's homotopy, so none of the page's seam constants is read
        const prep = await ev('__lx.certPrep()');
        const certs = [];
        for (let k = 0; k < prep.pending; k++) certs.push(await ev(`__lx.certEdge(${k}, {})`));
        const cls = (x) => certs.filter((q) => q.cls === x).length, cells = new Set(certs.filter((q) => q.cls === 'branch').map((q) => q.cell.join(',')));
        const cc = { onCut: prep.onCut, seam: cls('seam'), branch: cls('branch'), falseN: cls('false'), unresolved: cls('unresolved'), cells: cells.size, why: certs.filter((q) => q.why).map((q) => q.why), fails: certs.filter((q) => q.fail).slice(0, 3).map((q) => q.fail) };
        r[u].cutClasses = cc;
        ok(`${t}: every flagged edge at an end of its chord is on the step's cut (${cc.onCut}), a certified member seam (${cc.seam}) or a certified branch cell (${cc.branch} edges in ${cc.cells} cells); ${cc.falseN} are none and ${cc.unresolved} unresolved`, cc.falseN === 0 && cc.unresolved === 0, cc);
        // the certified branch cells are at most those the scene's branch points can touch
        // a branch is certified only where the branch value is one of the places the frame draws: elsewhere the edges' certificate sets are seams only
        cc.wb = prep.wb; cc.inPlace = prep.inPlace; cc.region = prep.region;
        ok(`${t}: the branch value ${JSON.stringify(prep.wb)} ${prep.inPlace ? 'is' : 'is not'} in the places the frame spans; the certified branch cells (${cc.cells}) are ${prep.inPlace ? 'at most ' + BRANCH_CELLS_PER_POINT * brPts.length + ' for the ' + brPts.length + ' branch points' : 'none'}`, prep.inPlace ? cc.cells <= BRANCH_CELLS_PER_POINT * brPts.length : cc.branch === 0, cc);
        // the controls, each of which must fail the certificate: a made-up edge between one member's two places is none; a wrong second member and loops
        // moved MONO_DISPLACE cells away (in some direction every loop is then a trivial one) do not certify a branch edge
        const ctlA = await ev(`__lx.certEdge(0, { same: ${JSON.stringify(SAME_PLACE)} })`);
        ok(`${t}: control: a made-up flagged edge between one member's two places is none (${ctlA ? ctlA.cls : '?'})`, !!ctlA && ctlA.cls === 'false', ctlA);
        const bIdx = certs.map((q, k) => (q.cls === 'branch' ? k : -1)).filter((k) => k >= 0);
        let nSwap = 0, nDisp = 0;
        for (const k of bIdx) {
          const sw = await ev(`__lx.certEdge(${k}, { swapB: true })`), dp = await ev(`__lx.certEdge(${k}, { displace: true })`);
          if (sw.cls === 'false') nSwap++;
          if (dp.cls === 'displaced' && dp.loops < LOOP_DIRS.length) nDisp++;
        }
        ok(`${t}: control: a wrong second member certifies none of the ${bIdx.length} branch edges (${nSwap} are none)`, nSwap === bIdx.length, { nSwap });
        ok(`${t}: control: loops moved ${MONO_DISPLACE} cells away do not all certify any of the ${bIdx.length} branch edges (${nDisp})`, nDisp === bIdx.length, { nDisp });
        // the controls of the certificate's inputs: an edge whose second end has no certified member is unresolved, never a seam; counting the range-ramp members makes
        // the scene's count (the winding inside each sheet's window) disagree with the members, so some edge becomes unresolved; and a branch edge read with no loops
        // is not certified
        const kSeam = certs.findIndex((q) => q.cls === 'seam');
        if (kSeam >= 0) { const eb = await ev(`__lx.certEdge(${kSeam}, { emptyB: true })`); ok(`${t}: control: a seam edge whose second end has no certified member is unresolved (${eb.cls})`, eb.cls === 'unresolved', eb); }
        r[u].noSeam = kSeam < 0;
        if (kSeam < 0) ok(`${t}: control: this row has no seam edge to empty the second end of, as the row's list expects (${certs.length} edges)`, CTL_NA.seam.includes(`${c.tag}@${u}`) && certs.every((q) => q.cls !== 'seam'), { n: certs.length });
        else ok(`${t}: control: a row with a seam edge is not on the list of rows that have none`, !CTL_NA.seam.includes(`${c.tag}@${u}`), { n: certs.length });
        const rp = await ev(`__lx.rampPlace(${RAMP_LATTICE})`);
        if (rp) {
          ok(`${t}: control: a row with a ramp place is not on the list of rows that have none`, !CTL_NA.ramp.includes(`${c.tag}@${u}`), { rp });
          const cOff = await ev(`__lx.certEdge(0, { countAt: ${JSON.stringify(rp)} })`), cOn = await ev(`__lx.certEdge(0, { countAt: ${JSON.stringify(rp)}, countRamp: true })`);
          ok(`${t}: control: at a place with a range-ramp member (${JSON.stringify(rp)}) the certified members match the scene's count (${cOff.n} of ${cOff.N}) and with the ramp members counted they do not (${cOn.n})`, cOff.n === cOff.N && cOn.n !== cOn.N, { cOff, cOn });
        } else ok(`${t}: control: no place of a ${RAMP_LATTICE} x ${RAMP_LATTICE} lattice holds a range-ramp member, as the row's list expects`, CTL_NA.ramp.includes(`${c.tag}@${u}`), null);
        r[u].noRamp = !rp;
        // the cell that holds a branch value of the scene (the root's 0): a made-up edge there must certify a branch, which the wrong-member, displaced-loop and
        // no-separation-check controls must each break; a row whose branch value (the frame's homotopy at the branch point, read by certPrep) is no place of the frame certifies none
        const bvs = prep.inPlace ? [prep.wb] : [];
        if (!bvs.length) ok(`${t}: the scene's branch values have no place on the grid, so no real edge certifies a branch (${cc.branch})`, cc.branch === 0, cc);
        for (const bv of bvs) {
          const syn = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)} })`), synSw = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, swapB: true })`);
          const synNL = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, noLoops: true })`);
          ok(`${t}: control: with no loops to read the made-up branch edge is not certified (${synNL.cls})`, synNL.cls !== 'branch', synNL);
          const synDp = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, displace: true })`);
          const synZ = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, zchart: true })`), synZoff = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, zchart: true, sep: false })`);
          ok(`${t}: a made-up edge in the cell that holds the branch value ${JSON.stringify(bv)} certifies a branch (${syn.cls})`, syn.cls === 'branch', syn);
          ok(`${t}: control: with a wrong second member it certifies none (${synSw.cls})`, synSw.cls === 'false', synSw);
          ok(`${t}: control: with the loops moved ${MONO_DISPLACE} cells away some loop of every direction fails to hold the branch value (${synDp.loops} of ${LOOP_DIRS.length} still certify)`, synDp.cls === 'displaced' && synDp.loops < LOOP_DIRS.length, synDp);
          ok(`${t}: control: in the z chart (steps near the branch value swap members) the verdict without the separation check (${synZoff.cls}) differs from the one with it (${synZ.cls})`, synZoff.cls !== synZ.cls, { synZ, synZoff });
        }
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

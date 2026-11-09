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
// - the image at the end probes (u = END_U and 1 - END_U): u below 0.5 is plane z's parked frame and u above it the next plane's, at most
//   SAME_FRAC of the pixels more than DIFF_TOL apart (the exact images' tolerance, steps_sm_standin_cmd.js). At the other probes
//   (0.002, 0.998) a glide is not at rest, so the frame is judged by the exact reference at its own u (the relief raster and the
//   members, above), and its distance to the parked plane must fall as u goes to the plane (Ruling C of the exact Landscape work, #1342).
// The exact reference (members, heights, coverage) is the CPU: Inverse.enumerate (src/inverse.js, the CPU twin of the GPU walk) and the
// forward chain's own evaluation (Funcs.sheetEval). It shares with the GPU inverse path (INV_LAND_MAIN and the carry shaders) the chain's
// plan and prep data and the frame's camera and height function that put a member on the screen, and no GLSL and no part of the walk.
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
  // the step sheets dk the glide draws are -SHEET_W..SHEET_W and M_MAX members m of a sheet are tried; a member whose turn lies within
  // EDGE_MARGIN (in Im) of its sheet's window edge is on that edge
  const SHEET_W = 2, M_MAX = 8, EDGE_MARGIN = 0.1;
  // A ruler label's screen y is a float, drawn with the glyphs snapped to the pixel grid: at most half a pixel in each of two frames. The end
  // frame's real scale gap against the parked plane (1.6e-4 of the ruler's length at 1 - END_U, a few hundredths of a pixel) adds to that, so
  // two frames' labels are at most TICK_PX = 1 px apart; the gap itself is not absorbed here: the own-height check below sees it.
  const TICK_PX = 1;
  // The cut's seam: parked draws the cut as one continuous surface with no dark line, so the pixels of a near-end frame that differ from
  // the next plane's parked frame form no run of connected pixels as long as a seam. The rim's anti-aliasing dots are runs of at most 27.
  const SEAM_RUN = 40;
  const SEAM_U = [1 - 1e-5];   // (the glide's u of the seam's darker-than-parked measure besides the end probe: the nearest to plane 1)
  const LUMA = [0.299, 0.587, 0.114];
  // The frame's own seam: a sample on the cut curve is dark when its pixel is SEAM_DARK_TOL (a quarter of DIFF_TOL: a broken seam is
  // shaded 8 to 16 levels below its banks, under DIFF_TOL) below the frame's pixels SEAM_SIDE_PX to both sides of the curve. A sound seam has none.
  // The curve's end at the origin is left out: the sample there is the surface's own dark corner, one pixel at each layer. Fewer than
  // SEAM_MIN_SAMPLES samples is no measurement.
  const SEAM_DARK_TOL = 8, SEAM_DARK_MAX = 0, SEAM_MIN_SAMPLES = 100, SEAM_END_PX = 4;
  const SEAM_SIDE_PX = 3;   // (the seam measure compares a seam pixel with the frame's own pixels this far to either side of the cut curve)
  const TICK_H_TOL = 1e-9;   // (a label's world height against the frame's own height function of its value: the same float computation)
  const TICK_SCALE_ERR = 1.6e-3;   // (the scale error the own-scale check must see: the gap the near ends have against the parked plane at .998)
  const SCALE_TOL = 1e-3;   // (the relative difference under which two scales are one: they are the same computation at the same map and box)
  const CUT_PROBE_U = 0.002, LAYER_GAP_MIN = 0.5;   // (the glide's u of the cut probe; the layers' heights are about 0.9 apart at the fitted scale)
  const PLANE_BOX_TOL = 1e-9;   // (the scene's plane box and the drawn box are the same numbers read twice)
  const END_U = 1e-4;   // (a polynomial's step runs its path several times as fast as the glide's u: its ends are this far from the planes)
  const TOP_CAM = { yaw: -Math.PI / 2, pitch: 88 * Math.PI / 180 };   // the Top view: the camera the end frames are also compared in, where a missing piece of the surface shows against the pale floor
  const GLIDE_MID = 0.5;   // (the glide's middle: probes before it are near plane z, after it near the next plane)
  const CONT_STEP = 0.02;   // (the continuity probe's two frames: u - CONT_STEP / 2 and u + CONT_STEP / 2)
  const CONT_AT = [0.25, GLIDE_MID, 0.75];
  const CONT_LIPSCHITZ = 1;   // (the largest change of a layer's height at a place, in block heights, per unit of u)
  const CLIP_CONTROL_U = 0.998;   // (the glide's u of the block clip's controls: the tower's cut shows in the image at once)
  const GLIDE_U = [END_U, 0.002, GLIDE_MID, 0.998, 1 - END_U];
  const SEAM_AT = [1 - END_U, 0.998, 1 - 1e-5];   // (the glide's u of the frame's own seam measure)
  // (the probes at 0.002 and 0.998 are the far-end check: judged by the exact reference at their own u, not by the parked plane, below
  // (Ruling C); END_U is the ends of a polynomial's glide)
  const { grab, compare, DIFF_TOL, SAME_FRAC } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));   // (the look suite's constants)
  // the share of the parked plane's surface pixels a frame at an end may lack: it is the parked plane's within SAME_FRAC of its pixels,
  // so a surface pixel it lacks is one of those
  const COVER_TOL = SAME_FRAC;
  // A glide leaves a plane at a nonzero rate: the height scale mu = logLerp(ma, mb, u) falls at about -2.35 per unit u in ln(mu) for
  // Roots (-0.47 % at u = 0.002), and the points move along the glide by about u |F - z|. A frame at 0.002 or 0.998 is therefore not
  // the parked plane: it is compared with the exact reference at its own u (the relief raster and the members, below), and the distance
  // to the parked plane is checked to fall to it: at END_U it is within SAME_FRAC (the end probes), and it never rises as u falls
  // (each step of REST_STEPS times END_U from the plane may drop by at most MONO_SLACK, a tenth of SAME_FRAC: the jitter measured between
  // two renders of one frame is 2e-4)
  const REST_STEPS = [1, 3, 10, 20], MONO_SLACK = SAME_FRAC / 10, REST_RISE_MIN = 2 * MONO_SLACK;
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
  const WIND_PLACES = 12, CUT_DELTA = 0.5;   // (places counted per frame; the control's shift of the cut circle's radius)   // (places counted per frame)
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
  // The grid has ROWS_SIDE rows on each side of the real axis and none on it (the axis is the cut of the roots and the logarithm, where
  // the side a place falls on is decided by the sign of a rounding error in float32 and in float64): a row is at (k + 0.5) / ROWS_SIDE
  // of the box's extent above and below the axis, so both sides have the same density.
  const ROWS_SIDE = 3;
  const Z_TOL = 1e-2;   // the frame's z is the shader's float inverse: a cube root's preimage is w cubed, so its relative error is three times the map's
  const SAME_Z = 1e-5;   // the distance under which two preimages the enumerator lists (the sheets beside the frame's own repeat them) are one member when their drawn heights agree too (members of different sheets of a step come together in z as u falls but are different surfaces)
  const ANN = [{ id: 'a1', kind: 'annulus', c: [0, 0], r: 1, r2: 3, visible: true }];
  const CASES = [
    { tag: 'Möbius, √', seam: true, steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [], clipControls: true, corruptPlan: true },
    // the pole of the step (z = -1) is inside the box: the frame covers the block about it, the cover steps_land_poles holds for the mesh path
    { tag: 'Möbius with a pole in the box', steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }], shapes: [] },
    { tag: 'log of an annulus', logControl: true, steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN, cutProbe: [-1, 0.03] },
    // a box centred off the branch point: the depth keys of different sheets differ at first order there (D = log2(1 + |z - centre| / R)), so a front-by-D rule
    // across sheets takes the sheet nearest the centre where the frame's own sheet (plane 0 parked) is the answer
    { tag: 'log, box centred at 1.5 + 0.5i', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN, srcView: { cx: 1.5, cy: 0.5, s: 110 }, offCentre: true },
    { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [], fixControl: true, clipControls: true, surfaces: 3 },
    { tag: 'Joukowski airfoil', example: 'Joukowski airfoil', cutControl: true },
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
        const part = need.slice(at, at + g.batch), e = __cmwLandMembers(part.map(([i, j]) => xy(i, j)));
        if (!e) return false;
        part.forEach(([i, j], k) => {
          // (a place outside the frame's Inside-regions mask is not drawn as relief: __cmwLandMask is 0 to 1, null with no mask)
          const mk = __cmwLandMask(...xy(i, j));
          let ms = mk !== null && mk < ${MASK_ON} ? [] : e[k].filter((m) => (sheets || m.front) && Number.isFinite(m.h)).map((m) => Object.assign({}, m, { sheet: m.k }));
          // (All sheets: a member a layer per forward combo, as the frame draws it)
          if (sheets && typeof __cmwLandRefSheets === 'function') ms = window.__lxExpand(ms, __cmwLandRefSheets);
          // (a point is its projection and its member's id: a facet pairs the same member at every corner)
          const pts = [];
          for (const m of ms) { const q = __cmwLandProject(...xy(i, j), m.h); if (q && Number.isFinite(q[0] + q[1])) pts.push([q[0] * dpr / 2, q[1] * dpr / 2, m.sheet + ':' + m.member + ':' + m.src + ':' + (m.combo || '')]); }
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
  // the largest relative |H(z) - w| over the members (each { z, w }), each at the surface of the scene's homotopy (window.__cmwLandHom, the cell
  // centred at z) nearest its place: 0 when each member is a preimage of its place; Infinity when the hook has no value there. shift moves every w
  // by that much (the control)
  window.__lxHomMiss = (ms, shift) => {
    const d = ms.map((m) => {
      const hs = typeof __cmwLandHom === 'function' ? __cmwLandHom(m.z) : null;
      return hs ? Math.min(Infinity, ...hs.filter((h) => h.H).map((h) => Math.hypot(h.H[0] - m.w[0] - shift, h.H[1] - m.w[1]) / (1 + Math.hypot(m.w[0], m.w[1])))) : Infinity;
    });
    const bad = ms.map((m, i) => [i, d[i]]).filter(([, x]) => x > window.__lxHomTol);
    return { worst: d.reduce((a, b) => Math.max(a, b), 0), nBad: bad.length, sample: bad.slice(0, 4).map(([i, x]) => ({ z: ms[i].z, w: ms[i].w, miss: x, bySheet: (__cmwLandHom(ms[i].z) || []).filter((h) => h.H).map((h) => [h.sheet, Math.hypot(h.H[0] - ms[i].w[0] - shift, h.H[1] - ms[i].w[1]) / (1 + Math.hypot(ms[i].w[0], ms[i].w[1]))]) })) };
  };
  window.__lxPick = null;
  // the members expanded by the forward combos refsOf(z) gives ([{ combo, z, f, h }] per z): a member with more than one combo is that many
  // layers, the others stay as they are
  window.__lxExpand = (o, refsOf) => o.flatMap((m) => {
    const rs = refsOf(m.z).filter((r) => r.f && r.h !== null);
    return rs.length > 1 ? rs.map((r) => ({ z: m.z, f: r.f, h: r.h, sheet: m.sheet, member: m.member, src: m.src, combo: r.combo })) : [m];
  });
  window.__lxEnum = (pts, sheets) => {
    const e = typeof __cmwLandMembers === 'function' ? __cmwLandMembers(pts) : null;
    if (!e) return null;
    // (the front member first: the hook marks the one the frame draws with sheets off. All sheets: a member of a chain with a multivalued
    // step past plane 0 is drawn once per forward combo of the colour map's distinct sheets, the parked frame's own: window.__cmwLandRefSheets(z),
    // each { combo, z, f, h }; a chain without one has the member alone)
    return e.map((ms) => {
      const o = ms.map((m) => ({ z: m.z, f: m.f, h: m.h, sheet: m.k, member: m.member, src: m.src }));
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
    return ev(`(() => { const p = __cmwLandPick(); if (p && ${k} === 0) window.__lxPick = p; return { still: ${still}, cover: __lx.cover(${JSON.stringify(tag)}), pick: !!p, scale: __cmwLandScale(), ticks: __cmwLandTicks() }; })()`);
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
  // a layer's match with the enumerator's members is ambiguous when more than one member fits its z and height: the check fails rather than pick one
  const ambiguous = (ls) => ls.filter((l) => l.matches > 1).length;
  const LAYER_PLACES = [[0.3, 0.7], [3, 1], [-3, -2], [-6, 5.6], [2, -4]];   // (each at least 0.5 from every window edge at every glide u: the cut probe, on an edge, has its checks above)
  // the layers at w of the glide at u by the sheets' windows; shifted false: every sheet takes dk = 0's window (a control)
  const windowLayers = (w, u, shifted, withEdge = false) => {
    const sc = 1 - u, beta = 1 / sc, vr = 1 + sc * (w[0] - sc), vi = sc * w[1], arg = Math.atan2(vi, vr);
    let n = 0, edge = false;
    for (let dk = -SHEET_W; dk <= SHEET_W; dk++) {
      const d = shifted ? dk : 0, lo = Math.PI - 2 * Math.PI + 2 * Math.PI * d, hi = Math.PI + 2 * Math.PI * d;
      let has = false;
      for (let m = -M_MAX; m <= M_MAX; m++) { const im = beta * (arg + 2 * Math.PI * m); if (im > lo && im <= hi) has = true; if (Math.abs(im - lo) < EDGE_MARGIN || Math.abs(im - hi) < EDGE_MARGIN) edge = true; }
      if (has) n++;
    }
    return withEdge ? { n, edge } : n;
  };
  ok('the window count is one layer near the next plane at the probe places', LAYER_PLACES.every((w) => windowLayers(w, 0.998, true) === 1), null);
  ok('the window count holds fewer than every sheet at the middle (the alternating layers)', LAYER_PLACES.some((w) => windowLayers(w, 0.5, true) < 2 * SHEET_W + 1), null);
  ok('the window count fails a draw of every sheet at every place (control)', LAYER_PLACES.some((w) => windowLayers(w, 0.998, true) !== 2 * SHEET_W + 1), null);
  ok('the window count fails the same window for every sheet (control)', LAYER_PLACES.some((w) => windowLayers(w, 0.5, false) !== windowLayers(w, 0.5, true)), null);
  ok('the match check counts a layer two members fit', ambiguous([{ matches: 1 }, { matches: 2 }]) === 1, null);
  ok('the match check passes layers one member fits or none does', ambiguous([{ matches: 1 }, { matches: 0 }]) === 0, null);
  const setU = async (x) => { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2); };
  await view(VIEW_W, VIEW_H, false, false);
  // (CMW_ONLY: one case by its tag, so that CI runs the cases of All sheets in parts)
  for (const c of CASES.filter((x) => !process.env.CMW_ONLY || x.tag === process.env.CMW_ONLY)) for (const sheets of MODES) {
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
    for (const u0 of GLIDE_U) {
      const u = u0, first = u0 < GLIDE_MID, lastU = u0 > GLIDE_MID;   // (first: a probe near plane z, lastU: near the next plane)
      const t = `${name}, u=${u}`;
      await setU(u);
      const still = await grab('cur');
      const carry = await ev('(() => { const c = __cmwLandCarry(); return c && { path: c.path || null, u: c.u, holes: c.landHoles }; })()');
      const cov = { still, n: await ev(`__lx.cover('cur')`), d0: (await compare('cur', 'P0')).frac, d1: (await compare('cur', 'P1')).frac };
      r[u] = { carry, cov, p0: p0.cover, p1: p1.cover };
      ok(`${t}: a still, carried frame`, cov.still && !!carry, { carry, still: cov.still });
      // the path
      ok(`${t}: the frame is drawn by the inverse path`, carry && carry.path === 'inverse', carry);
      // the layers of a place beside the branch point's cut hold distinct heights: a continuation anchored across the step's cut
      // repeats another layer's height there; the probe's noRay (no anchor is refused for lying across the cut) brings the repeat back
      if (c.cutProbe && sheets && u === CUT_PROBE_U) {
        const layerGaps = async () => {
          const at = JSON.parse(await ev(`JSON.stringify(__cmwLandFrameVerts([${JSON.stringify(c.cutProbe)}]))`))[0] || [];
          const hs = at.map((l) => l.h).sort((p, q) => p - q);
          return { n: hs.length, gap: hs.length > 1 ? Math.min(...hs.slice(1).map((h, i) => h - hs[i])) : null };
        };
        const g = await layerGaps();
        ok(`${t}: the layers beside the cut hold distinct heights (the closest are ${g.gap} apart; at least ${LAYER_GAP_MIN})`, g.n > 1 && g.gap >= LAYER_GAP_MIN, g);
        ok(`${t}: the branch point has a polar patch in every layer`, carry && carry.holes >= 1, carry);
        await ev(`__svCarryProbe = __svCarryProbeSettings.noRay; 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        const off = await layerGaps();
        await ev('__svCarryProbe = null; 1'); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        ok(`${t}: without the cut test two layers repeat a height (control; the closest are ${off.gap} apart)`, off.gap != null && off.gap < LAYER_GAP_MIN, off);
      }
      // the layers of a place are the log's sheets that hold a member there: sheet dk is z^s on its branch k + dk, s = 1 - u, whose
      // members at w are exp(beta (Log v + 2 pi i m)), v = 1 + s (w - s), beta = 1 / s, one for each m whose turn lies in the sheet's
      // window of 2 pi shifted by 2 pi dk; the windows tile the plane near the next plane (one layer at a place) and half-cover it at the middle
      if (c.cutProbe && sheets) {
        const at = JSON.parse(await ev(`JSON.stringify(__cmwLandFrameVerts(${JSON.stringify(LAYER_PLACES)}))`));
        LAYER_PLACES.forEach((w, i) => {
          const v = (at[i] && at[i][0] && at[i][0].w) || w;   // (the place the frame draws a probe at is its nearest grid vertex)
          const n = new Set((at[i] || []).map((l) => l.h.toFixed(2))).size, want = windowLayers(v, u, true, true);
          ok(`${t}: the place (${w}) is clear of every sheet's window edge`, !want.edge, want);
          ok(`${t}: the layers at (${w}) are the sheets whose window holds a member (${n} layers; ${want.n} by the windows)`, n === want.n, { n, want });
        });
      }
      // the image at the ends
      if (first && u <= END_U) ok(`${t}: plane z's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d0 <= SAME_FRAC, cov);
      if (lastU && u >= 1 - END_U) ok(`${t}: the next plane's parked frame (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, cov.d1 <= SAME_FRAC, cov);
      // the layers run past the block (a pole's tower) and are cut at its top and bottom exactly as the parked sheets are: without that cut, or with
      // the crossing taken linearly where the parked clip's is in 1 / h, the next plane's frame is not matched (controls)
      if (c.clipControls && sheets && lastU && u === CLIP_CONTROL_U) {
        for (const [probe, what] of [['clipOff', 'without the block clip'], ['clipLinear', 'with linear crossings only']]) {
          await ev(`__svCarryProbe = __svCarryProbeSettings.${probe}; 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          await grab('cc');
          const dc = (await compare('cc', 'P1')).frac;
          await ev('__svCarryProbe = null; 1'); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          ok(`${t}: ${what} the next plane's parked frame is not matched (control; ${dc} of pixels over ${DIFF_TOL})`, dc > SAME_FRAC, { dc });
        }
      }
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
        // (the parked plane is the reference at the end probes only, as above)
        if (u <= END_U || u >= 1 - END_U) ok(`${t}: ${first ? "plane z's" : "the next plane's"} parked frame in the Top view (at most ${SAME_FRAC * 100} % of pixels over ${DIFF_TOL})`, stillT && dT <= SAME_FRAC, r[u].top);
      }
      // the surface pixels at the ends
      if (first || lastU) {
        const base = first ? p0.cover : p1.cover;
        ok(`${t}: at least the parked plane's surface pixels less ${COVER_TOL * 100} %`, cov.n >= (1 - COVER_TOL) * base, { n: cov.n, base });
      }
      // the cut's seam: the longest run of connected pixels (8-neighbours) more than DIFF_TOL from the next plane's parked frame
      if (u === 1 - END_U && c.seam && sheets) {
        const longest = async (a, b, dark) => ev(`(() => {
          const A = window.__heldPx.${a}, B = window.__heldPx.${b}, W = document.getElementById('canvasL').width, n = A.length / 4, on = new Uint8Array(n);
          const L = (X, i) => ${LUMA[0]} * X[i] + ${LUMA[1]} * X[i + 1] + ${LUMA[2]} * X[i + 2];
          for (let q = 0; q < n; q++) {
            const i = 4 * q;
            on[q] = (${!!dark} ? L(B, i) - L(A, i) : Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]))) > ${DIFF_TOL} ? 1 : 0;
          }
          let best = 0; const st = [];
          for (let q0 = 0; q0 < n; q0++) {
            if (on[q0] !== 1) continue;
            let len = 0; st.push(q0); on[q0] = 2;
            while (st.length) {
              const q = st.pop(); len++; const x = q % W;
              for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx, r = q + dy * W + dx;
                if (xx >= 0 && xx < W && r >= 0 && r < n && on[r] === 1) { on[r] = 2; st.push(r); }
              }
            }
            if (len > best) best = len;
          }
          return best;
        })()`);
        const run = await longest('cur', 'P1'), ctl = await longest('P0', 'P1');
        ok(`${t}: no seam along the cut: the longest run of pixels over ${DIFF_TOL} from the next plane's parked frame is ${run} (at most ${SEAM_RUN})`, run <= SEAM_RUN, { run });
        ok(`${t}: the seam measure sees a different frame (control; plane z's parked frame against the next plane's: a run of ${ctl})`, ctl > SEAM_RUN, { ctl });
        // the frame's own seam: the cut ray (Re w < 0, Im w = 0) projected through the frame's own camera at each layer's height; a
        // sample is dark where its pixel is darker than the frame's own pixels SEAM_SIDE_PX to both sides of the curve by more than
        // SEAM_DARK_TOL. A broken seam is a scatter of such samples (no long run), so they are counted
        const ownSeam = (tag) => ev(`(() => {
          const L = window.__cmwLandRelief && window.__cmwLandRelief.land, A = window.__heldPx.${tag};
          if (!L || !A) return null;
          const b = L.box, cv = document.getElementById('canvasL'), W = cv.width, H = cv.height, dpr = W / cv.getBoundingClientRect().width, NS = W;
          const pts = []; for (let i = 0; i < NS; i++) pts.push([b.x0 + (i + 0.5) / NS * Math.min(-b.x0, b.x1 - b.x0), 0]);
          const g = __cmwLandFrameVerts(pts); if (!g) return null;
          const endX = ${SEAM_END_PX} * (b.x1 - b.x0) / W;
          const luma = (x, y) => { const i = 4 * (Math.round(y) * W + Math.round(x)); return ${LUMA[0]} * A[i] + ${LUMA[1]} * A[i + 1] + ${LUMA[2]} * A[i + 2]; };
          const inside = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
          const dx = (pts[1][0] - pts[0][0]) / 2;
          let dark = 0, nl = 0;
          for (let i = 0; i < NS; i++) {
            for (const l of g[i] || []) {
              if (!l || !(l.h === l.h) || !l.w || Math.abs(l.w[0]) < endX) continue;
              const q = __cmwLandProject(l.w[0], l.w[1], l.h), qa = __cmwLandProject(l.w[0] - dx, l.w[1], l.h), qb = __cmwLandProject(l.w[0] + dx, l.w[1], l.h);
              if (!q || !qa || !qb) continue;
              const x = q[0] * dpr, y = q[1] * dpr, tx = (qb[0] - qa[0]) * dpr, ty = (qb[1] - qa[1]) * dpr, tn = Math.hypot(tx, ty);
              if (!(tn > 0)) continue;
              const nx = -ty / tn * ${SEAM_SIDE_PX}, ny = tx / tn * ${SEAM_SIDE_PX};
              if (!inside(x, y) || !inside(x + nx, y + ny) || !inside(x - nx, y - ny)) continue;
              nl++;
              const c = luma(x, y);
              if (c < luma(x + nx, y + ny) - ${SEAM_DARK_TOL} && c < luma(x - nx, y - ny) - ${SEAM_DARK_TOL}) dark++;
            }
          }
          return { dark, samples: nl };
        })()`);
        for (const su of SEAM_AT) {
          if (su !== u) { await setU(su); await grab('sm'); }
          const os = await ownSeam(su === u ? 'cur' : 'sm');
          ok(`${name}, u=${su}: the cut's seam is no darker than the frame's own pixels beside it: ${os && os.dark} of ${os && os.samples} samples (at most ${SEAM_DARK_MAX})`, !!os && os.samples > SEAM_MIN_SAMPLES && os.dark <= SEAM_DARK_MAX, { os });
        }
        // the parked plane 1's pixels along the same curve (control: the camera and the scale at SEAM_AT's last u are plane 1's to a hundredth of
        // a pixel, and parked's cut ink is as pale as its banks, so the measure does not flag it)
        const pk = await ownSeam('P1');
        ok(`${name}: the parked plane 1's cut is no darker than its own pixels beside it (control): ${pk && pk.dark} of ${pk && pk.samples} samples (at most ${SEAM_DARK_MAX})`, !!pk && pk.samples > SEAM_MIN_SAMPLES && pk.dark <= SEAM_DARK_MAX, { pk });
        await setU(u);
        // the darker-than-parked run, nearer to plane 1: parked draws no dark line along the cut
        const darkCtl = await longest('P0', 'P1', true);
        ok(`${t}: the darker-than-parked measure sees a different frame (control; plane z's parked frame against the next plane's: a run of ${darkCtl})`, darkCtl > SEAM_RUN, { darkCtl });
        for (const su of SEAM_U) {
          await setU(su); await grab('sm');
          const dr = await longest('sm', 'P1', true);
          ok(`${name}, u=${su}: no seam darker than the next plane's parked frame along the cut: the longest run is ${dr} (at most ${SEAM_RUN})`, dr <= SEAM_RUN, { dr });
        }
        await setU(u);
      }
      // the height ruler's labels: at every u each label sits at the frame's OWN height of its value; at the ends the same labels as the parked
      // plane's, each within TICK_PX of its screen y (rasterization only; the end frames' real scale gap is not absorbed: it is checked by the own height)
      {
        const relErr = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);
        const ownTicks = async () => {
          const marks = await ev('__cmwLandTickMarks()');
          const own = JSON.parse(await ev(`JSON.stringify(__cmwLandTickMarks().map((m) => __cmwLandHeightOf(m.v)))`));
          const nz = marks.map((m, i) => i).filter((i) => own[i]);   // (a label at height 0 has no scale)
          return { marks, own, nz, bad: nz.filter((i) => !(relErr(marks[i].hz, own[i]) <= TICK_H_TOL)) };
        };
        const o = await ownTicks();
        ok(`${t}: the height ruler's ${o.marks.length} labels sit at the frame's own height of their value`, o.marks.length > 0 && !o.bad.length, o);
        if (lastU && u === 1 - END_U) {
          await ev(`__svCarryProbe = { rulerScale: ${1 + TICK_SCALE_ERR} }; 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          const e = await ownTicks();
          await ev('__svCarryProbe = null; 1'); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          ok(`${t}: a ${TICK_SCALE_ERR} scale error in the labels' heights fails the own-height check (control; ${e.bad.length} of ${e.nz.length} labels off)`, e.nz.length > 0 && e.bad.length === e.nz.length, e);
        }
      }
      if (first || lastU) {
        const ref = (first ? p0 : p1).ticks, got = await ev('__cmwLandTicks()');
        ok(`${t}: the height ruler's tick labels are the parked plane's (${got && got.length} against ${ref && ref.length}; each within ${TICK_PX} px)`,
          !!got && !!ref && got.length === ref.length && ref.every((y, i) => Math.abs(y - got[i]) <= TICK_PX), { got, ref });
      }
      // the scale and the block's boost the frame is fitted with are the parked plane's at the ends, and not at the middle
      {
        const sc = await ev('__cmwLandScale()'), ref = first ? p0.scale : p1.scale;
        const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);
        if (u === END_U || u === 1 - END_U) {
          ok(`${t}: the frame's scale and boost are the parked plane's (mu ${sc && sc.mu} against ${ref && ref.mu}, boost ${sc && sc.boost} against ${ref && ref.boost}; within ${SCALE_TOL})`,
            !!sc && !!ref && rel(sc.mu, ref.mu) <= SCALE_TOL && rel(sc.boost, ref.boost) <= SCALE_TOL, { sc, ref });
        } else if (u === GLIDE_MID && sc && ref) {
          ok(`${t}: the middle frame's scale is not the parked plane's (control; mu ${sc.mu} against ${ref.mu})`, rel(sc.mu, ref.mu) > SCALE_TOL, { sc, ref });
        }
      }
      // the height function moves continuously from plane z's to the next plane's: the layers' heights at a place change by at most
      // CONT_LIPSCHITZ block heights per unit u; a height function that switches at the middle jumps (control)
      if (sheets && c.cutProbe && u === 1 - END_U) {
        const H = (await ev('__cmwLandScale()')).lscale || 1;
        const layerH = async (x) => { await setU(x); return JSON.parse(await ev(`JSON.stringify(__cmwLandFrameVerts(${JSON.stringify(LAYER_PLACES)}))`)).map((a) => (a || []).map((l) => l.h)); };
        const jump = async (x) => {
          const a = await layerH(x - CONT_STEP / 2), b = await layerH(x + CONT_STEP / 2);
          const ds = [];
          a.forEach((la, i) => la.forEach((h) => { const d = Math.min(...(b[i] || [Infinity]).map((g) => Math.abs(g - h))); if (Number.isFinite(d)) ds.push(d); }));
          ds.sort((p, q) => p - q);
          return ds.length ? ds[ds.length >> 1] / CONT_STEP / H : 0;   // (the median layer: a window edge moves a few layers to others, which is not the height function's jump)
        };
        const worst = {};
        for (const x of CONT_AT) worst[x] = await jump(x);
        ok(`${t}: the layers' heights change at most ${CONT_LIPSCHITZ} block heights per unit u at ${CONT_AT.join(', ')} (${JSON.stringify(worst)})`, CONT_AT.every((x) => worst[x] <= CONT_LIPSCHITZ), worst);
        await ev(`__svCarryProbe = __svCarryProbeSettings.mixSwitch; 1`); await settled({ max: LOAD_MAX_MS });
        const sw = await jump(GLIDE_MID);
        await ev('__svCarryProbe = null; 1'); await settled({ max: LOAD_MAX_MS });
        ok(`${t}: a height function that switches at the middle jumps at it (control; ${sw} block heights per unit u)`, sw > CONT_LIPSCHITZ, { sw });
        await setU(u);
        // the weight frozen at plane z's height leaves the next plane's frame unmatched (control)
        await ev(`__svCarryProbe = __svCarryProbeSettings.mixBeta0; 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        await grab('b0');
        const d1b = (await compare('b0', 'P1')).frac;
        await ev('__svCarryProbe = null; 1'); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        ok(`${t}: the weight frozen at plane z's height fails the next plane's parked frame (control; ${d1b} of pixels over ${DIFF_TOL})`, d1b > SAME_FRAC, { d1b });
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
      ok(`${t}: the CPU reference (window.__cmwLandEnum) is readable: the frame is drawn by the inverse path`, Array.isArray(ref), null);
      ok(`${t}: the frame's draw data is readable (window.__cmwLandFrameVerts)`, Array.isArray(got) && Array.isArray(cgot), null);
      if (!Array.isArray(ref) || !Array.isArray(got) || !Array.isArray(cgot)) continue;
      const refN = ref.filter((x) => x.length).length;
      r[u] = Object.assign(r[u], { refPlaces: refN });
      ok(`${t}: the CPU reference finds preimages at a probe place (${refN} of ${pts.length})`, refN > 0, { refN });
      {
        const ms = [];
        ref.forEach((l, i) => l.forEach((m) => { if (m.z && ms.length < HOM_MAX) ms.push({ z: m.z, w: vpts[i] }); }));
        await ev(`window.__lxHomTol = ${HOM_TOL}; 1`);
        const mr = await ev(`__lxHomMiss(${JSON.stringify(ms)}, 0)`), mv = await ev(`__lxHomMiss(${JSON.stringify(ms)}, ${HOM_SHIFT})`), miss = mr.worst, moved = mv.worst;
        ok(`${t}: every enumerated member (${ms.length}) maps to its place under the frame's homotopy (window.__cmwLandHom) within ${HOM_TOL}`, ms.length > 0 && miss <= HOM_TOL, { miss, nBad: mr.nBad, n: ms.length, sample: mr.sample });
        ok(`${t}: the control: the places moved by ${HOM_SHIFT} are not matched by the homotopy (miss ${moved})`, moved > HOM_TOL, { moved });
        // the plan read by the candidate generator corrupted (the output of its last op moved, on every sheet): its candidates are preimages under
        // the shortened plan, not under the scene, so the scene must refuse them: candidates are rejected, the members that are left are fewer than
        // the winding counts, and the case fails. A reference that took its homotopy from the plan would answer the corrupted plan consistently
        const idxW = []; ref.forEach((l, i) => { if (l.length) idxW.push(i); });
        const pickWind = idxW.filter((_, j) => j % Math.max(1, Math.ceil(idxW.length / WIND_PLACES)) === 0).slice(0, WIND_PLACES);
        if (c.corruptPlan) {
          const applied = await ev(`__cmwLandCorruptPlan('shiftOut')`);
          ok(`${t}: the control's corrupted plan applies`, applied === true, { applied });
          if (applied === true) {
            try {
              const bad = await ev(`__lxEnum(${JSON.stringify(vpts)}, ${sheets})`), rejected = await ev('window.__cmwLandRejected');
              const have = bad.reduce((n, l) => n + l.length, 0), want = ref.reduce((n, l) => n + l.length, 0);
              let notOk = 0, nW = 0;
              for (const i of pickWind) { const wr = await ev(`__cmwLandWind(${JSON.stringify(vpts[i])}, {})`); for (const r of wr || []) { nW++; if (!r.ok) notOk++; } }
              ok(`${t}: the control: a corrupted plan's candidates are rejected by the scene (${rejected} rejected; ${have} members left of ${want})`, rejected > 0 && have < want, { rejected, have, want });
              ok(`${t}: the control: with a corrupted plan the completeness count fails (${notOk} of ${nW} counts)`, notOk > 0, { notOk, nW });
            } finally { await ev(`__cmwLandCorruptPlan('restore')`); }
          }
        }
        // the completeness count: for probe places with members, the winding of the homotopy around each sheet's region (plus the plan's poles) equals the
        // members found there on every sheet; controls: a member removed, the poles omitted, a place on a cut lip, a step floor that cannot resolve a place near the boundary
        {
          const pick = pickWind;
          let nBadW = 0, nChecked = 0; const badW = [];
          for (const i of pick) {
            const wr = await ev(`__cmwLandWind(${JSON.stringify(vpts[i])}, {})`);
            for (const r of wr || []) { nChecked++; if (!r.ok) { nBadW++; if (badW.length < 4) badW.push(Object.assign({ place: vpts[i] }, r)); } }
          }
          ok(`${t}: the completeness count: the winding of the scene's homotopy plus the poles equals the certified members, over the leaves of the box at ${pick.length} places (${nChecked} counts)`, nChecked > 0 && nBadW === 0, { nBadW, nChecked, badW });
          if (pick.length) {
            const i0 = pick[0];
            // (the scene's plane record: the box of the plane the carry is built on, read from the steps view's own view of it, is the box the parked frame draws)
            const pl = await ev(`(() => { const p = __cmwLandPlane(), b = __cmwLandCarry(true); return { p, b }; })()`);
            ok(`${t}: the scene's plane box equals the box the frame draws`, !!pl && !!pl.p && !!pl.b && ['x0', 'x1', 'y0', 'y1'].every((k, i) => Math.abs(pl.p.box[i] - pl.b[k]) <= PLANE_BOX_TOL * (1 + Math.abs(pl.b[k]))), { pl });
            const drop = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { dropOne: true })`);
            ok(`${t}: the control: one member removed breaks the count`, !!drop && drop.some((r) => !r.ok), { drop });
            const lipR = await ev(`__cmwLandWind(null, { onContour: true })`);
            // (a place whose value is on a leaf's contour has a winding that is undefined: the count must say so, never give a count)
            ok(`${t}: the control: a place on a leaf contour is not counted`, !!lipR && lipR.every((r) => r.status === 'onContour'), { lipR });
            const near = await ev(`__cmwLandWind(null, { nearContour: true })`);
            ok(`${t}: the control: a place near the boundary with an unreachable step floor is unresolved, not counted`, !!near && near.some((r) => r.status === 'unresolved' || r.status === 'onContour'), { near });
            if (c.logControl) {
              const lw = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`), r0 = lw && lw[0];
              // (the box holds the branch point 0: the leaf it is in is reported at every u; near the log itself G is huge there and the shrinking rim's values do not converge, so the count must say branchLog or kindDisagree, never ok)
              ok(`${t}: the control: the branch leaf at 0 is reported (${r0 ? r0.branchLeaves : '?'} leaves, status ${r0 ? r0.status : '?'})`, !!r0 && r0.branchLeaves > 0 && (u < 1 - 2 * END_U || r0.status === 'branchLog' || r0.status === 'kindDisagree'), { lw });
            }
            if (c.surfaces) {
              // (the surfaces that are distinct functions: a repeated sheet is counted once, and no distinct one is dropped)
              const sf = await ev(`__cmwLandSurfaces()`);
              ok(`${t}: the distinct surfaces are ${c.surfaces} of ${sf ? sf.K : '?'}`, !!sf && sf.distinct === c.surfaces, { sf });
              // (the box holds the branch point: the leaf is reported; the leaves the continuity alone would have closed are counted beside it)
              const sn = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`), bl = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noInputs: true })`);
              ok(`${t}: the branch leaf is reported (${sn && sn[0] ? sn[0].branchLeaves : '?'} leaves; ${bl && bl[0] ? bl[0].branchLeaves : '?'} by the continuity alone)`, !!sn && !!sn[0] && sn[0].branchLeaves > 0, { sn, bl });
            }
            if (c.logControl) {
              // (the surfaces counted as digits: where the log path repeats a sheet, the count reads two for one member)
              if (u === GLIDE_MID) {
                const dd = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noDedupe: true })`);
                ok(`${t}: the control: coincident surfaces counted each break the count at u = ${GLIDE_MID}`, !!dd && dd.some((q) => !q.ok), { dd });
              }
            }
            if (c.logControl) {
              // (a leaf that holds the branch point 0 is closed by the continuity of the surfaces alone when the cut's jump there is small: the
              // leaves cut without the winding of the step's input count it closed, so no branch leaf is reported, while the scene reports it)
              const seen = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`), blind = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noInputs: true })`);
              const nSeen = seen && seen[0] ? seen[0].branchLeaves : -1, nBlind = blind && blind[0] ? blind[0].branchLeaves : -1;
              // (past the glide's middle the log path's cut jump is large and the surfaces' continuity sees the branch point too: the control is for the small jumps)
              if (u <= GLIDE_MID) ok(`${t}: the control: the branch leaf is found by the winding of the step's input, and a count that does not use it misses it (${nSeen} leaves, ${nBlind} without)`, nSeen > 0 && nBlind === 0, { seen, blind });
            }
            if (c.cutControl) {
              // (the part of H_u inside the circle |z| = 1 and the part outside are different formulas: a count that takes the circle's radius moved by CUT_DELTA
              // counts the wrong region for each, and must differ from the certified members at some place)
              const base = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`), nCut = base && base[0] ? base[0].cutLeaves : 0;
              if (u === GLIDE_MID) ok(`${t}: the circle's cut is walked as two parts at u = ${u} (${nCut} leaves cross it)`, nCut > 0, { base });
              if (nCut > 0 && u === GLIDE_MID) {
                let nBadC = 0;
                for (const i of pick) { const wr = await ev(`__cmwLandWind(${JSON.stringify(vpts[i])}, { cutDelta: ${CUT_DELTA} })`); if (wr && wr.some((r) => !r.ok)) nBadC++; }
                ok(`${t}: the control: at u = ${GLIDE_MID}, where the formulas inside and outside differ, the cut circle's radius moved by ${CUT_DELTA} breaks the count (${nBadC} of ${pick.length} places)`, nBadC > 0, { nBadC });
              }
            }
            const nop = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noPoles: true })`), withP = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`);
            const poleCase = !!withP && withP.some((r) => r.P > 0);
            if (poleCase) ok(`${t}: the control: the poles omitted break the count`, !!nop && nop.some((r) => !r.ok), { nop });
          }
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
    // the distance to rest falls as u goes to 0 (and as it goes to 1, for the next plane): per end, d(k) for k in REST_STEPS from the plane
    const restOk = (d) => d[0] <= SAME_FRAC && d.every((x, i) => i === 0 || x >= d[i - 1] - MONO_SLACK);
    for (const [end, ref] of [['plane z', 'P0'], ['the next plane', 'P1']]) {
      const d = [];
      for (const k of REST_STEPS) {
        await setU(ref === 'P0' ? k * END_U : 1 - k * END_U); await grab('rs');
        d.push((await compare('rs', ref)).frac);
      }
      const rise = d[d.length - 1] - d[0], rev = d.slice().reverse();
      ok(`${name}: the distance to ${end}'s parked frame falls as u goes to it: ${d.map((x) => x.toFixed(4)).join(', ')} at ${REST_STEPS.join(', ')} x ${END_U} (within ${SAME_FRAC} at the first, no rise past ${MONO_SLACK})`, restOk(d), { d });
      // (control: the same distances in the reverse order of u fail it, where they rise by more than REST_RISE_MIN: the cases that stay at the render's floor have no order to reverse)
      ok(`${name}: the distances to ${end}'s parked frame in the reverse order of u fail the check (control; rise ${rise.toFixed(4)})`, rise <= REST_RISE_MIN || !restOk(rev), { d });
    }
    // the glide's sheet pass (the image test that gives each vertex its step sheet's height) is what keeps the frame near the next plane's
    // parked one at the far end: with it off (the page's carry probe noFix) the same frame differs from the parked plane by more than the tolerance
    if (c.fixControl && !sheets) {
      await setU(1 - END_U);
      const on = await grab('fixon'), dOn = (await compare('fixon', 'P1')).frac;
      await ev(`__svCarryProbe = __svCarryProbeSettings.noFix; 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
      const off = await grab('fixoff'), dOff = (await compare('fixoff', 'P1')).frac;
      await ev('__svCarryProbe = null; 1'); await settled({ max: LOAD_MAX_MS });
      r.fixControl = { dOn, dOff };
      ok(`${name}: u=${1 - END_U}: with the sheet pass the frame is the next plane's parked frame (at most ${SAME_FRAC * 100} %)`, on && dOn <= SAME_FRAC, r.fixControl);
      ok(`${name}: u=${1 - END_U}: with the sheet pass off the frame is not (over ${SAME_FRAC * 100} %): the case tells the two apart`, off && dOff > SAME_FRAC, r.fixControl);
    }
  }
  return { pass: !fails.length, fails, info };
})

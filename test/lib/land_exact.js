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
  // The labels are screen heights, so they follow the camera. park() fits the camera to its plane: with All sheets the two end planes of the log cases
  // are parked with cameras about 0.4 apart in distance (11.9 and 7.16), with sheets off and in the other cases with the same one. The control that
  // pins the other plane's camera therefore needs a gap of at least CAM_GAP_MIN, and CAM_GAP_CASES with All sheets must have it.
  const CAM_GAP_MIN = 0.1, CAM_GAP_CASES = ['log of an annulus', 'log, box centred at 1.5 + 0.5i'];
  // (the cases whose two end planes are parked with one camera distance, within CAM_SAME_TOL: the labels agree under either camera; and the distance a
  // plane's Top-view reference is parked at is that plane's own, within CAM_DIST_TOL: no distance is carried over from the other plane)
  const CAM_SAME_CASES = ['Möbius, √'], CAM_SAME_TOL = 1e-3, CAM_DIST_TOL = 1e-3;
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
  const REL_FLOOR = 1e-9;   // (a relative difference is against at least this: a reference of 0 has no scale)
  const relDiff = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), REL_FLOOR);
  const TICK_H_TOL = 1e-9;   // (a label's world height against the frame's own height function of its value: the same float computation)
  const TICK_SCALE_ERR = 1.6e-3;   // (the scale error the own-scale check must see: the gap the near ends have against the parked plane at .998)
  const SCALE_TOL = 1e-3;   // (the relative difference under which two scales are one: they are the same computation at the same map and box)
  const CUT_PROBE_U = 0.002, LAYER_GAP_MIN = 0.5;   // (the glide's u of the cut probe; the layers' heights are about 0.9 apart at the fitted scale)
  const PLANE_BOX_TOL = 1e-9;   // (the scene's plane box and the drawn box are the same numbers read twice)
  const POLE_SHIFT = 3;   // (the pole control: far enough along the imaginary axis to leave the leaf that holds the dipole)
  // the controls that cannot bite on a row, with the reason, by 'case|control' or 'case|control|u' (a control that cannot run fails unless its row is listed here, and a
  // listed row fails if the control runs and bites)
  const CTL_NA = {
    "Möbius, √|sheets": "the glide has one surface there",
    "Roots as preimages|sheets": "the glide has one surface there",
    "Joukowski airfoil|sheets": "the glide has one surface there",
    "Möbius dipole, √|sheets": "the glide has one surface there",
    "Möbius with a pole in the box|sheets": "the glide has one surface there",
    "Möbius, √|digits": "the glide has one surface there: no digit of the scene's surface table can move",
    "Roots as preimages|digits": "the glide has one surface there: no digit of the scene's surface table can move",
    "Joukowski airfoil|digits": "the glide has one surface there: no digit of the scene's surface table can move",
    "Möbius dipole, √|digits": "the glide has one surface there: no digit of the scene's surface table can move",
    "Möbius with a pole in the box|digits": "the glide has one surface there: no digit of the scene's surface table can move",
    "Möbius, √|stripRead": "the scene's chain lists no branch step input at this u",
    "Joukowski airfoil|stripRead": "the scene's chain lists no branch step input at this u",
    "Möbius dipole, √|stripRead": "the scene's chain lists no branch step input at this u",
    "Möbius with a pole in the box|stripRead": "the scene's chain lists no branch step input at this u",
    "Roots as preimages|stripRead|0.5": "the scene's chain lists no branch step input at this u",
    "Roots as preimages|stripRead|0.75": "the scene's chain lists no branch step input at this u",
    "Roots as preimages|stripRead|0.998": "the scene's chain lists no branch step input at this u",
    "Roots as preimages|stripRead|0.9999": "the scene's chain lists no branch step input at this u",
    "cube root|strip|0.25": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "cube root|strip|0.5": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "cube root|strip|0.998": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "cube root|strip|0.9999": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "Roots as preimages|strip|0.25": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "log of an annulus|strip|0.25": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "log of an annulus|strip|0.5": "every member's cell is its own point (an open leaf): its continued argument is the principal one",
    "Möbius, √|farFront": "one preimage at each probe place: the farthest member is the nearest",
    "Möbius dipole, √|farFront": "one preimage at each probe place: the farthest member is the nearest",
    "Möbius with a pole in the box|farFront": "one preimage at each probe place: the farthest member is the nearest",
  };
  const ctlNA = (c, ctl, u) => CTL_NA[`${c.tag}|${ctl}|${u}`] || CTL_NA[`${c.tag}|${ctl}`] || null;
  const STRIP_TOL = 1e-6;   // (radians: a member's continued argument is this close to its window's end or nearer when it is a lip member, float noise and never a strip)
  const ZERO_MOVE_MIN = 0.0025;   // (the branch point's drawn place moves with u by at least this: its two u's are far apart against the float noise of one place)
  const ZERO_TOL = 1e-12, ZERO_SHIFT = 0.25, ZERO_BOX = 1e-3;   // (an exact zero: its distance from the matrix's value; the shift of a control's zero; the half-width of the box round it)
  const HOM_EQ_PAIRS = 200, HOM_PLACE = '0.3, 0.2';   // (members the homotopy hook's cheap paths are compared on; the fixed place its scene's u-dependence is read at)
  const RAMP_CTL_STEP = 1;   // (the ramp control moves one member this many levels past the ramp: any whole level is outside it)
  const SHEET_MARGIN = 4;   // (a member's certified surface is unique when the next surface's miss exceeds this many times its own)
  const END_U = 1e-4;   // (a polynomial's step runs its path several times as fast as the glide's u: its ends are this far from the planes)
  const TOP_CAM = { yaw: -Math.PI / 2, pitch: 88 * Math.PI / 180 };   // the Top view: the camera the end frames are also compared in, where a missing piece of the surface shows against the pale floor
  const GLIDE_MID = 0.5;   // (the glide's middle: probes before it are near plane z, after it near the next plane)
  const CONT_STEP = 0.02;   // (the continuity probe's two frames: u - CONT_STEP / 2 and u + CONT_STEP / 2)
  const MID_U = [0.25, 0.75];   // (probes inside the glide: no parked plane to compare with, so the exact map alone judges them)
  const CONT_AT = [0.25, GLIDE_MID, 0.75];
  const CONT_LIPSCHITZ = 1;   // (the largest change of a layer's height at a place, in block heights, per unit of u)
  const CLIP_CONTROL_U = 0.998;   // (the glide's u of the block clip's controls: the tower's cut shows in the image at once)
  const GLIDE_U = [END_U, 0.002, MID_U[0], GLIDE_MID, MID_U[1], 0.998, 1 - END_U];
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
  const COMBO_PLACE = [0.3, 0.2];   // (a place of the box: the colour map's sheet combos are the map's, not the place's)
  const COMBO_CONTROL = ['Möbius, √', 'Möbius dipole, √', 'Möbius with a pole in the box', 'log of an annulus', 'log, box centred at 1.5 + 0.5i', 'cube root', 'Joukowski airfoil', 'Roots as preimages', 'Partial sums of the exponential (Newton)'];   // every case: a sheet combo one off must turn the Top view's hue over HUE_OFF_MAX, where the colour map has two or more sheet combos
  // the coverage at every u, against the CPU reference: COVER_NX x COVER_NY places over the box, each drawn (the frame has a layer at
  // its grid vertex) or covered (the reference has a preimage there); the places that differ either way are at most CELL_TOL of them
  // (two places of the grid: a vertex beside a cut falls on either side of it); the controls' hole is 8 places and the wall fills one column
  // a member is a preimage of its place when the frame's homotopy maps it within HOM_TOL (relative) of the place; the control moves every place
  // by HOM_SHIFT, which must exceed it
  const HOM_TOL = 1e-5, HOM_SHIFT = 1e-3;
  const WIND_PLACES = 12, CUT_DELTA = 0.5;   // (places counted per frame; the control's shift of the cut circle's radius)
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
  // (Ruling C) where the glide is next to a plane (u = END_U, 0.002, 0.998, 1 - END_U) the frame is judged against the exact reference at its own u,
  // far tighter than the 0.02 and 2 degrees of the rest: NEAR_TOL is the largest difference of a drawn height (world units) and of a colour's
  // argument (radians) from the reference's; a frame drawn at the wrong u (reversed, frozen) is told apart by it
  const NEAR_U = [END_U, 0.002, 0.998, 1 - END_U], NEAR_TOL = 0.005, REVERSED_FROM = 0.002;
  const PHASE_TOL = 2 * Math.PI / 180, F_ABS_MIN = 1e-3;   // the member's colour (arg F): at most 2 degrees apart where |F| is not near 0
  const CUT_X = [0.1, 0.3], CUT_OFF = 0.01;                 // probes either side of the real axis: at these shares of the box's width, this share of its height off the axis
  const HEIGHT_TOL = 0.02;                      // the drawn height, world units (a box is about 2 wide)
  const PROBES = 5, SAT_MIN = 30;
  const COMBO_NA_PLACES = 20, COMBO_NA_TOL = 1e-9;   // (a map with one surface: its values under two combos are compared at this many places of the box, to this tolerance relative to 1 + |w|)
  const CONT_CODE_MIN = 10.15, RING_Z_TOL = 1e-4;   // (a drawn texel with a code from here up is a continued one (the product's CARRY_CONT_CODE less 0.1); a cross-layer texel's preimage is its owner's to this relative distance)
  const SURF_TOL = 1e-6;   // (a surface read back from its digits agrees with the member's value to this fraction of 1 + |f|)
  const CLAIM_SAMPLE = 8;   // (the layers a failing claim row lists)
  const MONO_CERT = 1e-5, MONO_NEWT_MAX = 12;   // a member of H_u = w: Newton's method on H, its residual within this share of 1 + |w| (H stalls at 5e-10 to 1e-6 on the far sheets and near a branch value: float64 in a large log coordinate; the design allows 1.5e-3), in at most this many steps
  const MONO_DLAM = 1e-3;   // the step of the central difference of H in the log coordinate (H's own evaluation is exact in it)
  const COUNT_R_MIN = 1e-6;   // the scene's count (__cmwLandWind) leaves out the members within this distance of the origin of plane z (its WIND_EPS_R); members that near are tracked but not counted
  const END_Z_TOL = 1e-3;   // an edge end's z is the frame's float32 inverse: a member of the enumerator is at it within this share of 1 + |z|
  const LAMBDA_SAME = 1e-4;   // two certified roots are one member when their log coordinates agree within this share of 1 + |lam| (whatever sheets list them): Newton's certificate is 1e-5 of H, and distinct members of a set are far apart in lam
  const BRANCH_CLEAR = 0.25;   // grid cells: a loop or ring read for the made-up edge keeps every point of its path at least this far from the branch value (a path through it has no member to follow: the residual cannot tell which member a point is); a path closer is a test failure
  const SYN_BASE = 0.3;   // grid cells: the made-up edge's loops are based this far off its end, along one of the four axes, so that the branch value is inside a cell of the loops (clear of every spoke and side by BRANCH_CLEAR) wherever the arm points
  const SYN_ARM = 0.5;   // the made-up edge through a branch value: half its length in grid cells (its direction runs from the branch value toward the centre of the places the frame spans, so both its ends are in them)
  const BRANCH_LAM = 1e6;   // the log coordinate that stands for a branch point: e^-1e6 is 0 to float64, and a logarithm's output there is -1e6, far beyond any place of a frame
  const WIN_TOL = 1e-9;   // radians: a member whose log coordinate's imaginary part is this far outside its sheet's window (lo, hi] of the first op (__cmwLandWin) is a range-ramp member the scene's count (a winding inside the window) leaves out; the enumerator's own level test (lvl >= 0, src/inverse.js) is the same rule
  const CTL_NA_ROWS = { seam: { 'log of an annulus@0.5': 'no seam edge in the row (its one edge is a false cut)', 'log of an annulus@0.75': 'no seam edge in the row (its edges are false cuts or unresolved)' }, ramp: { 'log of an annulus@0.75': 'no place of the lattice holds a range-ramp member inside the box' } };   // the rows (case tag @ u) where a control has nothing to run on, so it is listed and checked: a row off the list that cannot run fails, and so does a row on it that can
  // the rows (case tag @ u) where the made-up edge's controls cannot run, with the trace that explains it: syn, the scene counts no member at the made-up edge's end vertices (asserted from the scene's count); z, the
  // z-chart control's two runs (with and without the separation check) both end in the edge's own track, before any step is judged for separation (asserted from the failure of both runs)
  const CTL_NA_SYN = { syn: { 'log of an annulus@0.75': 'the scene counts no member at the made-up edge\'s end vertices (the branch value -3.75 is outside the places the scene counts members at)' }, z: { 'log of an annulus@0.5': 'both runs end in the edge track (Newton cap, sheet 7)', 'cube root@0.5': 'both runs end in the edge track (separation at t0 = 2e-4, sheet 8)', 'cube root@0.75': 'both runs end in the edge track (Newton cap, sheet 7)' } };
  const RAMP_LATTICE = 40;   // places on a side of the lattice the ramp-member control searches
  const ID_SHARE = 0.1;   // two points are one member when their log coordinates agree within this share of the set's smallest separation (and within LAMBDA_SAME of 1 + |lam|): below 1/2 a point cannot be one member of two, and a set whose members are closer than the absolute tolerance still keeps them apart
  const CONV_FLOOR = 1e-13;   // the smallest correction (share of 1 + |lam|) a tracked member can be asked to converge to: about 500 ulp of lam in float64; a set that needs a finer one is unresolved
  const ID_CTL_SEP = 1e-5;   // the identity control's two members: this far apart in lam, under LAMBDA_SAME
  const NOBJOIN_MIN = 4;   // the edges that fail on a duplicate member (a carried member joining the loop set although a member of the same lam is there): the merge-off control must turn at least these back to unresolved
  const CONV_SHARE = 1e-3;   // a tracked member is converged when the correction Newton still implies is within this share of the smallest separation to another member of its set (and never above LAMBDA_SAME)
  const LOOP_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];   // the directions the displaced control moves its loops: each of the eight neighbours of the vertex
  const CELL_QUANT = 8;   // a branch cell is named by its lower-left corner in eighths of a grid cell
  const ORBIT_REACH_MAX = 40;   // the most roots a + kT on each side of a an orbit is enlarged by (each is a Newton solve and a tracked member in every loop, about 1 ms of page time apiece on llvmpipe): a row whose members span more is unresolved and fails
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
    { tag: 'Möbius, √', seam: true, steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }], shapes: [], clipControls: true, corruptPlan: true, polePair: { x: [-0.5, 0.5], y: [-1.5, 1.5], map: { mode: 1, base: 0, hi: 2, t: 1 } } },
    // the pole of the step (z = -1) is inside the box: the frame covers the block about it, the cover steps_land_poles holds for the mesh path
    { tag: 'Möbius dipole, √', steps: [{ type: 'mobius', params: { a: '1', b: '-0.1i', c: '1', d: '0.1i' }, on: true }, { type: 'root', params: { n: 2 }, on: true }, { type: 'recip', params: {}, on: true }], shapes: [], dipole: { x: [-1, 1.4], y: [-1, 1.6], map: { mode: 1, base: 0, hi: 2, t: 1 } } },
    { tag: 'Möbius with a pole in the box', steps: [{ type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }], shapes: [] },
    { tag: 'log of an annulus', logControl: true, steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN, cutProbe: [-1, 0.03] },
    // a box centred off the branch point: the depth keys of different sheets differ at first order there (D = log2(1 + |z - centre| / R)), so a front-by-D rule
    // across sheets takes the sheet nearest the centre where the frame's own sheet (plane 0 parked) is the answer
    { tag: 'log, box centred at 1.5 + 0.5i', steps: [{ type: 'log', params: { cut: 180, k: 0 }, on: true }], shapes: ANN, srcView: { cx: 1.5, cy: 0.5, s: 110 }, offCentre: true },
    { tag: 'cube root', steps: [{ type: 'root', params: { n: 3 }, on: true }], shapes: [], fixControl: true, clipControls: true, surfaces: 3, surfacesAt: { 0.75: 2 } },
    { tag: 'Joukowski airfoil', example: 'Joukowski airfoil', cutControl: true },
    { tag: 'Roots as preimages', example: 'Roots as preimages', rayControl: true },
    { tag: 'Partial sums of the exponential (Newton)', example: 'Partial sums of the exponential' },
  ];
  // the page's helpers: the surface pixels of the left pane, and the CPU reference's members at places w: the enumerator's preimages
  // (window.__cmwLandEnum, src/inverse.js's Inverse.enumerate on the plan the frame inverts) without the repeats of one z, each
  // { z, f, h } (null when the frame was not drawn by the inverse path); the front member (sheets off) is the first
  const HELP = `window.__lx = {
    // the surface a continued texel lands on, read from values alone: per item { za, wa, zt, wt } (the anchor's preimage and place, the texel's preimage and place) the scene's surfaces (its own count of them,
    // window.__cmwLandSceneCombos) holding the anchor (ka: those whose value at za is wa), the surfaces holding the texel (ks: value at zt is wt), and where the anchor's surface, continued from the anchor's cell to zt,
    // lands (kl: the surfaces whose own value at zt is that continued value); a surface is held when its value is within ${SURF_TOL} (relative to 1 + |w|). cross: the same with the anchor's z mirrored through the texel's
    contLand: (items) => {
      const K = (__cmwLandSceneCombos() || {}).n || 0, near = (a, b) => !!a && !!b && Math.hypot(a[0] - b[0], a[1] - b[1]) <= ${SURF_TOL} * (1 + Math.hypot(b[0], b[1]));
      const held = (z, w) => { const o = []; for (let k = 0; k < K; k++) if (near(__cmwLandScene(z, k, z), w)) o.push(k); return o; };
      const land = (ka, za, zt) => { if (ka.length !== 1) return []; const v = __cmwLandScene(zt, ka[0], za), o = []; for (let k = 0; k < K; k++) if (near(__cmwLandScene(zt, k, zt), v)) o.push(k); return o; };
      return items.map((it) => {
        const ka = held(it.za, it.wa), ks = held(it.zt, it.wt), zx = [2 * it.zt[0] - it.za[0], 2 * it.zt[1] - it.za[1]];
        return { ka, ks, kl: land(ka, it.za, it.zt), kx: land(ka, zx, it.zt) };
      });
    },
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
      const hb = window.__cmwLandHomSheets([0, 0], [-${BRANCH_LAM}, 0]), wb = hb && hb[0] && hb[0].H;
      const inPlace = !!wb && Number.isFinite(wb[0]) && Number.isFinite(wb[1]) && wb[0] >= x0 && wb[0] <= x1 && wb[1] >= y0 && wb[1] <= y1;
      window.__lxRegion = [x0, x1, y0, y1];
      window.__lxWin = window.__cmwLandWin() || []; window.__lxNoWin = 0; window.__lxNoWinWho = []; window.__lxOrbit = []; window.__lxCnt = { cap: 0, floor: 0, dbl: 0, sepOne: 0, noLam: 0 };
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
      const homAt = (z, lam, sh) => { const q = window.__cmwLandHomSheets(z, lam); const o = q && q[sh]; return o && o.H ? o : null; };
      let nfail = null;   // (why the last Newton solve gave up: the step, the residual or the missing homotopy value)
      const newton = (m, w, inZ, dlTol) => {
        let z = m.z, lam = inZ ? null : m.lam;   // (inZ: the member is continued in z, where steps near a branch value may swap members)
        // (a member asked to converge finer than float64 holds in lam is unresolved, never iterated on)
        if (lam && dlTol !== undefined && dlTol < ${CONV_FLOOR} * (1 + cabs(lam))) { window.__lxCnt.floor++; nfail = { why: 'floor', dlTol, sheet: m.sheet }; return null; }
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
            if (certRes && cabs(dl) <= (dlTol === undefined ? ${LAMBDA_SAME} : dlTol)) return { z, lam, sheet: m.sheet, sheets: m.sheets, lvl: m.lvl };
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
        nfail = Object.assign({ why: 'cap' }, nfail);   // (the iteration cap is hit: no certified member)
        return null;
      };
      // (the glide's sheets an edge's ends hold: sheet i has the code sheetCode + i; an end on no sheet takes the other's)
      const shOf = (c, o) => Math.max(0, Math.round((c > 5 ? c : o) - window.__lxSheetCode));
      let want = [0];
      // the members of a set that a point is, by its log coordinate (z where it has none) whatever sheets list it: within the smaller of LAMBDA_SAME of 1 + |lam| and ID_SHARE of the
      // set's smallest separation (the set as it is before the point joins it; one member: no separation, the absolute form only; opt.absTol: the absolute form always). A point
      // that matches two members is a double match, which the tolerance's share below 1/2 rules out: it is counted and the row fails
      const sepMinOf = (set) => { let d = Infinity; for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) d = Math.min(d, dist(set[i], set[j])); return d; };
      const idMatches = (set, m) => {
        const rel = ${LAMBDA_SAME} * (1 + cabs(m.lam || m.z)), sm = sepMinOf(set), tol = opt && opt.absTol ? rel : Math.min(rel, ${ID_SHARE} * sm);
        if (set.length === 1) window.__lxCnt.sepOne++;
        const r = [];
        set.forEach((x, i) => { if (dist(x, m) <= tol) r.push(i); });
        if (r.length > 1) window.__lxCnt.dbl++;
        return r;
      };
      // the distance of two members: in lam where both have one (two members of different sheets can share a z and differ by turns in lam), else in z
      const dist = (p, q) => (p.lam && q.lam ? cabs(csub(p.lam, q.lam)) : cabs(csub(p.z, q.z)));
      // the members of the wanted sheets at w as many as the scene's count says (__cmwLandWind: the winding count N of each sheet's H - w); where the enumerator
      // finds fewer (near a branch value) the set is the one MONO_FAR cells away, counted likewise, continued to w in the log coordinate
      const countAt = (w) => { const q = window.__cmwLandWindSheets(w); return q ? q.reduce((n, r) => n + (want.includes(r.sheet) ? (r.status === 'ok' ? r.N : NaN) : 0), 0) : NaN; };
      // (the count N is of the members inside the frame's box in plane z: the set holds the members outside it too, and the enumerator's ramp members (level below 0, outside their sheet's window), a flagged edge's own member can be one)
      const box = (() => { const b = window.__cmwLandCarry(true); return b && { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 }; })();
      const inBox = (m) => !box || (m.z[0] >= box.x0 && m.z[0] <= box.x1 && m.z[1] >= box.y0 && m.z[1] <= box.y1);
      const listAt = (w) => {
        const out = [];
        for (const e of (window.__cmwLandEnum([w]) || [[]])[0]) {
          if (!want.includes(e.sheet)) continue;   // (the sheets the edge's ends hold; the others only crowd the separation check)
          const m = newton({ z: e.z, lam: e.lam, sheet: e.sheet, sheets: [e.sheet], lvl: e.lvl }, w);
          if (!m) { if (nfail && nfail.why === 'cap') window.__lxCnt.cap++; continue; }   // (an enumerated member that Newton cannot certify within its cap is a member the set lacks: counted, and the row fails)
          const q = !(opt && opt.countRamp) && out[idMatches(out, m)[0]];   // (countRamp: every sheet's entry is its own member, so the ramp sheets of a member count again)
          if (q) { if (!q.sheets.includes(m.sheet)) q.sheets.push(m.sheet); if (!(m.lvl < 0)) q.lvl = m.lvl; } else out.push(m);   // (a member any of whose sheets has it in its window is counted)
        }
        // (every member re-converged to CONV_SHARE of its smallest separation to another member, the scale the tracker's steps are judged by; one that cannot be is not certified)
        if (opt && opt.absTol) return out;
        const fine = out.map((m, i) => { const f = newton(m, w, false, Math.min(${LAMBDA_SAME}, ${CONV_SHARE} * sepOf(out, i))); if (!f && nfail && nfail.why === 'cap') window.__lxCnt.cap++; return f; });   // (a member dropped here for want of convergence is counted like one dropped above)
        return out.map((m, i) => fine[i] && Object.assign({}, fine[i], { sheets: m.sheets, lvl: m.lvl })).filter(Boolean);
      };
      // (a member is in a sheet's window when the imaginary part of its log coordinate is in (lo, hi] of that sheet's first op, within STRIP_TOL; a member with no
      // log coordinate falls back to the enumerator's level; opt.countRamp counts the ramp members too: the control that the count catches them)
      const noData = (m) => !m.lam || !(m.sheets || [m.sheet]).some((sh) => window.__lxWin[sh] && window.__lxWin[sh].lo !== null);
      const inWin = (m) => {
        if (noData(m)) { window.__lxNoWin = (window.__lxNoWin || 0) + 1; (window.__lxNoWinWho = window.__lxNoWinWho || []).push({ sheets: m.sheets || [m.sheet], z: m.z }); return true; }   // (no window data for the member: counted, and reported per row)
        return (m.sheets || [m.sheet]).some((sh) => { const q = window.__lxWin[sh]; return q && q.lo !== null && m.lam[1] > q.lo - ${WIN_TOL} && m.lam[1] <= q.hi + ${WIN_TOL}; });
      };
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
            const t1 = Math.min(1, t0 + dt), w = mix(pts[s], pts[s + 1], t1), nx = cur.map((m, i) => newton(m, w, opt && opt.zchart, opt && opt.absTol ? undefined : Math.min(${LAMBDA_SAME}, ${CONV_SHARE} * sepOf(cur, i))));
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
        want = (window.__cmwLandWindSheets(opt.countAt) || []).map((r) => r.sheet);
        return { N: countAt(opt.countAt), n: counted(listAt(opt.countAt)) };
      }
      if (opt && opt.idCtl) {
        // (the identity control: a set of two members ID_CTL_SEP apart in lam, closer than LAMBDA_SAME of 1 + |lam|: the relative identity keeps them two, the absolute one alone merges them)
        const w0 = opt.idCtl, base = membersAt(w0).find((m) => m.lam);
        if (!base) return { cls: 'unresolved', why: 'idCtl' };
        const m1 = Object.assign({}, base), m2 = Object.assign({}, base, { lam: [base.lam[0] + ${ID_CTL_SEP}, base.lam[1]] }), set2 = [m1, m2];
        return { sep: dist(m1, m2), rel: idMatches(set2, m2).length, abs: set2.filter((x) => dist(x, m2) <= ${LAMBDA_SAME} * (1 + cabs(m2.lam))).length };
      }
      if (opt && opt.dropWin) {
        // (the window control: the members counted with one sheet's window data removed are reported in __lxNoWin, so the per-row assertion that none is counted bites)
        const w0 = opt.dropWin;
        want = (window.__cmwLandWindSheets(w0) || []).map((r) => r.sheet);
        const set0 = listAt(w0), before = window.__lxNoWin, save = window.__lxWin.slice();
        (set0[0] ? set0[0].sheets || [set0[0].sheet] : []).forEach((sh) => { if (window.__lxWin[sh]) window.__lxWin[sh] = { lo: null, hi: null }; });
        counted(set0);
        window.__lxWin = save;
        return { n: set0.length, delta: window.__lxNoWin - before };
      }
      let e = window.__lxPend[k];
      if (opt && opt.syn) {
        // (a made-up edge through the branch value bv, from one side of it to the other (so the track along it cannot complete, as for a real edge at a branch
        // value): its ends are the vertices bv +- SYN_ARM cells toward the centre of the places the frame spans, the first end's member the first of the sheets with a member in
        // the box there, the second end's the next one at the other vertex; the sheets taken are those the scene counts a member of at the first vertex)
        const rg = window.__lxRegion, ang = Math.atan2((rg[2] + rg[3]) / 2 - opt.syn[1], (rg[0] + rg[1]) / 2 - opt.syn[0]), wv0 = [opt.syn[0] + Math.cos(ang) * ${SYN_ARM} * h, opt.syn[1] + Math.sin(ang) * ${SYN_ARM} * h], wo0 = [2 * opt.syn[0] - wv0[0], 2 * opt.syn[1] - wv0[1]];
        want = (window.__cmwLandWindSheets(wv0) || []).filter((r) => r.status === 'ok' && r.N > 0).map((r) => r.sheet);
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
      const atA = t < 0.5, zv = atA ? [ax, ay] : [bx, by], zo = atA ? [bx, by] : [ax, ay], wo = atA ? [wbx, wby] : [wax, way];
      let wv = atA ? [wax, way] : [wbx, wby];   // (the loops' base: the vertex, or for the made-up edge the point one half grid cell off it, see below)
      // the seam: the first end's member continued along the edge to the second end's place, by a completed track with its sheet kept by continuity; it is a
      // seam when it arrives at a member of that place other than the second end's (found by its z among the members there, whatever label the page gave it)
      const shA = sA, shB = sB, setA = membersAt([wax, way]), ia = nearest(setA, [ax, ay], shA);
      const trA = ia.i >= 0 && ia.d <= ${MONO_SEP} * sepOf(setA, ia.i) ? track(setA, [[wax, way], [wbx, wby]]) : null;
      if (trA) {
        const setB = opt && opt.emptyB ? [] : membersAt([wbx, wby]), anyB = (() => { let b = -1, d = Infinity; setB.forEach((m, i) => { const q = cabs(csub(m.z, [bx, by])); if (q < d) { d = q; b = i; } }); return b; })();
        const c = trA[ia.i];
        if (anyB < 0) return { cls: 'unresolved', why: 'bset' };   // (no certified member at the second end's place: no certificate of a seam)
        if (!idMatches(setB, c).includes(anyB)) return { cls: 'seam' };
      }
      // the branch value: the monodromy of the members round the cells at the vertex (based loops), and where a track fails round the 2 x 2 ring there
      const shV = atA ? shA : shB, shO = atA ? shB : shA;
      // (the sets the loops move hold the members of every sheet: a loop round a branch value carries a member to one of another sheet)
      want = (window.__cmwLandWindSheets(wv) || []).map((r) => r.sheet);
      let setV = membersAt(wv); const iv = nearest(setV, zv, shV), setO = membersAt(wo), io = nearest(setO, zo, shO);
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
      if (ib === -1) {
        // (a member of the set at the same log coordinate is the same member whatever sheet the carried one is on; else the carried member joins the set)
        const tb = trO[io.i], same = opt && opt.noBJoin ? -1 : (idMatches(setV, tb)[0] ?? -1);   // (noBJoin: the carried member joins whatever the set holds: the control that the merge is what certifies)
        if (same >= 0) { ib = same; if (!setV[same].sheets.includes(tb.sheet)) setV[same].sheets.push(tb.sheet); } else { setV.push(tb); ib = setV.length - 1; }
      }
      const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
      const pathMin = (p, pts) => Math.min(...pts.slice(0, -1).map((q, i) => segDist(p, q, pts[i + 1])));   // (the least distance of a point to a path)
      const loopOf = (b, c0, sx, sy) => [b, c0, [c0[0] + sx * h, c0[1]], [c0[0] + sx * h, c0[1] + sy * h], [c0[0], c0[1] + sy * h], c0, b];
      const ringOf = (b) => [b, [b[0] + h, b[1]], [b[0] + h, b[1] + h], [b[0] - h, b[1] + h], [b[0] - h, b[1] - h], [b[0] + h, b[1] - h], [b[0] + h, b[1]], b];
      let synClear = null;
      if (opt && opt.syn) {
        // (the made-up edge's loops are based off its end, along the axis (of the four, the first) that leaves the branch value inside a cell of the loops, at least BRANCH_CLEAR
        // cells from every spoke, side and the access path to the base; the members are carried there along that path. Where no axis does, or the members cannot be carried to
        // the base, the row fails by its own class, never as unresolved)
        let best = 0, base = null;
        for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const lc = [wv[0] + ex * ${SYN_BASE} * h, wv[1] + ey * ${SYN_BASE} * h];
          const paths = [[wv, lc], ringOf(lc), ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sy]) => loopOf(lc, lc, sx, sy))];
          const mn = Math.min(...paths.map((q) => pathMin(opt.syn, q))) / h;
          best = Math.max(best, mn);
          if (mn < ${BRANCH_CLEAR}) continue;
          const tr = track(setV, [wv, lc]);
          if (tr) { base = { lc, tr, mn }; break; }
        }
        if (!base) return { cls: best >= ${BRANCH_CLEAR} ? 'nobase' : 'noclear', why: best >= ${BRANCH_CLEAR} ? 'no members at loop base' : 'no axis keeps the branch value clear of the loops', best, fail };
        setV = base.tr.map((m, i) => Object.assign({}, m, { sheets: setV[i].sheets, lvl: setV[i].lvl }));
        wv = base.lc; synClear = base.mn;
      }
      // (the set re-converged at the vertex to the scale of its own separations, which a member added above changes)
      const refine = () => setV.forEach((m, i) => { const f = newton(m, wv, false, Math.min(${LAMBDA_SAME}, ${CONV_SHARE} * sepOf(setV, i))); if (f) Object.assign(m, f, { sheets: m.sheets, lvl: m.lvl }); });
      if (!(opt && opt.absTol)) refine();
      const loop = (c0, sx, sy) => loopOf(wv, c0, sx, sy), ring = ringOf(wv);
      // (the member a tracked member has arrived at, by its log coordinate whatever sheets list it: the monodromy of a loop is read along the chain from a; the
      // chain is lost where an image is no member of the set, and the loop is then no certificate of either answer)
      // (the made-up edge's loops and ring: a path with a point within BRANCH_CLEAR cells of the branch value is a failure of the test's geometry, never a verdict)
      const clearOK = (pts) => !(opt && opt.syn) || pathMin(opt.syn, pts) >= ${BRANCH_CLEAR} * h;
      const cyc = (pts) => {
        if (!clearOK(pts)) { fail = { why: 'clear', min: pathMin(opt.syn, pts) / h }; return null; }
        const tr = track(setV, pts);
        if (!tr) return null;
        iv.lam0 = tr[iv.i].lam && setV[iv.i].lam ? csub(tr[iv.i].lam, setV[iv.i].lam) : null;   // (the shift of a's log coordinate round the loop)
        let c = iv.i, hit = false, lost = false, chain = 0, nonT = false;
        for (let g = 0; g <= setV.length; g++) {
          // (each step of the chain is a translation by the same T: the image of the member c is c + T; a step that is not makes the chain no certificate either way; opt.shiftStep moves the second step's image by one more T, the control that this check fires)
          const lamC = opt && ((opt.nullLam && g === 1) || (opt.nullFirst && g === 0)) ? null : tr[c].lam;   // (opt.nullLam, opt.nullFirst: the second step's, the first step's member has no log coordinate: the controls that the check fires)
          if (window.__lxLogChain && !(opt && opt.zchart) && !(lamC && setV[c].lam)) { window.__lxCnt.noLam++; nonT = true; }   // (on a chain with a branch step a step with no log coordinate cannot be shown a translation: the chain is no certificate, and the row counts it; the z-chart control tracks in z, where members have none by construction, and compares verdicts only)
          else if (iv.lam0 && lamC) {
            let sh = csub(lamC, setV[c].lam);
            if (opt && opt.shiftStep && g === 1) sh = cadd(sh, iv.lam0);
            if (cabs(csub(sh, iv.lam0)) > ${LAMBDA_SAME} * (1 + cabs(setV[c].lam))) nonT = true;
          }
          const n = idMatches(setV, tr[c])[0] ?? -1;
          if (n < 0) { lost = true; chain = g; iv.lostInfo = { chain: g, nearest: Math.min(...setV.map((q) => dist(q, tr[c]))), sepMin: sepMinOf(setV), lam: tr[c].lam, tol: ${LAMBDA_SAME} * (1 + cabs(tr[c].lam || tr[c].z)) }; break; }
          if (n === ib) hit = true;
          if (n === iv.i) break;
          c = n;
        }
        return { hit: hit && !nonT, lost: lost || nonT, chain, shift: iv.lam0, nonT };
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
      // (the orbit enlargement: the members of the cycle through a are a + kT (T the shift of a's log coordinate round the loop) for every integer k; the other end's member b is a member
      // of the set and so within the set's own span of a in the imaginary part of lam: kmax = that span in shares of |T|, plus one. The roots with |k| up to the larger of kmax + 1
      // and the scene's member count plus ORBIT_EXTRA are certified and added, at most ORBIT_REACH_MAX of them each way (a wider span is unresolved), so a chain that leaves the set
      // after kmax steps in both directions without reaching b shows b is no member of a's cycle)
      let enlarged = false, reach = null;
      const enlarge = (T) => {
        if (enlarged || !T || !(cabs(T) > 0)) return false;
        enlarged = true;
        const a0 = setV[iv.i];
        const span = Math.max(...setV.filter((x) => x.lam).map((x) => Math.abs(x.lam[1] - a0.lam[1])));
        const kmax = Math.ceil(span / cabs(T)) + 1, want0 = Math.round(countAt(wv)) + ${ORBIT_EXTRA}, orbitMax = Math.min(${ORBIT_REACH_MAX}, Math.max(want0, kmax + 1));
        reach = { kmax, orbitMax, capped: kmax + 1 > ${ORBIT_REACH_MAX}, span, T };
        let added = 0;
        for (let k = 1; k <= orbitMax; k++) for (const sg of [1, -1]) {
          const lam = [a0.lam[0] + sg * k * T[0], a0.lam[1] + sg * k * T[1]];
          const m = newton({ z: expc(lam), lam, sheet: a0.sheet, sheets: a0.sheets, lvl: a0.lvl }, wv);
          if (m && idMatches(setV, m).length === 0) { setV.push(m); added++; }
          window.__lxOrbit.push({ k: sg * k, lam, ok: !!m, nfail: m ? null : nfail, cell: [Math.round(wv[0] / h * ${CELL_QUANT}), Math.round(wv[1] / h * ${CELL_QUANT})] });
        }
        if (added > 0 && !(opt && opt.absTol)) refine();
        return added > 0;
      };
      const read1 = (pts) => { let q = cyc(pts); if (q && q.lost && enlarge(q.shift)) q = cyc(pts); return q; };
      const read = (pts) => {
        const q = read1(pts);
        if (q && q.hit) return q;
        const r = read1(pts.slice().reverse());
        if (r && r.hit) return r;
        if (!q || !r) return q || r;
        // (both directions leave the set: past kmax steps each without b, b is no member of the cycle: the loop holds no b, a read and not a loss; short of kmax, or with the reach capped, the chain is lost)
        const done = reach && !reach.capped && !q.nonT && !r.nonT && q.lost && r.lost && q.chain >= reach.kmax && r.chain >= reach.kmax;
        window.__lxChain = (window.__lxChain || []).concat([[q.chain, r.chain, reach && reach.kmax, !!(reach && reach.capped)]]);
        return Object.assign({}, q, { lost: done ? false : q.lost && r.lost, chain: [q.chain, r.chain], nonT: q.nonT || r.nonT });
      };
      if (opt && opt.noLoops) return { cls: 'false', why: 'no loops' };   // (the no-reach control: with no loop to read, a branch edge is not certified)
      let unres = false;
      fail = null;
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const q = read(loop(wv, sx, sy));
        if (!q) { unres = true; continue; }
        if (q.lost) unres = true;
        if (q.hit) return { cls: 'branch', clear: synClear, cell: [Math.round(Math.min(wv[0], wv[0] + sx * h) / h * ${CELL_QUANT}), Math.round(Math.min(wv[1], wv[1] + sy * h) / h * ${CELL_QUANT})] };
      }
      if (unres) { const q = read(ring); if (q && q.hit) return { cls: 'branch', cell: [Math.round(wv[0] / h * ${CELL_QUANT}), Math.round(wv[1] / h * ${CELL_QUANT}), 'ring'] }; if (!q || q.lost) return { cls: 'unresolved', why: q && q.nonT ? 'nonTranslate' : 'ring', ring: q && { hit: q.hit, lost: q.lost, shift: q.shift }, setN: setV.length, lostInfo: iv.lostInfo, fail: q ? null : fail }; }
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
    const NX = g.nx << g.depth, NY = g.ny << g.depth, S = 1 << g.depth;
    // (the places' members are looked up once for all the depths of a refine: the lattice of depth d holds the lattice of depth d - 1, at the same
    // coordinates, so the cache (window.__lxShared, one for each refine) is keyed by the place's index on the finest lattice, depthMax; g.brute: a
    // cache of this run alone and every entry of a list looked up, the control the shared one is compared with)
    const FIN = 1 << (g.depthMax - g.depth), NYF = g.ny << g.depthMax, cache = g.brute ? new Map() : window.__lxShared, used = new Set();
    let drift = 0;   // (places found in the cache whose stored coordinates are not the lattice's: the key is wrong)
    const xy = (i, j) => [b.x0 + i * (b.x1 - b.x0) / NX, b.y0 + j * (b.y1 - b.y0) / NY];
    const key = (i, j) => (i * FIN) * (NYF + 1) + j * FIN;
    let capped = false;
    const levels = g.levels || g.depth + 1;   // each level halves the cells: depth + 1 levels judge every cell down to one lattice step
    // the places' members projected, in half-resolution pixels: [] where the place has none, null where unknown (not looked up yet)
    function* look(list) {
      // (cap counts the places this run touches: the entries of the list not touched yet, a place twice if it is listed twice)
      const fresh = list.filter(([i, j]) => !used.has(key(i, j)));
      if (!g.brute) for (const [i, j] of list) { const c = window.__lxCoords.get(key(i, j)), q = xy(i, j); if (c && (c[0] !== q[0] || c[1] !== q[1])) drift++; }
      if (!fresh.length) return true;
      if (used.size + fresh.length > g.cap) { capped = true; return false; }
      const need = g.brute ? fresh : [...new Map(fresh.map(([i, j]) => [key(i, j), [i, j]])).values()].filter(([i, j]) => !cache.has(key(i, j)));
      for (const [i, j] of fresh) used.add(key(i, j));
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
          if (!g.brute) window.__lxCoords.set(key(i, j), xy(i, j));
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
    const res = window.__lxCompare(mark, frame, W2, H2, g.slack, capped); res.places = used.size; res.drift = drift; return res;
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
  // the largest relative |H(z) - w| over the members (each { z, w, sheet }), each on its own sheet's surface of the scene's homotopy (window.__cmwLandHom,
  // the cell the certificate read it on): 0 when each member is a preimage of its place under the surface it is listed on; Infinity when the hook has no value
  // there. shift moves every w by that much; wrong reads each member on the next surface (the controls)
  window.__lxHomMiss = (ms, shift, wrong) => {
    const err = (m, hs) => {
      const h = hs && hs[(m.sheet + (wrong ? 1 : 0)) % hs.length];
      return h && h.H ? Math.hypot(h.H[0] - m.w[0] - shift, h.H[1] - m.w[1]) / (1 + Math.hypot(m.w[0], m.w[1])) : Infinity;
    };
    const hsOf = ms.map((m) => (typeof __cmwLandHom === 'function' ? __cmwLandHom(m.z, m.cell) : null));
    const d = ms.map((m, i) => err(m, hsOf[i]));
    const bad = ms.map((m, i) => [i, d[i]]).filter(([, x]) => x > window.__lxHomTol);
    return { worst: d.reduce((a, b) => Math.max(a, b), 0), nBad: bad.length, sample: bad.slice(0, 4).map(([i, x]) => ({ z: ms[i].z, w: ms[i].w, sheet: ms[i].sheet, miss: x, bySheet: (hsOf[i] || []).map((h) => [h.sheet, h.H ? Math.hypot(h.H[0] - ms[i].w[0] - shift, h.H[1] - ms[i].w[1]) / (1 + Math.hypot(ms[i].w[0], ms[i].w[1])) : null]) })) };
  };
  window.__lxPick = null;
  // the members expanded by the forward combos refsOf(z) gives ([{ combo, z, f, h }] per z): a member with more than one combo is that many
  // layers, the others stay as they are
  window.__lxExpand = (o, refsOf) => o.flatMap((m) => {
    const rs = refsOf(m.z).filter((r) => r.f && r.h !== null);
    return rs.length > 1 ? rs.map((r) => ({ z: m.z, f: r.f, h: r.h, sheet: m.sheet, digits: m.digits, member: m.member, src: m.src, lvl: m.lvl, cell: m.cell, front: m.front, combo: r.combo })) : [m];
  });
  window.__lxEnum = (pts, sheets) => {
    const e = typeof __cmwLandMembers === 'function' ? __cmwLandMembers(pts) : null;
    if (!e) return null;
    // (the front member first: the hook marks the one the frame draws with sheets off. All sheets: a member of a chain with a multivalued
    // step past plane 0 is drawn once per forward combo of the colour map's distinct sheets, the parked frame's own: window.__cmwLandRefSheets(z),
    // each { combo, z, f, h }; a chain without one has the member alone)
    // (a place with members and none marked front: true is counted in window.__lxNoFront, which the suite fails on)
    window.__lxNoFront = 0;
    return e.map((ms) => {
      if (ms.length && !ms.some((m) => m.front)) window.__lxNoFront++;
      const o = ms.map((m) => ({ z: m.z, f: m.f, h: m.h, sheet: m.k, digits: m.digits, member: m.member, src: m.src, lvl: m.lvl, cell: m.cell, miss: m.miss, miss2: m.miss2, front: m.front }));
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
    await ev('window.__lxShared = new Map(); window.__lxCoords = new Map(); 1');
    const startSize = await ev('window.__lxShared.size');
    let drift = 0;
    for (; depth <= ref.depthMax; depth++) {
      if (depth > ref.depth) await ev('window.__lxPrev = window.__lxMasks');
      await ev(`window.__lxRasterStart(${sheets}, ${JSON.stringify(Object.assign({}, ref, { depth }))})`);
      let st = { done: false };
      for (let k = 0; !st.done && k < STEP_MAX; k++) st = JSON.parse(await ev(`JSON.stringify(__lxRasterStep(${STEP_MS}))`));
      rk = st.done ? st.res : null;
      if (!rk) break;
      drift += rk.drift || 0;
      if (depth > ref.depth) { conv = await ev(`__lxConv(${ref.slack})`); if (firstConv === null) firstConv = conv; calm = conv === 0 ? calm + 1 : 0; if (calm >= ref.calm) break; }
    }
    depth = Math.min(depth, ref.depthMax);
    if (rk) Object.assign(rk, { depth, conv, firstConv, calm });
    return { rk, conv, firstConv, calm, depth, startSize, drift };
  }
  // one depth of the raster, run to its end: the result (null when it never finishes)
  async function rasterAt(sheets, g) {
    await ev(`window.__lxRasterStart(${sheets}, ${JSON.stringify(g)})`);
    let st = { done: false };
    for (let k = 0; !st.done && k < STEP_MAX; k++) st = JSON.parse(await ev(`JSON.stringify(__lxRasterStep(${STEP_MS}))`));
    return st.done ? st.res : null;
  }
  // the shared cache against the cache of one run alone, at every depth of a refine: the two masks agree at every pixel, with the same places
  // touched, pixels and cap; emptyEvery: every that-many-th place of the shared cache emptied before the depth after the first (the control)
  const CACHE_CTL_EVERY = 7, CACHE_CTL_TAGS = ['Roots as preimages', 'log of an annulus', 'cube root'];
  async function cacheControl(sheets, emptyEvery) {
    await ev('window.__lxShared = new Map(); window.__lxCoords = new Map(); window.__lxCtl = { fast: [], brute: [] }; 1');
    const rows = [];
    for (let depth = REF.depth; depth <= REF.depthMax; depth++) {
      if (emptyEvery && depth === REF.depth + 1) await ev(`window.__lxShared.forEach((v, k) => { if (k % ${emptyEvery} === 0) window.__lxShared.set(k, []); }); 1`);
      const fast = await rasterAt(sheets, Object.assign({}, REF, { depth }));
      await ev('window.__lxFast = Uint8Array.from(window.__lxMasks.ref); window.__lxCtl.fast.push(window.__lxMasks); 1');
      const brute = await rasterAt(sheets, Object.assign({}, REF, { depth, brute: true }));
      await ev('window.__lxCtl.brute.push(window.__lxMasks); 1');
      const same = fast && brute && await ev('window.__lxFast.length === window.__lxMasks.ref.length && window.__lxFast.every((v, i) => v === window.__lxMasks.ref[i])');
      // (the distance of this depth's mask to the one before, of each run: the numbers calm and firstConv are made of)
      const conv = depth > REF.depth && fast && brute ? await ev(`(() => { const d = (a) => window.__lxCompare(a[a.length - 2].ref, a[a.length - 1].ref, a[0].W2, a[0].H2, ${REF.slack}, false).off; return [d(window.__lxCtl.fast), d(window.__lxCtl.brute)]; })()`) : null;
      rows.push({ depth, same: !!same, places: fast && brute ? [fast.places, brute.places] : null, n: fast && brute ? [fast.n, brute.n] : null, capped: fast && brute ? [fast.capped, brute.capped] : null, conv, drift: fast ? fast.drift : null });
      if (!fast || !brute || brute.capped) break;
    }
    return rows;
  }
  const cacheControlOk = (rows) => rows.length > 1 && rows.every((r) => r.same && r.places && r.places[0] === r.places[1] && r.n[0] === r.n[1] && r.capped[0] === r.capped[1] && r.drift === 0 && (!r.conv || r.conv[0] === r.conv[1]));
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
  // The members the frame draws at one place: every drawn texel, own or continued onto another layer, counted once. A texel is a copy of
  // an earlier one when it agrees with it in z within Z_TOL and in height within HEIGHT_TOL (a layer's continued vertex repeats the member
  // its neighbour draws; the forward combos of one z differ in height, so they stay apart)
  const distinctLayers = (list) => {
    const out = [];
    for (const l of list) if (!l.z || !out.some((o) => o.z && sameZ(o.z, l.z) && Math.abs(o.h - l.h) <= HEIGHT_TOL)) out.push(l);
    return out;
  };
  {
    const L = (z, h) => ({ z, h }), a = L([1, 0], 0), b = L([1, 0], 1), c = L([-1, 0], 0);
    ok('the distinct layers count a duplicate copy once', distinctLayers([a, L([1, 0], 0.001), c]).length === 2, null);
    ok('the distinct layers keep two heights of one z apart', distinctLayers([a, b]).length === 2, null);
    ok(`the distinct layers keep two members of one z ${10 * HEIGHT_TOL} apart in height as two`, distinctLayers([a, L([1, 0], 10 * HEIGHT_TOL)]).length === 2 && distinctLayers([a, L([1, 0], 0.5 * HEIGHT_TOL)]).length === 1, null);
    ok('the distinct layers keep a member that is not a copy', distinctLayers([a, c]).length === 2 && distinctLayers([a]).length === 1, null);
  }
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
  // the members whose plan label does not go with the scene's surface they are certified on: each plan label (m.src) goes with the surface most
  // members carrying it are certified on, and a surface goes with one label; the others are the mislabelled (the frame claims a member on a sheet the scene puts it
  // elsewhere). The plan's numbering of sheets is its own, so the labels are compared as a correspondence, not by value
  const labelConflicts = (ms) => {
    const cnt = new Map();
    for (const m of ms) { const key = m.src + '>' + m.sheet; cnt.set(key, (cnt.get(key) || 0) + 1); }
    const best = new Map(), used = new Map();
    for (const [key, n] of [...cnt].sort((a, b) => b[1] - a[1])) {
      const [src, sheet] = key.split('>');
      if (!best.has(src) && !used.has(sheet)) { best.set(src, sheet); used.set(sheet, src); }
    }
    return ms.filter((m) => best.get(String(m.src)) !== String(m.sheet));
  };
  const layerGap = (l, m, tol = { h: HEIGHT_TOL, ph: PHASE_TOL }) => {
    const o = { h: Math.abs(l.h - m.h) > tol.h, noF: !l.f || !m.f, ph: false, phN: false };
    if (!o.noF) { const g = phaseGap(l.f, m.f); o.phN = g !== null; o.ph = g !== null && g > tol.ph; }
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
  const HIST = {};   // (per case and u: the drawn and the reference's height of the first layer at each probe place, for the wrong-u controls)
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
  const bit = { empty: 0, ramp: 0, noBJoin: 0, zchart: 0, synWrong: 0, nonT: 0, noLam: 0 };   // rows where the emptied-second-end control and the ramp-count control ran and bit: each must bite on some row
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
  // ---- The cap at the block (All sheets' layered draw): what the draw puts on screen stays inside the clip's own bound ----
  // For a drawn fragment of a layer, hTrue is the height of the scene's H_u at the fragment's preimage vZ, on the layer's own branch (its claim code, the anchor vZc: __cmwLandScene, the CPU
  // reference, which reads no plan and evaluates nothing the shader does), and the bound is Hc = GLR.BLOCK_K times the block's height, the clip's own value. window.__cmwLandCapRead draws the
  // frame into a float target with the fragment stage writing its geometry (no map evaluated in the shader) and picks, from the drawn heights, the pixels to evaluate: the CAP_PER_CELL pixels of the
  // largest drawn |height| in each straddling cell (a grid cell with a corner past Hc), CAP_UNIFORM more on a seeded stratified grid (data only), CAP_MAX in all. The clip puts the
  // cut where the true height is Hc, exactly in 1 / h for corners past CLIP_FAR block edges and linearly inside it, so the count of straddling pixels with |hTrue| over Hc (1 + CAP_EPS) is 0, CAP_EPS
  // being the deviation the linear crossings inside CLIP_FAR leave. Controls: C1 the same count with the clip off (the layers cut at their drawn height, linearly interpolated) is over 0 in
  // every row with a straddling cell, C2 the pixels of the smallest drawn |height| in place of the largest see fewer, C3 the layer's claim one digit off moves the clip-on maximum by more than
  // CAP_EPS, C4 the float target returns the constant the probe writes
  const CAP_EPS = 0.05, CAP_PER_CELL = 2, CAP_UNIFORM = 64, CAP_MAX = 400, CAP_SEED = 20251110, CAP_BATCH = 20, CAP_WORST = 3, CAP_CONST = [1, 2, 3, 4];
  const capRd = (o) => ev(`__cmwLandCapRead(${JSON.stringify(Object.assign({ perCell: CAP_PER_CELL, uniform: CAP_UNIFORM, max: CAP_MAX, seed: CAP_SEED }, o))})`);
  const capEval = async (samples, shift) => {
    const out = [];
    for (let i = 0; i < samples.length; i += CAP_BATCH) {
      const b = samples.slice(i, i + CAP_BATCH).map((q) => ({ z: q.z, zc: q.zc, own: q.own + shift }));
      out.push(...await ev(`__cmwLandCapHeights(${JSON.stringify(b)})`));
    }
    return out;
  };
  const capStat = (rd, hs, hc) => {
    const s = rd.samples.map((q, i) => Object.assign({ h: hs[i] }, q)), st = s.filter((q) => q.kind === 'strad'), un = s.filter((q) => q.kind === 'uniform');
    const fin = (a) => a.filter((q) => q.h !== null);
    return {
      unresolved: s.filter((q) => q.h === null).length,
      over: fin(st).filter((q) => Math.abs(q.h) > hc * (1 + CAP_EPS)).length,
      maxRatio: fin(st).reduce((m, q) => Math.max(m, Math.abs(q.h) / hc), 0),
      uniMax: fin(un).reduce((m, q) => Math.max(m, Math.abs(q.h - q.vz)), 0),
      nStrad: st.length, nUni: un.length,
      worst: fin(st).sort((p, q) => Math.abs(q.h) - Math.abs(p.h)).slice(0, CAP_WORST).map((q) => ({ vz: q.vz, h: q.h, layer: q.layer, own: q.own, cell: q.cell, z: q.z, zc: q.zc }))
    };
  };
  const capBit = { c1: 0, c2fell: 0, c3: 0, c4: 0, rows: 0 }, capCase = {};
  const capRow = async (c, u, t, rec) => {
    const t0 = Date.now(), on = await capRd({});
    ok(`${t}: the cap probe reads a float target and a layered frame (${on.err || 'read'})`, !on.err, on);
    if (on.err) return;
    capBit.rows++;
    if (!capBit.c4 && !capBit.c4done) {
      capBit.c4done = true;
      const k = await capRd({ constant: true });
      ok(`${t}: C4: the float target returns the constant the probe writes (${JSON.stringify(k.constant)})`, !!k.constant && k.constant.length === CAP_CONST.length && k.constant.every((x, i) => x === CAP_CONST[i]), k.constant);
      if (k.constant && k.constant.every((x, i) => x === CAP_CONST[i])) capBit.c4++;
    }
    const hc = on.hc, tS = Date.now();
    const hOn = await capEval(on.samples, 0), sOn = capStat(on, hOn, hc), tOn = Date.now() - tS;
    ok(`${t}: cap: no sampled pixel is unresolved by the scene (${sOn.unresolved} of ${on.samples.length})`, sOn.unresolved === 0, sOn);
    ok(`${t}: cap: no straddling cell is left out of the sample (${on.truncated} of ${on.nStrad + on.truncated} cells; ${on.samples.length} of ${CAP_MAX} pixels)`, on.truncated === 0, { truncated: on.truncated, nStrad: on.nStrad });
    ok(`${t}: cap: no drawn pixel's true height is over Hc (1 + ${CAP_EPS}), the ${sOn.nStrad} pixels of ${on.nStrad} straddling cells (${sOn.over} are; the largest |hTrue| / Hc is ${sOn.maxRatio.toFixed(4)}, Hc = ${hc})`, sOn.over === 0, sOn);
    ok(`${t}: cap: the largest drawn |height| is inside Hc (1 + ${CAP_EPS}) (${(on.maxDrawn / hc).toFixed(4)} Hc)`, on.maxDrawn <= hc * (1 + CAP_EPS), { maxDrawn: on.maxDrawn, hc });
    // C1, the clip off
    const off = await capRd({ clipOff: true }), hOff = await capEval(off.samples, 0), sOff = capStat(off, hOff, hc);
    const na = ctlNA(c, 'capOff', u);
    if (off.nStrad > 0) {
      ok(`${t}: C1: without the block clip ${sOff.over} straddling pixels (of ${sOff.nStrad}) have |hTrue| over Hc (1 + ${CAP_EPS}) (largest ${sOff.maxRatio.toFixed(4)} Hc)${na ? '; the row is listed as not applicable: ' + na : ''}`, sOff.over > 0 && !na, sOff);
      if (sOff.over > 0) capBit.c1++;
    } else ok(`${t}: C1: no straddling cell is drawn here (${off.nStradAll} cells have a corner past Hc): not applicable${na ? ': ' + na : ''}`, !!na, { nStradAll: off.nStradAll });
    // C2, the pixels of the smallest drawn height
    const low = await capRd({ clipOff: true, lowest: true }), hLow = await capEval(low.samples, 0), sLow = capStat(low, hLow, hc);
    if (off.nStrad > 0) {
      ok(`${t}: C2: sampling each straddling cell's lowest drawn pixels, the clip-off count falls (${sLow.over} against ${sOff.over})`, sLow.over < sOff.over || sOff.over === 0, { low: sLow.over, top: sOff.over });
      if (sLow.over < sOff.over) capBit.c2fell++;
      const k = capCase[c.tag] = capCase[c.tag] || { top: 0, low: 0 }; k.top += sOff.over; k.low += sLow.over;
    }
    // C3, the claim one digit off
    const K = await ev('(__cmwLandSceneCombos() || {}).n || 0'), naK = ctlNA(c, 'capShift', u);
    if (K > 1) {
      const hSh = await capEval(on.samples, 1), sSh = capStat(on, hSh, hc);
      ok(`${t}: C3: continued on the claim one digit off the clip-on maximum |hTrue| / Hc moves by over ${CAP_EPS} (${sOn.maxRatio.toFixed(4)} to ${sSh.maxRatio.toFixed(4)}; ${sSh.unresolved} unresolved)${naK ? '; listed as not applicable: ' + naK : ''}`, Math.abs(sSh.maxRatio - sOn.maxRatio) > CAP_EPS && !naK, { on: sOn.maxRatio, shifted: sSh.maxRatio });
      if (Math.abs(sSh.maxRatio - sOn.maxRatio) > CAP_EPS) capBit.c3++;
    } else ok(`${t}: C3: the glide's map has one surface: not applicable`, true, { K });
    rec.cap = { hc, covered: on.covered, nStradAll: on.nStradAll, nStrad: on.nStrad, truncated: on.truncated, clipOn: sOn, clipOff: sOff, lowest: sLow, tOnMs: tOn, tRowMs: Date.now() - t0 };
    info.capRows = (info.capRows || []).concat({ t, hc, ...rec.cap });
    if (process.env.CAP_LOG) fs.appendFileSync(process.env.CAP_LOG, JSON.stringify({ t, ...rec.cap, K }) + '\n');
  };
  await view(VIEW_W, VIEW_H, false, false);
  // (CMW_ONLY: one case by its tag, so that CI runs the cases of All sheets in parts)
  for (const c of CASES.filter((x) => !process.env.CMW_ONLY || x.tag === process.env.CMW_ONLY)) for (const sheets of MODES) {
    const name = `${c.tag}, ${sheets ? 'All sheets' : 'sheets off'}`;
    const r = info[name] = {};
    await load(c, sheets);
    if (!rcDone) { rcDone = true; await rasterControls(); }
    const last = 1;   // (the glide from plane 0 to plane 1)
    const p0 = await park(0, 'P0');
    const camP0 = await ev("__cmwCam('L')");
    const p1 = await park(last, 'P1');
    ok(`${name}: the parked frames are still and have a height reading`, p0.still && p1.still && p0.pick && p1.pick, { p0, p1 });
    // the parked end planes again in the Top view
    const camP1 = await ev("__cmwCam('L')");   // (the camera plane 1 was parked with: park() fits the camera to its plane, so plane 0's can be another)
    const camGap = Math.abs(camP1.dist - camP0.dist) / camP0.dist;
    if (CAM_SAME_CASES.includes(c.tag) || (!sheets && CAM_GAP_CASES.includes(c.tag))) ok(`${name}: the two end planes are parked with the same camera distance (${camGap} apart; within ${CAM_SAME_TOL}: the labels agree under either camera)`, camGap <= CAM_SAME_TOL, { camP0, camP1 });
    if (sheets && CAM_GAP_CASES.includes(c.tag)) ok(`${name}: the two end planes are parked with cameras ${camGap} apart in distance (at least ${CAM_GAP_MIN}: the premise of the tick label control)`, camGap >= CAM_GAP_MIN, { camP0, camP1 });
    await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`);
    const p0T = await park(0, 'P0T');
    const distP0T = (await ev("__cmwCam('L')")).dist;
    const p1T = await park(last, 'P1T');
    const distP1T = (await ev("__cmwCam('L')")).dist;
    await ev(`__cmwCam('L', ${JSON.stringify(camP1)}); 1`);
    ok(`${name}: the Top-view references are parked at each plane's own camera distance (${distP0T} for plane 0 against ${camP0.dist}, ${distP1T} for plane 1 against ${camP1.dist}; within ${CAM_DIST_TOL})`,
      Math.abs(distP0T - camP0.dist) <= CAM_DIST_TOL * camP0.dist && Math.abs(distP1T - camP1.dist) <= CAM_DIST_TOL * camP1.dist, { distP0T, distP1T, camP0, camP1 });
    ok(`${name}: the parked frames are still in the Top view`, p0T.still && p1T.still, { p0T, p1T });
    const hueCtl = await ev("__lx.hueOff('P0T', 'P1T')");
    ok(`${name}: control: the hue count tells two different planes' parked frames apart (${hueCtl} pixels, over ${HUE_OFF_MAX})`, hueCtl > HUE_OFF_MAX, { hueCtl });
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true, clock: 0 }); 1`);
    const comboN = {}, comboCtl = {};   // (per u: the distinct sheet combos of the colour map; per near end: the shifted-combo hue count)
    const brPts = CUT_ROWS[c.tag] ? branchPoints(c.steps) : [];
    for (const u0 of GLIDE_U) {
      const mid = MID_U.includes(u0), u = u0, first = u0 < GLIDE_MID && !mid, lastU = u0 > GLIDE_MID && !mid;   // (first: a probe near plane z, lastU: near the next plane)
      const t = `${name}, u=${u}`;
      await setU(u);
      const camU = await ev("__cmwCam('L')");   // (the camera this frame is drawn with: the camera follows the frame, and every Top-view trip returns to it)
      const still = await grab('cur');
      const carry = await ev('(() => { const c = __cmwLandCarry(); return c && { path: c.path || null, u: c.u, holes: c.landHoles }; })()');
      const cov = { still, n: await ev(`__lx.cover('cur')`), d0: (await compare('cur', 'P0')).frac, d1: (await compare('cur', 'P1')).frac };
      r[u] = { carry, cov, p0: p0.cover, p1: p1.cover };
      if (COMBO_CONTROL.includes(c.tag)) comboN[u] = (await ev(`(__cmwLandRefSheets(${JSON.stringify(COMBO_PLACE)}) || []).length`)) || 0;   // (the colour map's combos are the map's, not the place's)
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
      if (sheets && !(carry && carry.path === 'mesh')) await capRow(c, u, t, r[u]);
      // the end frames in the Top view, against the parked plane there
      if (first || lastU) {
        await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        const stillT = await grab('curT');
        const dT = (await compare('curT', first ? 'P0T' : 'P1T')).frac;
        await ev(`__cmwCam('L', ${JSON.stringify(camU)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
        const hueN = await ev(`__lx.hueOff('curT', ${first ? "'P0T'" : "'P1T'"})`);
        r[u].top = { still: stillT, d: dT, hueN };
        ok(`${t}: in the Top view at most ${HUE_OFF_MAX} coloured pixels are of another hue than the parked plane's (${hueN} are; a hue-shifted row at a sheet boundary)`, hueN <= HUE_OFF_MAX, r[u].top);
        if (NEAR_U.includes(u) && COMBO_CONTROL.includes(c.tag) && !(r.comboControl || {})[u]) {
          // (the control: every sheet's combo one off, so the colour continues on the wrong branch of the step)
          // (a combo one off names a surface only where the glide's map H_u has more than one (window.__cmwLandSceneCombos, the scene's own count): with one, the control is not applicable)
          const sceneK = await ev('(__cmwLandSceneCombos() || {}).n || 0');
          // (a map with one surface gives the same value for any combo: the largest |H_u(z; combo 1) - H_u(z; combo 0)| over COMBO_NA_PLACES places of the box, relative to 1 + |w|, is printed and must be at most COMBO_NA_TOL)
          let ctl = undefined;
          if (sceneK <= 1) {
            const dd = await ev(`(() => { const b = __cmwLandCarry(true) || (window.__lxPick && window.__lxPick.box); if (!b) return null; let worst = 0, n = 0; for (let i = 0; i < ${COMBO_NA_PLACES}; i++) { const z = [b.x0 + (b.x1 - b.x0) * (0.05 + 0.9 * ((i * 7) % ${COMBO_NA_PLACES}) / (${COMBO_NA_PLACES} - 1)), b.y0 + (b.y1 - b.y0) * (0.05 + 0.9 * ((i * 13) % ${COMBO_NA_PLACES}) / (${COMBO_NA_PLACES} - 1))], a = __cmwLandScene(z, 0, z), c = __cmwLandScene(z, 1, z); if (!a || !c) continue; n++; worst = Math.max(worst, Math.hypot(a[0] - c[0], a[1] - c[1]) / (1 + Math.hypot(a[0], a[1]))); } return { worst, n }; })()`);
            ctl = { na: sceneK, diff: dd };
          }
          if (sceneK > 1) try {
            await ev("window.__svCarryProbe = Object.assign({}, window.__svCarryProbe, { comboShift: 1 }); 1"); await settled({ max: LOAD_MAX_MS });
            await ev(`__cmwCam('L', ${JSON.stringify(TOP_CAM)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
            await grab('ctlT');
            ctl = await ev(`__lx.hueOff('ctlT', ${first ? "'P0T'" : "'P1T'"})`);
          } finally {
            await ev("window.__svCarryProbe = {}; 1"); await ev(`__cmwCam('L', ${JSON.stringify(camU)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          }
          r.comboControl = Object.assign(r.comboControl || {}, { [u]: ctl });
          comboCtl[u] = ctl;
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
        const ownTicks = async () => {
          const marks = await ev('__cmwLandTickMarks()');
          const own = JSON.parse(await ev(`JSON.stringify(__cmwLandTickMarks().map((m) => __cmwLandHeightOf(m.v)))`));
          const nz = marks.map((m, i) => i).filter((i) => own[i]);   // (a label at height 0 has no scale)
          return { marks, own, nz, bad: nz.filter((i) => !(relDiff(marks[i].hz, own[i]) <= TICK_H_TOL)) };
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
        if (first && camGap >= CAM_GAP_MIN) {
          // (the control: the labels are screen heights, so the camera plane 1 was parked with, in place of this frame's, moves them off the parked plane's)
          await ev(`__cmwCam('L', ${JSON.stringify(camP1)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          const pinned = await ev('__cmwLandTicks()');
          await ev(`__cmwCam('L', ${JSON.stringify(camU)}); 1`); await settled({ max: LOAD_MAX_MS }); await ev(rAF2);
          ok(`${t}: control: under plane 1's camera the tick labels are not the parked plane's (${pinned && pinned.length} against ${ref && ref.length}; one over ${TICK_PX} px)`,
            !!pinned && !!ref && (pinned.length !== ref.length || ref.some((y, i) => Math.abs(y - pinned[i]) > TICK_PX)), { pinned, ref });
        }
      }
      // the scale and the block's boost the frame is fitted with are the parked plane's at the ends, and not at the middle
      {
        const sc = await ev('__cmwLandScale()'), ref = first ? p0.scale : p1.scale;
        if (u === END_U || u === 1 - END_U) {
          ok(`${t}: the frame's scale and boost are the parked plane's (mu ${sc && sc.mu} against ${ref && ref.mu}, boost ${sc && sc.boost} against ${ref && ref.boost}; within ${SCALE_TOL})`,
            !!sc && !!ref && relDiff(sc.mu, ref.mu) <= SCALE_TOL && relDiff(sc.boost, ref.boost) <= SCALE_TOL, { sc, ref });
        } else if (u === GLIDE_MID && sc && ref) {
          ok(`${t}: the middle frame's scale is not the parked plane's (control; mu ${sc.mu} against ${ref.mu})`, relDiff(sc.mu, ref.mu) > SCALE_TOL, { sc, ref });
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
        // (a chain with a branch step (a root or a logarithm: branchPoints) solves its members in the log coordinate, so a member of it with none is a failure of the check, never a skipped step; chains with no branch step have no loops to read and are out of scope here)
        await ev(`window.__lxLogChain = ${brPts.length > 0}`);
        const prep = await ev('__lx.certPrep()');
        const certs = [];
        for (let k = 0; k < prep.pending; k++) certs.push(await ev(`__lx.certEdge(${k}, {})`));
        const cls = (x) => certs.filter((q) => q.cls === x).length, cells = new Set(certs.filter((q) => q.cls === 'branch').map((q) => q.cell.join(',')));
        const cc = { onCut: prep.onCut, seam: cls('seam'), branch: cls('branch'), falseN: cls('false'), unresolved: cls('unresolved'), cells: cells.size, why: certs.filter((q) => q.why).map((q) => q.why), fails: certs.filter((q) => q.fail).slice(0, 3).map((q) => q.fail) };
        cc.noWin = await ev('window.__lxNoWin');   // (members counted for want of window data: reported per row)
        cc.noWinWho = await ev('window.__lxNoWinWho');
        cc.cnt = await ev('window.__lxCnt');
        cc.orbit = await ev('window.__lxOrbit');   // (the roots a + kT the orbit enlargement tried: k(lam) against the vertex's cell, and whether Newton certified each)
        r[u].cutClasses = cc;
        ok(`${t}: every flagged edge at an end of its chord is on the step's cut (${cc.onCut}), a certified member seam (${cc.seam}) or a certified branch cell (${cc.branch} edges in ${cc.cells} cells); ${cc.falseN} are none and ${cc.unresolved} unresolved`, cc.falseN === 0 && cc.unresolved === 0, cc);
        ok(`${t}: no member is counted without window data (${cc.noWin}${cc.noWin ? ': ' + JSON.stringify(cc.noWinWho.slice(0, 3)) : ''})`, cc.noWin === 0, { noWin: cc.noWin, who: cc.noWinWho });
        ok(`${t}: every chain step read has a log coordinate to be shown a translation (${cc.cnt.noLam} have none)`, cc.cnt.noLam === 0, cc.cnt);
        ok(`${t}: no tracked member hit Newton's iteration cap (${cc.cnt.cap}) or asked for a convergence finer than float64 holds (${cc.cnt.floor})`, cc.cnt.cap === 0 && cc.cnt.floor === 0, cc.cnt);
        ok(`${t}: no point matches two members of a set (${cc.cnt.dbl}; ${cc.cnt.sepOne} identity tests on a set of one member, absolute form)`, cc.cnt.dbl === 0, cc.cnt);
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
        // the controls of the identity and the window data: the merge turned off returns the duplicate-member edges to unresolved, absolute tolerances certify none of the
        // uncertified edges, two members closer than the absolute tolerance stay two under the relative identity (and merge under the absolute one), and a sheet with its window
        // data removed is reported
        {
          let nOff = 0, nAbs = 0, nNone = 0;
          for (let k = 0; k < certs.length; k++) {
            if (certs[k].cls === 'seam' || certs[k].cls === 'branch') continue;
            nNone++;
            const nb = await ev(`__lx.certEdge(${k}, { noBJoin: true })`), ab = await ev(`__lx.certEdge(${k}, { absTol: true })`);
            if (nb.cls === 'unresolved') nOff++;
            if (ab.cls === 'seam' || ab.cls === 'branch') nAbs++;
          }
          bit.noBJoin += nOff;
          ok(`${t}: control: with absolute tolerances none of the ${nNone} uncertified edges certifies (${nAbs} do)`, nAbs === 0, { nAbs, nNone });
          const idc = await ev(`__lx.certEdge(0, { idCtl: ${JSON.stringify(SAME_PLACE)} })`);
          ok(`${t}: control: two members ${ID_CTL_SEP} apart in lam stay two under the relative identity (${idc.rel}) and merge under the absolute one (${idc.abs})`, idc.rel === 1 && idc.abs === 2, idc);
          const dw = await ev(`__lx.certEdge(0, { dropWin: ${JSON.stringify(SAME_PLACE)} })`);
          ok(`${t}: control: with a sheet's window data removed its member is counted without it (${dw.delta})`, dw.delta > 0, dw);
        }
        // the controls of the certificate's inputs: an edge whose second end has no certified member is unresolved, never a seam; counting the range-ramp members makes
        // the scene's count (the winding inside each sheet's window) disagree with the members, so some edge becomes unresolved; and a branch edge read with no loops
        // is not certified
        const kSeam = certs.findIndex((q) => q.cls === 'seam');
        if (kSeam >= 0) { const eb = await ev(`__lx.certEdge(${kSeam}, { emptyB: true })`); if (eb.cls === 'unresolved') bit.empty++; ok(`${t}: control: a seam edge whose second end has no certified member is unresolved (${eb.cls})`, eb.cls === 'unresolved', eb); }
        r[u].noSeam = kSeam < 0;
        if (kSeam < 0) ok(`${t}: control: this row has no seam edge to empty the second end of, as the row's list expects (${certs.length} edges)`, (`${c.tag}@${u}` in CTL_NA_ROWS.seam) && certs.every((q) => q.cls !== 'seam'), { n: certs.length });
        else ok(`${t}: control: a row with a seam edge is not on the list of rows that have none`, !(`${c.tag}@${u}` in CTL_NA_ROWS.seam), { n: certs.length });
        const rp = await ev(`__lx.rampPlace(${RAMP_LATTICE})`);
        if (rp) {
          ok(`${t}: control: a row with a ramp place is not on the list of rows that have none`, !(`${c.tag}@${u}` in CTL_NA_ROWS.ramp), { rp });
          const cOff = await ev(`__lx.certEdge(0, { countAt: ${JSON.stringify(rp)} })`), cOn = await ev(`__lx.certEdge(0, { countAt: ${JSON.stringify(rp)}, countRamp: true })`);
          if (cOff.n === cOff.N && cOn.n !== cOn.N) bit.ramp++;
          ok(`${t}: control: at a place with a range-ramp member (${JSON.stringify(rp)}) the certified members match the scene's count (${cOff.n} of ${cOff.N}) and with the ramp members counted they do not (${cOn.n})`, cOff.n === cOff.N && cOn.n !== cOn.N, { cOff, cOn });
        } else ok(`${t}: control: no place of a ${RAMP_LATTICE} x ${RAMP_LATTICE} lattice holds a range-ramp member, as the row's list expects`, (`${c.tag}@${u}` in CTL_NA_ROWS.ramp), null);
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
          const key = `${c.tag}@${u}`, noSyn = syn.cls === 'unresolved' && syn.why === 'syn' && syn.n.every((x) => x === 0) && syn.want.length === 0;
          let zNoBite = false;
          if (noSyn) {
            ok(`${t}: control: the made-up edge has no member at its end vertices (the scene counts none there: ${JSON.stringify(syn.want)}), as the row's list expects: ${CTL_NA_SYN.syn[key]}`, key in CTL_NA_SYN.syn, syn);
          } else {
            ok(`${t}: control: a row whose made-up edge has members at its ends is not on the list of rows that have none`, !(key in CTL_NA_SYN.syn), syn);
            ok(`${t}: a made-up edge in the cell that holds the branch value ${JSON.stringify(bv)} certifies a branch (${syn.cls}${syn.clear != null ? '; the branch value is ' + syn.clear.toFixed(2) + ' cells from the nearest loop path' : ''})`, syn.cls === 'branch', syn);
            ok(`${t}: control: with a wrong second member it certifies none (${synSw.cls})`, synSw.cls === 'false', synSw);
            ok(`${t}: control: with the loops moved ${MONO_DISPLACE} cells away some loop of every direction fails to hold the branch value (${synDp.loops} of ${LOOP_DIRS.length} still certify)`, synDp.cls === 'displaced' && synDp.loops < LOOP_DIRS.length, synDp);
            zNoBite = synZoff.cls === synZ.cls && synZ.cls === 'unresolved' && !!synZ.fail && !!synZoff.fail;
            if (zNoBite) ok(`${t}: control: in the z chart both runs (${synZoff.cls}, ${synZ.cls}) end before any step is judged for separation, as the row's list expects: ${CTL_NA_SYN.z[key]}`, key in CTL_NA_SYN.z, { synZ, synZoff });
            else {
              ok(`${t}: control: a row whose z-chart control runs is not on the list of rows where it cannot`, !(key in CTL_NA_SYN.z), { synZ, synZoff });
              ok(`${t}: control: in the z chart (steps near the branch value swap members) the verdict without the separation check (${synZoff.cls}) differs from the one with it (${synZ.cls})`, synZoff.cls !== synZ.cls, { synZ, synZoff });
              if (synZoff.cls !== synZ.cls) bit.zchart++;
            }
          }
          if (syn.cls === 'branch') {
            const synSh = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, shiftStep: true })`);
            if (synSh.cls === 'unresolved' && synSh.why === 'nonTranslate') bit.nonT++;
            const synNl = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, nullLam: true })`);
            if (synNl.cls === 'unresolved' && synNl.why === 'nonTranslate') bit.noLam++;
            const synNf = await ev(`__lx.certEdge(0, { syn: ${JSON.stringify(bv)}, nullFirst: true })`);
            ok(`${t}: control: with the first member of the chain having no log coordinate the made-up branch edge reads unresolved (${synNf.cls}, ${synNf.why})`, synNf.cls === 'unresolved' && synNf.why === 'nonTranslate', synNf);
            ok(`${t}: control: with one chain step's member having no log coordinate the made-up branch edge reads unresolved (${synNl.cls}, ${synNl.why})`, synNl.cls === 'unresolved' && synNl.why === 'nonTranslate', synNl);
            ok(`${t}: control: with one chain step shifted by one more T the made-up branch edge reads unresolved by its steps not being translations (${synSh.cls}, ${synSh.why})`, synSh.cls === 'unresolved' && synSh.why === 'nonTranslate', synSh);
          }
          r[u].synRead = { syn: syn.cls, swap: synSw.cls, zNoBite };
          if (!noSyn && synSw.cls === 'false') bit.synWrong++;
        }
        r[u].chains = await ev('window.__lxChain');   // ([forward chain, backward chain, kmax, reach capped] of each loop read that left the set both ways)
        r[u].orbitSyn = await ev('window.__lxOrbit');   // (the orbit roots the controls and the made-up edges tried, with the vertex cell: k(lam) against the branch cell)
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
      const ref = await ev(`__lxEnum(${JSON.stringify(vpts)}, ${sheets})`), noFront = await ev('window.__lxNoFront');
      ok(`${t}: the CPU reference (window.__cmwLandEnum) is readable: the frame is drawn by the inverse path`, Array.isArray(ref), null);
      ok(`${t}: the frame's draw data is readable (window.__cmwLandFrameVerts${carry && carry.path === 'mesh' ? ': frame on the mesh path, which has none' : ''})`, Array.isArray(got) && Array.isArray(cgot), carry);
      if (!Array.isArray(ref) || !Array.isArray(got) || !Array.isArray(cgot)) continue;
      const refN = ref.filter((x) => x.length).length;
      r[u] = Object.assign(r[u], { refPlaces: refN });
      ok(`${t}: the CPU reference finds preimages at a probe place (${refN} of ${pts.length})`, refN > 0, { refN });
      ok(`${t}: the hook marks the front member (front: true) at every place that has members; ${noFront} places without (the front member is the page's, never ordered here)`, noFront === 0, { noFront });
      {
        const ms = [];
        ref.forEach((l, i) => l.forEach((m) => { if (m.z && ms.length < HOM_MAX) ms.push({ z: m.z, cell: m.cell, src: m.src, digits: m.digits, miss: m.miss, miss2: m.miss2, lvl: m.lvl, sheet: m.sheet || 0, member: m.member, w: vpts[i] }); }));
        await ev(`window.__lxHomTol = ${HOM_TOL}; 1`);
        const mr = await ev(`__lxHomMiss(${JSON.stringify(ms)}, 0)`), mv = await ev(`__lxHomMiss(${JSON.stringify(ms)}, ${HOM_SHIFT})`), miss = mr.worst, moved = mv.worst;
        ok(`${t}: every enumerated member (${ms.length}) maps to its place under the frame's homotopy (window.__cmwLandHom) within ${HOM_TOL}`, ms.length > 0 && miss <= HOM_TOL, { miss, nBad: mr.nBad, n: ms.length, sample: mr.sample });
        ok(`${t}: the control: the places moved by ${HOM_SHIFT} are not matched by the homotopy (miss ${moved})`, moved > HOM_TOL, { moved });
        // (a member whose second-best surface is within SHEET_MARGIN times its residual is a lip member, listed and failed; a lone surface reads miss2 null)
        {
          const lip = ms.filter((m) => !(m.miss2 === null || m.miss2 > SHEET_MARGIN * m.miss));
          // (the frame's claimed sheet: the plan's label of each member goes with the scene's certified surface, a correspondence; the control relabels one member)
          const lc = labelConflicts(ms), srcs = new Set(ms.map((m) => m.src));
          ok(`${t}: every member's plan label goes with the surface the scene certifies it on (${lc.length} of ${ms.length} do not)`, lc.length === 0, { n: lc.length, sample: lc.slice(0, 3).map((m) => ({ z: m.z, plan: m.src, scene: m.sheet })) });
          if (srcs.size > 1) { const pick = ms.findIndex((m) => m.src !== ms[0].src), moved = ms.map((m, i) => (i === 0 ? Object.assign({}, m, { src: ms[pick].src }) : m)); ok(`${t}: the control: a member relabelled with another sheet's label is a mislabel`, labelConflicts(moved).length > 0, { n: labelConflicts(moved).length }); }
          // (the frame's own record of its claimed sheet, window.__cmwLandClaims: each drawn layer's whole claim, its step sheet then its forward shifts, decoded through the one decoder the frame composes its own sheet code with (GLR.ownCombo):
          // its step sheet is the one of the enumerator's sheet the layer's z belongs to, and the whole is a combo of the colour map at the layer's z with the layer's height)
          const claims = await ev(`__cmwLandClaims(${JSON.stringify(pts)})`), layersOf = (cl) => (cl || []).flat().filter((l) => l.layered), nMerged = ((claims || []).flat()).length - layersOf(claims).length;
          // (a colour map with one combo is that combo; with several, a layer below the colour map's saturation is told apart by its height, and one beyond it (the layer holds the true height, the colour map's is clipped
          // there as the parked frame draws it) agrees with the combo saturated on its side, which must be the only one there: with two or none the claim cannot be read and it fails)
          const fwdClaimOk = (l) => {
            if (l.opts.length === 0) return false;   // (no colour-map combo to read the claim against: it fails)
            if (l.opts.length === 1) return l.opts[0].combo === l.claim;
            const hi = l.h >= l.sat[1] - HEIGHT_TOL, lo = l.h <= l.sat[0] + HEIGHT_TOL;
            if (hi || lo) { const at = l.opts.filter((o) => o.h !== null && ((hi && o.h >= l.sat[1] - HEIGHT_TOL) || (lo && o.h <= l.sat[0] + HEIGHT_TOL))); return at.length === 1 && at[0].combo === l.claim; }
            return l.opts.some((o) => o.h !== null && Math.abs(o.h - l.h) <= HEIGHT_TOL && o.combo === l.claim);
          };
          // (a texel continued from an anchor (code CARRY_CONT_CODE plus the anchor's place) is read by where its anchor's own surface lands, continued from the anchor to the texel (CPU: the scene's
          // surfaces by value), against the surfaces that hold the texel's place; the claim rows read the others)
          const anchored = (l) => !!l.anchor && !!l.w && !!l.z, continued = (l) => l.code >= CONT_CODE_MIN;
          const claimBad = (cl) => layersOf(cl).filter((l) => !continued(l)).filter((l) => l.sceneShift === null || l.claimShift !== l.sceneShift || !fwdClaimOk(l));
          const nLayers = layersOf(claims).length, cBad = claimBad(claims);
          if (nLayers === 0) ok(`${t}: the frame is one merged frame of the step's sheets (${nMerged} drawn places): it claims no single sheet (not applicable; the All sheets rows read each layer's claim)`, nMerged > 0, { nMerged });
          else ok(`${t}: every drawn layer's claimed sheet is the sheet the scene certifies (${cBad.length} of ${nLayers} are not)`, cBad.length === 0, { n: cBad.length, sample: cBad.slice(0, CLAIM_SAMPLE) });
          {
            const cont = layersOf(claims).filter(anchored);
            if (cont.length) {
              const rs = await ev(`__lx.contLand(${JSON.stringify(cont.map((l) => ({ za: l.anchor.z, wa: l.anchor.w, zt: l.z, wt: l.w })))})`);
              const landsOn = (x) => x.ka.length === 1 && x.ks.length > 0 && x.kl.length > 0 && x.kl.every((k) => x.ks.includes(k));
              const bad = rs.filter((x) => !landsOn(x)), cross = rs.filter((x) => x.kl.length > 0 && !(x.kx.length > 0 && x.kx.every((k) => x.ks.includes(k)))), own = rs.filter((x) => x.ka.length === 1 && !x.ks.includes(x.ka[0]));
              ok(`${t}: every continued texel's anchor surface, continued from the anchor to the texel, lands on a surface that holds the texel's place (${bad.length} of ${cont.length} do not)`, bad.length === 0, { n: bad.length, sample: bad.slice(0, CLAIM_SAMPLE) });
              ok(`${t}: the control: an anchor across the cut lands elsewhere (${cross.length} of ${cont.length} texels)`, cross.length > 0, { cross: cross.length });
              ok(`${t}: the control: read as the layer's own surface, the continued texels are not on a surface that holds them (${own.length} of ${cont.length})`, own.length > 0, { own: own.length });
            }
          }
          // (a texel the cross-layer pass wrote (code CARRY_CONT_CODE, no anchor) holds the geometry of another layer's member, so that the two layers' copies of a surface piece coincide: it is read through the layer
          // that owns it, the one with an own texel at that place holding the same preimage and height, whose claim is the scene's sheet there; read as its own layer's claim it is the sheet beside it (control))
          {
            const rings = [];
            (claims || []).forEach((ls) => (ls || []).forEach((l) => { if (l.layered && continued(l) && !anchored(l) && l.z) rings.push({ l, own: (ls || []).find((o) => o !== l && o.layered && !continued(o) && o.z && Math.hypot(o.z[0] - l.z[0], o.z[1] - l.z[1]) <= RING_Z_TOL * (1 + Math.hypot(l.z[0], l.z[1])) && Math.abs(o.h - l.h) <= HEIGHT_TOL) }); }));
            if (rings.length) {
              const bad = rings.filter((x) => !x.own || x.own.sceneShift === null || x.own.claimShift !== x.l.sceneShift), asOwn = rings.filter((x) => x.l.claimShift !== x.l.sceneShift);
              ok(`${t}: every cross-layer texel (${rings.length}) is the geometry of a layer that owns it there, and that layer's claimed sheet is the scene's (${bad.length} are not)`, bad.length === 0, { n: bad.length, sample: bad.slice(0, CLAIM_SAMPLE).map((x) => ({ h: x.l.h, z: x.l.z, claim: x.l.claimShift, scene: x.l.sceneShift, own: x.own ? { claim: x.own.claimShift, member: x.own.member, h: x.own.h } : null })) });
              if (asOwn.length > 0) ok(`${t}: the control: read as its own layer's claim a cross-layer texel is the sheet beside it (${asOwn.length} of ${rings.length})`, true, { n: asOwn.length });
              else ok(`${t}: the control: every cross-layer texel's own layer claims the scene's sheet already, so reading it as its own layer's claim changes nothing (not applicable; ${rings.length} texels)`, rings.every((x) => x.l.claimShift === x.l.sceneShift), { n: rings.length });
            }
          }
          const bumpLayer = layersOf(claims).find((l) => l.nParts > 0);
          if (bumpLayer) { const bumped = await ev(`__cmwLandClaims(${JSON.stringify(pts)}, { layer: ${bumpLayer.member} })`), moved = claimBad(bumped).filter((l) => l.member === bumpLayer.member); ok(`${t}: the control: layer ${bumpLayer.member}'s claim one sheet off fails every layer of that member (${moved.length} fail)`, moved.length > 0, { moved: moved.length }); }
          else ok(`${t}: the control: no layer claims a sheet but the principal one: nothing to shift (not applicable)`, layersOf(claims).every((l) => l.nParts === 0), { n: nLayers });
          // (each member's scene-certified surface as the digits of the scene's own surface table, never the plan's label: the digits give the surface back (window.__cmwLandKOf) whose value at the member's z is the place it was found for,
          // and the digits with one moved give a surface whose value there is another place)
          {
            const sub = ms.slice(0, HOM_EQ_PAIRS), have = sub.filter((m) => Array.isArray(m.digits)).length;
            ok(`${t}: every member lists the digits of its scene-certified surface (${have} of ${sub.length})`, sub.length > 0 && have === sub.length, { have, n: sub.length });
            const r2 = await ev(`(() => {
              const ms = ${JSON.stringify(sub.filter((m) => Array.isArray(m.digits)).map((m) => ({ z: m.z, cell: m.cell, w: m.w, digits: m.digits })))};
              const val = (m, ds) => { const k = __cmwLandKOf(ds); return k === null ? null : __cmwLandScene(m.z, k, m.cell); };
              const agree = (v, f) => !!v && !!f && Math.hypot(v[0] - f[0], v[1] - f[1]) <= ${SURF_TOL} * (1 + Math.hypot(f[0], f[1]));
              let back = 0, moved = 0, tried = 0;
              for (const m of ms) {
                if (agree(val(m, m.digits), m.w)) back++;
                for (let i = 0; i < m.digits.length; i++) {
                  const ds = m.digits.slice(); ds[i] += 1;
                  const v = val(m, ds);
                  if (v) { tried++; if (!agree(v, m.w)) moved++; break; }
                }
              }
              return { back, moved, tried };
            })()`);
            const { back, moved, tried } = r2;
            ok(`${t}: the digits round-trip through the scene's surface table to the member's place (${back} of ${have})`, have > 0 && back === have, { back, have });
            ok(`${t}: the control: one digit moved gives another place than the member's (${moved} of ${tried} members)${ctlNA(c, 'digits', u) ? ' (not applicable: ' + ctlNA(c, 'digits', u) + ')' : ''}`, tried === 0 ? !!ctlNA(c, 'digits', u) : moved > 0 && !ctlNA(c, 'digits', u), { moved, tried, na: ctlNA(c, 'digits', u) });
          }
          const hs = await ev(`(__cmwLandHom([${HOM_PLACE}], null, { sheets: [0], dH: false }) || [{}])[0].H || null`);
          r.homSample = Object.assign(r.homSample || {}, { [u]: hs });
          const before = Object.keys(r.homSample).map(Number).filter((x) => x < u).sort((x, y) => y - x)[0];
          if (before !== undefined) ok(`${t}: the scene the hook reads follows u (H at a fixed place differs from the frame at u = ${before})`, !!hs && !!r.homSample[before] && (hs[0] !== r.homSample[before][0] || hs[1] !== r.homSample[before][1]), { hs, last: r.homSample[before] });
          ok(`${t}: no certified member is a lip member (a second surface within ${SHEET_MARGIN} x its residual; ${lip.length} are)`, lip.length === 0, { n: lip.length, sample: lip.slice(0, 3).map((m) => ({ z: m.z, sheet: m.sheet, miss: m.miss, miss2: m.miss2 })) });
          // (the scene-side strip: the first branch step's input, continued from the member's cell, is inside the step's window; read as principal, the members
          // outside it are flagged. The members within STRIP_TOL of the window's end are lip members, listed)
          const st = await ev(`${JSON.stringify(ms)}.map((m) => __cmwLandStrip(m.z, m.cell, m.sheet))`), sp = await ev(`${JSON.stringify(ms)}.map((m) => __cmwLandStrip(m.z, m.cell, m.sheet, true))`);
          if (Array.isArray(st) && st.some((x) => x)) {
            const sTol = STRIP_TOL / (2 * Math.PI), at = ms.map((m, i) => [m, st[i], sp[i]]).filter(([, x]) => x);
            const out = at.filter(([, x]) => x.bad || !(x.s > sTol && x.s <= 1 - sTol)), edge = at.filter(([, x]) => !x.bad && (Math.abs(x.s) <= sTol || Math.abs(x.s - 1) <= sTol)), moved = at.filter(([, x, y]) => !x.bad && Math.abs(x.arg - y.arg) > STRIP_TOL);
            const flagged = moved.filter(([, , y]) => y.bad || !(y.s > sTol && y.s <= 1 - sTol)).length;
            ok(`${t}: every member's continued argument is inside its step's window (${out.length} of ${at.length} are not; ${edge.length} within ${STRIP_TOL} of its end, lip members, failed)`, out.length === 0 && edge.length === 0, { n: out.length, sample: out.slice(0, 3).map(([m, x]) => ({ z: m.z, sheet: m.sheet, s: x.s, bad: x.bad })), edge: edge.length });
            if (moved.length) ok(`${t}: the control: the principal argument flags the members the continuation moved (${flagged} of ${moved.length})`, flagged > 0 && !ctlNA(c, 'strip', u), { flagged, moved: moved.length, na: ctlNA(c, 'strip', u) });
            else ok(`${t}: the control: the principal argument flags the members the continuation moved: none moved${ctlNA(c, 'strip', u) ? ' (not applicable: ' + ctlNA(c, 'strip', u) + ')' : ''}`, !!ctlNA(c, 'strip', u), { moved: 0 });
          } else ok(`${t}: the scene's strip check: the scene has no branch step to read${ctlNA(c, 'stripRead', u) ? ' (not applicable: ' + ctlNA(c, 'stripRead', u) + ')' : ''}`, !!ctlNA(c, 'stripRead', u), { st: Array.isArray(st) });
        }
        // (each member is judged on its own sheet: read on the next surface it is not a preimage of its place wherever the sheets differ there)
        const sheetsDiffer = ms.length > 0 && (await ev(`__cmwLandHom(${JSON.stringify(ms[0].z)}, ${JSON.stringify(ms[0].cell)})`) || []).length > 1;
        if (sheetsDiffer) { const wr = await ev(`__lxHomMiss(${JSON.stringify(ms)}, 0, true)`); ok(`${t}: the control: the members read on the next sheet are not matched (miss ${wr.worst})`, wr.worst > HOM_TOL && !ctlNA(c, 'sheets', u), { worst: wr.worst, na: ctlNA(c, 'sheets', u) }); }
        else ok(`${t}: the control: the members read on the next sheet: the scene has one surface${ctlNA(c, 'sheets', u) ? ' (not applicable: ' + ctlNA(c, 'sheets', u) + ')' : ''}`, !!ctlNA(c, 'sheets', u), { surfaces: 1 });
        // (a member of the range ramp, lvl < 0, is just outside its sheet's window: every member is within the ramp, and a ramp of 0 flags those that are outside)
        const ramp = await ev('__cmwLandRamp()'), nRamp = ms.filter((m) => m.lvl < 0).length, out = ms.filter((m) => !(m.lvl >= -ramp)).length;
        ok(`${t}: every enumerated member is within the range ramp (lvl >= -${ramp}); ${nRamp} of ${ms.length} are in it`, out === 0, { out, ramp, nRamp });
        // (the control on the check itself: one member moved RAMP_CTL_STEP levels past the ramp is flagged, whether or not the row has a ramp member)
        const rampOut = (arr) => arr.filter((m) => !(m.lvl >= -ramp)).length, pushed = ms.map((m, i) => (i === 0 ? Object.assign({}, m, { lvl: -ramp - RAMP_CTL_STEP }) : m));
        ok(`${t}: the control: a member ${RAMP_CTL_STEP} level past the ramp is flagged (${rampOut(pushed)} flagged; ${out} before it)`, ms.length > 0 && rampOut(pushed) > 0, { flagged: rampOut(pushed), out });
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
            for (const r of wr || []) { nChecked++; if (!r.ok) { nBadW++; if (badW.length < 4) badW.push(Object.assign({ place: vpts[i], list: (await ev(`__cmwLandMembers([${JSON.stringify(vpts[i])}])`) || [[]])[0].map((m) => ({ z: m.z, k: m.k, own: m.own, front: m.front, miss: m.miss })), surf: await ev(`__cmwLandHom(${JSON.stringify(((await ev(`__cmwLandMembers([${JSON.stringify(vpts[i])}])`) || [[]])[0][0] || { z: [0, 0] }).z)})`) }, r)); } }
          }
          const sing = nBadW ? await ev('__cmwLandSing()') : null;
          ok(`${t}: the completeness count: the winding of the scene's homotopy plus the poles equals the certified members, over the leaves of the box at ${pick.length} places (${nChecked} counts)`, nChecked > 0 && nBadW === 0, { nBadW, nChecked, badW, sing });
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
            ok(`${t}: the control: a place near the boundary is unresolved, not counted`, !!near && near.some((r) => r.status === 'unresolved' || r.status === 'onContour'), { near });
            if (c.logControl) {
              const lw = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`), r0 = lw && lw[0];
              // (the box holds the branch point 0: the leaf it is in is reported at every u; near the log itself G is huge there and the shrinking rim's values do not converge, so the count must say branchLog or kindDisagree, never ok)
              ok(`${t}: the control: the branch leaf at 0 is reported (${r0 ? r0.branchLeaves : '?'} leaves, status ${r0 ? r0.status : '?'})`, !!r0 && r0.branchLeaves > 0 && (u < 1 - 2 * END_U || r0.status === 'branchLog' || r0.status === 'kindDisagree'), { lw });
            }
            if (c.surfaces) {
              // (the surfaces that are distinct functions: a repeated sheet is counted once, and no distinct one is dropped)
              const sf = await ev(`__cmwLandSurfaces()`);
              const want = (c.surfacesAt && c.surfacesAt[u]) || c.surfaces;   // (the path's exponent 1 - 2u/3 is 1/2 at u = 0.75: the root's three sheets are two functions there)
              ok(`${t}: the distinct surfaces are ${want} of ${sf ? sf.K : '?'}`, !!sf && sf.distinct === want, { sf });
              // (the box holds the branch point: the leaf is reported; the leaves the continuity alone would have closed are counted beside it)
              const sn = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`), bl = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noInputs: true })`);
              ok(`${t}: the branch leaf is reported (${sn && sn[0] ? sn[0].branchLeaves : '?'} leaves; ${bl && bl[0] ? bl[0].branchLeaves : '?'} by the continuity alone)`, !!sn && !!sn[0] && sn[0].branchLeaves > 0, { sn, bl });
            }
            if (c.polePair) {
              // (the map of both steps, a Möbius map and the root of its value: a leaf that holds a zero (i) and the pole (-i) of the root's input winds
              // it 0 times, so only the pole test makes it a branch leaf: with the pole test and the continuity test left out its loop is judged by the
              // reach of the input's argument alone and is 'crossed'. No glide is needed, the scene is read of that map)
              const q = c.polePair, a0 = `${q.x[0]}, ${q.x[1]}, ${q.y[0]}, ${q.y[1]}`;
              const withP = await ev(`__cmwLandLeafState(${a0}, { map: ${JSON.stringify(q.map)} })`), noP = await ev(`__cmwLandLeafState(${a0}, { map: ${JSON.stringify(q.map)}, noPoleTest: true, noContinuity: true })`);
              ok(`${t}: the control: a leaf with a zero and a pole of the root's input is a branch leaf (${withP}), and not one without the pole test (${noP})`, withP === 'branch' && noP !== 'branch', { withP, noP });
            }
            if (c.rayControl && u === CUT_PROBE_U) {
              // (z^3 - 1 at a small t is the power z^(1 + 2t) with its cut on the negative real axis: a place the cut's two sides both cover has two members, and a count that
              // cuts no leaf at that ray counts one)
              let nBadR = 0;
              for (const i of pick) { const wr = await ev(`__cmwLandWind(${JSON.stringify(vpts[i])}, { noRay: true })`); if (wr && wr.some((r) => !r.ok)) nBadR++; }
              ok(`${t}: the control: a count that does not cut the leaves at the ray of the power path's cut breaks at u = ${u} (${nBadR} of ${pick.length} places)`, nBadR > 0, { nBadR });
            }
            if (c.dipole) {
              // (a dipole of the root's input, a zero and a pole close together, far from which the input is about 1: a leaf round both, off-centre so that its centre's value is not the dipole's -1, winds the input 0 times and
              // its loop never meets the cut ray, so with the pole test left out the leaf would count as closed without a word; with it, it is a branch leaf)
              const q = c.dipole, a0 = `${q.x[0]}, ${q.x[1]}, ${q.y[0]}, ${q.y[1]}`;
              const withP = await ev(`__cmwLandLeafState(${a0}, { map: ${JSON.stringify(q.map)} })`), noP = await ev(`__cmwLandLeafState(${a0}, { map: ${JSON.stringify(q.map)}, noPoleTest: true })`);
              ok(`${t}: the control: a leaf round a zero and a pole of the root's input is a branch leaf (${withP}), and closed without the pole test (${noP})`, withP === 'branch' && noP === 'closed', { withP, noP });
            }
            if (c.dipole && u === GLIDE_MID) {
              // (a rational step after the root (1/z) may carry poles the scene does not read: its map's counts are unresolved, never closed on a pole list that may be short)
              const un2 = await ev(`__cmwLandPolesUnread(${JSON.stringify(c.dipole.map)})`), un3 = await ev(`__cmwLandPolesUnread(${JSON.stringify(Object.assign({}, c.dipole.map, { hi: 3 }))})`);
              ok(`${t}: the poles of the Möbius and the root are read (${JSON.stringify(un2)}), those of the reciprocal after them are not (${JSON.stringify(un3)})`, Array.isArray(un2) && un2.length === 0 && Array.isArray(un3) && un3.includes('recip'), { un2, un3 });
            }
            if (c.dipole && u === GLIDE_MID) {
              // (the exact zero of the root's input, read from the Möbius matrix: -b / a, here 0.1i; a leaf round it is a branch leaf and one shifted by ZERO_SHIFT is closed; a list dropped is short; no step before the branch step gives the node, and a chain of two steps is read by no definition: unread)
              const q = c.dipole, zs = await ev(`__cmwLandZeros(${JSON.stringify(q.map)})`), zd = await ev(`__cmwLandZeros(${JSON.stringify(q.map)}, true)`);
              const z0 = zs && zs.zeros[0], near = (zr, x, y) => Math.hypot(zr[0] - x, zr[1] - y) <= ZERO_TOL;
              ok(`${t}: the exact zero of the root's input is read from the Möbius matrix (${JSON.stringify(zs && zs.zeros)}, unread ${JSON.stringify(zs && zs.unread)})`, !!z0 && zs.zeros.length === 1 && near(z0, 0, 0.1) && zs.unread.length === 0, { zs });
              if (z0) {
                const at = (dx) => `__cmwLandLeafState(${z0[0] + dx - ZERO_BOX}, ${z0[0] + dx + ZERO_BOX}, ${z0[1] - ZERO_BOX}, ${z0[1] + ZERO_BOX}, { map: ${JSON.stringify(q.map)} })`;
                const on = await ev(at(0)), off = await ev(at(ZERO_SHIFT));
                ok(`${t}: the control: a leaf round the exact zero is a branch leaf (${on}) and one shifted by ${ZERO_SHIFT} is closed (${off})`, on === 'branch' && off === 'closed', { on, off });
              }
              ok(`${t}: the control: the list dropped leaves no zero (${zd && zd.zeros.length} against ${zs && zs.zeros.length})`, !!zd && !!zs && zd.zeros.length < zs.zeros.length, { zd, zs });
              const MOB = { id: 'mobius', m: [[1, 0], [0, -0.1], [1, 0], [0, 0.1]] };
              const z1 = await ev(`__cmwLandZerosOf([], [0, 0])`), z2 = await ev(`__cmwLandZerosOf(${JSON.stringify([MOB])}, [0, 0])`), z3 = await ev(`__cmwLandZerosOf(${JSON.stringify([MOB, { id: 'recip' }])}, [0, 0])`);
              ok(`${t}: the zero of an input with no step before it is the node (${JSON.stringify(z1)}), after a Möbius step it is its inverse at the node (${JSON.stringify(z2)}), and after two steps it is unread (${JSON.stringify(z3)})`, Array.isArray(z1) && near(z1, 0, 0) && Array.isArray(z2) && near(z2, 0, 0.1) && z3 === 'unread', { z1, z2, z3 });
              ok(`${t}: the control: a zero shifted by ${ZERO_SHIFT} is not the Möbius step's inverse at the node`, Array.isArray(z2) && !near([z2[0] + ZERO_SHIFT, z2[1]], 0, 0.1), { z2 });
            }
            if (c.tag === 'Möbius, √' && u === GLIDE_MID) {
              // (the lift's branch point, the root's input zero past the glide's span: z = i at every u, drawn at w = H_u(i) through the scene's g, which moves with u; the list dropped is empty; a non-Möbius step before the root is unread)
              const lz = async (tt, drop) => ev(`__cmwLandLiftZeros({ mode: 1, base: 0, hi: 1, t: ${tt} }${drop ? ', true' : ''})`);
              const lm = await lz(GLIDE_MID), la = await lz(MID_U[0]), ld = await lz(GLIDE_MID, true);
              const ch = await ev(`__cmwLandZerosOf([{ id: 'recip' }], [0, 0])`);
              const isI = (r) => !!r && r.zeros.length === 1 && Math.hypot(r.zeros[0][0], r.zeros[0][1] - 1) <= ZERO_TOL && r.unread.length === 0;
              ok(`${t}: the lift's branch point is i at u = ${MID_U[0]} and ${GLIDE_MID} (${JSON.stringify(la && la.zeros)}, ${JSON.stringify(lm && lm.zeros)})`, isI(la) && isI(lm), { la, lm });
              const hm = lm && isI(lm) ? lm.zeros[0] : null, ha = la && isI(la) ? la.zeros[0] : null;
              ok(`${t}: the branch point is drawn at w = H_u(i) (${JSON.stringify(hm && hm.slice(3))} at u = ${GLIDE_MID}) and w moves with u (${JSON.stringify(ha && ha.slice(3))} at u = ${MID_U[0]})`, !!hm && !!ha && hm[3] !== null && Math.hypot(hm[3] - ha[3], hm[4] - ha[4]) > ZERO_MOVE_MIN, { hm, ha });
              ok(`${t}: the control: the list dropped is empty (${ld && ld.zeros.length}) and a step that is not a Möbius step before the root is unread (${JSON.stringify(ch)})`, !!ld && ld.zeros.length === 0 && ch === 'unread', { ld, ch });
            }
            if (c.tag === 'Möbius, √' && u === GLIDE_MID) {
              // (the lift's pole: where the value entering the root is infinity, the Möbius step's -d / c = -i at every u, drawn at w = H_u(-i) which moves with u; the list dropped is empty; no step before it has no pole, a non-Möbius step is unread)
              const lp = async (tt, drop) => ev(`__cmwLandLiftPoles({ mode: 1, base: 0, hi: 1, t: ${tt} }${drop ? ', true' : ''})`);
              const pm = await lp(GLIDE_MID), pa = await lp(MID_U[0]), pd = await lp(GLIDE_MID, true);
              const MOB_SQRT = { id: 'mobius', m: [[1, 0], [0, -1], [1, 0], [0, 1]] };   // (the case's Möbius step: a = 1, b = -i, c = 1, d = i)
              const p0 = await ev('__cmwLandPolesOf([])'), p1 = await ev(`__cmwLandPolesOf(${JSON.stringify([MOB_SQRT])})`), p2 = await ev(`__cmwLandPolesOf(${JSON.stringify([MOB_SQRT, { id: 'recip' }])})`);
              const isMinusI = (r) => !!r && r.poles.length === 1 && Math.hypot(r.poles[0][0], r.poles[0][1] + 1) <= ZERO_TOL && r.unread.length === 0;
              ok(`${t}: the lift's pole is -i at u = ${MID_U[0]} and ${GLIDE_MID} (${JSON.stringify(pa && pa.poles)}, ${JSON.stringify(pm && pm.poles)})`, isMinusI(pa) && isMinusI(pm), { pa, pm });
              const wm = pm && isMinusI(pm) ? pm.poles[0] : null, wa = pa && isMinusI(pa) ? pa.poles[0] : null;
              ok(`${t}: the pole is drawn at w = H_u(-i) (${JSON.stringify(wm && wm.slice(3))} at u = ${GLIDE_MID}) and w moves with u (${JSON.stringify(wa && wa.slice(3))} at u = ${MID_U[0]})`, !!wm && !!wa && wm[3] !== null && Math.hypot(wm[3] - wa[3], wm[4] - wa[4]) > ZERO_MOVE_MIN, { wm, wa });
              ok(`${t}: the control: the list dropped is empty (${pd && pd.poles.length}), no step before the root has no pole (${JSON.stringify(p0)}), a Möbius step's is -d / c (${JSON.stringify(p1)}) and a step that is not a Möbius step before the root is unread (${JSON.stringify(p2)})`, !!pd && pd.poles.length === 0 && p0 === null && Array.isArray(p1) && Math.hypot(p1[0], p1[1] + 1) <= ZERO_TOL && p2 === 'unread', { pd, p0, p1, p2 });
            }
            if (c.tag === 'Möbius, √' && u === GLIDE_MID) {
              // (w is H_u(z) through the scene's g at the current u: the hook's w at this u is the homotopy hook's value at z = i on the own surface)
              const cur = await ev('__cmwLandLiftZeros()'), hh = await ev('__cmwLandHom([0, 1], null, { sheets: [0], dH: false })');
              ok(`${t}: w is the scene's H_u(i) (${JSON.stringify(cur && cur.zeros[0] && cur.zeros[0].slice(3))} against ${JSON.stringify(hh && hh[0].H)})`, !!cur && cur.zeros.length === 1 && !!hh && !!hh[0].H && Math.hypot(cur.zeros[0][3] - hh[0].H[0], cur.zeros[0][4] - hh[0].H[1]) <= ZERO_TOL, { cur, hh });
            }
            if (c.dipole && u === MID_U[1]) {
              // (the dipole's pole lies between the pole search's grid points: with the pole read from the Möbius matrix the count is right, without it the closed leaf's winding is a zero less a pole)
              const dp = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { noExactPoles: true })`), pn = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, {})`);
              ok(`${t}: the count is right with the pole read from the Möbius matrix (${pn && pn[0] ? pn[0].P : '?'} poles), and wrong without it (${dp && dp[0] ? dp[0].N : '?'} against ${dp && dp[0] ? dp[0].members : '?'} members)`, !!pn && pn.every((r) => r.ok) && !!dp && dp.some((r) => !r.ok), { pn, dp });
              const ps = await ev(`__cmwLandWind(${JSON.stringify(vpts[i0])}, { poleShift: ${POLE_SHIFT} })`);
              ok(`${t}: the control: the pole moved by ${POLE_SHIFT} breaks the count (${ps && ps[0] ? ps[0].N : '?'} against ${ps && ps[0] ? ps[0].members : '?'} members)`, !!ps && ps.some((r) => !r.ok), { ps });
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
        const wantAll = ref[i] || [], haveAll = distinctLayers(got[i] || []);
        if (!wantAll.length) return;   // (a place with no preimage in the reference is not compared; the reference's own check says it finds some)
        // (the reference lists a member once per forward combo or sheet that lands on the same z and height; the frame draws it once, so distinctLayers counts both sides)
        const want = sheets ? distinctLayers(wantAll) : wantAll.slice(0, 1);   // (sheets off: the front member, the enumerator's first)
        n++;
        const same = sheets ? sameLayers(haveAll, want) : frontSame(haveAll, wantAll);
        if (!same) { bad++; if (at.length < 4) at.push({ p, want: want.map((x) => x.z), have: haveAll.map((x) => x.z) }); return; }
        // (every member the layers match by z, on a side sheet or on the real axis too: the drawn height and the colour)
        want.forEach((m) => {
          const l = haveAll.filter((x) => sameZ(x.z, m.z)).sort((p, q) => Math.abs(p.h - m.h) - Math.abs(q.h - m.h))[0];   // (the layer at its z nearest in height: sheets of a step share z)
          if (!l) return;
          const g = layerGap(l, m, NEAR_U.includes(u) ? { h: NEAR_TOL, ph: NEAR_TOL } : undefined);
          if (g.h) { hBad++; if (atH.length < 4) atH.push({ p, have: l.h, want: m.h }); }
          if (g.noF) { noF++; return; }
          if (g.phN) phN++;
          if (g.ph) { badPh++; if (atPh.length < 4) atPh.push({ p, have: l.f, want: m.f }); }
        });
      });
      r[u].geometry = { n, bad, at, phN, badPh, noF, hBad };
      (HIST[name] = HIST[name] || {})[u] = pts.map((p, i) => ({ have: got[i] && got[i][0] ? got[i][0].h : null, want: ref[i] && ref[i][0] ? ref[i][0].h : null }));
      // (Ruling C controls) a frame drawn at the wrong u is told apart by NEAR_TOL: the frame at REVERSED_FROM against the reference at 1 - REVERSED_FROM
      // (u reversed), and against the reference at the glide's middle (u frozen there), each more than NEAR_TOL off at some place
      if (u === 1 - REVERSED_FROM && HIST[name][REVERSED_FROM] && HIST[name][GLIDE_MID]) {
        const worst = (from, to) => from.reduce((a2, h, i) => (h.have !== null && to[i] && to[i].want !== null ? Math.max(a2, Math.abs(h.have - to[i].want)) : a2), 0);
        const rev = worst(HIST[name][REVERSED_FROM], HIST[name][u]), froz = worst(HIST[name][REVERSED_FROM], HIST[name][GLIDE_MID]);
        ok(`${t}: the control: a frame drawn at u = ${REVERSED_FROM} is over ${NEAR_TOL} off the reference at the reversed u (${rev})`, rev > NEAR_TOL, { rev });
        ok(`${t}: the control: a frame drawn at u = ${REVERSED_FROM} is over ${NEAR_TOL} off the reference at u frozen at ${GLIDE_MID} (${froz})`, froz > NEAR_TOL, { froz });
      }
      // (control) the farthest member marked front: at the places where that is another z than the nearest, the frame's front is not the reference's
      if (!sheets && !r.farFront && ref.some((l) => l.length > 1)) {
        let far = null;
        try { await ev('window.__cmwLandFarFront = true; 1'); far = await ev(`__lxEnum(${JSON.stringify(vpts)}, false)`); } finally { await ev('window.__cmwLandFarFront = false; 1'); }
        const moved = Array.isArray(far) ? pts.map((p, i) => i).filter((i) => (far[i] || []).length > 1 && !sameZ(far[i][0].z, ref[i][0].z)) : [];
        if (moved.length) {
          const nBad = moved.filter((i) => !frontSame(got[i] || [], far[i])).length;
          r.farFront = nBad;
          ok(`${t}: the control: with the farthest member marked front the frame's front is not the reference's (${nBad} of ${moved.length} places where it is another z)`, nBad > 0, { nBad, moved: moved.length });
        }
      }
      if (!sheets && u === 1 - END_U) ok(`${t}: the control: the farthest member marked front ran at some u${ctlNA(c, 'farFront') ? ' (not applicable: ' + ctlNA(c, 'farFront') + ')' : ''}`, r.farFront === undefined ? !!ctlNA(c, 'farFront') : r.farFront > 0 && !ctlNA(c, 'farFront'), { nBad: r.farFront, na: ctlNA(c, 'farFront') });
      // the coverage: the places the frame draws against the places the reference covers
      const cref = await ev(`__lxEnum(${JSON.stringify(cw)}, false)`);   // (a place is covered when the enumerator has a member there)
      const cd = coverDiff(cgot.map((x) => !!(x && x.length)), cref.map((x) => x.length > 0));
      r[u].coverage = cd;
      // the exact image reference: the frame's relief against the raster of the reference's members, at this u
      const rl = await ev('JSON.stringify(window.__cmwLandRelief ? __cmwLandRelief() : null)');
      // (the lattice is refined, REF.depth up to REF.depthMax, until REF.calm consecutive levels change no checked pixel (a feature thinner than a
      // cell shows first at a deeper level): conv is the last pair's distance, firstConv the first pair's, calm the unchanged levels in a row; the
      // frame is judged against the finest. A reference not converged at depthMax fails)
      const { rk, conv, firstConv, calm, depth, drift } = await refine(sheets, REF);
      r[u].raster = rk;
      ok(`${t}: the frame's relief is the exact map's, a coverage raster of ${rk ? rk.w + ' x ' + rk.h : '?'} half-resolution pixels (${rk ? rk.extra : '?'} extra, ${rk ? rk.missing : '?'} missing of ${rk ? rk.n : '?'}; at most ${RASTER_TOL * 100} % off, ${REF.slack} pixel slack; reference complete: ${rk ? !rk.capped : '?'})`, !!rl && !!rk && !rk.capped && rk.off <= RASTER_TOL, { rl, rk });
      ok(`${t}: the reference's places keep their coordinates in the shared cache (${drift} drifted)`, drift === 0, { drift });
      ok(`${t}: the reference is converged: ${REF.calm} levels in a row change no pixel within ${REF.slack} (depth ${rk ? rk.depth : '?'} of at most ${REF.depthMax}; last pair off ${conv}, first pair ${firstConv})`, !!rk && calm >= REF.calm, { depth: rk && rk.depth, conv, firstConv, calm });
      if (c.tag === 'cube root' && u === MID_U[0]) {
        // the control: with every cross-sheet edge taken as continuous (probe noCross) the whole triangles across the cuts between sheets
        // come back as slivers, and the relief check fails
        const ctl = await withProbe({ noCross: true }, u, async () => (await refine(sheets, REF)).rk);
        ok(`${t}: control: with every cross-sheet edge taken as continuous the relief is over ${RASTER_TOL * 100} % off (${ctl ? ctl.extra : '?'} extra, ${ctl ? ctl.missing : '?'} missing of ${ctl ? ctl.n : '?'})`, !!ctl && ctl.off > RASTER_TOL, { ctl });
      }
      if (CACHE_CTL_TAGS.includes(c.tag) && u === 0.002 && (sheets || c.tag === 'Roots as preimages')) {
        // the shared cache of the depths of a refine gives the single run's mask, conv, places and cap at every depth; a refine after another starts empty
        const cc = await cacheControl(sheets, 0);
        ok(`${t}: the shared cache gives the single run's mask, conv, places and cap at every depth (${cc.length} depths; places shared/single ${cc.map((r) => (r.places ? r.places[0] + '/' + r.places[1] : '?')).join(', ')})`, cacheControlOk(cc), { cc });
        const sz = await ev('window.__lxShared.size');
        const re = await refine(sheets, Object.assign({}, REF, SHALLOW));
        ok(`${t}: control: a refine after another starts with an empty cache (${re.startSize} places; the last one's held ${sz})`, sz > 0 && re.startSize === 0, { sz, start: re.startSize });
        if (c.tag === 'Roots as preimages') {
          const cb = await cacheControl(sheets, CACHE_CTL_EVERY);
          ok(`${t}: the control: with every ${CACHE_CTL_EVERY}th place of the shared cache emptied a later depth's mask is not the single run's`, cb.some((r) => !r.same), { cb });
        }
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
    // (the combo control, judged over the row: the colour map's most distinct sheet combos at any u of it. With one, a combo one off is the same colour: the control cannot bite there and must not (a bite is a
    // contradiction); with two or more it must bite at every near end)
    {
      const nMax = Math.max(0, ...Object.values(comboN));
      for (const u of Object.keys(comboCtl).map(Number)) {
        const ctl = comboCtl[u], one = nMax <= 1, tt = `${name}, u=${u}`;
        if (ctl && typeof ctl === 'object') { ok(`${tt}: control: not applicable: the glide's map has ${ctl.na} surface at u = ${u} (window.__cmwLandSceneCombos): its value under combo 1 differs from combo 0's by at most ${ctl.diff ? ctl.diff.worst : '?'} (relative, over ${ctl.diff ? ctl.diff.n : 0} places; at most ${COMBO_NA_TOL})`, ctl.na <= 1 && !!ctl.diff && ctl.diff.n > 0 && ctl.diff.worst <= COMBO_NA_TOL, ctl); continue; }
        ok(`${tt}: control: with every sheet's combo one off the Top view's hue at u = ${u} is ${one ? 'not over ' + HUE_OFF_MAX + ' (not applicable: the colour map has at most ' + nMax + ' distinct sheet combo over the row, window.__cmwLandRefSheets)' : 'over ' + HUE_OFF_MAX + ' (' + nMax + ' distinct sheet combos over the row)'} pixels off (${ctl} are)`, one ? ctl <= HUE_OFF_MAX : ctl > HUE_OFF_MAX, { ctl, nMax, comboN });
      }
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
  if (capBit.rows) {
    ok(`control: the cap row's clip-off control bit on some row (${capBit.c1} of ${capBit.rows} rows)`, capBit.c1 > 0, capBit);
    ok(`control: the cap row's lowest-pixel sampling fell on some row (${capBit.c2fell} rows)`, capBit.c2fell > 0, capBit);
    if (!process.env.CMW_ONLY) ok(`control: the clip-off count with the lowest pixels is 0 on some case (${JSON.stringify(capCase)})`, Object.values(capCase).some((k) => k.top > 0 && k.low === 0), capCase);
  }
  ok(`control: the emptied-second-end control bit on some row (${bit.empty} rows)`, bit.empty > 0, bit);
  ok(`control: the ramp-count control bit on some row (${bit.ramp} rows)`, bit.ramp > 0, bit);
  ok(`control: the no-log-coordinate check bit on some row (${bit.noLam} rows)`, bit.noLam > 0, bit);
  ok(`control: the translation check bit on some row (${bit.nonT} rows)`, bit.nonT > 0, bit);
  ok(`control: the z-chart control bit on some row (${bit.zchart} rows)`, bit.zchart > 0, bit);
  ok(`control: the wrong-second-member control of the made-up edge bit on some row (${bit.synWrong} rows)`, bit.synWrong > 0, bit);
  ok(`control: with the carried member's merge turned off at least ${NOBJOIN_MIN} edges are unresolved (${bit.noBJoin})`, bit.noBJoin >= NOBJOIN_MIN, bit);
  return { pass: !fails.length, fails, info };
})

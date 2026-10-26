# Landscape walls, round 3: as built

2026-10-26. Built in `work/xvls` on round 2 (frozen at `work/xvls-final-snap`). Changed: `src/gl.js` (the landscape's
fragment stage, the refinement's motion path, level reads, program start-up), `src/app.js` (one flag: the step cards'
Landscape says it is a card), `test/landscape_walls_cmd.js` (a motion part, cold opens with All sheets, fresh formulas).
No new visible strings. Perf baselines, `accepted.json` and golden images untouched.

## The three blockers

### 1. Walls while the deformation plays: as clean as at rest

- **Cause.** While something moves, the walls are refined less (cheaper level estimate, a budget, levels a frame or
  two late), so a wall facet can sit pixels away from the true surface. The contour lines came from F at the fragment's
  z, so they were drawn at the true height's z on a facet at the wrong height: a sawtooth across the strips, and
  scratches where round 2's fade cut them.
- **Fix, in the fragment stage (`facetW`, LAND_FS).** On a steep facet (slope over 1, full at 2) the height's part of
  w comes from the facet's own height and the other part from F (Im F for Re F, arg F for |F|). On a wall the two are
  conjugate (Cauchy-Riemann), so the other part does not change along the short step that takes the true surface to the
  facet's height. The contours become the facet's level lines: straight, continuous across strips. On a refined surface
  (a quarter pixel from the true one) nothing moves: rest pictures are the same as round 2's (0 to 34 pixels differ by
  more than 12 levels in a 868 x 652 pane, on silhouettes). Line widths take the smaller of w's and F's derivatives
  (w's alone made dots on silhouettes; F's alone smeared lines on a coarse wall).
- **Not in the base cells' program (`land`).** With `facetW` in it, a heavy formula's first Landscape stalled 0.7 to
  0.8 s in 6 of 6 cold opens (the base: none). The base cells are the flat ones. So while moving, the unrefined cells
  within 2 to 4 cells (about 8 px) of a wall (level 2 or more), across it, are refined to level 1 (`rfPlan`, dil;
  about 58 000 evaluations more in the user's case, 30 a cell). Then a wall that has moved past the levels, which come a
  frame or two late, is still drawn by the refined program, which has `facetW`. Cells left to the cut rule (marked 64
  by LAND_LV_VS) are never filled in. Not over 256 cells (Fine, Max): there even one cell of it held the frame's p95 1
  to 3 ms over the base's.
- **Measured** (`landscape_walls_cmd.js` part motion, desktop light and dark): the user's case at t = 0.2, drawn at rest
  and on the moving path (GLR._lw.motion, T stepped up by 0.006 a frame), the Im H_t = 0 contour on the left wall,
  largest deviation from a fitted line:

  | | rest | moving, round 3 | moving, round 2 (same hook) |
  |---|---|---|---|
  | All sheets, light | 0.37 px | 0.33 px | 2.83 px, 30 % columns missing (rest 21 %) |
  | principal, light | 0.50 px | 0.50 px | 3.57 px, 6 % missing |
  | All sheets, dark | 0.35 px | 0.37 px | 2.84 px, 30 % missing |
  | principal, dark | 0.51 px | 0.49 px | 3.58 px, 6 % missing |

  Real play, frames captured mid-play: `after/filmstrip-{light,dark}.png` (rows round 2 / round 3, All sheets and
  principal; t under each frame). `after/motion-vs-rest-t0.2-{light,dark}.png`: the left walls at 3x, round 2 at rest,
  round 2 playing, round 3 playing, round 3 at rest. Phone light and dark: the same (pictures only, `test/r3_cdp/shots/m-*-phone-*`).
- Earlier versions used one cell of fill-in, or counted it from the edge of the refined band: the forced-motion frames
  passed in most runs (2 of 6 failed at 4 to 5 px, principal, light), and real play at 1x still showed the sawtooth on
  the principal surface where a wall had moved past the levels. The final version counts from the wall itself; every
  forced-motion case passed after (10 of 10 over two runs) and the real-play frames are clean.
- **Open:** at the Fine and Max meshes (no fill-in) a wall that moves past the levels is drawn by the base cells for a
  frame or two, with F at the fragment: the round 2 sawtooth can show there while playing fast. Not measured.

### 2. Cold open with All sheets

- **Causes.** (a) The sheets' height program carried the refinement's passes (twice the link time, a long first-draw
  stall). (b) With All sheets on, the principal programs (landTF, land, floor) still started compiling with the
  sheets', and the principal surface stood in for the sheets while they compiled: its first draw stalled, then the
  sheets' first draw stalled again. (c) The floor's program group started the principal programs too. (d) The step
  cards drew the principal surface with programs that had just linked, and the edge pass took a stall of its own.
- **Fix.** `landSheetTF` is the base's size again; the refinement's passes are `landSheetRF`, started once the surface
  has been drawn and taken into use 900 ms after its link landed (`settled`; figures, films and exports read it at
  once). With All sheets on only the sheets' programs and the floor start; the principal branch stands in only with
  programs that have run before (an earlier version of the chain). The floor goes with the group of the surface it is
  drawn under. A step card's Landscape (`card: true`) waits until the pane has drawn this chain's surface, then until its
  programs have settled. The edge pass is used once it has settled (meanwhile the former 0.3 H rule draws).
- **Measured** (part cold, base and this build alternating, every formula fresh at each run: the system's Metal shader
  cache outlives the browser profile, and a repeated formula compiled in a fraction of the time, so round 2's fixed list
  measured the cache). Two rounds of 6 + 6 each:

  | | base: runs with a gap > 100 ms, longest | round 3 |
  |---|---|---|
  | sheets off, round A | 1 of 6, 325 ms | 1 of 6, 497 ms (then 165) |
  | sheets off, round B | 0 of 6 | 0 of 6 |
  | All sheets, round A | 0 of 6 | 1 of 6, 165 ms (then 141) |
  | All sheets, round B | 0 of 6 | 1 of 6, 151 ms (then 186) |

  Round A had a 400 ms settle; round B is the final build (900 ms). First surface: this build 69 to 154 ms (one 408),
  the base 78 to 256 ms. Round 2 (review): 588 then 1089 ms, 415, 707, 535 ms. **Not fully met**: in 1 of 6 fresh All-sheets
  opens with a heavy formula (sqrt(z^4 + c) sin z) there are two short stalls (about 150 and 190 ms), the second when
  the refinement's program is first drawn; the base had none in these 12. `landscape_walls_cold.out.json` (round B).

### 3. Max mesh while playing

- **Causes.** (a) Every moving frame read the levels back with getBufferSubData in the middle of the frame, after its
  own passes were queued: the read waited for the GPU process (median 1.6 ms, p95 11.2, up to 12.6 at Max). (b) The
  list was rebuilt every frame (a Map per cell: 1.3 ms median, 4 in the p95).
- **Fix.** Levels are read when the GPU has finished the last Landscape frame (a fence at its end; checked at the start
  of a frame and between frames, `lvCollect`, `lvIdleArm`), at most 60 ms late (`LV_LATE`). A new level pass is issued
  only once the one in flight has been read. The list stands while the levels have not changed (only the vertices are
  evaluated again for the new heights). `rfPlan` lists in one pass over typed arrays; the level and list textures are
  written in place. A kept read-back buffer was tried: Chrome then warned that its shadow copy was discarded on every
  read and reads took 30 to 50 ms, so the buffer is fresh for each read, as in round 2.
- **Measured** at Max, the user's case playing, desktop 1440 x 900: reads 0.5 to 0.6 ms median, p95 0.7 to 1.0, max
  0.7 to 9.5; list builds 0.5 to 0.6 ms median. Frame times, alternating with the base (p95 in ms):


  | Max mesh, playing | round 3 | base |
  |---|---|---|
  | desktop, principal (final build) | 19.1, 18.6, 19.1 | 18.3, 18.4, 18.7 |
  | phone 390 x 844, principal (final build) | 18.4, 20.3, 18.3 | 18.3, 18.7, 18.7 |
  | desktop, All sheets | 19.2, 19.4, 18.5 (60 fps) | 24.4, 20.4, 19.1 (49 to 56 fps) |
  | phone, All sheets | 18.7, 19.1, 19.0 (60 fps) | 19.5, 19.3, 19.7 (57 fps) |

  All 60 fps; round 2 (review): p95 31 to 44 ms on desktop. Before the motion fill-in existed, the same series gave 18.5,
  18.3, 18.7 against 18.2, 18.4, 18.3. **Borderline, not cleanly met:** the principal surface's p95 is 0.2 to 0.8 ms over
  the base's on desktop (one phone run +1.6); the runs are noisy (other agents' browsers share the GPU; the base itself
  varies by 0.5 ms and has 25 to 40 ms hitches). The extra GPU work is the edge passes (round 1) and the refinement
  passes. All-sheets rows are from the build before the last two motion changes, which do not touch All sheets.
  (`perf_max_*.out.json`)

## The lows

- **log log z near z = 1 (All sheets, Im): geometry, not a bug.** Checked numerically against the CPU twin
  (Funcs.sheetEval) on the same sheets and local cuts: 6528 base-pass corners within 0.6 of z = 1 on all 24 drawn
  sheets equal it exactly; 201 216 refined corners within 0.35 equal it to 1e-5 H; no refined corner on the base grid
  differs from an unrefined neighbour's (no cracks). The sheets with the inner log on its principal branch (combos 2, 7,
  12, 17, 22) span plus or minus pi around their plates near z = 1: each outer sheet's helicoid around z = 1 (Im log w
  winds once around w = log z = 0). The top one rises about pi/2 above the top plate (2.77 against 2.51 in height units)
  and ends there because its continuation, the next outer sheet, is outside the window: the fin. The pins between
  plates are the same helicoids passing the k = +-1 plates. `loglog_base.out.json`, `loglog_refined.out.json`.
- Not done (time box): the e^{1/z} tower top cut at the box (clipping the principal surface at a plane below H would
  change every pole tower and the golden images); refining cells that hold a cut; two cuts on one grid edge.

## Tests

- Node: 35 of 35 `test/t_*.js` pass (`node_suite.txt`); `t_landwalls` at N = 96 and 256 (`t_landwalls-*.json`).
- `test/landscape_walls_cmd.js` (`landscape_walls_cmd.out.json`: a build before the last three changes, which touch only
  the moving list and program timing; cold, motion and perf re-run on the final build: `landscape_walls_cold.out.json`,
  `landscape_walls_perf_motion.out.json`; round 1's build for the speckle comparison and round 2's with the motion hook
  patched in were built in the scratchpad):
  - mesh: 48 rows, 0 curtains, 0 holes, 0 refined edges across a jump; z^i Im on the phone splits 1 edge (rounds 1 and
    2's known flag, a real jump smaller than the oracle's threshold).
  - speckles: this build 0 to 3 (user's case 0, tan z Re 1 to 3, sec z Re 0 to 3); round 1 on the same frames 4 to 135.
  - BUDGET60 at the default mesh (final build, `landscape_walls_perf_motion.out.json`): 60 fps everywhere, p95 18.1 to
    18.4 ms, orbiting tan z Re and playing the user's case with All sheets on and off, desktop and phone, light and dark.
  - motion: the table above; cold: the table above.
- Other suites (port-fixed copies in `test/r3_cdp/run/`, outputs `*_cmd.out.json`): sheets_deform pass (BUDGET60 p95
  18.1 to 18.7 ms), deform_nat pass, mv_views pass, deform_range pass (75 shots, `dist/v16m.html` from
  `work/xv16-merged-snap` built in the scratchpad), glsl_inverse pass (0 walk and 0 clip failures), export pass (307 files), glsl-test 0 failures in 6.13 M
  comparisons, glsl-test-adv 304 failures in 8.67 M (the same pre-existing count as rounds 1 and 2; `src/glsl.js` is
  unchanged). These ran on the build before the last two motion changes (fill-in counted from the walls, none over 256
  cells), which touch only the moving refinement list.
- Quality suite (`test/regress/quality/run.sh --no-build`, final build, `quality_suite.txt`): 81 runs, 0 failed, 28
  improved, 35 unchanged, 18 NEW; targets 259 met, 0 not met. RESULT: PASS. Baseline and goldens untouched.

## Files

- `work/xvls/src/gl.js`, `src/app.js`, `dist/` rebuilt (plus `dist/glsl-*.html` for the GLSL suites).
- `work/xvls/test/landscape_walls_cmd.js`; `test/r3_cdp/` (kit on 9841; `cmd/` this round's commands, `run/` the
  port-fixed suites, `tools/line.py` the contour measure, `tools/film.py` the filmstrip).
- `notes/landscape-walls/r3/`: this file, the outputs, `after/` (filmstrips, motion against rest).
- Test hooks added in `gl.js`, marked TEMP-DEBUG-HOOK like the existing ones (to go before publishing): `GLR._lw.motion`
  (the moving path at rest), program compile start and link read in `GLR._lwLog`, `GLR._lwT` (read and list times),
  `GLR._lwF` (per-frame trace), All sheets' base heights and key in `GLR.landRefine(true)`.

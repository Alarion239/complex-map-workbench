# Landscape walls, round 2: as built

2026-10-26. Built in `work/xvls` on round 1 (frozen at `work/xvls-final-snap`). Changed: `src/gl.js` (the landscape
passes and shaders), `src/app.js` (two lines: render3D tells the landscape whether something moves and whether it draws
a figure), `test/t_landwalls.js`, `test/landscape_walls_cmd.js`. No new visible strings (`make_ru_table.py --strict`:
0 unresolved; `src/i18n_ru.js` left as it was). Perf baselines, `accepted.json` and golden images untouched.

## What the user sees

- **Steep walls are smooth and closed, with no speckles.** Steep cells are refined until the facets sit within a
  quarter pixel of the true surface, up to 16 sub-cells per side. The per-pixel wall search of round 1 is gone, and with it the dots and scratches
  (the user's sin √z at t = 0.2, tan z Re, sec z Re). The contour lines run at their true heights on the walls.
- **Undersides in the surface's own colours, darker** (round 1: a grey that kept a quarter of the hue). A sheet now
  reads as one surface from both sides. The grey slabs in the user's case are gone; compare the rows of
  `after/filmstrip-*.png`.
- **A per-sheet tint** (All sheets): every other sheet a little darker, the ones between a little lighter, with the hue
  (arg F) unchanged. It is strongest near t = 0 (30 % toward the darker or lighter shade) and fades to 12 % at t = 1 and
  for a map's sheets at rest. Where two sheets coincide, the first one is drawn in front by a few depth units, so near
  t = 0 one sheet shows cleanly instead of a mix of the two. See `after/cue-t0.03-*.png` and `after/cue-t0.2-*.png`
  (none / tint, light and dark).
  - **Why a tint, not a seam.** Both were built and compared in pictures (t = 0.03, 0.2, 1, light and dark). The seam
    (a thin line where two sheets cross) looked like one more contour line among the Tiles' lines. It said where the
    sheets cross but not which sheet is which. The tint shows both: where the second sheet comes through, and the
    curve where the two swap, as the edge of the tinted patch. At t = 1 it is a slight shade. It costs nothing per
    pixel. Exports draw through the same shader, but no exported picture with All sheets was checked.
- **The first Landscape of a new formula does not freeze** (round 1: about 1 s in 3 of 5 runs).

## How

| piece | what |
|---|---|
| levels | Each base cell gets two levels (Lx, Ly), 0..4: 1 to 16 sub-cells along x and along y. A wall that runs along y is cut into strips across it, not squares. A first version had square sub-cells and F evaluated in every fragment. Orbiting the user's case ran at 37 to 42 fps there, from the overdraw of sub-pixel triangles. With strips, and F taken from the vertices (draw row below), it runs at 60 fps. At rest, the levels come from a 5 × 5 lattice of quarter cells: the largest second differences along x, y and the drawn diagonal, in px at the fitted camera, with L = log4(32 D). That is one level over the quadratic estimate, because a wall's curvature peaks between the lattice points. While something moves, the levels come from the edge midpoints and centre. A cell with a real jump on an edge, or with a corner that is not finite on a map with cuts, stays at level 0 (round 1's cut rule draws it). |
| list | The levels are computed on the GPU (`LAND_LV_VS`) and read back (a quarter float per cell). The CPU groups the refined cells by (Lx, Ly) (`rfBuild`). The readback is fenced (the surface is drawn unrefined for a frame or two) except while moving with programs that have already run. There it is synchronous. Within budget: 6 M chain evaluations at rest, 1.2 M while moving, the levels capped together. A partial mesh is rebuilt in full when the motion stops (`rfLater`). Figures, films and exports are always refined in full. |
| no cracks | Vertices sit on 16ths of a cell (integers). A vertex on a cell's side moves to the grid of the lower of the two levels along that side, so both cells draw the same polyline (no T-junctions). Corners next to a base cell take the base passes' height and normal. Normals use central differences at the vertex's own spacing, the same from every cell that shares it. |
| refined vertices | Per group: the points to evaluate (`LAND_RP_VS`, 5 per vertex: the point and its normal's neighbours), the chain pass on them (`LAND_TF_VS`, uPass 1), the vertex records (`LAND_RA_VS`: height, valid, normal, F, position). |
| draw | The base cells as before, with refined cells skipped (`LAND_VS`, uRefOn). Then one instanced draw per group (`LAND_R_VS` + `LAND_FS(false, true)`). F at the sub-cells' corners is interpolated: they are under about a pixel on screen, and in a figure the levels rise with its size. |
| All sheets | The same levels (the largest over the sheets) and snapping. A refined sub-cell is a 2 × 2 corner block per sheet, with the local cuts opposite its own centre, in the sheets' own chain program (uPass 1 and 2). The box clip runs on the refined triangles too. |
| shaders back toward the base | `LAND_FS`: 52 lines, against base 46 and round 1 103 (no wall search, one call of the chain). `LAND_TF_VS` is the base's plus the point pass (14 lines against 13). Everything else of the refinement is in four programs without the chain, compiled once per page. They are taken into use one per frame, at least 48 ms apart, and never in the frame that first draws the surface. When several programs complete their Metal side in one frame, the GPU process stalls (spec 8.7). That is what froze the page in this round's first attempts (0.5 to 0.9 s). |
| edges crossed twice | An edge where the far end is on the near end's branch but the midpoint is not (two cuts, or one curved cut twice): its triangles are left out, as a cell with two cuts already was. Round 1 split at the first crossing and drew across the second. |

## Tests

- **`test/t_landwalls.js`** (node, the CPU twin with the refinement): 34 cases, all pass at N = 96 and N = 256
  (`t_landwalls-96.json`, `-256.json`):
  - 0 hole edges (watertight with the refined cells; edges at a declared singular point counted apart: e^{1/z} at 0);
  - 0 curtains (refined triangles included);
  - one-sided limits and box clip as in round 1.
  - New chord-error check (px at the desktop scale): at N = 256, 68 of 5.3 M triangles are over 0.25 px below the
    16-sub-cell cap, the worst 2.4 px (z^i next to 0). The user's case is at most 0.21 px. Walls narrower than a
    sixteenth of a cell (the pole bands of tan z Re, 1/(z²+1), the Γ-like product) are counted apart. There the cap
    stops the refinement.
- **`test/landscape_walls_cmd.js`** (CDP, port 9811; parts mesh, speck, cold, perf):
  - mesh (`landscape_walls_cmd.out.json`): 12 cases, desktop 1440 and phone 390, light and dark. The GPU's refined
    mesh, read back and rebuilt as drawn, has 0 hole edges and 0 refined edges across a jump in every row. The base
    edges have 0 curtains, every cut is found, and steep walls are all drawn (tan Re 3079 of 3079).
    - One known flag: z^i Im on the phone, 1 edge split near 0. It is round 1's flag, a real jump of Im z^i smaller
      than the oracle's 0.02 H.
    - In 3 desktop-light rows the check ran before the refinement had arrived (fresh page: its programs come one per
      frame). The check now waits for it.
  - speckles (`landscape_walls_speck_cold.out.json`): counted as pixels that change on their own between the default
    and the Fine mesh, on a face that is smooth around them (a line or silhouette that moved a fraction of a pixel is
    not counted). This build: user's case 0 / 0 / 1 / 0, tan z Re 1 / 1 / 0 / 0, sec z Re 2 / 5 / 1 / 0 (desktop
    light, dark, phone light, dark). Round 1 on the same frames: 5 / 4 / 1 / 0, 135 / 129 / 44 / 42 and 42 / 77 / 11 /
    17. Round 1's dense strip in the user's case is mostly excluded by the smooth-face condition. The crops show it
    (`after/` against `../after/`).
  - cold opens, a fresh formula's first Landscape, the base and this build alternating (6 + 6): this build never had a
    main-thread gap over 100 ms; the base had one of 144 ms. First surface 147 to 548 ms (base 193 to 420).
  - BUDGET60: 60 fps everywhere, p95 17.2 to 18.6 ms: orbiting tan Re, and playing the user's case with All sheets on
    and off, desktop and phone, light and dark.
- **Node suite:** 35 of 35 `test/t_*.js` pass (`t_sheets_deform`: 33105 checks, 0 failed).
- **Other suites** (port-fixed copies in `test/r2_cdp/run/`; outputs `*_cmd.out.json`):
  - `deform_nat_cmd`, `mv_views_cmd` and `glsl_inverse` pass.
  - `deform_range_cmd` passes, 75 shots. It needs the v16 merged build as `dist/v16m.html`, built from
    `work/xv16-merged-snap` in the scratchpad.
  - glsl-test: 0 failures in 6.13 M comparisons. glsl-test-adv: 304 failures, the same pre-existing count as round 1
    (float32 near removable points). `src/glsl.js` is unchanged.
  - `sheets_deform_cmd`: every functional check passes. One BUDGET60 gate entry is over: desktop, All sheets, p95
    18.5 ms against the plain deformation's 17.9 (allowed +0.5), at 60 fps. The other desktop run and both phone runs
    are within it. Round 1 had the same borderline (a phone entry).
  - `export_cmd`: 307 files, 80 figures. One fail: the video preview's frame timing, one frame of 52.6 ms in 199
    (median 16.7, p95 17.2). Not re-run, and whether that scene has a Landscape was not checked.
  - Quality suite (`test/regress/quality/run.sh --no-build`, its own Chrome, `quality_suite.txt`): 81 runs, 0 failed,
    28 improved, 35 unchanged, 18 NEW (not gated); targets 259 met, 0 not met. RESULT: PASS. Baseline and goldens
    untouched.
  - The last change (a fresh readback buffer per synchronous level read, which stops Chrome's "READ-usage buffer"
    warnings) came after these suites. It was re-checked with 16 mesh rows (`landscape_walls_mesh_rerun.out.json`,
    no console warnings) and the quality suite.

## Not done / open

- **Two cuts on one grid edge are not split at both.** The triangles on such an edge are left out. Nothing is drawn
  across either cut, but there is a gap of up to one cell (about 1.4 px at the default mesh) where the cuts meet. Splitting needs the second crossing in the
  edge data and a pairing of the crossings inside the triangle. The one known case is the cell of (z²−1)^{1/3} where
  its two cuts cross at 0, and there no pairing is right.
- **log log z, All sheets: the cell that holds the branch point** (z = 1) is refined to 16 × 16 sub-cells with their own
  local cuts. Its cut curtain is now under a tenth of a pixel. A twisted ribbon still rises above the top plate there,
  about as large as before (`after/loglog-im-sheets-*.png`). From the geometry it should be the top drawn sheet's own
  turn around z = 1: Im log(log z) winds once, by 2π, around z = 1 on every sheet of the outer log. On the top sheet the upper half
  of that turn stands above the plate and ends at the window's cut (the window, DESIGN C8, as in round 1). It is
  real geometry of the drawn window, not the cell's curtain. This was not confirmed numerically or from other angles
  (time box).
- Walls narrower than a sixteenth of a cell keep a chord error over 0.25 px (see above). The Fine and Max meshes
  shrink it.
- All sheets' refinement stays in its chain program: a larger program, compiled the first time All sheets is on for a
  formula. Its cold open was not measured.
- Android phone hardware not measured (emulation only).

## Files

- `work/xvls/src/gl.js`, `src/app.js`, `dist/` rebuilt.
- `work/xvls/test/t_landwalls.js`, `test/landscape_walls_cmd.js`, `test/r2_cdp/` (kit on 9811; `cmd/` the picture,
  speckle, cold-open and perf commands; `run/` port-fixed copies of the other suites).
- `notes/landscape-walls/r2/`: this file, the test outputs (`*.out.json`, `t_landwalls-*.json`), `after/` (the same
  cases as `before/`, plus sec z, log log z, the user's case at t = 0.03, the cue pictures, phone, in motion,
  `filmstrip-{light,dark}.png`: before, round 1, round 2 at t = 0 … 1).

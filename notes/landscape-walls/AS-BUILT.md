# Landscape walls, cuts and the height box: as built

2026-10-25. Built in `work/xvls` (v16 + All sheets during the deformation). Only `src/gl.js` changed (diff against
`work/xvsh-snap`: that file alone). No new visible strings, so nothing for `notes/i18n`. Perf baselines, `accepted.json`
and golden images are untouched.

## What changed for the user

- **Steep but continuous: a closed wall.** A triangle is never dropped for being steep. The 0.3 H rule is gone everywhere
  (principal surface, All sheets, both normal passes). The holes, the empty walls and the saw-tooth combs are gone
  (`after/`, `after/filmstrip-{light,dark}.png`: top row before, bottom row after, t = 0, 0.2, 0.5, 0.8, 1).
- **A real discontinuity: nothing across it, clean edges on both sides.** The principal surface finds real jumps
  from the chain itself, not from heights. Each crossed triangle is split along the chord between the crossing points.
  Each bank is drawn up to the cut with its own one-sided height, and a thin rim in the cut colour runs along each
  bank. Edges are geometric, so MSAA antialiases them, and the cut is located to 2^-13 of a cell.
- **Leaving the height box: an exact cut.** With linear heights (All sheets, Re or Im at rest), the sheets run on past
  the block and each triangle is clipped exactly at |h| = 1.25 H. The result is a smooth polygon edge with the
  domain-rim line, not a flat lid. Compressed heights never leave the box, so they need no clip.
- The cut-colour tint on the rims of holes (C2) is gone, because there are no holes.

## How (src/gl.js)

| piece | what it does |
|---|---|
| `LAND_EDGE_VS` (new, `landEdge`, chain + sheet functions) | One transform-feedback texel per grid edge (+x, +y, diagonal): (t, bank-a height, bank-b height, jump). **uCutMode 1** (chains with multivalued steps): the far end's principal value is compared with the **continuation** of the near end's branch (`mapSheet(z0, z, 0)` with `uSheetW = 0`, the cuts opposite z0). It compares values, not heights, because two branches can share a height at an endpoint. If they differ, a 13-step bisection with the same test finds the cut. A step that vanishes at the crossing (Re √z across its cut, \|√z\|) is not a jump. **0**: no multivalued step, so the map is continuous and nothing is split. **2**: cuts the sheets cannot continue (inverse trig, Joukowski's √, arg/θ in a formula, a d/dz before a cut, map mode 2): a height step that does not shrink under bisection. |
| `LAND_VS` | 9 vertices per grid triangle (up to 3 triangles). 0 jumps: as before. 2 jumps: split along the chord. 1 jump (a cut ending inside, at a branch point): a slit. 3 jumps: left out. Only a non-finite corner drops a triangle. `vEdge` marks only real cut edges. |
| `LAND_NRM_VS` | Central differences. One-sided only across a real jump (the edge textures), never across a steep slope. |
| `LAND_SHEET_TF_VS` / `LAND_SHEET_VS` | No cliff rule, and normals over one cell's span, so a wall inside a cell shades as a wall. Linear heights: the TF keeps heights up to 10^4 H (`uHClip`), and the VS clips each triangle against the block's top and bottom (Sutherland–Hodgman, crossing found from the lower grid end so both triangles of an edge find the same point). Clipped edges get the rim (`vBoxE`). |
| `LAND_FS` | Contour lines fade on a facet that is more than about 1 px from the true height (a wall steeper than its cell), so they do not waver across coarse walls. Box-clip rim. |
| `FLOOR_FS` | Contact shading ignores heights below the block (clipped away). |
| `landHeights` | Runs the edge passes (3 directions), caches **per grid size**, so the stage cards (N = 64) no longer evict the pane's mesh every frame. Fixed: `runTF` binds its target on the active unit; the passes now use a spare unit, so unit 2 keeps the heights. |
| `GLR.landMesh(n)` | Test hook: reads back the last principal mesh (heights and edge data). |

ANGLE/Metal note: the edge shader avoids `return` inside loops (loop results were lost when it did).

## Tests

- **`test/t_landwalls.js`** (node, the mesher's rule on the CPU twin, `Funcs.sheetEval` / `sheetMapEval`, against
  an independent 2^-40 bisection oracle). It covers the design's cases (√z Im/Re/log, log z Im/log, tan Re/Im, 1/z Re/|F|,
  1/(z²+1) Re/Im, e^{1/z} Re, z^i Im, (z²−1)^{1/3} Im/Re, Γ-like Re, and the user's case H_t at t = 0.2, 0.5, 0.8 in Im
  and Re), plus the box clip on 8000 random triangles. **All pass at N = 96, 256 and 384** (`t_landwalls-{96,256,384}.json`):
  - 0 hole edges (watertight up to the rim, cut chords and slits),
  - 0 curtains,
  - every crossing within the one-sided limits,
  - every crossing a real jump,
  - 0 crossings on the continuous cases,
  - box clip: 0 violations, shared edges identical.

  Edges through a declared pole, branch point or essential singularity are counted apart (`atSingularPoint`, at most
  11, e^{1/z} near 0).
- **`test/landscape_walls_cmd.js`** (CDP, port 9802). It runs 8 cases at desktop 1440 and phone 390 (Android emulation),
  light and dark, and compares the **GPU's** mesh (read back) with the CPU oracle on the same grid. Result in
  `landscape_walls_cmd.out.json`: **0 curtains, 0 dropped triangles, every cut found, 0 jumps on continuous surfaces;
  steep walls now drawn: tan Re 3079/3079, Γ-like 1286/1286, 1/(z²+1) 262/262, 1/z 139/139**. GPU and CPU heights agree to
  3e-5 H.

  One flag remains: z^i Im at phone, 1 edge 3 cells from 0, where z^i oscillates without end. The radius around the
  singular point was widened to 4 cells afterwards. The case was not re-run.
- **BUDGET60** (`landscape_walls_perf.out.json`): 60 fps everywhere.

  | | desktop p95 | phone p95 |
  |---|---|---|
  | orbiting tan Re | 17.4 ms | 17.3–17.9 ms |
  | playing the user's case, All sheets | 17.5–17.7 ms | 17.6–18.6 ms |
  | playing the user's case, sheets off | 17.5–17.7 ms | 18.1–18.4 ms |

- **`sheets_deform_cmd.js`** (re-run with the port fixed, `sheets_deform_cmd.out.json`): every functional check passes,
  EN and RU, desktop and phone, light and dark. These include that the sheets' values do not change. One gate entry
  missed: phone, All sheets, first of two runs, p95 18.6 ms against the plain deformation's 17.7 (allowed +0.5), at
  60 fps. The second phone run gave 17.6 ms, and the earlier full run passed every gate (17.5–18.1 ms). On the phone
  All sheets path the only per-frame change is the contour fade (one heightW per fragment). Read it as borderline
  noise on the shared Mac; it is still to be confirmed on the Android phone.
- **Node suite:** all 35 `test/t_*.js` pass (including `t_sheets_deform.js` and the new `t_landwalls.js`).
- **Not re-run (time box):**
  - `deform_range_cmd`, `deform_nat_cmd`, `mv_views_cmd`, `export_cmd` (Landscape figures and the film), `v15_desktop_cmd`
    and `v15_phone_cmd`. Port-fixed copies are in `work/xvls/test/lw_cdp/run/`, except the four that still say
    `localhost` (deform_range, export, v15_desktop, v15_phone), which need their `PORT` line fixed as above.
  - `glsl-test`, `glsl-test-adv`, `glsl_inverse` and the quality suite. `src/glsl.js` and the chain code are unchanged,
    and the quality goldens are 2D scenes, but they were not re-run.

## Before → after (numbers from the same oracle)

| case | before (holes: 3D area missing / curtains) | after |
|---|---|---|
| tan z Re | 72 % / 0 | 0 / 0 |
| Γ-like Re | 36 % / 0 | 0 / 0 |
| e^{1/z} Re | 34 % / 0 | 0 / 0 (the cells at 0 drawn) |
| 1/(z²+1) Re, Im | 10 %, 10 % / 0 | 0 / 0 |
| user's case t = 0.2 Im / Re | 4 % / 122 | 0 / 0 |
| √z, (z²−1)^{1/3} Im | 0 / 3, 2 | 0 / 0 |

## Not done (design parts left for the next round)

- **Adaptive refinement (design 3.3)**: chord-error levels, histopyramid, crack-free fans. Walls are closed and lit as
  walls, but a wall steeper than a cell is one facet wide. Contours fade there instead of being drawn at their true
  height. This is the visible remainder on the user's case at small t: walls are flat-faceted, with no wavy lines.
- **All sheets free edges (C8)**: the window ends of log / z^s and the n = 2 sheets of H_t mid-deformation still end
  on cell boundaries. **Branch-point cells** (principal and sheets) are not refined. At most one cell there can bridge,
  and the tests count these apart.
- **pickLand** still marches the principal F. It ignores clipped parts only through the existing top bound.
- **The C4 scale question** (median μ) is still the user's choice, unchanged.

## Files

- `work/xvls/src/gl.js`, `dist/` rebuilt (`python3 build.py`).
- `work/xvls/test/t_landwalls.js`, `work/xvls/test/landscape_walls_cmd.js`, `work/xvls/test/lw_cdp/` (kit on 9802,
  `run/` copies).
- `notes/landscape-walls/after/`: the same pictures as `before/` (at rest and in motion), plus
  `filmstrip-light.png` and `filmstrip-dark.png`.
- `notes/landscape-walls/*.json`: the test outputs.

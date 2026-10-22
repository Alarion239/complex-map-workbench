# Motion frames vs rest frames: diagnosis (2026-10-20)

The user's report: "the patterns have different opacities when I move and when I stand still; letter F appears and
disappears", seen while panning the view and while dragging a shape. This note covers diagnosis only. Nothing in `src/`
was edited.

## How it was measured

- **Builds.** Both builds were made with their own `build.py` into the scratchpad and served on 127.0.0.1:8811, so the
  edits in `src/` did not interfere:
  - `pub` is `notes/backup-pre-sphere/`, the published build;
  - `p2` is `notes/milestone-p2/`, the current gated build;
  - `p2x` is `p2` with a one-line experiment in `drawInverse` (see cause 1). It exists in the scratchpad only.
- **Harness.** `test/motion_cdp/` (a copy of cdp_kit). The probe is `mv_template.js`, the driver is `mv_matrix.py`, and
  the numbers are in `mv_results.json` (dpr 2 and the later runs) and `mv_d1.log` (the dpr-1 matrix, which was stopped after logH Checker).
  - A hook on `GLR.blit` copies every frame blitted into `canvasR` / `canvasL`, together with `GLR.inverseHalfDraws`,
    `__cmwPaths()` and `__cmwInfo()` (fix-up sizes).
  - Gestures are real CDP mouse drags: press, 12 moves 16 ms apart, then release.
  - Three frames are kept per gesture:
    - **mot**: the frame of the last move, 22 ms after it and before the 45 ms half-resolution settle;
    - **held**: 600 ms later, button still down;
    - **rest**: 3 s after release.
  - Since mot and rest have the same view and the same shape position, every pixel difference between them is a
    motion artefact.
  - `shiftR` is a translation-consistency test. The right view is panned in steps of whole pixels, and each motion frame
    is compared with the frame before the pan, shifted by the pan.
- **Metric.** `frac8` is the fraction of pane pixels whose largest channel difference exceeds 8/255. `lumD` is the mean
  luminance of the differing pixels, motion minus rest.
- **Scenes** (pattern cell from the app's rule):
  - `discExp`: a disc under exp, bounded on an invertible chain;
  - `expH` and `logH`: the upper half-plane H under exp and under log, unbounded;
  - `logCut`: a disc across log's branch cut.
- **Patterns.** Tiles, Checker and Solid at α 0.85, plus Tiles and Checker at α 0.5. Each was run at dpr 1 (the suites'
  setting) and dpr 2 (a Retina Mac).

## Results at a glance

| build | gesture | scene / look | mot vs rest, frac8 | what differs |
|---|---|---|---|---|
| p2 | right pan, dpr 2 | expH Tiles α 0.5 | **0.0237** (lumD +4.5) | half-resolution motion frame: inner ring of F glyphs gone, every edge blurred |
| p2 | shape drag, dpr 2 | expH Tiles α 0.5 | **0.0244** | the same (half-resolution) |
| p2 | right pan, dpr 2 | expH Checker α 0.5 | **0.0158** (lumD −10.8) | thicker net lines, small cells averaged |
| p2 | right pan in whole-px steps, dpr 2 | expH Tiles α 0.5 | frames 1–2: 0.000; frames 3–12: 0.027–0.029 | the look flips after 2 frames, and back 45 ms after the last move |
| p2x | right pan, dpr 2 | expH Tiles α 0.5 | 0.0209 (lumD 0) | F glyphs restored by the dpr fix; bilinear blur remains |
| p2 | right pan / drag, dpr 2 | expH Tiles α 0.85 | 0.0000 | full resolution in motion |
| p2, pub | right pan / drag, dpr 1 | all scenes, all patterns | 0.0000 | – |
| pub | right pan / drag, dpr 2 | expH Tiles / Checker α 0.5 and 0.85 | 0.0000 | – |
| pub | left pan by 150 px (> 30 %) | expH Tiles / Checker / Solid 0.85 | **0.549 / 0.509 / 0.043** | clipWin re-centred, so other sheets are meshed: different F glyphs and opacity |
| pub | left pan, held vs rest | logH Tiles / Checker | **0.0615 / 0.0614** | fix-ups wait for pointer-up, then add holes and slivers at the far end of the strip |
| pub | shape drag | logCut Tiles | 0.0011 | fix-ups dropped during the drag (a line along Im w = ±π) |
| p2 | left pan by 150 px | expH / logH | 0.0015 / 0.0009 | only the boundary strokes (resampled in the new clipWin) |
| p2, pub | shape drag, meshN 960 | logCut Tiles | 0.022 / 0.0215 | the right view is refitted at pointer-up (a view shift, not a look change) |

The two complaints therefore have different causes in the two builds:
- **p2: cause 1, half-resolution motion frames.** This explains both "F appears and disappears" and "different
  opacities", on right pans and on shape drags.
- **pub: causes 2 and 3, the view-dependent forward meshes and fix-ups.** Their visible changes come when a left-view pan
  settles, and while a dragged shape crosses cuts.

## Cause 1 (p2): half-resolution motion frames do not look like rest frames

**Where.** `app.js` `predictLevel` (`HALF_EST = 2.2` ms) sets a level-1 floor for heavy panes. The cost guard
(`guardFrame`) then marks every contiguous motion frame `half`, and `drawScene` draws those inverse passes at half
resolution (`beginHalfPre`, `drawInverse({half: true})`, `compositeHalf`).
- **When it fires.** At dpr 2, exp(H) and z^i(H) at α ≤ 0.5 are predicted at 2.5–3.7 ms and get this floor (SPEC 10.12).
  `__cmwGuard()` confirms it: `R: {level: 1, half: true, floor: 1}` for expH and ziH at α 0.5 and 0.3. It does not fire
  at α 0.85 or dpr 1.
- **When the look switches.** The first frame of a gesture is not contiguous and draws at full resolution. Frames 3 and
  later of a pan are half resolution (shiftR: 0.000, 0.000, then 0.027–0.029). The settle frame 45 ms after the last move
  is full resolution again. The look therefore flips at the start and end of every gesture, and on every pause longer
  than 45 ms during a slow drag.

**Why it looks different** (`gl.js` `drawInverse`, PATTERN_SRC 'analytic'):
1. **The F glyph.** A half pass doubles `uInvScale`, so the footprint `pw` doubles. `regionUniforms` still gets the full
   `dpr` (`{ dpr: st.dpr || 1 }`). The Tiles glyph is gated by `smoothstep(10.0, 16.0, 1.0 / (pw * uDpr))`, the cell size
   in CSS px, and in a half pass it reads half the true size. The F therefore fades for cells of 16–32 CSS px in motion
   and is drawn at rest. Image: `motion-vs-rest/p2_expH_tiles_a05_dpr2_panR.png`, left vs right: the inner ring of glyphs
   is missing; lumD +4.5, because the dark glyphs are absent.
2. **Line widths and averaging ("opacity").** `iso(..., uDpr)` widths (graph paper, polar web) are counted in target
   pixels, so they double in CSS px. The checker's net uses `net(g, gw)` with `gw` per target pixel, so the net lines
   are twice as wide. `moire(gw)` starts averaging at cells twice as large. Image:
   `motion-vs-rest/p2_expH_checker_a05_dpr2_panR.png`: in motion the net lines are darker and the small inner cells
   flatter; lumD −10.8.
3. **The bilinear upsample** blurs every edge (cell edges, glyph edges, analytic rims).

**Experiment `p2x`.** `regionUniforms(P, …, { dpr: (st.dpr || 1) * (half ? hw / fw : 1) })` passes the half target's
effective dpr.
- The glyph ring comes back (middle panel of the Tiles image), and lumD goes from +4.5 to 0.
- frac8 only drops from 0.0237 to 0.0209: the blur (3) and the gw-based effects (2) remain. Checker is unchanged at
  0.0158.
- Half resolution can therefore never look like full resolution. Only the uDpr part can be made exact.

**Cost evidence (dpr 2, synchronous `__cmwTime(10)` of the right pane at full resolution, readback included, so an upper
bound):**

| scene | ms per frame |
|---|---|
| expH α 0.5 | 7.6–8.7 |
| expH α 0.3 | 7.4–8.7 |
| ziH α 0.5 | 6.9–7.5 |
| ziH α 0.3 | 8.5–9.1 |
| expH α 0.85 (full resolution in motion today, passed the P2 perf gate) | 5.8–6.5 |
| left identity pane, for scale | 5.2–8.0 |

So the extra cost of full resolution at α ≤ 0.5 is about 1.5–2.5 ms per frame. That is inside BUDGET60 (frame ≤ 14 ms),
and the prediction's own numbers (2.5–3.7 ms) are under the 8 ms per-pane budget that SPEC 10.12 derives.

**Recommended fix** (app.js and gl.js; owner: whoever holds the cost guard):
1. **Remove the predicted half-resolution floor while the 60 fps budget holds.**
   - In `predictLevel`, return 1 only when the predicted pass time exceeds the pane budget: `est > budget`, which is
     8 ms, or 4 ms per pane when both panes draw inverse passes. Drop the 2.2 ms `HALF_EST` threshold.
   - Keep the measured guard (3 consecutive over-budget readings) as the only way to reach level 1. This follows the
     user's rule "image quality is never traded for frame time while 60 fps holds".
   - Gate: run the paired perf gate on the dpr-2 pan/drag units for exp(H) and z^i(H) at α 0.5 and 0.3
     (`--paired --only '<unit>'`), then the full `--paired` run in the final gate. If a unit fails, it shows which scene
     really needs level 1. The heavy scenes should then be made cheaper at full resolution (B class, scissor), not
     drawn at half resolution.
2. **When level 1 does engage** (a measured overload on a slow GPU), make the half pass match the rest look as far as it
   can:
   - pass `dpr * hw / fw` to `regionUniforms` in half passes (the `p2x` line above), which makes the glyph gate and
     the `iso` widths exact;
   - in the analytic `PAT_PRE`, divide the footprint used by `moire()` and `net()` by the same factor (a `uFoot`
     uniform: 1 at full resolution, 0.5 at half), so averaging and net widths are those of display pixels. Aliasing of
     cells near 2 half-pixels is the price.
   - Also stop the look flipping after 2 frames: a pane at level 1 should draw the whole burst at one level, including
     its first frame, or none of it.

## Cause 2 (pub): re-centring clipWin after a > 30 % left pan rebuilds the forward meshes of unbounded shapes

**Where.** `app.js` `sourceViewChanged`, a 200 ms debounce after a left-view change (it does not wait for pointer-up).
Once the shift exceeds 0.3 of the window, it sets `clipWin = nb`. `shapeGPU` keys stretched meshes on
`JSON.stringify(clipWin)`, so the mesh is rebuilt (`Region.buildMesh(s, clipWin, base)`) and its fix-up is destroyed.

**What differs.**
- For exp(H), the mesh covers the sheets inside the window. A new window meshes other sheets, so the right image
  changes as a whole: other sheets on top, different F glyphs, a different number of overlapping layers (opacity).
  - Tiles: frac8 0.549, mean 28.8.
  - Checker: 0.509.
  - Solid at α 0.85: 0.043.
  - Image: `motion-vs-rest/pub_expH_tiles_leftpan.png` (left: before release; right: at rest).
- The change appears 200 ms after the pan stops. The frame held 600 ms into the press already shows it (held vs rest
  0.000), so the user sees the pattern jump right after panning.

**p2.** For eligible shapes the inverse path's member ranges come from the shape, not the view (SPEC 3.6). The same pan
changes only the boundary strokes: expH 0.0015 and logH 0.0009, in 4–5 px bands along the image of ∂H
(`motion-vs-rest/p2_logH_leftpan_diff.png`). The stroke key `lineKey` contains clipWin and the curves are resampled
inside it.

**Recommended fix.**
- Fills are already fixed in p2 for eligible shapes. For forward shapes, which in p2 means ineligible maps, the left pane
  at stage > 0 and pending compiles, the P5 SphereMesh replaces window-dependent meshing.
- Until then, make the re-centre happen once and at rest: run `sourceViewChanged`'s swap on pointer-up / wheel idle
  only. Keep drawing the old mesh with its fix-up until the new mesh's fix-up is ready (double-buffer the (mesh, fix)
  pair in `gpu` entries), so the user never sees an unfixed intermediate.
- Strokes: sample `curvesOf(s, win)` in a window expanded by the re-centre threshold (e.g. `Region.expandBox(clipWin,
  1.6)`), so a re-centre cannot change what lies inside the view.

## Cause 3 (pub; also every forward-drawn shape in p2): fix-ups are absent during motion

**Where.**
- `runFix` / `computeFix` yield while `fixBusy()`, that is during a drag, a tween, a transition or a playing morph.
- A fix-up is bound to a `meshKey`, and `drawScene` uses it only while `r.fix[role].meshKey === r.meshKey`.
- A shape drag rebuilds the mesh every frame (a new `shapeKey`), and so does a clipWin re-centre. Every such motion
  frame is therefore drawn without skip flags or extra triangles, and the fix-up arrives about 160 ms after pointer-up.

**Evidence.**
- pub logH, left pan:
  - held vs rest: frac8 0.0615 for Tiles and 0.0614 for Checker, at the far (Re w → −∞) end of the strip. In the held
    frame, clipWin was re-centred during the press, so the mesh is new. Its fix-up waits on `fixBusy()` while the button
    is down; this comes from code reading, because `fixR` was not recorded for the held frame. Before the pan `fixR` was
    1206; at rest it is 7327.
  - At rest, the skip flags remove triangles that the extras do not fully cover: white holes and slivers.
  - Image: `motion-vs-rest/pub_logH_tiles_leftpan_fixups.png`.
- pub logCut, drag: frac8 0.0011 along the cut's image (Im w = ±π). `fixR` is absent in motion and 7192 at rest.
- pub expH, drag: 0, because the fix-ups there are invisible.
- In p2 the eligible shapes draw inverse with no fix-ups at all (`R:inverse`, every drag frame 0.000). The mechanism
  remains for forward shapes.

**Recommended fix.**
1. For a rigid move (`drag.mode === 'move'`), translate the old mesh's source vertices instead of re-meshing, or key the
   mesh by shape geometry relative to its anchor. The topology then stays, and the old skip flags can stay bound until
   the new ones land.
2. Let `computeFix` run in ≤ 4 ms slices during motion for the dragged shape only, instead of yielding while
   `fixBusy()`, so the fix-up keeps up with the drag.
3. Keep the previous (mesh, fix) pair on screen until the new pair is complete (as in cause 2), so motion frames never
   show an unfixed mesh.

The proper fix is the planned P5 path (SphereMesh for forward shapes) together with routing eligible shapes inverse,
which P2 already does.

## Minor or secondary findings

- **Mesh cap on drags (both builds, forward meshes).** During a handle or move drag, `baseRes()` caps the mesh at
  `meshN = 240`. At the default meshN of 240 nothing changes, measured as 0 on every drag. With meshN 960 the drag frames
  use 5836 triangles and the rest frame 91 044 (logCut). Forward-drawn shapes then show a coarser boundary and pattern
  in motion: the pub right pane and the left pane in both builds.
  - The measured 0.022 / 0.0215 in that run is dominated by the next item.
  - Fix: keep the cap only when the measured frame is over the 60 fps budget, which follows the user's rule.
- **Right-view refit at pointer-up (both builds).** `onUp` calls `fitRight(true)` after `move`, `handle` and `cut`
  drags while `rightAuto` is set. The right view tweens to a new fit once the user releases, and the tween frames are
  motion frames again (half resolution in p2's heavy case). Evidence: the logCut meshN-960 drag, where the axes are
  shifted between motion and rest in both builds.
  - This is a view change, not a look change.
  - Fix: skip the refit when the new fit is within a few px of the current view, or refit from shape data that does
    not depend on the mesh resolution.

## Not causes (measured or ruled out)

- **Right-view pans at dpr 1 (both builds) and at dpr 2 (pub).** Translation consistency is exact: 12 frames per pan,
  all 0.000. The only exception is logCut, where alternate frames reach 0.008 in both builds identically, on grid and
  tick pixels.
- **Forward vs inverse path switching during gestures.** `__cmwPaths()` reported `R:inverse` on every recorded motion
  and rest frame in every p2 run. No 'preparation deferred' or 'cost guard' stand-ins appeared: one shape per scene, so
  the 4 ms prep budget was never reached. With many shapes, `invPrep` can still defer a bounded shape to the forward
  path for one motion frame (`prepDeferred`); this was not observed.
- **Map-cache stand-ins.** `stand()` is used only while a program compiles. No compile ran during the gestures.
- **The Tiles glyph's footprint threshold at full resolution.** It depends on the cell size on screen only, so it is
  identical in motion and at rest (0.000 at dpr 1, and at α 0.85 at dpr 2). It misbehaves only inside half passes
  (cause 1).
- **Hover dimming (`alpha *= 0.5`).** `hoverShape` is set only by the shape-list rows' `pointerenter`, never by canvas
  gestures.

## What is left

- The perf side of the cause-1 fix is unverified: no `--paired` run was made, since this task was diagnosis only. The
  `__cmwTime` numbers above are evidence, not a gate.
- No run at α 0.3 under a drag, no z^i(H) visual pair, and no Sphere view or left globe (P3 is not enabled).
- The forward shapes in p2 (ineligible maps, for example d/dz, or e^{z²} through a custom formula) were not probed
  under drag. Cause 3 applies to them by code reading.

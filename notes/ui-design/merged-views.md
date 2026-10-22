# Merged views and the Deformation toggle (user request, 2026-10-22)

The user: "I feel like we should merge both views when we do deformation, and add the deformation option to the top
line, not in the right panel. And also, it would make sense to have the 3d plot also in merged panel? Since it merges
input and output domains?" Then, asked how: "landscape a switch similar to all other views (same job) but deformation
is a toggle as it modifies the views ... the deformation should work for all views, while 3d is a separate view.
please design it the best way you can think of", and Phase: "Merge it too".

This revises U-b (panels.md U2/U3): Landscape and Phase leave the left pane's switcher and become their own views.

## Principle

A picture that mixes X and Y gets one merged, full-width panel. Pictures of X alone stay left, of Y alone right.

## The top bar

- **View switch** (segmented control, one place, keys 1 / 2 / 3, palette entries):
  - **X → Y**: the split view. Left pane = X (Plane | Sphere): the shapes. Right pane = Y (Plane | Sphere): the images
    and targets. Each pane keeps only its Plane | Sphere switch in its head.
  - **Phase**: ONE wide panel, the phase portrait of F over X (domain colouring), Plane or Sphere (the phase sphere),
    shapes outlined, target preimages drawn, the colour wheel with its w-plane key switch, the style strip (Tiles,
    Plain, Modulus, Contours, Grid, Cauchy) in the panel's options strip.
  - **Landscape**: ONE wide panel, the 3D graph of F over X; height mode, colouring (phase colours or plaster), sheets
    and the probe in its options strip.
  - Each view keeps its own camera / view state; switching back restores it.
- **Deformation toggle** (key M; disabled with a tooltip when no step is active; it replaces the morph button in the
  right pane's head). It modifies the active view:
  - **X → Y + Deformation**: the two panes merge into ONE plane (or one globe when Y shows its Sphere): X drawn as a
    grey outline (the shapes' source), H_t(X) filled with the pattern, live trajectories t ↦ H_t(z) for well-spread
    sample points (the same arrow selection as the morph figure, item 2), the transport bar (play, scrub t, speed,
    natural / straight path) docked at the panel's bottom. Turning it off splits the panes again.
  - **Phase + Deformation**: the wide phase portrait of H_t; the same transport bar.
  - **Landscape + Deformation**: the landscape of H_t; the same transport bar.
  - A focused step deforms that step only (as today).

## Export

The figure dialog follows the view: X → Y gives the two-panel figure (with the arrow between panels), Deformation gives
the morph figure (one plane with arrows), Phase and Landscape give one-panel figures.

## Implementation notes

- The merged panel can reuse the existing solo (expanded pane) machinery: one canvas at full width, the other pane
  hidden; it must look like a first-class view, not an expanded pane (no collapse affordances that suggest otherwise).
- Migration: saved view.L.surf 'land' → Landscape view; view.L.phase → Phase view; an open morph → Deformation on;
  old rightMode states map as before (quality-suite scenes must render unchanged in X → Y).
- Perf and quality harness: keep the layout-aware hooks (__cmwPaneOf etc.) correct for merged views, so the paired
  gate compares like with like against the reference (old layout).
- Rules: 60 fps budget, motion frames look like rest frames, no image-quality trade-offs; light and dark themes;
  narrow / mobile widths.

## As built (2026-10-22)

Mockup first: `mockup-merged.html` (generator `mockup-src/build_merged.py`; the app's own stylesheet, exact Cayley
pictures, a light / dark button). The app was built to match it, with one change noted below (the landscape's colouring
is one control).

- **State.** `view = { main: 'xy' | 'phase' | 'land', L, R, P, D }`: X → Y's two panes (`L`, `R`: Plane | Sphere and
  the Equator), the phase panel's surface (`P`) and the landscape's colouring (`D.phase`). The Deformation toggle is the
  transport (`morph.open`, runtime, as before). `Views` in `src/view.js` holds the model and the migration; `test/t_views.js`
  covers it (76 checks).
- **Top bar.** The switch (X → Y · Phase · Landscape) and the Deformation toggle sit in the middle of the bar. Below
  1280 px both show icons only; on a phone they stay in the bar (four 30 px icons). The toggle keeps the id `morphBtn`
  (the perf suite presses it); with no active step it is dimmed and its tooltip says "Add a function to deform".
- **Keys.** 1 / 2 / 3 pick the view, M toggles the deformation. ⇧1 / ⇧2 set Plane / Sphere of Y in X → Y and of the
  portrait in Phase. X's own Plane / Sphere in X → Y has no key (its head buttons and the palette: "X: Plane",
  "X: Sphere"); the old 4 (Phase on X) is gone.
- **Merged panels** reuse the expanded-pane layout (`.panes.solo-L/R`) plus `merged-L/R`: the other pane, the gutter
  and the expand buttons are hidden, also on a phone. Phase and Landscape are the left pane at full width; X → Y with
  the deformation is the right pane at full width (Y's surface: one plane, or one globe with X's outline in grey).
- **Own view state.** Switching views swaps X's plane view (`S.srcView`, `V.left`) and the z-globe camera, so Phase and
  X → Y keep theirs; a view seen for the first time starts from the one it was switched from. The landscape camera and
  the w-globe were already their own.
- **Landscape strip.** Height, then one colouring control **Tiles · Plain · Plaster** (U-b's Phase toggle plus style on
  the relief, which can only paint Tiles or Plain); Plain on the relief is `landPlain`, so the portrait keeps its style.
- **Colour key.** The "Key in the w-plane" switch stays in the Phase view's legend; the key is painted under Y's plane
  in X → Y, where a "Phase key" check in Y's strip turns it off again.
- **Transport** is a bar docked under the plot of the view's panel (`#tdockL`, `#tdockR`), never over the picture; on
  a narrow panel the scrubber takes its own row. "Paths" shows only in the deformation plane. The live paths are the
  morph figure's selection (chosen off the frame, cached; a scrub never re-chooses them: checked in `mv_views_cmd.js`).
- **Export** follows the view: X → Y the two-panel figure (Both / Left / Right), the deformation the morph figure,
  Phase and Landscape one panel (no Panels row). A pane hidden by a merge exports at its split-view width.
- **Migration.** Old `rightMode` saves map as before and then to a view (Phase portrait or phase sphere → Phase,
  `3d` → Landscape, the old Morph view → X → Y with the deformation on); U-b saves (`view.L.surf 'land'`,
  `view.L.phase`) → Landscape / Phase. Image scenes stay in X → Y with unchanged pane sizes (the quality suite's
  golden images are pixel-identical).
- **Test hooks.** `__cmwSetMain`, `__cmwLayout`, `__cmwOtherPane` (null when merged); `__cmwSetView('L', 'land')` and
  `__cmwSetPhase` keep U-b's meaning for older test files. The perf suite's mode units pan X's plane in X → Y for the
  old layout's "other pane" (test/regress/README.md, Paired gate).
- **Tests.** `test/mv_views_cmd.js` (browser acceptance: switch, keys, merged widths, chrome, own views and cameras,
  the deformation in every view, docked transport, cached paths, export per view, hooks, every example, eight old
  saves, phone / tablet / desktop in light and dark). `test/ub_views_cmd.js` is superseded (U-b's controls).

Screenshots of the built app (headless Chrome, 1440 x 900 unless named) and of the mockup: `merged-views-shots/`.

## Review fixes (2026-10-22, second pass)

The review of the build (19 confirmed findings) was worked through; `test/mv_views_cmd.js` checks each fix.

- **Export follows what is drawn.** Phase / Landscape with the deformation: one panel of H_t at the current t, captioned
  "The phase portrait of H_t …" / "The landscape of H_t … the height is log|H_t|", the bar `arg H_t`, and a sentence
  "Shown at t = 0.60, where H_t deforms the identity (t = 0) into F (t = m) along …" (the homotopy's own words). X → Y
  with the deformation on Y's Sphere, or over a chain with a d/dz step (no morph figure): the one merged panel as on
  screen (no Panels row), captioned "The deformation H_t on the Riemann sphere …: the image of … under H_t, over the set
  itself in grey." The plane's morph figure is unchanged.
- **Titles name H_t:** "phase of H_t", "landscape of log|H_t|", the legend "arg and |H_t|"; the merged globe is titled
  "z → w deformation" like the merged plane.
- **Phone top bar.** The words "Map Workbench" give way first (they shrink, and below 430 px the mark stands alone), so
  the switch, the toggle and the ⋯ menu fit at 360, 375 and 390 px.
- **Live paths are points of the plane.** A selection stays while the view is within a 30 % pan and a 1.5x zoom of the
  view it was chosen in (the frame re-projects it); a larger move chooses again.
- **Live paths on the merged globe** (the design's "one plane (or one globe)"), with the Paths check: the same
  selection, chosen in the deformation's own flat frame at the globe pane's size (fixed per chain, focus, path, shapes
  and size, so orbiting never re-chooses), lifted to the sphere's front side.
- **The deformation plane's own view.** Y's split view is put aside while the deformation shows and restored when it
  closes; the deformation keeps its own view between openings (same chain, focus, path and shape count), fitted the
  first time. Its fit clips a source much larger than its end (more than 9x the area: the half-plane e^X of the strip at
  a focused Möbius step) to 1.5x the end's box; Fit also takes the current H_t. (Strip to disk, f₂ focused, t = 0.5:
  40 paths at 139 px / unit, was 1 path at about 10 px / unit.)
- **Legend.** The deformation plane's Pattern chip says what grey is (X; "start", dashed, at a focused later step) and
  what the lines are (t ↦ H_t(z)) in the rows the view outline uses in X → Y.
- **The colour key's one switch** is the "Phase key" check in Y's strip (X → Y), shown whenever the key is available;
  the Phase legend no longer carries a switch that acted on a hidden pane.
- **Draw tools** are dimmed in the merged deformation (tooltip "Turn off Deformation (M) to draw"), and a draw tool
  there shows "Drawing is off in the deformation: press M to turn it off."
- **Keys, one map:** ⇧1 / ⇧2 Plane / Sphere of the left or only panel (X in X → Y, the portrait in Phase), ⇧3 / ⇧4 of Y;
  the head buttons' tooltips and the palette show them.
- **Phone:** the legend chips start folded to their colour wheel on a touch phone (a tap unfolds them); the landscape's
  hint reads "Drag to orbit, pinch to zoom" on touch.
- **The target-root list** is not shown over the merged deformation plane (its z-plane roots were listed "in view" over
  a w-plane picture).
- **The integral popover** keeps clear of the planes' legend chips (example 11's covered the Phase key).
- **Perf:** `morph.play.views` (test/regress/README.md) gates the deformation playing in the wide Phase and Landscape
  panels against the 60 fps budget; the mode units of merged views record the panel width in their details.
- **Not done in this pass:** the GPU allocation churn on view switches (cause: `clipWin` follows X's pane box, which
  doubles in width between X → Y and the merged views, so the meshes of unbounded shapes and every shape's line
  resources, keyed by `clipWin`, are rebuilt on each switch; no leak, frames fine; a one-deep per-view resource cache
  would avoid it); the Phase portrait at a focused step with an unbounded step source still frames the whole source, as
  X's split pane does; the phone transport keeps its three rows.

Screenshots of these fixes: `merged-views-shots/review-*.png`.

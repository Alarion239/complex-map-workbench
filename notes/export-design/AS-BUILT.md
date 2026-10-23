# Image export: as built (2026-10-22)

The round-2 design (README.md, DESIGN.md) is now in the app, in the work copy `work/xr`. The main tree is untouched.
This file says what was built, how it was checked, and what is left.

## In short

- **One new module, `src/figure.js`** (about 1,700 lines). It holds the composer, the presets, every view's figure,
  the formats, the LaTeX snippets and the dialog. `build.py` loads it before `app.js`.
- **`app.js` changes are small** (about 140 lines changed, in self-contained blocks):
  - the art-layer flag (`artMode`) and the print tones (`printInk`);
  - `artRender`, the exact-window render;
  - the bridge (`Figure.attach`), the export menu and Cmd/Ctrl+E.
- **`page.html`**: the dialog's CSS replaces the old `.fig-*` block.
- **The screen is unchanged.** Every renderer change is behind `artMode`, which is only on inside one synchronous
  off-screen render.
- **Every view exports**:
  - X → Y: two panels with the F arrow, or one of them.
  - Phase: colour with level lines and a ring key, or a black-and-white contour portrait.
  - Landscape: new. One 3D panel with a thin frame and vector floor axes. The caption names the height.
  - The deformation: a filmstrip, or the paths figure.
  - The merged one-panel cases: H_t on the globe, H_t over a d/dz step, and Phase on the sphere.
- **The user's decisions are in**:
  - Homework is 469.75 pt by default (1 in margins on Letter) and only ever shrinks. The Size menu still lists
    360 pt and A4.
  - Homework draws open boundaries dashed and adds "Dashed: boundary not included." to the caption.
  - Article has a **One column · Two column** switch in the Size row. One column is `amsart`, 360 pt. Two column is
    REVTeX 246 pt; the menu also has IEEE 252 pt and the full widths 510 / 516 pt (`figure*`). The last choice is
    remembered.

## Look at these

- `work/xr/test/regress/export/out/latex/test-*.pdf`: every exported figure compiled in the class it was made for.
  - `test-article1.pdf`: `amsart`.
  - `test-article2.pdf`: REVTeX two-column.
  - `test-article2W.pdf`: REVTeX `figure*`.
  - `test-homework.pdf`: Letter, 1 in margins, 11 pt.
  - `test-slides.pdf`: Beamer 16:9.
- `work/xr/test/regress/export/out/*.pdf|png|svg|tex`: 44 figures and 163 files, as the app writes them.
- The dialog: `test/<you>_cdp/shots/export-dlg-{1440,760,360}-{light,dark}.png` after a run of `test/export_cmd.js`.

## What was built

### The renderer (app.js)

- `artMode` guards everything that is not a fill:
  - the grid, the shape strokes, points, cuts and cut banks;
  - the field of view, chevrons, rulers and roots;
  - the deformation tint and outline;
  - the Phase grid and axes;
  - the landscape's labels, outlines, graph paper and footprint.
- `printInk(s)` gives `shapeInk` the print tones: fixed OKLab lightness per shape. B/W uses #8C8C8C / #DBDBDB.
- `artRender(side, {box, wpt, dpi, ink, T})` draws one plane off-screen:
  - for an exact world window, in the light theme, on white;
  - at time T of the deformation, paused.
  - Theme, view, tones and t change only inside one synchronous block, so no screen frame sees them.
  - It returns opaque RGB, plus the landscape's camera for the vector floor labels.
- `prepareExport` takes an exact view per panel (`dims.views`). Hidden panes of a merged view use the visible pane's
  height.

### The figure (figure.js)

- **Composer** (from `proto/compose.js`):
  - MathJax outlines with exact metrics and one namespaced glyph table;
  - box and cross axes, the halo only over fills, the 8-direction label placer;
  - our own PNG encoder (grey, RGB or indexed; pHYs; iTXt);
  - ragged-right captions.
- **Vector layers** (new):
  - Boundaries and curves are `Region.mapCurve` samples through F, in pt, at 0.25 pt tolerance.
  - Formula areas (`|Im z| < π/2`) have no boundary curves in Region. Their boundary is the zero set of the level
    function: marching squares on a 720 × 720 grid, joined by edge ids, oriented with the set on the left. It is then
    refined through F like any curve.
  - Homework draws orientation chevrons at a parameter that shows in both panels. The caption mentions them only when
    they are drawn.
- **Framing**:
  - *Fit content* is the content plus 8 % of each side's own span, snapped to half a tick step.
  - A side that the content runs off keeps the screen window's edge there.
  - *As on screen* is in Fine-tune.
- **Labels**:
  - Tick labels on cross axes get the halo over fills.
  - A y label that would touch an x label at a corner is left out.
  - Film and paths figures reserve room for the last x label.
  - The F arrow stays clear of both real axes in cross mode.
  - Homework's arrow shows `w = \dfrac{..}{..}` when it fits.
- **Phase**:
  - Level lines at multiples of π/6 are added only where the colouring draws none of its own (`enhanced`, `phase`).
  - The caption follows the colouring style (enhanced, phase, modulus, grid, classic, Cauchy).
  - Zeros and poles come from `Calc.zerosPoles`, bounded at 400 ms.
- **Slides**: a figure is at most half as tall as it is wide, so it fits under a 16:9 frame title.
- **Landscape**:
  - The art layer has a white plate with its contact shadow.
  - It is cropped to the relief and the projected floor corners.
  - The two front floor edges are vector axis lines with ticks, numbers and Re z / Im z.
- **Deformation**:
  - The filmstrip has 4 frames: one row at full width (≥ 400 bp), 2 × 2 in a column.
  - The window is the union of the frames.
  - The t = 0 boundary is dashed gray in the later frames.
  - Marked points have shaped dots and their paths: solid up to t, dotted after.
  - The paths figure keeps the old morph figure's selection and caption (it calls the old `buildFigure`). It is now
    drawn natively: the region at t = end over X's dashed outline, and 0.45 pt paths with 3 pt heads.
- **Captions** are generated in journal register:
  - en-US, with the map as an inline slash fraction.
  - Homework names points A, B, C… in both the figure and the caption.
  - Phase and Landscape of the deformation name H_t, its t and its homotopy.
- **Formats**:
  - `figurePDF`: jsPDF + svg2pdf, with glyph `<use>`s inlined. It has no fonts, no SMask and no alpha, and the
    MediaBox is the layout width.
  - PNG: 300 or 600 dpi, opaque, with pHYs.
  - SVG: in pt.
  - LaTeX snippet:
    - Article uses `[tbp]`, and `figure*` at full width, at natural size.
    - Homework uses `figure[H]` with `width=\ifdim\linewidth<W \linewidth\else W\fi`.
    - Slides uses a Beamer frame.
    - The name and `\label` come from the scene (`strip-to-disk`, `fig:strip-to-disk`).

### The dialog and the menu

- **Layout**:
  - The paper preview fits the column, with See in grey and Loupe.
  - For · Size (with the One/Two column switch, the Size menu, Text size, and Paste `\the\linewidth`) · Ink, plus the
    Deformation row (Filmstrip · Paths) in the deformation.
  - Fine-tune holds Crop, Axes and Panels.
- **Caption**: it is edited on the paper. Clicking it opens its LaTeX source. Regenerate brings back the generated
  caption.
- **Footer**:
  - an inline file name;
  - More formats: PDF, SVG, PNG 300/600, Copy LaTeX only, Save LaTeX (.txt), Copy image;
  - **For Docs**: image/png + text/html on the clipboard, else a selection copy, else a saved PNG;
  - **For Overleaf**: copies the snippet first, then saves the PDF.
- **Export menu**: *Export figure…* (⌘E / Ctrl E), *Copy figure again*, *Save figure again*. The last two are
  disabled until a first export.
- **Settings** are remembered in `localStorage` under the app's `lsk('cmw-figure-v1')`, wrapped in try/catch. The
  dialog works with storage blocked.
- **Downloads** are unchanged. The dialog saves pdf, png, svg and txt.
- **Widths**: 1440 px is two columns, 760 px one column, and 360 px a sheet with a sticky footer. The paper stays
  white in both themes.

## Checks (all run on the built app in headless Chrome, port 8831)

| Check | Result |
|---|---|
| `test/export_cmd.js` (new): 44 figures and 163 files. Every view × Article 1 col / 2 col / 2 col full width / Homework / Slides × colour (B/W for Article and Homework) × PDF/SVG/PNG/LaTeX. Also the dialog at 360/760/1440 in light and dark, remembered settings, the caption edit, For Overleaf, For Docs, More formats, the menu's *again* entries, and storage blocked. | **pass** |
| `test/regress/export/preflight.py --latex` (new; port of `proto/preflight.py`) | **0 failures in 439 checks**: no fonts, SMask or alpha; MediaBox = target; PNG opaque with pHYs; no duplicate ids, nested `<svg>` or dangling refs; no label collisions; every snippet compiles in amsart, REVTeX (column and `figure*`), Letter 11 pt and Beamer with no overfull box and the measured width as claimed |
| `test/mv_views_cmd.js` (export section moved to the new dialog) | pass |
| `test/morphfig_cmd.js` | pass |
| `node test/t_*.js` | pass, except 4 checks of `t_tour.js`: anchors `phaseKey`, `soundBtn`, `soundBar` and `phaseStyle` that `notes/tour/INTEGRATION.md` documents (the tour and sound work edit that file). `src/tour.js` is unchanged here |
| quality suite + `compare.py --only quality --quality-enforce-targets` | **PASS**: 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW; 259 targets met; golden diffs 0 |
| perf | not run: a perf gate from `work/xs` was running |

Speed: a figure builds in 70–360 ms (median 167 ms). A PDF takes 0.2–0.6 s more.

## Changed tests

- `test/mv_views_cmd.js` section 5 reads the new dialog: `__cmwFig.dialog()`, `#xfDeform`, `f.view`. Its
  expectations follow the new design:
  - the deformation exports the filmstrip by default (4 images), with Paths one click away;
  - Phase has 2 images (the art and the ring key);
  - captions start "Landscape of $H_t$" and "Phase portrait of $H_t$".
- The old hooks still work: `__cmwBuildFigure` (the old builder, used by morphfig, deform_nat, zp, curves and p3/p5)
  and `__cmwLastFigure` (now the new figure). `__cmwFig` (new) exposes the module to tests. All of them sit between
  the TEMP-DEBUG-HOOK markers.
- `test/p3_accept_cmd.js` (h), the two dialog checks (v14 gate fix, round 1): they drove the old dialog (`#figWidth`,
  `.fig-preview`, the menu item "Figure for an article"). They now open the new dialog (Cmd/Ctrl+E), pick Article and
  2 columns, then switch Columns 1, 2, 1, 2, 1 at 15 ms. Checks as before: the last option wins (`fig.cols` and the
  checked button are 1), and no main-thread task over 50 ms meanwhile.

## The art raster and the main thread (v14 gate fix, round 1)

The gate found a 51–54 ms main-thread task in 6 of 19 runs while the dialog's preview was rebuilt (v13: 0 of 16).
A panel's art is 1 to 4 Mpx at 600 dpi, and its readback, flattening, palette and PNG filter ran in one task.
Same bytes out, shorter tasks:

- `toIndexed` (figure.js) uses typed arrays for the histogram and the lookup, not Maps. Keys keep their order of
  first appearance and the sort is stable, so ties come out as before.
- The fade to white (Homework, Slides) finds each column's and each row's factor once; the pixel's factor is the
  smaller one. It allocated four arrays per pixel before.
- `artRender` (app.js) copies opaque pixels; the formula gives the same bytes there.
- `XD.art` yields (`scheduler.postTask`) before each step: fade, luminance, palette, PNG. The palette's two pixel
  loops run in slices of 64 K pixels and yield once 8 ms have passed. (Without the slices, 4 of 94 runs had one
  59–60 ms task; the two that were traced were in the palette pass.)

Checked: `XD.art` old and new on 16 rasters captured from the dialog (Article 1 and 2 columns, Homework and Slides
with fade, B/W) and 6 synthetic ones (noise, 300 colours, ties, fades, 1 px): the same data URL, encoding, size and
luminance in all 22. `export_cmd.js`: the 35 PNG files are byte-identical to the gate build's; the SVGs differ only in
the random id prefix. The longest task while a preview builds (heartbeat, 1440 × 900, z^i(H)): Article 39–48 → 10–17
ms, Homework 122 → 28 ms, Slides 76 → 14 ms, colour after B/W 71 → 13 ms. With the slices: 24 fresh pages, Columns
toggled, no task over 50 ms, longest art step 15 ms (also 0 of 8 in the gate's paired script, and p3_accept). Left: a garbage-collection pause can still land in a step (one
`encodePNG` call took 43 ms in those 24 runs, against under 2 ms usually).

## Not done yet

- **Real paste tests**: For Docs in the published artifact (Docs, Word, Chrome, Safari), and the upload in Overleaf.
  Headless runs only record the clipboard calls.
- **Perf run**: not run, because another workflow's perf gate was running. Exporting adds no work per frame, but
  `test/regress/perf/run.sh --paired --quick` should still be run.
- **Labels by LaTeX** (the TikZ overlay bundle), *All views (.zip)* and the animation are not built (as in the design:
  deferred).
- **Reopen from metadata**: the scene JSON is written into the SVG, the PDF (XMP) and the PNG (iTXt), but nothing
  reads it back yet.
- **Landscape height scale**: the screen's height ruler is not in the figure. The caption names the height instead.
- **The smooth contrast fade at accumulation points** (B3) is not done.
- **Point labels in Homework**: they are always A, B, C…, even when the user named a point (the caption then says
  "the point $A=0$").
- **Merge notes**: app.js changes touch `shapeInk`, `drawScene`, `drawPoints`, `drawCuts`, `drawCutBanks`,
  `drawFov`, `drawChevrons`, `drawRulers`, `drawRoots`, the Phase overlay, `render3D`, the deformation ghosts,
  `prepareExport`, the export menu and the key handler. The old dialog (`openFigureDialog`, `figurePDF`,
  `figurePNG`, `latexFigure`) is removed. The old `buildFigure` stays: the paths figure and older tests use it.

## Review fixes on the merged build (export, sound, tour), 2026-10-22 evening

The four reviews of the merged build (export, sound, tour, regressions) found 37 problems. All edits are in
`work/xr`. The findings and their evidence are in the reviewers' folders under `work/xr/test/` (`xrrev_cdp`,
`rvsnd_cdp`, `tourrev_cdp`, `rv_cdp`). My checks are in `work/xr/test/xrfix_cdp/rv/`.

### Export: fixed

- **Open and closed sets agree (H1, H2).** Spec 6.5 treats a drawn area as closed. Its caption now says so:
  "the disc $|z|\le 2$", "the annulus $0.5\le|z|\le 2$", "the half-plane $\operatorname{Im} z\ge 0$". The
  complement of a drawn shape is open: "the complement of the disc $|z-c|\le r$" is drawn dashed. Typed formulas keep
  their own relations. (`app.js` `shapePhrase`.) To flip the convention instead (strict captions, drawn shapes open),
  change `Region.isOpen`; that is the user's call.
- **A curve on an open boundary (H2).** When a drawn curve lies on a piece of an open boundary (the Joukowski circle),
  that piece is left to the curve: no dashes under a solid line. The "Dashed" note appears only when a dashed boundary
  is really drawn. (`figure.js` `coveredBy`, `planeLayers`.)
- **B/W Homework (H3).** "3 2" now means only "boundary not included". Other curves are told apart by dots (`0 1.8`)
  and dash-dot (`4 2.2 0 2.2`). Article B/W keeps its old cycle.
- **Chevrons (M4).** One on every boundary piece (up to 6), placed away from the axes (score: distance to the nearer
  axis in both panels, then the middle of the curve).
- **The figure no longer depends on the window size (M5).** A set that runs off two opposite sides (a strip) gets a
  3:2 window around the view's centre. Strip to disk at 1440, 760 and 375 px: all 358.66 × 155.73 bp.
- **Landscape at 300 ppi (M6).** The crop is enlarged to the panel, so the relief is rendered a second time at
  300 dpi × that enlargement. Now 300 ppi in every preset (376 in Slides). Builds take 70–210 ms.
- **Landscape window rounded (M7).** The window's edges snap to a step of about an eighth of each side:
  "over $[-8,8]\times[-5,5]$". (`app.js` `landBox` takes the figure's window, in art mode only.)
- **Dialog (M8, M9, L15, L39).**
  - Tab and Shift+Tab stay inside the dialog (0 escapes in 40 Tabs at 1440, 760 and 360 px).
  - The For control's big buttons grow to fit icon, label and subtitle.
  - Ink and Deformation span the full width like For and Size.
  - Fine-tune says "Crop" in Landscape (no Axes row there).
  - "Paste \the\linewidth" reads pt, in, cm, mm and bp, and says why when it cannot.
  - The file name field is as wide as the name (up to 40 characters).
  - At phone width the preview's hint wraps instead of being cut.
- **Loupe on touch (M10).** Pointer events: a finger or pen pressed on the paper shows the loupe; it hides 1.6 s
  after the finger lifts. (Checked with synthetic touch pointer events, not on a device.)
- **Captions (L11).** "the trailing edge $z=1$"; Homework "Left: …. Right: their images under $w=…$."; "a
  checkerboard of squares of side $1$"; inline $|\operatorname{Im} z|<\pi/2$ (no `\left|`, no stacked fraction).
- **Log annulus (L12).** The F arrow and the caption use the image panel's variable ($w_1=\log z$, as the axes say).
  Each axis keeps two labelled ticks (a narrow panel gets a finer step of its own). In cross-axis mode a curve lying
  on an axis is drawn again above it.
- **Filmstrip (L13).** The dotted rest of a path leaves out what is already drawn, so a path that doubles back shows
  even dots.
- **Phase (L14).** The white hairline is the renderer's $|F|=1$ line (the Tiles style draws it on screen too). The
  caption now says "the white line is $|F|=1$".
- **Paths figure (L15).** Its plane is labelled "z, w".
- **Saves (M38).** `saveFile` returns true only when the file was saved. A declined or refused save no longer shows
  "Saved", the Overleaf hint, or becomes the last destination.
- **Guide (L40).** The Keys list has ⌘E / Ctrl E, Export figure.

### Sound: fixed

- **Esc stops the sound everywhere (M17, L20).** A capture-phase Escape listener stops sound before the export
  dialog, the palette, a menu or the tour handle that Escape. During a tour, the Esc that stops a Listen along does
  only that; the next Esc ends the tour. `tourApi.busy()` also counts a playing Listen along and a keyboard loop.
- **The 3 ms budget holds (M18, L19).** `Calc.argStep` and `Calc.orderAt` take a wall-clock `deadline`, checked every
  32 calls; the tracker passes `t0 + 3`. The per-call cost is now total time over total calls across events, so the
  0.1 ms clock steps average out. New unit checks in `t_sound.js` (64/64).
- **Shift+M in a menu (L22).** It passes the menu guard, as ⌘K does.
- **Click detector (L21).** `test/sound_clicks.py` stops with an error below 20 kHz (4 × its 5 kHz band).

### Tour: fixed

- **Reload mid-tour (C25).** The page clears its heartbeat on `pagehide`. A backup written while the autosave was
  held records the saved copy's fingerprint (`tourApi.savedMark`). Such a backup is dropped, never restored, when a
  saved copy exists (it is the user's work or newer). A fresh heartbeat of another page means "look again later",
  not "give up". The reviewer's repro now keeps z³.
- **Scrolling (H26, H27).** `reveal()` scrolls the lit area into the band between the top bar and what is fixed at
  the bottom (and the phone's sheet). It scrolls to a computed position, waits for `scrollend`, and measures again.
- **Phone Try it (H28).** "Your shapes" asks for the drag only at 640 px and wider (`tryWide`).
- **Callouts (M29, M30, M31).** Preimages and Targets light Y with X beside it; Derivative lights X with the chain.
  `place()` gains a near-miss rule: below or above the hole at the viewport's edge, over its rim only. At 1440 × 900 no
  callout covers X, the disc, or the chain.
- **The suggestion and the keyboard (M32).** Tab from Help goes to the card, Shift+Tab goes back. Escape on the page
  hides it (unless a menu, dialog, field or app action takes that Escape).
- **Copy and counts (L34, L35, L36).** The ⋯ fallback shows "in this menu". "Phase key" is a wide-screen step, so the
  phone count reads "1 of 5". A tour's "Your work is back" toast is removed when the next tour starts.

### Rejected or left for the user

- **L33, the suggestion shows on up to 3 openings.** DESIGN.md chose 3 on purpose; the review lens says "once". This
  needs the user's decision (one line: `SUGGEST_MAX` in `src/tour.js`).
- **L11 (5), $f_1$ against $F$ in Article captions.** Not a fault: with a step focused, the figure shows that step, so
  it is named $f_1$. Homework now names the map by the image panel's variable.
- **I23, the voice comes back after Esc while the pointer moves.** A design choice for the user.
- **Not done:** the arrowheads that pile up inside the disc in the paths figure (L15 4); a cue-on case in the click
  regression (L21); a real touch device for the loupe.

### Checks after the fixes (work/xr, port 8839)

| Check | Result |
|---|---|
| `node test/t_*.js` (20 files) | pass; `t_tour` 928/928 (4 new checks), `t_sound` 64/64 (2 new: the deadline) |
| `export_cmd.js` (44 figures, 163 files, dialog at 360/760/1440 px) | pass |
| `regress/export/preflight.py --latex` | 0 failures in 439 checks; every snippet compiles |
| `sound_cmd.js` | 2 runs on the final build: the second passed every check. The first failed only "queue: 12 turns → 8 bells" (9 bells); `sound.js` is unchanged and that check passed in every other run, so it looks like a stray bell from the previous step (a flake to watch) |
| click regression at 48 kHz (`sound_clicks_cmd.js` + `sound_clicks.py`) | worklet: 0 clicks in 9 cases; fallback: 2 detections at −58.7 and −58.6 dB re local RMS (below the −50 dB snap line) |
| `tour_cmd.js`, `tour_lit_cmd.js` | 92/92, 70/70 |
| `mv_views_cmd.js`, `deform_nat_cmd.js`, `zp_cmd.js`, `morphfig_cmd.js`, `curves_cmd.js` | pass |
| quality suite + `compare.py --only quality --quality-enforce-targets` | PASS: 81 runs, 0 failed, 259/259 targets, golden diffs 0.00000 |
| perf `run.sh --paired --quick` | first run: 1 FAIL (`image.ziH.m240.dpr2.zoomR.out.frame_p95_ms` 15.6 ms) while the runner warned "machine busy, load 6.2"; the unit re-run alone: PASS (13.5 ms, under the 14 ms budget). The reviewer's run before the fixes had 11.8 ms on the same metric against the same pre-sphere reference, so the fixes do not move it |
| reviewers' repros | reload mid-tour keeps z³; crash case: backup kept while the dead page's heartbeat is fresh, dropped 6 s later, work kept; Esc stops sound in tour, card, export dialog and palette; Shift+M in the Help menu; declined and rate-limited saves show no "Saved"; Strip to disk is 358.66 × 155.73 bp at 1440, 760 and 375 px |

Evidence images (small): `work/xr/test/xrfix_cdp/evidence/`. Repro scripts: `work/xr/test/xrfix_cdp/rv/`.
`test/regress/perf/run.js` now serves its own `dist/` when the default server (8793) serves another tree's build.

## Second-round review fixes (work/xr, 2026-10-22, late evening)

Ten findings from the second review, eight first-round findings the first fixer never saw
(`notes/workflows/xr-review1-missed.json`), and the user's request to drop "No shapes yet". All edits are in
`work/xr`. Checks and evidence: `work/xr/test/xrfix2_cdp/` (port 8842).

### Fixed

- **Chevron orientation (high).** Each boundary piece is now marked so its set stays on the left (`figure.js`
  `senseAt`: it compares the level function a little left and right of the curve).
  - Annulus: the inner circle runs clockwise, the outer counterclockwise. Under log the left edge runs down and the
    right edge up.
  - Complement of a disc (Joukowski): the circle runs clockwise; the airfoil is marked the same way.
  - Quarter plane: out along the real ray, in along the imaginary ray.
  - The direction is taken from a parameter step of under 0.5 pt in the panel, so long pieces (lines, rays) point
    the right way under a curved map.
  - New Node test `test/t_figure_chevron.js` (64 checks).
- **Export window of unbounded sets (M5, medium).** Fit no longer depends on the pane's size.
  - X's window comes from its view (centre and scale) and a fixed reference pane of 480 × 360 CSS px (`sceneWin`).
  - Y's window is the box of the image of what X's panel shows (`imageWin`), trimmed 0.5 % for poles, plus 8 %.
  - The quick render looks twice as far as the window, so a bounded set is framed whole; a set that reaches that
    larger window's edge is unbounded there and keeps the window's edge.
  - New bridge call `A.viewOf(side)` in `app.js`.
  - Checked at 1440, 1024 × 1366, 760 and 375 px: strip, quarter plane, Joukowski, log annulus, sine half-strip and
    Cayley give the same windows and heights in Homework and Article (`xrfix2_cdp/figs.out.json`). Strip to disk is
    still 358.66 × 155.73 bp in Article.
  - *As on screen* still uses the screen.
- **Chevrons on axes (low).** `chevronAt` scores each candidate by its distance from the axes, from their crossing and
  (on an axis) from the labelled ticks, in both panels. A line or ray is also sampled densely where it crosses the
  window. Cayley: the mark sits between −2 and −1 on the real axis and off both axes in w. Quarter plane: one mark on
  each ray (between 2 and 3, and between 1 and 2), so its caption now says "Arrowheads: orientation."
- **Tick labels on curves (low).** A cross-axis label that every textbook place puts on a curve now slides along its
  axis (at most half its width) to the middle of the widest clear run. Log annulus: "−0.5" sits between the left edge
  and the dotted line (`xrfix2_cdp/evidence/zoom-logann-right-v3.png`).
- **Touch loupe (low).** For a finger or pen the lens floats 110 px above the contact, inside the stage (beside or
  below it when there is no room above). `pointercancel` ends like a lift. Checked with `await`: shown, ≥ 99 px from
  the contact at 4 places and 2 widths, hidden 1.8 s after a lift and after a cancel. Not tried on a real device.
- **Dialog gutter at phone width (low).** At ≤ 560 px the dialog is `100vw − 24px` wide: 12 px on both sides at 360
  and 390 px. `export_cmd.js` now checks that both gutters are equal. The preview's images stay hidden until their
  first picture, so no broken-image icon or alt text shows while typesetting.
- **Published charset (low).** `build.py` puts `<meta charset="utf-8">` first in the published page. Served raw by
  `http.server` it decodes as UTF-8 with no errors (it threw a SyntaxError before).
- **"No shapes yet" (user, 2026-10-22).** The empty plane shows nothing over it: `syncEmptyState`, `#emptyState`
  and its CSS are gone. The Shapes list shows no row and no note for an empty z-plane (heading and controls stay).
  The chain card's summary is empty (`.card .note:empty` hides it). Drawing, the polygon draft chip and the tour
  still work. The tour never anchored on the note. No golden scene is empty, so the golden images are unaffected.
- **Copy figure again (from regressions-1).** Its PNG fallback no longer says "Saved" after a declined save.

### First-round findings the first fixer never saw

- tour-10, tour-11, tour-12, regressions-1, regressions-2, regressions-3, regressions-4: already fixed in round 1
  under other ids (L34, L35, L36, M38, L39, L40, and the perf runner change). Code: `tour.js` 464 and 1026 ("in this
  menu"), 126–127 (`wide: true`), 779 (toast removed); `figure.js` save paths check `saveFile`'s result; `fitName`
  sizes the file name (8–40 ch); `app.js` Keys row "Export figure"; `perf/run.js` 1171–1182 serves its own `dist/`.
- tour-9 (the suggestion shows on up to 3 openings): left for the user. One line: `SUGGEST_MAX` in `src/tour.js`.

### Load-dependent findings (re-run on a quiet machine, load 2.6 to 5)

- **Quality suite (medium):** a clean full run with targets enforced. No baseline was changed.
- **Quick paired perf (medium):** completed. Two jank spikes in the full run; the unit alone passes (below).
- **Acceptance fps (low):** zp drag and play, morphfig long tasks and the deformation fps all pass at 60 fps.
- **Second-round finding 9 needed no code change**, as the reviewer said.

### Checks after the fixes (work/xr, port 8842)

| Check | Result |
|---|---|
| `node test/t_*.js` (21 files, new `t_figure_chevron.js`) | all pass; `t_figure_chevron` 64/64, `t_tour` 928/928, `t_sound` 64/64 |
| `export_cmd.js` (44 figures, 163 files, dialog at 360/760/1440 px, new gutter check) | pass, on the final build (median build 163 ms, max 287 ms) |
| `regress/export/preflight.py --latex` | 0 failures in 439 checks; every snippet compiles |
| `tour_cmd.js`, `tour_lit_cmd.js` | 92/92, 70/70 |
| `sound_cmd.js`, `mv_views_cmd.js` | pass, pass |
| `zp_cmd.js`, `morphfig_cmd.js`, `deform_nat_fps_cmd.js` | pass; zp drag 60 fps (p95 18.3 ms), play 60 fps; deformation 60 fps in all 5 scenes |
| quality suite + `compare.py --only quality --quality-enforce-targets` (load 4–5) | PASS: 81 runs, 0 failed, 28 improved, 259/259 targets, golden diffs 0.00000 |
| perf `run.sh --paired --quick --base http://localhost:8842/` (load 2.7–5) | 444 pass, 66 improved, 2 FAIL: `morph.open.ex4.jank_ms` 56.0 ms and `ex7` 54.4 ms. The unit re-run alone (`--paired --only 'morph\.open'`): PASS, 16.8 and 18.5 ms (reference 14.2 and 12.3). One-off spikes; nothing in this pass touches opening the deformation |
| published page served raw (no charset header) | UTF-8, no console errors, no `__cmw` globals |
| empty plane, drawing, draft chip (`xrfix2_cdp/chk.js`) | no note over the plane; no "No shapes yet" anywhere; a disc draws; the polygon chip shows |

### Not done

- Phase, Filmstrip and Paths figures still take their window from the screen (only X → Y was in the finding).
- The chain card's thumbnail still writes "No shapes" on an empty plane, and the w-plane group of the Shapes list
  still says "No targets yet": both are outside the user's words; ask before removing them.

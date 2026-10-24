# Image export, round 3: as built (2026-10-23)

The user asked (2026-10-23):

> Allow export of the deformation plots as deformations. Now they are exported as deformations only for Plane-shape
> figure. Also allow for png, svg, and video exports (video for deformations). In case of png provide latex-copiable
> snippet. Write the formula for F in displaystyle, since it might be too complicated to fit inline.

All work is in `work/xve` (a copy of v14 = `work/v15-base`). The main tree is untouched. The earlier decisions in
`README.md` stand (Homework 1 in margins, shrink only; dashed open boundaries; One column / Two column).

## Verify round (2026-10-23): 5 items closed

`review-r3-verify.json` re-read the review round and left 5 items open. All 5 are fixed at the root; `ledger-r3.json`
has an entry for each (`verify-editor-3`, `-13`, `-8`, `-7`, `verify-new-1`). Where this section differs from the ones
below, this section wins.

- **Globe marks (editor-3).** A point shape whose path is not drawn (z₀ = 0) is now a square (then a triangle, a
  diamond), never a second kind of dot. The caption says: "The square is the image of the point $z_0=0$; in (a) and
  (d) it is on the far side of the sphere." In B/W the dot and the square are both black, and still tell apart. A slide
  has no caption, so a key under the frames shows each marker with $H_t(0.8i)$ and $H_t(0)$. The paths figure marks
  such a point with a square too. Russian "dot" is now «жирная точка», so a caption never reads «точки 0,8i (точка)».
- **Where F's display goes (editor-13).** "The map is" is gone. The display follows the phrase that names F: at the
  first ':' or ';' after F (within 100 characters), and the rest becomes a new sentence ("Phase portrait of $F$ on
  $[-7,7]\times[-5,5]$, where \[F(z)=…\] The color shows …"). Otherwise it goes at the end of that sentence. The globe
  captions are now two sentences, so the display comes right after "… to $F$ ($t=2$), where". If the sentence already
  has its own "where" («где»), it ends there and the display follows "Here" («Здесь»): «… где
  ${H^{(2)}_{s}}'(p)=e^{-\pi i s/2}$. Здесь \[…\]». The B/W Phase and Landscape captions no longer put ", where" after an
  unrelated clause.
- **Globe video labels (editor-8).** Both looks now draw 0, ∞, 1, i, −1, −i themselves, dark on a white halo. Each is
  drawn wherever its point faces the camera, at 2.8 % of H; ∞ is 1.5 times larger, since its glyph is only x-height
  tall. The crop leaves room for them. On screen the app fades a label near the rim, and the north pole sits near the
  rim: that is why ∞ was almost white. The export hook `noGlobeLabels` (app.js) stops the art layer drawing its own
  labels, but it still records where they go, so point labels keep clear of them. In decoded 720p frames the darkest pixel
  of ∞ is 1 to 5 (was 221). Its ink is 12 × 20 px (was 11 × 22) and starts 32 px below the top edge (was 4 px). The
  Print look now draws ∞ too.
- **Video length (editor-7).** Rule: **the Length is per step.** The menu reads "2 s per step", "3 s per step",
  "4 s per step", "6 s per step" (default 3), with the label "Length of each step". The line under the poster still
  gives the whole video's length. A 5-step chain takes five times as long as one step, plus the 0.6 s holds between
  steps. It is never squeezed into a fixed time.
- **Line spacing in the image's own caption (new-1).** It now follows TeX's rule. Baselines are 1.2 pt apart. When a
  line's depth plus the next line's height would leave less than \lineskiplimit (0), the lines are set \lineskip
  (0.1 pt) apart instead. A tall superscript ${H^{(2)}_{s}}'$ no longer touches the line above, in English or Russian.

Look at these (in `round3/`): `verify-globe-film-article.png` and `verify-globe-film-slides.png` (the square and the
slide key), `verify-latex-globe-amsart.png` (amsart, compiled: the display right after F's sentence),
`verify-phase-docs-ru.png` and `-en.png` (the image's caption at 200 dpi), `verify-video-globe-light-t1.00.png`,
`verify-video-globe-print-t2.00.png` and `verify-video-phasesphere-light.png` (720p frames decoded back from the MP4).

Checks (work/xve, headless Chrome on port 8966, load 4 to 13):

| Check | Result |
|---|---|
| `test/export_cmd.js` | **pass, 0 failures**, 80 figures + 36 round-3 figures. New checks: no "The map is", at most one where/где in the sentence the display ends, F's display within 160 characters of $F$; the globe square, its frames and its sentence; the slide key; no two pieces of the image caption overlap (each deformation view, English and Russian); the ∞ label in the globe video (in the frame, ≥ 4 % of H, darkest pixel under 80: got 1); frames per step (1, 2, 5 steps: 193, 331, 745 at 4 s); the Length menu says "per step". The first full run had one task of 55 ms in the globe video at load 5. Four more globe videos had none (drawing 1-2 ms a frame), and the final run had none |
| videos | plane 1920x1080 60 fps bounce print: 529 frames; globe 1080x1080: 211; phase, phase sphere 1280x720: 211; landscape loop: 678; WebM VP9: 151. Decoded frame against the exact render: mean abs difference 0.12 to 1.08 of 255 |
| `preflight.py --latex` | **0 failures in 958 checks**. Every snippet compiled with pdfLaTeX and XeLaTeX, English and Russian, in amsart, REVTeX (column and figure*), Letter 11 pt and Beamer: no error, no overfull box |
| Node | `t_i18n.js` (16384), `t_i18n_keys.js`, `t_i18n_parse.js`, `t_i18n_english.js`, `t_cyr.js`, `t_views.js`, `t_figure_chevron.js`: pass. `tools/make_ru_table.py --strict`: unresolved 0 (8 new Russian strings, 3 retired, in `notes/i18n/ru/v15-export.json`) |

Not re-run: the quality suite. Its panes draw the sphere labels as before; `noGlobeLabels` is set only for video frames.

## Review round (2026-10-23): 32 findings fixed

Two reviews read the first build: `review-r3-editor.json` (21 findings) and `review-r3-video.json` (11). Every
finding is fixed at its root. `ledger-r3.json` has one entry per finding: the root, the change and the check. The
sections below this one describe the first build; where they differ, this section wins.

What changed, in short:

- **The display defines the steps.** A caption that names f_1, f_2 ends that sentence with a display of the chain,
  each line in display style: F(z) = (e^z - 1)/(e^z + 1), F = f_2 ∘ f_1, then f_1(z) = e^z, f_2(w_1) = (w_1 - 1)/(w_1 + 1).
  Lines are packed to the caption's width. The homotopy sentence is no longer circular: "Here H_t, 0 ≤ t ≤ 2, deforms
  the identity into F and runs the steps in turn: ...". A displayed formula is in normal form (z - (0.5+0.3i) over
  1 - (0.5-0.3i) z).
- **One name and one label per figure**: strip-to-disk-phase-film, -phase-frame, -globe-paths, -landscape-film,
  -deformation-film, -phase-video, .... The dialog's name follows the figure until the user types one.
- **Short captions are short**: "Phase portraits of H_t at t = 0, 2/3, 4/3, 2." (under 100 characters).
- **A dash means "not included", everywhere.** The boundary at t = 0 and X's outline are thin solid gray. In Homework
  the open boundaries of H_t(X) are dashed in every deformation figure, the globes included (drawn through the
  camera), and the caption says so. The Print video dashes them too.
- **The globe names what it tracks**: "the path of the point 0.8i (dot)". A listed point is drawn where it faces the
  camera, or the caption says it is on the far side.
- **Reliefs**: Re and Im marks on each frame's floor, no phase print on the floor, and |H_t| = 1 drawn as an
  ordinary contour (the screen's white sea-level line widened into bands where |H_t| stays near 1). The screen and
  the video label the height axis |H_t| while the deformation is on.
- **Phase**: the level lines no longer run along a branch cut (a crossing on an edge where H_t jumps is dropped), and
  the filmstrip's portraits are supersampled 2 x 2, so the cut is a clean edge. Colour and B/W use one window.
  Russian intervals use one separator per product.
- **Snippets**: PNG and SVG use the shrink-only width in Article too. A slide names F in its title (or displays it
  under the figure). Slides filmstrips are one row of four. PNG defaults to 600 dpi for Article, with "For a journal,
  PDF is better". The LaTeX box wraps.
- **Video**:
  - The window is the screen's by default ("As on screen"; "Fit the motion" is the other choice), and the screen's
    paths are drawn.
  - Tick numbers in both looks, axes in Print, the ring key for Phase.
  - Globes and reliefs are cropped to what they draw and their labels are about 3 % of the frame's height.
  - Each step is eased on its own, with a 0.6 s hold at every whole t and 1.2 s at the ends. Loop fades back to t = 0.
  - The t label is an italic t with upright digits.
- **The video's machinery**:
  - Export renders no longer flip the page's theme. The light tokens are read once, and the theme observer skips an
    unchanged theme. This was the cause of the 78-440 ms tasks in the dark theme.
  - A hidden tab keeps the pace: no timers in the frame loop.
  - "Save figure again" after a video opens the dialog on Video.
  - The encoder is checked up front: Video is disabled with a reason, and the name shows .webm when only VP9 works.
  - The progress bar has a value and is announced by quarters. The dialog no longer moves, and the options are
    locked during a run.
  - The MP4 muxer keeps decode order (ctts when needed) and refuses a missing avcC. The WebM has Cues and a SeekHead.
  - Nothing of the last video is kept unless a test asks.

Look at these (all in `round3/`):

- `fix-latex-phase-film.png`: the phase filmstrip in `amsart`, compiled, with the chain display.
- `fix-globe-film-homework.png`: the globe filmstrip in Homework: the dashed open boundary and the named point.
- `fix-land-film-article.png`: reliefs with floor marks, no floor print, no white bands.
- `fix-jouk-phase-film.png`: the Joukowski phase filmstrip: the cut without a staircase.
- `fix-video-plane-720.png`, `fix-video-globe-720.png`, `fix-video-phase-720.png`: frames of the new videos.
  `fix-video-land-decoded.png`, `fix-video-plane-print-decoded.png`: frames decoded back from the test's MP4 files.
- `fix-video-vs-screen.png`: a video frame at the screen's t, cropped to the screen's window, as the test compares it.

Checks of the review round (work/xve, headless Chrome on port 8964; the final runs at load 5, earlier ones at 13 to 21).
Command files: `test/export_cmd.js` (set `CMW_BASE`), then `python3 test/regress/export/preflight.py --latex`:

| Check | Result |
|---|---|
| `test/export_cmd.js` | **pass, 0 failures**, 80 figures. New checks: the chain display, unique names and labels, short captions under 100 characters, the homotopy wording, Homework dashes on plane and globe, the named globe point, one slide row, the floor marks, the video pace, the dark theme (no theme flip per render, no task of 50 ms or more), a hidden tab (1.2 s against 0.9 s visible), the screen match (window holds the screen's, same centre; mean abs difference 6.3 of 255), nothing kept after a video, Save figure again after a video, no encoder, .webm before Save, the dialog stable and locked during a run, the LaTeX box wraps, 600 dpi for Article |
| videos | plane 1920x1080 60 fps bounce print: 409 frames; globe 1080x1080: 151; phase, phase sphere 1280x720: 151; landscape loop: 498; WebM VP9: 121. Decoded frames against the exact render: mean abs difference 0.11 to 1.04 of 255. No long task in the final run |
| `preflight.py --latex` | **0 failures in 958 checks**. Every snippet compiled with pdfLaTeX and XeLaTeX, English and Russian, in amsart, REVTeX (column and figure*), Letter 11 pt and Beamer: no error, no overfull box. New: WebM Cues and SeekHead; one label per figure |
| quality suite (`run.sh --no-build`, `compare.py --only quality --quality-enforce-targets`) | **PASS**: 81 runs, 0 failed, 259/259 targets. `baseline.json` and `golden/` unchanged (same checksums before and after) |
| `mv_views_cmd.js`, `morphfig_cmd.js`, `p3_accept_cmd.js` | pass |
| `node test/t_i18n*.js`, `t_figure_chevron.js`, `t_cyr.js`, `t_views.js` | pass. `tools/make_ru_table.py --strict`: unresolved 0 (38 new Russian strings in `notes/i18n/ru/v15-export.json`) |
| ffprobe / ffmpeg | not installed; the preflight's MP4 and WebM parsers and a decode in Chrome stand in |

Still open after the review round:

- **Single tasks over 50 ms under heavy load.** In earlier runs at load 13 to 21, a video or a filmstrip sometimes had
  one task of 51 to 83 ms (the first globe video in a page, the first landscape filmstrip). The final run, at load 5,
  had none. The theme flips that caused the 78-440 ms tasks are gone.
- **Phase on the sphere**: the camera stays the user's. The dialog warns when most zeros and poles are on the far side.
- **Merge**: `src/gl.js` now changes too (the floor print and sea-line switches, the hidden-page poll). A trial
  `git merge-file` with xva: `app.js`, `figure.js`, `gl.js` and `page.html` merge with no conflicts.

## In short

- **The deformation exports as a deformation in every view that shows it.**
  - X → Y on the plane: the filmstrip or the paths figure (as before).
  - X → Y on the Sphere (the merged globe): a filmstrip of globes, or a paths figure on the globe.
  - Phase (the portrait of H_t): a filmstrip of portraits over one window, in colour (ring key) or black and white.
  - Phase on the sphere: a filmstrip of phase globes, with the ring key.
  - Landscape (the relief of log|H_t|): a filmstrip of reliefs, one camera, one crop.
  - The merged plane over a d/dz step: a filmstrip.
  - Every frame is titled "(a) t = 0", "(b) t = 2/3" …. The frames share one window (plane kinds) or one crop
    (globes, reliefs). Every frame is an exact render at print resolution.
  - The Deformation row offers Filmstrip, Paths (plane and globe) and One frame (the earlier one-panel figure at the
    current t, for every view but the plane, which never had one).
- **Formats are a first-class row**: PDF · PNG · SVG · Video (Video only while the deformation is on). The choice is
  remembered. PNG has a 300 / 600 dpi menu.
  - For Overleaf now saves the chosen format and copies its snippet. For Docs still pastes a PNG with its caption.
  - A **LaTeX** box shows the snippet of the chosen format, with **Copy LaTeX**.
  - PNG snippet: `\includegraphics[width=360pt]{name.png}` (Article; Homework and Slides keep the shrink-only width),
    the caption, the label, and `% Upload name.png (PNG, 300 dpi) next to your .tex file (Overleaf: the file tree).`
  - SVG snippet: `\includesvg[width=…]{name}` and a note: the svg package runs Inkscape (`--shell-escape`); Overleaf has
    both; Google Docs cannot place SVG, so use PNG there.
- **F is displayed.** Every caption names F inline and sets its formula as a displayed equation,
  `\[ \displaystyle F(z)=\frac{e^{z}-1}{e^{z}+1}. \]`, with a short caption `\caption[{…}]{…}` for the list of figures.
  The image's own caption (PNG for Docs, and the dialog's paper) centres the formula on its own line too.
- **Video** of the deformation in every view: MP4 (H.264) through WebCodecs and our own MP4 muxer; WebM (VP9) through
  WebCodecs and our own WebM muxer where H.264 cannot be encoded. No library is loaded.
  - 1920×1080, 1280×720 or 1080×1080; 30 or 60 fps; 3, 4, 6 or 8 s for the run; holds of 0.6 s at both ends.
  - Ends: Once, Loop (three runs), Bounce (there and back).
  - Look: Light (the screen's light theme) or Print (the print tones on white, with vector boundaries).
  - Paths (plane and globe) and a small t label are optional.
  - Every frame is rendered off-screen at its t (never a screen capture). A hold reuses its frame.
  - A progress bar with Cancel. One frame per task: the page keeps its frames.
- **Checks pass**: `export_cmd.js` (80 figures, every view × figure × format, 6 videos, the dialog), the preflight
  (0 failures in 956 checks, every snippet compiled with pdfLaTeX and XeLaTeX in English and Russian), the quality
  suite (PASS, 259/259 targets, no golden or baseline touched), `mv_views_cmd.js`, `morphfig_cmd.js`,
  `p3_accept_cmd.js`, and the Node tests (see Checks).
- **Open: the 50 ms rule under load.** Profiled runs show no long task of our own. Under other agents' load, a single
  50–68 ms task still shows in some video and preview runs (garbage collection, GPU stalls); see "The main thread".

## Look at these

All in `notes/export-design/round3/`:

- `dlg-png-1440.png`: the dialog with Format = PNG, the LaTeX box and its note.
- `dlg-video-1440.png`, `dlg-video-360-dark.png`: Format = Video, its poster frame and options; phone width, dark.
- `dlg-ru-png.png`: the same dialog in Russian.
- `r3-film-phase-article1.png`, `r3-film-land-article1.png`, `r3-film-globe-article1.png`,
  `r3-film-phaseGlobe-homework.png`, `r3-paths-globe-homework.png`: the new figures (rasterized from the PDFs).
- `latex-article-phase-film.png`: the phase filmstrip in `amsart`, compiled; F displayed at the caption's end.
- `latex-homework-ru.png`: the Russian homework snippet compiled with pdfLaTeX.
- `docs-png-caption.png`: the PNG for Docs, the caption in the image with F displayed.
- `video-phase.mp4` (1280×720, 30 fps, 3.2 s) and `video-plane-quicklook.png` (a frame decoded by macOS QuickLook).

Everything the test writes is in `work/xve/test/regress/export/out/` (PDF, SVG, PNG, .tex, .mp4, .webm) and
`out/latex/` (the compiled test documents).

## What was built

### app.js (small hooks, about 20 lines in 5 places)

- `artGlobe`: in the art layer, `sphereView` records the globe's camera (`MVP`, `eye`, pane size) and returns before
  its canvas marks (the 0, ∞, 1, i labels, points, probe). The figure draws them as vectors.
- `artRender` takes `look: 'light'` (the screen's light theme, for a video), `raw: true` (returns the canvas, no
  readback, for a video frame), and returns `globe` with `land`.
- The bridge gains `defo()` (on, t, m, d/dz, globe, view), `plotFAt(T)` (X's plot at time T: Phase and Landscape)
  and `lift` (`liftC`, the plane on the sphere).
- `artRender`'s opaque-pixel copy is the v14 gate fix, ported with the same text as `src/app.js`, so it merges as one
  change. `figure.js` likewise starts from `src/figure.js` (the sliced raster steps).

### figure.js

- `defoOf(view)` names the deformation's kind: plane, deriv, globe, phase, phaseGlobe, land.
- `figFilmPic` (globe, phase sphere, landscape): four renders at 300 dpi × 1.5 of the cell, one union crop, titles,
  a frame rectangle for the reliefs, the ring key for the phase sphere. On the globe: the marked points and their
  paths (solid up to the frame's t, dotted after), projected through the render's camera, hidden on the far side.
  The points are the point shapes and boundary points whose paths show for the most part.
- `figFilmPhase`: one window (the zeros and poles of all four frames), level lines and zeros/poles per frame, the
  colour or B/W portrait, one ring key at the right.
- `figGlobePaths`: H_t at t = end on the globe over X's gray outline (the app's own line), up to 8 paths with
  heads at F(z) and dots at z, kept apart at their ends. A path is kept when 8 of its 13 samples are on the near
  side; for the strip example only one qualifies, and the caption then says "The arrow is the path … of one point".
- The one-globe figures (X Sphere, H_t on the globe, Phase on the sphere) get the same vector labels and points.
- Captions, en and ru, in the homotopy's own words:
  - "Phase portraits of H_t on [−7.5, 7.5] × [−5, 5] at (a) t = 0, …: the color shows arg H_t (key at right) …
    Zeros are dots and poles are open circles. Here H_t deforms the identity (t = 0) into F (t = 2) along …"
  - "Landscapes of H_t over … at …: the height is log|H_t| and the color shows arg H_t; zeros are pits …"
  - "The deformation H_t on the Riemann sphere, with ∞ at the north pole, from the identity (t = 0) to F (t = 2), at
    …: the image of … under H_t. Solid: the paths …; gray: the boundary at t = 0."
  - "Phase portraits of H_t on the Riemann sphere …", and the globe's paths figure.
- **Display F** (`displayF`): the caption names F (`$F$`). The formula `\[ \displaystyle F(z)=… \]` follows
  ", where" at the end of the sentence that names F first. When that sentence is long (over 190 characters: it
  describes the homotopy), the formula ends the caption as its own sentence: "The map is \[ … \]". The paths
  figure's own caption (the older builder) is treated the same way.
  - LaTeX first sets a caption in one line (an `\hbox`) to test its width, and display math fails there ("Missing $
    inserted" in article, REVTeX and Beamer; tested). The snippet therefore writes
    `\ifinner\hskip\hsize\else\[ \displaystyle F(z)=… \]\fi`: in the one-line trial it is a full line of space (so
    the caption is set as a paragraph), in the paragraph it is the display. No package is needed. (The caption
    package with `singlelinecheck=off` also works, but it warns in REVTeX; not used.)
  - `\caption[{short}]{long}`: the short caption is the text before the display, without its lead-in (", where",
    "The map is"); over 220 characters it is cut to its first sentence. The braces keep a window like `[−7.5, 7.5]`
    from ending the optional argument (the first test run caught this).
  - An edited caption with a plain `\[ … \]` is guarded the same way.
  - The image's caption (`XD.caption`) sets a `{d}` segment centred on its own line, with half a line of air.
- A Russian Beamer title now sits in `\foreignlanguage{russian}{…}` too (an English-main document failed on it in
  pdfLaTeX; found by the new Russian compile).
- **Video** (`makeVideo`):
  - The plan: the kind, the size, `dpr = max(1, min(W, H) / 720)` (1.5 at 1080p: the screen's line widths and labels
    at a retina scale), the window (plane kinds: the union of what four quick renders draw, fitted to the frame's
    aspect; Phase: the zeros and poles), the marked points, the source curves (once, a formula's on a 360 grid).
  - A frame: `A.art(…, {raw, look, T})`, drawn into one 2D canvas, then the vector marks (print look: the boundaries
    of H_t and X's dashed boundary; the paths; the t label in a serif italic on a halo).
  - `VideoEncoder` with H.264 High (the first of `avc1.640033`, `…2A`, `…28`, Main, Baseline that the browser
    supports), `avc: {format: 'avc'}`, a key frame every 2 s, bitrate `W·H·fps·0.12` (2–16 Mbit/s). Back-pressure:
    at most 3 frames queued. Then VP9 (`vp09.00.40.08`, `vp09.00.31.08`, VP8) if H.264 is missing.
  - `muxMP4`: ftyp, moov (mvhd, tkhd, mdhd at fps × 1000, hdlr, vmhd, dref, stsd/avc1/avcC/pasp, stts, stss, stsc,
    stsz, stco), mdat. One chunk; moov first (fast start). The codec string reported is the stream's own (from avcC).
  - `muxWebM`: EBML header, Segment (Info with Duration, Tracks, a Cluster per key frame of SimpleBlocks).
  - `videoCheck(k)` (tests): decodes frame k back with `VideoDecoder` and renders the exact frame at its t.
- **The dialog**: the Format row first; Video hides For, Size, Ink, Caption, Deformation, LaTeX and Fine-tune, shows
  the video options and a poster (the frame at the current t, rendered by the same code), and the footer's
  **Save video** with a progress bar and Cancel. The file name's extension follows the format. Settings live in the
  same storage key (`fmt`, `dpi`, `video`). The new CSS is injected by figure.js from the app's theme tokens (light and
  dark), so `page.html` is unchanged.
- The work stays off the main thread's long tasks:
  - video: one frame per task, a yield after each, the source curves found once;
  - the phase filmstrip: zero/pole searches bounded at 40 ms each, the level grid at about 25 ms of F per frame;
  - `argLevels` and `bandsArt` (also used by the one-panel Phase figure of round 2) now run in slices with a yield
    once 8 ms have passed and after each level. Same lines and pixels as before.

### Russian

`notes/i18n/ru/v15-export.json` (53 strings, GLOSSARY terms: кадр, раскадровка, деформация, сфера Римана),
regenerated with `python3 tools/make_ru_table.py` (unresolved 0). `tools/make_ru_table.py` reads `v15-*.json` with
the same line as `work/xva`. `test/t_i18n.js` allows "dpi", "Inkscape", "shell-escape" and the browser names in
Russian text. "Ends" is «Повтор»: «Один раз · Цикл · Маятник» (short words: three choices share 210 px).

## Checks (work/xve, headless Chrome on port 8961)

| Check | Result |
|---|---|
| `test/export_cmd.js` (CMW_BASE=http://localhost:8961/) | **pass** on every check but one that follows the machine's load: in 4 of the last 7 full runs (load 10–13) one of the six videos had a single task of 50–68 ms (globe 3×, plane 1×); the other runs had none. 80 figures. New section 4: 5 views × filmstrip in Article 1 col, 2 col, Homework, Slides (+ B/W Phase) × PDF/SVG/PNG/.tex, the PNG and SVG snippets, Paths on plane and globe, One frame; the display F and the short caption in every caption; the image's own caption (F centred); a video per view; the forced WebM; the dialog (formats, remembered PNG, For Overleaf with PNG, Save video with progress, Cancel, 760 dark and 360 light/dark) |
| videos | plane 1920×1080 60 fps bounce print: 229 frames, `avc1.64002A`; globe 1080×1080: 97 frames, `avc1.640020`; phase, phase sphere 1280×720: 97 frames, `avc1.64001F`; landscape loop: 291 frames; WebM VP9 1280×720: 67 frames. A frame decoded back against the exact render at its t: mean absolute difference 0.09–0.91 of 255 |
| `test/regress/export/preflight.py --latex` | **0 failures in 956 checks**. New: every MP4 parsed box by box (duration, frames, fps, codec, sizes add up, first sample a key frame) and decoded by QuickLook; the WebM parsed (DocType, V_VP9, one block per frame); every display caption guarded with a short caption; every snippet (PDF and PNG) compiled with pdfLaTeX and XeLaTeX, English and Russian, with `\listoffigures`: amsart, REVTeX column and `figure*`, Letter 11 pt, Beamer 16:9; no errors, no overfull boxes, widths as claimed |
| quality suite + `compare.py --only quality --quality-enforce-targets` | **PASS**: 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW; 259/259 targets. No baseline or golden image changed. Run after the app.js hooks; later edits are in figure.js, the tests and the Russian table only (the suite renders the app's panes, not the figure) |
| `mv_views_cmd.js` | pass, with its export expectations moved to round 3 (Phase, Landscape, globe and d/dz deformations export filmstrips: 5, 4, 4, 4 images) |
| `morphfig_cmd.js`, `p3_accept_cmd.js` | pass |
| `node test/t_*.js` | pass, except `t_sound.js` 64/66 (two "queue" checks), which fail the same way on v15-base's `sound.js` (unchanged here) |
| ffprobe / ffmpeg | not installed; the preflight's own MP4/WebM parser and macOS QuickLook stand in |

## The main thread (the 50 ms rule)

- Profiled (CDP sampling profiler) 11 videos (plane 1080p60 in both looks, the globe 1080×1080 after the globe's
  figure builds): **no task over 45 ms**. Frame segments: drawing ≤ 5 ms, `VideoFrame` + encode ≤ 5 ms, configure 0 ms.
- Under load from other agents' runs (load average 7–26, another Chrome's GPU process at 600 % CPU), single tasks of
  50–104 ms appeared in some runs (in the full export test: 4 of 7 runs had one such task in one of six videos; in
  separate probes once 325 ms at a video's start at load 26). They are not in our
  code's synchronous parts (the trace shows those short); they look like GPU stalls in the render's blit or
  collector pauses.
- The dialog's previews (Phase, Phase sphere, Landscape with the deformation, and the round-2 one-panel Phase and
  Phase sphere without it; each through Homework, Slides, Article, B/W, colour), 3 runs each at load 6–12:
  - before any change, the **round-2 one-panel Phase figure had 4 tasks of 50–123 ms in each of 2 runs**;
  - after slicing `argLevels` and `bandsArt`: round-2 Phase 2, 5 and 6 tasks (50–100 ms); the new filmstrips 0–4
    tasks per view (50–102 ms), Landscape included, whose code has no long loop of its own.
  - The sampling profiler (2 runs at load 11) puts these in: a garbage collection (up to ~80 ms), MathJax setting a
    long caption on the paper (49 ms: a hundred calls in one task), and runs where the sampler itself got no CPU.
  - So the caption is now typeset ahead in slices (`warmCaption`: the cache then serves the paper and the image's
    caption at once). The collector pauses and the starved runs follow the machine's load: at load 4 (one run of
    all five deformation views, before the slicing) there was one task of 51 ms (the Phase filmstrip) and none
    elsewhere.
  - Not proven here: that no task over 50 ms remains on a quiet machine. Re-measure when the machine is free with the
    command files in `work/xve/test/xve_cdp/`: `longtask_dialog_cmd.js` (the dialog in each view),
    `longtask_profile_cmd.js` and `longtask_video_cmd.js` (sampling profiles with the long runs' top frames). They
    load `http://localhost:8961/`; change the port for another daemon.

## Merge notes (into v15, work/xva)

- A trial `git merge-file` of xva, v15-base and xve: `app.js`, `figure.js`, `page.html`, `test/mv_views_cmd.js` merge
  with **no conflicts**. `src/i18n_ru.js` (one generated line) conflicts: regenerate it after the merge with
  `python3 tools/make_ru_table.py` (both `v15-*.json` sets are read).
- `tools/make_ru_table.py`: xva now leaves `v15-export.json` out (`V15_NOT_HERE`, "remove when it is merged"). At the
  merge, take xva's file and remove `'v15-export.json'` from `V15_NOT_HERE`; then regenerate `src/i18n_ru.js`.
- app.js: the hooks are new lines beside `artMode`, after `const lift = liftC;` in `sphereView`, in `artRender`, and
  at the end of the `Figure.attach` object.
- Tests and harness: `test/export_cmd.js`, `test/mv_views_cmd.js` take `CMW_BASE`; `preflight.py` reads latexmk output
  with `errors='replace'`.

## Not done

- **Frame times are fixed**: 4 frames at 0, m/3, 2m/3, m. Choosing the frames' t (or their number) is not built.
- **Landscape filmstrip axes**: the frames have no floor tick labels; the caption names the window.
- **One frame on a globe** keeps the round-2 layout: the pane's picture at the panel's size, not cropped to the
  globe (it now has the vector labels and points).
- **The phase-sphere frames** show a thick black-and-white ring (the app's outline of the strip on the phase globe in
  the art layer), as the round-2 one-globe figure did.
- **Comparing a frame with the screen**: the test compares a decoded frame with the exact off-screen render at its t
  (the same renderer the screen uses). A pixel comparison with a screenshot of the pane is not built (the video's
  window and size differ from the pane's).
- **MediaRecorder**: not used. Without `VideoEncoder` the dialog says the browser cannot encode video.
- **Perf suite**: not run (another workflow's perf run was using the machine). Nothing here runs per screen frame;
  the screen's code paths change only behind `artMode` and the new `look`/`raw` options.
- **Real devices**: Safari's and Firefox's WebCodecs, and pasting the PNG into Docs, were not tried.

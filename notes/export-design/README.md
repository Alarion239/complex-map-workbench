# Image export: the redesign (round 2)

Round 2 answers the two reviews (`review-editor.md`, `review-ux.md`). Nothing in `src/`, `dist/`, `test/regress/` or
`build.py` was touched. The prototype runs on a private copy of v12 (`app-copy/`, built from `notes/gate-merged-r2`)
with my own headless Chrome (`cdp/`). The daemon and server are stopped and the Chrome profile is deleted.

## In short

- **The files now pass a preflight**: `proto/preflight.py` reports 0 failures on 9 PDFs, 13 PNGs, 9 SVGs and 9 layouts
  (`proto/out/preflight.txt`).
  - No fonts, no soft masks, no transparency states. The MediaBox equals the target width.
  - PNGs are grey, RGB or indexed (never RGBA) and carry pHYs.
  - SVGs have no duplicate ids and no nested `<svg>`.
  - No label touches a frame or another label.
- **Black and white is real grey**: 8-bit DeviceGray images at 45 % and 14 % grey.
- **Homework is safe in Overleaf**: it is made for Overleaf's default `article` at 11 pt (360 pt). It stays under its
  problem (`[H]`) and only ever shrinks.
- **The dialog names destinations**: the footer has **For Overleaf** (copies the LaTeX, then saves the PDF), **For Docs**
  and a quiet **More formats**.
  - The Caption row is gone. You edit the caption on the paper, and the paper shows it typeset from the same LaTeX
    that gets copied.
- **Phase is prototyped** in colour (with level lines and a ring key) and in black and white (as a contour portrait).
  **Landscape is not prototyped yet.**

## Look at these

1. `mockup/shot-sA-light.png` … `shot-sD-light.png` (and `-dark`) show the dialog. The full mockup is
   `mockup-export.html`.
   - A: Article, `amsart` 360 pt, the default.
   - B: Homework, with the Size menu open and the state after *For Overleaf*.
   - C: the deformation filmstrip with *More formats* open.
   - D: Phase in black and white with *Fine-tune* open.
   - `cdp/shots/mockup-760-scrolled.png`: the dialog at the width of the claude.ai side panel.
2. `proto/latex/homework-demo.pdf`: the Homework figure in Overleaf's default 11 pt `article`. The figure stays right
   after Problem 3. Points A–E have shapes and black letters. Open boundaries are dashed, with orientation chevrons and
   axis names past the arrows.
3. `proto/latex/paper-demo.pdf`: a REVTeX paper with these figures:
   - the column figure;
   - the full-width figure with a detail panel;
   - the filmstrip, titled "(a) t = 0" and so on;
   - the black-and-white version;
   - Phase in colour and in black and white;
   - the overlay.
4. `proto/latex/newtx-demo.pdf`: a Times document. It shows the default Computer Modern outline labels next to the
   overlay, whose labels are set by the document.
5. `proto/out/*-grey.png`: a grey proof of every figure.

## What changed (review item → fix)

| Item | Fix |
|---|---|
| A1, B9 | Own PNG encoder (`CompressionStream('deflate')`). For the PDF, glyph `<use>`s are inlined, because they were what produced svg2pdf's `/CA 0`. Fig. 2 drops from 563 KB to 230 KB (indexed colour at 600 dpi). |
| A2 | B/W uses grey images and tones #8C8C8C / #DBDBDB. |
| A3 | Titles "(a) t = 0", "(b) t = 1/3"… sit on one baseline that reserves the deepest descender. The collision check is in the preflight. |
| A4, P0-3 | Homework emits `figure[H]` (float). Article keeps `[tbp]`, and `figure*` at full width. |
| A5, P1-7 | Letters are always black. Dots are coloured, with shapes ● ■ ▲ ◆. Paths are 0.6 pt with a white casing, and the start points are labelled. |
| A6, P1-8 | The halo is 0.4 pt outside the glyph, and only where the label's box overlaps a fill. A placer picks one of 8 spots and avoids curves, other labels and texture. ℍ sits inside one cell. |
| A7, P2-16 | One `open` flag dashes the boundaries (Homework) and adds "Dashed: boundary not included" to the caption. |
| A9, P2-18 | Captions inside images are set ragged-right. |
| B1 | Every line is ≥ 0.5 pt. Dots are round-cap `0 1.8`, dashes are 3/2, and level lines are 0.35 pt. |
| B2 | Flat tones at 600 dpi, indexed. Continuous tone at 300 dpi. |
| B4, P2-14 | Panels end on whole cells. Panel (a) of the column figure is [−2, 2] × [−½, 3]. |
| B5 | One precision per axis (0.90, 0.95, 1.00). Mirrored labels are right-aligned, and only two-panel columns mirror. |
| B6, P2-17 | Axis names sit past the arrow tips. Tick labels use textbook positions and move only when they would sit on a curve. Chevrons mark orientation. The unbounded checker fades to white. |
| B7 | One namespaced glyph `<defs>` per file. |
| B8 | The overlay has `\useasboundingbox`, `\cmwdir` and `\contour` halos. |
| B10 | Names and labels come from the scene (`cayley`, `fig:cayley`). Spelling is en-US. Captions use a regular (a). The snippet has a width-guard comment. |
| B11 | The preview caption is typeset by the composer from the caption's LaTeX. |
| B12 | The page height is exact to 0.01 bp. |
| P0-1 | Destination buttons, no Caption row. The caption is edited on the paper, and the name is inline in the footer. |
| P0-2, A8 | *For Docs* will write `image/png` plus `text/html` (an `<img>` with its width and the caption as text). If that fails it falls back to a selection copy, then to saving a PNG. The "pastes at 6.5 in" claim is removed. |
| P0-4 | Homework sizes are listed in this order: `article` 345/360/390 pt, 1 in, A4, then paste `\the\linewidth`. The snippet shrinks only, never enlarges. |
| P1-5, P1-9 to 12 | Article defaults to `amsart` 360 pt. The preview fits the column, with *See in grey* and *Loupe*. Below 900 px it uses one column with For and Ink on one line. The dummy text is hairline segments. The facts are one sentence. |
| M1–M4 | Phase in colour and B/W, the newtx demo, grey proofs and the preflight script. |

**Not done yet:**
- **Landscape** (M1).
- **The smooth contrast fade at the accumulation point** (B3). The hole is filled and marked with a ring, but the fade
  needs one shader change: fade between cell sizes of 1.5 pt and 0.5 pt in print units.
- **A Homework variant of Phase.**
- **A `picture`-environment overlay.**
- **Real paste tests**: *For Docs* in the published artifact (Docs, Word, Chrome, Safari), and the zip upload in
  Overleaf.
- **The filmstrip window**: it is now the union of the frames, [−3, 3] × [−2, 5], so frames (c) and (d) are small.
  A per-frame window with stated coordinates may read better.

## What implementation involves

- **`app.js`, renderer**: the art-layer flag (`artMode`), already guarded in `drawScene`, `drawPoints`, `drawCuts`,
  `drawCutBanks`, `drawFov`, `drawChevrons`, `drawRulers`, `drawRoots`, the deformation tint and the Phase grid and
  axes. Add an exact-window render (`__xdRender`: about 15 lines around `prepareExport` and `renderOff`).
- **`app.js`, figures**: replace the layout half of `buildFigure` with the composer (`proto/compose.js`, about 450
  lines) and the presets (`proto/figures.js`, about 330 lines).
  - `figurePDF` keeps jsPDF and svg2pdf, and inlines glyphs.
  - `figurePNG` uses the new encoder.
  - `latexFigure` becomes the Article and Homework snippet writer (`proto/latex/make_tex.py` shows the output).
- **`page.html` and `app.js`, dialog**: replace `openFigureDialog` with the new dialog (CSS and markup in
  `mockup/mockup-template.html`).
  - The export menu becomes *Export figure…* (⌘E), *Copy figure again* and *Save figure again*.
  - The last settings are kept in `localStorage`, wrapped in try/catch.
- **Downloads**: no change. `pdf`, `png`, `svg` and `zip` are already allowed.
- **Tests**: port `proto/preflight.py` to `test/regress`.

To rerun:

```sh
cd notes/export-design && (cd app-copy && python3 build.py)
python3 -m http.server 8817 --bind 127.0.0.1 &  node cdp/cdpd.js &   # wait for cdp/q/READY
cdp/q.sh proto/figures_cmd.js && python3 proto/preflight.py
(cd proto/latex && python3 make_tex.py && latexmk -pdf paper-demo.tex homework-demo.tex newtx-demo.tex)
cdp/q.sh mockup/caps_cmd.js && python3 mockup/gen_template.py && python3 mockup/build_mockup.py && cdp/q.sh mockup/shots_cmd.js
touch cdp/q/QUIT
```

Round-1 outputs are kept in `proto/out-r1/` for comparison.

## Questions for you

1. **Homework default width.** I chose Overleaf's blank `article` at 11 pt (360 pt), so nothing overflows. If your
   homework template uses 1 in margins (469.75 pt), the figure would come out bigger by default. Which do you use?
2. **Open boundaries in Homework.** I chose dashed for open sets, as textbooks do, with a caption note. Keep that, or draw
   them solid as in articles?
3. **Article default.** I chose `amsart` at 360 pt, following the UX review. If you mostly submit to two-column
   journals (REVTeX 246 pt, IEEE 252 pt), the default should be a column width instead.

## The user's decisions (2026-10-22)

1. **Homework default width: 1-inch margins** (letter, 469.75 pt text width), not Overleaf's 360 pt default. The
   snippet still only shrinks, never enlarges; the 360 pt and A4 sizes stay in the Size menu.
2. **Open boundaries in Homework: dashed**, with "Dashed: boundary not included" in the caption.
3. **Article: both layouts as a first-class choice** ("Both, so that we can choose one column or two column?"): the
   Size row gets an obvious **One column · Two column** switch. One column = amsart 360 pt (default); two column =
   the column of a two-column journal (REVTeX 246 pt, IEEE 252 pt in the menu; full width 510/516 pt for figure*).
   The last choice is remembered.

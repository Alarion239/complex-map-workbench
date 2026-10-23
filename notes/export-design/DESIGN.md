# Figure export, redesigned

Status: design and prototype. Nothing in `src/` was changed; the prototype runs on a private copy of v12
(`app-copy/`) plus the composer in `proto/`. Every claim about the current export comes from files exported by the real
v12 dialog (`audit/out/`). Every claim about the new style comes from figures the prototype actually made
(`proto/out/`), compiled in real LaTeX documents (`proto/latex/`).

## Round 2: these values replace the numbers below (see README.md for the full review mapping)

- **Dialog:**
  - For · Size · Ink · Fine-tune.
  - Footer: an inline name, *More formats*, **For Docs** and **For Overleaf** (copy the snippet first, then save).
  - The Caption row is removed (§2). The caption is edited on the paper.
  - The preview defaults to *Fit column*, with *See in grey* and *Loupe*.
- **Default sizes (§3):**
  - Article: `amsart` 360 pt.
  - Homework: `article` 11 pt, 360 pt. The Homework size menu lists 345/360/390 pt, then 469.75 and 455.24 pt, then
    paste `\the\linewidth`.
  - Homework type sizes: `\small` / `\normalsize` (10 / 10.95 pt).
- **Lines (§5):**
  - Frame, ticks and every visible line are ≥ 0.5 pt.
  - Dots are round-cap `0 1.8` at 0.7 pt; dashes are 3/2.
  - Level lines in Phase are 0.35 pt.
  - The detail marker is 0.5 pt with sides of at least 10 pt.
- **Open boundaries (§5):** dashed 3/2 in Homework, in the shape's deep tone so they show over the black axis. Solid
  in Article. One flag drives both the figure and the caption clause.
- **Colour (§6):**
  - B/W tones are #8C8C8C / #DBDBDB, written as DeviceGray.
  - Point letters are always black. Dots keep their hue and gain shapes ● ■ ▲ ◆.
- **Halo (§4):** 0.4 pt outside the glyph, only over a fill. Labels are placed among 8 directions so that they avoid
  curves, other labels and texture.
- **Ticks (§4, §7):** one number of decimals per axis. Mirrored labels are right-aligned, and only two-panel columns
  mirror. Unbounded periodic windows end on whole cells. Homework axis names sit past the arrow tips, and the
  unbounded fill fades to white.
- **Rasters (§10):** our own opaque PNG encoder. Flat tones are 600 dpi indexed; continuous tone is 300 dpi RGB or grey.
  No SMask, no ExtGState alpha (glyph `<use>`s are inlined for the PDF), and the page height is exact.
- **Captions (§9):** en-US spelling, a regular "(a)", ragged-right inside images. The Homework default only names
  things.
- **LaTeX:**
  - Homework uses `figure[H]` and a shrink-only `\includegraphics[width=\ifdim…]`. Article uses `[tbp]`, and
    `figure*` at full width.
  - File names and labels come from the scene.
  - The overlay has `\useasboundingbox`, `\cmwdir` and `\contour`.
- **Formats (§10):**
  - Animation is deferred (UX P2-21).
  - *For Docs* writes `image/png` + `text/html` (an `<img>` with its width and the caption as text). It falls back to a
    selection copy, then to *Save PNG*, and it still has to be verified in the published artifact.

## 0. The decisions in one screen

1. **One question first: where is the figure going?** The choices are *Article*, *Homework* and *Slides*. Each one sets the
   size, type sizes, line weights, axis style, caption placement and format. Everything else is a default that you can
   change, not a setting you have to make.
2. **Exact size, no scaling.** A figure is made at the width of a real LaTeX layout, measured in TeX points, and is
   included at natural size (`\includegraphics{…}`, with no `width=`). Its 8 pt labels are then 8 pt on paper, in the
   document's own Computer Modern / Latin Modern.
3. **Vector everything except the shading.** Boundaries, curves, points, frames, ticks and labels are vectors in pt.
   Only fills (the checkerboard, the phase colours, the landscape surface) are images, at 300 dpi. Screen aids never
   reach a figure: no grid, no halo, no rulers, no preimage hints, no pole cross unless you ask for one.
4. **Print-safe colour by default, true black and white on request.** The default palette keeps its meaning in grey and
   for colour-blind readers (the two tones differ in lightness, not only in hue). *Ink: B/W* switches to black, greys and
   line styles.
5. **The caption belongs to the document.** The caption is generated, short, in journal register, and editable in the
   dialog. For PDF, SVG and LaTeX it goes into `\caption{}`. It is printed in the image only for PNG or clipboard
   destinations (Docs, Word, Slides), where no LaTeX will typeset it.

These decisions support three more: a **detail panel** in place of a blown-up raster, a **filmstrip** that prints
the deformation (an animation cannot be printed), and a **LaTeX bundle** (PDF + snippet + optional TikZ label overlay).

---

## 1. Audit of the current export (v12)

Method: the real dialog was driven in headless Chrome for four scenes: the Cayley map of the upper half-plane with
the checker, the Phase view and the Landscape of $(z^3-1)/(z^2+1)$, and the deformation of the Cayley map. Each scene
was exported in PDF, SVG and PNG, in double column with the caption and in single column without it. The anchor
download was intercepted, so these are the exact files a user gets
(`audit/out/*.pdf|svg|png`, PDF pages rasterized as `*-pdf*.png`, greyscale checks as `*-gray.png`, dialog
screenshots in `cdp/shots/aud-*-dialog.png`). I then reviewed the files first as a journal editor and then as a
homework grader.

### What a journal editor would send back

| # | Finding | Evidence |
|---|---|---|
| E1 | **Labels change size when the figure is placed.** The copied LaTeX is `\includegraphics[width=\linewidth]`, but figures exist only at 3.4 in and 7.0 in. In a 345 pt `article` column a 3.4 in figure is scaled ×1.41, so 8 pt ticks print at 11.3 pt. In a 246 pt REVTeX column it shrinks 0.25 %. The labels never match the text. | `latexFigure()`; widths measured in TeX: article 345/360/390 pt (10/11/12 pt), amsart 360 pt, REVTeX 246/510 pt, IEEE 252/516 pt |
| E2 | **The PDF has non-embedded fonts.** It declares Helvetica, Helvetica-Bold and Helvetica-Oblique, Type 1 and not embedded, even though all its text is outlines. Journal preflight (IEEE PDF eXpress, Elsevier) rejects that. | `pdffonts audit/out/cayley-double-cap.pdf` |
| E3 | **Screen aids leak into the figure.** The white halo beside every boundary prints as a double line (white, then blue). The grid's dashed unit circle and the plane's own axes are baked into panel (a). The y-axis prints as a heavy ray below the real axis and faintly through the fill, and the caption never mentions either. The pole × at −i is unexplained. The plane tint #FCFDFD and the grid lines #E2EEF2 are baked into the raster. | `cayley-double-cap-pdf200.png` |
| E4 | **Axes are drawn twice.** The raster contains the app's own axes and ruler ticks, and the vector frame adds inward ticks on top. In single column the minor ticks become a comb. | `cayley-single-nocap-pdf200.png` |
| E5 | **Lines are raster.** Boundaries and curves are pixels at 300 dpi, so edges go soft when zoomed or printed at 1200 dpi. Only the deformation arrows are vector. | `pdfimages -list`: 853×1074 RGB + SMask per panel |
| E6 | **Framing is the screen window.** Panel (a) of the Cayley figure is half empty (the lower half-plane). The Phase figure is 7 × 5.35 in with every zero and pole in its middle 30 %. The Landscape raster is about 45 % empty margin. The deformation plane is mostly empty sky above the disc. | all four `*-double-cap-pdf*.png` |
| E7 | **Colour does not survive grey or colour-blind readers.** In the phase portrait, arg F = −π (cyan) and arg F = 0 (pink) both print at L ≈ 70, so the key cannot be read in grey. The hue wheel is not safe for colour-blind readers. The checker fills are saturated #3B6FD4 at 85 %, which is heavy ink for print. | `phase-double-cap-pdf-gray.png` |
| E8 | **The caption reads like app output.** It says "guaranteed by the chain", "Their images under F" for one shape, "(bar)", and sets an inline `\frac` (tiny type). At 4 lines it is longer than journals want, and it is in the image by default. | `run2.json` captionTex |
| E9 | **Single-column two-panel figures are cramped.** Each panel is 1.25 in, because the rotated axis titles and both panels' tick columns take ~25 % of the width. | `cayley-single-nocap-pdf200.png` |
| E10 | **The Landscape's labels are raster text in the UI serif.** They are drawn in the canvas, not in Computer Modern, and they change size with the window. | `land-double-cap-pdf.png` |

### What a homework grader would say

| # | Finding |
|---|---|
| H1 | **The figure does not show what corresponds to what.** Nothing marks that i goes to 0, that the boundary goes to the circle with orientation, or that ∞ goes to 1. A grader wants named points and their images. |
| H2 | **The PNG has no physical size.** It is 2100 × 1419 px with no pHYs chunk, and an alpha channel whose edge pixels are semi-transparent (down to 236). Word and Docs place it at 96 dpi (a 21.9 in image) or scale it to the page arbitrarily. It also cannot be copied to the clipboard, which is how most homework is assembled in Docs and Notion. |
| H3 | **There are no textbook axes.** Homework diagrams use axes through 0 with arrowheads and Re z, Im z at their ends. Only the boxed journal frame is available. |
| H4 | **Labels are small for 11–12 pt homework.** They are 8–9 pt, and there is no setting for the text size. |
| H5 | **Every file is `complex-map-figure.*` with `\label{fig:complex-map}`.** A second figure overwrites the first and the label collides. |

### Dialog and speed

- **Speed is fine.** The first preview takes 108–180 ms. A format change takes 50–60 ms. Making the PDF takes
  0.4–1.7 s (Phase: 1.7 s, 1.0 MB). SVGs reach 4.6 MB (Phase) because the raster is base64-encoded at full size.
- **You cannot judge the figure from the preview.** It is scaled to fit, has no true-size view and no page context,
  so label size cannot be judged.
- **Some defaults conflict.** Caption *In the figure* is the default, but *Copy LaTeX figure* also writes `\caption`,
  so the caption is printed twice unless you notice the toast.
- **Controls are missing.** There is nothing for B/W, crop, axis style, text size, physical width other than
  3.4 / 7 in, or DPI, and there is no copy-as-image.

---

## 2. The new dialog

One dialog, live and WYSIWYG. The left side is **the page**: the figure at true size (zoom: *Fit · 100 % · 200 %*) placed
on a mock page column, with grey text lines at the document's text size beside it. Label size against body text is
visible at a glance. The right side has **four rows and two buttons**. Mockup: `mockup/mockup-export.html`,
screenshots `mockup/shot-*.png`.

```
For      [ Article ] [ Homework ] [ Slides ]
Size     Column 246 pt ▾      Text 10 pt ▾        (menus list real layouts, below)
Ink      [ Colour ] [ B/W ]
Caption  [ In LaTeX ] [ In image ]   ✎ editable text, live re-typeset
──────────────────────────────────────────────
Fine-tune ▸   Crop · Axes · Labels · Detail · Name
──────────────────────────────────────────────
[ Copy ▾ ]                     [ Save PDF ▾ ]
```

- **Save** is a split button whose default follows *For*: PDF for Article and Homework, PNG for Slides. The menu holds
  PDF, SVG, PNG (300/600 dpi), the LaTeX bundle (.zip) and *All views (.zip)*.
- **Copy** is a split button: *Copy LaTeX* (snippet), *Copy image* (PNG with its size, for Docs, Word, Slides and
  Notion), and *Copy SVG*.
- **Fine-tune** is closed by default and remembers whether it was open. Its contents are in §6–§9.
- The preview responds within one frame for vector changes (caption, labels, axis style, ink, crop drag) and re-renders
  the shading progressively: a screen-resolution draft first, print resolution on save. That matches today's
  50–180 ms.
- **The preview is editable.** You can drag the crop edges, drag a label to move it, double-click a point to name it,
  and drag a box to make a detail panel. These are the only direct manipulations, and each also has a field in
  Fine-tune.
- **Nothing is hidden behind the theme.** The dialog follows the app's light or dark theme, but the page is always
  white paper.
- **A note under the preview states the facts:** `246 × 123 pt · 3.40 × 1.71 in · labels 8/9 pt Latin Modern ·
  shading 300 dpi · 56 KB`. A warning appears only when something is wrong, for example "Text 12 pt: labels will
  be 10/11 pt" or "Phase in B/W is drawn as contour lines".

## 3. Presets (the *For* row) and sizes

Every size is in **TeX points** and converted to PostScript points for the file (1 pt = 72/72.27 bp). A 246 pt
figure is therefore 245.08 bp wide and fits `\columnwidth` exactly. The prototype compiles in REVTeX with no
overfull box.

| | **Article** | **Homework** | **Slides** |
|---|---|---|---|
| Sizes (the Size menu) | Column 246 pt (REVTeX/APS) · Column 252 pt (IEEE) · Column 3.5 in (Springer 84 mm ≈ 238 pt, Elsevier 90 mm ≈ 255 pt listed) · Full width 510 pt (REVTeX) / 516 pt (IEEE) · One-column `article` 345/360/390 pt (10/11/12) · `amsart` 360 pt · Custom: paste `\the\linewidth` | Text width Letter 1 in margins 469.75 pt (default) · A4 2.5 cm 455.24 pt · ¾ width · ½ width | Beamer 16:9 text 398.34 pt (default) · 4:3 text 307.29 pt · 1920×1080 px image |
| Text size | 10 pt (default) · 11 · 12 | 11 pt (default) · 10 · 12 | Beamer 11 pt |
| Ticks / labels | `\footnotesize` / `\small` → 8 / 9 pt at 10 pt | `\small` / `\normalsize` → 10 / 10.95 pt at 11 pt | 9 / 11 pt (the projector scales the frame ≈ 3.5×) |
| Axes | Box: frame with inward ticks; plane name above, (a) (b) letters | Cross: textbook axes through 0, arrowheads, Re z / Im z at the ends | Minimal: cross axes, ticks only at ±1, ±2… |
| Lines (§5) | Medium | Heavy | Heavy |
| Palette (§6) | Print colour | Print colour, high contrast | Screen colour (the app's own) |
| Caption | In LaTeX | In LaTeX for PDF, in the image for PNG and Copy image | None (the slide title is the caption) |
| Points | As drawn | Named A, B, C… with images A′, B′, C′ (suggested, one click) | As drawn |
| Default format | PDF | PDF; Copy image for Docs | PNG 1920 px wide, or PDF for Beamer; animation for the deformation |

*Ink: B/W* is an independent switch, not a fourth preset: homework and articles can both be printed in black. *Text
size* only changes the type sizes (8/9 at 10 pt, 9/10 at 11 pt, 10/11 at 12 pt), never the figure width.

**Two panels in one column.** The tick labels of (a) go on the left and those of (b) on the right (mirrored), so the
gutter holds only the F arrow. Rotated axis titles are replaced by the plane name above each panel (*z*, *w*). Each
panel then gets 1.36 in in a 246 pt column, against 1.25 in today, and the panels look calmer. If a panel would still
be narrower than 1.2 in, the dialog offers *Stack* (b under a, with a ↓ arrow).

## 4. Typography

- **Computer Modern as outlines.** All glyphs are MathJax's TeX fonts, which are Computer Modern outlines, so SVG, PDF
  and PNG look identical with no font embedding and no licensing. Math is italic as in TeX, numbers are upright, and
  the minus sign is a true minus. Panel letters are upright "(a)" at the label size.
- **Labels set by your document (the LaTeX bundle's overlay).** The art PDF has no text, and a TikZ file places every
  label as a `\node` with `\footnotesize` or `\small`. The labels are then typeset by the document itself: its font
  (newtx, Libertine, or anything else), its macros and its exact size. The prototype's overlay compiles and matches
  (`proto/latex/paper-demo.pdf`, Fig. 5).
- **Tick numbers** use the fewest decimals the step needs (0.9, 0.95, 1), never 1.0. Very large or small values are
  written as powers of ten (`10^{-3}`).
- **Labels over fills get a white outline halo** (0.6–0.8 pt stroke of the same glyphs), never a box.

## 5. Line weights (pt) and marks

| Element | Article | Homework / Slides | B/W |
|---|---|---|---|
| Frame | 0.4 | — (cross axes 0.6) | 0.4 |
| Ticks, length | 0.4, 2.5 inward | 0.6, ±1.8 across | as colour |
| Region boundary | 0.6, the fill's deep tone | 0.9, black | 0.6, black |
| Open boundary (not in the set) | dashed 2.4 / 1.6 | dashed 3 / 2 | dashed |
| Curves (images of lines, segments) | 0.7 | 1.0 | 0.7, styles per shape: solid · dashed · dotted |
| Grid shapes (Cartesian/polar grid images) | 0.35 | 0.5 | 0.35 grey 40 % |
| Map arrow F | 0.5, Stealth head 4.2 pt | 0.6, head 5.2 pt | 0.5 |
| Point | dot r 1.35 with a 0.4 white rim | r 1.9 | black |
| Excluded point (∞'s image, a pole) | ring r 1.4 | ring r 1.9 | ring |
| Detail marker | 0.4 rectangle + "(c)" | — | as colour |

Minor ticks are off below 2.5 in panel width. Gridlines are never drawn in Article. Homework can turn on a 0.25 pt
grey-20 % grid (Fine-tune → Axes).

## 6. Colour

**Print colour** (the default for Article and Homework). For each shape colour, the checker uses two tones at fixed
CIELAB lightness. That makes them distinguishable in grey and for colour-blind readers, since lightness is what
survives both.

| Shape | dark tone (L≈63) | light tone (L≈87) | boundary (L≈30) |
|---|---|---|---|
| 1 (blue, hue 262°) | #699DCD | #CCDCEE | #1D4A7A |
| 2 (orange, Okabe–Ito hue) | #D3A35B | #F1DDC4 | #765316 |
| 3 (bluish green) | #49BF94 | #C5E7D7 | #006847 |
| 4… | the app's c4–c8 hues at the same L targets | | |

Homework uses L≈56 / 85 with black boundaries, for more contrast on cheap printers. Named points use the Okabe–Ito
set (vermillion #D55E00, bluish green #009E73, reddish purple #CC79A7, orange #E69F00), and their labels are coloured
to match, so the correspondence reads at a glance. In grey the letters still carry it.

**B/W ink.**
- Checker: grey 35 % / grey 11 % (#A6A6A6 / #E4E4E4) with black boundaries (`proto/out/article-column-mono.pdf`).
- Several shapes: separated by line style (solid, dashed, dotted) and by hatching angle, not by grey alone.
- Phase portrait: drawn as an *enhanced contour portrait*. Thin black isochromatic lines arg F ∈ (π/6)ℤ, a heavier line
  for arg F = 0 and a dashed one for arg F = π, over light modulus bands (|F| steps alternate white and grey 6 %).
  Zeros and poles are where the lines meet, and the line order tells which.
- Landscape: plaster shading plus the modulus contours, with no hue.

**Phase portraits in colour** keep the standard hue wheel, because mathematicians expect it (Wegert's convention). Two
things make them work in print. The isochromatic lines at multiples of π/6 are drawn over the colours as thin
(0.25 pt) dark lines, so the picture reads even if the colour does not. And the key labels −π, −π/2, 0, π/2, π sit
on a ring key placed beside the panel instead of a bar.

## 7. Framing, scales, axes

- **Crop.** *Fit content* (default) · *As on screen* · *Custom* (drag in the preview).
  - Fit content takes the bounding box of what is drawn in each panel, plus 8 % padding, snapped outward to the tick
    step, so the frame ends on a tick.
  - Unbounded sets (half-planes, strips, complements) use the screen window in their unbounded directions and the
    content elsewhere. The upper half-plane becomes [−2, 2] × [−½, 3½] with a sliver of the lower half-plane to show
    the boundary.
  - Phase and Landscape crop to the zeros, poles and critical points plus a margin of 1.5 times their spread. The
    Landscape is cropped to the surface's projected bounding box.
- **Equal aspect, always.** One unit is the same length on both axes, because conformality is about angles.
- **Panel heights.** The two panels of X → Y share their height, and their widths follow their aspect ratios. *Same
  scale* (Fine-tune) gives both panels the same units per inch when the planes are comparable (z² on a quadrant).
- **Axes styles.** *Box* (journal), *Cross* (textbook) and *None* (the picture with only the plane name; good for
  slides and covers).
  - Cross puts tick labels diagonally off the tick: −1 below-left, 1 below-right, and on the y-axis above or below.
    The labels then never sit on a curve crossing the axis, such as the unit circle at ±1.
  - Labels that would collide with the axis title are dropped.

## 8. Panels, the F arrow, details

- **Letters and plane names.** "(a)" sits above each panel on the left and the plane name (*z*, *w*) on the right, on
  one baseline 3 pt above the frame. There are no rotated axis titles in Article.
- **The F arrow** sits in the gutter at mid-height, labelled *F* (Article), or with the formula when it fits:
  Homework shows `w = \dfrac{z-i}{z+i}` above a longer arrow. The arrow is always horizontal and never crosses a
  label.
- **Detail panel (the inset decision).** A magnified window is drawn as a **satellite panel (c) with its own true
  coordinates**, re-rendered at its own resolution (600 dpi, a real zoom and not an enlarged raster). It is linked
  to a thin rectangle in (b) labelled "(c)" (`proto/out/article-wide.pdf`: the accumulation of the checker at
  w = 1). An in-frame inset is offered only when the preview finds an empty corner (≥ 30 % of the panel side,
  measured from the art's coverage). Even then it has its own ticks or a stated factor (×6.4). It never sits over
  axis ticks that would give it false coordinates.

## 9. Captions and annotations

- **Generated captions in journal register.** One sentence per panel, the map as an inline slash fraction
  `(z-i)/(z+i)`, the shading in one clause, and nothing about "the chain". The guarantees are available as an
  *Add properties* chip ("F is a Möbius transformation, conformal on ℍ"). The caption is LaTeX-exact: what the
  image prints (when it prints one) is typeset from the same source that goes into `\caption{}`.
- **Editable.** The caption field shows the LaTeX source with live typesetting below it. Once you edit it, it stops
  regenerating until you choose *Regenerate*.
- **Placement.** *In LaTeX* for PDF, SVG and the bundle. *In image* for PNG and Copy image, as "**Figure 1.** …"
  justified at the label size, the figure number editable.
- **Annotations, kept small.**
  - **Point labels** (TeX) are placed automatically in the free one of 8 directions and can be dragged.
  - **Curve labels** sit at the curve's least crowded point.
  - **Callouts** are a label with a leader arrow.
  - Homework offers *Name the points* (one click): A, B, C… on the boundary and inside, with A′, B′, C′ on the
    images, in matching colours, plus an orientation arrowhead on each boundary at corresponding parameters (x = ½ and
    F(½) in the prototype). That shows that the region stays on the left.
  - Labels and callouts are stored in the scene, so they survive a reopen.

## 10. Formats

| Format | What it is |
|---|---|
| **PDF** (default) | Vector, text as CM outlines, no fonts declared (`putOnlyUsedFonts`; the prototype's PDFs list none), shading as lossless 300 dpi images, page = figure size in bp. XMP metadata holds the scene. |
| **SVG** | The same drawing. `<metadata id="cmw-figure">` holds the scene JSON. Shading as PNG data. Sizes in pt (`width="245.08pt"`). |
| **PNG** | 300 dpi (Article) or 600 dpi (Fine-tune), **flattened on white**, with a **pHYs** chunk so Word, LaTeX and Docs know its physical size, and an iTXt `cmw:scene` chunk. |
| **Copy image** | The same PNG to the clipboard (`ClipboardItem image/png`), for Docs, Word, Notion and Slides. Caption in the image. |
| **Copy LaTeX** | The `figure` snippet: natural size, the editable caption, a unique `\label{fig:<name>}`, and a comment giving the layout it was made for and the packages it needs (`proto/latex/snippets.txt`). |
| **LaTeX bundle (.zip)** | `<name>.pdf`, `<name>.tex` (the snippet), and with *Labels by LaTeX*: `<name>-art.pdf` + `<name>-overlay.tex` (TikZ). Zip is an allowed download type, `.tex` alone is not. Inside a zip it is fine. Overleaf takes the zip as an upload. |
| **All views (.zip)** | X → Y, Phase, Landscape and the deformation (filmstrip) in the current preset, plus one `figures.tex` with all four snippets. |
| **Animation** (deformation) | MP4 where `MediaRecorder` supports it, otherwise WebM; GIF 640 px / 15 fps for Docs and Slides. 3 s with ease-in-out and ½ s holds at t = 0 and t = end, 30 fps, 1920×1080 (Slides) or the figure's aspect, optional `t = 0.50` stamp. |

**Name.** Fine-tune → Name, prefilled from the example or the map ("cayley", "joukowski", "exp-strip"). It sets the
file names and the `\label`.

**Reopen.** Dropping an exported SVG, PDF or PNG onto the app restores the scene (shapes, chain, views) and the export
settings. The metadata is the same JSON in all three containers. A file from an older version opens with a note.

## 11. The views

- **X → Y.** The two-panel figure (the prototype's main subject). One panel alone, (a) or (b), is in Fine-tune →
  Panels.
- **Phase.** One panel cropped to the features. Colour: hue wheel plus isochromatic lines (§6) and a ring key to the
  right of the panel. B/W: contour portrait. Zeros and poles are optional named points ("zero of order 2") with
  labels.
- **Landscape.** The raster surface at 300 dpi on transparent paper, auto-cropped. The axes, the height scale and
  their labels are drawn as vectors at positions projected from the camera, in CM, so they are no longer canvas text.
  Print camera preset: elevation 28°, azimuth −55°, with the poles clipped at a stated height (caption: "clipped at
  \|F\| = 10").
- **Deformation.**
  - *Print*: a **filmstrip** of H_t at t = 0, ⅓, ⅔, 1 (count 3–6) in one row (Full width) or 2×2 (Column). It
    shows the shared window, the start boundary dashed, the paths of 2–4 chosen points as dotted arcs that turn solid
    up to each frame's t, and the fixed points (`proto/out/deformation-filmstrip.pdf`).
  - The existing one-plane *paths* figure stays as the second choice. In it, a column carries at most 8 arrows and a
    full-width figure 16 (today 10 and 31). The arrows are 0.4 pt with 3 pt heads and the paths are coloured by
    their start.
  - *Slides*: the animation.

## 12. Implementation plan (for the app, after this round)

1. **Renderer: an *art layer* mode.** It draws fills only: no grid, axes, rulers, chevrons, cuts, points, roots or
   field-of-view outline, no deformation tint or outline, on a transparent background. The prototype does this with
   a flag checked in seven draw functions and `drawScene` (`app-copy`, 20 lines; see `__xdArt`). It also needs a
   render for an exact world window (`__xdRender(side, box, wpt, dpi)`, 15 lines).
2. **Vector layers from the line refinement.** The app already refines every shape's lines at export time
   (`refineAllNow`). Those samples are emitted mapped through F as SVG paths, in place of the raster strokes, and
   dashed where the set is open. Points and labels come from the shapes.
3. **The composer** (`proto/compose.js`, 300 lines). It works in pt and uses MathJax's own viewBox metrics, which are
   exact, replacing today's 0.431 ex guess. It provides panels with box and cross axes, the F arrow, detail panels,
   outline halos, the caption, and PDF/PNG with metadata and pHYs. It replaces `buildFigureNow`'s layout half.
   `prepareExport` and `renderOff` stay.
4. **The dialog** of §2. It replaces `openFigureDialog`, and the export menu keeps its three entries plus *All views*.
5. **Phase B/W contours** (marching squares on arg F at the panel's resolution, emitted as paths). **Landscape
   vector axes.** **Filmstrip.** **Animation.**
6. **Reopen from metadata.**

Order: 1–4 deliver the new look for X → Y in every preset, which is most of the value. Then 5 view by view, then 6.
The cost per figure stays in today's range: the prototype builds a figure in 60–115 ms and its PDF in 150–500 ms.

## 13. Risks and choices I made for you

- **Glyph outlines vs embedded fonts.** I chose outlines because they are exact, identical in every format and
  license-free. Text is then not searchable inside the figure, which journals accept. Authors who want real fonts
  use the overlay bundle.
- **MathJax's TeX fonts have one design size.** At 8 pt they are a little lighter than LaTeX's cmr8 optical size.
  This is barely visible beside the text (`proto/latex/paper-demo.pdf`). The overlay removes even that.
- **jsPDF + svg2pdf stay** with `putOnlyUsedFonts: true`, which fixes E2 without a new dependency.
- **A hue wheel cannot be fully colour-blind safe.** The contour lines carry the information instead, and B/W is one
  click away.
- **Unbounded regions are cut by the frame.** Article keeps the frame, which states the window. Homework has no
  frame, and the cut edge is the panel edge.

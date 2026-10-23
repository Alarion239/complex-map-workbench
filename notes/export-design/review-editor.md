# Review: the export redesign, from a journal editor and typesetter

**Verdict: accept with major revisions.** The direction is right, and most of it is already better than v12:
- figures at their exact LaTeX width;
- CM outlines with no fonts declared;
- vector lines;
- the caption in `\caption`;
- sensible cropping.

What remains are the things a production desk or a careful grader would send back. Two are about the PDF itself:
transparency and soft masks in a file that claims to be PDF 1.3, and RGB rasters in "black and white". The others are
typographic collisions, colour that does not survive grey for the *tracked points*, labels that look like stickers, and
gaps in the LaTeX workflow (floating homework figures, the overlay's bounding box). Everything below was checked on
the files in `proto/out/` and `proto/latex/`, rendered with poppler at 250–1200 dpi and inspected with `pdffonts`,
`pdfimages`, a content-stream parse, and the PNG chunks. Phase and Landscape were not prototyped, so they are not
reviewed (see M1).

Each item gives the evidence, then the fix. Within each section, items are in priority order.

---

## A. Must fix before this ships

### A1. The PDFs use transparency and claim PDF 1.3
- Every embedded image has an **SMask**, but the extracted alpha is **255 everywhere**:
  - `pdfimages -list` shows 2 smasks in `article-column.pdf` and 4 in `deformation-filmstrip.pdf`;
  - the alpha extracted from `article-column.pdf` and `homework.pdf` is a constant 255.
- The glyph XObjects are drawn under an ExtGState with **`/CA 0`** (object 5: `<< /ca 1 /CA 0 >>`), invoked 33 times
  in the column figure.
- The header is `%PDF-1.3`. Soft masks and constant alpha are PDF 1.4 features, so the file is internally
  inconsistent. PDF/X-1a-style preflight, which IEEE PDF eXpress and several publishers' production checks use, flags
  "transparency used" on the first problem alone.
- Cause: canvas `toDataURL` always writes an RGBA PNG (colour type 6), and jsPDF turns any alpha channel into an
  SMask. svg2pdf adds the `/CA 0` state for the glyph `<use>` elements.

**Fix.** Embed opaque images without an alpha channel. `compose.js` already writes PNG chunks by hand, so add a
40-line encoder:
- colour type 2 (RGB) or 0 (grey), plus pHYs;
- IDAT from `new CompressionStream('deflate')`, which is native and zlib-framed, exactly what PNG needs;
- no new dependency.

Remove the `/CA` state: give glyph paths an explicit `stroke` attribute that svg2pdf maps to "no stroke", or strip
the unused `gs` after generation. **Acceptance test** (add it to the prototype's run and later to `test/regress`):
- `pdffonts` lists nothing;
- `pdfimages -list` has no `smask` rows;
- no ExtGState has `/CA` or `/ca` below 1;
- MediaBox equals the target width in bp.

### A2. Black and white must be real grey
- `article-column-mono.pdf` embeds **RGB** rasters (`pdfimages`: `rgb 3`).
- `article-column-mono-600dpi.png` is **RGBA**.
- In a CMYK production workflow, RGB greys become four-colour greys. That risks a colour cast and soft,
  mis-registered anti-aliased edges.
- The mono PDF (58 KB) is larger than the colour one (56 KB).

The vector ink is already correct: black and grey are written as `g`/`G` (DeviceGray). Keep that.

**Fix.**
- In B/W, encode fill rasters as 8-bit grey (colour type 0 → DeviceGray). That also cuts the image bytes by about ⅔.
- Raise the tone contrast. #A6A6A6 / #E4E4E4 is L\* 68 / 91, so ΔL\* is 22.5. That is *less* contrast than the
  colour version printed in grey (L\* 63 / 87), and 11 % grey is at the drop-out limit of office lasers. Use about
  45 % / 14 % (#8C8C8C / #DBDBDB, L\* 58 / 87).

### A3. Typographic collision in the filmstrip titles
`t = \tfrac13` and `t = \tfrac23` share a baseline with `t = 0`, so the denominator **touches the top frame line**.
Evidence: a 1000 dpi crop of `deformation-filmstrip.pdf` over the second title. A stacked fraction in a 9 pt title
also sets its numerals at about 6 pt, which is below the size the rest of the figure respects.

**Fix.**
- Set the titles inline as `t = 1/3` and `t = 2/3`, or use frames at t = 0, ¼, ½, ¾, 1 written as decimals.
- Reserve the depth of the deepest title for all titles.
- Run the composer's collision check of *title box ∩ frame*, which it does not do today.
- Give the frames panel letters, "(a) t = 0", so the text can cite Fig. 3(b).

### A4. The homework figure floats away from the problem
`homework-demo.pdf` prints the figure **above "Problem 3"**, because the snippet is `\begin{figure}[tbp]`. In a
homework the figure belongs right after the solution text that cites it.

**Fix.** For Homework, emit a non-floating block:
```latex
% needs \usepackage{capt-of}   (or \usepackage{float} and [H])
\begin{center}
  \includegraphics{cayley.pdf}
  \captionof{figure}{...}\label{fig:cayley}
\end{center}
```
Keep `figure`/`[tbp]` for Article. Emit `figure*` only for full width in a two-column class: a 510 pt figure in
`article` is impossible anyway, so the Size menu already implies the class.

### A5. The tracked points lose their identity in grey, and coloured letters are illegible
- The filmstrip's three paths and dots use vermillion, bluish green and reddish purple (L\* 54 / 58 / 61). Printed in
  grey they are the same mid-grey (proof: the filmstrip converted to L). On the dark checker the solid path segments
  almost vanish (frame t = ⅔).
- The homework *letters* are set in the point colours. Against white, D/D′ in #E69F00 has contrast **2.25 : 1** and
  C/C′ in #CC79A7 has **3.06 : 1**. At 11 pt italic that is weak on screen and poor on a laser printer, and D′
  over the checker is the worst case.

**Fix.**
- **Letters are always black**, as in every textbook. Colour only the dots.
- Separate the tracked points by **marker shape**, which is the standard B/W device: ● ■ ▲ ◆ at r ≈ 1.6–1.9 pt.
- Label the paths' start or end points: i, 0, 1 at t = 0, or F(i), F(0), F(1) at t = 1.
- Draw paths 0.6 pt, with a 0.4 pt white casing where they cross the checker.

### A6. The label halo is heavier than the type it protects, and does not match the spec
- `XD.haloText` strokes the glyphs at `2·wpt·1000/pt`:
  - `F(i)` and `i` get a 178-unit stroke at 9 pt, which is a **1.6 pt stroke, 0.8 pt outside the glyph**;
  - homework labels get 1.46 and 1.2 pt.
- The stems of cmmi at 9 pt are about 0.5 pt, so the white rim is wider than the letter strokes. That is the "sticker"
  look in the 400 dpi render of `article-column.pdf` (`F(i)`) and on ℍ, 𝔻 and D′ in `homework.pdf`, where the
  rim also fills the double-struck counters.
- DESIGN §4 promises a 0.6–0.8 pt *stroke*.

**Fix.**
- Use a halo 0.35–0.45 pt *outside* the glyph: stroke width ≈ 2 × 0.4 × 1000 / pt, so ≈ 89 units at 9 pt.
- Draw the halo **only when the label's box overlaps a non-white fill**. Sample the art raster under the box: the
  fill is already rendered.
- Prefer the 8-direction placer choosing a spot on a single tone, so the halo is not needed.
- Never halo blackboard-bold letters. Place ℍ and 𝔻 inside a single cell.

### A7. The open-boundary convention is stated but not drawn
- DESIGN §5 says an open boundary (one not in the set) is dashed.
- The caption says "Im z > 0", and the disk is open.
- Every figure, homework included, draws both boundaries **solid** (no `stroke-dasharray` in `article-column.svg` or
  `homework.svg`).

A grader will notice. A referee will notice the inconsistency between the figure and the caption.

**Fix.** Decide, then enforce:
- **Homework**: dashed for open boundaries, as the design says, with a caption clause such as "dashed: boundary not
  included".
- **Article**: solid is the research-paper norm. Drop the rule there, or make it a Fine-tune option.

Either way, the figure and the caption come from the same flag.

### A8. Copy image will not carry its size
- Chromium sanitises images written with `navigator.clipboard.write` by decoding and re-encoding them, so ancillary
  chunks such as **pHYs and iTXt are dropped** on Copy image.
- In my experience Google Docs sizes inserted images by pixels and ignores pHYs.
- So a full-width homework figure lands at the right size only by accident, because Docs clamps it to the margins.
  A ¾- or ½-width figure is blown up to full width, with labels at 13–15 pt instead of 11. **Please verify this in
  Docs and Word on the Mac; it decides the design.**

**Fix.** Write a `ClipboardItem` with both `image/png` and `text/html`. The HTML is
`<img src="data:image/png;base64,…" style="width:4.875in;height:…in">`. Docs, Word and Notion honour the HTML size on
paste. For *Save PNG* → Docs upload, state the limit in the dialog note ("Docs ignores print size; use Copy image").

### A9. The in-image caption is justified with rivers
- `homework-docs-300dpi.png`, line 3: "C′ = −i,␣␣D′ = 0␣␣and␣␣E′ = 1; …".
- `XD.caption` breaks lines greedily, without hyphenation, and lets each space stretch to 3.5×.

**Fix.** Set in-image captions **flush left, ragged right**. That is the norm for captions inside artwork, it needs
no hyphenation, and it never looks wrong. If justification is kept, cap the stretch at 1.3× and fall back to ragged
lines.

---

## B. Should fix (quality a careful editor will see)

### B1. Line weights below the usual floor
Several lines are thin at final size:
- frame and ticks 0.4 pt;
- grid shapes 0.35 pt;
- the filmstrip's future paths 0.3 pt (dash 0.8/1);
- its real axis 0.35 pt (dash 1.6/1.2);
- the planned phase isochromatic lines 0.25 pt (§6).

Many journals' artwork checklists ask for **≥ 0.5 pt at final size** (AIP's does). Hairlines below about 0.3 pt
break up on 600 dpi lasers. The filmstrip's "dotted" and "dashed" lines are also indistinguishable at print size,
yet the caption tells the reader to tell them apart.

**Fix.**
- Frame and ticks: 0.5 pt.
- Anything that must be seen: at least 0.5 pt.
- Make **true dots** with round caps and a zero-length dash (`stroke-dasharray="0 1.8"`, `stroke-linecap="round"`,
  width 0.7), and dashes as 3 / 2 at 0.5 pt.
- Isochromatic lines: at least 0.35 pt, mid-dark grey.

### B2. Shading resolution
At 300 dpi the checker's cell edges show stair-steps at screen zoom (`article-column.pdf` at 1200 dpi, the right
half of the disk). Journal PDFs are mostly read on screen, and referees zoom. A flat-tone pattern is closer to line
art than to a photograph: the usual targets are 300 dpi for halftones, 500–600 for combination art and 1000+ for line
art.

**Fix.**
- Use 600 dpi for flat-tone patterns (checker, region fills) and keep 300 dpi for continuous tone (phase,
  landscape).
- Store flat-tone rasters as **indexed colour**: 2 tones plus an AA ramp is ≤ 32 colours. Even at double resolution
  the files stay small, and it fixes B9.

### B3. The unresolved accumulation reads as a region, and there is a hole at the image of ∞
- Near w = 1 the checker is averaged into a flat #9ABCDE patch with a visible edge (Fig. 1(b), all of 2(c), the
  filmstrip). A reader takes it for a separate set.
- At 133–150 lpi, cells of 0.2–0.4 mm will moiré in print.
- In the filmstrip at t = ⅔ there is a **white notch** at the accumulation point, inside the disk at its right edge
  (1000 dpi crop of `deformation-filmstrip.pdf`).

**Fix.**
- Fade the pattern's contrast smoothly to the mean tone as the local cell size falls from about 1.5 pt to 0.5 pt,
  so no edge is visible.
- Fill the unrendered sample with the mean tone.
- Mark the image of ∞ with the same ring as Fig. 1, in every frame.

### B4. Framing does not follow its own rule
- §7 says the crop "ends on a tick".
- The column figure (a) is [−2, 2] × [−½, 3½].
- The wide figure (a) ends at about 3.27 and −0.72, which leaves a **27 % sliver row** of checker cells across the
  top of Fig. 2(a). It reads as an error.

**Fix.**
- End periodic patterns on whole cells: the top at 3. Let panel (a) be non-square (4 × 3.5) rather than forcing
  equal aspect *and* equal height *and* a square.
- Never leave a partial cell under 50 %.
- Put the empty part of an unbounded window on the side where nothing is drawn.

### B5. Tick labels: precision and alignment
- **Mixed precision on one axis:** "0.9, 0.95, 1" in Fig. 2(c). The rule in ISO 80000-1 and house style, and the
  default in matplotlib and pgfplots, is **the same number of decimals for every tick on an axis**: 0.90, 0.95, 1.00.
  Change §4's "never 1.0" to "the fewest decimals that represent every tick on this axis".
- **Right-hand (mirrored) labels are left-aligned**, so the digits of 1, 0 and −1 do not line up (Fig. 1(b)).
  Right-side labels should align on the units digit and let the minus hang into the gap.
- **The three-panel figure:** the right labels of (b) sit in the (b)/(c) gutter about 11 pt from the frame of (c),
  so they read as (c)'s axis. Mirror only in the two-panel column layout. At full width, put every panel's labels on
  the left.

### B6. Homework axes
- **"2" is dropped** at x = 2 while "−2" is printed. The cause is the collision with "Re z" under the axis end. Put the
  axis name **beyond the arrow tip**, on the axis baseline (right of the x tip, above the y tip), which is the
  textbook position, and every symmetric label then fits.
- **Diagonal tick labels look misregistered.** The "2" on the Im axis sits above and left of its tick. Use the
  textbook layout: x labels centred below the tick, y labels right-aligned left of it. Nudge only a label that
  collides with a drawn curve, such as ±1 on the unit circle.
- **The orientation arrowhead in (a) sits on the real axis itself**, so that line carries two arrowheads, the
  orientation one at x = ½ and the axis tip. Draw orientation marks as **mid-segment chevrons in the boundary's
  colour**, between labelled points (between B and C, and between B′ and C′), and name them in the caption
  ("arrowheads: orientation").
- **The unbounded checker is cut hard** at the left, top and right panel edges with no frame, which looks like a
  cropped screenshot. Fade the fill to white over the last 6–8 pt on unbounded sides. Bake the fade into the raster,
  not into an SMask (see A1).

### B7. SVG hygiene
- `article-column.svg` has **10 duplicate IDs**: the halo copy and the label copy both define, for example,
  `MJX-18-TEX-I-1D456`.
- It nests **25 `<svg>` elements**, each with its own `<defs>`.
- The IDs are not namespaced, so two exported SVGs pasted into one Inkscape file or web page share `MJX-13-…` ids and
  swap glyphs.
- Nested `<svg>` with `<use>` is the construct most often mis-rendered by Office, LibreOffice and older Illustrator
  importers.

**Fix.**
- Flatten every label to `<g transform="translate(x,y) scale(s,-s)"><use href="#cmw-<hash>-g1D456"/></g>`, with one
  figure-level `<defs>` of de-duplicated glyphs and ids prefixed per file.
- Add a duplicate-id check to the test.
- SVG sizes are 2.0 MB for Fig. 2 against a 563 KB PDF. Show the SVG size in the Save menu as well.

### B8. The LaTeX overlay bundle
- **The box grows with the document's font.** The labels hang outside the art, so with newtx or Libertine digits the
  figure is no longer exactly `\columnwidth`. Add `\useasboundingbox (0,0) rectangle (245.08,123);` (in bp, as the
  file already uses).
- **Path fragility.** A bare `\includegraphics{article-column-art.pdf}` inside the `\input` file breaks as soon as
  the user keeps figures in `figs/`. Emit `\providecommand\cmwdir{}` and `\includegraphics{\cmwdir cayley-art.pdf}`,
  and say so in the snippet comment.
- **No halo over fills.** `F(i)` in Fig. 5 sits directly on the checker. Use `\contour{white}{…}` (the `contour`
  package), or knock a halo out of the art raster at that label's position.
- **TikZ is heavy** for 25 `\put`s. A `picture`-environment variant needs no package and survives every journal
  class.

### B9. File size
- Fig. 2's PDF is 563 KB, and 465 KB of it is the 600 dpi detail (982² RGB).
- Indexed colour (B2) should bring it to about 150 KB.
- The filmstrip SVG is 441 KB against a 141 KB PDF. Both are acceptable for journals, but the dialog's size note
  should be honest for every format.

### B10. Caption details
- **Panel letters do not match.** The caption uses `\textbf{(a)}` and the figure uses a regular upright (a). APS and
  AMS use regular (a) in both places. Use regular in both and expose the choice.
- **Spelling.** The generated captions and demo text say "disc", "centre" and "colour". The user writes for US venues
  (AMS and APS house style: "disk", "center"). Default the caption to en-US ("unit disk") and make it switchable.
- **Labels and file names come from the preset, not the scene.** `\label{fig:article-column}` and
  `article-column.pdf` collide on the second Article export. The mockup already says `cayley.pdf`; the snippet must
  use the same Name for the file and the `\label`.
- **Width guard.** Add one comment line: `% made for \columnwidth = 246pt; if yours is narrower use
  [width=\linewidth] (labels will shrink)`.

### B11. The preview must be typeset from the same source as the export
- In the mockup, the page preview's caption is set in a Times-like face.
- The filmstrip preview caption shows Unicode ⅓ where the snippet has `\tfrac13`.

"What you see is what you paste" is the whole promise. Typeset the preview caption with the same CM outlines from the
same LaTeX string. Also, "100 %" is CSS inches, not physical inches. Label it "actual size (approx.)", or offer a
one-time ruler calibration.

### B12. Page height rounding
`H = Math.ceil(H)` adds 0–1 bp of white at the bottom, so the space between figure and caption varies from figure to
figure. Use the exact height, to two decimals, as the width already does.

---

## C. Nits
- The detail marker in (b) is a 0.4 pt square of about 7 pt, which nearly disappears in print. Use 0.5 pt with a
  10 pt minimum side, or two thin leader lines to panel (c).
- In the filmstrip at t = 0, "q" sits on the dashed path of 0. The label placer must avoid curves, not only other
  labels.
- The column caption explains the open circle but not the marked point i ↦ F(i) = 0. Either mention both or neither.
- The filmstrip at t = ⅓ clips the image region at the frame top, which is fine. Note "window: [−2.5, 2.5] ×
  [−1.75, 2.5]" in the caption, or let the frame state it.

---

## D. Verified correct (do not regress these)
- **No fonts in any figure PDF.** `pdffonts` is empty for all six files, so v12's E2 is fixed. Labels are CM outlines.
- **Exact widths.** MediaBox widths are 245.08 bp (246 pt), 508.10 bp (510 pt) and 468.00 bp (469.75 pt). The REVTeX
  demo includes them at natural size with no overfull boxes.
- **True label sizes.** Tick numerals are 8 pt (digit height 5.5 pt in the SVG) and panel labels 9 pt.
- **The outlines match Latin Modern 8 in weight.** At 1200 dpi, the "1" from the outline version (Fig. 1) and the
  overlay's LMRoman8 "1" (Fig. 5) have the same height (89 vs 88 px) and stem width (12 vs 11 px, < 0.06 pt). The
  optical-size worry in DESIGN §13 is negligible for tick labels.
- **Vector ink is DeviceGray.** Black is written as `g`/`G`, so thin black lines print on K only.
- **PNGs are opaque** (alpha is 255 everywhere) and carry correct pHYs: 6.50 in at 300 dpi, 3.40 in at 600 dpi.
- **Images are not interpolated** (`interp no`).
- **The captions are in journal register.** This is a real improvement over v12.

## E. Missing before approval
- **M1. Phase and Landscape** were v12's worst exports (E7, E10), yet no new figure exists for them. I need these in
  `paper-demo.pdf`, each in colour *and* B/W, before I can sign off on §6 and §11:
  - the colour phase portrait with its isochromatic lines and the ring key;
  - the B/W contour portrait;
  - the landscape with vector CM axes.
- **M2. A non-CM document.** Compile one demo with `newtxtext,newtxmath` to show the outline-vs-overlay choice the
  README asks the user about.
- **M3. Grey proofs for every figure**, not only the article column: write `*-gray.png` next to each output as a
  standing check. A5 and A2 would have been caught by it.
- **M4. A preflight script** in the prototype, then in `test/regress`: no fonts, no smask, no CA/ca < 1, MediaBox
  equals the target, PNG colour type 2 or 0, pHYs present, no duplicate SVG ids, and no label box intersecting a
  frame line or another label (A3, B6 and C would have been caught).

**Suggested order:** A1, A2, A4 and B10 (small, mechanical, workflow-critical); then A3, A6, A9 and B5 (typography);
then A5, A7, B1 and B6 (meaning in print); then B2, B3 and B4 (shading and framing); and M1 last, because it is the
largest.

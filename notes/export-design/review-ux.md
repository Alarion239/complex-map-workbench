# Export redesign: UX review

Reviewers: a student doing complex-analysis homework, a TA grading it, and a product designer.
Material reviewed: `DESIGN.md`, `README.md`, `mockup-export.html` with `mockup/shot-*`, `proto/out/*`,
`proto/latex/*`, `before-after-column.png`, and the v12 export code in `notes/gate-merged-r2/src/app.js`.

Evidence I produced is in `review-ux/`:
- `mockup-at-760px.png`: the mockup at the width of the claude.ai artifact side panel.
- `overflow-default-article-345pt.png` and `overflow-test.tex`: the Homework figure in Overleaf's default
  `article`, compiled with pdflatex.

I edited nothing outside `notes/export-design/`.

## Verdict

The figures are article grade. The type is right, the sizes are exact, the B/W version is clean, and the maths is
correct. I checked:
- A–E ↦ A′–E′;
- the orientation arrows (F(½) = −0.6 − 0.8i);
- the filmstrip's fixed points p, q, the multiplier e^{2πi/3} and the straight orbit of 1 on the bisector of pq.

The dialog is calm and the "page at true scale" idea is the right core. It is **not yet "way cooler and sleeker"**,
and it is **not yet a few seconds to Overleaf or Docs**. Three structural problems are in the way:

1. **The buttons don't name destinations.** The Homework preset serves two destinations (LaTeX and Docs) with one
   primary button, and the Caption row flips by itself depending on which button you press.
2. **Copy image rests on assumptions that do not hold.** The browser strips the PNG's size, and the claude.ai iframe
   may block the image clipboard.
3. **The Homework snippet breaks a typical Overleaf homework.** With Overleaf's default margins the figure overflows
   by 125 pt. In the prototype's own demo the figure floats above the problem statement.

Fix those three and remove the Caption row, and the dialog has **three rows plus two destination buttons**. Then add
the five small touches in §4. That is the premium version without a cockpit.

## 1. The two jobs, counted

| Job | Mockup as designed | Proposed (§3) |
|---|---|---|
| Figure into an existing Overleaf paper or homework | Open → *Save PDF* → host confirm → back to the dialog → *Copy LaTeX* → upload in Overleaf → paste. 4 clicks in the app and 2 trips between windows. | Open → **For Overleaf** (copies the snippet, then saves) → host confirm → upload → paste. 2 clicks in the app and 1 trip. |
| Figure into Google Docs / Word | Open → *Homework* → *Copy image* → paste. 3 clicks, *if* the clipboard works in the iframe (P0-2). | Open → **For Docs** → paste. 2 clicks. Repeat later with one shortcut (§4.5). |
| The same figure again after a tweak (the commonest homework loop) | Open the dialog and do it all again. | *Copy figure again* (⇧⌘C) or *Save figure again*: 1 action, last settings, current scene. |

## 2. Problems and fixes

### P0: these block "a good figure in a few seconds"

**P0-1. Homework has two destinations but one primary button. The Caption row is a mechanism, not a choice.**
- In state B the primary button is *Save PDF*. The Docs action is the face of a split button. The Caption control
  switches to "In the image" by itself when you copy for Docs.
- On the page preview, a caption looks the same whether LaTeX sets it or it is baked into the image. So the row asks
  the user to choose something that the destination already decides.
- Split buttons also hide the second most common action.

Fix:
- Replace *Copy ▾* / *Save PDF ▾* with two plain buttons named by destination, plus a quiet text button:
  - **For Overleaf**: copies the snippet *first*, synchronously in the click, then saves the PDF. The host's save
    confirmation takes focus from the iframe, and a clipboard write after it can fail.
  - **For Docs**: copies the image (P0-2).
  - **More formats ▾**: SVG, PNG 300/600, LaTeX bundle, All views, animation.
- Caption placement follows the button you press. Delete the Caption segmented row.
- Make the caption editable *on the paper*: click the typeset caption to reveal its source.
- In Homework, whichever destination you used last becomes the primary button.

**P0-2. *Copy image* will not paste "at 6.5 in". It may not copy at all inside claude.ai.**
- Chrome and WebKit decode and re-encode PNGs written with the async clipboard API, and drop their metadata. The
  pHYs size and the `cmw:scene` chunk are therefore lost.
- Full width still lands at 6.5 in, but only because Docs and Word shrink oversized images to the margins. The
  ¾-width and ½-width sizes paste at full width: 975 px at 96 dpi is 10.2 in, clamped to 6.5 in.
- `ClipboardItem` also needs `clipboard-write` permission on the artifact iframe.
- v12 already falls back to `execCommand('copy')` for plain text (`copyText`, app.js 8244), which suggests the async
  API is unreliable here.

Fix:
1. Test in the published artifact before building: Chrome and Safari, pasting into Docs, Word and Notion.
2. Write two flavours. One is `image/png`. The other is `text/html` with
   `<img src="data:image/png;base64,…" width="{in×96}" height="…">` and the caption as real text below it. Docs and
   Word size an image from its width attribute, and the caption becomes editable text in the student's document.
   That is better for homework, where the student renumbers and rewords captions.
3. If `ClipboardItem` throws, select a hidden contenteditable that holds the same `<img>` and run
   `execCommand('copy')`. If that also fails, save a PNG and say why in one line.
4. Remove "pastes at 6.5 in wide" from the footer until step 1 confirms it.

**P0-3. The Homework snippet floats the figure away from the solution.**
- In `proto/latex/hw-1.png`, Figure 1 sits at the top of the page, *above "Problem 3."*. That is the `[tbp]` float
  doing what floats do in a short document.
- A grader reads the figure before the problem it belongs to.

Fix:
- Homework emits `\begin{figure}[H]` with `% needs \usepackage{float}` in the preamble comment.
- Article keeps `[tbp]`.
- Verified: with `[H]` the figure stays after "Problem 3." (`review-ux/overflow-test.tex`).

**P0-4. Natural size plus the default Homework width overflows Overleaf's default document.**
- Overleaf's blank project is `\documentclass{article}` with no `geometry`, so `\linewidth` is 345 pt.
- The Homework default is 469.75 pt (1 in margins). The figure then sticks 124.7 pt into the margin with an Overfull
  hbox warning, which students ignore (`review-ux/overflow-default-article-345pt.png`).
- The Homework Size list (DESIGN §3) does not offer the default-margin `article` widths at all.

Fix:
1. Homework sizes, in this order:
   - `article`, default margins (10/11/12 pt: 345/360/390 pt);
   - 1 in margins (469.75 pt);
   - A4 2.5 cm;
   - "Paste `\the\linewidth`".
2. Remember the size the user last picked.
3. As a safety net, the snippet shrinks only when the figure does not fit and never enlarges it:
   `\includegraphics[width=\ifdim\linewidth<469.75pt \linewidth\else 469.75pt\fi]{cayley}`. It needs graphicx only.
   It compiles with no overfull box: Figure 2 in the test.
4. Add a comment line naming the exact width to pick in the dialog for a perfect match.

### P1: these decide whether it feels "sleek" and professional

**P1-5. The Article default is a physics layout.**
- REVTeX's 246 pt two-column page is the APS format.
- Complex-analysis papers are mostly `amsart` (360 pt, one column) or arXiv `article`.
- The README's open question 1 answers itself in 360 pt: two panels side by side get about 2 in each.

Fix: default Article to `amsart` · 360 pt. Order the Size menu:
- `amsart`;
- `article` 10/11/12 pt;
- `article` with 1 in margins;
- then the journal columns: REVTeX, IEEE, Elsevier, Springer.

**P1-6. The Homework caption writes the answer.**
- "…sends the upper half-plane onto the unit disc… the boundary keeps the region on its left" is the solution,
  machine-written under the student's name.
- It also repeats what the solution paragraph says (`homework-demo.tex`).
- A TA wants the student's reasoning, and a figure that only names things.

Fix:
- The Homework default caption only names things: `$w=(z-i)/(z+i)$ on $\mathbb H$; points $A$–$E$ and their
  images.` It can also be empty.
- *Describe* is one click away for the full sentence.
- Article keeps the journal caption.

**P1-7. Point labels are unreadable on the fills and in grey.** I measured the colours.
- The Okabe–Ito label colours have L\* 54–71. The dark checker tone has L\* 59.
- Contrast against the dark tone is 1.0–1.5 : 1. Against the white halo it is 2.3–3.9 : 1, and orange *D* is
  2.25 : 1.
- In grey print, A, B, C and D become mid-grey on mid-grey. DESIGN §6 says "in grey the letters still carry it", and
  they barely do.

Fix:
- Keep the hue on the **dot**.
- Set the **letter** in a deep version at L\*≈39: vermillion `#A23C00`, green `#006B4E`, purple `#93366F`, ochre
  `#805400`. That gives 6.5–7 : 1 on the halo and 4.8–5.1 : 1 on the light tone.
- Alternatively use black letters with coloured dots.
- Halo: 1 pt.

**P1-8. Labels land on the busiest texture.**
- *F(i)* (in every Article figure), *D′* (Homework) and the "(c)" detail marker all sit NE of their points. That is
  the checker's accumulation at w = 1.
- The W/NW side is one flat cell.

Fix:
- Score the 8 candidate directions by texture under the label box in the art raster (edge density or luminance
  variance), not only by collisions with vectors. Prefer flat fill.
- Put the detail marker's "(c)" outside the frame or on the flat side.
- Join the rectangle to panel (c) with two 0.3 pt grey connector lines. Without them the tiny rectangle is hard to
  find (`article-wide-view.png`).

**P1-9. The "100 %" preview is neither true size nor big enough.**
- A CSS inch is not a physical inch on most screens.
- At 100 % the figure is about 330 px wide, about 45 % of the preview, and grey bars surround it.

Fix:
- Default to **Fit column**: scale so that the target column or text block fills the preview. The label-against-text
  comparison stays exact because the dummy text scales too.
- Drop "100 %", or rename it *Actual size* only if it is calibrated.
- Replace "200 %" with the loupe (§4.2).

**P1-10. The dialog breaks at the width where people actually use the app.**
- The artifact usually lives in the claude.ai side panel, 700–800 px wide.
- At 760 px the mockup stacks (its breakpoint is 860 px). The 100 % preview cuts panel (b) at the right edge and
  shows mostly grey bars.
- The dialog becomes about 980 px tall, so the buttons fall below the fold (`review-ux/mockup-at-760px.png`).
- The phone shot shows only grey bars (`cdp/shots/mockup-phone.png`).

Fix: below 900 px:
- the preview is Fit at about 45vh;
- For and Ink share one line;
- the footer with the two destination buttons is sticky and always visible.

**P1-11. Parts of the dialog read as "generated UI", which the user rejected once.**
- The rounded grey bars look like a loading skeleton, so the page looks unfinished.
- The monospace facts line reads as debug output: "lines 0.4-0.6 pt shading 300 dpi … no fonts to embed". In
  state B it overflows ("[ph" is cut off).

Fix:
- Show the dummy text as hairline word segments at x-height (light grey, varied word lengths, paragraph indents,
  ragged last lines), not pills.
- Replace the facts line with one sentence in the UI font: *3.40 × 1.71 in · labels match 10 pt text · PDF 56 KB*.
  The rest goes behind a "Details" tooltip.

**P1-12. Name is buried in Fine-tune, but it sets the file name and the `\label`.**
- A homework with two Cayley-map problems saves `cayley.pdf` twice and gets `\label{fig:cayley}` twice.

Fix:
- Make the footer's "Saves **cayley**.pdf" an inline-editable name.
- Prefill it from the map plus the region (`cayley-halfplane`).
- If a *different* scene was already saved under that name this session, suggest `-2`. A re-export of the same
  scene keeps the name, so Overleaf overwrites it, which is what you want while iterating.

**P1-13. The LaTeX bundle does not fit the main Overleaf case.**
- DESIGN §10 says "Overleaf takes the zip as an upload". In Overleaf's documentation, zip extraction belongs to
  *New Project → Upload Project*. The file-tree *Upload* adds files to an existing project. I found no statement
  that it unpacks a zip there; verify this in the UI.
- Adding a figure to an existing homework is the main case.

Fix:
- Put the TikZ overlay (about 25 `\node` lines) inline in the copied snippet. *Labels by LaTeX* is then also one PDF
  plus one paste.
- Keep the zip for *All views* and for archiving.

### P2: correctness polish (TA and editor)

**P2-14. Frame edges in unbounded directions don't end on a tick, as DESIGN §7 promises.**
- Panel (a) tops out at y ≈ 3.4 in the column figure and ≈ 3.25 in the wide one, which leaves a sliver row of
  cells.

Fix:
- Snap unbounded directions to a tick or a pattern cell.
- Pad bounded content (the disc) by 8 % without snapping, which is what the prototype does.
- Update the DESIGN text to match.

**P2-15. The filmstrip clips the region it is showing.**
- In frame t = ⅓, about a third of H_{1/3}(ℍ) is cut off, because the shared window is the one for t = 0.

Fix:
- Use the union of the bounded frames' boxes as the shared window, capped at 3× the t = 0 window.
- Otherwise mark the clipped side with a small arrow.

Caption nits:
- "Dotted arcs": the path of 1 is a segment, and the paths are drawn dashed. Say "thin dashed curves".

**P2-16. The open-boundary rule is promised but not used.**
- DESIGN §5 says open boundaries are dashed. No prototype figure dashes ∂𝔻 or Im z = 0.
- With cross axes the half-plane boundary *is* the axis, so dashing it would be invisible anyway.

Fix:
- Drop the rule, or limit it to boundaries that are not on an axis.
- State "open" in the caption.

**P2-17. Homework axis details.**
- On Re z the tick label "2" is dropped (−2, −1, 1, then a bare tick), because the title collides with it.
- E = ∞ has no mark in the z-panel.

Fix:
- Put "Re z" past the arrowhead so that 2 survives.
- Add a small "E (∞) →" at the right end of the real axis.

**P2-18. Justified captions inside images have rivers.**
- See line 3 of `homework-docs-300dpi.png`: "the boundary keeps the region on its left. Shading: a unit".
- MathJax has no paragraph builder and no hyphenation.

Fix: set in-image captions ragged-right.

**P2-19. Small technical mismatches.**
- The PNGs are RGBA with all-opaque alpha. Write RGB, which is smaller and never treated as transparent.
- Homework label sizes disagree: DESIGN §3 says 10 / 10.95 pt, mockup state B says "9 / 11 pt". Pick
  `\small` / `\normalsize`.

**P2-20. Phase and Landscape exist only on paper.**
- They have the worst v12 exports (E6, E7, E10).
- The ring key's width cost in a column and the B/W contour portrait are untested.
- The zeros-and-poles round now running makes Phase homework more likely.

Fix: before implementing, prototype one Phase figure as an Article column and as Homework, with zeros and poles
named with their orders.

**P2-21. Scope.**
- The user named homework and articles.
- Keep *Slides* as a preset, since it is just numbers.
- Defer MP4/GIF: GIF needs an encoder library, and MediaRecorder MP4 support varies. The filmstrip is the print
  answer.

## 3. Proposed panel

```
For       [ Article ]  [ Homework ]  [ Slides ]
Size      amsart · 360 pt  ▾          Text 10 pt ▾
Ink       [ Colour ]  [ Black & white ]
Fine-tune ▸  Crop · Axes · Panels · Points · Detail
─────────────────────────────────────────────────────────────────
Saves  cayley-halfplane .pdf        More ▾   [ For Docs ]  [ For Overleaf ]
```

- The caption is edited on the paper.
- The name is edited in the footer.
- In Homework, *Name the points* is on by default. Only points whose images are exact closed forms get names; there
  is no automatic naming for messy maps. This answers README question 3.
- Labels: outlines remain the default. The overlay is a Fine-tune switch that now costs nothing extra (P1-13). This
  answers README question 2.

## 4. Premium without a cockpit: five touches

1. **Presets morph.** Switching *For* animates the page in about 180 ms: the column widens to the text width and the
   box frame dissolves into cross axes. The three presets then feel like one object, not three forms.
2. **A loupe on the paper.** Hovering shows 3× magnification, re-rendered at print resolution, in place of the 200 %
   button. It is the "this is real print quality" moment: crisp vector lines, and the 600 dpi detail at the
   accumulation point.
3. **"See it in grey".** One eye icon on the paper switches to a print simulation. It makes *Ink*'s promise visible
   without adding a row.
4. **The button confirms what happened.** *For Overleaf* becomes "Saved · LaTeX copied" for 2 s. The first time
   only, two lines say: drop the PDF into Overleaf's file tree, then paste.
5. **One-step repeat and memory.**
   - The Export menu gains *Copy figure again* (⇧⌘C) and *Save figure again*. They use the last destination and
     settings for the current scene, and the toast has an "Adjust…" link.
   - For, Size, Ink, Text and the last destination are remembered per viewer in `localStorage`, with try/catch, so
     the second export opens already right.
   - Rename the menu entry "Figure for an article…" to **Export figure…** (⌘E), since homework is now first class.

Don't add:
- more rows;
- a font picker;
- a DPI field outside *More*;
- figure colour themes;
- more presets;
- drag-out-to-desktop (the host controls downloads, so it would not work in the iframe).

## 5. Verify before building

- [ ] `ClipboardItem` image write inside the published artifact (Chrome, Safari). Then the `text/html` flavour pasted
      into Docs, Word and Notion, with size and caption kept.
- [ ] Clipboard write *before* `downloads.save` from one click: both succeed and the host prompt still appears.
- [ ] Overleaf: uploading a zip into an existing project (expected: it is not extracted).
- [ ] The dialog at 760 × 700 and 390 × 844: buttons visible, preview Fit, no horizontal scroll.
- [ ] The guarded `\includegraphics` in `amsart`, `article` (10/11/12) and REVTeX: no overfull box, natural size
      wherever it fits.

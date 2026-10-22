# The deformation as one picture (UI backlog item 2)

Design, 2026-10-20, **revision 2** after `review.md` (B3, M1–M6). Covers the on-screen deformation and the exported
article figure. Nothing in `src/` was changed; the prototype only reads `src/cx.js`, `src/parse.js` and
`src/funcs.js`. Item 2 can be built any time after U-b (`panels.md` 11), in `app.js` and `funcs.js` only.

- Prototype script: `notes/ui-design/proto/morph-figure.js` (run `node notes/ui-design/proto/morph-figure.js`; it needs
  TeX Live for the labels and caption, and runs in about 5 s).
- Output: `notes/ui-design/proto/out/morph-{cayley,square,exp}.svg` (figures), `screen-{cayley,square}-t055.svg`
  (on-screen mockups), `selection-log.txt` (which paths were kept or dropped, and why, plus the generated captions);
  `notes/ui-design/proto/index.html` shows them all together.

**What changed in revision 2.** Nothing in the figures is hand-picked any more. Path selection, label placement and
the caption are computed by the rules below, and the three examples are their unedited output. X is tinted neutral
grey instead of a light blue, the halfway boundary is off by default, the checker fades where its cells get smaller
than the pixels, and the captions say only what is mathematically true of the kept paths.

## 1. Decision

**The deformation is one plane.** A homotopy H : [0, 1] × X → ℂ puts z, every H_t(z) and F(z) in the same complex
plane, so the paths t ↦ H_t(z) can only be drawn exactly in one coordinate system. The picture shows three things in
that plane:

1. X, in neutral grey (ink at 7 %), with its outline drawn on top in ink. Colour belongs to the image only, so X and
   F(X) differ in hue and in greyscale, not only in lightness.
2. F(X), as every image is drawn: the carried pattern and its edge.
3. The **paths t ↦ H_t(z)** of a few selected points (section 4). Each path is a thin ink line from a dot at z to an
   arrowhead at F(z).

An optional fourth layer, **Halfway boundary** (off by default), draws the boundary at t = ½ dotted in ink and says
so in the caption. At 0.5 px in the region's colour (revision 1) it read as a stray line.

On screen this is the right panel while the deformation is open; this is the one sanctioned exception to "Y on the
right" (`panels.md` U1), because the paths start in X. Exported, it is a single framed panel in the existing article
style, with a caption that names the homotopy.

What the three figures show: in the Cayley figure the boundary points swing about the elliptic fixed point *p* on
arcs of circles, and the one from 1, which lies on the perpendicular bisector of the fixed points, moves on a
straight segment. In the z² figure the arrows are the spirals r^{1+t}e^{i(1+t)θ}. In the exp figure the strip's
sides curl into the half-annulus. Two separate panels cannot show that.

## 2. Why not two panels with arrows between them

A side-by-side X | Y figure with connector arrows from X's panel to Y's panel would look like a deformation, but the
arrows would be chords between two different windows. They would not be the paths of H_t. That is the "pretty but not
true" figure the user rejected as AI slop. The existing two-panel figure (a) X → (b) F(X) stays as it is. It remains
the right figure for a static map.

## 3. On screen (right panel, transport open)

The right panel shows images H_t(X) for t ∈ [0, T]. At t = 0 that image is X itself, so X appears there only as a
ghost. The left panel is unchanged: X, editable, as always.

**Layers, bottom to top** (light tokens; dark tokens follow the theme):

| Layer | Look |
|---|---|
| X at t = 0 | Fill `--ink` at 7 %, as in the figure; **outline only when X is unbounded** (a half-plane would grey half the pane and make Y look like X). Outline 1 px `--faint`, dashed 4/3 only when the set is open. |
| F(X) at the end | 1 px `--faint` dotted 1/2, as in spec 6.11 (only while T < end) |
| H_T(X) | The region with its pattern and edge, as today (`drawScene` with `morphState`) |
| X's outline again | Over the moving fill, so X never disappears under its image (the z² case: X ⊂ F(X)) |
| Rails | Each kept path from 0 to the end: 1 px `--faint` at 75 %, ending in a 7 × 5.2 px arrowhead of the same ink |
| Travelled part | The path from 0 to T: 1.5 px `--ink-2` on a 3.2 px `--halo` casing at 80 % |
| Heads | A 2.6 px dot in `--ink-2` with a 1.2 px `--halo` ring at H_T(z). The start is a 2 px dot with a 1 px ring. |

The rails show where each point is going, and the head shows where it is. When the transport reaches the end, the
travelled part covers the rail, and the screen shows the figure.

**Controls.** The transport is unchanged (play, scrubber, t, speed, Natural path / Straight line, Loop, close), plus
one checkbox, **Paths** (default on), next to Loop.

**View.** On opening, if the visible part of X and its image do not both fit the right view, the right view tweens to
the union of the two (the "Fit" motion of spec 7, `--t-view`). On closing, the previous right view comes back,
unless the user moved the view while the transport was open.

**No popping while panning (M5).** Samples of a bounded X come from the shape itself and do not depend on the view.
For an unbounded X the samples come from the visible part of X, and they are re-chosen only when a pan or zoom
settles, never during it.

**d/dz steps (M1).** Across a d/dz step the "deformation" from G_{k−1}(z) to G_{k−1}′(z) is a straight-line
cross-fade between a function and its derivative, not a motion of points. No paths are drawn over that step; the
screen keeps today's cross-fade, and the deformation export is disabled with the tooltip "d/dz has no deformation".

**Other views.** One time t drives every view, as today. The phase portrait and the landscape of H_t are plots over
X, so they are on the left with the rest of Phase and Landscape (`panels.md` 7). On the sphere of Y (after P3b), the
same layers are lifted to the globe with the conjugate lift; Möbius paths are circles there.

**Cost (60 fps).** The paths are computed on the CPU once per (chain signature, shapes signature, homotopy mode,
sample key), where the sample key is constant for bounded X and the settled view for unbounded X. Measured in node:
20 paths × 601 evaluations of the Cayley homotopy took 0.8 ms; the selection (crossings, clearance) adds a few ms
once, not per frame. Per frame only the travelled parts are stroked on the 2D overlay: a few hundred `lineTo` calls.
`renderMorph`'s point trails already work this way (`morphAt`).

## 4. Sample points and selection (one rule for the screen and the figure)

**Candidates.** Let L be the length of X's boundary inside the sampling window. Let h = niceStep(L / 10), the 1-2-5
rule of the ticks.
- **Boundary points.** Corners are always candidates. Straight pieces give the points where they cross the lattice
  lines of step h (along the piece's longer coordinate), so the samples have nice coordinates. Arcs give equal
  angles, about one per length h. No two candidates are closer than 0.45 h.
- **Interior points.** Lattice points of step 2h inside X, at least 0.4 h from the boundary.
- Point shapes the user drew always get a path, labelled with the point's own label as today (*a*ₜ on screen).

**Hard prunes** (screen px of the drawing):
- broken: the path passes through ∞ or a cut;
- fixed: shorter than 7 px;
- **outside (B3.3):** any part of the path closer than 3 px to the panel edge (the whole path must lie inside, not
  80 % of it);
- **hidden (B3.2):** the whole trace lies within 1.5 px of an axis or of a region edge (X's outline or F(X)'s edge),
  unless no other path is left. This removes exp's and z²'s real-axis paths, which showed only their arrowheads.

**Greedy selection by clearance (B3.2, B3.4).** Boundary candidates first, then interior ones. At each step the
candidate with the largest clearance to the kept paths is taken (clearance capped at 30 px, plus 0.03 × its length
as a tie-break, so the first pick is the longest path). A candidate is skipped when:
- its arrowhead lands within 6 px of a kept path's start dot, or its start dot within 6 px of a kept head (nice maps
  send nice points to nice points: Cayley permutes −1 → i → 0 → −1, exp sends iπ → −1 and 0 → 1);
- it starts and ends within 6 px of a kept path (a near-duplicate);
- it crosses two kept paths;
- once four paths are kept, it crosses a kept path or comes within 4 px of one ("clear beats many");
- it is an interior point that crosses any kept path, or two interior points are already kept.

**Budget.** 2.5 paths per inch of figure width: 8 at 3.4 in, 17 at 7 in. On screen the pane's CSS width in inches
(96 px each) is used.

**Non-injective maps (M3).** When two kept paths end within 2 px of each other (z and −z under z²), both are kept,
because two arrows meeting show non-injectivity, and both heads stop 1.5 px short of the common point so both are
visible. The caption then adds "Arrows that meet show points with the same image." None of the three examples is
non-injective on its set, so this rule is implemented in the prototype but not exercised by its output.

**What the rule gives** (`proto/out/selection-log.txt`):

| example | kept | dropped, and why |
|---|---|---|
| Cayley, 3.4 in | 8: seven boundary points (−1.5, −1, −0.5, 0.5, 1, 1.5, 2) and one interior point (−2 + i) | −2 and −2 + 2i leave the frame; 0 and i put a head on a start dot; 1 + i, 1 + 2i, 2 + i come within 4 px; three over the budget |
| z², 3.4 in | 7 boundary points (three on the imaginary axis, four on the arc) | 0 and 1 are fixed; 0.5 and 1.5 run along the real axis (hidden); no interior point qualifies (1 + i is 0.086 from the arc, under 0.4 h) |
| exp, 3.4 in | 5: iπ, −1 + i, 1 + i, 1 + 2i and the interior point 2i | −1, 0, 1 run along the real axis (hidden); 1 + iπ leaves the frame; −1 + iπ and −1 + 2i come within 4 px (they formed the crossing bundle) |

## 5. The figure

**When.** Export figure while the deformation is open.
- **Default: one panel**, the deformation (M4). It always shows the **whole** deformation, t from 0 to the end, with
  F(X) as the region, wherever the scrubber stands.
- **Both** gives (a) X and (b) the deformation, with **no arrow** between them (an arrow labelled F would mislabel a
  panel that shows H_t), and (b) is captioned "the deformation H_t, 0 ≤ t ≤ 1".
- **Up to the current t** (an option): the deformation for 0 ≤ t ≤ T, with the region H_T(X) and "0 ≤ t ≤ T" in the
  caption.
- Disabled when the range includes a d/dz step (M1).

**Panel.** The existing article style unchanged: 0.75 px frame, inward ticks (4 / 2.2 px, 0.6 px), TeX tick numbers
at 8 pt, light theme, plots at 300 dpi. The window is the right view, which was fitted to X ∪ F(X) on open. The axis
titles are **Re** and **Im** with no variable, because the plane holds both z and H_t(z).

**Layers and weights** (figure px, 1 px = 1/96 in = 0.75 pt):

| Layer | Spec |
|---|---|
| Paper | `--plane`, the grid in `--grid-minor` / `--grid-major` (0.4 / 0.5 px), axes 0.6 px `--axis`. Raster in the app, as `renderOff` draws them. |
| X | Fill `--ink` at 7 % (B3.7), under the image |
| F(X) | The carried pattern at α 0.85 and its 1 px `--cN-edge` edge, dashed 3.2 / 2.2 when open (raster, exact inverse path, as today). **The pattern fades to its mean colour where a cell is smaller than 2–4 device px** (smoothstep on the cell footprint, as the Tiles glyph does), on screen and in the export, so there is no moiré at the image of ∞ (B3.6). |
| Halfway boundary (option, off) | 0.6 px ink, dotted (round caps, 0.1 / 1.6), vector; with m ≥ 2 steps, the boundary after each step 1 … m − 1 instead |
| X's outline | 0.6 px `--ink-2`, dashed 3.2 / 2.2 when open, vector, over the image |
| Paths | 0.65 px #1B252C, round caps, on a 2.0 px white casing at 85 %, vector. Each line stops at the arrowhead's notch. |
| Arrowheads | Filled "stealth": length 4.6, half-width 1.75, notch at 70 % of the length, tip exactly on F(z) (1.5 px short when heads meet), aligned with the path's chord over its last 4 px. White casing of 1.3 px. |
| Start dots | r 1.4 px, same ink, white ring r 2.1 (M6) |
| Labels | *z* and *F(z)* on one path, 9 pt TeX with a 1.5 bp white casing, placed by the rule below |

Everything vector sits inside a `clipPath` of the panel. The paths are neutral ink, not the shape's colour, so they
read over every pattern and print in greyscale.

**Label placement (B3.1).** For every kept boundary path, try 24 directions for each label:
- *z*: on the outer side of X's boundary, within 75° of the outward normal at z (the mean of the directions that leave
  X), 1.2 px beyond the dot's ring. The label's centre must lie outside X.
- *F(z)*: within 100° of the path's direction at its tip, 1.5 px beyond the tip.

A position is accepted when the label box plus 2.5 px is clear of every ink layer: all paths, arrowheads, start dots,
X's outline, F(X)'s edge, the halfway boundary if on, both axes, and the frame with its ticks (5 px inside). Among the
accepted pairs the one with the most extra room wins; ties go to the longer path. If no path has a clear pair, both
labels are omitted (the caption already says "from z (dot) to F(z)"). In the three examples the labels landed on
z = 0.5 (Cayley), z = 1.5i (z²) and z = iπ (exp).

**Caption (B3.5).** Generated from the chain, the kept set and the measured path geometry, like `figureCaption`:

> [Set] (grey) and its image under [F(z) = …] (checkerboard), joined by [homotopy phrase]. Arrows are the paths
> t ↦ H_t(z) of [boundary points | boundary points and one/two interior points], from z (dot) to F(z)[; path clause].
> [The dotted curve is the boundary at t = 1/2.] [Arrows that meet show points with the same image.] The checkerboard
> has cells of side c in the z-plane, carried by F. [Dashed boundaries do not belong to the sets.]

- The "interior points" clause comes from the kept set, so z² says "boundary points" only.
- The **path clause** is measured, not assumed: each kept path is tested for being a segment (collinear) or an arc
  (concyclic), to 1e−7 relative, and the clause is "each is a segment", "each is an arc of a circle" or "each is an
  arc of a circle or a segment" accordingly. It is stated only for Möbius and affine steps, where the theory says the
  test must pass; a failing test is a bug, not a caption.
- **No app vocabulary**: no "natural homotopy", no "guaranteed by the chain". Guarantees are left out of deformation
  captions.
- **A focused step (M2)** names the stage: "The image of the disc after f₁ (grey) and its image under f₂(w₁) = …
  (checkerboard), joined by …".
- **Typesetting**: no inline `\frac` (write (z − i)/(z + i), or `\tfrac` for numbers); no line breaks inside a formula
  (in TeX `\relpenalty=10000`, `\binoppenalty=10000`; in `layoutCaption`, each inline formula is one unbreakable
  box); captions set ragged-right at this width.

**Homotopy phrases** (a new optional `homTex` on each function definition in `funcs.js`):

| Step | Phrase |
|---|---|
| Möbius, elliptic | the elliptic Möbius transformations H_t that fix p and q, with H_t′(p) = e^{iθt}, 0 ≤ t ≤ 1 (θ read from `mobPath`'s branch, \|θ\| ≤ π; Cayley: p = ½(√3 − 1)(i − 1), q = ½(√3 + 1)(1 − i), θ = −2π/3, computed in the prototype) |
| Möbius, hyperbolic or loxodromic | the Möbius transformations H_t that fix p and q, with H_t′(p) = k^t (principal branch of the multiplier's logarithm, as `mobPath`) |
| Möbius, parabolic | the parabolic Möbius transformations H_t with fixed point p, H_t = F^t |
| z + c | the translations H_t(z) = z + tc |
| zⁿ, ⁿ√z, z^α | the homotopy H_t(z) = z^{1+(α−1)t} (principal branch, or F's branch when F has one) |
| e^z | the homotopy H_t(z) = (e^{tz} − 1)/t + t for 0 < t ≤ 1, H_0(z) = z |
| log z | the homotopy H_t(z) = (z^{1−t} − 1)/(1 − t) + 1 − t for 0 ≤ t < 1, H_1(z) = log z |
| Straight line (menu), or a step without a homotopy of its own | the straight-line homotopy H_t(z) = (1 − t)z + tF(z) |
| Several steps | step by step: on k − 1 ≤ t ≤ k, the homotopy of f_k (each written out) |

The three prototype captions are the generator's output (`selection-log.txt`); none is hand-written.

**Rejected while prototyping:**
- Boundaries at t = ¼, ½, ¾. Three extra curves cluttered Cayley and exp; even one, in the region's colour, read as
  an artifact (B3.8). Now an option, dotted in ink.
- Ten grid nodes in Cayley, then four. The far nodes made giant loops; now at most two, and only when they cross
  nothing.
- A fixed 20 % "outside" allowance. It let the Cayley path from −2 run over the top frame and its ticks.
- X tinted in the shape's alt colour. Next to the light checker cells it differed from F(X) only in lightness.
- Samples at multiples of h from a corner. They gave labels like π − 1; they are now lattice crossings.

## 6. Implementation sketch (after U-b; `app.js` and `funcs.js` only)

1. `morphCandidates(X)` and `morphSelect(cands, box)`: sections 4's candidates, prunes and greedy selection, traced
   with the adaptive tracer (subdivide until a chord is under 1.2 px or the midpoint deviates by less than 0.04 px;
   break at non-finite values or jumps). Evaluate with `morphAt(T)`, which already follows the natural and
   straight-line modes and several steps. Cache as in section 3. The prototype's `selectPaths` is the reference.
2. `renderMorph`: X as the neutral tint (outline only when unbounded) plus outline; X's outline again over the fill;
   rails, travelled parts and heads in place of the point trails (point shapes keep their labels); the **Paths**
   checkbox (`S.morphPaths`, default true); no paths over d/dz steps.
3. `openTransport` / `closeTransport`: fit the right view to the union and restore it.
4. `buildFigure`: when `morphOn()`, the panel is drawn by `renderOff('R')` with `figMode` (paper, X's tint, the region
   at T = end, exact through `normalizeMap` where `Inverse.homExact` allows, with the cell-size fade). Then the vector
   layers (X's outline, the paths, arrowheads, dots, labels by the placement rule, the halfway boundary if on) in
   panel coordinates inside a `clipPath`. Axis titles Re and Im. `prepareExport` must also wait for the end stage's
   inverse program when the deformation is open; today it skips the `morphOn()` case. The panel options of section 5
   (one panel, Both without the arrow, Up to the current t).
5. `figureCaption`: the deformation template, `homTex` in `funcs.js`, the measured path clause.
6. Tests: path endpoints equal z and F(z) (to 1e−9 relative); the SVG contains one arrowhead per kept path; no label
   box meets an ink layer; the figure is unchanged when the scrubber moves (whole-deformation export); no arrow head
   within 6 px of another path's start; the export button is disabled with a d/dz step in range; dark theme on screen.

## 7. For the user to judge

Open `notes/ui-design/proto/index.html`. The open questions are collected in `notes/ui-design/README.md`.

The prototype's labels are typeset by TeX (latex + dvisvgm, glyphs as paths) in place of MathJax. The caption is set
by LaTeX's own line breaking, not by `layoutCaption`, so line breaks will differ slightly in the app.

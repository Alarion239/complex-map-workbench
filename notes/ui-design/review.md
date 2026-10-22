# Review: `panels.md` (items 1, 3–6, 8) and `morph-figure.md` (item 2)

Adversarial UX review, 2026-10-20. Nothing in `src/`, `dist/` or `test/` was touched.

**What I looked at.**
- Both docs in full, `UI_BACKLOG.md`, and the code paths the designs rely on: `setTool`, `leftStage`/`rightStage`,
  `targetsEditable`, `morphState`, `DC_STYLES`, `MODES`, the key handler, the tooltip handler, `pickSphere`,
  `GLR.camera`/`M4.lookAt`, the globe lift in `gl.js:1625`, the mobile CSS, and perf `modeUnit`.
- The three panel mockups as source only (HTML and `build_mockups.py`). Like their author, I have not seen them
  rendered: the panel layouts are still unverified.
- The five prototype SVGs, rasterised with macOS QuickLook (`qlmanage -t`, `nice 19`, a few seconds; no browser and
  no perf run). Every figure finding below was checked on those images.

**Verdict.** Both designs are sound in their core decisions and should go ahead with the fixes below:
- In panels.md: left = X, right = Y, a view is a surface plus a paint, Landscape and Phase move to X, one Add button,
  and descriptions in tooltips.
- In morph-figure.md: the deformation is drawn in one plane, because chords drawn between two panels would not be
  the paths of H_t.

Three findings are blocking:
- **B1.** Y Phase contradicts the design's own reason for having no Y Landscape.
- **B2.** The globe is a mirror image of the plane. That decides how item 8 and the P3 export behave.
- **B3.** The figure prototype has label collisions, arrowheads landing on other arrows' start dots, an arc drawn
  through the frame, and a caption that is false for one of the three examples.

---

## 1. Blocking

### B1. Drop Phase from the Y pane (panels U2, open question 1)

panels.md §2 rejects a Y Landscape because the graph of |w| over Y "is the same cone for every F". The same argument
rules out Y Phase: the colouring of the w-plane is the same colour wheel for every F. It is the only state of either
pane that does not depend on F, and a user who edits the chain while it is showing will see nothing change. It also
causes four problems:
- **The style control appears twice.** When both panes have Phase on, the style control is shown in both strips but is
  one setting (`S.dc`), so changing it on one side silently changes the other.
- **Cauchy breaks the Y radio group.** Cauchy has no Y meaning. With `S.dc = 'cauchy'`, the Y strip (which has no
  Cauchy button) is a radio group with nothing selected.
- **"Outlines" is also shown twice**, again as one shared setting.
- **It costs one more render pass and one more key (⇧4)**, all for symmetry.

The colour key it is meant to provide already exists: the X legend chip (wheel and modulus strip). For the Grid
style ("pull-back of the Re/Im grid"), the Y plane's own background grid is the key.

**Fix.**
- Y offers `Plane · Sphere` only. X offers `Plane · Sphere · Landscape` plus a Phase toggle.
- The style, *n*, Δ and Outlines controls live only in the X strip.
- Drop ⇧4, the Y Phase readout, the "phase of w" role, and P3 deliverable 11.2's identity colour pass.
- "Uniform" then means: the same control, in the same place, with the same order and keys, and items absent where they
  do not apply. The user asked for exactly this ("where it applies").
- If the user still wants the key in the w-plane, make it a small "Key" toggle inside the X legend chip that paints Y.
  It should not be a view of Y.

### B2. The globe is a mirror image of the plane (item 8, P3, export)

The app's lift is P(z) = (2x, 2y, |z|²−1)/(|z|²+1), and `gl.js:1625` inverts it with w = P.xy/(1−P.z). The camera is
an ordinary right-handed `lookAt` with up = +z (`gl.js:3443`, matched by `pickSphere`). Seen from outside, this
projection reverses orientation. I checked this numerically with the app's camera formula: at four camera poses
(including the default `CAML`) the screen Jacobian of z ↦ screen has det < 0 at every front-facing point. Today this
is easy to miss. Item 8 makes it visible:
- **Half-plane** ("the region is to the left of the arrow") fills the screen-right side on a globe.
- **Sectors and arcs** sweep clockwise.
- **Orientation chevrons** point the wrong way.
- **The Tiles pattern's F glyph** is drawn mirrored on every globe, so an exported globe figure suggests an
  orientation-reversing map. This is exactly the kind of error the user will catch.

**Fix (P3, renderer and app together, one convention).**
- Use the conjugate lift P(z) = (2x, −2y, |z|²−1)/(|z|²+1). ∞ stays at the north pole, and the outside view then
  preserves orientation.
- Apply it in the shader inverse, `pickSphere`, `sphereProj`, the graticule and the globe marks, and change the cap
  formulas of panels §9.3 to match (B = C_x − iC_y). Re-run `cap_check.js` with the new lift.
- Add a CDP check: a Tiles glyph on the globe at z = 0.5 has the same handedness as in the plane.
- Before building, confirm with one screenshot of the Tiles pattern on today's globe after the gate.

### B3. The figure prototype is not yet article-grade (morph-figure §4–5)

Everything here was seen on the rasterised `morph-*.svg`.

1. **A label collides with ink.**
   - In Cayley, the label *F(z)* sits on the arrow of the neighbouring path (z = 1.5 → F(1.5) ≈ 0.38 − 0.92i). The
     white casing cuts that arrow, and it is unclear which arrowhead the label names.
   - In z², the label *z* sits on X's dashed boundary arc.
   - The doc's placement rule was never run: the prototype "picks this path by hand", and the hand-picked placements
     still collide.

   **Fix.** Place labels automatically and test each label box against every ink layer: paths, arrowheads, start dots,
   region edges, X's outline and the frame. Put the *z* label on the outer side of the boundary, normal to it, not
   "behind the start direction" (for a boundary sample, that lands on the boundary). If no position is clear, omit
   both labels; the caption already says "from z (dot) to F(z)".
2. **Arrowheads land on other paths' start dots.** The sample set is chosen at nice coordinates, and nice maps send
   nice points to nice points.
   - Cayley has order 3 and permutes −1 → i → 0 → −1, so the centre of the figure is a closed triangle of arrows in
     which every head lands on a start dot.
   - exp sends iπ → −1 and 0 → 1, which are both start dots. The real-axis chain −1 → e⁻¹, 0 → 1, 1 → e also runs
     along the axis and along F(X)'s edge, so only the arrowheads are visible.

   **Fix.** Prune a path when its end lies within 6 px of another kept path's start (keep the one with more clearance).
   Prune a path whose whole trace lies within 1.5 px of an axis or of a region edge, unless no other path is left.
3. **An arc crosses the frame.** In Cayley, the path from z = −2 peaks above Im = 2.25 and is drawn over the top frame
   and its ticks. The "> 20 % outside" rule lets it through.

   **Fix.** Keep a path only if it lies entirely inside the panel with a 3 px inner margin, or refit the window to the
   kept paths. Clip as well, as §6 already says.
4. **There are too many paths for a single column.**
   - 13 paths at 3.4 in (Cayley) gives a sheaf of four near-parallel arrows converging at the bottom of the disc.
   - In exp, five paths from the left side and the top all cross in one bundle.

   **Fix.** Use a budget of about 2.5 paths per inch of panel width (8 at 3.4 in, 16 at 7 in). Select greedily by
   clearance, penalising crossings: skip a candidate that crosses two kept paths.
5. **The caption must be true and typeset well.**
   - **False claim (z²).** "boundary points **and grid nodes**" is false for z²: there are no grid nodes. By §4's own
     rule (h = 0.5), the node 1 + i is 0.086 from the arc, under 0.4h. The prototype captions are hand-written, so
     the §5 template was never exercised. Generate the clause from the kept set.
   - **Arcs and segments (Cayley).** "each is an arc of a circle" is false for two paths: z = 1 → −i and z = 2 + i →
     (1 − i)/2 lie on the line y = x − 1, the perpendicular bisector of the fixed points, so they are segments. Write
     "arcs of circles or segments".
   - **Branch of F^t.** F^t for an elliptic map needs a branch. Say "rotating by 2π/3 about the fixed point
     ½(√3 − 1)(−1 + i)", or whichever branch `mobPath` takes.
   - **"Natural homotopy".** "the natural homotopy" is app vocabulary. Give the formula only: "the homotopy
     H_t(z) = z^{1+t} (principal branch)".
   - **App jargon.** "this is guaranteed by the chain" is meaningless in a paper. Leave the guarantees out of figure
     captions, or state them mathematically ("F is conformal and injective on X").
   - **Typesetting.**
     - Inline `\frac` in the caption (the Cayley map; e^{tz} in exp) opens up the line spacing. Use (z − i)/(z + i)
       or `\tfrac`.
     - The Cayley caption breaks lines after "F(z) =" and after "H_t =". Forbid breaks inside formulas
       (`\relpenalty=10000`, `\binoppenalty=10000`) and set captions ragged-right at this width.
6. **The checkerboard moirés at the image of ∞.** At w = 1 in Cayley, the cells shrink below a pixel and alias into a
   radial moiré that reads as a rendering bug. **Fix:** fade the carried pattern to its mean colour where a cell is
   smaller than about 2 device px (the same idea as the Tiles glyph's smoothstep), on screen and in the export.
7. **X and F(X) differ only in lightness.**
   - X is drawn as a 30 % tint of the same blue as F(X). In Cayley it fills half the panel, close to the light
     checker cells, so "(light)" and "(checkerboard)" are distinguished only by lightness, and poorly in greyscale.
   - **Fix:** in the deformation figure, tint X with a neutral (ink at about 7 %, or a 0.4 px hatch) and keep colour
     for the image.
   - On screen, keep the ghost at about 15 %, or outline-only when X is unbounded, so that the right pane does not
     look like X (item 1).
8. **The halfway boundary reads as a stray line.** In exp it is a vertical segment at Re = −1.5 with no visible
   meaning. In Cayley it is a circle through the central knot. At 0.5 px in the region's edge colour, it reads as an
   artifact. **Fix:** make it off by default (an option "Halfway boundary"). When on, draw it dotted in ink and say so
   in the caption.

---

## 2. Panels: further fixes

| # | Issue | Fix |
|---|---|---|
| P1 | **The radio group and the toggle share one well.** Two raised thumbs in one segmented control read as multi-select or as a bug, and users will expect Phase to deselect Plane. | Make Phase a separate `icon-btn[aria-pressed]` with a 6px gap and its own outline. The surface radios keep the sliding thumb. |
| P2 | **"Phase" means three things.** It is the pane toggle, the style "Phase" (phase only) and the pattern swatch "Phase" (arg of the source point). "Plane" is both a surface radio and the Sphere strip's checkbox. "Grid" is a tool, a pattern, a style and a checkbox. | Keep the toggle "Phase". Rename the style "Phase" to **Plain** and the pattern swatch to **Arg z**. Rename the Sphere checkbox to **Equator** (tooltip: "equatorial plane and projection ray"). |
| P3 | **Snap and Unit circle become unreachable.** Moving them to the Draw heading loses them when the left drawer is collapsed: the rail (`#railTools`) shows tools only. On mobile, the sidebar sits below the chain, far from the plane being drawn on. | Put Snap in the Draw heading **and** in the rail. Move Unit circle to **Display**: it is a display setting for both planes. |
| P4 | **The focus can jump under the press.** At focus k ≥ 2, X is the w_{k−1}-plane. With Y drawable (`targetsEditable()` true), `setTool` no longer resets the focus, and §1's "pressing in X returns the focus to the whole chain" changes the meaning of the pressed point mid-gesture. | At leftStage() > 0, drawing tools show a `not-allowed` cursor over X and the Whole chain button pulses. Nothing jumps. Y stays drawable. |
| P5 | **Descriptions become unreachable on touch.** Tooltips are skipped for touch (`pointerover` returns on `pointerType === 'touch'`, app.js ≈ 7871). Items 3 and 6 move every tool, pattern and view description into tooltips. | Show the same tip on a 450 ms long-press for `.tool`, `.pat` and the view control (cancelled by movement). |
| P6 | **The globe cannot be turned on touch while a tool is active.** §9.5 turns it with the middle button or Space only. | Turn with a two-finger drag on touch, in every tool. |
| P7 | **Disc and Annulus build differently on the globe.** Disc is built about the spherical centre, Annulus, Sector and Polar grid about the planar centre. The same press, at the same point, gives visibly non-concentric results. | Disable Annulus, Sector and Polar grid on globes (tooltip: "Draw in Plane"). It is honest and keeps "you draw what you see". |
| P8 | **The polar snap net gives irrational coordinates.** For Cartesian kinds (Rectangle, Grid, Segment, Polygon, Half-plane by points) on a globe, corners land at values such as √2 + √2i, so the shape list loses its short numbers. | Snap Cartesian kinds to the lifted Cartesian lattice (the plane's snap) and round kinds (Disc, Circle, cap rims) to the polar net. |
| P9 | **Mockup 3 adds hint text back.** The readout ("disc Im z > 1.50") and a sentence chip ("Disc on the sphere · rim through ∞ → …") say the same thing. The Y hint "Drag to turn" is also false while a drawing tool is active. | Keep the readout only, with the kind tag. Make the idle hint follow the tool, as `idleRight` does today. The polygon chip is acceptable because it is transient. |
| P10 | **Landscape + Phase can have an unsupported style.** If the shared style is Contours, Modulus or Grid when X switches to Landscape with Phase on, nothing defines what is painted. | Paint Tiles and show the chosen style as unavailable ("On the landscape: Tiles or Phase"). Do not change `S.dc`, so returning to Plane restores it. |
| P11 | **Digit keys change meaning.** Today 1–4 are Image, Phase, Landscape and Sphere on the right pane. Under the new scheme, 2 means Sphere and 4 toggles Phase, both on X. | Accept, because the new meaning is coherent, but list the change in the help guide. With B1, Y needs only ⇧1 and ⇧2. |
| P12 | **The empty notes still differ.** Item 5 is half done: the in-plane chip "Draw any shape with the tools on the left." stays next to the sidebar's "No shapes yet. Draw one in the *z*-plane.", which is two wordings for one state. "On the left" is also false on mobile. | Make the plane chip "No shapes yet." (it sits in the z-plane). Keep the Y chip "Add a function to map the region". |
| P13 | **Targets change plane with the focus.** At focus k the target heading becomes "w_k-plane" while the stored target is unchanged. The same set is then claimed to lie in w and in w₂. This is today's semantics ("a set in Y of the focused map"). | Keep the semantics, which fit U1, but display target formulas in the current Y variable (\|w₂ + …\| < 0.22) so the list states what is shaded. |
| P14 | **"No edits to tests" is optimistic.** After migration, perf `modeUnit` `color.panR` pans the image pane, not the portrait, so its baseline is meaningless. The quality suite is fine: it has image scenes only. | Retarget and re-baseline `color.pan*` along with `3d.orbit` and the sphere-colour units. |
| P15 | **Clear is ambiguous.** "Clear" in the Shapes heading now sits over both groups. | Clear removes both, with undo. A per-group clear stays in the row menus. |

Item-1 check, state by state. Every X picture is on the left and every Y picture on the right in all the states I
traced: focus 0, focus k, a d/dz focus, targets, both globes, Landscape, and Phase. There is one deliberate
exception: while the deformation is open, the right pane shows X's ghost and the start dots (H₀ = id). The user asked
for X and Y together in that picture. **State it in U1** as the one exception, so that implementers do not "fix" it.

---

## 3. Morph figure: further fixes

| # | Issue | Fix |
|---|---|---|
| M1 | **d/dz steps.** The "deformation" from G_{k−1}(z) to G_{k−1}′(z) is a straight line between a function and its derivative: it is not a motion of points. The caption template would call it (1 − t)z + tF(z), which is false. | When the range includes a d/dz step, draw no paths over that step and disable the deformation export ("d/dz has no deformation"). The screen keeps today's straight-line cross-fade. |
| M2 | **A focused step needs a different caption.** The template knows only "[Shapes]" and F, but at focus k the light set is G_{k−1}(S) and the map is f_k. | Name the stage: "The image of the disc after f₁ (light) and its image under f₂(w₁) = …". |
| M3 | **Non-injective maps.** z and −z both reach z², so two arrowheads meet at one point. The near-duplicate rule (start **and** end both within 6 px) does not catch this. | Keep both paths, because two arrows meeting shows non-injectivity, but stop both heads 1.5 px short so both are visible. Add the caption clause "Arrows that meet show points with the same image." |
| M4 | **"Both" export.** It gives (a) X and (b) the deformation (which contains X again), joined by the arrow labelled F. The arrow mislabels a panel that shows H_t. | With the deformation, export one panel by default. In "Both", drop the arrow and caption (b) "the deformation H_t, 0 ≤ t ≤ 1". |
| M5 | **Arrows pop while panning X.** For unbounded X, samples come from the left window, and the cache is keyed by the left view. | Sample bounded shapes from the shape itself, independent of the view. For unbounded ones, re-sample only at settle. |
| M6 | **Tiny start dots.** At r = 1.15 px (0.86 pt) the start dots vanish against the checker at 100 %. | Use r = 1.4 px with a white ring of 2.1 px. |

Endorsed as designed:
- The single-plane decision and the §2 argument against chords.
- Neutral ink for the paths, thin casings, stealth heads, and Re/Im axis titles without a variable.
- The whole deformation (t from 0 to 1) in the export.
- The one new control on screen ("Paths").
- Rails plus the travelled part on screen. The z² screen mockup is clear.

---

## 4. Edge cases checked

| Case | Result |
|---|---|
| Non-invertible chain | Panels: fine (targets pull back, the Y globe is exact through the enumerator). Figure: see M3. |
| d/dz step in focus | Panels: X is the z-plane and editable, Y is w_k. Make the title "domain of w₂(z)", not "of w₂". Figure: M1. |
| Unbounded shapes | Panels: needs the P3 stage-0 globe inverse (11.1); without it, the hole at N appears exactly where item 8 draws. Figure: B3.3 and M5. |
| Empty chain | Y = X, and the chip "Add a function to map the region" stays. |
| Focus k ≥ 2 and drawing | P4. |
| Mobile (panes stacked, X on top) | Head order is fine at 343 px: X has 4 icons, Y has 2 after B1. P3 (Snap location), P5 (long-press tips), P6 (two-finger turn). |
| Two globes at once | The cost guard halves the budget (11.9). The "cheaper than the forward mesh" claim for the stage-0 globe inverse is unmeasured. Add a perf unit `sphere.globeL0.orbit`. |

---

## 5. Scheduling: what would speed things up

The panels design adds globe editing, Phase on both panes, targets on the w-globe and view-model export to P3, which
was already the largest renderer phase. That turns one gate into a much longer one. Split it:

1. **U-a, right after the P2 gate (app.js only, about an hour).** Items 3–6: delete `#toolHint`, the formula chips and
   `#patDesc`; add the one Add button with its plane tag, the two empty notes and long-press tips (P5). No renderer
   work and no perf impact.
2. **U-b (app.js).** The view model U1–U8 with B1 applied. It reuses existing passes: the portrait and the landscape
   are drawn in pane L with pane L's view. Includes migration and the perf re-baseline (P14).
3. **P3 as specced, plus B2** (the lift convention, which must land with the exact globe).
4. **P3b, after P3: item 8, globe editing** (§9 with P7 and P8). It needs P3's stage-0 globe inverse.
5. **Item 2** at any time after U-b (app.js and funcs.js only), with the B3 fixes.

---

## 6. Answers to the designers' open questions

- **Y Phase:** no (B1). The key stays a legend chip on X.
- **One Add button:** yes. The formula's variable chooses the plane, the tag shows the choice, and a formula using
  both z and w is an error ("use z or w").
- **Snap and Unit circle:** Snap goes to the Draw heading and the rail, Unit circle to Display (P3).
- **Disc and Circle as caps on the globe:** yes. That is what round means there. Disable the planar-centred tools on
  globes (P7).
- **Grid-node paths:** at most 2, and only when they add no crossing (B3.4).
- **The boundary at t = ½:** off by default (B3.8).
- **A snapshot at the current t:** yes, as an export option, with "0 ≤ t ≤ T" in the caption. The default stays the
  whole deformation.

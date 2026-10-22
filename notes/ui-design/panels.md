# Panels: X on the left, Y on the right

UI design for backlog items 1, 8 and 3–6 (`notes/UI_BACKLOG.md`), integrated with renderer phase P3
(`notes/sphere-design/SPEC.md` 4.6, 6.3, 10.3, 10.6, 10.9, 11). Nothing in `src/` was edited.

**Revision 2 (2026-10-20), after `review.md`.** Blocking fixes: B1 (Y has no Phase), B2 (the globe lift is conjugated
so globes are not mirror images; section 9.0). Further fixes P1–P15 are folded into the sections below and marked
with their number. The work is split into five smaller phases so that no gate gets longer (section 11).

Mockups:
`mockup-1-planes.html` (default state, the full header set, the sidebar), `mockup-2-phase.html` (Phase on X, images on
Y), `mockup-3-globe.html` (drawing on both globes). They are self-contained pages that include the app's own stylesheet
from `src/page.html` (tokens and components, light and dark; a button in the top bar switches). The pictures in them
are exact per-pixel renders of the Cayley map F(z) = (z − i)/(z + i), not sketches: the left plane at z, the right
plane through z = F⁻¹(w), the globes by stereographic projection, Phase with the app's Tiles formula. The readout
numbers are computed values. The generator is `mockup-src/` (`python3 notes/ui-design/mockup-src/build_mockups.py
<project root>`). As instructed, no headless browser was run: the scripts were syntax-checked and the renderer was
smoke-run in node on stub canvases, but the pages have not been looked at in a browser.

The user's rule (item 1): every picture that lives on X is in the left panel and every picture that lives on Y is in
the right panel, so the left panel always shows the original shapes and the right panel always shows their images.
Controls must be simple and the same on both panels.

---

## 0. Decisions

**U1. X and Y are the domain and codomain of the function in focus.** With the whole chain in focus, X is the
*z*-plane and Y the *w*-plane of F. With step k in focus, X is the *w*ₖ₋₁-plane and Y the *w*ₖ-plane of fₖ (a focused
d/dz step: X is the *z*-plane, Y the *w*ₖ-plane). The panels never swap roles: the left pane is always X, the right
pane is always Y. **The one sanctioned exception** is the deformation (item 2): while it is open, the right pane
shows X's outline and the start dots as well, because the paths H_t(z) start in X and end in Y and can only be drawn
in one plane. The user asked for X and Y together in that picture; implementers should not "fix" it.

**U2. A view is a surface, plus a paint on X. Both panels use the same surface control.**
- **Surface** (a segmented control): **Plane · Sphere · Landscape** on X; **Plane · Sphere** on Y.
- **Paint** (X only, a separate toggle 6px to the right of the surface control, P1): **Phase**, off or on. Off, the
  surface carries the shapes, filled with the pattern. On, it carries the phase portrait of F (arg F, |F| in the
  current style) and the shapes are drawn as outlines.
- **Y has neither Landscape nor Phase (B1).** Both would be plots of the identity over the *w*-plane: a cone for
  every F, a colour wheel for every F. They are the only views that would not change when the chain changes. The
  colour key of the portrait is the X legend chip (wheel and modulus strip); for the Grid style the Y plane's own
  background grid is the key.
- "Uniform" means: the same control, in the same place, in the same order, with the same keys, and items absent where
  they do not apply (the user's "where it applies"). Every one of today's views is one of these combinations
  (table in 2).
- **Names (P2).** "Phase" names only the pane toggle. The style formerly called Phase is **Plain**; the pattern
  swatch formerly called Phase is **Arg z**; the Sphere's "Plane" checkbox is **Equator** (tooltip "equatorial plane
  and projection ray"). "Grid" stays the name of a tool, a pattern and a style, each in its own section.

**U3. Today's right-pane views move by meaning.** Phase, Landscape and the phase sphere are plots over X, so they
become X views (Plane + Phase, Landscape, Sphere + Phase). Image becomes Y Plane; the regions sphere becomes Y Sphere;
the left-sphere toggle becomes X Sphere. Nothing is lost and nothing is duplicated.

**U4. One head layout for both panes:** `[surface] [Phase]  title  role  …  [pane actions]  LED` (Y has no
Phase button). The switcher comes first, so it never moves when the title changes with the focus. Snap leaves the
left head for the Draw heading and the collapsed rail (it applies to drawing in both panes); Unit circle moves to
Display (P3).

**U5. Shapes are drawn in X, targets in Y, in any Plane or Sphere view.** You draw where you press: in the left pane
the tools add shapes, in the right pane they add targets (today only Image could take targets). Landscape takes no
drawing. The sidebar lists both, under "z-plane" and "w-plane" headings with matching empty states (item 5). Drawing
on the globes (item 8) is its own phase, P3b, after P3 (section 11).

**U6. The globe is a picture of the same plane.** Drawing on a globe creates the same stored shapes as drawing in the
plane (planar parameters, the same kinds), so the inverse renderer, the shape list and the saved state need no new
kind. Two tools are built natively on the sphere because round things must look round there: Circle and Disc are
caps. A cap through ∞ is stored as a line or a half-plane, and a cap around ∞ as the complement of a disc (section 9).

**U7. Descriptions live in tooltips.** The tool hint line (item 3, all tools, not only Select), the formula example
chips (item 4) and the pattern description line (item 6) are removed. Each tool's and pattern's description becomes
the tooltip text. On touch, where tooltips are skipped today (app.js ≈ 7871), the same tip shows on a 450 ms
long-press of a `.tool`, a `.pat` or a view button, cancelled by movement (P5). The one gesture that needs a word
while it is in progress (closing a polygon) gets a transient chip during the draft only.

**U8. Keys: digits choose the view, Shift picks the right pane.** 1 Plane, 2 Sphere, 3 Landscape, 4 Phase on/off for
X; ⇧1, ⇧2 for Y (by `e.code`, so it works on any layout). The digit means the same surface on both panes. This changes
what 2–4 mean today (Phase, Landscape, Sphere on the right); the help guide lists the change (P11).

---

## 1. What each panel is, at each focus

| focus | X (left pane) | Y (right pane) | shapes on X | shapes on Y |
|---|---|---|---|---|
| whole chain | *z*-plane | *w*-plane, *w* = F(*z*) | the shapes (editable) | their images F(S) |
| step k, not d/dz | *w*ₖ₋₁-plane | *w*ₖ-plane, *w*ₖ = fₖ(*w*ₖ₋₁) | stage images G_{k−1}(S) | G_k(S) |
| step k, d/dz | *z*-plane | *w*ₖ-plane, *w*ₖ = d*w*ₖ₋₁/d*z* | the shapes | G_k(S) |

- "The left panel always shows the original shapes" holds relative to the function in focus: X shows what enters
  fₖ, Y what leaves it. At focus k ≥ 2 the shapes on X are stage images and are not editable there (as today).
- **Drawing at focus k ≥ 2 (P4).** With Y drawable, picking a tool no longer resets the focus, and resetting it on
  the press would change what the pressed point means mid-gesture. So, while `leftStage() > 0`, drawing tools show a
  `not-allowed` cursor over X and the Whole chain button pulses once. Nothing jumps. Y stays drawable.
- Targets are in Y at every focus; their preimages under the focused map are shaded on X in every X view. The
  target list shows each formula in the current Y variable (|*w*₂ + …| < 0.22 at focus 2), so the list states what is
  shaded (P13; the stored target is unchanged, as today).
- `leftStage()` and `rightStage()` keep their meaning; P3's role L (flat and globe) is exactly the X pane at
  `leftStage() > 0`.

---

## 2. The view table

State per pane: `surf` ∈ {plane, sphere, land} (land only on X), `phase` boolean (X only), `eq` boolean (the
Sphere's equatorial plane and projection ray: the "Equator" checkbox, today's "Plane").

| pane | surface | Phase | shows | title · role (focus 0) | today |
|---|---|---|---|---|---|
| X | Plane | off | shapes, filled; target preimages shaded | *z*-plane · domain of *F* | left plane |
| X | Plane | on | phase portrait of F; shapes outlined | *z*-plane · phase of *F* | right Phase |
| X | Sphere | off | shapes on the *z*-globe; target preimages | *z*-sphere · domain of *F* | left-sphere toggle |
| X | Sphere | on | phase portrait of F on the *z*-globe; outlines | *z*-sphere · phase of *F* | right Sphere › Phase |
| X | Landscape | off | relief of the height; plaster; outlines on the floor | *z*-plane · landscape of log\|*F*\| | right Landscape › Plaster |
| X | Landscape | on | relief coloured by the phase style | *z*-plane · landscape of log\|*F*\| | right Landscape › Phase / Tiles |
| Y | Plane | — | images of the shapes; targets, editable | *w* = *F*(*z*) · image | right Image |
| Y | Sphere | — | images on the *w*-globe; targets, editable | *w*-sphere · image | right Sphere › Regions |

Titles with step k focused: X "*w*₁-plane · domain of *f*₂", Y "*w*₂ = *f*₂(*w*₁) · image"; with a d/dz step: Y
"*w*₂ = d*w*₁/d*z*". The Cauchy style: X role "Cauchy integral over C₁" (X only; Y has no style control). Height words follow `S.height`
(log|F|, |F|, Re F, Im F). With the deformation playing, roles end in ", deforming" as today. With a d/dz step in
focus, X's role reads "domain of *w*₂(*z*)", not "of *w*₂".

**Readouts** (top-left chip, unchanged component): X Plane and Sphere `z … |z| … arg …`; X Phase adds
`F … ∠ …` and a 10px swatch; Y Plane `w … F′ …` as today. Idle hints follow the tool, as `idleRight` does today:
"Drag to turn; ∞ is at the north pole" only with Select; with a drawing tool, the tool's gesture (P9).

**Legend chip** (top-right): on X when Phase is on (wheel and modulus strip, today's Phase legend, captioned arg *F*);
on Y Plane (today's Image legend: pattern cell in *z*, cut and pole samples).

**Why Y has neither Phase nor Landscape (B1).** Revision 1 gave Y a Phase view as "the colour key". It was the same
colour wheel for every F, showed the shared style and Outlines controls twice, left Y's style radios with nothing
selected under Cauchy, and cost a render pass and a key, all for symmetry. If the user wants the key in the *w*-plane,
the fallback is a small "Key" toggle inside the X legend chip that paints Y; it is not a view of Y.

---

## 3. The pane head

```
X  ┌────────────────────────────────────────────────────────────────────┐
   │ [▦ Plane│◍ Sphere│⛰ Landscape] [◔ Phase]  z-plane  domain of F    ● │  32px
Y  ┌────────────────────────────────────────────────────────────────────┐
   │ [▦ Plane│◍ Sphere]  w = F(z)  image, after 2 steps              ⤳  ● │
```

- **The surface control** is the `.seg` well (28px tall, `--well`, 1px `--line`, `--r-2`) with the sliding thumb
  (`.seg.modes`, role `radiogroup`, label "Left pane surface" / "Right pane surface").
- **The Phase toggle (X only, P1)** is a separate `button[aria-pressed]`, 6px to the right, with its own 1px
  `--line-strong` outline; pressed, it fills with `--accent`. It never shares the well with the radios, so two raised
  thumbs never read as a multi-select. Labels in `--t-label`; the icons are today's `MODE_ICONS` (image → Plane,
  sphere, 3d → Landscape, color → Phase).
- **Below 520px of pane width** (the existing `@container pane (max-width: 519px)` rule) the labels hide and the
  buttons are 14px icons with 7px padding, as the right modes are today. At about 430px (both panes at 1440px) the X
  head is 4 icons (≈ 126px), the title and the LED, the Y head 2 icons; nothing scrolls.
- **Tooltips** (`data-tip`): "Plane  1", "Sphere  2", "Landscape  3", "Phase colouring of F  4" on X; "Plane  ⇧1",
  "Sphere  ⇧2" on Y. Long-press shows them on touch (P5).
- **Title** after the control, left-aligned, 8px gap: the plane name in `--t-math`, then the role in `--t-body`
  `--muted` (section 2). It shrinks first (`flex-shrink: 1000`): the role goes, then the title (today's
  `fitRightTitle`, applied to both panes).
- **Pane actions** at the right, before the LED: Y keeps the deformation button (⤳, `M`). X has none. The X head's
  Snap toggle moves to the Draw heading and the rail; Unit circle moves to Display (section 5). The `leftSphereBtn`
  is removed.
- **LEDs** unchanged.

---

## 4. Options strips (both panes)

Both panes get today's floating options strip (`.options`, bottom-left, overflow into the sliders popover). Its
content is the union of what the surface and the paint need, in this order:

| part | controls |
|---|---|
| X, Phase on | Style [Tiles · Plain · Modulus · Contours · Grid · Cauchy], *n* (8/12/16/24), Δ (Grid only), "Outlines" |
| Plane, Phase off | Y: "View outline" (the X view's outline mapped to Y). X: nothing (the strip hides) |
| Sphere | "Equator" (equatorial plane and projection ray), Reset camera |
| Landscape | Height [log\|F\| · \|F\| · Re F · Im F], All sheets (and sheets ±), Scale, Unit level, View [3/4 · Top · Front], Reset camera |

- The style, *n*, Δ and Outlines controls exist only in the X strip (B1): one setting (`S.dc`), shown once.
- **Landscape with Phase on (P10).** The relief paints Tiles and Plain (what the landscape shader paints today). If
  the setting is Modulus, Contours, Grid or Cauchy, the relief paints Tiles and those buttons show as unavailable
  ("On the landscape: Tiles or Plain"); `S.dc` is not changed, so returning to Plane restores the chosen style. Phase
  off is Plaster. The Landscape "Material" control is removed: Material = Phase toggle + style.
- The Sphere "Regions | Phase" control is removed (it is the Phase toggle on X; Y has no phase).
- "Region outline" is renamed "Outlines" (shape outlines over the X portrait).
- The deformation transport (6.11) still replaces the Y strip while open (section 7).

---

## 5. Sidebar: Draw, Formula, Shapes, Display (items 3–6)

```
Draw                                          [⌒ snap][‹]
[Select][Point][Segment][Line] …                     (no hint line)
Region from a formula
[ |z − 1| < 2               ][Add]
  |z−1|<2                                  z-plane    (preview; the tag names where Add puts it)
Shapes                                          Clear (both groups, undoable)
z-plane ───────────────────────────
  ▣ Disc 1    |z−0.6−1.2i| < 0.7          👁 ⋯
w-plane ───────────────────────────
  No targets yet. Draw one in the w-plane.
Display
  [pattern swatches, tooltips only; "Arg z" replaces "Phase"]
  Cell · Unit circle · Grid lines · Chevrons · Opacity · Mesh quality
```

- **Item 3.** `#toolHint` is deleted for every tool, not only Select. Each tool's description (the 4th column of
  `TOOLS`) goes into its tooltip: "Disc  D · Drag from the centre outward." On a globe the Circle and Disc tooltips
  add "On the sphere: a cap; through ∞ it becomes a line or half-plane." While a polygon draft is open, a level-2 chip
  at the top centre of the pane (the `.empty-chip` style) says "Click the first vertex or press Enter to close" and
  disappears with the draft. The sphere-specific hint texts ("Drawing is off while…") go away with item 8.
- **Item 4.** `#formulaChips` and `FORMULA_CHIPS` are deleted; the placeholder keeps one example. The two buttons
  Add / Target become one **Add**: the variable decides, a set in *z* goes to the *z*-plane as a shape, a set in *w*
  to the *w*-plane as a target (Enter already does this through `inW`). The preview row ends with a `.btag` naming the
  plane, so the choice is visible before Add. A set in neither variable goes to the *z*-plane.
- **Item 5.** The Shapes section has two sub-headings in the existing `.shapes-sub` style, "*z*-plane" and
  "*w*-plane" (*w*ₖ-plane with step k focused), always both shown, each followed by its rows or by an empty note of
  the same form:
  - "No shapes yet. Draw one in the *z*-plane."
  - "No targets yet. Draw one in the *w*-plane."

  Target rows keep their names ("Target disc 1", point targets p, q, …). The in-plane empty chip on X becomes
  "No shapes yet." (it sits in the *z*-plane, and "on the left" is false on mobile; P12). The Y chip "Add a function
  to map the region" stays.
- **Clear (P15)** in the Shapes heading removes shapes and targets, with undo. Clearing one group stays in each row
  menu ("Clear shapes" / "Clear targets").
- **Item 6.** `#patDesc` is deleted; the descriptions are already the swatches' `data-tip`. The Sphere checker
  (pattern 8, P3) joins the grid with its tooltip "Longitude and latitude cells of the Riemann sphere: 128 cells cover
  the plane and ∞".
- **Snap (P3)** is a 24px icon toggle in the Draw heading, before the collapse chevron, **and** the last button of
  the collapsed rail (`#railTools`), so it stays reachable when the drawer is collapsed and on mobile. Snap applies to
  drawing in both panes and on globes (9.5).
- **Unit circle (P3)** is a checkbox in Display: it draws |*z*| = 1 and |*w*| = 1 on both planes (the globes always
  draw the equator).

---

## 6. Focus and stage views

Unchanged mechanics; only the words follow U1. The chain card in focus outlines as today; X's title becomes
"*w*ₖ₋₁-plane · domain of *f*ₖ", Y's "*w*ₖ = *f*ₖ(*w*ₖ₋₁) · image". Each pane keeps its own surface and paint
across focus changes (focusing a step does not switch views). X Sphere at k ≥ 2 is P3's left globe at
`leftStage() > 0` (exact, role L, globe). X Phase at k shows the phase of *f*ₖ over the *w*ₖ₋₁-plane (today's
`focusMap`).

---

## 7. The deformation transport (interface for item 2)

Item 2 (the unified deformation figure) is designed separately in `morph-figure.md` (same folder): the deformation
is drawn in the right panel, in Y's coordinates, with the paths t ↦ H_t(z), and the left panel stays X, unchanged.
This is U1's one sanctioned exception: X's outline and the start dots appear on the right while it is open.
This design agrees and fixes only where the transport sits. The button stays in the Y head (`M`), the transport strip replaces the Y options strip, and while it is open both panes
follow *t*: Y Plane/Sphere draw H_t(S) (today's `renderMorph`, `homView().imageMap`), X Phase and Landscape paint H_t
(today's `homView().map`), X Plane and X Sphere keep the original shapes. Targets are not editable while it is open
(as today).

---

## 8. Keyboard and command palette

| key | action |
|---|---|
| 1 / 2 / 3 | X: Plane / Sphere / Landscape |
| 4 | X: Phase on/off |
| ⇧1 / ⇧2 | Y: Plane / Sphere (⇧3, ⇧4 do nothing) |
| M, Z, [, ], tool letters | unchanged |

Read with `e.code` (`Digit1`…`Digit4`) and `e.shiftKey`, so ⇧1 is not "!" on a US layout and works on AZERTY. Arrow
keys move within a focused switcher as today. Palette commands: "Left: Plane", "Left: Sphere", "Left: Landscape",
"Left: Phase colouring", "Right: Plane", "Right: Sphere", with aliases from today's
`MODE_ALIAS` (image, domain colouring, phase portrait, 3d, riemann, globe) pointing at the new commands. The help
guide gets one line: "1–4 now act on the left pane; Shift for the right pane" (P11).

---

## 9. Drawing on the globes (item 8, phase P3b)

### 9.0 The lift convention (B2, lands with P3)

The app lifts with P(*z*) = (2*x*, 2*y*, |*z*|² − 1)/(|*z*|² + 1) and views the sphere from outside through a
right-handed `lookAt` (gl.js:3443, `pickSphere`, the inverse at gl.js:1625). Seen from outside, that lift reverses
orientation: every globe today is a mirror image of its plane. Checked in `mockup-src/cap_check.js`: over random
camera directions and front-facing points, the screen Jacobian of *z* ↦ screen has det < 0 at 951 of 951 points with
today's lift, and det > 0 at all of them with the conjugate lift. On a globe a Half-plane fills the screen-right side
of its arrow, sectors and arcs sweep clockwise, chevrons point backwards and the Tiles F is mirrored, so an exported
globe would suggest an orientation-reversing map.

**Convention: the conjugate lift** P(*z*) = (2*x*, −2*y*, |*z*|² − 1)/(|*z*|² + 1), inverse
*w* = (P_x − iP_y)/(1 − P_z). ∞ stays at the north pole and 0 at the south pole. It is used everywhere a point meets
the sphere: the shader inverse, `pickSphere`/`pickGlobe`, `sphereProj`, the graticule, the globe marks and the cap
formulas of 9.3. It lands in P3 together with the exact globe (one convention, one change), with a CDP check: a Tiles
glyph on the globe at *z* = 0.5 has the same handedness as in the plane. Before building, take one screenshot of the
Tiles pattern on today's globe after the gate to confirm the mirror. The mockups already use the conjugate lift.

**The equatorial plane keeps a mirror (P3 review, stated, not changed).** The globes keep orientation, but the
equatorial plane (the Equator toggle) cannot do so from both sides. The projection ray runs from N through the sphere
point P(*z*) to the plane point (*x*, −*y*, 0), so the disc carries *z* = *x* − i*y*_world. Seen from **below** (the
side the stereographic projection is taken from, with the outside of the globe orientation-correct) it reads as the
plane; seen from **above**, which is the default camera of Y Sphere (pitch +18°), it reads as the plane's mirror image.
Only the probe's plane point and its ray land on the disc (its axes and rings are symmetric), so the visible effect is
that a probe at 1 + i meets the disc where 1 − i would sit in an upright plane seen from above. Projecting from N with
the globe's outside correct forces this; it is a property of the construction, not a defect to remove. A later option
(not built): label the disc's +Re and +i directions, or fade the probe's plane point while the camera is above the
equator.

### 9.1 Principle

A globe is the plane it belongs to, seen on the Riemann sphere. Every tool except Annulus, Sector and Polar grid
(9.2) works on both globes (X: shapes, Y: targets) and stores what it would store in the plane. The only differences are where a construction would look wrong
on the sphere: Circle and Disc build caps (9.3). There is no globe-only kind. Landscape takes no drawing (cursor
`not-allowed`, readout hint "Draw in Plane or Sphere").

### 9.2 Tools on the globe

| tool | gesture on the globe | stored as |
|---|---|---|
| Select | press a shape and drag: move (9.4); a handle: reshape; empty space: turn the globe | — |
| Point | click | point (finite; ∞ cannot hold a point, see 9.7) |
| Segment, Line, Ray, Arc, Freehand, Rectangle, Polygon, Lasso, Half-plane, Grid | the same picks as in the plane, each pick a point of the plane | the same kinds |
| Circle | press = centre on the sphere, drag = a point of the rim | circle; line when the rim passes through ∞ |
| Disc | press = centre on the sphere, drag = a point of the rim | disc; half-plane through ∞; complement of a disc around ∞ |
| Annulus, Sector, Polar grid | disabled on globes (dimmed; tooltip "Draw in Plane") | — |

Annulus, Sector and Polar grid are built around a planar centre, while Disc is built around the spherical centre, so
the same press would give visibly non-concentric results (P7). Two spherically concentric circles are coaxial, not
concentric, in the plane and have no stored kind. Disabling the three is honest and keeps "you draw what you see";
shapes of these kinds drawn in the plane still show and move on the globe. A Line on the globe is a circle through ∞,
which is what the stored line is.

### 9.3 Caps: one formula for disc, complement and half-plane

With the conjugate lift of 9.0, P(*z*) = (2*x*, −2*y*, |*z*|² − 1)/(|*z*|² + 1), 0 at the south pole and
∞ = N = (0, 0, 1). A cap is {P : P·C ≥ h}, C a unit vector, h = cos α. Substituting the lift:

(C_z − h)|*z*|² + 2(C_x *x* − C_y *y*) − (C_z + h) ≥ 0.

With B = C_x − iC_y (so that C_x *x* − C_y *y* = Re(B̄*z*)), A = C_z − h:
- A < 0 (∞ outside the cap): **disc** |*z* − c| < r with c = B/(h − C_z), r = sin α / |h − C_z|.
- A > 0 (∞ inside): the **complement** of that disc (`complement: true`).
- A = 0 (∞ on the rim): **half-plane** Re(B̄*z*) > h, stored with a = Bh/|B|², b = a − iB/|B| (region on the left of a → b; a unit direction, so the shape list writes it as Re *z* > t, Im *z* > t or Re(e^−iφ *z*) > t, as the chip does; a line likewise as its equation).

The inverse (`capOf(s)`, for handles and moves): write the region as a|*z*|² + 2Re(b̄*z*) + d > 0 (disc: a = −1,
b = c, d = r² − |c|²; complement: all negated; half-plane Re(n̄*z*) > t: a = 0, b = n, d = −2t). Then
μ = 1/√(|b|² + (a − d)²/4), C = μ(Re b, −Im b, (a − d)/2), h = −μ(a + d)/2. A circle or line is the rim of the
corresponding cap; its interior side is irrelevant.

On the globe the disc family is edited in (C, h) only. The planar (c, r) is computed for storage, so editing near ∞
never loses precision. The ∞ snap (9.5) keeps |h − C_z| ≥ about 8 px of arc away from the half-plane case, which bounds
r (r ≲ 20 sin α at a 150px globe radius).

Checked numerically with the conjugate lift (`mockup-src/cap_check.js`, re-run for revision 2): over 3000 random
caps (one in ten with ∞ exactly on the rim) and 20 random points each, membership P·C > h agrees with the stored
shape at every point (0 mismatches), and the round trip cap → shape → cap returns C and h to 7e−14.

These functions are pure and go into `src/region.js` as `capOf(s)`, `shapeOfCap(C, h, kindHint)`,
`rotateShape(s, R)`, `globeHandlesOf(s)`, `setGlobeHandle(s, key, P)` and `sphereCurvesOf(s, n)`, with node tests:
round trips disc ↔ cap ↔ complement ↔ half-plane, rim through N gives the half-plane exactly, and rotation keeps h.

### 9.4 Handles and moves on the globe

- **Handles** are drawn lifted, only on the facing hemisphere (P·V > 0), with today's handle style and halo:
  - the disc family and circles/lines: a centre handle at C and a rim handle (the rim point nearest the pointer
    when the drag began, kept as an angle about C);
  - every other kind: its planar handles (`Region.handlesOf`) lifted. A handle at a planar distance above 1e6 is not
    shown (it is at ∞ to within a pixel).
- **Move.** Point, circle/line and the disc family slide over the sphere: the rotation R about P₀ × P₁ that takes
  the press point to the pointer, applied to C (h kept; a point is rotated and re-projected). Their stored kind
  follows the geometry, so a disc slid over ∞ becomes the complement of a disc, and a line slid off ∞ becomes a circle.
  The shape list label updates; a user-set label is kept. Every other kind translates in the plane by the difference
  of the planar picks z₁ − z₀, as in the flat view.
- **Draft.** The draft is the shape at its current parameters, drawn as on the globe (fill at the draft alpha, rim in
  the shape's edge colour), with the handles, and the readout chip shows its set with a kind tag ("Im *z* > 1.5
  [half-plane]"), so the kind change through ∞ is visible as it happens. No second chip repeats it (P9).

### 9.5 Picking, hit testing and snapping

- **Pick.** `pickGlobe(pane, cam, x, y) → {P, z}` (today's `pickSphere`, also returning P; z is null at N within
  1e−9). Everything on the globe works from P first and needs z only to store planar parameters.
- **Hit testing**, in this order, all in screen space except the area test:
  1. handles of the selected shape: projected distance ≤ 8 px;
  2. curves and area rims: distance to the projected, front-facing polyline of `sphereCurvesOf(s)` ≤ 6 px (sampled
     on the sphere, so lines and rays reach N);
  3. areas: the disc family by P·C > h (exact, including at ∞); other kinds by `Region.level(s)(z) > 0` when z is
     finite. Topmost first, curves before areas, as `hitShape` does in the plane.
- **Snapping** (when Snap is on; Alt suspends it, as in the plane), the nearest within its radius wins, in this order:
  1. handles of other shapes, 8 px;
  2. the six marked points 0, ∞, 1, i, −1, −i, 10 px (∞ only for rims and centres, 9.7);
  3. **through ∞** for a Circle or Disc rim: when N is within 8 px of the projected rim, set h = C_z (stored as a
     line or half-plane);
  4. **by kind (P8).** Round kinds (Disc, Circle, cap rims and centres, Point) snap to the polar net: meridians every
     15° and parallels |*z*| ∈ {⅛, ¼, ½, 1, 2, 4, 8}, intersections 6 px, single lines 4 px. Its values print as
     short numbers in the shape list (|*z*| < 2, arg 45°). Cartesian kinds (Rectangle, Grid, Segment, Polygon,
     Half-plane by points, Line, Ray) snap to the lifted Cartesian lattice, the plane's own snap, so their corners
     stay short numbers (1 + i, not √2 + √2i). The globe's graticule draws the net of the active tool's kind (the
     polar net with Select), so a snap always lands on a visible line.
  A snapped pick shows today's snap ring at the snapped point, lifted.
- **Turning while drawing:** a drag with the middle button or Space held, or a two-finger drag on touch (P6), turns
  the globe in every tool, so a shape can run past the limb.

### 9.6 Which kinds make sense on a globe

All of them can be shown and edited. The disc family, circles/lines and points are the sphere's own objects: they
are closed under the rotations of the sphere (and under Möbius maps), and they are the ones whose globe editing is
native. The other kinds are planar by definition (a rectangle has axis-parallel sides in the plane) and are edited by
their planar points, so on the globe they look like what they are: curvilinear shapes. Formula sets have no handles,
as in the plane.

### 9.7 Infinity

∞ can be the centre of a cap (a disc around ∞ is the complement of a disc around 0) and can lie on a rim (lines,
half-planes). It cannot hold a stored point or a polygon vertex: the point tool and the vertex picks treat the 10 px
around N as off the plane (cursor `not-allowed`). Storing a point at ∞ (and its images by stage-wise limits, SPEC 8.4)
is a P6 option, not part of this design.

---

## 10. Saved state and migration

New state (in `blankState`): `view: { L: { surf: 'plane', phase: false, eq: false }, R: { surf: 'plane', eq:
false } }`, `v6: true`. Removed after migration: `rightMode`, `sphereMode`, `leftSphere`, `material`,
`spherePlane`. Kept: `dc`, `sectors`, `dcGrid`, `outline` (now "Outlines"), `height`, `sheets`, `sheetW`, `lscale`,
`unitLevel`, `fov`.

`migrateViews(o)` runs in `sanitizeState` (saved sessions, `loadExample` and the gallery's examples) and whenever a
state still carries `rightMode`:

| old | new X | new Y |
|---|---|---|
| `image`, `leftSphere` false/true | plane / sphere, phase off | plane, phase off |
| `color` | plane, phase on | plane, phase off |
| `3d` | land, phase = (`material` ≠ plaster); `material` tiles → `dc` enhanced if `dc` is not Tiles or Plain (stored as `phase`) | plane |
| `sphere` + `sphereMode` image | plane / sphere (from `leftSphere`) | sphere, `eq` = `spherePlane` |
| `sphere` + `sphereMode` color | sphere, phase on, `eq` = `spherePlane` | plane |
| (any state with a Y phase, from a revision-1 build) | unchanged | the same surface, phase dropped |
| `morph`, `preimage`, `integral` (older builds) | as `image` | as `image` |

Old views that were X plots take the X pane (the user chose them deliberately); `leftSphere` only decides X when the
old right mode was an image view. Undo history is unaffected (it holds shapes, steps and targets only).

**Compatibility for the test suites** (they set `rightMode` in hundreds of scenes; `test/` is not edited here):
`sanitizeState` keeps accepting `rightMode`, and `__cmwSet('rightMode', m)` stays as a hook that applies the table.
Three perf units change meaning and must be retargeted by the U-b owner in `test/regress/perf/run.js` `modeUnit`
(P14): `3d` orbits pane L (it orbited R), `sphere` with `sphereMode: 'color'` orbits L, and `color.panR` now pans the
image pane, not the portrait, so it becomes `color.panL` (the portrait is on L). Re-baseline `color.pan*`, `3d.orbit`
and the sphere-colour units; the image scenes and the quality suite (image scenes only) are unchanged.

---

## 11. Phases: who builds what, and when

Revision 1 put globe editing, Phase on both panes, targets on the *w*-globe and view-model export into P3, which was
already the largest renderer phase. That would have turned one gate into a much longer one. The work is now split so
that each piece is small, ships on its own, and only one of them touches the renderer gate:

| phase | when | files | content | renderer work |
|---|---|---|---|---|
| **U-a** | right after the P2 gate, about an hour | app.js, page.html | items 3–6: delete `#toolHint`, `#formulaChips`/`FORMULA_CHIPS` and `#patDesc`; one Add button with its plane tag; the two empty notes and the "No shapes yet." chip (P12); Clear for both groups (P15); long-press tips (P5); renames Plain / Arg z (P2) | none |
| **U-b** | after U-a | app.js, page.html, view.js | the view model of sections 2–4 with B1: `S.view`, `setView`, `setPhase`, the surface control in both heads and the X Phase toggle (P1), `buildFoot(side)`, titles, legends, readouts, keys (P11), palette, `migrateViews`, Snap in the rail and Unit circle in Display (P3), the P4 cursor rule, target formulas in the Y variable (P13); export takes each pane's view (`isPlanePanel(side)` = `view[side].surf === 'plane'`). It reuses today's passes: the portrait and the landscape are drawn in pane L with pane L's view. Perf re-baseline (P14). | none (existing passes, moved) |
| **P3 + B2** | as specced | gl.js, app.js | P3 as in SPEC (exact globe, role L flat and globe, Sphere checker, export), plus the conjugate lift everywhere (9.0) and the stage-0 globe inverse (X Sphere at focus 0: exact unbounded shapes, no hole at N) | as specced, plus one convention |
| **P3b** | after P3 | app.js, region.js, gl.js | item 8, globe editing: `pickGlobe`, handles, drafts, hit testing and snapping (9.5, P8), moves (9.4), the cap construction (9.3), disabled planar-centred tools (P7), two-finger turn (P6), targets on the *w*-globe (fills, outlines, point targets), graticule = snap net, `targetsEditable()` for Y Sphere | targets on the *w*-globe |
| **Item 2** | any time after U-b | app.js, funcs.js | the deformation figure (`morph-figure.md`) | none |

**Tests per phase.**
- U-a: CDP: the Add button routes a *w*-formula to targets; no `#toolHint`, `#formulaChips` or `#patDesc` in the DOM;
  long-press opens a tip.
- U-b: node: `migrateViews` over every row of the table in 10 (in `src/view.js`, no dependencies); CDP: keys 1–4,
  ⇧1, ⇧2; a saved `rightMode: 'color'` state opens with X Plane + Phase; Landscape + Phase with `S.dc = 'grid'` paints
  Tiles and keeps `S.dc` (P10).
- P3 + B2: the CDP handedness check (9.0); a perf unit `sphere.globeL0.orbit` for the stage-0 globe inverse (its
  "cheaper than the forward mesh" claim is unmeasured); quality: a half-plane on the globe at stage 0 has no hole at N
  (IoU ≥ 0.999 against `renderCPU` on the globe).
- P3b: node: the 9.3 round trips with the conjugate lift (`cap_check.js` is the reference), `sphereCurvesOf` closes at
  N; CDP: draw a Disc on the X globe across N and read back a half-plane, then a complement (via `__cmwState`); a target
  cap on the Y globe whose X preimage is exact (golden).

**Region functions (P3b, region.js):** `capOf(s)`, `shapeOfCap(C, h, kindHint)`, `rotateShape(s, R)`,
`globeHandlesOf(s)`, `setGlobeHandle(s, key, P)` and `sphereCurvesOf(s, n)` (curves sampled on the sphere; lines,
rays, half-plane edges and sector rays closed at N by sampling the parameter as t = tan(θ/2)). Curves at stage > 0 on
the globe use P4's reach (9.1).

**Cost guard:** when both panes show globes with inverse passes (X Sphere at k > 0 and Y Sphere), each pane gets half
the 8 ms budget (SPEC 10.12 already halves it for two inverse panes).

**After P3b (not needed for this design):** landscape painting in the Modulus, Contours and Grid styles; points at ∞;
P6's exact homotopy frames.

---

## 12. 60 fps

With B1 nothing here adds a render pass: U-a and U-b move existing passes between panes. P3's stage-0 globe inverse
is one level test per pixel and shape, expected to be cheaper than the forward globe mesh with fix-ups; that is
measured by the new perf unit before P3 closes. Two globes at once is the heavy case and is covered by the guard.
Globe hit testing and snapping (P3b) run on pointer events, on the CPU, against at most a few hundred projected
sample points per shape.

---

## 13. Decided in revision 2, and what is left for the user

Decided (from the review): Y offers Plane and Sphere only (B1); one Add button that reads the variable, with a formula
in both *z* and *w* an error ("use z or w"); Snap in the Draw heading and the rail, Unit circle in Display (P3); Disc
and Circle are caps on the globe and the planar-centred tools are disabled there (P7); the conjugate lift (B2).

The questions that need the user are collected in `README.md` in this folder.

# Phone layout redesign (backlog item 19, with 16–18 on the phone)

The user: "right now there are too many elements and different menus to scroll around. It should be more easy for
phones." Design only: nothing in `src/`, `dist/`, `build.py` or `test/` was changed.

- Mockup: `mockup.html` (14 screens, each in light and dark; the app's own stylesheet and tokens; every plane, inset
  and card picture is a real render of the app copy). Generator: `mockup-src/build.py` (revision 2 at its end),
  pictures: `mockup-src/cap.js` and `../rev/cmd/cap.js` (the cumulative card pictures and the side-by-side planes).
- Screenshots: `shots/before/` (v14 in progress: `work/xr` + `work/xb`), `shots/after/` (revision 2), `shots/r1/`
  (revision 1, superseded).
- Revision 2 answers every phone entry of `../review-design.json` and `../review-users.json` (ids in brackets).
- The audited chain: the Strip-to-disk example plus a Zeros-and-poles step (3 steps). The mockup uses the desktop
  designer's chain (zeros 0.5, −0.5i, pole −0.8 + 0.75i), so the two mockups show the same pictures.

## 1. Audit (390 × 844 unless named)

**The page.** The phone is one long page: 3111 px at 390 (3.7 screens), 3079 at 360, 3178 at 430. Phase, Landscape and
the deformation are shorter (2745 px) only because one plane is hidden.

| Zone | Starts at (px) | Height | Controls | Under 44 px |
|---|---|---|---|---|
| Header (sticky) | 0 | 44 | 7 | 7 |
| Two stacked planes | 44 | 724 | 15 | 15 |
| Function chain | 780 | 295 | 36 | 35 |
| Region from a formula, Shapes, Display | 1087 | 945 | 32 | 20 |
| Guarantees (Composite, 8 lamps, Natural domain, Step by step) | 2044 | 999 | 3 | 3 |
| Bottom tool bar (fixed) | — | 52 | 7 | 0 |

100 controls, 80 of them under 44 px: the view switch is three 30 × 22 icons, the deformation toggle 30 × 28, the zoom
stack 30 × 31, the card actions 24 × 24, the zero and pole buttons 52 × 22, the speed buttons 32 × 18.

**Menus and sheets a phone user meets (10).** The header ⋯ menu (9 rows); Examples (a second menu); the command
palette (85 % sheet); the Export menu (5 rows) and then the Export dialog; Sound settings (a popover); Help (the tour's
chapter menu); the tool bar's More sheet (18 tools); each plane's options popover (the sliders button); three
disclosure sections (Formula, Shapes, Display); the Guarantees disclosure.

**What is redundant, hidden or confusing.**
- The chain starts at 780 px, below the fold. Editing a step hides the planes: you cannot see X while you type a
  parameter, and only part of Y.
- The Guarantees take 999 px (a third of the page) for something the user calls unimportant.
- Display settings (pattern, opacity, mesh) are 1500 px down. The pattern changes the picture, but you cannot see the
  picture while you choose it.
- The view switch and the deformation toggle are bare icons (30 × 22). Nothing says which is Phase and which is
  Landscape.
- Export takes two menus (⋯ → Export → Export figure… → dialog).
- Sound has two entries (Sound, Sound settings) and a third button that appears in the header when it is on.
- Zeros and poles: on touch there is no way to add one at a chosen point (Shift-click only). The card's zero and pole
  buttons are 52 × 22 and add at a free spot, out of sight.
- Long-press probes, so there is no gesture left for a context menu.
- Each card repeats a lamp row (A E R P M Pr I) that duplicates the Guarantees.
- The "Region tools panel" and "Guarantees panel" toggles in the ⋯ menu do nothing useful on a phone (the panels are
  page sections there).
- At 390 and below the header mark stands alone: the name is gone, but the mark still takes 36 px.

## 2. The decision: one screen, one sheet at a time

No page scroll. Top to bottom (390 × 844):

1. **Header (56 px):** the view switch **X → Y · Phase · Landscape** (the desktop's, 44 px segments) and More (⋯)
   [design-4].
2. **The plane:** one plane, full width, 390 × 587. In X → Y **the other plane is a live inset** (116 × 116,
   bottom-left); tap it to swap. The title chip names the large plane.
3. **The chain bar (64 px):** Numbers, the cards, +, the F tile, then the Deformation toggle.
4. **The tool row (56 px):** **Undo** · Select · Point · Disc · Polygon · More. Undo is where the thumb is [users-17];
   Redo is Undo's long-press (and a Redo row appears in its menu).

Everything else is **one bottom sheet at a time**, opened from the control it belongs to:

| Sheet | Opens from | Kind |
|---|---|---|
| Editor (the phone Inspector) | a card, the F tile, Numbers | non-modal, half height, drag up for full |
| More tools | More in the tool row | non-modal |
| Display | the sliders button on the plane | non-modal |
| More | ⋯ in the header | modal |
| Examples, Export, Add a step | More or + | modal, full height |

**While a non-modal sheet is open, X and Y show side by side above it** [users-3]: two live planes, 195 × 300 each,
with the probe linking them. Editing a zero, dragging a slider or picking a pattern always shows both the domain and the
image. Closing the sheet returns to the single plane and the inset. (Alternative: keep one plane and move the inset to
the top-left; rejected because the inset is too small to judge an image.)

## 3. The parts

### 3.1 Header
- The switch is the desktop's: **X → Y · Phase · Landscape**, three equal segments, each 44 px tall. No separate X
  and Y segments: the inset swaps them [design-4]. The Deformation needs no merged segment.
- More (⋯) holds the mark, the name, Sound, Theme and Language.

### 3.2 The plane
- **Title chip (top-left):** the plane and its scale in real math markup (STIX italic with `<sub>`, one text run, no
  letter-spacing) [design-18]: "*z* 2 / div", "*w* = *F*(*z*)", "phase of *F*". Russian: «/ дел.» [users-25].
- **A step shown alone** says so in the chip: "*w*₂ · *f*₃ alone ×"; the × returns to the whole chain [design-23].
- **Right column:** Sphere, Display (sliders); in Phase the folded colour wheel. **Fit** bottom-right.
- **The inset** (X → Y only): the other plane, fitted, live.
- Opening a sheet never resizes the planes' canvases during the animation; the side-by-side layout is one resize at
  the end of the sheet's opening.

### 3.3 The chain bar
`[a = | a, ρ]  z → f₁ → f₂ → f₃  [+]  [F ■]  |  [Deformation]`
- **Card:** a 48 px chip, a 44 × 44 picture, the index (STIX), the type icon, the type name on up to two lines. No
  formula. Names wrap and never run under the arrow [design-20].
- **Pictures are cumulative, as on desktop** [users-4]: X → Y the image under *Fₖ*; Phase arg *Fₖ* and Landscape
  log|*Fₖ*| over the main z-window; Deformation step k at its own *t*. No letters, no axes, no paths [design-7, users-24].
- **Redraw:** the desktop's one rule (DESIGN.md §2.3 of `../desktop/`): in the same frame as the main view, held only
  when the perf guard says the frame would pass 16.7 ms [design-8].
- **Numbers chip:** its own glyph, an italic "*a* =", with the names under it (*a*, ρ), or «Числа» when there are none.
  The sliders glyph is Display's only [design-10, users-21].
- **F tile:** "*F*" and its lamp only [design-20]; it opens the F sheet (3.5).
- **Deformation toggle:** 64 × 52, the glyph with its word under it, «Деформация» in Russian [design-11].
- **States:** selected = accent ring; during playback only the playing card is accent, the selected one neutral
  [design-24].

### 3.4 Tool row
- Six keys, 60 px each at 360 px: Undo, Select, Point, Disc, Polygon, More.
- **Labels may take two lines with soft hyphens**; no abbreviations [design-20]: «Отме­нить», «Много­угольник».
- A tool picked from More tools lights the More key with its icon and name ("Circle (3)").
- **In the Deformation** the row is the transport, every control 44 × 44: pause, the scrubber (with the steps' ticks),
  speed (cycles 0.5×, 1×, 2×), Paths, close.

### 3.5 The editor sheet (the phone Inspector)
- Opens at half height; the chain bar rides on its top edge. Above it, X | Y side by side (section 2).
- **Head (52 px):** index, icon, name, Show alone (lens, 44), ⋯ (44).
- **Zeros and poles** [design-1, users-10, users-11]:
  - **Add zero**, **Add pole**: 48 px, half width each. They add at the visible centre of the step's input and never
    switch to Show alone.
  - On X the zeros and poles of the step show at their preimages (DESIGN.md §2.4 of `../desktop/`); drag them there.
  - The hint: "Or long-press a plane. New and dragged marks snap to 0.05." (the ruler's minor division; Snap off in
    More tools for free placement).
  - Rows: *a*₃ (the step's coefficient carries its index [users-5]), ζ₁, ζ₂, p₁. Each row 56 px: the name, a 44 px
    field with 16 px text, Argand (44), Remove × (44), 4 px apart [design-5].
  - **On touch a mark is removed only by its ×, or "Remove ζ₂" in the long-press menu**, with an Undo toast. Dragging a
    mark to the plane's edge pans the plane instead; a label "ζ₂ = …" rides above the finger [users-11].
- **F (the F tile)** [design-3, design-18, design-21]: the expanded *F*(*z*) with the *w*ₖ list and Copy LaTeX; "■
  Analytic"; one muted line "Not implied: …"; the natural domain; Step by step folded.
- **Numbers** [users-15]: one row per number: the name, "=", the value field (44), Play (44), ⋯ (44); under it the
  slider in a 44 px row with its range ends; "used by Line 1: Im *z* = *a*". "+ Number" at the end.

### 3.6 Long-press
The shared state machine (`../desktop/INTERFACE.md`, "Long-press"): 8 px slop, 450 ms ring, then **slide = live probe**
(the title chip shows *z* and *F*(*z*)), **release without sliding = the menu** [design-6, users-12]. The menu head shows
the pressed point and *F* there, computed at the ring [users-19]. On X it offers **Add zero of *f*₃ here** with "also at
*z* + 2π*ik*" for exp [design-1, users-13]. Rows are 44 px.

### 3.7 More (⋯)
Unchanged: Sound (switch + Settings), Theme, Language (one tap); Examples, Export figure, Copy LaTeX, Search, Guided
tour, Reference guide.

### 3.8 More tools [design-14, users-16]
- The 18 tools and the two new ones, **Circle (3 points)** and **Intersect**, in one grid of 60 px tiles; then
  **Midpoint, Bisector, Point on curve** in the same tiles. Snap (a 44 px pill) in the head.
- There is no "Line through 2 points": the Line tool snaps to points (snap radius 22 px on touch).
- Picking: tap the points in order; a chip says "Circle through 3 points · point 2 of 3" and cancels (44 px ×); a
  snapped tap shows a ring and "on *z*₀" (screen 10).

### 3.9 Display
- "This view" options, then the pattern swatches (names under them, up to two lines) [design-19], then **Cell** and
  **Opacity** as 44 px rows: the name left, the value right, the slider under them.

## 4. Touch rules
- **Every control is at least 44 × 44 visible**, 4 px apart; fields are 44 px tall with 16 px text [design-5].
  Measured on the 28 mockup screens (14 × light/dark): 634 controls, 0 interactive under 44 px (the audit's other 2
  hits are menu separators). The check is in the acceptance file (§8).
- Nothing works by hover only. Long-press labels replace tooltips on buttons; on a plane, long-press is §3.6.
- **Gestures on the plane:** one finger pans, drags a shape, a handle or a mark, or draws; two fingers pan and pinch
  (never draw); tap selects or places; double-tap zooms ×2; long-press is §3.6. Globe and Landscape orbit.
- Sheets move only by their grabber and head. No swipe between X and Y. No gestures from the screen edges.

## 5. Task counts (390 × 844, from the home screen)

| Task | Before | After |
|---|---|---|
| Load an example | 3 taps | 3 taps |
| Draw a disc and watch its image | 1 tap + 1 drag | 1 tap + 1 drag (image live in the inset) |
| Add a step and change its parameter | 5 taps + typing, 1 scroll back | 4 taps + typing, X and Y in sight |
| Switch view | 1 tap (30 × 22 icon) | 1 tap (labelled, 44 px) |
| Play the deformation | 1 tap | 1 tap |
| Export a figure | 4 taps | 3 taps |
| Turn on sound | 2 taps | 2 taps |
| Change language | 3 taps | 2 taps |
| Undo | 1 tap, top-left (hard to reach) | 1 tap, bottom row |
| Change a parameter of an existing step | 2 taps + 2 scrolls | 2 taps |
| **Add a zero at a chosen point of X** | not possible on touch | **2: long-press X, "Add zero of f₃ here"** (now true from the home screen, design-1) |
| Drag a shared number and watch X and Y | not possible | 2 taps (Numbers, then the slider) |
| Change the pattern | 1 tap + 2 scrolls | 2 taps |
| See F's formula and guarantees | 3 scrolls | 1 tap (the F tile) |

Main screen: 22 controls, all 44 px or more (was 100, 80 under 44 px). One scroll area: the chain bar, sideways.

## 6. Landscape phones and touch tablets
- **Landscape phone (844 × 390):** header 44; X and Y side by side; one 52 px row with the cards and the six tools;
  sheets are a 360 px side sheet on the right, so both planes stay visible.
- **Touch tablets (768–1023):** the desktop tablet layout (Inspector under the chain), with the touch rules of §4.

## 7. Alignment with desktop
The same parts and rules: cumulative card pictures, the F tile, the Inspector contents, the context menu, the
long-press, the tool set, the names. One difference: on the phone the Deformation toggle sits at the chain bar's end
(the header has no room, and it is next to the cards it animates).

## 8. Building it (after v14's gate)
- `#app` becomes a `100dvh` grid (header, stage, chain bar, tool row). One pane full width; the inset is the other
  pane rendered small. With a sheet open, both panes at half width.
- 60 fps: sheets animate `transform` only; the side-by-side switch is one resize after the animation.
- i18n: two-line labels with soft hyphens (tool row, chain names, Deformation); the 360 px Russian check.
- The tour's phone chapters get new spotlights (header switch, chain bar, tool row, sheets).
- **Acceptance file (`test/phone_cmd.js`):** no page scroll at 360, 390, 430; every control ≥ 44 × 44 (the audit
  script of the review, run on the mockup and on the build); long-press: menu on release, probe on slide, nothing after
  an 8 px move; sheets do not resize during their animation; X | Y side by side with a sheet open; the title chips and
  F sheet in real math (no spaced subscripts) in light and dark; Russian at 360.

## 9. Questions for the user
In `../README.md`.

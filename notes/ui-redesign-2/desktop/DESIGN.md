# Desktop and tablet: the chain, the guarantees, the right panel

Backlog items 16, 17 and the desktop half of 18 (user, 2026-10-22). Design only: nothing in `src/`, `dist/`, `test/`
or `work/` was changed.

- Mockup: `mockup.html` (six frames in iframes, light/dark button). Each frame is also its own page in `frames/`.
- Screenshots: `shots/before-*.png` (v14 in progress), `shots/after-*-{light,dark}.png` (the mockup frames, revision 2),
  `shots/after-ru-*.png` (Russian), `shots/r1/` (revision 1, superseded).
- Revision 2 (2026-10-22) answers every entry of `../review-design.json` and `../review-users.json`; the finding ids
  are named in brackets where a rule changed.
- Every plane and card picture in the mockup is a real render of the app copy (`img/`, captured by `cmd/cap_*.js`).
  The frames use the app's own stylesheet; new rules are in `build_mockup.py` under "NEW".
- Interface with the constructions designer: `INTERFACE.md` (agreed, their answers are appended there).

## 1. Audit of v14 in progress (3-step chain: exp, Möbius, zeros and poles)

Measured in headless Chrome, in X → Y, Phase, Landscape and the Deformation (`shots/before-<width>-<view>.png`).

| Width | Planes (w × h) | Chain | Right panel | Cards visible of 4 |
|---|---|---|---|---|
| 1440 × 900 | 868 × 568 (two of 430) | 272 px, 32 % of the stage | 288 px docked | 3.2 (f₃ cut) |
| 1280 × 800 | 708 × 468 (two of 350) | 272 px, 37 % | 288 px docked | 2.6 |
| 1024 × 768 | 716 × 436 (two of 354) | 272 px, 38 % | 36 px rail | 2.5 |
| 768 × 1024 | 664 × 692 (two of 328) | 272 px | 36 px rail | 2.3 |

What is cramped or wasted:
- **A card is 240 × 216, and only 88 px of it is the picture.** The rest is the formula (28), two rows of 24 px
  fields (52), a note and a property strip (20). Four cards need 1248 px; the strip has 868 at best.
- **The fields are 24 px tall** and about 80 px wide (Möbius `a b c d`, the zeros, the poles). The zero/pole buttons
  are 24 px tall. A long value (`−0.8+0.75i`) does not fit.
- **The formula on the card is cut** for any real step ("w₃ = …" at f₃). The user: "the type is enough".
- **The pictures ignore the view.** In Phase, Landscape and the Deformation the cards still show the X → Y images.
- **The Guarantees panel costs 288 × 848 px** for one lit lamp: the composite formula (210 px), 8 lamps (330 px),
  the domain (160 px) and a step table that is cut off at 900 px. The same facts are repeated as 7-cell strips on
  every card and as 8 lamps on the rail.
- **Tablet portrait (768):** each plane is 328 × 692 (aspect 0.47), much taller than it is useful, while the chain
  shows 2.3 cards.

## 2. Decisions

### 2.1 The chain: a card is its type and a picture

- **Card:** a 36 px head (index tag, type icon, type name) and a picture. No formula, no fields, no property strip.
  Height 134 px. The chain is 188 px (was 272): +84 px for the planes at every width.
- **The name is the card's only text, so it must never be cut** [design-2].
  - It may take two lines (12 px, 13 px leading, Archivo at 87.5 % width).
  - A card name table, no abbreviations: Region / Область, Exponential / Экспонента, Möbius / Мёбиус, Zeros and poles /
    Нули и полюсы. Rule: every word of a card name fits one line of the narrowest card.
  - Below 140 px of card width the type icon hides; the index tag stays.
  - Measured in headless Chrome, English and Russian, at 768, 1024, 1280 and 1440: no name is cut
    (`../rev/cmd/ru_measure.js`; Russian shots `shots/after-ru-*`). This is an acceptance test for the build.
- **Width:** `flex: 1 1 0`, min 120 px, max 208 px. Five tiles fit at 1024 (Region, three steps, F).
- **The F tile closes the chain** [design-3]: 88 px (72 px under 1024), no picture, "*F*" and the lit lamp with its name
  ("Analytic"; none lit: "No guarantees"). It is F's only home; see 2.6.
- **States:** selected = accent outline. Shown alone = accent index tag (no head lens icon) [design-2]. Bypassed = the
  hatch. Error = red border; the picture shows the step's input. During playback only the playing card is accent; a
  selected card's outline turns neutral (`--line-strong`) until the playback stops [design-24].
- **Head actions** (Bypass, ⋯) appear over the name on hover or focus only.
- **The chain head:** "Function chain", Pictures | Names, Whole chain (enabled when a step is shown alone), ⋯ (Clear
  chain). The composition, Copy LaTeX and the guarantees button left the head [design-3].

### 2.2 The card picture follows the open view, and is cumulative

Every card shows *Fₖ* = *fₖ* ∘ … ∘ *f*₁, the map up to its step, in every view [users-4]. So the last step's card equals
the main picture, and the row shows how *F* is built.

| View | Card k shows | Frame |
|---|---|---|
| X → Y | the image of the shapes under *Fₖ* | the robust (2–98 %) box of that image + 10 % |
| Phase | arg *Fₖ* over z | the main plane's z-window (cover-fitted) |
| Landscape | log \|*Fₖ*\| over z, at the main camera | the main z-window; no axes, no labels, no ticks [design-7] |
| Deformation | step k alone at its own *t* over its grey start | as X → Y; no paths [users-24] |

- **Region card:** the shapes in z.
- **No letters on cards** [design-7]. Phase cards show the colours only; the zeros are visible as colour wheels.
- **A card never shows a later step's marks** (the f₂ pole on the f₁ card) [users-23]. They appear on card k only
  while card k + 1 is hovered or selected.
- **A step shown alone** (2.4) draws its own portrait over *wₖ₋₁* in the main view; the cards stay cumulative.
- Why not the formula: it never fits, and the Inspector shows it in full.
- Every card picture in the mockup is a real render of the app copy (`../rev/cmd/cap.js`).

### 2.3 Drawn exactly, at 60 fps (one rule on every platform) [design-8, users-14]

- **One renderer:** today's thumbnail path (draw offscreen, `drawImage` into the card), with a `kind` per view and the
  same programs as the main view (inverse renderer, phase shader, landscape mesh at 64 × 64, `renderMorph` of one step).
- **One rule:** a card shows the exact current state and redraws in the same frame as the main view.
  - During playback the playing card renders at the exact *t* every frame. No 9-frame cache.
  - During a drag (a parameter, a mark, a shape) the cards after the changed step redraw with the main view.
  - **The guard:** if the perf guard reports that a frame would pass 16.7 ms, the cards hold their last exact picture
    (with a thin `--line-strong` bar under it) and redraw at release or pause. They never show an approximate picture.
- **Cached** as `ImageBitmap`s by (kind, k, chain signature up to k, shapes, look, size, theme, t, camera), LRU 64.
- **Cost** (estimate): Phase 344 × 212 device px is 73 k fragments; Landscape 8 k vertices; under 1 ms of GPU each.
- **Gate:** the perf suite's zp drag and morph play with 3 cards in each view: p95 frame ≤ 16.7 ms, and the cards
  redraw in-frame (not held) on the reference machine.

### 2.4 Editing moves to the Inspector (the freed right panel)

Decision: **the right panel becomes the Inspector.** It edits the one selected object: a step, F, a shape or
construction, a parameter.

- **Select is not focus.** A click on a card selects the step; the planes keep the whole chain. **Show alone** (the lens
  in the Inspector head, a double-click on the card, or `L`) is today's focus. "Whole chain" in the chain head, or the
  × in the plane head's "*f*₃ alone ×" chip, returns [design-23].
- **Head:** index, type icon, the full name; Show alone; ⋯ (Inverse, Bypass, Move, Duplicate, Presets, Write by zeros and
  poles / by coefficients, Remove).
- **Formula** in full, in a well (MathJax 15 px).
- **A step's own coefficients carry its index** [users-5, design-16]: *a*₂ *b*₂ *c*₂ *d*₂ for a Möbius f₂ (in the formula,
  the field labels and *a*₂*d*₂ − *b*₂*c*₂), *a*₃ for the leading coefficient of a Zeros-and-poles f₃. A plain name in a
  field always means a shared number (2.7).
- **Fields:** one row each, 32 px, full width: the symbol, the field (B612 Mono 13), the Argand button.
- **Zeros and poles:** two 36 px buttons, **Add zero** and **Add pole**. They add at the visible centre of the step's
  input and **never switch to Show alone** [design-1]. Then *a*₃ and one row per ζₖ and pₖ with Remove. The hint: "Or
  right-click a plane. Marks snap to the ruler (Alt: free)." Marks snap to the ruler's minor division while added or
  dragged [users-10]; the snapped value shows in the menu head and the row.
- **Zero and pole marks on X.** With the whole chain shown, the zeros and poles of *f*ₖ appear on X at their preimages
  under *F*ₖ₋₁ (the zeros of *F* that this step makes). Dragging one moves ζ to *F*ₖ₋₁ of the pointer; the other
  preimages follow.
- Russian: at 264 px the buttons read «Нуль» / «Полюс» with their marks.

### 2.5 The planes' context menu

Right-click on any plane, or the touch long-press (INTERFACE.md, "Long-press": 450 ms ring, release without moving).
A right-drag still pans. Groups, empty ones left out:

1. **Head:** the point and the map there, from the exact pointer position: "*z* = 0.75 + 0.60*i*", "*F*(*z*) = −0.18 −
   0.06*i*" (on Y: "*w* = …"). The mockup's values are computed at its ring [users-19].
2. **The object under the pointer:** a mark (Remove ζ₁, Turn into a pole, Edit in the Inspector); a shape (Select,
   Integrate along it / ∮, Hide, Delete); a cut handle (Reset the cut).
3. **At this point** [design-1, users-13]:
   - On X (and the Phase and Landscape views over z), for the selected Zeros-and-poles step *f*ₖ, or the only one:
     **Add zero of *f*ₖ here**, **Add pole of *f*ₖ here**. The mark is put at *w*ₖ₋₁ = *F*ₖ₋₁(*z*), which is exact: *z*
     becomes a zero of *F*ₖ, and of *F* when the step is last. When an earlier step is not one-to-one, a muted line says
     where else it lands ("also at *z* + 2π*ik*" for exp; "also at −*z*" for *z*²). No switch to Show alone.
   - On the step's own input plane (shown alone): plain **Add zero here**, **Add pole here**.
   - Never on Y. With no Zeros-and-poles step: "Add a Zeros-and-poles step here" adds one with this zero.
   - Add point here.
4. **Constructions** (INTERFACE.md): with points selected, Circle through 3 points, Midpoint; with a curve under the
   pointer, Point on this curve; with two curves, Intersect.
5. **The view:** Copy coordinates, Center view here (Z).

Items are 30 px (44 on touch), `role="menuitem"`, with their shortcuts.

### 2.6 F and its guarantees: the F tile [design-3, design-21]

Decision: **shrink to the F tile; do not remove.** The lit names cost one line, are correct, and teach.
- **The F tile** (2.1) shows *F* and the lit names (no "1 of 8": it reads like a score).
- **Selecting it** fills the Inspector:
  - the expanded *F*(*z*) with the *w*ₖ list and Copy LaTeX (today's Composite map);
  - the lit guarantees as words ("■ Analytic"), then one muted line "Not implied: entire, rational, …";
  - the natural domain;
  - folded: Step by step (today's table) and How these are decided.
- **Gone:** the Guarantees panel, the chain-head button and popover, the rail lamps, the per-card property strip, the
  per-step guarantees in the editor.

### 2.7 Shared numbers in fields (with the constructions designer)

- Names are one Latin letter with optional digits, or a Greek letter. *z w x y r i e* are taken; the mockup's ρ
  replaces *r* [users-22, design-16].
- A step's coefficient letters are labels with the step's index, not names (2.4).
- Before parsing, Cyrillic look-alikes become Latin (а с е о р х у к and the capitals); other Cyrillic letters are refused
  with «Используйте латинские буквы» [design-17].
- A new slider appears only for one standalone unknown letter per edit; a run of letters that is not a function is an
  error ("Unknown function sinc") [users-6]. Details: `../constructions/DESIGN.md` §1.4.

## 3. The right panel: what stays, moves, goes

| Today (Guarantees panel) | Now |
|---|---|
| Composite map (formula, wₖ list, Copy LaTeX) | the F tile's Inspector |
| Guarantees (8 lamps) | the F tile (lit names) and its Inspector (two lines) |
| Natural domain D | the F tile's Inspector |
| Step by step (matrix) | the F tile's Inspector, folded |
| (new) | **Inspector, Selection:** a step, F, a shape or construction, a parameter's range |
| (new) | **Inspector, Parameters:** shared numbers, 56 px rows, at least 240 px |

**With the panel** (1440): planes 868 × 652, Inspector 288.
**Without it** (`]`): planes 1120 × 652 and a 36 px rail (Edit, Parameters). Selecting a step slides in a **temporary
Inspector**, 288 px, over the stage's right edge [design-13]. It never covers the picture's centre or the plane's options
strip; the plane's legend and zoom buttons move left of it. Esc or `]` closes it. Parameters open the same way.

## 4. Breakpoints

| Width | Left | Right | Planes | Notes |
|---|---|---|---|---|
| ≥ 1440 | 252 docked | Inspector 288 | 868 × 652 at 1440 | the search shows its text when it fits |
| 1280–1439 | 252 docked | Inspector 288 | about 708 × 550 at 1280 | the search is an icon with ⌘K [design-22] |
| 1024–1279 | rail 36 | Inspector 264 | 692 × 520 at 1024 | one side panel docks at a time; no drawers over the planes |
| 768–1023 | rail 36 | none | 700 × 448 at 768 × 1024 | the Inspector docks **under the chain**: 320 px tall, Selection ⅔, Parameters ⅓, the formula on the head row, so the zero and pole rows show without scrolling; no right rail [design-12] |
| < 768 | phone design (`../phone/`) | | | |

- **The header** (v14, xr + xb): Examples keeps its word at every width; the Language globe sits before Theme (its
  name shows at 1440 and wider); the search shows its full text only when it fits (Russian needs 1600 px), otherwise
  the icon and ⌘K. Frames 1–6 draw this merged header.
- Default at 1024: the Inspector when the chain has steps, the left panel on an empty canvas.

## 5. Build notes

- `buildPipeline`/`makeCard`: drop `ftex-row`, `params`, `note`, `pchips` and the head lens; two-line names; the F tile;
  `.acts` absolute; `container-type: inline-size` for the icon rule. `thumbs` gains `kind` (cumulative) and the keys of 2.3.
- New `S.sel` (selected step or 'F') beside `S.focus` (shown alone). Old saves: `sel = focus || last step`.
- `#propsPanel` becomes the Inspector; the temporary Inspector reuses it as an overlay.
- `openIntegralMenu` becomes `openPlaneMenu(pane, side, x, y)` with the groups of 2.5, `role="menu"`/`menuitem`.
- Zero marks on X: `zpPreimages(k, view)` (Newton from the grid, as the phase portrait's zero finder).
- Accessibility: INTERFACE.md, "Keyboard and screen readers".
- Tests: cards per view (cumulative kind, cache, in-frame redraw), the card name test of 2.1 (EN, RU, 4 widths),
  select vs alone, the menu groups (Add zero of fₖ on X; never on Y), the Inspector at 288, 264 and under the chain,
  the header at 1024 and 1280 in both languages, the perf gate of 2.3.

## 6. Questions for the user

In `../README.md` (at most four, with recommendations).

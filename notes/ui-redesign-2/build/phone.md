# v15 build: the phone layout (work/xva), as built

Design: `../phone/DESIGN.md` and `../phone/mockup.html`. Built on the merged build in `work/xva` (desktop redesign,
context menu, shared numbers). The desktop and tablet layouts (768 px and up) are unchanged: every new rule is under
`:root.ph`, which `src/phone.js` sets only below 768 px and on a landscape phone.

## What it does

**One screen, no page scroll** (portrait, below 768 px): header 56 · the plane · the chain bar 64 · the tool row 56.
- **Header:** the view switch **X → Y · Phase · Landscape** (three equal 44 px segments, words, X → Y in math type)
  and More (⋯). The mark, Undo, Redo and the Deformation toggle leave the header.
- **The plane:** one plane, full width. In X → Y the other plane is a **live inset** (116 × 116, bottom-left, with an
  X or Y tag). A tap swaps them. The new inset is fitted; the plane that comes back keeps its own view.
- **Title chip:** the plane's name before the scale: *z*, *w* = *F*(*z*), and *z* → *w* in the deformation. It is no
  longer a tap target on a phone (Copy coordinates is in the long-press menu). "*f*₃ alone ×" sits under it.
- **Right column:** Sphere (pressed while the plane shows its sphere; hidden in Landscape) and Display (sliders).
  Fit stays bottom-right at 44 px. The zoom buttons and Expand give way to the pinch.
- **Chain bar:** Numbers («Числа» when there are none; otherwise "*a* =" and the names), the cards, +, the F tile,
  then Deformation (glyph and word, «Деформация»). A card is a 52 px chip: the 44 × 44 picture (the desktop's
  cumulative picture, drawn by the same code), the index, the type icon, the name on up to two lines. The F tile shows
  *F* and its lamp only.
- **Tool row:** Undo · Select · Point · Disc · Polygon · More, 48 px keys. Undo's long press opens Undo / Redo. A tool
  picked in More tools lights the More key with its icon and name.
- **Deformation:** the tool row becomes the transport: play, the scrubber with the steps' ticks, the speed, Paths,
  close, all 44 px. The order (one after another / all at once) and Loop move to the Display sheet while it plays.

**One bottom sheet at a time.** The head is the grabber (tap: full height and back; drag down: close) with ×; Esc
closes it.
- **Editor** (a card, the region card, the F tile, Numbers): the Inspector itself (`#propsPanel` moves into the sheet),
  with Parameters. Numbers scrolls to Parameters.
- **More tools** (More in the tool row): the 18 tools as 64 px tiles, Snap as a pill in the head, then Region from a
  formula and Shapes (the app's own sections, moved in).
- **Display** (the sliders on a plane): "This view" (the plane's options strip, which the sliders button used to hold),
  then the app's Display section (patterns, Cell, Opacity, mesh).
- **More** (⋯, modal, with a scrim): the name; Sound (switch and Settings); Theme (Auto / Light / Dark); Language
  (Auto / English / Русский, one tap); Examples (the gallery as a bottom sheet); Export figure (the dialog directly);
  Links, scenes and LaTeX (the export menu); Copy LaTeX with guarantees; Search functions and commands; Guided tour;
  Reference guide.
- **While the Editor, More tools or Display is open, X and Y sit side by side above it** (390 × 844: two 195 × 304
  planes). The sheet slides in by `transform` only; the chain bar rides up with it; the planes resize once, after
  the slide (measured: one resize per canvas at 313 ms, none during the 220 ms animation).

**Long-press:** the planes' context menu of `planemenu.js`, unchanged (450 ms ring, 8 px slop, menu on release, probe
on slide). On a phone its rows and every other menu row are 44 px.

**Landscape phone** (coarse pointer, at most 500 px tall, below 1024 px wide; 844 × 390): header 48; X and Y always
side by side; one 52 px row with the cards (left) and the six tools (right); the sheets are a 360 px side sheet on the
right and the planes shrink beside it, so both stay in sight. The More sheet is the same side sheet.

**Touch tablets** (768 to 1023): the desktop tablet layout, unchanged (820 × 1180 checked: no phone classes, the
Inspector in its panel).

## How it is built (kept small for the 3-way merges)

- New: `src/phone.js` (global `Phone`), `src/phone.css`, `test/v15_phone_cmd.js`, `notes/i18n/ru/v15-phone.json`.
- `build.py`: `phone.js` before `app.js`; `phone.css` after `desk.css`.
- `src/app.js`: one block at the end of `init()`, `Phone.init({...})`: the icons, `showPanels`, `resize`
  (`onPaneResize`), `getView`/`setView`/`fit` for the swap, `footKids` (the options strip's controls), `renderInspector`,
  `openMenu`, theme, language, sound state, `exportFigure`, `copyLatex`, `openGuide`. Nothing else in app.js changed.
- `phone.js` moves the app's own elements into its sheets (`#propsPanel`, `#secFormula`, `#secShapes`, `#secDisplay`,
  `#morphBtn`) and puts them back above 767 px, so their listeners stay the app's. It intercepts the header More and
  the tool row's More (capture phase) only in the phone layout.
- On a phone `S.hideLeft` and `S.hideRight` are false at run time (so the Inspector draws); the saved dock
  preferences (`dockPref`) are not touched, and leaving the phone layout restores them.
- Russian: `notes/i18n/ru/v15-phone.json` (9 entries: Числа, Числа: %{list}, Тема, Настройки, Этот вид, Изменить высоту
  панели, Показать %{x} крупно, Поиск функций и команд, Ссылки, сцены и LaTeX-код). `tools/make_ru_table.py`: 2146
  entries, unresolved 0. The other phone strings already had Russian.

## Tests

- `test/v15_phone_cmd.js` (new, CDP, port from `CMW_PORT` or 8925): **pass, 0 failures.**
  - 360 × 780, 390 × 844, 430 × 932; light and dark; English and Russian (12 screens): no page scroll, nothing past
    the edges, no cut label; every control at least 44 × 44 on the main screen (18 to 19 controls), and at 360 and 390
    in each sheet: Editor (26 to 28), F (18 to 19), More tools (39 to 40), Display (27 to 30), More (17).
  - The tasks of DESIGN.md 5 and their taps (all within the design's counts): switch view 1; Undo 1 (bottom row);
    draw a disc and see its image in the inset 1 tap + 1 drag; change a parameter of a step 2 + typing (X | Y in
    sight); add a step and change its parameter 2 + typing in the palette; change the pattern 2; see F's formula and
    guarantees 1; drag a shared number and watch X and Y 2; add a zero at a chosen point of X 2 (long-press, "Add zero
    of *f*₃ here", the zero is added); long-press then slide: no menu; play the deformation 1 (the transport in the tool
    row, every control 44 px); export a figure 2 to the dialog (3 with its Save); turn on sound 2; load an example 3
    (the gallery fits the screen, its rows 44 px); swap the planes 1; change language 2.
  - The sheet: X | Y side by side above it, equal widths, the chain bar between; one resize per plane, after the
    slide; Add zero / Add pole 44 px or more; the grabber opens the full height; Esc closes and the inset returns.
  - Landscape phone 844 × 390: no page scroll, X | Y side by side, 44 px controls, the Editor as a side sheet with both
    planes in sight. Touch tablet 820 × 1180 and desktop 1440: no phone classes or controls, everything at home.
  - No console errors.
- Quality suite (`run.sh --base-url http://localhost:8925/`, then `compare.py --only quality
  --quality-enforce-targets`): **PASS** (81 runs, 0 failed). It renders at 1440 × 900 only, where nothing changed;
  goldens and baselines untouched.
- Node: `t_i18n*.js` pass (4403 key checks, 28914 parse checks).
- Older tests with phone parts:
  - `test/i18n_cmd.js`: its phone part drove the old header More menu and the Language menu; it now uses the More
    sheet's Language switch. **Not re-run** (time box).
  - `test/mv_views_cmd.js` 9a and 9 (390 px: the top bar fits; no horizontal scroll; Phase is one panel): should still
    hold (the switch and More are the bar's only items; `#paneR` is `display: none` in a merged view). **Not re-run**.
  - `test/v15_planemenu_cmd.js` section 7 (touch at 390): it presses the plane at its centre and edges; the planes are
    now larger and the inset sits bottom-left. **Not re-run.**
  - `test/desk_cdp/cmd/s8.js` (the v15 desktop build's phone shots) shows the old phone page; it is a screenshot
    script, not a check.
- Perf: not run (the phone code does not run at the perf harness's 1440 × 900).

## Screenshots

`work/xva/test/ph_cdp/shots/` (made by the test): `v15ph-home-{360,390}-{light,dark}-{en,ru}.png`,
`v15ph-{edit,F,tools,display,more}-390-*.png`, `v15ph-edit-360-*.png`, `v15ph-zp-390-light-en.png` (the editor with
X | Y above), `v15ph-ctx-390-light-en.png` (long-press menu), `v15ph-def-390-light-en.png` (the transport row),
`v15ph-land-844.png`, `v15ph-land-844-edit.png`, `v15ph-tablet-820.png`.

## Left (not done in the time box)

- Zero and pole marks on X at their preimages (DESIGN.md 3.5, the desktop's `zpPreimages`) are not built, as on desktop.
  On touch, removing a mark only by its × or the menu, and the "ζ₂ = …" label above the finger: not changed.
- The Inspector's hint still says "Or right-click a plane" on a phone (design: "Or long-press a plane").
- Speed in the transport row: the row shows the active speed only; a tap on it does not yet cycle 0.5×, 1×, 2× (the
  other speeds are hidden).
- The tour's phone chapters still point at the old anchors (header Help, the old More); new spotlights (switch, chain
  bar, tool row, sheets) are not built.
- Circle (3 points), Intersect, Midpoint, Bisector, Point on curve are v16 (constructions), so More tools has the 18.
- Title chip: Phase and Landscape show the scale or hint only ("phase of *F*" is not drawn).
- The examples gallery, palette, export dialog, guide and tour menus were not audited for 44 px (their own layouts).
- Swipe-up on the grabber is a drag on the sheet head (up: full, down: close); there is no fling physics.
- The older tests above were not re-run; `i18n_cmd.js` was edited but not run.

## Review round (2026-10-23)

The 60 findings of the v15 reviews are fixed or answered in `review-v15.md` (ledger: `../ledger-v15.json`). Some notes
above are now out of date: see that file for what changed.

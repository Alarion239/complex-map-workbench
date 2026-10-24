# v15 build: desktop and tablet (work/xva), as built

Design: `../desktop/DESIGN.md` (2.1 to 2.4, 2.6, 3, 4) and `../desktop/INTERFACE.md`. Built on v14 r1 (`work/v15-base`).
Not in this build: the planes' context menu (`work/xvc`, `planemenu.md`) and the shared numbers (`work/xvd`,
`params.md`). The phone keeps its v14 page.

## What it does

**The chain (188 px; was 272)**
- A card is its type and a picture: the index tag, the type icon, the name. The name may take two lines and is never
  cut. Below 140 px of card width the icon hides. Cards are 134 px tall, 120 to 208 px wide.
- Card names come from the catalog, with three short forms where a Russian word would not fit: Möbius «Мёбиус»,
  Inverse Joukowski «Обратная Жуковского», Disk automorphism «Автоморфизм круга» (`$tx('card', …)`).
- Bypass and ⋯ show over the name on hover or keyboard focus only.
- The F tile closes the chain: *F* and its lit guarantees (the two strongest; "No guarantees" when none is lit).
- The chain head: Function chain, Pictures | Names, Whole chain (enabled while a step is shown alone), Clear chain.
  Names is the old compact mode: heads only, 96 px.
- The chain is a listbox: cards and the F tile are options. Arrows, Home and End move the selection. Enter selects.
  L toggles Show alone. Delete removes the step.

**Card pictures follow the view, and are cumulative.** Card *k* shows *F*ₖ, the map up to step *k*.
- X → Y: the image of the shapes under *F*ₖ, framed on that image (the v14 thumbnail path).
- Phase: arg *F*ₖ over the main plane's z-window, cover-fitted (the same `drawColorPlot`, no grid, the outlines).
- Landscape: log|*F*ₖ| at the main camera (angles and zoom), 64 × 64 mesh, no labels. The camera sits at 0.58 of the
  bounding-sphere distance, so the block fills the small card.
- Deformation (X → Y): step *k* at its own *t* (one after another: 1, *t*, 0; all at once: one *t*), over its start
  in dashed grey. A small "t = 0.55" label sits on the picture.
- The region card always shows the shapes in z.
- Step *k* + 1's cuts and marks show on card *k* only while step *k* + 1 is selected.
- Drawn exactly with the main view's programs, cached as `ImageBitmap`s by kind, step, chain signature, shapes, look,
  size, theme, view or camera, and *t* (LRU 64). They are drawn when input is quiet, as before. While a drag or
  playback holds them, a 2 px bar under the picture says so; they redraw exactly at release.

**Select is not Show alone.** `S.sel` (a step *k*, 0 for the region, or 'F') is new and saved. Old saves: the step
shown alone, else the last step. A click selects. A double-click, L on a card, or the lens in the Inspector shows the
step alone (today's focus). Showing a step alone also selects it. Adding, moving or duplicating a step still shows it
alone, as in v14. While a step is shown alone, X's head has the chip "*f*₃ alone ×" (Russian «только *f*₃»); its ×
returns to the whole chain.

**The Inspector (the right panel; was Guarantees)**
- Selection, a step: the head (index, icon, full name, Show alone, ⋯ with Inverse, Bypass, Move, Duplicate, Presets,
  Write by …, Remove), the formula in display style, the fields, the branch notes.
  - Fields are 32 px, one per row (two columns under the chain at 768 to 1023 px).
  - A step's own coefficients carry its index: *a*₂ *b*₂ *c*₂ *d*₂ in the labels. For mul, add, affine and Möbius the
    formula shows the indexed generic form too: *w*₂ = (*a*₂*w*₁ + *b*₂)/(*c*₂*w*₁ + *d*₂) = (*w*₁ − 1)/(*w*₁ + 1).
    Möbius shows *a*₂*d*₂ − *b*₂*c*₂ = 2.
  - Zeros and poles: **Add zero** and **Add pole** (36 px), the hint, then *a*ₖ and one row per ζ and *p* with ×.
    The buttons call `zpAddFromCard` → `zpAdd` + `commit`; × calls `zpRemove` (the same functions the context menu
    uses). They never switch to Show alone. The new mark goes to a free grid node at the visible centre of the step's
    input: X's view when X shows that plane, else the view that plane would have (`fittedView(paneL, k − 1)`).
- Selection, F: the expanded *F*(*z*) and the *w*ₖ list, Copy LaTeX; the lit guarantees in words (with "deg 2");
  one muted line "Not implied: …"; the natural domain; folded Step by step (the table) and How these are decided.
- Selection, the region: the shape count and swatches, and a hint.
- Parameters: a slot that calls `Params.mount(el)` when `typeof Params !== 'undefined'`. Without it the section hides.
- Without the panel (`]`), selecting a card opens the **temporary Inspector**: 288 px, fixed over the stage's right
  edge, from the planes' top to above the chain. The pane under it moves its zoom buttons and legend left of it. Esc
  closes it; `]` docks the panel. The rail has an Edit button that opens it.
- Gone: the Guarantees panel, its rail lamps, the cards' formula, fields, note and property strip, the compact
  popover's use. (`buildProps`, `fillProps`, `renderRail`, `openCardPop` are still in app.js but no longer called, so
  the merge with v14 fixes stays clean. Remove them after the merge.)

**Breakpoints** (`src/desk.css`)
- ≥ 1440: left 252, Inspector 288. At 1440 × 900 the planes are 410 × 600 (were 410 × 516).
- 1280 to 1439: the same; the search is an icon with ⌘K (Russian: below 1600).
- 1024 to 1279: left rail 36, Inspector 264; one side panel docks at a time; Examples keeps its word.
  Default: the Inspector when the chain has steps, the left panel on an empty canvas.
- 768 to 1023: rail 36; the Inspector docks under the chain, 320 px, full width (Selection two thirds, Parameters
  one third, or the whole width without Parameters). No right rail.
- Below 1440 the connectors are 16 px, the add tile 36 px and the F tile 72 px, so the region, three steps and F fit
  at 1024 and 768.
- Below 768: the v14 phone page. The Inspector is its disclosure after the chain.

**Tour** (`src/tour.js`, within the INTEGRATION.md contract, which is unchanged)
- The chain step: click selects, double-click shows the step alone; its Try it is "Double-click the card *f*₁"
  (still `step-focused`).
- The zp step lights the Inspector's zeros and poles; the inverse step its ⋯ menu; the cut step says "the sheet *k*
  in the Inspector".
- The domain, guarantees and LaTeX steps: `api.anchor` selects F and draws the Inspector before the tour looks up
  `composite`, `guarantees`, `domain`, `matrix`.

**Russian:** `notes/i18n/ru/v15-desktop.json` (48 entries; the no-break space before «—»).
`tools/make_ru_table.py` reads `v15-*.json` (the same one-line change as the other two builds). Unresolved 0.

## Files

- New: `src/inspector.js` (global `Inspector`), `src/desk.css` (build.py appends it to page.html's style),
  `test/v15_desktop_cmd.js`.
- Changed: `src/app.js` (makeCard, buildPipeline's region card and F tile, updateCards, renderThumb and its helpers,
  the selection and Inspector glue before renderProps, setFocus, removeStep, zp field sync, zpFreeSpot, zpAddFromCard,
  stepMenu's `{ full }` items, isDrawer and setPanels, applyLayout, chain heights, init, the Esc key, tourApi.anchor,
  test hooks), `src/page.html` (the switch's words, the right panel's labels and rail), `src/tour.js`, `build.py`,
  `tools/make_ru_table.py`, `src/i18n_ru.js` (generated).
- Interface for the merge: `selectStep(k)` selects a step (or 'F') and opens the Inspector; the context menu's
  "Edit in the Inspector" should call it. `insp.refreshParams(k)` runs from `refreshZpCard`.

## Test hooks (stripped from the published page)

- `window.__cmwChainH`: the quality and perf runners set it to 272, so their scenes keep the v14 pane geometry and
  the goldens and baselines stay valid (`run_quality.js`, `perf/run.js`: one line each). The app applies it at the
  start of `init()`, before any canvas is sized (applied later, the shared GL canvas had grown to the taller planes:
  +0.9 MiB GPU peak at dpr 2).
- `test/regress/perf/run.js`: the two scrub units find φ in the Inspector (`#i1_phi`, after selecting step 1) and
  fall back to the card's `#p1_phi`, so the paired reference build still works.
- `__cmwCards()` (kind, selection, each card's view, size, signature and state) and `__cmwCardsNow()`.

## Tests

- `test/v15_desktop_cmd.js` (new, CDP): **pass**. Cards per view (kinds, all final, all different); exactness: Phase,
  the last card against the main portrait at the same *z*, median 0, p90 1, max 5 of 255; X → Y, the last card
  against Y at the same *w*, median 0, p90 0, max 13; the deformation's *t* per card and labels; select vs Show alone
  (click, double-click, L, Whole chain, arrows); the Inspector's labels *a*₂…*d*₂, 32 px fields, formula,
  determinant, editing *b*₂ redraws the cards; Add zero / Add pole 36 px, never Show alone, × removes; the F tile and
  the F Inspector; the temporary Inspector (288 px, over the stage's right edge, above the chain, Esc); frames while
  dragging a zero and a disc (perf inject: p95 16.4 and 15.2 ms; the design's gate is 16.7); the cards' redraw after
  a drag, 1.9 ms; dark; 1440, 1280, 1024, 768 (layout, no name cut, the chain fits); Russian at the four widths
  (names, Нуль / Полюс, Картинки | Названия, the F tile).
- Updated for the removed UI: `zp_cmd.js` (fields and buttons in the Inspector; Show alone by double-click; it keeps
  the v14 geometry through the hook, because its per-pixel truth counts Y's axis, which the taller plane now shows),
  `zpfix_cmd.js`, `mv_views_cmd.js`, `ubfix_cmd.js` (double-click), `tour_cmd.js` (the zp anchor),
  `test/cdp_kit/qa_inject.js` (`__qa.lamps()` reads the F tile).
- Results on this build (port 8921; copies of the tests that hard-code 8793): `zp_cmd` pass, `zpfix_cmd` pass,
  `mv_views_cmd` pass, `deform_nat_cmd` pass, `export_cmd` pass, `i18n_walk_cmd` nothing left in English,
  `tour_cmd` 91 of 92 (below), `ubfix_cmd` fails 22 checks, the base build fails 24 of the same (stale test).
- Node: every `test/t_*.js` passes except `t_sound.js` 64/66, which fails the same way on the base (sound.js untouched).
- Quality suite: PASS with targets enforced (81 runs, 0 failed); goldens and baselines untouched.
- Frame intervals while dragging, against the base build, three rounds each: the same (p95 15 to 16 ms in both for
  this ad-hoc scene).

## Screenshots

`work/xva/test/desk_cdp/shots/`: `v15d-{xy,phase,land,def}-1440-light.png` (the cards per view),
`v15d-zp-1440-{light,dark}.png`, `v15d-F-1440-light.png`, `v15d-temp-1440-light.png`, `v15d-xy-{1280,1024,768}-light.png`,
`v15d-xy-1440-dark.png`, `v15d-ru-{1440,768}-light.png`, `s6-alone.png` (the chip), `s5-names-dark.png` (Names),
`s8-phone-chain.png` and `s8-phone-insp.png` (the phone, unchanged but for the cards and the Inspector).

## Left

- `tour_cmd`: "Phase portrait: the callout is below the panel". The planes are 84 px taller, so the 242 px callout no
  longer fits below them; the tour puts it inside the plane's top right, over the legend. Options: let the callout
  overlap the chain, or anchor that step to the portrait's options strip.
- Zero and pole marks on X at their preimages under *F*ₖ₋₁ (DESIGN.md 2.4, `zpPreimages`): not built. Marks show on
  the step's own input plane, as in v14.
- Cards redraw when input is quiet, not in the same frame as the main view (DESIGN.md 2.3 asks for in-frame redraws
  within the guard). During playback the cards hold their picture with the bar.
- The temporary Inspector covers the right half of Y in the split view (X → Y); in the merged views it is clear.
- On touch screens (tablets) the cards' Bypass and ⋯ do not show (no hover); the Inspector has both.
- `role="option"` cards hold two buttons (Bypass, ⋯); a strict listbox has no interactive children.
- Card names in Russian for the long catalog names (Обратная к функции Жуковского and the inverse hyperbolic
  functions) beyond the three short forms were not measured.

## Perf (paired, quick; the machine was loaded by other agents' runs, load average 4 to 5)

- Against the default reference (the pre-sphere snapshot): the first run had one failure, `suite.no_errors`: the scrub
  units could not find `p1_phi` (fixed in run.js above). The second: all units pass except
  `image.ziH.m240.dpr2.zoomR.out` (fps 49.9 vs 56.1, latency p95 40.8 vs 23.7 ms), which passed in the first run.
  A third run did not complete (the load rose to 35; a reference unit timed out). A fourth, final run completed with
  load warnings before four units (load 5 to 15): 13 failures, 11 of them in `examples` (settle_ms,
  inv_first_draw_ms, compile_ms, first_frame_ms), plus `image.logUHP.m1920.redraw_ms` and `morph.open.ex7.jank_ms`.
  The same units passed in the first two runs.
- A/B in one browser, alternating this build and v15-base under the same load (`test/desk_cdp/cmd/exab.js`), examples
  2, 3, 6, 8, 13, time to settle, median of 3: 62 vs 63 ms, 87 vs 96, 87 vs 105, 87 vs 43 (base runs 43, 174, 22),
  223 vs 274. No sign of a regression.
- Run `test/regress/perf/run.sh --paired --quick` again at the gate, on a quiet machine.
- Against `work/v15-base` (`PERF_REF_SRC`), `--only 'image\.ziH\.(a50|m240)'`, three runs: a different metric fails
  each time (redraw_ms +20 %; then zoomR frame p95; GPU peak bytes before the hook fix). Instrumenting `GLR.begin`
  during a 30-step wheel zoom of Y shows 30 renders of Y and no card render, so the cards add no work to these units.
  A run on a quiet machine should confirm.

## Review round (2026-10-23)

The 60 findings of the v15 reviews are fixed or answered in `review-v15.md` (ledger: `../ledger-v15.json`). Some notes
above are now out of date: see that file for what changed.

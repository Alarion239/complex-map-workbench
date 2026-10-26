# As built: the tour lights the exact control (v16.1, user request 5)

Built in work/xvta, a copy of v16. The main tree was not touched.

The user (2026-10-25) raised two points about the tour:

> In the tour you often ask to do something involving the left panel but it is not highlighted. Could you highlight
> exactly the tool we would need to use to complete the task.

> the guide involves showing how the card images follow the view that you look at, but it does not guarantee that
> card images are even shown and it is not in compact mode.

The step-by-step audit, with what each step lit before and lights now, is in `tour-audit.md`. Screenshots are in
`tour/`.

## What changed for the user

- **Each task lights the control that does it.**
  - Draw a shape: the Disc button only, no longer the whole Draw panel. On a phone, the Disc key of the tool row.
  - Circle through three points: the 3 points button.
  - Intersections: the Line tool.
  - Your shapes, Zeros and poles, It follows its points, Branch cuts: the Select tool, which the step also switches on
    first.
  - Smaller controls inside a lit area get a dashed ring of their own:
    - Phase, in Three views
    - Stretch, in Patterns
    - Landscape, in Cards follow the view
    - Split into 3 steps
    - the slider of a
    - Play and the t slider
    - card f₁, in The function chain
  - Part of the chain, on a touch screen: card f₂ is lit. On a phone, f₂'s ⋯ in the Editor sheet is lit next.
- **Hidden controls are opened.**
  - On a phone, Circle through three points and Intersections open the More tools sheet with the tool's tile lit.
    Once the tool is picked, the sheet closes and the More key, which now shows that tool, stays lit with X.
  - A folded split offer is unfolded for its step. This does not change the user's saved fold.
  - On a phone, All sheets opens the Display sheet, where its check is.
  - A collapsed Draw panel needs nothing: its rail shows every tool, and the rail's button is lit.
  - In a short window (1024 × 768), the side panel scrolls so the Select tool shows whole above the Shapes list.
- **On a phone, a lit control inside a nested panel is drawn in the outer panel.** The slider of a sits in a list that
  scrolls inside the Editor sheet. Drawing it in the outer panel keeps the slider touchable and the Parameters block
  undimmed.
- **The control stays lit while the user works.** The lit tool is looked up again as the layout changes (the phone's
  sheet opens or closes, the panel collapses). It can be reached with Tab during the Try it. A control hidden under an
  open sheet is not lit, since the step has already switched to it.
- **Basics starts in Select.** A drawing tool left on from the user's own work no longer draws where the steps say to
  hover, hold or pan. The steps that ask for a hold or right-click also switch to Select first: Add a zero here and
  Integrals.
- **Cards follow the view always shows the pictures.**
  - If the chain shows Names, or is shorter than pictures need (under 140 px, the app's own rule), the step switches
    it to Pictures at 188 px. It adds one sentence: "The tour turns the cards' pictures on for this step; your setting
    comes back after it."
  - Leaving the step, or ending the tour, puts back the user's Names and chain height. The exception is a user who
    changed the setting during the step: their new choice stays.
  - Nothing is saved, because the tour holds the autosave.
  - A phone's chain bar always shows its pictures, so nothing changes there.

## Code

- `src/tour.js`
  - New anchors:
    - `tool:select`, `tool:line`, `tool:circle3`
    - `viewPhase`, `viewLand`, `patStretch`, `splitBtn`
    - `card1`, `card2Menu`
    - `paramSlider`, `tSlider`, `playBtn`
  - `tool:disc` is now a function. Its old selector found the rail's hidden copy first.
  - Step fields:
    - `try.ctl` names the controls that complete a Try it. They are lit, brought into view last, and reachable with
      Tab.
    - `live` looks the anchor up again on each layout.
    - `pictures` asks for the cards' pictures. `show()` calls `api.chainPictures` for every step, and `stop()` calls
      it with off.
  - Content changes:
    - Draw a shape and Circle through three points have new anchors.
    - Several steps gained `ctl`.
    - Several steps gained `['tool', 'select']`.
    - Circle through three points, Intersections and All sheets gained `['panel', 'sheet', …]`.
    - One new string.
- `src/app.js`
  - The adapter's `chainPictures(on)`.
  - `data-pat` on the pattern swatches.
  - `splitTour()` for the Inspector.
- `src/inspector.js`: the split offer opens during its tour step without saving the fold.
- The contract addendum is `INTEGRATION-v161-tour.md`, beside this file. Merge it into notes/tour/INTEGRATION.md.
- Russian:
  - `notes/i18n/ru/v161-user5.json` gains `tour.pictures_note`. The file is shared with work/xvex, whose entries are
    kept.
  - `tools/make_ru_table.py` reads it. This is the same change as work/xvex's, so the two merge cleanly.
  - `python3 tools/make_ru_table.py --strict` reports 0 unresolved.

## Tests (work/xvta, headless Chrome on port 9701)

Results are saved in `tour-evidence/`.

- **Tour audit**, `test/tour_audit_cmd.js`, the full matrix: 390, 1024 and 1440 px; light and dark; English and
  Russian; mouse and touch (24 configs). The steps, layer, follow and focus passes all ran.
  - 1056 step views, 0 failing.
  - Spotlight error: at most 0.75 px.
  - 472 layer checks, 0 failing. 56 follow checks, 0 failing; 16 skipped by design, one per desktop config, as in the
    v16 gate. 24 focus checks, 0 failing.
  - **New control check: 800 of 800 lit exactly**, using the table described in tour-audit.md. In dark at 768 px and
    up, the chain is set to Names before the tour. The cards step showed its pictures in all 24 configs, and Names
    and the chain height came back after the tour in every config.
  - The same check on the published v16: 14 of 33 controls not lit exactly at 1440, and 15 of 32 at 390. With
    Names, the cards step showed no pictures.
  - The audit's app-layout list (not failures) gains `1024 · basics/shapes` in 8 configs. This is the trade-off
    above: in a 768 px tall window the Select tool shows whole and the Shapes list is cut at the panel's bottom. The
    list shows from its title through its z-plane rows. `390 · ru · touch · edit/zp` is as in the v16 gate.
- **`test/tour_cmd.js`: 97 of 97.**
  - Two checks were rewritten for the exact Disc key. The phone check now looks for the Disc key, not the whole tool
    row.
  - The polygon Escape check picks Polygon by its key, G, because the Draw step now leaves the other tools under the
    shade.
  - One check was added: Polygon can be picked by its key during the Draw step.
- **`test/tour_phone_cmd.js`.** It has no pass count; compared with the v16 gate's run:
  - Work area: 348 steps, 0 callouts over the work area, **0 touches blocked**. A first run found 60 blocked touches
    on the Shared numbers slider. The slider's list is a scroller nested in the Editor sheet, and two nested shades
    cancelled out over it. Fixed: a part in a nested panel is now drawn in the outer panel.
  - The rest matches v16: tries 5 of 5, race, rotate and fold all OK, URL bar and pinch 0 px, 0 exceptions.
  - Construct/c3 is a new step drawn inside a panel (the More tools sheet). Its on-screen scroll measure reads 12.33 px
    on the back-scroll gestures and 0 in the page measure. v16 has the same pattern on basics/formula (8.33 px), which
    was accepted. All sheets on a phone now has nothing that scrolls.
- **`test/t_tour.js`: 1325 of 1325.** The step limit is unchanged (44). New checks:
  - Every Try it's control is in the contract and is lit (the anchor, or `try.ctl`).
  - Every drag task switches to Select and lights it.
  - Draw a shape and Circle through three points light their tools; Circle through three points opens a phone's
    More tools sheet.
  - Exactly one step asks for pictures.
  - The test reads the v16.1 addendum.
- **`test/t_tour_engine.js`: 29 of 29.**
- **`test/i18n_cmd.js`: 92 of 92**, the same as the v16 gate.
- **The node i18n tests pass:** `t_i18n`, `t_i18n_keys`, `t_i18n_english` (byte-identical) and `t_i18n_parse`.
- **`python3 tools/make_ru_table.py --strict`:** 0 unresolved.

The build passes `python3 build.py`.

## Not done, or left as is

- The other user points from the same message, the sheets and the export, belong to the other work/ copies.
- The tour's copy is unchanged apart from the pictures note. "Pick a tool and drag in X" now sits beside the Disc
  tool alone. The other tools are dimmed and covered by the shade, but they can still be picked by their keys.
- Part of the chain on a touch screen at 768 px and up lights card f₂, not its ⋯. On a touch desktop the ⋯ only
  shows on the card once it is touched.
- To merge, take these:
  - `src/tour.js`, `src/app.js`, `src/inspector.js`, the generated `src/i18n_ru.js`, and `tools/make_ru_table.py`
    (identical to work/xvex's).
  - `test/tour_audit_cmd.js`, `test/tour_cmd.js` and `test/t_tour.js`.
  - The addendum `INTEGRATION-v161-tour.md`, into notes/tour/INTEGRATION.md.

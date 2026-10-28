# Wave 1, the chain piece: as built

Built in `work/xu1-chain` (a copy of `work/xv164-merged-snap`). Audit: `notes/ux-audit/REPORT.md`. Every fix was reproduced in
the running app first (headless Chrome, 1366×768 and 412×860) and is checked by `test/ux165_chain_cmd.js`.

Files touched: `src/app.js`, `src/inspector.js`, `src/params.js`, `src/funcs.js` (one label), `src/tour.js` (texts only),
`src/page.html` (three attributes), `src/desk.css` (one block at the end), `src/i18n_ru.js` (rebuilt),
`tools/make_ru_table.py` (registers the table), `notes/i18n/ru/v165-ux-chain.json` (new, 134 entries).
Tests: `test/ux165_chain_cmd.js` (new, the browser checks), `test/t_ux165_chain.js` (new, node: the formula repairs and
the undo descriptions, read from `src/app.js`); expectations updated for the two intended renames in `test/split_cmd.js`,
`test/fix152_cmd.js`, `test/v15_desktop_cmd.js` and `test/t_i18n_english.js`, and for UX01 in `test/deform_range_cmd.js`
(Duplicate no longer shows the copy alone, so the test double-clicks the card only when a step is alone).

## Findings

**UX01 (restores "X on the left" and "Show alone is its own choice"). Done.**
Add (palette, + card, Add as n steps, the planes' menu's new zeros-and-poles step), Move and Duplicate no longer
switch the planes to the step alone. What was shown stays shown: F, or the step that was alone (its index follows the
insert or the move). The new or moved card is selected, so the Inspector edits it, and it unfolds once. Toasts:
"Added f₃ Sine. · Show alone · Undo", "Duplicated f₂ as f₃. · Show alone · Undo", "Moved Exponential to f₂. · Undo".
Pane titles stay "z-plane, domain of F" / "w = F(z)". No tour step depended on the old behaviour (checked in
`src/tour.js`: Add a function waits for the catalog opening; Split uses its own path).
`app.js`: `addStep` (new 4th argument `o.msg`), `addSteps`, `duplicateStep`, `moveStep`, new `keepShown`, `addedToast`;
`undoToast` takes a second action; `setFocus(k, quiet)` (no `step-focused` tour event when the focus does not change).
Test: UX01 checks (laptop, phone portrait, phone landscape).

**UX16. Done.** "z^2 + a" is a normal row "Formula, with a new number a = 1"; Enter adds the number and the step as
one undo step ("Added f₃ Formula and the number a."). The preview draws it with a = 1.
`app.js`: `paletteItems` (catch branch), new `withNewName`, `drawPalettePreview`. Test: UX16 checks (incl. one Undo
removes both, and the step follows the number).

**UX23. Done.** A formula that does not parse shows, in grey (`--muted`), the typed formula with the place it stopped
marked (wavy underline) and the message; the repairs that parse are rows Enter runs: "Close the bracket: sin(z)",
"Drop the trailing +: cos z", "Did you mean z^2?", "Did you mean sin z?" (nearest function name, 1–2 letters off;
two swapped letters, "sni", count as one slip). The typed formula is shown in the palette input's face (B612 Mono drew
"sin(z" as "sin[z").
A plain word that finds commands or functions ("zero", "zeros") gets no error. Enter in the footer is grey when there
is nothing to run. `app.js`: `formulaFixes`, `editDist`, `paletteItems`, `openPalette` (render, `runItem` for `fix`); `desk.css` `.pal-err`.
Test: UX23 checks; `t_ux165_chain.js` (every repair, and that each one parses).

**UX03. Done** (one part differently, below). ⌘K now finds the header's and the menus' commands (Export figure ⌘E,
Copy LaTeX, Copy link, Save scene, Open scene, New: empty canvas, Examples…, Theme Dark/Light/Auto, Keyboard shortcuts,
Show f₂ alone L, Show F), every drawing tool with its key ("Tool: Disc D"), every guide section ("Guide: Branch cuts",
opens the guide there) and the steps' Inverse/Derivative by "replace"; the examples were already found by name and
blurb (Enter "to open"), and while searching the empty canvas is listed once, as the New command, not again as an
example; each by synonyms (dark, help, png, export,
new, disc, zero, link, alone…; the synonym lists are translated, so Russian words find them too). Every command row
shows its key; the footer says "Enter to run" / "to open" / "to fix" / "to add". A plain word that names a command
more than a function lists the commands first. Formula errors only for formula-like input (UX23).
*Differently:* a control row does not light the control the way the tour does (that needs the tour's lighting
outside a tour; left for wave 2's search in the Menu, D6).
`app.js`: `paletteItems` (acts, tools, guide sections), `TOOL_ALIAS`, `GUIDE_SECS`, new `openGuideAt(sec)` (opens the
guide, then scrolls to the heading; `openGuide()` itself is unchanged). Test: UX03 checks.

**UX32. Done.** The region field's placeholder is a hint in the interface face, italic, muted: "such as |z−1| < 2"
(not "e.g.": the page's translator skips a text without a word). Add on an empty field puts the cursor there and says
"Type a set, such as |z − 1| < 2, or a curve, such as Re z = 0." + Number starts with the next free letter as real,
selected text, so Add works at once. No example chips. `page.html` (placeholder), `desk.css`, `app.js` `setupFormula`
(`add`), `params.js` `newRow`, new `nextFree`. Test: UX32 checks.

**UX33. Done** (the stepper differently). Fields read "Root index n₁", "Power n₁", "Cut angle θ", "Sheet k", "Angle φ",
"Exponent α", "Factor a₁" (zeros and poles). A formula step shows θ only when its formula has a cut to move. The
Inspector's θ now follows the seam dragged on the map (root cause: the drag updated only the fields with the cards'
`p` prefix; it now goes through `syncParam`, which updates every field of that step). The note no longer repeats the cut
and the sheet ("cut 180°, sheet 0/2" was the card's tag, `branchTag`). *Differently:* no "‹ Sheet 0 of 2 ›" stepper; the
sheet field keeps its arrows and the note says "sheet 0 of 2". `app.js`: `paramField`, new `paramWord`, the cut drag
(`syncParam(k, 'cut', '')`); `inspector.js`: `indexLabels`, `fillParams`, new `hasCut`, `fillStep`, `sigOf`.
Test: UX33 checks (incl. a real drag of the seam).

**UX81. Done.** Alt+← / Alt+→ on a card moves the step and keeps the keyboard on it (toast "Moved … · Undo"). The ⊕
between cards is 24 px and also shows next to a card that has the keyboard. In a phone's step sheet, ← and → (44 px)
sit in the head, on the line under the step's name with Show alone and ⋯. The guide says Alt+←/→.
`app.js`: `chainKey`, new `moveCard`; `inspector.js`: `buildStep` head; `desk.css`. Test: UX81 checks (laptop and phone
with real touch).

**UX82. Done.** The palette rows lose the "A E R P M Pr I" letters; the highlighted row names its two strongest
properties in words, like the F tile ("Entire · Analytic"); none on a phone. `app.js`: `openPalette` render, new
`propWords`; `desk.css`. Test: UX82 checks.

**UX84. Done.** An empty chain's F tile reads "F = z" (aria "F = z: no steps yet"), no guarantees listed; the phone tile
stays "F". A typed step's type is "Formula" (was "Custom formula"), on the card, the Inspector and the palette; its
formula is in the card's tooltip ("f₂(z) = …") and aria label, never on the card. `funcs.js` (label), `app.js`
`updateFTile`, `fTile`, `updateCards`, palette label. Test: UX84 checks.

**UX85. Done.** One name, Show alone: the Inspector's button is a card in a focus frame (not a magnifier), tooltip
"Show alone  L", and "Show F  L" while the step is alone; on a phone the button carries the words. The chain head's
"Whole chain" button and the alone chip's × are "Show F". The tour says "Show alone" instead of "the lens"; the guide too.
`inspector.js` (icon, `fillStep`), `page.html` (`#viewAllBtn`), `app.js` `syncAloneChip`, `tour.js` (Basics → The
function chain, touch text and task). Test: UX85 checks.

**UX22. Done (the card; the header is wave 2).** The + card shows "Add function" (Russian «Добавить шаг»: «Добавить
функцию» does not fit the card's height) while the chain has three steps or fewer, as a vertical label inside the same
44 px card, so nothing moves. Not in compact (Names) mode, not on a phone; its aria label is unchanged.
`app.js` `buildPipeline` (`$tx('addcard', 'Add function')`); `desk.css`. Test: UX22 checks (the label is whole, also in
Russian).

**UX65. Done** (one part differently). One name, Numbers: the Inspector section, its aria label, its hint, the guide's
heading and text, the tour step title. A number nothing uses says "Not used yet." with "Use in f₃" (appends "+ a" to the
selected formula step, else the last one) or, with no formula step, "Not used yet: type a in a formula." A step's
editor lists the numbers it uses with their values ("Numbers: a = 1"). *Differently:* no "a=" chip in formula fields
(it would be a chip under a formula box; your no-chips rule). `params.js` `draw`, `row`; `app.js` new `paramUseIn`,
`stepNumbers`, Params host `useIn`; `inspector.js` (the `inums` line). Test: UX65 checks.

**UX79. Done.** Undo and Redo say what they did: "Undid: add pole p₂ of f₁. · Redo", "Redid: add f₂ Cosine. · Undo"
(also bypass, replace, move a zero, add the number a, delete Disc 1, edit Line 1, reorder the steps…); the Redo in the
toast is the phone's visible way back. The Undo/Redo tooltips name the action ("Undo: add f₂ Cosine  ⌘Z"), set when
the pointer or the keyboard reaches them. The description is computed from the two history snapshots, so no call
site had to change. Every way to undo (button, ⌘Z, the phone's Undo, a toast) clicks `#undoBtn`/`#redoBtn`; a capturing
click listener notes which, and `restore()` ends with `histSay()`, so the buttons' own listeners are the snapshot's
(the plane piece rewrites the Undo listener; this keeps the merge clean, and a construction pick undone there, which
does not call `restore()`, gets no second toast). `app.js` new `histWhat`, `histSay`, `histToast`, `undoTip`;
`restore()` (one call). Test: UX79 checks (the tooltip by a real pointer move); `t_ux165_chain.js` (26 kinds of
undo step: add/remove/reorder/replace/bypass a step, zeros and poles, numbers, shapes).

**V03. Done.** With nothing selected, ⌘K "integrate" lists one row per curve, named exactly as in the planes' menu
("∮ F dz around Disc 1", "Integrate F along Line 1": one function, `intLabel`, for both); with a curve selected, only
that one. The result opens beside its curve in X and never over Y; the keyboard path with several curves and none
selected asks "Pick a curve to integrate along: select it, or right-click it." `app.js` new `intLabel`,
`integrateRows`, `integrateShape`; `integralItems`, `integrateSelected`, `openIntegralPop(id, cx, cy, o)`,
`placeIntPop`. The stuck "Close Esc" tooltip is UX34 (another piece). Test: V03 checks.

**UX25. Done.** The Examples button always says "Examples ▾" (tooltip "Worked examples"); the open example's name is
muted after the chevron until the first edit (from 1024 px; hidden in Russian below 1440 px for room). "New: empty
canvas" is first in the list, set apart. Opening an example shows "Opened Strip to disk. · Undo" when there is work to
go back to. `page.html` (`#examplesBtn`), `desk.css`, `app.js` `loadExample`, `openGallery`, new `exLabelSync`
(called from `commit()` and `restore()`; `updateUndo` is left as it was, the plane piece rewrites it).
Test: UX25 checks.

## Russian

`notes/i18n/ru/v165-ux-chain.json` (134 entries, terms from GLOSSARY: Числа, Отменить/Повторить, Примеры, Руководство),
registered in `tools/make_ru_table.py` as `V165_CHAIN_HERE`, read after every v164 table.
`python3 tools/make_ru_table.py --strict`: 0 unresolved (1919 call sites).
One entry is not mine: `snap.help_deformation`. `notes/i18n/ru/v164-help.json` now carries work/xv164's newer Help
"Deformation" paragraph, so the snapshot's own older paragraph had no Russian any more; the entry restores the snapshot's
shipped Russian for it. Drop it when the merge brings xv164's wording.

## Goldens, perf numbers

None affected, none changed (no golden image, perf baseline or `test/regress/accepted.json` touched). Every change is
interface around the planes (palette, toasts, cards, Inspector fields, the Examples button); the maths drawing is the
same. The image-quality suite on this build (`test/regress/quality/run.sh --no-build --base-url http://localhost:9881`):
81 runs, 0 failed, RESULT: PASS (the 28 "improved" and 18 "NEW" are the base's own, not mine). The GLSL pages inline
only cx/parse/funcs/glsl, which differ from the base by one label ("Formula") and one comment, so their results are the
base's (checked: see Tests run). The BUDGET60 checks of the browser suites below pass.

## Tests run: re-check of 2026-10-27, 14:30 (unit tests only, as the user asked that day)

No code changed after the run below. `src/` and `tools/` are as that run left them (the same eight `src/` files and
`tools/make_ru_table.py` differ from the base). `python3 tools/make_ru_table.py --strict`: 0 unresolved, 1919 call
sites, `src/i18n_ru.js` byte-identical (sha1 10bec34f…). `python3 build.py`: `dist/test.html` (58cb0719…) and
`dist/complex-map-workbench.html` (f5458681…) byte-identical to the build the run below tested; the published page has no
test hook. Node, every `test/t_*.js` (36 files): 35 pass; `t_tour.js` 1715/1716, the one expected failure
("documented anchor leftOpts has a default"); `t_tour_engine.js` 11/11; `t_ux165_chain.js` 39/39. No browser suite,
glsl-test, quality suite or timing measurement was run in this re-check.

## Tests run: Results (fourth run, 2026-10-27 from 09:28, on the final build)

The final build is `src/` as of 06:43 (the last change: the phone step sheet's head in `desk.css`, so that the
Inspector fits its sheet and the tour's "Inspector" step lights it exactly at 360 px). `python3 build.py` gives the same
bytes as at 06:43. Browser suites ran in `test/chain_cdp` (headless Chrome 156, real WebGL2), port 9881, one at a time;
logs in `test/chain_cdp/run/results3/`. `dist/base.html` is the base snapshot's `test.html` (rebuilt and compared: identical).

- Node, every `test/t_*.js` (36): all pass but one expected failure, `t_tour.js` 1715/1716 "documented anchor leftOpts
  has a default" (the plane piece's line in the shared INTEGRATION.md). `t_ux165_chain.js` 39/39.
- `python3 tools/make_ru_table.py --strict`: 0 unresolved, 1919 call sites; `src/i18n_ru.js` unchanged by the run.
- `test/ux165_chain_cmd.js`: PASS, 0 failed (every check; laptop 1366×768, dark, Russian, phone 412×860 with real touch,
  phone landscape 915×412), 198 s. Its 42 screenshots (21 after, 21 before on the base) are in
  `notes/ux-build/shots/w1-chain/` (refreshed by this run).
- `test/tour_audit_cmd.js`, the subset where the third run had failed (360×780 and 844×390, light, English, mouse and
  touch; `run/aud_sub_mine.js` / `run/aud_sub_base.js`): mine 1790/1796, the base 1790/1796, the same six failures, all
  at 844×390 and all the base's own (basics/chain and deform/transport "the task's control lit", basics/draw "ctlNone",
  basics/shapes and deform/paths "spotlight exact", "every step visited" 34). The third run's 16 failures of
  "edit/inspector: spotlight exact" (360 px, 390 px in Russian, 844×390 touch: the sheet head as it stood then, with
  ← → and Show alone in words, made the Inspector taller than its sheet; fixed at 06:43 in `desk.css`) are gone here; the full audit below covers the rest.
- `tour_cmd.js`: 96/96, 230 s. `tour_auto_cmd.js`: 75/75, 303 s. `tour_phone_cmd.js`: 2261/2261, 460 s.
  `t_tour_engine.js` 11/11 (node, above).
- `v15_phone_cmd.js`: PASS, 149 s.
- `split_cmd.js`: 91/92, 255 s. The one failure, "tour: the offer shows only at its stop", is the base's own: the
  same check on `base.html` (`run/split_tour_base.js`, run again today) gives the same result, `[[null,false],[null,false],[null,true],…]`.
  Its sweep frames: 60 fps, p95 19.9 ms (gate 20 ms), no long task.
- `i18n_cmd.js`: 94/94, 320 s. `deform_range_cmd.js`: PASS, 0 failed, 429 s (with my UX01 change to its Duplicate step).
- `phone_swap_cmd.js`: PASS, 224 s. `touch_cmd.js`: PASS (its BUDGET60 drags included), 120 s. `constr_cmd.js`: PASS, 146 s.
- `perp_cmd.js`: PASS, 293 s. `zp_cmd.js`: PASS, 45 s. `seasong_cmd.js`: PASS, 90 s.
- `export_cmd.js` (pointed at 9881, see the last section): 307 files built, every format and dialog check passes but
  one timing check, "video globe: no main-thread task of 50 ms or more while it is made" (one task of 65 ms in a 3.5 s
  video), 494 s. None of my code runs while a video is made (no commit, toast or palette); four other agents' browsers
  were running on the machine at the time. The third run's failure of this suite (Oct 26) was another timing check
  ("preview 60 fps Loop").
- glsl-test (pages rebuilt from this `src/` by `test/make_glsl_test.py` and `make_glsl_test_adv.py`): `glsl-test.html`
  585 chains, 6 338 860 points, 0 failed, 0 errors; `glsl-test-adv.html` 612 chains, 304 failed, exactly the base's
  (`glsl-test-adv-base.html`, built from the base: the same 304 in the same ten chains, the rational and two custom
  formulas near their singular points and "twelve"), 0 errors.
- `i18n_walk_cmd.js` (1440, light, every chapter of the tour, the palette, the guide, …): n = 0 (no English left), no
  page error, 685 s. (Only the default width was walked this run; the phone's Russian is checked by `ux165_chain_cmd.js`
  and `i18n_cmd.js`.)

## For the reviewer and the merge

A trial `git merge-file` of my `src/` against each of the four other pieces as they stood on 2026-10-27 at 04:50 (base:
work/xv164-merged-snap) leaves five conflicts in `app.js` (three with the learning piece, one with the phone piece, one
with the plane piece) and two in `tour.js` (phone piece); everything else merges cleanly (inspector.js, params.js,
desk.css, page.html, funcs.js; nothing with the rail piece). I moved my additions so that the plane piece's `updateUndo` and Undo listener, and the
phone piece's guide block before `openGuide`, merge without a conflict. The ones left are real overlaps:

- `app.js`, the X-plane hint "Shapes are drawn in the z-plane; choose … to draw" (learning piece, UX71, edits the next
  line): keep their `act`/Stop lines and my wording "choose Show F to draw".
- `app.js`, `chainKey` (learning piece, UX97, adds the same Alt+← / Alt+→ on a card, one line, in the same place):
  keep one, not both (the second would never run). Mine calls `moveCard` (move, then focus the moved card); theirs
  does the same inline. Both satisfy `test/ux165_chain_cmd.js` "UX81 Alt+→ …" and their own check.
- `app.js`, `openGallery` item (learning piece adds the ♫ "With sound" mark on the same line): keep both: my
  `ex-new` class and "New: empty canvas" name for item 0, and their ♫ span.
- `app.js`, `integrateSelected` (phone piece, UX17, changes the "Draw a curve or a region first" toast to a touch
  wording): keep their toast line, then my two lines (`Pick a curve to integrate along…` when several and none selected,
  with its own touch wording, then `return integrateShape(list[0].id);`). Since V03 the palette never calls it with
  curves on the page (one row per curve instead), so the "Pick a curve" line is a guard for any other caller.
- `app.js`, `paramField`'s return (plane piece adds a `before` element inside `.pair`; I add the `worded` class and,
  after the function, the new `paramWord`): keep both: `class: 'pf' + … + (word ? ' worded' : '')` and
  `h('div', { class: 'pair' }, before, input, extra)`, then my `paramWord` function.
- `tour.js`, Basics → The function chain, touch body and task (phone piece says "Show this step alone"): keep mine,
  "Show alone" (UX85 makes that the button's one name; the phone sheet's button now reads "Show alone").
- `tour.js`, the zero step's touch lines (phone piece) next to my Numbers step's title and body: keep both.
- The phone piece's touch guide (`GUIDE_TOUCH`) finds paragraphs by their section heading: its two rows for
  `Shared numbers` must become `Numbers` (I renamed the heading, UX65), else they are skipped silently. Its
  `Function chain` row replaces my paragraph on a phone; its "<b>Show this step alone</b> button" should read "<b>Show
  alone</b> button" (the button's one name since UX85), and its Russian likewise «Показать отдельно».
- The learning piece's note (UX97) speaks of "the chain piece's new Replace… item" in a card's ⋯: there is none in this
  build ("Replace…" first in a card's ⋯ is D1, wave 2). The card's ⋯ is the base's; the merge adds their
  `key: 'Alt ←'` / `key: 'Alt →'` to its Move left / Move right lines as they say, with nothing of mine in the way.
- `tools/make_ru_table.py`: each piece adds its own set to the same long `for f in …` line; keep all of them, mine
  (`V165_CHAIN_HERE`) after the v164 ones.
- `GUIDE_SECS` (app.js, the ⌘K guide sections) lists the guide's `<h3>` titles; a piece that renames or adds a guide
  section should add it there (the scroll target is found by the heading's text).
- `src/desk.css`: one block at the end ("v16.5 wave 1, the chain"). It styles the phone's step-sheet head
  (`.ihead` wraps: the step's name on its own line, then ← → Show alone ⋯): the phone piece may restyle sheet heads
  (Undo in every sheet head, D2).
- `src/page.html`: three attributes only (`#viewAllBtn` text, the region placeholder, `#examplesBtn` title and an
  empty `.exlabel`). The header itself is wave 2 (D5).
- `src/app.js` `toast()` is unchanged; `undoToast(msg, also)` adds the second button. The toast's position is UX80
  (another piece).
- `test/t_i18n_english.js`: one intended change of English is declared ("Custom formula" → "Formula"); `split_cmd.js`,
  `fix152_cmd.js`, `v15_desktop_cmd.js` expect the two renames ("Formula", "Show F").
- `test/t_tour.js`: 1715/1716; the one failure is "documented anchor leftOpts has a default" (the plane piece's line in
  the shared `notes/tour/INTEGRATION.md`), expected until the merge.
- Two suites do not read the port from the daemon: `export_cmd.js` (`CMW_BASE`, default 8793) and `sound_v152_cmd.js`
  (`CMW_PORT`, default 8832). In this run their first pass went to those ports, where nothing listened (both failed
  at once, nobody else's server was touched); my run copies (`test/chain_cdp/run/`) were pointed at 9881 and run again.
  The suites in `test/` are unchanged.
- A test-only hook `window.__cmwCutHandles` (inside the TEMP-DEBUG-HOOK block; the published page has none, checked).
- `test/regress/export/out/` (90 MB) and `test/regress/quality/out/` (2.5 MB) in `work/xu1-chain` are output of the
  earlier export and quality runs (not in the base, not goldens): leave them out of the merge, or delete them.
- The "needs distinct points" error (two points placed on one circle get the same `Constr.refKey`) is in
  `construct.js`/`constr.js`, the rail piece's area; this piece does not touch either file.

## Closing summary (2026-10-27, 14:35)

All 15 findings of this piece are built: UX01, UX16, UX23, UX03, UX32, UX33, UX81, UX82, UX84, UX85, UX22, UX65, UX79,
V03, UX25. Three are built partly differently, each for a reason given above: UX03 (a command row does not light its
control; that is wave 2's Menu search, D6), UX33 (no "‹ Sheet 0 of 2 ›" stepper; the field keeps its arrows), UX65 (no
"a=" chip in formula fields; the no-chips rule). Nothing is left undone. UX01, which restores the user's rules, came first.
Russian: 134 entries in `notes/i18n/ru/v165-ux-chain.json`, `--strict` 0 unresolved. Unit tests pass except the one
expected `t_tour.js` failure, which goes away when the merge brings the plane piece's INTEGRATION.md line. No golden,
perf baseline or `accepted.json` changed or affected. The merge needs the hand resolutions listed under "For the
reviewer and the merge" (five places in `app.js`, two in `tour.js`, `GUIDE_TOUCH`'s heading `Numbers`,
`make_ru_table.py`'s table list). Clean-up: no browser daemon or server is running on port 9881, and no Chrome profile
folder (`test/chain_cdp/chprof-*`) is left; the screenshots stay in `notes/ux-build/shots/w1-chain/` (42).

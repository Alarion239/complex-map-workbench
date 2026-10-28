# Wave 1, the learn piece: as built

Built in `work/xu1-learn` (a copy of the v16.4 merge snapshot `work/xv164-merged-snap`). The user's request
(2026-10-26): build the recommended options and the quick wins, rules first. This piece: UX21, UX20 + V01, UX80
(the three that restore rules), then UX77, UX78, UX93, UX89, UX90, UX60, UX70–UX74, UX87, UX88, UX97, UX99,
UX102–UX104. A first run was cut off; the second run checked its work in the running app, kept it, fixed what was
half done (listed under "Second run"); it was stopped by the user before the gates. The third run (2026-10-26/27,
Chrome 156) checked it all again in the running app, fixed three more things ("Third run") and ran the gates.

Tests: `test/ux165_learn_cmd.js` (browser: laptop 1366×768, phone 412×860 with Android emulation and real touch
events, 915×412 and 360×780 where it matters) and `test/t_ux165_learn.js` (node). Results are at the end.
Before/after screenshots: `notes/ux-build/shots/w1-learn/` (`<finding>-before-…png` / `<finding>-after-…png`; light,
dark, Russian).

## Findings

**UX21 · done (restores "docked strip, no pop-ups").** The first-run invitation is one line in the tour's own docked
slot: the stage's first row on a laptop (48 px + the 8 px gap; the planes make room, as for the strip), the row under
the header on a phone (56 px, 44 px buttons), the header itself in phone landscape when it has room. "New here? Take a
2-minute tour · Draw a region, send it through a chain of functions and watch its image. [Start the tour] [Not now]".
No card anywhere; it never shrinks into a pill because it covers nothing. Its words are never cut: on a laptop it is
one line, and the description shows only where it fits whole (1920 px yes, 1366 px no: "New here? Take a 2-minute
tour [Start the tour] [Not now]", the audit's own wording); on a phone two lines at most, the description dropped
first. The slot is built as wave 2's learning lane (D7): `Tour.lane({ id, title, body, acts, drop, onClose })`,
`Tour.laneHide(id)`, `Tour.laneId()`; a tour start takes the slot. Files: `src/tour.js` (suggest, showSuggest,
hideSuggest, new laneShow / laneMount / laneFit / laneHide, CSS `.tour-lane`). Test: ux165 "UX21 …" (laptop, phone
tap on Not now, landscape, words whole), `tour_cmd.js` section 8 (rewritten for the line).

**UX20 · done (restores "nothing covers the work").** On a laptop each plane's key and its display options left the
picture for its pane head: the key is a short chip ("▦ cell 1", "◎ Colour key", "Height key") that unfolds under the
head while pointed at, focused or clicked (no tooltip on it: the tooltip covered the unfolded key); Phase's and
Landscape's option bars and X → Y's "View outline / Phase key" are behind the plane's existing Display options
button, now in the pane head (wave 2's D4 turns it into "Display ▾"). "left view" in the key is now "edge of X's
view". The empty chain's "Add a function to map the region [Add function]" left Y's picture too: on a laptop it is the
"Add function" button in Y's head (its words are the tooltip). A phone keeps the key on the plane as the folded glyph
(now also in phone landscape, where the full box covered Y) and its options in the Display sheet. Files: `src/app.js`
(placeKeys, legendSum, drawLegendSide, layoutFootSide, openFootPop, exFitBarPx, the empty chip in the right render,
the legend click, applyLayout), `src/desk.css` (pane-head block). Tour: the Phase key step lights Y's button ("In
Display options, turn on Phase key."), the Cauchy step lights X's (new anchor `leftOpts`). Test: ux165 "UX20 …",
`tour_cmd.js` (Phase key, Cauchy), `tour_auto_cmd.js` (opens the button first).

**V01 · done.** The targets' one-time note is no longer a row over Y. On a laptop it is a short note in Y's pane
head, "Preimage in X" (its tooltip says what is shaded and drawn); it keeps its place beside the title (the role
shortens first) and gives way before the title itself would (fitTitle). On a phone Y's title chip says "Shaded in X
(the inset)" (or "Drawn in X …", "Shaded and drawn in X …") once a target exists, in place of "Draw a target in the
w-plane", and the inset pulses once when a preimage first appears. The roots' readings stay in their chip. Files:
`src/app.js` (updateCalcChip, targetText, targetNote, fitTitle, idleRight), `src/phone.css` (`.ph-pulse`). Test:
ux165 "V01 phone …", "UX20 laptop: the target's note …".

**UX80 · done (restores "nothing covers uninvited").** Messages are placed by `placeToasts` (an observer on the toast
host, and on resize): on a laptop above the chain (and above the deformation's transport), centred between X's and
Y's button columns and no wider than the room between them (they wrap to a second line); on a phone above the chain
bar, right of the inset and left of the plane's keys, or above the inset where that room is under 200 px. Files:
`src/app.js` (placeToasts, the observer), `src/desk.css` (`#toastHost[data-placed]`). Test: ux165 "UX80 …".

**UX77 · done.** Details (was Why) starts folded on every size; the user's choice is still remembered. The welcome's
lead and Details no longer repeat each other. Files: `src/tour.js` (strip build, setWhy defaults, welcome copy).
Test: ux165 "UX77 …", t_ux165.

**UX90 · done.** Welcome lead: "Practice freely: what you draw here is cleared at the end." Details: "… What you draw
during the tour is cleared when it ends, and your own work comes back exactly as it was." The first-run line no
longer promises "your work is kept". Test: ux165 "UX90", `tour_cmd.js` welcome check, t_ux165.

**UX78 · done.** «Дальше автоматически». Test: ux165, t_ux165.

**UX93 · done.** The tour is «Обучение» in every string (24 strings; `notes/i18n/GLOSSARY.md` 1.13 updated by the
first run: the audit's wording, which the user's "build all the recommended options" approves); the welcome title is
«Добро пожаловать»; phone tool tiles in Russian are whole words on one line: short forms where the name is wider than
a 58 px tile («Окружн.», «Прямоуг.», «Многоуг.», «Полупл.», «Пересеч.», «Серед. перп.», «Ортогон.»), never a hyphen.
The phone's tool row along the bottom too: Polygon is «Многоуг.» on one line there (it was «Много-угольник» on two),
and the More key shows the lit tool's short form. Files: `src/app.js` (buildTools: `data-phl` on the tool and its
label), `src/phone.js` (two lines: the More tile and the More key read `data-phl`), `src/phone.css` (the row shows
`data-phl` through `::after`, so the label's text, which tests and readers use, keeps the full name). Test: ux165 "UX93 …"
(tiles and the tool row), t_ux165.

**UX89 · done.** A tap on the tour strip that closes an open layer (the function list, a sheet, a menu) does nothing
else: Details stays folded and the countdown runs on. The next tap opens Details as before. File: `src/tour.js`
(closedByTap). Test: ux165 "UX89 …" (phone, real taps).

**UX60 · done.** Video is always in the export dialog's formats. With the deformation off, choosing it turns the
deformation on and the dialog opens again on Video ("A video records the deformation: it is on now."); with an empty
chain it is disabled with that reason. Files: `src/figure.js` (format row), `src/app.js` (Figure.attach: canDeform,
deformOn). Test: ux165 "UX60 …".

**UX70 · done differently.** Hear the function is the first row of the sound settings, with one line ("Notes as you
move the pointer over X: round a zero they rise, round a pole they fall."; "as you drag" on touch), and the long text
is under a folded "How it sounds" (with a disclosure caret). It stays off by default. While it is on, the Sound
button (and the phone's speaker) shows a small wave. Kept the name "Hear the function" rather than "Hear F": it is
the user's own term and the tour's (five tour strings name it). Files: `src/page.html` (#sndPop markup and CSS),
`src/app.js` (sndSync). Test: ux165 "UX70 …".

**UX71 · done.** The listening chip says "Listening along Line 1" and has a Stop button (44 px on a phone; tooltip
"Stop listening Esc"). This is the chip that is there today; wave 2's D3/D10 move it into the context bar or pane
head. Files: `src/app.js` (updateDraftChips, listenChipMsg), `src/phone.css`. Test: ux165 "UX71 …".

**UX72 · done.** "Listen along it" under "Integrate F along it" in a Shapes row's ⋯, and (fourth run) a "Listen
along it" button in the selected curve's editor under its fields (laptop Shapes list and the phone's Shapes sheet, where
it is a 44 px button: the way in without a long press on a thin line). With sound off it offers to turn it on. The
phone's selection bar (D3) and the Inspector following the selection (D4) are wave 2's; they can reuse the same
call (`sndListenAsk(s)`). Files: `src/app.js` (shapeRow menu, shapeEditor). Test: ux165 "UX72 …" (row menu; the
editor on a laptop with real clicks; the phone sheet with real taps).

**UX73 · done (from the code; not heard).** A pointer move no longer ends Listen along: it plays to its end, Stop,
Esc or another action, as the melody already did. File: `src/app.js` (sndMove). `test/sound_cmd.js` expected the old
behaviour; its check now says the move does not end it. `test/sound_clicks_cmd.js` has a "listenStop" timing case
that still moves the pointer: it now measures a playback that is not stopped (not run here; please check it in the
sound gate). Test: ux165 "UX73 …".

**UX74 · done.** The sound example is marked ♫ in Examples ("With sound"). Opening it shows a Try line in the learning
lane ("Try: press Listen, or right-click the spiral and choose Listen along. [Listen] [×]"; the example's name goes
first where the line has no room), which stays until it is played or closed or the example is left (it went after
9 s). The line is shown before the example's plane is fitted, so the spiral is whole under it. Files: `src/app.js`
(openGallery, loadExample, sndPieceHint, sndListenShape), `src/tour.js` (lane). Test:
ux165 "UX74 …".

**UX87 · done.** The Sound settings caret is 26 px, apart from the Sound switch, with its own rounded outline. File:
`src/page.html`. Test: ux165 "UX87 …".

**UX88 · done.** The engine line is under a folded "Diagnostics"; the keyboard paragraph is hidden on touch screens;
Hear the function's description is one line (above). File: `src/page.html`. Test: ux165 "UX88 …".

**UX97 · done in part.** ⌘D (Ctrl D) duplicates the selected shape; the arrows move it by one step of the drawn grid
(Shift: ten; a focused plane's sound probe keeps its arrows); ⌘] / ⌘[ bring it forward / send it backward; Alt+← /
Alt+→ on a focused chain card move that step left / right (the card keeps the focus); in the
deformation K plays or pauses and Shift+← / → go to the previous or next step's tick. The keys show in the row menu
(⌘D, ⌘], ⌘[) and in the play button's tooltip (K). Not done: Tab through shapes (a plane takes the focus only while
sound is on today; making planes focusable belongs with the plane piece), letters for the construct tools (they need
a conflict check with the plane piece's new tools), and P's second meaning in the deformation (left as is). Files:
`src/app.js` (keydown, chainKey, duplicateShape, nudgeShape, morphTick, modK). The card's ⋯ does not show Alt ← / Alt →
yet: its Move left / right lines sit next to the chain piece's new "Replace…" item, so the merge adds `key: 'Alt ←'` /
`key: 'Alt →'` there. Test: ux165 "UX97 …".

**UX99 · done.** A right click on a chain card or a Shapes row opens its ⋯ menu at the pointer (mouse only; a phone's
long press keeps its meaning). A delegated listener, so makeCard and shapeRow are untouched. File: `src/app.js`.
Test: ux165 "UX99 …".

**UX102 · done.** In the deformation a draw tool's chip says "Drawing is off in the deformation (M)." with a "Turn off
and draw" button that turns the deformation off and keeps the chosen tool. File: `src/app.js` (updateDraftChips).
Test: ux165 "UX102 …".

**UX103 · done.** The readout is "Step 1 of 3 · f₂ · 84 %", the step's function named as its tick names it (d/dz for a
derivative step), t in its tooltip; all at once, "All steps at once · 84 %". The deformation's title is "Deformation
from z to w" (was "z → w deformation"); Russian speed «0,5×». Not done: the ticks as named segments with the active
one lit (wave 2's D11 redraws the bar). Files: `src/app.js` (morphReadout, syncTransport, buildDock, the pane titles).
`test/deform_range_cmd.js` read the length from the old readout; it now reads the scrubber's max;
`test/mv_views_cmd.js` and `test/deform_nat_cmd.js` read the new words. Test: ux165 "UX103 …".

**UX104 · done.** The play button's tooltip follows its state (it kept "Pause"): the button now writes its data-tip,
which the tooltip reads, instead of a title the tooltip had already copied. File: `src/app.js` (setPlayIcon,
buildDock). Test: ux165 "UX104 …".

## Second run (what the first run had left wrong)

- The tour's Sound chapter went to "NaN / div" in X (`tour_auto_cmd.js` "Strings: two laps" failed): an example's
  fit kept X's bottom clear of the style bar by measuring the bar from the plane, and with the bar in the pane head
  that measure took the whole plane. `exFitBarPx` now measures the bar only while it is on the plane, so the
  examples' views are exactly as before (48 px). Check: ux165 "UX20: … an example's fit stays finite".
- The phone's folded key glyph showed the head's words ("cell 0.5") over it after a laptop layout: placeKeys now
  removes them when the key goes back to the plane.
- Y's head at 1366: the note "Preimage shaded in X" and the key chip were cut ("Preimage shaded i…", "cel…") and the
  title could vanish. Now the key chip is never cut, the note is short and whole, and it gives way before the title.
- The first-run line was cut mid-sentence on a laptop and a phone ("…watch it…", "…functions an…"): laneFit.
- The note's tooltip showed HTML tags (it used fxHtml); it now uses plain words.
- The readout gained the step's function (the audit's "Step 1 of 3 · √ · 84 %"), and a wording for "all at once".
- The empty chain's call to action moved from over Y to Y's head (part of UX20 the first run had missed).
- The sound settings' "How it sounds" and "Diagnostics" had no disclosure caret; they have one now.
- `test/ux165_learn_cmd.js`: each namespace starts from a cleared state (a rerun found the previous run's state), and
  two checks read `dataset` objects that do not serialise.

## Third run (2026-10-26/27: checked again in the running app, Chrome 156)

- UX20: with the chain empty, Y's title read "w = z imag…" at 1366: the title was fitted before the "Add function"
  button had its words. Now the button is filled first and the title is fitted with it in place ("w = z image").
  Check: ux165 "UX20 laptop: with "Add function" in Y's head the title and its role are not cut".
- UX93: the phone's tool row along the bottom still said «Много-угольник» on two lines in Russian (only the More
  sheet's tiles had the short forms). Now «Многоуг.», one line, aligned with the others. Check: ux165 "UX93 Russian
  phone tool row …".
- UX97: steps can be reordered from the keyboard (Alt+← / Alt+→ on a focused card), the one part of the finding's
  "nothing reorders steps" that was missing. Check: ux165 "UX97: Alt+→ …".

## Fourth run (2026-10-27: the gates, Chrome 156)

- UX74: opening "In the Hall of the Mountain King" pushed the top of its spiral out of X (by 21 px at 1440 × 900):
  the plane was fitted to the example, then the Try line took its room in the docked slot. `loadExample` now shows the
  line first (`sndPieceHint(true)`, before `applyLayout` and the fit; Listen finds the melody's shape when pressed), so
  the fit has the line's room already taken. Check: `seasong_cmd.js` "desktop: the whole spiral in the plane".
- UX72: the selected curve's editor has "Listen along it" (above), the part the earlier runs had left to wave 2.
- Tests brought to the moved controls (intended changes, nothing else in them changed): `mv_views_cmd.js` opens the
  plane's Display options with a real click before it checks Phase's style control and Landscape's colouring (UX20);
  `seasong_cmd.js` reads the spiral's point again after the melody played, since the Try line leaving the slot gives
  the planes their room back and the spiral moves with its plane (UX74).
- The third run's `sound_cmd.js` "failure" (`Failed to deserialize params.x`) was the harness: its section 16 runs
  `sound_deform_cmd.js`, which reads `CMW_PORT`, and that daemon had none, so it opened another port. Run with
  `CMW_PORT=9884 CMW_BASE=http://localhost:9884/` set for the daemon, it runs through.
- Russian: `--strict` is at 0 unresolved (the stopgap below).

## Fifth run (2026-10-27, from 09:30: the gates)

- No change to `src/`: the build is byte-identical to the fourth run's last build (rebuilt and compared), so the gates
  the fourth run passed on that build stand (marked "fourth run" below).
- `test/deform_range_cmd.js` brought to two intended changes (nothing else in it changed): its `title()` reads the
  deformation's title in words ("Deformation" + "from z to w", UX103) as "z → w", so the maps it names are still
  compared with the reference build; and before the reference build's (v16m.html) frame is taken, its key box over Y
  is hidden, since that key now sits in Y's pane head (UX20). The frames differed only there (the box at the plot's
  top right, 116 × 53 px); the maths drawing was identical.

## Russian

`notes/i18n/ru/v165-ux-learn.json` (74 strings of this piece, and one stopgap below), registered in
`tools/make_ru_table.py` as `V165_HERE`, read after every v16.4 table. `python3 tools/make_ru_table.py --strict`:
0 unresolved; `t_i18n_keys.js` passes.

The stopgap (`help.deformation.snap`, not this piece's string): `notes/i18n/ru/v164-help.json` (the Help's
Deformation paragraph) was edited on 2026-10-26 by the v16.4.1 release work (`work/xv1641`) for its newer `app.js`
wording, while this tree's `app.js`, like the merge snapshot's, still has the older sentence, so it was the one
unresolved call site. The entry is the snapshot's own Russian for the older sentence (copied from
`work/xv164-merged-snap/src/i18n_ru.js`). Once the release's `app.js` is merged it is an orphan: the merge may drop it.

## Goldens and perf

No golden image, perf baseline or `accepted.json` was changed, and none is affected: the quality suite reads
`#canvasR` only, and the keys this piece moved (UX20) are DOM boxes with their own small canvases (`legendCanvas`,
`legendCanvasL`), never drawn into the plane; the maths drawing and the exported figures are unchanged. Nothing here
was timed by a perf suite after the user's rule of 2026-10-27; CI's perf gate will measure the two new layout calls
(`placeKeys`, `placeToasts`), which run on resize and on a new message, not per frame.

## For the merge

- `notes/tour/INTEGRATION.md`: the first run added the `leftOpts` anchor line there (X's Display options button,
  `#leftFoot .opts-btn`); t_tour.js reads it. It is this piece's line: keep it when merging.
- `src/phone.js`: one line (the tile label reads `data-phl`). xu1-phone owns this file.
- `src/app.js` `buildTools`: a block after the loop (Russian short tile names). The plane piece's new tools would need
  a short form only if their Russian is wider than 58 px.
- `src/app.js` card and row menus: UX99 uses a delegated `contextmenu` listener and clicks the card's own ⋯, so the
  chain piece's new ⋯ items (Replace…) appear there automatically.
- `src/app.js` `fitTitle(side, noNote)`: a second argument (Y's head note gives way before the title). The plane
  piece's mode chips (D10) go into the same head and should be counted the same way.
- `src/tour.js`: the suggestion is now a lane line. Wave 2's D7 (Continue the tour, an example's Try line, the chapter
  menu) should use `laneShow`. `Tour.lane` is public.
- `src/desk.css`: the pane head is `position: relative; z-index: 11; overflow: visible` on a desktop (for the key's
  dropdown). The plane piece's mode chips (D10) go into the same head.
- Toasts: any new message is placed by `placeToasts` automatically.
- `exFitBarPx` (app.js): if another piece moves X's style bar, the fit measures it only while it is on the plane.
- `src/app.js` `shapeEditor`: one block at its end (UX72, the "Listen along it" row). The plane and rail pieces edit
  this function too (Make free, railing); the block is independent of theirs.
- `src/app.js` `loadExample`: two lines before `applyLayout()` (the Try line first, then `onPaneResize()` when it was
  shown) and `sndPieceHint(early)`; a piece that changes how an example opens should keep the line before the fit.
- Tests changed for this piece's intended changes (merge them with the other pieces' edits of the same files):
  `deform_range_cmd.js` (title in words; the reference build's key hidden for the frame; the length from the
  scrubber), `deform_nat_cmd.js`, `mv_views_cmd.js`, `seasong_cmd.js`, `sound_cmd.js`, `perp_cmd.js` (the Russian
  tile «Ортогон.»), `tour_cmd.js`, `tour_auto_cmd.js`; new `ux165_learn_cmd.js`, `t_ux165_learn.js`.
- `notes/i18n/ru/v165-ux-learn.json` `help.deformation.snap`: the stopgap for the older Help sentence; drop it once
  the release's `app.js` is in.
- Not for the merge: `test/learn_cdp/` (this piece's copy of the CDP kit and its screenshots) and `test/learn_scratch/`
  (scratch scripts and logs). `test/regress/export/out/` is `export_cmd.js`'s output, as in the main tree.

## Results

Build: `python3 build.py` (byte-identical to the fourth run's build); the published page has no test hooks (`__cmw`:
0). Browser suites in the daemon on port 9884 (Chrome 156, headless, ANGLE Metal), one browser.

- `python3 tools/make_ru_table.py --strict`: 0 unresolved (1830 call sites).
- `mv_views_cmd.js`: pass (fourth run, this build).
- `seasong_cmd.js`: pass (fourth run, this build).
- `tour_phone_cmd.js`: 2261 / 2261 (fourth run, this build).
- `export_cmd.js`: pass (fourth run, this build).
- `deform_nat_cmd.js`: pass (fourth run, this build).
- `ux165_learn_cmd.js`: 67 / 67 (laptop 1366 × 768 and 1440 × 900, phone 412 × 860 with touch, 915 × 412, 360 × 780).
- Node: all 36 `test/t_*.js` pass (exit 0): among them `t_ux165_learn.js` 109 checks, `t_tour.js` 1720 / 1720 (the
  `leftOpts` anchor is in this tree), `t_tour_engine.js` 11 / 11, `t_i18n_keys.js` 5735 checks (1830 keys),
  `t_i18n.js`, `t_i18n_english.js` (977 outputs byte-identical), `t_sound.js` 151 / 151, `t_seasong.js` 66 / 66.
- `tour_cmd.js`: 96 / 96.
- `tour_auto_cmd.js`: 75 / 75.
- `perp_cmd.js`: pass (the Russian phone tile now reads «Ортогон.», whole, on one line: UX93).
- `touch_cmd.js`: pass (its BUDGET60 frame checks included).
- `v15_desktop_cmd.js`: pass (dragging a shape: p95 13.6 ms, limit 16.7).
- `v15_phone_cmd.js`: pass.
- `phone_swap_cmd.js`: pass.
- `constr_cmd.js`: pass.
- `zp_cmd.js`: pass.
- `sound_v152_cmd.js`: pass.
- `sound_cmd.js`: pass (with `CMW_PORT=9884` set for the daemon, so its section 16 runs `sound_deform_cmd.js` here; the tracker-cost check passed this time).
- `i18n_cmd.js`: 94 / 94.
- `i18n_walk_cmd.js`: the Russian walk through 10 tour chapters at 1440 finds no English left (n 0, no errors).

## Sixth run and closing summary (2026-10-27, from 14:30)

- No change to `src/`: the last edit there is 04:59 (`app.js`) and 09:32 (`i18n_ru.js`, regenerated with identical
  bytes). Rebuilt now: `dist/complex-map-workbench.html` and `dist/test.html` are byte-identical to the fifth run's;
  the published page has no test hooks (`__cmw`: 0). No browser suite was run (the user's rule of 2026-10-27).
- `python3 tools/make_ru_table.py --strict`: 0 unresolved (1830 call sites; `src/i18n_ru.js` unchanged).
- Unit tests, `node test/t_*.js` one by one: 36 / 36 exit 0, among them `t_ux165_learn.js` (109 checks),
  `t_tour.js` 1720 / 1720, `t_tour_engine.js` 11 / 11, `t_i18n_keys.js` 5735 checks, `t_sound.js` 151 / 151.

All 22 findings of this piece are built. The three that restore the user's rules came first: UX21 (the first-run
invitation is one line in the tour's docked slot, laptop and phone), UX20 + V01 (keys and one-time notes left the
picture for chips in the pane head; the plane's options are behind its Display options button there; the phone's
"Shaded in X (the inset)" and the inset's single pulse) and UX80 (messages land above the chain, between the planes'
button columns on a laptop and above the chain bar on a phone). Built differently, with the reason above: UX70 (the
name "Hear the function" kept). Built in part: UX97 (no Tab through shapes, no construct-tool letters, P left as is;
the card ⋯'s Alt ← / Alt → labels wait for the chain piece's menu). UX73 is checked from the code and a browser test,
not by ear. Screenshots: 70 in `notes/ux-build/shots/w1-learn/` (light, dark, Russian); UX87 and UX88 are visible in
the `ux70-*-sound-*` pair, UX90 in `ux77-*-welcome-*` and `ux93-after-ru-welcome`; UX78's words are inside the folded
Details (checked by ux165 and t_ux165, no picture); UX73, UX89 and UX97 change behaviour only. No golden, perf baseline or `accepted.json` changed or affected. The `leftOpts` line in
`notes/tour/INTEGRATION.md` belongs to this piece (its anchor is in this tree's `src/tour.js`), so the other pieces'
expected `t_tour.js` failure goes away when this piece is merged. Clean-up: no browser daemon or server on port 9884,
no headless Chrome running, no Chrome profile folder (`test/learn_cdp/chprof-*`) left.

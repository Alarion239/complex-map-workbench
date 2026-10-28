# Wave 1, the phone piece: as built

Built in `work/xu1-phone` (a copy of the v16.4 merge snapshot `work/xv164-merged-snap`). The user's request
(2026-10-26): build the recommended options and the quick wins, rules first. This piece: UX13, UX24, UX34 (the three
that restore rules), then UX12, UX29, UX68, UX69, UX38, UX62, UX45, UX83, UX49, UX40, UX106, V02, UX17. A first run was
cut off by a usage limit, a second was paused by the user. The third run (2026-10-27, Chrome 156) checked the work in
the app (ux165: 91 of 91), kept it, added the touch wording of the tools' long-press tips (UX17), moved two tour lines
so they merge cleanly with the learning and chain pieces, and ran the suites (below).

Changed files: `src/app.js`, `src/phone.js`, `src/phone.css`, `src/inspector.js`, `src/tour.js`,
`tools/make_ru_table.py` (registers `v165-ux-phone.json`), `src/i18n_ru.js` and `tools/ru_report.json` (generated).
New: `test/ux165_phone_cmd.js` (browser), `test/t_ux165_phone.js` (node), `notes/i18n/ru/v165-ux-phone.json`.
Tests changed: `test/tour_auto_cmd.js` (one pan moved off the new key column, see UX38); `test/tour_audit_cmd.js`
(its palette-layer check and its "every step" list skip the "Palette and keys" chapter where `chapterShown` hides it,
on touch; see UX17).
Shots: `notes/ux-build/shots/w1-phone/<finding>-before|after-<what>[-dark|-ru].png` (before = the v16.4 base build,
`dist/base/test.html`; light and dark; Russian for UX17, UX29, UX40, UX45).

## Findings

**UX13 · done (restores "one screen").** Reproduced: a pinch on the chain bar zoomed the page to 4.96×. Root cause: the
phone page let the browser pinch-zoom everywhere except on the canvases. Now `:root.ph body { touch-action: pan-x
pan-y }` (phone.css): no page zoom from the header, chain bar, tool row, sheets or menus; one finger still scrolls what
scrolls. The canvases keep `touch-action: none`, so a pinch on a plane still zooms the plane. Phone layout only; the
laptop and a tablet in the desktop layout are unchanged. Test: ux165 "UX13 …" (header, chain bar, tool row, sheet
head, sheet body stay at 1×; a plane pinch changes the plane's scale). Shots: `ux13-*`.

**UX24 · done (restores "Undo at the thumb").** A 44 px Undo in every sheet's head, left of × (`phone.js` build:
`els.sundo`, with the tool row's long-press Redo through `undoKey`; enabled/disabled with `#undoBtn`; the head's drag
ignores it). In the Editor sheet, whose head is collapsed, it sits on the editor's title row beside × (phone.css,
`.ihead` padding 96 px). During the deformation (portrait) the tool row's Undo stays at the left end and the transport
starts right of it; below 440 px the "t = …" readout gives way (the scrubber shows t). In a sheet head the keys keep
their size and the title gives way with an ellipsis (Russian at 360 px squeezed the Snap pill). Test: ux165 "UX24 …"
(all four sheets, Undo in a head undoes, 412 and 360 deformation bar, Russian 360 head). Shots: `ux24-*`.
Not covered: phone *landscape*, where the tool row and the transport are hidden under the chain bar (that is UX05, wave
2's D2: "a tool column on the right in landscape with Undo at the bottom"). The sheet heads' Undo works there.

**UX34 · done (restores "tooltips never stick").** Reproduced: after an add through the palette, "Add a function +"
stayed over the plane on the phone, and the + card's tip on the laptop. Root cause: a tip was also shown on keyboard
focus, and the app moves the focus back to + after the palette closes. Now (app.js, the tooltip block): a tip shows on
hover only (the focus path is gone), never for an element that left the DOM or that the mouse already left; it goes on
scroll, on window blur and when its element goes; on touch it shows only on the 450 ms long-press and goes when the
finger lifts (it stayed 1.5 s). Test: ux165 "UX34 …" (phone after add, long-press shows and lift hides; laptop after
add, after a programmatic focus, hover shows, leave hides). Shots: `ux34-*`.

**UX12 · done.** Android Back closes the top layer and you stay in the app: the coordinate pad, the palette or any
popover menu (plane menu, export menu), the tour's chapter menu, the sound settings, a dialog (Export, the guide), a
header popover, a sheet, the More-tools disclosure. `app.js` `A.backLayer()` names the top layer and how to close it;
`phone.js` "Back" section keeps one history entry of ours while any layer is open (`pushState` with `cmwLayer`), closes
the top layer on `popstate`, and gives the entry back (`history.back()`, ignored by our handler) when a layer is closed
inside the app, so Back from the bare app still leaves. A reload standing on our entry turns it back into a plain one.
Only on the phone layout or a coarse pointer; the laptop pushes no entries. Test: ux165 "UX12 …" (seven layers, each
closed by Back with the URL kept; Back from the bare app leaves; laptop palette pushes nothing). No shot (behaviour).
Not done: the audit's "outer 16 px of each plane pan-only" against the edge-swipe Back (that is D9's edge band, wave 2).

**UX29 · done.** Phone palette (`app.js` `phonePalette`, called from the palette's open on `.ph`): a 44 px Cancel at the
right of the search row; the insert position is a 44 px chip on its own row ("Append to the chain ›", "Insert after
f₂", "Insert at the start"): a tap moves it along the chain and keeps the keyboard up; rows are at least 48 px. This is
the row where wave 2's "Replace … with" joins (D1). Test: ux165 "UX29 …". Shots: `ux29-*` (and Russian).

**UX68 · done.** A rotation used to close the sheet. Now (`phone.js` `keepSheet`, used by the layout switch) the same
sheet reopens in the new layout at the same scroll, and the field that had the focus (or the field at the same place
among the sheet's fields, since the Editor is rebuilt) gets it back with its caret. Test: ux165 "UX68 …" (412×915 →
915×412 → back, Editor open, same field focused). Shots: `ux68-*`.

**UX69 · done differently (seen in headless only).** The audit's fix grows the sheet on every focus; that hid the
planes while typing a coefficient (v15_phone_cmd caught it: "X and Y side by side above it, so the image changes as you
type"). Built instead: the app reacts to the keyboard itself. While it is up (the visual viewport shorter than the
window by more than 80 px) the sheet's body gets that much room at its end (`--ph-kb`), and the focused field is
lifted above the keyboard by scrolling the body first (the planes stay in view); only when scrolling cannot do it (a
field low in a short sheet, such as the new Number's name at 360×780) the sheet opens to full height with the field
near the top of its body. It goes back when the keyboard goes or the focus leaves (`phone.js` `kbInit`, `kbHeight`,
`kbFit`; phone.css `.ph-kb`). Headless Chrome has no keyboard, so the test feeds a height through the test-only hook
`Phone._kb(h)` (stripped from the published file). Test: ux165 "UX69 …" (no keyboard: no growth; 330 px keyboard:
the Number's name above it, the sheet full; keyboard gone or field left: back; the Editor's coefficient above a 260 px
keyboard). Shots: `ux69-*` (checked against this build on 2026-10-27: the Number's name at 360 with a 330 px keyboard
opens the sheet to full height; the Editor's coefficient above a 260 px keyboard is lifted by a scroll and the sheet
keeps its height). **Needs a check on the Android phone.**

**UX38 · done.** The plane's keys are one fixed column at the bottom right in every view (Sphere, Display, Fit, an
empty slot where a view lacks one); keys and legends of the picture stay at the top right (phone.css, UX38 block;
Landscape draws no ruler, so its column is lifted by the ruler's 14 px to keep the same place on screen). Wave 2 puts
Both (D8) on top of this column. Test: ux165 "UX38 …" (X→Y, Y large, Phase, Landscape: same positions; 915×412 both
planes at the same height). Shots: `ux38-*`.
Test changed: `tour_auto_cmd.js`, "phone: a touch in X folds Why and reaches the app", started its pan 60 px from the
right edge and 160 px from the bottom, which is now on the Sphere key (Chrome's touch adjustment took the touch to the
key, so the plane did not pan). The pan now starts 160 px from the right edge (one line, with a comment). A pan that
starts on a key does nothing, as before at the top.

**UX62 · done.** The transport shows the chosen speed only; a tap on it now moves on 1× → 2× → ½× → 1× (`phone.js`
init: a capture click on `.tdock #speedSeg > button.on` clicks the next speed). Test: ux165 "UX62 …". Shots: `ux62-*`.
(Wave 2's D11 two-row bar can keep it.)

**UX45 · done.** Shapes list in the sheet: rows at least 48 px, the description on its own line under the name, eye
and ⋯ side by side, 44 px each, 4 px apart, 16 px gutter at the right edge (phone.css). Test: ux165 "UX45 …". Shots:
`ux45-*` (and Russian).

**UX83 · done.** "No shapes" on a card picture is drawn only where it fits (`app.js`, the thumbnail's empty text,
`measureText` against the picture width): the phone's 44 px pictures show the axes alone; the laptop's keep it. Test:
ux165 "UX83 …" (counts the canvas text on both). Shots: `ux83-*`.

**UX49 · done.** With a construction tool, a finger on something it picks (point, crossing, curve; `Construct.snapAt`)
picks it when it lifts, however long it was held; over empty space the long press still opens the plane's menu
(`app.js`, the touch long-press in the pane pointer handler: `cPick`). Test: ux165 "UX49 …" (700 ms on z₀ with
"3 points" picks it, no menu; 700 ms on empty space opens the menu). Shots: `ux49-*`.

**UX40 · done.** Taught where people look, never on the plane: a tip line at the end of the More tools sheet ("Tip:
hold a finger on the plane until the ring fills: its menu adds a point or a zero there, and hides or deletes the shape
under your finger.", `phone.js` fillTools), the zeros-and-poles editor's hint on touch ("Or hold a finger on X until
the ring fills: its menu adds a zero or a pole right there. …", `inspector.js`), and the tour's "Add a zero here" step
in touch words (hold until the ring fills, lift, choose). Test: ux165 "UX40 …". Shots: `ux40-*` (and Russian).

**UX106 · done, small effect in the default scene.** On a portrait phone the Landscape camera is fitted to the block's
corners as the default camera sees them, to the width and to the height, never farther than the old bounding-sphere fit
(`app.js` `landFitDist`, used where `GLR.fitDist` was). In the default scene the block is long and the width binds, so
the surface grows only from about 71 % to 75 % of the plane's width; a squarer block (a zoomed-out view, as in the
audit's shot) gains more. Every other pane keeps the sphere fit. Test: ux165 "UX106 …" (the surface spans most of the
width; this check also passes on the base, so it guards against a regression, not the gain). Shots:
`ux38-*-landscape-view-412*`.

**V02 · done.** The ⋯ sheet lists the links, scene files and LaTeX as its own rows (Copy link to this figure, Save
scene, Open scene…, Copy/Save LaTeX), no key hints, and "… again" only once a figure was made (`app.js`
`exportMenuItems`, split out of `openExportMenu`; `phone.js` fillMore). Test: ux165 "V02 …". Shots: `v02-*`.
(Wave 2's D6/D12 regroup this sheet; the items come from one list, so they follow.)

**UX17 · done for the guide and the tour; in part for other in-app text.** Chosen by the tour's touch check (a coarse
pointer):
- Guide (`app.js` `GUIDE_TOUCH`, `guideTouch`, called from `openGuide`): every paragraph that names a desktop place or
  gesture is replaced by a phone version (bottom row, chain bar, the sheet, tap, hold until the ring fills); a line on
  where the deformation's controls are; the Keys section is left out.
- Tour (`tour.js`): touch copy for every step that named a click, the Inspector, a key, the lens or dragging a card;
  new step fields `titleTouch`, `leadTouch`, `touchByScene` (the engine's `leadFor`, `stepTitle`, `copyFor`); the
  "Palette and keys" chapter has `desk: true` and is not offered on touch (`chapterShown`: the menu, `seek`, "Continue
  the tour").
- Other in-app text (small, same check): the Region editor's note, the residue example's blurb, the Integrate toast,
  the Hear-the-function spoken line, the sphere's idle hint ("Tap to place a point; two fingers turn").
- A tool's long-press tip on touch (third run): no key letter ("Point P" was meaningless on a phone), and the four
  descriptions that said click in touch words (Point, Polygon "Tap the vertices; tap the first one to close.",
  Intersect, Touching circle). `app.js` `setupTooltips`: `TOUCH_DESC`, chosen when the tip was opened by a touch
  long-press; the `TOOLS` rows and `Construct.toolRows()` are untouched (other pieces edit next to them). The laptop's
  hover tip keeps its key and wording.
- Not done: the construction toasts and warnings in `src/construct.js` ("Click a line or a circle.", "Click a point
  on …", "Click a crossing …"). The plane piece rewrites exactly those lines (`A.toast` → `pickWarn`), so a change here
  would conflict; the merge (on the plane piece's lines) or wave 2 should give them the same
  `touch ? $t('Tap …') : $t('Click …')` treatment (construct.js already has `chipTouch()`).
- Note: the guide's touch text names the phone's places (bottom row, sheets). A coarse-pointer tablet in the desktop
  layout gets the phone words for places too; the gestures are right there, the places are not. Wave 2's D7 guide
  could split places (layout) from gestures (pointer).
Tests: `t_ux165_phone.js` (the chapter, seek, lead/title/scene copy on touch, no desktop words in any touch copy, the
Russian of every new string), ux165 "UX17 …" (phone guide in English and Russian, no Keys, tour menu without Palette
and keys, laptop keeps both; the Point tool's long-press tip says tap and has no key, the laptop's hover tip keeps
"D"), `t_tour.js`. Shots: `ux17-*` (and Russian; `ux17-*-longpress-tip-*` for the tool tips).

## Russian

All new strings are in `notes/i18n/ru/v165-ux-phone.json` (registered in `tools/make_ru_table.py` as `V165_HERE`, read
after every v16.4 table). `python3 tools/make_ru_table.py --strict`: 0 unresolved. Em dashes carry the no-break space
(`t_i18n`). The other pieces add their own `v165-ux-*.json` names to `V165_HERE` when they merge.

## Tests run (third run, 2026-10-27, headless Chrome 156 on port 9882, a fresh daemon per suite)

Other pieces ran their own headless Chrome on the same machine at the same time, so timing checks had less headroom.

- `test/ux165_phone_cmd.js`: 91 of 91 on the final build (laptop 1366 × 768; phone 412 × 860, 360 × 780, 412 × 915 and
  915 × 412 with Android emulation and Input.dispatchTouchEvent). Run it on a fresh daemon (the pinch checks come last).
- Node: every `test/t_*.js` passes (`t_ux165_phone` 18/18, `t_tour_engine` 11/11, `t_i18n`, `t_i18n_keys`,
  `t_i18n_english`, `t_i18n_parse`, `t_cyr`, `t_constr`, `t_sound`, `t_zp`, …) except `t_tour.js` 1737/1738: the
  expected "documented anchor leftOpts has a default" (another piece's INTEGRATION.md line).
- `python3 tools/make_ru_table.py --strict`: 0 unresolved.
- Browser: `v15_phone_cmd` pass; `phone_swap_cmd` pass; `touch_cmd` 90/90; `zp_cmd` pass; `constr_cmd` 115/115;
  `perp_cmd` 117/117; `seasong_cmd` pass; `sound_v152_cmd` pass; `i18n_cmd` 94/94; `i18n_walk_cmd` at 1440: no English
  left (n = 0); `v15_desktop_cmd` pass; `tour_cmd` 96/96.
- `split_cmd`: 91 pass, 1 fail, the same on the base build (see the reviewer notes: its tour title selector).
- `export_cmd`: all pass but one timing check, "video globe: no main-thread task of 50 ms or more" (one task of 54 ms,
  with another piece's Chrome busy at the time); this piece does not touch the export or the video.

Fourth run (2026-10-27, after the restart; the same build, `dist/` from 05:13; a fresh daemon on port 9882):
- `deform_range_cmd`: pass, 0 fails (sections 1 to 9, against `dist/v16m.html`).
- `tour_phone_cmd`: 2165 of 2165 (skipped: views/key on a landscape phone, the engine's known skip since v15).
- `tour_auto_cmd`: 75 of 75 (with the one moved pan, see UX38).
- Quality suite (`test/regress/quality/run.sh --no-build --base-url http://localhost:9882`): PASS, 81 runs, 0 failed (28
  improved, 35 unchanged, 18 new); targets 259 met, 0 not met; `baseline.json` and the golden PNGs untouched (compared with the base).
- glsl-test (`dist/glsl-test.html`, the same page as before this piece): 585 chains, 6.34 M values compared, 0 fails,
  singular 0 bad, 3451 range rows.
- `tour_audit_cmd`: started at 11:11 and cut off at about 12:05 with the run, after 32 of its 56 size/theme/language/
  input runs (360, 390, 844 × 390 and 768 × 1024 done; 1024, 1152 and 1440 not reached; `test/phone_cdp/progress.log`,
  partial measurements in `test/phone_cdp/audit/strip.json`). No pass count was recorded. It is a browser suite; under
  the user's rule of 2026-10-27 (unit tests only) it was not run again and is left to CI.

Final run (2026-10-27, 14:30; unit tests only, as the user asked). `src/` is the same as for the runs above: the
code files last changed at 05:13; `src/i18n_ru.js` was regenerated at 09:55 with the same table (2518 entries, equal to
the table in `dist/test.html`).
- `node test/t_*.js` (36 files): 35 pass; `t_tour.js` 1737/1738, the expected "documented anchor leftOpts has a
  default" only. `t_ux165_phone` 18/18, `t_tour_engine` 11/11.
- `python3 tools/make_ru_table.py --strict`: 2518 entries, unresolved 0 (the table it writes is byte-identical).
- No browser daemon or server was left on port 9882; no Chrome profile folder (`test/phone_cdp/chprof-*`) is left.

## Goldens and perf

None changed. The quality suite renders desktop scenes only (`mobile: false`), and every visual change here is behind
the phone layout (`.ph`) or a coarse pointer, except UX83's text test (unchanged at laptop thumbnail sizes) and UX34
(tooltips, not in any render). UX106 changes only a portrait phone's Landscape camera, which no golden covers. No perf
baseline, `accepted.json` or golden image was touched.

## For the reviewer and the merge

- `src/tour.js` new step fields (`titleTouch`, `leadTouch`, `touchByScene`, chapter `desk`) are not documented in the
  shared tour notes; the merge should add a line to the tour's step-field list (notes/tour/DESIGN.md or
  INTEGRATION.md, whichever lists step fields). No new anchors or events.
- `t_tour.js` fails only "documented anchor leftOpts has a default" here, as expected (another piece's INTEGRATION.md
  line).
- The phone Editor sheet's title row is 44 px shorter (Undo beside ×): a long step name truncates earlier at 360 px
  ("Zeros an…", «Нули и п…»). The sheet heads' title shrinks with an ellipsis before the Snap pill or Undo do.
- Back (UX12) uses the History API; please try it on the Android phone: system Back and the edge gesture, with a sheet,
  the palette, Export and the guide open, then Back from the bare app (it should leave).
- UX69 needs the real phone too (the keyboard).
- `phone.js` `Phone._kb` is inside the TEMP-DEBUG-HOOK block (gone from the published file; checked: no `_kb`,
  `__tourApi` or TEMP-DEBUG-HOOK in `dist/complex-map-workbench.html`).
- Trial merge (2026-10-27 05:00, `git merge-file` of my `src/` with each other piece as it stood, base
  `work/xv164-merged-snap`): clean with the plane, learning and rail pieces in every file; with the chain piece
  `inspector.js` is clean and two real overlaps are left:
  - `app.js`, the Integrate command with no curve (about line 6730): the chain piece (V03) rewrote the lines; I made
    the first toast touch-aware. Keep the chain piece's lines and put my touch toast in its first `toast(…)`:
    `touchUI() ? $t('Draw a curve or a region first: hold a finger on a curve, then choose Integrate.') : $t('Draw a
    curve or a region first: right-click a curve to integrate along it.')`.
  - `tour.js`, the lens step of "Editing" (`touch:` and the try's `touch:`): both pieces replaced "the lens"; take the
    chain piece's two lines (its button is "Show alone"). My t_ux165 check (no "lens" in touch copy) holds for both.
  Re-run on 2026-10-27 after the restart (the other pieces as they stand now): the same two overlaps with the chain piece,
  nothing new; `tools/make_ru_table.py` conflicts with every piece, since each registers its own table on the same
  lines (`V165_HERE`, `V165_CHAIN_HERE`, `V165_PLANE_HERE`, `V165_RAIL_HERE`; the learning piece also uses `V165_HERE`).
  Resolve with one set read once: `V165_HERE = {'v165-ux-phone.json', 'v165-ux-chain.json', 'v165-ux-plane.json',
  'v165-ux-learn.json', 'v165-ux-rail.json'}` and the loop's last term `... if p.name in V165_HERE`.
  The chain piece renames the guide's section "Shared numbers" to "Numbers": the phone guide finds a section by either
  name (`GUIDE_TOUCH` keys `Shared numbers|Numbers`), so its two touch paragraphs still apply after the merge (ux165's
  "phone guide has no desktop places" check would catch a miss).
  I avoided two more: the Phase key step's `touch:` line now sits above its `body:` (the learning piece rewrites the
  `try:` line), and the "Add a zero here" step keeps the base's short try line on touch (the chain piece renames the
  next step; the step's touch body still teaches the ring).
- `split_cmd.js` fails one check, "tour: the offer shows only at its stop", on the base build too (same result on
  `dist/base/test.html`): its selector for the step's title (`.tour-card h2`, …) finds nothing in the docked strip, so
  every title reads null. Not caused by this piece; the test needs the strip's title selector.
- The merge should also take the two `test/tour_audit_cmd.js` lines (the "Palette and keys" chapter skipped on touch),
  or the audit's touch runs will open a chapter the touch tour no longer offers.

## Closing summary (2026-10-27)

All 16 findings of this piece are built: UX13, UX24, UX34 (the three that restore rules), UX12, UX29, UX68, UX38,
UX62, UX45, UX83, UX49, UX40, UX106, V02 done; UX69 done differently (the sheet makes room for the keyboard and lifts
the field instead of growing on every focus, so the planes stay in view); UX17 done for the guide, the tour, the tools'
long-press tips and a few in-app lines, with construct.js's "Click …" toasts left to the merge or wave 2 (the plane
piece rewrites those lines). Nothing contradicts wave 2: Undo in the sheet heads and the deformation bar, the palette's
position chip row (D1's Replace joins it), the key column (D8's Both goes on top), the ⋯ sheet's single item list
(D6/D12) and the speed button (D11) are the places wave 2 builds on. No golden, perf baseline or `accepted.json`
changed. Unit tests pass (only the expected `t_tour.js` leftOpts line fails) and `make_ru_table --strict` has 0
unresolved. Left for the user on the Android phone: Back (UX12) and the keyboard (UX69). Left for the merge: the two
overlaps with the chain piece (`app.js` Integrate toast, `tour.js` lens step), one `V165_HERE` set in
`tools/make_ru_table.py`, the tour's new step fields in the tour notes, and the `tour_audit_cmd.js` lines.

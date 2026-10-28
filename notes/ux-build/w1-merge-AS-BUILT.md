# Wave 1 merge: as built

Built in `work/xu1` (the base `work/xv164-merged-snap` + the five pieces); snapshot `work/xu1-merged-snap/`. How it was
merged, the conflicts, the results: `notes/ux-build/W1-MERGE.md`. Each finding is as its piece built it (details,
files and browser tests in `w1-<piece>-AS-BUILT.md`); this lists its state in the merged tree, and what the merge
added where two pieces met.

## Findings, by piece

**learn** (`test/ux165_learn_cmd.js`, `test/t_ux165_learn.js`). Done: UX21, UX20, V01, UX80 (the three that restore
rules), UX77, UX78, UX93, UX89, UX90, UX60, UX71, UX72, UX73, UX74, UX87, UX88, UX99, UX102, UX103, UX104. Done
differently: UX70 (the name "Hear the function" kept). In part: UX97 (no Tab through shapes, no construct-tool letters,
P left as is). The merge added: UX97's Alt ← / Alt → in a card's ⋯ (app.js `stepMenu`); UX97's arrow step is the drawn
grid's (`nudgeShape` through rail's `Constr.gridStep`); UX93's short Russian tile for plane's new tool («Гиперб.»,
`buildTools`); UX20's title in Y's head no longer vanishes with plane's tag (`fitTitle`, `.notag`).

**chain** (`test/ux165_chain_cmd.js`, `test/t_ux165_chain.js`). Done: UX01 (restores a rule), UX16, UX23, UX32, UX81,
UX82, UX84, UX85, UX22, UX79, V03, UX25. Done in part differently: UX03 (a command row does not light its control; D6),
UX33 (no "‹ Sheet 0 of 2 ›" stepper), UX65 (no "a=" chip: the no-chips rule). The merge added: UX85's name in the
phone guide ("Show alone", app.js `GUIDE_TOUCH`); UX81 and learn's UX97 are one key in `chainKey`.

**plane** (`test/ux165_plane_cmd.js`, `test/t_ux165_plane.js`). Done: UX15, UX14, UX09, UX44, UX48, UX51, UX55, UX56,
UX100, UX101, UX92, UX95, UX27, UX37, UX66, UX86; UX10 and UX67 (each without one small extra: the image point in the
phone's inset; the square-root example pointing to the sheet stepper). Done differently: UX91 (a once-per-session
toast), UX105 (ruler labels stay turned). Look only: UX94 (moves that snap are rail's, done there). UX52: now done in
full, the merge routed rail's "needs distinct points" through `pickWarn` (construct.js `click`, `globeClick`).

**rail** (`test/ux165_rail_cmd.js`, `test/t_ux165_rail.js`). Done: the user's bug ("needs distinct points" with two
points on one circle: `samePick`/`dupPick`, real `refKey`s), T1–T10 (snapping to the unit circle, the axes, curves,
crossings and the half grid; sliding with 15° detents; the pull that frees; attaching at the drop; Alt; Esc and a second
finger; the antipodal diameter), moves that snap (UX94), the sphere. Done differently: five points of its SPEC, listed
in its AS-BUILT. The merge added: `snapZ` reads plane's `ptrTouch` first (as rail asked).

**phone** (`test/ux165_phone_cmd.js`, `test/t_ux165_phone.js`). Done: UX13, UX24, UX34 (the three that restore rules),
UX12, UX29, UX68, UX38, UX62, UX45, UX83, UX49, UX40, UX106, V02. Done differently: UX69 (the sheet makes room for the
keyboard). UX17: now done for the construction refusals too, the merge gave plane's lines touch words ("Tap a line or
a circle." etc., construct.js, `chipTouch()`) and emptied the ⌘/Ctrl keys of menus on touch (`modK`).

## The merge's own changes

Files: `src/app.js` (`snapZ`, `nudgeShape`, `modK`, `stepMenu`, `buildTools`, `fitTitle`, `GUIDE_TOUCH`, and the
resolved hunks), `src/construct.js` (the refusals, the resolved hunks), `src/page.html` (`.notag`, `#snapBtn`),
`src/tour.js` (resolved hunk), `tools/make_ru_table.py` (one `V165_HERE`), `notes/i18n/ru/v165-ux-merge.json` (new, 6
entries), `notes/tour/INTEGRATION.md` (the wave 1 section), `test/t_ux165_learn.js` (reads the one set). New tests:
`test/t_ux165_merge.js` (41 checks: every resolution and every merge change), `test/ux165_merge_cmd.js` (the look:
laptop and phone, English and Russian, light and dark; 15 of 15, no console error), `test/ux165_merge_shots_cmd.js`.
Pictures: `notes/ux-build/shots/w1-merge/`.

## Goldens and perf

None changed or affected (no piece's, nor the merge's).

## For the reviewer

The points under "For CI and the reviewer" in `W1-MERGE.md`: the browser suites to run on the merged build (rail's
ux165 with plane's `handleAt` first), the doubled "needs distinct points" (ring label and chip), Y's untagged title
with an empty chain at 1366, the phone menu's "⌫", and Back and the keyboard on the Android phone.

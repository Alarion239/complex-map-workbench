# Wave 1, the plane piece: as built

Built in `work/xu1-plane` (a copy of the v16.4 merge snapshot `work/xv164-merged-snap`). The user's request
(2026-10-26): build the recommended options and the quick wins. This piece: UX15, UX14, UX09, UX44, UX48, UX51, UX52,
UX55, UX56, UX100, UX101, UX91, UX92, UX94 (look only), UX95, UX10, UX27, UX37, UX66, UX67, UX86, UX105. None of them
is marked "restores" in the audit. Four runs were cut off (a usage limit, the user's pause, then twice a stop before
the results were written); each later run checked the earlier work in the running app, kept what was right and fixed
what was half done (listed under "Second run", "Third run", "Fourth run" and "Fifth run"). The fifth run (2026-10-27,
Chrome 156) changed no app code, ran every gate and wrote the results at the end, one gate at a time.

Tests: `test/ux165_plane_cmd.js` (browser, 99 checks: laptop 1366×768 with mouse and keys, phone 412×860 and 915×412
with Android emulation and real touch events through `Input.dispatchTouchEvent`; English and Russian) and
`test/t_ux165_plane.js` (node). Screenshots: `test/ux165_plane_shots_cmd.js` writes them; they are in
`notes/ux-build/shots/w1-plane/` (`<finding>-…-before|after-light|dark.png`, before = a build of the v16.4 snapshot;
`ru-…` Russian).

## Findings

**UX15 · done.** While a construction has picks of its own, Undo (the button, ⌘Z, the phone's Undo at the thumb)
removes the last pick, as Backspace does, never earlier work, and a toast says what went ("Undid the pick: Line 1",
"Undid the last pick" for an empty spot). The curve kept from the last circle and a P carried after a tangent are no
picks of the new draft: Undo then undoes that construction as usual. Undo is enabled while the draft has picks.
Files: `construct.js` undoPickable, undoPick (exported); `app.js` updateUndo, draftUndoable, the undoBtn handler,
renderOverlays (keeps Undo's state current). Test: ux165 L15, P51 (phone).

**UX14 · done.** Polygon: Undo and Backspace remove the last point (the draft goes with its last point), Enter
closes (as before). On the phone the chip sits at the left, clear of the plane's round buttons, on two lines when it
needs them (third run: the longer touch text ran under the globe button). The close radius is 24 px for a finger, 12 px for a mouse (was 9 px for both), on the plane and
the globe. The chip says it in the pointer's words: "Tap the first point to close · Undo removes the last point" on
touch (never "Enter"), "Click the first point or press Enter to close · ⌫ removes the last point" with a mouse; the
tool tip adds "Backspace removes the last point." Done and Cancel are D3 (wave 2). Files: `app.js` polyDraftOpen,
polyBack, updateDraftChips, editDown and globeDown (close radius), the keydown handler, `ptrTouch` (set in onDown);
`page.html` CSS `:root.ph :is(#draftChipL, #draftChipR):not(.cm-on)`.
Test: ux165 L14, P14.

**UX09 · done.** With a finger, handles are drawn 12 px (7 px with a mouse) and grabbed within 22 px, the nearest
winning (zeros and poles already did this); a handle wins over a move or a pan; lines and curves are picked within
18 px (7 px with a mouse). Before the first press a coarse pointer counts as a finger. Files: `app.js` fingerNow,
handleAt (new), drawHandles, onDown (zeros-and-poles handle test), editDown (handle loop, pick tolerance). Test:
ux165 P09.

**UX44 · done.** A complex point field (a centre, a vertex) takes the editor's full width and shows 4 significant
digits until clicked into, then the full value to edit; it goes back to 4 digits on blur when unchanged. Number fields
show 4 significant digits the same way. Figures are tabular. Files: `app.js` shapeEditor (ptField, numField),
`page.html` CSS `.shape-edit > .field.cxf`. Test: ux165 L44.

**UX48 · done.** The construction chip says what to pick in one plain sentence, then the count, the tool and how to
back up: "Pick a point or an empty spot · 1 of 3 · 3 points · Esc cancels", "Pick where two curves cross, or the first
curve · 1 of 2", "Pick the boundary: a line or a circle", "Pick the touching point on Circle 1, or a ring for a
tangent · 2 of 2"; once the draft has picks the keyboard tail is "⌫ undo pick · Esc"; on touch there is no keyboard
tail (the × and Undo). A small ? unfolds the tool's how-to inside the chip; with a mouse it sits beside the words
(third run: it fell alone onto a line below two lines of words). The count and the keys never break
inside (each part after the sentence is kept whole). Files: `construct.js` chipText, howTo, syncChip, CSS (`.cm-chip
… > .cm-t { flex: 1 1 0 }` for a chip of words and ? only). Test: ux165 L48, LAY; constr_cmd, perp_cmd, touch_cmd (chip texts updated).

**UX51 · done.** On touch the chip's choices are words, each at least 44 px wide, the ×, the curve token's × and the
? take 44 × 44 taps; the chip may take two lines rather than drop words (with a mouse the words also stay until the
text needs more than two lines). On touch the × sits beside the words on the first line and the choices on the second; between the lines (8 px
apart) the choices' 40 px taps win over the ×'s 44 px tap, so a finger a little high on Outside never cancels the
construction (third run: perp_cmd J7 found the × taking taps 18 px above Outside).
Files: `construct.js` syncChip, CSS (`.cm-tch`). Test: ux165 P51, LAY.

**UX52 · done (except one message, see merge notes).** A refused pick ("Click a line or a circle.", "Click a crossing
of two curves, or a curve.", the touching circle's refusals, "Draw in X to use …", the parallel lines) is said in the
construction chip in the warning colour for 2 s, by the pointer, not as a toast at the bottom; where no chip shows it
is a toast. A tool change clears the chip's message and removes the construction's last toast ("built from … drag
those", "stays fixed"). Not done: showing "built from … drag those" next to the dragged point (it stays a toast,
cleared with the tool). Files: `construct.js` pickWarn (new), click, globeClick, finishMeetCross, toolChanged.
Test: ux165 L48; perp_cmd A11, touch_cmd A10.

**UX55 · done.** A seventh Construct tool, Hyperbolic line (tile "Hyperbolic", icon: a faint boundary circle with an
arc and two points): pick the boundary, then two points; it makes the Perpendicular circle with only its arc on the
points' side. Its results, and any one-sided perpendicular circle made with the chip on Inside or Outside, are named
"Hyperbolic line N" (def.nk 'hyper'; v16.4 files with nk 'arc' keep "Arc N"). One definition sentence in the row and
the Inspector ("hyperbolic line inside Circle 1, through z₀ and z₁"). The Orthogonal chip offers the Inspector's three
choices, Whole | Inside | Outside (Outside: the arc on the other side). On a 1024 px rail that would overflow, the
Hyperbolic tile leaves the rail last (it stays in the drawer and in ⌘K). Files: `construct.js` CTOOLS, NEED, CURVE1,
toolName, toolShort, toolRows, ICON.hyper, finish (the sign rule), kindLabel, nameKind, genKind, defText, SEG_ICON.out,
fitRail + CSS `.cm-tight4`, the `seg` setter; `app.js` kindLabel, nameKind, rowName. Test: ux165 L48, L55, RU;
`t_ux165_plane.js` (Inside/Outside on the real graph: 900 pairs on a circle, a disc and a line); perp_cmd I1, I7, J6,
J7, D 1024 updated.

**UX56 · done.** A point under the right-click is the menu's subject: "Select z₀ / lies on Circle 1", Hide z₀,
Delete z₀, then the curve's integral, the construction items with names ("Make z₀ free"); no "Add point here" over a
point. Files: `planemenu.js` (shape items, Add point here), `app.js` planeMenuApi.shapeAt (points first, `on`),
`construct.js` menuItems (Make {x} free), hitShape (points first). Test: ux165 L56.

**UX100 · done.** After a circle, the kept curve shows in the chip as a token "on Circle 1 ×"; its × un-picks only
the curve (the tool stays); clicking another line or circle replaces it, as before. Files: `construct.js` syncChip,
curve1Name (memoised: the chip reads it every frame), finish/finishTouch (keptC). Test: ux165 L48.

**UX101 · done.** Two parallel lines: "These lines are parallel: they meet only at ∞" (in the chip). A crossing whose
lines became parallel keeps a hollow marker with an arrow and "∞" at the plane's edge where each line leaves it
(overlay only). Files: `construct.js` finishMeetCross, drawInfMarks (new), drawOverlay. Test: ux165 L101.

**UX91 · done differently.** The cell still refits (the drawing does not change), and the first time a shape refits
it in a session a toast says so: "The pattern cell is now 0.1, fitted to the shapes; Display → Cell changes it."
(the legend chip is being reworked by the learn piece, UX20, so the words went to a toast, once). Files: `app.js`
patternCell, addShape (cellSay, cellSaid). Test: ux165 L86.

**UX92 · done.** It was a bug: a formula region has no box (Region.bboxOf null), so every formula was "unbounded".
A formula region is now bounded when no point of it lies on two far circles (radius 10³ and 10⁵, 4096 directions);
|z+1| < 1 has no note, a strip still has it. The note reads "Goes on forever; drawn faded towards the edge." Files:
`app.js` formulaBounded (new), shapeEditor. Test: ux165 L86.

**UX94 · done (look only).** Laptop: the Snap button carries the word "Snap", accent-filled when on, outlined when
off. Phone: Snap in More tools is a switch ("Snap ●"). The first run had also made moves snap (and Alt free on handle
drags); that code was removed here, since moves that snap belong to the rail piece: the tooltip stays "Snap while
drawing (both panes)". Files: `page.html` (#snapBtn markup and CSS), `phone.css` (.ph-snap). Test: ux165 L86, P51,
LAY.

**UX95 · done.** "Tap the first point to close" on touch (UX14); "Goes on forever; drawn faded towards the edge."
(UX92); colours by name (Blue, Orange, Teal, Pink, Green, Purple, Olive, Slate) instead of "Preset 1–8"; pattern names
wrap to two lines ("Sphere checker", "Square grid"); the phone's Display sheet calls its regions section "Regions"
(no second "Display"); "Clear shapes" left one shape's ⋯ (it stays in the Shapes heading). Files: `app.js` colorName,
shapeRow menu; `page.html` (.pat CSS, #secDisplay heading). Test: ux165 L86, P51.

**UX10 · done.** One readout in X while the pointer is over it: "z = …  |z| …  arg …" and on a second line
"w = F(z) = …"; also with X expanded. Where it does not fit, |z| and arg take fewer digits, then go (third run: the
fit was judged by scrollWidth, which rounds, so at 1366 × 768 the first line was 0.4 px too long and ended in "…"; it
is now measured to the sub-pixel, and the 1366 laptop shows "|z| 0.943  arg −57.99°" whole). The key's "=" and parentheses are set in
STIX. On the phone the chip at rest teaches "Hold and slide to read F(z)" until the first hold-and-slide (remembered
in localStorage 'cmw-probe-learned'), then shows the scale only; the probe shows both lines with no doubled z. What
floats below X's readout (the draft chip, a narrow plane's legend) starts below its two lines at all times, so nothing
moves when the pointer comes and goes. Files: `app.js` setReadouts, probeTeach, idleLeft; `page.html` CSS
(`.rln`, `#plotL > .empty-chip`, the narrow legend); `phone.css`. Not done: marking the image point in the phone's Y
inset. Test: ux165 L10, P10, LAY.

**UX27 · done.** One name per plane: titles "X · z-plane  domain of F" and "Y · w = F(z)  image"; the canvases'
names "X, the z-plane: domain of F" and "Y, the w-plane: image of F"; Shapes headings "In X (z-plane)" and "Targets in
Y (w-plane)", and under it "No targets yet. Draw one in Y (the w-plane)." (third run); "Draw a target in Y (the
w-plane)"; on the phone the big plane's chip is tagged X (Y after a swap).
Files: `app.js` paneTitles, buildShapeList, idleRight; `page.html` (aria-labels); `phone.css` (::before tags). Test:
ux165 L10, P10, RU.

**UX37 · done.** "Plane | Sphere" in words at every width (a narrow pane drops the icons, never the words; 28 px
tall). Files: `page.html` CSS (#leftTabs, #rightTabs). Test: ux165 L10.

**UX66 · done.** With Select, a double-click on empty X or Y zooms ×2 about that point (Shift: out); it never turns a
branch cut (the cut moves by its red handle only). Files: `app.js` setupPane (dblclick), emptyAt (new). Test: ux165
L66.

**UX67 · done.** A step with sheets reads "k ‹ 0 of 2 › Show all sheets", as the audit has it (third run: the ‹ was
after the field, "0 ‹ of 2 ›"): ‹ › step through the sheets (wrapping for a root), Show all sheets opens Landscape
with All sheets on. Not done: the square-root example pointing
to it. Files: `app.js` paramField (`before`, the ‹ ahead of the field), showAllSheets (new); `page.html` CSS
(.sheet-ctl, .pair > .sh-prev, 44 px on the phone). Test: ux165
L67.

**UX86 · done.** One name per role: the tool "Line grid", the pattern "Square grid", the Phase style "Pulled-back
grid". Files: `app.js` TOOLS rows, PATTERNS, DC_STYLES. Test: ux165 L86.

**UX105 · done differently in part.** Inputs use JetBrains Mono (round parentheses, a tight decimal point; added to
the Google Fonts link) with tabular figures. The rulers' labels use the UI face ("0.5", not "0. 5") and an imaginary
label's i is set in the maths italic, so the turned "2i" no longer reads "21". The labels stay turned: the vertical
ruler is 18 px wide, and horizontal labels would need about 36 px, which would shrink every plane. The rulers are not
part of any golden render (the quality suite reads #canvasR only). Files: `page.html` (font link, --f-input, .inp);
`app.js` drawRulers, imLabel (new). Test: ux165 L44 (input font); screenshots ux105-ruler-* ("−21" before, "−2i"
after), ux10-laptop-* and ux44-fields-* (the input font).

## Second run (what the cut-off run left half done)

- Moves that snap and Alt on handle drags removed (rail piece); the Snap tooltip back to the base text; the unused
  Russian string dropped.
- The Snap button was broken (the word under the icon, cut): it is one line now.
- X's two-line readout ran under the construction chip; the chip and the narrow legend now sit below both lines.
- The readout's "F(z)" read "F[z]" in B612 Mono: its "=" and parentheses are STIX now.
- The chip broke "Esc / cancels" across lines and put the touch × on a third line: fixed.
- The 1024 px rail overflowed with the seventh tile: the Hyperbolic tile leaves it last.
- Russian chip strings "на кривой {c}" (a name after a noun in the nominative) rewritten as "на кривой: {c}" /
  "(на кривой: {c})", as the v16.3 strings do.
- constr_cmd, perp_cmd and touch_cmd updated where they assert the old chip text, six tiles, toasts for pick refusals,
  two segment choices and "Arc N" names (all intended changes); one perp_cmd click moved below the (now two-line) chip.

## Third run (2026-10-26/27)

Everything the second run built was checked in the running app (ux165: 93 checks pass on its build) and kept. Fixed:

- UX10: X's readout ended in "…" at 1366 × 768 (a 0.4 px overflow that scrollWidth rounds away); the fit is measured
  with a Range now, and a middle form (|z| to 3 places, arg to 2) keeps |z| and arg on the laptop.
- UX14: on the phone the polygon chip ran under the plane's globe button; it now sits at the left, two lines at most.
- UX48: with a mouse the chip's ? fell alone onto a third line; it sits beside the words.
- UX27: "No targets yet. Draw one in the w-plane." now names Y as well.
- UX67: "0 ‹ of 2 ›" read oddly; it is "‹ 0 of 2 ›" as the audit has it.
- UX51: on the phone the ×'s 44 px tap covered the top of Outside's (perp_cmd J7); the choices win between the lines.
- perp_cmd A10 clicked the 3-point circle where the Orthogonal chip now has its second line (Whole | Inside | Outside):
  the click went to Inside. The test now picks its points clear of the chip (a test change, not an app change).
- Screenshots: two scenes took empty or cut pictures (the Display patterns were scrolled out of view; the unbounded
  note was cropped off); fixed in `test/ux165_plane_shots_cmd.js`, and every picture taken again.

## Fourth run (2026-10-27)

The third run stopped before it wrote its results; its screenshots were still in `test/plane_cdp/shots/w1p/` and the
notes folder was empty. This run changed no app code. It checked the build in the running app (ux165: 99 of 99
checks, laptop, phone and 915 × 412, English and Russian), re-ran the gates (below), took the "after" pictures again
for every scene whose code changed after the third run's pictures (the construction chip: ux15, ux48, ux51, ux55,
ux56, ux101, ru-hyper; also ux10, ux14, ux67), and copied all of them to `notes/ux-build/shots/w1-plane/`.
Test-only: the browser gates that hard-code another port (`export_cmd.js` 8793, `sound_v152_cmd.js` 8832) were run
from copies pointed at this piece's port 9883; the files in `test/` are unchanged.

## Fifth run (2026-10-27, 09:28 to about 12:00)

No app code changed: the build is byte-identical to the fourth run's. Ran every gate (Results), checked the two
near-limit frame numbers with an A/B against the base build on one browser (same as base), checked split_cmd's one
fail on the base build (same fail), took the three missing before close-ups (UX27/37, UX94, UX105; the ruler crop
fixed to include the labels), and did a trial merge with the four other pieces (below). Test-only change:
`test/ux165_plane_shots_cmd.js` (the ruler crop). For the lead: the five pieces share one scratchpad folder, and a
command file with a common name (`glsl_cmd.js`) was overwritten by another piece's (it ran that piece's port 9882);
the GLSL gate was run again from this piece's own file. Nothing else was affected (the daemon's queue holds what ran).

## For the merge

- **xu1-rail:** `construct.js` "{x} needs distinct points" (click, globeClick) was left as `A.toast` here because the
  rail piece rewrites those lines; for UX52 the merged line should call `pickWarn(…)` instead of `A.toast(…)`. If the
  rail piece makes moves snap, it may want the Snap tooltip "Snap while drawing and moving (both panes)". This piece
  replaced the handle loop in `editDown` and the zeros-and-poles `onSel` test with `handleAt(pane, sel, x, y)` (UX09:
  22 px for a finger): a rail change to handle grabbing should go into handleAt.
- **xu1-phone:** `phone.css` changes `#leftReadout::before` / `#rightReadout::before` to the X / Y tags and adds the
  two-line readout grid; `.ph-pill.ph-snap` is a switch.
- **xu1-learn:** UX91 and UX15 speak through `toast()`; wherever UX80 moves toasts, these follow.
- **Tour:** no step lights, names or waits for a control this piece renamed or moved (Plane | Sphere keep their ids;
  the tour's sphere step already says "Sphere"). Nothing to add to notes/tour/INTEGRATION.md.
- **Russian:** `notes/i18n/ru/v165-ux-plane.json`, registered in `tools/make_ru_table.py` as V165_PLANE_HERE (read
  after every v16.4 table). `test/t_i18n.js` no longer expects 'Domain plane' and 'Image plane' in the table (no source
  holds them now).
- Test hooks added to the test build only: `window.__cmwDraft`, `window.__cmwHandles`.

**Trial merge (fifth run).** `git merge-file` of this piece's `src/` with each other piece as it stood on 2026-10-27
at 09:30 (base work/xv164-merged-snap) leaves 8 conflicts; everything else merges cleanly (phone: none). All are real
overlaps, and each keeps both sides:

- chain, `app.js` `paramField`'s return: keep chain's `worded` class and `paramWord`, and this piece's `before`
  element first in `.pair` (`h('div', { class: 'pair' }, before, input, extra)`).
- learn, `app.js` `paneTitles` (right title): keep learn's worded "Deformation from z to w" line as theirs; put this
  piece's `YT +` (the "Y · " tag) in front of the four other right titles in their wording.
- learn, `app.js` `idleRight`: keep learn's phone target line, then this piece's "Draw a target in Y (the {x}-plane)".
- learn, `app.js` shape ⋯ menu: keep learn's `duplicateShape` and key labels, with this piece's `colorName(i)` in
  place of "Preset {x}" (UX95).
- learn, `app.js` `shapeEditor`'s unbounded note: keep this piece's test (`&& !formulaBounded(s)`, UX92), its
  wording and `data-unb`, then learn's "Listen along it" block.
- rail, `construct.js` meet-tool click: keep rail's test (`t.cls !== 'curve' || !t.ref`) with this piece's
  `pickWarn(…)` in place of `A.toast(…)` (UX52).
- rail, `construct.js` exports: the union (rail's `cancelDrag`, `globeSlide`, `globePoint`, `touchNow`, `altNow`,
  `samePick`; this piece's `undoPick`, `undoPickable`).
- rail, `page.html` `#snapBtn`: rail's tooltip and aria-label with this piece's `<span class="snap-w">Snap</span>`
  after the icon (UX94; the CSS for `.snap-w` and the on/off look is in this piece's `page.html`).

## Goldens and perf

No golden image, perf baseline or `accepted.json` was changed, and none is affected: the drawing of the maths is
unchanged (rulers are outside every golden capture; the quality suite passes, Results). BUDGET60: touch_cmd F "drag
T" rAF work p95 measured 14.7 ms once in the fourth run and 13.1 / 13.7 ms in the fifth run's gate while five pieces'
browsers ran at once (limit 14); on a quiet machine, alternating with the base build on one browser, it is 10.9 ms
here against 10.6 ms for the base (median of four), and v15_desktop's shape drag 10.6 against 10.8 ms. No perf change
from this piece; the near-limit numbers come from machine load.

## Results

Fifth run (2026-10-27, from 09:28, Chrome 156). No app code changed since the fourth run: `python3 build.py` gives a
`dist/test.html` byte-identical to the fourth run's build (04:28). Results are written here as each gate passes.

- `python3 tools/make_ru_table.py --strict`: 2518 entries, 1843 call sites, 0 unresolved.
- Node tests, all `test/t_*.js` (36 files): all pass except the expected one: `t_tour.js` 1715/1716, "documented anchor
  leftOpts has a default" (another piece's INTEGRATION.md line, see the task). `t_ux165_plane.js` 23/23,
  `t_constr.js` 288/288, `t_i18n.js` 21832, `t_i18n_keys.js` 5789, `t_tour_engine.js` 11/11.
- `test/ux165_plane_cmd.js` (this piece; laptop 1366 × 768, phone 412 × 860 and 915 × 412 with touch, English and
  Russian): 99 of 99 checks, 0 page errors (103 s).
- `test/constr_cmd.js`: pass, 115 checks, 0 fails.
- `test/perp_cmd.js`: pass, 117 checks, 0 fails.
- `test/touch_cmd.js`: pass, 90 checks, 0 fails. BUDGET60 "drag T" rAF work p95 13.1 and 13.7 ms in its two runs
  (limit 14), "drag P" 4.4 ms; see the A/B below.
- `test/zp_cmd.js`: pass, 0 fails (drag frames 60.1 fps).
- `test/split_cmd.js`: 91 pass, 1 fail, "tour: the offer shows only at its stop": the test's selector for the tour
  step's title (`.tour-card h2`, …) finds nothing in the docked strip, so every title reads null; the phone piece
  found the same fail on the base build. Not this piece's (checked on the base build below).
- `test/v15_desktop_cmd.js`: 1 fail, "dragging a shape: p95 frame ≤ 16.7 ms" (18.5 ms; dragging a zero 16.1 ms). The
  test says this ad-hoc scene measured 14.8 to 16.4 ms on its own base; five pieces' headless browsers were running at
  once (load average 25). Judged by an A/B on the same browser below.
- `test/v15_phone_cmd.js`: pass, 0 fails.
- `test/phone_swap_cmd.js`: pass, 0 fails.
- `test/i18n_cmd.js`: 94 of 94.
- `test/i18n_walk_cmd.js` (Russian walk, 10 chapters, 1440): 0 English left, 0 errors.
- `test/export_cmd.js` (a copy pointed at port 9883): pass, 0 fails, 307 files, 80 figures.
- `test/seasong_cmd.js`: pass, 0 fails.
- `test/sound_v152_cmd.js` (the daemon started with CMW_PORT=9883): pass, 0 fails.
- `test/deform_range_cmd.js`: pass, 0 fails.
- `test/tour_cmd.js`: 96 of 96.
- `test/tour_audit_cmd.js` (first try): the browser stopped answering in its 11th run (390 × 844, light, Russian,
  mouse; no CPU in its processes for 17 min, while five pieces' browsers ran at once); the daemon was restarted with a
  fresh profile and the audit run again after the other gates (below).
- A/B on one browser, the base build (`dist/base-test.html`, a build of the snapshot) and this build alternating, four
  runs each, after the other pieces' browsers had stopped (load average 3.8): touch_cmd F "drag T" rAF work p95, median
  10.6 ms base / 10.9 ms here; v15_desktop "dragging a shape" GPU-synchronised frame p95, median 10.8 ms base /
  10.6 ms here, "dragging a zero" 8.7 / 8.8 ms. So the two near-limit numbers above came from the load, not from this
  piece. (Scripts: the scratchpad copies of the two scenes; not added to `test/`.)
- split_cmd section 13 alone on the base build and on this build: the same fail, the same values (every title null,
  the offer shown at the third step). Not this piece's.
- `test/v15_desktop_cmd.js` again, at normal load: pass, 0 fails (dragging a shape p95 12.0 ms, a zero 8.6 ms).
- `test/tour_phone_cmd.js`: 2261 of 2261 (skipped: views/key on a landscape phone, the engine's known skip since v15, listed by the test as
  skipped, not failed).
- `test/tour_auto_cmd.js`: 75 of 75.
- GLSL pages, rebuilt from `src/` (`test/make_glsl_test*.py`; their inputs are the base's, byte for byte):
  glsl-test 585 chains, 6.34 M compared, 0 fails, singular 0 bad; glsl-test-adv 612 chains, 8.67 M compared, 304
  fails, the known count in the same 10 chains since v15.2.1 (v16.4's README has the same).
- Image-quality suite (`test/regress/quality/run.sh --no-build --base-url http://localhost:9883`): 81 runs, 0 failed,
  28 improved, 35 unchanged, 18 NEW (the base's own new scenes), 259 targets met; RESULT: PASS. No baseline or golden
  touched.
- Before close-ups that were missing (X's head with its title and Plane | Sphere, the Snap button, the ruler) taken
  on the base build; the ruler close-up's crop now includes the labels (`test/ux165_plane_shots_cmd.js`, a test-only
  change): `ux105-ruler-before` shows "−21", `-after` "−2i". All in `notes/ux-build/shots/w1-plane/` (101 pictures).

## Sixth run and closing summary (2026-10-27, from 14:30)

No app code changed: `src/` is as the fifth run left it (newest source change 01:05; `src/i18n_ru.js` regenerated
with the same 2518 entries and the same size). Per the user's rule of 2026-10-27, only the unit tests were run:

- `python3 tools/make_ru_table.py --strict`: 2518 entries, 1843 call sites, 0 unresolved.
- All 36 `test/t_*.js`: pass, except the expected `t_tour.js` 1715/1716 ("documented anchor leftOpts has a default",
  another piece's INTEGRATION.md line). `t_ux165_plane.js` 23/23, `t_tour_engine.js` 11/11, `t_constr.js` 288/288,
  `t_i18n.js` 21832, `t_i18n_keys.js` 5789.
- No browser daemon or server was alive on port 9883; no Chrome profile folder is left in `test/plane_cdp/` (the
  empty `chprof-*` folders in the Caches mirror were deleted).
- Not recorded: the second `tour_audit_cmd.js` run (the fifth run's first try hung under load). Not run now; it is
  left to CI.

Summary. All 22 findings of this piece are built: 18 done (UX10 and UX67 each leave one small extra, listed under
them), UX91 and UX105 done differently (a once-per-session toast
instead of a legend line; the ruler labels stay turned), UX52 done except one message that sits in the rail piece's
lines ("needs distinct points": the merge should use `pickWarn`), and UX94 look only (moves that snap are the rail
piece's). No golden, perf baseline or `accepted.json` changed or affected. Reviewer: read "For the merge" (8 known
conflicts with chain, learn and rail, each resolved by keeping both sides), and look at UX55's sign rule
(`construct.js` finish) and UX10's fit measurement (`app.js` setReadouts). The user's later points about snapping and
"needs distinct points" belong to the rail piece; this piece did not touch them.

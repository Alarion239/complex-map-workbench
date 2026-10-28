# Wave 1, piece "rail": as built

Built in `work/xu1-rail` on the v16.4 merge snapshot, from `notes/ux-build/rail/SPEC.md`. Three runs: the first was
stopped before its test runs finished; the second (2026-10-26/27) checked it in the app, fixed the sphere's pull, added
the sphere's Point tool on a curve (SPEC 1.2 c) and the detent tick, but was stopped before it wrote its results; the
third (2026-10-27, Chrome 156) re-checked the user's case on the phone with real taps (it works; a phone section added
to the test), added the one Russian restore line `--strict` needed, and ran the suites but was stopped before it wrote
their results; the fourth (2026-10-27, from 09:30) changed no code, ran the gates on the same build and wrote the
results below, and trial-merged this piece with the four others (see "For the merge"); the fifth (2026-10-27, 14:30)
changed no code, renamed the unit test to `test/t_ux165_rail.js` (the name the task gives), re-ran the unit tests and
`--strict` on the same build and wrote the closing summary.

Files changed: `src/constr.js`, `src/construct.js`, `src/app.js`, `src/sound.js`, `src/tour.js`, `src/page.html` (one
line), `src/i18n_ru.js` (regenerated), `tools/make_ru_table.py` (V165_RAIL_HERE), `tools/ru_report.json` (regenerated);
new `notes/i18n/ru/v165-ux-rail.json`, `test/t_ux165_rail.js`, `test/ux165_rail_cmd.js`; existing tests updated for intended
changes: `test/constr_cmd.js`, `test/perp_cmd.js`, `test/touch_cmd.js` (see "Tests changed"). Pictures:
`notes/ux-build/shots/w1-rail/` (`before-*` from the base build, `after-*` from this one; `before-today-*` are the
spec's reproductions).

## The user's bug first ("needs distinct points, but I do have distinct points!")

**Done.** Cause as the lead found it: `Constr.refKey` keyed every pick on a curve `c:<shape>:<part>` (no position),
and every crossing pick `s:undefined`, and `click`, `globeClick`, `hover` and `touchTarget` refused a pick whose key
equalled an earlier pick's. Fix at the root: one rule, `samePick` / `dupPick` in construct.js — two picks are the same
only when both are points that already exist (z₀ twice). A pick that will become a new point (on a curve, at a
crossing, a free one) is never "the same" as another; instead, while the draft is open, the earlier picks are point
targets (`{pend: i}`, key `pend:i`), so pressing exactly where you already picked snaps to it and is refused with the
warn ring and "… needs distinct points". `refKey` also got real keys for crossings (`m:<two curve keys sorted>:<index
or seed>`) and display curves (`d:<key>`). Checked on the laptop (ux165 E) and, in this run, on the phone with real
taps (ux165 Eph: C = a drawn circle, two taps on it → the circle is made, orthogonal to it through both points; the
shown unit circle, two taps, then two more → two circles on one fixed unit circle). The maths of picks on one curve
(SPEC 3.3) is right as it stands except the antipodal case, fixed (T10 below).

## The findings (SPEC 0, T1–T10)

| id | status | where | test |
|---|---|---|---|
| T3, T4 "needs distinct points": two places on one circle (Perpendicular circle, 3 points) | **done** (above) | construct.js `samePick`, `dupPick`, `snapAt` (pend), `click`, `hover`, `touchTarget`, `globeClick` | ux165 E (laptop: two picks on one circle, twice; 3 points on one circle; a press on the first pick refused), **Eph** (phone, real taps, a drawn circle and the unit circle), t_ux165_rail (keys) |
| T5 every crossing keyed `s:undefined` | **done**: `refKey` gives a meet ref `m:…`, a pending pick `pend:i`, a display curve `d:<key>` | constr.js `refKey` | t_ux165_rail; ux165 E (3 points through three crossings) |
| T1 the Point tool ignores the unit circle and the axes | **done**: the shown unit circle and both axes are curve targets (crossings with a drawn curve, and curves). Used, a display curve becomes its fixed shape in the same undo step, or the plane's shape with that `fixed` is reused (never duplicated); nothing is made on hover | construct.js `DISP`, `dispCurves`, `dispRef`, `snapAt`, `materialize`, `classesFor` | ux165 A (laptop click 3 px off, phone tap 12 px off, the hover chip, one undo step, `|p| = 1` to 1e−15) |
| T2 construction picks on the shown unit circle are free points | **done**: they are points on it; the Perpendicular/Touching circle's C made from a display curve is made first and the picks on it reuse it (`made`) | construct.js `finish`, `refsOfPicks`, `finishTouch` | ux165 E, Eph, touch_cmd A7 |
| T6 a point on a curve never comes off | **done**: the pull (SPEC 2.3): glide < 16 px (touch 24), stretch to 40 (64) with the dashed stretch line, the ghost dot and "Pull further to free z₂", let go at 40 (64) held 120 ms or 80 (128) at once. A still pull is finished by a timer. The point keeps its id and dependents, loses its definition live (one undo step at the release), jumps to the pointer; "z₂ is free" for 1.2 s; sound `detach`. Then it drags as a free point and can attach again | constr.js `RAIL`, `railPull`; construct.js `railDrag`, `letGo`, `drawRail`; app.js `makeFree(id, {live})` | t_ux165_rail (zones, dwell); ux165 C (30 px stretch, 50 px held frees, the chip, the cue, a sweep does not, the finger, one undo step, Undo) |
| T7 dragging a free point never snaps | **done**: a free point's drag (by its body or, selected, by its handle) snaps to crossings, curves (display curves too), zeros and handles, and the grid; over a point shape the warn ring "z₂ is already here" | construct.js `freeDrag`, `handleMove` | ux165 F (exactly 2.5 + 1.5i), D |
| T8 dropping a free point on a curve leaves it free (C22) | **done** (C22 changed on purpose for curves and crossings, kept for points): a drop on a curve makes it a point on that curve, on a crossing the meet point, on a zero or another shape's handle it binds; sound `attach` | construct.js `freeUp` | ux165 D (onto Line 1 after a pull, onto Line 1 ∩ Circle 2, onto z₀: not merged) |
| T9 the grid snaps to whole numbers while it draws halves | **done**: `Constr.gridStep(s)`, gl.js's tiers 0.5, 1, 5, 10, 50, 100 × d0, the finest ≥ 14 px; snapZ uses it, 9 px (12 px for a finger); the small grid ring and "grid point 0.5 + i" | constr.js `gridStep`; app.js `snapZ`; construct.js `snapAt` (class 4), `drawOverlay` | t_ux165_rail; ux165 F (0.5 + i at 52 px/unit, 0.55 + 1.05i at 520) |
| T10 opposite points give a circle of radius 1.6e16 | **done**, both fixes of SPEC 3.4: (1) gliders on C's own plain circle half a turn apart by their parameters (to 2⁻⁴⁰) give the diameter, oriented as the near circles it continues; (2) the turn-exact glide (quarter turns exact, so a detent at i is i) | constr.js `antipodeLine`, `evalNode` perp, `glide`, `turnCS` | t_ux165_rail (20 random pairs on two circles; k/24 and (k+12)/24; 1e−6 turn off is still a circle), ux165 E (30° and 210°: A = 0) |

## The rest of the spec

- **Detents (1.4)**: done. Crossings with other shown curves, the rail's own points (segment ends, a 3-point circle's
  points, polygon corners), every 15° of a plain circle or arc (on the unit circle at 0: 1, i, −1, −i exactly), the
  lattice points on a line; 6 px (10 on touch); only with Snap on and no Alt. Chip "on the unit circle at i",
  "on Circle 1 at 30°". construct.js `detentAt`. ux165 B (at 90° exactly i; Snap off no detent).
- **Moving a whole shape (UX94 "moves snap")**: done. The anchor (the position handle nearest the press) snaps to
  points, crossings and the grid; never binds; Alt raw. construct.js `anchorMove`. ux165 F.
- **Alt (2.4)**: done. Held at the press: free from the first move; pressed during: frees at once; held at the drop:
  no attach. Alt also stops the grid in `snapZ`. ux165 G, A.
- **Esc / a second finger (2.6)**: done. Both go back to the press state (`A.revert`, the last undo step) with no step.
  construct.js `cancelDrag`, `keydown`; app.js the second-finger branch. ux165 H (also: one finger slides again after).
- **Meet points (2.4)**: done. They never slide, the stretch shows past 16 px, the let-go frees them. Midpoints,
  bisectors etc. keep "built from … drag those".
- **The sphere (1.2)**: (a) the distinct-pick fix in `globeClick`: done. (b) a point on a curve slides on the globe and a
  pull frees it: done, by its body (`gmove`) and when it is selected and grabbed by its handle (`ghandle`). (c) the
  Point tool on a drawn curve on the globe: done: `Construct.globePoint` (6 px, 14 for a finger, through app.js
  `globeCurveHit`; points and the marks 0, ±1, ±i still win; display curves are not targets there). ux165 K.
- **Overlay (4.1)**: done: the rail 6 px at 25 % ink, the dashed stretch line 0.35 → 1, the ghost dot, the grid ring
  r = 7 without fill, the free chip; a sliding point shows its chip only. Light and dark tokens only. On the globe the
  free chip is not drawn (the chip is placed with the plane's coordinates); the sound and the point at the pointer say it.
- **Words (4.2, 4.3)**: done; Russian in `notes/i18n/ru/v165-ux-rail.json`. Snap tooltip/aria-label on `#snapBtn` and
  the tablet `#railSnap`; the palette line.
- **Sound (4.4)**: done: `attach` (tines E5, A5 30 ms apart) and `detach` (a felt tap with a pitch drop), Interface
  tier, gap 150 ms. **Measured in this run** with test/sound_lab.js (LUFS-M, as the others): the earlier TRIM guesses
  gave attach −38.3 and detach −41.9 LUFS-M, and detach (a lone skin strike at A4, edge's pitch) lost 7.5 dB through the
  phone-speaker model, so it would be near silent on the user's Android phone. Now detach strikes at E5 (phone loss
  1.0 dB) and TRIM is attach +0.71, detach +0.01: attach −35.0 (2.6 dB under toggleOn's −32.4), detach −39.5 (edge
  −38.7). `test/sound_cmd.js` GROUP gained their bands (attach [−37, −33], detach [−41.5, −37.5]); without them its
  level check fails for any new cue. The `snap` tick (its own switch, off by default) also plays when a sliding point
  catches a detent and at a free point's drop (app.js `cmUiApi().snapTick`, the onUp tick line; construct.js
  `railDrag`). ux165 B.
- **The tour (4.3)**: step construct/meet body and touch rewritten to the new rules within the 240-character,
  3-sentence limit t_tour enforces (the spec's longer wording failed it). Step 'follow' still passes tour_auto. No
  anchor moved.
- **⋯ / long-press menu**: "Mark the intersection", "Point on this curve" and "Perpendicular/Touching circle…" gain the
  display curves; "Put on this curve" (an existing free point) gains them too: the fixed curve is made (or the plane's
  reused) and the point put on it in one undo step (construct.js `menuItems`). ux165 D.
- **The Point tool drags the point it placed (SPEC 6, the user's "place it, then move it around the circle")**: done. A
  Point-tool press on an existing point still selects it and says "z₀ is already here"; a drag from there moves it as
  the Select tool does (slides it on its curve, a pull frees it; a free point drags with snapping). A click alone
  changes nothing. construct.js `pointDown` returns 'existing'; app.js `editDown` sets the move drag. ux165 A.
- **The globe's lattice (1.3)**: the drawing tools' Cartesian snap on the globe (`globeSnap` role 'cart') uses
  `Constr.gridStep` (halves included), as the lifted lattice draws. ux165 K.

## Done differently (and why)

1. **Drawn curves win over display curves** inside a class (the spec said nearest wins; constr_cmd showed a 5 px press
   on Circle 1 ∩ Segment 1 taken by Circle 1 ∩ the real axis 1 px away). The display curves are the background.
2. **Drawing tools do not use the display curves** (their ends snap to points and crossings of drawn curves, as in
   v16.4): a segment drawn from where a line crosses the axis would otherwise add "the real axis" as a shape.
3. **A drop over an existing point lands raw** (not on the grid): on a lattice point it would sit on the other point.
4. **The tour text** is shorter than the spec's (the t_tour limit).
5. **Grid ring only for the Point tool, construction picks and drags** (not on hover with a drawing tool).

## Tests

- New: `test/t_ux165_rail.js` (321 checks), `test/ux165_rail_cmd.js` (A–K and Eph; laptop 1366 × 768, phone 412 × 860 and
  915 × 412 with Android emulation and Input.dispatchTouchEvent; BUDGET60 in J). Section H runs last: in headless
  Chrome a two-finger touch sequence leaves the *next page* without touch events (on the same page one finger works
  again, which H checks). The same holds across command files: **restart the daemon after this file** before a suite
  that taps (this run's first try of the phone check failed for that reason only).
- Tests changed for intended behaviour (each with a comment naming SPEC 2.3/2.4/1.1):
  - `constr_cmd.js` §6: a meet point dragged 30 px no longer toasts "built from …: drag those" (it is in the stretch
    zone of the pull).
  - `perp_cmd.js` I2: the glider dragged past the end of an Inside arc goes 30 px past (stretch zone) instead of 0.6 of
    the radius past (which is a pull and now frees it).
  - `touch_cmd.js` A7 and C: P clicked at 2 on the real axis is now a point on the real axis (one more shape, the fixed
    real axis), so the tangent is Line 3 (Прямая 2 in the Russian scene).

## Results

Build: `dist/test.html` sha1 92ae7435…, `dist/complex-map-workbench.html` sha1 1f3fe9f3…; `src/` last changed 09:29
(i18n_ru.js, regenerated by `--strict`, same bytes). A rebuild at 14:36 gives the same two hashes.

**Fifth run (2026-10-27 14:30, unit tests only, as the user asked):**
- `python3 tools/make_ru_table.py --strict`: 2486 entries, call sites 1811, unresolved 0.
- `node test/t_*.js` (36 files): all pass (t_ux165_rail 321/321, t_constr 288/288, t_tour_engine 11/11, t_sound
  151/151, t_i18n 21 532, t_i18n_keys 5 702, t_i18n_english 977 outputs byte-identical, t_inverse 554, t_zp 160, ...)
  except t_tour 1715/1716: the one expected failure "documented anchor leftOpts has a default" (another piece's
  INTEGRATION.md line; see the task).

**Fourth run (2026-10-27 09:30 to 12:05, same build; recorded here, not re-run):**
- Quality suite (`--no-build --base-url http://localhost:9885`): 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW
  (all the base's own), PASS. No golden changed.
- glsl-test: 585 chains, 292 programs, 6 338 860 compared, failCount 0, errors 0 (nothing it inlines changed here).
- Browser suites, each `pass: true`: constr_cmd 115; perp_cmd 118; touch_cmd 90; v15_desktop_cmd (BUDGET60: zero drag
  p95 12.1 ms, shape drag p95 13.8 ms); v15_phone_cmd; phone_swap_cmd; zp_cmd (drag 60.2 fps, p95 18 ms); seasong_cmd;
  deform_range_cmd; i18n_cmd 94/94; i18n_walk_cmd (10 chapters, 0 English left); sound_v152_cmd; sound_cmd (with this
  piece's attach and detach level bands; it needs `CMW_PORT=9885` in the environment); tour_cmd 96/96; tour_phone_cmd
  2261/2261; tour_auto_cmd 75/75 (step 'follow' included).
- split_cmd 91/92: "tour: the offer shows only at its stop" fails because its title selector (`.tour-card h2`, ...)
  no longer exists in the v16.4 docked strip, so it fails wherever the offer shows. Not this piece (no step of chapter
  'edit' changed).
- tour_audit_cmd: the full 56 runs did not finish (the browser stopped answering after ~45 min under load from other
  pieces' browsers). A subset (8 runs: light; English and Russian; 360 and 844 touch, 1024 and 1440 mouse) wrote its
  rows (`test/rail_cdp/audit/strip.json`, 373 steps, 47 step ids) but its check count was lost when the run was
  stopped. Read from the rows: no strip/pane overlap, nothing cut off, every title fits, every touch button 44 px,
  every text contrast ≥ 4.5. The other 48 runs (the dark ones among them) are left for CI.
- ux165_rail_cmd (this piece's browser test, fresh daemon): 76 checks, 0 failed (A–K, Eph, H); no exceptions or
  console errors. J (BUDGET60: a glider with 10 perpendicular circles dragged round the unit circle): rAF work p95
  4.7 ms, frame interval p95 16.8 ms.

**Goldens and perf numbers:** none affected. No golden, baseline or `test/regress/accepted.json` touched.

## For the merge (with the plane piece, xu1-plane)

**Trial merge (fourth run, 2026-10-27 ~10:30):** `git merge-file` of this piece's `src/` (construct.js, app.js,
page.html, constr.js, sound.js, tour.js) with each other piece as it stands now, base work/xv164-merged-snap: chain,
phone and learn merge cleanly; the plane piece leaves 3 conflicts, the same three its own AS-BUILT lists, each keeping
both sides:
- construct.js meet-tool click (Intersect, the second pick): keep this piece's test `t.cls !== 'curve' || !t.ref` (a
  display curve or a pending pick is not a curve ref) with the plane piece's `pickWarn(...)` in place of `A.toast(...)`.
- construct.js exports: the union (this piece's `cancelDrag`, `globeSlide`, `globePoint`, `touchNow`, `altNow`,
  `samePick`; the plane piece's `undoPick`, `undoPickable`).
- page.html `#snapBtn`: this piece's `data-tip` and `aria-label` with the plane piece's `<span class="snap-w">Snap</span>`
  after the icon.
After the merge, re-run ux165_rail_cmd.js: the plane piece's `handleAt` (UX09, app.js `editDown`) now finds the handle
that this piece's selected-glider drag (`handleMove` → rail) starts from; it merged without a conflict but is untested
together.

- construct.js "needs distinct points" lines: in today's xu1-plane they are still the base lines (`click` uses
  `A.toast`, `globeClick` `A.toast`, `hover` `setRing`, `touchTarget`'s `dup`), so this piece's `dupPick(t)` /
  `dupPick(best)` / `const dup = dupPick` merge as they are. If the plane piece's UX52 later routes the `click` line
  through `pickWarn(...)`, keep this piece's condition with its `pickWarn`. UX55 Hyperbolic line (`hyper`, in CURVE1)
  goes through `finish`'s CURVE1 branch, so it gets `made` and `dupPick` as is; its antipodal case is the diameter by
  `antipodeLine` (`op: 'perp'`; the arc of a diameter inside C is the diameter).
- construct.js `finish`: this piece made the display C first (`made`) and changed the one line
  `if (c1.make) { const C = made[c1.make.fixed] || A.newShape(...) ...}`; the plane piece changed the lines around it.
- construct.js `moveDrag`: the plane piece set `lastToast = A.toast(...)` in its warnings; this piece added the free/
  anchor/rail branches above them and replaced the glider branch.
- `radii(touch)`: this piece made the touch curve radius 14 (spec 1.1) and added `g`/`det`; the plane piece's UX09
  `ptrTouch` (app.js) should replace `touchNow()` in `snapZ`'s finger test once merged.
- page.html `#snapBtn`: take the plane piece's markup (UX94: the word "Snap" in `<span class="snap-w">`, accent fill)
  with this piece's `data-tip` "Snap to the grid and to figures (both panes). Hold Alt to place freely." and
  `aria-label` "Snap to grid and figures" (the plane piece kept "Snap while drawing (both panes)"; moves now snap, so
  this piece's words are the right ones). The plane piece's AS-BUILT says it left moves that snap and Alt on handle
  drags to this piece.
- app.js `editDown`: the Point-tool line became a block (`pd === 'existing'` sets a move drag); the plane piece's
  editDown changes (UX09 `handleAt`, UX14 close radius) are in other lines.
- app.js: `cmApi().makeFree(id, o)` takes `{live}`; `cmUiApi()` gains `drag`, `abortDrag`, `revert`, `cue`, `snapTick`;
  `snapZ` gains a 4th argument (touch) and Alt; the second-finger line in `setupPane`'s pointerdown; the onUp snap-tick
  line (`|| (d.mode === 'move' && d.fd && d.moved)`); the globe: `globeSnap`'s `out()` returns `pt: true`,
  `globeDown`'s Point-tool branch calls `Construct.globePoint` first, `globeSnap` 'cart' takes `Constr.gridStep`,
  `globeMove`'s `gmove` and `ghandle` branches call `Construct.globeSlide`, `globeUp` calls `Construct.moveUp` for both.
  The plane piece changed `globeDown`'s polygon close radius (other lines).
- tools/make_ru_table.py: add `V165_RAIL_HERE = {'v165-ux-rail.json'}` to the v165 sets the merge builds.
  `v165-ux-rail.json` carries `help.deformation.v164snap`, the same Deformation-help restore line (identical en and ru)
  as the plane, chain and phone tables; the merge needs it once.
- notes/tour/INTEGRATION.md: nothing to add (no anchor moved; only the meet step's body and touch text changed).

## Reviewer, please look at

- The pull distances (40/64 px, 120 ms) and the 15° detents are the spec's decisions for the user (changeable in
  `Constr.RAIL` and `detentAt`).
- A construction pick or a Point-tool press on the real or imaginary axis now makes a point on the axis and adds the
  axis as a fixed shape row ("the real axis"). This follows the spec (the axes are curves); it is the most visible side
  effect in older scenes (touch_cmd A7). On the phone, a tap within 22 px of where a drawn curve crosses an axis takes
  that crossing (the spec's touch crossing radius); a tap on a circle near the imaginary axis is then the meet point
  (still a point on the circle).
- The Perpendicular circle keeps its C after a circle is made (v16 behaviour, unchanged): two more taps make the next
  circle on the same C.

## Closing summary

The piece is complete. The user's bug ("needs distinct points" with two different points on one circle) is fixed at
the root (`samePick`/`dupPick`; real `refKey`s for crossings and display curves), on the laptop and on the phone with
real taps. Points snap to the unit circle, the axes, drawn curves, crossings and the half-unit grid; a point on a curve
slides round it (15° detents: 1, i, −1, −i exactly on the unit circle) and comes off with a hard pull (40 px held, or
80 px at once; 64/128 on touch); a free point snaps while dragged and attaches when dropped on a curve; Alt places and
moves freely; opposite points on C give the diameter. Nothing is left undone from the spec. Open items are for the
merge (three conflicts with the plane piece, each keeping both sides; re-run ux165_rail_cmd.js after it), the
`V165_RAIL_HERE` line in tools/make_ru_table.py, and the reviewer points above (pull distances, the axes as fixed shapes
in older scenes).

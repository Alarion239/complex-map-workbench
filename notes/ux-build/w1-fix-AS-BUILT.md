# Wave 1 fix round: the 26 review findings, as built

2026-10-27. Built in `work/xu1` (the wave 1 merge, `work/xu1-merged-snap`). Frozen copy: `work/xu1-final-snap/`.
Every finding was reproduced in the running app (headless Chrome, port 9891) before it was fixed. Unit test of this
round: `test/t_ux165_fix.js` (324 checks). Browser look: `test/ux165_fix_cmd.js` (35 checks, laptop 1366 × 768 and
phone 412 × 860 with touch). Pictures: `notes/ux-build/shots/w1-fix/` (`*-before-*` is the merge, `*-after-*` this
round; light and dark; `rail9-ru-*` and `user4-phone-ru-*` in Russian).

## Rail review (w1-review-rail.json)

| id | result | what changed (file: function) | checked by |
|---|---|---|---|
| rail-1 | done | A press within 4 px (6 px with a finger) of both an axis and the unit circle goes to the circle; its detent puts the point exactly at 1, i, −1, −i. The unit circle and the axes (shown, or made fixed shapes) never make a crossing target with each other. `construct.js: snapAt` (`bg`, the tie rule) | t_ux165_fix "rail-1"; ux165_fix_cmd "rail-1/2 … 90°/0°" (laptop and phone) |
| rail-2 | done | The angle step adapts to the zoom: the finest of 15°, 30°, 45°, 90° whose arc is at least 5 detent radii, so a detent covers at most 40 % of the rail (60 px per unit: 30° with a mouse, 90° with a finger; 15° zoomed in). A line's lattice detent is capped at a fifth of the grid step. `constr.js: angleDetent, latticeDetentR` (new, exported); `construct.js: detentAt` | t_ux165_fix (sweep of zooms, "a finger rests at 37°"); ux165_fix_cmd "rail-2 phone" |
| rail-3 | done | No detent at the position of another point that a construction on the dragged point uses (`graph().excluded`, minus the point itself). `construct.js: detentAt` (`avoid`, `clash`), `railDrag` and `freeDrag` pass `self` | ux165_fix_cmd "rail-3" (P across Q at 150°: never rests there, K never undefined) |
| rail-4 | done | A fixed unit circle or axis is named "the unit circle" / "the real axis" / "the imaginary axis" everywhere (rows "The unit circle", definitions "on the unit circle", Inspector, chips; X and Y) and takes no number, so the user's circles stay Circle 1, 2. Its row shows its equation. `construct.js: shapeLabel, row`, export `fixedName`; `app.js: rowName, shapeNames, buildShapeList` (`fixedNm`, `capFirst`) | t_ux165_fix "rail-4"; ux165_fix_cmd "rail-4" |
| rail-5 | done | On the globe a construction pick on a drawn curve is a point on it (glider), as on the plane: three picks on a circle give that circle exactly. Intersect, Orthogonal, Touching, Hyperbolic on the globe say "Switch to the plane to pick the curve". `construct.js: globeCurveAt` (from `globePoint`), `globeClick`; `app.js` adapter `globePick` returns `hit` | ux165_fix_cmd "rail-5" |
| rail-6 | done | The "turn Snap off" tip comes only at the release of a finger tap on an existing point that did not move. `construct.js: pointDown, moveUp`; `app.js: editDown` (`cmTell`) | ux165_fix_cmd "rail-6" |
| rail-7 | done | The refusal goes on an accepted pick, Undo pick, cancel and Esc (`pickOk`). After a press only the chip says it; the ring by the pointer only warns (no label). `construct.js: pickOk, pickWarn, click, globeClick, cancel, back, keydown, hover, setRing` | ux165_fix_cmd "rail-7" |
| rail-8 | done | The refusal names the tool by the chip's own word (`chipTool`: "Orthogonal" when the chip says Orthogonal, the full name when the chip does). `construct.js: chipTool, syncChip` | ux165_fix_cmd "rail-8" |
| rail-9 | done (interim) | On a desktop the chip moves to the plane's foot (left, clear of the zoom buttons) while the pointer, a pick or the picked circle is in its top band and none is at the foot, and back the other way. Wave 2 D10 replaces it with the pane-head mode chip. `construct.js: syncChip` (`cm-low`, `chipBot`, `chipH`) | ux165_fix_cmd "rail-9" (RU dark) |

## User review (w1-review-user.json)

| id | result | what changed | checked by |
|---|---|---|---|
| user-1 | done | Root: the palette adds the number before the step, and nothing redrew Numbers after. Now the "Not used yet" line follows the chain and the selected step (`Params.syncUnused`, redraws only when the set of unused numbers or the Use-in step changes). `params.js: syncUnused, render`; `app.js: chainChanged, selectStep` | ux165_fix_cmd "user-1" |
| user-2 | done | A curve within the grid's own radius (9 px, 12 px finger) wins over a lattice point; a placement takes half a slide's detent window (±3 px with a mouse). `construct.js: snapAt` (`cR`), `detentAt` (`place`). Not done: drawing the unit circle stronger while a tool is armed (a change to the maths drawing; not asked for as a must) | t_ux165_fix "user-2"; ux165_fix_cmd "user-2" |
| user-3 | done | Root: the pattern cell's key held every shape, so any added curve refitted it, reading the window of that moment when no region is bounded; Y's fit sampled construction curves (a large orthogonal circle). Now the cell is keyed on regions only, and Y's fit leaves out construction curves and points and the fixed unit circle/axes (regions still count). `app.js: patternCell, stageSamples`. The pale look after it is v16's touch dimming of the other shapes while a construction is selected (SPEC 10), kept. UX91's note stays once a session (fewer toasts, regress-3) | ux165_fix_cmd "user-3"; pictures `user3-phone-*` |
| user-4 | done | Russian «Удерживайте палец — F(z)»; the line never ellipsizes: it drops to a second line of the chip, whole. `page.html` (`.chip.readout:has(> .rteach)`); `notes/i18n/ru/v165-ux-fix.json` | ux165_fix_cmd "user-4"; `user4-phone-ru-*` |
| user-5 | done | `.prm-list` no longer grows to the section's height: + Number sits right under the last number or the hint. `params.js` CSS | ux165_fix_cmd "user-5" |
| user-6 | done | After the curve the chip says "Pick a point (on Circle 1 or anywhere)". Whole / Inside / Outside already had tooltips (UX55); on touch, wave 2 D3. `construct.js: chipText` | ux165_fix_cmd "user-6" |
| user-7 | no change needed | Scorecard; its own fix line says none in wave 1 beyond user-1..6 | — |

## Regression review (w1-review-regress.json)

| id | result | what changed | checked by |
|---|---|---|---|
| regress-1 | done | The readout pads its percentage to three figures (figure spaces: no reflow while it plays) and takes a short form "1/2 · f₁ · 53 %" when the close button would wrap (measured once at build); the words stay in its tooltip. `app.js: morphReadout(short), syncTransport, buildTransport` | ux165_fix_cmd "regress-1" (one row, 41 px) |
| regress-2 | done | A ResizeObserver on both plots and the chain re-places a showing toast after any layout change (dock, lane, panels). `app.js` (after `placeToasts` wiring) | ux165_fix_cmd "regress-2" |
| regress-3 | done differently (needs the user's yes) | Instead of dropping messages, a desktop's message now sits in the chain head's free middle (between "Function chain" and Pictures \| Names) whenever it fits there on one line: it covers no plane and no control. Only a message too long for it goes above the chain as UX80 placed it. Phone unchanged (its toasts still sit above the chain bar, over the large plane; wave 2 D3's context bar is their home). `app.js: placeToasts`; `desk.css` `[data-placed="head"]` | ux165_fix_cmd "regress-3" |
| regress-4 | done | The phone's hold-and-slide line shows once a session, for 8 s from the first idle readout, never again after a probe. `app.js: probeTeach` | ux165_fix_cmd "regress-4" |
| regress-5 | done | Listen on the Try line keeps the line (and the planes) in place; it leaves when the melody ends or is stopped. `app.js: sndPieceHint, sndListenShape, sndPlayEnded` | ux165_fix_cmd "regress-5" |
| regress-6 | partly done; rest named for CI | F(z) of the probe is evaluated once per move (was twice). Not changed: snapAt/detentAt per hover and glide frame, anchorMove's snapAt per move, setReadouts' measuring. For CI's perf gate: hover with Point and Orthogonal over a scene with a Line grid and several circles; drag a disc with Snap on there; slide a glider round the unit circle; hover-probe X in X → Y | t_ux165_fix "regress-6" |
| regress-7 | done | `updateUndo` touches the buttons only when their state changes; `targetNote` returns at once while its key (targets, focus, chain, language, phone) is unchanged. `app.js` | t_ux165_fix "regress-7" |
| regress-8 | done (explicit) + listed for consent | `mfNogo` keeps only rectangles that lie over the plane. This changes no pick (a rectangle outside the overlay excluded nothing); the paths differ from v16.4 because UX20 moved the legend off the plane. Pictures for consent: `regress8-deform-paths-v164.png`, `regress8-deform-paths-after.png` (Roots as preimages, Paths on) | t_ux165_fix "regress-8" |
| regress-9 | done | A focus moved by Tab, Shift+Tab or an arrow key shows the element's tip on :focus-visible; a focus the app moves (palette, dialog, Enter, Esc) shows none (UX34 kept). `app.js: setupTooltips` | ux165_fix_cmd "regress-9" |
| regress-10 | done | `histWhat` names a shape from the undo step's own snapshot: "Undid: add z₂." `app.js: shapeNames(list), histWhat` | ux165_fix_cmd "regress-10" |

## Russian

`notes/i18n/ru/v165-ux-fix.json` (3 entries: the globe refusal, the chip's "on {c} or anywhere", the shorter probe
line), registered as `V165_FIX_HERE`, read after every other v16.5 table. `python3 tools/make_ru_table.py --strict`:
2728 entries, 2008 call sites, 0 unresolved, collisions 15 (unchanged), unused 1 (`Guide  ?`, as before).

## Tests run (unit only, per the user's rule)

`node test/t_*.js`: 42 files, 42 pass (t_ux165_fix 324, t_tour, t_tour_engine, t_ux165_* of the pieces and the merge,
t_i18n 23478, t_constr …). No GLSL, quality, perf or other browser suite was run. `test/ux165_fix_cmd.js` was used as
the look in headless Chrome: 35 of 35 on the final build, no exception or console error.

Freeze: `python3 build.py` twice gives the same bytes (and the bytes that were checked); the published page has no
`__cmw`, TEMP-DEBUG-HOOK, `__tourApi`, machine path or e-mail. Snapshot `work/xu1-final-snap/` (312 files with
`SHA256SUMS`: the merge snapshot's files plus `test/t_ux165_fix.js` and `test/ux165_fix_cmd.js`). Clean-up: daemon and
server (port 9891) stopped, the Chrome profile and its Caches mirror deleted.

## Goldens and perf

No golden image, perf baseline or `test/regress/accepted.json` touched. Drawing: the quality scenes pin Y's view and
have no constructions, so the Y-fit change (user-3) moves none of them. For the user's consent: regress-8 (paths of the
deformation differ from v16.4 since UX20; pictures above). Per-frame work: regress-7 removes work; regress-6's listed
paths are for CI's perf gate.

## For the reviewer

- rail-2: at the default zoom a finger now has only the quarter-turn detents on the unit circle (1, i, −1, −i); a
  mouse has 30°. 15° comes back when zoomed in. This is the review's own 40 % rule.
- regress-3 is a placement, not a removal: please confirm with the user (the review said "ask the user").
- rail-9 is an interim placement until wave 2 D10.
- `Construct.debug()` (test hook, stripped from the published page) also reports `chipBot` and the draft's hover.

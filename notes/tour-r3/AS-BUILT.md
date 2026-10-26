# Tour r3 (v16.4): as built

Built from `notes/tour-r3/SPEC.md` in `work/xvtr` (a copy of v16.2; base for the merge: `notes/v16.2-candidate`).
Nothing outside `work/xvtr`, `notes/tour-r3/` and the new Russian table `notes/i18n/ru/v164-tour.json` was changed.

## What the user gets

- **No pop-ups.** Each step sits in a strip that the layout makes room for. It never covers the work area, never moves,
  and its title and one line (the lead, the task, or the result) can be read without a tap.
  - Desktop and tablet: the first row of the stage. It is 62 px high; with Why open it also holds the step's text, and
    it keeps one height for a whole chapter.
  - Phone, portrait: a 68 px row under the header. X goes from 668 to 600 px at 390 × 844.
  - Phone, landscape: the strip sits in the header, right of ⋯, so X keeps its size. A header with less than 260 px
    free gets a 48 px row instead.
  - Why shows the step's full text. On a phone it is a panel that opens only on a tap and folds on a touch in X; on a
    desktop it opens inline.
- **Each task step moves on by itself 3 s after it is done.** The 3 s start again on input. They wait while a finger
  is down, a menu, the palette or a dialog is open, a piece is playing, a text field has the focus, Why is open on a
  phone, or the page is hidden. A press on the strip's text, or Back, cancels it. The Three views and Deformation
  steps open something new, so they still move on after 0.7 s. Next fills from left to right during the 3 s. With
  reduced motion it counts down instead ("Next · 3, 2, 1"). "Move on by itself" in Why turns all of this off.
- **New Sound chapter** (after Branches, before Export). Grieg on a curve has a Listen button, captions at the drums
  and the speed-ups, and is done after the piece, or after a stop past 9 s. In Phase lines are strings, laps round
  the zero and the pole play a scale up and a scale down. A loop sings its number has W = 1, sung as F♯. Sound
  settings moved here from Palette and keys. The tour holds the sound settings it needs and gives them back after the
  chapter, after Esc and after a reload.
- 47 steps: 34 tasks (2 doors), 13 read; every step has a lead or a task, most tasks a result line.

## Files (all in `work/xvtr`)

| file | change |
|---|---|
| `src/tour.js` | Removed: the callout, `place`/`placeDock`/`placeMini`/`dockGutter`, the mini bar, the Tab trap. Added: the strip (`buildUI`, `mountStrip`, `sizeDesk`, `measureWhy`, `setWhy`), the line (`paintLead`), the act button and the sound (`syncAct`, `actPress`, `holdSound`), captions, and the countdown (the `countdown()`/`cdLeft()` reducer, its feeds and its look). Also the step fields `lead`, `try.then`, `try.after`, `act`, `hear`, `captions`; all copy of §3–4; the Sound chapter and its scenes `song` (`app: 'song'`), `harp` and `harpLoop`; the look keys `phaseKey` and `sectors`; `Tour.auto()`; the new `Tour.lit()` fields; `VERSION` 3; the record keys `auto` and `why` |
| `src/app.js` | Adapter: `slot()`, `sceneSpec()`, `listen()`, `soundHold()`, `soundStop()`, `soundReady()`, `soundState()`, `soundPlaying()`, `has('song')`. `tourSetLook` sets `phaseKey` and `sectors`. The events `view-moved` (pan or orbit end, a wheel 250 ms after its last tick, a pinch on lift), `layer-opened`, `phase-key`, `order-changed`, `step-replaced`, `listen-started`, `listen-ended`, `harp-turn`; `shape-added` with `via`; `pattern-changed` from the setter. `cmw-tour-sound`: the crash restore at start |
| `src/inspector.js` | `tex-copied` from F's copy button |
| `src/phone.js` | `geometry()` subtracts `--ph-tour`; `Phone.geometry()` exported |
| `src/page.html`, `src/desk.css` | `#tourSlot` as the stage's first child, and its row `var(--tour-h, 0px)` (explicit rows for the other children); `#tourHeadSlot` in the header |
| `src/phone.css` | `--ph-tour` in the split rows and the sheets' tops; the header slot (`flex: 1 1 260px`, the view switch keeps 420 px) |
| `tools/make_ru_table.py` | reads `notes/i18n/ru/v164-tour.json` last (`V164_HERE`); `src/i18n_ru.js` regenerated: `--strict`, 0 unresolved |
| `notes/i18n/ru/v164-tour.json` | 81 strings (leads, tasks, results, captions, the Sound chapter, the strip's UI, the shortened c3 and range tasks) |
| `notes/tour-r3/INTEGRATION-v164.md` | §6 of the spec as section 9 of the contract (see Deviations) |
| tests | `t_tour.js` (the new rules, the countdown on a fake clock, the totals); `t_tour_engine.js` (the placement checks went with the callout); `tour_cmd.js`, `tour_lit_cmd.js` (moved to the strip); `tour_audit_cmd.js` and `tour_phone_cmd.js` (rewritten for the strip); new `tour_auto_cmd.js` and `tour_perf_cmd.js` |

## Deviations from the spec (small, each on purpose)

1. **INTEGRATION section 9** is in `notes/tour-r3/INTEGRATION-v164.md`, not inside `notes/tour/INTEGRATION.md`. This
   build may only write notes under `notes/tour-r3/`. `t_tour.js` reads both files as one. The merge should paste the
   addendum into INTEGRATION.md as section 9.
2. **`api.soundState()`** (`{ on, events, sonify, audio, playing }`) was added. The act button needs to know whether
   sound and events are on even before the audio context runs; `soundReady()` alone cannot say "Turn on and listen"
   versus "Listen".
3. **Part of the chain** also sets `allAtOnce: false` in its `before`. All steps at once is now a task that turns All at
   once on, and the range step's copy assumes it is off.
4. **Russian for "Why"** is «Подробнее», not «Почему». The spec gave no Russian, and the strip shows «Подробнее ▾».
5. **A hidden page** in `tour_auto_cmd.js` is tested with `document.hidden` and a `visibilitychange` event, not
   `Page.setWebLifecycleState('frozen')`. Freezing in headless Chrome stopped the page's frames for good and wedged the
   test daemon.
6. **The old callout audit is gone**: its layer pass checked that the callout stayed clear of menus. `tour_audit_cmd.js`
   now checks the strip instead (spec §7.4): no overlap, one place per chapter, no cut text, button sizes and gaps,
   contrast (Next's fill included), the lit patch, and no app layer left open.
7. The Grieg caption tolerance in the test is ±300 ms from the button press, not ±150 ms. The test reads the captions
   by polling; the measured times were 8915, 15410 and 20435 ms.

Build check (§4.1): Tiles draws a phase line wherever `arg F / (2π/sectors)` is an integer (`gl.js` `dcolor`). With 12
sectors that is arg F = 0 and every 30° after it, so the body's first sentence holds as written.

## Tests

Node: `t_tour.js` 1712/1712, `t_tour_engine.js` 11/11, `t_i18n.js` (20652 checks), `t_i18n_keys.js` (5446), `t_i18n_english.js`
(977 outputs byte-identical), `t_seasong.js` 66/66, `t_sound.js` 151/151: all pass. `make_ru_table.py --strict`: 0
unresolved. Building twice gives the same bytes, and the published page has no test hooks.

Browser (headless Chrome, `test/tr3_cdp`, port 9834):

| suite | result |
|---|---|
| `tour_auto_cmd.js` (new) | 54/54 |
| `tour_cmd.js` | 96/96 |
| `tour_lit_cmd.js` | 190/190 (1440 × 900 and 1024 × 700) |
| `tour_audit_cmd.js`, 24 runs, 1128 step views | 8982/9026 (details below) |
| `tour_phone_cmd.js` | 1142/1145 in the full run; the landscape Why check passed in its rerun (286/287) |
| `seasong_cmd.js`, `sound_v152_cmd.js`, `i18n_cmd.js` (94/94), `i18n_walk_cmd.js`, `v15_desktop_cmd.js`, `v15_phone_cmd.js` | pass |
| frame times with the tour running (new `tour_perf_cmd.js`) | 60 fps at 1440 and 390: p95 18.0–18.5 ms while Next fills and while the Grieg piece plays |
| quality suite (`test/regress/quality/run.sh --no-build`) | PASS: 81 runs, 0 failed (28 improved, 35 unchanged, 18 new); the baseline and golden images untouched |

What `tour_auto_cmd.js` measured:
- A task step moves on 3000 ± 150 ms after the last input. An input 2 s after done pushes the advance to 3 s after it.
- The door step moves on after 700 ± 100 ms.
- The countdown waits while a finger or the mouse is held down for 6 s, the palette is open for 6 s, a text field has
  the focus, the page is hidden, or Grieg is playing; it moves on 3 s after each ends.
- These never move on by themselves: a press on the text, Back, a step reached with Back, Move on by itself off, and a
  chapter's last step (Patterns).
- With reduced motion Next reads "Next · 3", "· 2", "· 1". The live region says "Done. Y shows its image under F. Next
  step in 3 seconds."
- Grieg captions came at 8915, 15410 and 20435 ms after the press; no move during the piece, then +3 s. A stop at 10 s
  counts as done.
- Strings: mouse laps of radius 0.4 round 1 and then round −1 (harp up 1, down 1) tick it; touch laps (hold, then
  slide) too.
- A loop: W = 1, the full piece, then +3 s.
- After the chapter, after Esc, and after a reload mid-chapter, sound and Hear the function are off again.

What the audit, phone and perf runs found:
- **The audit's 44 failures**, of which 40 are at 1024 × 700, Editing the chain. The Inspector step opens the right
  panel, and at this width the app then closes the left one: the stage, and the strip with it, moves 204 px left for
  the rest of the chapter. The panel action and this layout rule are as in v16.2, not the strip. The other 4 are the phone Range task cut at 390 (light and
  dark, English and Russian), fixed below; the 160 re-shot first and last steps of every chapter show no cut text.
- **Fixed during the run**: the Russian and English Range task at 390 needed a third line next to "Next: Analysis".
  Next now becomes "Next →" (with the full name) whenever the lead line would be cut. Back now keeps its place when
  hidden, so the text and Why stay aligned on the welcome step.
- **The phone failures**: the full run's three were the landscape Why check (the test touched the plane's own buttons;
  fixed and passed) and the warning that `views/key` is skipped at 844 × 390 and 780 × 360. That skip is a v15 finding
  (`notes/tour/POLISH.md`: the Phase key check is not reachable there), not new.
- **Perf**: at 390 the panes change size once in Views. That is the Phase key step's own Display sheet (X | Y side by
  side), not the strip.

## Screenshots

`notes/tour-r3/shots/<width>-<theme>-<lang>-<chapter>-<step>.png`: every step at 390 × 844 (touch) and 1440 × 900
(mouse), light and dark, English and Russian, 376 shots. The earlier `ui-*.png` are the design mockups. Every
chapter's first and last step was shot again after the last fixes. The middle steps are from the run just before, which
had 2 px more text padding in a phone's strip.

## Open points

- (Fixed in the review pass: at 1024 × 700 the strip no longer moves in Editing the chain; see below.)
- `views/key` is still skipped on a landscape phone (as since v15).
- Not checked here: the Android phone itself (the strip, the 3 s, and Grieg's quiet first statement on its speaker),
  and an old Windows laptop (the panes resize once at the tour's start, which redraws once).
- (Fixed in the review pass: `tour_audit_cmd.js` has v16.2's layers, spotlight-exact, follow and focus passes again.)
- The merge folds `notes/tour-r3/INTEGRATION-v164.md` into `notes/tour/INTEGRATION.md` as section 9 and adds
  `V164_HERE` to the merged `make_ru_table.py`.

## Review fixes (review-user.json, review-regress.json; ledger.json)

All 17 findings fixed in `work/xvtr`. What changed for the user:

- **A done task steps aside.** The shade and rings fade once the task is done, so the result (X and Y, the image, a
  sheet) can be seen and touched for the 3 s. A sheet the task itself opens (the chain's Editor sheet) holds nothing.
- **Every task moves on**, a chapter's last one too (into the next chapter, which Next names). Only Back, Move on by
  itself off (doors included now) and a press on the text stop it.
- **Next's countdown** is a bar along its bottom edge in its own label colour (the label's contrast, 4.5:1 or more; the
  old fill was 1.26:1). The live region says "Next step in 3 seconds" only when they run.
- **Phone strip**: × End in the portrait row, a chevron after the count (after the title in landscape), Next a 44 px
  arrow. The strip measures every line of a chapter at its width: a chapter that needs three lines gets a 76 px row (a
  landscape header gives way to the row under it). In portrait the act button takes Back's place (Back is in Why).
- **Copy**: Sets from formulas asks its task on a phone too (example `|z+1|<1`, not the field's placeholder); the listen
  steps say "Press ▶ to listen." and, with the sound off, "Press ▶ to turn sound on and listen."; Preimages' touch task
  names the ring, and a short hold that pans Y shows why. Russian captions shortened.
- **Sound**: Sound settings shows the user's own settings (the tour gives the sound back there); a setting the user
  changes during the chapter stays theirs.
- **Desktop**: a chapter's docked side panel opens at its start (1024 × 700, Editing the chain: the strip no longer
  jumps 204 px). On a window whose panes would keep less than 360 px with Why inline (1366 × 657), Why opens as a panel
  on a press, as on a phone; inline Why never shrinks during a tour, so the panes change size at most when a taller
  chapter comes.
- **Field hold**: only while the field has text not yet sent (a set added with Enter now moves on).
- `tour_audit_cmd.js` has v16.2's spotlight-exact, lit-control, layers (layerAll), follow and focus passes again
  (`test/tour_audit_spot.js` holds v16.2's probe) and v16.2's sizes. Its layers pass found one more regression, fixed:
  r3 had stopped masking the rings off the app's toasts.

### Fix pass, second run (the first was cut off before its tests and ledger)

The 17 fixes above were checked in the browser again, and `ledger.json` was written. The restored audit, run at all
seven sizes, found two more things at 768-1023 px, both fixed (one new in r3, one as in v16.2):

- **A drawer covered the strip.** Your shapes, Sets from formulas and Patterns open the left drawer, which is absolute
  over the stage from its top, so it hid the strip's first 208 px (Back, the title, the start of the line). The drawer
  now starts under the strip while the tour runs (`desk.css`: `top: var(--tour-h, 0px)`; without the tour that is 0, as
  before).
- **X's lit patch ran under that drawer** (as in v16.2): the drawer's tool grid showed undimmed inside it, and the trim
  between the two patches cut 13 px off the lit Select tool. A lit part beside the anchor that an open layer covers
  along a whole side is now lit only up to the layer's edge (`tour.js` `sideCut`; desktop only).

Four corrections to the audit itself:
- The Select tool under a landscape phone's chain bar no longer counts as a control. A control must be on top at its
  centre.
- Phase key accepts Y's Display options button when the check is folded into it, as the step was written in v16.2.
- The skipped-step warnings are left out of the exceptions check, as in v16.2. They are listed in `skipped`.
- The strip-against-tool-row check uses the tool row's visible box, cut by the drawer that scrolls it.

Still failing, as in v16.2 (same holes, checked side by side on the published v16.2), at 844 × 390 only:
- The tool row, the deformation's transport and Paths sit under the chain bar, even without the tour. This has been an
  app finding since v15 (`notes/tour/POLISH.md`). So Draw a shape's Disc and Play and scrub's controls cannot be
  reached, and Paths is cut.
- Your shapes shows the Select tile at the top of the Tools sheet, while its anchor, the shape list, is below the
  sheet's fold.

Tests in this run (details in `ledger.json`):

| suite | result |
|---|---|
| node: `t_tour` (1715), `t_tour_engine` (11), `t_i18n`, `t_i18n_keys`, `t_i18n_english`, `t_seasong`, `t_sound` | all pass |
| `make_ru_table.py --strict` | 0 unresolved |
| `tour_auto_cmd.js` | 75/75 |
| `tour_cmd.js` | 96/96 |
| `tour_lit_cmd.js` | 190/190 |
| `tour_phone_cmd.js` | 2077/2077 (the views/key skip on a landscape phone, since v15, is listed in `skipped`) |
| `tour_perf_cmd.js` | 60 fps at 1440 and 390 (p95 17.3-17.8 ms); 390's one Views resize is the Phase key step's own sheet |
| `tour_audit_cmd.js`, 7 sizes, light, EN and RU, all passes | 7023/7031: the 8 are the 844 × 390 items above (4 per language) |
| `tour_audit_cmd.js`, 390 and 768, dark, EN and RU | 1881/1881 |
| quality suite (`test/regress/quality/run.sh --no-build`) | PASS: 81 runs, 0 failed; baseline and golden images untouched |

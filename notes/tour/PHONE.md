# Guided tour on a phone (v15.1, work/xvp, 2026-10-24)

The user, on their own phone with v15: "the guide is kind of jiggly when I scroll (the selections) & the tour pop-up
often blocks the area where I am supposed to work".

Built in `work/xvp`, a copy of v15 (`notes/v15-candidate`). Changed: `src/tour.js` (the engine and its CSS; in the
content only `basics/chain`'s `try.work` and the new anchor `lens`), `src/i18n_ru.js`. No change in `app.js`, `phone.js`
or `phone.css`. Tests: new `test/tour_phone_cmd.js`; `test/tour_cmd.js` (phone and fold checks), `test/tour_audit_cmd.js`
(reads the drawing inside a panel; knows `try.work`). Notes: `INTEGRATION.md` (anchor `lens`), new
`notes/i18n/ru/v15-tour-phone.json` (2 strings). The review of the first build (`review-phone.json`, 10 findings) and
what was done with each: `ledger-phone.json`.

## 1. Causes

**Jiggle.** On a phone the sheets (`.ph-sb`) and the chain bar (`#pipeline`) scroll on the compositor thread. A touch
scroll or a fling moves their content in a frame before the page's script hears about it. The spotlight was a
`position: fixed` SVG over the page, redrawn from the `scroll` event: it is always one frame (or more, on a busy main
thread) behind the content. The faster the fling, the bigger the gap: 8 to 39 px measured on screen (section 4). The
headless audit could not see it: it reads the page's own numbers, and in the page the target and the ring always agree
(0 px in every frame, also in v15). Only the composited frames show it.

Two more causes: the callout was placed again on every scroll frame (on a phone it could jump between the top and the
bottom while the target moved), and the rubber band at a panel's end moves the content past its edge, where the
spotlight drawn in the panel (below) does not reach.

**The callout over the work area.** On a phone the callout is a full-width sheet at the top or the bottom. The plane is
587 of 844 px, so for every step that lights the plane no place was free, and the old rule took the place that covered
the least: up to 94 416 px², 288 px deep. In v15, 135 of 308 phone step views (portrait and landscape, EN and RU) cover
their work area.

## 2. Changes (src/tour.js; phone = `:root.ph` or below 640 px)

**Spotlight inside the scrolling panel.** A lit part inside a panel that scrolls is drawn inside that panel: an SVG
(`.tour-host`, 1 × 1 px, `overflow: visible`) at the panel's content origin, above its content. Its shade, ring and glow
scroll with the content natively, in the same frame, with no script. The fixed shade leaves a window over the panel's
visible box, which does not move while the panel scrolls.

- While a panel hosts: a static panel gets `position: relative` (only if no absolutely positioned element in it is
  placed from a box outside it); a mask (the chain bar's scroll fades) is taken off, so the chain bar hosts too;
  `overscroll-behavior: none` (no rubber band). Its own inline values are recorded on the panel (`data-tour-host`) by
  the first drawing in it and put back by the last one out.
- A panel with an opacity below 1 is not used (the shade would fade with it).
- A touch on the dimmed part of a panel scrolls it but reaches none of its controls (before, the shade took it).
- The panel's own scroll events no longer run the layout every frame: one layout 140 ms after the scroll calms. Then,
  if the step's anchor was scrolled wholly out of the panel and no finger is down, the panel scrolls back to show it.

**What still follows by script** (the page, a sheet sliding in, the chain bar riding up with a sheet): the layout runs in
the scroll handler and the frame loop as before, and on a phone the rings fade out (80 ms) while it moves and back in
(160 ms), so a ring a frame behind is never seen.

**Visual viewport.** Its resize and scroll events run the layout. At the page's own scale (a keyboard, a URL bar), the
part outside the visual viewport counts as unsafe, so the callout stays in sight. Pinch-zoomed in, nothing is chased.

**Work area.** Every lit area (the anchor, its `also` areas, and on a touch screen the parts a Try it's touch task names,
`try.work`: the lens in the sheet for "Tap the card f1, then the lens"), plus the whole visible box of a panel that
holds one. On a touch phone the callout never covers it:

- `place()` with `opt.mini` returns `{ mode: 'mini' }` when no place is clear of the work area (in landscape only when
  something is lit; with nothing lit, the whole card as in v15).
- `placeMini()` keeps only places clear of the work area and of open layers: the top or bottom edge (full width, or the
  widest free stretch, at least 240 px), a slim bar in landscape (46 px, no inner padding), or a band right above or
  below a lit area. The place it had is kept while it stays clear (no chasing). Least overlap only if nothing is clear.
- The bar: a 44 px title button (a tap shows the whole step) with, on a Try it step, a second line with the task's touch
  text and a tick that fills when done (Next then gets its "ready" ring); a 44 px Back; the count as "5/6"; Next, as
  "Next: <chapter>" when it fits, else "Next →". 8 px between buttons. Its aria-label: title, task, "Show the whole step".
- The whole step, unfolded from the bar, has a 44 px fold button in its head (shown only when it covers the work area).
  A touch in the work area folds it back at once and goes on to the app. Each new step starts as placed.
- The callout stays where it was placed while it covers no more of the work area and no layer than when placed.
- The bar only on a coarse pointer: a narrow window with a mouse keeps v15's card. Desktop (640 px and up without
  `:root.ph`) is unchanged: no hosting, no bar.

New strings (Russian in `notes/i18n/ru/v15-tour-phone.json`): "Show the whole step" (Показать шаг целиком), "Collapse
the step" (Свернуть шаг). `Tour.lit()` adds `mini`, `expanded`, `work`, `hosted`; `Tour._t` adds `placeMini`.

## 3. Review fixes (review-phone.json: 9 fixed, 1 partly; details in ledger-phone.json)

| id | fix |
|---|---|
| phone-1 | fold, grow and bar-Back hidden by `.tour-card .tour-fold` etc. (beat the app's `.icon-btn`); checks in tour_cmd and tour_phone_cmd |
| phone-2 | `basics/chain` `try.work: ['lens']`, anchor `lens`; `covered()` ignores only layers that do not hold the part |
| phone-3 | chain bar hosted (mask off while it hosts); an anchor flung out of its panel comes back when the panel is still |
| phone-4 | `placeMini()` takes only clear places (edges, slim bar, bands beside lit areas); landscape in tour_phone_cmd |
| phone-5 | the bar shows the Try it task and its tick; Next gets the ready ring |
| phone-6 | panel style recorded on the panel, restored by the last drawing out (restart race) |
| phone-7 | landscape with nothing lit: the whole card |
| phone-8 | Next: <chapter> / Next →, Back in the bar, "5/6", 2-line title, aria-label with title and task, focus ring inside; 8 px gaps |
| phone-9 | partly: no reading within 6 px of the panel edge, the ring nearest the green edge, every hosted or chain step, a fling from the dimmed part; Formula still reads a false 8.3 px |
| phone-10 | bar only with `(pointer: coarse)` |

Found in this round's re-run and fixed: the bar's buttons were 6 px apart (audit `btnGap`, 40 step views at 390 touch);
the audit counted the lens as an extra hole at 1440 touch (it now knows `try.work`); the bar's aria-label had a double
full stop after a task; the rubber band at a sheet's end (an undimmed strip at the sheet's top edge, and the ring
10 px off the ⋯ button in Inverse); `tour_phone_cmd.js` crashed when a gesture lost its anchor.

## 4. Before and after

`test/tour_phone_cmd.js`, headless Chrome (ANGLE Metal), mobile emulation, deviceScaleFactor 3, touch
(`Emulation.setTouchEmulationEnabled`), a 47 px notch and a 34 px home bar (landscape: 47 px left and right, 21 px
below), port 9003. "Before" is v15's `dist/test.html` served as `test_before.html`; "after" is this build.

**Spotlight against its target during real touch scrolls.** Every step whose anchor is in a scrolling panel (13 steps),
5 gestures each (`Input.synthesizeScrollGesture`: a slow drag each way, a fling each way, a fling started on the dimmed
part of the panel). "Screen": in the composited frames (1 px strips of `Page.captureScreenshot`, the target outlined
green by the page, the ring magenta), the change of their distance from rest, CSS px. "Page": in the page's animation
frames.

| step (panel) | screen max / p95, v15 (390; 360) | screen max / p95, after (390; 360) |
|---|---|---|
| Shapes (Editor sheet) | 17.7 / 9.3; 20.3 / 10 | 0 / 0; 0 / 0 |
| Formula (Editor sheet) | 12.7 / 8.3; 15 / 8.3 | 8.3 / 8.3; 8.3 / 8.3 (see below) |
| Add a function (chain bar) | 20 / 10.3; 20 / 10.7 | 0 / 0; 0 / 0 |
| Phase key (Display sheet) | 39 / 10; 20.3 / 9.7 | 0 / 0; 0 / 0 |
| Patterns (Display sheet) | 14.7 / 8.3; 19.7 / 8.3 | 0 / 0; 0 / 0 |
| Inspector (Editor sheet) | 20.3 / 15.7; 20.3 / 14.3 | 0 / 0; 0 / 0 |
| Zeros and poles (Editor sheet) | 14.3 / 11; 15 / 9 | 0 / 0; 0 / 0 |
| Shared numbers (Editor sheet) | 18.7 / 8.7; 18.3 / 9.7 | 0 / 0; 0 / 0 |
| Order (Display sheet) | 18.7 / 7.7; 8.7 / 7.7 | 0 / 0; 0 / 0 |
| Inverse (Editor sheet) | 9.7 / 8.3; 9.7 / 8.3 | no reading (see below) |
| Domain, Guarantees, Formula as TeX | 0.3 / 0.3 | 0.3 to 0.7 (1 gesture; see below) |

Page frames: 0 px in every frame, before and after (this is why the audit passed).

- Formula: a constant 8.3 px in the two upward gestures only, the same value in every such frame. A pixel dump of the
  same gesture (green and magenta rows of the strip, 4 frames mid-drag, with and without the safe-area insets) has the
  ring 1 device px outside the green edge in every frame, so this is the strip reader, not the ring; not explained further in the time box.
- Inverse: the ⋯ button sits at the very top of a short sheet. With the rubber band off, a drag at the top moves
  nothing, and a drag the other way slides it under the sheet's head: every frame is an edge reading, dropped. Before
  the rubber band was turned off it read a constant 10.3 px (the bounce).
- Domain, Guarantees, Formula as TeX: the first slow drag closes the Analysis or Export sheet (the app's own behaviour
  with this synthetic gesture, the same in v15); the other 4 gestures have no anchor.

**URL bar** (the viewport 56 px shorter and back, during X and Patterns): 0 px in every page frame, also the first
after each change, before and after; on screen the ring's edge stays 0.3 to 1.7 px from the target's (its own
offset), in the first frames after each change.

**Pinch-zoom** to 1.5 during Three views: 0 px in every page frame; on screen the ring sits 0.44 CSS px outside the
target at rest.

**Callout against the work area** (every phone step, walked with Next: 390 × 844, 360 × 780, 844 × 390, 780 × 360,
English and Russian, 308 step views):

| check | v15 | after |
|---|---|---|
| step views where the callout covers the work area | 135 (portrait 81, landscape 54) | 0 |
| largest overlap | 94 416 px², 288 px deep | 0 |
| step views with the bar | 0 | 163 (390: 40, 360: 41, 844: 34, 780: 48) |
| buttons under 44 px, outside the callout or clipped; fold button shown when not over | 0 | 0 |
| touches at work-area points that reach the tour instead of the app | 0 of 1715 | 0 of 2660 (334 more on the dimmed part of a panel: they scroll it, press nothing) |
| bar unfolded, then a touch in the work area: folds, the touch reaches the app | n/a | 2 of 2 (X, Patterns) |
| Try its done by touch with the tour open (chain lens, Phase, Stretch, Disc + drag, palette Search) | chain fails | 5 of 5 |
| restart on a hosted step within 50 ms: ring moves in the scroll's frame | (review: 0 px, then 80 px late) | 2 of 2 (0 px) |
| rotate to landscape: nothing lit shows the whole card; X clear of the card | n/a | 4 of 4 |
| exceptions | 0 | 0 |

Other checks on the final build: `node test/t_tour.js` 1101/1101, `node test/t_tour_engine.js` 29/29,
`test/tour_cmd.js` 95/95, `test/tour_lit_cmd.js` 78/78. The audit at 390 and 1440 (light, EN and RU, mouse and
touch, 312 step views): 0 failing step views; spotlight vs target median 0, max 0.75 px; buttons 36 (mouse) / 44
(touch); layer checks 0 failing of 224; follow 0 of 20; focus 0 of 8. One app finding, as in v15 (390, RU, touch, Zeros
and poles: the lit block is taller than the sheet).

Where the numbers are: `work/xvp/test/xvp4d_cdp/phone/after6s.json` (scroll, final build),
`work/xvp/test/xvp4b_cdp/phone/before5s.json` (scroll, v15), `work/xvp/test/xvp4_cdp/phone/final.json` (the rest, final
build), `work/xvp/test/xvp4c_cdp/phone/before4.json` (the rest, v15), audits in `work/xvp/test/xvp4b_cdp/audit/` and
`work/xvp/test/xvp4d_cdp/audit/`.

## 5. What a real device may still do differently

- **iOS Safari, momentum scrolling.** The spotlight drawn inside a sheet moves with its content in the UI process too.
  The rubber band is off in a hosting panel (`overscroll-behavior: none`, Safari 16 and up); on an older iOS the bounce
  can show the undimmed strip at the sheet's end for a moment.
- **iOS Safari, URL bar and keyboard.** The app and the tour are both `position: fixed`, so they move together. The
  callout is kept inside the visual viewport; a resize iOS reports late is followed one frame late, with the rings faded.
- **Android Chrome.** The URL bar does not collapse in this app (no page scroll).
- **A sheet sliding in or out** (a Try it that opens the Editor): parts inside it move with it natively; the window in the
  fixed shade follows by script (its edge can lag a frame), the rings over the page fade.
- Not tried on a real device; all of the above is headless Chrome with emulation.

## 6. Open

- `python3 tools/make_ru_table.py --strict` fails in `work/xvp` today: `notes/` is shared and has moved on since v15
  (3 unresolved call sites in `app.js` and `inspector.js`, not tour strings; video strings added). The committed
  `src/i18n_ru.js` is the one generated earlier in this work and holds the 2 new strings; regenerate in the main tree at
  the merge.
- At 1440 with touch, `basics/chain`'s touch text says "the lens in the sheet" though the lens is in the Inspector (v15
  copy).
- The Analysis and Export sheets close under a synthetic drag that starts in their scrolled body (v15 too; app, not
  tour).

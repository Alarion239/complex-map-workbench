# Phone: the swap kept zooming (v15.1)

The user, on a phone with v15: swapping X and Y over and over scales the view without end, towards infinity or 0
depending on the map. Worked in `work/xvq` (a copy of `notes/v15-candidate`); changes in `src/phone.js` and
`src/app.js` only (plus the review fixes below).

## Cause

`Phone.swap()` (v15) did three things:

1. kept the old large plane's view with `A.getView()` and gave it back later with `A.setView()`. Neither worked: they
   read and wrote `paneL.view` / `paneR.view`, which every frame overwrites with the plane's real view (`S.srcView` or
   `V.left` for X, `V.right` for Y). So nothing was ever restored.
2. clicked the plane's Fit button on the new inset (`A.fit()`). For X over an unbounded region (the first example's
   strip `|Im z| < π/2`, a line) the fit samples only the part of the region inside X's own window (`clipWin`, x1.05)
   and adds a 7 % margin. So the inset's window became about 1.19 times its old window.
3. left the view's scale in pixels per unit when the 114 px inset became the 376 px plane again: the window grew by
   376 / 114 = 3.3.

So one round trip multiplied X's window by about 3.3 x 1.19 = 3.9. Y fits itself to the image of the part of the
region inside X's window, so Y followed: it grew with an expansion (3z) and shrank to a point with the Möbius map
(the image of a huge window is a tiny neighbourhood of 1). That is the "infinity or 0 depending on the map".

## Fix

A plane's own view is its **large view**. The inset draws it smaller: the same centre and the same units per pane
width at the inset's size. The plane that comes back large shows exactly what it showed before. Nothing is fitted.
A plane the app fits itself (Y's auto fit, X's at a focused step) is still fitted by the resize, as before.

- `src/app.js`, the phone API: `getView(side)` returns the plane's real view (`leftView()` / `V.right`), its pane width
  and whether the app fits it; `setView(side, v)` writes that view (drops its running tween, clears the auto flag,
  re-centres X's meshing window).
- `src/phone.js`: `shrink(side)` (inset: same region, smaller; remembers the large view), `grow(side)` (back to the
  large view, or the inset's view scaled back up if it was changed meanwhile), and `reconcile()`, called after every
  phone layout change: the plane that is not the large one is drawn small only as the inset; side by side (an open
  sheet, a landscape phone) it shows its large view like the other plane. A merged view (Phase, Landscape, the
  Deformation) holds other views, so nothing changes until it ends. `swap()` is `grow(new large)` + `reconcile()`.
  The first-ever inset (Y at load) keeps its auto fit.
- Saving: `writeState` saves the large view of the plane in the inset (`Phone.largeView`), so a reload or the desktop
  never gets the small one. Leaving the phone layout gives the desktop the large views back; entering it shrinks the
  inset from the saved or desktop view.
- The language switch (a reload) keeps the large plane (`swUi.phone.big`, `Phone.setBig`), so Y stays large.
- Desktop: no change (the phone code does not run at 768 px and up; `Phone.largeView` is null there).

## Review fixes (`notes/ui-redesign-2/review-phone-swap.json`)

The review found 8 more ways to the same zoom. One cause: the inset's small view was kept in the plane's own view
object, and other code parked, saved or replaced that object (the view memories of Phase and Landscape, the
Deformation's memory of Y, the save, the tour's snapshot, a new example). Each of them then took the small view for
the large one, so the inset was shrunk again from it. The fix at the root: **only the inset's view is ever small.**

- `Phone.hold()` (src/phone.js): before the app parks, replaces or saves the views, the inset gets its large view back;
  at the end of the current task (a microtask) the layout is synced and the inset is drawn small again. The app calls
  it (`phHold()`, src/app.js) at the start of `setMain` (Phase, Landscape), `openTransport` / `closeTransport` (the
  Deformation), `setFocus`, `loadExample` (examples and tour scenes), `tourSnapshot` and `tourRestore`. While a merged
  view shows, no plane is drawn small.
- swap-1, tour: the snapshot holds the large views; the restore sets the large plane with `Phone.setBig` and the inset
  is shrunk once from the restored view. The tour's step 'x' shows X the same whichever plane was large.
- swap-2, leaving the phone layout in Phase or the Deformation: nothing is small there, so the desktop gets the large
  views. `leave()` grows only an inset that is small.
- swap-3, a save in the Deformation: the save sees large views only.
- swap-4, the first Phase with X the inset: starts from X's large view.
- swap-5, a sheet or a rotation that ends Phase, or a page opened in Phase: the inset is drawn small (or side by side
  at its large view) right after the view switch.
- swap-6, the language switch in a merged view: `setBig` sets the large plane without a swap; the inset is drawn small
  when the merged view ends.
- swap-7, Y's auto fit after a swap: while X is the inset, the meshing window is X's window at its large size
  (`Phone.largeBox`), so a swap does not move it and Y has no second zoom after the swap. (Y's auto fit as the inset is
  still fitted to the inset's square pane, so its units per pane width differ from Y large: 45.0 against 25.9 for
  Re z > 0 under 3z. That is the fit's framing, the same every time.)
- swap-8, a swap during a Fit: the running tween lands first (`getView(side, true)`), so the Fit's target is kept.
- swap-9: nothing to fix.

Found while fixing: the microtask must sync the panes and resize them before it shrinks the inset. Without that, after
a page opened in Phase the hidden pane still had its 10 px width and the inset came out 37 times too small.

## Numbers (390 x 844, touch; `test/phone_swap_cmd.js`)

X's window width in world units (u, the units across the pane) and Y's, after taps on the inset. Shapes: the strip
`|Im z| < 1`, a line, a point. Start: X large, u = 7.23.

Before (v15):

| map | X u after 1 round trip | X u after 40 taps | Y u after 40 taps (start) |
|---|---|---|---|
| 3z | 28.5 | 7.4e9 | 2.2e9 (25.9) |
| z/3 | 28.5 | 7.4e9 | 2.3e9 (2.88) |
| (z-1)/(z+1) | 28.5 | 7.4e9 | 1.1e-7 (10.7) |
| e^z then Möbius (example 1) | 28.5 | 7.4e9 | 2.28 (2.24) |

With a pan and zoom of the user's own in between, v15 lost it at the first swap and grew from there (x 9e5 after 20
more taps).

After (v15.1), every map: X stays at u = 7.2308 (large) and 7.2308 (inset, the same region) through 40 taps, change
0 %. Y (auto-fitted) is the same after every round trip; its very first fit at load can sit up to 3 px off the fit
it gets later (the app's existing rule that skips a refit of 3 px or less): 0.1 % for 3z and z/3, 0 for Möbius,
0.9 % for example 1, once, then 0 % for the rest. A pan and a wheel zoom of the user's own on each plane, then 20
more taps: both views kept exactly (0 %).

Other phone transitions after the fix, 20 rounds each (10 with Y large), for 3z, z/3 and Möbius. Every read is
compared with the start and with the same read of the first round. All pass with 0 % change:

- Display sheet open and closed (X | Y side by side), with X large and with Y large. The small plane now shows its
  large view side by side, like the large plane does.
- Rotation 390 x 844 <-> 844 x 390, the same.
- X -> Y <-> Phase and X -> Y <-> Landscape.
- Deformation on and off.
- Sphere and Plane on the large plane.
- Language switch (a reload), 10 rounds with Y large, example 1: Y stays large, 0 %.
- Touch tablet rotation 820 x 1180 <-> 1180 x 820 (the desktop layout, not changed): 0 % after the first rotation.
  Y's auto fit settles once on that first rotation (15 %); this code did not change.

These transitions were not measured on v15 (no time). By the code, only the swap fitted anything, so only the swap
compounded. In v15 the language switch always opened with X large again.

## Tests

- `test/phone_swap_cmd.js` (new; parts swap, sheet, rotate, views, deform, sphere, lang, tablet; run lines in its
  header): all pass. Before the fix the swap part failed about 600 of its checks.
- `test/v15_phone_cmd.js`: pass. `test/mv_views_cmd.js`: pass.
- Quality suite (`test/regress/quality/run.sh --no-build`, desktop): 81 runs, 0 failed, RESULT: PASS.

The review part (`PART = 'review'`, one `CASE` per run: tour, leave, reload, phase1, split, lang, auto, fit), 3z, both
planes at the user's own pan and zoom, all pass:

| case | result |
|---|---|
| tour, 3 runs with X large and 3 with Y large | both planes back exactly (X u 4.9251, Y u 12.027); step 'x' shows X at u 7.2308 either way |
| leave in Phase (X the inset) and in the Deformation, 3 round trips to 1200 x 900 | both planes back exactly |
| a save in the Deformation and a reload, 3 rounds | X u 4.9251 every round |
| first Phase with X the inset | u 7.2308, as with X large |
| a sheet that ends Phase | Y side by side u 5.7896 at 181 px, as from a plain open |
| a rotation that ends Phase | the same centre and pixels per unit (the landscape panes are 408 px wide after Phase, 420 px otherwise; not from this fix) |
| the language switch in Phase with Y large, ru then en | Y stays large; both planes back exactly |
| Y's auto fit, 4 swaps | no change in the second after a swap (Y large u 25.868, inset u 44.993) |
| a swap 80 ms into a Fit | X u 5.8858, the Fit's own end |

Not tested: the iPad mini crossing (reviewed as passing before; the code path is the same `leave()` and `enter()`).

## Re-check after the 03:40 stop (2026-10-24 04:45-05:30)

The fixes above were already in `work/xvq/src` (phone.js and app.js, 01:50; no source change since). Rebuilt
`work/xvq/dist` (byte-identical size) and re-ran everything on port 9013, daemon `test/xvq3_cdp`:

- `test/phone_swap_cmd.js`: swap (4 maps, 40 taps, then the user's pan and zoom and 20 taps), sheet, rotate, views,
  deform, sphere (each 4 maps), lang, tablet, and the 8 review cases: all pass, 0 fails, no console errors. Every
  read 0 % from its start and from round 1.
- New in the test: part `urlbar` (Android Chrome's URL bar hiding and showing, 390 x 844 <-> 390 x 900, 20 rounds with
  X large and with Y large; the user's phone is Android Chrome): pass for 3z and the Möbius map, 0 %. Review case
  `bypass` (the Deformation ended by bypassing its only step, not by its button; then swaps, the step back on, a
  save and a reload): pass, X back at u 4.9251. It needs no code: an empty chain closes the Deformation through
  `closeTransport()`, which already calls `Phone.hold()`. The only writers of the merged state (`S.view` in
  `setMain`, `loadExample`, `tourRestore`; `morph.open` in `openTransport` / `closeTransport`, `loadExample`,
  `tourRestore`) all call it; the rest are test hooks.
- `test/v15_phone_cmd.js`: pass. `test/mv_views_cmd.js` (port set to 9013): pass.
- Quality suite: not re-run (no source change since its 81-run pass).

# v15 build: the planes' context menu (work/xvc)

Design: `desktop/DESIGN.md` 2.5, `desktop/INTERFACE.md` ("Long-press", "Keyboard and screen readers"), `phone/DESIGN.md`
3.6. Built on v14 r1 (`work/v15-base`). The Constructions group is left out (v16).

## What it does

- **Opens with** a right-click on any plane: X, Y, the merged deformation plane, the globes (only where the pointer
  hits the globe) and the Landscape relief. On touch, a long press: 8 px slop, a ring fills from 120 to 450 ms, then a
  release without moving opens the menu. Sliding after the ring probes, as before. A pan, a pinch, a drag or a drawing
  never opens it. Shift+F10 and the Menu key open it at the keyboard probe, the pointer or the plane's centre.
- **Head:** the point and the map there. On X: "*z* = 0.80 + 0.60*i*" and "*F*(*z*) = …" (at a focused step, *w*ₖ and
  *f*ₖ). On Y and the deformation: "*w* = …". Digits upright, the decimal comma in Russian, as many decimals as a
  pixel needs. A small accent ring marks the point on the plane while the menu is open.
- **The object under the pointer:** a zero or pole mark (Remove ζ₁, Turn into a pole/zero, Edit ζ₁), a cut handle
  (Reset the cut of *f*ₖ), the old integral items (∮ / Integrate along, Listen along), then the shape (Select, Hide,
  Delete).
- **At this point:** on X, for every zeros-and-poles step *k* after the plane's stage: Add zero / pole of *f*ₖ here. The
  value is *w*ₖ₋₁ = *F*ₖ₋₁(*z*), stored exactly (`Funcs.zpItem`), so *z* becomes a zero or pole of *F*. On the step's
  own input plane (step shown alone) the items read "Add zero here". A muted line says where else it lands, from the
  chain: "also at *z* + 2π*ik*" (exp), "also at −*z*" (*z*²), "also at 1/*z*" (Joukowski), "also at the preimages of
  *w*₁ + 2π*ik*" (a later step), "also at *n* other points" (rational steps), "also at infinitely many other points".
  With no zeros-and-poles step: "Add a zeros-and-poles step with a zero here". Add point here (a target on Y).
  Never zero/pole items on Y.
- **View:** Copy coordinates (toast "Copied 0.8+0.6i"), Center view here (flat planes).
- **Snapping:** the point snaps to the bottom ruler's finest drawn division (minor = major/10) while Snap is on. Alt at
  the right-click, or held when an item is chosen, places it freely (to the decade below a pixel, as a dragged mark).
- **Undo:** one step per action. Add and Turn into use `zpAdd` + `commit`; Remove uses `zpRemove` (its own commit) and
  shows an Undo toast. The Inspector build should call the same `zpAdd` / `zpRemove`.
- **Screen readers:** `role="menu"` named by the head, `menuitem`s, arrows / Home / End, Esc returns the focus to the
  plane. Adds are announced in a polite live region (`#pmLive`).
- **Rows:** 30 px with a mouse, 44 px on touch (`pointer: coarse` or a touch-opened menu).

## Interface (as agreed)

- `src/planemenu.js` defines the global `PlaneMenu`: `open(pane, z, event)`, `register(group, provider)`, plus
  `init(api)`, `close()`, `isOpen()`, `announce(msg)`, `justOpened()`, `ringStart/ringFull/ringStop`.
  `pane` is 'L' / 'R' (or a pane, or its canvas). `provider(ctx)` returns items `{label | html, sub?, icon?, key?,
  danger?, disabled?, run}`. Groups: `object`, `point`, `constructions` (v16), `view`; unknown groups go before `view`.
  `ctx` has `side, plane ('X' | 'Y' | 'D'), surface ('flat' | 'globe' | 'land'), stage, z (snapped or free), zExact,
  zFree, zSnap, pick() (the point when the item runs, Alt-aware), alt, touch, keyboard`.
- `app.js` hands over `planeMenuApi()` (geometry, chain info, `zp.add/remove/swap`, shapes, view, copy, toasts, the
  app's `openMenu`). The menu is drawn by the app's own `openMenu` (class `ctx-menu pm`), so its keyboard handling,
  outside-click and focus return are the existing ones.

## Changes outside the new file (kept small for the 3-way merge)

- `build.py`: `planemenu.js` before `app.js`.
- `app.js`:
  - `openIntegralMenu` split: `integralItems()` returns the items (Listen items carry `listen: true`); the old menu is
    the fallback when `PlaneMenu` is absent.
  - `planeMenuApi()` and `planeMenuAt()` after it, plus a test hook block `window.__cmwPlaneMenu` (stripped from the
    published page).
  - `setupPane`: the contextmenu handler calls `planeMenuAt`. On macOS, contextmenu fires at the right button's press;
    the menu now waits for the release, so a right-drag still pans (before, a right press near a curve killed the pan).
  - `setupPane`: the touch hold is the ring state machine (450 ms, 8 px; a still finger on a zero/pole mark and the
    Landscape now take part too). Without `PlaneMenu` the old 500 ms / 6 px hold stays.
  - One line after `setupPane(paneR, 'R')`: `PlaneMenu.init(planeMenuApi())`.
- `tools/make_ru_table.py`: also reads `notes/i18n/ru/v15-*.json` (after the phase-2b tables). Other v15 builds need
  the same one-line change; it is identical, so the merge is clean.
- Russian: `notes/i18n/ru/v15-planemenu.json` (32 entries); `src/i18n_ru.js` regenerated (unresolved 0).

## Tests (all on port 8922)

- `test/v15_planemenu_cmd.js` (new): **pass**. Right-click on X, Y, the deformation, the X globe (and nothing off it),
  the Landscape, Phase; add zero and pole for step 1, after exp (and *z* + 2π*i* is a zero too), after a Möbius step
  (the pole is at *w*₁ = *M*(*z*)), after *z*² ("also at −*z*"); *F* evaluated at the point: |*F*| < 1e-12 or ∞;
  snapping to 0.1 at 110 px/unit and Alt free; one undo step each; Remove (with Undo toast) and Turn into a pole on a
  mark; the old ∮ item opens the integral popover; Y's Add point adds a target; Center and Copy; a right-drag and a
  left-drag pan with no menu; a mark drag and a disc drawing open nothing; Shift+F10, arrows, Esc with focus back,
  the Menu key; touch at 390 px: pan, short press, long press (44 px rows, add zero, exact), slide after the ring, a
  held pinch; dark; Russian (every item Russian, decimal comma); no console errors.
- Node: every `test/t_*.js` passes except `t_sound.js` 64/66 (two audio-queue timing checks; `sound.js` is untouched).
  `t_i18n_keys` 4060 checks pass.
- `test/zp_cmd.js`: pass.
- `test/curves_cmd.js` (copy on 8922): its right-click ∮ check passes; it fails only on "Failed to load resource"
  404s, which that test does not filter (the same noise in every run here).
- `test/sound_cmd.js` (copy on 8922): its right-click "Listen along" check passes; one unrelated fail ("off while six
  sources sound": 12 voices left).
- Quality suite: `run.sh --base-url http://localhost:8922/` PASS (81 runs, 0 failed); `compare.py --only quality
  --quality-enforce-targets` PASS. The menu does not change pane geometry, so goldens are untouched.
- Perf suite: not run (the menu adds no per-frame work; only listeners and a DOM ring during a touch hold).

Screenshots: `work/xvc/test/pm_cdp/shots/pm-x-light.png`, `pm-x-dark.png`, `pm-x-ru.png`, `pm-phase-light.png`,
`pm-phone-light.png`.

## Left for later / notes for the merge

- "Center view here" shows no shortcut: the design gives Z, but Z already fits both planes (app.js). Left as is.
- "Edit in the Inspector" is "Edit ζ₁": it focuses the mark's field wherever one is visible (`[data-k] input[data-zp]`).
  When the Inspector lands, its zero/pole fields should keep `data-k` on a container and `data-zp="kind:i"`.
- Design 2.5 says "for the selected Zeros-and-poles step, or the only one"; the task says every zp step, so every one is
  listed. With `S.sel` (Inspector build) the selected step could be listed first.
- The long press selects a shape under the finger (the press's own select-tool action happens before the ring). As
  before v15.
- The perf gate was not run in this round.

## Review round (2026-10-23)

The 60 findings of the v15 reviews are fixed or answered in `review-v15.md` (ledger: `../ledger-v15.json`). Some notes
above are now out of date: see that file for what changed.

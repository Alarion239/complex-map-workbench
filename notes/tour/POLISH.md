# Guided tour: polish of the engine (work/xvt, 2026-10-23)

User request (2026-10-23): "I love the guide. I am sure it will be changed with the tweaked UI, but please make sure
that it highlights exactly the right area & that it is always on the foreground (even when command-K is opened) and
that the buttons are easy to press and that they always fit inside the box".

Built in `work/xvt`, a copy of v14 (= `work/v15-base`). Only the engine and its CSS changed, in `src/tour.js`. The
content (CHAPTERS, SCENES, ANCHORS, the step texts) is untouched: every change in `src/tour.js` is below line 306,
from `place()` on. No hook was needed in `app.js` or `page.html`.

A review of this round (`notes/tour/review-polish.json`, 9 findings) was then fixed in the same places; the answers are
in `notes/tour/ledger-polish.json` and section 7 below.

## 1. The audit

`test/tour_audit_cmd.js` (CDP, with a copy of `test/cdp_kit`). It walks every chapter and every step, at 360, 390,
430, 768, 1024, 1280 and 1440 px, light and dark, English and Russian, mouse and touch: 56 configurations, 1900 step
views. It does not use the engine's own numbers: it resolves the anchors as INTEGRATION.md says and reads the drawn
SVG paths. So the same audit measures the old and the new engine.

For each step it records:

- the spotlight: each lit element's visible border box (cut by clipping panels and the viewport) against the drawn
  holes and the inner mark, in px; and the corner radius against the element's `border-radius`;
- `cut`: a lit element that could be shown whole but is not (not scrolled into view);
- the callout inside the viewport and the safe area;
- each button: size (touch: 44 × 44 at least; mouse: 36 × 36 at least), the gap to the next button (8 px at least),
  inside the callout, label not clipped;
- text overflow in the callout (`scrollWidth > clientWidth`, an ellipsis, an element out of the callout);
- the topmost element (`elementFromPoint`) at the callout's centre and four corners: it must be the callout.

Passes during a step:

- **layers**: the palette (Cmd+K, on the palette step and on the X step), the Examples menu, the More menu (narrow
  layouts), the export dialog (Cmd+E) and a tooltip over the callout. Checked: the callout is topmost, it does not
  cover the layer, the layer is not covered by the tour, and Esc closes the layer while the tour stays. A layer that
  fills the usable screen (the export dialog on a phone) leaves no room: there the rule is that the callout covers
  none of the layer's controls.
- **follow**: scroll the target's panel by 40 px, resize the window by 40 px, grow the target by 24 px. The spotlight
  must match in the next frame (`lag`) and after six frames (`stale`).
- **focus**: Tab and Shift+Tab stay in the callout, and every focused button shows a ring.
- **safe area**: touch configurations at 430 px and below run with a 47 px notch and a 34 px home bar
  (`Emulation.setSafeAreaInsetsOverride`).

Screenshots of failing cases go to `<kit>/shots/audit-<tag>/`, rows to `<kit>/audit/<tag>.json`.

How to run it (about 9 minutes with four daemons):

```sh
# one kit per daemon (the queue is per folder), each on the same port
cp -R test/cdp_kit test/a1_cdp   # ... a2, a3, a4; set the port in cdpd.js
python3 -m http.server <port> --bind 127.0.0.1   # in dist/
node test/a1_cdp/cdpd.js          # ... one per kit, in the background
# a shard: prepend a config line to a copy of the audit
{ echo "const AUDIT_CFG = { widths: [360, 390], tag: 'x-1' };"; cat test/tour_audit_cmd.js; } > /tmp/x1.js
test/a1_cdp/q.sh /tmp/x1.js       # shards: [360, 390], [430, 768], [1024, 1280], [1440]
node test/tour_audit_merge.js x --fails    # merges every test/*_cdp/audit/x-N.json
```

`AUDIT_CFG` keys: `widths`, `themes`, `langs`, `inputs`, `tag`, `shotsPerKind` (a cap on screenshots per kind and
configuration), `steps`, `layers`, `follow`, `focus`, `safe`, `layerAll` (the widths where the palette and a toast open
on every step), and `page` (another built page in `dist/`, for a before-and-after on one server).

Added after the review (section 7): the sizes 720 × 450, 844 × 390 (landscape) and 1152 × 720; the drawn paths are
mapped to the screen with `getScreenCTM()`; holes that match no lit element, zero-area holes and anchors with nothing on
screen fail; vertical overflow fails; every step that should show must be visited; the layer pass also opens a toast,
the sound settings, the reference guide and the Language menu and checks the ring mask; the focus pass checks that the
focus comes back after the palette.

## 2. Before and after

Both runs use the final audit. "Before" is v15-base's `tour.js` built into `dist/test_base.html` (the rest of the
page is the same; built from a copy of `src/` with the old `tour.js`, then deleted); "after" is this build's
`dist/test.html`. Headless Chrome, ANGLE Metal, port 8941.

| check | before | after |
|---|---|---|
| step views failing (of 1900) | 1900 | 0 |
| spotlight vs target, median / max (px) | 6 / 711 | 0 / 0.75 |
| targets off by more than 1 px (of 2416) | 2376 | 0 |
| corner radius off by more than 1 px | 1796 | 0 |
| target not scrolled into view | 80 | 0 |
| buttons too small | 1900 | 0 |
| button height, min / max (px) | 28 / 36 | 36 (mouse) / 44 (touch) |
| buttons closer than 8 px | 1844 | 0 |
| button outside the callout or label clipped | 52 | 0 |
| text overflow in the callout | 96 | 0 |
| callout outside the viewport or safe area, or covered | 0 | 0 |
| layer checks failing (of 312) | 244 | 0 |
| follow checks failing (of 148) | 148 | 0 |
| focus checks failing (of 56) | 32 | 0 |
| exceptions in the console | 0 | 0 |

Before, in detail: the hole was padded by 6 px and clamped 2 px from the edges, with a fixed 8 or 10 px radius. A
mark was drawn only after a 240 ms morph, also when nothing moved. The buttons were 28 px (36 on a phone with a
mouse), 6 px apart. Russian "Next: Branches and inverses" pushed the footer out of the callout. The palette, menus
and the export dialog covered the callout (layer checks: callout covered 218 times, layer covered 220 times). The
More menu: Esc with the focus in the callout ended the tour and left the menu open. The spotlight lagged a scroll,
a resize and a layout change by a frame or more (the 250 ms poll). Tab left the callout at 768 px and below.

The first baseline (`base`, before the focus and safe-area passes existed) gave the same picture: 1900 of 1900 step
views failing, 240 of 312 layer checks, 148 of 148 follow checks.

Not counted as failures: 20 follow checks skipped where the step's panel does not scroll (768, 1280, 1440 px), and
12 **app findings** (below).

App finding (not the tour): in Russian, at 1024, 1280 and 1440 px, the pattern swatches (`#patternSeg`) reach 3 to
15 px past the left panel's edge, and the panel cannot scroll sideways. The tour lights the visible part exactly; no scroll can
show the rest. The audit reports this as `appOverflow`.

App finding: on a phone with a home bar, the export dialog's top goes above the screen (top at -22 px at 390 × 844):
`.modal-bg` adds the safe area to its bottom padding, but `.modal`'s `max-height` does not subtract it.

Where the numbers are (in `work/xvt/test/xvt_cdp/`): `audit/final-1.json` to `final-4.json` (every row of the after
run) and `audit/final-merged.txt`; `audit/before-merged.txt` (the before run's merged summary; its raw rows survive for
360 and 390 px only, `audit/before-1.json`); `shots/audit-before-*/` (screenshots of the before run's failures, at most
two per kind and configuration). The after run has no failing case, so it has no screenshots.

Other checks, after:

- `node test/t_tour.js`: 933/933.
- `node test/t_tour_engine.js` (new, DOM-free): 18/18. place() with the safe area and open layers (with a fuzz),
  placeDock, rrPath.
- `test/tour_cmd.js`: 92/92. `test/tour_lit_cmd.js`: 70/70. `test/mv_views_cmd.js` (port changed in a copy): pass.
- Frame rate on the deformation step while the transport plays, 1440 × 900: 60 fps before and after.

## 3. What changed in the engine (src/tour.js)

**Layers.** The tour has two roots now:

- `.tour-root` (z 25, as before): the shade only. It stays under the app's popovers, palette and dialogs, so a layer
  the user opens is lit and usable (no hole has to be cut for it, nothing lags).
- `.tour-top` (z 2147483000): the rings and the callout, above every app layer, toast and tooltip. While the app has
  something in the top layer (its More menu is a popover; a modal `<dialog>`), `.tour-top` becomes a manual popover
  and is shown after it, so it stays above. It leaves the top layer when the app's top layer is empty (the app's
  `layerOpen()` counts open popovers, so a tour always in the top layer would read as a layer that never closes).
  `beforetoggle` and `toggle` (capture) drive this, with a microtask and a frame; the focus is kept.
- The rings are masked out of every open layer, so they never draw over what the user opened.
- Open layers: `#popHost > *`, `.modal-bg > *`, `.snd-pop:not([hidden])`, `dialog[open]`, `:popover-open`. An adapter
  may list them itself with the new optional `api.layers()` (elements).
- The callout never covers an open layer. `place()` takes `opt.block` (the layers) and tries every place clear of
  them, then places beside them. With no room it returns `{ mode: 'dock' }` and the callout docks: compact (the
  step's title and ×), in a corner or along the top or bottom edge, where it covers the least (`placeDock`). Over a
  dialog that fills a phone's screen it finds the strip nearest an edge that covers none of the dialog's controls.
- Esc: an open app layer comes first, wherever the focus is (the layer closes, the tour stays). Then Esc in the
  callout ends the tour, as before.
- The tooltip is under the callout now; it is still hidden while it would overlap it.

**The exact spotlight.**

- A hole is exactly the lit element's visible border box (no 6 px pad, no 2 px clamp; `step.pad` still works), cut
  by clipping panels and the viewport, with the element's own corner radii, per corner (`rrPath` takes
  `[tl, tr, br, bl]`). A corner on a cut edge is square. An SVG `<rect>` gives its `rx`.
- The ring and the glow are drawn just outside the hole (0.75 px and 3.5 px out), so they never cover the target. The
  dashed mark of an anchor inside a lit panel is drawn 0.75 px outside the anchor.
- Measured after settling: the step's actions, two frames, its wait, the fonts (`document.fonts.ready`, 1 s at most),
  the scroll into view, then until the lit area is the same in two frames running (700 ms at most).
- Follows in the same frame: scroll (capture, any panel) and resize are handled as they fire; a ResizeObserver
  watches the lit elements, the callout, the page and the open layers; a MutationObserver (body, subtree: child
  list, class, style, hidden, open) and `transitionrun` / `animationstart` start a motion loop that lays out every
  frame until things are still. The 250 ms poll stays as a safety net. The morph between steps aims at the target as
  measured in each frame, and is skipped when the lit area does not move (the mark then shows at once).
- Scrolled into view: every scrolling panel around the target scrolls (instantly) so the whole target shows when it
  fits, before the page band logic. On a phone, when the anchor and its `also` area cannot both fit, the anchor is
  shown whole, at the band's edge toward the other area.
- Anchors may now be an Element (HTML or SVG), a list of Elements (a composite anchor: each is lit exactly), or a
  region `{ el, rect }` (a part of a canvas: `rect` is `{ x, y, w, h }` in CSS px from the element's corner, or a
  function returning a client rect).

**Buttons.**

- Mouse: 36 × 36 at least (the × is 36 × 36, the footer buttons 36 px tall). Touch (`pointer: coarse`): 44 × 44. 8 px
  apart.
- The footer wraps (never clips). "Next: <chapter>" shortens to "Next" when it would not fit its row, and keeps the
  full label as its accessible name.
- A visible focus ring on every callout button (2 px accent, 2 px offset).

**The callout.**

- Always inside the viewport and the safe area: `place()` takes `opt.safe` (read from an `env(safe-area-inset-*)`
  probe); the phone sheet's top is set in px for every edge.
- `max-height` is the viewport less margins and safe area; the title, body and Try it scroll inside (`.tour-scroll`),
  the head and the footer stay.
- The chapter line wraps instead of an ellipsis; long words break.

`Tour.lit()` adds `docked`, `layers` (how many are open) and `moving` (the morph or a step change is in progress).
`Tour._t` adds `placeDock` and `rrPath`.

**After the review (section 7).** An anchor clipped away by a panel that cannot scroll is never lit as an empty line:
the next name of its list is lit, else the step is skipped. Every skip has a reason and is reported
(`Tour.skipped()`, `Tour.lit().skipped`, a console warning once per step and run). A toast moves clear of the callout.
Esc and Tab stand aside for every layer the engine keeps clear (the sound settings too), and Esc in the callout reaches
a layer the app's own Esc does not close. The focus comes back to the callout when the layers it left for close. The
drawing uses each SVG's own box, so a classic scroll bar does not shift it. The docked strip is compact and narrows
into the strip beside a dialog, or shows the × alone, before it covers a layer. A formula on the last line no longer
makes the text scroll.

## 4. Hooks in app.js and page.html

None. The app needs no change. Optional: `api.layers()` in the adapter, when v15's layers are not matched by the
default selector above.

## 5. For the merge into v15

- The 3-way merge against `work/v15-base` should be clean: this build changed `src/tour.js` only from `place()` on
  (the content is above it; lines 1-299 are identical to v15-base, checked again after the review round). New files:
  `test/tour_audit_cmd.js`, `test/tour_audit_merge.js`, `test/t_tour_engine.js`.
- The steps the audit reports as skipped need content work in v15 (section 7): a fallback anchor or a `panel` action.
- After the merge, run `node test/t_tour.js`, `node test/t_tour_engine.js`, `test/tour_cmd.js`,
  `test/tour_lit_cmd.js` and the audit (section 1). For a before-and-after, build the old engine into another page in
  `dist/` and pass `page` in `AUDIT_CFG`.
- The audit's layer pass opens the palette (Cmd+K), `#examplesBtn`, `#hdrMoreBtn` / `#hdrMenu`, the export dialog
  (Cmd+E), `#tip`, a toast (`__tourApi.toast`), the sound settings (`#soundMore`), the guide (`__tourApi.openGuide`)
  and the Language menu (`#langBtn`). Its follow pass uses the steps `analysis/5` (scroll), `basics/1` (resize) and `basics/6`
  (layout). If the new layout renames these or the steps move, change those lines.
- If v15 adds a layer outside `#popHost`, `.modal-bg`, `.snd-pop`, `dialog` and popovers, give the adapter
  `layers()`.
- INTEGRATION.md, after the review round: an anchor cut to (almost) nothing by a panel that cannot scroll counts as
  missing (the next name of its list is lit, else the step is skipped); `Tour.skipped()` lists the skipped steps and
  why; a toast moves clear of the callout; the docked callout may show the × alone.
- INTEGRATION.md needs two lines updated (I did not edit it: other work may be editing notes/tour): the tooltip is no
  longer above the callout (the callout is above every layer), and the tour root now comes as two roots,
  `.tour-root` (the shade, z 25) and `.tour-top` (the rings and the callout).

## 6. Left open

- Real devices were not tried. The safe area and touch were emulated in headless Chrome.
- A dialog that fills a phone's screen (export) leaves no room: the docked callout sits over it, clear of its
  controls (over its title).
- The tooltip check is synthetic (the tooltip is placed over the callout).
- The two app findings in section 2 are outside the tour. So is the third (section 7): in phone landscape the panes
  collapse to a 24 px strip, so three deformation steps cannot be shown.

## 7. The review of this round (review-polish.json)

Nine findings. Each has an entry in `notes/tour/ledger-polish.json` (root, change, evidence, what is left). All nine
are fixed in the engine or the audit. Two need work outside the engine: content anchors (polish-3) and the app's
landscape layout (polish-1).

| id | what was wrong | fix |
|---|---|---|
| polish-1 | phone landscape: an anchor cut to a 0 px line was lit as an empty strip | an anchor clipped away by a panel that cannot scroll gets no hole; the next anchor name is lit, else the step is skipped and reported |
| polish-2 | toasts hidden under the callout | a covered toast moves just clear of the callout; the rings are masked off it |
| polish-3 | steps skipped silently | every skip has a reason, a warning and `Tour.skipped()`; the audit fails every step not visited |
| polish-4 | Esc and Tab ignored the sound settings | every open layer counts; Esc in the callout reaches a layer the app does not close itself |
| polish-5 | the audit could pass a wrong spotlight | CTM mapping, unexplained and zero holes, ring mask, vertical overflow, more layers, landscape and zoom sizes, visited list |
| polish-6 | viewBox from innerWidth (classic scroll bars) | each SVG's viewBox is its own box; the viewport is `clientWidth/Height`; the card uses 100 %, not 100vw |
| polish-7 | the text scrolled by 2 px under a formula | MathJax's hidden copy is kept inside the formula |
| polish-8 | the dock overlapped the guide's gutter | a compact dock that narrows into the gutter, then the × alone, before it covers a layer |
| polish-9 | focus lost after the palette | the focus goes back to the callout when the layers it left for close |

**The audit after the fixes** (`fin`, 5 daemons, port 8943, about 15 minutes): 10 sizes (360, 390, 430, 720 × 450,
768, 844 × 390, 1024, 1152 × 720, 1280, 1440), light and dark, English and Russian, mouse and touch: 80
configurations.

| check | result |
|---|---|
| step views | 2688 |
| failing step views, other than skipped steps | 0 |
| spotlight vs target, median / max (px) | 0 / 0.75 (3404 targets, none over 1 px) |
| holes that match no lit element, zero-area holes, anchors with nothing on screen | 0 |
| buttons: height min / max (px), too small, closer than 8 px, outside the callout, clipped | 36 / 44, 0, 0, 0, 0 |
| text overflow (horizontal, vertical, a scrolling sliver) | 0 |
| callout outside the viewport or safe area, or covered | 0 |
| layer checks failing (of 968: palette, Examples, More, export, toast, sound, guide, Language, tooltip; and the palette and a toast on every step at 390, 768 and 1440 px) | 0 |
| rings drawn over an open layer | 0 |
| follow checks failing (of 220; 20 skipped where nothing scrolls) | 0 |
| focus checks failing (of 80, with the return after the palette) | 0 |
| exceptions in the console | 0 |
| skipped steps (88 step views; 26 step and layout pairs, below) | content or app |

The skipped steps (each fails in the audit, with the engine's reason):

- `views/key`: missing at 720 × 450 (EN and RU), 768 RU, 1024 RU and 1280 RU, where `#wKeyChkR` is in the overflow
  popover. At 844 × 390 it is clipped away (EN, and RU with a mouse) or missing (RU, touch).
- `basics/shapes`, `basics/formula`, `views/patterns` (missing): 768 and 844 × 390. The left panel is a closed drawer.
- `deform/transport`, `deform/paths`, `deform/order` (clipped): 844 × 390 touch. The panes collapse to a 24 px strip.

For v15 (content, work/xva): give these anchors a fallback name or a `panel` before-action. The engine uses a fallback
name by itself. The landscape panes are an app finding.

App findings (lit exactly, but the app cuts the target and nothing can scroll it into view): 844 × 390: basics/draw,
views/sphere, analysis/guarantees, branches/sheets, views/key, and the deformation steps with a mouse; Russian at
1024-1440: views/patterns (`#patternSeg`, as in section 2).

**Other checks, after the review round:** `node test/t_tour.js` 933/933; `node test/t_tour_engine.js` 29/29 (11 new:
`clippedAway`, `dockGutter`, `placeDock().over`); `test/tour_cmd.js` 92/92; `test/tour_lit_cmd.js` 70/70;
`test/mv_views_cmd.js` (port changed in a copy) pass; 60 fps on the deformation step while it plays, 1440 × 900.

**Where the numbers are:** `work/xvt/test/pol_cdp/audit/fin-1.json` to `fin-5.json` (every row) and
`fin-merged.txt`. Screenshots: `work/xvt/test/pol_cdp/shots/p2-toast.png` (a toast moved above the callout, 390 RU
dark) and `p8-guide.png` (the dock beside the guide at 1024 RU, taken before the dock lost its vertical padding).

**Not covered:** classic scroll bars could not be shown in headless Chrome on this Mac (overlay scroll bars). The fix
was checked by narrowing the fixed roots by 15 × 9 px: the drawing's CTM stays the identity and the hole equals the
anchor. Real devices were not tried.


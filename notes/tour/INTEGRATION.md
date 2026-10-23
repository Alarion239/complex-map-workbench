# Guided tour: integration

`src/tour.js` defines one global, `Tour`. The app hands it a small adapter once with `Tour.init(api)` and wires three
entry points. The tour degrades step by step, never as a whole:

- a missing optional method is skipped;
- a step whose anchor is missing (or not visible) is skipped, in the direction of travel;
- a step on a feature the app says it lacks (`api.has(feature) === false`) is left out from the start, so "3 of 4" counts
  only what is shown.

One part is **not** optional: the tour borrows the canvas for its own scenes only when it can give the user's work
back. That needs the trio `snapshot`, `restore`, `loadScene`, and a saved copy on disk that stays the user's (§3, "The
user's work"). Without them the tour runs without scenes: only the steps that change nothing are shown (Export: Figures
for articles; Palette and keys), and a chapter with none of those says "The tour is not available in this build."

The tour is checked against this file: `test/t_tour.js` reads the **Anchors** and **Events** tables below and fails when
a step uses a name that is not listed, or a listed name has no default. Keep the tables and the code in step.

## 1. Build (build.py)

Add `'tour.js'` to the file list, after `'view.js'` and before `'app.js'`:

```py
for f in ['cx.js', 'parse.js', 'funcs.js', 'inverse.js', 'calc.js', 'glsl.js', 'region.js', 'curves.js', 'sphere.js', 'gl.js', 'view.js', 'tour.js', 'app.js']
```

The module injects its own CSS on first use (`<style id="tourCSS">`), written on the app's tokens and components, so
`page.html` needs no new rules. It uses these app pieces as they are: the tokens (`--surface`, `--line`,
`--line-strong`, `--ink`, `--ink-2`, `--muted`, `--faint`, `--accent`, `--accent-soft`, `--accent-ink`, `--good`,
`--r-3`, `--r-4`, `--shadow-3`, `--f-ui`, `--f-math`, `--f-mono`, `--t-body`, `--t-caption`, `--t-readout`,
`--t-fast`, `--t-med`, `--t-slow`, `--ease-out`, `--ease-std`), the classes `.btn.primary`, `.btn.ghost`,
`.icon-btn`, `.icon-btn.small`, `.kbd`, `.pop.menu` with `.menu-head`, `.mi`, `.mi-ic`, `.mi-label`, `.mi-key`,
`.msep`, the keyframes `pop-in` and `fade-out`, and the hover tooltip `#tip` (hidden by the tour while it would cover
the callout; it sits at z 70, above the callout's 35). Renaming one of these changes the tour's look.

One markup change is recommended in `page.html`: the help button now opens a menu, so

```html
<button class="icon-btn" id="helpBtn" title="Help  ?" aria-label="Help" aria-haspopup="menu" aria-expanded="false" ...><span class="mlabel">Help</span>
```

(today: `title="Guide  ?"`, `aria-label="Guide"`, label Guide).

## 2. Wire it (app.js)

```js
// at the end of init(), once the state is loaded and the UI is built
Tour.init(tourApi);       // also puts the user's work back if a tour was cut short by a reload or a crash
if (!NS) Tour.suggest();  // the first-run card; never under ?ns= (tests and golden images stay as they are)

// the help button opens the help menu: the tour by chapter, then the reference guide and the shortcuts
$('helpBtn').addEventListener('click', (e) => Tour.openHelpMenu(e.currentTarget));   // replaces openGuide

// '?' keeps opening the guide directly. The palette may offer the chapters:
for (const c of Tour.chapters()) items.push({ label: `Tour: ${c.title}`, run: () => Tour.start({ chapter: c.id }) });
```

- **Autosave.** While a tour runs, the app must not save the tour's scenes over the user's work: `sandbox(true)`
  flushes any pending save and then suspends autosave until `sandbox(false)` (§3). The saved state on disk is then
  always the user's own work, and a reload during a tour simply loads it.
- **Undo.** The tour's scene changes must not stay in the undo history: `snapshot()` keeps the history in memory (its
  `mem` part), and `restore()` puts it back.
- **Escape.** The tour ends on Escape only when the focus is in its callout, or when the app has nothing of its own to
  cancel. The app reports that with `busy()` (§3). Nothing else to do: the tour lets the key through to the app's own
  handler whenever `busy()` is true.
- **Phones.** On a phone the help button sits in the ⋯ menu (`#hdrMenu`), which closes on the click. The help menu
  then opens under ⋯ (it re-measures after a frame), and the tour's copy says "under ⋯ › Help". Nothing to do.

## 3. The adapter

```js
const tourApi = {
  // ---- where things are
  anchor(name) -> Element | null | undefined,
  //   the element to light for a name of the Anchors table; null: it does not exist now (the step is skipped);
  //   undefined: use the tour's default (the third column), written for today's markup.
  has(feature) -> boolean,               // false: this build lacks the feature (the Features table); steps on it are
                                         // left out. Omitted, or true: assume it is there.
  storageKey(k) -> string,               // the app's lsk: namespaced storage keys ('cmw-tour', 'cmw-tour-stash',
                                         // 'cmw-tour-live')

  // ---- the user's work (REQUIRED for the tour's scenes: snapshot, restore and loadScene together, see below)
  snapshot() -> { state, mem },          // state: JSON-serialisable, what writeState saves (the persisted state,
                                         // with the user's look: pattern, opacity, heights, styles); mem: what lives
                                         // in memory only (the undo history and its index, the focus, the transport,
                                         // the open panels). Must not be null
  restore(snap, opt) -> boolean,         // put it back exactly, in place, then save(). Return false (or throw) when it
                                         // could not. After a reload or a crash it gets { state } only and
                                         // opt = { fromStash: true }: rebuild from state, start a fresh history
  sandbox(on),                           // on = true: flush any pending save (writeState now), then suspend autosave;
                                         // on = false: resume it (restore() has already put the user's work back).
                                         // Strongly recommended; return false if it cannot pause

  // ---- what a step does before it shows (only while the tour holds the user's work)
  loadScene(spec) -> boolean,            // spec: an example in the EX format (name, view, shapes, targets, steps, focus);
                                         // like loadExample, but it must not set the Examples label or currentExample.
                                         // Return false if it cannot (an unknown step type): its steps are skipped.
                                         // It may ignore spec.look: the tour calls setLook(spec.look) right after
  setLook(look),                         // the display the copy assumes (the Look keys below); a key the app does not
                                         // know is ignored, null means the app's default
  setView(main),                         // 'xy' | 'phase' | 'land'                         (setMain)
  setSurface(pane, surf),                // pane 'L' | 'R', surf 'plane' | 'sphere'          (setView(side, surf))
  setDeformation(on),                    // open or close the transport, as M does          (openTransport / closeTransport)
  setTool(id),                           // 'select', 'disc', … (the ids of TOOLS)          (setTool)
  focusStep(k),                          // 0 = Whole chain, k = step k                      (setFocus)
  showPanel(side),                       // 'left' | 'right': open a collapsed side panel   (setPanels)

  // ---- feedback
  on(event, fn) -> unsubscribe,          // the Events table; fn(payload)
  tex(src) -> Element,                   // inline TeX: (src) => { const s = h('span'); TeX.set(s, src); return s; }
  toast(message),                        // the app's toast
  openGuide(section?),                   // the reference guide; section 'keys' scrolls it to the shortcuts
  busy() -> boolean,                     // the app has something Escape cancels: a drawing in progress (a draft, a
                                         // polygon or lasso being placed), a drag, a selected shape, an open overlay
                                         // drawer, the tools' More menu (#toolMore), the coordinate pad. While true,
                                         // Escape outside the callout reaches the app and the tour stays.
                                         // Default: #toolMore[open] only
  layerOpen() -> boolean,                // optional: a menu, the palette or a dialog is open, so Escape and Tab are
                                         // the app's. Default: '#popHost > .pop, .modal-bg, .pal, .palette,
                                         // [popover]:popover-open' exists
  hasWork() -> boolean,                  // optional: saved work existed at this opening (a returning user): the
                                         // suggestion reads "Take the 2-minute tour", not "New here?"
  onTour(active), onSuggest(shown),      // optional notifications (not sent when one chapter hands over to another)
};
```

A tiny emitter is enough for `on`: `const L = {}; const on = (e, f) => ((L[e] ||= []).push(f), () => { L[e] = L[e].filter((g) => g !== f); });`
and `const emit = (e, p) => (L[e] || []).forEach((f) => f(p));` called at the places of the Events table.

### The user's work

On `Tour.start` the tour calls, in order: `sandbox(true)`, `snapshot()`, then stores `{ page, snap: { state } }` in
`cmw-tour-stash` and reads it back. It shows its scenes only when `snapshot`, `restore` and `loadScene` exist,
`snapshot()` returned a value without throwing, and either the autosave is paused (`sandbox(true)` did not return false
or throw) or the stash was stored and read back. Otherwise it runs without scenes (above).

- **Every way out** (Finish, Done, ×, Esc) calls `restore(snap)` with the in-memory snapshot. Only when it succeeds
  does the tour call `sandbox(false)`, drop the stash and say "Your work is back". When it fails, the autosave stays
  paused (the saved copy is still the user's), the stash is kept, and the toast says "Your work could not be put back
  here, but it is safe: reload the page to get it back."
- **A reload or a crash.** With the autosave paused, the saved state is the user's and simply loads. `Tour.init` then
  finds the stash and calls `restore({ state }, { fromStash: true })`; the stash goes only once that succeeds.
- **Other tabs.** While a tour runs, its page writes a heartbeat (`cmw-tour-live`: `{ page, t }`, every 2 s). Another
  page's `Tour.init` leaves a stash alone while that heartbeat is fresh (under 6 s), and a second `Tour.init` in the
  page that runs the tour only replaces the adapter.
- **A chapter started inside the tour** (the help step, the palette, the help menu) takes the running tour over: the
  first snapshot, the paused autosave and the stash stay, and the app gets no `onTour(false)` / `onTour(true)`.

### Look

`loadScene` is followed by `setLook(spec.look)`. Each scene sets every key, so the user's own display never makes the
copy false; `restore()` brings the user's look back with their state.

| key | values | the app's field |
|---|---|---|
| `pattern` | the ids of PATTERNS (`'checker'`, `'polar'`, `'stretch'`, …) | `S.pattern` |
| `alpha` | a number, or null for the app's default | `S.alpha` |
| `height` | `'log'`, `'abs'`, `'re'`, `'im'` (Landscape) | `S.height` |
| `sheets` | boolean (Landscape: All sheets) | `S.sheets` |
| `phaseStyle` | the ids of DC_STYLES (`'enhanced'` is Tiles) | `S.dc` |
| `paths` | boolean (the transport's Paths) | the deformation round's paths flag |
| `allAtOnce` | boolean (the transport's All at once) | the deformation round's order |

### Anchors

The tour asks `api.anchor(name)` for these names. A step may list fallbacks (`['exportBtn', 'moreBtn']`): the first
visible one wins, which is how the phone layout (header items in ⋯) is handled. "Visible" means connected,
`checkVisibility()`, and a box larger than 1 px. Return the whole section, not its heading; return elements that stay
put while the step shows. The lit patch is the element's box cut by its scrolling ancestors; ancestors that cannot clip
(`display: contents`, such as `#hdrMenu` on a wide screen, or a 0 × 0 box) are passed over.

| name | what | default |
|---|---|---|
| `paneL`, `paneR` | the X pane, the Y pane | `#paneL`, `#paneR` |
| `panes` | both panes, or the one wide panel (Phase, Landscape, the merged deformation plane) | `#panes` |
| `surfaceL`, `surfaceR` | the Plane · Sphere control of the left (or only) panel, of Y | `#leftTabs`, `#rightTabs` |
| `tools`, `toolsRail`, `tool:disc` | the Draw section, the collapsed rail's tools, the Disc tool | `#secDraw`, `#railTools`, `.tool[data-tool="disc"]` |
| `formula`, `shapes` | Region from a formula, the shape list | `#secFormula`, `#secShapes` |
| `display`, `patterns` | the Display section, its pattern swatches | `#secDisplay`, `#patternSeg` |
| `chain`, `addStep` | the function chain, its add card | `.pipe-wrap`, `#addStepBtn` |
| `zpCard` | the card of a zeros-and-poles step | the `.card` around `.params.zp` |
| `invBtn` | the f⁻¹ button of the first card that has one | the `.card button` whose label is f<sup>−1</sup> |
| `sheets` | the All sheets check of the Landscape options | the label around `#sheetsChk` |
| `phaseKey` | the Phase key check of Y's options (X → Y, Y on its plane) | the label around `#wKeyChkR` |
| `soundBtn`, `soundBar` | the Sound control of the top bar (the sound round); on a phone with sound on, its button left in the bar | `#soundBtn`, `#soundPh` |
| `phaseStyle` | the Phase style control of the Phase view's options (Tiles … Cauchy) | `#dcSeg` |
| `examples`, `palette`, `exportBtn`, `helpBtn`, `moreBtn` | the top bar | `#examplesBtn`, `#cmdBtn`, `#exportBtn`, `#helpBtn`, `#hdrMoreBtn` |
| `viewSwitch`, `deformToggle` | X → Y · Phase · Landscape; Deformation | `#viewSwitch`, `#morphBtn` |
| `transport`, `paths`, `allAtOnce` | the docked transport, its Paths toggle, its One after another / All at once select | `.tdock:not([hidden])`, `#pathsBtn`, `#homOrderSel` |
| `rightPanel` | the right side panel | `#rightPanel` |
| `composite`, `guarantees`, `domain`, `matrix` | the right panel's sections: Composite map, Guarantees, Natural domain, Step by step | `#propsPanel > section:nth-of-type(1)` … `(4)` |

### Features

| feature | what | the steps left out without it |
|---|---|---|
| `zp` | the zeros-and-poles step type (`funcs.js` `id: 'zp'`) | Analysis: Zeros and poles (its scene uses it). The integral and the natural domain then use the typed formula 1/(z²+1) instead of the zp step |
| `allAtOnce` | the One after another / All at once select of the transport | Deformation: All steps at once |
| `sound` | the Sound control (`typeof Sound !== 'undefined'`) | Palette and keys: Sound |

Before integration (v12) both are missing; the demo adapter returns `has('zp') === false` and
`has('allAtOnce') === false`. After the deformation round lands, the app can omit `has` or return true.

### Events

Each event ticks the Try it of the steps that wait for it. An event the app never emits only means that Try it never
ticks; Next always works. Emit them where the user's action lands; emitting them for the tour's own calls (setView,
setDeformation, ...) is harmless, because a step starts listening only after its own actions have run.

| event | payload | emit when |
|---|---|---|
| `probe` | `{ pane: 'L' \| 'R', w: [re, im] }` | the pointer (or a held finger) probes a point (the hover preimages); the tour waits for a `'R'` probe inside the unit disc and one outside it (without `w`, any `'R'` probe) |
| `shape-added` | `{ kind, plane: 'z' \| 'w' }` | a shape or a target is added (drawn, typed, pasted) |
| `shape-moved` | `{ id, plane }` | a drag moves or reshapes a shape or a target (once, at the end of the drag) |
| `step-focused` | `{ k }` | the focus changes (0 = Whole chain) |
| `pattern-changed` | `{ id }` | the region pattern changes (`'checker'`, `'stretch'`, …, the ids of PATTERNS) |
| `view-changed` | `{ main }` | the view switch changes (key or click) |
| `deformation-toggled` | `{ on }` | the transport opens or closes |
| `deformation-t` | `{ t }` | the user scrubs t (not while playing) |
| `paths-toggled` | `{ on }` | Paths is toggled (button, P, palette); the tour waits for two |
| `integral-opened` | `{ shape }` | the integral popover opens |
| `palette-opened` | `{}` | the command palette opens |
| `zp-moved` | `{ kind: 'zero' \| 'pole', i }` | a zero or a pole of a zeros-and-poles step is dragged |
| `cut-moved` | `{ k, cut }` | a branch cut's handle is dragged (once, at the end of the drag) |

### The scenes the tour loads

`loadScene` receives these (`SCENES` in `tour.js`), in the EX format. Each is an app example or the same map written
another way, so nothing new is needed beyond `zp`. Every scene's look is Checker, the default opacity, height log|F|,
one sheet, the Tiles phase style, Paths on and One after another, except where the table says.

| scene | map | shapes | targets |
|---|---|---|---|
| Strip to disk | `exp`, then Möbius (1, −1; 1, 1): F = (eᶻ − 1)/(eᶻ + 1) | the strip \|Im z\| < π/2, the line Im z = 0.8, the point z₀ = 0 | |
| A rational map | custom (z² − 1)/(z² + 1) | the square [−1.5, 1.5]² | |
| Zeros and poles | `zp`: a = 1, zeros 1, −1, poles i, −i (the same map) | the square [−1.5, 1.5]² | |
| Roots as preimages | custom z³ − 1 | the unit circle | the point 0, the circle \|w\| = 0.6 |
| A residue by integration (`residueZp`, needs `zp`) | `zp`: a = 1, no zeros, poles i, −i: 1/(z² + 1) | the circle \|z − i\| = 1 (its integral popover closed) | |
| A residue by integration (`residue`) | custom 1/(z² + 1) | the circle \|z − i\| = 1 (its integral popover closed) | |
| Logarithm of an annulus | `log` (cut 180°, sheet 0), focus 1 | the annulus 0.5 < \|z\| < 2, the unit circle, a segment | |
| The derivative in the chain | custom z³ − 3z, then `deriv` | the disc \|z\| < 1.6 and a polar grid | the point 0 |
| Every sheet of the logarithm | `log` (cut 180°, sheet 0); look: height Im, All sheets | the annulus 0.5 < \|z\| < 2 | |

## 4. Public API

```js
Tour.init(api) -> Tour                    // once (calling it again replaces the adapter); restores a stash (§3)
Tour.suggest({ delay = 1200, force }) -> boolean
                                          // schedules the first-run card unless the tour was taken or dismissed, or the
                                          // card was already shown 3 times; it waits for open menus and dialogs
Tour.dismissSuggestion()
Tour.start({ chapter = 'basics', step = 0, opener }) -> Promise<boolean>
                                          // false: nothing of that chapter can be shown here (a toast says so)
Tour.stop({ finished })                   // ends and restores (× , Esc, Done and Finish call it)
Tour.next(), Tour.back()
Tour.openHelpMenu(anchorEl), Tour.closeHelpMenu()
Tour.isSeen(), Tour.isActive(), Tour.current() -> { chapter, step, id } | null
Tour.lit() -> { holes: [{ l, t, r, b }], side, edge, anchor: { l, t, r, b } | null, scenes, scene } | null
                                          // the spotlight's geometry, for browser checks
Tour.chapters() -> [{ id, title, time, steps, done }]
Tour.reset()                              // forget the record (a "Show the tour suggestion again" command); a stash is kept
Tour.VERSION                              // bump with a content change; chapters with a newer `rev` show New
```

Chapter ids: `basics`, `views`, `deform`, `analysis`, `branches`, `export`, `keys`.

Storage, all through `api.storageKey`: `cmw-tour` holds `{ v, shown, outcome, done, last }` (see DESIGN.md);
`cmw-tour-stash` the backup `{ page, snap: { state } }` while a tour runs; `cmw-tour-live` its heartbeat `{ page, t }`.

## 5. Checks to keep green

- `node test/t_tour.js`: the content against this file, the copy (including what a phone shows), the scenes' looks,
  the placement (with a fuzz), the lit areas, the record and the stash through a fake `localStorage` (other pages'
  heartbeats, failed restores), the first-run rules, the step order with absent features and without scenes. DOM-free.
- `test/tour_cmd.js` (CDP, with a copy of `test/cdp_kit`): today it drives `notes/tour/harness.html`. After
  integration, point `U` at `dist/test.html?ns=…`, replace the URL modes (`tour=step`, `tour=suggest`, `tour=menu`) by
  `ev('Tour.start({ chapter, step })')`, `ev('Tour.reset(); Tour.suggest({ delay: 0, force: true })')` and a click
  on `#helpBtn`, and expect the zeros-and-poles and All at once steps to show instead of being skipped. The checks stay
  the same; the lit-patch check walks every step at 1440 × 900 and 1024 × 700.
- The quality and perf suites run under `?ns=`, where the card never shows, so their golden images are unaffected.

## 6. As built (work/xt, 2026-10-22, on the base notes/gate-morph-zp-r1)

Files changed: `build.py`, `src/app.js`, `src/page.html`, `src/tour.js`, `test/t_tour.js`, `test/tour_cmd.js`,
`test/tour_lit_cmd.js`.

**Build.** `tour.js` sits after `view.js` and before `app.js`. The published file has no test hooks (`__tourApi` and
`__tourTap` live between the TEMP-DEBUG-HOOK markers).

**app.js** (one block after `init`'s helpers, "guided tour"; one-line hooks elsewhere):

- `tourApi` has every method of §3. `anchor` returns undefined (the defaults fit this markup).
- `has`: `'zp'` is `!!Funcs.DEFS.zp`, `'sound'` is `typeof Sound !== 'undefined'`, anything else true.
- `snapshot`: `state` is exactly what `writeState` saves; `mem` holds the undo history and index, the panels as
  shown, the transport, the tool, the selection, the planes' views and cameras, the views' memories and the Examples
  label.
- `restore`: in place, then `save()`. From a stash it sanitises the state as a reload does and starts a fresh history.
- `sandbox(true)` writes any pending save, then `writeState` writes nothing until `sandbox(false)`.
- `loadScene` is `loadExample(-1, spec)`: the Examples label and `currentExample` stay the user's.
- `setLook` sets `S.pattern`, `S.alpha`, `S.height`, `S.sheets`, `S.dc`, the Paths flag and the order.
- `busy`: a draft, a drag, a selection (shape, zero or pole), the coordinate pad, the tools' More menu, an open drawer.
- `layerOpen`: a popover of the app (palette, integral, options), the pad, a dialog, an open popover.
- `onTour(true)` closes the coordinate pad. `onSuggest` is not used: nothing in the app competes with the card.
- Events: all thirteen of the table. `probe` builds its payload only while a step listens.
- Entry points: `Tour.init(tourApi)` at the end of `init()`; `Tour.suggest()` only without `?ns=`; the help button
  (`#helpBtn`, now labelled Help) opens `Tour.openHelpMenu`; `?` still opens the guide; the palette lists
  "Tour: <chapter>" for each chapter under Actions.

**Content added in this round** (still 7 chapters, now 35 steps; 34 without Sound):

- Views: Phase key (anchor `phaseKey`).
- Analysis: Cauchy integral, on the roots scene in Phase with the Cauchy style (anchor `phaseStyle`, `#dcSeg`;
  on a phone, where that control sits in the options sheet, the panes). Analysis is now 6 steps.
- Analysis, Zeros and poles: one sentence on the coordinate pad (the axes button beside a complex parameter).
- Palette and keys: Sound, left out unless `typeof Sound !== 'undefined'`. Anchors `soundBtn`, then `soundBar`
  (`#soundPh`, the sound round's top-bar button on a phone while sound is on), then `moreBtn`.
- The export chapter is unchanged: `exportBtn`, then `moreBtn`.

**Header at 1024 px** (DESIGN.md, open points). A long example name ran the bar past the right edge (help button at
1030 to 1040 px, so the page scrolled sideways). Fix in `page.html`, from 1024 px up: the search field gives way
first, down to its 150 px minimum, then the Examples button, whose name ends in an ellipsis. Checked for every
example at 1024, 1100, 1280 and 1440 px: no overflow; the bar is unchanged when it fits.
Not fixed (it was there before, and it is outside the tour): from 768 to 1023 px the bar still overflows, at 900 px by
53 px or more even with the default label (the wordmark returns at 900 px). It needs a design decision.

**Checks** (headless Chrome on port 8833, this build's `dist/test.html`):

- `node test/t_tour.js`: 921/921.
- `test/tour_cmd.js`: 91/91 (now also the Cauchy step, and Tiles back on the next scene).
- `test/tour_lit_cmd.js`: 68/68 (every step at 1440 × 900 and 1024 × 700).
- Phone (390 × 844): the Cauchy step shows with the panes lit; Palette and keys counts 2 steps without Sound.
- Shots of this build: `shots/tour-cauchy-light.png`, `shots/tour-phone-cauchy.png`, `shots/header-1024.png`.
- `test/mv_views_cmd.js` (port 8833): pass.
- Quality suite: 81 runs, 0 failed; `compare.py --only quality --quality-enforce-targets`: PASS. It runs under
  `?ns=`, so the first-run card never shows.
- Other node tests unchanged from the base. `t_sphere.js` reports 1 failure ("z^2 of unit circle"), the same with the
  base sources (sphere.js is untouched).
- Perf was not run: another engineer's paired perf run (work/xs) was in progress.

## Review fixes on the merged build (2026-10-22 evening)

Details: `notes/export-design/AS-BUILT.md`, section "Review fixes on the merged build". Adapter changes:

- `savedMark()` (new, optional): a fingerprint of the saved copy, or null. The backup records it with `paused`.
  A paused backup is dropped, never restored, when a saved copy exists. The heartbeat is cleared on `pagehide`.
- `toast()` returns the toast element, so the tour can remove its own "Your work is back" toast at the next start.
- `busy()` also counts a playing Listen along and a keyboard loop.
- Steps: Preimages and Targets anchor on `paneR` with `paneL`; Derivative on `paneL` with the chain; `views/key` is
  `wide` (left out below 640 px); `basics/shapes` is `tryWide`. `place()` has a near-miss mode `edge`.

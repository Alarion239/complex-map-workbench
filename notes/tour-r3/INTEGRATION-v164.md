## 9. v16.4: the docked strip, completion, the Sound chapter

The addendum to `notes/tour/INTEGRATION.md` for tour r3 (`notes/tour-r3/SPEC.md` §6), built in `work/xvtr`. Until the
merge folds it into INTEGRATION.md as section 9, `test/t_tour.js` reads the two files as one. Every call below is
optional: a missing one leaves its steps out or its feature off.

### Adapter calls added in v16.4

| call | does |
|---|---|
| `slot(where)` | `where`: `'stage'` (the stage's first row; a phone's row under the header) or `'head'` (a landscape phone's header, right of ⋯). Returns the slot element (`#tourSlot`, `#tourHeadSlot`); null, or no method: the tour inserts the strip as the first child of `.stage` itself. The app also shares out a phone's height again (`Phone.geometry`) |
| `sceneSpec(name)` | `'song'`: the Grieg example's spec (the `EX` entry built from `SEASONG`: `{ name, tex, view, fit, shapes, steps, rightMode, dc }`, its curve keeping `listen`), or null |
| `listen()` | Listen along the current scene's curve: the shape with `listen`, else its last closed curve; turns sound and Mathematical events on through `soundHold` when they are off, then plays once the engine runs (as `sndTurnOnListen`). Called inside the act button's click. Returns false without Web Audio |
| `soundHold(prefs)` | `prefs`: any of `{ on, events, sonify }`, `true` to hold that value on, `null` to give that key back; `soundHold(null)` gives everything back. The user's values are remembered at the first hold and written to `cmw-tour-sound` (through `storageKey`), so a crash gives them back at the next start; each comes back at the release unless the user changed it meanwhile. Returns true while anything is held |
| `soundStop()` | stops a running Listen along (`sndStopPlay(false)`); the tour calls it before every step change and at the end |
| `soundReady()` | sound on, Mathematical events on and the audio context running |
| `soundState()` | `{ on, events, sonify, audio, playing }`: the act button's label (Listen, Stop listening, Turn on and listen) |
| `has('song')` | `typeof SEASONG !== 'undefined'` (and the sound engine) |

The tour sets `--tour-h` (768 px and up: the strip's height plus the 8 px gap) or `--ph-tour` (a phone: 68 px in
portrait, 48 px for the landscape fallback row, 0 in the header) on `:root`, and clears them at the end. `.stage` has a
first grid row `var(--tour-h, 0px)`; on a phone `--ph-tour` is added wherever `--ph-head` places content below the header
(the split rows, the sheets' tops) and `Phone.geometry()` subtracts it.

### Events added in v16.4

| event | payload | emit when |
|---|---|---|
| `view-moved` | `{ pane: 'L' \| 'R' \| 'P', how: 'pan' \| 'zoom' \| 'orbit' }` | the end of the user's pan, zoom (a wheel: 250 ms after its last tick; a pinch: on lift) or orbit (Landscape, sphere); `'P'` is the one wide panel |
| `layer-opened` | `{ kind: 'catalog' }` | the step catalog opens (the add card, {+}, the palette's Add a step: `openPalette` with `fnOnly`) |
| `phase-key` | `{ on }` | Phase key is toggled (Y's check, the legend's key check) |
| `order-changed` | `{ all }` | One after another / All at once changes (`setHomAll`) |
| `step-replaced` | `{ k, type }` | a step is replaced by its inverse (`invertStep`); `type` is the new step's type |
| `tex-copied` | `{ what: 'F' }` | F's LaTeX is copied (the Inspector's copy button with the F tile selected) |
| `listen-ended` | `{ piece, closed, W, heard, full }` | a Listen along ends: played out (`full: true`), stopped, or cut by a scene change; `heard` in seconds; `W` the rounded winding number of a closed curve with no cut, else null |
| `harp-turn` | `{ dir: 1 \| -1 }` | the pointer's harp counts a low D, up or down (Hear the function) |

`shape-added` gains `via: 'draw' | 'formula' | 'paste' | 'menu'`. `pattern-changed` is sent by the pattern setter itself
(a swatch clicked or picked with the keys).

### Events the tour reads outside a Try it

| event | payload | emit when |
|---|---|---|
| `listen-started` | `{ piece, closed, dur }` | `sndListen` starts: the tour holds its countdown while it plays and runs the step's captions from it |

### Step fields and API added in v16.4

- `lead` (one sentence, at most 60 characters as read): required on a step with no `try`, with `tryWide`, or with
  `try.after`. The strip shows it when there is no task.
- `try.then` (at most 60): the result line once the task is done. `try.after`: an earlier step of the chapter whose
  task must have been done in this run (else the step is read).
- `act: 'listen' | 'sound'`, `hear: true`, `captions: [[seconds, text], …]` (ascending, within the piece's length).
- Look keys `phaseKey` (Y's Phase key) and `sectors` (8, 12, 16 or 24; the phase sectors of Tiles).
- A scene with `app: name` is loaded from `api.sceneSpec(name)`; with no answer it is absent and its steps are left out.
- `Tour.auto(on?)`: Move on by itself, read or set. `Tour.lit()` adds `strip: { l, t, r, b }`, `mode` (`desk`, `port`,
  `head`, `row`), `why`, `done` and `countdown: { left, held: [kinds], state: 'idle' | 'running' | 'held' | 'cancelled' |
  'off' }`, and drops `side`, `edge`, `docked`, `mini`, `expanded`.
- Removed: the callout and its placement (`place`, `placeDock`, `placeMini`, `dockGutter`) and the phone mini bar.
- The tour record gains `auto` (Move on by itself, on unless false) and `why` (a wide screen's Why, null: by the viewport).

### r3 review fixes (notes/tour-r3/ledger.json)

- `showPanel(side, sheet, early)`: `early` is true when a chapter's start opens the side panel one of its steps docks, so
  the stage and the strip keep one place through the chapter. The app opens it only where it docks: a drawer (the left
  panel below 1024 px) and a phone's sheet wait for their own step.
- `slot(where)` shares out a phone's height again (`Phone.geometry`) only while a sheet is open; the split rows read
  `--ph-tour` in CSS. The end of the tour leaves no `style` attribute on the root that it did not find.
- A sound setting the user changes while the tour holds it (the sound menu's checks, Sound in the top bar, ⇧M, Hear the
  function from the palette, the toast's Turn on and listen) becomes the user's: it is not given back at the release.
- Step fields: `try.off`, the task while the sound or Mathematical events are off (a listen step; its act button turns
  them on); `try.hint: { on, test, text, touch }`, a line shown in place of the task when that event says the attempt
  went wrong (Preimages: a hold too short for the probe pans Y).
- `Tour.lit()` adds `whyPanel` (Why opens as a panel: a phone, or a desktop whose panes would keep less than 360 px with
  Why inline), `quiet` (the task is done and the spotlight has stepped aside), `lines` (2 or 3: the phone strip's line)
  and `hint`. `Tour._t.needLines()`: the lines the running chapter's line needs here.
- `--ph-tour` is 68 px in portrait (76 for a chapter whose line needs three lines), 48 under a landscape header (56), 0 in
  the header; a landscape header whose line would need three lines gives the chapter the row under the header instead.
- (fix pass) The app's left drawer (768-1023 px) starts under the strip while `--tour-h` is set (`top: var(--tour-h, 0px)`
  in desk.css), so a drawer a step opens never covers the strip.
- (fix pass) A lit part beside the anchor that an open layer of `layers()` covers along one whole side (X under the left
  drawer) is lit only up to the layer's edge, its corners there square. Not on a phone, whose sheets hold the spotlight.

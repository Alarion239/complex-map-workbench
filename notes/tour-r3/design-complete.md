# Tour r3: completion conditions and auto-advance

Designer: completion conditions and auto-advance. Read-only on src. I looked at v16.2 (`work/xvtr`) in headless Chrome
at 1440 × 900 (mouse) and at 390 × 844 (Android Chrome, touch).

The user (2026-10-26): "Would also be nice if each of them included some conditions for completion — then we could
have just make it move on automatically, for example, 3 seconds after the completion of the task."

## 1. Summary

- **Each step that asks for an action gets a condition read from the app's state, not from clicks.** Today a Try it
  ticks when the app sends an event. I propose a check function per step, run against a small state snapshot
  (`api.state()`), compared with the snapshot taken when the step opened. Events stay, but only to trigger the check
  sooner.
- **Four kinds of step.** Each kind moves on differently:
  - **door**: the task opens what the next step explains, as Phase does for the Phase portrait. These move on 0.7 s
    after the task, as they do today.
  - **see**: the result shows in the work area. Once the task is done, a one-line result appears, then the step moves
    on after **3 s of quiet**.
  - **layer**: the result is a menu, the palette, a dialog or the integral popover. The step waits while that is open,
    then moves on 3 s after it closes.
  - **read**: Next only.
- **Quiet means:**
  - no finger or button is down;
  - no wheel, key or drag happened in the last 3 s;
  - no menu or dialog is open that the step did not open;
  - no Listen along is playing;
  - the pointer is not over the callout.
  - The deformation's own loop does not count as activity.
- **The tour never moves on by itself:**
  - at the end of a chapter;
  - on a step reached with Back;
  - when the condition was already true when the step opened;
  - when the user has turned this off ("Move on by itself", on by default).
- **The countdown shows as Next filling up.** On the phone bar the task line turns into the result line with a tick.
  A Try it step on a phone then needs no tap at all: you read the task in the bar, do it, read the result, and the tour
  moves on. That answers "you need to always press on a pop-up".
- **Counts:**
  - Today, 44 steps: 21 Try its, 2 of which move on by themselves, and 23 steps you only read.
  - Proposed for those 44: 34 with a condition (2 door, 27 see, 5 layer) and 10 read. Two of the 27 are optional (The
    Riemann sphere and The Inspector). Without them, 32 have a condition and 12 are read.
  - The Grieg chapter adds 4 steps: 2 with a condition and 2 to read.

## 2. What the current tour does (measured)

- The walk with Next through all 44 steps at 1440 is in `complete-shots/walk-entry-state.json`. No Try it is ticked
  when its step opens. The `before` actions reset the view, the deformation and the bracket.
- **Ticks come from events** (`tourEmit` in app.js). Today 2 steps move on by themselves, 0.7 s after the event: Three
  views (Phase) and Deformation (the toggle). Every other step needs Next.
- **Phone: Next must be tapped every time.** The mini bar shows the title and the task, and a tick when done
  (`complete-shots/p_trio.png`). Even so, every step needs a tap on Next, and a step you only read needs a tap on the
  bar before you can read anything.
- **Phone: Cards follow the view opens as the full card in the middle** of the large plane, and stays there after the
  task is done until Next is tapped (`p_cards_trio.png`, left to right: on entry, done, done).
- **Desktop: after the disc is drawn, only Next's halo changes** (`d_draw_done.png`). Nothing says what just happened
  (the disc is in Shapes and its image is in Y).
- **Facts that change the design:**
  1. **`api.busy()` cannot tell a gesture in progress.** It is true right after a shape is drawn, because the new disc
     stays selected (measured: `busy: true` after the draw). The countdown needs its own pointer-down tracking.
  2. **The deformation plays on a loop as soon as it is on.**
     - Traced over 6 s: t runs 0 → 2, holds about 1 s at each step boundary, jumps to 0 and starts again.
     - So "Play pressed and t reached 1" happens without the user.
     - The Play and scrub condition must be the user's own hand on t, or a press of Pause or Play.
     - The loop must not count as activity, or the Deformation chapter would never go quiet.
  3. **Natural domain.** `api.anchor('domain')` selects the F tile itself, so "select the F tile" is already true when
     the step opens. It stays a read step.
  4. **All sheets.** The `logSheets` scene turns All sheets on, so that check is already ticked when the step opens. Its
     task should be to orbit instead.
  5. **Fragile conditions:**
     - Phase key: nothing turns it off before the step, so its condition could already be true.
     - All at once: nothing sets the order before the step, so its condition could already be true.
     - The function chain: nothing sets the focus, so double-clicking f₁ could already be done.
     - It follows its points: this needs the circle from the step before. If that step was skipped with Next, the task
       cannot be done.

## 3. The rule

### 3.1 Conditions come from the app's state

- **New adapter call `api.state()`.** It is cheap and read-only, and it returns plain data:

  ```
  { rev,                                   // the app's change counter (commit() and the view setters bump it)
    main, sel, focus, tool,
    steps:  [{ type, key }],               // key: a hash of the params
    shapes: [{ id, kind, plane, key, bound, op, family }],   // family: circle3's disc | halfplane | complement
    zp:     { k, zeros, poles, key }, params: { a: 1, … }, cuts: [deg per step],
    look:   { pattern, phaseKey, sheets, phaseStyle },
    deform: { open, T, Tmax, playing, order: 'seq' | 'all', range: { a, b } | null, paths, userT },  // userT: Σ|ΔT| by hand
    cams:   { L: { cx, cy, s }, R: { … }, land: { yaw, pitch, dist }, sphere: { … } },
    layers: [kind],                        // 'menu' | 'palette' | 'dialog' | 'integral' | 'catalog' | 'planeMenu' | 'sheet:<id>'
    sound:  { on, events, hear, play: null | { piece, closed, u }, last: null | { piece, closed, natural, W, at } },
    copied: { what, at } | null }
  ```

  - Every field already exists in app.js: `S`, `morph`, `V`, `cam`, `snd`, `homRange`, `allAtOnce()`, `zpStep()`, and
    `api.layers()`.
  - What is new: `userT`, which slider input adds to; `sound.last`, which `sndListen` sets when it ends; and `copied`,
    which `copyText` sets.
- **Each step names a check.** `try.done(now, entry, mem)` returns true or false. `entry` is the snapshot taken after
  the step's `before` actions have run and its layout has settled.
  - "Changed since entry" conditions, such as a shape moved, a cut dragged or a view panned, are false when the step
    opens by construction.
  - Absolute conditions, such as `main === 'phase'`, rely on `before` making them false (section 3.5).
- **When the check runs.**
  - On every existing tour event.
  - Every 250 ms while a step with a condition shows and the page is visible, using `setTimeout`, never in `rAF`.
  - Only when `rev` has changed, or a field the step reads has changed (camera, T).
  - The cost is one small object every 250 ms, so the 60 fps budget is not touched.
  - Events are now only for speed. A task done another way still counts: the palette, a key, the menu, the Inspector,
    or undo and redo.
- **The tick latches.** Once the condition has been true during this showing, the tick stays filled.
  - The countdown needs the condition to be true again at the moment it ends.
  - So an undo during the countdown (⌘Z after the drag) stops it. Next keeps its ring.

### 3.2 Kinds and timing

| kind | after the condition turns true | moves on |
|---|---|---|
| door | tick | 0.7 s later (0.3 s with reduced motion), as `advance` does today; the next step explains |
| see | tick; the Try it line is replaced by the **result line** (`try.then`) | after 3 s of quiet, plus 1 s per 50 characters of the result line beyond 50, at most 6 s (Russian lines are longer and get the time) |
| layer | tick; the result is the layer itself | 3 s of quiet after the layer closes; never while it is open |
| read | none | Next only |

The result line exists so that moving on never skips the explanation. It names what just happened, in the work area,
in one line (examples are in the table in section 4).

### 3.3 Quiet: what holds the countdown

The countdown runs only while all of these hold. Anything else restarts it from full once things are quiet again.

1. **No pointer is down.** The tour's own capture listeners count `pointerdown`, `pointerup` and `pointercancel` on the
   document: a drag, a pinch, an orbit or a slider held still all hold it. This replaces `busy()`, which a selection
   keeps true.
2. **No input in the last 3 s:**
   - a wheel;
   - a key (not a modifier);
   - a pointer move with a button down;
   - a hover move over the planes of more than 4 px. Hover is how the Preimages step is done, so moving the mouse
     there means "still exploring". A mouse at rest is quiet.
3. **No layer is open that the step did not open:** a menu, the palette, a dialog, the planes' menu, a phone sheet the
   user opened, or the integral popover.
4. **No Listen along or Enter loop is playing** (`snd.play`, `snd.kloop`). Two things do not count: the deformation's
   loop and the motion bed. They play on their own, as found in section 2.
5. **The pointer is not over the callout, and the phone bar is not unfolded.** Hovering the card, or unfolding the bar
   to read the whole step, means "I am reading". The user then moves on with Next.
6. **The page is visible.** The countdown stops on `visibilitychange` and restarts from full.

Next during the countdown moves on at once. Back cancels it.

### 3.4 How it looks

- **Desktop card.**
  - The tick fills, as today.
  - The Try it text gives way to "Done. <result line>".
  - The Next button fills from left to right with a darker accent over the countdown. With reduced motion there is no
    sweep: Next reads "Next · 3", "Next · 2", "Next · 1".
  - Hovering the card pauses the countdown. The fill stays where it is and goes on when the pointer leaves.
- **Phone bar.**
  - The second line of the bar, which holds the task today, becomes "✓ <result line>". It may take two lines, so the
    result line is at most about 70 characters in English and 85 in Russian.
  - Next fills as on the desktop.
  - A tap on the bar unfolds it and stops the countdown for this step.
  - A touch in the work area restarts the countdown, which follows from rule 2 in section 3.3.
- **Before moving on, a focused text field is blurred.** This applies after the Formula task, the Inspector's field, or
  the palette. Otherwise a phone's keyboard would cover the next step.
- **Screen reader.** The live region says once: "Done. <result line>. Next step in 3 seconds." The step after it is
  announced as today.
  - Focus is in the card from the start, because the engine focuses Next. That does not hold the countdown.
  - A Tab or a key inside the card does hold it.
- **Setting.** The tour menu (Help, then Guided tour) gets a check, **Move on by itself**, on by default.
  - It is stored in the tour record (`rec.auto`).
  - With it off, the tour behaves as today: a tick and a ring, with Next.
  - This and the hover pause meet WCAG 2.2.1 (the user can turn the timing off or extend it).

### 3.5 When the condition is already true at entry

- **Moving on needs a change from false to true seen during this showing.**
  - If the check is already true when the step opens, the tick is drawn filled and Next gets its ring. Nothing counts
    down.
  - The body is still unread, so moving on would skip it.
  - This happens when scenes are off (the tour could not borrow the canvas, so it skips its scene and view actions) or
    when the user arrives with the work already done.
- **Make the absolute conditions start false, with `before` actions:**
  - Phase key: `['look', { phaseKey: false }]`
  - All at once: `['look', { order: 'seq' }]`
  - The function chain: `['focus', 0]`
  - Already in place:
    - Three views: `view xy`
    - Patterns: `look checker`
    - Cards follow the view: `view phase`
    - Deformation: `deform false`
    - Part of the chain: `range null`
- **A condition that cannot be met becomes possible.** `try.ensure` lets a step add what its task needs.
  - Example: It follows its points needs the circle through z₀, z₁ and z₂. If Circle through three points was skipped,
    the step adds that circle to its scene, so that the drag can be done.
  - If a condition still cannot be met, the Try it is hidden and the step is read only. A Try it that can never tick
    is worse than none.

### 3.6 Back and revisits

- **Back runs the step's `before` again and takes a fresh entry snapshot,** as `show()` does today. The "changed since
  entry" conditions start false again.
- **A step reached with Back never moves on by itself.** The tick and the ring still work. The user came back to look
  again or to redo it, and moving them forward 3 s later would fight them.
  - Moving on by itself comes back on the next step reached with Next.
- **A step's tick is not kept across visits.** The `before` may have reset the work, so a filled tick would claim
  something that is no longer on screen.
- **A step that moved on by itself is announced as usual.** Back from the next step shows it again, with its result
  still in the work area wherever `before` does not reset it.

### 3.7 Chapter ends

- **The last step of a chapter never moves on by itself,** nor does the last step of the tour. The footer holds Done
  and "Next: <chapter>". That is the point where people leave, so the choice stays theirs.
- **The tick, the result line and the ring still show.** Seven chapters end on a step with a condition: Basics
  (Examples), Views (Patterns), Editing the chain (Shared numbers), Constructions (Intersections), Deformation (Part of
  the chain), Branches and inverses (All sheets) and Export (the formula in LaTeX). Each still shows its result.

## 4. Every step

Legend:
- **kind:** D door, S see, L layer, R read.
- **new:** the step has no Try it today. Its body already asks for the action; this proposal adds a condition.
- **Δ:** changed since the step opened.
- **end:** the last step of a chapter (section 3.7).
- **"no pointer down":** the condition also waits for the drag to end.

The result lines are drafts for the copy designer. Each becomes one new string in `notes/i18n/ru/v164-tour.json`.

### Basics

| step | kind | condition, from `api.state()` | result line (`try.then`) | notes |
|---|---|---|---|---|
| welcome | R | — | — | |
| x | S new | X's view Δ: a pan of 24 px or more, or a zoom of 15 % or more (`cams.L`); no pointer down. Task: "Drag empty space in X, or scroll." (touch: "Drag or pinch X.") | "{Z} fits both planes again." (touch: "⊡ fits both planes again.") | Relative, so false at entry. Back: fresh snapshot |
| y | R | — | — | |
| preimages | S | the probe went inside the disc and then outside (`probeInOut` memory, from the `probe` event; the probe is pointer state, so an event is right here) | "Inside the disc, one mark; outside, two, $2\pi i$ apart." | Hover over the planes is activity (rule 2), so it moves on once the mouse rests |
| draw | S | a new shape in z is in `shapes` and was not there at entry; any kind (the body says "pick a tool"); a polygon counts once it is closed | "It is listed under Shapes, and Y shows its image." | The new shape stays selected, so `busy()` is no use here (section 2) |
| shapes | S | the line Im z = 0.8: its `key` Δ; no pointer down | "Y followed as you dragged; {mod}{Z} puts it back." | Phone (`tryWide`): R |
| formula | S new | a formula shape added since entry. Task: "Type $\|z-1\|<2$ and press Add." | "A set from a formula is a shape like the others: its image is in Y." | The text field is blurred before moving on (keyboard) |
| chain | S | `focus === 1`, and it was not 1 at entry | "X and Y are now $f_1$'s input and output." | Add `['focus', 0]` to `before` |
| add | L new | the catalog layer opened, or the step count went up. Task: "Press {+}." (touch: "Tap +.") | step added: "It applies after $f_2$, and $F$ changed." | Waits while the catalog is open |
| examples | L new, end | the Examples menu opened. Task: "Open Examples." | — | Chapter end: no countdown |

### Views

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| switch | D | `main === 'phase'` | — (the next step explains) | `before` sets xy |
| phase | R | — | — | |
| land | S new | `cams.land` yaw or pitch Δ of 15° or more; no pointer down. Task: "Drag to orbit." | "Zeros are pits and poles are peaks: $\pm1$ and $\pm i$." | Relative |
| sphere | S new | `cams.sphere` rotation Δ of 15° or more. Task: "Drag the sphere to turn it." | "$\infty$ is the north pole; here $F(\infty)=1$." | Optional; the content designer decides |
| key | S new | `look.phaseKey` turned on. Task: "Turn on Phase key." | "A colour now reads as a value of $w$." | Add `['look', { phaseKey: false }]` to `before` |
| patterns | S, end | `look.pattern === 'stretch'` (state, so the keyboard also counts) | "Blue shrinks, amber grows: $\|F'\|$ at each point." | Chapter end |

### Editing the chain

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| cards | S | `main === 'land'` | "Every card now shows its own landscape." | Not a door step: the cards are what to look at |
| inspector | S new | the parameters of step 2 Δ. Task: "Change $a_2$." | "Y followed as you typed." | Optional. Blur before moving on |
| split | S | the step count rose from 1 to 3 | "One card for each transform; {mod}{Z} undoes." | |
| zp | S | `zp.key` Δ; no pointer down | "$F$'s formula and Y followed the mark." | |
| zpHere | S | `zp.zeros` count up by one, from the menu or from Add zero | "That point is now a zero of $F$: every colour meets there." | Waits while the planes' menu is open |
| numbers | S, end | `params.a` Δ of 0.05 or more; slider released | "The zeros $\pm a$ and the circle $\|z\|=a$ moved together." | Chapter end |

### Constructions

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| c3 | S | a new shape with `op === 'circle3'`; no drawing in progress | "Its three points are its handles now." | Phone: the More tools sheet closes by itself |
| follow | S | that circle's `family` turned to `halfplane` or `complement` | "The disc became a half-plane, then the outside of a circle; Y followed." | `try.ensure: 'circle3'` (section 3.5) |
| meet | S, end | a new line with a snapped end (`bound`) | "Its end is tied to the crossing and follows it." | Chapter end |

### Deformation

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| toggle | D | `deform.open` | — | As today |
| transport | S | `deform.userT` ≥ 0.25 × `Tmax` (t moved by hand), or Pause then Play pressed by the user. **Not "t reached 1":** the loop does that by itself | "Angles are kept wherever $H_t'\neq0$." | Copy: "It plays on a loop: pause it, then drag $t$." The loop is not activity |
| paths | S | Paths seen off, then on (state, so the P key also counts) | "Each path runs from $z$ to $F(z)$." | |
| order | S new | `deform.order === 'all'`. Task: "Choose All at once." | "Both steps now deform at the same $t$." | Add `['look', { order: 'seq' }]` to `before` |
| range | S, end | `deform.range.a === 2` | "Only the Möbius map deforms; $f_1$ acts first, in full." | Chapter end |

### Analysis

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| targets | R | — | — | |
| cauchy | R | — | — | |
| integral | L | the integral layer opened for the circle | — (the popover shows $\oint=\pi$) | Moves on 3 s after the popover is closed |
| domain | R | — | — | The tour selects F itself, so the condition would already be true at entry |
| guarantees | R, end | — | — | |

### Branches and inverses

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| cut | S | `cuts[0]` Δ of 5° or more; no pointer down | "The seam moved; the values jump by $2\pi i$ across it." | |
| inverse | S new | step 1's type turned from `log` to `exp`. Task: "In ⋯, choose Replace with the inverse." | "$e^z$ undoes $\log z$ on this sheet." | Waits while the ⋯ menu is open |
| deriv | R | — | — | |
| sheets | S new, end | `cams.land` Δ of 15° or more. Task: "Drag to orbit the helicoid." | "Each turn around $0$ climbs one sheet: $\operatorname{Im}\log z$ grows by $2\pi$." | All sheets is on by the scene, so it cannot be the task. Chapter end |

### Export and LaTeX

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| figure | L new | the Export menu or dialog opened. Task: "Open Export." | — | |
| formula-tex | S new, end | `copied.what === 'tex'` after entry. Task: "Copy the LaTeX of $F$." | "$F$'s LaTeX is on your clipboard." | Chapter end |

### Palette and keys

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| palette | L | the palette opened | — | Moves on 3 s after it closes |
| sound | R | — | — | Becomes the bridge to the Grieg chapter, or moves into it |
| help | R, end | — | — | Last step: Finish |

### The Grieg chapter (proposal: "Hearing a function", scene `SEASONG`)

This chapter is my angle only: which steps get a condition and when they move on. Its copy belongs to the content
designer. It explains how the sound is made, as the user asked, from `notes/sea-song/README.md` and `r2/AS-BUILT.md`.

| step | kind | condition | result line | notes |
|---|---|---|---|---|
| strings: "Sound from the phase" | R | — | — | The harp's strings are lines of the Phase key: line $s$ at $\arg F=30°\cdot s$ plucks D + $s$ semitones. Crossing a line plucks it, $\|F\|$ sets the register, and a branch cut ticks. Phase key is on for the step, so the strings are visible |
| spiral: "A melody on a curve" | R | — | — | $F=z^{-2+24i}$. Each turn is the one before scaled by 0.77, so at a steady pace each turn is shorter and the theme speeds up. The piece has its own strings, one for each note Grieg wrote. Crossings between notes are silent, and the cut is the drum |
| listen: "Listen along" | S | the tick when `sound.play.piece` starts. Moves on only after `sound.last.piece` with `natural: true` (the spiral played to its end, 23 s) | "Grieg's 78 notes on the curve's own strings, with the cut as the drum." | **Never while it plays** (rule 4). Stopped early with Esc or a pointer move: ticked, ring, no countdown. Sound off: the app's toast offers "Turn on and listen" (`sndListenAsk`), and the condition waits for it. Esc stops the playing, not the tour (app.js already does this) |
| loop: "A loop sings its number" | S, end | `sound.last.closed` with a sung $W$ after entry (Listen along a circle about a zero) | "It ended on one note, the winding number $W={W}$." | Needs a closed curve in the scene, such as a circle about $0$ under $z^2$. Chapter end |

The Listen along step needs `sound.play` and `sound.last` in `api.state()`. `sndListen` already knows both: whether it
is a piece (`p.piece`), how far it has played (`u`), and the natural end (the `setTimeout` after `u ≥ 1`).

## 5. Before and after

Desktop, Draw a shape. Today: `complete-shots/d_draw_done.png`.

```
BEFORE (done)                                   AFTER (done, 1.2 s into a 3 s countdown)
┌──────────────────────────────────────┐        ┌──────────────────────────────────────┐
│ Basics                            ✕  │        │ Basics                            ✕  │
│ Draw a shape                         │        │ Draw a shape                         │
│ Pick a tool and drag in X to add a   │        │ Pick a tool and drag in X to add a   │
│ shape. The same tools in Y add a     │        │ shape. The same tools in Y add a     │
│ target in w instead.                 │        │ target in w instead.                 │
│ ┌──────────────────────────────────┐ │        │ ┌──────────────────────────────────┐ │
│ │ ✓ Try it Choose Disc, then drag  │ │        │ │ ✓ Done. It is listed under       │ │
│ │   in X.                          │ │        │ │   Shapes, and Y shows its image. │ │
│ └──────────────────────────────────┘ │        │ └──────────────────────────────────┘ │
│ 5 of 10            Back  (( Next ))  │        │ 5 of 10            Back  [███Next   ]│
└──────────────────────────────────────┘        └──────────────────────────────────────┘
  waits for a click on Next                       moves on after 3 s of quiet; a pointer over the
                                                  card pauses; a drag in X restarts it
```

Phone, Draw a shape. Today: the middle frame of `complete-shots/p_trio.png`.

```
BEFORE (done)                                   AFTER (done)
┌───────────────────────────────────────┐       ┌───────────────────────────────────────┐
│ ^ Draw a shape           5/10  <  Next│       │ ^ Draw a shape           5/10  < [██Ne]│
│   ✓ Choose Disc, then drag in X.      │       │   ✓ Listed under Shapes; Y shows its  │
└───────────────────────────────────────┘       │     image.                            │
  tap Next, every step                          └───────────────────────────────────────┘
                                                  no tap: it moves on 3 s after the finger
                                                  lifts; a tap on the bar stops it
```

Phone, Cards follow the view. Today: `complete-shots/p_cards_trio.png`. The full card sits over the large plane before
the task and after it.

- After: the Try it is ticked and the card shows the result line: "Every card now shows its own landscape."
- 3 s of quiet later, the tour moves on to The Inspector.
- Where the card itself goes on a phone is the other designers' angle. This only removes the tap.

## 6. Contract changes (for INTEGRATION.md)

- **Adapter:**
  - `state()`, as in section 3.1.
  - Also these events, which only trigger the check sooner and are all optional: `view-moved` (at the end of a pan,
    zoom or orbit), `look-changed`, `order-changed`, `step-replaced`, `layer-opened` and `layer-closed`,
    `listen-started` and `listen-ended` (`{ piece, closed, natural, W }`), `tex-copied`.
  - As today, the tour's own calls (setView, setLook) emit nothing.
- **Step fields:**
  - `try.done(now, entry, mem)`, which takes the place of `try.test`.
  - `try.on`, kept as the list of events that trigger the check.
  - `try.kind`: `'door' | 'see' | 'layer'`, which takes the place of `try.advance`.
  - `try.then`, the result line.
  - `try.ensure`, for a condition that needs something added first.
  - The defaults: kind `see`, and no `then`.
- **Tour API:**
  - `Tour.auto(on?)`, for the setting and for tests.
  - `Tour.lit().countdown` = `{ left, held }`, where `held` is `'pointer' | 'input' | 'layer' | 'sound' | 'hover' |
    'hidden' | 'back' | 'entry' | 'end' | null`.
- **Step limit.** The limit in `t_tour.js` (44) rises to 48 for the Grieg chapter.

## 7. Risks

- **Moving on while the user is still looking.** Several things guard against this:
  - the 3 s of quiet, which any input restarts;
  - the pause while hovering the card;
  - no countdown at a chapter's end, after Back, or when the condition was true at entry;
  - the off switch.
  - The worst case is one step too far. The step before is one Back away.
- **The 3 s may be too short to read a long result line in Russian.** The time grows with the line, up to 6 s.
  Measure it on the user's phone.
- **Animations that never stop.** The deformation's loop, the motion bed and the probe's readouts must never count as
  activity. Only the user's own input counts (section 3.3, rules 1 and 2).
- **Hover steps on desktop.** Preimages goes quiet only once the mouse rests or leaves the planes. That is intended,
  and Next works at any time.
- **Layer steps can wait forever.** If a menu, the palette or the integral popover is left open, the step waits.
  That is correct.
- **Existing tests:**
  - `tour_cmd.js`, `tour_audit_cmd.js` and `tour_phone_cmd.js` press Next on fixed timings, and some of them perform
    the tasks. A step that moves on by itself would race them.
  - They should call `Tour.auto(false)` at the start, except a new `tour_auto_cmd.js`.
  - Golden images and perf baselines are not touched: the tour is not in them, and `?ns=` pages show no suggestion.
- **`api.state()` cost.** It must not walk the shapes' points every 250 ms. The keys are computed when `rev` changes
  (commit), not on each check.
- **Phone keyboard.** A focused field is blurred before moving on (section 3.4). Without this, the Formula and
  Inspector steps would move on under an open keyboard.
- **Rejected: the deformation's "t reached 1" condition, and "Play pressed".** The loop plays by itself, so neither
  would be the user's doing.

## 8. Tests to add (`test/tour_auto_cmd.js`, headless, 390 touch and 1440 mouse, EN and RU)

For every step with a condition:

- **Doing the task.** Do it with real input (CDP mouse, touch and keys). The tick appears within 300 ms.
- **What holds the countdown.** There is no move while:
  - a finger is still down;
  - a layer is open;
  - Listen along plays (spiral at 1440: no move for 23 s, then a move 3 s ± 0.15 s after it ends);
  - the pointer hovers the card.
- **Quiet.** The step moves on after 3 s ± 0.15 s of quiet (longer by the result line's rule). Input at 2 s restarts
  the countdown.
- **When it never moves on.** No move:
  - at a chapter's end;
  - after Back;
  - with `Tour.auto(false)`;
  - when the condition was made true before the step opened (forced through the adapter);
  - when ⌘Z undoes the task during the countdown.
- **Done another way.**
  - **Patterns:** Stretch picked with the arrow keys.
  - **Paths:** pressing P twice.
- **Deformation:** the loop alone, over 10 s, never ticks Play and scrub.
- **Screen reader:** the live region text includes the result line once.
- **Phone:** the result line fits two lines of the bar at 360 px in Russian.

## Evidence

Folder: `notes/tour-r3/complete-shots/`

- `walk-entry-state.json`: the state as each of the 44 steps opens, at 1440.
- `d_draw_done.png`: desktop, Draw a shape, after the disc.
- `p_trio.png`: phone. Y: the image (a read step, bar only), Draw a shape, Zeros and poles.
- `p_cards_trio.png`: phone, Cards follow the view: on entry, done, done.

The deformation's loop and the busy-after-draw result were measured in the same session; the numbers are in section 2.
The harness was `work/xvtr/test/complete_cdp` on port 9832. Chrome, the server and the profile are stopped and removed.

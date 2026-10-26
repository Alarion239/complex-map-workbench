# Tour r3 (v16.4): one buildable spec

Lead designer's merge of `design-ui.md`, `design-complete.md` and `design-sound.md`. Build in `work/xvtr` (a copy of
v16.2; base for the merge: `notes/v16.2-candidate`). Nothing in `src/` was changed by this note.

The user (2026-10-26): add the Grieg example to the tour and explain how sound is extracted; the tour on phones is
cumbersome; a pop-up should not need a tap to be read; pop-ups are suboptimal; each step should have a completion
condition, and the tour should move on by itself, for example 3 s after the task is done.

What changes, in four lines:

1. **No more pop-ups.** The step lives in a **docked strip**, a row the layout makes room for. It never covers the work
   area or the app's controls, it stays in one place, and its title and one-line lead can be read without a tap.
2. **Every action step has a completion condition** (an app event), and the tour **moves on 3 s after it is done**,
   unless the user is still working. Twelve read-only steps become small tasks.
3. **A new chapter, Sound** (after Branches, before Export): Grieg on a curve, Phase lines are strings, A loop sings its
   number, and the Sound settings step moved in from Palette and keys.
4. Every step gets a short **lead** (what to look at) and most tasks a **result line** (what just happened).

## 0. Where the three designs disagree, and the choice

| question | ui | complete | sound | **choice** | why |
|---|---|---|---|---|---|
| presentation | docked strip | callout + phone bar (not its topic) | callout + phone bar | **docked strip** | the only option that covers nothing, by construction, and never moves |
| how a task is detected | (not its topic) | polled `api.state()` snapshot every 250 ms, `try.done(now, entry)` | app events | **events** (today's contract, plus 9 new ones) | smaller contract, no polling, already tested; the tour listens only after its own `before` actions, so a condition is never "true at entry" |
| step kinds | — | door, see, layer, read | — | **door (`advance: true`, 0.7 s, as today) and auto (3 s)**; a layer is just one of the holds; read = no task | fewer rules, same behaviour |
| wait after done | 3 s | 3 s plus 1 s per 50 characters, at most 6 s | 3 s | **3 s, fixed** | the user's number; result lines are ≤ 60 characters |
| what restarts the 3 s | pointer down, drag, focus in strip, Why open, layers, hidden page | any input in the last 3 s, hover over the planes > 4 px, the pointer over the callout | the pointer still for 1.5 s, the last note rung | **§2.2**: input and hover over the work area restart it; pointer down, layers, playing sound, a focused text field and a hidden page hold it | hover over the planes is how Preimages and the harp are explored |
| pointer over the step pauses | (focus in strip) | yes | press cancels | **no**; a **press on the strip's text cancels** auto for that showing | after pressing the strip's Listen the mouse rests on the strip; a hover pause would stall there forever |
| result lines (`then`) | — | one per task | — | **yes, optional**, ≤ 60 characters, where the result carries the point | on a phone it is the only explanation most people will read |
| where "Move on by itself" lives | Why panel | Help menu | — | **Why panel** (phone) / Why area (desktop) | it is seen while the countdown runs |
| Why stays open across steps | yes (phone) | — | — | **phone: folds at every step; ≥ 768: kept (`rec.why`)** | predictable; a phone panel over X is only ever user-invited |
| swipe left = Next | yes | — | — | **no** | task steps move on by themselves; Next is a 64 × 44 button |
| Sound chapter | — | 4 steps (2 read) | 4 steps, the piece played twice | **3 new steps + the moved Sound settings step**; the speed-up goes into the piece's captions | one 23 s playback is enough; keeps the tour at 47 steps |
| captions timing | — | — | `listen-time` event at 4 Hz | **the tour's own timer from `listen-started`** | one event fewer; ±50 ms is fine for captions |
| sound settings held | — | — | `soundHold` / `soundRelease` | **one call, `soundHold(prefs \| null)`** | like `chainPictures` |
| sphere, inspector, examples, figure as tasks | — | optional / new | — | sphere: task; inspector, examples, figure: **read** | typing on a phone; Examples and Export sit in ⋯ on a phone, so one task text does not fit both |

## 1. The presentation: the docked strip

### 1.1 Anatomy

| | phone portrait (`:root.ph`, not landscape) | phone landscape (`:root.ph.ph-land`) | tablet and desktop (≥ 768 px) |
|---|---|---|---|
| where | a row under the header, full width | the header's free part, right of ⋯, when it is ≥ 260 px wide (360 px at 844); else a 48 px row under the header | the first row of `.stage`, the stage's width (868 px at 1440) |
| height | 68 px, fixed | 48 px (the header's), no reflow | 62 px; with Why open, plus the body block (§1.2) |
| reflow | X and the chain shift down 68 px (X 668 → 600 px at 390 × 844) | none (or 48 px in the fallback row) | the panes shrink by the strip's height |
| line 1 | title (600 14/18, ellipsis if needed; full title in `aria-label`) + count "5/10" | title in bold at the start of the lead | title + "Basics · 5 of 10" + "Why ▾" |
| line 2 | the lead, the task with its ring, the result line with a tick, or a caption; 13/17, 2 lines, never clamped | same, 13/16, 2 lines | same, one line at these widths |
| buttons | ‹ Back 44 × 44, [act 44 × 44], Next ≥ 64 × 44, 8 px apart | [act], Next ≥ 64 × 44 (Back is in the Why panel) | ‹ Back, [act], Next, × End: 36 px with a mouse, 44 on touch |
| progress | a 2 px accent line along the bottom edge, as wide as the share of the chapter done | same | same |

- **The lead line** shows, in order of precedence: a caption while the step's piece plays (§4); the result line with a
  tick once the task is done (or "Done." with the tick when the step has no `then`); the task with an empty ring; else
  the step's `lead`.
- **The act button** (only on a step with `act`): ▶ "Listen"; while playing ■ "Stop listening"; when sound or
  Mathematical events are off, "Turn on and listen"; for `act: 'sound'`, "Turn on sound", shown only while
  `api.soundReady()` is false. Icon only on a phone (the label is its `aria-label`), labelled on ≥ 768. Its click is
  the user gesture the audio engine needs.
- **Next** reads "Next", "Next: <chapter>" at a chapter's end (where it fits; else "Next →"), "Start" on the welcome
  step, "Finish" on the last. Its ready ring and its countdown fill are in §2.
- **No shade over the strip.** The strip's rect is a hole of the shade, without ring or glow. A step with no anchor (the
  welcome step) draws no shade at all.
- **Stacking.** The strip is above the tour's shade and below the app's layers (menus, palette, dialogs, popovers,
  sheets). A menu the user opens may drop over the strip; the countdown is held while it is open (§2.2). The sheets'
  top offsets and `ph-full` include the strip's height (§5), so a sheet never covers it.
- **The spotlight is unchanged** (v16.1 exact-control rings, hosting inside scrolling panels, `reveal`). Because the
  text is no longer next to its target, a lit control smaller than 48 × 48 px pulses its ring once when the step
  appears (none with reduced motion).

### 1.2 Why (the body)

- The text block of the strip is a button (`aria-expanded`, label "Why"). It holds the step's `body` (or its
  `touch`/`narrow`/`byScene` variant, as today), the pictures note, the sound note, the **Move on by itself** check
  (§2.4), and on a phone × End the tour (and ‹ Back in landscape).
- **Phone:** a tap opens a panel that hangs under the strip, over the top of X. It is at most half the viewport high and
  scrolls inside. It folds on a touch in the work area (the touch goes on to the app), on Next, Back, a step change,
  or a tap on the strip again. Each step starts folded. This is the only cover of the work area, and only on request.
- **≥ 768:** Why opens inline: the strip grows by the body block and the panes shrink. It starts open on a viewport of at
  least 1280 × 800, closed below; a toggle is saved in the tour record (`rec.why`). While open, the strip's height is
  the tallest body of the current chapter at the current width (measured off-screen at the chapter's start and on
  resize), so the panes do not change size between the steps of a chapter.

### 1.3 Keyboard and screen readers

- The strip is `role="region"`, `aria-label` "Guided tour", placed in the DOM right after the header (the second Tab
  stop). It is not a dialog and no longer takes the focus when a step changes; if the focus was in the strip, it moves
  to Next. ← and → page while the focus is in the strip. Esc behaves as today (the app's own Escape first).
- The polite live region says on a step: "Basics, step 5 of 10. Draw a shape. Choose Disc, then drag in X." (the lead
  instead of the task on a read step; the body only when Why is open). On done: "Done. <result line>. Next step in 3
  seconds." (without the last sentence when no countdown will run). Captions are read as they change.

### 1.4 What goes

`place()`, `placeDock()`, `placeMini()`, `dockGutter()`, the callout card, the phone mini bar with its fold, grow and
bar-Back, and their CSS. Their `t_tour.js` checks go with them. The help menu, the first-run suggestion card, the
stash, the scenes, `reveal`, the hosted spotlight and `litAreas`/`rrPath` stay.

## 2. Completion and the auto-advance

### 2.1 The rule

- A step with a `try` has a completion condition: an app event and an optional `test(e, mem)` (with `count`), as
  today. The tour listens only after the step's `before` actions have run, so the condition can only become true by
  the user's hand.
- **Door steps** (`try.advance: true`: Three views, Deformation) move on 0.7 s after done (0.3 s with reduced motion),
  as today; the next step explains what the door opened.
- **Every other task step** starts a **3 s countdown** when it is done. When it runs out the tour moves on (a focused
  text field is blurred first, so a phone's keyboard closes).
- **Never moves on by itself:** a read step (no task); the last step of a chapter (Next shows "Next: <chapter>");
  a step reached with Back; a step whose auto-advance was cancelled (§2.2); when Move on by itself is off. In all
  these the tick, the result line and Next's ready ring still show.

### 2.2 What restarts, holds or cancels the countdown

| | events | effect |
|---|---|---|
| **restart** (back to 3 s) | `pointerdown` outside the strip; `wheel`; `keydown` other than a lone modifier; a pointer move with a button down; hover travel over the work area (`#panes` and the chain) of more than 8 px since the last restart; a press of the strip's act button | the 3 s start again from now |
| **hold** (paused; when the last hold ends, 3 s start again) | a pointer or finger down; an app layer open (`appLayers()`: menu, palette, dialog, popover, integral popover, planes' menu, a sheet the step did not open); the step's Listen along playing (between `listen-started` and `listen-ended`); a focused text field; the phone's Why panel open; `document.hidden` | no progress |
| **cancel** (no auto for this showing) | a press on the strip's text or Why; Back pressed during the countdown | Next keeps its ring |
| **go now** | Next | moves on at once |

Hovering the strip neither holds nor restarts. An undo during the countdown is a key, so it restarts the 3 s; it does
not un-tick (accepted: rare, and Back is one press away).

**Implementation:** the countdown is a small pure reducer in `tour.js`, `countdown(state, event, now)` →
`state` and `left(state, now)` → ms or null, exported on `Tour._t` and unit-tested with a fake clock. The engine feeds
it from capture listeners on `document` (pointer, wheel, key, focus), from the tour's own listen events and from a
`setTimeout` chain while it runs (never a rAF loop of its own; the fill is a CSS transition restarted on each restart).

### 2.3 How it looks

- On done: the ring in the lead line becomes a tick; the line becomes the result line (`then`) or "Done.".
- **Next** gets today's ready ring, and while the countdown runs its background fills from left to right over 3 s (a
  darker accent, `--accent` on `--accent-soft`), restarting with the countdown. Held: the fill freezes at its place.
  With reduced motion there is no fill; the label counts down: "Next · 3", "Next · 2", "Next · 1".
- Light and dark from the app's tokens only; the fill keeps Next's text at ≥ 4.5:1 in both.

### 2.4 The setting

**Move on by itself** (a check in Why), on by default, saved in the tour record as `rec.auto`. With it off, the tour
behaves as v16.2 (tick, ring, Next). `Tour.auto(on?)` reads or sets it (tests). This and the holds meet WCAG 2.2.1.

## 3. Every step

Legend: **D** door, **A** auto (3 s), **R** read, **end** the chapter's last step (no auto). New strings are marked
(new). In the tables `\|` is a literal `|` of the TeX. English copy as read is at most 60 characters for `lead`, `try.text`/`touch` and `then`; checked in
`t_tour.js`. Russian for every new string goes into `notes/i18n/ru/v164-tour.json` (§6), following
`notes/i18n/GLOSSARY.md`, at most 64 characters as read for a lead, task, result or caption (two lines at 360 px).

### Basics (10 steps, rev 3)

| step | kind | task (event, test) | lead (read steps; tryWide on a phone) | then |
|---|---|---|---|---|
| welcome | R | — | About two minutes; your own work comes back at the end. (new) | — |
| x | A | (new) "Drag empty space in X, or scroll to zoom." / touch "Drag empty space in X, or pinch." `view-moved`, `e.pane === 'L' && e.how !== 'orbit'`; ctl `tool:select`; before adds `['tool', 'select']` | — | — |
| y | R | — | The strip becomes the unit disc, and angles are kept. (new) | — |
| preimages | A | as today (`probe`, `probeInOut`) | — | Inside, one $z$; outside, two, $2\pi i$ apart. |
| draw | A | as today (`shape-added`) | — | Y shows its image under $F$. |
| shapes | A (tryWide) | as today (`shape-moved`) | Each shape is listed with its equation. | Y followed the line as you dragged it. |
| formula | A (tryWide, new) | "Type $\|z-1\|<2$ and press Add." `shape-added`, `e.via === 'formula'` | Type a set such as $\|z-1\|<2$, then press Add. | A set from a formula is a shape like any other. |
| chain | A | as today; before adds `['focus', 0]` | — | X and Y are now $f_1$'s input and output. |
| add | A | (new) "Press {+}, or click the add card." / touch "Tap the add card." `layer-opened`, `e.kind === 'catalog'`; the open catalog holds the countdown | — | — |
| examples | R, end | — | Worked examples, from Joukowski to a residue. | — |

`t_tour.js`'s cap "basics: at most 4 Try its" becomes 7 (with auto-advance a task step takes seconds).

### Views (6, rev 2)

| step | kind | task | lead | then |
|---|---|---|---|---|
| switch | D | as today | — | — |
| phase | R | — | Colour is $\arg F$; all colours meet at zeros and poles. | — |
| land | A | (new) "Drag to orbit." `view-moved`, `e.how === 'orbit'` | — | Zeros are pits and poles are peaks: $\pm1$ and $\pm i$. |
| sphere | A | (new) "Drag the sphere to turn it." `view-moved`, `e.how === 'orbit'` | — | $\infty$ is the north pole; here $F(\infty)=1$. |
| key | A | (new) "Turn on Phase key." `phase-key`, `e.on === true`; before adds `['look', { phaseKey: false }]`; ctl `phaseKey` | — | Each colour now reads as a value of $w$. |
| patterns | A, end | as today; `pattern-changed` is emitted by the pattern setter (keys and palette count) | — | Blue shrinks, amber grows: $\|F'\|$ at each point. |

### Editing the chain (6, rev 3, unchanged tasks)

| step | kind | lead | then |
|---|---|---|---|
| cards | A | — | Each card now shows its own landscape. |
| inspector | R | The Inspector edits the selected step, here $f_2$. | — |
| split | A | — | One card for each transform; undo brings the formula back. |
| zp | A | — | $F$ and its image followed the mark. |
| zpHere | A | — | That point is now a zero of $F$. |
| numbers | A, end | — | The zeros $\pm a$ and the circle $\|z\|=a$ moved together. |

### Constructions (3, rev 2)

| step | kind | task | lead | then |
|---|---|---|---|---|
| c3 | A | as today | — | Its three points are its handles now. |
| follow | A | as today, with `try.after: 'c3'`: the task shows only when c3's task was done in this run; otherwise the step is read | Drag $z_2$ across the line: the disc changes family. | Disc, half-plane, outside: one family, and Y followed. |
| meet | A, end | as today | — | Its end is tied to the crossing and follows it. |

The Russian task of c3 (78 characters) must be shortened to ≤ 64, for example «Ещё» › «По трём точкам», затем
коснитесь $z_0$, $z_1$, $z_2$.

### Deformation (5, rev 3)

| step | kind | task | then |
|---|---|---|---|
| toggle | D | as today | — |
| transport | A | as today (`deformation-t`, the user's own input on t; the loop never emits it) | Angles are kept wherever $H_t'\neq0$. |
| paths | A | as today | Each path runs from $z$ to $F(z)$. |
| order | A | (new) "Choose All at once." `order-changed`, `e.all === true`; before adds `['look', { allAtOnce: false }]`; ctl `allAtOnce` | Both steps now deform at the same $t$. |
| range | A, end | as today (its Russian, 67 characters, shortened to ≤ 64) | Only the Möbius map deforms; $f_1$ acts first, in full. |

The deformation's own loop and the motion bed are not input: they never restart the countdown.

### Analysis (5, unchanged tasks)

| step | kind | lead | then |
|---|---|---|---|
| targets | R | The target $0$ marks the three cube roots of unity. | — |
| cauchy | R | Cauchy's integral is $F$ inside $\gamma$ and $0$ outside. | — |
| integral | A | — (the open popover holds the countdown; it moves on 3 s after it closes) | $\oint=2\pi i\,\operatorname{Res}_i F=\pi$. |
| domain | R | Here $F$ is defined for every $z$ except $\pm i$. | — |
| guarantees | R, end | What the chain guarantees: always true when listed. | — |

### Branches and inverses (4, rev 3)

| step | kind | task | lead | then |
|---|---|---|---|---|
| cut | A | as today | — | The seam moved; across it the values jump by $2\pi i$. |
| inverse | A | (new) "In ⋯, choose Replace with the inverse." `step-replaced`, `e.k === 1 && e.type === 'exp'`; ctl `invBtn` | — | $e^z$ undoes $\log z$ on this sheet. |
| deriv | R | — | Here $F=3z^2-3$; the target $0$ marks its zeros $\pm1$. | — |
| sheets | A, end | (new) "Drag to orbit the helicoid." `view-moved`, `e.how === 'orbit'` | — | Each turn round $0$ climbs one sheet, $2\pi$ higher. |

### Sound (4, new, rev 1): §4

### Export and LaTeX (2, rev 3)

| step | kind | task | lead | then |
|---|---|---|---|---|
| figure | R | — | A vector figure with an exact caption, or LaTeX. | — |
| formula-tex | A, end | (new) "Press the copy button of $F$." / touch "Tap the copy button of $F$." `tex-copied`; ctl `copyTex` | — | $F$'s LaTeX is on your clipboard. |

### Palette and keys (2, rev 3: Sound moved out)

| step | kind | lead | then |
|---|---|---|---|
| palette | A (the open palette holds it) | — | — |
| help | R, end | The tour by chapter, the guide and every shortcut. | — |

Totals: 10 chapters, 47 steps (44 + 3 new; Sound settings moved); 34 with a task (2 door, 32 auto), 13 read.

## 4. The Sound chapter

`{ id: 'sound', title: 'Sound', time: '1½ min', rev: 1, scene: 'song', needs: 'sound' }`, between Branches and
Export. The order is hear, then how, then a closed curve.

### 4.1 Steps (exact text; the Russian goes into `v164-tour.json`)

**Step 1, `song`.** Anchor `panes`. `needs: 'song'`. `act: 'listen'`. Before: `['deform', false]`, `['view', 'phase']`,
`['surface', 'L', 'plane']`, `['tool', 'select']`. Done: `listen-ended` with
`e.piece && (e.full || e.heard >= 9)` (past the second drum; nobody has to wait 23 s).

| field | English | Russian |
|---|---|---|
| title | Grieg on a curve | Григ на кривой |
| body (232 as read) | Grieg's theme as one curve: the spiral in X under $F(z)=z^{-2+24i}$. Listen along walks it at an even pace and plays $\arg F$ as pitch, on the piece's own strings. Each turn is $0.77$ of the one before, so the theme comes $1.3$ times as fast. | Тема Грига — одна кривая: спираль в X под $F(z)=z^{-2+24i}$. «Слушать вдоль кривой» проходит её в ровном темпе и играет $\arg F$ как высоту на собственных струнах пьесы. Каждый виток — $0{,}77$ предыдущего, поэтому тема звучит в $1{,}3$ раза быстрее. |
| try | Press Listen. | Нажмите «Слушать». |
| then | Every note was $\arg F$ crossing one of the piece's strings. | Каждая нота — это $\arg F$, пересекающий струну пьесы. |
| caption at 0 s | Each note is a phase line crossed: $\arg F$ is the pitch. | Каждая нота — пересечённая линия фазы: $\arg F$ — высота. |
| caption at 8.9 s | The cut: a drum. The next turn is smaller, so faster. | Разрез — барабан. Следующий виток меньше, поэтому быстрее. |
| caption at 15.4 s | Each turn is $0.77$ of the last: $1.3$ times as fast. | Каждый виток — $0{,}77$ предыдущего: в $1{,}3$ раза быстрее. |
| caption at 20.4 s | The ending is ours: three rolled B-minor chords. | Концовка наша: три аккорда си минор, взятые арпеджио. |

Facts behind it: the score's drum ticks are at 0.45, 8.90, 15.40 and 20.40 s, the piece lasts 22.97 s
(`test/fixtures/seasong_score.json`); λ = e^(2π(1 − 2)/24) = 0.770, 1/λ = 1.30; statements 8.45, 6.50 and 5.00 s;
the coda is ours (sea-song README). "Listen", "Turn on and listen" and "Stop listening" exist in the app's tables.

**Step 2, `strings`.** Anchor `panes`. `needs: 'zp'`. `hear: true`. Before: `['scene', 'harp']`, `['view', 'phase']`,
`['tool', 'select']`. Done: `harp-turn` with test `(e, m) => { if (!e) return true; if (e.dir > 0) m.up = 1; if (e.dir < 0) m.down = 1; return !!(m.up && m.down); }`
(a lap up and a lap down, whichever point gave which). `act: 'sound'`: while `soundReady()` is false the strip shows
"Turn on sound", since the harp needs it.

| field | English | Russian |
|---|---|---|
| title | Phase lines are strings | Линии фазы — струны |
| body (240) | The portrait's lines, every $30^\circ$ of $\arg F$, are strings a semitone apart, with D where $F>0$. Hear the function plucks five, D, E, F♯, A and B, as the pointer crosses them. Anticlockwise round a zero the scale rises; round a pole it falls. | Линии портрета, через каждые $30^\circ$ по $\arg F$, — струны на полутон друг от друга; ре — там, где $F>0$. «Слушать функцию» щиплет пять из них — ре, ми, фа-диез, ля, си, — когда указатель их пересекает. Против часовой стрелки вокруг нуля гамма идёт вверх, вокруг полюса — вниз. |
| touch (240) | … as your finger crosses them. … (the body with "the pointer" → "your finger") | … когда палец их пересекает. … |
| try | Circle the zero $1$, then the pole $-1$. | Обведите нуль $1$, затем полюс $-1$. |
| try, touch | Hold near $1$, slide round it, then round $-1$. | Удерживайте палец у $1$, обведите его, затем $-1$. |
| then | A scale up and a scale down: one turn of $\arg F$ each. | Гамма вверх и гамма вниз: по обороту $\arg F$. |
| note (in Why, only when the tour turned it on) | The tour turns Hear the function on for this step; your setting comes back after it. | На этом шаге обзор включает «Слушать функцию»; ваша настройка вернётся после него. |
| act label | Turn on sound | Включить звук |

Facts: F = (z − 1)/(z + 1); its lines of constant arg F are arcs from the pole −1 to the zero 1. The pointer's harp
plays lines 0, 2, 4, 7, 9 (0°, 60°, 120°, 210°, 270°: D, E, F♯, A, B); a lap is counted by its low D; a still finger
makes no sound (AS-BUILT-v152). **Build check:** on this scene, with Tiles and 12 sectors, a tile boundary lies on
arg F = 0 and on every 30° after it. If not, re-word the body's first sentence before the merge.

**Step 3, `loop`.** Anchor `panes`. `needs: 'zp'`. `act: 'listen'`. Before: `['scene', 'harpLoop']`,
`['view', 'phase']`, `['tool', 'select']`. Done: `listen-ended` with `e.closed && e.W === 1 && e.full`.

| field | English | Russian |
|---|---|---|
| title | A loop sings its number | Петля поёт своё число |
| body (191) | Listen along a closed curve plucks the same strings, then sings one note: its winding number $W$, the zeros minus the poles inside. This circle goes once round the zero $1$, so $W=1$, sung as F♯. | «Слушать вдоль кривой» на замкнутой кривой щиплет те же струны, а затем поёт одну ноту — её число оборотов $W$: нули минус полюсы внутри. Эта окружность один раз обходит нуль $1$, поэтому $W=1$ и звучит фа-диез. |
| try | Press Listen. | Нажмите «Слушать». |
| then | $W=1$: one turn of $\arg F$, sung as F♯. | $W=1$: один оборот $\arg F$, спетый как фа-диез. |

Facts: the zp map has no cut, so the loop sings; the sung note is harmonic 4 + W of D3, so W = 1 is F♯5. A pointer move
of more than 4 px over a plane stops a loop's playback (not a piece's): the strip's Listen keeps the pointer off the
plane, and a stop just leaves the task undone.

**Step 4, `settings`** (moved from Palette and keys, its `sound` step; body, narrow and touch unchanged, so their
Russian is reused). Title **Sound settings** (exists: «Настройки звука»). Anchor `['soundBtn', 'soundBar', 'moreBtn']`.
Read, end.

| field | English | Russian |
|---|---|---|
| lead | Turn sound, or Hear the function, on or off here. | Здесь включают и выключают звук и «Слушать функцию». |

Chapter strings: "Sound" and "1½ min" exist.

### 4.2 Scenes

```js
// the example itself, asked from the app at load time (seasong.js is concatenated after tour.js)
song: { name: 'In the Hall of the Mountain King', app: 'song', needs: 'song', look: look({ phaseStyle: 'phase' }),
        view: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: [] },   // placeholders; loadScene uses api.sceneSpec('song')
harp: { name: 'Phase harp', needs: 'zp', view: { cx: 0, cy: 0, s: 110 }, fit: { x0: -2, x1: 2, y0: -1.2, y1: 1.2 },
        look: look({ phaseStyle: 'enhanced', sectors: 12 }), shapes: [],
        steps: [{ type: 'zp', params: { a: '1', zeros: '1', poles: '-1' } }] },
harpLoop: { /* harp, plus */ shapes: [{ kind: 'circle', c: [1, 0], r: 0.6 }] },
```

- `LOOK` gains `phaseKey: false` (S.wKey) and `sectors: 12` (S.sectors, 8/12/16/24); `tourSetLook` sets both.
- `loadScene(r, key)`: for a scene with `app`, it calls `api.sceneSpec(app)` and loads that (`{ name, tex, view, fit,
  shapes, steps }`, the `EX` entry built from `SEASONG`, its curve keeping `listen`), then `setLook(scene.look)`. With
  no `sceneSpec`, or a null answer, the scene is absent and its steps are left out.
- **The strip is mounted and sized before the first `loadScene`**, because `exFitTo` fits the spiral to the pane's
  size at load time.

### 4.3 Sound held for the tour

- `api.soundHold(prefs | null)`: `prefs` is any of `{ on, events, sonify }` with `true` to hold a value or `null` to
  give that key back; `null` gives everything back. The app remembers the user's values on the first hold, writes
  them to `cmw-tour-sound` (through `storageKey`) so a crash gives them back at the next `Tour.init`, and on release
  restores each value unless the user changed it meanwhile. Returns true while anything is held.
- The tour calls it: from the act button's click (`{ on: true, events: true }`, plus `sonify: true` on a `hear` step);
  in `show()` on a `hear` step when `soundReady()` (`{ sonify: true }`, with the note) and on any other step
  (`{ sonify: null }`); `soundHold(null)` on a step outside the Sound chapter and in `stop()`.
- `api.soundStop()` stops a running Listen along (`sndStopPlay(false)`); `show()` calls it before every step change.
- **No step plays on arrival.** Music starts only from the act button (or the curve's own menu). An auto-advance never
  starts sound.

## 5. Files to change (all in `work/xvtr`)

| file | change |
|---|---|
| `src/tour.js` | the strip (build, layout, Why, act button, captions, live region), the countdown reducer and its feeds, `lead`/`then`/`after`/`act`/`hear`/`captions` fields, the copy of §3–4, the Sound chapter and scenes, `LOOK` + `phaseKey`, `sectors`, `loadScene` with `app`, sound holds, `Tour.auto`, `Tour.lit()` additions; remove §1.4; `VERSION` 3 |
| `src/app.js` | adapter: `slot()`, `sceneSpec(name)`, `listen()`, `soundHold()`, `soundStop()`, `soundReady()`, `has('song')` (`typeof SEASONG !== 'undefined'`); `tourSetLook` sets `phaseKey` and `sectors`; emits the 9 new events (§6.2) and `via` on `shape-added`; `pattern-changed` moves into the pattern setter; the crash restore of `cmw-tour-sound` in `init` |
| `src/inspector.js` | emit `step-replaced` from Replace with the inverse and `tex-copied` from F's Copy LaTeX, if they live here (else in `app.js`) |
| `src/page.html` | `<div id="tourSlot" hidden></div>` as the first child of `.stage` (and on a phone directly under the header: if `.stage` is not that, a second slot as a child of `#app` after `.top`); `.stage` gets a first grid row `var(--tour-h, 0px)` (also in the 1708 phone-portrait rule's flex column) |
| `src/desk.css` | the same first row in the `.stage` rules at lines 6, 187, 205 |
| `src/phone.css` | `+ var(--ph-tour, 0px)` wherever `--ph-head` places content below the header: the `#app` rows (14, 19), the sheets' tops (188, 197, 281); landscape (272) keeps 48 px and hosts the strip in the header (`#tourHeadSlot`, `flex: 1 1 260px`) |
| `src/phone.js` | `geometry()` subtracts `--ph-tour` from the height it shares out (`--ph-hp`, `--ph-ride`) |
| `tools/make_ru_table.py` | read `notes/i18n/ru/v164-tour.json` last (like `V161_HERE`) |
| `notes/i18n/ru/v164-tour.json` | every new string (id → `{ en, ru, note }`): §3 tasks, leads and result lines, §4, "Why", "Guided tour" (exists), "Move on by itself" «Переходить дальше самому», "Done. Next step in 3 seconds." «Готово. Следующий шаг через 3 секунды.», "Next · {n}" «Далее · {n}», the shortened Russian of c3 and range |
| `notes/tour/INTEGRATION.md` | §6 below, as a new section 9 |
| `test/t_tour.js`, `tour_cmd.js`, `tour_lit_cmd.js`, `tour_audit_cmd.js`, `tour_phone_cmd.js`; new `test/tour_auto_cmd.js` | §7 |

`src/i18n_ru.js` is regenerated by `python3 tools/make_ru_table.py --strict` (0 unresolved). Do not touch perf
baselines, `accepted.json` or golden images; the tour never runs under `?ns=`, where they are made.

## 6. The contract (INTEGRATION.md, new section 9, "v16.4: the docked strip, completion, the Sound chapter")

### 6.1 Adapter additions (all optional; a missing one leaves its steps out or its feature off)

| call | does |
|---|---|
| `slot(where)` | `where`: `'stage'` or `'head'` (phone landscape). Returns the slot element; null (or no method): the tour inserts the strip as the first child of `.stage` itself |
| `sceneSpec(name)` | `'song'`: the Grieg example's spec (`EX` entry with `SEASONG`), or null |
| `listen()` | Listen along the current scene's curve: the shape with `listen`, else its last closed curve; turns sound and Mathematical events on through `soundHold` when they are off, then plays once the engine runs (as `sndTurnOnListen`). Called inside the button's click. Returns false without Web Audio |
| `soundHold(prefs \| null)`, `soundStop()`, `soundReady()` | §4.3; `soundReady()` is sound on, events on and the audio context running |

`has('song')`: `typeof SEASONG !== 'undefined'`. The tour sets `--tour-h` (≥ 768) or `--ph-tour` (phone) on `:root`
and clears them at `stop()`.

### 6.2 Events added in v16.4

| event | payload | emit when |
|---|---|---|
| `view-moved` | `{ pane: 'L' \| 'R' \| 'P', how: 'pan' \| 'zoom' \| 'orbit' }` | the end of the user's pan, zoom (a wheel: 250 ms after its last tick; a pinch: on lift) or orbit (Landscape, sphere); `'P'` is the one wide panel |
| `layer-opened` | `{ kind: 'catalog' }` | the step catalog opens (the add card, {+}, the palette's Add a step) |
| `phase-key` | `{ on }` | Phase key is toggled (the check, the Display sheet, the palette) |
| `order-changed` | `{ all }` | One after another / All at once changes (`setHomAll`) |
| `step-replaced` | `{ k, type }` | a step is replaced by its inverse; `type` is the new step's type |
| `tex-copied` | `{ what: 'F' }` | F's LaTeX is copied |
| `listen-ended` | `{ piece, closed, W, heard, full }` | a Listen along ends: played out (`full: true`), stopped, or cut by a scene change; `heard` in seconds; `W` the rounded winding number of a closed curve, else null |
| `harp-turn` | `{ dir: 1 \| -1 }` | the pointer's harp counts a low D, up or down |
| `listen-started` | `{ piece, closed, dur }` | `sndListen` starts (read by the tour for captions and the hold; not a Try it's event) |

`shape-added` gains `via: 'draw' | 'formula' | 'paste' | 'menu'`. `listen-started` goes in its own table, "Events the
tour reads outside a Try it", so the check "every documented event is used by a Try it" reads only the Try it tables.

### 6.3 Step fields and API

- `lead` (one sentence, ≤ 60 as read): required on a step with no `try`, with `tryWide`, or with `try.after`.
- `try.then` (≤ 60), `try.after` (an earlier step id of the chapter whose task must be done in this run).
- `act: 'listen' | 'sound'`, `hear: true`, `captions: [[seconds, text], …]` (ascending, within the piece's length).
- Look keys `phaseKey`, `sectors`.
- `Tour.auto(on?)`; `Tour.lit()` adds `strip: { l, t, r, b }`, `why`, `countdown: { left, held: [kinds], state:
  'idle' | 'running' | 'held' | 'cancelled' | 'off' }`, and drops `mini`, `expanded`, `side`, `edge`.
- Removed: the callout placement and the phone mini bar (§1.4).

### 6.4 `t_tour.js` limits

- 5 to **10** chapters; 20 to **48** steps; Basics 8 to 10 steps with at most **7** Try its; no other chapter over 6.
- `covers`: `keys/sound` becomes `sound/settings`; add `sound/song`, `sound/strings`, `sound/loop`.
- New: the `lead` rule; `lead`, `then`, captions ≤ 60 as read, one sentence (captions up to two), end with a period;
  `act`, `hear`, `captions`, `after` valid; a chapter's last step has no `advance`; the phone's text (lead, task, then,
  captions) has no hover, right-click, left or right; the Russian of every lead, task, then and caption ≤ 64 as read
  (read from `src/i18n_ru.js`).
- The rule "a drag lights the Select tool" exempts views (`/orbit|turn it|empty space/` is not a shape drag; the x
  step still lights it).
- The countdown reducer: done → 3000; input at 2000 → advance at 5000; hold from 1000 to 4000 → advance at 7000;
  cancel, back, last-of-chapter, auto off → never; door → 700 (300 reduced).
- `song` with `app` is exempt from the "examples format" check; a stub `sceneSpec` is used.

## 7. Test plan

All browser runs: headless Chrome from a copy of `test/cdp_kit` in `test/<name>_cdp`, port 0, `--disk-cache-dir`
inside the profile, `dist/` served by `python3 -m http.server 0 --bind 127.0.0.1`, one browser at a time; stop
everything and delete the profiles at the end. Sound tests turn sound on with `Sound.set({ on: true, events: true },
{ quiet: true })` as `seasong_cmd.js` does.

1. **Node:** `t_tour.js` (§6.4), `t_i18n.js`, `t_i18n_keys.js`, `t_i18n_english.js`, `t_seasong.js`, `t_sound.js`;
   `make_ru_table.py --strict` 0 unresolved; build twice, same bytes, no test hooks.
2. **`tour_cmd.js`** (starts with `Tour.auto(false)`): its walk, now on the strip: every step shows its title and lead
   or task in the strip without a click; Next, Back, ×, Esc, the Why toggle; the scenes; the work comes back.
3. **`tour_lit_cmd.js`:** every step at 1440 × 900 and 1024 × 700: the ring on the exact control, the strip a hole of
   the shade, no shade on the welcome step.
4. **The audit matrix (`tour_audit_cmd.js`):** 390 × 844, 1024 × 700 and 1440 × 900; light and dark; EN and RU; mouse
   and touch (24 runs, every step). Per step: the strip intersects none of `#panes`, the chain, the tool row and the
   header's controls; its rect is the same for every step of a chapter (desktop: also the panes' and canvases' sizes);
   no lead, task, result or caption is clamped (`scrollHeight ≤ clientHeight + 1`, `scrollWidth ≤ clientWidth + 1`),
   the title may end in an ellipsis only with the full title in its `aria-label`; buttons ≥ 44 × 44 on touch (≥ 36 with
   a mouse), 8 px apart; text contrast ≥ 4.5:1 in light and dark, the countdown fill included; no app layer is left
   open by the tour.
5. **`tour_phone_cmd.js`:** 390 × 844 and 360 × 780 portrait, 844 × 390 and 780 × 360 landscape, EN and RU: no tap is
   needed to read any step (title and lead/task visible on arrival); the strip is at the same place on every step;
   `elementFromPoint` at the centres of the tool row's buttons and the view switch returns them on every step; X is
   600 px high at 390 × 844; landscape puts the strip in the header (no change of X) or, below 260 px free, a 48 px row;
   the Why panel ≤ 50 % high, scrolls, folds on a touch in X and that touch reaches the app; the sheets open below the
   strip; the hosted spotlight still scrolls with its panel (v15.1 checks kept).
6. **New `tour_auto_cmd.js`** (auto on), at 1440 mouse EN and 390 touch EN, plus the Sound chapter at 390 touch RU.
   For every task step of §3–4:
   - arrive with `Tour.start({ chapter, step })`; nothing advances in 3.5 s without input;
   - do the task with real CDP input (mouse, touch, keys); the tick shows within 300 ms of the event;
   - the step moves on 3000 ± 150 ms after the last input (layer steps: after the layer closes; listen steps: after
     `listen-ended`; door steps: 700 ± 100 ms after the event);
   - on Draw, Phase key and Paths: an input at +2 s moves the advance to +5 s ± 0.15;
   - holds, each on one step: a finger held down 6 s; the palette left open 6 s; Listen along playing (Grieg: no move
     for the whole piece, then +3 s; stopped with Esc at 10 s: done, then +3 s); a focused text field (Formula); the
     page hidden (`Page.setWebLifecycleState` frozen) — no advance while held, 3 s after release;
   - cancels: a click on the strip's text; Back; a step reached with Back; `Tour.auto(false)` — no advance in 6 s;
   - chapter ends with a task (Patterns, Shared numbers, Intersections, Part of the chain, All sheets, The formula in
     LaTeX): tick and result, no advance in 6 s;
   - reduced motion (`Emulation.setEmulatedMedia` prefers-reduced-motion): Next reads "Next · 3", "· 2", "· 1";
   - the live region says the result line once and "Next step in 3 seconds" once;
   - the Grieg step's captions change at 8.9, 15.4 and 20.4 s (± 150 ms) and fit the strip;
   - Strings: mouse laps of radius 0.4 round 1 anticlockwise, then round −1 → two `harp-turn`s, done; touch: hold then
     slide;
   - A loop: Listen → `listen-ended` with W = 1 and full → +3 s;
   - sound settings come back: start with Sound off and Hear the function off; after the chapter and after Esc both are
     off again; after a reload mid-chapter, both are off.
7. **Unchanged suites:** `seasong_cmd.js`, `sound_v152_cmd.js`, `i18n_cmd.js`; the quality suite (golden images
   untouched). A frame-time check with the tour running at 1440 and 390 (60 fps, p95 as `seasong_cmd.js`): the strip
   resizes the panes only at the tour's start and end, a chapter change, and a Why toggle.

## 8. Risks and open points

- **Smaller panes during the tour** (−10 % on a phone in portrait, −7 % to −16 % on a desktop). Scenes are fitted after
  the slot is reserved.
- **One canvas reallocation per resize**; there is none between the steps of a chapter. The old Windows laptops' slow
  first draw is not made worse per step; check one start on the slowest machine available.
- **Next sits at the top on a phone.** Read steps need that tap; task steps move on by themselves.
- **Copy volume:** about 60 new English strings and their Russian. The builder writes the Russian (glossary terms,
  decimal comma in TeX, ≤ 64 characters) and the audit checks the fit at 360 px.
- **Statement 1 of the piece is quiet** (−30 dBFS by design). The user's Android phone has not played it in the tour.
  The tour never changes the volume.
- **Tiles boundaries vs the harp's lines** on the harp scene: a build check (§4.1).
- **Undo during a countdown** restarts it but does not un-tick.

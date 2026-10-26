# Tour round 3: the Sound chapter (Grieg and the harp)

Designer: sound angle. Read-only on `src/`; the tour and the example were run in headless Chrome on v16.2 (`work/xvtr/dist`,
port 9833, desktop 1440 × 900 and phone 390 × 844 with Android emulation and touch). The "before" screenshots are in
`sound-shots/`.

The user (2026-10-26): "add the Grieg Example into the tour! And just explain how sound is extracted … pop-ups I think
are suboptimal … each of them included some conditions for completion … move on automatically, for example, 3 seconds
after the completion of the task."

## 1. The proposal in short

- **A new chapter, Sound** («Звук», 2 min, 4 steps, `id: 'sound'`, `rev: 1`). It goes **after Branches and inverses,
  before Export**. By then the tour has shown the phase portrait (Views), zeros and poles (Editing, Analysis), the
  winding number (Integrals) and the branch cut (Branches), and the chapter uses all four.
- **Hear first, then explain.**
  1. Listen to the piece.
  2. Pluck the strings yourself, round a zero and a pole.
  3. Hear how the spiral makes it speed up, with the drum.
  4. A loop sings its winding number.
- **Each step has a completion condition** that the app reports as an event. With the auto-advance the other designers
  propose, the step moves on 3 s after it is done. It never moves on while a note sounds or a finger is down.
- **The explanation comes with the music, not in a pop-up.** While the piece plays, the callout's task line (on a phone,
  the mini bar's second line) changes to a short caption at each drum: 4 captions, each at most about 60 characters.
  Nothing has to be opened to follow along.
- **Music starts only on a press.** Each listening step has its own Listen button, in the callout and in the phone bar.
  That press is the user gesture the browser needs to start audio. It also turns sound on for the tour when it is off.
  An auto-advance never starts music.
- **The user's sound settings come back** when the chapter or the tour ends: on/off, Mathematical events and Hear the
  function. This works the way `chainPictures` already gives the cards' setting back.

## 2. What the user sees today (before)

- `sound-shots/d1440-mk.png`: the example opens in the Phase view, Plain style. The spiral fills X. The hint in X's
  title row reads "Right-click the spiral, then Listen along. **Listen**". Sound is off on a `?ns=` page, so this
  headless run was silent. A real first visit has sound on.
- `sound-shots/d1440-tiles.png`: the same in Tiles with n = 12. The phase lines are there, every 30°, but on
  z^(−2+24i) they are far too dense to point at. So the strings have to be shown on a simpler map (step 2).
- `sound-shots/d1440-tour-sound.png` and `p390-tour-sound.png`: today the tour's only sound content is one text step,
  Palette and keys › Sound. Nothing plays, the step has no task, and on a phone it is a full card over the plane.
- `sound-shots/p390-tour-preimages.png`: the phone mini bar. It is the right shape (one line of task, a tick), but the
  explanation sits behind a tap on the title. That tap is the "press on a pop-up to open it" the user dislikes.

## 3. The steps

All copy fits the tour's rules: at most 240 characters as read, 1 to 3 sentences, X and Y by role, and no "hover",
"right-click" or "left" in what a phone shows. The English lengths as read are measured below. The Russian is in §6.

### Step 1: In the Hall of the Mountain King (`song`)

- **Scene `song`.** It is the example itself, built from `SEASONG`: its curve with `listen`, its steps, `view` and
  `fit`, Phase view, the example's own Plain style. `before`: scene, view phase, deformation off, tool select.
- **Lit:** X (the spiral). The phone bar sits at the bottom. The example's `fit` box already keeps the whole spiral
  above the style bar, so nothing covers it.
- **Body** (219 characters as read): "Grieg's theme as one curve: the spiral in X under $F(z)=z^{-2+24i}$. Listen along
  walks it at an even pace and plays $\arg F$ as pitch, on the piece's own strings, one per note Grieg wrote. Press
  Listen, or right-click the spiral."
- **Touch** (212): the same, ending "Press Listen, or hold the spiral."
- **Button:** "Listen". When sound or Mathematical events are off, it reads "Turn on and listen". Both strings
  already exist in the app.
- **Try:** "Press Listen." It is done when the piece plays to its end (23 s), or when it is stopped (Esc, the button,
  the curve's menu) after 9 s, past the second drum.
- **Captions** while it plays (`captions: [[t, text]]`, times from `seasong_score.json`'s drum ticks):

  | at | English | why |
  |---|---|---|
  | 0 s | Each line crossed plucks a string: arg F is the pitch. | the rule |
  | 8.9 s | The cut: a drum. Turn 2 is shorter, so faster. | the drum, the speed-up |
  | 15.4 s | Each turn is 0.77 of the last: 1.3 times as fast. | the factor |
  | 20.4 s | The ending is ours: three rolled B-minor chords. | honest: the coda is not Grieg's |

### Step 2: Phase lines are strings (`strings`)

- **Scene `harp`** (new): a `zp` step with a = 1, zero 1 and pole −1, so F = (z − 1)/(z + 1). View s about 110, so
  ±2.5 is in view. Phase view, Tiles, n = 12 (a new Look key `sectors`, see §5).
- **Why this map:** its lines of constant arg F are circular arcs from the pole to the zero, strung between two pegs like
  strings. A circle round either point crosses each line once. The picture is exact, and readable at any size.
- **Before:** Hear the function on, held by the tour. Tool select.
- **Lit:** X.
- **Body** (217): "The lines of the portrait, every $30^\circ$ of $\arg F$, are a semitone apart, with D where $F>0$. Hear the
  function plucks five, D, E, F♯, A, B, as the pointer crosses them: anticlockwise round a zero the scale rises, round a
  pole it falls."
- **Touch:** "… as your finger crosses them …".
- **Try:** "Circle the zero $1$, then the pole $-1$."
  - Touch: "Hold near the zero $1$, then slide round it; then round the pole $-1$." On a phone, a still hold opens the
    planes' menu and a hold then a slide probes, as in Preimages.
  - It is done after one full lap up and one full lap down: the harp's low D counted up and counted down, as the event
    `harp-turn`. This needs no knowledge of which point was circled. It is also true for a user who circles both points
    clockwise: the zero then gives the lap down and the pole the lap up.
  - Two small ticks, "zero" and "pole", fill as each lap lands.
- **Note** (as the pictures note is added today): "The tour turns Hear the function on for this chapter; your setting
  comes back after it." It is shown only when the tour did turn it on.
- **Checked against the engine:** the pointer's harp is on lines 0, 2, 4, 7, 9 (0°, 60°, 120°, 210°, 270°: D, E, F♯,
  A, B); a lap is counted by the low D; anticlockwise round a simple zero arg F rises by 2π. A finger held still makes no
  sound (the v15.2 band), so the step cannot finish by accident.

### Step 3: One turn, one statement (`turns`)

- **Scene `song`** again. Lit: X, plus the cut's handle as a dashed ring (`also`, or `try.ctl` with a new anchor
  `cutHandle`).
- **Body** (206): "Each turn of the spiral plays the theme once. Under $z^{-2+24i}$ each turn is the one before scaled by
  $0.77$, so at an even pace the theme comes $1.3$ times as fast. The curve crosses the cut once a turn: the drum."
- **Try:** "Listen again, past the second drum." The same button and the same completion as step 1 (9 s heard).
- **Captions:**

  | at | English |
  |---|---|
  | 0 s | Turn 1: 100 beats a minute. |
  | 8.9 s | The cut, a drum. Turn 2: 130. |
  | 15.4 s | Turn 3: 169. |
  | 20.4 s | The ending: three chords, broadened. |

- **The numbers, checked:**
  - λ = e^(2π(1 − 2)/24) = 0.770 and 1/λ = 1.30.
  - In the score, the drums fall at 0.45, 8.90, 15.40 and 20.40 s. So the statements last 8.45, 6.50 and 5.00 s, a
    ratio of 0.77 each time.
  - The tempos are 100, 130 and 169.
  - The coda's beats are 1.5 times as long, which is why it says "broadened".
- **Silent crossings.** This step is also the place for them. The second caption's line on a desktop (where the
  callout has room) adds: "Lines passed on the way to a note stay silent." On a phone that sentence is left out.

### Step 4: A loop sings its number (`loop`)

- **Scene `harp`**, plus a circle |z − 1| = 0.6, which winds once round the zero and not round the pole. Lit: X. Hear
  the function stays on.
- **Body** (189): "A closed curve ends on one sung note, its winding number $W$: zeros minus poles inside. This circle
  goes once round the zero $1$, so $W=1$: the strings rise through one turn of $\arg F$, then F♯ sings."
- **Try:** "Press Listen, or right-click the circle and choose Listen along." Touch: "Press Listen, or hold the circle
  and choose Listen along."
- **Done** when the sung note has ended: `listen-ended` with `closed: true` and `W: 1`.
- **Checked:**
  - The zp map has no cut, so the loop sings.
  - The sung note is harmonic 4 + W of D3, so W = 1 is F♯5, as AS-BUILT-v152 says.
  - Listen along on a closed curve plays the pointer's five strings, so one turn plucks five notes, with its low D.

### What stays where it is

Palette and keys › Sound, the settings step, keeps its place and copy. Moving it into this chapter as a fifth step,
"open the Sound menu", would be the tidier home, but it lengthens the chapter. That is left to the step-count decision
below.

## 4. Sketches (after)

Desktop, step 1 while playing. The callout goes below the wide Phase panel, over the dimmed chain, as today.

```
┌ X: phase of F ───────────────────────────────────────────────┐
│                  (the spiral, lit, the probe moving on it)   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
┌ Sound ───────────────────────────────────────────── × ┐
│ In the Hall of the Mountain King                      │
│ Grieg's theme as one curve: …                         │
│ ┌──────────────────────────────────────────────────┐  │
│ │ ♪ The cut: a drum. Turn 2 is shorter, so faster. │  │  <- caption, changes at each drum
│ │ [■ Stop]                    ━━━━━━━━━━░░░░ 12 s  │  │  <- progress of the piece
│ └──────────────────────────────────────────────────┘  │
│ 1 of 4                               Back   Next      │
└───────────────────────────────────────────────────────┘
```

Phone (390 px), step 1. The mini bar is the whole callout, and nothing needs unfolding.

```
┌──────────────────────────────┐
│ X → Y    Phase   Landscape ⋯ │
│                              │
│     (spiral, whole, lit)     │
│                              │
├──────────────────────────────┤
│ ▶  In the Hall of the Mount… │  <- 44 px Listen key at the left of the bar
│    Press Listen.        ○    │  <- task, its tick
│              ‹   1/4   Next →│
└──────────────────────────────┘
while it plays:
│ ■  In the Hall of the Mount… │
│    The cut: a drum. Turn 2 … │  <- the caption replaces the task line
after the end (or a stop past 9 s): tick filled, Next fills a 3 s ring, then step 2
```

Phone, step 2. Two ticks in the bar, and the plane is clear for the finger.

```
│ Phase lines are strings      │
│ Circle the zero, then pole ✓ ○│
```

## 5. What the chapter needs from the app (adapter, events, engine)

### Scenes

- **`song` must be lazy.** `seasong.js` is concatenated after `tour.js`, so `SEASONG` is in its temporal dead zone
  while the tour's IIFE builds `SCENES`, and even `typeof SEASONG` would throw there. Make `song` a getter, or ask the
  app with `api.exampleScene('song')`, and read it at `Tour.start`.
  - It returns `{ name, tex, view, fit, shapes: [{ kind: 'curve', pts, listen, nameKey: 'spiral' }], steps, look }`.
  - `needs: 'song'`, through `api.has('song')`, which checks `typeof SEASONG !== 'undefined'` inside the app.
  - The node test `t_tour.js` gets a stub.
- **The `listen` data survives `loadScene`.** `tourLoadScene` → `loadExample(-1, spec)` attaches `listen.steps` and
  `listen.key` from `spec.steps` (app.js 12658), and `exFitTo(spec)` keeps the spiral in view. A tour scene does not
  call `sndPieceHint` (only `!spec` does), so the title-row hint does not double the callout.
- **`harp`:** `{ steps: [{ type: 'zp', params: { a: '1', zeros: '1', poles: '-1' } }], view: { cx: 0, cy: 0, s: 110 },
  look: look({ phaseStyle: 'enhanced', sectors: 12 }) }`, with `needs: 'zp'`. Step 4 adds
  `{ kind: 'circle', c: [1, 0], r: 0.6 }`.

### Look

- **A new key, `sectors`** (S.sectors). The copy says "every 30°", so n must be 12 whatever the user left it at.

### Adapter calls (all optional; a step without them is left out)

| call | does |
|---|---|
| `listen(which)` | Listen along: `'piece'` is the scene's melody curve (`sndListenShape` on the shape with `listen`), `'loop'` the scene's closed curve. Called **inside the button's click** so the engine may start. If sound or events are off, it first calls `soundHold`. Returns false if Web Audio is missing. |
| `soundHold(prefs)` | Sets `{ on, events, sonify }` for the tour, remembering the user's values (and putting them in the stash, so a crash brings them back too). Returns true while the tour holds them. |
| `soundRelease()` | Puts the user's values back, unless the user changed one meanwhile (their new choice stays). `stop()` calls it, as it calls `chainPictures(false)`. |
| `soundStop()` | Stops a running Listen along. The tour calls it before every step change, so music never spills into the next step (step 3 reuses step 1's scene, so `loadExample`'s own stop would not run). |
| `soundReady()` | `Sound.state().audio === 'running'`. When false, a step that needs sound shows its button and does not count a pointer lap. |

### Events (for the Events table)

| event | payload | emit when |
|---|---|---|
| `listen-started` | `{ piece, closed }` | `sndListen` starts |
| `listen-time` | `{ t, dur }` | at most 4 times a second while playing (the captions and the progress line) |
| `listen-ended` | `{ piece, closed, W, heard, full }` | the playback ends, is stopped (Esc, menu, button) or is cut by a scene change; `heard` is in seconds |
| `harp-turn` | `{ dir: 1 \| -1 }` | the pointer's harp counts a low D, up or down (`Sound.harpState()` up or down grows) |

### Engine

- **Nothing new in `sound.js`.** The piece, the pointer's harp and the sung note are as built in v15.2 and sea-song r2.
- **The autoplay policy:**
  - The engine makes or resumes its AudioContext only inside an activation gesture (`onActivate` on pointerdown,
    keydown, touchend and click).
  - The tour's Listen button is such a click.
  - The tour's Next click also wakes the engine when sound is on, so step 2's hover harp works with a mouse: hovering
    alone is not a gesture.
  - An auto-advance is a timer, not a gesture. So the chapter's rule is: **no step plays on arrival.** Steps 1, 3 and 4
    wait for their button. Step 2 is silent until the pointer moves.
  - If the context is not running on arrival at step 2 (sound was off and step 1 was skipped, or a hidden tab
    suspended it), the bar shows "Turn on and listen" in place of the task until it is pressed.
- **Esc while playing:** `busy()` is already true while `snd.play` runs, so Esc stops the music and the tour stays
  (app.js 15377). A stop after 9 s completes steps 1 and 3.

### The auto-advance, for this chapter

This follows the other designers' common rule, with three guards that matter for sound:

- (a) it waits until nothing of the step's own plays: the harp's last note has rung for 0.5 s;
- (b) it waits until no finger or button is down and the pointer has been still for 1.5 s (step 2: a user still
  circling is not cut off);
- (c) the 3 s count shows as a ring filling on Next. A press on the bar or the callout during the count cancels it.

## 6. Russian (for `notes/i18n/ru/v164-tour.json`)

Terms as in GLOSSARY 1.12 and the v15.2 tables: арфа, линии фазы, щипок струны, «Слушать функцию», «Слушать вдоль
кривой», число оборотов, нуль, полюсы, разрез, solfège names (ре, ми, фа-диез, ля, си), and the decimal comma
(`0{,}77` in TeX). Strings the app already has (Listen «Слушать», Turn on and listen «Включить и слушать», the piece's name
«В пещере горного короля») are reused, not added.

| id | English | Russian |
|---|---|---|
| ch | Sound · 2 min | Звук · 2 мин |
| song.body | Grieg's theme as one curve: the spiral in X under $F(z)=z^{-2+24i}$. Listen along walks it at an even pace and plays $\arg F$ as pitch, on the piece's own strings, one per note Grieg wrote. Press Listen, or right-click the spiral. | Тема Грига — одна кривая: спираль в X под $F(z)=z^{-2+24i}$. «Слушать вдоль кривой» проходит её в ровном темпе и играет $\arg F$ как высоту звука на собственных струнах пьесы, по одной на каждую ноту Грига. Нажмите «Слушать» или щёлкните спираль правой кнопкой. |
| song.touch | … Press Listen, or hold the spiral. | … Нажмите «Слушать» или удерживайте спираль. |
| song.try | Press Listen. | Нажмите «Слушать». |
| song.c1 | Each line crossed plucks a string: arg F is the pitch. | Каждая пересечённая линия — щипок струны: arg F — высота. |
| song.c2 | The cut: a drum. Turn 2 is shorter, so faster. | Разрез — барабан. Второй виток короче, поэтому быстрее. |
| song.c3 | Each turn is 0.77 of the last: 1.3 times as fast. | Каждый виток — 0,77 предыдущего: в 1,3 раза быстрее. |
| song.c4 | The ending is ours: three rolled B-minor chords. | Концовка наша: три си-минорных аккорда арпеджио. |
| strings.title | Phase lines are strings | Линии фазы — струны |
| strings.body | The lines of the portrait, every $30^\circ$ of $\arg F$, are a semitone apart, with D where $F>0$. Hear the function plucks five, D, E, F♯, A, B, as the pointer crosses them: anticlockwise round a zero the scale rises, round a pole it falls. | Линии портрета, через каждые $30^\circ$ по $\arg F$, отстоят на полутон; ре — там, где $F>0$. «Слушать функцию» щиплет пять из них — ре, ми, фа-диез, ля, си, — когда указатель их пересекает: против часовой стрелки вокруг нуля гамма идёт вверх, вокруг полюса — вниз. |
| strings.touch | … as your finger crosses them … | … когда палец их пересекает … |
| strings.try | Circle the zero $1$, then the pole $-1$. | Обведите нуль $1$, затем полюс $-1$. |
| strings.try_touch | Hold near the zero $1$, then slide round it; then round the pole $-1$. | Удерживайте палец у нуля $1$ и обведите его, затем — полюс $-1$. |
| strings.ticks | zero · pole | нуль · полюс |
| strings.note | The tour turns Hear the function on for this chapter; your setting comes back after it. | На время этой главы обзор включает «Слушать функцию»; ваша настройка вернётся после неё. |
| turns.title | One turn, one statement | Один виток — одно проведение темы |
| turns.body | Each turn of the spiral plays the theme once. Under $z^{-2+24i}$ each turn is the one before scaled by $0.77$, so at an even pace the theme comes $1.3$ times as fast. The curve crosses the cut once a turn: the drum. | Каждый виток спирали проводит тему один раз. Под $z^{-2+24i}$ каждый виток — копия предыдущего с коэффициентом $0{,}77$, поэтому в ровном темпе тема звучит в $1{,}3$ раза быстрее. Разрез кривая пересекает раз за виток — это барабан. |
| turns.try | Listen again, past the second drum. | Послушайте ещё раз, дальше второго удара барабана. |
| turns.c1 | Turn 1: 100 beats a minute. | Виток 1: 100 ударов в минуту. |
| turns.c2 | The cut, a drum. Turn 2: 130. | Разрез — барабан. Виток 2: 130. |
| turns.c3 | Turn 3: 169. | Виток 3: 169. |
| turns.c4 | The ending: three chords, broadened. | Концовка: три аккорда, шире. |
| turns.silent | Lines passed on the way to a note stay silent. | Линии, пройденные по пути к ноте, молчат. |
| loop.title | A loop sings its number | Петля поёт своё число |
| loop.body | A closed curve ends on one sung note, its winding number $W$: zeros minus poles inside. This circle goes once round the zero $1$, so $W=1$: the strings rise through one turn of $\arg F$, then F♯ sings. | Замкнутая кривая заканчивается одной спетой нотой — своим числом оборотов $W$: нули минус полюсы внутри. Эта окружность один раз обходит нуль $1$, поэтому $W=1$: струны поднимаются на один оборот $\arg F$, затем звучит фа-диез. |
| loop.try | Press Listen, or right-click the circle and choose Listen along. | Нажмите «Слушать» или щёлкните окружность правой кнопкой и выберите «Слушать вдоль кривой». |
| loop.try_touch | Press Listen, or hold the circle and choose Listen along. | Нажмите «Слушать» или удерживайте окружность и выберите «Слушать вдоль кривой». |
| off | Sound is off; Listen turns it on for the tour. | Звук выключен; «Слушать» включит его на время обзора. |
| stop | Stop listening (the bar's ■, its aria-label) | Остановить прослушивание |

The Russian bodies run 10 to 25 % longer than the English. At 390 px they still fit the unfolded card. The captions are
written to fit the mini bar's second line at 390 px; at 360 px, c2 and turns.c2 may be cut with an ellipsis, and the full
text is the live region's.

## 7. Risks and open points

- **Step count.**
  - The tour has 44 steps today, exactly `t_tour.js`'s cap ("20 to 44 steps").
  - This chapter adds 4, so the cap goes to 48, unless the other designers' cuts make room.
  - It respects "no chapter over 6 steps".
- **Volume on the phone.**
  - Statement 1 peaks at −30 dBFS, quiet by design (the crescendo).
  - The sea-song open item, "check that statement 1 is audible on the Android phone", is not done.
  - If it is too quiet there, the first caption can say "Turn the volume up." The tour never changes the app's volume.
- **iOS:** the mute switch silences Web Audio. Android Chrome is the target and is not affected.
- **A 23 s step.**
  - Steps 1 and 3 complete after 9 s, so nobody has to wait for the end.
  - Next at any time stops the music on a 12 ms fade (`soundStop`), never mid-waveform.
- **Settings held by the tour.** The tour sets Sound on, Mathematical events and Hear the function only after a press,
  and only for the tour. They come back on Finish, Done, × and Esc. After a crash they come back through the stash.
- **Exactness.**
  - Every number in the copy is checked above against the score, the generator's λ, and the engine's lines and singer.
  - "Anticlockwise" is in the copy because a clockwise lap round the zero falls.
  - The coda is labelled as ours.
- **Nobody has listened in the tour.** Everything here is from the as-built notes and the score. Steps 1 and 3 replay
  exactly the recording the user already approved ("No need to change anything", 2026-10-25).
- **Accessibility.**
  - The captions go to the tour's polite live region. They are short, so a screen reader does not talk over the
    whole piece.
  - The keyboard path (Tab to X, L listens) is unchanged.
- **Perf.** Nothing renders that the example does not already render at 60 fps (`seasong_cmd.js`). The captions are 4
  text changes, and the progress line runs at 4 Hz.
- **Not proposed:** a "strings" overlay (the five or eight string lines marked with note names on the phase legend).
  It would make step 2 more visual, but it is new app rendering, not tour content.

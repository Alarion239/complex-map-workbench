# Review: sound, from an accessibility expert and a maths user who dislikes noise

Scope: `notes/sound/DESIGN.md`, `notes/sound/prototype.html`, and the integration plan (DESIGN §4), checked against
`src/app.js` where the hooks would go. I read the whole prototype and ran my own headless-Chrome checks. They used a
separate daemon, now stopped, with its profile deleted. The scripts are `cdp/cmd/a11y1.js` … `a11y4.js`; run them in
order on a fresh daemon. The console stayed empty in every run.

## Verdict

The foundation is right:

- Sound is truly off until the user turns it on. No `AudioContext` exists before then.
- The per-frame activation analysis for the claude.ai frame is correct.
- The hidden-tab and idle handling is sound.
- The setting is per viewer and never travels with shared work.
- The loop sonification really does teach the argument principle. The exact tracker, the turn bells and "Listen along
  γ" with its read-back test are the strongest part of the design.

**Do not build it as specified.** Turning sound on also switches on a tier full of cues that fire on plain hover. On
top of that, the counting cues can be wrong, so the sound can teach the wrong lesson. The fixes are small and are
listed below. P1 means fix before building, P2 means fix before shipping, and P3 is polish.

## Answers to the five questions

| Question | Answer |
|---|---|
| Truly opt-in, easy to silence? | **Opt-in: yes.** But "on" enables Interface and Events, and Events is mostly hover-driven (P1-1). **Silencing:** one click or ⇧M on desktop. But turning sound off makes a sound (P1-7), a 2.6–7 s playback has no Stop or Esc (P2-13), and on phones the toggle is two taps deep (P2-16). |
| Anything firing too often? | **Yes.** Several cues fire too often: branch-cut ticks and contour ticks on hover, zero and pole pings that bypass every limit, the snap ratchet, a chime every loop of the deformation, and preimage cues caused by the view's edges. Measurements are below. |
| Real teaching or gimmick? | **Real** for loops and listen-along (argument principle, multiplicity, e^z periodicity, the jump at a cut), within limits. Five things undercut it: the hover tone can run backwards (P1-2), bells are dropped during fast drags (P1-3), brightness masquerades as pitch (P2-15), the preimage cue reports viewport artefacts (P1-4), and the Newton test for zero order is wrong for m ≥ 2 (P1-5). **Gimmick:** note names (C … B), and beeps for theme and panel toggles. |
| Helps non-visual users? | **Promising, not yet sufficient.** The keyboard probe and the announced winding number are the right start. Still missing: landmarks and navigation (jump to a zero or pole, "what is here?"). The polite live region re-reads a long paragraph on every click (P2-14), and the tone talks over speech (P3-23). |
| Mobile and iframe? | **Iframe:** correct. No `allow="autoplay"` is needed, and an opaque origin falls back to "off". **iOS:** `ambient` is the right session type. But a suspended or `interrupted` context queues sounds and would release them as a burst (P1-6). It is still untested on a device. **Phones:** silencing should take one tap (P2-16). |

## Measurements (headless Chrome 155; sound turned on by a real click)

| Scenario | Tiers | Result |
|---|---|---|
| √z: hover back and forth across the cut, 120 moves | default (Interface + Events; Hear F **off**) | **29 cut ticks in 3.9 s** (119 requested; the 120 ms gap dropped the rest) |
| The same, slower wiggle | default | 15 ticks in 3.8 s |
| Height mode, z² − 1: one 0.77 s sweep through the zero at 1 | default | **9 contour ticks + 1 zero ping in 0.77 s** (12 contours crossed, 3 dropped) |
| A ring of 12 simple zeros (r = 0.25): three sweeps | default | 7 zero pings in 0.98 s, **33 ms apart**: `force` bypasses the 250 ms gap and the storm guard |
| z⁵: hover a circle around 0 in 8 steps of 45° | Hear F on | arg F: **+0.625 turn per step, +5 in all**. The voice: **−0.375 octave per step, −3 in all**. It descends, as around a pole. |
| z¹⁶: drag a loop around 0 (90 moves) | Hear F on | W = 16 shown correctly, but **10 turn bells for 16 turns** during the drag (90 ms gap) |
| Right after that loop's auto-playback starts | | `play('toggleOn')` and `play('view')` return **false**: the 16 forced bells fill the storm guard's 1 s window. They work again after 1 s. |
| Context suspended, `resume()` pending (as iOS `interrupted`) | | 12 `play()` calls over 1.4 s **all return true** and schedule **42 oscillators at the frozen `currentTime`** (207.392 s). They would all sound at once on resume. |
| 3 clicks on the plane, 1 function switch | | `#result` (`aria-live="polite"`) rebuilt **4 times**, each time with the ~35-word instructions |

**Levels at 100 % volume, dBFS** (steady part for voices; loudest 50 ms window for cues):

| Shepard voice | Height voice | Turn bell | Contour tick | Interface key | Snap |
|---|---|---|---|---|---|
| RMS −26.3 at \|F\| = 1 · −25.1 near a pole · −33.0 near a zero | **RMS −23.7, constant** | −27.2 | −33.8 | −25.7 | −36.6 |

Panning: the hover voice at pan 0.7 is **12.5 dB quieter in the far ear**.

**Contrast of the dimmed text while sound is off** (WCAG 1.4.3 requires 4.5:1; these controls stay operable):

| Element | Light | Dark |
|---|---|---|
| Popover tier descriptions (opacity 0.55) | 2.36:1 | 2.72:1 |
| Popover tier titles | 3.93:1 | — |
| Sound-board card descriptions (opacity 0.62) | 2.69:1 | 3.08:1 |

---

## P1: fix before building

### P1-1. "Sound on" turns on hover chatter: the Events tier is mostly hover-driven, and it is on by default

**Problem.** The design makes the continuous tone opt-in, which is right. But most of the default-on Events tier
fires on plain hover:

- `cut`, `zero` and `pole` (in `setReadouts`, the hover path);
- `preFound` and `preLost` (in `hoverReadout`);
- `contour` (hover in Landscape).

Measured with Hear F **off**: 29 ticks in 3.9 s while moving the pointer around √z's cut, and 10 cues in 0.77 s for
one sweep in Height mode. Hover is the most frequent thing a user does: they move the mouse just to read values or to
reach a button. A maths user will switch sound off within a minute.

**Fix.** Split the cues by *what triggers them*, not by topic:

- **Mathematical events (default on):** only cues caused by a deliberate action:
  - deformation play, and arrival once per play;
  - loop closed, with its winding;
  - listen along a curve.
- **Hear the function (opt-in):** everything driven by the pointer's position:
  - the Shepard and Height voices;
  - cut, zero and pole, contour, turn bells.

  Rename this tier "Hear the function under the pointer".
- Alternatively, keep the tiers but never fire probe cues on passive hover. Fire them only:
  - while a button is held (a probe drag);
  - during the keyboard probe;
  - during a touch hold-probe.

### P1-2. The hover tone can run backwards: the opposite of the lesson

**Problem.** `ShepardVoice.set` wraps any step larger than half a turn: `if (Math.abs(d) > 0.5) d -= Math.round(d)`.
A step of +0.625 turn becomes −0.375. Around z⁵, the exact tracker reports +5 turns, but the voice falls 3 octaves.
**A zero sounds like a pole.**

Where this happens:

- The keyboard probe, the non-visual user's tool. A 12 px step around a zero of order m turns arg F by more than half a
  turn at any radius under about 3.8·m px, for example 19 px for m = 5.
- Any quick flick near a zero of order 2 or more.
- e^z on a wide view.

A related claim is overstated. DESIGN §2.5 says "the pitch moves the right way even when the pointer sweeps past a
zero". Passing straight by a simple zero turns arg F by about ±½ turn within one event. Gliding with τ = 12 ms, that
is a Shepard **tritone jump**, the textbook case of ambiguous direction (Deutsch's tritone paradox).

**Fix.** The sign is the information; never reverse it.

- Keep a *pending* phase. Play it out with its true sign at a capped rate, for example ≤ 2–3 turns/s, with τ scaled to
  the step: τ ≈ 12 ms + 0.25 s·|Δ|.
- If the backlog exceeds 1 turn, drop whole turns and mark each with a turn bell (or one bell per dropped turn,
  coalesced; see P1-3). Then the count survives even if the glide is shortened.

### P1-3. Cues that carry a count are dropped by rate limiting

**Problem.** Rate limits drop cues whose number is the information:

- Dragging a loop around z¹⁶ rang 10 bells for 16 turns: the 90 ms gap dropped 6.
- A Height sweep crossed 12 contours and ticked 9.

A listener counting bells hears "10" and is wrong.

**Fix.** Treat bells and contour ticks as *count-bearing*: never drop them.

- Queue them and play at ≤ 8/s, or coalesce into one figure (k rapid pings in 60 ms steps).
- Or play no live bells while dragging, and count only in the post-release playback. That playback is exact (its bells
  are scheduled), and the result is also announced.

Rate limits are for decorative cues only.

### P1-4. "Preimage found/lost" reports artefacts of the view, not mathematics

**Problem.** In the app, `hov.list` holds the preimages inside the visible left box (`publishHover` → `inBoxZ(r.z,
box, 0.02)`). Its count changes when:

- a preimage crosses the edge of the view;
- `trackRoot` loses a root (`lost = true`);
- a later discovery search (`hoverSearch`, every 60–150 ms or at rest) finds one that was missed.

None of these is an event in the function. For a rational map of degree d, the count with multiplicity on the sphere is
always d. The real event is two preimages merging as w crosses a **critical value**. A cue for the others teaches
students that something happened when nothing did.

**Fix.** Either:

- drop the cue; or
- fire it only when a preimage of multiplicity ≥ 2 appears (w is at a critical value; `r.mult` is already in the list),
  as "preimages collide", and never on changes in the count.

### P1-5. Zero and pole cues bypass every limit, and the proposed order test is wrong

**Problem 1: no limits.** `nearEvents` plays with `force: true`, which bypasses the 250 ms gap *and* the storm guard.
Measured: pings 33 ms apart in a cluster of zeros. In the app, z⁵⁰ − 1 at a normal zoom puts zeros about 7 px apart,
inside the 8 px radius, and sin(1/z) near 0 has infinitely many. Either pings continuously.

**Problem 2: the order cannot be found that way.** DESIGN §4.1 proposes Newton from F and F′. For F = (z − a)^m:

- z − F/F′ = a + (1 − 1/m)(z − a);
- so F at that point is (1 − 1/m)^m · F(z), not ≈ 0, whenever m ≥ 2.

The test therefore misses multiple zeros, and it cannot produce "m pings". Poles have the same defect.

**Fix.** Remove `force`, keep the gap, and coalesce. Compute the order **exactly with the argument principle**:

- Take a small circle (radius 8 px) around the probe. Do this only when |F/F′| is small, so only near a zero or pole.
- Use `calc.js`'s tracker; this is the `Calc.argStep` export already planned. N − P on the circle is the order:
  positive for a zero, negative for a pole.
- Key the hysteresis on the rounded location.

This also gives the "local order" command for non-visual users (P3-22).

### P1-6. A suspended context queues sounds and releases them as a burst

**Problem.** `play()` calls `ensure()`. `ensure()` returns true after *requesting* `resume()`, so `make()` schedules
the sound at the frozen `currentTime`. Measured: 42 oscillators queued at t = 207.392 s while suspended. They would all
sound at once when the next tap resumes the context.

This happens on iOS after a call or Siri (`interrupted`), or whenever `resume()` is refused. It contradicts DESIGN §1.2
rule 2 ("dropped, never queued").

**Fix.** In `play`, `liveVoice` and `curve`, schedule only when `ctx.state === 'running'`. One exception: during an
active gesture (`navigator.userActivation.isActive`), allow at most one sound, so that the "toggle on" confirmation
still plays.

### P1-7. Turning sound off makes a sound

**Problem.** `set({on: false})` forces the "toggle off" key and delays the fade by 170 ms. People mute *because* they
need silence: in a library, a lecture or a meeting, or when sound has become painful. System mute switches are silent.

**Fix.** Off is immediate and silent:

- fade the master in about 10 ms;
- the icon and `aria-pressed` are the confirmation;
- keep the audible "on" confirmation.

### P1-8. The deformation's arrival chime repeats forever

**Problem.** Loop is on by default (`S.loop !== false`). A one-step chain cycles in 1.6 s + 1.0 s hold, so
`morphEnd`, hooked "where `morph.T >= morphLen()` and the hold begins", chimes every **2.6 s** for as long as the
deformation plays. Longer chains do the same at their cycle length.

**Fix.**

- `morphStart` and `morphEnd` sound once per *user-started* play (M, the Play button), never on loop repeats.
- Probe cues are frozen while H_t animates (see P2-11).

## P2: fix before shipping

### P2-9. The continuous voices are too loud relative to the cues they carry

**Problem.**

- The Shepard voice's steady RMS (−26 dBFS) equals the loudest 50 ms window of a 100 ms interface key. A steady tone
  at equal RMS is perceived louder (temporal integration) and is far more tiring.
- The Height voice is a constant near-pure tone at −23.7 dBFS. It is the loudest steady sound in the design and sits
  **10 dB above** the contour ticks it is supposed to carry.
- Turn bells (−27) sit at the voice's level, in the same band (D6, A6 against partials around 0.5–2 kHz).

**Fix.**

- Lower the voices 8–10 dB: Shepard about −35 dBFS RMS at 100 %, Height about −33.
- Duck the voice 6 dB for about 250 ms under every one-shot cue.
- Let the Height voice dim like the Shepard voice instead of holding a constant level.

### P2-10. The snap ratchet

**Problem.** The 45 ms gap allows up to 22 ticks/s; the storm guard caps it at 14/s. The ticks are 3 kHz band noise,
in the ear's most sensitive band. Snap is the most frequent cue (DESIGN §5 Q1 says so).

**Fix.**

- A separate "Snap ticks" checkbox, **off** by default.
- When on, ≤ 8/s and coalesced.
- Centre around 1.8 kHz, 6 dB lower.
- Or tick only when the pointer settles on a grid point.

### P2-11. Probe cues during view gestures and animation

In the app, the z under the pointer changes without the user "moving the probe":

- **Landscape orbit:** the surface sweeps under the cursor, so contour ticks and the height glide fire while rotating.
- **Wheel zoom:** the 8 px proximity changes, so zooming out near a zero pings.
- **Deformation playback:** H_t changes at a fixed z, so cut and contour cues fire every cycle.

**Fix.** Suppress probe-driven event cues:

- while pan, zoom, orbit or pinch is active, and for 250 ms after;
- while the deformation plays.

The voice may follow; event cues should not.

### P2-12. Scheduled forced cues poison the storm guard

**Problem.** After a W = 16 auto-playback starts, Interface cues are refused for one second (measured).

**Fix.** Scheduled or forced cues don't enter `recent`, or are counted at their scheduled time.

### P2-13. There is no Stop

**Problem.** A 2.6–7 s playback, which starts by itself after every loop, cannot be stopped without Clear (which also
deletes the loop) or turning sound off:

- pressing "Listen along γ" again *restarts* it;
- Esc only cancels a loop being drawn;
- pointer moves are ignored while it plays (`if (play) return;`), so the probe and readouts freeze for up to 7 s.

**Fix.**

- The Listen button becomes Stop while playing (`aria-pressed`).
- Esc stops any playback or voice. It is a panic key that does not change the setting.
- Moving the pointer more than a few px ends playback and resumes the probe.
- Make auto-listen opt-in, or limit it to the first loop of a session.

### P2-14. Live-region churn for screen-reader users

**Problem.** `#result` is `aria-live="polite"` and is rebuilt on every `pointerdown` on the plane (`startLoop` →
`showResult(null)`) and on every function switch: 4 rebuilds from 3 clicks and 1 switch. Each rebuild re-reads the
~35-word instructions. A closed loop is announced twice, once by `#result` and once by `#live`.

**Fix.**

- Remove `aria-live` from `#result`.
- Announce only short messages through `#live`.
- Do not rewrite content that did not change.

The same applies in the app: `#toastHost` is already polite, so the error cue should accompany the toast's
announcement and never replace it.

### P2-15. Brightness masquerades as pitch

**Problem.** In Phase mode, ln|F| moves the Shepard envelope by ±0.85 octave. In a Shepard tone, the position of the
envelope *is* heard as pitch height. Approaching a pole along a ray of constant arg therefore sounds like rising pitch,
which is the cue reserved for arg increasing.

**Fix.** Either:

- keep the envelope fixed in Phase mode, and carry |F| by loudness alone (already 40–100 %) or by a cue that is not
  pitch-like; or
- cap the shift at about ±0.25 octave.

Settle it with a listening test before shipping.

### P2-16. Silencing on phones takes two taps

**Problem.** The toggle sits in the "More" menu, and there is no key. Android has no silent switch.

**Fix.** While sound is on, show the speaker button in the phone header, so silencing is one tap. It can return to
More when sound is off.

### P2-17. Dimmed text fails contrast

**Problem.** Opacity dimming takes the tier descriptions to 2.36:1 (light) and 2.72:1 (dark), and the board cards to
2.69:1 and 3.08:1. These controls remain operable, so they need 4.5:1.

**Fix.** Drop the opacity. Keep `--muted` and `--ink` at full strength, and add one line: "Sound is off: these take
effect when it is on."

### P2-18. Panning too wide

**Problem.** At pan ±0.7, the far ear is 12.5 dB down. Someone with one earbud, or with hearing loss in one ear, loses
the hover tone on one side of the plane.

**Fix.** Cap the voices at about ±0.3 (about −4 dB in the far ear) and the cues at ±0.4. The operating system's mono
audio setting covers the rest. Panning stays redundant, as it should.

## P3: polish

### P3-19. The toggle's name

**Problem.** The button's accessible name is `aria-label="Sound"`, but its visible text is "On" or "Off". A speech-input
user who says "click Off" fails, which breaks WCAG 2.5.3 (label in name). Screen readers read "⇧" as "upwards white
arrow".

**Fix.**

- Make the visible label "Sound" and show the state by the icon and `aria-pressed`.
- Use the title "Sound (Shift+M)" and add `aria-keyshortcuts="Shift+M"`.

### P3-20. ⇧M

**Problem.**

- In NVDA and JAWS browse mode, M is the "frame" quick key, so Shift+M never reaches the page. That is acceptable,
  because the button exists, but the guide should say so.
- It is another character-key shortcut (WCAG 2.1.4). The app already has many, so it should follow the app's policy
  for them.
- In `app.js`, the hook must sit **after** the dispatcher's guards: the modal check, `#popHost`, and `typing`. It should
  come first among the character shortcuts, not before the guards. Otherwise a capital M typed into a field toggles
  sound.

### P3-21. Note names

**Problem.** The C … B dial, "pitch D +12¢" and "pitch C" in announcements imply absolute pitch, which almost no one
hears. The chroma of a Shepard tone is heard only relatively. For screen-reader users this is noise.

**Fix.** Keep the dial as the phase wheel. Readouts and announcements should give arg in degrees or turns.

### P3-22. The keyboard probe needs landmarks to serve non-visual users

**Problem.**

- It starts at an arbitrary point (0.31, 0.23) without saying so.
- A step is 12 screen px, not a round z distance.
- Reaching the edge gives no feedback.
- There is no way to find zeros, poles or cuts except by stumbling on them.

**Fix.**

- Start at the view centre and announce it.
- Use steps in round z-units, announced.
- Give an edge bump: a sound and an announcement.
- Add keys for next and previous zero or pole (the chain's list from `calc.js`).
- **O, "order here":** the P1-5 small-circle argument principle at the probe. It announces, for example, "zero of order
  2", and plays its pings.
- **D, "describe the view":** zeros and poles with orders, cuts.

These are useful without sound, and they make the sonification a genuine non-visual tool.

### P3-23. The tone talks over speech

**Problem.** After each arrow step, the voice sustains for 1.6 s. The announcement starts 450 ms after the last key, so
the two overlap for more than a second.

**Fix.** In keyboard mode, play a 250–300 ms sample per step, and duck the voice while an announcement is pending.

### P3-24. Cut ticks in playback depend on the wrong tier

**Problem.** The cut ticks in "Listen along γ" go through the Events tier. With Events off and Hear F on, playback loses
them.

**Fix.** Route playback's ticks through the sonify tier.

### P3-25. Ship hygiene

- Remove the `EMBEDTEST` `message` hook. It accepts commands from any origin; it is test-only.
- The main-thread figure of 0.085 ms per update was measured for z² − 1. App chains can cost far more per evaluation,
  and the tracker evaluates F several times per event. Run it only when a tier needs it, and give it a per-event budget.

### P3-26. A hidden artifact panel still counts as visible

**Problem.** When claude.ai collapses the artifact panel, `visibilityState` stays "visible".

**Fix.** An `IntersectionObserver` on the root element can tell that the frame is out of view. Mute when it is.
Low priority: hover cannot happen then, but a playback or a looping deformation can.

## What I would tell the user

Sound is feasible and can be done tastefully, but it needs three changes to be good:

1. Nothing sounds on plain hover unless the user asks for it.
2. Cues that carry a count are never dropped or reversed.
3. Silence is one silent click (or tap) away, with Esc to stop any playback.

With the P1 fixes, Stage 1 (Interface plus action-driven Events) is low-risk. Stage 2 (hearing the function) is worth
building for its pedagogy and its accessibility, but only with P1-2, P1-3 and P1-5 fixed and the keyboard landmarks of
P3-22. Otherwise it is a beautiful demo that occasionally teaches the opposite of the truth.

# Sound review: `DESIGN.md` and `prototype.html`

The reviewer acted as a sound designer for scientific software. Every cue and both sonification voices were rendered
offline with the prototype's own engine (`Sound.render`, an `OfflineAudioContext` at 48 kHz) in headless Chrome 155.
The audio was then analysed in numpy:

- loudness: BS.1770 K-weighting, the maximum of the 400 ms momentary loudness ("LUFS-M");
- spectra;
- the room's tail;
- pitch trajectories;
- a small-speaker model: a 4th-order high-pass at 550 Hz for a phone, and at 250 Hz for a laptop.

The engine's guards were also exercised live (`review-sound/guards.js`). The scripts are in `notes/sound/review-sound/`.
Nothing outside `notes/sound/` was touched. The daemon was a private copy in the scratchpad; it is stopped and its
profile deleted.

## Verdict

The foundation is professional:

- consent and lifecycle;
- clean envelopes;
- a correct Shepard construction;
- exact argument tracking;
- winding numbers that can be read back from the audio alone.

The sound itself is not ready to build as specified. Two problems undermine the main teaching goal, hearing the
winding number:

- **The balance is upside down.** The continuous voices are the loudest sounds in the system. The turn bells that count
  the winding sit 9 dB under the drone.
- **The bells undercount.** They are dropped when turns come quickly.

Smaller problems:

- The "small room" that is meant to separate the families is inaudible.
- Panning silently costs 3 dB.
- Two cues disappear on phone speakers.
- In Height mode the tone and its ticks are out of tune with each other.

All of these are fixable with small, local changes. They are listed below with numbers.

## What is right (keep it)

- **Consent and lifecycle.** No context exists before consent. A remembered "on" waits for a gesture in this page load.
  The engine is silent when hidden and sleeps when idle. This is exemplary.
- **Envelopes.**
  - Every cue's last scheduled sample is exactly 0.
  - Tonal cues have attacks of 2 ms or more.
  - Energy above 14 kHz is at least 45 dB down.
  - Peaks range from −11.8 to −25.8 dBFS at 100 % volume, far from the −6 dBFS soft-clip knee.
  - I found no clicks.
- **The Shepard construction.**
  - Octave-spaced sines under a fixed Gaussian on log f.
  - Pitch is driven through `detune`, so glides are linear in pitch.
  - Wraps happen at −51 dB or lower. The worst case is a 33 Hz partial at the zero-side centre, which is inaudible.
  - Level ripple is 0.3 dB, and the winding read back from the audio is within 0.02 turn (re-run here, same numbers).
- **Semantics.** One ping per order for a zero, thumps for a pole. Up and down intervals for add/remove and for
  turns. "On" is higher than "off".
- **Architecture.** Tiers, per-cue gaps, hysteresis, and synthesis only, with no assets.

## Measurements (100 % volume, as rendered by the prototype's lab path, i.e. without a panner; see P1.3)

| Cue | Peak dBFS | LUFS-M | Phone model | Phone loss | Centroid | Length (−40 dB) | Dry/room |
|---|---|---|---|---|---|---|---|
| Snap | −17.9 | −40.1 | −40.1 | 0 | 3662 Hz | 21 ms | dry |
| Toggle on / off | −14.6 / −15.3 | −31.9 / −33.8 | −32.0 / −34.7 | 0 / −0.9 | 894 / 669 | 85 / 68 ms | 40 dB |
| Add / remove step | −15.7 | −30.2 / −31.0 | −30.9 / −31.8 | −0.8 | 765 | 139 / 126 ms | 39 dB |
| View (k = 0) | −16.8 | −35.4 | −37.3 | −2.0 | 620 | 66 ms | 17 dB |
| **Export ready** | −17.3 | **−25.1** (loudest one-shot) | −25.1 | 0 | 1501 | 599 ms | 27 dB |
| **Error** | −13.4 | −29.6 | **−45.1** | **−15.5** | 304 | 137 ms | 43 dB |
| Branch cut | −16.5 | −36.3 | −36.3 | 0 | 3071 | 43 ms | |
| Zero, order 1 / 2 / 3 | −20.6 | −32.2 / −29.4 / −27.9 | same | 0 | 1232 | 323–536 ms | 27–28 dB |
| **Pole**, order 1 | −11.8 | −29.5 | **−41.0** | **−11.5** | 347 | 122 ms | 31 dB |
| Preimage found / lost | −19.8 / −21.7 | −31.3 / −32.7 | same | 0 | 1109 | 342 / 310 ms | 30 dB |
| Contour, k = −6 / 0 / 3 / 8 | −21 | −40.8 / −40.6 / −40.2 / −38.0 | **−61.8** / −42.7 / −40.3 / −38.0 | **−21** / −2 / 0 / 0 | 248–1794 | 43 ms | 16–26 dB |
| Deformation plays | −20.9 | −32.2 | −33.3 | −1.2 | 696 | 353 ms | 29 dB |
| **Scrub tick**, t = 0.5 / end | −25.8 / −19.6 | **−47.6** / −33.7 | same | 0 | 1137 | 33 / 164 ms | |
| Deformation arrives | −19.0 | −28.8 | −28.8 | 0 | 1338 | 557 ms | 26 dB |
| Turn up / down (alone) | −19.5 | −30.1 / −31.5 | −30.2 / −32.1 | 0 | 1435 / 814 | 385 ms | 27 dB |
| **Shepard voice**, ln\|F\| = −8 / −1 / 0 / 1 / 8 | −28 … −20 | **−30.9 / −25.9 / −23.8 / −22.7 / −21.6** | −39.2 / −30.1 / −26.3 / −24.1 / −22.0 | −8 … 0 | 347 → 1124 | continuous | |
| **Height voice** (any pitch) | | **−21.5** | −49.5 near zeros … −20.5 near poles | up to **−28** | 161–1199 | continuous | |

---

## P1: fix before building

### 1. The continuous voices are the loudest sounds, and they bury the cues that carry the mathematics

**Evidence.**

- The Shepard voice measures −23.8 LUFS at |F| = 1, with a range from −30.9 to −21.6.
- The Height voice measures −21.5 LUFS.
- Every one-shot is quieter than the Shepard voice at |F| = 1: Export by 1.3 dB, the others by 4 to 24 dB.
- **The turn bell, the sound that counts the winding number, is −33.1 LUFS-M: 9 dB under the voice it rides on.**
- In the 150 ms after the bell's onset, its A6 partial is only 4.4 dB above the voice in that band, so it is partly
  masked. The voice's partial at 1700 Hz sits in A6's critical band.
- In Height mode, the contour ticks (−40 LUFS) are 19 dB under the Height voice (−21.5 LUFS), which also plays at a
  nearby pitch (§10). They will mostly be masked.
- A continuous layer should sit under the events, not 6 to 10 dB above them. Steady sounds are also perceived as louder
  than 100 to 300 ms cues at the same LUFS-M, which makes the imbalance worse in practice.

**Fix.**

- `SH.amp` 0.085 → **0.030** (−9 dB), which puts the voice at about −33 LUFS at |F| = 1.
- `HeightVoice` gate 0.09 → **0.03**.
- Add `duck()` to the live voices. When any `events` or `sonify` cue starts, glide `vg.gain` to 0.55 (−5 dB) with
  τ = 10 ms, and back with τ = 80 ms after 150 ms. Call it from `play()` for every live voice.
- Put the turn bell above the voice's envelope (§11).

### 2. Turn bells are dropped, so the winding number you count by ear is wrong

**Evidence** (`guards.js`, live context):

- Two turns in one pointer event: **1** bell. This happens near a zero, where `turnBells` loops twice and the second
  call hits the 90 ms gap.
- Five turns at 60 ms intervals, a quick circle around an order-5 zero: **3** bells (pattern ✓ ✗ ✓ ✗ ✓).
- The storm guard (14 per second) can drop more.

The design says the bells count turns, so dropping them is a correctness bug, not just a matter of taste. "Listen along
γ" is unaffected because it schedules its bells with `force`.

**Fix.** Never drop a turn: queue it.

- Keep `nextTurnAt` on the audio clock.
- Each new turn plays `play('turn', {dir, at: max(0, nextTurnAt − now), force: true})`, then
  `nextTurnAt = max(now, nextTurnAt) + 0.10`.
- Cap the queue at 8 bells. Beyond that, play one "many turns" flourish and rely on the visible count.

### 3. Panning silently costs 3 dB, and the documented levels are 3 dB hot

**Cause.**

- `out()` inserts a `StereoPannerNode` only when `pan` is non-zero. With pan = 0, a mono source is up-mixed to stereo at
  unity in each channel.
- With any pan ≠ 0, the equal-power panner applies cos/sin, which is 0.707 per channel at the centre.

**Evidence.**

- Every cue at pan = 0.001 is **−3.0 dB** relative to pan = 0.
- "Listen along γ" (`Sound.curve` uses `out(G, 'sonify', 0, …)`, so no panner) is **+3.0 dB** louder than the live
  hover voice, which always has a panner, for the same F.
- Every app hook passes a pan, so real use is 3 dB quieter than the lab table in DESIGN §2.2.
- A control at the exact centre would be 3 dB louder than its neighbour.

**Fix.**

- Always insert the panner when `createStereoPanner` exists, including at pan = 0.
- In the fallback, scale by `Math.SQRT1_2`.
- Recalibrate afterwards (targets below).

### 4. The "small room" is inaudible

**Evidence** (`room_tail.py`).

- For the bells (zero, turn, export, morph end), the room's output peaks **28 to 31 dB below the dry sound**.
- It rises above the dry signal only after the dry signal has decayed **70 to 80 dB** (42 dB for the pole).
- So the family rule "Interface dry; the mathematics rings" is not actually realised.
- Meanwhile the `ConvolverNode` runs continuously, and it is most of the idle cost.

**Cause.** `ConvolverNode.normalize` defaults to `true`, which scales this IR to about −12 dB of energy. With a send of
0.2 and `wet` at 0.5, the result is about −32 dB.

**Fix.** Choose one:

- Raise `wet` 0.5 → **2.0** (+12 dB). Target: a direct-to-room ratio of about 15 to 18 dB for bells, 28 dB or more for
  keys, and a tail that emerges about 35 to 45 dB below the peak.
- Or drop the room entirely, saving the convolver and the IR generation, and separate the families by timbre alone.

I recommend the first: a short, dark tail is what makes a bell read as "mathematics" rather than "button".

### 5. Error and pole disappear on phone speakers

**Evidence** (phone model).

- Error: −29.6 → −45.1 LUFS (−15.5 dB). It goes from one of the loudest cues to almost the quietest.
- Pole: −11.5 dB.
- Contour at low levels (D3 to E4): −21 dB.
- The DESIGN note "a few dB hotter on purpose" compensates only about 3 dB. No level boost can fix this without
  booming on good speakers. The identity of these cues has to move into the 500 Hz to 2 kHz range.
- The pole's 392 → 196 Hz is G4 → G3, which is outside the stated D-major-pentatonic palette.

**Fix.**

- **Error:**
  - keep the two D4 knocks;
  - add a "body": noise band-passed at 1.2 kHz, Q 3, t60 25 ms, amp 0.22;
  - add a sine at D5, 0.4× amplitude, t60 60 ms;
  - widen the low-pass to 2 kHz.
- **Pole:**
  - sweep A4 → A3 (440 → 220 Hz);
  - raise the 2nd harmonic to 0.10 (−6 dB);
  - add a felt "contact": noise band-passed at 1.5 kHz, Q 2, t60 8 ms.
- **Contour:** the lowest tick should be no lower than A3. In practice, use the Height scale in §10.
- **Target:** a phone loss of 5 dB or less for every cue.

### 6. Forced zero and pole pings bypass the gap and the storm guard

**Evidence.**

- `nearEvents` calls `play(kind, {force: true})`. With 20 zero entries in 0.8 s, **20 of 20 played**. Each is a 0.5 s
  bell, so they pile up.
- The 250 ms gap in the catalogue is never applied to these cues.
- Functions with accumulating zeros will storm. Examples: essential singularities like sin(1/z), high-degree
  polynomials and their iterates, and Blaschke products.

**Fix.**

- Drop `force`.
- When more than two zeros or poles are entered within 300 ms, play a single "dense" cue instead: three quiet
  pentatonic glass ticks at −10 dB. Then suppress the cue for 600 ms.

---

## P2: sonification design

### 7. The |F| cue moves pitch height, not brightness, and it competes with the winding

Moving a Shepard tone's spectral envelope *is* the pitch-height dimension; that is the classic Shepard/Risset result.
The mapping (arg F → chroma, ln|F| → height) therefore puts **log F on the pitch helix**. That is a lovely
interpretation, and the documentation should present it that way. But the swing is large:

- the envelope centre moves ±0.85 octave;
- the measured centroid moves from 347 to 1124 Hz, 1.7 octaves;
- the level moves 9.3 dB on full-range speakers and **17 dB on the phone model**, so "never silent" near a zero is not
  true on a phone.

A loop that circles a zero while |F| changes a lot is heard as "chroma rising, register falling". Examples: a
non-circular loop, or a zero with a pole nearby. The endless-climb illusion, which carries W, is strongest with a fixed
envelope.

**Fix.**

- Centre `c0 + 0.4·tanh(ln|F|/2.5)`.
- Loudness floor 0.4 → 0.6. Target: a total range of 6 dB or less (full range) and 8 dB or less (phone).
- If |F| should stay vivid, add a **height-neutral** brightness: a per-partial 3rd-harmonic mix of 0 → 0.2 with
  ln|F|.
  - Each partial's harmonic moves with it, so the tone stays exactly circular.
  - Cost: 9 more oscillators, or a `PeriodicWave` pair crossfaded.
- Rename "brightness" to "register" in DESIGN §2.5.

### 8. Wrong-direction chirps near zeros

`set()` folds any per-update change with |d| > 0.5 turn: `d -= Math.round(d)`. So +0.7 turn becomes −0.3: the tone
glides **down** while arg F went up. This happens exactly where it matters: near high-order zeros and in fast sweeps.

**Fix:** `d = Math.sign(d) * (Math.abs(d) <= 1 ? Math.abs(d) : Math.abs(d) % 1)`. That folds only beyond one turn per
update and never reverses direction. With |d| ≤ 1, a wrapping partial is at −45 dB or lower relative to the loudest
one, even with the envelope at its pole-side extreme (about −66 dBFS), so the instant wrap stays inaudible.

### 9. τ-smoothing scallops at the update rate

The engine applies `cancelAndHold` + `setTargetAtTime(τ = 12 ms)` 60 times a second. Measured on one oscillator driven
exactly like the voice:

| Sweep | setTarget, 60 Hz ripple (p-p) | Linear ramp to the target over the frame |
|---|---|---|
| 0.25 oct/s | 0.9 ¢ | 0.0 ¢ |
| 1 oct/s | 3.1 ¢ | 0.1 ¢ |
| 3 oct/s (fast hover near a zero) | 9.2 ¢ | 0.3 ¢ |

With irregular event timing, the staircase becomes a rough, jittery FM texture. Irregular timing comes from 120 Hz
displays, coalesced pointer events, and the heavy GL frames the doc mentions.

**Fix.** In `set()`:

- `const dt = clamp(t − lastT, 0.008, 0.05)`;
- then `cancelAndHoldAtTime(t)` and `linearRampToValueAtTime(target, t + dt)` for detune and the partial gains;
- keep `setTargetAtTime` only for the gate and the pan.

The added lag is one frame, the same order as the current τ.

### 10. Height mode: the tone and its contour ticks are out of tune with each other

The Height tone follows 440 · 2^(1.5 tanh(ln|F|/3)). The ticks play `penta(k)`. At each level line the two are an
unrelated interval apart:

| Level k | −4 | −3 | −2 | −1 | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|---|---|---|---|
| tick − tone (cents) | 586 | 565 | 604 | 511 | 500 | 389 | 296 | 335 | 314 |

These are near-tritones and out-of-tune thirds. Because of the tanh, the pitch distance per contour also shrinks from
about 3 semitones to under 1.

**Fix: make the tone pass through the scale.**

- With `u = ln|F| / (2π/S)` (S = `S.sectors`, so one contour is one step), set
  `f = penta(⌊u⌋)·(penta(⌊u⌋+1)/penta(⌊u⌋))^(u−⌊u⌋)`, with u soft-clamped to ±10. Start the scale at A3 or higher.
- The tick plays the same note one octave up, so it is consonant and not masked.
- Every contour is then one scale step: the landscape becomes a staircase you can hear.
- Use the organ family's timbre: harmonics 1 to 4 at 1/n². It also survives phone speakers. Today the phone level spans
  −49.5 LUFS near zeros to −20.5 near poles, a 29 dB range.
- Set the level to about −33 LUFS (§1).

### 11. The palette's "never clashes" holds among cues, not against the voice

The Shepard voice is chromatic and can sit on any pitch class. Cues heard over it land on D, E, F♯, A or B regardless:
the turn, zero, pole, preimage and contour cues. Half the time that forms a minor 2nd or a tritone against the drone.

The turn bell is the worst case:

- It rings when arg F has returned to its *starting* pitch class, which is arbitrary.
- It is also the cue most confusable with the zero ping (§12).

**Fix.**

- While a live voice sounds, transpose pitched `events` and `sonify` cues to the voice's current chroma (root plus
  fifth).
- The **turn bell plays the loop's starting pitch class**: "you are home". Place it about 2 octaves above the envelope
  centre, around 2 to 2.5 kHz, where the voice is 19 dB or more down, so it is unmasked and consonant.
- A cheap complement: let arg 0 sound D rather than C, so that positive real F sounds the palette's tonic. Relabel the
  dial.

---

## P3: family, distinctiveness, polish

12. **Confusable pairs.** Cosine similarity of the spectro-temporal envelopes (1/6-octave bands, 10 ms frames, the first
    450 ms):
    - Deformation plays ~ turn down: 0.90.
    - Toggle on ~ contour k = 3: 0.83 (both A5).
    - **Export ready ~ turn up: 0.82.** Same notes (glass D6 → A6); only the spacing differs (90 vs 25 ms).
    - Zero ~ scrub end at t = 1: 0.82.
    - **Zero ~ turn up: 0.75.**

    Glass D6 is the onset of five cues. The zero/turn pair matters most, because both happen while you circle a zero.

    Fixes:
    - the turn bell as in §11;
    - **Export ready** joins the interface family with its own gesture: noise band-passed and swept 1 → 3 kHz over
      120 ms (amp 0.12), followed by key A5. "Written."
    - **Deformation plays**: a D4 + A4 swell with a low-pass opening from 400 Hz to 2 kHz over 0.3 s. A different
      gesture from a struck bell.
13. **Hierarchy.** Export ready is the loudest one-shot (−25.1 LUFS-M), 6 to 7 dB above the toggles, for a rare and
    benign event. Lower it 4 dB: amps 0.10 / 0.085 → 0.063 / 0.054.
14. **Scrub detents.**
    - The mid ticks are −47.6 LUFS-M: 7 dB under the snap detent and 13 dB under their own ends. Raise them 6 dB.
    - D5 · 2^t in 0.05 steps gives 60-cent steps, which fall between semitones.
    - Pitch only the landmarks at t = 0, ¼, ½, ¾, 1 (D5, F♯5, A5, B5, D6), and leave the other detents unpitched.
15. **Snap.**
    - It is the most frequent cue and also the sharpest: centroid 3.7 kHz, a 3 kHz band plus a D7 sine at 2349 Hz.
      Played up to 14 times a second, it will fatigue.
    - Use a band-pass at 1.9 kHz, Q 1.4, and drop the sine (or put it on A6 at −6 dB).
    - Keep the rotating noise segment. It already gives a natural ±2 dB variation (measured), so there is no
      machine-gun effect.
16. **Counting orders.**
    - Pings 110 to 120 ms apart (about 9 per second) are too fast to count reliably for m ≥ 4.
    - Use 150 ms spacing for m ≥ 3, with the first ping 3 dB louder.
17. **Shepard σ = 0.95 octave** is narrow: about 3 audible partials, −4.8 dB at ±1 octave. The measured stationarity is
    excellent, but audition σ = 1.2 with N = 10 as an A/B for a smoother hand-over between partials. Low priority: the
    narrow version keeps more energy above 300 Hz for small speakers.
18. **Sample-rate guard.**
    - Partials reach 16.7 kHz.
    - On a 16 or 22.05 kHz context (Bluetooth hands-free mode, some Android devices), the partials above Nyquist alias
      at −40 to −60 dB.
    - Set their gain to 0 above 0.45 · fs, in both the live voice and `curveBuffer`.
19. **DESIGN.md.**
    - The level table (§2.2) is 3 dB hot (§3) and uses peak/RMS rather than loudness. Replace it with a LUFS-M table
      that has a phone column.
    - The "70 to 80 dB down" wrap claim holds only at the default centre: −51 dB at the zero-side centre, still
      inaudible at 33 Hz.
    - "Brightness" should read "register" (§7).

## Calibration targets after the fixes (LUFS-M, 100 % volume, through the panner)

| Group | Target | Phone loss |
|---|---|---|
| Detents: snap, scrub, contour | −40 ± 2 | ≤ 5 dB |
| Interface keys: toggles, steps, view | −32 ± 2 | ≤ 3 dB |
| Events: zero, pole, preimage, cut, deformation | −30 ± 2 | ≤ 5 dB |
| Export ready, Error | −29 ± 1 | ≤ 5 dB |
| Turn bell (alone) | −29; at least 5 dB above the voice in its own band | ≤ 3 dB |
| Continuous voices at \|F\| = 1 | −33 ± 1, total range ≤ 6 dB | ≤ 8 dB |

Re-run `review-sound/analyse.py` and `room_tail.py` against these. Add them to the planned CDP regression as
assertions, next to the existing click and HF checks.

## Not verifiable here: a 10-minute listening check for the user

Offline analysis cannot settle perception. After the P1 and P2 fixes, listen on laptop speakers and on a phone for the
following:

1. Is a loop around the double zero of the rational function heard as **two climbs**, including a non-circular loop?
2. Can you count the turn bells against the voice?
3. Is the zero ping distinct from the turn bell?
4. Do Error and Pole read on the phone?
5. After five minutes of hovering, is the voice still pleasant at the default volume?

## Reproduce

`notes/sound/review-sound/`:

- `render_cues.js`, `render_voices.js`, `guards.js`: CDP command files for a copy of the kit;
- `analyse.py`: modes `cues`, `voice`, `glide`, `sim`, `hsweep`;
- `room_tail.py`.

The usage is in the header of `analyse.py`.

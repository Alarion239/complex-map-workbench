# Sound v2: design

This is the answer to the user's note of 2026-10-24: the slider "cracks", and the sounds feel mechanical when they play
constantly. The evidence is in `RESEARCH.md`.

The recipes below are implemented as a prototype in `synth2.js`. `listen.html` plays each one next to the current
sound. Nothing in `src/` was changed.

**Try it:** open `notes/sound/v2/listen.html` in Chrome (file:// works).
- **§1:** drag the slider in modes A, B and C, or play the recorded drags.
- **§2:** press A and B for every cue. B is new on every press.
- **§3:** the two Shepard tones.

## 0. In one paragraph

**Kept:**
- the tiers and the defaults;
- every meaning;
- the D-pentatonic palette and every pitch;
- every count (pings, bells), the levels and the click-free engine.

**Changed: what the sounds are made of.**
- **Interface keys** are small struck objects: a kalimba tine, a wooden bar, a woodblock, a felt drum. Each play is a new
  strike, softer or harder, brighter or darker.
- **Events** are struck or bowed glass that beats slowly as it rings.
- **The slider** no longer ticks. It breathes a soft air sound that follows how fast you drag. A wooden note marks t = 0,
  ¼, ½, ¾ and 1, and the whole thing is silent when you stop.
- **The Shepard tone** becomes a "glass choir": three slightly detuned voices per partial, slow drift, a vibrato that
  only grows while the pitch rests, and a little breath. Its pitch and winding stay exact.

## 1. Rules for the whole engine

### 1.1 One synthesis model: the strike

A cue is a list of strikes, plucks, air and bowed tones written into a short mono buffer (`synth2.js`), then played
through the app's existing `out()`: the equal-power panner, the tier and the room send. In the app, the same per-sample
loop should run in the existing AudioWorklet as a "strike" message, so that the main thread posts parameters only. As a
first step, rendering the buffer on the main thread costs about 0.1 to 0.4 ms per cue.

**A mode** (`mode()`): `amp · e(t) · sin(φ(t))`.
- e(t) is a raised cosine from 0 to 1 over the mallet contact time τ, then `exp(−6.9078·t/T60)`, with a raised-cosine fade
  over the last 12 ms to exactly 0.
- An optional pitch drop of `drop` semitones relaxes with a 60 ms time constant (a felt membrane's tension).
- Modes at or above 0.45·fs are left out.

**The mallet:** contact time `τ = soft · vel^(−0.2)` ms (Hertzian contact). Each mode is weighted by
`w(f) = 1 / (1 + (2fτ)²)`, normalised to the fundamental. A soft or slow strike is long and dark; a hard or fast one is
short and bright.

**The contact noise:** white noise with a Hann window of length `max(2 ms, 2.5τ)`. It passes a one-pole low-pass at
`kf · (0.6 + 0.8·vel)` (at most 6 kHz) and a one-pole high-pass at 250 Hz. Its gain is `g · knock`.

**Materials.** Each row gives the mode ratios, amplitudes, T60 factors and, where the mode beats, the split.

| Material | Ratios | Amplitudes | T60 × | Beat (Hz, ×0.8–1.25 per play) | knock, kf |
|---|---|---|---|---|---|
| tine (kalimba, clamped-free) | 1, 6.267, 17.55 | 1, .10, .025 | 1, .22, .08 | – | .05, 2.5 kHz |
| wood (tuned marimba bar) | 1, 3.93, 9.2 | 1, .22, .06 | 1, .32, .12 | – | .10, 1.8 kHz |
| block (woodblock) | 1, 2.4, 3.9 | 1, .45, .2 | 1, .5, .3 | – | .30, 1.2 kHz |
| skin (felt membrane, Bessel) | 1, 1.593, 2.136, 2.296 | 1, .45, .25, .18 | 1, .6, .45, .4 | – | .22, 1.5 kHz |
| glass (struck wine glass, approx.) | 1, 2.32, 4.25, 6.63 | 1, .34, .14, .05 | 1, .55, .30, .17 | 0.8, 1.6, 2.5, 3.1 | .025, 4 kHz |
| bar (free metal bar, today's "bell") | 1, 2.756, 5.404, 8.933 | 1, .26, .08, .025 | 1, .45, .20, .10 | 0.5, 1.2, –, – | .03, 3.5 kHz |

**A beating mode** is split into two sines at f ± b/2.
- Their amplitudes are `(1 − r)` and `r`, with r random in [0.3, 0.6].
- They start **in the same phase**: the strike excites both together. A random phase would cancel some onsets; it
  measured up to 7 dB of loudness spread between plays.

**The other primitives:**
- **`pluck()`:** Karplus-Strong. The loop is one period of delay with a two-point average and a first-order allpass for
  the fractional delay. The loss per period is `10^(−3/(f·T60))`. The excitation is noise, low-passed by `bright`,
  Hann-windowed over `max(one period, 3 ms)`, so there is no impulsive onset.
- **`air()`:** white noise into a Chamberlin state-variable band-pass whose centre glides exponentially from fa to fb.
  The envelope is a raised cosine, rising for `att`·dur and falling for the rest. A 6 to 10 Hz random flutter of
  depth `fl` keeps it from being a static hiss.
- **`bowed()`:** three sines at −5, +0.3 and +5.5 cents (±1.5 cents per play), amplitudes 0.34, 0.40 and 0.26. A
  raised-cosine attack, a hold, an exponential release. An optional glide to f1 follows a raised-cosine curve.

### 1.2 Variation on every play

| Parameter | Range per play | Applies to |
|---|---|---|
| level | ±1.5 dB, uniform in dB (snap ±2.5) | every strike and pluck |
| mode amplitudes | ±2 dB each | strikes |
| mallet velocity | ×0.88 to 1.12, so τ and brightness change | strikes |
| decay (T60) | ×0.88 to 1.12 | strikes |
| pitch | ±60 cents: snap (pitch means nothing there); ±6: interface keys; ±2: zero, loop and contour; **0**: turn bells and the Shepard tone | strikes, plucks |
| beat rates | ×0.8 to 1.25 | glass, bar |
| timing inside a figure | ±3 to 5 ms; the first note of a count is never moved | add/remove, error, loop pings, dense, many |
| noise | fresh every play | all |

For the app, use a fresh PRNG stream per play, seeded from the audio clock. Tests need a fixed seed.

### 1.3 Gesture sensitivity

`o.vel` (0 to 1) is how fast the gesture was. Where the app knows it:
- the slider: its speed in t per second;
- the pointer: px per ms at the moment of the cue;
- a zero or pole: how fast the probe approached;
- the arrival: the playback rate.

It sets the mallet (τ ∝ vel^−0.2) and the level (∝ vel). With no speed, a typical value is used (the defaults in
`synth2.js`). If a key still sounds the same every time, widen this range first: velocity ×0.75 to 1.25.

### 1.4 Repetition softens

The same cue again within 2 s plays 1 dB softer for each repeat, down to −4 dB, and the count resets after 2 s of
silence. Count-bearing cues are exempt: turn bells, loop pings and contour ticks keep their level, because their number
is information.

### 1.5 Space and position

- **Room sends** (the existing dark room, T60 0.75 s): interface 0.05 to 0.10 (about −22 dB), events 0.15 to 0.25
  (about −13 dB), pointer cues 0.05 to 0.20. Today the interface tier is nearly dry, which is part of its "electronic"
  sound.
- **Pan** as now: the cue's screen x, equal-power, capped at ±0.4 for cues and ±0.3 for voices.

### 1.6 Loudness

The targets of DESIGN §2.2 are unchanged: detents −40, keys −32, events −30, export −29, the voice −33. The new scrub
texture is a detent-level sound, −40 to −45 short-term while dragging.

## 2. The cues

All levels are LUFS-M at 100 % volume through the app's graph. A is today; B is v2 (`measurements.json`). Phone is the
loss through the 550 Hz high-pass. Pitches are the existing palette: st(n) = D4 · 2^(n/12), so st(12) = D5,
st(19) = A5, st(24) = D6.

### 2.1 Interface

| Cue | v2 recipe (`synth2.js` CAT) | A | B | B phone |
|---|---|---|---|---|
| Toggle on | tine A5, vel .65, soft 1.1 ms, T60 .24 s, amp .265 | −32.9 | −32.9 | 0.1 |
| Toggle off | tine E5, vel .5, **soft 1.8 ms** (darker), T60 .15, amp .36 | −33.8 | −33.9 | 0.9 |
| Add a step | tine D5 (vel .55, soft 1.3, T60 .2, amp .205), then 58 ± 4 ms later A5 (vel .65, soft 1.1, T60 .26, amp .22) | −31.5 | −31.5 | 0.5 |
| Remove a step | tine A5 (vel .62, soft 1.2, T60 .2, amp .27), then D5 (vel .5, soft 1.8, T60 .14, amp .24) | −32.2 | −32.2 | 0.7 |
| Switch view | a 50 ms "card" air (2.6 → 3.4 kHz, q 1.4, amp .03), then 20 ms later a wood bar on D5 / F♯5 / A5 / B5 (vel .6, soft 1.6, T60 .22, amp .20) | −32.9 | −33.0 | 0.4 |
| Export ready | paper slide: air 700 → 2200 Hz over 200 ms, q 1.1, amp .16, flutter .25; at 170 ms glass A5 (vel .55, soft .9, T60 .6, amp .32) and at 190 ms glass E6 (amp .14) | −29.1 | −28.6 | 0.1 |
| Error | two knocks 88 ± 5 ms apart, the second 25 cents flat and ×0.85: each a block D4 (vel .8, soft .9, T60 .09, amp .26, knock 5) and a block D5 (T60 .06, amp .40) | −30.0 | −30.6 | 4.1 |
| Edge (keyboard probe) | felt skin A4 (vel .6, soft 1.8, T60 .1, amp .17, drop 1 st, knock 3.5) and a block A5 tick (amp .2, T60 .04) | −38.5 | −40.6 | 5.6 |
| Snap (own switch, off) | block at 2.1 kHz ±60 cents, soft .5, T60 30 ms, amp .28, ±2.5 dB | −40.5 | −43.7 | 0 |

### 2.2 Mathematical events

| Cue | v2 recipe | A | B | B phone |
|---|---|---|---|---|
| Deformation plays | an inhale: air 600 → 2600 Hz over 0.6 s (q .9, amp .04, flutter .3, peak at 45 %) under two bowed-glass tones D5 (att .22, hold .12, T60 .7, amp .05) and A5 (30 ms later, amp .04) | −32.0 | −32.0 | 1.5 |
| Deformation arrives | a soft wood D4 body (vel .5, soft 2.2, T60 .5, amp .10); 12 ms later glass D6 (soft .9, T60 1.0, amp .13); 40 ms later glass F♯6 (amp .095). vel = the playback rate | −31.2 | −31.1 | 0.2 |
| Scrub | §3 | | | |
| Motion bed (new) | §4 | | | |
| Loop closed, W ≠ 0 | \|W\| glass pings on the pentatonic, 125 ms apart (±3 ms, not the first), rising for W > 0 and falling for W < 0; the first vel .85, then .62 − .02j; soft .8, T60 .5, amp .11; > 8: the flourish | −31.3 (W = 2) | −31.4 | 0 |
| Loop closed, W = 0 | one block knock A5 (vel .5, soft 1.2, T60 .08, amp .35) | | | |

### 2.3 Hear the function: pointer cues

| Cue | v2 recipe | A | B | B phone |
|---|---|---|---|---|
| Zero, order m | m glass pings D6, 110 ms apart (150 ms for m ≥ 3); vel = approach speed (default .6), later pings ×.75; soft .8, T60 .55, amp .21 | −29.4 (m = 2) | −29.4 | 0 |
| Pole, order m | m felt thumps: skin A4 (soft 1.6, T60 .16, amp .36, **drop 1.5 st**, knock 3.5) with skin A3 under it (soft 2.4, T60 .2, amp .06); 120 ms apart (150 ms for m ≥ 3) | −30.0 | −32.4 | **7.8** (open) |
| Branch cut | two muted plucks, F♯6 then D6 35 ms later (a step down); T60 .09 / .12 s, bright .22 / .18, amp .16 | −38.2 | −38.2 | 0.1 |
| One full turn | grace glass a fifth below (up) or a fourth above (down), vel .35, T60 .14, amp .12; 45 ms later glass on the home pitch class at 1.7 to 3.4 kHz, vel .7, soft .7, T60 .6, amp .15. **No pitch variation** | −29.3 | −29.4 | 0 |
| Many turns | five glass notes, 35 ms apart ±3 ms, up or down; vel .4, T60 .2, amp .10 | | | |
| Many zeros or poles | glass D6, E6, F♯6, 40 ms apart ±4 ms, vel .35, T60 .2, amp .085 | −42.0 | −41.9 | 0 |
| Contour (Height) | wood bar on the Height note an octave up; vel = pointer speed (default .5); soft 1.4, T60 .09, amp .25, ±2 cents | −39.5 | −39.5 | 0 |
| Preimages collide | two bowed-glass tones a whole tone above and below A5, gliding into A5 over 220 ms on a raised cosine (att .04, hold .1, T60 .5, amp .06 each). They beat faster as they converge, and the beating stops at unison | −32.1 | −31.9 | 0.1 |

The queues, caps, storm guard, transposition to the voice's chroma and ducking stay as they are (DESIGN §2.4).

## 3. The Deformation slider (scrub)

**Removed:** the detent every 0.05 of t. Sixteen of every twenty detents carried no meaning, and the train made the
crackle (RESEARCH §2.1).

**The speed texture (air)** is a continuous voice that lives while the slider is held. In the app it is a third
worklet voice, or native nodes: a looping noise buffer into two band-passes and one gain, as in `listen.html`.

- **Speed:** v = |dt/dτ| in t per second, from the slider's input events. It is smoothed by a one-pole filter with a
  25 ms attack and a 160 ms release.
- **Level:** `lvl = smoothstep((v − 0.1)/0.3) · min(1, (v/2.5)^0.6)`. It is silent below 0.1 t/s and when the slider is
  held still.
- **Source:** pink-ish noise (a one-pole low-pass of white noise at 900 Hz, ×3).
- **Bands:** the first is a Chamberlin band-pass with q 1.6 at `fc = 380 · 2^(2.2 t) · (1 + 0.12·lvl)`: 380 Hz at t = 0,
  1.75 kHz at t = 1, slightly brighter when fast. The second is at 2.3·fc, at 0.35 of the first.
- **Output:** a one-pole low-pass at 3.5 kHz. A gain flutter of 15 % at 6 to 10 Hz (smoothed random), so it moves
  like air, not like a fan.
- **Gain:** `0.06 · lvl` into the events tier, room send 0.12.
- **Measured:** −39.5 / −41.6 / −47.6 LUFS short-term for fast, medium and slow drags; centroid about 1.05 kHz; no
  transients.

**Landmarks.** When t crosses or reaches 0, ¼, ½, ¾ or 1, a wood bar sounds on D5, F♯5, A5, B5 or D6 (as now).
- vel = `clamp(0.3 + 0.25·log2(1 + v), 0.3, 0.85)`; soft 1.8 ms; T60 0.3 s, or 0.45 s at the ends; amp 0.065.
- These are forced, as now: they are never dropped.
- Measured with the air: −36.9 / −39.5 / −45.4 short-term. The current train is −35.7 / −35.2 / −37.5.

**The ends.** Reaching t = 0 or 1 faster than 0.8 t/s adds a felt bump: skin D3, vel v/4 (0.3 to 0.8), soft 3 ms,
T60 0.15, drop 1 st.

**The hook** (`sndScrub(T0, T1)` in `src/app.js`): pass the speed and t to the texture voice on every input event
(`texture.set(t, v)`), play the landmark strikes, and on `pointerup` or `change` let the release run out. Nothing is
queued; the voice only follows.

**Three choices for the user to hear in `listen.html` §1:**
- **A:** today.
- **B:** air and the five notes. Recommended.
- **C:** the five notes only (no texture), for anyone who wants near-silence.

C needs no new voice and is the cheapest fix.

## 4. The Deformation playing ("animated")

- **Start:** the inhale of §2.2, once per play the user starts (as now).
- **Motion bed (new, Mathematical events):** while the Deformation plays its **first pass**, the scrub's air texture is
  driven by the playback itself.
  - v is the playback rate in t per second and fc follows t. Its level is ×0.6 of the scrub's (about −45 LUFS
    short-term at a normal speed).
  - The landmark notes do not sound during a play (they belong to the hand).
  - It fades out over 0.4 s on arrival. It does not play on loop repeats, the same rule as the swell and the arrival.
  - It is off while "Hear the function" sounds, because the tone already follows H_t.
- **Arrival:** §2.2, vel = playback rate (normalised to 1 at a 2 s play).

The motion bed is specified here but is not in `listen.html`. It is the §3 texture driven by the play.

## 5. Hear the function: the voices

### 5.1 The Shepard tone becomes the "glass choir"

The pitch mapping is unchanged: 9 octave partials D1 · 2^pos, the same Gaussian bell (σ 0.95 octave, centre
4.1 + 0.3·tanh(ln|F|/2.5)), the same taper at the band edges, and the same loudness law. Added in the worklet's
per-sample loop (`shepard()` in `synth2.js`):

- **Three voices per partial:**
  - at −3.5, 0 and +3.5 cents (mean 0, so the chroma is unbiased);
  - amplitudes 0.13, 0.74 and 0.13;
  - random start phases;
  - panned −0.25, 0 and +0.25 (equal power). This is the ensemble width.
- **Drift:** each voice's detune walks ±1.5 cents and its amplitude ±0.06. A new random target comes about every 1.4 s,
  approached through a one-pole smoother with a 0.8 s time constant.
- **Vibrato:** shared, at 5.1 Hz, of depth `6 cents · s`. s rises toward 1 with a 0.7 s time constant while the chroma
  moves slower than 0.05 turn/s, and falls toward 0 within 0.15 s when it moves faster. A resting probe "sings"; a
  moving one glides cleanly, as singers do.
- **Breath:** white noise into a band-pass at the bell's centre frequency (about 630 Hz at |F| = 1), q 0.8, at 0.035 ×
  loudness (about −24 dB under the tone). It is gated with the voice.
- **Colour:** the bell's centre wanders ±0.06 octave, with a new target about every 2.7 s and a 2 s smoother. That is
  timbre only, not pitch.
- **Level:** overall gain ×1.22 to match today's loudness.
- **Measured:**
  - −32.0 LUFS at |F| = 1 (A −32.8);
  - slow level change 4.2 dB resting and 3.3 dB after a loop (A 0.19);
  - pitch class read back within 6.1 cents (mean 3.1);
  - a loop around a double zero reads +1.996 turns (A +2.000);
  - phone loss 1.7 dB.
- **Cost:** 27 phase accumulators instead of 9. About 3 % of one core, against 1.1 % now.

**What does not change:**
- The turn bell is exact: the "home" pitch class, with no random detune.
- The ducking under cues, the gate, and the click-free smoothing.

The beating and vibrato are slow (below 6 Hz, and below 2 Hz for the beats). They are not clicks: the detectors (9 to
11 kHz impulses, LPC residual) should see nothing. This must be re-checked when built.

### 5.2 The Height voice

The organ (harmonics 1 to 4 at 1/n) is kept for phone survival. Add the same two-voice ensemble (±3 cents, amplitudes
0.8 and 0.2), the delayed vibrato (5.1 Hz, 5 cents) and breath at the note's 2nd harmonic (−26 dB). The contour tick is
the wood bar of §2.3. (Not in `listen.html`.)

### 5.3 Listen along γ

It uses the glass-choir voice. The playback is a moving tone, so the vibrato stays near 0 except where arg F rests.
Its bells and cut plucks are the v2 cues.

## 6. Silent, on purpose

- Undo and redo.
- A hover with "Hear the function" off.
- The 16 non-landmark detents of the slider.
- Loop repeats of the Deformation, including the motion bed.
- Turning sound off.
- A cue the user did not cause.

## 7. Building it (for a later round; not done here)

`src/sound.js`:
- Add the primitives and the material table (about 4 KB). They are pure functions, so they can be tested in node.
- `CATALOG[*].make` writes its strikes into a buffer, or posts them to the worklet.
- Add the texture voice.
- Change the worklet's Shepard loop as in §5.1.
- Add a per-play PRNG and the repetition rule (§1.4).

`src/app.js`:
- `sndScrub` passes v and t, and stops the texture on release.
- The play loop drives the motion bed on its first pass.
- Optionally pass `vel` from the pointer to zero, pole and contour cues.

Tests:
- `t_sound.js`: the primitives (exact zero at both ends, no sample above the peak target, a seeded play is
  reproducible), and that turn bells carry no pitch variation.
- `sound_cmd.js`: the lab ranges get the B numbers. Pole and edge first need a phone loss within target.
- The click regressions: re-record with the glass choir and the texture. Neither may add detections.

## 8. Open

- **Taste.** Everything here was decided without listening. The user's ears decide between A, B and C, and on the
  kalimba-and-glass palette as a whole.
- **Pole and edge on a phone.** They lose 7.8 and 5.6 dB, against targets of 4 to 5. Raise the felt contact (the knock
  and its kf) or the A4 mode, then re-measure.
- **Tine and wood keys still correlate highly between plays** (0.97 to 0.999), because pitch is fixed. If the user
  still hears "the same click", widen the velocity range (§1.3) before allowing more detune.
- **Not built, not run in the app,** not click-tested, and not heard on Safari, Firefox or a phone.

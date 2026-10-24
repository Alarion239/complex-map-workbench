# Hear the function: the listening page

`options.html` (this folder) plays the four options of [`OPTIONS.md`](OPTIONS.md), and today's voice, on the same
scripted gestures. For the user's summary and the order in which to try things, see [`README.md`](README.md).

It is one self-contained file: no network, light and dark, laptop and phone. Open it in a browser with AudioWorklet
(only Chrome has been run) and press **Turn sound on** or any gesture. Nobody here has listened to it. Everything below
is measured, not heard.

This is v2 (2026-10-24), after the sound review ([`review-sound.json`](review-sound.json), snd-1 to snd-13) and the
math review ([`review-math.json`](review-math.json), hfmath-1 to hfmath-17). The finding each change answers is named in
brackets.

## What is on the page

### Function

The left card shows a phase portrait of one of seven functions:

- z² − 1
- (z − 1)/(z + 1)
- eᶻ
- z³
- z²/(z − 1), a double zero and a pole
- sin z
- √z: a branch point (marked ½) and a cut on the negative axis [hfmath-8]

The portrait uses the app's OKLCH wheel and its tiles. Zeros are white dots, with their order written beside them;
poles are black. Under the portrait, a one-line reading key for the chosen option says which colour is D and what each
note means [hfmath-13].

### Gesture

There are seven buttons. Every option plays exactly the same path.

- **Visit a zero, then a pole** (first) [snd-2]:
  - The pointer glides in and rests 1.3 s beside the point, 0.03 of the view's half-width away. That is 6 px on a
    laptop and 5 px on a phone, so the point is inside option 3's ring and the ping radius.
  - While resting it keeps the 1 px tremor of a resting hand, so the options that fall silent when you stop keep
    sounding.
  - Then it glides to the pole and rests there. On functions without a pole it visits another zero instead. On eᶻ the
    button is disabled. For option 4 it is disabled too: option 4 hears curves.
- **Slow sweep**:
  - It runs just above the axis, 0.03 of the half-width (it was 0.08), so it passes within the ping radius and inside
    the ring [hfmath-5, hfmath-9].
  - On eᶻ it is a diagonal: arg F climbs about a turn while |F| grows from e^−3.6 to e^3.6 [hfmath-8].
  - On √z it is a vertical line across the cut.
- **Loop: a zero**: two laps round a **simple** zero, or round √z's branch point. It is disabled when there is none
  [hfmath-2]. **Loop: a pole** and **Loop: a double zero** (the double or triple zero) do the same for those points.
- **Deform z → F** and **Hear the view** (option 4 only) are as before.

### Option

Today (reference) and options 1 to 4, with these settings:

- option 1: the instrument and the drone;
- option 2: plucked string (the default) or glass;
- option 3: the colour, *Rich* or *Light*. This replaces "home whistle −9 dB", which no longer fits the exact note.

### Listen for

The "Listen for" line is now written from each gesture's own facts [hfmath-1, hfmath-2, hfmath-6, hfmath-11]:

- the target's order;
- the laps;
- the sign of arg H_t's turn at the deformation's probe;
- the loop's W steps, computed by `deformFacts`.

## What changed in the sound

### Option 3, the ring

- **The note counts exactly** [hfmath-4, -5, -7, -16].
  - The note is harmonic 4 + W of D3, where W is the 20 px ring's own winding number, tracked exactly.
  - The Taylor and Laurent coefficients now only colour it. They are capped 5 dB under the note (*Light*: 12 dB under,
    and halved).
  - A zero or pole outside the ring therefore never sounds like one inside.
  - Coefficients below the scale are dropped, not folded onto D3 (that fold made a false "triple pole").
- **The voice** [snd-1].
  - The hum is now a sung vowel: a 1/n source under formants at 400 Hz, 800 Hz, 2.5 kHz and 3.4 kHz.
  - It sits 6.8 to 7.8 dB under the note. Before, it was a near-sine 18 dB under.
  - The note's neighbours are at least −14 dB, so the whistle is a resonance on the voice, not a lone partial.
  - The vibrato runs at 5.2 Hz: ±20 cents while steady, ±8 while the spectrum moves (before, there was none while
    moving).
  - Measured by `tools/hv_check.js` at three points:

    | | Strongest harmonic above the 3rd | 2–5 kHz band, re the whole voice |
    |---|---|---|
    | Target | the note | −20 to −25 dB |
    | Measured | the note, at every point | −22.4 to −23.1 dB |

- **Level** [snd-5]. The spectrum always has unit energy, so the colour setting does not change the loudness. The
  old +3.5 dB make-up is gone.
- **Low notes** get +2, +3 and +4 dB on harmonics 3, 2 and 1 (A4, D4, D3), for small speakers [snd-3]. That is half
  the review's +4/+6/+8: the vowel and the skirt already carry the low notes through harmonics 2 to 6, and more would
  make poles 4 to 6 dB louder than zeros on headphones.

### Option 4, curves sing

- **The heard note is W** [hfmath-3, hfmath-17].
  - The phase is played compressed: φ̃(s) = W s + λ (φ(s) − W s), with λ the largest value ≤ 1 for which the RMS
    deviation is at most 0.12 turn.
  - The spectral centre stays exactly W, and W is now the strongest harmonic at every radius of "Hear the view" on all
    six meromorphic functions, with at least 54 % of the energy.
  - eᶻ stays on D5. It used to fall two octaves.
- **Undefined W** [hfmath-6]. When the curve passes within 1 px of a zero or pole (by Newton distance), the note holds
  for an instant: no spurious W is sung. On z³ it used to sing W = 2 for one frame. Across a cut, it fades out.
- **Its own body** [snd-8]: an /a/ vowel, a 120 ms bowed attack, and a 0.3 s bloom into the release note.

### Option 2, the harp

- **A darker string** [snd-7].
  - Harmonics fall as 1/n, below min(4 kHz, 3 f0); nothing sounds above 5 kHz.
  - The contact noise stays at or under 3 kHz, and "bright" now spans 0.2 to 0.45.
  - The room send is 0.12 (it was 0.18) [snd-11].
- **The deformation plays** [hfmath-1].
  - The "D only" zone near a zero now applies only while the pointer moves, since a still probe has no tremor.
  - Inside that zone, an up-crossing D also sounds the A above and a down-crossing D the A below, so the sign stays
    audible [hfmath-12].
- **Levels** [snd-5].
  - The velocity floor is now 0.55 (glass 0.6).
  - A run's notes are scaled by (2.5/rate)^0.6. The rate is the larger of the count over the last 0.5 s and 5 × the
    turns per second, so a sudden run starts light.
  - The glass variant no longer scales by velocity twice.
- **Accent and pings** [snd-3, snd-6].
  - The turn's accent is a plucked D4, not D3.
  - The glass harp's zero ping is wood, so it is not one more glass D.
- **Audio thread** [snd-9]. The live strings are kept as a list: no `filter()` per string.

### Everything else

- **Cuts** [hfmath-8]. The probe detects a jump, as the app's `argStep` does. It plays palette B's cut tick, and the
  voice glides the jump in 12 ms, as the app does. A jump rings no turn bell and plucks no string.
- **Option 1.**
  - The drone follows the volume slider while a tone is held [snd-10].
  - The voice's floor level is 0.55 (it was 0.45).
  - Its two timbres.js nodes are disconnected 0.5 s after you leave option 1 [snd-9].
- **iPhone.** `navigator.audioSession.type = 'playback'` is set before the context is made [snd-4]. A note shows on
  touch screens; it has not been tested on a device.

## Measurements

### Method

- **Offline.** `tools/measure.js` runs the page's own controller code and renders its worklets in node. That covers
  281 renders: 10 option variants × 7 functions × every gesture.
- **Real time.** Headless Chrome (`claude_cdp/`, port 9071) presses the real buttons, and the AudioWorklet tap
  records the output: 8 recordings, 184 s in all. `claude_cdp/runall.sh`; `FULL=1` records every option.
- **Loudness.** BS.1770 LUFS-M, 400 ms. "Gated" is the mean over loud blocks; the loudest block is in brackets.
- **Clicks.** `../cdp3/det.py`: detector A finds 9–11 kHz impulses; detector B uses the linear-prediction residual.

### Loudness

At rest (`tools/calib.js`):

| Sound | LUFS-M |
|---|---|
| today, \|F\| = 1 | −32.7 to −33.0 |
| harp note, velocity 0.7 | −32.0 (string), −32.7 (glass) |
| singer at home, /u/ and /a/ | −32.1 and −31.9 |
| singer on F♯5 | −31.8 to −32.1 |
| singer on A4 | −31.3 to −31.5 (before the low-note make-up) |
| singer on D4 | −30.9 to −31.1 (before the low-note make-up) |
| zero ping (glass and wood) | −31.9 |
| pole | −30.9 |
| turn bell | −30.3 |
| cut tick | −31.0 |

Per gesture, offline. Each cell is the gated mean over the functions, with the loudest block in brackets:

| option | visit | sweep | zero loop | pole loop | double-zero loop | deformation | hear the view |
|---|---|---|---|---|---|---|---|
| Today | −33.4 (−26.5) | −33.0 (−25.8) | −32.2 (−28.2) | −31.9 (−28.0) | −31.7 (−28.7) | −34.1 (−26.9) | – |
| 1 cello | −32.5 (−25.8) | −33.2 (−25.2) | −31.4 (−27.8) | −31.6 (−28.0) | −30.0 (−27.8) | −33.4 (−26.8) | – |
| 1 choir | −33.2 (−26.0) | −34.0 (−25.3) | −32.1 (−28.3) | −32.5 (−28.3) | −30.6 (−28.0) | −34.0 (−27.0) | – |
| 1 glass | −32.9 (−25.8) | −33.7 (−25.3) | −31.9 (−28.0) | −32.1 (−28.0) | −30.3 (−28.0) | −33.9 (−27.2) | – |
| 1 clarinet | −32.5 (−25.8) | −33.3 (−25.2) | −31.5 (−27.9) | −31.7 (−27.9) | −30.0 (−27.9) | −33.4 (−26.8) | – |
| 2 string | −32.8 (−27.9) | −32.9 (−28.0) | −32.4 (−28.4) | −33.5 (−29.6) | −31.8 (−29.7) | −33.7 (−27.9) | – |
| 2 glass | −31.5 (−26.8) | −32.6 (−28.1) | −33.1 (−28.2) | −34.3 (−30.8) | −32.7 (−30.2) | −33.0 (−28.7) | – |
| 3 rich | −31.0 (−26.2) | −31.3 (−26.8) | −31.8 (−27.2) | −32.1 (−31.5) | −32.0 (−31.5) | −31.7 (−28.8) | – |
| 3 light | −31.2 (−26.2) | −31.4 (−26.8) | −31.9 (−27.4) | −32.2 (−31.6) | −32.1 (−31.7) | −31.8 (−28.9) | – |
| 4 | – | −33.7 (−30.1) | −34.2 (−30.7) | −31.0 (−27.3) | −33.1 (−30.0) | −32.6 (−30.7) | −32.3 (−30.3) |

- **The spread on one function and gesture** is at most 4 dB in every case. `measure.js` checks this.
- Two kinds of render are left out of that check, because they are silent by design:
  - option 1 on the deformation;
  - option 4 on √z, and the harp on √z's deformation.
- Before the fixes, the spread reached 7 dB.
- **Peaks.**
  - Offline, the highest is 0.27 (−11.5 dBFS). It comes from the pings and the pole drum, which now fire on the
    sweep and the visit.
  - In real time, the gated level is −31.0 to −34.3 and the peak at most 0.25.

### Clicks

| | detector A | detector B (engine) |
|---|---|---|
| 2 harp, string and glass | 0 / 0 | 0 / 0 |
| 3 ring, both colours | 0 / 0 | 0 / 0 |
| 4 curves | 0 / 0 | 0 / 0 |
| 1 choir | 0 / 0 | 0 / 0 |
| 1 glass harmonica | 0 / – | 6 at −58 dB / – |
| 1 cello, 1 clarinet | 0 / – | 433 and 875, worst −17 and −25 dB: their own bow and reed noise (snd-12 confirms these are not clicks) |
| Today | 0 / 0 | 59 / 13 (real time worst −38.8 dB): the app's port, kept faithful |

(offline / real time; "–" means not recorded in real time this round)

Every real-time recording also had:
- 0 AudioParam automation calls;
- 0 scheduled-source starts;
- 0 underruns;
- 0 console errors.

Every offline render starts at exactly 0.

### CPU

The audio thread, from `tools/bench.js`. The busiest steady state, in node, as a share of one core:

| Option | Share of one core |
|---|---|
| Today | 0.28 % |
| 1 cello | 1.81 % |
| 1 choir | 2.76 % |
| 1 glass | 1.87 % |
| 1 clarinet | 1.92 % |
| 2 string | 2.31 % (was 3.06 %) |
| 2 glass | 3.42 % (was 3.72 %) |
| 3 and 4, the singer | 0.35 % |

Phones were not measured. Each string is still posted as a fresh object; a preallocated pool (snd-9) is not done.

### Exactness

`tools/verify.js` runs 71 checks, all passing:

- **Harp.** It plays on every deformation at 386 and 309 px, in the direction arg H_t turns.
- **Harp count.** Its D count equals W on the loops: +2, −2, +4 and +6.
- **Ring outside.** The ring sounds D5 (W = 0) on every loop. The point is outside it there.
- **Ring beside a point.** It sounds the order on every visit, at both sizes: F♯5 beside a zero, A5 beside the double
  zero, C6 beside the triple zero, A4 beside a pole.
- **Ring on the sweep.** It sounds A5 and A4 on z²/(z − 1), C6 on z³, and F♯5 and A4 on (z − 1)/(z + 1).
- **Hear the view.** W is the strongest harmonic at every radius.
- **Option 4 live.** W steps at 0.51 and 1.51 laps, with no spurious values.
- **No false D3.** The fold is gone: D3 is 21 dB under A4 beside a pole.
- **Pings.** Every sweep pings.
- **√z.** One cut tick on the sweep.
- **Glass harp.** Its zero ping is wood.

## Not done

- **Nobody has listened.** All of it is measured, and headless Chrome's output is muted.
- **Browsers.** Only Chrome on macOS has been run. Safari and Firefox are untested; the page needs AudioWorklet. The
  iPhone silent-switch fix is untested on a device.
- **Phones.** Phone CPU was not measured, and the harp's string pool was not built (snd-9).
- **The ring's room** (snd-11). The harp's room send is lower, but the allpass room was not changed. Listen to a single
  slow note for a metallic ring.
- **Options 3 and 4** share one singer. If both are adopted, the engine needs a second voice (snd-8).
- **Accessibility.** The buttons, radios and chips can be reached by keyboard; the portrait cannot.

## Files

- **`options.html`**: built by `node proto/build.js` from these sources, with `../v2/timbres.js` inlined:
  - `proto/page.html`;
  - `proto/worklet.js`;
  - `proto/core.js`;
  - `proto/ui.js`.
- **`tools/`**:
  - `measure.js`, `calib.js`, `bench.js` and `deform.js`;
  - `hv_check.js` (the singer's spectrum) and `verify.js` (the checks above);
  - `analyse.py` (loudness and clicks);
  - results: `measure.json`, `bench.json`, `offline_clicks.json`, `realtime.json`;
  - the math review's own probes, in `mathrev/`. They use the v1 ring API.
  - The audio files themselves are deleted (0.9 GB). Re-create them with `node tools/measure.js --save`.
- **`claude_cdp/`**: the headless-Chrome kit. `shots/v2_*.png` are this version's screenshots.

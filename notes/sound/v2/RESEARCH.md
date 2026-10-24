# Sound v2: research

The user (2026-10-24): "when I drag the time for deformation it makes cracking sounds. Is it supposed to do them? I come
to not really like the sounds. They are not as nice and quite mechanical when played constantly. Maybe you can try
making them more realistic and animated as well."

Nobody here can listen. The findings below come from measurements of the app's own cues (rendered offline in
Chrome through the app's real graph), from acoustics, and from the literature. The redesign is in `DESIGN.md`. A page to
compare by ear is `listen.html`.

## 1. The answer to the question

**Yes, the cracking is intended, but the sound is wrong.** Dragging the Deformation slider plays one "detent" each
time t crosses a multiple of 0.05 (`sndScrub` in `src/app.js`, cue `morphTick` in `src/sound.js`). Each detent is a burst
of white noise, band-passed at 1.5 to 3 kHz. It rises in 0.8 ms and dies in 20 ms. A drag sends 14 to 18 of these a
second. The 40 ms gap and the guard of 14 cues a second drop some of them, so the spacing is irregular. Each burst
reads a different part of the noise buffer, so its level changes by a few dB.

Short, noisy, bright and irregular impulses are what crackle is, acoustically. Fire, static and a Geiger counter all
sound like that.

## 2. What was measured

Method: `listen.html` → `window.__measure()`. Every cue is rendered with an `OfflineAudioContext` through `Sound.graph`:
the panner, its tier and the app's room, at 100 % volume. The slider is driven with 60 Hz input events that follow
the app's `sndScrub` exactly, including the gap and the storm guard.

Metrics:
- **LUFS-M:** BS.1770 K-weighting, loudest 400 ms.
- **Short-term:** the same, over 3 s (EBU R128).
- **Phone loss:** a 4th-order high-pass at 550 Hz, as in `test/sound_lab.js`.
- **Crest factor:** peak over the RMS of the active part.
- **Rise:** 10 to 90 % of the loudest onset.
- **Transients per second:** a 2 ms window more than 9 dB over the 20 ms before it.
- **Centroid**, and the **share of energy above 3 kHz**.
- **Alike:** the peak normalised cross-correlation of two plays of the same cue within ±3 ms. 1.000 means the two
  waveforms are identical.

The raw output is in `measurements.json`. It matches the app's lab: toggle on −32.9, Shepard −32.8 at |F| = 1. The
DESIGN gives −32.9 for both.

### 2.1 The scrub, as now (A)

| Drag 0 → 1 → 0 | Cues | Per s | Short-term | Crest | Rise | Transients/s | Centroid | Energy > 3 kHz |
|---|---|---|---|---|---|---|---|---|
| fast (0.5 s each way) | 18 | 18 | −35.7 LUFS | 19.7 dB | 1 ms | 8.2 | 1.5 kHz | 11 % |
| medium (1.2 s) | 34 | 14.2 | −35.2 | 20.9 | 1 | 9.4 | 2.1 kHz | 22 % |
| slow (4 s) | 40 | 5 | −37.5 | 18.9 | 1 | 4.3 | 1.9 kHz | 17 % |

- Each detent was designed at −40 LUFS. A train of them sums to **−35 LUFS short-term**, about as loud as the
  interface keys (−32). It is the loudest sound a person makes for a long time in this app.
- 14 to 18 sharp, bright pulses a second is the profile of an alarm. Auditory-warning research rates fast pulse rates,
  abrupt onsets and high, noisy spectra as urgent, and urgent sounds are annoying when nothing is urgent (Edworthy,
  Loxley & Dennis 1991). Psychoacoustic annoyance also rises with sharpness (the centroid) and with impulsiveness
  (Zwicker & Fastl).

### 2.2 Every cue repeats exactly

13 of the 20 cues measured **alike = 1.000**. Two plays are the same waveform to the sample. The noise-based cues
measured 0.30 to 0.97, but only because they read a moving offset of one noise buffer, and their spectra are the same.
All the pitched cues are sums of pure sines with linear 2 to 3 ms attacks and exponential decays. There is no material,
no strike, no variation by gesture, and no space beyond a short dark room. Exact repetition of one synthetic waveform is
what game audio calls the "machine-gun effect". It is the most common reason a sound starts to feel mechanical when it
plays often (Stevens & Raybould; Collins).

### 2.3 The Shepard tone is static

In the A rendering, with the probe resting, the level changes by **0.19 dB** over 4 s, and the pitch class read back
from the audio stays within **0.3 cents** of the target. It is a perfect test signal and sounds like an organ stop
held down by a machine. Nothing in it moves unless the pointer moves.

## 3. What makes sounds pleasant to live with

These are the ideas that recur across sonification, UI-sound and game-audio practice, with what each means here.

1. **Fewer sounds, and only meaningful ones.**
   - Material Design's sound guidance and Apple's HIG both say to use sound sparingly, to give each sound a meaning,
     and to avoid sounds for frequent actions.
   - The Sonification Handbook says the same about fatigue (Hermann, Hunt & Neuhoff 2011, chapters by Walker & Nees and
     by McGookin & Brewster).
   - For the slider: a continuous control should not click per step unless the step means something. The meaningful
     steps of t are 0, ¼, ½, ¾ and 1. The other 16 detents carry nothing.
2. **Continuous gestures get continuous sounds, not tick trains.**
   - Rolling, rubbing and scraping are heard as one texture whose loudness and brightness follow the speed (van den
     Doel, Kry & Pai 2001, FoleyAutomatic; Rath & Rocchesso 2005; Conan et al. 2014).
   - A texture tied to speed is silent when you hold still and soft when you move slowly. People hear it as a
     consequence of their motion, not as a notification. The continuous feedback also helps control (Rath & Rocchesso).
3. **Variation on every play.**
   - Game audio uses round-robin sample sets and small random offsets: pitch, level, filter and start time (Wwise
     randomizers, FMOD scatterers; Stevens & Raybould; Farnell 2010).
   - Procedural (physically parametrised) synthesis gets the same for free, because each play is a new strike
     (Cook 2002; Gaver 1993, "Synthesizing auditory icons").
   - **Where pitch carries meaning, it stays fixed.** That is the D pentatonic palette, the turn bell's home pitch class
     and the Shepard chroma. Those cues vary only below the pitch difference limen: a few cents, less than the ~5 to
     10 cents a listener can resolve for short tones (Moore). They also vary in brightness, decay and mode balance.
4. **Physical models, not oscillators.** Listeners hear material and action: what hit what, how hard (Gaver 1993,
   "What in the world do we hear?").
   - **Modal synthesis.** A sum of exponentially decaying modes with a material's ratios (van den Doel & Pai 1998):
     - a free bar: 1 : 2.756 : 5.404 : 8.933;
     - a tuned marimba bar: about 1 : 4 : 10;
     - a clamped tine (kalimba): 1 : 6.27 : 17.55;
     - a membrane: Bessel ratios 1 : 1.59 : 2.14 : 2.30;
     - a wine glass: roughly 1 : 2.3 : 4.3 : 6.6.

     These follow Fletcher & Rossing, *The Physics of Musical Instruments*. The glass values are approximate and a
     matter of taste.
   - **The mallet.** Its contact time sets the brightness: a soft or slow strike has a long contact, which low-passes
     the excitation. By Hertzian contact, the contact time ∝ v^(−1/5), so velocity maps naturally to brightness and
     level (Fletcher & Rossing).
   - **Glass and bells "breathe".** Their near-degenerate mode pairs are split by a fraction of a hertz to a few hertz.
     The pairs start in phase and beat as they decay. That slow beating is much of what makes a bell sound alive. (A
     first draft here started the pairs at random phases. A random phase could cancel the onset and swing the loudness
     by up to 7 dB from play to play, so they now start together.)
   - **A plucked string** is Karplus-Strong (Karplus & Strong 1983), tuned with an allpass (Jaffe & Smith 1983).
   - **FM bells** (Chowning 1973) are a cheaper alternative to modal glass. Modal synthesis was preferred because the
     whole palette then shares one model.
5. **Envelopes without hard edges.** A real strike rings in over the contact time (0.5 to 3 ms) along a smooth curve.
   It does not start with a corner at full amplitude. Raised-cosine onsets and fades avoid spectral splatter: the current
   engine is already click-free, and this makes the onsets softer still.
6. **A space, not a void.**
   - Even a little early reflection and a short tail puts a sound "in the room", outside the head (Begault 1994).
   - The current interface cues are ≥ 28 dB dry over the room, essentially anechoic. That is part of why they sound
     like electronics.
   - v2 sends every tier into the existing small dark room, about −22 dB (interface) to −13 dB (events).
7. **Stereo by screen position.** The cue sits where its cause is on screen, through an equal-power pan law, narrowly
   (±0.4). The engine already does this.
8. **Gesture sensitivity.** Level and brightness follow how fast the person moved. In games and instruments this is
   the difference between "an event happened" and "I did this" (Jonasson & Purho, "Juice it or lose it", GDC 2012).
9. **Habituation-friendly repetition.** A sound that repeats within a couple of seconds gets a little softer each time:
   −1 dB per repeat, down to −4 dB. A burst of toggles then does not hammer.
10. **Small speakers.** Laptop speakers lose most energy below 150 to 300 Hz, and phones lose most below 500 to 800 Hz
    (ISO 226 curves make it worse at low levels). Every cue needs energy between 1 and 4 kHz to survive a phone, but not
    so much that it is sharp. Low "warm" bodies are fine if a contact or overtone carries the identity on a phone.
11. **Animation through slow change.**
    - Choirs and bowed glass are pleasant to sustain because nothing in them is constant. Each voice drifts by a few
      cents, the ensemble beats slowly, vibrato appears on held notes and vanishes on moving ones, and there is breath
      noise (Sundberg 1987 on vibrato; Ternström on the pitch scatter of choirs).
    - For a sonification voice the motion must stay **below the information**. The chroma that carries arg F must stay
      unbiased: the detunes are symmetric and the vibrato has zero mean.
12. **What to keep silent.** Undo and redo, hovering with "Hear the function" off, the 16 meaningless slider detents,
    loop repeats of the Deformation, and anything the user did not cause.

## 4. What the v2 prototype measures (B)

The same harness, with the recipes of `DESIGN.md` (`synth2.js`).

The scrub (B: the speed texture and the five landmark notes; air alone in brackets):

| Drag | Short-term | Crest | Transients/s | Centroid | Energy > 3 kHz |
|---|---|---|---|---|---|
| fast | −36.9 (−39.5) LUFS | 15.9 (13.2) dB | 1.8 (0.9) | 0.96 (1.07) kHz | 1.3 % (2.5 %) |
| medium | −39.5 (−41.6) | 14.9 (14.2) | 2.2 (0.6) | 0.99 (1.08) kHz | 1.4 % (2.2 %) |
| slow | −45.4 (−47.6) | 18.0 (15.7) | 0.8 (0.1) | 0.95 (1.03) kHz | 1.1 % (1.9 %) |

Compared with A at a medium drag:
- 4.3 dB quieter;
- 6 dB lower crest;
- 4 to 15 times fewer transients (the only ones left are the 8 landmark notes);
- an octave lower in centroid;
- 15 times less energy above 3 kHz.

It gets quieter as you slow down and is silent when you stop.

The cues:
- **Levels.** Every B cue was trimmed to the current cue's LUFS-M within ±1 dB, except edge (−2.1 dB) and pole
  (−2.4 dB). Snap is −43.7, which is its design target.
- **Phone loss.** At most 1.5 dB for 17 cues. Error 4.1 dB (A 3.3). Edge 5.6 dB and pole 7.8 dB are still over their
  targets of 5 and 4 (open: more felt contact above 550 Hz).
- **Alike.** Two plays measure 0.04 to 0.95 for the struck, plucked and noise cues. The tine and wood keys whose pitch
  is fixed measure 0.97 to 0.999. Their variation is in level, brightness and decay, which this metric mostly does
  not see. If they still sound identical, widen the mallet range first (DESIGN §1.3).

The Shepard tone (B, the glass choir):
- **Loudness:** −32.0 LUFS (A −32.8).
- **Slow level life:** 4.2 dB resting, 3.3 dB after a loop (A 0.19).
- **Pitch class read back:** mean error 3.1 cents, max 6.1 (A 0.2 / 0.3).
- **Winding:** a loop around a double zero reads +1.996 turns (A +2.000).
- **Phone loss:** 1.7 dB.

The first draft had ±5.5 cents of detune and equal-level voices. That beat by 8 to 12 dB and read back with errors up to
13 cents, so the side voices are now quieter (0.13 / 0.74 / 0.13) and ±3.5 cents. The winding stays exact by ear, and the
tone is no longer a fixed test signal.

## 5. Limits

- **Taste.** No one here can hear. The numbers say the v2 scrub is quieter, smoother, darker and not impulsive, and that
  the cues vary. They cannot say whether the user will like kalimba keys or glass bells. `listen.html` puts A and B side
  by side for that.
- **Not measured in the app:** `synth2.js` renders into buffers. The app would run the same arithmetic in its
  AudioWorklet, which has not been built or click-tested.
- **Only Chrome.** The renderings are from headless Chrome, at 48 kHz.

## References

- Begault, D. R. (1994). *3-D Sound for Virtual Reality and Multimedia.* Academic Press.
- Chowning, J. (1973). The synthesis of complex audio spectra by means of frequency modulation. *JAES* 21(7).
- Collins, K. (2008). *Game Sound.* MIT Press.
- Conan, S., et al. (2014). An intuitive synthesizer of continuous-interaction sounds: rubbing, scratching, and
  rolling. *Computer Music Journal* 38(4).
- Cook, P. R. (2002). *Real Sound Synthesis for Interactive Applications.* A K Peters.
- Edworthy, J., Loxley, S., & Dennis, I. (1991). Improving auditory warning design: relationship between warning sound
  parameters and perceived urgency. *Human Factors* 33(2).
- EBU R 128 / ITU-R BS.1770-4: loudness (K-weighting; momentary 400 ms, short-term 3 s).
- Farnell, A. (2010). *Designing Sound.* MIT Press.
- Fletcher, N. H., & Rossing, T. D. (1998). *The Physics of Musical Instruments* (2nd ed.). Springer.
- Gaver, W. W. (1993). What in the world do we hear? *Ecological Psychology* 5(1); and Synthesizing auditory icons,
  *INTERCHI '93*.
- Hermann, T., Hunt, A., & Neuhoff, J. G. (eds.) (2011). *The Sonification Handbook.* Logos.
- Jaffe, D., & Smith, J. O. (1983). Extensions of the Karplus-Strong plucked-string algorithm. *CMJ* 7(2).
- Jonasson, M., & Purho, P. (2012). Juice it or lose it. GDC Europe talk.
- Karplus, K., & Strong, A. (1983). Digital synthesis of plucked-string and drum timbres. *CMJ* 7(2).
- Moore, B. C. J. *An Introduction to the Psychology of Hearing* (frequency difference limens).
- Rath, M., & Rocchesso, D. (2005). Continuous sonic feedback from a rolling ball. *IEEE MultiMedia* 12(2).
- Shepard, R. N. (1964). Circularity in judgments of relative pitch. *JASA* 36(12).
- Stevens, R., & Raybould, D. (2011). *The Game Audio Tutorial.* Focal Press.
- Sundberg, J. (1987). *The Science of the Singing Voice.* Northern Illinois University Press.
- Ternström, S. Choir acoustics (pitch scatter and ensemble), KTH papers.
- van den Doel, K., & Pai, D. K. (1998). The sounds of physical shapes. *Presence* 7(4).
- van den Doel, K., Kry, P. G., & Pai, D. K. (2001). FoleyAutomatic: physically-based sound effects for interactive
  simulation and animation. *SIGGRAPH 2001*.
- Zwicker, E., & Fastl, H. *Psychoacoustics: Facts and Models* (sharpness, annoyance).
- Apple Human Interface Guidelines (Playing audio); Material Design (Sound: applying sound to UI).

The references are cited from memory. They were not re-checked online in this time box.

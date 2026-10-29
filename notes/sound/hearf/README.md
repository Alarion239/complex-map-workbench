# Hear the function: four options to choose from by ear

> **Superseded in part (2026-10-28, v16.5).** Hear the function is now the marimba notes and the Glide, decided by
> the user ("i want to hear the function, not actively just make music fit the math"): see README.md's decision of
> 2026-10-28, perfwin/sound/polish/FINAL.md and perfwin/sound/impl/SOUND-PLAN.md. Option 2 (the phase harp), built in v15.2, is superseded by it; option 4 (curves sing) stays.

You said the sound is "not the same" and asked whether each point should sound, or a curve or the function as a
whole. This folder answers with research, four options, and one page where you can hear all of them on the same
gestures: [`options.html`](options.html). Nobody here has listened to it. Everything below is measured or reasoned from
acoustics, so your ear decides.

## What the research found

- **Nobody seems to have sonified phase portraits, arg F or winding numbers before.** Searches turned up only visual
  phase plots, so this is open ground. Mathematical sound comes in three families:
  1. **One value at a point sets a pitch.** Today's tone does this, and so do graphing tools such as
     [Desmos Audio Trace](https://help.desmos.com/hc/en-us/articles/37064105800333-Audio-Trace).
  2. **A curve is played as a waveform.** You hear its shape as one tone.
  3. **An object that sounds only when you touch it.**
- **What listeners dislike** is the description of today's tone:
  - plain sine tones;
  - sound that never stops;
  - pitch that slides between notes instead of landing on them.

  Sound that stays silent until you act is reported as less tiring
  ([The Sonification Handbook](https://sonification.de/handbook/), ch. 7 and 16).
- **2swap** ([swaptube](https://github.com/2swap/swaptube), the engine behind his videos) uses family 2:
  - In the double-pendulum video, each stable orbit is *played*: the two angles become the left and right channels at
    audio rate ([`PendulumScene.cpp`](https://github.com/2swap/swaptube/blob/HEAD/src/Scenes/Physics/PendulumScene.cpp)).
  - A periodic orbit becomes a steady pitched tone; chaos becomes hiss.
  - Viewers heard two orbits in a 1:3 resonance as a musical twelfth without being told. A mathematical fact became an
    interval you can hear.
  - His event sounds are small synths, as in our palette B.
- **So, to your questions.** "Each point" is fine: Desmos and Apple do it too. It works best on a natural instrument,
  on real notes, and only while you move. "A composite of a curve" has strong precedent (2swap). It is what options 3
  and 4 do: they play F around a closed curve as one tone.

More: [`research-literature.md`](research-literature.md), [`research-practice.md`](research-practice.md), and the
design note [`OPTIONS.md`](OPTIONS.md).

## The options, in plain words

| | What you hear | What it teaches |
|---|---|---|
| **Today** (reference) | Nine sine octaves whose pitch follows arg F under the pointer, endlessly climbing round a zero. | Which way arg F turns. Turn bells count the turns. |
| **1 · Sung point** | Today's mapping on a real instrument (cello, choir, glass harmonica or clarinet) over a quiet drone on D. It sounds only while you move. | The same as Today. The drone also lets you hear arg F as an interval: unison means arg F = 0. |
| **2 · Phase harp** | Silence, and a plucked note each time the pointer crosses one of five colour lines: D, E, F♯, A, B. A loop round a zero plays a rising scale; round a pole, a falling one. | The winding number, exactly: count the low Ds (up minus down). It also tells you which way arg F turns, and how fast. |
| **3 · The ring** | A sung D with a whistled overtone. The overtone counts what is inside a small ring round the pointer: F♯ for a zero, A for a double zero, the A below for a pole, D for nothing. The colour of the voice changes as a zero or pole comes near. | The order of a zero or pole, by resting on it. It does not hear arg F or \|F\|. |
| **4 · Curves sing** | A closed curve sings one note: its winding number. While you draw, the note steps when the curve's closing chord passes a zero. In the deformation, the note changes the moment a zero crosses the loop. | The argument principle and homotopy invariance as pitch. By ear you get the sign and small values; the readout gives the number. |

1, 2 and 3 are for the pointer; pick one. 4 is for curves and the deformation, and pairs with 1 or 2. Options 3 and 4
share one singer, so they cannot sound at the same time.

## How to try them

Open `options.html` in **Chrome** (it is one file and needs no network). Use headphones or laptop speakers: phone
speakers drop the low notes. Press **Turn sound on**. Then press these buttons, in order:

1. **Function (z − 1)/(z + 1)** → gesture **Visit a zero, then a pole** → play it on **Today**, then on **1** (choose
   *Choir*), **2** and **3**. This is the fairest first comparison: the pointer glides in, rests beside the zero,
   glides to the pole and rests.
2. **Function z²/(z − 1)** → **Loop: a double zero** → on **1**, **2** and **4**. The answer should be 4 turns: four
   climbs (1), four low Ds (2), or the note D6, W = 4 (4).
3. **Slow sweep** on **1** (*Cello*) against **Today**. Same mapping, new sound: is the "weird" gone?
4. **Deform z → F** on **2** and **4**: a short run as the zero passes the probe (2); the loop's note changing as the
   zero enters it (4).
5. **Function √z** → **Slow sweep** on **Today** and **2**: the branch cut is a quick double tick, not a turn.
6. Optional: draw your own loop on **4**, or move over the picture with 1, 2 or 3. "Listen for" under the buttons
   says what each one should do; the line under the picture shows what is sounding.

After each, ask yourself two things. Would I leave this on for five minutes? Does it make a zero, a pole and a
winding number obvious without looking?

## My recommendation

**Option 2, the phase harp, for the pointer, with option 4 for loops and the deformation.**
- The harp is a natural plucked sound on a pentatonic scale, and it is silent when you stop.
- Its count of low Ds equals the winding number on every loop measured.
- It is one of the cleanest options measured: no clicks, offline or in Chrome.
- Option 4 adds what you asked about, the whole curve heard as one tone.

**Runner-up: option 1 with the choir** (plus 4). It is the smallest change from today, if you prefer a continuous
voice. But if "not the same" was about the endless climbing itself, a new timbre will not cure it.

Option 3 is the boldest and the most mathematical at a point, but its voice is the most synthetic of the four. Judge
it on the Visit gesture.

## What was fixed after the two reviews, and measured

The page was reviewed for sound ([`review-sound.json`](review-sound.json)) and for mathematics
([`review-math.json`](review-math.json)). Every finding was addressed.

- **Option 3 now counts exactly.**
  - Its note is the ring's own winding number, so a zero or pole *outside* the ring no longer sounds like one inside.
  - The singer is a sung vowel (/u/ for 3, /a/ for 4) with vibrato, not a near-sine.
  - Measured: the hum sits 6.8 to 7.8 dB under the note, and the 2 to 5 kHz band 21 to 23 dB under the whole voice
    (`tools/hv_check.js`).
- **Option 4 now plays the winding number as the loudest note** on wide circles too. It used to drift two octaves on
  eᶻ. It also holds still for an instant when a zero touches the curve.
- **The harp** is a darker gut-like string. It now plays on the deformation, and keeps the sign audible beside a zero.
  The glass harp's zero ping is wood.
- **The "Listen for" lines are written from each function's own facts**: the order, the laps, and which way arg H_t
  turns. They were wrong on 3 of 6 functions before.
- **New on the page:**
  - the **Visit** gesture;
  - **√z**, with a branch cut and the app's cut tick;
  - a diagonal eᶻ sweep, so \|F\| grows;
  - a reading key under the picture;
  - an iPhone silent-switch fix (not tested on a device).

All levels are matched: on every function and gesture, the options' gated loudness spread is within 4 dB.

| | Result |
|---|---|
| Offline renders | 281 renders checked with `tools/measure.js` |
| Real-time recordings in headless Chrome | 8, all with 0 underruns and 0 console errors |
| Clicks from options 2, 3 and 4 | none, offline or in real time |
| Clicks from option 1 | none for the choir; the cello's and clarinet's only detector hits are their own bow and reed noise, which the sound review confirmed is not clicks |
| Clicks from Today | a few at −39 dB in real time (it is a faithful port of the app's voice, the reference) |
| CPU | at most 3.4 % of one core on the audio thread (the glass harp) |
| Checks of the fixes | 71, all passing (`tools/verify.js`) |

Details: [`PROTOTYPE.md`](PROTOTYPE.md).

**Not done:**
- Nobody has listened.
- Only Chrome on a Mac was run.
- Phone CPU was not measured.

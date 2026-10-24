# Sound v2: measurements of A (now) and B (the new palette)

A is the app's engine, `notes/v15-candidate/src/sound.js`, unchanged except its storage key. B is the new engine in
`board/engine_b.js`, built from the recipes in `DESIGN.md`. Both are in `board.html`, where you can compare them by ear.
Nothing in `src/` was changed.

**Nobody here has listened to B.** These numbers show what can be measured: loudness, brightness, harshness, how much
each play varies, clicks and CPU. Whether B sounds nicer is for the user to judge on `board.html`.

## How it was measured

- **Offline renders** in headless Chrome at 48 kHz, through the app's own graph (the panner, its tier and the room), at
  100 % volume with no clipper. The harness is `board/measure.js`; the raw results are in `board/out_measure.json`.
- **LUFS-M:** BS.1770 K-weighting, loudest 400 ms. **Short-term:** loudest 3 s.
- **Crest:** peak over the RMS of the active part.
- **Centroid:** power-weighted spectral centroid.
- **Harshness:** the share of energy between 2 and 5 kHz, where the ear is most sensitive.
- **Phone loss:** the drop through a 4th-order high-pass at 550 Hz.
- **Transients per second:** a 2 ms window at least 9 dB above the 20 ms before it.
- **Repeat distance:** two consecutive plays of the same cue, compared in 1/6-octave bands every 10 ms. It is the RMS
  difference in dB with the overall level removed. 0 means the two waveforms are identical. About 1 dB is near the
  limit of hearing a difference; 3 dB or more is plainly a different strike.
- **B level spread:** the loudest minus the quietest of 4 plays.
- **Levels:** B's cues were trimmed against A over 6 and then 8 plays (`TRIM` in `engine_b.js`), so that A and B differ in
  timbre, not in volume.

## 1. The slider ("the cracking")

Each drag goes 0 → 1 → 0, with input events every 1/60 s (±3 ms of jitter). The wiggle is 3 s of ±0.13 around ½.
- **A** follows the app's `sndScrub`, including the 40 ms gap and the guard of 14 cues a second.
- **B** is the air texture plus the five landmark notes.
- **C** is the five notes only.

| Drag | Palette | Cues | Short-term LUFS | LUFS-M | Peak dBFS | Crest dB | Transients/s | Centroid Hz | 2–5 kHz % |
|---|---|---|---|---|---|---|---|---|---|
| slow (4 s) | A | 40 | −37.6 | −33.9 | −14.4 | 20.4 | 5.0 | 1975 | 39.7 |
| | B | 8 | −44.1 | −39.9 | −29.6 | 18.2 | 1.4 | 976 | 4.2 |
| | C | 8 | −47.4 | −40.9 | −30.4 | 14.7 | 1.0 | 881 | 0 |
| medium (1.2 s) | A | 34 | −35.2 | −31.2 | −15.8 | 18.9 | 14.2 | 1938 | 41.2 |
| | B | 8 | −39.2 | −36.6 | −27.4 | 14.3 | 2.1 | 985 | 4.6 |
| | C | 8 | −43.1 | −39.4 | −30.1 | 13.8 | 3.3 | 865 | 0 |
| fast (0.5 s) | A | 18 | −35.2 | −31.1 | −16.2 | 19.0 | 18.0 | 1637 | 29.7 |
| | B | 8 | −36.1 | −32.4 | −23.1 | 14.5 | 4.0 | 990 | 4.2 |
| | C | 8 | −39.3 | −35.2 | −27.4 | 12.2 | 8.0 | 875 | 0 |
| wiggle (3 s) | A | 41 | −35.9 | −34.3 | −15.0 | 19.8 | 13.7 | 2165 | 52.8 |
| | B | 7 | −39.8 | −38.6 | −27.0 | 16.2 | 2.3 | 978 | 4.7 |
| | C | 7 | −44.8 | −42.5 | −30.6 | 13.5 | 2.3 | 880 | 0 |

Compared with A at a medium drag, B is:
- **4 dB quieter** short-term, with **peaks 11.6 dB lower**;
- **7 times fewer transients**: the only ones left are the landmark notes;
- **an octave darker:** the centroid is 985 Hz against 1938 Hz;
- **9 times less energy at 2 to 5 kHz:** 4.6 % against 41 %.

In a wiggle, A spends 53 % of its energy at 2 to 5 kHz. That band is where crackle and harshness live.

**One fix during this round:** the "felt bump" at the ends of the slider (DESIGN §3) was removed. The app snaps t to 0
or 1 within 0.03, which jumps t by up to 0.03 in a single frame. That jump counted as a fast arrival, so the bump fired
on almost every arrival and added a low thump. With the bump, B's slow drag measured −32.7 LUFS-M, louder than A.

## 2. Playing the Deformation (2 s)

- **A:** the swell and the arrival.
- **B:** the swell, the motion bed on the first pass (the air texture driven by the playback) and the arrival.

| | Short-term LUFS | LUFS-M | Peak dBFS | Centroid Hz | 2–5 kHz % |
|---|---|---|---|---|---|
| A | −37.3 | −31.2 | −21.0 | 999 | 1.3 |
| B | −36.8 | −31.3 | −20.8 | 999 | 2.0 |
| B, motion bed alone | −45.8 | −43.5 | −34.0 | 1074 | 7.8 |

The motion bed sits 9 dB below the cues. It rises in pitch with t (380 Hz to 1.75 kHz), fades out over 0.4 s at the
arrival, and is silent on loop repeats.

## 3. Every cue

| Cue | LUFS-M A / B | Peak dBFS A / B | Crest dB A / B | Centroid Hz A / B | 2–5 kHz % A / B | Phone loss dB A / B | Repeat distance dB A / B | B level spread dB |
|---|---|---|---|---|---|---|---|---|
| Toggle on | −32.9 / −32.9 | −15.7 / −19.3 | 12.8 / 12.8 | 894 / 882 | 0.1 / 0 | 0.1 / 0.1 | 0 / 3.1 | 1.9 |
| Toggle off | −33.8 / −33.8 | −15.4 / −18.3 | 13.6 / 12.9 | 669 / 661 | 0 / 0 | 0.9 / 0.9 | 0 / 1.3 | 1.9 |
| Add a step | −31.5 / −31.5 | −17.1 / −19.3 | 12.1 / 12.9 | 758 / 776 | 0.1 / 0 | 0.8 / 0.6 | 0 / 5.9 | 1.6 |
| Remove a step | −32.2 / −32.3 | −17.1 / −19.1 | 13.3 / 12.1 | 775 / 804 | 0.1 / 0 | 0.7 / 0.5 | 0 / 6.5 | 1.8 |
| Switch view | −33.0 / −32.2 | −14.1 / −17.3 | 14.2 / 14.0 | 760 / 789 | 0.4 / 0.6 | 0.4 / 0.4 | 2.8 / 3.6 | 1.4 |
| Export ready | −29.0 / −28.6 | −14.4 / −18.3 | 15.1 / 14.3 | 1101 / 1101 | 6.8 / 2.5 | 0.1 / 0.1 | 3.8 / 4.3 | 1.2 |
| Error | −30.1 / −30.0 | −12.4 / −12.8 | 14.7 / 14.2 | 524 / 464 | 0.2 / 0.2 | 3.3 / 4.5 | 3.2 / 11.0 | 1.2 |
| Edge | −38.4 / −38.7 | −19.4 / −18.6 | 12.7 / 15.1 | 909 / 662 | 1.4 / 0.3 | 0.1 / 2.0 | 2.5 / 2.4 | 1.6 |
| Snap (off by default) | −41.9 / −42.2 | −20.5 / −22.6 | 13.5 / 13.0 | 2383 / 2156 | 68 / 96 | 0 / 0 | 4.8 / 5.2 | 3.6 |
| Deformation plays | −32.0 / −31.6 | −21.7 / −24.0 | 13.1 / 13.0 | 697 / 862 | 0.1 / 2.0 | 1.2 / 1.1 | 0 / 5.0 | 3.2 |
| Deformation arrives | −31.2 / −31.6 | −21.0 / −21.0 | 15.2 / 15.1 | 1343 / 1101 | 2.8 / 0.3 | 0 / 0.6 | 0 / 4.1 | 1.4 |
| Loop closed, W = 2 | −31.3 / −31.4 | −20.2 / −22.5 | 14.3 / 12.6 | 1282 / 1227 | 2.7 / 0.3 | 0 / 0 | 0 / 2.0 | 1.4 |
| Loop closed, W = 0 | −37.6 / −37.7 | −20.1 / −19.6 | 16.3 / 16.8 | 902 / 886 | 1.1 / 0.3 | 0.1 / 0.1 | 2.6 / 2.1 | 2.0 |
| Zero, order 2 | −29.4 / −29.4 | −18.9 / −20.8 | 14.0 / 12.4 | 1240 / 1181 | 2.9 / 0.4 | 0 / 0 | 0 / 3.0 | 2.6 |
| Pole | −30.0 / −30.0 | −10.1 / −12.7 | 17.4 / 15.7 | 522 / 456 | 0.3 / 0.1 | 4.0 / **7.2** | 2.3 / 2.7 | 1.7 |
| Many zeros | −42.0 / −42.1 | −31.5 / −30.9 | 12.9 / 13.1 | 1382 / 1323 | 2.6 / 0.3 | 0 / 0 | 0 / 4.4 | 0.9 |
| Branch cut | −39.5 / −36.5 | −20.5 / −20.2 | 15.1 / 15.7 | 2583 / 1705 | 56 / 18 | 0 / 0 | 4.7 / 2.6 | 0.5 |
| One full turn | −29.3 / −29.2 | −20.5 / −22.3 | 14.2 / 12.6 | 2416 / 2334 | 94 / 97 | 0 / 0 | 0 / 2.6 | 1.0 |
| Many turns | −38.3 / −38.5 | −29.8 / −29.9 | 12.4 / 12.5 | 1625 / 1555 | 4.1 / 2.4 | 0 / 0 | 0 / 3.1 | 1.0 |
| Contour | −39.4 / −39.4 | −18.0 / −22.5 | 16.8 / 12.6 | 1434 / 1176 | 18.3 / 0 | 0 / 0 | 2.5 / 2.5 | 1.9 |
| Preimages collide | −32.1 / −32.1 | −19.0 / −22.9 | 14.7 / 12.0 | 885 / 857 | 0 / 0 | 0.1 / 0.1 | 0 / 4.2 | 3.3 |

**What the table shows:**
- **Loudness.** 20 of the 21 rows match within 0.8 dB. The branch cut is the exception (B is 3 dB louder in this run);
  part of that is A's own noise-burst cue, which measured −37.1 to −39.5 from play to play.
- **Repetition.** 12 of A's 21 cues repeat exactly (distance 0); the rest are noise bursts with a fixed spectrum. Every
  B cue changes between plays, by 1.3 to 11 dB of spectro-temporal distance.
  - **Most varied:** the error, whose second knock moves by ±5 ms, and the two-note keys.
  - **Least varied:** the toggles (1.3 to 3.1 dB), because their pitch is fixed and only the strike changes.
- **Level spread.** B's plays vary by 0.5 to 3.6 dB from loudest to quietest. A first version varied up to 6.3 dB, which
  is more than a real instrument does, so the variation was narrowed to: velocity ×0.92 to 1.08, level ±1 dB, upper
  modes ±1.5 dB.
- **Peaks.** B's peaks are 2 to 4.5 dB lower at the same loudness, for 12 of the 21 cues. A raised-cosine strike has a
  softer onset than A's 2 to 3 ms linear attack.
- **Harshness.** B has less energy at 2 to 5 kHz wherever A had some: export, arrival, the pings, the branch cut,
  contour. The turn bell sits at 1.7 to 3.4 kHz by design, so both palettes put 94 to 97 % of its energy there. That is
  the bell's pitch, not noise.
- **Phone loss.** B now loses 2.0 dB on the edge (4.8 in the first B run), after a louder A5 block tick. The pole still loses 7.2 dB
  against A's 4.0, even with an added wooden A5 partial: the felt thump is mostly below 550 Hz. This is still open.

## 4. Hear the function: the Shepard voice

Both palettes use the app's own `ShepardVoice` protocol, so the chroma plan is identical; only the sample loop in the
worklet differs. "Resting" is one set, then the app's 1.6 s stillness fade. "Loop" is a double zero (2 turns over 4 s),
updated every 1/60 s.

| | LUFS-M | Pitch class read back, mean / max error | Winding read back | Slow level change | Phone loss |
|---|---|---|---|---|---|
| A resting | −32.8 | 0.2 / 0.2 cents | | 0.15 dB | 1.6 dB |
| B resting | −33.0 | 2.4 / 4.7 cents | | 1.6 dB | 1.4 dB |
| A loop | −32.7 | | +2.000 turns | 0.14 dB | 1.8 dB |
| B loop | −32.7 | | +1.998 turns | 3.5 dB | 1.9 dB |

- **Matched in loudness.** B is at −32.7 to −33.0 LUFS-M, against −32.7 to −32.8 for A.
- **Pitch.** B reads back within 5 cents, below the 5 to 10 cents a listener can resolve on short tones.
- **Winding.** A loop around a double zero still reads 2 turns (+1.998).
- **It moves.** B's level changes slowly by 1.6 to 3.5 dB, from the three detuned voices beating and drifting; A's stays
  within 0.15 dB.
- **The vibrato** builds while the pointer rests (time constant 0.7 s), so it is mostly there by the time the app fades
  the tone at 1.6 s.

## 5. Clicks

Both of cdp3's detectors were run (`notes/sound/cdp3/det.py`, through `board/clicks.py`):
- **Detector A:** impulses at 9 to 11 kHz.
- **Detector B:** the residual of a linear prediction.

A hit within 3 ms before to 40 ms after the start of a cue's part is that part's designed attack. The live runs were
recorded in real time in headless Chrome, with a sample-exact AudioWorklet tap after the clipper (`board/rec_inj.js`).
The drivers (`board/drive.js`) were:
- a stop-and-go slider drag with flicks, every 8 to 24 ms, for 8 s;
- the pointer on the rational map: orbits of the double zero, passes grazing both poles, a rest, then a loop drawn
  twice around −1;
- the interface: play, toggles, steps, views, an error, an export, and six quick toggles.

| Recording | Detector A: attacks / elsewhere | Detector B: attacks / gradual / elsewhere | Automation behind the clock | Late B messages |
|---|---|---|---|---|
| A slider (live) | 90 / 0 | 324 / 0 / 0 | 0 | |
| B slider (live) | 2 / 0 | 3 / 0 / 14 | 0 | 0 of 24 |
| A pointer (live) | 18 / 0 | 74 / 2 / 3 | 0 | |
| B pointer (live) | 18 / 0 | 42 / 2 / 0 | 0 | 0 of 9 |
| A interface (live) | 26 / 0 | 112 / 0 / 8 | 0 | |
| B interface (live) | 26 / 0 | 128 / 0 / 1 | 0 | 0 of 20 |
| A slider, wiggle (offline, no onset log) | 41, all at detent onsets | 166 | | |
| B slider, wiggle (offline, no onset log) | 0 | 10 (landmark notes and texture swells) | | |
| A voice, loop (offline) | 0 | 0 | | |
| B choir, loop (offline) | 0 | 0 | | |

- **Detector A, outside an attack: 0 hits in every live recording.**
- **The detents are the crackle.** Every one of A's slider detents fires the 9 to 11 kHz impulse detector: 90 in 9 s
  live, 41 in a 3 s wiggle. Those hits are A's designed attacks, so they are not engine faults, but by the detector's own
  criteria each detent is an impulse. B's slider fires it 0 to 2 times, and only on the landmark notes.
- **What detector B flags "elsewhere" are smooth swells, not steps.** It cannot predict noise, so it flags noise fading
  in:
  - B's slider: the air texture rising from digital silence when a drag resumes, about −88 → −47 dB over 25 ms, with no
    sample step. Its gain now starts with zero slope, through two cascaded smoothers like the app's voice gate.
  - B's interface: the swish of the export rising over 110 ms.
  - A's interface: its own Deformation swell.
- **No AudioParam automation behind the clock**, in either palette. B schedules no automation at all; it posts
  messages, and none of the 53 cues arrived late at the worklet.

## 6. CPU

Measured with `node board/bench_node.js`: the worklets' `process()` in node (the same V8), in µs per 128-frame quantum
(2667 µs of real time at 48 kHz). The machine was shared with other test browsers, so these are upper bounds.

| Voice | µs per quantum | % of one core |
|---|---|---|
| A: the Shepard voice, moving | 9.9 | 0.37 |
| B: the glass choir, moving | 26.1 | 0.98 |
| B: the glass choir, resting (vibrato) | 25.0 | 0.94 |
| B: the synth node, idle | 0.2 | 0.01 |
| B: the slider texture, while dragging | 2.4 | 0.09 |
| B: one glass strike (8 modes and contact) | 3.5 | 0.13 |
| B: 8 overlapping glass pings (a loop of W = 8) | 18.9 | 0.71 |

- **The choir costs 2.6 times today's voice:** 27 phase accumulators instead of 9. That is still under 1 % of a core.
- **Busiest moment:** with the choir sounding and a W = 8 flourish, B uses about 1.7 % of one core.
- **Each cue part is a few µs per quantum.** Every cue part starts at exactly 0 and ends at exactly 0: a node check of
  all 23 cues found the first sample 0, the last nonzero sample below 1.1·10⁻⁹, and no NaN.

## 7. Open

- **Taste.** Whether kalimba keys, glass pings and a breathing slider are nicer to live with is for the user's ears, on
  `board.html`.
- **The pole on a phone** loses 7.2 dB (target 4 to 5). It needs a stronger felt contact above 550 Hz.
- **The branch cut** is 1 to 3 dB louder in B than A's average; trim it by about −2 dB.
- **Not done:** the Height voice with the ensemble (DESIGN §5.2), and the repetition rule's effect on long sessions. The
  board does apply −1 dB per repeat within 2 s.
- **Tested only in Chrome**, rendered in headless Chrome and with the output muted. Not tested in Safari, Firefox or on a
  phone.

## Re-running

From `notes/sound/v2/board/`:
1. `python3 build.py` builds `../board.html`.
2. `node bench_node.js` gives the CPU numbers and checks that every cue starts and ends at exactly 0.
3. Copy `test/cdp_kit` as `board_cdp`: port 9053, plus `--mute-audio`. Serve the project root with
   `python3 -m http.server 9053 --bind 127.0.0.1` and start `node board_cdp/cdpd.js`.
4. `./board_cdp/q.sh cmd/full.js` writes `out_measure.json`. `./board_cdp/q.sh cmd/live.js` records into `rec/`.
5. `python3 clicks.py rec/*.f32` runs the detectors. The raw recordings (32 MB) were deleted after the run. The detector
   output is in `out_clicks_live.txt` and `out_clicks_off.txt`.

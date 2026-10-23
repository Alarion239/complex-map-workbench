# Sound follows the function under a still probe (2026-10-23)

The user: "During deformation, sounds must also follow the deformation. Now they only change during deformation if I
move my mouse."

Built in `work/xvs` (a copy of v14 = `work/v15-base`). Edits: `src/sound.js` (two pure helpers, one optional
argument), the sound block of `src/app.js`, five one-line hooks, and one test-hook line.

## The behaviour

- The Deformation plays or is scrubbed, and the pointer (or the keyboard probe) rests on a plane. The tone follows H_t
  at that point every frame. arg H_t sets the pitch, |H_t| the loudness and register, as for pointer motion.
- The step from one frame to the next is a path in (z, t). It is tracked exactly, like a pointer segment
  (`Sound.pathStep` runs `Calc.argStep` on the path's parameter). So the pitch never runs backwards, and the cues work
  in t:
  - a zero or pole of H_t sweeping across the probe pings once, with its order (the 8 px rule of DESIGN §2.4);
  - a branch cut of H_t sweeping across the probe ticks;
  - each full turn of arg H_t rings a bell ("the run", below);
  - in the Landscape, each contour of |H_t| crossed ticks once.
- If the pointer moves while t runs, the step is a path in z and t at once. One path, one count: nothing is counted
  twice, whichever of the pointer event and the frame comes first.
- **The run.** The bells count turns from the moment the function under the probe starts to change. The run ends 1.6 s
  after the function stops changing, or at a new start. Over one play at a still point, the bells are the turns of
  t → H_t(z). A run counts silently while a Lasso is being drawn: the loop's own bells ring then.
- **Swaps.** Some changes have no path between the two functions: the transport opens (F → H_0) or closes (H_t → F),
  the loop repeats (t goes from the end back to 0), the focus or "all steps at once" changes. Then the voice glides to
  the nearest turn (the Shepard voice's own rule; 0.15 s on the Height scale). No cue fires, no contour ticks, and a new
  run begins.
- **The transport's own cues are kept.** The swell plays once per play the user starts, the arrival once per play,
  never on loop repeats. The scrub detents play as before. They are Mathematical events; the probe's cues are the
  pointer tier. Each kind has its own rate limits and the shared storm guard. The voice ducks 6 dB under every cue, as
  before.
- **Guards, unchanged.** The zero/pole gap (250 ms) and the cluster guard ("dense"), the bell queue (≤ 8 a second,
  then one flourish), the contour queue, no pointer cue during a view gesture and 250 ms after. The old rule "no pointer
  cue while the deformation plays" is gone: the tracker now follows t exactly, so the cues are right.
- **The tone fades** 1.6 s after the last change, of the probe or of the function (280 ms for the keyboard probe).
- **When the probe is not resting,** nothing follows: after the pointer leaves the plane, after a mouse or pen press
  (a drag or a pan), while the view under the probe has moved (a pan or zoom; the X → Y panes merging into one plane),
  during "Listen along", and while a Lasso is drawn.

## What the probe means on each plane

- **X's Phase plane and X's globe:** the point z under the pointer. The tone is H_t(z), the function the plane paints.
- **The Landscape:** the needle's point z of X. The relief moves as t runs, but the needle stays at its z (as the
  needle and the readout do), and the tone follows |H_t(z)|. A camera refit (opening the deformation refits the relief)
  does not move the needle.
- **The merged deformation plane of X → Y (and its globe):** the decision.
  - The point p under the pointer is read as a point of X, where the paths t → H_t(z) start (X's outline is drawn
    there in grey). The tone is H_t(p), the head of the path that starts under the pointer. It is the same tone the
    Phase view gives at p.
  - So a zero of H_t "passing p" means the image of p crosses 0, and the bells count how the image of p winds about 0.
  - Rejected: the w under the pointer. arg w does not change with t, so the tone would never move.
  - Rejected: the point of X whose image sits under the pointer. That needs the preimages of w under H_t every frame.
    There are several, they collide at critical values, and finding them costs far more than one frame allows.
  - On a focused d/dz step the merged plane is not X's plane (its start points are G_{k−1}(z)): the probe is silent
    there.

## The hook for v15

```js
soundFunctionChanged();      // the function changed in a way the probe cannot follow along a path
soundFunctionChanged('t');   // only the transport's t moved
```

- It re-evaluates the tone at the resting probe on the next animation frame, once a frame however often it is called.
  With sound or Hear F off it returns at once. With no resting probe it does nothing.
- **Call it from v15's Params change event** (a shared number's slider, its Play). No argument: v15's parameters may
  not be in `chainSig`, and the call itself marks the change (`snd.fcGen`).
- Calls in this build: `frame()` while the deformation plays (`'t'`), the morph slider (through `sndScrub`, `'t'`),
  `chainChanged()` (a zero dragged, a step's parameter edited), `openTransport()` and `closeTransport()`.
- **A change without a path** (no argument) is followed by the nearest turn. That is exact while arg F moves less than
  half a turn a frame, which holds for a dragged zero or a slider. Cut ticks need a path, so a change without one gives
  none. Zero and pole pings and contour ticks work as usual.
- **`sndFAt(T)`** is the one place that knows how the transport builds H at a time T. It sets `morph.T` for one call
  of the app's own `homView()`. If v15 changes how H_t is built, change only this function.
- The R-pane hover line (`if (solo() === 'R' && morphOn()) sndMove(x, y, w, 'merged');`) is the merged plane's hook.

## Tests and results

- **`node test/t_sound.js`: 74/76.** The 2 failures are not from this change. This v14 copy of `sound.js` lacks the
  main tree's `q.due` gate fix, and the copied test checks it (12 turns give 9 bells, not 8). It fails the same way on
  the untouched queue code. New checks (all pass): e^(2πi·3t)z at 60 and 240 Hz (+3 turns, 3 bells); z^(1+4t) at 170°
  (the pitch equals arg H_t at every frame; 1.889 turns, 1 bell); two steps in a row (the count equals the winding of
  t → H_t(z) by fine sampling; 2 bells up, 1 down); a double zero of H_t passing (one ping of order 2, exact arg
  through it); a cut of H_t sweeping across (one jump); one (z, t) path split between pointer events and frames
  (the same total: no double count); the bell rule.
- **`test/sound_deform_cmd.js`** (also section 16 of `test/sound_cmd.js`): pass. The cases:
  - X's Phase plane, z⁵, the pointer still: a voice update in every frame t moved (95 of 95), the run 1.8889 turns,
    one bell, no zero, pole or cut; the swell and the arrival once each. With Loop on and the pointer jiggling: no cut
    at the repeat, no arrival repeated.
  - z − 1: the zero of H_t passes the still pointer: one ping, "Zero of order 1 here."; the run +0.4989 turns.
  - Scrubbing with the keyboard while the pointer rests: H_t at the probe follows every step (40 of 40); the detents
    play; one zero ping on the way back.
  - The merged plane of X → Y: the probe is the plane's point; the same 1.889 turns and one bell as on X. Closing the
    deformation (the plane goes away): no tone.
  - The Landscape: the Height voice follows every frame; one contour tick per level crossed (10 of 10).
  - A zero moved once a frame while the pointer rests elsewhere: F at the probe changes every frame; once round the
    probe: +1 turn, one bell; straight through it: one ping of order 1. After the pointer leaves: no tone.
  - Sound off: no evaluation at all.
- **`test/sound_cmd.js`** (all 16 sections): pass, 0 failures in the final run. In an earlier run its live queue
  check failed once (9 bells for 12 turns): the same pre-existing gap, which shows only when the audio clock moves a
  render quantum during the burst.
- **Clicks** (`test/sound_deform_clicks_cmd.js`; the voice alone, every cue off): 8 cases (the play on X, a loop
  repeat, the pointer moving during a play, the merged plane, the Landscape, a zero of H_t passing, scrubbing once a
  frame, a zero dragged once a frame) × 60 and 240 Hz frames × CPU 1× and 6×: 32 recordings, 90.5 s, made with the final build.
  - `test/sound_clicks.py`: **0 clicks** in 32 files.
  - `notes/sound/cdp3/det.py`: **detector A 0** (so 0 snaps by the rule of DESIGN §7.6); no automation call behind the
    clock; no recording gaps. Detector B (far more sensitive) finds small residuals at fast pitch moves, worst −38.0 dB
    re the local RMS (the Landscape at the moment the transport opens, 240 Hz, 6×: −38.0 dB), and −45 to −49 dB with the
    pointer moving during a play. The verified build of §7.6 had B up to −31 dB.
  - The first recording run showed B at +3.7 dB in the Landscape when the transport opened: the voice restarted with
    an 8 ms glide, about an octave down (F → H_0). That is why a swap now glides (0.15 s on the Height scale).
  - The 240 Hz frames come from `test/sound_deform_inj.js` (`?raf=240`: the app's requestAnimationFrame at 240 Hz).
- **Frames while playing** (`test/sound_deform_fps_cmd.js`, the pointer still on X's Phase plane, 4 s):

  | Chain, CPU | Hear F | fps | interval p95 | main-thread work p95 / max | sound a frame p95 / max |
  |---|---|---|---|---|---|
  | z⁵, 1× | off / on | 60 / 60 | 17.6 / 17.6 ms | 0.6 / 3.4, 0.4 / 3.0 ms | 0.1 / 0.1 ms |
  | z⁵, 6× | off / on | 60 / 60.1 | 20.3 / 20.0 ms | 2.8 / 9.2, 2.9 / 6.5 ms | 0.4 / 1.1 ms |
  | heavy, 1× | off / on | 39.8 / 57.7 | 21.5 / 17.6 ms | 0.8 / 6.9, 0.5 / 2.4 ms | 0.1 / 0.1 ms |
  | heavy, 6× | off / on | 58.3 / 60 | 19.3 / 21.2 ms | 3.1 / 7.1, 4.9 / 20.2 ms | 0.1 / 0.6 ms |

  "heavy" is the erf, tan and log chain of `sound_cmd.js`. Its first play (Hear F off, measured first) had a one-off
  1.07 s stall, which is the app's first play of that chain, not sound. The sound's own work is at most 1.1 ms a frame
  (the 3 ms deadline per evaluation is kept). Over budget, the voice holds and no cue fires, as before.

## Not done, or not verified

- Not heard: I cannot listen. Whether the bells during a play are too many for some chains is a listening question.
- Not built: the focus and "all steps at once" switches call no hook. While the transport plays, `frame()` covers them.
  When paused, the tone waits for the next move.
- A dragged zero whose arg at the probe moves more than half a turn in one frame may miscount a bell (no path joins
  the two functions). A slow drag or a slider is exact.
- Not verified: Safari, Firefox, iOS; the native-node fallback (all recordings used the AudioWorklet).

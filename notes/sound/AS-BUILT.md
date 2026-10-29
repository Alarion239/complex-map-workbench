# Sound: as built (both stages)

> **Superseded in part (2026-10-28, v16.5).** Hear the function is now the marimba notes and the Glide, decided by
> the user ("i want to hear the function, not actively just make music fit the math"): see README.md's decision of
> 2026-10-28, perfwin/sound/polish/FINAL.md and perfwin/sound/impl/SOUND-PLAN.md. The sonification described here (the tone, later the harp) is retired; the engine, tiers and catalog stay.

Built in `work/xs` from the verified prototype (`prototype.html`, revision 3) and `DESIGN.md` §2, §4 and §7.
Not merged into the main tree. The merge base is `notes/gate-morph-zp-r1/src`.

## Summary

- Sound is in the app, off by default. With sound off, nothing is created and no per-event work runs.
- Stage 1: the header control, the popover, Shift+M, Esc, the palette entries, Interface cues, Mathematical-event cues.
- Stage 2: Hear the function under the pointer (the Shepard voice, exact winding by ear, zero and pole orders, cut
  ticks, turn bells), Height contours in the Landscape, Listen along a curve, the keyboard probe.
- All tests pass: node tests, the new CDP regression, the click regression from the app, mv_views, the quality suite.
  The paired perf run shows no cost from sound (details below).

## Files

| File | What |
|---|---|
| `src/sound.js` (new, 63 KB, 21 KB gzipped) | The engine of `prototype.html` revision 3, as it is. One global `Sound`. |
| `build.py` | `sound.js` added before `app.js`. |
| `src/calc.js` | `Calc.argStep(F, z0, g0, z1, g1, {budget})` and `Calc.orderAt(F, c, r, {budget, n})`, after `turn()`. |
| `src/page.html` | The split button, the phone speaker, the popover, a live region, CSS (one block after `#helpBtn`, one rule in the phone query). |
| `src/app.js` | One self-contained block (`// ---------------- sound`, about 450 lines, 28 KB, before the init code) and about 30 one-line hooks. |
| `test/t_sound.js` (new) | Node: argStep, orderAt, winding counts, the engine's scheduler and guards against a mock AudioContext. 62 checks. |
| `test/sound_cmd.js` (new) | CDP regression, about 90 checks (list below). |
| `test/sound_lab.js` (new) | The prototype's lab (LUFS-M, phone model, envelopes), evaluated in the app page by `sound_cmd.js`. |
| `test/sound_clicks_cmd.js`, `test/sound_rec.js`, `test/sound_clicks.py` (new) | The click regression recorded from the app; the recorder; the detector. |

Changes to the engine (both small, both commented in `sound.js`):

- The storage key follows `lsk('cmw-sound')`: `cmw-sound`, or `cmw-sound:<ns>` on a `?ns=` page.
- The turn-bell queue: "beyond the cap" counts the queued cues that have not sounded yet (slot + LEAD), and one
  flourish per backlog. The prototype let a 9th bell through and added a flourish per coalesced turn. Now 12 turns give
  8 bells and 1 flourish, as DESIGN §2.4 says.
  - v14 gate fix (round 1): the first app build tested `at − now ≥ cap · gap`. The audio clock moves by whole render
    quanta (5.33 ms at 48 kHz) even inside one burst of calls, so the first bell counted as played before it sounded,
    and 12 turns gave 9 bells in 2 of 5 bursts. `queued()` now keeps `q.due` (when each queued cue sounds, the
    flourish too) and coalesces when `cap` of them are still due. `t_sound.js` has the case (the clock moves 1 or 2
    quanta after the 3rd call); the old engine fails it.
- The test-only `embedtest` hook of the prototype is not in `sound.js`.

## What the user gets

- **Header:** a split button labelled **Sound**, between Theme and Guide. The icon and `aria-pressed` show the state.
  Title "Sound (Shift+M)". The caret opens the popover.
- **Popover:** the Sound switch, Volume (plays the key on release), the three tiers with one line each (Snap ticks
  indented under Interface), the "Sound is off" line, the iPhone note (iOS only), a line on the keys, "Saved on this
  device only", and the engine status. Esc closes it.
- **Widths:**
  - 1340 px and up: speaker, "Sound", caret.
  - 768 to 1339 px: speaker and caret (the label drops, as the view switch and Deformation labels do below 1280).
  - 768 to 1023 px: the command field narrows to 112 px and drops its ⌘K hint. The wordmark also hides from 900 to
    1023 px. Without this the bar overflowed. Note: the base already overflowed by 44 px at 900 px; that is fixed too.
  - Phones: while sound is on, the speaker sits in the bar (one tap silences). The More menu has "Sound" (while off)
    and "Sound settings". The popover spans the width.
  - Checked with no horizontal overflow at 360, 390, 430, 600, 767, 768, 820, 899, 900, 1023, 1024, 1100, 1279, 1280,
    1339, 1340, 1366 and 1440 px.
- **Keys:** Shift+M toggles sound (after the dispatcher's guards). M is still the Deformation and does not fire on
  Shift+M. Esc stops anything playing and keeps the setting.
- **Palette:** "Sound on/off" (⇧M), "Hear the function on/off" (also turns sound on), "Stop sound" (Esc).
- **Guide:** a short "Sound" section and a ⇧M row in the keys table.
- **Settings:** only in `lsk('cmw-sound')` = `{on, vol, ui, snap, events, sonify}`. Never in `S`, saved work, shared
  links or exports. First on: Interface on, Snap ticks off, Events on, Hear F off.

## The hooks (for the merge)

All hooks return at once when sound is off (`sndP.on` false).

| Cue | Where (function) |
|---|---|
| toggleOn / toggleOff | `setPanels()`, `snapBtn` and `railSnap` clicks, `setMorphPaths()`, the Loop checkbox, a step's eye, the theme button, the popover's checkboxes |
| stepAdd / stepRemove | `addStep()`, `removeStep()` |
| view | `setMain()` |
| exportDone | **one helper, `sndExportDone()`**, called from `saveFile()` success (both paths), the figure save success, and "Copy LaTeX with guarantees". The export dialog is being rebuilt: re-attach `sndExportDone()` to its save and copy successes. |
| error | `sndError()` before the failure toasts: ZP_MAX, "cannot be rewritten", the two derivative failures, "Saving files is not available", save failure, figure failure |
| snap | `onUp()`: a drawn point or a dragged handle settles with Snap on |
| morphStart / morphEnd | `openTransport()`, `toggleTransport()` when a play starts; the arrival in the play loop once per play; `closeTransport()` disarms |
| morphTick | the morph slider's `oninput` (`sndScrub` → `Sound.scrub(u0, u1)`, v15.1: the engine picks detents or the band from the drag's speed; "Scrub" below) |
| pointer tier | `onMove()` hover paths (plane, globe, landscape, lasso drawing) call `sndMove()`; `pointerleave` and the touch probe's end call `sndHoverOff()`. Since 2026-10-23 also the merged deformation plane's hover (`sndMove(…, 'merged')`) |
| the function under a still probe (2026-10-23, `DEFORMATION.md`) | **one hook, `soundFunctionChanged()`**, once a frame at most: `frame()` while the deformation plays and the morph slider via `sndScrub` (`'t'`), `chainChanged()`, `openTransport()`, `closeTransport()`. v15: call it from the Params change event |
| collide | `hoverReadout()` (`sndCollide()`) |
| loops | `onUp()` for a finished Lasso (`sndLoopDone()`) |
| Listen along | `openIntegralMenu()` gets "Listen along …" for curves |
| Esc, Shift+M, init | the document keydown dispatcher; `sndInit()` in the init code |
| test hook | `window.__cmwSound()` inside the TEMP-DEBUG-HOOK block (stripped from the published build) |

## Behaviour details

- **No consent, no audio.** No AudioContext exists until the user turns sound on. A remembered "on" waits for the
  first click or key of each page load.
- **The pointer tier** (Hear F on):
  - arg F is tracked exactly along each pointer segment (`Calc.argStep`), so the pitch never runs backwards. A loop
    around the zero of z² − 1 twice reads exactly +2 turns.
  - A budget of about 3 ms of F calls per event, from the measured cost of a call. Over budget, the voice holds and no
    cue fires.
  - A zero or pole within 8 px: `Calc.orderAt` on a 16-gon (exact for any order; a branch point gives none). Tested
    only where |F′/F| > 1/(8 px).
  - A cut: the tracker cannot converge while F stays finite and non-zero.
  - Guards: no pointer cue during a pan, zoom, orbit or pinch and 250 ms after (the view key changes), or during a
    playback. (Until 2026-10-23 also while the Deformation played; now the tracker follows t exactly, see below.)
  - The tone fades after 1.6 s of stillness, is released after 6 s, and a keyboard step sounds 280 ms.
- **Height (the Landscape):** the Height voice on the pentatonic staircase; one queued tick per contour crossed.
- **Loops (the Lasso):** bells while drawing; on release the winding number (`Calc.argPrinciple`). The first loop of a
  page plays itself back (not under reduced motion); later loops sound |W| pings. The live region says
  "Winding number W: …" and, when it plays, "Listening along the loop: … Esc stops." in one message.
- **Listen along:** from the curve's right-click menu, L, or the first loop. A pointer move of more than 4 px from
  where the pointer was when it started ends it.
- **Keyboard probe:** while sound is on, the X plane is focusable (Tab). It answers keys only when it got the focus
  from the keyboard: after a mouse click in the plane, V, L, D, O and Z stay the tool and fit shortcuts. Arrows (0.1;
  0.02 with Shift; 0.25 on wide views), Z / Shift+Z (next or previous zero or pole, with its order), O (order here),
  D (describe the view), Enter (start and close a loop), L (listen), Esc. A visible focus ring shows on keyboard focus.

## Tests and results

- **Node** (`node test/t_*.js`): all pass, except 2 checks in `t_tour.js`. Those two say `INTEGRATION.md` documents
  the anchors `phaseKey` and `soundBtn` that `tour.js` in this copy does not define. That is the tour work in parallel
  (`notes/tour/INTEGRATION.md`), not this change. `t_sound.js`: 62/62.
- **`test/sound_cmd.js`: pass** (0 failures). It checks:
  - off: hover, drag and click create no AudioContext, run no tracker call and make no cue; no tabindex on the plane;
  - the button: label, title, order between Theme and Guide; on → running, one context, the "on" key;
  - the settings key, and nothing in the saved work;
  - default tiers: hovering zeros makes no cue and no voice; crossing √z's cut 40 times makes no cue;
  - Shift+M off (silent, suspended, not the Deformation) and on; M opens the Deformation: one swell, one arrival, none
    on loop repeats;
  - the three palette entries; the view, theme and export-copied cues;
  - the popover: caret, focus, Hear F switch, Esc;
  - Hear F: +2.000000 turns around a zero twice; one ping and "Zero of order 1 here."; no pointer cue during a pan and
    the 250 ms after (the check "no pointer cue while the Deformation plays" was replaced on 2026-10-23 by section
    16, below);
  - loops: 2 bells while drawing, W = 2, plays itself; Esc stops at once (0 active sources), sound stays on; loop 2:
    W = 1, the loop-closed cue, no playback; "Listen along …" from the curve menu, ended by a move;
  - the keyboard probe (all keys), and L as the Line tool again after a mouse click;
  - the Landscape: the Height voice and contour ticks;
  - live engine guards: 12 turns → 8 bells and 1 flourish, an Interface cue still plays; 20 zero entries → 1 ping and
    the dense cue; a suspended context whose resume never resolves: 24 requests, none scheduled; off while sources
    sound: no off sound, 0 sources after 150 ms, suspended;
  - a reload with "on" remembered: a hover creates no context; the first click starts it;
  - loudness: every cue's LUFS-M in its group's range, phone loss ≤ 5 dB, peak < −6 dBFS, soft onset, last sample 0,
    HF ≤ −40 dB. The numbers match DESIGN §2.2 to 0.1 dB. Shepard −32.85 LUFS at |F| = 1 (range 4.95, phone 7.13);
    Height −32.52 on D5 (phone range 5.28); bell −29.7 alone, +17.15 dB over the voice;
  - phones at 360 and 390 px: the speaker in the bar only while on, the More-menu rows, the popover fits, no overflow;
  - no exceptions.
  - Noise-burst cues (snap, cut; the scrub detent until v15) read a moving offset of one noise buffer, so their level varies
    by a few dB from one play to the next. Their ranges are wider.
- **Cost of Hear F** (synthetic pointer events, the app's whole handler):
  - z² − 1: 0.14 ms per event, off and on alike.
  - sin(1/z) near 0 with jumps of up to 34 px: mean +0.07 to +0.13 ms, p95 +0.1 to +0.2 ms, max 0.4 to 4.4 ms over
    runs (the budget holds).
  - A real 60 Hz pointer sweep: 60 fps with Hear F off and on; rAF p95 interval within 1 ms.
- **Click regression from the app** (`sound_clicks_cmd.js` + `sound_clicks.py`, cues off, ±25 % jitter, 2 % stalls):
  - **0 clicks** on the slow line, the circle around a zero and the Height walk on the relief, at 60 and 240 Hz, with
    the AudioWorklet and with the fallback (12 recordings). Verified the voice ran on each engine.
  - Also 0 with the worklet: Esc while moving and stopping Listen along by moving (6× CPU throttle), and leaving and
    re-entering the relief.
  - The fallback: in those three extra cases, 0 to 5 detections at −55 to −59 dB re the local RMS (−103 to −112 dBFS
    absolute), at gate changes (Esc, leaving or entering the relief). This is the documented residual of the fallback's native gate (DESIGN
    §7.6). §7.6 counts a snap from −50 dB, so none is a snap.
  - The detector copy has one change from `cdp2/clicks.py`, taken from `cdp3/det.py`: the local RMS a peak is measured
    against is never below 1/10 of the recording's RMS. Otherwise float specks in a fade to silence (−143 dBFS) count.
- **mv_views_cmd.js** (port 8832 copy): pass. It first failed at 1024 px (the bar overflowed by 23 px). Fixed by the
  width rules above.
- **Quality suite** (`--base-url http://localhost:8832/`, then `compare.py --only quality --quality-enforce-targets`):
  PASS. 81 runs, 0 failed, 259 targets met; every golden difference reported is 0.
- **Perf** (`run.sh --paired --quick` against `notes/gate-morph-zp-r1`; no other perf gate was running then):
  - 8 FAIL lines, none from sound:
    - `examples.{2,3,6,8}.inv_first_draw_ms`: over the absolute 250 ms limit on the reference too.
    - `image.default.m240.gpu_*_bytes` and `examples.4.gpu_peak_bytes`: transient GPU peaks that change between runs.
      `image.default.m240` passed on the re-run. `examples.4` was 3.29 MiB twice and then 2.40 MiB, equal to the
      reference, on a third paired run. GPU live bytes were identical in every run. Sound makes no WebGL allocation.
  - 7 IMPROVED, 497 PASS.
  - A perf gate from the main tree started at 18:03, while my quality run was going. I started no perf run after that.

## Not done, or not verified

- **Not built:** the per-plane headphones toggle of DESIGN §2.1 ("Hear F per plane"). The popover switch and the
  palette entry cover it, and it would add a control to every plane head.
- **Not verified in the app:** the "preimages collide" cue (needs a hover exactly over a critical value), and the error
  cue (the hooks are in place; the engine test covers that errors pass the storm guard).
- **Not verified at all:** how it sounds (I cannot listen), Safari and iOS, Firefox, a real screen reader.
- **Open from DESIGN §7.6:** "Listen along" builds its buffer on the main thread (about 30 ms here; worse on slow
  machines). The fallback's gate keeps small corners at onsets (above).
- **Size:** the published file grows from 1,890,821 to 1,994,153 bytes (+103 KB, +5.5 %); gzipped 582 → 616 KB.
  `sound.js` is 63 KB with comments; the app block 28 KB.

## How to run

```
python3 build.py
node test/t_sound.js
test/<you>_cdp/q.sh test/sound_cmd.js                 # prints {pass, fails, R}
test/<you>_cdp/q.sh test/sound_clicks_cmd.js && python3 test/sound_clicks.py test/<you>_cdp/rec '*'
```

`sound_cmd.js` and `sound_clicks_cmd.js` use port 8832 (`PORT` at the top), for every page they open: they load
through their own `loadHere()`, not the kit's `load()` (which opens 8793). Delete `test/<you>_cdp/rec` afterwards.

## Review fixes on the merged build (2026-10-22 evening)

Details: `notes/export-design/AS-BUILT.md`, section "Review fixes on the merged build". In short:

- Esc stops the sound in a capture-phase listener, before the export dialog, the palette, a menu or the tour take
  that Esc. During a tour the Esc that stops a Listen along does only that; the next Esc ends the tour.
- `Calc.argStep` and `Calc.orderAt` take a wall-clock `deadline` (checked after every 16 calls). The tracker passes
  `t0 + 3` ms. The cost per call is now total time over total calls, across events.
- Shift+M works while a menu (the Help menu) has the focus.
- `test/sound_clicks.py` refuses recordings below 20 kHz.
- `test/sound_cmd.js` also measures the tracker's own time per event (`trMax`, limit 4 ms). A cost run over a limit
  is measured twice more and the median run counts (a pause of the page's thread lands in single events with
  Hear F off as well; see below).
- Click regression re-recorded at 48 kHz (built-in speakers): worklet 0 clicks in all 9 cases; the fallback has two
  detections at −58.7 and −58.6 dB re the local RMS (below the −50 dB snap line), in escMove and landEdge.

## Sound follows the function under a still probe (2026-10-23, `work/xvs`)

Details: `DEFORMATION.md`. In short:

- While the Deformation plays or is scrubbed and the pointer (or the keyboard probe) rests on a plane, the tone follows
  H_t there every frame, and the pointer-tier cues fire in t: a zero or pole of H_t passing pings with its order, a
  cut of H_t ticks, each full turn rings a bell, Height contours tick. Each frame's step is a path in (z, t), tracked
  exactly (`Sound.pathStep`); with the pointer moving too, one path for both.
- The merged deformation plane of X → Y: its point under the pointer is read as a point of X, and the tone is H_t
  there (as the Phase view gives it). The Landscape: the needle's z, whatever the camera does.
- One hook, `soundFunctionChanged()`, re-evaluates once a frame at most whenever the function under a still probe
  changes (a dragged zero, an edited parameter; v15's Params). Free with sound or Hear F off.
- A swap without a path (the transport opening or closing, a loop repeat) glides to the nearest turn, with no cue.
- After the review (`review-deformation.json`, `ledger-deformation.json`): Esc clears the rest; a still pointer whose
  plane changes (the panes merge or split, `setMain`, a fit) is re-picked (`sndRelayout`, `sndRepick`; hooks in
  `openTransport`, `closeTransport`, `setMain`); a click keeps the rest; zero and pole speech only for a played ping;
  the transport's run has no time limit; the keyboard probe stays a 280 ms sample during a play; the merged plane draws
  the path t → H_t(p) and its head (`sndOverlay`, hook in `renderOverlays`); `soundFunctionChanged({ at })` tracks a
  change along a path; the Height swap glide runs its 150 ms.
- After the verification (`review-deformation-verify.json`): the re-pick waits for a frame drawn at the new layout
  (`sndFrame`, one line at the end of `frame()`; `sndRelayout` also from `onPaneResize`), and a plane's view key holds
  its pane's size, so the probe is the point under the pointer to the pixel after the transport bar resizes the plane;
  on the relief and X's globe the needle stays when only the camera refits (no fresh start: the swap glide runs to its
  end; `HeightVoice.reset()` keeps a running glide's end); Esc also forgets the pointer's position, so no layout change
  brings the tone back before the pointer moves.
- Changes: `src/sound.js` (`Sound.pathStep`, `Sound.turns`, `HeightVoice.set(…, glide)`; the bell rule now counts a
  turn that ends on the integer up to rounding), the sound block of `src/app.js` (`sndHover`, `sndRetrack`,
  `soundFunctionChanged`, `sndFAt`, `sndVKey`), five one-line hooks (`frame()`, `chainChanged()`, `openTransport()`,
  `closeTransport()`, the R-pane hover), the test hook `__cmwSound` (`zp`, `hAt`, and the run's state).
- Tests: `test/t_sound.js` (the tracker driven by t), `test/sound_deform_cmd.js` (section 16 of `test/sound_cmd.js`),
  `test/sound_deform_clicks_cmd.js` with `test/sound_deform_inj.js` (32 recordings: 0 clicks, detector A 0),
  `test/sound_deform_fps_cmd.js` (the sound's own work ≤ 1.1 ms a frame). `sound_cmd.js` and `sound_clicks_cmd.js` read
  their port from `CMW_PORT` (default 8832).
- Known, not from this change: this v14 copy of `sound.js` lacks the main tree's `q.due` gate fix, so 2 queue checks
  of `t_sound.js` fail here (12 turns give 9 bells), and the live queue check of `sound_cmd.js` fails when the audio
  clock moves during the burst (once in three runs). The final `sound_cmd.js` run passed with 0 failures.
- Size: the published file grows by 8,040 bytes (+0.3 %), gzipped by 2.9 KB, against the same build of `v15-base`.

## Scrub (v15.1, 2026-10-24, `work/xvk`)

The user: dragging t "makes cracking sounds"; the cues feel mechanical when played constantly.

- **What the cracking was.** By design, not a fault: v15 played `morphTick`, a noise burst with a 0.8 ms attack, at
  every 0.05 of t, plus a sine key at t = 0, ¼, ½, ¾, 1 that skipped the gap and storm guards. A fast drag (two 0 → 1 → 0
  sweeps in 2.4 s, recorded from the app) made 42 bursts and 17 keys, about 25 sharp onsets a second: a rattle.
  Both detectors count each burst attack as a click: `sound_clicks.py` 222 (60 Hz input) and 239 (240 Hz), worst −6.5
  dB re RMS; `det.py` 39 (A) and 167 (B) "engine" hits over the 8 recordings. (`det.py` calls these "engine" only
  because the recorder's start hook misses `AudioBufferSourceNode.start`, so noise-burst cues have no cue span.) No
  engine fault: no gaps, no late sources or params.
- **Now** (`Sound.scrub(u0, u1)`; the app's `sndScrub` calls it with t / length before and after each input):
  - speed = detents a second, smoothed over 60 ms; an input after 150 ms of rest (a click on the track, an arrow key)
    is a step, not speed.
  - slow (≤ 3 a second): a soft detent at each 0.05 of t, a small wooden tock (a 1.0 → 1.4 kHz sine over t with a
    2.756× bar partial, 3 ms sin² rise, T60 40 ms, an envelope with no corner, `softEnv`), each one ±3 % in pitch and
    ±1.5 dB (no two alike); 3 to 6 a second, the detents fade out; at 6 or more, none.
  - fast (> 3 a second): a band of noise (band-pass Q 0.8 at 650 Hz · 2^(0.8 t), brighter by up to 1.5× with speed,
    low-pass 2.6 kHz), its level ((v − 3) / 30)^0.6, as a surface scraped faster sounds louder and brighter (Gaver's
    scraping). Each swell is a new band rising exponentially (0.2 s from −80 dB); it fades (τ 40 ms, two gains) 70 ms
    after the last input or when the drag slows to 3 a second, and is stopped 0.8 s later.
  - t = 0, ½, 1 (¼ and ¾ dropped): soft sine keys D5, A5, D6 with an 8 ms rise, at any speed, each at most once in
    250 ms.
- **Measured** (the same recordings, vol 0.7, default tiers): fast drag peak −20.8 → −29.5 dBFS, crest factor 23 → 17
  dB, sharp onsets 25 a second → 3.7 (the keys) over a continuous band. Slow drag (2.5 a second) peak −22.3 → −29.3
  dBFS. Lab (`sound_lab.js`, 100 %): detent −45.2 LUFS-M, the key at ½ −41.5, at 1 −39.5, the key alone −45.0; HF ≤
  −81 dB, phone loss ≤ 0.1 dB, ends at exactly 0. `sound_cmd.js` GROUP for morphTick is now [−48, −38].
- **Clicks**, the 8 recordings (fast, slow, mixed, jump; 60 and 240 Hz input): `det.py` engine hits A 0, B 0; no gaps,
  no late params or sources. `sound_clicks.py`: fast 0 (240 Hz) and 1 at −50 dB re RMS (60 Hz); the slow detents
  still show one hit each at their onset (−25 dB re RMS, −70 dBFS above 10 kHz), which `det.py` classes as the cue's
  attack. Not found why a sin² rise leaves that one-block HF trace; it is there for every cue's onset.
- Tests: `t_sound.js` 6 new scrub checks (92/92); `sound_lab.js` adds the key alone ({t: 0.5, g: 0}).
  Recording command: `work/xvk/test/xvk_cdp/scrub_rec_cmd.js` (+ `scrub_cfg.json`: page and tag).
- `sound_deform_cmd.js` C: its scrub (0.025 of t every two frames, 15 detents a second) is now a fast drag, so it
  expects the keys at ½ and 0 (2 to 3 `morphTick`), not 21 detents.
- Not done: nobody listened. `sound_cmd.js` and `sound_deform_cmd.js` were not rerun in full after the change.


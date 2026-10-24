# Board fixes (2026-10-24, 02:10)

Only bug fixes went into board.html. Palette B's cues sound exactly as the user heard them at 01:45: no recipe, level,
texture or timing changed. The hear-the-function code was not touched. That covers the choir worklet, `voice()` and
section 2 of page.js and page.html; a check confirmed them byte-identical.

- `board.html`: the fixed page. It replaced the old one, which is unchanged in `board-sent-0145.html`.
- `board_fix/`: the fixed sources (engine_b.js, page.js, page.html). `python3 board_fix/build.py` rebuilds
  `board_fix/board.html`. `board_fix/fixes.diff` is the whole change against `board/`, for merging with the new
  hear-the-function code. The sources in `board/` are unchanged.
- `bfix_cdp/`: the checks (cmd/*.js), live recordings (rec/) and screenshots (shots/). Each check was run in headless
  Chrome on the old and the new page, or in node on both engines.

## Every finding and what was done

| Finding | Done | Evidence (old → new) |
|---|---|---|
| sndv2p-1, aud-2: landmark notes chatter under a resting hand, in the snap zone, and on jumps | **Fixed.** A landmark re-arms only after t moves 0.02 away from it (0.05 at 0 and 1, beyond the 0.03 snap). The same landmark rings at most once in 150 ms. One input event rings at most one landmark: the one nearest where t lands. | 2 px tremor on ½: 59 → 0 notes after the arrival note. 0 → 1 in one event: 4 at once → 1. Hovering at the snap edge: 8 → 1. Ordinary drags are unchanged: medium 8 = 8, fast 8 = 8, board wiggle 7 = 7, with the same velocities. |
| (same) repeat softening for landmarks, an 8/s cap, a "rest on ½" demo | Not applied: these would change how fast drags sound, and the demo is a new feature. | The extreme ±0.3 wiggle at 3 Hz drops from 18 to 12 notes/s, because a second hit within 150 ms at a turnaround is skipped. |
| sndv2p-2: no hush; Esc does nothing; off is slow; queued cues survive | **Fixed.** The worklet gets a `clear` message: queued cues are dropped and sounding ones fade out on a 12 ms raised cosine. `SoundB.hush()` also empties the turn queues and gates the voices. Esc on the board stops Play, the auto-drag, the ×4 timers, the voice and both engines. Off now hushes and drops the master with τ 3 ms, as A does. A hidden tab or pagehide hushes and suspends. A **Sound** on/off switch is in the bar. | Esc 150 ms into a ×4: 3 → 0 cues after Esc. Sound off during a ring: −55 dBFS to silence in about 40 ms, with 0 click-detector hits (rec/live_B_off). In node, the fade's sample curvature is 1.3e-3, against 4.2e-2 in ordinary sound, and it is silent after 12 ms. |
| sndv2p-3: the first press in B is silent | **Fixed.** A B cue asked for before the engine is ready is kept and played when the engine is ready (only the last one, within 0.8 s). | First press in B: 0 → 1 cue. A still plays its first press. |
| sndv2p-4: ×4 in B gets quieter (repeat softening) | **Fixed.** Table auditions skip B's repeat rule. Section 4 now says that the app softens repeats in B. | ×4 gains: −1.07/−2.07/−3.07/−4.07 dB → −1.07 dB each time. |
| sndv2p-6: the A/B switch is hard to read in dark mode, and its focus ring is clipped | **Fixed.** In dark mode the pressed segment has dark text. Segmented groups no longer clip their content and have rounded end buttons, so the focus ring shows. | Dark-mode contrast: B 2.02 → 9.13:1, A 2.22 → 8.31:1. Light mode is unchanged (5.88:1). shots/fix_dark_bar_focus.png. |
| sndv2p-7: on a phone the table buttons are off-screen and the bar is 126 px | **Fixed.** Below 600 px the bar is one row (palette, Sound, volume), and the status stays available to screen readers. The table becomes rows: the name and the buttons on one line, the meaning below them. | Bar 126 → 54 px. Right edge of the first row's buttons: 587 → 342 px (screen 375). No sideways scroll. shots/fix_phone_*.png. |
| (same) cut the intro, move the slider card up | Not applied: changes to text and order (taste). | |
| sndv2p-9: unnamed table buttons, silent status, single-key shortcuts | **Fixed.** Each button is named (for example "Play “Toggle on” in B, four times"). The status is `role=status`. The A/B keys ignore Ctrl, Alt and Cmd, do nothing while you type, and can be turned off with a "keys A / B" switch in the bar. | Cmd+A no longer switches the palette. |
| sndv2p-10: switching palettes during Play mixes them; Loop is silent | **Fixed.** A switch stops Play and the auto-drag, and the hint says to press Play again. Pause now ends B's motion bed whichever palette is on. The Loop switch is labelled "(repeats silent)". | B motion-bed messages after switching to A mid-play: 77 → 0. |
| sndv2p-11: "notes only" still plays the air during Play | **Fixed.** | Motion-bed messages during Play in mode C: 90 → 0. |
| sndv2p-12: a blind A/B option | Not applied: it is a new feature, and the user has already chosen. | |
| sndv2p-13: the first hint is overwritten at load | **Fixed.** | Hint at load: "Try the slider below in A, then in B…" |
| (same) section order; the "Hear the function" switch is on and not explained | Not applied. The order is taste. Section 2 belongs to the hear-the-function rework, so it is passed on there. | |
| sndv2p-14: the air rides the events tier | Not applied: a decision about the app's tiers, not a board bug. | |
| sndv2p-15a: the off-switch track is 1.3:1 | **Fixed.** A 1 px inset edge in --mut (above 3:1). | |
| sndv2p-15b: the chips' × buttons are 20 × 15 px | **Fixed.** They are now 24 × 24 px. | |
| sndv2p-15c: B's slider row dimmed to 45 % in A | **Fixed.** No dimming; the label now says "(applies to B only)". | |
| sndv2p-15d: the choir's pan spread | Not applied here: hear-the-function code (passed on). | |
| sndv2p-15e: the iPhone silent switch | **Fixed.** A one-line note shows on iPhone and iPad. | |
| sndv2p-5, aud-4: the choir's level drift hides the \|F\| loudness cue | Not applied here: hear-the-function code, which is being replaced. The new voice should keep its slow level change under about 1 dB. | |
| sndv2p-8: the plane cannot be used with the keyboard or on touch | Not applied here: section 2 is being replaced. It is a real accessibility defect, so the rework should add arrow keys (0.1 per step, 0.02 with Shift), Enter to start or close a loop, and press-and-hold for a loop on touch. | |
| aud-3: the texture sputters at slow drags | Not applied. A least-squares speed estimate was tried. It removed the sputter (level sd 1.7 → 1.0 dB at 0.15 t/s), but slow drags became much quieter: −13 dB at 0.15 t/s and −3 dB at 0.3 t/s, because the old jitter had been pushing the level up. That changes the sound the user approved, so the gate needs re-tuning by ear first. The change was reverted, and the texture is identical to before. | tex.js in the scratchpad |
| aud-5: the slider is 4 dB quieter in B | **Fixed by instruction.** Section 1 says so. A level-matched switch was not added (a new feature). | |
| aud-1 (brighter materials), aud-6 (flutter), aud-7 (glass beating), aud-8 (phone balance), aud-9 (turn bell), aud-10 (interval detune) | Not applied: taste changes to B's cues, which the user likes as they are. | |
| aud-11: B is click-free | No change needed. The new `clear` keeps the rule: every fade starts with zero slope and ends at exactly 0. | |
| aud-12: not tested in Safari or on a phone | Partly addressed: the iOS note. Listening once in Safari and on a phone is still needed. | |

## Not verified

- Nobody listened to the page. All checks were made in headless Chrome with muted output, or in node.
- Not tested in Safari or on a real phone.

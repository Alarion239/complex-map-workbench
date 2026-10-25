# As built, round 2: "In the Hall of the Mountain King", in tune, on a clean spiral

> The review fixes after this changed the sound: one string a note with a steady −5 dB octave partial, one note ringing in the theme, fixed phases, F♯ a just fifth, the fit kept clear of the style bar in pixels. See `ledger.json`; the recording `mountain-king.m4a` is the new one, this round's is `round2.m4a`.

Built in `work/xvsea`, starting from round 1 (frozen in `work/xvsea-final-snap`). It answers the user's two requests:

- "Use a clean spiral that never crosses itself (z^(−2+iβ)), even with fewer drum hits."
- «Оно довольно часто фальшивит…» ("it often plays out of tune").

What was wrong with round 1, measured on its recording, is in `DIAGNOSIS.md`. Round 1's recording is kept as
`round1.m4a`.

## What changed, in one line each

- **Its own strings.** The piece plays on lines of the Phase key (line s, at 30°·s, plucks D + s semitones). It uses
  exactly the pitch classes Grieg writes: B, C, C♯, D, E, E♯, F♯ and A, which are lines 9, 10, 11, 0, 2, 3, 4 and 7.
  No note is substituted. The 78 theme notes are Grieg's, in the written octave (B3 to B4).
- **Silent crossings.** 225 crossings: 90 written notes sound (78 theme notes plus the coda's 12 chord notes), and the
  135 others are silent (velocity 0, no string).
- **One clear octave.** Each note is one string at its written pitch, plus one string an octave above at −10 dB (a pure
  octave, for small speakers). There are no Gaussian copies.
- **An in-tune harp, for the pointer harp too:**
  - Partials follow f·n·√((1 + 10⁻⁴n²)/1.0001): partial 1 is exactly f, partials 2 to 5 are +0.3, +0.7, +1.3 and
    +2.1 cents.
  - One detune (±1.5 cents) is shared by every string of a note.
  - The other palette-B cues are unchanged. The branch-cut cue, which is also the drum, keeps its old pluck.
- **The spiral:**
  - F = z^(−2+24i), one clockwise turn per statement, cut at 180°.
  - Each turn is the previous one scaled by 0.77, so it lies strictly inside it.
  - 0 self-crossings (round 1 had 31). It always turns clockwise. The largest turn between neighbouring stored points
    is 8.5° (round 1: 11.2°).
  - It keeps round 1's accelerando (quarter = 100, 130, 169, 219) and crescendo (velocity 0.38 to 1.0).
- **Fewer drum hits.** The curve crosses the cut once a turn, so the drum sounds 4 times: on each statement's downbeat
  and on the first crash. Round 1 had 7.
- **The coda is ours, as before.** It is three rolled B-minor chords (B3 D4 F♯4 B4, then down, then up). Each chord now
  starts on the beat, and the coda broadens (each beat 1.5× as long) so the rolls fit the curve. Duration: 22.97 s
  (round 1: 21.85 s).

**Notes changed:** none. Every note of the theme is as Grieg wrote it. Round 1's six substitutions per statement
(C♯ → B, E♯ → E, C → B) are gone.

## How the curve is made (`tools/melody_curve.js`, score as data in `tools/melodies/mountain-king.json`)

The score is walked on the piece's lines. Where the melody turns, the phase goes `turnPast` (0.06 turn) beyond the last
line it reaches, either just after the note or just before it. A small dynamic programme picks which, for one statement,
and every statement uses the same choice, so the spiral stays self-similar.

The phase is a cubic Hermite:

- slope ≥ 0.8 turn a beat at each written note, so the 1/96-turn Schmitt band is passed in ≤ 10 ms;
- slope 0 at each turn, with the time a gentle bend needs;
- ramps and a straight middle in long gaps.

θ(t) is solved for constant speed for statement 1 only. Statements 2 and 3 are exact scaled copies, because integrating
on drifts: the solution is unstable. The coda is integrated from the end of statement 3.

The generator reports:

| Report | Value |
|---|---|
| infeasible | 0 |
| counterClockwiseSteps | 0 |
| selfCrossings | 0 |
| turnMaxDeg | 8.5 |
| radius | 0.55 to 1.76 |

## Engine and app (`work/xvsea`)

- **`src/sound.js`:**
  - `pluck` gets `o.tune`.
  - `Harp(lines)`: each harp has its own lines (`thrL`, `cellL`; default `HARP_LINES = [0, 2, 4, 7, 9]`).
  - `harpNote` takes a semitone, uses one shared detune and calls `harpString`.
  - New `pieceNote`: the written pitch plus the octave string, with `PIECE_G = 1.25`.
  - `harpStep` takes `o.note` and `o.dbl`. A piece's crossing with no note is silent.
  - `alongCount(phi, closed, lines)`; `harpAlong` passes `lines`, `note`, `dbl`.
  - Round 1's `o.reg` and `piece` paths are removed.
- **`src/app.js`:**
  - `sndListen` checks the crossing count on `listen.lines`, then passes `lines`, `note`, `dbl` and `cap`
    (`listen.cap`, 8 strings: the last four notes ring, older ones fade over 30 ms, as a harpist damps).
  - The guide's last melody sentence is now "This example has its own strings, one for each note Grieg wrote: only
    those notes and the drum sound, each in its written octave."
- **`src/seasong.js`, `test/fixtures/seasong_score.json`:** regenerated.
- **Strings:**
  - `notes/i18n/ru/v152-seasong.json`: the guide paragraph, EN and RU («У этого примера собственные струны…»).
  - `make_ru_table.py --strict`: 0 unresolved, 15 collisions.
  - Then the tour's three Sound-step strings were put back from round 1's table, as for ledger ui-10. The table now
    differs from round 1's only in that paragraph.

## Proof with the app's own code

- **`test/t_seasong.js`: 63/63.** It uses the app's `sndSample` and `src/sound.js` in a sandbox.
  - The piece's lines are exactly the score's pitch classes, and there are no substitutions. The 81 main notes are the
    theme three times, as written, then the crashes.
  - All 225 crossings are in order, on the same lines and in the same directions. Written notes are within 15 ms
    (worst 7.1 ms at 900 samples).
  - The same holds at 600 to 3600 samples, with the points rounded to 3 decimals, and with 2e-4 jitter.
  - `harpAlong` schedules 90 onsets and 180 strings: every written note at its pitch (±1.5 cents) and octave, plus a
    pure octave (ratio exactly 2) at −10 dB. Nothing else is scheduled.
  - Partials are as above. The pointer harp's octave copies are pure.
  - The spiral: 0 self-crossings in the stored points and in the 900 played samples. It always turns clockwise, makes
    3 to 4 turns, and turns at most 8.5° between points.
  - 4 drum ticks within 10 ms; crescendo; ×1.3 accelerando.

## Round 2's recording: `r2/round2.m4a`

This section describes round 2's recording, now kept as `round2.m4a`. `notes/sea-song/mountain-king.m4a` has since been
replaced by the review fixes' recording: 94 cues (90 strings + 4 ticks), at most 4 strings at once, the octave as each
string's own 2nd partial at −5 dB, no detune, F♯ a just fifth. Its numbers are in `ledger.json` and `review-verify.json`.

It records the app as it plays, made the same way as round 1:

- The example opens, and Listen along is chosen from the curve's menu.
- Volume 0.7, worklet engine, sample-exact.
- 48 kHz forced, because the default output is 16 kHz earbuds. The 48 kHz override is now built into
  `test/seasong_rec_cmd.js`.
- 26.0 s, then AAC at 344 KB. The WAV and f32 files were deleted; the engine's cue log is `measure/rec-cues.json`.

| Measure | Round 2 | Round 1 |
|---|---|---|
| Onsets that sound | 90, all written notes; 180 strings + 4 ticks scheduled; late 0, gaps 0, at most 8 strings | 150 (69 unwritten graces) |
| Scheduled onset vs score, worst | 9.8 ms | 7.5 ms |
| Written note heard at its pitch (±5 cents) | **90 of 90** (81 of 81 main notes); mean −0.07, SD 0.95, worst 2.2 cents | 60 of 78 (18 substituted) |
| In the written octave | **90 of 90**: nothing new an octave below (≤ −38.8 dB) | the loudest copy was +1 octave on 69 notes, +2 on 3, written on 4 |
| Beating in the ring-out | single peaks: B3 −0.1, D4 +1.4, F♯4 +0.9, B4 −0.4, B5 −0.3 cents | doublets beating at 1.6 to 2.4 Hz |
| A4 half note | A4 −0.1, A5 0.0 cents; partials 3 and 4 +2.5 and +1.5 cents vs equal temperament (just intervals plus ≤ 0.7 cent) | A5 copy 8.5 cents from A4's 2nd partial (about 4 Hz beat); partials +14.8 and +21 cents |
| Peak | −20.9 dBFS | −21.2 dBFS |
| Main-note peaks by statement, then coda | −30.2, −26.9, −23.6, −24.8 dBFS | −30.7, −26.9, −24.2, −22.8 |
| RMS, statements 1 to 3 and coda | −41.5, −37.9, −34.5, −34.9 dBFS (rise 7.0 dB) | −43.3, −39.1, −35.8, −38.4 |

The decoded m4a gives the same pitch figures (worst 2.18 cents).

How the pitch was measured, with the scripts in `measure/` (`written_pitch.py`, which uses `pitch_onsets.py`; `beat.py`; the notes and results as JSON):

- Take the spectrum after each onset minus the spectrum before it.
- Take the peak within ±60 cents of the written fundamental.
- Compare it with the level an octave below and an octave above.
- If the same pitch was already ringing, use the plain spectrum after the onset instead.

To make the recording again:

```
python3 build.py
node test/<you>_cdp/cdpd.js
test/<you>_cdp/q.sh test/seasong_rec_cmd.js
node test/seasong_wav.js <f32> out.wav
afconvert -f m4af -d aac out.wav mountain-king.m4a
```

Then delete the WAV and the f32.

## Checks

| Test | Result |
|---|---|
| `t_seasong.js` | 63/63 |
| `t_sound.js` | 122/122 |
| `t_i18n.js`, `t_i18n_keys.js`, `t_i18n_english.js` | 18249 pass, 4754 pass, byte-identical |
| `t_tour.js` | 1101/1103, the same 2 failures as the base |
| `t_views.js` | 76/76 |
| `make_ru_table.py --strict` | 0 unresolved |
| `seasong_cmd.js` (CDP, port 9311) | pass, 0 fails. Desktop 60 fps, p95 18.4 ms; phone light, dark and RU 60 fps, p95 18.4 to 18.5 ms |
| `sound_v152_cmd.js` | pass, 0 fails |
| `tour_cmd.js`, `i18n_cmd.js` | 95/95, 92/92 |
| Quality suite (`run.sh --no-build`, port 9311) | PASS: 81 runs, 0 failed (28 improved, 35 unchanged, 18 new, as before), 259 targets met |
| Build | twice, same bytes; no test hooks, machine paths or emails |

No perf baseline, `accepted.json` or golden image was changed.

## Screenshots: `shots/`

- Desktop EN: light, dark, menu, playing, gallery, guide, X → Y.
- Desktop RU: light, menu, guide.
- Phone EN: light, light with menu, light playing, dark.
- Phone RU: dark.

The whole spiral is in view on every one, above the style bar, with the cut handle inside the innermost turn.

## Open

- **Listen on the Android phone.** The theme is now in its written octave (B3 to B4), an octave lower than round 1's
  loudest copy. The soft octave string is there for small speakers. Check that statement 1 is audible on the phone.
- **The coda's allargando** (the crashes at 2/3 of the final tempo) is new and ours. If the user wants the crashes at
  full speed, the rolls must be shorter: chords of three notes, or a smaller roll.

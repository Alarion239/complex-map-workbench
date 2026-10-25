# Merge notes: the sea song

- **From:** `work/xvsea-final-snap`, frozen 2026-10-24 after round 2 and its review fixes (src/, tools/, build.py,
  test/ without `*_cdp` folders). Round 1's snapshot is now `work/xvsea-final-snap-r1`; do not merge that one.
- **Base:** `work/xvsd-snap` (v15.1 plus the v15.2 sound). Every change below is against it.
- **Into:** v16. What it does: `AS-BUILT.md` (round 1), `r2/AS-BUILT.md` (round 2), `r2/ledger.json` (the review
  fixes) and `r2/review-verify.json` (the independent check).

## Files

| File | Change |
|---|---|
| `src/seasong.js` | new, generated (`tools/melody_curve.js`): `SEASONG` = the curve, steps, view, `listen` |
| `src/sound.js` | 8 hunks, the sound engine (below). **It also changes the pointer harp**, not only the piece |
| `src/app.js` | 16 hunks, the example and Listen along (below) |
| `src/i18n_ru.js` | generated; regenerate after the merge (below) |
| `build.py` | 1 line: `'seasong.js'` in the bundle list, before `'app.js'` |
| `tools/make_ru_table.py` | 1 line: `V152_HERE` also reads `v152-seasong.json` |
| `tools/melody_curve.js`, `tools/melodies/mountain-king.json` | new: the generator and its input |
| `tools/ru_report.json` | generated; take the merge's own |
| `test/t_seasong.js`, `test/seasong_cmd.js`, `test/seasong_rec_cmd.js`, `test/seasong_wav.js`, `test/fixtures/seasong_score.json` | new |
| `test/sound_lab.js` | a comment only: `harpNote`'s second argument is now semitones above D (below) |
| `notes/i18n/ru/v152-seasong.json` (shared notes) | 10 strings, already in place |

No other file changed. `tour.js` and `test/regress` are the base's.

## `src/sound.js` (8 hunks)

1. Header API line: adds `Sound.alongCount(phi, closed, lines)`.
2. `pluck`: new options.
   - `o.tune`: no detune of its own, harmonic partials (exactly n·f), fixed start phases (`PH_ODD` of the partial's odd
     part, plus `o.ph0` turns).
   - `o.oct`: the 2nd partial at that level of the fundamental, with its decay (a piece's soft octave).
   - Cues without `o.tune` keep the stretched partials and random phases. One side effect: the t60 jitters are now
     drawn before the phases, so a seeded render of any pluck cue is statistically the same as the base but not
     sample-identical. No test depends on that (t_sound, sound_cmd, sound_v152_cmd pass).
3. `CATALOG.cut.make(Pt, o)`: `o.one` plays only the first pluck (the piece's drum).
4. `LV.harp` 0.0918 → 0.0831, re-levelled for the new harp (see "The pointer harp" below).
5. Worklet string cap: `c.cap` (default 12, as before). New `c.key`: a string plucked again is damped first (30 ms).
6. The harp:
   - Lines are general: `HARP_LINES = [0, 2, 4, 7, 9]` (semitones above D), `thrL`, `cellL`, `Harp(lines)`.
     On the default lines the crossings are the base's.
   - New `harpString` (one string, `tune: true`).
   - `harpNote(g, s, ...)`: `s` is now **semitones above D**. In the base it was an index into `[0, 2, 4, 7, 9]`.
   - New `pieceNote` (`PIECE_G` 1.38).
   - `harpStep`: `o.vel`, `o.note`, `o.dbl`, `o.cap` (a number or one per crossing). Velocity under 0.02 is silent.
7. New `alongSeat` (moved out of `harpAlong`) and `alongCount`. `harpAlong` passes `lines`, `vel`, `note`, `dbl` and
   `cap`, and plays the ticks at `o.tickDb` with `one: true`.
8. Exports add `pieceNote` and `alongCount`.

### The pointer harp (Hear the function under the pointer) changes too

Every harp note now goes through `harpString` with `tune: true`. That changes what the base's pointer harp sounds like:

- **In tune.** There is one ±1.5-cent detune per note, shared by all its octave copies. The base gave each string its
  own ±3 cents. Partials are exact harmonics with fixed phases, and each octave copy starts a quarter turn after the
  one below, so the copies add in power.
- **D accent.** It is folded into the D4 copy, at `hypot(w, 0.5)` of the note's level. The base added a second D4
  string, whose sum with the first depended on random phases.
- **Level.** `LV.harp` is 0.0831. The lab's seeds 1 to 8 give E −34.1 to −32.9 and D −31.0 to −29.9 LUFS-M, with D − E
  2.6 to 3.7 dB. All of these are inside the lab's −32 ± 2.5 window. Base: E −34.6 to −30.3, D − E −0.5 to +6.6.
- **The sound lab now measures E.** Its `note(2)` is E (2 semitones). In the base it was index 2, F♯. So
  `sound_cmd.js`'s "harp lab note" number is now for E, as the lab's label always said. Harp lab: note −33.04,
  D −29.88 LUFS-M (D − E 3.16).
- **Checked on a recording.** The verifier recorded the pointer harp over two loops round a zero (`r2/review-verify/pointer.m4a`).
  D4 is within 0.7 dB from loop to loop and 5.2 to 5.7 dB over the E4 copy.

**If another branch also changes `sound.js`:** any caller of `harpNote` that passes the old index `j` must pass
`HARP_LINES[j]` instead. In this tree only `harpStep` and `test/sound_lab.js` call it. Re-run `sound_cmd.js` (lab
windows) after the merge.

## `src/app.js` hunks (base line numbers)

| Base line | What |
|---|---|
| 2356 | `drawCuts`: `st.handleR`, an example's own handle radius (inside the spiral's innermost turn) |
| 5838 | curve menu: Listen along also when `sndListenOf(s)` (melody curve with sound off) |
| 7690 | `shapeName`: `nameKey === 'spiral'` → `$t('Spiral')` |
| 11425 | `EX`: the new example, appended last (no other index moves), with `fit`, `tip`, `thumbX`, `listen`; then `exFitBarPx` and `exFitTo` (the fit box kept clear of the desktop style bar in pixels; no bar on a phone) |
| 11435 | `loadExample`: `sndStopPlay(false)` first (another example stops the piece) |
| 11456 | `loadExample`: `exFitTo(ex)` (honours `ex.fit`), attaches `listen` and the points' key, sets L's curve |
| 11509 | gallery thumbnail: `thumbX` draws the curve in X |
| 11551 | gallery: `ex.tip` tooltip only where the line is cut |
| 11657 | guide, Sound: the "A curve as a melody" paragraph, thumbnail and play button |
| 11945 | X → Y: refit to `ex.fit` the first time a view is seen |
| 12474 | pointer move does not stop a `piece` |
| 12906 | `sndSample`: a cut tick at the crossing itself (`Calc.argStep`'s `at`) |
| 12914 | `sndListen(pts, closed, lead, listen, shape)`: the curve's own lines, duration, velocities, written notes, octave level (`dbl`), drum and strings per crossing (`cap`), only when `alongCount` agrees |
| 12967 | `sndListenOf`, `sndListenAsk`, `sndPlayPiece`; stop on delete, edit, chain change |
| 13078 | the L key replays the example's curve (`snd.lastLoop.sid`) |
| 14063 | test hook `__cmwSound().listenHarp` adds `dur`, `piece` (test build only; not in the published file) |

`exFitTo` only acts on an example with `ex.fit`, and this is the only one, so no other example's view changes.

## Order and checks at the merge

1. Take `tour.js` from the sound branch first (review ui-10).
2. Run `python3 tools/make_ru_table.py --strict` with `v152-seasong.json` in `V152_HERE`, after `v152-sound.json`.
   - Do not regenerate in xvsea alone. There, the shared `v152-sound.json` (rewritten later by another branch) replaces
     the base `tour.js`'s three Sound-step strings with the other branch's three.
   - Checked today on a scratch copy of this snapshot: 0 unresolved, 15 collisions, and the only difference from the
     shipped table is those three strings.
   - The shipped `src/i18n_ru.js` keeps the base's three. Against the base it differs only in the 9 new strings and
     «Слушать вдоль кривой «{name}»».
3. Check the tour's Sound step is in Russian (`tour_cmd.js` in RU, or `i18n_walk_cmd.js`) and that `t_i18n_keys.js`
   passes.
4. `«Слушать вдоль кривой «{name}»»` (v152-seasong.json) overrides chrome.json's unquoted form for every curve. If the
   glossary owner prefers the unquoted form, delete that one entry and change `seasong_cmd.js`'s
   `ru: Слушать вдоль кривой «Спираль»` check back.
5. Run `node test/t_seasong.js`, `node test/t_sound.js`, `sound_cmd.js`, `sound_v152_cmd.js`, `seasong_cmd.js` and
   `v15_phone_cmd.js` on a quiet machine. The frame checks have a 20 ms p95 limit. Today, with the machine at load
   11.7, one run read 20.1 ms on the phone RU dark pass and the rerun passed.
6. No perf baseline, `accepted.json` or golden image changed. `drawCuts` changes only for a step with `handleR`, which
   only this example has.

## Checks on this snapshot (2026-10-24)

- `t_seasong.js` 66/66 and `t_sound.js` 122/122, run in xvsea and on a copy of the snapshot.
- `seasong_cmd.js` (CDP, port 9316): pass, 0 fails, no console errors. The first run missed one frame check by
  0.1 ms under load. Rerun:
  - desktop 60 fps, p95 17.4 ms;
  - phone light, dark and RU 60 fps, p95 18.8 to 19.0 ms;
  - 0 points under the style bar at 1366x768, 1280x720, 1024x768, 1024x700 and 768x1024.
- Build: run twice, and from the snapshot itself, same bytes each time. No `__cmw` hooks, machine paths or emails in
  the published file.
- The verifier's run (`r2/review-verify.json`) covers `sound_cmd.js`, `sound_v152_cmd.js`, `t_views` and the `t_i18n*`
  tests.

## Snapshot hashes (`python3 build.py`)

- `dist/complex-map-workbench.html` sha256 `2761870565494bc8c53c8b23a177512b3644fbbdcf74c261cc2fa64322646f18`
- `dist/test.html` sha256 `ddde9d065431152a12f8f9668d3230e3142abe54cdb32b3a543685af9adf7a20`

## Open (not blocking the merge)

- **Listen on the Android phone.** This is still not done.
- **The spiral's sharp bends (picture-3).** They turn 33 to 39° within 4 px at phone scale, in statement 3 and the
  coda. Fixing them needs a new phase design, which is a round of its own.
- **The end nearly touches the turn outside it (picture-4).** The gap is 4.2 px on a phone and 6.0 px on a desktop.
  The user chooses: a falling final roll, a three-note chord, or keep it as it is.

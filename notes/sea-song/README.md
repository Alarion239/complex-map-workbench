# A melody on a curve

How the example "In the Hall of the Mountain King" is made, and how to put another public-domain melody on a curve.
The tool is `tools/melody_curve.js` (in `work/xvsea`). The build is in `AS-BUILT.md`. Round 2 (`r2/AS-BUILT.md`) gave a
piece its own strings, silent crossings, one clear octave, an in-tune harp, and a spiral that never crosses itself; this
file describes round 2.

## Use only public-domain music

The app is public. Use a composition that is in the public domain where you publish: in practice, a composer who died
more than 70 years ago, as here (Grieg died in 1907; Peer Gynt is from 1875). Work from the composition itself. Do not
copy a modern arrangement, edition, transcription or recording, and never use a film or game theme.

## How the harp turns a curve into notes

- Listen along walks the curve at constant speed (900 samples, uniform in arc length). It tracks arg F exactly between
  the samples.
- The harp's strings are lines of the Phase key: line s, at arg F = 30°·s, plucks D + s semitones. The pointer's harp
  (and any other curve) has five, lines 0, 2, 4, 7, 9 (D, E, F♯, A, B), and |F| sets their register.
- A piece has its own strings: exactly the pitch classes its score uses (`listen.lines`; for the Mountain King
  B, C, C♯, D, E, E♯, F♯, A = lines 9, 10, 11, 0, 2, 3, 4, 7). Each crossing of one of its lines is either a written
  note (`listen.note`: its MIDI pitch, played on one string at that pitch plus a soft string an octave above) or silent
  (velocity 0, note 0: a line passed on the way to a note, or crossed back where the melody turns).
- Crossing a branch cut plays a tick, which works as a drum.
- A closed curve with no cut ends on one sung note, its winding number.

So any melody, with its rhythm, is a path for arg F along the curve: arg F goes up and down as the melody does.

## The tool

```
node tools/melody_curve.js [tools/melodies/<piece>.json] [--dry]
node test/t_seasong.js       # the app's own sampling and harp play the curve: same notes, onsets within 15 ms
python3 build.py
```

It writes two files:

- `src/seasong.js`: the example's curve, its steps and view, and `listen: { dur, lines, vel, note, dbl, cap, tick }`.
  The app plays `listen` only on that curve, unedited, under those steps, when the crossings on `lines` number
  `vel.length`.
- `test/fixtures/seasong_score.json`: every crossing (line, direction, onset, written or silent, written MIDI note)
  and the drum ticks.

A run takes under a second. `--dry` prints the summary only (crossings, silent, self-crossings, the largest turn between
stored points, infeasible steps, ticks).

## The melody file (`tools/melodies/mountain-king.json`)

| Field | Meaning |
|---|---|
| `theme` | `[note, octave, eighths]`, the composer's notes as written, one statement (here 4 bars of 4/4) |
| `statements` | how many times the theme is played |
| `coda`, `codaChord` | `[[eighths after, direction, last octave], …]`: rolled whole-turn chords from the beat, their chord notes sounding |
| `codaFirstOnCut` | put the first chord on the cut (the drum) |
| `F` | `{n, beta, turnsPerStatement}`: F(z) = z^(n + iβ), the catalog's `powa` step |
| `cutDeg` | the cut's angle (180°: float32 needs \|β θ\| < 88 on the branch) |
| `tempo` | `q0` (quarter notes a minute at the start), lead-in and tail beats, `codaFrom` and `codaSlow` (the coda broadens) |
| `dynamics` | velocities from `from` to `to` over the statements (power curve), with accents; roll and landing levels; the drum |
| `octaveString`, `strings` | the octave string's level; the strings ringing at once |
| `rollBeats`, `crossSlope`, `turnPast` | roll speed; how steeply a written note's line is crossed; how far a turn goes past a line |
| `points`, `decimals`, `pointsBy` | the stored curve |
| `example` | `tex`, `view`, and `fit` (the box kept in view on a narrow screen) |

## Writing a new melody

1. **Write the notes as the composer did.** The tool gives the piece a string for every pitch class it uses; nothing is
   substituted. The octaves you write are the octaves heard.
2. **Choose the form and the speed-up.** On z^(n + iβ), each statement is the one before scaled by
   λ = e^(2π(1 + n·turns)/β) about 0. Played at constant speed, it is 1/λ times as fast.
   - Use one turn a statement and n = −2 (or any n with 1 + n < 0): each turn is then the one before scaled, strictly
     inside it, so the spiral never crosses itself. With β = 24, λ = 0.77 and the tempo rises ×1.30 a statement
     (100, 130, 169, 219).
   - The GPU computes z^α in float32: ln|F| = n ln r − β θ must stay within ±88, so keep β π under about 85 and the
     cut at 180°.
   - A busy melody needs speed: if `infeasible` is not 0, the phase cannot move that fast on this curve; slow the
     coda (`codaSlow`), slow the rolls (`rollBeats`) or lower `turnPast`.
3. **Run the tool, then the test.**
   - `infeasible`, `counterClockwiseSteps` and `selfCrossings` must be 0, and `turnMaxDeg` small (under 12°).
   - `t_seasong.js` must pass: the same crossings at every sample count from 600 to 3600, every written note on time
     and at its written pitch, nothing else sounding.
4. **Add the example in `app.js` (`EX`).** Use `$t()` for the name and the description, credit the composer, and say
   how to hear it. Add the strings to `notes/i18n/ru/v152-seasong.json`, then run
   `python3 tools/make_ru_table.py --strict`.
5. **Listen.** Record the app (`test/seasong_rec_cmd.js`, then `node test/seasong_wav.js`, then
   `afconvert -f m4af -d aac`), measure the pitch of every onset (`r2/AS-BUILT.md`), and check it on a phone.

The tool keeps one piece per build: `SEASONG` and `seasong_score.json`. For a second piece, give the output its own
names and its own entry in `EX`.

## The user's decisions (2026-10-25 02:20)
After round 2 the user said: "I like everything that is waiting on mee, you can proceed. No need to change anything". So: round 2 sounds right; the ending stays as it is (picture-4 closed by decision); picture-3 stays.

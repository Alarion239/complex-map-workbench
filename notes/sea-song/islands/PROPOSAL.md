# The Trolls' Hall: "In the Hall of the Mountain King" on the phase harp

Edvard Grieg, *Peer Gynt* (1875), public domain. This adaptation is our own and comes from the composition itself. Example name: **In the Hall of the Mountain King** (Russian: «В пещере горного короля»). Blurb credit: "after Edvard Grieg, Peer Gynt (1875)".

Files (all in this folder):

- `score.js`: the adaptation (melody, tempo, dynamics, ending) and the walk that turns it into string crossings.
- `make.js`: computes the route from the score and writes `route.json`.
- `prove.js`: plays `route.json` with the app's own harp and writes `proof.json`.
- `preview.m4a`: about 25 s, with the proposed per-example dynamics.
- `preview_today_engine.m4a`: the same route with today's velocity rule, for comparison.
- `picture.png`: the app's z-plane phase portrait with the route, light theme.
- `make_v0_original_tune.js.txt` and `make_v1_partial.js.txt`: the earlier starts.

To regenerate: `node make.js && node prove.js`.

## 1. The adaptation

The key is B minor and the strings are D E F♯ A B. The piece is in 4/4 and the beat is a quarter note. Each statement is 4 bars (16 beats), and the theme is played 3 times.

| bar | Grieg | here (string, beats) |
|---|---|---|
| 1 | B C♯ D E F♯ D F♯ | B ½, **B** ½, D ½, E ½, F♯ ½, D ½, F♯ 1 |
| 2 | E♯ C♯ E♯ – E C E | **E** ½, **D** ½, **E** 1, E ½, **B** ½, E 1 |
| 3 | B C♯ D E F♯ D F♯ B | B ½, **B** ½, D ½, E ½, F♯ ½, D ½, F♯ ½, B ½ |
| 4 | A F♯ D F♯ A | A ½, F♯ ½, D ½, F♯ ½, A 2 |

Bold notes are substitutions:

- **C♯ becomes B, repeated** (bars 1 and 3). The creep keeps all five eighths and still rises on every eighth after the first. On this harp a repeated note is a turn back across one line, which also makes the first B a natural "sneaking" double step.
- **E♯ becomes E and C♯ becomes D** (bar 2, first half). Each is the string a semitone away, so the answer still sits just below bar 1's F♯–D–F♯.
- **C becomes B** (bar 2, second half). It is a semitone away, so the answer's lower note sinks again (D, then B), as Grieg's C♯ sinks to C. The top note E is the same in both halves, because the five strings have nothing between E and F♯.

Every other pitch, every rhythm and all bar lengths are exact.

**What the harp adds.** On this harp the next note is always the same string (a turn) or the next string in the direction of travel. That forces two kinds of extra crossing, written into the score as soft notes:

- **flam**: the turning string re-plucked 30–50 ms after the note. It is the same pitch, so it is masked.
- **pass**: the string between the two notes of a third or fourth, a quick soft grace note (the harp's own run).

`walk()` in `score.js` chooses the turn directions with the fewest such notes. The whole piece is 78 melody notes, 30 flams, 31 passes and 21 chord strings: 160 crossings.

**Tempo.** An exponential accelerando from 100 to 250 quarter notes a minute over the 48 beats. That is about 137 bpm at the end of statement 1 and 183 at the end of statement 2. The first note comes at 0.35 s.

**Dynamics.** Melody velocity is 0.3 + 0.62·(beat/48)^1.3, plus 0.04 on bar downbeats and on long notes. Flams are 0.3 of that and passes 0.45. The mean melody velocity per statement is 0.37, 0.56 and 0.79 (pp to ff).

**Ending.** Crashing chords: three falling strums of all five strings (A F♯ E D B) on beats 48, 49 and 50. After a beat's rest comes one rising strum (B D E F♯ A B) that rings for 1.6 s. Each strum lasts 120 ms. The loop then closes with W = 0 and sings **D5**, the third of B minor. Total length: **21.89 s**.

**Engine change needed: per-example dynamics.** Today `harpStep` sets velocity from speed: a rate above 2.5 notes/s softens the note. On this route that gives mean melody velocities of 0.39, 0.29 and 0.23 per statement, so the music gets softer as it speeds up (hear `preview_today_engine.m4a`). It also gives flams and passes the same weight as the melody. The proposal, three small changes:

1. `harpAlong(phi, la, dur, o)` takes `o.vel`: one velocity per crossing, in the order the harp meets them. `harpStep` uses `o.vel[st.k++]` in place of the rate rule, and does not apply the D-only gate during that playback. Everything else is unchanged: pitch, register, the D accent and the count of low Ds. The D-only gate never fires on this route anyway (0 of 160 notes).
2. `sndListen` takes an example's own `listen: {dur, vel}` when the curve is the example's own and unedited. `dur` replaces `clamp(2.2 + |turns|, 2.6, 7)`. If the shape is moved or edited, the example data is dropped and today's rules apply.
3. A closed freehand curve: `K.curve` with `closed: true` (`poly(pts, !!s.closed)`), so Listen along seats it as a loop and it sings.

The sample count can stay at 900. The proof passes at today's 900 samples, and also at 2802 samples (128 a second).

## 2. The function and the route

The function, written with the zeros-and-poles step:

**F(z) = 0.0001 · (z⁶ − 1) / z³**

- a = 0.0001
- zeros: the six 6th roots of 1 (the trolls)
- poles: 0, 0, 0 (the Mountain King, a triple pole)

The six trolls stand on the unit circle round the King. Inside the ring F ≈ −a/z³, so two things follow:

- arg F turns three times round the King. Moving clockwise climbs the strings.
- |F| grows like 1/r³. The route starts out among the trolls (low and dark) and spirals in toward the King as it speeds up, so the register rises by itself.

`a` sets where that register sits. The phase portrait is six colour wheels round a three-fold centre (`picture.png`).

**How the route is made** (`make.js`). Each crossing is a knot on its string's line in the log-F plane, ζ = ln|F| + i arg F, at its time in the score. Between two knots the path has three parts:

1. a quick tangential run off the line, so the Schmitt band is crossed in a few ms and the onset falls on the line;
2. a "petal" where ln|F| dips toward the trolls;
3. a quick run onto the next line.

Turns are open loops inside one cell. Each piece is lifted to z exactly, by Newton continuation on F(z) = e^ζ. Listen along plays the curve uniformly in arc length (V = 0.6 units/s), so each petal's depth is found by bisection until the arc between knots equals V times the time between notes (to 1e-9).

The route is one closed polyline:

- 9119 points, length 13.133, radius 0.015 to 0.71;
- it never comes within 0.41 of a troll or 0.015 of the King;
- it has no cut.

**Storing it in an example.** One closed shape plus the listen data:

```
{ kind: 'curve', closed: true, pts: route.json pts }
steps: [{ type: 'zp', params: { a: '0.0001', zeros: '<6th roots of 1>', poles: '0, 0, 0' } }]
listen: { dur: 21.8886, vel: route.json vel }
```

At 6 decimals the points are about 200 KB. Thinning them before shipping is listed below. The other way is to ship `score.js` and `make.js` (about 250 lines) and compute the route on load.

## 3. Proof (`prove.js`, `proof.json`)

`src/sound.js` runs in a node sandbox. Its own `Harp`, `cellOf` and `harpStep` play the curve:

- The closed-curve seat is as in `harpAlong`, and nothing fires there.
- There is one `harpStep` per sample, with dt = dur/(M − 1).
- The curve is sampled as `sndSample` does (M points uniformly in arc length of the closed ring). Each arg step is checked against 8 sub-steps, with agreement to 1e-15.

Results:

- **M = 2802: EQUAL to the score.** 160 crossings, the same strings in the same directions and order. Largest onset error 9.5 ms.
- **M = 900 (today's density): also EQUAL.** Largest onset error 11.6 ms.
- Low Ds: 21 up and 21 down, so W = 0.000000.
- Cut ticks: none (F is rational).
- Final note: `curveAmps` gives harmonic 4 of D3, **D5**, which is also the loudest harmonic.

Register (ln|F| at the crossings; the centre is 0.5·tanh(ln|F|/2.5) octave from D5):

| | ln\|F\| mean (min…max) | centre |
|---|---|---|
| statement 1, pp, 100→137 bpm | −2.69 (−5.3…−1.1) | −0.40 oct |
| statement 2, mf, 137→183 | −1.76 (−4.1…−0.3) | −0.30 oct |
| statement 3, ff, 183→250 | −0.76 (−2.6…1.1) | −0.15 oct |
| chords | 2.46 (1.9…3.4) | +0.38 oct |

## 4. Previews

Both are rendered offline from the app's engine in headless Chrome (`Sound.render`, the worklet, the soft clipper on) on this route's notes, at their onsets and ln|F|. The sung D5 follows at dur + 0.05 s.

- `preview.m4a` (330 KB) uses the proposed `listen.vel`.
- `preview_today_engine.m4a` (330 KB) uses today's rate rule. It is about 9 dB quieter at the peak and fades as it speeds up.

## 5. Open points (honest)

- **The picture is not article-grade yet.** The climax packs into a small knot near the King, at radius 0.015 to 0.1. The longest gaps (the long notes, the closing 2 s) make long thin spikes, and the turns make small loops. Possible fixes:
  - spend the slack on wider, rounder petals that lean along the cell instead of dipping radially;
  - spread the closing petal over a whole sector;
  - give the hall a slightly larger inner scale (a larger V) once the petals are rounder.

  Each of these changes only `make.js`, and `prove.js` re-checks the result.
- I have only heard the preview as numbers (peaks, levels). It still needs a listening check for recognisability. The extras are ghosted (−10 dB and quieter) but still audible as grace notes.
- No app strings were written yet. To add, translated per GLOSSARY into `notes/i18n/ru/v152-seasong.json`: the example's name ("In the Hall of the Mountain King" / «В пещере горного короля»), its blurb with the Grieg credit, and the guide's sound paragraph.

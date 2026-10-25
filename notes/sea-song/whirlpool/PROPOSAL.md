# Whirlpool: "In the Hall of the Mountain King" as a spiral into z^(−1+24i)

Composer 2 (the spiral). Edvard Grieg, *Peer Gynt* (1875; Grieg died 1907, so the piece is in the public domain).
This is our own adaptation of the melody, made from the theme itself. No arrangement or transcription was used.

## Files (all in `notes/sea-song/whirlpool/`)

- `make.js`: the generator. It turns the score into the curve: `node make.js` writes `curve.json`. The score, tempo and
  dynamics sit at the top of the file, so the melody can be changed later.
- `prove.js`: the proof. It runs the app's own code (see "Proof"). `node prove.js` writes `proof.json`.
- `curve.json`: the score, F, the tempo, the expected ticks, and the curve (2400 points).
- `example.json`: the example as it would be stored (the curve at 1200 points, 4 decimals, 21 KB). It passes the same
  proof.
- `preview.m4a`: 24 s, 272 KB, rendered offline by the app's engine in headless Chrome.
- `picture.png`: the phase of F with the curve, light theme.
- `old/`: the earlier partial start (rings, z^(−36i)). It is replaced: see "Why not rings".

## 1. The adaptation

The key is B minor. The harp has five strings: D E F♯ A B, at arg F = 0°, 60°, 120°, 210°, 270°.

The meter is 4/4. Beats are quarters. ↑ and ↓ give the direction the line is crossed in. Grace notes are in brackets,
lower case. A grace is a string the phase must pass on the way, played soft and quick, like a harpist's slide.

**One statement (bars 1–4).** The beat each note starts on, from the statement's downbeat:

| Bar | Notes (onset in beats) | Grieg |
|---|---|---|
| 1 | (b↑) **B↓** 0 · **B↑** 0.5 · D↑ 1 · E↑ 1.5 · F♯↑ 2 · (f♯ e) D↓ 2.5 · (d e) F♯↑ 3–4 | B C♯ D E F♯ D F♯ |
| 2 | (f♯) E↓ 4 · D↓ 4.5 · (d) E↑ 5–6 · E↓ 6 · (d) B↓ 6.5 · (b d) E↑ 7–8 | E♯ C♯ E♯, E C E |
| 3 | (e d) B↓ 8 · B↑ 8.5 · D↑ 9 · E↑ 9.5 · F♯↑ 10 · (f♯ e) D↓ 10.5 · (d e) F♯↑ 11 · (a) B↑ 11.5 | B C♯ D E F♯ D F♯ B |
| 4 | (b) A↓ 12 · F♯↓ 12.5 · (e) D↓ 13 · (d e) F♯↑ 13.5 · A↑ 14–16 | A F♯ D F♯ A |

Each statement has 26 main notes and 21 graces. Grieg's rhythm is kept exactly: eighths, with quarters and the final
half note where he has them.

**Substitutions.** Every other note is Grieg's.

- **C♯ → B, in bars 1 and 3.** The tonic is struck again. The rhythm stays, and so does the climb D E F♯.
  - B C♯ D E is "crawl up from B". B B D E keeps the start on B and the climb.
  - D in place of C♯ would anticipate the D that follows.
  - A would turn the line downward.
- **E♯ C♯ E♯ → E D E, and E C E → E B E, in bar 2.** Grieg's bar 2 repeats the figure F♯ D F♯ a semitone lower, then
  a tone lower. With these strings, the figure sinks one string, then sinks again from the same upper note:
  F♯ D F♯ → E D E → E B E. The sinking sequence and the rhythm (8th, 8th, quarter, twice) are both kept.

**What the strings force: the graces.** None of these is a choice.

- **A third, such as F♯–D,** passes the string between (e). The harp has no way round it.
- **A melodic turn re-plucks the turning note.** Having crossed F♯ upward, the phase must cross F♯ again to go down.
- **Each statement's downbeat B is struck from above** (b↑ then B↓, a flam about 60 ms wide at the start and 25 ms at
  the end). This lets the C♯ substitute B↑ lead straight on to D without another re-pluck. The flam falls on the
  downbeat, together with the drum tick.

Directions follow Grieg's intervals. A leap over a fifth goes the shorter way round. Graces sit just before their main
note: 0.16 beat apart, which is 96 ms at the start and 44 ms at the end.

**The form.** Three statements, then a coda.

- The coda is three crashes, each a rolled run of a whole turn (five strings) landing on B:
  - crash 1 rises, at beat 48.19, on the drum;
  - crash 2 falls, at beat 50.19;
  - crash 3 rises, at beat 53.19, and is the last chord.
- The curve is 21.85 s long. The sound rings to about 24 s.

**Tempo.** The accelerando runs from quarter = 100 to 219.

- In time, tempo(t) = q₀ / (1 − (t − 0.4485)/36.67 s), with q₀ = 100 per minute. Every 16 beats the tempo is ×1.37:
  - beat 0: 100;
  - beat 16: 137;
  - beat 32: 187;
  - beat 48: 219.
- Inside each statement there is a ±6.4 % rubato: warped beats W(b) = b + 0.0642·(8/π)(1 − cos(πb/8)). Bars 1–2 are a
  touch broader and bars 3–4 a touch quicker. This puts bar 3's downbeat exactly one turn after bar 1's (see 2).
- The notes start at 0.45 s (statement 1), 8.89 s (statement 2), 15.40 s (statement 3) and 20.45 s (crash 1).

**Dynamics.** pp to ff.

- Main notes have velocity 0.30 + 0.60·(b/48)^1.15, ×1.12 on each bar's downbeat and ×1.05 on long notes.
- Graces are 0.4 × their note; the flam is 0.6 ×.
- Coda rolls go from 0.6 to 0.9, and each landing B is 1.0.
- In the preview, the RMS rises over the piece:

  | Section | RMS |
  |---|---|
  | Statement 1 | −37.8 dBFS |
  | Statement 2 | −33.6 dBFS |
  | Statement 3 | −30.0 dBFS |
  | Coda | −28.8 dBFS |

## What the engine must change (three small, per-example changes)

1. **The duration.** `sndListen` uses dur = clamp(2.2 + |turns|, 2.6, 7), which is 7 s here. The example needs its own
   duration of 21.85 s.
   - Give the curve shape an optional `listen: { dur, vel }` and let `sndListenShape` pass it on: use `s.listen.dur`
     when it is present.
2. **Louder, not softer.** Today `harpStep` softens fast notes (×(2.5/rate)^0.6 above 2.5 notes a second, ×14/rate
   above 14). Checked with the engine's own velocities along this curve, the main notes get softer as the piece speeds
   up:

   | Section | Engine as is | With `vel` |
   |---|---|---|
   | Statement 1 | 0.37 | 0.38 |
   | Statement 2 | 0.32 | 0.58 |
   | Statement 3 | 0.26 | 0.80 |
   | Coda | 0.14 | 1.00 |

   Proposal: `harpAlong(phi, la, dur, { vel })`, where `vel[k]` is the velocity of the k-th crossing (the proof shows
   that the crossings are exactly the score's notes, in order).
   - When `vel` is given, it replaces the rate-based velocity.
   - It also turns off the "above 24 a second only the Ds" thinning. The example's density is designed, and it stays
     under 24 a second anyway: the proof found no note dropped.
   - The pointer's harp is unchanged.
   - The cost is about six lines in `harpStep` (an `o.vel` value) and three in `harpAlong` (a crossing counter).
3. **Optional: the tick time.** `sndSample` puts a cut tick at the sample after the crossing, on a 23.7 ms grid here,
   so the drum lands 8 to 25 ms late.
   - `Calc.argStep` already returns `at`, the point where it failed. Placing the tick at
     (j − 1 + |at − z_{j−1}| / |z_j − z_{j−1}|) / 899 would make it exact.
   - Nice to have, not needed.

Nothing else changes. The preview was rendered with changes 1 and 2 applied in the page: each note was played through
`Sound.harpNote` at the times and ln|F| the proof found, with the `vel` list, and each tick through `Sound.cueTo('cut')`.
That is exactly what the proposed `harpAlong` would schedule.

## 2. The function and the curve

**F(z) = z^(−1+24i).** It is one catalog step: `{ type: 'powa', params: { alpha: '-1+24i', cut: 174.7011, k: 0 } }`.

arg F = −θ + 24 ln r. The phase lines are tight logarithmic spirals, one colour cycle a turn. In the picture they read
as a whirlpool of rings tightening into 0.

**Why the curve is a spiral, and why it accelerates by itself.**

- F(λz) has the same phase as F(z) for λ = e^(−π/12)·e^(−4πi), which is a scaling by 0.77.
- The curve goes round 0 clockwise, two turns a statement. Each statement is the previous one scaled by 0.77 about 0:
  its path in log-polar coordinates is the same, shifted.
- Listen along plays the curve at constant speed, so a copy 0.77 times as long is played 1.30 times faster.
  The accelerando is the shrinking spiral: r goes from 1.53 to 0.54.
- The generator solves for the curve with exactly this property. Given the target phase Φ(t) of the score, it requires
  e^u |w′| = V (constant speed, w = ln r + iθ) and integrates θ(t) by RK4, taking the clockwise root.
  - V = 1.5892 is set so that a statement is exactly 2 turns.
  - The rubato ε is set so that bar 3's downbeat is exactly 1 turn.
  - The angle reached at beats 8, 16, 24, 32 and 40 is exactly 1, 2, 3, 4 and 5 turns.
  - The speed is never infeasible (0 steps).

**The branch cut is the drum.**

- The cut ray is at 174.7°, through every downbeat of bars 1 and 3. The curve crosses it once a turn, so the cut tick
  is a drum on those downbeats: 6 ticks.
- Crash 1 is placed 0.37 eighth late, so that it lands on the 7th crossing: the drum with the first crash.
- At the cut only |F| jumps, by e^(48π). arg F is continuous because the real part of α is an integer. The melody
  never jumps; the tracker reports the jump, which gives the tick.

**The register is orchestration.**

- ln|F| = −ln r − 24 θ_p, with θ_p in (174.7° − 360°, 174.7°]. It changes sign on the ray θ = 0, which is where the
  curve is on the downbeats of bars 2 and 4.
- The register is the centre shift 0.5·tanh(ln|F|/2.5):

  | Bars | ln|F| | Register | Role |
  |---|---|---|---|
  | 1 and 3 | about −70 | −0.5 octave, every main note | the creeping phrase, low |
  | 2 and 4 | about +70 | +0.07 to +0.5 octave | the answer, high |

- The switch takes about a third of a beat, around the downbeat.
- ln|F| stays within ±78 along the curve, as it must, because the GPU computes z^α in float32: the limit is ±88.
  So 2π|β| must stay under about 170. That is why β is 24 and not larger.

**Storing it as an example.**

- The curve is a `curve` shape (Freehand), `{ kind: 'curve', pts }`. 1200 points with 4 decimals is 21 KB of JSON. The
  proof passes at 1200 points (worst 9.8 ms) and at 800 points (13 KB, worst 12.6 ms).
- Proposed EX entry, `example.json`:

  ```
  { name: $t('In the Hall of the Mountain King'), tex: 'w=z^{-1+24i}',
    blurb: $t('Grieg (1875) on the phase harp. …'), view: { cx: -0.05, cy: 0, s: 215 },
    shapes: [{ kind: 'curve', pts: [...1200 points], listen: { dur: 21.8466, vel: [...159] } }],
    steps: [{ type: 'powa', params: { alpha: '-1+24i', cut: 174.7011, k: 0 } }] }
  ```

  Open it on the Phase view, Plain pattern (the picture).
- To keep the page small, the 1200 points could instead be built at load by a 3 KB port of `make.js`'s ODE. Not done:
  the points are simpler and exact.

## 3. Proof (`prove.js`; `proof.json`)

**What it runs.** It runs the app's own code in node:

- F is `CX.pow` from `src/cx.js` (the `powa` step's f);
- the samples come from `sndSample`, copied from `app.js` (900 points uniform in arc length, `Calc.argStep` from
  `src/calc.js`, and a "jump" makes a cut tick);
- the harp is the source text of `src/sound.js` from `HARP_TH` to the end of `harpStep`, evaluated unchanged and driven
  as `harpAlong` drives it, with the example's duration. `harpNote` is replaced by a recorder.

**Results**, for `curve.json`:

- **Notes:** the score has 159 (81 main, 78 graces), and the engine plays 159.
  - The sequence is the same: every string and every direction, in order. Nothing extra, missing or reordered.
  - Worst onset error: 7.2 ms (`example.json`: 9.8 ms).
- **Cut ticks:** 7 expected, 7 found, at
  0.45, 5.12, 8.89, 12.49, 15.40, 18.16 and 20.45 s. Errors: +13, +8, +24, +25, +11, +15 and +12 ms. These are the
  app's sample grid (23.7 ms): see change 3.
- **Low Ds:** 23 up, 19 down; net arg F is 4.12 turns.
- **The register:** 82 notes low, 72 high, 5 in between (all graces at the switch).
- **The sung note:** none. The curve is open and crosses the cut, and the singer needs a closed curve with no cut. The
  ending is the three crashes, the first with the drum.

## 4. Preview and picture

- **`preview.m4a`:** the engine's own sound, rendered offline in headless Chrome (`Sound.render`, the worklet, seed 7).
  - Peak −13 dBFS.
  - The loudness rises over the piece, as in the table under Dynamics.
  - Nobody has listened to it on a phone.
- **`picture.png`:** the app's phase portrait of F, light theme, Phase view, Plain pattern, with the curve and the cut
  handle at 174.7°.

## Strings for the example (EN / RU)

- Name: "In the Hall of the Mountain King". Russian: «В пещере горного короля».
- Blurb, EN: "Grieg (1875) on the phase harp. The curve spirals into z^(−1+24i): Listen along plays it faster and
  louder as it goes in, and the branch cut is the drum."
- Blurb, RU: «Григ (1875) на фазовой арфе. Кривая закручивается в спираль к z^(−1+24i): «Слушать вдоль кривой»
  играет её всё быстрее и громче, а разрез — это барабан.»
  - It uses the glossary's terms: «разрез» and «Слушать вдоль кривой».
  - It still has to be added to `notes/i18n/ru/v152-seasong.json` by whoever merges; I write only under `sea-song/`.
- Guide (Sound section), one sentence, EN: "The example In the Hall of the Mountain King is one curve: at constant speed
  each turn of its spiral is shorter, so Grieg's theme speeds up by itself."
  RU: «Пример «В пещере горного короля» — одна кривая: при постоянной скорости каждый виток спирали короче, поэтому
  тема Грига ускоряется сама.»

## Why not rings (the earlier start)

The earlier start used rings, F = z^(−36i):

- the arg depends on r only;
- ln|F| = 36θ swings by 226 over one turn, beyond float32. The GPU picture breaks there and the register is pinned;
- its curve kept its radius, so nothing pulled it inward.

## Open

- Nobody has listened to it.
- The grace slides are many: 21 a statement, forced by the five strings. Most are re-plucks at melodic turns, and they
  are soft and short.
- Engine changes 1 and 2 are needed before the example sounds as in the preview.

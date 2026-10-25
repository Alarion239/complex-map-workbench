# Choice: "In the Hall of the Mountain King" example

Decided 2026-10-24. Judged: `whirlpool/PROPOSAL.md` and `islands/PROPOSAL.md`. (`free/` has no proposal and was not judged.)

## Decision

**Whirlpool, as proposed.** F(z) = z^(−1+24i), with one open curve that spirals in toward 0 (`whirlpool/example.json`).
No graft: I tried one (see below) and it made the curve less robust for little gain.

## Why

| | Whirlpool | Islands |
|---|---|---|
| Notes equal the score (app's 900 samples) | yes, 159 of 159, worst onset 7 ms (9.8 ms for the stored 1200 points) | yes, 160 of 160, worst onset 11.6 ms |
| Same notes with other sampling (M = 600, 750, 901, 1000, 1200, 1800, 3600) | **yes, every M**, also after 3-decimal rounding and 2e-4 jitter; onsets within 11 ms | **no**: 901 samples drop 2 notes, and 750 and 600 drop 2 to 6; 1e-4 jitter moves onsets by 50 ms |
| Closest turn of arg F to a Schmitt edge | 13.4° | 4.9° |
| Cut ticks | 7, all intended (the drum), the same 7 at every M | none |
| Picture | a whirlpool of phase spirals with the curve winding in: clear and article-grade | a tangled knot at the pole with long spikes (the proposal says it is not ready) |
| Stored size | 1200 points, 21 KB; one catalog step (`powa`) | 9119 points, 150 to 200 KB |
| Engine changes | `listen {dur, vel}`, plus an optional exact tick time | the same, plus closed freehand curves |
| Register | bars 1 and 3 low, bars 2 and 4 an octave higher (fixed by F) | rises gently over the piece (better) |
| Turn re-plucks | soft graces 0.3 to 0.16 beat before the next note | flams 30 to 50 ms after the note (better masked) |
| Ending | three rolled B-minor crashes landing on B; the drum on the first | three falling strums, a rising strum, then the loop sings D5 |

The sampling sweeps can be re-run with `choice/sweep_whirlpool.js` and `choice/sweep_islands.js`. They use the app's
`Calc.argStep` sampling and the harp source from `work/xvsea/src/sound.js`.

- **Islands fails the robustness rule.** Its route passes within 0.015 of the triple pole. A 900-sample chord is
  0.0146 long there, so whether a quick turn is heard depends on where the samples land. It passes at exactly 900, by
  luck.
- **Whirlpool's accelerando comes from the geometry.** Each statement is the one before it scaled by 0.77 about 0.
  Listen along plays the curve at constant speed, so each turn is played faster. Its proof, re-run here, matches the
  proposal's figures.

**The music is the same in both.** Both proposals chose the same substitutions, and I agree with them:

- **C♯ → B, repeated** (bars 1 and 3). The pulse of five eighths and the climb D E F♯ stay.
- **E♯ C♯ E♯ → E D E, then E C E → E B E** (bar 2). Grieg's answer sinks twice, and here it still sinks twice from
  the same top note. With these strings, every pitch is its nearest string or keeps the contour.

The harp forces about 21 soft extra notes a statement: re-plucks at turns, passing notes inside thirds, and the
downbeat flam. Nothing comes from the film theme or from any modern arrangement.

**Known trait: the register alternates.** On z^(−1+24i), ln|F| is about ±70 and the register tanh is saturated. Bars 1
and 3 (the creeping phrase) sound low, and bars 2 and 4 (the answer) an octave higher. Pitch classes are exact, and the
effect reads as a call and an answer. It cannot be tuned away without changing F. Listen for it on the phone.

**The graft I tried.** I moved whirlpool's turn re-plucks to just after their note, as islands does, by patching the
generator in scratch:

- at 0.08 beat, the curve lost 12 notes;
- at 0.125 beat, it passed at 900 samples, but failed at 600 and its worst onset rose to 16 ms.

The gain was small (a re-pluck 75 ms after its note instead of 120 ms), so I did not adopt it.

Optional and safe: if listening shows the re-plucks as extra notes, lower the turn re-plucks' velocity from 0.4× to
0.3× in `make.js`. Only the `vel` list changes, not the curve; re-run `prove.js` afterwards.

## What the build must do

**1. The example**

- Copy it from `whirlpool/example.json`: its 1200 points and its `listen` block.
  - `name: $t('In the Hall of the Mountain King')`
  - `tex: 'w=z^{-1+24i}'`
  - `view: { cx: -0.05, cy: 0, s: 215 }`
  - `steps: [{ type: 'powa', params: { alpha: '-1+24i', cut: 174.7011, k: 0 } }]`
  - `shapes: [{ kind: 'curve', pts, listen: { dur: 21.8466, vel: [159 values] } }]`
- Open it on the Phase view with the Plain pattern, as in `whirlpool/picture.png`. Use the fields `loadExample` really
  reads (`rightMode`, `dc` and so on). The `main: 'phase'` in example.json is not one of them.
- Check at phone width, in light and dark:
  - the whole spiral is in view (s = 215 is a desktop scale);
  - the curve reads over the dense rings near 0;
  - the cut handle's label covers nothing.

**2. The tempo: the example needs its own duration**

- Listen along must last **21.85 s**, not clamp(2.2 + |turns|, 2.6, 7) = 7 s. Carry `s.listen` through
  `sndListenShape` and `sndListen`, and use `listen.dur`.
- Tempo goes from quarter = 100 to 219, quickening ×1.37 every 4 bars.

**3. The dynamics: `harpAlong(phi, la, dur, { vel })`**

- `vel[k]` is the velocity of the k-th crossing. It replaces the rate-based softening and the "only Ds above 24 a
  second" rule, for that playback only. The pointer's harp is unchanged.
- Today's rule makes the piece get softer as it speeds up (0.37, then 0.32, then 0.26, then 0.14). With `vel` it grows
  from pp to ff (0.38, then 0.58, then 0.80, then 1.0).

**4. A guard, so the data never plays on the wrong curve**

- Use `listen` only when:
  - the shape is unedited (drop `listen` on any edit or transform of it);
  - the chain is exactly the example's single `powa` step with these parameters;
  - the crossing count equals `vel.length`.
- Otherwise today's rules apply.

**5. Recommended, small and general: an exact cut-tick time**

Ticks now land on the 23.7 ms sample grid, 8 to 25 ms late against the downbeat. Place each tick at the failing
step's `at` (`Calc.argStep` already returns it), as fractional sample time.

**6. A test**

- Port `whirlpool/prove.js` into the node tests, run against the built example. It must give:
  - 159 crossings with the same strings, directions and order;
  - onsets within 15 ms;
  - 7 ticks.
- Add the sampling sweep from `choice/sweep_whirlpool.js` (M = 600 to 3600, all equal).
- Change no baselines, `accepted.json` or golden images.

**7. Strings, EN and RU, in `notes/i18n/ru/v152-seasong.json`**

`make_ru_table.py --strict` must report 0 unresolved.

- Name: «В пещере горного короля».
- Blurb, with the credit. EN: "After Edvard Grieg, Peer Gynt (1875), on the phase harp. The curve spirals into
  z^(−1+24i): Listen along plays it faster and louder as it goes in, and the branch cut is the drum."
- Use the glossary's terms: «разрез» and «Слушать вдоль кривой». Reuse the wording for "phase harp" that is already in
  `v152-sound.json`.

**8. The guide (Sound section)**

- Add one or two sentences and a link that opens the example. EN: "The example In the Hall of the Mountain King is a
  single curve. At constant speed each turn of its spiral is shorter, so Grieg's theme speeds up by itself; each time
  it crosses the branch cut, the drum sounds."
- Show the picture of the spiral with the cut. Nothing may open over the work area uninvited.

**9. Listen before shipping**

- Nobody has heard it yet. Render the built app's own Listen along offline (`test/sound_rec.js`), as AAC, and delete
  the WAV.
- Compare it with `whirlpool/preview.m4a`: the same notes and onsets, and the RMS rising about 9 dB.
- Then do one listening check on the Android phone. Is the theme instantly recognizable, and do the extras stay in the
  background?

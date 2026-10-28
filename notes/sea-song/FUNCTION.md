# The Mountain King as a function (Hear the function, 2026-10-28)

The example "In the Hall of the Mountain King" is not a composed curve with its own strings. It is a function whose
own colour lines play Grieg's theme through the fixed sound map: a note each time arg F crosses one of the n = 12
lines, pitch class 12k/n semitones above D; loudness from |F|; a crack at a branch cut. Nothing in the app knows the
score. `src/seasong.js` holds only the chain, the view and the Listen-along path. `tools/mk_function.js` makes it and
`test/t_seasong.js` checks it. The old tool (`tools/melody_curve.js`, the harp's score,
`test/fixtures/seasong_score.json`) is kept for the record. `test/t_heard.js` keeps the old curve as a fixture
(`test/fixtures/heard/mountain-king-curve.json`), because the prototype's golden logs were recorded on it.

## The function (round 2: the theme wheel)

F = H(u(z)), two custom steps:

* **u = ((z − a)/(1 − a·z))², a = 0.0945.** This is a disk automorphism, squared. It maps |z| = 1 onto |u| = 1 twice,
  so each lap of the circle plays the theme twice. It turns u fastest near z = a, so the statement through z = 1 is
  faster: 5.35 s, then 4.20 s at 250 px/s and view.s = 380. The accelerando is the Möbius map's.
* **H(u) = c · u^s · Π_j [((u − p_j)/u) / (1 − u/p_j*)]^(D_j/12).** There are 25 Apollonius pairs, one per melodic
  step j of D_j semitones. Each pair puts p_j just inside |u| = 1 (0.5 px at 380 px a unit) and p_j* = 1/conj(p_j)
  just outside. On the circle:
  * The pair's factor has modulus 1.
  * Its argument steps by D_j semitones where u passes between p_j and p_j* (the inscribed-angle theorem), and turns
    steadily elsewhere. u^s, with s = ΣD_j/12, cancels every steady turn.
  * So arg H is a staircase: flat on each note, 0.35 of a line past its line, with a sharp step at each note's start.
  * |H| is constant (|ln|F|| < 0.02 on the path), so no band edge is crossed and no repeat plays.
* **The steps sit on a grid of 32 quavers a turn of u.** The 26th step, from the last A down to the next B, is
  u^s's own branch cut. Its cut is rotated to come 82 ms of path time before the downbeat. The fixed cut figure (the
  crack, the held note again at +12 ms, the new note at +82 ms) then puts the downbeat B on the beat. The crack is a
  drum pickup.
* **The typed form groups the pairs by |D|.** One principal log covers a group's inner points and one its outer
  points. A group is split when its base would turn more than 1.6π along the circle, because a principal log must
  never cut the path. That makes 29 logs and one exp in F, and no transcendental function in u. It is 27 + 1786
  characters.
* **Listen along** runs two laps of |z| = 1 anticlockwise. It starts one quaver before the first downbeat and ends
  0.12 s before the fifth cut, inside the last A: 19.13 s, four statements, four cracks.

The picture (`function.png`, the design's own render) is a pinwheel of colour wedges centred near z = a. Each wedge
crossed on the circle is a note. The wedges are wider on the z = −1 side, where the theme is slower. The round
patches off the circle are where the grouped logs change branch, away from the path.

## How it sounds (measured)

The typed chain was compiled by the app's parser and rendered by the prototype's final-notes and final-glide on the
app's `src/sound.js`, through the stress harness (`perfwin/sound/impl/mk-choose`, `final.js`, `mk-final.wav`).

| | final-notes | final-glide |
|---|---|---|
| theme notes heard, in order | 104 of 104. Edit distance 4: the cut figure's re-struck A before each downbeat | audio pitch class 94 % of notes (the window between onsets) |
| audio pitch class at each heard onset | 100 % | |
| lines inside a leap | a rake into the note: median 10 ms before it, max 25 ms, at the note's level | none (one voice) |
| rhythm | statements 5.35 / 4.20 / 5.35 s (quavers 173 then 128 ms). Within a statement the Möbius tempo swells gently: residual 20 to 29 ms sd from straight quavers | |
| events | 4 cracks, each 82 ms before its downbeat B; 0 repeats, 0 merges, 0 clicks | 4 cracks |
| loudness | note level sd 2.8 dB, no crescendo; LUFS-I −39.9, peak −21.4 dBFS | LUFS-I −45.0 |

The design was chosen from two (perfwin/sound/impl/mk-choose/README.md).

* **Analytic, round 2.** Round 1's all-pass staircase plus a dipole comb on |F|, which makes the passing lines of a
  leap about 11 dB quieter.
* **Geometric, round 2.** This wheel.

They were re-measured the same way. The comb's quiet graces are real, but it re-strikes held notes 25 times: a
tremolo on the closing A. Its onsets are also 26 to 66 ms late, and it keeps round 1's uneven tempo. That tempo moves
from 200 ms to 131 ms quavers inside a statement (residual 145 ms sd).

The wheel has these strengths:

* Every note is on its beat.
* There are no repeats.
* The downbeat B arrives on time instead of as the cut's muted note.
* It keeps the same accelerando with steady quavers.

Its cost is 29 logs against round 1's 26 logs and 2 exps.

## Known limits

* The lines crossed inside a leap sound at full level, as a 10 to 25 ms rake. The comb that quiets them (analytic
  round 2) re-strikes held notes, because |F| dips while the colour holds. Its dips would also have to be about 10 ms
  wide to fit the wheel's sharp steps.
* There is no crescendo: |F| is constant. A tried z^(iβ) gave +2 dB and band-edge repeats.
* The tempo is the path's length in pixels: at a smaller view (fit on a small pane) it plays faster.
* Not checked: the shader's time on Windows (CPU per evaluation in the app's parser is the same order as round 1's,
  noisy with a CI job running), and whether the order cue treats the branch points 0.5 px from the circle as zeros or
  poles.

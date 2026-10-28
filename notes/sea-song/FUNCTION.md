# The Mountain King as a function (Hear the function, 2026-10-28)

The example "In the Hall of the Mountain King" is no longer a composed curve with its own strings. It is a function
whose own colour lines play Grieg's theme through the fixed sound map (a note each time arg F crosses one of the
n = 12 lines, pitch class 12k/n semitones above D; loudness from |F|; a crack at a branch cut). Nothing in the app
knows the score: `src/seasong.js` holds only the chain, the view and the Listen-along path, made by
`tools/mk_function.js`, and checked by `test/t_seasong.js`. The old tool (`tools/melody_curve.js`, the harp's score,
`test/fixtures/seasong_score.json`) is kept for the record; `test/t_heard.js` keeps the old curve as a fixture
(`test/fixtures/heard/mountain-king-curve.json`) because the prototype's golden logs were recorded on it.

## The function

F = g(u(z)), two custom steps:

* u = z²·e^{i(α + 0.45(z + 1/z + (z² + z⁻²)/4 + (z³ + z⁻³)/9))}. On |z| = 1, |u| = 1 and u turns twice a lap with
  its angle warped (2θ + α + 0.9 Σ cos nθ/n²): at constant speed each lap plays the theme twice, the second time
  faster (5.98 then 7.62 quavers a second at view.s 380).
* g(u) = e^{iρ}·u^{s − iβ}·Π_{k=1..25} ((1 − q e^{−iθk} u)/(1 − q e^{iθk}/u))^{e_k}, q = 0.995. On |u| = 1 each
  factor has modulus 1 and argument e_k·2·arg(1 − q e^{i(t − θk)}), a smoothed sawtooth stepping at θk; with
  s + Σ e_k = 0 the slopes cancel and arg g is a staircase: flat on each note, a fast step (about 20 ms) at each
  note's start. The 26th step, the downbeat (A down to B), is u^s's cut at u = −1: the crack, the drum.
  u^{−iβ} (β = 0.25) has modulus e^{β Arg u}: |F| grows through each statement and falls at the cut, without
  moving arg F.
* Each plateau rests 0.3 of a line past the line it crossed. The e_k, s and ρ are least squares on the plateaus.

Typed: 59 + 1581 characters; per pixel one exp and 26 principal logs (and 25 divisions) in F, one exp in u.

## How it sounds (measured)

The typed chain through the app's parser, rendered by the prototype's final-notes and final-glide on the app's
src/sound.js (perfwin/sound/impl/mk-final; 19.1 s, four statements):

| | final-notes | final-glide |
|---|---|---|
| theme notes heard, in order | 100 of 104; the four downbeat Bs sound as the cut's muted note after the crack | 104/104 from the audio |
| extra notes | 2.44 a note: the lines passed in leaps and the turning notes, a 21 ms grace slide, 3.3 dB under in energy | none |
| rhythm | onsets 26.5 ms after the slot middle, sd 6.2 ms | |
| events | 4 cracks, 0 repeats, 0 merges, 0 clicks | 4 cracks |
| loudness | LUFS-I −38.7, peak −20.9 dBFS | LUFS-I −44.7 |

Chosen from two designs (perfwin/sound/impl/mk-analytic, an all-pass staircase with an accelerating warp; and
mk-geometric, a ring of 25 Apollonius pairs of branch points, 51 logs, with the cut as drum and z^{−iβ} as crescendo):
the analytic one, for its accelerando, quieter grace notes and half the logs, with the geometric one's drum and
crescendo.

## Known limits

* The accelerando restarts each lap (two accelerating passes, not one long one).
* The tempo is the path's length in pixels: at a smaller view (fit on a small pane) it plays faster.
* Not checked: the picture, the shader's time on Windows, and whether the order cue treats the branch points (0.5 %
  of the radius off the circle) as zeros or poles.

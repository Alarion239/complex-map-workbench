# The zeros-and-poles step (user request, 2026-10-22)

The user asked "Can we define polynomials by dragging their roots?" and chose **Zeros and poles**. The step is the
catalog entry *Zeros and poles* (group Polynomial & custom, id `zp`):

  f(z) = a ∏ (z − ζ_k) / ∏ (z − p_j)

with the leading coefficient a, the zeros ζ₁, ζ₂, … and the poles p₁, p₂, … as parameters (`a`, `zeros`, `poles`;
the lists are comma-separated complex values, stored as text like every other parameter, empty allowed).

## Where the zeros and poles are dragged

In the plane the step acts on, its input plane: X when it is step 1 and the whole chain shows, the left plane when
the step is focused (any X surface that is a plane: Plane, and the Phase portrait, where the zeros and poles sit on
the colour wheel's singularities). Not in the merged deformation (X is hidden there) or on the globes.

- **Marks**: a zero is a filled dot in the zero ink (`--zero`) with a pip; a pole is a cross in the pole colour
  (`--pole`); labelled ζ₁, ζ₂, … and p₁, p₂, … (the card's names; target roots are z₁, z₂, … rings in a target colour,
  shape handles are white squares and circles). Hover and selection draw a ring.
- **Drag**: the press picks the nearest mark within 11 px (before cut handles, shape handles and tools). The value
  follows the pointer, snapped like shape handles (Snap on: the graph-paper grid), otherwise rounded to the decade
  below a pixel (`zpRound`: never more than a pixel off, so the card reads 1.27+0.55i, not 1.2734912…). Every move is
  `chainChanged(false)`: the step is rebuilt and the GPU gets new uniforms (the shader's signature counts only the
  numbers of zeros and poles, so a drag never recompiles). One undo step per gesture (commit on release).
- **Add**: Shift-click adds a zero, Shift-⌘-click (Shift-Ctrl) a pole, and the press goes on dragging it (one undo
  step); the card's **zero** and **pole** buttons add one at a free spot of the view (and focus the step if its input
  plane is not showing).
- **Remove**: drag one off the plane (it waits faded at the edge with "Release to remove ζ₂"), or select it (a click)
  and press Delete, or the × in its card field.
- **Card**: `a`, the two add buttons, then one field per zero and pole (typing updates the plane live; an emptied
  field drops out when it is left). The card's formula is the factored form, a\,\frac{z(z−1)^2}{(z−i)(z+i)}, equal
  values as powers, x − r term by term (z + 1 + i, never z − (−1 − i)).
- **Menu**: a polynomial, rational or rational custom step has *Write by zeros and poles* (the roots of numerator
  and denominator, rounded to 12 digits where that keeps the map to 1e-9); a zeros-and-poles step has *Write by
  coefficients* (the exact expansion). Both are one undo step.

## Guarantees

Given as points, numerator and denominator are coprime unless a zero and a pole coincide **exactly**; such pairs
cancel (a removable singularity, filled in; the card says "A zero and a pole cancel at 1"). So the degree
max(#zeros, #poles) is exact: polynomial (entire, proper) with no pole, Möbius and injective at degree 1, proper
when there are more zeros than poles, constant for a = 0 or nothing left. The single inverse at degree 1 (Möbius or
affine); otherwise the reason. The natural domain lists the poles (up to three).

Evaluation is the paired product a ∏ (z − ζ_k)/(z − p_k) × the unpaired factors (CPU and GPU alike), so neither
product overflows alone (40 zeros over 40 poles at |z| = 1e9 stays finite); ∞ exactly at a pole.

## The natural path

`Funcs.zerosPolesNat` on the cancelled lists (natural-paths.md): with no pole, the roots path on exactly these zeros
(ζ₁, the zero of least modulus, slides from 0, the others fly in from −∞); with poles, the rational zoom path about
the zero of least modulus (zeros and poles fly in radially and never meet). The caption names the zeros ζ as the
card does and calls the zoom centre c (p names the poles).

## Rendering

The inverse renderer takes degree ≤ 2 exactly (AFF, MOB, QUAD, RAT2: `Inverse.stepOps`); higher degrees go forward
(SphereMesh) with the reason "rational map of degree 3 (the exact renderer inverts degree ≤ 2)". At infinity
(sphere.js `atInfOf`): ∞ with more zeros, a with as many, 0 with fewer. d/dz of the step is (P′Q − PQ′)/Q² of the
expansion (exact chain rule on the GPU).

## Tests

- `test/t_zp.js` (node, 156 checks): lists, evaluation, guarantees, TeX parses back to the map, natural paths (ends,
  first frames, analytic, never degenerate, the zeros' positions), inverse ops and preimages, d/dz, conversions,
  the GPU signature.
- `test/t_inverse.js`: zeros-and-poles cases in the catalog round trip.
- `test/glsl_test.js`: zp rows (CPU = GPU for f, the paths and d/dz) and key checks (values are uniforms, counts are
  structure); `test/glsl_inverse_test.js`: zp chains through the GPU inverse renderer. Both keep the old random
  sequences (zp is left out of their random pools and has its own rows).
- `test/zp_cmd.js` (CDP): handles where the values are; a drag at 60 fps with one chain signature (no recompile);
  exact per pixel against the truth at rest and with the pointer held mid-drag; undo/redo per gesture; Shift-click,
  Shift-⌘-click, drag off, Delete, the card's buttons and fields; degree 3 forward with its reason; the conversions;
  a focused step in a chain; the deformation (natural path, figure caption, 60 fps); light and dark.
- Quality suite: scene `zp_disc` ((z² − 1)/z by zeros ±1 and pole 0, of the disc |z − 1.2i| < 0.8, folded onto
  itself: RAT2, two sheets) with an exact truth, independently verified by `verify_truth.js`, and targets (IoU ≥ 0.999,
  hole and spill ≤ 0.001, parity ≥ 0.999) in tolerances.json.

## Results (2026-10-22)

t_zp 156/156; t_inverse 554/554 (zp in the round trip); t_natpaths, t_funcs, t_calc, t_gl_inverse and the other node
suites pass. GLSL parity 3.83 M values over 562 chains, 0 failures, key checks pass (zp rows alone: 349 k values);
GLSL inverse parity (walk 822 cases, clip, flip) pass. `zp_cmd.js` pass: exact at rest and mid-drag (0 of 5093 and
0 of 5250 robust samples wrong), drag 60 fps (p95 18.4 ms) with one chain signature, the deformation plays at 60 fps.
Quality suite PASS with targets enforced (zp_disc: IoU 1, parity 1). Paired perf (hover, scrub, scrub.morph,
image.default.m240, examples) PASS (an examples.13 compile spike at load 2.9 did not repeat on a quiet machine).
deform_nat_cmd, mv_views_cmd, morphfig_cmd, p3_accept_cmd, p3b_accept_cmd, curves_cmd, tour_cmd pass.
Screenshots (1440 x 900 unless named): `zeros-poles-shots/` (X → Y light and dark, after Shift-click adds, a focused
step in a chain, the deformation with and without a pole, the Phase portrait, the compact popover, a phone).

# Natural paths, the Paths toggle and all steps at once (user request, 2026-10-22)

The user: "Remove linear homotety. Make deformation lines togglable. What is natural path? I really like it, is there
room for improvement? Can we define polynomials by setting dragging their roots?" Then chose: more natural paths, all
steps at once, and zeros and poles for the dragging feature (that step is built separately; see "Zeros and poles").

## What a natural path is

The deformation plays a homotopy H_t from the identity (t = 0) to the step's map f (t = 1). A natural path is one
that respects what f is: H_t is analytic (conformal) for every t, so small squares stay squares all the way; it is
injective wherever f is; it uses f's own branch; and it ends exactly at id and at f (`Funcs.build(...).hom`,
`homTex` the caption's phrase). The straight line (1 − t) z + t f(z) has none of this (it is not analytic in general,
and folds), and is gone as an option: old saves with `hom: 'linear'` load on the natural paths.

## The paths (funcs.js; GLSL mirror in glsl.js `natPlan`)

| step | H_t | why |
|---|---|---|
| Möbius, affine, ×c, +c, 1/z | the one-parameter group F^t (unchanged) | |
| z^n, ⁿ√z, z^α | z^{1+(α−1)t} on the step's branch (unchanged) | |
| exp, log | (e^{tz} − 1)/t + t and its reverse (unchanged) | exp's path is the zoom below |
| sin, sinh, tan, tanh | f(tz)/t | **zoom**: f seen through a magnifier at 0 |
| cos | sin(t(z + π/2))/t − (1 − t)π/2 | zoom about −π/2, where cos′ = 1 |
| cosh | (cosh(p + t(z − p)) − √2)/t + (1 − t)p + t√2, p = arsinh 1 | zoom about p, where cosh′ = 1 |
| arcsin, arsinh, arctan, artanh | f(tz)/t (principal) | the inverse of the forward zoom; the cuts fly in |
| arccos | tπ/2 + e^{πit} arcsin(tz)/t | zoom about 0, arccos′(0) = −1 |
| arcosh | (arcosh(√2 + t(z − √2)) − p)/t + (1 − t)√2 + tp | zoom about √2 |
| Joukowski | coth((1 + t) arcoth z) = C⁻¹((Cz)^{1+t}), C = (z − 1)/(z + 1) | the power path in the Cayley plane: the unit circle closes onto [−1, 1] as a lens through ±1; cut [−1, 1] |
| inverse Joukowski | coth((1 − t/2) arcoth z); interior: coth((1 − t/2) arcoth z − πit/2) | the reverse family, on the step's branch |
| polynomial | a^t (z − t z₁) ∏_{k≥2} (1 − t + t(z − z_k)) | its zeros switch on: z₁ (least modulus) slides from 0, the others fly in from −∞; entire for every t |
| rational (with poles) | the zoom about p: (1 − t)p + t f(p) + f′(p)^{t−1}(f(p + t(z − p)) − f(p))/t | zeros and poles fly in radially about p (its simple zero of least modulus) and never meet |
| custom formula | the path of the catalog map it is (sin z, e^z, log z, a rational expression, ...) | else the straight line, and its caption says so |
| a constant, d/dz | the straight line (said so in the caption) | no natural path |

The zoom path in general: H_t(z) = (1 − t)p + t f(p) + f′(p)^{t−1} (f(p + t(z − p)) − f(p))/t. As t → 0 only the
linear part of f at p is seen (normalised to the identity), at t = 1 the whole map. Zeros, poles and cuts come in
from infinity, radially about p; since they are the images of distinct points under one similarity they never meet,
so H_t is never degenerate.

Why not the straight-line roots formula for rationals too: with poles, the zero sliding from 0 can meet a pole flying
in. (z − 1)/(z − 2) under a^t (z − t z₁)/(1 − t + t(z − p₁)) = (z − t)/(tz + 1 − 3t) collapses the whole plane to
one point at t = (3 − √5)/2 ≈ 0.38 (its determinant t² − 3t + 1 vanishes there). The zoom path cannot.

Numerics: the first frames of a play have t ≈ 1e-5, where sin(tz)/t, arcsin(tz)/t, ... cancel in float32 through
their log / exp forms. Both CPU and GPU switch to the odd Taylor series below |a| = 0.1 (`SER`, `cx_*S`), cosh's
difference is 2 sinh(p + e/2) sinh(e/2), arcosh's a log1p, and the rational zoom uses Taylor coefficients at p
(computed once in double) near p and the direct form farther out.

## Paths toggle

The live paths t ↦ H_t(z) are a labelled toggle button **Paths** in the docked transport bar (X → Y: the merged plane
and the merged globe), key **P** while the deformation shows in X → Y (drawing is off there; elsewhere P is still the
Point tool), and a palette entry. Saved as `S.morphPaths`. The figure dialog of the deformation has a **Paths** row
(Arrows / None), starting as on screen; None draws X's outline and the image only and drops the arrow sentence from
the caption.

## All steps at once

With two or more steps (no d/dz), the transport offers **One after another | All at once** (`S.homAll`, saved).
All at once: H_t = h_{n,t} ∘ … ∘ h_{1,t} with one t in [0, 1] (map mode 3 on the GPU: `chainHomAll`; `cpuMap` and
`morphState` on the CPU). The scrubber runs over [0, 1] with one tick, switching keeps the same moment (t rescales),
the live paths and the morph figure follow it, and the caption reads "the homotopy H_t = H^{(3)}_t ∘ H^{(2)}_t ∘
H^{(1)}_t, 0 ≤ t ≤ 1, that deforms every step at once: for f₁, …". A d/dz step is an operator, not a map, so a chain
with one deforms one step after another (the select is disabled with a tooltip).

## Zeros and poles

The step is built (catalog `zp`, notes/ui-design/zeros-poles.md). `Funcs.zerosPolesNat(a, zeros, poles, f)` gives a step defined by its zeros and poles its natural path (the roots
path on exactly its zeros when it has no pole, else the rational zoom path); the GPU side is `natPlan` with the
returned `nat` / `natData` (as the catalog's poly and rational steps do).

## Tests

`test/t_natpaths.js` (ends, continuity at the first frames, analyticity, Joukowski's circle, branches, never
degenerate, captions, the zeros-and-poles helper), `test/glsl_test.js` (CPU = GPU for every path and the all-at-once
rows, mode 6), `test/deform_nat_cmd.js` (migration, the Paths toggle, key P, palette, figure, all at once, Joukowski,
cos, a three-step chain and a rational in light and dark).

Results (2026-10-22): t_natpaths 242/242; GLSL parity 3.75 M values, 0 failures (glsl_test_adv: only its pre-existing
range-row failures, fewer than on v12); deform_nat_cmd, mv_views_cmd, morphfig_cmd pass; quality suite PASS (targets
enforced); paired perf (examples, scrub.morph, morph.open, morph.play.views) PASS. Playing the new paths with Paths on
(`test/deform_nat_fps_cmd.js`: Joukowski, cos, a rational, three steps at once, a quintic) runs at 60 fps, the merged
plane's synchronised render 6-9 ms. Screenshots (1440 x 900, light and dark, t = 0.5): `natural-paths-shots/`.

## Review fixes (2026-10-22, round 2)

- **cos** zooms about +π/2 (cos′ = −1): H_t = (1 − t)π/2 + e^{iπt} sin(t(z − π/2))/t. Its critical points π/2 ± π/(2t)
  stay outside 0 < Re z < π (the strip arccos maps onto), so that strip never folds; it turns by π during play. The
  strip (−π, 0) now folds mid-play instead (no single centre keeps both).
- **Joukowski** uses arg Cz ∈ (−π/2, 3π/2): inside the unit disk H_t = tanh((1 + t) artanh z − iπt/2), continuous and
  injective there; the cut is the lower unit semicircle. Not conjugation-symmetric inside the disk (the cut is one-sided).
- **Polynomials and rationals** go by what the map is (ratPath): degree 1 the Möbius group (as the affine/Möbius steps),
  a (z − c)^n the power path (as z^n), c·J the Joukowski path times c^t, else the zoom path. The roots path is gone (it
  folded regions where f is injective, let zeros meet, and broke real symmetry). Zoom centre: real coefficients take a
  real centre with f′(p) > 0 first (the path commutes with conjugation) unless f(p)/f′(p) is huge (float32), else the
  simple zeros by modulus. Captions claim only what holds: poles and critical points fly in along rays from p.
- **Zeros and poles**: the zoom centre is ζ₁ itself (exact, f(c) = 0), so dragging another zero never makes the path
  jump; every zero equal and no pole: the power path. a = 0 is the constant 0 everywhere (poles removable). At most 24
  zeros and 24 poles.
- **Custom formulas**: any other analytic formula gets the generic zoom path about the first of 0, 1, −1, 2, … with no
  cut through it (a real map: a real centre, f′ > 0 first); the GPU inlines f at p + t(z − p); below an adaptive
  t₀ ≥ 10⁻³ (float32 cancellation of f(x) − f(p) bounded by 10⁻⁴) the blend z + (t/t₀)(H_{t₀} − z). Only non-analytic
  formulas and constants keep the straight line.
- **Captions, all at once / in turn**: each H^{(k)}_t acts on u (all at once) and names f_k, p_k, c_k, a_k.

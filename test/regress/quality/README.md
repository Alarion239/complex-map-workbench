# Image-quality regression suite

This suite checks that a code change does not make the right-plane image worse. It renders fixed scenes through the
real app (`dist/test.html`) in headless Chrome with real WebGL2 (ANGLE on Metal). For every pixel of the right-plane
canvas it compares the result with **exact ground truth** computed on the CPU from the known inverse of the scene's map.
It then checks the metrics against a stored baseline using documented tolerances.

It is the gate for the planned change to unbounded regions: meshing on the Riemann sphere, view-dependent adaptive
refinement, a spherical checkerboard and exact per-pixel inverse rendering. Today's cut-off images of unbounded regions
must show up as **improvements**. Every other scene must stay as it is.

## Run it

```sh
test/regress/quality/run.sh                 # build dist/, render 63 runs (~2.5 min), compare with the baseline
test/regress/quality/run.sh --no-build      # use dist/ as it is
test/regress/quality/run.sh --only logH,joukowski.pattern   # a subset (only those runs are gated)
test/regress/quality/run.sh --only zi_H,expH,e1z_disc,e1z_custom,exp_far_disc,ez2_disc,healed_cut   # the SPEC 12.4 scenes (~75 s)
python3 test/regress/compare.py             # perf + quality verdicts together, after both suites have run
node test/regress/quality/verify_truth.js   # independent check of the SPEC 12.4 scenes' truths (~6 s, no browser)
node test/regress/quality/verify_truth.js --selftest   # the metrics on synthetic renders (~40 s, 165 checks)
python3 test/regress/test_compare.py        # the gates themselves (compare_quality / compare_perf) on synthetic results
```

The script exits with **0** on pass, **1** on fail and **2** on a setup problem (build failed, server down, no baseline).

You need `node` (18 or later), `python3`, Google Chrome (set `CHROME=/path` if it is not in `/Applications`), and the
static server for `dist/` at `http://localhost:8793` (pass `--base-url URL` to use another one). The suite does not
start or stop that server. Each invocation starts its own Chrome with a fresh temporary profile and removes the profile
afterwards.

Each run writes these files to `out/latest/`:

| file | contents |
|---|---|
| `metrics.json` | all metrics, the view actually rendered and the render's sha1 (the input of `../compare_quality.py`) |
| `compare.json` | the verdict as JSON (pass, failures, improvements, warnings) |
| `index.html` | every render, its classification map and its golden diff side by side. Open it to see *where* a metric moved |
| `renders/<run>.png` | the `#canvasR` pixels as rendered |
| `maps/<run>.png` | green: correct fill. White: correct background. **Red: hole**. **Blue: spill**. **Purple: wrong checker parity**. **Orange: fill in a wrong colour** (SPEC 12.4 runs). Grey: the excluded boundary band. Yellow: strokes and annotations. Pale green: fill that was not scored for parity |
| `golden_diff/<run>.png` | bounded controls only: pixels that differ from the golden PNG, in red |

Runner options (`node run_quality.js ...`):

| option | effect |
|---|---|
| `--out DIR` | write the run somewhere other than `out/latest` |
| `--only a,b` | run a subset |
| `--stable-ms 1500` | how long the canvas must stay unchanged before it is captured |
| `--timeout-ms 30000` | the longest wait for a scene to settle |
| `--reeval DIR` | recompute metrics from saved renders, without a browser |
| `--accept DIR` | make DIR the baseline (see below) |
| `--override JSON` | sensitivity checks only (see below) |

## How a run works

1. **Scenes** (`scenes.js`). Each scene is a saved app state and the exact truth of its image. Every scene is rendered
   in two variants:
   - **mask**: pattern `solid`.
   - **pattern**: pattern `checker`.

   Both variants use these display settings: alpha 1, coordinate net off, unit circle off, view outline off, region
   outline off, mesh quality 240, light theme, both panels shown, viewport 1440×900 at dpr 1. With these settings the
   right plane is 410×516 px.

   The state also pins the **right view** (`rightView`), so a change in auto-fit can never move a scene. It pins the
   **meshing window** too (`clipWin` = the left view's box).
2. **Seeding.** Before any app script runs, the runner writes the state to the localStorage key
   `complex-map-workbench-v1:qreg-<run>`. It then opens `test.html?ns=qreg-<run>`.
3. **Settling.** The runner hashes `#canvasR` every 200 ms. It reads the canvas through a scratch canvas, so the app's
   own canvas is never read back repeatedly. The scene counts as settled when all three hold:
   - the hash has not changed for 1.5 s;
   - the right LED (`#rightLed`) is not `busy` (the CPU fix-ups are done);
   - `GLR.frameStatus().pending` is false.

   A scene that has not settled after 30 s is a failure. Today every scene settles about 0.6 s after navigation.
4. **Capture.** The runner reads the pixels of `#canvasR`, the CSS colour tokens and the view.
   - It reads the view from the existing test hook `__cmwW2S` and checks it against the pinned view. They must agree to
     0.5 px, or the run fails.
   - If the hook disappears, the runner falls back to the pinned view and adds a warning.
   - It also cross-checks the pattern cell size against the app's own rule (`Region.bboxOf`, `Axes.niceStep`). If they
     disagree, it adds a warning.
5. **Truth** (`scenes.js`, `metrics.js`). This code is independent of the app's code.
   - For a pixel centre `w`, `pre(w)` lists every candidate preimage `z`, across all branches. `w` is inside the true
     image when some candidate lies in the source region (`region(z)`, the exact level set).
   - `dF(z) = |F'(z)|` gives the local scale.
   - The signed distance to the true boundary is exact where a closed form exists (`sdf`). Otherwise it comes from a
     Euclidean distance transform of the truth mask, computed on a grid padded by 6 px, so boundaries just outside the
     view count.

## Scenes

Views are written as (centre, px per unit). Every scene runs as `<name>.mask` and `<name>.pattern`.

**Unbounded regions.** Today these are cut off somewhere. The planned change should fill them to the view edges.

| scene | map and region | exact truth | right view | baseline today |
|---|---|---|---|---|
| `logH` | log z (cut 180°) of the upper half-plane | 0 < Im w < π | (−0.18 + iπ/2, 97): the app's auto-fit | perfect |
| `logH_out4` | same, zoomed out 4× | 0 < Im w < π | s = 24.25 | strip cut off at both ends; ragged left end |
| `logH_out16` | same, zoomed out 16× | 0 < Im w < π | s = 6.06 | strip covers about 18 % of its true length |
| `exp_strip` | e^z of the strip \|Im z\| < π/2 (formula) | Re w > 0 | (2, 40) | perfect |
| `cayley_H` | (z − i)/(z + i) of the upper half-plane | \|w\| < 1 | (0, 190) | perfect |
| `cayley_H_zoom1` | same, 64× zoom on w = 1, the image of ∞ | \|w\| < 1 | (1, 12160) | large wedge-shaped holes |
| `recip_ext` | 1/z of the exterior \|z\| > 1 (complement disc) | 0 < \|w\| < 1 | (0, 180) | perfect |
| `recip_ext_zoom0` | same, 128× zoom on w = 0, the image of ∞ | 0 < \|w\| < 1 | (0, 23040) | large wedge-shaped holes |
| `sq_Q1` | z² of the first quadrant (sector, r = 0) | Im w > 0 | (2i, 60) | perfect |
| `sqrt_slit` | principal √z of the slit plane (formula \|z\| > 0, cut 180°) | Re w > 0 | (1, 120) | perfect |
| `sqrt_slit_out16` | same, zoomed out 16× | Re w > 0 | (1, 7.5) | cut off at \|w\| ≈ 25 (scalloped arc) |
| `sin_halfstrip` | sin z of \|Re z\| < π/2, Im z > 0 (formula) | Im w > 0 | (2i, 50) | perfect |

**Bounded controls.** These must not change. They are checked by the metrics and by golden PNGs in `golden/`.

| scene | map and region | exact truth | right view |
|---|---|---|---|
| `disc_cube` | z³ of the disc \|z − (0.6 + 0.3i)\| < 0.8, which contains 0, so the image overlaps itself | some cube root of w lies in the disc (all 3 branches) | (0.15 + i, 74.5) |
| `joukowski` | the Joukowski airfoil example: (z + 1/z)/2 of the exterior of the circle through 1 | w ± √(w−1)√(w+1) outside the circle | (0, 117) |
| `annulus_log` | principal log of 0.5 < \|z\| < 2 | the rectangle log 0.5 < Re w < log 2, \|Im w\| < π | (0, 72) |
| `poly_mobius` | a pentagon in the upper half-plane under the Cayley map | inverse Cayley of w lies in the pentagon | (0, 200) |

**Exact images through infinity** (added in phase P0 of `notes/sphere-design/SPEC.md`, section 12.4). Infinitely
many sheets, essential singularities, shapes far from the left view, an outer exp over a non-affine prefix, a cut that
a later step heals. The per-pixel inverse renderer (P2) must raise the bad values below as IMPROVED and meet the
targets of the spec (see *Targets*). Their truths enumerate every member of the preimage families that can lie in
the region (`scenes.js`; no sampling, no app code) and are checked independently by `verify_truth.js` (see *Verifying
the truths*). Variants beyond mask and pattern are listed per scene.

| scene | map and region | exact truth | right view | variants |
|---|---|---|---|---|
| `zi_H`, `zi_H_out4`, `zi_H_out16` | z^i (complex power α = i, cut 180°, sheet 0) of the upper half-plane; left view (0, i, 60) | the open annulus e^−π < \|w\| < 1 (only members with −ln\|w\| in (−π, π] exist; z_m = e^{Arg w + 2πm − i ln\|w\|} is in H iff −ln\|w\| is in (0, π)); the disc \|w\| < e^−π must stay empty | (0, 190), s = 47.5, 11.875 | `zi_H`: mask, pattern, **polar**, **mask85**, **mask20**; `_out4`: mask, pattern, polar; `_out16`: mask, pattern |
| `expH`, `expH_out16` | e^z of the upper half-plane; left view (0, i, 60) | w ≠ 0 (members Log w + 2πim, Im > 0 for every m ≥ 1) | (0, 60), s = 3.75 | `expH`: mask, pattern, mask85, mask20 |
| `e1z_disc`, `e1z_disc_out16` | the chain [1/z, exp] of \|z\| < 1; left view (0, 120) | w ≠ 0 (z_m = 1/(Log w + 2πim) lies in the disc for every m ≠ 0) | (0, 60), s = 3.75 | `e1z_disc`: mask, pattern, mask85, mask20 |
| `e1z_custom` | custom formula `e^{\frac{1}{z}}` of \|z\| < 1 | as `e1z_disc` | (0, 60) | mask, pattern, mask85 |
| `exp_far_disc` | e^z of \|z − 60i\| < 1, the left view zoomed out to ±80 × ±100 (s = 2.5625) | some Log w + 2πim lies in the disc (m = 9 or 10; m = 7..12 enumerated) | (0, 60) | mask, pattern |
| `ez2_disc` | custom `e^{z^2}` of \|z − (3+3i)\| < 0.3, the default left view (0, 60) | some ±√(Log w + 2πim) lies in the disc (m = 2, 3; m = −1..6 enumerated) | (3.3 − 3.15i, 22): fitted to the image | mask, pattern |
| `healed_cut` | [log (cut 180°), exp] of \|z + 1\| < 0.6; left view (−1, 150) | the disc itself (exp(Log z) = z) | (−1 + i·0.5/150, 150): log's cut runs through pixel centres | mask, pattern |

Variants: **polar** = pattern `polar` (the app's log-polar checker); **mask85** / **mask20** = solid at alpha 0.85 / 0.2
(where infinitely many sheets overlap the exact image is opaque at any alpha). Display settings otherwise as above.
For `expH` and `e1z_*` the boundary stroke (the image of the region's boundary: the positive real ray, the curve
e^{e^{iφ}}) runs through the inside of the image; like `disc_cube` they exclude a 2.5 px band around it (`srcSdf`).

## Metrics

### Pixel classes

Every pixel gets a class from its rendered colour: the nearest of a set of reference colours, or of a blend of two of
them. The reference colours are read from the page's CSS tokens.

| class | what it covers | reference colours |
|---|---|---|
| **FILL** | the shape's fill | `--c1`. For the checker, also `--c1-alt` and blends of the two |
| **BG** | the plane and its graph paper | `--plane`, the grid colours, `--axis` |
| **ANNOT** | strokes and annotations | the boundary stroke (`--c1-edge`), cut banks (`--cut`), and their blends |
| **UNKNOWN** | garbage, such as NaN black or a wrong colour | any colour more than 48 RGB units from every reference and blend |

ANNOT pixels count neither as fill nor as background (in the original scenes; the SPEC 12.4 scenes count them as holes
inside the image, see *Strict mode* below). UNKNOWN pixels always count as errors: as a hole inside the true image and
as spill outside it. The baseline has none.

A blend of fill and plane takes the class of the nearer end. So "rendered as fill" means roughly "at least half
covered". This covers antialiasing and the far fade of a truncated mesh.

### Excluded band

Pixels within **2.5 px** of the true boundary are excluded from every count.

The app draws a boundary as a 1.5 px stroke on a 3.5 px halo, so within about 2.4 px of the boundary the fill is not
visible, whatever the fill does. With a 2 px band, halo pixels whose class flips with the boundary's sub-pixel phase
were left in the counts. For example, `logH_out16.pattern` parity moved by 0.03.

For `disc_cube` the band also covers the image of the disc's boundary where it folds into the inside of the image, since
the stroke is drawn there too. This uses the first-order distance `|sdf_Ω(z)|·|F'(z)|` over all preimages.

### Gated metrics

| metric | definition | better |
|---|---|---|
| `iou` | \|fill ∩ truth\| / \|fill ∪ truth\| over the non-band, non-ANNOT pixels | higher |
| `hole` | the fraction of truth-interior pixels outside the band that are rendered as BG | lower |
| `spill` | the fraction of truth-exterior pixels outside the band that are rendered as FILL | lower |
| `parity_acc` | pattern runs only. Among the scored pixels, the fraction whose checker colour (nearer `c0` = even, nearer `c1-alt` = odd) matches the truth: parity of ⌊Re z / cell⌋ + ⌊Im z / cell⌋ for the unique preimage z in the region. `cell` follows the app's rule: niceStep(size/10), where size is the largest bounded area's bbox side, or the meshing window's side when no area is bounded | higher |
| `golden_diff` | bounded controls only. The fraction of all pixels whose colour differs from the golden PNG by more than 8/255 in some channel, after a 1 px blur ([1 2 1]/4, separable) of both images | lower |

A pixel is **scored** for parity when all of these hold:

- it is inside the truth, outside the band, and rendered as FILL;
- it has exactly one preimage in the region;
- its local image cell is at least **3 px** (cell · \|F'(z)\| · s);
- it is at least **1.5 px** from a cell edge.

### Metrics of the SPEC 12.4 scenes

**Strict mode.** The runs of the SPEC 12.4 scenes (`strict: true` in `metrics.json`) are scored by stricter rules than
the original 32 runs, which keep exactly their old metrics:

- An **ANNOT pixel inside the true image**, outside the boundary bands, is a **hole** (`n_annot_hole` of them). A fill
  15 % darker than `c0`, or painted in the edge colour, is nearest a stroke colour and used to be skipped, so it scored
  as a perfect image. Strokes that legitimately cross the image are allowed only inside the 2.5 px band around them
  (`truth.annotSdf`: `healed_cut`'s dashed cut line, the negative real axis).
- **Opacity and colour** are taken over **every** interior pixel outside the bands. Only stroke-coloured pixels inside
  the annotation band are skipped, so a crack in the gaps of the dashed cut line still counts.
- A metric that has nothing to score is **null**, never a perfect 1, and the run gets a problem line: opacity and
  colour when they scored fewer than half the interior pixels; parity when it scored no pixel or fewer than half of
  the pixels the truth can score (`parity_exp`). A gated metric that has a baseline value and becomes null fails.

| metric | definition | better | gated |
|---|---|---|---|
| `parity_acc` (checker runs) | `parity_mode: "front"`. Where several members cover a pixel, the checker shown is the **front** member's: the smallest sheet key D of SPEC 5.1 (W = the saved `clipWin`, R its half-diagonal, rs = R/8, P = `truth.accum`: {0} for z^i and e^{1/z}, none for exp), ties to the larger Im z, then the larger Re z (5.2). Scored like the original checker (cell ≥ 3 px, ≥ 1.5 px from a cell edge). With one member (far disc, e^{z²}, healed cut) this is the original rule | higher | yes |
| `parity_acc` (polar runs) | `parity_mode: "polar"`. `truth.parityAll(w)`: under z^i every sheet z_m has the same log-polar parity, ⌊Arg w·16/2π⌋ + ⌊−ln\|w\|·16/2π⌋ mod 2 (ln\|z_m\| = Arg w + 2πm shifts the cell index by 16m). The app paints **solid c0** (parity 0) where the source point is within cell/12 of the polar origin (`REGION_FS`, kept on the inverse path by SPEC 6.2): sheets m ≤ −1 always lie there, sheet 0 when Arg w < ln(1/12). So the parity shown is that of the front member: 0 in that disc, `parityAll` outside, pixels within 1.5 px of the disc's edge not scored unless both sides show 0. Scored on every fill pixel inside whose cell is ≥ 3 px and that is ≥ 1.5 px from a cell edge (one cell is \|w\|·2π/16 wide in both directions). `polar_front_disc_px`: pixels the truth can score whose front member is in the disc (12 at `zi_H`, 0 at `zi_H_out4`; the boundary band not yet removed) | higher | yes |
| `parity_excl_tie` | (both) the share of fill pixels not scored because a member behind the front has a key within **0.01 octave** (SPEC 3.10 / 5.4: the front key is exact, or within 0.01 octave where a window is truncated) and would show another parity | – | reported |
| `opacity_min` | mask-type runs (mask, mask85, mask20): over the truth-interior pixels outside the band, the fill fraction t of the colour along plane → c0 (0 = plane, 1 = the opaque fill colour; projected and clamped to [0, 1]); the minimum | higher | yes, tol 0.01 |
| `opacity_p01`, `opacity_mean`, `opacity_lt99` | the 1st percentile, the mean, and the fraction of those pixels below 0.99; `n_opacity` pixels scored | – | reported |
| `color_off` | the share of interior pixels (outside the bands) whose colour is more than **6 RGB units** from the expected **opaque** fill colour: `c0` for mask-type runs, the segment `c0` – `c1-alt` for checker and polar (both checker colours and their antialiased or moiré-averaged blends). A fill 5 % darker (12 units off) moves it to 1; at alpha < 1 the exact image is opaque, so a translucent fill is off too | lower | yes, tol 0.001 |
| `color_err_mean`, `color_err_p99` | the RGB distance itself; `n_color` pixels | lower | reported |
| `hole_leak` | `zi_H*`: pixels deeper than the band (2.5 px) inside the disc \|w\| < e^−π that render as FILL (or UNKNOWN); on mask-type runs also a **translucent** fill (a blend of c0 with the plane, opacity > 0.05: one sheet at alpha 0.2 is BG by class). `hole_leak_px`: the pixels of that disc (112 at the default view, 0 at out4 / out16 where the disc is under 2.5 px); `hole_leak_frac` | lower | yes, tol 0 (a count) |

The truth's sheet order uses the saved `clipWin`; the runner reads the app's `clipWin` from its saved state at capture
and adds a problem when it differs.

### Reported metrics (not gated)

| metric | definition | better |
|---|---|---|
| `bnd_err_px` | (holes + spill pixels) / (length of the true boundary in view, in px). This is the mean displacement of the rendered edge beyond the band. The boundary length is the band area divided by its width, floored at the view's shorter side, so a boundary that is almost out of view does not inflate it | lower |
| `bnd_p95_px` | the 95th percentile of the distance to the true boundary over the misclassified pixels: how far from the boundary the errors reach. 0 when there are fewer than 20 such pixels | lower |
| `parity_excl` | the fraction of rendered-fill interior pixels that were not scored for parity. `parity_excl_multi`, `_small` and `_edge` give the reason | – |
| `parity_n` | the number of scored pixels | – |
| `annot` | the fraction of ANNOT pixels outside the band | – |
| `n_in`, `n_out`, `n_band`, `n_hole`, `n_spill`, `n_unknown` | raw pixel counts (`n_unknown` is included in holes and spill) | – |
| `settle_ms` | when the canvas last changed after navigation | lower |

## The gate (`tolerances.json`, applied by `../compare_quality.py`)

| check | fails when |
|---|---|
| `iou` | it drops by more than **0.002** |
| `parity_acc` | it drops by more than **0.002**. Only gated when both runs scored at least 1000 pixels. Below that the value is too noisy: `logH_out16`, `cayley_H_zoom1`, `recip_ext_zoom0` and `sqrt_slit_out16` show `n/a` today |
| `hole` | it grows by more than **0.001** |
| `spill` | it grows by more than **0.001** |
| `golden_diff` | it is above **0.005** (0.5 %), or the golden PNG is missing or has a different size |
| `opacity_min` | it drops by more than **0.01** (SPEC 12.4 scenes) |
| `color_off` | it grows by more than **0.001** (SPEC 12.4 scenes) |
| `hole_leak` | it grows at all (`zi_H*`) |
| any gated metric | it had a value in the baseline and has none now (null: nothing could be scored) |
| run health | a run is missing, did not settle, shows a view other than the pinned one, hit a GL error or a runner error, or the suite settings (viewport, band, parity limits, golden threshold) differ from the baseline's |

**NEW runs.** A run that has no entry in the baseline (the SPEC 12.4 scenes until the lead records their baseline) is
listed under `NEW runs` with its values and is not compared with a baseline; the summary counts it as `NEW`. A NEW run
that **did not render** (not ok: no settle, a GL error, a runner error, a wrong view) **fails**: it is not new, it is
broken. The existing
32 runs keep their baseline entries untouched. To record a baseline for the new runs only (deliberately, on the gate
machine), render them and accept the partial run, which adds their entries without touching the others:

```sh
node test/regress/quality/run_quality.js --only zi_H,expH,e1z_disc,e1z_custom,exp_far_disc,ez2_disc,healed_cut --out test/regress/quality/out/new
node test/regress/quality/run_quality.js --accept test/regress/quality/out/new
```

**Targets.** `tolerances.json` `targets` holds the absolute thresholds of the spec: IoU ≥ 0.999, holes and spill ≤
0.001 for every scene of the new groups and every old unbounded scene except `sqrt_slit_out16` (SPEC 11, P2 gate);
`color_off` ≤ 0.001 for the new groups (the exact image shows the opaque fill colours at any alpha: SPEC 12.4, 6.1;
added in the P0 review, not a number of the spec); `hole_leak` 0 for `zi_H*`; polar parity ≥ 0.999 for `zi_H.polar`
and `zi_H_out4.polar`; `opacity_min` ≥ 0.99 for the mask85 runs of z^i, exp(H) and e^{1/z}, the mask20 runs of z^i,
exp(H) and e^{1/z} (12.1 (g)), and `healed_cut.mask`. A run that a rule names but that has **no value** for the metric
(missing or null: a crashed run, nothing scored) is **NOT MET**. `compare_quality.py` prints them as `MET` / `NOT MET`
(only the NOT MET ones without `--all`) and fails on a NOT MET target only with `--enforce-targets` (through
`compare.py`: `--quality-enforce-targets`), to be used from the phase that must meet them (P2 for the flat image).

A change in the good direction by more than the tolerance is reported as **IMPROVED** and never fails. Changes within
the tolerance are listed as `better` or `worse (in tol)`. Reported metrics are listed only when they move beyond their
own tolerance.

To loosen or tighten one metric for one run or scene deliberately, add an entry to `overrides` in `tolerances.json`. For
example, `"logH_out4.pattern": {"parity_acc": {"tol": 0.01}}`.

## What the planned change should do to these numbers

- **Should improve.** `logH_out4` (IoU 0.73), `logH_out16` (0.18), `cayley_H_zoom1` (0.77 / 0.71), `recip_ext_zoom0`
  (0.81 / 0.75) and `sqrt_slit_out16` (0.61). IoU should rise and holes should fall. `logH_out4.pattern` parity (0.983)
  should rise once its ragged end is filled correctly.
- **Must not change.** Everything else is at IoU 1, holes 0, spill 0 and parity 1 today. The golden diffs of the bounded
  controls must stay at or below 0.5 %. Spill must not appear anywhere: for example, triangles through ∞ crossing a
  strip's edge would show as spill.
- **The SPEC 12.4 scenes** start as NEW runs. Their values on the code of 2026-10-19 (app sha1 `04aa240d1958`, the
  same as the baseline; Chrome 155.0.8059.85; strict rules, `out/latest` of the P0 review, renders bit-identical to the
  builder's `out/p0-full`):

  | run | today | target |
  |---|---|---|
  | `zi_H.mask` / `.pattern` / `.polar` / `.mask85` | IoU 0.9950 / 0.9946 / 0.9949 / 0.9948, holes 0.50–0.54 % (straight chords along the outer rim \|w\| = 1, upper right: the fill and its boundary stroke, whose dark pixels now count as holes), `color_off` 0.6–0.7 % | IoU ≥ 0.999, holes ≤ 0.001, colour ≤ 0.001 |
  | `zi_H.pattern` / `_out4` / `_out16` | front-sheet checker parity **0.641** (n 81,586) / **0.526** (n 3,368) / 0.337 (n 92) | gated once recorded |
  | `zi_H.polar` / `zi_H_out4.polar` | polar parity **0.948** (n 95,113) / **0.969** (n 3,483): sheets drawn with mangled cells in the lower half | ≥ 0.999 |
  | `zi_H.mask85` | opacity p01 **0.85**, mean 0.935, min 0.13: mostly one sheet; `color_off` 0.39 | opacity_min ≥ 0.99 |
  | `zi_H.mask20` | IoU **0.009**, holes 0.99, opacity mean 0.32: one sheet at alpha 0.2; `color_off` 1 | IoU ≥ 0.999, opacity ≥ 0.99 |
  | `zi_H*` hole_leak | **0 / 112** at the default view: today's forward path keeps the hole empty (also with the left view at (0, 60), (0.5i, 30), (0, 15), (0, 240), (0.5+0.3i, 120)) | 0 |
  | `zi_H_out4` / `_out16` | IoU 0.9940 / 1.0 (mask), holes 0.60 % / 0 | as `zi_H` |
  | `expH.pattern` / `expH_out16.pattern` | front-sheet checker parity **0.311** / **0.373**: today's mesh puts the sheet above the left view's in front | gated once recorded |
  | `e1z_disc.pattern`, `e1z_disc_out16.pattern`, `e1z_custom.pattern` | parity **0.500**: today's render shows plain `c0` (no checker) everywhere | gated once recorded |
  | `expH.mask20` | IoU **0.815**, holes 0.19, opacity 0.49, `color_off` 1 | IoU ≥ 0.999, opacity ≥ 0.99 |
  | `expH.mask85` | opacity 0.997 | ≥ 0.99 (met) |
  | `e1z_disc.mask20` | IoU 1, opacity **0.987** everywhere | opacity ≥ 0.99 |
  | `e1z_disc_out16.mask` | IoU 0.99994 (a few pixels near w = 0) | IoU ≥ 0.999 (met) |
  | `expH`, `e1z_disc`, `e1z_custom` mask / mask85, `exp_far_disc`, `ez2_disc`, `healed_cut.mask` | IoU 1, holes 0, spill 0, parity 1 (far disc, e^{z²}), opacity 1, `color_off` 0 | must stay |
  | `healed_cut.pattern` | IoU 0.9995, holes 0.05 % (13 antialiased dash ends of the cut line, a blend nearest the background) | IoU ≥ 0.999 (met) |

  The spec expected today's z^i hole to be filled; on this code it is not, at any left view tried, so `hole_leak`
  guards the change instead of showing an improvement. What today gets wrong for z^i is the polar pattern, the rim
  chords and the opacity at alpha < 1; for every infinite-sheet scene, the sheet in front.
- **The new spherical checkerboard** is a new pattern. These scenes use the planar `checker`. Once the new pattern exists,
  add pattern scenes for it with a truth on the sphere.

## Updating the baseline deliberately

```sh
test/regress/quality/run.sh --update-baseline
```

This runs the suite and prints the comparison with the **old** baseline for review. It then makes this run the baseline:
`baseline.json` and the 8 golden PNGs in `golden/`. You can also accept an existing run with
`node test/regress/quality/run_quality.js --accept out/latest`.

- A run made with `--only` updates only its runs inside the existing baseline.
- A run that has failed scenes cannot be accepted, and neither can a run made with `--override`.

Only update the baseline after reading the comparison and looking at `out/latest/index.html` (maps and golden diffs).
Valid reasons:

- an intended visual change, such as a new stroke style, colours or layout;
- an accepted improvement that you want to lock in, so it cannot silently regress later;
- a new Chrome or GPU, which `compare_quality.py` warns about when the browser version differs.

Never update the baseline only to make a failing gate pass.

After you edit `metrics.js` or a scene's truth, `node run_quality.js --reeval DIR` recomputes a run's metrics from its
renders without a browser. Re-baseline after any change to the suite itself.

## Determinism and sensitivity (measured when the baseline was recorded)

- **Determinism.** The baseline run and two more full runs produced bit-identical renders for **32/32** runs (same
  `render_sha1`) and identical metrics. After the SPEC 12.4 scenes were added (P0), a full run of all 63 runs on the
  unchanged code (Chrome 155.0.8059.85, `out/p0-full/`) reproduced the 32 baseline renders bit for bit with identical
  metrics, and two runs of the 31 new runs gave identical renders and metrics. `compare_quality.py` printed `32 runs: 0 failed, 0 improved, 32 unchanged` for
  both. Only `settle_ms` varies, by a few ms.
- **Sensitivity check.** `node run_quality.js --override '{"meshN":80}' --out out/sens` uses a coarser mesh (80
  instead of 240). It **fails 7 runs**:
  - `logH.mask` holes 0 → 0.0015;
  - `logH_out4` IoU 0.728 → 0.679 and spill 0 → 0.0049;
  - `logH_out16` IoU 0.182 → 0.177;
  - `cayley_H.pattern` holes → 0.00104.

  The deep-zoom scenes come out as improved under this override, because fewer triangles are dropped there. The
  bounded-control golden diffs moved only 0.00–0.18 %, below the 0.5 % gate. Geometric accuracy is gated by the
  metrics; the golden PNGs catch visible changes to unchanged scenes.

## Verifying the truths (`verify_truth.js`)

The truths of the SPEC 12.4 scenes are inverses (`pre` + `region`). `node verify_truth.js` checks each rendered view
against a second, independent computation and exits 1 on any failure:

- **(A) forward rasterisation.** The region (or a part whose image covers the view, such as one period of exp) is
  sampled at ≤ 0.4 image px spacing, adapted to \|F′\|, and mapped with the file's own forward formula (plain `Math`,
  no `scenes.js` helpers). `hit_outside`: hit pixels that the truth puts outside, more than 1 px from the true boundary;
  `miss_inside`: pixels the truth puts inside, deeper than 1.5 px, that no sample hit. Both must be 0. A truth that is
  wrong by about 2 px or more anywhere is caught (sensitivity checked by mutating the truths: `healed_cut` with radius
  0.62 instead of 0.6 (3 px) → 621 pixels never hit, 0.595 → 88 hits outside; one exp member dropped → 12,919 to
  105,370 hits outside; z^i inner radius × 1.25 → 88 hits outside; a 1 px change is below the check's resolution).
- **(B)** every candidate `pre` accepts maps back: \|F(z) − w\| ≤ 1e−9 (1 + \|w\|) at every pixel centre.
- **(C)** the saved state describes the same map: the app's own step functions (`src/funcs.js`, chained), loaded
  only for this check, agree with F at 2,000 random points of the region (catches a wrong branch, sign or formula:
  α = −i instead of i, `e^{1/z^2}` instead of `e^{1/z}`).
- **(D)** for `zi_H`, every member z_m in the region has the log-polar parity that `parityAll(w)` gives.
- **(E)** no forward sample of z^i lands in the hole \|w\| < e^−π.
- **(F)** the pattern of the front sheet: the file's own model of the renderer the spec describes (its own member
  enumerators over wider index ranges, its own sheet key D of SPEC 5.1 and the tie rule, the app's polar pattern with
  its solid c0 disc) gives the displayed parity of every pixel, which must equal the parity `metrics.js` scores at
  every pixel it scores, for the checker (`front`) and, on `zi_H*`, the polar mode. `front_disc` counts the compared
  pixels whose front lies in the c0 disc (10 at `zi_H`).

`--selftest` paints renders with the model of (F) (fill c0, or the front member's checker / polar colour inside;
plane outside) and requires IoU 1, holes 0, spill 0, parity 1 (on at least 1000 pixels where the truth can score that
many), opacity 1, `color_off` 0 and hole_leak 0 for every new run. Then deliberate defects must move their metric:

- the hole painted → hole_leak 112/112; one sheet at alpha 0.2 in the hole of `zi_H.mask20` → 112/112;
- one sheet at alpha 0.2 → opacity_min 0.2 and IoU 0;
- flipped parity → polar parity 0; the polar pattern **without its c0 disc** → polar parity < 1 on `zi_H.polar`;
- the sheet **behind** the front painted → checker parity < 0.95 (0.35, 0.73, 0.42 for z^i, exp, e^{1/z});
- a crack row at coverage 0.75 in `healed_cut` → opacity_min 0.75;
- the fill **15 % darker** or in the **edge colour** → holes ≥ 0.95 (all but the cut line's band) and IoU 0; **5 %
  darker** → `color_off` 1;
- a blank pattern render → parity null with a problem (it used to report 1); every pixel in the excluded band →
  opacity, colour and parity null.

Result on the current truths: all 11 views pass (A)–(F) (residuals ≤ 1.3e−14, 0 front mismatches), and all 165
self-test checks pass. The model scores an ideal renderer's polar image of `zi_H` / `zi_H_out4` at 1; the truth before
the P0 review (no c0 disc) scored the same image at 0.99910 / 0.99887, below the 0.999 target.

## Files

| file | role |
|---|---|
| `run.sh` | the one-command entry point (build, run, gate, `--update-baseline`) |
| `run_quality.js` | the runner (headless Chrome over the DevTools pipe, capture, metrics, artefacts, `--accept`, `--reeval`) |
| `scenes.js` | scene states, pinned views, exact truths, its own complex arithmetic; the variants of each scene |
| `verify_truth.js` | the independent check of the SPEC 12.4 truths (forward rasterisation, soundness, app map agreement, polar parity, hole, the front sheet's pattern) and `--selftest` of the metrics |
| `metrics.js` | pixel classes, truth grid, distance transform, metrics, golden diff |
| `pngio.js` | a dependency-free PNG encoder and decoder |
| `tolerances.json` | the gate, and the spec's absolute targets |
| `baseline.json` | the accepted metrics of the current code (app sha1 `04aa240d1958`, Chrome 155.0.8059.80) |
| `golden/` | golden PNGs of the bounded controls |
| `../compare_quality.py` | the pass/fail comparison. Also used by `../compare.py` through `main(argv)` |
| `../test_compare.py` | self-test of both gates on synthetic results (crashed NEW runs, missing target values, null metrics, NEW checks and limits) |

## Caveats

- **The baseline belongs to one machine.** It was recorded with ANGLE on Metal, on this Mac and this Chrome. On another
  GPU or Chrome the renders may differ by antialiasing: expect small metric changes and golden diffs. Re-baseline there
  first.
- **ANNOT pixels are not judged in the original scenes.** There, a regression that draws the fill in a stroke-like
  colour, such as the edge colour or the cut colour, is not counted as a hole. It does fail the goldens for the bounded
  controls, and the `annot` fraction rises. The SPEC 12.4 scenes count such pixels as holes and gate the fill colour
  (`color_off`). Outside the true image ANNOT pixels are not judged in any scene (cut lines and markers are drawn
  there, e.g. the circle \|w\| = e^π of z^i's cut at `zi_H_out16`). Colours far from every reference are UNKNOWN and
  are counted as errors.
- **The sheet order is the spec's.** The checker and polar truths of the infinite-sheet scenes follow SPEC 5.1's key D
  with the saved `clipWin`. If the spec changes D or the tie rule, update `sheetKey` / `frontOrder` in `metrics.js`
  and the model in `verify_truth.js`.
- **The cell-size rule is copied.** The truth uses its own copy of the app's pattern-cell rule. If the app changes the
  rule, parity drops and the run prints a `pattern cell` warning.
- **Settling depends on a quiet period.** If the new refinement pauses for longer than 1.5 s between visible steps while
  the LED is not `busy`, raise `--stable-ms`.

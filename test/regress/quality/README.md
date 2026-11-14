# Image-quality regression suite

This suite checks that a code change does not make the image of a region worse. It renders fixed scenes through the
real app (`dist/test.html`) in headless Chrome with real WebGL2 (ANGLE on Metal), in the steps view on the chain's last
plane, Inside regions. For every pixel of the plane's canvas it compares where the image is drawn with **exact ground
truth** computed on the CPU from the known inverse of the scene's map. It then checks the metrics against a stored
baseline using documented tolerances.

**Coverage.** The steps view paints the carried colour inside the regions (a hue per point) and draws the regions
solid at alpha 1: it has no region patterns or opacity. Each scene runs once, `<name>.mask`, scored for coverage (IoU,
holes, spill, hole_leak) by the `cover` classifier. `metrics.js` also defines the checker and polar parity, opacity and
colour metrics described below; `test/t_inverse_render.js` scores the CPU reference renderer (`Inverse.renderCPU`) with
them, and no run of this suite produces them.

It gates the images of unbounded regions (filled to the view's edges, through infinity), of bounded controls, and of
the exact per-pixel inverse renderer's hard cases (infinitely many sheets, essential singularities, healed cuts).

## Run it

```sh
test/regress/quality/run.sh                 # build dist/, render 40 runs, compare with the baseline
test/regress/quality/run.sh --no-build      # use dist/ as it is
test/regress/quality/run.sh --only logH,joukowski.mask   # a subset (only those runs are gated)
test/regress/quality/run.sh --only zi_H,expH,e1z_disc,e1z_custom,exp_far_disc,ez2_disc,healed_cut   # the SPEC 12.4 scenes (~75 s)
python3 test/regress/compare.py             # perf + quality verdicts together, after both suites have run
node test/regress/quality/verify_truth.js   # independent check of the SPEC 12.4 scenes' truths (~6 s, no browser)
node test/regress/quality/verify_truth.js --selftest   # the cover metrics on synthetic renders
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
| `renders/<run>.png` | the `#canvasL` pixels as rendered |
| `maps/<run>.png` | green: correct fill. White: correct background. **Red: hole**. **Blue: spill**. **Purple: wrong checker parity**. **Orange: fill in a wrong colour** (SPEC 12.4 runs). Grey: the excluded boundary band. Pale blue-grey: pixels a cover run leaves out (the axes, the annotation band). Yellow: strokes and annotations. Pale green: fill that was not scored for parity |
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

1. **Scenes** (`scenes.js`). Each scene is a saved app state and the exact truth of its image. Every scene renders
   once, `<name>.mask`, with these display settings: alpha 1, coordinate net off, unit circle off, view outline off,
   region outline off, mesh quality 240, light theme, viewport 1440×900 at dpr 1. The steps view's plane is 848×720 px.

   The state pins the steps view's one camera to the **view of the image** (`wView`), so a change in auto-fit can
   never move a scene. It pins the **meshing window** too (`clipWin` = the box of the scene's z view, `srcView`, at
   410×516 px).
2. **Seeding.** Before any app script runs, the runner writes the state to the localStorage key
   `complex-map-workbench-v1:qreg-<run>`. It then opens `test.html?ns=qreg-<run>`.
3. **Standing.** Once the steps view is on, the runner stands the run where `STAND` says (`__cmwSteps`): the last
   plane, the colour plane set to it, Inside regions, `bare` (the colour layer alone: no grid, outlines or points). A
   globe run stands on its globe (`surf: 'sphere'`) and pins its camera (`__cmwCam('L', …)`).
4. **Settling.** The runner hashes `#canvasL` every 200 ms. It reads the canvas through a scratch canvas, so the app's
   own canvas is never read back repeatedly. The scene counts as settled when all three hold:
   - the hash has not changed for 1.5 s;
   - the plane's LED (`#leftLed`) is not `busy` (the CPU fix-ups are done);
   - the plane's own last frame (`__cmwPaneStatus('L')`) waits for no program.

   A scene that has not settled after 30 s is a failure.
5. **Capture.** The runner reads the pixels of `#canvasL`, the CSS colour tokens and the view.
   - It reads the view from the test hook `__cmwW2S('L', …)` and checks it against the pinned view. They must agree to
     0.5 px, or the run fails.
   - If the hook disappears, the runner falls back to the pinned view and adds a warning.
   - It leaves out of the score the two axes, which the plane draws over the paper after the colour (2 CSS px each side
     of the origin's column and row); the truth's annotation band (`healed_cut`'s cut line); and, outside the true
     image, the cut strokes the plane draws there (a blend of the paper and `--cut`: log's cut lines, z^i's cut circle
     \|w\| = e^π at `zi_H_out16`): a stroke outside the image is no spill.
6. **Truth** (`scenes.js`, `metrics.js`). This code is independent of the app's code.
   - For a pixel centre `w`, `pre(w)` lists every candidate preimage `z`, across all branches. `w` is inside the true
     image when some candidate lies in the source region (`region(z)`, the exact level set).
   - `dF(z) = |F'(z)|` gives the local scale.
   - The signed distance to the true boundary is exact where a closed form exists (`sdf`). Otherwise it comes from a
     Euclidean distance transform of the truth mask, computed on a grid padded by 6 px, so boundaries just outside the
     view count.

## Scenes

Views are written as (centre, px per unit). Every scene runs as `<name>.mask`; the column *view of the image* is `wView`.

**Unbounded regions.** Their images reach the view's edges.

| scene | map and region | exact truth | view of the image |
|---|---|---|---|
| `logH` | log z (cut 180°) of the upper half-plane | 0 < Im w < π | (−0.18 + iπ/2, 97): the app's auto-fit |
| `logH_out4` | same, zoomed out 4× | 0 < Im w < π | s = 24.25 |
| `logH_out16` | same, zoomed out 16× | 0 < Im w < π | s = 6.06 |
| `exp_strip` | e^z of the strip \|Im z\| < π/2 (formula) | Re w > 0 | (2, 40) |
| `cayley_H` | (z − i)/(z + i) of the upper half-plane | \|w\| < 1 | (0, 190) |
| `cayley_H_zoom1` | same, 64× zoom on w = 1, the image of ∞ | \|w\| < 1 | (1, 12160) |
| `recip_ext` | 1/z of the exterior \|z\| > 1 (complement disc) | 0 < \|w\| < 1 | (0, 180) |
| `recip_ext_zoom0` | same, 128× zoom on w = 0, the image of ∞ | 0 < \|w\| < 1 | (0, 23040) |
| `sq_Q1` | z² of the first quadrant (sector, r = 0) | Im w > 0 | (2i, 60) |
| `sqrt_slit` | principal √z of the slit plane (formula \|z\| > 0, cut 180°) | Re w > 0 | (1, 120) |
| `sqrt_slit_out16` | same, zoomed out 16× | Re w > 0 | (1, 7.5) |
| `sin_halfstrip` | sin z of \|Re z\| < π/2, Im z > 0 (formula) | Im w > 0 | (2i, 50) |

**Bounded controls.** These must not change. They are checked by the metrics and by golden PNGs in `golden/`
(`<name>.mask.png`, written by `run_quality.js --accept` on the Mac GPU; CI's paired run diffs them against the
reference build's renders instead).

| scene | map and region | exact truth | view of the image |
|---|---|---|---|
| `disc_cube` | z³ of the disc \|z − (0.6 + 0.3i)\| < 0.8, which contains 0, so the image overlaps itself | some cube root of w lies in the disc (all 3 branches) | (0.15 + i, 74.5) |
| `joukowski` | the Joukowski airfoil example: (z + 1/z)/2 of the exterior of the circle through 1 | w ± √(w−1)√(w+1) outside the circle | (0, 117) |
| `annulus_log` | principal log of 0.5 < \|z\| < 2 | the rectangle log 0.5 < Re w < log 2, \|Im w\| < π | (0, 72) |
| `poly_mobius` | a pentagon in the upper half-plane under the Cayley map | inverse Cayley of w lies in the pentagon | (0, 200) |

**Exact images through infinity** (`notes/sphere-design/SPEC.md`, section 12.4). Infinitely many sheets, essential
singularities, shapes far from the left view, an outer exp over a non-affine prefix, a cut that a later step heals.
They must meet the targets of the spec (see *Targets*). Their truths enumerate every member of the preimage families that can lie in
the region (`scenes.js`; no sampling, no app code) and are checked independently by `verify_truth.js` (see *Verifying
the truths*).

| scene | map and region | exact truth | view of the image |
|---|---|---|---|
| `zi_H`, `zi_H_out4`, `zi_H_out16` | z^i (complex power α = i, cut 180°, sheet 0) of the upper half-plane; left view (0, i, 60) | the open annulus e^−π < \|w\| < 1 (only members with −ln\|w\| in (−π, π] exist; z_m = e^{Arg w + 2πm − i ln\|w\|} is in H iff −ln\|w\| is in (0, π)); the disc \|w\| < e^−π must stay empty | (0, 190), s = 47.5, 11.875 |
| `expH`, `expH_out16` | e^z of the upper half-plane; left view (0, i, 60) | w ≠ 0 (members Log w + 2πim, Im > 0 for every m ≥ 1) | (0, 60), s = 3.75 |
| `e1z_disc`, `e1z_disc_out16` | the chain [1/z, exp] of \|z\| < 1; left view (0, 120) | w ≠ 0 (z_m = 1/(Log w + 2πim) lies in the disc for every m ≠ 0) | (0, 60), s = 3.75 |
| `e1z_custom` | custom formula `e^{\frac{1}{z}}` of \|z\| < 1 | as `e1z_disc` | (0, 60) |
| `exp_far_disc` | e^z of \|z − 60i\| < 1, the left view zoomed out to ±80 × ±100 (s = 2.5625) | some Log w + 2πim lies in the disc (m = 9 or 10; m = 7..12 enumerated) | (0, 60) |
| `ez2_disc` | custom `e^{z^2}` of \|z − (3+3i)\| < 0.3, the default left view (0, 60) | some ±√(Log w + 2πim) lies in the disc (m = 2, 3; m = −1..6 enumerated) | (3.3 − 3.15i, 22): fitted to the image |
| `healed_cut` | [log (cut 180°), exp] of \|z + 1\| < 0.6; left view (−1, 150) | the disc itself (exp(Log z) = z) | (−1 + i·0.5/150, 150): log's cut runs through pixel centres |

For `expH` and `e1z_*` the boundary stroke (the image of the region's boundary: the positive real ray, the curve
e^{e^{iφ}}) runs through the inside of the image; like `disc_cube` they exclude a 2.5 px band around it (`srcSdf`).

**Globes (group `sphere`, report only).** A sphere has no flat ground truth, so these runs skip the metrics above and
are scored by `golden_diff` alone, against the reference build's render in CI's paired run (`ci/quality.js`) or the
golden PNG locally. `compare_quality.py` lists their diff as info and never gates it, and a globe that did not render
is a warning: a change to the globe's shading or camera shows up in the quality job's summary, and an intended one
passes. Each pins the app's default camera at 1440 × 900 (`__cmwCam`, written out in `scenes.js`).

| run | what | canvas |
|---|---|---|
| `sphere_disc_sq.look` | the exact image of \|z − (0.3 + 0.2i)\| < 0.5 under z² on the last plane's globe, Inside regions | `#canvasL` |
| `sphere_phase.look` | Phase on the globe of z, F(z) = z, Everywhere | `#canvasL` |

## Metrics

### Pixel classes

**The `cover` classifier (the suite's runs).** The steps view paints the carried colour inside the regions, a hue per
point, over the plane's paper. A pixel within **24 RGB units** of the paper (`--plane`) is BG, any other colour FILL:
the run scores where the image is drawn, not its colour. The pixels a cover run leaves out (the axes, the annotation
band, the cut strokes outside the image) count nowhere.

The other classifiers (no run uses them now): every pixel gets a class from its rendered colour, the nearest of a set
of reference colours, or of a blend of two of them. The reference colours are read from the page's CSS tokens.

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
were left in the counts.

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
0.001 for every scene of the new groups and every old unbounded scene except `sqrt_slit_out16` (SPEC 11, P2 gate),
the P2 review's saturation and deep-zoom scenes (`atanh_D*`, `atan_D*`, `cube_far_deep`) and `zp_disc`; `hole_leak` 0
for `zi_H*`. A run that a rule names but that has **no value** for the metric
(missing or null: a crashed run, nothing scored) is **NOT MET**. `compare_quality.py` prints them as `MET` / `NOT MET`
(only the NOT MET ones without `--all`) and fails on a NOT MET target only with `--enforce-targets` (through
`compare.py`: `--quality-enforce-targets`), to be used from the phase that must meet them (P2 for the flat image).

A change in the good direction by more than the tolerance is reported as **IMPROVED** and never fails. Changes within
the tolerance are listed as `better` or `worse (in tol)`. Reported metrics are listed only when they move beyond their
own tolerance.

To loosen or tighten one metric for one run or scene deliberately, add an entry to `overrides` in `tolerances.json`. For
example, `"logH_out4.mask": {"iou": {"tol": 0.01}}`.

## Updating the baseline deliberately

```sh
test/regress/quality/run.sh --update-baseline
```

This runs the suite and prints the comparison with the **old** baseline for review. It then makes this run the baseline:
`baseline.json` and the 4 golden PNGs in `golden/` (the bounded controls' `.mask` runs; `--accept` creates the
directory). You can also accept an existing run with
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

## Sensitivity

`node run_quality.js --override '{"meshN":80}' --out out/sens` renders every scene with a coarser mesh (80 instead of
240) and is never accepted as a baseline: compare it with a normal run to see which runs a geometric change moves.
Geometric accuracy is gated by the metrics; the golden PNGs catch visible changes to unchanged scenes.

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

`--selftest` paints renders of every run of the new scenes (the truth's inside in a fill colour, the paper outside)
and requires IoU 1, holes 0, spill 0 and hole_leak 0. Then deliberate defects must move their metric:

- the hole painted → hole_leak = every pixel of the hole that can be scored;
- the inside painted in the paper's colour → holes ≥ 0.95 and IoU 0;
- the whole view painted → spill;
- every pixel in the excluded band → IoU, holes and spill null with a problem (never a perfect 1).

## Files

| file | role |
|---|---|
| `run.sh` | the one-command entry point (build, run, gate, `--update-baseline`) |
| `run_quality.js` | the runner (headless Chrome over the DevTools pipe, capture, metrics, artefacts, `--accept`, `--reeval`) |
| `scenes.js` | scene states, pinned views, exact truths, its own complex arithmetic; where each run stands (`STAND`) |
| `verify_truth.js` | the independent check of the SPEC 12.4 truths (forward rasterisation, soundness, app map agreement, polar parity, hole, the front sheet's pattern) and `--selftest` of the metrics |
| `metrics.js` | pixel classes, truth grid, distance transform, metrics, golden diff |
| `pngio.js` | a dependency-free PNG encoder and decoder |
| `tolerances.json` | the gate, and the spec's absolute targets |
| `baseline.json` | the accepted metrics of the Mac GPU, written by `--accept` (`run.sh --update-baseline`) |
| `golden/` | golden PNGs of the bounded controls (`<name>.mask.png`), written by `--accept` (it creates the directory) |
| `../compare_quality.py` | the pass/fail comparison. Also used by `../compare.py` through `main(argv)` |
| `../test_compare.py` | self-test of both gates on synthetic results (crashed NEW runs, missing target values, null metrics, NEW checks and limits) |

## Caveats

- **The baseline belongs to one machine.** `baseline.json` and `golden/` are written by `--accept` from a run on the
  Mac GPU (ANGLE on Metal). On another GPU or Chrome the renders may differ by antialiasing: expect small metric changes
  and golden diffs. Re-baseline there first. A run the baseline has no entry for is NEW; one it scores differently fails
  `--absolute` until it is accepted.
- **A cover run sees no colour, only coverage.** A regression that draws the image in a wrong colour is not counted
  while the colour is not the paper's; the bounded controls' goldens catch it. A stroke drawn outside the image in the
  cut colour is left out (no spill).
- **The paper is the background.** A cover run counts every colour farther than 24 RGB units from `--plane` as fill:
  a colour scheme whose carried colour comes that close to the paper would read as holes.
- **Settling depends on a quiet period.** If the new refinement pauses for longer than 1.5 s between visible steps while
  the LED is not `busy`, raise `--stable-ms`.

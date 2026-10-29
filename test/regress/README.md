# Regression gates: performance and image quality

Two suites guard the coming meshing / refinement / inverse-rendering change. Both were recorded on the code as it
is today (the baseline) and must keep passing afterwards: **performance must not decrease and image quality must not
decrease**. Intended improvements (images of unbounded regions reaching the edges of the view, better-shaped meshes)
are reported as `IMPROVED`, never as failures.

| | perf suite | quality suite |
|---|---|---|
| one command | `test/regress/perf/run.sh` | `test/regress/quality/run.sh` |
| runner | `perf/run.js` (own headless Chrome over CDP) | `quality/run_quality.js` |
| baseline | `perf/baseline.json`, written by `perf/run.sh --update-baseline` (not committed; CI measures the reference instead) | `quality/baseline.json` + `quality/golden/` |
| gate | `compare_perf.py` | `compare_quality.py` |

`python3 test/regress/compare.py` compares the latest results of both suites with their baselines (options are routed
by prefix: `--perf-all`, `--quality-all`, `--perf-results FILE`, `--only perf`). Exit status 0 = pass, 1 = regression,
2 = setup problem. Run the two suites one after the other, never at the same time (the perf numbers would be wrong).

**Phase P0 of the exact-images work** (`notes/sphere-design/SPEC.md`, sections 11 P0, 12.4, 12.5) added quality scenes
with exact ground truth (z^i, exp and e^{1/z} of unbounded or singular regions, a far disc, e^{z²}, a healed cut) and
perf units (dpr 2, the Sphere view of z^i, a Möbius scrub, the gallery, shape-list hover, a SwiftShader runner,
compile fields of the example loads). **Until the lead records baselines that contain them, both comparisons report
them as `NEW` with their values and do not compare them with a baseline; the existing baselines are untouched.** What
needs no baseline is judged anyway: a NEW quality run that did not render fails, and a NEW perf `check` that is false
or a NEW `limit` that does not hold fails. The spec's absolute thresholds are recorded as targets (quality:
`tolerances.json` `targets`, enforced with `--quality-enforce-targets`; a run without a value for a target's metric does
not meet it; perf: kind `limit`). `python3 test/regress/test_compare.py` tests both gates on synthetic results, and
`node test/regress/perf/selftest.js` the perf runner's own measuring code.

Requirements: macOS with Google Chrome (headless, real WebGL2 through ANGLE Metal; the in-app Browser pane has no
WebGL2), node, python3. Pages are served by the static server for `dist/` at `http://localhost:8793/`; if it is not
running, `perf/run.js` serves `dist/` itself on a free port. `run.sh` rebuilds `dist/` (`python3 build.py`) when a file
in `src/` is newer than `dist/test.html`, so the suite never measures a stale build.

---

## Image-quality suite (`test/regress/quality/`)

The full documentation, including scenes, metric definitions, tolerances, artefacts and caveats, is in
[`quality/README.md`](quality/README.md).

```sh
test/regress/perf/run.sh --quick               # ~3 min: 10 units, 2 reps; partial run (missing units are not failures)
test/regress/quality/run.sh                    # ~2.5 min: build, render 27 scenes in 63 runs, gate vs baseline
test/regress/quality/run.sh --only logH        # a subset (only those runs are gated)
test/regress/quality/run.sh --update-baseline  # deliberate: show the diff vs the old baseline, then accept this run
python3 test/regress/compare_quality.py --all  # every gated metric of the last run against the baseline
python3 test/regress/compare_quality.py --enforce-targets   # also fail on the spec's absolute targets (from P2)
node test/regress/quality/verify_truth.js      # independent check of the SPEC 12.4 truths (+ --selftest of the metrics)
python3 test/regress/test_compare.py           # the two gates on synthetic results (< 1 s)
```

**How it works.** Each scene is a saved state with a pinned right view (1440×900, dpr 1, light theme, panels shown).
The runner renders it in its own headless Chrome and reads `#canvasR` once the canvas is stable, the LED is not
`busy` and no GL program is pending. It then compares every pixel with the **exact** image, computed on the CPU from
the inverse of the map over all branches.

**What is measured.** The scenes cover:

- unbounded regions: log of the upper half-plane at 1×, 4× and 16× zoom-out; exp of a strip; Cayley and 1/z, each
  also zoomed onto the image of ∞; z² of a quadrant; √ of the slit plane, also zoomed out; sin of a half-strip;
- bounded controls: a disc under z³, the Joukowski airfoil, an annulus under log, a pentagon under Möbius.

Per run it reports IoU, hole fraction and spill fraction (a 2.5 px band around the true boundary is excluded),
boundary error, and checker parity accuracy on pixels with image cells of at least 3 px that are at least 1.5 px from a
cell edge. For the bounded controls it also reports a golden-PNG diff: the fraction of pixels that differ by more than
8/255 after a 1 px blur.

**The gate** (`quality/tolerances.json`):

- IoU and parity must not drop by more than 0.002. Parity is gated only when at least 1000 pixels were scored.
- Holes and spill must not grow by more than 0.001.
- Golden diffs must stay at or below 0.5 %.

Larger moves in the good direction are reported as **IMPROVED**. Today the cut-off unbounded images have these
values, which the coming change should raise as improvements:

| run | IoU |
|---|---|
| `logH_out4` | 0.73 |
| `logH_out16` | 0.18 |
| `cayley_H_zoom1` | 0.77 |
| `recip_ext_zoom0` | 0.81 |
| `sqrt_slit_out16` | 0.61 |

Every other scene scores IoU 1, holes 0, spill 0 and parity 1. Three full runs gave bit-identical renders (32/32) and
identical metrics.

**SPEC 12.4 scenes (P0).** `zi_H` (z^i of the upper half-plane: the annulus e^−π < \|w\| < 1 at 1×, 4×, 16×), `expH`
(1×, 16×), `e1z_disc` (1×, 16×), `e1z_custom`, `exp_far_disc`, `ez2_disc`, `healed_cut`, in the variants mask and
pattern plus `polar` (log-polar checker), `mask85` and `mask20` (solid at alpha 0.85 / 0.2) where the spec asks for
them: 31 runs. They are scored in **strict mode**: a stroke-coloured pixel inside the true image is a hole (outside the
band of a stroke that legitimately crosses it, `healed_cut`'s cut line), opacity and colour are taken over every
interior pixel, and a metric with nothing to score is null with a problem, never a perfect 1. Where several sheets
overlap, the checker and polar truths are the pattern of the **front** sheet (SPEC 5.1's key D from the saved
`clipWin`, the tie rule of 5.2; the polar pattern's solid c0 disc around 0 included). New metrics: front-sheet checker
and polar parity (as `parity_acc`), `opacity_min` (gated, tol 0.01) with `opacity_p01` / `_mean` / `_lt99`,
`color_off` (gated, tol 0.001: interior pixels more than 6 RGB units from the opaque fill colour) and `hole_leak`
(gated: must not grow; translucent fill counts on mask runs). Their truths are independent of the app and checked by
`quality/verify_truth.js` (forward rasterisation of the region against the inverse truth, soundness of every preimage,
agreement of the saved state's map with the app's own step functions, polar parity, the empty hole, and an own model
of the front sheet's pattern); `--selftest` checks the metrics on synthetic renders, ideal and with defects (a darker
or edge-coloured fill, the sheet behind the front, the polar pattern without its c0 disc, a translucent leak, a crack,
blank renders). Today's values (details in `quality/README.md`):

| run | today | spec target (P2) |
|---|---|---|
| `zi_H.polar`, `zi_H_out4.polar` | polar parity 0.948, 0.969 | ≥ 0.999 |
| `zi_H.pattern`, `expH.pattern`, `e1z_disc.pattern` | front-sheet checker parity 0.641, 0.311, 0.500 (today's mesh shows another sheet in front, or no checker at all) | gated once recorded |
| `zi_H.mask85` | opacity p01 0.85, mean 0.935 (one sheet); `color_off` 0.39 | opacity_min ≥ 0.99 |
| `zi_H.mask20`, `expH.mask20` | IoU 0.009, 0.815; opacity mean 0.32, 0.58; `color_off` 1 | IoU ≥ 0.999, opacity ≥ 0.99 |
| `e1z_disc.mask20` | opacity 0.987 | ≥ 0.99 |
| `zi_H` mask / pattern / polar / mask85, `zi_H_out4` | IoU 0.994–0.995, holes 0.5–0.7 %: chords along the outer rim, the fill and its stroke (strict: the stroke's dark pixels inside the true disc are holes) | IoU ≥ 0.999, holes and `color_off` ≤ 0.001 |
| `zi_H*` hole_leak | 0 / 112 px: today's path keeps the z^i hole empty (the spec expected it filled) | 0 |
| the rest (exp, e^{1/z} at alpha ≥ 0.85, far disc, e^{z²}, healed cut) | IoU 1 (≥ 0.9995), holes ≈ 0, spill 0, parity 1 where one sheet, opacity 1, `color_off` ≈ 0 | must stay |

---

## Performance suite (`test/regress/perf/`)

```sh
test/regress/perf/run.sh                        # ~9.5 min full suite (+ ~1-2 min when failures are re-checked)
test/regress/perf/run.sh --swiftshader          # the same plus the opt-in SwiftShader runner (~1.5 min more)
test/regress/perf/run.sh --only '^swiftshader'  # only the SwiftShader runner (SPEC 4.7 ratio gate)
test/regress/perf/run.sh --only '^image\.logUHP'  # a subset of units (regex over unit ids)
test/regress/perf/run.sh --no-confirm           # do not re-run failing units (see "Noise and re-runs")
node test/regress/perf/run.js --list            # the units
python3 test/regress/compare_perf.py --all      # every metric of the last run against the baseline
```

`run.sh` prints the FAIL and IMPROVED lines and a verdict; exit 0 = pass, 1 = regression, 2 = setup problem.

Files: `run.sh` (the one command), `run.js` (runner), `cdp.js` (Chrome launcher + CDP client), `inject.js`
(in-page instrumentation), `scenes.js` (saved states of the scenes), `selftest.js` (tests of the runner's own
measuring code: settle with a pending compile, compile stats, the scrub scene's pole, view_moved at rest; ~30 s),
`merge_runs.py` (median-merges result files),
`make_baseline.py` (3 full runs → baseline), `baseline.json`, `results/` (`latest.json` = the gated result,
`latest-attempt1.json` = before re-checks, timestamped copies, the runs behind the baseline). `run.js` options:
`--reps N` (default 3), `--only REGEX`, `--skip REGEX`, `--quick` (10 units, 2 reps, ~2.8 min; the gate while developing, the full suite gates each phase), `--swiftshader` (also the opt-in unit `swiftshader.ratio`), `--out FILE`, `--base URL`, `--serve`.

### How it measures

* Every run starts a fresh headless Chrome with a throw-away profile (`cdp.js`; flags recorded in `meta.browser`),
  viewport 1440×900 at DPR 1, light theme. Shader program caches are disabled
  (`--disable-gpu-program-cache --disable-gpu-shader-disk-cache`) so every compile is cold and no run inherits a
  cache from another.
* Each unit opens `dist/test.html?ns=<unique>` with a saved state written before the app starts (`scenes.js`), waits
  for MathJax and for the app to settle, then drives it with **real CDP input**: mouse drags (middle button pans a
  plane, left button orbits the 3D views; 40 moves 16 ms apart, there and back), wheel zoom gestures (24 wheel
  events of deltaY 50 = ×1.083 each, one every 16 ms, in (×6.8) and then out), hover sweeps, label scrubs.
* `inject.js` runs before the app's scripts and only observes:
  * wraps `requestAnimationFrame`: per animation frame the **main-thread time** of the app's callbacks (`cpu`), and,
    when the frame issued WebGL draws, a 1-pixel `gl.readPixels` right after it, which waits for the GPU (`gpu`).
    `frame = cpu + gpu` is the **GPU-synchronised frame time**. The raw rAF intervals are recorded too (info only:
    headless frames are vsync-capped at 60 Hz, so intervals mostly show the cap).
  * wraps `addEventListener` for input events: main-thread time of every listener call, summed per dispatched event.
  * wraps WebGL `bufferData / texImage2D / texImage3D / texStorage2D/3D / renderbufferStorage*` and the matching
    `delete*` calls: **live bytes** of buffers, textures and renderbuffers (+ the peak). Drawing buffers are reported
    separately in `details` and are not gated.
  * watches `#leftLed` / `#rightLed` (`led ok | busy | err`, set by `updateLeds()` while the fix-up job `fixJob`
    runs) and the time of the last WebGL draw; collects Long Tasks (≥ 50 ms); counts how often an LED turned busy.
  * (P0) wraps `shaderSource / attachShader / linkProgram / getProgramParameter / useProgram`: one record per linked
    program (link time; the time the app first saw it complete, through `COMPLETION_STATUS_KHR` or a `LINK_STATUS`
    query; whether it is an **inverse program**, i.e. its fragment shader contains the SPEC 4.1 walker `invWalk` /
    `uInv`), and per frame the number of draws made with an inverse program. Nothing here exists before P2, so the
    inverse fields read 0 / null on today's code.
* **Settled** = neither LED is `busy`, no program compile is pending (`GLR.frameStatus().pending`: while a program
  compiles the app draws a stand-in or nothing, and the LEDs do not show compiles; P0 review), and there has been no
  WebGL draw and no LED change for 600 ms (longer than every debounce in the app: 200 ms `sourceViewChanged`, 160 ms
  `scheduleFix`, 150 ms thumbnails). The settle time is the time from the end of the input to the last such
  activity. A view that never settles within 20 s fails (`*.settled` check, value null).
* Each interaction is repeated `--reps` times (3). Frame/latency/input percentiles are taken over the frames and
  events **pooled from all reps** (≈ 240 frames for a pan); other values are the median of the reps (the per-rep
  values are kept in `reps`). One-shot costs (remesh, `Region.buildMesh`) use the minimum over their repetitions
  (noise only adds to a fixed cost).
* Every metric records the unit it came from (`unit_id`), so failing units can be re-run on their own.

### Scenes and units

Scenes (`scenes.js`): `default` = the first-visit example (strip |Im z| < π/2 → exp → Möbius (w−1)/(w+1)),
`logUHP` = log of the upper half-plane (unbounded; today its image strip is cut off at both ends), `chain4` = disc +
grid through z+0.3+0.2i → z² → Cayley (z−i)/(z+i) → log (a pole and a cut inside: heavy fix-ups), `scrub` = disc +
polar grid through a disk automorphism (Möbius, scrubbable φ), `cubic` = disc through z³−1 (three preimages).

| unit | what runs |
|---|---|
| `mesh` | `Region.buildMesh` called directly in the page for 11 shapes (6 bounded kinds, 5 unbounded) at Q = 60/120/480 (= meshN 240/480/1920 ÷ 4), window [−4,4]×[−3,3] |
| `image.<scene>.m<N>` | Image mode, scene ∈ default/logUHP/chain4, mesh N ∈ 240/480/1920: statics, remesh, pan L, pan R; at N = 240 also wheel zoom on both planes |
| `phase.default` | Phase mode: pan both planes |
| `landscape.default`, `sphere.default`, `sphere.logUHP` | orbit (left-drag) of the right plane in Landscape / Sphere. `view_moved` compares screenshots of the dragged pane taken with the pointer outside the panes and the view settled, before and after the first leg (hovering a pane changes it by itself) |
| `examples` | `__cmwExample(i)` for all 14 examples, in order, in a fresh page per rep |
| `scrub` | drag the φ label of the Möbius step ±160 px (φ ±40°) |
| `hover.default`, `hover.cubic` | 60-move sweep over the right plane (Image mode): preimage tracking |

**Units of SPEC 12.5 (phase P0).** Scenes: `ziH` = z^i (powa α = i) of the upper half-plane, `expH` = exp of the upper
half-plane (both with infinitely many sheets), `disc_cube` / `joukowski` / `annulus_log` / `poly_mobius` = the quality
suite's bounded golden scenes (same maps, shapes and views, the perf look), `mobius_halfplane` = a disk automorphism
(scrubbable φ) of the upper half-plane, `hoverdim` = exp of the upper half-plane plus a small disc, `gridCircles` = a Line grid plus six circles, a glider and a disc under z². (`mobius_halfplane` was changed in the P0 review: it now
ends with (1 + w)/(1 − w), so its pole blaschke^−1(1) moves with φ and crosses the half-plane's boundary during each
drag; φ starts at 40°, the right view is (0, 60).) Their right views
are pinned (the quality suite's views), so a change of the auto-fit cannot change what they measure.

| unit | what runs |
|---|---|
| `image.ziH.m240`, `image.expH.m240` | Image mode, right plane: statics, pan R, wheel zoom R in / out (each with its settle), dpr 1. When an inverse program was linked during the load, the unit first waits (≤ 5 s) for a frame drawn with it. `inverse_drawn` (check): when the app says a shape of the right plane is inverse (`__cmwPaths`, P2), or without that hook an inverse program was linked, the unit's draws must include inverse draws (before P2: true) |
| `image.ziH.m240.dpr2`, `image.expH.m240.dpr2`, `image.disc_cube.dpr2` | the same at **device pixel ratio 2** (`Emulation.setDeviceMetricsOverride`, viewport still 1440×900 CSS px: 4× the pixels; reset to 1 after the unit). `*.dpr_ok` checks that the page really ran at dpr 2 |
| `sphere.ziH` | Sphere view of `ziH`: orbit (as `sphere.logUHP`) |
| `sphere.globeL0` (P3) | X Sphere at stage 0 (`leftSphere: true` in the saved state, which both apps read): the upper half-plane of `logUHP` on the z-globe, orbit of the **left** pane. Since P3 one exact inverse pass over the globe (a region through infinity covers the north pole); in the reference the lifted mesh (notes/ui-design/panels.md 11) |
| `scrub.mobius_halfplane` | drag the φ label ±160 px (φ 40° → 80° → 40°); the chain's pole crosses the half-plane's boundary at φ = 61.93° in each drag (`pole_crossed`: computed from the φ values the drags produced). Besides the frame metrics it counts line resampling (`Region.sampleCurve`) and line uploads (`GLR.createLines`) during the drags (`no_line_resample` must stay true: P4 refines lines on settle only, keyed by structural singular points, which this scrub moves) and while it settles (info) |
| `gallery.open` | click Examples; time until every gallery thumbnail has its image, the frames meanwhile, programs linked, and inverse programs among them (`no_inverse_compiles`: side chains never start an inverse compile, SPEC 4.4 / 10.7). A fresh page per rep |
| `hover.dim` | on `hoverdim`, 12 visits alternating between the two rows of the shape list (each dims the other shape to half alpha): frame times, programs linked (`no_compile`), LED busy starts (`no_job`: no fix-up or SphereMesh job, SPEC 8.8), and `dimmed` (the right pane really changed) |
| `pointer.hover_point`, `pointer.hover_orth` | wave 1's pointer work (#63; `notes/ux-build/w1-review-regress.json` regress-6): on `gridCircles` (a Line grid plus six circles, a glider on the unit circle, a disc), a 60-move sweep over X with the Point tool and with Orthogonal (the snap and detent search on every move): pointermove handler p50 / p95, frames, latency; the ring's chip on a grid line is recorded (`details`) |
| `pointer.snap_drag` | on `gridCircles`, the disc dragged by its body with Snap on across the grid (anchorMove's snap search on every move): handlers, frames, latency, settle; `moved` (the disc moved) |
| `pointer.glider` | on `gridCircles`, the glider dragged round the unit circle from 36° to 300° (railDrag's detents and dwell timer on every move): handlers, frames, latency; `on_circle` (still a glider, on the circle, moved) |
| `pointer.probe_x` | on `default`, a sweep over X with the select tool (the hover probe's readout on every move): handlers, frames, latency |
| `pointer.roots_morph_pan` | example 10 (Roots as preimages, with targets) with the deformation playing, a 40-move pan of Y (regress-7: the target note in every Y render, the undo state in every overlay frame): handlers, frames, latency, jank; `playing` |
| `swiftshader.ratio` (opt-in) | a separate runner, run only with `--swiftshader` or when `--only` names it (a full run without it lists it in `meta.optInSkipped`, and `compare_perf.py` reports its baseline metrics as SKIP, not missing; `run.sh --update-baseline` records it). Its **own** headless Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader` (CPU WebGL2): for each bounded golden scene, pan R there and back (1 rep: SwiftShader frames take 50–130 ms here) with exact images on (default) and off (`__cmwSet('exactImages', false)`); `ratio` = frame p50 on / off, gated absolutely at ≤ 3 (SPEC 4.7). With exact images on it waits for a pending compile and the first inverse frame; `inverse_drawn_on` (check): when the app says the shape is inverse (the cost guard may demote it, then it says forward) the pan must have drawn with the inverse program, or the ratio would compare forward with forward. Before P2 both are forward (ratio ≈ 1, `inv_draws_on` 0); `is_swiftshader` checks the renderer string |
| `examples` (extended) | per example also: programs linked, `compile_ms` (call → the last forward program seen complete; 0 when nothing new compiled), and for inverse programs (P2 on): their count, `inv_compile_ms`, `inv_first_draw_ms` (first inverse link → end of the first frame drawn with one; absolute limit 250 ms, SPEC 4.7) and `inv_after_call_ms`. A slow inverse compile outlasting the settle is waited for (≤ 5 s); an inverse program that never draws gets the whole window (a lower bound, never null: `never_drew`), the worst rep then counts instead of the median, and the metric carries `expect: true` whenever an inverse program was linked, so a null value fails |

Every image / sphere unit of the list also reports `inv_draws` (info): the draws made with an inverse program during
the unit, so a result shows which path it measured.

`--quick` now also runs `image.ziH.m240.dpr2` (the costliest per-pixel inverse case of SPEC 12.5); measured 2 min 45 s
wall for the 10 units. The other new units are in the full suite, which grows by about 2.5 min (5 image units of
~17 s, `sphere.ziH` 19 s, `scrub.mobius_halfplane`, `gallery.open` and `hover.dim` ~11 s each). The settled shots of
`view_moved` (P0 review) add about 4 s to each orbit unit and 8 s to `phase.default`. A full run with
`--swiftshader` after the P0 review (`results/p0fix-full.json`, load 4–7) took 12.4 min, 0 errors, every check true.

**Values on today's code** (one run of each new unit, 2026-10-19, `results/p0-newunits.json`; measured build
`dist/test.html` sha1 `04aa240d1958`, the quality baseline's app, built from the pre-sphere sources
(`notes/backup-pre-sphere/src`); the `src` hash in the result's meta differs only because other owners had started
editing `src/` (`inverse.js`, `region.js`), which that build does not contain; measured while other agents loaded the machine (load 4–8), so they show that the units work,
**not** what the baseline will be — the lead records that on a quiet machine):

| unit | today |
|---|---|
| `image.ziH.m240` / `.dpr2` | pan R frame p50 4.7 / 5.1–5.7 ms, zoom R in p50 3.7 / 3.7–5.7 ms, settle 0 ms, 3,742 fix-up triangles, `inv_draws` 0; dpr 2 canvas 820×1032 |
| `image.expH.m240` / `.dpr2` | pan R p50 6.9 / 6.3–7.4 ms, zoom R in p50 6.1 / 6.3–6.7 ms, 40,195 fix-up triangles |
| `image.disc_cube.dpr2` | pan R p50 4.4–4.9 ms, zoom R in p50 3.1–4.5 ms |
| `sphere.ziH` | orbit p50 4.6 ms, p95 7.1 ms, settle 797 ms |
| `scrub.mobius_halfplane` | (scene changed in the P0 review; `results/p0fix-full.json`) frame p50 8.3 ms, p95 11.6 ms; φ 40° → 80° → 40° in every drag, the pole from 0.986 + 0.168i to 0.982 − 0.190i and back (`pole_crossed` true); line uploads 0 and samples 0 during the scrubs and while settling (`no_line_resample` true) |
| `gallery.open` | 14 thumbnails in 1.16–1.18 s, settled 1.31 s, 20 programs linked, 0 inverse, jank 0 |
| `hover.dim` | frame p50 10.7–13 ms, p95 13.3–14.5 ms; 0 programs, 0 jobs (`no_compile`, `no_job`, `dimmed` true) |
| `swiftshader.ratio` | renderer SwiftShader (Vulkan 1.3.0, LLVM 10); pan R p50 on / off: disc_cube 88.3 / 88.0 ms, joukowski 70.8 / 73.3, annulus_log 113.7 / 115.2, poly_mobius 54.5 / 54.8; ratio 0.97–1.00 (0.85–1.10 in a 2-rep run): both forward today |
| `examples` | `compile_ms` 0 (examples 0–1: nothing new to compile) to 210–260 ms (examples 9, 11, 12, 13: 2–9 programs); `inv_programs` 0 and the `inv_*` timings null everywhere |

### Metrics

Names are `<unit>.<scenario>.<metric>`; e.g. `image.logUHP.m240.zoomR.in.settle_ms`.

| metric | kind | meaning |
|---|---|---|
| `frame_p50_ms`, `frame_p95_ms` | frame_ms | GPU-synchronised frame time (main thread + GPU) of the frames during the interaction |
| `cpu_p95_ms` | frame_ms | main-thread part of those frames |
| `fps` | throughput | frames per second while dragging or zooming (an input event every 16 ms, so ≈ 55–60 when frames are cheap) |
| `latency_p95_ms` | latency_ms | input event → end of the frame that showed it (includes waiting for vsync) |
| `input_p95_ms` (`input_p50_ms`) | cpu_ms | listener time per input event (pointermove / wheel); for hover this is the preimage-tracking cost per pointermove |
| `settle_ms` | settle_ms | end of input → view fully refined (LEDs idle, nothing drawn for 600 ms) |
| `settle_jank_ms` | jank_ms | longest frame or long task between the end of the input and settled (remesh / fix-up frames) |
| `settled`, `view_moved`, `view_zoomed`, `value_changed`, `found_preimages`, `api_ok`, `suite.no_errors` | check | must be true: the interaction really happened (the plane followed the pointer: `__cmwW2S` moved by the drag; the 3D view changed: pane screenshot hash), the run had no page exception |
| `redraw_ms` | frame_ms | one full static redraw of both planes (`__cmwSet` no-op → next frame), median of 12 (the first, slower one dropped) |
| `remesh.frame_ms` | oneshot_ms | the frame that rebuilds every mesh after `__cmwSet('meshN', N)`, incl. GPU uploads (min of 5) |
| `remesh.cpu_ms` | info | its main-thread part (JIT warm-up makes it vary 2×; `mesh.*.build_ms` gates the meshing CPU cost) |
| `remesh.settle_ms` | settle_ms | until the fix-ups after that remesh are done |
| `gpu_live_bytes`, `gpu_peak_bytes` | mem_bytes | WebGL buffers + textures + renderbuffers after the scene loaded and settled / peak since page load |
| `gpu_live_end_bytes`, `gpu_peak_end_bytes` | mem_bytes | the same after all interactions of the unit |
| `tris`, `fix_tris`, `segs` | info | `__cmwInfo()`: base triangles, fix-up triangles, line segments (more triangles is not a failure by itself) |
| `cmwTime_left_ms`, `cmwTime_right_ms` | info | `__cmwTime(3)` at the end of the unit (its `getImageData` readbacks are slow and noisy) |
| `examples.<i>.first_frame_ms` | oneshot_ms | `__cmwExample(i)` call → end of the first frame that drew (includes the synchronous load) |
| `examples.<i>.settle_ms` | settle_ms | call (or pausing the playing deformation, example 5) → settled |
| `examples.<i>.gpu_live_bytes`, `gpu_peak_bytes` | mem_bytes | after settling / peak during that example |
| `examples.5.morph.fps`, `.frame_p95_ms` | throughput, frame_ms | the deformation playing for 1.5 s |
| `examples.<i>.call_ms`, `.tris` | info | synchronous part of `loadExample`; triangles incl. fix-ups |
| `mesh.<shape>.q<Q>.build_ms` | cpu_ms | `Region.buildMesh` time: the fastest of 9 calls (5 at Q 480) per rep, over 3 reps, after a warm-up call |
| `mesh.<shape>.q<Q>.min_angle_p5_deg` | quality_min | 5th percentile of the smallest angle of the mesh's triangles (stretched far-field grids give slivers ≈ 0.1°) |
| `mesh.<shape>.q<Q>.window_coverage` | coverage | meshed area of the shape inside the window ÷ true area of shape ∩ window (sampled on 800×600) |
| `mesh.<shape>.q<Q>.area_err` | quality_err | bounded shapes: relative error of the meshed area |
| `*.raf_p95_ms` | info | rAF interval p95 |
| `*.dpr_ok`, `*.no_line_resample`, `scrub.mobius_halfplane.pole_crossed`, `*.inverse_drawn`, `swiftshader.ratio.<scene>.inverse_drawn_on`, `gallery.open.no_inverse_compiles`, `gallery.open.all_thumbs`, `hover.dim.no_compile`, `hover.dim.no_job`, `hover.dim.dimmed`, `swiftshader.ratio.is_swiftshader` | check | (P0) see the units above |
| `*.inv_draws`, `*.line_uploads`, `*.line_samples`, `*.settle_line_*`, `*.programs`, `*.inv_programs`, `hover.dim.jobs`, `gallery.open.thumbs`, `examples.<i>.inv_compile_ms`, `examples.<i>.inv_after_call_ms`, `swiftshader.ratio.<scene>.inv_draws_on` | info | (P0) counts and inverse-path timings |
| `gallery.open.thumbs_ms`, `examples.<i>.compile_ms` | oneshot_ms | (P0) gallery click → every thumbnail drawn; example call → its last forward program ready |
| `gallery.open.settle_ms`, `gallery.open.jank_ms`, `gallery.open.frame_p95_ms`, `hover.dim.*` | as named | (P0) |
| `swiftshader.ratio.<scene>.ratio`, `examples.<i>.inv_first_draw_ms` | limit | (P0) absolute: value ≤ the metric's own `limit` (3; 250 ms); null passes only when nothing was there to measure (no `expect`) |

### Tolerances (compare_perf.py, `TOL`)

| kind | a metric fails when | reported IMPROVED when |
|---|---|---|
| frame_ms | new > max(1.15 × base, base + 2 ms) | new < min(base / 1.15, base − 2 ms) |
| cpu_ms | new > max(1.20 × base, base + 1 ms) | new < min(base / 1.20, base − 1 ms) |
| latency_ms | new > max(1.25 × base, base + 8 ms) | new < min(base / 1.25, base − 8 ms) |
| jank_ms | new > max(1.25 × base, base + 16 ms) | new < min(base / 1.25, base − 16 ms) |
| settle_ms | new > max(1.25 × base + 50 ms, budget_ms) | new < (base − 50 ms) / 1.25 |
| oneshot_ms | new > 1.25 × base + 50 ms | new < (base − 50 ms) / 1.25 |
| throughput | new < 0.90 × base | new > base / 0.90 |
| mem_bytes | new > 1.25 × base + 64 KiB | new < (base − 64 KiB) / 1.25 |
| quality_err | new > max(1.5 × base, base + 0.002) | new < min(base / 1.5, base − 0.002) |
| quality_min | new < base − 2° | new > base + 2° |
| coverage | new < base − 0.005 | new > base + 0.005 |
| check | not true (also while NEW: no baseline needed) | – |
| limit | new > the metric's `limit`, or null although `expect` is set (absolute: also while NEW) | – |
| info | never | – (the change is printed with `--all`) |
| (the relative kinds, not in the baseline) | never: reported as `NEW` with its value | – |
| (a paired run whose reference cannot run the unit, #292) | never: reported as `NEW` with the reason | – |

**A unit the reference cannot run (#292).** In a paired run (`run.js --ab`, `ci/perf_shard.js`) every scene a unit
opens records what it built and drew once settled: the steps' errors, and the shapes with a mesh or lines. When the
reference fails where the current build succeeds (a step that errs only there, a shape that draws only here, an
exception only it threw, or the unit itself failed only there), the reference lacks the feature the unit measures
(`phase.mandel` against wave 5, whose parser has no `iter()`: an empty plane). Its metrics then carry
`ref_unsupported` with the reason, and `compare_perf.py` reports the unit's metrics as `NEW`, not compared; the summary
lists such units with the reason, and the absolute kinds still hold. `--table` prints every metric, reference →
this change and its verdict, one line each (the GPU gate passes it to `ci/perf_shard.js`, so the job log carries the
numbers without the artifact).

**Noise envelope.** The baseline is the per-metric median of 3 full runs and keeps every run's value (`runs`).
For the timing and memory kinds the limit is never tighter than *the worst of those runs × 1.05* (the unchanged code
already measured that much), and IMPROVED also has to beat the best run ÷ 1.05. A metric whose baseline runs
scattered widely is therefore gated more loosely, automatically, instead of failing at random; a stable metric keeps
the tight rule above. The mesh-quality kinds are deterministic and have no envelope.

A metric also fails when it is missing from a full run or its value became null (a timeout, a scenario that broke).
In a partial run (`--only`, `--skip`, `--quick`) metrics that were not run are `SKIP`.

Why these: the absolute terms absorb the noise floor of small numbers (a 3 ms frame jitters by ±1 ms; latency is
quantised by the 16.7 ms vsync; a settle time contains timer debounces; a long frame after an input is a single
maximum), the relative terms catch real regressions in large ones. Where the measured run-to-run spread of the
unchanged code is wider than a rule (GPU-bound frames at mesh 1920 and in the 3D views swing by up to ±30 % between
page loads on this machine), the noise envelope widens that metric's limit to what was actually observed.

**`budget_ms` (right-plane refinement).** The current code never refines the right plane after a pan or zoom there,
so `image.*.panR.settle_ms` and `image.*.zoomR.{in,out}.settle_ms` are 0 ms in the baseline. The coming change
refines the image view on zoom; it may take as long as the *left* plane already takes to refine the same scene:
these metrics carry `budget_ms = 1.25 × (the same scene's L-side settle) + 50 ms`, and the limit is the larger of
the usual rule and that budget. Frame times and latency during those interactions stay gated as usual.

### What the coming change should look like in this report

* **Must stay PASS**: every frame / latency / throughput metric of pans, zooms, orbits, scrubs and hovers;
  memory; load times of the examples; the right-plane refinement within its budget; long frames after interactions
  (`settle_jank_ms`: CPU refinement must stay time-sliced like the fix-ups).
* **Expected IMPROVED** (never a failure): `mesh.<unbounded shape>.*.min_angle_p5_deg` if the far field is meshed on
  the sphere's second chart instead of a stretched grid; any timing that gets faster. The reach of unbounded images
  to the window edges is measured by the quality suite, where it shows as IMPROVED.
* **info only**: triangle counts (reaching the edges may need more triangles; their cost is gated through frame
  times and memory).
* If `Region.buildMesh` changes its contract (e.g. returns two charts), `mesh.*.api_ok` fails loudly: adapt
  `MESH_BENCH` in `run.js` (map the u-chart's vertices back with z = 1/u) and keep the metric names.

### Noise and re-runs

Headless timing on a shared machine is noisy: on Apple silicon the GPU and CPU clocks ramp with load, threads move
between performance and efficiency cores, and any other headless Chrome (the quality suite, other agents) competes
for the same GPU. Two runs of identical code can differ by 30–50 % in one unit while every other unit agrees. The
suite reduces the noise (GPU-synchronised frames, pooled percentiles over ≈ 240 frames, medians of reps, minima for
one-shot work, cold shader caches every time) and then **confirms failures**: `run.sh` re-runs every unit that has a
failing metric twice more and gates the median of the 3 attempts (`merge_runs.py`; `latest-attempt1.json` keeps
the first attempt). A real regression is reproducible and fails again; a one-off disturbance does not.
`--no-confirm` turns this off. `compare_perf.py` also warns when the load average at the start of the run was high or
when the machine, browser or GPU differ from the baseline's (timings are then not comparable: record a baseline on
that machine). Do not run other heavy work (another headless Chrome, a build, the quality suite) during a perf run.

### Accepted exceptions (user consent, 2026-10-21)

The user accepted two documented exceptions: "accept the documented GPU-memory exceptions (and the z^i 30%-opacity
Retina zoom at the 14 ms line), and re-record the 8 bounded reference images with the corrected strokes."

- **Perf: `perf/accepted.json`.** Each entry names one metric, a cap (`max`) and the reason. `compare_perf.py` reports a
  listed FAIL as `ACCEPTED` only while the value stays at or below its cap; above the cap it FAILS again. Entries:
  GPU memory of the Phase scenes (`phase.default.*`, `examples.0/9/10/11/12`), which grew from about 1.2 MB to
  2.6-3.9 MB because the right pane now always shows the images (the user's left = X / right = Y design), and the
  zoom frame/latency of `image.ziH.a30.dpr2` (z^i of H at 30 % opacity on Retina, 12-14.7 ms per frame, inside 60 fps).
  A second consent (same day): the GPU memory and post-zoom settle time of the two hard essential-singularity
  chains drawn by the P5 SphereMesh, `image.custom_e_z1z.m240` (e^{z+1/z}) and `image.expexp_H.m240` (exp(exp z)).
  Example 9's mesh cost is explicitly NOT excepted: it is fixed at the root (inverse support for rational formulas).
  Add an entry only with the user's consent.
- **Quality: the 8 bounded goldens** (`disc_cube`, `joukowski`, `annulus_log`, `poly_mobius`, mask and pattern) were
  re-recorded from `notes/milestone-p3/` (the P3 build). The old goldens had recorded a stroke defect that P3 fixed
  (beaded, dotted strokes on annulus_log's left rim and over-drawn 2 px strokes elsewhere; SPEC 13.17); every
  difference was on boundary strokes, and fill metrics stayed IoU 1, holes 0. The old goldens and baseline are kept in
  `quality/golden-pre-p3/` and `quality/baseline-pre-p3.json`.

### The 60 fps budget (user's rule, 2026-10-20)

"60 fps is enough." A frame, latency, jank or throughput metric that is worse than its relative tolerance still
PASSES when it stays inside an absolute 60 fps budget with headroom: frame (main thread + GPU-synchronised) <= 14 ms
of the 16.7 ms frame (2.7 ms left for the browser's compositor; first set at 12 ms, raised by the lead on 2026-10-20
after the P2 gate showed exact dpr-2 low-opacity frames at 12-14.6 ms, all inside 60 fps), input-to-display latency <= 40 ms, longest frame after an input <= 20 ms, >= 55 frames/s while
dragging (`BUDGET60` in `compare_perf.py`; the PASS line says "within the 60 fps budget"). Memory, settle times,
one-shot latencies and CPU work keep their relative rules. Image quality is never traded for frame times below 60 fps.

### Paired gate (preferred while the machine is in use)

`test/regress/perf/run.sh --paired [--quick]` needs no stored baseline. It builds the reference app from a source
snapshot (`PERF_REF_SRC`, default `notes/backup-pre-sphere/src`, with `PERF_REF_BUILD`, default
`notes/backup-pre-sphere/build.py`) into `perf/ref_root/dist`, then runs every unit on the reference and on the
current app back to back, alternating which side goes first (fixed per unit by its id; `run.js --ab-flip` swaps every
unit's order), each side in its OWN headless Chrome (own profile and GPU program cache, identical warm-up page; a side
waits on a blank page while the other measures), and gates current against reference with the usual tolerances. A
busy machine slows both sides alike instead of failing the comparison. Results: `perf/results/paired-<stamp>.json` (current) and
`paired-<stamp>-ref.json` (reference); `paired-latest*.json` are copies of the last pair. A failing metric should be
confirmed by re-running that unit's pair (`--paired --only 'unit'`, and once more with `--ab-flip`) before it is
called a regression.
**Layouts (merged views, `notes/ui-design/merged-views.md`).** The reference shows the Phase, Landscape and
phase-sphere views in its right pane, beside the shapes plane; the current app shows them as one wide panel (the top
bar's Phase and Landscape views). The page says where each picture is: `__cmwPaneOf(mode, sphereMode)` names the pane
of the view itself (pane L, full width), `__cmwOtherPane(mode, sphereMode)` the old layout's other pane, or `null` when
the view is one merged panel, and `__cmwLayout()` the current layout (`main`, `deform`, `merged`, `shown`, pane widths).
In the mode units `.panR` / `.orbit` drag the view's own pane on both builds; `.panL`, the shapes plane beside the old
view, pans X's plane in the X → Y view on the current build (the same picture at the same pane width; the unit
switches back before `.panR`). Quality scenes are Image scenes and render in X → Y, where the panes keep their size.
The mode units of a merged view record `<unit>.viewWidth` in the details: their `.panR` / `.orbit` drag the full-width
panel (about twice the reference pane's width), so those metrics compare a 2x-wider picture with the reference's pane;
the metric history before the merged views is not continuous with them.
`morph.play.views` (merged-views review) plays the deformation for 2 s in the Phase and Landscape views (`default` and
`scrub` scenes): H_t painted in the full-width panel at every frame. The reference has no deformation of its phase pane
(the toggle switches its right pane to the old Morph view), so it is like-for-unlike there and gated by the absolute
60 fps budget (BUDGET60); `<unit>.view` in the details says which picture played on each side.
Self-test (2026-10-19, machine under load 4-8, reference against an identical copy of itself, --quick): 665 metrics,
0 FAIL, 4 IMPROVED (noise). An earlier version that shared one browser between the sides showed a cache-order bias
(4 FAIL, 10 IMPROVED); that is why each side has its own browser.

### Updating the baseline (deliberately)

Only after a change that is *meant* to alter performance, with the reason written down (commit message / PR):

```sh
test/regress/perf/run.sh --update-baseline
```

runs the full suite 3 times, the opt-in SwiftShader runner included (~33 min; `PERF_BASELINE_RUNS=N` to change) with `--require-quiet` (a run aborts when the 1-minute load average is above `--load-max`, default max(4, 0.45 x cores): never record a baseline while agents, builds or another browser are busy), merges the runs per metric with the median
(`make_baseline.py`, which also keeps each run's value for the noise envelope), prints the merged result against
the OLD baseline for review, and replaces `perf/baseline.json` (the runs and the merged file stay in
`perf/results/`). Never update the baseline to make a failure go away without understanding it; never record it
with `--only/--skip/--quick` (refused) or on another machine than the one that runs the gate. Adding a scenario
changes the metric set: record a new baseline in the same commit. (Exception, P0: the SPEC 12.5 units were added
without one; their metrics show as NEW until the lead records the baseline on a quiet machine.)

### Validation on the current code

See the section at the end of this file (filled in when the baseline was recorded).

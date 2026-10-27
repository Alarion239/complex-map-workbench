# CI: the gate on GitHub

The gate that every version passes (unit tests, GLSL tests, the image-quality suite, the perf suite with its 60 fps
budgets: [test/regress/README.md](../test/regress/README.md)) runs on GitHub Actions, in two workflows:

| workflow | where | when | what it can tell |
|---|---|---|---|
| **Gate** (`.github/workflows/gate.yml`) | GitHub's machines: Linux, Windows, macOS | every pull request, every push to `main`, by hand | correctness everywhere; slowdowns relative to the reference and shader-compile costs (software rendering) |
| **GPU gate** (`.github/workflows/gpu-gate.yml`) | our Windows laptop and Mac ([RUNNERS.md](RUNNERS.md)) | every push to `main`, nightly, by hand, pull requests labelled `gpu-gate`; each run after an approval | the same on real GPUs: real frame rates |

Both are split into many jobs (a GitHub job may run for 6 hours; the GPU machines' jobs for 5 days, but short jobs
show results sooner and can be re-run alone).

## What runs

| job | what |
|---|---|
| **Unit tests** (Linux) | every `test/t_*.js`, and the gates' own tests (`test/regress/test_compare.py`) |
| **GLSL** (Windows in 7 parts, macOS 3 pages) | the GPU-vs-CPU conformance pages (`test/glsl_test.js`, `glsl_test_adv.js`, `glsl_inverse_test.js`) on each platform's shader compiler (Direct3D 11's, Metal's), paired: this change fails only where it is worse than the reference on the same machine |
| **Quality** (3 shards × 3 systems) | the image-quality suite, paired |
| **Perf** (10 shards × Windows, macOS) | the perf suite, paired: desktop units and the **emulated phone** |
| **Gate** | passes only when every job above passed: make it the required check |

### Paired gates

GitHub's machines differ from run to run and render in software, so a stored baseline means nothing there. The
quality and perf jobs are **paired**: they build the **reference** app (a pull request's base commit; for a push to
`main`, the previous `main`; by hand, any commit) in a git worktree under `.ci/`, then run every scene or unit on the
reference and on this change back to back, on the same machine, and gate this change against the reference with the
suites' own tolerances (`compare_perf.py --paired` with its 60 fps budget and `perf/accepted.json`;
`compare_quality.py`, the bounded controls' golden diff taken against the reference's renders). A failure is re-run: a
failing perf unit twice more on both sides, with the sides swapped (on GitHub's macOS machine the side measured second
is slower), and a metric fails only when the medians of the 3 attempts fail and most attempts, each against its own
reference, fail too, a failing quality run once more (it fails only if it fails
twice). A perf check or absolute limit that fails on the reference too (a software renderer misses the 250 ms first
draw of an inverse program, or a 6 ms mesh slice, whatever the change) is listed as such and does not fail. When a
change does not touch the app (`src/`, `build.py`), the paired jobs report "nothing to compare" and pass.

GitHub's machines are virtual and shared: two runs of the same app there differ by tens of percent (a change that does not touch rendering showed
−90 % … +300 % on single settle times), so the Gate's perf jobs widen the timing allowances 3-fold (`--tol-scale 3`: a
frame may take 1.45 × the reference's, frames per second may drop to 0.70 ×, GPU memory, whose peak depends on how far
the view refined, may grow to 1.75 ×) and catch gross slowdowns, a shader that
takes far longer to compile, a check that breaks. The suite's own tolerances (1.15 × a frame, 0.90 × the frames per
second) apply on our own machines, in the GPU gate.

On the Mac with a GPU, quality is also gated against the committed baseline and goldens (`--absolute`), which were
recorded on a Mac GPU.

### The phone

The perf shard `phone` emulates a phone in the same headless Chrome: a 390 × 844 mobile viewport at device pixel
ratio 3 (the app's phone layout), touch input, and the page's main thread slowed 4× (DevTools' mid-tier mobile; the
GPU stays the machine's). Units: opening the app, one-finger pans, Landscape orbits, the deformation playing,
loading examples (`test/regress/perf/run.js`, `phone.*`). It runs on every machine of both workflows. It is an
approximation of a phone, not a phone.

## Reading the results

Open the run (*Actions*, or the checks of a pull request), then a job: its **summary** lists every metric that got
worse (reference → this change, with the rule it broke), what improved, and the renderer it ran on. The raw results
(perf JSON, quality renders and maps) are the run's **artifacts**, kept 14 days (GPU gate: 30).

## Approvals and safety

- A pull request from someone outside the repository runs no workflow until a maintainer approves it (*Settings →
  Actions → General → Approval for running fork pull request workflows from contributors: Require approval for all
  external contributors*; [RUNNERS.md](RUNNERS.md) section 1).
- The GPU gate never runs a fork's pull request, and each of its runs waits for an approval in the `gpu-runners`
  environment.
- To make the gate binding: *Settings → Branches → Add branch ruleset* (or *Add rule*) for `main` → *Require status
  checks to pass* → add **Gate**.

## Running a job by hand

*Actions → Gate (or GPU gate) → Run workflow*: choose the branch, optionally the reference (a commit or branch), only
some perf shards (e.g. `views,phone`), and *force* to run the paired gates when the app did not change (an A/A run of
the same app on both sides shows the noise).

## Locally

The same scripts run on a developer machine (Chrome, Node 22, Python 3):

```sh
node ci/snapshots.js && node ci/unit.js            # unit tests (snapshots: old versions some tests compare with)
node ci/glsl.js                                    # GLSL conformance in headless Chrome
node ci/quality.js --ref origin/main               # image quality, paired against main (--shard 1/3 for a part)
node ci/perf_shard.js --shard views --ref origin/main   # one perf shard, paired against main
node ci/perf_shards.js matrix                      # the shards; check: every perf unit is in exactly one
node ci/gpu_probe.js                               # the renderer headless Chrome gets here
```

Settings (environment variables):

| variable | meaning |
|---|---|
| `CMW_ANGLE` | Chrome's ANGLE back end: `metal` (macOS default), `d3d11` (Windows default), `swiftshader` (default elsewhere; CPU rendering) |
| `CMW_CHROME_ARGS` | extra Chrome flags, space-separated (CI on Linux: `--no-sandbox`) |
| `CHROME_BIN` / `CHROME` | Chrome's path for the perf / quality runners, when it is not in the usual place |
| `CMW_SPEED_SCALE` | scales the construction tests' absolute speed limits (set on the development Mac); CI uses 3 |
| `PYTHON` | the Python the scripts call (default `python3`; `python` on Windows) |

## Files

| file | |
|---|---|
| `ci/unit.js` | all unit tests, one summary row each |
| `ci/snapshots.js` | the old source snapshots some unit tests compare with (v13, v16.2, v16.3), from the git history |
| `ci/glsl.js` | the GLSL conformance pages |
| `ci/quality.js` | the paired image-quality gate |
| `ci/perf_shard.js`, `ci/perf_shards.js` | one paired perf shard; the shards |
| `ci/reference.js` | builds the reference app in a worktree under `.ci/` |
| `ci/gpu_probe.js` | the renderer; `--require-hardware` on our GPU machines; `--fallback` on GitHub's |
| `ci/lib.js` | a static server, the job summary, running commands |
| `ci/RUNNERS.md` | setting up our Windows laptop and Mac as runners |

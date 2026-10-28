# CI: the gate on GitHub

The gate that every version passes (unit tests, GLSL tests, the image-quality suite, the perf suite with its 60 fps
budgets: [test/regress/README.md](../test/regress/README.md)) runs on GitHub Actions, in two workflows:

| workflow | where | when | what it can tell |
|---|---|---|---|
| **Gate** (`.github/workflows/gate.yml`) | GitHub's machines: Linux, Windows, macOS | every pull request (in its [tier](#ci-tiers)), every push to `main`, by hand | correctness everywhere: unit tests, shader conformance on Direct3D 11 and Metal, image quality; until the GPU machines are registered, also the perf suite's checks (its timings only reported) |
| **GPU gate** (`.github/workflows/gpu-gate.yml`) | our Windows laptop and Mac ([RUNNERS.md](RUNNERS.md)) | every push to `main`, nightly, by hand, pull requests labelled `gpu-gate`; each run after an approval | speed with the suite's own tolerances on real GPUs (desktop and the emulated phone), and the same correctness checks there |

Both are split into many jobs (a GitHub job may run for 6 hours; the GPU machines' jobs for 5 days, but short jobs
show results sooner and can be re-run alone).

### How long it takes (GitHub's machines, measured)

| job | time |
|---|---|
| Unit tests | 5–7 min |
| Quality, each of the 9 shards | 3–6 min |
| GLSL on macOS, each page | 2–5 min |
| GLSL on Windows (software rendering) | `glsl` 1/8: 8–24 min; `inverse`, whole: 34–35 min; `adv`: `direct,keys,compile` 34 min, its chains 2 min a quarter (see below) |
| Perf on Windows, each shard | 5–21 min; up to 36 when a unit is re-run |
| Browser, each of the 24 shards (Linux, lavapipe) | 7–16 min: a minute of setup and 6–15 min of suites (each suite's time is in `ci/browser_shards.js`) |

The `adv` page splits only its chains (`main`) into parts; its other sections (`direct`, `keys`, `compile`: 12-step
chains and the largest shaders) run whole, so in parts they ran once per part (a quarter of the page took 33–48 min,
an eighth 34–61). On Windows the Gate runs `adv` as two jobs (`--sections`): those sections, and the chains.

The whole Gate took 48, 61 and 34 minutes on its first three complete runs (every GLSL page ran, and the perf suite;
the last with `adv` in sections). A pull request that touches no shader code or GLSL test skips the GLSL pages and,
once the GPU machines are registered, the perf suite: unit tests and quality, about 7 minutes. One that does is held
by two 34-minute jobs on Windows: the `inverse` page (one seeded sequence, not split) and `adv`'s sections.

## CI tiers

Agents' pull requests merge in **waves**: each goes into an integration branch, and one wave pull request from that
branch into `main` runs the whole gate once it is marked ready for review (or carries the label `full-gate`). So a
pull request runs only what it can affect. The plan job's **Tier** step (`ci/impact.js`) reads the files changed since the reference and picks the jobs:

| tier | for | what runs |
|---|---|---|
| **T0** | every change (docs, unit tests, dev tooling alone) | the plan and the unit tests (lint: `.github/workflows/lint.yml`) |
| **T1 UI** | layout, CSS, strings, menus, the tour, the phone, a browser suite, the CI scripts | T0, the browser shards of the areas touched, and the `smoke` shard (`test/smoke_cmd.js`: English and Russian, 1440 and 390 px, the chain, the planes, the view switch; under a minute) |
| **T2 core** | the renderer or the maths (`cx`, `parse`, `funcs`, `homrange`, `inverse`, `recognize`, `calc`, `region`, `curves`, `sphere`, `glsl`, `palette`), a GLSL, quality or perf test | T0, the GLSL pages whose inputs changed, quality (Linux only), the perf suite's checks, the `images`, `exact`, `deform` and `formulas` shards, and `smoke` |
| **T3** | a push to `main`, the nightly run (02:37 UTC), a run by hand, the label **`full-gate`**, a pull request into `main` that is not a draft (a wave PR marked ready for review), `src/app.js`, `src/gl.js`, `build.py`, or **any path the map does not know** | everything; quality on Linux, Windows and macOS |

- **The map** is one table in `ci/impact.js` (`MAP`, a comment per row; the shards of each area are `AREAS`): the
  first row whose pattern matches a path decides what it selects. A test helper or fixture selects the suites and
  unit tests whose source names it; a path nothing matches is T3 (fail safe). Every GLSL page whose inputs
  (`ci/glsl.js`: its builder, its test file, the sources it reads) include a changed path runs, on both platforms.
- **The same build:** when a change touches the app (`src/`, `build.py`), the plan builds the reference and this
  change; when both `dist/` files are byte for byte the same (a move, a refactor that keeps the concatenated sources),
  the app's paths select nothing, so such a change costs T0.
- **The summary** of the plan job shows the tier, each changed path with the row that matched and what it selected,
  the jobs that run, and what was skipped. The **Gate** job passes when every job the plan chose passed and the rest
  were skipped.
- **A wave PR** (the integration branch into `main`) can stay open as a **draft**: a draft runs its tier like any
  other pull request; marking it *ready for review* (the workflow listens to `ready_for_review`) runs the whole gate,
  and so does every later push while it is not a draft.
- **The plan's outputs** `tier`, `why` (one line: the reason of the whole gate, or what each path selected) and
  `browser` (the shards) are also in the **Gate** job's summary.
- **The label `full-gate`** on a pull request forces T3 (the workflow listens to `labeled`, so adding it starts the
  whole gate at once; adding another label restarts the run in its tier).

Before pushing, see the tier and run it locally (the browser shards need the environment of the browser jobs: Locally,
below):

```sh
node ci/impact.js --base origin/main --print       # what would run for this branch
node ci/impact.js --files src/tour.js,README.md    # ... for a hypothetical change
node ci/impact.js --base origin/main --run         # the unit tests and the selected browser shards, here
```

## What runs

| job | what |
|---|---|
| **Unit tests** (Linux) | every `test/t_*.js`, and the gates' own tests (`test/regress/test_compare.py`) |
| **Browser** (Linux, in shards) | the functional browser suites (`test/*_cmd.js`: the tour, constructions, touch, phone layouts, the i18n walks, export, sound, ...), each in its own headless Chrome against this build; their correctness checks gate, their timing checks are reported (see [Browser suites](#browser-suites)) |
| **GLSL** (Windows in 11 parts, macOS 3 pages) | the GPU-vs-CPU conformance pages (`test/glsl_test.js`, `glsl_test_adv.js`, `glsl_inverse_test.js`) on each platform's shader compiler (Direct3D 11's, Metal's), paired: this change fails only where it is worse than the reference on the same machine. A page whose shader code and tests did not change (the files its builder reads) is not run |
| **Quality** (3 shards × 3 systems) | the image-quality suite, paired |
| **Perf** (10 shards, Windows) | the perf suite, paired: desktop units and the **emulated phone**; its checks gate, its timings are reported (see below); only while the GPU machines are not registered (`GPU_RUNNERS`), or by hand (then macOS too) |
| **Gate** | passes only when every job the plan chose passed (perf: when it ran): make it the required check |

### Paired gates

GitHub's machines differ from run to run and render in software, so a stored baseline means nothing there. The
quality and perf jobs are **paired**: they build the **reference** app (a pull request's base commit; for a push to
`main`, the previous `main`; by hand, any commit) in a git worktree under `.ci/`, then run every scene or unit on the
reference and on this change back to back, on the same machine, and gate this change against the reference with the
suites' own tolerances (`compare_perf.py --paired` with its 60 fps budget and `perf/accepted.json`;
`compare_quality.py`, the bounded controls' golden diff taken against the reference's renders). A failure is re-run.
A failing perf unit runs twice more on both sides, with the sides swapped (on some machines the side measured second
is slower), and a metric fails only when the medians of the 3 attempts fail and most attempts, each against its own
reference, fail too. A failing quality run renders once more and fails only if it fails twice. A perf check or
absolute limit that fails on the reference too (a software renderer misses the 250 ms first draw of an inverse
program, or a 6 ms mesh slice, whatever the change) is listed as such and does not fail. When a change does not touch
the app (`src/`, `build.py`, `tools/src_parts.py`), the paired jobs report "nothing to compare" and pass.

GitHub's machines are virtual and shared, and their timings say little about this app's speed. Measured on changes
that did not touch rendering: single settle times from −90 % to +300 %; on macOS, within one attempt, wheel zoom
47–77 % faster and pans 47–156 % slower; on Windows, one input's CPU time 3.8 ms on one attempt of the reference and
14.8 ms on the next. No tolerance separates a regression from that. So the Gate's perf jobs are **advisory** for
timings and memory (`--advisory`, with 3-fold allowances, `--tol-scale 3`): what got worse is listed in the summary and
raises a warning, and does not fail the Gate. Their checks still gate: a view that does not move, a shader compile
during a hover, a missing value or a timeout, a page error. Speed is gated with the suite's own tolerances (1.15 × a
frame, 0.90 × the frames per second) on our own machines, in the GPU gate.

On the Mac with a GPU, quality is also gated against the committed baseline (`--absolute`), recorded on a Mac GPU: that
check reuses this run's metrics, whose bounded controls' golden diff was taken against the reference's renders, so
it reads only `test/regress/quality/baseline.json`'s metrics; the committed `quality/golden/*.png` are not diffed in
CI (they serve `test/regress/quality/run.sh` by hand). The GLSL pages `glsl` and `inverse` must also pass outright (`--absolute glsl,inverse`).
`adv` is paired only: it fails 304 values on the Mac, in 10 chains near removable singularities ((e^z − 1)/z,
(1 − cos z)/z², a cancelled rational, twelve#0–2), as every release since v14 did.

### The phone

The perf shard `phone` emulates a phone in the same headless Chrome: a 390 × 844 mobile viewport at device pixel
ratio 3 (the app's phone layout), touch input, and the page's main thread slowed 4× (DevTools' mid-tier mobile; the
GPU stays the machine's). Units: opening the app, one-finger pans, Landscape orbits, the deformation playing,
loading examples (`test/regress/perf/run.js`, `phone.*`). It runs on every machine of both workflows. It is an
approximation of a phone, not a phone.

## Browser suites

The functional suites in `test/*_cmd.js` (command files for the headless-Chrome daemon of `test/cdp_kit`) run in the
**Browser** jobs on GitHub's Linux machines: the shards a pull request can affect ([CI tiers](#ci-tiers)), and all of them on every push to `main`. `ci/browser.js` builds
the app, serves `dist/` on a free port, and runs each suite in a fresh copy of the daemon (its own Chrome and profile)
pointed at that server (the kit's port in the copy's `cdpd.js`, and `CMW_PORT` / `CMW_BASE` for the suites that read
them). It reads each suite's verdict from its result (`{ pass, fails }`, `{ pass, of }`), writes one summary row per
suite, an error annotation per failing suite, and the results (JSON; a failing suite's screenshots) as the job's
artifact.

- **New suites run with no edit:** every `test/*_cmd.js` runs unless `ci/browser_suites.js` excludes it (each with
  its reason: benchmarks, recorders and screenshot writers that give no verdict, suites another job runs, superseded
  release smokes, and suites that need the GPU machines). One not listed in `ci/browser_shards.js` runs in the shard
  `new`; move it to a shard once its time is known. The plan job checks that every suite is in exactly one shard.
- **Timing is reported, not gated.** Speed is gated by the perf suite on our GPU machines; GitHub's machines render
  WebGL in software (the browser jobs use Mesa's lavapipe, ANGLE's Vulkan back end on llvmpipe, which drew the app
  2-4 times faster there than Chrome's own SwiftShader: frames of 0.15-0.6 s at 1440 x 900). A suite's timing checks
  (BUDGET60 frame budgets, long tasks, the tour's 3 s advance to ±150 ms, …: `TIMING` in `ci/browser_suites.js`) are
  listed with their numbers in the summary and a warning, and do not fail the job. Where one condition also asserts
  something else (the drag drew frames, the step did advance), the check counts as timing only when that part held.
  Every other check gates.
- **Software-renderer failures** (`SOFTWARE` in `ci/browser_suites.js`): a few correctness checks need several frames
  in a short window (a voice update in each of 60 frames, a Loop that moves t within 1 s, a ring drawn 450 ms after
  a layer opens). Each is listed with its reason and a predicate on the check's own detail that holds only for that
  cause (no frame missed, t still moving, the program still compiling), is printed in the summary, and does not fail
  the job; the GPU machines run the suites at full speed.
- **A fresh Chrome per suite:** each suite starts on `about:blank` in a new profile (on a development machine one
  long-lived daemon runs many suites). A suite opens the app before it calls into it, and its first look at the console
  sees everything since Chrome started (`dist/favicon.ico` exists for that reason).
- **Extra pages:** the v16.2 and v16.3 test pages some suites compare with are built from their release commits
  (`ci/reference.js`), and the published page is wrapped as a host serves it (`smk_pub.html`, the release smoke).
- **Known failures** (`KNOWN` in `ci/browser_suites.js`): app bugs and open questions, each with its reason (and a
  predicate where the check's name covers more than the bug), are printed in the summary and do not fail the job.
  Fix the app, and remove the entry.

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
the same app on both sides shows the noise). The Gate's *perf* box runs the perf suite on GitHub's machines (Windows,
and macOS advisory) even when the GPU machines gate speed, e.g. while one of them is away.

## Locally

The same scripts run on a developer machine (Chrome, Node 22, Python 3):

```sh
node ci/snapshots.js && node ci/unit.js            # unit tests (snapshots: old versions some tests compare with)
node ci/glsl.js                                    # GLSL conformance in headless Chrome
node ci/quality.js --ref origin/main               # image quality, paired against main (--shard 1/3 for a part)
node ci/perf_shard.js --shard views --ref origin/main   # one perf shard, paired against main
node ci/perf_shards.js matrix                      # the shards; check: every perf unit is in exactly one
node ci/browser.js --only '^tour_cmd' --port 9950   # browser suites (--shard ID for a shard; a free port by default)
node ci/browser_shards.js check                    # every browser suite in exactly one shard
node ci/impact.js --base origin/main --print       # the tier of this branch (CI tiers)
node ci/gpu_probe.js                               # the renderer headless Chrome gets here
```

Settings (environment variables):

| variable | meaning |
|---|---|
| `CMW_ANGLE` | Chrome's ANGLE back end: `metal` (macOS default), `d3d11` (Windows default), `swiftshader` (default elsewhere; CPU rendering); the browser jobs use `vulkan` with Mesa's lavapipe (`mesa-vulkan-drivers`) |
| `CMW_CHROME_ARGS` | extra Chrome flags, space-separated (CI on Linux: `--no-sandbox`; the browser jobs add `--enable-features=Vulkan --use-vulkan=native --disable-vulkan-surface`) |
| `CHROME_BIN` / `CHROME` | Chrome's path for the perf / quality runners, when it is not in the usual place |
| `CMW_SPEED_SCALE` | scales the construction tests' absolute speed limits (set on the development Mac); CI uses 3 |
| `CMW_PORT`, `CMW_BASE` | the server some browser suites open (`ci/browser.js` sets both to its own) |
| `PYTHON` | the Python the scripts call (default `python3`; `python` on Windows) |

## Files

| file | |
|---|---|
| `ci/impact.js` | the tier and the jobs a change can affect (CI tiers); `test/t_impact.js` tests it |
| `ci/unit.js` | all unit tests, one summary row each |
| `ci/browser.js`, `ci/browser_shards.js`, `ci/browser_suites.js` | the browser suites, one summary row each; the shards; what the runner knows about some suites (excluded files, runs, extra pages, timing checks, software-renderer failures, known failures) |
| `ci/snapshots.js` | the old source snapshots some unit tests compare with (v13, v16.2, v16.3), from the git history |
| `ci/glsl.js` | the GLSL conformance pages |
| `ci/quality.js` | the paired image-quality gate |
| `ci/perf_shard.js`, `ci/perf_shards.js` | one paired perf shard; the shards |
| `ci/reference.js` | builds the reference app in a worktree under `.ci/` |
| `ci/gpu_probe.js` | the renderer; `--require-hardware` on our GPU machines; `--fallback` on GitHub's |
| `ci/lib.js` | a static server, the job summary, running commands |
| `ci/RUNNERS.md` | setting up our Windows laptop and Mac as runners |

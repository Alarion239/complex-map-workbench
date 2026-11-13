# CI: the gate on GitHub

The gate that every version passes (unit tests, GLSL tests, the image-quality suite, the perf suite with its 60 fps
budgets: [test/regress/README.md](../test/regress/README.md)) runs on GitHub Actions, in two workflows:

| workflow | where | when | what it can tell |
|---|---|---|---|
| **Gate** (`.github/workflows/gate.yml`) | GitHub's machines: Linux, Windows, macOS | every pull request (in its [tier](#ci-tiers)), every push to `main`, by hand | correctness everywhere: unit tests, shader conformance on Direct3D 11 and Metal, image quality; until the GPU machines are registered, also the perf suite's checks (its timings only reported) |
| **GPU gate** (`.github/workflows/gpu-gate.yml`) | our Mac, and on request our Windows desktop ([RUNNERS.md](RUNNERS.md); the laptop's runner was removed on 2026-11-01, #169) | every push to `main`, nightly, by hand, pull requests labelled `gpu-gate` (the Mac alone; the desktop only by hand, with *machines* `windows` or `both`); each run after an approval | speed with the suite's own tolerances on real GPUs (desktop and the emulated phone), and the same correctness checks there; by hand with mode `suites` and the input `suites` (a regex as `ci/browser.js --only`): only those browser suites, at the dispatched ref |

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
| **T2 core** | the renderer or the maths (`cx`, `parse`, `funcs`, `homrange`, `inverse`, `recognize`, `calc`, `region`, `curves`, `sphere`, `glsl`, `palette`, the parts of `src/gl/`, and the app's regions, exact images, preimages and render parts), a GLSL, quality or perf test | T0, the GLSL pages whose inputs changed, quality (Linux only), the perf suite's checks, the `images`, `exact`, `deform` and `formulas` shards, and `smoke` |
| **T3** | a push to `main`, the nightly run (02:37 UTC), a run by hand, the label **`full-gate`**, a pull request into `main` that is not a draft (a wave PR marked ready for review), `src/app/wrap.js`, `src/gl/wrap.js`, the app's core and start-up parts (`src/app/01-core.js`, `18-params.js`, `20-init.js`, `22-start.js`), `build.py`, `tools/src_parts.py`, or **any path the map does not know** | everything; quality on Linux, Windows and macOS |

- **The map** is one table in `ci/impact.js` (`MAP`, a comment per row; the shards of each area are `AREAS`): the
  first row whose pattern matches a path decides what it selects. A test helper or fixture selects the suites and
  unit tests whose source names it; a path nothing matches is T3 (fail safe). The app's test hooks
  (`src/app/21-test-hooks.js`, `window.__cmw*`) select the shards of the suites that call a hook the diff changes,
  read from the diff (#385); a changed line outside every hook, a hook something other than the browser suites and
  unit tests calls (the app, the quality and perf runners, `ci/`), or no diff to read (`--files`) is T3. `init()`
  (`20-init.js`) keeps only the start-up: an area's wiring is in that area's part (`19-shell.js` the header, menus and
  panels; `19-phone.js` the phone layout's adapter), so a change to it runs that area's shards (#385). A row can also
  select by the diff's lines: `src/page.html`'s export dialog CSS (`.xf-…`, `.modal.xf`, `#xf…`) runs the export shards
  too (`lines`; with no diff to read, they run). A suite file runs the shard it is in, a new one the catch-all `new`. `ci/suite_views.js` runs the shards of the suites whose entry differs from the reference's (a pin flip, a note; `suites`; with no diff to read, every suite's). Every GLSL page whose inputs
  (`ci/glsl.js`: its builder, its test file, the sources it reads) include a changed path runs, on both platforms.
- **The same build:** when a change touches the app (`src/`, `build.py`, `tools/src_parts.py`), the plan builds the reference and this
  change; when both `dist/` files are byte for byte the same (a move, a refactor that keeps the concatenated sources),
  the app's paths select nothing, so such a change costs T0.
- **A/A runs:** a paired job (quality, perf) chosen by a path outside the app (its runner, its scenes, `ci/quality.js`,
  `ci/perf_shard.js`) runs with `--force` when the app is unchanged, the same app on both sides, so the changed suite
  runs instead of reporting "nothing to compare" (the plan's outputs `quality_force`, `perf_force`).
- **Which pages a quality run compared:** each side stamps the hash of the `test.html` its server served
  (`app_sha1`, `app_sha1_source: served`; `checkout` only when the body could not be read), and the summary prints
  both. Different builds show different hashes. The same hash on a run that was not forced warns: both servers served
  one build, so the comparison compared nothing (#254).
- **Settle times on GPU laptops:** on a real D3D11 laptop (Iris Xe) the same scene's settle time swings from about
  1.4 s to 93 s, depending on which shader programs the driver is still compiling (#72, #238). A scene that does not
  settle within `run_quality.js --timeout-ms` (30 s) fails, and the second render on both sides usually clears it as
  noise. A runner that times out often can raise the limit with `CMW_QUALITY_TIMEOUT_MS` (suggested: 120000 on the GPU
  laptops), which `ci/quality.js` passes on; the hosted runners and the Mac keep 30 s.
- **The summary** of the plan job shows the tier, each changed path with the row that matched and what it selected,
  the jobs that run, and what was skipped. The **Gate** job passes when every job the plan chose passed and the rest
  were skipped.
- **A wave PR** (the integration branch into `main`) can stay open as a **draft**: a draft runs its tier like any
  other pull request; marking it *ready for review* (the workflow listens to `ready_for_review`) runs the whole gate,
  and so does every later push while it is not a draft.
- **Ready for review into another branch** (an agent's PR into the integration branch) re-runs nothing when its
  push's run on that commit has passed or is still queued or running: the job *ready* finds the newest other Gate run
  of this PR on the same commit; if it passed, or is queued, waiting or in progress, the plan selects no job (tier
  `none`), the unit job skips, and the **Gate** job waits for that run to finish (polling once a minute, up to 330
  minutes) and carries its verdict. It waits rather than skipping because a job's check exists only once the job
  starts: a ready run that passed at once would be the only Gate check on the commit while the push's run still went.
  Failed, cancelled or none: the run is the usual one, so a green Gate never stands on a commit before a gate passed
  there. Either way it has a concurrency group of its own and never cancels the push's run (#379,
  `test/t_gate_ready.js`).
- **A stack** (#787): PRs into the integration branch are often stacked, each head holding the lower PRs, so every
  push to a lower one re-runs the whole stack's tier on every PR above it. The job *ready* also asks, on every pull
  request into a branch other than `main`, which open PRs into the same branch contain this head (the compare API) and
  takes the one furthest ahead, the top (`ci/gate_run_of.sh` looks up its run, as for a ready-for-review mirror). When the newest Gate run of that PR on its head passed or is still going, this
  PR gets tier `none` like a ready-for-review mirror: nothing runs, and its Gate check waits for the top's run and carries
  its verdict (so it is never green before that run passed). A failed, cancelled or missing run of the top means this PR
  runs its own tier. A push to the top cancels its run, so the Gate checks that carried it fail: re-run them (or push)
  once the top's new run is going. **Report only until the repository variable `GATE_STACK_SKIP` is `on`:** the plan's
  summary says which run would have gated this head, and every PR still runs its tier.
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
| **Browser** (Linux, in shards) | the functional browser suites (`test/*_cmd.js`: the tour, constructions, touch, phone layouts, the i18n walks, export, sound, ...), each in its own headless Chrome against this build, at most 8 shards of a run at a time (`max-parallel`: the runners are shared by every open pull request); their correctness checks gate, their timing checks are reported (see [Browser suites](#browser-suites)) |
| **GLSL** (Windows: the core tier in 6 jobs, every chain in 11; macOS 3 pages) | the GPU-vs-CPU conformance pages (`test/glsl_test.js`, `glsl_test_adv.js`, `glsl_inverse_test.js`) on each platform's shader compiler (Direct3D 11's, Metal's), paired: this change fails only where it is worse than the reference on the same machine. A page whose shader code and tests did not change (the files its builder reads) is not run. Which chains: [GLSL tiers](#glsl-tiers) |
| **Quality** (3 shards × 3 systems) | the image-quality suite, paired |
| **Perf** (10 shards, Windows) | the perf suite, paired: desktop units and the **emulated phone**; its checks gate, its timings are reported (see below); only while the GPU machines are not registered (`GPU_RUNNERS`), or by hand (then macOS too) |
| **Gate** | passes only when every job the plan chose passed (perf: when it ran): make it the required check |

### GLSL tiers

Windows compiles every shader program on the CPU (Direct3D 11's compiler), so all the chains of the GLSL pages take
hours there; macOS takes minutes. The chains are in two tiers (`test/glsl_tiers.js`, by name, so adding a chain moves
no other):

- **core**: every hand-written chain (catalog defaults, natural paths, regressions, errors, d/dz, the special
  functions, series, recurrences, repeats, ...) and a fixed eighth of each random family; on the `adv` page its
  chains and the `keys` section.
- **deep**: the rest of the random families, the `adv` page's `direct` and `compile` sections, and the chains in
  `SLOW` (the slowest on Windows).

The Gate (`gate.yml`, GitHub's machines):

| run | Windows | macOS |
|---|---|---|
| a pull request (also a wave PR into `main`, and the whole gate) | core | all |
| a push to `main`, the nightly run, a run by hand | all (by hand: the *glsl* input, `all` or `core`) | all |
| a pull request with the label `glsl-deep` | all | all |

The GPU gate (`gpu-gate.yml`, our machines). Its events run the Mac alone; the Windows desktop runs on request, by hand
with *machines* `windows` or `both` (#169). Windows compiles on one core (FXC): the glsl page alone took over 170
minutes a side on the laptop on the nightly run of 2026-10-29, which its single job never finished. So every chain
runs there in ten jobs, the glsl page in eighths (`--part i/8`) and adv and inverse whole:

| run | Windows | macOS |
|---|---|---|
| a pull request (the label `gpu-gate`), a push to `main`, the nightly run | not run | all |
| a run by hand, *machines* `mac` (the default) | not run | all |
| a run by hand, *machines* `windows` | all, ten jobs | not run |
| a run by hand, *machines* `both` | all, ten jobs | all |

A page whose shader code and tests are the same as the reference's is not run unless forced: the nightly run always
is, a run by hand only with its *force* input, so a by-hand run covers every chain only with *force*. The cold cost
of adv and inverse on the laptop is not measured yet (inverse cannot be split): a red inverse job on the first nightly
runs after this change is that cost first, not a regression.

**A release tag** needs a green run of every chain (`all`) on the commit's `main`, on both systems: the GPU gate's
nightly run or a run by hand with *force*, and the Gate's push to `main` or nightly run.

`ci/glsl.js --tier core|deep|all` runs one tier locally. A page whose browser uses no CPU for `CMW_GLSL_STALL_MIN`
minutes (the GPU gate: 20) is stuck (a lost GPU, a hung driver): it fails as *stalled* then, not at the job's
timeout. The Gate (`gate.yml`) runs on GitHub's machines only and never waits for one of ours; the GPU gate's pull
request and by-hand runs replace the one before them on the same branch.

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
- **Mesa's lavapipe** (`ci/lavapipe.sh`, the step *Mesa's Vulkan drivers*): each job installs `mesa-vulkan-drivers`.
  It downloads the files the image lacks from Ubuntu's mirrors with the image's own package lists (no refresh: seconds;
  on the 24.04 image one file of about 18 MB) and installs them with `dpkg`. Those files are kept in an Actions cache,
  keyed by the runner's image (`ImageOS`, `ImageVersion`) and the package's version in the image's lists and restored
  by that exact key only, so files from another image are never installed. A job that installed from a mirror saves
  them when the key had no entry and the version installed is the key's (`dpkg-query`, the step outputs `version`);
  a pull request's run restores what it saved itself or what main's runs saved (each wave's push, the nightly run).
  GitHub evicts an entry after 7 days unused, so an image's entry goes soon after the image does.
  - **When Ubuntu's mirrors cannot be reached**, the cached files are installed after that first download fails. With
    none, or when they do not install, the same version comes from a fallback mirror on another domain:
    kernel.org's mirror of Ubuntu's archive (`https://mirrors.edge.kernel.org/ubuntu`), which a DNS failure of
    `*.ubuntu.com` leaves reachable. Ubuntu's list of archive mirrors has kernel.org's once, as "Kernel.org" at
    `mirrors.us.kernel.org`, for http, ftp and rsync; `mirrors.edge.kernel.org` is kernel.org's HTTPS front for its
    mirrors and is not on the list. What keeps the files intact is apt's check of the mirror against Ubuntu's archive
    keyring, as for Ubuntu's own mirrors. The fallback has a sources file and package lists of its own (the runner's
    are untouched). Then come 2 more downloads from Ubuntu's mirrors, each after a wait (10, then 20 s) and a refresh
    of the lists.
  - **After a Mesa update**, until GitHub's image has it: each pocket's package list names only its newest version,
    so the fallback fails (apt: `Version '…' was not found`) unless the image's version is still published in the
    security pocket (an older version can stay there after the updates pocket has moved on: 25.2.8-0ubuntu0.24.04.2
    stayed in noble-security after …04.3 replaced it in noble-updates). The downloads with refreshed lists install the
    newer version, which the job does not save under the key that names the image's.
  - **Time limits:** each apt call is stopped after 15 s for a download and 25 s for a refresh of the lists (apt does
    not retry by itself), and an attempt whose refresh got no answer downloads nothing. With no mirror answering and no
    cache, the step fails within 2 minutes when SIGTERM stops apt, and within 140 s when apt has to be killed
    (`timeout -k 5` sends SIGKILL 5 s after SIGTERM).
  - **It fails loudly:** a job that ends the step without the package installed (`dpkg -s`) or without lavapipe's ICD
    file (the `lvp_icd*.json` the package lists) fails there, with the annotation *Mesa (lavapipe)* naming the cause:
    the time limits when every apt call was stopped at its limit; otherwise how many calls ended with an error (apt's
    errors are in the log), got no answer, ended without an error but downloaded no files, or were refreshes of the
    lists that ended without an error (apt exits 0 even when it could not fetch, e.g. in a fast DNS failure: its
    "Failed to fetch" warnings are in the log); and whether the cache had a copy. Without
    lavapipe Chrome has no Vulkan driver and no WebGL2. Each part's time is in the step's log.
- **The image:** the browser jobs run on `ubuntu-24.04`, not `ubuntu-latest`. The layout gate compares the renderer's
  name with its baseline's (24.04's lavapipe: `ANGLE (Mesa, Vulkan 1.4.318 (llvmpipe (LLVM 20.1.2 256 bits) …`), so a
  job on another image, with another Mesa or LLVM, fails the layout shards until a new baseline is made from a run
  there ([Layout invariants](#layout-invariants-and-visual-inspection-470)); and while `ubuntu-latest` moves from one
  image to the next, the jobs of one run land on either. The other Linux jobs draw nothing with lavapipe and run on
  `ubuntu-latest` (Quality's Linux row draws with SwiftShader, and pairs both sides on one machine). Moving the browser
  jobs to Ubuntu 26.04 and unpinning them is #1507.
- **A fresh Chrome per suite:** each suite starts on `about:blank` in a new profile (on a development machine one
  long-lived daemon runs many suites). A suite opens the app before it calls into it, and its first look at the console
  sees everything since Chrome started (`dist/favicon.ico` exists for that reason).
- **Extra pages:** the v16.2 and v16.3 test pages some suites compare with are built from their release commits
  (`ci/reference.js`), and the published page is wrapped as a host serves it (`smk_pub.html`, the release smoke).
- **Known failures** (`KNOWN` in `ci/browser_suites.js`): app bugs and open questions, each with its reason (and a
  predicate where the check's name covers more than the bug), are printed in the summary and do not fail the job.
  Fix the app, and remove the entry.

### Layout invariants and visual inspection (#470)

**`test/layout_invariants_cmd.js`** checks the page's boxes with no one looking, through `test/lib/layout.js`:
- no two visible controls or text boxes overlap, except across a layer meant to sit on top (a menu, a sheet, the tour);
- the topmost element at each control's centre is that control;
- the boxes declared centred are centred, within 1 px;
- no text is cut by a box that can't scroll, except a declared ellipsis;
- no control's text shows past the control's own box (a label wider than its button, with nothing to clip it);
- a desktop toast covers no control; placed, it is centred on its place (in the chain head, inside it, with Clear chain
  stepped aside); unplaced, it covers no plane;
- no horizontal page scroll, and nothing visible is cut by the viewport's edge;
- targets are at least 24 px with a mouse and 44 px on touch, or spaced as WCAG 2.2's 2.5.8 allows;
- a control focused from the keyboard shows it, and its ring isn't cut;
- the rows declared even are evenly spaced.

It runs over the matrix of `test/lib/layout_matrix.js`:
- **sizes:** phones 360, 390 and 412 portrait, 740×360 and 915×412 landscape; desktops 1024, 1280 and 1440;
- **themes:** light and dark;
- **views:** the classic view, and `?view=steps` where the build has it;
- **states:** each view, the deformation, the menus, the Inspector, the tour strip, the export dialog and the phone's
  sheets; and, on a phone at 360 px, each tour chapter's longest step (its lead, text and task, in the language shown;
  `tour longest <chapter>`, #565).

There is one run per language (`en`, `ru` and `it`). Its result's `report` lists each violation once, keyed by its
boxes' structure rather than their words, with the number of points it was seen at, where, and a marked screenshot of
its first point (`shots/`, kept in the job's artifact although the suite passes: `keepShots` in `ci/browser_suites.js`).
- **The gate** (on, `mode: 'gate'` in `ci/browser_suites.js`): a row whose key `ci/layout_baseline.json` lacks for its
  run fails the job, and so does a state that opened for the baseline and doesn't now. The baseline was made from CI's
  own runs (lavapipe). Another matrix or another renderer (a runner image's new Mesa or LLVM) fails too, and asks for a
  new baseline from a CI run (`update --init`).
- **The baseline only goes down**, as with the lint ratchet. When a PR fixes rows, the job's summary lists them, and
  `node ci/layout_ratchet.js update <the saved job logs, or .ci/browser/layout_invariants_cmd.js_<run>.json>` lowers
  it. It reads the `LAYOUT-RESULT` line of a job's log, so no artifact download is needed.
- **New rows:** a new violation is fixed, or, when it is meant, declared in the suite's `DECLARED` with its reason (ux
  reviews it). `update --init` takes in only a run with no baseline, or one over another matrix or renderer. A PR that
  changes the checks themselves (`test/lib/layout.js`, `DECLARED`) takes their new keys in with `update --rules`; its
  diff shows why. The baseline holds only real, known violations, each one meant to be fixed, most with an issue.
- The points a row is seen at are reported, not gated.
- **Which PRs run it:** a change to the suite or its libraries; the shell (`19-shell.js`) and the phone's files run
  `layout-1` (en), the languages' tables `layout-2` (ru, it); every T3 runs both.
- **The design intent** is declared in `INTENT` (`test/lib/layout.js`) or on the element: `data-layer` (sits on top),
  `data-center="x|y|both"`, `data-ellipsis`.
- **The violations that are meant** are declared in the suite's `DECLARED`, each with its reason.
- **One state by hand:** `LAYOUT_CFG` in a preamble narrows the matrix, e.g.
  `const LAYOUT_CFG = { langs: ['en'], views: ['classic'], sizes: ['390'], states: ['sheet edit'] };`.

**`tools/inspect.js`** renders two builds over the same matrix and writes an HTML gallery. Each point shows the base and
the head side by side with their difference, the share of pixels that changed, and the checks' results: new at the
head, gone, or kept.
- **Cloud sandbox:** use the sandbox's settings (above).
- **Alexander's Mac:** use Chrome with the real GPU (ANGLE Metal). This is the one command:

```sh
npm ci && node tools/inspect.js --base origin/claude/funny-darwin-l5uis3 --head origin/<the PR's branch>
# --full for every language and size; --sizes 390,1280 --states 'start,sheet edit' --langs ru to narrow it
# the gallery: .ci/inspect/<base>-<head>/index.html (publish it as a private Artifact; never commit the pictures)
```

### Standards check

`node ci/standards.js --ref REV` (the Plan job runs it against the paired gates' reference) reads the lines a change
adds to `src/`, `ci/`, `test/` and `tools/` (generated files excluded) and reports what CONTRIBUTING.md's Code rules
let a script see: history words and version, wave or changelog labels in a comment (`history`), plan labels such as an
item of an issue (`plan`), and a test file (`test/t_*.js`, `test/*_cmd.js`) whose diff removes more assertions than it adds
(`asserts`; assertions moved into a test file the diff creates, a split, are not counted as dropped). The words `was`, `now` and
`no longer` count only beside a verb of change, so a comment that describes the code as it is stays clean. It reports in the job summary and as warning annotations on the lines, and never fails the job; with
`--block` it exits 1 when it finds anything. An added line opts out with `standards-ok: <reason>` in its comment (a
test file opts out of the assertion count with the marker on any line it adds); a marker with no reason is a finding.
The word lists are `HISTORY` and `PLAN` in the script.

### Perf on a loaded machine

A reading taken while something else runs on the machine says nothing about the code. The paired perf shards on our own
machines (`ci/perf_shard.js` without `--advisory`; GitHub's machines are never idle and are not guarded) therefore:
1. wait, before each measured pass, up to 5 minutes for the 1-minute load to fall under `max(4, 0.45 x cores)` (4.5 on
   `mac-gpu`), and log the load before and after and the busiest processes (`ci/perf_busy.js`), so the log shows whether
   the load is ours (the two `build.py` runs) or not;
2. pass that limit and `--load-wait 60` to `run.js`, whose `meta.busyUnits` then lists every unit that started busy (the pair
   still runs: both halves see the same machine);
3. mark a FAIL of such a unit **BUSY** in `compare_perf.py`: reported, never counted, and the unit is run again with the
   units that failed. A unit that started busy in any pass counts as red only with 2 passes that started quiet
   (`merge_runs.py` records `meta.passBusy` and `meta.passUnits` per pass). When no metric counts as failed but some FAIL was
   BUSY, `compare_perf.py` and the shard exit **3**, "invalid: machine busy": no verdict either way; run again on a
   quiet machine.

`test/t_perf_busy.js` (the wait, with a fake load source) and `test/regress/test_compare.py` (BUSY, the two clean
passes, exit 3) test it.

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

## Perf shards and their parts

The perf suite's units (`node test/regress/perf/run.js --list`) are cut into shards (`ci/perf_shards.js`, each one CI job; every unit is in exactly one). The larger shards (`steps`, `pointer`, `phone`, `views`, `interaction`) also have named **parts**, a scene or a map each, whose units split their shard's exactly (the plan job's check fails when a unit is in no part or in two): `steps-first`, `steps-default`, `steps-zeta`, `steps-king`, `steps-globe`, `steps-land`, `steps-cold`, `steps-long`; `pointer-hover`, `pointer-drag`, `pointer-morph`; `phone-open`, `phone-motion`; `views-phase`, `views-landscape`, `views-sphere`; `interaction-mesh`, `interaction-morph`, `interaction-hover`, `interaction-cards`. A part is only a unit regex: rows, kinds, limits and tolerances live in `run.js` and `compare_perf.py`, so no row is dropped and no threshold moves.

- **On GitHub's machines** (the Gate) every shard is one job, as before the parts; a by-hand run's *shards* input also takes part ids.
- **On the GPU gate** (`gpu-gate.yml`, `--leaves`) the `steps` shard stands for its eight parts, one job each (its *leaves*): a run is about 3 minutes for `steps-first`, 4 for `steps-default` and `steps-zeta`, 5–6 for `steps-king` (`steps-globe`, about 2 on lavapipe, `steps-land`, `steps-cold` and `steps-long` are not timed yet; each unit's limit is 15 minutes), plus about a minute a job for the build and the quiet wait. The *shards* input takes shard ids, part ids and two groups: `all` (or nothing) is every shard (the wave sweep), `classic` the shards that are not split; `steps` is its eight parts. A part named beside its own whole shard is covered by it; an unknown id fails the plan. The loaded-Mac guard runs once per job, and a unit's reference and current runs are in the same job.
- **A probe** has no units of its own: it is a dispatch of one part (e.g. `steps-king`) with the *reps* input (default 3; a probe uses 6).
- **The verdict of each shard** is one log line, `PERF <leaf> <head8> vs <ref8>: PASS|FAIL|BOTH|INVALID (exit n), FAIL k BOTH k PASS k, passes n, <s> s`, and `verdict.json` in the shard's artifact. A shard whose job throws (a stalled unit, run.js exit 4 or 5, a failed build) writes `INVALID (exit 2)` with the error, and one with no change to compare writes `SKIPPED`. The run's final job collects them into one table (`ci/perf_verdicts.js`): shard, verdict, failing rows; a shard the plan chose that wrote no verdict at all (its job never started) is a row `no verdict` and counts as not passing. *skip* names ids the way *only* does: a shard's id leaves out its parts too. `node ci/perf_shard.js --shard steps-king` runs one part locally.

## Running a job by hand

*Actions → Gate (or GPU gate) → Run workflow*: choose the branch, optionally the reference (a commit or branch), only
some perf shards or parts of them (e.g. `views,phone` or `steps-king,pointer-drag`; [Perf shards and their parts](#perf-shards-and-their-parts)), the GPU gate also how many *reps*, and *force* to run the paired gates when the app did not change (an A/A run of
the same app on both sides shows the noise). The GPU gate's *glsl* input, `skip`, leaves out the GLSL and quality jobs
so that the perf shards start at once: by hand the Windows GLSL tier is ten jobs, about 7 hours, ahead of perf (a
measurement then, not the full gate). The Gate's *perf* box runs the perf suite on GitHub's machines (Windows,
and macOS advisory) even when the GPU machines gate speed, e.g. while one of them is away.

## Locally

The same scripts run on a developer machine (Chrome, Node 22, Python 3):

```sh
node ci/snapshots.js && node ci/unit.js            # unit tests (snapshots: old versions some tests compare with)
node ci/glsl.js                                    # GLSL conformance in headless Chrome
node ci/quality.js --ref origin/main               # image quality, paired against main (--shard 1/3 for a part)
node ci/perf_shard.js --shard views --ref origin/main   # one perf shard, paired against main
node ci/glprof.js                                  # shader link times, cold and warm (issue #72; GPU gate mode glprof)
node ci/glprof.js --ref origin/main --rounds 2    # the same, this build and main's in turn (on a Mac add --clear-metal-cache)
node ci/browser.js --only '^steps_glide_look_cmd' # browser suites by file name; on the Mac's GPU: GPU gate by hand, mode suites, input suites (run it on two refs to compare)
node ci/perf_shards.js matrix                      # the shards; check: every perf unit is in exactly one
node ci/browser.js --only '^tour_cmd' --port 9950   # browser suites (--shard ID for a shard; a free port by default)
CMW_VENDOR=1 node ci/browser.js --only '^custom_show_cmd'   # ... on a machine with no route to the CDNs (#444, below)
CMW_VIEW=steps node ci/browser.js --only '^warm_bar_cmd'   # ... with every page in the steps view (#620; CI sets it for a suite tagged steps({ pin: true }) in ci/suite_views.js)
node ci/standards.js --ref origin/main            # the standards check on this branch's added lines (report only)
node ci/browser_shards.js check                    # every browser suite in exactly one shard, with its view (ci/suite_views.js, #620)
node ci/impact.js --base origin/main --print       # the tier of this branch (CI tiers)
node ci/gpu_probe.js                               # the renderer headless Chrome gets here
```

### In a cloud sandbox (a Claude Code session on the web)

The sandbox has no `google-chrome` and no route to the CDNs, and its GL is software only. What works there:

```sh
export CHROME_BIN=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux64/chrome | head -1)   # Playwright's Chromium; the browser suites look for google-chrome
export CMW_ANGLE=swiftshader CMW_CHROME_ARGS="--no-sandbox"                              # CPU rendering; no Vulkan flags
node ci/browser.js --only '^key_popup_cmd' --port 9950                                   # a suite; --no-build skips build.py
CMW_VENDOR=1 node ci/browser.js --only '^custom_show_cmd'                                # the same with MathJax and the faces from vendor/ (no CDN here; see "No network" below)
node ci/snapshots.js && node ci/unit.js                                                  # unit tests (see the clone note below)
npm run -s typecheck                                                                     # runs tools/join_src.js, then tsc
```

- **Do not use CI's Vulkan flags** (`--enable-features=Vulkan --use-vulkan=native --disable-vulkan-surface`, `CMW_ANGLE=vulkan`) here: Chrome then has no WebGL, the colour keys are hidden and every picture is blank. A bare `npx tsc` needs `node tools/join_src.js` first; `npm run typecheck` does both.
- **A shallow clone** lacks the old commits that `ci/snapshots.js` restores. It fetches them, and the six tests that read the snapshots fail with a line saying what is missing (never skip).
- **Keep your own scripts' output out of the repository:** screenshots and measurements go to a scratch folder (a script run from the repository's root once left a `shots/` folder in it).
- **The lint ratchet** is the same as in CI: `npx eslint -f json . > es.json; npm run -s typecheck > tsc.txt; node ci/lint_ratchet.js check es.json tsc.txt`.

**Failures that happen in a sandbox and not in CI** (as reported on the PRs; check one on `main` before you suspect your change):
- **No network, so no MathJax or faces from their CDNs:** formulas stay raw TeX, and the typeset checks fail. **`CMW_VENDOR=1`** (#457, below) makes the suites get MathJax, jsPDF and the fonts from `vendor/` (the fonts from `vendor/LOCK.json`'s faces) and passes everything else through. It fixes `custom_show_cmd` (`show: typeset`, `show: whole, at 70 %`) and takes `tour_cmd` from 81–84 to 89 of 95 checks, as tiers measured on #457 (SwiftShader, no CDN). It does not fix the timing and software-GL failures below. `seasong_cmd`'s `net::ERR_TUNNEL_CONNECTION_FAILED` console errors (reported on #319) were not part of #457's measurements.
- **Timing, on a shared CPU with software GL:** `t_constr`'s speed checks (`perpForm`, `touchForm` and `tangentForm`), the frame-count checks in `sound_cmd`, and `land_release_cmd`'s "leaving Landscape frees the refinement".
- **The tour suites:** `tour_auto_cmd`, `tour_cmd` and `ux165_learn_cmd` failed on `main` in a sandbox while CI ran them green (with `CMW_VENDOR=1` `tour_cmd` passes 89 of 95, and `tour_auto`, `ux165_learn`, `v15_desktop`, `v15_phone`, `sound` and `land_release` still fail on timing and software GL, as tiers measured on #457); `ux165_learn_cmd` has thrown `Cannot read properties of null (reading 'l')` and failed with other checks on different runs. `repeat_cmd`'s "Write by zeros and poles" failed in one container and passed in another with the flags above.

**No network (#444).** The test page loads MathJax, the PDF library and the Google Fonts from their CDNs, as the live
page does. On a machine with no route to them (a cloud sandbox), formulas stay raw TeX and the checks that read typeset
output fail. `CMW_VENDOR=1` makes the browser daemon (test/cdp_kit/cdpd.js) answer exactly those CDN files from
`vendor/` (test/cdp_kit/vendor.js; the fonts as @font-face rules over the vendored faces, as the offline page has them)
and lets every other request through. It is opt-in and never set in CI, which keeps testing the CDN path;
test/t_vendor_serve.js checks that every CDN URL in src/ and build.py is answered. What it does not fix: in a sandbox
with SwiftShader (no Vulkan/lavapipe, the CI's GL), `tour_cmd` passes 89 of 95 with it (81–84 without: the strip's
holes, the welcome, the palette's Try line are typeset checks) and `custom_show_cmd` passes, but `tour_auto`,
`ux165_learn`, `v15_desktop`, `v15_phone`, `sound` and `land_release` still fail there on timing and software-GL
checks that pass in CI (30 Oct, f4e601a).

### The Landscape walls suite, by hand

`test/landscape_walls_cmd.js` stays in `EXCLUDED` (`ci/browser_suites.js`): its speckle, cold-open and perf parts need
`r1/` and `base/` builds (the base is v16.3.1, `ci/reference.js` builds it) and a GPU, and the whole suite takes about
25 min on a Mac GPU. Its mesh and motion parts read the Landscape grid back through the hooks in `src/gl/`
(`GLR.landMesh`, `GLR.landRefine`, `GLR._lw`, `GLR._lwLog`), which sit in `// TEMP-DEBUG-HOOK` blocks that `build.py`
strips from the published page, so `dist/test.html` has them and `dist/complex-map-workbench.html` has not. The mesh part
and the motion part (on this build only) run on lavapipe:

```sh
python3 build.py
LW_PARTS=mesh node ci/browser.js --no-build --only landscape_walls_cmd --include-excluded        # 12 cases, 4 pages each (~7 min)
LW_PARTS=mesh LW_ONLY=sqrt-im,log-im node ci/browser.js --no-build --only landscape_walls_cmd --include-excluded
LW_PARTS=motion LW_MOTION=240:0.006,240:0.026 node ci/browser.js --no-build --only landscape_walls_cmd --include-excluded   # mesh:T step
```

`--include-excluded` runs the `EXCLUDED` files that `--only` names; `LW_PARTS` is a list of `mesh`, `speck`, `cold`, `perf`,
`motion`, `LW_ONLY` the mesh cases, `LW_MOTION` the motion part's `mesh:dT` pairs (default: the full set, up to the 1920 mesh).
The result is `.ci/browser/landscape_walls_cmd.js.json`. `GLR._lwT` and `GLR._lwF` were hooks of round 3 whose code and use
are not in the repository; they are not restored.

Settings (environment variables):

| variable | meaning |
|---|---|
| `CMW_ANGLE` | Chrome's ANGLE back end: `metal` (macOS default), `d3d11` (Windows default), `swiftshader` (default elsewhere; CPU rendering); the browser jobs use `vulkan` with Mesa's lavapipe (`mesa-vulkan-drivers`) |
| `CMW_CHROME_ARGS` | extra Chrome flags, space-separated (CI on Linux: `--no-sandbox`; the browser jobs add `--enable-features=Vulkan --use-vulkan=native --disable-vulkan-surface`) |
| `CMW_DPR` | the device pixel ratio the browser daemon's `view()` emulates (default 1; `steps_glide_look_cmd.js` runs at 1 and at 2, ci/browser_suites.js) |
| `CHROME_BIN` / `CHROME` | Chrome's path for the perf / quality runners, when it is not in the usual place |
| `CMW_GLSL_CACHE` | a folder kept between runs for `ci/glsl.js`'s Chrome profile, with the GPU program cache on: a shader program compiled before (same source) is not compiled again. The GPU gate sets it on its machines ([RUNNERS.md](RUNNERS.md)); delete the folder to start cold |
| `CMW_GLSL_STALL_MIN` | minutes without CPU in the browser after which `ci/glsl.js` closes it and reports the page as stalled (default: never; the GPU gate sets 20) |
| `CMW_GLSL_PROGRESS_S` | seconds between `ci/glsl.js`'s progress lines while a page runs (default 60): the minutes so far, and how busy the GPU process and the page were |
| `CMW_SPEED_SCALE` | scales the construction tests' remaining absolute speed limits (the four in `t_constr.js`; set on the development Mac); CI uses 3. The other construction limits (`constr_perp_tests.js`, `constr_touch_tests.js`, `constr_seg_tests.js`, the 50-dependent drag of `constr_core_tests.js`) are ratios to a reference operation measured in the same run (`test/lib/speed_ref.js`), so they need no scale |
| `CMW_PORT`, `CMW_BASE` | the server some browser suites open (`ci/browser.js` sets both to its own) |
| `PYTHON` | the Python the scripts call (default `python3`; `python` on Windows) |

## Files

| file | |
|---|---|
| `ci/lavapipe.sh` | Mesa's Vulkan drivers for the browser jobs, with the Actions cache of their package files and a fallback mirror (Browser suites); `test/t_lavapipe.js` tests it |
| `ci/gate_run_of.sh` | the newest Gate run of a PR on a commit, for the job ready's two mirrors (CI tiers); `test/t_gate_ready.js` tests it |
| `ci/standards.js` | the standards check on a change's added lines (Standards check); `test/t_standards.js` tests it |
| `ci/impact.js` | the tier and the jobs a change can affect (CI tiers); `test/t_impact.js` tests it |
| `ci/unit.js` | all unit tests, one summary row each |
| `ci/browser.js`, `ci/browser_shards.js`, `ci/browser_suites.js` | the browser suites, one summary row each; the shards; what the runner knows about some suites (excluded files, runs, extra pages, timing checks, software-renderer failures, known failures) |
| `ci/snapshots.js` | the old source snapshots some unit tests compare with (v13, v16.2, v16.3), from the git history (a shallow clone: it fetches each commit by itself, #427); a test whose snapshot is missing fails with what to run |
| `ci/glsl.js` | the GLSL conformance pages |
| `ci/quality.js` | the paired image-quality gate |
| `ci/perf_shard.js`, `ci/perf_shards.js`, `ci/perf_busy.js`, `ci/perf_verdicts.js` | one paired perf shard or part; the shards and their parts (Perf shards and their parts); its loaded-machine guard (Perf on a loaded machine); `test/t_perf_shards.js`, `test/t_perf_verdicts.js` and `test/t_perf_busy.js` test them |
| `ci/glprof.js` | the app's shader link times (`?glprof`) through a walk of the app, cold then warm (issue #72) |
| `ci/reference.js` | builds the reference app in a worktree under `.ci/` |
| `ci/equiv.js` | is the app the reference's? (#20 phase 4: the ES-module bundle against the concatenation) The page outside the app script and i18n.js at its head byte for byte; in one Chrome (the test page in the steps view, its scenes from `ci/steps_scenes.js`, as `ci/glprof.js`'s walks), every shader source, the audio worklet's source, each scene's picture (pixel for pixel, `--limit`, 0.01 % by default), exceptions and the globals; the published page runs scenes of its own (the default, two examples, sound on) and keeps every global it set on window. `node ci/equiv.js --ref <commit>` |
| `ci/gpu_probe.js` | the renderer; `--require-hardware` on our GPU machines; `--fallback` on GitHub's |
| `ci/lib.js` | a static server, the job summary, running commands |
| `test/lib/layout.js`, `test/lib/layout_matrix.js` | the layout checks and their matrix (#470): `test/layout_invariants_cmd.js` and `tools/inspect.js` |
| `ci/layout_ratchet.js`, `ci/layout_baseline.json` | the layout suite's ratchet: its violation keys per run only go down (#470); `test/t_layout_ratchet.js` tests it |
| `tools/inspect.js` | the visual inspection of a design change: two builds over the layout matrix, an HTML gallery side by side (#470) |
| `ci/RUNNERS.md` | setting up our Mac and, for runs on request, a Windows desktop (#169) as runners |

# Contributing

## The one requirement

The app ships as **one standalone HTML file**. `python3 build.py` joins `src/` into `dist/complex-map-workbench.html`
(published) and `dist/test.html` (with the test hooks). Nothing may add separately served `.js` or `.css` files, or
need a server to run the page.

## Before you push

```bash
python3 build.py
```

```bash
npm ci
```

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
ruff check
```

- `npm test` runs every unit test (`test/t_*.js`) through `ci/unit.js`. The browser, GLSL, quality and perf gates
  run in CI (`ci/README.md`).
- Run `node ci/snapshots.js` once before the unit tests: `t_constr`, `t_i18n_english` and `t_i18n_parse` compare with old
  versions it restores from the git history into `notes/*/src`. In a shallow clone it fetches the commits it needs; a
  test whose snapshot is missing fails and says so (#427).
- `lint`, `typecheck` and `ruff` fail the Lint job on any error (`.github/workflows/lint.yml`): ESLint and tsc are at
  zero, and `ci/lint_baseline.json` holds them there (`node ci/lint_ratchet.js check eslint.json tsc.txt`). ESLint
  warnings are listed, not gated; clear the ones in the code you touch when it's cheap.

## Code

- **One subject per file, and keep files small.** Aim for under about 1,500 lines (ESLint's `max-lines` warns above
  that). A new feature gets its own file with an explicit API, like `Tour.init(api)` or `Inspector.create(...)`,
  rather than another section in `app.js` (whose ordered parts are `src/app/NN-subject.js`, joined by `build.py`).
- **An area's wiring lives in its area's part.** `init()` (`src/app/20-init.js`) is the start-up, and a change to it
  runs every CI shard: a new button, menu, key or observer goes in the part of its area as a `setup…()` that `init()`
  calls, so that a change to it runs that area's shards (#385; `test/t_init_wiring.js` checks it).
- **No new globals without a reason.** A file exposes one name (`const Tour = (() => { ... return api; })()`); the
  linter reads those names from `src/` itself. A file that also runs in the node unit tests exports itself with
  `module.exports` and is then listed in `types/globals.d.ts`.
- **Comments describe the code as it is now:** what it does, its contract (inputs, outputs, units, invariants) and,
  where the code can't show it, why it must be this way. Link a spec in `notes/` where it explains a decision.
- **A comment never tells the code's history.** No "was", "used to", "previously", "no longer", "now" or "instead of
  the old …"; no names of removed functions or earlier implementations; no version or wave labels (`// v15:`,
  `[v17 D5]`, "wave 13"); no PR or issue numbers as a changelog ("fixed in #552", "after #587"). How the code got
  here belongs in the commit message and the PR, and git keeps it. An issue number is fine in a `TODO(#N)` and when
  it points at an open bug or a spec.
- **An edit leaves no stale comment.** Rewrite or delete the comments your change makes wrong, and don't add a
  comment about the change itself.
- **Prefer clear code to a comment that explains it.** If a block needs a comment to be followed, simplify it first.
  Maths, numerics and regular expressions are the exception: there a comment saying what is computed helps.
- **Solve today's problem.** No options, parameters, flags or generality that nothing uses yet, and no unused
  exports.
- **Names say what a thing is or does:** long enough to be clear, short enough to read, no abbreviation a newcomer
  couldn't expand, and consistent with the rest of the file.
- **Document an API where it is defined.** An exported function, or a module's `api`, gets a short comment: what it
  is for, how to call it, what it returns, and its units.
- **No dead or commented-out code, no `console.log` or debug flags, no `TODO` without an issue number, and no
  unexplained magic numbers** (name a constant instead).
- **Keep functions short.** A new function over about 80 lines needs a reason; split it where a split is natural.
- **Generated files are not edited by hand:** `src/i18n_ru.js`, `src/i18n_it.js`, `src/seasong.js`
  (each names its generator at the top).
- **`vendor/` is written by `tools/vendor.py`** (the offline page's MathJax and faces, issue #21, subset to the
  characters `src/` uses). A change that adds a character outside the subset fails `test/t_vendor.js`; run
  `python3 tools/vendor.py` again (it needs npm and `pip install fonttools brotli`) and commit `vendor/`. A character
  left out falls back to a system face.

## Tests, notes and evidence

- `test/` holds what CI runs: the unit tests (`t_*.js`), the browser suites (`*_cmd.js`) and `test/regress/`.
  One-off review scripts go to `notes/`, next to the work they review (the old `notes/review-archive/` is in git history at 099e5f1).
- `notes/` holds the Markdown specs and decisions, and nothing else that is large: no screenshots, PDFs, built pages or
  other large binaries in git. Attach evidence to the PR or issue instead, and link it from the spec if a decision
  rests on it. `test/` holds only what CI runs (above), never evidence or one-off scripts.
- The size budget is two ESLint warnings in `eslint.config.js`. `max-lines` is 1500 per file, and each file still over
  it has its own limit in `SIZE_BUDGET`, its size when the budget was set: such a file may shrink, never grow, and
  `max-lines` warns when it does. When a file shrinks, lower its number; once it is under 1500, drop it from the table.
  `max-lines-per-function` is today's largest function, so a change that makes one bigger is flagged. Lower the limits
  when you split something; never raise them.

## Review

Every PR into the integration branch gets two automatic reviews before it merges. Each gives a verdict: 🟢 passes,
🟡 small items with their file and line, 🔴 a rule is broken and the PR does not merge until it is fixed. A matter of
taste that no rule here covers is a "Nit:" and never blocks.

- **standards** checks the lines a PR adds or changes against the rules in this file:
  - **tests:** a new behaviour or fix comes with a test that fails without it, and the PR says so. No test is
    skipped, deleted or loosened, and no threshold is raised without a stated reason. A test folded into another
    lists each old case and the check that now covers it, equally strict or stricter. Tests wait for a condition,
    never for a fixed time;
  - no images, binaries or secrets committed;
  - generated files regenerated with their tools;
  - the lint and type ratchet only goes down;
  - the code rules above: comments, simplicity, names, API docs and hygiene;
  - one subject per PR, with no reformatting mixed into a behaviour change. A change to how the project is built,
    tested, run or released updates the docs (`README.md`, `ci/README.md`, this file), and deleted code takes its
    docs with it;
  - the PR body: its issue (`Fixes #N` or `Part of #N`), what changed, and how it was tested.
- **reuse** checks that a change reuses the engines and helpers we already have, generalizing them where needed,
  instead of adding a second copy.

A change to what the page shows also gets ux's and eyes' reviews, and a change to the renderer or the maths gets
perf's reading of a Mac GPU run. The checklist follows Google's engineering practices,
[What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
(CC BY 3.0).

## Pull requests

- One PR per feature or fix, small enough to review, rather than one commit per release. The CI gates compare
  each change with its base, so a small PR also tells you exactly what changed the numbers.
- The live page is deployed by CI on a release tag (`v*`, `.github/workflows/pages.yml`), never committed. Don't tag
  a commit whose message contains `[skip ci]`: GitHub skips tag-triggered workflows for it too.

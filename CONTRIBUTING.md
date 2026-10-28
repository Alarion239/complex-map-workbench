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
- `lint`, `typecheck` and `ruff` are report-only for now (`.github/workflows/lint.yml`): don't add new findings in the
  code you touch, and fix the ones next to it when it's cheap. See issue #20 for the plan to bring them to zero.

## Code

- **One subject per file, and keep files small.** Aim for under about 1,500 lines (ESLint's `max-lines` warns above
  that). A new feature gets its own file with an explicit API, like `Tour.init(api)` or `Inspector.create(...)`,
  rather than another section in `app.js` (whose ordered parts are `src/app/NN-subject.js`, joined by `build.py`).
- **No new globals without a reason.** A file exposes one name (`const Tour = (() => { ... return api; })()`); the
  linter reads those names from `src/` itself. A file that also runs in the node unit tests exports itself with
  `module.exports` and is then listed in `types/globals.d.ts`.
- **Comments say what the code does and why.** Link a spec in `notes/` where it explains a decision. Leave version
  labels (`// v15:`) and the file's history to git.
- **Generated files are not edited by hand:** `src/i18n_ru.js`, `src/i18n_it.js`, `src/cyr.js`, `src/seasong.js`
  (each names its generator at the top).
- **`vendor/` is written by `tools/vendor.py`** (MathJax and the faces, subset to the characters `src/` uses). A change
  that adds a character outside the subset fails `test/t_vendor.js`; run `python3 tools/vendor.py` again (it needs npm
  and `pip install fonttools brotli`) and commit `vendor/`. A character left out falls back to a system face.

## Tests, notes and evidence

- `test/` holds what CI runs: the unit tests (`t_*.js`), the browser suites (`*_cmd.js`) and `test/regress/`.
  One-off review scripts go to `notes/` (see `notes/review-archive/`).
- `notes/` holds the Markdown specs and decisions, and nothing else that is large: no screenshots, PDFs, built pages or
  other large binaries in git. Attach evidence to the PR or issue instead, and link it from the spec if a decision
  rests on it. `test/` holds only what CI runs (above), never evidence or one-off scripts.
- The size budget is two ESLint warnings in `eslint.config.js`. `max-lines` is 1500 per file: the warnings list the
  files still over it, and a file you touch should not grow. `max-lines-per-function` is today's largest function, so
  a change that makes one bigger is flagged. Lower the limits when you split something; never raise them.

## Pull requests

- One PR per feature or fix, small enough to review, rather than one commit per release. The CI gates compare
  each change with its base, so a small PR also tells you exactly what changed the numbers.
- The live page is deployed by CI on a release tag (`v*`, `.github/workflows/pages.yml`), never committed. Don't tag
  a commit whose message contains `[skip ci]`: GitHub skips tag-triggered workflows for it too.

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
  rather than another section in `app.js`.
- **No new globals without a reason.** A file exposes one name (`const Tour = (() => { ... return api; })()`); the
  linter reads those names from `src/` itself. A file that also runs in the node unit tests exports itself with
  `module.exports` and is then listed in `types/globals.d.ts`.
- **Comments say what the code does and why.** Link a spec in `notes/` where it explains a decision. Leave version
  labels (`// v15:`) and the file's history to git.
- **Generated files are not edited by hand:** `src/i18n_ru.js`, `src/i18n_it.js`, `src/cyr.js`, `src/seasong.js`
  (each names its generator at the top).

## Tests, notes and evidence

- `test/` holds what CI runs: the unit tests (`t_*.js`), the browser suites (`*_cmd.js`) and `test/regress/`.
  One-off review scripts go to `notes/` (see `notes/review-archive/`).
- Design specs and decisions go to `notes/` as Markdown. Avoid committing large screenshots, PDFs or built pages;
  attach them to the PR or issue instead.

## Pull requests

- One PR per feature or fix, small enough to review, rather than one commit per release. The CI gates compare
  each change with its base, so a small PR also tells you exactly what changed the numbers.
- The live page is deployed by CI on a release tag (`v*`, `.github/workflows/pages.yml`), never committed. Don't tag
  a commit whose message contains `[skip ci]`: GitHub skips tag-triggered workflows for it too.

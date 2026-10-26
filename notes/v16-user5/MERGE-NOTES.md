# User report 5: merge notes for v16.1

Snapshot: `work/xv161u-final-snap/` (src/, tools/, build.py, test/ without `*_cdp`), frozen from `work/xvta` on
2026-10-25 after the last fix pass. Base: `notes/v16-candidate`. Russian strings:
`notes/i18n/ru/v161-user5.json` (make_ru_table reads it through `V161_HERE`).

## What it covers

The user's five points, plus the fixes from the reviews:

1. Tour: each step that asks for a left-panel action now lights the exact tool it needs.
2. All sheets while deforming: H_t is drawn on F's sheets, so the user's case (sin √z, √ bracketed) shows two
   surfaces that merge into one.
3. Cards step: card pictures are shown even in Names (compact) mode.
4. The "every sheet" wording is now exact in the captions and LaTeX: both sheets, all n, a window of k values, or
   K of the total combinations.
5. Figure export "More options": the menu opens above the dialog.

The earlier fix pass is in `ledger.json`. This last pass fixed `review-verify.json` items verify-1, verify-2 and
verify-5 (details below).

## Files and hunks against the base (notes/v16-candidate)

| file | hunks | +/- lines |
|---|---|---|
| src/app.js | 22 | +230 / -19 |
| src/tour.js | 25 | +114 / -39 |
| src/funcs.js | 12 | +177 / -38 |
| src/gl.js | 13 | +54 / -19 |
| src/glsl.js | 8 | +80 / -12 |
| src/figure.js | 8 | +25 / -9 |
| src/inspector.js | 2 | +4 / -1 |
| src/page.html | 1 | +2 / -0 |
| src/i18n_ru.js | 1 (generated) | regenerate, do not hand-merge |
| tools/make_ru_table.py | 1 | +5 / -1 (`V161_HERE = {'v161-user5.json'}`) |
| tools/ru_report.json | 19 (generated) | regenerate |

The base has no test/ folder. These test files are new or changed compared with the main tree's test/. Merge them
by hand if the main tree changed them too:
- new: `test/t_sheets_deform.js`, `test/sheets_deform_cmd.js`, `test/sheets_film_cmd.js`
- changed: `test/export_cmd.js` (section 6), `test/glsl_test.js`, `test/t_tour.js`, `test/tour_cmd.js`,
  `test/tour_audit_cmd.js`, `test/i18n_cmd.js`, `test/mv_views_cmd.js`, `test/ub_views_cmd.js`

## This pass's hunks (verify-1, -2, -5), all in src/app.js

- **render3D, about lines 3546-3610 (verify-2).**
  - Before: while deforming with All sheets, the height scale was F's for every t. That flattened H_t when F's
    sheets were taller (log then sin looked like one flat plane) and turned it into walls when they were lower (the
    user's case near t = 0).
  - Now: the scale follows H_t. It is the same percentile over the drawn surfaces, sampled at 9 times of the
    transport and interpolated in log between samples. Each sample is computed once, when first needed, with
    `Funcs.sheetMapEval` on `HR.state(S, T, true).map`.
  - At the end of the transport the scale is exactly F's, so the end frame still equals the static frame. The
    block height (boost) stays F's.
  - The quantile, zAt and hOf helpers were moved out of the cache block, and one comment was updated.
- **sheetsShown, about lines 7520-7550.**
  - verify-1: new `dk.turn`. It is true when the deformed pieces run in turn: several steps not all at once, or a
    recognised formula with several catalog steps.
  - verify-5: each piece now carries `kb`, the step's own branch (a root's k mod n, a log's or a power's k).
- **sheetsClause, about lines 7560-7595.**
  - verify-5: the window is numbered as drawn, k = kb−W…kb+W. Example: log with k = 3 now says "k = 1…5".
  - verify-1: the path sentence now uses σ for the exponent. It is written in the caption's t, or, when the
    pieces run in turn, in the step's own time s ("where s (0 ≤ s ≤ 1) is the time of the step it belongs to").
    This adds three new strings.

RU file, `v161-user5.json`, changed by read-modify-write:
- `u5f.then_pow`, `u5f.then_log` and `u5f.then_both` now use σ.
- New entries: `u5f.then_pow_turn`, `u5f.then_log_turn` and `u5f.then_both_turn`, with a no-break space before
  each em dash.

Tests:
- `test/export_cmd.js` section 6: the σ regex, plus a new whole-chain case (√ then sin in turn, film, EN and RU).
- `test/sheets_deform_cmd.js`: the σ regex.

## Checks run (work/xvta, port 9710)

- **Node:** all 34 `test/t_*.js` pass (`notes/v16-user5/fix/node_tests_final.txt`).
- **Russian:** `make_ru_table --strict` gives 2302 entries, 0 unresolved. It regenerates byte for byte.
- **Build:** two builds give the same bytes.
  - `complex-map-workbench.html`: 1e233597…cdbece
  - `test.html`: a36abe7a…ad54a95
  - The published page contains no `__cmw` or `__qa` hooks, no /Users/ paths and no email addresses.
- **Browser:** `sheets_deform_cmd.js` passes and export_cmd section 6 passes (`final/sheets_deform.out`,
  `final/export_u5.out`).
- **Captions and scale:** `final/f1.out` and `final/f1-grid.png`. The user's case at t = 0.25 and 0.5 shows two
  readable surfaces. Log then sin at t = 0 and 0.5 is no longer flat.
- **Branch windows:** `final/f3.out` covers log k = 3, the 30th root with k = 3 and log k = 0, in EN and RU.
- **Frame times while playing:** `final/f2.out`. The user's case at 1440 and on a 390 phone, and the 24-surface
  chain at 1440, all run at 60 fps with p95 ≤ 18.8 ms. One sample costs 0.9 ms of CPU for 24 surfaces in Node.

## Still open (not blockers)

- **verify-3:** at small t the sheets look the same and cross each other, and the walls end in comb edges at the
  height cap. The user decides on a per-sheet cue. The combs stay on the backlog.
- **verify-4:** All sheets while deforming is not yet measured on the Android phone.
- **verify-5 leftovers:**
  - F's formula still omits its branch (`F(z)=\log z` with k = 3).
  - With several window pieces on different branches, the window is still printed as k = −W…W.

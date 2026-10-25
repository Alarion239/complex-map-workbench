# Constructions v16: merge notes (into v15.2)

Source: `work/xvc-final-snap/` (src/, tools/, build.py, test/ without `*_cdp` folders), frozen 2026-10-24 after the
smoke check below. Base: `notes/v15.1-candidate`. Target: `work/xv152`. Do it as v15.2 did its pieces:
`git merge-file -p xv152/<f> notes/v15.1-candidate/<f> xvc-final-snap/<f>` for every changed file, copy the new files,
then regenerate the Russian table and rebuild.

## Last round (after review-verify.json)

| Item | What changed |
|---|---|
| verify-1 (high) | `app.js` editDown: the hit order is points, then curves, then areas (topmost first within each). A press on z₁ of a 3-point Circle (Curve) now takes z₁; the circle follows. The same order on a globe (globeDown, Select). New `constr_cmd` section V. |
| verify-2 (medium) | `v16-constructions.json`: genitive captions for a line and a ray bound at both ends (`cap.line2.gen`, `cap.ray2.gen`). The Russian caption now reads «… и~прямой, проходящей через $z_{0}$ и~$z_{1}$». New `constr_cmd` G check: no English words in the Russian caption outside maths. |
| verify-4 (low) | `construct.js` CSS: the row's name cell wraps, and the definition takes the full row width under the name when less than 8em is left beside it. New `constr_cmd` R check: the bound line's definition is not clipped. |
| new, found in the smoke | `app.js` rowName: a labelled point now takes a plane index, as drawPoints does. Before, in a scene with a labelled point (the "Strip to disk" example's z₀), the rows named new points z₀, z₁, z₂ while the plane and the definitions said z₁, z₂, z₃. New `constr_cmd` V check. |
| verify-3 (low) | Not changed. This run (1440, normal load): 50 dependents rAF work p95 19.8 and 20.9 ms (AS-BUILT 20.3), frame p95 50 ms (AS-BUILT 33.4). 1 and 10 dependents meet BUDGET60. 50 is "reported, not met" (SPEC 3 [C3c]). |
| picture-1, user-6 | Still open as the ledger says (fill stripes at s ≥ 1e8; no "Replace point…"). |

## Files

New: `src/constr.js`, `src/construct.js`, `test/constr_cmd.js`, `test/t_constr.js`, `test/constr_core_tests.js`,
`test/constr_review_tests.js`.

Changed (hunks against v15.1): `src/app.js` (84), `src/gl.js` (13), `src/figure.js` (8), `src/region.js` (8),
`src/phone.js` (5), `src/inspector.js` (3), `src/tour.js` (3), `src/inverse.js` (2), `src/i18n_ru.js` (generated),
`build.py` (file list), `tools/make_ru_table.py` (reads `v16-*.json`), `tools/ru_report.json` (generated),
`test/t_tour.js`, `test/tour_cmd.js` (nine chapters), `test/glsl_inverse_test.js`, `test/make_glsl_inverse_test.py`
(constr.js loaded; exact-form discs).

Already in the shared notes (nothing to copy): `notes/i18n/ru/v16-constructions.json` (140 entries),
`notes/tour/INTEGRATION.md` (tables "Anchors added in v16", "Events added in v16").

Unchanged by v15.2 so far, take as they are: `src/region.js`, `src/gl.js`.

## Trial merge against work/xv152 (its state at 17:41; v15.2 is still being built, so re-check)

Three conflicts, all "keep both":

1. `build.py`, the file list: v15.2 adds `recognize.js` after `inverse.js`; v16 adds `constr.js` after `region.js` and
   `construct.js` after `planemenu.js`. Take the union in that order.
2. `tools/make_ru_table.py`, the table loop: keep v15.2's loop (its `V152_NOT_HERE` and the `v152-*.json` glob) and
   append `+ sorted((notes / 'ru').glob('v16-*.json'))` last, so v16's entries are read after v15.2's. No English key is
   in both v152-*.json and v16-constructions.json, so the order does not change any string.
3. `src/app.js`, the test hooks near the end of init: v15.2 rewrote the `window.__cmwSound` line; v16 added
   `window.__cmwC` and `window.__cmwCI` (with their comments) right after it. Take v15.2's line, then v16's block.
   build.py strips every `window.__cmw*` from the published page; check it still asserts that.

Clean, but next to v15.2's changes (read them after the merge):

| app.js (v15.1 line) | v16 hunk | v15.2 change nearby |
|---|---|---|
| 4717 drawXTint | `cmFormAnchor(...)` | the deformation figure's vector layers (4719) |
| 7593, 7597 deleteShape / targetsChanged | the cascade toast; `structural = true` with constructions | the menu item's `h('button', …)` (7618) |
| 7844-7867 ptField / numField | `boundField` (a bound handle's field reads "= z₀", Make free) | the point field's `inp` (7847) |
| 8889 paletteItems | `Construct.paletteActs()` | the palette input placeholder (8902) |
| 10052 viewBoxOf / sceneMeta | `Constr.referencedSteps` | a removed line (10054) |
| 13091 the tour adapter `has` | `has('constructions')` | `sandbox` and the split offer (13096) |
| 13946 test hooks | `__cmwC`, `__cmwCI` | the conflict above |

`src/tour.js`: v16 inserts the chapter `construct` right after `edit` ("Editing the chain") and the anchor
`constructTools` in the anchor table; v15.2 bumped `edit` to rev 3 and changed the Sound step's text (lines 154 and
247). After the merge, check the chapter order and the counts: `test/t_tour.js` allows 5-9 chapters and 20-43 steps;
`test/tour_cmd.js` expects nine chapters in the menu (12 items) and nine "Tour: …" palette entries. If v15.2 adds a
chapter or steps, raise those numbers. t_tour's two known failures (`splitOffer`, `formula-split`) are v15.2 names
and should pass once v15.2's INTEGRATION.md tables are in.

`src/figure.js`, `src/inspector.js`, `src/phone.js`, `src/inverse.js`: no v16 hunk within 25 lines of a v15.2 hunk.

`src/i18n_ru.js`: never merge it; regenerate with `python3 tools/make_ru_table.py --strict` (0 unresolved).

## After the merge, run

`node test/t_constr.js` (164), all `test/t_*.js`, `test/constr_cmd.js` (114 checks, sections A-I, R, V),
glsl-test (0) and glsl-test-adv (304), the quality suite, `tour_cmd.js`, `v15_desktop_cmd.js`, `v15_phone_cmd.js`,
`export_cmd.js`, `i18n_cmd.js`, and the published page in English and Russian at 1440 and 390, light and dark.

## Smoke check of this snapshot (work/xvc, 2026-10-24)

- Build twice: the same bytes. Published `dist/complex-map-workbench.html` sha256 `56be93dd75fee6d5…c5aa1`
  (3,526,120 bytes; no `__cmw` hooks, no machine paths, no e-mail addresses). `dist/test.html` `4841e6c6…1e23e`.
  Snapshot hashes: `work/xvc-final-snap/SHA256SUMS`.
- Node: every `test/t_*.js` passes except t_tour's two known v15.2-name failures (`splitOffer`, `formula-split`, as on
  the frozen v15.1). t_constr 164/164.
- `make_ru_table.py --strict`: 0 unresolved (2464 entries).
- GLSL: glsl-test 574 chains, 0 failures; glsl-test-adv 612 chains, 304 failures (the known count, same chains).
- Quality suite (`--no-build`, port 9210): 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW, 259 targets met,
  RESULT PASS. baseline.json and the golden PNGs byte-unchanged.
- `constr_cmd.js`: 115/115 (A-I, R, V). Frame times: 1 dependent rAF work p95 1.8 ms, 10: 4.3 ms (frame p95 16.7 ms,
  BUDGET60 met); 50: 20.4 ms, frame p95 33.5 ms (reported, as SPEC 3 allows; the same as AS-BUILT).
- The published page (wrapped in a doctype and viewport meta as the host does), English and Russian, 1440 and 390
  (Android Chrome emulation, touch), light and dark: v15.1's release smoke (`notes/v15.1-candidate/evidence/
  smoke_cmd.js`: page, tour, deformation, export video preview, t drag with sound, no console errors or warnings),
  8/8 pass. A constructions check on the published page at 1440 (EN and RU, light and dark): 3 points by clicks,
  a Line dragged from z₁ to z₂ binds and reads "line through z₁ and z₂" in full, rows named as the plane labels
  them, no console errors: 4/4 pass. Shots and command files: `work/xvc/test/mrg_cdp/` (not in the snapshot).

Not in the snapshot: `test/*_cdp/` folders and `test/regress/quality/out/` (run output).

## Open, not blockers

verify-3 (the 50-dependent frame time; not reproduced in this run), picture-1 (fill stripes at s ≥ 1e8, the shared v15
pattern path), user-6 (no "Replace point…"), and AS-BUILT's "Not done" list. A long Russian definition (the
3-point disc, «круг, ограниченный окружностью через z₁, z₂ и z₃») still ends in an ellipsis after two lines at 1440;
the tooltip has it whole.

# Touching circle: as built

Built in `work/xv163` on 2026-10-26, on top of the Perpendicular circle, to `TANGENT-SPEC.md`. Not merged, not
published.

## What the user gets

- A sixth Construct tool, **Touching circle** (tile «Touching» / «Касание»). Pick a line or a circle, then the point
  where the new circle touches it (T) and a point it passes through (P), in either order.
- A point on the curve by construction is T: a click on the curve's stroke, a crossing with it, a point on it, or one
  of its defining points or handles. Any other point is P. A free point that only happens to lie on the curve is P.
- After T (curve a circle): the tangent at T is drawn dashed. A click on it gives the tangent line at T.
- After P (curve a circle, P outside): the two tangents from P are drawn dashed, with a ring at each touching point.
  A click on a ring gives that tangent line and its touching point, in one undo step.
- The curve stays picked, so each further circle is 2 clicks. Backspace drops the last point, then the curve. Esc
  cancels; on touch, the chip's ×.
- The curve can be any exact line or circle, as for perp, and the shown unit circle and axes too. Curve | Region and
  Use complement work on a touching circle; tangent lines are curves only. The plane menu on a curve has "Touching
  circle…". Intersect on a touching circle and its curve gives one point, exactly T. Rows, Inspector, captions, links,
  Y, Russian, dark, tablet and phone all work.

## Files changed (against the perp build)

| file | change |
|---|---|
| `src/constr.js` | `tangent-scratch/constr-touch.js` (tpatch.js on perp's constr.js, checked: same bytes), plus 2 lines of SPEC 3 that tpatch.js left out: `touchAt` is exported, and `describe` gives a touch's `fill` and a tangent's `index`. +128 / −7 lines. |
| `src/construct.js` | SPEC 4: +296 / −38 lines |
| `notes/i18n/ru/v163-constr.json` | +32 entries (26 strings, 6 caption `gen` forms) |
| `src/i18n_ru.js` | regenerated: 2360 entries (+32), 1766 call sites (+26), 0 unresolved; no existing entry changed |
| `test/constr_touch_tests.js` | new: section F of `t_constr.js` (tcheck.js's 35 checks, plus 1) |
| `test/t_constr.js` | calls section F, prints it in the summary |
| `test/touch_cmd.js` | new: the CDP check, sections A–H |
| `test/constr_cmd.js`, `test/perp_cmd.js` | the tile lists now end in `touch` (6 tiles, and the RU tile list) |
| `test/touch_cdp/` | a copy of `cdp_kit`: port 9822, `--disk-cache-dir` in the profile, q.sh waits up to 20 min (export_cmd: start the daemon with `CMW_BASE=http://localhost:9822/`). Profiles, queue and shots removed. |

No change to app.js (beyond perp's line), gl.js, glsl.js, region.js, sphere.js, figure.js, phone.js, tour.js,
page.html, build.py, the perf baselines, `accepted.json` or the golden images.

## Results

Evidence is in `evidence-touch/`.

| check | result |
|---|---|
| `node test/t_constr.js` | A 66/66, B 18/18, C 54/54, D 26/26, E 41/41, **F 36/36**: 241 passed. `touchForm` 1.6 µs, `tangentForm` 1.1 µs. |
| all `test/t_*.js` and the four construction suites | 38 of 38 exit 0 (`node_tests.txt`). t_i18n: 21082 checks. t_i18n_keys: 5574 checks (1766 keys). t_i18n_english: 977 outputs byte-identical. t_tour: 1326/1326. |
| `make_ru_table.py --strict` | 0 unresolved (`ru_strict.log`) |
| `test/touch_cmd.js` | **90/90**, no console errors (`touch_cmd.json`, and `touch_cmd_run2.json` on the final build) |
| `perp_cmd.js` | 79/79 |
| `constr_cmd.js` | 115/115 (run 2). Run 1 failed only its Russian tile list, which still had 5 tiles; the list now ends in «Касание». |
| `tour_cmd.js` | 97/97 |
| `i18n_cmd.js` | 94/94 |
| `v15_desktop_cmd.js` | pass (run 2). Run 1 failed one timing check, a shape drag at frame p95 17.2 ms, while the machine's load average was 14.8 (other agents' browsers). Run 2: p95 12.0 ms. That scene has no constructions. |
| `v15_phone_cmd.js` | pass |
| `export_cmd.js` | **pass**: 307 files, 80 figures, 0 fails, no console errors. It needs `CMW_BASE=http://localhost:9822/` in the daemon's environment. My first two runs did not set it, so they loaded port 8793, where nothing is served; they are void. |
| quality suite | `run.sh --no-build --base-url http://localhost:9822`: **PASS**. 81 runs: 0 failed, 28 improved, 35 unchanged, 18 new; targets 259 met. The same as v16.2 and perp. `baseline.json` unchanged (`quality_run.log`). |
| baselines | `quality/baseline*.json`, `perf/accepted.json`, `perf/results/baseline-*` and `quality/golden/` are byte-identical to the main tree's. |
| published file | no `__cmw` or `__qa` hooks and no localhost. Two builds give the same bytes: `complex-map-workbench.html` sha256 `b0748335…466f1fe` (3,872,740 bytes; perp: 3,842,099), `test.html` `0196c4ed…c7019c9` (`build.sha256`). |

tour_cmd, i18n_cmd and v15_phone_cmd ran on the build one edit earlier. That edit only stops the touch tool's hover
preview when the pointer is in the other plane (change 7 below). touch, perp, constr, v15_desktop and export ran on
the final build.

What touch_cmd measured:

- **Tangency (A3, A4).** At rest g / S = 0, and T and P are on K exactly. Over 20-frame drags g / S stays ≤ 2.5e−17,
  T and P stay within 1.4e−16 S of K, and no frame is undefined. The drags: T once round C, P across C, and P across
  the tangent at T. The core's copy of C's form equals the unit circle's.
- **The meet rule (A7, A8).** The touching point of a tangent from P is tp exactly. Intersect on K and C gives one
  point, exactly T. With Intersect, the hover ring at T is the crossing, exactly at T.
- **Speed (F, BUDGET60, best of 2).** The scene has 10 touching circles and 10 tangents built on them, with 1/z in Y.
  - Drag P: rAF work p95 5.0 ms, frame p95 16.8 ms, pointermove p95 1.5 ms.
  - Drag T: rAF work p95 2.4 ms, frame p95 16.8 ms, pointermove p95 17.9 ms. See Open.
  - Hovering with the hint, and with the rings: rAF work at most 2 ms, frame p95 16.8 ms.
- **Layouts (D).** At 1024 × 768 the rail fits; fitRail uses its three steps, as with perp. At 768 × 1024 it fits
  with nothing hidden. On the phone: 6 Construct tiles in More. A tap 8 px off the hint and a tap 18 px off a ring
  pick them; the chip's × cancels.
- **Captions (E).** All six read in English and Russian, for example «касательная к окружности $|z|=1$, проходящая
  через $z_1$» and «круг, ограниченный окружностью, проходящей через $z_1$ и касающейся окружности $|z|=1$ в точке
  $z_0$».
- **v16.2 on a link (B).** v16.2 opens the touching circles and tangents as their cached curves. The touching point
  stays a meet of the two curves, at the same place. There is one toast, "Opened the figure from the link."

Screenshots: `shots/touch/` (23 PNGs). They cover desktop light and dark, the hint, the rings and their hover, Region,
`inside`, Russian, Y, 1024 and 768, and the phone in English and Russian, light and dark.

## Changes from the spec (small)

1. **The row of the tangent at T has a context.** Its English, "the tangent to {c} at {a}", is also a caption. The
   app's caption path (`capT`) looks the nominative up with no context, so the caption keeps the plain key and the row
   uses `$tx('row', …)`. The spec put the context on the caption. Same strings, no app.js change.
2. **Strings and shots** go where the task says: `notes/i18n/ru/v163-constr.json` (not `v16-touch.json`) and
   `shots/touch/` (not `shots-touch/`).
3. **Section F has 36 checks**: tcheck.js's 35, plus one for `touchAt` and `describe`. One tcheck line had `a && b ||
   c` that would throw instead of failing; it now has brackets.
4. **Refusals on hover.** A target the click would refuse ("Click a point off Circle 1.", "needs distinct points")
   shows that text as the ring's warning chip, as perp's duplicate pick does. Empty space after P shows nothing; the
   click gives the toast.
5. **Rings only on the piece.** For an arc, a ring is offered only where the touching point is on the arc.
6. **Alt skips the hint** (as the spec says, with Snap off). Rings are not skipped: after P, only points on the curve
   are valid anyway.
7. **The other plane.** With the curve picked in X, hovering Y shows the curve ring a click there would start with,
   and no preview in X. (Perp still mixes the two planes' coordinates in its preview; not changed.)
8. **Names in G.** With one step in the chain, the image of z₀ in Y is z₀′, so G's row reads "through z₀′, touching
   Target circle 1 at p". The spec says z₀″.

## Open

- **Dragging T (a glider) is slower than dragging P.** In the pointermove handler, with 20 dependents, it takes
  p95 18 ms. Frames still hold 60 fps (p95 16.8 ms). The cost is not new: v16.2 drags a glider with region
  dependents the same way. A circle3 scene of the same size measured p95 17.2 to 17.7 ms in v16.2 and 15.1 to 20.9 ms
  here. A free point's drag defers to the frame (1.5 ms). Making a glider's drag defer too would be a change to the
  glider path, not to this tool; I did not make it. touch_cmd's F checks pointermove (≤ 14 ms) for P's drag only;
  for T's drag it checks the spec's BUDGET60 (frame p95) and rAF work, and records pointermove.
- **Not built (SPEC 8):** the circle with a given centre touching C, the parallel through a point, and circles
  touching two or three curves. These need the user's go-ahead.

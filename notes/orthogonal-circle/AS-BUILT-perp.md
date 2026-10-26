# Perpendicular circle: as built

Built in `work/xv163` (a copy of v16.2) on 2026-10-25, to `SPEC.md`. Not merged, not published.

## What the user gets

- A fifth Construct tool, **Perpendicular circle** (tile «Perpen-dicular», two lines at its soft hyphen). Pick a line
  or a circle, then two points. The circle through the points crosses the curve at right angles.
- The curve can be any exact line or circle: a circle, disc, line, segment, polygon side, arc, half-plane edge, sector
  arc or edge, annulus circle, a 3-point circle, or another perpendicular circle. Freehand and formula curves are
  refused with "Click a line or a circle."
- The shown unit circle and the two axes can be picked too. They become Circle n / Line n when K is made, in the same
  undo step. K then takes the next colour.
- The curve stays picked, so each further circle is 2 clicks. Backspace drops the last point, then the curve. Esc
  cancels.
- Points are picked as with the other tools: points, handles, crossings, zeros, z₀′ in Y, a point on a stroke, or a
  free point.
- Dashed preview through the pointer, exact at any radius. The plane menu on a curve has "Perpendicular circle…".
  Curve | Region and Use complement are in ⋯ and the Inspector. Gliders on K, export captions, links, English and
  Russian all work.

## Files changed (against notes/v16.2-candidate)

| file | change |
|---|---|
| `src/constr.js` | `proto/constr.js` copied as is. Re-running `proto/patch.js` on this tree's constr.js gives the same bytes. |
| `src/construct.js` | +162 / −21 lines: SPEC 4, plus the two items under "Changes beyond the spec" |
| `src/app.js` | one line: `nextCi(target, k = 0)` |
| `notes/i18n/ru/v163-constr.json` | new: 24 entries (20 strings, plus the 4 caption `gen` forms) |
| `tools/make_ru_table.py` | reads `v163-constr.json` (allow-list `V163_HERE`, like `V161_HERE`) |
| `src/i18n_ru.js` | regenerated: 2328 entries, 1740 call sites, 0 unresolved. Only the 24 new keys were added; no existing entry changed. |
| `test/constr_perp_tests.js` | new: section E of `t_constr.js`, the 41 checks of `proto/check.js` |
| `test/t_constr.js` | calls section E and prints it in the summary |
| `test/perp_cmd.js` | new: the CDP check, sections A–H |
| `test/constr_cmd.js` | the tile and rail checks now expect 5 tools instead of 4 (as SPEC 6 allows) |

No change to gl.js, glsl.js, region.js, inverse.js, sphere.js, figure.js, phone.js, tour.js, page.html, build.py,
the perf baselines, `accepted.json` or the golden images.

## Results

| check | result |
|---|---|
| `node test/t_constr.js` | A 66/66, B 18/18, C 54/54, D 26/26, **E 41/41**: 205 passed. Speed: `perpForm` about 1.9 µs; a drag with 10 dependents about 0.06 ms of CPU per recompute. |
| all `test/t_*.js`, plus the core and review constructions suites | all exit 0 (`evidence-perp/node_tests.txt`). The first run of t_i18n failed one check: a plain space before an em dash in my Russian string. I fixed the string, and t_i18n then passed 20822/20822. t_i18n_keys passed 5497 checks (1740 keys). t_i18n_english: 977 outputs byte-identical. t_tour passed 1326/1326. |
| `make_ru_table.py --strict` | 0 unresolved (`evidence-perp/ru_strict.log`) |
| `test/perp_cmd.js` | **79/79** (`evidence-perp/perp_cmd.json`), no console errors |
| `constr_cmd.js` | 115/115 |
| `tour_cmd.js` | 97/97 |
| `i18n_cmd.js` | 94/94 |
| `v15_desktop_cmd.js`, `v15_phone_cmd.js` | pass, 0 fails |
| `export_cmd.js` | 307 files, 80 figures, no console errors. **1 fail, the same in both runs**: "video globe: no main-thread task of 50 ms or more" (one task of 58 ms, then 56 ms). That scene has no constructions, and the video path is unchanged. The v16.2 merge run had the same timing check fail on the plane video, with one 80 ms task (notes/workflows/V16.2-MERGE.md). I did not rerun v16.2's globe video this session. (`evidence-perp/export_cmd.json`, `export_cmd_run2.json`) |
| quality suite | `run.sh --no-build --base-url http://localhost:9821`: **PASS**. 81 runs: 0 failed, 28 improved, 35 unchanged, 18 new; targets 259 met, 0 not met. Same as v16.2; baseline.json unchanged (`evidence-perp/quality_run.log`). |
| published file | no `__cmw` or `__qa` hooks, no localhost. Two builds give the same bytes: `complex-map-workbench.html` sha256 `b56166b1…25aaa31` (3,842,099 bytes; v16.2: 3,820,215), `test.html` `1cf5a9b8…a4b2b8` (`evidence-perp/build.sha256`). |

What perp_cmd measured:

- **The right angle (A3, A5).** At rest |cos| ≤ 1e−12. Over a 20-frame drag of z₀ across the circle: worst |cos| 1.1e−16,
  0 undefined frames, 0 flips.
- **The family (A12).** As C's centre is dragged across PQ (its handle snaps to the grid), K reads outside → half-plane →
  disc.
- **Speed (F, BUDGET60, best of 2 runs).** 1 dependent: rAF work p95 2.4 ms, frame p95 16.8 ms. 10 dependents: work p95
  5.3 ms, frame p95 16.7 ms. pointermove p95 ≤ 1.3 ms in both.
- **Layouts (D).** At 1024 × 768 the rail fits. At 768 × 1024 it fits with nothing hidden. On the phone: 5 Construct
  tiles. A curve picked 8 px off, a point picked 15 px off, and the ×.
- **Captions (E).**
  - EN: "…and the circle through $z_0$ and $z_1$ perpendicular to the circle $|z|=1$". For a polygon side:
    "…perpendicular to the line through $-1-i$ and $1-i$".
  - RU: «окружность, проходящая через $z_0$ и $z_1$ и ортогональная окружности $|z|=1$» and «…ортогональная прямой
    через точки …».

Screenshots: `shots/perp/` (18 PNGs). They cover desktop light and dark, Russian, the pencil, the curve kinds, the
family, Y, 1024 and 768, and the phone in English and Russian, light and dark.

## Changes beyond the spec (small, needed)

1. **The English tile wraps.** On desktop, English tile labels are on one line (`nowrap`), so «Perpen-dicular» was cut
   at 52 px. construct.js's CSS gives this one tile the Russian tile rule: two lines from 27 px, and a 56 px tile.
   Only this tile is affected, and it sits alone on the grid's second row.
2. **fitRail has a third step.** In the rail at 1024 × 768, the fifth icon pushed the rail's vertical "Region tools"
   label 40 px past the panel. v16.2 already cut that label by 10 px. When Grid, Polar grid, Freehand and Lasso are
   already gone and the rail still overflows, fitRail now hides that label too. The count and the open key stay. This
   only applies at 768 px wide and above, never on the phone.

## Differences from the spec's wording

- **Chip on a narrow pane.** At 1440 the left pane is 427 px, under 560, so the chip already uses the tile text
  ("Pick a line or a circle · Perpen-dicular · Esc cancels"). I kept "Esc cancels" on a narrow mouse pane, as every
  other Construct tool does. It is dropped on touch only.
- **Pencil test.** The pencil test in the app uses 0.5 + 0.5i and 1 + i. The spec's 0.5 and 2 would put 2 off screen
  at the scale where the grid snaps to 0.1. Both pairs are exact mirror images in the unit circle. The node test
  covers 0.5 and 2.
- **Names in the A3 row.** The test scene already has z₀–z₂ and a Circle 1, so A3 reads "through z₃ and z₄,
  perpendicular to Circle 2". The B and A13 scenes give "Circle 1", e.g. "Deleted Circle 1 and 1 shape built on it.".
- **v16.2 on a saved perp (B).** v16.2 frees K and keeps its cached circle, with one `loadFreed` event. But it shows
  **no** toast at startup, from storage or from a link:
  - `Construct.on` drops the toast while the app's adapter is not yet set, which is the case at load.
  - A link shows only "Opened the figure from the link."
  - v16.3 behaves the same. If the toast matters, queue it in `on()` until `ui(A)` arrives (a few lines). I did not
    make that change.
- **Strings file.** The strings are in `notes/i18n/ru/v163-constr.json` (as the task says), not `v16-perp.json`. With
  that name, other trees' table builds do not pick it up.
- **One Russian string differs from the spec table.** «0 в {p}, ½ — в противоположной точке» has a no-break space
  before the em dash (the house rule t_i18n checks).

## Not built (SPEC 8)

These are unchanged: the straight perpendicular from P to C (one question for the user), the circle with a given
centre, the circle through P perpendicular to two curves, and a decimal line-case rule for a line C. The Touching
circle (TANGENT-SPEC.md) is to be built on top of this tree.

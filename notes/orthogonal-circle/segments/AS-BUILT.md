# Inside C only (v16.4): as built

The user, 2026-10-26: "Yes: add an "inside C only" option so a perpendicular circle can be drawn as the arc inside C
(a hyperbolic segment), in v16.4." Built to `SPEC.md` in `work/xvhs` (a copy of v16.3). The main tree, `src`, `dist`,
`build.py`, the baselines and the golden images were not touched.

**In one line:** a perpendicular circle K can be drawn as its arc on one side of its curve C, ending exactly on C. Rows
and captions call it a **hyperbolic line** («гиперболическая прямая»), not a segment (SPEC 0).

## What the user sees

- **The Orthogonal tool's chip** has `[Whole | Inside]`, Whole by default, kept for the session. On a narrow pane or on
  touch it shows the two 16 px icons (the arc whole, or inside only, over a thin circle). The Inside button's tooltip
  explains it. The dashed preview draws the arc the click will make.
- **A circle made with Inside** is named "Arc n" (`nk: 'arc'`). The switch never renames anything.
- **The Inspector**, under Curve | Region: `[Whole | Inside | Outside]` for a circle C, `[Whole | Above | Below]` for a
  line C (`Left | Right` when C is steeper than 45°). The side drawn now is on.
- **The row's ⋯ menu**: "Inside {c} only" (a line C: "One side of {c} only") while off; "Other side" and "Whole circle"
  while on. Region turns the switch off.
- **Rows**: "hyperbolic line inside Circle 1, through z₀ and z₁" (outside / on one side of …).
- **Captions**: "the hyperbolic line through $z_0$ and $z_1$ in the domain $|z|<1$". When P or Q is off the drawn arc:
  "the hyperbolic line in the domain $|z|<1$ on the circle through … perpendicular to …". Russian: «гиперболическая
  прямая в области $|z|<1$, проходящая через $z_0$ и $z_1$» / «…, лежащая на окружности, проходящей через …».
- **Gliders** run from one end (t = 0) to the other (t = 1) and stop there. The Inspector's t reads "0 and 1 at its ends
  on {c}". **Crossings** off the arc are undefined ("nomeet"), so Intersect finds only hyperbolic crossings.
- **Y, the deformation, export**: K is one open curve (two when the arc of a line passes through ∞), mapped like any other.

Screenshots: `shots/` (disc and half-plane, light and dark, English and Russian, tablet 768, phone 390 with the chip,
the preview, the perf scene). Test outputs: `evidence/`.

## Files

| file | change |
|---|---|
| `src/constr.js` | +274 / −10 lines. `segOf` (the ends, the side, the arc's u-range, the kind fields), the perp branch, the seg piece in `pieces`, `segAt` in `meetsOf`, seg branches of `glide`, `projectPiece`, `onPiece`, `tRange`, `pieceDist`; `pts3In` null for seg; validate and `describe`; `segSideOf`, `segSides`, `setSeg` (with the glider remap), `mirrorIn`, `segCurves` / `segSample`; `sampleMR`'s parameters split out as `mrTaus` (its output is unchanged). |
| `src/construct.js` | +118 / −9: `segMode` and the chip control, `finish`, the preview (`strokeSeg`, `previewSeg`), `strokePiece`, rows, the ⋯ items, `setSeg`, `setFill`, the Inspector control, `tMeaning`, `phrase`, `nameKind`, `pieceDist`. |
| `src/region.js` | +2: `curvesOf`'s first branch. |
| `src/app.js` | +5 / −2: `nameKind` (as construct.js's). |
| `notes/i18n/ru/v164-segments.json`, `tools/make_ru_table.py` (`V164_SEG_HERE`), `src/i18n_ru.js` | 21 entries; regenerated with `--strict`: 0 unresolved, 21 entries added, 0 changed, collisions as v16.3 (15). |
| `test/constr_seg_tests.js`, `test/t_constr.js` | section G, 29 checks |
| `test/perp_cmd.js` | section I, 31 checks |

## Where it differs from the spec

1. **Drawing a circle K's arc.** The spec drew every arc from `sampleMR`'s samples. A circle no larger than 50 window
   diagonals (Region's `MR_RATIO`, the rule a whole K already follows) is drawn by its angle instead: `sampleCurve`'s
   uniform samples, as a whole circle is, with the ends exact. Lines and larger circles use `sampleMR`'s samples
   (`segSample`). Why: with `sampleMR` for every arc, 10 seg dependents cost 1.4 ms more rAF work per frame than 10 whole
   circles (4.5 vs 3.1 ms p95), over the 1 ms budget. Now 2.3 vs 1.9 ms, and 1.4 vs 2.4 ms on the final build (the
   machine is shared, so the runs vary by about 1 ms).
2. **A line's arc is the line kinds' own curves, not a NaN break** (since the review fixes, math-1). The chord is a
   segment; the vertical ray, and the two rays outside C, are Region's long rays (the FAR clip and `c.reach`), so the
   settle refinement, its tails and curvePieces' clip treat them as a whole line does. The two rays are two curves, each
   running from the arc's start toward its end.
3. **The ⋯ item** turns on the side SPEC 2.2 chooses; for a disc C drawn as its complement that is its region, outside,
   and the item then reads "Outside {c} only" (review math-6).
4. **The glossary** (`notes/i18n/GLOSSARY.md`) is outside this round's folders, so the two terms are proposed here
   rather than added: «гиперболическая прямая» (hyperbolic line: the whole geodesic, its ends on C) and «гиперболический
   отрезок» (hyperbolic segment: between two points inside C; not built).
5. **Size.** constr.js grew by 274 lines, not about 80: the side words, the remap and the sampler live in the core so
   that node tests reach them.

## Checks

| check | result |
|---|---|
| `node test/t_constr.js` | A 66/66, B 18/18, C 54/54, D 26/26, E 48/48, F 39/39, **G 29/29**: 280 passed. |
| section G, in short | 2000 random disc geodesics: ends within 4e−15 of both curves, 0 glides or samples outside, every arc through P and Q, `glide(0)`, `glide(1)` the ends bitwise. Intersect(K, C) bitwise in both orders (i ↔ 1 − i). Crossings outside the disc are `nomeet`; ultraparallel geodesics `nomeet`. Every SPEC 3 case on both sides. Continuity through K's line case: glider step 3.8e−4, end step 2.0e−3 (chordal); through ∞: 2.6e−4 / 6.8e−5. P across C: 0 bad frames. Use complement on C leaves the arc. C through its own line case: continuous, words in → above → out. Remap on / other side / off. Save and load bitwise; validate; v16.3's validate keeps `seg` and draws the whole circle; a seg K adds 0.2 µs per recompute. |
| all `test/t_*.js` | 34 of 34 exit 0 on the final source (`evidence/node_tests.txt`). |
| `make_ru_table.py --strict` | 0 unresolved; the table is unchanged by a re-run (`evidence/ru_strict.log`). |
| `perp_cmd.js` section I | **31/31** on the final build (`evidence/perp_cmd_I_final.json`; details below). |
| `perp_cmd.js` A–I | **108/108**, no console errors (`evidence/perp_cmd_full.json`; one build before the preview fix, see below). |
| `touch_cmd.js` | 90/90 |
| `constr_cmd.js` | 115/115 |
| `fix163_cmd.js` | 20/20 (it reads its port from `CMW_PORT`; the first run had none and stopped on a touch event with no target) |
| `i18n_cmd.js` | 94/94 |
| `export_cmd.js` | pass: 307 files, 80 figures, 0 fails, no console errors |
| `v15_desktop_cmd.js`, `v15_phone_cmd.js` | pass, pass |
| quality suite | **PASS**: 81 runs, 0 failed, 28 improved, 35 unchanged, 18 new; targets 259 met. The same as v16.3. Run with `run_quality.js` on port 9861 through a temporary copy that adds `--disk-cache-dir` inside its profile (deleted). |
| baselines | `quality/baseline*.json`, `perf/accepted.json` and `quality/golden/` are byte-identical to the main tree's. |
| published file | no `__cmw` hooks and no localhost; `complex-map-workbench.html` 3,917,620 bytes (v16.3: 3,889,072). |

**The preview fix.** The gate's first runs found nothing, but the preview screenshot showed no dashed arc: after the
change in "Where it differs" 1, a circle's arc has no `gsamp`, and `strokeSeg` called it. `strokeSeg` now samples such a
curve with `Region.sampleCurve`. Section I gained a check for it (the overlay's pixels on K's carrier: 98 of 102 inked
inside the disc, 0 of 41 outside) and passes on the final build. The other suites ran on the build before this one-line
fix; it touches only the seg preview and a seg curve picked as C.

Section I measured (desktop 1440 unless named):

- **Chip and disc.** Three geodesics made with the chip on Inside: arcs, `seg` 1, Arc 1–3, rows "hyperbolic line inside
  Circle 1, through z₀ and z₁". Intersect(K, C) points equal the hooks' ends bitwise in both orders.
- **Preview.** The dashed preview is the arc inside the disc only (overlay pixels, above).
- **No pixel outside.** 113 points sampled on the carriers outside |z| = 1 + 5 px: 0 differ between the screenshots with
  and without the K's.
- **Drag through the diameter.** z₀ dragged 20 frames across K's line case: 0 undefined frames, the arc stays inside,
  its ends on |z| = 1 to 1e−14.
- **Inspector and ⋯.** Whole / Inside / Outside and Other side: one undo step each. Region turns it off. A glider dragged
  past an end stops there (t = 0, the end bitwise). A crossing of two geodesics becomes undefined (nomeet) when one
  is moved away.
- **Half-plane.** A semicircle and the vertical ray from 1 (kind ray), drawn above the axis to the pane's edge, nothing
  below.
- **Y under 1/z.** The image is the open arc: 0 of 598 points on the image of K's outside part carry K's colour.
- **Export captions.** cap.seg and cap.seg_on in English and Russian. The figure's SVG uses butt caps.
- **Links.** Reload is bitwise. The v16.3 page opens the link as the whole circle with `seg` kept, with no console error.
  The v16.2 page shows a plain arc, except in the two-rays case (the outside of a diameter): its cached fields are
  collinear, and v16.2's arc3 draws them as the chord inside C, the complement of what v16.4 draws (review math-8).
- **Layouts.** Dark; Russian (chip «Целиком | Внутри», row, Inspector «Целиком | Внутри | Снаружи», ⋯ «Другая сторона»,
  «Окружность целиком»); the Inspector control is 215 px wide, so it fits a 360 px Inspector; tablet 768; phone 390 × 844.
- **BUDGET60.** 10 seg dependents, 1/z in Y, P dragged: frame p95 16.7 ms; rAF work p95 1.4 ms against 2.4 ms for 10
  whole circles (final build; the run before: 2.3 against 1.9).
- **Phone chip.** At 390 × 844 (Android Chrome user agent, touch) the chip reads "Point 2 of 2 · Orthogonal", the two
  icons and the ×, on one line (`shots/seg-p390-chip.png`, from perp_cmd D).

Not checked in the browser: the globe (it draws through `curvesOf`, as Y does), and the SVG path's end points to 1e−9
(only the caps were read). The Preimage limit of SPEC 6.1 (the two-rays case drawn as its chord in Preimage mode) is
as specified; the same cached fields make v16.2 draw that case as the chord (review math-8).

## Review fixes (2026-10-26)

`review-math.json` and `review-user.json`: 18 findings; `ledger.json` has each one. Fixed: math-1 to math-7, user-2,
user-4, user-5, user-6; user-3 in part (the comma; the grouping is not done). Documented: math-8. Not done, with
reasons: user-1 (a question for the user), user-7, user-8, user-9 (as the reviewer suggests). user-10 needs nothing.

- A line's arc is drawn as the line kinds' long rays (2. above). Under exp the vertical geodesic's Im step is 0.25 rad, as
  for the whole line (it was 36 rad); its 1/z image reaches 0 (3e−19).
- A glider at ∞ stays at ∞ when the switch changes; on the chord it goes to C's centre, its mirror image.
- Limiting parallels (a common end on C) have no meet at either index.
- Captions: the outside's domain is $\{|z|>1\}\cup\{\infty\}$; "through z₀ and z₁" only when both lie strictly
  inside; a seg caption ends with a closing comma when more words follow (Russian participial phrase; English "…, in
  the z-plane"), dropped before punctuation and at the end (app.js `pcTidy`, figure.js `pcOut`).
- Rows: "… inside Circle 1, on the circle through z₀ and z₁" when z₀ or z₁ is not strictly inside.
- Chip: words when they fit the plane (measured after each text change), icons on touch or when they do not; Whole's
  tooltip "Whole: the whole circle". On touch both chips' segment buttons take taps 40 px tall.
- Strings: 7 added to `v164-segments.json`; `make_ru_table.py --strict`: 2398 entries, 0 unresolved.
- Tests: t_constr G 37/37 (8 new checks) and all 34 `test/t_*.js` exit 0; perp_cmd A–J 117/117 (section J: 7 new
  checks; I8 frame p95 16.7 ms, rAF work 1.4 ms seg vs 2.4 ms whole), no console errors; constr_cmd 115/115; i18n_cmd
  94/94. Outputs: `evidence/fix-*`, shots `shots/seg-fix-*.png`. Baselines and golden images unchanged.

## Open

- The one question for the user (SPEC 12): also offer "Between z₀ and z₁" (the true hyperbolic segment)?
- The hyperbolic half-plane (a region) and the switch for 3-point and touching circles are not built (SPEC 12).
- Cleanup done: the copied `dist/v162-test.html` and `dist/v163-test.html`, the harness copy `test/xvhs_cdp`, the
  quality run's output and the Chrome profiles are deleted; the server and the browsers are stopped.

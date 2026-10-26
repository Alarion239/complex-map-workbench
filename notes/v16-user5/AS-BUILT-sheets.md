# All sheets during the deformation: as built (v16.1, user report 5)

Built 2026-10-25 in `work/xvsh` (a copy of v16). Design: `SHEETS-DESIGN.md` (this folder). Pictures: `sheets/`.

## 1. What it does

The user's case now works: chain √ then sin, √ bracketed (Only f₁, inside F), Landscape, All sheets. The Landscape
draws H_t on **the sheets that become F's**: two surfaces that are one sheet (sin z) at t = 0, split apart as t grows,
and are ±sin √z at t = 1. Play it backwards to see the two sheets merge into one.

- Every multivalued piece keeps its sheet number from F's All sheets and its path runs on that sheet, with the
  local cut opposite its input at the cell centre: roots and real powers z^s (s = 1 + (α − 1)t), complex powers, log
  ((z^u − 1)/u + u), formulas recognised as catalog steps (their steps' paths in turn).
- n-sheet pieces draw n surfaces (√: 2); log and irrational or complex powers draw F's window of 2W + 1.
- One after another, all at once, focus k and a bracket all work: the steps applied in full keep their sheets, the
  deformed step's sheets split from one, steps not yet begun are not applied. At t = end the surfaces are F's, combo
  for combo; at t = 0 the deformed pieces are the identity on every sheet.
- The title reads "landscape of Im H_t, all sheets" ("…, все листы"); the caption says "the sheets of H_t that
  become the sheets of F are shown" (screen and figure).
- Not drawn as sheets (one surface, as before; the check's tip says why): a d/dz among the applied steps, a deformed
  formula with branch points that is not catalog steps (e.g. log z + √z), map mode 2.

## 2. Where the build differs from the design

1. **Height while deforming**: the plain deformation's compressed Re / Im with F's steady median scale, not the
   static All sheets' linear height. With the linear height the values of H_t far outside F's range (sin z at t = 0:
   Im up to about 27 against about 2 for F) met the clamp in vertical walls. Consequence: at t = end the picture is F's
   sheets in compressed height; closing the transport switches to the linear static view. Design 4 updated.
2. **chainSheetHom is its own GLSL** (`GLChain.build(...).sheetHom`), put only into the three sheet programs. Every
   other program's source is byte-identical to v16 (checked on 9 chains, including d/dz and sheet chains).

## 3. Files

| file | change |
|---|---|
| `src/funcs.js` | `stepPair` moved out of `sheetEval` (same code); new `sheetMapHow`, `sheetHomOk`, `sheetMapPieces`, `sheetMapCombos`, `homPair`, `sheetMapEval` (the CPU twin). |
| `src/glsl.js` | sheet plans get `homApply` (root, powa, log) and `hfn` / `homCall` (recognised formulas, `P_sh`); `build` returns `sheetHom` (`cxs0_lh`, `cxs0_how`, `chainSheetHom`) and `sheets.mapPieces`. |
| `src/gl.js` | `SHEET_MAP` (`mapSheet`: mode 0 → `chainSheetRange` as before, modes 1 and 3 → `chainSheetHom`) in the three sheet programs; `sheet: true` programs take `sheetHom`; `sheetPlan` for modes 1 and 3; the sheet heights keyed by the map; `info.sheets.hom`. |
| `src/app.js` | `render3D` draws sheets while deforming (`deformSheetsOk`); `sheetsShown` for the title and captions; the check's tip; test hooks `__cmwLandSheets`, `__cmwCapText` (debug block, not published). |
| `src/figure.js` | the landscape caption's sentence for H_t with sheets. |
| `tools/make_ru_table.py` | reads `notes/i18n/ru/v161-*.json`. |
| `notes/i18n/ru/v161-user5.json` | three strings (`u5.*`). |
| tests | `test/t_sheets_deform.js` (new), `test/glsl_test.js` (mode 9 rows, 8 chains), `test/sheets_deform_cmd.js`, `test/sheets_film_cmd.js` (new). |

Also changed on the way: the landscape captions (screen and figure) said "all sheets of the Riemann surface are shown"
whenever All sheets was checked, also for a single-valued F and during the deformation (when one surface was drawn).
They now follow what is drawn (`sheetsShown`).

## 4. Tests

Final build: `dist/test.html` 4e70ba49…, published page 579acd32… (no `__cmw` hooks). Headless Chrome through
`test/xvsh_cdp` on port 9702, one browser at a time; the Mac was loaded the whole time (load average about 19).
Evidence (JSON, logs): `sheets/evidence/`.

| test | result |
|---|---|
| `node test/t_sheets_deform.js` (new) | 33105 checks, 0 failed, 68 cases (11 chains × whole / all at once / every bracket / every focus). **At t = end every surface equals F's All sheets combo for combo, bit for bit; at t = 0 every surface equals H₀'s** (pre and post on their sheets, the deformed pieces the identity); counts never above F's; the node between two steps; the user's numbers (t = 0: sin 4 twice; t = ½: sin 4^{3/4} and −i sinh 4^{3/4}; t = 1: ±sin 2); sheet 0 at the centre = the plain H_t; the maps with no sheet form. |
| all `test/t_*.js` (34 files) | all pass (t_deform_range 1086/1086, t_i18n, t_i18n_keys, t_i18n_english byte-identical). |
| `make_ru_table.py --strict` | 2272 entries, **0 unresolved**, collisions 15, unused 1. |
| glsl-test | 582 chains (v16: 574; + 8 deformation-sheet chains), 6.13 M compared, **0 fails**, singular 0 bad. New mode 9 rows (`chainSheetHom` against `Funcs.sheetMapEval`): 1983 rows, 794 169 points, 0 fails. |
| glsl-test-adv | 612 chains, 8.67 M compared, 304 fails in the same 10 known chains as v16 (identical counts). |
| glsl_inverse | pass: walk 882 cases 0 fails, anchors 5120 points 0 fails, clip 0 fails. |
| `sheets_deform_cmd.js` (new) | all functional checks pass at 1440 × 900 and 390 × 844 (Android UA), EN / RU, light / dark: two surfaces of H_t at t = 0, ½, 1, the title "…, all sheets" / "…, все листы", F's sheets back after closing, no phone overflow; whole chain (K = 2 through both steps), focus f₁, a log window (5 surfaces at every t), log z + √z (one surface, the tip), the caption. Frames: below. |
| `deform_range_cmd.js` | sections 2 to 9 pass. Section 1 ran against the v16 candidate as its baseline (`v16m.html` = v16's test.html): every map, key, title equal, **frames 0 px over 8/255 in all 8 scenes, with and without paths**; its 33 "key + \|lo\|b\|p1" fails are the baseline's own suffix (both keys identical, the check expects a pre-range baseline). |
| `deform_nat_cmd.js` | pass. |
| quality suite (`run.sh --no-build --base-url http://localhost:9702`) | **PASS**: 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW; targets 259 met. Baselines, golden images, accepted.json untouched. |

Frame times while playing the user's case (3 s, Landscape, `__qa.frames`), All sheets on / off on the same chain:

| size | All sheets on | off (plain deformation) |
|---|---|---|
| 1440 × 900 | 60 fps, p95 18.4 / 18.2 ms | 60 fps, p95 18.6 |
| 390 × 844 | 60 fps, p95 19.0 / 17.7 ms | 60 fps, p95 18.4 |

(An earlier run: desktop 17.6 / 18.0 against 18.7, phone 18.6 / 18.5 against 18.9.) Every run is at 60 fps; the
sheets runs bracket the plain ones, so the extra height pass costs nothing measurable here; one phone run's p95 is
0.6 ms over the plain run's. The 18.4 ms bar needs a quiet machine and the Android phone.

## 5. Open items

- The height choice (2.1): compressed while deforming, linear when static. If the user prefers the static linear
  height during the deformation too, it needs a scale that covers H_t (the start can be far larger than F).
- Saturated, oscillating values (Im sin w for large Im w, t ≈ 0.2 in the user's case) show the renderer's dropped
  cliff triangles as comb edges; the plain landscape shows the same (not new).
- Frame times on a quiet machine and on the Android phone itself (emulation only here).
- Not built: All sheets for a deformed formula with branch points that is not catalog steps, for a d/dz in the
  chain, and for the straight-line mode 2 (one surface, with a tip saying so).
- **Shared Russian table**: `notes/i18n/ru/v161-user5.json` is written by three pieces of user report 5 (this one,
  the tour in `work/xvta`, the export in `work/xvex`). At 13:23 this piece overwrote the file that `work/xvex` had
  created at 13:20 and lost its 15 entries; they were restored from `work/xvex/src/i18n_ru.js` (built 13:20:38 from
  that file) as `xvex.restored1…15`, with the same English and Russian but not the original ids and notes. The export
  piece should check them. The file now says to edit it by read-modify-write only.
- Merge: `work/xvex` also edits the landscape caption line of `figure.js` and `stepSheets` in `funcs.js`; the two
  pieces' changes to those lines must be merged by hand.

## 6. Running the tests

- Node: `node test/t_sheets_deform.js`.
- Chrome: copy `test/cdp_kit`, set your port, start the daemon, serve `dist/`; `python3 test/make_glsl_test.py`, then
  open `glsl-test.html` (`__glslTest.sheetHomRows`, `.comparedSheetHom`); `q.sh test/sheets_deform_cmd.js`;
  `q.sh test/sheets_film_cmd.js` for the filmstrip frames (`film-*.png` in the kit's `shots/`).

Cleanup done: daemon and server stopped, Chrome profile deleted, no cmw-* temp folders of mine, the generated test
pages removed from `dist/` (it holds the two built pages).

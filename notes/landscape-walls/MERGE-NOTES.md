# Landscape walls: merge notes (into v16.2), round 3

Snapshot: `work/xvls-final-snap/` (src/, tools/, build.py, test/ without the `*_cdp` folders), frozen 2026-10-26 after
round 3's last pass. It builds to the same bytes as `work/xvls/dist` (published file sha1 `a5ea57cc…`, built twice and
once from the snapshot). Round 2's snapshot is now `work/xvls-final-snap-r2/`, round 1's `work/xvls-final-snap-r1/`.
Base: `work/xvsh-snap`. The sheets piece's later fixes are in `work/xvta`.

What round 3 is: `r3/AS-BUILT.md` (walls while the deformation plays, cold opens, Max mesh), `r3/ledger.json` (fixes
after the reviews), `r3/review-verify.json` (what the verifier found after them), `r3/final/` (this last pass).

## Round 3, last pass before the freeze (2026-10-26)

- **verify-2 fixed (WebGL errors with All sheets, two-step deformation).** Cause found: All sheets' grid size M follows
  the sheets' count, which changes between the steps of a deformation; a fenced levels read of the former M was taken
  as the new M's (`o.lvM = M`), and its smaller array was uploaded at the new size (texImage2D 'not big enough', then
  texSubImage2D 'offset overflows' every frame, a slit in the picture). Now a read is taken only when its length is
  `Mq * M * 4` (`sheetRefine`, `landRefine`), and `rfApply` never uploads levels of another size (drawn unrefined that
  frame). Check: the verifier's flow (fresh `\sin\sqrt{z^2+c}` after sqrt z, All sheets, f1 -> f2 played 1 s after the
  open, 8 s): 0 console messages in 2 of 2 runs (verifier: 50 to 94 errors in 3 of 3), base 0.
- **verify-1 fixed (open and play at once tore the walls).** The deformation's edge pass (`landEdgeH`) now starts
  compiling in the background while no deformation shows, at rest, once the surface has been drawn and its own
  refinement and edge passes are in use (`edgeAhead`, mode 0; its settle clock starts when it lands). While a
  deformation plays, its pass is first drawn as soon as it has settled, even in a moving frame (`landHeights`, `defo`),
  instead of waiting for a rest frame that never comes while it plays. Check (desktop light, user's case, Loop on,
  opened and played at once): default mesh t = 0.19 and 0.29, Max t = 0.23: clean walls; base at t = 0.18 torn
  (`r3/final/open-and-play-r3final-vs-base.png`: this build default, base default / this build Max, this build at
  3.2 s). Frame gaps over 4 s from the open, alternating: this build none over 50 ms in 2 of 2, base one 68 ms.
  If the deformation is opened within about 1 s of a fresh formula (pass not yet settled), the old rule draws until it
  has, and its first draw then lands mid-play (one frame, round 3 measured 90 to 250 ms): not measured here.
- **verify-6 partly fixed.** The base's TEMP-DEBUG-HOOK blocks (`EVAL_VS`, `evalPt`, `GLR.evalMap` and `_map`) are back
  in `src/gl.js`, unchanged (build.py strips them from the published file). Round 3's own hooks (`GLR._lw`,
  `landMesh`, `landRefine`, `_lwLog`, `_lwT`, `_lwF`) are not in the snapshot, so `test/landscape_walls_cmd.js`'s
  mesh and motion parts cannot run on it.
- Built twice, same bytes. The published file has no `TEMP-DEBUG`, `evalMap`, `__cmw`, `_lw`, `landMesh`, machine
  paths or emails. 35 of 35 node `test/t_*.js` pass (`r3/final/node_suite.txt`). Quality, GLSL and export suites not
  re-run on this pass (round 3's runs: `r3/AS-BUILT.md`).

## Round 3 code (on top of round 2; see r3/AS-BUILT.md and r3/ledger.json)

- `src/gl.js`: `facetW` in `LAND_FS` (contours from the facet's own height on steep facets), `landB` (steep base
  triangles while moving), `landSheetRF` split from `landSheetTF`, `landSheetC` (block clip only for linear heights),
  fenced level reads (`lvFetch`, `lvTake`, `lvCollect`, `lvIdleArm`, `lvTailMark`, `LV_LATE`), `rfPlan` / `rfApply`
  (typed-array lists, textures written in place), `settled` / `RF_LATE`, `rfWarmed` / `RF_PROGS` (background links),
  `edgeAhead`, compile groups per surface, and this pass's changes above.
- `src/app.js`: the step cards' Landscape says it is a card (`card: true`); `camSpin` counts as moving.
- `test/landscape_walls_cmd.js`: motion part, cold opens with All sheets, Max rows in BUDGET60.


## Files that differ from base

| file | what |
|---|---|
| `src/gl.js` | the whole walls piece, rounds 1 and 2 (24 hunks, below) |
| `src/app.js` | 2 lines in `render3D`'s `GLR.drawLandscape` call (base 3590): `motion`, `full`; round 3: `card: true` on the step cards' Landscape, `camSpin` counted as moving |
| `src/glsl.js` | round 1, unchanged in round 2: `hc` local-cut path form, `cutKindOf` / `NONSHEET_CUT`, `chainSheetHom` uses `_hc`, `cutKinds` export |
| `src/funcs.js` | round 1, unchanged in round 2: `localCutHom` (new, before `sheetMapEval`) and one line in `sheetMapEval`'s loop |
| `test/t_landwalls.js`, `test/landscape_walls_cmd.js`, `test/wl_diag.js` | new |
| `test/regress/quality/run_quality.js` | `--disk-cache-dir` inside its temp profile |

`src/i18n_ru.js` and `tools/` are the base's (no new strings; `make_ru_table.py --strict`: 0 unresolved).
`test/regress/*/out/` holds test outputs and is not part of the merge.

## gl.js hunks (round 2's table; round 3 adds to the same blocks, listed above)

| base line | block | change |
|---|---|---|
| 1859 | `HEIGHT` | linear Re/Im (modes 4, 5) keep heights up to `uHClip` H |
| 1880 | before `LAND_TF_VS` | new `REFINE`, `REFINE_BUILD` (GLSL: levels, snapping to 16ths, sub-cell vertices) |
| 1896 | after `LAND_TF_VS` | new `LAND_LV_VS`, `LAND_RP_VS`, `LAND_RA_VS` (refinement passes), `LAND_EDGE_VS(kind)` (round 1) |
| 1927 | `LAND_NRM_VS`, `LAND_VS` | normals one-sided only across a real jump; `LAND_VS` skips refined cells (`uRefOn`); new `LAND_R_VS` |
| 1980 | `LAND_SHEET_TF_VS`, `LAND_SHEET_VS` | `LAND_SHEET_TF_VS(ref)` with the refinement passes (uPass 1, 2), box clip, `uHClip` |
| 2054–2097 | `LAND_FS` | `LAND_FS(sheet, plain, lite)`: undersides in the surface's colours, the sheet tint (`uCueK`), box rim |
| 2138, 2160 | `TIERS` / `FLOOR_FS` | contact shading skips corners below −1.25 H |
| 2290 | `runTF` / `SAMPLER_UNITS` | binds on the active unit; new samplers |
| 2361 | `DEFS` | `landEdgeS/H/2`, `landLv`, `landRP`, `landRA`, `landR`, sheet programs with `ref` |
| 2440–2497 | `getProg`, `pollCompiles` | compile groups (`GROUPS`, `groupDone`, `finishGroup`): a surface's chain programs are taken into use in one frame |
| 2547 | `use` | `GLR._lwLog` first-use log, inside `TEMP-DEBUG-HOOK` |
| 3206 | `init` | (small) |
| 3960 | `landColors` … `landHeights` | `cutModeOf`, the edge passes, the refinement (`RF_*`, `rfLater`, `rfWarmed`, `lvFetch`, `rfBuild`, `landRefine`) |
| 4033–4052 | `sheetHeights` | `uHClip`, `sheetRefine` (All sheets, progressive at rest, swapped in when complete) |
| 4102, 4158 | `drawLandscape` | the refinement's scale, `GLR._lw` (inside `TEMP-DEBUG-HOOK`), refined groups drawn with `landR`, edge textures, `uClip`, `uHClip` |
| 5291 | GLR api | `landMesh(n)`, `landRefine(read, n)` test hooks, inside `TEMP-DEBUG-HOOK` |

## Where work/xvta meets these changes

1. **`chainSheetHom` signature (must fix, or the H edge program will not compile).** xvta adds a last argument,
   `int end` (glsl.js base 1195, and `SHEET_MAP` in gl.js passes `uSheetB`). `LAND_EDGE_VS`'s `contAt` (gl.js,
   new code after base 1896) calls it with 10 arguments. After the merge pass `0` as `end`:
   `chainSheetHom(zc, z, uMode, uBase, uA, uHi, uB, uPost, uT, 0, 0)`. The edge pass compares with the principal F.
2. **glsl.js `chainSheetHom` generator (text conflict, base 1185–1205).** Both change it. Keep this piece's `hcFns` /
   `shHead` and the first branch `if (!sp && plan.hc)` (the `_hc` path, no `end` case needed), and xvta's signature
   and `end` digits. Keep `sh = sh.slice(0, shHead) + hcFns + ...` after xvta's `return p.zw`, then `cutKinds`.
3. **gl.js `HEIGHT` (text conflict, base 1870).** xvta adds knee modes 6 and 7 after modes 4 and 5. Keep this piece's
   4/5 block (with `uHClip`) and add 6/7 after it. Knee heights never pass 1.25 H; `uHClip` stays 0 for them.
4. **gl.js `drawLandscape`, `sheetPlan` (base 3993–4110).** xvta adds `end` to `sheetPlan` / `sheetInfo` and the
   `reKnee` / `imKnee` names. No overlap in meaning. Check that `sheetRefine` (new, after base 4052) passes the same
   sheet range as `sheetHeights` once `end` exists.
5. **funcs.js `sheetMapEval` (base 2625–2697).** xvta adds `end`. This piece inserts `localCutHom` before it and
   changes `else if (t > 0) pr = homPair(b, pr, s, t);`. Keep both.
6. **`GLR.sheetInfo` (base 5290).** xvta adds `end`. Next to this piece's `landMesh` / `landRefine` hooks (round 2; not in round 3's snapshot): keep them
   inside their own `TEMP-DEBUG-HOOK` pair.
7. Re-run after the merge: `node test/t_landwalls.js`, `node test/t_sheets_deform.js`, glsl-test,
   `landscape_walls_cmd.js` (port-fixed copy), and check the H edge program compiles (z^2 at t = 0.5, Im).

## Round 2's last pass (kept for history)

- **Fixed: verify-4 (Max refined less than the default mesh).** `rfBuild` now, at rest, spends what the uniform drop
  left of the budget: whole groups of equal wanted levels go back up a level at a time, steepest first, while the
  budget allows. While moving it keeps the uniform drop (the moving perf was measured with it).
  z^{1/5} tan 3z, All sheets, Re (`r2/final/cap.out.json`): default mesh 18.0 M of 18 M evaluations (was 9.4 M),
  Max 17.8 M (was 4.15 M), so Max no longer refines less than the default. The user's case is uncapped as before
  (13.1 M / 17.2 M). Pictures: `r2/final/ztan-allsh-re-m{240,1920}.png`.
- **Tried and reverted: verify-2.** Joining the two compile groups when All sheets is on made the floor and the sheets
  land in one frame, but the stall stayed split (`r2/final/cold-allsheets-join-variant-reverted.out.json`: build
  longest gaps 756, 517, 451, 917, 412 ms against base 542, 565, 431, 0, 166). The cause: the step cards draw a
  principal Landscape (`cardLand` in app.js, `sheets: null`), so `landTF` / `land` are first drawn 0.4 to 0.9 s after
  the sheets, and that first draw pays its own Metal completion. A fix has to warm (draw once) the principal programs
  in the frame the sheets land, or hold the cards' landscape until then. Not done.
- Built twice, same bytes. The published file has no `__cmw`, `_lw`, `landMesh`, `TEMP-DEBUG`, machine paths or
  emails. 35 of 35 node `t_*.js` pass.

## Round 2's open list (superseded by the list below)

- verify-1 (high): scratches and a sawtooth on steep walls while the deformation plays (user's case, t ≈ 0.21–0.26).
- verify-2 (high): first Landscape with All sheets stalls twice, worst about 1.1 s (base: once).
- verify-3 (medium): Max mesh while playing, principal surface: p95 31–44 ms against the base's 17–18.
- verify-5 (low): log log z with All sheets: fin and pin near z = 1 not settled numerically.
- verify-6 (low): e^{1/z} comb; cut cells stay unrefined. Also open: two cuts on one grid edge, DPR 2, Android
  hardware, exports with All sheets.

## Still below article grade (round 3, after this pass)

- verify-3 (high): cold opens. All sheets stalls 3 times where the base stalls once, first picture 140 to 500 ms later;
  the principal surface's first stall is longer and a second one (the edge pass's first draw) follows. Root fix needed:
  the edge pass's and the sheets' refinement evaluations through the surface's own chain program (r3 ledger speed-2).
- verify-4 (medium): fresh formula, All sheets, deformation started soon after the open: 305 to 724 ms freezes in 2 of
  5 verifier runs (the cards' 3 s cap releases first draws into moving frames). Here 2 runs had none over 65 ms: not
  enough to call it fixed.
- verify-5 (medium): Max mesh, first All-sheets run after a load fails BUDGET60 in 2 of 3 (desktop 42 to 52 fps, phone
  47 to 58); one desktop principal play at 53 fps. Steady state meets it.
- verify-1 remainder (medium): a deformation opened within about 1 s of a fresh formula draws the old rule until its
  pass settles, then one first-draw hitch mid-play. Not measured.
- verify-6 remainder (low): round 3's test hooks are gone from src, so `landscape_walls_cmd.js` mesh and motion parts
  cannot run on the snapshot.
- verify-8 (low): 47 MB of textures held after a play at the default mesh (base 8 MB), until the next formula.
- verify-7 (low, pre-existing, UI backlog): z^{1/5} tan 3z, All sheets stays ticked while the deformation shows one sheet.
- Older lows: e^{1/z} comb at the box; cut cells not refined; two cuts on one grid edge; DPR 2, Android hardware,
  exports with All sheets not checked.

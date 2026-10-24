# Formula recognition: as built (work/xvr, 2026-10-24, with the review and verifier fixes)

The design and its reasons are in DESIGN.md; this file records what was built and measured. The user's case is
fixed: typed `z^{i}`, `z^i`, `z^{1+i}`, `z^(0.5+2i)`, `z^{a}` and so on are now the catalog Complex power step on the
formula's cut. The deformation, cut, seam, lamps and GPU program are the catalog step's. At t = 0.5, the deformation
of z^{i} is pixel-identical to the catalog step's (0 of 473,200 plane pixels differ, at 8/255).

The two reviews (review-math.json, review-perf.json: 14 findings) are answered in **ledger.json**: 11 fixed, math-4
accepted as policy (its CPU part fixed), math-7 rejected (Expr's own semantics, no change), frperf-7 needs none. In
short:
- the step's CPU values are the formula's own `Expr.compile`, bit for bit (signed zeros on cuts, raw cut angles,
  overflow); the deformation's inner points replay the formula's pieces;
- a shared number never changes the chain: decisions are taped at generic values and replayed;
- factored products are read in product form (`zp`); expanded `poly`/`rational` readings only where Horner is safe;
- readings are cached; the Inspector note is one short clause.

The verifier's four findings (review-verify.json) are closed in ledger.json (verify-1 to verify-4), all fixed:
- verify-1: the deformation now runs into the formula's own values on every cut the seam reaches (−180, 270, 540, …).
  The log, root and power steps of a chain evaluate on the CPU on the formula's raw θ, sheet 0, exactly as
  Expr.compile does; the GPU plan and the inverse ops keep the normalised (cut, k). Each step with a cut also starts
  from the formula's own value of its input (`step.inp`), so it reads the side of its cut the formula reads, also inside
  a group (`\log(z+1-1)`, `\sin(\sqrt{-z})+\cos(\sqrt{-z})` at 180° were wrong too);
- verify-2: a removable point inside a sub-term (`z/z+z`) is no longer filled in: every zero of an inner divisor must
  be a pole of the reading, or the formula stays;
- verify-3: a Horner reading is used only where it is well conditioned near its roots (κ ≤ 1e4 at 0.01);
- verify-4: the slider sweep counts raw GPU keys and lists the values where the program may change.

## Files (3-way merge against notes/v15-candidate)

| file | change |
|---|---|
| `src/recognize.js` | **new.** The reader: `Recognize.chain(ast, cutDeg, {tape})`. The tape of value decisions (shared numbers), the groups (the formula's own pieces), factored products (`zp`), `degreeHolds`, `hornerSafe` (with the κ bound, verify-3), `runPolesHold`, `polesHold` (verify-2), `step.inp` (each step's input as a subtree of the formula, verify-1). |
| `build.py` | loads `recognize.js` after `inverse.js`. |
| `src/funcs.js` | `build` is split into value parsing and `finish`. **New:** `buildVals` (exported), the custom build takes `{ast, part}` and keeps `b.ast`, and `recChain` / `asChain` handle a recognized formula: the reading cache (`REC_CACHE`), the tape and probes, `finishRec` (the groups compiled on the raw θ), `r.f` kept as the formula's, the short note (`recLabel`). `stepSheets` and `sheetEval` read a recognized step's pieces, and `pairOf` uses `b.ast`. Verifier fixes: `onFormulaCut` (log, root, powa of a chain on the raw θ, sheet 0, on the CPU), `rec.ins` (the formula's value of a cut step's input, compiled in `finishRec`), and `asChain` starts each step from it. |
| `src/inverse.js` | `stepOps('custom')`: the chain's ops when every step has them; otherwise `customOps` of `b.ast` as before. |
| `src/glsl.js` | `recPlan` (the composite plan, `plan.pre` for the steps' functions); `sheetPlan` for a recognized step; `astSig`, the key of an unrecognized formula (its canonical tree instead of the raw text). |
| `src/inspector.js` | the step note adds `b.recNote`. |
| `notes/i18n/ru/v15-recognize.json`, `src/i18n_ru.js` | 8 strings in English and Russian: the note ("Same as {chain}", "Partly the same as {chain}"), four labels without letters, the deformation caption. `src/i18n_ru.js` is the earlier table patched by exactly these keys (+6, −3), not regenerated: the shared notes now hold other branches' table changes (a regeneration gives 3 unresolved call sites that are not ours). It also carries orphan keys of other v15 tables (video preview). Regenerate at merge. |
| `test/t_recognize.js` | **new** test (below). |
| `test/frb_cdp/` | the first run's CDP kit (port 9022), the bench scenes, and `make_rec_glsl.py` (the GPU parity page with and without recognition). |
| `test/frc_cdp/` | the review-fix run's kit (port 9025): `drag_cmd.js`, `drag2_cmd.js` (slider drags, typing, the note), the bench, `make_rec_glsl.py`, `make_rec_glsl_inverse.py` (the inverse walker's parity page with the reader). Chrome profiles deleted. |
| `notes/formula-recognition/tools/review_perf_node.js` | the perf findings in node (readings over a slider, build cost). |

Nothing in test/regress was touched: no baseline, accepted.json or golden image.

## Tests

**`node test/t_recognize.js`: all passed** (after the review and verifier fixes).
- The corpus (187 LaTeX formulas, 43 plain spellings) on the cuts 180°, 90° and −120°: 382,583 value comparisons of
  the recognized chain against the formula's own Expr.compile. They cover random points, pairs 1e-7 either side of
  the axes and the unit circle, points on and either side of every drawn cut, poles, and special points.
- Every LaTeX/plain pair gives the same chain, values and inverse key. The GPU key is the same too, except for
  z^(1/3) against \sqrt[3]{z}: their trees differ, but they get the same chain and one key.
- Traps keep their branches, and refused identities stay refused.
- The z^{complex} cases match the catalog step in values, deformation (t = ¼, ½, ¾), cut and lamps.
- z^{a}: one GPU program and one inverse plan over a ∈ {0.5, 0.7, 0.99, 1, 1.5, 2, 3, −1, −2.5}.
- Recognition does not change the saved params or the TeX.
- The sheet view of a recognized step equals the catalog chain's on every surface tried.
- The review cases (one block per finding, ledger.json):
  - math-1/2: 21 formula and cut pairs (−z into log, √ and powers; cuts −180, 270, 360, 540) at ±0 axis points. The
    step's f and the groups' replay are bit-identical to Expr.compile, and the deformation ends on the formula's side;
  - math-3: merged runs that lose a pole are refused;
  - math-4: the identities' CPU values are the formula's where its spelling overflows;
  - math-6: decimal cancellations are refused;
  - frperf-3: factored products read as `zp`; 7 Horner cases;
  - math-5, frperf-1/2: 12 formulas swept over their slider by 0.01, with one chain and one GPU key each, and the
    special values refused;
  - frperf-4: the cache;
  - frperf-5: the note's text;
  - verify-1: the math-1/2 block now checks the deformation on every cut (no longer only in (−180°, 180°]), with the
    verifier's pairs (`\log(-z)`, `\sqrt{-z}` at 540, `\log(-z^3)` at −180, …) and 7 in-group cases; and every corpus
    spelling on the cuts −180, 270, 540, 360, −540, 900, 190.5, −359.9 (1656 recognized pairs): the step's values and
    the groups' replay bit for bit, the deformation at t = 1 − 1e-12 and at every join (chordal 1e-4). Skipped there:
    a step's own branch point (artanh at 1, where the path converges only logarithmically) and the end of a formula
    part (below). With the fixes disabled the test gives 275 failures;
  - verify-2: 6 sums with an inner cancellation are not read and get no extra lamps; 4 that keep a pole are read as
    before; (z − a)/z + z is refused at a = 0 only;
  - verify-3: the verifier's 3 ill-conditioned Horner readings are refused; float32 Horner of 3 accepted ones is
    within 1e-3 at 0.01 from each root;
  - verify-4: raw GPU keys over the sliders, with the values where the program may change (z² + az at 0,
    (z − a)³(z + 1) at −1).

Verifier sweep (Node, corpus + 52 formulas, 15 cuts including 190, 900, −270, 45.5, −179.9; 2821 recognized pairs, 232
points with ±0 on the axes): the deformation's end at t = 1 − 1e-12 differs from the formula in 187 pairs before, 0
after. The hom costs the same (20,000 points: 0.62–2.30 ms per t, before 0.67–2.40). Corpus counts are unchanged.

Recognized: 210 of 230 spellings, 3 of them partly. By kind (LaTeX, cut 180):

| kind | recognized |
|---|---|
| exact | 110 of 111 |
| identity | 27 of 29 |
| trap | 5 of 5 |
| none | 4 of 18 |

Exact inverse renderer: 191 → 206 spellings.

Not recognized, by design:
- `z`: nothing to gain;
- `√z√z`, `\frac{(z-1)^3}{(z-1)^2(z+2)}`, `\sin(\frac{1}{1/z})`: a removable point;
- `z(z-1)^4-(z-1)^4`, `(0.1+0.2-0.3)z^3+2z`: an expanded or cancelled reading that is not the evaluated function;
- `sin z + z` and the other "none" formulas.

`\log(1+z)-\log(1-z)` → artanh, then ×2. The step's values are now the formula's own everywhere, ±1 included.

**Node tests** (`node test/t_*.js`, after the verifier fixes): 28 of 29 files pass, as before. `t_tour.js` gives 1099 of 1100. The
failing check is "documented anchor lens has a default". It reads `notes/tour/INTEGRATION.md` in the shared notes, which
another branch changed. `src/tour.js` is byte-identical to v15-candidate, so recognition is not involved. In the first
run, with the reader preloaded into the other tests, 11 checks in t_natpaths failed, as expected. Those checks assert
the old paths of typed formulas (gzoom for e^{2z}, ratPath "pow" for z^2). t_natpaths does not load the reader.

**GPU parity** (headless Chrome, ANGLE Metal; `test/frc_cdp/make_rec_glsl.py`, raw/glsl_parity_fix.json). The
GLChain conformance page with the reader loaded:

| page | chains | compared | fails | notes |
|---|---|---|---|---|
| corpus as custom steps, 3 cuts, alone and between exp and add | 626 recognized | 4.45 M | 53 in 4 chains | all `exp > X > add` overflow cases. The same chains also fail without the reader (95 fails in 12 chains). Singular check: 20 flags (12 without the reader). The new ones are `exp > \frac{\sin z}{\cos z} > add`: CPU NaN (the formula's own), GPU the finite tan. That is math-4, accepted |
| the existing suite | 574 (136 recognized) | 3.89 M | 65 | 16 are the existing Blaschke regressions (also without the reader). 49 are in `multi#49`, whose `z^{5000}` (cut 270) is catalog powa(5000). Its all-at-once path at t = 0.01 gives a later rational zoom inputs near 1e13, which overflow float32 (x³). The same composition of catalog steps does the same |
| the inverse walker (`make_rec_glsl_inverse.py`, 80 random catalog chains plus the custom and rational formulas, which take the recognized ops: IPOW>MOB, AFF>JOUK>AFF, …) | 382 cases | 23,522 points; anchors 5,120; clip 61,440 lines | 0 walk, 0 rational (5,184), 0 anchors; 1 clip | The one clip fail is the same without the reader (raw/fix/glsl_inverse_norec.json): a sector with r = 0 whose line meets it near t = 28,107, beyond float32. The clip test draws a catalog `mul` chain, so recognition is not involved |

The suite's `key check failed: custom expr` is expected. It asserts that `z^2` and `z^3` have different programs. Both
are now `pown`, whose n is a uniform, like the catalog step that check already treats as one program.

**Browser, after the fixes** (1440×900, one rect and one grid, one run each; frames p50/p95/max in ms;
raw/fix/browser_drag.json, browser_drag_repeat.json, browser_bench.json). The machine was shared with a running gate
(load 4–6), so p95 is about 1.5 ms higher than in the first run for every scene, catalog ones included.

| scene | slider sweep, as the slider (0.01) | frames | set a (ms) | states seen | review's "after" |
|---|---|---|---|---|---|
| `\frac{(z+a)^{12}}{(z-a)^{12}}`, a = 0.7 ± 0.2 | zp 41 of 41 | 16.7/18.4/18.6; deformation open 16.7/18.7/26.6 | p50 1.8 | 1 | 18.7/38.8, set 5.6, 2 states |
| `z^{2}+az`, a = 0 ± 0.3 | poly 61 of 61 | 16.7/18.4/19.8 and 18.7 (2 passes) | p50 1.4 | 1 | max 83.1 (one 82 ms task), 3 states |
| `\frac{z^2-a}{z+1}`, a = 1 ± 0.3 | Joukowski chain 60 of 61, refused at a = 1 | first pass max 97 (tasks 75, 96: each of the 2 programs compiles once); second pass 16.6/18.3/18.7, deformation 18.4/18.7 | p50 1.3 | 2 | 5 states; v15 alone also had a 52 ms task at a = 1 |
| `\frac{az+1}{z+a}`, a = 0.5 ± 0.3 | mobius 61 of 61 | 16.6/18.4/24.3 (second pass) | p50 1.4 | 1 | 17.6 |

Typing, slowest input handler: `\frac{(z+1)^{20}}{(z-1)^{20}}` 2.5 ms (review: 17.6; v15: 5.8); `z^{i}` p50 1.4 ms.
The note, English: "… Same as Möbius → Logarithm → Scaling." (2 lines in the 262 px column). Russian: «… Совпадает с
цепочкой Дробно-линейная → Логарифм → Растяжение.» (3 lines; it was 4). Screenshots: shots/note_1440_en.png and
note_1440_ru.png.

The 33-scene bench of the first run, again: every scene has the same path and lamps as in the first run, holds 60 fps
(p50 16.5–16.8), and renders in 2.4–7.4 ms (BUDGET60 14 ms; deformation 4.3–12 ms). Single-frame maxima of 25–49 ms
appear in a few pan and drag runs without long tasks, catalog-like scenes included. They are load on the shared machine. One
SphereMesh was built: f_log18, the textbook arsinh, drawn forward as before (119 ms).

**Image-quality suite** (`test/regress/quality/run.sh --no-build --base-url http://localhost:9025`): 81 runs,
**PASS**. 0 failed, 28 improved, 35 unchanged, 18 NEW (no baseline), as in the first run. The perf suite was not run.
No baseline, accepted.json or golden image was touched.

## Open points

- A formula part (a `custom` step of a partial reading) deforms along the formula's zoom path, which meets a point
  exactly on the part's own cut from the side of its centre. There the deformation jumps when the part ends (at
  `\log(z+\sqrt{z^2+1})`, cut 360°, the point 0.5). v15 does the same for every formula it deforms by the zoom path.
  A step after the part starts from the formula's own value. When the part is the last step, the deformation reaches
  the formula's value at t = 1 the way v15 does.

- A recognized step plays its n steps in the time of one app step, on equal sub-intervals, and its caption says so.
  The catalog chain takes n units. Whether to stretch the step to n units is the user's call (frperf-6). "All at
  once" acts across app steps only.
- At a value where the formula changes kind (`\frac{z^2-a}{z+1}` at a = 1), the step switches to the formula's own
  program for that value. Each program compiles once per session (frperf-2 residual).
- The GPU draws an identity's true finite values where the spelled formula overflows (`tan(e^z)`, math-4). The CPU,
  the curves and the probes keep the formula's NaN.
- Expr's negative constants carry −0 (`\sqrt{-1} = −i`, math-7): a separate decision for Expr.
- The textbook arsinh and arctan are read as their outer log and Möbius, not as arsinh and arctan (not proved on the
  cut points). Blaschke, the inverse Joukowski forms and degree-2 maps with two finite poles keep the generic catalog
  readings (`rational`) or none.
- Tour scenes with typed formulas (`(z²−1)/(z²+1)`, `z³−1`, `1/(z²+1)`, `(z²−a²)/(z²+1)`) now deform along the
  catalog steps' paths: power, then Möbius or translate. Their text and checks pass (t_tour), but a tour screenshot
  of a deformation would differ.

# Deforming part of the chain: as built (v16)

Built 2026-10-25 in `work/xv16`, on top of the merged tree (constructions + the Mountain King round 2,
`work/xv16-merged-snap`). Spec: `SPEC.md` (this folder). Screenshots: `shots/`.

## 1. What it does

While the deformation shows the whole chain, a bracket stands over the cards. The steps before it act first and in
full, the steps after it last and in full, and the bracketed steps deform: H_t = Q ∘ G_t ∘ P, from H₀ = Q ∘ P to F.

The user's cases, all working:
- chain f₁ f₂ f₃, f₂'s ⋯ → Deformation → Steps f₂–f₃: the push-forward of f₁(X) (title "w₁ → w", "f₁ →" in the
  transport);
- f₂'s ⋯ → Steps f₁–f₂: the pullback under f₃ (title "f₃(z) → w", "→ f₃");
- "from f(z) to f(√z)": chain [√, sin], f₁'s ⋯ → Only f₁, inside F: Phase at t = 0 is the portrait of sin z and at
  t = 1 the portrait of sin √z, pixel for pixel (both cuts, 180° and −90°).

With no bracket the app behaves as before, except for D3's rounding at the ends (4.2, item 1).

## 2. Files

| file | change |
|---|---|
| `src/homrange.js` (new, UMD, no DOM) | `HomRange.make(env)`: `resolve` (uid resolution, normal form, write-back, memoised), `normal`, `range`, `state`, `cpuMap`, `homF` (exact ends, D3), `H0`, `stops`, `lastDeriv`. |
| `build.py`, `test/make_glsl_test.py` | `homrange.js` after `funcs.js`. |
| `src/gl.js` | `postOf` + `uPost` in MAP_PLAIN and MAP_STAGE (modes 1 and 3, `uT <= 0.0` guard), the uniform upload and name list, `mapKeyOf`, `isIdent`, `mapFor`; test hooks `GLR.evalMap` (transform feedback through `mapPoint`) and `GLR._map`. |
| `src/app.js` | the glue (morphRange / morphState / homF / cpuMap through the module), `homRangeOk`, `rangeKey`, `setHomRange`, `homView` fields, `mapKeyOf`, `morphPrimes`, `cardT`, card thumbnails, `normalizeMap` / `homEnds` / `isIdentMap` with a post, the merged plane's start (tint, outline, ghost through `H0Map`), `defFitView`, the title and `data-mtitle`, path seeds (D6), the bracket layer, the ⋯ submenu, palette commands, transport labels and `aria-description`, the phone row, saving / undo / load / examples, split and remove hooks, sound keys and the merged probe, captions (templates 19–22, 29, paths' H₀(z)), the globe's t = 0 boundary, the guide (G1, G2), tour adapter `setRange`, test hooks. |
| `src/figure.js` | templates 23–28, `$%{z0}$` in the three globe path sentences, the t = 0 boundary through H₀ in the films and the globe paths figure. |
| `src/phone.js`, `src/phone.css`, `src/desk.css` | `fillDisplay` moves `.trange`; the bracket's styles (light and dark through tokens), the hidden "+", `.tfix`, `.trange`, `content: attr(data-mtitle)`. |
| `src/tour.js` | Deformation chapter rev 2, stop `range` (anchor `bracketL`), action `range`. |
| `notes/i18n/ru/v16-deform-range.json` | the spec's table, plus three keys (below). |
| `notes/tour/INTEGRATION.md` | new sections "Anchors / Events added by the deformation range (v16)": `bracketL`, `deformation-range`, the `range` action. |
| tests | `t_deform_range.js` (new), `glsl_test.js` (modes 7, 8), `deform_range_cmd.js`, `deform_range_gl_cmd.js`, `deform_range_fps_cmd.js` (new), `t_tour.js` (44 steps allowed, the new contract sections, action `range`). |

## 3. Where the build differs from the spec, and why

1. **Removing or splitting a bracketed step works by index**, in `removeStep` and `splitStep` (one guarded line each),
   not by uid juggling. Removing the right end b now shrinks the bracket to b − 1; the spec's "keep the index,
   clamped" would have taken in the step after it. Removing the only bracketed step drops the setting. Undo restores it.
2. **Saved uids.** A save leaves out the uids of steps no shape refers to (constructions' `idReplacer`). So
   `writeState` and `figureState` resolve the bracket first, and `sanitizeState` takes the ends by index and gives them
   the loaded steps' uids.
3. **`dr.aria`** uses one placeholder in both plural forms ("Deforming step {list}." / "Deforming steps {list}."): the
   i18n checks require the same placeholders in every form.
4. **Three keys added to the table**: the globe path sentences with `$%{z0}$` (the Russian is the v15 text with the same
   change). The three old keys are now unused and dropped by the table builder.
5. **Russian no-break spaces** before «—» added to the three table strings that lacked them (t_i18n rule).
6. **Phone transport labels.** On a phone the docked row is too narrow for a 120 px scrubber beside a label at any
   portrait width, so `phone.css` hides `.tfix` below 560 px; app.js also measures the input after the dock is built.
7. **Path seeds (D6).** The finer 192 × 192 pass runs when the 96 × 96 grid fills fewer than 12 cells (the spec's
   "half of a 48 × 48 sample" test is not built).
8. **The long caption rule.** A bracket caption longer than 360 characters of homotopy drops the "for f_k, …" list
   (screen and figure). No existing code enforces 700 characters; the bracket captions measured are below it (4.2, item 8).
9. **"Today unchanged" baseline.** Section 1 of the acceptance file compares with the merged tree before the range
   (`v16m.html`, built from `work/xv16-merged-snap`), not with v15.2.1: constructions already changed some path choices
   (V16-MERGE.md 5.2).
10. The spec's GLSL "extra checks" (t = 1 rows = the mode-0 row, t = 0 rows = pre and post) are not separate rows; the
    node test proves them on the CPU twin bit for bit, and the rows compare the GPU with that twin.

## 4. Tests

Final build: `dist/test.html` 1bf12389…, published page 03282e27… (no `__cmw` hooks; rebuilt from the sources, same
bytes). Headless Chrome through my kit `test/dr_cdp` on port 9502, one browser at a time. The full acceptance run, the
gl-level test and the regression suites ran on the build before the last two changes, which touch only the bracket
drag (a snap redraws the planes and the title only; fix-ups wait for the release); after them, acceptance sections 1,
2, 3 and 5, tour_cmd, the frame times and the quality suite ran again. The Mac was loaded the whole time (load average 8 to 13).
Evidence (JSON, logs): `evidence/`.

### 4.1 Node, Russian, GLSL

| test | result |
|---|---|
| `node test/t_deform_range.js` | 1086 checks, 0 failed. 104 cases (6 chains: chain3, sin∘√ cut 180° and −90°, Möbius-log, z²·d/dz·exp, a bypass chain; every bracket, both orders, every focus): **H₀ = post ∘ pre and H_end = F bit for bit in all 104**; the CPU twin bit for bit at 0, 0.37·end, end; continuity at the nodes ≤ 10⁻⁶; today's map and key (+`\|lo\|b\|p1`) unchanged without a bracket and at focus k; normal form, d/dz rule, uid resolution of edits; the worked numbers (sin∘√ zeros, Möbius-log H_½(2+i) = 0, chain3 poles). |
| all `test/t_*.js` (33 files) | all pass (t_tour 1238/1238 with the new limit of 44 steps and contract sections). |
| `make_ru_table.py --strict` | 2262 entries (merge: 2226), **0 unresolved**, 15 collisions, dropped 304 (+3: the old globe path keys), orphans 27, unused 1. t_i18n, t_i18n_keys, t_i18n_parse, t_i18n_english pass. |
| glsl-test | 574 chains, 5.19 M compared (merge 3.89 M), 3326 new range rows (modes 7 and 8), singular 0 bad. 16 fails, all in one random chain (`multi#43 powa>tanh>arcsin>cos`, rangeAll lo 0, b 2, t 0.999): the CPU gives −0.0448i and the GPU +0.0448i, the two sides of arcsin's cut: the value fed to arcsin there is real and above 1, so the side depends on the sign of a zero imaginary part. 18 points skipped where the row's own composition rounded to float32 already misses by the tolerance (next to a Möbius pole). Before the range: 0 fails. |
| glsl-test-adv | 612 chains, 8.67 M compared, 304 fails in the same 10 known chains as the merge. |
| glsl_inverse | pass: walk 882 cases 0 fails, anchors 0 fails. |
| `deform_range_gl_cmd.js` (13.3) | pass: GLR.evalMap = cpuMap at 64 probes, chain3 / sin∘√ / Möbius-log, every bracket, both orders, t ∈ {0, end/2, end} (72 rows, worst 1.4·10⁻⁶ relative); mapKeyOf differs by post; isIdent false with a live post and f₁ off; mapFor falls back to mode 0 for modes 1 and 3. |

### 4.2 Acceptance: `deform_range_cmd.js` (13.4)

Sections 2 to 9 pass; section 1 has one failure (item 1).

1. **Today unchanged** (8 path scenes, against the merged tree before the range): maps, keys (+ suffix) and titles at
   t ∈ {0, end/2, end} and at focus 1 and 2 are equal; no bracket at focus k, with the transport closed, or with one
   active step; the chain3 figure caption is byte-equal. Frames at end/2: 0 px over 8/255 in 7 scenes; **chain3
   (three steps all at once) differs in 1552 px**: one path is chosen differently. Cause: D3. With no bracket the
   homotopies are now exactly the identity at t = 0 and f at t = 1, where `hom(0)` and `hom(1)` differed from them by
   rounding (z² at t = 0 by 7·10⁻¹⁶); the spec accepts this ("today's pictures change only by rounding"). The
   single-step scenes are unaffected.
2. **Push-forward** (chain3, f₂'s ⋯ → Steps f₂–f₃): the menu (4 items, key slot "from w₁"), {2, 3} stored, mode 1 hi 2
   without post, title "w₁ → w", H₀ = e^z exactly, 6 path rings at H₀(z) and dots at F(z), "f₁ →" only, H_end = F
   bit for bit, GPU = CPU, All at once is mode 3 a 1 b 3.
3. **Pullback** (f₂'s ⋯ → Steps f₁–f₂): the menu opens the transport, post 3 / b 2, title "f₃(z) → w", "→ f₃" only,
   H₀ = z² exactly, GPU = CPU at t = 0 … 2, Phase's map at t = ½ GPU = CPU.
4. **z → sin √z** (rect 0 ≤ Re ≤ 40): Phase at t = 0 equals the portrait of [sin] and at t = 1 the portrait of
   [√, sin], **0 px over 8/255, cut 180° and −90°**; title "f₂(z) → w"; the zero π^{1/s} at z = 5 when
   t = 2(1 − ln π / ln 5) = 0.5775: |H| = 3·10⁻¹⁶ (at the spec's 0.578, 1.3·10⁻³). (With the cut at −90° the root
   branch sends 5 to −√5, so there is no zero there.)
5. **Interface, desktop** (EN / RU, light / dark): the bracket over every step, "+" hidden at its two connectors only;
   the left-end drag snaps to connector 2 with t = 0 of the candidate, Esc restores, release commits, a reload keeps
   it; Tab reaches the left end, → moves it, aria-valuetext "f₃", Home; dedupe on f₁ and f₃; the four palette commands
   by "pullback" and "bracket" (RU: "прообраз" and the English alias); the d/dz stop with string 13 on the end and the
   menu item; the Russian submenu.
6. **Phone** (390 × 844 and 360 × 800, Android Chrome UA, touch, EN / RU, light / dark): the bracket has
   pointer-events none; the title chip reads `data-mtitle` ("w₁ → w"); the transport labels are left out (the range
   input is 72 to 84 px); nothing new covers the planes; the Display sheet's row has two 44 px selects that set the
   bracket, the Russian label wraps above them at 360 px, no overflow; the Editor sheet's ⋯ → Deformation ▸ opens inside
   the viewport, no key slot.
7. **Saving, undo, edits**: removing the right end shrinks {2, 3} to {2, 2}, Undo gives {2, 3} back; Duplicate inside
   joins; Move left keeps the bracket on its steps; bypass to normal form drops it; a state without ua / ub loads by
   index; the save holds {a, b}; Split into steps at ub keeps every new step bracketed.
8. **Export** (sin∘√ 1…1 and chain3 2…3, EN and RU, B/W and colour): the morph caption has templates 19 and 20 and
   the paths "from H₀(z) = …" (603 / 748 characters; within 700 with math counted as one); the article figures carry
   templates 23–26 (337 to 394 characters).
9. **Sound**: Hear the function plays the bracket's H_t bit for bit (`__cmwSound({hAt})` = `__cmwEval('H')`); the
   merged probe is silent with a post and follows the pointer with a pre only.

### 4.3 Other suites (re-run)

| test | result |
|---|---|
| deform_nat_cmd | pass; the same paths as the merge in all 5 scenes; 60 fps, p95 18.0 to 18.3 ms. |
| morphfig_cmd | pass. |
| export_cmd | pass: 307 files, 80 figures, no console errors. preflight: 966 of 970 ok; the 4 flagged are the preview's frame grabs `pv-*-frame.png` (RGBA, no dpi), not exports. |
| tour_cmd | 96/96, with the new stop checked (Paths "3 of 5", the bracket's left end lit, "Next: Analysis") and the chapter done at its rev 2. |
| i18n_cmd | 92/92. |
| v15_desktop_cmd, v15_phone_cmd | pass (including the frame checks). |
| constr_cmd | 115/115. |
| quality suite (`run.sh --no-build --base-url http://localhost:9502`) | **PASS**: 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW; targets 259 met (the merge's numbers). Baselines, golden images and accepted.json untouched. |

### 4.4 Frame times (`deform_range_fps_cmd.js`, BUDGET60)

A 12-step chain (pre 5 heavy erf/tan/log steps, bracket f₆–f₇, post 5), Paths on, played one after another and all at
once in X → Y, Phase and Landscape, at 1440 × 900 and 390 × 844 (Android UA), alternating with the merged tree's
whole-chain deformation on the same chain. Last run (load 2 to 7): every run 60 fps; p95 this build 17.7 to 18.6 ms,
the merged tree 18.1 to 18.8 ms. Three of this build's 24 runs are over 18.4 by 0.1 to 0.2 ms, and so are runs of the
merged tree: under this load the bracket costs nothing measurable. The bracket drag (3 s of snaps back and forth over a
connector): 60 fps, p95 18.8 ms, max 24.3 (the first version: 20.3 / 27.2). A snap now redraws only the planes and the
title; the cards, the transport, the fit and the fix-ups follow at the release. The gate's 18.4 ms is missed by the
drag by 0.4 ms on this machine; measure it again on a quiet machine and on the Android phone.


## 5. Open items

- The spec's own list (SPEC.md 14): zero and pole tracks, seams of the pre / post cuts, a grey tint of H₀(X), a d/dz
  after the bracket, the z-plane cut handle, cuts in figures.
- Not tested: the video's first frame (rings at H₀(z)); the Android phone itself (emulation only); the click and
  recording checks of sound; the link round trip through `#cmw=` (the saved state's {a, b} is checked).
- The bracket drag's p95 (18.8 ms) is over the 18.4 ms gate on the loaded Mac.
- Section 1's chain3 frame (1552 px, D3 rounding) needs a decision: accept, or compare without the paths.
- `glsl-test`: the range rows show 16 mismatches in one random chain (see 4.1), all at points where the value lies on
  arcsin's cut.
- The menu's key slot ("from f₃(w₁)") uses the menu's monospace key font.

## 6. Running the tests

- Node: `node test/t_deform_range.js` (and every `test/t_*.js`).
- Chrome: copy `test/cdp_kit` to your folder, start its daemon, serve `dist/` on its port. Section 1 needs the merged
  tree's page beside the build: build `work/xv16-merged-snap` and copy its `dist/test.html` to `dist/v16m.html`
  (remove it afterwards). The files are long: use a runner that waits more than q.sh's 5 minutes.
- My kit (`test/dr_cdp`) starts Chrome with `--disable-renderer-backgrounding --disable-background-timer-throttling
  --disable-backgrounding-occluded-windows`. Without them, under this load, requestAnimationFrame stopped firing in the
  headless page in some runs, and one run of deform_nat_cmd sat idle for 16 minutes; with them it took 97 s.
- `deform_range_cmd.js` takes `globalThis.DR_RUN = [2, 3];` before it for a subset (read once).
- glsl-test: `python3 test/make_glsl_test.py`, open `dist/glsl-test.html`; `__glslTest.rangeRows` and
  `.skippedRangeF32` report the new rows.

Cleanup done: daemon and server stopped, Chrome profiles deleted, no cmw-* temp folders, the generated test pages
removed from `dist/` (it holds the two built pages).

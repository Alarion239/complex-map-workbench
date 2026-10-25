# A formula in steps, and one simple function in the search (v15.2): as built

Built 2026-10-24 in `work/xv152` (v15.1 with the paths redesign and the recognizer merged), from
`notes/formula-steps/DESIGN.md`. The state before this work is `work/xv152-merged-snap`, for diffs.

## 1. What the user gets

**The search (second request).** In the command palette and in the add-step menus:
- A query that reads as exactly one catalog step is that step. Examples: `sin z`, `\sin z`, `sin(z)`, `tg z`, `e^z`,
  `exp z`, `log z`, `sqrt z`, `\sqrt[3]{z}`, `z^3`, `z^{i}`, `1/z`, `2z+1`, `(z-1)/(z+1)`, `conj z`.
  - It is listed first, under its own group, with its parameters written from the query (`\frac{2z+1}{z-1}` is Möbius
    2, 1, 1, −1; `z/2` is Multiply by `\frac{1}{2}`).
  - Enter or a click adds the catalog step. No formula step is made.
  - Custom formula is the second row. The plain catalog row of the same type is not listed again.
- A query of two or more steps (`\sin(z^2+1)`, `z+1/z`) keeps Custom formula first. The second row is
  **Add as n steps**, with the step names as its description. While that row is selected, the preview caption shows
  the derivation on one line.
- `z^2+\sin z` and other formulas that are not a chain get Custom formula only, as before.

**The Inspector (first request).** When a formula step is selected:
- A fold under its fields reads "Built from 3 steps". It shows the typeset derivation, one row per step, each named
  at the right: z ↦ z² ↦ z²+1 ↦ sin(z²+1). Below it is one button, **Split into 3 steps**.
  - When the result is spelled differently from what was typed, the last row says so, e.g. `2\cos z = e^{iz}+e^{-iz}`.
  - Folded, the summary lists the names. The fold state is remembered for the viewer (`localStorage`, in try/catch).
  - While the offer shows, the note line drops its "Same as …" clause, because the offer says the same thing.
- A formula that is one catalog step says "This is the Sine step." with **Replace with the Sine step**.
- The offer is hidden from the first keystroke in the formula field until the text is committed: Enter, a change
  event, or leaving the field. Nothing pops up or covers the planes.
- The ⋯ menu has **Split into steps**, or **Replace with the {name} step**. When it does not apply, the item is disabled
  and its tooltip gives the reason (R1–R5).

**The split.**
- It is one commit and gives the same function, so the planes do not change.
- The new cards unfold (200 ms, none with reduced motion) and the first new step is selected.
- One sound cue plays and an Undo toast names the steps, e.g. "Split f₁ into f₁–f₃: Integer power → Translation →
  Sine."
- Undo (the toast's button, ⌘Z / Ctrl+Z, the phone's Undo key) brings the formula back.
- With the deformation open on the whole chain, its time is mapped: the formula's unit [j, j+1) becomes [j, j+n), so
  the frame stays the same.

**Smaller pieces.**
- The "f₃ alone" chip in X's head has ‹ and › to show the previous or next step alone. They are disabled at the
  ends and are not shown on a phone.
- One new tour stop, "A formula in steps", in Editing the chain (rev 2 → 3), with Try "Press Split into 3 steps".
  The keys stop gains the one-step sentence.
- One guide paragraph, in Function chain.

## 2. The second request inside an existing formula step: never automatic

When a formula step's text reads as one catalog step, the step is **not** replaced by itself. It shows "This is the
Sine step." with a Replace button once the text is committed. The reasons (DESIGN.md 5):
- Replacing it would change the card under the user's fingers. Sine has no field and Möbius has four, so the field
  being typed in would vanish.
- Prefixes read as one step on the way to something else (`sin z` → `sin z+z^2`).
- Nothing is gained by forcing it. A recognized one-step formula already renders, deforms, cuts and lights its lamps
  as the catalog step (v15.1).
- The typed text is the user's record, and the catalog step is one click (and one Undo) away.

In the search the rule does fire, because the query is a request and no card exists yet.

## 3. How it works

- `Funcs.splitSteps(st, b)` (src/funcs.js) is the one function the search, the Inspector, the ⋯ menu and the click
  all call. It returns `{kind: one | many | none, steps, names, rows, eq, reason, blocked}`.
  - It reads the recognizer's chain R as it is. `finishRec` now keeps each group's piece `src`; nothing else on the
    recognition path changed.
  - Rule 1: parameters are written from the formula's own spelling. Shared numbers keep their names: `(z-a)^3` gives
    c = `-a`, and `\frac{az+1}{z+a}` gives Möbius `a, 1, 1, a`.
  - Rule 2: otherwise, short exact numbers (at most 6 significant digits, or p/q with q ≤ 64). Rule 3: otherwise the
    group stays a formula part.
  - A gate builds every written step from its text and compares it with the formula's piece at the probes (1e-12),
    at two generic values of the shared numbers. Names and decimals are checked too.
  - Results are cached (LRU 96). A formula with shared numbers is decided at generic values. At values where it
    changes kind (`\frac{az+1}{z+a}` at a = 1), the offer stays and its button is disabled (R5).
- `splitStep(k)` and `addSteps(list, at)` (src/app.js) each make one commit. The Inspector's `A` gets `splitStep`,
  `splitInfo` and `splitHidden`.
- The tour calls the app's `splitOffer(on)` for every stop. The offer is hidden during the tour except at a stop
  with `split: true`.

## 4. Files

| file | change |
|---|---|
| src/funcs.js | `finishRec` keeps `src`. New: `splitSteps`, `splitReason`, `splitLabel`, `splitStepTex`, `splitMorphT`, `shortCx`, plus the text helpers and the gate. Möbius TeX drops a zero `a` term (`\frac{1}{e^{-z}+1}`) |
| src/app.js | `paletteItems` (the one-step row, the dedupe, Add as n steps, the caption), `addSteps`, `bornCards`, `splitStep`, the ⋯ item, menu items with a `tip`, the alone chip's ‹ ›, the guide paragraph, `tourSplit` and the tour API's `splitOffer` |
| src/inspector.js | the offer (`fillSplit`, the fold state, hidden while typing), and the note line dropping `recNote` while the offer shows |
| src/tour.js | the scene `splitFormula`, the stop `edit/split`, the anchor `splitOffer`, the keys sentence, `edit` rev 3, and `show` calling `splitOffer` |
| src/desk.css, src/phone.css | `.split-offer`, `.card.born`, the chip's ‹ › (hidden on the phone), the 44 px button and names under formulas on the phone |
| notes/i18n/ru/v152-steps.json, src/i18n_ru.js | 24 strings, regenerated with `--strict` |
| tools/make_ru_table.py | also reads `notes/i18n/ru/v152-*.json`, except `v152-sound.json` (that piece is not merged in this tree) |
| notes/tour/INTEGRATION.md | the anchor `splitOffer`, the event `formula-split` and the scene, in the v15 tables (t_tour reads the contract) |
| test/t_formula_split.js, test/split_cmd.js | new |
| test/tour_cmd.js | the Zeros-and-poles stop is now `edit` step 3 (the new stop comes before it) |

Not touched: recognize.js, glsl.js, inverse.js, figure.js, sound.js, the perf baselines, accepted.json and the
golden images.

## 5. Departures from DESIGN.md, with reasons

1. **"Split into simple moves" (§8) is not built.** §15 puts it last and lets it be cut without touching the rest,
   and the time box ran out. The guide paragraph leaves out its sentence. Nothing else depends on it.
2. **The rows print each field as written** (`\frac{1}{2}`, `\frac{\pi}{3}`, `a`, `0.1234567`), not the catalog's
   4-digit values (`0.5`, `1.0472`). So the test does not compare the last row with the composed catalog TeX.
   Instead it reads the last row back and checks that it equals F.
3. **One container step with a shared number gives R2** ("Its numbers depend on a"): `z^2+az`, `(z-a)^2(z+1)`. §3
   and §9 say R2 for these; §2.1 says R1 for any container. Without a name it is R1 (`z^3+2z`).
4. **The strings file is `v152-steps.json`**, as the task names it, not `v152-split.json`.
5. **The ‹ › are not shown on a phone.** The chip has one 32 px button with a 44 px hit area, and three such targets
   do not fit X's head at 360 px. A card tap plus L still shows a step alone.
6. **Typing into the palette: the 4 ms target holds for the acceptance query but not for a heavier set, and v15.1
   misses it there too.**
   - In split_cmd, typing `\sin(z^2+1)+\frac{2z+1}{z-1}` key by key: the slowest input handler is 2.3–3.1 ms.
   - For four longer queries (s4 in this session), the slowest handler is 8.4–9.3 ms in this build and 7.9–9.1 ms in
     v15.1-merged, measured the same way on the same machine. p50 is 1.0 ms in both.
   - Nearly all of that time is the existing list rebuild. The split itself costs p95 0.16 ms uncached in node.
7. **The accepted differences on cuts (§9) are counted, not sorted into the three classes.** The test checks that
   each one lies on a cut of a step: a step's input is on its cut ray or segment, or is non-finite. There are none
   that are not.
8. **The tour's Try is tested on the desktop only**, not on the phone.
9. **On a phone the Undo toast cuts a long chain short** ("Split f₂ into f₂–f₄: Integer power → Translati…"). This is
   the existing one-line toast; the full text is in its accessible name. Not changed here.

## 6. Tests

All runs used the final build (`dist/`, sha256 below). Headless Chrome ran through my kit `test/fs_cdp` on port 9114,
one browser at a time. Results are in `notes/formula-steps/res/`.

| test | result |
|---|---|
| `node test/t_formula_split.js` (new) | **31229/31229.** 249 inputs at cut 180 (102 one, 112 many, 35 none), each on the cuts 180, 90, −120, −180, 270, 540. Values: 634,500 comparisons with F at random points, all equal. Axis and cut points: 36,726, of which 378 differ, and every one lies on a cut of a step (0 unexplained). Deformation: 850,000 comparisons, 838,212 bitwise, max relative 7.2e-15. One-step corpus: 92/92 spellings. Cost: p95 0.155 ms uncached, 1.9 µs cached, 12 nested sines 0.05 ms |
| all `node test/t_*.js` (30 files) | all exit 0. t_recognize: all passed. t_tour 1133/1133 (the contract has the new anchor and event). t_i18n 18594, t_i18n_keys 4838, t_inverse 554/0. t_funcs and t_parse print the same as v15.1-merged |
| `make_ru_table.py --strict` | 2366 entries (+24), 0 unresolved; dropped and orphans as before (1, 195) |
| split_cmd.js (new) | **93/93.** Planes before and after a split, X → Y, Phase and Landscape: 0 px over 8/255. Deformation at T = 1.5: T becomes 2.5 and the frame is 0 px. A shared-number sweep: 60 fps, p95 17.5 ms, one GPU program. 12 nested sines with the deformation playing: 60 fps, p95 17.7 ms. No long task in 2 s after a split. Russian summary on one line (30 px) and button on one line. Tablet 1024 and 768 and phone 390 and 360 (Android UA) pass, in English, Russian and dark |
| tour_cmd.js | 95/95. Its Zeros-and-poles stop moved from index 2 to 3, and the test was updated for that |
| v15_desktop_cmd.js, v15_phone_cmd.js, deform_nat_cmd.js | pass, 0 fails |
| i18n_cmd.js | 92/92 |
| glsl-test / glsl-test-adv (regenerated) | 574 chains, 3.89 M compared, 0 fails / 612 chains, 8.67 M compared, 304 fails in 10 chains, the same chains as v15.1 |
| quality suite (`run.sh --no-build --base-url http://localhost:9114`) | **PASS**: 81 runs, 0 failed, 28 improved, 35 unchanged, 18 NEW; targets 259 met. The same as the merge |
| export_cmd.js (all sections) | 307 files, 80 figures, no console errors. 1 timing fail: one 50 ms task while the globe video was made, at load average 7 |

About the export timing:
- Another agent's headless Chrome (work/xvc) ran at the same time, with load averages of 6 to 10.
- An earlier full run, at load 6, had 6 timing fails, all in the video and preview sections.
- I re-ran the preview section alone on this build and on v15.1-merged under the same load. Each gave the same 5
  fails (`res/export_pv.json`, `res/export_pv_base151.json`), so these fails come from the load, not from this work.
- Nothing in this work touches figure.js or the video path.
- Split figures: the split `\sin(z^2+1)` exports in English and Russian with captions under 700 characters (in
  split_cmd).

sha256:
```
5b173e13aa569ebce0d8fa623ea1ad06bb18dc7b61c5055a67c4427b73430f18  dist/complex-map-workbench.html
ebb90df42e9fe11d158df29d8b4f25e682e6d861339d121ddcae8a448d1e3ceb  dist/test.html
```
The published file has no `__cmw` hooks and no machine paths.

## 6b. Review fixes (2026-10-24, `notes/workflows/ledger-v152.json`; test `test/fix152_cmd.js`, 24/24)

- **The planes after a split (steps-1).** A formula shown alone (the palette's flow) that is the only step: the split
  shows F, so the planes stay the same. With other steps, the first new step is shown alone and the toast says so
  ("Showing f₂ alone; › shows the next step."). Add as n steps into an empty chain shows F.
- **The derivation (steps-2, -3, -8, -9).** The search caption fits (down to 70 %) and then wraps after a ↦, never cut.
  In the Inspector, ↦, the formula and the name are three grid columns. When a cumulative row would need less than 70 %,
  the block shows one step a row instead (u₁ = w₁², u₂ = u₁ + 1, …, w₂ = sin u₁₃). Rows use the step's input variable.
  A last row that only reorders sums or products is the typed spelling, with no "=".
- **Why a chain stays one step (steps-4):** "Same as …; it stays one step: its numbers have no short exact form."
- **A fraction's moves (steps-5):** the one-step Möbius block shows z ↦ z − 1 ↦ 1/(z − 1) ↦ 3/(z − 1) ↦ 3/(z − 1) + 2,
  read only (§8's button is still not built).
- **Typing (steps-6, -14):** the math inputs have autocapitalize and autocorrect off; the search reads Sin z, Exp z,
  Tg z (a capitalized first word), a capital Z, and z², z⁻¹ (`Expr.typed`).
- **Names (steps-7, -10):** a multiplier is Rotation (|c| = 1), Scaling (c > 0) or Rotation and scaling; the one-step
  texts quote the label ("This is the step “Translate by c”.").
- **Focus (steps-11):** after Split, the first new card has the keyboard focus.
- **Phone (steps-12):** Add as n steps shows the derivation in its row; the Editor brings the offer's summary into view.
- **The fold key (regress-2)** is the app's `lsk('cmw-split-fold')`.
- **Not changed (steps-13):** while the deformation plays, new cards stay blank until it pauses, as every card does
  (cards are held during playback for 60 fps, review verify-1 / design-13).

## 6c. Patch v15.2.1 (2026-10-25, `notes/v15.2-patch1-ledger.json`)

- **The search caption (verify-3).** The derivation wraps first, after a ↦ (a row and its ↦ break together). Each row
  is set in display style at 13 px, so a fraction's parts are full size. Only a row wider than the box makes the line
  smaller, down to 85 %. A row wider still scrolls. The smallest glyph of 1/(1+e^{−sin(2z+1)}) is 10.8 px (was 4.6 px).
- **The search rows (verify-4).** A row's formula fits its column (120 px; 84 px on a phone): smaller down to 85 %,
  then without its "f(z) =", down to 75 %, then a fade at its end. Never a hard cut. The Add as n steps row shows the
  start of its own derivation, such as z ↦ z² ↦ ⋯, not the formula again. On the phone its row also shows the whole
  derivation, now wrapped at full size (it shrank to 60 % before).

## 7. Screenshots (notes/formula-steps/shots/)

- `split-search-sinz.png`: `sin z` lists Sine first and Custom formula second.
- `split-search-asSteps.png`: `\sin(z^2+1)`, with Add as 3 steps selected and the derivation in the caption.
- `split-offer-en-light.png`, `split-offer-en-light-full.png`, `split-offer-en-dark.png`, `split-offer-ru-light.png`: the
  offer.
- `split-one-en.png`: "This is the Sine step."
- `split-result-en-light.png`, `split-result-ru-light.png`: after the split, with the toast.
- `split-morph.png`: the split during the deformation.
- `split-alone-chip.png`: ‹ f₂ alone › ×.
- `split-tablet-1024.png`, `split-tablet-768.png`: tablet.
- `split-phone-390-en.png`, `-360-en`, `-390-ru`, `-390-en-dark`: the phone's Editor sheet, and `*-after.png` after
  the split.
- `split-tour.png`: the tour stop.

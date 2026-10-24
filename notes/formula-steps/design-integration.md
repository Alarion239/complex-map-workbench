# Formula → steps: integration and risk (designer 3 of 3, 2026-10-24)

The angle here is the data model, what must not change, cost, and tests. The work copy is work/xvr-final-snap (v15.1).
I measured everything below in node with the real sources (`scratch-integration/`). Nothing in the app was edited.

## 0. Decisions in brief

1. **"Split into steps" is one user action. Nothing splits on its own.** It replaces the formula step f_k with n
   ordinary catalog steps. There is no new step type, no new field and no group marker, so saved state, undo and v15.1
   links keep their format. One commit, one Undo.
2. **The split follows the reader's chain exactly.** The steps are the ones the Inspector note already names ("Same as
   Möbius → Logarithm"), so the offer, the note and the result always agree. All three are built by one function,
   `Funcs.splitSteps`.
3. **Parameters are written as text. A shared number keeps its name.** This is the main risk. Written from the
   reader's values, `(z−a)³` becomes "Translate by −0.7", and the slider *a* stops moving the chain without any
   warning. §2 has three rules for writing parameters, and each written step is checked before it is used.
4. **Refuse a piece rather than lose exactness or a link.** A piece whose parameters cannot be written exactly stays a
   formula step of its own input. That step is still recognized. If that piece is the whole formula, no split is
   offered.
5. **Search, "one simple function":** a query whose reading is exactly one catalog step, with parameters written by
   the rules of §2, is listed first as that catalog step. Enter adds it. "Custom formula" is the second item.
6. **Typing into an existing formula step never converts it.** The note line shows "Same as Sine · Use the Sine step"
   (the n = 1 case of the split). Reasons are in §6.
7. **The picture does not change at the moment of a split.** At focus 0 the main planes should be pixel-identical,
   because each piece uses the same GPU sub-plan as the recognized step. The deformation keeps its frame through a
   mapping of T. What changes is listed in §4.

## 1. The data model of a split

A step is `{type, params (text), on}`. Snapshots hold `S.steps`, shapes, targets and params. Morph ranges are
derived, never stored. Splitting f_k into n steps:

| state | change |
|---|---|
| `S.steps` | `splice(k−1, 1, …n steps)`. Each new step is `{type, params: text, on: old.on}`. Defaults fill missing keys, as in `addStep` |
| `S.focus` | `= k` if it was k, so the first piece is shown alone and Next step walks through the pieces. It becomes `+ n − 1` if it was > k, and stays the same if it was 0 or < k |
| `S.sel` | `= k` (the first piece opens in the Inspector); `+ n − 1` if it was > k |
| `morph.T` (deformation open, focus 0) | the formula's unit [j, j+1) maps to [j, j+n): `T' = j + (T−j)·n`. Later steps move by `n − 1`. The frame at T' is the frame at T (§4) |
| history | one `commit()`; the toast "Split f₂ into 3 steps." offers Undo; restoring gives the old JSON exactly |
| shapes, targets | unchanged: they live in z and in the image plane of the whole chain, not per step |
| shared numbers | unchanged. They are now used by the new step fields (`stepUses` finds them), so none becomes orphaned |
| saved state, links, scene files | the same format. A v15.1 build opens a split chain: every type exists in v15.1, and the texts (`-a`, `\frac{1}{a}`) are ordinary field texts |

Once the split is done, the formula text is gone, except through Undo. I would not add a "Join back": the composed
TeX is not the user's spelling, and the pieces may by then have different cuts. Undo is the exact way back.

Nothing splits on load, on link open or in the tour scenes. A recognized formula step stays exactly as in v15.1.

## 2. Writing the parameters (the crux)

`Recognize.chain` gives `steps: [{type, vals}]` with evaluated numbers, plus groups `{from, to, src}`, where src is
the piece of the formula as written, as a function of its own input. `finishRec` currently drops `src`. It should
keep it. For each group, in order:

1. **A one-step group is read from its own spelling.**
   - Affine-type steps (mul, add, affine): from a small symbolic affine reader over src. It handles z, constants, −, +,
     −, a constant times or over a piece, and never folds a shared number. Note that `Expr.simplify` does fold *a*
     into 0.7, so it cannot be used here.
   - Möbius: from P/Q, where P and Q are affine. `\frac{2z+1}{z-1}` becomes a=2, b=1, c=1, d=−1, the values as
     typed. The reader's normalised matrix is 1, 0.5, 0.5, −0.5.
   - Complex power: the exponent as typed (`a`, `1+i`). `\sqrt[a]{z}` gives `\frac{1}{a}`.
   - Steps with no parameters, and pown and root n (integers), need nothing more.
2. **Otherwise, exact numbers when no shared number is involved.** Use the shortest round-trip decimal (`zpItem`
   style), which `constValue` reads back as the same double. Use the cut as the formula has it, with k = 0. This
   covers merged runs and identity groups (`e^{iz}+e^{-iz}` → cos, ×2), Joukowski-family readings, and poly, rational
   and zp from the normal form.
3. **Otherwise, the group stays a formula step,** with `Expr.toTex(src)`, the formula's cut and z as its input. That
   step is recognized again with the same steps and keeps the link.

**The guard for every group:** build the written steps with `Funcs.build` from their text (exactly what the app will
do). They must equal the piece at the 7 `REC_PROBES` within 1e‑12, at the current values and, when there are shared
numbers, at two other sets. A tree carries a shared number's value from parse time, so the piece is parsed again at
each value. If any check fails, use rule 3.

**When names are not defined yet.** In search, `z^a` before *a* exists gives the error "a is not defined yet". The
structure must then come from the reading at generic values (`Recognize.generic`, the tape), not from the value 0.
The catalog item's Enter then follows the same "add the number a" path as the formula item (app.js 8075 / 13509).

### Results on the requested formulas (cut 180°, a = 0.7)

| formula | split (text params) | note |
|---|---|---|
| `\sin(z^2+1)` | Integer power n=2 → Translate c=1 → Sine | 3 groups, all rule 1 |
| `\frac{2z+1}{z-1}` | **one step**: Möbius a=2, b=1, c=1, d=−1 | search: Möbius first; in a formula step: "Use the Möbius step" |
| `e^{iz}+e^{-iz}` | Cosine → Multiply c=2 | one identity group (rule 2). F is then written 2 cos z (§4) |
| `z^{i}` | **one step**: Complex power α=i, cut 180, k 0 | |
| `(z-a)^3`, shared a | Translate c=**−a** → Integer power 3 | link kept: equals the formula at a = 0.7, 0.31, 1.83, −0.4. Values only would give c = −0.7 |
| `\sqrt{1-z^2}` | Integer power 2 → Affine a=−1, b=1 → Square root (cut 180) | |
| `\log\frac{1+z}{1-z}` | Möbius 1, 1, −1, 1 → Logarithm (cut 180) | not artanh: the reader reads artanh only from log(1+u) − log(1−u) |
| `z^2+\sin z` | not recognized: **no offer** | search: Custom formula only, as now |
| `\frac{1}{z}+z` | Joukowski → Multiply c=2 | two steps (z + 1/z = 2·J(z)), so search adds the formula step, with the offer. `\frac12(z+\frac1z)` is exactly Joukowski, one step |

More: `az+1` → Affine a=**a**, b=1; `\frac{az+1}{z+a}` → Möbius a, 1, 1, a; `\frac{1}{z-a}` → Möbius 0, 1, 1, −a;
`e^{az}` → Multiply c=**a** → Exponential; `\log(z^z)` (partial) → Custom formula `z^{z}` → Logarithm. Refused for
now, because the parameters depend on *a* through the normal form: `z^2+az` (one Polynomial step; the formula
stays), `(z-a)^2(z+1)` (zp), `\frac{z^2-a}{z+1}` (s = √… inside the Joukowski reading). A symbolic coefficient or
factor reader could add the first two later.

### Measured over the corpus (`scratch-integration/corpus_split.js`)

The run covers 206 spellings (163 corpus formulas + 43 plain) × 4 cuts (180, 90, −120, 540) = 824 cases.
- 745 cases were recognized: 384 split into one step, 317 into two and 40 into three; 4 are partial.
- 4 were refused for a link: `z^{2}+az` at every cut.
- Values from the **text** steps against the formula, off the cuts (300 points, 1e‑9): **0 failures**, including
  40 shared-number cases at 4 values of a.
- On the axes, with ±0 points: 0 failures for cuts in (−180°, 180°]. There are 55 failures, all at cut 540 (`\log z`,
  `\sqrt z`, …). They lie exactly on the drawn seam: `finish` normalises 540 to (180, k = 1), which is the same
  function off the ray. The recognized step evaluated on the raw θ there (verify-1), and the catalog steps cannot.
  This is accepted: it is the catalog's own convention.
- Lamps: composeProps of the pieces lost **0** lamps of the recognized step (and gained 0).
- Inverse renderer ops (`Inverse.stepOps`): identical in all 745 cases.
- Cost: ≈0.13 ms per split (node), on top of the recognition the search already runs on every keystroke.

## 3. What must not change

- **A single formula's recognition stays as it is:** values, cut, lamps, GPU key and the note. `splitSteps` is a pure
  reader of `b.rec` and the groups. The only code change in the recognition path is keeping `src` in `finishRec`.
- **Links from v15.1 open the same:** no automatic split and no format change.
- The perf baselines, accepted.json and the golden images.
- The tour's typed scenes (`(z²−1)/(z²+1)`, `z³−1`, `z³−3z` with d/dz, …) stay formula steps. **No offer while the
  tour holds the app (`tourHold`)**, because a split renumbers cards and the tour's targets are card indices.

## 4. What the split changes, and how to handle it

| area | effect | handling |
|---|---|---|
| GPU, BUDGET60 | The main program is the composition of the same sub-plans `recPlan` used, but under a new key, so it compiles once, like adding a step. The per-pixel work is the same | Test: no frame-time regression; one compile long task (AS-BUILT saw 75–96 ms) |
| Card pictures | n − 1 more cards. Each is a prefix program, drawn exactly when idle; a card never waits for a compile | Measure the long tasks after a split on desktop and on the phone (Android Chrome compiles slower). No change to the idle policy |
| Deformation, one after another | Before: n pieces on equal sub-intervals of one unit. After: n units. The same pictures, slower | The T mapping keeps the current frame. The caption "runs its n catalog steps in turn…" becomes per-step captions |
| Deformation, all at once | Before: the pieces in turn inside one t. After: all pieces at the same t, a different mid-way picture | Expected and correct for a chain. Mention it in the offer's tooltip only if UX wants |
| Cuts and seams | One `cut` for every log, √ and power of the formula becomes one cut per step, each starting at the same raw θ. Dragging one seam no longer moves the others. Later pieces now show their own cuts when focused | Write the formula's θ unchanged in each step. Only formulas with two or more branched steps are affected |
| F's formula (F tile, export) | F is now the composed TeX of the steps: `e^{iz}+e^{-iz}` is written 2 cos z, and `\frac1z+z` as 2 times the Joukowski formula | The offer shows the resulting chain (and F) before the click. Undo restores the spelling |
| d/dz after the formula | Was `derivAst` of the formula; is now the exact chain rule over the steps. Same function, a different formula shown | none |
| Inverse "f⁻¹" | Was `customInverse` of the whole formula; is now per step | none |
| Sheets | `stepSheets` already ran the pieces; same surfaces | test |
| Sound | F is unchanged; the focus may move | One `soundFunctionChanged()` after `setFocus`, and one `soundCue('stepAdd')`, not n |
| Export (figure.js) | Per-step captions for n steps; F in display style is the composed TeX | Check the 700-character rule and the Russian notation (`I18N.notation`) in the captions |
| Phone | The chain bar gains n − 1 cards and scrolls | The offer lives in the step's bottom sheet (the Inspector), never over the planes; 44 px targets |

## 5. Search: "one simple function, just do it"

In `paletteItems`, the formula branch already builds the custom step `cb` on every keystroke, which runs the
recognition. Add one thing: if `Funcs.splitSteps` of `cb` gives **exactly one step** that is not a formula part
(not kept, not partial), push a catalog item **before** the formula item:
`{kind: 'fn', type, params: text, tex: 'f(z)=' + b.tex(z), label: def.label, run: addStep(type, params, at)}`.
The formula item stays second.

| query | first item |
|---|---|
| `sin z`, `\sin z`, `sin(z)` | Sine |
| `tg z`, `sh z`, `ch z`, `th z`, `arctg z`, `ln z` (Russian notation, either language) | Tangent, sinh, cosh, tanh, arctan, Logarithm |
| `e^z`, `exp z` | Exponential |
| `log z` | Logarithm (cut 180, k 0) |
| `sqrt z`, `\sqrt[3]{z}`, `z^{1/2}`, `z^{0.5}` | n-th root n=2, n=3, 2, 2 |
| `z^3`, `z^{i}`, `z^a` | Integer power 3; Complex power i; Complex power **a** |
| `1/z`, `2z+1`, `(z-1)/(z+1)`, `az+1` | Inversion; Affine 2, 1; Möbius 1, −1, 1, 1; Affine **a**, 1 |
| `conj z`, `\bar z` | Conjugation |
| `z^3+2z`, `(z-1)^2(z+2)` | Polynomial 1, 0, 2, 0; Zeros and poles 1, 1, −2 |
| `z+1/z`, `sin 2z`, `e^{2z}`, `z^2+1` | **formula step first** (two steps). The offer then applies |
| `z^2+az` | formula step first: the one Polynomial step would lose *a* |
| `z`, `3`, `\sin z+z` | as now (no catalog reading) |

Note: the task lists `z+1/z` as one step, but it is 2·J(z), two catalog steps. Calling it one "Rational" step would
contradict the note and the split. I keep the rule "one step of the reader's chain".

## 6. Typing into an existing formula step: no automatic conversion

**Decision:** keep the formula step. The note line shows "Same as Sine" plus a button **Use the Sine step**. That is
the split with n = 1, with one commit and Undo. The button appears with the note, which already updates per
keystroke, and nothing moves the field. Reasons:
- **The rule.** Converting the step replaces the text field the user is typing in with a card that has no field. A
  conversion on blur is just as bad: the field they tab back to is gone.
- **Nothing is lost by keeping it.** A recognized `sin z` already renders, deforms, cuts, lights lamps and inverts
  exactly as the catalog Sine (AS-BUILT: the deformation of z^{i} is pixel-identical).
- **The user chose a formula.** Either they picked "Custom formula" (now the second item in search) or they are
  editing one, and they may go on typing (`sin z` → `sin z + z`). Search is different: the rule fires at creation,
  where no card exists yet.

## 7. Edge cases

- **A slider moves or Play runs.** The reading's structure comes from the tape, and the texts are checked at three
  values, so the split does not depend on the current value. At a value where the formula changes kind (`\frac{az+1}{z+a}`
  at a = ±1), the recognition is refused at that value. The offer is then disabled for that moment, not moved.
- **A partly recognized formula.** The formula part becomes a formula step of its input (`\log(z^z)` → `z^{z}`, then
  Logarithm). Its text is LaTeX, not the user's plain spelling.
- **A formula inside a longer chain.** `[exp, \sin(z^2+1), ·2]` becomes `[exp, z², +1, sin, ·2]`. The indices map as
  in §1, and F at focus 0 is unchanged. A test should cover this.
- **Very long chains.** Twelve nested sines read as 12 steps. There is no cap: the inverse plan's op limit
  (`IX_OPS_MAX` 16) is the same before and after, and the per-pixel work is the same. The bench should still include
  a 12-step split with the deformation open.
- **A step that is off (`on: false`):** the pieces copy the flag.
- **A formula with an error:** no reading, no offer.

## 8. What to refuse, and why

| refused | why |
|---|---|
| no recognition (`z^2+\sin z`, `|z|`, `z`) | there is no chain to show |
| a whole formula whose parameters cannot be written with its shared numbers (`z^2+az`, `\frac{z^2-a}{z+1}`) | writing values would cut the slider's link without a warning |
| any split on load, on a link, or in the tour | saved state must open as it was |
| a Join back | it is not exact (the spelling and the per-step cuts); Undo is the exact way back |

## 9. Risks

| risk | likelihood | guard |
|---|---|---|
| A link to a shared number silently lost | high without §2 (every formula with *a* in an affine or exponent) | the rules of §2, the guard at three values, a test that the names in the texts include the formula's names unless a piece was kept |
| The offer, the note and the result disagree | medium | one function builds all three; a test compares the names |
| A long task when compiling after a split (phone) | medium | measure; it is a one-off, like adding a step |
| Users surprised that F is rewritten (2 cos z) | medium | a preview in the offer; Undo |
| A seam that used to move all branches now moves one | low | the same θ in each step |
| Values differ on the seam itself for θ outside (−180°, 180°] | certain, tiny (exact seam points only) | accepted, as for any catalog chain; tested and listed |
| Tour anchors | low | no offer under `tourHold` |
| Search: catalog-first hides the formula | low | the formula is the second item, one arrow key away |

## 10. Tests to write

**Node, `test/t_formula_split.js`.** Load the sources as `t_recognize.js` does; the corpus is the 163 + 43 spellings
plus the extras; the cuts are 180, 90, −120, 540, −180 and 270.
- Text steps built by `Funcs.build` against the formula: 0 failures off the cuts (1e‑9). On cut points, 0 for θ in
  (−180°, 180°]; for other θ, each failing point lies on a drawn seam.
- Links: every shared-number formula at four values of a. Either the names are kept in the texts or the piece stays a
  formula.
- Numeric texts round-trip bit for bit (`constValue`).
- Lamps are never lost. `Inverse.stepOps` gives the same kinds. The sheets are the same.
- The offer's names equal `recNote`'s names.
- A split inside `[exp, F, ·2]`. Twelve nested sines.
- The morph.T mapping: the homotopy point at T before equals the one at T′ after, at 200 points.
- Search: the query table of §5. The first item's type and params, in both languages.

**Browser (CDP, own port, EN and RU at 1440 and 390, light and dark).**
- For the nine examples: a split at focus 0 gives 0 plane pixels different at 8/255. Undo restores the JSON.
- The offer never intersects the plane canvases. Phone targets are ≥ 44 px. The Russian offer is ≤ 2 lines in the
  262 px column.
- Frames (p50 / p95 / max) for `(z−a)^3` and the 12-step split, with a slider sweep and with the deformation open.
  Long tasks are logged for 2 s after a split.
- The tour runs with no offer.
- A v15.1 dist opens a link of a split chain with the same values.
- i18n scan, then `make_ru_table.py --strict`: 0 unresolved.

**New strings** go in `notes/i18n/ru/v152-formula-steps.json`, using the glossary's шаг, цепочка, своя формула:

| English | Russian |
|---|---|
| "Split into {n} steps" | «Разложить на шаги ({n})» |
| "Use the {name} step" | «Заменить шагом «{name}»» |
| toast "Split f{x} into {n} steps." | «Шаг f{x} разложен на {n} шага/шагов» (plural forms) |
| the reason "Kept as a formula: its numbers depend on {names}" | «Оставлено формулой: числа зависят от {names}» |

The search group header for the catalog item needs a string from the UX designers.

## Files

`scratch-integration/symtext.js` is the prototype `splitSteps`: the three rules and the guard.
`corpus_split.js` is the corpus run (§2). `split_exp.js` is the first run, with values only, which shows the link
trap. `examples.js` and `edge.js` print the readings and check undefined names, the exceptional values, the deep
chain and the cost.

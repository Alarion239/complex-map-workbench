# A formula in steps, and "one simple function" in the search (v15.2): the specification

Lead design, 2026-10-24. Built on design-math.md (M), design-ux.md (U) and design-integration.md (I), and on the
v15.1 code in work/xvr-final-snap. Where they disagree, the choice and its reason are given in place. This file is
the one to build from.

The user's two requests (2026-10-24, verbatim):
- "Also if you can recognize the formula, suggest to transform it in multi-steps somehow nice. So that the user can see
  from what the formula is assembled and all the transforms that happen"
- "Also, in search for functions, it should match sin z to sine of z. Right now when I enter sin z it suggests custom
  formula; but if something that I wrote can be matched to one simple function, just do it immediately"

## 0. Decisions in short

1. **One function, `Funcs.splitSteps(st)`, decides everything.** It decides what the search lists, what the
   Inspector offers, what the ⋯ menu offers and what a click writes, so these can never disagree. It reads the
   recognizer's chain R as it is (M, U, I agree). Möbius runs stay merged, so the deformation, cuts and lamps are the
   ones already proved.
2. **Search: a query that is exactly one named catalog step is that step.** It is listed first, with its parameters
   written from the query. Enter or a click adds the catalog step. Custom formula is the second row. The containers
   (Polynomial, Rational, Zeros and poles) do not count (U, against I). A query of two or more steps keeps Custom
   formula first and gets a second row, **Add as n steps** (U).
3. **The offer lives in the Inspector, under the selected formula step's fields.** It is a fold, open by default, with
   a typeset derivation (`z ↦ z² ↦ z²+1 ↦ sin(z²+1)`, each row named) and one button, **Split into n steps**. For a
   one-step reading it says "This is the Sine step." with **Replace with the Sine step**. It shows nothing over the
   planes and never pops up.
4. **Nothing converts by itself.** Not while typing, not on Enter or blur, not on load, and not from a link or the
   tour. The block is hidden while the formula field holds uncommitted typing.
5. **A split is one commit** and gives the same function: the planes do not change. The cards unfold, the first new
   step is selected, an Undo toast names the steps and one sound cue plays.
6. **The way back is Undo** (the toast's button, ⌘Z / Ctrl+Z, the phone's Undo key). There is no "Join back" (I,
   against U).
7. **Granularity: R by default. One alternative: Split into simple moves**, for a Möbius or Affine step only. A
   Möbius step becomes translation → scaling → 1/z → translation (M §2.3, with the pole kept exact). It is reached from
   ⋯ and from the one-step Möbius/Affine block. It is built last and can be cut without touching the rest.
8. **Parameters are text.** It is written from the formula's own subtrees, so shared numbers keep their names. A number
   is used only when it is short and exact. `Expr.simplify` is never used. Every text is re-read and checked. A piece
   that fails is kept as a formula part. A split that keeps nothing useful is not offered.

## 1. Terms

- **F**: a Custom formula step `{type:'custom', params:{expr, cut}}` whose build `b` has `b.rec` (v15.1's reading).
- **R**: `b.rec.steps` with its groups. Each group `{from, to, src}` is a piece of F as typed, as a function of its own
  input.
- **split S(F)**: the list of steps that replaces F, `[{type, params (text), on}]`, plus `rows` (the derivation) and
  `names` (catalog labels by `recLabel`).
- **kind** of S(F):
  - `one`: exactly one step, of a named catalog type, meaning any type except `poly`, `rational`, `zp`, `custom` and
    `deriv`;
  - `many`: two or more steps, at least one of them not kept;
  - `none`: with a `reason`.

## 2. `Funcs.splitSteps(st)`: the algorithm (funcs.js)

Input: a custom step. Output: `{kind, steps, rows, names, reason}`. It is cached like `REC_CACHE`, keyed by
`Recognize.key(ast, cut)` and the expr text (LRU 96).

1. Build `b` (or take it from the caller). If `b.error`, there is no `b.rec`, or R has one step of a container type,
   the result is `none` with reason R1. R is taken from the reading at **generic values** when F has shared numbers
   (the tape, as `recChain` does). The structure therefore does not change while a slider moves.
2. For each group of R, in order, write the steps' parameters:
   - **Rule 1, the group's own spelling** (one-step groups):
     - mul, add, affine: a symbolic affine reader over `src` (the prototype `aff` in scratch-integration/symtext.js);
     - mobius: `src` as P/Q with P and Q affine (`quot`), giving the coefficients as typed;
     - powa: the exponent subtree as typed (`\sqrt[a]{z}` gives `\frac{1}{a}`).
     Literals keep their typed `lit`. Texts are printed with `Expr.toTex(node).s`.
   - **Rule 2, short exact numbers**, only when `src` holds no shared number. A value is written when, per real part,
     one of these holds:
     - its shortest round-trip decimal has ≤ 6 significant digits;
     - it equals `p/q` bit for bit, with |p| ≤ 9999 and 2 ≤ q ≤ 64 (written `\frac{p}{q}`).
     Gaussian values are written `x+y\,i`. Integer fields (`n`) take R's integers. Cut fields take F's raw `cut`, with
     `k: 0`. For a Möbius group there is a fallback when its normal-form entries are not short: scale by the smallest
     m ≤ 64 that makes all four entries Gaussian integers (U).
   - **Rule 3, kept**: otherwise the group becomes a Custom formula step with `expr: Expr.toTex(src).s` and F's cut
     (the formula part, as v15.1's partial readings do).
   - **Never `Expr.simplify`.** It folds shared names into numbers (M e5 measured this).
3. **The gate** (cheap, about 0.13 ms). If any check fails for a group, that group falls back to rule 3.
   - Build each written step with `Funcs.build` from its text, exactly as the app will.
   - The composed group must equal the group's piece at `REC_PROBES` to 1e-12 relative, with non-finite matching
     non-finite. This is checked at the current values and, when there are names, at the two generic sets, with the
     piece re-parsed at each value.
   - The set of names in all texts and kept parts must equal the set of names in F.
4. **Result.**
   - If every group was kept, or the only non-kept steps are Möbius-type around a kept part (R's partial rule): `none`.
     The reason is R2 when a name blocked it, otherwise R3.
   - One step: `one` when its type is a named catalog type. A container, or a single kept step, gives `none` with R1.
   - Otherwise `many`.
5. **`rows`** (`Funcs.splitRows`): row 0 is `z`. Row k is step k's TeX applied to row k−1, with names printed by the
   Inspector's `namedTex` rule (`z−a`, never `z−0.7`). The Inspector, the palette caption and the tests all call this
   one function. When the last row, normalised (spaces, `\left`, `\right` and `\,` removed), differs from
   `Expr.toTex(ast)`, the last row gets `=` and the typed formula. That is how an identity is shown before the click:
   `2\cos z = e^{iz}+e^{-iz}`.
6. **At the current values:** if the current build has no `b.rec` (a value where F changes kind, such as
   `\frac{az+1}{z+a}` at a = 1), the result keeps its `kind` and adds `blocked: true` (reason R5). The block stays and
   only the button is disabled, so nothing flickers while a slider moves.

`finishRec` must keep each group's `src` (I). That is the only change on the recognition path. `Recognize`, `REC_CACHE`,
the tape and the probes are unchanged.

## 3. What is offered, and when

| reading of F | Inspector block | ⋯ menu of the step | search query |
|---|---|---|---|
| none (`z`, `z^2+\sin z`, `|z|`), or one container step (`z^3+2z`) | none; the v15.1 note | Split into steps, disabled (R1) | Custom formula only |
| `one` (`sin z`, `z^{i}`, `\frac{2z+1}{z-1}`) | "This is the Sine step." + Replace; for Möbius or Affine, also "Split into simple moves" | Replace with the Sine step | **the catalog step first**, Custom formula second |
| `many` (`\sin(z^2+1)`, `e^{iz}+e^{-iz}`, `\log(z^z)`) | fold "Built from n steps", the rows, Split into n steps | Split into steps | Custom formula first, **Add as n steps** second |
| `none` because of a name (`z^2+az`) or of numbers (`\frac{(z-1)(z+2)}{z-3}`) | none; the v15.1 note | Split into steps, disabled (R2 or R3) | Custom formula only |
| any reading, F has an error | none | disabled (R4) | the parse error, as today |
| `blocked` at the current values | block shown, button disabled with tooltip R5 | disabled (R5) | (n/a: a query has no slider) |

Never offered:
- an automatic conversion of any kind;
- a pop-up, banner, coach mark or toast that offers the split (the only toast is the Undo toast after the user's click);
- a preview of the stages on the planes on hover;
- an auto-played deformation after a split;
- a "Join back";
- a general "join steps into a formula";
- a granularity slider;
- a card suffix ("· 3 steps") — U's idea, dropped: the cards stay "type and picture", and the Russian text risks
  overflowing the card's two-line name (not measured).

While the tour holds the app (`tourHold`), the block is hidden unless the current stop sets `split: true` (§10). The
tour's typed scenes stay as in v15.1 and their anchors do not move (I).

## 4. The search (command palette and the add-step menus)

The add-step menus are `openPalette(…, {fnOnly: true})`, so one change in `paletteItems` (app.js) covers both.

In the formula branch, `cb = Funcs.build(custom q)` already runs the reading on every keystroke. Then
`sp = Funcs.splitSteps(cb step)`, cached, so no second reading.

- **`sp.kind === 'one'`.** Push first:
  - `{kind:'fn', type, params: sp.steps[0].params, group: <the catalog group of type>, label: def.label}`;
  - `tex: 'f(z)=' +` the step's named TeX in z;
  - `desc`: the catalog row's own (`FN_INFO`);
  - `props`: the built step's props;
  - `run: (at) => addStep(type, params, at)`.
  Then the Custom formula row, unchanged. The plain catalog row of the same type, if it also matched by name later in
  the list, is dropped (no two Sine rows).
- **`sp.kind === 'many'`.** Custom formula first, unchanged; Enter adds what was typed (U). Second:
  - group `Custom formula`, `label: $tn('Add as {n} step', 'Add as {n} steps', n)`;
  - `tex`: the formula;
  - `desc`: the names joined by ' → ';
  - `run: (at) => addSteps(sp.steps, at)`.
  When this row is selected, the preview caption shows the rows on one line: `z ↦ z² ↦ z²+1 ↦ sin(z²+1)`.
- **Otherwise** v15.1 as it is.
- **Names not defined yet** (`z^a` before *a* exists): v15.1 as it is (the parse error). Once *a* exists, `z^a` is
  Complex power α = `a`.
- **Shift+Enter** inserts before, as for every row. Typing only changes the list. That is what a search does, and no
  card changes under the user's fingers.

Measured one-step queries (v15.1 reader):

| query | step |
|---|---|
| `sin z`, `\sin z`, `sin(z)` | Sine |
| `tg z`, `sh z`, `ch z`, `th z`, `arctg z` (Russian notation, either language) | Tangent, sinh, cosh, tanh, arctan |
| `e^z`, `exp z` | Exponential |
| `log z`, `ln z` | Logarithm |
| `sqrt z`, `z^{0.5}`, `z^{1/2}` | n-th root, n = 2 |
| `\sqrt[3]{z}`, `z^{1/3}` | n-th root, n = 3 |
| `z^3`, `z^{-2}` | Integer power |
| `z^{i}`, `z^{a}` | Complex power, α = `i` or `a` |
| `1/z` | Inversion |
| `-z`, `iz`, `z/2` | Multiply by c; c = `\frac{1}{2}` for z/2 |
| `z+1` | Translate by c |
| `2z+1` | Affine |
| `(z-1)/(z+1)`, `\frac{2z+1}{z-1}`, `\frac{3}{z-1}+2` | Möbius (1, −1, 1, 1), (2, 1, 1, −1), (2, 1, 1, −1) |
| `conj z`, `\bar z` | Conjugation |
| `\frac12(z+\frac1z)` | Joukowski |
| `\arcsin z` | arcsin |

**Two steps, so the formula stays first**, as all three designers found:
- `z+1/z` is Joukowski → ×2, because the catalog Joukowski is ½(z + 1/z);
- `e^{iz}`, `2\sin z`, `\sin 2z`, `z^2+1`, `1/z^2`.

They are never "rounded" to one step.

## 5. A formula step already in the chain (the second request's question)

**Decision: never automatic** (M, U and I agree). The reasons:
- **It would change the card under the user's fingers.** Sine has no field and Möbius has four, so the field being
  typed in would vanish. On blur, the field the user tabs back to would be gone.
- **Prefixes read as one step on the way to something else** (`sin z` → `sin z+z^2`).
- **Nothing is gained by forcing it.** A recognized one-step formula already renders, deforms, cuts and lights its
  lamps as the catalog step (v15.1).
- **It is not invisible downstream.** The formula's `-z` gives −0 where Multiply by −1 gives +0, and a later Logarithm
  reads that on its cut (M §7).
- **The typed text is the user's record,** and one Undo should give it back.

In the search the rule *does* fire, because the query is a request and no card exists yet.

Instead, after the text is committed, the Inspector shows the `one` block (§6). "Committed" means the field's `change`
event: Enter or blur. Between the first `input` event and `change`, the block is hidden and the note line updates as in
v15.1. No button comes and goes under the cursor.

## 6. The Inspector block

### 6.1 Desktop (≥ 1024 px; Inspector column 262 px) and tablet (768–1023, Inspector docked under the chain)

It is the same block in both places. It sits after the fields and before the note line. While it is shown, the note
line drops `b.recNote`, because the block says the same thing.

```
 f₁  ƒ  Custom formula                          ⌕  ⋯
 w₁ = sin(z² + 1)
 [ \sin(z^2+1)                            ]  cut 180°
 ▾ Built from 3 steps
     z
   ↦ z²                     Integer power
   ↦ z² + 1                 Translation
   ↦ sin(z² + 1)            Sine
   [ Split into 3 steps ]
 log, √ and powers use arg ∈ (−180°, 180°].          (the note line, as v15.1)
```

- **The fold** is a `<details class="split-offer">`, open by default.
  - Its `summary` reads "Built from 3 steps" when open and "Built from 3 steps: Integer power → Translation → Sine"
    when folded, so the folded state is v15.1's one-line note in other words.
  - The fold state is remembered for the viewer in `localStorage['cmw-split-fold']`, read and written in try/catch.
    Without storage it opens.
  - Folding is the dismissal. There is no per-formula dismissal list (U).
- **The rows** are an `ol`.
  - Each row is typeset with `TeX.set` at the size of the F Inspector's `.wl` list, with ↦ before rows 1…n.
  - The step name is at the right in `--ink-2`, 12 px. It wraps under the formula when the formula needs more than 60 %
    of the width (a CSS grid with wrap).
  - Long rows shrink with `fitPick` and are never cut.
  - All rows are shown, for any n.
  - A kept part is named "Custom formula".
  - The "=" on the last row shows a change of spelling (§2.5).
- **The button** is the Inspector's small secondary button (as Add zero / Add pole): "Split into 3 steps".
  - Its tooltip and aria-description: "Each step gets its own card and picture; the deformation plays them one by one."
  - It is disabled with tooltip R5 when `blocked`.
  - It sits after the fields in the tab order.
- **The one-step form** has no rows: "This is the Sine step." and the button "Replace with the Sine step". When the step
  is Möbius or Affine, a second, quieter text button follows: "Split into simple moves" (§8).
- **Accessibility.** The block is a region named by its summary. The rows keep the hidden MathJax copy for screen
  readers.

### 6.2 Phone (Android Chrome, 360–430 px)

- The Editor sheet hosts the Inspector, so the same block appears there.
- Step names always wrap under their formula.
- The buttons are full width and 44 px tall.
- ⋯ in the sheet's Inspector head holds the same menu items.
- After a split the chain bar scrolls to card k.
- The toast sits where toasts sit today. Undo is also the tool row's first key.

### 6.3 Light and dark, English and Russian

The block uses only existing tokens (`--ink`, `--ink-2`, the secondary button), so both themes come free. Russian
measurements are in the test plan: the summary is at most 2 lines and the button 1 line in the 262 px column.

## 7. What one click does

New in app.js: `splitStep(k, kind)` (kind `'steps'` or `'moves'`) and `addSteps(list, at)`. Both follow `convertZp` /
`addStep`: one `commit()`.

`splitStep(k, kind)`:
1. Recompute `sp` at the current values. If it fails, run `sndError()`, show the reason as a toast and stop.
2. Replace the step:
   - `news = sp.steps.map(s => ({type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: st.on !== false}))`;
   - `S.steps.splice(k − 1, 1, …news)`;
   - `n = news.length`.
3. Map the indices:
   - `S.focus`: the same if 0 or < k, the same (k) if it was k (the first new step is shown alone), + n − 1 if > k;
   - `S.sel = k`, the first new step, shown in the Inspector (+ n − 1 for any other selected step > k, which does not
     arise here).
4. If the deformation is open at focus 0, map `morph.T`. The formula's unit [j, j+1) becomes [j, j+n):
   `T' = j + (T − j)·n` when ⌊T⌋ = j = k − 1, and `T + n − 1` when T ≥ k. The frame stays the same, because the split
   plays the formula's own sub-steps (M e3: bitwise).
5. Then:
   - `chainChanged(true)`, `setFocus(S.focus)`, `commit()`;
   - `soundCue('stepAdd')` once;
   - `tourEmit('formula-split', {k, n})`.
6. **The unfold.** The new cards get the class `born` for 200 ms: opacity 0 → 1 and scaleX 0.6 → 1, ease-out. There is
   none under `prefers-reduced-motion`. Card k scrolls into view.
7. **The toast:**
   - `undoToast("Split f₂ into f₂–f₄: Integer power → Translation → Sine.")`;
   - for `one`: "f₂ is now the Sine step.";
   - for moves: the same text as the split, with the move names.
8. It does not play the deformation, change the view, compile anything beyond the new chain's program, or move the
   planes' camera.

`addSteps(list, at)` (the palette's "Add as n steps") inserts n steps at `at`, then:
- `setFocus(at + 1)` (the first new step shown alone, as `addStep` shows a new step);
- `commit()` and `startTransition(at + 1)`;
- `noteRecent` for each type;
- one `soundCue('stepAdd')`;
- card at+1 scrolls into view.

The ⋯ menu (`stepMenu`), next to Write by zeros and poles:
- for a custom step: "Split into steps", or "Replace with the {name} step" for `one`. It is disabled with its reason
  (R1–R5) as the item's tooltip and aria-description;
- for a mobius or affine step: "Split into simple moves" (§8).

## 8. Granularity

**Default: R.** Reasons:
- no "as typed" chain exists for the commonest formulas (z on both sides of ÷ or +);
- R's merging is where exactness was proved (382,583 comparisons);
- the split's movie is the formula step's movie, frame for frame (M e3), only stretched to n units.

**The one alternative: "Split into simple moves"** (M §2.3; U refused a choice in the offer, and that holds: this
is a separate action, not a setting). It applies to a Möbius or Affine step, whether from the catalog, from a split, or
the `one` reading of a typed fraction. It is the textbook decomposition, and it is what "all the transforms that happen"
means for a fraction such as `\frac{3}{z-1}+2`, which R reads as one Möbius step.

- **Möbius (a z + b)/(c z + d), c ≠ 0, det = ad − bc:** Translate by `d/c` → Multiply by `−c²/det` → Inversion →
  Translate by `a/c`. This order, scaling *before* inverting, keeps the pole exact: in the other order `CX.mul(c, ∞)` is
  NaN (M e4/e7).
- **c = 0:** Multiply by `a/d` → Translate by `b/d`.
- **Affine:** Multiply by `a` → Translate by `b`.
- **Identity moves are dropped** (×1, +0). Nothing is split further: rotation stays with scaling, and z⁶ is not split
  into z²∘z³.
- **Text:** offered only when the four fields are plain numbers (Gaussian decimals or fractions, no names, no
  functions). The moves' constants are computed in exact rational arithmetic and written by rule 2. Otherwise the item
  is disabled: "Its coefficients are not plain numbers".
- **Gate:**
  - the moves equal the Möbius step to 1e-12 at `REC_PROBES`;
  - at the pole the moves give ∞ as the step does;
  - the test also records z = ∞, where the catalog `mul` may give NaN (§12). If it differs, the moves item ships only
    after `mul`/`add` map ∞ to ∞, and that change must leave every golden unchanged. Otherwise this item is cut from
    v15.2.
- **What changes on purpose:** the deformation is four paths instead of the Möbius one-parameter path. That is the
  point.

`\frac{3}{z-1}+2` → Translate −1 → Multiply `\frac{1}{3}` → Inversion → Translate 2.

## 9. Parameters, shared numbers, exactness

- Shared numbers keep their names in the texts:
  - `(z-a)^3` → Translate c = `-a`, Integer power 3;
  - `\frac{az+1}{z+a}` → Möbius `a, 1, 1, a`;
  - `e^{az}` → Multiply `a`, Exponential;
  - `z^{a}` → Complex power `a`, never Integer power, even at a = 2.
  One slider moves every field that uses the name, and the chain stays F. The split never creates, renames or removes a
  shared number.
- Refused for a link: `z^2+az`, `(z-a)^2(z+1)`, `\frac{z^2-a}{z+1}` (normal-form coefficients depend on *a*). These
  give `none` with R2.
- Refused for numbers: `\frac{(z-1)(z+2)}{z-3}`. Its reading has 1/√10. It gives `none` with R3, and ⋯ → Write by zeros
  and poles stays the rewrite for it.
- **Exactness standard** of the split chain against F (M §1, I §2):
  - the same values off the cut rays: 1e-12 at the probes, and in practice bitwise;
  - the same cuts as sets, the same sheets and poles;
  - no removable point filled in.
- **Accepted differences.** They are listed in tests, not shown in the UI. Each lies on the preimage of a drawn cut,
  a set of measure zero:
  1. A pure negation feeding a 180° cut (`\log(-z)`, `\sqrt{-z}`). On the positive real axis the steps give the
     principal side (+iπ) where F's IEEE −0 gave −iπ. This is the catalog convention, and the chain a user would build
     by hand. U wanted a refusal and M a UI clause. Both are rejected: a measure-zero difference does not justify losing
     the offer for every −u, nor a sentence in the panel.
  2. F's θ outside (−180°, 180°] (540°, …). The split normalises it to (cut, k) per step: the same function off the ray
     (I measured 55 seam points at 540°).
  3. Identity readings where F's spelling overflows (math-4). The split is finite where F gave NaN, as the GPU already
     drew it.
- **Cuts:** each branch step gets F's θ as typed, with k = 0. The one shared θ becomes per-step seams. That is a gain:
  each seam drags on its own, in its own input plane.

## 10. After the split: what the user sees

- **Planes:** the same function, so X, Y, Phase, Landscape and the spheres are pixel-identical at focus 0 (the
  acceptance test).
- **Cards:** the row is now the assembly. Card k shows F_k (z², then z²+1, then sin(z²+1)) in the open view, as the
  tour's `cards` stop already teaches.
- **Inspector:** each step has its own (w₃ = w₂ + 1, c₃ = 1 or `−a`, its own seam note). F's TeX is the composition: the
  last row of the block, "=" included.
- **Walk the steps (new, small; U).** When a step is shown alone, the chip in X's head becomes "f₃ alone ‹ › ×".
  - ‹ and › show the previous and next step alone, with tooltips "Show the previous step alone" / "Show the next step
    alone". They are disabled at the ends.
  - They live in the head strip, not over the plane, and have no shortcut.
  - On the phone they are shown only when 44 px targets fit at 360 px; otherwise they are omitted and a card tap plus L
    remains.
- **The deformation:** n time units instead of one.
  - The ticks name f₂ f₃ f₄, and the playing card is highlighted (`syncPlaying`).
  - "All at once" now runs the new steps together, a different and correct movie for a chain.
  - The caption becomes the per-step chain caption, in place of "runs its n catalog steps in turn". This is intended
    and covered by the guide sentence.
- **d/dz after F:** the same function, now by the chain rule. **f⁻¹:** per step (principal branches).

## 11. Export, sound, tour, guide

- **Export (figure.js):** no code change. A split chain is an ordinary chain: per-step captions and F as the composed
  TeX. The test exports the split `\sin(z^2+1)` in English and Russian (Russian notation) and checks the 700-character
  caption rule.
- **Sound:** one `soundCue('stepAdd')` per split or Add as n steps. Nothing else: F is unchanged, so "Hear the function"
  keeps sounding the same, and `setFocus` already handles a focus change.
- **Tour** (tour.js): one new stop in "Editing the chain", after `inspector`. The chapter's `rev` goes 2 → 3.
  - Scene: the chain is one Custom formula `\sin(z^2+1)`, selected, the panel open; `split: true`. Anchor: the block
    `.split-offer`, in the Editor sheet on the phone.
  - Title: "A formula in steps" / «Формула по шагам».
  - Body: "This formula is a chain of catalog steps; the Inspector shows how it is built. Split it, and each step gets
    its own card: the row then shows every transform in turn, and the deformation plays them one by one. Undo brings
    the formula back." / «Эта формула — цепочка шагов каталога, и инспектор показывает, из чего она составлена.
    Разложите её, и у каждого шага появится своя карточка: ряд карточек покажет все преобразования по очереди, а
    деформация пройдёт их одно за другим. «Отменить» вернёт формулу.»
  - Try: "Press Split into 3 steps." / «Нажмите «Разложить на 3 шага».» (event `formula-split`).
  - The `keys` stop gains: "…; a formula that is one catalog function, such as $\sin z$, adds that function." /
    «…; формула, совпадающая с одной функцией каталога, например $\sin z$, добавляет саму эту функцию.»
- **Guide** (openGuide, the chain section, after the paragraph on custom formulas), U's paragraph with «Разложить»:
  - EN: "A typed formula that is a chain of catalog steps, such as $\sin(z^2+1)$, shows in the Inspector how it is
    built: $z\mapsto z^2\mapsto z^2+1\mapsto \sin(z^2+1)$. **Split into steps** turns it into those steps, each with its
    own card and picture; Undo returns the formula. A Möbius step can also be split into simple moves: a translation, a
    scaling with rotation, $1/z$ and a translation. A sum or product of two functions of $z$, such as $z^2+\sin z$, is
    not a chain and stays one step. In the search, a formula that is one catalog function, such as sin z or z^i, adds
    that function directly."
  - RU: «Если введённая формула — цепочка шагов каталога, например $\sin(z^2+1)$, инспектор показывает, из чего она
    составлена: $z\mapsto z^2\mapsto z^2+1\mapsto \sin(z^2+1)$. Пункт **Разложить на шаги** превращает её в эти шаги, у
    каждого своя карточка и картинка; «Отменить» возвращает формулу. Дробно-линейный шаг можно разложить и на простые
    преобразования: сдвиг, растяжение с поворотом, $1/z$ и сдвиг. Сумма или произведение двух функций от $z$, например
    $z^2+\sin z$, — не цепочка: такая формула остаётся одним шагом. В поиске формула, которая совпадает с одной функцией
    каталога, например sin z или z^i, сразу добавляет эту функцию.»

## 12. Strings (notes/i18n/ru/v152-split.json)

Plurals use `$tn` with the forms one/few/many/other. Quotes are «ёлочки». In-text «инспектор» is lower case. The verb
is «Разложить» (разложение в композицию), and «Заменить шагом …» follows «Заменить обратной». `{name}` is the catalog
label, already translated. `{chain}` is labels joined by ' → '.

| key | English | Russian (one / few / many where plural) |
|---|---|---|
| split.built | Built from {n} steps | Составлена из {n} шага / шагов / шагов |
| split.builtChain | Built from {n} steps: {chain} | Составлена из {n} шага / шагов / шагов: {chain} |
| split.btn | Split into {n} steps | Разложить на {n} шаг / шага / шагов |
| split.btnTip | Each step gets its own card and picture; the deformation plays them one by one. | У каждого шага будет своя карточка и картинка; деформация пройдёт их по очереди. |
| split.menu | Split into steps | Разложить на шаги |
| split.one | This is the {name} step. | Это шаг «{name}». |
| split.oneBtn | Replace with the {name} step | Заменить шагом «{name}» |
| split.moves | Split into simple moves | Разложить на простые преобразования |
| split.movesTip | A translation, a scaling with rotation, 1/z and a translation | Сдвиг, растяжение с поворотом, 1/z и сдвиг |
| split.toast | Split f{k} into f{k}–f{k2}: {chain}. | Шаг f{k} разложен на шаги f{k}–f{k2}: {chain}. |
| split.oneToast | f{k} is now the {name} step. | Шаг f{k} заменён шагом «{name}». |
| split.r1 | Not a chain of catalog steps | Не цепочка шагов каталога |
| split.r2 | Its numbers depend on {names} | Её числа зависят от {names} |
| split.r3 | Its numbers have no short exact form | У её чисел нет короткой точной записи |
| split.r4 | This step has an error | В этом шаге ошибка |
| split.r5 | Not at these values of the numbers | Не при этих значениях чисел |
| split.r6 | Its coefficients are not plain numbers | Её коэффициенты — не просто числа |
| pal.asSteps | Add as {n} steps | Добавить как {n} шаг / шага / шагов |
| alone.prev | Show the previous step alone | Показать отдельно предыдущий шаг |
| alone.next | Show the next step alone | Показать отдельно следующий шаг |
| tour.split.* | §11 | §11 |
| guide.split | §11 | §11 |

The labels "Inversion", "Translation" and "Scaling" already exist (`recLabel`, math.json). Regenerate with
`python3 tools/make_ru_table.py --strict`, with 0 unresolved.

## 13. Files to change (work/xvr-final-snap only)

| file | change |
|---|---|
| src/funcs.js | `finishRec` keeps `src` per group. New and exported: `splitSteps`, `splitRows`, `movesOf` (with the text helpers `aff`, `quot` and the short-number printer, after scratch-integration/symtext.js, plus the gate). Möbius TeX drops zero terms (`\frac{1}{e^{-z}+1}`, not `\frac{0\,e^{-z}+1}{…}`): a defect the rows expose. Before taking it, grep every LaTeX golden and caption test; if any would change, stop and report |
| src/app.js | `paletteItems` (one-step row, the dedupe, Add as n steps, the preview caption); `splitStep`, `addSteps`; the `stepMenu` items; `morph.T` mapping; the `born` class; `syncAloneChip` ‹ ›; the `tourHold` gate; expose `splitStep` and `splitInfo` on the Inspector's `A` |
| src/inspector.js | the block (§6), hidden between `input` and `change` of the expr field; the note drops `recNote` while the block shows; the fold key |
| src/desk.css, src/phone.css | `.split-offer` (rows grid and wrap, buttons), `.card.born`, the chip's ‹ › |
| src/tour.js | the new stop, the `keys` sentence, rev 2 → 3, the `split` stop flag |
| src/app.js (openGuide) | the guide paragraph |
| notes/i18n/ru/v152-split.json, src/i18n_ru.js | the strings; the table regenerated |
| test/t_formula_split.js (new, in the work copy) | §14.1; loads the sources as work/xvr/test/t_recognize.js does |
| test/<name>_cdp/split_cmd.js (new) | §14.2, from a copy of test/cdp_kit on your own port |

Not touched: recognize.js, glsl.js, inverse.js, figure.js, sound.js, the perf baselines, accepted.json and the golden
images.

## 14. Test plan

### 14.1 Node: `node test/t_formula_split.js`

Inputs: notes/formula-recognition/corpus.json (187 LaTeX + 43 plain), every formula named in this file and in M/U/I,
and the §4 query table. Cuts: 180, 90, −120, −180, 270, 540.

1. **kind and reason** for every input, against a table in the test. This includes the refusals (`z^2+\sin z`,
   `z^2+az`, `\frac{(z-1)(z+2)}{z-3}`, containers) and the `one` list of §4.
2. **Texts.**
   - Every written step builds with no error from its text.
   - Numeric texts re-read bit for bit (`Expr.constValue`).
   - No text contains a decimal with more than 6 significant digits.
   - The names in the texts equal the names in F.
3. **Values:**
   - the split chain equals `rec.fc` at `REC_PROBES` (1e-12);
   - it equals F (`Expr.compile`) at t_recognize's BASE points off the cuts (1e-9);
   - on ±0 axis points and on points on and either side of every drawn cut, each difference from F lies on a cut's
     preimage and belongs to an accepted class (§9). They are listed and counted, with no unexplained difference.
4. **Shared numbers** at a ∈ {0.7, 0.31, 1.83, −0.4, 0, 1, −1}: values equal, names kept, and at the special values
   `blocked` (not a different structure).
5. **Lamps and inverse:** `composeProps` of the split ⊇ the formula step's lamps; `Inverse.stepOps` gives the same kinds.
6. **The deformation:** the formula's `hom(t)` against the split chain played in turn at n·t, at 400 points ×
   t ∈ {0.1, 0.3, 0.5, 0.7, 0.9}. Bitwise for θ in (−180°, 180°]; otherwise only seam points differ. The `morph.T`
   mapping (§7) is a pure helper, tested on [exp, `\sin(z^2+1)`, ·2].
7. **Rows:** `splitRows` last row (without the "=" part) equals the composed TeX of the built steps. The "=" part
   appears exactly when the normalised spelling differs. `names` equal the recNote names.
8. **Moves** for 200 random Möbius and Affine steps with integer, decimal and Gaussian entries, and for
   (2, 1, 1, −1):
   - equal to the step at random points (1e-12);
   - no ±0 differences on the axes;
   - ∞ at the pole;
   - z = ∞ recorded (§8 gate);
   - exact texts;
   - identities dropped.
9. **The Möbius TeX:** (0, 1, 1, 1) prints `\frac{1}{z+1}`.
10. **Cost:** `splitSteps` p95 < 1 ms over the corpus (uncached), and about 0 cached; 12 nested sines split into 12 in
    < 5 ms.
11. **Unchanged:** all other `node test/t_*.js` give their v15.1 results; t_recognize passes unchanged.

### 14.2 CDP: `split_cmd.js` (dist/test.html; your own port; one browser; profiles deleted at the end)

1. **Search, English, 1440×900, light:**
   - `sin z`: item 0 is type `sin`. Enter adds Sine; there is no custom step.
   - `\frac{2z+1}{z-1}`: Möbius a=2, b=1, c=1, d=−1.
   - `z^{i}`: Complex power α=i.
   - `2z+1`: Affine.
   - `z+1/z`, `\sin(z^2+1)`: item 0 is Custom formula and item 1 is "Add as 2/3 steps". Running item 1 inserts the
     steps.
   - `z^2+\sin z`: Custom formula only.
   - The same from the add-step menu (fnOnly).
2. **The block:**
   - Add `\sin(z^2+1)`: the block shows 4 rows and the button.
   - Its bounding box does not intersect any plane canvas.
   - Type `\sin(z^2+1)` key by key into the field: the block is hidden throughout and shown after Enter.
   - Screenshot.
3. **The split:**
   - Click: 3 steps with the expected types and texts, `S.sel` = 1.
   - X, Y, Phase and Landscape read back before and after differ by 0 px at 8/255.
   - The toast text is right. Undo gives `JSON.stringify(S.steps)` equal to before; ⌘Z/Ctrl+Z too.
4. **In a chain:** [exp, `\sin(z^2+1)`, ·2], split f₂: the planes are identical, and the indices and selection are as in
   §7.
5. **Deformation open** at T = 1.5 on that chain, split: the frame is identical (0 px at 8/255), and T is mapped.
6. **Shared number:** a = 0.7, `(z-a)^3`, split.
   - c₁ reads `-a`.
   - A slider sweep of a over ±0.2 moves the chain, which equals F at a probe.
   - One GPU program key over the sweep.
7. **`one` in a step:** a formula step `sin z` shows "This is the Sine step." The button replaces it; Undo.
8. **Moves:** Möbius (2, 1, 1, −1), ⋯ → Split into simple moves: 4 steps, planes identical, the pole image at ∞.
9. **The alone walk:** focus 1, then › three times, then ‹. X and Y follow, and the buttons are disabled at the ends.
10. **Russian, 1440:**
    - steps 1–3 with `tg z`;
    - no English leak in the block, menu, toast or palette;
    - the summary ≤ 2 lines and the button 1 line;
    - screenshot.
11. **Dark theme:** screenshots of the block, desktop and phone.
12. **Tablet:** 1024×768 and 768×1024. The block is in the docked Inspector, with no horizontal overflow.
13. **Phone (mobile emulation):** 390×844 and 360×780.
    - Open the Editor sheet on the formula step: the block is visible and the buttons are ≥ 44 px.
    - The split works and the chain bar shows card k.
    - The ‹ › rule of §10 holds.
    - English and Russian.
14. **Tour:**
    - `node t_tour.js` passes as before.
    - In CDP, the typed-formula stops show no block, and the new stop shows it.
    - Try completes on the click, desktop and phone.
15. **Perf (BUDGET60):**
    - frames p50/p95/max over a 3 s slider sweep after splitting `(z-a)^3`, and for 12 nested sines with the
      deformation open;
    - long tasks logged for 2 s after a split (one compile is allowed, as for adding a step);
    - typing into the palette: the slowest input handler ≤ 4 ms.
16. **Export:** a figure of the split `\sin(z^2+1)` in English and Russian completes; captions ≤ 700 characters.
17. **Shots** go to notes/formula-steps/shots/.

### 14.3 Gates

- i18n scan clean; `make_ru_table.py --strict`: 0 unresolved.
- Image-quality suite: no change against v15.1 (no golden touched).
- Perf baselines not run against new numbers.

## 15. Build order (the user is waiting)

1. **The search** (§4) with `splitSteps` (§2), the gate and the node tests 1–3 and 7. This is the user's most direct
   ask.
2. **The block, splitStep, Undo, the ⋯ items, the unfold and the toast** (§6–7), with the CDP tests 1–7 and 10–13.
3. **The alone ‹ ›, the tour stop, the guide and the strings table** (§10–12).
4. **Split into simple moves** (§8), only if its ∞ gate passes; otherwise it is left out of v15.2 and nothing else
   changes.

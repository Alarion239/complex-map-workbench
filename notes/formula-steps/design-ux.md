# Formula in steps: the interface and the teaching (UX designer, v15.2)

Scope: the user's two requests of 2026-10-24. (1) When a typed formula is recognized, offer to turn it into its steps,
so the user sees what it is built from and every transform in turn. (2) In the function search, a query that is one
simple function, such as `sin z`, *is* that function: add it directly.

Studied: `work/xvr-final-snap/src` (recognize.js, funcs.js `recChain`/`asChain`/`recLabel`, inspector.js, app.js
`paletteItems`, `stepMenu`, `convertZp`, `addStep`, `undoToast`, `syncPlaying`, the transport, `morphCaption`;
phone.js, phone.css, tour.js), `notes/ui-redesign-2/README.md`, the recognizer's DESIGN.md and AS-BUILT.md.
Experiments (read-only, node): `notes/formula-steps/scratch-ux/try_chains.js`, `try_stages.js`, `try_display.js`. Every
reading quoted below is the output of those scripts on the v15.1 sources.

## 0. Decisions in short

1. **Search: one function, added directly.** If a query reads as exactly one *named* catalog step, that step is the
   first row, with its parameters written as text from the query. Enter or a click adds it. The custom formula is the
   second row. Containers (Polynomial, Rational, Zeros and poles) and partial readings do not count.
2. **Search: several steps.** The formula stays the first row (you typed it, so Enter adds what you typed). A second
   row, **Add as 3 steps**, adds the steps directly. Its preview caption shows the assembly.
3. **A formula step already in the chain is never converted on its own**, while typing or after. The Inspector
   *offers* the conversion instead (§3).
4. **The offer is in the Inspector, under the formula.** It shows a typeset derivation, one row per step
   (`z ↦ z² ↦ z²+1 ↦ sin(z²+1)`, each row with its step name), and one secondary button, **Split into 3 steps**. It
   replaces today's one-line note "Same as …". It is a fold; folding it is the dismissal. Nothing pops up, and nothing
   is drawn over the planes.
5. **The split is one commit.** The planes do not change: it is the same function. The cards unfold in the chain bar.
   An Undo toast names the new steps. The first new step is selected.
6. **The way back:** Undo (toast, ⌘Z/Ctrl+Z, the phone's Undo key). Also **Join back into one formula**, shown on the
   new steps while they are exactly what the split wrote.
7. **The transforms are shown by what the app already has.** After the split, the card row is the assembly
   (card k = F_k). The deformation plays one step per time unit and highlights the playing card. Each step has its
   own seam and its own Inspector. One small addition: ‹ › on the "f₂ alone" chip walks the alone view step by step.
8. **One granularity:** the recognizer's chain. No choice, no slider.

## 1. What the app does today (facts the design builds on)

- The recognizer reads a formula as catalog steps that *are* the formula. The step keeps its formula text. Its
  values, lamps, cuts and deformation come from the chain. The Inspector's note adds one clause: "Same as Integer
  power → Translation → Sine" (`recNote`).
- Adding a step (`addStep`) shows it alone and selects it, so the Inspector shows a new formula step at once. That is
  the natural moment for the offer, and the Inspector is already open.
- Precedent for rewriting a step: **Write by zeros and poles** in the step's ⋯ menu (`convertZp`). It is one commit
  with an Undo toast ("f₁ is now given by its zeros and poles …"). The split follows this pattern exactly.
- Card k shows F_k, the map up to step k, in the open view ("the row shows how F is built", tour stop `cards`). The
  deformation's transport has one tick per step and highlights the playing card (`syncPlaying`).
- A recognized formula deforms in **one** time unit: its n steps share it in equal parts (frperf-6, left to the user).
  The split answers that question per formula: split, and each step gets its own unit.
- The palette (`paletteItems`) parses any query containing `z ( \ ^ | < >` and puts **Custom formula** first. Catalog
  rows match only by name, so `sin z` finds no Sine row today.

## 2. The search: "one simple function, just do it"

**Rule.** Parse the query, then read it (the palette already builds the custom step: reuse its `b.rec`, so a keystroke
costs no second reading). The query is *one simple function* when:
- the reading is full (not partial) and has exactly one step;
- that step is a named catalog step: everything except `poly`, `rational`, `zp`, `custom` and `deriv`. Containers are
  excluded on purpose. Their fields are the formula's coefficients, so the typed text is already the clearest form.
  A typed polynomial stays the formula; ⋯ → Write by zeros and poles is the rewrite for it;
- every parameter has an exact text (below).

**Rows.** The step's row comes first, under its catalog group heading (e.g. Trigonometric). Its label is the catalog
name (Sine). Its TeX is the step with the typed values (`\sin z`, `z^{i}`, `\frac{2z+1}{z-1}`). Its description and
property letters are the catalog row's own. Then the Custom formula group with the formula, as today. Enter adds the
first row with `addStep(type, params)`. Shift+Enter inserts before, as for every row. The preview plate draws the
selected row as today.

**Parameters as text, exact.** Step fields hold text, so the reading's values must be written back as text that
evaluates to the very same double (a bit-exact round trip). Otherwise the one-step row is not offered and the formula
stays first. The rules:
- integers as they are (`3`), short decimals as the shortest round trip (`0.5`), small fractions as `p/q` (`1/3`),
  Gaussian numbers as `1+i`;
- a value that comes from a shared number is written as that constant subtree of the formula (`-a`, `a+i`), so the
  link survives. The recognizer must hand this text out; today it hands out values only (`add(c=-0.7)` for `(z-a)^3`);
- **Möbius as typed.** The reader normalizes (`\frac{2z+1}{z-1}` gives (1, 0.5, 0.5, −0.5); `\frac{z-1}{2z+4}` gives
  (0.25, −0.25, 0.5, 1)). Scale the matrix by the smallest integer m ≤ 64 that makes every entry a Gaussian integer:
  (2, 1, 1, −1) and (1, −1, 2, 4), the typed coefficients. If there is no such m, fall back to the rules above;
- the cut of a log, root or complex power is the palette's default, 180°, as for the formula.

**Verified one-step queries** (v15.1 reader): `sin z`, `\sin z`, `sin(z)`, `tg z` → Sine/Tangent; `e^z`, `exp z` →
Exponential; `log z`, `ln z` → Logarithm; `sqrt z`, `z^{1/2}`, `z^{0.5}` → n-th root (n = 2); `\sqrt[3]{z}` → n = 3;
`z^3` → Integer power; `z^{i}` → Complex power (α = i); `1/z`, `z^{-1}` → Inversion; `2z+1`, `\frac{z}{2}+1` → Affine;
`-z`, `iz`, `z/2`, `(1+i)z` → Multiply by c; `(z-1)/(z+1)`, `\frac{2z+1}{z-1}` → Möbius; `conj z`, `\bar z`,
`\overline{z}` → Conjugation; `\cosh z`, `sh z`, `\arcsin z` → their steps; `\frac12(z+1/z)` → Joukowski.

**Not one step**, which corrects the task's list: `z+1/z` is Joukowski → Multiply by 2, because the catalog Joukowski
is ½(z + 1/z). The same holds for `2\sin z`, `\sin(2z)`, `z^2-1` and `e^{iz}` (two steps each). They get the
several-steps rows. They must never be "rounded" to Joukowski or Sine.

**Several steps.** Row 1: Custom formula, unchanged (desc "Adds this formula as a step"). Row 2: **Add as 3 steps**.
Its TeX is the formula and its description is the names ("Integer power → Translation → Sine"). When row 2 is
selected, the preview caption shows the derivation on one line (`z ↦ z² ↦ z²+1 ↦ sin(z²+1)`). Running it inserts the
n steps as one commit. Partial readings and readings with inexact parameters get row 1 only.

Typing in the palette only changes its list. That is what a search does, so "never under the fingers" is kept.

## 3. Typing into a formula step that is already in the chain: no automatic conversion

The formula step is never turned into a catalog step on its own, neither while typing nor on Enter or blur. The
reasons:
1. **Under the fingers.** The field belongs to the formula card. A conversion replaces the card's fields (Sine has
   none, Möbius has four), moves the focus and swallows the next keystroke. Even on blur, a user who clicks back to fix
   a typo would find a different editor.
2. **Intent.** In the search the query *is* a request: the best match is the answer. In a formula field the user has
   already chosen "formula", and the text is often on its way somewhere else (`sin z` on the way to `sin z + z/2`).
3. **Nothing is lost by waiting.** The recognized formula already renders, deforms, lights its lamps and draws its
   cuts as the catalog step (v15.1). Only the card's name and the fields differ.
4. **Undo.** An automatic conversion would make one edit into two changes (the text and the type), and one Undo would
   not give back what the user typed.

What happens instead: the same offer as in §4, in its one-step form ("This is the Sine step." with **Replace with the
Sine step**). It is shown **only while the formula field does not have the focus**. While typing, the one-line note
updates as it does today, so no button comes and goes under the cursor. The offer is based on the reading at generic
values of the shared numbers (the tape), so it does not flicker while a slider moves either.

## 4. The offer

### 4.1 Desktop: the Inspector (the formula step selected)

It sits where today's note is, under the formula and its fields:

```
 f₁  ƒ  Custom formula                                 ⌕  ⋯
 w₁ = sin(z² + 1)
 [ \sin(z^2+1)                                   ]  cut 180°
 log, √ and powers use arg ∈ (−180°, 180°].
 ▾ Built from 3 steps
     z
     ↦ z²                 Integer power
     ↦ z² + 1             Translation
     ↦ sin(z² + 1)        Sine
   As separate steps, each gets its own card and picture,
   and the deformation plays them one by one.
   [ Split into 3 steps ]
```

- **Rows.** Each row is typeset with the app's TeX at the size of the F Inspector's w list (`.wl`). The step name is in
  `--ink-2`, 12 px, at the right. When the formula needs more than 60 % of the column, the name wraps under the formula
  (a CSS grid with wrap). Long formulas shrink with `fitPick`, never cut.
- **Rows are what the split will produce (WYSIWYG).** Row k is the composition of the new steps' own TeX, which is
  exactly what the cards, the Inspector and F will show after the split. Where the last row differs from the typed
  formula, it ends with "= *typed*", so the change of spelling is visible before the click:
  `↦ 2 cos z = e^{iz}+e^{−iz}`. This is also where an identity is taught. One function computes the rows and the
  split, so they cannot disagree (a test asserts it).
- **The button** is the Inspector's secondary style (the one used for Add zero / Add pole, smaller), not primary. It
  takes `$tn` plurals.
- **Fold = dismiss.** The block is a `<details>`, open by default. Its folded summary is one line, "Built from 3 steps:
  Integer power → Translation → Sine", which is today's "Same as …" note in other words. The fold state is
  remembered for the viewer as a convenience (one localStorage key in try/catch; without it the fold opens). So a user who
  doesn't want the offer folds it once and is back to v15.1's single line. A per-formula dismissal list was
  considered and dropped: the folded offer costs nothing over today, so per-formula state would buy nothing.
- **The permanent home** is the step's ⋯ menu: **Split into steps**, next to Write by zeros and poles. It is there
  whether or not the fold is open.
- **The one-step form** has no rows: "This is the Sine step." and **Replace with the Sine step**.
- **When not offered** (no reading, partial with nothing to gain, inexact parameters, the exactness gate of §9 fails),
  the note stays exactly as in v15.1 ("Same as …", or nothing).
- Accessibility: the fold is a named region ("Built from 3 steps"). The rows are an `ol`. The button is a real
  `button`, after the fields in the tab order. The rows keep the hidden MathJax copy for screen readers.

### 4.2 The card in the chain bar

The card stays "the type and a picture" (item 16), with one quiet addition. A fully recognized formula of n ≥ 2 steps
shows "Custom formula · 3 steps" as its name («Своя формула · 3 шага»), on the two lines the name already has. Its
tooltip and aria-label give the chain ("Custom formula, built from 3 steps: Integer power → Translation → Sine"). There
is no badge, no button and no colour. If measurement shows that the Russian suffix does not fit two lines of the
narrowest card, it is dropped there and the Inspector carries the information.

### 4.3 Phone

- The Editor sheet hosts the Inspector, so the same fold appears in it, with X | Y side by side above. **Split into
  3 steps** is a full-width 44 px button. Join back is the same.
- The 44 px card shows its name on two lines of 11 px. The "· 3 steps" suffix is measured at 360 and 390 and dropped
  if it clamps.
- ⋯ in the sheet's Inspector head holds Split into steps.
- After the split the chain bar scrolls to the first new card. Undo is the tool row's first key, under the thumb.

## 5. The split

- **One commit.** Step k is replaced by n steps k … k+n−1: catalog types, parameters as text (§2), and every log, root
  and power step on the formula's cut. A partial reading's formula part becomes a Custom formula step whose text is
  that subtree as typed, with z for its input (`e^{\sin z+z}` → Custom formula `\sin z+z`, then Exponential). Bypass
  carries over: a bypassed formula gives n bypassed steps.
- **The pictures do not change.** It is the same function, so X, Y, the Phase and Landscape views, the globes and the
  shapes' images stay pixel-identical. That is the acceptance test (§9). No deformation plays by itself.
- **The chain bar unfolds.** The formula card widens into n cards (220 ms, ease-out; nothing under
  prefers-reduced-motion). The new cards draw their own F_k at once. This is the "lovely moment": the row now *shows*
  the assembly, in the open view.
- **Selection and focus.** The first new step is selected, and the Inspector shows it. If the formula step was shown
  alone, the first new step is shown alone (X = its input, Y = w after it), and the chip's › leads on (§6). Otherwise
  the view stays the whole chain.
- **Toast** (the Undo kind): "Split f₂ into f₂–f₄: Integer power → Translation → Sine." with Undo. One sound cue, the
  existing step-added one.
- **Ordering in the menu.** Split into steps sits next to Write by zeros and poles. It is disabled with a tooltip
  reason when the step has an error.

## 6. After the split: what "all the transforms" looks like

- **The cards** are the filmstrip. Card f₂ shows z², f₃ shows z²+1, f₄ shows sin(z²+1), in X → Y, Phase or Landscape.
  The tour already teaches this ("the row shows how F is built").
- **Each step's own Inspector** gives its own formula (w₃ = w₂ + 1), its own coefficients (c₃ = 1, or c₂ = −a for a
  shared number) and its own seam note.
- **Walk the steps (new, small).** Show a step alone (L, double-click, the lens). The chip in X's head becomes
  "f₃ alone ‹ › ×", where ‹ and › show the previous and next step alone: X is w₂, Y is w₃, then X is w₃, Y is w₄. This
  is the step-through: step k and its image, one at a time. It has explicit buttons in the head strip (not over the
  plane) and no new shortcut. The keyboard reaches them by Tab, and each has a tooltip.
- **The deformation** now gives one time unit per step (t ∈ [0, 3] instead of [0, 1]). The ticks show f₂ f₃ f₄, the
  playing card is highlighted, and "All at once" becomes a real choice across the new steps. Optional and low cost:
  the ticks' tooltips name the step ("f₃ Translation").
- **Captions and export.** The deformation caption becomes the chain caption ("for f₂, …; for f₃, …; for f₄, …") in
  place of "runs its 3 catalog steps in turn, each on an equal part". F is the steps' composition. For an identity
  reading it reads `2\cos z` rather than `e^{iz}+e^{-iz}`, which the "=" row showed before the click.
- **Seams.** Each log, root or power step now has its own seam, in its own input plane. Showing the step alone lets
  you drag it. That is a teaching gain: the cut of `\log\frac{1+z}{1-z}` lives in the w₁ plane.

## 7. The way back

- **Undo** restores the formula step, its selection and its focus in one step. The toast offers Undo for 5 s; ⌘Z
  (Ctrl+Z) works afterwards, and so does the phone's Undo key.
- **Join back into one formula.** While steps k … k+n−1 are *exactly* what the split wrote (type, parameter text, on),
  each of them shows one quiet line in its Inspector: "f₂–f₄ came from the formula sin(z²+1). Join back into one
  formula". The check is stateless: the split keeps a record {formula text, cut, the n steps it wrote}, and the line
  is shown only while those steps deep-equal the record. Any edit, move or removal makes the line disappear. Nothing
  needs to track edits. The record lives in memory and in the saved session. A shared link may drop it, and then only
  Undo remains. Join back is one commit with its own Undo toast ("f₂–f₄ are one formula again.").

## 8. The examples

The readings come from the v15.1 reader at cut 180°. The rows are as §4.1 would show them, given §2's parameter text.

| typed | reading | offer and rows | search (palette) | notes |
|---|---|---|---|---|
| `\sin(z^2+1)` | pown 2 → add 1 → sin | Built from 3 steps: z ↦ z² (Integer power) ↦ z²+1 (Translation) ↦ sin(z²+1) (Sine) | Custom formula; Add as 3 steps | After the split F reads `\sin(z^2+1)`, as typed |
| `\frac{2z+1}{z-1}` | one Möbius | "This is the Möbius step." Replace with the Möbius step | **Möbius first**, a = 2, b = 1, c = 1, d = −1; Custom formula second | Needs the Möbius rescale (the reader gives 1, 0.5, 0.5, −0.5) |
| `e^{iz}+e^{-iz}` | cos → mul 2 (one group, an identity) | z ↦ cos z (Cosine) ↦ 2 cos z = e^{iz}+e^{−iz} (Scaling) | Custom formula; Add as 2 steps | The "=" teaches the identity; after the split F reads 2 cos z |
| `z^{i}` | powa α = i | "This is the Complex power step." Replace with the Complex power step | **Complex power first**, α = i | The user's original z^{i} case: now one Enter away in the search |
| `(z-a)^3`, a shared | add −a → pown 3 | z ↦ z − a (Translation) ↦ (z − a)³ (Integer power) | Custom formula; Add as 2 steps | c₁ is written `-a`, so the slider moves the split chain. The reader must hand out that text. The offer follows the generic reading, so it does not flicker at a = 0 |
| `\sqrt{1-z^2}` | pown 2 → affine (−1, 1) → root 2 | z ↦ z² ↦ −z²+1 ↦ √(−z²+1) = √(1−z²) | Custom formula; Add as 3 steps | Today's Affine TeX writes −w+1, hence the "="; see §10 polish |
| `\log\frac{1+z}{1-z}` | Möbius (1, 1, −1, 1) → log | z ↦ (z+1)/(−z+1) (Möbius) ↦ log((z+1)/(−z+1)) = log((1+z)/(1−z)) (Logarithm) | Custom formula; Add as 2 steps | The log's seam now lives in the w₁ plane: show f₂ alone to drag it |
| `z^2+\sin z` | none | nothing: no fold, no line | Custom formula only | A sum of two functions of z is not a chain. The guide says so; the app does not nag |
| `\frac{1}{z}+z` | joukowski → mul 2 | z ↦ ½(z+1/z) (Joukowski) ↦ 2(½(z+1/z)) = 1/z + z (Scaling) | Custom formula; Add as 2 steps | **Not** one Joukowski step: the catalog's is ½(z+1/z) |

More cases from the experiments:
- `e^{\sin z+z}` (partial): Custom formula `\sin z+z` → Exponential. Offered, and the part keeps its text.
- `\frac{1}{1+e^{-z}}`: −z → e^{−z} → Möbius (0, 1, 1, 1). Today the Möbius TeX prints `0\,w+1`, a defect that must
  be fixed before this split is offered (§10).
- `\frac{(z-1)(z+2)}{z-3}`: Affine (0.3162…, −0.9487…) → Joukowski → Affine (6.3246…, 7). **Not offered:** the
  parameters have no exact text. The note stays "Same as …", and ⋯ → Write by zeros and poles is the better rewrite.

## 9. What to refuse, and why

| refused | why |
|---|---|
| Converting a formula step by itself (while typing, or on Enter or blur) | §3: it changes a card under the fingers, it ignores the user's choice of "formula", it gains nothing (the reading already renders as the step), and it makes Undo confusing |
| A pop-up, banner, toast or coach mark offering the split | Nothing covers the work area uninvited (the "No shapes yet" lesson). The Inspector is where the selected step's information lives. The only toast is the Undo toast after the user's own click, as for Write by zeros and poles |
| Enter in the search splitting a formula of several steps | The user typed a formula, so Enter adds that formula. The split is row 2, one ↓ away |
| Rounding a near match to one step (`z+1/z` → Joukowski) | It is a different function. The app is exact |
| Containers (Polynomial, Rational, Zeros and poles) as the "one simple function" | Their fields are the formula's coefficients, so the typed text is clearer. Write by zeros and poles already exists |
| Splitting with inexact parameters (0.316227766…) | "Exact, article-grade": a field never gets a rounded number. The reading may still be used to draw |
| A split that loses a shared-number link | "Change a once, everything moves" must survive. A parameter that cannot be written over the shared numbers means no offer |
| A split that is not the formula's own values | Gate: the split chain, as plain catalog steps, must give the formula's values on the t_recognize probe set (cut points, ±0, poles), and the views must be pixel-identical (0 px at 8/255, as for z^{i}). Identity readings change only the spelling, which the "=" row shows. A difference on a cut ray (raw θ beyond (−180°, 180°], verify-1) means no offer |
| A granularity choice (Möbius into translate / invert / scale, polynomials into factors) | The user said keep it simple. The catalog's step is the unit, one reading and one button. This could come back later as "Split this Möbius" if asked |
| A general "Join steps into one formula" | Steps can carry different cuts, but a formula has one. Shared numbers and exactness would need their own proofs. Only an untouched split run can be joined back, and that is exact by construction |
| Previewing the stages on the planes when a row is hovered | It changes the main view uninvited, and it may compile a GPU program per hover. The split is one click and undoable, and after it the cards, the alone walk and the deformation show every stage |
| Auto-playing the deformation after the split | Uninvited motion over the work area. M plays it, now step by step |

## 10. Guide, tour, wording

**Guide** (the chain section, next to the paragraph about custom formulas):
- EN: "A typed formula that is a chain of catalog steps, such as $\sin(z^2+1)$, shows in the Inspector how it is
  built: $z\mapsto z^2\mapsto z^2+1\mapsto \sin(z^2+1)$. **Split into steps** turns it into those steps, each with its
  own card and picture. Undo, or **Join back into one formula**, returns it. A sum or a product of two functions of $z$,
  such as $z^2+\sin z$, is not a chain and stays one step. In the search, a formula that is one catalog function, such
  as sin z or z^i, adds that function directly."
- RU: «Если введённая формула — цепочка шагов каталога, например $\sin(z^2+1)$, инспектор показывает, из чего она
  составлена: $z\mapsto z^2\mapsto z^2+1\mapsto \sin(z^2+1)$. Пункт **Разбить на шаги** превращает её в эти шаги, у
  каждого своя карточка и картинка; «Отменить» или **Снова собрать в одну формулу** возвращает формулу. Сумма или
  произведение двух функций от $z$, например $z^2+\sin z$, — не цепочка: такая формула остаётся одним шагом. В поиске
  формула, которая совпадает с одной функцией каталога, например sin z или z^i, сразу добавляет эту функцию.»

**Tour:** one new stop in "Editing the chain" after `inspector` (rev 2 → 3). Scene: the chain is one Custom formula
`\sin(z^2+1)`, selected, the panel open. Anchor: the fold.
- Title: "A formula in steps" / «Формула по шагам».
- Body: "This formula is a chain of catalog steps, and the Inspector shows how it is built. Split it, and each step
  gets its own card: the row then shows every transform in turn, and the deformation plays them one by one. Undo
  brings the formula back." / «Эта формула — цепочка шагов каталога, и инспектор показывает, из чего она составлена.
  Разбейте её, и у каждого шага появится своя карточка: ряд карточек покажет все преобразования по очереди, а
  деформация пройдёт их одно за другим. «Отменить» вернёт формулу.»
- Try: "Press Split into 3 steps." / «Нажмите «Разбить на 3 шага».» (event `formula-split`).
- The `keys` stop gains half a sentence: "… to add it as a step; one that is a catalog function, such as $\sin z$,
  adds that function." / «…; формула, совпадающая с функцией каталога, например $\sin z$, добавляет саму эту функцию.»

**Strings** for `notes/i18n/ru/v152-split.json`. Counts use `$tn` (шаг / шага / шагов). Quotes are «ёлочки». In-text
«инспектор» is lower case. Verbs follow «Заменить обратной».

| key | English | Russian |
|---|---|---|
| split.built | Built from {n} steps | Составлена из {n} шагов |
| split.builtChain (folded summary) | Built from {n} steps: {chain} | Составлена из {n} шагов: {chain} |
| split.why | As separate steps, each gets its own card and picture, and the deformation plays them one by one. | Отдельными шагами: у каждого своя карточка и картинка, а деформация проходит их по очереди. |
| split.btn | Split into {n} steps | Разбить на {n} шага / шагов |
| split.menu | Split into steps | Разбить на шаги |
| split.one | This is the {name} step. | Это шаг «{name}». |
| split.oneBtn | Replace with the {name} step | Заменить шагом «{name}» |
| split.toast | Split f{k} into f{k}–f{k2}: {chain}. | Шаг f{k} разбит на шаги f{k}–f{k2}: {chain}. |
| split.oneToast | f{k} is now the {name} step. | Шаг f{k} заменён шагом «{name}». |
| split.from | f{a}–f{b} came from the formula {f}. | Шаги f{a}–f{b} получены из формулы {f}. |
| split.join | Join back into one formula | Снова собрать в одну формулу |
| split.joinToast | f{a}–f{b} are one formula again. | Шаги f{a}–f{b} снова собраны в одну формулу. |
| split.disabled | This step has an error. | В этом шаге ошибка. |
| pal.asSteps | Add as {n} steps | Добавить как {n} шага / шагов |
| card.nSteps | {name} · {n} steps | {name} · {n} шага / шагов |
| card.nStepsTip | Custom formula, built from {n} steps: {chain} | Своя формула из {n} шагов: {chain} |
| alone.prev / alone.next | Show the previous step alone / Show the next step alone | Показать отдельно предыдущий шаг / Показать отдельно следующий шаг |
| tick.tip (optional) | f{k} {name} | f{k} {name} |

The chain lists use `recLabel` names (Translation, Scaling, Square root), so they carry no parameter letters. "Same as
{chain}" and "Partly the same as {chain}" stay for readings without an offer. Regenerate the table with
`python3 tools/make_ru_table.py --strict`, with 0 unresolved.

## 11. Risks and checks

1. **Exactness (the main one).** After the split, the steps are plain catalog steps, without the formula's
   `Expr.compile` replay. Signed zeros on a cut, a raw cut angle beyond (−180°, 180°], or an overflow identity (math-4)
   can differ. The gate of §9, together with the pixel test (X, Y, Phase and Landscape before and after the split,
   0 px at 8/255, light and dark), decides each offer. The test corpus is the recognizer's (230 spellings, 3 cuts plus
   the verifier's cuts).
2. **Cuts drawn in X.** The formula step draws a cut carried back through affine pre-steps (`\log(2z+1)`). Check
   that the split catalog chain draws the same cut in X in the whole-chain view. If it does not, that is a visible
   loss, and the offer must wait for the fix.
3. **Shared numbers.** The parameter text must come from the formula's constant subtrees (`-a`), and the reader
   hands out values only today. Test: split `(z-a)^3`, then drag a. The chain follows, with one GPU program.
4. **TeX of catalog steps.** WYSIWYG exposes ugly spellings. One is a defect that must be fixed before offering the
   split: Möbius with a zero coefficient (`0\,w+1`). Others are optional polish: Affine a = −1 → `1 − w`, Multiply by
   1/2 → `\tfrac{w}{2}`, and `2(\tfrac12(…))`. Each polish changes the TeX of existing chains too, so check every
   caption and LaTeX golden before taking it (no golden may change).
5. **Deformation semantics change on split.** Time goes from 1 to n. "All at once" now runs the n steps together
   (before, it ran the formula's steps in turn). The caption changes. All of this is intended, and the guide sentence
   covers it.
6. **Perf.** A split builds n card thumbnails and may compile new programs: a one-off cost, measured on the split
   frame. Steady frames are the catalog chain's (60 fps, BUDGET60). Typing in the search: reuse the custom build's
   `b.rec`, so there is no second reading (the reader is cached; the slowest input handler was 2.5 ms).
7. **Layout.** The fold in the 262 px column, in English and Russian, at 768, 1024, 1280 and 1440, and on the phone
   at 360 and 390, light and dark. The card suffix must fit two lines or be dropped. Reduced motion: no unfold
   animation.
8. **No flicker.** The offer hides while the formula field has the focus, and it follows the generic reading while a
   slider moves. Test: type `\sin(z^2+1)` key by key; the block must not appear until blur.
9. **Undo and Join back.** Undo restores selection and focus. The Join back record deep-equals the steps. Saved
   sessions round-trip, and links may drop the record.
10. **Tour and i18n.** The new stop's anchor exists on desktop and phone. `t_tour` passes. Every new string goes
    through `$t`/`$tn`, with both languages in v152-split.json.

## 12. Order (if all three designs agree)

1. The search rule (§2): small, self-contained, and the user's most direct ask. It needs the reader's parameter text
   and the Möbius rescale.
2. Split, Undo and the Inspector fold (§4.1, §5, §7 Undo), behind the exactness gate.
3. The card suffix, the phone checks, Join back, the alone chip's ‹ ›, the guide and the tour stop.

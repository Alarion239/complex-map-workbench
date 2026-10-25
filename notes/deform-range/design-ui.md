# Deforming part of the chain: the interface (design)

Interface design, 2026-10-24. Built on the v15.1 code in `work/xv152-merged-snap/src` (the deformation and paths
merged, the recognizer merged), with formula-steps/DESIGN.md, sound/AS-BUILT-v152.md, paths-aesthetics/AS-BUILT.md
and constructions-v16/SPEC.md in mind.

The user, 2026-10-24: "Yes, i feel like it would be nice if we could choose from where to where we want to see the
deformation. So for example if F = f1 ∘ f2 ∘ f3, then we can see how (f1∘f2) transforms f3(image) and how f2∘f3
transforms under f1."

The user numbers from the outside (f3 acts first). The app numbers from the inside: f₁ acts first and
F = fₙ ∘ … ∘ f₁. All text below uses the app's numbering. The user's two cases, for a chain f₁ f₂ f₃:

- "(f1∘f2) transforms f3(image)": the steps f₂–f₃ deform the image f₁(X). This is a push-forward. f₁ is applied first,
  in full: H_t = G_t ∘ f₁.
- "f2∘f3 transforms under f1": the steps f₁–f₂ deform under f₃. This is a pull-back. f₃ is applied last, in full:
  H_t = f₃ ∘ G_t.
- The opening question, "from f(z) to f(√z)": in the chain √ then f, deform f₁ = √ only. Then H_t = f₂ ∘ G_t runs from
  f₂(z) to f₂(√z).

## 0. Decisions in short

1. **One new setting: a bracket over the cards.** The bracket is a contiguous run of steps a…b. The steps before it
   act first and in full (pre); the steps after it act last and in full (post).
   H_t = post ∘ G_t ∘ pre, where G_t is today's deformation of the bracketed steps (one after another, or all at
   once). H_t runs from post ∘ pre at t = 0 to F at the end.
2. **Today is the default.** No bracket stored means every step is bracketed, and the app behaves exactly as v15.1.
   A step shown alone still deforms alone, in its own planes. The bracket is hidden then and comes back when the whole
   chain does.
3. **The bracket is drawn only while the deformation is open, at the whole chain, with two or more active steps.**
   It is drawn in the chain bar, never over the planes. With every step bracketed it is the only new mark, and it
   tells the user that the ends can be moved.
4. **Four ways to set it, one meaning:**
   - drag either end of the bracket (desktop and tablet);
   - the card's ⋯ → **Deformation** submenu, with three ready choices for that card (all platforms, the phone
     included);
   - the keys **[** and **]** on a card that has keyboard focus, and the bracket ends as sliders;
   - on the phone, two selects in the Display sheet, beside the order select that is already there.
5. **The picture says where it starts.** The merged plane's title becomes "start → w", for example f₃(w₁) → w. The
   start is drawn as a focused step's start is today: an outline, with no grey tint. The tint stays only when the start
   is X itself. The transport shows the fixed steps on both sides of the scrubber, as "f₁ →" and "→ f₄".
6. **Saved like All at once.** The bracket goes into the local save, links and scenes. Undo entries remember it
   beside the focus, so undoing a chain edit also restores the bracket. Changing the bracket is not an undo step.
7. **No toast, no auto-play and no pop-up comes with the feature.** A change of the bracket restarts the deformation at
   t = 0, as a new focus does. If it was playing, it plays on.

## 1. The model

- `S.homRange`: absent (every step) or `{a, b}`, 1-based step indices with 1 ≤ a ≤ b ≤ n. It applies only at focus 0.
- **Normal form.** The setting is dropped (every step) when:
  - the bracket holds every active step (the steps outside are all bypassed); or
  - the bracket holds no active step.

  As a result, a link made today and a link made with every step bracketed are the same link.
- **Bypassed steps** may sit inside or outside the bracket. They are the identity, as today.
- **d/dz rule.** A d/dz differentiates the whole chain before it, so it cannot act after a deformation. Hence
  b ≥ the index of the last active d/dz.
  - A d/dz inside the bracket deforms along its straight line, as today, and forces One after another.
  - A d/dz before the bracket is a fixed map.
- **The time:**
  - t runs over [0, m] for the m active bracketed steps one after another, or over [0, 1] all at once (All at once
    needs two or more bracketed steps and no d/dz, as today);
  - at t = 0, H₀ = post ∘ pre; at the end, H = F;
  - closing the deformation shows F, as today.

## 2. The bracket in the chain bar

### 2.1 Look (all widths)

The bracket is an over-bracket, like `\overbracket` in a formula.

- **The line.** A horizontal 1.5 px line runs above the bracketed cards, in the chain's top padding (y = 3 px;
  desktop padding 8 px, phone gap 6 px).
- **The ends.** The line turns down into the two connectors that bound the run: the connector before card a (it
  carries w_{a−1}) and the connector after card b. Each drop is centred in its connector and stops above the
  connector's w-label: 20 px in Pictures, 10 px in Names, 14 px on the phone.
- **Colour.** At rest the bracket is `--ink-2`. When an end is hovered, focused or dragged, that end and the line turn
  `--accent` and become 2 px wide. Both tokens already work in light and dark.
- **Crisp lines.** The bracket is built from whole CSS pixels, so the lines stay sharp at dpr 1, 2 and 3. It does not
  cover the card heads, the cards' focus rings or the connector arrows.
- **Motion.** The bracket fades in with the transport (120 ms) and slides between connectors in 120 ms, ease-out.
  Under `prefers-reduced-motion` there is no motion.
- **No marks on the cards themselves.** The selected card and the playing card keep their accent outlines. The
  bracket stays out of the cards, so the three never mix.
- **Cards outside the bracket** show their normal picture (their step at t = 1 over its start) and no t label.
- **Cards inside the bracket** behave as today: own t and grey start, or cumulative when all at once. The playing
  highlight moves only inside the bracket.

### 2.2 Dragging (desktop and tablet)

- **The handles.** While the bracket shows, its two connectors are handles across their full height.
  - The connector's insert "+" steps aside at those two connectors only. Insert stays at every other connector and in
    ⋯ → Insert a function after it.
  - Card drags onto connectors (reorder) are unchanged, because they are HTML drag events.
- **Feedback.** The cursor is `ew-resize`.
  - Left end tooltip: "Drag to choose the first deformed step".
  - Right end tooltip: "Drag to choose the last deformed step".
- **The drag.**
  - The end follows the pointer and snaps to the nearest connector once the pointer passes a card's middle.
  - An end stops at the other end, so the bracket always holds at least one step. It also stops at the chain's ends
    (between the region card and f₁, and between fₙ and the add card).
  - The right end will not pass left of a d/dz. At that stop its tooltip gives the d/dz reason (§9, string 13).
  - While dragging, playback holds and the planes show **t = 0 of the candidate bracket**, so the user sees the start
    move, card by card. That is a uniform change only (§11), so it stays at 60 fps.
- **Release** keeps the new bracket at t = 0. A deformation that was playing plays it from there. Each snap plays
  the existing `snap` cue, under the Interface sounds switch.
- **Esc** during a drag puts the bracket back as it was.
- **Touch on a tablet** drags the same way. The 16 px connectors are narrow but tall (134 px). The ⋯ menu is the
  equivalent control that meets target-size rules (WCAG 2.5.8 exception).

### 2.3 Keyboard

- **The ends are sliders.** They are two real elements over the two connectors, because the connectors themselves are
  `aria-hidden`.
  - Each has `role="slider"` and is a tab stop after the cards.
  - Left: aria-label "First deformed step", aria-valuetext "f₂".
  - Right: aria-label "Last deformed step".
  - ←/→ move an end by one step, Home/End to the chain's ends, with the same stops as dragging.
- **[ and ] on a focused card** (chainKey, only while the bracket shows):
  - **[** puts the left end before this card;
  - **]** puts the right end after this card.
  - If the other end is in the way, it moves too (a = b = this card).
  - Elsewhere, and when the bracket does not show, [ and ] keep toggling the panels.
  - On ЙЦУКЕН they are the physical keys х and ъ, through `I18N.keyOf` as today.

## 3. The ⋯ menu and the palette

**The ⋯ menu.** The card's ⋯ menu and the Inspector's full ⋯ menu get one submenu, **Deformation ▸**, after
"Insert d/dz after it". It is hidden when the chain has fewer than two active steps.

- Its items are **states** for this card k (radio items). The current state is checked.
- The key slot at the right says where the deformation will start (the title's start, §5).

For chain f₁ f₂ f₃ f₄, from card f₂:

```
Deformation ▸
  ○ Only f₂, inside F          from (f₄∘f₃)(w₁)
  ○ Steps f₂–f₄                from w₁
  ○ Steps f₁–f₂                from (f₄∘f₃)(z)
  ● Every step                 from z
```

- **Dedupe:** an item equal to another (on card 1, "Steps f₁–f₄" is Every step) is left out.
  - On f₁ the menu holds Only f₁, inside F and Every step.
  - On fₙ it holds Only fₙ, inside F and Every step.
- **Disabled items** say why in their tooltip: the d/dz rule; a bypassed card ("Turn this step back on first").
- **When the deformation is closed,** choosing an item opens it with that bracket and plays it (a paused start under
  reduced motion).
- **When a step is shown alone,** choosing an item first shows the whole chain (the alone chip goes).
- **"Only f₂, inside F" vs Show alone.** The words "inside F" separate it from Show alone ("f₂ alone"): a step shown
  alone deforms in its own planes, w₁ → w₂.
- **The user's two cases,** for the chain f₁ f₂ f₃:
  - push-forward of f₁(X): f₂'s ⋯ → Steps f₂–f₃;
  - pull-back under f₃: f₂'s ⋯ → Steps f₁–f₂.

**The palette** gets the same four commands for the selected step (S.sel, else the last step):

- "Deformation: only f₂, inside F"
- "Deformation: steps f₂–f₄"
- "Deformation: steps f₁–f₂"
- "Deformation: every step"

Search aliases: part, range, bracket, pull-back, pullback, precompose, push-forward, inside, under, outer, inner.

## 4. The transport

- **Unchanged parts:** play, the scrubber, t = … / m, speed, order (for two or more bracketed steps), Loop, Paths and ×.
  The ticks name only the bracketed steps, as `morphRange()` already does.
- **New: the fixed steps on both sides of the scrubber**, only while something is outside the bracket.
  - Before the scrubber: "f₁ →". After it: "→ f₄". Each is a label in the ticks' type: italic math, 11 px, `--ink-2`.
  - Two or more fixed steps read "f₁–f₂ →". The pre run is always f₁…f_{a−1} and the post run f_{b+1}…fₙ.
  - They sit inside `.tscrub`, so they wrap with it on narrow panes (< 560 px).
  - They are plain labels, not buttons. Their tooltip is "f₁ is applied first, in full" or "f₄ is applied last, in
    full".
  - The transport's aria-description says "Deforming steps f₂–f₃. f₁ is applied first and f₄ last, in full."
- With every step bracketed, the transport looks exactly like v15.1.

## 5. The planes

**Title of the merged plane and the merged globe** (X → Y): the math part is `start → w`, and the role stays
"deformation".

- start = post(w_{a−1}), with w₀ = z. Bypassed steps are left out of the composition. A run of three or more is
  written f₆ ∘ ⋯ ∘ f₄.

| bracket (chain f₁ f₂ f₃) | title | H_t |
|---|---|---|
| every step (today) | z → w | G_t |
| f₂–f₃ | w₁ → w | G_t ∘ f₁ |
| f₁–f₂ | f₃(z) → w | f₃ ∘ G_t |
| f₂ only | f₃(w₁) → w | f₃ ∘ G_t ∘ f₁ |
| f₁ only | (f₃ ∘ f₂)(z) → w | f₃ ∘ f₂ ∘ G_t |

- This is the same form as a focused step's "w₁ → w₂", and it uses no words, so English and Russian share it.
- The phone's title chip, which is set in CSS today (`"z \2192  w"`), takes the same text from a data attribute.
- **Phase and Landscape:** "phase of H_t" and "landscape of …H_t" are unchanged. They paint H_t = post ∘ G_t ∘ pre
  over the z-plane.

**The start.** When the start is not X:

- X's grey tint is not drawn (X is not part of this homotopy);
- X's outline carried by post ∘ pre is drawn in faint ink, dashed where the set is open. This is today's focused-step
  start (`drawMorphOutline` with Fbase = post ∘ pre);
- the end F(X) stays dotted while t < end, as today;
- with no pre and no post, the tint and the outline are exactly today's.

**The paths:**

- they run from H₀(z) = (post ∘ pre)(z) (ring) to F(z) (dot);
- seeds are still chosen on X's boundary and inside X, in z;
- all of AS-BUILT's spacing rules apply to the drawn paths.

**Point labels** count the steps applied: |pre| + the bracketed steps begun + |post|.

**View memory:** the deformation's own view key (`defKey`) includes the bracket. Its first fit frames the start
and F(X).

## 6. The phone (Android Chrome, 360–430 px)

- **The bracket is drawn and not dragged.** On the phone it sits in the chain bar's 6 px top gap and the 12 px
  connectors, with `pointer-events: none`.
  - 12 px is too narrow to grab.
  - A drag there would fight the chain's horizontal scroll and the card taps.
  - The chain bar sits right above the transport row, so the bracket reads next to the scrubber.
- **Setting it:**
  - **Display sheet** (the plane's sliders button). While the deformation shows, this sheet already hosts the order
    select and Loop. It gets one more row: **Deformed steps [f₁ ▾]–[f₃ ▾]**. These are two native selects: one
    lists the possible first steps, the other the possible last steps. Disallowed choices are disabled, with the d/dz
    reason in the row's note. Moving one past the other moves both. The row is full width, and the selects are 44 px
    tall.
  - **Editor sheet** (tap a card): ⋯ → Deformation ▸, as on desktop.
- **The transport row** gets the fixed-step labels only when the slider keeps ≥ 120 px (it usually does on 390 px,
  not always on 360 px). Otherwise they are left out, and the bracket just above says the same.
- **Measured before shipping:**
  - the Display row at 360 px in Russian: «Деформируемые шаги» wraps above the selects, not beside them;
  - the submenu flip at 360 px.

## 7. A step shown alone

- With S.focus = k, the deformation is step k alone, in its own planes: w_{k−1} → w_k, as today.
- The bracket and the fixed-step labels are hidden, and the bracket setting waits. "Show the whole chain" brings it
  back.
- Double-clicking a card, L, and the alone chip's × behave exactly as today.

## 8. Saving, links, undo, chain edits

- **Local save, links (`figureState`) and scenes** carry `S.homRange` as part of S. A link opens with its bracket,
  and with its t through `figMorph`, as today.
- **`sanitizeState`** keeps `{a, b}` only if:
  - a and b are integers with 1 ≤ a ≤ b ≤ steps.length;
  - the result is not already "every step";
  - it obeys the d/dz rule.

  Otherwise the setting is dropped.
- A v15.1 build opening a v15.2 link shows the whole-chain deformation.
- **Examples and tour scenes** start with every step unless the scene says `range`.
- **Undo:**
  - entries become `{s, focus, range}`, noted at the start of every input as the focus is (`noteFocus`);
  - undoing a removal that shrank the bracket gives the bracket back;
  - moving the bracket is not an undo step, as Show alone and All at once are not.
- **Chain edits remap the bracket by the steps it holds:**
  - **insert** inside the bracket: the new step joins it;
  - **insert** before or after it: the indices shift;
  - an end that sits at the chain's end stays there, so a bracket "f₂ to the last step" takes a newly appended step;
  - **remove** a step: the bracket shrinks. If no active step is left, every step;
  - **move** a step (⋯ Move left or right, or a drag): the bracket follows its steps while they stay contiguous.
    Otherwise it becomes their span;
  - **split a formula** (formula-steps §7): the formula's bracket position becomes its n steps;
  - **v16** steps get uids (constructions SPEC §1.2). Then store `{ua, ub}`, keep `{a, b}` as the fallback, and
    let the uids do this remapping.

## 9. Export and sound

- **The figure and the video** follow the screen: start outline, paths, title.
- **The caption** (morphCaption) changes in three places, and only when something is outside the bracket:
  - **head:** "The image of X under f₃ ∘ f₁ (outlined)" in place of the set itself.
    RU «Образ X при отображении f₃ ∘ f₁ (контур)».
  - **homotopy:** "the homotopy H_t = f₃ ∘ G_t ∘ f₁, 0 ≤ t ≤ m, where G_t is …". Today's phrase for the bracketed
    steps follows, with H renamed G. RU «гомотопия …, где G_t — …».
  - **paths:** "from (f₃ ∘ f₁)(z) (circle) to F(z) (dot)".
  - The 700-character rule and the Russian notation rules apply, as for every caption.
- **Sound:** no new cue beyond the `snap` while dragging.
  - Hear the function and the deformation's singing loop follow H_t, through `morphState`.
  - The sound keys (`sndFKey`, `sndFrameKey`) include the bracket, so a change is heard as a new function.

## 10. Text: guide, tour, strings

**Guide** (the Deformation paragraph): one sentence is added at its end and one paragraph follows it.

- EN, the end of the paragraph: "A step shown alone deforms in its own planes; to see it deform inside F, bracket
  it (below)."
- EN, the new paragraph: "**Part of the chain.** While the deformation shows the whole chain, a bracket stands over the
  cards. Drag its ends, choose a card's ⋯ → **Deformation**, or press **[** and **]** on a card. The steps before the
  bracket are applied first and in full, and the steps after it last and in full. So H_t = f₃ ∘ G_t ∘ f₁ runs from
  f₃ ∘ f₁ at t = 0 to F at the end, where G_t deforms the bracketed steps. Bracket the last steps to watch them deform
  the image f₁(X) (a push-forward). Bracket the first steps to watch them deform under the last ones (a pull-back:
  for √ then f, bracket √ to go from f(z) to f(√z)). The start is outlined, and the plane's title names it."
- RU: «Шаг, показанный отдельно, деформируется в своих плоскостях; чтобы увидеть его деформацию внутри F, возьмите его
  в скобки (ниже).»
- RU: «**Часть цепочки.** Пока деформация показывает всю цепочку, над карточками стоит скобка. Перетащите её концы,
  выберите в меню ⋯ карточки пункт **Деформация** или нажмите **[** и **]** на карточке. Шаги перед скобкой
  применяются первыми и полностью, шаги после неё — последними и полностью. Поэтому H_t = f₃ ∘ G_t ∘ f₁ идёт от
  f₃ ∘ f₁ при t = 0 до F в конце, где G_t деформирует шаги в скобке. Возьмите в скобку последние шаги — и увидите, как
  они деформируют образ f₁(X). Возьмите первые — и увидите, как они деформируются под действием последних (для √,
  затем f, возьмите в скобку √ и получите путь от f(z) к f(√z)). Начало деформации обведено контуром, а заголовок
  плоскости его называет.»

**Tour.** One stop is added at the end of the Deformation chapter. The chapter's `rev` goes 1 → 2, so the chapter is
marked New. The scene is `strip` (exp, then Möbius).

- id `range`; anchor: the bracket (`.br-end.l`), or the chain on the phone; place top;
  before `[['deform', true], ['range', null]]`.
- Title: "Part of the chain" / «Часть цепочки».
- Body: "Over the cards, a bracket marks the steps that deform. Steps before it are applied first, in full; steps
  after it last. Bracket $f_2$ alone and you watch the Möbius map deform the half-plane $f_1(X)$:
  $H_t=G_t\circ f_1$." / «Скобка над карточками отмечает деформируемые шаги. Шаги перед ней применяются первыми и
  полностью, шаги после неё — последними. Возьмите в скобку только $f_2$, и дробно-линейное отображение будет
  деформировать полуплоскость $f_1(X)$: $H_t=G_t\circ f_1$.»
- Try: "Drag the bracket's left end past $f_1$." / «Перетащите левый конец скобки за $f_1$.»
- Touch: "In $f_2$'s ⋯ menu, choose Deformation, then Only $f_2$, inside $F$." / «В меню ⋯ шага $f_2$ выберите
  «Деформация», затем «Только $f_2$ внутри $F$».»
- Event `deformation-range {a, b}`; the test is a = 2. A new scene key `range` goes in `tourSetLook` / `before`.

**Strings** (new; glossary terms: деформация, шаг, цепочка, «шаги 1–3» with an en dash, «образ», «при отображении»):

| # | English | Russian |
|---|---|---|
| 1 | Deformation (submenu) | Деформация |
| 2 | Only {f}, inside F | Только {f} внутри F |
| 3 | Steps {f1}–{f2} | Шаги {f1}–{f2} |
| 4 | Every step | Все шаги |
| 5 | from {v} (menu key slot) | от {v} |
| 6 | Drag to choose the first deformed step | Перетащите, чтобы выбрать первый деформируемый шаг |
| 7 | Drag to choose the last deformed step | Перетащите, чтобы выбрать последний деформируемый шаг |
| 8 | First deformed step (slider, select) | Первый деформируемый шаг |
| 9 | Last deformed step | Последний деформируемый шаг |
| 10 | {list} is applied first, in full / {list} are applied first, in full | Сначала полностью применяется {list} / Сначала полностью применяются {list} |
| 11 | {list} is applied last, in full / … are … | В конце полностью применяется {list} / … применяются {list} |
| 12 | Deforming step {f}. / Deforming steps {range}. | Деформируется шаг {f}. / Деформируются шаги {range}. |
| 13 | A d/dz differentiates the whole chain before it, so it cannot come after the deformed steps. | d/dz дифференцирует всю цепочку перед ним, поэтому не может стоять после деформируемых шагов. |
| 14 | Turn this step back on first. | Сначала включите этот шаг снова. |
| 15 | Deformed steps (phone Display row) | Деформируемые шаги |
| 16 | Deformation: only {f}, inside F / steps {f1}–{f2} / every step (palette) | Деформация: только {f} внутри F / шаги {f1}–{f2} / все шаги |
| 17 | part range bracket pull-back pullback precompose push-forward inside under outer inner (aliases) | часть скобка диапазон композиция внутри под действием внешний внутренний обратный образ |
| 18 | The image of %{set} under %{G} (caption head) | Образ %{set} при отображении %{G} |
| 19 | the homotopy %{H}, %{range}, where %{Gt} is %{inner} | гомотопия %{H}, %{range}, где %{Gt} — %{inner} |

(10, 11 and 12 use `$tn` for the plural forms. {list} is "f₁" or "f₁–f₂".)

## 11. Notes for the builder (interface-facing only)

- `morphRange()` at focus 0 returns the active steps in [a, b]. `morphState` applies pre (already inside
  `rangeF(pb, k−1)`) and then post.
- **One map field: `post` = b + 1** (0 means none), honoured by modes 1 and 3 on the GPU and by:
  - `cpuMap`, `mapKeyOf` (both copies), `mapFor` and `isIdent`;
  - the exact inverse renderer, the globe, Phase, Landscape and export.
- The start map is `{mode: 1, hi: a, t: 0, post: b + 1}` (H^{(a)}_0 = id), so the start outline needs no new
  program. A bracket change is a uniform change; nothing compiles.
- **The tint condition** becomes "no pre and no post". Today it is `base === 0`, which would wrongly tint X under a
  post-only bracket.
- **Card thumbnails:** `cardT(k)` = 1 outside the bracket, and the t label is hidden there.
- **Point labels:** `morphPrimes` adds |pre| + |post|.
- **Keys:** `defKey`, `sndFKey`, `sndFrameKey` and the paths caches' keys include the bracket.
- **`setFocus` and the bracket:** a bracket change does what `setFocus` does to the deformation (T = 0, seg reset,
  scheduleFix), but keeps the play state.
- **phone.js:** `fillDisplay` moves `.trange` along with the transport's selects and checks.

## 12. Considered and left out

- **Brackets drawn at the cards' sides** ("[" and "]" next to the cards): they collide with the connector arrows and
  the w-labels in 16 px connectors. The over-bracket uses space that is empty today.
- **"Start the deformation at f₂" / "End it at f₂" as menu items.** "Start" reads as t = 0, and two end-moves are
  needed for the common cases. The menu gives states instead. End-moves stay in direct manipulation (drag, [ ],
  selects), where they are natural.
- **A range chip with an × in the transport or in the plane's head:** it repeats what the bracket and the title
  already say. "Every step" is one item away in ⋯ and in the palette.
- **Writing the bracket into the chain header's formula** (F = f₃ ∘ [f₂] ∘ f₁): square brackets in a composition read
  as an operation. The header keeps F.
- **Dragging the bracket on the phone:** see §6.
- **Making the bracket an undo step:** it is a view setting, like Show alone and All at once.

## 13. Acceptance

- **Exactness.**
  - H₀ = post ∘ pre and H_end = F at 400 points, at 1e-12 relative, for the user's two cases and for "f(z) to
    f(√z)" (√ then sin).
  - The GPU frame equals `cpuMap` at t = 0, ½·m and m (0 px at 8/255).
- **Today unchanged.** With no bracket stored, frames, titles, captions and links are byte-identical to v15.1, on the
  8 path scenes.
- **60 fps** while playing a bracketed chain (chain3 with f₂ only; jouk ∘ √). The same holds while dragging an end
  (p95 ≤ 18.4 ms on 1440×900).
- **Remap** for insert, remove, move, split and bypass. Undo restores the bracket after a removal. A link round trip
  works. A v15.1 build opens a v15.2 link.
- **The d/dz rule** in drag, keys, menu and selects.
- **Screens.** Light and dark; EN and RU; 1440×900, 1280×800 (16 px connectors) and 1024×768; Android Chrome
  390×844 and 360×800. Shots: the bracket at rest and hovered, the submenu, the transport labels, the Display row and
  the start outline.

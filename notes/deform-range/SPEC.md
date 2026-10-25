# Deforming part of the chain (v16): build specification

Lead, 2026-10-24. Built on the frozen v15.2 with the constructions (steps carry `uid`) and the Mountain King example
merged. Sources: `design-math.md` and `design-ui.md` (this folder), the node model `scratch-math/rangeModel.js`
(24 bracket and order cases: H₀ = post ∘ pre and H_end = F bit for bit), and the code in `work/xv152-merged-snap/src`.
Line numbers below are from that snapshot. In v16 they have moved, so find the code by function name.

The user writes F = f1 ∘ f2 ∘ f3, with f3 acting first. Here, as in the app, f₁ acts first:
w_k = f_k(w_{k−1}) and F = fₙ ∘ … ∘ f₁.

## 0. In one paragraph

While the deformation is open on the whole chain, the user can choose a contiguous run of steps a…b, called the
**bracket**. The steps before it (the pre, P = f_{a−1} ∘ … ∘ f₁) act first and in full. The steps after it (the
post, Q = fₙ ∘ … ∘ f_{b+1}) act last and in full. The picture shows **H_t = Q ∘ G_t ∘ P**, where G_t is today's
deformation of the bracketed steps (one after another on [0, m], or all at once on [0, 1]). It runs from H₀ = Q ∘ P
to H_end = F, both exact.

The user's cases, for the chain f₁ f₂ f₃:
- **(f1∘f2) transforms f3(image):** bracket f₂–f₃. This is a push-forward of f₁(X): H_t = G_t ∘ f₁.
- **f2∘f3 transforms under f1:** bracket f₁–f₂. This is a pullback under f₃: H_t = f₃ ∘ G_t.
- **"from f(z) to f(√z)":** in the chain √ then f, bracket √ alone: H_t = f ∘ G_t.

With no bracket stored, the app behaves exactly as v15.2 does. A step shown alone still deforms alone, in its own
planes.

## 1. Decisions (where the two designs differ, and why)

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | How the GPU map spec names the post | `post` = the stage the post ends at (n). Mode 1 also carries `b` (design-math). Not `post = b + 1` (design-ui). | Mode 1's `hi` is the running step. The post must start at b, so the bracket's later steps are skipped while a segment runs. Then `chainRange(w, uB, uPost)` is one call. The model caught `top = hi` (0 of 6 twin points agreed). |
| D2 | The start map | `{mode: 1, hi: <first active bracketed step>, t: 0, b, post}` | design-ui's `hi: a` can be a bypassed step. |
| D3 | Exact ends | Every homotopy is the identity at t ≤ 0 and f at t ≥ 1, on the CPU (`homF`) and on the GPU (`uT <= 0.0`). | Gives H₀ = Q ∘ P and H_end = F bit for bit: 24 of 24 cases, against 5 of 24 without the guard. Today's pictures change only by rounding at t = 0. |
| D4 | Seams of pre and post cuts in the merged plane | **Not in this round.** | Today the merged deformation plane draws no cut images for any step. Drawing them for the pre and post only, and not for the bracketed steps (whose cuts move with t), would show half a story. The tear itself is exact in the image. Open item. |
| D5 | Zero and pole tracks in Phase | **Not in this round.** It is the first follow-up, and design-math §5.3 is its spec. | Tracks apply to every deformation, the default one too, so they do not depend on the bracket. They are a large idle job with their own figure grammar. Phase already shows the pulled-back zeros moving. |
| D6 | Path seeds | Spaced at their **starts** H₀(z), not at z (design-math), with the simpler binning of §5.2. Used whenever H₀ ≠ id, **including focus k > 1**. | Today, at focus k > 1, seeds are spaced and clipped as if z were drawn in the merged plane. A seed whose z is off screen is dropped even when its start is on screen. The fix is the same code for brackets and for focus k. |
| D7 | Keys [ and ] on a card | **Dropped.** The bracket ends are sliders (Tab, ←/→, Home/End). | [ and ] already toggle the panels. A meaning that depends on context is a trap. |
| D8 | A d/dz after the bracket (load, chain edits) | Normalise by **moving b** up to the last active d/dz. Interactive controls stop there and say why. | Keeps the user's a. Dropping the whole setting (design-ui) loses more than it must. |
| D9 | How the bracket is stored | `{a, b, ua, ub}`: step uids (v16), with the indices as a fallback. A null uid means "the chain's end". | Insert, remove, move and duplicate need no remapping code. An end at the chain's end takes appended or prepended steps (design-ui §8). |
| D10 | The merged plane's sound probe | With a pre only, the point is read as u ∈ w_{a−1} and plays G_t(u), as focus k does today. With a post, the probe is silent (design-math). | A point of the merged plane is a path start. With a post it has no single source. |
| D11 | Ways to set the bracket | Drag the ends (desktop and tablet). Slider keys. The card's ⋯ → **Deformation ▸** (all platforms). Palette commands. On the phone, two selects in the Display sheet. | The drag is direct. The menu gives the user's cases in one choice. The selects reach any a…b on a phone. |
| D12 | All sheets | Off while the transport is open (today). | The sheets of G_t change with t. |

## 2. The model

### 2.1 State

- `S.homRange`: absent (every step, today) or `{a, b, ua, ub}`.
  - a and b: 1-based, inclusive.
  - ua and ub: the uids of steps a and b, or null when that end sits at the chain's end (a = 1 or b = n).
- The bracket applies only at focus 0. At focus k it is kept, but ignored and hidden.

### 2.2 Resolution: `homRangeOk()` returns {a, b} or null, every time it is read (cheap; cache it per chainSig)

1. Absent, or focus > 0: null.
2. Find each end by its uid:
   - ua null → a = 1; ub null → b = n;
   - a uid that is found → its index;
   - a uid that is missing (that step was removed) → the stored index, clamped to [1, n].
3. If a > b, swap them. This happens when a move carries one end past the other.
4. b = max(b, the last active d/dz). That is the d/dz rule (D8).
5. Return null when the bracket holds no active step, or when every active step is inside it (normal form).
6. Write the result back to S.homRange: a and b, ua = (a === 1 ? null : uid of step a), and
   ub = (b === n ? null : uid of step b). The same rule applies whenever the bracket is set.

When a uid is absent (a state from an older build, or a step without a uid), the stored indices are used. Every
saved state passes `sanitizeState` (§7), so a, b are integers in range.

### 2.3 Terms used below

- lo = a − 1, the stage the bracket starts from.
- The pre P = stage lo as a function of z: `stageF(lo)`. With a d/dz in it, that is the stage's function of z.
- The post Q = `rangeF(b, n)`. It is maps only, by the d/dz rule.
- m = the number of active bracketed steps k₁ < … < k_m.
- "Has pre" = an active step < a. "Has post" = an active step > b.
- H₀ ≠ id exactly when there is a pre or a post (at focus 0), or at focus k > 1 (today's focused start).

### 2.4 Time

- One after another: t ∈ [0, m]. On segment j (j = ⌊t⌋ clamped to m − 1, s = t − j, k = k_{j+1}):
  H_t = Q ∘ h_{k,s} ∘ G_{0→k−1}. The bracketed steps not yet begun are skipped, not applied. The segments meet
  exactly at t = j.
- All at once (two or more bracketed steps, no d/dz in the bracket, `S.homAll`): H_t = Q ∘ h_{k_m,t} ∘ … ∘ h_{k_1,t} ∘ P.
- **A d/dz in the bracket:** its segment is Q applied to the straight line from G_{k−1}(z) to G_k(z). The order is one
  after another, and there are no paths (today's rules, which already read the bracket's steps through
  `morphRange()`).
- **A d/dz in the pre** is a fixed function of z. Paths and All at once stay available.

## 3. CPU

### 3.1 New pure module `src/homrange.js`

The deformation's arithmetic moves out of app.js into a pure UMD module (no DOM), like cx.js. The node tests then
exercise the shipped code. build.py loads it after `funcs.js`; page.html in dev mode loads it the same way.

```js
// HomRange.make(env): env = { n, stepFn(k), isDeriv(k), stepActive(k), stageF(k), rangeF(a, b), built, C }
// returns { range(S), state(S, T, rel, base), cpuMap(map), homF(k, t), H0(S) }
```

- `homF(k, t)` (D3):
  ```js
  const f = env.stepFn(k);
  if (t <= 0) return (z) => z;
  if (t >= 1 && f) return f;
  const b = env.built[k - 1]; if (b && b.hom) return b.hom(t);
  const g = f || ((z) => z);
  return (z) => { const w = g(z); return C((1 - t) * z.re + t * w.re, (1 - t) * z.im + t * w.im); };
  ```
- `range(S)`:
  - focus k: `{lo: k−1, b: k, p1: k, steps: active(k) ? [k] : []}` (today);
  - else, with r = homRangeOk(): `{lo: r ? r.a−1 : 0, b: r ? r.b : n, p1: n, steps: active in (lo, b]}`.
- `state(S, T, rel, base)`: design-math §3's `morphState`, word for word.
  - `pb = base ?? (rel ? leftStage : 0)`.
  - `Q = rangeF(b, p1)` when some step in (b, p1] is live, else null.
  - `wrap(F) = Q ? Q ∘ F : F`.
  - `tag(map)` adds `base` when pb > 0, and `{post: p1, b}` when Q is not null.
  - The key gains `|lo|b|p1`.
  - Returns `{map, F, key, label, H0F, H0Map}`:
    - `H0F = wrap(rangeF(pb, lo))`;
    - `H0Map = tag({mode: 1, hi: steps[0], t: 0})`, or for m = 0 the mode-0 map.
- `cpuMap(map)`: today's, plus the post (design-math §3):
  ```js
  const top = mode === 1 ? (map.b || map.hi) : map.b;
  const post = (map.post || 0) > top ? rangeF(top, map.post) : null;
  ```
- Labels stay in app.js. The module returns `{kind: 'none' | 'all' | 'nat', k, t}`, and app.js turns that into
  `$t(...)`.

### 3.2 app.js glue

- `morphRange()`, `homF`, `morphState(rel)` and `cpuMap` call the module. Their names and signatures are kept, so every
  caller keeps working. `morphState(rel, base)` gains the optional base for the merged sound probe (§9).
- `homView()` adds `range: {a, b} | null` (null at focus k and with no bracket), `H0F`, `H0Map`, and
  `start: true | false` (true when H₀ ≠ id).
- `mapKeyOf(map)` (app.js): append `|${map.post || 0}`, and take chainSig at `max(b, hi, post)`.
- `morphPrimes()`: lo + (bracketed steps begun) + (p1 − b). At focus k and with no bracket this is today's value.
- `cardT(k)`: 1 for a step outside the bracket (at focus 0 with a bracket). Otherwise as today.
- `rangeKey()` = `${a}-${b}` or ''. It is added to `defKey`, `mfScreenKey`, `sndFKey` and `sndFrameKey`. The fix-up
  key already holds `ms.key`.
- `setHomRange(r, {preview})`: the one setter.
  - It writes S.homRange (or deletes it), then normalises (§2.2).
  - It does what `setFocus` does to the deformation: T = 0, `morph.seg = null`, `morph.u = 0`, `scheduleFix()`, a
    re-fit when `rightAuto`, `buildDock()`, `updateBracket()`, `soundFunctionChanged()`, `requestRender('L', 'R')`.
  - It keeps the play state.
  - It calls `save()`, except in preview.
  - It sends `tourEmit('deformation-range', {a, b})`.
  - It is not an undo step.

## 4. GPU

### 4.1 Map spec

- `{mode: 1, hi, t, base?, b?, post?}` = G_{b→post} ∘ h_{hi,t} ∘ G_{base→hi−1}
- `{mode: 3, a, b, t, base?, post?}` = G_{b→post} ∘ h_{b,t} ∘ … ∘ h_{a+1,t} ∘ G_{base→a}
- The post applies only when post > b. Modes 0 and 2 are unchanged. A map without `post` is today's map exactly.

### 4.2 gl.js shader text (MAP_PLAIN and MAP_STAGE)

```glsl
uniform int uMode; uniform int uA; uniform int uB; uniform int uHi; uniform float uT; uniform int uBase; uniform int uPost;
// the steps after the bracket, in full: (uB, uPost]; maps only (the d/dz rule); none when uPost <= uB
vec2 postOf(vec2 w) { return uPost > uB ? chainRange(w, uB, uPost) : w; }
vec2 mapPoint(vec2 s) {
  if (uMode == 1) {
    vec2 z = chainRange(s, uBase, uHi - 1);
    if (chainIsDeriv(uHi)) return postOf(mix(z, chainStage(uHi, s), uT));   // MAP_STAGE only
    return postOf(uT <= 0.0 ? z : chainHom(uHi, z, uT));
  }
  if (uMode == 2) { /* unchanged */ }
  if (uMode == 3) { vec2 z = chainRange(s, uBase, uA); return postOf(uT <= 0.0 ? z : chainHomAll(z, uA, uB, uT)); }
  return chainRange(s, uA, uB);
}
```

- Nothing new compiles per chain: `chainRange` is already in every chain program. A bracket change is a uniform
  change.
- `chainRange(w, uB, uPost)` with uB ≥ 1 is the raw map range. The d/dz rule keeps every d/dz out of it.
- GLSL ES 3.00 evaluates only the chosen operand of `?:`, so the guard costs no homotopy at t = 0.

### 4.3 gl.js plumbing

- `use()`: `u1i(P, 'uPost', m.post || 0)`. Mode 1 also uploads `uB = m.b || 0`, which is already the code path.
- Add `'uPost'` to the uniform-name list (line 2337).
- `mapKeyOf` (gl.js): append `,${m.post || 0}`. Every cacheKey and the landscape heights go through it.
- `isIdent(map)`: `hi = max(mode === 1 ? hi : b, post || 0)`. Without this, a map whose bracketed steps are all off
  but whose post is live would be drawn as the identity.
- `mapFor(map, ch)` (an older program while a chain compiles): when the first changed step p + 1 ≤ `map.post || 0`,
  return `{mode: 0, a: base, b: min(lo, p)}`, with lo = `hi − 1` for mode 1 and `a` for mode 3. The other rules stay.
- `sheetInfo`: mode 0 only, as today.
- New test hook `GLR.evalMap(map, pts)`: a transform-feedback pass (`runTF`) of the points through the vertex
  program's `mapPoint`. It returns Float32 pairs, for §13.3.

### 4.4 Cost

- One after another, segment k: (k − 1 maps) + 1 homotopy + (n − b maps) ≤ (n − 1 maps) + 1 homotopy. That is today's
  last segment of the whole chain.
- All at once: (a − 1) maps + m homotopies + (n − b) maps ≤ today's all at once over n.
- So no frame costs more than one that already ships.

## 5. The views

| View | With a bracket it shows | Reference marks | Changes |
|---|---|---|---|
| X → Y merged plane | H_t(X) in w | H₀(X) outlined; start ghost dashed [4, 3] through `H0Map`; end ghost F(X) dotted [1, 2] while t < end | no tint when H₀ ≠ id; title |
| Paths t ↦ H_t(z) | image side | ring at H₀(z), dot at F(z) | seeds spaced at starts (D6) |
| Phase (plane, sphere) | portrait of H_t over z | X's outline (Outlines on), as today | none |
| Landscape | relief of H_t over z | as today | none |
| Y Sphere (images) | H_t(X) on the w-sphere | gray boundary at t = 0 = H₀(∂X) | the start boundary goes through `H0Map` |
| X Sphere (shapes) | X | unchanged | none |
| All sheets | off while open | as today | none |

### 5.1 The merged plane (`renderMorph`)

- **Image.** `drawScene(pane, ms.map, …)` with the §4 spec. It is exact per pixel through the forward mesh and its
  fix-ups at rest, as today for modes 1 and 3. `arcF: ms.F` and `arcKey` already carry the key.
- **Start.**
  - The tint condition becomes `!hv.start` (H₀ = id). Today it is `base === 0`, which would tint X under a
    post-only bracket.
  - The start outline: `drawMorphOutline(pane, X, hv.start ? hv.H0F : null)`.
  - The start ghost list entry `[base, [4, 3]]` becomes a draw through `hv.H0Map`:
    `GLR.drawLines(..., {map: H0Map, cacheKey: r.lineKey + '|' + mapKeyOf(H0Map), arc: arcOf(r, H0F, mapKeyOf(H0Map))})`.
  - The end ghost stays `stageMap(n)`.
  - With no bracket the drawing is today's, byte for byte (§13.4).
- **Fit** (`defFitView`): the start samples come from `stageSamples(hv.H0F)` in place of `stageF(base)`, with today's
  clipping rule for a start much larger than the end. defKey holds the bracket, so each bracket keeps its own view
  memory.
- **Title** (`paneTitles`, line 6961): the math part is `start → w`.
  - start = Q applied to w_{a−1}, with w₀ = z. Bypassed steps are left out.
  - One post step: f₃(w₁). Two: (f₄ ∘ f₃)(w₁). Three or more: (f₆ ∘ ⋯ ∘ f₄)(w₁).
  - Pre only: w₁ → w. Post only: f₃(z) → w.
  - No words, so English and Russian are the same.
  - The phone's title chip (phone.css:73, `content: "z \2192  w"`) reads `content: attr(data-mtitle)`. app.js sets
    `data-mtitle` on `<html>` (plain text with Unicode subscripts) whenever the title changes.

### 5.2 The paths (D6)

- The paths are traced as today: `morphAt(T)` = `morphState(false)` at T, which already includes P and Q. The ring is
  at H₀(z) (`at(0)`) and the dot at F(z). All of AS-BUILT's rules apply to the drawn paths.
- **Seeds when H₀ ≠ id** (`pathsGen`; H₀ = `Fat(0)`):
  - **Boundary:** map each outline polyline through H₀ (as `drawMorphOutline` does: skip non-finite points, break
    jumps over 60 px). Place a seed every sep/3 px along the mapped polyline. The seed keeps its z: interpolate z
    linearly in the parameter of that piece. Test `inPanel` on the mapped point.
  - **Interior:** a 96 × 96 z-grid over X's bounding box ∩ clipWin (the visible window of X when X is unbounded).
    Keep the points inside X with a finite H₀(z) in the panel. Bin them into sep × sep px cells by the screen point
    of H₀(z). Keep, per cell, the point nearest the cell's centre. If fewer than half of the non-empty cells of a
    48 × 48 sample are filled, run it once more on a 192 × 192 grid.
  - Point shapes: as today.
  - Cost: at most 36 864 + 9 216 evaluations of H₀, in the idle job's slices (`yield` every 512). Never in a frame.
- When H₀ = id the seeding is today's code path, unchanged.
- **Retrace** (`pathRetrace`) and **selection keys** include rangeKey, so a bracket change chooses again,
  cross-faded in 150 ms as for a pan.
- Paths are off when a d/dz is in the bracket (today). A d/dz in the pre is fine.

### 5.3 Phase, Landscape and the globes

- Phase, Landscape and the phase sphere plot `homView().map`, which is the same spec. Nothing else changes.
- In a pullback, the portrait is Q's portrait pulled back by G_t. The post's cuts appear as seams at their exact
  pulled-back places.
- Y Sphere: wherever the globe or the globe figure draws "the boundary at t = 0", it draws X's boundary through
  `H0Map` (GPU lines) or `A.homF(0)` (figure vectors). It must not use the identity.
- X Sphere: unchanged.

### 5.4 Labels

- State label (`morphState().label`):
  - one after another: today's "step {k} · {name} · t = {t}";
  - all at once with a bracket that is not every step: "steps {range} at once · t = {t}" (string 18).
- Point labels: primes from `morphPrimes()` (§3.2).

## 6. Interface

### 6.1 When the bracket shows

It shows only when all of these hold:
- the transport is open;
- focus is 0;
- the chain has two or more active steps.

At focus k it is hidden and its setting waits. Showing the whole chain again brings it back. With every step
bracketed it is the only new mark on screen, and it says that the ends can be moved.

### 6.2 The look (all widths)

- **The line.** An over-bracket in the chain bar's top padding (y = 3 px), never over the planes.
  - A horizontal line runs from the middle of the connector before card a to the middle of the connector after card b.
  - At each end the line drops down to just above that connector's w-label: 20 px in Pictures, 10 px in Names,
    14 px on the phone.
  - Built from `div` borders in whole CSS pixels, so it stays crisp at dpr 1, 2 and 3.
- **Colour.** `--ink-2`, 1.5 px. A hovered, focused or dragged end, and the line with it, turns `--accent`, 2 px.
  Both tokens are defined in light and dark.
- **Motion.** Fades in with the transport (120 ms). Slides between connectors (120 ms, ease-out). None under
  `prefers-reduced-motion`.
- **Placement in the DOM.** One absolutely positioned layer `#chainBracket` in `#pipeline`, so it scrolls with the
  cards. Positions come from the connectors' `offsetLeft` and `offsetWidth`. They are recomputed in `buildPipeline`,
  in `updateBracket()`, and by a ResizeObserver on `#pipeline`.
- **What it leaves alone.** No marks on the cards. The selected card and the playing card keep their accent outlines.
  The playing highlight moves only inside the bracket.
- **Cards outside the bracket** show their step at t = 1 with no t label (`cardT`).

### 6.3 Dragging (desktop and tablet, pointer ≥ 768 px wide)

- **Handles.** Two elements `.br-end.l` and `.br-end.r`, each over its connector's full height.
  - The connector's insert "+" is hidden at those two connectors only, while the bracket shows.
  - Insert stays at every other connector, and in ⋯ → Insert a function after it.
  - Card reordering is HTML drag and drop on the connectors, and is unchanged.
- **Feedback.** Cursor `ew-resize`. Tooltips: string 6 (left end), string 7 (right end).
- **The drag** (pointer capture):
  - The end snaps to the nearest connector once the pointer passes a card's middle.
  - An end stops at the other end (at least one step stays bracketed) and at the chain's ends.
  - The right end stops at the last active d/dz. At that stop its tooltip shows string 13.
  - Each snap calls `setHomRange(candidate, {preview: true})`. Playback holds, and the planes show t = 0 of the
    candidate. That is a uniform change only (60 fps). Each snap plays the existing `snap` cue under Interface sounds.
- **Release** commits with `save()`. A deformation that was playing plays from t = 0.
- **Esc** during a drag restores the bracket held at pointerdown.
- **Touch on a tablet** drags the same way. The ⋯ menu is the equivalent control that meets the target-size rules.

### 6.4 Keyboard and screen readers

- The two ends are `role="slider"` and `tabindex="0"`. The connectors themselves stay `aria-hidden`.
  - They are tab stops after the cards and before the Add tile.
  - aria-label: string 8 (left end) or string 9 (right end).
  - aria-valuetext: "f₂" (in Russian the same).
  - aria-valuemin and aria-valuemax: the allowed stops.
- ←/→ move an end one step, and Home/End move it to the chain's end, with the same stops as dragging. Each move
  commits.

### 6.5 The ⋯ menu: **Deformation ▸** (card ⋯ and the Inspector's full ⋯)

- **Where:** after "Insert d/dz after it".
- **When:** shown when the chain has two or more active steps, whether the transport is open or not.
- **Items:** radio items (`radio: true, checked`) for card k, in this order:
  1. "Only f_k, inside F": {a: k, b: k}
  2. "Steps f_k–fₙ": {a: k, b: n}
  3. "Steps f₁–f_k": {a: 1, b: k}
  4. "Every step": absent
- **Dedupe:** compare the items by their normal form (§2.2). Every step is always kept. An item equal to Every step,
  or to an earlier item, is left out. On f₁ the menu holds item 1 and Every step; on fₙ, the same.
- **The key slot** shows where the deformation starts: string 5 with the title's start, e.g. "from (f₄∘f₃)(w₁)". It
  is left out on the phone.
- **Disabled items** say why in their tooltip:
  - string 13, when normalisation would move b past the item's own end;
  - string 14, when card k is bypassed.
- **Choosing an item:**
  - at focus k > 0, it first shows the whole chain (`setFocus(0)`);
  - then it calls `setHomRange`;
  - if the transport is closed, it opens it (`openTransport`, which plays, or starts paused under reduced motion).
- **The palette** gets the same four commands for the selected step (`S.sel`, else the last step), with string 16's
  titles and string 17's aliases. They are offered when the chain has two or more active steps.

For chain f₁ f₂ f₃: the push-forward of f₁(X) is f₂'s ⋯ → Steps f₂–f₃. The pullback under f₃ is f₂'s ⋯ → Steps
f₁–f₂.

### 6.6 The transport

- **Unchanged:** play, the scrubber, the ticks (the bracketed steps only, through `morphRange()`), t = … / m, speed,
  order (two or more bracketed steps), Loop, Paths and ×.
- **New, only when there is a pre or a post:** two labels inside `.tscrub`, before and after the range input:
  - "f₁ →" and "→ f₄". A run of two or more reads "f₁–f₂ →". The runs list only the active steps.
  - They use the ticks' type: italic math, 11 px, `--ink-2`.
  - They are plain spans. Tooltips: strings 10 and 11.
  - They wrap with `.tscrub` on narrow panes.
- **The transport's `aria-description`:** string 12, plus string 10 and/or string 11 as whole sentences.
- **Phone:** the labels are left out when the range input would be under 120 px wide. The bracket just above says the
  same.
- With no bracket, the transport is v15.2's DOM, unchanged.

### 6.7 The phone (Android Chrome, 360–430 px)

- **The bracket is drawn, not dragged:** `pointer-events: none`, in the 6 px top gap and the 12 px connectors.
  - 12 px is too narrow to grab.
  - A drag would fight the chain's horizontal scroll and card taps.
  - The sliders are still focusable for TalkBack.
- **The Display sheet** (already hosts the order select and Loop while the deformation shows) gets one row,
  `.trange`, as a direct child of the dock: "Deformed steps [f₁ ▾]–[f₃ ▾]".
  - Two native selects, 44 px tall, full width. The label wraps above them when it does not fit (Russian at 360 px).
  - The first select lists the allowed first steps; the second, the allowed last steps. Disallowed choices are
    disabled, with the d/dz reason in the row's note.
  - Choosing a first step after the current last moves both. The same holds the other way.
  - `fillDisplay` already moves `:scope > select, :scope > .check`. Extend its selector to `:scope > .trange`.
  - On desktop, `.trange` is built but hidden (desk.css: `.tdock > .trange { display: none }`).
- **The editor sheet's ⋯** holds Deformation ▸ as on desktop. Measure the submenu flip at 360 px.

### 6.8 A step shown alone

Unchanged: w_{k−1} → w_k in its own planes. The bracket, the transport labels and `.trange` are hidden. A
double-click, L, and the alone chip's × behave as today.

## 7. Saving, links, undo, chain edits

- **Saving.** `S.homRange` is part of S, so it is in the local save, links (`figureState`) and scenes as it is. A link
  opens with its bracket, and with its t through `figMorph`.
- **`sanitizeState`** keeps `{a, b, ua, ub}` only if:
  - a and b are integers with 1 ≤ a ≤ b ≤ steps.length;
  - ua and ub are strings or null.
  Then it normalises (§2.2). Otherwise it deletes the key.
- **Older builds.** A v15.2 build ignores the key and shows the whole-chain deformation.
- **Examples, the tour and `loadScene`:** delete S.homRange unless the scene has `range: {a, b}`.
- **Undo:**
  - `snap()` adds `range` (a JSON copy of S.homRange or null) beside `focus`. `noteFocus()` also records the range.
    `restore(e)` sets it back and normalises.
  - So undoing a removal that shrank the bracket gives the bracket back.
  - Moving the bracket is not an undo step.
- **Chain edits** (by uid resolution, §2.2):
  - **insert inside the bracket:** the new step joins it;
  - **insert before or after it:** the indices shift;
  - **append or prepend at an end that is the chain's end:** the new step joins;
  - **remove an end:** the bracket keeps that index (clamped), so it shrinks;
  - **move a step:** the bracket follows its ends' steps; if they cross, it becomes their span;
  - **duplicate:** the copy gets a fresh uid and joins when it lands inside;
  - **bypass:** nothing moves, and normal form may drop the setting.
- **Split a formula** (formula-steps §7): if the split step's uid is ua, set ua to the first new step's uid; if it is
  ub, set ub to the last new step's uid. This is one guarded line in the split action, so all n steps stay bracketed.

## 8. Export and captions

- `A.homF(T)` and `A.plotFAt(T)` go through `homView()`, so the filmstrips, the paths figure, the globe figure and the
  video follow the bracket. The video's `plan.paths` draws Hu(z) from u = 0, so its rings are at H₀(z).
- `A.defo()` gains these fields, null when the bracket is absent or has no pre or post:
  - `range: {a, b}`;
  - `pre: 'f_1'` and `post: 'f_3'` (TeX; three or more steps written `f_6\circ\cdots\circ f_4`);
  - `qp: 'f_3\circ f_1'` (H₀ as TeX);
  - `qpz: 'f_3(f_1(z))'` (H₀(z); `(f_6\circ\cdots\circ f_4)(f_1(z))` for long runs).
- Figures draw no cuts or seams, with or without a bracket (open item, both).
- **Captions change only when there is a pre or a post.** Otherwise they are byte-identical to v15.2.
  - **morphCaption head:** template 19 replaces `%{head}%{mark} and %{its} under %{end} …`.
  - **morphCaption homotopy:** `morphHomSegs` returns `{segs, inner}`.
    - `inner` is the bracketed part only:
      - one step: its phrase with H renamed G (`H_t` → `G_t`, `H_{…}` → `G_{…}`);
      - one after another: template 21 with `def = G_t=H^{(k)}_{t-k+a}` and `interval = k-a\le t\le k-a+1` (for
        a = 1 this is today's), then today's "for f_k, …" list;
      - all at once: template 22 with `G = H^{(b)}_t\circ\cdots\circ H^{(a)}_t`, then the list.
    - `segs` = template 20 around `inner`.
  - **Paths sentences** (morphCaption, three variants): pass `z = {m: 'H_0(z)=' + qpz}` in place of `{m: 'z'}`. No
    new template.
  - **figure.js `homSentence`:** with a pre or a post it returns template 23 (both), 24 (pre only) or 25 (post only),
    with `%{hom}` = inner.
  - **figure.js films and globe:** each template that says "from the identity ($t=0$)" gets a bracket variant
    (templates 26–28). The three globe path sentences change `$z$ (circle)` to `$%{z0}$ (circle)` (z0 = `z`, or
    `H_0(z)=` + qpz). Update the three RU keys in the same table.
  - **app.js "Shown at …":** the Phase and Landscape caption gets bracket variant 29.
  - **Rules.** The 700-character rule holds: use the short forms, and with a long caption drop the "for f_k, …" list
    first, as today. In Russian, a no-break space goes before every «—». Notation goes through `I18N.notation`.

## 9. Sound

- Hear the function in Phase, Landscape and on the X globe plays H_t through `sndF = morphState(true).F`. Nothing
  else is needed.
  - The harp follows the pulled-back phase lines as they sweep under a still pointer.
  - A zero crossing the probe plays the rising scale.
- **Keys.** `sndFKey` and `sndFrameKey` append `rangeKey()`. A bracket change is a new function: the nearest pitch
  class restarts.
- **The merged plane's probe** (src `'merged'`, `sndMove`):
  - pre only: z = the pointer's point read as u ∈ w_{a−1}, and the probe plays `morphState(true, lo).F`, which is G_t;
  - with a post: z = null (silent), as on a focused d/dz step today.
  - `sndF` takes the src for this. The loop singer keeps `morphState(true)`.
- **Cues.** No new cue. A snap during a bracket drag plays `snap`. `setHomRange` calls `soundFunctionChanged()`.
- The slider landmarks and the motion bed are relative to `morphLen()`, so they are unchanged.

## 10. Guide and tour

### 10.1 Guide (the Deformation paragraph)

The guide gets one sentence at the paragraph's end (G1), then one new paragraph (G2):

- **G1** EN: "A step shown alone deforms in its own planes; to see it deform inside $F$, bracket it (below)."
  RU: «Шаг, показанный отдельно, деформируется в своих плоскостях; чтобы увидеть его деформацию внутри $F$, возьмите
  его в скобку (см. ниже).»
- **G2** EN: "**Part of the chain.** While the deformation shows the whole chain, a bracket stands over the cards. Drag
  its ends, or choose a card's ⋯ → **Deformation**; on a phone, use Deformed steps in the Display sheet. Steps before
  the bracket act first and in full, steps after it last and in full: $H_t=f_3\circ G_t\circ f_1$ runs from
  $f_3\circ f_1$ at $t=0$ to $F$, while $G_t$ deforms the bracketed steps. Bracket the last steps to watch them deform
  the image $f_1(X)$ (a push-forward); bracket the first steps to watch them deform under the last ones (a pullback:
  for $\sqrt{z}$ then $f$, bracket $\sqrt{z}$ to go from $f(z)$ to $f(\sqrt{z})$). The start is outlined, and the
  plane's title names it."
  RU: «**Часть цепочки.** Пока деформация показывает всю цепочку, над карточками стоит скобка. Перетащите её концы или
  выберите в меню ⋯ карточки пункт **Деформация**; на телефоне — строка «Деформируемые шаги» в панели «Вид». Шаги
  перед скобкой действуют первыми и полностью, шаги после неё — последними и полностью: $H_t=f_3\circ G_t\circ f_1$
  идёт от $f_3\circ f_1$ при $t=0$ до $F$, а $G_t$ деформирует шаги в скобке. Возьмите в скобку последние шаги — и
  увидите, как они деформируют образ $f_1(X)$; возьмите первые — и увидите, как они деформируются под действием
  последних (для $\sqrt{z}$, затем $f$, возьмите в скобку $\sqrt{z}$: путь от $f(z)$ к $f(\sqrt{z})$). Начало
  деформации обведено контуром, его называет заголовок плоскости.»
  - The builder checks the phone sheet's Russian name «Вид» against the v15 table (`Display`) and uses that.

### 10.2 Tour

One stop goes at the end of the Deformation chapter. The chapter's `rev` goes 1 → 2, so it is marked New.

- Stop id `range`; scene `strip` (exp, then the Möbius map (z − 1)/(z + 1)).
- Anchor `.br-end.l` (phone: `pipeline`); place top.
- `before: [['deform', true], ['range', null]]`. The new scene key `range` is handled by `tourSetLook`/`before`:
  null → every step; {a, b} → `setHomRange`.
- Body (≤ 240 characters, both languages):
  - EN: "The bracket over the cards marks the steps that deform. Steps before it act first, in full; steps after it, last.
    Bracket $f_2$ alone and the Möbius map deforms the half-plane $f_1(X)$: $H_t=G_t\circ f_1$."
  - RU: «Скобка над карточками отмечает деформируемые шаги. Шаги перед ней действуют первыми и полностью, после неё —
    последними. Возьмите в скобку только $f_2$: дробно-линейное отображение деформирует полуплоскость $f_1(X)$.»
- Try:
  - EN: "Drag the bracket's left end past $f_1$." / RU «Перетащите левый конец скобки за $f_1$.»
  - Touch EN: "In $f_2$'s ⋯ menu, choose Deformation, then Only $f_2$, inside $F$." / RU «В меню ⋯ шага $f_2$
    выберите «Деформация», затем «Только $f_2$ внутри $F$».»
  - on: `deformation-range`; test `(e) => e && e.a === 2`.

## 11. Strings

Every id with EN, RU and a note is in `notes/deform-range/v16-deform-range.json`. Copy it to
`notes/i18n/ru/v16-deform-range.json` and add it to `tools/make_ru_table.py`'s v16 list.

Glossary terms used: деформация, гомотопия, шаг/шага/шагов, цепочка, образ, при отображении, «сразу» for "at once"
(as in math.json), and an en dash in «шаги 1–3». Plurals use `$tn`.

| # | id | English | Russian |
|---|---|---|---|
| 1 | dr.menu | Deformation | Деформация |
| 2 | dr.only | Only {f}, inside F | Только {f} внутри F |
| 3 | dr.steps | Steps {f1}–{f2} | Шаги {f1}–{f2} |
| 4 | dr.every | Every step | Все шаги |
| 5 | dr.from | from {v} | от {v} |
| 6 | dr.drag_l | Drag to choose the first deformed step | Перетащите, чтобы выбрать первый деформируемый шаг |
| 7 | dr.drag_r | Drag to choose the last deformed step | Перетащите, чтобы выбрать последний деформируемый шаг |
| 8 | dr.first | First deformed step | Первый деформируемый шаг |
| 9 | dr.last | Last deformed step | Последний деформируемый шаг |
| 10 | dr.pre (1 / n) | {list} is applied first, in full / {list} are applied first, in full | Сначала полностью применяется {list} / Сначала полностью применяются {list} |
| 11 | dr.post (1 / n) | {list} is applied last, in full / {list} are applied last, in full | В конце полностью применяется {list} / В конце полностью применяются {list} |
| 12 | dr.aria (1 / n) | Deforming step {f}. / Deforming steps {range}. | Деформируется шаг {f}. / Деформируются шаги {range}. |
| 13 | dr.why_deriv | A d/dz step differentiates the whole chain before it, so it cannot come after the deformed steps. | Шаг d/dz дифференцирует всю цепочку до него, поэтому он не может стоять после деформируемых шагов. |
| 14 | dr.why_off | Turn this step back on first. | Сначала снова включите этот шаг. |
| 15 | dr.row | Deformed steps | Деформируемые шаги |
| 16 | dr.cmd_* | Deformation: only {f}, inside F / Deformation: steps {f1}–{f2} / Deformation: every step | Деформация: только {f} внутри F / Деформация: шаги {f1}–{f2} / Деформация: все шаги |
| 17 | dr.aliases | part range bracket pullback pull-back precompose push-forward inside under outer inner | часть диапазон скобка композиция внутри внешний внутренний прообраз образ |
| 18 | dr.label_all | steps {range} at once · t = {t} | шаги {range} сразу · t = {t} |
| 19 | dr.cap_head | The images of %{set} under %{start}%{mark} and under %{end} (%{pat}), joined by %{hom}. | Образы %{set} при отображениях %{start}%{mark} и %{end} (%{pat}); их соединяет %{hom}. |
| 20 | dr.cap_hom | the homotopy %{H}, %{range}, where %{G} is %{inner} | гомотопия %{H}, %{range}, где %{G} — %{inner} |
| 21 | dr.cap_turn | the homotopy that runs the steps in turn ({def} on {interval}): | гомотопия, которая выполняет шаги по очереди ({def} при {interval}): |
| 22 | dr.cap_once | the homotopy {G} that deforms these steps at once: | гомотопия {G}, деформирующая эти шаги сразу: |
| 23 | dr.fig_both | Here $H_t=%{Q}\circ G_t\circ %{P}$, $0\le t\le %{m}$, deforms $%{QP}$ ($t=0$) into %{map} ($t=%{m}$): $%{P}$ acts first and $%{Q}$ last, both in full, and $G_t$ is %{hom}. | Здесь $H_t=%{Q}\circ G_t\circ %{P}$, $0\le t\le %{m}$, непрерывно деформирует $%{QP}$ ($t=0$) в %{map} ($t=%{m}$): $%{P}$ действует первым, $%{Q}$ — последним, оба полностью, а $G_t$ — это %{hom}. |
| 24 | dr.fig_pre | Here $H_t=G_t\circ %{P}$, $0\le t\le %{m}$, deforms $%{P}$ ($t=0$) into %{map} ($t=%{m}$): $%{P}$ acts first, in full, and $G_t$ is %{hom}. | Здесь $H_t=G_t\circ %{P}$, $0\le t\le %{m}$, непрерывно деформирует $%{P}$ ($t=0$) в %{map} ($t=%{m}$): $%{P}$ действует первым и полностью, а $G_t$ — это %{hom}. |
| 25 | dr.fig_post | Here $H_t=%{Q}\circ G_t$, $0\le t\le %{m}$, deforms $%{Q}$ ($t=0$) into %{map} ($t=%{m}$): $%{Q}$ acts last, in full, and $G_t$ is %{hom}. | Здесь $H_t=%{Q}\circ G_t$, $0\le t\le %{m}$, непрерывно деформирует $%{Q}$ ($t=0$) в %{map} ($t=%{m}$): $%{Q}$ действует последним и полностью, а $G_t$ — это %{hom}. |
| 26 | dr.fig_film | The deformation $H_t$ from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$), at %{ts}. | Деформация $H_t$ от $%{QP}$ ($t=0$) до %{map} ($t=%{m}$) при %{ts}. |
| 27 | dr.fig_globe_paths | The deformation $H_t$ on the Riemann sphere, with $\infty$ at the north pole, from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$). The figure shows the image of %{list} under $%{F}$ over the boundary of its image at $t=0$ (gray). | Деформация $H_t$ на сфере Римана (точка $\infty$ — северный полюс) от $%{QP}$ ($t=0$) до %{map} ($t=%{m}$). На рисунке показан образ %{list} при отображении $%{F}$ поверх границы его образа при $t=0$ (серая линия). |
| 28 | dr.fig_globe_film | The deformation $H_t$ on the Riemann sphere, with $\infty$ at the north pole, from $%{QP}$ ($t=0$) to %{map} ($t=%{m}$). At %{ts}, the frames show the image of %{list} under $H_t$. | Деформация $H_t$ на сфере Римана (точка $\infty$ — северный полюс) от $%{QP}$ ($t=0$) до %{map} ($t=%{m}$). На кадрах при %{ts} показан образ %{list} при отображении $H_t$. |
| 29 | dr.cap_shown | Shown at %{t}, where %{H} deforms %{QP} (%{t0}) into %{map} (%{tm}); it is %{hom}. | Показан кадр при %{t}. Здесь %{H} непрерывно деформирует %{QP} (%{t0}) в %{map} (%{tm}); это %{hom}. |
| 30–35 | dr.guide_1, dr.guide_2, dr.tour_title ("Part of the chain" / «Часть цепочки»), dr.tour_body, dr.tour_try, dr.tour_touch | §10 | §10 |

Notes on the table:
- In 19, `%{set}` is the genitive set phrase (`setGen`), and `%{mark}` is the mark without the serial comma.
- Templates 23–25 and 29 lead with a space, as their v15 originals do.
- "Only {f}, inside F" is kept distinct from Show alone ("{f} alone"). A step shown alone deforms in its own planes.

## 12. Files

| File | Change |
|---|---|
| `src/homrange.js` (new) | §3.1: `range`, `state`, `cpuMap`, `homF`, `H0`; UMD; about 140 lines. |
| `build.py` | Add `homrange.js` after `funcs.js` in the JS list. |
| `src/app.js` | §3.2 glue; `homRangeOk`, `rangeKey`, `setHomRange`; `homView` fields; `mapKeyOf`; `morphPrimes`; `cardT`; `renderMorph` start (§5.1); `defFitView`; `paneTitles` and `data-mtitle`; `pathsGen` seeds (§5.2); `mfScreenKey`; `morphHomSegs` `{segs, inner}` and template 19 in `morphCaption`; the "Shown at" variant; the bracket layer `updateBracket()` and its handles (§6.2–6.4) in `buildPipeline` and `connector`; `stepMenu` Deformation ▸; the palette commands; `buildDock` labels, aria-description and `.trange`; `sanitizeState`; `snap`/`noteFocus`/`restore`; `loadScene`; the split hook; the sound keys and the merged probe (§9); the guide text; test hooks (§13.3). |
| `src/gl.js` | MAP_PLAIN and MAP_STAGE (§4.2), the `uPost` uniform and name list, `mapKeyOf`, `isIdent`, `mapFor`, `GLR.evalMap`. |
| `src/glsl.js` | No change. `chainRange`, `chainHom` and `chainHomAll` are already emitted; the `t == 1.0` guard stays. |
| `src/figure.js` | `homSentence` variants (23–25); film and globe variants (26–28); `$%{z0}$` in the three globe path sentences; read `A.defo().range/pre/post/qp/qpz`; the globe's t = 0 boundary through `A.homF(0)` (§5.3). |
| `src/phone.js` | `fillDisplay` moves `.trange`. The title chip reads `data-mtitle`. |
| `src/phone.css`, `src/desk.css`, `src/page.html` | Bracket layer styles (light and dark through tokens), `.br-end` handles, the hidden "+" at the bracket's connectors, `.tscrub .tfix` labels, `.trange` (hidden on desktop), `content: attr(data-mtitle)`. |
| `src/tour.js` | Deformation chapter rev 2; stop `range`; scene key `range`. |
| `notes/i18n/ru/v16-deform-range.json`, `tools/make_ru_table.py` | §11. |
| `test/t_deform_range.js`, `test/make_glsl_test.py` → `glsl_test.js`, `test/deform_range_cmd.js`, `test/deform_range_fps_cmd.js` | §13. |

## 13. Tests

### 13.1 Node: `test/t_deform_range.js`

Loads `cx.js`, `parse.js`, `funcs.js` and `homrange.js`. It is the scratch model's harness, run against the shipped
module.

- **Chains:**
  - chain3 = exp, Möbius C(w) = (w − 1)/(w + 1), square;
  - sin∘√ = root 2 (cut 180°), sin; also with cut −90°;
  - Möbius-log = (z − i)/(z + i), log;
  - a d/dz chain: z², d/dz, exp;
  - a bypass chain: exp, (off) sin, Möbius, square.
- **Cases:** every bracket a…b, both orders, focus 0. Also every focus k with no bracket.
- **Points:** 400 points (a seeded grid over [−3, 3]², avoiding cuts by 10⁻⁶).
- **Assertions:**
  1. **Exact ends.** At T = 0, `state(...).F(z)` equals `rangeF(b, n)(stageF(lo)(z))` bit for bit (=== on re and
     im, NaN = NaN). At T = end it equals `stageF(n)(z)` bit for bit. This includes the user's two cases (chain3
     2…3 and 1…2) and sin∘√ 1…1, where H₀ = sin z and H₁ = sin √z.
  2. **The twin.** `cpuMap(state().map)` equals `state().F` bit for bit, at T ∈ {0, 0.37·end, end}.
  3. **Continuity.** At every node t = j, |H_{j+ε} − H_{j−ε}| ≤ 10⁻⁶ for ε = 10⁻⁹.
  4. **Today unchanged.** With no bracket, and at focus k, `state().map` deep-equals the v15.2 map (recorded from
     `rangeModel.js` with ENDS off). `key` equals v15.2's key + `|lo|b|p1`.
  5. **Normal form and resolution.** "Every active step inside" → null. "No active step inside" → null. A d/dz after
     b moves b. Uid resolution for insert, remove an end, move across, append at the chain's end, and the split hook.
  6. **Worked numbers** (design-math §10):
     - sin∘√ 1…1: H_t((kπ)^{1/s}) is 0 to |H| ≤ 10⁻⁹ at s = 1 − t/2, t ∈ {¼, ½, ¾}, k = 1, 2.
     - Möbius-log 1…1: H_t(M^{−t}(1)) = 0 to 10⁻⁹ at t = ½ (z = 2 + i).
     - chain3 1…1: the pole of H_t at z = log(1 − t − t²)/t, at t = 0.3 and 0.5 (|H| ≥ 10¹²).

### 13.2 GLSL parity: `make_glsl_test.py` → `test/glsl_test.js`

- New row mode 7: `chainRange(chainHom(hi, chainRange(z, 0, hi − 1), t), b, post)`, and the same with `uT <= 0.0`
  selecting z.
- New row mode 8: `chainRange(chainHomAll(chainRange(z, 0, lo), lo, b, t), b, post)`.
- Pack (hi or lo, b, post, t) into the row's vec4. The row value grows from 3 to 4 components where it is shorter.
- Rows: for every fixture chain with n ≥ 2, every bracket a…b obeying the d/dz rule, and t ∈ {0, 0.25, 0.5, 0.999, 1}.
  The CPU twin is `HomRange.cpuMap`.
- Tolerance and seam exclusions as the existing hom rows (mode 2/6).
- Extra checks:
  - rows at t = 1, segment m, equal the mode-0 row (0, n) to the mode-0 tolerance;
  - rows at t = 0 equal the composition of the pre's and post's `chainStep` rows to the same tolerance.

### 13.3 gl.js level (inside `deform_range_cmd.js`)

- `GLR.evalMap(spec, pts)` ≈ `__cmwEval('cpuMap', spec, pts)` at 64 probes. Chains: chain3, sin∘√ and Möbius-log;
  every bracket; t ∈ {0, ½·end, end}. Tolerance is the glsl_test one.
- `mapKeyOf` differs for two specs that differ only in post.
- `isIdent({mode: 1, hi: 1, t: .5, b: 1, post: 3})` is false when f₁ is off.
- `mapFor` with a changed step inside the post returns the mode-0 fallback and does not throw.
- New hooks:
  - `__cmwMorph({range: {a, b} | null})` calls `setHomRange`;
  - `__cmwEval(kind, specOrT, pts)` with kind ∈ `H` (imageF at T), `H0`, `F`, `cpuMap`;
  - `__cmwState().homView.range/H0Map/start`.

### 13.4 CDP acceptance: `test/deform_range_cmd.js`

Uses the cdp_kit conventions of `deform_nat_cmd.js`: `view`, `load`, `ev`, `key`, `move`, `shot`, `settle`, and
`fails`/`shots` out. Run: `python3 build.py && test/<you>_cdp/q.sh test/deform_range_cmd.js`.

Each section runs at **1440 × 900 desktop** and **390 × 844 phone** (`view(..., phone)`), in **light and dark**, in
**English and Russian** (`?lang=ru`), unless noted.

1. **Today unchanged** (desktop, EN, light).
   - Load the 8 path scenes of `pa_scenes.js`.
   - With no bracket, at t ∈ {0, ½·end, end}, and at focus 1 and 2:
     - `__cmwState().homView` (map, key without the suffix) deep-equals the v15.2 record `test/ref/deform_range_v152.json`
       (made by running section 1 against the frozen v15.2 build);
     - the plane title, `morphCaption` text and the link are equal;
     - frames differ from v15.2's in 0 px by more than 8/255.
   - The bracket layer is absent when the transport is closed, at focus k, and with one active step.
2. **Push-forward:** chain3 (strip scene X), f₂'s ⋯ → Steps f₂–f₃.
   - S.homRange is {2, 3}; homView.map = `{mode: 1, hi: 2, t, …}` with no post; the title is "w₁ → w".
   - There is no tint, and the start outline lies on e^{∂X}: 40 sampled outline points within 0.5 px of
     `__cmwEval('H0')`.
   - Path rings are at H₀(z) and dots at F(z) (0 px).
   - At t = end the merged plane equals the rest Y frame (0 px over 8/255).
   - Transport labels: "f₁ →" present, no "→ …".
   - Order: All at once is offered, and its map is mode 3, a = 1, b = 3.
3. **Pullback:** chain3, f₂'s ⋯ → Steps f₁–f₂.
   - The map has `post: 3, b: 2`; the title is "f₃(z) → w"; "→ f₃" is shown.
   - At t = 0 the merged image equals a one-step chain (square) frame of X (0 px over 8/255).
   - At t = end it equals F's rest frame.
   - Phase at t = ½ equals `GLR.evalMap` colours at 16 probes.
4. **z → sin(√z):** chain [root 2, sin], X = the rectangle 0 ≤ Re z ≤ 40, |Im z| ≤ 2; f₁'s ⋯ → Only f₁, inside F.
   - At t = 0 the Phase portrait equals the portrait of the chain [sin] (0 px over 8/255).
   - At t = 1 it equals the portrait of [root 2, sin].
   - At t = 0.578 the hovered value at z = 5 is |H| < 10⁻⁶ (the zero π^{1/s} passes).
   - The title is "f₂(z) → w".
   - Merged probe: silent (sound hook `snd.harp` not struck while moving over the merged plane).
   - Repeat with the cut at −90°.
5. **Interface, desktop:**
   - Drag the left end from the first connector to the second. A snap fires `snap`, and the frames show t = 0 of the
     candidate.
   - Esc restores the bracket.
   - Release commits; reload keeps it.
   - The right end stops at a d/dz, and its tooltip is string 13.
   - The sliders: Tab reaches `.br-end.l`; → moves it; aria-valuetext is updated.
   - Menu dedupe on f₁ and fₙ.
   - The palette's four commands, and their aliases found in both languages.
   - The insert "+" is hidden only at the two bracket connectors.
   - Shots: the bracket at rest and hovered, the submenu, the transport labels; light and dark; EN and RU.
6. **Interface, phone** (390 × 844 and 360 × 800):
   - The bracket is drawn with `pointer-events: none`.
   - Display sheet: the `.trange` row with its two selects, 44 px tall. Choosing the selects sets the bracket.
   - A disallowed option is disabled with the note.
   - Russian at 360 px: the label wraps above the selects, and nothing overflows (`scrollWidth ≤ clientWidth`).
   - Editor sheet ⋯ → Deformation ▸ opens within the viewport.
   - The title chip shows `data-mtitle`.
   - The transport labels are present only when the range input is ≥ 120 px wide.
   - Nothing new covers the planes (bounding boxes of the new elements do not intersect `#paneR`'s plot area).
7. **Saving, links, undo, edits:**
   - The link round trip keeps {a, b} and t.
   - Undo after removing the bracket's end step restores the bracket.
   - Insert inside, insert before, append at the end (joins), move across, split a formula at ub (all new steps
     join), bypass to normal form (setting dropped).
   - A state without `ua/ub` loads by index.
8. **Export:** Article B/W and colour, EN and RU, for sin∘√ 1…1 and chain3 2…3.
   - Captions are ≤ 700 characters, with templates 19/20 (screen) and 23/24/25/26 (figure) present.
   - Without a bracket, captions are byte-equal to v15.2's.
   - Preflight 0 failures.
   - The video's first frame has its rings at H₀(z) (1 px).

### 13.5 Frame times: `test/deform_range_fps_cmd.js`

- A 12-step chain: pre 5 heavy steps, bracket 2, post 5 (the erf/tan/log chain of the sound tests).
- Play one after another and all at once, in X → Y, Phase and Landscape, with Paths on. Also drag a bracket end for
  3 s.
- Gates: p95 ≤ 18.4 ms and 60 fps at 1440 × 900 and at 390 × 844 (the AS-BUILT bar).
- Also report the v15.2 whole-chain figures on the same chain for comparison.
- Not on GeForce NOW (timing skew). Run on the Mac with the browser in front, and on the user's Android Chrome for
  the phone row when available.

## 14. Not in this round (open items)

1. Zero and pole tracks in Phase (design-math §5.3), for every deformation.
2. Seams in the deformation plane: pre and post cut images, and the moving seams of the bracketed steps.
3. A grey tint of H₀(X) for brackets and focus k alike. It needs the forward mesh with a neutral ink.
4. A d/dz after the bracket (the derivative of the homotopy).
5. The z-plane cut handle of step 1 is exact during the deformation only for homotopies that keep the ray.
6. Figures draw no cuts or seams, with or without a bracket.

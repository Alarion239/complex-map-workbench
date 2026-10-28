# Touching circle: spec (final)

The user, 2026-10-25: "Together with perpendicular circles, I would like to add touching lines/circles (intersecting
in exactly one point)".

One new tool in the Construct group, Touching circle, next to Perpendicular circle. It makes two new ops:

- `touch(C, T, P)`: the generalized circle that touches C at T and passes through P. With P = ∞ it is the tangent at T.
- `tangent(C, P, k)`: the tangent line from P to the circle C (k = 0 or 1), plus its touching point.

Both results are ordinary generalized circles (`s._g`), so no renderer changes.

- **Build after perp**, on the same candidate. It uses perp's dyadic helpers, `OPS.sig`, the curve pick, "the curve
  stays picked", `isCirc3` and `nextCi(target, k)`.
- **Inputs:** `TANGENT-DESIGN.md` (the proposal), `tangent-scratch/texp.js` (its numerical study).
- **Critic's evidence:**
  - `tangent-scratch/tpatch.js` applies section 3 to perp's `proto/constr.js`. The result,
    `tangent-scratch/constr-touch.js`, is the reference text for the core.
  - `tangent-scratch/tcheck.js` passes 35 of 35. The output is in `tcheck-output.txt`.
  - `tangent-scratch/c3pole.js` compares the meet of two tangents with and without `c3` (section 1, point 2).
    The output is in `c3pole-output.txt`.
  - The existing `test/t_constr.js` passes 164 of 164 against `constr-touch.js` (in the mirror under
    `tangent-scratch/run/`).

## 1. What changed from TANGENT-DESIGN.md

The maths holds up. I measured it again in the graph, on 4000 random C (circle, line, segment, arc, and a disc and its
complement) and 8000 tangents:

- the worst overlap depth is 4.1e−16 S for touch and 3.9e−16 S for tangent;
- T, P and the touching point lie on their curves within 3.7e−16 S;
- the plain v16.2 solver finds no meet of K and C in 1055 of 4000 cases.

I changed these points:

1. **The meet rule sits in `meetsOf`, on pieces, not in `evalNode`.**
   - Snapping (`meetNear`), Intersect on two curves (`Constr.meets`) and meet points all go through `meetsOf`. With
     the rule only in `evalNode`, the hover ring and Intersect would still see 0 or 2 noisy crossings.
   - K's form carries `tch = {G: a copy of C's piece form, tp}`. The rule applies when the other piece's form equals
     `tch.G` bitwise. It needs no ids or refs, and it is correct for any curve with that exact form.
   - Two lines by kind get `[{z: tp, index: 'finite'}]`; every other pair gets tp for index 0 and index 1.
   - Measured: 4000 of 4000 graphs give T exactly, for both indices, in the graph and on the pieces.
2. **The tangent at T is a line by kind.** A `touch` with P = `{inf: 1}` gets no `c3` flag, so two tangents meet as two
   lines do: their meet runs out to ∞ and comes back from the other side as T₂ passes T₁'s antipode. With `c3`,
   index 0 would stay at ∞ after the antipode (both measured in `c3pole.js`). A `touch` with a finite P keeps `c3`, because it can be a line
   for an instant.
3. **Parallels copy C's B bitwise.** For T = ∞, or a tangent to a line, K is `{A: 0, B: C's B, C: 0, o: P}`, not
   renormalized by `gc`. Renormalizing tilted it by an ulp, so the two lines met at a far finite point instead of ∞.
4. **Lines get plain gliders.** On the tangent at T and on a tangent from P, a point at parameter t sits at distance t
   from T (or P). DESIGN's M(ℝ) map for `tangent` is dropped. A touching circle with a finite P uses perp's map,
   anchored at T: T is at 0 and the point opposite T is at ½. Use complement on K does not move points on it
   (checked).
5. **Only the touching circle gets Region.** Tangent lines are curves only, like Perpendicular bisector: no Curve |
   Region and no Use complement. That removes the half-plane-side strings DESIGN needed. A touching circle has the
   same Region controls as perp, and its half-plane (when it is a line for an instant) reuses "the half-plane left of
   {a} → {b}" through `hpOrder`.
6. **`NEED.touch = 2`, as perp:** the curve is `draftC.curve1`.
7. **The tangent hint is picked at the point radius**, 8 px (mouse) or 22 px (touch), as the rings are (issue #12).
   The curve radius, 6 or 10 px, was too thin a target for a dashed line at 50 % opacity, and a click just outside it
   made a huge touching circle. Along the tangent the hint is the only meaningful target; Alt skips it to place a free
   point there.
8. **A second point on C is refused after T** ("Click a point off {c}."). If T and P are both on C, K is C itself.
9. **The `inside` reason has no names**, as perp's `pencil`: "The point is inside the circle, so no line through it
   touches the circle".
10. **The Russian rows follow C26** (the colon after «кривой»). The touching point is named in the nominative,
    «точка касания — {a}», so a handle name never needs the prepositional case. The tangent from P reads «через {p}»
    (the accusative forms exist). DESIGN's «касается кривой {c} в точке {a}» broke both rules.
11. **A free point that lies on C to the last bit is P, not T.** Only points on C by construction are T. That
    includes gliders, meets, handles and defining points, through bound handles. For such a P:
    - its two rings are √(distance) apart, about 1e−8 at 1e−16 from C, so they draw as one;
    - or P is inside C by its floats, and there are no rings.

    "Exactly on C" (s = 0, both branches the tangent at P) happens only when f_C(P) = 0 in the floats. For example,
    1 − 3i on the circle of radius 4 about 1 + i (checked).
12. **`pieceSig` in construct.js includes `tch`.** Otherwise K's cached piece could keep an old `tch.G` when C changes
    but K's form does not, which happens when C keeps its tangent direction at T.

## 2. The maths (as built)

**touch(C, T, P).** Anchored at T, with C = 0:

    B' = C's B re-anchored at T (exact);  d = P − T (exact)
    (A, B) = (−2 d·B', |d|² B')          P = ∞:  (0, B')          T = ∞ (C a line):  (0, C's B) at P

- **Tangency.** Tangency at T comes from B ∥ B'. Each coefficient is rounded once, and all three share one power of
  two (`dScaled`). The exact products add P's incidence (2.6e−16 S), and they come with perp's helpers at no extra
  cost.
- **The Λ rule.** When P alone is exactly 0, K is anchored at P exactly: B + A·d, with C = 0. It then gets `thru0`.
- **Undefined.**
  - P = T by value: `coincide`.
  - T and P both ∞: `lineInf`.
  - T = ∞ on a curve that is not a line: `argUndef` naming T.
  - A = B = 0 (T at C's centre, only from a crafted save): `coincide`.
- **Orientation.** K agrees with C's curve form (its own flip undone) at T. At creation, `flip = (A < 0)`, so K is
  the disc. Lines are never flipped at creation.

**tangent(C, P, k).** Anchored at P:

    B', f = f_C(P), s² = A f, N² = |B'|² − s²   (exact, then rounded once)
    n = (N B' + σ s J B') / |B'|²,  σ = −1 for k = 0, +1 for k = 1,  J(x, y) = (−y, x)
    K = gc(0, n, 0, P);  tp = P + t u,  u = J n̂,  t = −(B'·u) / A

- k = 0 touches C to the left of the ray from P to C's centre (4000 of 4000), and k = 1 to the right.
- s² < 0 exactly gives `inside`. P = ∞ gives `lineInf`.
- C a line gives the parallel (copied B) with tp = ∞.
- A 3-point C that flattens: the tangents tend to the parallel, tp goes to ∞, and past the line case P is inside
  (checked).
- `flip` is false and stays false (no Region).

**The meet rule (`touchAt(pa, pb)`).** The touching point is tp when:

- one piece's `G.tch.G` equals the other piece's G bitwise; or
- both carry `tch` with equal `tch.G` and the same finite tp, as two touches of one curve at one point do.

`meetsOf` returns it before solving, as said in section 1, point 1. K = C (P on C) also gives T, so the meet stays
continuous while P crosses C.

**Incidence (`onCurveByRefs(state, pref, cref)`).** True when the point is on the curve by construction:

- it is a glider on cref, or a meet with cref among its args;
- it is one of the defining points of cref's shape (the 3 points of a circle3; P and Q of a perp; T and P of a touch;
  P of a tangent);
- it is a position handle of cref's shape that sits exactly at an end of that piece: a line's or segment's a and b,
  an arc's a, m and b, a polygon's or rectangle's corners on that side, a sector's centre on its edges.

All comparisons go through `canonKey`, so bound handles count. A free point that happens to lie on C does not count.

## 3. Core: src/constr.js (+120 lines; the exact text is in `tangent-scratch/tpatch.js`)

1. **`atD`, `dnum1`, `touchForm`, `tangentForm`, `sameG`, `touchAt` and `onCurveByRefs`**, placed after `perpForm`.
   Export `touchForm`, `tangentForm`, `onCurveByRefs` and `touchAt`.
2. **`evalNode`: one branch for `touch` and `tangent`**, before `meet`/`glider`.
   - The curve checks are perp's: `argUndef` or `notCircle {x}`.
   - Undo C's flip when C is a circle3, perp, touch or tangent.
   - Resolve the points, then call the form function.
   - Set the creation flip, apply `flip`, then attach `tch` (after the flip, because `flipG` drops extra fields).
   - `withPts` and `e` from the two finite points ([T, P], or [P, tp]); then `thru0`, `fieldsOfForm`, `setKind`.
3. **`meetsOf`:** the rule, right after the traced check.
4. **`pieces`:** `c3` for `touch` unless args[2] is `{inf}`. `tangent` gets none.
5. **`pts3In`:** for `touch` with a finite P, `{mr: T, s: |PT|, sg: flip ? −1 : 1}` (T = ∞: anchored at P, s = 1).
   With P = `{inf}`, null.
6. **`OPS`:** touch `{n: 3, sig: ['c', 'p', 'p']}`, tangent `{n: 2, sig: ['c', 'p']}`.
   - `validate` sets a tangent's index to 0 unless it is 0 or 1.
   - `fill` and `flip` are normalized for both.
   - The v16.2 `validate` frees both and keeps their fields (checked).
7. **`describe`:** `fill` for touch, and `index` for tangent.

## 4. Interface: src/construct.js (about 170 lines)

### Registration

- `CTOOLS += 'touch'` and `NEED.touch = 2`. `toolName.touch` is "Touching circle"; `toolShort.touch` is "Touching".
- The `toolRows()` row is `['touch', $t('Touching circle'), '', $t(<tooltip>), 'construct', $t('Touching')]`, placed
  after perp. app.js builds the tile, the rail icon and the phone's More sheet from it.
- `isCirc3(s)` also covers `touch` with a finite args[2]. Tangent lines stay out, as bisector does.
- `ICON.touch`: a circle and a smaller circle touching it from outside, with a dot at the touching point. The dot is
  exactly on both circles.

      tsvg('<circle cx="8" cy="10" r="5.5"/><circle cx="16" cy="10" r="2.5"/>' + dot(13.5, 10))

### Picks

`draftC = {tool: 'touch', side, picks, curve1, hover}`; `picks[i].role` is `'T'` or `'P'`.

1. **The curve.** Perp's code, unchanged: exact curves only, the shown unit circle and the axes, the toast "Click a
   line or a circle.", and the curve stays picked after each construction.
2. **The first point X.** Resolve it with `pickOf`. X is T when it is on C:
   - a curve target on C itself;
   - a crossing target with C among its two curves;
   - a point target with `Constr.onCurveByRefs(S(), ref, curve1.ref)`.

   Otherwise X is P.
3. **After T.**
   - Candidates, in order: point and crossing targets; then the **tangent hint**; then strokes; then a free point.
     - The hint exists only when C's piece is a circle. It is the line `touchForm(Gc, T, INF)`
       (`Constr.tangentNear`), picked within the point radius.
     - The hint gives P = `{inf: 1}`. It is a target, not a snap: Snap off keeps it. Alt skips it.
   - The tangent in one step, without aiming at the line: the chip's **Tangent line** button, or **Enter**.
   - A P within 0.5 px of the tangent at T (`TAN_EPS`, as with Alt) makes the tangent, `touch(C, T, ∞)`, not a circle
     of radius ~10¹⁶. The guard is in `finishTouch`; `constr.js` evaluates `touch(C, T, P)` as it is, continuous as P
     crosses the tangent.
   - A pick on C (by the T test) shows the toast "Click a point off {c}." and keeps the draft.
4. **After P.**
   - **Rings** exist when C's piece is a circle and P is outside it. They are `tangentForm(Gc, P, 0 | 1).tp`, picked
     within the point radius.
     - A ring creates `{op: 'tangent', args: [C, P], index: k, fill: 'none'}` and the touching point
       `{op: 'meet', args: [{s: K, part: 0}, C], index: 0}` (a visible point).
   - Then a point target or a crossing on C (the T test), then C's stroke (a glider).
   - Anything else shows the toast "Click a point on {c}." and keeps the draft.
   - The same ref twice shows "{x} needs distinct points".
5. **Finishing.** One `cm.create` holds the new free points and gliders, then K (and the touching point). That is one
   undo step. The fields come from `Constr.shapeOf(form)`. `ci` is `A.nextCi(target, k)` past any new curve.

### Chip, hover, preview, keys

**The chip.**

- Before the curve: perp's "Pick a line or a circle · Touching circle · Esc cancels".
- No point yet: "Point 1 of 2 · …".
- After T: "Point 2 of 2, or the tangent · …" and the **Tangent line** button, or perp's "Point 2 of 2" when C is a
  line.
- After P: "Touching point on {c} · …".
- A narrow pane or touch shows the tile text and drops "Esc cancels".

**Hover.**

- The hint snaps with the ring chip "on the tangent at {a}".
- A ring snaps with "on a tangent from {p}". The ring is drawn at the touching point.

**Preview** (`drawPreview`), dashed, in the next shape's colour:

- C at 4 px and 35 % opacity, then the picks.
- The hint, or the two tangents from P and their rings (hollow, 5 px), thin at 50 % opacity. These are drawn with no
  pointer, because touch has no hover.
- K through the pointer, from `touchForm`.
  - After P, K touches C at the pointer's projection (`projectPiece` on C).
  - A snapped hint or ring is drawn at full preview strength.
  - Huge radii are drawn with `sampleMR`, as perp's.
- Nothing where K is undefined.

**Keys.** Backspace drops the last point; with no points it drops the curve. Esc cancels. On touch, the chip's ×
cancels. All of this is as perp.

### Everywhere else

- **Globe:** the toast "Click a line or a circle.", as perp.
- **Y:** the same picks on side R; C may be a target curve.
- **Plane menu:** on a line-or-circle stroke, "Touching circle…" starts the tool with that curve picked.
- **`defText`:**
  - touch: curve, line, disc and outside rows; a half-plane uses `hpOrder` over T and P;
  - touch with P = ∞: "the tangent to {c} at {a}";
  - tangent: "the left/right tangent to {c} through {p}";
  - a meet whose pieces satisfy `Constr.touchAt`: "{c1} ∩ {c2}, where they touch". Its Other point button is
    hidden, because both indices are the same point.
- **`reasonText`:** `inside`.
- **`tMeaning`:**
  - a touching circle: perp's "0 at {p}, ½ opposite it", with p = T;
  - tangent lines: "0 at {p}; t is the distance from it", with p = T or P and range [−10, 10].
- **`phrase` and `CAPTIONS`:** the 6 templates below. `{c}` is C's carrier, as for perp.
- **Op-set checks:** `rowMenu`, `inspectorBuild`, `paletteActs` and `setFill` go through `isCirc3`.
- **`pieceSig`:** append `s._g.tch ? tch.G.A, B, C, o` (section 1, point 12).
- **No change** to app.js (perp's `nextCi` is enough), gl.js, glsl.js, region.js, sphere.js, figure.js or phone.js.
- **No tour step**, as perp.

## 5. Strings (notes/i18n/ru/v16-touch.json; then `make_ru_table.py --strict`, 0 unresolved)

| English | Russian | Note |
|---|---|---|
| Touching circle | Касающаяся окружность | tool name |
| Touching | Касание | tile, like «Пере­сечение» |
| Pick a line or a circle, then the point where the new circle touches it and a point it passes through, in either order. Click the dashed tangent or press Tangent line for the tangent line, or a ring for a tangent from the point. The curve stays picked for the next one. | Выберите прямую или окружность, затем точку касания на ней и точку, через которую пройдёт окружность, в любом порядке. Щелчок по пунктирной касательной или кнопка «Касательная» даёт касательную, щелчок по кольцу — касательную из точки. Кривая остаётся выбранной для следующей. | tooltip |
| Tangent line | Касательная | chip button after T |
| Touching circle… | Касающаяся окружность… | plane menu |
| Point {n} of {m}, or the tangent | Точка {n} из {m} или касательная | chip after T |
| Touching point on {c} | Точка касания на кривой: {c} | chip after P [C26] |
| Click a point on {c}. | Щёлкните точку на кривой: {c}. | toast |
| Click a point off {c}. | Щёлкните точку вне кривой: {c}. | toast |
| the tangent at {a} | касательная в точке {a} | hover chip "on {x}" |
| a tangent from {p} | касательная из {p} | hover chip |
| through {b}, touching {c} at {a} | через {b}, касается кривой: {c}; точка касания — {a} | row ({b} acc, {a} nom) |
| the line through {b}, touching {c} at {a} | прямая через {b}, касающаяся кривой: {c}; точка касания — {a} | row |
| the disc through {b}, touching {c} at {a} | круг, ограниченный окружностью через {b}, касающейся кривой: {c}; точка касания — {a} | row |
| outside the circle through {b}, touching {c} at {a} | внешность окружности через {b}, касающейся кривой: {c}; точка касания — {a} | row |
| the tangent to {c} at {a} | касательная к кривой: {c}; точка касания — {a} | row |
| the left tangent to {c} through {p} | левая касательная к кривой: {c}, через {p} | row ({p} acc) |
| the right tangent to {c} through {p} | правая касательная к кривой: {c}, через {p} | row |
| {c1} ∩ {c2}, where they touch | {c1} ∩ {c2}, точка касания | row of the touching point |
| The point is inside the circle, so no line through it touches the circle | Точка внутри окружности, поэтому ни одна прямая через неё не касается окружности | reason `inside` |
| 0 at {p}; t is the distance from it | 0 в {p}; t — расстояние от этой точки | Inspector |
| the circle through {b} touching {c} at {a} | окружность, проходящая через {b} и касающаяся {c} в точке {a}; gen: окружности, проходящей через {b} и касающейся {c} в точке {a} | caption |
| the line through {b} touching {c} at {a} | прямая, проходящая через {b} и касающаяся {c} в точке {a}; gen: прямой, проходящей через {b} и касающейся {c} в точке {a} | caption |
| the disc bounded by the circle through {b} touching {c} at {a} | круг, ограниченный окружностью, проходящей через {b} и касающейся {c} в точке {a}; gen: круга, ограниченного окружностью, проходящей через {b} и касающейся {c} в точке {a} | caption |
| the outside of the circle through {b} touching {c} at {a} | внешность окружности, проходящей через {b} и касающейся {c} в точке {a}; gen: внешности окружности, проходящей через {b} и касающейся {c} в точке {a} | caption |
| the tangent to {c} at {a} | касательная к {c} в точке {a}; gen: касательной к {c} в точке {a} | caption (ctx `cap`; the row has its own entry) |
| the tangent to {c} through {p} | касательная к {c}, проходящая через {p}; gen: касательной к {c}, проходящей через {p} | caption |

That is 26 English strings and 32 Russian entries.

- In the captions, {c} is the carrier in the genitive. That form equals the dative for «окружности» and «прямой», so
  «касающаяся {c}» (genitive) and «к {c}» (dative) both read right.
- Russian uses the terms касательная, точка касания and касаться, as Шабат and БС do.
- The existing "{x} needs distinct points" reads «Касающаяся окружность: нужны различные точки».

## 6. Files

| File | Change |
|---|---|
| `src/constr.js` | section 3 (`tangent-scratch/tpatch.js` is the exact text, applied after perp's patch) |
| `src/construct.js` | section 4 |
| `notes/i18n/ru/v16-touch.json` | new: section 5 |
| `src/i18n_ru.js` | regenerated |
| `test/constr_touch_tests.js` | new: section F of t_constr.js |
| `test/t_constr.js` | calls section F and prints F in its summary |
| `test/touch_cmd.js` | new: the CDP check |
| `test/constr_cmd.js`, `test/perp_cmd.js` | Construct tile and rail counts go from 5 to 6, where they count them |

## 7. Tests

### `test/constr_touch_tests.js` (section F of `node test/t_constr.js`)

This is `tangent-scratch/tcheck.js` in the house style (`ok`, `near`), with the same 35 checks.

**The metric.** g / S, the overlap depth over the figure size:

- g = |1 − |cos∠(K, C)|| / |A_K − sgn(cos) A_C|, exactly from the floats (BigInt);
- S = the largest of |T|, |P|, |P − T| and |c_C| + r_C.

**Bounds:** g / S ≤ 1e−12 (measured 4e−16), and incidence ≤ 1e−15 S (measured 4e−16).

**touch:**

- 4000 random graphs: C a circle, line, segment, arc, or a disc and its complement; T a glider; P random;
- the meet rule: meet(K, C) is exactly T for index 0 and 1, in the graph and through `Constr.meets` on the pieces;
- the plain solver's failure rate is printed (at least 10 %);
- two touches at one T meet exactly at T;
- P = 0 exactly: anchored at 0, `thru0`, C = 0;
- sweeps on one state: T through the line case, P across the tangent, P across C. No undefined step and no flip;
- a glider on K stays continuous through the line case, and Use complement does not move it;
- the tangent at T is a line by kind; a glider on it sits at distance t from T;
- two tangents' meet is `'finite'` and comes back from ∞ past the antipode;
- the cases of `texp.js`: P near T, P near C, P = ∞, a huge, tiny or far C, a nearly collinear 3-point C.

**tangent:**

- 8000 lines; tp on K and on C;
- k = 0 is on the left (4000 of 4000), and the meet is tp exactly;
- `inside`; P exactly on C (f = 0 in the floats) gives both branches as the tangent with tp = P;
- C a line gives the exact parallel with tp = ∞;
- a flattening 3-point C: parallel, then `inside`.

**Plumbing:**

- `validate` (a bad sig is freed; the index is set to 0);
- the v16.2 `validate` frees both and keeps their fields;
- save, load and recompute are bitwise;
- `deletePlan` from C takes T, K and the touching points;
- `onCurveByRefs`: a glider, a meet, a line's ends, a polygon vertex on its two sides only, a circle3's points, and
  a bound handle are on C. A free point numerically on C, and a glider on another curve, are not;
- speed: `touchForm` and `tangentForm` each take under 5 µs (measured 1.7 and 1.1 µs).

### `test/touch_cmd.js` (CDP; its own `cdp_kit` copy, port 0, one browser; in the style of `perp_cmd.js`)

**A. Desktop 1440 × 900, light, English.**

- The 6th Construct tile and its tooltip.
- Order T → P. Pick the shown unit circle, then click its stroke at 1 (a glider T), then 2 + i. Check:
  - one undo step;
  - the row reads "through z₁, touching Circle 1 at z₀";
  - g / S ≤ 1e−12 from the hooks' forms, at rest and over 20 frames of dragging T once round, P across C, and P
    across the tangent at T.
- Order P → T gives the same circle.
- The curve stays picked.
- After T: the dashed hint is drawn with no hover. A click on it gives the tangent, with args[2] = `{inf: 1}`, and its
  row.
- After P = 2: two rings are drawn. A click on the upper ring gives a line and a point. The point equals tp exactly,
  and its row reads "Line 2 ∩ Circle 1, where they touch".
- Intersect on K and C gives one point, exactly T. The hover ring at T shows one crossing.
- P inside C: no rings. Drag P of a tangent inside: the `inside` reason; drag it out: the line comes back.
- Refusals:
  - a non-curve first;
  - after T, a point on C ("Click a point off Circle 1.");
  - after P, a point off C ("Click a point on Circle 1.");
  - the same point twice.
- Backspace, Esc, and the plane menu's "Touching circle…".
- ⋯ Region on a touching circle, and Use complement. A tangent line has no Region item.
- Delete C cascades; then Undo.

**B. Links.** Reload is bitwise. A link opens in a fresh namespace. The v16.2 dist opens it with the cached curves and
one toast.

**C. Russian.** The tile «Касание» fits 52 px; the chips, the rows, the `inside` reason and a caption read as in
section 5.

**D. Layouts.**

- Dark at 1440.
- 1024 × 768 and 768 × 1024: the rail fits.
- Phone 390 × 844, Android Chrome user agent, touch:
  - More tools shows 6 Construct tiles, and a tile closes the sheet;
  - the hint and the rings are drawn without hover;
  - a tap within 22 px picks the hint or a ring;
  - the chip's ×;
  - Russian.

**E. Export.** The 6 captions, in English and Russian.

**F. Performance.** Drag T and drag P with 10 touching circles and 10 tangents built on them, with 1/z in Y: BUDGET60
(p95 ≤ 16.7 ms). The draft's hint and rings are drawn while hovering with 20 shapes on the page, with no frame over
budget.

**G. Y.** A touching circle on a target circle, through z₀″.

**H. Screenshots** to `notes/orthogonal-circle/shots-touch/`: desktop light and dark, tablet, phone, in English and
Russian.

**The existing gate, unchanged.** Run perp's files and the gate perp lists. Goldens must not change.

## 8. Not built now (ask the user if wanted)

These are one line each, and none of them blocks the build:

- **The circle with a given centre touching C.** There are two: the nearest and the farthest point of C.
- **The parallel through a point**, which is the tangent from a point to a line. The core has it, but the tool has
  no pick for it.
- **Circles touching two or three curves** (Apollonius). They have 2 to 8 branches each.

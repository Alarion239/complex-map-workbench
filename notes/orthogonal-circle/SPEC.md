# Perpendicular circle: spec (final)

The user, 2026-10-25: "I would like to be able to draw circles perpendicular to lines/circles. Add this little
function please".

One new tool in the Construct group and one new construction op, `perp`. The result is an ordinary generalized
circle (`s._g`), so every renderer draws it as it draws a circle through 3 points. Nothing else is added.

- **Base:** `notes/v16.2-candidate/src`. Its constr.js, construct.js and i18n.js are byte-identical to v16.1's.
- **Inputs:** `DESIGN.md` (the proposal), `exp.js` (its numerical study).
- **Critic's evidence:**
  - `proto/patch.js` applies section 3 below to a copy of constr.js, giving `proto/constr.js`. That copy is the
    reference text for the core.
  - `proto/check.js` passes 41 of 41; the output is in `proto/check-output.txt`.
  - The existing `test/t_constr.js` passes 164 of 164 against `proto/constr.js`, the same as on v16.2.

## 1. What changed from DESIGN.md

The maths in DESIGN.md holds up. The exact cross product is right. I measured it again: across every hard case, the
worst |cos| is 8e−15, the incidence error is 3e−16·|PQ|, and an evaluation takes 1.7 to 2.6 µs. I changed these
points:

1. **K remembers its points.** K now keeps P and Q (`withPts`) and `e = |PQ|`, as circle3 does.
   - With the points, K meets the line PQ at exactly P and Q (checked). Before, the meet came from solving two nearly
     equal curves.
   - With `e`, the "curves coincide" test also covers a K that is a line to within rounding.
2. **Q exactly 0 is handled exactly.** DESIGN re-anchored at Q in floating point. Now the two point rows are swapped
   and the sign flipped, which is exact. P = ∞ is handled the same way. Both swaps keep the orientation (checked).
3. **No overflow or underflow.** DESIGN rounded each coefficient with `2 ** e`, which overflows or underflows at
   extreme exponents. The three exact results are now scaled by one shared power of two, then rounded with
   `ldexp`. A circle of radius 1e±150 now works (checked).
4. **Gliders on K ignore Use complement on K.** The glider parameter undoes K's own flip:
   mR(flip G, −τ) = mR(G, τ). Without this, Use complement on K mirrored every point on K.
5. **The "symmetric points" reason has no names.** `reasonText(u)` only gets the code, so it cannot name the
   points. The text is now generic.
6. **The test section is E, not D.** Section D of `t_constr.js` already exists (the review fixes). `NEED.perp` is 2,
   not 3. The curve goes in `draftC.curve1`, as for Intersect, so the chip counts "Point 1 of 2".
7. **The preview draws huge radii with `Constr.sampleMR`.** circle3's preview draws nothing when the radius is
   1e6 px or more, so DESIGN's "as circle3's preview" was wrong. A drawn tangent line would be about 2 px off at the
   pane's edge.
8. **The first pick takes exact curves only.** It skips freehand and formula curves, so a traced curve near a
   circle never takes the pick (`snapAt` gets an `exact` option).
9. **Two user-side fixes, small but they decide whether the tool feels quick:**
   - **The shown unit circle and the axes can be picked as the curve.** Each becomes a shape, in the same undo step.
     DESIGN left this as an open question. Without it, the first thing a user of the disc or half-plane model clicks
     (the shown unit circle, or the real axis) answers "Click a line or a circle."
   - **The curve stays picked after each circle.** So several geodesics of one disc take 2 clicks each, not 3.
     Backspace with no points, or Esc, drops the curve.
10. **Two corrections to the Russian strings:**
    - The rows use the established colon form [C26]: «ортогонально кривой: {c}».
    - The caption's {c} slot is C's carrier: a circle or a line, never a disc phrase. «ортогональная» takes the
      dative, and only «окружности» and «прямой» have the same form in the genitive and the dative.

## 2. The maths (as built)

**The form.** A generalized circle is f(z) = A|z − o|² + 2 Re(B̄(z − o)) + C, with |B|² − AC = 1, as in v16.

**The idea.**

- A point z lifts to the row (|z − o|², 2(z − o), 1).
- A curve G lifts to the row (−C_G/2, B_G, −A_G/2).
- A form passes through z when its coefficients are orthogonal to z's row.
- A form crosses G at right angles when its coefficients are orthogonal to G's row.

So K is the null vector of two point rows and one curve row. Anchored at P (C_K = 0), it is a cross product:

    d = Q − P;  (A', B', C') = C's form re-anchored at P, so C' = f_C(P)
    A = 2·cross(d, B'),  Bx = −dy·C' − |d|²·B'y,  By = |d|²·B'x + dx·C',  C = 0,  o = P
    Q = ∞:  A = 0, B = (−B'y, B'x)          (the line through P along C's normal)

**Exactness.** Every step is exact in dyadic BigInt on the doubles: d, the re-anchoring, and the products. The three
results are scaled by one shared power of two, rounded once, and normalized with `gc`.

**Undefined cases.** All three tests are exact zero tests, with no tolerance:

- A = B = 0 is `pencil`: Q is P's mirror image P* in C, so every circle through P and Q crosses C at right angles.
  This also covers P at C's centre with Q = ∞.
- P = Q by value is `coincide`.
- P and Q both ∞ is `lineInf`.

**Anchor.** The anchor is P. It is Q (rows swapped, sign −1) when P = ∞, or when Q alone is exactly 0. A K through
0 is then anchored at 0, with `thru0` set (the Λ rule [C9]).

**The line case.** K is a line exactly when C's centre is on the line PQ, or when C is a line and PQ is
perpendicular to it.

- When C is anchored at its centre (B = 0: a circle, disc, annulus, or sector arc),
  A = −2·A'·orient(c, P, Q). So `orientD(c, P, Q) = 0` (the decimal rule [math-3]) makes K the line PQ, with the
  side the cross product gives.
- Checked: grid points on a line through the centre 0.9(−1 − i) give the line, where the doubles alone give a
  circle of radius 1.6e15.
- No decimal rule is added for a line C. That case gives a circle of radius about 1e16, which is drawn exactly. The
  row text is the same; only the tooltip equation differs.

**C's form.** C contributes the form of the picked piece's curve (`pc.G`), never its region's. For a circle3 or perp
C with `def.flip`, the flip is undone. So Use complement on C never turns K over (checked for both).

**Orientation and region.**

- K agrees with circle3(P, Q, P*) as an oriented curve whenever P is inside C (786 of 786 cases), and is opposite
  when P is outside.
- At creation, `def.flip` makes K the disc. A line keeps the left side of P → Q (the circle3 rule).
- After creation, K follows continuously. As C's centre crosses PQ, the region goes disc → half-plane → outside, and
  A changes continuously (checked).
- Use complement toggles `flip`.

**Gliders on K.** They use the M(ℝ) map anchored at P: z(t) = mR(K at P, sg·|PQ|·tan πt), with sg = −1 when K is
flipped.

- P is at t = 0. The point opposite P is at t = ½; that point is ∞ when K is a line. When K is a line, t = ¼ is at
  distance |PQ| from P.
- `projectPiece` inverts the map: τ = (w − o) / (i(B + A(w − o)/2)). The round trip is exact to 1e−12.
- The parameter is continuous through the line case: in steps of 5e−4, a glider moves at most 1.8e−3 per step.
- With P = ∞, the anchor is Q with scale 1. That is a jump, but only through a parallel-lines event.

**Meets with K.** K's piece gets the `c3` flag, so a K that is momentarily a line keeps the entering rule and never
stores `'finite'` (math-5).

- K ∩ C is a right-angle crossing, never tangent, so its two indices never swap. While P is dragged across C, both
  meets stay defined and move continuously (checked).
- K ∩ a line through K's line case: indices 0 and 1, continuous (checked).

## 3. Core: src/constr.js (+110 lines; exact text in `proto/patch.js`)

1. **`perpForm(Gc, P, Q)`** → `{G}` or `{undef: 'pencil' | 'coincide' | 'lineInf' | 'notCircle'}`.
   - Add the dyadic helpers `dz`, `dmul`, `dadd`, `dneg`, `dsub` and `dScaled`, built on the existing `decompose`
     and `ldexp`.
   - Place it before `recompute`, and export it.
2. **`evalNode`: the `op === 'perp'` branch**, before `meet`/`glider`.
   - Args: `[{s, part}, P, Q]`.
   - If C is undefined, the result is `argUndef {x}`.
   - If the piece is not of kind `line` or `circle`, the result is `notCircle {x}`.
   - Then: undo C's flip, resolve P and Q, and call `perpForm`.
   - At creation, set `def.flip` (the circle3 rule).
   - Set `withPts(G, [P, Q])`, `G.e = |PQ|` (finite P and Q only), and `thru0` when anchored at 0.
   - Finish as circle3 does: `fieldsOfForm(G, fill === 'in')`, `setKind`, `s._g = G`.
3. **`pieces`:** set `c3` for `perp` too.
4. **`OPS.perp = {n: 3, sig: ['c', 'p', 'p']}`.**
   - `validate` gets a `sig` branch: curve refs where `sig` is `'c'`, point refs elsewhere.
   - Normalizing `fill` and `flip` covers `perp`.
   - The v16.1 and v16.2 `validate` free a `perp` shape and keep its fields (checked). The app then shows its
     existing "Some constructions could not be read…" toast.
5. **Gliders.**
   - `pts3In` returns `{mr: P, s: |PQ|, sg}` for a `perp`, or `'inf'` when an argument is undefined.
   - `glide` and `projectPiece` get a branch on `pts3.mr`, placed before the circle3 branch.
6. **`describe`:** `fill` for `perp`.

## 4. Interface: src/construct.js (about 130 lines)

**Tool registration.**

- Add `CTOOLS = [..., 'perp']` and `NEED.perp = 2`. P and Q are the picks; the curve is `draftC.curve1`.
- Add a helper, `isCirc3 = (s) => s.def && (s.def.op === 'circle3' || s.def.op === 'perp')`. It replaces
  `op === 'circle3'` in `pts3Of`, `rowMenu` (Curve | Region, Use complement), `inspectorBuild` (the same controls)
  and `paletteActs` (Use complement).
- `toolRows()` gets
  `['perp', $t('Perpendicular circle'), '', $t(<description>), 'construct', $t('Perpen­dicular')]`. app.js
  builds the tile, the rail icon (after circle3's separator) and the phone's More sheet from it, with no change.
- `ICON.perp`: a line, a half-circle on it, two dots on the half-circle, and a right-angle mark at its right foot:

      tsvg('<path d="M2.5 14.5h15"/><path d="M4.5 14.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 12.4h2.1v2.1" stroke-width="1.1"/>'
           + dot(6.1, 10.62) + dot(12.8, 9.77))

  The dots are exactly on the arc (centre (10, 14.5), r = 5.5). DESIGN's (6.1, 10.6) and (12.8, 9.7) were 0.06 px
  off it.
- `toolName.perp` is "Perpendicular circle". `toolShort.perp` is the tile text.

**Picking the curve** (`click`, when `draftC.curve1` is empty or its shape is gone):

- Take `snapAt(side, x, y, {points: false, cross: false, curves: true, exact: true})`. The new `exact` option skips
  every piece that is not of kind `line` or `circle`.
- If there is none, take the nearest **shown display curve** within the curve radius (6 px, or 10 on touch):
  - the unit circle, when `S().unit` is on;
  - the real axis and the imaginary axis, which every flat plane draws (follow the renderer's flag if one view hides
    them).
- A display curve becomes `A.newShape('circle', {c: [0, 0], r: 1})` or `A.newShape('line', {a: [0, 0], b: [1, 0]})`
  (for the imaginary axis, `b: [0, 1]`), kept in `curve1.make`. The shape is created at the click, never on hover,
  because `newShape` uses up an id.
- If nothing is within reach: toast "Click a line or a circle." and keep the draft.
- After the pick, the curve is drawn 4 px wide at 35 %, as Intersect's first curve is.

**P and Q.** These use the existing path for point picks:

- points, handles, crossings, zeros of f₁, and F(z₀) in Y;
- a click on a stroke makes a point on that curve. On C itself, K crosses C there;
- empty space makes a free point;
- the same ref twice: "{x} needs distinct points".

**Finishing** (`finish`):

1. Get K's starting fields from `Constr.shapeOf(Constr.perpForm(pc.G, P, Q).G)`. The shape is a `circle` with c and
   r, or a `line` with a and b. The def is `{op: 'perp', args: [curve1.ref, P, Q], fill: 'none'}`. The tool has no
   switch: the user asked for circles, and Region is in ⋯ and in the Inspector.
2. When C was materialized (`curve1.make`), it goes first in the same `create` call, so it is one undo step. Only
   then does K take `ci: A.nextCi(target, 1)`, so it is not the same colour as the new C. The preview uses the same
   colour.
3. **The curve stays picked:** `draftC = {tool: 'perp', side, picks: [], curve1: {cls: 'curve', ref, z}, hover:
   null}`. On every click, preview and chip, the guard `curve1Ok()` drops `curve1` when its shape no longer exists
   (after an undo).

**Keys.**

- Backspace drops the last point. With no points, it drops the curve.
- Esc cancels the draft, curve included. The second Esc reaches the app, as today.
- On touch, the chip's × does the same.
- `back()` gets the perp case. `keydown`'s `has` already counts `curve1`.

**Globe.** On a globe, the tool shows the toast "Click a line or a circle." It cannot pick a curve there, as
Intersect cannot.

**Chip** (`chipText`):

- before the curve: "Pick a line or a circle · Perpendicular circle · Esc cancels";
- then "Point {n} of 2 · …";
- on a narrow pane or touch: the tile text, without "Esc cancels". There is no Curve | Region switch.

**Hover.**

- Before the curve: the ring and chip on the exact curve, or on the display curve, with the chip "on the unit
  circle", "on the real axis" or "on the imaginary axis".
- `chipOf` uses `t.label` when a target has one: `$t('on {x}', {x: t.label || refName(t.ref)})`.
- After the curve: the existing point snapping.

**Preview** (`drawPreview`), in the next shape's colour, dashed:

- the highlighted C, then the picked P;
- after P, K through P and the pointer, from `Constr.perpForm(pc.G, P, hover)`, drawn as:
  - a line: `clipLine`;
  - r·scale < 1e6 px: `ctx.arc`;
  - otherwise: `Constr.sampleMR(G, pane.box(), 2 / pane.view.s)` as a polyline, which is exact at any radius;
- nothing while the curve is undefined (the pointer exactly at P*, or at P).

**Texts.**

- `defText` gets a `perp` case. Its `{a}` and `{b}` come from `refName(args[i], 'acc')`; its `{c}` is
  `curveName(args[0])`. A half-plane uses `hpOrder`, which already skips the curve argument because the curve
  ref resolves undefined.
- `reasonText`: `pencil` and `notCircle {x}`.
- `tMeaning`: "0 at {p}, ½ opposite it", where p is P's name.
- The plane menu (`menuItems`): on a stroke whose piece is a line or a circle, "Perpendicular circle…" calls
  `setTool('perp')`, then sets the draft with `curve1` = that target. That is one item, next to "Point on this
  curve".

**Export** (`phrase`):

- `perp` gets the 4 templates below. A half-plane reuses "the half-plane to the left of the line from {a} to {b}".
- `{c}` is C's carrier:
  - a circle3 or perp C with fill `none`: its own phrase (`A.capPhrase(C, 'gen')`);
  - otherwise, a synthetic `{kind: 'circle', c: pc.c, r: pc.r}` or `{kind: 'line', a: pc.a, b: pc.b}` through
    `A.capPhrase(…, 'gen')`.
- Add the 4 templates to `CAPTIONS`.

**app.js, one line.** In `cmUiApi`, `nextCi: (target, k = 0)` adds k to the list length:

    (target ? TARGET_CI[(S.targets.length + k) % TARGET_CI.length] : (S.shapes.length + k) % 8)

Calls without k behave exactly as now.

**No change** to gl.js, glsl.js, region.js, inverse.js, sphere.js, figure.js, phone.js or tour.js. There is no new
tour step: the Constructions chapter teaches the same picks. The guide does not list construction tools.

## 5. Strings (notes/i18n/ru/v16-perp.json; then `make_ru_table.py --strict`, 0 unresolved)

| English | Russian | Note |
|---|---|---|
| Perpendicular circle | Ортогональная окружность | tool name: tooltip, chip, palette |
| Perpen­dicular | Ортого­нальная | tile; soft hyphen in both (52 px tile) |
| Pick a line or a circle, then two points: the circle through them crosses it at right angles. The curve stays picked for the next one. | Выберите прямую или окружность, затем две точки: окружность через них пересечёт кривую под прямым углом. Кривая остаётся выбранной для следующей. | tooltip's second line |
| Pick a line or a circle | Выберите прямую или окружность | chip, before the curve |
| Click a line or a circle. | Щёлкните прямую или окружность. | toast: a miss, or a globe |
| through {a} and {b}, perpendicular to {c} | через {a} и {b}, ортогонально кривой: {c} | row (a, b: ctx acc) [C26] |
| the line through {a} and {b}, perpendicular to {c} | прямая через {a} и {b}, ортогональная кривой: {c} | row |
| the disc through {a} and {b}, perpendicular to {c} | круг, ограниченный окружностью через {a} и {b}, ортогональной кривой: {c} | row |
| outside the circle through {a} and {b}, perpendicular to {c} | внешность окружности через {a} и {b}, ортогональной кривой: {c} | row |
| The points are symmetric in the curve: every circle through both is perpendicular to it | Точки симметричны относительно кривой: любая окружность через них ей ортогональна | reason `pencil` (Ahlfors' "symmetric"; Шабат: «симметричные относительно окружности») |
| {x} is not a line or a circle | {x}: не прямая и не окружность | reason `notCircle` [C26] |
| Perpendicular circle… | Ортогональная окружность… | plane menu on a curve |
| 0 at {p}, ½ opposite it | 0 в {p}, ½ — в противоположной точке | Inspector: t on K |
| the unit circle | единичная окружность | hover chip "on {x}" («привязка: {x}») |
| the real axis | действительная ось | hover chip |
| the imaginary axis | мнимая ось | hover chip |
| the circle through {a} and {b} perpendicular to {c} | окружность, проходящая через {a} и {b} и ортогональная {c}; gen: окружности, проходящей через {a} и {b} и ортогональной {c} | caption; c: the carrier in the genitive, which equals the dative for «окружности» and «прямой» |
| the line through {a} and {b} perpendicular to {c} | прямая, проходящая через {a} и {b} и ортогональная {c}; gen: прямой, проходящей через {a} и {b} и ортогональной {c} | caption |
| the disc bounded by the circle through {a} and {b} perpendicular to {c} | круг, ограниченный окружностью, проходящей через {a} и {b} и ортогональной {c}; gen: круга, ограниченного окружностью, проходящей через {a} и {b} и ортогональной {c} | caption |
| the outside of the circle through {a} and {b} perpendicular to {c} | внешность окружности, проходящей через {a} и {b} и ортогональной {c}; gen: внешности окружности, проходящей через {a} и {b} и ортогональной {c} | caption |

That is 20 English strings and 24 Russian entries (the 4 caption `gen` forms are ctx entries). The existing
"{x} needs distinct points" reads «Ортогональная окружность: нужны различные точки».

## 6. Files

| File | Change |
|---|---|
| `src/constr.js` | section 3 (`proto/patch.js` is the exact text) |
| `src/construct.js` | section 4 |
| `src/app.js` | `nextCi(target, k)`, one line |
| `notes/i18n/ru/v16-perp.json` | new: section 5 |
| `src/i18n_ru.js` | regenerated |
| `test/constr_perp_tests.js` | new: section E of t_constr.js |
| `test/t_constr.js` | calls section E, and prints E in its summary |
| `test/perp_cmd.js` | new: the CDP check (section 7) |
| `test/constr_cmd.js` | its Construct tile count and rail checks change from 4 to 5, if it counts them |

## 7. Tests

### `test/constr_perp_tests.js` (section E of `node test/t_constr.js`)

This is `proto/check.js` in the house style (`ok`, `near`), with the same 41 checks. Thresholds: |cos| ≤ 1e−13 and
incidence ≤ 1e−15·|PQ|; the measured values are in `proto/check-output.txt`.

**The core:**

- 10⁴ random cases;
- P at 10⁻² to 10⁻¹⁶ from C, on both sides, and exactly on C (Pythagorean points);
- P and Q both on C;
- P at the centre: A = 0 exactly;
- Q at 10⁻³ to 10⁻⁹ from P*;
- C of radius 1e9, 1e−6, at 1e6(1 + i), and 1e±150; a 3-point C through nearly collinear points;
- Q = ∞;
- `pencil` (0.5 and 2 for the unit circle; i and −i for ℝ; 0.25(1 + i) and 2(1 + i)), `coincide` and `lineInf`.

**Anchors and orientation:**

- Q exactly 0 gives the same oriented K as Q = 1e−300;
- P = ∞ agrees in orientation with P far away;
- K = circle3(P, Q, P*) as an oriented curve when P is inside C, and the opposite outside.

**The graph:**

- creation gives the disc, at right angles to C;
- P dragged across C: no undefined frame, |cos| ≤ 1e−14, continuous levels;
- P at the centre (0): a line with `thru0`; Q at 0: anchored at 0;
- the decimal rule;
- C's centre crossing PQ: disc → half-plane → outside.

**Use complement and curve kinds:**

- Use complement on a disc C, and on a 3-point C, does not turn K over;
- a chain (perpendicular to a perpendicular circle);
- C as a polygon side, an arc, a half-plane edge, a sector's arc and edge, an annulus circle, and a segment;
- a freehand C gives `notCircle`.

**Gliders:**

- continuous through the line case;
- t = ¼ is at |PQ| from P when K is a line;
- Use complement on K does not move them;
- the `projectPiece` round trip.

**Meets:**

- K ∩ C stays continuous while P crosses C;
- K ∩ a line through the line case, with no `'finite'` index;
- K ∩ line(P, Q) is exactly {P, Q}.

**Plumbing:**

- save, load and recompute are bitwise identical;
- a wrong signature is freed with its fields kept;
- the v16.1 `validate` frees `perp` and keeps the disc;
- `deletePlan` from C or from P takes K and the glider on it;
- `moveRoots` is null for a free C, and gives all five points for a 3-point C;
- `describe`;
- speed: `perpForm` under 5 µs, and a drag with 10 dependents under 1 ms CPU per recompute (measured: 1.7 to 2.6 µs
  and 0.05 to 0.1 ms).

### `test/perp_cmd.js` (CDP; its own `cdp_kit` copy, port 0, one browser; in the style of `constr_cmd.js`)

**A. Desktop 1440 × 900, light, English.**

- The fifth Construct tile and its tooltip.
- With Unit circle on, click the shown unit circle. Circle 1 appears only when K is made.
- Click z₀ (snapped 0.3 + 0.2i), then an empty spot. Check:
  - one undo step removes K, the free point and Circle 1;
  - K's colour differs from Circle 1's;
  - the row and the Inspector read "through z₀ and z₁, perpendicular to Circle 1";
  - |cos| ≤ 1e−12 from the hooks' forms, at rest and over 20 frames of a z₀ drag that crosses the circle (no
    undefined frame, no flip).
- The curve stays picked: two more clicks make a second K. Backspace drops the curve, and the chip reads "Pick a line
  or a circle" again.
- A pick on C's stroke makes a point on C, and K crosses C there at right angles.
- A pick of the real axis makes Line 1, through 0 and 1: the half-plane model.
- P on a disc's centre handle gives a line.
- The pencil (0.5 and 2) shows the reason, with the eye disabled. K comes back when Q moves.
- C as a polygon side, and as a 3-point circle.
- Refusals: empty space and a freehand curve give the toast, and the draft stays. Esc cancels. The plane menu's
  "Perpendicular circle…" starts the tool with that curve.
- ⋯ → Region gives the disc; Use complement; the family as C's centre is dragged across PQ.
- Delete C gives "Deleted Circle 1 and 1 shape built on it.", then Undo.

**B. Links.**

- Reload is bitwise.
- A link opens in a fresh namespace.
- The v16.2 dist opens the same link: the cached circle and the one toast "Some constructions could not be read…".

**C. Russian.**

- The tile «Ортого­нальная» and the English «Perpen­dicular» each fit 52 px, on two lines at most.
- The chip, the row, the reason and the caption read as in section 5.

**D. Layouts.**

- Dark at 1440.
- 1024 × 768 and 768 × 1024: the rail fits, and `fitRail` drops Grid and Polar grid first.
- Phone 390 × 844, Android Chrome user agent, touch:
  - the More sheet shows 5 Construct tiles, and a tile closes the sheet;
  - a curve pick within 10 px, point picks within 22 px;
  - the chip's ×;
  - the Russian sheet.

**E. Export.** The caption, in English and Russian, for a circle C and for a polygon-side C (the carrier line).

**F. Performance.** Drag P with 1 and then 10 dependent perpendicular circles (curves and regions), with 1/z in Y:
BUDGET60 (p95 frame ≤ 16.7 ms).

**G. Y.** A perpendicular circle in Y through z₀″, with C a target circle.

**H. Screenshots** to `notes/orthogonal-circle/shots/`: desktop light and dark, tablet, phone, in English and Russian.

**The existing gate, unchanged.** Run `constr_cmd`, the six acceptance files, the quality suite, `t_tour` (no tour
change), `t_i18n_keys` and `t_i18n_english`. Goldens must not change.

## 8. Not built now (ask the user if wanted)

- **The straight perpendicular** from P to C. It is perp(C, P, ∞), and the core supports it, but the plane has no
  pick for ∞. This is the one question to put to the user, in one line.
- **The circle with a given centre perpendicular to C.** It is a new op with its own undefined case.
- **Through P, perpendicular to two curves.** The core is ready: two curve rows. The pick order is ambiguous (is a
  click on a stroke the curve, or a point on it?).
- **A decimal line-case rule for a line C.** It would only change the tooltip equation, not the picture.

# Touching lines and circles: design

The user, 2026-10-25: "Together with perpendicular circles, I would like to add touching lines/circles (intersecting
in exactly one point)".

**Superseded where they differ by `TANGENT-SPEC.md` (final), section 1:** the meet rule moves to `meetsOf`, the tangent at
T is a line by kind, parallels copy C's B, lines get plain gliders, tangent lines have no Region, `NEED.touch = 2`, and
the Russian rows follow C26.

Built on v16.2 (`notes/v16.2-candidate/src`) and the perpendicular circle (`DESIGN.md` here). Evidence:
`tangent-scratch/texp.js` and `tinf.js` (node, about 3 s), output in `texp-output.txt` and `tinf-output.txt`. The
build list is `TANGENT-SPEC.md`.

## 1. In one paragraph

**Touching circle** is one more tool in the Construct group, next to Perpendicular circle. Pick a line or circle C,
then two points in either order: the point T on C where the new curve touches it, and a point P it passes through.
It draws the generalized circle K that touches C at T and passes through P. Two special picks give lines. After T,
the tangent line at T is shown dashed, and a click on it gives the tangent. After a point P off a circle C, the two
touching points of the tangents from P are marked on C, and a click on one gives that tangent line and its touching
point. K follows C, T and P, and it stays tangent to the last bit of the floating point: the gap between K and C at T
is at most 4e−15 of the figure's size in every case measured. Intersect on K and C gives T, once.

## 2. What touching means here, and how it is measured

Two generalized circles touch when they meet in exactly one point. In the v16 form (f = A|z − o|² + 2Re(B̄(z − o)) + C,
normalized |B|² − AC = 1) that is |cos∠(K, C)| = 1. Two lines touch only at ∞, so they are parallel.

A double root is ill conditioned. If the floats move K by one ulp, the one meet splits into two points about
√(ulp) apart, or into none. No construction in floating point can avoid that, so we measure tangency by the
**overlap depth** g instead:

- δ = 1 − |cos∠(K, C)|, computed exactly (BigInt) from the float coefficients;
- g = |δ| · ρ, with ρ = 1 / |A_K − sign(cos) A_C| (one over the relative curvature at T);
- g / S, with S the size of the figure: the largest of |T|, |P|, |P − T| and C's centre plus its radius.

g is how far the curves overlap, or how far apart they are, at T. It is first order in the errors. |δ| alone is not a
good measure: it is g/ρ, and ρ is tiny for a tiny K. The intersection's double root splits by 2√(2gρ). That is what
the touching rule in §4.4 removes.

## 3. The four variants

| Variant | Decision | Why |
|---|---|---|
| (1) touching C at a point T of C, through P | **Build.** The core op, `touch`. | It is linear, so it is unique and exact, as perp is (§4.1). P = ∞ gives the tangent line at T. |
| (2) the tangent lines from a point P to a circle C | **Build, in the same tool**, as op `tangent`. One line per click, with its touching point as a constructed point. | It is the classic touching line. It is quadratic (two lines, or none), but a closed form keeps it exact (§4.2). |
| (3) the circle with a given centre O touching C | **Leave.** Ask if wanted. | There are always two (the nearest and the farthest point of C), and it needs a third pick grammar. A better home is a snap in the existing Circle tool: the radius point snaps to "touching C". |
| (4) touching two curves through a point, or three (Apollonius), or through two points (PPC) | **Out of scope.** | Two to eight solutions, a branch to pick for each, and the conditioning of a double root in every one. Nothing here is a little function. |

## 4. The maths

### 4.1 touch(C, T, P): the tangent pencil at T

The circles touching C at T form a pencil. In the anchoring at T it is linear: K passes through T when C_K = 0, and
K is tangent to C at T when its normal B_K is parallel to C's normal there. Write B' for C's B re-anchored at T, and
d = P − T. Then K has two linear conditions on (A, B), and K is their cross product, as for perp:

    through P:               (|d|², 2dx, 2dy) · (A, Bx, By) = 0
    tangent at T:            (0, B'y, −B'x) · (A, Bx, By) = 0
    K = (A, B, C) = (−2 d·B',  |d|² B',  0),   anchored at T
    P = ∞:                   K = (0, B', 0)    the tangent line at T
    T = ∞ (C a line):        K = (0, B_C, 0) anchored at P    the parallel through P, which touches C at ∞

- **Exact.** B' and d are exact (BigInt, `decompose`, the helper perp adds for its re-anchoring), and each
  coefficient is rounded once. Measured: the overlap depth is at most 1.4e−16 S at random, and at most 4e−15 S in the
  hardest row (P at 1e−16 from C, where K is C itself). It is 1e−16 for C of radius 1e9 and 1e−6, for a unit circle
  at 1e6(1 + i), and for a 3-point C through nearly collinear points. T and P are on K to 2e−16 S. A float version of
  the same formula measures the same here. The exact one costs 1.1 µs, and it shares perp's helper, so we use it.
- **Why not "centre on T's normal, then circleCP".** It measures the same overlap depth, but it cannot make a line.
  It fails when P is on the tangent at T, and it is undefined 107 times in 2000 when P is at 1e−16 from C. The form
  passes through the line case continuously: one exact line in the sweep, with no flip.
- **Orientation.** B_K = |d|² B' points the same way as C's normal at T, so K agrees with C at T (cos = +1 when T is
  exactly on C). As a region: if P is inside a disc C, K's disc is inside C. If P is outside, K is outside C and
  touches it from outside (A < 0), and at creation `flip` makes it the disc, as circle3 does. A tangent line keeps C's
  side: the half-plane that holds C's disc. C contributes its curve form with its own `flip` undone, as for perp, so
  Use complement on C never flips K.
- **Undefined exactly when A = B = 0.** That is P = T (code `coincide`), or T exactly at C's centre (a crafted save
  only).
- **T must be on C.** The tool only lets T be a point on C by construction (§5.2). If T were off C by ε, K would touch
  the circle concentric with C through T, with a gap of ε. A glider's T is within an ulp of C, which is the 1e−16
  above.

### 4.2 tangent(C, P, k): the lines from P touching a circle C

Anchor at P. Let B' be C's B re-anchored at P, f = f_C(P), N² = |B'|² − A_C f (C's norm, about 1) and s² = A_C f
(the squared tangent length, times A_C²). All of B', f, N² and s² are exact (BigInt), then rounded once. Then:

    n = (N B' + σ s J B') / |B'|²,   J = rotation by 90°,  σ = +1 or −1
    K = (0, n, 0) anchored at P                       (n · B' = N exactly in reals: cos = +1)
    T = P + (σ s / A_C) J n                           its touching point (the double root)

- **Branch.** k = 0 is the line touching C on the left of the ray from P through C's centre, and k = 1 on the right.
  (With the σ above, σ = +1 gave T on the right in all 2000 random cases, so k = 0 uses σ = −1.) Each branch is
  continuous while P is outside C, and they never swap, because left and right of P → centre are defined
  everywhere outside.
- **Exact.** The overlap depth is at most 3.5e−16 S at random, and at 1e−21 to 1e−24 S for P near C, a huge C, a tiny
  C and a far C. The textbook way (T from the centre, then line2(P, T)) gives 2e−16 S at best and 0.69 S when P is at
  1e−16 from C. For P far away (1e9 r) δ grows to 2e−7, but the overlap depth stays at 2e−16 S. That is the
  direction of a line at distance 1e9 r, resolved to an ulp.
- **Degenerate cases.**
  - P exactly on C: s = 0, both branches are the tangent at P, and T = P.
  - P inside C: s² < 0 exactly, so it is undefined, with the new code `inside`. A float P at 1e−16 from C is inside
    about half the time, and that is decided exactly from its floats.
  - P on C is a square-root branch point. The tangent turns like √ε as P approaches C, which is continuous but fast
    (7e−5 per 1e−9 step at 1e−6 from C).
  - C a line, or a circle that is a line for the moment (a 3-point or perp C): both branches are the parallel
    through P, and T is ∞. That is continuous: as C flattens, both tangents tend to the parallel and both touching
    points tend to ∞.

### 4.3 Continuity and drags

Everything is recomputed from C, T and P by the generic graph, so any drag of P, of T (a glider sliding on C), of C's
handles or of C's own defining points keeps K tangent. That includes C following its own construction. Measured
sweeps, with the change of the level at 3 probes per step:

| Sweep | Change per step | Undefined steps | Flips of sign(A) |
|---|---|---|---|
| T slides on the unit circle through the angle where P is on T's tangent | 6e−7 per 1e−7 | 0 | 0 (one exact line) |
| P crosses the tangent line at T | 6e−6 per 1e−7 | 0 | 0 |
| P crosses C (K passes through C itself) | 5e−7 per 1e−7 | 0 | 0 |
| P passes T at 1e−3 | 1.0 per 1e−7 | 0 | 0 |
| T → ∞ along a line C | the gap to the parallel falls as 1/\|T\|: 5e−3 at 1e3, 5e−6 at 1e6 | 0 | — |
| tangent: P → C from outside | 7e−5 per 1e−9 (the √ branch) | only the step that lands inside | 0 |

- **P near T.** K swings fast there, because dK ~ dP/|P − T|². That is honest, as perp is near its pencil.
- **T beyond 1e9.** The level at fixed probes is limited by evaluating a form anchored 1e12 away (1.7e−4 at 1e12).
  The renderers re-anchor at the window (`sampleMR`), so the picture is not affected.

### 4.4 The touching rule for meets (needed)

With today's solver, Intersect on a touching pair is wrong a quarter of the time. In 5000 random (K, C) pairs it
gave no meet 1258 times, and two meets up to 6.3e−7 S apart the other times. The double root rounds either way.

The rule: in the `meet` branch of `evalNode`, if one curve is a `touch` or `tangent` shape whose C argument is the
other curve (the same s and part), the meet is K's touching point, for both indices: exactly T, or ∞ for a parallel.
Two `touch` shapes with the same C and the same T ref also meet at T. Intersect's crossing candidates list that point
once. So "intersecting in exactly one point" holds in the app, not just to rounding.

### 4.5 Gliders on K, and meets with other curves

- A point on a `touch` K uses the M(ℝ) map anchored at T, as perp does: T is at t = 0, and the point opposite T is
  at ½ (∞ when K is a line). It is continuous through the line case.
- A point on a `tangent` K uses the same map anchored at P, with unit |PT|: P is at 0, T at ¼, and ∞ at ½.
- `touch` pieces get the `c3` flag, because K can be a line for an instant, so meets keep the entering rule.
  `tangent` pieces are lines by kind.

## 5. Interface

### 5.1 One tool, or one tool with the perpendicular circle?

| | A separate tile, "Touching circle" (proposed) | One tile with a chip switch Perpendicular \| Touching |
|---|---|---|
| Picks | Its own grammar: one of the two points must be on C | Two grammars behind one tile; the switch changes what a click on C means |
| Discoverable | A tile and an icon that show touching | Touching is hidden behind a switch inside a draft |
| Phone | One more tile in More tools (6 under «Построения») | No tile, but a switch on the phone's draft chip, which is already full |
| Code | A row and an icon; the rest is shared with perp | The same code plus the switch state |

A separate tile reads better. The two tools share the pick of C, the preview and the rows, so the cost is one row in
`toolRows()`.

### 5.2 Picks

1. **C.** As for perp: a line or circle piece. A miss shows "Click a line or a circle.", and the curve is highlighted.
2. **The first point X.** Any point target, a click on a stroke (which makes a glider), or empty space (which makes a
   free point). Its role comes from incidence, so the order is free:
   - X is on C by construction: X is T. That covers a glider on C, a meet with C, one of C's defining points or
     handles, and a 3-point C's points. The test is a new `onCurveByRefs`, about 25 lines in constr.js.
   - Otherwise X is P.
3. **The second point.**
   - **After T:** any point, a stroke or empty space gives P. When C is not a line, the tangent at T is drawn dashed
     and thin. A click on that tangent (8 px mouse, 22 px touch, with existing points taking priority) gives
     P = ∞: the tangent line, stored as the ref `{inf: 1}`. Alt, or Snap off, places a free point instead, as
     everywhere.
   - **After P:** the point must be on C. A click on C's stroke makes a glider T. A click on a point on C uses it.
     Anything else shows "Click Circle 1 or a point on it." and keeps the draft.
     - If C is a circle and P is outside it, the two touching points of the tangents from P are drawn as hollow
       rings on C, with the two tangents dashed and thin. A click on a ring gives `tangent(C, P, k)` and its
       touching point, a `meet` of K and C: two shapes in one undo step.
     - If P is inside C, or C is a line, there are no rings.
   - Picking the same point twice is refused with "Touching circle needs distinct points".

On touch there is no hover, so the dashed tangent and the rings are what the user taps. That is why they are drawn
without a pointer.

### 5.3 Chip, preview, keys

**The chip** uses the existing draft chip, with no switch:

- "Pick a line or circle · Touching circle · Esc cancels" (perp's string);
- "Point 1 of 2 · …";
- after T: "Point 2 of 2 or the tangent · …";
- after P: "Touching point on Circle 1 · …".

A narrow pane or touch uses the tile name "Touching" and drops "Esc cancels".

**The preview** is in the new shape's colour and dashed, from the same functions:

- the highlighted C and the picked points;
- the dashed tangent hints and rings, thin, at 50 %;
- with hover, K through the pointer. After P, the preview is K touching C at the pointer's nearest point on C.
- A snapped tangent or ring draws that line at full preview strength, with the ring chip "tangent at z₀" or
  "tangent from z₁".
- No preview where K is undefined (the pointer at T).

**Keys.** Backspace drops the last pick, Esc cancels, and the chip's × cancels on touch. All of this is as for perp.

### 5.4 Everywhere else

- **Context menu** on a line-or-circle curve: "Touching circle…" starts the tool with that curve picked. It is one
  item, next to "Perpendicular circle…".
- **Phone and tablet.**
  - Desktop: the 6th Construct tile, so the second row has 2 tiles.
  - Tablet: one rail icon. `fitRail` drops the grids first, and the 768 and 1024 checks re-run.
  - Phone: More tools gets a 6th tile under «Построения». The tile closes the sheet, and the More key shows the
    icon.
- **Rows and the Inspector** (`defText`):
  - "touching Circle 1 at z₀, through z₁";
  - "the tangent to Circle 1 at z₀";
  - "the line touching Circle 1 at z₀, through z₁" (when the circle is a line for the moment);
  - "through z₁, parallel to Line 1" (T at ∞);
  - "the tangent from z₁ to Circle 1, left" or "…, right";
  - the touching point: "where Line 2 touches Circle 1";
  - regions: "the disc touching …", "outside the circle touching …", and "the half-plane of the tangent to Circle 1
    at z₀, on its side".

  Uses and Used by, Curve | Region, Use complement, Make free and Delete come through the op set that perp widens
  (circle3, perp, touch, tangent).
- **Reasons:**
  - `coincide`: "The points coincide";
  - new `inside` {p, c}: "z₁ is inside Circle 1: no line through it touches it";
  - perp's `notCircle`;
  - `lineInf`: T and P both ∞.
- **Globes:** no picks, as for perp and Intersect.
- **Y:** the same tool on side R with F(z₀) targets.
- **Palette:** "Touching circle".

## 6. Russian

The Russian terms are the standard ones: касательная (the tangent line), точка касания (the touching point) and
касаться (to touch). «Касаться» and «касательная к» take the genitive and the dative, and those forms are equal for
окружность and прямая (окружности, прямой). So the curve phrase in captions is the same genitive slot perp uses. Rows
use the apposition «кривой {c}», as perp does [C26].

| English | Russian |
|---|---|
| Touching circle (tool) | Касающаяся окружность |
| tile: Touching | Касание |
| Pick a line or a circle, then where the new circle touches it and a point it passes through, in either order. Click the dashed tangent for the tangent line, or a marked point for the tangent from a point. | Выберите прямую или окружность, затем точку касания на ней и точку, через которую пройдёт окружность (в любом порядке). Щелчок по пунктирной касательной даёт касательную, по отмеченной точке — касательную из точки. |
| Point {n} of {m} or the tangent | Точка {n} из {m} или касательная |
| Touching point on {c} | Точка касания на кривой {c} |
| Click {c} or a point on it. | Щёлкните кривую {c} или точку на ней. |
| touching {c} at {a}, through {b} | касается кривой {c} в точке {a}, проходит через {b} |
| the tangent to {c} at {a} | касательная к кривой {c} в точке {a} |
| the line touching {c} at {a}, through {b} | прямая, касающаяся кривой {c} в точке {a}, через {b} |
| through {b}, parallel to {c} | через {b}, параллельно кривой {c} |
| the tangent from {p} to {c}, left / right | касательная из {p} к кривой {c}, левая / правая |
| where {k} touches {c} | точка касания {k} и {c} |
| {p} is inside {c}: no line through it touches it | {p} внутри кривой {c}: ни одна прямая через эту точку её не касается |
| tangent at {a} / tangent from {p} (ring chip) | касательная в {a} / касательная из {p} |
| Touching circle… (menu) | Касающаяся окружность… |

The tile «Касание» has 7 letters, so it fits easily.

## 7. Tour, saving, captions

- **Tour:** no step, for the same reasons as perp. If the guide's Constructions paragraph lists the tools, it gets
  the name.
- **Saving:** `{op: 'touch', args: [{s, part}, T, P]}`, where P may be `{inf: 1}`, and
  `{op: 'tangent', args: [{s, part}, P], index: 0|1}`, each with `fill` and `flip`.
  - `OPS` gets touch `{n: 3, sig: ['c', 'p', 'p']}` and tangent `{n: 2, sig: ['c', 'p']}`, using perp's `sig`.
  - Links, autosave and undo need no new code.
  - Older builds free the shape and keep its cached fields, with the existing toast. v15.1 draws the cached curve.
- **Export captions** (EN / RU, plus the `.gen` forms):
  - "the circle touching {c} at {a} and passing through {b}" — «окружность, касающаяся {c} в точке {a} и проходящая
    через {b}»
  - "the tangent to {c} at {a}" — «касательная к {c} в точке {a}»
  - "the tangent from {p} to {c}" — «касательная из {p} к {c}»
  - "the line through {b} parallel to {c}" — «прямая, проходящая через {b} параллельно {c}»
  - the disc, outside and half-plane forms, as perp's.

## 8. Cost

- **constr.js, about 120 lines:**
  - `touchForm` and `tangentForm`;
  - two `evalNode` branches;
  - the touching rule in `meet`;
  - `onCurveByRefs`;
  - `OPS` and `validate`;
  - the `c3` flag, `glide` and `projectPiece`;
  - `describe`.
- **construct.js, about 180 lines:**
  - the tool row and icon;
  - the incidence-ordered picks;
  - the tangent hint and the rings as snap candidates;
  - preview, chip, `defText`, `reasonText`, `phrase`;
  - the menu item.
- **i18n:** about 25 entries.
- **No renderer change.**

## 9. Open questions for the user (one line each, not blocking)

- Want the circle with a given centre touching a curve? It would be a snap in the Circle tool.
- Want the tangents from a point to a line? Those are the parallel, touching at ∞.

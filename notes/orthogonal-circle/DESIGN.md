# Perpendicular circle: design

The user, 2026-10-25: "I would like to be able to draw circles perpendicular to lines/circles. Add this little
function please".

Built on v16.1 (`notes/v16.1-candidate/src`: constr.js, construct.js) and `notes/constructions-v16/SPEC.md`. One new
tool, one new op. Nothing new in the renderers: the result is an ordinary gcircle form (`s._g`), like a circle
through 3 points. Evidence: `exp.js` here (node, about 1 s), output in `exp-output.txt`.

## 1. In one paragraph

**Perpendicular circle** goes in the Construct group. Pick a line or circle C, then two points P and Q. It draws the
generalized circle K through P and Q that crosses C at right angles. C can be any line-or-circle curve on the page:
a circle, line, disc or half-plane edge, a segment, ray or polygon side (their line), an arc (its circle), or a
constructed circle or line. If P and Q are inside the unit circle, K is the hyperbolic line through them. If C is the
real line, K is the half-plane geodesic. If a point is on C, K crosses C at that point. K is a line exactly when C's
centre is on PQ. K follows C, P and Q, and the right angle holds to about 1e−14 in every case except one. That one is
Q exactly at P's mirror image in C: then every circle through P and Q is perpendicular to C, so K is undefined and
the row says why.

## 2. The maths

### 2.1 The definition, and why not literally circle3(P, Q, P*)

As a set, K is circle3(P, Q, P*), where P* is P's inverse in C (its reflection when C is a line). We do not compute it
that way. I measured both (`exp.js`; columns A and Z of the output):

| Case | circle3(P, Q, P*): worst \|cos∠(K, C)\| | Proposed: worst \|cos∠\| | Proposed: P, Q off K (÷\|PQ\|) |
|---|---|---|---|
| random (10⁴; circles and lines) | 2e−13 | 6e−15 | 3e−16 |
| P at 1e−6 from C | 3e−10 | 1e−16 | 2e−16 |
| P at 1e−12 from C | 3e−4 | 1e−16 | 2e−16 |
| P at 1e−16 from C | 1 (906 of 2000 undefined) | 1e−16 | 2e−16 |
| P exactly on C (circle; line) | undefined (P* = P) | 9e−17; 8e−17 | 2e−16 |
| P at 1e−12 from the centre; exactly at it | 2e−27; 0 | 2e−27; 0 (a line, A = 0 exactly) | 1e−16 |
| Q at 1e−3, 1e−6, 1e−9 from P* | 7e−11, 1e−7, 4e−4 | 9e−15, 6e−15, 8e−15 | 2e−16 |
| Q at 1e−9 from P | 4e−14 | 1e−14 | 1e−16 |
| Q = P* exactly | undefined | undefined (detected exactly) | — |
| Q = ∞ | 1e−13 | 3e−15 | 0 |
| C of radius 1e9; 1e−6; unit circle at 1e6(1 + i) | 7e−8; 5e−10; 2e−8 | 2e−16; 2e−15; 4e−16 | 3e−16 |
| C a circle through 3 nearly collinear points | 1e−13 | 2e−16 | 3e−16 |

The cos is computed exactly (BigInt) from the float coefficients of K and of C's form. So it measures the
construction's own error, not the error of evaluating it.

circle3(P, Q, P*) has three faults:

- **It loses the right angle near C:** the error is about 1e−16 / dist(P, C).
- **It is undefined on C.** There P* = P, so two of the three points coincide. That is exactly the case "perpendicular
  to C at a given point of C".
- **Its orientation flips when P crosses C**, because P* passes through P. In the continuity sweep in `exp.js`, the
  level at fixed probes jumps by 3.3 in one 1e−7 step. As a region, it would jump between the disc and its outside.

### 2.2 The computation (proposed)

Write a generalized circle as f(z) = A|z − o|² + 2 Re(B̄(z − o)) + C, the v16 form.

- **Lift a point** z to the row (|z − o|², 2(z − o), 1).
- **Lift a curve** G to the row (−C_G/2, B_G, −A_G/2).
- f passes through z when f's coefficients are orthogonal to z's row.
- f is perpendicular to G when they are orthogonal to G's row: B·B_G − (A·C_G + A_G·C)/2 = 0.

circle3 solves three point rows. The perpendicular circle solves two point rows (P, Q) and one curve row (C). That
is all of it.

Anchor at P, so C_K = 0 and the P row drops out. What is left is a 3-vector cross product:

    d = Q − P,   G' = C's form re-anchored at P: (A', B', C'), with C' = f_C(P)
    (A, Bx, By) = (|d|², 2dx, 2dy) × (−C'/2, B'x, B'y)
                = (2·cross(d, B'),  −dy·C' − |d|²·B'y,  |d|²·B'x + dx·C'),    C = 0,  o = P
    Q = ∞: the row (1, 0, 0), so (A, B) = (0, −B'y, B'x): the line through P along C's normal at P

- **Exact.** Every step is exact in BigInt: d, the re-anchoring, the products. Each coefficient is rounded once, then
  normalized with `gc`. This is `orient`'s dyadic arithmetic (`decompose`). It costs 1.5 µs per evaluation, against
  0.1 µs for circle3. With 50 dependents that is 0.08 ms per frame, so it is not worth a float filter. (One filter at
  1e−3 cut the exact path to 9 % of calls and still gave 4e−14, so it can be added later if a profile ever asks.)
  Float re-anchoring alone loses 7e−8 for a circle of radius 1e9. That is why the re-anchoring is exact.
- **Undefined exactly when A = B = 0.** That is P = Q, or Q = P*. It is an exact zero test: no tolerance.
- **The line case**, A = 0, is decided exactly by the data:
  - P bound to a disc's centre handle gives A = 0 exactly.
  - For a disc or circle shape C (a double centre c), A ∝ orient(c, P, Q). So use `orientD(c, P, Q)`, with the
    decimal rule of math-3. Grid points on a line through the centre then give the line through P and Q (`line2`),
    not a radius-1e15 circle.
  - C a line: A = 0 exactly when PQ is perpendicular to it. That comes out exactly for grid-aligned and 45° lines. A
    decimal rule for lines is not needed now.
- **The Λ rule [C9].** When P is exactly 0 it is the anchor: C = 0 and `thru0`. When only Q is 0, re-anchor at Q
  with C = 0, as circle3 does.
- **Which curve form C contributes.** It is the form of C's curve, not of its region: the piece's G (pieces already
  ignore `complement`), with a 3-point or perpendicular C's own `def.flip` undone. So "Use complement" on C never
  flips K.

### 2.3 Orientation and the region

The formula is continuous in C, P and Q. As an oriented curve, K agrees with circle3(P, Q, P*) whenever P is inside
C: 518 of 518 random cases, and 0 of 1482 when P is outside. So when P and Q are inside C (or on it), going from P to
Q along the arc of K inside C, K's interior is on the left: the hyperbolic half-plane left of P → Q.

The region follows the circle3 rules, unchanged (SPEC 2.3):

- At creation `def.flip` makes it the disc.
- If K is a line at creation, it keeps the left side of P → Q.
- Afterwards it follows continuously: disc, then half-plane, then the outside, as C's centre crosses PQ.
- Use complement toggles `flip`.

### 2.4 Degenerate cases

| Case | Result | Continuity |
|---|---|---|
| P on C (or Q on C) | K crosses C at P, at right angles | the same formula on both sides: no special case |
| P and Q both on C | the circle perpendicular to C at both (the geodesic between ideal points) | continuous |
| P at C's centre (P* = ∞) | the line through the centre and Q | continuous: A → 0, and the M(ℝ) sampler draws huge circles and the line alike |
| C's centre on line PQ | a line (`kind` line, or half-plane as a region) | the family changes in place, as circle3's does |
| C a line | P* is the reflection; K is centred on C | the same formula (A_G = 0) |
| P = Q (values) | undefined: `coincide`, "The points coincide" | (refs: the pick is refused, "needs distinct points") |
| Q = P* exactly | undefined: new code `pencil` {a, b, c} | near it K swings fast: honest, as circle3 does near two coincident points |
| P or Q = ∞ (a meet of parallel lines) | the line through the finite point along C's normal | continuous |
| P and Q both ∞ | undefined: `lineInf` | — |
| C undefined, or a piece with no carrier (a freehand or formula curve, a zero-length side) | undefined: `argUndef` {x} / new `notCircle` {x} | a pick never makes it; only a crafted save can |

**Gliders on K.** The plain circle parameter (angle / 360°) jumps when K passes through the line case. So a point on
K uses the M(ℝ) map anchored at P: z(t) = mR(K_P, |PQ|·tan πt). P is at t = 0. The point of K opposite P is at
t = ½, and that point is ∞ when K is a line. This is continuous everywhere, the analogue of circle3's
Möbius-through-3-points rule (math-12). In the Inspector, t reads "0 at z₀, ½ opposite it".

**Meets with K** keep the entering rule. The piece of a perpendicular circle is flagged as circle3's is (`c3`), so a
momentary line never stores `'finite'` (math-5).

## 3. Variants: what to build now

| Variant | Decision | Why |
|---|---|---|
| perpendicular to C at a given point X of C, through P | **Covered now, no entry.** | It is perp(C, X, P) with X on C. A pick on C's stroke makes a point on C (the construction tools already pick curves), and §2.4 is exact there. The tool's description says so. |
| the region (the disc K bounds) | **Not on the chip. The ⋯ menu and the Inspector get Curve \| Region, as circle3 has.** | The user asked for circles. The switch already exists, so the cost is generalizing `op === 'circle3'` to the set {circle3, perp}. The chip stays one line. |
| the circle with a given centre c perpendicular to C, r² = \|c − o\|² − R² | **Leave.** | A new op with its own undefined case (c inside C), and no line case (only c on a line C works). Ask if wanted. |
| through P, perpendicular to two curves C₁, C₂ | **Leave; the core is ready.** | It is two curve rows and one point row: the same cross product, about 30 lines plus a pick order. A third pick that may be a curve or a point would make clicks on strokes ambiguous (a point on the curve, or the curve?). Worth it if the user does hyperbolic perpendiculars. |
| the straight perpendicular line from P to a line C | **Leave as a tool.** | It is perp(C, P, ∞). The core supports ∞ arguments, but the tool has no ∞ pick in the plane (below). |

## 4. Interface

**The tool.** One row from `Construct.toolRows()`, so app.js's TOOLS needs no change:
`['perp', 'Perpendicular circle', '', <description>, 'construct', <tile>]`, with `CTOOLS` and `NEED` (`perp: 3`)
extended.

- Tile: **"Perpen­dicular"** (with a soft hyphen, like «Перпен­дикуляр»).
- Icon (20 px, the set's stroke style): a line, a half-circle centred on it, two dots, and a right-angle mark:
  `<path d="M2.5 14.5h15"/><path d="M4.5 14.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 12.4h2.1v2.1" stroke-width="1.1"/>`
  plus dots at (6.1, 10.6) and (12.8, 9.7).
- Description: "Pick a line or a circle, then two points: the circle through them that crosses it at right angles. A
  point on the curve makes it cross there."

**Platforms.**

- **Desktop:** the Construct grid gets a second row (5 tiles in 4 columns). Draw is about 60 px taller, and Shapes
  scrolls, as it does today.
- **Tablet:** the rail gets one more icon after circle3's divider. `fitRail` already drops Grid and Polar grid
  first, and the 768 × 1024 and 1024 × 768 checks re-run.
- **Phone:** More tools gets a fifth tile under «Построения». The tile closes the sheet, the More key shows the icon,
  and the draft chip carries the × (all existing, through `CTOOLS`).

**Picks.** All picks are clicks; a drag between picks pans.

1. **The curve.** Curves of the exact family only: `pieces` of kind `line` or `circle`, never `traced` or grids.
   - A click on a point takes the curve under it, as Intersect does.
   - A miss shows the toast "Click a line or a circle." and keeps the draft.
   - Touch uses the curve radius (10 px). The picked curve is highlighted as Intersect's first curve is: 4 px at 35 %.
2. **P, then Q.** Any point target: points, handles, zeros of f₁, crossings, F(z₀) in Y.
   - A click on a stroke makes a point on that curve. On C itself, that is the "at a given point of C" case.
   - A click on empty space makes a free point, in the same undo step.
   - Q = P (the same ref) is refused with "Perpendicular circle needs distinct points".

**Keys and undo.** Backspace drops the last pick; for the curve, the draft is cancelled. Esc cancels; on touch, the
chip's × does. Creating K is one undo step, with its free points.

**The chip** uses the existing draft chip, with no switch:

- before the curve: "Pick a line or circle · Perpendicular circle · Esc cancels";
- then: "Point 1 of 2 · …" and "Point 2 of 2 · …" (the existing `Point {n} of {m}`);
- a narrow pane or touch uses the tile name and drops "Esc cancels".

**The waiting preview** is in the colour the new shape will take, dashed like circle3's:

- the highlighted C;
- the picked P;
- after P, the dashed K through P and the pointer, from the same exact function. Below 1e6 px radius it is drawn as
  an arc, otherwise as a clipped line, as circle3's preview is;
- no preview while the pointer is exactly at P* (undefined).

No right-angle mark is drawn. It would be a new kind of overlay, and the result is the proof.

**The context menu** (the constructions group): on a line-or-circle curve, "Perpendicular circle…" starts the tool
with that curve as the first pick. That is one item, next to "Point on this curve". Nothing is added on points.

**Globes.** The tool does not pick on a globe, as Intersect does not: curves are picked in the plane. A click on a
globe shows "Click a line or a circle." So perp(C, P, ∞) is not reachable from the tool in v1. The core handles ∞
when an argument resolves to ∞.

**Y (targets):** the same tool, the same code path (side R), with F(z₀) as point targets.

**Rows** (`defText`):

- curve: "through z₀, z₁, perpendicular to Circle 1";
- line: "the line through z₀, z₁, perpendicular to Circle 1";
- region: "the disc through z₀, z₁, perpendicular to Circle 1", or "outside the circle through …";
- a half-plane reuses "the half-plane left of {a} → {b}".

The equation goes to the tooltip, the link highlights work, and an undefined K shows its reason with the eye
disabled. ⋯ adds Curve | Region, Use complement (Region only), Make free, and "Delete (and n built on it)".

**Inspector** (the Construction view):

- the definition as in the row;
- Uses: Circle 1, z₀, z₁;
- Used by;
- Curve | Region and Use complement, the same controls as circle3, through the shared set;
- Make free, Delete.

It never opens by itself.

**Palette:** "Perpendicular circle". When a perpendicular circle is selected, "Use complement" too, as for circle3.

**Delete, move, follow:** all generic.

- Deleting C or a point deletes K (it is a `def`).
- A press on K follows the existing rule. On a free C it pans, with the "Built on …" chip: a free shape's curve is not
  a point root, so `moveRoots` returns null. On a C built only on free points it moves them all.
- Dragging P, Q or C's handles recomputes K, with one undo step per gesture.

## 5. Russian

The GLOSSARY nouns are окружность, прямая and круг. «Ортогональная» is the standard Russian term for circles, as in
«окружности, ортогональные абсолюту». It also keeps the tile apart from the bisector's «Перпендикуляр».

Entries go in `notes/i18n/ru/v16-perp.json`. `make_ru_table.py` already reads `v16-*.json`. {c} is a curve's row
name. The colon and apposition forms avoid agreeing with an unknown noun [C26].

| English | Russian |
|---|---|
| Perpendicular circle (tool) | Ортогональная окружность |
| tile: Perpen­dicular | Ортого­нальная |
| Pick a line or a circle, then two points: the circle through them that crosses it at right angles. A point on the curve makes it cross there. | Выберите прямую или окружность, затем две точки: получится окружность через них, ортогональная выбранной кривой. Точка на самой кривой задаёт место пересечения. |
| Pick a line or circle (chip) | Выберите прямую или окружность |
| Click a line or a circle. (toast) | Щёлкните прямую или окружность. |
| through {a}, {b}, perpendicular to {c} | через {a} и {b}, ортогонально кривой {c} |
| the line through {a}, {b}, perpendicular to {c} | прямая через {a} и {b}, ортогонально кривой {c} |
| the disc through {a}, {b}, perpendicular to {c} | круг, ограниченный окружностью через {a} и {b}, ортогональной кривой {c} |
| outside the circle through {a}, {b}, perpendicular to {c} | внешность окружности через {a} и {b}, ортогональной кривой {c} |
| {a} and {b} are symmetric in {c}: every circle through both is perpendicular to it | {a} и {b} симметричны относительно кривой {c}: любая окружность через них ей ортогональна |
| {x} is not a line or a circle | {x}: не прямая и не окружность |
| Perpendicular circle… (menu) | Ортогональная окружность… |
| 0 at {p}, ½ opposite it (t) | 0 в {p}, ½ — в противоположной точке |

"Symmetric in a circle" is Ahlfors' term for inverse points, and «симметричные относительно окружности» is the
Russian one (Шабат). The screenshot check at 390 px covers the tile «Ортого­нальная» (13 letters, the length of
«Прямоугольник»).

## 6. The tour

No new step. The Constructions chapter teaches picking and following, and this tool picks the same way. A step would
cost the tour budgets in `t_tour` and `tour_cmd` for one more tool of the same kind. The tool's description carries
it. If the guide's Constructions paragraph lists the tools, add the name there: one string.

## 7. Saving, links, older builds

- **Saved as is:** `def = {op: 'perp', args: [{s, part}, P, Q], fill, flip}`, with the concrete fields (c, r or a, b)
  as the cache. Links, autosave and undo carry it with no new code.
- **Validation:**
  - `OPS.perp = {n: 3, sig: ['c', 'p', 'p']}`. `validate` gets a `sig` branch, since today an op's arguments are
    all points or all curves.
  - Normalizing `fill` and `flip` and `describe`'s `fill` move from `op === 'circle3'` to the set.
- **Older builds:**
  - v16.0 and v16.1 do not know `perp`. Their `validate` frees the shape and keeps its concrete fields, so the circle
    shows where it was, and they show the one existing toast "Some constructions could not be read…".
  - v15.1 ignores `def` and draws the cached circle.

## 8. Export captions

`phrase()` gains these templates. The curve-phrase slot ({c} below) is C's carrier: the circle (`|z − c| = r`, or a
3-point circle's own phrase) or the line (through two of its points), in the genitive. In Russian the genitive and
the dative are the same for «окружность» and «прямая», so «ортогональная {c}» reads right.

- "the circle through {a} and {b} perpendicular to {c}" — «окружность, проходящая через {a} и {b} и ортогональная {c}»
- "the line through {a} and {b} perpendicular to {c}" — «прямая, проходящая через {a} и {b} и ортогональная {c}»
- "the disc bounded by the circle through {a} and {b} perpendicular to {c}" — «круг, ограниченный окружностью,
  проходящей через {a} и {b} и ортогональной {c}»
- "the outside of the circle through {a} and {b} perpendicular to {c}" — «внешность окружности, проходящей через {a}
  и {b} и ортогональной {c}»
- the half-plane reuses the existing "to the left of the line from {a} to {b}";
- plus the four `.gen` forms, for when K is itself someone's {c}.

## 9. Code (estimate)

- **constr.js, about 90 lines:**
  - `perpForm(Gc, P, Q)`: exact, using `decompose`, the cross product, `gc`, and the `orientD` line rule;
  - the `perp` branch in `evalNode`, with the curve's form, flip, `thru0` and reasons;
  - `OPS` with `sig`, and `validate`;
  - the `c3` flag in `pieces`;
  - the glider's M(ℝ) parameter in `glide` and `projectPiece`;
  - `describe`;
  - export `perpForm`.
- **construct.js, about 140 lines:**
  - the tool row, icon, `CTOOLS` and `NEED`;
  - the curve pick in `click`;
  - preview, chip, `toolName` and `toolShort`;
  - `defText`, `reasonText` (`pencil`, `notCircle`), `phrase` and its `CAPTIONS`;
  - the menu item;
  - the circle3 checks in `rowMenu`, `setFill`, the Inspector, `paletteActs` and `tMeaning` widened to the set.
- **No change** to app.js, gl.js, glsl.js, region.js, inverse.js, sphere.js, phone.js or tour.js. Rendering is the
  existing gcircle path.
- **i18n:** about 20 entries, then `make_ru_table.py --strict` with 0 unresolved.

## 10. Tests

### `test/t_constr.js`, a new section D, "perpendicular circle" (node)

**Right angle and incidence.** Measured with `exp.js`'s exact cos: |cos∠(K, C)| ≤ 1e−12, and P and Q within
1e−15·|PQ| of K. The cases:

- 10⁴ random cases;
- P at 10⁻ᵏ from C (k = 2…16, both sides) and exactly on it: Pythagorean points on circles, grid points on lines;
- P and Q both on C;
- P at 10⁻ᵏ from the centre, and exactly at it: kind line, A = 0 exactly;
- Q at 1e−3, 1e−6 and 1e−9 from P*, and from P;
- Q = ∞;
- C of radius 1e9 and 1e−6, a unit circle at 1e6(1 + i), a 3-point C through nearly collinear points;
- C as a segment, a polygon side, an arc and a half-plane edge.

**Undefined, and set equality.**

- Q = P* exactly gives `pencil`: unit circle 0.5 / 2, the real line i / −i, and 0.25(1 + i) / 2(1 + i).
- P = Q by value gives `coincide`.
- Both points ∞ give `lineInf`.
- K equals circle3(P, Q, P*) as a set wherever that is well conditioned.

**Orientation and continuity.**

- K agrees with circle3(P, Q, P*) as an oriented curve when P is inside C.
- P swept across C in 1e−7 steps: the level at 3 probes changes by < 1e−6 per step, with no undefined step.
- C's centre swept across PQ: disc, then half-plane, then the outside, with A = 0 exactly at the collinear step
  (`orientD`, grid decimals).
- Use complement on C does not flip K.
- A glider on K is continuous through the line case.

**Plumbing.**

- `validate` accepts the `sig`, frees a bad signature, and frees `perp` under the v16.1 `OPS` (concrete fields kept).
- Save and load are bitwise.
- `deletePlan` cascades from C and from P.
- `moveRoots` returns null on a free C.
- Meets of K keep the entering rule.
- Speed: 10⁵ evaluations take under 0.3 s.

### `test/perp_cmd.js` (CDP; its own `cdp_kit` copy, port 0, one browser; the style of `constr_cmd.js`)

**A. Desktop 1440, light, English.**

- The fifth tile and its chip states. A unit circle drawn with Circle (0 through 1, snapped).
- Pick the circle, z₀, then an empty spot. One undo step. The row and the Inspector read "through z₀, z₁,
  perpendicular to Circle 1".
- |cos| ≤ 1e−12 from the hooks' forms, at rest and at 20 frames of a z₀ drag that crosses the circle (no undefined
  frame, no flip).
- A pick on C's stroke makes a point on C, and K crosses C there.
- P on the centre handle of a disc gives a line. A pencil (0.5 and 2) shows the reason, and K comes back when Q
  moves.
- C a line (i and 1 + i give a circle centred on ℝ; i and −i give the pencil). C a polygon side. C a 3-point circle.
- Refusals: empty space, a freehand curve, a formula curve.
- Backspace, Esc. The plane menu's "Perpendicular circle…".
- ⋯ Region gives the disc; Use complement; the region family as C's centre crosses PQ.
- Delete C gives "Deleted Circle 1 and 1 shape built on it.", then Undo.

**B.** Reload is bitwise, and a link opens in a fresh namespace. The v16.1 dist opens the link: the cached circle,
plus one toast.

**C. Russian.**

- The tile «Ортого­нальная» fits 52 px.
- The chip, row, reason and caption.

**D. Layouts.** Dark at 1440; 1024 × 768 and 768 × 1024 (the rail fits); phone 390 × 844 with an Android Chrome user
agent and touch:

- the More sheet shows 5 Construct tiles, and a tile closes it;
- a curve pick at 10 px, point picks at 22 px;
- the chip's ×;
- the Russian sheet.

**E. Export.** The caption text, EN and RU.

**F. Perf.** Drag P with 1 and 10 dependent perpendicular circles (curves and regions), 1/z in Y: BUDGET60 (p95
frame ≤ 16.7 ms).

**G. Y.** A perpendicular circle in Y through z₀″.

**H. Shots.** Desktop light and dark, tablet, phone, EN and RU, saved to `notes/orthogonal-circle/shots/`.

**The full existing gate.** Run it unchanged: `constr_cmd`, the six acceptance files, the quality suite, and
`t_tour` (no tour change). Goldens must not change. `constr_cmd`'s tile-count and rail checks may need 4 → 5.

## 11. Open question for the user (one line, not blocking)

The unit circle and the real axis are display toggles, not shapes. So for the disc or half-plane model the user
draws C first: Circle 0 → 1, or Line 0 → 1, both snapped. Offering the shown unit circle and axes as pickable
curves would need a new ref kind. Leave it, unless the user asks.

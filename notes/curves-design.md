# Curve formulas (1-dimensional regions): design and API

User request: "allow 1-dimensional regions, e.g. a line `Re z = 0`". Before this, the formula box only took `<`, `>`, `\le`, `\ge`:
`Expr.parse(..., {allowRel: true})` threw `Unexpected '='`.

What is done:
- **`src/parse.js`**: `=` is a relation, and `Expr.classifyRelation` decides whether a formula is an area or a curve.
- **`src/curves.js`** (new, global `Curves`): exact recognition, tracing, sampling and Region-compatible curve objects.
- **`test/t_curves.js`**: 210 checks (§9 covers the review fixes listed in §5). Run `node test/t_curves.js`.

The app wiring (§4) is done (2026-10-21): see §4.0 for what was built and how it is tested.

## 1. Parsing (`src/parse.js`)

- **Tokens.** In allowRel mode `=` is a relation, and so are `==` and the full-width `＝`. The AST node is `{t: 'cmp', op: '=', a, b}`.
  - Without allowRel nothing changed: `=` still throws `Unexpected '='` at the same position.
- **Typos.** In allowRel mode `=<` and `=>` throw "'=<' is not an operator: did you mean ≤ (<=)?" (and ≥) at the `=`. Without allowRel they still throw `Unexpected '='`.
- **Chains.** `a = b < c` is the `and` of its links, as `1 < |z| < 2` already was. Links after the first carry `chain: true` only in a chain with an equation (an `=` can only parse in allowRel mode), so chains of inequalities such as `1 < |z| < 2` have exactly their old AST.
  - `Re z = 0 < Im z` is therefore the ray `Re z = 0, Im z > 0`.
  - `a = b = c` is an error with its own message.
- **`Expr.toTex`** prints `=`, and its output parses back to the same formula (tested).
- **`Expr.compileLevel`** refuses equations with `ParseError` "An equation (=) describes a curve, not a filled region: use <, >, ≤ or ≥ for an area".
  - Until the wiring lands, the formula box shows this message instead of `Unexpected '='`.
  - Area formulas compile exactly as before.
- **`Expr.classifyRelation(ast)`** returns one of:
  - `{dim: 'area'}`: inequalities only, unchanged.
  - `{dim: 'curve', pieces: [{eq, restrict, real}]}`:
    - The set is the union of the pieces. `eq` is one `=` node. `restrict` is an area AST (or `null`) that must also hold.
    - `or` unites curves. `and` / `,` with inequalities restricts them; `and` is distributed into every piece.
    - `real` says how the two sides of the equation were found to be real:
      - `'structural'`: built from Re, Im, |·|, arg, x, y, r, θ and real constants.
      - `'numeric'`: real at every test point, e.g. `z\bar z = 1`.
      - `'partial'`: real on only part of the plane, e.g. `\ln(\operatorname{Re} z) = 0`. The curve lives where the difference of the sides is real.
      - `'complex'`: complex sides whose difference D = A − B still vanishes along a curve: `z = \bar z`, `\bar z = 1/z`, `z - \bar z = 2i`, `z^2 = \bar z^2`. The piece then carries `dir`, a unit complex c: the curve is the part of Re(D c̄) = 0 where Im(D c̄) = 0 too. Found by bisecting sign changes of Re(D c̄) along chords between probe points (scaled ×1, ×24, ×600) and requiring |D| at rounding level there at least twice; a chord almost never meets an isolated zero.
    - The same equation twice joined by `and` (`Re z = 0 and Re z = 0`) is one piece.
  - `{dim: 'none', error}`: no comparison at all.
  - `{dim: 'error', error}`. The texts are in `Expr.REL_MSG`:

    | key | example | why it is refused |
    |---|---|---|
    | `points` | `Re z = 1, Im z = 2` | two equations that must both hold meet at isolated points |
    | `chain` | `Re z = Im z = 0` | a chain asks for two equations at once |
    | `mix` | `Re z = 0 or \|z\| < 1` | mixes a curve with an area |
    | `not` | `\neg(Re z = 0)` | the plane minus a curve is not a curve |
    | `complex` | `z = 1`, `z^2 = i`, `\bar z = z^2` | complex sides, and no curve was found where real and imaginary parts both agree; the message suggests Re, Im, \|·\| or arg |
    | `region` | `\log(e^z) = z`, `\|Re z\| = Re z` | the sides agree on an open set (at a probe point and at three points 1e-3·\|p\| around it) |
    | `constant` | `1 = 1` | does not involve z |
    | `identity` | `\|z\| = \|z\|` | true for every z |
    | `undefined` | — | not finite anywhere |

- **`Expr.realOf(ast)`** is the structural realness test, returning `{real, nonneg}`.

## 2. `src/curves.js` API

`Curves` needs `CX` and `Expr`. It uses `Region` only when it samples exact shapes or builds curve objects (`curvesOf`, `polyCurve`, `sampleCurve`). In `build.py` it goes **after `region.js`** in the file list (not added yet). In node: `module.exports`, with `CX`, `Expr`, `Funcs` and `Region` as globals (see `test/t_curves.js`).

| call | returns |
|---|---|
| `Curves.dimOf(srcOrAst)` | `{dim: 'area' \| 'curve' \| 'none' \| 'error', error?, pos?}`. Never throws, so it is safe for routing the formula box. |
| `Curves.fromFormula(srcOrAst, {exact?: false, win?})` | a description (below). Throws an `Expr.ParseError` (`Curves.CurveError`, with `e.dim`) for syntax errors, every classification error, and area formulas (`e.dim === 'area'`). |
| `Curves.trace(desc, win, o?)` | `{polys: [{pts: Float64Array, closed, ends, piece, exact, shape?}], points: [{p, piece}], notes: [string]}`, cached on `desc` per window and options (all of `res, margin, depth, step, maxTail, maxEval, maxMs, tails`). `notes` are about this window's trace (show them with `desc.notes`). |
| `Curves.sample(desc, win, o?)` | `[Float64Array]` like `Region.sampleCurve`, each with `.closed`, `.ends`, `.inf = [bool, bool]` and `.piece`. A closed polyline repeats its first point at the end. |
| `Curves.curvesOf(desc, win, o?)` | Region curve objects (`{f, n0, closed, ...}`) for `Region.mapCurve`, `hitTest`, `sphereCurvesOf`-style code and `Lines.refine`. |
| `Curves.loops(desc, win)` | closed loops `[{pts, area, piece}]`, simple and counterclockwise (a figure-eight is split at its crossing into its two lobes). |
| `Curves.isClosed(desc, win)` | true when every component is a closed loop: the curve bounds something, so integrals around it make sense. |
| `Curves.shapesOf(desc)` | the exact shapes of every exactly recognized piece. |

`curvesOf` in detail:
- It traces with the same options `o` as `sample`, so drawing and hit-testing/mapping use the same polylines.
- Exact shapes give `Region.curvesOf(shape, win, o)`, so `o.reach === 'sphere'` gives lines and rays their `reach`. A restricted exact piece is clipped again for the window (see below).
- Traced polylines give `Region.polyCurve`, plus `traced: true`, `ends` and `piece`.
- With `{reach: 'sphere'}`, a traced curve with an end at infinity also gets `outer` / `openSides` / `cell`. `Lines.refine`'s `rayEnds` then continues it toward infinity, as it already does for formula contours. This is tested with `Lines.refine`.

Description (window-independent):
```
{ kind: 'curves', src, ast, tex, exact (every piece exact), notes: [string], cache,
  pieces: [{ eq, restrict, tex, of,              // the classified piece this came from (eq, restrict as typed)
             form, formRestrict, real, dir?,     // the equation actually drawn (after the rewrites below)
             kind: 'curve' | 'zeros',            // 'zeros': isolated points of E (|z^2 - 1| = 0), in trace().points
             index,
             g(x, y) -> real | NaN,             // A - B (NaN: undefined or not real); complex: Re(D conj dir), g.h = Im
             R(z) -> level | null,              // Expr.compileLevel(formRestrict), positive inside
             exact: [shape] | null, exactEnds }] }  // Region shape specs clipped to the restriction (and their ends)
```
- `ends` values:
  - `'inf'`: reached the FAR box (220 window half-sizes, as `Region.FAR`).
  - `'nan'`: ran into undefined values, e.g. `e^x` overflowing past x ≈ 709 on `Re e^z = 1`. Such curves do go to infinity.
  - `'stop'`: a branch point, a domain edge, or the tail budget.
  - `'clip'`: cut by the restriction.
  - `null`: a closed loop.
- `notes` are messages for the sidebar, e.g. "The radius is negative, so the circle has no points." or "A circle of radius 0 is the single point 1 + i."
- `pieces` may be more than the classified pieces: a product splits into its factors (below).
- Exact circles and arcs are sampled by `Region.sampleCurve` (4096 fixed angles), then refined: chords within `expandBox(win, 2)` longer than 2 × diagonal / 700 get points on the circle, so a window much smaller than the radius is still sampled finely.

### Rewriting before recognition (`Curves.normalize`)

Marching squares needs g to change sign across the curve. These forms are rewritten (only for 'structural' / 'numeric' pieces) into equivalent ones that do:
- `E1 · E2 = 0` with real factors: one piece per factor (`(Re z)^2 (Im z)^2 = 0` is both axes; `(|z|-1)(Re z-1) = 0` is an exact circle and an exact line).
- `|E| = 0`, `E^k = 0`, `\sqrt{E} = 0`, `cE = 0` for a real E: `E = 0`.
- `arg E = θ` and `Im log E = θ` (E not affine; affine ones are exact rays): `Im(E e^{-iθ}) = 0` where `Re(E e^{-iθ}) > 0`. This has no jump along arg's cut, and `arg(z^2) = π` (where arg touches the end of its range) is the imaginary axis.
- `|E| = ±Re E` → `Im E = 0` where `±Re E > 0`; `|E| = ±Im E` → `Re E = 0` where `±Im E > 0` (`|z| = Re z` is the ray from 0 along the positive axis).
- `|E| = 0` with a complex, non-affine E: classified as `E = 0`. A 'complex' curve (`|z - \bar z| = 0`) is traced; otherwise its isolated zeros are found per window (Newton on (Re E, Im E) from the minima of |E| on a 64 × 64 grid) and returned as `points`, with a note.

### Exact recognition (`exact` shapes are Region shape specs)

- **Lines** `{kind: 'line', a, b}`:
  - What: `Re z = c`, `Im z = c`, `a Re z + b Im z = c`, `Re((1+i)z) = 1`, and any equation whose difference of sides is real-affine.
  - How: checked numerically at 49 test points.
  - Form: `a` is the point nearest 0 and `b - a` a unit vector, so `Region`'s `normalTex` prints `Re z = c`.
- **Circles** `{kind: 'circle', c, r}`:
  - `|αz + β| = r`, `k|αz̄ + β| = r`, `|E|^p = r`.
  - Generalized-circle polynomials: `|z|^2 = 4`, `z\bar z = 2`, `x^2 + y^2 - 2x = 3`.
  - Apollonius `|z - p| = k|z - q|`. With k = 1 it is the perpendicular bisector, a line.
  - `r < 0` gives no shape plus a note. `r = 0` gives `{kind: 'point', p}` plus a note.
- **Rays** `{kind: 'ray', a, b}`:
  - What: `arg(αz + β) = θ` (also with z̄, and the variable θ).
  - Values outside (−π, π] give no shape plus a note. `Im log(αz + β) = θ` is the same ray.
- **Complex equations** (`real: 'complex'`): the quadric fit of Re(D c̄) is kept only if D vanishes on the shape it gives (`z = \bar z` and `z - \bar z = 2i` are exact lines; `\bar z = 1/z` is traced).
- **With a restriction**, the exact parametrization is cut where `R` changes sign, by bisection to adjacent doubles.
  - The parameter is scanned uniformly over the whole shape, and densely (1024 samples) where the shape passes through the restriction's own bounding box (Re/Im bounds, `k|αz + β| < c` discs, `and`/`or` of them) and, per window, through `expandBox(win, 3)`. So `Re z = 0, |z - 1000i| < 10` and `|z| = 1000, |z - 1000e^{0.1i}| < 1` are found, and the "No point of the curve satisfies the restriction." note is not given from a coarse scan alone.
  - Ends: `'clip'` where the restriction cuts, `'stop'` at an arg ray's apex, `'inf'` otherwise.
  - A line becomes a ray, a segment, or several of them. A circle becomes arcs `{kind: 'arc', a, m, b}`, counterclockwise.
  - Coordinates within 4 ulp of a short decimal are snapped to it, so `Re z = 0, |z| < 2` is exactly the segment from −2i to 2i.

### Tracing (everything not recognized)

1. **Grid.** Marching squares over `expandBox(win, o.margin = 1.5)`, with `o.res = 200` cells along the longer side.
   - The grid is shifted by an irrational part of a cell, so 0, the axes and other round points are never vertices.
2. **Edge crossings.** Located by bracketing (Illinois steps with bisection) down to adjacent doubles, so every crossing is on the curve to float64 precision.
   - A sign change where |g| does not tend to 0 is a jump (a branch cut, a pole) and is rejected.
3. **Subdivision.** Cells with undefined corners or a rejected crossing are marched again on 4 × 4 grids, up to `o.depth = 3` levels (1/64 of a cell).
   - A cell whose only crossings are jumps is skipped.
4. **Singular points.**
   - **Saddle cells** (4 crossings): Newton on ∇g with 4-point stencils locates the critical point S.
     - If S is on the curve (within g's rounding noise, or its distance estimate below 2e-10·|S|), it becomes a vertex and the cell is an X.
     - Otherwise the asymptotic decider pairs the arms.
   - **V-tips and cusps:** a cell chord whose midpoint does not project onto the curve within 0.1 × its length, or which the curve leaves at more than 60° at either end, gets the critical point as a vertex (when it is on the curve).
     - Two V's of neighbouring cells share it (welded), so the crossing chains straight through. This holds when the crossing lies just outside both cells (a 16-wide window: the lemniscate stays one figure-eight with its vertex at 0).
   - **Near-tangency:** a chord that stays far from the curve marks its cell for refinement.
     - The cell and its neighbours are marched again finer. The region grows across every edge where the finer grid finds more crossings.
     - Dead ends left inside are followed along the curve in small steps until they meet the facing end.
   - Gaps of a few finest cells across an undefined point (Im(1/z) = 1 at 0, Re tan z = 0 at its poles) are bridged.
   - **Flat cells:** a cell whose four corners are all rounding noise of the sides (|g| ≤ 64 ε (|A| + |B|)) is skipped and counted: the sides agree on an area there (a note says so).
5. **Chaining.** Segments are joined at shared points. Where several meet (crossings), the straightest pairs are joined first.
6. **Densify.** Chord points are projected onto the curve along the chord normal, down to `o.step` (window diagonal / 700, as `Region.sampleCurve`). Every sample is a root of g.
   - A chord whose ends lie on two different curves (the curve leaves both ends at more than 50° to it), or whose points do not project onto the curve and has no on-curve corner, is not drawn: the chain is cut there and its ends are left to the joins below. A corner found inside a chord is densified on both sides in turn.
7. **Tails.** Open ends on the grid edge are continued outward by predictor-corrector steps:
   - prediction along the tangent, correction onto the curve across it;
   - a step is rejected when it turns more than 0.15 rad, or when the tangent where it lands disagrees with the chord (so a step does not switch branches at an X);
   - after a rejection the step is lengthened first (to step over a crossing), then halved;
   - spacing grows like `Region`'s long curves, up to 3.5% of the distance from the window;
   - a tail stops at the FAR box (`'inf'`) or after `o.maxTail = 4000` steps;
   - a tail that comes back into the grid joins the nearest free end, so a large loop through the window closes.
   - Open ends inside the grid are paired through a spatial hash by coarse cell, so thousands of fragments cost O(n), not O(n²).
8. **Restriction.** Polylines are cut where `R` changes sign. The cut point is found by bisection along the chord, each trial point projected onto the curve (searching across the chord only half the distance to its nearer end, so another branch through an X at the end is not picked), so it lies on both g = 0 and R = 0.
   - A sample where R only touches 0 between two samples inside stays inside (and vice versa), so `arg(z^2) = π/2` is one line through 0, not two rays plus a stub.
   - For a 'complex' piece the restriction also requires |Im(D c̄)| ≤ 1e-7 (|A| + |B|): the extra lines of Re(D c̄) = 0 are cut away (pieces shorter than 1e-3 × diagonal are dropped).
   - Nothing traced but g touches 0 (Newton on ∇g from the grid's smallest local minima of |g| reaches |g| at rounding level): the trace's `notes` say the sides only touch and suggest a crossing form.
9. **Orientation.** Closed loops are made counterclockwise.

**Budget.** `o.maxEval = 4e6` evaluations of g per trace, and `o.maxMs = 4000` ms of wall-clock time (chaining is checked too, not only evaluations). A trace that hits either stops refining and its `notes` say parts may be missing. The worst cases seen take 0.3–0.5 s: `Re e^{1/z} = 0` and `Re z^{40} = 0` hit the evaluation budget. Typical curves take 5–60 ms. Equations true on an area (`\log(e^z) = z`, formerly 65 s) are refused at classification; if one slips past the probes, its flat cells are skipped (about 20 ms).

**Measured accuracy** (`test/t_curves.js`, three windows each):
- Curves: `Re z^2 = 1`, `|z^2 - 1| = 1` (the lemniscate, crossing at 0), `Im(1/z) = 1` (circle through 0), `Re e^z = 1`, `|\sin z| = 1` (wavy branches crossing at π/2 + kπ).
- Every sample is within max(1e-9 |z|, 1e-12) of the analytic curve. The worst is 0.05 × that tolerance, at the lemniscate's crossing vertex (about 4e-14 from the curve).
- No reference point of the true curve inside the window is farther than 1e-4 × diagonal from the polylines.

## 3. Limitations

- Components entirely outside `expandBox(win, 1.5)` and not connected to the traced part are not found. Re-trace on settle when `clipWin` changes, as stretched area meshes already do; `trace` caches up to 8 windows per description.
- A curve where g touches 0 without changing sign is drawn only in the rewritten forms above (products, powers, |·|, √, arg at π, |E| = ±Re E). Other touching forms (`|z|^2 - 2|z| + 1 = 0`) are not drawn; the trace's notes say so.
- **Two curves closer than a cell within one equation** are not guaranteed: they may be chained across each other or partly missed (samples stay on the curves). A product of the two is split into separate pieces and is exact or traced separately, so `(|z|-1)(|z|-1.001) = 0` and `(|z|-1)(|z-0.001|-1) = 0` are right in every window; the same curves written as one unfactored expression are not. Likewise a circle tangent to a line in one unfactored equation (`|z|^2 Re z - |z|^2 - Re z + 1 = 0`) in a coarse window: no chord is drawn between them, but the circle may be left open with a gap of about a cell at the tangency.
- Features smaller than a cell (window/130), with no chord nearby to flag refinement, can be missed. Arms of an X with a very narrow angle may bounce instead of crossing. Samples stay on the curve either way.
- 'complex' curves are recognized only when they come within about 7000 of 0 (the farthest probe chords); farther ones get the `complex` error. Tracing a 'complex' piece drops the extra lines of Re(D c̄) = 0, but near the points where they cross the curve a stub up to 1e-3 × the window diagonal could survive in principle (none seen in the tests).
- Curves whose g jumps across a branch cut within a cell of the curve (other than arg / Im log, which are rewritten) can still lose up to a few cells near the cut.
- Crossing vertices are limited by float64's resolution of g near a double zero: about 1e-13 relative in the tests.
- Tails of oscillating curves (`|\sin z| = 1`) are long: up to 4000 samples per end, about 17k samples in all. Lower `o.maxTail` if GPU memory matters.

## 4. Wiring in the app

### 4.0 As built (2026-10-21)

- **Formula box** (`app.js` `setupFormula`, `curvePlan`, `addCurveShapes`): `Curves.dimOf` routes the formula. An
  equation previews as TeX and the line under the preview says what Add makes ("Adds a ray.", "Adds a circle and a
  line.", "Adds a traced curve.") followed by the formula's notes; refused equations show `Expr.REL_MSG` in the preview.
  Inequalities are areas exactly as before. A formula in `w` adds targets.
- **What is added.** Every piece recognized exactly: the app's own `line`, `ray`, `segment`, `circle`, `arc` shapes
  (with handles), one undo step for an `or` of several. Isolated zeros (`|z^2-1| = 0`) become `point` shapes (the zeros
  in the view). Anything traced: one `fcurve` shape holding the source text (its exact pieces are still drawn
  exactly). A lone exact shape keeps the formula as its row's TeX (`srcTex`) while its geometry is unchanged
  (`srcKey`), so `arg z = π/4` reads as its equation until a handle moves it.
- **`fcurve` kind** (`region.js`): `Region.curveDesc(s)` caches `Curves.fromFormula` by source (32 formulas). Traced
  pieces are traced in a sticky window: `traceWin(win)` (size rounded up to a power of 2, centre snapped to 1/8 of it)
  reused while it holds the asked window and that window is at least a third of its size, so pans and zooms do not
  re-trace; the curve objects per window are kept too. Traces stop after 2 s (`maxMs`) with a note. Hit tests walk
  the traced samples; `sphereCurvesOf` lifts them and ends `'inf'` tails at N.
- **Drawing and mapping**: through `Region.curvesOf`, so the line renderer, the P4 refinement (`Lines.refine`, with
  the rays toward infinity of §2), both globes, the morph view (also as arrow candidates), labels and the figure
  export work unchanged. Fits (`stageSamples`) count a curve formula by its part in the meshing window.
- **Targets**: exact target shapes use the preimage shader's own kinds. A traced target (`fcurve`, kind 19 in
  `gl.js` `PRE_FS`) is drawn per pixel: each piece's g = A − B through `GLChain.levelGLSL` (for complex sides the
  pair Re(A − B), Im(A − B), two level functions: the smooth complex difference, not |A − B|, whose kink on the curve
  looked like a jump and dropped strokes at half-pixel offsets), distance |g(F(z))| / |∇| in device px from the
  differences of g along dF/dx, dF/dy, an anti-aliased stroke cut by the restriction's level. A crossing is where g is
  linear at pixel scale: forward and backward differences that differ by more than half the larger one (a branch cut,
  or a pole of g, where g runs from −∞ to +∞ and the two differ by 1.3–1.7×) draw nothing (review P5: tan(Re w) = 1 drew
  its pole lines). `MAX_FORMS` (8) is the preimage pass's level functions; the inverse renderer keeps 4 formula areas
  (`MAX_INV_FORMS`).
- **Integrals** (`curvePieces`): closed traced loops as simple counterclockwise loops (`Curves.simpleLoops`: a figure
  eight is split at its crossing, so its integrals do not flip with the trace window), open traced pieces cut to the
  meshing window (`part`), so the right-click integral and the Cauchy style work on closed curve formulas.
- **Editor**: the row of a curve formula edits its equation (an area or a refused equation keeps the last good one) and
  lists the formula's and the trace's notes. The command palette offers "Add this curve".
- **Tests**: `test/curves_cmd.js` (CDP): the box, palette, undo, reload, integrals (2πi of 1/z around a traced
  Cassini oval), hit test, globes, morph, export, and exact truth read from the canvas (every ink pixel within 2.5 px
  of the true curve, every point of it in the pane inked): exp of `Re z = 0` and the Cayley image of the real axis
  (also at s = 6000 around w = 1) are the unit circle, z² of `Re z = 1` the parabola, 1/z of the traced hyperbola
  `Re z^2 = 1` the lemniscate, `|\sin z| = 1` itself, and the per-pixel preimages of the targets `Re w^2 = 1` under z²
  and `|w^2 - 1| = 1` under exp.
- **Not done**: traces run on the main thread (typical 5–60 ms on a new window; the worst formulas of §2 0.3–0.5 s,
  capped at 2 s); exact pieces are not offered for conversion inside a mixed `fcurve`; isolated zeros inside a mixed
  `fcurve` (`|z^2-1| = 0 or Re z^2 = 1`) are not drawn (alone they become points).

### 4.1 The plan (as written before the wiring)

1. **Shape kind.** Add a curve kind in `region.js`. Cache the description on the shape and drop it when `expr` changes:
   ```js
   K.fcurve = { type: 'curve', label: 'Curve formula', handles: () => [],
     curves: (s, win, o) => Curves.curvesOf(curveDesc(s), win, o),
     tex: (s) => { try { return Expr.toTex(Expr.parse(s.expr, { allowRel: true })).s; } catch (e) { return '\\text{invalid}'; } } };
   const curveDesc = (s) => (s._cd && s._cd.src === s.expr ? s._cd : (s._cd = Curves.fromFormula(s.expr)));
   ```
   - The alternative is keeping kind `'formula'` and branching on `Curves.dimOf(s.expr).dim` everywhere `K.formula` is used. A separate kind keeps `buildMesh`, `levelOf`, `isOpen`, `formulaAstBox` and the GPU level shader (`glsl.levelGLSL`) away from equations.
   - Exact pieces could also be offered as "convert to Line / Circle / Ray / Segment / Arc" from `Curves.shapesOf(desc)`.
2. **Formula box** (`app.js` ≈ 6836, `check()`):
   - Replace `Expr.compileLevel(ast)` with `const dm = Curves.dimOf(ast)`.
     - `'curve'`: `Curves.fromFormula(ast)` to validate, then add `newShape('fcurve', {expr})`.
     - `'area'`: compile and add `'formula'` exactly as now.
     - Otherwise: show `dm.error`.
   - The preview TeX is unchanged (`toTex` prints `=`). Show `desc.notes` under the preview.
   - Do the same in the command-menu search (≈ 7469): "Add this curve" for curves.
   - A formula in w is a target, as today: `w` parses as `z`.
3. **Drawing (left pane).** Nothing special: `Region.curvesOf(s, clipWin)` gives the curve objects.
   - On settle, pass `{reach: 'sphere'}` to `Lines.refine` as for other curves.
   - For drawing samples directly, `Curves.sample(desc, clipWin)` is better than `Region.sampleCurve` on the poly curves: `sampleCurve` re-splits long far-tail chords linearly, and those added points are on chords, not on the curve.
   - Exact shapes are Region's own curves.
4. **Mapping (right pane) and targets.** `Region.mapCurve(c, F, view)` and the line refinement accept these curve objects as they are. Traced polylines carry `ends` for the line renderer's tails.
5. **Globes.**
   - Exact circles and lines map to caps: `Region.Globe.capOf({kind: 'circle', ...})`. They can use `sphereCurvesOf(shape)` per shape.
   - Traced polylines: lift each sample with `Region.Globe.lift(x, y)`, and append the north pole `[0, 0, 1]` at ends whose `ends[k] === 'inf'`.
6. **Integrals** (`curvePieces`):
   - Closed loops: `Curves.loops(desc, clipWin)`, counterclockwise, without the repeated last point.
   - Open pieces: clip to `clipWin` with `clipPolyline`, as formula contours are (`part: true`).
   - Contour integrals and the Cauchy style need `Curves.isClosed(desc, clipWin)`. A figure-eight is closed but has signed area ≈ 0: `Curves.loops` (and `curvePieces`, via `Curves.simpleLoops`) split it at its crossing into simple loops, each counterclockwise (review P5: the sign of ∮dz/(z−1) on |z² − 1| = 1 flipped with the window).
7. **Points and notes.** `Curves.trace(...).points` (from `|z - c| = 0`, and the zeros of `|E| = 0` such as `|z^2 - 1| = 0`; an analytic E is always its zeros, whatever its degree: `|z^{30} - 1| = 0`) can be drawn as point markers. The zeros finder (128² grid, Newton, a 384² retry when the winding number of E around the box exceeds the zeros found) flags an incomplete set (zeros closer than 3 grid cells, as 1/(kπ) of sin(1/z) piling up at 0; or still fewer than the winding number): the note 'Only some of the zeros are shown…', and the formula box says 'some of the zeros in view'. Show `desc.notes` and the window's `Curves.trace(desc, clipWin).notes` in the shape's row.
8. **`build.py`.** Add `'curves.js'` after `'region.js'` in the concatenation list.

## 5. Review fixes (test/t_curves.js §9)

| finding | fix |
|---|---|
| equations true on an area (`\log(e^z) = z`) accepted, traced for 9–65 s | `REL_MSG.region` at classification; flat cells skipped in the tracer; `o.maxMs`; hashed end pairing |
| complex sides that form a curve (`z = \bar z`, `\bar z = 1/z`, `z^2 = \bar z^2`) refused with a false message | `real: 'complex'` with `dir`; traced as Re(D c̄) = 0 cut to Im(D c̄) ≈ 0, or exact; the `complex` message no longer claims isolated points |
| touched zero sets traced to nothing (`\arg(z^2) = π`, `\|z\| = Re z`, `\|z^2-1\| = 0`, products of squares, `\sqrt{\|Re z\|} = 0`) | `Curves.normalize` rewrites (§2); isolated zeros as points; a note when a trace finds only a touching zero |
| X and figure-eight split into V's in coarse windows | steep-chord check in the cell arcs puts the critical point in both V's |
| circle tangent to a line chained with a chord jump | products split; long false chords and chords between two curves are cut instead of drawn; corners densified on both sides |
| curves closer than a cell | products split; limitation documented (§3) |
| exact restriction missing far pieces, false "no point" note | box-seeded and window-seeded parameter scans |
| curves near a branch cut lost (`Im log z = 3.14`) | `Im log E` is `arg E`; non-affine `arg E = θ` rewritten without a cut |
| API: curvesOf options, cache key, exact ends, closed circles | fixed as described in §2 |
| (found while re-running the review's acc.js) exact circles sampled with 4096 fixed angles by `Region.sampleCurve`: one sample in a 0.002-wide window | `trace`/`sample` insert points on the circle into chords near the window, down to diagonal / 700 |
| parser: duplicate equation, `=<` / `=>`, `chain` without allowRel | fixed as described in §1 |

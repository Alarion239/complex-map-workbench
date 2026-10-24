# Constructions and shared parameters: design

Backlog item 18. The research is in `RESEARCH.md`. The proof of concept is in `poc/`: the engine, 66 + 18 tests
(`node poc/test.js`, `node poc/bridge.test.js`, all pass) and an interactive demo. Its screenshots are in `shots/`
(revision 1 in `shots/r1/`). Revision 2 answers every constructions entry of the two reviews (ids in brackets).

## 0. Decision

**Recommended.**
- **Shared numbers.**
  - Named parameters (*a*, *k*, *α*, …) are sliders in the right panel. The right panel becomes the Inspector; its
    lower half is Parameters.
  - Their names work in every field of the app: step parameters, shape fields, region and equation formulas.
- **Constructions.**
  - Points, lines through points, circles through three points, intersections, midpoints, bisectors and points on
    curves are ordinary shapes in the Shapes list.
  - Each one stores its definition and is recomputed from it.
- **The engine.**
  - One dependency graph, recomputed in topological order.
  - Every curve is a generalized circle in the oriented Hermitian form.
  - No result depends on history.

**One alternative (not recommended):** a separate "Objects" panel listing numbers, points and curves together, like
GeoGebra's algebra view. The demo uses this layout because it is self-contained. In the app it would duplicate the
Shapes list and take the space the Inspector needs.

## 1. The model

### 1.1 Objects

| Object | Example | Free? | Stored as |
|---|---|---|---|
| Number (slider) | *a* = 0.5 on [−2, 2] | yes | `{name, value, min, max, step}` |
| List (family) | *k* = [−2 … 2] | yes | `{name, values}` (phase 3) |
| Number by formula | *b* = 2*a* + 1 | no | `{name, expr}` |
| Free point | *P* = −2 − 0.5*i* | yes | a `point` shape with a name |
| Point by formula | *T* = *P* + *a* | no | a `point` shape with `def: {expr}` |
| Line through two points | line(*P*, *Q*) | no | a `line` shape with `def` |
| Circle through three points | circle(*P*, *Q*, *R*) | no | a `circle` (or `line`) shape with `def` |
| …its inside | the disc to the left of *P* → *Q* → *R* | no | a `disc` / `halfplane` / disc complement with `def` |
| Circle, centre and point | circle(*P*; *Q*) | no | `circle` + `def` |
| Perpendicular bisector, midpoint | | no | `line` / `point` + `def` |
| Intersection | *c* ∩ *g*, first | no | `point` + `def: {op: 'meet', index}` |
| Point on a curve | on *c* at *t* | yes (slides) | `point` + `def: {op: 'glider', t}` |
| Equation with names | Re *z* = *a*, \|*z* − *P*\| = 2*a* | no | `fcurve` with names in `expr` |
| A field bound to a formula | a disc's radius = *a* | no | `s.bind = {r: 'a'}` |

**Names.**
- A name is one Latin letter with optional digits, or a Greek letter: *a*, *k*, *P*, *Q*₁, *α*, *ρ*.
- These letters are taken: *z w x y r i e* and *θ*. Use *ρ* or *R* for a radius.
- **A step's own coefficients are not names.** They carry the step's index: the Möbius f₂ has *a*₂ *b*₂ *c*₂ *d*₂, the
  Zeros-and-poles f₃ has *a*₃. A plain *a* in any field is always the shared number [users-5, design-16]. A new number
  whose name equals a coefficient letter of a step that uses it gets a one-line note ("*a* here is the shared number,
  not *a*₂").
- **Juxtaposition** is a product only between known names: `2a`, `a b`, `ai` (with *a* defined). A run of letters that
  is not a function and not all known names is an error: "Unknown function sinc", never three new sliders [users-6].
- **Cyrillic look-alikes** (а с е о р х у к, А В С Е Н К М О Р Т Х) are read as the Latin letters before parsing; any
  other Cyrillic letter is refused: «Используйте латинские буквы» / "Use Latin letters for names" [design-17].
- Points take capitals by default and numbers take lower case. This is a convention, not a rule.

**References.**
- Shapes refer to points by shape id, so renaming a point changes nothing.
- Formulas refer by name. Renaming a number rewrites every formula that uses it, as one undo step.

### 1.2 Curves are generalized circles

Every constructed curve is stored in an oriented, normalized Hermitian form:

  f(z) = A |z − o|² + 2 Re( B̄ (z − o) ) + C,   with |B|² − A C = 1.

- The inside is f < 0, the left side of the curve's direction.
- **A = 0 is a line**: a circle through ∞.
- **Circle through *P*, *Q*, *R*.** The lifting z ↦ (|z|², x, y, 1) turns circles into planes; the coefficients are
  3 × 3 cofactors, with A = orient(*P*, *Q*, *R*).
  - A is computed by an **exact** orientation predicate. Exactly collinear points give A = 0 exactly: a true line,
    never a huge circle.
  - A point at ∞ gives A = 0 too.
  - **Collinear by construction** [users-1]. A point built on line(*P*, *Q*) (a meet with it, a glider on it, the
    midpoint of *P* and *Q*, or on a line whose two points are both on *PQ*) is collinear with *P* and *Q* by
    **incidence**, which the graph tracks structurally. Its rounded coordinates may be off the line, but circle(*P*,
    *Q*, *X*) is still exactly the line. Before this, 2000 of 2000 such cases gave a circle of radius up to 4.5e20.
    Now 0 of 2000, and the half-plane agrees with the exact orientation test on 20 000 samples.
- **The filled side** [design-15, users-7].
  - **At creation the tool makes the disc**, whatever the order of the taps; it stores that sign.
  - Afterwards the orientation follows the points, so dragging *R* across *PQ* goes on continuously: disc, half-plane,
    then the outside of the circle (one family on the Riemann sphere; shots 03, 04).
  - **Use complement** flips it.
- **The anchor o is the first defining point**, so near the points f/2 is the signed distance at any radius.
  - A circle of radius 1e8 is accurate to 1e−14 there.
  - The centre–radius form r − |z − c| loses 1000× more.

### 1.3 Intersections and gliders

Intersections follow **one rule for every pair of oriented generalized circles** [users-2]:
- *X*₁ is where curve 2 **enters** the inside (left side) of curve 1; *X*₂ is where it leaves.
- The rule is the same for lines and circles, so it is continuous through the line case. It changes only at tangency,
  where the two points merge anyway. Test: dragging *R* through collinear in 41 steps of 10⁻⁷, *X*₁ moves less than
  10⁻⁶ per step (it used to swap with *X*₂).
- Two lines: the crossing and ∞, which take the roles the rule gives them.
- **Parallel lines are tangent at ∞**: both points are ∞, with the note "They meet only at ∞" [users-20].
- The points are solved in the Hermitian form of one curve along the other (a line, or the smaller circle), so a circle
  of radius 10⁶ meets as accurately as the line it tends to (the centre–radius form lost 2 × 10⁻³ there).

When there is no intersection, the point is **undefined, with a reason** ("The curves do not meet here"). Everything
built on it is undefined too ("*X* is undefined") and hidden until it comes back.

**A point on a curve** keeps a real parameter *t* [users-8]:
- on circle(*P*, *Q*, *R*): *S* = *M*(*t*), where *M* is the Möbius map sending 0, 1, ∞ to *P*, *Q*, *R*. It is
  continuous through the line case and fixed relative to *P*, *Q*, *R* (a similarity of the three moves *S* with them);
- on line(*P*, *Q*): *S* = *P* + *t*(*Q* − *P*);
- on other curves: an angle on a circle, a distance along a line.

### 1.4 The graph

- **Building.** Nodes are numbers, points and shapes with a `def` or a bound field. Edges come from arguments and from
  the names in formulas.
- **Topological order.** It is rebuilt when the structure changes, with Kahn's algorithm, ties broken by creation
  order.
- **A change** (a slider, a point drag, a field edit) recomputes the downstream closure in that order. The app then
  updates exactly those shapes and steps: `shapesChanged(false)` and `chainChanged(false)`, as in a handle drag or a
  zero drag today.
- **Refused edits.**
  - Cycles: "*a* would depend on itself: *a* → *S* → *a*".
  - Unknown names: **one** standalone unknown letter per edit becomes a new slider; two at once are refused ("One new
    name at a time: s, t"); an unknown capital is an error; a run of letters is §1.1's rule.
- **Determinism.** A value depends only on the definitions and the free values, never on history. Save, load and undo
  reproduce every picture exactly.

### 1.5 Saved state, undo, links

- **`S.params`.** A new array of numbers. Points and constructions live in `S.shapes`, each shape with an optional
  `name`, `def` and `bind`.
- **Concrete fields are saved too.** A constructed shape keeps its fields (`a`, `b`, `c`, `r`) as well as its `def`.
  An older build, or a definition that fails, still shows the last good shape.
- **Loading.** `sanitizeState` checks the `def` arguments and removes cycles. A broken `def` is dropped and the shape
  is kept as a free shape, with a note.
- **Undo.**
  - One step per gesture (slider, drag), as for zeros and poles.
  - One step per creation, including any helper points or sliders the creation made.
  - Animation (play) never adds undo steps.
- **Handing a figure to students** [users-18], in phase 1:
  - **Copy link**: the saved JSON in the URL hash (compressed). Opening a link loads it as a new state with Undo; it
    never overwrites the open work without asking.
  - **Save scene / Open scene**: the same JSON as a `.cmw.json` file (the export dialog's Save, and Open in More).

## 2. How it fits the app

**Rendering.** Constructions produce `line`, `circle`, `disc`, `halfplane` and `point` shapes. The exact inverse
renderer, the forward mesh, the globes, the deformation and integrals need no change.

**Step parameters.**
- Text fields (Möbius *a b c d*, *c*, *α*, zeros and poles, coefficients, the custom *f*) evaluate with a name scope.
- **On the GPU**, names are uniforms (`genCustom` already makes every z-free subexpression a uniform), so a slider
  never recompiles.
- **Exception: integer structure.** An integer field (*n* of the n-th root) and a name in an exponent change the
  shader's structure. A parameter used there snaps to integers while dragged, and the shader recompiles only when its
  integer class changes. The slider says so in its tooltip.

**Equations with names** (Re *z* = *a*).
- Each step substitutes the values into the parsed formula and recognizes it with `Curves.fromFormula`. It is exact
  for lines, circles, rays, segments and arcs, and takes 0.29 ms per curve.
- **The two Möbius families are recognized exactly** [users-9]: |*M*(*z*)| = *k* (an Apollonian circle,
  |*az* + *b*|² − *k*²|*cz* + *d*|² = 0) and arg *M*(*z*) = θ (a Steiner arc from the zero to the pole of *M*). The PoC's
  `apollonius` and `steiner` are exact to 10⁻¹² for 101 slider values at about 0.01 ms each; the app's recognizer gets
  the same two patterns, so they are never traced.
- **A traced equation** (Re *z*³ = *a*) costs about 120 ms per value, so it is **exact but late**. A worker traces
  the new value while the last finished trace stays on screen, labelled with its value. A frame never shows a degraded
  curve.

**The Riemann sphere.**
- A free point can be ∞: dragged to the north pole of a globe, it snaps there within 8 px.
- Circle(*P*, *Q*, ∞) is the line *PQ*.
- On a globe, a circle through three points is the circle on the sphere through them. Stereographic projection keeps
  circles, so the plane's shape is exact.
- Construction tools work on the globes, with the same caps as P3b.

**Export and LaTeX.**
- Figures draw the shapes as today.
- Named points get STIX italic labels when the figure's Labels option is on.
- The caption names constructions and gives the values: "the circle *c* through *P* = −2 − 0.5*i*, *Q* = 1 − *i*,
  *R* = −0.5 + 1.5*i*, and the lines Re *z* = *a*, Im *z* = *a* with *a* = 0.5".
- A formula's LaTeX keeps the names. A "values" line follows it.

**The tour.** One new chapter, "Shared numbers and constructions", with three steps:
1. Type Re *z* = *a*; a slider appears.
2. Drag the slider.
3. Make a circle through three points and drag one point onto the line through the other two.

**Russian.** New strings, about 20–35 % longer:

| English | Russian |
|---|---|
| Parameters | Параметры |
| Added slider *b* | Добавлен ползунок *b* |
| used by *g*, *m* | используется в *g*, *m* |
| free point | свободная точка |
| line through *P*, *Q* | прямая через *P*, *Q* |
| circle through *P*, *Q*, *R* | окружность через *P*, *Q*, *R* |
| collinear | на одной прямой |
| The curves do not meet here | Кривые здесь не пересекаются |
| *c* is undefined | *c*: не определено |
| Circle (3 points) | Окружность по 3 точкам |
| Intersect | Пересечение |
| Point on curve | Точка на кривой |
| Make free | Сделать свободным |

- Names stay Latin or Greek letters.
- The neutral form "*c*: не определено" avoids gender agreement.

## 3. The interface

This was agreed with the desktop designer in `../desktop/INTERFACE.md`; the phone designer decides the phone layout.

### Where things live

- **Parameters**: the Inspector's lower section, which is the former Guarantees panel.
  - Each number has one row, 56 px:
    - line 1: the name (STIX 15), "=", the value field (B612 Mono), a play button and ⋯;
    - line 2: the slider with min and max in `--t-micro`.
  - Under the rows: "+ Number".
  - The minimum height is 240 px, which is header + 3 rows + add.
- **Constructions**: the left panel's Shapes list.
  - The row text is the definition: "circle through *P*, *Q*, *R*", "*c* ∩ *g*, first point".
  - Free points have a filled dot and constructed points a ring.
  - An undefined row shows its reason in `--warn`.
- **The Inspector's Selection section**, for a selected construction:
  - its definition;
  - "uses *P*, *Q*, *R* · used by *X*₁, *X*₂";
  - **Make free**: keep the shape, forget the definition;
  - **Delete**: also deletes what depends on it. The toast lists them and offers Undo.

### Creating things

- **A shared number.**
  - Type a new name in any field: `Re z = a`, a disc radius `2a`, the Möbius *b* = `a i`. The slider appears in
    Parameters, with a toast "Added slider *a*  Undo".
  - Or press "+ Number" in Parameters.
- **Lines and circles through points.** The **existing** tools (Point, Segment, Line, Ray, Circle, Disc, Arc,
  Half-plane) snap to existing points.
  - A ring with "on *P*" shows the snap.
  - A snapped handle is bound to the point, so the shape follows the point.
  - No new tool is needed for "line through two points".
- **New tools, the same on every platform** [design-14, users-16].
  - In the Draw grid: **Circle (3 points)**, which makes the circle or its disc, and **Intersect**.
  - Under More, as tiles: **Midpoint**, **Bisector**, **Point on curve**.
  - No "line through 2 points" tool: the Line tool snaps to points (8 px with a mouse, 22 px on touch).
  - While a tool waits, the plane shows a chip, "Circle through three points: point 2 of 3", and a dashed preview
    through the pointer (shot 06). Esc cancels.
- **The context menu** (right-click, or a long press on touch), "Constructions" group:
  - with points selected: Circle through 3 points, Midpoint;
  - with a curve under the pointer: Point on this curve;
  - with two curves under the pointer: Intersect.

### Labels [design-25]

- A label placer, run per frame on the visible objects: 8 candidate offsets around the anchor, nearest first along the
  outward normal, at two distances. A candidate is free when it touches no placed label, no point mark and no stroke
  (sampled along every visible curve) and stays inside the plane.
- Curve labels go at 85 % of the visible arc (then 70, 55, 40 %), on the outer side.
- No free place: the label is left out (the name is in the Shapes list).
- In the PoC demo (`poc/demo.js`, `place`); checked on the demo scene at 1440 and 390, light and dark (shots 01, 08–10).

### Showing dependencies

- **Hover** an object (on the plane or in a list). It, what it is built from and what is built on it stay at full
  strength; everything else drops to 30 %. List rows of the connected objects take `--accent-soft` (shots 02, 08).
- **A selected parameter's Selection section says what uses it**: "used by *g*, *m*", or "not used yet". Hovering
  its row highlights them. (The demo prints this line in the row itself, for want of an Inspector.)
- **Dragging a constructed point** shows "*X*₁ is built from *c*, *g*: drag those".

## 4. Build plan

Build it after v14 is gated and after the panel redesign (items 16, 17 and 19), which frees the right panel.

### Phase 1: shared numbers (about one round, the size of the zeros-and-poles round)

**Files**
- `src/parse.js`: a name scope (`Expr.parse(src, {names})`), `{t: 'name'}` nodes, `Expr.bind(ast, values)`,
  `constValue(src, scope)`, and the "taken letter" errors.
- `src/funcs.js`: `build(step, scope)`.
- `src/glsl.js`: names as uniforms in `genCustom`, a key that does not depend on values, and the integer-class rule.
- New `src/params.js`: the graph, taken from `poc/constr.js` without the geometry.
- `src/region.js`: field bindings.
- `src/app.js`: `S.params`, the Parameters UI, sliders created from unknown names, link chips in fields, undo per
  gesture, save and sanitize, play.
- `src/page.html`: rows.
- `src/i18n.js`, `src/i18n_ru.js`: strings.
- `src/tour.js`: one step.

**Tests**
- `test/t_params.js` (node): graph, scope, bindings, cycles, save and load; the name rules (Cyrillic look-alikes,
  runs of letters, one new name per edit, coefficient letters).
- Copy link and Save/Open scene: round trip, a link opened over unsaved work asks first, Undo after opening.
- `t_parse` additions.
- `glsl_test` rows with names: CPU = GPU, and the same key across values.
- `test/params_cmd.js` (CDP):
  - a slider drag at 60 fps with one chain signature;
  - exact per pixel at rest and mid-drag (as `zp_cmd`);
  - undo, and save and load;
  - light and dark, and phone.
- Perf gate units: `param.drag` with 1, 10 and 50 dependents.

**Risks**
- Name clashes.
- Integer structure.
- Many dependent areas on the forward mesh path. The perf unit decides.

### Phase 2: constructions (about 1.5 rounds)

**Files**
- New `src/constr.js`, from `poc/constr.js`: generalized circles, exact orientation, incidence, the entering rule,
  Möbius gliders, Apollonius and Steiner circles.
- **`src/inverse.js`, `src/gl.js`: a `gcircle` shape kind** (the Hermitian form anchored at its first point), moved here
  from phase 3 [users-1]. The CPU level and the GPU (float32 uniforms) evaluate *A*|*z* − *o*|² + 2 Re(B̄(*z* − *o*)) + *C*
  in coordinates relative to *o*, so a circle through nearly collinear points renders exactly per pixel at any radius.
- `src/curves.js`: the Apollonian and Steiner patterns.
- `src/region.js`: shapes with `def`. Constructed shapes have no handles; free points do.
- `src/app.js`:
  - tools snap to and bind points;
  - the new tools (Circle (3 points), Intersect; Midpoint, Bisector and Point on curve under More);
  - the context-menu group, Shapes list rows, Selection section actions, and the delete cascade toast.
- `src/sphere.js`: ∞ points and globe picking.
- `src/figure.js`: labels and captions.
- `src/i18n*.js`, `src/tour.js`: one chapter.

**Tests**
- `test/t_constr.js`: the PoC's 66 tests, plus `Region` integration as in `bridge.test.js`; circle(*P*, *Q*, *X*) for
  *X* on *PQ* is a line and renders exactly per pixel (CPU and GPU).
- `test/constr_cmd.js` (CDP):
  - tools and binding;
  - a drag with N dependents at 60 fps;
  - collinear points giving an exact line per pixel;
  - intersections appearing and disappearing;
  - undo, and save and load;
  - globe, export caption;
  - light and dark, phone, Russian.

**Risks**
- Hit-testing ambiguity between a point and a handle on the same spot. Points win, as zeros do today.
- Label clutter: the label placer above; helper points can be hidden.

### Phase 3: families and polish (about one round)

- **Lists** (`k = [−2 … 2]`) for equations and shape fields. A family is drawn as one shape with members.
- **Play modes**: loop, bounce, speed.
- **Equations recognized once, symbolically.** Shape fields become compiled expressions of the parameters, for
  100+ dependent curves.
- **Traced equations "exact but late"**: a worker, and a label with the drawn value.
- (The `gcircle` kind moved to phase 2.)

## 5. What the user should look at

- `shots/01-light-default.png`: one slider *a* drives Re *z* = *a* and Im *z* = *a*, beside a circle through *P*, *Q*,
  *R* and its intersections; labels placed without collisions.
- `shots/03-light-collinear-halfplane.png` and `04-light-clockwise-complement.png`: dragging *R* onto line *PQ* (an exact
  line) and across it (the outside of the circle): one continuous family.
- `shots/05-light-slider-undefined.png`: the slider moves Re *z* = *a* off the circle; *X*₁, *X*₂ say why.
- `shots/06-light-tool-circle3-in-progress.png`: the tool at point 3 of 3.
- `poc/demo.html`: open it in a browser and drag.

## 6. Questions for the user

In `../README.md`. Question 2 of revision 1 (the filled side) is decided: the tool makes the disc [design-15, users-7].

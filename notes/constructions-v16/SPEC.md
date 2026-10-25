# Constructions (v16): build specification

The user, 2026-10-24: "What about drawing parametrized regions, like circle through 3 points and line through 2
points? I mean, points existent on the page. The intersections, etc."

This refreshes `notes/ui-redesign-2/constructions/DESIGN.md` (phase 2) against the v15.1 code in `work/xvc/src`.
Sources: that DESIGN.md, RESEARCH.md, the proof of concept `poc/` (66 + 18 tests, all pass today:
`node poc/test.js`, `node poc/bridge.test.js`) and the reviews (`review-users.json`, `review-design.json`, README.md
decisions). Section 14 lists what changed from the old design and why. Line numbers are v15.1 `work/xvc/src`.

**Rev 2 (2026-10-24), after `CRITIQUE.md`.** Every critique point is decided in §21 (accepted, partly accepted or
rejected, with a reason); the sections below already include the accepted fixes, marked [Cn]. §20 splits the build
into **CORE** and **INTERFACE** with a fixed interface between them. Line numbers are hints only: v15.2 shifts app.js
by about +130 lines, so every hook is named by its function (editDown, onMove 'handle'/'zp', onUp, deleteShape,
shapeRow, zpSet, zpRemove, sanitizeState, onParamChange, restore), is one line, and is guarded by
`typeof Constr !== 'undefined'` or `typeof Construct !== 'undefined'` [C27].

## 0. In one paragraph

Every point the user can see is a **snap target**: points, the zeros and poles of f₁ when it is a
zeros-and-poles step, shape handles, crossings of two curves, points on curves, and (when drawing in Y) the images
F(z₀) of X's points. A handle dropped on a target is **bound** to it, and the shape follows the target from then on.
Drawing tools snap to points, handles, zeros and crossings; only the Point tool and the construction tools also pick
curves [C16]. Four new tools (Circle through 3 points, Intersect, Midpoint, Bisector) make **constructed shapes**.
Constructed shapes are ordinary shapes (`point`, `line`, `circle`, `disc`, `halfplane`) with two extra fields, so the
rows, captions, globes, the deformation, Preimage, integrals and export keep working; every reader of a circle's or
disc's geometry goes through one exact **gcircle form** (§2.2), which is a runtime form with two GPU kinds, not a new
saved kind. One dependency graph recomputes them. A value depends only on the definitions and the free values, never
on the history. The region of a circle through three points is exact per pixel, on the CPU and the GPU, at any
distance from its defining points, and it is continuous through the collinear case: disc, then half-plane, then the
outside of the circle.

## 1. The data model

### 1.1 Two new optional fields on a shape

```js
s.at  = { a: ref, b: ref, c: ref, v3: ref, r: ref, ... }   // bound handles (any kind with handles)
s.def = { op, args: [ref, ...], ...op fields }              // a constructed shape (computed geometry)
s.helper = true; s.owner = 's9'                               // a point a snap made on its own (§4.2) [C16]
s.cundef = { code, args }; s.cHid = true                     // the construction's undefined state (§3) [C2]
s._g  = { o: [x, y], A, B: [x, y], C }                       // runtime only: the exact form (§2.2); '_' keys are
                                                             // dropped by noRuntime (app.js:290), so never saved
st.uid = 'f7'; st.zpIds = { zeros: ['q1', 'q2'], poles: ['q3'] }   // steps: stable ids (§1.2) [C12]
```

- **`s.at`: bound handles.** The key is a handle key from `Region.handlesOf` (region.js:423): `p`, `a`, `b`, `m`, `c`,
  `v0`…`v39`.
  - A position key (`p a b m c vᵢ`) puts the handle on the point.
  - A radius key (`r r1 r2`) makes the circle pass through the point: r = |point − c|. So the Circle and Disc tools,
    snapped at both ends, make circle(P; Q). The graph writes r itself, not through `setHandle` (which clamps to
    1e−3), so the circle passes through the point at every zoom; it is undefined only at r = 0 exactly [C15].
  - A shape keeps its kind and its other fields. Its free handles stay draggable.
- **`s.def`: a constructed shape.** The geometry is computed from the arguments. The shape has no handles, except a
  point on a curve, which slides along it.
- **Concrete fields are always written** (`p`, `a`, `b`, `c`, `r`, `complement`). They are the last good values, so an
  older build, a failed definition and every renderer see a plain shape.

### 1.2 References (`ref`)

| Ref | Means | Shown as |
|---|---|---|
| `{s: 's12'}` | a point shape: free, constructed, or a point on a curve | its label, z₃ |
| `{s: 's12', h: 'a'}` | a handle of another shape | "the start of Segment 1", "vertex 3 of Polygon 2", "the centre of Disc 1" |
| `{zp: 'f7', kind: 'zeros', id: 'q2', i: 1, step: 0}` | the zero with id `q2` of the step with uid `f7` (`i` and `step` are fallbacks, below) | ζ₂ (its current index) |
| `{inf: 1}` | ∞ (the north pole of an editable globe) | ∞ |
| `{s: 's12', part: 2}` | a curve, for `meet` and `glider` only: piece 2 of the shape's boundary | Circle 1, "side 3 of Rectangle 1" |
| `{img: 's3'}` | targets only: F(z₀), the image of point shape `s3` of X under the whole chain [C23] | z₀″ |

- **Steps get a stable uid**, `st.uid = 'f' + n`, from the same counter as shapes (`S.nextId`). This is a new field.
  `addStep` and duplicate assign it. `sanitizeState` keeps a unique one or assigns it. Moving a step keeps it. A
  step's index is never stored in a ref, because inserting a step would move the reference to another step's zeros.
- **Zeros and poles get stable ids** [C12], `st.zpIds = {zeros: [...], poles: [...]}`, parallel to the comma lists,
  from the same counter. zpAdd appends one, zpRemove removes one, swap moves it with the point. A text edit of the
  list (zpWrite) matches the old ids to the new values greedily by nearest value (ties by index); values left over
  get fresh ids, ids left over are removed. So deleting the first zero in the field keeps ζ₂'s constructions on the
  old ζ₂.
- **Fallbacks for older builds** [C29]. v15.1's sanitizeState drops `uid` and `zpIds`. On load, a zero ref whose uid
  is found nowhere is rebound to f₁ when f₁ is a zeros-and-poles step (`step: 0`), and the step gets a fresh uid. A
  step without `zpIds` gets fresh ids by index, and refs whose id is unknown take their stored `i`.
- **Image refs** [C23] are one-way, like zero refs: F(z₀) is computed in float64 by the chain at t = 1 and
  recomputed when the chain or z₀ changes. ∞ and undefined values follow §3. They are offered as targets only while Y
  shows the whole chain's image.
- **Zeros and poles: only those of f₁ are points of X's z-plane.** A zero of fₖ with k > 1 lives in the plane w_{k−1},
  which is not where shapes are drawn (editDown, app.js:10501, draws at stage 0 only). So those zeros are not snap
  targets. A ref whose step is no longer f₁ (it was moved, or a step was inserted before it) is **undefined**, with the
  reason "ζ₂ is a zero of f₂ now: only the zeros and poles of f₁ lie in the z-plane". It comes back when the step is
  f₁ again. Turning the step off does not matter, because the field still holds the point.
- **A zero drives the construction, never the other way round.**
  - Dragging ζ₁ (`zpSet`, 2661) recomputes everything built on it.
  - Nothing a construction does writes a zero field.
  - A handle bound to ζ₁ is not a handle. In the Select tool the press goes to the zero (zpHit runs first in the
    pointer-down handler). Section 4.3 covers the selected shape's handle that sits on the same spot.
  - **In the other tools a plain press near a zero is a pick, not a zero drag** [C1]: the pointer-down handler skips
    zpHit when `tool` is not `select` or `point`, and `Construct.snap` offers the zero as a point target. The Point
    tool keeps v15's zero drag (a point on a zero would be a second name for it). Shift-click and Shift-⌘ click still
    add a zero or pole in every tool: Shift is never a pick, and v15's tests keep working.
- **Edits of the zero list** go through the ids above.
  - zpRemove (menu Remove, Delete, the field's ×, a drag off the plane): the constructions on that zero become
    undefined, "ζ₂ was removed" (§9); nothing is deleted [C12]. While a drag is off the plane the chip reads
    "Release to remove ζ₁; 2 shapes will be undefined".
  - Swap to a pole: the ref keeps its id, which moves to the poles list.
  - Typing in a zero field re-matches ids by value (above). Typing never deletes anything.

### 1.3 Construction ops (`s.def.op`)

| op | Args | Result kind | Notes |
|---|---|---|---|
| `circle3` | P, Q, R (points or ∞) | `circle`, or `line` when exactly collinear | `fill: 'none' \| 'in'`; `flip` (bool) |
| `circle3` + `fill: 'in'` | P, Q, R | `disc`, `halfplane` or `disc` + `complement` | the left side of P → Q → R (§2.3) |
| `meet` | curve₁, curve₂ | `point` | `index: 0 \| 1` (entering rule, §2.4); `'finite'` when both carriers are lines [C6]; `seed` for traced curves |
| `glider` | curve | `point` | `t` (number, or a shared-number formula in `s.bind.t`); wraps on closed curves (§2.5) [C14] |
| `midpoint` | P, Q | `point` | ∞ when either point is ∞ |
| `bisector` | P, Q | `line` | the perpendicular bisector, oriented left of P → Q |

- **Line through two points, half-plane, circle(P; Q), disc(P; Q), segment and so on are not ops.** They are the
  ordinary tools with bound handles (`s.at`). This is the old design's rule ("the Line tool snaps"), kept.
- `circleCR` (the PoC's centre and radius formula) is a Disc or Circle with `at.c` and `bind.r = '2a'`. Both
  mechanisms exist in v15.

### 1.4 Names and labels

- **Points keep v15's labels**: z₀, z₁, … (pointLabel, app.js:2161; review design-6: a plain lowercase letter would
  read as a shared number). A user label (the point editor's field, 7947) still wins. The old design's P, Q, R are
  only the user's own labels.
- **Curves keep their row names**: "Circle 2", "Line 1" (shapeName, 7689). Definitions name them so: "Circle 1 ∩
  Line 2".
- **Point marks.**
  - A free point and a point on a curve: a filled dot, as today. Both can be dragged, and existing pictures and golden
    images stay unchanged.
  - A fixed constructed point (meet, midpoint): a ring of the same size in the shape's colour.
  - A helper point (§4.2) [C16]: a small ring, no label in the plane; its row is indented under its owner.
  - A point at ∞: drawn only on the globes, at N.
- **No curve labels on the plane** (§14). Hovering a curve or its row shows its name in the existing tooltip.

## 2. Geometry (new `src/constr.js`, from `poc/constr.js`)

### 2.1 What it keeps from the PoC

- The exact orientation predicate (`orient`).
- The normalized, oriented Hermitian form f(z) = A|z − o|² + 2 Re(B̄(z − o)) + C, with |B|² − AC = 1. The inside is
  f < 0, the left side. o is the first defining point.
- `circle3`, `line2`, `circleCP`, `bisector`.
- Incidence: collinear by construction, structurally (`incOf`, `collinearBy`), extended to bound handles. A handle
  bound to a point carries that point's incidence. A segment, ray or half-plane bound at both ends counts as
  line(P, Q).
- `meets`: the entering rule.
- Möbius gliders (`mob3`, `mob3inv`).
- Parallel lines meet only at ∞.
- `apollonius` and `steiner` stay in constr.js, but the recognizer work in curves.js is not in this round (§13).

### 2.2 The exact gcircle form (`s._g`, `Region.formOf`)

"gcircle" in this spec and in §20 is this form: a generalized circle as the oriented Hermitian form of §2.1. It is a
runtime form and two GPU kinds, not a new saved shape kind (§14).

- **`s._g`.** Every constructed circle, line, disc or half-plane gets `s._g` after each recompute. A comes from the
  float64 value of the exact predicate's expansion, not from a separate float64 determinant, so sign(A) and the
  family (disc, half-plane, complement, §2.3) can never disagree [C10].
- **`Region.formOf(s)`** [C8] returns `s._g` when present, else the form built from the shape's own fields (disc,
  circle, half-plane, line; null for other kinds). **Every reader of a circle's or disc's geometry uses it**: levelOf
  (so the forward mesh, hit tests and integrals), curvesOf, shapeClip, `capOf` (the globe caps, region.js; caps are
  already this form, so sphere.js does not change), the deformation transport and export geometry. The cached c, r
  stay as computed; they reach only older builds (§8).
- **`Region.levelOf(s)`** uses −f/2 from the form. Near the curve that is the signed distance, at any radius.
- **`Inverse` kindLevel** (inverse.js) returns [−f/2, −∇f/2] for a form, in float64 relative to o. The CPU per-pixel
  level then needs no float64 centre 1e8 away.
- **Re-anchoring per view** [C5]. float32 is accurate only near the anchor: the two terms of f cancel near the curve,
  with an error of about 6e−8·|z − o|. So for each view the CPU re-anchors in float64: o′ = the point of the curve
  nearest the view centre, B′ = B + A(o′ − o), C′ = f(o′) (exact algebra for a quadratic), then packs (o′, A, B′,
  C′). A view change repacks the uniforms only.
- **GPU** [C4] (gl.js TKIND, `packShapes`, `packShape`; glsl.js). `packShapes` skips every record with TKIND > 10
  (areas are 1–10, curves 11 and up), so the form needs two kinds:
  - `gdisc: 8`, the area form, on the inverse and Preimage area paths (disc, half-plane and complement of a
    gcircle);
  - `gcurve: 20`, the curve form, on the curve paths (circle, line of a gcircle).
  - `packShape` keeps TKIND by `s.kind` and switches to 8 or 20 when `Region.formOf(s)` comes from `s._g`.
  - Both evaluate in coordinates relative to o′. `Region.shapeClip` gets a matching `g` primitive (a disc or
    half-plane clip from the same coefficients).
  - The Λ-rule data (at0, thru0) come from f. **thru0 comes from incidence** [C9]: when a defining point is exactly
    0, o is anchored at it, C = 0 exactly, and the Λ rule treats the circle as its tangent half-plane at 0 (today
    at0 = level(0) > 0 would read ±1e−17 and flip between frames).
  - Today a disc of radius 1e8 is packed as (c, r) in float32, with c and r rounded to ±8: wrong by whole units.
- **Huge circles drawn as curves** [C7]. `circ` (region.js) samples 160 equal angles, so a circle of radius 1e8
  shows no samples in a window of size 10, and clipping it to the window would drop the far arc that 1/z maps next
  to 0 in Y.
  - A gcircle, and any circle with r > 50 × the window's diagonal, is sampled as M(ℝ), where M is the Möbius map
    with 0, 1, ∞ → three points of the circle (§2.5 has M).
  - The existing line sampler runs on t, dense near the view with geometric tails to REACH, and the samples are
    mapped by M.
  - One path serves lines, huge circles and A → 0, continuously through the collinear case. Circles in today's
    goldens are far below the threshold, so they keep the 160-angle path.

### 2.3 The region of a circle through three points

- **At creation the tool makes the disc**, whatever the order of the taps: if orient(P, Q, R) < 0 it sets
  `def.flip`. If the three points are collinear at creation, the left side of P → Q is kept (built in the review
  round: math-9). Collinear means exactly, by incidence, or by the decimals the user snapped or typed (math-3).
- **Afterwards the side follows the orientation**, continuously:
  - A > 0: `disc` (c, r);
  - A = 0 exactly: `halfplane` (a = the point of the line nearest o, b = a + direction);
  - A < 0: `disc` with `complement: true`.
- The kind changes in place while dragging, as a globe cap slid over ∞ already does (region.js:1600, panels.md 9.4).
  The row is rebuilt when its kind changes (`rowKind`, app.js:7797).
- **Use complement** (the row's ⋯ menu, the editor's check box) toggles `def.flip`, not `complement`. `complement`
  stays a derived field, so the two cannot disagree.
- **∞ as a point.** circle(P, Q, ∞) is line(P, Q), and its region is the half-plane left of P → Q.

### 2.4 Intersections

- **The exact family**: lines, circles, segments, rays, arcs, disc and half-plane boundaries, rectangle, polygon,
  annulus and sector boundary pieces (`part`).
  - The meet is solved on the pieces' carrier generalized circles with the entering rule: index 0 is where curve 2
    enters the left side of curve 1. The rule is continuous through the line case (review users-2).
  - **Two lines** [C6] (lines, segments, rays, half-plane edges, bound lines, and gcircles that are exactly lines by
    incidence): the entering rule would send the finite crossing to ∞ once a line turns past parallel, and keep it
    there. So the meet stores `index: 'finite'`: the finite crossing, and ∞ only while the lines are parallel. Pairs
    that involve a circle keep the entering rule.
  - On a bounded piece the point is undefined when it falls off the piece ("The curves do not meet here").
- **Formula curves and freehand curves** (traced; no carrier):
  - the crossing nearest to the stored `seed`;
  - polyline crossing, then Newton on the two level functions to float64 for formula curves;
  - deterministic (the seed is a definition, not history), but it can jump when another crossing becomes nearer. The
    row's tooltip says so.
- **Grids** (`cgrid`, `pgrid`) are never snap targets.
- **"Picked where they are."**
  - A snap or the Intersect tool picks the crossing nearest the pointer.
  - It stores the index that the entering rule gives that crossing, so at creation the point is where the user
    pressed.
  - Tangency: both indices give the same point.
  - Two lines meet at their crossing and at ∞.
  - Parallel lines: both points are ∞, with the note "They meet only at ∞" (users-20).

### 2.5 Points on curves

- **Parameter `t`, by curve type** [C14]. On a closed curve t wraps, so a slider or Play goes all the way round.
  - on circle(P, Q, R): S(t) = M(tan πt), t ∈ [0, 1), where M is the Möbius map with 0, 1, ∞ → P, Q, R: P, Q, R at
    t = 0, ¼, ½ (continuous through the line case; users-8). The pace is the Möbius one, not even (as built in v16;
    review math-12). One of P, Q, R may be ∞: the limit map (R = ∞: P + tan(πt)(Q − P)), so a glider never jumps when
    a defining meet turns parallel;
  - on line(P, Q), a segment, a ray or a bound line: P + t(Q − P) (no wrap);
  - on a plain circle, disc or annulus edge: angle / 360°, t ∈ [0, 1);
  - on a closed polygon or rectangle: t ∈ [0, n) across the n sides, so a glider slides round the corners;
  - on an arc a, m, b: S(t) = M(tan(πt/2)) with 0, 1, ∞ → a, m, b, t ∈ [0, 1], a at 0, m at ½, b at 1 (the exact form
    of the circle through a, m, b; review math-7); on an open polyline: its affine t, no wrap;
  - on a formula or freehand curve: no t. The point is the projection of the stored seed; it has no t field and
    offers no bind.
- A drag sets `t` (or the seed) from the pointer's projection. A `bind.t` formula makes it follow a shared number
  (§6); on a closed curve the value is taken mod the period.

## 3. The dependency graph (`Constr.graph`, in constr.js)

- **Nodes**: shapes with `at` or `def`. The sources are free point shapes, the handles of free shapes, zero fields of
  f₁ and shared numbers (through `bind`).
- **Topological order** by Kahn's algorithm, ties broken by list order (S.shapes, then S.targets). It is rebuilt only
  on a structural change: add, delete, bind, unbind, Make free, load, undo, and a step uid entering or leaving f₁.
- **A change recomputes the downstream closure** of what moved, in that order:
  - a handle or point drag;
  - a zero drag (`zpSet`) or a zero list edit;
  - a number (`onParamChange`, after `applyBinds`). When a step changed and f₁ is a zeros-and-poles step (a zero
    written with a number, ζ₁ = a + i), the closure of f₁'s zero refs is recomputed too [C13];
  - a chain change, for image refs (§1.2);
  - a field edit;
  - undo.
- **Then exactly those shapes update**, through the existing calls:
  - `shapesChanged(false)` while dragging (motion quality), with a commit at the end of the gesture;
  - `targetsChanged` for targets;
  - one undo step per gesture, as for zeros and handles;
  - animation (Play of a number) never adds undo steps.
- **The live path must hold 60 fps** [C3]. Measured in v15.1 (CRITIQUE §3): 50 discs moved by a number run at
  ~21 fps, 65 % of it in Y's auto-fit (`fitRight → fittedView`) and 33 % in forward meshes. So:
  - (a) Y is not auto-fitted during live changes (slider frames, Play, construction drags). It is fitted once when
    the gesture ends, as onUp already does for handle drags. This also speeds up v15's own slider path.
  - (b) While a gesture is in motion, a dirty area whose picture is drawn per pixel (`exactImages` on, so its
    forward mesh is not on screen) skips its mesh rebuild until rest. Nothing on screen is ever stale or coarser:
    a mesh that is on screen is rebuilt every frame (quality first).
  - (c) The gate reports 1, 10 and 50 dependents separately. 1 and 10 must pass BUDGET60; 50 is promised only if
    it passes after (a) and (b) are measured, and is otherwise reported as a known limit.
- **No cycles by construction.**
  - The snap targets of a gesture exclude the shape being edited and everything built on it.
  - Shared numbers cannot refer to shapes.
  - `sanitizeState` still runs a cycle check and turns a cyclic shape free (§8).
- **Planes.** Refs never cross planes, with one one-way exception.
  - Shapes refer to shapes and to f₁'s zeros and poles.
  - Targets (Y, Preimage) refer to targets, and to F(z₀) of X's point shapes through `{img}` refs [C23]. Nothing
    in X refers to a target, so no cycle crosses the planes.
  - The same tools work on targets, with the same code path (editDown's `target` flag).
- **Undefined: two owners, two fields** [C2]. v15's `applyBinds` deletes `s.undef` and shows the shape again for
  every shape without `bind`, on every slider frame, undo and load. So constructions must not share its field.
  - A node whose op fails, or whose argument is undefined, gets `s.cundef = {code, args}` (§3.1) and `s.cHid = true`,
    with `s.visible = false`. These are saved (like v15's `undef`/`undefHid`), so an older build hides it too.
  - `applyBinds` (v15's `undef`/`undefHid`) restores visibility only when `!s.cHid`; the graph restores it only
    when `!s.undefHid`. The shape is shown when neither owner hides it. A glider with `bind.t` can have both.
  - Its dependents become undefined too ("z₃ is undefined").
  - It comes back, visible, when the values allow it. The concrete fields keep the last good shape for older builds.
  - During a gesture only, an undefined construction is drawn in the overlay as its last good shape, dashed at 30 %
    [C11]; at rest it is hidden as above, and it never appears in export.
- **∞.**
  - A point whose value is ∞ is not undefined: `s._atInf = true`.
  - It is hidden in the planes and drawn at N on the globes. Its row reads "z₃ = ∞".
  - As an argument it is used as ∞: circle(P, Q, ∞) is a line, midpoint(P, ∞) is ∞, and a line through ∞ is
    undefined ("A line needs two finite points").
- **Cost.** One recompute is O(closure) and the geometry is a few flops per node. The mesh rebuild of changed
  areas is what costs, and it is the existing per-shape path (§18, perf).

### 3.1 Undefined reasons (codes and exact strings)

CORE stores the code and its arguments in `s.cundef`; INTERFACE turns them into text with `$t` (§20). Arguments are
refs or shape ids, never display strings, so a rename or a language switch updates the text.

| Code | Case | Reason |
|---|---|---|
| `coincide` | line, segment, bisector, circle(P; Q): the two points coincide | The points coincide |
| `coincide3` | circle3: two of the three coincide | Two of the points coincide |
| `nomeet` | meet: no crossing, or off a bounded piece | The curves do not meet here |
| (none) | meet: parallel lines | (not undefined) z₃ = ∞, note "They meet only at ∞" |
| `argUndef` {x} | an argument undefined | {x} is undefined |
| `lineInf` | a line through ∞ | A line needs two finite points |
| `zpNotF1` {mark, f} | a zero of a step that is not f₁ | {mark} is a zero of {f} now: only the zeros and poles of f₁ lie in the z-plane (pole: "…a pole of…") |
| `zpRemoved` {mark} | the zero or pole was removed [C12] | {mark} was removed |
| `stepRemoved` {mark} | the zeros-and-poles step was removed | The step of {mark} was removed |
| — | a bound field (v15) | unchanged (applyBinds, `undef`) |

The zero-index case "{f} has no {mark}" is gone: refs use ids now (§1.2).

## 4. Snapping and binding

### 4.1 Targets, in priority order

The nearest target in the first class within its radius wins. Which classes a tool uses depends on the tool [C16]:

| Class | Mouse | Touch | What | Used by |
|---|---|---|---|---|
| points | 8 px | 22 px | point shapes; handles of other shapes; ζ and p of f₁ (when X shows the z-plane); F(z₀) in Y (§1.2); N on an editable globe (∞, for Circle through 3 points only) | every tool |
| crossings | 8 px | 22 px | crossings of two visible curves or boundaries near the pointer | every tool |
| curves | the stroke's hit width + 3 px | 10 px | the visible curves and boundaries, on the drawn stroke only | the Point tool and the construction tools; never the drawing tools' handles |
| grid | 9 px | 9 px | the existing ruler snap (`snapZ`) | as today |

- **Drawing tools** (Segment, Line, Disc, …) snap their handles to points, handles, zeros and crossings, never to
  curves [C16a]. A tight curve radius for the Point tool [C16b] keeps a free point easy to place: in the default
  phone scene two curves 38 px apart leave most of the gap free.
- **Crossings are found locally** [C28], on each pointer move: only the curves within the snap radius (usually 3 or
  fewer) are intersected, on their samples in a small box around the pointer, then refined (exact on carriers, Newton
  on formula curves). The cost is O(k²) per move, there is no cache to go stale and no cap on the number of curves.
- **Excluded targets** [C11a]. A gesture's targets exclude the shape being edited, everything built on it, and the
  co-arguments of every construction the dragged thing defines (z₂ cannot land on z₀ while both define Circle 1).
  Hovering an excluded co-argument shows the chip "Circle 1 needs distinct points".
- **Alt** suspends all snapping, as today.
- **The Snap toggle (S.snap)** governs the grid, points, crossings and curves for the drawing tools. The four
  construction tools always pick points and curves (that is what they do); for them the toggle governs only the grid.
- **The ring.** While a gesture is near a target, the existing snap ring draws on it, with a chip that names it, at
  the ring and never over the pointer: "on z₂", "on ζ₁", "on the end of Segment 1", "on Circle 1 ∩ Line 2", "on
  Circle 1". On touch there is no hover, so the ring and chip are drawn 48 px above the finger [C19]. The snap sound
  cue plays as today.
- **Points in Y** [C23]: while Y shows the whole chain's image, drawing in Y offers F(z₀) (labelled z₀″). Otherwise
  a press on z₀″ shows the chip "Draw in X to use z₀".

### 4.2 What a press or a release on a target does

- **The press binds the start** [C19]. editDown places a drawing tool's first handle at pointerdown, so that handle
  snaps and binds at the press; the other handle binds at the release. Drawing tools keep v15's press–drag–release.
- On a point or handle: the handle is bound to it (`s.at[key] = ref`).
- On a crossing: a `meet` point is created, then bound. One undo step.
- **Helpers** [C16c]. A meet point that a drawing tool's snap creates on its own is a helper: `helper: true`,
  `owner` = the shape that made it, a small ring and no label in the plane, and its row indented under the owner.
  It is deleted with its owner when nothing else uses it. Selecting it, or using it in another construction, keeps
  it; "Show as point" (⋯) clears `helper`. Points the user makes on purpose (the Point tool, Intersect, Midpoint,
  picks of a construction tool on empty space) are ordinary points with labels.
- **The Point tool:**
  - on an existing point it makes nothing new and selects it; on a zero it drags the zero, as in v15 (§1.2);
  - on a crossing it makes the meet point;
  - on a curve's stroke (§4.1) it makes a point on the curve;
  - elsewhere it makes a free point, as today.

  This is how "Point on curve" is reached (§14).
- **Tools that bind handles:** Point, Segment, Line, Ray, Circle, Arc, Disc, Rectangle (both corners), Polygon (every
  vertex), Half-plane, Annulus and Sector (the centre or vertex). A polygon or lasso traced freehand does not bind.

### 4.3 Dragging bound and constructed things

- **A bound handle has no square**; a small ring marks the binding.
  - A press there goes to the point beneath: a free point drags, and a zero drags as a zero.
  - A constructed point does not move: the chip says "z₃ is built from Circle 1, Line 2: drag those".
  - When the selected shape's own handle and a zero share a spot (app.js:10477 `onSel`), a bound handle no longer
    counts as a handle, so the zero wins.
- **Moving a whole shape** (mode 'move') that has a bound handle or a definition [C18]:
  - when every root source (followed transitively) is a free point shape, the move translates those points, and the
    shape and everything built on them follow (GeoGebra's rule: dragging a line through z₀ and z₁ drags both).
    Constructions commute with translation, so the picture is exactly the translated one. One undo step;
  - otherwise (a source is a zero, a handle of another shape, or a curve) the press **pans** X, as a press on empty
    space does, and the chip "Built on ζ₁, Segment 1: drag those, or Make free" shows once per session. So a large
    3-point disc or half-plane never blocks panning.
  - A free point on which other shapes are built moves as today, and they follow.
- **A point on a curve** drags along its curve (t from the projection).
- **A free point** drags anywhere and snaps to the grid only, never to points, crossings or curves [C22]: two points
  never stack on one spot by accident, and a defining point never lands on its co-argument. The context menu's "Put
  on this curve" turns it into a point on the curve on purpose (§11). Merging two points is not in v16.

## 5. Tools, chips and where they live

### 5.1 The four new tools

All four are added to `TOOLS` (app.js:7516), with a `group: 'construct'` flag and a short tile label. Every
platform gets the same four.

| id | Full name (tooltip, rows, palette) | Tile | Picks | Makes |
|---|---|---|---|---|
| `circle3` | Circle through 3 points | 3 points | 3 points (targets, or new free points) | circle or disc (chip switch, §5.2) |
| `meet` | Intersect | Intersect | a crossing; or curve 1, then curve 2 | the picked meet point; both points of two curves |
| `midpoint` | Midpoint | Midpoint | 2 points, or a segment | a point |
| `bisector` | Perpendicular bisector | Bisector | 2 points, or a segment | a line |

- A pick on empty space makes a free point there (grid-snapped, as the Point tool does). It is created in the same
  undo step as the construction. Esc then removes it with the draft.
- **While a tool waits** (pick 2 of 3):
  - the existing draft chip (`updateDraftChips`, 3045) reads "Circle through 3 points: point 2 of 3 · Esc cancels";
  - a dashed preview passes through the pointer: the circle or region for `circle3`, the midpoint, the bisector;
  - Backspace removes the last pick, and Esc cancels the draft.
- **Picks are clicks, not drags**, on mouse and on touch. A drag between picks pans, as with the polygon tool.

### 5.2 Circle through 3 points: circle or region

- **The chip carries a two-way switch, "Curve | Region".** It is remembered for the session, and the default is
  Region, because the user asked for regions.
- **Region** makes the disc (§2.3).
- **Afterwards** the Selection section (§7) switches between curve and region with the same definition. The kind
  changes; the ops stay.

### 5.3 Desktop (1024 px and up)

- `#secDraw` gets a second labelled grid, **"Construct"**, under the Draw grid: one row of 4 tiles with the same
  4-column grid and tile size.
- It is 60 px taller. The Shapes section below scrolls, as it does today.

### 5.4 Tablet (768 to 1023 px)

- **The rail** (`#railTools`) gets the four icons after a 1 px divider.
- **If the rail would overflow** the panel's height, Grid and Polar grid leave the rail first (they stay in the
  drawer), then Freehand and Lasso. A test checks this at 768 × 1024 and 1024 × 768.
- **The drawer** (252 px) shows the Construct grid as on desktop.

### 5.5 Phone (below 768 px)

- **The tool row is unchanged**: Undo, Select, Point, Disc, Polygon, More.
- **More tools** (`fillTiles`, phone.js) gets a "Construct" heading and the four tiles after the drawing tiles.
- **Choosing a tile closes the sheet** [C20], as v15 already does for the drawing tiles (fillTiles calls `close()`
  for every tile but Formula), so the picks happen in the full-height planes, not in a 195 × 290 px strip. While a
  construct tool is active, the tool row's More key shows that tool's icon, as v15's `syncTools` does for a drawing
  tool chosen from More (its MutationObserver and `#tools .tool.on` query must also cover `#constructTools`), and the
  draft chip carries the × that cancels it.
- The plane shows only the draft chip. Nothing opens over the plane uninvited.
- Touch radii from §4.1. Long-press stays the context menu (v15).

### 5.6 The command palette

The palette gets one entry per tool, plus "Make free" and "Use complement" for a selected construction.

## 6. Shared numbers in construction fields

These are v15's `bind` mechanism (app.js:13190), so no new parsing:

- **A point on a curve:** `t` is a field; typing `a` (or `2a + 1`) binds it, and a slider moves the point along the
  curve; on a closed curve the slider goes all the way round (§2.5). A point on a formula or freehand curve has no
  t field and offers no bind [C14].
- **A free point:** `p` = `a + b i` (v15 already).
- **Circle or disc with a bound centre:** r = `2a` (v15's `bind.r`).
- **A meet** has no number fields. "Other point" in the Selection section swaps `index`.

A number change recomputes `applyBinds` first, then the graph's closure from those shapes (§3).

## 7. The Inspector's Selection section

The Inspector (inspector.js) shows a step, F or the Region today (`render`, line 425; `selOf`, app.js:9114).

- **New view, "Construction".** It shows when the selected shape (`selected`) has `def` or `at`, and the step
  selection is the Region (S.sel null or 0).
  - **head:** the shape's swatch, name and kind icon;
  - **definition** (TeX), for example "circle through z₀, ζ₁, z₂", "z₃ = Circle 1 ∩ Line 2, first point", "Line 2
    through z₀ and the end of Segment 1";
  - **uses** and **used by**: chips. Hovering a chip highlights that shape in X; clicking it selects it;
  - **fields:** t for a point on a curve (with the v15 link chip for numbers), "Other point" for a meet, and
    Curve | Region (and Use complement) for a 3-point circle;
  - **Make free:** keeps the shape and forgets `def` and `at`. Shapes built on it keep following it as a free shape;
  - **Delete:** "Delete (and 3 built on it)" (§9);
  - **undefined:** the reason in `--warn`, above the fields.
- **The Inspector never opens by itself.**
  - On desktop it updates in place.
  - On tablet, while the right drawer is closed, nothing opens.
  - On a phone, the Editor sheet opens only from its button or the row's ⋯ → Edit.
- **Free point shapes** keep the Region view. Their fields stay in the Shapes list editor, as today.

## 8. Saving, links, undo

- **Saved as is.** `s.at`, `s.def`, `s.helper`, `s.owner`, `s.cundef`, `s.cHid`, `st.uid` and `st.zpIds` are part of S, so `snap()` (app.js:252), autosave, links
  (`Params.encodeLink`) and scene files carry them. `s._g`, `s._atInf` and the graph are runtime only (`noRuntime`, app.js:290, drops `_` keys).
- **`sanitizeState`** (337), after the shapes are cleaned:
  - It validates every ref (the shape exists in the same list; the handle key exists; the zero step uid exists; the
    part index exists) and every op's argument count and types.
  - It finds cycles.
  - A shape that fails keeps its concrete fields and drops `def` and `at`. CORE emits one `'loadFreed'` {n} event;
    INTERFACE shows one toast: "Some constructions could not be read and were opened as plain shapes." (No
    per-shape toast.)
  - The fallbacks of §1.2 run first [C29].
  - Then one full recompute.
- **Copies of steps keep the uid and the zero ids.** Every place that copies steps field by field must also copy
  `uid` and `zpIds`:
  `sanitizeState`'s `steps.push` (337), `sceneMeta` (10052) and the tour's scenes.
- **Undo snapshots.** `snap()` (252) has no replacer, so they carry `_g`. Restoring one recomputes everything anyway.
- **The definitions are the truth** (as review math-3 made the formulas). A loaded state is recomputed. The concrete
  fields are a cache for older builds.
- **Older builds** (v15.1) draw the cached concrete shapes and do not follow. Their sanitizeState rebuilds steps as
  {type, params, on}, so a state they autosave loses `uid` and `zpIds`; §1.2's fallbacks restore the zero refs
  [C29]. constr_core_cmd checks that v15.1 keeps the shape fields.
- **Undo.**
  - one step per creation, including the free points, meet points and points on curves that a gesture made;
  - one step per drag (point, zero, handle, slider);
  - one step per Make free, delete cascade or Use complement.

## 9. Deleting

The rule [C17]: **only definitions cascade**. A shape with `def` (circle3, meet, midpoint, bisector, glider) cannot
exist without its arguments; a shape that merely snapped (`at`) can, and the user may not know it snapped.

- **Delete a shape** (row ⋯, Delete key, menu, Inspector):
  - the shapes whose `def` uses it are deleted with it, transitively, and so are helpers it owns that nothing else
    uses;
  - every `at` binding to a deleted shape is dropped: that handle stays where it is and becomes free (other
    bindings of the same shape stay);
  - one toast, plural-aware (`$tn`), with Undo: "Deleted Circle 1 and 3 shapes built on it." and/or "2 shapes no
    longer follow it.";
  - one undo step.
- **Clear shapes** clears all of them, as today.
- **Removing a zero or pole** of f₁ deletes nothing [C12]: its constructions become undefined ("ζ₂ was removed",
  §3.1), and its `at` bindings are dropped as above (the handle stays and becomes free). A zero is removed far more
  easily than a shape (a drag off the plane, a text edit), so nothing built on it is deleted. The toast adds "2
  shapes are now undefined." Undo brings it back with its id.
- **Removing the zeros-and-poles step** (`removeStep`), or moving it away from f₁, deletes nothing. Its dependents
  become undefined (§3.1). The toast adds "2 shapes are now undefined." Undo brings everything back.
- **Make free** is the way to keep a shape and cut it loose.

## 10. The Shapes list rows

`shapeRow` (7748) and `updateShapeList` (7800):

- **Name column:** unchanged (z₃, "Circle 2").
- **Definition column** (the `d` cell, TeX today), for a shape with `def`:
  - "through z₀, z₁, z₂" (a 3-point circle);
  - "the disc through z₀, z₁, z₂", becoming "the half-plane left of z₀ → z₁" [C25] when collinear and "outside the
    circle through …" when the orientation turns;
  - "Circle 1 ∩ Line 2, first point";
  - "on Circle 1";
  - "midpoint of z₀, z₁";
  - "bisector of z₀, z₁".

  The equation moves to the cell's tooltip.
- **A shape with only `at`** keeps its equation in the row and gets a small link glyph. The tooltip says "follows z₀,
  z₂".
- **Undefined:** the existing `err-msg` with the reason, and the eye is disabled (v15 already does this for
  `s.undef`).
- **⋯ menu additions:** Make free (for `def`/`at`); Use complement for a 3-point region (toggles flip); Other point for
  a meet.
- **Hover on a row or on a shape in X:** it, what it is built from and what is built on it stay at full strength.
  Every other shape drops to 30 %, and the rows of the connected shapes take `--accent-soft`. This extends v15's
  `hoverShape`.
- **On touch** there is no hover [C21]: a selected shape that has `def` or `at`, or has dependents, gets the same
  highlight while it stays selected. Deselecting (a tap on empty space) ends it.
- **Helpers** (§4.2) are indented under their owner's row, with no label column.

## 11. The context menu

`PlaneMenu.register('constructions', provider)` from construct.js. The group is reserved in planemenu.js
(`ORDER`, line 14). Items depend on what is under the pointer (8 / 22 px):

- **On a crossing of two curves:** "Mark the intersection" (makes the meet point there).
- **On a curve:** "Point on this curve" (a glider at the projection of the press).
- **On a point, handle or zero:** "Circle through this point…" and "Midpoint with…". Each starts its tool with this
  point as the first pick.
- **On a free point that sits on a curve** (within the curve radius of §4.1): "Put on this curve" turns it into a
  point on that curve, at its projection [C22]. One undo step.
- **On a constructed shape:** "Make free". The object group's Delete shows the cascade count.

## 12. Globes, ∞, the deformation and the image plane

- **Editable globes** (X Sphere at stage 0, `globeDown`, app.js:10755) get the same targets, projected with
  `gScreen`, plus N (∞).
  - The tools pick points on the globe exactly as in the plane.
  - circle(P, Q, R) on the sphere is the circle through the three points (stereographic projection keeps circles).
- **Points at ∞** are drawn at N on the globes. In the plane their row says "= ∞".
- **The deformation, Preimage, integrals, the forward mesh, the exact inverse renderer and export** see ordinary
  shapes. The deformation moves the constructed shapes with H_t. Constructions are computed in z only, once per
  change, not per frame.
- **Export captions** (`shapePhrase`, app.js:9505) gain phrases with the values:
  - "the circle through z₀ = −2 − 0.5i, z₁ = 1 − i and z₂ = −0.5 + 1.5i";
  - "the disc bounded by it";
  - "the half-plane to the left of the line through z₀ and z₁";
  - "the intersection z₃ = … of the circle and the line".

  Captions in Russian use the glossary nouns. Point labels in figures are v15's.
- **The Arc tool already makes an arc through three points** [C24]: its handles a, m and b bind like any others. Its
  tooltip says so ("Arc through 3 points: start, a point on it, end"), the tour's `meet` step mentions it, and
  constr_cmd binds all three.

## 13. Not in this round

- Points in formulas (|z − P| < 2a), lists *k* = [−2 … 2], play modes.
- The exact recognition of the Apollonian and Steiner families in curves.js (users-9). It is a recognizer change, and
  it is independent of drawing constructions.
- Merging two free points, and labels on curves.

## 14. Changes from the old design (DESIGN.md, rev 2) and why

| Old | New | Why |
|---|---|---|
| Points named P, Q, R; numbers lower case | Points stay z₀, z₁ (v15) or the user's label; refs by shape id | v15 review design-6 renamed points to z_k so that a letter is never mistaken for a shared number. Formulas do not refer to points in v16. |
| Parameters as a new Inspector section; names, scope, links | Shipped in v15 (params.js); used here as is | Phase 1 is done. |
| Refs only to point shapes | Refs to points, other shapes' handles, f₁'s zeros and poles, ∞, curves and pieces | The user: "points existent on the page". |
| Zeros as points | Only the zeros and poles of f₁; refs by step uid; one-way | Other steps' zeros are not points of the z-plane. Indices shift when steps move, so a uid is needed. The user: zeros drive, never the reverse. |
| Intersections of lines and circles | Also segments, rays, arcs, every piece of a boundary; traced curves by seed | "Intersections of any two drawn curves." |
| A `gcircle` shape kind | No new saved kind: the ordinary kinds plus the runtime gcircle form `s._g`, read through `Region.formOf` by every geometry reader, and two GPU kinds (`gdisc` 8, `gcurve` 20) | Rows, captions, tex and older builds keep working with the kinds they know; the geometry readers (levels, curves, caps, clips, GPU) get the exact form [C4, C8]. |
| Construction tools: Circle (3 points), Intersect in the Draw grid; Midpoint, Bisector, Point on curve under More | One "Construct" group of four (Circle through 3 points, Intersect, Midpoint, Bisector) on every platform. Point on curve is the Point tool snapping to a curve, plus the menu item | The desktop Draw grid has no More (it is phone-only CSS); four tiles fill one row. The Point tool snapping to curves is the rule the Line tool already follows. |
| The tool makes the disc | The same, with a Curve \| Region switch on the chip; Use complement toggles `flip` | users-7 / design-15 settled the disc. The user asked for regions, and a curve is still one tap away. |
| Label placer for curve names (c, g) | Points use v15's label placer; no curve labels | v15 has the placer for points. Curves are named in the rows, and hovering shows the links. |
| Delete cascade | Only through `def`; `at` bindings are freed. Removing a zero or a step makes things undefined | A user may not know a handle snapped; zeros are removed easily (drag-off, text edit) [C12, C17]. |
| Selection section: definition, uses / used by, Make free, Delete | The same, built into v15's Inspector as a "Construction" view; never opens by itself | The rule "nothing covers the work area uninvited", and v15's tablet drawer and phone sheet. |
| Tour: three steps on numbers and constructions | The numbers step shipped in v15 (chapter Edit). New chapter "Constructions" (§15) | |
| Phase-2 perf units in the perf suite | constr_core_cmd.js gates BUDGET60 itself (1 and 10 dependents; 50 reported); a unit is proposed, not added | The rule: never change the perf baselines or accepted.json [C3]. |

## 15. Russian

All new strings go through `$t` / `$tx` / `$tn`. Entries go in `notes/i18n/ru/v16-constructions.json` (the format of
v15-planemenu.json: id → {en, ru, note, ctx?, en_plural?}). `tools/make_ru_table.py` must also read `v16-*.json` (one
glob added next to `v15-*`). `python3 tools/make_ru_table.py --strict` must report 0 unresolved. Glossary: circle
окружность, disc круг, line прямая, half-plane полуплоскость, point at infinity бесконечно удалённая точка; «вы» and
the plural imperative in hints.

| English | Russian |
|---|---|
| Construct (group) | Построения |
| Circle through 3 points / tile: 3 points | Окружность по трём точкам / плитка: По 3 точкам |
| Intersect | Пересечение |
| Midpoint | Середина |
| Perpendicular bisector / tile: Bisector | Серединный перпендикуляр / плитка: Перпендикуляр |
| Curve \| Region | Кривая \| Область |
| Circle through 3 points: point {n} of 3 · Esc cancels | Окружность по трём точкам: точка {n} из 3 · Esc — отмена |
| on {x} (snap chip) | привязка: {x} [C26] |
| through {a}, {b}, {c} | через {a}, {b}, {c} |
| the disc through … / outside the circle through … | круг, ограниченный окружностью через … / внешность окружности через … |
| the half-plane left of {a} → {b} | полуплоскость слева от {a} → {b} [C25] |
| {c1} ∩ {c2}, first point / second point | {c1} ∩ {c2}, первая точка / вторая точка |
| on {curve} | на кривой: {curve} [C26] |
| midpoint of {a}, {b} / bisector of {a}, {b} | середина {a}, {b} / серединный перпендикуляр к {a}{b} |
| the start of / the end of / the centre of / vertex {n} of {shape} | начало / конец / центр / вершина {n}: {shape} |
| uses / used by | строится по / используется в |
| Make free | Отвязать [C26] |
| Other point | Другая точка |
| Mark the intersection | Отметить пересечение |
| Point on this curve | Точка на этой кривой |
| Put on this curve | Поместить на эту кривую |
| Show as point (helper) | Показать как точку |
| {x} needs distinct points | {x}: нужны различные точки |
| Draw in X to use {x} | Чтобы использовать {x}, рисуйте в X |
| Release to remove {mark}; {n} shapes will be undefined | Отпустите, чтобы удалить {mark}; станет не определено фигур: {n} ($tn) |
| {mark} was removed | {mark}: удалён |
| {n} shapes no longer follow it. | Отвязано фигур: {n}. ($tn; neutral, no agreement with {x}) |
| {n} shapes are now undefined. | Не определено фигур: {n}. ($tn) |
| Built on {x}: drag those, or Make free | Построено по {x}: перетаскивайте их или нажмите «Отвязать» |
| {x} is built from {y}: drag those | {x}: построено по {y}, перетаскивайте их [C26] |
| The points coincide | Точки совпадают |
| Two of the points coincide | Две точки совпадают |
| The curves do not meet here | Кривые здесь не пересекаются |
| They meet only at ∞ | Они пересекаются только в ∞ |
| {x} is undefined | {x}: не определено |
| A line needs two finite points | Для прямой нужны две конечные точки |
| {mark} is a zero of {f} now: only the zeros and poles of f₁ lie in the z-plane | {mark} теперь нуль {f}: в плоскости z лежат только нули и полюсы f₁ |
| The step of {mark} was removed | Шаг, которому принадлежал {mark}, удалён |
| Deleted {x} and {n} shapes built on it. | Удалено: {x} и зависимые фигуры ({n}). [C26] |
| Some constructions could not be read and were opened as plain shapes. | Некоторые построения не удалось прочитать: они открыты как обычные фигуры. |

The neutral «{x}: не определено», «Удалено: …», «{x}: построено по …» and «привязка: {x}» avoid gender agreement with
the unknown noun (the old design's rule, kept) [C26]. INTERFACE checks every `{x}` slot for agreement before the
strings are frozen. Tile labels must fit 52 px at 11 px semi-condensed. «Перпендикуляр» (13 letters) is as long as the
existing «Прямоугольник». A screenshot at 390 px in Russian checks all four.

## 16. The tour chapter

A new chapter `construct` in tour.js, "Constructions", ~1 min, rev 1. It uses scene `construct`: f(z) = 1/z, three
free points z₀, z₁, z₂ and a line through two of them, at the default view. Events from construct.js: `tourEmit`
'construct-added' {op}, 'construct-moved' {id}, 'construct-family' {kind}.

1. **`c3`**, "Circle through three points". Anchor `constructTools` (phone: the More key, `tryWide` off). Body:
   "Pick three points: points already on the page, crossings, or empty spots. The circle and its disc follow them."
   Try: "Choose Circle through 3 points and tap z₀, z₁, z₂." Done on 'construct-added' op circle3.
2. **`follow`**, "It follows its points". Anchor paneL. Body: "Drag z₂ across the line through z₀ and z₁: the disc
   becomes a half-plane, then the outside of the circle." Try done on 'construct-family' kind halfplane or
   complement.
3. **`meet`**, "Intersections". Anchor paneL. Body: "Drawing tools snap to points, to crossings and to curves; a
   snapped end follows what it is on. Hold Alt to place freely." Try: "Draw a line from a crossing." Done on
   'shape-added' with a bound handle.

## 17. Files

Each file has one owner (§20). "C" = CORE, "I" = INTERFACE.

**New**
- **`src/constr.js`** (C): geometry, refs and the graph; no DOM, no strings; it works in node.
  - From poc/constr.js: orient, gc, circle3, line2, circleCP, bisector, meets, mob3, mob3inv, incidence, Kahn order.
  - New: refs and `resolve`, pieces, `'finite'` line meets, the local meet solver (`meetNear`) and the seed solver,
    glider parameters with wrap, `formOf`, `level`, `reanchor`, the M(ℝ) sampler's map, `validate`, the delete and
    zero-remove plans, `moveRoots`, `excluded`, `describe` (§20.2).
- **`src/construct.js`** (I): the app glue for everything the user sees, with `Construct.init(api)` as for Phone and
  PlaneMenu, and `Construct.on(type, data)` for CORE's events.
  - snap targets, the ring and the chip; the tools' state machines; binding at press and release;
  - definition texts and reason texts; the Construction view for the Inspector; the menu provider; toasts; tour
    events.
- **`test/t_constr.js`**, **`test/constr_core_cmd.js`** (C); **`test/constr_cmd.js`** (I).

**Changed** (each a small, separate hook, named by function)

| File | Owner | Change |
|---|---|---|
| `src/app.js` | C | the `cm` model block (one new block next to applyBinds, §20.2). applyBinds: restore visibility only when `!s.cHid` [C2]. onParamChange: `cm` recompute after applyBinds, f₁ zero refs [C13], no Y auto-fit while live [C3a]. shapesChanged / shapeGPU: skip off-screen meshes in motion [C3b]. zpSet/zpAdd/zpRemove/swap/zpWrite: `zpIds`, recompute, zero-remove plan. addStep/removeStep/moveStep/duplicate: `uid`, recompute. sanitizeState: `uid`, `zpIds`, `Constr.validate`, fallbacks [C29]. restore (undo, load): full recompute. deleteShape, clearGroup: `Constr.deletePlan`. sceneMeta and every step copy: keep `uid`, `zpIds`. Test hook `__cmwC`. |
| `src/app.js` | I | 4 TOOLS rows, icons, palette entries, help text. Pointer-down: skip zpHit outside Select and Point [C1]. editDown, onMove 'draw'/'handle'/'move', onUp: `Construct.snap`, bind, translate or pan [C18]. Handle hit: bound handles are not handles. shapeRow/updateShapeList: definition text, link glyph, helper indent, ⋯ items. hoverShape: links, touch highlight [C21]. Inspector adapter: `construction()`. shapePhrase: captions. drawPoints: rings, helpers, the gesture ghost [C11b]. globeDown: targets. Test hook `__cmwCI`. |
| `src/region.js` | C | `formOf`; levelOf, curvesOf, shapeClip ('g' primitive) and capOf through it; M(ℝ) sampling of gcircles and huge circles [C7, C8] |
| `src/inverse.js` | C | kindLevel: the form in float64 relative to o; thru0 from incidence [C9] |
| `src/gl.js`, `src/glsl.js` | C | TKIND `gdisc: 8`, `gcurve: 20`; packShape branch on `s._g`; per-view re-anchoring [C4, C5] |
| `src/inspector.js` | I | the Construction view (build/fill), its sig |
| `src/page.html` | I | `#constructTools` grid under `#tools` with its heading; the rail divider; CSS for the rings, the link glyph and helper rows |
| `src/phone.js` | I | the Construct heading in More tools (fillTiles); syncTools also watches `#constructTools` [C20] |
| `src/tour.js` | I | the chapter and its scene |
| `src/i18n*.js`, `notes/i18n/ru/v16-constructions.json` | I | strings; regenerated |
| `tools/make_ru_table.py` | I | read `v16-*.json` |
| `build.py` (xvc) | C | include constr.js after region.js and construct.js after planemenu.js, in both outputs (CORE ships a stub construct.js in step 0, §20.3) |
| `test/glsl_test.js` rows | C | gdisc and gcurve rows |

`planemenu.js`, `sphere.js`, `figure.js` and `params.js` do not change.

## 18. Tests

**`test/t_constr.js`** (C; node; loads `work/xvc/src` like bridge.test.js):
- **Ported:** the PoC's 66 tests and 18 bridge tests, against the app's modules.
- **Refs:** a zero ref follows `zpSet`; it is undefined when the step moves to f₂ and back when it returns; ids
  survive remove, swap and a text edit that deletes the first zero (nearest-value matching) [C12]; a v15.1-stripped
  state (no `uid`, no `zpIds`) rebinds to f₁ [C29]; handle refs; piece refs; ∞; image refs follow a chain change
  [C23].
- **Collinear and continuity:**
  - circle3(P, Q, X) is a `halfplane` with A = 0 for X = meet with line(P, Q), glider on it, midpoint, and a handle
    bound to such a point (2000 random cases each);
  - the family disc → half-plane → complement is continuous: the level at fixed samples changes by less than 1e−6
    per 1e−7 step across collinear;
  - sign(A) equals the exact predicate's sign in 10⁵ near-collinear cases [C10].
- **Exact levels:** the form's level = Region level sign on 20 000 samples, for r = 1, 1e3, 1e6, 1e9 and A = 0, and
  for a view 1e4 away from o after re-anchoring [C5]. A circle through 0: the Λ rule is stable at |z| < e^−60 [C9].
- **Sampling** [C7]: a gcircle of r = 1e9 shows no gap above 1 px in the view, and its far arc is present (under 1/z
  it reaches within 1e−6 of 0).
- **formOf readers** [C8]: capOf from the form equals today's cap for r = 1, and is exact for A = 1e−15.
- **Intersections:** the entering-rule index is stable through the line case (users-2); L₂ turned through parallel
  in 41 steps: the `'finite'` meet passes through ∞ and comes back [C6]; off-segment is undefined; parallel lines
  are ∞ with the note; the formula-curve seed solution is within 1e−12 after Newton; `meetNear` finds the same
  crossing as the all-pairs solver [C28].
- **Gliders** [C14]: t wraps on circle(P, Q, R), circles and closed polygons (round the corners); a formula curve
  has no t. A bound radius below 1e−3 passes through its point [C15].
- **Graph:** Kahn order with ties by list order; the closure recomputes only dependents; `excluded` holds the shape,
  its dependents and its co-arguments [C11]; the sanitize cycle check.
- **Plans:** delete through `def` only, `at` freed, helpers with their owner [C16, C17]; zero removal makes
  dependents undefined and deletes nothing [C12]; `moveRoots` returns the free roots or null [C18].
- **Save:** the save → load round trip is bitwise identical for every shape field. A broken ref keeps the shape free,
  with one event.
- **Bound numbers:** `bind.t = 'a'` moves the glider; undefined when out of range.

**`test/glsl_test.js` rows** (C; as for v15 numbers): gdisc and gcurve CPU = GPU sign per pixel at r = 1e9, exactly
collinear, a view 1e4 away from o, a circle through 0, and the clip primitive.

**`test/constr_core_cmd.js`** (C; CDP; its own cdp_kit copy, port 0; serve dist with port 0; one browser). States
are built through the test hooks, with no tools:
- **Exact per pixel:** X and Y read back at rest and mid-drag for a disc through three nearly collinear points (A ≈
  1e−9) and exactly collinear, CPU against GPU, as `zp_cmd` does; the same zoomed onto an arc 1e4 from o.
- **Two owners** [C2]: a meet made undefined stays hidden while an unrelated slider moves, through undo and load.
- **Zeros with numbers** [C13]: ζ₁ = a + i; moving `a` moves the circle on ζ₁.
- **Save / load / link** round trip, and the v15.1 dist opening a v16 link (it shows the cached shapes).
- **Perf (BUDGET60)** [C3]: drag a point with 1, 10 and 50 dependents (areas and curves), and move a number driving
  them. p95 frame ≤ 16.7 ms and render ≤ 14 ms, at motion quality, with one chain signature, for 1 and 10; 50 is
  reported. The existing perf baselines and accepted.json are not touched; the unit `constr.drag` is proposed for
  the lead to accept.

**`test/constr_cmd.js`** (I; CDP; its own cdp_kit copy, port 0; one browser):
- **Tools:**
  - Circle through 3 points by mouse and by touch (22 px), picks on a point, a zero of f₁, a handle, a crossing and
    empty space;
  - a press on ζ₁ with every tool but Select and Point picks it and never drags it; Shift-click still adds a zero
    [C1];
  - Intersect (crossing; two curves); Midpoint and Bisector (two points; a segment);
  - Line, Segment, Circle, Disc, Half-plane and Arc (all three handles [C24]) with their ends snapped; the start binds
    at the press [C19];
  - drawing tools never make a point on a curve; the Point tool does only on the stroke; a crossing snap makes a
    helper with no label [C16];
  - Alt and the Snap toggle.
- **Follow:**
  - drag z₀, and the dependents redraw;
  - drag ζ₁ of f₁, and the circle follows;
  - a press on the bound handle drags the zero and never moves the circle alone;
  - a co-argument is not a target, and its chip shows; mid-gesture an undefined construction is a dashed ghost
    [C11];
  - a free point dropped on a point or curve lands on the grid only; "Put on this curve" [C22].
- **Move** [C18]: a line through two free points drags both; a disc on ζ₁ pans X and shows the chip once.
- **Undefined:** move a line off a circle: the meet hides, its row shows the reason, and it comes back.
- **Delete** [C17]: a def cascade and an `at` release, with the toast text EN and RU; Undo; Make free; Use
  complement; removing ζ₂ warns while dragged off and leaves its constructions undefined [C12].
- **Y** [C23]: a circle through z₀″ and two more in Y; the chip when Y does not show the whole image.
- **Globe:** X Sphere picks, N gives circle(P, Q, ∞) = line.
- **Export:** the caption text, EN and RU.
- **Phone** [C20, C21]: a Construct tile closes the sheet and shows on the More key; a selected shape shows its
  links.
- **Shots** at 1440 and 1024 (desktop), 768 (rail and drawer), 390 (phone: More tools open; a pick in progress after
  choosing a tile), in light and dark, EN and RU: tiles, chip, ring, rows, helpers, Construction view.

**The full existing gate** runs unchanged after each part. The goldens must not change. Drawing tools no longer snap
to curves [C16], so the remaining risk is a test's click within 8 px of a point or crossing with a drawing tool, or
the Point tool on a stroke: if a golden changes, the snap rule, not the golden, gives way.

## 19. Risks

- **GPU forms.** The clip primitive, the re-anchoring and the Λ rule must agree with the CPU. glsl_test rows gate
  them.
- **50 dependents at 60 fps** [C3]. Promised only after (a) and (b) are measured; otherwise reported as a limit.
- **Two owners of visibility** [C2]. Every path that hides or shows a shape must respect both fields; constr_core_cmd
  gates the slider, undo and load paths.
- **Rail overflow at 768 × 1024.** §5.4.
- **Steps reordered under constructions.** Covered by uid refs and the undefined rule.
- **Merging with v15.2** [C27]. Hooks are one line, named by function and guarded; v15.2's rewritten ranges of app.js
  hold none of them.
- **Size.** Two new files, about 1500 lines, much of it from the PoC. About 2 rounds of work, in two parallel parts
  (§20).

## 20. The build split: CORE and INTERFACE

### 20.1 What each part owns

| | CORE | INTERFACE |
|---|---|---|
| Goal | the model: exact geometry, the graph and its state, correct on every path that is not a gesture | everything the user touches or reads |
| New files | `src/constr.js`; `test/t_constr.js`, `test/constr_core_cmd.js` | `src/construct.js`; `test/constr_cmd.js`; `notes/i18n/ru/v16-constructions.json` |
| Sections | §1 (fields, refs, ids), §2 (all geometry, the gcircle form on CPU and GPU), §3 (graph, recompute, undefined state, live-path perf), §8 (saving, links, undo, sanitize), the plans of §9 | §4 (snapping, binding, dragging), §5 (tools, chips, platforms), §6 (fields and sliders in the UI), §7 (Inspector), the toasts of §9, §10 (rows), §11 (menu), §12 (globe picks, captions), §15 (Russian), §16 (tour) |
| app.js | the `cm` block and the model hooks of §17 | the UI hooks of §17 |
| Other files | region.js, inverse.js, gl.js, glsl.js, build.py, glsl_test rows | inspector.js, page.html, phone.js, tour.js, i18n, make_ru_table.py |
| Strings | none: codes and refs only | every string, including reason codes and event toasts |

### 20.2 The interface

**Data.** The fields of §1.1. CORE alone writes the computed fields (concrete geometry of `def` shapes and bound
handles, `cundef`, `cHid`, `_g`, `_atInf`, `uid`, `zpIds`). INTERFACE creates and edits only through `cm`; it reads
any field.

**`Constr`** (pure; a global in the page, `module.exports` in node). Points are `[x, y]`; ∞ is `Constr.INF`.

```js
// geometry
Constr.orient(p, q, r)                 // -1 | 0 | 1, exact
Constr.formOf(shape)                   // G = { o, A, B, C } | null   (Region.formOf is this)
Constr.level(G, z)                     // [f, fx, fy], float64 relative to o
Constr.reanchor(G, z0)                 // G' anchored at the point of the curve nearest z0
Constr.mob3(p, q, r)                   // { map(t), inv(z) }: 0, 1, ∞ -> p, q, r
// curves and points
Constr.pieces(shape)                   // [{ part, kind: 'line'|'circle'|'traced', G?, a?, b?, closed, period }]
Constr.meets(pa, pb)                   // [{ z | INF, index: 0 | 1 | 'finite' }]
Constr.meetNear(pa, pb, z, box)        // { z, index, seed? } | null: the crossing nearest z, for snapping [C28]
Constr.project(piece, z)               // { t | seed, z }
Constr.glide(piece, t)                 // z | INF (t wraps on closed pieces)
// refs and the graph
Constr.resolve(state, ref, plane, F)   // { z } | { inf: true } | { undef: { code, args } }  (F: the chain, for img refs)
Constr.graph(state)                    // cached; rebuilt on a structural change
  .users(id) .sources(id) .roots(id)   // transitive dependents, direct refs, free roots
  .excluded(id, key?)                  // Set: not a target for this gesture (self, dependents, co-arguments) [C11]
Constr.recompute(state, changed, F)    // { ids, kindChanged, undefChanged }; changed = { shapes, zp, params, chain, all }
Constr.validate(state)                 // { freed: n }: refs, argument types, cycles, fallbacks [C29]
Constr.deletePlan(state, ids)          // { del, freed: [{ id, key }], undef }                       [C17]
Constr.zeroRemovePlan(state, zref)     // { undef, freed }                                            [C12]
Constr.moveRoots(state, id)            // [free point ids] | null                                     [C18]
Constr.describe(state, id)             // { op, args: [ref], fill, flip, index, family, t }: no text
```

**`cm`** (CORE, in app.js; handed to `Construct.init(api)` as `api.cm`). Each call that changes S records undo the
way v15's gestures do: one step per call outside a gesture, one per gesture inside one.

```js
cm.create(shapes, { target, select })  // one undo step; may include helpers; returns the new ids
cm.bind(id, key, ref, { live }) ; cm.unbind(id, key)
cm.setDef(id, patch)                   // fill, flip, index (Other point), t, seed; a def on a free point
                                       // ("Put on this curve")
cm.makeFree(id)
cm.moved(changed, { live })            // after a gesture moved a source (shapes, zp, params)
cm.end()                               // gesture end: undo step, Y fit, meshes at rest
cm.remove(ids)                         // applies deletePlan; one undo step; emits 'deleted'
cm.state(id)                           // { undef: { code, args } | null, atInf, helper, owner }
```

**Events** (CORE → INTERFACE, `Construct.on(type, data)`, a no-op in the stub): `'recomputed'` {ids, kindChanged,
undefChanged}; `'deleted'` {del, freed, undef}; `'zpRemoved'` {zref, undef, freed}; `'loadFreed'` {n}. INTERFACE
turns them into rows, toasts and tour events.

**Test hooks** (test.html only; build.py strips `__cmw*`): `__cmwC()` (CORE: graph order, forms, last recompute,
`cm` calls) and `__cmwCI()` (INTERFACE: the current targets and the draft).

### 20.3 Order

1. **CORE step 0, the interface freeze** (first, short): constr.js with the whole API above working for points,
   handles, zeros, circle3, line pairs, midpoint and bisector (the PoC already does most), the `cm` block, the
   fields, a stub `construct.js` (`init`, `on`), and the build.py lines. The existing gate passes unchanged.
2. **Then both parts in parallel**, each in its own copy of work/xvc after step 0. Their hunks are disjoint by the
   ownership tables above, so the merge is mechanical; a change to §20.2 needs both parts to agree and goes into
   this file first.
3. **CORE** then does the gcircle form on CPU and GPU, re-anchoring, M(ℝ) sampling, gliders with wrap, `meetNear`,
   image refs, the plans, sanitize and fallbacks, the live-path perf, and its tests.
4. **INTERFACE** builds on the step-0 API: snapping and binding, tools, menus, rows, Inspector, labels, globes,
   export, phone, Russian, the tour, and constr_cmd.js.
5. **Merge**: CORE first, then INTERFACE; then the full gate, constr_cmd and constr_core_cmd together.

### 20.4 Done when

- **CORE:** t_constr.js and the glsl_test rows pass; constr_core_cmd passes (1 and 10 dependents within BUDGET60,
  50 reported); the full existing gate is unchanged; the published page has no `__cmw` hooks.
- **INTERFACE:** constr_cmd passes in EN and RU, light and dark, phone to desktop; `python3 tools/make_ru_table.py
  --strict` reports 0 unresolved; nothing opens over the work area uninvited; the full existing gate is unchanged.

## 21. The critique, point by point

All 29 points were checked against v15.1. Verified in the code for this revision: 1 (zpHit runs for every tool
unless `onSel`), 2 (applyBinds clears `undef` for shapes without `bind`), 4 (packShapes skips TKIND > 10), 15 (the
1e−3 clamp in setHandle), 16 (`snap: true` by default), 20 (fillTiles closes the sheet), 29 (steps rebuilt as {type,
params, on}). 3 rests on the critique's measurements.

| # | Sev | Decision | Reason | Where | Owner |
|---|---|---|---|---|---|
| 1 | B | Accept, partly | Picks need zeros. Shift-add stays in every tool (Shift is never a pick, and v15's zero tests keep working); the Point tool keeps the zero drag | §1.2, §4.1 | I |
| 2 | B | Accept | Own fields `cundef`/`cHid`; each owner shows the shape only if the other does not hide it. The "early return" option is rejected: a glider with `bind.t` needs both | §3 | C |
| 3 | B | Accept (a), (c); (b) partly | (b) only skips meshes that are not on screen; rebuilding "a few per frame" would show stale shapes in motion, against quality first | §3 | C |
| 4 | B | Accept | Two kinds, gdisc 8 and gcurve 20 | §2.2 | C |
| 5 | H | Accept | Per-view float64 re-anchoring is exact algebra and costs one repack per view | §2.2 | C |
| 6 | H | Accept | `index: 'finite'` for line pairs | §2.4 | C |
| 7 | H | Accept | M(ℝ) on the line sampler replaces clipping; one path for lines, huge circles and A → 0 | §2.2 | C |
| 8 | H | Accept, partly | `formOf` for every reader, including capOf (in region.js, so sphere.js is unchanged). Rejected: caching a half-plane in the concrete fields, since the kind would contradict sign(A) and the row; with every reader on `formOf`, the cache reaches only older builds | §2.2 | C |
| 9 | M | Accept | thru0 from incidence | §2.2 | C |
| 10 | M | Accept | A from the exact expansion | §2.2 | C |
| 11 | H | Accept | (a) `excluded` in the graph, the chip in the UI; (b) the gesture-only ghost, never in export | §3, §4.1 | C + I |
| 12 | H | Accept | `zpIds`, nearest-value matching; removing a zero makes dependents undefined (replaces the old zero cascade) | §1.2, §9 | C + I |
| 13 | M | Accept | f₁ zero refs recomputed when a step changes with a number | §3 | C |
| 14 | M | Accept | Wrapped t on closed curves; no t on formula curves | §2.5 | C |
| 15 | L | Accept | The graph writes r directly | §1.1 | C |
| 16 | H | Accept | (a), (b) as proposed; (c) helpers only for points a snap creates on its own; points made on purpose keep labels | §4 | I (+ C plans) |
| 17 | H | Accept | Cascade through `def` only; `at` is released | §9 | C + I |
| 18 | H | Accept, partly | (a) as proposed; (b) when all transitive roots are free points (translation commutes with every op). A source that is another shape's handle pans instead of deforming that shape | §4.3 | I (+ C `moveRoots`) |
| 19 | M | Accept, partly | The press binds the start; the touch ring 48 px up. Rejected: a short press as a Backspace-able pick for drawing tools, which changes v15's press–drag–release, was not asked for and risks the gate | §4.1, §4.2 | I |
| 20 | M | Accept | v15 already closes the sheet for drawing tiles, so §5.5's premise was wrong; syncTools must watch the new grid | §5.5 | I |
| 21 | M | Accept | Selection highlight on touch | §10 | I |
| 22 | M | Accept, partly | Grid-only drags and "Put on this curve". Rejected: "Put on this point", which would be merging (§13); the Point tool selects the existing point | §4.3, §11 | I |
| 23 | M | Accept | One-way `{img}` refs: the user asked for points on the page, and Y's points are on it. The chip covers views that do not show the whole image | §1.2, §4.1 | C + I |
| 24 | L | Accept | Tooltip, tour, test | §12 | I |
| 25 | L | Accept | "left of z₀ → z₁" | §10, §15 | I |
| 26 | M | Accept | All four, and the other new strings are neutral too | §15 | I |
| 27 | M | Accept | Hooks named by function, one line, guarded | header, §17 | C + I |
| 28 | M | Accept | Local crossings per move; the 40-curve cap is dropped | §4.1 | C (`meetNear`) + I |
| 29 | L | Accept | `step: 0` fallback, and `zpIds` by index | §1.2 | C |

# Exact images through infinity: per-pixel inverse rendering, with a Riemann-sphere forward fallback

Implementation spec (lead architect), **revision 2**. Inputs: `inverse-first.md`, `sphere-native.md`,
`incremental.md` (same folder), their prototypes under `notes/proto/`, the lead's prototypes in
`notes/proto/lead-inv/` (revision 1) and `notes/proto/lead-rev/` (revision 2), and two adversarial reviews (math and
engineering). Revision 1 is kept as `SPEC.rev1.md`. Section 15 logs every review finding with its verdict. Nothing in
`src/` has been edited. Every number quoted as "measured" comes from a prototype that was actually run; everything
else is labelled an estimate.

**The user's question, answered.** "If we already have a tool to generate preimages, why can't we color the domain
using the inverse function?" We can, and this spec makes it the primary renderer (D1). Two refinements to the idea:
the engine is not the hover tool's Newton search (too slow per pixel, and it cannot promise every preimage) but a
closed-form, every-branch enumerator compiled to GLSL; and "every preimage" is a finite, shape-dependent set per pixel
except for infinitely-sheeted maps, where a bounded window of sheets, an exact stop and a tail closure stand in for
infinitely many. Maps without a closed-form inverse fall back to the forward mesh (D3).

Reading guide. Section 0 holds the decisions. Sections 2–7 cover the primary renderer (inverse), section 8 the
fallback (forward sphere mesh), section 9 the lines, section 10 the app wiring, section 11 the phases, section 12 the
tests, section 13 the verification record, and section 15 the review log. Parallel owners are listed in 11.0. The
interfaces between files are the contracts in 3.1, 3.2, 3.6, 4.1, 4.5, 8.2 and 9.2.

---

## 0. Decisions

**D1. The primary renderer of mapped areas works per pixel, backwards.** For each pixel w of a view that shows a
mapped area (Image mode on the right plane, the Sphere view of images, and the left plane or left globe when
`leftStage() > 0`), the GPU lists the preimages z of w through the chain that can lie in the shape. It walks the steps
backwards and, at each step, enumerates the branches of its closed-form inverse. Each branch carries a signed "range
level" that encodes the forward step's own branch (cut and sheet). The region is then tested at each candidate, the
covering candidates are composited in sheet order, and the pass stops once the result can no longer change by 1/255.

The renderer never needs a value at infinity or at an essential singularity, because a pixel never asks for one. The
z^i hole is empty because no candidate there passes the branch test. Rims are exact because coverage is analytic.

**Member ranges come from the shape, never from the view (rev 2).** For each family of infinitely or many-valued
branches the CPU derives, per shape, which members can possibly cover (3.6): a per-pixel clip of the member line
against the shape when the family's input is an affine image of z, a conservative float64 range box of the prefix
image otherwise. A bounded shape scans every member that can cover it. Only an unbounded range uses a window of at
most 17 members, centred where the left view's sheet is and clamped into the range, with an exact early stop and a
tail closure for infinite multiplicity.

This is the user's suggestion ("apply the inverse function and get the results"). The hover tool's Newton search is
**not** the engine. The engine is the closed-form enumerator table of section 3, which the hover tool may later reuse
(phase P6).

**D2. Every eligible area shape uses the inverse path, unless the cost guard demotes it.** Eligibility has two levels:

- **Map spec** (`planChain`, 3.4): map mode 0 after normalisation (paused homotopies normalise, 10.5), every live
  step in (a, b] has an enumerator (3.3), and the inverse program has compiled.
- **Shape** (`prepare`, 3.6): its member ranges fit the leaf budget (product ≤ 64; only the innermost window family may
  be unbounded); a polygon has at most 64 vertices; a formula shape is in one of the scene's 4 formula slots (4.4) and,
  under a window family, has a recognised range (3.8). Shape eligibility depends on the shape and the map, never on the
  view.

Reasons for D2 (unchanged from rev 1): one look and one sheet order within and across shapes; no view-dependent
"hard shape" classifier that would switch paths on zoom; eligible shapes need no fix-ups, no map cache and no CPU
refinement, and figure export is exact at any resolution. The golden emulation (13.4) predicts golden_diff ≤ 0.011 %
for the bounded controls.

**What rev 1 got wrong about cost (engineering review, accepted).** Today's map cache means pans, zooms and orbits
re-evaluate nothing; the inverse path runs one full-pane pass per shape on every frame, in both panes when
`leftStage() > 0`. Rev 1's GPU numbers (4.7) came from hand-specialised shaders on an M4 at dpr 1 and are only a lower
bound. Rev 2 therefore:
- makes the first P2 deliverable a benchmark of the **generated** program at dpr 1 and 2, including compile and first
  draw (4.7);
- builds the **cost guard** in P2, not P6 (D8);
- removes avoidable cost: shading only on buffer admission, a compile-time buffer size, scissoring, pruning by
  per-shape ranges (which also makes bounded shapes cheap: 3–5 leaves per pixel for a disc under exp, measured).

**D3. Forward fallback: sphere-native as the backbone.** Shapes that are not inverse-eligible use the forward path.

- Map-level reasons: d/dz in range, custom formulas in which z occurs more than once, polynomials of degree 3 or more
  that are not a monomial plus a constant, rationals of degree 3 or more, IPOW with |n| > 16, more than 16 ops, a
  compile gap or failure, the user switch "exact images" off.
- Shape-level reasons (rev 2): ranges that do not fit (3.4), an unbounded range in a family other than the innermost,
  an unbounded shape through a non-affine prefix without far cover (3.6), more than 64 polygon vertices, a fifth
  formula shape, an unrecognised unbounded formula under a window family, member indices beyond 2²⁰ (precision).
- Frames of a **playing** homotopy (morph, transitions) keep today's GPU path, as do all shapes during the first frames
  of a pending compile.

Forward draws:
- Bounded shapes whose CPU scan finds no trouble keep **today's GPU path and `computeFix` bit for bit**. The trouble
  test is view-independent (8.1).
- Unbounded or stretched shapes, and troubled bounded shapes, are drawn from a **SphereMesh**: the Riemann-sphere NVB
  mesher of `sphere-native.md`, refined on the CPU in the image metric with saturation and the quiet rule, and drawn as
  CPU pre-mapped triangles (section 8).

The incremental design was not chosen as the backbone. Its core/layer seam needs `invariant gl_Position` agreement
across programs (a risk on ANGLE), claims and frozen edges. It is also slower: e^{1/z} takes 4 s against 0.5–0.8 s.

**D4. Strokes stay on the line renderer.** Golden strokes are therefore untouched. Phase P4 gives long curves geometric
reach toward infinity and refinement around the chain's singular points, **on settle only** and with hard caps (9.1).
A CPU image-metric curve sampler is a later option (P6).

**D5. One sheet order everywhere.** Front to back by the key D(z) (section 5). Ties go to the larger Im z, then the
larger Re z, which is today's mesh draw order. Duplicate leaves of one source point (the two sides of an intermediate
cut that a later step heals) are merged into one entry (4.2, rev 2).

**D6. A spherical checker pattern (id 8, "Sphere checker").** 16 longitude sectors × 8 latitude bands of the app's own
Riemann sphere, scaled by the pattern-size control; 128 cells cover C ∪ {∞} (6.3).

**D7. No value at infinity is ever assumed.**
- The inverse path does not evaluate F at all.
- The fallback classifies vertices as FIN, INF or UNDEF by stage-wise limits (8.4), and uses a value at ∞ only where
  a limit exists (Möbius maps).

**D8. The cost guard (rev 2, phase P2; retargeted to the user's rule "60 fps is enough", 2026-10-20).** Per pane,
the GPU time of the pane's frame is measured (`EXT_disjoint_timer_query_webgl2`, else the frame's lag) against a fixed
60 Hz budget, whatever the display's refresh: 8 ms per pane (half each when both panes draw inverse passes in the same
frame), derived in 10.12 from the perf suite's 60 fps ceiling. Exact images at full resolution are preferred: when 3
consecutive motion-frame readings exceed the budget, motion frames of the pane's inverse passes render at half
resolution; only when that is still over budget are the pane's bounded clean shapes demoted to the forward path (the
last resort). A level is left by a probe of the finer level (hysteresis). Settled frames, thumbnails and exports are
always full resolution and exact. Details in 10.12; measurements in 13.13. (P2 gate round 1, 13.14: an Apple GPU sets
its clock by its load, so the readings show the clock rather than the work, and a measured trip came ~14 frames into
the first gesture. The level a pane's passes need is therefore also **predicted** from their structure
(`GLR.inverseEstimate`): a floor under the measured level, half resolution from the first contiguous motion frame for
the heavy passes (exp(H), z^i(H) at α ≤ 0.5 and dpr 2 on the M4), never for α 0.85 or dpr 1. Half-resolution passes are
drawn before the pane's main render pass, which they used to split.)

---

## 1. Judgement of the three designs

| criterion | inverse-first | sphere-native | incremental |
|---|---|---|---|
| z^i(H): hole, rims, pattern | exact per pixel; hole 0; polar parity 1.0 (f32 emulation) | hole 0/164; parity 0/95,968 wrong; chord ≤ 0.23 px | hole 0; parity 1.000; chord ≤ 0.25 px |
| log(H) to the view edges | exact at any zoom | IoU 1.0 at 1×, 4×, 16× | IoU 1.0 |
| exp(H), e^{1/z} (infinitely many sheets) | exact; saturation in the shader | global saturation: 0.2–0.8 s CPU | 0.6–4.7 s CPU, budget-capped |
| every other acceptance case | IoU 1.0 (two tie lines at 16×) | IoU 1.0 | IoU 1.0 |
| watertightness | not applicable (no mesh) | by construction (NVB) | by bookkeeping (dirty re-emission, frozen edges) |
| image quality | analytic anti-aliasing; exact patterns | ≤ 0.3 px chords; triangle-jagged sheet seams | ≤ 0.25 px chords |
| performance risk | GPU per pixel every frame (lower bound ~1 ms, 4.7); no CPU | CPU settle 25–800 ms (projected 3–5× less) | CPU settle up to 4.7 s |
| implementation risk and size | enumerator table plus GLSL generator; cut and sheet semantics must match (round-trip tested) | ~900-line mesher plus pre-mapped draw; incremental pans are complex | largest: core/layer interface, claims, invariance |
| fit with existing code | reuses `drawPreimage`'s shape records, `GLChain` cells and pattern code | replaces the fix-ups for unbounded shapes | keeps the core but adds a second geometry system |
| what it cannot do | non-invertible chains, playing homotopy frames | — (any F) | — (any F) |

**Verdict.** inverse-first is the primary renderer (D1, D2), sphere-native is the fallback (D3), and incremental
contributes test ideas: the T-junction checker and the two-colour crack test (12.4). The review showed that
inverse-first's view-centred windows (inherited in rev 1) lose images of shapes away from the left view; rev 2
replaces them with shape-derived ranges (3.6).

---

## 2. Architecture

### 2.1 Paths

| draw | path |
|---|---|
| right plane, Image mode, still map (mode 0 or a normalised paused homotopy), eligible shape | **inverse** (`GLR.drawInverse`, flat) |
| Sphere view, image mode, still map, eligible shape | **inverse** (`drawInverse`, globe geometry) |
| left plane at `leftStage() > 0`, eligible shape | **inverse** (role L, flat, stages (0, leftStage]) |
| left globe (`S.leftSphere`) at `leftStage() > 0`, eligible shape | **inverse** (role L, globe) |
| thumbnails (`renderThumb`), figure export (`renderOff`) | as the view they draw; side mode (gallery) uses inverse only when its program is already ready (10.7) |
| left plane / left globe at stage 0, identity maps (`GLR.isIdent`) | today's `region0` draw: unchanged |
| ineligible shape, unbounded/stretched or troubled | **SphereMesh** (pre-mapped), with today's GPU draw until it is ready (8.8) |
| ineligible shape, bounded and clean | today's GPU path plus `computeFix`: unchanged |
| a bounded clean eligible shape demoted by the cost guard (last resort, after half resolution) | today's GPU path plus `computeFix` (D8) |
| playing homotopy frames (morph playing, transitions) | today's GPU path, no CPU work: unchanged |
| drags of a shape | **follow `pathOf`** like any frame (rev 2; no special rule) |
| inverse program pending (compiling) | today's GPU draw as a stand-in, `framePending` set; no `computeFix` and no SphereMesh for it |
| inverse program failed to compile | forward, with fix-ups or SphereMesh as for an ineligible shape; console only |
| Phase, Landscape, phase sphere, Preimage targets | unchanged |
| strokes (boundaries, curves) | line renderer (today's), with P4's settle-time reach extension |

Phase flags (11.0) gate the rows: P2 enables only `role R, flat`; P3 adds `globe` and `role L` (flat and globe).
Until a row is enabled, `pathOf` answers `'forward'` for it and its fix-ups run as today.

### 2.2 Path selection (app.js)

```js
// role: 'R' | 'L' | null (thumbnail); viewKind: 'flat' | 'globe'; map: GPU map spec; s: area shape
pathOf(s, map, role, viewKind) =
  m = normalizeMap(map)                                   // paused homotopy at t = 0 or 1 -> mode 0 (10.5)
  !GLR.ok || isIdent(m)                       -> 'forward'          // identity draws stay as today
  !S.exactImages || !PHASE[role][viewKind]    -> 'forward'          // hidden switch; phase flags
  (m.mode || 0) !== 0                         -> 'forward'          // playing homotopy frames, transitions
  !(plan = invPlan(m.a, m.b)).ok              -> 'forward'          // Inverse.planChain, cached per rebuild()
  s._err                                      -> 'forward'          // an invalid shape draws nothing, as today
  !(el = shapeElig(s, plan)).ok               -> 'forward'          // 3.4/3.6 shape level; reason kept for __cmwPaths
  guard.demoted(s, role, viewKind)            -> 'forward'          // D8
  !GLR.inverseReady(keyOf(plan, s, viewKind)) -> 'pending'          // 'forward' stand-in; starts the compile (4.4)
  otherwise                                   -> 'inverse'
```

- `invPlan(a, b)` is computed once per `rebuild()` and range.
- `shapeElig(s, plan)` is `Inverse.prepare(...).ok` with the shape-level checks; it is cached by
  (`plan.key`, parameter values of the steps in (a, b], `shapeKey(s)`). It does not depend on `clipWin`.
- `keyOf` is the inverse program key (4.4): inverse structure, formula bundle, buffer variant, flat/globe.
- `'pending'` draws forward, sets `framePending`, and requests a render on `GLR.onReady`.

### 2.3 Mixed scenes and compositing order

- **Within a pane (flat and globe).** `drawScene` and `sphereView` draw fills in shape-list order, as today: each
  shape completes all its sheets before the next shape starts. On the inverse path each shape is one pass, scissored
  when possible (4.8). It writes premultiplied colour, blended `ONE, ONE_MINUS_SRC_ALPHA` over what is already there.
  A forward shape draws its mesh at its list position, so list order is exact across paths. **On the globe**, inverse
  and forward draws are interleaved in list order too (rev 2: no separate inverse list).
- **Within a shape**, the inverse path composites front to back in D order with saturation (4.2). The forward fallback
  draws far to near by D (8.6). Strokes are drawn after all fills, as today.
- **Same look.** A shape on either path uses the same pattern formulas (6.1), colours and α. Its sheets follow the same
  D and tie rule (forward: per triangle; inverse: per pixel). Its boundary stroke comes from the same line renderer.

  The inverse path also has analytic edge AA, which shows only within 0.5 px of rims; those pixels lie under the
  3.5 px stroke casing. The paths differ visibly only where the forward path is wrong today.

### 2.4 When paths switch

A shape changes path only when one of these changes:
- chain structure (a compile follows);
- map-level eligibility, because of a parameter: a degenerate Möbius map, `pown` 0, a polynomial degree;
- shape-level eligibility, because the shape or a parameter changed (3.4): for example a disc dragged so large that its
  ranges no longer fit;
- map mode: morph play or pause (paused frames normalise), transitions;
- program state;
- the cost guard (D8), which only demotes bounded clean shapes, and only after half resolution in motion did not bring
  the pane inside the 60 fps budget;
- the `exactImages` switch.

**Never on pans, zooms or orbits**, with the single exception of the cost guard's demotion, whose two renders agree to
≤ 0.011 % golden_diff.

- A switch to the inverse path replaces the forward image in one frame. Where the forward image was right, the change
  is invisible (golden emulation, D2).
- A switch to the forward fallback shows today's GPU image until the SphereMesh job publishes, which is today's
  fix-up behaviour.
- Program compiles run in the background (`KHR_parallel_shader_compile`); a frame never waits for a compile, except
  `renderOff`, which waits only for the programs it needs (10.6).

### 2.5 Unchanged

The left plane at stage 0, Phase, Landscape, the phase sphere, Preimage targets (`drawPreimage`), the line renderer's
shaders, the map cache (still used by forward draws), `Region.buildMesh` (still meshes the left plane and the forward
paths), the morph and transition renderers, and saved state (one new optional boolean, `exactImages`).

---

## 3. `src/inverse.js`: the CPU enumerator (pure JS, node-testable)

New file, loaded after `funcs.js` and before `calc.js`/`glsl.js` (`build.py` order: cx, parse, funcs, **inverse**,
calc, glsl, region, **sphere**, gl, view, app). It references `Region` only inside functions (runtime), never at load.
Prototypes: `notes/proto/lead-inv/inverse_proto.js` (the op table, 3.2–3.3) and `notes/proto/lead-rev/walk.js`
(ranges, budgets, cursors, early stop and the Möbius centre of 3.4–3.6). Production code ports both.

### 3.1 API

```js
Inverse.stepOps(b)                     // b: a Funcs.build() result -> {ok: true, ops: Op[]} | {ok: false, reason}
Inverse.planChain(steps, built, a, b)  // -> Plan (3.4); off/error steps are the identity (as GLChain)
Inverse.inverseKey(steps, built)       // -> string: structure of every live step incl. per-step eligibility (4.4)
Inverse.prepare(plan, {win, shape, sing, mesh}) // -> Prep (3.6): shape ranges, budgets, refs, stop data; ok/reason
Inverse.enumerate(plan, prep, w, pix, opts) // -> {leaves, visited, truncated, tailInf}: CPU twin of the GPU walk
Inverse.sheetKey(prep, z)              // -> D (section 5)
Inverse.front(a, b)                    // -> true when candidate a is in front of b (D, then tie: 5.2)
Inverse.singular(plan, win, kinds, cap) // -> [{z, kind: 'undef'|'branch'|'pole'}] pulled back, <= cap per kind (3.7)
Inverse.imageBox(G, shape, coord, unit, opts) // -> {lo, hi, farCover} (3.8): conservative range of coord(G(z)) over the shape
Inverse.renderCPU(plan, shapes, view, look, preps) // -> {rgba, stats}: the reference renderer (3.9, tests only)
Inverse.LEAF_CAP = 64; Inverse.WIN_MAX = 17; Inverse.MIN_WIN = 9; Inverse.IPOW_MAX = 16; Inverse.OPS_MAX = 16;
Inverse.POLY_MAX = 64; Inverse.M_MAX = 2 ** 20; Inverse.RAMP = 1;
```

Types (C = `{re, im}`):

```
Op     = {kind, step: k, node: i, p: {...params}, fwd(u) -> C, pre(w, ref) -> Member[] (single-valued and finite ops),
          fam: null | {type: 'fin', count} | {type: 'add', p: C (period), bases(w) -> C[] (member 0 of each base)}
                    | {type: 'log', S: C (L_m = L_0 + m S), lo, hi, inf: bool, radial: bool},
          member(w, b, m) -> Member (window families), undef: (C|null)[], poles: C[]}
Member = {u: C, d: C (du/dw) | anti: true, lvl: number (output units, +Infinity = no range constraint),
          lg: C (unit gradient of lvl in the output plane), lam: C|null (log u), base: int, m: int}
Plan   = {ok, reason, ops: Op[] (forward order), key: string (inverse structure), a, b,
          fams: int[] (indices of multivalued ops), injective: bool}
RangeSpec = {kind: 'clip', A: C, B: C}                       // the op's input is u = A z + B (AFF prefix)
          | {kind: 'box', lo, hi, farCover: bool, e: C|null} // conservative range of the family coordinate (3.8)
          | {kind: 'branch'}                                 // ROOTPOW finite: the branch range only
          | null                                             // finite families: every member
Prep   = {ok, reason, refs: C[] (per op input), rspec: RangeSpec[], need: number[] (worst-case members per op),
          N: int[] (per-op scan budget), inner: int (innermost window family or -1), stopOp: int,
          stopMob: {T: Mobius (z = T(u)), uPole: C, pAcc: C, pInP: bool} | null,
          win: {x0,y0,x1,y1}, R, rs, sing: C[] (<= 4), convex: bool}
Leaf   = {z: C, J: [a, b, c, d] (dz/dw, real 2x2 row-major), lvl (px), lg: [x, y] | null (unit, image space),
          lam: C|null, path}
```

### 3.2 The op table (CPU and GLSL share these semantics exactly)

Notation:
- An op maps u → w. Log is principal (Arg in (−π, π], atan2 semantics).
- For a branch (θ, k): lo = θ − 2π + 2πk and hi = θ + 2πk, so Im log_{θ,k} u ∈ (lo, hi].
- "Centre" is the member index m* around which a window is scanned when the range is too long to scan whole (3.6).
  ref is the op's input-plane reference point.
- Additive families have u_m = base_b + m·p. Logarithmic families (ROOTPOW) have L_m = L_0 + m·S, u_m = e^{L_m},
  with L_0 = β Log w and S = 2πiβ.

| kind | forward f(u) (the app's own code) | params | members of pre(w) | du/dw | range level lvl, gradient lg | Λ | family | undef / poles |
|---|---|---|---|---|---|---|---|---|
| AFF | a u + b | a ≠ 0, b | (w − b)/a | 1/a | – | – | one | – / – |
| MOB | `CX.mobApply([a,b,c,d], u)` | invertible (props.mobius) | (d w − b)/(−c w + a); none at w = a/c | (ad − bc)/(−cw + a)² | – | – | one | – / −d/c |
| IPOW | `CX.ipow(u, n)` | n ≠ 0, \|n\| ≤ 16 | q = w (n > 0) or 1/w (n < 0); u_j = \|q\|^{1/\|n\|} e^{i(Arg q + 2πj)/\|n\|}, j = 0..\|n\|−1; w = 0, n > 0: u = 0 | u/(n w) | – | – | fin: \|n\| | – / 0 if n < 0 |
| ROOTPOW | `CX.pow(u, s, θ, k)` (root: `powReal(u, 1/n, θ, k)`) | s ≠ 0; β = 1/s; lo, hi; \|s\|; mode | L_m = β(Log w + 2πi m), u_m = e^{L_m}. mode **int** (β real integer): one member, m = round(((lo+hi)/2 − Im βLog w)/(2πβ)). mode **finite** (Re β ≠ 0): the branch range m ∈ [⌈min(x_a, x_b)⌉ − 1, ⌊max(x_a, x_b)⌋ + 1], x = (lo or hi − Im βLog w)/(2π Re β); at most ⌈1/\|Re β\|⌉ + 3 members. mode **inf** (Re β = 0): unbounded | β u / w | min(Im L − lo, hi − Im L)·\|s\|·\|w\|; lg = ±(i·conj(β/w))/\|·\| (+ when Im L − lo is the smaller) | L_m | log; centre: m* = round(Re((λ_ref − L_0)·conj S)/\|S\|²), λ_ref = ln\|ref\| + i·(Arg ref shifted into (lo, hi]) — never a division by Im β (rev 2) | 0 and ∞ when mode inf or s non-real / 0 if Re s < 0 |
| EXP | `CX.exp` | – | Log w + 2πi m; none at w = 0 | 1/w | – | – | add, p = 2πi; m* = round((Im ref − Arg w)/2π) | ∞ / – |
| EXPC | e^{u L0} (custom c^g, L0 = principal Log c) | L0 | (Log w + 2πi m)/L0 | 1/(L0 w) | – | – | add, p = 2πi/L0 | ∞ / – |
| LOG | `CX.log(u, θ, k)` | θ, k | e^w | e^w | min(Im w − lo, hi − Im w); lg = ±i | w | one | – (branch 0, ∞) / 0 |
| SIN | `CX.sin` | – | bases asin w, π − asin w; p = 2π | 1/cos u | – | – | add, 2 bases | ∞ / – |
| COS | `CX.cos` | – | bases acos w, −acos w; p = 2π | −1/sin u | – | – | add, 2 bases | ∞ / – |
| TAN | `CX.tan` | – | base atan w; p = π; none at w = ±i | 1/(1 + w²) | – | – | add | ∞ / π/2 + πn |
| SINH | `CX.sinh` | – | bases asinh w, iπ − asinh w; p = 2πi | 1/cosh u | – | – | add, 2 bases | ∞ / – |
| COSH | `CX.cosh` | – | bases acosh w, −acosh w; p = 2πi | 1/sinh u | – | – | add, 2 bases | ∞ / – |
| TANH | `CX.tanh` | – | base atanh w; p = iπ; none at w = ±1 | 1/(1 − w²) | – | – | add | ∞ / i(π/2 + πn) |
| ASIN | `CX.asin` | – | sin w | cos w | π/2 − \|Re w\|; lg = (−sgn Re w, 0) | – | one | – |
| ACOS | `CX.acos` | – | cos w | −sin w | min(Re w, π − Re w); lg = (±1, 0) | – | one | – |
| ATAN | `CX.atan` | – | tan w | 1/cos² w | π/2 − \|Re w\| | – | one | – |
| ASINH | `CX.asinh` | – | sinh w | cosh w | π/2 − \|Im w\|; lg = (0, −sgn Im w) | – | one | – |
| ACOSH | `CX.acosh` | – | cosh w | sinh w | min(Re w, π − \|Im w\|) | – | one | – |
| ATANH | `CX.atanh` | – | tanh w | 1/cosh² w | π/2 − \|Im w\| | – | one | – |
| JOUK | (u + 1/u)/2 | – | e = w + √(w−1)√(w+1) (principal roots); bases e, 1/e | 2u²/(u² − 1) | – | – | fin, 2 | – / 0 |
| IJOUK | u ± √(u−1)√(u+1) (the step's f) | σ = +1 exterior, −1 interior | (w + 1/w)/2 | (1 − w⁻²)/2 | σ(\|w\| − 1); lg = σ w/\|w\| | – | one | – |
| CONJ | conj u | – | conj w | **anti** (J ← diag(1, −1)·J) | – | – | one | – |
| QUAD | a u² + b u + c | a ≠ 0 | s = √(b² − 4a(c − w)), negated when Re(conj(b) s) < 0; q = −(b + s)/2; u₁ = q/a, u₂ = (c − w)/q | 1/(2au + b) | – | – | fin, 2 | – |
| RAT2 | p(u)/q(u), degree 2, coprime | p, q padded to degree 2 | A = p₂ − w q₂, B = p₁ − w q₁, C = p₀ − w q₀; \|A\| ≤ 1e−14(\|B\| + \|C\|): u = −C/B; else as QUAD | q²/(p′q − pq′) | – | – | fin, ≤ 2 | – / roots of q |

Members whose range level, converted to pixels (3.5), is below −RAMP = −1 px are not preimages and are dropped. Ramp
members are kept for anti-aliasing only.

ROOTPOW finite mode (rev 2): the whole branch range is scanned. It counts against the leaf budget like a finite
family (⌈1/|Re β|⌉ + 3 members: α = 20 gives 23). When it does not fit and the spread is mostly radial
(|Re β| ≤ |Im β|/8, i.e. α within ~7° of the imaginary axis), it is treated like mode inf: a window clamped into the
branch range. Otherwise the shape goes forward (`'too many branches'`); for real α that happens only for |α| > 61.

### 3.3 Catalog decomposition (`stepOps`)

| step | ops (forward order) | ineligible when |
|---|---|---|
| mul c | AFF(c, 0) | c = 0 (constant) |
| add c | AFF(1, c) | – |
| affine a, b | AFF(a, b) | a = 0 |
| recip | MOB([0, 1, 1, 0]) | – |
| mobius | MOB([a, b, c, d]) | `!props.mobius` (degenerate or nearly degenerate) |
| blaschke a, φ | MOB([e, −e a, −conj a, 1]), e = e^{iφ} | `!props.mobius` |
| pown n | IPOW(n) | n = 0; \|n\| > 16 |
| root n, cut, k | ROOTPOW(1/n, cut·DEG, k mod n), mode int | – |
| powa α, cut, k | ROOTPOW(α, cut·DEG, k) | α = 0 |
| exp / log cut, k | EXP / LOG(cut·DEG, k) | – |
| sin, cos, tan, sinh, cosh, tanh | SIN, COS, TAN, SINH, COSH, TANH | – |
| arcsin … artanh | ASIN, ACOS, ATAN, ASINH, ACOSH, ATANH | – |
| joukowski / ijouk | JOUK / IJOUK(σ) | – |
| conj | CONJ | – |
| poly | degree 1: AFF; degree 2: QUAD; a_n z^n + a_0 (n ≥ 3, middle zero): IPOW(n), AFF(a_n, a_0) | degree 0; other degree ≥ 3 (P6: degree 3–4) |
| rational | constant q: as poly; props.mobius: MOB; props.degExact and degree 2: RAT2 | otherwise |
| custom (cut θ) | node walk below | z occurs ≠ 1 time; Re/Im/abs/arg or x, y, r, θ on the path; a variable base with a variable exponent; a constant zero factor |
| deriv | – | always |

**Custom node walk** (outermost node first; the ops are then reversed into forward order). Constants are evaluated
with `Expr.compile(n)(0)` (principal values, as the app does).

- `neg`: AFF(−1, 0).
- `add`/`sub` with a constant c: AFF(±1, ±c).
- `mul` by c: AFF(c, 0). `div` by c: AFF(1/c, 0).
- c/g: MOB([0, c, 1, 0]).
- g^v with constant v: an integer |v| ≤ 4096 gives IPOW(v) (eligible only if \|v\| ≤ 16); otherwise ROOTPOW(v, θ, 0).
- c^g: EXP if c = e, else EXPC(Log c).
- `root`(n, g): ROOTPOW(1/n, θ, 0). `sqrt`: ROOTPOW(1/2, θ, 0). `log`: LOG(θ, 0). `exp`: EXP.
- sin…tanh: the families. asin…atanh: the range ops.
- cot, sec, csc, coth: MOB([0, 1, 1, 0]) outside TAN, COS, SIN, TANH.
- conj: CONJ.

This is more general than `Expr.invert`: every branch is enumerated and range-tested, so `\log(\log z)` and
`(z+1)^{1.5}` work.

**Rational parts** (z occurs more than once under + − × ÷ and integer powers; `Inverse.rationalForm`). The subtree is
expanded into P/Q twice: in floats with term bounds, and EXACTLY over Q(i) (BigInt Gaussian rationals; a literal is its
decimal, 0.1 = 1/10; e, π and function values are their double's shortest decimal). Common powers of z and the exact
gcd (primitive pseudo-remainder Euclid over Z[i], so a common factor of any multiplicity: (z−1)³/((z−1)²(z+2)) is the
Möbius (z−1)/(z+2) exactly) are divided out exactly. A float stage then removes only a SIMPLE, isolated root that the
two share to rounding (RAT_COMMON, with a remainder check: z² − 1/9 over z − 1/3 written with different constants) and
refuses ('numerator and denominator nearly share a root') a relative |T(r)| between RAT_COMMON and RAT_APART or a
shared root inside a root cluster; so every pair handed to MOB/RAT2 is coprime by a scale-invariant test. The removed
roots are removable singularities (0/0 in the formula): for w = lim R(z) there they ARE roots of P(u) − w Q(u), so they
ride on the subtree's first op as `holes` and `pullFinite` leaves them out (point and singular-point pull-backs match
the natural domain; for areas they are a measure-zero set). Review P5 found the earlier float-only deflation leaving
1e−6 errors at a triple root, so a false common root painted the whole w-plane; test/t_inverse_rational.js has the
multiplicity cases, the holes and render round trips around a removed point.

**Measured** (`t_roundtrip.js`, 13.1): 104 step cases covering every catalog type, random parameters, cuts and sheets,
and 21 custom formulas. 0 unsound candidates, 0 missed preimages, 0 decomposition errors. Ineligible as intended:
`z^3 − z`, degree-3 rational, `z^2 + 1/z`.

### 3.4 Plans (map level) and budgets (shape level)

```
planChain(steps, built, a, b):                                       // map level, once per rebuild() and range
  ops = concat over live steps k in (a, b] of stepOps(built[k-1]).ops   (an ineligible step -> {ok: false, reason})
  ops.length > OPS_MAX (16) -> {ok: false, reason: 'chain too long'}
  key = inverseKey(...)                                              // structure only (4.4); parameters are uniforms
  return {ok: true, ops, key, fams: indices of ops with fam != null, injective: fams.length == 0, a, b}

budgets(prep):                                                       // shape level, inside prepare (3.6)
  need[j] = worst-case members of op j for this shape:
    fin: its count (IPOW |n|, JOUK/QUAD/RAT2 2, ROOTPOW finite ceil(1/|Re beta|) + 3)
    add with rspec clip: ceil(width of supportOf(shape, q/|q|) / |q|) + 3      (q = p/A; Infinity if unbounded)
    log with rspec clip: ceil(ln(r_max/r_min) / |S|) + 3 about the ray apex -B/A (Infinity if the apex is in the closure)
    add/log with rspec box: ceil((hi - lo) / unit) + 3 (Infinity if unbounded)
  inner = the window family nearest z (smallest op index among ops with fam add/log, ROOTPOW finite only when radial)
  Pf = product of need[j] over every multivalued op except inner
  any non-inner op with need = Infinity -> {ok: false, reason: 'unbounded range outside the innermost family'}
  Pf > LEAF_CAP (64)                     -> {ok: false, reason: 'fixed families need Pf leaves'}
  N[j] = need[j] for every non-inner op
  allow = floor(LEAF_CAP / Pf)
  if need[inner] <= allow: N[inner] = need[inner]                    // scanned whole: exact, no window
  else:
    N[inner] = min(allow, WIN_MAX)                                   // D-window (3.6)
    N[inner] < MIN_WIN (9)                -> {ok: false, reason: 'innermost family budget'}
    need[inner] finite and not (rspec clip and convex shape) and not branch
                                          -> {ok: false, reason: 'bounded range too long for a non-convex shape'}
    rspec box, unbounded, !farCover       -> {ok: false, reason: 'unbounded shape through a non-affine prefix'}
  any member index bound beyond M_MAX (2^20) -> {ok: false, reason: 'precision'}
```

Why each rule holds (proved or measured in 13.9):
- **Bounded ranges scanned whole are exact**: every member that can cover is visited.
- **A truncated window is safe for coverage only where the far members cover.** With an affine prefix and a convex
  shape, the clipped member interval is the covering set (±1 padding), so any window inside it covers; for a
  complement or a reflex sector the clip excludes the hole (3.6), and members beyond it cover. With a non-affine
  prefix, an unbounded box is allowed only when a prefix pole lies in the shape's closure (`farCover`): then G(S)
  contains a neighbourhood of ∞, and far members cover (e^{1/z}, e^{1/z²} on discs around 0).
- **Outer families must be bounded**: a window in an outer family can miss every covering member of an unbounded shape
  (exp∘exp of Re z > 5 needs |m| ≥ 24 while the reference sits at m = 0). Such shapes go forward.

The GLSL structure depends only on `key`, so a parameter change recompiles nothing. Budgets, ranges and modes are
uniforms. A change in map-level eligibility switches the path and, through `key`, the program (4.4). A change in
shape-level eligibility switches only that shape's path.

### 3.5 Backward enumeration (CPU twin of the GPU walk)

```
enumerate(plan, prep, w, pix, {K}):          // pix: w-units per image pixel; K: front count for the early stop
  found = []; visited = 0; truncated = false; tailInf = false
  rec(N-1, {u: w, J: I, lvl: +inf, lg: null, lam: null})
  rec(j, L):
    if j < 0: visited++; leaf(L); return
    op = ops[j]
    if op.fam is null or fin: for mem in op.pre(L.u): if (n = apply(L, mem)) rec(j-1, n); return
    for each base b of op at L.u:
      [lo, hi, hole] = range(prep.rspec[j], op, L.u, b)               // 3.6; empty -> next base
      ms = clamp(centre(prep, j, L.u, b), lo, hi), moved out of the hole
      up = ms, dn = ms - 1 (skipping the hole); aliveU = up <= hi; aliveD = dn >= lo
      n = 0; turn = 0
      while n < prep.N[j] and (aliveU or aliveD):                    // two cursors: a dead side costs nothing
        dir = (aliveU and aliveD) ? (turn++ even ? up : down) : (aliveU ? up : down)
        m = cursor(dir); advance cursor(dir) (skip the hole); mark dir dead when it leaves [lo, hi]
        n++
        if (nL = apply(L, op.member(L.u, b, m))): lf = rec(j-1, nL)
        if j == prep.stopOp: stop dir when the rule of 3.6 fires for (m, lf)
        remember whether lf covered (per direction, last 3)
      if aliveU or aliveD: truncated = true;
        if a still-alive direction's last 3 members all covered: tailInf = true
  apply(L, mem):
    sc = sqrt(|det L.J|); lv = mem.lvl == +inf ? +inf : mem.lvl / (sc * pix)
    if lv < -RAMP: return null
    lg = L.lg; if lv < L.lvl and mem.lg: lg = normalize(L.J^T * mem.lg)
    J = mem.anti ? diag(1,-1) * L.J : C(mem.d) * L.J
    return {u: mem.u, J, lvl: min(L.lvl, lv), lg, lam: mem.lam}
```

The GPU uses the same order (4.1). `prototype: notes/proto/lead-rev/walk.js walk()`.

### 3.6 References, member ranges, windows, early stop (`prepare`)

**Reference point.** c_ref is the centre of `clipWin`, the meshing window (the left view that last settled). If any
op input along the forward chain of c_ref is non-finite, c_ref is nudged by (W/4)·e^{0.3i}, with W the window width.
`refs[j]` is the forward value at op j's input. The reference only **centres windows on unbounded ranges** and sets
the sheet key (section 5); it never decides which members exist (rev 2).

**Member ranges** (per op j, per pixel, per base; intersected):

1. **The op's own range.** ROOTPOW finite: the branch range (3.2). Others: unbounded.
2. **The shape range**, by `prep.rspec[j]`:
   - **`clip`** (every op before j is AFF; composite u = A z + B). Additive families: the member line is
     z_m = z₀ + m q with z₀ = (base − B)/A and q = p/A. `shapeClip(shape, z₀, q)` (4.3) returns the parameter
     interval [t_lo, t_hi] where the line is inside the shape's clip primitive, and optionally a hole (t_hlo, t_hhi)
     where it is outside. Members: [⌈t_lo⌉ − 1, ⌊t_hi⌋ + 1], hole members [⌊t_hlo⌋ + 2, ⌈t_hhi⌉ − 2] skipped. ROOTPOW
     inf (members on a ray): z = z_a + t·dz with z_a = −B/A, dz = e^{i Im L₀}/A, t = e^{Re L₀ + m S} (S real), so the
     clipped t interval maps to m through ln t. A hole that reaches ±∞ turns into a one-sided bound.
   - **`box`** (some op before j is not AFF): [lo, hi] of the family coordinate over the prefix image G_j(shape),
     from `Inverse.imageBox` (3.8): additive families use ⟨u, e⟩ with e = p/|p|, so members are
     [⌈(lo − t₀)/|p|⌉ − 1, ⌊(hi − t₀)/|p|⌋ + 1] with t₀ = ⟨base, e⟩; ROOTPOW inf uses ln|u|.
   - **`branch`** and `null`: no shape range.

**Scan.** If hi − lo + 1 ≤ N[j], the whole range is scanned (outward from ms, which only orders it). Otherwise the
range is a D-window of N[j] members: ms = clamp(m*, lo, hi), moved out of the hole, two cursors outward. m* is the
member nearest the reference:
- additive, AFF prefix: m* = round(Re((ref − base)/p));
- ROOTPOW: the log-space projection of 3.2;
- **Möbius in the prefix** (rev 2): the member with the smallest key D among three candidates and their ±1
  neighbours: the u-projection above; the member nearest c_ref in z, which is exact for a Möbius prefix (minimise
  |u_m − u_c|/|u_m − q| over the line, a quadratic in m; q = the u-plane pole of z = T(u)); and the member farthest
  from the accumulation point p_acc = T(∞) (the projection of q onto the member line). The u-projection alone is
  wrong near an accumulation point; nearest-in-z alone is wrong for e^{1/z} near 0 (13.9).

**Early stop.** `stopOp` = `inner` when every op before it is AFF or MOB (ROOTPOW: AFF only), else −1. D_K is the
K-th smallest key among covering leaves so far (+∞ until K exist; K from α, 4.2). When processing member m in direction
dir of the stop op:
- **AFF prefix**: stop dir when D(z_m) > D_K. Exact: along a member line or ray D is unimodal (non-increasing then
  non-decreasing), and a contiguous scan from ms cannot stop on the non-increasing side (every visited key is ≥ D(z_m)
  there, so D_K ≥ D(z_m)).
- **Möbius prefix** (rev 2): members lie on a circle arc converging to p_acc. Once the member moves away from the
  projection of q (so r_m = |z_m − p_acc| decreases from here on: Re((u_m − q)·conj p)·dir ≥ 0), every later member
  lies in the disc of radius r_m about p_acc, so
  `LB = log2(1 + max(0, dist(p_acc, W) − r_m)/R) + [p_acc ∈ P]·max(0, log2(rs/r_m))` is a proven lower bound of their
  keys. Stop dir when LB > D_K. Before that point the direction never stops (the budget bounds it).
- **From the next member** (P2 gate round 1, 13.14; CPU `affStopLB`, GPU `ixStopAdd` / `ixStopLog`). With an AFF prefix
  the bound is taken over the members still to come, which start at the next one: the ray from z_m + dir·q (additive),
  from z_a + (z_m − z_a)·e^{dir Re S} outward or the segment from it to z_a inward (ROOTPOW). A side then stops without
  walking one member past the front: exp(H) and z^i(H) walk K + 1 leaves instead of K + 2.
- **The tail rule** (P2 gate round 1, 13.14; `prep.tail`, gl.js `ixDKTail`). With K > B for the shape's own alpha
  (4.2) the early stop is off and every covering candidate the buffer does not keep enters only through ixTr; a side
  still running at the end of its budget whose last three members covered sets the tail closure, which discards ixTr.
  So when the shape's coverage provably never decreases along the stop op's member lines (`prep.tail`: an intersection
  of half-planes, i.e. a half-plane, a sector with r = 0 or their complements with an exact clip, behind an additive
  family with AFF ops only and every other op AFF or MOB; or behind an infinitely-sheeted ROOTPOW at op 0 when every
  boundary line passes through 0, where the coverage is the same for every member), a side that is in range up to
  infinity without a hole, whose last three members covered, stops as soon as the buffer is full, U = 1 and the bound
  above exceeds the buffer's last key: the full walk would admit none of the rest and would close the tail anyway. The
  composite is the same (≤ 1/255 rounding); exp(H) and z^i(H) at α ≤ 0.5 walk B + 1 leaves instead of the window.

**Measured** (`notes/proto/lead-rev/`, section 13.9):
- the reviewer's cases (exp of a disc at 60i, tan at 30, e^{10z} at 6.5i, exp∘exp at 3+0.9i, e^{z²} at 3+3i and
  3.3+4.1i, sin∘exp, tan∘exp, e^{1/z²}) and exp(H) with the left view centred at Im z ∈ {1, −3, −6, −20, −200}: **0
  missed** samples (rev 1: up to 100 %);
- completeness fuzz, reference fixed at the default clipWin centre: 14 chains × 40 random shapes anywhere in ±100 ×
  4 left-view zooms: **0 missed** among eligible shapes;
- early stop over 40 random left views: e^{1/z} **0** front-K mismatches (rev 1 rule: 1.23 %); exp(H), z^i(H),
  tan(2z+1) 0; exp∘Cayley 0 outside truncated windows and ≤ 0.0004 octave front-key gap inside them (rev 1: 7.4 %);
- leaves per pixel (K = 1 / 3): exp(H) 3.0 / 5.0; z^i(H) 3.2 / 5.2; e^{1/z} 5.1 / 7.4; tan(2z+1) on a disc 3.4 / 5.0;
  exp of a disc 3.0; exp∘exp of a disc of radius 1 at 3: 27 (budgets 4 × 13).

### 3.7 Singular points (`singular`) and the accumulation set P

- **Per op**, `undef` lists the input points around which sheets accumulate: ROOTPOW in mode inf or with non-real s
  (0 and ∞), and every window family (∞). LOG and ROOTPOW also list branch points; `poles` lists points mapped to ∞.
- **Pull-back.** To pull a point back to the z-plane through ops j−1 … 0:
  - a finite point goes through each op's own enumerator, with the members nearest the source window;
  - ∞ goes through the op's `poles` (MOB: −d/c; IPOW n < 0: 0; LOG: 0; JOUK: 0; RAT2: roots of q; TAN, TANH: members
    of their pole lattice). AFF and EXP keep ∞ at ∞.
- **Caps (rev 2).** Lattices are enumerated only inside `expandBox(clipWin, 3)`, and `singular()` returns at most
  `cap` points per kind (16 by default), nearest `clipWin` first. Its cost is bounded by the cap times the chain length
  (tested: tan(H) and tan(1/z) under 2 ms per call, 12.1 (f)).
- **The accumulation set** P = the finite pulled-back `undef` points, at most 4, nearest `clipWin` first. Examples:
  e^{1/z} → {0}; z^i → {0}; exp∘Cayley → {−i}; exp, sin, log, Cayley → {}.
- `singular(..., kinds, cap)` also returns branch points and poles for the line refinement (9.1), which runs on
  settle only.

### 3.8 Shape geometry for ranges (`src/region.js` additions and `Inverse.imageBox`)

**`Region.supportOf(s, e)`** returns [inf ⟨z, e⟩, sup ⟨z, e⟩] over the shape (⟨z, e⟩ = Re(z·conj e)), ±Infinity when
unbounded; conservative. It sizes budgets (3.4) and scissors (4.8).

| shape | support |
|---|---|
| disc | ⟨c, e⟩ ∓ r |
| annulus | as the disc of radius r₂ |
| rect, polygon | min/max over the vertices |
| sector, r > 0 | as the disc (c, r) |
| sector, r = 0 | [−∞, ∞] |
| halfplane (inside = left of a→b, unit normal n = i·(b−a)/\|b−a\|) | if \|⟨e, n⟩\| ≥ 1 − 1e−12: one-sided at ⟨a, e⟩ (lower bound when ⟨e, n⟩ > 0, upper otherwise); else [−∞, ∞] |
| formula | the recognizer's box, else [−∞, ∞] |
| complement | [−∞, ∞] |

**`Region.clipPrimitive(s)`** (new) describes the shape for `shapeClip` (4.3): disc (c, r); rect (box); polygon (its
bounding box: bounded and conservative); halfplane (a, d); annulus (outer disc with the inner disc as a hole); sector
r > 0 (disc ∩ wedge hull); sector r = 0 with span ≤ 180° (two halfplanes), with span > 180° (a hole: the complementary
wedge); complement of a disc/rect/convex polygon (whole line with the base shape as a hole); formula (the recognizer
box when it is bounded or `convex`, else none). `Region.convexOf(s)`: disc, rect, halfplane, sector with span ≤ 180°,
convex formula boxes.

**The recognizer** (formulas). On a comparison with a real constant c on one side and Re z, Im z, |Re z|, |Im z| or
|z| (also x, y, r) on the other: Re z < c gives x₁ = c; |Im z| < c gives y ∈ [−c, c]; |z| < c gives x, y ∈ [−c, c];
mirrored for >. `and` intersects boxes; `or` takes their hull and clears `convex`; `not` and anything else give the
whole plane with `convex` false. Examples: `|\Im z|<\frac{\pi}{2}` gives y ∈ [−π/2, π/2] (convex);
`|\Re z|<\frac{\pi}{2}, \Im z>0` gives x ∈ [−π/2, π/2], y ≥ 0 (convex).

**`Inverse.imageBox(G, shape, coord, unit, {poles})`** (float64, conservative):
- If a pulled-back prefix pole lies in the shape's closure: unbounded, `farCover = true`.
- Unbounded shapes: for a pure Möbius prefix, the exact image of the shape's generalised disc (disc, halfplane,
  sector ≤ 180° via its bounding halfplane, complement of a disc) under the Möbius map, whose box is closed-form;
  otherwise unbounded with `farCover = false` (so the shape goes forward, 3.4).
- Bounded shapes: an adaptive quadtree over the shape's bounding box, 8 × 8 cells to start. A cell is skipped when all
  9 samples are farther outside than the cell diagonal. A cell is split when its 9 sample values of coord∘G spread
  over more than unit/4, up to depth 8. A leaf cell contributes its min and max, and the result is padded by the
  largest leaf spread. A non-finite sample at depth 8, or a leaf spread above 4 units, makes the box unbounded with
  `farCover = false`.
- Cuts of prefix steps inside the shape need no special handling: the quadtree samples both sides and the padding
  covers the jump.
- Cost: ≤ 4,096 evaluations of G; measured 0.07–2.3 ms per shape in the unoptimised prototype (r7). It is cached by
  (plan key, step parameter values, shapeKey).

### 3.9 CPU reference renderer (`renderCPU`)

A port of `notes/proto/lead-inv/render.js` on top of `enumerate`, used by node tests. Per pixel: `enumerate`, the
region coverage with the facing rule and the twin merge (4.2), D and the tie rule, B-buffer compositing with the
tail closure, and analytic pattern footprints, all in float64. Its output is scored with
`test/regress/quality/metrics.js`.

### 3.10 Correctness contract (unit-tested, 12.1)

- **Soundness.** Every member with lvl > 1e−7 maps back: |f(u) − w| ≤ 1e−8 (1 + |w|), with f the step's own
  `Funcs.build().f`.
- **Completeness (rev 2).** For random shapes anywhere in a ±100 box, random u in the shape and w = F(u), with the
  reference fixed at the **default** clipWin centre and left-view zooms 4×, 1×, 1/4× and 1/16×, the walk of an
  eligible shape finds a covering member (samples whose float64 path does not round-trip are skipped and counted).
- **Front order.** When no window is truncated, the front K equals the full-enumeration front K. When the innermost
  window is truncated, the front key is within 0.01 octave of the full-enumeration front key.
- **Decomposition.** Composing the ops' `fwd` equals `b.f` to 1e−9.
- **Range sign.** For single-valued range ops, lvl > 0 if and only if f(pre(w)) = w (away from a 1e−9 band).
- **Determinism.** The same inputs give the same member order.

---

## 4. The GPU inverse renderer

### 4.1 GLSL generated by `src/glsl.js`

`GLChain.build(steps, built)` gains `inverse`:

```js
inverse: {
  key: Inverse.inverseKey(steps, built),   // ['inv2', per live step: its op kinds, or 'X' when stepOps fails]
  lib: '...',                              // uInv[] declaration, INV_LIB, ixJ_* op functions (no walker)
  walker: '...',                           // invWalk(): generated, placed after INV_HEAD by gl.js (rev 2 split)
  ops: [{kind, step, j, cell}],            // j: op index in forward order; cell: first uInv slot of the op
  nOps: N, slots: S,
  fill(put, built),                        // writes the op parameters into uInv (its own allocator)
}
```

- **Separate uniform block (rev 2).** Inverse parameters live in `uniform vec4 uInv[S]` with their own allocator and
  `fill`. The forward `uChain` layout never depends on the inverse decomposition, so an eligibility flip cannot shift
  forward cells under a forward program that was not recompiled.
- **Key.** The key encodes, per live step, its op kinds or `X` for an ineligible step. Poly `1, 0, −1, 0` (`X`) and
  `1, 0, 0, 5` (IPOW, AFF) therefore have different inverse keys although their forward key is the same
  `['poly', 4]`.
- The decomposition comes from `Inverse.stepOps` (the same function as the CPU), so the CPU plan and the GLSL never
  disagree on structure. An `X` step compiles to `ixJ_one` returning false; the CPU plan marks every range containing
  it ineligible, so it is never drawn.

**Fixed library** (`INV_LIB`, constant text in glsl.js):

```glsl
struct Lf { vec2 u; vec4 J; float lvl; vec2 lg; vec2 lam; bool hasLam; };   // J: dz/dw row-major (x y; z w)
float ixPix;                                          // w units per pixel of this pass (set by main)
const float IX_RAMP = 1.0;
vec4 ixMulC(vec2 d, vec4 J);                          // [d.x -d.y; d.y d.x] * J
vec4 ixConjJ(vec4 J);                                 // diag(1, -1) * J
float ixScale(vec4 J);                                // sqrt(|det J|)
Lf ixStart(vec2 w);                                   // {w, I, 1e38, 0, 0, false}
bool ixApply(inout Lf L, vec2 u, vec2 dudw, bool anti, float lvlOut, vec2 lgOut, vec2 lam, bool hasLam);
uniform int uIxA; uniform int uIxB;                   // stage range (a, b]
uniform vec2 uIxRef[N];                               // refs per op
uniform int uIxN[N];                                  // per-op scan budget (3.4)
uniform int uIxRK[N];                                 // range kind: 0 none, 1 clip, 2 box, 3 branch
uniform vec4 uIxAB[N];                                // clip: (A.xy, B.xy) of u = A z + B
uniform vec4 uIxBox[N];                               // box: (e.xy, lo, hi), +-1e30 for unbounded
uniform int uIxStopOp; uniform vec4 uIxStopMob;       // Mobius stop data: (uPole.xy, pAcc.xy)
uniform int uIxStopMobOn; uniform float uIxPAccInP;   // Mobius rule on; 1.0 when pAcc is in P
bool ixAct(int k) { return uIxA < k && k <= uIxB; }
```

**Per op j** (prefix `ixJ_`, parameters read from `uInv`, so modes and values are uniforms):

```glsl
bool  ixJ_one(inout Lf L);                                    // single-valued and finite ops (finite: member b)
int   ixJ_nb(Lf L);                                           // number of bases (finite families: members)
void  ixJ_line(Lf L, int b, out vec2 u0, out vec2 step);      // additive: u_m = u0 + m step; log: L_m = u0 + m step
bool  ixJ_at(Lf L, int b, float m, out Lf R);                 // member (b, m) applied to a copy of L
```

**Range and centre** (shared GLSL, `ixRange(j, ...)`): computes [lo, hi] and the hole from `uIxRK[j]` as in 3.6 —
`shapeClip(z0, q)` from the shape record for kind 1, the box for kind 2, the ROOTPOW branch range for kind 3 —
and ms = clamp(m*, lo, hi) moved out of the hole, with the Möbius best-of-3 centre when `j == uIxStopOp &&
uIxStopMobOn`. Member indices are floats; |m| ≤ 2²⁰ is guaranteed by `prepare`.

**The walker** is generated statically from the full op list, so its loop nest is fixed. An inactive op (its step is
outside (uIxA, uIxB]) is a pass-through: single-valued ops are skipped, and multivalued ops run one iteration with
R = L.

```
gen(ops N..1):
  "void invWalk(vec2 w) { Lf L0 = ixStart(w);"
  cur = L0
  for j = N down to 1:
    if single(j): "if (ixAct(k_j) && !ix{j}_one(cur)) <exit>;"
    else if finite(j):
      "for (int b = 0; b < NB_MAX_j; b++) {"                               // NB_MAX: 2, or 16 for IPOW
      "  if (b > 0 && !ixAct(k_j)) break;  if (ixAct(k_j) && b >= ix{j}_nb(cur)) break;"
      "  Lf R = cur; if (ixAct(k_j) && !ix{j}_one_b(R, b)) continue;"  cur = R
    else (window family or ROOTPOW finite/inf):
      "for (int b = 0; b < NB_MAX_j; b++) {"                               // NB_MAX: 1 or 2
      "  ... base guard as above ...; float lo, hi, hlo, hhi, ms; ixRange(j, cur, b, lo, hi, hlo, hhi, ms);"
      "  if (lo > hi) continue;"
      "  float up = ms, dn = ms - 1.0; if (dn >= hlo && dn <= hhi) dn = hlo - 1.0;"
      "  bool aU = up <= hi, aD = dn >= lo; int turn = 0; int cU = 0, cD = 0;"  // cU/cD: trailing covering count
      "  for (int t = 0; t < 64; t++) {"                                    // static bound; dynamic budget below
      "    if (t >= uIxN[j] || !(aU || aD)) break;"
      "    bool goUp = (aU && aD) ? ((turn++ & 1) == 0) : aU;"
      "    float m = goUp ? up : dn;"
      "    if (goUp) { up += 1.0; if (up >= hlo && up <= hhi) up = hhi + 1.0; aU = up <= hi; }"
      "    else      { dn -= 1.0; if (dn >= hlo && dn <= hhi) dn = hlo - 1.0; aD = dn >= lo; }"
      "    Lf R = cur; if (ixAct(k_j) && !ix{j}_at(cur, b, m, R)) { if (goUp) cU = 0; else cD = 0; continue; }"
      cur = R
  "float D = invLeaf(cur, cov);"                                           // defined by gl.js (4.2)
  at the innermost loop of op j:
    "if (goUp) cU = cov ? cU + 1 : 0; else cD = cov ? cD + 1 : 0;"
    "if (j == uIxStopOp && ixStop(j, m, goUp, cur, D)) { if (goUp) aU = false; else aD = false; }"  // 3.6 rules
  after the member loop of each window family:
    "if ((aU && cU >= 3) || (aD && cD >= 3)) ixTailInf = true;"            // truncated side still covering
  close the braces
```

`ixDK()` and `ixStop` are defined by gl.js's compositor (`ixStop` implements both rules of 3.6). With the budgets of
3.4 the nest visits at most 64 leaves. The static bound 64 only limits unrolling; the P2 benchmark (4.7) records
compile time with these nested dynamic loops on ANGLE Metal, SwiftShader and, where available, ANGLE D3D11.

### 4.2 `INV_FS` (src/gl.js): per-pixel coverage, sheet order, compositing

Program text order (rev 2: lib and walker split so every function is declared before use):

```
HEAD + GLChain.LIB + inverse.lib (uInv, INV_LIB, ixJ_*) + UTIL + SHADE? + INV_HEAD (uniforms below, shape level,
shapeClip, ixRange, sheetKey, compositor, ixDK, ixStop, patternColor, invLeaf) + inverse.walker + INV_MAIN
```

**Uniforms** (beyond `uInv` and the `uIx*` of 4.1):

| group | uniforms |
|---|---|
| view (flat) | `uCenter` (hi), `uCenterLo`, `uInvScale`, `uVp`, `uDpr` |
| view (globe) | `uMVP`, `uEye`, light (`lightUniforms`), via `SPHERE_VS` |
| sheet key | `uWin` (x0, y0, x1, y1 of `clipWin`), `uWinR` (half-diagonal), `uWinRs` (= R/8), `uSing[4]`, `uSingN` |
| compositing | `uAlpha` (the shape's alpha, hover-dimmed), `uKsat` (K, capped at B) |
| shape | `uPts` (texture unit 4: every shape's record, packed once per frame), `uShOff` (this shape's record offset), `uShape` (kind, complement, count), `uShA`, `uShB`, `uFormSlot` |
| look | as `regionUniforms`: `uC0`, `uC1`, `uK`, `uPattern`, `uCell`, `uLines`, `uShrink`, `uGrow`, `uMid`, `uOrigin`, `uQ`, plus `uSphN` |

**Buffer size B is a compile-time constant (rev 2).** The default variant has B = 8. A B = 16 variant is compiled only
for shapes whose own (undimmed) α is below 0.5. (P2, 13.10: implemented as B = K + 2 of the own α, rounded up to 3, 5,
8 or 16; admission never inserts at positions ≥ K + 2, and the buffer's size dominated the pass cost.) Hover-dimmed draws (α halved, app.js `drawScene`) use the shape's own
variant with K capped at B; the tail closure covers the rest. (P2 review, 13.12: classes 3 (α ≥ 0.999), 5 (α ≥ 0.5),
8; no B = 16. The buffer keeps the front B sheets exactly; covering candidates it does not keep enter the composite
through their exact transmittance ixTr, coloured with the buffer's mean; for the own α with K > B the early stop is
off so every covering candidate is counted.)

**Main** (flat; the globe variant is in 4.6):

```glsl
void main() {
  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);        // hi/lo, as view2D
  dwdX = vec2(uInvScale.x, 0.0); dwdY = vec2(0.0, uInvScale.y);
  ixPix = uInvScale.x;
  nb = 0; nCov = 0; U = 0.0; ixTailInf = false;
  invWalk(w);
  float T = 1.0; vec3 C = vec3(0.0);
  for (int i = 0; i < B; i++) { if (i >= nb || T < 1.0/255.0) break;
    float a = uAlpha * bC[i] / U; C += T * a * bCol[i]; T *= 1.0 - a; }
  if ((ixTailInf || nCov > B) && T >= 1.0/255.0) { C += T * mean(bCol[0..nb)); T = 0.0; }   // tail closure
  o = vec4(U * C, U * (1.0 - T));                         // premultiplied; blended ONE, ONE_MINUS_SRC_ALPHA
}
```

**Leaf** (one candidate z):

```glsl
float invLeaf(Lf L, out bool covers) {
  vec2 z = L.u;
  vec2 dX = ..., dY = ...;                               // dz per pixel step, from L.J
  float D = sheetKey(z, L);                              // section 5
  float sreg; vec2 nreg;
  shapePx(z, dX, dY, L, sreg, nreg);                     // signed distance to the region boundary in px, unit normal
  float cv = (L.lvl < 1e30 && dot(nreg, L.lg) < -0.5)
      ? clamp(min(sreg, 0.5) + min(L.lvl, 0.5), 0.0, 1.0)   // facing rule: region continues across a cut
      : clamp(min(sreg, L.lvl) + 0.5, 0.0, 1.0);
  covers = cv > 0.0;
  if (covers) { nCov++; U = max(U, cv); admit(D, z, cv, L, dX, dY); }
  return D;
}
```

**Admission and shading (rev 2).** `admit` finds the sorted position of (D, tie) among the nb entries.
- **Twin merge.** If the neighbour at that position has the same source point (|z − z_e| ≤ |dX| + |dY|), both entries
  are partial (cv < 1), both are bound by a range level, and their range gradients oppose (lg·lg_e < −0.5), the
  candidate is merged into it: cv_e = min(1, cv_e + cv), and U is updated. Such twins are the two sides of an
  intermediate cut that a later step heals ([log, exp], [root n, zⁿ]); they share D and the tie key, so they are
  adjacent. Entries store the gradient as one angle (8 floats per entry).
- **Admission limit.** A candidate whose position is ≥ min(B, K + 2) is not stored and **not shaded**; it still counts
  in nCov and U. Otherwise `patternColor(z, dX, dY, L)` runs once and the entry is inserted (the worst entry drops when
  full). For z^i(H) at α = 1 this shades at most 3 candidates per pixel instead of every covering one.

`ixDK()` returns `bD[K−1]` when nb ≥ K, else 1e38. K = 1 when α ≥ 0.999, else min(B, ⌈ln(1/255)/ln(1 − α)⌉):
α = 0.85 gives 3, α = 0.5 gives 8, α = 0.2 gives 16 (B = 16 variant).

**Coverage union.** All sheets of an infinitely-sheeted image share their rims. Compositing relative weights cv/U
and scaling by U gives the true area fraction at a rim, where 1 − Π(1 − cv) would thicken it. inverse-first measured
IoU 0.44 at the z^i 16× rim without this rule. U is the running maximum over **all** covering candidates.

**Facing rule.** At log(H)'s Im w = −π the region boundary and the cut coincide with opposite orientation. Plain
min() paints a half-pixel ghost line there; inverse-first measured the coverage error drop from 0.43 to 0.02 with the
rule.

**Tail closure (rev 2).** The remaining transmittance is filled with the mean buffer colour when the buffer
overflowed (nCov > B) or when the walker flagged infinite multiplicity (`ixTailInf`: a window side truncated by its
budget whose last 3 members all covered). Measured at α = 0.2 (r6): exp(H) opacity minimum 0.832 → **1.000**; e^{1/z}
0.972 → 1.000; z^i(H) 1.000 in both.

### 4.3 Shapes: level, gradient and clip (`shapePx`, `shapeClip`)

The record layout is `drawPreimage`'s (`TKIND`, A, B, polygon points), built by a shared `packShape(s)` that
`drawPreimage` refactors out. Every visible shape's record is packed **once per frame** into the points texture, and a
pass gets its offset (`uShOff`). L is the level of `Region.levelOf` (positive inside, NaN counts as outside), and g is
∇_z L. The pixel-space gradient is gpx = (⟨g, dX⟩, ⟨g, dY⟩), sreg = L/|gpx|, and nreg = gpx/|gpx|.

| kind | L | g |
|---|---|---|
| disc | r − \|z − c\| | −(z − c)/\|z − c\| |
| rect | min of the 4 side distances | gradient of the active side |
| polygon (≤ 64 vertices, rev 2) | ±(distance to the nearest edge) | ±(z − q)/\|z − q\|, q the nearest edge point |
| halfplane | cross(d̂, z − a) | i·d̂ |
| annulus | min(d − r₁, r₂ − d) | ±(z − c)/d |
| sector | as `angIn` and r − \|z − c\| | gradient of the active term |
| formula | compiled `ilevN(z)` (`GLChain.levelGLSL`), selected by `uFormSlot` | central differences |
| complement | −L | −g |

**`shapeClip(z0, q) -> (tlo, thi, thlo, thhi)`** implements `Region.clipPrimitive` (3.8): disc by the quadratic
|z0 + t q − c|² = r²; rect and polygon by slab clipping of the (bounding) box; halfplane by its linear level; sector
r = 0 by two halfplanes or, when reflex, by a hole; annulus and complements by a hole; formulas by their recognizer
box. `node notes/proto/lead-rev/walk.js` `clipLine` is the reference; the GLSL is checked against it (12.2).

**The Λ rule** (huge or tiny |z|; rev 2). When `L.hasLam` and |Re Λ| > 60:
- **Re Λ > 60** (z near ∞): a halfplane and a sector with r = 0 use the direction e^{i Im Λ} (the asymptotic cone);
  bounded kinds are outside; complements of bounded kinds are inside; formulas are evaluated at e^{60 + i Im Λ}.
- **Re Λ < −60** (z near 0): when the boundary passes through 0 (a halfplane whose line passes within 1e−12·|a| of 0,
  a sector with apex at 0) the direction e^{i Im Λ} is tested against the tangent cone at 0; otherwise the sign of
  the level **at z = 0** decides, for every kind; formulas are evaluated at e^{−60 + i Im Λ}.

A candidate with |z| > 1e30 and no Λ is outside. Measured (r5): log of Im z > 1, Re z < −1, Re z > 1 and of a sector
with apex 1+i at 32× and 64× zoom-out: rev 1 rule 46–150 spurious pixels, rev 2 **0**; shapes containing 0 (a disc,
Im z > −1), where an implementer reading rev 1 as "bounded kinds outside" would punch 138–276 px holes: rev 2 **0**.

### 4.4 Programs

- **Names and keys (rev 2).** `inv` (`QUAD_VS` + `INV_FS(flat)`) and `invS` (`SPHERE_VS` + `INV_FS(globe)`) are
  inverse programs keyed `inv|<inverse.key>|<formula bundle hash>|B8` (or `B16`), separately from the forward chain
  programs. `sources()` prepends `GLChain.LIB + inverse.lib`; gl.js places `inverse.walker` after `INV_HEAD`.
- **Never a history stand-in.** `drawInverse` uses only the program for the current key (`getProg(cur)`), never `hist`:
  an older inverse program has a different op list and would read the current per-op uniforms as garbage. When the
  current program is not ready, `drawInverse` returns `'pending'`.
- **Formula bundle (rev 2: one program per scene, not per shape).** The scene's visible formula shapes, in list order,
  take formula slots 0–3 (`ilev0..3`, dispatcher `formulaLevel(uFormSlot, z)`). A fifth and later formula shape goes
  forward, deterministically by list order. Non-formula shapes use the bundle program too (slot unused), so a scene
  needs one inverse program per pane, view kind and B variant.
- **Own LRU.** Inverse programs live in their own LRU of 8 entries, separate from `preNames`. It never evicts a
  program drawn in the current or the previous frame. Target `pre` variants are unaffected.
- **Debounce.** A formula edit recompiles the bundle 300 ms after the last keystroke; meanwhile the edited shape draws
  forward (`'pending'`), with its new formula.
- **Compile order.** An inverse compile starts only after the forward programs of the same chain have landed, so
  example loads first show today's image, then the exact one.
- **Warm-up (P2 finish, 13.13).** A program's first draw builds its Metal pipeline: a 75–205 ms stall of the GPU process
  cold. Live frames never draw a program that was never drawn (`drawInverse` with `coldOk: false`): another warm B
  class or the forward stand-in shows, `framePending` is set, and the app warms the program (`GLR.warmInverse`: a
  one-pixel draw with a real pass's state) as soon as nothing moves: at once when its compile lands (`GLR.onReady`,
  also fired for a compile that lands inside a draw or a status query), else polled every 100 ms until the motion
  ends; then the panes redraw. Half-resolution pipelines are warmed only after 1 s without input, except for a pane
  predicted to need half resolution (10.12, 13.14): its programs get them at the same quiet moment as their first draw
  (`GLR.wantHalf`), so its first gesture is already half resolution. Exports draw cold
  programs directly (the stall is part of the export). Side-mode draws (gallery and step thumbnails of side
  chains) never start an inverse compile; they use the inverse path only when its program is already ready.
- **Errors.** Failure state is kept in the `progs` entry (cleared by `onRestore`'s `progs.clear()`). Link status is
  ignored while the context is lost (`gl.isContextLost()`): it is not a failure. A failed inverse compile never sets
  `frameErr` or `lastError` (no error chip, no red LED); it is reported once in the console and the map is treated as
  ineligible for the session.

### 4.5 `GLR.drawInverse(st)` (contract between gl.js and app.js)

```js
st = {
  map,                               // GPU map spec (mode 0, normalised)
  viewKind: 'flat' | 'globe',
  view, dpr,                         // flat; or globe: {MVP, eye}
  shapeRec: {offset, kind, complement, formSlot},   // into the frame's packed records (packShapes, once per frame)
  look: {color, color2, edge, ink, alpha, pattern, cell, lines, stretch, origin, sphN, Bvariant},
  inv: {refs, N, rk, AB, box, stopOp, stopMob, win, R, rs, sing, K},   // from Inverse.prepare (3.6)
  scissor,                           // optional [x, y, w, h] device px (4.8)
  half,                              // optional: render at half resolution (cost guard, motion frames only)
}
returns 'drawn' | 'pending' | 'error'          // 'pending' also sets framePending
```

The app calls it in the same slot where it would call `drawRegion` for that shape (10.2). `GLR.packShapes(list)` packs
the frame's records once (one texture upload per frame, not per pass). (P2: as implemented, `st` carries the plan and
the `Inverse.prepare` result themselves (`plan`, `prep`) and the shape (`shape` or `shapeId`) whose record
`packShapes` made this frame; `look.alphaOwn` selects B. The full API is in the P2 renderer report.)

### 4.6 The globe variant (Sphere view and left globe)

- **Geometry.** The globe's own triangles, drawn after the globe like `drawPreimage`'s sphere branch: depth LEQUAL, no
  depth write, polygon offset (−1, −2). Inverse and forward shapes are interleaved in list order (2.3).
- **Pixel position.** P = normalize(vP). If P.z ≤ 0, w = (P.x + iP.y)/(1 − P.z). Otherwise u = (P.x − iP.y)/(1 + P.z)
  and w = 1/u, which has no cancellation near the north pole.
- **Footprint.** `dwdX = dFdx(w)`, `dwdY = dFdy(w)` at the top of main (uniform control flow), and
  ixPix = sqrt(|det(dwdX, dwdY)|).
- **Output.** a = U(1 − T), rgb = `toSrgb(shade(toLin(U·C/a), n, v, 1.0))·a` (premultiplied), lit like `regionS`.
- **Coverage.** Poles are ordinary pixels: Cayley's w = 1 and 1/z's w = 0 need nothing special, and no chordal
  criteria are needed because every fragment is exact.

### 4.7 Performance budget (evidence and gates)

**What was measured in rev 1, and what it is worth.** `notes/proto/lead-inv/gpu_bench_page.js` (Apple M4, ANGLE
Metal, headless Chrome 155) timed hand-specialised shaders: one hard-coded family per shader, B = 8 constant, no
`GLChain.LIB`, no `Lf` dispatch, no texelFetch shape records, no pattern switch, no facing rule or tail closure, about
2 KB of GLSL each:

| scene | 410×516 (dpr 1) | 820×1032 (dpr 2) | 1640×2064 |
|---|---|---|---|
| z^i(H), α 1 / 0.85 | 1.12 / 0.69 ms | 2.18 / 1.42 ms | 3.53 / 3.94 ms |
| exp(H) | 0.45 / 0.57 | 0.96 / 1.27 | 2.68 / 3.78 |
| e^{1/z}, disc | 0.48 / 0.57 | 1.07 / 1.33 | 3.09 / 3.94 |
| sin, half-strip (unpruned, 34 members) | 0.55 / 0.73 | 1.37 / 2.08 | 4.12 / 7.05 |

These are **lower bounds** on the fastest GPU. `GLChain.LIB` alone is 10.4 KB (210 lines); the real program is
estimated at 25–30 KB. Rev 2 reduces the per-pixel work (shape ranges: 3–5 leaves instead of 9–17 for the common
scenes, shading on admission, B constant) but the real cost is unknown until measured.

**P2's first deliverable (gate for the rest of P2): the generated-program benchmark.** A CDP page that builds `INV_FS`
from glsl.js and gl.js (not hand-written GLSL) and draws, at dpr 1 and dpr 2: z^i(H), exp(H), e^{1/z} disc, sin
half-strip, a 3-op chain (exp∘exp of a disc), a 40-vertex polygon under exp, and a formula strip under exp; α 1 and
0.85; flat and globe. It records compile time, link time, first-draw time and the GPU time per pass, under ANGLE
Metal (the suite's machine), `--use-angle=swiftshader`, and ANGLE D3D11 when a Windows runner is available (open
question 5). Results go into 13.10 of this spec before the renderer work is merged.

**Gates** (P2): the perf suite's existing units at dpr 1 within tolerance; new dpr-2 units (12.5) within the budget
of D8 on the suite's machine (since 2026-10-20 the user's rule "60 fps is enough": a frame, latency, jank or throughput
metric worse than its relative tolerance still passes inside the absolute 60 fps budget of `compare_perf.py`: frame
≤ 12 ms, latency ≤ 40 ms, longest frame after input ≤ 20 ms, ≥ 55 frames/s while dragging); under SwiftShader, the pan-frame ratio inverse/forward ≤ 3 for the bounded golden scenes
(with the guard active, which demotes them when needed); compile plus first draw of the inverse program ≤ 250 ms on the
suite's machine for every acceptance scene.

### 4.8 Safeguards

- **Scissor (P2, rev 2).** For a bounded shape, the box of its image is computed on the CPU by adaptive boundary
  sampling in image pixels: boundary samples are split until consecutive image samples are under 1 px apart (chord
  deviation under 1 px), plus the images of intermediate cut segments inside the shape (from `imageBox`'s quadtree,
  3.8). Padded by 4 px. The scissor is skipped when a pole or a point of P lies within the shape's support box
  inflated by one window width. The w-box is cached per (mapKey, shapeKey) and converted to pixels per frame.
  (Rev 1's 256 uniform samples missed 30 px of 1/z of a disc 0.005 from its pole.)
- **Pruning by shape ranges** (3.6) and the **early stop** (3.6).
- **Cost guard** (D8, 10.12).

---

## 5. Sheet order

### 5.1 The key D

```
D(z) = log2(1 + dist(z, W) / R) + sum over p in P of max(0, log2(rs / |z - p|))
```

- W is the box of `clipWin`, R its half-diagonal, and rs = R/8.
- dist is Euclidean, and 0 inside W.
- P is the accumulation set of 3.7 (at most 4 points).
- With Λ and Re Λ > 60: dist ≈ e^{Re Λ}, so log2(1 + dist/R) ≈ (Re Λ − ln R)/ln 2. For p = 0 the singular term is
  log2(rs) − Re Λ/ln 2.

Meaning: the sheet the left plane shows at its own scale is in front. Sheets translated away from the window lie
behind by octaves of distance (exp(H)). Sheets diving into an essential singularity near the window lie behind by
octaves of depth (e^{1/z}, z^i near 0). Using `clipWin` (not the live left view) keeps the order stable while the left
view pans; the order updates when `clipWin` updates (`sourceViewChanged`), as meshes do today.

### 5.2 Ties

When D(z₁) = D(z₂) (typically both 0: inside W and outside every rs-disc), the candidate with the larger Im z is in
front, then the one with the larger Re z.

Today's mesh draws rows bottom-up, so later (higher) rows are on top. This rule reproduces that order: the
`disc_cube` golden emulation shows 0 differing pixels. With the order reversed it shows 621 px (0.293 %). The fallback
uses the same rule for equal D: draw order is D descending, then source y ascending.

### 5.3 Seams

A sheet-dependent pattern (checker) changes where the front sheet changes. That is a smooth curve on the inverse path
and triangle-jagged on the fallback. With coincident patterns (solid, or the polar checker under z^i) no seam is
visible.

### 5.4 Truncated windows (rev 2)

Bounded ranges are scanned whole, so their front order is exact. An unbounded range scans a window of at most 17
members around the centre of 3.6, with the exact stop. The front sheet can then differ from the full enumeration only
where the window does not reach the key minimum. Measured over 40 random left views: e^{1/z} never; exp∘Cayley in
1.3 % of pixels, all within 0.0004 octave of the optimal key (near-ties of almost equal depth). The contract (3.10) is
0.01 octave.

---

## 6. Patterns

### 6.1 One template, two footprint modes

`gl.js` gets `PATTERN_SRC(mode)`. It generates the pattern branch of `REGION_FS` from a template in which every
footprint is a macro:

| mode | footprint |
|---|---|
| `'fwidth'` | `fwidth(x)` and `argWidth(sp)`, exactly today's text |
| `'analytic'` | the formulas of 6.2, from the footprint vectors dX, dY and Λ |

**Contract.** In P2, `REGION_FS(false)` and `REGION_FS(true)` must stay **byte-identical** to today's strings (a
string test against fixtures saved before P2, covering patterns 0–7). P3 adds pattern 8 to the forward path: its
fixture update is reviewed as a diff that may only add the pattern-8 branch, and the fixtures are re-recorded then
(rev 2). The inverse `patternColor(z, dX, dY, L)` uses `'analytic'`.

### 6.2 Analytic footprints

fw(p) = |∂p/∂X| + |∂p/∂Y|, with ∂p/∂X = ⟨∇p, dX⟩. The definitions are those of `REGION_FS`: Q is the pattern-aligned
origin, v = z − o with o the polar origin, and ρ = |v|.

| pattern | coordinates | footprint |
|---|---|---|
| checker, tiles, graph paper, solid net | g = (z − Q)/cell | gw = (\|dX.x\| + \|dY.x\|, \|dX.y\| + \|dY.y\|)/cell; fs = gw·cell |
| polar (16 sectors, ratio e^{π/8}) | gp = (ln ρ, arg v)·16/2π; with Λ and o = 0: (Re Λ, Im Λ), arg unwrapped (shifts of 2π change the index by 16, so parity holds) | per coordinate (\|Re(dX/v)\| + \|Re(dY/v)\|, \|Im(dX/v)\| + \|Im(dY/v)\|)·16/2π; the near-origin fade (rc) as `REGION_FS` |
| polar web | gr = ρ/cell, ra = arg v·12/π | (\|Re(conj(v)dX)\| + …)/(ρ cell); (\|Im(dX/v)\| + \|Im(dY/v)\|)·12/π |
| source phase | lr = ln\|sa\|·6/π, wheel(arg sa) | (\|Re(dX/sa)\| + \|Re(dY/sa)\|)·6/π |
| area scale | vJac = −½ log2\|det J\| (exact per pixel) | – |
| sphere checker (id 8) | see 6.3 | see 6.3 |

### 6.3 The spherical checker (pattern id 8, `PATTERNS.sphere = 8`, menu "Sphere checker")

**Sphere.** The app's own Riemann sphere, centred at the pattern origin o (the polar pattern's origin, default 0)
with equator |z − o| = ρ₀ = 1. It is the same stereographic projection as `lift()` and the Sphere view, so the pattern
is literally a longitude/latitude tiling of what the Sphere view shows.

**Coordinates.** v = z − o, ρ = |v|:
- longitude θ = arg v ∈ (−π, π];
- latitude λ = 2·atan(ρ/ρ₀) ∈ [0, π] (0 at o, the south pole; π at ∞). For ρ > 1 compute it as
  π − 2·atan(ρ₀/ρ); with Λ as π − 2·atan(e^{−Re Λ}).

**Cells.**
- n_lon = clamp(round(16/patternScale), 4, 64), always even: patternScale ∈ {¼, ½, 1, 2, 4} gives
  {64, 32, 16, 8, 4}.
- n_lat = n_lon/2, so cells are square at the equator.
- g = (θ·n_lon/2π, λ·n_lat/π); parity floor(g.x) + floor(g.y) chooses c0 or c1 through `checker(g, gw)`.
- `uSphN = n_lon`.
- The default is 128 cells for C ∪ {∞}.

**Footprints.**
- ∂θ = Im(dz/v), ∂λ = (2ρ₀ρ/(ρ₀² + ρ²))·Re(dz/v), giving gw = per-coordinate |∂X| + |∂Y|, scaled as g.
- Forward mode: fwidth of λ and `argWidth(v)` for θ.
- Pre-mapped fallback: per-vertex (θ unwrapped per triangle, λ).

**Moiré.** col = mix(checker colour, (c0 + c1)/2, moire(gw)), with the same smoothstep(0.18, 0.45) as every pattern.
Near o and near ∞ the 2·n_lon polar-cap cells converge. There, and at any essential singularity where infinitely many
sheets accumulate (each sheet's cells are tiny), the colour is the uniform average: never noise. `S.lines` draws the
net at cell edges, as `net()`.

**What it looks like** (rendered in `notes/proto/lead-inv/out/sph_*.png`):
- **log(H):** 8 horizontal rows (θ bands of H) × latitude columns at Re w = ln tan(jπ/16). The two end columns run to
  −∞ and +∞: the strip visibly reaches infinity with finitely many cells.
- **z^i(H):** concentric rings |w| = e^{−jπ/8}, cut by rays.
- **Cayley(H):** a graticule converging at w = ±1, averaged there.

---

## 7. Precision

- **Pixel positions** are hi/lo (`uCenter` + (offset + `uCenterLo`)) as in `view2D`. inverse-first measured identical
  metrics in float64 and float32 emulation for all 10 acceptance chains at 1×, 4× and 16×, including Cayley at 64× on
  w = 1 and 1/z at 128× on w = 0, which are the suite's deepest zooms.
- **Member indices** are floats on the GPU, exact up to 2²⁴; `prepare` sends shapes whose member bounds exceed 2²⁰ to
  the forward path, where float32 positions u = base + m·p would lose more than 1/16 period anyway.
- **Anchoring (P6, optional).** For an outermost AFF/MOB op the CPU passes its value at the view centre in float64 and
  the GPU adds offset terms (Möbius: num = num0 + d·δ, den = den0 − c·δ). inverse-first measured IoU 0.88 → 1.00 at a
  4,194,304× zoom on the image of ∞.
- **Λ.** Candidates from LOG and ROOTPOW carry Λ = log z, so polar, phase and sphere patterns and the halfplane and
  sector tests are exact for any |z| (4.3). With a 17-member window, z^i members stay within |Re Λ| < 57.
- **float32 transcendentals** on real GPUs are 2–4 ulp. The GLSL parity test (12.2) checks enumerator outputs on the
  GPU against `Inverse.enumerate`. The real-GPU benchmark reproduced the z^i hole, rims and polar checker exactly
  (4.7).
- **Fallback.** float64 vertices in two charts (z, and u = 1/z). Relative precision is 1e−13 at the refinement floor,
  and |z| is resolved from 1e−290 to 1e290 (sphere-native section 11).

---

## 8. The forward fallback: SphereMesh (sphere-native backbone)

### 8.1 When

For each role, view kind and area shape whose path is `'forward'` because the shape is ineligible (or `exactImages` is
off), and whose map is still:
- the shape is stretched or unbounded (`Region.bboxOf` null, or larger than 3 windows), **or**
- today's `computeFix` first pass finds trouble: a vertex with a non-finite image, or a triangle still failing the
  relative midpoint test (0.2 × longest edge) at depth 5. **Rev 2:** the test is view-independent (rev 1's "image
  larger than 0.5 px" clause is dropped), so a shape never switches between computeFix and SphereMesh on zoom.

Such a shape runs a SphereMesh job. Otherwise `computeFix` runs as today. While a job runs, today's GPU draw shows.

### 8.2 API (`src/sphere.js`, new; pure JS, node-testable)

```js
SphereMesh.create({
  F,                         // CPU stage map (Funcs.stageFunctions or cpuMap)
  steps, built, a, b,        // for stage-wise limits (8.4); null for homotopy frames (probe at the source)
  shape,                     // Region shape
  win,                       // clipWin
  views: [{kind: 'flat', cx, cy, s, W, H, guard: 3} | {kind: 'sphere', R}],
  Kmax,                      // saturation K for the minimum (hover-dimmed) alpha of the shape
  pattern: {kind, cell, origin, sphN},
}) -> mesh
mesh.step(msBudget) -> {done, partial}    // runs at most msBudget ms; resumable; cancellable by the caller
mesh.publish() -> {pos: Float32Array (x,y per vertex, relative to origin), attr: Float32Array (4 per vertex),
                   tri: Float32Array (1 per triangle: area scale), order: 'far-to-near', origin: [x, y],
                   pos3?: Float32Array (globe), guardBox: {x0,y0,x1,y1}}
mesh.setView(i, view)     // P6: re-queue rules of 8.8
mesh.stats(), mesh.bytes(), mesh.dispose()
```

### 8.3 Data

These are the structures of sphere-native 6.1, production versions:
- **Vertices** in SoA typed arrays: z and u = 1/z as float64 pairs, a unit 3-vector, the image w, its status
  (FIN/INF/UNDEF), the level and its status, and the primary chart.
- **NVB nodes**: a, b, c, child, state, quiet counter, depth D.
- **Edge hash**: an open-addressing typed table keyed by min·2²² + max, holding the midpoint vertex, clip vertex and
  jump verdict.
- **Binary heap** keyed by D, FIFO on ties.
- **Coverage** per view: Uint8 counts per pixel centre (flat) or per cube-map cell (globe, 6 × 256²), a pyramid of
  "cells below K", the number of unsaturated cells nU, and per-row Fenwick counts.

### 8.4 Algorithm and constants

- **Mesh.** Base octahedron with poles 0 and ∞ and equator |z| = 1. Conforming newest-vertex bisection with geodesic
  midpoints normalize(P_a + P_b), each mapped back through the z chart (P.z ≤ 0) or the u chart.
- **Vertex status.** F is evaluated **stage by stage** (lead graft, `notes/proto/lead/sphm_lead.js` `stagewise`):
  - a step whose input is ∞ uses its catalog limit at ∞ (`atInfOf`): Möbius a/c, recip 0, powers ∞ or 0, z^i UNDEF,
    exp and trig UNDEF;
  - a step that is non-finite at a finite input p is classified by a two-ring probe of that step alone, at radii
    1e−6·|p| and 1e−9·|p| (relative to |p|); **at p = 0 the radii are absolute, 1e−3·eps** (rev 2 wording, as
    `sphm_lead.js` `probeStep` does);
  - custom formulas use the probe.
- **Leaf decision chain.** Exactly sphere-native 6.3 (pseudo-code there; `processT` in the prototype), with these
  constants:

| test | constant |
|---|---|
| chord deviation at the 3 edge midpoints and the centroid | 0.3 px (flat), 0.3 globe px (chordal × R) |
| image edge | 64 px; 24 px for boundary leaves |
| boundary-midpoint deviation, pattern deviation | 0.5 px |
| source feature resolution (P_SRC) and depth reference (P_REF) | 12 and 4 left-view px |
| cull | samples off one side by max(2, emax/2) with dev ≤ 0.3·emax; view-centred chordal cap for images around ∞; guard 3× |
| saturation | K = Kmax (8.2), capped at 16; pixel-centre counts; commit lag 0.5 octave |
| quiet rule | 32 consecutive NVB levels whose ring pieces add nothing |
| precision floor | \|Δ\| ≤ 1e−13·\|coord\| in the leaf's chart, or \|coord\| < 1e−280 |
| budgets | 300k live nodes and 1.5 s CPU per mesh; 1.5M **live** nodes across all meshes (rev 2: live, not cumulative); at expiry draw leaves with dev ≤ 2 px |

### 8.5 Saturation

As sphere-native section 8:
- **Rim shrink and chord growth** of the tested zone.
- **No centroid fallback.**
- **Count give-back** when a counted leaf splits, and re-queue of its SAT neighbours.
- **Global saturation**: when nU = 0, every pending leaf becomes SAT. This bounds exp(H) and e^{1/z}.
- **Injective chains** (`Funcs.composeProps(...).injective`) skip saturation (lead graft).

### 8.6 Order

Sphere-native's own D: octaves beyond the window plus octaves below 4 px (6.2 there). It needs no singular-point
table, which fits ineligible chains. Draw order is D descending, then source y ascending (the 5.2 tie rule).
**Front sheet per sample (13.22).** In a flat view, when the chain has an inverse plan, the draw orders the sheets by
the inverse path's own key per fragment (5.1's D from clipWin, R, rs and the plan's accumulation set P; ties 5.2):
gl.js `drawPreMapped` writes it as the fragment's depth and draws in the order above with the depth test (LEQUAL), so
the front layer of every sample is drawn last. Chains with no plan keep the order above.

### 8.7 Output and draw

CPU pre-mapped triangles (layout frozen here; E5 produces it, E3 consumes it):
- `aPos` = w − w₀ (float32), with w₀ the view centre at upload; re-upload when the view centre moves more than 1e4
  view widths or the zoom changes by 2¹².
- `aAttr` (vec4) holds the active pattern's per-vertex coordinates, reduced per triangle: Cartesian (z − Q)/cell with
  the triangle offset a multiple of 10 cells; polar with arg unwrapped from the first vertex and both coordinates
  reduced by multiples of 16; sphere (θ unwrapped, λ); source phase.
- `aTri` holds the area scale.

New programs `regionP` and `regionSP` in gl.js use `REGION_VS`'s `'pre'` variant (positions straight from `aPos`; no
chain, no BARY, no midpoint test) and the `PATTERN_SRC('fwidth')` body fed from varyings.
`GLR.createPreMesh(data)`, `GLR.drawPreMapped(res, st)`, `GLR.destroy(res)`. **Rev 2:** pre-mapped meshes have their own
GPU budget (64 MB, LRU, counted in `preBytes`), separate from the TF cache's `cacheBytes`, because they cannot be
recreated from GPU state.

### 8.8 Jobs, slicing, view changes, export

- **Jobs.** One job per key (shape, role, viewKind, mapKey, viewKey, Kmax, patternKey) on `fixJob`'s machinery: 5 ms
  slices, `rest()`, `fixBusy()` pause, LED `busy`. **Rev 2:** each job has its own token; `scheduleFix()`'s global token
  bump does not cancel a job whose key is unchanged (another shape's mesh or a morph slider no longer restarts it).
  A published mesh replaces the GPU draw and fix-ups for that shape, role and view kind.
- **First version (P5).** Rebuild on settle after a map change, a `clipWin` change, or a right-view zoom by more than
  2×. Pans within the 3× guard band need nothing. This is idle work and affects only ineligible unbounded scenes, which
  get their own settle units (12.5); no existing perf unit uses one.
- **Display during a rebuild (rev 2).** Today's GPU image is drawn, and the old published mesh is drawn over it
  clipped to its `guardBox` (scissor/stencil); outside the guard the GPU image shows. No blank rings on zoom-out, no
  full pop back to the broken image.
- **Hover dimming.** Kmax is computed for the dimmed α (α/2), so hovering the shape list neither reruns jobs nor shows
  translucent infinitely-sheeted images.
- **P6.** Incremental pans and zooms (sphere-native 12.2), warm start, idle coarsening.
- **Export (rev 2).** See 10.6: an async `prepareExport` runs the jobs for the export views before `renderOff`.
- **Memory.** LRU over meshes, 64 MB CPU in total.

### 8.9 Watertightness

NVB closure leaves no hanging vertices. Edge midpoints, clip points and jump verdicts are cached per edge key, so both
sides read the same float64 value and the same float32 rounding relative to w₀. What is not drawn (culled, saturated,
sub-pixel gaps across confirmed jumps, quiet fans) is omitted on purpose (sphere-native 13). The T-junction check
(incremental `tjunc.js`) is a unit test (12.3).

### 8.10 Grafts and later improvements

| graft | from | when |
|---|---|---|
| stage-wise limits | lead | P5 |
| catalog cut constraints: split along arg(G_{k−1}(z) − p) = θ like a level set, one-sided limits, no jump bisection | lead / sphere-native P5 | P6; target sqrt-slit nodes ÷ 5 |
| T-junction checker and two-colour crack test | incremental | tests |
| deferral (key + 1 for nearly saturated candidates) | incremental | only if P5's perf gate needs it |

---

## 9. Lines

### 9.1 P4: reach and singular points, on settle only (rev 2)

**Motion frames keep today's samples.** During pans, zooms, parameter scrubs, drags and morphs, `lineKey` stays
shapeKey + clipWin (as today) and lines use today's fixed-in-source samples, so a scrub never resamples, re-uploads
or re-caches a line.

**Settle-time refinement.** After interaction settles, the idle fix path (time-sliced, 5 ms slices, cancellable)
builds a refined line resource per curve and swaps it in. It is keyed by the shape key, `clipWin` and the
**structural** singular points (0, ∞, lattice origins, poles rounded to 1e−9 of the window size), so small parameter
changes reuse it.
- **Reach.** `Region.curvesOf(s, win, {reach: 'sphere'})`: long curves (lines, rays, half-plane boundaries, unbounded
  sector rays) are clipped to `expandBox(win, 1e28)` instead of `expandBox(win, FAR)`. The geometric tails (ratio
  1.035) then run toward the new ends, **stopping where the CPU stage map leaves 1e19** (float32 overflow beyond it
  drops the pieces anyway: z², exp). The default `{reach: 'far'}` keeps every other caller (labels, integrals, hit
  tests, targets) as today.
- **Singular points.** For each point p of `Inverse.singular(plan, clipWin, ['undef', 'branch', 'pole'], 16)` that
  lies within one sample step of a curve segment, insert samples at distances δ_k = step·1.035^{−k} from p on both
  sides, down to 1e−30·R. p itself is excluded. The GPU midpoint test drops the piece across p.
- **Caps.** At most 8,192 samples are inserted per curve, prioritised by the distance of their singular point to the
  window. With the 16-point cap of 3.7, tan of H (about 230 lattice poles on Im z = 0 in rev 1) gets at most 16
  refined poles nearest the window.
- **Ineligible chains.** The CPU scans the sampled polyline under F (float64), at most 2,048 evaluations per curve
  per settle. A non-finite value, or a jump with midpoint deviation above 0.25 × chord, marks a singular point,
  located by 40 bisection steps.
- **Formula contours** that end on the stretched mesh's outer box continue as rays along their last segment's
  direction (reach as above).

Bounded curves away from singular points get the same samples as today, so golden strokes cannot move.

**P4 review fixes (2026-10-20).** These supersede "motion frames keep today's samples" above.
- *One kind of stroke.* A new `lineKey` (a shape drag or edit, a new clipWin) is refined at once in `shapeGPU` if it
  fits the frame: 6 ms during a drag, 8 ms otherwise, judged by the shape's last refinement cost. Only a shape that
  does not fit draws today's samples, and the settle job swaps it later. Parameter scrubs keep their lineKey.
  `r.polys` keeps today's samples for labels, chevrons, fits and hit tests. `r.lpolys` holds the drawn samples.
- *Dash arcs* (`Lines.arcs`): a long polyline (a sample farther than 50 R from the window centre) measures its arc
  from the point nearest the window centre, accumulating outward from that point. A bounded one keeps its first
  sample. Reach tails (1e19 in the image, 1e28 in the source) are past float32's resolution of a dash period.
- *Run stops.* A tail, or a run inserted toward a singular point, ends once every map is done with it. A map is done
  when it leaves 1e19, when its image stops moving, or when it has wrapped: its image chords have turned more than
  2.5π. With the wrap stop, z^i(H) has 1,222 segments, against 977 today and 2,172 before the fix.
- *Unresolved ends.* A long curve ends at the first run of 3 segments whose image is unresolved under every map
  (midpoint deviation > 0.25 × chord), with both ends outside `expandBox(win, 4)`. Examples are exp of a vertical
  line, sin and cos. A single unresolved segment, such as a pole crossed far out, is kept.
- *Export:* `prepareExport` refines every pending line first (`refineAllNow`).

**Pile-ups (P2 gate round 1, 13.14; `LINE_VS`, cached flat lines).** Where a map compresses a curve into a point (exp
toward 0, a Möbius map toward the image of its pole), thousands of whole segments lie within a pixel and each drew its
first piece there: in the default example 4,588 of 6,636 boundary segments on the two pixels at w = ±1, 5 ms of a 9 ms
pan frame at dpr 1, the same in the pre-sphere app. A segment wholly within a quarter pixel whose start shares its
quarter-pixel cell with the previous segment's start is culled: a run keeps one dot per cell it passes (a third of a
pixel apart at most, each more than two pixels across), and its long neighbours cap against it (the existing join rule).
Strokes change only at pile-ups (a dot with its normal anti-aliased edge instead of a blob of thousands of saturated
layers); the refinement above inserts samples toward singular points, which this keeps cheap.

### 9.2 P6: the CPU image-metric curve sampler (optional)

This is sphere-native's `lines.js`:
- two charts (z = a + t·d and z = a + d/τ);
- accept when dev ≤ 0.3 px and length ≤ 48 px; cull off-view (1.5× guard);
- stroke saturation; quiet rule of 24 levels toward UNDEF; float64 floor.

The output is pre-mapped polylines drawn through `createLines(polys, w₀)` with the `'local'` fetch (`line0`). Dash arc
lengths come from the CPU points. It is view-dependent and re-sampled on settle. Use it only when P4's sampling shows
defects in practice.

---

## 10. App integration (`src/app.js`)

### 10.1 State and hooks
- `S.exactImages` (default true; `sanitizeState` makes it a boolean).
- Test hooks inside `TEMP-DEBUG-HOOK` blocks:
  - `__cmwPaths()` → `[{id, role, viewKind, path, reason}]`;
  - `__cmwSet('exactImages', bool)`;
  - `__cmwForceForward([ids])` → `pathOf` returns `'forward'` for those shape ids (mixed-path tests, 12.4 (c));
  - `__cmwSphereW(x, y)` → w under a Sphere-view pixel (for 12.4);
  - `__cmwGuard()` → the cost guard's state per pane (12.5).

### 10.2 `drawScene(pane, map, role, opt)`

Fills loop, per area shape in list order. **Rev 2:** the inverse branch comes before the `if (!r.meshRes) continue`
check, so thin or empty-mesh shapes still reach it; `GLR.packShapes(list)` runs once per frame before the loop.

```js
const path = pathOf(s, map, role, 'flat');
if (path === 'inverse') {
  const res = GLR.drawInverse({ map: normalizeMap(map), viewKind: 'flat', view: pane.view, dpr: pane.dpr,
    shapeRec: recs.get(s.id), look: lookOf(s, alpha), inv: invPrep(map, s), scissor: scissorOf(s, map, pane),
    half: guard.half(pane) });
  if (res === 'drawn') continue;          // 'pending' | 'error': fall through to the forward draw this frame
}
const r = shapeGPU(s);
if (!r.meshRes) continue;
// forward: today's code (drawRegion + fix-up extras), or the SphereMesh draw when a published mesh matches
```

`invPrep(map, s)` caches `Inverse.prepare(plan, {win: clipWin, shape: s, sing})` by (plan key, step parameter
values, `clipWin`, `shapeKey(s)`). Its cost is O(ops) for affine prefixes (0.01–0.02 ms measured) and up to a few ms
for `imageBox` (3.8). On a frame whose prep work would exceed 4 ms in total, the shapes whose `imageBox` could not be
refreshed draw forward for that frame; they are bounded shapes, whose two renders agree (2.4).

### 10.3 `sphereView` and the left globe

In image mode, the globe draw iterates the shapes in list order and calls `drawInverse({viewKind: 'globe', ...})` or
the forward globe draw per shape (rev 2: merged, not a separate list). The left globe (`S.leftSphere` at
`leftStage() > 0`) does the same with role L.

### 10.4 Fix-ups and jobs

- **Rev 2:** fix-ups for a role run whenever **any visible consumer** of that role draws a shape forward: the flat
  pane and the globe of role R, and the left plane and the left globe of role L. `fixTargets()` skips a shape for a
  role only when every visible consumer of that role draws it inverse (or pending). This keeps today's fix-ups for the
  Sphere view in P2 (inverse there only from P3), for a pending or failed `invS` while `inv` is ready, and for role L
  before P3.
- Ineligible shapes keep `computeFix` when bounded and clean, and start SphereMesh jobs (P5) otherwise (8.1).
- A failed inverse compile calls `scheduleFix()`.

### 10.5 Morph and transitions

- **Paused frames normalise (rev 2, P2).** `normalizeMap(map)`, before `pathOf`:
  - mode 1 (`{hi: k, t}`): t = 1 → `{mode: 0, a: map.base || 0, b: k}`; t = 0 → `{mode: 0, a: map.base || 0, b: k − 1}`;
  - mode 2 (`{a, b, t}`): t = 0 → `{mode: 0, a: map.base || 0, b: map.a}`; t = 1 → `{mode: 0, a: map.base || 0,
    b: map.b}`;
  - any other paused t stays mode 1/2 (forward).
  It applies only while the morph is not playing and no transition runs, and only for steps whose homotopy satisfies
  H₀ = id and H₁ = f (unit-tested per catalog type, 12.1 (k)). So the transport open and paused at a step boundary
  shows the exact image, and closing it does not pop.
- **Playing** morph and transition frames go forward, unchanged. A transition's last frame (t = 1) is mode 0 already;
  an optional 120 ms cross-fade from the last forward frame to the inverse image hides the change (P6).
- Paused frames at other t: fix-ups or SphereMesh under the existing `'M…'` key until P6's invertible homotopies.

### 10.6 `renderOff` and figure export (rev 2)

- **`prepareExport(views)`**: async, time-sliced (5 ms), cancellable by token. For the export's scaled views it runs
  the SphereMesh jobs of forward shapes that need them and waits (via `GLR.onReady`) for the inverse programs those
  views use. The figure dialog shows its progress and cancels on any option change. Meshes are cached by export view
  key, so caption edits reuse them; the dialog's preview uses the screen-resolution meshes.
- **Then** `renderOff` runs synchronously, as today, with the published meshes. `GLR.syncCompile` is set only around
  the programs that are still missing at that point (normally none), not for the whole export.
- `buildFigure`'s theme switch and the global view swaps stay inside the synchronous `renderOff`; no slice ever runs
  while they are in effect.

### 10.7 Thumbnails and the gallery

- `renderThumb` and `renderExampleThumb` go through `drawScene`. **Rev 2:** `drawInverse` returning `'pending'` sets
  `framePending`, so `frameStatus().pending` is true, the thumbnail is not cached and `thumbsWaiting` redraws it.
- Side-mode draws use the inverse path only when its program is ready; they never start an inverse compile (4.4). The
  gallery therefore adds no compiles under the live panes.

### 10.8 LEDs

`busy` only while `computeFix` or a SphereMesh job runs. Inverse compile failures never light the error LED (4.4).

### 10.9 Left plane

`renderLeft` → `drawScene(pane, stageMap(k), 'L')`: with k > 0 and an eligible shape, the inverse path draws (0, k]
(from P3; until then `pathOf` answers forward for role L). At k = 0 `isIdent` keeps today's draw.

### 10.10 Context loss

Inverse programs recompile; their failure marks live in `progs` and are cleared with it. SphereMesh GPU buffers are
rebuilt from the CPU store on `onRestore`.

### 10.11 Hover (P6, optional)

For eligible maps, `hoverSearch` lists `Inverse.enumerate(...)` leaves (lvl ≥ 0) inside the left view: exact and
instant. Newton tracking stays for ineligible maps.

### 10.12 The cost guard (rev 2, P2; retargeted to 60 fps, 2026-10-20)

- **Measurement.** With `EXT_disjoint_timer_query_webgl2`: one `TIME_ELAPSED` bracket around a pane's whole frame (from
  before its clear to just before the blit: no render-pass split on Metal), on every 2nd counting motion frame; results
  are read 2–3 frames later; disjoint frames are discarded; the first 4 motion frames of a burst do not count (an idle
  GPU's clock ramp); each reading is the median of the pane's last 3 at the same level. Without timer queries: the
  frame's lag (animation-frame request to callback). Every reading carries the level its frame was drawn at; a reading
  from another level is ignored.
- **Budget: a fixed 60 Hz frame, not the display's.** The perf suite's 60 fps ceiling is a GPU-synchronised frame of
  12 ms (main thread plus GPU, 4.7 ms of headroom in the 16.7 ms frame). Measured on the suite's M4 (13.13), a frame is
  the pane's reading + 2.2 ms (main thread, blit and sync; 1.7–2.9 ms over 17 pans), and the other pane's forward
  redraw at dpr 2 costs about 1.8 ms when it shares the frame: 12 − 2.2 − 1.8 = **8 ms per pane**. When both live
  panes drew inverse passes in the measured frame (from P3: shape drags with `leftStage() > 0`), each gets half.
  Without timer queries: a lag over 1.5 frames of 60 Hz (25 ms) is over budget.
- **Levels and actions**, after 3 consecutive over-budget readings at the current level: level 1, motion frames of the
  pane's inverse passes at half resolution (one RGBA8 half-size target per pane, upscaled bilinearly; drawn only
  within continuous motion, the previous frame of the pane < 45 ms ago, and followed by a full-resolution frame at
  pointer up or 45 ms after the last one); level 2, also the pane's bounded clean shapes forward (the last resort;
  clean: a finite scissor box). Settled frames, thumbnails and exports stay full resolution and exact.
- **Hysteresis.** A level is left only by a probe of the finer one: at the start of a motion burst, at least 4 s after
  the last change, the pane draws one level finer; when its first 3 readings there are all under **5 ms** (frames near
  7 ms, 3 ms under the trip point: the run-to-run swing of one scene's readings with the GPU clock), that level sticks;
  otherwise the coarser level returns at once (at most 3 measured frames) and the next probe waits twice as long (up to
  32 s). Readings between 5 and 8 ms change nothing. Readings are never compared across resolutions (an Apple GPU lowers
  its clock on cheaper frames: half readings rise within a pan), only with these absolute thresholds.
- **Prediction (P2 gate round 1, 13.14).** Every live frame, `predictLevel` (app.js) sums `GLR.inverseEstimate` over the
  pane's inverse passes: their device pixels (the scissor box when one is known) × (0.3 + 0.45 L) ms per Mpx, L the
  leaves the walk visits per pixel (the stop op K + 1, or B + 1 under the tail rule; every other op its whole budget;
  calibrated on the suite's M4 at full clock, 13.14). Over `HALF_EST` = 2.2 ms the pane's floor is level 1
  (`guard.setFloor`): its level never drops below it, probes stop at it, readings at it can still raise the level (a
  slower GPU), and a level the floor raised follows it back down. At dpr 2: exp(H) / z^i(H) at α 0.5 and 0.3 are 2.5 and
  3.7 ms (half resolution in motion), at α 0.85 1.8 ms and every scene at dpr 1 under 1 ms (exact in motion). Why a
  prediction: the GPU's clock follows its load (13.14), so readings of a heavy pane show the clock, not the work, and
  the measured trip took ~14 motion frames (grace, every 2nd frame, results 2–3 frames late, a streak of 3 medians).
- **Half resolution before the main pass (P2 gate round 1, 13.14).** A half-resolution motion frame draws its leading run
  of inverse passes (list order, from the first shape drawn inverse to the next one that is not) into the half target
  before the pane's main render pass begins (`GLR.beginHalfPre`, `drawInverse` with `halfPre`), then begins the pane
  (`begin`) and upsamples the layer at the run's place (`compositeHalf`). Binding the half target inside the main pass
  ended it: a store and a reload of the multisampled colour and depth, which at dpr 2 cost about what half resolution
  saved. A pass that cannot draw at half resolution yet (`'nohalf'`) ends the run and draws in the main pass.
- **Key.** Scene structure, map key structure, B class and dpr; a new key starts at level 0. Reported by `__cmwGuard()`
  (and `__cmwGuardOpts(opts)` replaces the policy options in tests: `{budget, exit, streak, probeMs, probeMax}`) and in
  the console (at most 4 lines per pane and key).
- (Superseded, P2 review: budget min(4 ms, 25 % of the measured frame interval), demotion before half resolution,
  recovery by 30 / 60 cheap frames. On the M4 at dpr 2 it switched 62–81 % of ordinary pan frames to half resolution.)

---

## 11. Phases

Each phase ends with the app working and passing both regression suites (`test/regress/compare.py`, perf full run
plus quality). A phase may only report IMPROVED in quality and perf; every new scene must meet its own threshold.

### 11.0 Owners (parallel work, separate files and file regions)

| owner | files (regions) | contract with |
|---|---|---|
| E1 inverse | `src/inverse.js`; in `src/region.js` only the new functions `supportOf`, `clipPrimitive`, `convexOf` and the recognizer (appended after `clipLine`); `test/t_inverse.js`, `test/t_inverse_render.js` | E2 (op schema 3.2), E4 (3.1), E3 (`clipPrimitive` ↔ `shapeClip`) |
| E2 GLSL | `src/glsl.js` (`inverse` in `GLChain.build`: `lib`, `walker`, `uInv` allocator, `fill`), `test/glsl_inverse_test.js`, `test/make_glsl_inverse_test.py` | E1, E3 (4.1 names) |
| E3 renderer | `src/gl.js` (`INV_FS`, `drawInverse`, `packShape(s)`/`packShapes`, `shapeClip`, `PATTERN_SRC`, sphere checker, `regionP`/`regionSP`, inverse LRU, cost-guard timer queries) | E2, E4 (4.5), E5 (8.7 layout, frozen in this spec) |
| E4 app and tests | `src/app.js` (all of it, including the line-refinement wiring and `lineKey`), `build.py`, `test/regress/*` scenes and units, CDP checks | everyone |
| E5 fallback | `src/sphere.js`, `test/t_sphere.js` | E3 (8.7), E4 (8.2) |
| E6 lines | in `src/region.js` only `curvesOf`/`sampleCurve` options (their existing bodies); a function `Lines.refine(curves, F, sing, caps)` in `src/region.js` that E4 calls from app.js | E1 (`singular`), E4 |

Phase flags (2.1) live in one table in app.js: `PHASE = {R: {flat: P2, globe: P3}, L: {flat: P3, globe: P3}}`.

### P0: tests first (E4)

- **Work.** Add the quality scenes and metrics of 12.4 and the perf units of 12.5 (including dpr 2). Record the
  baseline on today's code. The new scenes record their current bad values (z^i hole filled, opacity below 1), so the
  coming change shows as IMPROVED.
- **Tests.** Quality and perf baselines re-recorded with the new scenes. The existing scenes' baselines stay
  unchanged.
- **Gate.** Both suites pass against the new baseline on unchanged `src/`.

### P1: the CPU enumerator (E1)

- **Files.** `src/inverse.js`, `src/region.js` (the functions listed in 11.0), `build.py` (load order), node tests.
- **Work.** Sections 3.1–3.10. Port `notes/proto/lead-inv/inverse_proto.js` and `notes/proto/lead-rev/walk.js`; add
  `imageBox` (with the exact Möbius images of generalised discs), singular-point caps, `renderCPU`.
- **Tests.** 12.1. Gate: node tests pass; the suites are unchanged (nothing is wired).

### P2: the inverse renderer, flat, role R (E2, E3, E4)

- **Files.** `src/glsl.js`, `src/gl.js`, `src/app.js`, `test/glsl_inverse_test.js`.
- **Work, in this order.**
  1. **Generated-program benchmark** (4.7); its numbers are recorded in 13.10 before step 3 is merged.
  2. glsl.js: 4.1. gl.js: 4.2–4.5 (flat), `PATTERN_SRC` with the string contract, `packShape`, the inverse LRU and
     error handling (4.4), the cost guard's timer queries.
  3. app.js: `pathOf` with view kinds and phase flags, `normalizeMap`, the `drawScene` integration (10.2), fix-up
     gating by consumer (10.4), `exactImages`, hooks, thumbnails pending (10.7), scissor (4.8), cost guard (10.12),
     `renderOff` with `prepareExport` for inverse programs (10.6).
- **Tests.** GLSL parity (12.2); `REGION_FS` byte-identity; the coefficient-flip program test (12.1 (l)); CDP checks
  12.4 (a)–(e), (l), (m).
- **Gate.**
  - **Quality:** every unbounded scene, new and old, reaches IoU ≥ 0.999 with holes and spill ≤ 0.001 (the tie rows
    of `sq_Q1_out16` and `sqrt_slit_out16` are allowed). Every golden ≤ 0.5 % (expected ≈ 0.01 %). Parity, polar
    parity and opacity thresholds as in 12.4 (mask20 included).
  - **Perf:** 4.7's gates; pan and zoom frame times within tolerance at dpr 1 and within budget at dpr 2; settle times
    equal or IMPROVED; example loads within tolerance (compile order of 4.4); GPU memory equal or IMPROVED.

### P3: globe, left plane, left globe, spherical checker, export (E3, E4)

- **Work.** 4.6 and 10.3; role L flat and globe (10.9); pattern 8 in both shader paths and the pattern menu (6.3),
  with the reviewed `REGION_FS` fixture update (6.1); export with `prepareExport` (10.6).
- **Tests.** CDP 12.4 (f)–(i), (n); spherical checker node test (12.1 (i)).
- **Gate.** The suites, plus the sphere, left-plane and left-globe CDP checks.

### P4: lines reach (E6, E4)

- **Work.** 9.1, settle-time only.
- **Tests.** CDP 12.4 (j); perf unit `scrub.mobius_halfplane` (12.5); t_inverse singular caps (12.1 (f)).
- **Gate.** The suites; the scrub unit shows no resampling during the scrub.

### P5: forward fallback (E5, E3, E4)

- **Work.** `src/sphere.js` (8.2–8.9), `regionP`/`regionSP`, app jobs (10.4) for ineligible shapes, the display rule
  during rebuilds, job keys and tokens (8.8), `prepareExport` for SphereMesh (10.6).
- **Tests.**
  - 12.3, including a forced-forward quality run: every acceptance scene with `exactImages` off reaches IoU ≥ 0.999
    after settle.
  - Perf: `image.custom_e_z1z.m240` (e^{z+1/z} on H) settles within budget, no slice over 6 ms; `image.expexp_H`
    (an unbounded shape forced forward by the outer-family rule) pan and zoom settle units.
- **Gate.** The suites, plus the forced-forward run.

### P6: extensions (any order, each with its own tests)

- invertible homotopies at any t (morph frames exact: `mobHom`, `powHom`, the exp and log homotopies);
- polynomials of degree 3–4 (Cardano/Ferrari plus 2 Newton steps);
- hover exact preimages (10.11);
- anchoring (7);
- the fallback's incremental views and cut constraints (8.10);
- the CPU curve sampler (9.2);
- linear inequalities in the formula recognizer (more formula shapes eligible under window families);
- the transition cross-fade (10.5).

---

## 12. Tests to add

### 12.1 Node, pure JS (`test/t_inverse.js`, `test/t_inverse_render.js`)

(a) **Round trips** (port `notes/proto/lead-inv/t_roundtrip.js`): every catalog type × random parameters, cuts
(including cut ≠ 180°) and sheets k ∈ {−1, 0, 1, 2}, plus the 21 custom formulas, plus (rev 2) powa
α ∈ {15.5, 16, 17.5, 20, −18, 20+0.1i, 20+2i, 0.05+i, 0.01+i} and custom z^{17.5}, with the reference at the
default clipWin centre.
- Assert 0 unsound, 0 missed and 0 decomposition errors on 200 random u per case.
- Assert ineligible exactly: degree-3 polynomial, degree-3 rational, z twice, Re/Im/abs/arg, d/dz, IPOW |n| > 16,
  powa 70 (shape level: 'too many branches').

(b) **Range sign** for ASIN…ATANH, LOG, IJOUK and ROOTPOW: lvl > 1e−9 ⟺ f(pre(w)) = w, over a 200 × 200 grid of w
(away from a 1e−9 band).

(c) **Plans and budgets (rev 2).**
- `key` is stable under parameter changes: dragging α of powa from 1.5 to i keeps it.
- Budgets with the reference at the default clipWin centre, 0 missed samples (port `r1_ranges.js`): exp of a disc at
  60i and tan of a disc at 30 with the left view zoomed out to ±80 × ±100; e^{10z} on a disc at 6.5i with the left view
  out 2×; exp∘exp of a disc of radius 0.1 at 3+0.9i; e^{z²} on discs at 3+3i and 3.3+4.1i; tan∘exp, sin∘exp and
  e^{1/z²} on small off-axis discs; exp(H) with the left view centred at Im z ∈ {−6, −20, −200}.
- Expected verdicts: exp∘exp of H → forward ('unbounded range outside the innermost family'); e^{z²} of a halfplane
  → forward ('unbounded shape through a non-affine prefix'); exp of an annulus too big for the budget → forward.

(d) **Early stop is exact (rev 2).** Port `r2_earlystop.js`: 40 random left views (scale 60–3000 px/unit, centres
within ±0.8 of the scene's centre), K ∈ {1, 3}: e^{1/z} on |z| < 1, exp∘Cayley on |z+i| < 1.5, exp(H), z^i(H),
tan(2z+1) on |z| < 3, and every window family kind (EXP, EXPC, SIN, COS, TAN, SINH, COSH, TANH, ROOTPOW inf) with and
without a trailing AFF/MOB.
- Assert: front K equals the full enumeration where no window is truncated; within 0.01 octave where truncated.

(e) **Completeness fuzz (rev 2).** Port `r1_ranges.js --fuzz`: 14 chains × 4 left-view zooms × 40 random shapes
(disc, rect, halfplane, sector, annulus, polygon, complement) anywhere in ±100, reference at the default clipWin
centre. Assert 0 missed among eligible shapes and report the forward count per chain.

(f) **Singular points.** e^{1/z} → {0}; z^i → {0}; `\log(z-1)` gives branch {1}; Cayley gives pole {−i};
exp → {}; `\tan z` gives poles. Rev 2: tan(H) and tan(1/z) return ≤ 16 points per kind and take < 2 ms per call.

(g) **Reference renderer** (port `render.js` onto `enumerate`): all quality scenes plus z^i, exp(H) and e^{1/z} at
1×, 4× and 16×, in the mask and pattern variants (polar for z^i).
- Assert IoU ≥ 0.9999, holes = spill = 0, and parity ≥ 0.9999.
- Assert z^i: hole leak 0, polar parity 1.0, sheets disagree 0.
- Rev 2: [log, exp], [root 2, z²] and [root 3, z³] on a disc crossing the cut at sub-pixel offsets 0, 0.25 and 0.5:
  interior coverage ≥ 0.99 everywhere (port `r4_twin.js`).
- Rev 2: log of Im z > 1, Re z < −1, Re z > 1, Im z > −1, discs containing and not containing 0, sectors with apex 0
  and 1+i, at 32× and 64× zoom-out: 0 spill, 0 holes (port `r5_lambda.js`).
- Rev 2: mask20 opacity ≥ 0.99 for exp(H), z^i(H) and e^{1/z} (port `r6_lowalpha.js`).

(h) **Golden emulation** (port `golden_cmp.js`): golden_diff ≤ 0.05 % for the 4 bounded controls (measured ≤ 0.011 %).
With the tie rule reversed `disc_cube.pattern` must exceed 0.1 %, which guards the tie rule.

(i) **Spherical checker.**
- log(H) column edges at Re w = ln tan(jπ/16) ± 0.5 px.
- z^i rings at |w| = e^{−jπ/8} ± 0.5 px.
- At Cayley's w = 1 no pixel within 3 px deviates from the average by more than 4/255.

(j) **Shape geometry.** `Region.supportOf` and `clipPrimitive`: random points of each shape lie within the support
for 64 random directions; random lines: every parameter t with z₀ + t q inside the shape lies in [t_lo, t_hi] and
outside the hole; the recognizer handles the examples of 3.8 and clears `convex` on `or`. `imageBox` against dense
sampling (10⁵ points) for 50 random bounded shapes through exp, z², 1/z, tan and log prefixes: never narrower.

(k) **Homotopy end points** (for `normalizeMap`, 10.5): for every catalog type with a homotopy, |H₁(z) − f(z)| ≤
1e−12(1 + |f(z)|) and H₀(z) = z on 1,000 random z; types failing it are excluded from normalisation.

(l) **Program identity under eligibility flips (rev 2, P2, `test/glsl_inverse_test.js`).** Edit poly coefficients
`1, 0, −1, 0` ↔ `1, 0, 0, 5`, rational q `1, 0` ↔ `0, 1`, and a Möbius map through degeneracy, at a constant forward
key: assert the inverse key changes, the program source equals `info.inverse.lib + walker` of the current info, the
forward `uChain` layout is unchanged, and the drawn image is never blank.

(m) **Scissor conservativeness.** 1/z of |z − 1.005| < 1, sqrt∘exp of a disc crossing the cut, and 50 random bounded
shapes: the scissor box contains every image pixel of a dense (10⁵-point) forward sampling.

### 12.2 GLSL parity (headless Chrome; `test/glsl_inverse_test.js`, page built by `test/make_glsl_inverse_test.py`)

- 300 random chains drawn from `glsl_test.js`'s generator restricted to eligible ones, plus all custom formulas of
  12.1 (a), with random parameters, random shapes (for ranges) and random view pixels.
- A test program (the walker with a recording `invLeaf`) writes the first 8 leaves of each test w into an RGBA32F
  target of N × 8 texels: column i is test point i, row r is leaf r, and a texel holds (z.x, z.y, lvl, |J|). They are
  compared with `Inverse.enumerate` in the same order: |Δz| ≤ 2e−3·(1 + |z|) and Δlvl ≤ 0.05 px, skipping members
  within 1e−3 of a cut, a window boundary or a range boundary.
- `shapeClip` against `Region.clipPrimitive` on 10⁴ random lines per kind.
- The early stop gives the same front K as the full scan on the GPU.
- `REGION_FS(false/true)` strings are byte-identical to the fixtures (patterns 0–7 until P3, 0–8 after).

### 12.3 Fallback (`test/t_sphere.js`; port `notes/proto/sphere-native/run_cases.js` and the lead's `run_cases_lead.js`)

- The 40 flat acceptance runs reach IoU ≥ 0.999 with 0 holes and 0 spill.
- The z^i hole is 0/164; polar parity ≥ 0.999.
- p99.9 chord ≤ 0.3 px.
- Nodes and evaluations are within 1.5× of the recorded values, and each case meets its CPU budget.
- 0 T-junctions (incremental `tjunc.js` logic over the published triangles).
- Determinism: the same input gives the same buffers.
- Rev 2: the trouble classification gives the same verdict at 1×, 4× and 1/4× right-view zoom for every quality scene.

### 12.4 Regression and CDP scenes (E4; quality suite plus `test/<name>_cdp` command files)

**New quality scenes**, with exact truth in `scenes.js`:

| scene | map, region | views | truth |
|---|---|---|---|
| `zi_H` | powa(i, 180°, 0) of H | (0, 0, 190), out4, out16 | e^{−π} < \|w\| < 1 (only members with −ln\|w\| ∈ (−π, π]); sdf = min(\|w\| − e^{−π}, 1 − \|w\|) |
| `expH` | exp of H | (0, 0, 60), out16 | w ≠ 0; sdf = \|w\| |
| `e1z_disc` | [recip, exp] of \|z\| < 1 | (0, 0, 60), out16 | w ≠ 0 |
| `e1z_custom` | custom e^{1/z} of \|z\| < 1 | (0, 0, 60) | w ≠ 0 |
| `exp_far_disc` (rev 2) | exp of \|z − 60i\| < 1, left view zoomed out to ±80 × ±100 | (0, 0, 60) | the image of the disc: w is inside iff some member Log w + 2πim lies in the disc (exact, m = 9 or 10) |
| `ez2_disc` (rev 2) | custom e^{z²} of \|z − (3+3i)\| < 0.3, default left view | fitted to the image | exact by `pre` |
| `healed_cut` (rev 2) | [log, exp] of \|z + 1\| < 0.6 | (−1, 0.5 px, 150) | the disc itself |

**New variants and metrics.**
- `polar`: pattern polar. `truth.parityAll(w)` is defined because every sheet has the same parity there:
  ⌊Arg w·16/2π⌋ + ⌊−ln\|w\|·16/2π⌋ mod 2. It is scored on all fill pixels with cells ≥ 3 px and ≥ 1.5 px from a
  cell edge.
- `mask85`: solid at α = 0.85, with `opacity_min` = min over interior fill pixels of the fill fraction along
  plane → c0, expected ≥ 0.99 for z^i, expH and e1z.
- `mask20` (rev 2): solid at α = 0.2, `opacity_min` ≥ 0.99 for zi_H and expH.
- `hole_leak` (info): fill pixels with \|w\| < e^{−π} − 2.5 px.

**CDP checks** (inverse path unless stated):
- (a) z^i(H) at default zoom: hole leak 0; polar parity ≥ 0.999; annulus empty-pixel count 0 outside the band.
- (b) `__cmwPaths()` shows `inverse` for every eligible scene and `forward` with the expected reason for: d/dz,
  `z^2+1/z`, a degree-5 polynomial, a playing morph, exp∘exp of H, a 70-vertex polygon, a fifth formula shape.
- (c) Mixed scenes.
  - A disc (bounded) and H (unbounded) under z^i, both inverse, α = 0.85: where they overlap, pixel colours equal the
    CPU composite of the two in list order (`Inverse.renderCPU` per shape, then over), within 3/255.
  - Repeat with the disc forced onto the forward path (`__cmwForceForward`). List order still holds across the two
    paths, and the disc's own pixels differ from its inverse render by ≤ 0.5 % (golden_diff metric).
  - Repeat both on the globe (rev 2: merged list order).
- (d) Compile gap: right after adding a step, a frame with `frameStatus().pending` shows the forward image; within 2 s
  it is replaced by the inverse image; no frame is blank. The step thumbnail drawn during the gap is redrawn.
- (e) `exactImages` toggled off and on: forward and inverse images of the bounded golden scenes differ by
  ≤ 0.5 % golden_diff.
- (f) Sphere view z^i(H): 400 globe samples inside the hole cap are globe-coloured; 400 annulus samples are fill;
  Cayley at the north pole has no notch (via `__cmwSphereW`).
- (g) Left plane with focus on step 2 of [z^i, z²]: the left plane (stage 1) matches the CPU render of z^i(H), IoU
  ≥ 0.999.
- (h) Figure export at 300 dpi of z^i(H) equals the on-screen render scaled, IoU ≥ 0.999; toggling a dialog option
  during `prepareExport` cancels it and never blocks the main thread for more than 50 ms.
- (i) Spherical checker selectable; the log(H) columns as in 12.1 (i), on the GPU.
- (j) Strokes (P4): after settle, for logH_out16 the boundary-stroke pixels reach within 2 px of both view edges; z^i
  of ∂H draws both circles over ≥ 99 % of their circumference.
- (k) Fallback crack test (P5): the inverse switched off, the forward mesh drawn in one colour over black: interior
  pixels not covered = 0 (incremental's two-colour test).
- (l) Paused morph (rev 2): z^i(H) with the transport open and paused at T = 0 and at the end: the image equals the
  inverse image of the corresponding stage (IoU ≥ 0.999), and closing the transport changes no pixel by more than
  3/255.
- (m) Sphere view in P2 (rev 2): with the flat path inverse and the globe still forward, the Sphere view's fix-ups run
  (its image is today's, not worse).
- (n) Left globe (rev 2, P3): `S.leftSphere` at `leftStage() = 1` of [z^i, z²] shows the exact annulus on the globe.

### 12.5 Perf units (perf suite)

- `image.ziH.m240`, `image.expH.m240`: statics, `panR`, `zoomR` in/out, settle; **at dpr 1 and dpr 2** (rev 2).
- `image.disc_cube.dpr2` (rev 2): an existing bounded golden scene at dpr 2.
- `sphere.ziH`: orbit.
- `swiftshader.ratio` (rev 2, separate runner with `--use-angle=swiftshader`): pan-frame p50 of the bounded golden
  scenes, inverse/forward ratio ≤ 3 with the guard active.
- `scrub.mobius_halfplane` (rev 2, P4): scrub a Möbius parameter with a half-plane boundary; asserts no line
  resampling or re-upload during the scrub and frame times within tolerance.
- `examples.load` (existing) also records inverse compile and first-draw times; `gallery.open` (rev 2) records
  compiles started (expected 0 for side chains).
- `image.custom_e_z1z.m240` and `image.expexp_H` (P5): the fallback's settle, slices, and pan/zoom settle.
- `hover.dim` (rev 2): hovering the shape list on expH runs no SphereMesh job and no compile.
- Existing units unchanged. Expected: right-plane settle 0 ms, GPU memory lower, frame times within tolerance.

---

## 13. Prototype verification record

Lead prototypes are in `notes/proto/lead-inv/` (rev 1) and `notes/proto/lead-rev/` (rev 2), run with `node` from the
project root. `gpu_bench_cmd.js` runs through a CDP daemon (`test/leadinv_cdp`).

### 13.1 Catalog audit (`t_roundtrip.js`)

104 eligible step cases: every type of `Funcs.DEFS` except d/dz, random parameters, cuts and sheets, plus 21 custom
formulas. Result: **0 failing**.
- Soundness residual ≤ 7e−13.
- Candidates per pixel (rev 1 windows): 1–3 for the finite types, 17 for the exp/powa(i)/tan families, 34 for the
  sin/cos/sinh/cosh families (unpruned).
- 3 ineligible as specified.

### 13.2 Inverse rendering, CPU float64 (`render.js`)

Scored with the suite's own `metrics.js` and truth on the app's own `Funcs` and `Region`:
- **All 16 quality scenes × {mask, pattern}** and **z^i(H), exp(H), e^{1/z} disc × {1×, 4×, 16×} × {mask, pattern}**:
  IoU **1.00000**, **0** holes, **0** spill, checker parity 1.00000.
- **z^i(H):** hole 0/164; polar parity 95,760/95,760 with 0 disagreeing sheets.
- Renders in `out/` (`zi_H.pattern.png` is the clean polar checker on the annulus).
These scenes all have their windows at the reference; rev 2's ranges contain rev 1's covering members for them, so
the numbers carry over (re-measured in P1 by 12.1 (g)).

### 13.3 Early stop, rev 1 (`scan_cost.js`)

0 front-K mismatches with the left view centred at the scene (5 scenes × 52k pixels). The review showed off-centre
views fail with a Möbius prefix; see 13.9 for rev 2.

### 13.4 Golden emulation (`golden_cmp.js`, results in `golden_cmp.txt`)

| control | golden_diff |
|---|---|
| `disc_cube` | 0.000 % |
| `joukowski` | 0.000 % |
| `poly_mobius` | 0.000 % |
| `annulus_log` | 0.011 % |

Tie rule reversed: `disc_cube.pattern` 0.293 %.

### 13.5 Real GPU, float32 (`gpu_bench_page.js`)

The table of 4.7 (hand-written shaders: lower bounds), plus the z^i read-back: hole 0/148, annulus 0/111,272 empty.

### 13.6 Spherical checker (`sphere_checker.js`)

Renders of log(H), z^i(H), Cayley(H) and exp(H) (`out/sph_*.png`) as described in 6.3.

### 13.7 Fallback re-run (`notes/proto/lead/run_cases_lead.js`: sphere-native plus stage-wise limits)

| case | CPU ms |
|---|---|
| z^i(H) default / out4 / out16 | 267 / 73 / 31 |
| exp(H) | 188–337 |
| e^{1/z} | 486–773 |
| sqrt slit | 335–356 (cut constraints not yet effective) |

All flat runs: IoU 1.0000, 0 holes, 0 spill. Globe runs take 1.0–4.4 s in the prototype; the cube map is projected to
cut that (estimate).

### 13.8 Designers' prototypes relied on

- inverse-first: float32 emulation identical to float64 on all acceptance chains; deep-zoom anchoring table; facing
  rule; coverage-union measurements.
- sphere-native: 40 flat runs and the sphere runs; profile showing F evaluation is 1–3 % of the cost.
- incremental: T-junction checker; bugs found (inside-snapping at cuts, mixed-chart units, late splits).

### 13.9 Revision 2 prototypes (`notes/proto/lead-rev/`)

`walk.js` is the CPU twin of the revised walk (ranges, budgets, cursors, stop rules, Möbius centre). Outputs are in
`r*_out.txt`.

| script | what | result |
|---|---|---|
| `r1_ranges.js` | the reviewer's window-miss cases (p1), p7's walker cases, p3's ROOTPOW cases | 0 missed in every eligible case (rev 1: up to 100 %); budgets 4–35 for bounded shapes; powa 15.5–20+2i: 15.5–20.3 leaves/px, 0 missed; powa 0.01+i: radial window of 17, 0 missed; powa 70 → forward (73 > 64) |
| `r1_ranges.js --fuzz 40` | 14 chains × 160 random shapes in ±100 × 4 zooms, reference at the default clipWin centre | 0 missed among eligible shapes (e^{z²} and powa 17.5 contribute almost no samples here, because their random far shapes map outside 1e−12 < \|w\| < 1e12; the targeted rows above cover them). Forward by rule: exp∘exp 104, e^{z²} 103, tan∘exp 125, e^{1/z²} 54, e^{1/z} 17, exp∘Cayley 11 (unbounded shapes through non-affine prefixes and outer unbounded ranges); 0 for the single-family chains. Ill-conditioned float64 samples skipped (tan near ±i, sin and exp∘exp far out) |
| `r2_earlystop.js` | 40 random left views, K = 1/3 | rev 1 rule: e^{1/z} 1.23 % / 0 %, exp∘Cayley 7.36 % / 6.46 % mismatches. Rev 2: e^{1/z} 0 / 0 (5.1 / 7.4 leaves/px); exp(H) 0 (3.0 / 5.0); z^i(H) 0 (3.2 / 5.2); tan(2z+1) 0 (3.4 / 5.0); exp∘Cayley 0 outside truncated windows, 1.3 % / 2.1 % inside them with front-key gap ≤ 0.0004 octave |
| `r4_twin.js` | healed cuts at offsets 0, 0.25, 0.5 px | rev 1: 174 interior px at coverage 0.75 / 0.5; rev 2 twin merge: 0 (min 1.000); log(H) and z^i(H) controls unchanged |
| `r5_lambda.js` | Λ rule at 32× and 64× | rev 1: 46–150 px spill; rev 2: 0 spill, 0 holes |
| `r6_lowalpha.js` | α = 0.2 opacity | exp(H) 0.832 → 1.000; e^{1/z} 0.972 → 1.000; z^i(H) 1.000 → 1.000 |
| `r7_prepcost.js` | `prepare` cost per shape | clip: 0.008–0.017 ms; box: 0.07–2.3 ms (unoptimised) |

### 13.10 Generated-program benchmark (P2, step 1; measured 2026-10-20)

Compile, link, first draw and per-pass cost of the generated `INV_FS` (glsl.js `inverse.lib` + `walker`, gl.js
`INV_HEAD` + `INV_MAIN`, drawn by `GLR.drawInverse`: no hand-written GLSL). Apple M4, headless Chrome 155, ANGLE Metal
and SwiftShader (Vulkan 1.3, LLVM 10); no Windows machine (lead decision: D3D11 stays unmeasured). Pane 410 × 516 CSS
px (the suites' right pane), dpr 1 and 2 (820 × 1032); globe: the whole globe in view. Records:
`test/inv_bench_results/{metal,swiftshader_dpr1,swiftshader_dpr2_bounded}.json`; rerun with `test/inv_bench_cmd.js`
(page `dist/inv-bench.html` from `test/make_inv_bench.py`, script `test/inv_bench.js`).

**Method.** Pass cost = marginal frame cost: (median frame with 6 back-to-back passes − median frame with none) / 6,
frames synchronised by a 1-pixel `readPixels`, 20 interleaved reps (SwiftShader 3). GPU timer queries are not used for
the record: on ANGLE Metal a query splits the render pass and its reading includes the pass's load and store (a null
pass "takes" 1.7 ms at dpr 2 after a clear; after other draws, as in `drawScene`, the reading is 0.3–0.7 ms above the
marginal cost; the bracket itself costs nothing per frame). Compiles are cold: a uniform nonce in the program text
(comments are stripped by ANGLE's translator, and macOS caches compiled Metal libraries system-wide, across browser
processes, so a repeated program compiles warm even in a fresh Chrome).

**Per-pass cost** (ms, α 1 / α 0.85; budgets N of `Inverse.prepare` per op, innermost first):

| scene | N | flat dpr 1 | flat dpr 2 | globe dpr 1 | globe dpr 2 | SwiftShader flat dpr 1 |
|---|---|---|---|---|---|---|
| z^i(H) | 17 | 0.45 / 0.53 | 1.33 / 1.95 | 0.67 / 1.03 | 1.93 / 2.97 | 29 / 38 |
| exp(H) | 17 | 0.33 / 0.33 | 0.83 / 1.35 | 0.42 / 0.70 | 1.22 / 2.02 | 25 / 39 |
| e^{1/z}, unit disc | 1×17 | 0.48 / 0.65 | 1.85 / 2.63 | 0.97 / 1.35 | 2.85 / 3.97 | 53 / 57 |
| sin, half-strip (formula shape) | 4 | 0.30 / 0.27 | 0.97 / 0.92 | 0.40 / 0.40 | 1.08 / 1.10 | 36 / 36 |
| 3-op chain: affine, exp, exp of a disc | 1×4×4 | 0.30 / 0.27 | 0.98 / 1.00 | 0.50 / 0.52 | 1.42 / 1.50 | 55 / 57 |
| 40-vertex polygon under exp | 4 | 0.30 / 0.20 | 0.77 / 0.78 | 0.25 / 0.22 | 0.60 / 0.62 | 30 / 26 |
| formula strip \|Im z\| < 1 under exp | 4 | 0.20 / 0.15 | 0.65 / 0.60 | 0.42 / 0.37 | 1.12 / 1.07 | 27 / 25 |
| disc_cube (z³), golden | 3 | 0.15 / 0.12 | 0.43 / 0.42 | 0.27 / 0.27 | 0.73 / 0.77 | 16 / 17 |
| joukowski, golden | 2 | 0.15 / 0.08 | 0.38 / 0.38 | 0.22 / 0.20 | 0.57 / 0.60 | 13 / 15 |
| annulus_log, golden | 1 | 0.05 / 0.05 | 0.22 / 0.17 | 0.15 / 0.20 | 0.32 / 0.38 | 6 / 7 |

SwiftShader at dpr 2, α 0.85: disc_cube 111 ms, joukowski 65, annulus_log 26 per pass (its whole forward pan frames
are 55–115 ms at dpr 1, P0 values: the ratio gate of 4.7 holds before the guard acts).

**Compile and first draw** (Metal, cold; GLSL ≈ 45–50 KB, translated Metal ≈ 100–140 KB):

| scene | compile + link | ready (background) + first draw, flat dpr 1 α 1 | all 8 cold rows |
|---|---|---|---|
| z^i(H) | 25 + 142 ms | 134 + 195 = 329 ms | 323–356 ms |
| exp(H) | 27 + 123 | 130 + 124 = 254 | 254–287 |
| e^{1/z} | 28 + 139 | 141 + 153 = 294 | 294–331 |
| sin, half-strip | 27 + 136 | 138 + 138 = 276 | 276–318 |
| 3-op chain | 33 + 140 | 146 + 160 = 306 | 306–555 (one outlier) |
| 40-vertex polygon | 28 + 129 | 133 + 126 = 260 | 260–291 |
| formula strip | 21 + 127 | 131 + 129 = 259 | 259–305 |
| disc_cube | 28 + 114 | 112 + 80 = 191 | 191–216 |
| joukowski | 22 + 114 | 109 + 76 = 185 | 185–211 |
| annulus_log | 11 + 104 | 112 + 87 = 200 | 198–219 |

The background compile never blocks a frame; the first draw does (ANGLE builds the Metal pipeline then: a 75–205 ms
stall of the GPU process). Warm (any later compile of the same program on the machine, also in a new browser): ready
+ first draw 20–45 ms. SwiftShader: compile + link 7–14 ms, first draw 0.44–1.2 s (its LLVM JIT; forward programs
behave alike there).

**What the first measurements showed, and what is now built in.** The first generated program with the spec's B = 8
cost 2–4× the rev 1 hand-written shaders at dpr 2 (exp(H) α 0.85: 3.08 ms, e^{1/z} 5.15 ms, the 40-vertex polygon
2.6 ms). Elimination profiling found the causes; each fix keeps the images bit-for-bit or provably equal:
1. **B by K class.** The compositing buffer lives in registers across the whole walk; its size dominated (exp(H) dpr 2:
   B 8 1.98 ms, B 5 1.25, B 3 0.93). Admission only ever inserts at positions < K + 2, so B is now K + 2 of the shape's
   own (undimmed) α, rounded up to a class: **3** (α ≥ 0.999), **5** (K ≤ 3: α ≥ 0.842), **8** (K ≤ 6: α ≥ 0.6),
   **16**. One variant per scene (S.alpha is global); hover-dimmed draws keep it with K capped at B (4.2's rule).
   Entry colours are packed into one uint (8 bits per channel, what the RGBA8 target keeps).
2. **Möbius-prefix centre:** every distinct candidate member evaluated once, in the CPU's order, keys compared as
   products 2^D (no logs, same argmin): e^{1/z} 2.35 → 1.9 ms.
3. **Bounding-box early-out** for polygons and bounded formula shapes: a candidate outside the box by more than two
   pixel footprints has coverage 0 whatever its exact distance: 40-vertex polygon 2.6 → 0.8 ms.
4. **Smaller programs:** one clip-piece call per loop, loop bounds the compiler cannot unroll where unrolling only
   multiplies code (`uIxOne`), compile-time features from the op list (`IX_LAM`: Λ code only when op 0 is LOG or
   ROOTPOW; `IX_MOB`: the Möbius centre and stop only after an AFF/MOB prefix with a MOB), one central-difference call
   site for formula shapes: cold compile + first draw disc_cube 212 → 191 ms, exp∘exp 315 → 306 ms.
5. Already in the design and now implemented: shading on admission (the pattern costs < 0.25 ms at dpr 2), scissor
   (`GLR.scissorOf`), half resolution in motion (`st.half`: an RGBA8 half-size target upscaled bilinearly; verified),
   and the cost guard (`GLR.CostGuard`, timer queries via `GLR.timer`).

**Gates (4.7).** Frame-time gates: the largest inverse pass at dpr 2 is 2.6 ms flat (e^{1/z}, α 0.85) and 4.0 ms on
the globe (the same), within the guard's budget (then min(4 ms, 25 % of the frame interval); 8 ms per pane since 13.13) on the suite's machine; at dpr 1
every pass is ≤ 0.65 ms flat (≤ 1.35 globe). SwiftShader ratio: the bounded golden passes cost 6–17 ms against forward
frames of 55–115 ms. **Compile + first draw ≤ 250 ms holds warm (20–45 ms) and cold for the bounded controls
(185–220 ms), not cold for the unbounded scenes (254–356 ms).** The further cuts available are program variants per
pattern (measured −35 to −50 ms cold) or per set of shape kinds in the scene; each adds a compile and a first-draw
stall when the pattern or the set of kinds changes, so they are left to the lead (open question 7, section 14).

### 13.11 P2 app integration (E4; measured 2026-10-20)

`src/app.js` wires role R flat (`PHASE = {R: {flat: true, globe: false}, L: {flat: false, globe: false}}`): `pathOf`
(2.2, with `o.status` for fix-up gating and hooks), `normalizeMap` (10.5), the `drawScene` branch (10.2: records packed
once per scene draw, inverse before the `meshRes` check, list order across paths), fix-up gating by consumer (10.4:
`fixTargets()[i].need(s)`), `S.exactImages` (default true, sanitized, no visible option), hooks (`__cmwPaths`,
`__cmwForceForward`, `__cmwSphereW`, `__cmwGuard`, `__cmwInvBox`, `__cmwDrawn`, `__cmwLook`), thumbnails (10.7), the
scissor (4.8), the cost guard (10.12) and `prepareExport` before `renderOff` (10.6, inverse programs only until P3/P5).
CDP command files: `test/p2app_cdp/cmd/`.

Decisions taken while wiring (shapes go forward by rule, with reasons):
- **Scissor box**: `Inverse.imageBox` over the whole op list in Re and Im (rigorous disc enclosures, then a refinement
  at 1/64 of the first hull), instead of adaptive boundary sampling: cuts and folds inside the shape are covered by
  construction. 12.1 (m): 49 shapes (1/z of |z - 1.005| < 1, sqrt∘exp across the cut, 47 random shapes under 10
  chains) 0 points outside; 3 shapes with a pole inside get no scissor.
- **Prep budget** (10.2): past 4 ms of `prepare` in a frame an uncached bounded shape draws forward for one frame; the
  scissor box waits past 2 ms (no scissor that frame).
- **Thumbnails never start an inverse compile** (gallery images already did not): a thumbnail compile during a
  playing deformation stalled it and compiled programs no pane needed (`examples.5`). A thumbnail drawn forward while
  the panes' program compiles is not cached; the inverse readiness is part of its signature.
- **Cost guard measurement** (the policy is `GLR.CostGuard`'s): the TIME_ELAPSED bracket opens before the pane's clear
  (a query that begins inside a Metal render pass splits it: readings 1.3-5 ms above a 2.0 ms pass at dpr 2) and covers
  clear, grid and fills; only counting motion frames are bracketed, every 2nd (a bracket still splits the pass where it
  ends: +1-2 ms per measured frame in paired runs, 0 now on still frames); the first 4 motion frames after a pause do not
  count (an idle GPU's clock ramp: 8 ms readings); each reading is the median of the last 3; the display interval is the
  shortest recent rAF interval. Demotion takes all bounded clean shapes of the pane at once (clean: a finite scissor
  box); half-resolution motion frames are followed by a full one at pointer up or 45 ms after the last one. On the busy
  suite machine z^i(H) at dpr 2 still trips the guard while panning (readings 4-7.5 ms; marginal pass 2.0 ms).
- Pre-existing app bug fixed: a `requestRender` inside a frame plus `again` started a second frame chain (every frame
  drawn twice during the fit tween after a step transition).

Renderer fixes found by looking at the images (gl.js): the twin merge compared gradient angles from `atan(y, -0.0)`,
which ANGLE Metal returns as +pi/2 (now `carg`), so [log, exp] across a cut through pixel centres showed a half-covered
line (`healed_cut.mask` hole 0.00104, now 0); the analytic pattern magnifies footprints below 1e-6 cells about the
nearest cell edge, so a sheet compressed onto a cell corner (the far end of log(H)) shows its cells, not the average.

Results: CDP 12.4 (a) hole fill 0/112, annulus empty 0 (fill only) for mask/pattern/polar/mask85/mask20 and out4,
out16; (b) every eligible scene inverse, the seven forward reasons as expected; (c) GPU vs `renderCPU` composite in
both list orders: max 1/255 over 921 interior overlap px, disc forced forward golden_diff 0.0047 % / 0; (d) forward
stand-in while compiling, inverse within 0.5 s, no blank frame, step thumbnail redrawn; (e) golden_diff <= 0.072 %
for the 8 bounded golden runs, switching back restores identical bytes; (l) paused at the end: 0 fill pixels change
when closing (141 px of ghost outlines), at T = 0 the identity draw (agreement 1.0); (m) Sphere view fix-ups identical
to `exactImages` off. Quality suite: PASS, 23 improved, 0 failed; the unmet P2 targets are all `zi_H*` and all lie on
the boundary stroke's chords (radius 0.93-0.99 of the outer rim: the line renderer's pieces next to the singular point
z = 0, P4). Perf, paired: full run 11 FAIL / 94 IMPROVED before the measurement changes above; re-runs of the failing
units after them pass except `image.ziH.m240.dpr2.redraw_ms` (6.25 -> 9.7 ms: the exact z^i pass at dpr 2, within the
D8 budget) and, in some runs, its pan/zoom p95 (+2 ms). SwiftShader ratio 0.38-1.01 (limit 3). GLSL parity (12.2)
passes after the fixes.

### 13.12 P2 review fixes (measured 2026-10-20)

The P2 review (math, perf and integration lenses; findings and verdicts in section 15 "P2 review") was worked through
in `src/inverse.js`, `src/glsl.js`, `src/gl.js` and `src/app.js`. Reproductions and the measurements below are command
files in `test/p2fix_cdp/cmd/` (the reviewers' own command files re-run against this build where they exist); a
reviewed-P2 snapshot (`p2.html`) was A/B'd in the same browser. Node tests: `test/t_p2fix.js` (new) and additions to
`test/t_gl_inverse.js`, `test/t_inverse_render.js`; GLSL parity: a new `anchors` section in `test/glsl_inverse_test.js`.

**Saturation anchors (artanh / arctan).** When the op nearest z, behind affine ops only (AFF, or a Möbius step with
c = 0), is ATANH or ATAN, its members carry the offset from their anchor, tanh w − (±1) = −2s e/(1 + e) with
e = exp(−2sw), s = sgn Re w (tan w = −i tanh(iw)), its logarithm (no underflow at any |Re w|) and d(log offset)/dw.
`Inverse.prepare` gives each anchor p = (±1 − B)/A the shape's local model there (exact within a radius m of p): sure
inside/outside; a cone of two straight boundary rays through p (half-planes, rect sides and corners, polygon edges and
vertices, convex or reflex, sector rays and apex); or a circle through p evaluated as (K − 2v₀·δ − |δ|²)/(r + |v|),
K = r² − |v₀|² from float64 (discs, annuli, sector arcs); past float32's range the tangent cone. A formula boundary
through an anchor is not eligible ('a saturation point of the map lies on a formula boundary'). The pattern of an
anchored leaf is taken relative to the cell corner nearest p (plus its integer shift, after the sub-pixel
magnification), and log z = log p + log(1 + δ/p) with its polar cell corner. CPU and GPU share the models
(`Inverse._anchor`, gl.js `ixAnchorPx`, compiled only in programs with an ATANH / ATAN op: `IX_ANC`).
- artanh / arctan of the unit disc against the exact strip (reviewer's `truth.js`): 0 pixels over 0.25 error at
  s = 60, 40, 27, 20, 10 (P2 build: 0, 0, 80, 2,199, 3,219 for artanh; 2,482–5,289 for arctan).
- GPU vs `renderCPU` with checker / polar patterns, incl. the reviewer's seed 19 ([artanh, joukowski], complement of a
  triangle, polar, α 0.5, 4× out): max difference ≤ 7/255, 0 pixels over 24/255 (P2 build: 465 over 24/255).
- GLSL parity `anchors`: 5,120 points far out in the strips (|Re w| to 40) for 8 shape kinds and 5 chains: 0 leaf
  coverage mismatches; exact strip 0 of 345 (negative control without anchors: 108 of 342 wrong).
- Quality: `atanh_D_s20/s10`, `atan_D_s20/s10` IoU 1, holes 0, spill 0; `.mask85` opacity 0.85 everywhere (one sheet;
  the P2 build: IoU 0.42–0.55, opacity 0). Their truths, `cube_far_deep`'s and `zi_H_polar85`'s are checked
  independently by `test/regress/quality/verify_truth.js` (forward rasterisation where float64 resolves the strip,
  |Re w| ≤ 16; tanh / tan with the principal-branch round trip at every pixel centre; the app's own steps), and its
  `--selftest` scores their ideal renders perfectly.

**Compositing past the buffer; B classes 3 / 5 / 8.** The register buffer is the pass's main cost; B = 16 (α < 0.5)
cost 2–4× a forward frame. B is now 3 (α ≥ 0.999), 5 (α ≥ 0.5), 8; the front B sheets are composited exactly and the
covering candidates the buffer does not keep (rejected or dropped) enter through their exact transmittance (`ixTr`),
coloured with the buffer's mean; for the own α with K > B the early stop is off (`uKall`), so the opacity is exact for
any number of sheets (z¹² of a disc at α 0.2: 1 − 0.8¹² where the old tail rule gave 1). Their share of the light is
(1 − α)^B: 0 for α ≥ 0.67, ≤ 3.1 % at α 0.5, 5.8 % at α 0.3. Marginal pass, dpr 2 (13.10 method, same browser, the
reviewed P2 build first):

| scene | α 1 | 0.85 | 0.7 | 0.5 | 0.3 |
|---|---|---|---|---|---|
| z^i(H) | 1.40 → 1.43 | 2.02 → 2.08 | 3.28 → 2.35 | 8.38 → 3.37 | 10.8 → 4.97 |
| exp(H) | 0.87 → 0.90 | 1.43 → 1.50 | 3.25 → 1.95 | 10.25 → 3.08 | 14.47 → 5.50 |
| e^{1/z} disc | 1.90 → 1.95 | 2.68 → 2.78 | 4.73 → 3.22 | 12.62 → 5.15 | 16.93 → 7.78 |
| disc_cube | 0.45 → 0.48 | 0.45 → 0.45 | 0.60 → 0.45 | 1.08 → 0.45 | 1.07 → 0.60 |
| 40-vertex polygon, exp | 0.75 → 0.80 | 0.75 → 0.78 | 0.92 → 0.77 | 1.20 → 0.77 | 1.20 → 0.88 |
| sin half-strip | 1.00 → 1.07 | 0.95 → 1.00 | 1.32 → 1.02 | 2.08 → 1.00 | 2.08 → 1.28 |

(α 1 and 0.85: +0–7 %, ≤ 0.07 ms, the cost of the critical-value and anchor plumbing; a per-leaf critical check cost
0.05 ms and moved to admission.) Perf units `image.{ziH,expH}.a50.dpr2`, `.a30`, `.a30.dpr2` (new).

**Opacity changes and new chain structures.** A B class whose program is compiling, or ready but never drawn while
the view is in continuous motion (`st.motion`: a drag, a tween, a transition, a playing morph, a wheel, a range slider's
input, a held key, or a scrub of changes 150 ms apart; not a hover or a single discrete change such as loading an
example), is replaced by another ready, warm class of the same program (a larger one is exact, a smaller one
composites its rest through ixTr) instead of the forward stand-in; ready programs are warmed (a draw into one pixel
with a real pass's state, `GLR.warmInverse`) at the next quiet moment (polled every 100 ms) and the panes redraw. The reviewer's slider
drag 0.9 → 0.3 over a fresh structure (cold compiles): P2 build 2 stand-in periods and frames of 167 / 183 ms; now 0
stand-ins, 0 frames over 34 ms. During a step transition (forward homotopy frames) the program of the stage it ends on
compiles (`requestInverseFor`), so the last frame is exact: no forward stand-in after the transition (P2 build: 333 ms
of stand-in). The first draw's Metal pipeline build (~200 ms cold, 20–45 ms warm) now falls on the transition's last
frame: it is the first-draw cost of open question 7, not removable from WebGL. (13.13: no longer on any frame: the
program is warmed at the first idle moment after the transition, the forward stand-in showing meanwhile.)

**Cost guard** (budget and order superseded by 13.13; the measurement stands). (1) The TIME_ELAPSED bracket spans the whole pane frame up to the blit: no render-pass split (the
+1–2 ms per measured frame, and the right pane's brackets during left-plane drags); the reading now includes the grid
and strokes. (2) Without timer queries the reading is the frame's lag: notched wheel input (80 ms apart) no longer
demotes, a 30 ms busy main thread still does. (3) Key with the B class; recovery rules (10.12). (4) Half resolution:
one batch per pane (one target bind, clear and scissored upsample of the union of the passes' boxes); 4 z^i half-planes
at dpr 2: full 7.7 → half 3.5 ms per frame (P2 build: half 12.3 vs full 10.5); a program's first half-resolution draw
builds another pipeline, so it is warmed at a quiet moment and draws full resolution until then. Half resolution is
not withdrawn on timer readings: Apple GPUs lower their clock on cheaper frames, so half readings rise within a pan
(2.3 → 5.7 ms for one z^i(H) pass at dpr 2) while the frames stay cheaper; a withdrawal rule (8 half readings at
≥ 97 % of the full median) was built and removed after it fired falsely in the paired gate (z^i(H) dpr-2 zoom
frames p50 4.1 ms at half → 9.0–9.7 ms at full resolution). (5) Half only within continuous motion: 10 wheel notches 80 ms apart draw 10 full frames (P2 build: alternating
soft / sharp); a continuous pan draws half. `half_passes` (info) in the perf units.

**Patterns.** The polar near-origin fade is skipped where Λ is exact (analytic chain only; REGION_FS byte-identical):
z^i(H) polar at α 0.85 / 0.5 / 0.2: light cells (140, 171, 229) = c1, steps within a cell ≤ 1 (P2 build: 9/255 seams,
c1 never reached). New quality runs `zi_H_polar85.polar85/.polar50` with the metric `cell_err` (RGB distance from the
true cell colour): p99 1 / 0 (P2 build 12.4 / 34.1). The analytic checker filter is the ramp clamp(2q/w) around the
nearest cell edge (exactly UTIL's box filter for w < 1, without its cancellation), so deep zooms keep exact colours;
the sub-pixel magnification runs only above the float32 resolution of the cell coordinates.

**Deep zoom.** z³ of |z − (3+3i)| < 0.5 on the image of its boundary point (pixels wrong against the exact image,
coverage error > 0.5 / checker parity of the front member): the forward mesh's straight chords are off by 2–8 px at
these zooms, so the inverse path stays (a precision demotion to forward was built, measured and removed):

| s | forward: coverage / parity | inverse: coverage / parity |
|---|---|---|
| 2e4 | 1,242 / – | 48 / – |
| 3e4 | 1,506 / 219 | 113 / 0 |
| 1e5 | 3,304 / 570 | 563 / 65 |
| 3e5 | – / 15,345 | – / 531 |

Quality scene `cube_far_deep` (s = 3e4): IoU 0.9999, parity 0.99976, colour_off 0.0006 (P2 build: colour_off 0.996).
The remaining inverse error past ~5e4 is the float32 quantization of z (sawtooth of a few px); P6's anchoring
generalised to every op kind is the cure.

**Critical values at a pixel centre.** A non-finite du/dw (float32 has an exact 0 there) makes the range levels after
it sign-only and shades with the moiré average (coverage by the region's sign was already ixFromGrad's); the float64
twin also treats footprints past 1e12(1 + |z|) as critical. sin and cos of discs at w = 1: the pixel equals its
neighbours (P2 build: black). (z² and z³ at w = 0 at α 0.85 show the axes' crossing under the translucent fill: not a
defect.)

**renderCPU parity.** Source phase: the GPU's formula through `GLR.phaseRGB` (the LUT texels, bilinear) when gl.js is
loaded; the sub-pixel magnification of the analytic patterns is ported (t_p2fix (5)).

**Parameter scrubs.** During interaction only the coarse pass of the scissor box runs (a conservative enclosure),
refined on the first quiet frame. Eight 60-vertex polygons under a disk automorphism: main-thread time per scrub frame
p50 / p95 / max 4.7 / 5.5 / 9.4 → 2.1 / 2.8 / 5.0 ms (exact images off: 1.0 / 1.4 / 2.6).

**Affine Möbius steps.** A Möbius step with c = 0 is affine in `prepare` (exact clip ranges and the affine stop):
exp(2z + 1) of H was forward ('unbounded shape through a non-affine prefix'), now inverse (C \ {0}, t_p2fix (7)).

**Perf suite.** New units: the opacity variants above, `examples.cold` (the examples with inverse programs loaded with
cold inverse compiles, `GLR._src.coldCompiles`; info, for open question 7), `half_passes` per image unit,
`swiftshader.ratio.*.inv_share_on`.

**Paired gate (reference: the pre-sphere snapshot; `results/paired-20261020-*`).** The quick run (065049) failed 16
metrics; each was re-run (3 reps) or explained:
- `examples.{2,3,6,8}.inv_first_draw_ms` 245–401 ms and their `settle_ms`: the first run after the shader text
  changed compiles every inverse program cold in the system's Metal cache (the harness disables Chrome's own caches);
  the numbers equal `examples.cold` (215–360 ms; 13.10: 254–356 for P2). Re-run (070614): 37–66 ms, settle within
  ±5 % of the P2 gate's runs (P2: 33–65 ms). Open question 7 unchanged.
- `image.{default,chain4,logUHP}.m240` frame / latency p95s: one rep of two each; re-run (3 reps): pass.
- `image.ziH.m240.dpr2`: the re-run showed zoom frames p50 9.0–9.7 ms where the quick run had 4.1: the half-resolution
  withdrawal rule had fired on DVFS-inflated readings; removed (above). Re-run (071805): pan / zoom p50 6.0–6.2 ms,
  p95 9.1–10.9, settle 32–36 ms, in line with the P2 gate's runs (5.2–7.1 / 8.2–10.0 / 32–37); against the reviewed P2
  build in the same browser, alternating (`pan_ab.js`, 3 × 3 reps): pan p50 4.9–8.3 vs 5.8–8.3 ms, p95 9.2–11.1 vs
  9.6–11.1. The remaining FAILs against the forward mesh are P2-E2's (the exact pass at dpr 2 costs more than the mesh).
- The opacity units (new): against the reviewed P2 build (paired, `--ab` the P2 dist, 3 reps) `image.ziH.a50.dpr2`
  frames p50 / p95 −22 to −38 %, `image.ziH.a30.dpr2` −26 to −32 %, `image.expH.a50.dpr2` −19 to −23 %, redraw −22 to
  −36 %; against the forward mesh they stay above it (P2-E2).
- `image.disc_cube.dpr2.redraw_ms` 6.05 → 8.2 ms (pre-sphere) is a bimodal median (samples 4.3–10.6 ms, the
  reference's 3.6–9.7); against the P2 build: pass. `image.expH.m240.dpr2`, `image.chain4.m1920` (P2-E8's panL: p50
  11.0 → 8.0 ms), `sphere.default` (orbit p95 13.7 → 11.0 ms): pass.

### 13.13 P2 finish: the 60 fps rule (measured 2026-10-20)

The user's rule (2026-10-20): "60 fps is enough". Frames only have to stay comfortably inside 60 fps; image quality is
not traded for 120 Hz budgets. `test/regress/compare_perf.py` encodes it: a frame, latency, jank or throughput metric
worse than its relative tolerance still passes inside the absolute 60 fps budget (frame ≤ 12 ms, latency ≤ 40 ms,
longest frame after input ≤ 20 ms, ≥ 55 frames/s while dragging). Command files: `test/p2fin_cdp/cmd/`
(`lib.js` helpers; `passbench.js` marginal pass cost by page variant, 13.10's method; `patab.js` pixel A/B of two
builds; `mguard.js` pans with guard readings; `concpan.js` a cold compile during a concurrent pan; `guard_half.js`,
`guard_probe2.js` the guard's levels and probe in the app; `orbit.js`, `seq.js`, `panl_blits.js` the sphere and panL
checks).

**The interrupted optimisation (kept).** Its edits in `src/gl.js` were complete: (1) the polar and log-radius pattern
coordinates are computed only for the patterns that read them (2, 5; 6), (2) the area-scale log2 |det| only for
pattern 7, (3) the twin-merge angle only for partial candidates (an entry with full coverage never merges). Pixel A/B
against the gate's `gl.js` (5 scenes × 8 patterns × α 1 / 0.5, 80 renders): identical except rounding where the
compiled order of the same expressions differs: the source-phase pattern ≤ 1/255 (≤ 1,744 px), the polar web ≤ 1/255,
except atanh_D_s20's polar web, 552 px up to 19/255 in the far tail of the strip, where the cell coordinates are below
float32 resolution and both images are rounding noise there (visually the same blob). GLSL parity passes. Pass cost:
−2 to −6 % on this session's benches (the fixer measured −10 to −15 % for z^i(H) at dpr 2).

**Admission for B = 8** (α < 0.5; new). At α 0.3 up to 17 covering candidates per pixel reach admission, and admission
(position scan, insertion shift, shading) was 63 % of the pass (exp(H) α 0.3 dpr 2: 6.1 ms, 2.3 ms with admission
replaced by a count; the scan alone 1.1 ms). For B = 8 a candidate that cannot merge with a twin, while the admission
limit is the buffer's end, now takes a short path: behind the last entry of a full buffer it is rejected with one
comparison, otherwise it is inserted from the end (entries behind it move back one slot, up to the first entry in
front of it: one comparison for the walk's key-ordered arrivals). Candidates that may merge (partial and bound) take the
old scan. The buffer is the same: pixel A/B against the previous build, 8 scenes (zi_H, expH, disc_cube, healed_cut,
e1z_disc, logH_out4, zi_H_out16, atanh_D_s20) × 3 patterns × α 1 / 0.85 / 0.5 / 0.3 / 0.2: 120 renders, 0 pixels
differ. B = 3 and 5 keep the scan (the short path measured 4–10 % slower there). Marginal pass, ms (gate build /
this build, same browser, 2 rounds):

| scene, dpr 2 unless noted | gate | now |
|---|---|---|
| z^i(H) α 1 / 0.85 / 0.5 / 0.3 | 1.62 / 2.30 / 3.67 / 5.37 | 1.60 / 2.24–2.34 / 3.53 / 5.34 (4.8–5.4) |
| exp(H) α 0.85 / 0.5 / 0.3 | 1.69 / 3.30 / 5.92 | 1.64 / 3.24 / **4.35** |
| exp(H) α 0.3, dpr 1 | 1.63 | **1.14** |
| disc_cube | 0.42 | 0.41 |

**The cost guard against a fixed 60 Hz frame** (10.12). Pans at full resolution with the guard measuring only
(`__cmwGuardOpts({budget: 1e9})`), 3 reps of the suite's pan legs, M4 (frame = GPU-synchronised, ms, p50 / p95;
reading = the pane's bracket):

| scene | frame | reading | frame − reading (p50) |
|---|---|---|---|
| z^i(H) α 0.85, dpr 2 | 8.9 / 13.1 | 6.7 / 10.8 | 2.2 |
| z^i(H) α 0.3, dpr 2 | 9.0 / 12.0 | 7.2 / 9.0 | 1.8 |
| exp(H) α 0.3, dpr 2 | 8.6 / 12.6 | 6.9 / 10.8 | 1.7 |
| exp(H) α 0.85, dpr 2 | 8.0 / 10.6 | 6.0 / 8.5 | 2.1 |
| disc_cube, dpr 2 | 4.1 / 5.8 | 2.1 / 3.5 | 2.0 |
| exp(H) α 0.3, dpr 1 | 6.1 / 8.7 | 4.3 / 7.1 | 1.8 |
| z^i(H) α 0.85, dpr 1 | 5.6 / 7.7 | 3.6 / 5.4 | 2.0 |

Over 17 pans (these and two more runs at budgets 9 and 8) the frame exceeds the reading by 1.7–2.9 ms (mean 2.2): the
budget is 12 − 2.2 − 1.8 (the other pane's forward redraw at dpr 2 when it shares the frame) = **8 ms** per pane, and
the exit 5 ms. The same scene's readings swing 2–3 ms between runs with the GPU clock (z^i(H) α 0.85 dpr 2: p50 6.7,
6.5, 5.2 ms in three runs), the reason for medians, 3-reading streaks and the 3 ms hysteresis band. With 8 / 5 no
scene of the suite trips on the M4 (old guard: 62–81 % of the motion passes of the dpr-2 pans were half resolution);
`half_passes` is 0 in the paired runs below. In the app (`guard_half.js`, `guard_probe2.js`, budget forced to 0.3 ms):
level 1 trips, the half pipeline is warmed after 1 s without motion while the pointer hovers, the next pan draws 74 half
passes with no frame over 21 ms (an unwarmed upsample program stalled the first half frame 251 ms: it is now warmed
with the half pipelines), the probe at the next burst draws level 0 and returns to it. A first half frame that could
not draw half (pipeline cold) draws full resolution; the half pipelines are warmed only after 1 s without motion
(drags, wheels, sliders, scrubs; hovering does not count): the 080638 gate's 117 ms wheel latency was a half warm-up
landing between two wheel gestures. The timer poll reads `GPU_DISJOINT_EXT` (a synchronous round trip to the GPU
process) only when a result is available, not on every frame.

**First draw of a new program (pre-warm).** Live frames never draw a program that was never drawn (4.4): the forward
stand-in (or a warm B class) shows and the program is warmed at the first idle moment (`GLR.warmInverse`, one pixel
with a real pass's state), then the panes redraw. A cold compile (`GLR._src.coldCompiles`) during a concurrent pan
(`concpan.js`: a middle-button pan of 2.5 s, the action 190 ms in):

| action during the pan | longest frame in the pan, before / after | stall after the pan ends (idle) | exact image after the pan ends |
|---|---|---|---|
| example 7 (square root, sheets) | 220–310 ms (the cold first draw, in the pan) / 9–17 ms | 214–275 ms | 377–471 ms |
| example 6 (sine, half-strip) | 158–182 ms / 17–22 ms | 168–183 ms | 340–394 ms |
| add a step (sine / tangent, after a fresh chain) | 226 ms (the transition's last frame) / 9–12 ms but forward first draws | 200–230 ms | 435–443 ms |

(Adding a step also shows 44–77 ms frames at the transition's start in some runs: forward homotopy programs' first
draws, no inverse draw in them; the pre-sphere reference shows them too, 64–75 ms, depending on the system's Metal
cache.) The reference never stalls after the pan (it has no exact image to build). Cold numbers, `examples.cold`
(compile + first draw, ms, before = the 080638 gate / after): see the paired runs below. The warm-up moves the
pipeline build out of frames; it does not make it shorter (open question 7 unchanged).

**The 080638 / 083029 gate failures under the 60 fps rule.**
- (a) `sphere.default` orbit: P2 adds no work there. A CPU profile of 4 orbit reps has 0 samples in any P2 function
  (pathOf, packShapes, invPrep, guard, timer, warm); `drawSphere`, `drawRegion`, `drawLines`, `begin`, `blit` and
  `init` are byte-identical to the pre-sphere source. Paired re-runs: 13.5 → 9.9 ms p95 (alone), 12.1 → 13.0 (after
  chain4), 12.7 → 12.1, 13.9 → 13.2; in one browser alternating with the reference, after the m1920 unit, p50 / p95
  10.1–10.2 / 11.4–14.0 against 11.0–12.4 / 14.0–14.4. The earlier failures follow unit order and machine load.
- (b) `image.expH.a30` zoomR: in latency p95 117 → 25.6 ms (reference 23.4), out settle 64 → 0 ms: the stall was a
  half-resolution warm-up between two wheel gestures (the old 4 ms budget tripped at dpr 1); no trip now, and half
  warm-ups wait for 1 s without motion.
- (c) `image.expH.a30.dpr2`: with the new guard and before the B = 8 admission path: panR p95 11.6 / 13.4 / 13.2 ms,
  zoomR.in latency 43 / 41 / 34 ms (three paired runs): at full resolution this scene sat on the 12 ms ceiling; the
  B = 8 path takes 27 % off its pass (above).
- (d) `image.default.m1920.panL`: L-only frames (the left plane at stage 0 draws as before); the right pane redraws
  on about 10 frames per leg in both apps (a follow-up of the left view), with the exact pass in P2. Paired:
  13.6 / 13.2 / 13.6 ms against 11.2 / 13.6 / 11.5; in one browser alternating: 12.3 / 12.3 against 15.3 / 15.8.

**Paired runs of the final build** (`results/paired-20261020-145526*`: the 14 units P2 moves; `-150533*`: `--quick`;
`swiftshader-p2fin.json`). The machine slept with its lid closed from 12:01 to 14:11 (runs then were discarded) and ran
on battery before, on AC after; the reference's dpr-2 frames dropped from 7–10 ms to 4–7 ms with AC power while the
inverse frames did not (the exact pass's in-situ cost, below).
- Units: FAIL 7, IMPROVED 69, PASS 464. The 7: dpr-2 frame p95 at 12.0–13.3 ms against the 12 ms ceiling,
  `image.expH.a30.dpr2` panR / zoomR.out (13.3 / 13.2), `image.expH.a50.dpr2` panR / zoomR in / out (12.7 / 12.4 /
  12.8), `image.ziH.a30.dpr2` zoomR.in (12.2), `image.ziH.m240.dpr2` zoomR.out (12.0); their p50 are 7.9–11.1 ms and
  every latency is ≤ 31.6 ms, fps ≥ 52. `half_passes` 0 in every unit (the old guard: 62–81 %). (b) passes: expH.a30
  zoomR.in latency 23.1 ms (reference 23.3), zoomR.out settle 0. (a) sphere.default orbit p95 14.4 → 9.9 ms (IMPROVED);
  (d) default.m1920 panL p95 13.2 → 11.3 ms (pass; p50 IMPROVED). Example loads: first frame and settle within
  tolerance; GPU memory 25–89 % lower.
- `examples.cold`, compile + first draw (ms, before = gate 080638 / after): example 2 236 / 260, 3 233 / 247, 4 243 /
  243, 6 335 / 340, 7 381 / 393, 8 251 / 266. Unchanged within 5–25 ms (the warm-up moves the pipeline build out of
  frames, it does not shorten it; open question 7 unchanged).
- `--quick`: FAIL 1 (`image.logUHP.m1920.panL` p95 10.4 → 13.0 ms: left-plane frames at stage 0, which P2 does not
  touch; the same metric of `image.default.m1920` passed, IMPROVED or failed by 2 ms in four pairs, i.e. noise),
  IMPROVED 35, PASS 459.
- SwiftShader ratio (inverse / forward pan p50, limit 3): disc_cube 0.48, joukowski 0.58, annulus_log 0.42, poly_mobius
  0.50, with 95–98 % of the passes inverse (the gate's run demoted disc_cube to 11 %): the fixed 60 Hz budget and half
  resolution first keep SwiftShader exact.
- Why exact dpr-2 frames sit near 12 ms at α ≤ 0.5: with the pass removed (`passx.js`) a z^i(H) α 0.85 dpr-2 pan frame
  costs 4.8–5.9 ms (less than the reference's 6.2–6.4, which draws the mesh); one pass adds 3.3–3.5 ms and a second one
  only 1.4 ms: the first pass of a frame costs about 1.5 × its marginal cost (the GPU clock between synchronised
  frames), and the slowest frames of a gesture are its first ones after an idle GPU. The guard leaves them at full
  resolution by design (8 ms per pane: inside 60 fps); half resolution would not fix the gesture's first frames either
  (they draw at full resolution before the guard has readings), as the gate's 083029 run showed (p95 12.3 ms with 81 %
  half passes). Lowering the budget to 7 ms is the lead's alternative.

**`test/t_cx_stable.js`** (flaky: an unseeded check failed 1 run in 61 at 1.37e-13 against 1e-13). Its random points
now come from a seeded generator (mulberry32), and the "unchanged elsewhere" tolerances are scaled by the old
formulas' own rounding error, which is what the comparison measures: the pre-P2 asin / asinh lose log10(1/|w|) digits
near 0 and the old tan loses log10(1/|cos 2x + cosh 2y|) near its poles. Measured over 4e6 unseeded points:
rel(new, old) ≤ 7.3 ε (1 + 1/|w|) (asin, asinh), ≤ 3.5 ε (1 + 1/|cos 2x + cosh 2y|) (tan); the bounds are 16 ε and 8 ε
(tighter than 1e-13 in the bulk). 300 seeds: 0 failures.

**Tests.** Node: all `test/t_*.js` pass (t_gl_inverse 246: the guard's levels, budget, share, exit, probes, gaps and
key); GLSL parity (`glsl_inverse_cmd.js`) passes; glsl-test 0 failures, glsl-test-adv 591 (as at the gate, the
reference has 601), gl-test 0 bad pixels. Quality suite: PASS, 0 failed, 23 improved; the unmet P2 targets are the
z^i(H) runs only (boundary-stroke pixels, P4).

### 13.14 P2 gate round 1: the GPU clock, exact stops, half resolution before the pass, line pile-ups (measured 2026-10-20)

The P2 gate (paired runs 153950 and 160443) failed 8 frame p95 metrics in both runs, all over the 12 ms ceiling:
`image.expH.a30.dpr2` and `image.expH.a50.dpr2` pan / zoom in / zoom out, `image.ziH.a30.dpr2.zoomR.out`, and
`image.default.m480.panR` (dpr 1). Command files: `test/p2r2_cdp/cmd/` (`pl.js` helpers; `ablate.js` pan / zoom frames
with parts of the frame disabled or replaced, interleaved with the reference; `px.js` k inverse passes per frame;
`pb.js` marginal pass cost, 13.10's method; `cb.js` the same per frame component; `patab.js` pixel A/B of two builds;
`halfshot.js` a mid-drag half-resolution frame against the settled one; `m2.js` per-frame zoom traces with the
half-resolution flags; `lineana.js` the default example's line segments).

**Why the frames sat on the ceiling: the GPU's clock follows the load.** In the suite's GPU-synchronised frames the M4
lowers its clock while a frame fits the 60 Hz interval. exp(H) at α 0.3, dpr 2, pan frames (p50) with the inverse pass
drawn 0 / 1 / 2 / 3 times: 5.3 / 10.2 / 11.2 / 15.6 ms: a second full pass (4.3 ms at full clock) added 1 ms. Scaling the
pass's pixels (a scissor of a fraction f of the pane), p95 of the pans: f 0 6.6–7.7, 0.2 9.4–9.6, 0.3 10.0–10.3, 0.4
10.0–12.7, 0.6 8.4–14.2, 1 10.5–13.9 ms. So a frame stays clear of the ceiling only while all its GPU work fits the low
clock: about 2.2 ms of work at full clock per frame (the pre-sphere app's mesh frames at dpr 2: ~2 ms, p95 ~10 ms);
cutting a 4 ms pass by a quarter moved nothing (the 21 % tail-rule saving below: p95 unchanged in situ), and the timer
readings, which the guard compares with 8 ms, show the clock rather than the work. Frames within a gesture rise from
~8 to 13–14 ms as the clock steps down (per-frame traces, `m1.js`). The same scenes in other machine states (the CPU's
part 0.5 instead of 1.5 ms) measured 2–3 ms lower: the gate's runs were in a slow state.

**Exact work cuts** (marginal pass, dpr 2, ms, the gate build / this build, same browser):

| scene | α 1 | 0.85 | 0.5 | 0.3 |
|---|---|---|---|---|
| exp(H) | 1.02 → 0.77 | 1.64 → 1.32 | 3.19 → 2.05 (tail rule only) | 4.21 → 3.14 |
| z^i(H) | – | 2.27 → 1.92 | 3.49 → 2.63 (tail rule only) | 4.83 → 4.12 |
| disc_cube (α 0.85) | | 0.42 → 0.41–0.47 | | |

- The tail rule (3.6): exp(H) / z^i(H) at α ≤ 0.5 walked the whole 17-member window although members past the buffer only
  scale ixTr, which the tail closure discards. Pixel A/B against the gate build, 11 scenes (zi_H, zi_H_out16, expH,
  expH_out16, logH, exp_strip, e1z_disc, healed_cut, sin_halfstrip, exp_far_disc, ez2_disc) × checker / polar × α 0.5 /
  0.3 / 0.2: 0 pixels differ at α 0.3 and 0.2; at α 0.5 (B 5) up to 39,722 pixels by 1/255 (expH polar: the same sum in
  another order). t_p2fix: the composite equals the full walk's (renderCPU with the rule off, ≤ 1/255), the flag's cases.
- The bound from the next member (3.6): a side stops without walking a member past the front. Leaves per covered pixel,
  α 1 / 0.85 / 0.5 / 0.3: exp(H) 3 / 5 / 7 / 10 → 2 / 4 / 6 / 9, z^i(H) 3.1 / 5.1 / 7.2 / 10.7 → 2.1 / 4.1 / 6.2 / 9.1.
  Pixel A/B, 12 scenes × checker / polar × α 1 / 0.85 / 0.3 (72 renders, dpr 1): 0 pixels differ. GLSL parity (12.2):
  720 cases, 42,454 points compared, 0 failures (the CPU twin moved with it).
- Not taken: specialising the program per shape kind and pattern (exp(H) α 0.3 −14 %, a compile and a first-draw
  stall per pattern change: open question 7), smaller B classes (a quality trade), removing per-leaf generality
  (−26 % at best together, `xall`).

**Half resolution in motion, made worth it, and predicted.** Forced half resolution (guard budget 0.3 ms) gave pan
p95 10.3–12.0 ms against 7.4–10.3 for a full-resolution pass over a quarter of the pixels: binding the half target
inside the pane's multisampled pass split it (a store and a reload of colour and depth). Drawn before the main pass
(10.12), and predicted from the first contiguous motion frame (10.12; the measured guard needed ~14 frames, and its
readings follow the clock), exp(H) α 0.3 dpr 2: pan / zoom in / zoom out p95 8.6–9.3 / 8.5–8.7 / 8.4–8.5 ms (the
reference 9.7–10.3). The half-resolution frame lines up with the settled one (`halfshot.js`: mean difference 0.35/255,
0.86 % of the pixels over 8/255, all on edges and net lines). A predicted pane gets its half pipelines with its first
warm-up (4.4). The first frame of each gesture stays full resolution (no soft-then-sharp wheel notches, P2-E7): 1 of
~23 frames per zoom leg, and the first ones after an idle GPU are the slowest (13–18 ms).

**Line pile-ups** (9.1). The default example's pan frames spent 5 ms of 9 ms (dpr 1) on its boundary strokes, in both
apps: 5,446 of its 6,636 segments are under a quarter pixel and 4,588 lie on the two pixels at w = ±1 (`lineana.js`);
without lines the frame is 4.2 ms. With the cull: pan p50 / p95 6.0–6.4 / 7.4–7.8 ms (gate build 9.7–10.7 / 12.7–13.9,
reference 9.3–10.2 / 12.3–12.5). Lines at dpr 2 cost 0.5–0.7 ms in exp(H) / z^i(H) (`cb.js`). Pixel A/B against the build
without the cull, 31 quality scenes at α 0.85: 17 change, only at pile-ups, 10–293 pixels (logH_out16, where piled
dashes were drawn solid); golden_diff disc_cube 0.010 %, joukowski 0.007 % / 0.006 % (limit 0.5 %).

**Results.** Paired run of the failing units and their dpr-2 siblings (`results/paired-20261020-183122*`):
0 FAIL, 35 IMPROVED, 276 PASS. Frame p95, reference → this build, ms:

| unit | pan R | zoom R in | zoom R out |
|---|---|---|---|
| expH.a30.dpr2 (half in motion) | 10.3 → 9.4 | 9.9 → 8.4 | 9.7 → 8.8 |
| expH.a50.dpr2 (half) | 10.2 → 8.5 | 9.3 → 7.7 | 9.7 → 7.3 |
| ziH.a30.dpr2 (half) | 7.8 → 10.3 | 7.1 → 9.9 | 6.8 → 10.3 |
| ziH.a50.dpr2 (half) | 7.6 → 8.8 | 6.8 → 8.3 | 7.0 → 11.2 |
| ziH.m240.dpr2 (α 0.85, exact) | 7.3 → 11.3 | 6.2 → 11.5 | 6.0 → 11.3 |
| expH.m240.dpr2 (α 0.85, exact) | 10.5 → 11.4 | 8.1 → 10.5 | 9.5 → 10.4 |
| default.m480 (dpr 1) | 11.5 → 7.6 | | |
| default.m240 (dpr 1) | 11.1 → 7.5 | 7.3 → 5.4 | 12.4 → 6.0 |

Full paired gate (`results/paired-20261020-184118*`, 1,527 metrics, 0 errors, the machine in a slow state: the
reference's default.m480 pan p95 15.1 ms): FAIL 1, IMPROVED 135, NEW 18 (examples.cold), INFO 362, PASS 1,011
(the gate's run: FAIL 16, IMPROVED 120). The 8 metrics that failed twice at the gate, reference → this build, p95 ms:
default.m480 panR 15.1 → 7.0; expH.a30.dpr2 pan / zoom in / out 12.0 / 11.2 / 12.3 → 9.5 / 9.1 / 9.3; expH.a50.dpr2
11.4 / 10.0 / 10.3 → 8.3 / 8.8 / 8.1; ziH.a30.dpr2 zoom out 7.0 → 11.4 (inside the 60 fps budget). 21 metrics pass only by
the 60 fps budget (the gate's run: 34), all z^i(H) at dpr 2 or α 0.3 and the new settle jank below. The one FAIL,
`examples.5.inv_first_draw_ms` 266 ms (limit 250), came from one rep of three: example 5 plays its deformation and the
unit pauses it 1.5 s in; in that rep the pause landed on the hold at T = 1 (a paused end normalises to the exact image,
10.5), whose program then compiled cold (`--disable-gpu-program-cache`) with its first draw, open question 7's cost. The
other two reps, the gate's six and the re-run of the unit's pair (`paired-20261020-190529*`: PASS, 15 IMPROVED, no
inverse program in any rep) drew none. SwiftShader (`results/swiftshader-p2r2-20261020.json`): ratios disc_cube 0.49,
joukowski 0.59, annulus_log 0.43, poly_mobius 0.51 (limit 3), 95–98 % of the passes inverse.

**What half resolution in motion costs.** The settle frame (exact, full resolution, at pointer up or 45 ms after the last
motion frame) now follows every gesture of a predicted pane and lands on a GPU clock the cheap half frames lowered:
`settle_jank_ms` (relative limit 16 ms from a reference of 0, 60 fps budget 20 ms) 7–16 ms for exp(H) and z^i(H) at α 0.5,
13–16 ms for exp(H) α 0.3, and z^i(H) α 0.3 zoomR.in 14.8 ms (183122) / 19.1 ms (184118, reps 20.4 / 19.1 / 18.6: the zoom
ends magnified on the annulus, every pixel covered). A settle in two frames (half the pixels each, the first half kept in a
half-pane layer: 1.6 MiB at dpr 2, inside the memory rule) would halve it; not built. Measured but not kept: hoisting
z^i's line-constant member work (+25 % per pass: the compiled program got slower), a lazy facing rule (±7 %, noise).

The margin left is z^i(H) at the default α 0.85 and dpr 2, exact in motion: frame p95 11.3–11.5 ms (183122) and
12.5–13.0 ms (184118, the slow state), as at the gate (12.4 then 10.7 in its two runs). `compare_perf.py`'s frame budget
reads 14 ms since 16:25 on 2026-10-20 (the lead's decision, first set at 12 ms; this round aimed at 12); against 12 ms these
three metrics and ziH.a50.dpr2 zoom out (12.2) would fail in the slow state. Putting z^i(H) α 0.85 at half resolution in
motion (`HALF_EST` below 1.8, or a heavier weight for ROOTPOW leaves) is the lead's call. Quality suite: PASS, 0 failed, 24 improved; targets 215 met, 37 not met,
all in the zi_H runs as at the gate (boundary-stroke chords, P4). Node: all `test/t_*.js` pass (t_gl_inverse 266: the
floor, the estimate, the tail rule's and the next-member bound's shader text, the line cull; t_p2fix 78: the tail rule's
composite and flag cases, the next-member leaf count). GLSL: parity passes (720 cases, clip 61,440 lines, anchors
5,120 points, 0 failures); glsl-test 0 failures; glsl-test-adv 591 (as at the gate); gl-test 0 bad pixels.


### 13.15 P3: exact globes, the left plane at a focused stage, the spherical checker, export, the conjugate lift (measured 2026-10-21)

**Built.**
- **Globes (4.6, 10.3).** `sphereView` (app.js) asks `pathOf(s, map, role, 'globe')` per area shape in list order and hands
  `GLR.drawSphere` region entries `{inv, fwd, onResult}`: the inverse pass over the globe's own triangles at its place in
  the list, its forward mesh (`fwd`) drawn in the same place when the pass answers `'pending'` or `'error'` (so inverse
  and forward shapes interleave in list order, 2.3). Roles: the w-globe (Y Sphere) is role R, the z-globe (X Sphere) role
  L. **At stage 0 the z-globe draws inverse too** (panels.md 11): the identity map is no longer forward on a globe, the
  walk being the pixel's own point, so a region through ∞ covers the north pole (`pathOf`: `isIdentMap` only sends flat
  views forward). Globe programs (`invS`) are warmed like flat ones (`warmInverse` draws one triangle of the globe's
  vertex layout: the pipeline includes it); the cost guard measures and demotes flat panes only.
- **The globe scissor (4.8 on the globe).** A bounded shape's pass is scissored to the projection of its image's
  w-box (`invBox`; at stage 0 the shape's own box): `globeScissorOf` (gl.js) lifts the box's four sides with the
  conjugate lift and projects them, subdivided until consecutive screen points are under 2 px apart, padded by 4 px.
  It promises a scissor only when every boundary point faces the eye (by a margin) and the sphere's point farthest
  from the eye lies outside the box: the box's image is then a disc inside the visible hemisphere, bounded on screen by
  its projected boundary. Otherwise (and for unbounded shapes) the pass covers the globe.
- **Anisotropic footprints on the globe (new, found by the acceptance test).** A globe pixel's footprint (`dFdx(w)`,
  `dFdy(w)`) is anisotropic, but the walk converted range levels to pixels with the scalar `ixPix` (√|det|). At grazing
  angles a range rim's ramp had the wrong width, and the facing rule's cancellation of a healed cut failed: log(H) on the
  w-globe showed a faint line (Δ 26/765) along Im w = −π on the far side. Globe programs define `IX_ANISO`, and GLChain's
  `ixFoot(J, lg)` measures the level's gradient, pulled back to w, along the footprint vectors (`ixAwX`, `ixAwY`). Flat
  programs are unchanged (the scalar path, `#else`).
- **Role L flat (10.9).** `PHASE.L.flat`: the left plane at `leftStage() > 0` draws (0, k] inverse, with its own guard
  state (`paneG.L`). Stage 0 keeps today's draw.
- **Pattern 8 (6.3).** `PATTERNS.sphere = 8` in gl.js; `uSphN` = clamp(2·round(8/patternScale), 4, 64) (app.js
  `sphN()`); the branch is shared text in `PAT_CHAIN`; the analytic mode reads (ln ρ, θ) and their footprints from the
  walk's polar block (`sl8`, `slw8`: exact with Λ for any |z|), the fwidth mode from `gp`/`gpw`. Menu entry "Sphere
  checker" with its swatch; figure caption sentence. **Fixture update (reviewed):** against the pre-P3 fixtures (kept as
  `test/fixtures/region_fs_*.pre-p3.glsl`) `REGION_FS(false)` and `REGION_FS(true)` differ only by the line
  `uniform float uSphN;` and the 8-line pattern-8 branch; `test/t_gl_inverse.js` checks both the new fixtures and that
  removing exactly these gives the old ones, and the "stated differences" of the two pattern modes are now three.
- **Export (10.6).** `prepareExport(panels, alive)` is asynchronous and cancellable: the lines' refinement one shape at a
  time (yielding after 8 ms), then the inverse programs of each panel's **current view** (right plane or w-globe; left
  plane at a focused stage or z-globe, stage 0 included), polled every 25 ms, checking `alive()` at every step.
  `buildFigure(opt.alive)` returns null when cancelled; the dialog cancels on every option change and on Close. The
  rasters are drawn synchronously at 300 dpi (theme switch inside, as before), then encoded off the main thread
  (`canvas.toBlob`), not with `toDataURL`.
- **Conjugate lift (panels.md 9.0).** P(z) = (2x, −2y, |z|² − 1)/(|z|² + 1) everywhere a point meets a globe: GLSL
  `lift` (lifted meshes and strokes), the inverse globe main, the preimage and phase globes, the projection ray and its
  plane point; app.js `liftC` (point marks, labels, probe ring, hover mark, root marks via `sphereProj`) and
  `pickSphere` (picking, hover, readouts). The graticule is symmetric under y → −y.

**Measured** (headless Chrome, ANGLE Metal, M4; `test/p3_accept_cmd.js`, which classifies every globe pixel by its
picked w against the analytic truth, fill = the frame minus the same frame at α = 0, rims ±4 px and the point labels
left out):

| check | result |
|---|---|
| 12.4 (f) z^i(H) on the w-globe, camera under the south pole | hole cap 3,860 samples all globe-coloured; annulus 50,090 all fill (with the camera 0.6 from the globe, 2 samples at the inner rim near the view's edge showed the stroke's parallax: the strokes sit on a shell 0.4 % above the globe; the check now uses dist 2.2) |
| (f) side view | annulus 8,849 / outside 3,299, 0 wrong |
| (f) Cayley(H) at w = 1 (the image of ∞) | 24,443 inside, 29,644 outside, 0 wrong: no notch |
| (f) Cayley of Im z < 0 at the north pole | 54,832 inside, 0 wrong; 354 samples with \|w\| > 50 |
| (f) log(H) on the w-globe | strip 102,447 / outside 106,717, 0 wrong (after the anisotropy fix; 12 wrong before); the fill ends where the strip is 0.15 px wide (\|w\| = 138): it reaches the pole |
| X Sphere, stage 0: \|z\| > 0.6 and Im z > 0 | 54,832 inside, 0 wrong: no hole at N; Im z > 0 around N: 40,839 inside, 13,105 outside, 0 wrong (1,027 samples with \|z\| > 20) |
| globe scissor: z^i of a disc (w-globe), the disc at stage 0 (z-globe) | the exact images whole: 2,467 / 33,511 inside, 0 wrong; the passes cover 10 % / 15 % of the pane |
| 12.4 (c) on the globe | H inverse, a disc forced forward over it: paths as expected, list order kept; 0.035 % of the pane differs from the all-inverse frame by > 3/255 (the disc's rim: mesh against exact) |
| (n) z-globe at stage 1 of [z^i, z²] | as (f): hole empty, annulus filled |
| (g) left plane at stage 1 of [z^i, z²] vs `Inverse.renderCPU` | IoU 1.0000 over 202,138 px (rims ±4 px out) |
| (i) GPU sphere checker, log(H) | 7/7 latitude columns within 0.5 px (worst 0.08 px) |
| (h) export of z^i(H) at 300 dpi | 1281 × 1613 px; 0 of 1,974,043 px off the analytic annulus; IoU 1.0 with the screen |
| (h) cancellation | a cancel at 40 ms returns null at 44–50 ms; no long task (> 50 ms) while preparing and cancelling; an uncancelled two-panel figure takes 27–41 ms; in the dialog, five width changes 15 ms apart: the last one wins, no long task |
| orientation | screen triangles on both globes keep their handedness at 177/177 points; Tiles F reads correctly on both globes (rendered and inspected, light and dark) |

**Suites.** Node: every `test/t_*.js` passes (t_gl_inverse 275: the fixtures and their pattern-8 diff, three stated
pattern differences, the conjugate lift's orientation over 400 random cameras, the globe main, `ixFoot`). GLSL: parity
passes (720 cases, 42,454 points, clip 61,440 lines, anchors 5,120, `fs` flat and sphere true, flip ok); glsl-test 0
failures; glsl-test-adv 591 (as at the gate); gl-test 0 bad pixels. U-b's CDP checks pass. Quality: PASS, 0 failed,
28 improved; targets 252 met, 0 not met (also with `--quality-enforce-targets`). Perf, full paired run
(paired-20261021-043449, before the globe scissor): FAIL 9, all the known GPU-memory ones of U-b (phase.default 1.17 →
2.63 MiB, examples 9/10/11/12, identical values), no new failure; `image.ziH.a30.dpr2.zoomR.out` frame p95 12.3 ms,
latency p95 29.3 ms (inside the 60 fps budget this run); 161 improved. Sphere units after the scissor
(paired-20261021-050512, with the new `sphere.globeL0`): PASS, orbit frame p95 sphere.default 11.7 ms (reference
12.0), sphere.logUHP 10.7 (6.6), sphere.ziH 7.3 (6.7), sphere.globeL0 7.8 (5.7), all within the 14 ms budget; GPU
memory −43 % to −70 %. Synchronous render of a globe pane (`__cmwTime`, GPU-synced, inverse / forward): dpr 1 5.2–7.1
/ 4.8–5.8 ms, dpr 2 8.3–10.5 / 8.2–8.9 ms.

**Left open by P3.**
- The cost guard measures and acts on the flat panes only: a globe's passes are never drawn at half resolution or
  demoted (they are scissored when bounded, see above). panels.md 11's halved budget when both panes show globes with
  inverse passes is therefore not built; the globe costs measured are below.
- 12.4 (c) on the globe is checked for paths and list order (a disc forced forward over H drawn inverse), not pixel by
  pixel against a CPU composite (the globe's shading has no CPU twin).
- Strokes on a globe are the line renderer's, on a shell 0.4 % above the surface: with the camera close to the globe
  they stand a few px off the exact rims near the view's edges (parallax; unchanged, P4's).
- Hover-dimming is not applied on the globes (as before P3).
- P3b (drawing on the globes) is the next phase, as planned.
- (P3 review) The stand-in a globe pass draws while its `invS` program compiles (or in morph and transition frames) is
  the forward mesh: on the w-globe of log(H) it leaves the lifted mesh's notch at the pole (3,833 px differ by
  > 8/255 from the exact frame, all next to ∞), on the flat plane jagged wedges at the strip's far end. It shows for
  the few frames of the first compile after a switch to Sphere; SphereMesh (P5) replaces it. Not changed.
- (P3 review) The equatorial plane keeps a mirror: it carries z = x − i·y_world (the projection ray's plane point is
  (x, −y, 0)), so it reads as the plane from below and as its mirror image from above, the default camera of Y Sphere.
  Forced by projecting from N with the globe's outside correct; stated in panels.md 9.0, not changed.

### 13.16 P3 review fixes (measured 2026-10-21)

New checks: `test/p3_review_cmd.js` (a CDP command file, as `p3_accept_cmd.js`); `test/t_gl_inverse.js` 276.

- **Beaded strokes (fixed; the cause was not the depth test).** The line renderer culled every sub-pixel piece after a
  segment's first one (`len < 0.25 dpr && aTpl.x > 0`), on the assumption that its neighbours cap over the gap. Where a
  whole segment spans a few px in sub-pixel pieces (a rim foreshortened toward the globe's edge; on the plane, a curve
  compressed by the map) only each segment's first piece was left: a string of dots, the casing (wider) still closing
  into a band. Now a sub-pixel piece is culled only when its start shares its quarter-pixel cell with the previous
  piece's start (`LINE_VS`, every variant but the floor print), so a run keeps one capped piece per cell it passes, a
  third of a pixel apart at most. Check: the pixels of the disc's edge colour within 2.5 CSS px of the exact rim of
  z^i(|z − (0.3+0.8i)| < 0.3) on the w-globe (pitch −0.9, yaw −1.2), connected components and the rim points reached:
  before 10 / 8 / 10 components and 63 / 71 / 71 % reached at dpr 1 / 2 / 3.125; after 1 component and 100 % at each.
  The quality goldens of four scenes recorded the same defect on the flat plane (see Suites).
- **Two-globe export blocked the main thread (fixed).** The renderOff calls cost 1–13 ms of CPU; the first `toBlob`
  readback then waited for both panels' 300 dpi passes on the GPU: 58 ms inside that one call. `buildFigure` now draws
  one panel per task (the print theme switched for that panel only, so no screen frame runs in it), waits for
  `GLR.gpuDone()` (a `fenceSync` polled between tasks, never waited on; 3 s cap), and encodes each raster in a task of
  its own. Example 1/4/8 with both globes at dpr 2: 12 exports, no long task (was 51–60 ms on the first export of a
  page), 57–110 ms in all; `p3_review_cmd.js`: 3 fresh pages, no long task.
- **First switch to X Sphere (fixed; the cause was the static globe programs).** The first globe frame linked the
  static programs it uses synchronously (`getProg` finishes a static program at its first use): `getProgramParameter`
  waited 5 + 24 + 3 ms, the first `drawSphere` took 41–45 ms, and with the stage-0 inverse pass's start the frame went
  over 50 ms in about half the trials. `GLR.prestart(names)` starts static programs in the background
  (KHR_parallel_shader_compile; the compile poll finishes them); the app calls it for `sphere, regionSC, lineSC, disc,
  mark` when a switch to Sphere is coming: the pointer entering or focus on a Sphere control, and `setView` itself, a
  frame ahead of the first globe draw. The links then run in parallel and the first frame waits for the slowest only:
  first `drawSphere` 10–41 ms from `setView` alone (more head start from the pointer); no long task in 17 fresh-page
  trials (X and Y switches, examples 1/4/8). A first try started them at the first idle moment after start-up
  instead: the quick paired perf gate then failed `examples.2.settle_ms` (193 → 346 ms: the compiles competed with the
  example's own) and `examples.0.compile_ms` (no value: programs linked in the window and never used), so it was
  replaced by the trigger above.
- **prepareExport per panel (rejected, with evidence).** There is one chain per step list (`rebuild` sets
  `GLChain.build(S.steps)`); a stage is the uniform range `uIxA`/`uIxB`, not another program; the program key is
  `invS|chain|formsKey|B` and both roles draw with `alphaOwn = S.alpha`. `cur` changes only inside side mode (the
  thumbnails, `GLR.side(true)` … `side(false)` within one call). So the status of the current chain answers for both
  panels, and `prepareExport` requests every view kind the panels need (flat, globe): no panel can find another
  chain's program pending. Not changed.
- **Sphere checker tooltip (fixed).** The count follows the pattern size: n × n/2 = 128 cells at ×1, 512 at ×1/2.
- **Acceptance gaps (filled).** `p3_review_cmd.js`: the Sphere checker against the cells of z on the z-globe at stage 0
  (|z| > 0.6, around ∞: 21,675 c0 / 21,259 c1 samples, 0 wrong) and on the w-globe of Cayley(H) (4,192 / 4,453, 0
  wrong; c0 pixels equal the solid frame within 6/255, c1 pixels differ by 10/255 or more, 4 px from cell edges, rims
  and labels left out); the left plane at stage 1 of [z^i, z²] with the Checker against `Inverse.renderCPU`'s colours
  (57,255 samples off the rims and cell edges, 0 over 40/255); a two-globe export at 300 dpi against the truth (z^i(H)
  on the w-globe 15,551 / 5,779, H on the z-globe 19,763 / 1,633 samples, 0 wrong); stroke continuity (above); the main
  thread at dpr 2 (above).

**Suites after the fixes.** Node `t_*.js` all pass (t_gl_inverse 276: the pile-up test now names the pile-up cull's own
text, and a new check covers the thinning). gl-test 0 bad pixels (20 comparisons). `p3_accept_cmd.js` passes (a cancel
returns 12 ms after it is issued, no long task). Quality: targets 252 met, 0 not met; **7 golden FAILs that are the
fix itself**: disc_cube.mask, joukowski.mask/.pattern, annulus_log.mask/.pattern, poly_mobius.mask/.pattern differ from
their goldens by 0.51–1.08 % of the pixels (limit 0.5 %), all on boundary strokes: the goldens hold dotted or faint
strokes (annulus_log's left edge, poly_mobius's top edge, the joukowski dashes, the disc_cube loop), the new renders
solid ones. Re-recording those goldens needs the user's consent; not done. Perf, paired quick
(paired-20261021-064750, against backup-pre-sphere): FAIL 5, all the known GPU-memory ones of U-b (examples 9/10/11/12,
identical values), IMPROVED 54, PASS 436; no new failure (image.default.m240, the pile-up scene, panR frame p95 13.9 →
9.7 ms, improved).

**Left open after the review.** Perf units for orbiting both globes at dpr 2, the first switch to X Sphere and a
two-globe export (the CDP checks above cover the last two, the suite does not); the cost guard on globe passes; an
idle-time warm-up of the stage-0 `invS` program (the stand-in still shows during its first compile).

### 13.17 P3 gate round 1: the strokes of compressed runs (measured 2026-10-21)

- **Overlapping capsules (fixed).** 13.16's thinning kept one sub-pixel piece per quarter-pixel cell, each with round
  caps at both ends (a culled neighbour gets a cap): a compressed run drew several overlapping capsules per pixel, so
  the stroke's anti-aliased edge saturated (annulus_log's rims: 1.00 / 1.00 coverage where one coverage gives 0.85 /
  0.66, i.e. a 1.5 px stroke drawn 2 px solid and aliased; poly_mobius's top edge and disc_cube's loop visibly bolder).
  Now a sub-pixel piece is culled only when its whole segment is a dot (`segDot`: start, middle and end within a quarter
  pixel of the start); every piece of any other segment is drawn, and the joins treat a sub-pixel neighbour as drawn
  unless its segment is a dot, so a compressed run is mitred and covers each pixel once. Dots and the pile-up cull are
  unchanged. Check: the 8 bounded quality runs against a build that culls no sub-pixel piece (all mitred, the
  one-coverage reference): annulus_log and poly_mobius 0 px differ by > 8/255, joukowski 8, disc_cube 32; the 13.16
  build differs by 804-2,752 px. The rims match the analytic coverage clamp(0.75 - d + 0.5) of a 1.5 px stroke.
- **Goldens.** Quality: 6 golden FAILs (was 7; disc_cube.mask 0.00512 -> 0.00438 passes): joukowski 0.00622 / 0.00559,
  annulus_log 0.01874 / 0.01671, poly_mobius 0.00763 / 0.00700. The one-coverage reference build gives the same values:
  the goldens hold beaded strokes (annulus_log's left rim) and stacked ones (its right rim at 0.99 / 0.94 coverage,
  where one coverage gives 0.86 / 0.65), so no exact stroke can match them. Re-recording them needs the user's consent.
- **Open.** `p3_review_cmd.js`'s globe stroke check fails at dpr 1 (5 components, 52 % of the rim reached; dpr 2 and
  3.125 pass): it counts pixels within 40/255 of the edge colour, which the saturated strokes met and a one-coverage
  1.5 px stroke over the white casing does not where the pixel grid is unfavourable (the dpr 1 screen shows a
  continuous rim). Not resolved. Perf not measured after this change.

### 13.18 P5: the forward fallback SphereMesh (measured 2026-10-21)

**Built.** `src/sphere.js` (`SphereMesh`, build order after region.js): the lead prototype `sphm_lead.js` ported with a
resumable `step(ms)` (refinement, then the publication's phases: leaves, clipped triangles, a resumable merge sort, the
arrays; commits stop at the slice's deadline and the popped leaf goes back with its own heap key, so a sliced run is
bit-identical to an unsliced one), the 8.4 budgets (300k nodes, 1.5 s CPU; at expiry pending leaves with chord
deviation <= 2 px are drawn), a guard band with a second coverage grid (3 px cells over the band, the view's cells
masked) and the frozen 8.7 layout (pos = w - w0 / conjugate-lift pos3, attr = (z - Q_t)/cell and (ln|z|, arg z)*16/tau
or the source point for graph paper, tri = area scale). Collinear cut-piece slivers are dropped (they left 4-7 open
edge triples in sqrt_slit). gl.js: `regionP` / `regionSP` (`PRE_VS`, `REGION_PRE_FS` = REGION_FS with `PAT_PRE.pre`:
the shared PAT_CHAIN fed from varyings; REGION_FS itself unchanged), `createPreMesh`, `drawPreMapped` (scissor),
`preBytes` (64 MB LRU), `drawRegion` `scissors`, globe region entries `{pre}`. app.js: fixGen's view-independent trouble
verdict, `smNeed` / `smFor` / jobs keyed by (shape, role, view kind, map, K, pattern, window; view) with their own keys,
one at a time in idle slices (setup in a slice of its own, steps of SM_SLICE - 2 ms), LED busy, the 8.8 rebuild display
(old mesh inside its guard box, the GPU image with its fix-ups in up to four scissor rects around it; the stand-in may
come from another meshing window), globes (valid while R is within 2x), `prepareExport` at the export's resolution,
context loss (re-upload from the CPU data), hooks `__cmwSphere`, `__cmwSmVerdict`, `__cmwSmReset`.

**Deviations (need the lead's / user's review).** Guard 2, not 3 (the band's sheets cost 2.5x a guard-1 mesh at 2, 3.2x
at 3). K of the shape's alpha, not of alpha/2 (at alpha 0.85 that is 11 against 3: exp(H) 2.6 s against 0.74 s at guard
1); a hover-dimmed infinitely-sheeted image may show its 4th and later sheets faintly. A pending inverse compile draws
an already published mesh but never starts a job. Playing homotopy frames keep today's GPU path (as 2.1).

**Measured.** `test/t_sphere.js` (12.3): the 40 flat runs IoU 1.0000, 0 holes, 0 spill; z^i hole 0/164, parity 0 wrong;
p99.9 chord <= 0.276 px (max 0.465 px, e1z_disc); 0 T-junctions in every run; nodes and evals equal to the lead's
recorded values (the three guard-band runs: this module's own, the band is meshed); determinism (one run vs 1 ms
slices) identical; the CPU budget passes after the load calibration. `test/p5_accept_cmd.js` (CDP): the classification
of all 33 quality scenes (27 need a mesh when forced forward) is identical at 1x, 4x and 1/4x; crack test 0 uncovered
interior px of 27-29k for z^i(H), log(H), Cayley(H) (exp(H) 100 and e^{1/z} 66 px are the boundary strokes' casing on
the images of the boundary inside the image, not cracks: the mesh-level coverage of t_sphere has 0 holes); exp(H)
forward vs inverse 0.058 % of px > 8/255, 0 > 32/255; a 45 % left pan keeps the old mesh on screen until the rebuild
lands; slices <= 4.9 ms on an otherwise idle run (8.6 ms once while the quality suite ran in parallel); no console
errors. Forced-forward quality run (`--override '{"exactImages":false}'`): 68 of 73 runs IoU >= 0.999; atan_D_s10,
atanh_D_s10 (IoU 0.59-0.75) and cube_far_deep (0.9964-0.9968) fail. *(Corrected by the P5 review: the first diagnosis
here, "bounded shapes the trouble test calls clean whose float32 GPU draw has holes at deep zoom; needs a
precision-aware trouble rule", was wrong on all three counts.)* atan_D_s10 and atanh_D_s10 ARE classified 'trouble' and
ARE drawn from a SphereMesh, and s10 is a 12x zoom-out, not a deep zoom. The holes are the mesh's own: arctan and artanh
map the unit disc onto strips running to infinity (log singularities at +-i, +-1 on the boundary); an image point at
|w| = T has its preimage within about 2 e^{-2T} of the singular point, below float64 resolution near |z| = 1 (the
precision floor of 8.4) past T of about 20, so the mesher cannot reach those parts and the strip ends at |w| of about
20-25 while the view reaches +-45. A precision-aware trouble rule changes nothing (these scenes already take the mesh
path). Open: a reach rule for leaves stopped at the precision floor or the depth limit next to a singular point whose
images head to infinity (carry the leaf's image to the view's chordal cap along its asymptotic direction, as P4 does
for strokes, or mesh near boundary singular points in a log-distance chart z = p + e^{-t}). cube_far_deep is a separate
case: bounded, clean, drawn by the float32 GPU forward path. Paired quick perf:
FAIL 5 = the known U-b memory ones plus examples.9 (custom (z^2-1)/(z^2+1) of a square through the poles: its
SphereMesh, +3.2 MB GPU, settle and compile_ms 0.3 -> 2.4 s) and scrub.blaschke_phi_morph.settle_ms (also 342 ms in
the earlier paired run of 12:42).

### 13.19 P5 review fixes (2026-10-21)

The P5 review's 14 findings (math and perf). Fixed here unless listed under **Open**. Load average 4-26 during these
measurements (other agents): CPU times are not idle times.

- **Memory: one mesh per slot.** `smFinish` drops every older entry of the new mesh's slot (shape, role, view kind):
  other content (pattern, alpha, lines, a paused T, the map) and other views; the new mesh is the next rebuild's
  stand-in. `SM_CPU_BYTES` and gl.js `PRE_BYTES` 64 -> 32 MB (they only bound transients now). Export meshes are
  flagged and dropped once the figure is drawn (`buildFigure` wraps `buildFigureNow`; `smDropExport`; each call tags
  its meshes with its generation, so a cancelled figure's cleanup never drops the next figure's meshes). Context loss:
  gl.js clears `preAll` / `preBytes` (and nulls their buffers) on `webglcontextlost`. p5_accept: 1 entry per slot after
  4 pattern / alpha changes (5 built); preBytes 2.78 MB before and after a lose / restore; the export leaves preBytes and
  cpuBytes at their pre-export values. Perf units: new check `sm_one_per_slot`.
- **Deterministic budget (8.4).** `SphereMesh.APP = {maxWork 250k evaluations, workOf(K) = max(250k, 85k K), maxNodes
  300k, guard 2}`; a stage-wise step probe counts 12 evaluations; budgetWhy 'work' | 'nodes'; CPU time is only a
  safety stop (10 s in slices, 30 s for an export). Full meshes at the default alpha 0.85 (K 3), dpr 1, checker:
  exp(H) 162k evaluations, e^{1/z}(D) 231k, e^{z+1/z}(H) 184k (they finish), exp(exp z)(H) 753k / 422k nodes (ends
  on the work budget). New t_sphere section 'app' runs these four with the app's budget: IoU 1.0000, 0 holes, 0 spill,
  >= 3 layers everywhere, sliced = unsliced (the first three complete, exp(exp z) partial on 'work').
- **Idle driver duty.** Slices yield with `scheduler.postTask(background)` (else a MessageChannel), not setTimeout(0)
  (4 ms clamp). e^{z+1/z}(H) in the browser: 2307 ms CPU, settle 2492 ms (93 % duty; before 1554 / 3878 ms, 40 %).
- **K.** `kOf` cap 16 -> `KCAP` 32 (alpha 0.2: K 25, 1 - 0.8^25 = 0.996). What stopped expH / e1z at 10-11 layers was
  the budget, not K: their full meshes need 523k / 695k nodes at K 16 and 814k / 1.1M at K 25; at the 300k node budget
  they draw 15 layers everywhere (node runs: 0 holes, min 15 layers). Forced-forward mask20 opacity_min: e1z_disc
  0.913 -> 0.9637, zi_H 0.969 -> 0.9873, expH 0.892 -> 0.9637 (alone; in the full forced-forward run expH.mask20 showed
  the GPU image, a run disturbed by a rebuild of dist/ mid-run). Still below the 0.99 target (needs 21 layers): open.
- **Paused homotopy frames** mesh only when an end of the step is drawn forward (an identity end counts as exact):
  z^2(H) and exp(H) paused at T 0.2 / 0.45 / 0.75: no job; exp(exp z)(H) paused in its second step: one mesh, one
  per slot.
- **regionP / regionSP** are prestarted when a job starts (not linked at the mesh's first draw).
- **Export.** Budget 4x the screen's work and 2x its nodes (deterministic); a partial mesh is reported (`f.partial`, the
  dialog's note); export slices count in sm.stats. e^{z+1/z}(H), 7 in, 300 dpi: 507k nodes, 843k evaluations, 175k
  triangles, complete, 18.5 s CPU under load (was 8 s and partial on time). Its long slices (8-11.5 ms) came at the
  publication's reorder and array allocation, which now take slices of their own.
- **Perf harness.** examples: the previous example's meshes are freed (`__cmwSmReset`) before `resetPeak`, so example
  10's peak no longer carries example 9's mesh.
- **p5_accept** now diffs frames: during the 8.8 rebuild against the rest frame (0 % > 8/255) and the exact image
  (0.056 % > 8/255, 0 > 32/255), the rest frame against the exact image (0.057 %); export lifetime, one mesh per slot,
  context loss. The figure promise is polled (the old check passed on `{}`), and the export is 7 in (a 3 in figure is
  within 2x of the screen zoom and reuses the screen mesh; 7 in built 460k nodes, complete, then freed). New, failing
  until the open shard item is fixed: e^{1/z}(D) checker forward vs inverse 1.81 % of px > 32/255, z^i(H) polar 0.59 %.

**Measured after the fixes** (paired, load 10-12 on 10 cores, so timings are indicative). Quick: FAIL 3 =
examples.9.gpu_live_bytes 0.93 -> 6.56 MiB and examples.9.settle_ms 354 -> 1035 ms (review run: 3561 ms; its mesh is now
complete), scrub.blaschke_phi_morph.settle_ms 143 -> 315 ms (no SphereMesh in that scene, as the review found).
examples.9.compile_ms passes (regionP prestarted); examples.10.gpu_peak 2.88 MiB is the accepted U-b carry-in only (it
was 6.19 MB with example 9's mesh). The two P5 units: FAIL 14 against a reference that draws no mesh:
gpu live / peak / end (e^{z+1/z}: 6.44 MiB, one complete mesh, was 9.94; exp(exp z): 7.83 MiB, one partial mesh, was
12.99), zoomR in / out settle 1.4-2.3 s (reference 0), sm_slices_6ms (max 7.2 / 7.5 ms); sm_one_per_slot passes; the
expexp settle_jank FAIL is gone. Mesh jobs: e^{z+1/z} 2063 ms CPU, settle 2191 ms; exp(exp z) 1117 ms, 1184 ms.

Forced-forward gate as the review asked (`run_quality.js --override '{"exactImages":false}'`, then
`compare_quality.py --all --enforce-targets` against the exact run): 18 of 73 runs fail, 25 targets not met: parity
(logH_out16.pattern 0.763, zi_H(_out4).polar 0.990 / 0.964, e1z_disc / e1z_custom.pattern 0.985, e1z_disc_out16 0.967,
zi_H_polar85 0.987), opacity (e1z_disc / e1z_custom.mask 0.502, mask20 0.964 / 0.987), color_off at alpha 0.2 (the
exact image is opaque-coloured at any alpha; a translucent forward stack cannot be), atan / atanh_D_s10, cube_far_deep,
and expH.mask20 (that run only; 0.9637, IoU 1 when re-run alone).

**Open (need the lead / more time).** (1) atan_D_s10 / atanh_D_s10: the reach rule above. (2) The shard seams of
infinitely-sheeted chains (e^{1/z}, z^i polar, forced forward: parity 0.964-0.990; logH_out16.pattern 0.763): the
front sheet is a per-leaf discrete D; needs the exact 5.1 / 5.2 order per sample or leaves split on the D-tie curve.
(Fixed in 13.22 for flat views of chains with an inverse plan: the order per sample.)
(3) mask20 opacity 0.99 at alpha 0.2: needs about 21 layers (a larger node budget at low alpha, or an opaque
remainder layer). (4) e^{1/z} half-covered pixels (opacity 0.502 on about 19 px of e1z_disc.mask) and the (k) crack
test's 100 / 66 px on exp(H) / e^{1/z} (the crack part: 13.22, stroke pixels, not cracks). (5) Slices over 6 ms: in a node run of exp(exp z)(H) at 700x800, guard 2,
3 ms steps, 14 of 592 steps took 6.1-9.2 ms (load 11), none at a vertex-array doubling; the set-up (5-7 ms at dpr 2)
is the coverage pyramids (a children-sum rewrite was slower: reverted). Not bounded; re-measure on an idle machine.
(Fixed in 13.21: the set-up slice, row-wise pyramids.) (6) Whether example 9's mesh (0.17 % of pixels) is worth its settle and
memory, and the larger budget's settle times: the lead's call.

### 13.20 Final gate round 1 (2026-10-21)

The gate's perf part could not finish: load 109-316 on 10 cores and swap 6-8 GB used, from other sessions on the
machine (a python job at 100-570 % CPU, waves of 10-30 vitest workers, and at 17:30-17:40 a stress test of 14 `yes`
processes). No code cause. src/ is the gate's frozen 16:20:58 snapshot (sha list identical) plus the fix below; dist/
rebuilt from it.

- **scrub.blaschke_phi_morph.settle_ms** (143-155 -> 315-342 ms in every paired run since the unit was added at
  12:42; not P5): the deformation's paths job waits for 150 ms of stillness, but `morphSelScreen` re-armed its timer in
  every frame that wanted a new selection, so the settle frames after a scrub (+90 and +145 ms) restarted the wait and
  the job ran at ~300 ms. The wait now restarts only when what is wanted (chain, shapes, view: `mfCache.want`) changes.
  CDP probe (phi scrub, deformation paused, 3 reps x 2 directions): last activity after the drag 300-315 -> 150-166 ms
  on the leftward legs, 142-157 ms rightward (unchanged). Paired unit (load 20-30): 155 -> 157 ms, PASS (was FAIL).
  (While the deformation plays, a selection whose chain or shapes changed is now re-chosen after 150 ms; before, the
  per-frame re-arm held it off until the play stopped.)
- After the fix: Node tests 14/14; quality 73 runs, 0 failed, 252 targets met (`--quality-enforce-targets` PASS);
  p3_accept pass. Not caused by the fix and seen on the snapshot build too: `morphfig_cmd.js` ex-strip keeps 6 arrows
  (check "more than the old cap" 8). p3_review's dpr-2 "first switch to X Sphere" long task (87 ms, 1 of 3) came with
  the quality suite running beside it; re-run alone at load 3: pass, 0 fails. swiftshader.ratio: max ratio 1.42
  (joukowski), PASS against the P3 gate's run.
- Paired `examples` + the two P5 units (load 7-15): `sm_slices_6ms` and `sm_one_per_slot` pass on both (max slice
  4.1-4.6 ms in a CDP probe at load 8; the 7.2 / 7.5 ms of 13.19 were load). Still FAIL, 14 metrics, all 13.19 open
  item (6), the lead's / user's call (a mesh the reference never builds): examples.9 gpu_live 5.90 MiB and settle
  999 ms; e^{z+1/z} and exp(exp z) gpu live / peak / end 6.44 / 7.83-8.21 MiB and zoomR settle 1.3-2.4 s.
  The full paired gate did not finish in the time box (two attempts stopped by load waves).

### 13.21 Final gate round 1 fix: the SphereMesh set-up slice (2026-10-21)

The gate's perf FAIL `image.expexp_H.m240.sm_slices_6ms` (8.3 / 6.2 ms; P5 snapshot 6.9 ms on a quiet machine) and the
edge cases of `image.custom_e_z1z.m240.sm_slices_6ms` (6.5 / 6.9 ms) were 13.19 open item (5). Root cause, measured in
a CDP probe (`sm.stats.long` = [ms, slice, phase]): every slice over 6 ms was slice 1 of a job, the set-up
(`SphereMesh.create`), never the refinement or the publication. In the app the set-up took 3.8-6.9 ms, the same
configs re-run back to back 0.1-1.6 ms: a trace showed no GC and no main-thread compile in those slices, only the
set-up running unoptimised (it runs once per job, seconds apart; Maglev arrived on a background thread mid-call). Its
cost was `makeGrid`'s coverage pyramids: one closure call per block of every level (2 grids of 410 x 516 cells at dpr
1). `makeGrid` now builds each level a row at a time with native fills (full blocks, the partial last column, and in
the mask's rows only its first and last block columns; the ones between are b(hy - oy)). The pyramids are identical
(3006 random grids and masks plus the app's sizes, every level, cov and nU, against the old code); `node --jitless`:
410 x 516 masked 11.1 -> 0.17 ms, a 4096 x 2048 globe grid 125 -> 1.3 ms.

Measured after (CDP probe of the perf unit: open, 3 x pan, 3 x wheel zoom in / out; load 1.3-2.3): set-up in the app
0.4-1.5 ms (was 3.8-6.9); max slice exp(exp z)(H) 3.9-4.3 ms over 7 jobs (was 6.6-6.9, all set-up), e^{z+1/z}(H)
4.4-4.8 ms (its slices over 3.3 ms are refinement slices: a 3 ms step plus its last leaf). No change to the mesh, the
budgets or the check.

Verified (dist/test.html sha1 0ab0ccaf, src = the gate's 21:58:12 snapshot + this sphere.js; logs in
test/slicefix_cdp/logs): paired `image.(expexp_H|custom_e_z1z).m240` twice (load 1.6-2.4): sm_max_slice 4.0 / 3.9 ms
and 4.5 / 4.5 ms, PASS (paired-20261021-234634, -234830). Quick paired: one FAIL, image.ziH.m240.dpr2.redraw_ms 15.1
(ref 9.85) in a 4-sample run; that unit draws no SphereMesh (path inverse); its pair re-run: 9.35 vs 6.75 ms, PASS
(paired-20261021-235831). Node tests 16/16; quality 79 runs, 0 failed, 252 targets met (enforced); p3_accept,
morphfig and p3_review (0 fails, 74 s, no long task at the dpr-2 X Sphere switch) PASS. glsl-test, gl-test,
glsl-inverse-test and glsl-test-adv pages are byte-identical to the gate's (they do not include sphere.js).

### 13.22 Merged-views gate round 1 fixes: the front sheet per sample, the crack test under the strokes (2026-10-22)

The gate's only FAIL was p5_accept (4 checks, unchanged since v11: 13.19 open items (2) and (4)).

- **Shard seams (13.19 open (2)).** Root cause: the forward draw's front sheet was a per-leaf choice: one D per leaf
  (8.6), and leaves of equal D (D = 0 inside the window, the common case where sheets meet) ordered by the sum of
  their vertices' Im z. Where two sheets overlap with equal D the front sheet flipped triangle by triangle: a band of
  shards one leaf wide (up to 64 px) along the 5.2 tie curve (e^{1/z}(D): the real axis of w). Fix (gl.js, app.js;
  sphere.js and the mesh unchanged): `drawPreMapped` takes the inverse path's key (`smKeyOf`: clipWin, R, rs and
  `invSing(plan)`, the same P as `invPrep`) and computes 5.1's D per fragment from the fragment's source point (sa, the
  interpolated pattern coordinates); the tie class D = 0 maps to depth by Im z then Re z (5.2), D > 0 above it. One
  pass in the mesh's far-to-near order with the depth test (LEQUAL, depth written; the pane's depth cleared before and
  after, scissored): the front of every sample is exact; at alpha < 1 a layer behind it that the leaf order draws after
  a nearer one is left out (only where the two orders disagree, a few % of the colour there; before, the front itself
  was wrong there). A first version drew three passes (depth only, the layers behind, the front) and kept those layers,
  but gl_FragDepth disables early depth tests, so each pass shaded every fragment: paired perf FAIL
  image.expexp_H.m240.zoomR.out.settle_jank_ms 20.1 ms in all 3 reps (limit 16). Chains without a plan, the globe and
  non-default framebuffers draw as before. p5_accept forward vs inverse, px > 32/255: e^{1/z}(D) checker 1.813 % -> 0.163 %, z^i(H)
  polar 0.588 % -> 0.026 % (limit 0.5 %). What is left (a few isolated triangles near the tie curve) is mesh content:
  a sheet the leaf order saturated away where 5.1 puts it in front.
- **Crack test (13.19 open (4), the (k) part).** The 100 / 66 uncovered px of exp(H) / e^{1/z}(D) lay on the image of
  the boundary inside the image (exp(H): 1.5 px above the positive real axis; e^{1/z}: e.g. w = 1.317 + 1.333i on
  exp(e^{i theta})): anti-aliased edge-stroke pixels over the 85 % casing, where the fill shows through by less than
  the test's 24/255 and the pixel is not close enough to the edge colour to be skipped as a stroke. The test now hides
  the strokes for its two frames (test hook `__cmwHideStrokes`, stripped from the published page), so the fill is
  tested under them as well (a stricter test): 0 uncovered of 50144 / 50111 interior px.

---

## 14. Risks and open questions

1. **Per-pixel cost of the generated program** (the review's main risk). Mitigations in P2: the benchmark first, the
   cost guard, shape ranges, shading on admission, B constant, scissor, early stop. Batching shapes into one pass is
   kept in reserve.
2. **Compile cost** of the inverse program (estimated 25–30 KB of GLSL, nested dynamic loops). Measured in P2 step 1.
   Mitigations: one bundle program per scene and pane (4.4), compile after the forward programs land, the forward
   stand-in meanwhile.
3. **Branch semantics drift** between `CX`/`Expr.compile` and the enumerators: cut conventions, the odd evaluation of
   arcsin on the GPU, principal constants. Guarded by 12.1 (a), (b) and 12.2. The decomposition is shared code
   (`Inverse.stepOps` feeds glsl.js), so structure cannot drift.
4. **Sheet-swap seams** with sheet-dependent patterns are inherent to any per-point order (5.3); they are documented
   in the guide text.
5. **Range conservativeness.** `clip` is exact by construction; `imageBox` is conservative by adaptive sampling plus
   padding, not by interval arithmetic. Guarded by 12.1 (e) and (j). A failure shows as a missing image part of a
   bounded shape behind a non-affine prefix.
6. **More shapes go forward than in rev 1** (13.9: unbounded shapes through non-affine prefixes, outer unbounded
   ranges). They were silently wrong in rev 1; now they get the fallback, which is correct but costs CPU on settle.
   P6's recognizer and Möbius-image work narrows the set.
7. **Fallback CPU cost** on wild ineligible maps: 0.3–0.8 s prototype, sliced, with budgets.

**Open questions.**
1. Should "exact images" be visible in Display options, or stay hidden? The default is on either way.
2. When the inverse program fails to compile on some GPU, should the app show a one-time toast? (Default: no; console
   only.)
3. Should P6's invertible homotopies at any t come before P5? With 10.5's normalisation, paused frames at step
   boundaries are already exact; the remaining fallback case is paused frames at interior t.
4. Should P4 (lines reach) move before P3 for the visual coherence of zoomed-out unbounded images?
5. Is a Windows (ANGLE D3D11/FXC) machine available for P2's benchmark and the compile-time gate? Without it, FXC
   compile times of the nested dynamic loops stay unmeasured.
6. Should the cost guard's budget (4 ms per pane) be tied to the display refresh rate (e.g. 25 % of the frame)?
   (Decided first: min(4 ms, 25 % of the measured frame interval). Superseded by the user's rule "60 fps is enough"
   (2026-10-20): a fixed 60 Hz budget of 8 ms per pane whatever the display, half resolution before demotion,
   hysteresis by probes (10.12, 13.13).)
7. (P2, 13.10; P2 review: measured in the perf suite by `examples.cold` (info), and the step-add and opacity cases of
   13.12) Cold compile + first draw of the inverse program is 254–356 ms for the unbounded acceptance scenes on
   M4 (bounded controls 185–220 ms; warm 20–45 ms, once per program and machine). Accept, or specialise programs per
   pattern and/or per set of shape kinds in the scene (−35 to −50 ms cold each), at the price of a compile and a
   75–205 ms first-draw stall whenever the pattern or the set of kinds changes?

---

## 15. Review log (revision 2)

Two adversarial reviews of revision 1: mathematical correctness and precision (M1–M8), and performance, engineering
and integration (E1–E13). Each finding is listed with its verdict, the reason, and where the spec now handles it.
Measured evidence is in 13.9.

### Mathematics and precision

| # | finding (severity) | verdict | reason and resolution |
|---|---|---|---|
| M1 | Family windows are centred on clipWin, not on the shape; bounded shapes away from the left view lose their images; the walker never clamps ms and marks a side finished on the first out-of-range member (high) | **Accepted** | Reproduced (exp of a disc at 60i: 4000/4000 missed; exp(H) with the view at Im z = −20: 360/360 sectors empty). Ranges now come from the shape: per-pixel line/ray clips for affine prefixes, float64 range boxes otherwise (3.6, 3.8); whole bounded ranges are scanned; windows only for unbounded ranges, centred at clamp(m*, lo, hi); two cursors so a dead side costs nothing (3.5, 4.1). Completeness is now tested with the reference fixed at the default clipWin centre and shapes anywhere in ±100 (3.10, 12.1 (c), (e)). Measured: 0 missed in all reviewer cases and the fuzz (13.9). |
| M2 | Outer window families get M = 2 (exp∘exp, e^{z²} lose images inside the default view), and 3.4 contradicts 12.1 (c) (high) | **Accepted** | Fixed M values are gone. Every family's budget is its shape range's member count (3.4); "inner" is the window family nearest z; a bounded shape whose ranges do not fit the leaf budget goes forward instead of being truncated, and so does any non-inner family with an unbounded range. Measured: exp∘exp at 3+0.9i and e^{z²} at 3+3i / 3.3+4.1i: 0 missed with budgets 4×5 and 2×5. 12.1 (c) now states budgets and verdicts, consistent with 3.4. |
| M3 | ROOTPOW finite mode with more than 17 members divides by Im β = 0 (powa with real \|α\| ≥ 16 renders nothing) (high) | **Accepted** | The log-radius window is gone. Finite mode scans the whole branch range (⌈1/\|Re β\|⌉ + 3 members) within the leaf budget; only a mostly radial spread over budget uses a window, centred by a log-space projection that never divides by Im β; otherwise the shape goes forward (3.2). Measured: α ∈ {15.5, 16, 17.5, 20, −18, 20+0.1i, 20+2i} and custom z^{17.5}: 0 missed on the disc and on H. Added to 12.1 (a). |
| M4 | The early stop is not exact with a Möbius between the family and z (e^{1/z}, exp∘Möbius) (medium) | **Accepted, with a stronger fix than "stopOp = −1"** | Reproduced (1.23 % and 7.36 %). Disabling the stop would cost up to 17 leaves per pixel, so rev 2 keeps it with a proven lower bound for the rest of the arc (LB > D_K, once the members recede toward the accumulation point) and centres the window at the best-key member among three candidates (3.6). Measured: e^{1/z} 0 mismatches at 5.1 leaves/px; exp∘Cayley exact outside truncated windows and within 0.0004 octave inside them (5.4). 12.1 (d) now uses 40 random off-centre views. |
| M5 | The coverage union leaves a half-transparent crack along a cut that a later step heals (medium-low) | **Accepted** | Twin merge in admission: coincident partial entries bound by opposing range gradients merge with cv = min(1, cv_a + cv_b) (4.2). They are adjacent in sort order (same D and tie key), so only the neighbour is checked. Measured: 174 → 0 crack pixels at offsets 0.25 and 0.5 px; controls unchanged. Added to 12.1 (g) and the `healed_cut` scene. |
| M6 | The Λ rule for Re Λ < −60 uses the direction test, which fills images of halfplanes and sectors that do not contain 0 (low-medium) | **Accepted** | Rev 2 splits the rule: Re Λ > 60 keeps the asymptotic cone; Re Λ < −60 uses the tangent cone at 0 only for boundaries through 0 and the level at z = 0 otherwise (4.3). Measured at 32× and 64×: 0 spill and 0 holes (rev 1: 46–150 px spill; holes for shapes containing 0 under the "bounded kinds outside" reading). Added to 12.1 (g) at 32× and 64×. |
| M7 | Low α is not opaque at infinite multiplicity (the window spends half its members on the non-covering side) (low) | **Accepted** | Two cursors and range clamps put the whole budget on the covering side; the walker flags infinite multiplicity (a truncated side whose last 3 members covered) and the compositor closes the tail (4.1, 4.2). Measured at α = 0.2: exp(H) 0.832 → 1.000. Added the `mask20` variant (12.4). |
| M8 | Parts that held up; documentation slip in 8.4 (probe radius at input 0) (info) | **Accepted** | 8.4 now says the probe radii are relative to \|p\| for p ≠ 0 and absolute (1e−3·eps) at p = 0, as `sphm_lead.js` does. The confirmed parts (z^i branch and range level, ROOTPOW level scaling, the globe chart, the spherical checker, EXPC constants, unimodal D for lines and rays, the stop's U at rims, the fallback's polar pole) are unchanged. |

### Performance, engineering and integration

| # | finding (severity) | verdict | reason and resolution |
|---|---|---|---|
| E1 | The GPU cost evidence and the P2 perf gate miss the main risk: per-pixel cost of the real generated program at dpr 2 on ordinary GPUs (high) | **Accepted** | 4.7 now labels the rev 1 numbers as lower bounds from hand-written shaders. P2 starts with a benchmark of the generated program (dpr 1 and 2, compile and first draw, Metal, SwiftShader, D3D11 when available); dpr-2 units and a SwiftShader ratio gate are added (12.5). The cost guard moves into P2 (D8, 10.12): demotion of bounded clean shapes, then half resolution in motion. Shading happens only on admission (≤ min(B, K + 2) candidates); B is a compile-time constant (8; 16 only for undimmed α < 0.5). D2 now reads "every eligible shape unless the guard demotes it". |
| E2 | Inverse program identity is undefined against gl.js versioning: stale walkers, shared uChain allocator, hist stand-ins, sticky failure marks, error reporting (high) | **Accepted** | Inverse parameters move to their own `uniform vec4 uInv[]` and allocator (4.1). The inverse key encodes per-step eligibility and op kinds, so poly `1,0,−1,0` → `1,0,0,5` recompiles. `drawInverse` uses only the current program, never `hist` (4.4). Failure state lives in `progs`; link status is ignored on a lost context; inverse errors never set `frameErr`/`lastError`. Test 12.1 (l) edits poly, rational and Möbius coefficients through eligibility flips at a constant forward key. |
| E3 | Unbounded singular-point lists (TAN/TANH lattices) times P4's per-point sampling give multi-second stalls and huge line buffers (high) | **Accepted** | `singular()` returns ≤ 16 points per kind nearest clipWin and enumerates lattices only inside the 3× window box (3.7). Line refinement inserts ≤ 8,192 samples per curve, prioritised by distance, and runs on settle only (9.1). The CPU jump scan for ineligible chains is capped at 2,048 evaluations per curve. 12.1 (f) asserts bounded counts and < 2 ms for tan(H) and tan(1/z). |
| E4 | P4 puts singular points into lineKey, so scrubs resample and re-upload lines every frame; dashed boundaries cost ~10× more CPU (medium) | **Accepted** | Motion frames keep today's `lineKey` and samples; refinement is idle work on settle, keyed by structural singular points (9.1). Tails stop where the CPU stage map leaves 1e19, so z² and exp do not pay for samples float32 drops. New unit `scrub.mobius_halfplane` (12.5). |
| E5 | Formula-shape program variants: per-shape key plus a 4-entry LRU causes compile thrash and endless pending (medium) | **Accepted, option (a)** | One formula bundle per scene: the first 4 formula shapes in list order share one program per pane, view kind and B variant; later ones go forward deterministically (4.4). Inverse programs have their own 8-entry LRU that never evicts a program used in this or the previous frame; target `pre` variants are separate. Formula edits recompile after a 300 ms debounce, with the edited shape forward meanwhile (not the old variant, which would draw the old formula). Side-mode draws never start compiles. |
| E6 | Fix-up gating by role removes fix-ups that forward-drawn views still need (Sphere view in P2, role L before P3, invS pending, left globe) (medium) | **Accepted** | `pathOf(s, map, role, viewKind)` with phase flags (2.1, 2.2); fix-ups run for a role whenever any visible consumer of it draws forward (10.4). The left globe is in table 2.1, 10.3 and CDP (n); CDP (m) checks the Sphere view in P2. |
| E7 | renderOff cannot run SphereMesh "synchronously in slices"; the figure dialog rebuilds at 300 dpi on every option change (medium) | **Accepted** | Async, sliced, cancellable `prepareExport(views)` runs before `renderOff`, with progress in the dialog, cancellation on option changes, meshes cached by export view key, and preview at screen resolution; `renderOff` stays synchronous with published meshes; `syncCompile` covers only missing programs (10.6). CDP (h) checks cancellation and the 50 ms main-thread limit. |
| E8 | SphereMesh fallback is view-dependent where fix-ups are not: settle regressions, undefined display during rebuilds, incomplete job key, restarts, memory (medium) | **Accepted** | Display during rebuilds: today's GPU image with the old mesh clipped to its guard box (8.8). Job keys add Kmax (for the dimmed α) and patternKey; each job has its own token and survives unrelated `scheduleFix` bumps. The trouble classification is view-independent (8.1, 12.3). Pre-mapped meshes get their own 64 MB GPU budget (8.7). Settle units for ineligible unbounded scenes are added (P5, 12.5); no existing unit uses such a scene, and paused morph frames at step boundaries are now inverse (E9). |
| E9 | Paused morph frames at t = 0 or 1 are mode 1/2, so they go forward and pop (medium) | **Accepted** | `normalizeMap` maps paused mode 1/2 at t ∈ {0, 1} to mode 0 ranges, using `map.base` (10.5), guarded by a homotopy end-point test (12.1 (k)). Playing frames stay forward; an optional 120 ms cross-fade at the end of transitions is P6. CDP (l) checks paused frames and closing the transport. |
| E10 | The scissor box from 256 boundary samples is not conservative near poles or across interior cuts (medium) | **Accepted** | Adaptive boundary sampling until image chords are under 1 px, plus intermediate cut images from the range-box quadtree; skipped when a pole or P point lies within the support box inflated by one window; cached per (mapKey, shapeKey) (4.8). Test 12.1 (m) against dense sampling, including 1/z near its pole and sqrt∘exp. |
| E11 | The pending state lets thumbnails cache forward images; the gallery triggers a storm of side-chain compiles (low) | **Accepted** | `'pending'` sets `framePending` (4.5, 10.7). Side-mode draws use inverse only when ready and never start a compile; inverse compiles start after the forward programs land (4.4). Rev 1's risk-14.1 mitigation (skip the forward compile while the inverse one is pending) is withdrawn, as it contradicted the forward stand-in. Measured by `examples.load` and the new `gallery.open` unit. |
| E12 | Spec ambiguities that parallel owners would resolve differently (low) | **Accepted, all seven** | (1) Drags follow `pathOf` (2.1). (2) `REGION_FS` fixtures cover patterns 0–7 in P2 and are re-recorded with a reviewed pattern-8-only diff in P3 (6.1). (3) `inverse.source` is split into `lib` and `walker`; gl.js places the walker after `INV_HEAD` (4.1, 4.2). (4) One owner per file region; app.js is E4's alone; E6 delivers `Lines.refine` in region.js; the 8.7 layout is frozen in the spec (11.0). (5) The inverse branch comes before the `meshRes` check; `s._err` maps to `'forward'`, which draws nothing as today (2.2, 10.2). (6) Globe draws interleave inverse and forward shapes in list order (2.3, 10.3). (7) The node budget counts live nodes (8.4). |
| E13 | Per-candidate and per-frame costs left out of the budget: polygons, per-pass uploads, per-frame prep, the mesh still built (low) | **Accepted, last item deferred** | Polygons over 64 vertices go forward (D2, 4.3). Shape records are packed once per frame with an offset uniform (4.3, 4.5). `invPrep` is cached by structure, parameter values, clipWin and shape; its cost is measured (0.01–2.3 ms) and capped per frame (10.2); scissor boxes and singular sets are cached (3.7, 4.8). Skipping `buildMesh` for shapes no view draws forward is deferred: the left plane at stage 0 still draws the mesh, so the saving exists only at `leftStage() > 0`; it is listed for P6. |

### What changed in the design as a whole

- The inverse path is now exact by construction for every bounded shape (whole ranges), and for unbounded shapes it is
  exact in coverage wherever the far members provably cover; everything else is routed to the fallback with a stated
  reason, instead of drawing a view-dependent partial image.
- The cost story is no longer an extrapolation: the generated program is benchmarked first, and the guard keeps a slow
  GPU from regressing pans and zooms.
- The engineering contracts (program identity, formula bundles, fix-up gating, export, thumbnails, ownership) are
  specified to the level where parallel owners cannot diverge.

### P2 review (renderer and app integration; fixes and measurements in 13.12)

Three lenses reviewed the P2 build (math and precision, performance, integration and regressions). Each confirmed
finding below was reproduced, then fixed or rejected with evidence, with a test that would have caught it.

| # | finding (severity) | verdict | resolution (13.12) and test |
|---|---|---|---|
| P2-M1 | artanh / arctan images break at moderate zoom-out: float32 tanh w = ±1, a half-covered spill band, noisy edges and patterns (high) | **Accepted** | Saturation anchors: stable offsets and their logs, the shape's local model at ±1 (±i) on CPU and GPU, anchored patterns; a formula boundary through an anchor goes forward by rule. Tests: t_p2fix (1), parity `anchors`, quality `atanh_D_*`, `atan_D_*` |
| P2-M2 | Deep zoom: checker colours out of range, then cells vanish, edges jagged (medium) | **Accepted, other fix** | The analytic checker filter is the cancellation-free ramp (equal to the box filter for w < 1); magnification only above float32 resolution. The suggested forward demotion was built and rejected: the forward mesh is worse against the exact image (13.12 table). Quantization past ~5e4 remains (P6 anchoring). Tests: t_p2fix (6), quality `cube_far_deep` |
| P2-M3 | z^i(H) polar at α < 1: seams, light cells never reach c1 (near-origin fade on exact-Λ sheets) (medium) | **Accepted** | Fade skipped where Λ is exact (analytic only). Tests: t_p2fix (4), t_gl_inverse (template difference), quality `zi_H_polar85.*` with `cell_err` |
| P2-M4 | Black pixel at a critical value at a pixel centre (low) | **Accepted** | Sign-only range levels past it, moiré-average shading. Tests: t_p2fix (3), `test/p2fix_cdp/cmd/crit_hits.js` |
| P2-M5 | renderCPU not a reference for the source phase and sub-pixel footprints (low) | **Accepted** | Ported (GLR.phaseRGB, magnification). Test: t_p2fix (5) |
| P2-M6 | Verified clean (info) | – | – |
| P2-E1 | α < 0.85 (B 8 / 16) makes the pass 2–4× a forward frame, untested (high) | **Accepted** | B 3 / 5 / 8, exact rest transmittance, no stop past B; pass 2–3× cheaper at α ≤ 0.5. Tests: t_gl_inverse (classes, INV_HEAD / INV_MAIN), t_p2fix (2), perf units `*.a50.dpr2`, `*.a30*` |
| P2-E2 | z^i(H) at dpr 2 regresses pan / zoom frames, the gate cannot see half resolution (high) | **Accepted in part** | The measurement no longer splits the render pass; `half_passes` reported; half resolution no longer withdrawn on DVFS-inflated readings. The exact pass itself is inherently above the forward mesh's cost at dpr 2 (within the D8 budget): equal to the reviewed P2 build, 20–38 % below it at α 0.5 / 0.3 (paired, 13.12) |
| P2-E3 | Half resolution not reliably cheaper (medium) | **Accepted** | One batch per pane, scissored upsample, half pipelines warmed (not withdrawn on timer readings: DVFS makes them incomparable across resolutions, 13.12). Tests: t_gl_inverse (guard), `half_micro.js`, `zih_seq.js` |
| P2-E4 | Without timer queries input-paced frames count as over budget (medium) | **Accepted** | The fallback reads the frame lag. Tests: `pr_k_wheel.js`, `lag_slow.js` |
| P2-E5 | Guard decisions never recover; key ignores opacity (medium) | **Accepted** | B class in the key; recovery rules. Tests: t_gl_inverse (guard exits), `pr_p_sticky_alpha.js` |
| P2-E6 / P2-R1 | Opacity slider compiles mid-drag: stalls and forward stand-ins (medium / high) | **Accepted** | Another ready, warm B class draws during continuous motion (not a hover or a single change); new classes warm at the next quiet moment. Tests: `alpha_drag.js`, `rv_alpha.js`, `rv_alpha2.js`, `alt_hover.js`, `ex_load.js` |
| P2-E7 | Wheel notches alternate soft / sharp frames (medium) | **Accepted** | Half only in continuous motion. Test: `wheel_alt.js` |
| P2-E8 | Paired gate red in chain4 panL and sphere orbit (low) | **Accepted** | Cause: the measuring bracket split the right pane's pass during left-plane drags (a drag is motion); the bracket is now split-free. Paired re-run (13.12): `image.chain4.m1920` and `sphere.default` pass |
| P2-E9 | Parameter scrubs add ~4 ms main thread with several bounded shapes (low) | **Accepted** | Coarse scissor boxes during interaction. Test: `pr_i_scrub.js` |
| P2-E10 | Compile + first draw gate only measured warm; SwiftShader ratio partly vacuous (low) | **Accepted** | `examples.cold` (info), `inv_share_on`; open question 7 stays the lead's |
| P2-R2 | Adding a step: forward stand-in and a hitch after the transition (medium) | **Accepted in part** | The program compiles during the transition: no stand-in. The first-draw stall remains on the last frame (open question 7). Test: `trans_add.js` |
| P2-R+ | Further integration findings of the review (the list handed to the fixer was cut off after P2-R2) | **Partly** | From the reviewers' command outputs: a Möbius step with c = 0 counted as a non-affine prefix (exp(2z + 1) of H went forward): fixed (t_p2fix (7)); timer brackets on panes drawing only forward shapes: free now (split-free bracket). Not addressed: opening the Sphere view in P2 shows the forward globe without fix-ups for ~0.1–0.2 s (P3 draws the globe inverse) |

### P2 finish (the user's rule "60 fps is enough", 2026-10-20; measurements in 13.13)

| # | item | resolution |
|---|---|---|
| F1 | An interrupted shader optimisation on disk (pattern-conditional coordinates, vJac, twin angle) | Complete and correct: kept (pixel A/B, parity); nothing was half-done |
| F2 | The cost guard's budget, min(4 ms, 25 % of the display interval), switched 62–81 % of ordinary dpr-2 pan frames to half resolution | Fixed 60 Hz budget of 8 ms per pane (derived from the suite's 12 ms ceiling and measured frame overheads; half each when both panes draw inverse passes), half resolution before demotion, demotion last, hysteresis by probes (exit 5 ms, gaps 4–32 s); D8, 10.12; t_gl_inverse |
| F3 | Half-resolution warm-up landing between gestures (expH.a30 wheel latency 117 ms); the upsample program compiled and built its pipeline in the first half frame (251 ms) | Half pipelines and the upsample program are warmed together, only after 1 s without motion; the guard rarely trips on the M4 now |
| F4 | A program's first draw (75–205 ms GPU stall) landed in frames, inside a concurrent pan when no other B class was warm | Live frames never draw a cold program; it is warmed at the first idle moment (`GLR.onReady`, also for compiles that land inside a draw or a status query; thumbnails schedule it too); 4.4 |
| F5 | exp(H) / z^i(H) at α 0.3, dpr 2 on the 12 ms ceiling | The B = 8 admission path (exact; 0 pixels differ over 120 renders): exp(H) α 0.3 −27 % per pass |
| F6 | sphere.default orbit and m1920 panL failures | No P2 work on those frames (profile, byte-identical forward code); order and load effects; 13.13 |
| F7 | t_cx_stable flaky | Seeded; tolerances scaled by the old formulas' rounding error |
| F8 | `GPU_DISJOINT_EXT` read on every frame while brackets were outstanding (a synchronous GPU-process round trip) | Read only when a timer result is available |

### P2 gate round 1 (8 frame p95 metrics failed in both paired runs; measurements in 13.14)

| # | finding | resolution |
|---|---|---|
| G1 | exp(H) / z^i(H) at α 0.5 and 0.3, dpr 2: pan and zoom frames p95 12.2–14.6 ms (7 metrics) | Root cause: the GPU's clock follows its load, so a frame clears the 12 ms ceiling only when all its work fits the low clock (~2.2 ms at full clock); the exact pass was 3.2–4.8 ms. Half resolution in motion for these panes, predicted from the passes' structure (`GLR.inverseEstimate`, `predictLevel`, the guard's floor) and drawn before the main pass (`beginHalfPre` / `compositeHalf`); exact at rest, in thumbnails and exports; 10.12 |
| G2 | The half-resolution path saved little when it ran (p95 10.3–12 ms forced) | It split the multisampled main pass; now a pre-pass. Its pipelines warm with the program when predicted (4.4) |
| G3 | The walk visited the whole window at α ≤ 0.5 although the tail closure discards those members | The tail rule (3.6, `prep.tail`, `ixDKTail`): the same composite; −21 % to −36 % per pass |
| G4 | Each stopping side walked one member past the front | The stop's bound starts at the next member (3.6): one leaf fewer per side, −15 % to −25 % per pass, pixel-identical |
| G5 | `image.default.m480.panR` (dpr 1): frames 9–11 ms in both apps, 5 ms of them on stroke pile-ups at w = ±1 | The line pile-up cull (9.1): pan p95 11.5 → 7.6 ms (reference → this build); strokes change only at pile-ups |
| G6 | z^i(H) at α 0.85, dpr 2 (exact in motion): frame p95 11.3–13.0 ms (inside the 14 ms budget, over 12 in a slow state) | Kept exact; the lead's call (13.14) |
| G7 | New with half resolution in motion: the exact settle frame after a gesture, on a lowered clock (`settle_jank_ms` up to 19.1 ms for z^i(H) α 0.3 zoomed in; budget 20) | Measured and documented; a two-frame settle is the remedy if needed (13.14) |
| G8 | Full gate: `examples.5.inv_first_draw_ms` 266 ms in one rep (a pause landing on T = 1: a cold compile, open question 7) | Not reproduced in the unit's re-run (no inverse program in 3 reps); noise by the gate's rule (13.14) |

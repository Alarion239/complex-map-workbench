# Exact images through infinity: per-pixel inverse rendering, with a Riemann-sphere forward fallback

Implementation spec (lead architect). Inputs: `inverse-first.md`, `sphere-native.md`, `incremental.md` (same folder),
their prototypes under `notes/proto/`, and the lead's own prototypes in `notes/proto/lead-inv/` (section 13). Nothing in
`src/` has been edited. Every number quoted as "measured" comes from a prototype that was actually run; everything
else is labelled an estimate.

Reading guide. Section 0 holds the decisions. Sections 2–7 cover the primary renderer (inverse), section 8 the
fallback (forward sphere mesh), section 9 the lines, section 10 the app wiring, section 11 the phases, and section 12
the tests. Parallel owners are listed in 11.0. The interfaces between files are the contracts in 3.1, 3.2, 4.1, 4.5,
8.2 and 9.2.

---

## 0. Decisions

**D1. The primary renderer of mapped areas works per pixel, backwards.** For each pixel w of a view that shows a
mapped area (Image mode on the right plane, the Sphere view of images, and the left plane when `leftStage() > 0`), the
GPU lists **every** preimage z of w through the chain. It walks the steps backwards and, at each step, enumerates all
branches of its closed-form inverse. Each branch carries a signed "range level" that encodes the forward step's own
branch (cut and sheet). The region is then tested at each candidate, the covering candidates are composited in sheet
order, and the pass stops once the result can no longer change by 1/255.

The renderer never needs a value at infinity or at an essential singularity, because a pixel never asks for one. The
z^i hole is empty because no candidate there passes the branch test. Rims are exact because coverage is analytic.
Infinitely many sheets cost a window of 2M + 1 members with an exact early stop.

This is the user's suggestion ("apply the inverse function and get the results"). The hover tool's Newton search is
**not** the engine: it is slow per pixel and cannot guarantee all preimages. The engine is the closed-form enumerator
table of section 3, which the hover tool may later reuse (phase P6).

**D2. Every area shape uses the inverse path whenever its map spec is eligible, not only "hard" shapes.** Eligible
means: map mode 0 (stages a..b), every live step in (a, b] has an enumerator (3.3), within the caps (3.4), and the
inverse program has compiled. Reasons:

- **One look and one order.** Boundaries and patterns are exact in every shape, and a single sheet order (section 5)
  applies within and across shapes. A scene that mixes a bounded and an unbounded shape under the same map no longer
  shows two renderers.
- **No classifier.** A "hard shape" test needs pulled-back singular points, a view-dependent truncation test and
  hysteresis (inverse-first section 2). It would switch paths on zoom, which pops, and a wrong verdict leaves today's
  defects. With D2 the path depends only on the chain, the map mode and the program state, never on the view.
- **Less work.** Eligible shapes need no fix-ups, no map cache and no CPU refinement: settle work drops to zero, and
  figure export and thumbnails are exact at any resolution with no wait.
- **The price is small, and was measured.** Golden diffs were predicted with an emulation of today's forward draw
  (the real `Region.buildMesh`, L = 4 template, 0.2-edge midpoint test, linearly interpolated source, mesh order)
  against the inverse path, using the suite's own `golden_diff` metric with the strokes and casing kept on the line
  renderer:

  | control | golden_diff |
  |---|---|
  | `disc_cube` | 0.000 % |
  | `joukowski` | 0.000 % |
  | `poly_mobius` | 0.000 % |
  | `annulus_log` | 0.011 % (24 px under the cut-line strokes) |

  The gate is 0.5 %. The tie rule of 5.2 is load-bearing: reversing it raises `disc_cube.pattern` to 0.293 %.
- **GPU cost is low** on the suite's machine (4.7, measured): 0.5–1.1 ms per pane pass at dpr 1, and 1.0–2.2 ms at
  dpr 2.

  Shapes on an ineligible map spec, and every shape while the inverse program compiles, use the forward path (D3).

**D3. Forward fallback: sphere-native as the backbone.** Ineligible map specs use the forward path: d/dz in range,
custom formulas in which z occurs more than once, polynomials of degree 3 or more that are not a monomial plus a
constant, rationals of degree 3 or more, IPOW with |n| > 16, too many nested families, homotopy frames (morph,
transitions), a compile gap, or the user switch "exact images" off.

- Bounded shapes whose CPU scan finds no trouble keep **today's GPU path and `computeFix` bit for bit**.
- Unbounded or stretched shapes, and troubled bounded shapes, are drawn from a **SphereMesh**: the Riemann-sphere NVB
  mesher of `sphere-native.md`, refined on the CPU in the image metric with saturation and the quiet rule, and drawn as
  CPU pre-mapped triangles. It takes the lead's stage-wise limit evaluation and, later, the catalog cut constraints
  (8.10).
- Motion frames (a playing morph, transitions, drags) keep today's GPU path as they are.

The incremental design was not chosen as the backbone. Its core/layer seam needs `invariant gl_Position` agreement
across programs (a risk on ANGLE), claims and frozen edges. It is also slower: e^{1/z} takes 4 s against 0.5–0.8 s.

**D4. Strokes stay on the line renderer.** Golden strokes are therefore untouched. Phase P4 gives long curves (lines,
rays, half-plane and sector boundaries, formula contours that reach the mesh's outer box) geometric reach toward
infinity. It also adds geometric sampling toward the chain's singular points, so boundary strokes reach the view edges
at any zoom. A CPU image-metric curve sampler is a later option (P6).

**D5. One sheet order everywhere.** Front to back by the key D(z) (section 5). Ties (both candidates inside the source
window and away from accumulation points) go to the larger Im z, then the larger Re z, which is today's mesh draw
order. The fallback uses the same tie rule.

**D6. A spherical checker pattern (id 8, "Sphere checker").** It has 16 longitude sectors × 8 latitude bands of the
app's own Riemann sphere, scaled by the pattern-size control; 128 cells cover C ∪ {∞}. The definition is in 6.3.

**D7. No value at infinity is ever assumed.**
- The inverse path does not evaluate F at all.
- The fallback classifies vertices as FIN, INF or UNDEF by stage-wise limits (8.4), and uses a value at ∞ only where
  a limit exists (Möbius maps).

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
| performance risk | GPU per pixel: ~1 ms measured (4.7); no CPU | CPU settle 25–800 ms (projected 3–5× less) | CPU settle up to 4.7 s |
| implementation risk and size | enumerator table plus GLSL generator; cut and sheet semantics must match (round-trip tested) | ~900-line mesher plus pre-mapped draw; incremental pans are complex | largest: core/layer interface, claims, invariance |
| fit with existing code | reuses `drawPreimage`'s shape records, `GLChain` cells and pattern code | replaces the fix-ups for unbounded shapes | keeps the core but adds a second geometry system |
| what it cannot do | non-invertible chains, homotopy frames | — (any F) | — (any F) |

**Verdict.** inverse-first is the primary renderer (D1, D2), sphere-native is the fallback (D3), and incremental
contributes test ideas: the T-junction checker and the two-colour crack test (12.4). Each design's prototype was
re-run, or its numbers re-measured, by the lead (section 13).

---

## 2. Architecture

### 2.1 Paths

| draw | path |
|---|---|
| right plane, Image mode, still map (mode 0), eligible | **inverse** (`GLR.drawInverse`, flat) |
| Sphere view, image mode, still map, eligible | **inverse** (`drawInverse`, globe geometry) |
| left plane at `leftStage() > 0`, eligible | **inverse** (role L, stages (0, leftStage]) |
| thumbnails (`renderThumb`), figure export (`renderOff`) | as the view they draw |
| left plane at stage 0, identity maps (`GLR.isIdent`) | today's `region0` draw: unchanged |
| ineligible still map, unbounded/stretched or troubled shape | **SphereMesh** (pre-mapped), with today's GPU draw until it is ready |
| ineligible still map, bounded clean shape | today's GPU path plus `computeFix`: unchanged |
| homotopy frames (morph playing, transitions), drags of a shape | today's GPU path, no CPU work: unchanged |
| paused morph frame (mode 1/2 at fixed t) | ineligible: SphereMesh or today's path plus `computeFix` as above (P6: invertible homotopies become eligible) |
| inverse program pending (compiling) | today's GPU draw as a stand-in; no `computeFix` and no SphereMesh for it |
| inverse program failed to compile | forward, with fix-ups or SphereMesh as for an ineligible map; reported in the console |
| Phase, Landscape, phase sphere, Preimage targets | unchanged |
| strokes (boundaries, curves) | line renderer (today's), with P4's reach extension |

### 2.2 Path selection (app.js)

```js
// role: 'R' | 'L' | null (thumbnail); map: GPU map spec; s: area shape
pathOf(s, map, role) =
  !GLR.ok || isIdent(map)                     -> 'forward'          // identity draws stay as today
  !S.exactImages                              -> 'forward'          // hidden switch (tests, debugging), default true
  (map.mode || 0) !== 0                       -> 'forward'          // homotopy frames
  !(plan = invPlan(map.a, map.b)).ok          -> 'forward'          // Inverse.planChain, cached per rebuild()
  s._err || !GLR.inverseReady(key(s))         -> 'pending' ('forward' stand-in; starts the compile)
  otherwise                                   -> 'inverse'
```

`invPlan(a, b)` is computed once per `rebuild()` and range. `key(s)` is the inverse program key: the chain's inverse
key, plus the formula source when s is a formula shape. `'pending'` draws forward and requests a render on
`GLR.onReady`.

### 2.3 Mixed scenes and compositing order

- **Within a pane.** `drawScene` draws fills in shape-list order, as today: each shape completes all its sheets before
  the next shape starts. On the inverse path each shape is one full-pane pass, scissored when possible (4.7). It
  writes premultiplied colour, blended `ONE, ONE_MINUS_SRC_ALPHA` over what is already there. A forward shape draws
  its mesh at its list position, so list order is exact across paths.
- **Within a shape**, the inverse path composites front to back in D order with saturation (4.2). The forward fallback
  draws far to near by D (8.6). Strokes are drawn after all fills, as today.
- **Same look.** A shape on either path uses the same pattern formulas (6.1), the same colours and the same α. Its
  sheets follow the same D and tie rule (forward: per triangle; inverse: per pixel). Its boundary stroke comes from
  the same line renderer.

  The inverse path also has analytic edge AA, which shows only within 0.5 px of rims; those pixels lie under the
  3.5 px stroke casing. The paths differ visibly only where the forward path is wrong today.

### 2.4 When paths switch

A shape changes path only when one of these changes:
- chain structure (a compile follows);
- eligibility, because of a parameter: a degenerate Möbius map, `pown` 0, polynomial degree;
- map mode: morph play or pause, transitions;
- program state;
- the `exactImages` switch.

**Never on pans, zooms or orbits.**

- A switch to the inverse path replaces the forward image in one frame. Where the forward image was right, the change
  is invisible (golden emulation, D2).
- A switch to the forward fallback shows today's GPU image until the SphereMesh job publishes, which is today's
  fix-up behaviour.
- Program compiles run in the background (`KHR_parallel_shader_compile`); a frame never waits for a compile, except
  `renderOff` (10.6).

### 2.5 Unchanged

The left plane at stage 0, Phase, Landscape, the phase sphere, Preimage targets (`drawPreimage`), the line renderer's
shaders, the map cache (still used by forward draws), `Region.buildMesh` (still meshes the left plane and the
forward paths), the morph and transition renderers, and saved state (one new optional boolean, `exactImages`).

---

## 3. `src/inverse.js`: the CPU enumerator (pure JS, node-testable)

New file, loaded after `funcs.js` and before `calc.js`/`glsl.js` (`build.py` order: cx, parse, funcs, **inverse**,
calc, glsl, region, **sphere**, gl, view, app). It references `Region` only inside functions (runtime), never at load.
The prototype `notes/proto/lead-inv/inverse_proto.js` is a working version of 3.2–3.5, without the pruning, singular
points and caps of 3.4, 3.6 and 3.7.

### 3.1 API

```js
Inverse.stepOps(b)                     // b: a Funcs.build() result -> {ok: true, ops: Op[]} | {ok: false, reason}
Inverse.planChain(steps, built, a, b)  // -> Plan (3.4); off/error steps are the identity (as GLChain)
Inverse.prepare(plan, {win, shape})    // -> Prep (3.6): per-view data for one shape; cheap, cached by the app
Inverse.enumerate(plan, prep, w, pix, opts) // -> Leaf[] (3.5): CPU twin of the GPU walk (tests, hover)
Inverse.sheetKey(prep, z, lam)         // -> D (section 5)
Inverse.front(a, b)                    // -> true when candidate a is in front of b (D, then tie: 5.2)
Inverse.singular(plan, win, kinds)     // -> [{z: C, kind: 'undef'|'branch'|'pole'}] pulled back to the z-plane (3.7)
Inverse.renderCPU(plan, shapes, view, look, prep) // -> {rgba, stats}: the reference renderer (3.9, tests only)
Inverse.M_WIN = 8; Inverse.LEAF_CAP = 64; Inverse.RAMP = 1; Inverse.IPOW_MAX = 16;
```

Types (C = `{re, im}`):

```
Op     = {kind, step: k, node: i, p: {...params}, fwd(u) -> C, pre(w, ref, clamp) -> Member[],
          nb (bases, number or function of w), family: 'one'|'finite'|'window', period?: C,
          undef: (C|null)[] (input-plane points without a limit; null = infinity), poles: C[] (input points mapped to infinity)}
Member = {u: C, d: C (du/dw) | anti: true, lvl: number (output units, +Infinity = no range constraint),
          lg: C (unit gradient of lvl in the output plane), lam: C|null (log u), base: int, m: int}
Plan   = {ok, reason, ops: Op[] (forward order), sig: string (structure: op kinds + modes), a, b,
          M: int[] (window half-size per op), stopOp: int (-1 or the op index of the early stop), leafBound: int,
          injective: bool (every op single-valued)}
Prep   = {refs: C[] (per op input), win: {x0,y0,x1,y1}, R, rs, sing: C[] (<= 4), clamps: ({e: C, lo, hi, Ainv: C, Binv: C}|null)[]}
Leaf   = {z: C, J: [a, b, c, d] (dz/dw, real 2x2 row-major), lvl (px), lg: [x, y] | null (unit, image space), lam: C|null, path}
```

### 3.2 The op table (CPU and GLSL share these semantics exactly)

Notation:
- An op maps u → w. Log is principal (Arg in (−π, π], atan2 semantics).
- For a branch (θ, k): lo = θ − 2π + 2πk and hi = θ + 2πk, so Im log_{θ,k} u ∈ (lo, hi].
- "Centre" is the member index m* around which a window is scanned. ref is the op's input-plane reference point (3.6).
- Periodic families have u = base_b + m·p; their centre is m* = round(Re((ref − base_b)/p)).

| kind | forward f(u) (the app's own code) | params | members of pre(w) | du/dw | range level lvl, gradient lg | Λ | family, centre | undef / poles |
|---|---|---|---|---|---|---|---|---|
| AFF | a u + b | a ≠ 0, b | (w − b)/a | 1/a | – | – | one | – / – |
| MOB | `CX.mobApply([a,b,c,d], u)` | invertible (props.mobius) | (d w − b)/(−c w + a); none at w = a/c | (ad − bc)/(−cw + a)² | – | – | one | – / −d/c |
| IPOW | `CX.ipow(u, n)` | n ≠ 0, \|n\| ≤ 16 | q = w (n > 0) or 1/w (n < 0); u_j = \|q\|^{1/\|n\|} e^{i(Arg q + 2πj)/\|n\|}, j = 0..\|n\|−1 (bases); w = 0, n > 0: u = 0 | u/(n w) | – | – | finite: \|n\| bases | – / 0 if n < 0 |
| ROOTPOW | `CX.pow(u, s, θ, k)` (root: `powReal(u, 1/n, θ, k)`) | s ≠ 0; β = 1/s; lo, hi; \|s\|; mode | L_m = β(Log w + 2πi m), u_m = e^{L_m}. mode **int** (β real integer): one member, m = round(((lo+hi)/2 − Im βLog w)/(2πβ)). mode **finite** (Re β ≠ 0): m ∈ [⌈min(x_a, x_b)⌉ − 1, ⌊max(x_a, x_b)⌋ + 1], x = (lo or hi − Im βLog w)/(2π Re β); over 17 members: window. mode **inf** (Re β = 0): window | β u / w | min(Im L − lo, hi − Im L)·\|s\|·\|w\|; lg = ±(i·conj(β/w))/\|·\| (+ when Im L − lo is the smaller) | L_m | window centre m* = round((Re βLog w − ln\|ref\|)/(2π Im β)); finite (no window): middle of the range | 0 and ∞ when mode inf or s non-real / 0 if Re s < 0 |
| EXP | `CX.exp` | – | Log w + 2πi m; none at w = 0 | 1/w | – | – | window, p = 2πi, m* = round((Im ref − Arg w)/2π) | ∞ / – |
| EXPC | e^{u L0} (custom c^g, L0 = principal Log c) | L0 | (Log w + 2πi m)/L0 | 1/(L0 w) | – | – | window, p = 2πi/L0 | ∞ / – |
| LOG | `CX.log(u, θ, k)` | θ, k | e^w | e^w | min(Im w − lo, hi − Im w); lg = ±i | w | one | – (branch 0, ∞) / 0 |
| SIN | `CX.sin` | – | bases asin w, π − asin w; p = 2π | 1/cos u | – | – | window, 2 bases | ∞ / – |
| COS | `CX.cos` | – | bases acos w, −acos w; p = 2π | −1/sin u | – | – | window, 2 bases | ∞ / – |
| TAN | `CX.tan` | – | base atan w; p = π; none at w = ±i | 1/(1 + w²) | – | – | window | ∞ / π/2 + πn |
| SINH | `CX.sinh` | – | bases asinh w, iπ − asinh w; p = 2πi | 1/cosh u | – | – | window, 2 bases | ∞ / – |
| COSH | `CX.cosh` | – | bases acosh w, −acosh w; p = 2πi | 1/sinh u | – | – | window, 2 bases | ∞ / – |
| TANH | `CX.tanh` | – | base atanh w; p = iπ; none at w = ±1 | 1/(1 − w²) | – | – | window | ∞ / i(π/2 + πn) |
| ASIN | `CX.asin` | – | sin w | cos w | π/2 − \|Re w\|; lg = (−sgn Re w, 0) | – | one | – |
| ACOS | `CX.acos` | – | cos w | −sin w | min(Re w, π − Re w); lg = (±1, 0) | – | one | – |
| ATAN | `CX.atan` | – | tan w | 1/cos² w | π/2 − \|Re w\| | – | one | – |
| ASINH | `CX.asinh` | – | sinh w | cosh w | π/2 − \|Im w\|; lg = (0, −sgn Im w) | – | one | – |
| ACOSH | `CX.acosh` | – | cosh w | sinh w | min(Re w, π − \|Im w\|) | – | one | – |
| ATANH | `CX.atanh` | – | tanh w | 1/cosh² w | π/2 − \|Im w\| | – | one | – |
| JOUK | (u + 1/u)/2 | – | e = w + √(w−1)√(w+1) (principal roots); bases e, 1/e | 2u²/(u² − 1) | – | – | finite, 2 | – / 0 |
| IJOUK | u ± √(u−1)√(u+1) (the step's f) | σ = +1 exterior, −1 interior | (w + 1/w)/2 | (1 − w⁻²)/2 | σ(\|w\| − 1); lg = σ w/\|w\| | – | one | – |
| CONJ | conj u | – | conj w | **anti** (J ← diag(1, −1)·J) | – | – | one | – |
| QUAD | a u² + b u + c | a ≠ 0 | s = √(b² − 4a(c − w)), negated when Re(conj(b) s) < 0; q = −(b + s)/2; u₁ = q/a, u₂ = (c − w)/q | 1/(2au + b) | – | – | finite, 2 | – |
| RAT2 | p(u)/q(u), degree 2, coprime | p, q padded to degree 2 | A = p₂ − w q₂, B = p₁ − w q₁, C = p₀ − w q₀; \|A\| ≤ 1e−14(\|B\| + \|C\|): u = −C/B; else as QUAD | q²/(p′q − pq′) | – | – | finite, ≤ 2 | – / roots of q |

Members whose range level, converted to pixels (3.5), is below −RAMP = −1 px are not preimages and are dropped. Ramp
members are kept for anti-aliasing only.

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

**Measured** (`t_roundtrip.js`, 13.1): 104 step cases covering every catalog type, random parameters, cuts and sheets,
and 21 custom formulas. 0 unsound candidates, 0 missed preimages, 0 decomposition errors. Ineligible as intended:
`z^3 − z`, degree-3 rational, `z^2 + 1/z`.

### 3.4 Plans, eligibility and caps (`planChain`)

```
planChain(steps, built, a, b):
  ops = concat over live steps k in (a, b] of stepOps(built[k-1]).ops     (an ineligible step -> {ok: false, reason})
  multi = ops with family 'finite' or 'window' (IPOW counts its |n| bases)
  inner = the multivalued op nearest z (smallest index)
  M[j] = 8 for inner if it is a window family, 2 for every other window family
  bound = product over multi of nb(j) * (window ? 2 M[j] + 1 : finite count <= 17)
  while bound > LEAF_CAP (64) and M[inner] > 4: M[inner]--, recompute
  bound > 64 -> {ok: false, reason: 'too many preimage branches'}
  stopOp = inner if inner is a window family and every op between inner and z is AFF or MOB, else -1
  sig = ops.map((o) => o.kind).join(',')     // ROOTPOW modes, n, M, clamps are uniforms: alpha drags never recompile
  return {ok: true, ops, M, stopOp, leafBound: bound, injective: multi.length == 0, sig, a, b}
```

The GLSL structure depends only on `sig`, so a parameter change recompiles nothing. A change in eligibility, such as
a Möbius map that becomes degenerate, switches the path, not the program. A polynomial whose zero pattern changes its
decomposition (QUAD ↔ IPOW + AFF) changes `sig`, and so recompiles.

### 3.5 Backward enumeration (CPU twin of the GPU walk)

```
enumerate(plan, prep, w, pix):            // pix: w-units per image pixel
  leaves = [{u: w, J: I, lvl: +inf, lg: null, lam: null}]
  for j = N-1 down to 0:                  // ops in reverse
    next = []
    for L in leaves:
      sc = sqrt(|det L.J|)                // |dw_j/dw|: L.J = d(current value)/dw
      for mem in members(op_j, L.u, prep.refs[j], prep.clamps[j], plan.M[j]):  // in outward order (3.6)
        lv = mem.lvl == +inf ? +inf : mem.lvl / (sc * pix)
        if lv < -RAMP: continue
        lg = L.lg
        if lv < L.lvl and mem.lg: lg = normalize(L.J^T * mem.lg)       // image-space gradient of the binding level
        J = mem.anti ? diag(1,-1) * L.J : C(mem.d) * L.J               // C(d): [d.re -d.im; d.im d.re]
        next.push({u: mem.u, J, lvl: min(L.lvl, lv), lg, lam: j == 0 ? mem.lam : null})
    leaves = next
  return leaves                           // u is now z
```

The GPU uses the same order (4.1). Its early stop (3.6) visits a prefix of the same candidates and yields the same
front K (measured: 0 mismatches, 13.3).

### 3.6 References, windows, pruning, early stop (`prepare`)

- **Reference point.** c_ref is the centre of `clipWin`, the meshing window: the left view that last settled. If any
  op input along the forward chain of c_ref is non-finite, nudge c_ref by (W/4)·e^{0.3i}, with W the window width.
  `refs[j]` is the forward value at op j's input, so window families are centred on the sheet the left plane shows.
- **Windows.** A window family scans members m*, m*+1, m*−1, m*+2, … within [m* − M_j, m* + M_j], intersected with
  its clamp.
- **Pruning (clamps).** Some family ops have an input plane that is an affine image of z (every op before j is AFF,
  composite u = A z + B) and an additive period p (EXP, EXPC, SIN, COS, TAN, SINH, COSH, TANH). For these:
  - q = p/A and e = q/|q|;
  - [lo, hi] = `Region.supportOf(shape, e)` (3.8);
  - per pixel and base, with t₀ = ⟨(base − B)/A, e⟩, only members m ∈ [⌈(lo − t₀)/|q|⌉ − 1, ⌊(hi − t₀)/|q|⌋ + 1]
    are scanned.

  This is exact (never prunes a covering member) because the support is conservative. Measured by inverse-first: exp
  of a strip goes from 17 candidates to 0.6–1.2, sin of the half-strip from 34 to 1.1–1.2.
- **Early stop.** When `stopOp` ≥ 0, a scan direction of that op stops at its first member whose leaf key D exceeds
  D_K. D_K is the K-th smallest key among covering leaves so far (+∞ until K exist; K from α, 4.2). D grows
  monotonically outward for every catalog family when only AFF/MOB ops lie between the family and z.
  - Measured exact: 0 front-K mismatches in 5 scenes × 52k pixels.
  - Members per pixel (K = 1 / K = 3): z^i 9.5 / 10.6; exp(H) 3.9 / 7.7; e^{1/z} 3.2 / 5.2, out of 17.
  - Unpruned single-cover scenes (exp strip, sin half-strip) scan the whole window at K = 3. Pruning handles those.

### 3.7 Singular points (`singular`) and the accumulation set P

- **Per op**, `undef` lists the input points around which sheets accumulate: ROOTPOW in mode inf or with non-real s
  (0 and ∞), and every window family (∞). LOG and ROOTPOW also list branch points; `poles` lists points mapped to ∞.
- **Pull-back.** To pull a point back to the z-plane through ops j−1 … 0:
  - a finite point goes through each op's own enumerator, with the window centred near the source window, keeping
    members within 64·R of `clipWin`;
  - ∞ goes through the op's `poles` (MOB: −d/c; IPOW n < 0: 0; LOG: 0; JOUK: 0; RAT2: roots of q; TAN, TANH: members
    of their pole lattice within 64·R). AFF and EXP keep ∞ at ∞.
- **The accumulation set** P = the finite pulled-back `undef` points, at most 4, nearest `clipWin` first. Examples:
  e^{1/z} → {0}; z^i → {0}; exp, sin, log, Cayley → {}.
- `singular(..., kinds)` also returns branch points and poles, for the line sampler (P4).

### 3.8 `Region.supportOf(s, e)` (new, `src/region.js`)

It returns [inf ⟨z, e⟩, sup ⟨z, e⟩] over the shape, with ⟨z, e⟩ = Re(z·conj e), and ±Infinity when unbounded. It is
conservative: it may be wider than the truth, never narrower.

| shape | support |
|---|---|
| disc | ⟨c, e⟩ ∓ r |
| annulus | as the disc of radius r₂ |
| rect, polygon | min/max over the vertices |
| sector, r > 0 | as the disc (c, r) |
| sector, r = 0 | [−∞, ∞] |
| halfplane (inside = left of a→b, unit normal n = i·(b−a)/\|b−a\|) | if \|⟨e, n⟩\| ≥ 1 − 1e−12: one-sided at ⟨a, e⟩ (lower bound when ⟨e, n⟩ > 0, upper otherwise); else [−∞, ∞] |
| formula | the box of the recognizer below, else [−∞, ∞] |
| complement | [−∞, ∞] |

**The recognizer.**
- On a comparison with a real constant c on one side and Re z, Im z, |Re z|, |Im z| or |z| (also x, y, r) on the
  other: Re z < c gives x₁ = c; |Im z| < c gives y ∈ [−c, c]; |z| < c gives x, y ∈ [−c, c]; mirrored for >.
- `and` intersects boxes; `or` takes their hull; `not` and anything else give the whole plane.
- Examples: `|\Im z|<\frac{\pi}{2}` gives y ∈ [−π/2, π/2]; `|\Re z|<\frac{\pi}{2}, \Im z>0` gives x ∈ [−π/2, π/2],
  y ≥ 0.

### 3.9 CPU reference renderer (`renderCPU`)

This is a port of `notes/proto/lead-inv/render.js`, used by node tests. Per pixel it runs `enumerate`, the region
coverage with the facing rule (4.2), D and the tie rule, B-buffer compositing and analytic pattern footprints, all in
float64. Its output is scored with `test/regress/quality/metrics.js`.

### 3.10 Correctness contract (unit-tested, 12.1)

- **Soundness.** Every member with lvl > 1e−7 maps back: |f(u) − w| ≤ 1e−8 (1 + |w|), with f the step's own
  `Funcs.build().f`.
- **Completeness.** For random u in the domain, w = f(u) has u among its members when the window is centred at u
  (ref = u).
- **Decomposition.** Composing the ops' `fwd` equals `b.f` to 1e−9.
- **Range sign.** For single-valued range ops, lvl > 0 if and only if f(pre(w)) = w (away from a 1e−9 band).
- **Determinism.** The same inputs give the same member order.

---

## 4. The GPU inverse renderer

### 4.1 GLSL generated by `src/glsl.js`

`GLChain.build(steps, built)` gains `inverse`:

```js
inverse: {
  key: JSON.stringify(['inv1', planSigForAllSteps]),    // structure only; op kinds of every live step
  source: '...',                                       // GLSL below (declares uChain itself, same slot count)
  ops: [{kind, step, j}],                              // j: op index in forward order (all live steps)
  nOps: N,
}
```

`fill()` also writes the inverse cells: ops allocate cells from the **same** allocator as the forward plans, so one
`uChain` upload serves both. The decomposition comes from `Inverse.stepOps` (the same function as the CPU), so the CPU
plan and the GLSL never disagree on structure. A step whose `stepOps` fails gets `ixJ_one` returning false; the CPU
plan marks every range containing it ineligible.

**Fixed library** (`INV_LIB`, constant text in glsl.js, appended to `GLChain.LIB` in the inverse program):

```glsl
struct Lf { vec2 u; vec4 J; float lvl; vec2 lg; vec2 lam; bool hasLam; };   // J: dz/dw row-major (x y; z w)
float ixPix;                                          // w units per pixel of this pass (set by main)
const float IX_RAMP = 1.0;
vec4 ixMulC(vec2 d, vec4 J);                          // [d.x -d.y; d.y d.x] * J
vec4 ixConjJ(vec4 J);                                 // diag(1, -1) * J
float ixScale(vec4 J);                                // sqrt(|det J|)
Lf ixStart(vec2 w);                                   // {w, I, 1e38, 0, 0, false}
// apply one member to L (in/out); false when the member lies beyond the ramp
bool ixApply(inout Lf L, vec2 u, vec2 dudw, bool anti, float lvlOut, vec2 lgOut, vec2 lam, bool hasLam);
uniform int uIxA; uniform int uIxB;                   // stage range (a, b]
uniform vec2 uIxRef[N]; uniform float uIxM[N]; uniform int uIxStopOp;
uniform vec4 uIxClamp[N]; uniform vec4 uIxClampAB[N];  // (e.x, e.y, lo, hi) [lo > hi: none]; (Ainv.xy, Binv.xy)
bool ixAct(int k) { return uIxA < k && k <= uIxB; }
```

`ixApply` converts the op-unit range level to pixels (lvlOut / (ixScale(L.J)·ixPix)). When the new level binds, it
updates `lg` = normalize(Jᵀ lgOut) before updating J, exactly as 3.5.

**Per op j** (prefix `ixJ_`, parameters read from its cells, so modes and values are uniforms):

```glsl
bool  ixJ_one(inout Lf L);                                   // single-valued ops
int   ixJ_nb(Lf L);                                          // multivalued: number of bases for this w
void  ixJ_win(Lf L, int b, vec2 ref, out float ms, out float mlo, out float mhi);  // centre and range of base b
bool  ixJ_at(Lf L, int b, float m, out Lf R);                // member (b, m) applied to a copy of L
```

**The walker** is generated statically from the full op list, so its loop nest is fixed. An inactive op (its step is
outside (uIxA, uIxB]) is a pass-through: single-valued ops are skipped, and multivalued ops run one iteration with
R = L.

```
gen(ops N..1):
  "void invWalk(vec2 w) { Lf L0 = ixStart(w);"
  cur = L0
  for j = N down to 1:
    if single(j): "if (ixAct(k_j) && !ix{j}_one(cur)) <exit>;"           // <exit>: return at depth 0, else continue
    else:
      "for (int b = 0; b < NB_MAX_j; b++) {"                             // NB_MAX: 1, 2, or 16 for IPOW
      "  if (b > 0 && !ixAct(k_j)) break;  if (ixAct(k_j) && b >= ix{j}_nb(cur)) break;"
      "  float ms, lo, hi; if (ixAct(k_j)) ix{j}_win(cur, b, uIxRef[j], ms, lo, hi); else { ms = lo = hi = 0.0; }"
      "  bool dP = false, dM = false;"
      "  for (int t = 0; t < 17; t++) {"
      "    if (float(t) > 2.0 * uIxM[j]) break;"                         // finite ranges: uIxM = (hi - lo) / 2
      "    bool plus = (t & 1) == 0;  float m = ms + (plus ? 1.0 : -1.0) * float((t + 1) / 2);"
      "    if (m < lo || m > hi) { if (plus) dP = true; else dM = true; if (dP && dM) break; continue; }"
      "    if (plus ? dP : dM) { if (dP && dM) break; continue; }"
      "    Lf R = cur; if (ixAct(k_j) && !ix{j}_at(cur, b, m, R)) continue;"
      cur = R
  "float D = invLeaf(cur);"                                             // defined by gl.js (4.2)
  at the innermost loop of op j: "if (j == uIxStopOp && D > ixDK()) { if (plus) dP = true; else dM = true; }"
  close the braces
```

`ixDK()` is defined by gl.js's compositor. With the caps of 3.4 the nest visits at most 64 leaves.

### 4.2 `INV_FS` (src/gl.js): per-pixel coverage, sheet order, compositing

Program text order:

```
HEAD + GLChain.LIB + inverse.source (uChain, INV_LIB, ixJ_*) + UTIL + SHADE? + INV_HEAD (uniforms below,
shape level, sheetKey, compositor, patternColor, invLeaf) + inverse walker + INV_MAIN
```

**Uniforms** (beyond `uChain` and the `uIx*` of 4.1):

| group | uniforms |
|---|---|
| view (flat) | `uCenter` (hi), `uCenterLo`, `uInvScale`, `uVp`, `uDpr` |
| view (globe) | `uMVP`, `uEye`, light (`lightUniforms`), via `SPHERE_VS` |
| sheet key | `uWin` (x0, y0, x1, y1 of `clipWin`), `uWinR` (half-diagonal), `uWinRs` (= R/8), `uSing[4]`, `uSingN` |
| compositing | `uAlpha` (the shape's alpha, hover-dimmed), `uKsat` (K), `uBuf` (8 or 16; not `uB`, which is the map's stage uniform) |
| shape | `uPts` (texture unit 4: records as `drawPreimage` packs them, one record), `uShape` (kind, complement, first point, count), `uShA`, `uShB` |
| look | as `regionUniforms`: `uC0`, `uC1`, `uK`, `uPattern`, `uCell`, `uLines`, `uShrink`, `uGrow`, `uMid`, `uOrigin`, `uQ`, plus `uSphN` (spherical checker sectors) |

**Main** (flat; the globe variant is in 4.6):

```glsl
void main() {
  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);        // hi/lo, as view2D
  dwdX = vec2(uInvScale.x, 0.0); dwdY = vec2(0.0, uInvScale.y);   // globals used by invLeaf
  ixPix = uInvScale.x;
  nb = 0; nCov = 0;
  invWalk(w);
  // composite: coverage-union, front to back
  float U = max over buffer of bC; float T = 1.0; vec3 C = vec3(0.0);
  for i < nb: if (T < 1.0/255.0) break; float a = uAlpha * bC[i] / U; C += T * a * bCol[i]; T *= 1.0 - a;
  if (nCov > uBuf && T >= 1.0/255.0) { C += T * mean(bCol[0..nb)); T = 0.0; }  // tail closure (buffer overflowed)
  o = vec4(U * C, U * (1.0 - T));                         // premultiplied; blended ONE, ONE_MINUS_SRC_ALPHA
}
```

**Leaf** (one candidate z):

```glsl
float invLeaf(Lf L) {
  vec2 z = L.u;
  vec2 dX = vec2(L.J.x * dwdX.x + L.J.y * dwdX.y, L.J.z * dwdX.x + L.J.w * dwdX.y);   // dz per pixel step
  vec2 dY = vec2(L.J.x * dwdY.x + L.J.y * dwdY.y, L.J.z * dwdY.x + L.J.w * dwdY.y);
  float D = sheetKey(z, L);                                                       // section 5
  float sreg; vec2 nreg;
  shapePx(z, dX, dY, L, sreg, nreg);       // signed distance to the region boundary in px (+ inside), unit image normal
  float cv = (L.lvl < 1e30 && dot(nreg, L.lg) < -0.5)
      ? clamp(min(sreg, 0.5) + min(L.lvl, 0.5), 0.0, 1.0)   // facing boundaries: region continues across a cut
      : clamp(min(sreg, L.lvl) + 0.5, 0.0, 1.0);
  if (cv > 0.0) { nCov++; ins(D, z, cv, patternColor(z, dX, dY, L)); }
  return D;
}
```

**Buffer.** `ins` keeps the B best entries {D, z (for the tie), cv, rgb}, sorted front first (5.2), by insertion; it
drops the worst when full (the prototype's GLSL is in `gpu_bench_page.js`).

- K = 1 when α ≥ 0.999, else min(B, ⌈ln(1/255)/ln(1 − α)⌉): α = 0.85 gives 3, α = 0.5 gives 8.
- B = 8, or 16 when α < 0.5.
- `ixDK()` returns `bD[K−1]` when nb ≥ K, else 1e38.

**Coverage union.** All sheets of an infinitely-sheeted image share their rims. Compositing relative weights cv/U
and scaling by U gives the true area fraction at a rim, where 1 − Π(1 − cv) would thicken it. inverse-first measured
IoU 0.44 at the z^i 16× rim without this rule.

**Facing rule.** At log(H)'s Im w = −π the region boundary and the cut coincide with opposite orientation. Plain
min() paints a half-pixel ghost line there; inverse-first measured the coverage error drop from 0.43 to 0.02 with the
rule.

### 4.3 Shapes: level and gradient (`shapePx`)

The record layout is `drawPreimage`'s (`TKIND`, A, B, polygon points), built by a shared `packShape(s)` that
`drawPreimage` refactors out. L is the level of `Region.levelOf` (positive inside, NaN counts as outside), and g is
∇_z L. The pixel-space gradient is gpx = (⟨g, dX⟩, ⟨g, dY⟩), sreg = L/|gpx|, and nreg = gpx/|gpx|.

| kind | L | g |
|---|---|---|
| disc | r − \|z − c\| | −(z − c)/\|z − c\| |
| rect | min of the 4 side distances | gradient of the active side |
| polygon | ±(distance to the nearest edge) | ±(z − q)/\|z − q\|, q the nearest edge point |
| halfplane | cross(d̂, z − a) | i·d̂ |
| annulus | min(d − r₁, r₂ − d) | ±(z − c)/d |
| sector | as `angIn` and r − \|z − c\| | gradient of the active term |
| formula | compiled `ilevN(z)` (`GLChain.levelGLSL`) | central differences: gpx = ((L(z+dX) − L(z−dX))/2, (L(z+dY) − L(z−dY))/2) |
| complement | −L | −g |

**The Λ rule** (huge or tiny |z|). When `L.hasLam` and |Re Λ| > 60:
- halfplane through a and sector with r = 0 use the direction e^{i Im Λ} (|z| dominates |a|);
- bounded kinds are outside when Re Λ > 60;
- complements of bounded kinds are inside;
- formulas are evaluated at e^{min(Re Λ, 60) + i Im Λ}.

A candidate with |z| > 1e30 and no Λ is outside.

### 4.4 Programs

- **DEFS.** `inv:<hash>` (`QUAD_VS` + `INV_FS(forms, false)`) and `invS:<hash>` (`SPHERE_VS` + `INV_FS(forms, true)`)
  are chain programs. `sources()` prepends `GLChain.LIB + info.inverse.source` instead of the forward source (a new
  DEFS flag `inv: true`).
- **Formula variants.** These work like `preProgram`. Formula levels are compiled in as `ilev0..3` with a dispatcher
  `formulaLevel(i, z)`, at most 4 per program, and at most 4 program variants are kept (LRU). The hash covers the
  formula sources.
- **Compiles** run in the background like every chain program. `GLR.inverseReady(key)` reports whether a program is
  ready and, if not, starts the compile; `GLR.onReady` triggers a redraw.
- **Errors.** A failed compile marks the key failed for the session. The app then treats the map as ineligible and
  reports it in the console. The user sees no change from today, because the forward path draws.

### 4.5 `GLR.drawInverse(st)` (contract between gl.js and app.js)

```js
st = {
  map,                               // GPU map spec (mode 0)
  view, dpr,                         // flat; or sphere: {MVP, eye}
  shape,                             // the Region shape object (kind, params, complement, expr)
  look: {color, color2, edge, ink, alpha, pattern, cell, lines, stretch, origin, sphN},
  inv: {refs, M, stopOp, clamps, win, R, rs, sing, K, B},   // from Inverse.planChain + Inverse.prepare
  scissor,                           // optional [x, y, w, h] device px
}
returns 'drawn' | 'pending' | 'error'
```

The app calls it in the same slot where it would call `drawRegion` for that shape (10.2).

### 4.6 The globe variant (Sphere view, image mode)

- **Geometry.** The globe's own triangles, drawn after the globe like `drawPreimage`'s sphere branch: depth LEQUAL, no
  depth write, polygon offset (−1, −2).
- **Pixel position.** P = normalize(vP). If P.z ≤ 0, w = (P.x + iP.y)/(1 − P.z). Otherwise u = (P.x − iP.y)/(1 + P.z)
  and w = 1/u, which has no cancellation near the north pole.
- **Footprint.** `dwdX = dFdx(w)`, `dwdY = dFdy(w)` at the top of main (uniform control flow), and
  ixPix = sqrt(|det(dwdX, dwdY)|).
- **Output.** a = U(1 − T), rgb = `toSrgb(shade(toLin(U·C/a), n, v, 1.0))·a` (premultiplied), lit like `regionS`.
- **Coverage.** Poles are ordinary pixels: Cayley's w = 1 and 1/z's w = 0 need nothing special, and no chordal
  criteria are needed because every fragment is exact.

### 4.7 Performance budget and safeguards

**Measured** (`gpu_bench_page.js`, hand-written GLSL of this design; Apple M4, ANGLE Metal, headless Chrome 155):
GPU-synchronised time per full pane pass, including one 1-pixel readback.

| scene | 410×516 (dpr 1) | 820×1032 (dpr 2) | 1640×2064 |
|---|---|---|---|
| z^i(H), α 1 / 0.85 | 1.12 / 0.69 ms | 2.18 / 1.42 ms | 3.53 / 3.94 ms |
| exp(H) | 0.45 / 0.57 | 0.96 / 1.27 | 2.68 / 3.78 |
| e^{1/z}, disc | 0.48 / 0.57 | 1.07 / 1.33 | 3.09 / 3.94 |
| sin, half-strip (unpruned, 34 members, formula-style level) | 0.55 / 0.73 | 1.37 / 2.08 | 4.12 / 7.05 |

Read back in float32: the z^i hole has 0 of 148 pixels filled, the annulus 0 of 111,272 pixels empty, and the
outside 0 of 96,396 filled. Compile time of these small shaders is 2.1–2.6 ms; the real program also contains the
chain library (estimate: tens of ms, measured in P2).

**Safeguards.**
- **Scissor (P2).** For a bounded shape whose `supportOf` box contains no point of P and no pulled-back pole, the CPU
  maps 256 boundary samples and 64 interior samples through the stage map. Their bounding box plus 4 px is the
  scissor rectangle; the image of such a shape is bounded by its boundary image (maximum principle).
- **Pruning (3.6)** and **early stop (3.6)**.
- **Half resolution during motion (P6, only if P2's perf gate needs it).** When the previous pass exceeded 6 ms
  (`EXT_disjoint_timer_query_webgl2` when present), motion frames render the pass at half resolution into a texture
  and upscale; settled frames are full resolution.

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

---

## 6. Patterns

### 6.1 One template, two footprint modes

`gl.js` gets `PATTERN_SRC(mode)`. It generates the pattern branch of `REGION_FS` from a template in which every
footprint is a macro:

| mode | footprint |
|---|---|
| `'fwidth'` | `fwidth(x)` and `argWidth(sp)`, exactly today's text |
| `'analytic'` | the formulas of 6.2, from the footprint vectors dX, dY and Λ |

**Contract.** `REGION_FS(false)` and `REGION_FS(true)` must stay **byte-identical** to today's strings (a string test
against fixtures saved in P2). The forward path, and so every golden through it, therefore cannot move. The inverse
`patternColor(z, dX, dY, L)` uses `'analytic'`.

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

**What it looks like** (rendered in `out/sph_*.png`):
- **log(H):** 8 horizontal rows (θ bands of H) × latitude columns at Re w = ln tan(jπ/16). The two end columns run to
  −∞ and +∞: the strip visibly reaches infinity with finitely many cells.
- **z^i(H):** concentric rings |w| = e^{−jπ/8}, cut by rays.
- **Cayley(H):** a graticule converging at w = ±1, averaged there.

---

## 7. Precision

- **Pixel positions** are hi/lo (`uCenter` + (offset + `uCenterLo`)) as in `view2D`. inverse-first measured identical
  metrics in float64 and float32 emulation for all 10 acceptance chains at 1×, 4× and 16×, including Cayley at 64× on
  w = 1 and 1/z at 128× on w = 0, which are the suite's deepest zooms.
- **Anchoring (P6, optional).** For an outermost AFF/MOB op the CPU passes its value at the view centre in float64 and
  the GPU adds offset terms (Möbius: num = num0 + d·δ, den = den0 − c·δ). inverse-first measured IoU 0.88 → 1.00 at a
  4,194,304× zoom on the image of ∞.
- **Λ.** Candidates from LOG and ROOTPOW carry Λ = log z, so polar, phase and sphere patterns and the halfplane and
  sector tests are exact for any |z| (4.3). With the default window (M = 8), z^i members stay within |Re Λ| < 57.
- **float32 transcendentals** on real GPUs are 2–4 ulp. The GLSL parity test (12.2) checks enumerator outputs on the
  GPU against `Inverse.enumerate`. The real-GPU benchmark reproduced the z^i hole, rims and polar checker exactly
  (4.7).
- **Fallback.** float64 vertices in two charts (z, and u = 1/z). Relative precision is 1e−13 at the refinement floor,
  and |z| is resolved from 1e−290 to 1e290 (sphere-native section 11).

---

## 8. The forward fallback: SphereMesh (sphere-native backbone)

### 8.1 When

For each role and area shape whose path is `'forward'` because the map spec is ineligible (or `exactImages` is off),
and whose map is still:
- the shape is stretched or unbounded (`Region.bboxOf` null, or larger than 3 windows), **or**
- today's `computeFix` first pass finds trouble: a vertex with a non-finite image, or a triangle still bad at depth 5
  with an image larger than 0.5 px.

Such a shape runs a SphereMesh job. Otherwise `computeFix` runs as today. While a job runs, today's GPU draw shows.

### 8.2 API (`src/sphere.js`, new; pure JS, node-testable)

```js
SphereMesh.create({
  F,                         // CPU stage map (Funcs.stageFunctions or cpuMap)
  steps, built, a, b,        // for stage-wise limits (8.4); null for homotopy frames (probe at the source)
  shape,                     // Region shape
  win,                       // clipWin
  views: [{kind: 'flat', cx, cy, s, W, H, guard: 3} | {kind: 'sphere', R}],
  alpha, pattern: {kind, cell, origin, sphN},
}) -> mesh
mesh.step(msBudget) -> {done, partial}    // runs at most msBudget ms; resumable; cancellable by the caller
mesh.publish() -> {pos: Float32Array (x,y per vertex, relative to origin), attr: Float32Array (4 per vertex),
                   tri: Float32Array (1 per triangle: area scale), order: 'far-to-near', origin: [x, y],
                   pos3?: Float32Array (globe)}
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
  - a step that is non-finite at a finite input is classified by a two-ring probe of that step alone, at radii 1e−6
    and 1e−9 of |input| (relative, never absolute);
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
| saturation | K = 1 (α ≥ 0.999) or ⌈ln(1/255)/ln(1 − α)⌉, capped at 16; pixel-centre counts; commit lag 0.5 octave |
| quiet rule | 32 consecutive NVB levels whose ring pieces add nothing |
| precision floor | \|Δ\| ≤ 1e−13·\|coord\| in the leaf's chart, or \|coord\| < 1e−280 |
| budgets | 300k nodes and 1.5 s CPU per mesh; 1.5M nodes per session; at expiry draw leaves with dev ≤ 2 px |

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

### 8.7 Output and draw

CPU pre-mapped triangles:
- `aPos` = w − w₀ (float32), with w₀ the view centre at upload; re-upload when the view centre moves more than 1e4
  view widths or the zoom changes by 2¹².
- `aAttr` (vec4) holds the active pattern's per-vertex coordinates, reduced per triangle: Cartesian (z − Q)/cell with
  the triangle offset a multiple of 10 cells; polar with arg unwrapped from the first vertex and both coordinates
  reduced by multiples of 16; sphere (θ unwrapped, λ); source phase.
- `aTri` holds the area scale.

New programs `regionP` and `regionSP` in gl.js use `REGION_VS`'s `'pre'` variant (positions straight from `aPos`; no
chain, no BARY, no midpoint test) and the `PATTERN_SRC('fwidth')` body fed from varyings.
`GLR.createPreMesh(data)`, `GLR.drawPreMapped(res, st)`, `GLR.destroy(res)`. GPU bytes are counted in `cacheBytes`.

### 8.8 Jobs, slicing, view changes, export

- **Jobs.** One job per (shape, role, mapKey, viewKey), on `fixJob`'s machinery: token, 5 ms slices, `rest()`,
  `fixBusy()` pause, LED `busy`. A published mesh replaces the GPU draw and fix-ups for that shape and role.
- **First version (P5).** Rebuild on settle after a map change, a `clipWin` change, or a right-view zoom by more than
  2×. Pans within the 3× guard band need nothing.
- **P6.** Incremental pans and zooms (sphere-native 12.2), warm start, idle coarsening.
- **Export.** `renderOff` runs the job for the export view synchronously in slices, with a 3 s budget; at expiry it
  draws final leaves with the chord tolerance relaxed to 0.6 export px.
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

### 9.1 P4: reach and singular points (line renderer unchanged)

**Reach.**
- `Region.curvesOf(s, win, {reach: 'sphere'})`: long curves (lines, rays, half-plane boundaries, unbounded sector
  rays) are clipped to `expandBox(win, 1e28)` instead of `expandBox(win, FAR)`. The default `{reach: 'far'}` keeps
  every other caller (labels, integrals, hit tests, targets) as today.
- `Region.sampleCurve(c, win, {sing})`: the geometric tails (ratio 1.035) then run to the new ends, about 1,900
  samples per tail. Float32 keeps positions relative to the window centre up to 1e28.

**Singular points.** For each point p of `Inverse.singular(plan, clipWin, ['undef', 'branch', 'pole'])` that lies
within one sample step of a curve segment, insert samples at distances δ_k = step·1.035^{−k} from p on both sides,
down to 1e−30·R. p itself is excluded. The GPU midpoint test drops the piece across p.

For non-eligible chains the CPU scans the sampled polyline under F (float64). A non-finite value, or a jump with the
midpoint deviation above 0.25 × chord, marks a singular point; its parameter is located by 40 bisection steps.

**Formula contours** that end on the stretched mesh's outer box continue as rays along their last segment's direction
(reach as above). This is exact for straight boundaries such as strips, half-planes and sectors given as formulas.

Engagement is `shapeGPU`'s `sourceCurves` for mapped draws only. `lineKey` includes the plan's singular-point set.
Bounded curves away from singular points get the same samples as today, so golden strokes cannot move.

### 9.2 P6: the CPU image-metric curve sampler (optional)

This is sphere-native's `lines.js`:
- two charts (z = a + t·d and z = a + d/τ);
- accept when dev ≤ 0.3 px and length ≤ 48 px; cull off-view (1.5× guard);
- stroke saturation; quiet rule of 24 levels toward UNDEF; float64 floor.

The output is pre-mapped polylines drawn through `createLines(polys, w₀)` with the `'local'` fetch (`line0`). Dash arc
lengths come from the CPU points. It is view-dependent and re-sampled on settle. Use it only when P4's
fixed-in-source sampling shows defects in practice.

---

## 10. App integration (`src/app.js`)

### 10.1 State and hooks
- `S.exactImages` (default true; `sanitizeState` makes it a boolean).
- Test hooks inside `TEMP-DEBUG-HOOK` blocks:
  - `__cmwPaths()` → `[{id, role, path, reason}]`;
  - `__cmwSet('exactImages', bool)`;
  - `__cmwForceForward([ids])` → `pathOf` returns `'forward'` for those shape ids (mixed-path tests, 12.4 (c));
  - `__cmwSphereW(x, y)` → w under a Sphere-view pixel (for 12.4).

### 10.2 `drawScene(pane, map, role, opt)`

Fills loop, per area shape in list order:

```js
const path = pathOf(s, map, role);
if (path === 'inverse') {
  const res = GLR.drawInverse({ map, view: pane.view, dpr: pane.dpr, shape: s, look: lookOf(s, alpha), inv: invPrep(map, s), scissor: scissorOf(s, map, pane) });
  if (res === 'drawn') continue;          // 'pending' | 'error': fall through to the forward draw this frame
}
// forward: today's code (drawRegion + fix-up extras), or the SphereMesh draw when a published mesh matches
```

`invPrep(map, s)` caches `Inverse.prepare(plan, {win: clipWin, shape: s})` by (`chainSig[b]`, `clipWin`,
`shapeKey(s)`). Strokes are unchanged (P4 changes only their samples).

### 10.3 `sphereView`

In image mode, an eligible still map gives the inverse shapes a `st.inverse` list, which `GLR.drawSphere` draws after
the globe and before the lines (4.6). The rest is unchanged.

### 10.4 Fix-ups and jobs

- `fixTargets()` and `runFixInner()` skip shapes whose `pathOf` is `'inverse'` or `'pending'`, and drop their
  `r.fix[role]`.
- Ineligible maps keep `computeFix` for bounded clean shapes and start SphereMesh jobs (P5) for the rest (8.1).
- A failed inverse compile calls `scheduleFix()`.

### 10.5 Morph and transitions

- Playing morph and transition frames: `drawScene` already receives mode 1/2 maps, which go forward. No change.
- Paused morph: ineligible until P6, so fix-ups or a SphereMesh run under the existing `'M…'` key.

### 10.6 `renderOff`

Set `GLR.syncCompile = true` around the render, so inverse programs finish linking, and restore it after. SphereMesh
shapes run their job for the export view first (8.8).

### 10.7 Thumbnails

`renderThumb` goes through `drawScene`, so it uses the inverse path when ready. `frameStatus().pending` keeps today's
"not final, not cached" rule.

### 10.8 LEDs

`busy` only while `computeFix` or a SphereMesh job runs.

### 10.9 Left plane

`renderLeft` → `drawScene(pane, stageMap(k), 'L')`: with k > 0 and an eligible map, shapes use the inverse path for
(0, k]. At k = 0 `isIdent` keeps today's draw.

### 10.10 Context loss

Inverse programs recompile; SphereMesh GPU buffers are rebuilt from the CPU store on `onRestore`.

### 10.11 Hover (P6, optional)

For eligible maps, `hoverSearch` lists `Inverse.enumerate(...)` leaves (lvl ≥ 0) inside the left view: exact and
instant. Newton tracking stays for ineligible maps.

---

## 11. Phases

Each phase ends with the app working and passing both regression suites (`test/regress/compare.py`, perf full run
plus quality). A phase may only report IMPROVED in quality and perf; every new scene must meet its own threshold.

### 11.0 Owners (parallel work, separate files)

| owner | files | contract with |
|---|---|---|
| E1 inverse | `src/inverse.js`, `Region.supportOf` in `src/region.js`, `test/t_inverse.js`, `test/t_inverse_render.js` | E2 (op schema 3.2), E4 (3.1) |
| E2 GLSL | `src/glsl.js` (`inverse` in `GLChain.build`), `test/glsl_inverse_test.js`, `test/make_glsl_inverse_test.py` | E1, E3 (4.1 names) |
| E3 renderer | `src/gl.js` (`INV_FS`, `drawInverse`, `packShape`, `PATTERN_SRC`, sphere checker, `regionP`/`regionSP`) | E2, E4 (4.5), E5 (8.7) |
| E4 app and tests | `src/app.js`, `build.py`, `test/regress/*` scenes, CDP checks | everyone |
| E5 fallback | `src/sphere.js`, `test/t_sphere.js` | E3 (8.7), E4 (8.2) |
| E6 lines | `Region.curvesOf`/`sampleCurve` options, app wiring of `sourceCurves` | E1 (`singular`), E4 |

### P0: tests first (E4)

- **Work.** Add the quality scenes and metrics of 12.4 and the perf units of 12.5. Record the baseline on today's
  code. The new scenes record their current bad values (z^i hole filled, opacity below 1), so the coming change shows
  as IMPROVED.
- **Tests.** Quality and perf baselines re-recorded with the new scenes. The existing scenes' baselines stay
  unchanged.
- **Gate.** Both suites pass against the new baseline on unchanged `src/`.

### P1: the CPU enumerator (E1)

- **Files.** `src/inverse.js`, `src/region.js` (`supportOf` only), `build.py` (load order), node tests.
- **Work.** Sections 3.1–3.10. Port `notes/proto/lead-inv/inverse_proto.js`; add caps, pruning, singular points,
  `prepare`, `renderCPU`.
- **Tests.** 12.1. Gate: node tests pass; the suites are unchanged (nothing is wired).

### P2: the inverse renderer, flat (E2, E3, E4)

- **Files.** `src/glsl.js`, `src/gl.js`, `src/app.js`, `test/glsl_inverse_test.js`.
- **Work.**
  - glsl.js: 4.1. gl.js: 4.2–4.5 (flat), `PATTERN_SRC` with the string contract, `packShape` refactor.
  - app.js: `pathOf`, the `drawScene` integration, fix-up gating, `exactImages`, hooks, `renderOff` sync, scissor.
- **Tests.** GLSL parity (12.2); `REGION_FS` byte-identity; CDP checks 12.4 (a)–(e).
- **Gate.**
  - **Quality:** every unbounded scene, new and old, reaches IoU ≥ 0.999 with holes and spill ≤ 0.001 (the tie rows
    of `sq_Q1_out16` and `sqrt_slit_out16` are allowed). Every golden ≤ 0.5 % (expected ≈ 0.01 %). Parity, polar
    parity and opacity thresholds as in 12.4.
  - **Perf:** pan and zoom frame times within tolerance; settle times equal or IMPROVED; example loads within
    tolerance (watch the extra compile); GPU memory equal or IMPROVED.

### P3: globe, left plane, spherical checker, export (E3, E4)

- **Work.** 4.6 and 10.3; role L (10.9); pattern 8 in both shader paths and the pattern menu (6.3); export (10.6).
- **Tests.** CDP 12.4 (f)–(i); spherical checker node test (12.1 (h)).
- **Gate.** The suites, plus the sphere and left-plane CDP checks.

### P4: lines reach (E6)

- **Work.** 9.1.
- **Tests.** CDP 12.4 (j): boundary strokes reach the view edges for logH_out16, and z^i of ∂H shows two full
  circles; the existing goldens are unchanged.
- **Gate.** The suites.

### P5: forward fallback (E5, E3, E4)

- **Work.** `src/sphere.js` (8.2–8.9), `regionP`/`regionSP`, app jobs (10.4) for ineligible maps.
- **Tests.**
  - 12.3, including a forced-forward quality run: every acceptance scene with `exactImages` off reaches IoU ≥ 0.999
    after settle.
  - Perf: a new unit `image.custom_e_z1z` (the non-invertible custom formula e^{z+1/z} on H) settles within budget,
    with no slice over 6 ms.
- **Gate.** The suites, plus the forced-forward run.

### P6: extensions (any order, each with its own tests)

- invertible homotopies (morph frames exact: `mobHom`, `powHom`, the exp and log homotopies);
- polynomials of degree 3–4 (Cardano/Ferrari plus 2 Newton steps);
- hover exact preimages (10.11);
- anchoring (7);
- the fallback's incremental views and cut constraints (8.10);
- the CPU curve sampler (9.2);
- half resolution in motion (4.7).

---

## 12. Tests to add

### 12.1 Node, pure JS (`test/t_inverse.js`, `test/t_inverse_render.js`)

(a) **Round trips** (port `notes/proto/lead-inv/t_roundtrip.js`): every catalog type × random parameters, cuts
(including cut ≠ 180°) and sheets k ∈ {−1, 0, 1, 2}, plus the 21 custom formulas.
- Assert 0 unsound, 0 missed and 0 decomposition errors on 200 random u per case.
- Assert ineligible exactly: degree-3 polynomial, degree-3 rational, z twice, Re/Im/abs/arg, d/dz, IPOW |n| > 16.

(b) **Range sign** for ASIN…ATANH, LOG, IJOUK and ROOTPOW: lvl > 1e−9 ⟺ f(pre(w)) = w, over a 200 × 200 grid of w
(away from a 1e−9 band).

(c) **Plans.**
- `sig` is stable under parameter changes: dragging α of powa from 1.5 to i keeps `sig`.
- Caps: e^{z²}: IPOW(2) + EXP gives 34 leaves, ok. `\sin(e^z)` reduces M as specified. A triple nest beyond 64 is
  ineligible.

(d) **Early stop is exact.** Port `scan_cost.js` to the CPU twin with `stopOp`. Over every window family kind (EXP,
EXPC, SIN, COS, TAN, SINH, COSH, TANH, ROOTPOW inf), with and without a trailing MOB/AFF, on 10k random pixels:
the front K equals the full-window front K for K ∈ {1, 3, 8}.

(e) **Pruning is exact.** Same pixels: the covering set with clamps equals the set without clamps, for shapes
{disc, rect, polygon, halfplane at 0°/37°/90°, sector, formula strip, formula half-strip}.

(f) **Singular points.** e^{1/z} → {0}; z^i → {0}; `\log(z-1)` gives branch {1}; Cayley gives pole {−i};
exp → {}; `\tan z` gives poles within 64R.

(g) **Reference renderer** (port `render.js`): all quality scenes plus z^i, exp(H) and e^{1/z} at 1×, 4× and 16×, in
the mask and pattern variants (polar for z^i).
- Assert IoU ≥ 0.9999, holes = spill = 0, and parity ≥ 0.9999.
- Assert z^i: hole leak 0, polar parity 1.0, sheets disagree 0.
- (Measured values in 13.2: all 1.00000.)

(h) **Golden emulation** (port `golden_cmp.js`): golden_diff ≤ 0.05 % for the 4 bounded controls (measured ≤ 0.011 %).
With the tie rule reversed `disc_cube.pattern` must exceed 0.1 %, which guards the tie rule.

(i) **Spherical checker.**
- log(H) column edges at Re w = ln tan(jπ/16) ± 0.5 px.
- z^i rings at |w| = e^{−jπ/8} ± 0.5 px.
- At Cayley's w = 1 no pixel within 3 px deviates from the average by more than 4/255.

(j) `Region.supportOf`: random points of each shape lie within the support for 64 random directions; the recognizer
handles the examples of 3.8.

### 12.2 GLSL parity (headless Chrome; `test/glsl_inverse_test.js`, page built by `test/make_glsl_inverse_test.py`)

- 300 random chains drawn from `glsl_test.js`'s generator restricted to eligible ones, plus all custom formulas of
  12.1 (a), with random parameters and random view pixels.
- A test program (the walker with a recording `invLeaf`) writes the first 8 leaves of each test w into an RGBA32F
  target of N × 8 texels: column i is test point i, row r is leaf r, and a texel holds (z.x, z.y, lvl, |J|). They are
  compared with `Inverse.enumerate` in the same order: |Δz| ≤ 2e−3·(1 + |z|) and Δlvl ≤ 0.05 px, skipping members
  within 1e−3 of a cut or a window boundary.
- Also: the `stopOp` early stop gives the same front K as the full scan on the GPU.
- `REGION_FS(false/true)` strings are byte-identical to the fixtures saved before P2.

### 12.3 Fallback (`test/t_sphere.js`; port `notes/proto/sphere-native/run_cases.js` and the lead's `run_cases_lead.js`)

- The 40 flat acceptance runs reach IoU ≥ 0.999 with 0 holes and 0 spill.
- The z^i hole is 0/164; polar parity ≥ 0.999.
- p99.9 chord ≤ 0.3 px.
- Nodes and evaluations are within 1.5× of the recorded values, and each case meets its CPU budget.
- 0 T-junctions (incremental `tjunc.js` logic over the published triangles).
- Determinism: the same input gives the same buffers.

### 12.4 Regression and CDP scenes (E4; quality suite plus `test/<name>_cdp` command files)

**New quality scenes**, with exact truth in `scenes.js`:

| scene | map, region | views | truth |
|---|---|---|---|
| `zi_H` | powa(i, 180°, 0) of H | (0, 0, 190), out4, out16 | e^{−π} < \|w\| < 1 (only members with −ln\|w\| ∈ (−π, π]); sdf = min(\|w\| − e^{−π}, 1 − \|w\|) |
| `expH` | exp of H | (0, 0, 60), out16 | w ≠ 0; sdf = \|w\| |
| `e1z_disc` | [recip, exp] of \|z\| < 1 | (0, 0, 60), out16 | w ≠ 0 |
| `e1z_custom` | custom e^{1/z} of \|z\| < 1 | (0, 0, 60) | w ≠ 0 |

**New variants and metrics.**
- `polar`: pattern polar. `truth.parityAll(w)` is defined because every sheet has the same parity there:
  ⌊Arg w·16/2π⌋ + ⌊−ln\|w\|·16/2π⌋ mod 2. It is scored on all fill pixels with cells ≥ 3 px and ≥ 1.5 px from a
  cell edge.
- `mask85`: solid at α = 0.85, with `opacity_min` = min over interior fill pixels of the fill fraction along
  plane → c0, expected ≥ 0.99 for z^i, expH and e1z.
- `hole_leak` (info): fill pixels with \|w\| < e^{−π} − 2.5 px.

**CDP checks** (inverse path unless stated):
- (a) z^i(H) at default zoom: hole leak 0; polar parity ≥ 0.999; annulus empty-pixel count 0 outside the band.
- (b) `__cmwPaths()` shows `inverse` for every eligible scene and `forward` for the four ineligible probes: d/dz,
  `z^2+1/z`, a degree-5 polynomial, a paused morph.
- (c) Mixed scenes.
  - A disc (bounded) and H (unbounded) under z^i, both inverse, α = 0.85: where they overlap, pixel colours equal the
    CPU composite of the two in list order (`Inverse.renderCPU` per shape, then over), within 3/255.
  - Repeat with the disc forced onto the forward path. This uses a test-only hook `__cmwForceForward([ids])` in a
    `TEMP-DEBUG-HOOK` block; `pathOf` returns `'forward'` for those ids. List order still holds across the two paths,
    and the disc's own pixels differ from its inverse render by ≤ 0.5 % (golden_diff metric).
- (d) Compile gap: right after adding a step, a frame with `frameStatus().pending` shows the forward image; within 2 s
  it is replaced by the inverse image; no frame is blank.
- (e) `exactImages` toggled off and on: forward and inverse images of the bounded golden scenes differ by
  ≤ 0.5 % golden_diff.
- (f) Sphere view z^i(H): 400 globe samples inside the hole cap are globe-coloured; 400 annulus samples are fill;
  Cayley at the north pole has no notch (via `__cmwSphereW`).
- (g) Left plane with focus on step 2 of [z^i, z²]: the left plane (stage 1) matches the CPU render of z^i(H), IoU
  ≥ 0.999.
- (h) Figure export at 300 dpi of z^i(H) equals the on-screen render scaled, IoU ≥ 0.999.
- (i) Spherical checker selectable; the log(H) columns as in 12.1 (i), on the GPU.
- (j) Strokes (P4): for logH_out16 the boundary-stroke pixels reach within 2 px of both view edges; z^i of ∂H draws
  both circles over ≥ 99 % of their circumference.
- (k) Fallback crack test (P5): the inverse switched off, the forward mesh drawn in one colour over black: interior
  pixels not covered = 0 (incremental's two-colour test).

### 12.5 Perf units (perf suite)

- `image.ziH.m240`: statics, `panR`, `zoomR` in/out, settle.
- `image.expH.m240`: the same.
- `sphere.ziH`: orbit.
- `image.custom_e_z1z.m240` (P5): the fallback's settle and slices.
- Existing units unchanged. Expected: right-plane settle 0 ms, GPU memory lower, frame times within tolerance.

---

## 13. Prototype verification record

All lead prototypes are in `notes/proto/lead-inv/` and run with `node` from the project root.
`gpu_bench_cmd.js` runs through a CDP daemon (`test/leadinv_cdp`).

### 13.1 Catalog audit (`t_roundtrip.js`)

104 eligible step cases: every type of `Funcs.DEFS` except d/dz, random parameters, cuts and sheets, plus 21 custom
formulas. Result: **0 failing**.
- Soundness residual ≤ 7e−13.
- Candidates per pixel: 1–3 for the finite types, 17 for the exp/powa(i)/tan families, 34 for the sin/cos/sinh/cosh
  families (unpruned).
- 3 ineligible as specified.

### 13.2 Inverse rendering, CPU float64 (`render.js`)

Scored with the suite's own `metrics.js` and truth on the app's own `Funcs` and `Region`:
- **All 16 quality scenes × {mask, pattern}** and **z^i(H), exp(H), e^{1/z} disc × {1×, 4×, 16×} × {mask, pattern}**:
  IoU **1.00000**, **0** holes, **0** spill, checker parity 1.00000.
- **z^i(H):** hole 0/164; polar parity 95,760/95,760 with 0 disagreeing sheets.
- Renders in `out/` (`zi_H.pattern.png` is the clean polar checker on the annulus).
- Candidates per pixel: 1–3 for finite chains, 17 for single families, 34 for sin.

### 13.3 Early stop (`scan_cost.js`)

0 front-K mismatches. Members per pixel (K = 1 / 3):

| scene | members |
|---|---|
| z^i | 9.5 / 10.6 |
| exp(H) | 3.9 / 7.7 |
| e^{1/z} | 3.2 / 5.2 |
| exp strip | 7.4 / 17 (pruning needed) |
| sin half-strip | 13.9 / 34 (pruning needed) |

### 13.4 Golden emulation (`golden_cmp.js`, results in `golden_cmp.txt`)

golden_diff:

| control | golden_diff |
|---|---|
| `disc_cube` | 0.000 % |
| `joukowski` | 0.000 % |
| `poly_mobius` | 0.000 % |
| `annulus_log` | 0.011 % |

Tie rule reversed: `disc_cube.pattern` 0.293 %.

### 13.5 Real GPU, float32 (`gpu_bench_page.js`)

The table of 4.7, plus the z^i read-back: hole 0/148, annulus 0/111,272 empty.

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

---

## 14. Risks and open questions

1. **Compile cost of a second chain program.** The inverse program includes `GLChain.LIB` and the op functions,
   compiled in the background. Example-load settle may grow by its compile time while fix-ups disappear.
   Measured in P2. Mitigation if needed: start the inverse compile first and skip the forward region compile while
   the inverse one is pending and an earlier version can stand in.
2. **GPU cost on weak GPUs or with many shapes** (one pass per shape). Mitigations: scissor, pruning, early stop and
   the caps. Batching shapes into one pass and half resolution in motion are kept in reserve (P6).
3. **Branch semantics drift** between `CX`/`Expr.compile` and the enumerators: cut conventions, the odd evaluation of
   arcsin on the GPU, principal constants. Guarded by 12.1 (a), (b) and 12.2. The decomposition is shared code
   (`Inverse.stepOps` feeds glsl.js), so structure cannot drift.
4. **Sheet-swap seams** with sheet-dependent patterns are inherent to any per-point order (5.3); they are documented
   in the guide text.
5. **Pruning and early-stop exactness** depend on the support function being conservative and on D's monotonicity per
   family. Both are unit-tested exhaustively per family kind (12.1 (d), (e)). An unproven case runs without early
   stop (`stopOp` = −1).
6. **Fallback CPU cost** on wild ineligible maps: 0.3–0.8 s prototype, sliced, with budgets. It only affects chains
   that are broken today.
7. **Low α** (K up to 16): B = 16 plus tail closure. The quality suite runs α = 1 and α = 0.85 (`mask85`).

**Open questions.**
1. Should "exact images" be visible in Display options, or stay hidden? The default is on either way.
2. When the inverse program fails to compile on some GPU, should the app show a one-time toast? (Default: no; console
   only.)
3. Should the paused-morph frames (P6, invertible homotopies) take priority over the forward fallback (P5)? Paused
   morph frames are the commonest remaining fallback case in practice.
4. Should P4 (lines reach) move before P3 for the visual coherence of zoomed-out unbounded images?

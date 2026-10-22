# Sphere-aware refinement layer: the "incremental" design

Designer: **incremental**. Angle: keep the current core (stretched grid, GPU mapping, L = 4 template, map
cache) untouched for bounded shapes and for the window core, and add:

- a **collar** from the core's inner box to infinity, meshed in the chart u = 1/(z - c). Infinity is a vertex that is
  never evaluated.
- a **CPU float64 refinement layer** that generalizes `computeFix`. It is view-dependent, priority-driven, measures
  everything in the image metric (screen px, or globe px in the Sphere view), stops on saturation when there are
  infinitely many sheets, and emits **pre-mapped triangles** (and pre-mapped line pieces) for the current map and view.
  It replaces the far fade and the lax `0.2 * edge` acceptance that produce the z^i shards.

Prototype: `notes/proto/incremental/` (`layer.js` is the algorithm, `run.js` the scenes, exact ground truth and
metrics, `tjunc.js` a topological watertightness check). It was run with node on every acceptance case: 88 scored
runs (flat Image view at default, 4x and 16x zoom-out and extra zooms; and the Sphere view, each at K = 1 and K = 3).
**All 88 give IoU 1, 0 holes, 0 spill, checker/polar parity 1.000, and max chord deviation <= 0.25 px.** There are
0 T-junctions in the meshes checked. The headline (section 14 has all tables; single-shot node timings vary about
+-30 % between runs):

| case (flat Image view, K = 3, i.e. alpha 0.85) | node ms total / of which layer | F evals | layer tris | IoU | holes | spill | parity | max chord dev |
|---|---|---|---|---|---|---|---|---|
| z^i of H, default | 603 / 499 | 274 k | 35.8 k | 1 | 0 | 0 | 1.000 | 0.250 px |
| z^i of H, 16x out | 262 / 162 | 105 k | 9.8 k | 1 | 0 | 0 | - | 0.250 px |
| log of H, default / 16x out | 187 / 69, 265 / 168 | 51 k / 80 k | 4.2 k / 14.9 k | 1 | 0 | 0 | 1.000 | 0.250 px |
| exp of H, default / 16x out | 1473 / 1375, 950 / 866 | 726 k / 454 k | 101 k / 58 k | 1 | 0 | 0 | - | 0.250 px |
| e^{1/z} on the unit disc, default / 16x out | 4124 / 3989, 4862 / 4739 (budget) | 3.8 M / 4.0 M | 41 k / 49 k | 1 | 0 | 0 | - | 0.250 px |
| exp of the strip, default / 16x out | 134 / 78, 161 / 102 | 54 k / 70 k | 4.1 k / 8.2 k | 1 | 0 | 0 | 1.000 | 0.249 px |
| Cayley of H, default / 16x out / 64x on w = 1 | 133 / 4, 184 / 2, 203 / 147 | 16 k / 14 k / 128 k | 0.8 k / 0.6 k / 1.0 k | 1 | 0 | 0 | 1.000 | 0.18 / 0.01 / 0.09 px |

The z^i hole |w| < e^{-pi} stays empty at every zoom: 0 pixels covered, also zoomed 8x into the hole and 32x onto
the inner rim. At K = 3 every pixel of the annulus is covered at least 3 times, so the image is opaque at infinite
multiplicity. The polar checker is clean (parity 1.000 over 85 k scored pixels at the default view and 180 k at 8x;
the truth parity is the same on every sheet). The golden bounded controls claim 0 core triangles (disc_cube,
poly_mobius, joukowski), so their pixels are unchanged. The one exception is annulus_log, where the 69 triangles
straddling the branch cut (+23 claimed on demand) move from the old fix-up to the layer.

---

## 1. Principles

1. **No value at infinity, and no value at any point where F has no limit.** Infinity is the apex vertex of the collar
   in the chart u = 1/(z - c) and is never evaluated. Any vertex whose F is NaN, or whose image does not converge (a
   probe, 6.8), is *undefined*. Triangles are refined toward undefined vertices geometrically in their own chart, which
   means halving toward 0 or toward the apex u = 0, i.e. doubling toward infinity. A value at such a point is used only
   when the images *converge numerically* (the cap, 6.3), as for Mobius maps at infinity or sqrt at 0. A pole needs no
   special case: its images converge to the north pole of the image sphere, flat views cull it, and the Sphere view caps
   it there.
2. **Every decision is made in the image metric.** Flat views use screen px: sub-pixel chord deviation
   tau = 0.25 px, image edges at most 64 px, culling against the view plus a 25 % pan margin. The Sphere view uses globe
   px (chordal distance times the globe radius) and keeps the whole sphere.
3. **The core is a cache, not a constraint.** A core base triangle whose image passes the strict test is *certified*
   and stays on the GPU exactly as today. Everything else is *claimed* by the layer (a skip flag, the existing
   mechanism).
4. **Termination is guaranteed by construction.** Every branch of the refinement ends on accept, cull, cap, saturate,
   sub-pixel drop, precision floor or budget. The work is ordered so that visible sheets are finished first; budgets
   only cut the deepest, least visible sheets.
5. **Watertight without trusting float32 arithmetic to agree.** Shared edges are shared objects. The layer never splits
   an edge that a certified core triangle draws; it claims that triangle first. The layer draws vertices on such edges
   from the core's own map cache texels (section 9).

---

## 2. What stays exactly as today

- `Region.buildMesh` (marching squares on the stretched/uniform grid), `meshInstances`, the GPU template (`MESH_L = 4`),
  `REGION_VS/REGION_FS`, `BARY` canonical edge points, the map cache (`tfEntry`, 256 MB), `drawLines` for GPU-mapped
  lines.
- Bounded shapes whose images pass the strict test: no claims, no layer, **identical pixels**. Measured: disc_cube,
  poly_mobius and joukowski claim 0 triangles at their pinned views.
- The left plane at stage 0 (identity map): never touched (no layer for identity maps).
- Landscape, Phase and the phase sphere (per-pixel plots), and the preimage targets (`drawPreimage`): untouched.
- During any motion (pan, zoom tween, drag, homotopy transition, playing morph), drawing uses only what already
  exists: the core plus the last layer buffers, with no CPU work (`fixBusy` semantics kept). While a morph plays, the
  core is drawn exactly as today, including the far fade, because pre-mapped geometry is valid for one map only.

---

## 3. Data structures

### 3.1 Charts and vertices

Two charts per (shape, role):

- **Z**: absolute z (float64). Resolves z near 0 down to subnormals (5e-324) and anywhere else to about 1e-16 |z|.
- **U**: u = 1/(z - c), where c is the meshing-window centre (`clipWin` centre), used for the collar. Infinity is u = 0
  exactly. z = c + 1/u resolves |z| up to 1.8e308. Near z = 0 this chart only reaches about 1e-16 |c|, which is why
  triangles near 0 stay in chart Z (the claimed core triangles and the B1 box live in Z).

```
Vertex {
  id
  z: {re, im} | null           // null only for the apex (z = infinity)
  u?: {re, im}                 // chart-U coordinates when created there (exact), else computed lazily
  st: 0 finite | 1 image-infinity (overflow or pole) | 2 undefined (NaN) | undefined (not evaluated)
  w: {re, im} | null           // float64 image
  sing?: boolean               // singular-like (probe, 6.8): treated like st 2 by the apex rules
  onB: boolean                 // lies on the region boundary (snapped to its inside side)
  lv: number                   // the shape's level function (cached)
  ref?: int                    // core map-cache texel (base triangle * uP + lattice index) when the vertex is a
                               //   lattice point of a certified core triangle (drawn from the GPU cache, section 9)
}
```

### 3.2 Edges

```
AtomicEdge {                   // shared by its two triangles: registry keyed by the vertex-id pair
  a, b: Vertex
  ch: 'Z' | 'U'                // the chart that owns its split point (midpoint in that chart)
  mid: Vertex | null           // test point and later split point (one evaluation, reused)
  kids: [AtomicEdge, AtomicEdge] | null
  frozen: coreTri | null       // a lattice edge of a CERTIFIED core triangle: never split; claim coreTri first
  bnd: boolean                 // the region's boundary: its midpoint is snapped onto the level set (inside side)
  cut?: Vertex                 // level-set crossing (collar clipping), shared by both sides
  users?: Set<Tri>             // emitted leaves using it: a later split marks them dirty (9.2) and passes the set on
}
CompositeEdge { a, b, parts: [edges in order] }   // a per-triangle view of a chain, e.g. the B1 lattice under a sector
```

A claimed core base triangle enters the layer with its three base edges *pre-split twice* (its L = 4 lattice). The
lattice points are exactly the points the GPU template uses on those edges.

### 3.3 Triangles (tree nodes) and keys

```
Tri {
  v: [A, B, C]  (counterclockwise in its chart), e: [AB, BC, CA], ch
  key            // sheet depth: floor(2 * log2(refSize / chartDiameter)) / 2, at least the parent's;
                 //   +1 per deferral (6.4); refSize = window/8 (Z) or 1/halfB1 (U)
  root: 'core' | 'collar', t (core base index)
  apexOf, satRun // apex chains (6.3)
  longAge        // generations its longest edge survived (6.6)
  cv, spk, pc    // cached centroid / fan-spoke / polygon-centre vertices
}
```

### 3.4 Per (shape, role) layer state

```
Layer {
  mapKey, meshKey                        // valid for one map and one core mesh
  vertices / edges (registries), roots   // the cached tree: F is never evaluated twice at a point
  claims: Uint8Array(nBaseTris)          // -> the skip buffer (GLR.createSkip/setSkip, as today)
  view: {kind: 'flat' | 'sphere', cx, cy, s, W, H, R, dpr}
  coverage: charts[] of Uint16 counts    // flat: the view + 25 % margin; sphere: two 2R x 2R hemisphere charts
  emitted: typed arrays by key           // pre-mapped triangles (section 8); per leaf its slot range
  dirty: Set<Tri>                        // emitted leaves whose edges were split later: re-emitted before each upload
  linePieces                             // pre-mapped polylines (section 11)
  job: {token, heap, budget, progress}
}
```

---

## 4. Core classification (certify or claim)

This runs on the CPU in float64, time-sliced like `computeFix` today. For every core base triangle (inside B1 in collar
mode), using values cached per map so that a view change re-runs only arithmetic:

```
classify(t):
  W at its 3 vertices, at the 3 base-edge midpoints (shared, = lattice t = 1/2) and at the centroid
  CLAIM if any value is non-finite (the GPU core cannot draw it either: cfin)
  CLAIM if a midpoint or the centroid deviates from the chord / corner mean by > 16 * tau * 0.5 = 2 px
        (the L = 4 sub-triangles are 1/16 of that: ~0.125 px)
  CLAIM if an image edge is > 4 * Emax = 256 px AND the near-linear image (its bbox) meets the view
        (Sphere view: always, there is no off-view)
  else CERTIFY
```

Cost: about 3 evaluations per base triangle, the same order as today's `computeFix` first pass (vertices plus
centroids). Measured classification time: 12-46 ms for ~4.4 k-5.8 k base triangles (node, single shot).

Certified triangles are left completely to the GPU: lax `midOk`, L = 4, map cache, no CPU geometry. Claimed triangles
are skipped on the GPU and become layer roots. Their marching-squares edge points that no certified triangle uses are
**re-snapped** onto the inside of the boundary at full float64 precision, by bisection on the coordinate itself rather
than on a parameter. `buildMesh` keeps the midpoint of its 12-step bisection, which can lie on the wrong side of a branch
cut that coincides with the boundary, e.g. z^i, log or sqrt on H at the negative real axis. Bisecting on a parameter
stops at ~1e-17 and would cut the log strip off at Re w = -39.5. With full precision the boundary vertex at 0 becomes
(0, 5e-324).

---

## 5. The collar (stretched meshes with open sides)

- **B1** is the box of grid lines nearest to |phi| = 4 window half-sizes, computed from the axes `buildMesh` already
  builds. `buildMesh` would return `X`, `Y`; the prototype recomputes them. With 60 base cells per side, B1 spans 53
  cells and holds about 85 % of the base triangles. **Collar mode** applies when `mesh.open` has an open side.
- Base triangles outside B1 (852-1452 of them, all the absurd outer cells such as the one spanning ln r 2.7 -> 5.4)
  are **skipped** and never drawn. The collar covers their area and everything beyond.
- **Collar roots: 32 fan sectors around the apex u = 0** (21 for H, 10 for the strip, 14 for the quadrant: sectors
  that would duplicate a break point are merged). Each sector is the "triangle" (apex, P_end, P_start) in chart U. Its
  outer edge is a *composite chain* along B1's perimeter, made of the B1 boundary edges of the inside core triangles
  (with their L = 4 lattices) plus plain "gap" edges where the region is absent. B1 is convex around c, so its image in
  chart U is star-shaped from u = 0 and the fan is valid.
- **Region clipping** (marching triangles). Collar vertices carry the level function. A triangle whose known corners
  are all outside (and whose centroid is outside) is dropped. A mixed triangle is assessed on its *inside polygon* only:
  the inside corners, the cut points on its leaf edges (bisection on the level function along the edge in the edge's
  chart, kept on the inside side, shared per edge), and the true boundary curve between the two cut points, sampled by
  snapping chart-linear points onto the level set. The values on the far side of a cut that coincides with the boundary
  are never looked at. This was the cause of the first z^i failure in the prototype.

---

## 6. The refinement loop

### 6.1 Driver (time-sliced, cancellable, idle-time, progressive)

```
runLayer(shape, role, F, view):                  // replaces computeFix for this (shape, role)
  token = job.token
  ensureClassified()                              // section 4 (cached per map; arithmetic per view)
  ensureCollar()                                  // section 5 (once per mesh)
  heap = roots + reopened nodes                   // ordered by (key asc, ord asc, badness desc)
  level = 0; cov = copy(covCur); unsat = unsatCur
  while heap not empty:
    if sliceElapsed > 5 ms: await yield(); while busy() await 60 ms; if token changed: return
    if evals > EVAL_BUDGET or emitted > TRI_BUDGET or cpuMs > MS_BUDGET: mark 'partial'; break
    T = heap.pop()
    if T.key > level: level = T.key; cov = copy(covCur); unsat = unsatCur        // coverage of strictly nearer sheets
    if T.key > 0 and unsat == 0 and !injective: discard T (global saturation)    // 6.4 d
    visit(T)
    every ~100 ms of CPU, or at the end: re-emit dirty leaves (9.2); upload the emitted triangles (sorted by key)
                                          -> requestRender(role)
```

### 6.2 Visiting a triangle

```
visit(T):
  loop = leafChain(T)                            // corners plus every hanging vertex on its edges (shared edges)
  evaluate F at the loop vertices
  if T.key >= 2: probe the boundary vertices of T for singularity (6.8)
  U = loop vertices with st == 2 or sing
  clip = (collar triangle) and loop has inside and outside vertices
  if U nonempty: apexRules(T, U[0]); return       // 6.3
  if clip: P, segs = insidePolygon(T); centre = polygon centroid (must be inside)
  else   : P = loop; segs = its leaf edges; centre = chart centroid
  assess(T, P, segs, centre)

assess(T, P, segs, c):
  tests = midpoint of each segment (a leaf edge's mid is shared; a cut segment's mid is on the level set)
          + (|P| == 3 and not clipped ? centroid : the spoke midpoints c -> P[i])
  dev = max chord deviation of tests (metric); len = max image segment / spoke length
  finite = all values usable (flat: finite; sphere: finite or infinity)
  good = finite and dev <= tau and len <= Emax
  CULL (6.2.1) -> return
  if good:
     if T.key > 0 and every pixel centre it covers already has cov >= K (and it covers at least one): discard (hidden)
     emit P as one triangle (|P| == 3) or as a fan around c;  covCur += its pixels;  return
  SATURATION (6.4) -> return
  SUB-PIXEL DISCONTINUITY DROP (6.5) -> return
  refine(T)                                       // 6.6
```

#### 6.2.1 Cull rules (flat views only; the Sphere view never culls, so orbiting needs no new work)

- *Accurate* triangle: its image is within tau of the flat triangle through the evaluated points, so its bbox is
  reliable. It is culled if the bbox misses the view enlarged by the 25 % margin.
- *Failing but sphere-smooth* triangle: lift all evaluated points to the sphere and take the chordal radius rho around
  the centroid's lift. If rho < 0.5, and the centroid's lift is within 0.35 rho of the mean of the vertex lifts, the
  true image lies in the chordal cap of radius 2 rho. The cap projects to a disc, a disc complement or a half-plane, and
  the triangle is culled if that misses the view. This is what removes poles (image near infinity) and log's far ends
  without ever giving infinity a value.
- *Apex* triangle (an undefined vertex): if the defined images all lie within chordal rho < 0.3 of one point, the cap of
  radius 3 rho is used. Images converging to infinity, e.g. log at 0, exp toward Re z -> +inf, get culled as soon as
  they leave the view.
- *Jump* triangle (a cut crosses it, 6.5): every evaluated point farther than twice the extent of the continuous
  pieces from the view means the piece cannot reach the view, so the triangle is culled.

### 6.3 Undefined or singular vertices: the apex rules

```
apexRules(T, p):
  D = defined values of T (corners other than p, centroid)
  CAP:   if every D is usable and their image diameter < 0.5 px (flat) / 0.5 globe px (sphere):
           F has a limit at p; emit T with p's image replaced by the centroid's image;  return
  CULL:  apex cull (6.2.1)
  STOP:  if T.satRun >= M (= 4): return       // M consecutive saturated siblings: deeper is invisible
  BISECT the longest chart edge incident to p -> (apexChild, sibling)
         sibling.apexOf = apexChild; apexChild.ord = 1 (popped after the sibling, same key)
         apexChild.satRun = T.satRun (+1 when the sibling is discarded as saturated, reset to 0 otherwise)
```

- **Cayley at infinity**: the 17-18 sectors cap immediately (images within 0.5 px of w = 1), so there is no notch at
  w = 1 (IoU 1 even 64x zoomed on w = 1).
- **1/z of |z| > 1**: all 32 sectors cap at w = 0, so the puncture is a 0.5-px cap (IoU 1 at 128x on w = 0).
- **log at 0 and at infinity**: the images run to the north pole, so the apex cull fires once they leave the view
  (pan margin included).
- **z^i at 0 and at infinity, e^{1/z} at 0, exp at infinity**: no cap and no cull. The siblings get saturated and the
  chain stops after M = 4 saturated siblings (`apexStop` 7-17 per run).

### 6.4 Saturation (infinitely many sheets)

K comes from alpha: K = ceil(ln 255 / -ln(1 - alpha)), so the layers under the top K change no pixel by more than
1/255. alpha = 1 gives K = 1, 0.85 (the default) gives K = 3, 0.5 gives K = 8. K is capped at 16.

a. **Coverage of strictly nearer sheets.** Every emitted triangle, and every certified core triangle (as its flat base
   triangle: corners known, internal edges tile exactly), increments `covCur` at the pixel centres it covers. Pixel
   centres are the rasterizer's sampling points, so this is exactly what the GPU will show. `cov` is the snapshot for
   keys strictly smaller than the current one. Flat: one chart (the view plus margin). Sphere: two hemisphere charts
   w and 1/w with validity discs.
b. **Failing triangle T (key > 0, every boundary value finite, chain not injective)**:
   1. *Pre-check* (no new evaluations): if the image of the centroid, a spoke midpoint, a test point or a vertex not on
      the region boundary falls on a pixel with cov < K, T is not saturated.
   2. *Boundary image*: sample F(dT) adaptively in the metric (chord deviation < 0.5 px, segments < 24 px, coarse off
      the view). A **jump** means F is not holomorphic on T and the test aborts. A jump is a half that keeps the whole
      gap while the other half shrinks to nothing below depth 60, or an unresolvable gap at the float limit. A spiral
      into an extreme endpoint keeps going down to the float limit.
   3. *Guard*: the image of an interior point must have a nonzero winding number, otherwise a singularity inside T is
      suspected and T is not saturated. Thin images, where the probe is within 1 px of the polyline, are inconclusive
      and pass.
   4. *Fill*: by the argument principle, for F holomorphic on T the pixel centres with nonzero winding of F(dT) are
      exactly those inside F(T). T is saturated if every such pixel has cov >= K, except pixels within 1 px of a **rim**
      segment. A rim is the image of the region's own boundary: deeper sheets repeat the nearer sheets' rims, which
      are drawn within tau, so those pixels would otherwise never saturate. There must be at least one inside pixel. In
      the Sphere view each chart is filled separately, and the 1/w chart is corrected by
      wind(g, w0) = wind(1/g, 1/w0) + wind(g, 0).
   5. *Deferral*: a candidate that is at least 80 % saturated is pushed back with key + 1, at most twice, so that it
      waits for the nearer sheets to complete instead of being refined.
c. **Accepted triangle (key > 0)**: it is dropped if every pixel centre it covers already has cov >= K.
d. **Global saturation**: `unsat` is the number of coverage pixels with count < K, kept incrementally. When it is 0 at a
   level, nothing deeper can change any pixel whatever F does, and the job ends. This is what makes e^{1/z} and exp(H)
   finite: K = 1 runs dropped from >4 M evaluations (budget) to 0.7 M.
e. **Injective chains** (every step has `props.injective`, e.g. log, Cayley, sqrt, 1/z) skip saturation altogether.

### 6.5 Sub-pixel discontinuity drop (cuts inside the region)

A segment is a *jump* when its image is longer than 2 tau and one half keeps more than 85 % of it while the other
keeps less than 15 %. If T has a jump, and the smallest image-to-chart ratio of its non-jump segments times its chart
diameter is below 0.5 px, its continuous pieces are sub-pixel slivers along the image of the cut, and T is dropped. All
lengths are measured in T's own chart; mixing Z and U units was a prototype bug that produced holes in log(H). The
cost of a cut is proportional to its image length in px: sqrt of the slit plane drops 3.7 k straddlers per view, with
IoU 1. The resulting sub-pixel gaps lie inside the 2-px band around the true image boundary.

### 6.6 Choosing the edge to split

- Edges at least 0.3 x the longest chart edge are candidates. Among them, the largest **image arc-length estimate**
  wins: for a split edge, the sum of image distances along its chain; for a leaf, |W(a) - W(m)| + |W(m) - W(b)|.
- The longest chart edge is **forced** once it has survived two generations (`longAge >= 2`). Without this, a short
  edge next to a long spiral edge was split forever, which produced the 1.1 M-pop sliver cascade on z^i in the
  prototype. Bisection is image-driven, so the anisotropic stretched cells inside B1 (aspect up to ~70) are refined
  only along their long image direction.
- Splitting an edge: a composite edge splits at its middle chain point, an already-split atomic edge reuses its `mid`,
  and otherwise the chart midpoint becomes the new vertex (snapped onto the level set for `bnd` edges). A **frozen**
  edge first claims its certified core triangle (6.7).

### 6.7 Claim propagation

When the layer must split an atomic lattice edge of a certified core triangle N, it claims N: the skip flag is set and
N becomes a layer root sharing the same edge objects, with its other edges frozen toward their own certified
neighbours. The claim set only grows, so this terminates. Measured: 0-2 propagated claims per scene, 23 for
annulus_log.

### 6.8 Singular-vertex probe

For a boundary vertex v of a triangle at key >= 2: walk geometrically toward v from a neighbour,
z_k = v + 2^-k (q - v) for k = 2..11, and measure the image steps. A smooth F halves the steps every time, sqrt-like F
shrinks them by about 0.7 per step, and a spiral or log does not shrink them at all. If the last step is more than 1/8
of the first (and the first is > 0.5 px), v is singular-like and gets the apex rules. Cost: 10 evaluations per boundary
vertex, done once. It turns z^i's boundary vertex (0, 5e-324), a 118-turn spiral, into an apex: the flat z^i run went
from 4 M evaluations (budget) back to 214 k.

### 6.9 Precision floor

An atomic edge is not split once its chart length is below 1e-15 x the larger endpoint magnitude, or below 1e-300.
A triangle with nothing splittable is dropped (`floor`, 0-47 per run). Collar chains toward u = 0 can reach key ~990
(u ~ 1e-300, |z| ~ 1e300). That costs only a few thousand cheap steps, because by then they are saturated, capped or
culled.

### 6.10 Budgets

Per (shape, role) job: 5 ms slices; `EVAL_BUDGET` 4 M evaluations, `MS_BUDGET` 1.5 s of CPU (idle time), and
`TRI_BUDGET` 300 k emitted triangles or 40 MB of buffers. Processing is in key order (nearer sheets first), so the
budget always cuts the deepest, least visible sheets. In the prototype only e^{1/z} at K = 3 hit the budget (flat at
16x and in the Sphere view), and both still had IoU 1 with minimum coverage 3. A partial job sets the LED state 'partial' (`updateLeds`).

---

## 7. Sheet ordering and compositing

- **Draw order per shape: the layer first (key descending), then the core (with its skip flags), then the next shape.**
  The certified core is the shallowest sheet (window scale) and is always on top. Inside the layer, deeper keys are
  drawn first, so they sit under the nearer ones.
- The key is the octave depth of a triangle relative to the window scale in its chart, never decreasing from parent to
  child, plus deferrals. It orders sheets by how far they are from what the left plane shows at its own scale: bands
  near 0 and toward infinity (z^i, e^{1/z}, exp(H)) sit under the band that contains the window. Within one sheet
  there is no overlap, so order does not matter there. Ties are broken by heap order, which is deterministic for the
  same inputs.
- Blending stays premultiplied over (`ONE, ONE_MINUS_SRC_ALPHA`). With K from alpha, the composite equals the infinite
  stack to within 1/255. Changing alpha changes K, which re-runs saturation on the cached tree (no new evaluations for
  the existing nodes).
- The emitted buffer is ordered by a counting sort on key at upload, which is O(n). The prototype measured 10.7 ms for
  36 k triangles and 36.6 ms for 101 k when converting from JS objects (`mem.js`). The app writes typed arrays
  directly, and the upload is prepared in 5-ms slices: a running job uploads per-key ranges incrementally
  (`updatePremapped(range)`), with one full re-sort at the end.

---

## 8. GPU/CPU split and drawing pre-mapped triangles

| work | where |
|---|---|
| certified core triangles | GPU, as today (float32 chain, map cache, L = 4, skip flags) |
| classification, collar, refinement, saturation, line pieces | CPU float64, time-sliced |
| claimed triangles and collar output | CPU-**pre-mapped** triangles, drawn by a new GPU program without the chain |
| morph playback, transitions | GPU core only (as today, with the far fade) |

**Vertex format (flat)**, 48 B/vertex, 3 vertices per triangle (no index buffer: the per-triangle pattern anchors
differ between neighbours):

```
aW    : vec2 f32   w - O_w  (O_w = the view centre at upload, float64; re-anchored when |w - O_w| * 6e-8 * s > 0.05 px)
aRef  : int        -1, or the core map-cache texel (base triangle * uP + lattice index) for interface vertices
aPat  : vec2 f32   the active pattern's per-vertex coordinates (section 10)
aTri  : vec4 f32   per-triangle constants (pattern anchor A_T / scaled u_T, log-polar base, flags, Jacobian)
aAux  : vec3 f32   the second half of the chart-U pattern anchor (s_T and uhat_T need 3 more floats), key/flags
```

That is 8 + 4 + 8 + 16 + 12 = 48 B per vertex and 144 B per triangle: 100 k triangles = 14 MB. The Sphere view uploads the lifted 3D point
(3 f32) instead of aW. Infinity becomes exactly (0, 0, 1), with no float32 overflow.

**Programs** (`gl.js`): `premap` (2D) and `premapS` (sphere). The vertex shader computes
`w = aRef >= 0 ? texelFetch(uCoreW, ref).xy : aW + (O_w - centre)`, then the same view transform as `REGION_VS`. For
reference vertices it uses exactly the same expression, `((w - uCenter) - uCenterLo) * uScale`, with
`invariant gl_Position` added to `REGION_VS` as well. That is a one-line change to the core shader, with no cost. The
fragment shader is `REGION_FS` with its pattern body factored into `patternColor(...)` and fed from the bundle instead
of `vSrc`. The sphere variant reuses `SHADE` and the shell-depth fix. No chain is compiled into these programs, so
adding a step compiles nothing new for them.

**Resources**: `GLR.createPremapped(Float32Array, Int32Array refs, origin)`, `GLR.drawPremapped(res, st)` where
`st.core = {res: r.meshRes, cacheKey}` binds the core's cache entry (`cached(res, true, MESH_L, map, cacheKey)`, a cache
hit) as `uCoreW`. If no cache entry exists (non-rt fallback, a stand-in during a compile), the reference vertices fall
back to their own float64 values rounded to float32. The cracks this can open are sub-ulp and last only for those
frames.

---

## 9. Watertightness

1. **Core and core**: unchanged. The canonical `edgePt`, the same program and the same instance texels.
2. **Layer and layer**: every edge is an atomic object shared by its two triangles. A split creates `mid` and `kids`
   once, so both sides see the same vertex object with the same float64 image and the same float32 rounding. A leaf with
   hanging vertices is emitted as a fan around its centroid that **includes every hanging vertex**. Shared edges are
   bitwise identical in clip space (same expression, same inputs).

   **Late splits.** The heap does not guarantee that a leaf's neighbours are refined before the leaf is accepted, so a
   neighbour can split a shared edge *after* the leaf was emitted. The prototype's first sqrt run had 10 T-junctions
   from exactly this. The fix: an emitted leaf registers itself on its leaf edges. A later split of such an edge passes
   the registration to the halves and marks the leaf *dirty*. Dirty leaves are re-emitted once per upload (a fan with
   the new hanging vertices, no new F evaluations except its centroid). This is deferred, because re-emitting on every
   split was O(n^2): 750 k dead triangles and the budget tripped on z^i at 8x. With deferral there were 7-142
   re-emissions per run. The coverage stays exact at split time: the image sliver (a, m, b) between the old chord and
   the new hanging vertex is added to the coverage, or removed from it, on the leaf's side. Without that, a deep piece
   was once discarded as saturated against coverage the re-emitted fan no longer provided (1 hole pixel, z^i 8x, K = 1).

   **Check** (`tjunc.js`): over all drawn triangles (layer plus the certified core lattice), every open edge (a, b) is
   tested for a split (a, m), (m, b) on the other side. The result is **0 T-junctions** for z^i(H), log(H) at 16x,
   exp(H), e^{1/z}, Cayley at 64x, and sqrt at 4x (85-150 k triangles each).
3. **Layer and core**: the interface consists of lattice edges of *certified* core triangles. The layer never splits
   such an edge (6.7 claims the neighbour first). Every vertex on it (the lattice points t = 0, 1/4, 1/2, 3/4, 1) is
   drawn by the layer from **the same map-cache texel the core triangle reads**, through the same view expression with
   `invariant gl_Position`. The two sides therefore rasterize the same edge from bitwise-equal clip coordinates, and
   the edge-sharing rule of the rasterizer gives each pixel centre to exactly one side. The interior of a certified
   edge needs no refinement on the layer side, because the neighbour's certification (2 px at base level, 1/16 of
   that per GPU sub-triangle) already bounds its chord error.
4. **Collar and core** (B1): the collar's inner boundary is the B1 chain *built from the same atomic base edges*. Its
   lattice points are reference vertices when the core triangle is certified, and shared layer edges when it is
   claimed.
5. **Region boundary**: the boundary is drawn where it should end. Edge points are inside-snapped at full precision,
   cut points are shared per edge, and the cut-segment midpoint is tested on the true level set within tau. The
   only "gaps" are outside the region.
6. **Intentional omissions** (not cracks): culled pieces off the view plus margin; capped apexes, sub-pixel (0.5 px)
   and filled by the cap triangle itself; saturated sheets under K nearer layers; sub-pixel slivers along cuts inside
   the region (within the 2-px band of the image's true boundary); floor and budget drops (reported). A triangle that
   covers no pixel centre is never dropped as "hidden", so a pan does not reveal a gap.

What the old design lacked: today's fix-up pieces are independent source triangles with T-junctions against the L = 4
lattice, and the lax `0.2 * edge` acceptance lets chords cross the z^i hole. Both are gone.

---

## 10. Patterns

- **Core triangles**: unchanged, computed per fragment from `vSrc`.
- **Pre-mapped triangles** carry the *active* pattern's coordinates, computed on the CPU in float64 and reduced per
  triangle. A pattern change re-uploads from the stored vertices; nothing is re-evaluated.
  - Cartesian (checker, tiles, graph paper, solid net): `(z - Q_T)/cell` with Q_T snapped to the 10-cell period. The
    graph-paper axes use per-vertex `sa/cell` clamped to +-1e6.
  - Polar checker, polar web, source phase: per-vertex `(ln|z - o|, arg(z - o))`, unwrapped per triangle and reduced
    modulo the pattern period in ln r (pi/4 for the 16-sector checker). The polar web uses `(r - n_T cell)/cell`. For
    z^i every sheet differs by 2 pi in ln r, which is a multiple of the period, so every sheet shows the same parity:
    measured 1.000.
  - **Chart-aware interpolation for chart-U triangles** (Cartesian patterns): such a triangle is linear in u, not in z,
    so per-vertex z interpolation is wrong far out. Measured parity was 0.938 at 128x on w = 0 and 0.988 at 64x on
    w = 1. With chart-aware interpolation it is 1.000. The fragment shader reconstructs
    `z - Q_T = A_T - s_T * dhat / (uhat_T (uhat_T + dhat))` from the per-vertex scaled offset dhat = (u - u_T) 2^-e,
    per-triangle uhat_T = u_T 2^-e and s_T = 2^-e, with A_T = c + 1/u_T - Q_T in float64. There is no cancellation and
    no underflow up to |z| ~ 1e38; beyond that the cells are sub-pixel and moire-faded anyway.
  - **Spherical checker** (new, `uPattern == 8`): cells uniform in arg and in latitude 2 atan|z - o|, computed from the
    log-polar pair. Finitely many cells cover C plus infinity, and the existing fwidth fading turns the cells that hold
    infinitely many sheets near 0 and infinity into a uniform average.
  - Area scale: per-triangle log2 Jacobian from the float64 images.

---

## 11. Lines (boundaries, segments, lines, rays, grids)

There is no new shader. Pre-mapped polylines are drawn by the existing identity path (`createLines` with points
already in w, `line0`, `drawLines`); `isIdent` already routes there. Per (shape, role, map, view):

- **Curves on the source sphere**: a long curve (a line, a ray, a half-plane boundary, a sector ray) continues past B1
  in chart U, where a line not through c is an arc through u = 0. The point u = 0 is the curve's *apex*, never
  evaluated.
- **Adaptive bisection in the image metric**: the `mapCurve` criteria at tau, with the outcode shortcut. Off-view
  parts are kept coarse rather than dropped, so pans show them.
- **At an undefined or singular point on the curve**: CAP when the images converge, which closes Cayley's image of the
  real axis through w = 1 with no notch. CULL when they go to infinity off the view. Otherwise there are infinitely
  many windings (z^i maps the positive real axis onto |w| = 1 infinitely often), and **curve saturation** stops
  extending once M = 4 consecutive octaves add no stroke pixel outside the already-drawn stroke mask. The precision
  floor and budgets work as for regions.
- **Dashes** (open sets): arc lengths come exactly from the CPU polyline, so `arcOf` becomes a by-product.
- **Fallback**: the GPU-mapped lines stay as they are for morph playback and until the pre-mapped set exists for the
  view.

---

## 12. Views and interactions

- **Image mode, right plane (role 'R')**: the layer for `stageF(rightStage())` and the right view.
  `fixTargets`/`runFixInner` are replaced by `layerTargets`/`runLayers`; the scheduling (`scheduleFix`, 160 ms) and
  the `fixBusy` pause stay.
- **Left plane at leftStage > 0 (role 'L')**: the same machinery for `stageF(leftStage())` and `V.left`. At stage 0
  there is no layer (identity).
- **Sphere view (regions)**: role 'R' with `view.kind = 'sphere'` and R = the globe's px radius from `fitDist`. Tests
  are chordal, there is no culling, the image point infinity is allowed as a value (north pole), and coverage uses two
  hemisphere charts. The result does not depend on the camera, so orbiting is free and the GPU keeps redrawing the same
  buffers. Zooming the globe (a different R) re-runs on settle. The phase sphere is per pixel and unaffected.
- **Morph (deformation transport)**: while it plays, only the core is drawn (role null, today's fade). When paused or
  scrubbed, the layer runs for H_t with key `'M' + ...`, as `fixTargets` does today. Scrub frames show the core until
  the layer catches up.
- **Pans and zooms of the image view**: the tree, vertices and images are cached per (mesh, map). A view change re-runs
  only the decisions: classification thresholds, cull, accept, saturation. That is arithmetic over cached values plus
  new splits where the view now needs them. Zooming out uses coarser cuts of the same tree, and zooming in refines
  visible leaves. During motion the last buffers are drawn: the 25 % margin covers moderate pans, and newly exposed far
  parts appear on settle, progressively and near-first. A meshing-window change (`sourceViewChanged`, more than 0.3 of
  the window) rebuilds the core and the layer, as fix-ups do today.
- **Figure export (`renderOff`, 300 dpi)**: `buildFigure` awaits `prepareLayer(side, scaledView, {msBudget: 3000})`,
  which runs the same job synchronously in slices at the figure's own px scale. `renderOff` then draws with that
  layer instance, keyed by the figure view so the on-screen layer is untouched.
- **Thumbnails, Landscape outlines and the left globe**: they draw the core only (as today), or the 'L' layer when
  present for the left globe.
- **Context loss**: the layer's CPU state survives, and the GPU buffers are re-uploaded on restore.
- **Fix-ups**: `computeFix` and the `extraRes` (L = 1) path are removed. The layer subsumes them: cut straddlers, poles
  and branch points, with strict tests and no T-junctions.

---

## 13. Precision limits achieved

| quantity | limit |
|---|---|
| source near z = 0 (chart Z, CPU float64) | down to subnormals (boundary vertices snapped to 5e-324) |
| source toward infinity (chart U) | abs(z) up to ~1e300 (u >= 1e-300 floor); infinity itself is never evaluated |
| source near off-origin points | 1e-16 abs(p) (CPU), versus 1e-7 abs(p - window centre) on the GPU core |
| image values | float64 on the CPU, uploaded as f32 relative to O_w (0.05 px re-anchoring rule), or 3D lifts on the sphere |
| image near infinity | flat: culled by chordal caps; sphere: exact north pole |
| image chords | <= tau = 0.25 px (max measured 0.250 px; p99 0.24) |
| pattern coordinates | float64, reduced per triangle; chart-aware for chart U |

---

## 14. Prototype results

Files: `notes/proto/incremental/layer.js` (algorithm, ~1110 lines) and `run.js` (14 scenes with exact truth:
in-image test, signed distance, preimage for pattern parity). Debug drivers: `dbg_*.js`. Run
`node run.js [scene...] [--K=3] [--sphere=250] [--naive]`; `node table.js 1 3 1_sphere 3_sphere` prints the tables
from `results_K*.json`.

**What the prototype implements**: the real `Region.buildMesh` core (60 base cells, L = 4), classification, claims,
propagation, edge-point re-snapping, B1 and the collar fans, region clipping, image-driven bisection with the shape
guard, centroid fans, every stopping rule in section 6 (deferral and global saturation included), the singularity
probe, deferred re-emission with sliver coverage, and the flat and Sphere metrics. `tjunc.js` checks
watertightness; `mem.js` measures memory and upload preparation.

**Simplifications**: a single synchronous pass per view (no slicing and no tree reuse between views); interface
vertices use their float64 values (the texel references are a GPU-only mechanism); no lines; the core coverage is
rasterized from the L = 4 lattice evaluated on the CPU, a prototype-only cost of 21-210 ms (`coreCov` below) that the
app replaces with flat base triangles from values it already has, and skips for injective chains.

**Metrics** use 410 x 516 px planes (the quality suite's size). IoU, holes and spill are counted outside the 2-px band
around the true boundary. Parity is the checker or polar parity of the top sheet against the exact preimage, away from
cell edges. The chord deviation is the image of the chart midpoints against the drawn interpolation. On the sphere the
metrics use two 500 x 500 hemisphere charts and globe px.

### 14.1 Required cases: cost breakdown (node 26, single shot, ms; `coreCov` is prototype-only, see above)

| K | scene / view | total | class | coreCov | layer | F evals | layer tris | claimed | IoU | holes | spill | parity | max dev px |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | z^i(H) default | 434 | 31 | 65 | 330 | 214 k | 20.7 k | 115 | 1 | 0 | 0 | 1.000 | 0.250 |
| 1 | z^i(H) 16x out | 245 | 24 | 59 | 156 | 101 k | 8.7 k | 4 | 1 | 0 | 0 | - | 0.250 |
| 1 | log(H) default | 173 | 28 | 72 | 69 | 51 k | 4.2 k | 48 | 1 | 0 | 0 | 1.000 | 0.250 |
| 1 | log(H) 16x out | 253 | 22 | 56 | 172 | 80 k | 14.9 k | 4 | 1 | 0 | 0 | 1.000 | 0.250 |
| 1 | exp(H) default | 1006 | 27 | 42 | 934 | 649 k | 39.2 k | 1540 | 1 | 0 | 0 | - | 0.250 |
| 1 | exp(H) 16x out | 743 | 32 | 82 | 625 | 415 k | 40.9 k | 861 | 1 | 0 | 0 | - | 0.250 |
| 1 | e^{1/z} disc default | 895 | 33 | 73 | 783 | 702 k | 13.1 k | 616 | 1 | 0 | 0 | - | 0.250 |
| 1 | e^{1/z} disc 16x out | 2004 | 35 | 98 | 1866 | 1.86 M | 19.1 k | 215 | 1 | 0 | 0 | - | 0.250 |
| 1 | exp(strip) default | 110 | 12 | 32 | 61 | 54 k | 4.1 k | 670 | 1 | 0 | 0 | 1.000 | 0.243 |
| 1 | exp(strip) 16x out | 145 | 13 | 40 | 89 | 70 k | 8.2 k | 450 | 1 | 0 | 0 | 1.000 | 0.249 |
| 1 | Cayley(H) default | 88 | 23 | 59 | 3 | 16 k | 0.8 k | 0 | 1 | 0 | 0 | 1.000 | 0.182 |
| 1 | Cayley(H) 16x out | 73 | 20 | 49 | 1 | 14 k | 0.6 k | 0 | 1 | 0 | 0 | 1.000 | 0.011 |
| 1 | Cayley(H) 64x on w = 1 | 129 | 39 | 2 | 85 | 128 k | 1.0 k | 4428 | 1 | 0 | 0 | 1.000 | 0.086 |
| 3 | z^i(H) default | 603 | 31 | 65 | 499 | 274 k | 35.8 k | 115 | 1 | 0 | 0 | 1.000 | 0.250 |
| 3 | z^i(H) 16x out | 262 | 28 | 63 | 162 | 105 k | 9.8 k | 4 | 1 | 0 | 0 | - | 0.250 |
| 3 | log(H) default / 16x out | 187 / 265 | 32 / 28 | 81 / 66 | 69 / 168 | 51 k / 80 k | 4.2 k / 14.9 k | 48 / 4 | 1 | 0 | 0 | 1.000 | 0.250 |
| 3 | exp(H) default | 1473 | 44 | 50 | 1375 | 726 k | 101 k | 1540 | 1 | 0 | 0 | - | 0.250 |
| 3 | exp(H) 16x out | 950 | 29 | 50 | 866 | 454 k | 58.1 k | 861 | 1 | 0 | 0 | - | 0.250 |
| 3 | e^{1/z} default | 4124 | 50 | 78 | 3989 | 3.78 M | 40.6 k | 617 | 1 | 0 | 0 | - | 0.250 |
| 3 | e^{1/z} 16x out | 4862 | 51 | 66 | 4739 | 4.0 M (budget: 5 k nodes left) | 48.9 k | 215 | 1 | 0 | 0 | - | 0.250 |
| 3 | exp(strip) default / 16x out | 134 / 161 | 18 / 21 | 34 / 34 | 78 / 102 | 54 k / 70 k | 4.1 k / 8.2 k | 670 / 450 | 1 | 0 | 0 | 1.000 | 0.249 |
| 3 | Cayley(H) default / 16x / 64x on 1 | 133 / 184 / 203 | 33 / 33 / 48 | 91 / 143 / 0 | 4 / 2 / 147 | 16 k / 14 k / 128 k | 0.8 k / 0.6 k / 1.0 k | 0 / 0 / 4428 | 1 | 0 | 0 | 1.000 | 0.18 / 0.01 / 0.09 |

At K = 3 the minimum coverage inside the image is 3 for z^i, exp(H) and e^{1/z}, so the image is opaque at infinite
multiplicity.

### 14.2 All scenes (flat, K = 1 and K = 3): every scene and view gives IoU 1, 0 holes, 0 spill

z^2 of the quadrant, sin of the half-strip, 1/z of |z| > 1 (including 128x on the puncture), sqrt of the slit plane
(including 4x and 16x) and the z^i extra zooms all give IoU 1 with 0 holes and 0 spill, parity 1.000, and max deviation
at most 0.250 px. Costs are 73-890 ms. The z^i extra zooms are 8x into the hole (2.3-2.5 s, 1.7-1.9 M evaluations,
46-75 k triangles: three sheets at 8x resolution) and 32x on the inner rim (1.2-2.5 s).

### 14.3 Sphere view (R = 250 globe px)

| K | scene | total ms | layer ms | F evals | layer tris | IoU | holes | spill | max dev (globe px) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | z^i(H) | 943 | 788 | 417 k | 51.6 k | 1 | 0 | 0 | 0.250 |
| 1 | log(H) | 401 | 227 | 87 k | 14.7 k | 1 | 0 | 0 | 0.250 |
| 1 | exp(H) | 2556 | 2426 | 804 k | 86.5 k | 1 | 0 | 0 | 0.250 |
| 1 | e^{1/z} disc | 1216 | 938 | 390 k | 13.7 k | 1 | 0 | 0 | 0.250 |
| 1 | exp(strip) | 235 | 1 | 8 k | 0.2 k | 1 | 0 | 0 | 0 |
| 1 | Cayley(H) | 200 | 30 | 20 k | 2.0 k | 1 | 0 | 0 | 0.245 |
| 3 | z^i(H) | 1523 | 1332 | 540 k | 81.9 k | 1 | 0 | 0 | 0.250 |
| 3 | exp(H) | 3518 | 3318 | 1.17 M | 242 k | 1 | 0 | 0 | 0.250 |
| 3 | e^{1/z} disc | 4315 | 4108 | 4.0 M (budget, 296 nodes left) | 63.4 k | 1 | 0 | 0 | 0.250 |

The other sphere scenes (z^2, sin, 1/z, sqrt) also give IoU 1 with 0 holes at 102-679 ms. log(H)'s strip reaches its
cusp at the north pole, and 1/z and Cayley cap at 0 and 1 respectively.

### 14.4 Golden controls (bounded shapes, pinned views)

disc_cube, poly_mobius and joukowski: **0 claims**, so the pixels are identical. joukowski claimed 224 off-view
triangles until the "long edge but off view" rule (section 4) certified them. annulus_log: 69 claims + 23 propagated,
all along the branch cut. Its pixels change only within ~1 px of the image's Im w = +-pi edges (estimated < 0.2 % of
the plane, under the 0.5 % `golden_diff` gate).

### 14.5 Bugs found by the prototype (all fixed, and each is a design rule above)

- Boundary triangles tested on vertices beyond a cut (6.2, clipping).
- Edge points of `buildMesh` on the wrong side of a cut (4, re-snap).
- Sliver cascades from image-only edge choice (6.6).
- Mixed-chart units in the drop rule (6.5).
- Saturation that is vacuous in the pan margin (coverage includes the margin; at least one pixel required).
- The 1-px tolerance applied to non-rim edges (6.4 b4).
- A cached sphere lift that went stale on re-snap.
- Spirals into a subnormal boundary vertex (6.8).
- Jump detection killing spirals (6.4 b2).
- Late splits of emitted leaves: T-junctions and coverage drift (9.2: deferred re-emission plus sliver coverage).

---

## 15. Cost in the app, memory

- **CPU**: the node timings are single-shot CPU in a JIT similar to the browser's. Run in 5-ms slices (`FIX_SLICE`)
  with yields, an X ms job settles in about 1.5-2 X of wall time, idle only and progressive (nearer sheets first). Over
  today's fix-ups (similar classification cost):
  - Cayley, 1/z, Mobius-like maps: under 10 ms of extra layer CPU.
  - log(H), exp(strip), z^2, sin: 15-170 ms.
  - z^i(H): 155-500 ms.
  - exp(H): 0.6-1.4 s.
  - e^{1/z}: 0.8-4.7 s, capped by `MS_BUDGET` (1.5 s) at K = 3, where the remaining work is invisible.

  The settle-time regression test should gate each scene against its own baseline. The new behaviour only affects
  scenes that rendered wrongly before.
- **Frame time**: drawing pre-mapped triangles is one non-instanced draw of 3n vertices with no chain evaluation. That
  is far cheaper per triangle than the core's 16-sub-triangle template; this is an estimate, not measured in a
  browser, and the perf suite must confirm it. Pans and zooms change uniforms only; no CPU work happens during
  motion.
- **GPU memory**: 144 B per triangle, so 20-40 k triangles (typical) is 3-6 MB, and the worst case measured (exp(H)
  sphere, K = 3, 242 k) is 35 MB. Cap at 40 MB per (shape, role) and 96 MB in total, accounted in GLR's budget next to
  the 256 MB map caches.
- **CPU memory** (measured with `node --expose-gc mem.js`): the prototype retains 119 MB after z^i(H) at K = 3
  (46 k nodes; 84 MB before the re-emission bookkeeping added per-edge sets) and 51 MB after exp(H) at K = 3
  (128 k nodes). Most of that is prototype-only reference-render data:
  ~70 k core lattice objects and the emitted triangles as JS objects. The tree itself is ~0.3-0.4 KB per node
  (vertex, edge and triangle objects), so about 15-50 MB for 50-130 k nodes. In the app: emitted triangles live in
  typed arrays; the tree is dropped when the map or mesh changes; it is capped at 300 k nodes, LRU by root, re-deriving
  dropped subtrees on demand; and after 10 s idle only the frontier is kept (the leaves and their vertices).

---

## 16. Files and functions that change

- `region.js`: `buildMesh` also returns `X`, `Y` (axes) and per-vertex flags (corner or edge point, plus the grid edge
  of each edge point). A new `Region.layer` module, or a new file `src/layer.js` added to `build.py` after `region.js`,
  holds the prototype's algorithm (vertices, edges, triangles, charts, classification, collar, refinement, coverage,
  saturation, emission) with the time-sliced driver interface `step(ms) -> {done, emitted, partial}`, and
  `curveLayer(...)` for lines. `mapMesh` (`0.2 * e`) is used only by tests and is left alone.
- `gl.js`:
  - `invariant gl_Position` in `REGION_VS`.
  - Factor `REGION_FS`'s pattern body into `patternColor()`.
  - New `PREMAP_VS/FS` (2D and sphere) with the core-texel reference fetch.
  - `createPremapped`, `drawPremapped`, `updatePremapped(range)`.
  - Byte accounting for these buffers.
  - `PATTERNS.sphere = 8`.
- `app.js`:
  - `computeFix`, `runFix`, `runFixInner`, `fixTargets`, `destroyFix` and the `extraRes` path are replaced by
    `runLayers`, `layerTargets` and `destroyLayer` (same scheduling, tokens and `fixBusy`).
  - `drawScene`: per shape, draw the layer first, then the core with the skip flags, with no fade when a layer is
    ready for the role.
  - `sphereView`: the same for role 'R' sphere.
  - Lines draw the pre-mapped set when ready.
  - `renderOff`/`buildFigure` call `prepareLayer`.
  - `sourceViewChanged`, shape and chain edits invalidate as fix-ups do now.
  - LEDs show 'partial'.
  - Alpha changes re-run saturation.
- `funcs.js`: nothing required. Optional: `chainInjective(steps, built)` from `props.injective`. The app can compute it.
- `build.py`: include the new file.
- Tests: `test/t_layer.js` (node), plus the regression suites below.

---

## 17. Risks

1. **The saturation heuristics.** The argument-principle fill is exact for holomorphic F on the candidate. The guard
   catches poles and essential singularities inside most candidates, but not provably all: an undetected one could
   drop a visible deep sheet. Two things mitigate this. Saturation only applies at key > 0 under K nearer layers, and
   injective chains skip it. The apex rule (M = 4 saturated siblings) and the singularity probe are heuristics for
   self-similar singularities. *Test*: random chains of the catalog over random shapes, comparing IoU against a
   brute-force supersampled render.
2. **CPU cost for wild maps.** e^{1/z} at K = 3 needs 3-4 s of CPU, and is capped by the budget. If the settle-time gate
   is strict for such scenes, K could be lowered while the view moves often, or tau relaxed to 0.35 px for keys >= 2.
3. **GPU invariance.** `invariant gl_Position` in two programs should yield bitwise-equal clip positions for equal
   inputs. Some ANGLE/Metal paths have had bugs here. *Test*: a crack test that draws the layer and core in two colours
   over a black clear, at many pans, and counts uncovered interior pixels (`test/regress`). The fallback is a 1-px
   skirt of the core edge drawn first by the layer.
4. **Memory and draw count with many shapes.** The global caps apply, and deeper keys are dropped first.
5. **Pans beyond the margin** show the last buffers (coarse or missing far parts) until settle. That is acceptable
   ("never hurting pans" is about frame time), but it is visible on fast flings in zoomed-out views of unbounded
   images.
6. **Behaviour change on golden scenes with cuts** (annulus_log): small, and inside the boundary band.
7. **Interaction with morph scrubbing**: every paused t computes a new layer. The token cancels stale jobs, and
   scrubbing shows the core in the meantime, as today.

---

## 18. Phased implementation plan (tests first)

0. **Tests**, using the regression suites being built in `test/regress/`.
   - Port `run.js` scenes and metrics into `test/regress/quality/scenes.js` as new unbounded scenes:
     - z^i(H) at default, 4x and 16x, plus 8x on the hole. Checks: the hole stays empty, minCov >= K, polar parity.
     - exp(H) and e^{1/z} on the disc. Checks: all w != 0, minCov.
     - Sphere-view variants.
   - Add `test/t_layer.js` (node):
     - a watertightness check: every edge of the emitted triangles is shared exactly twice, or lies on the region
       boundary, B1/core interface or view;
     - the chord-deviation bound;
     - budgets;
     - determinism (same input, same buffer).
   - Perf: a settle-time probe per scene from the LED, plus memory.
1. **Layer core in `src/layer.js`** (CPU only) behind a flag. Classification, claims, re-snap and refinement on claimed
   core triangles only (no collar). The prototype's code, sliced. Pre-mapped triangles are drawn with a temporary
   simple program. Gate: z^i shards gone, golden unchanged.
2. **GPU program and watertight interface**: `premap` VS/FS, core-texel references, `invariant`, and the factored
   pattern code. Gate: the crack test passes on Chrome/ANGLE (Metal, GL) and Firefox.
3. **Collar** (B1, sectors, clipping, apex rules, caps). Gate: log/exp/strip/Cayley/1/z reach the edges at 4x and 16x
   with no notch at w = 1 and IoU 1.
4. **Saturation** (coverage, keys, fill test, deferral, global, probe). Gate: z^i, exp(H) and e^{1/z} are opaque at
   K = 3 within the budget.
5. **Sphere view** (chordal metric, two-chart coverage, `premapS`). Gate: the sphere scenes.
6. **Lines** (pre-mapped polylines through infinity, curve saturation, dashes).
7. **Interactions**: role 'L', morph pause, figure export (`prepareLayer`), alpha to K, pattern re-upload, context
   loss, budgets and LEDs.
8. **Remove `computeFix` and the fade** (kept for playback only). Perf gate: pan/zoom medians, settle times, example
   loads, scrubs and GPU memory all within tolerance of the baseline. Quality gate: every scene improves or stays the
   same; golden diff <= 0.005.

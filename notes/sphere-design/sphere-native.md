# Sphere-native meshing of mapped regions

Designer: **sphere-native**. Status: design plus a working node prototype (`notes/proto/sphere-native/`). Nothing in `src/` is edited.

## 0. Summary

The source region is a subset of the Riemann sphere from the start. A base octahedron with poles **0** and **∞** and equator |z| = 1 is refined **conformingly** by newest-vertex bisection (NVB) with **geodesic** edge midpoints. Each vertex keeps its point in a precision-preserving chart: z near 0 and across the plane, u = 1/z near ∞.

The CPU decides every refinement step in float64, in the **image metric of the view that shows the map**:
- flat views: chord deviation and edge length in screen pixels;
- the Sphere view: the same tests in pixels on the globe (chordal distance × globe radius);
- off-window images: culled with a rectangle test, plus a **view-centred chordal test** that culls images surrounding ∞.

**F is never asked for a value it does not have.** A vertex where F has no limit is **UNDEF**: the essential singularities of z^i at 0 and ∞, exp at ∞ and e^{1/z} at 0, and branch points such as log at 0. A pole or a limit at infinity is **INF**. Infinity gets a finite value only where F extends continuously, as the Cayley map does. The design does not assume a value at infinity.

Triangles that touch an UNDEF (or, in flat views, INF) vertex are **fans**. A fan is never drawn: it is bisected toward its apex. The descent toward the apex terminates in one of five ways:
- the ring pieces are **culled**;
- the ring pieces are **saturated**: a pixel-centre coverage counter shows they sit behind ≥ K nearer layers, with K set by α;
- the ring pieces are **sub-pixel**;
- a **quiet counter** expires after 32 consecutive levels that add nothing;
- the **precision floor** is reached.

Finished leaves are clipped by the region's level set (marching triangles, with bisection on the shared edge). They are uploaded **pre-mapped** as flat image triangles: float64 positions relative to a w-origin, with per-vertex pattern attributes reduced per triangle. The GPU does no chain evaluation for these draws. Sheets are composited **far to near by source depth D**, so the sheet the left plane shows is on top.

**Prototype results** (node, single thread, unoptimized; median of 3 runs; 410×516 panes; exact ground truth):

| | z^i(H) | log(H) | exp(H) | e^{1/z}, \|z\|<1 | exp(strip) | Cayley(H) |
|---|---|---|---|---|---|---|
| CPU ms, default view | 216 | 65 | 222 | 673 | 125 | 34 |
| CPU ms, zoomed out 16x | 29 | 78 | 349 | 791 | 103 | 10 |
| triangles drawn, default / 16x | 5.4k / 2.0k | 3.9k / 6.6k | 7.3k / 7.8k | 9.0k / 10.0k | 5.9k / 4.7k | 2.8k / 1.8k |
| IoU / hole px / spill px, all views | 1.0000 / 0 / 0 | same | same | same | same | same |
| max chord deviation | 0.23 px | 0.24 px | 0.25 px | 0.47 px (p99.9 0.28) | 0.24 px | 0.23 px |

On top of the table:
- **z^i hole:** the hole |w| < e^{-π} has 0 covered pixels out of 164 (flat view) and 0 of 400 samples on the globe.
- **z^i polar pattern:** the polar checker shows 0 wrong parities in 95,968 scored pixels, so all sheets coincide cleanly.
- **log(H) checker:** 0 wrong parities in 112,116 scored pixels.
- **Other acceptance cases:** z² of a quadrant, sin of the half-strip, 1/z of |z| > 1 (and a 128x zoom on w = 0), sqrt of the slit plane, and Cayley at a 64x zoom on w = 1 (no notch) all score IoU 1.0000 with 0 holes and 0 spill.

Today's build scores IoU 0.73 for logH_out4 and 0.17 for logH_out16, and fills the z^i hole.

## 1. Principles

1. **The source domain is the compact sphere.** A finite triangulation covers all of C ∪ {∞}. Unbounded regions are never truncated at a far box, so FAR and the fade box disappear for mapped views.
2. **A value is used only where it exists.** F(p) is evaluated where finite. Elsewhere a limit probe classifies the vertex as FIN, INF or UNDEF (§5). UNDEF vertices are never drawn and never interpolated across.
3. **Every refinement decision is made in the image metric** of the views that show the map:
   - flat views: screen pixels;
   - the globe: chordal distance × globe radius in pixels;
   - the source window: only to find boundary features and to order sheets.
4. **Conforming refinement.** NVB with closure leaves no hanging vertices. Shared vertices and clip points are evaluated once in float64. Watertightness follows by construction (§13).
5. **Termination is designed, not hoped for.** Each loop has its own stopping rule (§6.3): fans, cuts, infinitely many sheets, float64 exhaustion and budgets.
6. **Motion stays on the GPU.** CPU-pre-mapped geometry is valid for one map only. Frames whose map changes every frame (morph playing, parameter scrubs, shape drags) keep today's GPU-mapped path. When motion settles, the sphere mesh replaces today's fix-ups.

## 2. Scope: which draws use the sphere mesh

| draw | today | this design |
|---|---|---|
| left plane, stage 0 (the region itself) | grid mesh, identity ('local') | **unchanged** (fast and crisp) |
| right plane, Image mode, still map | GPU-mapped grid + CPU fix-ups | **sphere mesh** (role R, flat metric) |
| left plane, leftStage k > 0 | GPU-mapped + fix-ups (role L) | **sphere mesh** (role L, flat metric of V.left) |
| Sphere view, image mode, still map | GPU-mapped, lifted in float32 | **sphere mesh** (chordal metric, 3D upload) |
| morph playing, scrub, shape or handle drag | GPU-mapped | **unchanged** (GPU-mapped); the sphere mesh rebuilds when motion stops |
| Phase, Landscape, phase sphere | per pixel | unchanged |
| figure export (renderOff) | GPU + fix-ups | sphere mesh refined for the export view before drawing (§12.5) |

**Selection rule (goldens):**
- A mapped draw uses the sphere mesh when **(a)** the shape is unbounded or stretched (today's `stretched`), or **(b)** the existing first-pass CPU scan of the grid mesh finds trouble the old path cannot hide. Trouble means a vertex with a non-finite image, or a bad triangle whose depth-5 fix-up still leaves a remainder with an image larger than 0.5 px.
- Bounded shapes under clean maps keep today's path bit for bit. That covers disc_cube, annulus_log (its cut remainder is sub-pixel) and poly_mobius, so their goldens cannot move.
- The unbounded "bounded-group" scene (joukowski: the complement of a disc) moves to the sphere path. Its golden is gated by the 8/255 threshold, and the gate is checked in phase P2.

## 3. The source sphere and charts

**Point.** A point P of Ĉ stores:
- its unit 3-vector `X, Y, Zc` on the standard Riemann sphere, with 0 at the south pole and ∞ at the north;
- **both** chart coordinates in float64: `z = (zx, zy)` and `u = (ux, uy) = 1/z`, with ∞ meaning u = 0, z = ±Infinity;
- a **primary chart**: Z when |z| ≤ 1, U otherwise.

The lift is computed so that nothing overflows (`lift()` in `sphm.js`). From U, for example, X = 2ux/(1+|u|²) and Y = −2uy/(1+|u|²).

Near the south pole X ≈ 2x, which keeps full relative precision down to |z| ≈ 1e-300. Near the north pole, the U chart keeps it down to |u| ≈ 1e-300. Relative precision 1e-16 holds everywhere else.

**Geodesic midpoint (the only edge geometry).** m = normalize(P_a + P_b). It maps back through the Z chart when Zc ≤ 0, as z = (X + iY)/(1 − Zc), and through the U chart otherwise, as u = (X − iY)/(1 + Zc). Both denominators are at least 1, so the formula is stable. In the prototype it keeps relative precision for points such as 1e-200 and 1e200.

The rule depends only on the two endpoints, so the shared midpoint is identical from both sides. It also makes refinement geometric toward the poles:
- an edge 0 → r splits at ≈ r/2;
- an edge ∞ → R splits at ≈ 2R;
- an edge 1 → i splits on the unit circle.

**Why the standard sphere** rather than a sphere placed at the window: 0 and ∞ are the special points of every elementary map in the catalog (log, powers, roots, exp, 1/z, e^{1/z}), so they should be vertices. Fans then form naturally around them. Windows far from 0 cost a graded descent of log₂(|c|/H) levels; NVB grading is geometric, so that is cheap. Singular points elsewhere, for example e^{1/(z−1)} at 1, are resolved adaptively (§6.3).

## 4. Base triangulation and refinement labels

- **Vertices:** S = 0, N = ∞, and E_k = i^k for k = 0..3.
- **Faces:** (S, E_k, E_{k+1}) and (N, E_{k+1}, E_k), written newest-vertex first, so each face's **refinement edge** is its equatorial edge.
- **Matching:** each south face pairs with the north face across its refinement edge. The labelling is compatible, so NVB with recursive closure terminates.

**NVB.** A triangle (a, b, c) has newest vertex a and refinement edge bc. With m = mid(b, c), its children are (m, a, b) and (m, c, a). Two bisections halve a triangle that touches a pole, so fans shrink geometrically toward it.

```
bisect(T): if T split: return
  N = neighbour across refedge(T)
  if N and refedge(N) != refedge(T): bisect(N); N = neighbour across refedge(T)   // now compatible
  m = midVertex(refedge(T))                    // cached per edge: shared, evaluated once
  split(T, m); if N: split(N, m)
```

**Window awareness: the meshing window still matters.** clipWin, the left window, has centre c_L, half-sizes hw and hh, and half-diagonal R_L. It sets the **source metric**: the chordal metric of a sphere centred at c_L with radius R_L, scaled so that inside the window it equals left-view pixels:

> `srcPx(T) = (R_L·s_L/2) · max chordal_L distance between T's vertices`

A leaf whose region status is uncertain is bisected while srcPx(T) > **P_SRC = 12 px**. Uncertain means the boundary may pass through it: |level| < diam for distance-like levels, or a sign change among the six level samples for formulas.

This reproduces today's boundary-feature resolution in and near the window (60 base cells per window side ≈ 10 px). It decays outside the window, because the chordal metric has finite total area.

## 5. Vertex evaluation

**Image status (`evalF`).**
1. Compute w = F(z) in float64.
2. If w is finite and |w| < 1e300, the status is **FIN**.
3. Otherwise run the **limit probe**: two rings of 6 points at radii 1e-6·ρ and 1e-9·ρ around the vertex in its primary chart. ρ is |z| or |u|; for the exact poles, H_L/64 (in u: 1/(64·H_L)).
4. Lift every probe value to the image sphere, with ±Infinity going to N.
5. If any probe value is NaN, the vertex is UNDEF. If the inner ring's chordal spread is below 1e-5 and no wider than the outer ring's, the limit exists: INF if it is N, otherwise FIN with w = the limit. Anything else is **UNDEF**.

Behaviour on the catalog functions:

| function, point | result |
|---|---|
| 1/z at 0; z² and sqrt at ∞ | INF |
| Cayley at ∞ | FIN, w = 1 |
| z^i at 0 and ∞; exp at ∞; sin at ∞; e^{1/z} at 0 | UNDEF |
| log at 0 | UNDEF: chordally it creeps toward ∞ only logarithmically, which is harmless (the rings march off-screen and are culled) |

Pitfall found in the prototype: the probe radius **must be relative to the vertex itself**. An absolute floor near ∞ made vertices at |z| = 1e12 probe a ring around ∞ itself, which misclassified exp's right half-plane as UNDEF and exploded the mesh.

Cost: 12 evaluations per non-finite vertex; only exp(strip) has many of them. One evaluation of a catalog map costs **20–30 ns** in node, so evaluation is never the bottleneck.

**Region level (`evalL`).**
- At a finite vertex: L(z), with NaN treated as −∞, as buildMesh does.
- At ∞ (u = 0): the sign of L on a ring around ∞. All positive means inside (the complement of a disc); all non-positive means outside (bounded shapes). Mixed means **level-UNDEF** (half-planes, sectors, strips), and the vertex is an apex for clipping purposes.

**Apex of a leaf** (for one view): a vertex that is UNDEF, or level-UNDEF, or, in a flat view only, INF. On the globe an INF vertex is an ordinary vertex placed at the north pole.

## 6. The refinement loop

### 6.1 Data structures (one SphereMesh per shape × map × target view set)

- **Vertices (SoA, growable typed arrays).** zx, zy, ux, uy, X, Y, Zc, wx, wy (Float64); ws (Int8: −1, FIN, INF, UNDEF); lv (Float64); ls (Int8); pri (Int8). About 83 bytes each.
- **Nodes (NVB forest).** a, b, c, child (first of two adjacent ids, or −1), state (Int8: PENDING, FINAL, CULLED, OUTSIDE, SAT, DROPPED), committed (Int8), quiet counter q (Int16), depth D (Float32), level (Int16). About 26 bytes each.
- **Edge hash** keyed by `min·2^22 + max`. Values: the two leaf ids, the midpoint vertex, the clip vertex, and the jump verdict. The prototype uses JS Maps; production should use an open-addressing typed table at about 16 bytes per entry.
- **Priority queue:** a binary heap keyed by D (ties FIFO).
- **Coverage** per view (§8):
  - a Uint8 count per pixel centre (flat) or per cube-map cell (globe);
  - a pyramid of "cells below K" counts;
  - the number nU of unsaturated cells;
  - a min-heap of finished leaves waiting to be counted.

### 6.2 Source depth D (ordering of processing and of drawing)

D(T) = outside(T) + inner(T), where:
- outside(T) = max(0, log₂ min_i d_i), with d_i = max(|x_i − c_x|/hw, |y_i − c_y|/hh), the Chebyshev ratio of each vertex to the meshing window;
- inner(T) = max(0, log₂(P_REF / srcPx(T))), with P_REF = 4 px.

A leaf has D = 0 when it is visible at ≥ 4 px in the window. D grows by one per octave beyond the window and per octave below 4 px. Because refinement near an apex is geometric, D counts the rings toward a singular point: sheets near 0 of z^i get D ≈ 3–12, and sheets near ∞ get 7–16. The point need not be a vertex, which covers e^{1/(z−1)} at 1.

D decides two things:
- **processing order:** near first;
- **drawing order:** far first, ties at D = 0 broken by source y ascending, like today's row order.

### 6.3 Leaf decision chain (pseudo-code; every test is in the prototype's `processT`)

```
process(T):                                    // popped from the heap: smallest D first
  commitUpTo(D(T))                             // count finished leaves with D < D(T) - 0.5
  if nU == 0: mark every pending leaf SAT; stop          // GLOBAL SATURATION (§8)
  v = vertices(T); m = edge midpoints (cached vertices); evalL(v, m)
  // --- region -------------------------------------------------------------
  if no level-apex:
     if boundary may cross T and srcPx(T) > P_SRC: bisect(T); return     // feature resolution
     if all 6 level samples <= 0: T = OUTSIDE; return
  evalF(v)
  // --- fans: T touches an apex ---------------------------------------------
  if apex(T):
     if precisionFloor(T): T = DROPPED; return
     if q(T) >= QUIET (32 levels): T = DROPPED; return                   // quiet rule
     evalF(m)
     if flat and every apex is INF and the other samples are FIN/INF:
        P = lift_V(samples) + north pole                                  // view-centred image sphere
        if min chordal margin to the window cap > 1.5 * chordal diameter(P): T = CULLED; return
     if every apex has an image (only level-UNDEF) and the 6 samples span < 0.5 px: T = DROPPED; return
     fanSplit(T): bisect(T); ring = children not touching an apex
        q(children) = ring.all(quiet) ? q(T)+1 : 0        // quiet = outside, culled, saturated or sub-pixel
     return
  // --- interior samples ------------------------------------------------------
  evalF(m); if some m is not FIN (or INF on the globe): bisect unless at the floor; return
  g = F(geodesic centroid); if not finite: bisect unless at the floor; return
  S = px samples of v, m, g; dev = max midpoint/centroid deviation from the chords; emax = longest image edge
  // --- cull (flat) ------------------------------------------------------------
  if all 7 samples are off one side of the (guarded) view by max(2, emax/2) and dev <= 0.3*emax: CULLED
  if all samples lie outside the view's circumcircle with chordal margin > 1.5 * chordal diameter: CULLED
  // --- sub-pixel and discontinuities ----------------------------------------------
  if diameter(samples) < 0.5 px: FINAL (tiny)
  if every edge is sub-pixel or a jump (its midpoint within 0.5 px of an end), with >= 1 jump,
     and the centroid lies on a vertex:
       if every jump is confirmed by bisection on its edge (gap stays > 1 px down to 1e-15): DROPPED (sub-pixel cut)
       elif diameter <= 1.5 px: FINAL (a sub-pixel smear)
  // --- per-leaf saturation ------------------------------------------------------
  if D(T) > 0.5 and dev <= 0.25*emax and saturated(zone(T)): SAT
  // --- accuracy (image metric) ---------------------------------------------------
  ok = dev <= 0.3 px and emax <= 64 px and patternOK(T)
  if ok and T crosses the region boundary:
       ok = no double crossing on an edge and emax <= 24 px and boundary-midpoint deviation <= 0.5 px
  if ok: FINAL; clip; queue for commit
  elif precisionFloor(T): DROPPED
  else bisect(T)
```

Thresholds and their meaning:

| test | threshold | why |
|---|---|---|
| chord deviation at the 3 edge midpoints and the centroid | 0.3 px | sub-pixel geometry and source interpolation |
| image edge | 64 px (24 px if the leaf crosses the boundary) | samples dense relative to features; stops symmetric aliasing |
| pattern deviation (§10) | 0.5 px | cells drawn within half a pixel; skipped where cells < 2 px (moiré average) |
| boundary midpoint (bisect to the true boundary point near the clip chord's middle, map it, measure the distance to the image chord) | 0.5 px | fill boundary agrees with the stroke |
| cull margin | max(2 px, emax/2) with tameness dev ≤ 0.3·emax | a tame image lies within that hull |
| saturation K | ⌈log(1/255)/log(1−α)⌉: α = 1 → 1, 0.85 → 3, 0.5 → 8; capped at 16 | farther layers change no pixel by > 1/255 |
| quiet rule | 32 consecutive NVB levels (16 octaves) of ring pieces that add nothing | toward points without a limit |
| precision floor | \|Δcoord\| ≤ 1e-13·\|coord\| in the leaf's chart, or \|coord\| < 1e-280 | float64 exhausted |
| budgets | 300k nodes and 1.5 s CPU per mesh (prototype: 3M and 20 s); global 1.5M nodes per session | graceful: unfinished leaves are drawn as-is if dev ≤ 2 px, else dropped |

**Closure and state.**
- A node split by closure passes its state to its children.
- When a FINAL leaf that was already counted splits, its coverage is **subtracted** and the children's is added.
- Its SAT neighbours across the parent's three edges are **re-queued**, because the chords moved and a one-pixel sliver could open.

The prototype found both effects as single-pixel holes; the rules above remove them.

### 6.4 What the loop guarantees, case by case (all observed in the prototype)

- **log(H):** the rings toward 0 march left one octave per 4–6 px and are culled with the rectangle test. Toward ∞ they march right. Both ends reach the window edge at every zoom: IoU 1.0 at 1x, 4x and 16x, against 0.73 and 0.17 today.
- **z^i(H):**
  - every octave ring maps to a 0.69-rad arc of the annulus;
  - sheets 0 and −1 (D ≈ 0–3) cover it once each;
  - after K nearer layers every ring piece is saturated, and the quiet counter drops the fans 16 octaves later;
  - fans stop at about |z| ≈ 1e±14 (zoomed out) or ≈ 1e±10 (default);
  - the hole stays empty because no triangle spans it: chords never leave the annulus by more than 0.3 px.
- **exp(H) and e^{1/z}:** sheet 0 covers every pixel centre of the view, so **global saturation** (nU = 0) ends all remaining work at once. Without it, the visible strip of each ring around ∞ grows ∝ R, which was the 3M-node explosion before the rule existed.
- **exp(strip):** the right horn of the strip near ∞ maps beyond the window and is culled. The left horn maps to sub-pixel neighbourhoods of w = 0, so it goes quiet.
- **Cayley(H):** ∞ is FIN (w = 1). The fan at ∞ is only level-UNDEF (∞ lies on ∂H), so it shrinks until its image is under 0.5 px. A 64x zoom on w = 1 shows no notch.
- **sqrt of the slit plane:** leaves across the cut are refined until each side is under 0.5 px. Jump bisection confirms each discontinuity and the leaf is dropped. Near 0, where the jump itself is under 1 px, the leaf is drawn as a smear. The cut costs 11k dropped leaves and about 550k evaluations: the most expensive case. Catalog cut constraints (§16, phase P5) remove it.

## 7. Sheet ordering and compositing

**Draw order:** D descending (far first), then source y ascending.
- With α = 1 the top layer at each pixel is the preimage with the smallest D. That is the sheet visible on the left plane: the one inside the window, or the one least deep toward a singular point.
- For z^i the nearest sheet changes across the annulus. Where it changes, the polar pattern shows no seam, because all sheets coincide: 0 wrong parities in 95,968 pixels.
- Ties at D = 0 follow today's rule: later rows (larger source y) on top. For the D = 0 ties of bounded overlapping maps (z³ of a disc), the order equals today's up to seams inside one grid row; those scenes keep today's path anyway (§2).

**Deterministic:** D depends only on geometry and the meshing window, never on processing order.

**Upload sort.** The output buffer is sorted once per publish: a counting sort on D quantized to 1/16 octave (about 2 ms for 50k triangles), then by y. Incremental inserts (§12) go into per-D-bucket slot ranges, so order holds without re-sorting.

## 8. Saturation in detail (the infinitely-many-sheets stop)

**Coverage raster.**
- Flat views: one Uint8 count per **pixel centre**, the same sample rule as the rasterizer.
- Globe: a cube map, 6 × 256² cells for a 180 px radius. The prototype used a 2048 × 1030 longitude-latitude grid, which is why its sphere timings are high.

A finished leaf is counted only once the processing front has passed it: D(leaf) < D_current − 0.5. Counting pushes every changed cell through a pyramid of "cells below K" counts, and nU tracks the number of unsaturated cells.

**Per-leaf test.** The tested zone is the leaf's **clipped image outline**: vertices, edge midpoints, and clip points where an edge crosses the region boundary. The outline is adjusted per edge:
- **grown by ex = dev + 0.35 px across interior edges**, because the chords that would be drawn, and those of its descendants, lie that far out;
- **shrunk by sh = dev + 0.5 px along rim edges** (between two clip points; images of ∂region), because two sheets that share a rim draw chords that differ by up to the chord tolerance;
- grown parts that come near a rim edge are excluded.

The zone is a 2-Lipschitz function, so the pyramid answers whole blocks at once. The leaf is SAT if every pixel centre in the zone already carries K committed layers. If the zone holds no pixel centre, the leaf counts only when it is accurate (dev ≤ 0.3).

Each piece of this rule exists because of a bug the prototype hit:
- **rim shrink:** without it the z^i rings never went quiet, since the far sheets' rim slivers stayed "visible", and the mesh went to the precision floor (3M nodes);
- **chord growth:** without it a pixel inside a leaf's chord but outside its curved outline was lost (single-pixel holes);
- **no centroid fallback:** a fallback swallowed a 6 px near-sheet leaf in exp(H);
- **re-count on split:** stale coverage made an injective log leaf look saturated.

**Global saturation.** When nU = 0, every pixel carries K layers that are all strictly nearer than anything still pending, so every pending leaf becomes SAT. This rule bounds exp(H) at 0.2–0.35 s and e^{1/z} at 0.5–0.8 s.

**Ring pieces and the quiet counter.** At each fan split, the quiet test above runs on the new ring pieces immediately. The counter therefore measures what the next octave of rings would add.

## 9. The Sphere view

- **Image sphere:** the globe's own lift. Accuracy and edge tests use 3D distances × the globe's on-screen radius R_px, with the same thresholds. R_px does not change while orbiting, so **orbiting re-refines nothing**.
- **No culling**, so the far side is ready for orbits.
- **INF vertices are ordinary** and lift to (0, 0, 1). UNDEF vertices remain fans.
- **Saturation** uses the cube-map coverage.
- **Upload:** CPU-lifted float64 → float32 unit vectors × 1.002, drawn with the existing regionS shading. The fragment-depth fix in REGION_FS still applies. Poles are exact, where today float32 lift fails for |w| > 1e19.

Prototype on a 180 px globe:

| case | CPU ms | triangles | notes |
|---|---|---|---|
| z^i(H) | 1246 | 7.3k | hole 0/400 samples; chord ≤ 0.27 px |
| log(H) | 243 | 7.6k | lune pinched at ∞ |
| exp(H) | 1034 | 11.5k | |
| Cayley(H) | 151 | 4.5k | |
| e^{1/z}, \|z\| < 1 | 4543 | 14.2k | |

The globe's time goes to the prototype's 2.1M-cell longitude-latitude grid. The cube map plus span tests bring it in line with the flat views (projection).

## 10. GPU/CPU split, upload format and patterns

**CPU pre-maps settled geometry.** The CPU has evaluated every leaf vertex in float64 anyway, to make its decisions. The GPU draws each sphere-mesh triangle as a flat triangle with interpolated attributes:
- `aPos`: w − w₀ as float32, where w₀ is the view centre at upload. For the globe, a 3D position.
- Pattern attributes. Only the current pattern's set is uploaded; a pattern change re-uploads, which is cheap because the float64 source points are kept. Each set is **reduced per triangle** (the same offset for its three vertices), so values stay small in float32 and interpolation never wraps:
  - **checker, tiles, graph paper, solid net:** `(z − Q)/cell`, with Q today's pattern-aligned origin and the triangle's offset a multiple of 10 cells (the patterns' common period);
  - **conformal polar:** `(ln|z−o|, arg(z−o))·16/2π`, with arg unwrapped from the triangle's first vertex and both reduced by multiples of 16 (even, so parity holds). The fragment shader no longer needs `argWidth`: fwidth of the unwrapped varyings is right everywhere;
  - **polar web:** `(|z−o|/cell, arg·12/π)`, reduced by its periods;
  - **source phase:** `(arg z, ln|z|·6/π)`, bounded;
  - **spherical checker (new):** `(arg z·n_φ/2π, λ·n_λ/π)` with λ = 2·atan|z| − π/2 the source latitude, n_φ = 16 and n_λ = 8. 128 cells cover all of Ĉ; 0 and ∞ are cell corners where 16 sectors meet. Near them the sheets of z^i, exp and e^{1/z} pile up, cells shrink in the image, and the existing fwidth moiré blend gives a uniform average colour;
  - **area scale:** one flat value per triangle, log₂(image area / source area), with |du|² → |dz|² handled in the U chart.

**Pattern accuracy test** (part of §6.3):
- per edge, the deviation e of the midpoint's pattern value from the average of the end values, in cells;
- converted to pixels by px-per-cell = (longest image edge) / (largest change in pattern value);
- required: e × px-per-cell ≤ 0.5 px, unless px-per-cell < 2 (moiré zone).

For the z^i polar pattern this is exact, because ln r maps to arg w linearly.

**Shaders (gl.js).**
- REGION_VS gains a variant `'pre'`: positions from `aPos`, attributes passed straight through; no BARY, no chain, no midpoint test.
- REGION_FS is refactored into `shade(cart, polar, web, phase, sph, jac)`, fed either from today's vSrc computations or from the varyings. Today's draws produce identical code paths and identical goldens.

**Why not GPU-map the sphere leaves?**
- Chart-aware evaluation needs z = 1/u per vertex and per-chart origins, and float32 caps |z| at 3e38.
- GPU and CPU values differ, so the CPU's decisions (cull, saturation, the empty hole) would not hold for what the GPU draws.
- Template subdivision would reintroduce T-junctions between subdivided and flat triangles.

CPU pre-mapping draws exactly what was validated, and cheaply: 2–15k triangles with no chain evaluation, against about 115k chain-evaluated sub-triangles today.

**Lines (boundaries, segments, lines, rays, grids)** are sampled adaptively on the CPU as paths on the sphere, with the same criteria (`lines.js`):
- **Charts:** a straight line a + t·d uses two charts: t ∈ [−1, 1] (z = a + t·d) and τ ∈ [−1, 1] (z = a + d/τ, with τ = 0 at ∞). Bisection toward 0 or ∞ is geometric and exact to 1e-300. Rays use one half; circles, arcs and polygons keep their own parameters. FAR truncation disappears.
- **Per piece:**
  - accept when dev ≤ 0.3 px and length ≤ 48 px;
  - cull when off one side and tame, or when it runs to ∞ with all finite samples off one side;
  - a piece under 0.25 px is drawn as-is;
  - **stroke saturation:** drop the piece when every pixel along it is already stroked by a nearer piece (strokes are opaque);
  - toward a sample without a value, apply the quiet rule (24 consecutive siblings that add nothing), plus the precision floor.
- **Drawing:** pre-mapped polylines go through the existing `createLines` with origin w₀ and the `'local'` fetch, an identity draw. Dash arc lengths come straight from the CPU points, which replaces `arcOf`.

| line case (prototype) | CPU ms | segments | evaluations | max deviation |
|---|---|---|---|---|
| z^i of ∂H (wraps the unit circle; 0 and ∞ are UNDEF) | 16 | 408 | 27k | 0.18 px |
| same, zoomed out 16x | 4 | 141 | 8.5k | |
| log of ∂H | 0.3 | 173 | 0.5k | |
| exp of ∂H | 1.5 | 1128 | 3.7k | |
| Cayley of ∂H (through ∞ → 1) | 1.2 | 2168 | 4.3k | 0.09 px |

## 11. Precision achieved

- **Source:** |z| from about 1e-290 to 1e290 is resolved geometrically, plus ∞ exactly. Relative 1e-13 elsewhere is the refinement floor. An essential singularity at p ≠ 0 resolves to |z − p| ≈ 1e-13·|p|; saturation or the quiet rule normally stops long before that.
- **Image:** float64 values. On upload, float32 relative to w₀ gives an error of 1e-7 × (distance from w₀) per pixel. The mesh is re-uploaded when the view centre moves by more than 1e4 view widths or the zoom changes by 2^12; both checks are O(n), about 1 ms. Tested at 64x and 128x zooms on images of ∞ (w = 1 for Cayley, w = 0 for 1/z): IoU 1.0.
- **Globe:** float32 unit vectors, about 1e-5 px on a 180 px globe. Poles are exact.
- **Patterns:** reduced per triangle, so float32 holds cells to about 1e-6 at any source magnitude.

## 12. Interaction with the rest of the app

### 12.1 Jobs and time slicing

The job reuses fixJob's machinery: token, `rest()`, `fixBusy()`, 5 ms slices and cancellation. The heap loop can stop after any pop. One job runs per (shape, role, mapKey, viewKey).

While a mesh is incomplete, the plane keeps drawing **today's GPU path**. The sphere mesh replaces it at completion ("settle"), in one frame. Partial publication is optional: everything with D below the current front is final.

### 12.2 Pans and zooms of the image view: incremental, never a rebuild

- **Guard band:** culls test against the view enlarged 3x. Measured: z^i 213 ms (unchanged), log 48 ms, exp(H) 228 ms. Pans within one view width therefore need no new work: the frame is a uniform change.
- **Larger pans:** re-queue the CULLED leaves whose sample hull now meets the guard band. Their tests are cheap; new leaves are appended to slot ranges.
- **Zoom-in by f:** every FINAL leaf's deviation scales by f, so FINAL leaves whose dev·f > 0.3 or emax·f > 64 are re-queued and split. Children replace the parent's slot; freed slots become degenerate triangles; the buffer is compacted above 30 % dead. Until refinement catches up, chords show up to dev·f; at f = 2 that is ≤ 1.2 px for about 50–200 ms.
- **Zoom-out:** the mesh is over-refined, which is harmless. Idle-time coarsening merges sibling pairs whose parent passes the test, to bound memory.
- Saturation coverage is per view, so a zoom rebuilds it from the published triangles (one rasterization, about 3 ms).

### 12.3 Map changes (chain edits, parameter scrubs, morph scrubs) and shape edits

During motion, today's GPU path is drawn and nothing runs on the CPU (`fixBusy`). On settle:
1. **Rebuild from the octahedron** (the prototype costs above).
2. Optional warm start (phase P5): keep the previous tree's topology, re-evaluate its vertices (V evaluations, about 1 ms), then bottom-up re-test and merge or split.

Morph playing stays on the GPU path. A paused morph frame (map mode 1 or 2 at a fixed t) is a still map and gets its own sphere mesh, keyed like today's 'M…' fix key.

### 12.4 The left plane and the Sphere view

- Left plane: role L at leftStage > 0 is the same machinery with V.left as the target; D uses clipWin. Stage 0 is untouched.
- Sphere view: §9.
- Phase and Landscape: unchanged.

### 12.5 Figure export

`renderOff` builds, or refines a copy of, the sphere mesh for the export view (W × H × dpr) before drawing. It runs in slices with a progress note and a 3 s budget; at expiry it draws what is final, with τ relaxed to 0.6 export pixels.
- Boundary-driven leaves scale linearly with resolution; interior leaves scale as √(resolution).
- Projected for a 3x export: 2–5x the leaves, 0.1–2 s.

### 12.6 sourceViewChanged / clipWin

A new meshing window changes D and the feature resolution, so sphere meshes rebuild after settling, exactly when today's grid mesh rebuilds. A pure left-plane zoom therefore costs one rebuild, as today.

### 12.7 Context loss and memory caps

- **Context loss:** GPU buffers are rebuilt from the CPU triangle store.
- **Memory caps:** CPU about 8 MB per mesh at 40k nodes (prototype layout). GPU per drawn triangle: 3 × (2 + 4) floats ≈ 72 bytes, so 10k triangles ≈ 0.7 MB.
- **LRU:** meshes are evicted LRU against a 64 MB budget, so they never touch the 256 MB map-cache cap. They do not use the map cache at all.

## 13. Watertightness

1. **Conforming:** NVB with recursive closure never leaves a hanging vertex. Every leaf edge is an edge of exactly one neighbouring leaf, or of nothing.
2. **One value per vertex:** edge midpoints, clip points and jump verdicts are cached per edge key. Both triangles read the same float64 value, which becomes the same float32 relative to the same w₀. Shared chords are bitwise identical, and the rasterizer's fill rule leaves no gaps.
3. **Clipping** puts the clip vertex on the shared edge, so both sides of a boundary edge share it. Two crossings on one edge force a split.
4. **What is not drawn** is not drawn on purpose:
   - culled leaves are off-screen;
   - saturated leaves have every pixel centre of their zone covered K times by nearer layers;
   - gap leaves are sub-pixel blobs across a confirmed discontinuity;
   - fans are under 0.5 px, culled at ∞, or quiet.
5. **Measured:** 0 hole pixels and 0 spill pixels in every flat acceptance view (40 runs, `results.json`).

## 14. Prototype: what was built and what it measured

Files under `notes/proto/sphere-native/` (run from the project root with `node`):

| file | what it does |
|---|---|
| `sphm.js` | the mesher (861 lines): §3–8 |
| `run_cases.js` | acceptance cases with exact truth; rasterizes the output at pixel centres in draw order and measures IoU, holes and spill (2.5 px band excluded, as in test/regress), checker parity of the top layer, the z^i hole, layer counts, and chord deviation at edge quarter points and four interior points of every visible leaf |
| `bench.js` | medians of 3; writes `bench_out.md` and `results.json` |
| `lines.js` | line sampling (§10) |

Full table (ms = median CPU; nodes = NVB nodes; drawn = output triangles after clipping):

| case | ms | nodes | evaluations | drawn | culled | saturated | dropped | max / p99.9 dev (px) | IoU | holes | parity wrong / scored |
|---|---|---|---|---|---|---|---|---|---|---|---|
| zi_H | 216 | 16.9k | 21.8k | 5386 | 0 | 877 | 196 | 0.23 / 0.23 | 1.0000 | 0 | 0 / 95968 |
| zi_H_out4 | 57 | 10.1k | 9.9k | 2374 | 0 | 560 | 197 | 0.24 / 0.24 | 1.0000 | 0 | 0 / 3544 |
| zi_H_out16 | 29 | 8.7k | 7.8k | 1978 | 0 | 364 | 181 | 0.23 / 0.23 | 1.0000 | 0 | n/a |
| zi_H, α 0.85 (K = 3) | 378 | 36.2k | 54.5k | 14579 | 0 | 870 | 203 | 0.23 / 0.23 | 1.0000 (min 3 layers) | 0 | |
| logH | 65 | 14.5k | 17.1k | 3922 | 1013 | 118 | 196 | 0.23 / 0.23 | 1.0000 | 0 | 0 / 112116 |
| logH_out4 | 66 | 14.3k | 17.0k | 4506 | 382 | 66 | 194 | 0.23 / 0.23 | 1.0000 | 0 | 0 / 15628 |
| logH_out16 | 78 | 20.1k | 24.7k | 6560 | 388 | 54 | 525 | 0.24 / 0.24 | 1.0000 | 0 | 0 / 2056 |
| expH | 222 | 23.2k | 34.1k | 7280 | 1301 | 1875 | 0 | 0.24 / 0.23 | 1.0000 | 0 | |
| expH_out16 | 349 | 27.2k | 38.9k | 7795 | 612 | 3867 | 0 | 0.25 / 0.23 | 1.0000 | 0 | |
| e1z_disc | 673 | 37.3k | 53.6k | 8954 | 1436 | 6270 | 4 | 0.47 / 0.28 | 1.0000 | 0 | |
| e1z_disc_out16 | 791 | 43.5k | 63.6k | 10024 | 856 | 8826 | 0 | 0.24 / 0.23 | 1.0000 | 0 | |
| exp_strip | 125 | 44.9k | 143k | 5850 | 4668 | 148 | 3608 | 0.24 / 0.24 | 1.0000 | 0 | |
| exp_strip_out16 | 103 | 41.9k | 138k | 4682 | 4334 | 124 | 3608 | 0.24 / 0.24 | 1.0000 | 0 | |
| cayley_H | 34 | 8.3k | 9.0k | 2790 | 0 | 0 | 8 | 0.23 / 0.23 | 1.0000 | 0 | |
| cayley_H_out16 | 10 | 6.3k | 5.4k | 1786 | 0 | 0 | 16 | 0.06 / 0.06 | 1.0000 | 0 | |
| cayley_H_zoom ×64 at w = 1 | 22 | 7.5k | 6.6k | 462 | 1540 | 92 | 8 | 0.03 | 1.0000 | 0 | |
| sq_Q1 / out16 | 58 / 57 | 14k / 13k | 18k / 15k | 3714 / 3932 | | | | 0.23 | 1.0000 | 0 | 0 / 145872, 0 / 83056 |
| sin_halfstrip / out16 | 58 / 51 | 13k / 10k | 20k / 15k | 4900 / 4114 | | | | 0.24 / 0.25 | 1.0000 | 0 | |
| recip_ext / out16 / zoom ×128 at w = 0 | 22 / 5 / 28 | ≤ 5k | ≤ 7k | 2072 / 1464 / 412 | | | | ≤ 0.23 | 1.0000 | 0 | |
| sqrt_slit / out16 | 378 / 341 | 100k | 555k / 469k | 10142 / 11023 | 27.9k | 397 | 11.4k | 0.23 / 0.24 | 1.0000 | 0 | |
| disc_cube (bounded control) | 32 | 10.9k | 14.0k | 3966 | 0 | 0 | 0 | 0.23 | 1.0000 | 0 | |

The max deviation above 0.3 px for e1z_disc comes from the deliberately accepted sub-pixel leaves (diameter < 0.5 px) and cut smears (≤ 1.5 px); p99.9 is 0.28 px.

**Where the time goes** (CPU profile over zi_H, expH, e1z_disc and sqrt_slit):

| part | share |
|---|---|
| saturation zone tests (polyDist + pyramid recursion) | 44 % |
| bookkeeping in the leaf decision and the loop | 20 % |
| coverage rasterization | 4 % |
| edge maps | 5 % |
| **F evaluations** | **1–3 %** |

The prototype costs 4–13 µs per node; F itself costs 20–30 ns per call.

**Projected production cost** (estimate, not measured): 1.5–3 µs per node, from four changes:
- span-based zone tests against per-row Fenwick counts of unsaturated pixels, O(rows · log W) instead of O(area);
- typed-array edge hash;
- no per-leaf allocation;
- the cube map for the globe.

That gives z^i(H) about 25–50 ms, exp(H) 35–70 ms, e^{1/z} 55–130 ms, and sqrt slit about 150 ms (about 40 ms once catalog cut constraints arrive). Every CPU step is sliced at ≤ 5 ms, so the frame budget is untouched. The settle latency is the wall time, about 2× CPU at today's slice duty.

**Today vs. this design per mapped draw:**
- today: about 7.2k base triangles × 16 = 115k chain-evaluated sub-triangles, plus map-cache textures and fix-up triangles;
- this design: 2–15k flat pre-mapped triangles. Pans and zooms do no GPU chain evaluation, so frame times can only drop.

## 15. Files and functions that change (implementation map)

- **New `src/sphere.js` (SphereMesh).**
  - **construction:** `create({F, level, distLike, win: clipWin, views: [{kind, cx, cy, s, W, H, guard} | {kind: 'sphere', R}], alpha, pattern: {kind, cell, origin}})`;
  - **refinement and output:** `step(msBudget) → done`, `publish() → {pos, attrs, order, dirtyRanges}`;
  - **view changes:** `setView(i, view)` (re-queue rules of §12.2), `setPattern(p)` (attributes plus pattern re-test);
  - **lines:** `sampleCurve(pieces, view)` → polylines;
  - **lifecycle:** `stats()`, `bytes()`, `dispose()`. Pure JS, node-testable; it loads like region.js.
- **`src/region.js`.** Add `curvePieces(s)`: two-chart pieces for lines and rays, plus today's parametric curves for the rest. `levelOf`, `bboxOf` and `isOpen` stay. `buildMesh` and `sampleCurve` stay for stage 0 and the GPU path. FAR is used by the GPU path only.
- **`src/gl.js`.**
  - `createPreMesh(n)` and `updatePreMesh(res, ranges, data)`: a slot buffer holding positions, attributes and per-triangle values;
  - `drawPreMapped(res, st)`: program `regionP` / `regionSP`, REGION_VS `'pre'` and the refactored REGION_FS;
  - lines: `createLines(polys, w0)` with the `'local'` identity draw;
  - map caches: unchanged.
- **`src/app.js`.**
  - `shapeGPU`: per role, a `r.sph[key]` record and the selection rule of §2;
  - `scheduleFix`, `runFix`, `runFixInner` and `computeFix`: replaced by `runSphere()`, the same token and slicing;
  - `fixTargets()` becomes `sphereTargets()`, which adds the Sphere view;
  - `drawScene`, `renderSphere`: when a published sphere mesh matches (role, mapKey), draw it instead of the grid draws and fix-up extras;
  - `sourceCurves` and `arcOf`: the CPU line path;
  - `renderOff`: refinement for the export view;
  - `sourceViewChanged`: unchanged, but now also invalidates sphere meshes;
  - `fadeBox` / FAR: GPU path only.
- **`src/glsl.js`, `src/funcs.js`.** Unchanged in P1–P4. Phase P5 adds a list of cut rays per stage (`b.cuts` composed with the earlier stages) for cut constraints, and lets `props.mobius` / `props.rational` short-cut the probe at ∞.
- **Tests:**
  - new `test/t_sphere.js` (node);
  - `test/regress/quality` gains the z^i, exp(H), e^{1/z} and Sphere-view scenes, plus parity scoring for the polar pattern;
  - `test/regress/perf` gains settle time per acceptance scene and the pan/zoom frame times with a sphere mesh published.

## 16. Phased implementation plan, tests first

- **P0 Tests.**
  - Port `run_cases.js` to `test/t_sphere.js`. Assert, per case: IoU ≥ 0.999; holes ≤ 2 px; spill 0; z^i hole 0; parity wrong ≤ 0.1 %; p99.9 chord ≤ 0.3 px; nodes and evaluations within 1.5x of the recorded values; a CPU budget per case.
  - Add the browser scenes to the quality and perf suites. Record today's baselines.
- **P1 Core.**
  - `src/sphere.js` from the prototype with production data structures: typed edge hash, span and Fenwick coverage, cube map, slot output, and `step(ms)` slicing.
  - Gate: node tests pass, plus ≥ 2x faster than the prototype on bench.
- **P2 Flat image plane, role R.**
  - The pre-mapped GL draw and REGION_FS refactor: today's goldens stay bit-identical.
  - App wiring with the selection rule; the old fix-ups remain for bounded clean maps. CPU line sampling for unbounded shapes.
  - Gate: quality suite (unbounded scenes reach IoU ≈ 1, goldens unchanged, joukowski within threshold); perf suite (no regression in pan/zoom medians, example loads, scrubs; settle ≤ today + 100 ms median).
- **P3 Sphere view.** Chordal criteria, 3D upload, the spherical checker pattern.
  - Gate: Sphere-view scenes (z^i hole empty on the globe, pole coverage), golden for the bounded Sphere scene.
- **P4 Incremental use.** Guard band, re-queue on pan and zoom, slot compaction, coarsening, role L, renderOff, memory LRU.
  - Gate: the perf suite's pan and zoom scripts show no frame over today's, and no CPU slice over 6 ms (instrumented); export test at 300 dpi completes ≤ 3 s.
- **P5 Optimizations.**
  - Catalog cut constraints: split along `arg(G_{k−1}(z) − p) = θ` like a level set, evaluate one-sided limits, and skip jump bisection. Target: sqrt_slit nodes ÷ 5.
  - Warm start on map change; bounded singular cases (e^{1/z} on discs, z^i on discs around 0) through the selection rule.

## 17. Risks

1. **Settle latency on hard maps.** e^{1/z} and cuts cost 0.3–0.8 s CPU in the prototype. Production is projected at 3–5x less, and slicing keeps frames smooth, but settle after a map change may exceed today's fix-up time on these maps. Mitigations: P5 cut constraints and warm start; visible-first D order; a budget with graceful finish.
2. **The quiet rule is a heuristic.** A very slow spiral can have a sheet period above 16 octaves while parts of the image stay unsaturated for longer; z^{0.1i} has a period of about 90 octaves. Such a case could stop early. Mitigations: Q in octaves configurable up to 64; the precision floor; tests on z^{0.1i}.
3. **Probe misclassification near a nearly-defined limit** (log at 0 comes out UNDEF) costs refinement, not correctness. A false INF would wrongly allow the chordal fan cull. The inner-ring tolerance of 1e-5 chordal plus the monotone-shrink requirement make that unlikely; tests cover catalog functions at 0 and ∞.
4. **Ordering at D = 0 ties** differs from today's row order on overlapping sheets. Bounded clean scenes keep today's path; overlapping unbounded scenes (exp(H) inside the window) change, but deterministically.
5. **Incremental-update complexity** (slots, re-queues, revisits, coverage under splits). The prototype already needed the revisit rule. Mitigations: tests that diff incremental and from-scratch results after scripted pans and zooms (IoU 1, no holes).
6. **Memory and GC** at 100k+ nodes (sqrt_slit). Typed arrays and per-mesh budgets apply; JS Maps in the prototype allocate.
7. **Pattern changes** re-run the pattern accuracy test, so switching to polar may trigger extra refinement (seconds-scale only for extreme maps).
8. **Morph and scrub frames** keep today's artifacts (the filled z^i hole) until settle. That is accepted by design: performance during motion is unchanged.

## 18. Answers to the lead's specific questions

- **The value at infinity:** it is never assumed. Infinity has a value only after the probe proves a limit (Cayley → 1; poles → the north pole).
- **Refining toward undefined points:** geometrically, in the right chart: halving toward 0 in z, doubling toward ∞ through u. NVB fans give this for free.
- **Image-metric decisions:** pixels for flat views; chordal distance × globe radius for the Sphere view; the view-centred chordal cull for images around ∞.
- **Termination toward undefined points:** cull, saturation (global and per-leaf), sub-pixel, the quiet counter, the float64 floor, and budgets. Measured cases: log rings march off-screen and are culled; z^i rings saturate and go quiet; exp and e^{1/z} saturate globally.
- **Multi-sheet compositing:** deterministic far-to-near by source depth D; the left plane's sheet is on top.
- **Patterns:** the polar pattern is exact for z^i (0 parity errors). The spherical checker is defined in §10.
- **Lines:** sampled on the sphere through ∞ and through undefined points, with the same criteria.
- **Watertightness:** §13. **Precision:** §11. **Costs:** §14. **Interactions:** §12. **Plan:** §16.

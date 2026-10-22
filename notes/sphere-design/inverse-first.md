# Images through infinity and essential singularities: an inverse-first design

Designer: inverse-first. Status: design only (no `src/` edits). Prototype: `notes/proto/inverse-first/`
(`inv.js`, `fwd.js`, `deepzoom.js`, `common.js`; results in `out/*_results.txt`, renders in `out/*.png`).

## 0. Decision in brief

1. **Draw the hard cases per pixel, backwards.** In Image mode (and on the image Sphere, and on the left plane at a
   stage > 0) a shape whose image the forward mesh cannot draw is rendered by a full-screen pass. For every pixel w,
   the chain is run backwards: each step lists **all** of its preimages of w, respecting the forward step's principal
   branch, cut and sheet through a signed "range level". The region is then tested at each candidate z. Infinite
   families (exp, sin, z^i, ...) are enumerated as a window around the member nearest the source view. Covering
   candidates are sorted by a sheet key D(z) and composited front-to-back until the pixel is opaque to 1/255
   (3 sheets at the default alpha 0.85).
   No vertex ever needs a value at infinity or at an essential singularity, because the pixel never asks for one.
   The z^i hole is empty because no candidate there passes the branch window, and its rims are exact because the
   pixel distance is analytic.
2. **Applies when every step has a preimage enumerator.** That covers 26 catalog entries fully, polynomials and
   rationals of degree 2 or less, and custom formulas in which z occurs once. d/dz is never covered (section 3).
   Engagement is per shape: only "hard" shapes use it. A hard shape has an undefined point or a logarithmic branch
   point of the chain in its closure, or a pole, other branch point or infinity whose unresolved neighbourhood maps
   into the view (section 2). Bounded, regular shapes keep today's path, so the goldens are unchanged.
3. **Forward fallback, rebuilt on the sphere.** It covers non-invertible chains, frames of a playing morph, and the
   time while the inverse program compiles. The source is meshed on the Riemann sphere (stereographic unit vectors,
   relatively exact near 0 and infinity) and refined in the image metric. Edges are split when the chord deviation
   exceeds 0.25 px or the length exceeds 64 px, and refinement goes geometrically toward undefined vertices.
   Pieces are processed near-to-far by D. Saturation uses a 2x2-per-pixel transmittance buffer, and a stall rule
   stops the work. Split decisions are shared per edge, so the mesh is watertight (0 T-junctions measured).
4. **Spherical checker pattern.** It has 16 longitude sectors and 8 latitude bands of the app's own Riemann sphere
   (equator |z| = 1), so 128 cells cover C plus infinity. log(H) becomes a finite 8 x 8 grid whose end columns run to
   infinity, z^i(H) becomes concentric rings cut by finitely many rays, and Cayley(H) becomes a graticule that
   converges, moire-averaged, at w = 1.
5. **Prototype results.** The inverse path gives IoU 1.00000, 0 holes, 0 spill, an empty z^i hole and polar-checker
   parity 1.00000 on 10 acceptance chains at 3 zooms, in float64 and float32 emulation. The only exceptions are two
   tie lines of pixel centres lying exactly on a boundary (section 11). The forward fallback gives max chord
   deviation 0.225 px at unsampled points, 0 T-junctions, an empty z^i hole, and 256 to 129,906 triangles processed
   in 1 to 1866 ms of CPU (section 11).

---

## 1. Why inverse-first

The forward pipeline maps vertices and interpolates. It fails exactly where the user reported:

* **A vertex at 0 or infinity needs a value.** For z^i, exp and e^{1/z} no value exists there. Today the stretched
  grid truncates the region and the fix-ups stop at depth 5, so the image is never closed.
* **Infinitely many sheets need infinitely many triangles.** z^i maps every band of ratio e^{2pi} onto the whole
  annulus. The forward mesh can only cover finitely many bands, and its huge outer cells are flat chords.
* **Midpoint tests are relative (0.2 x edge).** They accept 6 px chords that cover the hole.

A pixel-side formulation has none of these problems. The image of a set R is {w : some z in F^{-1}(w) lies in R}.
The question per pixel is finite and well posed, even when F has an essential singularity in R (the preimage set is
then infinite, and saturation answers it). The test harness already defines ground truth exactly this way
(`test/regress/quality/scenes.js`, `pre(w)`). This design makes the renderer agree with the truth by construction.

## 2. Which path draws what (engagement)

For each shape s, each role (`R`: Image mode right plane or image Sphere; `L`: left plane at `leftStage() > 0`),
and each map spec:

```
path(s, role, map) =
  'inverse'  if eligible(map) && hard(s, map) && invProgramReady
  'forward*' if hard(s, map)                  (sphere-mesh fallback, section 8)
  'forward'  otherwise                        (today's mesh + fix-ups, unchanged)
eligible(map): mode 0 (a stage range 0..b), every live step in (0, b] has an enumerator (section 3),
               no d/dz step in [1, b], no step 'err' / 'unsupported'.
               (Homotopy frames: forward, except the invertible homotopy families of phase 6.)
hard(s, map):  (i)  the closure of s (on the sphere) contains a pulled-back UNDEFINED point (no limit: z^i at 0
                    and infinity, exp/sin/... at infinity, e^{1/z} at 0) or a LOGARITHMIC branch point (log,
                    arctan, artanh; the limit is infinity but every neighbourhood maps onto an infinite strip);
               (ii) or a pole, an algebraic branch point, or infinity (s unbounded) lies in its closure, AND the image
                    of its unresolved neighbourhood intersects the target view expanded by 25%. That neighbourhood
                    is the stretched mesh's outer ring at UMAX for infinity, and the circle of radius cell/32 (the
                    depth-5 fix-up resolution) for a finite point. The test maps 512 CPU samples;
               hysteresis: once hard for (shape key, chain key, role), it stays hard until either key changes.
```

Pulled-back singular points come from the same CPU enumerators. For each step k and each singular point sigma of
f_k, enumerate its preimages through steps k-1..1, windowed to the shape's neighbourhood, and test the region level
there (>= -1e-9 x scale).

Check against the golden controls. All four stay `forward`, so their goldens are bit-identical:

* `disc_cube`: z^3 has no singular point in the disc (0 is a critical point, not a singular one), and infinity is
  not in the closure.
* `annulus_log`: log's branch points 0 and infinity are not in the closure. The cut crossing the annulus is
  today's fix-up business.
* `poly_mobius`: the pole -i is outside the pentagon.
* `joukowski`: the poles are 0 (inside the removed disc) and infinity. The complement's outer ring maps to |w|
  about 55 view sizes, so (ii) is false.

The unbounded quality scenes become `inverse`:

* logH: branch point 0;
* exp_strip and sin_halfstrip: infinity is undefined;
* cayley_H and recip_ext: the outer ring maps near w = 1 and w = 0, in view;
* sqrt_slit: the outer ring maps to |w| about 18, in view at 16x zoom-out, and 0 is an algebraic branch point
  whose neighbourhood's image, near w = 0, is in view.

sq_Q1 stays forward until a zoom-out large enough makes its outer ring visible (|w| about 1e5). Today's render
there is already complete.

A debug setting "Exact images: auto / always / off" forces the path for tests and for users who want it. The
default is auto.

## 3. Catalog audit: preimage enumerators

Notation: Log is the principal logarithm and Arg is in (-pi, pi]. A forward branch with cut theta and sheet k takes
its argument in (lo, hi] = (theta - 2pi + 2pi k, theta + 2pi k]. The **range level** `lvl` is a signed distance in
the step's output units, positive inside the forward step's range, with unit gradient `lg` (used for anti-aliasing,
section 4.4). `dudw` is the derivative of the preimage, du/dw. **Singular** lists points of the step's input plane
with their kind: `pole` (limit infinity), `limit` (finite limit), `branch` (continuous but multivalued), `undef`
(no limit). These feed hard(), D (section 5) and the forward vertex classification (section 8.3).

| step | preimages u of w | count | range level (lvl, lg) | singular | notes |
|---|---|---|---|---|---|
| mul c != 0 | w / c | 1 | none | - | c = 0 is constant: forward |
| add c | w - c | 1 | none | - | |
| affine a != 0 | (w - b) / a | 1 | none | - | anchored form (6.2) |
| recip | 1 / w | 1 | none | 0: pole; inf: limit 0 | u-chart at w = 0 |
| mobius (mob) | (d w - b) / (-c w + a) | 1 | none | -d/c: pole; inf: limit a/c | anchored form; nearly degenerate (mobRel < MOB_EPS): forward |
| blaschke, abs(a) != 1 | Mobius | 1 | none | as Mobius | abs(a) = 1 is constant: forward |
| pown n >= 1 | abs(w)^(1/n) e^{i(Arg w + 2 pi j)/n} | n | none | inf: pole | window of 2M+1 roots around j* = round((n arg(ref) - Arg w)/2pi), or all when n <= 2M+1 |
| pown n <= -1 | roots of 1/w | abs(n) | none | 0: pole; inf: limit 0 | |
| pown 0 | - | - | - | - | constant: forward |
| root n, theta, k | w^n (`ipow`) | 1 | sector of w between t1 = (theta - 2pi + 2pi k)/n and t2 = (theta + 2pi k)/n: lvl = min(cross(e1,w), -cross(e2,w)), lg = i e1 or -i e2 | 0: branch (limit 0); inf: pole | |
| powa alpha, theta, k | L_m = beta (Log w + 2 pi i m), beta = 1/alpha, u = e^{L_m}, carries Lambda = L_m | finite if Re beta != 0 (about 1/(abs(Re beta)) members); **infinite if Re alpha = 0** | lvl = min(Im L - lo, hi - Im L) abs(alpha) abs(w); lg = +-conj(beta / w) i | 0, inf: limit if Re alpha != 0, **undef if Re alpha = 0** | infinite case: the range test does not depend on m; m* = round((Re(beta Log w) - ln abs(ref)) / (2 pi Im beta)) |
| exp | Log w + 2 pi i m | infinite | none (w = 0 omitted) | inf: undef | m* = round((Im ref - Arg w)/2pi); window clamped to the region's y-extent (4.3) |
| log theta, k | e^w, Lambda = w | 1 | lvl = min(Im w - lo, hi - Im w), lg = +-i | 0, inf: branch (limit inf) | |
| sin | asin w + 2 pi n, pi - asin w + 2 pi n | 2 x infinite | none | inf: undef | n* from Re ref; window clamped to the x-extent |
| cos | +-acos w + 2 pi n | 2 x infinite | none | inf: undef | |
| tan | atan w + pi n | infinite | none (+-i omitted) | pi/2 + pi n: poles; inf: undef | |
| sinh | asinh w + 2 pi i n, i pi - asinh w + 2 pi i n | 2 x infinite | none | inf: undef | |
| cosh | +-acosh w + 2 pi i n | 2 x infinite | none | inf: undef | |
| tanh | atanh w + i pi n | infinite | none (+-1 omitted) | i(pi/2 + pi n): poles; inf: undef | |
| arcsin | sin w | 1 | lvl = pi/2 - abs(Re w), lg = -sgn(Re w) | +-1: branch; inf: log-type branch | principal strip; boundary lines are measure-zero, decided by the round-trip test |
| arccos | cos w | 1 | min(Re w, pi - Re w) | +-1: branch; inf: log-type branch | |
| arctan | tan w | 1 | pi/2 - abs(Re w) | +-i: limit inf (log type); inf: undef (+-pi/2 by direction) | |
| arsinh | sinh w | 1 | pi/2 - abs(Im w) | +-i: branch; inf: log-type branch | |
| arcosh | cosh w | 1 | min(Re w, pi - abs(Im w)) | +-1: branch; inf: log-type branch | |
| artanh | tanh w | 1 | pi/2 - abs(Im w) | +-1: limit inf | |
| joukowski | w + s, w - s with s = sqrt(w-1) sqrt(w+1) | 2 | none | 0, inf: pole | interior root as 1/(w + s), no cancellation |
| ijouk exterior / interior | (w + 1/w) / 2 | 1 | abs(w) - 1, or 1 - abs(w); lg radial | +-1: branch; inf: pole or limit 0 | |
| conj | conj(w) | 1 | none | - | anticonformal: the Jacobian flag flips (4.2) |
| poly deg 1 | affine | 1 | | inf: pole | |
| poly a z^n + b | n-th roots of (w - b)/a | n | | inf: pole | as pown |
| poly deg 2 | stable quadratic: q = -(b + s sqrt(b^2 - 4a(c-w)))/2 with s = sgn Re(conj(b) sqrt(...)); u1 = q/a, u2 = (c-w)/q | 2 | | inf: pole | |
| poly deg 3-4 | Cardano / Ferrari seeds and 2 Newton steps (phase 6) | 3-4 | | | |
| poly deg >= 5 | - | - | - | - | **forward** |
| rational deg 1 | Mobius | 1 | | | needs degExact |
| rational deg 2 | quadratic p(z) - w q(z) = 0 | 2 | | roots of q: poles | needs degExact, coprime |
| rational deg >= 3 | - | - | - | - | **forward** |
| custom, z occurs once, no Re/Im/abs/arg on the path to z | node by node, outermost first, with the formula's cut theta: neg, add/sub/mul/div by a constant, c/g (recip), integer pow (roots), real or complex pow (powa, finite or infinite), root, sqrt (root 2 with cut theta), log (cut theta, sheet 0), exp, c^g (exp family divided by Log c), trig, hyperbolic and their inverses, sec/csc/cot/coth (recip, then the inverse), conj | as the nodes | as the nodes | as the nodes | more general than `Expr.invert`: every branch is enumerated and range-tested, so log of z^{1/2} and the like work |
| custom, z occurs more than once, or a lossy function on the z path | - | - | - | - | **forward** |
| deriv (d/dz) | - | - | - | - | not a map: chains with d/dz use **forward** |

Off steps are skipped. Constants inside formulas keep their principal values, exactly as `Expr.compile` does.

**Correctness contract**, enforced by unit tests (phase 1). Two properties must hold for every enumerator:
(a) soundness: every candidate with lvl >= 0 satisfies abs(f(u) - w) <= 1e-12 (1 + abs(w)) under the app's own
`CX` and `Funcs` forward step;
(b) completeness: for random u in the step's domain, u is among the candidates of w = f(u) when the window is
centred near u.
The range level is cross-checked against the forward branch (`argCut`) away from an epsilon band.

## 4. The per-pixel inverse renderer

### 4.1 Per-frame inputs

These come from the CPU each frame. They are cheap and none of them is per pixel.

* Chain parameter cells: the existing `uChain[]` written by `GLChain.fill()`, read by the enumerators too, so a
  parameter drag never recompiles.
* The view: centre as hi/lo, scale, pane rectangle. Also the **anchored first step** (6.2): the first backward
  step evaluated at the view centre in float64 (for a Mobius step: num0 = d c_v - b, den0 = a - c c_v).
* Reference points ref_k = G_k(c_ref) for k = 0..b-1, where c_ref is the source view centre, nudged by R/4 at
  angle 0.3 if a stage is singular there. These centre the infinite families.
* For D (section 5): the source window W_src (`S.srcView` box), its radius R, and up to 4 pulled-back undefined
  or branch points near it.
* Shapes as records in a float texture, exactly as `drawPreimage` packs targets (`TKIND`, A/B parameters, polygon
  vertices, up to 4 compiled formula level functions). Up to 8 shapes per pass. Display: alpha, pattern, cell,
  colours, lines flag, dpr, pattern origin Q (snapped like `regionUniforms`).

### 4.2 The candidate record

```
struct Cand {
  vec2 z;      // the source point (float32), or a direction-only value when Lambda is used
  vec2 lam;    // Lambda = log z when the backward chain produced it (exp-type and log steps): exact for any |z|
  bool hasLam;
  vec2 J;      // dz/dw (complex); with `anti` set (an odd number of conj steps) the derivative is dz = J conj(dw)
  bool anti;
  float lvl;   // min over steps of the range level converted to pixels: lvl_k / (|dw_k/dw| * pixel)
  vec2 lg;     // image-space unit gradient of the binding range constraint
  int path;    // mixed-radix member indices of the multivalued steps (re-evaluation key)
};
```

### 4.3 Backward enumeration

```
enumerate(w):                                   // w: pixel centre in stage-b coordinates (anchored, 6.2)
  leaves = [{u: w, J: 1, lvl: +inf, lg: none, path: 0}]
  for k = b down to 1:
    next = []
    for c in leaves:
      for each member p of pre_k(c.u, ref_{k-1}):          // window: see below
        lvl_px = p.lvl / (|c.J| * pixel)                 // c.J = dw_k/dw at this point of the walk
        if lvl_px < -1: continue                         // beyond the anti-aliasing ramp: not a preimage
        next.push({u: p.u, lam: k == 1 ? p.lam : none, J: c.J * p.dudw,
                   lvl: min(c.lvl, lvl_px), lg: lvl_px < c.lvl ? conj(c.J) * p.lg (normalised) : c.lg,
                   path: c.path * radix_k + index(p)})
    leaves = next                                        // capped: 48 leaves per pixel in all
  return leaves                                          // u is now z
```

Windows of infinite families are scanned outward from the centre member m* (m*, m*+1, m*-1, ...), with at most
2M + 1 = 17 members. Three pruning rules apply:

* **Region extent.** When the family's step reads the z-plane (k = 1, or after affine steps), the window is
  clamped to the region's bounding interval along the period direction, with a margin of pi/8. Example: the strip
  |Im z| < pi/2 under exp keeps 1 member instead of 17, and the half-strip under sin keeps 1 to 3 instead of 34.
  Measured in the prototype: 0.6 to 1.2 candidates per pixel instead of 17 to 34.
* **m-invariant ranges.** For powa with Re alpha = 0, the range level does not depend on m. If it fails for one
  member it fails for all, and the pixel is empty with one evaluation (the z^i hole and the outside of the
  annulus).
* **Early stop.** After compositing reaches saturation at key D_sat, a scan direction stops at its first member
  with D > D_sat. D grows monotonically away from the window along every family. Measured: 5.0 (exp(H)), 5.1
  (e^{1/z}) and 10.8 (z^i, dominated by off-image pixels) members per pixel instead of 17.

Several multivalued steps nest. Their windows are reduced so that the product of window sizes stays at or below
48 leaves, with innermost families favoured.

### 4.4 Coverage of one candidate (analytic: no dFdx, so no seams)

Per-pixel derivatives (dFdx) cannot be used for anything that depends on a family index. Across Arg w = pi the
member labelled m on one side is m+1 on the other, so a derivative across that line jumps. Everything is therefore
taken from the analytic Jacobian.

* The screen-to-source Jacobian is dz/dX = J dw/dX and dz/dY = J dw/dY, where dw/dX = 1/s and dw/dY = -i/s in
  flat views. On the Sphere these come from dFdx/dFdy of the globe point, which is smooth (4.8). With `anti` set,
  conj(dw) replaces dw.
* Region signed distance in pixels: s_reg = L(z) / (|grad_z L| rho), where rho is the pixel footprint |dz/dX|.
  Built-in kinds are distance functions (|grad L| = 1, with an analytic gradient direction). Formula kinds use
  central differences at z +- rho and z +- i rho (two to four extra evaluations).
* Branch range: s_rng = lvl (already in pixels).
* **Intersection rule.** n_reg = conj(J) grad_z L, normalised, is the image-space normal of the region boundary.
  ```
  cv = dot(n_reg, lg) < -0.5 ?  clamp(min(s_reg, .5) + min(s_rng, .5), 0, 1)   // facing boundaries
                              :  clamp(min(s_reg, s_rng) + .5, 0, 1)
  ```
  The facing case matters where the region continues across a cut onto the invalid branch. log(H) at
  Im w = -pi is an example: there the region boundary and the cut coincide with opposite orientation, and the
  plain min() paints a half-pixel ghost line. Measured coverage error there drops from 0.43 to 0.02.
* Points beyond float32 range (|z| > 1e30) with hasLam: shapes with a log-polar level use Lambda (half-planes and
  sectors through 0: sign sin(Im Lambda - angle), magnitude e^{Re Lambda - ln|J|}/pixel). Bounded shapes are
  outside and their complements are inside. Formula shapes use the level at z clamped to 1e30 times the direction.

### 4.5 Ordering, compositing, saturation

```
cands = covering leaves (cv > 0) with key D(z) (section 5)
keep the B = 8 smallest keys in a register insertion buffer: (D, cv, path)
U = max cv                                          // coverage-union rule
T = 1, C = 0
for e in buffer, increasing D:                      // front to back
  if T < 1/255: break                               // saturated: deeper sheets cannot change the 8-bit result
  rel = e.cv / U
  a = alpha_shape * rel
  colour = pattern(re-evaluate leaf e.path)         // only the <= 3-4 composited leaves are re-evaluated
  C += T * a * colour;  T *= 1 - a
if T >= 1/255 and an infinite family's last scanned member in some direction covered:
  C += T * patternAverage;  T = 0                   // tail closure: infinitely many more sheets cover the pixel
out = (U * C, U * (1 - T))                          // premultiplied, blended over what is below (earlier shapes)
```

Coverage-union matters at the rims. On an infinitely-sheeted image every sheet shares the same boundary. The naive
1 - prod(1 - cv_i) turns a half-covered rim pixel into 1 - 0.5^K, which is about 1: a rim 0.5 px too thick and IoU
0.44 at the 16x zoom-out of z^i (measured before the fix). Coverage-union is exact for coincident edges and within
1/8 for crossing ones. With alpha = 0.85, three covering sheets give T = 0.0034 < 1/255. The measured maximum is
3 composited sheets on the default and 4x views, 4 at e^{1/z}, and up to 8 only on 85 rim pixels of the 23 px wide
z^i image at 16x in float32.

### 4.6 Patterns with analytic footprints

Every existing pattern (checker, polar, tiles, graph paper, polar web, source phase, area scale, solid) and the new
spherical checker is evaluated at the candidate z. Each `fwidth(p)` is replaced by its exact value for the
linearised map. For a real pattern coordinate p with complex gradient g_p:

```
fw(p) = |Re(conj(g_p) dz/dX)| + |Re(conj(g_p) dz/dY)|        (= rho |g_p| (|cos(phi - arg g_p)| + |sin(phi - arg g_p)|))
```

Applied to each pattern:

* checker: g = (z - Q)/cell, so fw = rho(|cos phi| + |sin phi|)/cell.
* polar: (ln r, arg) have |grad| = 1/r. With Lambda they are taken from Lambda directly, so the polar checker is
  exact on every sheet at any |z|.
* `argWidth` becomes 1/r analytically.
* area scale: `vJac` becomes -2 log2|J|, which is exact and smooth.

The pattern bodies stay in one template string with two footprint modes ("fwidth" for `REGION_FS`, "analytic" for
the inverse shader). The forward shader's generated text is byte-identical to today's (golden-safe).

For z^i the polar coordinates of the members are (Arg w + 2 pi m, -ln|w|) times 16/2pi. They differ by 16m, which is
even, so all sheets carry the same parity. The image is a clean polar checker on the annulus. Measured parity
agreement is 1.00000 with zero disagreeing sheets (`out/inv_zi_H_default_pattern.png`).

### 4.7 Strokes and curves

* **Undashed area boundaries and curves** (segment, line, ray, circle, arc, polyline up to 256 points, Cartesian
  and polar grids) are drawn per pixel in a second full-screen "stroke pass" after all fills, which keeps today's
  order of fills first, lines last. Each candidate z gets its nearest curve point q (`curveNear` of `PRE_FS`, moved
  to the source plane), giving a pixel distance |z - q| / (|J| pixel). Coverage is the union over candidates
  (strokes are opaque), with the casing as a second ring of width 3.5 px, as `drawPreimage` draws target curves.
  Exact through infinity and undefined points: the real axis under z^i yields the two circles |w| = 1 and e^{-pi}
  at uniform width with no sampling.
* **Dashed boundaries** (open sets) keep the forward line renderer in phases 2-5 (8.9). Phase 6 adds per-pixel
  dashes from a CPU-built 1D lookup (source boundary parameter t to image arc length s mod (on + off), sampled
  adaptively in the image metric) read at q's parameter.

### 4.8 Sphere view (image on the Riemann sphere)

The same fragment code runs over the globe geometry (`SPHERE_VS`, as `preS` does today). The fragment's unit vector
P gives w in two charts: w = (P.x + iP.y)/(1 - P.z) when P.z <= 0, otherwise u = 1/w = (P.x - iP.y)/(1 + P.z). Each
enumerator takes (value, chart):

* Mobius acts on homogeneous pairs.
* recip swaps the charts.
* Log w = -Log u.
* Roots and powers of 1/u are taken directly.

The poles of the image sphere are therefore ordinary pixels: the Cayley image's w = 1 and the 1/z image's w = 0
need no special case. The footprint comes from dFdx/dFdy of w, which is smooth on the globe away from the north
pole (where the u chart's derivatives are used instead). It is pushed through J, so the patterns' moire fading is
correct on the limb too. Back faces are culled by the globe's own depth, and lighting is the existing `shade()`.

### 4.9 Left plane at stage > 0 (role L)

The same pass with b = `leftStage()`. The source window for D is the z-plane's `S.srcView`. The left plane at
stage 0 (the region itself) is unchanged: it is the identity draw, fast and crisp.

### 4.10 Several shapes

Shapes are drawn in list order, as today. Consecutive shapes on the inverse path share one pass of up to 8 records.
The enumeration runs once per pixel per pass and each shape is tested per candidate. Their results are blended in
list order inside the shader. A forward shape between two inverse shapes splits the pass, which keeps the order
exact.

### 4.11 Generated GLSL (sketch)

`GLChain.build()` gains `inverse`: per live step an `invPlan(P, b, A)` emitting

```glsl
// member j (0, 1, -1, 2, ...) of step k's preimages of w (chart cw); returns false past the window or the ramp
bool cxs3_pre(vec4 w, int j, vec2 ref, out vec4 u, out vec2 dudw, out float lvl, out vec2 lg, out vec2 lam);
int  cxs3_count(vec4 w, vec2 ref);   // window size after pruning (0: empty pixel)
```

plus `invEnumerate()`, the nested loops in chain order with the leaf cap. Parameters are read from the same
`uChain` cells as the forward `cxs3_f`, so `fill()` is unchanged. `gl.js` adds `INV_FS(forms, sphere)`, made of
four parts:

* the shape records,
* `areaLevel` and `curveNear`, shared with `PRE_FS` by moving them into a common string,
* the compositor of 4.5,
* the pattern template of 4.6.

It also adds the entry `GLR.drawInverse(st)`. Programs are cached per chain key plus formula set, like
`preProgram`, compiled in the background with KHR_parallel_shader_compile. While a compile is pending, the shape is
drawn by the forward path.

## 5. The sheet key D

```
D(z) = ln(1 + dist(z, W_src)/R)                          // 0 inside the source window, log-polar growth outside
     + sum over p in P_W of max(0, ln(r_s / |z - p|))     // deeper the closer to an undefined/branch point in view
     + 1e-3 |z - c| / R                                   // tie-break: nearer the window centre on top
```

* W_src is the source window and c its centre. R is half the window diagonal and r_s = R/8.
* P_W holds the pulled-back undefined and branch points within 2R of the window (at most 4).
* For |z| beyond float range, every term uses Lambda: dist is about e^{Re Lambda} and ln|z - p| is Re Lambda for
  p = 0.

The rationale is "the sheet the left plane shows at its own scale is on top". Sheets translated by a period rank by
distance from the window (exp(H): z_0 inside the window beats z_1 = z_0 + 2 pi i above it). Sheets that shrink into
an essential singularity inside the window rank by how deep they are (e^{1/z}: the sheet with |z| about 0.5 beats
those at 1/(2 pi m)). For z^i, the sheets at view scale, |z| between about 0.5 and 4, are on top.

* **Both paths use the same D.** The inverse path orders per candidate. The forward fallback orders per triangle
  (key D of the centroid) and draws far-to-near.
* **Remaining difference.** Where two non-coincident sheets swap order (D(z1) = D(z2)) the inverse seam is a smooth
  curve and the forward seam is triangle-jagged at sub-pixel to 1 px. It only shows with sheet-dependent patterns.
  With coincident patterns (solid; polar on z^i) the order is invisible.
* **Determinism.** D is a pure function of z, the chain and the window. Panning the left view changes the ordering,
  which is intended, and is stable while panning the right view.

## 6. Precision

### 6.1 What float32 does to the inverse path (measured by emulation: every operation rounded with Math.fround)

All 10 chains at default, 4x and 16x zoom-out give identical metrics in f64 and f32. This includes the Cayley map
at 64x zoom on w = 1 (the image of infinity) and 1/z at 128x on w = 0 (`out/inv_results.txt`). The only f32 effect
is 85 rim pixels of z^i at 16x where the residual transmittance stays slightly above 1/255. GPU transcendentals are
2-4 ulp rather than correctly rounded, which is a risk to verify with the GLSL parity tests (phase 2).

### 6.2 The anchored first step

The pixel position is w = centre + offset. Formed in float32 it carries an error of 6e-8 |centre|.
`deepzoom.js` measures Cayley(H) at w = 1 in f32:

| zoom | pixel | plain centre+offset: IoU | anchored: IoU |
|---|---|---|---|
| x64 | 8.2e-5 | 1.0000 | 1.0000 |
| x16384 | 3.2e-7 | 1.0000 | 1.0000 |
| x262144 | 2.0e-8 | 0.9903 | 1.0000 |
| x4194304 | 1.3e-9 | 0.8835 | 1.0000 |

Anchoring works like this. The CPU evaluates the first backward step's affine parts at the view centre in float64
and passes them as uniforms, so the GPU computes only offset terms. Examples:

* Mobius: num = num0 + d delta, den = den0 - c delta.
* add, mul and affine: trivially.
* log^{-1} = exp: e^{w0} e^{delta}.

Later steps are float32. This matches the precision of today's origin-relative forward path and of the colour plot.

### 6.3 Extreme sheets

Candidates from exp-type and log steps carry Lambda = log z, so their polar and spherical patterns and half-plane
or sector tests are exact for any |z|, even when z itself overflows float32 (|z| > e^88). Saturation means at most
the 3-4 nearest sheets are composited, and with the window M = 8 the scanned |z| for z^i stays within e^{+-57}.

### 6.4 Forward fallback

Vertices are unit vectors on the source sphere, in float64. Near the poles (z = 0 and z = infinity) the
stereographic coordinates keep full relative precision. P.x and P.y are about 2|z| (or 2/|z|), so refinement toward
0 or infinity reaches 1e-300. The precision floor is relative: chordal size below 1e-15 and an xy spread below
1e-13 of the xy magnitude.

Near other singular points p (|p| about 1), the absolute resolution is 1e-16 (1 + |p|^2). Example: log(z - 1)
resolves |z - 1| down to about 2e-16, which is Re w about -36. The extension is chart promotion: vertices created
within r_p of a pulled-back singular point p store delta = z - p, and the chain is evaluated through a linearised
prefix G_{k-1}(p + delta) - G_{k-1}(p), approximately G'(p) delta. This is listed as risk 8; the inverse path does
not need it.

## 7. The spherical checkerboard (pattern id 8, "Sphere checker")

* **Sphere.** The app's own Riemann sphere: centre at the pattern origin o (the polar pattern's origin, default 0)
  and equator |z - o| = rho0 = 1, the same stereographic projection as `lift()` and the Sphere view, so the pattern
  is literally a lon/lat tiling of what the Sphere view shows.
* **Coordinates.** Longitude theta = arg(z - o) and latitude lambda = 2 atan(|z - o| / rho0), with lambda in
  [0, pi] (0 at o, pi at infinity).
* **Cells.** n_lon = 16 x k sectors and n_lat = 8 x k bands, with k = 1/`patternScale` rounded to keep n_lon even and
  clamped to [4, 64]. Cells are square at the equator (Delta theta = Delta lambda = pi/8): 128 cells by default
  cover C plus infinity. Cell index (floor(16 theta/2pi), floor(8 lambda/pi)), parity selects c0 or c1 (the shape's
  checker colours).
* **Lines** (`S.lines`): the net at cell edges, as `net()`.
* **Moire.** Footprints |grad theta| = 1/r and |grad lambda| = 2 rho0/(rho0^2 + r^2) = 1/(rho0 cosh(ln(r/rho0))).
  With Lambda these are e^{-Re Lambda} and 1/cosh(Re Lambda). The colour fades to (c0 + c1)/2 by
  `moire(max(fw))`, the same smoothstep(0.18, 0.45) as every other pattern.
* **Poles.** The 16 polar-cap triangles meet at o and at infinity. Within a few pixels of each pole's image the
  longitude footprint exceeds a cell, so the colour is uniformly the average. At an essential singularity the
  sheets that accumulate there have huge |dw/dz| footprints, so every such sheet is averaged too: uniform colour,
  never noise.
* **Forward path.** Per-vertex (theta, lambda) unwrapped per triangle relative to its centroid's theta. Triangles
  touching the pole vertices: theta from the other two vertices plus the fwidth averaging.

How it looks (`out/sph_*.png`, `out/sphere_checker_sheet.png`):

* **log(H).** The strip 0 < Im w < pi gets 8 rows (theta bands) and latitude columns at
  Re w = ln tan(j pi/16), j = 1..7, that is at -1.61, -0.88, -0.40, 0, 0.40, 0.88 and 1.61. The two end columns
  (polar caps) are single cells running to -infinity and +infinity: the strip visibly reaches infinity with finitely
  many cells. At 16x zoom-out the 18 px strip is moire-averaged to a uniform tone.
* **z^i(H).** Each theta sector becomes a ring |w| between e^{-(j+1)pi/8} and e^{-j pi/8} (8 rings). Each latitude
  band becomes a set of rays arg w = ln tan(j pi/16) + 2 pi m on the sheet at view scale. Sheets toward 0 and
  infinity lie entirely in the caps and show plain alternating rings. The result is a finite, clean ring and ray
  checker.
* **Cayley(H).** A graticule on the disc whose cells converge at w = 1 (infinity) and w = -1 (0), averaged at both
  convergence points.

## 8. Forward fallback on the sphere (non-invertible chains, morph, compile gaps)

### 8.1 Use

The fallback draws hard shapes when the chain is not eligible, during a paused morph at 0 < t < 1, and while the
inverse program compiles. During motion (playing morph, drags) the GPU-mapped base mesh draws as today: defects
are tolerated in motion and cleaned up on settle.

### 8.2 Source sphere and charts

The region lives on the unit sphere through stereographic projection. The south pole is z = 0, the north pole is
z = infinity, and the equator is |z| = 1, matching `lift()`. Vertices store P (float64 xyz). z is recovered per
hemisphere: zeta = (x + iy)/(1 - P_z) for P_z <= 0, and u = (x - iy)/(1 + P_z) with z = 1/u otherwise. The
singular points of the catalog's first steps sit at 0 and infinity, the exact poles of this chart, and refinement
toward them is unlimited (6.4). The edge midpoint is normalize(Pa + Pb), the spherical midpoint. That is halving in
z near 0 and halving in u = 1/z near infinity, the geometric approach the problem needs.

### 8.3 Vertex classification

Each vertex is OK (finite w), INF (a pole, an infinite limit, or overflow beyond 1e300) or UNDEF (no limit). A
vertex lying exactly on a pulled-back singular point takes its kind from the singularity table (section 3, composed
step by step). Otherwise the chain is evaluated in float64: NaN gives UNDEF and overflow gives INF. Custom formulas
are classified by probing small circles (radii 1e-6 and 1e-9): converging values give a limit, uniformly growing
values give INF, anything else gives UNDEF.

### 8.4 Base triangulation

An octahedron with vertices 0, infinity and +-1, +-i, subdivided 3 times (512 spherical triangles), then clipped to
the region by marching triangles:

* inside means level > 0; a vertex at level 0 lies on the boundary and is kept;
* crossings are found by 40-step bisection along the great-circle edge;
* `Region.levelInf(s)` gives the level at infinity: 0 for half-planes, strips and unbounded sectors (infinity is on
  their boundary), -1 for bounded kinds, +1 for complements, the limit along directions for formulas.

Boundary-edge midpoints are projected onto the zero level by 4 Newton steps. Edges on great circles (lines through
0, circles |z| = 1) need none.

### 8.5 The refinement loop (pseudo-code; `fwd.js` is a working version)

```
heap = base triangles keyed by D(centroid)                   // near-to-far
TB = transmittance buffer, 2x2 subsamples per pixel, = 1
while heap not empty:
  if processed >= BUDGET (400k) or vertices >= 600k or accepted >= 150k: stop (budget)
  if processed - lastVisible > STALL (30k): stop (stall: nothing in near-to-far order changes a pixel any more)
  T = pop()
  if chordal size < 1e-15 and xy spread < 1e-13 xy magnitude, or depth > 1100: drop (precision floor)
  if T touches an UNDEF vertex v:
     if depth > deepestVisible[v] + NQ (14): drop (quiet: 14 halvings, about one z^i period, added nothing)
     split the edges at v (geometric approach to v); continue
  q = screen positions of the 3 vertices                      // INF vertices are 'far'
  early tests (the parent's deviation dp, a child's is about dp/2 + 0.25):
     all 3 beyond one side of the view by 2 + est px: cull
     est <= 2 and every subsample under the triangle (margin 1 + est) has TB < 1/255: drop (saturated)
  evaluate the 3 edge midpoints (shared through the edge map) and the centroid
  far samples (overflow or beyond 1e15 px) never block a cull:
     all far (depth >= 2), or all finite samples beyond one side by 2 + deviation px: cull
     some far: split the edges with far ends or far midpoints (all three if the centroid is far)
  dev_e = |q(mid_e) - mean(q_a, q_b)|, len_e, devC = |q(centroid) - mean|, maxDev
  maxDev <= 2 and saturated under the triangle: drop
  edge e is OK if dev_e <= 0.25 px and len_e <= 64 px and e is not already split by a neighbour
  accept if (all edges OK and devC <= 0.25) or (image under 0.5 px and no neighbour split):
     emit; TB *= (1 - alpha) under it; freeze its edges; if it changed a subsample >= 1/255: lastVisible, deepestVisible
  else:
     want = edges not OK; force edges already split by a neighbour; frozen edges can never be split
     interior bad but no splittable edge: split all non-frozen edges; all three frozen: centroid split (1 -> 3)
     templates: 1 split -> 2 triangles, 2 -> 3 (shorter diagonal), 3 -> 4; children inherit (ancestor singular v, ring depth)
```

All stopping criteria:

| criterion | rule |
|---|---|
| window cull | samples beyond one side by the curvature allowance; far samples count as beyond every side |
| image-metric accuracy | chord deviation 0.25 px per edge and at the centroid; edge length 64 px; sub-pixel acceptance |
| saturation (infinite sheets) | near-to-far by D; 2x2 subsample transmittance below 1/255 under the triangle |
| singular-vertex quiet rule | NQ = 14 halvings with no visible contribution from the rings |
| global stall | 30k consecutive triangles without a visible contribution |
| precision floor | relative, above |
| budgets | 400k processed, 600k vertices, 150k accepted |

Time slicing works like `computeFix`: 5 ms slices, a cancellation token, and a pause while `fixBusy()`. Accepted
triangles are uploaded per slice batch.

### 8.6 Watertightness argument

1. A split decision is recorded per edge in the shared map, and a triangle with a split edge can never be accepted
   whole.
2. An accepted triangle freezes its edges, so no later split can create a T-junction against it.
3. A triangle that must refine but has only frozen edges uses a centroid split, which keeps its edges.
4. Culled and saturated triangles are not drawn. They are off-screen, or under 3 or more opaque sheets, so their
   neighbours' edges show nothing.
5. Boundary projection moves only edges with no neighbour outside the region.
6. Vertex positions are uploaded relative to a common w-origin, so shared vertices are bit-identical in float32.

Measured: 0 T-junctions in all 12 runs (before rule 1 was added, 1 to 2 appeared at exp(H) and e^{1/z}; the rule
removed them).

### 8.7 GPU/CPU split for the fallback

The fallback uses CPU pre-mapped geometry. Per accepted triangle the GPU receives:

* the three w values relative to the view centre at refinement time (float32 pairs);
* per-vertex pattern coordinates computed on the CPU and unwrapped per triangle: (z - Q_t)/cell with Q_t snapped
  near the centroid, (ln r, theta - theta_t), (theta, lambda) for the spherical checker;
* the triangle's area-scale value.

A new program `regionP` draws these without a chain, so nothing compiles per chain. Triangles are drawn in reverse
acceptance order (far-to-near by D), aliased like today. A pan keeps drawing the old set. A view change of more
than 2x zoom or more than 50% pan starts a new job, double-buffered: the old set draws until the new one reaches
first full coverage, about 0.1 s of CPU (section 11).

### 8.8 Sphere view criteria for the fallback

The chordal deviation is measured in pixels at the globe's largest on-screen radius, so it is view independent and
orbiting never re-refines. INF vertices are drawable (north pole); only UNDEF vertices force refinement. There is
no window cull. Saturation uses a 6 x 256^2 cube-map transmittance buffer over the image sphere.

### 8.9 Lines in the fallback

`Region.sampleCurve` is extended on the sphere charts. Long lines and rays continue geometrically in u = 1/z beyond
the far box, and curves through an undefined point approach it geometrically (ratio 1.035, as the existing outer
spacing). Sampling stops in four cases:

* the image converges: 64 samples within 0.1 px;
* it is culled;
* it is saturated: 64 samples land only on pixels this curve already stroked (the infinitely-wound circles of z^i);
* it reaches the precision floor.

## 9. Making both paths look the same where both apply

| aspect | inverse | forward fallback | difference |
|---|---|---|---|
| pattern formulas | shared template, analytic footprints | shared template, fwidth | footprints equal up to linearisation; none visible |
| coverage at fill edges | analytic AA, coverage-union | aliased raster (as today) | rim AA under 1 px, hidden under the 1.5 px boundary stroke with its 3.5 px casing |
| sheet order | per pixel by D | per triangle by D, far-to-near | swap seams: smooth versus triangle-jagged; invisible for coincident patterns |
| opacity at infinite multiplicity | saturation in shader | saturation buffer, then 3+ sheets drawn | same 1/255 criterion |
| area-scale pattern | exact per pixel | per triangle | smoother on the inverse side |
| boundaries | per-pixel stroke | GPU lines | sub-pixel offset at most (forward chord 0.25 px) |

The switch between paths happens only on chain or shape edits, or with hysteresis on zoom-out, never mid-pan.

## 10. Files and functions that change

* **`src/inverse.js` (new; loaded after `funcs.js`).** CPU float64 twin of the enumerators (section 3), including
  the custom-formula AST walk:
  * `Inverse.eligible(steps, built, a, b)`;
  * `Inverse.enumerator(...)`, the reference used by tests and by hard() and hover;
  * `Inverse.singular(steps, built, b, box)`, pulled-back singular points with kinds;
  * `Inverse.hard(shape, ...)`;
  * `Inverse.key(...)` (D);
  * `Inverse.render(...)`, a CPU reference renderer for tests (this prototype's `inv.js`).
* **`src/funcs.js`.** Each `build()` returns `sing: [{at, kind}]` (the singularity table) and `inv: {kind, ...}`
  (enumerator class and parameters). No behaviour change.
* **`src/glsl.js`.** `invPlan(P, b, A)` per step type, generating `pre`/`count` GLSL from the same uniform cells;
  `GLChain.build()` returns `inverse: {source, eligible: [k...], radix}`; custom formulas via `genCustomInv`.
* **`src/gl.js`.**
  * Move `areaLevel`, `curveNear` and `angIn` out of `PRE_FS` into a shared `SHAPES` string.
  * `PATTERN(mode)` template, where mode 'fwidth' generates today's `REGION_FS` text exactly.
  * `INV_FS(forms, sphere)` and programs `inv` / `invS`, and `GLR.drawInverse(st)` for fills and the stroke pass.
  * `regionP` (pre-mapped instances) for the fallback; `PATTERNS.sphere = 8` in both region shaders.
* **`src/region.js`.**
  * `levelInf(s)`;
  * `sphereBase(s)` (octahedron, marching triangles, boundary projection);
  * `refineJob(s, F, view, opts)`, a resumable generator of the loop in 8.5;
  * `sampleCurve` sphere-chart extension.
* **`src/app.js`.**
  * `pathOf(s, role, map)` with hysteresis.
  * `drawScene`: per-shape path, batching inverse runs, stroke pass.
  * `renderSphere` (image mode) and `renderLeft` at stage > 0 route inverse shapes to `drawInverse` with sphere or
    role-L parameters.
  * `fixTargets` / `runFixInner` skip inverse shapes and run `refineJob` for forward-hard shapes.
  * `renderOff`: inverse needs nothing; forward-hard shapes finish their job synchronously with a 3 s budget.
  * Pattern menu entry "Sphere checker" and a debug hook `__cmw.paths()`.
* **`test/`.** `t_inverse.js` (unit round trips), GLSL parity of enumerators (with the existing GLSL test helpers),
  quality scenes and metrics (phase plan).

## 11. Prototype results (node; `notes/proto/inverse-first/`)

### 11.1 Inverse path (`inv.js`)

The pane is 410 x 516 at dpr 1 with alpha 0.85, B = 8, M = 8. Truth is exact (closed forms, 4x4 supersampled
fractions). "need" is the members an outward early-stop scan visits. Rows show f32; f64 is identical except where
noted.

| case | view | IoU | holes | spill | cov. error max/mean | z^i hole leak | polar parity | scanned / need per px | composited per px (max) |
|---|---|---|---|---|---|---|---|---|---|
| z^i, H | default | 1.00000 | 0 | 0 | 0.116/0.030 | 0 | 1.00000 | 17 / 10.8 | 3.00 (3) |
| z^i, H | out16 | 1.00000 | 0 | 0 | 0.114/0.037 | 0 | (rings sub-pixel) | 17 / 17 | 4.27 (8; f64: 3) |
| log, H | default / out16 | 1.00000 | 0 | 0 | 0.117 / 0.023 | - | - | 1 | 1 |
| exp, H | default / out16 | 1.00000 | 0 | 0 | 0 | - | - | 17 / 5.0 | 3.00 (3) |
| e^{1/z}, abs(z) < 1 | default / out16 | 1.00000 | 0 | 0 | 0 | - | - | 17 / 5.1 | 3.00 (4) |
| exp, strip | default / out16 | 1.00000 | 0 | 0 | 0 | - | - | 0.8 / 0.6 (pruned) | 1 |
| Cayley, H | default / out16 / 64x at w = 1 | 1.00000 | 0 | 0 | 0.11-0.12 | - | - | 1 | 1 |
| z^2, quadrant | default / out16 | 1.00000 / 0.998 | 0 | 0 / 205 (tie row) | 0 | - | - | 2 | 1 |
| sin, half-strip | default / out16 | 1.00000 | 0 | 0 | 0.011 | - | - | 1.1-1.2 (pruned; 34 unpruned) | 1 |
| 1/z, abs(z) > 1 | default / out16 / 128x at 0 | 1.00000 | 0 | 0 | 0.06-0.09 | - | - | 1 | 1 |
| sqrt, slit plane | default / out16 | 1.00000 / 0.995 | 0 | 0 / 516 (tie column) | 0.146 | - | - | 1 | 1 |

Notes on these numbers:

* Coverage errors of up to 0.146 are the quantisation of the 4x4 truth. The analytic coverage is the exact box
  filter of the straight-edge approximation.
* The "tie" rows at out16 (sq_Q1, sqrt_slit) are a single row or column of pixel centres lying exactly on the
  boundary (Im w = 0, Re w = 0). Strict truth says outside, coverage 0.5 says inside. These are not errors.
* JS time per frame (CPU, 211k px) is 60 to 1600 ms. The GPU estimate follows.

**GPU estimate.** Per candidate: one or two transcendental steps plus the region level, D (3 logs) and the coverage
rule, about 150-250 ALU-equivalents. The pattern runs only for the 1-4 composited leaves. At about 5 candidates per
pixel after pruning and early stop, and 0.85 MP per pane at dpr 2, that is about 1 GFLOP per frame: under 1 ms on
an integrated GPU (M1 class 2.6 TFLOP/s, with transcendentals at quarter rate). The worst case, 17 members plus
formula shapes, is about 3.6 GFLOP, or 1.5-4 ms.

Safeguards:

* An adaptive half-resolution render (bilinear upscale) during motion when the previous frame's pass took over
  8 ms, with full resolution on settle.
* A cached result texture (RGBA8, 3.4 MB per pane) while nothing changes.

Pans cost no CPU at all, and there is no settle work.

### 11.2 Forward fallback (`fwd.js`)

CPU float64, single thread (node V8 = Chrome's V8). "maxDev" is the chord deviation at points never sampled (edge
quarter points and an off-centre interior point) of every accepted triangle at least 1 px in size and in view. IoU
is pixel centres against truth.

| case | view | base | processed | accepted | culled | saturated | vertices | CPU ms | maxDev px | IoU | holes | spill | z^i hole | parity | T-junctions |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| z^i, H | default | 256 | 129,906 | 30,780 | 0 | 61,817 | 143,667 | 1866 | 0.192 | 0.99985 | 0 | 16 (inner-rim sagitta) | empty | 1.0000 | 0 |
| z^i, H | out16 | 256 | 4,629 | 2,042 | 0 | 1,156 | 6,569 | 27 | 0.208 | 1.00000 | 0 | 0 | empty | 1.0000 | 0 |
| log, H | default | 256 | 4,028 | 2,608 | 244 | 44 | 5,941 | 33 | 0.205 | 1.00000 | 0 | 0 | - | - | 0 |
| log, H | out16 | 256 | 7,698 | 3,268 | 1,924 | 32 | 11,887 | 25 | 0.195 | 1.00000 | 0 | 0 | - | - | 0 |
| exp, H | default | 256 | 55,170 | 15,424 | 11,077 | 13,362 | 69,388 | 589 | 0.214 | 1.00000 | 0 | 0 | - | - | 0 |
| exp, H | out16 | 256 | 56,551 | 16,161 | 12,128 | 12,410 | 71,499 | 706 | 0.205 | 1.00000 | 0 | 0 | - | - | 0 |
| e^{1/z}, abs(z) < 1 | default | 256 | 62,178 | 16,224 | 13,987 | 15,040 | 78,355 | 682 | 0.193 | 1.00000 | 0 | 0 | - | - | 0 |
| e^{1/z}, abs(z) < 1 | out16 | 256 | 61,378 | 17,245 | 13,050 | 13,995 | 77,964 | 691 | 0.205 | 1.00000 | 0 | 0 | - | - | 0 |
| exp, strip | default | 496 | 7,733 | 4,470 | 1,064 | 44 | 11,387 | 36 | 0.208 | 1.00000 | 0 | 0 | - | - | 0 |
| exp, strip | out16 | 496 | 7,460 | 4,290 | 1,014 | 44 | 10,926 | 35 | 0.225 | 1.00000 | 0 | 0 | - | - | 0 |
| Cayley, H | default | 256 | 1,824 | 1,280 | 0 | 0 | 2,738 | 18 | 0.188 | 0.99817 | 208 (rim sagitta at most 0.21 px) | 0 | - | - | 0 |
| Cayley, H | out16 | 256 | 256 | 256 | 0 | 0 | 658 | 1 | 0.071 | 0.98214 | 8 (same) | 0 | - | - | 0 |

**Progressive.** Because the work is near-to-far, the visible picture comes first:

| case | processed | CPU ms | IoU | pixels saturated |
|---|---|---|---|---|
| z^i | 10k | 66 | 0.999 | - |
| z^i | 20k | 121 | - | 99.5% |
| exp(H) | 10k | 62 | 1.0000 | - |
| exp(H) | 40k | 364 | - | 100% |
| e^{1/z} | 20k | 116 | 1.0000 | - |

The rest only confirms saturation. The forward z^i hole is empty; its 16 spill pixels lie within 0.25 px of the
inner rim (chords of a concave boundary). `out/fwd_zi_H_default.png` shows the clean polar checker.

### 11.3 Memory

| path | memory |
|---|---|
| inverse | no geometry; the optional RGBA8 cache, at most 3.4 MB per pane; one more program per chain |
| fallback, CPU | about 72 B per vertex (z^i default: 10 MB, freed when the job ends unless a pan needs it) |
| fallback, GPU | about 64 B per accepted triangle (z^i default: 2 MB), counted in `cacheBytes` under the 256 MB cap |

## 12. Interactions

* **Morph.**
  * Playing: today's GPU-mapped forward path, every frame.
  * Paused at t: forward fallback job for H_t on hard shapes.
  * At the end, or with the transport closed: normal engagement. The handover at t = 1 matches by section 9.
  * Phase 6: the natural homotopies of Mobius steps (`mobHom`, Mobius at every t), of powa/root/pown (`powHom`,
    z^{s(t)}) and of exp/log are invertible in closed form. The inverse path can then draw those morph frames per
    pixel, exact and with no CPU work. `linHom` steps stay forward.
* **Fix-ups.** `computeFix` skips inverse shapes, which saves today's CPU fix-up time on hard scenes. Forward-hard
  shapes use `refineJob` in the same scheduler.
* **Figure export (`renderOff`, 300 dpi).** The inverse path is per pixel at any resolution, synchronous and exact,
  with no waiting. Forward-hard shapes run their job synchronously for the figure's own view (budget 3 s) before
  drawing.
* **Sphere view.** Inverse over the globe (4.8). Fallback with chordal criteria (8.8).
* **Left plane.** Stage > 0 uses role L (4.9). Stage 0 is unchanged.
* **Landscape, Phase, phase sphere.** Unchanged: they are already per pixel and forward.
* **Preimage mode (targets).** Unchanged. It is the dual: forward per pixel for w-plane targets. The hover readout
  can list preimages with `Inverse.enumerator`, which is exact and needs no Newton search, for eligible chains.
* **Thumbnails** (`renderThumb`, no cache). The inverse pass at thumbnail size is cheap and makes hard examples
  correct in the gallery.
* **Map cache.** Untouched. The inverse path has no map cache.
* **Context loss.** Inverse is stateless and recompiles. Fallback buffers are rebuilt from CPU arrays.

## 13. Risks

1. **Shader size and compile time.** A second generated program per chain, with nested family loops. Mitigation:
   compile in the background, draw forward meanwhile, keep shape kinds as data (records) so shape edits never
   recompile, and allow at most 4 compiled formula shapes, as `preProgram` does.
2. **GPU cost at 4K or many shapes.** Adaptive half-resolution during motion, window and leaf caps, region pruning,
   early stop, cached result. Measure in the perf suite.
3. **Sheet-swap seams.** Patterned multi-sheet images show curves where the top sheet changes (D order). This is
   inherent to any per-point order. D puts the view-scale sheet on top; it is documented and identical in both
   paths up to triangle jaggedness.
4. **Branch semantics drift.** An enumerator could disagree with `CX`/`Expr.compile` (cut conventions, custom
   formula theta, principal constants, the inverse trig odd-symmetry evaluation). Round-trip tests per step, cut,
   sheet and alpha, plus GLSL parity tests, are the guard.
5. **Float32 transcendentals on real GPUs** may be worse than the emulation's correctly rounded ones. Check with
   the GLSL parity harness on real hardware (headless Chrome), especially at the rims of exp/log families.
6. **Low alpha** (for example 0.3) needs about 16 sheets to reach 1/255. Raise B to 16 when alpha < 0.5; tail
   closure covers the rest.
7. **Engagement misclassification.** A hard shape classified as easy is still drawn by today's path (no worse than
   now). An easy shape classified as hard is drawn exactly. The truncation-visibility test is view-dependent, and
   hysteresis prevents flicker.
8. **Fallback precision near non-pole singular points.** Needs chart promotion (6.4) for deep zoom-outs of chains
   that are not invertible.
9. **Fallback CPU cost for spirals** (z^i-like in a non-invertible chain): up to about 2 s of time-sliced CPU to
   finish saturation, though the picture is complete after about 0.1 s. Tunables: STALL, the 0.25 px interior
   tolerance (0.5 px for interiors and 0.25 px for boundary edges would halve the work).

## 14. Phased implementation plan with tests

Test first, as the user asked. The regression suites in `test/regress/` are the gate for every phase: quality IoU,
holes, spill, boundary error, parity and goldens; performance pan/zoom medians, settle, example loads, scrubs and
GPU memory.

| phase | content | tests (written before the code) |
|---|---|---|
| 0 | Add scenes to `test/regress/quality/scenes.js`: zi_H (default, out4, out16, sphere, polar pattern), expH, e1z_disc, exp_strip out16, plus metrics for the hole (pixels inside abs(w) < e^{-pi} minus 1 px with alpha above 1/255), sheet parity and residual transmittance. | Baseline today (expected failures documented). |
| 1 | `src/inverse.js`: enumerators for the catalog and custom formulas, eligibility, singular table and pullbacks, D, CPU reference renderer (port of `inv.js`). | `test/t_inverse.js`: soundness and completeness round trips for every step type over a grid of cuts, sheets, n, alpha (real, complex, imaginary) and random w; range-level sign versus `argCut`; eligibility per catalog entry; singular pullbacks for log(z-1), e^{1/z}, Cayley; the reference renderer reproduces section 11.1. |
| 2 | GLSL `invPlan` and `INV_FS` (flat), `drawInverse`, shared `SHAPES` / `PATTERN` templates, engagement and hysteresis in `drawScene`, `computeFix` skip. | GLSL parity: enumerator outputs on the GPU versus `Inverse.enumerator` at sample pixels (headless Chrome, like `glsl_test.js`). `REGION_FS` text byte-identical (string test). Quality: unbounded scenes IoU at least 0.999, holes and spill at most one tie line, hole leak 0, parity at least 0.999, boundary error at most 0.3 px; goldens unchanged; `__cmw.paths()` asserts the engagement of every scene. Perf: pan/zoom medians within baseline + 2 ms; settle at or below baseline (no fix-ups for inverse shapes); GPU memory at most baseline + 4 MB. |
| 3 | Sphere view (`invS`) and role L; per-pixel strokes. | Quality on sphere scenes (z^i, Cayley at the north pole); left-plane stage-1 scene; stroke width uniformity on the images of the real axis under z^i (width deviation under 0.3 px). Figure export at 300 dpi equals the screen render scaled (IoU at least 0.999). |
| 4 | Spherical checker (id 8) in both paths, menu entry. | Pattern scenes: log(H) cell columns at the predicted Re w (within 0.5 px); z^i rings at e^{-j pi/8}; moire averaging at Cayley's w = 1 (no pixel deviates from the average by more than 4/255 within 3 px). |
| 5 | Forward fallback: `sphereBase`, `refineJob`, `regionP`, job scheduling, double-buffering on view changes, curve sampler extension. | Unit (node): the section 11.2 table as assertions: maxDev at most 0.25 px, 0 T-junctions, hole empty, IoU at least 0.998 on the six cases, plus a forced-forward run of each acceptance scene. Perf: hard non-invertible scene (custom e^{z+1/z}): first coverage under 0.3 s, slices at most 6 ms, pans unaffected. |
| 6 | Per-pixel dashes (arc-length LUT), invertible homotopies for morph, polynomial degree 3-4 enumerators, chart promotion in the fallback. | Dash phase continuity along an open strip's boundary under exp; morph frames of Mobius / powa / exp steps against the CPU homotopy (IoU at least 0.999 per frame); cubic round trips. |

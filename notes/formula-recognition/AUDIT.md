# Formula recognition: audit (v15, 2026-10-24)

What the app does today when a catalog map is typed as a formula (LaTeX or plain), compared with the same map
picked from the catalog. Work copy: `work/xvr` (= the published v15). Nothing in `src/` was changed.

Tools (all under `notes/formula-recognition/tools/`):
- `corpus_src.js`: the 163 hand-written formulas (id, formula, catalog chain, kind, branch note).
- `analyze.js`: node; builds every formula as a custom step and every chain from the catalog, and records the
  inverse-renderer ops (`Inverse.stepOps` / `planChain`), the natural path (`b.nat`), the lamps, the cuts drawn, and
  compares the values at 328 points (300 random points in [-3, 3]², and pairs 1e-7 either side of the real and
  imaginary axes). It adds 5 more formulas (z^{1+i}, z^{0.5+2i}, z^{a+i}, z^{0.5}, (az+b)/(cz+d)) and 43 plain
  spellings.
- `bench_body.js`: the headless-Chrome scene runner (ANGLE Metal, 1440 x 900, one rect and one Cartesian grid
  across the origin and the cut). It records shape paths, render ms (`__cmwTime`), rAF frames while panning the
  w-plane, SphereMesh settle, frames while a shared number is dragged, and the deformation at t = 0.5.
- `../corpus.json`: the result, one entry per formula.

## 1. The user's case: z^{complex}

Typed z^{i}, z^{1+i}, z^{0.5+2i}, z^{a}, z^{a+i} (LaTeX) and z^i, z^(1+i), z^(0.5+2i), z^a, z^(a+i) (plain), against
the catalog step "Complex power" with α = i, 1+i, 0.5+2i, a, a+i.

**LaTeX and plain text give the same function.** Both spellings parse to the same tree (`Expr.parse`), so the
values, the inverse ops, the natural path and the lamps are identical. The only thing that depends on the text is
the GPU program key of a custom step (`glsl.js` `case 'custom'`: `sig: [type, String(v.expr), ...]`): z^{i} and z^i
compile two shader programs. That costs one compile when switching spellings and nothing else.

**The custom formula and the catalog step have the same values and the same still picture.**
- Values: identical (0 mismatches at 328 points, including 1e-7 above and below the cut on the negative real axis).
  Both use the formula's cut θ = 180°, sheet 0: z^α = e^{α Log z} with arg in (−180°, 180°].
- Rendering path: identical. Both go to the exact inverse renderer as one ROOTPOW op with the same α, θ and k.
  Frame time is the same within noise (right pane 2.6 to 8.6 ms for both; 60 fps panning; see section 3).

**What differs, and why** (all in `src/funcs.js`, the custom step's build):

1. **The deformation (natural path).** `customNat` (funcs.js 491-503) only knows a catalog function applied to z
   itself (sin z, ..., arcsin z), e^z, log z and rational formulas. A power z^α with a non-integer α falls through
   to `genericZoomNat`: the "gzoom" path, a zoom about p = 1,
   H_t(z) = (1−t)p + t f(p) + f′(p)^{t−1}(f(p + t(z−p)) − f(p))/t.
   The catalog step uses its own path `powHom`, H_t(z) = z^{1+(α−1)t} on the cut θ. These are different maps for
   0 < t < 1: at t = 0.5, z = −1.2 − 0.3i, the formula gives −14.28 − 8.97i and the catalog step gives
   1.07 − 4.61i. In the app at t = 0.5 the catalog picture is a compact spiral piece. The formula's picture spreads
   over the whole w-plane, with straight-edged fragments where forward-drawn triangles cross the moving cut of
   f(p + t(z−p)). That is the "different picture/path" the user sees, and it is not an exact picture.
2. **The cut is not drawn.** The custom build returns no `cuts` (funcs.js 1518-1530), and `drawCuts` (app.js 2334)
   draws only `b.cuts`. So a typed z^{i} has no red cut ray in the z-plane, no draggable seam, and no "image of a
   cut" in the legend. θ is only a number field, and there is no sheet k. The catalog step has all of these.
3. **Lamps.** A custom step's lamps come from `Expr.classify` (analytic, entire, rational, polynomial, and Möbius only
   for an exact degree-1 polynomial). The catalog `powa` also lights injective (homeo and conformal) when
   |Re α| ≥ |α|². With a = 0.5, the catalog z^a shows ●conformal ●homeo; the typed z^{a} does not. For α = i, 1+i
   and 0.5+2i both show analytic only.
4. **Dragging a shared exponent.** `customOps` (inverse.js 760-771) emits IPOW for an exponent that is exactly an
   integer and ROOTPOW otherwise. `customNat` switches gzoom (a = 0.7), mob (a = 1), pow (a = 2). Both the
   inverse key (`inverseKey`) and the forward program key (`JSON.stringify(b.nat)` in the custom sig) contain
   these, so a slider passing 1.00 or 2.00 (step 0.01) builds new programs, and the deformation changes kind at
   that value. The catalog `powa` stays one ROOTPOW op with one path. See section 3 for the measured frames.

So the exact cause is not LaTeX against plain. The custom step builds its own path, cuts and lamps from the tree
(`customNat`, no `cuts`, `classify`) instead of from the catalog step it is equal to. Every other typed catalog map
shows the same gaps (section 2).

## 2. The corpus (168 formulas, 43 plain spellings)

| kind | count | meaning |
|---|---|---|
| exact | 115 | the formula is the catalog chain as written: z once, the same branches on the formula cut |
| identity | 29 | equal to the chain as a function, but written differently (z twice, sinh by its definition, ...) |
| trap | 5 | looks like a simpler map but is not: √(z²), (z²)^{1/2}, log(z²), log(e^z), arcsin(sin z) |
| none | 19 | no catalog chain (sin z + z, z e^z, z^z, \|z\|, z²+1/z, ...) |

Values: all 146 formulas with a chain equal their chain at all 328 points (0 mismatches), traps included,
because each trap's chain is the composition it really is. All 43 plain spellings equal their LaTeX spelling.
41 of them have the same tree. Two have a different tree but the same ops: z^(1/3) against \sqrt[3]{z}, and
(z+1/z)/2 against \frac12(z+\frac1z).

What the app does with them today:

- **Still picture (inverse renderer).** 140 of 168 formulas render exactly through the inverse renderer.
  119 of them use exactly the catalog chain's ops. 16 use equivalent ops (2z+1 as two AFF ops, Joukowski as
  RAT2+AFF instead of JOUK, (z²−1)/(z²+1) as RAT2 instead of IPOW+MOB, 2^z as EXPC, ...). These are exact too, with
  the same values. 27 formulas are not eligible and go to the SphereMesh forward fallback. **10 of those 27 are
  catalog maps written another way**, and their catalog chain renders exactly:
  e^{z}e^{z}, (e^z−e^{−z})/2, (e^z+e^{−z})/2, (e^{iz}+e^{−iz})/2, (e^{iz}−e^{−iz})/(2i), log(z+√(z²+1)),
  sin z/cos z, sin z cos z, sin z + cos z, log(1+z) − log(1−z). The other 17 have no catalog chain, or (z³−z) none
  that renders exactly.
- **Natural path.** 93 formulas get the generic zoom path (gzoom). Among the 79 single-step chains, 22 get a
  different path from their catalog step: every root and complex power (√z, ∛z, z^{1/2}, z^{i}, z^{2.5}, z^{a}, ...),
  z^{−2}, the exp-definitions of sin/cos/sinh/cosh, the log-definitions of artanh/arctan/arsinh, sin/cos, and
  (z−1)³/((z−1)²(z+2)). All 67 multi-step chains get one path for the whole formula. For 57 of them it is gzoom (e^{iz}, sin 2z,
  log(z−1), cos(z)/2, ...). For the 10 rational ones it is the rational path (ratzoom, pow, mob, jouk). The catalog
  chain instead plays each step's own path, one step after another.
- **Cuts.** None of the 50 formulas whose chain has a cut draws one (log, roots, powers, inverse trig).
- **Lamps.** 39 single-step formulas light fewer lamps than their catalog step: injective is never lit for log,
  √, z^{a}, the inverse trig and hyperbolic functions, or conj. Möbius and injective are never lit for 1/z and any
  rational Möbius map ((z−i)/(z+i), (1+z)/(1−z), ...). Proper is never lit for the Joukowski map. Typed exactly,
  2z+1 and iz do light Möbius, because they are polynomials.
- **Parse errors.** Only (az+b)/(cz+d) fails ("One new name at a time: b, c, d"), because it needs four shared numbers.

## 3. Browser measurements

Headless Chrome (ANGLE Metal) on this Mac, 1440 x 900, with one rectangle and one Cartesian grid across the origin
and the cut. Frames are rAF intervals in ms over 1.3 s: panning the w-plane (70 pointer moves), and dragging the
shared number a (set every frame, a sine sweep). "render ms" is `__cmwTime(5)` for the right pane (main thread plus
GPU finish). The deformation is measured at t = 0.5, then playing. Settle time after a pan or drag was 0 to 2 ms
everywhere: no scene built a SphereMesh, because the maps here have no trouble on this shape, so the forward
fallback is the GPU forward mesh. Each scene ran once on a shared machine, so treat single max values as
indicative only.

| scene | right-pane path | render ms | pan p50/p95/max | param drag p50/p95/max | deformation t=0.5 render ms | deformation play p50/p95/max | lamps lit |
|---|---|---|---|---|---|---|---|
| z^{i} | inverse | 7.26 | 16.7/17.4/17.7 |  | 6.07 | 16.7/17.3/17.6 | analytic |
| z^i | inverse | 7.72 | 16.7/17.3/17.5 |  | 8.03 | 16.7/17.5/18.3 | analytic |
| powa α=i | inverse | 7.22 | 16.6/17.4/17.5 |  | 6.47 | 16.7/17.5/20.4 | analytic |
| z^{1+i} | inverse | 5.48 | 16.7/16.9/17.4 |  | 6.1 | 16.7/17.3/19.8 | analytic |
| z^(1+i) | inverse | 4.9 | 16.7/16.9/17.5 |  | 5.4 | 16.7/17/17.2 | analytic |
| powa α=1+i | inverse | 6.12 | 16.7/17/17.7 |  | 6.63 | 16.7/18.3/19.2 | analytic |
| z^{0.5+2i} | inverse | 6.36 | 16.7/16.9/17 |  | 4.4 | 16.7/16.9/17.5 | analytic |
| z^(0.5+2i) | inverse | 4.96 | 16.7/16.9/20.6 |  | 8.33 | 16.7/17.9/19.6 | analytic |
| powa α=0.5+2i | inverse | 7.06 | 16.7/17.4/19 |  | 8.03 | 16.7/17.5/17.6 | analytic |
| z^{a} (a=0.5) | inverse | 3.7 | 16.6/17.7/17.8 | 16.7/17.4/19.9 | 6.4 | 16.7/17.6/19.8 | analytic |
| z^a | inverse | 5.86 | 16.7/17.7/38.4 | 16.6/17.6/32.1 | 8.5 | 16.7/22/24.4 | analytic |
| powa α=a | inverse | 2.72 | 16.7/17.4/17.5 | 16.7/17.6/38.7 | 12.33 | 16.7/17.7/18.3 | conformal homeo analytic |
| z^{a+i} | inverse | 7.72 | 16.7/17.6/20.6 | 16.7/17.4/20.3 | 4.4 | 16.6/17.6/17.7 | analytic |
| powa α=a+i | inverse | 7.1 | 16.6/17.5/18 | 16.7/17.7/20.3 | 7.53 | 16.6/18.3/20.6 | analytic |
| z^{a}, a 0.9..2.1 | inverse | 2.6 | 16.7/17.3/17.7 | 16.7/17.4/17.7 |  |  | analytic |
| powa α=a, a 0.9..2.1 | inverse | 4.46 | 16.7/17.4/19.5 | 16.7/16.9/17.3 |  |  | analytic |
| \sin(az), a −0.3..0.9 | inverse | 4.08 | 16.7/17/17.3 | 16.7/17/51.4 |  |  | entire analytic |
| mul a, sin; same | inverse | 5.7 | 16.7/16.9/20.1 | 16.7/16.9/17.1 |  |  | entire analytic |
| z^{a}, a 0.9..2.1 in 0.01 steps | inverse | 6.38 | 16.7/17.7/18 | 16.7/17.5/17.7 |  |  | analytic |
| powa α=a, same | inverse | 5.08 | 16.7/17.6/20 | 16.7/17.4/18.8 |  |  | analytic |
| `e^{iz}` | inverse | 5.2 | 16.7/16.9/17 |  | 7.8 | 16.7/16.9/17.1 | entire analytic |
| catalog: mul(i) → exp | inverse | 4.32 | 16.7/17.4/17.7 |  | 6.77 | 16.7/17.4/17.6 | entire analytic |
| `\sin(2z)` | inverse | 3.94 | 16.7/17.6/17.8 |  | 7.07 | 16.7/17.5/18.7 | entire analytic |
| catalog: mul(2) → sin | inverse | 3.72 | 16.7/17.5/17.7 |  | 3.87 | 16.7/17.5/18 | entire analytic |
| `\sqrt{z}` | inverse | 3.12 | 16.6/17.6/19 |  | 5.9 | 16.7/17.6/18.3 | analytic |
| catalog: root(2) | inverse | 2.74 | 16.7/17.3/18.5 |  | 5.77 | 16.7/17.4/17.8 | conformal homeo analytic |
| `\log(z-1)` | inverse | 2.76 | 16.7/17.4/17.6 |  | 4.3 | 16.7/17.4/18 | analytic |
| catalog: add(-1) → log() | inverse | 2.78 | 16.7/17.6/18 |  | 5.37 | 16.7/17.6/26.1 | conformal homeo analytic |
| `\sin(e^{z})` | inverse | 4.42 | 16.7/17.5/18.2 |  | 8.1 | 16.7/17.5/17.6 | entire analytic |
| catalog: exp → sin | inverse | 6 | 16.7/17.5/17.7 |  | 9.73 | 16.6/17.4/18 | entire analytic |
| `\frac{z-i}{z+i}` | inverse | 6.12 | 16.6/17.1/25.5 |  | 5.1 | 16.7/17.3/17.8 | rational analytic |
| catalog: mobius(1,-i,1,i) | inverse | 4.86 | 16.7/17/17.4 |  | 4.43 | 16.7/17.3/17.6 | mobius rational analytic homeo conformal |
| `\frac12(z+\frac1z)` | inverse | 3.34 | 16.7/16.9/17.4 |  | 4.83 | 16.7/17.5/17.9 | rational analytic |
| catalog: joukowski | inverse | 2.82 | 16.7/16.9/17.2 |  | 6.87 | 16.6/17.4/17.7 | rational proper analytic |
| `\frac{z^2-1}{z^2+1}` | inverse | 5 | 16.7/17.5/17.8 |  | 7.63 | 16.7/17.5/17.7 | rational analytic |
| catalog: pown(2) → mobius(1,-1,1,1) | inverse | 3.16 | 16.7/17.4/17.5 |  | 4 | 16.7/17.5/18.9 | rational analytic |
| `\frac{e^{z}-e^{-z}}{2}` | forward | 5.02 | 16.7/17.5/17.7 |  | 7.77 | 16.7/17.3/18.1 | entire analytic |
| catalog: sinh | inverse | 4.32 | 16.7/17.7/17.8 |  | 5.7 | 16.7/17.5/17.8 | entire analytic |
| `\frac{e^{iz}+e^{-iz}}{2}` | forward | 3.56 | 16.7/17.4/17.6 |  | 4.87 | 16.7/17.4/17.7 | entire analytic |
| catalog: cos | inverse | 4.3 | 16.6/17.5/21.7 |  | 5.2 | 16.7/17.4/17.6 | entire analytic |
| `\frac{\sin z}{\cos z}` | forward | 3.5 | 16.7/17.5/17.6 |  | 8.43 | 16.7/17.4/17.8 | analytic |
| catalog: tan | inverse | 4.92 | 16.7/17.5/17.7 |  | 7.7 | 16.7/17.2/17.6 | analytic |
| `e^{z}e^{z}` | forward | 4.3 | 16.7/17.3/17.7 |  | 4.87 | 16.7/17.3/17.6 | entire analytic |
| catalog: mul(2) → exp | inverse | 5.58 | 16.7/17/17.2 |  | 4.03 | 16.7/17.1/17.5 | entire analytic |
| `\log\left(z+\sqrt{z^2+1}\right)` | forward | 3.48 | 16.7/16.9/16.9 |  | 3.43 | 16.7/17/17.3 | analytic |
| catalog: arsinh | inverse | 3.16 | 16.7/16.9/16.9 |  | 9.43 | 16.7/17/17.7 | conformal homeo analytic |
| `\log(1+z)-\log(1-z)` | forward | 4.28 | 16.7/17.2/17.7 |  | 3.63 | 16.6/17.5/18 | analytic |
| catalog: artanh → mul(2) | inverse | 2.06 | 16.7/17.5/54.9 |  | 4.47 | 16.7/17.4/17.7 | conformal homeo analytic |
| `\sin z+\cos z` | forward | 3.68 | 16.7/17.5/20.1 |  | 4.23 | 16.7/17.6/17.8 | entire analytic |
| catalog: affine(1,0.7853981633974483) → sin → mul(1.4142135623730951) | inverse | 4.36 | 16.6/17.8/17.8 |  | 6.93 | 16.7/17.5/17.8 | entire analytic |
| `\sin(z)\cos(z)` | forward | 3.22 | 16.6/17.5/17.7 |  | 7.57 | 16.7/17.6/18.7 | entire analytic |
| catalog: mul(2) → sin → mul(0.5) | inverse | 6 | 16.6/17.6/17.7 |  | 7 | 16.7/17.5/17.7 | entire analytic |
| `\sin z+z` | forward | 3.3 | 16.7/17.8/40.5 |  | 4.27 | 16.7/17.6/17.7 | entire analytic |
| `ze^{z}` | forward | 4.44 | 16.6/17.3/17.6 |  | 8.07 | 16.7/17/17.7 | entire analytic |
| `z^3-z` | forward | 2.84 | 16.7/16.9/17.4 |  | 5.97 | 16.7/17.2/17.7 | polynomial rational analytic entire proper |
| catalog: poly(1, 0, -1, 0) | forward | 2.36 | 16.7/16.9/16.9 |  | 3.97 | 16.7/17.1/17.4 | polynomial rational analytic entire proper |
| `\sin(az)` | inverse | 2.14 | 16.7/16.9/17.2 | 16.7/17.1/17.5 | 5.9 | 16.7/17.2/17.4 | entire analytic |
| catalog: mul(a) → sin | inverse | 6.06 | 16.7/17/17.8 | 16.7/16.9/18 | 4.13 | 16.7/17.2/18.1 | entire analytic |
| `\frac{az+1}{z+a}` | inverse | 5.1 | 16.6/17.4/17.7 | 16.7/21.9/44.6 | 8.63 | 16.7/19.3/36.9 | rational analytic |
| catalog: mobius(a,1,1,a) | inverse | 3 | 16.7/17.4/17.5 | 16.7/17.6/19.1 | 7.33 | 16.7/17.6/18.3 | mobius rational analytic homeo conformal |
| `e^{az}` | inverse | 6.16 | 16.7/17.6/17.8 | 16.7/17.7/23.8 | 6.63 | 16.6/17.7/18.3 | entire analytic |
| catalog: mul(a) → exp | inverse | 2.94 | 16.7/17.5/17.7 | 16.7/17.4/17.6 | 4.6 | 16.7/17.9/18.5 | entire analytic |

Reading the table:
- **Speed.** On this machine there is no frame-time gap. All 62 scenes hold 60 fps while panning and while the
  deformation plays. Renders take 2 to 12 ms, inside BUDGET60 (14 ms). The one parameter-drag gap is typed
  \frac{az+1}{z+a}: p95 21.9 ms and max 44.6 ms, against p95 17.6 ms and max 19.1 ms for the catalog Möbius step. A
  custom step re-parses and rebuilds its exact rational form and its natural path for every new value of a.
  \sin(az) over −0.3..0.9 had one 51 ms frame where a crossed 0 (a constant map there). The user's "lags a lot"
  did not show at 1440 px with these shapes. It should be re-measured on the user's machine and with a SphereMesh
  case before speed drives the design.
- **Quality.** The real gap. 10 typed catalog maps (sinh, cosh, sin, cos and tan written by definition,
  e^z e^z, the textbook arsinh, 2 artanh, sin z cos z, sin z + cos z) are drawn forward by the GPU mesh, which is not
  the exact per-pixel picture. Their catalog chains are drawn exactly by the inverse renderer.

## 4. The worst gaps

1. **The deformation is a different map** for every typed composition and every typed root or power: 93 of 168
   formulas get gzoom. All 67 multi-step chains get one path for the whole formula instead of the steps' paths
   (57 of them gzoom). 22 single-step formulas get a different path from their catalog step: √z, z^{1/n}, z^{i},
   z^{a}, z^{−2}, and the exp- and log-definitions. The user's case belongs here. For a formula with a cut, the gzoom
   picture at mid-t is not exact either: forward triangles cross the moving cut (shots/deform_t05_custom_zi.png
   against shots/deform_t05_catalog_powa_i.png).
2. **Typed catalog maps fall off the exact renderer.** 10 identities go to the forward mesh while their catalog
   chain is exact (list above). Recognising them needs a proven rewrite per pattern (sinh by definition,
   tan = sin/cos, ...). Values agree at all 328 points, but each rule still has to be proved on the cuts. For
   example, log(z+√(z²+1)) agrees with the principal arsinh, and log(1+z) − log(1−z) is exactly 2 artanh z. Some
   look-alikes must never be rewritten: √(z²), (z²)^{1/2}, log(z²), log(e^z), arcsin(sin z). Their exact chains
   are already used today, which is correct.
3. **Cuts are never drawn for a typed formula** (0 of 50). No red cut, no draggable seam, no "image of a cut",
   no sheet k. The catalog draws all of them.
4. **Lamps are missing** for 39 typed single-step maps. Typed log, roots, z^{a} and the inverse trig and
   hyperbolic functions never light injective. Typed 1/z and every rational Möbius map never light Möbius or
   injective. Typed Joukowski never lights proper. The lamps are guarantees, so this understates rather than
   misleads, but it differs from the catalog.
5. **A shared exponent changes the program key at integer values.** customOps gives IPOW at a = 1 and 2, and
   ROOTPOW otherwise. customNat gives mob at a = 1, pow at a = 2, and gzoom otherwise. This is checked in node.
   No hitch showed when a stepped through 0.9..2.1 in 0.01 steps (p95 17.5 ms, max 17.7 ms), probably because
   the programs are cached. The deformation still changes kind at those values, and the catalog powa does not.
6. **Spelling-only differences are harmless.** LaTeX and plain spellings give the same tree (41 of 43) or the same
   ops (2 of 43), with equal values. The GPU key holds the raw text, so a respelled formula compiles one more
   program.

What recognition must keep (from the corpus notes): the formula cut θ applies to every log, root and power in the
formula, sheet 0 (catalog k = 0, cut = θ). The inverse-trig cuts are the principal ones whatever θ is. A shared
number stays a name: the recognised step must read a, never its current value. Saved text, links and LaTeX output
stay as typed.


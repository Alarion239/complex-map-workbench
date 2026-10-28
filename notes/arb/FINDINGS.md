# Arb (FLINT) ball arithmetic: a spike (issue #9)

The question of #9: **is precision worth more than speed anywhere in this app, and should Arb ship?** This spike
measured where the CPU maths loses digits, against certified values, and what shipping Arb would take.

**Answer, in short: keep Arb as a development and CI oracle, and do not ship it in the page.** The doubles of `cx.js`
and `funcs.js` are within a few ulp of the truth everywhere except at a short, specific list of points. There the
losses come from formulas that cancel, and each has a known double-precision fix that costs nothing at runtime. A
certified library would not change what the app draws, and it would cost several megabytes and an LGPL obligation in
the single HTML file.

## What was built (dev-only; nothing ships, CI does not run it)

- `tools/arb_reference.py` (python-flint 0.9, FLINT 3.6): every catalog step of `src/funcs.js` at its default
  parameters (30 steps; `deriv` aside), written as an Arb expression with the principal branches (Arb's cuts are the
  standard ones, the app's at `cut 180, k 0`). It evaluates them on 34 hard points at 256 bits and writes
  `notes/arb/reference.json`. The hard points sit near zeros, poles, branch points and both sides of cuts, at tiny and
  huge |z|, just off the unit circle, near the real zeros of sin and the poles of tan, and where exp nearly over- or
  underflows. Each value is a ball (midpoint with 40 digits, radius ~1e-76); a ball that straddles a cut or a pole is
  written null, a value past the double range "overflow". All 1020 values are certified (a component far below the other is retried at 4 and 16 times the precision).
- `tools/arb_compare.js`: builds each step with `Funcs.build` (the app's CPU path, `cx.js` underneath), evaluates it at
  the same doubles, and reports the worst error per step in ulp (units of 2^-52):
  - **normwise**: |f − ref| / |ref|, what matters for drawing a point;
  - **per component**: the real and the imaginary parts each against their own size, what matters when a small part
    carries meaning (Re log w as a Landscape height, the side of a cut).

```sh
pip install python-flint
python3 tools/arb_reference.py          # writes notes/arb/reference.json (committed)
node tools/arb_compare.js [--md]         # the table below
```

## Findings

| step | points | worst normwise (ulp) | at | worst per component (ulp) | at | not finite |
|---|---|---|---|---|---|---|
| mul | 34 | 0.0 |  | 0.0 |  |  |
| add | 34 | 0.6 | |z|=1, 1e-12 off: 0.6+0.8i | 0.6 | |z|=1, 1e-12 off: 0.6+0.8i |  |
| affine | 34 | 0.5 | 0.3+0.7i | 0.5 | 0.3+0.7i |  |
| recip | 34 | 1.0 | near the pole of mobius: 1e-9-(1-1e-12)i | 1.0 | near the pole of mobius: 1e-9-(1-1e-12)i |  |
| mobius | 34 | 1.0 | -0.4+0.2i | 5.0e+17 | near 1: 1+1e-9i |  |
| blaschke | 34 | 1.0 | large imag 3+40i | 2.3e+7 | large 1e8-3e7i |  |
| pown | 34 | 0.5 | 1.3+0.4i | 0.7 | 1.3+0.4i |  |
| root | 34 | 0.7 | near 10pi: 10pi+0.5i | 2.8e+299 | above the cut: -0.5+1e-300i |  |
| powa | 34 | 3.3 | -0.4+0.2i | 1.6e+76 | above the cut: -0.5+1e-300i |  |
| exp | 34 | 0.9 | 0.8-0.5i | 1.0 | 0.8-0.5i |  |
| log | 34 | 1.6e+7 | near ijouk branch point: 1+1e-8+1e-8i | 4.5e+15 | near 1: 1+1e-9i |  |
| sin | 34 | 1.0 | 1.3+0.4i | 1.4 | near ijouk branch point: 1+1e-8+1e-8i |  |
| cos | 34 | 0.6 | near the pole of mobius: 1e-9-(1-1e-12)i | 0.9 | near ijouk branch point: 1+1e-8+1e-8i |  |
| tan | 34 | 1.4 | 1.3+0.4i | 1.7 | near the zero of zp/rational: 1e-9+(1+1e-10)i |  |
| sinh | 34 | 0.9 | near -1: -1+1e-9-1e-9i | 1.0 | near ijouk branch point: 1+1e-8+1e-8i |  |
| cosh | 34 | 0.8 | 0.8-0.5i | 1.1 | large imag 3+40i |  |
| tanh | 34 | 0.7 | tiny 1e-8+1e-9i | 1.6 | above the cut: -2+1e-15i |  |
| arcsin | 33 | 4.0e+11 | tiny imag 1e-12i | 4.5e+15 | above the cut: -0.5+1e-300i |  |
| arccos | 34 | 1.1e+6 | near 1: 1+1e-9i | 4.5e+15 | tiny 1e-150-1e-160i |  |
| arctan | 34 | 1.5e+11 | tiny imag 1e-12i | 4.5e+15 | tiny 1e-150-1e-160i |  |
| arsinh | 33 | 3.7e+8 | near 0 on the cut: -1e-9+1e-18i | 3.7e+8 | near 0 on the cut: -1e-9+1e-18i |  |
| arcosh | 34 | 16701 | near 1: 1-1e-10+1e-12i | 4.5e+15 | tiny 1e-150-1e-160i |  |
| artanh | 34 | 4.5e+15 | tiny 1e-150-1e-160i | 4.5e+15 | tiny 1e-150-1e-160i |  |
| joukowski | 34 | 2.5e+8 | near the pole of mobius: 1e-9-(1-1e-12)i | 4.5e+15 | near 1: 1+1e-9i |  |
| ijouk | 34 | 0.8 | near -i: -1e-9-(1-1e-9)i | 1.3e+11 | near the zero of mobius: 1e-12+(1+1e-13)i |  |
| conj | 34 | 0.0 |  | 0.0 |  |  |
| poly | 34 | 2.3e+6 | near 1: 1+1e-9i | 1.5e+15 | near 1: 1+1e-9i |  |
| rational | 34 | 2.3e+6 | near the pole of mobius: 1e-9-(1-1e-12)i | 4.5e+15 | near 1: 1+1e-9i |  |
| zp | 34 | 1.3 | |z|=1, 1e-12 off: 0.6+0.8i | 4.5e+15 | near i: 1e-9+(1+1e-9)i |  |
| custom | 34 | 1.2e+8 | near -1: -1+1e-9-1e-9i | 1.7e+8 | near -1: -1+1e-9-1e-9i |  |

How to read it: about 1 ulp is a correctly rounded double. 4.5e15 ulp (= 1/eps) means a component came out as 0, or
with the wrong size, where the truth is nonzero. Every case above 10 ulp was checked by hand:

1. **Clean (≤ 3.3 ulp everywhere, both measures):** mul, add, affine, recip, pown, exp, sin, cos, tan, sinh, cosh,
   tanh, conj. The tan rewrite near its poles (cx.js) holds up: 1.4 ulp at π/2 + 1e-12 i. exp is right up to its
   overflow, where it does overflow.
2. **log near |z| = 1** (normwise 1.6e7 ulp, ~4e-9 relative; per component all digits): Re log z = log|z| is computed
   as `Math.log(Math.hypot(x, y))`, so for |z| = 1 + δ it keeps only the digits of 1 + δ that survive rounding.
   `log(1 + 1e-9 i)` gives Re = 0; the truth is 5e-19. The fix: Re log z = ½ log1p((x − 1)(x + 1) + y²) when |z| is
   near 1 (or `log1p` of the larger part). This one shows in the app: the Landscape height of log|F| and the colour
   of a phase portrait near |F| = 1, and the deformation paths that start there.
3. **The inverse trig and hyperbolic functions at small arguments**: arcsin 4e11 ulp at 1e-12 i (9e-5 relative),
   arctan 1.5e11, arsinh 3.7e8 at −1e-9, artanh and arccos lose all of a small component (artanh(1e-150) = 0). All go
   through `log(1 + small)` (asin0, atan as a difference of logs). The fix is the usual one: `log1p` and the series
   for small |z| (asinh z = z − z³/6 + …), or the cancellation-free forms of Hull, Fairgrieve and Tang (1997).
4. **Cancellation in the formula, near a zero:** joukowski (z + 1/z)/2 near ±i (2.5e8 ulp), poly z³ − z near 1
   (2.3e6), rational and custom near their zeros (up to 1.2e8). The value is tiny and the formula subtracts two
   numbers of size 1. Factored forms do not cancel: (z − i)(z + i)/(2z) for joukowski, and the zeros-and-poles form
   the app already has for zp (1.3 ulp normwise). A polynomial entered by its coefficients will always cancel near its
   roots in doubles: that is the problem's conditioning, not a bug, and Arb at runtime would not change what is
   drawn at screen resolution.
5. **The small component next to a cut**: root and powa (exp of a scaled log) give Re ≈ 4e-17 just above the cut at
   −0.5 + 1e-300 i, where the truth is 7e-301 (normwise 0.7 ulp, so the drawn point is right). `CX.sqrt` itself is
   exact there; the root step could use it for n = 2. This matters only where a decision rests on that small part.
6. **Large arguments** (1e8, 700 + i, −40 + 0.3i): no losses beyond 1 ulp, and the overflows overflow.

So the CPU maths needs precision in five known places, and a double-precision fix exists for each: `log1p`, small-|z|
series, factored forms. None of these needs ball arithmetic at runtime.

## Fixed (the precision follow-up)

The five places are fixed in `src/cx.js` and `src/funcs.js`, and `test/t_arb_reference.js` gates every step against
`reference.json` with a normwise and a per-component limit that only tighten:

- **log near |z| = 1**: Re log z = log|z| as ½ log1p(|z|² − 1) with |z|² − 1 summed error-free (twoProd, twoSum).
- **The inverse functions at small arguments**: a complex `log1p` (`CX.log1p`) for asin, atan and acosh near their
  zero; acos near 1 as 2 asin √((1 − z)/2); Im atan z as ¼ log1p(4y / (x² + (1 − y)²)) where that ratio is small; and
  just off the real segment (or the imaginary axis) the first-order form f(x) + i y f′(x), exact to double there.
- **Cancellation near zeros**: compensated Horner (`CX.polyEvalComp`) for the polynomial and rational steps;
  Joukowski as ½ (x (1 + 1/r²), y (1 − 1/r²)) with r² − 1 summed error-free (`CX.jouk`).
- **The small part next to a cut**: `powReal` takes the angle as a multiple of π/2 plus a remainder computed from the
  components, so the root and power steps keep the tiny component next to their cut.
- No cut side changed (a differential test of every function over a grid with ±0 on the axes against the old code).
- The reference now raises the precision where one component is far below the other (it had certified a Re of
  ~1e-300 at 256 bits that only 1024 bits resolve): all 1020 values certify.

Against the same reference, before → after (bold: changed):

| step | normwise before → after (ulp) | per component before → after (ulp) |
|---|---|---|
| mul | 0.0 | 0.0 |
| add | 0.6 | 0.6 |
| affine | 0.5 | 0.5 |
| recip | 1.0 | 1.0 |
| mobius | 1.0 | 5.0e+17 |
| blaschke | 1.0 | 2.3e+7 |
| pown | 0.5 | 0.7 |
| root | **0.7 → 0.9** | **2.8e+299 → 1.1** |
| powa | **3.3 → 1.2** | **2.8e+299 → 3.8** |
| exp | 0.9 | 1.0 |
| log | **1.6e+7 → 0.8** | **4.5e+15 → 0.9** |
| sin | 1.0 | 1.4 |
| cos | 0.6 | 0.9 |
| tan | 1.4 | 1.7 |
| sinh | 0.9 | 1.0 |
| cosh | 0.8 | 1.1 |
| tanh | 0.7 | 1.6 |
| arcsin | **4.0e+11 → 32** | **4.5e+15 → 1.1e+6** |
| arccos | **1.1e+6 → 1.0** | **4.5e+15 → 2.5e+11** |
| arctan | **1.5e+11 → 0.7** | **4.5e+15 → 1.0** |
| arsinh | **4.5e+15 → 32** | **4.5e+15 → 1.1e+6** |
| arcosh | **16701 → 1.1** | **4.5e+15 → 4.0e+8** |
| artanh | **4.5e+15 → 0.9** | **4.5e+15 → 1.3** |
| joukowski | **2.5e+8 → 1.0** | **4.5e+15 → 1.7** |
| ijouk | 0.8 | 1.3e+11 |
| conj | 0.0 | 0.0 |
| poly | **2.3e+6 → 0.0** | **1.5e+15 → 0.0** |
| rational | **2.3e+6 → 0.8** | 4.5e+15 |
| zp | 1.3 | 4.5e+15 |
| custom | 1.2e+8 | 1.7e+8 |

Left as they are (each has a large per-component limit in the test): a Möbius map's or a rational's tiny component
near the unit circle (normwise 1 ulp), asin and asinh next to their branch points (normwise 32 ulp), acos just off
x > 1, acosh's tiny Re near 0, and `custom` (the formula parser's own z² + 1/z, 1.2e8 normwise near −1). The GLSL
twins of log, asin, atan, acosh and the real power (`src/glsl.js` clog, cx_asin0, catan, cacosh, cpowr) have the same
cancellations in float32; their fixes need log1p and an error-free product without fma in WebGL2, so they are a GLSL
change of their own.

## Speed (measured, this container, one core)

A three-step chain sin(exp((z − i)/(z + i))) per point:

| | per point |
|---|---|
| JS doubles (`cx.js`, node 22, with its object allocation) | 0.25 µs |
| Arb through python-flint, 53 bits | 2.9 µs |
| 128 bits | 4.0 µs |
| 256 bits | 5.2 µs |
| 1024 bits | 29 µs |

Most of the python-flint time is the Python call per operation; Arb in C or WASM would be closer to 1 µs per point at
53–128 bits, still 4–20× the doubles. The live view evaluates on the GPU in float32 per pixel, where Arb cannot run;
the CPU evaluates meshes of 10⁴–10⁵ points per edit, where 1–5 µs per point is 0.1–0.5 s. It is fine for a one-off
certified answer (a winding number, a root enclosure), not for anything per frame.

## What shipping Arb in the page would take

- **A WASM build of FLINT with GMP and MPFR** (FLINT 3 needs both). The native libraries in python-flint's wheel are
  16 MB on x86-64. A WASM build trimmed to the acb functions the app would call is plausibly a few MB, not measured
  here. The page is about 4.6 MB today, so it would grow by a large fraction. It would be base64 inside the single
  HTML file, so the file grows by another third over the binary's size.
- **LGPL-3.0-or-later** (FLINT, MPFR; GMP is LGPLv3 or GPLv2). Shipping a combined work is allowed, but users must be
  able to replace the library: the page would need the WASM as a separable module, its source or a written offer, and
  a notice. The project's licence and the "one standalone HTML file" rule (CONTRIBUTING.md) would both need a
  decision by the owner. Nothing in the app is LGPL today.
- **CI gating:** none needed for the page itself; the oracle below gates the doubles.

## Recommendation

1. **Do not ship Arb in the page.** The measured losses are a short list of formulas with cheap double fixes, and the
   GPU (where the pixels come from) cannot use it anyway.
2. **Fix the five places in `cx.js` / `funcs.js`** (findings 2–5), each with a test against `notes/arb/reference.json`:
   log near |z| = 1 first, since it shows in Landscape heights and phase colours. These are app changes, so separate
   issues, not this spike.
3. **Turn the oracle into a CI check later:** a unit test (`test/t_arb_reference.js`) that reads the committed
   `reference.json` (no FLINT in CI) and fails when a step's normwise error passes a budget per step (16 ulp for the
   clean ones, the current numbers for the known cases until they are fixed). Regenerate the JSON with
   `tools/arb_reference.py` when a step or a point is added. The same file can serve the GLSL tests as a second,
   independent reference for the shaders' float32 budgets.
4. **Keep Arb for one-off certified answers in dev tools** (a winding number, a root enclosure, deciding whether a
   Landscape wall break is real), where 1–30 µs per point is fine. This is where #9's points 2–4 would start, if ever.

# Formula recognition: design (v15 patch, 2026-10-24)

A custom formula F is read, when it can be, as a chain of catalog steps h_n ∘ … ∘ h_1 that **is** the formula.
The step then renders, deforms, reports guarantees and exports as that chain. Its text, TeX, saved state and links
stay exactly as the user typed them. Code: `src/recognize.js` (the reader), `src/funcs.js` (`recChain`, `asChain`,
`buildVals`), `src/inverse.js` (`stepOps`), `src/glsl.js` (`recPlan`, `astSig`, `sheetPlan`). Audit: `AUDIT.md`.

## 0. The user's case: z^{complex}

LaTeX and plain text were never the cause. `z^{i}` and `z^i` parse to the same tree, so they had the same values,
ops and path. The difference was between the typed formula and the catalog step "Complex power":

- the deformation was the generic zoom path about p = 1, not the catalog's z^{1+(α−1)t} (`customNat` only knew a
  few shapes);
- no cut was drawn (the custom build returned no `cuts`), so there was no seam and no "image of a cut";
- fewer lamps (`Expr.classify` never claims injective);
- a shared exponent flipped the path kind and the program at integer values;
- the GPU key held the raw text, so each spelling compiled its own program.

With recognition, `z^{i}`, `z^i`, `z^(1+i)`, `z^{a}`, … are the catalog `powa` step on the formula's cut θ, sheet 0.
They have the same values, path, cut, lamps and program as the catalog step, and one program for every spelling and
every value of a. The deformation of z^{i} at t = 0.5 is now pixel-identical to the catalog step's (AS-BUILT).

## 1. What "the same function" means here

The chain must give F's values everywhere, with the same branches. Expr.compile evaluates every log, √, n-th root
and non-integer power on the formula's cut θ, sheet 0; the inverse trigonometric and hyperbolic functions on their
principal cuts; c^{u} as e^{u Log c} with the principal Log c. So:

- log → `log(cut θ, k 0)`; √ → `root(2, θ, 0)`; u^{s} with constant s → `pown(s)` for an integer |s| ≤ 4096 (ipow
  in both), `root(n)` when s is exactly 1/n (powReal(u, 1/n) in both), else `powa(s, θ, 0)`; arcsin… → the catalog
  inverse step (same CX function); c^{u} → `mul(Log c)`, then `exp`.
- The reading follows the tree. **No identity that moves a cut is ever used**:
  - √(z²) is z² then √;
  - log(e^z) is exp then log;
  - log(z²) is z² then log;
  - arcsin(sin z) is sin then arcsin;
  - √z·√z, √(z−1)√(z+1) and log z + log(z−1) stay formulas.
- A shared number keeps its name in the step's text. It **never decides the structure** (review math-5, frperf-1/2):
  - an exponent or root index that holds one is `powa` at every value, integers included;
  - every other choice that reads a value (a zero or unit coefficient, two equal subtrees, a degree, the kind of a
    product, the Möbius name) is recorded once, at two generic sets of values, on a tape. The tape is cached by the
    tree (shared numbers by name) and the cut, and is replayed at the current values. So the step types, the program
    key and the path kind stay fixed while a slider moves: `z^2+az` is `poly` at a = 0 too, `\frac{az+1}{z+a}` is
    `mobius` at a = 0;
  - only a value where the formula really changes kind is refused at that value (a constant map, a removable point, a
    lower degree): `\frac{z^2-a}{z+1}` at a = 1, `\frac{az+1}{z+a}` at a = ±1.
- A removable point is never filled in. A rational part whose normal form divides out a common root (the formula is
  0/0 there) is refused, and so is a merged Möbius run whose product loses a factor's pole (`\sin(1/(1/z))`, math-3).
- **The CPU values are the formula's, bit for bit** (math-1, math-2, math-4): the step's `f` stays `Expr.compile` of the
  formula on its raw θ. Signed zeros on the cuts (−z feeding a log or √), cut angles outside (−180°, 180°], and
  overflow (NaN where the spelling overflows) are the formula's. Curves, probes and tour points use it. The GPU plan
  and the inverse ops are the catalog steps' (normalised cut and sheet, the identities' finite values). They can
  differ from the formula only exactly on a cut ray, at isolated points, or where the formula's own spelling
  overflows (there the GPU draws the true function: `tan(e^z)` for Re z > ~6.6). That is accepted.
- The rational normal form reads decimal literals exactly (0.3 = 3/10). A reading whose degree the doubles do not
  have, `(0.1+0.2−0.3)z^3+2z`, is refused (math-6), so no lamp claims a degree that dropped through cancellation.
- Negative constants carry −0 imaginary parts in Expr (`\sqrt{-1} = −i`, math-7). That is Expr's, not the reader's:
  the reader evaluates constants with Expr.compile, so it follows Expr either way.
- **When unsure, refuse.** The formula then stays as it was. As a final guard (not the proof), `recChain` compares
  the chain with F at seven generic points (1e-9; with shared numbers, at both generic sets, then 1e-6 at the current
  value) and refuses on any difference.

## 2. The reader (`Recognize.chain(ast, cutDeg)`)

1. **The spine.** A node with one operand depending on z becomes one step after that operand's steps:
   - −u, u ± c, c − u, c·u, u/c and c/u become Möbius matrices;
   - powers and roots as in §1;
   - `exp, log, sqrt, sin … artanh, conj` become their catalog steps; `cot, sec, csc, coth` become `tan, cos, sin, tanh`
     then `recip` (as Expr.compile: 1/tan, …).
2. **Nodes with z in both operands.**
   - **A product of integer powers of affine factors** c ∏ (a_k z + b_k)^{m_k} (frperf-3): one root → affine, power,
     scale; two simple factors → the normal form below; otherwise the catalog `zp` step (product form on the CPU and
     the GPU, exact near repeated zeros). A zero and a pole that cancel are refused. A repeated non-affine factor
     keeps the formula.
   - **Rational.** The exact normal form P/Q from `Inverse.rationalForm` (BigInt Gaussian rationals, coprime), then:
     - degree 1: a Möbius matrix;
     - a polynomial a z^n + b: `pown(n)` and an affine map;
     - any other polynomial: `poly`;
     - R(z^g) with g > 1: `pown(g)` then the reading of R;
     - the Joukowski family (dp = 2, dq = 1): α u + γ + β/u with u = z − z0 is (2αs) J(u/s) + γ, s² = β/α, read as
       affine → `joukowski` → affine;
     - otherwise: `rational(p, q)`.
     - `poly` and `rational` evaluate expanded coefficients by Horner, which cancels near a repeated root in float32.
       They are used only when the formula is itself typed expanded (sums of c z^k, or a quotient of two), or when
       the degree is ≤ 4 with roots apart by more than 1e-3. Otherwise the formula stays (`z(z-1)^4-(z-1)^4`).
   - **Entire identities** (no branch anywhere, so any spelling is the same function):
     - e^A e^B = e^{A+B} and e^A/e^B = e^{A−B};
     - e^{cX} ± e^{−cX} = 2 cosh cX, 2 sinh cX (with c = ±i: 2 cos X, ±2i sin X);
     - sin u / cos u = tan u, and the hyperbolic forms;
     - sin u cos u = ½ sin 2u, and the hyperbolic form;
     - sin u + cos u = √2 sin(u + π/4), cos u − sin u = √2 cos(u + π/4).
   - **One branched identity:** log(1+u) − log(1−u) = 2 artanh u, on θ = 180° only. CX.atanh evaluates exactly
     ½(log(1+u) − log(1−u)); the operands and the logs are bit-identical (checked in AS-BUILT).
   - **Not recognized (refused):** the textbook arsinh log(z + √(z²+1)) and arctan (1/2i) log((1+iz)/(1−iz)) **as
     arsinh and arctan**. They are not proved on the cuts' own points (signed zeros), and the formula cancels where the
     catalog does not. They are still read as what they are: the outer log, and Möbius → log → scale.
3. **Merging.** Consecutive Möbius-type maps are multiplied into one matrix, so affine pre- and post-maps are absorbed
   into a neighbouring affine or Möbius step. The result is named by its shape: identity (dropped), `mul`, `add`,
   `affine`, `recip` or `mobius`. A degenerate product is refused.
4. **Partial.** A part with no catalog reading becomes a `custom` part: the subtree as a formula of its own input,
   evaluated by Expr.compile on the same cut. Examples: `sin z + z`, `|u|`, `z^z`. Adjacent parts merge.
   - A partial chain is used only when it holds a step that is not Möbius-type. A formula part wrapped only in affine
     maps gains nothing.
   - A chain with no catalog step, or with no step at all (`z`, `z^1`), is null: the formula stays as it is.

## 3. What a recognized step takes from the chain, and what stays the formula's

`Funcs.build` (custom) calls `recChain`. The steps are built from evaluated values by `Funcs.buildVals` (no text
round trip). Formula parts are built from their tree (`ast`, `part: true`: never recognized again). `asChain` then
sets on the built step:

| from the chain | |
|---|---|
| `f` | on the CPU the formula's own `Expr.compile` (§1); on the GPU `recPlan`: each step's own plan as `P r j _f/_h`, the step as their composition |
| natural path | the steps' own homotopies in turn, step j on [j/n, (j+1)/n] of the step's time (CPU `hom`, GPU `P_h`); the caption says so and lists each step's own phrase. For one step, exactly that step's path and caption. On the CPU the point before step j is the formula's own pieces (the groups that end by j: Expr.compile of that piece as written), so the deformation ends on the formula's side of its cut |
| guarantees | `composeProps` of the steps, added to the formula's own lamps (both are true of the same function) |
| cuts, poles | those of the steps whose input is an affine image of the step's input, carried back through that affine map (a ray stays a ray). The seam stays draggable when that map only scales by a positive number and translates. Cuts of later steps live in planes the app does not show, as in a one-step view of a catalog chain |
| inverse renderer | `Inverse.stepOps` concatenates the steps' ops. When one step has none, it falls back to today's `customOps` of the formula, so nothing that rendered exactly before stops doing so |
| sheet view | the steps' pieces in turn (`Funcs.stepSheets` / `sheetEval`, GLSL `sheetPlan`), as the catalog chain |

Stays the formula's: the step params (text, cut), its TeX and LaTeX export, saved state and links, the domain and
branch notes, d/dz (`derivAst` / `derivPlan`), the inverse step offered, "write by zeros and poles".

The Inspector adds one short clause under the step (English and Russian, `notes/i18n/ru/v15-recognize.json`, review
frperf-5), with catalog labels that carry no parameter letters (Scaling, Translation, Square root, Root):

- "Same as Möbius → Logarithm → Scaling" / «Совпадает с цепочкой Дробно-линейная → Логарифм → Растяжение»;
- "Partly the same as Custom formula → Logarithm" (`\log(z^z)`).

It stays the same while a slider moves (the tape), except at a value where the formula changes kind.

**Cost.** The reading, its built steps and the probes are cached by (tree with shared numbers by name, cut), 96
entries (frperf-4). A rebuild without shared numbers reuses the built steps; with shared numbers it replays the tape
and builds the steps from the current values (no rational normal form, no generic builds).

**Program keys.**

- A recognized step's GLSL key is `['custom', 'rec', the steps' keys]`. Values are uniforms, so every spelling of a
  formula with the same steps, and every value of a shared number, is one program.
- An unrecognized formula's key is its canonical tree (`astSig`: no positions or spelling; shared numbers by name;
  other constants by value, because the sheet code bakes integer exponents in), not the raw text.
- The inverse key is the steps' op kinds, as before.

## 4. Which paths apply after a partial reading

- **Inverse renderer.** It needs every op of the whole chain. A formula part has ops only when it is a single-z
  rational (customOps), which the reader would have recognized anyway. So in practice a partial chain is drawn
  forward, by the GPU mesh or the SphereMesh, for the whole chain, exactly as the formula was before.
- **What still improves.**
  - The recognized steps are evaluated by the catalog's GPU code.
  - They deform along their own natural paths. Only the formula part uses the generic zoom, so an outer log or
    power no longer has a moving cut under gzoom.
  - Their guarantees compose with the part's.
  - Their cuts are drawn when the part comes after them.

## 5. Limits, by decision

- Equal sub-intervals: a recognized step of n steps plays them in the time of one app step (the catalog chain takes
  n). The pictures along the way are the same; the speed differs. The deformation caption says so ("runs its n
  catalog steps in turn, each on an equal part of 0 ≤ t ≤ 1"). Stretching the step to n units is a product decision
  for the user (review frperf-6).
- "All at once" applies across app steps, not inside one recognized step.
- No reading for: Blaschke (the catalog step takes a complex a; shared numbers are real), the inverse Joukowski
  forms, degree-2 rationals with two finite poles (the `rational` step keeps today's path and RAT2), cubic and higher
  polynomials beyond `poly`.

# Formula as visible steps: the mathematics (designer 1 of 3, 2026-10-24)

Angle: exactness. This covers which splits are exact, how fine the steps are, how parameters are written as text with
shared numbers kept linked, what to refuse, and how the deformation compares. It also covers the second request ("sin z
is the Sine step") from the same angle. The numbers below were measured in node on work/xvr-final-snap/src. The scripts
are in `scratch-math/` (e1–e7).

## 0. Proposals in short

1. **The split is the recognizer's chain R, as it is** (Möbius-type runs merged). R is already proved and tested. The
   split's deformation is the formula step's deformation, frame for frame (measured below), and its GPU programs are the
   same step programs. No new mathematics is needed for the split itself.
2. **A finer level, on request, for any Möbius step: "as elementary moves"**: translation, then rotation and scaling,
   then inversion, then translation. It is exact on the whole sphere, the pole included, but only in that order
   (§2.3). It shows the typed build-up of forms like `\frac{3}{z-1}+2` and `\frac{1}{1+e^{-z}}`.
3. **Parameters are text written from the formula's own subtrees.** Shared names are never replaced by numbers. Every
   text is re-read and checked against R's value. If a parameter cannot be written that way, that piece is not split.
   `Expr.simplify` must not be used: it folds shared names into numbers (§3).
4. **Exactness standard for the visible chain:**
   - the same function as F off the branch cuts, up to the last bit (most examples are bitwise equal);
   - the same cuts as sets, the same sheets, and the same poles;
   - no removable point filled in.
   On a cut ray itself, each step takes its own closed side, arg ∈ (θ − 360°, θ], as every catalog chain does. That
   differs from F only after a pure negation feeding a 180° cut (`\log(-z)`, `\sqrt{-z}`), and there the steps give
   the textbook principal value (§1).
5. **Refuse:**
   - non-compositions without an identity reading (`z^2+\sin z`);
   - everything R refuses;
   - splits whose only catalog steps are Möbius-type;
   - any piece whose parameters cannot be written in the names.
   A part with no catalog reading becomes a formula step of its own (a partial split) only when the rest holds a real
   transform.
6. **"One simple function" means R is exactly one step**, in the palette and in the add-step menus. In an existing
   formula step it is never automatic. After the text is committed, the "Same as …" note offers the catalog step (§7).

## 1. What "the same function" must mean once the steps are visible

Inside a formula step, the CPU values stay F's own `Expr.compile` (v15.1, math-1/2/4). After a split there is no
formula left. The values are the catalog steps' own `f`, composed. So the standard is about the composition.

Measured (e2, 23 formulas × cuts 180°, 90°, −90°, 270°):
- **3000 random points:** max relative difference 0 for all but one: `e^{iz}+e^{-iz}` gives 4e-16 (sum against 2cos).
- **Axes with ±0** (40 points per formula): no difference, except `\log(-z)` and `\sqrt{-z}` at cut 180°. There, 5 of
  40 points differ: the positive real axis, which is the preimage of the cut. Examples:
  - F(0.3 + 0i) = log 0.3 − iπ;
  - the steps (Multiply by −1, then Logarithm) give log 0.3 + iπ.
- **Why:** the formula's −z is an IEEE negation (−0.3 − 0i). The catalog `mul(−1)` is a complex product, which gives
  (−0.3, +0). The step value is the principal one (arg ∈ (−π, π]); F's comes from the signed zero. No other cut angle
  is affected, because atan2 distinguishes ±0 only on the negative real axis.
- **Decision:** accept. The visible chain follows the catalog convention on cut rays, like any chain the user builds. Do
  not change `mul` to negate exactly at c = −1: that would move the catalog's own `×(−1) → log` on its cut, and the GPU
  ignores signed zeros anyway.
- **What the user sees:** a curve that lies exactly on such a line (the grid's real axis) moves from the bottom edge of
  the log strip to the top. The offer can detect it by checking F against the split on the axes and on the cut rays
  carried back to the z-plane. When it differs, the note adds one clause: "on the cut itself, the steps take the upper
  side".

Other points:
- **Cut angle θ.** Each branch step gets the formula's θ, typed as it was, and sheet 0. `finish()` normalises a θ
  outside (−180°, 180°] into (cut, k). That is the same function off the ray. On the ray, the catalog's side applies
  (the verify-1 situation, now in the step's favour of consistency).
  - The formula had one θ for all its logs, roots and powers. After the split, each branch step has its own cut field
    (an `angle` param, a plain number). That shared θ is not kept as a link. This is a gain (each seam drags on its
    own), but the split note should say so.
- **Poles and removable points.** R never fills a removable point. Each step keeps its own poles. A pole's value is ∞
  in both, except after an elementary inversion followed by a scaling (§2.3).
- **Overflow (math-4).** For identity readings (`\frac{\sin z}{\cos z}` → tan), the CPU values become the catalog
  ones, which are finite where F's spelling overflows. CPU and GPU then agree, which the formula step did not.
- **Lamps** (e3, 17 formulas). `composeProps` of the split loses no lamp the formula step had. Check it anyway (§8):
  the formula's `classify` can add lamps of its own.
- **Inverse.** After the split, the chain's inverse is the reverse of each step's catalog inverse (principal
  branches). That is different from, and usually better than, the formula's `customInverse`.
- **d/dz after the step.** The same function G_k gives the same derivative. The arithmetic changes from `derivAst` to
  the chain rule.

## 2. How fine the steps are

### 2.1 Options

| level | `1/(1+e^{-z})` | `\frac{3}{z-1}+2` | `\frac{2z+1}{z-1}` | `\frac1z+z` |
|---|---|---|---|---|
| as written (each typed operation) | −z, exp, +1, 1/u | −1, 3/u, +2 | none (z on both sides of ÷) | none (z on both sides of +) |
| R (merged Möbius runs) | ×(−1), exp, Möbius 1/(1+u) | Möbius (2z+1)/(z−1) | Möbius | Joukowski, ×2 |
| elementary (R, then each Möbius as moves) | ×(−1), exp, +1, 1/u | −1, ×⅓, 1/u, +2 | −1, ×⅓, 1/u, +2 | Joukowski, ×2 |

### 2.2 Default: R

- **No "as written" chain exists for the most common formulas.** Any node with z in both operands (a fraction of
  two z-expressions, a sum of exponentials, z + 1/z) has none. R reads those nodes as wholes, so a design built on "as
  written" needs R anyway.
- **The deformation agrees with the formula step's.** Measured (e3): the formula step's `hom` at t, against the split
  played in turn at T = n·t (step j at s = nt − j). For 17 formulas × 5 times × 400 points there are 0 differences
  and max rounding 0, so the frames are bitwise equal. A finer split would change the frames in between. Splitting
  should not change the movie, only stretch it and open its planes.
- **R's merging is where exactness was proved:** `runPolesHold`, the tape, and the 382,583 comparisons. Changing it
  would reopen that proof, and it would change the paths of formulas already published (tour scenes, quality scenes).
- **Affine runs stay one step.** For example 2u + 5 in `2(z-1)^3+5`. The catalog Affine step is "a u + b", and the
  palette treats `2z+1` as one simple function, so one rule covers both features.

### 2.3 Finer, on request: a Möbius step as elementary moves

For (az+b)/(cz+d) with c ≠ 0 and det = ad − bc:

    translate by d/c  →  multiply by −c²/det  →  inversion  →  translate by a/c

For c = 0 (affine): multiply by a, then translate by b. Moves that are the identity (×1, +0) are dropped.

- **The order matters.** The textbook order (inversion, then × −det/c²) maps the pole to NaN: `CX.mul(c, ∞)` is
  NaN (e4). Then the image of the pole, and the log of it, are lost in every later plane. Scaling before inverting
  keeps ∞ exact (e7):
  - `\frac{2z+1}{z-1}`: F(1) = ∞, the moves give ∞;
  - `\log\frac{1+z}{1-z}` at 1: F = ∞ + iπ/4, the moves give the same.
- **Off the pole** the rounding is 2e-16 to 1e-15, with no ±0 differences on the axes (4 cases).
- **What it reproduces:**
  - `\frac{3}{z-1}+2` gives −1, ×⅓, 1/u, +2: the user's build-up, with the scale written as ⅓ before the inversion
    instead of 3 after it. Exactness at the pole decides that.
  - `1/(1+e^{-z})` gives exactly +1, 1/u (the scale 1 and translation 0 drop).
- **The deformation is a different movie,** four paths instead of the one-parameter Möbius group (e4: the frames at
  t = ½ differ by up to 5). That is the point of asking for it. It is offered on any Möbius or Affine step, catalog
  steps included, not only on split formulas.
- **Not offered:** to split rotation from scaling (×|c| then ×e^{i arg c}), or to split z^6 into z²∘z³. Those are not
  operations the user wrote.

## 3. Parameters as text, and shared numbers

A split writes ordinary catalog steps, whose parameters are text: `cx` fields go through `Expr.constValue`, which
reads names. The text is the record (saving, links, undo). The rules:

1. **Spine constants are the formula's own subtrees**, printed with `Expr.toTex` (no simplify). Number nodes keep
   their typed `lit`.
   - `(z-a)^3`: Translate c = `-a`, then Integer power n = 3.
   - `e^{az}`: Multiply c = `a`.
   - `\sqrt[a]{z}`: Complex power α = `\frac{1}{a}`.

   Measured (e6): `-a`, `-\left(a+1\right)` and `\frac{1}{a}` print with the name and re-read to the same value.
2. **Never `Expr.simplify`.** Measured (e5): it folds shared numbers into their values:
   - `-a` becomes −0.7;
   - 1/a becomes 10/7;
   - a+1 becomes 1.7;
   - 2(−a)+1 becomes "−1.4+1".

   Using it would cut every link silently. The split needs a small name-preserving tidy: fold literal numbers only, and
   write a merged affine run as a linear form in the names with exact coefficients (2(z−a)+1 gives b = `1-2a`). If the
   tidy text is not shorter, print the plain tree.
3. **Merged values are composed as trees,** in parallel with R's matrices. Each `M()` carries four entry trees, and
   `mobMul` multiplies trees as it multiplies numbers.
4. **Normal-form readings** (z on both sides) take their text from the typed shape, not from the normal form. The
   normal form is scaled and holds numbers only. Measured (e1):
   - `\frac{2z+1}{z-1}` comes out as Möbius (1, ½, ½, −½);
   - `\frac{az+1}{z+a}` at a = 0.7 comes out as (0.546875, 0.78125, 0.78125, 0.546875).

   Read instead:
   - a fraction of two affine forms in one u: a, b, c, d from the numerator and denominator (`affine()` extended to
     carry trees). This gives (2, 1, 1, −1) and (`a`, 1, 1, `a`);
   - a polynomial typed expanded: the coefficient of each typed term;
   - a product of affine factors (`zp`): zeros and poles −b/a as trees.

   Without names, exact rationals print exactly (⅓, not 0.333…).
5. **Identity readings write their own constants:**
   - `\frac{\pi}{4}` and `\sqrt{2}` for sin u + cos u;
   - `2`, `2i` and `\frac{1}{2}` for the exponential, sine and cosine forms;
   - `i\,\log 3` for `3^{iz}` (the typed base in the log).
6. **`int` and `angle` fields cannot hold names** (they use `Number(raw)`). R already reads a shared exponent or root
   index as Complex power at every value. So `z^{n}` with a shared n is Complex power α = `n`, never Integer power,
   even while n = 2. The cut fields get θ as a number.
7. **Check every text.** Re-read it under the current names (and at both generic sets when names occur). It must equal
   R's value to 1e-12 relative. The set of names in all step texts must equal the set in F. Otherwise that piece stays
   a formula step, or nothing is offered. A number is never written in place of a name.
8. **Links follow by name.** A name may appear in several steps (`\frac{az+1}{z+a}`: two fields of one Möbius step).
   One slider moves all of them, and the chain stays F. The split never creates or renames shared numbers. Step types
   stay R's tape types at every value, as in the formula step. At a value where F changes kind (a = ±1 there), the
   split chain is still F off the removable point: the catalog Möbius step reports "constant".

## 4. Parts with no catalog reading, and non-compositions

- **`z^2+\sin z`** (also `z e^z`, `\sin z+z`): offer nothing. The chain model is one input per step. A sum of two
  functions of z is not a composition of one-variable maps, and there is no identity reading. A "split" into one
  formula step would be noise.
- **Partial readings** (R `partial`): the unread subtree becomes its own Custom formula step. Its text is the subtree
  with its input as z, printed by `toTex` (names kept), on the formula's θ. Offer it only when the rest holds a step
  that is not Möbius-type, which is R's own rule. Examples:
  - `\log(z^z)`: Custom formula `z^{z}`, then Logarithm;
  - `\log(z+\sqrt{z^2+1})`: Custom formula `z+\sqrt{z^{2}+1}`, then Logarithm. This is not arsinh: that identity is
    not proved on the cuts (DESIGN §2).

  The part is the same function as the subtree (same θ, same Expr arithmetic), so its values are exactly the
  formula's piece. Recognizing it again finds nothing, because R had none.
- **Nodes read through an identity** (`e^{iz}+e^{-iz}` = 2cos z, `\frac1z+z` = 2J(z), `\cot z` = 1/tan z, sin u + cos u
  = √2 sin(u + π/4)): these are exact everywhere (entire, or rational with no removable point). The steps are not the
  typed operations, so the offer must state the identity ("= 2 cos z"). Otherwise the user may think the app rewrote
  the formula.
- **Refused, as in R:**
  - removable points (`\sqrt z\sqrt z`, `\frac{(z-1)^3}{(z-1)^2(z+2)}`);
  - decimal cancellations;
  - ill-conditioned Horner readings;
  - cut-moving identities.

  `\sqrt{z^2}` is not refused. It splits into Square, then Square root, which shows exactly why it is not z.

## 5. Deformation: should the split and the formula agree?

Yes, and with R as the split they do. The formula step plays step j on [j/n, (j+1)/n]. The split plays it on
[j, j+1]. The frames are bitwise equal at matched times (e3). What the user sees differently:
1. **Duration:** n units instead of one (the open frperf-6 point settles itself here).
2. **Planes:** w₁ … w_{n−1} become visible and selectable. Each step's cut is drawn in its own input plane. Inside the
   formula step, only the cuts carried back through affine maps were drawn.
3. **"All at once":** it now runs the steps together (Hⁿ_t ∘ … ∘ H¹_t), a movie the formula step never showed.
4. **On cut rays:** the formula step's deformation ran into F's side (verify-1). The split's runs into the catalog's
   side. They differ only in the §1 negation cases.
5. **Partial splits:** the formula part keeps its zoom path, as inside the formula step.
6. **Probe readouts:** they may change in the last digit, because the catalog arithmetic replaces `Expr.compile`.

The elementary refinement (§2.3) is the one place where the movie changes on purpose.

## 6. The examples

R = what the split writes (step: parameter text). Cut θ is the formula's.

| formula | split | notes |
|---|---|---|
| `\sin(z^2+1)` | Integer power n=2 → Translate c=`1` → Sine | bitwise equal to F at 3000 points and on the axes |
| `\frac{2z+1}{z-1}` | one step: Möbius a=`2` b=`1` c=`1` d=`-1` | the offer is "use the Möbius step". Typed coefficients, not R's (1, ½, ½, −½). Elementary: −1, ×`\frac{1}{3}`, 1/u, +2 |
| `e^{iz}+e^{-iz}` | Cosine → Multiply c=`2` | identity 2cos z, stated in the offer; 4e-16 |
| `z^{i}` | one step: Complex power α=`i`, cut θ, sheet 0 | already pixel-identical to the catalog step (v15.1) |
| `(z-a)^3`, shared a | Translate c=`-a` → Integer power n=3 | linked. At a = 0 the translation stays (tape) |
| `\sqrt{1-z^2}` | Integer power n=2 → Affine a=`-1` b=`1` → n-th root n=2 | the root's cut is drawn in w₂; its preimage is the real axis outside (−1, 1) |
| `\log\frac{1+z}{1-z}` | Möbius `1`,`1`,`-1`,`1` → Logarithm | not 2 artanh z (that identity is not the formula's arithmetic). Elementary: −1, ×`-\frac{1}{2}`, 1/u, −1, then Log; the pole is exact |
| `z^2+\sin z` | nothing offered | not a composition, no identity |
| `\frac{1}{z}+z` | Joukowski → Multiply c=`2` | rational identity. Not "Joukowski" alone (off by 2) |
| `\log(-z)` | Multiply c=`-1` → Logarithm | on the positive real axis F = … − iπ, the steps … + iπ (§1) |
| `\frac{az+1}{z+a}` | Möbius `a`,`1`,`1`,`a` | R's values (0.546875, …) must not be written |
| `1/(1+e^{-z})` | Multiply `-1` → Exponential → Möbius `0`,`1`,`1`,`1` | elementary: +1, 1/u, as typed |
| `\log(z^z)` | Custom formula `z^{z}` → Logarithm | partial |
| `\cot z` | Tangent → Inversion | as Expr evaluates cot |
| `z^{a}` | Complex power α=`a` | never Integer power, even at a = 2 |

## 7. "One simple function" (the second request)

**Rule:** a query (or formula) is one simple function when R reads it, not partially, as exactly one step. That step,
with §3's text, is the item. Measured (e1):
- **One step:**
  - Sine: sin z, \sin z, sin(z);
  - Tangent: tg z;
  - Exponential: e^z, exp z;
  - Logarithm: log z, ln z;
  - n-th root: sqrt z, \sqrt[3]{z}, z^{0.5}, z^{1/3};
  - Integer power: z^3;
  - Complex power: z^{i}, z^{a};
  - Inversion: 1/z, z^{-1};
  - Multiply by c: -z, iz, z/2, az;
  - Translate by c: z+a;
  - Affine: 2z+1;
  - Möbius: (z-1)/(z+1), (2z+1)/(z-1), \frac{z-a}{1-az};
  - Conjugation: conj z, \bar z;
  - Joukowski: \frac12(z+\frac1z);
  - arcsin, arctg (the inverse trigonometric steps);
  - Polynomial: z(z-1).
- **Several steps** (formula step plus split offer): z+1/z (Joukowski, ×2), z^2+1, z^2-1, e^{2z}, sin(2z), 2 sin z,
  (z-1)^2, cth z (tanh, 1/u).

Why exactly one R step, and not "one Rational or Polynomial step":
- Every rational formula is one Rational step, so that would swallow `z^2+1` and `(z-1)^2`. Those are better shown
  as their two transforms.
- `z+1/z` is not the catalog Joukowski map: it is 2J(z). Listing "Joukowski" for it would be wrong by a factor of 2.
  Listing "Rational (z²+1)/z" is exact but less helpful than the two-step split.

The generic families appear only when R itself picks them (`z(z-1)`: Polynomial).

**In an existing formula step: never automatic.** After the text is committed (Enter or blur), the Inspector's
"Same as Sine" clause becomes the action "Use the Sine step" (one undo). Reasons:
1. **Nothing in the picture improves.** A recognized one-step formula already has the catalog step's values, path, cut,
   lamps and GPU program (v15.1). A swap only changes the card's fields.
2. **Prefixes read as one step while typing:** `z`, then `sin z`, on the way to `sin z+z^2`. Any rule that acts during
   typing would replace the card mid-word.
3. **The swap is not invisible to later steps.** The formula's arithmetic and the catalog step differ in signed zeros
   (−z: −0; Multiply by −1: +0). A later Logarithm reads that on its cut. In a chain [formula `-z`] → [Logarithm], the
   image of the positive real axis would jump from −iπ to +iπ.
4. **The typed text is the user's record** (its spelling, its names). It changes only when the user asks.

## 8. Checks before an offer is shown (and the node test plan)

1. R is non-null at the current values. For a split: at least two steps, and R's partial rule holds. For one step:
   "use the X step".
2. Every parameter text re-reads to R's value (1e-12 relative), at the current values and both generic sets. The set of
   names in the texts equals the set in F.
3. The chain built from those texts with `Funcs.build` (exactly what the app will hold):
   - equals the formula step's `rec.fc` at the 7 probes (1e-12);
   - equals F (1e-9) at the t_recognize BASE points off the cuts.
4. On the axes and the carried-back cut rays (±0): if the split differs from F, the offer adds the §1 clause.
5. Lamps of the split are a superset of the formula step's lamps.
6. Test plan:
   - the corpus × the cuts of t_recognize: 1–5, and the deformation frames (formula `hom` at t against the split at
     n·t, bitwise);
   - the elementary refinement at random points, the axes and the pole (∞ kept).

## 9. Risks

- **The text layer is new code.** It covers tree-carrying matrices, the typed-shape Möbius, polynomial and zp texts,
  and the name-preserving tidy. Check 2 is what makes it safe. If 2 fails, no offer.
- **`Expr.simplify` folds names** (measured). One accidental use cuts links silently.
- **Signed zeros on the 180° cut after −u** (`\log(-z)`, `\sqrt{-z}`): the split moves curves that lie exactly on the
  cut's preimage to the principal side.
- **The formula's single θ becomes separate cut fields.** Dragging one seam no longer moves the others.
- **Identity readings show steps the user did not type.** The offer must name the identity.
- **Elementary moves in the textbook order lose the pole** (NaN). Scale before the inversion.
- **The split takes n units of time, and "All at once" means something new for it.** Users comparing with the
  formula step may see these as changes.
- **Readouts may move in the last digit, and overflow regions become finite** (math-4 now in the CPU too).

## Scratch (notes/formula-steps/scratch-math/)

All load work/xvr-final-snap/src as t_recognize does. Run with `node <file>`.
- `load.js`
- `e1_chains.js` (R's chains; takes formulas as arguments)
- `e2_exact.js` (split against F, random points and ±0 axes, four cuts)
- `e3_lamps_path.js` (lamps; deformation frames)
- `e4_elementary.js`, `e7_elem_order.js` (Möbius as moves: the pole, both orders)
- `e5_text.js`, `e6_print.js` (parameter text with names; simplify folds them)

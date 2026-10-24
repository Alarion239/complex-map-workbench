# Constructions and shared parameters: research

Backlog item 18. The user (2026-10-22): "ability to parametrize lines by some shared number that I can later change
in one place / draw lines through points / circles through three points. Please research how this would be possible to
implement. I think maybe we sacrifice the right panel?"

The design is in `DESIGN.md`. The proof of concept is in `poc/`, and its screenshots are in `shots/`.

## Answer in short

- **It can be built, and the app is already shaped for it.**
  - Step parameters are stored as text.
  - Every constant in a custom formula is already a GPU uniform.
  - Lines and circles are already exact in every renderer.
  - `Curves.fromFormula` takes a parsed formula, so values can be substituted before recognition.
- **The core is a small dependency graph** of named numbers, points and constructions.
  - It recomputes only what depends on a change, in a fixed order.
  - The engine's own time per update is negligible: 0.03 ms to drag a point in a graph of 796 objects, and 0.5 ms for
    a slider that drives 200 circles. These figures are CPU time from the node tests.
- **Every curve is a generalized circle**, so "circle through three points" has no special cases.
  - Three collinear points give an exact line.
  - A point at ∞ is allowed.
  - The filled side is a disc, a half-plane or a disc's outside, and it changes continuously as on the Riemann sphere.
- **Yes, the right panel goes.** It becomes the Inspector, whose lower half holds the parameters. This was agreed with
  the desktop designer (`../desktop/INTERFACE.md`).
- **Constructed objects are ordinary shapes** in the left panel's Shapes list. The renderers, the globe and export need
  nothing new.

## 1. Prior art

Each tool below lists what is pleasant (+) and what is painful (−).

**GeoGebra**: an algebra list of every object, tools such as "Circle through 3 points", "Intersect" and
"Point on object", and sliders.
- \+ An object is either free (draggable) or dependent (defined by others). The definition is shown next to the value.
- \+ Typing an unknown name in a formula offers to create a slider for it.
- \+ Tools accept existing points or create new ones on the click.
- − The object list grows long: every click makes a new point (A, B, C, …), and helper objects pile up.
- − Intersection points are chosen by an index ("Intersect(c, d, 2)") and can swap or jump.
- − Properties sit in a heavy dialog.

**Desmos** (graphing calculator; it also has a complex mode, switched on in the graph settings):
- \+ The expression list is the only source of truth. Typing `a` offers "add slider", and the slider row is compact
  (value, range, step, play).
- \+ A point written with variables, such as `(a, b)`, is draggable, and dragging it changes `a` and `b`.
- \+ Lists such as `[1, 2, 3]` turn one formula into a family of curves.
- − There are no named constructions in the calculator. A circle through three points has to be written as a formula.
- − Long lists of expressions need folders.

**Cinderella** (Richter-Gebert and Kortenkamp):
- \+ It works in complex coordinates internally and keeps constructions continuous. When two intersections merge, the
  path goes through the complex plane, so points do not swap.
- \+ It has hyperbolic and spherical geometry modes.
- − It is hard to predict. The result depends on the path taken, and the authors show that the general tracing problem
  is NP-hard.
- − Its interface is old.

**Geometer's Sketchpad**: you select objects, then the Construct menu.
- \+ The menu enables only the constructions that the current selection allows, which makes them easy to discover.
- \+ Parameters can be animated.
- − The rule "select first, then construct" is invisible until you learn it.

**Mathematica `Manipulate` and `Locator`, JSXGraph**:
- \+ Draggable points are bound to variables. JSXGraph's objects accept functions as coordinates, so dependencies are
  just functions.
- − Everything is code.

**Complex-analysis tools** (applets on complex-analysis.com built with GeoGebra or JSXGraph, Desmos' complex mode, and
phase-plot tools):
- \+ Sliders move a parameter of the map and show its effect on fixed lines or grids.
- − None of them combines constructions with exact images under a chain of maps. Lines through two points and circles
  through three points are drawn as polylines, never as exact generalized circles.

## 2. What we take from them

1. **Typing a new name creates a slider** (Desmos, GeoGebra). One undo step and a toast: "Added slider *b*  Undo".
2. **Tools take existing points or make new ones** (GeoGebra). Our existing tools gain this: Line, Segment, Ray, Disc,
   Circle and Arc snap to a point and are bound to it.
3. **Free and constructed points look different.**
   - Free points are filled and draggable, like today's handles.
   - Constructed points are rings and cannot be dragged.
   - Dragging a constructed point says what to drag instead.
4. **Intersections follow a fixed rule, not history.**
   - Along a line: in the line's direction.
   - Two circles: left of the line from centre 1 to centre 2 first.
   - Two lines: the crossing, then ∞.
   - A saved file reopens exactly as it was saved. We do not use Cinderella-style continuation: it is unpredictable
     and NP-hard.
5. **Lists make families** (Desmos): `Re z = k` with `k = [−2 … 2]`. This is phase 3.
6. **The context menu offers only what the current selection allows** (Sketchpad), in the planes' right-click menu.
7. **Keep the list short.**
   - Helper points made by a tool are ordinary shapes, and Hide works on them.
   - We do not add a separate "algebra view": the Shapes list is that list.

## 3. What the app's code says

All of this was read in `work/xr/src` (v14 candidate).

**Shapes** (`region.js`) are plain objects: `{kind, a, b, c, r, p, pts, expr, complement, …}`.
- Handles are set by `Region.setHandle`, and a shape drag already rebuilds the shape every frame at 60 fps.
- A construction can therefore be a shape whose numeric fields are recomputed from its definition. Nothing downstream
  changes.

**Step parameters** (`funcs.js`) are text, evaluated by `Expr.constValue` (complex values), `Number` (int and angle),
`parseCoeffs` and `parseCxList`.
- Giving these a name scope is enough to put shared numbers into every step field. That covers the Möbius *a b c d*,
  the zeros and poles, and the custom *f*.

**The parser** (`parse.js`) rejects unknown letters ("Unknown symbol 'a'"), and the reserved letters are
`z w x y r i e` and `θ`.
- A name scope is a small change: one new token type, and `{t: 'name'}` nodes that are constants while the formula is
  compiled.
- `r` is |z| in region formulas, so it cannot be a parameter name. Use `R` or `ρ`.

**The GPU** (`glsl.js`):
- `genCustom` already turns every z-free subexpression into a uniform.
- A name inside a custom formula is therefore a uniform. The signature (the source text with the name) does not change
  when the value changes, so dragging a slider does not recompile.
- **One exception.** Integer exponents are fixed when the formula compiles (`z^n` takes `cipow` when n is an integer).
  A name in an exponent must either always take the general power or recompile when its value crosses between integer
  and non-integer.

**Equation curves** (`curves.js`): `Curves.fromFormula(ast)` accepts an AST.
- Substituting values and recognizing the result is exact. In the bridge test, `Re z = a`, `Im z = 2a − 1` and
  `|z − P| = a + 2.5` were exact for 101 values each, and agree with the engine.
- It costs about 0.29 ms per curve per slider step, so about 30 such curves fit in a third of a frame.
- A **traced** curve (`Re z³ = a`) costs about 117 ms per value, so it cannot follow a slider live.

**The exact inverse renderer** (`inverse.js`) draws lines, circles, discs and half-planes exactly through the chain.
Constructions produce exactly these kinds, so nothing changes there.

**Saved state.**
- Saved state is `localStorage` JSON (`sanitizeState`).
- Undo snapshots are JSON of shapes, steps and targets (`snap()`).
- There are no share links today. The sound settings say they are kept out of "a shared link", which suggests one is
  planned for GitHub Pages; it would carry the same JSON.

**Right-click** on a plane opens the integral menu of a curve, and a right-drag pans. The desktop designer turns this
into one context menu with groups (object, at this point, constructions).

## 4. Proof of concept: results

Run `node poc/test.js` (54 checks) and `node poc/bridge.test.js` (18 checks, with the app's own modules from the
private copy). Rebuild the demo with `python3 poc/build_demo.py`. All checks pass.

- **Exact orientation**: a float filter, with exact BigInt arithmetic on the doubles near zero.
  - Shewchuk's test (p = 0.5 + k·ulp against (12, 12), (24, 24)): 0 of 576 wrong. The naive formula gets 408 of 576
    wrong.
- **Circle through three points** in the oriented, normalized Hermitian form
  f(z) = A|z − o|² + 2 Re(B̄(z − o)) + C with |B|² − AC = 1:
  - It is exactly a line when the points are exactly collinear, and it passes through ∞.
  - Its filled side changes continuously: disc → half-plane → outside of a disc.
  - With radius 1e8, the signed distance is below 1e−14 at other points of the true circle. The centre–radius form
    is 1000× worse there.
- **Intersections**: line–line (and ∞), line–circle, circle–circle, tangent, missing and concentric cases. Each point
  is on both curves to 1e−14.
- **Graph**:
  - Dragging recomputes only what depends on the change, in a topological order.
  - Cycles are refused with their path ("a would depend on itself: a → S → a").
  - Undefined objects carry their reason ("The curves do not meet here"), and objects built on them say "c is
    undefined".
  - Deleting an object deletes what depends on it.
  - Saving and loading gives identical values.
- **Speed** (CPU time per update, so it is not skewed by the loaded machine):

  | Case | CPU time per update |
  |---|---|
  | Drag a point (796 objects) | 0.03 ms |
  | A slider driving 200 circles | 0.5 ms |
  | 2000 chained formulas, all recomputed | 2.8 ms |

- **App fit** (`bridge.test.js`):
  - Constructed curves and areas are the app's own `line`, `circle`, `halfplane` and `disc` (with `complement`).
  - `Region.levelOf` agrees with the engine's side at 4000 random points per case.
  - `Region.curvesOf` draws them.
- **The demo** (`poc/demo.html`): the app's stylesheet and tokens, in light and dark, with a 2D canvas.
  - You can drag points and sliders, use the construction tools, and type into the Add field (an unknown name becomes
    a slider).
  - The screenshots (`shots/01–10`) show the default scene, dependency highlighting, collinear points making a
    half-plane, clockwise points making the outside of a disc, a slider making intersections undefined, a three-point
    tool in progress, a slider created automatically, dark mode and a phone.

## 5. Risks found

- **Names clash with the language.**
  - Reserved letters cannot be names (z w x y r i e).
  - Implicit products are read letter by letter: `ab` is a·b, never a name "ab". Names are one letter with optional
    digits (a, k, P₁) or a Greek letter (\alpha …).
- **Structure that depends on values** (an integer exponent, an `int` step parameter such as *n* of the n-th root) is
  fixed when the shader compiles.
  - Such parameters snap to integers while dragged.
  - The shader recompiles only when the integer class changes.
- **Traced equations under a slider** cannot be re-traced at 60 fps.
- **Many dependent area shapes** may hit the forward mesh path (chains without an inverse). Each is a mesh rebuild per
  frame, as in a shape drag today. A perf gate unit is needed.
- **History-dependent behaviour** is avoided by design. Nothing in the graph depends on how you got there.

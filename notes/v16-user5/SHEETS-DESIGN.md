# All sheets during the deformation: design (v16.1, user report 2026-10-25)

The user: chain √ then sin (F = sin √z), √ bracketed, Landscape, All sheets on. Today the app draws one surface:
`render3D` sets `sheets = !hv && S.sheets`, so All sheets is off whenever the deformation is open (deform-range
design-math 5.6: "the sheets of G_t change with t"). The user wants to see the two sheets ±sin √z come out of the one
sheet of sin z.

## 1. Which sheets of H_t are drawn

H_t is drawn on **the sheets that become the sheets of F at the end**. Each multivalued piece keeps the sheet number it
has in F's All sheets (the same mixed-radix digits, `Funcs.sheetEval`), and its deformation runs on that sheet:

| piece of F | sheets of F | H_t on sheet m (local cut θ opposite the input at the cell centre) |
|---|---|---|
| n-th root, n ≤ 24 | m = 0 … n−1 | z^s, s = 1 + (1/n − 1)t, on sheet m: z^s e^{2πims} |
| z^α, α = p/q real | m = 0 … q−1 | z^s, s = 1 + (α − 1)t, on sheet m |
| log, z^α irrational or complex, root n > 24 | window m = −W … W (2W + 1, the "sheets ±" select) | log: (z^u e^{2πimu} − 1)/u + u, u = 1 − t; powers as above |
| formula recognised as catalog steps | its steps' pieces | its steps' paths in turn (step j on [j/n, (j+1)/n]), each on its sheet |

- **t = 0**: every piece is the identity, so all its sheets are the same surface (bit for bit): one sheet, sin z.
- **t = end**: every piece is F's piece on sheet m, so the surfaces are F's All sheets, combo for combo.
- **In between**: z^s has infinitely many sheets for irrational s. Only the ones that end as F's are drawn: for √ the
  two sheets m = 0, 1, which become +sin √z and −sin √z. The other sheets of H_t are not drawn (they end on top of
  these: at s = ½ sheet m + 2 equals sheet m). For log-like pieces the window is F's (2W + 1); they leave the one
  sheet z and spread to log z + 2πim.

No extra sheets for roots: drawing a log-like window for √ would end with duplicates on F's two sheets.

## 2. Labels and colour

As F's All sheets today: no per-sheet labels, colour by the value (phase), so ±sin √z read as opposite hues. The probe
draws one needle per drawn sheet. The pane title reads "landscape of Im H_t, all sheets" while the sheets are drawn.

## 3. Cuts and seams

Local cuts as F's All sheets: each cell takes every piece's cut opposite its input at the cell centre, so no cut
crosses a cell, and sheet m meets sheet m + 1 along the ray where the cell centre's argument jumps. At the end the n
sheets of a root close up. In between they do not: z^s on arg (−π, 2πn − π] has a free edge at both ends (the slit
along that ray), and its two sides differ by e^{2πins}; the slit closes as t → 1. That is drawn as it is (no wall).
Single-valued steps whose own path is multivalued in between (z² goes through z^{1+t} on the principal branch) keep
that path's cut, as in the plain landscape today.

## 4. Height

All sheets still switches a modulus height to Im (|sin √z| = |−sin √z|: a modulus height stacks the two sheets).
While deforming, the height is the plain deformation's: the compressed Re / Im (atan) with F's steady median scale, not
the static All sheets' linear height. Reason (seen in the build): with the linear height and F's sheets' scale, H_t
leaves F's range by far (sin z at t = 0 of sin √z reaches Im ≈ 27 on [−4, 4]², F about 2), so the surface met the
linear clamp in vertical walls; the compressed height levels off smoothly and the ± sheets still come apart (atan is
odd). Cost of the choice: at t = end the heights are compressed, and closing the transport switches to the linear
static view (as the plain deformation switches to All sheets today).

## 5. Where it applies

The Landscape only (desktop and phone), and its figure (the art draws the same sheets; the caption says which). Phase,
X → Y and the globes have no All sheets.

## 6. Whole chain, focus, bracket, order

The digits are read for the pieces of the steps the map applies, in chain order (the GPU and the CPU twin agree):

- one after another (map mode 1, step hi at t): the steps before hi in full on their sheets, hi on its sheets at t, the
  steps not begun are not applied (no digits), the post in full;
- all at once (mode 3): the pre in full, every bracketed step at t, the post in full;
- focus k: step k alone from the w_{k−1}-plane;
- bracket a…b: pre and post in full on their sheets.

So the drawn surfaces are a subset of F's at every t and exactly F's at the end. At a node between two steps the
count can grow (step j's sheets start as copies of each other), with no jump in the picture.

**Caps**: the check keeps F's label ("All sheets (24 of 30)"); while deforming at most F's 24 are drawn, the first
24 combos of the pieces applied (lowest digit first, as F's).

**Not drawn as sheets** (the principal branch of H_t, as today; the title drops ", all sheets" and the check's tip says
why): a d/dz among the applied steps; a bracketed formula with branch points that is not recognised as catalog steps
(its path is a zoom or a straight line with no sheet form); the straight-line mode 2.

## 7. GPU and BUDGET60

- `GLChain` gets `chainSheetHom(zc, z, mode, base, a, hi, b, post, t, combo)`, the per-step "how" (full, path at t,
  skip), each multivalued piece's path on its sheet; its CPU twin is `Funcs.sheetMapEval` (same digits, same cuts).
  `Funcs.sheetMapPieces` gives the count and says when a map cannot be drawn as sheets.
- The three sheet programs (heights, surface, probe) call `mapSheet(zc, z, combo)`: mode 0 is today's
  `chainSheetRange` exactly; modes 1 and 3 call `chainSheetHom` with the map's uniforms.
- Cost: the sheet heights are a transform-feedback pass keyed by the map, so while the deformation plays it runs every
  frame (K × (2M)² × 5 evaluations: about 1.0 M points for √'s K = 2, 0.92 M at the cap K = 24 with M = 96), as the
  plain landscape recomputes its heights per t. Measured in `sheets_deform_cmd.js` (desktop and phone emulation); no
  quality is traded for speed.

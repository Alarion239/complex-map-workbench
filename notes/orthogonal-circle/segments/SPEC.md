# Perpendicular circle, "Inside C only": spec (v16.4)

The user, 2026-10-26: "Yes: add an "inside C only" option so a perpendicular circle can be drawn as the arc inside C
(a hyperbolic segment), in v16.4." This is review-user.json user-14 (ledger: deferred).

**In one line:** a per-shape switch on a perpendicular circle K. When it is on, K is drawn as the arc of K on one side
of its curve C. The arc ends exactly on C, at K's two meets with C. Gliders and crossings are restricted to that arc.

- **Base:** `work/xvhs`, a copy of v16.3 (`notes/v16.3-candidate`). Nothing in src was changed for this spec.
- **Evidence:**
  - `proto/check.js` runs the maths of section 2 on the v16.3 core: 8 of 8 pass (`proto/check-output.txt`). Run it
    with `node proto/check.js work/xvhs/src`.
  - `proto/old-versions.js` checks how older cores read a saved switch (section 8).
  - No browser was run: this round is a spec, and src was not changed.
- **Size:** about 200 lines in total, in constr.js, construct.js and region.js, plus 1 line in app.js. There are about 20
  new strings. No change to gl.js, figure.js, sphere.js, tour.js, the perf baselines, `accepted.json` or the golden
  images.

## 0. A word on the name

The arc of K inside C, running from one point of C to the other, is a whole geodesic of the hyperbolic plane modelled
on C's inside. In an article it is a **hyperbolic line** («гиперболическая прямая»). A **hyperbolic segment**
(«гиперболический отрезок») is the part of a line between two points of the plane. Its ends are inside C, never on C.

- The app therefore says "hyperbolic line" in rows and captions. A caption calling the whole arc a "segment" would be
  wrong in an article.
- The glossary has neither term. Add both to `notes/i18n/GLOSSARY.md` with this note. «Область» (the domain the line
  lives in) is already in the glossary: an open connected set (Шабат).
- The true segment z₀z₁ is a small extension of the same machinery: the arc from P to Q. It is the one question for
  the user (section 11).

## 1. Decisions

| question | decision |
|---|---|
| Where the flag lives | `def.seg` on a `perp` shape: absent (the whole curve, as v16.3), `1` or `-1` (the arc on one side of C). It is a per-shape flag, off by default. |
| Default on for the unit circle or the real axis? | **No.** The reasons are below the table. |
| Which side is drawn | The side is stored as a sign against C's form, so it moves continuously with every drag. The words shown ("inside", "above"…) are worked out from the picture each time they are shown (2.2). |
| What is drawn | The arc of K on that side, with its two ends exactly at K ∩ C (2.3, 3). |
| Crossings | Restricted to the drawn arc, as for segments and arcs today: a meet off the arc is undefined ("nomeet"). Intersect(K, C) gives exactly the drawn ends, in either order. |
| Gliders | They live on the arc, with t from 0 to 1 between its ends. Turning the switch on or off, or choosing the other side, moves no glider off the drawn curve (4). |
| Region | Not in v16.4. While the switch is on, K is a curve; choosing Region turns the switch off (5). |
| Images, deformation, globe, export | One open curve, mapped like any other curve. Its ends are exact and drawn with butt caps in export (6). |
| Names | No renaming when the switch flips. A circle made with the switch on is numbered as an Arc (7.5). |
| Where the switch is | The tool's chip (for new circles), the Inspector, and the row's ⋯ menu (7). |
| Old versions | v16.3 draws the whole circle and keeps `seg` when it saves. v16.2 shows the cached arc as a plain arc (8). |

**Why the switch is not on by default for the unit circle or the real axis:**

1. The same two clicks would give an arc or a whole circle depending on which curve was clicked. A drawn circle |z| = 1
   and the picked unit circle would behave differently, and nothing on screen would say why.
2. The tool's name and tooltip promise a circle. Y shows f(K): clipping it by default hides part of the image the user
   did not ask to hide, and mapping is the app's main use.
3. Crossings and gliders are restricted on an arc. Default-on would make Intersect silently miss crossings outside C.
4. v16.3 links and tests (perp_cmd A builds geodesics on the unit circle and expects circles) keep their meaning only
   if the default stays off.
5. The chip's switch stays set for the whole session, as Curve | Region does for 3 points. A disc-model session
   costs one click, once.

## 2. The maths (checked in proto/check.js)

### 2.1 Data

- **Saved:** `def.seg` ∈ {1, −1}, and nothing else.
- **Runtime:** a seg K gets these, none of them saved (`_` prefix):
  - `G.sg = {G: a copy of C's piece form, ends: [e0, e1]}`;
  - `s._seg = {pc, side, ends}`.

  The touching circle's `G.tch` is the model for this.
- **Validate:**
  - keep `seg` only on a `perp` with `seg` = ±1 and `fill` ≠ `'in'`;
  - otherwise delete it, keeping the rest of the shape;
  - Region wins over a crafted `seg` with `fill: 'in'`.

### 2.2 The side

**What the sign means.** `Gc` is the form perp already uses: C's piece form, with the flip of a circle3, perp, touch
or tangent C undone. The drawn arc is where `seg · f_Gc(z) < 0`.

Because the sign is stored against Gc:

- **Use complement on C never moves the arc.** This is the existing rule ("Use complement on C never turns K over")
  extended to the side.
- **When C itself passes through a line** (C a construction), the arc moves continuously. The word for its side
  changes: "inside" becomes "above", then "outside". That is honest, since a line has no inside.

**The side chosen when the switch is turned on** (chip, Inspector or ⋯), in order:

1. C drawn as a region (a disc, a half-plane, a complement, or a Region construction): the side C's region fills.
2. C a circle: the bounded side, its disc.
3. C a line: the side holding P. If P is on C or at ∞, use Q. If both are, use the side above C, or the side to the left
   of C when C is steeper than 45° (|dy| > |dx|).

"On C" uses `onCarrier`'s tolerance, 1e−12 of the figure's size.

**The words.**

- For a circle C: "Inside" when the drawn side is bounded, else "Outside".
- For a line C: "Above" / "Below", or "Left" / "Right" when C is steeper than 45°.

### 2.3 The ends

`ends = meetsOf(K's full piece, C's piece)`. This is the existing rule (the radical-axis path, with the entering
order), in the order K, C.

- K crosses C at right angles, so there are always two meets and their indices never swap (perp SPEC 2). One of
  them is ∞ only when C and K are both lines.
- Measured on 2000 random geodesics of the unit disc: each end is within 1.1e−15 of both curves.
- **Intersect(K, C) gives these same doubles.** In `meetsOf`, a `segAt(pa, pb)` check (like `touchAt`): when one piece
  is a seg K and the other piece's form equals `K.G.sg.G` by value, return the stored ends.
  - In the order (K, C): index i is `ends[i]`.
  - In the order (C, K): index i is `ends[1 − i]`. At a right-angle crossing the entering rule reverses with the order,
    so the indices keep their meaning.
- The check applies only to seg K, so meets on a whole v16.3 K are unchanged.

### 2.4 The arc and its parameter

K's glider map is unchanged from v16.3: z(u) = mR(K anchored at P, sg·|PQ|·tan πu), with period 1 in u. It is anchored
at Q when P = ∞. It is continuous through K's line case (perp SPEC 2).

**The ends' parameters.** u₀ and u₁ are the parameters of the ends: `projectPiece` of each end, or u = ½ for an end at ∞.

**Choosing the arc.** The two arcs are u₀ → u₁ and u₁ → u₀, both taken with u increasing (mod 1).

- Keep the arc whose midpoint in u is on the chosen side. If that midpoint is ∞, test the point at ¼ instead.
- Name the ends so that the arc runs from e_start (t = 0) to e_end (t = 1).
- Δ = (u_end − u_start) mod 1, which is in (0, 1).

**The piece.** K's piece keeps its carrier kind ('circle' | 'line'), its exact G and `c3`. It gains
`seg = {mr, s, sg, u0: u_start, D: Δ, ends}` and has `closed: false`. Every branch that tests `arc3` tests `seg`
first:

- `glide(pc, t)`: t ≤ 0 gives e_start and t ≥ 1 gives e_end, **bitwise**. Otherwise z = mR(…, u_start + tΔ).
- `projectPiece`: v = (u(w) − u_start) mod 1. If v ≤ Δ, t = v/Δ. Otherwise t is the nearer end, measured on the
  sphere.
- `onPiece`: true at the ends (by `eqP`, or within 1e−9 of the arc's size, as `arc3` does) and for v ≤ Δ (with 1e−12).
  The point ∞ is on the piece when its u, ½, is inside the arc.
- `tRange` is [0, 1]. `pieceDist` goes through `projectPiece`; the closed-form circle and line branches must not catch
  a seg piece. `pieceBox` is the carrier's box, or unbounded when the arc passes through ∞.
- `pts3In` returns null for a seg perp, so gliders use the piece's own parameter.

**Shape fields.** These are for code that knows only kinds: hit tests, Preimage packing in gl.js, sphere rays, v16.2.

- `kind: 'arc'` with a = e_start, m = glide(½), b = e_end, when both ends are finite. If glide(½) is ∞, m = glide(¼).
- `kind: 'ray'` with a = the finite end, b = glide(½), when one end is ∞ (C and K both lines).
- `setKind` reports the change from circle to arc or ray, as it already reports circle ↔ line (rows are rebuilt only
  then: v16.3 user-4).

**Proto results (`proto/check.js`).**

| check | result |
|---|---|
| disc model, 2000 random P, Q in \|z\| < 1 | every arc passes through P and Q; 0 of 38,000 interior samples outside the disc; ends within 1.1e−15 of both curves |
| diameter (0.3 + 0.2i, 0.6 + 0.4i; the decimal line case) | K is the line; the ends are ±(0.832…, 0.554…) on \|z\| = 1. The outside side gives the two rays through ∞, with every sample outside |
| half-plane, P = 1 + i, Q = 1 + 2i | K is the vertical line; ends 1 and ∞; t = ½ at 1 + 1.414i |
| P dragged across the diameter (400 steps of 1.8e−4) | a glider at t = 0.3 moves at most 3.8e−4 per step; the ends move at most 2.0e−3 per step, a smooth rate, not a jump |
| Q dragged across the vertical in the half-plane model | glider step at most 2.6e−4; end step on the sphere at most 6.8e−5. One end passes through ∞ |
| P dragged across C (r from 0.9 to 1.1, side fixed) | 0 undefined frames, and the arc stays inside |

## 3. What is drawn

| C | K | the arc on the chosen side |
|---|---|---|
| circle (unit circle, Circle, Disc, 3-point, perp…) | circle | a circular arc, inside: less than a semicircle |
| circle | line (through C's centre) | inside: the chord, a diameter; outside: the two rays through ∞, one curve passing through ∞ |
| line (real axis, Line, polygon side, half-plane edge…) | circle (centre on C) | a semicircle |
| line | line (perpendicular to C) | a ray from the foot to ∞: a vertical geodesic of the half-plane model |
| a piece of a curve (segment, arc, side, sector edge) | any | clipped by the **carrier**, the whole line or circle, not by the piece. The row says so: "on one side of Line 1" |

- **Undefined cases** are those of perp (pencil, coincide, lineInf, notCircle). If the meets ever fail, the shape is
  undefined with the reason `nomeet`. The proto never reached that.
- **Touching circles and tangents** do not get the switch. A horocycle is already inside C, so there is nothing to clip.

## 4. Crossings, gliders, points on the arc

**Crossings** follow the existing rule for pieces: a meet off either piece is undefined. So:

- Intersect on two seg K's finds their hyperbolic crossing.
- Parallel or ultraparallel geodesics have no meet; a meet made earlier becomes undefined with its reason.
- Intersect's hover offers only crossings on the drawn arc (`snapAt` filters by `onPiece`).
- Toggling the switch never changes which crossing a meet is: indices come from the carriers.

**Gliders** have t ∈ [0, 1] from e_start to e_end. They are made by a click on the stroke or "Point on this curve".
Dragging one stops at the ends; `projectPiece` clamps. The Inspector's t reads "0 and 1 at its ends on {c}".

**Remapping when the switch changes.** Each change is one `setDef` call and one undo step.

| change | each glider on K |
|---|---|
| on | keeps its point if it is on the drawn side. Otherwise it goes to its mirror image in C, which is on K, on the drawn arc, because K is its own mirror image in C. |
| Other side | goes to its mirror image in C |
| off | keeps its point; t becomes K's u |

So no glider piles up at an end. The mirror image is z* = c + r²/conj(z − c), or the reflection in a line. It is then
projected onto the piece, so it lies on K exactly.

**P and Q** stay ordinary points. When P is outside the drawn side, the arc does not pass through P, and the caption
says so (6.2).

## 5. The region version: not in v16.4

The hyperbolic half-plane (C's inside on one side of K) is the lens bounded by two orthogonal arcs. It is natural, but
it is a new area kind with two forms:

- region.js: its level, mesh and boundary;
- gl.js: packing two forms for the Preimage and inverse paths;
- sphere.js: its cap test;
- export.

That is not small. In v16.4, Curve | Region and the switch exclude each other:

- choosing Region deletes `seg`;
- turning the switch on sets `fill: 'none'`.

## 6. Images, deformation, globe, export

### 6.1 Drawing

`Region.curvesOf(s)` gets one branch at its top: `if (s._seg && Constr) return [Constr.segCurve(s._seg, win)]`, an
open curve object:

- `f(x)`: `glide(pc, x)` as a complex number, NaN at ∞, as `mrCurve` does;
- `closed: false`, `cap: 'butt'`;
- `gsamp(w, step)`: the samples in the piece's τ, dense (step px) within 1.25× the window and geometric beyond, with
  `sampleMR`'s step logic.
  - The first and last samples are e_start and e_end bitwise.
  - An arc through ∞ (the two rays, or the vertical ray) is broken there by a NaN pair, so the chord is never drawn.

Everything that draws through curvesOf then draws the arc, with no other change:

- X (the 2D canvas);
- the hover and selection glow, and Select's hit test (`hitTest` walks curvesOf);
- Y images through `mapCurve` (the image of an arc piece: an open curve from F(e_start) to F(e_end));
- the deformation paths and the globe (curvesOf samples; ∞ goes to the north pole);
- export (figure.js already honours `c.cap`). On screen the round cap stays: it reaches half a stroke past C's
  centre line, under C's own stroke.

**Preimage mode.** A seg K in Y is packed by gl.js from its kind's fields: arc (15) or ray (13). That is right in every
case but one: the two-rays case (outside, K through C's centre) is drawn there as its chord. This is a known limit. It
needs a Y target, the outside side and the diameter case all at once.

### 6.2 Captions (`Construct.phrase`)

The perp branch gets a seg case first. Templates:

- `cap.seg`: "the hyperbolic line through {a} and {b} in the domain {r}". This is used when both P and Q are finite
  and on the drawn side or on C.
- `cap.seg_on`: "the hyperbolic line in the domain {r} on {k}". This is used otherwise, since the line then passes
  through neither point, only their mirror images.

The slots:

- **{r}** is maths, built directly so it stays open and strict (shapePhrase would turn < into ≤ for areas):
  - inside a circle C: `K.disc.tex` of {c, r}, giving `|z|<1`;
  - outside a circle C: the same with `>`;
  - a line C: `K.halfplane.tex` of a half-plane whose left is the drawn side, for example `\operatorname{Im} z>0`.
- **{k}** is K's whole-curve caption in the genitive: `A.capPhrase` of a copy of K with `seg` removed and kind
  circle or line.

Examples:

- "…the hyperbolic line through $z_0=0.3+0.2i$ and $z_1$ in the domain $|z|<1$";
- «гиперболическая прямая в области $\operatorname{Im} z>0$, проходящая через $z_0$ и $z_1$».

## 7. Where the switch is

### 7.1 The tool's chip (new circles)

- After the tool name there is a segmented control `[Whole | Inside]`, as circle3's Curve | Region. Module variable
  `segMode`: the session's choice, `'whole'` by default, never saved.
- On a narrow pane or on touch it shows two 16 px icons, with their names as labels:
  - Whole: `<path d="M0.254 16A8 8 0 0 1 15.746 16"/>` over a thin `<circle cx="8" cy="8" r="6" stroke-opacity=".45"/>`;
  - Inside: the same circle, with `<path d="M3.2 11.6A8 8 0 0 1 12.8 11.6"/>`.

  The arc's centre is (8, 18) and its radius 8, so it is orthogonal to the circle (10² = 6² + 8²). The end points
  (3.2, 11.6) and (12.8, 11.6) lie exactly on both curves.
- "Inside" makes K with `seg` by 2.2. For a line C, that is P's side.
- The dashed preview draws what the click will make: the arc from the same sampler, not the whole circle.
- The tile's tooltip is unchanged. The control's tooltip explains it (section 9).

### 7.2 The Inspector's construction view

- When `fill` is none, a second segmented control goes under Curve | Region: `[Whole | Inside | Outside]` for a circle
  C, or `[Whole | Above | Below]` / `[Whole | Left | Right]` for a line C. The button that is on is the side drawn now.
- The definition text stays the long perp form.

### 7.3 The row's ⋯ menu

| state | items |
|---|---|
| off | "Inside {c} only" (circle C) or "One side of {c} only" (line C) |
| on | "Other side" and "Whole circle" |

The Region item turns the switch off (5).

### 7.4 Rows (short form, the curve first, user-10)

- "hyperbolic line inside {c}, through {a} and {b}";
- "… outside {c}, …";
- "… on one side of {c}, …" for a line C.

When C is a region, {c} names its boundary, as the user-13 fix does.

### 7.5 Names

- `nameKind`, in app.js and in construct.js: a perp with `seg` is named by `def.nk`, as when it is whole. So the switch
  renames nothing, and the shapes after it are not renumbered.
- A circle made with the chip on Inside gets `nk: 'arc'` and is named "Arc n".

Not changed: the plane menu (its "Point on this curve" already works on the arc), the palette, the tour and the guide.

## 8. Saving and links

- `def.seg` is saved in the def. Runtime data is not saved. The cached fields (kind arc or ray, with a, m, b) are
  overwritten by the first recompute.
- Reload and links are bitwise, as for perp.
- **v16.3** (`notes/v16.3-candidate`) opens such a link as the whole circle. Its validate keeps unknown def keys, so a
  save from v16.3 keeps `seg`. It shows no toast.
- **v16.2** frees K and keeps its cached fields, so it shows a plain Arc (or Ray) at the same place.

Both behaviours were checked on the frozen cores (`proto/old-versions.js`, output in `proto/old-versions-output.txt`):

- **v16.3:** `freed: 0`, `seg: 1` kept, and K recomputed to the whole circle (kind circle).
- **v16.2:** `freed: 1`, and K stays kind arc.

## 9. Strings (`notes/i18n/ru/v164-segments.json`; `make_ru_table.py --strict`, 0 unresolved)

**Wiring.** The file is read with an allow-list (`V164_SEG_HERE`), like `V161_HERE`. Russian rows put names after a
colon [C26]. A dash after a word gets a no-break space before it.

**Capacity.** The control's Russian labels («Целиком», «Снаружи») fit a 360 px Inspector, checked in D.

| id | English | Russian | note |
|---|---|---|---|
| side.whole | Whole | Целиком | control, chip (ctx side) |
| side.in | Inside | Внутри | control, chip (ctx side) |
| side.out | Outside | Снаружи | control (ctx side) |
| side.above / side.below | Above / Below | Выше / Ниже | control, line C (ctx side) |
| side.left / side.right | Left / Right | Слева / Справа | control, steep line C (ctx side) |
| chip.seg_group | Whole or inside | Целиком или внутри | aria-label of the chip control |
| chip.seg_tip | Inside: only the arc inside the curve (for a line, on the first point's side) | Внутри: только дуга внутри кривой (для прямой — со стороны первой точки) | control tooltip |
| menu.seg_in | Inside {c} only | Только внутри кривой: {c} | ⋯ [C26] |
| menu.seg_side | One side of {c} only | Только по одну сторону от кривой: {c} | ⋯ |
| menu.seg_other | Other side | Другая сторона | ⋯ |
| menu.seg_whole | Whole circle | Окружность целиком | ⋯ |
| row.seg_in | hyperbolic line inside {c}, through {a} and {b} | гиперболическая прямая внутри кривой: {c}; через {a} и {b} | row (a, b: ctx acc) |
| row.seg_out | hyperbolic line outside {c}, through {a} and {b} | гиперболическая прямая вне кривой: {c}; через {a} и {b} | row |
| row.seg_side | hyperbolic line on one side of {c}, through {a} and {b} | гиперболическая прямая по одну сторону от кривой: {c}; через {a} и {b} | row, line C |
| insp.seg_t | 0 and 1 at its ends on {c} | 0 и 1 — концы на кривой: {c} | Inspector t (no-break space before the dash) |
| cap.seg | the hyperbolic line through {a} and {b} in the domain {r} | гиперболическая прямая в области {r}, проходящая через {a} и {b} | caption ({r}: maths) |
| cap.seg_on | the hyperbolic line in the domain {r} on {k} | гиперболическая прямая в области {r}, лежащая на {k} | caption. {k} is K's caption in the genitive, which equals the prepositional for «окружности, проходящей…» and «прямой, проходящей…» |
| cap.seg.gen | (as cap.seg) | гиперболической прямой в области {r}, проходящей через {a} и {b} | ctx gen |
| cap.seg_on.gen | (as cap.seg_on) | гиперболической прямой в области {r}, лежащей на {k} | ctx gen |

That is 19 English strings and 21 Russian entries (2 genitive forms).

## 10. Files

| file | change |
|---|---|
| `src/constr.js` | about +80 lines. The parts: validate `seg`; the perp branch: Gc, the ends, the side, the piece data, `G.sg`, the fields; `pieces` (seg piece); `segAt` in `meetsOf`; the seg branches of `glide`, `projectPiece`, `onPiece`, `tRange`, `pieceDist`, `pieceBox`; `pts3In` returns null for seg; `segCurve` and `segSample`; `describe` has `seg`. |
| `src/region.js` | about +5 lines: curvesOf's first branch. hitTest and the globe follow from it. |
| `src/construct.js` | about +110 lines: the chip control and `segMode`; finish (`seg`, `nk: 'arc'`); the preview; Inspector; rowMenu; `setSeg(s, v)` with the glider remap; setFill; defText rows; phrase; tMeaning; `nameKind`. |
| `src/app.js` | 1 line: `nameKind` keeps `nk` for a seg perp (kind arc or ray). |
| `notes/i18n/ru/v164-segments.json`, `tools/make_ru_table.py`, `src/i18n_ru.js` | section 9. Regenerate the table; no existing entry may change. |
| `test/constr_seg_tests.js`, `test/t_constr.js` | section G (11) |
| `test/perp_cmd.js` | section I (11) |

## 11. Tests

### `test/constr_seg_tests.js` (section G of `node test/t_constr.js`)

**Core:** proto/check.js's 8 checks, in the house style, with these thresholds:

- the ends within 4e−15 of both curves;
- 0 interior samples off the side;
- glider and end continuity through K's line case and through ∞ (chordal);
- P across C with no undefined frame.

**Plus:**

- **Intersect(K, C):** bitwise equal to the drawn ends in both orders, with index i ↔ 1 − i reversed.
- **Restriction:** a line through the disc that crosses K outside it gives `nomeet`. Two crossing geodesics meet inside.
  Ultraparallel ones give `nomeet`.
- **Sides:** for every case in section 3, check each side, and that glide(0) and glide(1) are the ends bitwise.
  - Use complement on C (v15 complement, and a circle3's flip) leaves the arc in place.
  - C a perp through its own line case: the arc is continuous, and the side word changes.
- **Remap:**
  - on: a glider outside goes to its mirror image, on the arc;
  - Other side: every glider goes to its mirror image;
  - off: points kept;
  - one undo step each.
- **Plumbing:**
  - save, load and recompute are bitwise;
  - validate drops bad `seg`, and drops `seg` together with `fill: 'in'`;
  - v16.3's validate (from `notes/v16.3-candidate/src/constr.js`) keeps `seg` and recomputes a whole circle;
  - `describe` has `seg`;
  - a seg K adds at most 10 µs per recompute.

### `test/perp_cmd.js`, new section I (its own `cdp_kit` copy, port 0, one browser)

1. **Disc scene, desktop 1440, light, English.**
   - Chip Inside, then pick the unit circle and make 3 geodesics. Check:
     - no K pixel more than half a stroke outside |z| = 1, sampled along each carrier outside the disc;
     - the hooks' ends equal Intersect points bitwise;
     - the rows read "hyperbolic line inside Circle 1, through z₀ and z₁". Rows name the fixed unit circle Circle 1
       (ledger user-1).
   - Drag z₀ over 20 frames through the diameter: no undefined frame, and the arc stays inside.
2. **Inspector and ⋯.**
   - Whole / Inside / Outside each toggle in one undo step, and so does Other side.
   - Region turns the switch off.
   - A glider on the arc stops at the ends.
   - Intersect on two crossing geodesics makes a point. Moving one geodesic so they no longer cross makes the point
     undefined, with its reason.
3. **Half-plane.** Pick the real axis and make a semicircle. Then P = 1 + i, Q = 1 + 2i gives the vertical ray, drawn
   above the axis up to the pane's edge.
4. **Y and the globe.** The image under 1/z is an open arc from F(e_start) to F(e_end). The globe draws the arc only.
5. **Export, English and Russian.**
   - The SVG path of K starts and ends at e_start and e_end (to 1e−9 in the figure's coordinates), with
     stroke-linecap butt.
   - The captions match cap.seg and cap.seg_on.
6. **Links.**
   - Reload is bitwise.
   - The v16.3 dist opens the link with whole circles and no console error.
   - The v16.2 dist shows plain arcs.
7. **Layouts.**
   - Dark mode.
   - Russian: the chip, the control, the rows and the ⋯ items.
   - Phone 390 × 844, Android Chrome user agent: the chip's icons and the Inspector control fit at 360 px.
   - Tablet 768.
8. **Speed (F's harness).** Drag P with 10 seg dependents, with 1/z in Y: BUDGET60 (frame p95 ≤ 16.7 ms), and rAF work
   no worse than the whole-circle run by more than 1 ms.
9. **Screenshots** to `notes/orthogonal-circle/segments/shots/`: disc and half-plane, light and dark, English and
   Russian, phone.

### The existing gate, unchanged

perp_cmd A–H, touch_cmd, constr_cmd, fix163_cmd, i18n_cmd, tour_cmd, the v15 files, export_cmd and the quality suite.
The goldens must not change.

## 12. Not built (ask the user)

- **The hyperbolic segment z₀z₁** (the arc of K between P and Q, both inside C). This is the one question for the user,
  in one line: "Also offer 'Between z₀ and z₁' (the true hyperbolic segment)?" It reuses section 2 with the ends P and
  Q instead of K ∩ C. It is undefined when P and Q are on opposite sides of C.
- **The hyperbolic half-plane** (section 5).
- **The same switch for 3-point circles, touching circles and tangents.**

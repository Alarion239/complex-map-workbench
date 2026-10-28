# Snapping and railing of points (v16.5 wave 1, piece "rail")

What the user asked (2026-10-26): points snap to the grid and to figures; a point is easy to put on the unit circle,
then slides round it, and a hard drag pulls it off to move freely; and the Perpendicular circle must accept two
points of one circle ("It says needs distinct points, but I do have distinct points!").

This spec is built in `work/xu1-rail` on top of the v16.4 merge snapshot. It changes the v16 rules C16b and C22
(notes/constructions-v16/SPEC.md 4.1 and 4.3) on purpose; every other v16 rule stays.

## 0. What happens today (reproduced in headless Chrome, laptop 1366 × 768 and phone 412 × 860 with touch)

Scripts and pictures: `notes/ux-build/rail/today/` (r2.js, r3.js, m2.js, m3.js and three PNGs).

| # | Steps | Result | Root cause |
|---|---|---|---|
| T1 | Point tool, click 2 px off the shown unit circle (laptop); tap exactly on it (phone) | A free point. It is not on the circle; dragging it moves it anywhere | `snapAt` only sees shapes. The unit circle and the axes are curve targets only for the Perpendicular and Touching circle's first pick (`perpCurveAt`) |
| T2 | Orthogonal, pick the unit circle, then two points on it | Two **free** points that happen to lie on the circle (no `def`). Move one and it leaves C | Same: a pick on a display curve is a free pick |
| T3 | Same tool again (C is now the shape "unit"): pick at 250°, then at 300° | Second pick refused: "Perpendicular circle needs distinct points" | `refKey({s, part})` = `c:<shape>:<part>`, so every pick on one curve has the same key |
| T4 | 3 points, picks on one circle at 20°, 60°, 120° | 60° and 120° refused the same way | Same |
| T5 | (node) `refKey` of any crossing pick | `s:undefined` for every crossing, so two **different** crossings are refused too | A meet ref `{meet, index, seed}` has no branch in `refKey` |
| T6 | Select, drag a point on Circle 1 150 px away | Stays on the circle at the projection. No way to pull it off except ⋯ Make free | `moveDrag` glider branch has no exit |
| T7 | Drag a free point to 3 px from the grid point 2.5 + 1.5i | Lands at 2.5577 + 1.4615i: moves never snap (UX94) | The 'move' branch translates by the raw delta |
| T8 | Drop a free point on Circle 1 | Stays free beside it (C22) | By design in v16 |
| T9 | Default zoom (52 px per unit): the grid draws lines every 0.5 | The Point tool snaps to whole numbers only | `snapZ` steps 1, 5, 10 … × d0; the drawn grid (gl.js `TIER_M`) also has the 0.5 × d0 tier |
| T10 | (node) Orthogonal through two points of the unit circle at t and t + ½ | A circle of radius 1.6e16, named Circle, not the diameter | Gliders at t and t + ½ are not exact antipodes (cos/sin of 2πt), so the decimal rule [math-3] misses |

The exact BigInt path is sound when P or Q lies on C (section 3.3); only the antipodal case needs a fix.

## 1. What points snap to

### 1.1 Classes, in priority order

The first class with a target inside its radius wins; inside a class the nearest target wins. Radii are screen px.

| # | Class | Targets | Mouse | Touch |
|---|---|---|---|---|
| 1 | points | point shapes; position handles of other shapes; zeros and poles of f₁ (X at stage 0); F(z₀) in Y when Y shows the whole chain; **a construction's pending picks** (new, 3.2); N (∞) on an editable globe for 3 points | 8 | 22 |
| 2 | crossings | two curves near the pointer, found locally (C28), **including a display curve with a drawn curve**. Two display curves crossing (0, ±1, ±i) are not a crossing target: the nearer display curve takes the press and its detent puts the point exactly there (1.4) | 8 | 22 |
| 3 | curves | drawn curves and the edges of regions (lines, rays, segments, circles, arcs, polygon and rectangle sides, the boundaries of discs, half-planes, annuli, sectors; freehand and formula curves keep today's traced gliders), and **the display curves: the unit circle when the pane draws it, the real and the imaginary axis** | 6 | **14** (was 10) |
| 4 | grid | the lattice of the finest drawn grid tier (1.3) | 9 | **12** (was 9) |

Why this order: a point you can see is what you meant when you press on it; a crossing is a point too; a curve is a
line of possible points; the grid is the weakest wish ("a nice number"). It is today's order (SPEC 4.1) with the
display curves added to classes 2 and 3 and the grid made a class of the same search, so one ring shows whatever won.

Why 14 px on touch: a fingertip lands within about ±2 mm (±13 px on a 412 px Android screen); 10 px missed the unit
circle on most taps. 14 px still leaves a free gap between curves 40 px apart, and it stays under the 18 px a finger
gets to select a curve (the plane piece's UX09), so selecting stays easier than attaching. The grid gets 12 px on
touch for the same reason.

A **display curve is made a shape on use**, in the same undo step, exactly as `perpCurveAt` does today: the shape
`{kind: 'circle', c: [0, 0], r: 1, fixed: 'unit'}`, `{kind: 'line', a: [0,0], b: [1,0], fixed: 'real'}` or
`{… b: [0,1], fixed: 'imag'}`. If that plane already holds a shape with the same `fixed` value (visible or hidden),
it is reused, never duplicated. Nothing is made on hover (newShape spends an id).

### 1.2 Who uses which class

| Gesture | points | crossings | curves | grid | Snap off | Alt (laptop) |
|---|---|---|---|---|---|---|
| Point tool press | an existing point is selected, nothing new (today); a zero or handle binds `at.p` (today) | meet point | point on the curve (glider) | free point on the lattice | free point, raw | free point, raw |
| Construction pick | yes | yes (meet point at finish) | yes (glider at finish) | free pick on the lattice | points, crossings and curves stay (picking them is the tool's job); no grid | no snapping at all |
| Drawing tool handle, press and release (C19) | bind | helper meet point | **no** (C16a kept: a segment's end never becomes a hidden glider) | yes | raw | raw |
| Dragging a handle of a shape | bind at release | helper meet | no | yes | raw | raw |
| Dragging a free point (**new**) | a point shape: warn ring "z₂ is already here", no snap (no merging, C22 kept for points); a zero or handle: binds `at.p` at the drop | becomes the meet point at the drop | becomes a glider at the drop (attach) | yes | raw, never attaches | raw, never attaches |
| Dragging a point on a curve | the rail (section 2); after it lets go, as a free point | | | | the rail stays (it is the point's definition); no detents | frees it at once (2.4) |
| Moving a whole shape (**new**, UX94) | its anchor snaps (below), never binds | anchor | no | anchor | raw | raw |

The **anchor** of a moved shape is its position handle (`a`, `b`, `c`, `m`, `p`, `vN`) nearest the press. The shape
translates by the anchor's snapped offset, so "the corner you grabbed lands on 1 + i". A move never binds (binding is
for handles, which say so with a ring).

**X and Y.** Identical rules on each pane's own list (shapes in X, targets in Y), with Y's own display curves. In Y the
points class also offers F(z₀) (C23, unchanged).

**The sphere.** Classes 1 and 4 as today (`gSnap`: points 8 px, the marks 0, ±1, ±i, ∞ 10 px, the lifted lattice or
the polar net). New on the sphere: (a) the distinct-pick fix (3.2) in `globeClick`; (b) a point on a curve dragged on
the globe slides on its rail: project the globe pick `g.z` with `projectPiece`, measure the pull with `gScreen`, same
thresholds; (c) the Point tool on a drawn curve uses `globeCurveHit(gc, s, x, y, 6 | 14)` then the projection of `g.z`
(a glider). Display curves are not curve targets on the sphere (they are the graticule there). If (c) does not fit the
time box it is listed as not done; (a) and (b) are required. The build first checks what a glider drag on the globe
does today (`gmove` rotates `s.p`; recompute may put it back from `t`).

### 1.3 The grid lattice

`snapZ(pane, z)` keeps its signature. The step is the finest tier of the drawn grid that is at least 14 px apart:

```
d0   = 10 ^ ceil(log10(8 / s))                 // as gl.js drawGrid and snapZ today
step = first of [0.5, 1, 5, 10, 50, 100] × d0 with step × s ≥ 14   // gl.js TIER_M: the drawn tiers, halves included
```

At the default 52 px per unit the step becomes 0.5 (26 px), matching the lines the user sees; at 520 px per unit it is
0.05 (26 px). Snap within 9 px (mouse) or 12 px (touch) of the lattice point, both coordinates at once (a lattice
point, never a single grid line: per-line snapping would catch almost every press and make the chip chatter). The
value is rounded with `toPrecision(12)` as today, so "0.5" is the decimal 0.5 that [math-3] and the exact path read.
The globe's Cartesian net (`gSnap` role 'cart') uses the same tier list. One shared `Constr.gridStep(s)` serves both.

### 1.4 Detents on a rail

While a point slides on a curve, or is placed on one, and Snap is on and Alt is not held, the parameter catches at
these places within 6 px (mouse) or 10 px (touch) along the rail, nearest first:

1. the rail's crossings with other visible curves (the point stays a glider; it only stops there);
2. the rail's own defining points and handles (a segment's ends, a 3-point circle's points);
3. on a plain circle or arc (a piece with no `pts3`/`c3`): every 15° measured from the centre's +x direction,
   t = k/24 turn (for an arc, t = (θₖ − a0)/span); on the unit circle centred at 0 the quarter turns give 1, i, −1, −i
   exactly (3.4);
4. on a line, ray or segment: the lattice points of 1.3 that lie on the carrier (|f| ≤ 1e−9 × step).

Why: "put it at i, then at 30°" is what a teacher does on the unit circle; without detents the parameter is a float
of the pointer and exact positions (the diameter, a right angle) never happen. Detents on a 3-point or perpendicular
circle are only 1 and 2: their parameter is a Möbius one, not an angle.

## 2. Railing

### 2.1 Placing

A Point tool press, a construction pick, a long-press menu "Point on this curve", or a drop (2.5) on a curve within
the curve radius makes a glider: `{op: 'glider', args: [{s, part}]}` with `t` (or `seed` on a traced curve), exactly
on the curve, the detents of 1.4 applied. On a display curve the curve shape is made first (1.1). One undo step.

### 2.2 Sliding

Dragging a glider sets t to the projection of the pointer onto its piece (`Constr.projectPiece`, as `moveDrag` does
now, one recompute per frame through `glideFlush`). It wraps on closed curves and slides round polygon corners
(today). A line's glider on the plane stays finite (the pointer never reaches ∞); a 3-point or perpendicular circle
that is a line keeps its Möbius parameter, so its glider passes through ∞ on the sphere, where the pointer can reach
N. A glider whose t is bound to a shared number (`bind.t`) does not slide (today) and never detaches: the chip says
"z₂ follows a: change a".

While sliding: the rail is drawn wide and faint (the `drawSources` style: 6 px, the curve's ink at 25 %), the chip
"on the unit circle" or, at a detent, "on the unit circle at i" / "on Circle 1 at 30°" (4.2).

### 2.3 Pulling it off: the rule

Let d be the distance in screen px from the pointer to the rail (`pieceDist × s`, or `gScreen` on the sphere).

| Zone | Mouse | Touch | What happens |
|---|---|---|---|
| glide | d < 16 | d < 24 | the point slides; nothing else |
| stretch | 16 ≤ d < 40 | 24 ≤ d < 64 | the point stays on the rail at the projection; a stretch line from it to the pointer; a hollow ghost dot at the pointer; chip "Pull further to free z₂" |
| let go | d ≥ 40 for 120 ms in a row, or d ≥ 80 at once | d ≥ 64 for 120 ms, or d ≥ 128 at once | the point becomes free at the pointer |

Why distance with a short dwell: "drag it hard" means away from the curve, and distance is what the hand controls.
A fast sweep that cuts across a circle (on the way to the other side) reaches 40 px for well under 120 ms and does not
free the point; a deliberate pull holds that long without trying. A yank twice as far frees at once, so the rule
never feels sticky. On a small circle (screen radius under 40 px) the inside is never far enough: you pull outward,
which is the natural direction anyway. The touch numbers are larger because the finger hides the point and wobbles;
64 px is still under a sixth of a phone's width. Release inside the stretch zone: the point stays on the rail where
it is (no change if it did not slide).

Pure function, node-tested: `Constr.railPull(state, d, now, touch) → {zone, state}` with the constants in one table
`RAIL = {mouse: {glide: 16, free: 40, yank: 80}, touch: {glide: 24, free: 64, yank: 128}, dwell: 120}`.

### 2.4 Letting go, and after

- At the let-go: the point keeps its id, name, colour and dependents; its `def` (and `seed`) is removed as
  `api.cm.makeFree` does, but **live** (no commit: `cmGesture` is set for the drag), and it jumps to the pointer.
- The sign: the stretch line and the rail highlight go; the chip "z₂ is free" sits by the point for 1.2 s; the sound
  `detach` plays (4.4). No animation, so reduced motion needs nothing.
- From then on the drag is a free point's drag (1.2): grid, crossings, curves, warn on points. Coming back near the
  old rail and dropping there attaches it again (that is the user's way to undo a pull mid-gesture).
- **Alt** (laptop): held at the press, the drag is free from its first move (no stretch, no detents, no snapping,
  no attach at the drop). Pressed during the drag, it frees the point at once. Released before the drop, the drop
  snaps again. Touch has no Alt: the pull is the way, and Snap off (the tools sheet) stops every attach.
- **Meet points made by a snap or the Point tool, and Intersect's points**, follow the same pull rule: their rail is
  one position, so they never slide; the stretch shows from the first px past 16 / 24, and the let-go frees them
  (a helper keeps its owner's binding, which now follows the free point). Midpoints, bisectors and the other built
  points do not come off: "z₃ is built from z₀, z₁: drag those" stays.

### 2.5 Dropping on a curve, a crossing or a point (attach)

At the release of a free point's drag (one that started free, or was freed in this gesture), with Snap on and no Alt:

- on a crossing (class 2): it becomes that meet point (`def: {op: 'meet', args, index | seed}`);
- on a curve (class 3): it becomes a glider there (`setDef` with `{def, t | seed}`); a display curve is made first;
- on a zero or another shape's handle: it binds `at.p` (as the Point tool's press does);
- on a point shape: nothing (warn ring during the drag: "z₂ is already here"); it lands on the grid or raw.

Curves and crossings built on the point itself, and its co-arguments, are excluded from its targets
(`graph().excluded(id)` and `Constr.wouldCycle`), so a point never attaches to a circle that passes through it by
construction. The ring and chip show the target during the drag, and the point is drawn at the snapped place, so
what you see before you let go is what you get. Sound `attach` at the drop.

### 2.6 Undo, and what follows the point

- One undo step per gesture, whatever happened in it (slide, detents, let-go, attach, a made display curve). The
  drag runs under `cmGesture`; the release commits once (`onUp` already commits a moved point). A gesture that ends
  where it started, with the same `def`, makes no step.
- Esc during a drag, or a second finger landing on the plane (D9), restores the state at the press (point, `def`,
  `t`) and makes no step.
- Everything built on the point follows live, during the drag, as it does for a free point today: the id never
  changes, only `def`/`t`/`p`. BUDGET60 holds: the per-frame work is the projection, one recompute (as today), and
  two strokes in the overlay.
- ⋯ **Make free** and **Put on this curve** stay as they are (and gain the display curves through `snapAt`).

## 3. "Needs distinct points"

### 3.1 Root cause

`click`, `globeClick`, `hover` and `touchTarget` refuse a pick when `Constr.refKey(pick.ref)` equals an earlier
pick's. That is right for picks of points that exist (z₀ twice). It is wrong for picks that will **become new
points** at the finish:

- a curve pick (`{s, part}`) keys as `c:<s>:<part>`, so two different places on Circle 1 are "the same point" (T3, T4);
- a crossing pick (`{meet, index, seed}`) keys as `s:undefined`, so any two crossings are "the same point" (T5);
- a free pick has no ref and is never compared, so two free picks on one spot pass and make an undefined circle.

### 3.2 The fix

One function in construct.js, used by all four sites (and by any later tool, such as the plane piece's UX55
Hyperbolic line, whose `pickWarn` lines must route through it at the merge):

```
samePick(a, b):
  both picks of existing points (cls 'point', ref present)  -> refKey(a.ref) === refKey(b.ref)
  otherwise (one of them makes a new point)                  -> never the same here; see pending picks below
```

and **pending picks become point targets** (class 1) while the draft is open, with the ref `{pend: i}`
(`refKey` → `pend:i`). A press within the point radius of an earlier pick therefore snaps to it, the ring lands on
it in the warn colour and the chip says "Orthogonal needs distinct points": the refusal happens exactly when you
press where you already picked, and never because two places share a curve. Two different places on one curve are
always accepted.

`refKey` also gets a real key for a meet ref, so it is never `s:undefined` anywhere (dragRoots dedupe too):
`m:` + the two curve keys sorted + `:` + (`index` or the seed rounded to 12 digits).

### 3.3 The maths, construction by construction (checked in node with constr.js, `today/m2.js`, `today/m3.js`)

| Construction | Picks on one curve C | Result today, once allowed | Correct? |
|---|---|---|---|
| Perpendicular circle (and UX55 Hyperbolic line) | P, Q on C | the circle through P and Q orthogonal to C; for the unit circle, tangent to OP at P and to OQ at Q (t = 0.1, 0.3: c = 0.381966 + 1.17557i, r = 0.726543, \|c\|² = 1 + r², (c − P)·P = 0) | yes |
| same | P, Q opposite (t, t + ½) | a circle of radius ≈ 1e16 instead of the diameter (T10) | **no**: 3.4 |
| same, Inside C only (seg ±1) | P, Q on C | the arc of K inside C, ends P and Q | yes |
| Touching circle | T and P both on C | C itself (the model); the tool already refuses "Click a point off C." | yes, keep the refusal |
| 3 points | three points of C | C itself (c = 0, r = 1 bitwise for the unit circle in the test) | yes, allowed: harmless and exact |
| 3 points / a line drawn with both ends on one line | points of one line | the line itself (collinear by incidence: `incOf` follows gliders) | yes |
| Midpoint, Bisector | two points of C | the chord's midpoint and bisector (through C's centre) | yes |
| Intersect | the same curve twice | ignored (a curve does not meet itself) | yes, keep |
| any | two different crossings | allowed after 3.2 | yes |

**P or Q on C, the exact path.** `perpForm` anchors C at P: C₁ = f_C(P), which is 0 when P is exactly on C and tiny
otherwise (a glider's floats). With C₁ = 0 the formula gives B_K ∝ J·B₁, the normal of K along C's tangent at P, so
K is orthogonal to C at P and passes through P: the right circle. The pencil branch (A = B = 0) needs Q = P*, and P* = P
for P on C, so it can only mean Q = P, which `eqP` catches first as "coincide". The decimal pencil test
(`(P − c)·(Q − c) = r²`, collinear) needs |Q − c| = r on the same ray, that is Q = P again. Nothing fails; no change.

### 3.4 The antipodal fix

Two independent causes, two small fixes, both in constr.js:

1. **Antipodes by construction** (required). In `evalNode` for `perp`: when both point args are gliders on C's own
   piece (`args[1]`, `args[2]` resolve to shapes with `def.op === 'glider'` and `def.args[0]` equal to `args[0]`), the
   piece is a plain circle (no `pts3`/`c3`, its t is a turn fraction), and |frac(t_Q − t_P) − ½| ≤ 2⁻⁴⁰, then K is the
   line through C's centre and P (A = 0, unit normal J(P − o)/|P − o|, anchored at o), oriented by today's rule
   (the left side of P → Q). Reason: the parameters say "half a turn apart" by construction; for |Δ − ½| = ε the true
   K has radius about r/(πε) ≈ 3.5e11 r at ε = 2⁻⁴⁰, whose sagitta over C is 1e−12 r: the diameter is the same picture
   at every zoom the app reaches, and it is the circle the user means. With the detents of 1.4 (k/24 and (k + 12)/24)
   this is the path that fires; m3.js shows those parameters are not bitwise antipodes.
2. **Turn-exact glide** (recommended). `glide` on a plain circle computes (cos 2πu, sin 2πu) by reducing u to a half
   turn and a quarter turn first: exact (1, 0), (0, 1), (−1, 0), (0, −1) at u = 0, ¼, ½, ¾, and the half-turn partner
   is the bitwise negation. Then a detent at i is exactly i (the chip can say "at i"), and on the unit circle at 0 the
   existing decimal rule [math-3] sees bitwise antipodes and gives the line by itself (m3.js: LINE for four cases).
   Saved gliders move by at most 1 ulp: no golden should change; the build checks the goldens and lists any change.

## 4. Feedback and words

### 4.1 Pictures (light and dark use the existing tokens: `TH.accent`, `TH.warn`, `TH.halo`, `TH.surface`, `TH.line`)

- **Snap ring** (today): r = 11 (13 on touch), accent, halo, 14 % fill; warn colour for a refusal. Grid snaps get a
  smaller ring, r = 7, no fill, 1.25 px accent, so a grid catch reads as lighter than a figure.
- **Rail** while a point slides: the curve redrawn 6 px wide at 25 % of its ink.
- **Stretch line**: dashed 4/3, 1.5 px, accent, from the point on the rail to the pointer; opacity grows from 0.35 at
  the start of the stretch zone to 1 at the let-go distance; a hollow ghost dot (r = 4, 1.25 px) at the pointer.
- **Let-go**: line and rail vanish in the same frame; the point is at the pointer.
- **Chips**: the existing chip (12 px, 22 px tall, above-left of the target, 48 px above a finger, inside the pane).
  Only while a gesture or a hover is on a target; nothing at rest; no new hint line anywhere. Nothing is drawn over
  the panes' controls (the chip clamps inside the pane, as today).

### 4.2 Words (English → Russian; new strings go to notes/i18n/ru/v165-ux-rail.json; terms from GLOSSARY.md)

| Where | English | Russian |
|---|---|---|
| ring chip, a display curve (existing pattern "on {x}" → «привязка: {x}») | on the unit circle / on the real axis / on the imaginary axis | привязка: единичная окружность / действительная ось / мнимая ось (existing names, v163-constr.json) |
| ring chip at a detent | on {c} at {a} — "on the unit circle at i", "on Circle 1 at 30°" | привязка: {c}, {a} |
| ring chip, grid | grid point {z} — "grid point 0.5 + i" | узел сетки {z} — «узел сетки 0,5 + i» (decimal comma) |
| stretch chip | Pull further to free {x} | Тяните дальше, чтобы отвязать {x} |
| let-go chip | {x} is free | Точка {x} отвязана |
| a bound glider pulled | {x} follows {a}: change {a} | {x} задана через {a}: меняйте {a} |
| refusal (existing) | {x} needs distinct points | {x}: нужны различные точки |
| Snap button tooltip (laptop) | Snap to the grid and to figures (both panes). Hold Alt to place freely. | Привязка к сетке и фигурам (обе панели). Удерживайте Alt, чтобы ставить без привязки. |
| Snap aria-label / palette | Snap to grid and figures / Snap to grid and figures on or off | Привязка к сетке и фигурам / Привязка к сетке и фигурам: вкл. или выкл. |
| phone switch label (existing) | Snap | Привязка |
| sound list | Point attached — "A point landed on a curve or a crossing" / Point freed — "A point was pulled off its curve" | Точка привязана / Точка отвязана |

"Make free" is already «Отвязать», so the let-go chip and the sound name use the same verb. «Фигура» is the glossary's
word for any shape (points, curves, regions).

### 4.3 The Snap button

Its meaning does not change; its words do. It is one switch for **the grid and figures**: points, crossings, curves
and the lattice, for placing, drawing, dragging and moving. Construction tools always pick points and curves (their
job); for them it governs only the grid (v16 rule). Off, a press places exactly where you press and a drop never
attaches; a point already on a curve still slides on it (that is its definition) and still comes off by a pull. Alt
is the momentary "off" on the laptop. The plane piece's UX94 gives the button its look (the word "Snap", accent fill
when on; a switch on the phone); this spec gives the tooltip and aria-label above.

**The tour.** No step lights or waits for the Snap button, but chapter 'construct', step 'meet' (tour.js, the body
and touch texts) states the v16 snap rules, which change. New texts (and their Russian in v165-ux-rail.json):

- body: "Drawing tools, the Point tool and dragged points snap to points, zeros, crossings and the grid, and what
  snaps follows them. The Point tool also puts a point on a curve, the unit circle and the axes included: drag it
  along, or pull it hard to free it. Hold Alt to place freely. Intersect marks a crossing."
- touch: the same with "Turn Snap off in the tools sheet to place freely." for the Alt sentence.

Its try ("Draw a line from a crossing") is unchanged. Step 'follow' ("Drag z₂ across the line") still works: z₂'s own
circle is excluded from its targets, and only a drop within 6 px (14 on touch) of the line tc3 would attach it; the
build checks that tour_auto_cmd's drag ends clear of the line.

### 4.4 Sound

Two new Interface-tier cues in sound.js `CATALOG` (Interface sounds are on by default; both are rare, one per
gesture, so they do not belong behind the separate "Snap ticks" switch):

- `attach`: a short tine, E5 then A5 30 ms apart, quieter than `toggleOn` (gap 150 ms);
- `detach`: a felt tap with a pitch drop, as `edge`'s skin strike, then nothing (gap 150 ms).

Detents and grid catches keep the existing `snap` tick (the separate switch, off by default). `t_sound.js` walks
`CATALOG`, so the two entries need labels, `what`, and TRIM values measured like the others.

## 5. Tests

### 5.1 Node: test/t_rail.js (loads src/constr.js)

- `refKey`: two different meet refs differ; the same meet ref twice is equal; `pend:i` keys.
- `samePick`: two curve picks on one circle 30° apart are different; two existing-point picks of z₀ are the same.
- `gridStep(s)`: s = 52 → 0.5, 520 → 0.05, 5.2 → 5, 14 → 1; always one of the drawn tiers, ≥ 14 px.
- `railPull`: glide / stretch / let-go zones at each threshold, mouse and touch; 40 px for 100 ms then back → no
  let-go; 40 px for 130 ms → let-go; 80 px in one sample → let-go.
- detents: the unit circle at 89° → t = ¼ and p = (0, 1) bitwise (turn-exact glide); an arc's 15° detents inside its span only.
- perp with two gliders on one circle: orthogonal (|cos| ≤ 1e−12) and through both, for 20 random pairs on the unit
  circle and on c = 0.3 + 0.2i, r = 1.5; k/24 and (k + 12)/24 → A = 0 and the line through the centre, both circles;
  a pair 1e−6 turn off antipodal → a circle (the rule is not a tolerance on geometry).
- circle3 of three gliders on one circle → that circle; touch with T and P on C → C (model) and the UI refusal stays.

### 5.2 Headless: test/ux165_rail_cmd.js (laptop 1366 × 768 mouse; phone 412 × 860 Android emulation with touch through Input.dispatchTouchEvent; 915 × 412 for B and C)

A. Point tool on the shown unit circle: laptop click 3 px off, phone tap 12 px off → one undo step makes the fixed
   unit circle and a glider, |p| = 1 to 1e−15; laptop hover shows "on the unit circle"; Alt-click → a free point.
B. Drag it round 270° (mouse; finger): |p| = 1 throughout; at 90° with Snap on p = i bitwise; Snap off → no detent.
C. Pull off: 30 px out (mouse) → still a glider, stretch line drawn (overlay pixels at the midpoint of the line);
   50 px held 200 ms → free, chip "z₁ is free", `detach` played (sound hook); finger 64 px for 200 ms the same;
   a 40 px sweep for 60 ms does not free it; one undo step for the whole drag; Undo restores the glider and its t.
D. Same gesture continued onto Line 1 and released → glider on Line 1; a midpoint built on the point followed every
   frame; a drop on Line 1 ∩ Circle 2 → meet point; a drop on z₀ → not merged, warn ring.
E. Orthogonal: the unit circle picked, then two picks on it twice in a row (the second time C is a shape) → both
   circles made, each orthogonal to C and through its gliders; opposite picks with detents → the diameter (A = 0);
   3 points with three picks on one circle → accepted, equals C; 3 points through three different crossings →
   accepted; a second press on the first pick → warn ring and the "needs distinct points" chip.
F. Grid: Point tool 6 px from 0.5 + i at 52 px per unit → exactly 0.5 + 1i, chip "grid point 0.5 + i"; zoomed to
   520 px per unit, 6 px from 0.55 + 1.05i → exactly that; a free point dragged near 2.5 + 1.5i → exactly 2.5 + 1.5i;
   a disc moved by its body → its centre on the lattice; Alt-move → raw.
G. Alt: Alt-drag of a glider frees on the first move with no stretch; Alt held at the drop over Line 1 → stays free.
H. Undo counts: one step per gesture in A–G.
I. Russian: the chips "привязка: единичная окружность", "Точка z₁ отвязана", "узел сетки 0,5 + i"; dark mode;
   phone: the chip is 48 px above the finger and inside the pane; at rest nothing new on screen.
J. BUDGET60: a glider with 10 dependent perpendicular circles dragged round the unit circle (perp_cmd F's scene).

Screenshots before/after, light and dark, one Russian, to notes/ux-build/shots/w1-rail/.

### 5.3 Existing suites to re-run

All node `t_*.js` and `constr_*_tests.js`; constr_cmd.js, perp_cmd.js, touch_cmd.js (the touch curve radius goes
10 → 14: perp_cmd D picks within 10 px still pass; any test that taps 11–14 px from a curve expecting a free point
must be read), zp_cmd.js, split_cmd.js, v15_desktop_cmd.js, v15_phone_cmd.js, phone_swap_cmd.js, i18n_cmd.js,
i18n_walk_cmd.js, export_cmd.js, sound_v152_cmd.js, the tour files, glsl-test and the quality suite.

## 6. How it fits the other pieces

- **D9 (wave 2, two fingers move the view; the selected shape wins one finger).** Two fingers never move a point: a
  second finger during a rail drag cancels it (2.6) and the gesture becomes pan and pinch. A point is always grabbable
  by one finger, selected or not: its 22 px grab is small enough never to block a pan, and D9's "first tap selects"
  is about taps, not drags. With the Point tool on, a press on an existing point selects it and a drag slides it,
  which is D9's "the just-drawn shape wins". On the sphere a drag that starts on a point moves it (as on a handle);
  elsewhere it turns. A drag started inside the phone's 16 px edge band is a pan; a rail drag that reaches the band
  continues.
- **UX09 (plane piece: handles 12 px on touch, 22 px grab, curves selected within 18 px).** The point snap radius on
  touch (22 px) equals the grab radius: what you can grab, you can snap to. The curve snap on touch (14 px) stays under
  the 18 px selection tolerance. The let-go distance (64 px on touch) is almost three grab radii, so starting a slide
  never frees a point. Use the plane piece's `ptrTouch` for "is this a finger" instead of `touchNow()` once merged.
- **UX94 (plane piece: the Snap button's look).** That piece owns the look; this one owns the meaning, the tooltip and
  "moves snap too" (1.2). The merge takes the plane piece's markup and this piece's `data-tip` and aria-label.
- **UX55 (plane piece: Hyperbolic line).** It is a CURVE1 tool with two picks on C: exactly the case of 3.2 and 3.4.
  Its picks must call `samePick`; its antipodal case is the diameter by 3.4.
- **UX52 (plane piece: a pick's refusal in the chip for 2 s).** 3.2 shows the refusal as a warn ring at the pick,
  which is the same place; keep both (the ring while hovering, the chip after a press).
- **D3 / D10 (wave 2).** A selected point on a curve offers Make free in its ⋯ (today), which the phone's context bar
  will carry. Alt is a held key, not a mode, so it gets no mode chip.

## 7. Build map

| File | Functions | Change |
|---|---|---|
| src/constr.js (CORE, node-tested) | `refKey`; new `gridStep`, `railPull`, `RAIL`; `glide` (turn-exact circle); `evalNode` perp (antipode rule); exports | 1.3, 2.3, 3.2, 3.4 |
| src/construct.js | `snapAt` (display curves in classes 2–3, pending picks in class 1, the grid as class 4 returning `{cls: 'grid'}`), `classesFor` (roles 'free-drag', 'move'), `samePick` used in `click`, `globeClick`, `hover`, `touchTarget`; `materialize` (make or reuse a display curve); `pointDown`; `moveDrag` glider branch → rail with detents and the pull; new `freeDrag`, `freeUp` (attach at the drop); `drawOverlay` (rail, stretch line, ghost dot, grid ring); `menuItems` gains display curves via `snapAt`; radii (touch curve 14) | 1, 2, 3.2, 4.1 |
| src/app.js | `snapZ` (tier list, touch radius); the 'move' branch: a point shape → `Construct.freeDrag`, other shapes → anchor snap; `onUp` → `Construct.freeUp`, one commit; `cmGesture` around rail drags; Esc and a second finger restore the press state; `gmove` for gliders on the sphere; the Snap tooltip and aria-label; the palette line | 1.2, 1.3, 2.4–2.6, 4.3 |
| src/sound.js | `CATALOG.attach`, `CATALOG.detach`, `TRIM` | 4.4 |
| src/tour.js | chapter 'construct', step 'meet': body and touch | 4.3 |
| tools/make_ru_table.py, notes/i18n/ru/v165-ux-rail.json | the strings of 4.2 | 4.2 |
| test/t_rail.js, test/ux165_rail_cmd.js | section 5 | 5 |

**Goldens and perf to watch** (never updated by the build; listed in its AS-BUILT for the user): the turn-exact glide
(≤ 1 ulp, no pixel change expected); the 0.5 grid tier changes where a click lands in any golden scene built by
clicking near a half-grid position; no perf baseline should move (the snap search gains three candidates and the
overlay two strokes).

**Decisions this spec makes for the user** (changeable): C22 changes for curves and crossings (a dropped free point
attaches) but stays for points (no merging); drawing tools still never put their ends on curves (C16a); the 15° detent
step; the pull distances 40 px (mouse) and 64 px (touch) with a 120 ms hold.

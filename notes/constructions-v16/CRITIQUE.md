# Constructions v16: critique of SPEC.md

Adversarial review of `SPEC.md` (and the DESIGN.md it refreshes) against the v15.1 code in `work/xvc/src` and the
v15.1 app (`work/xvc/dist/test.html`, headless Chrome on port 9201). Line numbers are v15.1 `work/xvc/src`.
Measurements were taken in this review. Scripts: `work/xvc/test/critic_cdp/perf_dependents_cmd.js` and
`perf_profile_cmd.js`. Shots: `critic_cdp/shots/`.

Severity: **B** = blocks the build or fails the spec's own gate; **H** = high (wrong picture or a surprise users
will hit at once); **M** = medium; **L** = low.

## A. Blockers

**1. (B) In every tool, a press near a zero drags the zero.** The editor treats a zero as something to drag, not
as a point to pick.
- `zpHit` runs before `editDown` for every tool (app.js:10477–10486). The `onSel` exception applies only to the
  Select tool. Shift-click adds a zero in any tool.
- So with Circle through 3 points, picking ζ₁ starts a zero drag, and a Line cannot start on ζ₁. §4.1 lists ζ as a
  target, but §4.3 covers only bound handles.
- Fix: when `tool !== 'select'`, skip `zpHit` and Shift-add. `Construct.snap` offers zeros as point targets
  instead. In the Select tool a zero still drags.
- Test: pick ζ₁ with each tool, by mouse and by touch.

**2. (B) `applyBinds` wipes the construction state.**
- For a shape without `bind`, `applyBinds` deletes `s.undef` and makes the shape visible again (app.js:13205).
- `onParamChange` runs it on every shape on every slider frame (13262). `bindsAll` runs it on every undo and load
  (13242, `restore` 268).
- Result: any slider move brings back an undefined meet point ("The curves do not meet here") at its stale cached
  position. A glider with `bind.t` and a failing definition has two owners that keep overwriting each other.
- Fix: give each owner its own field. Keep `undef`/`undefHid` for binds and add `cundef` for constructions. The
  renderer and the row hide the shape when either field is set. Alternatively, `applyBinds` returns early for shapes
  with `def` or `at`, and `Construct.update` owns `undef` for them.
- Test: make a meet undefined, drag an unrelated slider, and check that the meet stays hidden.

**3. (B) 50 dependent areas cannot hold 60 fps on today's path, so the §18 perf gate will fail.**
- Measured in v15.1 at 1440×900 with the default exp∘Möbius chain. A shared number `a` drives N shapes through
  `bind.c`, and `Params.set(a, live)` runs every frame:

  | N | frame p50 / p95 | set() handler p50 / p95 |
  |---|---|---|
  | 1 disc | 16.7 / 17.5 ms | 1.5 / 2.3 ms |
  | 10 discs | 16.7 / 17.6 ms | 7.9 / 12.1 ms |
  | 50 discs | **46.7 / 61.2 ms (~21 fps)** | **41 / 56 ms** |
  | 50 circles | 16.7 / 17.6 ms | 2.5 / 3.3 ms |

- Profile at 50 discs: `shapesChanged` takes 97 % of the handler. Within it:
  - 65 % is `fitRight → fittedView → stageSamples/robustBox`: Y's auto-fit re-samples every shape on every live
    frame;
  - about 33 % is `shapeGPU/buildMesh`.
- A construction drag goes through the same `shapesChanged(false)` path.
- Fix:
  - (a) No auto-fit of Y during live changes. Fit once when the gesture ends, as `onUp` already does for handle
    drags (11316). This also speeds up v15's own slider path.
  - (b) While the gesture is in motion, rebuild forward meshes only where they are needed for the picture (areas are
    drawn per pixel when `exactImages` is on), or rebuild a few per frame, newest first, and the rest at rest.
  - (c) Report 10 and 50 dependents separately. Promise 50 only after (a) and (b) are measured.

**4. (B) `gform: 20` would never reach the inverse pass.**
- `packShapes` skips every record with TKIND > 10 (gl.js:4353). Kinds 1–10 are areas; 11 and up are curves.
- Fix: two kinds.
  - An area form, kind 8 (free), on the inverse and Preimage area paths.
  - A curve form, kind 20, on the curve paths.
  - Or keep TKIND by `s.kind` and branch on `s._g` inside `packShape`.
- Add both to the glsl_test rows.

**5. (H) float32 is accurate only near `o`, not "at every radius" (§2.2).**
- Near the curve the two terms A|z−o|² and 2Re(B̄(z−o)) are each about |z−o| in size, and they cancel. The float32
  error is about 6e−8·|z−o|.
- Example: zoom onto a stretch of circle(P, Q, R) whose first point P is 1e4 away. The error is about 1e−3 against
  pixels of 1e−4, so the edge is visibly wrong.
- Fix: re-anchor for each view on the CPU in float64. Take o′ = the point of the curve nearest the view centre and
  compute B′ = B + A(o′ − o) and C′ = f(o′). This is exact algebra for a quadratic. Pack (o′, A, B′, C′).
- glsl_test row: a view 1e4 away from o.

## B. Mathematics

**6. (H) Two lines lose their crossing once they turn past parallel (also segment with line, segment with
segment).**
- Worked by hand. Let L₁ be the real axis and L₂ the line through i with direction e^{iφ}. For φ > 0, L₂ enters the
  left side of L₁ at the finite crossing, so that crossing is index 0. For φ < 0 it leaves there, so index 0 becomes
  ∞.
- The entering rule picks that branch of the tangency at ∞, so the meet goes to ∞ and stays hidden.
- On a segment it reads "The curves do not meet here" from then on, even though the segment visibly crosses again.
  Users expect the crossing to come back from the other side.
- Fix: when both carriers are exactly lines (lines, segments, rays, half-plane edges, bound lines), store
  `index: 'finite'`. The point is the finite crossing, and ∞ only while the lines are parallel. Keep the entering
  rule for pairs that involve a circle.
- Test: turn L₂ through parallel in 41 steps. The meet passes through ∞ and comes back.

**7. (H) Clipping a huge circle to FAR drops the part that Y shows.**
- §2.2 clips a circle of radius 1e8 to `expandBox(win, FAR)`. That removes the far arc, but 1/z maps the far arc
  next to 0 in Y.
- Lines avoid this with tails toward REACH (region.js:114–120, 765+).
- Fix: sample a generalized circle as M(ℝ), where M is the Möbius map with 0, 1, ∞ → P, Q, R (§2.5 already has it).
  Run the existing line sampler on t, dense near the view with geometric tails, and map the samples by M.
- One path then serves lines, huge circles and A → 0, and it is continuous through the collinear case.

**8. (H) Some consumers still read (c, r) for a near-collinear disc.**
- With A = 1e−15 the cached disc has |c| ≈ r ≈ 1e15. In float64, the points c + r·e^{iθ} near the view are off by
  about 0.1.
- §2.2 routes levelOf, kindLevel, the GPU, shapeClip and curvesOf through the exact form. These consumers still read
  c and r: the globes (`GL3.capOf`, app.js:10618), integrals, export geometry, and the deformation transport.
  sphere.js is listed as unchanged.
- Fix: add one `Region.formOf(s)` and make every reader of a circle's or disc's c and r use it. Build the globe cap
  straight from (A, B, C); globe caps are already this Hermitian form (region.js:1585).
- Cache: when r exceeds 1e12 times the view size, store a half-plane as the concrete fields, not a disc whose
  centre sits at 1e15.

**9. (M) The Λ rule mishandles circles through 0.**
- `at0` is level(0) > 0 (inverse.js:904). A circle through ζ₁ = 0 has level(0) ≈ ±1e−17, so inside or outside at
  |z| < e^−60 is random and can flip between frames.
- `thru0` exists only for half-planes.
- Fix: set thru0 from incidence (a defining point that is exactly 0). In the Λ rule, treat such a circle as its
  tangent half-plane at 0, and anchor o at that point.

**10. (M) The form needs A's value, not only its sign.**
- The exact predicate gives the sign. The plain float64 determinant can carry the opposite sign.
- Fix: A = the float64 value of the exact expansion. Then sign(A), and the choice of disc, half-plane or complement,
  can never disagree.

**11. (H) Snapping onto a co-argument is a trap.**
- Snapping lands exactly, by design. Snap z₂ onto z₀ while both define circle(z₀, z₁, z₂), and the circle and
  everything built on it vanish at release.
- A drag that passes an exact grid node of another defining point also blinks the subtree off for one frame.
- Fix:
  - (a) A gesture's targets exclude the co-arguments of every construction the dragged thing defines. Hovering one
    shows the chip "Circle 1 needs distinct points".
  - (b) During a gesture only, draw an undefined construction as its last good shape, dashed at 30 %. At rest it
    hides as specified, and it never appears in export.

**12. (H) Zero refs by index break on text edits and on drag-off.**
- Zeros are a comma list in a text field (`zpWrite`, app.js:2621). Deleting the first zero in the field silently
  rebinds every ζ₂ ref to the old ζ₃, and the construction jumps.
- Dragging a zero off the plane removes it (11306). A drag would then cascade-delete shapes, and the only warning is
  "Release to remove ζ₁".
- Fix:
  - Keep a parallel `st.zpIds` array of stable ids. zpAdd, zpRemove and swap maintain it. On a text edit, match old
    ids to new values by nearest value.
  - Removing a zero that constructions use makes them undefined (as removing the step does). The chip says "Release
    to remove ζ₁; 2 shapes will be undefined".

**13. (M) Zeros written with shared numbers don't drive constructions.**
- v15 allows ζ₁ = a + i, so a slider moves ζ₁. But §3 recomputes only from the shapes that `applyBinds` changed, so
  constructions on ζ₁ do not follow.
- Fix: in `onParamChange`, when a step changed and f₁ is a zeros-and-poles step, run `Construct.update` from f₁'s
  zero refs.

**14. (M) A glider's t does not suit a slider on closed curves.**
- On circle(P, Q, R) the Möbius parameter runs to ±∞ near R. A slider on [−2, 2] covers only part of the circle, at
  an uneven speed, and Play never goes all the way round.
- Fix: let M map 1, i, −1 to P, Q, R and set S(t) = M(e^{2πit}), with t ∈ [0, 1) and wrapping. It is still continuous
  through the line case.
- Do the same elsewhere:
  - a plain circle: angle / 360;
  - a closed polygon or rectangle: t ∈ [0, n) across the sides, so a glider slides round corners instead of stopping
    at the end of its side.
- A formula curve has no t. Show no field and offer no bind for it (§6 implies one).

**15. (L) A bound radius is clamped to 1e−3.**
- `setHandle('r')` takes max(1e−3, …) (region.js:428). If circle(P; Q) reuses it, the circle misses Q when
  |PQ| < 1e−3, which shows when zoomed in.
- Fix: `Construct` writes r directly, and the circle is undefined only at exactly 0.

## C. The user's side

**16. (H) Snapping to curves by default spoils the Point tool and fills the Shapes list.**
- Snap is on by default (app.js:217). In the default scene on a 390 px phone, the line Im z = 0.8 and the strip
  edge Im z = π/2 are about 38 px apart. With a 16 px curve radius on each, 32 of those 38 px make a glider instead
  of a free point.
- Every drawing-tool snap to a curve or a crossing also creates a new point row (z₃, z₄, …) and a label in the
  plane.
- Fix:
  - (a) Drawing tools snap their handles to points, handles, zeros and crossings, never to curves.
  - (b) The Point tool makes a glider only on the drawn stroke: its hit width + 3 px, or 10 px on touch. The ring
    and "on Line 1" show before release.
  - (c) Points that a snap creates on its own are **helpers**: no label, a small ring, and a row indented under the
    shape that made them. A helper is deleted with that shape when nothing else uses it.

**17. (H) Deleting a point should not delete what merely snapped to it.**
- Binding happens by default while drawing, so the user may not know that a segment's end follows z₀. Deleting the
  segment together with z₀ (§9) is a surprise.
- Fix: the delete cascade runs only through `def` (circle3, meet, midpoint, bisector, glider). A shape with only `at`
  stays where it is and becomes free. Toast: "Deleted z₀; 2 shapes no longer follow it. Undo".

**18. (H) A refused move also blocks panning.**
- In the Select tool, a press on an area selects it and starts a move (app.js:10541; areas hit inside). A 3-point
  disc, its complement or a half-plane covers much of X. With the move refused, the press does nothing, and X can no
  longer be panned by dragging.
- Fix:
  - (a) A refused move pans instead; the chip shows once.
  - (b) For an `at` shape whose sources are all free points or free handles, use GeoGebra's rule: moving the shape
    moves its sources (dragging a line through z₀ and z₁ drags both points).
  - Refuse only when a source is a zero or a constructed point.

**19. (M) Drawing tools place their first handle on press; §4.2 only defines release.**
- `editDown` places handle a at pointerdown (10522), so the start must snap and bind at press.
- On touch there is no hover, so the ring appears only once the finger is down, under the finger.
- Fix:
  - Say that the press binds the start.
  - On touch, draw the ring and chip 48 px above the finger.
  - A press that moves less than 3 px is a pick, so the start can be taken back with Backspace.

**20. (M) The phone sheet leaves only a 195 px plane.**
- With More tools open on 390×844, X and Y share the upper half side by side, each about 195×290 px (shot
  `phone2.png`). Picking three points there with 22 px radii is cramped.
- Fix:
  - Choosing a Construct tile closes the sheet.
  - The tool row's slot shows the active construct tool, with the draft chip and its ×.
  - Check that the drawing tiles behave the same.

**21. (M) On touch nothing shows the dependencies.** Hover does nothing on a phone.
- Fix: on touch, a selected shape gets the hover highlight while it stays selected: it, its sources and its
  dependents at full strength, everything else at 30 %.

**22. (M) What a free point does when dropped on a target is unclear.** "It does not merge" leaves open whether it
lands exactly on the target.
- If it does, two points stack on one spot (picks become ambiguous), or a coincidence makes things undefined (11).
- Fix: dragging a free point snaps to the grid only. Context-menu items "Put on this curve" and "Put on this point"
  do it on purpose.

**23. (M) Points in Y are on the page too.**
- Y shows z₀″ = F(z₀) with a label (shot `desk1440.png`). Under §3, a Y target cannot use it, because refs never
  cross planes. Users will try "circle through z₀″ and two more".
- Fix: a one-way ref `{img: 's3'}` for targets: F(z₀), computed in float64 by the chain and recomputed when the chain
  changes, as zero refs are.
- Failing that, the chip on such a point reads "Draw in X to use z₀".

**24. (L) The Arc tool already makes an arc through three points.** Its handles a, m and b bind like any others.
- Fix: say so in its tooltip and in the tour, and test it.

**25. (L) "The half-plane left of z₀ z₁" is ambiguous** without a direction.
- Fix: "left of z₀ → z₁" / «слева от z₀ → z₁».

## D. Russian

**26. (M) Some phrases agree in gender, which the glossary's neutral rule forbids.**
- «…построенные по ней» works only for a feminine {x}: «Отрезок 1» and «Круг 1» are masculine.
- «Сделать свободным» is masculine or neuter.
- «на {x}» with «конец: Отрезок 1» gives «на конец: Отрезок 1».
- Fix:
  - «Удалено: {x} и зависимые фигуры ({n})»;
  - «Отвязать» (Make free);
  - snap chip «привязка: {x}»;
  - «на кривой: {curve}».
- Check every `{x}` slot for agreement.

## E. Feasibility and structure

**27. (M) Name the hooks by function, not by line.**
- v15.2 rewrites app.js around 3889–5020, 7288–7407, 9750, 10054–10062 and the end (diff of `work/xv152`, read
  only). The construction hooks lie outside those ranges, so the merge risk is low, but every line number shifts by
  about +130.
- Fix: the spec and AS-BUILT name each hook by its function (editDown, onMove 'handle'/'zp', onUp, deleteShape,
  shapeRow, zpSet, zpRemove, sanitizeState, onParamChange, restore). Each hook is one line, guarded by
  `typeof Construct !== 'undefined'`.

**28. (M) Find crossing targets locally, not across all pairs.**
- Computing all pairs at the start of a gesture is O(n²) polyline intersections. Formula curves have thousands of
  samples, and 40 curves make 780 pairs. The cache also goes stale when something moves during the gesture.
- Fix: on each pointer move, intersect only the curves within the snap radius (usually 3 or fewer), on their samples
  in a small box around the pointer, then refine: exact on carriers, Newton on formulas. The cost is O(k²) per move
  and needs no cap.

**29. (L) v15.1 drops step uids.**
- v15.1's sanitizeState rebuilds steps as {type, params, on} (app.js:358). A v16 state that a v15.1 page opens and
  autosaves loses every uid, so back in v16 every zero ref fails.
- Fix: a zero ref also stores `step: 0`. If its uid is found nowhere and f₁ is a zeros-and-poles step, rebind it to
  f₁ and assign a fresh uid.

## What holds up

- No new shape kind, with the exact form at runtime.
- Steps referred to by uid.
- Only f₁'s zeros as points, and zeros that drive but are never driven.
- Make free.
- One undo step per gesture.
- The Construction view never opens by itself.

The PoC's exact predicate and incidence tracking are the right base. Most fixes above are local; the ones that change
the plan are 3 (perf), 6 (line meets), 16–18 (snap and delete semantics) and 5, 7 and 8 (exactness off the anchor).

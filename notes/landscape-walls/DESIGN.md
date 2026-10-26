# Landscape walls, cuts and the height box: diagnosis and design

2026-10-25. Diagnosis made on `work/xvls` (v16 plus All sheets during the deformation). No source files were changed.
The user's request: where the surface is continuous, draw a closed, smooth wall, however steep. Where there is a real
discontinuity, draw nothing across it and give both sides clean edges. Where the surface leaves the height box, cut it
cleanly at the box.

## 1. Before

The pictures are in `before/` (868 × 652, the Landscape pane at 1440 × 900, light and dark):

- Every case at rest: `<case>-<height>[-sheets]-<theme>.png`. The cases are √z, log z, tan z, 1/z, 1/(z²+1),
  e^{1/z}, z^i, (z²−1)^{1/3}, a Γ-like product 1/(z(z+1)(z+2)(z+3)) (zeros and poles step) and (z²−1)/(z²+1).
  The heights are Im, Re, log|F| and |F|. All sheets is on for √z, log z, z^i and (z²−1)^{1/3}.
- The user's case, sin √z with √ bracketed and All sheets, Im: `sinsqrt-t{0.0,0.2,0.5,0.8,1.0}-im-sheets-*`. At
  t = 0.5 there are also Re, log|F| and sheets off (`sinsqrt-t0.5-*`, `sinsqrt-t0.2-im-*`).
- In motion: `tan-re-orbiting-*` (a frame taken mid-drag) and `sinsqrt-playing-{0,1,2}-*` (frames taken while the
  deformation plays at t ≈ 0.18, 0.83, 1.0).

The artifacts are the same at rest, while orbiting and while playing. The mesh does not depend on the camera. While
playing, the same rule runs on new heights every frame, so the holes and teeth move and flicker.

Measured on the CPU with `work/xvls/test/wl_diag.js` (results in `before/diag.json`). That script replays the shipped
principal-branch rule on the same 256 × 256 grid, box and heights. It checks every triangle edge by bisection down to
2⁻⁴⁰ of the edge: a height jump that stays above 0.02 H at that size is a JUMP, anything else is CONTINUOUS.

| case | height | holes: continuous triangles dropped (their 3D area as a share of the drawn area) | curtains: triangles drawn across a jump |
|---|---|---|---|
| tan z | Re | 3190 (**72 %**) | 0 |
| Γ-like product | Re | 1364 (**36 %**) | 0 |
| e^{1/z} | Re | 542 (**34 %**) | 0 |
| 1/(z²+1) | Re / Im | 316 / 366 (10 % / 10 %) | 0 |
| (z²−1)/(z²+1) | Re / Im | 112 / 366 (5 % / 10 %) | 0 |
| tan z | Im | 168 (6 %) | 0 |
| 1/z | Re | 156 (5 %) | 0 |
| z^i | Im | 172 (3 %) | 0 |
| sin √z, H_t at t = 0.2 | Im / Re | 380 / 211 (4 % / 2 %) | 122 (0.5 %) |
| sin √z, H_t at t = 0.5 | Im | 186 (2 %) | 68 (0.6 %) |
| √z | Im | 0 | 3 (near the branch point) |
| (z²−1)^{1/3} | Im | 0 | 2 |
| every log\|F\| case | log | 0 to 100 (≤ 3 %) | ≤ 2 |

The holes are few as triangles, but they are the walls: up to 72 % of the surface area that should be drawn is missing.

## 2. Causes, in the code

**C1. Triangles are dropped for being steep. This is the only test for a discontinuity.** In `src/gl.js`, `triOK`
(LAND_VS, line 1938) draws a triangle only if all three corners are finite and their heights differ by at most 0.3 H.
LAND_SHEET_VS (line 2031) has the same test for All sheets. The rule cannot tell a steep, continuous wall from a jump.
It gets both wrong:
- (a) A continuous wall that rises more than 0.3 H within one cell is dropped. This gives the holes, the empty walls
  (1/(z²+1), Γ-like, tan, e^{1/z}) and the saw-tooth "comb" edges in the user's filmstrip. The teeth are one cell
  wide, because whole triangles are dropped.
- (b) A real jump smaller than 0.3 H is drawn across, as a curtain. This happens near every branch point, where the
  jump goes to 0: √z, (z²−1)^{1/3}, and the z^s pieces of H_t (122 curtain triangles at t = 0.2).
- (c) Even where the rule is right, the edge of a cut is a staircase of whole triangles. It can sit up to one cell away
  from the true cut.

**C2. The exposed-edge tint marks steep walls as if they were cuts.** On the principal surface, `vEdge` (line 1952) and
LAND_FS `cliff` (line 2083) draw any edge next to a dropped triangle in the cut colour. So the ragged rims of the holes
show as red or orange lines, as if they were branch cuts. On All sheets `vEdge` is 0, so the holes there have no rim.

**C3. A uniform grid with no refinement.** The grid is 256² vertices (384² Fine, 512² Max; `app.js` 3581). All sheets
uses M = 96…255 cells per side (`gl.js` 4041). Steepness is measured per cell, so a wall's chance of being dropped
depends on the zoom and on N, not on the function. Near a simple pole, the band where Re or Im passes through the
height range narrows like r². No fixed grid can close it.

**C4. The compressed height saturates.** Re and Im use H·(2/π)·atan(x/μ), where μ is the median |value| over the box
(`medianAbs`). When μ is small, almost everything sits on the ±H plateaus with thin walls between them:
- tan z: Re tan z → 0 away from the real axis, so μ ≈ 0.005. The ruler reads 0.005 and 0.02, and 72 % of the walls are
  missing.
- The user's case: while deforming, μ is F's steady median (`app.js`, notes/v16-user5 2.1). At small t, Im sin w is
  huge and changes sign with cos Re w. The result is ±H plateaus joined by very steep walls, which C1 cuts into combs.

**C5. Linear heights clamp instead of clipping.** With All sheets at rest, Re and Im are linear and clamped to ±1.25 H
(HEIGHT `heightW`, line 1872). A surface that leaves the box becomes a flat lid with a vertical step, not a clean cut.
You can see this on z^i with All sheets and on the outer turns of log.

**C6. NaN and ∞ drop a whole corner.** A vertex that is not finite drops all six triangles around it: a square hole
two cells wide. The current boxes do not hit a pole exactly, but a zoom or a symmetric box with an odd vertex count
does.

**C7. Normals are one-sided across "cliffs".** LAND_NRM_VS (line 1908) and LAND_SHEET_TF_VS (line 2006) use the same
0.3 H rule. Walls that are drawn get normals from one side only, which shows as shading creases along the walls.

**C8. All sheets: window ends fall on cell edges.** With All sheets, each cell is evaluated with local cuts opposite its
centre (`zc`, line 1996). No cut falls inside a cell, so there are no curtains and the cells join seamlessly. (The holes
on All sheets are C1 alone.) But the true free edges fall where the cell labels change: a staircase on cell boundaries,
not the exact curve. These free edges are:
- the ends of a log or irrational-power window,
- the 24-surface cap,
- H_t's z^s pieces for 0 < t < 1, where only n = 2 of the infinitely many sheets are drawn, so sheet 1 continues onto
  sheet 2, which is not drawn.

## 3. Design

### 3.1 The rule

**A triangle is never dropped for being steep.** Only three things remove surface:
1. a real discontinuity, known exactly from the branch structure, not guessed from heights (3.2);
2. the height box, clipped exactly (3.4);
3. a point where F is undefined. It is surrounded by refinement until what is left is under a pixel (3.5, 3.6).

The 0.3 H tests in `triOK`, LAND_SHEET_VS, LAND_NRM_VS and LAND_SHEET_TF_VS are removed. `vEdge` goes away. The
cut-colour rim is drawn only on real cut edges.

### 3.2 Real discontinuities: evaluate on a continuation, keep the principal side per pixel

The app already has a branch that is continuous across any cell: `chainSheetRange` and `chainSheetHom`, with each
multivalued node's cut placed opposite the cell centre. This is the analytic continuation of a sheet through the cell.
It covers:
- roots, real and complex powers and log;
- their images through the earlier steps, since every node is evaluated at its actual input;
- the branches inside a custom formula;
- the pieces of H_t.

Jumps of Im log and of arg are the same cuts.

**Principal surface (All sheets off).** For each base cell:
- Evaluate the corners with the principal map P and with the continuation C₀ (combo 0 of the cell). If they agree at
  every corner and at the cell's sample points, the cell is clean. That is almost every cell. Draw it from C₀ = P.
- If they disagree, a cut crosses the cell. Draw it once for each combo C_k of the cell (k ∈ {−1, 0, +1} per
  multivalued node, which is the existing combo decode with W = 1). The vertex heights come from C_k, which is
  continuous, so no triangle bridges the jump. Each pass keeps only the fragments where C_k is the principal value.
- The keep test uses a **cut margin** m(z) that the chain also returns. It is the smallest, over the multivalued nodes,
  of the signed angle between the node's input and its global cut, measured on the side that belongs to combo k.
  Discard where m < 0, and antialias with coverage clamp(m / fwidth(m) + 0.5) (alpha-to-coverage; the default
  framebuffer is MSAA, `gl.js` 3182).
- Fallback and test oracle: |P(z) − C_k(z)| ≤ 1e-6 (1 + |P|). P is already evaluated per fragment for the colour
  (LAND_FS `landW`).

What this gives:
- The two sides meet exactly on the cut, to the pixel.
- Each side reaches the cut with its own one-sided limit (C_k is continuous up to and across the cut).
- Nothing is drawn across the cut. There are no curtains at any jump size, including near the branch point where the
  jump goes to 0.
- The edges are smooth curves: the image of the cut through the earlier steps, not a staircase.
- A thin rim in the cut colour (TH.cut, light and dark) runs along each side, from the same margin.

**Cells that hold a branch point.** Here the continuation's own local cut must pass through the cell. Such a cell is
found by its monodromy: following C₀ around the four corners does not return to the start. It is refined toward the
branch point (3.3) until the leftover cell is under 0.5 px on screen. The same per-fragment test applies to it.
Branch points that are known (`b.cuts` ray origins, segment ends) are snapped to vertices.

**All sheets.** Cells already join seamlessly, and the rule in 3.1 removes the holes. The free edges (C8) are real:
the surface continues onto sheets that are not drawn. They are made exact: the sheets keep their combo labels, but the
outermost sheets end at the global cut and its images through the earlier steps, with the same margin discard. They
no longer end at the cell staircase.

With linear heights, log's helicoid and z^i leave the box. The window W is chosen so the box clip (3.4) is the end
you see, wherever the box allows it (W at most 4, as now).

### 3.3 Steep but continuous: adaptive refinement until the wall is closed and smooth

The base grid is the one used now (256², 384², 512²). Each base cell gets a level L from 0 to 4, meaning 1, 2, 4, 8 or
16 sub-cells per side. L is set by the chord error:

- e = the largest |h(mid) − mean of the ends| over the cell's 4 edges, its diagonal and its centre, in world units.
- e is converted to pixels at the camera's fitted distance (`fitDist`; pixels per world unit = pane height divided by
  2·tan(fov/2)·d). The criterion therefore does not depend on the orbit, so orbiting never rebuilds the mesh.
- Refine until e < 0.25 px, or until a sub-cell's footprint is under 0.5 px.
- Cells that cross the box level (3.4), hold a cut (3.2) or hold a branch point are refined by the same measure.

**No cracks.** Each edge of a cell is sampled at the larger of the two neighbours' levels. The finer side's edge
vertices are shared, and the coarser cell fans to them. Equal z on the same continuation gives equal heights from the
same shader code. There are no skirts and no bridging. Every interior edge belongs to exactly two triangles.

**Normals** come from central differences on the continuation, at the sub-cell spacing. The one-sided rule (C7) goes
away, and walls get horizontal normals, so they read as walls.

**Saturated, oscillating values.** The user's case at small t, and tan with its tiny μ: the walls between the ±H
plateaus are refined until smooth, which closes the combs. The saturation itself (C4) is a choice of height map, not a
mesher bug; see 5.

### 3.4 The height box: an exact clip

- **Linear Re / Im (All sheets at rest).** The ±1.25 H clamp becomes a clip at the box, at Hb = ±1.25 H.
  - Vertex heights keep their true value, capped at ±4 Hb so the triangles stay numerically sane.
  - The fragment shader computes the true height h(F(z)) at the fragment's z and discards where |h| > Hb. Coverage is
    clamp((Hb − |h|) / fwidth(h) + 0.5), with alpha-to-coverage. A one-pixel rim in the box colour (TH.landBox) marks
    the cut edge.
  - The boundary is the exact curve h(z) = Hb in the domain. Its error on screen is the mesh's chord error near the
    curve, which 3.3 keeps under 0.25 px, so under 0.5 px in total.
- **Compressed heights (atan for log|F|, |F|, Re and Im).** These never leave the box: they approach ±H. Nothing is
  clipped. Refinement closes the wall up to the asymptote.
- **Picking.** `pickLand` ignores clipped parts: the ray march treats |h| > Hb as empty.

### 3.5 Poles

- No vertex sits on a pole. Known poles (`b.poles` of rational, zeros-and-poles and custom steps) that fall on a grid
  vertex are moved off it by 10⁻⁶ of a cell along the diagonal. C6 cannot happen.
- **log|F| and |F|:** the wall rises toward the box top and is refined until smooth. With linear |F| it would be
  clipped at the box: a clean ring on the level curve |F| = const.
- **Re / Im at a simple pole:** the surface goes from −H to +H across a line through the pole, and is continuous except
  at the pole itself. Refinement closes the wall down to the sub-pixel cell that holds the pole, and that cell is drawn.
  The result is a closed wall up to the box, with no spikes and no holes.

### 3.6 Essential singularities and infinite oscillation

This covers e^{1/z} at 0, z^i at 0, and sin of large arguments in H_t. Refinement cannot converge there. It stops at the
pixel bound (a footprint under 0.5 px) or at level 4. What is left is continuous at that resolution and is drawn: a
dense sub-pixel texture of walls near the point, never a hole. A NaN at the point itself (a vertex exactly at 0) is
replaced by the limit along the cell's interior direction, evaluated 10⁻⁶ of a cell inside.

### 3.7 GPU work per frame (WebGL2: no compute or geometry shaders)

1. **Base pass (as now).** Transform feedback over the base vertices on the continuation, plus the per-cell level,
   from 5 extra samples per cell (edge midpoints and centre), and the cut and monodromy flags.
2. **Compaction.** A histopyramid over the 256² flag and level texture: 8 small reduction passes, then a lookup pass.
   It lists the refined cells, worst chord error first, up to a capacity.
3. **Refined pass.** Transform feedback over the listed cells' sub-vertices.
4. **Draw.**
   - One instanced draw for the base cells; refined cells early-out.
   - One for the refined sub-cells; instances past the count early-out. The count comes from a fenced, non-blocking
     readback of the pyramid top, one frame old, with a margin.
   - The extra combo passes, for cut cells only.

**When the capacity is reached:** the remaining cells are drawn at the level they reached. They are still closed and
still never have holes, only a larger chord error. The next frames at rest finish the refinement progressively, with
the existing busy lamp: "Refining near cuts and poles" / "Уточнение у разрезов и полюсов" (already translated).

### 3.8 Cost and BUDGET60

- **Orbiting.** The mesh does not depend on the camera, so mesh work is 0 per frame. The draw is about 130 k base
  triangles plus the refined ones (worst case, tan Re: about 3 % of cells at levels 3–4, about 0.6 M triangles). The
  fragment cost grows where walls now cover pixels that were background before. That can be up to about +30 % of
  shaded pixels in wall-heavy views, because every fragment evaluates F.
- **Deformation and dragging.** Today's All sheets pass evaluates the chain 20 times per cell for 2 × 255² cells (about
  2.6 M evaluations) and holds 60 fps (p95 18.4 ms, notes/v16-user5). This design adds:
  - 5 samples per base cell: about 0.33 M evaluations;
  - the refined sub-vertices, which the capacity caps at 0.6 M evaluations;
  - the combo passes for cut cells, which are O(N) cells.

  The capacity is set from the measured frame time, the same way the existing cost guard works. Image quality is never
  traded below "closed": when budget is short, the walls stay closed but coarser.
- **Phone** (390 × 844, Android Chrome). Fewer pixels: the capacity is the same, but the pixel bound stops refinement
  earlier.

### 3.9 CPU twin

`src/landmesh.js` (new, Node and browser) implements the same mesher in JS, using `focusF`, `Funcs.sheetEval` and
`Funcs.sheetMapEval`. It is used by the tests below and by `pickLand`. It is not used to draw: the landscape needs
WebGL2, as now (`noGL`).

## 4. Tests and the measurable criteria

The cases are those in `before/`, light and dark, 1440 × 900 and 390 × 844, at rest, mid-orbit and while playing. On
the CPU twin, and on GPU readbacks where it says so:

| criterion | measure | before | target |
|---|---|---|---|
| **no holes** | Every continuous region's mesh is watertight up to the box: each drawn edge is shared by two drawn triangles, or lies on the domain rim, a cut curve (margin = 0) or the box curve (h = Hb). Boundary edges anywhere else: 0. Also the `wl_diag` hole area. | up to 72 % hole area | 0 edges, 0 % |
| **no curtains** | No drawn triangle has a JUMP edge (bisection to 2⁻⁴⁰). GPU: in a debug render that writes \|P(z) − W_drawn(z)\| per pixel on the principal surface, no pixel above 1e-5 (1 + \|P\|). | up to 122 triangles | 0 |
| **clean cut edges** | The distance from the rendered cut edge to the exact cut curve, projected with `info.MVP`, on a 4× supersampled mask readback. | up to 1 cell (≈ 3 px) | < 0.5 px |
| **clipped edge** | The distance from the rendered box edge to the exact curve h(z) = Hb (found by bisection along rays, then projected), on the same readback. | flat lid, no edge | < 0.5 px |
| **smooth walls** | Chord error at the fitted camera. | up to 0.3 H per cell | < 0.25 px |
| **budget** | `__qa.frames` while orbiting, dragging a parameter, and playing the user's case: All sheets on and off, Re / Im / log, desktop and phone. | 60 fps, p95 18.4 ms | BUDGET60, p95 no worse than the plain landscape |

Also:
- Every existing node test passes (`t_*.js`, including `t_sheets_deform.js`: the sheets' values do not change), as do
  glsl-test, glsl-test-adv and glsl_inverse. The new chain output m(z) gets its own GLSL rows against the CPU twin.
- The perf baselines, `accepted.json` and the golden images stay as they are. The quality goldens are 2D region scenes;
  none shows the landscape. If any frame-compare baseline turns out to show the landscape, implementation stops and asks
  the user first.
- New visible strings: none planned. If any are added, the English and Russian go into
  `notes/i18n/ru/v162-landscape.json`, and `make_ru_table.py --strict` must report 0 unresolved.

## 5. Open questions for the user

- **The scale of the compressed Re / Im (C4).** μ = the median makes tan z (μ ≈ 0.005) and the user's case at small t
  almost entirely plateaus and walls. After this work those walls are closed and smooth, but they remain. A gentler
  scale, for example the 90th percentile as the static sheets use, would show the shape and not only its sign. That
  changes the look of every Re / Im landscape, so it is the user's choice, not part of this fix.
- **H_t's z^s pieces for 0 < t < 1.** Only n = 2 sheets are drawn, so free edges are real there. 3.2 makes them exact
  and clean. Drawing more sheets mid-deformation would close them, but the number of surfaces would change with t.

## 6. Files of this round

- `before/`: 85 pictures, plus `diag.json` (the table in 1).
- `work/xvls/test/wl_diag.js`: the CPU replay of the current mesher's rule, with the hole and curtain classification.
  It becomes the "after" check against the new CPU twin.
- `work/xvls/test/wl_cdp/before_cmd.js` and `motion_cmd.js`: the picture runs. Re-run them for the "after" set (port 9801).

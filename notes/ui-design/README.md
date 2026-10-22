# UI redesign: what will change

This covers your UI backlog (items 1–6 and 8; item 7 is a bug and is handled separately). This is design work only:
nothing in `src/`, `dist/` or `test/` was changed. The full designs are `panels.md` (items 1, 3–6, 8) and
`morph-figure.md` (item 2). `review.md` is the review they were revised against.

## In short

**Left is X, right is Y (item 1).** The left pane always shows the domain: your shapes, the phase portrait of F, the
landscape over X, and the z-sphere. The right pane always shows the images: in the w-plane or on the w-sphere.
- Both panes have the same surface switcher in the same place: **Plane · Sphere · Landscape** on the left and
  **Plane · Sphere** on the right.
- **Phase** is a separate toggle on the left only. A phase view or a landscape of Y would show the same picture for
  every F.
- Keys: 1–4 act on the left pane, ⇧1 and ⇧2 on the right.
- The one deliberate exception is the deformation picture (item 2), which shows X and Y in one plane because you
  asked for both together.

**The deformation figure (item 2).** One plane shows X in grey, F(X) in colour, and arrows along the true paths
t ↦ H_t(z) from each sample point z to F(z). It exports as an article figure.
- The arrows, the label positions and the caption are now chosen by fixed rules, not by hand. Arrows that run along
  an axis, leave the frame, end on another arrow's start dot or crowd each other are dropped. A single-column figure
  has at most 8 arrows.
- The caption says only what is true of the arrows that are drawn. For example, it says "arcs of circles or segments"
  only when it has checked this, and it states the branch of F^t.
- The checkerboard fades smoothly where its cells get smaller than a pixel, so there is no moiré.

**Sidebar (items 3–6).**
- The tool hint line and the formula example chips are gone.
- There is one **Add** button: the formula's variable decides whether it adds a shape (z) or a target (w).
- Shapes and targets have matching empty notes: "No shapes yet. Draw one in the z-plane." and "No targets yet. Draw
  one in the w-plane."
- Pattern descriptions are tooltips. On touch, long-press shows them.

**Drawing on the Riemann sphere (item 8).** All tools work on both globes, except Annulus, Sector and Polar grid,
which are disabled there.
- Disc and Circle draw caps. A cap through ∞ is stored as a half-plane or a line, and a cap around ∞ as the
  complement of a disc.
- **A bug was found along the way:** today's globes are drawn as mirror images of the plane. A half-plane appears
  on the wrong side of its arrow, and the Tiles "F" is reversed. The fix, conjugating the lift to the sphere, lands
  with the next renderer phase (P3). It was checked numerically, and the mockups already use it.

## Speed: why this will not make the current renderer work longer

The first draft added globe editing, Phase on both panes and more to P3, the renderer phase that comes next. That
would have made P3's gate much longer. The work is now split so that only the lift fix touches P3:

1. **U-a**, right after the current P2 gate: items 3–6. About an hour, app code only, no renderer or performance
   impact.
2. **U-b**: left = X / right = Y (item 1). It reuses the existing render passes, moved between the panes.
3. **P3** as already planned, plus the globe-orientation fix.
4. **P3b**, after P3: drawing on the globes (item 8).
5. **Item 2** (the deformation figure) any time after U-b.

## Files to look at

- `mockup-1-planes.html`: the default state, the pane heads in every view, and the new sidebar.
- `mockup-2-phase.html`: Phase on the left (the portrait) with the images on the right.
- `mockup-3-globe.html`: drawing a cap on the z-sphere that snaps through ∞ and becomes a half-plane, with its image
  on the w-sphere.
- `proto/index.html`: the three deformation figures (`proto/out/morph-cayley.svg`, `morph-square.svg`,
  `morph-exp.svg`) and two on-screen mockups at t = 0.55 (`screen-cayley-t055.svg`, `screen-square-t055.svg`).
  `proto/out/selection-log.txt` lists which arrows were kept or dropped and why, with the generated captions.

The deformation figures were rendered and inspected as images. The three HTML mockups were rebuilt and their scripts
checked for syntax, but no browser was run (the machine has to stay quiet for the gate), so they have not been viewed
yet.

## Questions for you

1. **Right pane without Phase.** Is Plane · Sphere enough on the right? If you want the colour key in the w-plane,
   it would be a small "Key" switch inside the left pane's colour legend, not a separate view.
2. **The deformation figure.** Is the look right: grey X, coloured F(X), at most 8 arrows per column, labels
   placed automatically? Should the dotted boundary at t = ½ be on or off by default? It is off now.
3. **Tools on the sphere.** Is it acceptable that Annulus, Sector and Polar grid are disabled on the globes? Drawn
   there, they would not come out concentric with a Disc drawn at the same press.
4. **Order of work.** Should U-a (items 3–6) go in right after the P2 gate, before the larger panel change?

## The user's decisions (2026-10-20)

1. **Right pane:** Plane · Sphere only. Phase lives on X; the w-plane colour key is a small switch inside the left
   pane's colour legend.
2. **Deformation figure:** one plane as prototyped, **but with more arrows from more places** — not only boundary
   points and one interior point: sample the interior too (e.g. a well-spread set of interior points and boundary
   points), raise the cap above 8 per column, and keep the figure readable (thin strokes, consistent arrowheads,
   no crossings piling up at the start dots).
3. **Sphere tools:** Annulus, Sector and Polar grid are disabled on the globes.
4. **Order:** the small sidebar fixes (items 3–6, "U-a") go in right after phase 4; then left = X / right = Y
   ("U-b"), then P3 (+ globe orientation fix), then P3b (drawing on the globes), and item 2 any time after U-b.

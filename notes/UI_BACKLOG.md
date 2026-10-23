# UI backlog (from the user, 2026-10-20)

The user's framing: f : X → Y. "A few comments that do not concern performance and are only about UI, that would be nice
to work on later." To be scheduled after the current renderer work (P2 gate, P4 lines). Items 1 and 8 reshape the
panels and overlap P3 (globe, left plane, left globe, spherical checker, export), so they should be designed together
with P3 and shown to the user as a mockup before they are built.

1. **X on the left, Y on the right.** Every picture that lives on X (the domain: the shapes themselves, the phase
   portrait / domain colouring, the landscape over X, the left Riemann sphere) belongs in the left panel; every picture
   that lives on Y (the images of the shapes, the image on the Riemann sphere) in the right panel. So the left panel
   always shows the original shapes and the right panel always shows their transformed images. Controls must be simple
   and uniform across the two panels (the same view switcher, e.g. Plane / Sphere / Phase / Landscape where it applies).
   Today Phase and Landscape are right-plane modes although they are plots over X.
2. **Deformation (morph) as one unified picture**, and exportable as a figure: show X and Y together, with arrows that
   follow the natural paths of the homotopy (trajectories t ↦ H_t(z) of sample points), "nice and pretty".
   Ties in with the article-figure exporter (buildFigure / figurePDF).
3. **Remove the Select hint** "Select · Drag a shape to move it and its handles to reshape. Drag empty space…".
4. **Remove the example formula chips** under "Region from a formula" (|z| < 1, 0 < Im z < π, 1 < |z| < 2, …).
5. **Empty states:** "Shapes — No shapes yet. Draw one with the tools above." and "Targets in the w-plane — Draw in the
   right plane of Image to add a target: the left plane shows its preimage." should read alike and be simple.
6. **Pattern descriptions:** drop the always-visible description line under the pattern swatches (e.g. "Tiles with an
   F glyph: shows rotation, scaling and reflection"); keep it only as a tooltip / pop-up.
7. **Bug: patterns look different in motion and at rest** — "the patterns have different opacities when I move and
   when I stand still. Letter F appears and disappears." Seen in the published v9 (before the inverse renderer).
   Candidates to check with a reproduction: hover dimming (other shapes at 0.5 alpha while the pointer is over a
   shape, app.js drawScene), fix-up extras/skip flags only present at rest (forward path), the Tiles glyph's
   size threshold (smoothstep(10, 16) px on the cell footprint), and — in the new renderer — the cost guard's
   half-resolution motion frames and forward stand-ins. Whatever the cause, motion and rest must look the same.
   **Reproduction (user, 2026-10-20): it happens while panning the view and while dragging a shape.** Code reading
   rules out hover dimming (set only from the shape-list rows). Remaining suspects for the published build: during a
   shape drag the mesh is rebuilt every move and fix-ups are paused (fixBusy), so triangles straddling cuts/poles are
   drawn unflagged and overlap (darker where alpha < 1) until the fix-up runs at rest; during a pan, clipWin moves after
   30 % of the window (stretched-mesh rebuild, fade box, fix-ups re-run) and map-cache misses draw stand-ins. Plan:
   capture mid-motion and at-rest frames of both interactions with the Tiles and Checker patterns, on the published
   build and on the new renderer, diff them, and fix until they are identical.
8. **Shapes on the Riemann sphere view:** drawing tools that work on the globe (draw on the sphere of X; targets on
   the sphere of Y).

9. **Equation curves (1-dimensional regions)** (user, 2026-10-21): "Could you allow for 1-dimensional regions? For
   example, if I want to define a line as Re z = 0? I cannot do it right now." Plan: '=' in the formula box defines a
   curve (Re z = 0, |z − 1| = 2, Im z² = 1, arg z = π/4, …); equations 'and' inequalities cut pieces (Re z = 0,
   Im z > 0 is a ray); 'or' unions; simple equations recognised exactly (true lines/circles through ∞), general ones
   traced to float64 accuracy; they map through the chain, work on globes, as targets (w-equations pull back to
   curves) and for integrals when closed. Engine (parse.js + src/curves.js + tests) built first; app wiring after the
   P5 gate (notes/curves-design.md).

10. **Deformation round** (user, 2026-10-22): "Remove linear homotety. Make deformation lines togglable. What is natural
    path? I really like it, is there room for improvement? Can we define polynomials by setting dragging their roots?"
    Chosen: remove the straight-line path; a proper Paths toggle (button, key P, saved, export option); more natural
    paths (Joukowski as the Cayley-conjugated power path, trig via exp/Joukowski/Möbius paths, inverse trig reversed,
    polynomials/rationals with zeros and poles flying in from infinity); an "all steps at once" option; a new
    "Zeros and poles" step with draggable zeros (dots) and poles (crosses). Not chosen: even speed, time ticks.

11. **Publish to GitHub Pages** (user, 2026-10-22: "Can you publish it to my github later? Just use github sites").
    Decided: PUBLIC repo `Alarion239/complex-map-workbench` (gh CLI is logged in as Alarion239 with repo scope),
    contents "Everything": source, build.py, the regression suites and unit tests, the design notes; the built app
    served by GitHub Pages at https://alarion239.github.io/complex-map-workbench/ (a full HTML document: doctype,
    UTF-8 charset, viewport; the downloads capability falls back to normal browser downloads). Exclude junk: headless
    Chrome profiles, CDP daemon copies, screenshots/out renders, results logs, and the milestone-* source snapshots.
    Do it after the deformation and export rounds pass their gates.

12. **Guided tour** (user, 2026-10-22): "make a guided tutorial of what is possible. Highlight patches and write
    comments. Remember that the tutorial was already shown if it was and make it as a suggestion on opening, no forced.
    Make it appear on the press of the help button. We have so many functions that I think we should teach people."
    Plan: spotlight steps with callouts (and Try-it checks) in chapters; a non-blocking first-open suggestion
    remembered in localStorage; the help button opens the tour with a chapter menu; the tour runs on its own example
    and restores the user's work. Engine + content in src/tour.js (notes/tour/), wired into app.js after the
    deformation round, then gated with the rest.

13. **Sound** (user, 2026-10-22: "I am curious whether it is possible some sound effects? Togglable."). Investigated:
    feasible in the artifact frame and on GitHub Pages (a click inside the frame starts Web Audio), synthesised, about
    10 KB, off by default. Design + playable prototype in notes/sound/ (README, DESIGN.md, prototype.html). Stage 1:
    interface + mathematical-event sounds + controls; Stage 2: "hear the function" (Shepard tone for arg F, loops make
    the winding audible, listen along a curve, keyboard probe). The user listened ("I like the sound ... otherwise really nice"), reported snaps while moving (being fixed in
    the prototype), and chose BOTH STAGES (2026-10-22).

14. **Russian localization** (user, 2026-10-22: "Can you add russian localization if system language is russian?").
    Defaults chosen (to confirm with the user): Russian when the browser's first preferred language is Russian, else
    English; a Language setting (Auto, English, Русский) in the More menu and the palette, stored on the device only;
    exported captions and LaTeX follow the interface, with a caption-language switch in the export dialog; Russian
    notation (tg, ctg, sh, ch, th, arctg) in the Russian interface, the parser accepting both spellings (CONFIRMED by
    the user, 2026-10-22: notes/i18n/USER-DECISIONS.md); letter
    shortcuts working on the Russian keyboard layout (e.code). Phase 1 (design, glossary, string inventory,
    translation, reviews; no src changes) runs now in notes/i18n/ with a prototype copy in work/xl; phase 2 builds it
    into the merged export/sound/tour round (work/xr), then the full gate.

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

15. **No "No shapes yet" banner** (user, 2026-10-22: "Please stop showing 'no shapes yet,' it is just a banner that
    prohibits normal work."). Being removed in the v14 round (work/xr, last fix pass).

16. **Function chain redesign** (user, 2026-10-22): "it makes sense to redesign individual visualizations for each of
    the functions in the chain to match the view that is currently open. However, I want bigger buttons for adding
    poles and zeros in the rational function regime AND I would like to be add them directly on the map by right
    clicking and selecting an option. I think it is not as important what the exact formula is inside of the small
    subfunction card — it does not fit either way. The type is enough. It is just quite bad controls for Function
    chain. I like the idea, but I think there is not enough space to be comfortable setting them."

17. **Guarantees take too much space** (user, 2026-10-22): "we use too much space on guarantees, which are only
    important for the final function (and not really THAT important for visualization, I would not mind just removing
    or shrinking this functionality a lot)."

18. **Constructions and shared parameters** (user, 2026-10-22): "What I would appreciate is ability to parametrize
    lines by some shared number that I can later change in one place/draw lines through points/circles through three
    points. Please research how this would be possible to implement. I think maybe we sacrifice the right panel?"

19. **Phone view** (user, 2026-10-22): "look into the phone view: right now there are too many elements and different
    menus to scroll around. It should be more easy for phones."

Items 16-19: design and research first (notes/ui-redesign-2/, mockups for the user), built after v14 (export, sound,
tour, Russian) is gated.

20. **Guided tour polish** (user, 2026-10-23: "I love the guide. I am sure it will be changed with the tweaked UI, but
    please make sure that it highlights exactly the right area & that it is always on the foreground (even when
    command-K is opened) and that the buttons are easy to press and that they always fit inside the box").
    Requirements for every chapter and step, at every width (360-1440 px), light and dark, English and Russian:
    the spotlight matches its target exactly (and follows it on resize, scroll and layout changes); the tour's
    callout stays on top of every app layer (the ⌘K palette, menus, dialogs, sheets, tooltips) without hiding what
    the step asks the user to use; buttons are large enough to press easily (44 px on touch) and always inside the
    callout. Built in work/xvt (engine), merged into v15, and checked by an automated audit of every step.

21. **Sound follows the deformation** (user, 2026-10-23: "During deformation, sounds must also follow the
    deformation. Now they only change during deformation if I move my mouse"). The pointer tier must re-evaluate
    H_t at the still pointer every frame while the deformation plays or is scrubbed (and, generally, whenever the
    function under a still pointer changes: dragging a zero or pole, editing a step, a shared number's slider or Play
    in v15), click-free and within the per-event budget. Built in work/xvs, merged into v15.

22. **Export, round 3** (user, 2026-10-23): "Allow export of the deformation plots as deformations. Now they are
    exported as deformations only for Plane-shape figure. Also allow for png, svg, and video exports (video for
    deformations). In case of png provide latex-copiable snippet. Write the formula for F in displaystyle, since it
    might be too complicated to fit inline." So: the deformation figures (filmstrip, paths) for every view that shows
    the deformation (X -> Y on the plane and on the sphere, Phase, Landscape); PNG, SVG and video as first-class
    formats (video for the deformation); a copyable LaTeX snippet for PNG; F set in display style in captions and
    snippets. Built in work/xve, merged into v15.

23. **Sound on by default** (user, 2026-10-23): "Make the default for sound to not include function sounds, since it
    may be annoying for some. But by default include sounds for different events. And you can turn on the sound by
    default then, as the small clicks are fine." In v15: Sound on, Interface and Events on, Hear F off; the audio
    starts at the first click or key press; a stored choice wins; ?ns= test pages stay silent. notes/sound/README.md.

24. **Tour on a real phone** (user, 2026-10-24: "On my phone, the guide is kind of jiggly when I scroll (the
    selections) & the tour pop-up often blocks the area where I am supposed to work"). The spotlight lags and jitters
    while scrolling on a real phone (momentum scrolling, the collapsing URL bar, the visual viewport), and the callout
    covers the work area of Try-it steps. Fixed in work/xvp for patch v15.1.

25. **Phone X/Y swap drifts the zoom** (user, 2026-10-24: "on phone, if I continuosly swap between X and Y (codomain
    and domain), it will just constantly scale the view depending on whether the map is contraction or
    anticontraction. It will just scale me to infinity or to 0, which is wrong: it should preserve approximately the
    same scale"). Each plane must keep its own view through swaps (and sheet open/close, rotation, view switches);
    repeated transitions must not drift. Fixed in work/xvq for patch v15.1.

26. **Recognize LaTeX formulas as built-in functions** (user, 2026-10-24: "I think what would be nice if you could
    pattern match latex functions to our implemented functions, at least partially, and optimize them using that.
    If I LaTeX-write a function that is already optimized it would lag a lot currently."). A custom formula that is
    (or composes) catalog functions should run on their exact, fast paths (inverse renderer, natural paths,
    guarantees) with identical values and branches; partial recognition where only parts match. Built in work/xvr.
    Also (user, 2026-10-24): "latex for z^{complex} is not the same as just formula for z^{complex}": LaTeX and plain
    spellings must give the same function, branch, path and speed.

27. **Animated video preview** (user, 2026-10-24: "When i export figure as movie, it does not show preview moving: it
    is a still image that updates only on click."). The export dialog's Video preview should play the deformation.
    Built in work/xvv for a v15 patch.

28. **Beautiful deformation paths** (user, 2026-10-24: "Paths in the deformation images are kind of chaotic right now,
    and look honestly horrible. I think there is a lot of work to be done to make them esthetically pleasing"). The
    live paths t -> H_t(z) and the exported paths figure: seeds, spacing, smoothness, styling, clutter, escapes to
    infinity. Designed (three directions, judged) and built in work/xvz for a v15 patch, with before/after images.

29. **Sound, round 2** (user, 2026-10-24): "when I drag the time for deformation it makes cracking sounds. Is it
    supposed to do them? I come to not really like the sounds. They are not as nice and quite mechanical when played
    constantly. Maybe you can try making them more realistic and animated as well". The scrub ticks (one per 0.05
    of t, by design) crackle when dragging fast: quick mitigation in v15.1 (work/xvk). Then a redesign of the whole
    sound palette (natural, varied, responsive to gesture speed), prototyped as an A/B board for the user to
    listen to before it is built (notes/sound/v2/).

30. (2026-10-24) When a typed formula is recognized, offer to split it into its visible chain steps, nicely, so the user sees what F is assembled from and every transform. In v15.2 (notes/formula-steps/).
31. (2026-10-24) Function search: "sin z" must match the Sine step; a query that is one catalog step adds that step directly (custom formula second). In v15.2.
32. (2026-10-24) Constructions now (v16, work/xvc): circles through 3 points, lines through 2 points, intersections, points on curves, from every point already on the page (named points, zeros and poles, shape handles, curve crossings); their regions. notes/constructions-v16/.
33. (2026-10-24) Music example: Grieg, "In the Hall of the Mountain King" (public domain; the user chose it after the copyrighted Pirates theme was declined), adapted to the harp's five strings, accelerating and growing louder, played by one curve; in Examples and the sound guide. notes/sea-song/, work/xvsea.
34. (2026-10-24) Choose the deformation range: deform a contiguous range of steps with the steps before applied first and the steps after applied last (push-forward of an inner image; pullback under an outer step, e.g. f(z) -> f(sqrt z)). v16, notes/deform-range/.
35. (2026-10-25) Tour: highlight exactly the tool each action step needs; the card-pictures step must guarantee pictures (not compact). 36. All sheets during the deformation (sin sqrt z: see the sheets split/merge). 37. LaTeX caption: no "all sheets" claim for infinitely many sheets. 38. Figure export More options shows nothing. -> notes/v16-user5/.
39. (2026-10-25) Landscape 3D: continuous walls where continuous (no holes, however steep), nothing across real discontinuities (cuts, sheet seams), clean edges at the height box. notes/landscape-walls/, work/xvls.
40. (2026-10-25) Perpendicular circle: a construction tool for circles perpendicular to a line or circle (through 2 points = hyperbolic lines). notes/orthogonal-circle/. v16.3.
41. (2026-10-25) Touching (tangent) lines and circles to a line or circle, with the perpendicular tool. notes/orthogonal-circle/TANGENT-*. v16.3.
42. (2026-10-26) Help paragraph on the deformation: the polynomial sentence is out of date (polynomials zoom); fix with the v16.4 merge. Joukowski path stays (user).
43. (2026-10-26) Tour round 3: lighter callouts (phones: readable without a tap, no pop-up over the work), every action step with a completion condition and auto-advance 3 s after, a Grieg/sound chapter explaining how sound is extracted. notes/tour-r3/, work/xvtr.
44. (2026-10-26) Old Windows laptops: lag on the first draw only (shader compile); the user finds it fine. Possible later: KHR_parallel_shader_compile, warm-up compiles.
45. (2026-10-26) Hyperbolic segments: "inside C only" option for perpendicular circles (the arc inside C). v16.4, notes/orthogonal-circle/segments/, work/xvhs.
46. (2026-10-26) UX audit of every function on laptop and phone ("find weak spots, optimize the user interactions ... After design and before implementing, give me options ... not performance"). Done on the v16.4 merge (work/xux): 8 area audits, 106 findings (17 high), 25 re-tested (23 confirmed, 2 partly), 3 new from a completeness pass; 12 decisions D1–D12 with options and ~70 quick wins. notes/ux-audit/REPORT.md (+ REPORT.html with pictures), options-phone.md, options-laptop.md, mockups/. Waiting for the user's choices; nothing built.
    2026-10-26 the user chose: all recommended options (A for D1–D12) plus the quick wins, rule restorers first. Wave 1 (restorers + quick wins) -> v16.5; wave 2 (D1–D12 + day-sized items) -> v17. notes/ux-build/
47. (2026-10-26, v16.4 review v164-3, from v15) Tour strip on a landscape phone (844 × 390): 4 audit checks fail, as since v16.2. The tool row (basics/draw) and the transport (deform/transport) sit under the chain bar, so their task controls are not lit; the basics/shapes anchor is below the sheet's fold; deform/paths' Paths is cut. Fix with the landscape-phone layout. notes/workflows/review-v164.json.
48. (2026-10-26, v16.4 review v164-1) Landscape walls redesign patch (after v16.4): also cover the cold open with the deformation started right after the open. Measured up to about 0.4 s per stall (All sheets 383-400 ms, principal surface 217-383 ms) on the first runs with a cold shader cache; v16.3 had one 517 ms stall with All sheets and none on the principal surface. notes/landscape-walls/MERGE-NOTES.md (verify-3, verify-4), notes/v16.4-candidate/README.md.
49. (2026-10-26, v16.4 release smoke) Landscape walls, step cards: with All sheets, a deformation started in the first seconds of a fresh Landscape keeps the step cards' pictures empty until the play pauses (v16.3 showed them; started after the Landscape has settled, they show). Cause: gl.js drawLandscape's card wait keeps one `landPane.waitKey`, so two or more cards reset each other's 3 s cap every frame. Fix with the walls redesign patch (a wait start per card key), together with item 48 (first draws in moving frames). notes/v16.4-candidate/README.md.
47b. (2026-10-26) Snapping and railing (user: "points should snap to the grid & to figures ... place a point on a unit circle ... move it around the circle ... drag it hard enough to detach from the railing ... free moving"; and the bug "needs distinct points" for two points of a perpendicular circle on one circle: refKey of a curve-piece pick has no position). Wave 1, piece xu1-rail, notes/ux-build/rail/SPEC.md.

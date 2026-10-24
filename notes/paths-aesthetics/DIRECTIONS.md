# Deformation paths: audit and three directions (2026-10-24)

The user: "Paths in the deformation images are kind of chaotic right now, and look honestly horrible."

Prototype in `work/xvz` (a copy of v15), behind a test-only switch: `window.__pathStyle = 'A' | 'B' | 'C'` (unset:
today's arrows, unchanged). Renders: `test/pa_render.js` with the 8 scenes of `test/pa_scenes.js` (CDP daemon,
`test/pa_cdp`). Every scene at 1440 x 900: the merged plane in light and dark at t = 1/2, light at t = 1, the merged
globe at t = 1/2, and the exported paths figure (Article one column and Homework, black and white; the globe's
Article B/W). `before/` also has the colour Article and a frame taken while playing.

Scenes: `jouk` Joukowski of the outside of a disc; `rational` (z^2 - 1)/(z^2 + 1) on a square with a grid; `expstrip`
exp on the strip |Im z| < pi/2 with a grid; `chain3` exp, Cayley, z^2 all at once; `cosstrip` cos on 0 < Re z < pi;
`cube` z^3 on a 60 degree sector (with a polar grid); `mobius` the Cayley map of the upper half-plane; `zp` zeros
+-0.8 and a pole 0.5i on a disc.

Side-by-side sheets (rows: today, A, B, C; columns: the 8 scenes): `compare-<view>.png` in this folder.

## 1. What makes today's paths look bad (before/)

1. **Too many.** 20-40 paths on screen (36 on the 848 px pane for `rational`), 20 in the Article figure and 32 in
   Homework; they fill every gap of the picture (`rational-plane-light-t05`, `jouk-plane-light-t05`).
2. **Five marks per path.** At t = 1/2 each path is a start dot, a dark travelled part on a light halo, a dark
   arrowhead, a grey rail for the rest and a second grey arrowhead at its end (`cosstrip-plane-light-t05`). The rails
   double the number of lines and look like the ghost grid of X under them.
3. **Bundles and crossings.** The choice allows 2 crossings per path and 30 % of a path alongside another, so maps that
   turn everything the same way give bundles of near-parallel arcs: cos (the left half), `chain3`, `mobius` (nested
   semicircles), `zp` (a knot at the pole), `cube`.
4. **Loops and long excursions.** One path near Joukowski's cusp loops around a quarter of the panel; `rational` has
   ellipse-like loops on the left; cos arcs leave the region and come back (`jouk-export-article-bw`,
   `rational-plane-light-t05`).
5. **The far field wins.** Outside the Joukowski disc, points at the panel's edge give long radial needles across the
   whole checker; the airfoil, the interesting part, gets few.
6. **No pattern in where they start.** A z-lattice, the boundary's lattice crossings and Newton-pulled heads mix:
   partly gridded, partly random. In the export the start dots sit on the frame and even outside it (right edge of
   `jouk-export-article-bw`: dots at x > 6).
7. **Heads pile up** where the map contracts: a starburst of arrowheads at 0 in `expstrip`, at the inner circle in
   `rational`.
8. **Weight and colour.** 1.25 px ink-2 on a 2.8 px halo: on the blue checker the halo reads as a white double line
   ("railroad"); in dark the paths are pale grey like the grid and the ghosts, so paths and grid do not separate
   (`*-plane-dark-t05`).
9. **Globe.** Hairlines with tiny dots, bunched at the limb, the same colour as the grid curves
   (`*-globe-light-t05`). The globe export draws them with the same black and white casing as the boundaries, so
   paths and grid look alike; 0 to 8 paths (`expstrip`: none).
10. **Cuts and poles.** A path through a cut or a pole is dropped whole, never split: no paths near cuts (the
    `expstrip` globe export has none).
11. **Print.** 0.45 pt black on a white casing over the 50 % grey checker: double lines; Homework's 32 paths read as
    hatching.
12. **Motion.** A play frame (`*-plane-light-playing`) has the same rails and arrowheads as a still, so it is just as
    busy.

## 2. What all three directions share (new code, `src/app.js` "path styles", `src/figure.js` "paths-aesthetics")

- **Same points at every t.** Each path is traced over all of [0, end] when it is chosen, so scrubbing and playing never
  change the set (no popping). The choice runs off the frame in slices, as before, and is cached by chain, shapes,
  view and style.
- **Smooth.** `traceRuns`: 48 shared times per unit of t, each gap refined while its chord is over 1.5 px or its
  midpoint is more than 0.05 px off the chord (screen arclength and turning; no kinks). The export samples its own
  curves the same way in pt (`sampleRunsT`, 1.2 pt / 0.03 pt).
- **Cuts and poles split, never jump.** A path breaks into runs where H_t is not finite, very far off, or jumps (a
  chord still over 20 px after 14 halvings). Nothing is drawn across the gap.
- **Off to infinity.** A path may leave the panel when most of it is inside: it is clipped at the edge with a small
  open chevron pointing out (screen and export).
- **No monster loops.** A path more than 2.6 times longer than the way from z to F(z) (+40 px) is not chosen.
- **Colour.** Ink (`TH.ink`) on a halo of the plane colour (`TH.halo`), so it works in light and dark and on Phase.
  Never louder than the picture: at most 1.4 px of ink on screen.
- **Export.** Vectors, weights in pt, black and white (the figure is printed); clipped to the panel. The globe export
  uses the screen's points.
- Scale: the export's spacings are the screen's x 0.7 in figure px (1/96 in).

## 3. The three directions

### A. Comet trails (`directions/A/`)

- Points: a square grid over X and its boundary, then farthest-point: starts at least 62 px apart and ends 26 px
  apart, at most 16, at most one crossing each, at most 20 % of a path within 8 px of another.
- Live: only the travelled part 0 -> t, as a trail that grows from 0.5 px and 12 % opacity at t = 0 to 2.4 px and
  full ink at the moving point; a round head (2.9 px on a 4.1 px halo); no arrowheads, no start dots, no rails.
- Export: the trail as a tapered band (0.25 -> 1.2 pt) in six greys from light to black, on a white casing; a 1.35 pt
  black head at F(z).

### B. Streamlines (`directions/B/`)

- Points: evenly spaced streamline placement (Jobard-Lefer): a 16 px grid of seeds over X and its boundary, taken
  farthest-first; a path is kept only if, away from its own two ends, it never comes within 0.6 x 16 px of a kept path
  and never crosses one (paths may share a source or a sink, as at Joukowski's segment). At most 44.
- Live: the whole path faint (1 px, 26 % ink), the travelled part strong (1.35 px on a halo), small arrowheads every
  72 px of arclength (strong on the travelled part, faint ahead), a 2.1 px dot at H_t(z). No start dots.
- Export: 0.5 pt lines on a 1.3 pt white casing, 3.4 pt arrowheads every 30 pt of arclength.

### C. Boundary paths with time beads (`directions/C/`)

- Points: only on X's boundary (its area shapes; the curves when there is no area), every 4 px, then farthest-point:
  starts 40 px apart along the boundary, ends 18 px apart, at most 22, at most one crossing. The paths show where the
  boundary goes, which is what the image's edge does; the checker already shows the inside.
- Live: the travelled part solid (1.25 px on a halo), the rest dotted and faint; beads at t = 0, 1/4, 1/2, 3/4 and 1
  (open ring at 0, small dots between, a larger dot at the end; faint until t reaches them), the moving point a 3 px
  dot. Bead spacing shows the speed; no arrowheads (open -> filled gives the direction).
- Export: 0.45 pt lines on a white casing, beads: open 1.2 pt circle at t = 0, 0.78 pt dots at 1/4, 1/2, 3/4, a
  1.3 pt dot at t = 1.

## 4. What to look at, and how each one does

Files: `directions/<A|B|C>/<scene>-plane-light-t05.png`, `-plane-dark-t05`, `-plane-light-t1`, `-globe-light-t05`,
`-plane-light-playing`, `-export-article-bw.png|.svg`, `-export-homework-bw.png|.svg`, `-export-globe-article-bw`,
`-export-article-colour`. Start with `compare-plane-light-t05.png` and `compare-export-article-bw.png`.

Paths kept (Article B/W): today 11-29 per scene; A 3-16; B 6-44; C 4-16.

- **A (comet trails)** is the calmest live picture and the best in motion: one mark per path (the head), the trail
  says where it came from without an arrowhead, and a play frame looks like a still. Weakest in print: the grey tails
  vanish on the 50 % checker (fixed the white-casing "needles"; tails are still faint), and a static figure needs
  the reader to know that thick = late. Good on `jouk`, `rational`, `chain3`, `cosstrip`.
- **B (streamlines)** gives the most "article" figures: `jouk`, `chain3`, `mobius`, `cosstrip` read like textbook
  flow plots, evenly spaced, nothing crossing, the direction everywhere from small arrowheads. Live it is the busiest
  of the three (faint rails plus arrowheads) but far calmer than today. Where paths must cross (cos turns everything
  by pi) it keeps only a few (6).
- **C (boundary paths with time beads)** explains the deformation best where the boundary is the story (`jouk`: the
  circle collapsing onto the lens; `mobius`: the real line wrapping onto the circle; `chain3`). The beads show speed.
  It has the fewest paths in the middle of X, and with no arrowheads the open/filled convention must be in the
  caption.
- **All three** are weak on `cube` (the 60 degree sector is small in the figure and its paths are short; 3-6 paths)
  and `zp` (the pole inside the disc: the image covers the plane, paths are split and short).

My pick for the next round: **B for the export and C's idea for the live view**, or B everywhere with A's live
treatment (travelled part only, no rails) while playing. Deciding needs the user's eye.

## 5. Not done / open

- Captions still say "Arrows are the paths ... from z (dot) to F(z)" for every style; each style needs its own
  sentence (A: "trails thicken towards F(z)"; C: "open circle z, dots at t = 1/4, 1/2, 3/4, filled dot F(z)").
- The globe chooses its points in the flat frame (as today), so they are not evenly spread on the sphere; it needs a
  spacing on the sphere. The globe export uses the screen's points.
- Not checked: phone widths, Phase colours, 60 fps while playing (the choice is off the frame as before, but the
  per-frame drawing of A draws 28 strokes), the light-theme colour export beyond the files above.
- The loop rule (2.6 x the chord) drops honest paths (Joukowski's cusp); a caption could say so.
- `test/pa_render.js` renders; it is not a pass/fail test.

## 6. Code (for the v15 patch)

- `src/app.js`: the block "path styles" after `drawMorphPaths` (`pathStyle`, `PSP`, `traceRuns`, `stylePathsGen`,
  `styleRetrace`, `drawStyledPaths`), and five one-line hooks: `drawMorphPaths` (draw by style), `mfScreenKey` (style
  in the key), `mfStartJob` (choose by style), `morphSelScreen` (re-trace by style), `buildFigure` (style in the
  figure's key and choice), the figure API `pathStyle`.
- `src/figure.js`: `sampleRunsT`, `styledPathsSvg`; hooks in `figPaths` and `figGlobePaths`.
- With `window.__pathStyle` unset nothing changes.
- `test/pa_scenes.js`, `test/pa_render.js` (prepend `const STYLE = 'A', OUT = '<dir>', ONLY = [], EXTRA = false;`).

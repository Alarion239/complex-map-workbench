# Deformation paths: as built (2026-10-24)

The user: "Paths in the deformation images are kind of chaotic right now, and look honestly horrible."

Built in `work/xvz` (a copy of v15), for a 3-way merge into a v15 patch. The design is B from the study
(evenly spaced streamlines), with the judges' grafts from A and C. Today's arrows, the test-only switch
`window.__pathStyle` and the A/B/C prototypes are gone.

## What a path is now

- **Which points.** The selection is evenly spaced streamline placement (Jobard-Lefer). It seeds X's boundary
  first, every 8 px. The boundary takes up to 55 % of the paths; then the boundary and a 24 px grid inside X are
  chosen together, farthest first.
  - Starts are at least 34 px apart. Ends are at least 26 px apart, so heads never pile up at a sink.
  - No end dot lands on another path's start.
  - A kept path stays 14 px from every other path, away from its own two ends, and crosses none. If that leaves
    fewer than 8 paths, a second pass allows one crossing and 10 px.
  - A path longer than 3 x 34 px also keeps 31 px (2.2 x 14) from the other paths over at least 80 % of its length.
  - A path's own ring and end dot stay 13 px from its own line (beyond its first and before its last 34 px).
  - At most one path far longer than the way from z to F(z) is kept (for example the Joukowski cusp loop).
  - Left out: a path that goes back over itself (over 20 % of it within 2 px of an earlier part), a hairpin
    (a turn tighter than about 4 px of radius), a path that leaves the view and comes back, a start within 17 px
    of the frame, a corner where steps meet that turns over 120 degrees (or over 100 with a leg under 2 x 34 px),
    and a stub under 41 px (one at most, and only in the last, looser pass; never on a pane under 500 px on its
    short side, where longer paths are also preferred).
  - There are at most 18 paths on a desktop pane, one per 110 x 110 px, and at most 0.7 x (short side / 110)^2,
    so a 390 px phone gets at most 8. From the second path on, the kept paths add up to at most
    2.5 x sqrt(pane area) px of line. The figure gets at most 12 (5 when X fills under 5 % of the frame), and the
    globe at most 9 (with 1.4 x the spacing). The globe does not prefer boundary points and keeps no path that lies
    along X's outline.
- **Smooth.** Each gap between samples is refined until its chord is under 1.5 px and the midpoint is within
  0.05 px of the chord. This is adaptive in screen arclength and turning.
- **Cuts and poles.** A path splits into runs where H_t is not finite, very far off, or jumps. A jump is a chord
  still over 3 px at a time step of Tend/786432. Nothing is drawn across the gap.
- **Off to infinity.** A path that leaves the view is clipped, with a small open chevron at the edge (on screen and
  in the figure). A run that comes into the view gets a chevron pointing in, and on the globe a run that goes
  behind the limb (or comes back) gets one too. A path whose start has left the view (a pan, a scrub's auto-fit)
  stays, clipped, with the chevron pointing in. When more than one start is out of view, the paths are chosen
  again, and the old set fades out while the new one fades in (150 ms).
- **Stable.** Every path is traced over all of [0, end] when it is chosen, so scrubbing and playing never change
  the set. The choice runs in slices off the frame, as before.

## How it looks

- **Live (merged plane and globe).** Only the travelled part 0 -> t is drawn, so a frame while playing looks like a
  frame at rest.
  - The line is 1.4 px of ink (1.6 px on the globe) on a 3.6 px halo of the plane colour at 55 %. That works in
    light and dark.
  - Each start z has an open ring. Once the moving point has passed t = m/2, an arrowhead (9.5 x 6.4 px) is drawn
    there, on paths of 60 px or more (41 px on a phone-size pane, so every kept path gets one). There are no time
    dots live, since there is no caption to explain them.
  - Steps one after another: an arrowhead in the middle of each step (t = 1/2, 3/2, ...) and a short bar across
    the path where one step ends and the next begins (t = 1, 2, ...), never an arrowhead on that corner.
  - The moving point H_t(z) is a filled dot. At t = end it is the end dot at F(z).
  - Nothing is drawn ahead of the moving point: no rails, no arrowheads.
- **Figure (vector, black and white for print).**
  - Line weights are in pt: 0.5 pt black on a 1 pt white casing. Every casing is drawn before every black line, so a
    bar or a chevron never cuts its path. There is no transparency, since the PDF preflight forbids alpha.
  - Each path has an open ring of 1.3 pt at z, dots of 0.65 pt at t = m/4 and 3m/4, a 3.4 pt arrowhead at m/2, and
    a filled dot of 1.3 pt at F(z). Steps one after another: a 3.4 pt arrowhead in the middle of each step and a
    3.2 pt bar where the steps meet, no dots.
  - The figure also leaves out a path with under 70 % of its length in the frame, or with over 30 % of it (away
    from its own ends) within 1.5 pt of X's outline or its image.
  - A mark too close to another mark is left out.
  - The paths are chosen in the figure's own window, so every start lies inside the frame. The colour export uses
    the same black paths.
- **Captions** (English and Russian): "Curves are the paths t ↦ H_t(z) of N boundary points and M interior points,
  from z (circle) to F(z) (dot), with small dots at t=1/4 and t=3/4 and an arrowhead at t=1/2." The globe's
  caption has the same marks. For steps one after another: "... with an arrowhead at t=1/2, 3/2 (the middle of
  each step) and a bar at t=1, where one step ends and the next begins."

## Before / after

Sheets: `before-after-plane-light-t05.png`, `before-after-export-article-bw.png`,
`before-after-plane-light-playing.png`, `before-after-globe-light-t05.png` (top row before, bottom row after;
scenes jouk, rational, expstrip, chain3, cosstrip, cube, mobius, zp). Full files: `before/` and `after/` (same
names, same views). `after/` and the sheets were rendered again after the verify fixes; `after/review/` has the
review's gallery examples (Strip to disk, Cayley then cube, Quarter plane, Disk automorphism, Sine of a half-strip,
Log of an annulus, Square root: plane at t = m/2, 3m/4 and end, dark, globe, phone, Article B/W).

| | before (v15) | after |
|---|---|---|
| Paths on screen (1440 x 900, t = 1/2) | 20-40 (rational 36) | 3-12 (jouk 12, rational 7, expstrip 3, chain3 3, zp 11) |
| Paths in the Article figure (B/W) jouk / rational / expstrip / chain3 / cos / cube / mobius / zp | 29 / 20 / 19 / 27 / 12 / 11 / 14 / 13 | 11 / 6 / 6 / 4 / 3 / 5 / 3 / 4 |
| Homework figure, same order | 38 / 32 / 36 / 34 / 18 / 19 / 24 / 25 | 11 / 5 / 8 / 4 / 3 / 5 / 5 / 8 |
| Marks per path, live | 5 (start dot, travelled line on halo, head, grey rail, rail arrowhead) | travelled line, start ring, passed time marks, moving dot |
| Frame while playing | as busy as a still (rails, arrowheads) | the same marks as a still at that t |
| Spacing | 2 crossings and 30 % alongside allowed: bundles and knots | no crossing and 14 px apart away from the ends (0 % of any path within 9.8 px of another, 5 scenes) |
| Heads at sinks | starbursts (expstrip at 0, rational) | ends 26 px apart |
| Starts in the figure | on the frame and outside it | always inside (chosen in the figure's window) |
| Time in the figure | none (arrowhead at the end) | equal-time marks at m/4, m/2 (arrowhead), 3m/4; chains: an arrowhead per step, a bar where steps meet |
| Print | 0.45 pt on a white casing over the grey checker, which reads as a double line | 0.5 pt on a 1 pt casing, no alpha |
| Cuts and poles | path dropped whole | split, nothing drawn across |
| Dark mode | pale grey like the grid | ink on a dark halo, separates from the grid |

## Measured (headless Chrome, 1440 x 900; `test/deform_nat_cmd.js` part 9, `__cmwPathsCheck`; after the verify fixes)

| scene | n | jump (px) | kink (rad) | turning p99 (rad/px) | separation | head error (px) | playing fps / p95 / max (ms) |
|---|---|---|---|---|---|---|---|
| jouk | 12 | 0.013 | 0.067 | 0.089 | 0 | 0 | 60 / 17.9 / 18.4 |
| rational | 7 | 0.050 | 0.099 | 0.073 | 0 | 0 | 60 / 17.8 / 18.3 |
| expstrip (no grid) | 3 | 0.050 | 0.014 | 0.013 | 0 | 0 | 60 / 18.1 / 18.7 |
| chain3 (all at once) | 3 | 0.050 | 0.042 | 0.022 | 0 | 0 | 59.9 / 18.1 / 18.7 |
| zp | 11 | 0.048 | 0.109 | 0.161 | 0 | 0 | 59.9 / 17.8 / 18.5 |
| phone 390 x 844 (rational; `after/rational-phone-light-t05.png`) | 8 | | | | 0 | | |

The columns are defined as follows:

- **jump:** the largest distance of H at a segment's mid time from the segment's midpoint, over segments longer
  than 3 px. A jump across a cut would be about half the segment.
- **kink:** the largest angle between two drawn segments that are both over 1.5 px.
- **separation:** the worst path's share of length within 0.7 x 14 px of another path, away from the paths' ends.

With all 8 scenes, the 60 fps run (`check`) gave p95 at most 18.4 ms, and the largest single frame was 18.8 ms.

The selection (morphfig) takes 14-77 ms of wall time in slices, with no long task. The machine was shared with
other headless browsers during these runs.

## Review fixes (review.json, 12 findings; 2026-10-24)

All 12 are fixed at the root; one part of path-8 is rejected (below). The numbers are from `after/review/`
(walk at 1440 x 900, t = end, and 390 x 844 at t = m/2), before -> after.

| # | finding | fix | evidence |
|---|---|---|---|
| path-1 | chains one after another: sharp corner at t = 1 with the one arrowhead on it | an arrowhead in the middle of each step (t = k - 1/2), a bar across the path at each step's end (t = k), never a mark on the corner; a turn over 145 degrees there, or over 100 with a leg under 2 dS, is rejected; a milder turn costs in the score; caption sentence (EN, RU) | Strip to disk: no arrowhead at t = 1; the corners carry bars (`after/review/striptodisk-light-end.png`, `-export-article-bw.png`). Cayley-cube corner 2.19 -> 0.77 rad; Strip to disk keeps corners up to 2.52 rad (144 degrees), each with a bar, and its kink away from the corners is 0.03 rad |
| path-2 | a marked point's path that retraces itself (0 -> 1 -> 0) | point seeds pass the same tests as the others; any path with over 20 % of it within 2 px of an earlier part is left out, and a back-and-forth that ends at its start with no area inside | Strip to disk retrace 0.45 -> 0.05 |
| path-3 | paths come in from the frame edge with no ring or cue | chevrons pointing in where a run enters (live and figure); live, a path whose start is out of view is not drawn, and more than one such start chooses again; every choice rejects a path that leaves and comes back | Cayley-cube: no orphan line from the top edge (`cayleycube-light-mid.png`, `-export-article-bw.png`) |
| path-4 | long parallel arcs 15-25 px apart read as bundles | a path over 3 dS keeps 2 dTest (28 px) from the others over 75 % of its length, checked both ways; total line capped at 2.5 x sqrt(pane area); only a path's own ends are exempt | share within 28 px, long paths: at most 0.25 (Cayley-cube), Log annulus 0.2, Square root 0.15 |
| path-5 | phones got 18 paths | cap also 0.7 x (short side / 110)^2 | 390 x 844: Disk automorphism, Log annulus, Square root 18/18/17 -> 8/8/8; Sine half-strip 4, Cayley-cube 3, Quarter 2, Strip to disk 1 |
| path-6 | stubs of 11-25 px (ring and dot dumbbells) | under 1.2 dS (41 px) a path is a last resort: only in the looser last pass, one at most, and it loses in the score | shortest path at t = end: Sine half-strip 11 -> 41 px, Quarter 22 -> 48, Disk automorphism 23 -> 48, Square root 25 -> 54 |
| path-7 | end dots on other lines, rings beside other ends; chain heads stacked | every end dot and ring at least dE/2 (13 px) from every other path's line (both ways), rings dS/2 from other ends; chains: the dE test at every step's end too | end dot to another line: Strip to disk 1.8 -> 43.8 px, worst of the 7 examples 15.7 px (Log annulus); ring to another line at least 18 px; ring to another end at least 18 px |
| path-8 | globe: tiny paths at the limb, cut at the limb with no cue | a point facing the camera at under cos 0.35 (about 70 degrees) is not used (globeSelP: the run splits there); a globe path must show 60 % of its t; a chevron where a run goes behind the limb or comes back (live and figure) | Disk automorphism globe: 5 paths on the facing rim, no limb scratches. **Rejected:** turning the default camera to X's centroid. The camera is the user's; with Cayley-cube, X (the upper half-plane) faces away from the default view, so the globe shows no paths there (0) until it is turned |
| path-9 | figure: small X in a wide frame, paths off the frame, a path on the picture's axis line | under 70 % of its length in the frame: left out; over 30 % (away from its own ends) within 1.5 pt of X's outline or its image: left out; X under 5 % of the frame: at most 5 paths | Sine half-strip Article: 4 paths, none on the imaginary axis (`sinhalf-export-article-bw.png`) |
| path-10 | starts on the frame edge that leave at once | starts at least dS/2 inside the frame; the first run must be 2 dS long before any exit | Strip to disk and Cayley-cube Article: no ring on the frame edge (`after/review/*-export-article-bw.png`) |
| path-11 | legend and Paths icon in the old style; legend drops the paths row under a cut | the glyph is ring, line, small middle arrowhead, dot (legend chip and button); with a cut row, X and the paths share the last row | Log annulus and Square root show "image of a cut", then X and the paths row (`logann-light-end.png`, `sqrt-light-end.png`) |
| path-12 | too many glyphs per path live; arrowhead like the dots | live: ring, line, one arrowhead (9.5 px long, 6.4 px wide) and the moving dot; no time dots (the figure keeps them, its caption explains them); no arrowhead on paths under 60 px | `after/*-plane-light-t05.png` |

Also fixed in this pass:

- **Hairpins.** zp kept a path with a turn of 0.97 rad per px (a tiny hook near the pole), and the smoothness
  test failed (turning p99 0.38). A path whose sharpest turn between 3 px chords is over 0.75 rad (radius under
  about 4 px) is now left out. The corner where steps meet is not counted (it has its own test and a bar).
  zp: turning p99 0.38 -> 0.16.
- **Picture lines test in the figure.** A boundary point starts on X's outline and ends on its image, so the test
  counted those stretches and left out most boundary paths: zp Article had 1 path, Moebius 2. The test now skips
  the path's own ends (0.75 sep). zp Article 1 -> 4, Moebius 2 -> 4.
- **Russian.** The 3 new caption strings had a plain space before the em dash (t_i18n failed); now a no-break
  space (`src/i18n_ru.js`, `tools/ru_extra.json`).
- **Test bounds.** expstrip (a strip 30 px tall at that zoom: its points left of 0 all end at the wedge's apex,
  those right of about 3 leave at once) keeps 3 paths; Strip to disk keeps 3 live and 2 in the Article figure,
  since most of its paths double back at t = 1. The tests now accept that: `deform_nat_cmd.js` (expstrip at least
  3), `morphfig_cmd.js` (ex-strip at least 3), `export_cmd.js` (the paths figure at least 2, and the chain form of
  the caption).
- **Why a candidate was left out.** `pathsGen` counts the reasons (`sel.rej`: trace, start, short, reentry, exit,
  off, frame, retrace, sharp, fold, picture, vee, hidden, spacing); test hook `__cmwFigPathsSel()`.

## Verify fixes (review-verify.json "still_wrong", 6 items; 2026-10-24)

All 6 are fixed at the root. Numbers are from `after/review/` (rendered again, port 9048): 1440 x 900 at t = end,
390 x 844 at t = m/2 and (new) at t = end (`*-phone-end.png`). Before -> after.

| # | finding | fix | evidence |
|---|---|---|---|
| path-1 | chain corners read as V hooks; in print the bar's white casing cut the line at the corner | print: every white casing (lines, chevrons, bars) is drawn before every black line, so the line runs through the bar. A corner where steps meet over 120 degrees is rejected (was 145), or over 100 with a leg under 2 dS | Strip to disk kinkStep 2.52 -> 1.51 rad (144 -> 86 degrees); still 3 paths live, 2 in Article. The Article bars of Strip to disk and Cayley-cube sit on unbroken lines (`striptodisk-export-article-bw.png`, `cayleycube-export-article-bw.png`) |
| path-7 | a path's own return leg 4 px from its own ring | a ring and an end dot keep dE/2 (13 px) from the path's own line beyond its first and before its last dS of arclength (`selfNear`; a closed path is left to the fold test) | Strip to disk ownLine 4.1 -> 24.3 px; the 7 examples 23.5-34 px (new `ownLine` in `__cmwPathsCheck`) |
| path-4 | two long parallel lines on Cayley-cube; the ink cap skipped for the first 4 paths | the ink cap holds from the second path on; the long-path spacing is measured at 2.2 dTest (31 px) and allows 20 % (was 2 dTest and 25 %) | Cayley-cube: 4 -> 3 paths, ink 2066 -> 1573 (cap 1721), sepLong 0.25 -> 0, phone 0.25 -> 0. Others at most 0.18 (Square root), Log annulus and Sine half-strip 0.17 (`cayleycube-light-end.png`) |
| path-6 | phone scenes with stubs and no arrowheads | on a pane under 500 px on its short side: no stub, the arrowhead length limit is the stub limit (41 px, was 60), so every kept path gets one, and the score prefers longer paths (0.15 per px, was 0.04) | Sine half-strip phone: shortest 29 -> 44 px, all 3 with an arrowhead at t = end (`sinhalf-phone-end.png`); Disk automorphism phone 8 paths, shortest 76 px, all with arrowheads (`diskauto-phone-end.png`). At exactly t = m/2 the moving dot stands where the arrowhead goes, so it shows just after, as on the desktop |
| path-3 | panning made a path vanish in one frame | a path whose start left the view stays, clipped, with the chevron pointing in; a new choice (more than one start out, a zoom, the globe's orbit) cross-fades: the old set fades out while the new one fades in over 150 ms (`drawMorphPathsX`, `mfCache.prev`) | pan test (Disk automorphism, t = 0.5, 12 pans of 30 px): heads = n after every pan (10 -> 11 -> 10 only when the set is chosen again), never one less; the fade was seen in the hook after a 200 px pan and was gone after it |
| path-8 | the globe sparse with short rim strokes; Cayley-cube 0 paths with no hint | the globe does not take the boundary first and gives boundary points no bonus; a path along X's outline (start or end, within 3 px over 30 % of it) is left out, as in the figure. With under 3 paths and over half the seeds on the far side, the globe's hint chip says "Paths: X is on the far side; drag to turn" (Russian added). The review asked for the legend row, but the globe has no legend (legendKind: plane only), so the hint chip carries it | Disk automorphism globe: 4 rim strokes -> 0, 2 interior paths, hint shown (`diskauto-globe-mid.png`); Cayley-cube: 0 paths, hint shown (`cayleycube-globe-mid.png`); the other 5 examples keep 3-8 globe paths and the usual hint |

## Tests (re-run after the verify fixes, port 9048)

- `test/deform_nat_cmd.js`: pass. chain3 now keeps 3 paths: three long arcs (about 570 px each) fill the ink cap
  now that it holds from the second path, so its bound is 3, like expstrip. Playing: 60 fps, p95 at most 18.1 ms,
  largest frame 18.7 ms.
- `test/morphfig_cmd.js`: pass.
- `test/export_cmd.js`: pass, no fails (CMW_BASE=http://localhost:9048/).
- `test/regress/export/preflight.py`: 0 failures in 948 checks.
- Node: `t_natpaths` 278/0 failed, `t_i18n` 18211 pass, `t_i18n_keys` 4742 pass, `t_figure_chevron` 64/64,
  `t_funcs` bad 0.
- `after/` (8 scenes, `test/pa_render.js` with EXTRA, and `rational-phone-light-t05.png`), `after/review/` (7
  examples, with the new `*-phone-end.png`) and the 4 `before-after-*.png` sheets are rendered again.

## Tests (after the review fixes, port 9046)

- `test/deform_nat_cmd.js`: pass. Part 9 checks, on 5 scenes: 4-18 paths (expstrip 3-18), no jump, no kink,
  smoothness, separation, heads at H_t(z) at rest and while playing; the same points at t = 0.15, 0.85 and while
  playing; 60 fps while playing; a phone pane (3-12 paths).
- `test/morphfig_cmd.js`: pass. A ring per path, at most one arrowhead per path, an end dot, 4-18 paths (ex-strip
  3-18) and the caption's marks.
- `test/export_cmd.js`: pass, no fails (CMW_BASE=http://localhost:9046/). The paths figure: 0.5 pt vector lines,
  a ring per kept path, end dots, 2-12 paths, and the marks sentence in either form. One earlier run had two video
  long tasks (53 and 63 ms) while the machine's load average was 10; the video code is not touched here, and the
  re-run passed.
- `test/regress/export/preflight.py`: 0 failures in 948 checks (not `--latex`).
- Node: `t_natpaths` 278/0 failed, `t_i18n` 18201 pass, `t_i18n_keys` 4739 pass, `t_figure_chevron` 64/64,
  `t_funcs` bad 0.
- `test/pa_render.js` renders `after/` (prepend `const OUT = '<dir>', ONLY = [], EXTRA = true;`).
- Test hooks (test.html only): `__cmwPathsCheck()` (now also minLen, retrace, endLine, ringLine, ringEnd, sepLong,
  kinkStep, ink, cap; after the verify fixes also ownLine and arrowMin, and sepLong at 2.2 dTest),
  `__cmwFigPathsSel()` (the last figure choice: n, candidates, cap, reasons left out), `__cmwMorphCache()` (also
  rej, away, hint, prev).

## Code (for the v15 patch)

- `src/app.js`:
  - New block "the deformation's paths": `PATHS`, `traceRuns`, `pathMarksW`, `pathsGen`, `pathRetrace`, the new
    `drawMorphPaths`, `pathsSvg`, `pathItem`, `figMorphPaths`, `pathTimesTex`.
  - Removed: `tracePath`, `morphCandidates`, `morphSelectGen`, `morphPathsGen`, `morphPathsFor`, `arrowHead`,
    `trimEndPx`, `mfBudget`, `niceFloor` and most of `MF`. Also the prototype (`pathStyle`, `PSP`,
    `stylePathsGen`, `drawStyledPaths`), `__cmwMorphSelSync` and the API's `legacyMorph` / `pathStyle`.
  - `morphFigureLayers` now draws through `pathsSvg`. It has no z / F(z) labels: the ring and the dot are in the
    caption.
  - `morphCaption` has the new sentence.
  - Review fixes: `pathMarkTimes` (per-step arrowheads and bars), `retraceShare`, `sharpTurn`, the new tests in
    `pathsGen` (reasons in `sel.rej`), `PATHS` keys shortK, ink, longK, longShare, stubK, arrowMin, globeFace,
    sharp; `mfViewOk` re-chooses when more than one start leaves the view; the legend chip and `ICONS.paths`.
  - API: `pathsSvg`, `pathTimesTex`, `morphPaths`, `globePaths`.
- `src/figure.js`:
  - `sampleRunsT` and `pathItems`. `figPaths` chooses in its own window through `A.morphPaths` and draws with
    `A.pathsSvg`.
  - `figGlobePaths` uses the live globe's points (those mostly facing the camera), else boundary points.
  - Globe caption.
  - Review fixes: the globe figure's limb chevrons (limbOut / limbIn) and the chain marks (arrowhead per step, bars)
    in `pathItems`; the chain form of the marks sentence.
- `src/i18n_ru.js` and `tools/ru_extra.json`: 9 new entries (the chain caption forms), with a no-break space before
  each em dash. The other generated tables are restored to v15.
- Tests: `test/deform_nat_cmd.js`, `test/morphfig_cmd.js`, `test/export_cmd.js` (bounds above).

- Verify fixes (`src/app.js`): `PATHS` keys longShare 0.2, longD, vee, small, fade; in `pathsGen` the ink cap from
  the second path, `selfNear` (reason `self`), the vee limit, small panes (no stub, `sel.arrowMin`, longer
  preferred), the globe's interior preference and outline test, `sel.away`; `drawMorphPaths` keeps a path whose
  start left the view and takes `o.fade`; `drawMorphPathsX` and `mfCache.prev` (the cross-fade); `pathsSvg` draws
  every casing first; `mfGlobeAway` and the globe hint in `idleRight`. `src/i18n_ru.js` and `tools/ru_extra.json`:
  1 new entry. `test/deform_nat_cmd.js`: chain3 bound.

## Not done / open

- The video export still draws its own paths (plan.paths), not this style.
- The globe shows no paths where X faces away from the camera (Cayley-cube: 0; Disk automorphism: 2). Its hint now
  says so; turning the default camera to X stays rejected (see path-8).
- Strip to disk stays sparse: 3 paths live, 1 on a phone, 2 in the Article figure, now with corners of at most 86
  degrees. Its paths go out under exp and come back under the Moebius map.
- On a phone, Disk automorphism still has 4 of its 8 paths along X's outline (boundary points of a disk
  automorphism stay on the circle); only the globe leaves such paths out.
- With the far field as X (jouk), interior paths still outnumber boundary paths live (4 boundary, 8 interior).
- Fewer paths overall (rational 17 -> 7 live, chain3 18 -> 4): the ink cap and the long-path spacing do that, as the
  review asked. If a scene looks too empty, PATHS.ink (2.5) is the knob.

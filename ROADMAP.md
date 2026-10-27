# Roadmap

**Live now:** v16.4.1 (26 October 2026): Landscape walls, the docked guided tour with the Grieg chapter, hyperbolic
lines ("Inside").

**Next:** v16.5, a round of fixes (built in part, paused), then v17, a redesign of how the app is laid out and
learned. Both come from a usability audit of every function on laptops and Android phones:
[plan/ux-audit/REPORT.md](plan/ux-audit/REPORT.md) (106 problems, 17 of them serious, each with its fix; step counts
for 43 common tasks; mockups of every option).

## Where we are

| Version | What | Status |
|---|---|---|
| v16.4.1 | Landscape walls, docked tour, hyperbolic lines | published |
| v16.5 | The fixes that need no decision, snapping and railing of points | being built, paused until the usage limits reset |
| v17 | The twelve layout decisions (D1–D12) and the new guided tour | designed (options chosen), not started |
| patch | Landscape walls redesign | planned |

## v16.5: fixes, snapping and railing

### Rules the current build breaks, restored first

- Adding a function keeps showing F (today both planes jump to "that step alone" and X leaves the left plane). A
  message offers "Show alone · Undo".
- The first-run invitation to the tour becomes a line in the tour's strip, not a card over the planes.
- Legends and one-time notes move from the picture to the plane's title row; messages never land on controls.
- Phone: Undo in every sheet and in the deformation bar; a pinch on the bars no longer zooms the whole page;
  tooltips no longer stick after a tap.

### Small fixes (about 70)

- **Search (⌘K)** finds commands, tools, examples and help by everyday words ("dark", "png", "help", "zero").
- **Formulas:** `z^2 + a` adds the step and a new number a; errors point at the mistake and offer a fix.
- **Phone:** Android Back closes the open sheet instead of leaving the app; the guide uses touch words; rotating the
  phone keeps your place.
- **Drawing and constructions:** Undo in the middle of a construction removes only the last pick; polygons can be
  finished and backed up by touch; bigger handles; a Hyperbolic line tool; the construction prompt says what to pick.
- **Reading the picture:** one readout with z and w = F(z); one name per plane everywhere; "Plane | Sphere" in words.
- **Sound and export:** a Stop button when listening; Hear the function easy to find; video always listed in export.
- The full list, with each fix: section 5 of the [audit report](plan/ux-audit/REPORT.md#5-quick-wins-that-need-no-decision).

### Snapping and railing of points

Spec: [plan/snapping-and-railing.md](plan/snapping-and-railing.md).

- Points snap, in order, to existing points and handles, zeros and poles, crossings, curves (the unit circle and
  the axes included), and the grid (the finest drawn grid lines) when Snap is on.
- A point placed on a curve rides it: dragging moves it along the curve.
- Pulling it away frees it: past 40 px for 0.12 s, or 80 px at once (64 and 128 px on touch); a stretch line shows
  the pull before it lets go. Dropping it on another curve attaches it there. Alt drags freely on a laptop.
- Bug fix: two points on one circle were refused as "needs distinct points" because a pick on a curve was labelled
  only by its curve. Picks are now compared by where they are. A perpendicular circle through two points of the same
  circle gives the hyperbolic line with those ends, or the diameter when they are opposite.

## v17: the redesign

The options were put to the user with mockups; the recommended option was chosen for each.

| | What changes | Device |
|---|---|---|
| D1 | The function search replaces as well as inserts ("Replace F with …", "Replace f₂ with …"); Clear chain visible | both |
| D2 | Phone: + and F pinned in the chain bar; in landscape the tools become a column on the right with Undo at the bottom | phone |
| D3 | Phone: one bar above the tools while something is selected or in progress (Edit/Delete; Done/Cancel; what to pick; Stop) | phone |
| D4 | Laptop: the right panel edits whatever you select; a Display button on each plane | laptop |
| D5 | Laptop: the header in words (Examples, Add function, Export, Share, Sound) and one Settings menu | laptop |
| D6 | Phone: More opens Draw / Construct / Shapes tabs; the ⋯ menu is grouped and searchable | phone |
| D7 | Learning: the tour's strip also offers "Start the tour", "Continue the tour" and an example's "Try" line; the guide gets contents and search | both |
| D8 | Phone: a "Both" button shows X and Y together; the small inset stays the default | phone |
| D9 | Two fingers always move the view; the shape you just drew can be moved without drawing another | both |
| D10 | Each mode (a step alone, an expanded plane, the deformation) shows a chip with its way out; Esc steps out one level at a time | laptop |
| D11 | Phone: the deformation bar in two rows with a full-width time slider | phone |
| D12 | Export: a plain "Save PNG" first; Share first on the phone | both |

Recommended laptop layout (mockup):

![Laptop layout after D1, D4, D5, D7 and D10](plan/ux-audit/mockups/laptop/L1-recommended-1366.png)

Phone: one bar for what you are doing now (D3):

![Phone context bar](plan/ux-audit/mockups/phone/s2-context-bar.png)

All mockups and the options that were not chosen: section 4 of the
[audit report](plan/ux-audit/REPORT.md#4-decisions-for-you) and [plan/ux-audit/mockups/](plan/ux-audit/mockups/).

Also in v17: guide contents and search, one glossary for every label in English and Russian, a symbol row above the
phone keyboard for formulas, lines by two clicks, renaming and reordering shapes, points keeping their names when
others are deleted.

### The guided tour will be reworked

The current tour works, but it is not good enough yet. The rework fixes:

1. Captions that read oddly and look odd in the strip.
2. Steps that light only a button, not the part of the screen it changes: both will be lit.
3. The 3-second auto-advance, which today only counts down while the pointer is still: it will run after the task
   is done, whatever you do next.
4. "Drag z₂ across the line" (Constructions), which never counts as done.

A reviewer takes the whole tour as a new user, on a laptop and on a phone, before it ships.

## Also planned

- **Landscape walls redesign patch:** run the walls' edge pass and sheet refinement through the surface's own
  program, to remove the short first-open stalls with All sheets and bring the Max mesh back to 60 fps while playing;
  the step-card pictures that stay empty when the deformation starts in the first seconds of Landscape.
- **Landscape phones (844 × 390):** the tools sit under the chain bar (D2 solves it).
- **Open question:** a "Between z₀ and z₁" option for a true hyperbolic segment (no tails).

## How a version is made

Each round is built in parallel copies, merged, reviewed by independent agents (as the user on laptop and phone,
for regressions, and for the round's own subject), fixed, and smoke-checked in English and Russian, light and dark,
at 1440 and 390 px. Then it is published here and on the shared artifact, and a full gate (unit tests, GLSL tests,
the quality suite of 81 runs, frame-time budgets at 60 fps) runs; its fixes ship as patches. Design notes for every
round are in [notes/](notes/).

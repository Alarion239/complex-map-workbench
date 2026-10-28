# Complex Map Workbench

**Live:** https://alarion239.github.io/complex-map-workbench/

> **The guided tour will be reworked** in the next major version (v17): clearer captions, highlights that show the
> part of the screen each step changes, and an auto-advance that works while you keep moving. The plan for the next
> versions, with the usability audit behind it, is in [ROADMAP.md](ROADMAP.md).

**New in v16.5** (27 October 2026):

- **Snapping and railing of points**: points snap to points and handles, zeros and poles, crossings, curves (the unit
  circle and the axes included) and the grid. A point placed on a curve rides it when dragged; pull it hard to free
  it (Alt places freely on a laptop).
- Two points on one circle are no longer refused as "needs distinct points": picks are compared by where they are.
- **Phone**: Undo in every sheet and in the deformation bar, and Android Back closes the open sheet instead of leaving
  the app.
- **⌘K finds everything**: commands, tools, examples and help, by everyday words ("dark", "png", "help", "zero").
- The first-run invitation to the tour is one line in the tour's strip, not a card over the planes.
- Messages cover nothing: legends and one-time notes sit in the plane's title row, and messages never land on
  controls.

An interactive workbench for complex analysis. Draw regions and curves in the z-plane, chain complex functions, and
see what they do:

- **X → Y**: your shapes on the left (plane or Riemann sphere), their exact images on the right. Images are computed
  per pixel by running the chain backwards through every branch (z^i of the upper half-plane is the exact annulus
  e^−π < |w| < 1; log of the half-plane reaches the window edges at any zoom), with a sphere-mesh fallback for maps
  that cannot be inverted.
- **Phase** and **Landscape**: full-width phase portraits and 3D landscapes of the chain. Landscape walls stay
  closed wherever |F| is continuous, however steep, and break only at real discontinuities (cuts and sheet seams);
  All sheets tints each sheet so you can tell them apart.
- **Phase colours** (the colour disc in the bar): the workbench's hue wheel, or one of the color functions of Fredrik
  Johansson's [Arb](https://fredrikj.net/blog/2018/04/new-color-functions/) (Arb, gold and blue, the blend, chrome,
  warm, cold, tomato). One setting for every view, its keys and the figure export.
- **The function chain**: each step is a card with a picture that follows the open view; the **Inspector** edits the
  selected step (with large Add zero / Add pole buttons for a zeros-and-poles step), and the **F** tile holds the
  formula of F, its guarantees and its domain. Right-click a shape, a zero or a pole (or hold it on a phone) for its
  menu; a right-click while drawing cancels the drawing, and a double-click centres the view.
- **Shared numbers**: type `Re z = a` and a slider for *a* appears; every field can use it, and the formulas keep its
  name (F(z) = z + c, not z + 0.25), so a slider moves the picture and leaves the formula as it is. Copy link and scene
  files hand the whole figure on.
- **Typed formulas** (LaTeX or plain) are recognized as the catalog steps they are made of, so `\sin(z^2+1)` runs as
  fast as the catalog and is offered as its steps (z ↦ z² ↦ z²+1 ↦ sin(z²+1)) in one click; in the search, `sin z`
  is the Sine step.
- **Deformation**: a toggle that morphs every view along natural homotopies from z to F(z) (analytic at every
  moment, on F's own branches), one step after another or all at once, with live paths t ↦ H_t(z) that can be
  switched off.
  A bracket over the chain cards chooses which steps deform: the steps before it act first and the steps after it act
  last, so you can watch f(z) become f(√z) (a pullback) or push an image you already have forward.
- **Zeros and poles**: a step a·∏(z − z_k)/∏(z − p_j) whose zeros (dots) and poles (crosses) you drag in the plane.
- **Constructions**: circles through 3 points, lines through 2, intersections, midpoints, bisectors, circles
  perpendicular to a line or circle (hyperbolic lines in the disk and half-plane; "Inside" keeps only the arc inside the
  circle) and touching circles and tangents, built from any
  point on the page (points, shape corners, zeros and poles, crossings of curves); they follow what they are built on.
- Equation curves (`Re z = 0`, `|z − 1| = 2`, …), targets and their preimages, integrals along closed curves, and
  guarantees (analytic, injective, …) that are only lit when they are proven.
- **Figure export** (⌘E): article-grade PDF, SVG and PNG for every view, with presets for articles (one or two
  columns) and homework, black-and-white versions, LaTeX snippets for Overleaf, images for Docs, deformation
  filmstrips for every view, and MP4/WebM videos of the deformation.
- **Sound**: small struck, plucked and blown interface and event cues (on by default after the first click), and an
  optional "hear the function": a phase harp plucks a note each time arg F under the pointer crosses one of five
  phase lines (a rising scale round a zero, a falling one round a pole; the low Ds count the winding number), also
  while the deformation plays; a closed curve sings its winding number as one note. The example "In the Hall of the Mountain King"
  plays Grieg's theme (public domain) along one spiral under z^(−2+24i).
- **Guided tour** from the Help button, suggested once on first opening: a docked strip that never covers the
  planes, lights the exact control each step needs and moves on by itself about 3 s after you do the task. A chapter
  plays the Grieg example and explains how a curve becomes a melody.
- **Russian** and **Italian**: the interface follows the browser's language (or the globe button), with Russian
  notation (tg, sh, ch, …) and Russian or Italian figure captions (decimal comma in both).

## Build

The app is a single HTML file built from `src/`:

```
python3 build.py
```

This writes `dist/complex-map-workbench.html` (the published page, test hooks stripped) and `dist/test.html` (with
test hooks). The live page is published by GitHub Pages from CI (`.github/workflows/pages.yml`): pushing a release tag
(`git tag v16.6 && git push origin v16.6`) builds it and deploys it; Actions > Pages > Run workflow does the same by
hand. The build reads and writes UTF-8 with LF line endings on every platform (Windows included). The Italian table
is `tools/it_table.json`; after editing it, run `python3 tools/make_it_table.py` (it writes `src/i18n_it.js` and
reports strings the Russian table has and it lacks).

## Tests

- Unit tests (Node): `node test/t_inverse.js` (and the other `test/t_*.js`).
- GPU and app checks run in headless Chrome through `test/cdp_kit` (see its README); on Windows they use ANGLE's
  Direct3D 11 back end (what Chrome uses there), as do both regression suites.
- Regression suites in `test/regress/` (see its README): image quality against exact mathematical ground truth, and
  a paired performance gate against a reference build.
- CI (`ci/README.md`): the whole gate runs on GitHub Actions for every pull request and push to `main`, on Linux,
  Windows and macOS, split into short jobs; the real-GPU part runs on our own Windows laptop and Mac
  (`ci/RUNNERS.md`).

## Design notes

`notes/` holds the specifications and reviews the app was built from: the renderer (`notes/sphere-design/SPEC.md`),
the UI (`notes/ui-design/`), the curve engine (`notes/curves-design.md`) and the backlog (`notes/UI_BACKLOG.md`).

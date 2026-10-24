# Complex Map Workbench

**Live:** https://alarion239.github.io/complex-map-workbench/

An interactive workbench for complex analysis. Draw regions and curves in the z-plane, chain complex functions, and
see what they do:

- **X → Y**: your shapes on the left (plane or Riemann sphere), their exact images on the right. Images are computed
  per pixel by running the chain backwards through every branch (z^i of the upper half-plane is the exact annulus
  e^−π < |w| < 1; log of the half-plane reaches the window edges at any zoom), with a sphere-mesh fallback for maps
  that cannot be inverted.
- **Phase** and **Landscape**: full-width phase portraits and 3D landscapes of the chain.
- **The function chain**: each step is a card with a picture that follows the open view; the **Inspector** edits the
  selected step (with large Add zero / Add pole buttons for a zeros-and-poles step), and the **F** tile holds the
  formula of F, its guarantees and its domain. Right-click a plane (or hold on a phone) for "Add zero here" and more.
- **Shared numbers**: type `Re z = a` and a slider for *a* appears; every field can use it. Copy link and scene files
  hand the whole figure on.
- **Typed formulas** (LaTeX or plain) are recognized as the catalog steps they are made of, so `\sin(z^2+1)` runs as
  fast as the catalog and is offered as its steps (z ↦ z² ↦ z²+1 ↦ sin(z²+1)) in one click; in the search, `sin z`
  is the Sine step.
- **Deformation**: a toggle that morphs every view along natural homotopies from z to F(z) (analytic at every
  moment, on F's own branches), one step after another or all at once, with live paths t ↦ H_t(z) that can be
  switched off.
- **Zeros and poles**: a step a·∏(z − z_k)/∏(z − p_j) whose zeros (dots) and poles (crosses) you drag in the plane.
- Equation curves (`Re z = 0`, `|z − 1| = 2`, …), targets and their preimages, integrals along closed curves, and
  guarantees (analytic, injective, …) that are only lit when they are proven.
- **Figure export** (⌘E): article-grade PDF, SVG and PNG for every view, with presets for articles (one or two
  columns) and homework, black-and-white versions, LaTeX snippets for Overleaf, images for Docs, deformation
  filmstrips for every view, and MP4/WebM videos of the deformation.
- **Sound**: small struck, plucked and blown interface and event cues (on by default after the first click), and an
  optional "hear the function": a phase harp plucks a note each time arg F under the pointer crosses one of five
  phase lines (a rising scale round a zero, a falling one round a pole; the low Ds count the winding number), also
  while the deformation plays; a closed curve sings its winding number as one note.
- **Guided tour** from the Help button, suggested once on first opening.
- **Russian**: the interface follows the browser's language (or the globe button), with Russian notation
  (tg, sh, ch, …) and Russian figure captions.

## Build

The app is a single HTML file built from `src/`:

```
python3 build.py
```

This writes `dist/complex-map-workbench.html` (the published page, test hooks stripped) and `dist/test.html` (with
test hooks). `docs/index.html` is the published page served by GitHub Pages.

## Tests

- Unit tests (Node): `node test/t_inverse.js` (and the other `test/t_*.js`).
- GPU and app checks run in headless Chrome through `test/cdp_kit` (see its README).
- Regression suites in `test/regress/` (see its README): image quality against exact mathematical ground truth, and
  a paired performance gate against a reference build.

## Design notes

`notes/` holds the specifications and reviews the app was built from: the renderer (`notes/sphere-design/SPEC.md`),
the UI (`notes/ui-design/`), the curve engine (`notes/curves-design.md`) and the backlog (`notes/UI_BACKLOG.md`).

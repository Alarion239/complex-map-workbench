# Complex Map Workbench

**Live:** https://alarion239.github.io/complex-map-workbench/

An interactive workbench for complex analysis. Draw regions and curves in the z-plane, chain complex functions, and
see what they do:

- **X → Y**: your shapes on the left (plane or Riemann sphere), their exact images on the right. Images are computed
  per pixel by running the chain backwards through every branch (z^i of the upper half-plane is the exact annulus
  e^−π < |w| < 1; log of the half-plane reaches the window edges at any zoom), with a sphere-mesh fallback for maps
  that cannot be inverted.
- **Phase** and **Landscape**: full-width phase portraits and 3D landscapes of the chain.
- **Deformation**: a toggle that morphs every view along natural homotopies from z to F(z), with live paths
  t ↦ H_t(z).
- Equation curves (`Re z = 0`, `|z − 1| = 2`, …), targets and their preimages, integrals along closed curves,
  guarantees (analytic, injective, …) that are only lit when they are proven, LaTeX and article-grade figure export.

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

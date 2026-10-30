'use strict';
// Constructions: the interface (v16, notes/constructions-v16/SPEC.md 4-7, 9-12, 15, 16; owned by INTERFACE).
// CORE (constr.js, app.js's cm block) owns the model; this file owns what the user touches and reads:
//   - snap targets: every point on the page (point shapes, other shapes' handles, the zeros and poles of f₁, the images
//     F(z₀) in Y), the crossings of two drawn curves (found locally, at the pointer), and the curves themselves;
//   - the ring and its chip ("on z₂"), at 8 px (mouse) or 22 px (touch);
//   - binding: a drawing tool's handles bind at the press and at the release, a handle dragged onto a target binds,
//     the Point tool makes a meet point on a crossing and a point on a curve on a stroke;
//   - the six tools (Circle through 3 points, Intersect, Midpoint, Perpendicular bisector, Perpendicular circle, Touching
//     circle): picks,
//     the draft chip with Curve | Region, the dashed preview, Backspace and Esc;
//   - dragging what is built: a point on a curve slides, a fixed point says what it is built from, a shape built on
//     free points moves them (else the press pans);
//   - texts: definitions, undefined reasons, the delete toasts; the rows, the ⋯ items, the plane menu's group, the
//     Inspector's Construction view, export phrases; the tour's events.
// app.js calls in through one line per hook; its adapter is Construct.ui(A).
const Construct = (() => {
  // @parts: src/construct/NN-*.js go here, in order (build.py; test/src_text.js joins them the same way)
})();
import { CX } from './cx.js';
import { Region } from './region.js';
import { Constr } from './constr.js';
import { PlaneMenu } from './planemenu.js';
import { Params } from './params.js';
export { Construct, Construct as 'module.exports' };

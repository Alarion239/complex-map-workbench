// The figure export (notes/export-design, round 2, as built: AS-BUILT.md; round 3, the deformation in every view, the
// formats PDF / PNG / SVG / Video, the displayed F and the video: ROUND3.md). A composer that sets every label in
// Computer Modern outlines at its printed size, the presets (Article, Homework, Slides), the views (X -> Y, Phase in
// colour and black and white, Landscape, the deformation's filmstrip and paths), the formats (PDF without fonts or
// transparency, our own opaque PNG with pHYs, SVG, the LaTeX snippet) and the Export figure dialog.
// The app attaches its renderer and state with Figure.attach (app.js). Units are PostScript points (bp): the SVG
// viewBox is in bp, so a label set at 8 pt prints at 8 pt when the figure is included at natural size.
const Figure = (() => {
  // @parts: src/figure/NN-*.js go here, in order (build.py; test/src_text.js joins them the same way)
})();
import { CX } from './cx.js';
import { Calc } from './calc.js';
import { Region } from './region.js';
import { GLR } from './gl.js';
import { Construct } from './construct.js';
export { Figure };

// The names the app's files share (build.py joins them into one <script>), for `npm run typecheck` (tsconfig.json).
// A file that also exports itself to node (`module.exports = X`, for the unit tests) is a CommonJS module to
// TypeScript, so its top-level names are not global there; they are declared here with the types of those exports.
// Files without module.exports (gl.js, figure.js, sound.js, …) are plain scripts, and TypeScript sees their names
// directly (gl.js and app.js are checked as joined from their parts in src/gl/ and src/app/: tools/join_src.js,
// tsconfig.json). Keep this list in step with the files' exports; eslint.config.js reads the same names from src/ itself.

declare const I18N: typeof import('../src/i18n.js');
declare const $t: typeof I18N.t;
declare const $tx: typeof I18N.tx;
declare const $tn: typeof I18N.tn;
declare const CX: typeof import('../src/cx.js');
declare const Expr: typeof import('../src/parse.js');
declare const Funcs: typeof import('../src/funcs.js');
declare const HomRange: typeof import('../src/homrange.js');
declare const Palette: typeof import('../src/palette.js');
declare const Inverse: typeof import('../src/inverse.js');
declare const Recognize: typeof import('../src/recognize.js');
declare const Calc: typeof import('../src/calc.js');
declare const GLChain: typeof import('../src/glsl.js');
declare const Region: typeof import('../src/region.js');
declare const Lines: typeof Region.Lines;
declare const Constr: typeof import('../src/constr.js');
declare const Curves: typeof import('../src/curves.js');
declare const SphereMesh: typeof import('../src/sphere.js');
declare const CYR: typeof import('../src/cyr.js');
declare const Views: typeof import('../src/view.js').Views;
declare const Tour: typeof import('../src/tour.js').Tour;
declare const Construct: typeof import('../src/construct.js');
declare const Params: typeof import('../src/params.js');
declare const SEASONG: typeof import('../src/seasong.js').SEASONG;
// loaded from the CDN by the page (build.py)
declare const MathJax: any;
// view.js exports only Views to node; the page also uses its Pane class and Axes helpers
declare const Pane: any;
declare const Axes: any;
// the node branches of the files that also run in the unit tests
declare const module: any;
declare function require(id: string): any;

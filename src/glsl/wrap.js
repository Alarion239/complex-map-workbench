'use strict';
// GPU mirror of the function chain. GLChain.build(steps, built) turns the app's step array into GLSL ES 3.00
// that evaluates exactly the maps of funcs.js / cx.js (same branches, cuts, sheets and homotopies).
// Structure (step types, on/off, errors, coefficient counts, custom formulas) is baked into the source and
// summarised by `key`; every numeric parameter lives in `uniform vec4 uChain[]`, written by fill(), so
// dragging a parameter or a branch cut never forces a recompile.
const GLChain = (() => {
  // @parts: src/glsl/NN-*.js go here, in order (build.py; test/src_text.js joins them the same way)
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Funcs } from './funcs.js';
import { Inverse } from './inverse.js';
export { GLChain, GLChain as 'module.exports' };

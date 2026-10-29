// A stand-in for node (issue #20, phase 4; written by tools/to_esm.js): src/gl.js is src/gl/'s parts, joined by the
// bundle (tools/bundle.mjs gives './gl.js' the joined text, never this file). Node, which has no renderer, sees its
// names undefined, as the tests always did.
const GLR = undefined;
export { GLR };

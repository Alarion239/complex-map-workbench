// A stand-in for node (as tools/to_esm.js writes src/gl.js, src/figure.js and src/construct.js): src/glsl.js is
// src/glsl/'s parts, joined by the bundle (tools/bundle.mjs gives './glsl.js' the joined text, never this file) and by
// build.py (tools/src_parts.py). Node sees its name undefined; the unit tests that run GLChain load it through
// test/lib/glchain.js.
const GLChain = undefined;
export { GLChain, GLChain as 'module.exports' };

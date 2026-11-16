// A stand-in for node (as tools/to_esm.js writes src/gl.js, and src/figure.js, construct.js and glsl.js): src/tour.js is
// src/tour/'s parts, joined by the bundle (tools/bundle.mjs gives './tour.js' the joined text, never this file) and by
// build.py (tools/src_parts.py). Node sees its name undefined; the unit tests that run the Tour load it through
// test/lib/tour.js.
const Tour = undefined;
export { Tour };

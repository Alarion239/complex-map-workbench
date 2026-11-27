// A stand-in for node (as tools/to_esm.js writes src/gl.js): src/tour.js is src/tour/'s parts, joined by the bundle
// (tools/bundle.mjs gives './tour.js' the joined text, never this file), by build.py (tools/src_parts.py) and, for the
// unit tests, by test/src_text.js (loadSplit). Node, which runs no tour, sees its name undefined.
const Tour = undefined;
export { Tour };

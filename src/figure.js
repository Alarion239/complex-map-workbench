// A stand-in for node (issue #20; as tools/to_esm.js writes src/gl.js): src/figure.js is src/figure/'s parts, joined by
// the bundle (tools/bundle.mjs gives './figure.js' the joined text, never this file) and by build.py
// (tools/src_parts.py). Node, which runs no figure export, sees its name undefined.
const Figure = undefined;
export { Figure };

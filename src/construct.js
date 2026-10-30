// A stand-in for node (issue #20; as tools/to_esm.js writes src/gl.js, and src/figure.js): src/construct.js is
// src/construct/'s parts, joined by the bundle (tools/bundle.mjs gives './construct.js' the joined text, never this
// file) and by build.py (tools/src_parts.py). Node, which runs no constructions interface, sees its name undefined.
const Construct = undefined;
export { Construct, Construct as 'module.exports' };

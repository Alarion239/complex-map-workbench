// A stand-in for node (issue #20; as tools/to_esm.js writes src/gl.js): src/sound.js is src/sound/'s parts, joined by
// the bundle (tools/bundle.mjs gives './sound.js' the joined text, never this file) and by build.py
// (tools/src_parts.py). The node tests read it through test/src_text.js's source('sound.js'), the joined text.
const HT_LIB = undefined, SND_LIB = undefined, Sound = undefined;
export { HT_LIB, SND_LIB, Sound };

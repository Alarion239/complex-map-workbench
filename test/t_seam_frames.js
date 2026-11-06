// ci/seam_frames.js: the seams suite's result as `seam-frame:` log lines.
const assert = require('assert');
const { seamFrameLines } = require('../ci/seam_frames');
const t = { label: 'x', path: 'mesh', rows: 780, perRow: 0.4567, worstY: 12, W: 2400, H: 1600 };
const out = seamFrameLines({ info: { teeth: t, afterChange: { frames: 2, perRow: [0.5, 1] }, cracks: { path: 'mesh', label: 'x', out: { 135: { samples: 900, cracks: 0, first: null } } } } }).split('\n');
assert.strictEqual(out.length, 4);
assert(out.every((l) => l.startsWith('seam-frame: ') && l.length < 300));
assert(out[0].includes('perRow=0.46') && out[0].includes('size=2400x1600'));
assert(out[1].includes('afterChange 1/2 perRow=0.5'));
assert(out[3].includes('ray=135 samples=900 cracks=0 first=null'));
assert.strictEqual(seamFrameLines({}), 'seam-frame: none');
console.log('seam_frames ok');

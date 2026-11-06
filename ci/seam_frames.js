'use strict';
// The log lines of test/steps_seams_cmd.js: one `seam-frame:` line per frame it measured, with the numbers it checks
// (per-row colour jumps beside the seam, the rows scanned, the crack counts), so a job's log shows the result.
const f = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);

function seamFrameLines(o) {
  const i = (o && o.info) || {};
  const lines = [];
  const teeth = (name, t) => { if (t) lines.push(`seam-frame: ${name} perRow=${f(t.perRow)} rows=${t.rows} worstY=${t.worstY} size=${t.W}x${t.H} path=${t.path} label=${t.label}`); };
  teeth('teeth', i.teeth);
  teeth('teeth-noFill', i.teethNoFill);
  teeth('teeth-noMask', i.teethNoMask);
  if (i.afterChange) (i.afterChange.perRow || []).forEach((p, n) => lines.push(`seam-frame: afterChange ${n + 1}/${i.afterChange.frames} perRow=${f(p)}`));
  teeth('afterSettled', i.afterSettled);
  if (i.cracks) for (const a of Object.keys(i.cracks.out || {})) {
    const q = i.cracks.out[a] || {};
    lines.push(`seam-frame: cracks ray=${a} samples=${q.samples} cracks=${q.cracks} first=${JSON.stringify(q.first)} path=${i.cracks.path} label=${i.cracks.label}`);
  }
  return lines.join('\n') || 'seam-frame: none';
}
module.exports = { seamFrameLines };

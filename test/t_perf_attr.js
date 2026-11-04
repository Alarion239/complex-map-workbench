// Unit checks of svAttrFrames (test/regress/perf/run.js), the per-frame attribution of sv.interact.king's scrub frames:
// which frames it lists (at or over SV_ATTR_MS), the rAF gap before each, the snapshot it reads the GL calls and the
// thread's place from, and the class: 'start' (the leg's first two moving frames), 'arrival' (within 0.1 of a plane),
// 'other'.
//   node test/t_perf_attr.js
const { svAttrFrames, SV_ATTR_MS } = require('./regress/perf/run.js');
let n = 0, fails = 0;
const ok = (name, c, info) => {
  n++;
  if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
};
// a drawn frame as windowStats keeps it: [t0, cpu, gpu, draws, n, ts, t1]
const fr = (t0, cpu, gpu) => [t0, cpu, gpu, 1, 1, t0, t0 + cpu + gpu];
const slowMs = SV_ATTR_MS + 3;
const drawn = [fr(0, 1, slowMs), fr(30, 1, 8), fr(50, 1, 8), fr(70, 2, slowMs), fr(100, 1, 8), fr(120, 1, slowMs)];
const prev = fr(-700, 1, 8);
// snapshots: one at rest before the drag, then one after each frame's end: [t, gl, x]
const snaps = [[-5, {}, 0], [22, { useProgram: 14 }, 0.1], [40, {}, 0.3], [60, {}, 0.6], [92, { createVertexArray: 3 }, 1.02], [110, {}, 1.2], [142, {}, 1.4]];
const out = svAttrFrames(drawn, prev, snaps);

ok('only the frames at or over the limit', out.length === 3 && out.map((f) => f.i).join() === '0,3,5', out);
ok('the first frame of a leg is start, its gap from the frame before the leg', out[0].cls === 'start' && out[0].gap === +(0 - prev[6]).toFixed(2), out[0]);
ok('a frame drawn with the thread within 0.1 of a plane is an arrival', out[1].cls === 'arrival' && out[1].x === 1.02, out[1]);
ok('its GL calls from the snapshot after its end', out[1].gl.createVertexArray === 3, out[1]);
ok('its gap: its t0 less the previous frame\'s t1', out[1].gap === +(70 - drawn[2][6]).toFixed(2), out[1]);
ok('a slow frame elsewhere is other', out[2].cls === 'other' && out[2].x === 1.4, out[2]);
ok('the second frame of a leg is start too', svAttrFrames([fr(0, 1, 2), fr(20, 1, slowMs)], null, [[-5, {}, 0], [10, {}, 0.05], [50, {}, 0.5]])[0].cls === 'start');
ok('no frame before the leg: no gap for its first frame', svAttrFrames([fr(0, 1, slowMs)], null, [])[0].gap === null);
// a return leg: its first drawn frame still at the plane it leaves (x 2), then the ramp
const back = [fr(0, 1, 2), fr(20, 1, slowMs), fr(50, 1, slowMs), fr(80, 1, slowMs), fr(110, 1, slowMs)];
const backSnaps = [[5, {}, 2], [42, {}, 1.96], [72, {}, 1.92], [102, {}, 1.75], [132, {}, 1.08]];
const ob = svAttrFrames(back, null, backSnaps);
ok('a return leg: start is its first two moving frames, not its first two drawn', ob.map((f) => f.cls).join() === 'start,start,other,arrival', ob);
ok('a still frame at the leg\'s first place is no start: over the limit it is an arrival at that plane',
  svAttrFrames([fr(0, 1, slowMs), fr(30, 1, 2)], null, [[30, {}, 2], [40, {}, 1.97]])[0].cls === 'arrival');
ok('within 0.1 of a plane is an arrival, past it other',
  (() => { const o = svAttrFrames([fr(0, 1, 2), fr(20, 1, 2), fr(40, 1, 2), fr(60, 1, slowMs), fr(90, 1, slowMs)], null, [[10, {}, 0], [30, {}, 0.1], [50, {}, 0.3], [82, {}, 0.91], [112, {}, 0.88]]); return o.map((f) => f.cls).join() === 'arrival,other'; })());
ok('no snapshot after a frame: no place, other unless start',
  (() => { const o = svAttrFrames([fr(0, 1, 2), fr(20, 1, 2), fr(40, 1, slowMs)], null, []); return o[0].x === null && o[0].cls === 'other'; })());

console.log(`t_perf_attr: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

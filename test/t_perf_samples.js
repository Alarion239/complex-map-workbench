// Unit checks of the paired perf runner's per-rep sample lines (test/regress/perf/run.js sampleLines): the job log shows each
// frame_p95 metric of a unit with its value (pooled, or the median of the reps) and the value of every rep in the order they ran, current and reference,
// so a run's log alone says whether the side timed first is the high one.
//   node test/t_perf_samples.js
const { sampleLines } = require('./regress/perf/run.js');
let n = 0, fails = 0;
const ok = (name, c, info) => {
  n++;
  if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
};
const metrics = {
  'sv.orbit.default.frame_p95_ms': { kind: 'frame_ms', unit: 'ms', value: 13.1, pooled: true, reps: [14.2, 12.9, 13.0], unit_id: 'sv.interact.default' },
  'sv.orbit.default.frame_p50_ms': { kind: 'frame_ms', unit: 'ms', value: 8.4, reps: [8.4, 8.3, 8.5], unit_id: 'sv.interact.default' },
  'sv.orbit.default.fps': { kind: 'info', unit: 'frames/s', value: 58, reps: [58, 58, 58], unit_id: 'sv.interact.default' },
  'sv.glide.default.frame_p95_ms': { kind: 'frame_ms', unit: 'ms', value: 12.5, reps: [12.4, 12.5, 12.6], unit_id: 'sv.glide.default' },
  'sv.scrub.in.default.frame_p95_ms': { kind: 'frame_ms', unit: 'ms', value: 11.8, pooled: true, reps: [12.2, 11.8, 11.7], unit_id: 'sv.interact.default' },
};
const lines = sampleLines(metrics, 'sv.interact.default');
ok('one line per frame_p95 metric of the unit', lines.length === 2, lines);
ok('a line names the metric, its pooled value and each rep in order',
  lines.includes('sv.orbit.default.frame_p95_ms: pooled 13.1 ms, reps 14.2 12.9 13'), lines);
ok('the other unit, the p50 and the info metrics are not listed', !lines.some((l) => /glide|p50|fps/.test(l)), lines);
ok('a unit with no frame_p95 metric gives no lines', sampleLines(metrics, 'sv.pan.default').length === 0);
ok('a metric with a null rep keeps its place', sampleLines({ 'a.frame_p95_ms': { kind: 'frame_ms', unit: 'ms', value: 5, pooled: true, reps: [5, null, 5], unit_id: 'u' } }, 'u')[0] === 'a.frame_p95_ms: pooled 5 ms, reps 5 null 5');
ok('a value put() sets (the median of the reps, no pooled mark) is labelled median, not pooled',
  sampleLines({ 'play.frame_p95_ms': { kind: 'frame_ms', unit: 'ms', value: 6, reps: [5, 6, 7], unit_id: 'u' } }, 'u')[0] === 'play.frame_p95_ms: median 6 ms, reps 5 6 7');

console.log(`t_perf_samples: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

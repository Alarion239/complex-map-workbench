// Unit checks of the paired perf runner's refCannot (test/regress/perf/run.js): when a unit is NEW (the reference lacks
// what it measures) and when it is compared. The steps view's own shapes ('__sv…') drawn only on the current build
// never make a unit NEW: they are the view's, not the scene's.
//   node test/t_perf_refcannot.js
const { refCannot } = require('./regress/perf/run.js');
let n = 0, fails = 0;
const ok = (name, c, info) => {
  n++;
  if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); }
};
const scene = (drawn, o) => Object.assign({ stepErrors: [], drawn, settled: true, exc: [] }, o);

ok('both sides draw the same shapes: compared', refCannot([scene(['a', 'b'])], [scene(['a', 'b'])]) === null);
ok('a user shape drawn only on the current build: NEW',
  /shape b draws nothing there/.test(refCannot([scene(['a'])], [scene(['a', 'b'])]) || ''));
ok('the outer rings drawn only on the current build: compared',
  refCannot([scene(['a'])], [scene(['a', '__svRing|1.5', '__svRing|2'])]) === null);
ok('the whole plane and the warm-up disc drawn only on the current build: compared',
  refCannot([scene(['a'])], [scene(['a', '__svAll', '__svWarm'])]) === null);
ok('a user shape missing beside a ring: NEW, naming the user shape only',
  refCannot([scene(['a'])], [scene(['a', 'b', '__svRing|2'])]) === 'shape b draws nothing there');
ok('a side not settled: compared', refCannot([scene(['a'], { settled: false })], [scene(['a', 'b'])]) === null);
ok('a step that errs only on the reference: NEW',
  /step f1 does not build/.test(refCannot([scene(['a'], { stepErrors: ['bad'] })], [scene(['a'], { stepErrors: [''] })]) || ''));
ok('the unit failed only on the reference: NEW', /the unit failed on the reference/.test(refCannot([], [], new Error('x'), null) || ''));

console.log(`t_perf_refcannot: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);

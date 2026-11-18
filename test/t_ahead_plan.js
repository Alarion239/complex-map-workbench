// The render-ahead frames' schedule (#1339, HomRange.aheadPlaces, aheadIndex): a motion's places, fixed when it starts. For the
// arrows' eased glide and Play's linear one, over the speeds' times a plane (450, 900, 2000, 4500 ms) and one to three planes:
// N = ceil(ms / dt); x_0 is the start and x_N the end exactly; the places never go back; the eased places are the live
// glide's (svFrame: HomRange.ease3 of the share of the time gone) at k dt, and the linear ones are evenly spaced but the last;
// aheadIndex is floor(el / dt), at least 0 and at most N. Control: a place one step later differs. Run: node test/t_ahead_plan.js
const HomRange = require('../src/homrange.js');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const DT = 1000 / 60;
for (const per of [450, 900, 2000, 4500]) for (const planes of [1, 2, 3]) for (const eased of [true, false]) for (const [from, to] of [[0, planes], [planes, 0]]) {
  const ms = per * planes, xs = HomRange.aheadPlaces(from, to, ms, eased, DT), N = xs.length - 1, tag = `${eased ? 'eased' : 'linear'} ${from}→${to} at ${per} ms a plane`;
  check(`${tag}: N = ceil(ms / dt)`, N === Math.ceil(ms / DT), N);
  check(`${tag}: starts at its start and ends at its end exactly`, xs[0] === from && xs[N] === to, [xs[0], xs[N]]);
  const dir = Math.sign(to - from);
  check(`${tag}: the places never go back`, xs.every((x, k) => k === 0 || (x - xs[k - 1]) * dir >= 0));
  const live = (k) => { const v = Math.min(1, (k * DT) / ms); return from + (to - from) * (eased ? HomRange.ease3(v) : v); };
  check(`${tag}: each place is the live glide's at k dt`, xs.every((x, k) => x === live(k)));
  if (!eased) { const d = (to - from) * DT / ms; check(`${tag}: evenly spaced but the last`, xs.slice(1, N).every((x, k) => Math.abs(x - xs[k] - d) <= 1e-12 * Math.max(1, Math.abs(to)))); }
  check(`${tag}: control: a place one step later differs`, xs[1] !== live(2));
  check(`${tag}: aheadIndex`, HomRange.aheadIndex(-5, DT, N) === 0 && HomRange.aheadIndex(0, DT, N) === 0 && HomRange.aheadIndex(DT * 2.5, DT, N) === 2 && HomRange.aheadIndex(ms * 10, DT, N) === N);
}
check('ease3 at 0, 0.5 and 1', HomRange.ease3(0) === 0 && HomRange.ease3(0.5) === 0.5 && HomRange.ease3(1) === 1);
console.log(`${n} checks, ${bad} failed`);
process.exit(bad ? 1 : 0);

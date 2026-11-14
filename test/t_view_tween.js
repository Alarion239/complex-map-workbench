'use strict';
// The view tween (src/app/08-thumbnails-render.js stepTweens, the motion of Fit, the plane menu's fit and zoom to
// zeros/poles; notes/DESIGN_SPEC.md §7): taken from the app's text and stepped on a fake clock.
//  * a tween that zooms keeps one world point at the same screen position all along, the point the start and end
//    views both put there, as a wheel zoom keeps the point under the cursor (zoom in and zoom out);
//  * u = 0 is the start view and u = 1 the target, bit for bit; the tween ends at u = 1 and calls its onDone;
//  * a pure pan (equal scales) is a plain eased pan, and scales a hair apart pan the same way, with no NaN.
// The scale s is in pixels per world unit (src/view.js: screen x = w/2 + (x - cx)·s).
// Run: node test/t_view_tween.js
const vm = require('vm');
const { Pane } = require('../src/view.js');
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } else if (process.env.V) console.log('ok  ', name); }

const { source, fnText } = require('./src_text');
const APP = source('app.js');
const sb = { tweens: [], dirty: {}, clock: 0, Pane, Math };
sb.performance = { now: () => sb.clock };
vm.createContext(sb);
vm.runInContext(fnText(APP, 'stepTweens') + '\n;globalThis.stepTweens = stepTweens;', sb);

const MS = 260;
// the view at each u of a tween from a to b (the app's ease: e = 1 - (1 - u)^3), and whether onDone ran
function run(a, b, us) {
  const view = { ...a };
  let done = 0;
  sb.tweens.length = 0;
  sb.tweens.push({ view, from: { ...a }, to: { ...b }, t0: 0, ms: MS, onDone: () => done++ });
  const out = [];
  for (const u of us) { sb.clock = u * MS; sb.stepTweens(0); out.push({ u, v: { cx: view.cx, cy: view.cy, s: view.s }, left: sb.tweens.length, done }); }
  return out;
}
const ease = (u) => 1 - Math.pow(1 - u, 3);
const US = [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9, 0.99];
// the world point a and b put at the same screen offset from the pane's centre: (p − c0)·s0 = (p − c1)·s1
const fixedOf = (a, b) => ({ x: (b.cx * b.s - a.cx * a.s) / (b.s - a.s), y: (b.cy * b.s - a.cy * a.s) / (b.s - a.s) });
const offset = (v, p) => [(p.x - v.cx) * v.s, (p.y - v.cy) * v.s];

for (const [name, a, b] of [
  ['zoom in (the issue\'s example, s 50 → 500, c 0 → 3)', { cx: 0, cy: 0, s: 50 }, { cx: 3, cy: 0, s: 500 }],
  ['zoom in, both axes', { cx: -1.25, cy: 0.4, s: 80 }, { cx: 0.7, cy: -2.1, s: 333.3 }],
  ['zoom out (zoom to zeros/poles: a box that holds the old view)', { cx: 0.3, cy: 0.2, s: 400 }, { cx: 1.1, cy: -0.6, s: 37.5 }],
  ['zoom out, far', { cx: 10, cy: -4, s: 2e4 }, { cx: 0, cy: 0, s: 3 }],
]) {
  const p = fixedOf(a, b), o0 = offset(a, p);
  const steps = run(a, b, US);
  const worst = Math.max(...steps.map(({ v }) => { const o = offset(v, p); return Math.max(Math.abs(o[0] - o0[0]), Math.abs(o[1] - o0[1])); }));
  check(`${name}: the shared point keeps its screen position (worst drift ${worst.toExponential(2)} px)`, worst < 1e-6, steps.map(({ u, v }) => [u, offset(v, p)]));
  // the scale moves in log space, eased
  const sErr = Math.max(...steps.map(({ u, v }) => Math.abs(Math.log(v.s) - (Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * ease(u)))));
  check(`${name}: the scale is eased in log space`, sErr < 1e-12, sErr);
  // the centre moves monotonically from a to b
  const cs = steps.map(({ v }) => v.cx);
  const mono = cs.every((c, i) => i === 0 || (b.cx - a.cx) * (c - cs[i - 1]) >= 0);
  check(`${name}: the centre moves one way only`, mono, cs);
}

// the ends, bit for bit, for every kind of tween the app runs (Fit and zoom to zeros/poles: zoom and move; the zoom
// buttons: zoom about the kept centre; a pan)
for (const [name, a, b] of [
  ['Fit, zoom in', { cx: 0.1, cy: 0.7, s: 61.3 }, { cx: 2.9, cy: -1.3, s: 517.77 }],
  ['zoom to zeros/poles, zoom out', { cx: 0.3, cy: 0.2, s: 400 }, { cx: 1.1, cy: -0.6, s: 37.5 }],
  ['the zoom buttons, centre kept', { cx: 0.37, cy: -0.21, s: 80 }, { cx: 0.37, cy: -0.21, s: 128 }],
  ['a pan', { cx: 0.1, cy: 0.2, s: 77.7 }, { cx: -3.3, cy: 1.9, s: 77.7 }],
]) {
  const [s0, mid, s1] = run(a, b, [0, 0.5, 1]);
  check(`${name}: u = 0 is the start view exactly`, s0.v.cx === a.cx && s0.v.cy === a.cy && s0.v.s === a.s && s0.left === 1 && s0.done === 0, s0);
  check(`${name}: u = 1 is the target exactly, the tween ends and calls onDone once`, s1.v.cx === b.cx && s1.v.cy === b.cy && s1.v.s === b.s && s1.left === 0 && s1.done === 1, s1);
  check(`${name}: halfway is finite`, [mid.v.cx, mid.v.cy, mid.v.s].every(Number.isFinite), mid);
  if (a.cx === b.cx && a.cy === b.cy) check(`${name}: the centre stays put`, mid.v.cx === a.cx && mid.v.cy === a.cy, mid);
}
// a tween past its end (a late frame) lands on the target too
{
  const a = { cx: 0.1, cy: 0.7, s: 61.3 }, b = { cx: 2.9, cy: -1.3, s: 517.77 };
  const [late] = run(a, b, [1.7]);
  check('a late frame lands on the target exactly', late.v.cx === b.cx && late.v.cy === b.cy && late.v.s === b.s && late.left === 0 && late.done === 1, late);
}

// a pure pan is a plain eased pan; scales a hair apart (|1 − s0/s1| < 1e-9) pan the same way, with no NaN
for (const [name, a, b] of [
  ['pure pan', { cx: 0.1, cy: 0.2, s: 77.7 }, { cx: -3.3, cy: 1.9, s: 77.7 }],
  ['scales 1e-12 apart', { cx: 0.1, cy: 0.2, s: 77.7 }, { cx: -3.3, cy: 1.9, s: 77.7 * (1 + 1e-12) }],
  ['scales 5e-10 apart', { cx: 0.1, cy: 0.2, s: 77.7 }, { cx: -3.3, cy: 1.9, s: 77.7 * (1 - 5e-10) }],
]) {
  const steps = run(a, b, US);
  const err = Math.max(...steps.map(({ u, v }) => { const e = ease(u); return Math.max(Math.abs(v.cx - (a.cx + (b.cx - a.cx) * e)), Math.abs(v.cy - (a.cy + (b.cy - a.cy) * e))); }));
  check(`${name}: the centre moves as the eased time (worst ${err.toExponential(2)})`, err < 1e-12 && steps.every(({ v }) => [v.cx, v.cy, v.s].every(Number.isFinite)), steps);
}
// scales just past the threshold still follow the fixed-point weight, continuously: no jump between the two branches
{
  const a = { cx: 0.1, cy: 0.2, s: 77.7 }, b = { cx: -3.3, cy: 1.9, s: 77.7 * (1 + 3e-9) };
  const steps = run(a, b, US);
  const err = Math.max(...steps.map(({ u, v }) => Math.abs(v.cx - (a.cx + (b.cx - a.cx) * ease(u)))));
  check(`scales 3e-9 apart: the weight is the eased time to within 1e-8 (worst ${err.toExponential(2)})`, err < 1e-8, steps);
}

// a degenerate target of scale 0 moves the centre as the eased time, finite all along
{
  const a = { cx: 0.1, cy: 0.2, s: 77.7 }, b = { cx: -3.3, cy: 1.9, s: 0 };
  const steps = run(a, b, US);
  check('a target of scale 0: the centre stays finite and moves as the eased time', steps.every(({ u, v }) => Number.isFinite(v.cx) && Number.isFinite(v.cy) && Math.abs(v.cx - (a.cx + (b.cx - a.cx) * ease(u))) < 1e-12), steps);
}

console.log(`t_view_tween: ${n - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);

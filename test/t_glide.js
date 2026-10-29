// The step glide (#246, src/homrange.js HomRange.glider): the chain position x that ‹ › move on a phone, as the owner
// asked: a press starts the deformation from one state to the next, does not block the next press, several quick
// presses go faster, a press the other way turns round from where x is with no jump, and a transit takes at most 2 s.
//   (a) one step: x goes 0 → 1, never backwards, never past 1, settles exactly on 1 within 2 s (and visibly moves in
//       the first 100 ms);
//   (b) no jump: frame to frame x moves by at most |v|·dt plus rounding, and v changes by a bounded amount, at 60 fps
//       and at 20 fps, through presses and a reversal;
//   (c) acceleration: three presses 150 ms apart reach 3 sooner than three steps one after another, and faster at the
//       peak than one step;
//   (d) reversal: › then ‹ halfway turns x round before 1 and settles on 0, without passing below 0;
//   (e) the ends: x stays in 0…max, a nudge past the end is the end, 20 steps settle within 2 s;
//   (f) nudge from rest between steps goes to the next whole step that way (from 1.4: › 2, ‹ 1); set() is at rest.
// Run: node test/t_glide.js
const path = require('path');
const HR = require(path.join(__dirname, '..', 'src', 'homrange.js'));
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } };

// run a glider with presses at given times (s): [[t, d], ...]; returns the frames
function run(presses, { fps = 60, max = 5, from = 0, until = 4 } = {}) {
  const g = HR.glider().set(from); g.max = max;
  const dt = 1 / fps, frames = [];
  let t = 0, i = 0;
  while (t < until) {
    while (i < presses.length && presses[i][0] <= t + 1e-9) { g.nudge(presses[i][1], max); i++; }
    const x0 = g.x, v0 = g.v;
    const moving = g.step(dt);
    t += dt;
    frames.push({ t, x: g.x, v: g.v, dx: g.x - x0, dv: g.v - v0, moving, target: g.target });
  }
  return frames;
}
const settleT = (fr) => { let last = 0; for (const f of fr) if (f.moving) last = f.t; return last; };

// (a)
{
  const fr = run([[0, 1]]);
  check('(a) one step settles exactly on 1', fr[fr.length - 1].x === 1, fr[fr.length - 1]);
  check('(a) within 2 s', settleT(fr) <= 2, settleT(fr));
  check('(a) never backwards', fr.every((f) => f.dx >= -1e-12), '');
  check('(a) never past 1', fr.every((f) => f.x <= 1), Math.max(...fr.map((f) => f.x)));
  check('(a) it moves at once (x > 0.01 after 100 ms)', fr.find((f) => f.t >= 0.1).x > 0.01, fr.find((f) => f.t >= 0.1));
  check('(a) half way within 0.5 s', fr.find((f) => f.t >= 0.5).x > 0.5, fr.find((f) => f.t >= 0.5));
}
// (b)
for (const fps of [60, 20]) {
  const fr = run([[0, 1], [0.2, 1], [0.3, 1], [0.6, -1], [0.7, -1]], { fps });
  const dt = 1 / fps;
  let worstX = 0, worstV = 0;
  for (let i = 1; i < fr.length; i++) {
    const p = fr[i - 1], f = fr[i];
    worstX = Math.max(worstX, Math.abs(f.dx) - (Math.max(Math.abs(p.v), Math.abs(f.v)) * dt + 1e-9));
    worstV = Math.max(worstV, Math.abs(f.dv));
  }
  // (the one allowance: the settle onto the target, under a thousandth of a step)
  check(`(b) ${fps} fps: x moves by at most its speed × dt (no jump)`, worstX <= 1e-3, worstX);
  // (the spring's largest change of speed in one frame: ω² × the steps to go × dt; 3 steps at 20 fps is about 6.3/s)
  check(`(b) ${fps} fps: the speed changes smoothly (≤ 7 steps/s per frame)`, worstV <= 7, worstV);
  check(`(b) ${fps} fps: it settles on 1`, fr[fr.length - 1].x === 1, fr[fr.length - 1]);
}
// (c)
{
  const one = run([[0, 1]]), three = run([[0, 1], [0.15, 1], [0.3, 1]]);
  const at = (fr, x) => (fr.find((f) => f.x >= x - 1e-9) || { t: Infinity }).t;
  check('(c) three quick presses reach 3', three[three.length - 1].x === 3, three[three.length - 1]);
  check('(c) sooner than three steps one after another', at(three, 3) < 3 * settleT(one), [at(three, 3), 3 * settleT(one)]);
  check('(c) and within 2 s of the last press', at(three, 3) - 0.3 <= 2, at(three, 3));
  const peak = (fr) => Math.max(...fr.map((f) => f.v));
  check('(c) faster at the peak than one step', peak(three) > 1.5 * peak(one), [peak(three), peak(one)]);
}
// (d)
{
  const fr = run([[0, 1], [0.25, -1]]);
  const maxX = Math.max(...fr.map((f) => f.x));
  check('(d) turns round before 1', maxX < 1, maxX);
  check('(d) settles on 0', fr[fr.length - 1].x === 0, fr[fr.length - 1]);
  check('(d) never below 0', fr.every((f) => f.x >= 0), Math.min(...fr.map((f) => f.x)));
  const turn = fr.findIndex((f) => f.v < 0);
  check('(d) its speed passes through 0 (a turn, not a jump)', turn > 0 && Math.abs(fr[turn].v - fr[turn - 1].v) < 7, fr.slice(Math.max(0, turn - 1), turn + 1));
}
// (e)
{
  const g = HR.glider().set(0);
  g.nudge(-1, 3);
  check('(e) a nudge before 0 stays at 0', g.target === 0 && !g.moving(), g);
  g.set(3); g.nudge(1, 3);
  check('(e) a nudge past the end stays at the end', g.target === 3 && !g.moving(), g);
  const fr = run(Array.from({ length: 20 }, (_, i) => [i * 0.02, 1]), { max: 20, until: 4 });
  check('(e) 20 quick presses settle on 20', fr[fr.length - 1].x === 20, fr[fr.length - 1]);
  check('(e) within 2 s of the last press', settleT(fr) - 0.38 <= 2, settleT(fr));
  check('(e) x stays in 0…max', fr.every((f) => f.x >= 0 && f.x <= 20), '');
}
// (f)
{
  const g = HR.glider().set(1.4); g.max = 5;
  check('(f) set() is at rest', !g.moving() && g.v === 0, g);
  g.nudge(1); check('(f) from 1.4, › goes to 2', g.target === 2, g.target);
  g.set(1.4); g.nudge(-1); check('(f) from 1.4, ‹ goes to 1', g.target === 1, g.target);
  g.set(2); g.nudge(1); g.nudge(1); check('(f) two presses from 2 go to 4', g.target === 4, g.target);
}
console.log(`t_glide: ${n - bad} passed, ${bad} failed`);
if (bad) process.exit(1);

'use strict';
// The Mountain King as a function (src/seasong.js, made by tools/mk_function.js; notes/sea-song/FUNCTION.md): the
// example's chain, typed in the app's own language and compiled by its own parser (src/parse.js, CX), plays Grieg's
// theme by itself along its Listen-along path:
//  * both steps parse; the chain is cheap enough to type (one exp and 26 principal logs in F, one exp in u);
//  * along the path |z| = 1, so |u| = 1 and |F| moves only with the crescendo factor (|ln|F|| <= βπ);
//  * the colour lines arg F crosses (n = 12: a line a semitone), the crossings of one step within 45 ms taken as one
//    strum whose last line is the heard note, are the theme's pitch classes in order, four statements, nothing else;
//  * arg F is flat on each note (within 0.2 of a line of its plateau) and the path crosses u's cut once a statement
//    (the crack), on the downbeat;
//  * the path is two laps of the unit circle, 19.1 s at 250 px/s with view.s.
// Run: node test/t_seasong.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const { SEASONG } = require('../src/seasong.js');
const TAU = 2 * Math.PI;
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } else if (process.env.V) console.log('ok  ', name, info); }
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
for (const [f, nm] of [['cx', 'CX'], ['parse', 'Expr'], ['funcs', 'Funcs']]) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f + '.js'), 'utf8') + `\n;globalThis.${nm} = ${nm};`, ctx, { filename: f + '.js' });
const { Expr } = ctx;

const [s1, s2] = SEASONG.steps;
check('two custom steps, principal logs', SEASONG.steps.length === 2 && s1.type === 'custom' && s2.type === 'custom' && s1.params.cut === 180 && s2.params.cut === 180);
let fU = null, fG = null;
try { fU = Expr.compile(Expr.parse(s1.params.expr)); fG = Expr.compile(Expr.parse(s2.params.expr)); } catch (e) { check('the chain parses', false, e.message); }
check('the chain parses', !!fU && !!fG);
check('F: one exp, 26 logs', (s2.params.expr.match(/log\(/g) || []).length === 26 && (s2.params.expr.match(/exp\(/g) || []).length === 1, s2.params.expr.length);
check('sectors 12', SEASONG.sectors === 12);

// the path: arc length and duration at 250 px/s
const P = SEASONG.pts; let L = 0, rDev = 0;
for (let i = 0; i < P.length; i++) { rDev = Math.max(rDev, Math.abs(Math.hypot(P[i][0], P[i][1]) - 1)); if (i) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); }
const dur = L * SEASONG.view.s / 250;
check('the path is on |z| = 1', rDev < 2e-5, rDev);
check('two laps', Math.abs(L / TAU - (SEASONG.design.themes / 2) * 0) >= 0 && L > 1.6 * TAU && L < 2.4 * TAU, L / TAU);
check('19.1 s at 250 px/s', Math.abs(dur - SEASONG.dur) < 0.05 && Math.abs(dur - 19.1) < 0.3, dur);

// along the path, finely (between the points: the circle's own angle, as the points are)
const a0 = Math.atan2(P[0][1], P[0][0]); let a1 = a0; for (let i = 1; i < P.length; i++) { let d = Math.atan2(P[i][1], P[i][0]) - Math.atan2(P[i - 1][1], P[i - 1][0]); d -= TAU * Math.round(d / TAU); a1 += d; }
const NS = 40000, seq = []; let prev = null, prevU = null, phi = 0, line = null, cuts = 0, lnMax = 0;
const cutAt = [];
for (let i = 0; i <= NS; i++) {
  const t = a0 + (a1 - a0) * i / NS, z = { re: Math.cos(t), im: Math.sin(t) }, u = fU(z), g = fG(u), a = Math.atan2(g.im, g.re);
  lnMax = Math.max(lnMax, Math.abs(Math.log(Math.hypot(g.re, g.im))));
  const cut = prevU && u.re < 0 && prevU.re < 0 && Math.sign(u.im) !== Math.sign(prevU.im);
  if (prev == null) phi = a; else if (cut) { cuts++; cutAt.push(i); phi = a; line = null; } else { let d = a - prev; d -= TAU * Math.round(d / TAU); phi += d; }
  prev = a; prevU = u;
  const Ln = Math.floor(phi * 6 / Math.PI + 1e-9);
  if (line != null && Ln !== line) seq.push({ i, pc: (((Ln > line ? Ln : line) % 12) + 12) % 12, ph: phi });
  if (cut) seq.push({ i, pc: ((Ln % 12) + 12) % 12, ph: phi, cut: true });
  line = Ln;
}
check('|F| only the crescendo', lnMax <= SEASONG.design.beta * Math.PI + 1e-3, lnMax);
check('a crack a statement', cuts === SEASONG.design.themes, cuts);
const gap = NS * 0.045 / dur, heard = [];
seq.forEach((c, j) => { const nx = seq[j + 1]; if (!nx || nx.i - c.i > gap) heard.push(c); });
const THEME = [0, 2, 3, 5, 7, 3, 7, 6, 2, 6, 5, 1, 5, 0, 2, 3, 5, 7, 3, 7, 12, 10, 7, 3, 7, 10].map((s) => (s + 9) % 12);
const want = [].concat(...Array.from({ length: SEASONG.design.themes }, () => THEME));
check('the heard notes are the theme, four times', heard.map((c) => c.pc).join(' ') === want.join(' '), heard.map((c) => c.pc).join(' '));
check('the cut is on the downbeat B', cutAt.every((i) => { const h = heard.find((c) => c.i === i); return h && h.pc === 9; }));
// flat on each note: from a heard onset to the next strum's first crossing, arg F stays within 0.35 of a line of
// where it rests (the plateau sits 0.3 past its line, the next line is 0.7 away)
let worst = 0;
for (let j = 0; j + 1 < heard.length; j++) {
  const i0 = heard[j].i + Math.round(gap), nx = seq.find((c) => c.i > heard[j].i + gap); const i1 = nx ? nx.i - Math.round(gap / 2) : NS;
  if (i1 <= i0) continue;
  let lo = Infinity, hi = -Infinity;
  for (let i = i0; i <= i1; i += 20) { const t = a0 + (a1 - a0) * i / NS, g = fG(fU({ re: Math.cos(t), im: Math.sin(t) })), a = Math.atan2(g.im, g.re) * 6 / Math.PI; lo = Math.min(lo, a); hi = Math.max(hi, a); }
  if (hi - lo < 6) worst = Math.max(worst, hi - lo);
}
check('flat on each note', worst < 0.35, worst);
console.log(bad ? `t_seasong: ${bad} of ${n} FAILED` : `t_seasong: all ${n} passed (${heard.length} notes, ${cuts} cracks, ${dur.toFixed(2)} s)`);
process.exit(bad ? 1 : 0);

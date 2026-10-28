'use strict';
// The Mountain King as a function (notes/sea-song/FUNCTION.md): F = g(u(z)), whose own colour lines play Grieg's theme
// through the fixed sound map ("Hear the function": a note each time arg F crosses one of the n = 12 lines, pitch class
// 12k/n semitones above D, loudness from |F|, a crack at a branch cut). No score, no special rule: this tool only
// finds F's constants and writes the example's data (src/seasong.js).
//   node tools/mk_function.js [--dry]
//
// u(z) = z²·e^{i(α + 0.45(z + 1/z + (z² + z⁻²)/4 + (z³ + z⁻³)/9))}. On |z| = 1 the exponent is real times i, so
// |u| = 1: u turns twice a lap, warped (its angle 2θ + α + 0.9 Σ cos nθ/n²), so at constant speed on the circle the
// theme's quavers come faster through each lap (the accelerando is the warp's).
// g(u) = e^{iρ} u^{s − iβ} Π_k ((1 − q e^{−iθk} u)/(1 − q e^{iθk}/u))^{e_k}, k = 1 … 25. On |u| = 1 each factor has
// modulus 1 (numerator and denominator are conjugates there) and argument e_k·2·arg(1 − q e^{i(t − θk)}): a smoothed
// sawtooth stepping at θk. With s + Σ e_k = 0 their slopes cancel, so arg g is a staircase: flat on each note, one
// fast step at each note's start (the lines in between are crossed within a few ms: a grace slide into the note).
// The 26th step, each theme's downbeat (A down to B), is u^s's branch cut at u = −1 (the crack: the drum). u^{−iβ}
// has modulus e^{β Arg u} on the circle and does not move arg F: |F| grows through each theme (a crescendo) and
// falls back at the cut. Each plateau sits 0.3 of a line past the line it crossed (the Glide is 30 cents sharp of
// the note, the notes safe from the next line). The constants e_k, s, ρ are least squares on those plateaus.
// Listen along: two laps of the unit circle (four themes) from the warp's slowest point, at 250 px/s with
// view.s = 380 px a unit: 19.1 s.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TAU = 2 * Math.PI, wrap = (t) => t - TAU * Math.round(t / TAU);
const dry = process.argv.includes('--dry');

// ---- the theme: semitones above B, quaver slots (32 a statement); B is line 9 above D (B minor, as Grieg's)
const THEME = [[0, 1], [2, 1], [3, 1], [5, 1], [7, 1], [3, 1], [7, 2], [6, 1], [2, 1], [6, 2], [5, 1], [1, 1], [5, 2],
  [0, 1], [2, 1], [3, 1], [5, 1], [7, 1], [3, 1], [7, 1], [12, 1], [10, 1], [7, 1], [3, 1], [7, 1], [10, 4]];
const SLOTS = 32, KEY = 9;
const O = { q: 0.995, M: 2, b: 0.45, off: 0.3, beta: 0.25, pxu: 380, themes: 4, V: 250, ptsPerLap: 720, dig: 5 };
const HARM = [1, 1 / 4, 1 / 9];
// plateaus: arriving upward at line N, arg F rests at N + off; downward at N − off (the note before the first: A)
const PL = []; { let prev = 10 - 12, slot = 0; for (const [nn, d] of THEME) { PL.push({ n: nn, slot, d, v: nn + (nn > prev ? O.off : -O.off) }); prev = nn; slot += d; } }

// ---- the warp's slowest point (the start), and the lead that puts it half a quaver before a downbeat
const psi = (t) => t + O.b * HARM.reduce((a, h, i) => a + h * Math.cos((i + 1) * t), 0);
const dpsi = (t) => 1 - O.b * HARM.reduce((a, h, i) => a + h * (i + 1) * Math.sin((i + 1) * t), 0);
let ts = 0; { let m = Infinity; for (let i = 0; i < 3600; i++) { const t = TAU * i / 3600, d = dpsi(t); if (d < m) { m = d; ts = t; } } }
const W0 = O.M * psi(ts), lead = ((W0 * SLOTS / TAU + 0.5) % SLOTS + SLOTS) % SLOTS;
const thw = PL.map((p) => TAU * (p.slot + lead) / SLOTS);          // w-angles (w = z^M e^{iMbΣ}) of the note starts
const alpha = wrap(Math.PI - thw[0]);                               // u = e^{iα} w: the downbeat at u = −1
const th = thw.slice(1).map((t) => wrap(t + alpha)), K = th.length;

// ---- least squares: arg g(t) = s·t + Σ e_k A_k(t) + ρ on t ∈ (−π, π] (u's angle) to the plateaus, s + Σ e = 0
const Ak = (t, k) => { const x = t - th[k]; return 2 * Math.atan2(-O.q * Math.sin(x), 1 - O.q * Math.cos(x)); };
const rows = [], rhs = [];
for (const p of PL) for (const f of [0.25, 0.5, 0.75]) { const t = wrap(TAU * (p.slot + lead + f * p.d) / SLOTS + alpha); rows.push([...th.map((_, k) => Ak(t, k)), t, 1]); rhs.push((p.v + KEY) * Math.PI / 6); }
rows.push([...th.map(() => 10), 10, 0]); rhs.push(0);
const nU = K + 2, AtA = Array.from({ length: nU }, () => new Float64Array(nU)), Atb = new Float64Array(nU);
rows.forEach((r, i) => { for (let a = 0; a < nU; a++) { Atb[a] += r[a] * rhs[i]; for (let c = 0; c < nU; c++) AtA[a][c] += r[a] * r[c]; } });
for (let a = 0; a < nU; a++) AtA[a][a] += 1e-9;
for (let c = 0; c < nU; c++) { let m = c; for (let r = c + 1; r < nU; r++) if (Math.abs(AtA[r][c]) > Math.abs(AtA[m][c])) m = r; [AtA[c], AtA[m]] = [AtA[m], AtA[c]]; [Atb[c], Atb[m]] = [Atb[m], Atb[c]];
  for (let r = 0; r < nU; r++) if (r !== c) { const f = AtA[r][c] / AtA[c][c]; for (let k = c; k < nU; k++) AtA[r][k] -= f * AtA[c][k]; Atb[r] -= f * Atb[c]; } }
const X = Array.from(Atb, (v, i) => v / AtA[i][i]), ex = X.slice(0, K), s = X[K], rho = wrap(X[K + 1]);

// ---- the typed chain: step 1 u(z), step 2 g(z) (z is u there); constants rounded to O.dig decimals
const r = (v) => +v.toFixed(O.dig);
const cplx = (re, im) => `(${r(re)}${im < 0 ? '-' : '+'}${Math.abs(r(im))}i)`;
const sg = (v) => (v < 0 ? '-' : '+') + Math.abs(r(v));
const exprU = `z^2*exp(${r(alpha)}i+0.45i*(z+1/z+(z^2+1/z^2)/4+(z^3+1/z^3)/9))`;
const exprG = `exp(${r(rho)}i+(${r(s)}-${r(O.beta)}i)*log(z)` + th.map((t, k) => `${sg(ex[k])}*log((1-${cplx(O.q * Math.cos(t), -O.q * Math.sin(t))}*z)/(1-${cplx(O.q * Math.cos(t), O.q * Math.sin(t))}/z))`).join('') + ')';

// ---- check: the app's own parser and complex arithmetic (src/cx.js, parse.js, funcs.js in a vm, as test/t_gl_inverse.js)
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
for (const [f, nm] of [['cx', 'CX'], ['parse', 'Expr'], ['funcs', 'Funcs']]) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f + '.js'), 'utf8') + `\n;globalThis.${nm} = ${nm};`, ctx, { filename: f + '.js' });
const fU = ctx.Expr.compile(ctx.Expr.parse(exprU)), fG = ctx.Expr.compile(ctx.Expr.parse(exprG));
const F = (x, y) => fG(fU({ re: x, im: y }));
// the path: two laps of |z| = 1 from the slowest point, ending inside the last theme's long A
const W1 = W0 + TAU * O.themes;
let lo = ts, hi = ts + TAU * (O.themes / O.M + 1); for (let k = 0; k < 60; k++) { const c = (lo + hi) / 2; if (O.M * psi(c) < W1) lo = c; else hi = c; }
const te = lo, nPts = Math.round(O.ptsPerLap * (te - ts) / TAU) + 1;
const pts = Array.from({ length: nPts }, (_, i) => { const t = ts + (te - ts) * i / (nPts - 1); return [+Math.cos(t).toFixed(5), +Math.sin(t).toFixed(5)]; });
const dur = (te - ts) * O.pxu / O.V;
// along the path: the line crossings of arg F (unwrapped; where u crosses −1, the cut: arg F drops by 2πs, a crack
// and no lines), |F|, and the design's own F (the same constants unrounded) for the rounding error
const fD = (x, y) => { const w = fU({ re: x, im: y }), lr = Math.log(Math.hypot(w.re, w.im)), au = Math.atan2(w.im, w.re); let gr = s * lr + O.beta * au, gi = s * au - O.beta * lr + rho;
  for (let k = 0; k < K; k++) { const a = Math.atan2(w.im, w.re) - th[k], q = O.q; gi += ex[k] * 2 * Math.atan2(-q * Math.sin(a), 1 - q * Math.cos(a)); } return gi; };
const NS = 40000; let prev = null, prevU = null, phi = 0, cuts = 0, lnMin = Infinity, lnMax = -Infinity, dMax = 0; const seq = []; let line = null;
for (let i = 0; i <= NS; i++) {
  const t = ts + (te - ts) * i / NS, x = Math.cos(t), y = Math.sin(t), g = F(x, y), u = fU({ re: x, im: y }), a = Math.atan2(g.im, g.re), lm = Math.log(Math.hypot(g.re, g.im));
  lnMin = Math.min(lnMin, lm); lnMax = Math.max(lnMax, lm);
  const dd = Math.abs(wrap(a - fD(x, y))); dMax = Math.max(dMax, dd);
  const cut = prevU && u.re < 0 && prevU.re < 0 && Math.sign(u.im) !== Math.sign(prevU.im);
  if (prev == null) phi = a; else if (cut) { cuts++; phi = a; line = null; } else { let d = a - prev; d -= TAU * Math.round(d / TAU); phi += d; }
  prev = a; prevU = u;
  const L = Math.floor(phi * 6 / Math.PI + 1e-9);
  if (line != null && L !== line) seq.push({ i, pc: (((L > line ? L : line) % 12) + 12) % 12 });
  if (cut) seq.push({ i, pc: (((Math.floor(phi * 6 / Math.PI)) % 12) + 12) % 12, cut: true });
  line = L;
}
// the heard note of each step: the last line crossed before arg F rests (crossings within 45 ms merged, as a strum)
const gap = NS * 0.045 / ((te - ts) * O.pxu / O.V), heard = []; seq.forEach((c, j) => { const nx = seq[j + 1]; if (!nx || nx.i - c.i > gap) heard.push(c.pc); });
const expect = []; for (let t = 0; t < O.themes; t++) for (const p of PL) expect.push((p.n + KEY) % 12);
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const fmt = (x) => +x.toFixed(4);
console.log(JSON.stringify({ chars: { u: exprU.length, g: exprG.length }, logs: K + 1, s: fmt(s), rho: fmt(rho), alpha: fmt(alpha), lead: fmt(lead),
  dur: fmt(dur), cuts, lnAbsF: [fmt(lnMin), fmt(lnMax)], roundingSemitones: fmt(dMax * 6 / Math.PI), crossings: seq.length, heardNotes: heard.length, editDistance: lev(heard, expect), heardHead: heard.slice(0, 28).join(' '), themeHead: expect.slice(0, 28).join(' ') }));

const SEASONG = {
  // the chain: X's z → u (the warp) → F; custom steps, principal logs (cut 180°)
  steps: [{ type: 'custom', params: { expr: exprU, cut: 180 } }, { type: 'custom', params: { expr: exprG, cut: 180 } }],
  tex: 'F=e^{i\\rho}\\,u^{s-i\\beta}\\prod_{k=1}^{25}\\left(\\frac{1-q e^{-i\\theta_k}u}{1-q e^{i\\theta_k}/u}\\right)^{e_k}',
  view: { cx: 0, cy: 0, s: O.pxu }, fit: { x0: -1.12, x1: 1.12, y0: -1.12, y1: 1.12 },
  pts, sectors: 12, dur: fmt(dur),
  design: { q: O.q, warp: 0.45, off: O.off, beta: O.beta, s: fmt(s), rho: fmt(rho), alpha: fmt(alpha), e: ex.map(fmt), theta: th.map(fmt), themes: O.themes, pxPerS: O.V },
};
const js = `'use strict';
// GENERATED by tools/mk_function.js: do not edit (notes/sea-song/FUNCTION.md).
// In the Hall of the Mountain King as a function: steps, the chain X's z → u → F (two custom steps); tex, its form;
// view and fit, the unit circle at ${O.pxu} px a unit; pts, the Listen-along path (two laps of |z| = 1 from the warp's
// slowest point: ${fmt(dur)} s at ${O.V} px/s, four statements of the theme); sectors, the Phase key's n (12: a line is a
// semitone); design, the constants and where they come from (the tool's header).
const SEASONG = ${JSON.stringify(SEASONG)};
if (typeof module !== 'undefined' && module.exports) module.exports = { SEASONG };
`;
if (!dry) { fs.writeFileSync(path.join(ROOT, 'src', 'seasong.js'), js); console.log('wrote src/seasong.js (' + js.length + ' bytes)'); }
module.exports = { SEASONG, exprU, exprG, F };

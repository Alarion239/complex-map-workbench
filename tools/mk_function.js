'use strict';
// The Mountain King as a function (notes/sea-song/FUNCTION.md): F = H(u(z)), whose own colour lines play Grieg's theme
// through the fixed sound map ("Hear the function": a note each time arg F crosses one of the n = 12 lines, pitch class
// 12k/n semitones above D, loudness from |F|, a crack at a branch cut). No score, no special rule: this tool only
// places F's branch points and writes the example's data (src/seasong.js).
//   node tools/mk_function.js [--dry]
//
// H is a "theme wheel" on the unit circle |u| = 1: one Apollonius pair of branch points per melodic step j (25 of them),
// p_j just inside the circle and p_j' = 1/conj(p_j) just outside, in
//   H(u) = c · u^s · Π_j [ (u − p_j)/u ÷ (1 − u/p_j') ]^(D_j/12),   s = Σ D_j/12.
// On |u| = 1 the pair's factor has modulus 1 (Apollonius: |u − p|/|u − p'| is constant on the circle) and argument
// D_j/12·(2π·[u past the pair] − the angle it has turned): by the inscribed-angle theorem arg H steps by D_j semitones
// where u passes between p_j and p_j', within d = 0.5 px, and turns steadily otherwise; u^s cancels every steady turn.
// So along the circle arg H is a staircase: flat on each note (0.35 of a line past its line), a sharp step at each
// note's start, and |H| is constant (no band edge: no repeat). The steps sit on a grid of 32 quavers a turn; the
// 26th step (the last A down to the next B) is u^s's own branch cut: the crack, the drum, placed 82 ms of path time
// before the downbeat so that the fixed cut figure (crack, the held note again at +12 ms, the new one at +82 ms)
// puts the downbeat B on the beat.
// u(z) = ((z − a)/(1 − a·z))², a = 0.0945: a disk automorphism, squared. It maps |z| = 1 onto |u| = 1 twice, so a lap
// of the circle plays the theme twice, and it turns fastest near z = a, so the statement through z = 1 is faster
// (5.35 s, then 4.20 s at 250 px/s and view.s = 380): the accelerando is the Möbius map's.
// The typed form groups the pairs by |D|: one principal log for a group's inner points, one for its outer points,
// split when a base would turn more than 1.6π along the circle (a principal log must never cut the path): 29 logs.
// Listen along: two laps of |z| = 1 from one quaver before the first downbeat to just before the fifth cut: four
// statements, four cracks, ending on the theme's last A.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TAU = 2 * Math.PI, dry = process.argv.includes('--dry');

// ---- the app's own parser and complex arithmetic (src/cx.js, parse.js, funcs.js in a vm, as test/t_seasong.js)
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
for (const [f, nm] of [['cx', 'CX'], ['symbolic', 'Symbolic'], ['parse', 'Expr'], ['funcs', 'Funcs']]) vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f + '.js'), 'utf8') + `\n;globalThis.${nm} = ${nm};`, ctx, { filename: f + '.js' });
const Expr = ctx.Expr;
const C = (re, im) => ({ re, im });
const cmul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const carg = (a) => Math.atan2(a.im, a.re);
const fmt = (v, d = 4) => { const r = +v.re.toFixed(d), i = +v.im.toFixed(d); return `${r}${i < 0 ? '-' : '+'}${Math.abs(i)}i`; };
const r4 = (x) => +x.toFixed(4);

// ---- the theme (B minor, as Grieg's): pitch classes above D (B = 9), the steps between notes, quaver lengths
const THEME = {
  pc: [9, 11, 0, 2, 4, 0, 4, 3, 11, 3, 2, 10, 2, 9, 11, 0, 2, 4, 0, 4, 9, 7, 4, 0, 4, 7],
  iv: [2, 1, 2, 2, -4, 4, -1, -4, 4, -1, -4, 4, -5, 2, 1, 2, 2, -4, 4, 5, -2, -3, -4, 4, 3],
  dur: [1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4],
};
THEME.onset = THEME.dur.reduce((a, d, i) => (a.push(i ? a[i - 1] + THEME.dur[i - 1] : 0), a), []);
const NQ = 32;   // quavers a statement
const O = { a: 0.0945, d: 0.5, off: 0.35, cutOff: 0.2, cutLead: 0.082, pxu: 380, V: 250, laps: 2, endBefore: 0.12, LIM: 1.6 * Math.PI, ptsPerLap: 720 };

// ---- H's design: one statement a turn of u, steady quavers. H's own time runs 8 s a turn (0.25 s a quaver) on the
// unit circle; the Möbius map sets the real tempo. d is in H's px (318.3 a unit), cutLead in H's time near u = −1.
const Hq = 0.25, Hv = 250, Hpxu = NQ * Hq * Hv / TAU;
const des = (() => {
  const T = [0]; for (let k = 0; k < NQ; k++) T.push(T[k] + Hq);
  const lap = T[NQ], Rpx = lap * Hv / TAU, R = Rpx / Hpxu, d = O.d / Hpxu, dpx = O.d;
  const u = [THEME.pc[0]]; for (const k of THEME.iv) u.push(u[u.length - 1] + k);
  const n = u.length, x = u.map((p, i) => (i === 0 ? p + O.cutOff : i === n - 1 ? p + Math.sign(THEME.iv[i - 1]) * O.cutOff : p + Math.sign(THEME.iv[i - 1]) * O.off));
  const steps = [];
  for (let i = 1; i < n; i++) {
    const D = x[i] - x[i - 1], up = D > 0, lines = [];
    if (up) for (let L = Math.floor(x[i - 1]) + 1; L <= x[i]; L++) lines.push(L); else for (let L = Math.ceil(x[i - 1]) - 1; L >= x[i]; L--) lines.push(L);
    const fr = lines.map((L) => (L - x[i - 1]) / D), sLast = dpx * Math.tan(Math.PI * (fr[fr.length - 1] - 0.5));
    const phi = Math.PI + (T[THEME.onset[i]] * Hv - sLast) / Rpx, pq = R * R / (R - d);   // the last line crossed on the beat
    steps.push({ i, D: +D.toFixed(6), a: D / 12, phi, p: C((R - d) * Math.cos(phi), (R - d) * Math.sin(phi)), q: C(pq * Math.cos(phi), pq * Math.sin(phi)) });
  }
  // the crack ahead of the downbeat by cutLead of path time: near u = −1 the path turns u at 2|B'|·V/pxu, |B'| = (1 − a²)/(1 + a²)
  const lead = O.cutLead * (8 / TAU) * 2 * ((1 - O.a * O.a) / (1 + O.a * O.a)) * O.V / O.pxu;
  const sStmt = steps.reduce((acc, s) => acc + s.a, 0);
  return { T, R, x, steps, cut: { psi: Math.PI - Hv * lead / Rpx, s: sStmt } };
})();

// ---- the typed H, grouped by |D|; the constant c fitted on the rests (arg H at x, mean ln|H| = 0 on the circle)
const exprH = (() => {
  const NS = 4000, path0 = (k) => { const a = Math.PI + TAU * (k + 0.5) / NS; return C(des.R * Math.cos(a), des.R * Math.sin(a)); };
  const range = (fn) => { let prev = null, acc = 0, lo = Infinity, hi = -Infinity; for (let k = 0; k < NS; k++) { const a = carg(fn(path0(k))); if (prev == null) acc = a; else { let dd = a - prev; dd -= TAU * Math.round(dd / TAU); acc += dd; } prev = a; lo = Math.min(lo, acc); hi = Math.max(hi, acc); } return { lo, hi, span: hi - lo }; };
  const inner = (pts) => (z) => { let g = C(1, 0); for (const p of pts) g = cmul(g, cdiv(C(z.re - p.re, z.im - p.im), z)); return g; };
  const outer = (pts) => (z) => { let g = C(1, 0); for (const q of pts) { const w = cdiv(z, q); g = cmul(g, C(1 - w.re, -w.im)); } return g; };
  const byD = new Map(); for (const st of des.steps) { const k = Math.abs(st.D).toFixed(4); if (!byD.has(k)) byD.set(k, []); byD.get(k).push(st); }
  const groups = [];
  for (const [k, sts] of byD) {
    const sorted = sts.slice().sort((a, b) => a.phi - b.phi);
    const fits = (ch) => {
      const num = ch.filter((s) => s.D > 0), den = ch.filter((s) => s.D < 0);
      const fi = (z) => cdiv(inner(num.map((s) => s.p))(z), inner(den.map((s) => s.p))(z));
      const fo = (z) => cdiv(outer(num.map((s) => s.q))(z), outer(den.map((s) => s.q))(z));
      const ri = range(fi), ro = range(fo); return ri.span < O.LIM && ro.span < O.LIM ? { ri, ro, num, den } : null;
    };
    let chunks = [];
    for (const s of sorted) { let put = false; for (const ch of chunks) { if (fits(ch.concat([s]))) { ch.push(s); put = true; break; } } if (!put) chunks.push([s]); }
    for (let parts = 1; parts < chunks.length; parts++) {
      const alt = Array.from({ length: parts }, () => []); sorted.forEach((s, j) => alt[j % parts].push(s));
      if (alt.every((ch) => fits(ch))) { chunks = alt; break; }
    }
    for (const ch of chunks) groups.push({ a: +k / 12, ...fits(ch) });
  }
  const term = (pts, kind) => pts.map((p) => (kind === 'in' ? `(z-(${fmt(p)}))` : `(1-z/(${fmt(p)}))`)).join('*');
  const rot = C(Math.cos(-(des.cut.psi - Math.PI)), Math.sin(-(des.cut.psi - Math.PI)));
  const parts = [`${+des.cut.s.toFixed(5)}*log(z*(${fmt(rot, 5)}))`];
  for (const g of groups) {
    const mi = (g.ri.lo + g.ri.hi) / 2, mo = (g.ro.lo + g.ro.hi) / 2, ri = C(Math.cos(-mi), Math.sin(-mi)), ro = C(Math.cos(-mo), Math.sin(-mo));
    const zn = g.num.length - g.den.length, zpow = (m) => (m === 0 ? '' : Math.abs(m) === 1 ? 'z' : `z^${Math.abs(m)}`);
    let inT = `(${fmt(ri, 5)})*${g.num.length ? term(g.num.map((s) => s.p), 'in') : '1'}`;
    if (g.den.length || zn > 0) inT += `/(${[g.den.length ? term(g.den.map((s) => s.p), 'in') : '', zn > 0 ? zpow(zn) : ''].filter(Boolean).join('*')})`;
    if (zn < 0) inT = `${zpow(-zn)}*${inT}`;
    let outT = `(${fmt(ro, 5)})*${g.num.length ? term(g.num.map((s) => s.q), 'out') : '1'}`;
    if (g.den.length) outT += `/(${term(g.den.map((s) => s.q), 'out')})`;
    parts.push(`${+(12 * g.a).toFixed(4)}/12*(log(${inT})-log(${outT}))`);
  }
  const body = parts.join('+'), fb = Expr.compile(Expr.parse(`exp(${body})`));
  let sinA = 0, cosA = 0, lnS = 0, k = 0;
  for (let i = 0; i < des.x.length; i++) {
    const t0 = des.T[THEME.onset[i]], t1 = des.T[THEME.onset[i] + THEME.dur[i]], a = Math.PI + Hv * (t0 + t1) / 2 / (des.R * Hpxu) + 1e-6;
    const g = fb(C(des.R * Math.cos(a), des.R * Math.sin(a))), want = TAU * des.x[i] / 12, got = carg(g);
    sinA += Math.sin(want - got); cosA += Math.cos(want - got); lnS += Math.log(Math.hypot(g.re, g.im)); k++;
  }
  const gam = Math.atan2(sinA, cosA), mag = Math.exp(-lnS / k);
  return `(${fmt(C(mag * Math.cos(gam), mag * Math.sin(gam)), 4)})*exp(${body})`;
})();
const exprU = `((z-${O.a})/(1-${O.a}*z))^2`;
const fU = Expr.compile(Expr.parse(exprU)), fH = Expr.compile(Expr.parse(exprH)), F = (z) => fH(fU(z));

// ---- the path: |z| = 1 anticlockwise from one quaver (of u) before the downbeat B(z) = i (u = −1), two laps, ending
// endBefore s before the fifth downbeat (so before its cut: four cracks)
const Bang = (th) => { const zr = Math.cos(th), zi = Math.sin(th), nr = zr - O.a, ni = zi, dr = 1 - O.a * zr, di = -O.a * zi; return Math.atan2(ni * dr - nr * di, nr * dr + ni * di); };
const thDown = 2 * Math.atan((1 - O.a) / (1 + O.a)), lapS = TAU * O.pxu / O.V;
let q1 = 0; { const w0 = 2 * Bang(thDown); for (let j = 1; j < 400000; j++) { const t = j * 1e-5; let d = 2 * Bang(thDown + O.V * t / O.pxu) - w0; d -= TAU * Math.round(d / TAU); if (d >= TAU / NQ) { q1 = t; break; } } }
const th0 = thDown - O.V * q1 / O.pxu, move = O.laps * lapS + q1 - O.endBefore, th1 = th0 + O.V * move / O.pxu;
const nPts = Math.round(O.ptsPerLap * (th1 - th0) / TAU) + 1;
const pts = Array.from({ length: nPts }, (_, i) => { const t = th0 + (th1 - th0) * i / (nPts - 1); return [+Math.cos(t).toFixed(5), +Math.sin(t).toFixed(5)]; });

// ---- check along the path: the lines arg F crosses (a jump of more than 1.5 lines between samples 0.1 px apart is
// the cut), ln|F|, the statements' lengths
const NS = 60000; let prev = null, phi = 0, line = null, cuts = 0, lnMin = Infinity, lnMax = -Infinity; const seq = [], cutT = [];
for (let i = 0; i <= NS; i++) {
  const t = th0 + (th1 - th0) * i / NS, g = F(C(Math.cos(t), Math.sin(t))), a = carg(g), lm = Math.log(Math.hypot(g.re, g.im));
  lnMin = Math.min(lnMin, lm); lnMax = Math.max(lnMax, lm);
  let cut = false;
  if (prev == null) phi = a; else { let d = a - prev; d -= TAU * Math.round(d / TAU); if (Math.abs(d) * 6 / Math.PI > 1.5) { cut = true; cuts++; cutT.push(move * i / NS); phi = a; line = null; } else phi += d; }
  prev = a;
  const L = Math.floor(phi * 6 / Math.PI + 1e-9);
  if (line != null && L !== line) seq.push({ i, pc: (((L > line ? L : line) % 12) + 12) % 12 });
  if (cut) seq.push({ i, pc: ((L % 12) + 12) % 12, cut: true });
  line = L;
}
const gap = NS * 0.045 / move, heard = []; seq.forEach((c, j) => { const nx = seq[j + 1]; if (!nx || nx.i - c.i > gap) heard.push(c.pc); });
const expect = [].concat(...Array.from({ length: 2 * O.laps }, () => THEME.pc));
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const logs = (exprH.match(/log\(/g) || []).length;
console.log(JSON.stringify({ chars: { u: exprU.length, F: exprH.length }, logs, pairs: des.steps.length, dur: r4(move), cuts, cutAtS: cutT.map(r4), statementsS: cutT.slice(1).map((t, k) => r4(t - cutT[k])),
  lnAbsF: [r4(lnMin), r4(lnMax)], crossings: seq.length, heardNotes: heard.length, editDistance: lev(heard, expect) }));

// Step 2's display form (params.show, in z: its input, w₁ on screen), keyed by showOf = Funcs.showKey(exprH) so that
// editing the formula drops it. The Inspector shows it in place of the 1786-character formula, which it would not
// typeset; the map, the field and the export keep exprH. Each pair's logs, log(z − p_j) − log z − log(1 − z/p_j*),
// are its factor; s·log(zρ) is (ρz)^s, where ρ = e^{−i(ψ−π)} places u^s's cut (the crack); c has |c₀| and arg c₀
// plus the logs' centring rotations, of modulus 1.
const SHOW_H = `c\\,(\\rho z)^{s}\\prod_{j=1}^{${des.steps.length}}\\left(\\frac{z-p_j}{z\\,(1-z/p_j^{*})}\\right)^{D_j/12}`;
const SEASONG = {
  // the chain: X's z → u (the Möbius map, squared) → F (the theme wheel); custom steps, principal logs (cut 180°)
  steps: [{ type: 'custom', params: { expr: exprU, cut: 180 } }, { type: 'custom', params: { expr: exprH, cut: 180, show: SHOW_H, showOf: ctx.Funcs.showKey(exprH) } }],
  tex: `u=\\left(\\frac{z-a}{1-az}\\right)^{2},\\quad F=c\\,(\\rho u)^{s}\\prod_{j=1}^{${des.steps.length}}\\left(\\frac{u-p_j}{u\\,(1-u/p_j^{*})}\\right)^{D_j/12},\\quad p_j^{*}=1/\\bar p_j`,
  view: { cx: 0, cy: 0, s: O.pxu }, fit: { x0: -1.12, x1: 1.12, y0: -1.12, y1: 1.12 },
  pts, sectors: 12, dur: r4(move),
  design: { a: O.a, dPx: O.d, off: O.off, cutOff: O.cutOff, cutLeadS: O.cutLead, s: r4(des.cut.s), pairs: des.steps.map((s) => ({ D: r4(s.D), phi: r4(s.phi) })), logs, themes: 2 * O.laps, pxPerS: O.V },
};
const js = `'use strict';
// GENERATED by tools/mk_function.js: do not edit (notes/sea-song/FUNCTION.md).
// In the Hall of the Mountain King as a function: steps, the chain X's z → u → F (two custom steps: a Möbius map
// squared, then the theme wheel of 25 Apollonius pairs of branch points); tex, its form; view and fit, the unit circle
// at ${O.pxu} px a unit; pts, the Listen-along path (two laps of |z| = 1 from a quaver before the first downbeat:
// ${r4(move)} s at ${O.V} px/s, four statements of the theme, four cracks); sectors, the Phase key's n (12: a line is a
// semitone); design, the constants and where they come from (the tool's header).
const SEASONG = ${JSON.stringify(SEASONG)};
if (typeof module !== 'undefined' && module.exports) module.exports = { SEASONG };
`;
if (!dry) { fs.writeFileSync(path.join(ROOT, 'src', 'seasong.js'), js); console.log('wrote src/seasong.js (' + js.length + ' bytes)'); }
module.exports = { SEASONG, exprU, exprH, F };

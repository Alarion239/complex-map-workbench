'use strict';
// Runs the sphere-native mesher on the acceptance cases and measures cost and image quality against exact truth.
//   node notes/proto/sphere-native/run_cases.js [filter...] [--json out.json]
const { Mesher, lift, FIN, INF } = require('./sphm_lead.js');
const { C } = CX;
const Region = require('../../../src/region.js');
const PI = Math.PI, TAU = 2 * PI;
const W = 410, H = 516;                         // a plane at 1440x900 (the regress suite's size)
const step = (type, params = {}) => { const b = Funcs.build({ type, params }); if (b.error) throw new Error(b.error); return b; };
const chain = (...bs) => { const f = (z) => { for (const b of bs) z = b.f(z); return z; }; f.steps = bs; return f; };
const abs = (w) => Math.hypot(w.re, w.im);

const Hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const LOGH_VIEW = { cx: -0.18, cy: PI / 2, s: 97 };
const BASE = {
  zi_H: { F: chain(step('powa', { alpha: 'i', cut: 180, k: 0 })), shape: Hp, left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 },
    truth: (w) => { const r = abs(w); return r > Math.exp(-PI) && r < 1; }, pattern: 'polar',
    parity: (w) => { // polar cells of the source: ln|z_k| = arg w + 2 pi k, arg z_k = -ln|w| (mod 2 pi)
      const gx = Math.atan2(w.im, w.re) * 16 / TAU;
      let a = -Math.log(abs(w)); a -= TAU * Math.round(a / TAU); const gy = a * 16 / TAU;
      const r = abs(w), grad = 16 / TAU / r;   // cells per w unit, both coordinates
      return { gx, gy, gradx: grad, grady: grad };
    } },
  logH: { F: chain(step('log', { cut: 180, k: 0 })), shape: Hp, left: { cx: 0, cy: 1, s: 60 }, view: LOGH_VIEW,
    truth: (w) => w.im > 0 && w.im < PI, pattern: 'checker', cell: 1,
    parity: (w) => { const z = CX.exp(w), r = abs(z); return { gx: z.re, gy: z.im, gradx: r, grady: r }; } },
  expH: { F: chain(step('exp')), shape: Hp, left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 30 },
    truth: (w) => !(w.re === 0 && w.im === 0), pattern: 'solid' },
  e1z_disc: { F: chain(step('recip'), step('exp')), shape: { kind: 'disc', c: [0, 0], r: 1 }, left: { cx: 0, cy: 0, s: 120 }, view: { cx: 0, cy: 0, s: 60 },
    truth: (w) => !(w.re === 0 && w.im === 0), pattern: 'solid' },
  exp_strip: { F: chain(step('exp')), shape: { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, left: { cx: 0, cy: 0, s: 52 }, view: { cx: 2, cy: 0, s: 40 },
    truth: (w) => w.re > 0, pattern: 'solid' },
  cayley_H: { F: chain(step('mobius', { a: '1', b: '-i', c: '1', d: 'i' })), shape: Hp, left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 },
    truth: (w) => abs(w) < 1, pattern: 'solid' },
  sq_Q1: { F: chain(step('pown', { n: 2 })), shape: { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, left: { cx: 0.6, cy: 0.6, s: 70 }, view: { cx: 0, cy: 2, s: 60 },
    truth: (w) => w.im > 0, pattern: 'checker', cell: 0.5,
    parity: (w) => { const r = Math.sqrt(abs(w)), t = Math.atan2(w.im, w.re) / 2, z = C(r * Math.cos(t), r * Math.sin(t)); const g = 1 / (2 * r) / 0.5; return { gx: z.re / 0.5, gy: z.im / 0.5, gradx: g, grady: g }; } },
  sin_halfstrip: { F: chain(step('sin')), shape: { kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, left: { cx: 0, cy: 1.25, s: 105 }, view: { cx: 0, cy: 2, s: 50 },
    truth: (w) => w.im > 0, pattern: 'solid' },
  recip_ext: { F: chain(step('recip')), shape: { kind: 'disc', c: [0, 0], r: 1, complement: true }, left: { cx: 0, cy: 0, s: 60 }, view: { cx: 0, cy: 0, s: 180 },
    truth: (w) => abs(w) < 1 && abs(w) > 0, pattern: 'solid' },
  sqrt_slit: { F: chain(step('root', { n: 2, cut: 180, k: 0 })), shape: { kind: 'formula', expr: '|z|>0' }, left: { cx: 0, cy: 0, s: 70 }, view: { cx: 1, cy: 0, s: 120 },
    truth: (w) => w.re > 0, pattern: 'solid' },
  disc_cube: { F: chain(step('pown', { n: 3 })), shape: { kind: 'disc', c: [0.6, 0.3], r: 0.8 }, left: { cx: 0.4, cy: 0.2, s: 120 }, view: { cx: 0.15, cy: 1, s: 74.5 },
    truth: (w) => { const r = Math.cbrt(abs(w)), t = Math.atan2(w.im, w.re); return [0, 1, 2].some((k) => Math.hypot(r * Math.cos((t + 2 * PI * k) / 3) - 0.6, r * Math.sin((t + 2 * PI * k) / 3) - 0.3) < 0.8); }, pattern: 'solid' },
};
const CASES = [];
const add = (name, base, viewMod = {}, extra = {}) => CASES.push(Object.assign({ name, base }, BASE[base], extra, { view: Object.assign({ kind: 'flat', W, H }, BASE[base].view, viewMod) }));
for (const b of Object.keys(BASE)) {
  const v = BASE[b].view;
  add(b, b);
  add(b + '_out4', b, { s: v.s / 4 });
  add(b + '_out16', b, { s: v.s / 16 });
}
add('zi_H_solid_a085', 'zi_H', {}, { pattern: 'solid', alpha: 0.85 });
add('zi_H_out16_a085', 'zi_H', { s: 190 / 16 }, { alpha: 0.85 });
add('cayley_H_zoom1', 'cayley_H', { cx: 1, cy: 0, s: 190 * 64 });
add('recip_ext_zoom0', 'recip_ext', { cx: 0, cy: 0, s: 180 * 128 });
add('zi_H_guard3', 'zi_H', {}, { guard: 3 });
add('logH_guard3', 'logH', {}, { guard: 3 });
add('expH_guard3', 'expH', {}, { guard: 3 });
// the Riemann-sphere view of the image (globe radius 180 px): chordal criteria
const sph = (name, base, extra = {}) => CASES.push(Object.assign({ name, base }, BASE[base], extra, { view: { kind: 'sphere', R: 180 } }));
sph('zi_H_sphere', 'zi_H');
sph('logH_sphere', 'logH');
sph('expH_sphere', 'expH');
sph('cayley_H_sphere', 'cayley_H');
sph('e1z_disc_sphere', 'e1z_disc');

// ---------------- measurement ----------------
function measureFlat(M, cs, out) {
  const view = cs.view, V = M.V();
  const px = (i) => [(V.WX[i] - view.cx) * view.s + W / 2, (view.cy - V.WY[i]) * view.s + H / 2];
  // draw order: far (large D) first; ties (D equal): lower source y first (the old row order: later rows on top)
  const ys = (i) => V.ZY[i];
  out.sort((a, b) => (b.D - a.D) || ((ys(a.v[0]) + ys(a.v[1]) + ys(a.v[2])) - (ys(b.v[0]) + ys(b.v[1]) + ys(b.v[2]))));
  const count = new Uint16Array(W * H), top = new Int32Array(W * H).fill(-1);
  const pat = cs.pattern !== 'solid' && cs.parity;
  const topPar = pat ? new Int8Array(W * H).fill(-1) : null;
  out.forEach((tr, idx) => {
    const P = tr.v.map(px);
    const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    if (x0 > x1 || y0 > y1) return;
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (!area) return;
    let A = null;
    if (pat) {   // per-vertex attributes, per-triangle unwrapped (as the shader would get them)
      A = tr.v.map((i) => M.patAttr(i, [0, 0]));
      if (cs.pattern === 'polar') for (let k = 1; k < 3; k++) { while (A[k][1] - A[0][1] > 8) A[k][1] -= 16; while (A[k][1] - A[0][1] < -8) A[k][1] += 16; }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const l1 = ((P[1][0] - X) * (P[2][1] - Y) - (P[2][0] - X) * (P[1][1] - Y)) / area;
      const l2 = ((P[2][0] - X) * (P[0][1] - Y) - (P[0][0] - X) * (P[2][1] - Y)) / area;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const k = y * W + x;
      count[k]++; top[k] = idx;
      if (pat) {
        const gx = l1 * A[0][0] + l2 * A[1][0] + l3 * A[2][0], gy = l1 * A[0][1] + l2 * A[1][1] + l3 * A[2][1];
        topPar[k] = ((Math.floor(gx) + Math.floor(gy)) % 2 + 2) % 2;
      }
    }
  });
  // truth, with the 2.5 px band around the true boundary excluded
  const wOf = (x, y) => C(view.cx + (x - W / 2) / view.s, view.cy - (y - H / 2) / view.s);
  let nIn = 0, nOut = 0, nBand = 0, hole = 0, spill = 0, inter = 0, uni = 0, minLayers = Infinity, layerSum = 0, parN = 0, parBad = 0;
  const BAND = 2.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x + 0.5, Y = y + 0.5, t = cs.truth(wOf(X, Y));
    let band = false;
    for (const [dx, dy] of [[BAND, 0], [-BAND, 0], [0, BAND], [0, -BAND], [1.77, 1.77], [-1.77, 1.77], [1.77, -1.77], [-1.77, -1.77]]) if (cs.truth(wOf(X + dx, Y + dy)) !== t) { band = true; break; }
    if (band) { nBand++; continue; }
    const k = y * W + x, c = count[k] > 0;
    if (t) { nIn++; if (!c) { hole++; if (process.env.HOLES && hole <= 40) console.log('hole', x, y, wOf(X, Y)); } minLayers = Math.min(minLayers, count[k]); layerSum += count[k]; } else { nOut++; if (c) spill++; }
    if (t && c) inter++;
    if (t || c) uni++;
    if (pat && t && c) {
      const w = wOf(X, Y), q = cs.parity(w);
      const cpx = Math.min(1 / (q.gradx / view.s), 1 / (q.grady / view.s));   // cell size, px
      if (cpx < 3) continue;
      const ex = Math.abs(q.gx - Math.round(q.gx)) / (q.gradx / view.s), ey = Math.abs(q.gy - Math.round(q.gy)) / (q.grady / view.s);
      if (Math.min(ex, ey) < 1.5) continue;
      parN++;
      const tp = ((Math.floor(q.gx) + Math.floor(q.gy)) % 2 + 2) % 2;
      if (tp !== topPar[k]) parBad++;
    }
  }
  const r = { iou: uni ? inter / uni : 1, hole_px: hole, spill_px: spill, n_in: nIn, n_out: nOut, n_band: nBand, min_layers: nIn ? minLayers : null, mean_layers: nIn ? +(layerSum / nIn).toFixed(2) : null };
  if (pat) { r.parity_scored = parN; r.parity_wrong = parBad; }
  if (cs.base === 'zi_H') {   // the hole |w| < e^-pi must stay empty (pixels farther than 1 px inside it)
    let hc = 0, hn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const w = wOf(x + 0.5, y + 0.5); if (abs(w) < Math.exp(-PI) - 1 / view.s) { hn++; if (count[y * W + x]) hc++; } }
    r.zi_hole_px = hn; r.zi_hole_covered = hc;
  }
  return r;
}
// chord deviation of every FINAL leaf whose image meets the view: shared edges at geodesic 1/4, 3/4; interior points
function chordDev(M, cs) {
  const V = M.V(), T = M.T(), view = cs.view, flat = view.kind === 'flat';
  const S = (w) => {
    if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return null;
    if (!Number.isFinite(w.re) || !Number.isFinite(w.im)) return flat ? null : [0, 0, view.R];
    if (flat) return [(w.re - view.cx) * view.s + W / 2, (view.cy - w.im) * view.s + H / 2, 0];
    const p = lift(w.re, w.im, [0, 0, 0]); return [p[0] * view.R, p[1] * view.R, p[2] * view.R];
  };
  const SV = (i) => (V.WS[i] === INF ? (flat ? null : [0, 0, view.R]) : S(C(V.WX[i], V.WY[i])));
  const nrm = (p) => { const n = Math.hypot(p[0], p[1], p[2]); return [p[0] / n, p[1] / n, p[2] / n]; };
  const P3 = (i) => [V.PX[i], V.PY[i], V.PZ[i]];
  const devs = [];
  let nLeaf = 0;
  for (let t = 0; t < T.nt; t++) {
    if (T.TCH[t] >= 0 || T.TST[t] !== 1) continue;
    const v = [T.TA[t], T.TB[t], T.TC[t]];
    const Pv = v.map(SV);
    if (!Pv.every(Boolean)) continue;
    if (flat) {
      const xs = Pv.map((p) => p[0]), ys = Pv.map((p) => p[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) continue;
    }
    if (!v.every((i) => V.LV[i] > 0)) continue;   // clipped leaves: the boundary test covers them
    nLeaf++;
    let d = 0;
    const pts = [];
    for (let k = 0; k < 3; k++) {   // edge points at 1/4 and 3/4 (geodesic, as the shared edges are built)
      const a = P3(v[k]), b = P3(v[(k + 1) % 3]), m = nrm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
      pts.push([nrm([a[0] + m[0], a[1] + m[1], a[2] + m[2]]), k, (k + 1) % 3, 0.75]);
      pts.push([nrm([b[0] + m[0], b[1] + m[1], b[2] + m[2]]), k, (k + 1) % 3, 0.25]);
    }
    for (const [p, i, j, wi] of pts) {
      const w = M.Fz(M.zOf3(p[0], p[1], p[2])), q = S(w);
      if (!q) { d = Infinity; continue; }
      const e = [wi * Pv[i][0] + (1 - wi) * Pv[j][0], wi * Pv[i][1] + (1 - wi) * Pv[j][1], wi * Pv[i][2] + (1 - wi) * Pv[j][2]];
      d = Math.max(d, Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]));
    }
    for (const bc of [[1 / 3, 1 / 3, 1 / 3], [0.6, 0.2, 0.2], [0.2, 0.6, 0.2], [0.2, 0.2, 0.6]]) {
      const A = v.map(P3);
      const p = nrm([0, 1, 2].map((c) => bc[0] * A[0][c] + bc[1] * A[1][c] + bc[2] * A[2][c]));
      const q = S(M.Fz(M.zOf3(p[0], p[1], p[2])));
      if (!q) { d = Infinity; continue; }
      const e = [0, 1, 2].map((c) => bc[0] * Pv[0][c] + bc[1] * Pv[1][c] + bc[2] * Pv[2][c]);
      d = Math.max(d, Math.hypot(q[0] - e[0], q[1] - e[1], q[2] - e[2]));
    }
    devs.push(d);
  }
  devs.sort((a, b) => a - b);
  const pct = (p) => (devs.length ? devs[Math.min(devs.length - 1, Math.floor(p * devs.length))] : 0);
  return { leaves_in_view: nLeaf, dev_max_px: +pct(1).toFixed(3), dev_p999_px: +pct(0.999).toFixed(3), dev_p99_px: +pct(0.99).toFixed(3), dev_med_px: +pct(0.5).toFixed(3) };
}
// sphere view of z^i(H): is the cap |w| < e^-pi (radius 15 px on a 180 px globe) left empty?
function sphereHole(M, out) {
  const V = M.V();
  const P = (i) => (V.WS[i] === INF ? [0, 0, 1] : lift(V.WX[i], V.WY[i], [0, 0, 0]));
  const tris = out.map((t) => t.v.map(P));
  let n = 0, hit = 0;
  const r0 = Math.exp(-PI) * 0.97;
  for (let k = 0; k < 400; k++) {
    const rr = r0 * Math.sqrt((k + 0.5) / 400), th = k * 2.39996;
    const p = lift(rr * Math.cos(th), rr * Math.sin(th), [0, 0, 0]);
    n++;
    for (const [a, b, c] of tris) {   // ray from the centre through p meets the flat triangle?
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const h = [p[1] * e2[2] - p[2] * e2[1], p[2] * e2[0] - p[0] * e2[2], p[0] * e2[1] - p[1] * e2[0]];
      const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(det) < 1e-18) continue;
      const s = [-a[0], -a[1], -a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const vv = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / det;
      if (vv < 0 || u + vv > 1) continue;
      const tt = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
      if (tt > 0) { hit++; break; }
    }
  }
  return { hole_samples: n, hole_samples_covered: hit };
}

function runCase(cs) {
  const M = Mesher({ F: cs.F, steps: process.env.NOSW ? null : cs.F.steps, injective: !process.env.NOINJ && Funcs.composeProps(cs.F.steps.map((b) => b.props)).injective, shape: cs.shape, left: Object.assign({ W, H }, cs.left), view: cs.view, pattern: cs.pattern, cell: cs.cell, alpha: cs.alpha ?? 1, guard: cs.guard ?? 1 });
  const st = M.run(20000);
  const out = M.output();
  const r = { name: cs.name, ms: +st.ms.toFixed(1), ...M.summary(), out_tris: out.length, counts: st.counts, budgetHit: st.budgetHit };
  Object.assign(r, chordDev(M, cs));
  if (cs.view.kind === 'flat') Object.assign(r, measureFlat(M, cs, out));
  else if (cs.base === 'zi_H') Object.assign(r, sphereHole(M, out));
  return r;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let json = null;
  const ji = args.indexOf('--json');
  if (ji >= 0) { json = args[ji + 1]; args.splice(ji, 2); }
  const sel = CASES.filter((c) => !args.length || args.some((a) => c.name === a || c.name.startsWith(a)));
  runCase(CASES[0]);   // JIT warm-up
  const res = [];
  for (const cs of sel) {
    const r = runCase(cs);
    res.push(r);
    const L = r.leaves;
    console.log(`${r.name.padEnd(18)} ${String(r.ms).padStart(7)} ms  nodes ${String(r.nodes).padStart(7)}  evals ${String(r.evals).padStart(7)}  final ${String(L.final).padStart(6)} tris ${String(r.out_tris).padStart(6)}  culled ${L.culled} sat ${L.saturated} drop ${L.dropped} out ${L.outside}  dev max/p99.9 ${r.dev_max_px}/${r.dev_p999_px}px` +
      (r.iou != null ? `  IoU ${r.iou.toFixed(4)} hole ${r.hole_px} spill ${r.spill_px} minL ${r.min_layers}` : '') +
      (r.parity_scored != null ? ` parity ${r.parity_wrong}/${r.parity_scored}` : '') +
      (r.zi_hole_px != null ? ` ziHole ${r.zi_hole_covered}/${r.zi_hole_px}` : '') +
      (r.hole_samples != null ? ` sphHole ${r.hole_samples_covered}/${r.hole_samples}` : '') + (r.budgetHit ? ' BUDGET' : ''));
  }
  if (json) require('fs').writeFileSync(json, JSON.stringify(res, null, 1));
}
module.exports = { CASES, runCase };

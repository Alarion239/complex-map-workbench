// SPEC 12.3: the forward fallback (src/sphere.js, SphereMesh). A port of the lead's notes/proto/lead/run_cases_lead.js
// (itself a port of notes/proto/sphere-native/run_cases.js) onto the production module, plus the T-junction check of
// notes/proto/incremental/tjunc.js, determinism and the published layout (8.7).
//   node test/t_sphere.js [filter...] [--sphere] [--quick]     exit 1 on a failure
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const SphereMesh = require('../src/sphere.js');
const { C } = CX;
const PI = Math.PI, TAU = 2 * PI;
const W = 410, H = 516;                         // a plane at 1440x900 (the regress suite's size)
let fails = 0;
const ok = (name, cond, got) => { if (!cond) { fails++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } else console.log('ok  ', name, got === undefined ? '' : JSON.stringify(got)); };
const step = (type, params = {}) => { const b = Funcs.build({ type, params }); if (b.error) throw new Error(b.error); return b; };
const chain = (...bs) => { const f = (z) => { for (const b of bs) z = b.f(z); return z; }; f.steps = bs; return f; };
const abs = (w) => Math.hypot(w.re, w.im);
const PAT = { solid: 0, checker: 1, polar: 2 };

const Hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const LOGH_VIEW = { cx: -0.18, cy: PI / 2, s: 97 };
const BASE = {
  zi_H: { F: chain(step('powa', { alpha: 'i', cut: 180, k: 0 })), shape: Hp, left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 },
    truth: (w) => { const r = abs(w); return r > Math.exp(-PI) && r < 1; }, pattern: 'polar',
    parity: (w) => {
      const gx = Math.atan2(w.im, w.re) * 16 / TAU;
      let a = -Math.log(abs(w)); a -= TAU * Math.round(a / TAU); const gy = a * 16 / TAU;
      const r = abs(w), grad = 16 / TAU / r;
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
// the lead's recorded nodes / evals (notes/proto/lead/run_cases_lead.js, run 2026-10-21): 12.3 asks for 1.5x
const REC = {
  zi_H: [19544, 26987], zi_H_out4: [11132, 12128], zi_H_out16: [9396, 8757], logH: [13672, 17469], logH_out4: [14480, 18036], logH_out16: [20164, 25366],
  expH: [23216, 34132], expH_out4: [24924, 36205], expH_out16: [27224, 38879], e1z_disc: [37304, 53482], e1z_disc_out4: [36380, 51576], e1z_disc_out16: [43476, 63518],
  exp_strip: [16176, 23771], exp_strip_out4: [14360, 20599], exp_strip_out16: [13148, 18104], cayley_H: [8336, 8962], cayley_H_out4: [6492, 5941], cayley_H_out16: [6320, 5371],
  sq_Q1: [14448, 17872], sq_Q1_out4: [13324, 16015], sq_Q1_out16: [12980, 15330], sin_halfstrip: [13708, 20116], sin_halfstrip_out4: [12344, 17846], sin_halfstrip_out16: [11164, 15149],
  recip_ext: [4904, 6723], recip_ext_out4: [3576, 4525], recip_ext_out16: [3576, 4637], sqrt_slit: [100116, 560643], sqrt_slit_out4: [101532, 520956], sqrt_slit_out16: [102064, 475498],
  disc_cube: [10944, 14010], disc_cube_out4: [5428, 4474], disc_cube_out16: [4640, 3102], zi_H_solid_a085: [37876, 58531], zi_H_out16_a085: [10588, 11008],
  cayley_H_zoom1: [7648, 6773], recip_ext_zoom0: [4872, 6125],
  // the guard-band runs: src/sphere.js meshes and counts the band (a 3 px coverage grid; the prototype saturated it
  // away), so these are its own recorded values (2026-10-21)
  zi_H_guard3: [19544, 26987], logH_guard3: [28780, 43513], expH_guard3: [62812, 99744],
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
add('zi_H_guard3', 'zi_H', { guard: 3 });
add('logH_guard3', 'logH', { guard: 3 });
add('expH_guard3', 'expH', { guard: 3 });
const sph = (name, base, extra = {}) => CASES.push(Object.assign({ name, base }, BASE[base], extra, { view: { kind: 'sphere', R: 180 } }));
sph('zi_H_sphere', 'zi_H');
sph('logH_sphere', 'logH');
sph('cayley_H_sphere', 'cayley_H');
sph('expH_sphere', 'expH');

function build(cs, extra = {}) {
  const steps = cs.F.steps;
  return SphereMesh.create(Object.assign({
    steps, injective: Funcs.composeProps(steps.map((b) => b.props)).injective, shape: cs.shape,
    left: Object.assign({ W, H }, cs.left), view: cs.view, Kmax: SphereMesh.kOf(cs.alpha ?? 1),
    pattern: { id: PAT[cs.pattern] || 0, cell: cs.cell || 1 }, budgetMs: 1e9, maxNodes: 3e6,
  }, extra));
}
// the published triangles drawn as the GPU would (pixel centres, far to near), against the exact truth
function measureFlat(M, cs, pub) {
  const view = cs.view;
  const count = new Uint16Array(W * H);
  const pat = cs.pattern !== 'solid' && cs.parity;
  const topPar = pat ? new Int8Array(W * H).fill(-1) : null;
  const ox = pub.origin[0], oy = pub.origin[1];
  for (let t = 0; t < pub.n; t++) {
    const P = [0, 1, 2].map((j) => [(pub.pos[t * 6 + 2 * j] + ox - view.cx) * view.s + W / 2, (view.cy - (pub.pos[t * 6 + 2 * j + 1] + oy)) * view.s + H / 2]);
    const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    if (x0 > x1 || y0 > y1) continue;
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (!area) continue;
    const A = [0, 1, 2].map((j) => cs.pattern === 'polar' ? [pub.attr[t * 12 + 4 * j + 2], pub.attr[t * 12 + 4 * j + 3]] : [pub.attr[t * 12 + 4 * j], pub.attr[t * 12 + 4 * j + 1]]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const X = x + 0.5, Y = y + 0.5;
      const l1 = ((P[1][0] - X) * (P[2][1] - Y) - (P[2][0] - X) * (P[1][1] - Y)) / area;
      const l2 = ((P[2][0] - X) * (P[0][1] - Y) - (P[0][0] - X) * (P[2][1] - Y)) / area;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const k = y * W + x;
      count[k]++;
      if (pat) {
        const gx = l1 * A[0][0] + l2 * A[1][0] + l3 * A[2][0], gy = l1 * A[0][1] + l2 * A[1][1] + l3 * A[2][1];
        topPar[k] = ((Math.floor(gx) + Math.floor(gy)) % 2 + 2) % 2;
      }
    }
  }
  const wOf = (x, y) => C(view.cx + (x - W / 2) / view.s, view.cy - (y - H / 2) / view.s);
  let hole = 0, spill = 0, inter = 0, uni = 0, minLayers = Infinity, parN = 0, parBad = 0;
  const BAND = 2.5;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x + 0.5, Y = y + 0.5, t = cs.truth(wOf(X, Y));
    let band = false;
    for (const [dx, dy] of [[BAND, 0], [-BAND, 0], [0, BAND], [0, -BAND], [1.77, 1.77], [-1.77, 1.77], [1.77, -1.77], [-1.77, -1.77]]) if (cs.truth(wOf(X + dx, Y + dy)) !== t) { band = true; break; }
    if (band) continue;
    const k = y * W + x, c = count[k] > 0;
    if (t) { if (!c) hole++; minLayers = Math.min(minLayers, count[k]); } else if (c) spill++;
    if (t && c) inter++;
    if (t || c) uni++;
    if (pat && t && c) {
      const w = wOf(X, Y), q = cs.parity(w);
      const cpx = Math.min(1 / (q.gradx / view.s), 1 / (q.grady / view.s));
      if (cpx < 3) continue;
      const ex = Math.abs(q.gx - Math.round(q.gx)) / (q.gradx / view.s), ey = Math.abs(q.gy - Math.round(q.gy)) / (q.grady / view.s);
      if (Math.min(ex, ey) < 1.5) continue;
      parN++;
      if ((((Math.floor(q.gx) + Math.floor(q.gy)) % 2 + 2) % 2) !== topPar[k]) parBad++;
    }
  }
  const r = { iou: uni ? inter / uni : 1, hole, spill, minLayers };
  if (pat) { r.parN = parN; r.parBad = parBad; }
  if (cs.base === 'zi_H') {
    let hc = 0, hn = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const w = wOf(x + 0.5, y + 0.5); if (abs(w) < Math.exp(-PI) - 1 / view.s) { hn++; if (count[y * W + x]) hc++; } }
    r.ziHole = [hc, hn];
  }
  return r;
}
// chord deviation of every drawn unclipped leaf whose image meets the view (geodesic 1/4, 3/4 edge points, interior)
function chordDev(M, cs) {
  const V = M.V(), T = M.T(), view = cs.view, flat = view.kind === 'flat';
  const S = (w) => {
    if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return null;
    if (!Number.isFinite(w.re) || !Number.isFinite(w.im)) return flat ? null : [0, 0, view.R];
    if (flat) return [(w.re - view.cx) * view.s + W / 2, (view.cy - w.im) * view.s + H / 2, 0];
    const p = SphereMesh.lift(w.re, w.im, [0, 0, 0]); return [p[0] * view.R, p[1] * view.R, p[2] * view.R];
  };
  const SV = (i) => (V.WS[i] === SphereMesh.INF ? (flat ? null : [0, 0, view.R]) : S(C(V.WX[i], V.WY[i])));
  const nrm = (p) => { const n = Math.hypot(p[0], p[1], p[2]); return [p[0] / n, p[1] / n, p[2] / n]; };
  const P3 = (i) => [V.PX[i], V.PY[i], V.PZ[i]];
  const devs = [];
  for (let t = 0; t < T.nt; t++) {
    if (T.TCH[t] >= 0 || T.TST[t] !== SphereMesh.FINAL) continue;
    const v = [T.TA[t], T.TB[t], T.TC[t]];
    const Pv = v.map(SV);
    if (!Pv.every(Boolean)) continue;
    if (flat) {
      const xs = Pv.map((p) => p[0]), ys = Pv.map((p) => p[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) continue;
    }
    if (!v.every((i) => V.LV[i] > 0)) continue;
    let d = 0;
    const pts = [];
    for (let k = 0; k < 3; k++) {
      const a = P3(v[k]), b = P3(v[(k + 1) % 3]), m = nrm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
      pts.push([nrm([a[0] + m[0], a[1] + m[1], a[2] + m[2]]), k, (k + 1) % 3, 0.75]);
      pts.push([nrm([b[0] + m[0], b[1] + m[1], b[2] + m[2]]), k, (k + 1) % 3, 0.25]);
    }
    for (const [p, i, j, wi] of pts) {
      const q = S(M.Fz(M.zOf3(p[0], p[1], p[2])));
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
  return { devMax: +pct(1).toFixed(3), devP999: +pct(0.999).toFixed(3) };
}
// T-junctions over the drawn triangles (vertex ids of the NVB mesh, source points on the sphere): an open edge
// (a, b) whose other side is split at a point m strictly inside the arc a-b with (a, m) and (m, b) open as well
function tjunctions(M) {
  const V = M.V(), T = M.T();
  const E = new Map();
  const key = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  for (let t = 0; t < T.nt; t++) {
    if (T.TCH[t] >= 0 || T.TST[t] !== SphereMesh.FINAL) continue;
    for (const tri of M.leafTris(t)) for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      if (a === b) continue;
      const kk = key(a, b);
      E.set(kk, (E.get(kk) || 0) + 1);
    }
  }
  const open = [];
  const nb = new Map();
  for (const [k, n] of E) if (n === 1) {
    const a = Math.floor(k / 4194304), b = k % 4194304;
    open.push([a, b]);
    (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a);
  }
  const P = (i) => [V.PX[i], V.PY[i], V.PZ[i]];
  let tj = 0;
  for (const [a, b] of open) {
    const pa = P(a), pb = P(b);
    const cr = [pa[1] * pb[2] - pa[2] * pb[1], pa[2] * pb[0] - pa[0] * pb[2], pa[0] * pb[1] - pa[1] * pb[0]], cl = Math.hypot(...cr);
    if (!(cl > 0)) continue;
    const dab = pa[0] * pb[0] + pa[1] * pb[1] + pa[2] * pb[2];
    for (const m of nb.get(a) || []) {
      if (m === b || !(nb.get(m) || []).includes(b)) continue;
      const pm = P(m);
      const off = Math.abs(cr[0] * pm[0] + cr[1] * pm[1] + cr[2] * pm[2]) / cl;
      const dam = pa[0] * pm[0] + pa[1] * pm[1] + pa[2] * pm[2], dbm = pb[0] * pm[0] + pb[1] * pm[1] + pb[2] * pm[2];
      if (off < 1e-12 && dam > dab && dbm > dab) tj++;
    }
  }
  return { open: open.length, tj };
}
// the z^i hole on the globe: is the cap |w| < e^-pi left empty (rays from the centre through 400 cap points)?
function sphereHole(pub) {
  const tris = [];
  for (let t = 0; t < pub.n; t++) tris.push([0, 1, 2].map((j) => [pub.pos3[t * 9 + 3 * j], pub.pos3[t * 9 + 3 * j + 1], pub.pos3[t * 9 + 3 * j + 2]]));
  let n = 0, hit = 0;
  const r0 = Math.exp(-PI) * 0.97;
  for (let k = 0; k < 400; k++) {
    const rr = r0 * Math.sqrt((k + 0.5) / 400), th = k * 2.39996;
    const p = SphereMesh.liftConj(rr * Math.cos(th), rr * Math.sin(th), [0, 0, 0]);
    n++;
    for (const [a, b, c] of tris) {
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const h = [p[1] * e2[2] - p[2] * e2[1], p[2] * e2[0] - p[0] * e2[2], p[0] * e2[1] - p[1] * e2[0]];
      const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
      if (Math.abs(det) < 1e-18) continue;
      const s = [-a[0], -a[1], -a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
      if (u < 0 || u > 1) continue;
      const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
      const vv = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]) / det;
      if (vv < 0 || u + vv > 1) continue;
      if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 0) { hit++; break; }
    }
  }
  return [hit, n];
}

const args = process.argv.slice(2);
const doSphere = args.includes('--sphere');
const filt = args.filter((a) => !a.startsWith('--'));
const sel = CASES.filter((c) => (doSphere || c.view.kind === 'flat') && (!filt.length || filt.some((a) => c.name === a || c.name.startsWith(a))));
build(CASES[0]).step();   // JIT warm-up
// the CPU budget of 1.5 s per mesh is for an idle machine: a calibration run (zi_H_out16, 29.3 ms on the lead's idle M4)
// scales it when the machine is loaded (the suites share it with other jobs)
const LOAD = (() => { const cs = CASES.find((c) => c.name === 'zi_H_out16'); let best = Infinity; for (let i = 0; i < 3; i++) { const M = build(cs); M.step(); best = Math.min(best, M.stats().ms); } return Math.max(1, best / 29.3); })();
console.log('load factor', LOAD.toFixed(2));
let nFlat = 0, flatOk = 0;
for (const cs of sel) {
  const M = build(cs);
  // resumable: 5 ms slices, as the app runs it
  let r, slices = 0;
  do { r = M.step(5); slices++; } while (!r.done);
  const pub = M.publish();
  const st = M.stats();
  const cd = chordDev(M, cs);
  const tj = tjunctions(M);
  const rec = REC[cs.name];
  let line = `${cs.name.padEnd(20)} ${String(Math.round(st.ms)).padStart(5)} ms (${slices} slices) nodes ${String(st.nodes).padStart(7)} evals ${String(st.evals).padStart(7)} tris ${String(pub.n).padStart(6)} chord max/p99.9 ${cd.devMax}/${cd.devP999} open ${tj.open} T-junctions ${tj.tj}`;
  if (cs.view.kind === 'flat') {
    nFlat++;
    const m = measureFlat(M, cs, pub);
    line += `  IoU ${m.iou.toFixed(4)} hole ${m.hole} spill ${m.spill} minL ${m.minLayers}` + (m.parN != null ? ` parity ${m.parBad}/${m.parN}` : '') + (m.ziHole ? ` ziHole ${m.ziHole[0]}/${m.ziHole[1]}` : '');
    console.log(line);
    const good = m.iou >= 0.999 && m.hole === 0 && m.spill === 0;
    if (good) flatOk++;
    ok(`${cs.name}: IoU >= 0.999, 0 holes, 0 spill`, good, { iou: +m.iou.toFixed(5), hole: m.hole, spill: m.spill });
    if (m.parN) ok(`${cs.name}: parity >= 0.999`, m.parBad <= 0.001 * m.parN, [m.parBad, m.parN]);
    if (m.ziHole) ok(`${cs.name}: the z^i hole stays empty`, m.ziHole[0] === 0, m.ziHole);
  } else {
    console.log(line);
    if (cs.base === 'zi_H') { const h = sphereHole(pub); ok(`${cs.name}: hole cap samples covered 0`, h[0] === 0, h); }
  }
  ok(`${cs.name}: p99.9 chord <= 0.3 px`, cd.devP999 <= 0.3, cd);
  ok(`${cs.name}: 0 T-junctions`, tj.tj === 0, tj);
  if (rec) ok(`${cs.name}: nodes and evals within 1.5x of the recorded`, st.nodes <= 1.5 * rec[0] && st.evals <= 1.5 * rec[1], { nodes: st.nodes, evals: st.evals, rec });
  if (cs.view.kind === 'flat') ok(`${cs.name}: within the 1.5 s CPU budget of a mesh (x load ${LOAD.toFixed(2)})`, st.ms <= 1500 * LOAD, Math.round(st.ms));
}
if (sel.length > 3 && !filt.length) ok(`the ${nFlat} flat acceptance runs pass`, nFlat === 40 && flatOk === 40, [flatOk, nFlat]);

// determinism: the same input gives the same buffers (also when run in different slices)
{
  const cs = CASES.find((c) => c.name === 'zi_H_out4');
  const A = build(cs); A.step();
  const B = build(cs); let r; do { r = B.step(1); } while (!r.done);
  const a = A.publish(), b = B.publish();
  const same = (x, y) => x && y && x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
  ok('determinism: identical pos, attr and tri for the same input (one run vs 1 ms slices)', a.n === b.n && same(a.pos, b.pos) && same(a.attr, b.attr) && same(a.tri, b.tri), { n: [a.n, b.n] });
}
// layout (8.7): sizes, finite values, far-to-near order, guard box
{
  const cs = CASES.find((c) => c.name === 'expH');
  const M = build(cs, { view: Object.assign({}, cs.view, { guard: 3 }) }); M.step();
  const p = M.publish();
  ok('layout: pos 6, attr 12, tri 1 floats per triangle', p.pos.length === 6 * p.n && p.attr.length === 12 * p.n && p.tri.length === p.n && p.order === 'far-to-near');
  ok('layout: every value finite', [...p.pos, ...p.attr, ...p.tri].every(Number.isFinite));
  const gb = p.guardBox, s = cs.view.s;
  ok('layout: the guard box is the view enlarged 3x', Math.abs((gb.x1 - gb.x0) - 3 * W / s) < 1e-9 && Math.abs((gb.y1 - gb.y0) - 3 * H / s) < 1e-9, gb);
  // budgets: a node budget ends the refinement with a partial mesh (pending leaves within 2 px drawn)
  const Q = build(CASES.find((c) => c.name === 'e1z_disc'), { maxNodes: 8000 }); let r; do { r = Q.step(5); } while (!r.done);
  const qs = Q.stats();
  ok('budget: 8k nodes ends the job partial, with triangles', r.partial && qs.budgetWhy === 'nodes' && Q.publish().n > 0, { nodes: qs.nodes, n: Q.publish().n });
  Q.dispose();
  ok('dispose keeps the published data', Q.publish().n > 0 && Q.bytes() > 0);
}
// the app's real budget (SphereMesh.APP: deterministic evaluations and nodes, guard 2) on the P5 scenes at the
// default alpha 0.85 (K 3), checker: what the screen draws, partial or not (the runs above are unbudgeted)
if (!filt.length || filt.includes('app')) {
  const AB = SphereMesh.APP, K3 = SphereMesh.kOf(0.85), nz = (w) => !(w.re === 0 && w.im === 0);
  const APPC = [
    ['app_expH', chain(step('exp')), Hp, { cx: 0, cy: 0, s: 30 }, false],
    ['app_e1z', chain(step('recip'), step('exp')), { kind: 'disc', c: [0, 0], r: 1 }, { cx: 0, cy: 0, s: 60 }, false],
    ['app_custom_e_z1z', chain(step('custom', { expr: 'e^{z+\\frac{1}{z}}', cut: 180 })), Hp, { cx: 0, cy: 0, s: 40 }, false],
    ['app_expexp_H', chain(step('exp'), step('exp')), Hp, { cx: 0, cy: 0, s: 40 }, true],
  ];
  for (const [name, F, shape, view, mayPartial] of APPC) {
    const cs = { name, F, shape, left: { cx: 0, cy: 1, s: 60 }, view: Object.assign({ kind: 'flat', W, H, guard: AB.guard }, view), truth: nz, pattern: 'checker', cell: 1, alpha: 0.85 };
    const M = build(cs, { maxWork: AB.workOf(K3), maxNodes: AB.maxNodes, Kmax: K3 });
    let r; do { r = M.step(5); } while (!r.done);
    const pub = M.publish(), st = M.stats(), m = measureFlat(M, cs, pub);
    const M2 = build(cs, { maxWork: AB.workOf(K3), maxNodes: AB.maxNodes, Kmax: K3 }); M2.step(1e9);
    const same = M2.publish().n === pub.n && M2.stats().nodes === st.nodes;
    console.log(`${name.padEnd(20)} ${String(Math.round(st.ms)).padStart(5)} ms nodes ${st.nodes} work ${st.work} tris ${pub.n} partial ${r.partial} (${st.budgetWhy || '-'})  IoU ${m.iou.toFixed(4)} hole ${m.hole} spill ${m.spill} minL ${m.minLayers}`);
    ok(`${name} (app budget): IoU >= 0.999, 0 holes, 0 spill`, m.iou >= 0.999 && m.hole === 0 && m.spill === 0, { iou: +m.iou.toFixed(5), hole: m.hole, spill: m.spill, partial: r.partial, why: st.budgetWhy });
    if (!mayPartial) ok(`${name} (app budget): the mesh finishes within the budget`, !r.partial, { work: st.work, nodes: st.nodes, why: st.budgetWhy });
    ok(`${name} (app budget): deterministic (sliced = unsliced, independent of time)`, same, [pub.n, st.nodes]);
    ok(`${name} (app budget): >= K layers at every interior sample`, m.minLayers >= K3, m.minLayers);
  }
}
// stage-wise limits (8.4): catalog limits at infinity, and the probe of a custom formula
{
  const lim = (type, params) => SphereMesh.atInfOf(step(type, params)).k;
  ok('limits at infinity: recip FIN, exp UNDEF, powa(i) UNDEF, pown 2 INF, log INF', lim('recip') === 0 && lim('exp') === 2 && lim('powa', { alpha: 'i', cut: 180, k: 0 }) === 2 && lim('pown', { n: 2 }) === 1 && lim('log', { cut: 180, k: 0 }) === 1);
  const cust = SphereMesh.atInfOf(step('custom', { expr: '\\frac{z^2+1}{2z^2-3}' }));
  ok('a custom rational probes to its limit 1/2 at infinity', cust.k === 0 && Math.abs(cust.w.re - 0.5) < 1e-6 && Math.abs(cust.w.im) < 1e-6, cust);
}
// a region whose formula iterates (#6: the Mandelbrot set's escape test) counts its level evaluations in the work
// budget, so its mesh ends there and not on the time cap; other regions' work is their map evaluations only
{
  const run = (expr) => {
    const M = SphereMesh.create({
      steps: [step('recurrence', { u0: '0', g: 'u^2+z', N: 12, cut: 180 })], injective: false, shape: { kind: 'formula', expr },
      left: { W, H, cx: -0.6, cy: 0, s: 150 }, view: { kind: 'flat', cx: 0, cy: 0, s: 100, W, H, guard: 2 }, Kmax: 1,
      pattern: { id: 0, cell: 1 }, budgetMs: 1e9, maxNodes: 3e6, maxWork: 250000,
    });
    while (!M.step(1e9).done);
    const st = M.stats();
    M.dispose();
    return st;
  };
  const it = run('|\\operatorname{iter}(u^2+z, u, 0, 64)|\\le 2');
  ok('an iterating region: its levels count in the work, and the mesh ends on the work budget', it.budgetWhy === 'work' && it.work >= 8 * it.levels, { work: it.work, levels: it.levels, why: it.budgetWhy });
  const plain = run('|z+0.5|<1');
  ok('a plain formula region: the work is its map evaluations only', plain.work === plain.evals + 12 * plain.stepProbes && plain.levels > 0, { work: plain.work, evals: plain.evals, levels: plain.levels });
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);

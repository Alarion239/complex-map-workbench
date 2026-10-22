'use strict';
// CPU reference of the per-pixel inverse renderer (SPEC sections 4-6) on the app's own catalog steps and Region
// levels, scored with the regression suite's own metrics (test/regress/quality/metrics.js) against the suite's exact
// truth, plus the new scenes (z^i of H, exp of H, e^{1/z} on the unit disc).
//   node notes/proto/lead-inv/render.js [filter...] [--png]
const path = require('path');
const fs = require('fs');
const INV = require('./inverse_proto.js');
const ROOT = path.resolve(__dirname, '../../..');
const Region = require(path.join(ROOT, 'src/region.js'));
const Q = require(path.join(ROOT, 'test/regress/quality/scenes.js'));
const MET = require(path.join(ROOT, 'test/regress/quality/metrics.js'));
const PNG = require(path.join(ROOT, 'test/regress/quality/pngio.js'));
const { C } = CX;
const PI = Math.PI, TAU = 2 * PI;
const W = 410, H = 516;
const args = process.argv.slice(2);
const filt = args.filter((a) => !a.startsWith('--'));
const WANT_PNG = args.includes('--png');
const OUT = path.join(__dirname, 'out');
if (WANT_PNG) fs.mkdirSync(OUT, { recursive: true });

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const COL = { plane: hex('#FCFDFD'), c0: hex('#3B6FD4'), c1: hex('#8CABE5') };
const ALPHA_STOP = 1 / 255, B_MAX = 8;

// ---------- pattern colours (REGION_FS with analytic footprints) ----------
const fract = (x) => x - Math.floor(x);
function checker(p, w) {
  const wx = Math.max(w[0], 1e-7), wy = Math.max(w[1], 1e-7);
  const ix = 2 * (Math.abs(fract((p[0] - 0.5 * wx) * 0.5) - 0.5) - Math.abs(fract((p[0] + 0.5 * wx) * 0.5) - 0.5)) / wx;
  const iy = 2 * (Math.abs(fract((p[1] - 0.5 * wy) * 0.5) - 0.5) - Math.abs(fract((p[1] + 0.5 * wy) * 0.5) - 0.5)) / wy;
  return 0.5 - 0.5 * ix * iy;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const moire = (w) => smooth(0.18, 0.45, Math.max(w[0], w[1]));
const mixc = (a, b, t) => [0, 1, 2].map((q) => a[q] + (b[q] - a[q]) * t);
// z, footprint vectors dzdX, dzdY (z units per image pixel), lam = log z when known
function patternColor(pat, z, dX, dY, lam, cell) {
  const c0 = COL.c0, c1 = COL.c1, avg = mixc(c0, c1, 0.5);
  if (pat === 'checker') {
    const g = [z.re / cell, z.im / cell], gw = [(Math.abs(dX.re) + Math.abs(dY.re)) / cell, (Math.abs(dX.im) + Math.abs(dY.im)) / cell];
    return { col: mixc(mixc(c0, c1, checker(g, gw)), avg, moire(gw)), par: (((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2, mo: moire(gw) };
  }
  if (pat === 'polar' || pat === 'sphere') {
    const lr = lam ? lam.re : Math.log(Math.hypot(z.re, z.im)), th = lam ? lam.im : Math.atan2(z.im, z.re);
    // d(log z) = dz / z; with lam: |z| = e^{lr}
    const r = Math.exp(lr), ux = Math.cos(th), uy = Math.sin(th);
    const q = (d) => [(d.re * ux + d.im * uy) / r, (d.im * ux - d.re * uy) / r];   // dz/z
    const qx = q(dX), qy = q(dY);
    if (pat === 'polar') {
      const g = [lr * 16 / TAU, th * 16 / TAU], gw = [(Math.abs(qx[0]) + Math.abs(qy[0])) * 16 / TAU, (Math.abs(qx[1]) + Math.abs(qy[1])) * 16 / TAU];
      return { col: mixc(mixc(c0, c1, checker(g, gw)), avg, moire(gw)), par: (((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2, mo: moire(gw) };
    }
    // spherical checker: 16 longitude sectors, 8 latitude bands of the Riemann sphere (equator |z| = 1)
    const lat = 2 * Math.atan(r), dl = 2 / (r + 1 / r);   // d lat / d ln r = 2 r / (1 + r^2)
    const g = [th * 16 / TAU, lat * 8 / PI], gw = [(Math.abs(qx[1]) + Math.abs(qy[1])) * 16 / TAU, (Math.abs(qx[0]) + Math.abs(qy[0])) * dl * 8 / PI];
    return { col: mixc(mixc(c0, c1, checker(g, gw)), avg, moire(gw)), par: (((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2, mo: moire(gw) };
  }
  return { col: c0, par: 0, mo: 0 };
}

// ---------- the sheet key D (SPEC 5) ----------
function keyFn(win, sing) {
  const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8;
  return (z) => {
    const dx = Math.max(win.x0 - z.re, 0, z.re - win.x1), dy = Math.max(win.y0 - z.im, 0, z.im - win.y1);
    let D = Math.log2(1 + Math.hypot(dx, dy) / R);
    for (const p of sing) D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im)));
    return D;
  };
}
// tie key (SPEC 5.2): larger Im z, then larger Re z, in front -- today's mesh draws rows bottom-up, later on top.
// TIE=grid: the exact row-major cell order of Region.buildMesh's grid; TIE=rev: reversed (sensitivity check)
function tieFn(shape, win) {
  const bb = Region.bboxOf(shape);
  const ww = win.x1 - win.x0, wh = win.y1 - win.y0;
  if (process.env.TIE !== "grid" || !bb || (bb.x1 - bb.x0) > 3 * ww || (bb.y1 - bb.y0) > 3 * wh) return (z) => z.im * 1e6 + z.re;   // unbounded: (y, x)
  if (process.env.TIE === "rev") return (z) => -z.im;
  const pad = 1e-3 * Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0, 1e-9);
  const x0 = bb.x0 - pad, x1 = bb.x1 + pad, y0 = bb.y0 - pad, y1 = bb.y1 + pad;
  const h = Math.max(x1 - x0, y1 - y0) / 60;
  const nx = Math.max(4, Math.ceil((x1 - x0) / h)), ny = Math.max(4, Math.ceil((y1 - y0) / h));
  const hx = (x1 - x0) / nx, hy = (y1 - y0) / ny;
  return (z) => {
    const i = Math.floor((z.re - x0) / hx), j = Math.floor((z.im - y0) / hy);
    const fx = (z.re - x0) / hx - i, fy = (z.im - y0) / hy - j;
    return (j * nx + i) * 2 + (fy > fx ? 1 : 0);   // within a cell: triangle (a, b, c) then (a, c, d)
  };
}

// ---------- one render ----------
function render(sc, view, pattern, opts = {}) {
  const steps = sc.steps.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: true }));
  const built = steps.map((s) => Funcs.build(s));
  const plan = INV.planChain(steps, built);
  if (!plan.ok) throw new Error(plan.reason);
  const shape = sc.shapes[0];
  const L = Region.levelOf(shape);
  const win = Q.boxOf(sc.srcView);
  // reference point: the left window centre, nudged when a stage is not finite there
  let c0 = C(sc.srcView.cx, sc.srcView.cy);
  let refs = INV.makeRefs(plan, c0);
  const allFin = (rs) => rs.every(CX.isFin) && CX.isFin(plan.ops.reduce((z, o) => o.fwd(z), c0));
  if (!allFin(refs)) { const Rw = (win.x1 - win.x0) / 4; c0 = C(c0.re + Rw * Math.cos(0.3), c0.im + Rw * Math.sin(0.3)); refs = INV.makeRefs(plan, c0); }
  const key = keyFn(win, sc.sing || []);
  const tie = tieFn(shape, win);
  const cell = Q.cellOf(sc);
  const pxw = 1 / view.s;
  const alpha = opts.alpha ?? 1;
  const rgba = Buffer.alloc(W * H * 4);
  const cov = new Float32Array(W * H), topPar = new Int8Array(W * H).fill(-1), nCov = new Uint8Array(W * H);
  const disagree = new Uint8Array(W * H);
  let scanned = 0, covering = 0, compMax = 0, peak = 0;
  const t0 = process.hrtime.bigint();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const w = C(view.cx + (i + 0.5 - W / 2) / view.s, view.cy - (j + 0.5 - H / 2) / view.s);
    const leaves = INV.enumerate(plan, w, refs, pxw, { ext: opts.ext ? opts.ext(plan, shape) : null });
    scanned += leaves.length; peak = Math.max(peak, leaves.peak);
    const cv = [];
    for (const lf of leaves) {
      const z = lf.z;
      if (!CX.isFin(z)) continue;
      const J = lf.J;
      const dX = C(J[0] * pxw, J[2] * pxw), dY = C(J[1] * pxw, J[3] * pxw);
      const l0 = L(z);
      const lx = (L(CX.add(z, dX)) - L(CX.sub(z, dX))) / 2, ly = (L(CX.add(z, dY)) - L(CX.sub(z, dY))) / 2;
      const gl = Math.hypot(lx, ly);
      let sreg = gl > 0 ? l0 / gl : (l0 > 0 ? Infinity : -Infinity);
      if (Number.isNaN(sreg)) sreg = -Infinity;
      let c;
      if (lf.lg && Number.isFinite(lf.lvl) && gl > 0 && (lx * lf.lg[0] + ly * lf.lg[1]) / gl < -0.5) c = Math.min(sreg, 0.5) + Math.min(lf.lvl, 0.5);
      else c = Math.min(sreg, lf.lvl) + 0.5;
      c = Math.min(1, Math.max(0, c));
      if (c <= 0) continue;
      cv.push({ c, D: key(z), T: tie(z), z, dX, dY, lam: lf.lam });
    }
    covering += cv.length;
    // front to back: smallest D first; ties: the later-drawn (larger tie key) first
    cv.sort((a, b) => (a.D !== b.D ? a.D - b.D : b.T - a.T));
    let U = 0;
    for (const e of cv) U = Math.max(U, e.c);
    let T = 1, col = [0, 0, 0], n = 0, par0 = -1;
    for (const e of cv) {
      if (n >= B_MAX || T < ALPHA_STOP) break;
      const pc = patternColor(pattern, e.z, e.dX, e.dY, e.lam, cell);
      if (n === 0) par0 = pc.mo === 0 ? pc.par : -1;
      else if (pc.mo === 0 && e.c === 1 && par0 >= 0 && pc.par !== par0 && T > 0.5) disagree[j * W + i] = 1;
      const a = alpha * e.c / U;
      for (let q = 0; q < 3; q++) col[q] += T * a * pc.col[q];
      T *= 1 - a; n++;
    }
    compMax = Math.max(compMax, n);
    const k = j * W + i, aS = U * (1 - T);
    cov[k] = aS; topPar[k] = par0; nCov[k] = Math.min(255, cv.length);
    for (let q = 0; q < 3; q++) rgba[4 * k + q] = Math.round(255 * (U * col[q] + (1 - aS) * COL.plane[q]));
    rgba[4 * k + 3] = 255;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { rgba, cov, topPar, nCov, ms, scanned: scanned / (W * H), covering: covering / (W * H), compMax, peak, disagree, plan };
}

// ---------- scenes ----------
const H_ = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const cabs = (w) => Math.hypot(w.re, w.im);
const NEW = [
  { name: 'zi_H', shapes: [H_], steps: [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 190 }, sing: [C(0, 0)],
    truth: { pre: (w) => { const out = []; const Lw = CX.log(w); if (!(-Lw.re > -PI && -Lw.re <= PI)) return out; for (let m = -3; m <= 3; m++) out.push(CX.exp(C(Lw.im + TAU * m, -Lw.re))); return out; }, region: (z) => z.im > 0, dF: (z) => 1, sdf: (w) => Math.min(cabs(w) - Math.exp(-PI), 1 - cabs(w)) } },
  { name: 'expH', shapes: [H_], steps: [{ type: 'exp', params: {} }], srcView: { cx: 0, cy: 1, s: 60 }, rightView: { cx: 0, cy: 0, s: 60 }, sing: [],
    truth: { pre: (w) => { const L = CX.log(w); return [L, CX.add(L, C(0, TAU))]; }, region: (z) => z.im > 0, dF: (z) => Math.exp(z.re), sdf: (w) => cabs(w) } },
  { name: 'e1z_disc', shapes: [{ kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'recip', params: {} }, { type: 'exp', params: {} }], srcView: { cx: 0, cy: 0, s: 120 }, rightView: { cx: 0, cy: 0, s: 60 }, sing: [C(0, 0)],
    truth: { pre: (w) => { const L = CX.log(w); const out = []; for (let m = -3; m <= 3; m++) out.push(CX.inv(CX.add(L, C(0, TAU * m)))); return out; }, region: (z) => cabs(z) < 1, dF: (z) => 1, sdf: (w) => cabs(w) } },
];
const runs = [];
for (const sc of Q.SCENES) runs.push(Object.assign({}, sc, { view: sc.rightView }));
for (const sc of NEW) for (const [suf, f] of [['', 1], ['_out4', 4], ['_out16', 16]]) runs.push(Object.assign({}, sc, { name: sc.name + suf, base: sc.name, view: Object.assign({}, sc.rightView, { s: sc.rightView.s / f }) }));

function main() {
const lines = [];
const out = {};
for (const sc of runs) {
  if (filt.length && !filt.some((f) => sc.name.startsWith(f))) continue;
  for (const variant of ['mask', 'pattern']) {
    const pattern = variant === 'mask' ? 'solid' : (sc.base === 'zi_H' ? 'polar' : 'checker');
    const r = render(sc, sc.view, pattern);
    const map = { at: (i, j) => C(sc.view.cx + (i + 0.5 - W / 2) / sc.view.s, sc.view.cy - (j + 0.5 - H / 2) / sc.view.s), spx: sc.view.s };
    const TG = MET.truthGrid(sc.truth, Q.cellOf(sc), map, W, H);
    const cls = MET.makeClassifier({}, variant);
    const ev = MET.evaluate({ rgba: r.rgba, W, H, truthG: TG, classify: cls, variant });
    const m = ev.metrics;
    // the z^i hole: pixels with |w| < e^-pi - 1 px that got any coverage
    let holeLeak = '';
    if (sc.base === 'zi_H') {
      let n = 0, nn = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const w = map.at(i, j); if (cabs(w) < Math.exp(-PI) - 1 / sc.view.s) { nn++; if (r.cov[j * W + i] > 1 / 255) n++; } }
      holeLeak = ` hole ${n}/${nn}`;
      if (variant === 'pattern') {
        // polar parity of every sheet: ln|z_m| = arg w + 2 pi m, arg z_m = -ln|w|: parity is m-independent
        let ok = 0, tot = 0, dis = 0;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const k = j * W + i; if (r.topPar[k] < 0 || TG.sdf[k] <= 2.5) continue;
          const w = map.at(i, j), g = [Math.atan2(w.im, w.re) * 16 / TAU, -Math.log(cabs(w)) * 16 / TAU];
          const rr = cabs(w), da = Math.abs(g[0] - Math.round(g[0])) * TAU / 16 * rr * sc.view.s, dl = Math.abs(g[1] - Math.round(g[1])) * TAU / 16 * rr * sc.view.s;
          if (Math.min(da, dl) < 1.5) continue;
          tot++; if (r.topPar[k] === ((((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2)) ok++;
          if (r.disagree[k]) dis++;
        }
        holeLeak += ` polar-parity ${ok}/${tot} sheets-disagree ${dis}`;
      }
    }
    const line = `${(sc.name + '.' + variant).padEnd(28)} iou ${m.iou.toFixed(5)} hole ${m.n_hole} spill ${m.n_spill}${variant === 'pattern' && m.parity_n ? ` parity ${m.parity_acc.toFixed(5)} (n ${m.parity_n})` : ''} | cand/px ${r.scanned.toFixed(1)} cover/px ${r.covering.toFixed(2)} comp max ${r.compMax} peak ${r.peak} | ${r.ms.toFixed(0)} ms${holeLeak}`;
    console.log(line);
    lines.push(line);
    out[sc.name + '.' + variant] = { metrics: m, cand: r.scanned, cover: r.covering, ms: r.ms };
    if (WANT_PNG) fs.writeFileSync(path.join(OUT, `${sc.name}.${variant}.png`), PNG.encode(W, H, r.rgba));
  }
}
fs.writeFileSync(path.join(__dirname, 'render_results.json'), JSON.stringify(out, null, 1));
}
if (require.main === module) main();
module.exports = { render, patternColor, keyFn, tieFn, COL, W, H, NEW };

'use strict';
// Inverse-first renderer, prototype of the per-pixel GPU path (design sections 3-6), in JS.
// For every pixel w of the image view: enumerate preimages through the chain backwards (every branch of every step,
// respecting each forward step's principal branch / cut / sheet via a signed "range level"; infinite families as a
// window of 2M+1 members centred on the member nearest the source view), test the region at each candidate z with
// an analytic pixel-space signed distance (no dFdx: no seams where a family's labelling jumps), sort covering
// candidates by the sheet key D(z), composite front-to-back with saturation (stop when transmittance < 1/255).
// Arithmetic: A64 (float64) or A32 (float32 emulated: every operation rounded), to measure GPU precision.
const K = require('./common.js');
const { PI, TAU, REG, CASES, viewOf, pix, keyFn, W, H, C } = K;

const M_WIN = 8;     // family window: m* - 8 .. m* + 8
const B_MAX = 8;     // at most this many covering candidates composited
const ALPHA = 0.85;  // the app's default fill alpha
const T_STOP = 1 / 255;

// ---------- inverse steps: pre(w, ref) -> [{u, dudw, lvl (signed, step-output units, +inside range), lam (log u)}] ----------
function invStep(s, A, bb) {
  // bb: the region's z bbox when this step's input plane is z (first step), for pruning periodic families
  const clampWin = (m0, m1, lo, hi) => [Math.max(m0, lo), Math.min(m1, hi)];
  const { C: c, add, sub, mul, div, abs, arg, exp, log, ipow, asin, cos, scale } = A;
  const one = c(1, 0);
  switch (s.type) {
    case 'mobius': {
      const [a, b, cc, d] = s.m.map((x) => c(x.re, x.im));
      const det = sub(mul(a, d), mul(b, cc));
      return (w) => {
        const den = add(mul(scale(cc, -1), w), a);
        return [{ u: div(sub(mul(d, w), b), den), dudw: div(det, mul(den, den)), lvl: Infinity, n: 1 }];
      };
    }
    case 'recip': return (w) => { const u = div(one, w); return [{ u, dudw: scale(mul(u, u), -1), lvl: Infinity, n: 1 }]; };
    case 'pown': return (w) => {
      const out = [], r = A.R(Math.pow(abs(w), 1 / s.n)), t = arg(w);
      for (let j = 0; j < s.n; j++) { const an = A.R((t + TAU * j) / s.n); const u = c(r * Math.cos(an), r * Math.sin(an)); out.push({ u, dudw: div(u, scale(w, s.n)), lvl: Infinity, n: 1 }); }
      return out;
    };
    case 'root': {
      const t1 = (s.cut - TAU + TAU * s.k) / s.n, t2 = (s.cut + TAU * s.k) / s.n;
      const e1 = [Math.cos(t1), Math.sin(t1)], e2 = [Math.cos(t2), Math.sin(t2)];
      return (w) => {
        const a = e1[0] * w.im - e1[1] * w.re, b = -(e2[0] * w.im - e2[1] * w.re);
        return [{ u: ipow(w, s.n), dudw: scale(ipow(w, s.n - 1), s.n), lvl: Math.min(a, b), lg: a < b ? [-e1[1], e1[0]] : [e2[1], -e2[0]], n: 1 }];
      };
    }
    case 'log': {
      const lo = s.cut - TAU + TAU * s.k, hi = s.cut + TAU * s.k;
      return (w) => { const u = exp(w); const a = w.im - lo, b = hi - w.im; return [{ u, dudw: u, lvl: Math.min(a, b), lg: a < b ? [0, 1] : [0, -1], lam: w, n: 1 }]; };
    }
    case 'exp': return (w, ref) => {
      const L = log(w), out = [];
      const ms = Math.round((ref.im - L.im) / TAU);
      const dudw = div(one, w);
      let [m0, m1] = [ms - M_WIN, ms + M_WIN];
      if (bb) { const g = PI / 8; [m0, m1] = clampWin(m0, m1, Math.ceil((bb.y0 - g - L.im) / TAU), Math.floor((bb.y1 + g - L.im) / TAU)); if (bb.y0 > -Infinity && m1 < m0 + 2 * M_WIN && Math.ceil((bb.y0 - g - L.im) / TAU) > ms - M_WIN) m1 = Math.min(Math.floor((bb.y1 + g - L.im) / TAU), m0 + 2 * M_WIN); }
      for (let m = m0; m <= m1; m++) out.push({ u: c(L.re, L.im + TAU * m), dudw, lvl: Infinity, fam: m, n: 0 });
      return out;
    };
    case 'sin': return (w, ref) => {
      const a = asin(w), out = [];
      for (const base of [a, sub(c(PI, 0), a)]) {
        const ns = Math.round((ref.re - base.re) / TAU);
        let [n0, n1] = [ns - M_WIN, ns + M_WIN];
        if (bb) { const g = PI / 8; [n0, n1] = clampWin(n0, n1, Math.ceil((bb.x0 - g - base.re) / TAU), Math.floor((bb.x1 + g - base.re) / TAU)); }
        for (let n = n0; n <= n1; n++) { const u = c(base.re + TAU * n, base.im); out.push({ u, dudw: div(one, cos(u)), lvl: Infinity, n: 0 }); }
      }
      return out;
    };
    case 'powa': {
      // w = exp(alpha L), L = log u with Im L in (lo, hi]: L_m = beta (Log w + 2 pi i m), beta = 1/alpha
      const al = s.alpha, beta = CX.div(CX.ONE, al);
      const lo = s.cut - TAU + TAU * s.k, hi = s.cut + TAU * s.k, aAbs = CX.abs(al);
      const bt = c(beta.re, beta.im);
      return (w, ref) => {
        const Lw = log(w), bL = mul(bt, Lw), out = [];
        let m0, m1;
        if (Math.abs(beta.re) > 1e-12) {
          // finitely many sheets: Im L_m = Im(bL) + 2 pi m Re beta inside the window (one more each side for the AA ramp)
          const xa = (lo - bL.im) / (TAU * beta.re), xb = (hi - bL.im) / (TAU * beta.re);
          m0 = Math.floor(Math.min(xa, xb)) - 1; m1 = Math.ceil(Math.max(xa, xb)) + 1;
          if (m1 - m0 > 2 * M_WIN) { const mid = Math.round((m0 + m1) / 2); m0 = mid - M_WIN; m1 = mid + M_WIN; }
        } else {
          // Re beta = 0 (alpha imaginary): Im L does not depend on m; every m is a sheet (or none): a window around
          // the member whose |u| = e^{Re L_m} is nearest |ref|
          const ms = Math.round((bL.re - Math.log(Math.max(1e-300, Math.hypot(ref.re, ref.im)))) / (TAU * beta.im));
          m0 = ms - M_WIN; m1 = ms + M_WIN;
        }
        for (let m = m0; m <= m1; m++) {
          const L = c(bL.re - TAU * m * beta.im, bL.im + TAU * m * beta.re);
          const lv = Math.min(L.im - lo, hi - L.im) * aAbs * abs(w);
          if (lv < -4 * aAbs * abs(w)) continue;   // far outside the branch window: not a preimage
          const u = exp(L);
          // gradient of Im L in w: conj(beta / w) i, sign by the active bound
          const q = CX.mul(CX.conj(CX.div(beta, { re: w.re, im: w.im })), { re: 0, im: (L.im - lo < hi - L.im) ? 1 : -1 }), ql = Math.hypot(q.re, q.im) || 1;
          out.push({ u, dudw: mul(bt, div(u, w)), lvl: lv, lg: [q.re / ql, q.im / ql], lam: L, fam: m, n: Math.abs(beta.re) > 1e-12 ? 1 : 0 });
        }
        return out;
      };
    }
  }
  throw new Error(s.type);
}

// backward enumeration: leaves {z, lam, J = dz/dw (complex), lvl (px), inf (some step has an infinite family)}
function makeEnumerator(cs, A) {
  const pres = cs.steps.map((s, i) => invStep(s, A, i === 0 && !process.env.NOPRUNE ? REG[cs.region].bbox : null));
  const fs = cs.steps.map(K.fwdStep);
  // reference points (stage images of the source view centre, nudged off a singular point)
  let c0 = C(cs.src.cx, cs.src.cy);
  const fin = (w) => Number.isFinite(w.re) && Number.isFinite(w.im);
  const stageRefs = (z) => { const r = [z]; for (const f of fs) { z = f(z); r.push(z); } return r; };
  let refs = stageRefs(c0);
  if (!refs.every(fin)) { const b = K.boxOf(cs.src); c0 = C(c0.re + 0.25 * (b.x1 - b.x0) * Math.cos(0.3), c0.im + 0.25 * (b.x1 - b.x0) * Math.sin(0.3)); refs = stageRefs(c0); }
  return (w, pxw) => {
    let cands = [{ u: w, lam: null, J: A.C(1, 0), lvl: Infinity, lgw: null, inf: false }];
    for (let k = pres.length; k >= 1; k--) {
      const next = [];
      for (const cd of cands) {
        const Jm = Math.hypot(cd.J.re, cd.J.im);
        for (const p of pres[k - 1](cd.u, refs[k - 1])) {
          const lv = p.lvl === Infinity ? Infinity : p.lvl / (Jm * pxw);
          let lgw = cd.lgw;
          if (lv < cd.lvl && p.lg) { const g = [cd.J.re * p.lg[0] + cd.J.im * p.lg[1], cd.J.re * p.lg[1] - cd.J.im * p.lg[0]], gl = Math.hypot(g[0], g[1]) || 1; lgw = [g[0] / gl, g[1] / gl]; }
          next.push({ u: p.u, lam: k === 1 ? p.lam || null : null, J: A.mul(cd.J, p.dudw), lvl: Math.min(cd.lvl, lv), lgw, inf: cd.inf || p.n === 0 });
        }
      }
      cands = next;
    }
    return cands.map((cd) => ({ z: cd.u, lam: cd.lam, J: cd.J, lvl: cd.lvl, lgw: cd.lgw, inf: cd.inf }));
  };
}

// the shader's anti-aliased checker (UTIL.checker) and moire fade
const fract = (x) => x - Math.floor(x);
function checkerAA(p, w) {
  const wx = Math.max(w[0], 1e-7), wy = Math.max(w[1], 1e-7);
  const ix = 2 * (Math.abs(fract((p[0] - 0.5 * wx) * 0.5) - 0.5) - Math.abs(fract((p[0] + 0.5 * wx) * 0.5) - 0.5)) / wx;
  const iy = 2 * (Math.abs(fract((p[1] - 0.5 * wy) * 0.5) - 0.5) - Math.abs(fract((p[1] + 0.5 * wy) * 0.5) - 0.5)) / wy;
  return 0.5 - 0.5 * ix * iy;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// render one case/view; returns metrics and RGBA images (solid, pattern)
function render(cs, view, A, opts = {}) {
  const region = REG[cs.region];
  const enumr = makeEnumerator(cs, A);
  const key = keyFn(cs);
  const pxw = 1 / view.s;
  const pattern = opts.pattern || 'polar';
  const cell = opts.cell || 1;
  const c0 = [0.23, 0.44, 0.83], c1 = [0.86, 0.90, 0.97];
  const solid = new Uint8Array(W * H * 4), pat = new Uint8Array(W * H * 4);
  const covOpaque = new Float32Array(W * H), alpha85 = new Float32Array(W * H);
  const topParity = new Int8Array(W * H).fill(-1);
  let scanned = 0, scanNeed = 0, composited = 0, compPx = 0, maxComp = 0, unsat = 0, coveredPx = 0, sheetsDisagree = 0, parityPx = 0;
  const t0 = process.hrtime.bigint();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    // pixel position as the shader forms it: centre + offset, in the arithmetic's precision
    const w = A.C(A.R(view.cx) + A.R((i + 0.5 - W / 2) / view.s), A.R(view.cy) - A.R((j + 0.5 - H / 2) / view.s));
    const cands = enumr(w, pxw);
    scanned += cands.length;
    const cov = [], allD = [];
    let anyInf = false;
    for (const cd of cands) {
      if (cd.inf) anyInf = true;
      if (Number.isFinite(cd.z.re) || cd.lam) allD.push(key(cd.z, cd.lam));
      const z = cd.z, Jm = Math.hypot(cd.J.re, cd.J.im);
      let lev;
      if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) {
        // float overflow (|z| beyond range): the level from log z for shapes that have that form, else outside
        if (cd.lam && region.lam) lev = region.lam(cd.lam) * Math.exp(cd.lam.re - Math.log(Jm)) / pxw; else continue;
      } else lev = region.level(z) / (Jm * pxw);
      let cv;
      if (cd.lgw && Number.isFinite(cd.lvl) && Number.isFinite(z.re)) {
        // image-space direction of the region's gradient: conj(dz/dw) * grad_z L (numerical, one pixel footprint)
        const h = Jm * pxw, gx = (region.level({ re: z.re + h, im: z.im }) - region.level({ re: z.re - h, im: z.im })) / (2 * h), gy = (region.level({ re: z.re, im: z.im + h }) - region.level({ re: z.re, im: z.im - h })) / (2 * h);
        const g = [cd.J.re * gx + cd.J.im * gy, cd.J.re * gy - cd.J.im * gx], gl = Math.hypot(g[0], g[1]) || 1;
        const dot = (g[0] * cd.lgw[0] + g[1] * cd.lgw[1]) / gl;
        cv = dot < -0.5 ? Math.min(lev, 0.5) + Math.min(cd.lvl, 0.5) : Math.min(lev, cd.lvl) + 0.5;
      } else cv = Math.min(lev, cd.lvl) + 0.5;
      cv = Math.min(1, Math.max(0, cv));
      if (cv <= 0) continue;
      cov.push({ cv, D: key(z, cd.lam), cd, Jm });
    }
    cov.sort((a, b) => a.D - b.D);
    // coverage-union compositing (design 6.3): sheets are composited as if each covered the union U = max cv of the
    // pixel, with a relative weight cv / U, and the result is scaled by U. Coincident edges of many sheets (every
    // rim of an infinitely-sheeted image) then give the true area fraction instead of 1 - (1 - cv)^K.
    let U = 0;
    for (const e of cov) U = Math.max(U, e.cv);
    let T1 = 1, T85 = 1, col = [0, 0, 0], n = 0, par0 = -1;
    for (const e of cov) {
      if (n >= B_MAX || T85 < T_STOP) break;
      n++;
      const rel = e.cv / U;
      T1 *= 1 - rel;
      // pattern colour at this preimage, with the analytic pixel footprint (fwidth emulation: rho (|cos| + |sin|))
      const z = e.cd.z, rho = e.Jm * pxw, ph = Math.atan2(e.cd.J.im, e.cd.J.re), fw = rho * (Math.abs(Math.cos(ph)) + Math.abs(Math.sin(ph)));
      let pc;
      if (pattern === 'polar') {
        // pattern coordinates (ln r, arg) from log z when the backward chain produced it (exact for any |z|)
        const lr = e.cd.lam ? e.cd.lam.re : Math.log(Math.hypot(z.re, z.im)), th = e.cd.lam ? Math.atan2(Math.sin(e.cd.lam.im), Math.cos(e.cd.lam.im)) : Math.atan2(z.im, z.re);
        const g = [lr * 16 / TAU, th * 16 / TAU];
        // footprint in (ln r, arg): rho / r for either coordinate (computed as a log difference: no overflow)
        const gwc = Math.exp(Math.log(fw) - lr) * 16 / TAU;
        const mo = smooth(0.18, 0.45, gwc);
        const t = checkerAA(g, [gwc, gwc]);
        pc = [0, 1, 2].map((q) => (c0[q] + (c1[q] - c0[q]) * t) * (1 - mo) + 0.5 * (c0[q] + c1[q]) * mo);
        const par = (((Math.floor(g[0]) + Math.floor(g[1])) % 2) + 2) % 2;
        if (mo === 0 && e.cv === 1) { if (par0 < 0) par0 = par; else if (par !== par0) sheetsDisagree++; }
      } else if (pattern === 'sphere') {
        // spherical checker (design 7): n_arg = 16 sectors, n_lat = 8 bands of latitude lambda = 2 atan(|z| / rho0),
        // rho0 = 1 (the equator of the app's Riemann sphere), centre 0; 128 cells cover C and infinity
        const lr = e.cd.lam ? e.cd.lam.re : Math.log(Math.hypot(z.re, z.im));
        const th = e.cd.lam ? Math.atan2(Math.sin(e.cd.lam.im), Math.cos(e.cd.lam.im)) : Math.atan2(z.im, z.re);
        const lam = 2 * Math.atan(Math.exp(lr));
        const g = [th * 16 / TAU, lam * 8 / PI];
        // footprints: |grad arg| = 1/r, |grad lambda| = 2 / (r + 1/r) = 1 / cosh(ln r)
        const gw = [Math.exp(Math.log(fw) - lr) * 16 / TAU, fw / Math.cosh(Math.min(700, Math.abs(lr))) * 8 / PI];
        const mo = smooth(0.18, 0.45, Math.max(gw[0], gw[1]));
        const t = checkerAA(g, gw);
        pc = [0, 1, 2].map((q) => (c0[q] + (c1[q] - c0[q]) * t) * (1 - mo) + 0.5 * (c0[q] + c1[q]) * mo);
      } else {
        const g = [z.re / cell, z.im / cell], gw = fw / cell, mo = smooth(0.18, 0.45, gw);
        const t = checkerAA(g, [gw, gw]);
        pc = [0, 1, 2].map((q) => (c0[q] + (c1[q] - c0[q]) * t) * (1 - mo) + 0.5 * (c0[q] + c1[q]) * mo);
      }
      const a = ALPHA * rel;
      for (let q = 0; q < 3; q++) col[q] += T85 * a * pc[q];
      T85 *= 1 - a;
    }
    composited += n; if (n > 0) compPx++; if (n > maxComp) maxComp = n;
    // the outward scan of a GPU implementation stops once both directions pass the saturation key: it visits the
    // members with D up to the key of the last composited sheet, plus one beyond in each direction
    if (anyInf) { const Dsat = n > 0 && T85 < T_STOP ? cov[n - 1].D : Infinity; let need = 0; for (const d of allD) if (d <= Dsat) need++; scanNeed += Math.min(cands.length, need + 2); } else scanNeed += cands.length;
    const p = j * W + i;
    for (let q = 0; q < 3; q++) col[q] *= U;
    covOpaque[p] = U * (1 - T1); alpha85[p] = U * (1 - T85);
    topParity[p] = par0;
    if (covOpaque[p] > 0.5) coveredPx++;
    if (anyInf && n > 0 && T85 >= T_STOP && cov.length > n) unsat++;
    // images over a white plane
    const aS = alpha85[p];
    for (let q = 0; q < 3; q++) {
      solid[4 * p + q] = Math.round(255 * ((1 - aS) * 1 + aS * c0[q]));
      pat[4 * p + q] = Math.round(255 * (col[q] + (1 - aS) * 1));
    }
    solid[4 * p + 3] = pat[4 * p + 3] = 255;
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { ms, scanned: scanned / (W * H), scanNeed: scanNeed / (W * H), composited: composited / Math.max(1, compPx), maxComp, unsat, coveredPx, sheetsDisagree, covOpaque, alpha85, topParity, solid, pat };
}

// exact truth: centre mask and 4x4 supersampled fraction
function truthOf(cs, view) {
  const frac = new Float32Array(W * H), ctr = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let n = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (cs.truth(C(view.cx + (i + (a + 0.5) / 4 - W / 2) / view.s, view.cy - (j + (b + 0.5) / 4 - H / 2) / view.s))) n++;
    frac[j * W + i] = n / 16;
    ctr[j * W + i] = cs.truth(pix(view, i, j)) ? 1 : 0;
  }
  return { frac, ctr };
}

function metrics(cs, view, r, tr) {
  let inter = 0, uni = 0, holes = 0, spill = 0, bmax = 0, bsum = 0, bn = 0, ringLeak = 0, parOk = 0, parN = 0;
  for (let p = 0; p < W * H; p++) {
    const a = r.covOpaque[p] >= 0.5, b = tr.ctr[p] === 1;
    if (a && b) inter++;
    if (a || b) uni++;
    if (b && !a) holes++;
    if (a && !b) spill++;
    const f = tr.frac[p];
    if (f > 0 && f < 1) { const e = Math.abs(r.covOpaque[p] - f); bmax = Math.max(bmax, e); bsum += e; bn++; }
    else { const e = Math.abs(r.covOpaque[p] - f); if (e > bmax && e > 0.02) bmax = Math.max(bmax, e); }
  }
  // z^i: the hole |w| < e^{-pi}: any alpha there (beyond 1 px of its rim) is a leak; polar parity of the top sheet
  if (cs.parity) {
    const rh = Math.exp(-PI);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const w = pix(view, i, j), p = j * W + i, rr = Math.hypot(w.re, w.im);
      if (rr < rh - 1 / view.s && r.alpha85[p] > 1 / 255) ringLeak++;
      if (tr.frac[p] === 1 && r.topParity[p] >= 0 && cs.parityEdge(w, view.s) > 1.5) { parN++; if (r.topParity[p] === cs.parity(w)) parOk++; }
    }
  }
  return { iou: uni ? inter / uni : 1, holes, spill, covErrMax: bmax, covErrMean: bn ? bsum / bn : 0, ringLeak, parity: parN ? parOk / parN : null, parN };
}

module.exports = { render, truthOf, metrics, invStep, makeEnumerator, M_WIN, B_MAX };

if (require.main === module) {
  const fs = require('fs');
  const out = require('path').join(__dirname, 'out');
  const which = process.argv.slice(2);
  const runs = [];
  for (const [name, cs] of Object.entries(CASES)) {
    const variants = ['default', 'out4', 'out16'];
    if (name === 'cayley_H') variants.push('zoom1');
    if (name === 'recip_ext') variants.push('zoom0');
    for (const v of variants) runs.push([name, cs, v]);
  }
  console.log('case         view     arith  IoU      holes spill covErr(max/mean) z^i-hole-leak parity(top)  scan/need comp/px maxComp unsat  ms(JS)');
  for (const [name, cs, v] of runs) {
    if (which.length && !which.some((x) => name.startsWith(x))) continue;
    const view = viewOf(cs, v);
    const tr = truthOf(cs, view);
    for (const [an, A] of [['f64', K.A64], ['f32', K.A32]]) {
      const cell = name === 'e1z_disc' ? 0.2 : 1;
      const r = render(cs, view, A, { pattern: name === 'zi_H' ? 'polar' : 'checker', cell });
      const m = metrics(cs, view, r, tr);
      console.log(`${name.padEnd(12)} ${v.padEnd(8)} ${an}    ${m.iou.toFixed(5)}  ${String(m.holes).padStart(5)} ${String(m.spill).padStart(5)} ${m.covErrMax.toFixed(3)}/${m.covErrMean.toFixed(3)}        ${cs.parity ? String(m.ringLeak).padStart(5) : '    -'}     ${m.parity == null ? '   -    ' : m.parity.toFixed(5)}  ${r.scanned.toFixed(1).padStart(5)}/${r.scanNeed.toFixed(1).padStart(4)} ${r.composited.toFixed(2).padStart(6)} ${String(r.maxComp).padStart(5)} ${String(r.unsat).padStart(6)} ${r.ms.toFixed(0).padStart(6)}`);
      if (an === 'f32') { K.writePNG(require('path').join(out, `inv_${name}_${v}_solid.png`), W, H, r.solid); K.writePNG(require('path').join(out, `inv_${name}_${v}_pattern.png`), W, H, r.pat); }
    }
  }
}

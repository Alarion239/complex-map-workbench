// @ts-check
'use strict';
// The patterns of the mapped views with analytic footprints, float64 (notes/sphere-design/SPEC.md, 6.1-6.3): the
// CPU twin of the GPU's (gl.js), moved out of inverse.js (issue #20, the file-size budget), which takes these names
// back at the top of its closure (const { ... } = InvPatterns). A closure of its own, as every module of src/ is.
const InvPatterns = (() => {
  const { C } = CX;
  const { add, sub, mul, div, abs, log, scale, isZero } = CX;
  const PI = Math.PI, TAU = 2 * PI, LN2 = Math.LN2;
  const ONE = C(1, 0);

  // =====================================================================================================
  // 10. Patterns with analytic footprints (SPEC 6.1-6.3), float64
  // =====================================================================================================
  const PATTERNS = { solid: 0, checker: 1, polar: 2, tiles: 3, grid: 4, polargrid: 5, phase: 6, stretch: 7, sphere: 8 };
  const fract = (x) => x - Math.floor(x);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const clampS = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // the GPU's ixChecker (gl.js): for w < 1 the box-filtered square wave as the ramp around the nearest cell edge
  // (no cancellation), else the difference of two fract() terms
  const sqAA = (p, w) => {
    if (w >= 1) return clampS(2 * (Math.abs(fract((p - 0.5 * w) * 0.5) - 0.5) - Math.abs(fract((p + 0.5 * w) * 0.5) - 0.5)) / w);
    const n = Math.floor(p + 0.5), q = p - n, sg = ((n % 2) + 2) % 2 ? -1 : 1;
    return sg * clampS(2 * q / Math.max(w, 2.4e-7 * Math.abs(p), 1e-300));
  };
  function checkerAA(px, py, wx, wy) { return 0.5 - 0.5 * sqAA(px, wx) * sqAA(py, wy); }
  const moire = (wx, wy) => smooth(0.18, 0.45, Math.max(wx, wy));
  const iso = (x, w, px) => { const d = Math.abs(fract(x + 0.5) - 0.5) / Math.max(w, 1e-6); return 1 - smooth(0.5 * px - 0.5, 0.5 * px + 0.6, d); };
  const iso0 = (x, w, px) => { const d = Math.abs(x) / Math.max(w, 1e-30); return 1 - smooth(0.5 * px - 0.5, 0.5 * px + 0.6, d); };
  const dfade = (w) => 1 - smooth(0.15, 0.35, w);
  const Gsaw = (x) => { const f = fract(x); return 0.5 * Math.floor(x) + 0.5 * f * f; };
  const sawAA = (x, w) => { w = Math.max(w, 1e-5); return (Gsaw(x + 0.5 * w) - Gsaw(x - 0.5 * w)) / w; };
  const net = (gx, gy, wx, wy) => Math.max(iso(gx, wx, 1), iso(gy, wy, 1)) * (1 - moire(wx, wy));
  const sdBox = (qx, qy, ax, ay, bx, by) => {
    const cx0 = 0.5 * (ax + bx), cy0 = 0.5 * (ay + by), hx = 0.5 * (bx - ax), hy = 0.5 * (by - ay);
    const dx = Math.abs(qx - cx0) - hx, dy = Math.abs(qy - cy0) - hy;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
  };
  const hexRGB = (h, d) => { const m = /^#?([0-9a-f]{6})/i.exec(String(h || '')); const x = m ? m[1] : d.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255); };
  const par2 = (a, b) => ((((Math.floor(a) + Math.floor(b)) % 2) + 2) % 2);
  // Inverse.patternColor(look, cand) -> {col: [r, g, b] (sRGB 0..1), par: parity of the checker cell (-1: none),
  //  mo: moiré fade}. look: {pattern (id or name), c0, c1, k ([r, g, b]), cell, lines, origin [x, y], sphN, dpr};
  //  cand: {z, dX, dY, lam, dLX, dLY, J, JL}. The pattern-aligned origin Q is 0 (float64 needs no snapping).
  function patternColor(lk, e) {
    const pat = typeof lk.pattern === 'number' ? lk.pattern : (PATTERNS[lk.pattern] ?? 1);
    const c0 = lk.c0, c1 = lk.c1, k = lk.k, cell = lk.cell || 1, dpr = lk.dpr || 1;
    const avg = mixc(c0, c1, 0.5);
    let z = e.z;
    const dX = e.dX, dY = e.dY;
    // a leaf near a saturation anchor p (z = p + delta): cell coordinates relative to Q (p snapped to 10 cells, as the
    // GPU's vQ) and log z = log p + log(1 + delta / p) without the rounding of p + delta (the GPU's anchored pattern)
    let g = [z.re / cell, z.im / cell], lamA = null, gK = [0, 0];
    if (e.anc) {
      // Q: the cell corner nearest to p; g relative to it (precise), its integer shift k mod 10 added after the
      // magnification below (the GPU's gK)
      const p = e.anc.p, kx = Math.round(p.re / cell), ky = Math.round(p.im / cell);
      g = [(p.re - kx * cell + e.anc.d.re) / cell, (p.im - ky * cell + e.anc.d.im) / cell];
      gK = [((kx % 10) + 10) % 10, ((ky % 10) + 10) % 10];
      if (isZero(p)) lamA = { lam: e.anc.l, dLX: e.anc.dLX, dLY: e.anc.dLY };
      else {
        const eps = div(e.anc.d, p), zz = add(p, e.anc.d);
        const l1 = abs(eps) < 1e-4 ? sub(eps, scale(mul(eps, eps), 0.5)) : log(add(ONE, eps));
        lamA = { lam: add(log(p), l1), dLX: div(dX, zz), dLY: div(dY, zz) };
        // the log-polar cells relative to the corner nearest to log p (the GPU's gpA)
        const lp = log(p), gx = lp.re * 16 / TAU, gy = lp.im * 16 / TAU, nx = Math.round(gx), ny = Math.round(gy);
        lamA.gpA = [(gx - nx) + l1.re * 16 / TAU, (gy - ny) + l1.im * 16 / TAU, ((nx % 2) + 2) % 2, ((ny % 2) + 2) % 2];
      }
      z = add(p, e.anc.d);
    }
    const gw = [(Math.abs(dX.re) + Math.abs(dY.re)) / cell, (Math.abs(dX.im) + Math.abs(dY.im)) / cell];
    // the GPU's magnification of footprints far below the AA filters' resolution (gl.js PATTERN_SRC 'analytic'): the
    // position relative to the nearest cell edge is magnified with the footprint (a sheet compressed onto a cell
    // corner shows its cells, not the average), where the footprint is above the float32 resolution of g
    {
      const gm = Math.max(gw[0], gw[1]);
      if (pat !== 3 && gm < 1e-6 && gm > 4.8e-7 * Math.max(Math.abs(g[0]), Math.abs(g[1]))) {
        const sc = 1e-3 / Math.max(gm, 1e-37);
        for (let i = 0; i < 2; i++) { const ne = Math.floor(g[i] + 0.5); g[i] = ne + Math.max(-0.49, Math.min(0.49, (g[i] - ne) * sc)); gw[i] *= sc; }
      }
    }
    g[0] += gK[0]; g[1] += gK[1];
    const m = moire(gw[0], gw[1]);
    const o = lk.origin || [0, 0], ox = o[0] ?? o.re ?? 0, oy = o[1] ?? o.im ?? 0;
    const LA = lamA || (e.lam && e.dLX ? { lam: e.lam, dLX: e.dLX, dLY: e.dLY } : null);
    const useLam = !!(LA && ox === 0 && oy === 0);
    // log-polar coordinates about the origin and their per-pixel derivatives d(log v) = dz / v
    const polar = () => {
      if (useLam) return { lr: LA.lam.re, th: LA.lam.im, qX: LA.dLX, qY: LA.dLY };
      const v = C(z.re - ox, z.im - oy), r = abs(v);
      return { lr: Math.log(Math.max(r, 1e-300)), th: Math.atan2(v.im, v.re), qX: div(dX, v), qY: div(dY, v) };
    };
    let col = c0, par = -1, mo = 0;
    switch (pat) {
      case 1: {
        col = mixc(mixc(c0, c1, checkerAA(g[0], g[1], gw[0], gw[1])), avg, m);
        if (lk.lines) col = mixc(col, k, 0.35 * net(g[0], g[1], gw[0], gw[1]));
        par = par2(g[0], g[1]); mo = m; break;
      }
      case 2: {
        const P = polar(), f = 16 / TAU;
        const gA = useLam && lamA && lamA.gpA ? lamA.gpA : null;
        const gp = gA ? [gA[0], gA[1]] : [P.lr * f, P.th * f], gpw = [(Math.abs(P.qX.re) + Math.abs(P.qY.re)) * f, (Math.abs(P.qX.im) + Math.abs(P.qY.im)) * f];
        if (gA) {   // the GPU's magnification of sub-resolution log-polar footprints (programs with anchors: IX_ANC)
          const gm = Math.max(gpw[0], gpw[1]);
          if (gm < 1e-6 && gm > 4.8e-7 * Math.max(Math.abs(gp[0]), Math.abs(gp[1]))) {
            const sc = 1e-3 / Math.max(gm, 1e-37);
            for (let i = 0; i < 2; i++) { const ne = Math.floor(gp[i] + 0.5); gp[i] = ne + Math.max(-0.49, Math.min(0.49, (gp[i] - ne) * sc)); gpw[i] *= sc; }
          }
          if (gA) { gp[0] += gA[2]; gp[1] += gA[3]; }
        }
        const mp = moire(gpw[0], gpw[1]);
        col = mixc(mixc(c0, c1, checkerAA(gp[0], gp[1], gpw[0], gpw[1])), avg, mp);
        if (lk.lines) col = mixc(col, k, 0.35 * net(gp[0], gp[1], gpw[0], gpw[1]));
        const rr = Math.exp(P.lr), gr = rr / cell, fgr = (Math.abs(P.qX.re) + Math.abs(P.qY.re)) * rr / cell;
        // the near-origin fade to c0 only without an exact Lambda (gl.js PATTERN_SRC 'analytic': with Lambda the cells
        // are resolved for any |z|, and fading the sheets near 0 made seams under z^i, P2 review)
        const rc = gr * 12;
        if (!useLam) col = mixc(c0, col, clamp01(0.5 + (rc - 1) / Math.max(fgr * 12, 1e-9)));
        par = par2(gp[0], gp[1]); mo = mp; break;
      }
      case 3: {
        const ca = c1, cb = mixc(c1, c0, 0.35);
        col = mixc(ca, cb, checkerAA(g[0], g[1], gw[0], gw[1]));
        const qx = fract(g[0]), qy = fract(g[1]);
        const d = Math.min(sdBox(qx, qy, 0.30, 0.18, 0.42, 0.82), sdBox(qx, qy, 0.30, 0.70, 0.72, 0.82), sdBox(qx, qy, 0.30, 0.46, 0.62, 0.56));
        const pw = Math.max(0.5 * (gw[0] + gw[1]), 1e-12);
        const cov = clamp01(0.5 - d / pw) * smooth(10, 16, 1 / (pw * dpr));
        col = mixc(mixc(col, k, cov), mixc(ca, cb, 0.5), m);
        par = par2(g[0], g[1]); mo = m; break;
      }
      case 4: {
        const fs = [Math.abs(dX.re) + Math.abs(dY.re), Math.abs(dX.im) + Math.abs(dY.im)];
        const re1 = iso(g[0], gw[0], 1.25 * dpr) * dfade(gw[0]), re5 = iso(g[0] / 5, gw[0] / 5, 1.75 * dpr) * dfade(gw[0] / 5);
        const im1 = iso(g[1], gw[1], 1.0 * dpr) * dfade(gw[1]), im5 = iso(g[1] / 5, gw[1] / 5, 1.5 * dpr) * dfade(gw[1] / 5);
        const ax = Math.max(iso0(z.re, fs[0], 2 * dpr), iso0(z.im, fs[1], 2 * dpr));
        col = mixc(c1, mixc(c0, k, 0.5), 0.3 * m);
        col = mixc(col, c0, Math.max(im1, im5));
        col = mixc(col, k, Math.max(re1, re5));
        col = mixc(col, k, ax);
        mo = m; break;
      }
      case 5: {
        const P = polar(), rr = Math.exp(P.lr);
        const gr = rr / cell, fgr = (Math.abs(P.qX.re) + Math.abs(P.qY.re)) * rr / cell;
        const ra = P.th * (12 / PI), fra = (Math.abs(P.qX.im) + Math.abs(P.qY.im)) * (12 / PI);
        col = mixc(c1, mixc(c0, k, 0.5), 0.2 * moire(fgr, fgr));
        col = mixc(col, c0, iso(gr, fgr, dpr) * dfade(fgr));
        col = mixc(col, k, 0.7 * iso(ra, fra, dpr) * dfade(fra));
        col = mixc(col, k, iso(ra / 6, fra / 6, 1.75 * dpr) * dfade(fra / 6));
        break;
      }
      case 6: {                                                          // source phase: the GPU's formula (P2 review)
        // sw = mix(sawAA(lr, flr), 0.5, moire(flr)), wheel(arg, 0.62 + 0.14 sw): the OKLCH LUT through GLR.phaseRGB (the
        // same texels, bilinear) when gl.js is loaded; lr = ln|z| 6/pi, flr = (|Re(dX/z)| + |Re(dY/z)|) 6/pi
        const th = Math.atan2(z.im, z.re), lr = Math.log(Math.max(abs(z), 1e-300)) * (6 / PI);
        const zz = isZero(z) ? C(1e-300, 0) : z, qx = div(dX, zz), qy = div(dY, zz);
        const flr = (Math.abs(qx.re) + Math.abs(qy.re)) * (6 / PI);
        const sw = sawAA(lr, flr) * (1 - moire(flr, flr)) + 0.5 * moire(flr, flr);
        const L = 0.62 + 0.14 * sw;
        if (GLR.phaseRGB) col = GLR.phaseRGB(th, L);
        else {
          const h = (th / TAU + 1) % 1, v = L;
          const f = (n) => { const kk = (n + h * 6) % 6; return v - v * 0.55 * Math.max(0, Math.min(kk, 4 - kk, 1)); };
          col = [f(5), f(3), f(1)];
        }
        if (lk.lines) col = mixc(col, k, 0.35 * net(g[0], g[1], gw[0], gw[1]));
        break;
      }
      case 7: {
        const J = e.J;
        let lj;
        if (e.lam && e.JL) { const T = e.JL; lj = 2 * e.lam.re / LN2 + Math.log2(Math.abs(T[0] * T[3] - T[1] * T[2])); }
        else lj = Math.log2(Math.abs(J[0] * J[3] - J[1] * J[2]));
        const vJac = -0.5 * lj, t = Math.max(-1, Math.min(1, vJac / 3));
        const sx = lk.stretch || {};
        const shrink = hexRGB(sx.shrink, '#2E69B2'), grow = hexRGB(sx.grow, '#D79628'), mid = hexRGB(sx.mid, '#E9F0F2');
        col = t < 0 ? mixc(mid, shrink, Math.pow(-t, 0.8)) : mixc(mid, grow, Math.pow(t, 0.8));
        col = mixc(col, k, 0.18 * Math.max(iso(g[0], gw[0], dpr), iso(g[1], gw[1], dpr)) * (1 - m));
        break;
      }
      case 8: {                                                          // spherical checker (6.3)
        const P = polar(), nLon = Math.max(4, lk.sphN || 16), nLat = nLon / 2;
        const lat = P.lr > 0 ? PI - 2 * Math.atan(Math.exp(-P.lr)) : 2 * Math.atan(Math.exp(P.lr));
        const sc = 1 / Math.cosh(P.lr);                                   // 2 rho / (1 + rho^2)
        const gs = [P.th * nLon / TAU, lat * nLat / PI];
        const gsw = [(Math.abs(P.qX.im) + Math.abs(P.qY.im)) * nLon / TAU, (Math.abs(P.qX.re) + Math.abs(P.qY.re)) * sc * nLat / PI];
        const ms = moire(gsw[0], gsw[1]);
        col = mixc(mixc(c0, c1, checkerAA(gs[0], gs[1], gsw[0], gsw[1])), avg, ms);
        if (lk.lines) col = mixc(col, k, 0.35 * net(gs[0], gs[1], gsw[0], gsw[1]));
        par = par2(gs[0], gs[1]); mo = ms; break;
      }
      default:
        if (lk.lines) col = mixc(col, k, 0.35 * net(g[0], g[1], gw[0], gw[1]));
        par = 0; mo = 0;
    }
    return { col, par, mo };
  }

  return { PATTERNS, sqAA, hexRGB, patternColor };
})();
import { CX } from './cx.js';
import { GLR } from './gl.js';
export { InvPatterns };

'use strict';
// Sphere-native line sampling prototype: a curve is a path on the Riemann sphere (a straight line is a great circle
// through infinity), refined by bisection in the image metric, with the same stopping rules as the mesher: cull (off
// the view, tame), stroke saturation (every pixel along the piece already stroked by a nearer piece), the quiet rule
// toward points where F has no limit, the precision floor and a budget. Output: CPU-mapped polylines (image coords).
//   node notes/proto/sphere-native/lines.js
const { lift } = require('./sphm.js');
const { C } = CX;
const PI = Math.PI;
const step = (type, params = {}) => Funcs.build({ type, params });
const chain = (...bs) => (z) => { for (const b of bs) z = b.f(z); return z; };
const W = 410, H = 516;

// The line a + t d through infinity as two chart pieces of the great circle: chart Z: z = a + t d, t in [-1, 1];
// chart U: z = a + d / tau, tau in [-1, 1] (tau = 0 is infinity). Bisection toward t = 0 or tau = 0 is geometric.
function lineCurve(a, d) {
  return [
    { s0: -1, s1: 1, f: (t) => C(a.re + t * d.re, a.im + t * d.im) },
    { s0: -1, s1: 0, f: (tau) => (tau === 0 ? C(Infinity, Infinity) : C(a.re + d.re / tau, a.im + d.im / tau)) },
    { s0: 0, s1: 1, f: (tau) => (tau === 0 ? C(Infinity, Infinity) : C(a.re + d.re / tau, a.im + d.im / tau)) },
  ];
}

function sampleLine(pieces, F, view, opt = {}) {
  const TAU_DEV = 0.3, LMAX = 48, QUIET = opt.quiet ?? 24;
  let quietStops = 0;
  const px = (w) => [(w.re - view.cx) * view.s + W / 2, (view.cy - w.im) * view.s + H / 2];
  const fin = (w) => w && Number.isFinite(w.re) && Number.isFinite(w.im) && Math.abs(w.re) < 1e300 && Math.abs(w.im) < 1e300;
  let evals = 0;
  const cov = new Uint8Array(W * H);
  const cells = (p, q, fn) => {   // 1 px cells along a segment (sampled every 0.5 px)
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 2));
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(p[0] + (q[0] - p[0]) * i / n), y = Math.floor(p[1] + (q[1] - p[1]) * i / n);
      if (x >= 0 && y >= 0 && x < W && y < H && fn(y * W + x) === false) return false;
    }
    return true;
  };
  const out = [];
  let culled = 0, saturated = 0, dropped = 0;
  for (const pc of pieces) {
    const INFP = [Infinity, Infinity];   // a sample at infinity (|w| overflowed, no NaN): off every side of the view
    const ev = (s) => {
      evals++; const z = pc.f(s); if (!Number.isFinite(z.re)) return null;
      let w; try { w = F(z); } catch (e) { w = null; }
      if (fin(w)) return px(w);
      return w && !Number.isNaN(w.re) && !Number.isNaN(w.im) ? INFP : null;
    };
    // 64 initial intervals; each refined depth-first (the order of the near part first is kept by the D-order of
    // the real implementation; here pieces nearest the parameter middle go first)
    const n0 = 64, S = [], P = [];
    for (let i = 0; i <= n0; i++) { const s = pc.s0 + (pc.s1 - pc.s0) * i / n0; S.push(s); P.push(ev(s)); }
    const stack = [];
    for (let i = n0 - 1; i >= 0; i--) stack.push([S[i], S[i + 1], P[i], P[i + 1]]);
    let iter = 0;
    while (stack.length) {
      if (++iter > (opt.maxIter || 2e6)) { console.log('iteration cap', stack.length, stack[stack.length - 1]); break; }
      const cur = stack.pop();
      const [s0, s1, p0, p1] = cur;
      const sm = (s0 + s1) / 2;
      // precision floor: relative to the parameter (geometric toward the chart origin), 1e-300 at it
      if (!(s1 - s0 > 1e-13 * Math.max(Math.abs(s0), Math.abs(s1)) && s1 - s0 > 1e-300) || sm === s0 || sm === s1) { dropped++; continue; }
      const pm = ev(sm);
      if (p0 && p1 && pm && (p0 === INFP || p1 === INFP || pm === INFP)) {
        // part of the piece is at infinity: culled when its finite samples are all off one side of the view
        const fs = [p0, p1, pm].filter((p) => p !== INFP);
        const oc = (p) => (p[0] < -2 ? 1 : 0) | (p[0] > W + 2 ? 2 : 0) | (p[1] < -2 ? 4 : 0) | (p[1] > H + 2 ? 8 : 0);
        if (fs.reduce((c, p) => c & oc(p), 15)) { culled++; continue; }
      } else if (p0 && p1 && pm) {
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const dev = Math.hypot(pm[0] - (p0[0] + p1[0]) / 2, pm[1] - (p0[1] + p1[1]) / 2);
        const M = Math.max(2, 0.5 * len);
        const oc = (p) => (p[0] < -M ? 1 : 0) | (p[0] > W + M ? 2 : 0) | (p[1] < -M ? 4 : 0) | (p[1] > H + M ? 8 : 0);
        if ((oc(p0) & oc(p1) & oc(pm)) && dev <= 0.3 * len) { culled++; continue; }
        if (len < 0.25) { out.push([pc, s0, s1, p0, p1]); continue; }          // sub-pixel piece
        if (dev <= TAU_DEV && len <= LMAX) {
          if (cells(p0, p1, (k) => cov[k] > 0)) { saturated++; continue; }   // stroked already by a nearer piece
          out.push([pc, s0, s1, p0, p1]); cells(p0, p1, (k) => { cov[k] = 1; });
          continue;
        }
      }
      // toward a sample where F has no value (an apex: 0 or infinity of z^i, ...): the child keeping the apex is
      // processed after its sibling and counts how many siblings in a row added nothing (the quiet rule)
      const q = stack.q || 0;
      if (!p0 !== !p1) {
        const apexLeft = !p0;
        const apexChild = apexLeft ? [s0, sm, p0, pm] : [sm, s1, pm, p1], sib = apexLeft ? [sm, s1, pm, p1] : [s0, sm, p0, pm];
        apexChild.q = cur.q || 0; apexChild.mark = out.length;
        if ((cur.mark !== undefined) && out.length === cur.mark) apexChild.q++; else if (cur.mark !== undefined) apexChild.q = 0;
        if (apexChild.q >= QUIET) { quietStops++; continue; }
        apexChild.mark = out.length;
        stack.push(apexChild); stack.push(sib);
        continue;
      }
      stack.push([sm, s1, pm, p1]);
      stack.push([s0, sm, p0, pm]);
    }
  }
  return { segs: out.length, evals, culled, saturated, dropped, quietStops, out };
}

if (require.main === module) {
  const real = lineCurve(C(0, 0), C(1, 0));
  const cases = [
    ['z^i of the real axis (boundary of H)', chain(step('powa', { alpha: 'i', cut: 180, k: 0 })), { cx: 0, cy: 0, s: 190 }],
    ['z^i, zoomed out 16x', chain(step('powa', { alpha: 'i', cut: 180, k: 0 })), { cx: 0, cy: 0, s: 190 / 16 }],
    ['log of the real axis', chain(step('log', { cut: 180, k: 0 })), { cx: -0.18, cy: PI / 2, s: 97 }],
    ['log, zoomed out 16x', chain(step('log', { cut: 180, k: 0 })), { cx: -0.18, cy: PI / 2, s: 97 / 16 }],
    ['exp of the real axis', chain(step('exp')), { cx: 0, cy: 0, s: 30 }],
    ['Cayley of the real axis (through infinity -> 1)', chain(step('mobius', { a: '1', b: '-i', c: '1', d: 'i' })), { cx: 0, cy: 0, s: 190 }],
  ];
  for (const [name, F, view] of cases) {
    const t0 = performance.now();
    const r = sampleLine(real, F, view);
    const ms = performance.now() - t0;
    // accuracy check: max distance of the true curve (dense sample of each emitted segment) from its chord, px
    let dmax = 0;
    for (const [pc, s0, s1, p0, p1] of r.out) {
      for (const f of [0.25, 0.5, 0.75]) {
        const z = pc.f(s0 + f * (s1 - s0)), w = F(z);
        if (!Number.isFinite(w.re)) continue;
        const p = [(w.re - view.cx) * view.s + W / 2, (view.cy - w.im) * view.s + H / 2];
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = dx * dx + dy * dy;
        let t = L > 0 ? ((p[0] - p0[0]) * dx + (p[1] - p0[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
        dmax = Math.max(dmax, Math.hypot(p[0] - p0[0] - t * dx, p[1] - p0[1] - t * dy));
      }
    }
    console.log(`${name.padEnd(48)} ${ms.toFixed(1).padStart(6)} ms  segments ${String(r.segs).padStart(5)}  evals ${String(r.evals).padStart(6)}  culled ${r.culled} saturated ${r.saturated} quiet-stops ${r.quietStops} floor ${r.dropped}  max dev ${dmax.toFixed(3)} px`);
  }
}
module.exports = { sampleLine, lineCurve };

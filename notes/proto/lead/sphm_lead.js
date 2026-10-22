'use strict';
// Sphere-native adaptive mesher: prototype for notes/sphere-design/sphere-native.md
//
// The source region is a subset of the Riemann sphere. A base octahedron (poles 0 and infinity, equator |z| = 1) is
// refined CONFORMINGLY by newest-vertex bisection (NVB) with geodesic edge midpoints; every decision is made on the
// CPU in float64 in the IMAGE metric of the view that shows the map (flat: screen px; sphere: chordal px on the globe).
// Vertices where F has no limit (UNDEF) are never used: the triangles touching them ("fans") are refined toward them
// until culled, saturated (infinitely many sheets) or quiet; poles / limits at infinity (INF) are culled chordally in
// flat views and are ordinary vertices on the sphere. Leaves are clipped by the region's level set (marching
// triangles, bisection on the edge) and emitted as flat image triangles (CPU pre-mapped).
//
// Exports Mesher(cfg) -> {run(), stats, output()}; the case runner is run_cases.js.
const path = require('path');
const SRC = path.resolve(__dirname, '../../../src');
global.CX = global.CX || require(path.join(SRC, 'cx.js'));
global.Expr = global.Expr || require(path.join(SRC, 'parse.js'));
global.Funcs = global.Funcs || require(path.join(SRC, 'funcs.js'));
const Region = require(path.join(SRC, 'region.js'));
const { C } = CX;
const TAU = 2 * Math.PI;

const FIN = 0, INF = 1, UNDEF = 2;                                 // vertex image status
const PENDING = 0, FINAL = 1, CULLED = 2, OUTSIDE = 3, SAT = 4, DROPPED = 5;
const STATE_NAMES = ['pending', 'final', 'culled', 'outside', 'saturated', 'dropped'];

// robust stereographic lift of x + iy onto the unit sphere (0 -> south pole, infinity -> north pole)
function lift(x, y, out) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) { out[0] = 0; out[1] = 0; out[2] = 1; return out; }
  const m = Math.max(Math.abs(x), Math.abs(y));
  if (m <= 1) {
    const q = x * x + y * y, d = 1 + q;
    out[0] = 2 * x / d; out[1] = 2 * y / d; out[2] = (q - 1) / d;
  } else { // via u = 1/z, scaled so nothing overflows
    const xs = x / m, ys = y / m, qs = xs * xs + ys * ys;
    const ux = xs / (m * qs), uy = -ys / (m * qs), qu = ux * ux + uy * uy, d = 1 + qu;
    out[0] = 2 * ux / d; out[1] = -2 * uy / d; out[2] = (1 - qu) / d;
  }
  return out;
}
const chord3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------- LEAD: stage-wise evaluation on the Riemann sphere ----------
// The value of every step at infinity (its limit there): {k: FIN, w} | {k: INF} | {k: UNDEF}. Catalog table; custom
// formulas and anything unknown: a numeric probe in the chart u = 1/zeta.
function atInfOf(b) {
  const id = b.def && b.def.id, v = b.vals || {};
  const fin = (w) => ({ k: FIN, w }), inf = { k: INF }, und = { k: UNDEF };
  switch (id) {
    case 'mul': case 'add': case 'affine': case 'conj': case 'joukowski': case 'root': case 'log': return inf;
    case 'recip': return fin(C(0, 0));
    case 'mobius': case 'blaschke': {
      const f = b.f(C(1e154, 1e154)), g = b.f(C(-1e154, 3e153));   // a Mobius map at infinity: a/c (or infinity)
      if (CX.isFin(f) && CX.isFin(g) && CX.abs(CX.sub(f, g)) < 1e-9 * (1 + CX.abs(f))) return fin(f);
      return inf;
    }
    case 'pown': return v.n > 0 ? inf : v.n < 0 ? fin(C(0, 0)) : fin(C(1, 0));
    case 'powa': { const a = v.alpha; return a.re > 0 ? inf : a.re < 0 ? fin(C(0, 0)) : und; }
    case 'exp': case 'sin': case 'cos': case 'tan': case 'sinh': case 'cosh': case 'tanh': case 'arctan': case 'artanh': return und;
    case 'arcsin': case 'arccos': case 'arsinh': case 'arcosh': return inf;
  }
  return probeStep(b.f, null);   // custom, poly, rational, ijouk, ...
}
// the limit of a single step f at the point u of its input plane (u = null: at infinity), from two rings
function probeStep(f, u) {
  const rings = [];
  for (const eps of [1e-6, 1e-9]) {
    const ring = [];
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.37) * TAU / 6, c = Math.cos(t), s = Math.sin(t);
      let x;
      if (u === null) { const r = 1 / eps; x = C(r * c, r * s); }
      else { const au = Math.hypot(u.re, u.im), r = (au > 1e-300 ? au : 1e-3) * eps; x = C(u.re + r * c, u.im + r * s); }
      let w; try { w = f(x); } catch (e) { w = C(NaN, NaN); }
      if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return { k: UNDEF };
      ring.push(lift(w.re, w.im, [0, 0, 0]));
    }
    rings.push(ring);
  }
  const spread = (r) => {
    let mx = 0, my = 0, mz = 0;
    for (const p of r) { mx += p[0]; my += p[1]; mz += p[2]; }
    const n = Math.hypot(mx, my, mz) || 1, m = [mx / n, my / n, mz / n];
    let s = 0; for (const p of r) s = Math.max(s, chord3(p, m));
    return { s, m };
  };
  const a = spread(rings[0]), b = spread(rings[1]);
  if (!(b.s < 1e-5 && b.s <= a.s * 1.01 + 1e-12)) return { k: UNDEF };
  const m = b.m;
  if (m[2] > 1 - 1e-9) return { k: INF };
  const d = 1 - m[2];
  return { k: FIN, w: C(m[0] / d, m[1] / d) };
}
// F as a chain of steps evaluated stage by stage on the sphere: an overflowing step hands the point infinity to the
// next step (which then uses its limit at infinity); a step that is not finite at a finite input is classified by a
// local probe of that step alone. Returns C(x, y) | INFV | UNDEFV.
const INFV = C(Infinity, Infinity), UNDEFV = C(NaN, NaN);
function stagewise(steps) {
  const atInf = steps.map(atInfOf);
  const ev = (z, zInf, nSteps) => {
    let w = z, isInf = !!zInf;
    const n = nSteps == null ? steps.length : nSteps;
    for (let k = 0; k < n; k++) {
      if (isInf) {
        const L = atInf[k];
        if (L.k === UNDEF) return UNDEFV;
        if (L.k === FIN) { w = L.w; isInf = false; }
        continue;
      }
      let v; try { v = steps[k].f(w); } catch (e) { v = UNDEFV; }
      if (Number.isFinite(v.re) && Number.isFinite(v.im) && Math.abs(v.re) < 1e300 && Math.abs(v.im) < 1e300) { w = v; continue; }
      ev.stepProbes++;
      const L = probeStep(steps[k].f, w);
      if (L.k === UNDEF) return UNDEFV;
      if (L.k === INF) isInf = true; else w = L.w;
    }
    return isInf ? INFV : w;
  };
  ev.stepProbes = 0;
  ev.atInf = atInf;
  return ev;
}

function Mesher(cfg) {
  const SW = cfg.steps ? stagewise(cfg.steps) : null;
  const F = SW ? (z) => SW(z, !Number.isFinite(z.re) || !Number.isFinite(z.im)) : cfg.F;
  const INJ = !!cfg.injective;
  const shape = cfg.shape;
  const Lfun = Region.levelOf(shape);
  const distLike = shape.kind !== 'formula';
  const left = cfg.left;                           // {cx, cy, s, W, H}: the source (left) view = meshing window
  const view = cfg.view;                           // {kind:'flat', cx, cy, s, W, H} | {kind:'sphere', R}
  const flat = view.kind === 'flat';
  const alpha = cfg.alpha ?? 1;
  const K = alpha >= 1 ? 1 : Math.min(16, Math.ceil(Math.log(1 / 255) / Math.log(1 - alpha)));
  const KSAT = K;                                   // point samples at pixel centres, as the GPU rasterizes
  const TAU_DEV = cfg.tau ?? 0.3;                  // px: chord deviation
  const EMAX = cfg.emax ?? 64;                     // px: image edge length
  const EBND = 24;                                 // px: image edge length of boundary leaves
  const TAU_BND = 0.5, TAU_PAT = 0.5;              // px
  const P_SRC = 12, P_REF = 4;                     // px of the left view: boundary feature resolution, depth reference
  const QUIET = cfg.quiet ?? 32;                   // consecutive quiet NVB levels before a fan is dropped
  const G = 1;                                     // coverage sample spacing, px (pixel centres)
  const DELTA = 0.5;                               // octaves: commit lag of the coverage counter
  const MAXNODES = cfg.maxNodes ?? 3e6;
  const pattern = cfg.pattern || 'solid', cell = cfg.cell || 1;
  const guard = cfg.guard ?? 1;                    // cull against the view enlarged by this factor

  // ---------- vertices ----------
  let nv = 0, vcap = 1 << 14;
  let ZX = new Float64Array(vcap), ZY = new Float64Array(vcap), UX = new Float64Array(vcap), UY = new Float64Array(vcap);
  let PX = new Float64Array(vcap), PY = new Float64Array(vcap), PZ = new Float64Array(vcap);
  let WX = new Float64Array(vcap), WY = new Float64Array(vcap), WS = new Int8Array(vcap), LV = new Float64Array(vcap), LS = new Int8Array(vcap), PRI = new Int8Array(vcap);
  function vgrow() {
    const n = vcap * 2;
    const g = (a) => { const b = new a.constructor(n); b.set(a); return b; };
    ZX = g(ZX); ZY = g(ZY); UX = g(UX); UY = g(UY); PX = g(PX); PY = g(PY); PZ = g(PZ); WX = g(WX); WY = g(WY); WS = g(WS); LV = g(LV); LS = g(LS); PRI = g(PRI);
    vcap = n;
  }
  function inv(x, y) {
    if (x === 0 && y === 0) return [Infinity, Infinity];
    const m = Math.max(Math.abs(x), Math.abs(y)), xs = x / m, ys = y / m, q = xs * xs + ys * ys;
    return [xs / (m * q), -ys / (m * q)];
  }
  function newV(zx, zy, ux, uy, pri) {
    if (nv >= vcap) vgrow();
    const i = nv++;
    ZX[i] = zx; ZY[i] = zy; UX[i] = ux; UY[i] = uy; PRI[i] = pri; WS[i] = -1; LS[i] = -1;
    const p = [0, 0, 0];
    if (pri === 0) lift(zx, zy, p);
    else { const qu = ux * ux + uy * uy, d = 1 + qu; p[0] = 2 * ux / d; p[1] = -2 * uy / d; p[2] = (1 - qu) / d; }
    PX[i] = p[0]; PY[i] = p[1]; PZ[i] = p[2];
    return i;
  }
  const addZ = (x, y) => { const u = inv(x, y); return newV(x, y, u[0], u[1], (x * x + y * y <= 1) ? 0 : 1); };
  const addU = (x, y) => { const z = inv(x, y); return newV(z[0], z[1], x, y, (x * x + y * y < 1) ? 1 : 0); };
  // a point of the sphere (unit 3-vector) -> {z or u chart}, as a temporary complex z (for evaluation)
  function zOf3(X, Y, Z) {
    if (Z <= 0) { const d = 1 - Z; return C(X / d, Y / d); }
    const d = 1 + Z, z = inv(X / d, -Y / d); return C(z[0], z[1]);
  }
  function vOf3(X, Y, Z) {
    if (Z <= 0) { const d = 1 - Z; return addZ(X / d, Y / d); }
    const d = 1 + Z; return addU(X / d, -Y / d);
  }
  function mid3(i, j) {
    const x = PX[i] + PX[j], y = PY[i] + PY[j], z = PZ[i] + PZ[j], n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  }

  // ---------- evaluation ----------
  let nEval = 0, nProbe = 0, nLev = 0;
  const Hwin = Math.max(left.W, left.H) / 2 / left.s;
  const isFiniteW = (w) => w && Number.isFinite(w.re) && Number.isFinite(w.im) && Math.abs(w.re) < 1e300 && Math.abs(w.im) < 1e300;
  function Fz(z) { nEval++; try { return F(z); } catch (e) { return C(NaN, NaN); } }
  // limit probe at a vertex whose value is not finite: two rings (1e-6, 1e-9 of the local scale), lifted to the
  // image sphere; converged (inner ring tighter than 1e-5 chordal and not wider than the outer ring) -> FIN or INF
  function probe(i) {
    nProbe++;
    const rings = [];
    for (const eps of [1e-6, 1e-9]) {
      const ring = [];
      for (let k = 0; k < 6; k++) {
        const t = (k + 0.37) * TAU / 6, c = Math.cos(t), s = Math.sin(t);
        let z;
        if (PRI[i] === 1) {
          const au = Math.hypot(UX[i], UY[i]), su = (au > 0 ? au : 1 / (64 * Hwin)) * eps;
          const zz = inv(UX[i] + su * c, UY[i] + su * s); z = C(zz[0], zz[1]);
        } else {
          const az = Math.hypot(ZX[i], ZY[i]), sz = (az > 0 ? az : Hwin / 64) * eps;
          z = C(ZX[i] + sz * c, ZY[i] + sz * s);
        }
        const w = Fz(z);
        if (!w || Number.isNaN(w.re) || Number.isNaN(w.im)) return UNDEF;
        ring.push(lift(w.re, w.im, [0, 0, 0]));
      }
      rings.push(ring);
    }
    const spread = (r) => {
      let mx = 0, my = 0, mz = 0;
      for (const p of r) { mx += p[0]; my += p[1]; mz += p[2]; }
      const n = Math.hypot(mx, my, mz) || 1; const m = [mx / n, my / n, mz / n];
      let s = 0; for (const p of r) s = Math.max(s, chord3(p, m));
      return { s, m };
    };
    const a = spread(rings[0]), b = spread(rings[1]);
    if (!(b.s < 1e-5 && b.s <= a.s * 1.01 + 1e-12)) return UNDEF;
    const m = b.m;
    if (m[2] > 1 - 1e-9) return INF;
    const w = zOf3(m[0], m[1], m[2]);
    WX[i] = w.re; WY[i] = w.im;
    return FIN;
  }
  function evalF(i) {
    if (WS[i] >= 0) return WS[i];
    let w = null;
    if (SW) {   // LEAD: stage-wise, the vertex at infinity included; no source-level probe needed
      nEval++;
      w = Number.isFinite(ZX[i]) && Number.isFinite(ZY[i]) ? SW(C(ZX[i], ZY[i]), false) : SW(null, true);
      if (isFiniteW(w)) { WX[i] = w.re; WY[i] = w.im; WS[i] = FIN; return FIN; }
      WS[i] = Number.isNaN(w.re) ? UNDEF : INF;
      return WS[i];
    }
    if (Number.isFinite(ZX[i]) && Number.isFinite(ZY[i])) w = Fz(C(ZX[i], ZY[i]));
    if (isFiniteW(w)) { WX[i] = w.re; WY[i] = w.im; WS[i] = FIN; return FIN; }
    WS[i] = probe(i);
    return WS[i];
  }
  function levAt(z) { nLev++; let v; try { v = Lfun(z); } catch (e) { v = NaN; } return Number.isNaN(v) ? -Infinity : v; }
  function evalL(i) {
    if (LS[i] >= 0) return LS[i];
    if (Number.isFinite(ZX[i]) && Number.isFinite(ZY[i])) { LV[i] = levAt(C(ZX[i], ZY[i])); LS[i] = 0; return 0; }
    // at (or numerically at) infinity: the sign of the level on a small ring around it
    let pos = 0, neg = 0;
    for (let k = 0; k < 12; k++) {
      const t = (k + 0.37) * TAU / 12, su = 1e-9 / Hwin;
      const zz = inv(UX[i] + su * Math.cos(t), UY[i] + su * Math.sin(t));
      if (levAt(C(zz[0], zz[1])) > 0) pos++; else neg++;
    }
    if (!neg) { LV[i] = 1; LS[i] = 0; } else if (!pos) { LV[i] = -1; LS[i] = 0; } else { LV[i] = 0; LS[i] = UNDEF; }
    return LS[i];
  }

  // ---------- triangles (NVB forest) and edges ----------
  let nt = 0, tcap = 1 << 15;
  let TCM = new Int8Array(tcap), TA = new Int32Array(tcap), TB = new Int32Array(tcap), TC = new Int32Array(tcap), TCH = new Int32Array(tcap), TST = new Int8Array(tcap), TQ = new Int16Array(tcap), TD = new Float32Array(tcap), TLEV = new Int16Array(tcap);
  function tgrow() {
    const n = tcap * 2;
    const g = (a) => { const b = new a.constructor(n); b.set(a); return b; };
    TCM = g(TCM); TA = g(TA); TB = g(TB); TC = g(TC); TCH = g(TCH); TST = g(TST); TQ = g(TQ); TD = g(TD); TLEV = g(TLEV);
    tcap = n;
  }
  const BIG = 4194304;
  const ekey = (i, j) => (i < j ? i * BIG + j : j * BIG + i);
  const edges = new Map();            // key -> [t0, t1]
  const emid = new Map();             // key -> midpoint vertex
  const eclip = new Map();            // key -> clip vertex (level set crossing)
  function eAdd(i, j, t) { const k = ekey(i, j); const e = edges.get(k); if (!e) edges.set(k, [t, -1]); else if (e[0] < 0) e[0] = t; else e[1] = t; }
  function eRep(i, j, t0, t1) { const e = edges.get(ekey(i, j)); if (e[0] === t0) e[0] = t1; else e[1] = t1; }
  function eDel(i, j, t) {
    const k = ekey(i, j), e = edges.get(k);
    if (e[0] === t) e[0] = -1; else if (e[1] === t) e[1] = -1;
    if (e[0] < 0 && e[1] < 0) edges.delete(k);
  }
  function nbr(t, i, j) { const e = edges.get(ekey(i, j)); if (!e) return -1; return e[0] === t ? e[1] : e[0]; }
  function midV(i, j) {
    const k = ekey(i, j);
    let m = emid.get(k);
    if (m === undefined) { const p = mid3(i, j); m = vOf3(p[0], p[1], p[2]); emid.set(k, m); }
    return m;
  }
  function newT(a, b, c, st, lev, q) {
    if (nt >= tcap) tgrow();
    const t = nt++;
    TA[t] = a; TB[t] = b; TC[t] = c; TCH[t] = -1; TST[t] = st; TQ[t] = q; TLEV[t] = lev;
    TD[t] = depthOf(t);
    eAdd(a, b, t); eAdd(b, c, t); eAdd(c, a, t);
    if (st === PENDING) heapPush(t);
    return t;
  }
  // split leaf t at the midpoint m of its refinement edge (b, c): children (m, a, b) and (m, c, a)
  const finalLater = [];
  function split(t, m) {
    const a = TA[t], b = TB[t], c = TC[t];
    // a counted leaf that splits moves its chords: saturation decisions of its neighbours are revisited
    const revisit = TST[t] === FINAL && TCM[t] ? [nbr(t, a, b), nbr(t, b, c), nbr(t, c, a)] : null;
    eDel(a, b, t); eDel(b, c, t); eDel(c, a, t);
    const st = TST[t] === PENDING ? PENDING : TST[t];
    const t1 = newT(m, a, b, st, TLEV[t] + 1, TQ[t]), t2 = newT(m, c, a, st, TLEV[t] + 1, TQ[t]);
    TCH[t] = t1;
    if (st === FINAL) {
      evalF(m); evalL(m);
      if (TCM[t] && !INJ) {   // already counted: the children's coverage replaces the parent's
        for (const tri of trisOf(t)) rasterCov(tri, null, -1);
        for (const k of [t1, t2]) { TCM[k] = 1; for (const tri of trisOf(k)) rasterCov(tri); }
        for (const n of revisit) if (n >= 0 && TCH[n] < 0 && TST[n] === SAT) { TST[n] = PENDING; counts.revisit++; heapPush(n); }
      }
    }
    return [t1, t2];
  }
  // conforming bisection (recursive closure)
  function bisect(t) {
    if (TCH[t] >= 0) return;
    const b = TB[t], c = TC[t];
    let n = nbr(t, b, c);
    if (n >= 0) {
      const compatible = (TB[n] === b && TC[n] === c) || (TB[n] === c && TC[n] === b);
      if (!compatible) { bisect(n); n = nbr(t, b, c); }
    }
    const m = midV(b, c);
    split(t, m);
    if (n >= 0) split(n, m);
  }

  // ---------- metrics: left (source) view ----------
  const Lc = [left.cx, left.cy], Lhw = left.W / 2 / left.s, Lhh = left.H / 2 / left.s, LR = Math.hypot(Lhw, Lhh);
  const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
  function liftL(i, out) { return lift((ZX[i] - Lc[0]) / LR, (ZY[i] - Lc[1]) / LR, out); }
  function srcPx(t) {   // diameter in the window-centred chordal metric, in left px
    const v = [TA[t], TB[t], TC[t]], P = v.map((i) => liftL(i, [0, 0, 0]));
    const d = Math.max(chord3(P[0], P[1]), chord3(P[1], P[2]), chord3(P[2], P[0]));
    return d * LR * left.s / 2;
  }
  function cheb(i) { if (!Number.isFinite(ZX[i]) || !Number.isFinite(ZY[i])) return Infinity; return Math.max(Math.abs(ZX[i] - Lc[0]) / Lhw, Math.abs(ZY[i] - Lc[1]) / Lhh); }
  function depthOf(t) {
    const d = Math.min(cheb(TA[t]), cheb(TB[t]), cheb(TC[t]));
    const out = d > 1 ? Math.log2(d) : 0;
    const sp = srcPx(t);
    return out + (sp < P_REF ? Math.log2(P_REF / Math.max(sp, 1e-300)) : 0);
  }

  // ---------- metrics: image view ----------
  const VW = flat ? view.W : 0, VH = flat ? view.H : 0;
  const VR = flat ? Math.hypot(view.W, view.H) / 2 / view.s : 1;     // circumradius of the view, w units
  // image sample of a vertex / temp value: px coords (flat) or px-scaled 3D (sphere); null when unusable
  function smp(wx, wy, st, out) {
    if (flat) {
      if (st !== FIN) return null;
      out[0] = (wx - view.cx) * view.s + VW / 2; out[1] = (view.cy - wy) * view.s + VH / 2; out[2] = 0; return out;
    }
    if (st === UNDEF) return null;
    if (st === INF) { out[0] = 0; out[1] = 0; out[2] = view.R; return out; }
    lift(wx, wy, out); out[0] *= view.R; out[1] *= view.R; out[2] *= view.R; return out;
  }
  const vs = (i, out) => smp(WX[i], WY[i], WS[i], out);
  // the view-centred image sphere (flat views): lift of (w - c)/VR; the window disc is the southern hemisphere
  function liftV(wx, wy, st, out) {
    if (st === INF) { out[0] = 0; out[1] = 0; out[2] = 1; return out; }
    return lift((wx - view.cx) / VR, (wy - view.cy) / VR, out);
  }

  // ---------- coverage (saturation) ----------
  const GW = flat ? Math.ceil(VW / G) : 0, GH = flat ? Math.ceil(VH / G) : 0;
  // sphere: a longitude-latitude grid of ~G px cells on the globe
  const SNX = flat ? 0 : 2 ** Math.ceil(Math.log2(TAU * view.R / G)), SD = flat ? 0 : TAU / SNX, SNY = flat ? 0 : Math.ceil(Math.PI / SD);
  const NX = flat ? GW : SNX, NY = flat ? GH : SNY;
  const cov = new Uint8Array(NX * NY);
  let nU = cov.length;   // pixels still below KSAT
  // a pyramid of "cells below KSAT" counts (block sizes 2, 4, ...): saturation tests cost the outline, not the area
  const LMAX = Math.ceil(Math.log2(Math.max(NX, NY)));
  const pyr = [null], pnx = [NX], pny = [NY];
  for (let L = 1; L <= LMAX; L++) {
    const b = 1 << L, nx = Math.ceil(NX / b), ny = Math.ceil(NY / b), a = new Int32Array(nx * ny);
    for (let by = 0; by < ny; by++) for (let bx = 0; bx < nx; bx++) a[by * nx + bx] = (Math.min(NX, (bx + 1) * b) - bx * b) * (Math.min(NY, (by + 1) * b) - by * b);
    pyr.push(a); pnx.push(nx); pny.push(ny);
  }
  function bump(gx, gy, sgn) {
    const k = gy * NX + gx;
    if (cfg.tracePix === k) cfg.trace('bump', sgn, cov[k], curLeaf);
    if (sgn < 0) {   // a committed leaf that was split gives its count back (its children count instead)
      if (cov[k] === 0) return;
      if (cov[k]-- !== KSAT) return;
      nU++;
      for (let L = 1; L <= LMAX; L++) pyr[L][(gy >> L) * pnx[L] + (gx >> L)]++;
      return;
    }
    if (cov[k] >= 255) return;
    if (++cov[k] !== KSAT) return;
    nU--;
    for (let L = 1; L <= LMAX; L++) pyr[L][(gy >> L) * pnx[L] + (gx >> L)]--;
  }
  function sphLL(p) { const r = Math.hypot(p[0], p[1], p[2]); return [Math.atan2(p[1], p[0]), Math.asin(Math.max(-1, Math.min(1, p[2] / r)))]; }
  // committed triangles are counted CONSERVATIVELY: every sample within DIL of the triangle (the chords of two sheets
  // that share a rim differ by up to the chord tolerance; a far sheet's rim must not look uncovered there)
  const DIL = 0;
  function inTriD(P, x, y, d) {
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (!area) return false;
    const sg = area > 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      const a = P[k], b = P[(k + 1) % 3], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-300;
      if (((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) * sg < -d * L) return false;
    }
    return true;
  }
  function rasterCov(tri, excl, sgn = 1) { // tri: 3 samples (px space); excl: triangles not to count; sgn -1: uncount
    let P = tri, d = DIL, toCell, x0, x1, y0, y1;
    if (flat) {
      toCell = (gx, gy) => [(gx + 0.5) * G, (gy + 0.5) * G];
      x0 = Math.max(0, Math.floor((Math.min(P[0][0], P[1][0], P[2][0]) - d) / G)); x1 = Math.min(GW - 1, Math.floor((Math.max(P[0][0], P[1][0], P[2][0]) + d) / G));
      y0 = Math.max(0, Math.floor((Math.min(P[0][1], P[1][1], P[2][1]) - d) / G)); y1 = Math.min(GH - 1, Math.floor((Math.max(P[0][1], P[1][1], P[2][1]) + d) / G));
    } else {
      const ll = tri.map(sphLL);
      for (let k = 1; k < 3; k++) { while (ll[k][0] - ll[0][0] > Math.PI) ll[k][0] -= TAU; while (ll[k][0] - ll[0][0] < -Math.PI) ll[k][0] += TAU; }
      P = ll; d = DIL * SD;
      toCell = (gx, gy) => [(gx + 0.5) * SD - Math.PI, (gy + 0.5) * SD - Math.PI / 2];
      x0 = Math.floor((Math.min(P[0][0], P[1][0], P[2][0]) - d + Math.PI) / SD); x1 = Math.floor((Math.max(P[0][0], P[1][0], P[2][0]) + d + Math.PI) / SD);
      y0 = Math.max(0, Math.floor((Math.min(P[0][1], P[1][1], P[2][1]) - d + Math.PI / 2) / SD)); y1 = Math.min(SNY - 1, Math.floor((Math.max(P[0][1], P[1][1], P[2][1]) + d + Math.PI / 2) / SD));
      if (excl) excl = excl.map((E) => E.map((pp) => { const l = sphLL(pp); while (l[0] - P[0][0] > Math.PI) l[0] -= TAU; while (l[0] - P[0][0] < -Math.PI) l[0] += TAU; return l; }));
    }
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const [x, y] = toCell(gx, gy);
      if (!inTriD(P, x, y, d)) continue;
      if (excl && excl.some((E) => inTriD(E, x, y, d))) continue;
      bump(flat ? gx : ((gx % SNX) + SNX) % SNX, gy, sgn);
    }
  }
  // the tested zone of a saturation test, as a 1-Lipschitz function f (>= 0: test this sample): the outline P grown by
  // ex across its interior edges (the chords that would be drawn, and those of its descendants, lie within ex of it)
  // and shrunk by sh along its RIM edges (rim[i]: P[i] -> P[i+1] runs between two clip points, an image of the region's
  // boundary, where the chords of two sheets sharing the rim differ by up to the chord tolerance)
  function polyDist(P, x, y, rim, sh, ex) {
    let inside = false, fin = Infinity, dNon = Infinity, dRim = Infinity;
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      let t = L > 0 ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
      if (rim && rim[i]) { dRim = Math.min(dRim, d); fin = Math.min(fin, d - sh); } else { dNon = Math.min(dNon, d); fin = Math.min(fin, d + ex); }
    }
    // outside: within ex of an interior edge and nearer to it than to any rim edge (2-Lipschitz)
    return inside ? fin : Math.min(ex - dNon, dRim - dNon - sh);
  }
  // poly: the candidate's clipped image outline; saturated when every sample (pixel centre) inside it, away from its
  // rim edges by sh, already carries KSAT nearer layers. dev: the candidate's own chord deviation.
  function saturated(poly, rim, sh, dev) {
    const ex = dev + TAU_DEV + 0.05;
    let toX, toY, rB, P, cx0, cx1, cy0, cy1;
    if (flat) {
      P = poly; toX = (cx) => cx * G; toY = (cy) => cy * G; rB = (b) => b * G * 0.7072;
    } else {
      const ll = poly.map(sphLL);
      for (let k = 1; k < ll.length; k++) { while (ll[k][0] - ll[0][0] > Math.PI) ll[k][0] -= TAU; while (ll[k][0] - ll[0][0] < -Math.PI) ll[k][0] += TAU; }
      let my = 0, mx = 0, y0 = Infinity, y1 = -Infinity;
      for (const p of ll) { my += p[1] / ll.length; mx += p[0] / ll.length; y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      if (y1 > Math.PI / 2 - 4 * SD || y0 < -Math.PI / 2 + 4 * SD) return false;   // never across a pole (prototype)
      const cl = Math.cos(my) * view.R, R = view.R;
      P = ll.map((p) => [(p[0] - mx) * cl, p[1] * R]);
      toX = (cx) => (cx * SD - Math.PI - mx) * cl; toY = (cy) => (cy * SD - Math.PI / 2) * R; rB = (b) => b * SD * R * 0.7072;
      poly = ll.map((p) => [(p[0] + Math.PI) / SD, (p[1] + Math.PI / 2) / SD]);   // in cell units, for the bbox
    }
    cx0 = Infinity; cx1 = -Infinity; cy0 = Infinity; cy1 = -Infinity;
    for (const p of (flat ? poly.map((q) => [q[0] / G, q[1] / G]) : poly)) { cx0 = Math.min(cx0, p[0]); cx1 = Math.max(cx1, p[0]); cy0 = Math.min(cy0, p[1]); cy1 = Math.max(cy1, p[1]); }
    { const e = flat ? ex / G + 1 : ex / (SD * view.R * Math.max(0.05, Math.cos((cy0 + cy1) / 2 * SD - Math.PI / 2))) + 1; cx0 -= e; cx1 += e; cy0 -= (flat ? e : ex / (SD * view.R) + 1); cy1 += (flat ? e : ex / (SD * view.R) + 1); }
    let tested = 0;
    const idxX = (L, bx) => (flat ? bx : ((bx % pnx[L]) + pnx[L]) % pnx[L]);
    function rec(L, bx, by) {
      if (by < 0 || by >= pny[L]) return true;
      if (flat && (bx < 0 || bx >= pnx[L])) return true;
      const b = 1 << L, d = polyDist(P, toX((bx + 0.5) * b), toY((by + 0.5) * b), rim, sh, ex), r = rB(b);
      if (d + 2 * r < 0) return true;
      if (L === 0) { if (d < 0) return true; tested++; return cov[by * NX + idxX(0, bx)] >= KSAT; }
      if (d - 2 * r >= 0) { tested++; return pyr[L][by * pnx[L] + idxX(L, bx)] === 0; }
      return rec(L - 1, 2 * bx, 2 * by) && rec(L - 1, 2 * bx + 1, 2 * by) && rec(L - 1, 2 * bx, 2 * by + 1) && rec(L - 1, 2 * bx + 1, 2 * by + 1);
    }
    // clamp the box to the grid (one turn of longitude on the sphere)
    cy0 = Math.max(cy0, 0); cy1 = Math.min(cy1, NY - 1e-9);
    if (flat) { cx0 = Math.max(cx0, 0); cx1 = Math.min(cx1, NX - 1e-9); } else if (cx1 - cx0 > NX) cx1 = cx0 + NX;
    if (cx1 < cx0 || cy1 < cy0) return true;
    const span = Math.max(cx1 - cx0, cy1 - cy0, 1);
    const L = Math.min(LMAX, Math.ceil(Math.log2(span)));
    for (let by = Math.floor(cy0 / (1 << L)); by <= Math.floor(cy1 / (1 << L)); by++)
      for (let bx = Math.floor(cx0 / (1 << L)); bx <= Math.floor(cx1 / (1 << L)); bx++) if (!rec(L, bx, by)) return false;
    if (tested) return true;
    return dev <= TAU_DEV;   // covers no sample at all: invisible once its outline is accurate
  }
  // the clipped image outline of a leaf: vertices and edge midpoints inside the region, clip points where an edge
  // crosses its boundary; rim[i]: the edge P[i] -> P[i+1] runs between two clip points (the region's boundary)
  function imgPoly(t) {
    const v = [TA[t], TB[t], TC[t]], mids = [midV(v[0], v[1]), midV(v[1], v[2]), midV(v[2], v[0])];
    if (CUTS.length) { const lc = leafCut(v, mids); if (lc) return null; }
    for (const i of [...v, ...mids]) { evalL(i); if (LS[i] === UNDEF) return null; }
    const ins = v.map((i) => LV[i] > 0), insM = mids.map((i) => LV[i] > 0);
    const P = [], kind = [];
    const push = (i, k) => { if (evalF(i) !== FIN && !(!flat && WS[i] === INF)) return false; P.push(vs(i, S3())); kind.push(k); return true; };
    for (let k = 0; k < 3; k++) {
      const p = v[k], q = v[(k + 1) % 3], m = mids[k];
      if (ins[k] && !push(p, 0)) return null;
      if (ins[k] === ins[(k + 1) % 3]) {
        if (insM[k] !== ins[k]) return null;          // two crossings on one edge: not resolved yet
        if (ins[k] && !push(m, 0)) return null;
      } else if (!push(ins[k] ? clipV(p, q) : clipV(q, p), 1)) return null;
    }
    if (P.length < 3) return null;
    const rim = kind.map((k, i) => k === 1 && kind[(i + 1) % kind.length] === 1);
    return { P, rim };
  }
  // finalized leaves wait here (a min-heap by D) until the processing front has passed them by DELTA octaves
  const commitQ = []; let commitHead = 0;
  function commitPush(D, tris) {
    commitQ.push([D, tris]);
    let i = commitQ.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (commitQ[p][0] <= commitQ[i][0]) break; [commitQ[p], commitQ[i]] = [commitQ[i], commitQ[p]]; i = p; }
  }
  function commitUpTo(D) {
    while (commitQ.length && commitQ[0][0] < D - DELTA) {
      const top = commitQ[0], last = commitQ.pop();
      if (commitQ.length) {
        commitQ[0] = last;
        let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= commitQ.length) break; if (c + 1 < commitQ.length && commitQ[c + 1][0] < commitQ[c][0]) c++; if (commitQ[c][0] >= commitQ[i][0]) break; [commitQ[c], commitQ[i]] = [commitQ[i], commitQ[c]]; i = c; }
      }
      commitHead++;
      const st = [top[1]];
      while (st.length) {
        const u = st.pop();
        if (TCH[u] >= 0) { st.push(TCH[u], TCH[u] + 1); continue; }
        if (TST[u] !== FINAL) continue;
        TCM[u] = 1;
        if (!INJ) for (const tri of trisOf(u)) rasterCov(tri);
      }
    }
  }

  // ---------- heap (by depth D) ----------
  let hk = new Float64Array(1 << 15), hv = new Int32Array(1 << 15), hn = 0, hseq = 0;
  function heapPush(t) {
    if (hn >= hk.length) { const k2 = new Float64Array(hk.length * 2); k2.set(hk); hk = k2; const v2 = new Int32Array(hv.length * 2); v2.set(hv); hv = v2; }
    let i = hn++;
    const key = TD[t] + (hseq++) * 1e-12;
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= key) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
    hk[i] = key; hv[i] = t;
  }
  function heapPop() {
    const t = hv[0], last = --hn;
    if (last > 0) {
      const key = hk[last], val = hv[last];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= last) break;
        if (c + 1 < last && hk[c + 1] < hk[c]) c++;
        if (hk[c] >= key) break;
        hk[i] = hk[c]; hv[i] = hv[c]; i = c;
      }
      hk[i] = key; hv[i] = val;
    }
    return t;
  }

  // ---------- LEAD: catalog cut constraints ----------
  // Every ray cut of step k (p, angle) lives in the plane of stage k-1. For a source point, c = e^{-i ang} (G_{k-1} - p):
  // psi = Im c (side: psi > 0 '+', else '-': the closed side, whose values the cut takes), active where Re c > 0.
  // A leaf crossed cleanly by one cut is drawn as two pieces, each with the one-sided values of its side.
  const CUTS = [];
  if (SW && cfg.cuts !== false) cfg.steps.forEach((b, k) => { for (const c of b.cuts || []) if (c.kind === 'ray') CUTS.push({ k, p: c.p, e: C(Math.cos(c.ang), -Math.sin(c.ang)) }); });
  const NC = 8;
  const cutCache = new Map();
  function cutAtZ(z, zInf, j) {
    const cj = CUTS[j];
    const u = SW(z, zInf, cj.k);
    if (!Number.isFinite(u.re) || !Number.isFinite(u.im)) return [NaN, NaN];
    const dx = u.re - cj.p.re, dy = u.im - cj.p.im;
    return [cj.e.re * dy + cj.e.im * dx, cj.e.re * dx - cj.e.im * dy];   // [Im c, Re c]
  }
  function cutV(i, j) {
    const key = i * NC + j;
    let r = cutCache.get(key);
    if (!r) { const fin = Number.isFinite(ZX[i]) && Number.isFinite(ZY[i]); r = cutAtZ(fin ? C(ZX[i], ZY[i]) : null, !fin, j); cutCache.set(key, r); }
    return r;
  }
  const cut3 = (m, j) => { const z = zOf3(m[0], m[1], m[2]); return cutAtZ(z, !Number.isFinite(z.re) || !Number.isFinite(z.im), j); };
  const crossCache = new Map();
  // the crossing of cut j on the geodesic edge p -> q whose ends lie on different sides: {ok, pv (on p's side), qv}
  function crossing(p, q, j) {
    const key = ekey(p, q) * NC + j;
    let r = crossCache.get(key);
    if (r) return r.p === p ? r : { ok: r.ok, p, pv: r.qv, qv: r.pv };
    const sp = cutV(p, j)[0] > 0;
    let a = [PX[p], PY[p], PZ[p]], b = [PX[q], PY[q], PZ[q]], ca = cutV(p, j), cb = cutV(q, j);
    for (let it = 0; it < 52; it++) {
      const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z), m = [x / n, y / n, z / n];
      if (chord3(a, m) < 1e-16) break;
      const cm = cut3(m, j);
      if (Number.isNaN(cm[0])) { r = { ok: false, p, pv: -1, qv: -1 }; crossCache.set(key, r); return r; }
      if ((cm[0] > 0) === sp) { a = m; ca = cm; } else { b = m; cb = cm; }
    }
    const scale = Math.max(Math.hypot(ca[0], ca[1]), Math.hypot(cb[0], cb[1]), 1e-300);
    const ok = ca[1] > 0 && cb[1] > 0 && Math.abs(ca[0]) + Math.abs(cb[0]) <= 1e-6 * scale;
    r = { ok, p, pv: -1, qv: -1 };
    if (ok) { r.pv = vOf3(a[0], a[1], a[2]); r.qv = vOf3(b[0], b[1], b[2]); evalF(r.pv); evalF(r.qv); evalL(r.pv); evalL(r.qv); counts.cutBisect++; }
    crossCache.set(key, r);
    return r;
  }
  // null: no cut crosses the leaf; {dirty}: not a clean single crossing; {j, L, x1, x2}: the lone vertex L (index) is on
  // one side, edges L->L+1 and L+2->L are crossed (x1 = crossing(vL, vL+1), x2 = crossing(vL, vL+2))
  function leafCut(vid, mids) {
    if (!CUTS.length) return null;
    let found = null;
    for (let j = 0; j < CUTS.length; j++) {
      const sv = vid.map((i) => cutV(i, j));
      if (sv.some((x) => Number.isNaN(x[0]))) {
        // a stage before the cut has no finite value at a vertex: decided elsewhere (apex / probe); only a dirty
        // leaf if some other vertex is near this cut
        if (sv.some((x) => !Number.isNaN(x[0]) && x[1] > 0 && Math.abs(x[0]) < 1e-3 * Math.hypot(x[0], x[1]))) return { dirty: true };
        continue;
      }
      const sd = sv.map((x) => x[0] > 0);
      const crossed = [];
      for (let k = 0; k < 3; k++) {
        const p = vid[k], q = vid[(k + 1) % 3];
        if (sd[k] !== sd[(k + 1) % 3]) { if (crossing(p, q, j).ok) crossed.push(k); }
        else {
          const sm = cutV(mids[k], j);
          if (Number.isNaN(sm[0])) return { dirty: true };
          if ((sm[0] > 0) !== sd[k] && sm[1] > 0) return { dirty: true };   // double crossing on one edge
        }
      }
      if (!crossed.length) continue;
      if (crossed.length !== 2 || found) return { dirty: true };
      // the lone vertex: shared by the two crossed edges
      const L = crossed.includes(0) && crossed.includes(2) ? 0 : crossed.includes(0) ? 1 : 2;
      found = { j, L };
    }
    return found;
  }
  // the two pieces of a cleanly crossed leaf, as vertex polygons in the leaf's orientation (degenerate ones dropped)
  function cutPieces(vid, lc) {
    const L = lc.L, vL = vid[L], v1 = vid[(L + 1) % 3], v2 = vid[(L + 2) % 3];
    const c1 = crossing(vL, v1, lc.j), c2 = crossing(vL, v2, lc.j);   // pv: on vL's side
    const A = [vL, c1.pv, c2.pv], B = [c1.qv, v1, v2, c2.qv];
    return { A, B, c1, c2 };
  }
  const CUTP = new Map();   // FINAL leaf -> its piece triangles
  const fanTris = (P) => { const out = []; for (let k = 1; k + 1 < P.length; k++) out.push([P[0], P[k], P[k + 1]]); return out; };
  const srcArea = (tri) => { const a = [PX[tri[0]], PY[tri[0]], PZ[tri[0]]], b = [PX[tri[1]], PY[tri[1]], PZ[tri[1]]], c = [PX[tri[2]], PY[tri[2]], PZ[tri[2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); };
  function piecesOf(t, vid, lc) {
    const pc = cutPieces(vid, lc);
    const tris = [...fanTris(pc.A), ...fanTris(pc.B)];
    return tris.filter((tri) => srcArea(tri) > 1e-300 && tri.every((i) => WS[i] === FIN || (!flat && WS[i] === INF)));
  }
  // accuracy of a cleanly crossed leaf: 'ok' | 'cull' | 'split'
  function cutTest(t, vid, mids, lc) {
    const pc = cutPieces(vid, lc);
    const L = lc.L, sideL = cutV(vid[L], lc.j)[0] > 0;
    const pts = [...pc.A, ...pc.B];
    if (pts.some((i) => i < 0 || !vs(i, S3()))) return 'split';
    // samples: the uncrossed edge's midpoint, the midpoints of the four partial edges, the cut point near each chord
    const devAt = (i, j, wm) => { const P = vs(i, S3()), Q = vs(j, S3()); return Math.hypot(wm[0] - (P[0] + Q[0]) / 2, wm[1] - (P[1] + Q[1]) / 2, wm[2] - (P[2] + Q[2]) / 2); };
    const sampleMid = (i, j, side) => {
      const m = mid3(i, j), cm = cut3(m, lc.j);
      if (Number.isNaN(cm[0]) || (cm[0] > 0) !== side) return null;
      const z = zOf3(m[0], m[1], m[2]), w = Fz(z);
      return smp(w.re, w.im, isFiniteW(w) ? FIN : UNDEF, S3());
    };
    let dev = 0;
    const allS = [];
    const kOpp = (L + 1) % 3;   // the uncrossed edge: v1 -> v2
    { const m = vs(mids[kOpp], S3()); if (!m) return 'split'; dev = Math.max(dev, devAt(vid[(L + 1) % 3], vid[(L + 2) % 3], m)); allS.push(m); }
    for (const [i, j, side] of [[pc.A[0], pc.A[1], sideL], [pc.A[2], pc.A[0], sideL], [pc.B[0], pc.B[1], !sideL], [pc.B[2], pc.B[3], !sideL]]) {
      const m = sampleMid(i, j, side);
      if (!m) return 'split';
      dev = Math.max(dev, devAt(i, j, m)); allS.push(m);
    }
    // the cut between the two crossings: bisect from the geodesic midpoint of the chord toward a vertex on the other side
    let cdev = 0;
    {
      const m = mid3(pc.c1.pv, pc.c2.pv), cm = cut3(m, lc.j);
      if (Number.isNaN(cm[0])) return 'split';
      const sm = cm[0] > 0;
      const tgt = sm === sideL ? vid[(L + 1) % 3] : vid[L];
      let a = m, b = [PX[tgt], PY[tgt], PZ[tgt]];
      for (let it = 0; it < 52; it++) {
        const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z), q = [x / n, y / n, z / n];
        if (chord3(a, q) < 1e-16) break;
        const cq = cut3(q, lc.j);
        if (Number.isNaN(cq[0])) return 'split';
        if ((cq[0] > 0) === sm) a = q; else b = q;
      }
      const onL = sm === sideL ? a : b, onO = sm === sideL ? b : a;
      for (const [P3, i, j] of [[onL, pc.c1.pv, pc.c2.pv], [onO, pc.c1.qv, pc.c2.qv]]) {
        const w = Fz(zOf3(P3[0], P3[1], P3[2]));
        const S = smp(w.re, w.im, isFiniteW(w) ? FIN : UNDEF, S3());
        if (!S) return 'split';
        const A = vs(i, S3()), B = vs(j, S3());
        const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], LL = dx * dx + dy * dy + dz * dz;
        let s2 = LL > 0 ? ((S[0] - A[0]) * dx + (S[1] - A[1]) * dy + (S[2] - A[2]) * dz) / LL : 0;
        s2 = Math.max(0, Math.min(1, s2));
        cdev = Math.max(cdev, Math.hypot(S[0] - A[0] - s2 * dx, S[1] - A[1] - s2 * dy, S[2] - A[2] - s2 * dz));
        allS.push(S);
      }
    }
    // image edges of the pieces
    let emax = 0;
    for (const P of [pc.A, pc.B]) for (let k = 0; k < P.length; k++) { const a = vs(P[k], S3()), b = vs(P[(k + 1) % P.length], S3()); emax = Math.max(emax, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); allS.push(a); }
    if (flat) {   // both pieces off one side of the view (each tame): cull
      const M = Math.max(2, 0.5 * emax), gx = (guard - 1) * VW / 2, gy = (guard - 1) * VH / 2;
      const oc = (p) => (p[0] < -M - gx ? 1 : 0) | (p[0] > VW + M + gx ? 2 : 0) | (p[1] < -M - gy ? 4 : 0) | (p[1] > VH + M + gy ? 8 : 0);
      const offA = [...pc.A.map((i) => vs(i, S3())), allS[1], allS[2], allS[5]].reduce((c, p) => c & oc(p), 15);
      const offB = [...pc.B.map((i) => vs(i, S3())), allS[0], allS[3], allS[4], allS[6]].reduce((c, p) => c & oc(p), 15);
      if (offA && offB && dev <= 0.3 * emax) return 'cull';
    }
    return dev <= TAU_DEV && cdev <= TAU_BND && emax <= EBND ? 'ok' : 'split';
  }

  // ---------- clipping (marching triangles on the leaf, bisection on the shared edge) ----------
  function clipV(p, q) { // p inside (level > 0), q outside
    const k = ekey(p, q);
    let c = eclip.get(k);
    if (c !== undefined) return c;
    let a = [PX[p], PY[p], PZ[p]], b = [PX[q], PY[q], PZ[q]];
    for (let it = 0; it < 40; it++) {
      const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z), m = [x / n, y / n, z / n];
      if (levAt(zOf3(m[0], m[1], m[2])) > 0) a = m; else b = m;
    }
    const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z);
    c = vOf3(x / n, y / n, z / n);
    evalF(c); LV[c] = 0; LS[c] = 0;
    eclip.set(k, c);
    return c;
  }
  // -> array of vertex triples (the clipped polygon fanned), or [] when nothing is inside
  function clipLeaf(t) {
    const v = [TA[t], TB[t], TC[t]], ins = v.map((i) => LV[i] > 0);
    const n = ins.filter(Boolean).length;
    if (n === 3) return [v];
    if (n === 0) return [];
    const poly = [];
    for (let k = 0; k < 3; k++) {
      const p = v[k], q = v[(k + 1) % 3];
      if (ins[k]) poly.push(p);
      if (ins[k] !== ins[(k + 1) % 3]) poly.push(ins[k] ? clipV(p, q) : clipV(q, p));
    }
    const out = [];
    for (let k = 1; k + 1 < poly.length; k++) out.push([poly[0], poly[k], poly[k + 1]]);
    return out;
  }

  // ---------- pattern attributes (source side) ----------
  function patAttr(i, out) {
    let x = ZX[i], y = ZY[i];
    if (pattern === 'polar') {
      let lr, ar;
      if (PRI[i] === 1) { lr = -Math.log(Math.hypot(UX[i], UY[i])); ar = -Math.atan2(UY[i], UX[i]); }
      else { const r = Math.hypot(x, y); lr = Math.log(Math.max(r, 1e-300)); ar = Math.atan2(y, x); }
      out[0] = lr * 16 / TAU; out[1] = ar * 16 / TAU; return out;
    }
    out[0] = x / cell; out[1] = y / cell; return out;
  }
  function patTest(vid, mids, S, Smid) { // S: px samples of the 3 vertices, Smid of the 3 edge midpoints
    if (pattern === 'solid') return true;
    const g = vid.map((i) => patAttr(i, [0, 0])), gm = mids.map((i) => patAttr(i, [0, 0]));
    const unwrap = (a, ref) => { if (pattern !== 'polar') return a; while (a[1] - ref[1] > 8) a[1] -= 16; while (a[1] - ref[1] < -8) a[1] += 16; return a; };
    unwrap(g[1], g[0]); unwrap(g[2], g[0]);
    let eg = 0, gmax = 0, pmax = 0;
    for (let k = 0; k < 3; k++) {
      const p = g[k], q = g[(k + 1) % 3], m = unwrap(gm[k], p);
      eg = Math.max(eg, Math.hypot(m[0] - (p[0] + q[0]) / 2, m[1] - (p[1] + q[1]) / 2));
      gmax = Math.max(gmax, Math.hypot(q[0] - p[0], q[1] - p[1]));
      pmax = Math.max(pmax, Math.hypot(S[(k + 1) % 3][0] - S[k][0], S[(k + 1) % 3][1] - S[k][1], S[(k + 1) % 3][2] - S[k][2]));
    }
    if (!(gmax > 0)) return true;
    const pxPerCell = pmax / gmax;
    if (pxPerCell < 2) return true;   // moire zone: averaged by the shader
    return eg * pxPerCell <= TAU_PAT;
  }

  // ---------- leaf processing ----------
  const counts = { cutClip: 0, cutSplit: 0, cutDirty: 0, cutBisect: 0, processed: 0, split: 0, fanSplit: 0, final: 0, culled: 0, chordCull: 0, outside: 0, sat: 0, dropped: 0, gap: 0, floor: 0, quietDrop: 0, srcRes: 0, subpx: 0, bndSplit: 0, patSplit: 0, globalSat: 0, revisit: 0 };
  const S3 = () => [0, 0, 0];
  function sizeFloor(t) {
    const v = [TA[t], TB[t], TC[t]];
    const pri = PRI[v[0]];
    if (PRI[v[1]] !== pri || PRI[v[2]] !== pri) return Math.max(chord3([PX[v[0]], PY[v[0]], PZ[v[0]]], [PX[v[1]], PY[v[1]], PZ[v[1]]]), chord3([PX[v[0]], PY[v[0]], PZ[v[0]]], [PX[v[2]], PY[v[2]], PZ[v[2]]])) < 1e-13;
    const X = pri ? UX : ZX, Y = pri ? UY : ZY;
    let d = 0, m = 0;
    for (let k = 0; k < 3; k++) { const i = v[k], j = v[(k + 1) % 3]; d = Math.max(d, Math.hypot(X[i] - X[j], Y[i] - Y[j])); m = Math.max(m, Math.hypot(X[i], Y[i])); }
    return m < 1e-280 || d <= 1e-13 * m;
  }
  // a quick classification of a ring piece (non-fan child) for the quiet counter: true when it can add nothing
  function quiet(t) { const r = quiet0(t); if (cfg.qtrace) cfg.qtrace(t, r, quietWhy); return r; }
  let quietWhy = '';
  function quiet0(t) {
    quietWhy = '';
    const v = [TA[t], TB[t], TC[t]];
    for (const i of v) { evalL(i); if (LS[i] === UNDEF) { quietWhy = 'levUndef'; return false; } }
    const mids = [midV(v[0], v[1]), midV(v[1], v[2]), midV(v[2], v[0])];
    for (const i of mids) evalL(i);
    if ([...v, ...mids].every((i) => LV[i] <= 0)) return true;
    const S = [];
    const six = [v[0], mids[0], v[1], mids[1], v[2], mids[2]];
    for (const i of six) evalF(i);
    // LEAD: samples at infinity (flat views): the piece is quiet when its image, on the view-centred sphere, stays
    // in a chordal cap that misses the view (as the fan cull in processT)
    if (flat && six.some((i) => WS[i] === INF) && six.every((i) => WS[i] === FIN || WS[i] === INF)) {
      const P = six.map((i) => liftV(WX[i], WY[i], WS[i], S3()));
      let dia = 0, marg = Infinity;
      for (let x = 0; x < P.length; x++) {
        for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, chord3(P[x], P[y]));
        marg = Math.min(marg, P[x][2] > 0 ? 2 * Math.sin(Math.asin(Math.min(1, P[x][2])) / 2) : -1);
      }
      return marg > 1.5 * dia;
    }
    for (const i of six) { const s = vs(i, S3()); if (!s) { quietWhy = 'noSample:' + six.map((j) => WS[j]).join(''); return false; } S.push(s); }
    if (flat) {
      const M = 2, oc = (p) => (p[0] < -M - (guard - 1) * VW / 2 ? 1 : 0) | (p[0] > VW + M + (guard - 1) * VW / 2 ? 2 : 0) | (p[1] < -M - (guard - 1) * VH / 2 ? 4 : 0) | (p[1] > VH + M + (guard - 1) * VH / 2 ? 8 : 0);
      let code = 15;
      for (const p of S) code &= oc(p);
      if (code) return true;
    }
    let dmax = 0;
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) dmax = Math.max(dmax, Math.hypot(S[a][0] - S[b][0], S[a][1] - S[b][1], S[a][2] - S[b][2]));
    if (dmax < 0.5) return true;
    let dv = 0;
    for (let k = 0; k < 3; k++) { const p = S[2 * k], m = S[2 * k + 1], q = S[(2 * k + 2) % 6]; dv = Math.max(dv, Math.hypot(m[0] - (p[0] + q[0]) / 2, m[1] - (p[1] + q[1]) / 2, m[2] - (p[2] + q[2]) / 2)); }
    if (dv > 0.25 * dmax) { quietWhy = 'wild'; return false; }
    if (INJ) { quietWhy = 'inj-visible'; return false; }
    const ip = imgPoly(t);
    return !INJ && !!ip && saturated(ip.P, ip.rim, dv + 0.5, dv);
  }
  function fanSplit(t) {
    const q = TQ[t];
    bisect(t);
    counts.fanSplit++;
    // the children (and any closure splits) are queued; set the quiet counters of the children that touch an apex
    const kids = [TCH[t], TCH[t] + 1];
    // LEAD: ring pieces are the children that do not touch a point WITHOUT a value (UNDEF image or level); pieces that
    // touch only INF vertices are judged by quiet() with the chordal cap test
    const isHard = (i) => WS[i] === UNDEF || LS[i] === UNDEF;
    const ring = kids.filter((k) => ![TA[k], TB[k], TC[k]].some(isHard));
    let qn = q;
    if (ring.length) qn = ring.every(quiet) ? q + 1 : 0;
    for (const k of kids) TQ[k] = qn;
  }
  const jumpCache = new Map();
  function isJump(i, j) {
    const k = ekey(i, j);
    let r = jumpCache.get(k);
    if (r !== undefined) return r;
    let a = [PX[i], PY[i], PZ[i]], b = [PX[j], PY[j], PZ[j]];
    let wa = vs(i, S3()), wb = vs(j, S3());
    r = true;
    for (let it = 0; it < 60; it++) {
      const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z), m = [x / n, y / n, z / n];
      if (Math.hypot(a[0] - m[0], a[1] - m[1], a[2] - m[2]) < 1e-15) break;
      const w = Fz(zOf3(m[0], m[1], m[2]));
      const wm = smp(w.re, w.im, isFiniteW(w) ? FIN : UNDEF, S3());
      if (!wm) break;
      const da = Math.hypot(wm[0] - wa[0], wm[1] - wa[1], wm[2] - wa[2]), db = Math.hypot(wm[0] - wb[0], wm[1] - wb[1], wm[2] - wb[2]);
      if (da >= db) { b = m; wb = wm; } else { a = m; wa = wm; }
      if (Math.hypot(wa[0] - wb[0], wa[1] - wb[1], wa[2] - wb[2]) <= 1) { r = false; break; }
    }
    jumpCache.set(k, r);
    return r;
  }
  function processT(t) {
    counts.processed++;
    const a = TA[t], b = TB[t], c = TC[t];
    const vid = [a, b, c];
    const mids = [midV(a, b), midV(b, c), midV(c, a)];
    // ---- region ----
    let regionApex = false;
    for (const i of vid) if (evalL(i) === UNDEF) regionApex = true;
    for (const i of mids) evalL(i);
    if (!regionApex) {
      const lv = [...vid, ...mids].map((i) => LV[i]);
      const allOut = lv.every((x) => x <= 0), allIn = lv.every((x) => x > 0);
      let diam = 0;
      for (let k = 0; k < 3; k++) { const i = vid[k], j = vid[(k + 1) % 3]; diam = Math.max(diam, Math.hypot(ZX[i] - ZX[j], ZY[i] - ZY[j])); }
      const near = distLike ? Math.min(...lv.map(Math.abs)) < diam : !(allIn || allOut);
      if (near && srcPx(t) > P_SRC) { counts.srcRes++; counts.split++; bisect(t); return; }
      if (allOut) { TST[t] = OUTSIDE; counts.outside++; return; }
    }
    // ---- images ----
    for (const i of vid) evalF(i);
    const isApex = (i) => WS[i] === UNDEF || (flat && WS[i] === INF) || LS[i] === UNDEF;
    const apex = vid.filter(isApex);
    if (apex.length) {
      if (sizeFloor(t)) { TST[t] = DROPPED; counts.floor++; return; }
      if (TQ[t] >= QUIET) { TST[t] = DROPPED; counts.quietDrop++; return; }
      // samples off the apex: the other vertices, the midpoints of all edges (toward the apex too)
      for (const i of mids) evalF(i);
      const others = [...vid, ...mids].filter((i) => !isApex(i));
      const allInf = apex.every((i) => WS[i] === INF);
      if (flat && allInf && others.every((i) => WS[i] === FIN || WS[i] === INF)) {
        // pole / limit infinity: chordal cull on the view-centred image sphere (the apex at its north pole)
        const P = others.map((i) => liftV(WX[i], WY[i], WS[i], S3()));
        P.push([0, 0, 1]);
        // (INF samples lift to the north pole too)
        let dia = 0, marg = Infinity;
        for (let x = 0; x < P.length; x++) {
          for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, chord3(P[x], P[y]));
          marg = Math.min(marg, P[x][2] > 0 ? 2 * Math.sin(Math.asin(Math.min(1, P[x][2])) / 2) : -1);
        }
        if (marg > 1.5 * dia) { TST[t] = CULLED; counts.chordCull++; counts.culled++; return; }
      }
      if (apex.every((i) => WS[i] === FIN || (!flat && WS[i] === INF))) {
        // image defined at the apex, only the region is undecided there (e.g. infinity on the boundary of H): stop
        // once the fan's image is sub-pixel
        const P = [...vid, ...mids].map((i) => vs(i, S3())).filter(Boolean);
        let dia = 0;
        for (let x = 0; x < P.length; x++) for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, Math.hypot(P[x][0] - P[y][0], P[x][1] - P[y][1], P[x][2] - P[y][2]));
        if (P.length === 6 && dia < 0.5) { TST[t] = DROPPED; counts.subpx++; return; }
      }
      fanSplit(t);
      return;
    }
    for (const i of mids) evalF(i);
    if (mids.some((i) => WS[i] !== FIN && !(!flat && WS[i] === INF))) {
      if (sizeFloor(t)) { TST[t] = DROPPED; counts.floor++; return; }
      counts.split++; bisect(t); return;
    }
    // ---- LEAD: catalog cuts ----
    if (CUTS.length) {
      const lc = leafCut(vid, mids);
      const allIn = [...vid, ...mids].every((i) => LV[i] > 0);
      if (lc && !lc.dirty && allIn) {
        const r = cutTest(t, vid, mids, lc);
        if (r === 'ok') { CUTP.set(t, piecesOf(t, vid, lc)); counts.cutClip++; finalize(t); return; }
        if (r === 'cull') { TST[t] = CULLED; counts.culled++; return; }
        if (sizeFloor(t)) { TST[t] = DROPPED; counts.floor++; return; }
        counts.split++; counts.cutSplit++; bisect(t); return;
      }
      // dirty (odd crossings, two cuts, a cut meeting the boundary): the generic path below (bisect, then the
      // sub-pixel gap rule)
      if (lc && lc.dirty) counts.cutDirty++;
    }
    // ---- samples ----
    const S = vid.map((i) => vs(i, S3())), Sm = mids.map((i) => vs(i, S3()));
    const g3 = (() => { const x = PX[a] + PX[b] + PX[c], y = PY[a] + PY[b] + PY[c], z = PZ[a] + PZ[b] + PZ[c], n = Math.hypot(x, y, z); return zOf3(x / n, y / n, z / n); })();
    const wg = Fz(g3);
    const gst = isFiniteW(wg) ? FIN : (wg && (Math.abs(wg.re) === Infinity || Math.abs(wg.im) === Infinity) ? INF : UNDEF);
    const Sg = smp(wg ? wg.re : NaN, wg ? wg.im : NaN, gst, S3());
    if (!Sg) { if (sizeFloor(t)) { TST[t] = DROPPED; counts.floor++; return; } counts.split++; bisect(t); return; }
    const all = [...S, ...Sm, Sg];
    let emax = 0, dev = 0;
    for (let k = 0; k < 3; k++) {
      const p = S[k], q = S[(k + 1) % 3], m = Sm[k];
      emax = Math.max(emax, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
      dev = Math.max(dev, Math.hypot(m[0] - (p[0] + q[0]) / 2, m[1] - (p[1] + q[1]) / 2, m[2] - (p[2] + q[2]) / 2));
    }
    dev = Math.max(dev, Math.hypot(Sg[0] - (S[0][0] + S[1][0] + S[2][0]) / 3, Sg[1] - (S[0][1] + S[1][1] + S[2][1]) / 3, Sg[2] - (S[0][2] + S[1][2] + S[2][2]) / 3));
    // ---- cull (flat): off one side of the (guarded) view, tame ----
    if (flat) {
      const M = Math.max(2, 0.5 * emax);
      const gx = (guard - 1) * VW / 2, gy = (guard - 1) * VH / 2;
      const oc = (p) => (p[0] < -M - gx ? 1 : 0) | (p[0] > VW + M + gx ? 2 : 0) | (p[1] < -M - gy ? 4 : 0) | (p[1] > VH + M + gy ? 8 : 0);
      let code = 15;
      for (const p of all) code &= oc(p);
      if (code && dev <= 0.3 * emax) { TST[t] = CULLED; counts.culled++; return; }
      // chordal cull (the image surrounds infinity, not the window)
      const P = [...vid, ...mids].map((i) => liftV(WX[i], WY[i], WS[i], S3()));
      P.push(liftV(wg.re, wg.im, gst, S3()));
      let dia = 0, marg = Infinity;
      for (let x = 0; x < P.length; x++) {
        for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, chord3(P[x], P[y]));
        marg = Math.min(marg, P[x][2] > 0 ? 2 * Math.sin(Math.asin(Math.min(1, P[x][2])) / 2) : -1);
      }
      if (marg > 1.5 * dia && guard <= 1) { TST[t] = CULLED; counts.chordCull++; counts.culled++; return; }
    }
    // ---- sub-pixel leaf / sub-pixel gap (a jump across a cut) ----
    {
      const d3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      let dmax = 0;
      for (let x = 0; x < all.length; x++) for (let y = x + 1; y < all.length; y++) dmax = Math.max(dmax, d3(all[x], all[y]));
      if (dmax < 0.5) { finalize(t); counts.subpx++; return; }
      // every edge either sub-pixel or a jump (its midpoint sits on one end), at least one jump, the centroid on a
      // vertex: the leaf is sub-pixel blobs around its vertices with a discontinuity between them -> drop it
      let jumps = 0, okGap = true;
      for (let k = 0; k < 3 && okGap; k++) {
        const p = S[k], q = S[(k + 1) % 3], m = Sm[k];
        if (d3(p, q) <= 0.5 && d3(m, p) <= 0.5) continue;
        if (Math.min(d3(m, p), d3(m, q)) <= 0.5) jumps++; else okGap = false;
      }
      if (okGap && jumps && Math.min(d3(Sg, S[0]), d3(Sg, S[1]), d3(Sg, S[2])) <= 0.5) {
        // confirm every jump by bisection on the edge: a discontinuity keeps its gap down to the precision floor, a
        // steep but continuous map (exp far to the left) closes it
        let real = true;
        for (let k = 0; k < 3 && real; k++) {
          const p = S[k], q = S[(k + 1) % 3];
          if (d3(p, q) <= 0.5) continue;
          real = isJump(vid[k], vid[(k + 1) % 3]);
        }
        if (real) { TST[t] = DROPPED; counts.gap++; return; }
        if (dmax <= 1.5) { finalize(t); counts.subpx++; return; }   // a jump under a pixel: draw the smear
      }
    }
    // ---- global saturation: every pixel of the view already carries K nearer layers ----
    // ---- saturation ----
    if (!INJ && TD[t] > DELTA && dev <= 0.25 * emax) {
      const ip = imgPoly(t);
      if (ip && saturated(ip.P, ip.rim, dev + 0.5, dev)) { TST[t] = SAT; counts.sat++; if (cfg.trace) cfg.trace('sat', t, ip, cov); return; }
    }
    // ---- accuracy ----
    let ok = dev <= TAU_DEV && emax <= EMAX;
    if (ok && !patTest(vid, mids, S, Sm)) { ok = false; counts.patSplit++; }
    if (ok) {
      const lv = vid.map((i) => LV[i]);
      const mixed = lv.some((x) => x > 0) && lv.some((x) => x <= 0);
      if (mixed) {
        // a midpoint whose sign differs from both ends of its edge: two crossings on one edge -> refine
        for (let k = 0; k < 3; k++) { const p = lv[k] > 0, q = lv[(k + 1) % 3] > 0, m = LV[mids[k]] > 0; if (p === q && m !== p) { ok = false; break; } }
        if (ok && emax > EBND) ok = false;
        if (ok) ok = bndTest(t);
        if (!ok) counts.bndSplit++;
      }
    }
    if (ok) { finalize(t); return; }
    if (sizeFloor(t)) { TST[t] = DROPPED; counts.floor++; return; }
    counts.split++;
    bisect(t);
  }
  function bndTest(t) {
    const v = [TA[t], TB[t], TC[t]], ins = v.map((i) => LV[i] > 0);
    const cl = [];
    for (let k = 0; k < 3; k++) if (ins[k] !== ins[(k + 1) % 3]) cl.push(ins[k] ? clipV(v[k], v[(k + 1) % 3]) : clipV(v[(k + 1) % 3], v[k]));
    if (cl.length !== 2) return true;
    if (WS[cl[0]] !== FIN && !(!flat && WS[cl[0]] === INF)) return false;
    if (WS[cl[1]] !== FIN && !(!flat && WS[cl[1]] === INF)) return false;
    // the boundary point near the middle of the clip chord: bisection from that point toward a vertex of the other sign
    const m = mid3(cl[0], cl[1]);
    const zm = zOf3(m[0], m[1], m[2]);
    const sIn = levAt(zm) > 0;
    const k = ins.findIndex((x) => x !== sIn);
    let pa = m, pb = [PX[v[k]], PY[v[k]], PZ[v[k]]];
    for (let it = 0; it < 30; it++) {
      const x = pa[0] + pb[0], y = pa[1] + pb[1], z = pa[2] + pb[2], n = Math.hypot(x, y, z), q = [x / n, y / n, z / n];
      if ((levAt(zOf3(q[0], q[1], q[2])) > 0) === sIn) pa = q; else pb = q;
    }
    const w = Fz(zOf3(pa[0], pa[1], pa[2]));
    const st = isFiniteW(w) ? FIN : UNDEF;
    const P = smp(w.re, w.im, st, S3());
    if (!P) return false;
    const A = vs(cl[0], S3()), B = vs(cl[1], S3());
    // distance from P to the segment AB
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = dx * dx + dy * dy + dz * dz;
    let s = L > 0 ? ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy + (P[2] - A[2]) * dz) / L : 0;
    s = Math.max(0, Math.min(1, s));
    return Math.hypot(P[0] - A[0] - s * dx, P[1] - A[1] - s * dy, P[2] - A[2] - s * dz) <= TAU_BND;
  }
  function leafTris(t) {
    if (CUTS.length && TST[t] === FINAL) {
      if (CUTP.has(t)) return CUTP.get(t);
      const vid = [TA[t], TB[t], TC[t]];
      if (vid.every((i) => LV[i] > 0)) {
        const mids = [midV(vid[0], vid[1]), midV(vid[1], vid[2]), midV(vid[2], vid[0])];
        for (const i of mids) { evalL(i); }
        const lc = leafCut(vid, mids);
        if (lc && lc.dirty) return [];
        if (lc) { const r = piecesOf(t, vid, lc); CUTP.set(t, r); return r; }
      }
    }
    return clipLeaf(t);
  }
  function trisOf(t) {
    const out = [];
    for (const tri of leafTris(t)) {
      const P = tri.map((i) => vs(i, S3()));
      if (P.every(Boolean)) out.push(P);
    }
    return out;
  }
  function finalize(t) {
    TST[t] = FINAL; counts.final++;
    commitPush(TD[t], t);
  }

  // ---------- base: the octahedron (poles 0 and infinity, equator |z| = 1) ----------
  function init() {
    const S = addZ(0, 0), N = addU(0, 0);
    const E = [addZ(1, 0), addZ(0, 1), addZ(-1, 0), addZ(0, -1)];
    for (let k = 0; k < 4; k++) {
      newT(S, E[k], E[(k + 1) % 4], PENDING, 0, 0);
      newT(N, E[(k + 1) % 4], E[k], PENDING, 0, 0);
    }
  }

  function run(budgetMs = Infinity) {
    const t0 = performance.now();
    init();
    let n = 0;
    while (hn > 0) {
      const t = heapPop();
      if (TCH[t] >= 0 || TST[t] !== PENDING) continue;
      commitUpTo(TD[t]);
      if (nU === 0) {   // every pixel carries K nearer layers: nothing still pending can show
        TST[t] = SAT; counts.globalSat++;
        while (hn > 0) { const u = heapPop(); if (TCH[u] < 0 && TST[u] === PENDING) { TST[u] = SAT; counts.globalSat++; } }
        break;
      }
      curLeaf = t;
      processLeaf(t);
      // children of FINAL leaves split by closure: their own clipping is rebuilt at output time
      finalLater.length = 0;
      if (nt > MAXNODES) { stats.budgetHit = true; break; }
      if ((++n & 1023) === 0 && performance.now() - t0 > budgetMs) { stats.budgetHit = true; break; }
    }
    stats.ms = performance.now() - t0;
    return stats;
  }
  const processLeaf = processT;
  const stats = { counts, budgetHit: false };
  var curLeaf = -1;

  // ---------- output ----------
  // every FINAL leaf, clipped: {w: [[x,y] x3], z: [[x,y] x3] (source, for attributes), D, ys (sort key)}
  function output() {
    const out = [];
    for (let t = 0; t < nt; t++) {
      if (TCH[t] >= 0 || TST[t] !== FINAL) continue;
      for (const tri of leafTris(t)) {
        if (!tri.every((i) => WS[i] === FIN || (!flat && WS[i] === INF))) continue;
        out.push({ v: tri, leaf: t, D: TD[t] });
      }
    }
    return out;
  }
  function leafStates() {
    const s = { final: 0, culled: 0, outside: 0, saturated: 0, dropped: 0, pending: 0 };
    for (let t = 0; t < nt; t++) if (TCH[t] < 0) s[STATE_NAMES[TST[t]]]++;
    return s;
  }
  function summary() {
    return { nodes: nt, verts: nv, evals: nEval, probes: nProbe, stepProbes: SW ? SW.stepProbes : 0, levels: nLev, K, leaves: leafStates() };
  }
  return {
    run, stats, output, summary, cov: () => ({ cov, nU, NX, NY, commitHead, commitLen: commitQ.length + commitHead }),
    // accessors for the measurement code
    V: () => ({ ZX, ZY, UX, UY, PX, PY, PZ, WX, WY, WS, PRI, LV }), T: () => ({ TA, TB, TC, TCH, TST, TD, nt }),
    F, view, left, patAttr, Fz, zOf3, mid3, vs,
  };
}

module.exports = { Mesher, lift, FIN, INF, UNDEF, FINAL, stagewise, atInfOf, probeStep };

'use strict';
// The forward fallback (notes/sphere-design/SPEC.md section 8, phase P5): SphereMesh, the sphere-native NVB mesher.
//
// The source region is a subset of the Riemann sphere. A base octahedron (poles 0 and infinity, equator |z| = 1) is
// refined CONFORMINGLY by newest-vertex bisection (NVB) with geodesic edge midpoints; every decision is made on the CPU
// in float64 in the IMAGE metric of the view that shows the map (flat: device px; globe: chordal px on the globe).
// Vertices where F has no limit (UNDEF) are never used: the triangles touching them ("fans") are refined toward them
// until culled, saturated (infinitely many sheets) or quiet; poles and limits at infinity (INF) are culled chordally
// in flat views and are ordinary vertices on the globe. Leaves are clipped by the region's level set (marching
// triangles, bisection on the shared edge) and published as CPU pre-mapped triangles (8.7), far to near.
//
// A port of the lead prototype notes/proto/lead/sphm_lead.js (sphere-native plus stage-wise limits and catalog cut
// constraints) with: a resumable step(ms) (the app runs it in 5 ms idle slices), the 8.4 budgets made deterministic
// (nodes and map evaluations, SphereMesh.APP; a CPU-time stop only as a safety net; at expiry the pending leaves with a
// chord deviation <= 2 px are drawn), a guard band (flat views:
// culling against the view enlarged 3x, coverage counted on a second, 3 px grid over the band, so pans within the band
// show the same sheets), the frozen output layout of 8.7 and the per-pattern attributes the 'pre' programs read.
//
// SphereMesh.create(cfg) -> mesh; cfg:
//   steps: built steps of the range (b.f, b.def, b.vals, b.cuts) for stage-wise limits, or null with F (a homotopy
//          frame, a chain with d/dz: limits by a probe at the source)
//   F: the CPU map (used when steps is null)
//   injective: no saturation (Funcs.composeProps(...).injective)
//   shape: a Region area shape
//   left: {cx, cy, s, W, H}: the meshing window (clipWin) and its scale (px per unit of the source view)
//   view: {kind: 'flat', cx, cy, s, W, H, guard} (device px) | {kind: 'sphere', R} (globe radius, device px)
//   Kmax: the saturation K (SphereMesh.kOf(min alpha)); pattern: {id, cell} (gl.js PATTERNS ids)
//   depth (optional): z -> the sheet key D of a source point (Inverse.sheetKey); a leaf's depth, which orders the
//          refinement and decides which K layers saturate a pixel, is then the least key of its vertices, so the kept
//          layers are the ones that key puts in front (a drawing that orders its fragments by it)
//   maxWork (evaluations; deterministic), maxNodes (300000), budgetMs (1500: a safety stop in CPU ms; the app passes
//   a large one, so its meshes do not depend on the machine's load)
// mesh.step(ms) -> {done, partial}; mesh.publish() -> data (8.7); mesh.stats(), mesh.bytes(), mesh.dispose()
const SphereMesh = (() => {
  const { C } = CX;
  const TAU = 2 * Math.PI;
  const FIN = 0, INF = 1, UNDEF = 2;                                 // vertex image status
  const PENDING = 0, FINAL = 1, CULLED = 2, OUTSIDE = 3, SAT = 4, DROPPED = 5;
  const STATE_NAMES = ['pending', 'final', 'culled', 'outside', 'saturated', 'dropped'];
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // which source coordinates a pattern reads (gl.js PATTERNS: 0 solid, 1 checker, 2 polar (conformal checker), 3 tiles,
  // 4 graph paper, 5 polar web, 6 source phase, 7 area scale, 8 sphere checker): 'cart' g = z / cell, 'polar'
  // (ln |z|, arg z) * 16 / tau, both, or nothing (solid without lines)
  const PAT_POLAR = new Set([2, 5, 6, 8]);
  const PAT_CART = new Set([1, 3, 4, 7]);
  // saturation K for an alpha: the number of layers after which less than 1/255 shows through. Capped at KCAP = 32,
  // above the 25 of the UI's lowest opacity (0.2), so 1 - (1 - alpha)^K >= 0.996 for every alpha the UI allows (the
  // earlier cap of 16 left 1 - 0.8^16 = 0.972 at alpha 0.2, below the 12.4 target opacity_min >= 0.99)
  const KCAP = 32;
  const kOf = (alpha) => (alpha >= 1 ? 1 : Math.min(KCAP, Math.max(1, Math.ceil(Math.log(1 / 255) / Math.log(1 - Math.max(1e-3, alpha))))));

  // robust stereographic lift of x + iy onto the unit sphere (0 -> south pole, infinity -> north pole); internal
  // metric only (the published globe positions use the app's conjugate lift, liftConj)
  function lift(x, y, out) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { out[0] = 0; out[1] = 0; out[2] = 1; return out; }
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (m <= 1) {
      const q = x * x + y * y, d = 1 + q;
      out[0] = 2 * x / d; out[1] = 2 * y / d; out[2] = (q - 1) / d;
    } else {
      const xs = x / m, ys = y / m, qs = xs * xs + ys * ys;
      const ux = xs / (m * qs), uy = -ys / (m * qs), qu = ux * ux + uy * uy, d = 1 + qu;
      out[0] = 2 * ux / d; out[1] = -2 * uy / d; out[2] = (1 - qu) / d;
    }
    return out;
  }
  // the app's conjugate lift (panels.md 9.0; GLSL lift): P(w) = (2x, -2y, |w|^2 - 1) / (|w|^2 + 1)
  function liftConj(x, y, out) { lift(x, y, out); out[1] = -out[1]; return out; }
  const chord3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  // ---------- stage-wise evaluation on the Riemann sphere (lead graft, SPEC 8.4) ----------
  // The limit of every step at infinity: {k: FIN, w} | {k: INF} | {k: UNDEF}. Catalog table; custom formulas and
  // anything unknown: a numeric probe.
  function atInfOf(b) {
    const id = b.def && b.def.id, v = b.vals || {};
    const fin = (w) => ({ k: FIN, w }), inf = { k: INF }, und = { k: UNDEF };
    switch (id) {
      case 'mul': case 'add': case 'affine': case 'conj': case 'joukowski': case 'root': case 'log': return inf;
      case 'recip': return fin(C(0, 0));
      case 'mobius': case 'blaschke': {
        const f = b.f(C(1e154, 1e154)), g = b.f(C(-1e154, 3e153));
        if (CX.isFin(f) && CX.isFin(g) && CX.abs(CX.sub(f, g)) < 1e-9 * (1 + CX.abs(f))) return fin(f);
        return inf;
      }
      case 'pown': return v.n > 0 ? inf : v.n < 0 ? fin(C(0, 0)) : fin(C(1, 0));
      case 'powa': { const a = v.alpha; return !a ? und : a.re > 0 ? inf : a.re < 0 ? fin(C(0, 0)) : und; }
      case 'exp': case 'sin': case 'cos': case 'tan': case 'sinh': case 'cosh': case 'tanh': case 'arctan': case 'artanh': return und;
      case 'arcsin': case 'arccos': case 'arsinh': case 'arcosh': return inf;
      case 'zp': {
        // a ∏(z − ζ)/∏(z − p): ∞ when there are more zeros, a when as many, 0 when fewer (a constant: its value)
        const zp = b.zp;
        if (!zp || (b.props && b.props.constant)) break;
        const nz = zp.zeros.length, np = zp.poles.length;
        return nz > np ? inf : nz === np ? fin(zp.a) : fin(C(0, 0));
      }
    }
    return probeStep(b.f, null);
  }
  // the limit of a single map f at the point u of its input plane (u = null: at infinity), from two rings (radii
  // 1e-6 and 1e-9 relative to |u|; absolute 1e-3 * eps at u = 0)
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
  // F as a chain of steps evaluated stage by stage on the sphere: an overflowing step hands infinity to the next one
  // (its limit at infinity); a step that is not finite at a finite input is classified by a probe of that step alone
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
        if (v && Number.isFinite(v.re) && Number.isFinite(v.im) && Math.abs(v.re) < 1e300 && Math.abs(v.im) < 1e300) { w = v; continue; }
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

  function create(cfg) {
    const SW = cfg.steps && cfg.steps.length ? stagewise(cfg.steps) : null;
    const F = SW ? (z) => SW(z, !Number.isFinite(z.re) || !Number.isFinite(z.im)) : (cfg.F || ((z) => z));
    const INJ = !!cfg.injective;
    const shape = cfg.shape;
    const Lfun = Region.levelOf(shape);
    const distLike = shape.kind !== 'formula';
    // a region whose formula iterates (iter(...): an escape test such as the Mandelbrot set's) costs up to N steps per
    // level evaluation, and its fractal boundary crosses many leaves: the boundary is found by fewer halvings of a
    // leaf's edge (2^-18 of a leaf of at most P_SRC px near the boundary: far below a pixel) instead of to the double's
    // last bits. Other regions are unchanged
    const iterL = shape.kind === 'formula' && /\\operatorname\{iter\}|\biter\s*\(/.test(shape.expr || '');
    const HALV = iterL ? 18 : 40, HALV_BND = iterL ? 14 : 30;
    // and its level evaluations count in the work budget (each as LEVW map evaluations: an escape test of about 64
    // steps against a map of a few), so its mesh ends on the budget instead of the time cap (10 s on a desktop)
    const LEVW = iterL ? 8 : 0;
    const left = cfg.left;
    const view = cfg.view;
    const flat = view.kind === 'flat';
    const K = Math.max(1, Math.min(KCAP, cfg.Kmax || 1));
    const KSAT = K;
    const TAU_DEV = 0.3;                             // px: chord deviation
    const EMAX = 64, EBND = 24;                      // px: image edge length (boundary leaves: 24)
    const TAU_BND = 0.5, TAU_PAT = 0.5;              // px
    const P_SRC = 12, P_REF = 4;                     // px of the left view: boundary feature resolution, depth reference
    const QUIET = 32;                                // consecutive quiet NVB levels before a fan is dropped
    const DELTA = 0.5;                               // octaves: commit lag of the coverage counter
    const MAXNODES = cfg.maxNodes || 300000;
    // the work budget (deterministic: the same mesh whatever the machine's load): map evaluations, a step probe of the
    // stage-wise evaluation counting as its 12 evaluations; budgetMs is only a safety stop (CPU ms in slices)
    const MAXWORK = cfg.maxWork || Infinity;
    const BUDGET_MS = cfg.budgetMs || 1500;
    const DEV_EXPIRY = 2;                            // px: at budget expiry, pending leaves this accurate are drawn
    const pat = cfg.pattern || { id: 0, cell: 1 };
    const patId = pat.id | 0, cell = pat.cell || 1;
    const usesPolar = PAT_POLAR.has(patId), usesCart = PAT_CART.has(patId) || !!pat.lines;
    const guard = flat ? Math.max(1, view.guard || 1) : 1;

    // ---------- vertices ----------
    let nv = 0, vcap = 1 << 12;
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
    const pt = [0, 0, 0];
    function newV(zx, zy, ux, uy, pri) {
      if (nv >= vcap) vgrow();
      const i = nv++;
      ZX[i] = zx; ZY[i] = zy; UX[i] = ux; UY[i] = uy; PRI[i] = pri; WS[i] = -1; LS[i] = -1;
      if (pri === 0) lift(zx, zy, pt);
      else { const qu = ux * ux + uy * uy, d = 1 + qu; pt[0] = 2 * ux / d; pt[1] = -2 * uy / d; pt[2] = (1 - qu) / d; }
      PX[i] = pt[0]; PY[i] = pt[1]; PZ[i] = pt[2];
      return i;
    }
    const addZ = (x, y) => { const u = inv(x, y); return newV(x, y, u[0], u[1], (x * x + y * y <= 1) ? 0 : 1); };
    const addU = (x, y) => { const z = inv(x, y); return newV(z[0], z[1], x, y, (x * x + y * y < 1) ? 1 : 0); };
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
    // limit probe at a vertex whose value is not finite (no stage-wise evaluation): two rings lifted to the image sphere
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
      if (SW) {
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
    let nt = 0, tcap = 1 << 13;
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
    function eDel(i, j, t) {
      const k = ekey(i, j), e = edges.get(k);
      if (!e) return;
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
      TA[t] = a; TB[t] = b; TC[t] = c; TCH[t] = -1; TST[t] = st; TQ[t] = q; TLEV[t] = lev; TCM[t] = 0;
      TD[t] = depthOf(t);
      eAdd(a, b, t); eAdd(b, c, t); eAdd(c, a, t);
      if (st === PENDING) heapPush(t);
      return t;
    }
    // split leaf t at the midpoint m of its refinement edge (b, c): children (m, a, b) and (m, c, a)
    function split(t, m) {
      const a = TA[t], b = TB[t], c = TC[t];
      const revisit = TST[t] === FINAL && TCM[t] ? [nbr(t, a, b), nbr(t, b, c), nbr(t, c, a)] : null;
      eDel(a, b, t); eDel(b, c, t); eDel(c, a, t);
      const st = TST[t] === PENDING ? PENDING : TST[t];
      const t1 = newT(m, a, b, st, TLEV[t] + 1, TQ[t]), t2 = newT(m, c, a, st, TLEV[t] + 1, TQ[t]);
      TCH[t] = t1;
      if (st === FINAL) {
        evalF(m); evalL(m);
        CUTP.delete(t);
        if (TCM[t] && !INJ) {   // already counted: the children's coverage replaces the parent's
          for (const tri of trisOf(t)) rasterCov(tri, -1);
          for (const k of [t1, t2]) { TCM[k] = 1; for (const tri of trisOf(k)) rasterCov(tri, 1); }
          for (const n of revisit) if (n >= 0 && TCH[n] < 0 && TST[n] === SAT) { TST[n] = PENDING; counts.revisit++; heapPush(n); }
        }
      }
      return [t1, t2];
    }
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
    const lv3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    function liftL(i, out) { return lift((ZX[i] - Lc[0]) / LR, (ZY[i] - Lc[1]) / LR, out); }
    function srcPx(t) {
      liftL(TA[t], lv3[0]); liftL(TB[t], lv3[1]); liftL(TC[t], lv3[2]);
      const d = Math.max(chord3(lv3[0], lv3[1]), chord3(lv3[1], lv3[2]), chord3(lv3[2], lv3[0]));
      return d * LR * left.s / 2;
    }
    function cheb(i) { if (!Number.isFinite(ZX[i]) || !Number.isFinite(ZY[i])) return Infinity; return Math.max(Math.abs(ZX[i] - Lc[0]) / Lhw, Math.abs(ZY[i] - Lc[1]) / Lhh); }
    const keyOf = cfg.depth ? (i) => (Number.isFinite(ZX[i]) && Number.isFinite(ZY[i]) ? cfg.depth(C(ZX[i], ZY[i])) : Infinity) : null;
    function depthOf(t) {
      if (keyOf) return Math.min(keyOf(TA[t]), keyOf(TB[t]), keyOf(TC[t]));
      const d = Math.min(cheb(TA[t]), cheb(TB[t]), cheb(TC[t]));
      const out = d > 1 ? Math.log2(d) : 0;
      const sp = srcPx(t);
      return out + (sp < P_REF ? Math.log2(P_REF / Math.max(sp, 1e-300)) : 0);
    }

    // ---------- metrics: image view ----------
    const VW = flat ? view.W : 0, VH = flat ? view.H : 0;
    const GXM = flat ? (guard - 1) * VW / 2 : 0, GYM = flat ? (guard - 1) * VH / 2 : 0;   // guard margins, px
    // circumradius of the (guarded) view, w units: the chordal cull's window disc
    const VR = flat ? guard * Math.hypot(view.W, view.H) / 2 / view.s : 1;
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
    function liftV(wx, wy, st, out) {
      if (st === INF) { out[0] = 0; out[1] = 0; out[2] = 1; return out; }
      return lift((wx - view.cx) / VR, (wy - view.cy) / VR, out);
    }
    // outcode against the guarded view enlarged by M px
    const ocG = (p, M) => (p[0] < -M - GXM ? 1 : 0) | (p[0] > VW + M + GXM ? 2 : 0) | (p[1] < -M - GYM ? 4 : 0) | (p[1] > VH + M + GYM ? 8 : 0);

    // ---------- coverage (saturation) ----------
    // flat: grid 0 counts the view's pixel centres (1 px); grid 1 (guard > 1) the guard band's at 3 px spacing (cells
    // whose centre lies in the view are masked: grid 0 holds them). Globe: a longitude-latitude grid of ~1 px cells.
    // mask: a rectangle of cells [x0, x1) x [y0, y1) that is never counted (cov 255; the view's cells in the band grid)
    function makeGrid(nx, ny, G, ox, oy, mask) {
      const g = { NX: nx, NY: ny, G, ox, oy, cov: new Uint8Array(nx * ny), nU: nx * ny, pyr: [null], pnx: [nx], pny: [ny] };
      g.LMAX = Math.max(1, Math.ceil(Math.log2(Math.max(nx, ny, 2))));
      const mk = mask && mask[1] > mask[0] && mask[3] > mask[2] ? mask : null;
      if (mk) {
        for (let y = mk[2]; y < mk[3]; y++) g.cov.fill(255, y * nx + mk[0], y * nx + mk[1]);
        g.nU -= (mk[1] - mk[0]) * (mk[3] - mk[2]);
      }
      // level L, block (x, y): its cells in the grid minus those in the mask. Built a row at a time with native fills
      // (the per-block loop was the set-up's cost: 4-7 ms per mesh job in the app, where the set-up, run once per job,
      // executes unoptimised; P5 review open item (5), the slices over 6 ms). Per row: the full blocks, the partial
      // last column, and in the mask's rows its first and last block columns (the ones between lie inside it).
      for (let L = 1; L <= g.LMAX; L++) {
        const b = 1 << L, bx = Math.ceil(nx / b), by = Math.ceil(ny / b), a = new Int32Array(bx * by);
        const lw = nx - (bx - 1) * b;                    // width of the last block column (1..b)
        const xa = mk ? Math.floor(mk[0] / b) : 0, xl = mk ? Math.ceil(mk[1] / b) - 1 : -1;
        for (let y = 0; y < by; y++) {
          const y0 = y * b, hy = Math.min(ny, y0 + b) - y0, r = y * bx;
          a.fill(b * hy, r, r + bx - 1); a[r + bx - 1] = lw * hy;
          const oy = mk ? Math.min(y0 + b, ny, mk[3]) - Math.max(y0, mk[2]) : 0;
          if (oy <= 0) continue;
          // (columns strictly between xa and xl: full width, inside the mask, never the last column)
          if (xl - xa > 1) a.fill(b * (hy - oy), r + xa + 1, r + xl);
          for (let x = xa; x <= xl; x += Math.max(1, xl - xa)) {
            const x0 = x * b, ox = Math.min(x0 + b, nx, mk[1]) - Math.max(x0, mk[0]);
            if (ox > 0) a[r + x] -= ox * oy;
          }
        }
        g.pyr.push(a); g.pnx.push(bx); g.pny.push(by);
      }
      return g;
    }
    const grids = [];
    const SNX = flat ? 0 : 2 ** Math.ceil(Math.log2(TAU * view.R)), SD = flat ? 0 : TAU / SNX, SNY = flat ? 0 : Math.ceil(Math.PI / SD);
    if (flat) {
      grids.push(makeGrid(Math.max(1, Math.ceil(VW)), Math.max(1, Math.ceil(VH)), 1, 0, 0));
      if (guard > 1) {
        // the band at guard px spacing; the cells whose centre lies in the view are masked (grid 0 counts them)
        const G = guard, nx = Math.ceil(guard * VW / G), ny = Math.ceil(guard * VH / G);
        const lo = (p, o) => Math.max(0, Math.ceil((p - o) / G - 0.5)), hi = (p, o, n) => Math.min(n, Math.floor((p - o) / G - 0.5) + 1);
        grids.push(makeGrid(nx, ny, G, -GXM, -GYM, [lo(0, -GXM), hi(VW, -GXM, nx), lo(0, -GYM), hi(VH, -GYM, ny)]));
      }
    } else grids.push(makeGrid(SNX, SNY, 1, 0, 0));
    const nUall = () => { let n = 0; for (const g of grids) n += g.nU; return n; };
    function bump(g, gx, gy, sgn) {
      const k = gy * g.NX + gx, cov = g.cov;
      if (cov[k] === 255) return;
      if (sgn < 0) {
        if (cov[k] === 0) return;
        if (cov[k]-- !== KSAT) return;
        g.nU++;
        for (let L = 1; L <= g.LMAX; L++) g.pyr[L][(gy >> L) * g.pnx[L] + (gx >> L)]++;
        return;
      }
      if (cov[k] >= 254) return;
      if (++cov[k] !== KSAT) return;
      g.nU--;
      for (let L = 1; L <= g.LMAX; L++) g.pyr[L][(gy >> L) * g.pnx[L] + (gx >> L)]--;
    }
    function sphLL(p) { const r = Math.hypot(p[0], p[1], p[2]); return [Math.atan2(p[1], p[0]), Math.asin(Math.max(-1, Math.min(1, p[2] / r)))]; }
    function inTri(P, x, y) {
      const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (!area) return false;
      const sg = area > 0 ? 1 : -1;
      for (let k = 0; k < 3; k++) {
        const a = P[k], b = P[(k + 1) % 3];
        if (((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) * sg < 0) return false;
      }
      return true;
    }
    function rasterCov(tri, sgn) {
      if (flat) {
        for (const g of grids) {
          const G = g.G;
          const x0 = Math.max(0, Math.floor((Math.min(tri[0][0], tri[1][0], tri[2][0]) - g.ox) / G)), x1 = Math.min(g.NX - 1, Math.floor((Math.max(tri[0][0], tri[1][0], tri[2][0]) - g.ox) / G));
          const y0 = Math.max(0, Math.floor((Math.min(tri[0][1], tri[1][1], tri[2][1]) - g.oy) / G)), y1 = Math.min(g.NY - 1, Math.floor((Math.max(tri[0][1], tri[1][1], tri[2][1]) - g.oy) / G));
          for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
            if (inTri(tri, g.ox + (gx + 0.5) * G, g.oy + (gy + 0.5) * G)) bump(g, gx, gy, sgn);
          }
        }
        return;
      }
      const g = grids[0];
      const ll = tri.map(sphLL);
      for (let k = 1; k < 3; k++) { while (ll[k][0] - ll[0][0] > Math.PI) ll[k][0] -= TAU; while (ll[k][0] - ll[0][0] < -Math.PI) ll[k][0] += TAU; }
      const x0 = Math.floor((Math.min(ll[0][0], ll[1][0], ll[2][0]) + Math.PI) / SD), x1 = Math.floor((Math.max(ll[0][0], ll[1][0], ll[2][0]) + Math.PI) / SD);
      const y0 = Math.max(0, Math.floor((Math.min(ll[0][1], ll[1][1], ll[2][1]) + Math.PI / 2) / SD)), y1 = Math.min(SNY - 1, Math.floor((Math.max(ll[0][1], ll[1][1], ll[2][1]) + Math.PI / 2) / SD));
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        if (inTri(ll, (gx + 0.5) * SD - Math.PI, (gy + 0.5) * SD - Math.PI / 2)) bump(g, ((gx % SNX) + SNX) % SNX, gy, sgn);
      }
    }
    // the tested zone of a saturation test, as a 1-Lipschitz function f (>= 0: test this sample): the outline P grown
    // by ex across its interior edges and shrunk by sh along its RIM edges (images of the region's boundary)
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
      return inside ? fin : Math.min(ex - dNon, dRim - dNon - sh);
    }
    // saturated when every sample (pixel centre) inside the tested zone already carries KSAT nearer layers
    function satGrid(g, P, rim, sh, ex, toX, toY, rB, box, wrapX) {
      const { NX, NY, pyr, pnx, pny, cov, LMAX } = g;
      let [cx0, cx1, cy0, cy1] = box;
      let tested = 0;
      const idxX = (L, bx) => (wrapX ? ((bx % pnx[L]) + pnx[L]) % pnx[L] : bx);
      function rec(L, bx, by) {
        if (by < 0 || by >= pny[L]) return true;
        if (!wrapX && (bx < 0 || bx >= pnx[L])) return true;
        const b = 1 << L, d = polyDist(P, toX((bx + 0.5) * b), toY((by + 0.5) * b), rim, sh, ex), r = rB(b);
        if (d + 2 * r < 0) return true;
        if (L === 0) { if (d < 0) return true; tested++; return cov[by * NX + idxX(0, bx)] >= KSAT; }
        if (d - 2 * r >= 0) { tested++; return pyr[L][by * pnx[L] + idxX(L, bx)] === 0; }
        return rec(L - 1, 2 * bx, 2 * by) && rec(L - 1, 2 * bx + 1, 2 * by) && rec(L - 1, 2 * bx, 2 * by + 1) && rec(L - 1, 2 * bx + 1, 2 * by + 1);
      }
      cy0 = Math.max(cy0, 0); cy1 = Math.min(cy1, NY - 1e-9);
      if (!wrapX) { cx0 = Math.max(cx0, 0); cx1 = Math.min(cx1, NX - 1e-9); } else if (cx1 - cx0 > NX) cx1 = cx0 + NX;
      if (cx1 < cx0 || cy1 < cy0) return { ok: true, tested: 0, empty: true };
      const span = Math.max(cx1 - cx0, cy1 - cy0, 1);
      const L = Math.min(LMAX, Math.ceil(Math.log2(span)));
      for (let by = Math.floor(cy0 / (1 << L)); by <= Math.floor(cy1 / (1 << L)); by++)
        for (let bx = Math.floor(cx0 / (1 << L)); bx <= Math.floor(cx1 / (1 << L)); bx++) if (!rec(L, bx, by)) return { ok: false, tested };
      return { ok: true, tested };
    }
    function saturated(poly, rim, sh, dev) {
      const ex = dev + TAU_DEV + 0.05;
      let tested = 0, empty = 0;
      if (flat) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        for (const g of grids) {
          const G = g.G, e = ex / G + 1;
          const r = satGrid(g, poly, rim, sh, ex, (cx) => g.ox + cx * G, (cy) => g.oy + cy * G, (b) => b * G * 0.7072,
            [(x0 - g.ox) / G - e, (x1 - g.ox) / G + e, (y0 - g.oy) / G - e, (y1 - g.oy) / G + e], false);
          if (!r.ok) return false;
          tested += r.tested; if (r.empty) empty++;
        }
        if (empty === grids.length) return true;   // the zone misses every grid: nothing there can show
      } else {
        const g = grids[0];
        const ll = poly.map(sphLL);
        for (let k = 1; k < ll.length; k++) { while (ll[k][0] - ll[0][0] > Math.PI) ll[k][0] -= TAU; while (ll[k][0] - ll[0][0] < -Math.PI) ll[k][0] += TAU; }
        let my = 0, mx = 0, y0 = Infinity, y1 = -Infinity;
        for (const p of ll) { my += p[1] / ll.length; mx += p[0] / ll.length; y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
        if (y1 > Math.PI / 2 - 4 * SD || y0 < -Math.PI / 2 + 4 * SD) return false;   // never across a pole
        const cl = Math.cos(my) * view.R, R = view.R;
        const P = ll.map((p) => [(p[0] - mx) * cl, p[1] * R]);
        const pc = ll.map((p) => [(p[0] + Math.PI) / SD, (p[1] + Math.PI / 2) / SD]);
        let cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity;
        for (const p of pc) { cx0 = Math.min(cx0, p[0]); cx1 = Math.max(cx1, p[0]); cy0 = Math.min(cy0, p[1]); cy1 = Math.max(cy1, p[1]); }
        const ex1 = ex / (SD * view.R * Math.max(0.05, Math.cos((cy0 + cy1) / 2 * SD - Math.PI / 2))) + 1, ey1 = ex / (SD * view.R) + 1;
        const r = satGrid(g, P, rim, sh, ex, (cx) => (cx * SD - Math.PI - mx) * cl, (cy) => (cy * SD - Math.PI / 2) * R, (b) => b * SD * R * 0.7072,
          [cx0 - ex1, cx1 + ex1, cy0 - ey1, cy1 + ey1], true);
        if (!r.ok) return false;
        if (r.empty) return true;
        tested = r.tested;
      }
      if (tested) return true;
      return dev <= TAU_DEV;
    }
    // the clipped image outline of a leaf: vertices and edge midpoints inside the region, clip points where an edge
    // crosses its boundary; rim[i]: the edge P[i] -> P[i+1] runs between two clip points
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
          if (insM[k] !== ins[k]) return null;
          if (ins[k] && !push(m, 0)) return null;
        } else if (!push(ins[k] ? clipV(p, q) : clipV(q, p), 1)) return null;
      }
      if (P.length < 3) return null;
      const rim = kind.map((k, i) => k === 1 && kind[(i + 1) % kind.length] === 1);
      return { P, rim };
    }
    // finalized leaves wait here (a min-heap by D) until the processing front has passed them by DELTA octaves
    const commitQ = [];
    function commitPush(D, t) {
      commitQ.push([D, t]);
      let i = commitQ.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (commitQ[p][0] <= commitQ[i][0]) break; [commitQ[p], commitQ[i]] = [commitQ[i], commitQ[p]]; i = p; }
    }
    // -> false when the deadline passed first (the rest is committed by the next call; the order is the same)
    function commitUpTo(D, deadline = Infinity) {
      let n = 0;
      while (commitQ.length && commitQ[0][0] < D - DELTA) {
        if ((++n & 3) === 0 && now() > deadline) return false;
        const top = commitQ[0], last = commitQ.pop();
        if (commitQ.length) {
          commitQ[0] = last;
          let i = 0;
          for (;;) { let c = 2 * i + 1; if (c >= commitQ.length) break; if (c + 1 < commitQ.length && commitQ[c + 1][0] < commitQ[c][0]) c++; if (commitQ[c][0] >= commitQ[i][0]) break; [commitQ[c], commitQ[i]] = [commitQ[i], commitQ[c]]; i = c; }
        }
        const st = [top[1]];
        while (st.length) {
          const u = st.pop();
          if (TCH[u] >= 0) { st.push(TCH[u], TCH[u] + 1); continue; }
          if (TST[u] !== FINAL) continue;
          TCM[u] = 1;
          if (!INJ) for (const tri of trisOf(u)) rasterCov(tri, 1);
        }
      }
      return true;
    }

    // ---------- heap (by depth D, FIFO on ties) ----------
    let hk = new Float64Array(1 << 12), hv = new Int32Array(1 << 12), hn = 0, hseq = 0;
    function heapPush(t, k0) {
      if (hn >= hk.length) { const k2 = new Float64Array(hk.length * 2); k2.set(hk); hk = k2; const v2 = new Int32Array(hv.length * 2); v2.set(hv); hv = v2; }
      let i = hn++;
      const key = k0 !== undefined ? k0 : TD[t] + (hseq++) * 1e-12;
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

    // ---------- catalog cut constraints (lead graft) ----------
    const CUTS = [];
    if (SW && cfg.cuts !== false) cfg.steps.forEach((b, k) => { for (const c of b.cuts || []) if (c.kind === 'ray' && c.p && Number.isFinite(c.ang)) CUTS.push({ k, p: c.p, e: C(Math.cos(c.ang), -Math.sin(c.ang)) }); });
    const NC = 8;
    const cutCache = new Map();
    function cutAtZ(z, zInf, j) {
      const cj = CUTS[j];
      const u = SW(z, zInf, cj.k);
      if (!Number.isFinite(u.re) || !Number.isFinite(u.im)) return [NaN, NaN];
      const dx = u.re - cj.p.re, dy = u.im - cj.p.im;
      return [cj.e.re * dy + cj.e.im * dx, cj.e.re * dx - cj.e.im * dy];
    }
    function cutV(i, j) {
      const key = i * NC + j;
      let r = cutCache.get(key);
      if (!r) { const fin = Number.isFinite(ZX[i]) && Number.isFinite(ZY[i]); r = cutAtZ(fin ? C(ZX[i], ZY[i]) : null, !fin, j); cutCache.set(key, r); }
      return r;
    }
    const cut3 = (m, j) => { const z = zOf3(m[0], m[1], m[2]); return cutAtZ(z, !Number.isFinite(z.re) || !Number.isFinite(z.im), j); };
    const crossCache = new Map();
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
    function leafCut(vid, mids) {
      if (!CUTS.length) return null;
      let found = null;
      for (let j = 0; j < CUTS.length; j++) {
        const sv = vid.map((i) => cutV(i, j));
        if (sv.some((x) => Number.isNaN(x[0]))) {
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
            if ((sm[0] > 0) !== sd[k] && sm[1] > 0) return { dirty: true };
          }
        }
        if (!crossed.length) continue;
        if (crossed.length !== 2 || found) return { dirty: true };
        const L = crossed.includes(0) && crossed.includes(2) ? 0 : crossed.includes(0) ? 1 : 2;
        found = { j, L };
      }
      return found;
    }
    function cutPieces(vid, lc) {
      const L = lc.L, vL = vid[L], v1 = vid[(L + 1) % 3], v2 = vid[(L + 2) % 3];
      const c1 = crossing(vL, v1, lc.j), c2 = crossing(vL, v2, lc.j);
      return { A: [vL, c1.pv, c2.pv], B: [c1.qv, v1, v2, c2.qv], c1, c2 };
    }
    const CUTP = new Map();
    const fanTris = (P) => { const out = []; for (let k = 1; k + 1 < P.length; k++) out.push([P[0], P[k], P[k + 1]]); return out; };
    const srcArea = (tri) => {
      const a = [PX[tri[0]], PY[tri[0]], PZ[tri[0]]], b = [PX[tri[1]], PY[tri[1]], PZ[tri[1]]], c = [PX[tri[2]], PY[tri[2]], PZ[tri[2]]];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    };
    function piecesOf(vid, lc) {
      const pc = cutPieces(vid, lc);
      const tris = [...fanTris(pc.A), ...fanTris(pc.B)];
      // (a piece whose source area vanishes against the leaf's: a crossing found on an edge that lies along the cut
      // gives a collinear sliver, which covers nothing and would leave three open edges)
      const L2 = Math.max(chord3([PX[vid[0]], PY[vid[0]], PZ[vid[0]]], [PX[vid[1]], PY[vid[1]], PZ[vid[1]]]), chord3([PX[vid[1]], PY[vid[1]], PZ[vid[1]]], [PX[vid[2]], PY[vid[2]], PZ[vid[2]]]), chord3([PX[vid[2]], PY[vid[2]], PZ[vid[2]]], [PX[vid[0]], PY[vid[0]], PZ[vid[0]]])) ** 2;
      return tris.filter((tri) => srcArea(tri) > Math.max(1e-300, 1e-9 * L2) && tri.every((i) => WS[i] === FIN || (!flat && WS[i] === INF)));
    }
    function cutTest(vid, mids, lc) {
      const pc = cutPieces(vid, lc);
      const L = lc.L, sideL = cutV(vid[L], lc.j)[0] > 0;
      const pts = [...pc.A, ...pc.B];
      if (pts.some((i) => i < 0 || !vs(i, S3()))) return 'split';
      const devAt = (i, j, wm) => { const P = vs(i, S3()), Q = vs(j, S3()); return Math.hypot(wm[0] - (P[0] + Q[0]) / 2, wm[1] - (P[1] + Q[1]) / 2, wm[2] - (P[2] + Q[2]) / 2); };
      const sampleMid = (i, j, side) => {
        const m = mid3(i, j), cm = cut3(m, lc.j);
        if (Number.isNaN(cm[0]) || (cm[0] > 0) !== side) return null;
        const z = zOf3(m[0], m[1], m[2]), w = Fz(z);
        return smp(w.re, w.im, isFiniteW(w) ? FIN : UNDEF, S3());
      };
      let dev = 0;
      const allS = [];
      const kOpp = (L + 1) % 3;
      { const m = vs(mids[kOpp], S3()); if (!m) return 'split'; dev = Math.max(dev, devAt(vid[(L + 1) % 3], vid[(L + 2) % 3], m)); allS.push(m); }
      for (const [i, j, side] of [[pc.A[0], pc.A[1], sideL], [pc.A[2], pc.A[0], sideL], [pc.B[0], pc.B[1], !sideL], [pc.B[2], pc.B[3], !sideL]]) {
        const m = sampleMid(i, j, side);
        if (!m) return 'split';
        dev = Math.max(dev, devAt(i, j, m)); allS.push(m);
      }
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
      let emax = 0;
      for (const P of [pc.A, pc.B]) for (let k = 0; k < P.length; k++) { const a = vs(P[k], S3()), b = vs(P[(k + 1) % P.length], S3()); emax = Math.max(emax, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); allS.push(a); }
      if (flat) {
        const M = Math.max(2, 0.5 * emax);
        const offA = [...pc.A.map((i) => vs(i, S3())), allS[1], allS[2], allS[5]].reduce((c, p) => c & ocG(p, M), 15);
        const offB = [...pc.B.map((i) => vs(i, S3())), allS[0], allS[3], allS[4], allS[6]].reduce((c, p) => c & ocG(p, M), 15);
        if (offA && offB && dev <= 0.3 * emax) return 'cull';
      }
      return dev <= TAU_DEV && cdev <= TAU_BND && emax <= EBND ? 'ok' : 'split';
    }

    // ---------- clipping (marching triangles on the leaf, bisection on the shared edge) ----------
    function clipV(p, q) {
      const k = ekey(p, q);
      let c = eclip.get(k);
      if (c !== undefined) return c;
      let a = [PX[p], PY[p], PZ[p]], b = [PX[q], PY[q], PZ[q]];
      for (let it = 0; it < HALV; it++) {
        const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z), m = [x / n, y / n, z / n];
        if (levAt(zOf3(m[0], m[1], m[2])) > 0) a = m; else b = m;
      }
      const x = a[0] + b[0], y = a[1] + b[1], z = a[2] + b[2], n = Math.hypot(x, y, z);
      c = vOf3(x / n, y / n, z / n);
      evalF(c); LV[c] = 0; LS[c] = 0;
      eclip.set(k, c);
      return c;
    }
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
    // Cartesian: z / cell; polar: (ln |z|, arg z) * 16 / tau, about 0 (the app's pattern origin)
    function cartOf(i, out) {
      if (PRI[i] === 1 && !(Number.isFinite(ZX[i]) && Number.isFinite(ZY[i]))) { out[0] = 1e30; out[1] = 1e30; return out; }
      out[0] = ZX[i] / cell; out[1] = ZY[i] / cell; return out;
    }
    function polarOf(i, out) {
      let lr, ar;
      if (PRI[i] === 1) { const au = Math.hypot(UX[i], UY[i]); lr = au > 0 ? -Math.log(au) : 1e4; ar = -Math.atan2(UY[i], UX[i]); }
      else { const r = Math.hypot(ZX[i], ZY[i]); lr = r > 0 ? Math.log(r) : -1e4; ar = Math.atan2(ZY[i], ZX[i]); }
      out[0] = lr * 16 / TAU; out[1] = ar * 16 / TAU; return out;
    }
    // the interpolated pattern coordinates stay within TAU_PAT px of the true ones at the edge midpoints
    function patTestOf(attr, vid, mids, S, unwrapY) {
      const g = vid.map((i) => attr(i, [0, 0])), gm = mids.map((i) => attr(i, [0, 0]));
      const unwrap = (a, ref) => { if (!unwrapY) return a; while (a[1] - ref[1] > 8) a[1] -= 16; while (a[1] - ref[1] < -8) a[1] += 16; return a; };
      unwrap(g[1], g[0]); unwrap(g[2], g[0]);
      let eg = 0, gmax = 0, pmax = 0;
      for (let k = 0; k < 3; k++) {
        const p = g[k], q = g[(k + 1) % 3], m = unwrap(gm[k], p);
        eg = Math.max(eg, Math.hypot(m[0] - (p[0] + q[0]) / 2, m[1] - (p[1] + q[1]) / 2));
        gmax = Math.max(gmax, Math.hypot(q[0] - p[0], q[1] - p[1]));
        pmax = Math.max(pmax, Math.hypot(S[(k + 1) % 3][0] - S[k][0], S[(k + 1) % 3][1] - S[k][1], S[(k + 1) % 3][2] - S[k][2]));
      }
      if (!(gmax > 0) || !Number.isFinite(gmax)) return true;
      const pxPerCell = pmax / gmax;
      if (pxPerCell < 2) return true;   // moire zone: averaged by the shader
      return eg * pxPerCell <= TAU_PAT;
    }
    function patTest(vid, mids, S) {
      if (usesCart && !patTestOf(cartOf, vid, mids, S, false)) return false;
      if (usesPolar && !patTestOf(polarOf, vid, mids, S, true)) return false;
      return true;
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
    // a ring piece (non-fan child) for the quiet counter: true when it can add nothing
    function quiet(t) {
      const v = [TA[t], TB[t], TC[t]];
      for (const i of v) { evalL(i); if (LS[i] === UNDEF) return false; }
      const mids = [midV(v[0], v[1]), midV(v[1], v[2]), midV(v[2], v[0])];
      for (const i of mids) evalL(i);
      if ([...v, ...mids].every((i) => LV[i] <= 0)) return true;
      const S = [];
      const six = [v[0], mids[0], v[1], mids[1], v[2], mids[2]];
      for (const i of six) evalF(i);
      if (flat && six.some((i) => WS[i] === INF) && six.every((i) => WS[i] === FIN || WS[i] === INF)) {
        const P = six.map((i) => liftV(WX[i], WY[i], WS[i], S3()));
        let dia = 0, marg = Infinity;
        for (let x = 0; x < P.length; x++) {
          for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, chord3(P[x], P[y]));
          marg = Math.min(marg, P[x][2] > 0 ? 2 * Math.sin(Math.asin(Math.min(1, P[x][2])) / 2) : -1);
        }
        return marg > 1.5 * dia;
      }
      for (const i of six) { const s = vs(i, S3()); if (!s) return false; S.push(s); }
      if (flat) {
        let code = 15;
        for (const p of S) code &= ocG(p, 2);
        if (code) return true;
      }
      let dmax = 0;
      for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) dmax = Math.max(dmax, Math.hypot(S[a][0] - S[b][0], S[a][1] - S[b][1], S[a][2] - S[b][2]));
      if (dmax < 0.5) return true;
      let dv = 0;
      for (let k = 0; k < 3; k++) { const p = S[2 * k], m = S[2 * k + 1], q = S[(2 * k + 2) % 6]; dv = Math.max(dv, Math.hypot(m[0] - (p[0] + q[0]) / 2, m[1] - (p[1] + q[1]) / 2, m[2] - (p[2] + q[2]) / 2)); }
      if (dv > 0.25 * dmax) return false;
      if (INJ) return false;
      const ip = imgPoly(t);
      return !!ip && saturated(ip.P, ip.rim, dv + 0.5, dv);
    }
    function fanSplit(t) {
      const q = TQ[t];
      bisect(t);
      counts.fanSplit++;
      const kids = [TCH[t], TCH[t] + 1];
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
    // the chord deviation of a leaf (vertices, edge midpoints, centroid) in px, or Infinity (a value is missing)
    function leafDev(t) {
      const vid = [TA[t], TB[t], TC[t]], mids = [midV(vid[0], vid[1]), midV(vid[1], vid[2]), midV(vid[2], vid[0])];
      for (const i of [...vid, ...mids]) evalF(i);
      const S = vid.map((i) => vs(i, S3())), Sm = mids.map((i) => vs(i, S3()));
      if (!S.every(Boolean) || !Sm.every(Boolean)) return Infinity;
      let dev = 0;
      for (let k = 0; k < 3; k++) { const p = S[k], q = S[(k + 1) % 3], m = Sm[k]; dev = Math.max(dev, Math.hypot(m[0] - (p[0] + q[0]) / 2, m[1] - (p[1] + q[1]) / 2, m[2] - (p[2] + q[2]) / 2)); }
      return dev;
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
        for (const i of mids) evalF(i);
        const others = [...vid, ...mids].filter((i) => !isApex(i));
        const allInf = apex.every((i) => WS[i] === INF);
        if (flat && allInf && others.every((i) => WS[i] === FIN || WS[i] === INF)) {
          const P = others.map((i) => liftV(WX[i], WY[i], WS[i], S3()));
          P.push([0, 0, 1]);
          let dia = 0, marg = Infinity;
          for (let x = 0; x < P.length; x++) {
            for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, chord3(P[x], P[y]));
            marg = Math.min(marg, P[x][2] > 0 ? 2 * Math.sin(Math.asin(Math.min(1, P[x][2])) / 2) : -1);
          }
          if (marg > 1.5 * dia) { TST[t] = CULLED; counts.chordCull++; counts.culled++; return; }
        }
        if (apex.every((i) => WS[i] === FIN || (!flat && WS[i] === INF))) {
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
      // ---- catalog cuts ----
      if (CUTS.length) {
        const lc = leafCut(vid, mids);
        const allIn = [...vid, ...mids].every((i) => LV[i] > 0);
        if (lc && !lc.dirty && allIn) {
          const r = cutTest(vid, mids, lc);
          if (r === 'ok') { CUTP.set(t, piecesOf(vid, lc)); counts.cutClip++; finalize(t); return; }
          if (r === 'cull') { TST[t] = CULLED; counts.culled++; return; }
          if (sizeFloor(t)) { TST[t] = DROPPED; counts.floor++; return; }
          counts.split++; counts.cutSplit++; bisect(t); return;
        }
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
      // ---- cull (flat): off one side of the guarded view, tame; or chordally around infinity ----
      if (flat) {
        const M = Math.max(2, 0.5 * emax);
        let code = 15;
        for (const p of all) code &= ocG(p, M);
        if (code && dev <= 0.3 * emax) { TST[t] = CULLED; counts.culled++; return; }
        const P = [...vid, ...mids].map((i) => liftV(WX[i], WY[i], WS[i], S3()));
        P.push(liftV(wg.re, wg.im, gst, S3()));
        let dia = 0, marg = Infinity;
        for (let x = 0; x < P.length; x++) {
          for (let y = x + 1; y < P.length; y++) dia = Math.max(dia, chord3(P[x], P[y]));
          marg = Math.min(marg, P[x][2] > 0 ? 2 * Math.sin(Math.asin(Math.min(1, P[x][2])) / 2) : -1);
        }
        if (marg > 1.5 * dia) { TST[t] = CULLED; counts.chordCull++; counts.culled++; return; }
      }
      // ---- sub-pixel leaf / sub-pixel gap (a jump across a cut) ----
      {
        const d3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        let dmax = 0;
        for (let x = 0; x < all.length; x++) for (let y = x + 1; y < all.length; y++) dmax = Math.max(dmax, d3(all[x], all[y]));
        if (dmax < 0.5) { finalize(t); counts.subpx++; return; }
        let jumps = 0, okGap = true;
        for (let k = 0; k < 3 && okGap; k++) {
          const p = S[k], q = S[(k + 1) % 3], m = Sm[k];
          if (d3(p, q) <= 0.5 && d3(m, p) <= 0.5) continue;
          if (Math.min(d3(m, p), d3(m, q)) <= 0.5) jumps++; else okGap = false;
        }
        if (okGap && jumps && Math.min(d3(Sg, S[0]), d3(Sg, S[1]), d3(Sg, S[2])) <= 0.5) {
          let real = true;
          for (let k = 0; k < 3 && real; k++) {
            const p = S[k], q = S[(k + 1) % 3];
            if (d3(p, q) <= 0.5) continue;
            real = isJump(vid[k], vid[(k + 1) % 3]);
          }
          if (real) { TST[t] = DROPPED; counts.gap++; return; }
          if (dmax <= 1.5) { finalize(t); counts.subpx++; return; }
        }
      }
      // ---- saturation ----
      if (!INJ && TD[t] > DELTA && dev <= 0.25 * emax) {
        const ip = imgPoly(t);
        if (ip && saturated(ip.P, ip.rim, dev + 0.5, dev)) { TST[t] = SAT; counts.sat++; return; }
      }
      // ---- accuracy ----
      let ok = dev <= TAU_DEV && emax <= EMAX;
      if (ok && !patTest(vid, mids, S)) { ok = false; counts.patSplit++; }
      if (ok) {
        const lv = vid.map((i) => LV[i]);
        const mixed = lv.some((x) => x > 0) && lv.some((x) => x <= 0);
        if (mixed) {
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
      const m = mid3(cl[0], cl[1]);
      const zm = zOf3(m[0], m[1], m[2]);
      const sIn = levAt(zm) > 0;
      const k = ins.findIndex((x) => x !== sIn);
      let pa = m, pb = [PX[v[k]], PY[v[k]], PZ[v[k]]];
      for (let it = 0; it < HALV_BND; it++) {
        const x = pa[0] + pb[0], y = pa[1] + pb[1], z = pa[2] + pb[2], n = Math.hypot(x, y, z), q = [x / n, y / n, z / n];
        if ((levAt(zOf3(q[0], q[1], q[2])) > 0) === sIn) pa = q; else pb = q;
      }
      const w = Fz(zOf3(pa[0], pa[1], pa[2]));
      const P = smp(w.re, w.im, isFiniteW(w) ? FIN : UNDEF, S3());
      if (!P) return false;
      const A = vs(cl[0], S3()), B = vs(cl[1], S3());
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
          for (const i of mids) evalL(i);
          const lc = leafCut(vid, mids);
          if (lc && lc.dirty) return [];
          if (lc) { const r = piecesOf(vid, lc); CUTP.set(t, r); return r; }
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

    // ---------- the driver: resumable, budgeted ----------
    let started = false, finished = false, msUsed = 0, budgetHit = false, budgetWhy = '';
    function init() {
      const Sv = addZ(0, 0), N = addU(0, 0);
      const E = [addZ(1, 0), addZ(0, 1), addZ(-1, 0), addZ(0, -1)];
      for (let k = 0; k < 4; k++) {
        newT(Sv, E[k], E[(k + 1) % 4], PENDING, 0, 0);
        newT(N, E[(k + 1) % 4], E[k], PENDING, 0, 0);
      }
    }
    // runs for about ms milliseconds (the refinement, then the publication's phases); {done, partial}: partial when a
    // budget ended the refinement. The published data is ready when done.
    function step(ms = Infinity) {
      if (finished && pubCache) return { done: true, partial: budgetHit };
      const t0 = now();
      if (!finished) {
        const r = refine(ms, t0);
        if (!r) return { done: false, partial: false };
      }
      const left = ms - (now() - t0);
      if (!pubStep(t0 + Math.max(0.5, left))) return { done: false, partial: budgetHit };
      return { done: true, partial: budgetHit };
    }
    // the refinement within the slice -> true when it has ended (no pending leaf, global saturation or a budget)
    function refine(ms, t0) {
      if (!started) { started = true; init(); }
      const deadline = t0 + ms;
      while (hn > 0) {
        const k0 = hk[0], t = heapPop();
        if (TCH[t] >= 0 || TST[t] !== PENDING) continue;
        // (out of time inside the commits: t goes back with its own key, so a sliced run equals an unsliced one)
        if (!commitUpTo(TD[t], deadline)) { heapPush(t, k0); msUsed += now() - t0; return false; }
        if (!INJ && nUall() === 0) {   // every sample carries K nearer layers: nothing still pending can show
          TST[t] = SAT; counts.globalSat++;
          while (hn > 0) { const u = heapPop(); if (TCH[u] < 0 && TST[u] === PENDING) { TST[u] = SAT; counts.globalSat++; } }
          break;
        }
        processT(t);
        if (nt > MAXNODES) { budgetHit = true; budgetWhy = 'nodes'; break; }
        if (nEval + 12 * (SW ? SW.stepProbes : 0) + LEVW * nLev > MAXWORK) { budgetHit = true; budgetWhy = 'work'; break; }
        {
          const el = now() - t0;
          if (msUsed + el > BUDGET_MS) { budgetHit = true; budgetWhy = 'time'; break; }
          if (el > ms) { msUsed += el; return false; }
        }
      }
      msUsed += now() - t0;
      finished = true;
      return true;
    }

    // ---------- output (8.7) ----------
    // every FINAL leaf, clipped (and at a budget expiry the pending leaves within DEV_EXPIRY px), far to near (D
    // descending, then source y ascending: the tie rule of 5.2). Flat: pos = w - w0 (w0 = the view centre), globe:
    // pos3 = the conjugate lift; attr per vertex (g.x, g.y, P.x, P.y): g = (z - Q_t) / cell with Q_t a multiple of
    // 10 cells per triangle, P = the polar coordinates (arg unwrapped from the first vertex) or, for graph paper, the
    // absolute source point; tri: the area scale 0.5 log2 |dw / dz| per triangle.
    let pubCache = null, pub = null;
    // the publication in phases (leaves, their clipped triangles, the order, the arrays), each resumable: -> true when
    // the data is ready (deadline: a performance.now() time)
    function pubStep(deadline) {
      if (pubCache) return true;
      if (!pub) pub = { phase: 0, t: 0, leaves: [], k: 0, tris: [] };
      const late = (i, mask) => (i & mask) === 0 && now() > deadline;
      if (pub.phase === 0) {   // the drawn leaves (FINAL; at a budget expiry also the pending ones within DEV_EXPIRY px)
        for (let i = 0; pub.t < nt; pub.t++, i++) {
          if (late(i, 15)) return false;
          const t = pub.t;
          if (TCH[t] >= 0) continue;
          if (TST[t] === FINAL) pub.leaves.push(t);
          else if (TST[t] === PENDING && budgetHit) {
            let ok = true;
            for (const j of [TA[t], TB[t], TC[t]]) { evalL(j); if (LS[j] === UNDEF) ok = false; }
            if (ok && [TA[t], TB[t], TC[t]].some((j) => LV[j] > 0) && leafDev(t) <= DEV_EXPIRY) { TST[t] = FINAL; pub.leaves.push(t); }
          }
        }
        pub.phase = 1; pub.k = 0;
      }
      if (pub.phase === 1) {   // their triangles, clipped by the region and cut at catalog cuts
        for (let i = 0; pub.k < pub.leaves.length; pub.k++, i++) {
          if (late(i, 15)) return false;
          const t = pub.leaves[pub.k];
          for (const tri of leafTris(t)) {
            if (!tri.every((j) => WS[j] === FIN || (!flat && WS[j] === INF))) continue;
            pub.tris.push({ v: tri, D: TD[t], ys: (Number.isFinite(ZY[tri[0]]) ? ZY[tri[0]] : 0) + (Number.isFinite(ZY[tri[1]]) ? ZY[tri[1]] : 0) + (Number.isFinite(ZY[tri[2]]) ? ZY[tri[2]] : 0), leaf: t });
          }
        }
        pub.phase = 2;
      }
      if (pub.phase === 2) {   // far to near: D descending, then source y ascending (the tie rule of 5.2)
        // a bottom-up merge sort of indices, resumable between pair merges (a 25k-triangle sort in one go took 10-20 ms)
        const T = pub.tris, n0 = T.length;
        if (!pub.ord && pub.cut !== 2) { pub.ord = Int32Array.from({ length: n0 }, (_, i) => i); pub.tmp = new Int32Array(n0); pub.w = 1; pub.lo = 0; }
        const cmp = (a, b) => (T[b].D - T[a].D) || (T[a].ys - T[b].ys) || (T[a].leaf - T[b].leaf);
        while (pub.w < n0) {
          const w = pub.w, src = pub.ord, dst = pub.tmp;
          while (pub.lo < n0) {
            const lo = pub.lo, mid = Math.min(lo + w, n0), hi = Math.min(lo + 2 * w, n0);
            let i = lo, j = mid, k = lo;
            while (i < mid && j < hi) dst[k++] = cmp(src[i], src[j]) <= 0 ? src[i++] : src[j++];
            while (i < mid) dst[k++] = src[i++];
            while (j < hi) dst[k++] = src[j++];
            pub.lo = hi;
            if (now() > deadline) return false;
          }
          pub.ord = dst; pub.tmp = src; pub.w = 2 * w; pub.lo = 0;
        }
        // (the reorder and the output arrays each take a slice of their own when sliced: at 175k triangles (a 300 dpi
        // export) the two together took 8-11 ms)
        if (deadline !== Infinity && pub.cut !== 1 && pub.cut !== 2) { pub.cut = 1; if (now() > deadline - 2) return false; }
        if (pub.cut !== 2) { pub.tris = Array.from(pub.ord, (i) => T[i]); pub.ord = pub.tmp = null; pub.cut = 2; if (deadline !== Infinity) return false; }
        const n = pub.tris.length;
        pub.n = n;
        pub.origin = flat ? [view.cx, view.cy] : [0, 0];
        pub.pos = flat ? new Float32Array(n * 6) : null; pub.pos3 = flat ? null : new Float32Array(n * 9);
        pub.attr = new Float32Array(n * 12); pub.triA = new Float32Array(n);
        pub.box = [Infinity, -Infinity, Infinity, -Infinity];
        pub.phase = 3; pub.k = 0;
        if (now() > deadline) return false;
      }
      if (pub.phase === 3) {
        const per = 10, g0 = [0, 0], p0 = [0, 0], q3 = [0, 0, 0], origin = pub.origin, pos = pub.pos, pos3 = pub.pos3, attr = pub.attr, bx = pub.box;
        for (let i = 0; pub.k < pub.n; pub.k++, i++) {
          if (late(i, 255)) return false;
          const k = pub.k, v = pub.tris[k].v;
          // Q_t: the vertex of smallest |z| snapped to 10 cells
          let qi = v[0];
          for (const j of v) if (Math.hypot(ZX[j], ZY[j]) < Math.hypot(ZX[qi], ZY[qi])) qi = j;
          cartOf(qi, g0);
          const qx = Number.isFinite(g0[0]) && Math.abs(g0[0]) < 1e15 ? Math.round(g0[0] / per) * per : 0;
          const qy = Number.isFinite(g0[1]) && Math.abs(g0[1]) < 1e15 ? Math.round(g0[1] / per) * per : 0;
          let a0 = 0;
          for (let j = 0; j < 3; j++) {
            const q = v[j];
            if (flat) {
              pos[k * 6 + 2 * j] = WX[q] - origin[0]; pos[k * 6 + 2 * j + 1] = WY[q] - origin[1];
              if (WX[q] < bx[0]) bx[0] = WX[q]; if (WX[q] > bx[1]) bx[1] = WX[q]; if (WY[q] < bx[2]) bx[2] = WY[q]; if (WY[q] > bx[3]) bx[3] = WY[q];
            } else {
              if (WS[q] === INF) { q3[0] = 0; q3[1] = 0; q3[2] = 1; } else liftConj(WX[q], WY[q], q3);
              pos3[k * 9 + 3 * j] = q3[0]; pos3[k * 9 + 3 * j + 1] = q3[1]; pos3[k * 9 + 3 * j + 2] = q3[2];
            }
            cartOf(q, g0);
            const gx = Math.max(-1e20, Math.min(1e20, g0[0] - qx)), gy = Math.max(-1e20, Math.min(1e20, g0[1] - qy));
            let px, py;
            if (patId === 4) { px = Math.max(-1e30, Math.min(1e30, ZX[q])); py = Math.max(-1e30, Math.min(1e30, ZY[q])); }
            else {
              polarOf(q, p0);
              if (j === 0) a0 = p0[1];
              else { while (p0[1] - a0 > 8) p0[1] -= 16; while (p0[1] - a0 < -8) p0[1] += 16; }
              px = p0[0]; py = p0[1];
            }
            attr[k * 12 + 4 * j] = gx; attr[k * 12 + 4 * j + 1] = gy; attr[k * 12 + 4 * j + 2] = px; attr[k * 12 + 4 * j + 3] = py;
          }
          // the area scale: image area over source area (Area scale pattern)
          const i0 = v[0], i1 = v[1], i2 = v[2];
          const sa = (ZX[i1] - ZX[i0]) * (ZY[i2] - ZY[i0]) - (ZX[i2] - ZX[i0]) * (ZY[i1] - ZY[i0]);
          const wa = (WX[i1] - WX[i0]) * (WY[i2] - WY[i0]) - (WX[i2] - WX[i0]) * (WY[i1] - WY[i0]);
          const jac = 0.5 * Math.log2(Math.max(Math.abs(wa), 1e-300) / Math.max(Math.abs(sa), 1e-300));
          pub.triA[k] = Number.isFinite(jac) ? jac : 0;
        }
        const sc = flat ? view.s : 1;
        const guardBox = flat ? { x0: view.cx - guard * VW / 2 / sc, x1: view.cx + guard * VW / 2 / sc, y0: view.cy - guard * VH / 2 / sc, y1: view.cy + guard * VH / 2 / sc } : null;
        pubCache = { pos: pub.pos, pos3: pub.pos3, attr: pub.attr, tri: pub.triA, n: pub.n, order: 'far-to-near', origin: pub.origin, guardBox, imageBox: flat && pub.n ? { x0: bx[0], x1: bx[1], y0: bx[2], y1: bx[3] } : null, partial: budgetHit };
        pub = null;
      }
      return true;
    }
    // the published data (8.7); finishes the refinement and the publication at once when they have not ended yet
    function publish() {
      if (pubCache) return pubCache;
      if (!finished) refine(Infinity, now());
      pubStep(Infinity);
      return pubCache;
    }
    function leafStates() {
      const s = { final: 0, culled: 0, outside: 0, saturated: 0, dropped: 0, pending: 0 };
      for (let t = 0; t < nt; t++) if (TCH[t] < 0) s[STATE_NAMES[TST[t]]]++;
      return s;
    }
    function stats() {
      return { nodes: nt, verts: nv, evals: nEval, probes: nProbe, stepProbes: SW ? SW.stepProbes : 0, work: nEval + 12 * (SW ? SW.stepProbes : 0) + LEVW * nLev, levels: nLev, K, ms: msUsed, budgetHit, budgetWhy, done: finished, counts, leaves: leafStates() };
    }
    // CPU bytes held: the refinement structures until disposed, then the published arrays
    function bytes() {
      let b = 0;
      if (ZX) b += vcap * (8 * 11 + 3) + tcap * (1 + 4 * 4 + 1 + 2 + 4 + 2) + (edges.size + emid.size + eclip.size) * 48 + grids.reduce((x, g) => x + g.cov.length * 2.4, 0);
      if (pubCache) b += (pubCache.pos ? pubCache.pos.byteLength : 0) + (pubCache.pos3 ? pubCache.pos3.byteLength : 0) + pubCache.attr.byteLength + pubCache.tri.byteLength;
      return b;
    }
    // frees the refinement structures (the published data stays)
    function dispose() {
      ZX = ZY = UX = UY = PX = PY = PZ = WX = WY = WS = LV = LS = PRI = null;
      TCM = TA = TB = TC = TCH = TST = TQ = TD = TLEV = null;
      edges.clear(); emid.clear(); eclip.clear(); cutCache.clear(); crossCache.clear(); CUTP.clear(); jumpCache.clear();
      grids.length = 0; hk = hv = null; commitQ.length = 0;
      finished = true;
    }
    return {
      step, publish, stats, bytes, dispose, K,
      get phase() { return pubCache ? 5 : pub ? 1 + pub.phase : finished ? 1 : 0; },
      get nodes() { return nt; },
      // accessors for the tests (12.3)
      V: () => ({ ZX, ZY, UX, UY, PX, PY, PZ, WX, WY, WS, PRI, LV }), T: () => ({ TA, TB, TC, TCH, TST, TD, nt }),
      Fz, zOf3, cartOf, polarOf, leafTris, view, left,
    };
  }
  // the app's budgets (8.4, deterministic): map evaluations and nodes per screen mesh, and the guard (app.js reads
  // these; t_sphere runs them on the P5 scenes). At the default alpha 0.85 (K 3) and dpr 1 a full mesh of exp(H) takes
  // 162k evaluations, e^{1/z}(D) 231k, e^{z+1/z}(H) 184k: they finish; exp(exp z)(H) (753k, 422k nodes) ends on the work
  // budget, flagged partial. The work grows with K (85k per layer above 3), so a translucent infinitely-sheeted image
  // (alpha 0.2: K 25; a full mesh of exp(H) would take 814k nodes, e^{1/z}(D) 1.1M) refines until the node budget,
  // about 10 layers as before, rather than stopping at 5 on the work budget.
  const APP = { maxWork: 250000, maxNodes: 300000, guard: 2, workOf: (K) => Math.max(250000, 85000 * K) };
  return { create, kOf, KCAP, APP, lift, liftConj, stagewise, atInfOf, probeStep, FIN, INF, UNDEF, FINAL, PAT_POLAR, PAT_CART };
})();
import { CX } from './cx.js';
import { Region } from './region.js';
export { SphereMesh, SphereMesh as 'module.exports' };
